import { getDb } from '../database';
import { NpcTemplate, NpcState, NpcFeeling, NpcMemory, Player } from '../../shared/types';
import { NPC_TEMPLATES, INITIAL_DESIRES, getNpcTemplate, getNpcByKeyword } from '../data/npcs';
import geminiService from '../services/geminiService';
import { gameLog } from '../services/logger';
import { equipmentManager } from './equipmentManager';
import { conditionManager } from './conditionManager';

class NpcManager {
  // Initialize NPCs at server start
  initializeNpcs(): void {
    const db = getDb();

    // Initialize NPC states
    const insertState = db.prepare(
      `INSERT OR REPLACE INTO npc_state (npc_template_id, current_room, mood, energy)
       VALUES (?, ?, 'neutral', 100)`
    );

    // Only initialize non-dwarf NPCs at start (dwarves arrive later)
    for (const npc of NPC_TEMPLATES) {
      if (!npc.arrivalHour) {
        insertState.run(npc.id, npc.homeRoom);
      }
    }

    // Initialize desires
    const insertDesire = db.prepare(
      `INSERT INTO npc_desires (npc_template_id, desire_type, desire_content, desire_reason, priority)
       SELECT ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM npc_desires WHERE npc_template_id = ? AND fulfilled_at IS NULL
       )`
    );

    for (const desire of INITIAL_DESIRES) {
      if (desire.npcTemplateId) {
        insertDesire.run(
          desire.npcTemplateId,
          desire.desireType,
          desire.desireContent,
          desire.desireReason,
          desire.priority,
          desire.npcTemplateId
        );
      }
    }

    console.log('NPCs initialized');
  }

  // Get NPC template
  getNpcTemplate(id: number): NpcTemplate | undefined {
    return getNpcTemplate(id);
  }

  // Find NPC by keyword
  findNpcByKeyword(keyword: string): NpcTemplate | undefined {
    return getNpcByKeyword(keyword);
  }

  // Get NPC's current location (room ID)
  // Returns the NPC's current room from state, or their homeRoom as fallback
  getNpcLocation(npcTemplateId: number): string | null {
    const state = this.getNpcState(npcTemplateId);
    if (state?.currentRoom) {
      return state.currentRoom;
    }
    // Fallback to home room from template
    const template = this.getNpcTemplate(npcTemplateId);
    return template?.homeRoom || null;
  }

  // Find an NPC by keyword and return their location info
  // Useful for "where is [NPC]" questions
  findNpcLocation(keyword: string): { npc: NpcTemplate; roomId: string } | null {
    const npc = this.findNpcByKeyword(keyword);
    if (!npc) return null;

    const roomId = this.getNpcLocation(npc.id);
    if (!roomId) return null;

    return { npc, roomId };
  }

  // Get NPC state
  getNpcState(npcTemplateId: number): NpcState | null {
    const db = getDb();

    const row = db
      .prepare('SELECT * FROM npc_state WHERE npc_template_id = ?')
      .get(npcTemplateId) as any;

    if (!row) return null;

    return {
      npcTemplateId: row.npc_template_id,
      currentRoom: row.current_room,
      mood: row.mood,
      currentTask: row.current_task,
      energy: row.energy,
      lastPlayerInteraction: row.last_player_interaction
        ? new Date(row.last_player_interaction)
        : null,
    };
  }

  // Update NPC state
  updateNpcState(npcTemplateId: number, updates: Partial<NpcState>): void {
    const db = getDb();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.currentRoom !== undefined) {
      fields.push('current_room = ?');
      values.push(updates.currentRoom);
    }
    if (updates.mood !== undefined) {
      fields.push('mood = ?');
      values.push(updates.mood);
    }
    if (updates.currentTask !== undefined) {
      fields.push('current_task = ?');
      values.push(updates.currentTask);
    }
    if (updates.energy !== undefined) {
      fields.push('energy = ?');
      values.push(updates.energy);
    }
    if (updates.lastPlayerInteraction !== undefined) {
      fields.push('last_player_interaction = ?');
      values.push(
        updates.lastPlayerInteraction ? updates.lastPlayerInteraction.toISOString() : null
      );
    }

