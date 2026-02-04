import { CommandContext, Room, NpcTemplate, EquipmentSlot } from '../../shared/types';
import { worldManager } from '../managers/worldManager';
import { playerManager } from '../managers/playerManager';
import { npcManager } from '../managers/npcManager';
import { npcDesiresManager } from '../managers/npcDesiresManager';
import { connectionManager } from '../managers/connectionManager';
import { timeManager } from '../managers/timeManager';
import { equipmentManager } from '../managers/equipmentManager';
import { conditionManager } from '../managers/conditionManager';
import { generateRoomOutput } from './movement';
import { WebSocket } from 'ws';
import { getItemTemplate } from '../data/items';

// Handle look command
export async function handleLook(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const target = ctx.args.join(' ');

  if (!target) {
    // Look at the room
    return generateRoomOutput(ctx.room, ctx.player.id);
  }

  // Look at self
  if (target.toLowerCase() === 'self' || target.toLowerCase() === 'me' || target.toLowerCase() === 'myself') {
    return handleLookSelf(ctx);
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
      // Show other player's equipment and condition
      const equipDesc = equipmentManager.getEquipmentQualityDescription(player.id);
      const conditionDesc = conditionManager.getVisibleConditionDescription(player.id);
      let desc = `You see ${player.name}, a fellow adventurer who is ${equipDesc}.`;
      if (conditionDesc) {
        desc += ` They ${conditionDesc}.`;
      }
      return desc;
    }
  }

  return `You don't see '${target}' here.`;
}

// Handle "look self" command - show equipment and condition
function handleLookSelf(ctx: CommandContext): string {
  const lines: string[] = [];

  lines.push(`\x1b[1m[${ctx.player.name}]\x1b[0m`);
  lines.push('');

  // Condition
  lines.push('\x1b[36mCondition:\x1b[0m');
  lines.push(conditionManager.formatConditionDisplay(ctx.player.id));
  lines.push('');

  // Equipment
  lines.push('\x1b[36mEquipment:\x1b[0m');
  lines.push(equipmentManager.formatEquipmentDisplay(ctx.player.id));
  lines.push('');

  // Stats summary
  const charisma = equipmentManager.getCharismaBonus(ctx.player.id);
  const armor = equipmentManager.getArmorValue(ctx.player.id);
  lines.push('\x1b[36mStats:\x1b[0m');
  lines.push(`  Health:    ${ctx.player.hp}/${ctx.player.maxHp}`);
  lines.push(`  Gold:      ${ctx.player.gold}`);
  if (charisma !== 0) {
    const charismaColor = charisma > 0 ? '\x1b[32m' : '\x1b[31m';
    lines.push(`  Charisma:  ${charismaColor}${charisma > 0 ? '+' : ''}${charisma}\x1b[0m (from equipment)`);
  }
  if (armor > 0) {
    lines.push(`  Armor:     ${armor}`);
  }

  return lines.join('\n');
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
  const equipment = equipmentManager.getEquipment(ctx.player.id);
  const equippedIds = new Set(Object.values(equipment).filter(id => id !== undefined));

  const lines: string[] = [];

  // Show equipped items first
  const equippedItems: string[] = [];
  for (const [slot, itemId] of Object.entries(equipment)) {
    if (itemId) {
      const item = getItemTemplate(itemId);
      if (item) {
        const slotName = slot.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
        equippedItems.push(`  \x1b[32m<${slotName}>\x1b[0m ${item.shortDesc}`);
      }
    }
  }

  if (equippedItems.length > 0) {
    lines.push('\x1b[1mEquipped:\x1b[0m');
    lines.push(...equippedItems);
    lines.push('');
  }

  // Show bag contents (non-equipped items)
  const bagItems = inventory.filter(({ item }) => !equippedIds.has(item.id));

  if (bagItems.length === 0 && equippedItems.length === 0) {
    return 'You are carrying nothing.';
  }

  if (bagItems.length > 0) {
    lines.push('\x1b[1mCarrying:\x1b[0m');
    for (const { item, quantity } of bagItems) {
      if (quantity > 1) {
        lines.push(`  ${item.shortDesc} (${quantity})`);
      } else {
        lines.push(`  ${item.shortDesc}`);
      }
    }
  } else if (equippedItems.length > 0) {
    lines.push('\x1b[2mYour bag is empty.\x1b[0m');
  }

  // Show gold
  lines.push('');
  lines.push(`\x1b[33mGold: ${ctx.player.gold}\x1b[0m`);

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
  const condition = conditionManager.getCondition(p.id);
  const charisma = equipmentManager.getCharismaBonus(p.id);
  const armor = equipmentManager.getArmorValue(p.id);

  const lines = [
    `\x1b[1m[${p.name}]\x1b[0m`,
    '',
    `\x1b[36mVitals:\x1b[0m`,
    `  Health:      ${p.hp}/${p.maxHp}`,
    `  Cleanliness: ${condition.cleanliness}%`,
    `  Fatigue:     ${condition.fatigue}%`,
  ];

  if (condition.bloodiness > 0) {
    lines.push(`  Bloodiness:  ${condition.bloodiness}%`);
  }
  if (condition.wounds > 0) {
    lines.push(`  Wounds:      ${condition.wounds}%`);
  }

  lines.push('');
  lines.push(`\x1b[36mStats:\x1b[0m`);
  lines.push(`  Gold:        ${p.gold}`);
  lines.push(`  Items:       ${inventory.length}`);
  if (charisma !== 0) {
    lines.push(`  Charisma:    ${charisma > 0 ? '+' : ''}${charisma}`);
  }
  if (armor > 0) {
    lines.push(`  Armor:       ${armor}`);
  }

  lines.push('');
  lines.push(`\x1b[36mLocation:\x1b[0m ${ctx.room.name}`);

  return lines.join('\n');
}

