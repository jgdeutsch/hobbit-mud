import { getDb } from '../database';
import { Quest, QuestStep, QuestStatus, QuestStepStatus, QuestStepType } from '../../shared/types';
import { npcManager } from './npcManager';

class QuestManager {
  // ==================== Quest CRUD ====================

  createQuest(
    playerId: number,
    npcId: number,
    title: string,
    description: string | null,
    desireId?: number
  ): number {
    const db = getDb();

    const result = db
      .prepare(
        `INSERT INTO player_quests (player_id, quest_giver_npc_id, title, description, desire_id)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(playerId, npcId, title, description, desireId ?? null);

    return result.lastInsertRowid as number;
  }

  getQuest(questId: number): Quest | null {
    const db = getDb();

    const row = db.prepare('SELECT * FROM player_quests WHERE id = ?').get(questId) as any;
    if (!row) return null;

    return this.mapQuestRow(row);
  }

  getActiveQuests(playerId: number): Quest[] {
    const db = getDb();

    const rows = db
      .prepare(
        `SELECT * FROM player_quests
         WHERE player_id = ? AND status = 'active'
         ORDER BY accepted_at DESC`
      )
      .all(playerId) as any[];

    return rows.map(row => this.mapQuestRow(row));
  }

  getAllQuests(playerId: number): Quest[] {
    const db = getDb();

    const rows = db
      .prepare('SELECT * FROM player_quests WHERE player_id = ? ORDER BY accepted_at DESC')
      .all(playerId) as any[];

    return rows.map(row => this.mapQuestRow(row));
  }

  completeQuest(questId: number): void {
    const db = getDb();

    db.prepare(
      `UPDATE player_quests SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(questId);
  }

  abandonQuest(questId: number): void {
    const db = getDb();

    db.prepare(`UPDATE player_quests SET status = 'abandoned' WHERE id = ?`).run(questId);
  }

  private mapQuestRow(row: any): Quest {
    return {
      id: row.id,
      playerId: row.player_id,
      questGiverNpcId: row.quest_giver_npc_id,
      title: row.title,
      description: row.description,
      status: row.status as QuestStatus,
      acceptedAt: new Date(row.accepted_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      desireId: row.desire_id,
    };
  }

  // ==================== Step Management ====================

  addQuestStep(
    questId: number,
    stepOrder: number,
    stepType: QuestStepType,
    targetId: string | null,
    targetName: string,
    description: string,
    npcHint: string,
    completionDialogue: string | null
  ): number {
    const db = getDb();

    const result = db
      .prepare(
        `INSERT INTO quest_steps
         (quest_id, step_order, step_type, target_id, target_name, description, npc_hint, completion_dialogue)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(questId, stepOrder, stepType, targetId, targetName, description, npcHint, completionDialogue);

    return result.lastInsertRowid as number;
  }

  getQuestSteps(questId: number): QuestStep[] {
    const db = getDb();

    const rows = db
      .prepare('SELECT * FROM quest_steps WHERE quest_id = ? ORDER BY step_order ASC')
      .all(questId) as any[];

    return rows.map(row => this.mapStepRow(row));
  }

  getCurrentStep(questId: number): QuestStep | null {
    const db = getDb();

    const row = db
      .prepare(`SELECT * FROM quest_steps WHERE quest_id = ? AND status = 'current' LIMIT 1`)
      .get(questId) as any;

    return row ? this.mapStepRow(row) : null;
  }

  advanceToNextStep(questId: number): QuestStep | null {
    const db = getDb();

    // Mark current step as completed
    db.prepare(
      `UPDATE quest_steps SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE quest_id = ? AND status = 'current'`
    ).run(questId);

    // Find next pending step
    const nextStep = db
      .prepare(
        `SELECT * FROM quest_steps WHERE quest_id = ? AND status = 'pending'
         ORDER BY step_order ASC LIMIT 1`
      )
      .get(questId) as any;

    if (nextStep) {
      // Mark it as current
      db.prepare(`UPDATE quest_steps SET status = 'current' WHERE id = ?`).run(nextStep.id);
      return this.mapStepRow({ ...nextStep, status: 'current' });
    } else {
      // No more steps - quest is complete!
      this.completeQuest(questId);
      return null;
    }
  }

  startQuest(questId: number): QuestStep | null {
    const db = getDb();

    // Find first step and mark as current
    const firstStep = db
      .prepare(
        `SELECT * FROM quest_steps WHERE quest_id = ? ORDER BY step_order ASC LIMIT 1`
      )
      .get(questId) as any;

    if (firstStep) {
      db.prepare(`UPDATE quest_steps SET status = 'current' WHERE id = ?`).run(firstStep.id);
      return this.mapStepRow({ ...firstStep, status: 'current' });
    }

    return null;
  }

  private mapStepRow(row: any): QuestStep {
    return {
      id: row.id,
      questId: row.quest_id,
      stepOrder: row.step_order,
      stepType: row.step_type as QuestStepType,
      targetId: row.target_id,
      targetName: row.target_name,
      description: row.description,
      npcHint: row.npc_hint,
      completionDialogue: row.completion_dialogue,
      status: row.status as QuestStepStatus,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
    };
  }

  // ==================== Completion Detection Hooks ====================

  checkItemPickup(playerId: number, itemTemplateId: number): { completed: boolean; message?: string; questId?: number } {
    const quests = this.getActiveQuests(playerId);

    for (const quest of quests) {
      const currentStep = this.getCurrentStep(quest.id);
      if (currentStep && currentStep.stepType === 'get_item') {
        // Check if target matches (target_id stores item_template_id as string)
        if (currentStep.targetId === String(itemTemplateId)) {
          const message = currentStep.completionDialogue || `You've obtained the ${currentStep.targetName}.`;
          const nextStep = this.advanceToNextStep(quest.id);

          let fullMessage = message;
          if (!nextStep) {
            fullMessage += `\n\n[Quest Completed: ${quest.title}]`;
          }

          return { completed: true, message: fullMessage, questId: quest.id };
        }
      }
    }

    return { completed: false };
  }

