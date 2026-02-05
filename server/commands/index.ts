import { WebSocket } from 'ws';
import { CommandContext, DIRECTIONS } from '../../shared/types';
import { worldManager } from '../managers/worldManager';
import { connectionManager } from '../managers/connectionManager';
import { socialManager } from '../managers/socialManager';
import { gameLog } from '../services/logger';

// Import command handlers
import {
  handleMovement,
  handleFollow,
  handleUnfollow,
  handleGroup,
  generateRoomOutput,
} from './movement';
import {
  handleLook,
  handleTake,
  handleDrop,
  handleGive,
  handleInventory,
  handleTalk,
  handleContext,
  handleRecall,
  handleTime,
  handleScore,
  handleExamine,
  handleEquip,
  handleUnequip,
  handleWash,
  handleRest,
  handleQuest,
} from './interaction';
import {
  handleSay,
  handleShout,
  handleGossip,
  handleWhisper,
  handleEmote,
  handleWho,
} from './communication';
import { handleSocial, promptCreateSocial, handleSocialsList } from './socials';

// Command registry
type CommandHandler = (ws: WebSocket, ctx: CommandContext) => Promise<string>;

const COMMANDS: Record<string, CommandHandler> = {
  // Movement
  north: (ws, ctx) => handleMovement(ws, ctx, 'north'),
  south: (ws, ctx) => handleMovement(ws, ctx, 'south'),
  east: (ws, ctx) => handleMovement(ws, ctx, 'east'),
  west: (ws, ctx) => handleMovement(ws, ctx, 'west'),
  up: (ws, ctx) => handleMovement(ws, ctx, 'up'),
  down: (ws, ctx) => handleMovement(ws, ctx, 'down'),
  n: (ws, ctx) => handleMovement(ws, ctx, 'north'),
  s: (ws, ctx) => handleMovement(ws, ctx, 'south'),
  e: (ws, ctx) => handleMovement(ws, ctx, 'east'),
  w: (ws, ctx) => handleMovement(ws, ctx, 'west'),
  u: (ws, ctx) => handleMovement(ws, ctx, 'up'),
  d: (ws, ctx) => handleMovement(ws, ctx, 'down'),

  // Following
  follow: handleFollow,
  unfollow: handleUnfollow,
  group: handleGroup,

  // Interaction
  look: handleLook,
  l: handleLook,
  examine: handleExamine,
  ex: handleExamine,
  take: handleTake,
  get: handleTake,
  drop: handleDrop,
  give: handleGive,
  inventory: handleInventory,
  inv: handleInventory,
  i: handleInventory,
  talk: handleTalk,
  context: handleContext,
  recall: handleRecall,
  remember: handleRecall,
  time: handleTime,
  score: handleScore,
  stats: handleScore,

  // Equipment
  equip: handleEquip,
  wear: handleEquip,
  wield: handleEquip,
  unequip: handleUnequip,
  remove: handleUnequip,

  // Condition
  wash: handleWash,
  bathe: handleWash,
  clean: handleWash,
  rest: handleRest,
  sleep: handleRest,

  // Quests
  quest: handleQuest,
  quests: handleQuest,

  // Communication
  say: handleSay,
  "'": handleSay,
  shout: handleShout,
  gossip: handleGossip,
  whisper: handleWhisper,
  tell: handleWhisper,
  emote: handleEmote,
  ':': handleEmote,
  who: handleWho,

  // Socials list
  socials: handleSocialsList,

  // Help
  help: async (ws, ctx) => {
    return `
[Hobbit MUD Commands]

Movement:    n, s, e, w (or north, south, east, west)
Look:        look, look <target>, look self, examine <target>
Items:       take <item>, drop <item>, give <item> to <target>
             inventory (or inv, i)
Equipment:   equip <item>, unequip <slot>, wear <item>, remove <slot>
Condition:   wash/bathe (near water), rest/sleep
Talk:        talk <npc> [message], say <message>, shout <message>
             whisper <player> <message>, gossip <message>
NPCs:        context <npc> - see NPC's feelings and desires
             recall <npc> - remember your relationship history
Quests:      quest - view your active quests
             quest <number> - view quest journal details
Social:      smile, wave, bow, etc. (type 'socials' for list)
             You can also create new socials by using them!
Follow:      follow <target>, unfollow, group
Info:        time, score, who, help

The Shire awaits your adventure!
`;
  },

  // Quit
  quit: async (ws, ctx) => {
    connectionManager.send(ws, {
      type: 'output',
      content: `\nFarewell, ${ctx.player.name}! May your road lead you back to the Shire.\n`,
    });

    // Notify room
    connectionManager.sendToRoom(
      ctx.player.currentRoom,
      { type: 'output', content: `\n${ctx.player.name} fades away into the mist.\n` },
      ctx.player.id
    );

    // Clean up - use end() for telnet sockets
    setTimeout(() => {
      if (typeof (ws as any).end === 'function') {
        (ws as any).end();
      } else if (typeof ws.close === 'function') {
        ws.close();
      }
    }, 100);
    return '';
  },
};

// Main command processor
export async function processCommand(ws: WebSocket, input: string): Promise<void> {
  const conn = connectionManager.getConnection(ws);
  if (!conn || !conn.player) {
    connectionManager.send(ws, {
      type: 'error',
      content: 'You must be logged in to do that.',
    });
    return;
  }

  // Check for pending prompt first
  const pendingPrompt = connectionManager.getPendingPrompt(ws);
  if (pendingPrompt) {
    pendingPrompt.callback(input);
    return;
  }

  const player = conn.player;
  const room = worldManager.getRoom(player.currentRoom);

  if (!room) {
    connectionManager.send(ws, {
      type: 'error',
      content: 'You seem to be nowhere. This is a bug.',
    });
    return;
  }

  // Parse command
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  const ctx: CommandContext = {
    player,
    room,
    args,
    rawInput: input,
  };

  // Log the command
  gameLog.playerCommand(player.name, input, room.id);

  // Check registered commands first
  const handler = COMMANDS[cmd];
  if (handler) {
    try {
      const output = await handler(ws, ctx);
      if (output) {
        connectionManager.send(ws, { type: 'output', content: output });
      }
      return;
    } catch (error) {
      gameLog.error('COMMAND', error);
      connectionManager.send(ws, {
        type: 'error',
        content: 'Something went wrong processing that command.',
      });
      return;
    }
  }

  // Check if it's a social
  const socialResult = await handleSocial(ws, ctx, cmd);
  if (socialResult !== null) {
    connectionManager.send(ws, { type: 'output', content: socialResult });
    return;
  }

  // Unknown command - prompt to create social
  await promptCreateSocial(ws, ctx, cmd);
}

// Export for use in main server
export { generateRoomOutput };
