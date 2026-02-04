import { CommandContext, Room, NpcTemplate } from '../../shared/types';
import { worldManager } from '../managers/worldManager';
import { playerManager } from '../managers/playerManager';
import { npcManager } from '../managers/npcManager';
import { npcDesiresManager } from '../managers/npcDesiresManager';
import { connectionManager } from '../managers/connectionManager';
import { timeManager } from '../managers/timeManager';
import { generateRoomOutput } from './movement';
import { WebSocket } from 'ws';

// Handle look command
export async function handleLook(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const target = ctx.args.join(' ');

  if (!target) {
    // Look at the room
    return generateRoomOutput(ctx.room, ctx.player.id);
  }

  // Look at a feature in the room
  for (const feature of ctx.room.features) {
    if (
      feature.keywords.some(k => k.toLowerCase() === target.toLowerCase()) ||
      feature.name.toLowerCase().includes(target.toLowerCase())
    ) {
      let response = feature.description;
      if (feature.takeable) {
        response += '\n(You could take this.)';
      }
      return response;
    }
  }

  // Look at an item in the room
  const roomItem = worldManager.findItemInRoom(ctx.room.id, target);
  if (roomItem) {
    return roomItem.item.longDesc;
  }

  // Look at an item in inventory
  const invItem = playerManager.findInInventory(ctx.player.id, target);
  if (invItem) {
    return invItem.item.longDesc;
  }

  // Look at an NPC
  const npcs = npcManager.getNpcsInRoom(ctx.room.id);
  for (const { template, state } of npcs) {
    if (
      template.keywords.some(k => k.toLowerCase() === target.toLowerCase()) ||
      template.name.toLowerCase().includes(target.toLowerCase())
    ) {
      return `${template.longDesc}\n\n${template.name} seems to be in a ${state.mood} mood.`;
    }
  }

  // Look at another player
  const players = connectionManager.getPlayersInRoom(ctx.room.id);
  for (const player of players) {
    if (player.name.toLowerCase() === target.toLowerCase() && player.id !== ctx.player.id) {
      return `You see ${player.name}, a fellow hobbit adventurer.`;
    }
  }

  return `You don't see '${target}' here.`;
}

// Handle take command
export async function handleTake(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const itemName = ctx.args.join(' ');

  if (!itemName) {
    return `Take what?`;
  }

  // Check takeable features first
  for (const feature of ctx.room.features) {
    if (
      feature.takeable &&
      feature.itemTemplateId &&
      (feature.keywords.some(k => k.toLowerCase() === itemName.toLowerCase()) ||
        feature.name.toLowerCase().includes(itemName.toLowerCase()))
    ) {
      // Add item to inventory
      playerManager.addToInventory(ctx.player.id, feature.itemTemplateId, 1);
      const item = worldManager.getItemTemplate(feature.itemTemplateId);

      // Notify room
      connectionManager.sendToRoom(
        ctx.player.currentRoom,
        { type: 'output', content: `\n${ctx.player.name} takes ${item?.shortDesc || 'something'}.\n` },
        ctx.player.id
      );

      return `You take ${item?.shortDesc || 'it'}.`;
    }
  }

  // Check room items
  const roomItem = worldManager.findItemInRoom(ctx.room.id, itemName);
  if (roomItem) {
    // Remove from room
    worldManager.removeItemFromRoom(ctx.room.id, roomItem.item.id, 1);

    // Add to inventory
    playerManager.addToInventory(ctx.player.id, roomItem.item.id, 1);

    // Notify room
    connectionManager.sendToRoom(
      ctx.player.currentRoom,
      { type: 'output', content: `\n${ctx.player.name} picks up ${roomItem.item.shortDesc}.\n` },
      ctx.player.id
    );

    return `You pick up ${roomItem.item.shortDesc}.`;
  }

  return `You don't see '${itemName}' here.`;
}