// Handle examine command (alias for look)
export async function handleExamine(ws: WebSocket, ctx: CommandContext): Promise<string> {
  return handleLook(ws, ctx);
}

// Handle equip command
export async function handleEquip(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const itemName = ctx.args.join(' ');

  if (!itemName) {
    return 'Equip what? Usage: equip <item>';
  }

  // Find item in inventory
  const invItem = playerManager.findInInventory(ctx.player.id, itemName);
  if (!invItem) {
    return `You don't have '${itemName}'.`;
  }

  if (!invItem.item.equipSlot) {
    return `You can't equip ${invItem.item.shortDesc}.`;
  }

  // Equip the item
  const result = equipmentManager.equip(ctx.player.id, invItem.item.id);

  if (!result.success) {
    return result.message;
  }

  // Remove from inventory
  playerManager.removeFromInventory(ctx.player.id, invItem.item.id, 1);

  // If something was unequipped, add it back to inventory
  if (result.unequipped) {
    playerManager.addToInventory(ctx.player.id, result.unequipped, 1);
  }

  // Notify room
  connectionManager.sendToRoom(
    ctx.player.currentRoom,
    { type: 'output', content: `\n${ctx.player.name} puts on ${invItem.item.shortDesc}.\n` },
    ctx.player.id
  );

  return result.message;
}

