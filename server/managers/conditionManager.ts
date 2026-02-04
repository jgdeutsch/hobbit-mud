import { getDb } from '../database';
import { Player, PlayerCondition } from '../../shared/types';
import { gameLog } from '../services/logger';

// Degradation rates per real minute
const CLEANLINESS_DECAY_PER_MINUTE = 0.5;  // Lose 0.5 cleanliness per minute (lose 30 per hour)
const FATIGUE_DECAY_PER_MINUTE = 0.3;      // Lose 0.3 fatigue per minute (lose 18 per hour)
const BLOODINESS_DECAY_PER_MINUTE = 0.2;   // Blood washes away slowly
const WOUNDS_HEAL_PER_MINUTE = 0.1;        // Wounds heal very slowly

// Thresholds for descriptions
const THRESHOLDS = {
  cleanliness: {
    pristine: 90,
    clean: 70,
    presentable: 50,
    dirty: 30,
    filthy: 10,
  },
  fatigue: {
    energetic: 90,
    rested: 70,
    normal: 50,
    tired: 30,
    exhausted: 10,
  },
  bloodiness: {
    pristine: 0,
    spotted: 10,
    bloody: 30,
    covered: 60,
    drenched: 80,
  },
  wounds: {
    healthy: 0,
    scratched: 10,
    wounded: 30,
    injured: 60,
    critical: 80,
  },
};

class ConditionManager {
  // Get player condition
  getCondition(playerId: number): PlayerCondition {
    const db = getDb();

    const row = db.prepare(`
      SELECT cleanliness, fatigue, bloodiness, wounds, last_condition_update
      FROM players WHERE id = ?
    `).get(playerId) as any;

    if (!row) {
      return { cleanliness: 100, fatigue: 100, bloodiness: 0, wounds: 0 };
    }

    // Apply time-based degradation
    const lastUpdate = row.last_condition_update ? new Date(row.last_condition_update) : new Date();
    const now = new Date();
    const minutesPassed = (now.getTime() - lastUpdate.getTime()) / 60000;

    if (minutesPassed > 1) {
      return this.applyDegradation(playerId, row, minutesPassed);
    }

    return {
      cleanliness: row.cleanliness,
      fatigue: row.fatigue,
      bloodiness: row.bloodiness,
      wounds: row.wounds,
    };
  }

