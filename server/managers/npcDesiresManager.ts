import { getDb } from '../database';
import { NpcDesire, NpcTemplate, ItemTemplate, Player } from '../../shared/types';
import { npcManager } from './npcManager';
import { worldManager } from './worldManager';
import geminiService from '../services/geminiService';
import { getItemTemplate, ITEM_TEMPLATES } from '../data/items';

class NpcDesiresManager {
  // Get all active desires for an NPC
  getActiveDesires(npcTemplateId: number): NpcDesire[] {
    const db = getDb();

    const rows = db
      .prepare(
        `SELECT * FROM npc_desires
         WHERE npc_template_id = ? AND fulfilled_at IS NULL
         ORDER BY priority DESC`
      )
      .all(npcTemplateId) as any[];

    return rows.map(row => ({
      id: row.id,
      npcTemplateId: row.npc_template_id,
      desireType: row.desire_type,
      desireContent: row.desire_content,
      desireReason: row.desire_reason,
      priority: row.priority,
      spawnedItemId: row.spawned_item_id,
      spawnedRoomId: row.spawned_room_id,
      fulfilledAt: row.fulfilled_at ? new Date(row.fulfilled_at) : null,
      createdAt: new Date(row.created_at),
    }));
  }

  // Get the current highest priority desire
  getCurrentDesire(npcTemplateId: number): NpcDesire | null {
    const desires = this.getActiveDesires(npcTemplateId);
    return desires[0] || null;
  }