// Handle drop command
export async function handleDrop(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const itemName = ctx.args.join(' ');

  if (!itemName) {
    return `Drop what?`;
  }

  // Find item in inventory
  const invItem = playerManager.findInInventory(ctx.player.id, itemName);
  if (!invItem) {
    return `You don't have '${itemName}'.`;
  }

  // Remove from inventory
  playerManager.removeFromInventory(ctx.player.id, invItem.item.id, 1);

  // Add to room
  worldManager.addItemToRoom(ctx.room.id, invItem.item.id, 1);

  // Notify room
  connectionManager.sendToRoom(
    ctx.player.currentRoom,
    { type: 'output', content: `\n${ctx.player.name} drops ${invItem.item.shortDesc}.\n` },
    ctx.player.id
  );

  return `You drop ${invItem.item.shortDesc}.`;
}

// Handle give command
export async function handleGive(ws: WebSocket, ctx: CommandContext): Promise<string> {
  // Parse: give <item> to <target>
  const input = ctx.args.join(' ');
  const toIndex = input.toLowerCase().indexOf(' to ');

  if (toIndex === -1) {
    return `Usage: give <item> to <target>`;
  }

  const itemName = input.substring(0, toIndex).trim();
  const targetName = input.substring(toIndex + 4).trim();

  if (!itemName || !targetName) {
    return `Usage: give <item> to <target>`;
  }

  // Find item in inventory
  const invItem = playerManager.findInInventory(ctx.player.id, itemName);
  if (!invItem) {
    return `You don't have '${itemName}'.`;
  }

  // Find target NPC
  const npcs = npcManager.getNpcsInRoom(ctx.room.id);
  for (const { template } of npcs) {
    if (
      template.keywords.some(k => k.toLowerCase() === targetName.toLowerCase()) ||
      template.name.toLowerCase().includes(targetName.toLowerCase())
    ) {
      // Remove from inventory
      playerManager.removeFromInventory(ctx.player.id, invItem.item.id, 1);

      // Process the gift
      const result = await npcDesiresManager.processItemGift(
        template.id,
        ctx.player,
        invItem.item
      );

      // Notify room
      connectionManager.sendToRoom(
        ctx.player.currentRoom,
        {
          type: 'output',
          content: `\n${ctx.player.name} gives ${invItem.item.shortDesc} to ${template.name}.\n`,
        },
        ctx.player.id
      );

      return result.response;
    }
  }

  // Check for player target
  const players = connectionManager.getPlayersInRoom(ctx.room.id);
  for (const player of players) {
    if (player.name.toLowerCase() === targetName.toLowerCase() && player.id !== ctx.player.id) {
      // Remove from giver
      playerManager.removeFromInventory(ctx.player.id, invItem.item.id, 1);

      // Add to receiver
      playerManager.addToInventory(player.id, invItem.item.id, 1);

      // Notify receiver
      connectionManager.sendToPlayer(player.id, {
        type: 'output',
        content: `\n${ctx.player.name} gives you ${invItem.item.shortDesc}.\n`,
      });

      // Notify room
      connectionManager.sendToRoom(
        ctx.player.currentRoom,
        {
          type: 'output',
          content: `\n${ctx.player.name} gives ${invItem.item.shortDesc} to ${player.name}.\n`,
        },
        ctx.player.id
      );

      return `You give ${invItem.item.shortDesc} to ${player.name}.`;
    }
  }

  return `You don't see '${targetName}' here.`;
}

// Handle inventory command
export async function handleInventory(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const inventory = playerManager.getInventory(ctx.player.id);

  if (inventory.length === 0) {
    return `You are carrying nothing.`;
  }

  const lines = ['You are carrying:'];
  for (const { item, quantity } of inventory) {
    if (quantity > 1) {
      lines.push(`  ${item.shortDesc} (${quantity})`);
    } else {
      lines.push(`  ${item.shortDesc}`);
    }
  }

  return lines.join('\n');
}