  checkLocationVisit(playerId: number, roomId: string): { completed: boolean; message?: string; questId?: number } {
    const quests = this.getActiveQuests(playerId);

    for (const quest of quests) {
      const currentStep = this.getCurrentStep(quest.id);
      if (currentStep && currentStep.stepType === 'visit_location') {
        if (currentStep.targetId === roomId) {
          const message = currentStep.completionDialogue || `You've arrived at ${currentStep.targetName}.`;
          const nextStep = this.advanceToNextStep(quest.id);

          let fullMessage = message;
          if (!nextStep) {
            fullMessage += `\n\n[Quest Completed: ${quest.title}]`;
          }

          return { completed: true, message: fullMessage, questId: quest.id };
        }
      }
    }

    return { completed: false };
  }

  checkNpcConversation(playerId: number, npcTemplateId: number): { completed: boolean; message?: string; questId?: number } {
    const quests = this.getActiveQuests(playerId);

    for (const quest of quests) {
      const currentStep = this.getCurrentStep(quest.id);
      if (currentStep && currentStep.stepType === 'talk_to_npc') {
        if (currentStep.targetId === String(npcTemplateId)) {
          const message = currentStep.completionDialogue || `You've spoken with ${currentStep.targetName}.`;
          const nextStep = this.advanceToNextStep(quest.id);

          let fullMessage = message;
          if (!nextStep) {
            fullMessage += `\n\n[Quest Completed: ${quest.title}]`;
          }

          return { completed: true, message: fullMessage, questId: quest.id };
        }
      }
    }

    return { completed: false };
  }

