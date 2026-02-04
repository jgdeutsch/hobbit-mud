import { CommandContext } from '../../shared/types';
import { connectionManager } from '../managers/connectionManager';
import { npcManager } from '../managers/npcManager';
import { WebSocket } from 'ws';

// Handle say command
export async function handleSay(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const message = ctx.args.join(' ');

  if (!message) {
    return `Say what?`;
  }

  // Notify others in room
  connectionManager.sendToRoom(
    ctx.player.currentRoom,
    {
      type: 'output',
      content: `\n${ctx.player.name} says: "${message}"\n`,
    },
    ctx.player.id
  );

  // NPCs in the room might react (simple version - just updates their context)
  const npcs = npcManager.getNpcsInRoom(ctx.player.currentRoom);
  for (const { template } of npcs) {
    // Record that the NPC heard this
    npcManager.addMemory(template.id, 'player', ctx.player.id, `Said: "${message}"`, 4);
  }

  return `You say: "${message}"`;
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

  // Notify room
  connectionManager.sendToRoom(
    ctx.player.currentRoom,
    {
      type: 'output',
      content: `\n${ctx.player.name} ${action}\n`,
    },
    ctx.player.id
  );

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