  // Add a new desire
  addDesire(
    npcTemplateId: number,
    desireType: NpcDesire['desireType'],
    desireContent: string,
    desireReason: string | null,
    priority: number = 5
  ): number {
    const db = getDb();

    const result = db
      .prepare(
        `INSERT INTO npc_desires (npc_template_id, desire_type, desire_content, desire_reason, priority)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(npcTemplateId, desireType, desireContent, desireReason, priority);

    return result.lastInsertRowid as number;
  }

  // Fulfill a desire
  fulfillDesire(desireId: number): void {
    const db = getDb();

    db.prepare('UPDATE npc_desires SET fulfilled_at = CURRENT_TIMESTAMP WHERE id = ?').run(desireId);
  }

  // Check if an item fulfills a desire
  checkItemFulfillment(
    npcTemplateId: number,
    item: ItemTemplate
  ): { fulfilled: boolean; desireId?: number; response?: string } {
    const desires = this.getActiveDesires(npcTemplateId);

    for (const desire of desires) {
      if (desire.desireType === 'item') {
        // Check if this item matches the desire
        const desireLower = desire.desireContent.toLowerCase();
        const itemMatches =
          item.name.toLowerCase().includes(desireLower) ||
          item.keywords.some(k => desireLower.includes(k.toLowerCase())) ||
          desireLower.includes(item.name.toLowerCase());

        if (itemMatches) {
          return {
            fulfilled: true,
            desireId: desire.id,
            response: `Thank you! This is exactly what I needed!`,
          };
        }
      }
    }

    return { fulfilled: false };
  }

  // Spawn an item that an NPC desires
  async spawnItemForDesire(
    npcTemplateId: number,
    desireId: number
  ): Promise<{
    success: boolean;
    item?: ItemTemplate;
    roomId?: string;
    directions?: string;
  }> {
    const db = getDb();

    // Get the desire
    const desire = db
      .prepare('SELECT * FROM npc_desires WHERE id = ?')
      .get(desireId) as any;

    if (!desire || desire.desire_type !== 'item') {
      return { success: false };
    }

    // Find a matching item template
    const desireLower = desire.desire_content.toLowerCase();
    let item = ITEM_TEMPLATES.find(
      i =>
        i.name.toLowerCase().includes(desireLower) ||
        i.keywords.some(k => desireLower.includes(k.toLowerCase()))
    );

    if (!item) {
      // Default to a generic item if no match
      item = ITEM_TEMPLATES.find(i => i.itemType === 'tool') || ITEM_TEMPLATES[0];
    }

    // Get NPC's current room for directions
    const npcState = npcManager.getNpcState(npcTemplateId);
    const npcRoom = npcState?.currentRoom || 'hobbiton_village';

    // Find appropriate spawn location
    const spawnRoom = worldManager.getSpawnRoomForItemType(item.itemType);

    // Spawn the item
    worldManager.spawnQuestItem(item.id, spawnRoom, npcTemplateId, desireId);

    // Update the desire with spawn info
    db.prepare('UPDATE npc_desires SET spawned_item_id = ?, spawned_room_id = ? WHERE id = ?').run(
      item.id,
      spawnRoom,
      desireId
    );

    // Get directions
    const directions = worldManager.getDirections(npcRoom, spawnRoom);

    return {
      success: true,
      item,
      roomId: spawnRoom,
      directions: directions || 'I\'m not sure exactly where you\'d find it.',
    };
  }

  // Generate a new desire based on context
  async generateNewDesire(npcTemplateId: number): Promise<NpcDesire | null> {
    const template = npcManager.getNpcTemplate(npcTemplateId);
    if (!template) return null;

    const state = npcManager.getNpcState(npcTemplateId);
    const currentDesires = this.getActiveDesires(npcTemplateId);

    const context = `
Current mood: ${state?.mood || 'neutral'}
Current location: ${state?.currentRoom || 'unknown'}
Current desires: ${currentDesires.map(d => d.desireContent).join(', ') || 'none'}
Time in the Shire, beginning of an unexpected adventure.
`;

    const result = await geminiService.generateNpcDesire(template, context);
    if (!result) return null;

    const desireId = this.addDesire(
      npcTemplateId,
      result.desireType as NpcDesire['desireType'],
      result.desireContent,
      result.desireReason,
      result.priority
    );

    return {
      id: desireId,
      npcTemplateId,
      desireType: result.desireType as NpcDesire['desireType'],
      desireContent: result.desireContent,
      desireReason: result.desireReason,
      priority: result.priority,
      spawnedItemId: null,
      spawnedRoomId: null,
      fulfilledAt: null,
      createdAt: new Date(),
    };
  }

  // Get context string for AI (compact format)
  getCompactDesireContext(npcTemplateId: number): string {
    const desires = this.getActiveDesires(npcTemplateId);
    if (desires.length === 0) return '';

    return desires
      .slice(0, 3)
      .map(d => `wants:${d.desireContent}(${d.priority})`)
      .join('|');
  }

  // Check if giving an item to NPC fulfills their desire and process rewards
  async processItemGift(
    npcTemplateId: number,
    player: Player,
    item: ItemTemplate
  ): Promise<{
    accepted: boolean;
    response: string;
    trustGain?: number;
    affectionGain?: number;
  }> {
    const template = npcManager.getNpcTemplate(npcTemplateId);
    if (!template) {
      return { accepted: false, response: 'Something went wrong.' };
    }

    const fulfillment = this.checkItemFulfillment(npcTemplateId, item);

    if (fulfillment.fulfilled && fulfillment.desireId) {
      // Fulfill the desire
      this.fulfillDesire(fulfillment.desireId);

      // Increase feelings toward player
      npcManager.adjustFeeling(npcTemplateId, 'player', player.id, {
        trust: 15,
        affection: 10,
        socialCapital: 20,
      });

      // Add memory
      npcManager.addMemory(
        npcTemplateId,
        'player',
        player.id,
        `Gave me ${item.name}, fulfilling my desire`,
        8
      );

      return {
        accepted: true,
        response: `${template.name}'s eyes light up. "This is exactly what I needed! Thank you kindly!"`,
        trustGain: 15,
        affectionGain: 10,
      };
    }

    // Gift not matching desire - still accept but smaller bonus
    const feeling = npcManager.getFeeling(npcTemplateId, 'player', player.id);
    const currentAffection = feeling?.affection ?? 50;

    if (currentAffection > 60) {
      // They like the player, accept gift graciously
      npcManager.adjustFeeling(npcTemplateId, 'player', player.id, {
        affection: 3,
        socialCapital: 5,
      });

      npcManager.addMemory(npcTemplateId, 'player', player.id, `Gave me a gift: ${item.name}`, 5);

      return {
        accepted: true,
        response: `${template.name} accepts the ${item.name} with a smile. "How thoughtful of you!"`,
        affectionGain: 3,
      };
    } else {
      // Neutral/suspicious - might refuse
      if (item.value > 10) {
        npcManager.adjustFeeling(npcTemplateId, 'player', player.id, {
          affection: 2,
          trust: -5, // Why are they giving expensive gifts?
        });

        return {
          accepted: true,
          response: `${template.name} looks at the ${item.name} suspiciously but accepts it. "I... thank you?"`,
        };
      } else {
        npcManager.adjustFeeling(npcTemplateId, 'player', player.id, { affection: 1 });

        return {
          accepted: true,
          response: `${template.name} nods and takes the ${item.name}. "That's... kind of you."`,
        };
      }
    }
  }
}

export const npcDesiresManager = new NpcDesiresManager();
export default npcDesiresManager;
