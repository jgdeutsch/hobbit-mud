import { CommandContext, Room, NpcTemplate, EquipmentSlot } from '../../shared/types';
import { worldManager } from '../managers/worldManager';
import { playerManager } from '../managers/playerManager';
import { npcManager } from '../managers/npcManager';
import { npcDesiresManager } from '../managers/npcDesiresManager';
import { npcReactionManager } from '../managers/npcReactionManager';
import { connectionManager } from '../managers/connectionManager';
import { timeManager } from '../managers/timeManager';
import { equipmentManager } from '../managers/equipmentManager';
import { conditionManager } from '../managers/conditionManager';
import { generateRoomOutput } from './movement';
import geminiService from '../services/geminiService';
import { WebSocket } from 'ws';
import { getItemTemplate } from '../data/items';
import { NPC_TEMPLATES, getNpcByKeyword } from '../data/npcs';

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
      return handleLookPlayer(ctx, player);
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

// Handle looking at another player
function handleLookPlayer(ctx: CommandContext, target: { id: number; name: string }): string {
  const lines: string[] = [];

  // Basic description
  const equipQuality = equipmentManager.getEquipmentQualityDescription(target.id);
  lines.push(`\x1b[1m${target.name}\x1b[0m`);
  lines.push(`You see ${target.name}, a fellow adventurer who is ${equipQuality}.`);
  lines.push('');

  // Visible equipment items
  const visibleEquipment = equipmentManager.getVisibleEquipmentDescriptions(target.id);
  if (visibleEquipment.length > 0) {
    lines.push('\x1b[36mVisible Equipment:\x1b[0m');
    for (const item of visibleEquipment) {
      lines.push(`  ${item}`);
    }
    lines.push('');
  }

  // Condition (what you can observe)
  const condition = conditionManager.getCondition(target.id);
  lines.push('\x1b[36mAppearance:\x1b[0m');

  // Cleanliness
  const cleanDesc = conditionManager.getCleanlinessDescription(condition.cleanliness);
  const cleanColor = condition.cleanliness >= 70 ? '\x1b[32m' : condition.cleanliness >= 40 ? '\x1b[33m' : '\x1b[31m';
  lines.push(`  They appear ${cleanColor}${cleanDesc}\x1b[0m.`);

  // Fatigue
  const fatigueDesc = conditionManager.getFatigueDescription(condition.fatigue);
  const fatigueColor = condition.fatigue >= 70 ? '\x1b[32m' : condition.fatigue >= 40 ? '\x1b[33m' : '\x1b[31m';
  lines.push(`  They look ${fatigueColor}${fatigueDesc}\x1b[0m.`);

  // Blood (only if present)
  if (condition.bloodiness > 5) {
    const bloodDesc = conditionManager.getBloodyDescription(condition.bloodiness);
    lines.push(`  \x1b[31mThey ${bloodDesc}.\x1b[0m`);
  }

  // Wounds (only if present)
  if (condition.wounds > 5) {
    const woundDesc = conditionManager.getWoundsDescription(condition.wounds);
    lines.push(`  \x1b[33mThey ${woundDesc}.\x1b[0m`);
  }

  // Health indicator (rough estimate based on visible wounds)
  if (condition.wounds > 60) {
    lines.push(`  They appear to be in \x1b[31mserious condition\x1b[0m.`);
  } else if (condition.wounds > 30) {
    lines.push(`  They appear to be \x1b[33mhurt\x1b[0m.`);
  } else {
    lines.push(`  They appear to be in \x1b[32mgood health\x1b[0m.`);
  }

  // TODO: Add player-to-player feelings when that system is implemented
  // For now, just show neutral relationship
  lines.push('');
  lines.push('\x1b[36mYour Relationship:\x1b[0m');
  lines.push(`  You don't know ${target.name} very well yet.`);

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

      // Record this conversation for context tracking (NPC spoke to player)
      npcReactionManager.recordNpcSpokeToPlayer(
        ctx.room.id,
        template.id,
        template.name,
        ctx.player.id,
        response
      );

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

// Handle recall command - remember your relationship with an NPC
export async function handleRecall(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const targetName = ctx.args.join(' ');

  if (!targetName) {
    return `Recall whom? Usage: recall <npc name>`;
  }

  // Find NPC by keyword (doesn't need to be in room)
  const npc = getNpcByKeyword(targetName);
  if (!npc) {
    // Try partial match on all NPCs
    const matchedNpc = NPC_TEMPLATES.find(n =>
      n.name.toLowerCase().includes(targetName.toLowerCase()) ||
      n.keywords.some(k => k.toLowerCase().includes(targetName.toLowerCase()))
    );
    if (!matchedNpc) {
      return `You don't recall anyone named '${targetName}'.`;
    }
    return generateRecallOutput(ctx, matchedNpc);
  }

  return generateRecallOutput(ctx, npc);
}

async function generateRecallOutput(ctx: CommandContext, npc: NpcTemplate): Promise<string> {
  const feeling = npcManager.getFeeling(npc.id, 'player', ctx.player.id);
  const memories = npcManager.getMemories(npc.id, 'player', ctx.player.id, 5);

  // If no relationship yet
  if (!feeling && memories.length === 0) {
    return `You pause to think about ${npc.name}...\n\nYou haven't really gotten to know ${npc.name} yet. Perhaps you should seek them out and strike up a conversation.`;
  }

  // Build context for AI to generate narrative
  const trust = feeling?.trust ?? 50;
  const affection = feeling?.affection ?? 50;
  const socialCapital = feeling?.socialCapital ?? 0;

  // Determine relationship quality
  let trustDesc = 'neutral';
  if (trust >= 80) trustDesc = 'deep trust';
  else if (trust >= 65) trustDesc = 'growing trust';
  else if (trust >= 35) trustDesc = 'cautious';
  else if (trust >= 20) trustDesc = 'suspicious';
  else trustDesc = 'distrustful';

  let affectionDesc = 'neutral';
  if (affection >= 80) affectionDesc = 'warm fondness';
  else if (affection >= 65) affectionDesc = 'friendly';
  else if (affection >= 35) affectionDesc = 'polite';
  else if (affection >= 20) affectionDesc = 'cool';
  else affectionDesc = 'cold';

  let standingDesc = 'neutral standing';
  if (socialCapital >= 50) standingDesc = 'excellent standing - they owe you';
  else if (socialCapital >= 20) standingDesc = 'good standing';
  else if (socialCapital >= -20) standingDesc = 'neutral standing';
  else if (socialCapital >= -50) standingDesc = 'poor standing';
  else standingDesc = 'terrible standing - you owe them';

  const memoryText = memories.length > 0
    ? memories.map(m => m.memoryContent).join('; ')
    : 'No specific memories';

  // Generate narrative via AI
  const prompt = `Generate a brief, atmospheric first-person reflection (2-3 sentences) for a hobbit named ${ctx.player.name} recalling their relationship with ${npc.name}.

NPC: ${npc.name}
NPC personality: ${npc.personality}
Trust level: ${trustDesc} (${trust}/100)
Affection level: ${affectionDesc} (${affection}/100)
Standing: ${standingDesc}
Recent interactions: ${memoryText}

Write from the player's perspective, as if they're sitting by a fire thinking back. Don't use numbers. Focus on the emotional quality of the relationship and any notable memories. Keep it under 50 words. Be specific to the character and memories.`;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0.8, maxOutputTokens: 150 },
    });

    const result = await model.generateContent(prompt);
    const narrative = result.response.text().trim();

    const lines: string[] = [];
    lines.push(`\x1b[36mYou pause to think about ${npc.name}...\x1b[0m`);
    lines.push('');
    lines.push(narrative);
    lines.push('');

    // Add a subtle hint about the relationship quality
    if (trust >= 65 && affection >= 65) {
      lines.push(`\x1b[32m${npc.name} considers you a friend.\x1b[0m`);
    } else if (trust <= 35 || affection <= 35) {
      lines.push(`\x1b[33m${npc.name} seems wary of you.\x1b[0m`);
    } else {
      lines.push(`\x1b[2m${npc.name} regards you as an acquaintance.\x1b[0m`);
    }

    return lines.join('\n');
  } catch (error) {
    // Fallback if AI fails
    const lines: string[] = [];
    lines.push(`\x1b[36mYou pause to think about ${npc.name}...\x1b[0m`);
    lines.push('');

    if (trust >= 65 && affection >= 65) {
      lines.push(`You've built a good relationship with ${npc.name}. They seem to trust and like you.`);
    } else if (trust <= 35 || affection <= 35) {
      lines.push(`Your relationship with ${npc.name} is strained. There's work to be done to earn their trust.`);
    } else {
      lines.push(`${npc.name} knows you, but you haven't made a strong impression yet - for better or worse.`);
    }

    return lines.join('\n');
  }
}
