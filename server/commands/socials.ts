import { CommandContext } from '../../shared/types';
import { socialManager } from '../managers/socialManager';
import { npcManager } from '../managers/npcManager';
import { connectionManager } from '../managers/connectionManager';
import { WebSocket } from 'ws';

// Handle a social command
export async function handleSocial(
  ws: WebSocket,
  ctx: CommandContext,
  socialName: string
): Promise<string | null> {
  // Check if social exists
  const social = socialManager.getSocial(socialName);

  if (social) {
    // Execute the social
    return executeSocial(ws, ctx, social, ctx.args[0]);
  }

  // Social doesn't exist - prompt to create it
  return null; // Signal that we need to prompt for creation
}

// Execute a known social
async function executeSocial(
  ws: WebSocket,
  ctx: CommandContext,
  social: ReturnType<typeof socialManager.getSocial>,
  targetKeyword?: string
): Promise<string> {
  if (!social) {
    return `Something went wrong with that social.`;
  }

  let targetName: string | undefined;

  if (targetKeyword) {
    // Check for NPC target
    const npcs = npcManager.getNpcsInRoom(ctx.room.id);
    for (const { template } of npcs) {
      if (
        template.keywords.some(k => k.toLowerCase() === targetKeyword.toLowerCase()) ||
        template.name.toLowerCase().includes(targetKeyword.toLowerCase())
      ) {
        targetName = template.name;

        // NPCs might react based on sentiment
        if (social.sentiment === 'friendly') {
          npcManager.adjustFeeling(template.id, 'player', ctx.player.id, {
            affection: 2,
          });
        } else if (social.sentiment === 'hostile') {
          npcManager.adjustFeeling(template.id, 'player', ctx.player.id, {
            affection: -3,
            trust: -2,
          });
        }

        // Record the social as a memory
        npcManager.addMemory(
          template.id,
          'player',
          ctx.player.id,
          `${social.sentiment} gesture: ${social.name}`,
          3
        );
        break;
      }
    }

    // Check for player target
    if (!targetName) {
      const players = connectionManager.getPlayersInRoom(ctx.room.id);
      for (const player of players) {
        if (
          player.name.toLowerCase() === targetKeyword.toLowerCase() &&
          player.id !== ctx.player.id
        ) {
          targetName = player.name;
          break;
        }
      }
    }

    // Target not found
    if (!targetName) {
      return `You don't see '${targetKeyword}' here.`;
    }
  }

  // Generate messages
  const messages = socialManager.executeSocial(social, ctx.player.name, targetName);

  // Send target message
  if (messages.targetMessage && targetName) {
    // Find target player and send message
    const players = connectionManager.getPlayersInRoom(ctx.room.id);
    for (const player of players) {
      if (player.name === targetName) {
        connectionManager.sendToPlayer(player.id, {
          type: 'output',
          content: `\n${messages.targetMessage}\n`,
        });
        break;
      }
    }
  }

  // Send others message
  connectionManager.sendToRoom(
    ctx.player.currentRoom,
    {
      type: 'output',
      content: `\n${messages.othersMessage}\n`,
    },
    ctx.player.id
  );

  return messages.actorMessage;
}

// Prompt player to create a new social
export async function promptCreateSocial(
  ws: WebSocket,
  ctx: CommandContext,
  socialName: string
): Promise<void> {
  // Set up pending prompt
  connectionManager.setPendingPrompt(
    ws,
    'create_social',
    { socialName },
    async (response: string) => {
      const lowerResponse = response.toLowerCase().trim();

      if (lowerResponse === 'yes' || lowerResponse === 'y') {
        // Generate and save the social
        connectionManager.send(ws, {
          type: 'output',
          content: `\nGenerating '${socialName}' social...\n`,
        });

        const newSocial = await socialManager.generateSocial(socialName);

        if (newSocial) {
          socialManager.addCustomSocial(newSocial, ctx.player.id);

          connectionManager.send(ws, {
            type: 'output',
            content: `Social '${socialName}' created!\n\nPreview:\n  Alone: ${newSocial.noTargetSelf}\n  To others: ${newSocial.noTargetOthers}\n`,
          });

          // Execute it
          const result = await executeSocial(ws, ctx, newSocial, ctx.args[0]);
          connectionManager.send(ws, {
            type: 'output',
            content: `\n${result}\n`,
          });
        } else {
          connectionManager.send(ws, {
            type: 'error',
            content: `Failed to generate the social. Try again later.\n`,
          });
        }
      } else {
        connectionManager.send(ws, {
          type: 'output',
          content: `Social creation cancelled.\n`,
        });
      }
    }
  );

  // Send the prompt
  connectionManager.send(ws, {
    type: 'prompt',
    content: `That social doesn't exist. Would you like to add '${socialName}'? (yes/no)`,
  });
}

// Handle socials list command
export async function handleSocialsList(ws: WebSocket, ctx: CommandContext): Promise<string> {
  const socialNames = socialManager.getAllSocialNames();

  const lines = [`[Available Socials (${socialNames.length})]`, ''];

  // Group into columns
  const cols = 4;
  const rows = Math.ceil(socialNames.length / cols);

  for (let i = 0; i < rows; i++) {
    const row: string[] = [];
    for (let j = 0; j < cols; j++) {
      const idx = i + j * rows;
      if (idx < socialNames.length) {
        row.push(socialNames[idx].padEnd(15));
      }
    }
    lines.push('  ' + row.join(''));
  }

  lines.push('');
  lines.push('You can also create new socials by using them!');

  return lines.join('\n');
}
