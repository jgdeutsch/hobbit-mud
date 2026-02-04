import { timeManager } from './managers/timeManager';
import { npcManager } from './managers/npcManager';
import { connectionManager } from './managers/connectionManager';
import { worldManager } from './managers/worldManager';
import { npcReactionManager } from './managers/npcReactionManager';
import geminiService, { NpcFullContext } from './services/geminiService';
import { gameLog } from './services/logger';
import { NpcTemplate, Player } from '../shared/types';

// Configuration
const TICK_INTERVAL_MS = 30000; // 30 seconds between ticks
const NPC_TO_NPC_CHANCE = 0.25; // 25% chance per tick for NPC-NPC interaction
const NPC_TO_PLAYER_CHANCE = 0.20; // 20% chance per tick for NPC to initiate with player
const GAME_HOUR_INTERVAL_MS = 5 * 60 * 1000; // 5 real minutes = 1 game hour

let tickInterval: NodeJS.Timeout | null = null;
let gameHourInterval: NodeJS.Timeout | null = null;

export function startGameLoop(): void {
  // Main game tick
  tickInterval = setInterval(processTick, TICK_INTERVAL_MS);

  // Game hour advancement
  gameHourInterval = setInterval(() => {
    timeManager.processTick();
  }, GAME_HOUR_INTERVAL_MS);

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
  const onlinePlayers = connectionManager.getOnlinePlayers();
  if (onlinePlayers.length === 0) return; // No players online, skip processing

  // Get all rooms with players
  const playerRooms = new Map<string, Player[]>();
  for (const player of onlinePlayers) {
    const existing = playerRooms.get(player.currentRoom) || [];
    existing.push(player);
    playerRooms.set(player.currentRoom, existing);
  }

  // Process each room with players
  for (const [roomId, players] of playerRooms) {
    const npcs = npcManager.getNpcsInRoom(roomId);
    if (npcs.length === 0) continue;

    const room = worldManager.getRoom(roomId);
    const roomDesc = room?.name || roomId;

    // Build context for all NPCs in the room
    const npcContexts = new Map<number, NpcFullContext>();
    for (const { template } of npcs) {
      npcContexts.set(template.id, buildNpcContext(template, players));
    }

    // Decide what interactions happen this tick
    const rand = Math.random();

    if (npcs.length >= 2 && rand < NPC_TO_NPC_CHANCE) {
      // NPC-to-NPC interaction
      await processNpcToNpcInteraction(roomId, npcs, npcContexts, players, roomDesc);
    } else if (rand < NPC_TO_NPC_CHANCE + NPC_TO_PLAYER_CHANCE) {
      // NPC initiates with a player
      await processNpcToPlayerInteraction(roomId, npcs, npcContexts, players, roomDesc);
    }
  }
}

/**
 * Build full context for an NPC
 */
function buildNpcContext(npc: NpcTemplate, playersInRoom: Player[]): NpcFullContext {
  const state = npcManager.getNpcState(npc.id);
  const desire = npcManager.getCurrentDesire(npc.id);

  // Get feelings toward all players in room
  const feelingsToward: Record<string, { trust: number; affection: number }> = {};
  for (const player of playersInRoom) {
    const feeling = npcManager.getFeeling(npc.id, 'player', player.id);
    if (feeling) {
      feelingsToward[player.name] = {
        trust: feeling.trust,
        affection: feeling.affection,
      };
    }
  }

  // Get recent memories (about any player in room)
  const recentMemories: string[] = [];
  for (const player of playersInRoom) {
    const memories = npcManager.getMemories(npc.id, 'player', player.id, 2);
    for (const mem of memories) {
      recentMemories.push(`${player.name}: ${mem.memoryContent}`);
    }
  }

  return {
    mood: state?.mood || 'neutral',
    currentDesire: desire?.desireContent,
    desireReason: desire?.desireReason || undefined,
    recentMemories: recentMemories.slice(0, 4),
    feelingsToward: Object.keys(feelingsToward).length > 0 ? feelingsToward : undefined,
  };
}

/**
 * Process NPC-to-NPC interaction
 */
