import { getDb } from '../database';
import { PlayerEquipment, EquipmentSlot, Player } from '../../shared/types';
import { getItemTemplate, ITEM_TEMPLATES } from '../data/items';
import { gameLog } from '../services/logger';

// Slot display names for "look self"
const SLOT_DISPLAY_NAMES: Record<EquipmentSlot, string> = {
  head: 'Head',
  neck: 'Neck',
  body: 'Body',
  torso: 'Torso',
  cloak: 'Cloak',
  hands: 'Hands',
  legs: 'Legs',
  feet: 'Feet',
  mainHand: 'Main Hand',
  offHand: 'Off Hand',
  ring: 'Ring',
};

// Display order for equipment
const SLOT_ORDER: EquipmentSlot[] = [
  'head', 'neck', 'body', 'torso', 'cloak', 'hands', 'legs', 'feet', 'mainHand', 'offHand', 'ring'
];

class EquipmentManager {
  // Get player's equipped items
  getEquipment(playerId: number): PlayerEquipment {
    const db = getDb();

    const row = db.prepare('SELECT * FROM player_equipment WHERE player_id = ?').get(playerId) as any;

    if (!row) {
      return {};
    }

    return {
      head: row.head || undefined,
      neck: row.neck || undefined,
      body: row.body || undefined,
      torso: row.torso || undefined,
      cloak: row.cloak || undefined,
      hands: row.hands || undefined,
      legs: row.legs || undefined,
      feet: row.feet || undefined,
      mainHand: row.main_hand || undefined,
      offHand: row.off_hand || undefined,
      ring: row.ring || undefined,
    };
  }

  // Equip an item
  equip(playerId: number, itemTemplateId: number): { success: boolean; message: string; unequipped?: number } {
    const item = getItemTemplate(itemTemplateId);

    if (!item) {
      return { success: false, message: "That item doesn't exist." };
    }

    if (!item.equipSlot) {
      return { success: false, message: `You can't equip ${item.shortDesc}.` };
    }

    const db = getDb();
    const slot = item.equipSlot;
    const dbSlot = slot === 'mainHand' ? 'main_hand' : slot === 'offHand' ? 'off_hand' : slot;

    // Check if something is already in that slot
    const current = this.getEquipment(playerId);
    const currentInSlot = current[slot];

    // Ensure player has equipment row
    db.prepare(`
      INSERT OR IGNORE INTO player_equipment (player_id) VALUES (?)
    `).run(playerId);

    // Update the slot
    db.prepare(`
      UPDATE player_equipment SET ${dbSlot} = ? WHERE player_id = ?
    `).run(itemTemplateId, playerId);

    gameLog.log('PLAYER', 'EQUIP', `Player #${playerId} equipped ${item.name}`, { slot });

    if (currentInSlot) {
      const oldItem = getItemTemplate(currentInSlot);
      return {
        success: true,
        message: `You remove ${oldItem?.shortDesc || 'something'} and put on ${item.shortDesc}.`,
        unequipped: currentInSlot,
      };
    }

    return { success: true, message: `You put on ${item.shortDesc}.` };
  }

  // Unequip an item from a slot
  unequip(playerId: number, slot: EquipmentSlot): { success: boolean; message: string; itemId?: number } {
    const current = this.getEquipment(playerId);
    const currentInSlot = current[slot];

    if (!currentInSlot) {
      return { success: false, message: `You don't have anything equipped there.` };
    }

    const item = getItemTemplate(currentInSlot);
    const db = getDb();
    const dbSlot = slot === 'mainHand' ? 'main_hand' : slot === 'offHand' ? 'off_hand' : slot;

    db.prepare(`
      UPDATE player_equipment SET ${dbSlot} = NULL WHERE player_id = ?
    `).run(playerId);

    gameLog.log('PLAYER', 'UNEQUIP', `Player #${playerId} unequipped ${item?.name || 'item'}`, { slot });

    return {
      success: true,
      message: `You remove ${item?.shortDesc || 'something'}.`,
      itemId: currentInSlot,
    };
  }

  // Calculate total charisma bonus from equipment
  getCharismaBonus(playerId: number): number {
    const equipment = this.getEquipment(playerId);
    let total = 0;

    for (const slot of SLOT_ORDER) {
      const itemId = equipment[slot];
      if (itemId) {
        const item = getItemTemplate(itemId);
        if (item?.charismaBonus) {
          total += item.charismaBonus;
        }
      }
    }

    return total;
  }