// Handle talk command
export async function handleTalk(ws: WebSocket, ctx: CommandContext): Promise<string> {
  // Parse: talk to <npc> <message> or just talk <npc>
  let targetName = ctx.args[0];
  let message = ctx.args.slice(1).join(' ');

  // Handle "talk to <npc>"
  if (targetName?.toLowerCase() === 'to') {
    targetName = ctx.args[1];
    message = ctx.args.slice(2).join(' ');
  }

  if (!targetName) {
    return `Talk to whom? Usage: talk <npc> [message]`;
  }

  // Find NPC
  const npcs = npcManager.getNpcsInRoom(ctx.room.id);
  for (const { template } of npcs) {
    if (
      template.keywords.some(k => k.toLowerCase() === targetName.toLowerCase()) ||
      template.name.toLowerCase().includes(targetName.toLowerCase())
    ) {
      // If no message, use a generic greeting
      if (!message) {
        message = 'Hello!';
      }

      // Generate AI response
      const response = await npcManager.generateDialogue(template, ctx.player, message);

      // Notify room of conversation
      connectionManager.sendToRoom(
        ctx.player.currentRoom,
        {
          type: 'output',
          content: `\n${ctx.player.name} speaks with ${template.name}.\n`,
        },
        ctx.player.id
      );

      return `You say to ${template.name}: "${message}"\n\n${template.name} says: "${response}"`;
    }
  }

  return `You don't see '${targetName}' here to talk to.`;
}

// Handle context command (shows NPC context)
export async function handleContext(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const targetName = ctx.args.join(' ');

  if (!targetName) {
    return `Usage: context <npc>`;
  }

  // Find NPC
  const npcs = npcManager.getNpcsInRoom(ctx.room.id);
  for (const { template, state } of npcs) {
    if (
      template.keywords.some(k => k.toLowerCase() === targetName.toLowerCase()) ||
      template.name.toLowerCase().includes(targetName.toLowerCase())
    ) {
      const desire = npcDesiresManager.getCurrentDesire(template.id);
      const feeling = npcManager.getFeeling(template.id, 'player', ctx.player.id);
      const memories = npcManager.getMemories(template.id, 'player', ctx.player.id, 3);

      const lines: string[] = [`[${template.name}'s Context]`];
      lines.push('');

      if (desire) {
        lines.push(`Current desire: ${desire.desireContent} (priority ${desire.priority})`);
        if (desire.desireReason) {
          lines.push(`  Reason: ${desire.desireReason}`);
        }
      } else {
        lines.push(`Current desire: None in particular`);
      }

      lines.push(`Mood: ${state.mood}`);
      lines.push('');

      if (feeling) {
        lines.push(`Feelings toward you:`);
        lines.push(`  Trust: ${feeling.trust}/100`);
        lines.push(`  Affection: ${feeling.affection}/100`);
        lines.push(`  Social capital: ${feeling.socialCapital}`);
        if (feeling.notes) {
          lines.push(`  Notes: ${feeling.notes}`);
        }
      } else {
        lines.push(`Feelings toward you: (Just met)`);
      }

      if (memories.length > 0) {
        lines.push('');
        lines.push(`Recent memories of you:`);
        for (const memory of memories) {
          lines.push(`  - "${memory.memoryContent}"`);
        }
      }

      return lines.join('\n');
    }
  }

  return `You don't see '${targetName}' here.`;
}

// Handle time command
export async function handleTime(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const timeStr = timeManager.getTimeString();
  const desc = timeManager.getTimeDescription();

  return `${timeStr}\n\n${desc}`;
}

// Handle score/stats command
export async function handleScore(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const p = ctx.player;
  const inventory = playerManager.getInventory(p.id);

  const lines = [
    `[${p.name}]`,
    '',
    `Health: ${p.hp}/${p.maxHp}`,
    `Gold: ${p.gold}`,
    `Items: ${inventory.length}`,
    '',
    `Location: ${ctx.room.name}`,
  ];

  return lines.join('\n');
}

// Handle examine command (alias for look)
export async function handleExamine(ws: WebSocket, ctx: CommandContext): Promise<string> {
  return handleLook(ws, ctx);
}