  checkItemGive(
    playerId: number,
    itemTemplateId: number,
    toNpcId: number
  ): { completed: boolean; message?: string; questId?: number } {
    const quests = this.getActiveQuests(playerId);

    for (const quest of quests) {
      const currentStep = this.getCurrentStep(quest.id);
      if (currentStep && currentStep.stepType === 'give_item') {
        // target_id format: "item_template_id:npc_template_id" or just "item_template_id"
        const expectedTarget = `${itemTemplateId}:${toNpcId}`;
        const simpleTarget = String(itemTemplateId);

        if (currentStep.targetId === expectedTarget || currentStep.targetId === simpleTarget) {
          const message = currentStep.completionDialogue || `You've given the ${currentStep.targetName}.`;
          const nextStep = this.advanceToNextStep(quest.id);

          let fullMessage = message;
          if (!nextStep) {
            fullMessage += `\n\n[Quest Completed: ${quest.title}]`;
          }

          return { completed: true, message: fullMessage, questId: quest.id };
        }
      }
    }

    return { completed: false };
  }

  checkServiceUsed(
    playerId: number,
    npcTemplateId: number,
    serviceType: string
  ): { completed: boolean; message?: string; questId?: number } {
    const quests = this.getActiveQuests(playerId);

    for (const quest of quests) {
      const currentStep = this.getCurrentStep(quest.id);
      if (currentStep && currentStep.stepType === 'use_service') {
        // target_id format: "npc_template_id:service_type"
        const expectedTarget = `${npcTemplateId}:${serviceType}`;

        if (currentStep.targetId === expectedTarget) {
          const message = currentStep.completionDialogue || `The service has been completed.`;
          const nextStep = this.advanceToNextStep(quest.id);

          let fullMessage = message;
          if (!nextStep) {
            fullMessage += `\n\n[Quest Completed: ${quest.title}]`;
          }

          return { completed: true, message: fullMessage, questId: quest.id };
        }
      }
    }

    return { completed: false };
  }

  // ==================== NPC Hints ====================

  getNpcHintForPlayer(playerId: number, npcTemplateId: number): string | null {
    const quests = this.getActiveQuests(playerId);

    for (const quest of quests) {
      const currentStep = this.getCurrentStep(quest.id);
      if (!currentStep) continue;

      // Check if this NPC is involved in the current step
      if (currentStep.targetId?.includes(String(npcTemplateId))) {
        return currentStep.npcHint;
      }

      // Also check if NPC is the quest giver - they might give hints
      if (quest.questGiverNpcId === npcTemplateId) {
        return currentStep.npcHint;
      }
    }

    return null;
  }

  // ==================== Status Line ====================

  getStatusLine(playerId: number): string {
    const active = this.getActiveQuests(playerId);
    if (active.length === 0) return '';
    return `\n[Quests: ${active.length}] Type 'quest' for details`;
  }

  // ==================== Quest Display ====================

  formatQuestList(playerId: number): string {
    const active = this.getActiveQuests(playerId);
    if (active.length === 0) {
      return "You have no active quests. Perhaps someone in the Shire needs your help?";
    }

    const lines: string[] = ['[Your Active Quests]', ''];

    for (let i = 0; i < active.length; i++) {
      const quest = active[i];
      const steps = this.getQuestSteps(quest.id);

      lines.push(`${i + 1}. ${quest.title}`);
      lines.push(`   ${quest.description || 'No description.'}`);
      lines.push('');

      for (const step of steps) {
        let marker: string;
        if (step.status === 'completed') {
          marker = '[✓]';
        } else if (step.status === 'current') {
          marker = '[→]';
        } else {
          marker = '[ ]';
        }

        lines.push(`   ${marker} ${step.description}`);

        // Show hint for current step
        if (step.status === 'current') {
          lines.push(`       "${step.npcHint}"`);
        }
      }

      lines.push('');
    }

    lines.push("Type 'quest <number>' to view quest details in the Quest Journal");
    lines.push(this.getStatusLine(playerId).trim());

    return lines.join('\n');
  }

