import { timeManager } from './managers/timeManager';
import { npcManager } from './managers/npcManager';
import { connectionManager } from './managers/connectionManager';
import geminiService from './services/geminiService';

const NPC_INTERACTION_CHANCE = 0.1; // 10% chance per tick
const TICK_INTERVAL_MS = 60000; // 1 minute real time = game tick

let tickInterval: NodeJS.Timeout | null = null;
let gameHourInterval: NodeJS.Timeout | null = null;

export function startGameLoop(): void {
  // Main game tick (every minute)
  tickInterval = setInterval(processTick, TICK_INTERVAL_MS);

  // Game hour advancement (every 5 minutes = 1 game hour)
  gameHourInterval = setInterval(() => {
    timeManager.processTick();
  }, 5 * 60 * 1000);

  console.log('Game loop started');
}

export function stopGameLoop(): void {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  if (gameHourInterval) {
    clearInterval(gameHourInterval);
    gameHourInterval = null;
  }
}

async function processTick(): Promise<void> {
  // Process NPC-to-NPC interactions
  await processNpcInteractions();
}

async function processNpcInteractions(): Promise<void> {
  // Get all rooms with players
  const playersRooms = new Set<string>();
  for (const player of connectionManager.getOnlinePlayers()) {
    playersRooms.add(player.currentRoom);
  }

  // For each room with players, check for NPC interactions
  for (const roomId of playersRooms) {
    const npcs = npcManager.getNpcsInRoom(roomId);

    // Need at least 2 NPCs for interaction
    if (npcs.length < 2) continue;

    // Random chance for interaction
    if (Math.random() > NPC_INTERACTION_CHANCE) continue;

    // Pick two random NPCs
    const shuffled = npcs.sort(() => Math.random() - 0.5);
    const npc1 = shuffled[0];
    const npc2 = shuffled[1];

    // Generate interaction
    try {
      const context = `They are in ${roomId}. A player is present and watching.`;
      const dialogue = await geminiService.generateNpcToNpcDialogue(
        npc1.template,
        npc2.template,
        context
      );

      if (dialogue.length > 0) {
        // Send to room
        for (const line of dialogue) {
          const speaker = line.speaker === 1 ? npc1.template : npc2.template;
          connectionManager.sendToRoom(roomId, {
            type: 'output',
            content: `\n${speaker.name} says: "${line.dialogue}"\n`,
          });

          // Small delay between lines
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('NPC interaction error:', error);
    }
  }
}

export default { startGameLoop, stopGameLoop };
