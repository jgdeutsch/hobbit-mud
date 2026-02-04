import { CommandContext, DIRECTIONS, OPPOSITE_DIRECTIONS } from '../../shared/types';
import { worldManager } from '../managers/worldManager';
import { playerManager } from '../managers/playerManager';
import { npcManager } from '../managers/npcManager';
import { followManager } from '../managers/followManager';
import { connectionManager } from '../managers/connectionManager';
import { WebSocket } from 'ws';

// Handle movement commands
export async function handleMovement(
  ws: WebSocket,
  ctx: CommandContext,
  direction: string
): Promise<string> {
  const fullDirection = DIRECTIONS[direction.toLowerCase()];
  if (!fullDirection) {
    return `That's not a valid direction.`;
  }

  const room = ctx.room;
  const newRoomId = room.exits[fullDirection];

  if (!newRoomId) {
    return `You can't go ${fullDirection} from here.`;
  }

  const newRoom = worldManager.getRoom(newRoomId);
  if (!newRoom) {
    return `Something is wrong with that exit.`;
  }

  // Notify others in old room
  connectionManager.sendToRoom(
    ctx.player.currentRoom,
    { type: 'output', content: `\n${ctx.player.name} leaves ${fullDirection}.\n` },
    ctx.player.id
  );

  // Update player location
  playerManager.updateRoom(ctx.player.id, newRoomId);
  ctx.player.currentRoom = newRoomId;

  // Update connection's player state
  connectionManager.updatePlayer(ctx.player.id, { currentRoom: newRoomId });

  // Move followers
  const followerMessages = await followManager.moveFollowers(
    ctx.player.id,
    'player',
    newRoomId,
    fullDirection,
    ctx.player.name
  );

  // Notify others in new room
  const oppositeDir = OPPOSITE_DIRECTIONS[fullDirection] || 'somewhere';
  connectionManager.sendToRoom(
    newRoomId,
    { type: 'output', content: `\n${ctx.player.name} arrives from the ${oppositeDir}.\n` },
    ctx.player.id
  );

  // Build output with room description
  let output = generateRoomOutput(newRoom, ctx.player.id);

  // Add follower movement messages
  if (followerMessages.length > 0) {
    output += '\n' + followerMessages.join('\n');
  }

  return output;
}

// Generate room description output
function generateRoomOutput(room: ReturnType<typeof worldManager.getRoom>, playerId: number): string {
  if (!room) return 'You are nowhere.';

  const lines: string[] = [];

  // Room name
  lines.push(`\n[${room.name}]`);

  // Room description
  lines.push(room.description);

  // Exits
  const exits = Object.keys(room.exits);
  if (exits.length > 0) {
    lines.push(`\nExits: ${exits.join(', ')}`);
  }

  // Items in room
  const items = worldManager.getRoomItems(room.id);
  if (items.length > 0) {
    lines.push('');
    for (const { item, quantity } of items) {
      if (quantity > 1) {
        lines.push(`  ${item.shortDesc} (${quantity})`);
      } else {
        lines.push(`  ${item.shortDesc.charAt(0).toUpperCase() + item.shortDesc.slice(1)} is here.`);
      }
    }
  }

  // NPCs in room
  const npcs = npcManager.getNpcsInRoom(room.id);
  if (npcs.length > 0) {
    lines.push('');
    for (const { template } of npcs) {
      lines.push(`  ${template.name} is here.`);
    }
  }

  // Other players in room
  const players = connectionManager.getPlayersInRoom(room.id);
  const otherPlayers = players.filter(p => p.id !== playerId);
  if (otherPlayers.length > 0) {
    lines.push('');
    for (const player of otherPlayers) {
      lines.push(`  ${player.name} is here.`);
    }
  }

  return lines.join('\n');
}

// Handle follow command
export async function handleFollow(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const targetName = ctx.args[0];

  if (!targetName) {
    return `Follow whom? Usage: follow <name>`;
  }

  // Check for NPC
  const npc = npcManager.findNpcByKeyword(targetName);
  if (npc) {
    const npcState = npcManager.getNpcState(npc.id);
    if (!npcState || npcState.currentRoom !== ctx.player.currentRoom) {
      return `${npc.name} isn't here.`;
    }

    followManager.follow(ctx.player.id, 'player', npc.id, 'npc');
    return `You begin following ${npc.name}.`;
  }

  // Check for player
  const player = playerManager.getPlayerByName(targetName);
  if (player) {
    if (player.currentRoom !== ctx.player.currentRoom) {
      return `${player.name} isn't here.`;
    }
    if (player.id === ctx.player.id) {
      return `You can't follow yourself.`;
    }

    followManager.follow(ctx.player.id, 'player', player.id, 'player');

    // Notify the target
    connectionManager.sendToPlayer(player.id, {
      type: 'output',
      content: `\n${ctx.player.name} begins following you.\n`,
    });

    return `You begin following ${player.name}.`;
  }

  return `You don't see anyone called '${targetName}' here.`;
}

// Handle unfollow command
export async function handleUnfollow(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const leader = followManager.getLeader(ctx.player.id, 'player');

  if (!leader) {
    return `You aren't following anyone.`;
  }

  let leaderName = 'someone';
  if (leader.leaderType === 'player') {
    const player = playerManager.getPlayer(leader.leaderId);
    leaderName = player?.name || 'someone';

    // Notify the leader
    connectionManager.sendToPlayer(leader.leaderId, {
      type: 'output',
      content: `\n${ctx.player.name} stops following you.\n`,
    });
  } else {
    const npc = npcManager.getNpcTemplate(leader.leaderId);
    leaderName = npc?.name || 'someone';
  }

  followManager.unfollow(ctx.player.id, 'player');
  return `You stop following ${leaderName}.`;
}

// Handle group command
export async function handleGroup(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const groupInfo = followManager.getGroupInfo(ctx.player.id);
  const lines: string[] = ['[Your Group]'];

  if (groupInfo.following) {
    lines.push(`Following: ${groupInfo.following.name}`);
  } else {
    lines.push(`Following: no one`);
  }

  if (groupInfo.followers.length > 0) {
    lines.push(`Followers: ${groupInfo.followers.map(f => f.name).join(', ')}`);
  } else {
    lines.push(`Followers: none`);
  }

  return lines.join('\n');
}

export { generateRoomOutput };