  // Get total armor value
  getArmorValue(playerId: number): number {
    const equipment = this.getEquipment(playerId);
    let total = 0;

    for (const slot of SLOT_ORDER) {
      const itemId = equipment[slot];
      if (itemId) {
        const item = getItemTemplate(itemId);
        if (item?.armorValue) {
          total += item.armorValue;
        }
      }
    }

    return total;
  }

  // Get equipment quality description for NPC context
  getEquipmentQualityDescription(playerId: number): string {
    const equipment = this.getEquipment(playerId);
    let poorCount = 0;
    let commonCount = 0;
    let fineCount = 0;
    let exceptionalCount = 0;
    let masterworkCount = 0;
    let totalValue = 0;
    let slotsFilled = 0;

    for (const slot of SLOT_ORDER) {
      const itemId = equipment[slot];
      if (itemId) {
        slotsFilled++;
        const item = getItemTemplate(itemId);
        if (item) {
          totalValue += item.value;
          switch (item.quality) {
            case 'poor': poorCount++; break;
            case 'common': commonCount++; break;
            case 'fine': fineCount++; break;
            case 'exceptional': exceptionalCount++; break;
            case 'masterwork': masterworkCount++; break;
          }
        }
      }
    }

    if (slotsFilled === 0) {
      return 'practically naked, wearing almost nothing';
    }

    if (masterworkCount >= 2 || exceptionalCount >= 3) {
      return 'wearing exceptionally fine, clearly expensive attire';
    }
    if (fineCount >= 3 || (fineCount >= 2 && exceptionalCount >= 1)) {
      return 'wearing fine, respectable clothing';
    }
    if (poorCount >= 3 || (poorCount >= 2 && slotsFilled <= 4)) {
      return 'wearing shabby, worn-out clothing';
    }
    if (commonCount >= 3) {
      return 'wearing ordinary, unremarkable clothing';
    }

    return 'wearing a mix of clothing';
  }

  // Format equipment for "look self" display
  formatEquipmentDisplay(playerId: number): string {
    const equipment = this.getEquipment(playerId);
    const lines: string[] = [];

    for (const slot of SLOT_ORDER) {
      const itemId = equipment[slot];
      const displayName = SLOT_DISPLAY_NAMES[slot];

      if (itemId) {
        const item = getItemTemplate(itemId);
        if (item) {
          const qualityColor = this.getQualityColor(item.quality || 'common');
          lines.push(`  ${displayName.padEnd(12)} ${qualityColor}${item.shortDesc}\x1b[0m`);
        }
      } else {
        lines.push(`  ${displayName.padEnd(12)} \x1b[2m<empty>\x1b[0m`);
      }
    }

    return lines.join('\n');
  }

  // Get ANSI color for quality
  private getQualityColor(quality: string): string {
    switch (quality) {
      case 'poor': return '\x1b[2m'; // dim
      case 'common': return '\x1b[37m'; // white
      case 'fine': return '\x1b[32m'; // green
      case 'exceptional': return '\x1b[34m'; // blue
      case 'masterwork': return '\x1b[35m'; // magenta
      default: return '\x1b[37m';
    }
  }

  // Initialize equipment row for new player
  initializePlayer(playerId: number): void {
    const db = getDb();
    db.prepare('INSERT OR IGNORE INTO player_equipment (player_id) VALUES (?)').run(playerId);
  }

  // Get visible equipment items as descriptions (for looking at another player)
  getVisibleEquipmentDescriptions(playerId: number): string[] {
    const equipment = this.getEquipment(playerId);
    const visible: string[] = [];

    // List visible slots (most equipment is visible except ring sometimes)
    const visibleSlots: EquipmentSlot[] = ['head', 'cloak', 'torso', 'body', 'hands', 'legs', 'feet', 'mainHand', 'offHand'];

    for (const slot of visibleSlots) {
      const itemId = equipment[slot];
      if (itemId) {
        const item = getItemTemplate(itemId);
        if (item) {
          visible.push(item.shortDesc);
        }
      }
    }

    return visible;
  }
}

export const equipmentManager = new EquipmentManager();
export default equipmentManager;
