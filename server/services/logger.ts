import * as fs from 'fs';
import * as path from 'path';

// ANSI colors for console output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

type LogLevel = 'INFO' | 'PLAYER' | 'NPC' | 'DIALOGUE' | 'DESIRE' | 'SOCIAL' | 'SYSTEM' | 'ERROR';

const LEVEL_COLORS: Record<LogLevel, string> = {
  INFO: COLORS.white,
  PLAYER: COLORS.green,
  NPC: COLORS.cyan,
  DIALOGUE: COLORS.magenta,
  DESIRE: COLORS.yellow,
  SOCIAL: COLORS.blue,
  SYSTEM: COLORS.dim,
  ERROR: COLORS.red,
};

class GameLogger {
  private logToFile: boolean = false;
  private logFilePath: string;

  constructor() {
    const logDir = path.join(__dirname, '..', '..', 'data');
    this.logFilePath = path.join(logDir, 'game.log');
  }

  private formatTime(): string {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
  }

  // Public log method for generic logging
  public log(level: LogLevel, category: string, message: string, details?: Record<string, any>): void {
    this._log(level, category, message, details);
  }

  private _log(level: LogLevel, category: string, message: string, details?: Record<string, any>): void {
    const time = this.formatTime();
    const color = LEVEL_COLORS[level];

    // Console output with colors
    let consoleMsg = `${COLORS.dim}[${time}]${COLORS.reset} ${color}[${level}]${COLORS.reset} ${COLORS.bright}${category}:${COLORS.reset} ${message}`;
    if (details) {
      consoleMsg += ` ${COLORS.dim}${JSON.stringify(details)}${COLORS.reset}`;
    }
    console.log(consoleMsg);

    // File output (plain text)
    if (this.logToFile) {
      let fileMsg = `[${time}] [${level}] ${category}: ${message}`;
      if (details) {
        fileMsg += ` ${JSON.stringify(details)}`;
      }
      fs.appendFileSync(this.logFilePath, fileMsg + '\n');
    }
  }

  // Player actions
  playerConnect(playerName: string, room: string): void {
    this._log('PLAYER', 'CONNECT', `${playerName} entered the game`, { room });
  }

  playerDisconnect(playerName: string): void {
    this._log('PLAYER', 'DISCONNECT', `${playerName} left the game`);
  }

  playerCommand(playerName: string, command: string, room: string): void {
    this._log('PLAYER', 'COMMAND', `${playerName}: "${command}"`, { room });
  }

  playerMove(playerName: string, from: string, to: string, direction: string): void {
    this._log('PLAYER', 'MOVE', `${playerName} went ${direction}`, { from, to });
  }

  playerTake(playerName: string, item: string, room: string): void {
    this._log('PLAYER', 'TAKE', `${playerName} picked up ${item}`, { room });
  }

  playerDrop(playerName: string, item: string, room: string): void {
    this._log('PLAYER', 'DROP', `${playerName} dropped ${item}`, { room });
  }

  playerGive(playerName: string, item: string, target: string): void {
    this._log('PLAYER', 'GIVE', `${playerName} gave ${item} to ${target}`);
  }

  playerSay(playerName: string, message: string, room: string): void {
    this._log('PLAYER', 'SAY', `${playerName} says: "${message}"`, { room });
  }

  playerShout(playerName: string, message: string): void {
    this._log('PLAYER', 'SHOUT', `${playerName} shouts: "${message}"`);
  }

  // NPC actions
  npcDialogue(npcName: string, playerName: string, playerSaid: string, npcResponse: string): void {
    this._log('DIALOGUE', 'TALK', `${playerName} -> ${npcName}: "${playerSaid}"`, { response: npcResponse.substring(0, 100) });
  }

  npcDialogueResponse(npcName: string, response: string): void {
    this._log('DIALOGUE', 'RESPONSE', `${npcName} says: "${response.substring(0, 150)}${response.length > 150 ? '...' : ''}"`);
  }

  npcToNpcDialogue(npc1: string, npc2: string, room: string): void {
    this._log('NPC', 'NPC-CHAT', `${npc1} and ${npc2} are chatting`, { room });
  }

  npcMove(npcName: string, from: string, to: string): void {
    this._log('NPC', 'MOVE', `${npcName} moved`, { from, to });
  }

  // Desire system
  desireCreated(npcName: string, desireType: string, content: string, priority: number): void {
    this._log('DESIRE', 'NEW', `${npcName} now wants: ${content}`, { type: desireType, priority });
  }

  desireFulfilled(npcName: string, content: string, byPlayer: string): void {
    this._log('DESIRE', 'FULFILLED', `${npcName}'s desire fulfilled by ${byPlayer}: ${content}`);
  }

  desireItemSpawned(npcName: string, item: string, room: string): void {
    this._log('DESIRE', 'SPAWN', `Item spawned for ${npcName}: ${item}`, { room });
  }

  // Feelings & Memory
  feelingUpdated(npcName: string, target: string, trust: number, affection: number, reason: string): void {
    this._log('NPC', 'FEELING', `${npcName}'s feelings toward ${target} changed: ${reason}`, { trust, affection });
  }

  memoryAdded(npcName: string, about: string, memory: string): void {
    this._log('NPC', 'MEMORY', `${npcName} remembers about ${about}: "${memory}"`);
  }

  // Social system
  socialUsed(playerName: string, social: string, target?: string): void {
    this._log('SOCIAL', 'USE', `${playerName} used "${social}"${target ? ` on ${target}` : ''}`);
  }

  socialCreated(social: string, byPlayer: string): void {
    this._log('SOCIAL', 'CREATE', `New social "${social}" created`, { byPlayer });
  }

  // Follow system
  followStarted(follower: string, leader: string): void {
    this._log('PLAYER', 'FOLLOW', `${follower} is now following ${leader}`);
  }

  followEnded(follower: string, leader: string): void {
    this._log('PLAYER', 'UNFOLLOW', `${follower} stopped following ${leader}`);
  }

  // System events
  dwarfArrival(dwarves: string[]): void {
    this._log('SYSTEM', 'DWARF-ARRIVAL', `Dwarves arrived: ${dwarves.join(', ')}`);
  }

  timeAdvanced(hour: number, day: number): void {
    this._log('SYSTEM', 'TIME', `Time advanced to hour ${hour}, day ${day}`);
  }

  gameStarted(port: number): void {
    this._log('SYSTEM', 'START', `Hobbit MUD started on port ${port}`);
  }

  error(context: string, error: any): void {
    this._log('ERROR', context, error?.message || String(error));
  }
}

export const gameLog = new GameLogger();
export default gameLog;
