import { CommandContext } from '../../shared/types';
import { connectionManager } from '../managers/connectionManager';
import { npcManager } from '../managers/npcManager';
import { npcReactionManager, WitnessedEvent } from '../managers/npcReactionManager';
import { WebSocket } from 'ws';

// Handle say command
export async function handleSay(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const message = ctx.args.join(' ');

  if (!message) {
    return `Say what?`;
  }

  // Check if message is directed at someone (e.g., "say bilbo hello" or "say to bilbo hello")
  const { target, actualMessage } = parseTargetedMessage(ctx.args, ctx);

  // Notify others in room
  connectionManager.sendToRoom(
    ctx.player.currentRoom,
    {
      type: 'output',
      content: `\n${ctx.player.name} says: "${actualMessage}"\n`,
    },
    ctx.player.id
  );

  // Create witnessed event for NPCs
  const event: WitnessedEvent = {
    type: 'say',
    actor: { type: 'player', name: ctx.player.name, id: ctx.player.id },
    target: target,
    content: actualMessage,
    roomId: ctx.player.currentRoom,
  };

  // Process NPC reactions (async, don't wait)
  npcReactionManager.processWitnessedEvent(event).catch(err => {
    console.error('Error processing NPC reactions:', err);
  });

  return `You say: "${actualMessage}"`;
}

// Handle shout command (heard in adjacent rooms)
export async function handleShout(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const message = ctx.args.join(' ');

  if (!message) {
    return `Shout what?`;
  }

  // Notify current room
  connectionManager.sendToRoom(
    ctx.player.currentRoom,
    {
      type: 'output',
      content: `\n${ctx.player.name} SHOUTS: "${message}"\n`,
    },
    ctx.player.id
  );

  // Notify adjacent rooms
  const { worldManager } = require('../managers/worldManager');
  const room = worldManager.getRoom(ctx.player.currentRoom);

  if (room) {
    for (const [direction, adjacentRoomId] of Object.entries(room.exits)) {
      connectionManager.sendToRoom(adjacentRoomId as string, {
        type: 'output',
        content: `\nYou hear someone shout from the ${getOppositeDirection(direction)}: "${message}"\n`,
      });

      // NPCs in adjacent rooms hear it too
      const npcs = npcManager.getNpcsInRoom(adjacentRoomId as string);
      for (const { template } of npcs) {
        npcManager.addMemory(
          template.id,
          'player',
          ctx.player.id,
          `Heard shouting: "${message}"`,
          3
        );
      }
    }
  }

  // Record for NPCs in current room
  const npcsHere = npcManager.getNpcsInRoom(ctx.player.currentRoom);
  for (const { template } of npcsHere) {
    npcManager.addMemory(template.id, 'player', ctx.player.id, `Shouted: "${message}"`, 5);
  }

  return `You SHOUT: "${message}"`;
}

// Handle gossip command (global channel)
export async function handleGossip(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const message = ctx.args.join(' ');

  if (!message) {
    return `Gossip what?`;
  }

  // Notify all players
  connectionManager.broadcast(
    {
      type: 'output',
      content: `\n[Gossip] ${ctx.player.name}: "${message}"\n`,
    },
    ctx.player.id
  );

  return `[Gossip] You: "${message}"`;
}

// Handle whisper command (private message)
export async function handleWhisper(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const targetName = ctx.args[0];
  const message = ctx.args.slice(1).join(' ');

  if (!targetName) {
    return `Whisper to whom? Usage: whisper <name> <message>`;
  }

  if (!message) {
    return `Whisper what? Usage: whisper <name> <message>`;
  }

  // Find target player
  const { playerManager } = require('../managers/playerManager');
  const targetPlayer = playerManager.getPlayerByName(targetName);

  if (!targetPlayer) {
    return `No one named '${targetName}' is online.`;
  }

  if (targetPlayer.id === ctx.player.id) {
    return `Talking to yourself is the first sign of madness.`;
  }

  // Check if they're online
  const targetWs = connectionManager.getPlayerConnection(targetPlayer.id);
  if (!targetWs) {
    return `${targetPlayer.name} is not online.`;
  }

  // Send to target
  connectionManager.sendToPlayer(targetPlayer.id, {
    type: 'output',
    content: `\n${ctx.player.name} whispers to you: "${message}"\n`,
  });

  return `You whisper to ${targetPlayer.name}: "${message}"`;
}