    if (fields.length > 0) {
      values.push(npcTemplateId);
      db.prepare(`UPDATE npc_state SET ${fields.join(', ')} WHERE npc_template_id = ?`).run(
        ...values
      );
    }
  }

  // Get NPCs in a room
  getNpcsInRoom(roomId: string): { template: NpcTemplate; state: NpcState }[] {
    const db = getDb();

    const rows = db
      .prepare('SELECT npc_template_id FROM npc_state WHERE current_room = ?')
      .all(roomId) as { npc_template_id: number }[];

    return rows
      .map(row => {
        const template = this.getNpcTemplate(row.npc_template_id);
        const state = this.getNpcState(row.npc_template_id);
        return template && state ? { template, state } : null;
      })
      .filter((x): x is { template: NpcTemplate; state: NpcState } => x !== null);
  }

  // Move NPC to a room
  moveNpc(npcTemplateId: number, roomId: string): void {
    this.updateNpcState(npcTemplateId, { currentRoom: roomId });
  }

  // Get NPC's feelings toward someone
  getFeeling(npcTemplateId: number, targetType: 'player' | 'npc', targetId: number): NpcFeeling | null {
    const db = getDb();

    const row = db
      .prepare(
        'SELECT * FROM npc_feelings WHERE npc_template_id = ? AND target_type = ? AND target_id = ?'
      )
      .get(npcTemplateId, targetType, targetId) as any;

    if (!row) return null;

    return {
      id: row.id,
      npcTemplateId: row.npc_template_id,
      targetType: row.target_type,
      targetId: row.target_id,
      trust: row.trust,
      affection: row.affection,
      socialCapital: row.social_capital,
      notes: row.notes,
      updatedAt: new Date(row.updated_at),
    };
  }

  // Update or create feelings
  updateFeeling(
    npcTemplateId: number,
    targetType: 'player' | 'npc',
    targetId: number,
    updates: Partial<Pick<NpcFeeling, 'trust' | 'affection' | 'socialCapital' | 'notes'>>
  ): void {
    const db = getDb();

    const existing = this.getFeeling(npcTemplateId, targetType, targetId);

    if (existing) {
      const fields: string[] = ['updated_at = CURRENT_TIMESTAMP'];
      const values: any[] = [];

      if (updates.trust !== undefined) {
        fields.push('trust = ?');
        values.push(Math.max(0, Math.min(100, updates.trust)));
      }
      if (updates.affection !== undefined) {
        fields.push('affection = ?');
        values.push(Math.max(0, Math.min(100, updates.affection)));
      }
      if (updates.socialCapital !== undefined) {
        fields.push('social_capital = ?');
        values.push(Math.max(-100, Math.min(100, updates.socialCapital)));
      }
      if (updates.notes !== undefined) {
        fields.push('notes = ?');
        values.push(updates.notes);
      }

      values.push(existing.id);
      db.prepare(`UPDATE npc_feelings SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    } else {
      db.prepare(
        `INSERT INTO npc_feelings (npc_template_id, target_type, target_id, trust, affection, social_capital, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        npcTemplateId,
        targetType,
        targetId,
        updates.trust ?? 50,
        updates.affection ?? 50,
        updates.socialCapital ?? 0,
        updates.notes ?? null
      );
    }
  }

  // Adjust feelings (relative change)
  adjustFeeling(
    npcTemplateId: number,
    targetType: 'player' | 'npc',
    targetId: number,
    adjustments: { trust?: number; affection?: number; socialCapital?: number },
    reason?: string
  ): void {
    const current = this.getFeeling(npcTemplateId, targetType, targetId);
    const npc = this.getNpcTemplate(npcTemplateId);

    const newValues = {
      trust: (current?.trust ?? 50) + (adjustments.trust ?? 0),
      affection: (current?.affection ?? 50) + (adjustments.affection ?? 0),
      socialCapital: (current?.socialCapital ?? 0) + (adjustments.socialCapital ?? 0),
    };

    this.updateFeeling(npcTemplateId, targetType, targetId, newValues);

    // Log feeling change
    if (npc && (adjustments.trust || adjustments.affection)) {
      gameLog.feelingUpdated(
        npc.name,
        targetType === 'player' ? `player#${targetId}` : `npc#${targetId}`,
        newValues.trust,
        newValues.affection,
        reason || 'interaction'
      );
    }
  }

  // Add a memory
  addMemory(
    npcTemplateId: number,
    aboutType: 'player' | 'npc',
    aboutId: number,
    content: string,
    importance: number = 5
  ): void {
    const db = getDb();
    const npc = this.getNpcTemplate(npcTemplateId);

    db.prepare(
      `INSERT INTO npc_memories (npc_template_id, about_type, about_id, memory_content, importance)
       VALUES (?, ?, ?, ?, ?)`
    ).run(npcTemplateId, aboutType, aboutId, content, importance);

    // Log memory
    if (npc) {
      gameLog.memoryAdded(npc.name, aboutType === 'player' ? `player#${aboutId}` : `npc#${aboutId}`, content);
    }

    // Keep only last 10 memories per NPC-target pair
    db.prepare(
      `DELETE FROM npc_memories WHERE id IN (
         SELECT id FROM npc_memories
         WHERE npc_template_id = ? AND about_type = ? AND about_id = ?
         ORDER BY created_at DESC
         LIMIT -1 OFFSET 10
       )`
    ).run(npcTemplateId, aboutType, aboutId);
  }

  // Get recent memories
  getMemories(
    npcTemplateId: number,
    aboutType: 'player' | 'npc',
    aboutId: number,
    limit: number = 5
  ): NpcMemory[] {
    const db = getDb();

    const rows = db
      .prepare(
        `SELECT * FROM npc_memories
         WHERE npc_template_id = ? AND about_type = ? AND about_id = ?
         ORDER BY created_at DESC LIMIT ?`
      )
      .all(npcTemplateId, aboutType, aboutId, limit) as any[];

    return rows.map(row => ({
      id: row.id,
      npcTemplateId: row.npc_template_id,
      aboutType: row.about_type,
      aboutId: row.about_id,
      memoryContent: row.memory_content,
      importance: row.importance,
      createdAt: new Date(row.created_at),
    }));
  }

  // Generate dialogue using AI
  async generateDialogue(
    npc: NpcTemplate,
    player: Player,
    playerMessage: string
  ): Promise<string> {
    const state = this.getNpcState(npc.id);
    const feeling = this.getFeeling(npc.id, 'player', player.id);
    const memories = this.getMemories(npc.id, 'player', player.id, 3);
    const desire = this.getCurrentDesire(npc.id);

    const npcsInRoom = this.getNpcsInRoom(player.currentRoom);
    const otherNpcs = npcsInRoom
      .filter(n => n.template.id !== npc.id)
      .map(n => n.template.name);

    // Get player appearance context
    const equipmentQuality = equipmentManager.getEquipmentQualityDescription(player.id);
    const visibleCondition = conditionManager.getVisibleConditionDescription(player.id);
    const charismaBonus = equipmentManager.getCharismaBonus(player.id);
    const npcReaction = conditionManager.getNpcReactionContext(player.id);

    const context = {
      mood: state?.mood || 'neutral',
      currentDesire: desire?.desireContent,
      desireReason: desire?.desireReason || undefined,
      feelingsTowardPlayer: feeling
        ? {
            trust: feeling.trust,
            affection: feeling.affection,
            socialCapital: feeling.socialCapital,
            notes: feeling.notes || undefined,
          }
        : undefined,
      recentMemories: memories.map(m => m.memoryContent),
      otherNpcsPresent: otherNpcs.length > 0 ? otherNpcs : undefined,
      playerAppearance: {
        equipmentQuality,
        visibleCondition,
        charismaBonus,
        npcReaction: {
          fear: npcReaction.fear,
          concern: npcReaction.concern,
          disgust: npcReaction.disgust,
          respect: npcReaction.respect + Math.floor(charismaBonus / 2), // Equipment affects respect
        },
      },
    };

    // Update last interaction time
    this.updateNpcState(npc.id, { lastPlayerInteraction: new Date() });

    // Record this interaction as a memory
    const memorySummary = await geminiService.generateMemorySummary(
      npc.name,
      player.name,
      'said',
      playerMessage
    );
    this.addMemory(npc.id, 'player', player.id, memorySummary, 5);

    // Small positive adjustment for social interaction
    this.adjustFeeling(npc.id, 'player', player.id, { affection: 1 }, 'talked');

    // Log the dialogue request
    gameLog.npcDialogue(npc.name, player.name, playerMessage, 'generating...');

    // Check if this is a guide request
    console.log('[GUIDE-DEBUG] Checking for guide request:', playerMessage);
    const { npcGuideManager } = await import('./npcGuideManager');
    const guideCheck = await geminiService.detectGuideRequest(
      playerMessage,
      npcGuideManager.getAvailableLocations()
    );
    console.log('[GUIDE-DEBUG] Guide check result:', JSON.stringify(guideCheck));

    gameLog.log('NPC', 'GUIDE-CHECK', `Guide detection for "${playerMessage}"`, {
      isGuideRequest: guideCheck.isGuideRequest,
      destination: guideCheck.destination,
    });

    if (guideCheck.isGuideRequest && guideCheck.destination) {
      // Try to guide the player
      const guideResult = await npcGuideManager.startGuiding(npc, player, guideCheck.destination);
      gameLog.log('NPC', 'GUIDE-RESULT', `Guide result: ${guideResult.success}`, {
        message: guideResult.message,
      });
      if (guideResult.success) {
        gameLog.npcDialogueResponse(npc.name, guideResult.message);
        return guideResult.message.replace(`${npc.name} says: `, '');
      }
      // If guiding failed, fall through to normal dialogue
    }

    const response = await geminiService.generateNpcDialogue(npc, player, playerMessage, context);

    // Log the response
    gameLog.npcDialogueResponse(npc.name, response);

    return response;
  }

  // Get current active desire
  getCurrentDesire(npcTemplateId: number): {
    id: number;
    desireType: string;
    desireContent: string;
    desireReason: string | null;
    priority: number;
  } | null {
    const db = getDb();

    const row = db
      .prepare(
        `SELECT id, desire_type, desire_content, desire_reason, priority
         FROM npc_desires
         WHERE npc_template_id = ? AND fulfilled_at IS NULL
         ORDER BY priority DESC LIMIT 1`
      )
      .get(npcTemplateId) as any;

    if (!row) return null;

    return {
      id: row.id,
      desireType: row.desire_type,
      desireContent: row.desire_content,
      desireReason: row.desire_reason,
      priority: row.priority,
    };
  }

  // Get compact context string for AI prompts
  getCompactContext(npcTemplateId: number): string {
    const state = this.getNpcState(npcTemplateId);
    const desire = this.getCurrentDesire(npcTemplateId);

    const parts: string[] = [];

    if (desire) {
      parts.push(`wants:${desire.desireContent}`);
    }
    if (state) {
      parts.push(`mood:${state.mood}`);
    }

    return parts.join('|');
  }

  // Spawn dwarves for a given hour (call from game loop)
  spawnDwarvesForHour(hour: number): NpcTemplate[] {
    const db = getDb();
    const dwarves = NPC_TEMPLATES.filter(npc => npc.arrivalHour === hour);

    for (const dwarf of dwarves) {
      // Check if already spawned
      const exists = db
        .prepare('SELECT 1 FROM npc_state WHERE npc_template_id = ?')
        .get(dwarf.id);

      if (!exists) {
        db.prepare(
          `INSERT INTO npc_state (npc_template_id, current_room, mood, energy)
           VALUES (?, 'bag_end_hall', 'eager', 100)`
        ).run(dwarf.id);
      }
    }

    return dwarves;
  }
}

export const npcManager = new NpcManager();
export default npcManager;