  // Apply time-based degradation
  private applyDegradation(playerId: number, current: any, minutesPassed: number): PlayerCondition {
    const db = getDb();

    // Calculate new values with degradation
    let cleanliness = Math.max(0, current.cleanliness - (CLEANLINESS_DECAY_PER_MINUTE * minutesPassed));
    let fatigue = Math.max(0, current.fatigue - (FATIGUE_DECAY_PER_MINUTE * minutesPassed));
    let bloodiness = Math.max(0, current.bloodiness - (BLOODINESS_DECAY_PER_MINUTE * minutesPassed));
    let wounds = Math.max(0, current.wounds - (WOUNDS_HEAL_PER_MINUTE * minutesPassed));

    // Update database
    db.prepare(`
      UPDATE players
      SET cleanliness = ?, fatigue = ?, bloodiness = ?, wounds = ?, last_condition_update = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(cleanliness, fatigue, bloodiness, wounds, playerId);

    return {
      cleanliness: Math.round(cleanliness),
      fatigue: Math.round(fatigue),
      bloodiness: Math.round(bloodiness),
      wounds: Math.round(wounds),
    };
  }

  // Update specific condition
  updateCondition(playerId: number, updates: Partial<PlayerCondition>): void {
    const db = getDb();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.cleanliness !== undefined) {
      fields.push('cleanliness = ?');
      values.push(Math.max(0, Math.min(100, updates.cleanliness)));
    }
    if (updates.fatigue !== undefined) {
      fields.push('fatigue = ?');
      values.push(Math.max(0, Math.min(100, updates.fatigue)));
    }
    if (updates.bloodiness !== undefined) {
      fields.push('bloodiness = ?');
      values.push(Math.max(0, Math.min(100, updates.bloodiness)));
    }
    if (updates.wounds !== undefined) {
      fields.push('wounds = ?');
      values.push(Math.max(0, Math.min(100, updates.wounds)));
    }

    if (fields.length > 0) {
      fields.push('last_condition_update = CURRENT_TIMESTAMP');
      values.push(playerId);
      db.prepare(`UPDATE players SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
  }

  // Adjust condition (relative change)
  adjustCondition(playerId: number, adjustments: Partial<PlayerCondition>): void {
    const current = this.getCondition(playerId);
    const updates: Partial<PlayerCondition> = {};

    if (adjustments.cleanliness !== undefined) {
      updates.cleanliness = current.cleanliness + adjustments.cleanliness;
    }
    if (adjustments.fatigue !== undefined) {
      updates.fatigue = current.fatigue + adjustments.fatigue;
    }
    if (adjustments.bloodiness !== undefined) {
      updates.bloodiness = current.bloodiness + adjustments.bloodiness;
    }
    if (adjustments.wounds !== undefined) {
      updates.wounds = current.wounds + adjustments.wounds;
    }

    this.updateCondition(playerId, updates);
  }

  // Rest (sleep) - restores fatigue
  rest(playerId: number): string {
    const condition = this.getCondition(playerId);

    if (condition.fatigue >= 90) {
      return "You're not tired enough to sleep.";
    }

    // Full rest restores fatigue to 100
    this.updateCondition(playerId, { fatigue: 100 });
    gameLog.log('PLAYER', 'REST', `Player #${playerId} rested`);

    return "You rest and feel refreshed.";
  }

  // Wash - restores cleanliness, reduces bloodiness
  wash(playerId: number, hasWater: boolean = true): string {
    if (!hasWater) {
      return "You need to be near water to wash.";
    }

    const condition = this.getCondition(playerId);

    if (condition.cleanliness >= 95 && condition.bloodiness <= 5) {
      return "You're already clean.";
    }

    this.updateCondition(playerId, {
      cleanliness: 100,
      bloodiness: 0,
    });

    gameLog.log('PLAYER', 'WASH', `Player #${playerId} washed`);

    let message = "You wash yourself thoroughly.";
    if (condition.bloodiness > 30) {
      message += " The blood washes away into the water.";
    }

    return message;
  }

  // Get cleanliness description
  getCleanlinessDescription(value: number): string {
    if (value >= THRESHOLDS.cleanliness.pristine) return 'pristine and well-groomed';
    if (value >= THRESHOLDS.cleanliness.clean) return 'clean';
    if (value >= THRESHOLDS.cleanliness.presentable) return 'presentable';
    if (value >= THRESHOLDS.cleanliness.dirty) return 'dirty';
    if (value >= THRESHOLDS.cleanliness.filthy) return 'filthy';
    return 'absolutely disgusting';
  }

  // Get fatigue description
  getFatigueDescription(value: number): string {
    if (value >= THRESHOLDS.fatigue.energetic) return 'energetic';
    if (value >= THRESHOLDS.fatigue.rested) return 'well-rested';
    if (value >= THRESHOLDS.fatigue.normal) return 'normal';
    if (value >= THRESHOLDS.fatigue.tired) return 'tired';
    if (value >= THRESHOLDS.fatigue.exhausted) return 'exhausted';
    return 'ready to collapse';
  }

  // Get bloodiness description
  getBloodyDescription(value: number): string {
    if (value <= THRESHOLDS.bloodiness.pristine) return '';
    if (value <= THRESHOLDS.bloodiness.spotted) return 'has a few blood spots';
    if (value <= THRESHOLDS.bloodiness.bloody) return 'is bloody';
    if (value <= THRESHOLDS.bloodiness.covered) return 'is covered in blood';
    if (value <= THRESHOLDS.bloodiness.drenched) return 'is drenched in blood';
    return 'is absolutely soaked in blood';
  }

  // Get wounds description
  getWoundsDescription(value: number): string {
    if (value <= THRESHOLDS.wounds.healthy) return '';
    if (value <= THRESHOLDS.wounds.scratched) return 'has minor scratches';
    if (value <= THRESHOLDS.wounds.wounded) return 'appears wounded';
    if (value <= THRESHOLDS.wounds.injured) return 'is seriously injured';
    if (value <= THRESHOLDS.wounds.critical) return 'is critically wounded';
    return 'looks near death';
  }

  // Format full condition display for "look self"
  formatConditionDisplay(playerId: number): string {
    const condition = this.getCondition(playerId);
    const lines: string[] = [];

    // Cleanliness with color coding
    const cleanColor = condition.cleanliness >= 70 ? '\x1b[32m' : condition.cleanliness >= 40 ? '\x1b[33m' : '\x1b[31m';
    lines.push(`  Cleanliness:  ${cleanColor}${this.getCleanlinessDescription(condition.cleanliness)}\x1b[0m (${condition.cleanliness}%)`);

    // Fatigue with color coding
    const fatigueColor = condition.fatigue >= 70 ? '\x1b[32m' : condition.fatigue >= 40 ? '\x1b[33m' : '\x1b[31m';
    lines.push(`  Fatigue:      ${fatigueColor}${this.getFatigueDescription(condition.fatigue)}\x1b[0m (${condition.fatigue}%)`);

    // Blood (only show if bloody)
    if (condition.bloodiness > 0) {
      const bloodColor = condition.bloodiness >= 60 ? '\x1b[31m' : '\x1b[33m';
      lines.push(`  Blood:        ${bloodColor}${this.getBloodyDescription(condition.bloodiness)}\x1b[0m (${condition.bloodiness}%)`);
    }

    // Wounds (only show if wounded)
    if (condition.wounds > 0) {
      const woundColor = condition.wounds >= 60 ? '\x1b[31m' : '\x1b[33m';
      lines.push(`  Wounds:       ${woundColor}${this.getWoundsDescription(condition.wounds)}\x1b[0m (${condition.wounds}%)`);
    }

    return lines.join('\n');
  }

  // Get compact description for NPCs to see
  getVisibleConditionDescription(playerId: number): string {
    const condition = this.getCondition(playerId);
    const descriptions: string[] = [];

    // Only include notable conditions
    if (condition.cleanliness < 50) {
      descriptions.push(condition.cleanliness < 30 ? 'filthy' : 'dirty');
    }
    if (condition.bloodiness > 10) {
      descriptions.push(this.getBloodyDescription(condition.bloodiness));
    }
    if (condition.wounds > 10) {
      descriptions.push(this.getWoundsDescription(condition.wounds));
    }
    if (condition.fatigue < 30) {
      descriptions.push('exhausted-looking');
    }

    return descriptions.join(', ');
  }

  // Get NPC reaction context based on player condition
  getNpcReactionContext(playerId: number): {
    fear: number;       // 0-100, how scared they might be
    concern: number;    // 0-100, how worried they might be
    disgust: number;    // 0-100, how repulsed they might be
    respect: number;    // -50 to 50, affects treatment
    description: string;
  } {
    const condition = this.getCondition(playerId);

    let fear = 0;
    let concern = 0;
    let disgust = 0;
    let respect = 0;

    // Blood makes NPCs afraid or concerned
    if (condition.bloodiness > 60) {
      fear += 30;
      concern += 20;
    } else if (condition.bloodiness > 30) {
      fear += 15;
      concern += 30;
    } else if (condition.bloodiness > 10) {
      concern += 15;
    }

    // Wounds make NPCs concerned
    if (condition.wounds > 60) {
      concern += 40;
      fear += 10;
    } else if (condition.wounds > 30) {
      concern += 25;
    } else if (condition.wounds > 10) {
      concern += 10;
    }

    // Dirtiness causes disgust and disrespect
    if (condition.cleanliness < 20) {
      disgust += 40;
      respect -= 20;
    } else if (condition.cleanliness < 40) {
      disgust += 20;
      respect -= 10;
    } else if (condition.cleanliness < 60) {
      disgust += 5;
      respect -= 5;
    }

    // Exhaustion shows weakness
    if (condition.fatigue < 20) {
      concern += 15;
      respect -= 5;
    }

    // Build description
    const parts: string[] = [];
    if (fear > 20) parts.push('might be dangerous');
    if (concern > 30) parts.push('needs help');
    if (disgust > 20) parts.push('is unpleasant to be around');
    if (respect < -10) parts.push('appears low-status');

    return {
      fear: Math.min(100, fear),
      concern: Math.min(100, concern),
      disgust: Math.min(100, disgust),
      respect: Math.max(-50, Math.min(50, respect)),
      description: parts.length > 0 ? parts.join(', ') : 'appears normal',
    };
  }

  // Apply damage (increases wounds and potentially bloodiness)
  applyDamage(playerId: number, amount: number): void {
    this.adjustCondition(playerId, {
      wounds: amount,
      bloodiness: Math.floor(amount * 0.5),
    });
    gameLog.log('PLAYER', 'DAMAGE', `Player #${playerId} took ${amount} damage`);
  }

  // Actions that affect conditions
  onPlayerAction(playerId: number, action: string): void {
    switch (action) {
      case 'move':
        // Moving reduces fatigue slightly
        this.adjustCondition(playerId, { fatigue: -1 });
        break;
      case 'combat':
        // Combat is tiring
        this.adjustCondition(playerId, { fatigue: -5 });
        break;
      case 'eat':
        // Eating restores some fatigue
        this.adjustCondition(playerId, { fatigue: 5 });
        break;
    }
  }
}

export const conditionManager = new ConditionManager();
export default conditionManager;