// Handle unequip/remove command
export async function handleUnequip(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const slotOrItem = ctx.args.join(' ').toLowerCase();

  if (!slotOrItem) {
    return 'Remove what? Usage: remove <slot> (head, neck, body, torso, cloak, hands, legs, feet, mainhand, offhand, ring)';
  }

  // Map common slot names to actual slots
  const slotMap: Record<string, EquipmentSlot> = {
    head: 'head',
    hat: 'head',
    helmet: 'head',
    hood: 'head',
    neck: 'neck',
    necklace: 'neck',
    scarf: 'neck',
    pendant: 'neck',
    body: 'body',
    shirt: 'body',
    torso: 'torso',
    waistcoat: 'torso',
    vest: 'torso',
    armor: 'torso',
    cloak: 'cloak',
    cape: 'cloak',
    hands: 'hands',
    gloves: 'hands',
    legs: 'legs',
    breeches: 'legs',
    trousers: 'legs',
    pants: 'legs',
    feet: 'feet',
    boots: 'feet',
    shoes: 'feet',
    mainhand: 'mainHand',
    'main hand': 'mainHand',
    weapon: 'mainHand',
    offhand: 'offHand',
    'off hand': 'offHand',
    ring: 'ring',
  };

  const slot = slotMap[slotOrItem];
  if (!slot) {
    // Try to find by item name in equipped items
    const equipment = equipmentManager.getEquipment(ctx.player.id);
    for (const [slotKey, itemId] of Object.entries(equipment)) {
      if (itemId) {
        const item = getItemTemplate(itemId);
        if (item && (
          item.name.toLowerCase().includes(slotOrItem) ||
          item.keywords.some(k => k.toLowerCase().includes(slotOrItem))
        )) {
          return handleUnequipSlot(ctx, slotKey as EquipmentSlot);
        }
      }
    }
    return `Unknown slot '${slotOrItem}'. Valid slots: head, neck, body, torso, cloak, hands, legs, feet, mainhand, offhand, ring`;
  }

  return handleUnequipSlot(ctx, slot);
}

function handleUnequipSlot(ctx: CommandContext, slot: EquipmentSlot): string {
  const result = equipmentManager.unequip(ctx.player.id, slot);

  if (!result.success) {
    return result.message;
  }

  // Add item back to inventory
  if (result.itemId) {
    playerManager.addToInventory(ctx.player.id, result.itemId, 1);
    const item = getItemTemplate(result.itemId);

    // Notify room
    connectionManager.sendToRoom(
      ctx.player.currentRoom,
      { type: 'output', content: `\n${ctx.player.name} removes ${item?.shortDesc || 'something'}.\n` },
      ctx.player.id
    );
  }

  return result.message;
}

// Handle wash/bathe command
export async function handleWash(ws: WebSocket, ctx: CommandContext): Promise<string> {
  // Check if player is near water
  const waterRooms = ['the_water', 'bywater_pool', 'bucklebury_ferry'];
  const hasWater = waterRooms.includes(ctx.room.id) ||
    ctx.room.features.some(f =>
      f.name.toLowerCase().includes('water') ||
      f.name.toLowerCase().includes('pool') ||
      f.name.toLowerCase().includes('river') ||
      f.name.toLowerCase().includes('stream')
    );

  if (!hasWater) {
    return "You need to be near water to wash. Try finding a pool, river, or stream.";
  }

  const result = conditionManager.wash(ctx.player.id, true);

  // Notify room
  connectionManager.sendToRoom(
    ctx.player.currentRoom,
    { type: 'output', content: `\n${ctx.player.name} washes in the water.\n` },
    ctx.player.id
  );

  return result;
}

// Handle rest/sleep command
export async function handleRest(ws: WebSocket, ctx: CommandContext): Promise<string> {
  // Check if this is an appropriate place to rest
  const restRooms = ['bag_end_parlour', 'bag_end_hall', 'the_green_dragon'];
  const canRest = restRooms.includes(ctx.room.id) ||
    ctx.room.features.some(f =>
      f.name.toLowerCase().includes('bed') ||
      f.name.toLowerCase().includes('chair') ||
      f.name.toLowerCase().includes('bench') ||
      f.name.toLowerCase().includes('couch')
    );

  if (!canRest) {
    return "This doesn't seem like a good place to rest. Try finding somewhere more comfortable.";
  }

  const result = conditionManager.rest(ctx.player.id);

  // Notify room
  connectionManager.sendToRoom(
    ctx.player.currentRoom,
    { type: 'output', content: `\n${ctx.player.name} settles down to rest.\n` },
    ctx.player.id
  );

  return result;
}