async function processNpcToNpcInteraction(
  roomId: string,
  npcs: { template: NpcTemplate; state: any }[],
  npcContexts: Map<number, NpcFullContext>,
  players: Player[],
  roomDesc: string
): Promise<void> {
  // Pick two random NPCs
  const shuffled = [...npcs].sort(() => Math.random() - 0.5);
  const npc1 = shuffled[0];
  const npc2 = shuffled[1];

  const npc1Context = npcContexts.get(npc1.template.id);
  const npc2Context = npcContexts.get(npc2.template.id);

  const playerNames = players.map(p => p.name);
  const otherNpcNames = npcs
    .filter(n => n.template.id !== npc1.template.id && n.template.id !== npc2.template.id)
    .map(n => n.template.name);

  // Build context string
  let context = `${npc1.template.name} and ${npc2.template.name} are both in ${roomDesc}.`;
  if (otherNpcNames.length > 0) {
    context += ` Also present: ${otherNpcNames.join(', ')}.`;
  }
  context += ` Players watching: ${playerNames.join(', ')}.`;

  gameLog.npcToNpcDialogue(npc1.template.name, npc2.template.name, roomId);

  try {
    const dialogue = await geminiService.generateNpcToNpcDialogue(
      npc1.template,
      npc2.template,
      context,
      npc1Context,
      npc2Context,
      playerNames,
      roomDesc
    );

    if (dialogue.length > 0) {
      for (const line of dialogue) {
        const speaker = line.speaker === 1 ? npc1.template : npc2.template;
        const listener = line.speaker === 1 ? npc2.template : npc1.template;

        let message = '';
        if (line.action) {
          message += `\n${speaker.name} ${line.action}\n`;
        }
        message += `${speaker.name} says to ${listener.name}: "${line.dialogue}"`;

        connectionManager.sendToRoom(roomId, {
          type: 'output',
          content: message,
        });

        gameLog.npcDialogueResponse(speaker.name, `[to ${listener.name}] ${line.dialogue}`);

        // Update listener's memory of speaker
        npcManager.addMemory(
          listener.id,
          'npc',
          speaker.id,
          `Said: "${line.dialogue.substring(0, 50)}..."`,
          4
        );

        // Small delay between lines
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
  } catch (error) {
    gameLog.error('NPC-NPC-INTERACTION', error);
  }
}

/**
 * Process NPC initiating with a player
 */
async function processNpcToPlayerInteraction(
  roomId: string,
  npcs: { template: NpcTemplate; state: any }[],
  npcContexts: Map<number, NpcFullContext>,
  players: Player[],
  roomDesc: string
): Promise<void> {
  // Pick a random NPC and player
  const npc = npcs[Math.floor(Math.random() * npcs.length)];
  const player = players[Math.floor(Math.random() * players.length)];

  const npcContext = npcContexts.get(npc.template.id);
  if (!npcContext) return;

  const otherNpcNames = npcs
    .filter(n => n.template.id !== npc.template.id)
    .map(n => n.template.name);
  const otherPlayerNames = players
    .filter(p => p.id !== player.id)
    .map(p => p.name);

  try {
    // First, check if NPC should initiate
    const decision = await geminiService.shouldNpcInitiateWithPlayer(
      npc.template,
      player,
      npcContext,
      roomDesc,
      otherNpcNames,
      otherPlayerNames
    );

    if (!decision.shouldInitiate) {
      return; // NPC decided not to speak
    }

    gameLog.log?.('NPC', 'INITIATE', `${npc.template.name} decides to speak to ${player.name}`, { reason: decision.reason });

    // Generate what the NPC says
    const response = await geminiService.generateNpcInitiatedDialogue(
      npc.template,
      player,
      npcContext,
      decision.reason || 'wants to interact',
      roomDesc,
      otherNpcNames
    );

    // Send to room
    let message = '';
    if (response.action) {
      message += `\n${npc.template.name} ${response.action}\n`;
    }
    message += `${npc.template.name} says to ${player.name}: "${response.dialogue}"`;

    connectionManager.sendToRoom(roomId, {
      type: 'output',
      content: message,
    });

    gameLog.npcDialogueResponse(npc.template.name, `[to ${player.name}] ${response.dialogue}`);

    // Record this conversation for context tracking (so player responses go to this NPC)
    npcReactionManager.recordNpcSpokeToPlayer(
      roomId,
      npc.template.id,
      npc.template.name,
      player.id,
      response.dialogue
    );

    // Record in NPC's memory
    npcManager.addMemory(
      npc.template.id,
      'player',
      player.id,
      `Initiated conversation: "${response.dialogue.substring(0, 40)}..."`,
      5
    );

    // Small affection boost for initiating friendly interaction
    npcManager.adjustFeeling(
      npc.template.id,
      'player',
      player.id,
      { affection: 1 },
      'initiated conversation'
    );

    // Update NPC state - last interaction
    npcManager.updateNpcState(npc.template.id, { lastPlayerInteraction: new Date() });

  } catch (error) {
    gameLog.error('NPC-PLAYER-INITIATE', error);
  }
}

export default { startGameLoop, stopGameLoop };