  formatQuestDetail(playerId: number, questNumber: number): string {
    const active = this.getActiveQuests(playerId);
    if (questNumber < 1 || questNumber > active.length) {
      return `No quest #${questNumber} found. You have ${active.length} active quest(s).`;
    }

    const quest = active[questNumber - 1];
    const steps = this.getQuestSteps(quest.id);
    const npcTemplate = npcManager.getNpcTemplate(quest.questGiverNpcId);
    const giverName = npcTemplate?.name || 'Unknown';

    const width = 58;
    const lines: string[] = [];

    // Book-style border
    lines.push('╔' + '═'.repeat(width) + '╗');
    lines.push('║' + ' '.repeat(width) + '║');

    // Title
    const title = `~ ${quest.title} ~`;
    lines.push('║' + this.centerText(title, width) + '║');
    lines.push('║' + ' '.repeat(width) + '║');
    lines.push('║' + '─'.repeat(width) + '║');
    lines.push('║' + ' '.repeat(width) + '║');

    // Description section
    lines.push('║' + this.padRight('  THE QUEST', width) + '║');
    lines.push('║' + ' '.repeat(width) + '║');

    const descLines = this.wrapText(quest.description || 'No description provided.', width - 4);
    for (const line of descLines) {
      lines.push('║' + this.padRight('  ' + line, width) + '║');
    }

    lines.push('║' + ' '.repeat(width) + '║');
    lines.push('║' + '─'.repeat(width) + '║');
    lines.push('║' + ' '.repeat(width) + '║');

    // Objectives section
    lines.push('║' + this.padRight('  OBJECTIVES', width) + '║');
    lines.push('║' + ' '.repeat(width) + '║');

    for (const step of steps) {
      let marker: string;
      let statusWord: string;

      if (step.status === 'completed') {
        marker = '  ✓';
        statusWord = '(Complete)';
      } else if (step.status === 'current') {
        marker = '  →';
        statusWord = '(Current)';
      } else {
        marker = '  ○';
        statusWord = '(Pending)';
      }

      const stepText = `${marker} ${step.description}`;
      const stepLines = this.wrapText(stepText, width - 4);

      for (let i = 0; i < stepLines.length; i++) {
        if (i === 0) {
          lines.push('║' + this.padRight('  ' + stepLines[i], width) + '║');
        } else {
          lines.push('║' + this.padRight('      ' + stepLines[i], width) + '║');
        }
      }

      lines.push('║' + this.padRight(`      ${statusWord}`, width) + '║');
      lines.push('║' + ' '.repeat(width) + '║');
    }

    lines.push('║' + '─'.repeat(width) + '║');
    lines.push('║' + ' '.repeat(width) + '║');

    // Current guidance section
    const currentStep = steps.find(s => s.status === 'current');
    if (currentStep) {
      lines.push('║' + this.padRight('  CURRENT GUIDANCE', width) + '║');
      lines.push('║' + ' '.repeat(width) + '║');

      const hintLines = this.wrapText(`"${currentStep.npcHint}"`, width - 6);
      for (const line of hintLines) {
        lines.push('║' + this.padRight('    ' + line, width) + '║');
      }

      lines.push('║' + ' '.repeat(width) + '║');
    }

    // Quest info section
    lines.push('║' + '─'.repeat(width) + '║');
    lines.push('║' + this.padRight(`  Given by: ${giverName}`, width) + '║');

    // Progress
    const completed = steps.filter(s => s.status === 'completed').length;
    const total = steps.length;
    lines.push('║' + this.padRight(`  Progress: ${completed}/${total} steps`, width) + '║');

    lines.push('║' + ' '.repeat(width) + '║');
    lines.push('╚' + '═'.repeat(width) + '╝');

    return lines.join('\n');
  }

  private centerText(text: string, width: number): string {
    const padding = Math.max(0, width - text.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  }

  private padRight(text: string, width: number): string {
    if (text.length >= width) return text.substring(0, width);
    return text + ' '.repeat(width - text.length);
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= maxWidth) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [''];
  }
}

export const questManager = new QuestManager();
export default questManager;