// Handle emote command
export async function handleEmote(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const action = ctx.args.join(' ');

  if (!action) {
    return `Emote what? Usage: emote <action>`;
  }

  // Check if emote mentions someone
  const target = findTargetInMessage(action, ctx);

  // Notify room
  connectionManager.sendToRoom(
    ctx.player.currentRoom,
    {
      type: 'output',
      content: `\n${ctx.player.name} ${action}\n`,
    },
    ctx.player.id
  );

  // Create witnessed event for NPCs
  const event: WitnessedEvent = {
    type: 'emote',
    actor: { type: 'player', name: ctx.player.name, id: ctx.player.id },
    target: target,
    content: action,
    roomId: ctx.player.currentRoom,
  };

  // Process NPC reactions (async, don't wait)
  npcReactionManager.processWitnessedEvent(event).catch(err => {
    console.error('Error processing NPC reactions:', err);
  });

  return `${ctx.player.name} ${action}`;
}

// Handle who command (list online players)
export async function handleWho(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const players = connectionManager.getOnlinePlayers();

  if (players.length === 0) {
    return `No one else is online.`;
  }

  const lines = [`[Online Players (${players.length})]`, ''];

  for (const player of players) {
    const { worldManager } = require('../managers/worldManager');
    const room = worldManager.getRoom(player.currentRoom);
    const roomName = room?.name || 'Unknown';

    if (player.id === ctx.player.id) {
      lines.push(`  ${player.name} (you) - ${roomName}`);
    } else {
      lines.push(`  ${player.name} - ${roomName}`);
    }
  }

  return lines.join('\n');
}

// Helper function
function getOppositeDirection(dir: string): string {
  const opposites: Record<string, string> = {
    north: 'south',
    south: 'north',
    east: 'west',
    west: 'east',
    up: 'below',
    down: 'above',
  };
  return opposites[dir] || 'somewhere';
}

// Parse a targeted message (e.g., "say bilbo hello" or "say to bilbo hello")
function parseTargetedMessage(args: string[], ctx: CommandContext): {
  target?: { type: 'player' | 'npc'; name: string; id: number };
  actualMessage: string;
} {
  if (args.length < 2) {
    return { actualMessage: args.join(' ') };
  }

  let potentialTarget = args[0];
  let messageStart = 1;

  // Handle "say to bilbo hello"
  if (potentialTarget.toLowerCase() === 'to' && args.length > 2) {
    potentialTarget = args[1];
    messageStart = 2;
  }

  // Check if first word is an NPC name
  const npcs = npcManager.getNpcsInRoom(ctx.player.currentRoom);
  for (const { template } of npcs) {
    if (
      template.keywords.some(k => k.toLowerCase() === potentialTarget.toLowerCase()) ||
      template.name.toLowerCase().includes(potentialTarget.toLowerCase())
    ) {
      return {
        target: { type: 'npc', name: template.name, id: template.id },
        actualMessage: args.slice(messageStart).join(' ') || args.join(' '),
      };
    }
  }

  // Check if first word is a player name
  const players = connectionManager.getPlayersInRoom(ctx.player.currentRoom);
  for (const player of players) {
    if (player.name.toLowerCase() === potentialTarget.toLowerCase() && player.id !== ctx.player.id) {
      return {
        target: { type: 'player', name: player.name, id: player.id },
        actualMessage: args.slice(messageStart).join(' ') || args.join(' '),
      };
    }
  }

  // No target found, return full message
  return { actualMessage: args.join(' ') };
}

// Find if an emote/action mentions someone in the room
function findTargetInMessage(message: string, ctx: CommandContext): { type: 'player' | 'npc'; name: string; id: number } | undefined {
  const msgLower = message.toLowerCase();

  // Check NPCs
  const npcs = npcManager.getNpcsInRoom(ctx.player.currentRoom);
  for (const { template } of npcs) {
    if (
      template.keywords.some(k => msgLower.includes(k.toLowerCase())) ||
      msgLower.includes(template.name.toLowerCase())
    ) {
      return { type: 'npc', name: template.name, id: template.id };
    }
  }

  // Check players
  const players = connectionManager.getPlayersInRoom(ctx.player.currentRoom);
  for (const player of players) {
    if (player.id !== ctx.player.id && msgLower.includes(player.name.toLowerCase())) {
      return { type: 'player', name: player.name, id: player.id };
    }
  }

  return undefined;
}
