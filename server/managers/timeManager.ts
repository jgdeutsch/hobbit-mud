import { getDb } from '../database';
import { GameTime } from '../../shared/types';
import { npcManager } from './npcManager';
import { connectionManager } from './connectionManager';

const MONTHS = [
  'Afteryule',
  'Solmath',
  'Rethe',
  'Astron',
  'Thrimidge',
  'Forelithe',
  'Afterlithe',
  'Wedmath',
  'Halimath',
  'Winterfilth',
  'Blotmath',
  'Foreyule',
];

const TIME_PERIODS = [
  { start: 0, end: 5, name: 'late night' },
  { start: 6, end: 8, name: 'early morning' },
  { start: 9, end: 11, name: 'morning' },
  { start: 12, end: 13, name: 'midday' },
  { start: 14, end: 17, name: 'afternoon' },
  { start: 18, end: 20, name: 'evening' },
  { start: 21, end: 23, name: 'night' },
];

class TimeManager {
  private tickInterval: NodeJS.Timeout | null = null;
  private lastDwarfSpawnHour: number = 0;

  // Get current game time
  getTime(): GameTime {
    const db = getDb();
    const row = db.prepare('SELECT hour, day, month, year FROM game_time WHERE id = 1').get() as any;

    return {
      hour: row.hour,
      day: row.day,
      month: row.month,
      year: row.year,
    };
  }

  // Advance time by one hour
  advanceHour(): GameTime {
    const db = getDb();
    const current = this.getTime();

    let hour = current.hour + 1;
    let day = current.day;
    let month = current.month;
    let year = current.year;

    if (hour >= 24) {
      hour = 0;
      day++;
    }

    if (day > 30) {
      day = 1;
      month++;
    }

    if (month > 12) {
      month = 1;
      year++;
    }

    db.prepare('UPDATE game_time SET hour = ?, day = ?, month = ?, year = ? WHERE id = 1').run(
      hour,
      day,
      month,
      year
    );

    return { hour, day, month, year };
  }

  // Get time period name
  getTimePeriod(hour: number): string {
    for (const period of TIME_PERIODS) {
      if (hour >= period.start && hour <= period.end) {
        return period.name;
      }
    }
    return 'unknown';
  }

  // Get formatted time string
  getTimeString(): string {
    const time = this.getTime();
    const period = this.getTimePeriod(time.hour);
    const monthName = MONTHS[time.month - 1] || 'Unknown';

    return `${period}, Day ${time.day} of ${monthName}, T.A. ${time.year}`;
  }

  // Get hour-specific description
  getTimeDescription(): string {
    const time = this.getTime();
    const hour = time.hour;

    if (hour >= 0 && hour < 6) {
      return 'The Shire sleeps under a blanket of stars. Only the owls are awake.';
    } else if (hour >= 6 && hour < 9) {
      return 'The sun rises over the Shire. Smoke begins to curl from hobbit-hole chimneys as breakfast is prepared.';
    } else if (hour >= 9 && hour < 11) {
      return 'Mid-morning in the Shire. Hobbits bustle about their business.';
    } else if (hour >= 11 && hour < 13) {
      return 'The sun is high. Time for elevenses and a light snack.';
    } else if (hour >= 13 && hour < 15) {
      return 'Afternoon in the Shire. A perfect time for a pipe and a sit-down.';
    } else if (hour >= 15 && hour < 18) {
      return 'Tea-time approaches. The air smells of baking.';
    } else if (hour >= 18 && hour < 21) {
      return 'Evening descends on the Shire. Lanterns are lit in windows and the Green Dragon fills with patrons.';
    } else {
      return 'Night has fallen. The stars twinkle above the peaceful Shire.';
    }
  }

  // Start the game tick (advances time periodically)
  startGameTick(intervalMinutes: number = 5): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }

    // Advance time every X real minutes
    this.tickInterval = setInterval(() => {
      this.processTick();
    }, intervalMinutes * 60 * 1000);

    console.log(`Game tick started (${intervalMinutes} min intervals)`);
  }

  // Stop the game tick
  stopGameTick(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  // Process one game tick
  processTick(): void {
    const oldTime = this.getTime();
    const newTime = this.advanceHour();

    // Check for dwarf arrivals (hours 1-6 of the first day)
    if (newTime.day === 1 && newTime.hour > this.lastDwarfSpawnHour && newTime.hour <= 6) {
      const dwarves = npcManager.spawnDwarvesForHour(newTime.hour);
      this.lastDwarfSpawnHour = newTime.hour;

      if (dwarves.length > 0) {
        // Announce dwarf arrival to players in Bag End
        const arrivalMessages = this.generateDwarfArrivalMessage(dwarves);
        for (const message of arrivalMessages) {
          connectionManager.sendToRoom('bag_end_hall', { type: 'output', content: message });
          connectionManager.sendToRoom('bag_end_garden', { type: 'output', content: message });
        }
      }
    }

    // Announce time change to all players
    if (newTime.hour === 0) {
      connectionManager.broadcast({
        type: 'system',
        content: `\n[A new day dawns in the Shire.]\n`,
      });
    } else if (newTime.hour === 6) {
      connectionManager.broadcast({
        type: 'system',
        content: `\n[The sun rises over the Shire.]\n`,
      });
    } else if (newTime.hour === 18) {
      connectionManager.broadcast({
        type: 'system',
        content: `\n[Evening falls across the Shire.]\n`,
      });
    }
  }

  // Generate messages for dwarf arrivals
  private generateDwarfArrivalMessage(dwarves: { name: string; shortDesc: string }[]): string[] {
    const messages: string[] = [];

    if (dwarves.length === 1) {
      const dwarf = dwarves[0];
      messages.push(`\n*** KNOCK KNOCK KNOCK ***\n`);
      messages.push(`The door bursts open and in walks ${dwarf.name}, ${dwarf.shortDesc}.`);
      messages.push(`"${dwarf.name}, at your service!" the dwarf announces with a bow.\n`);
    } else if (dwarves.length === 2) {
      messages.push(`\n*** KNOCK KNOCK KNOCK ***\n`);
      messages.push(
        `The door opens to reveal ${dwarves[0].name} and ${dwarves[1].name}, who tumble in together.`
      );
      messages.push(`"At your service!" they chorus.\n`);
    } else {
      messages.push(`\n*** KNOCK KNOCK KNOCK ***\n`);
      const names = dwarves.map(d => d.name);
      const lastName = names.pop();
      messages.push(`The door swings wide and in pile ${names.join(', ')}, and ${lastName}!`);
      messages.push(`"At your service!" they announce, filling the hallway.\n`);
    }

    return messages;
  }

  // Fast-forward time (for testing)
  fastForward(hours: number): GameTime {
    let time = this.getTime();
    for (let i = 0; i < hours; i++) {
      time = this.advanceHour();

      // Process dwarf spawns
      if (time.day === 1 && time.hour > this.lastDwarfSpawnHour && time.hour <= 6) {
        npcManager.spawnDwarvesForHour(time.hour);
        this.lastDwarfSpawnHour = time.hour;
      }
    }
    return time;
  }

  // Reset time to beginning
  resetTime(): void {
    const db = getDb();
    db.prepare('UPDATE game_time SET hour = 10, day = 1, month = 4, year = 2941 WHERE id = 1').run();
    this.lastDwarfSpawnHour = 0;
  }
}

export const timeManager = new TimeManager();
export default timeManager;
