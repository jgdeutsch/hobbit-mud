import { GoogleGenerativeAI } from '@google/generative-ai';
import { NpcTemplate, SocialDefinition, Player } from '../../shared/types';

const GEMINI_API_KEY = 'AIzaSyBxvpCeInudM1bs80tApSQ0XrqnKlaOXgk';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: {
    temperature: 0.8,
    maxOutputTokens: 500,
  },
});

export interface NpcContext {
  mood: string;
  currentDesire?: string;
  desireReason?: string;
  feelingsTowardPlayer?: {
    trust: number;
    affection: number;
    socialCapital: number;
    notes?: string;
  };
  recentMemories?: string[];
  otherNpcsPresent?: string[];
  timeOfDay?: string;
  // Player appearance context
  playerAppearance?: {
    equipmentQuality: string;      // e.g., "wearing fine, respectable clothing"
    visibleCondition: string;      // e.g., "dirty, bloody"
    charismaBonus: number;         // total from equipment
    npcReaction: {
      fear: number;
      concern: number;
      disgust: number;
      respect: number;
    };
  };
}

/**
 * Generate NPC dialogue in response to player interaction
 */
export async function generateNpcDialogue(
  npc: NpcTemplate,
  player: Player,
  playerMessage: string,
  context: NpcContext
): Promise<string> {
  const prompt = `You are ${npc.name} in a Hobbit-themed MUD game set in The Shire at the beginning of "The Hobbit."

CHARACTER:
- Name: ${npc.name}
- Personality: ${npc.personality}
- Background: ${npc.backstory}
- Speech style: ${npc.speechStyle}

CURRENT STATE:
- Mood: ${context.mood}
${context.currentDesire ? `- Current desire: ${context.currentDesire}` : ''}
${context.desireReason ? `- Why: ${context.desireReason}` : ''}
${context.feelingsTowardPlayer ? `- Trust toward ${player.name}: ${context.feelingsTowardPlayer.trust}/100
- Affection toward ${player.name}: ${context.feelingsTowardPlayer.affection}/100
- Notes: ${context.feelingsTowardPlayer.notes || 'None'}` : ''}
${context.recentMemories?.length ? `- Recent memories: ${context.recentMemories.join('; ')}` : ''}
${context.otherNpcsPresent?.length ? `- Others present: ${context.otherNpcsPresent.join(', ')}` : ''}
${context.playerAppearance ? `
PLAYER APPEARANCE:
- ${player.name} is ${context.playerAppearance.equipmentQuality}
${context.playerAppearance.visibleCondition ? `- They appear: ${context.playerAppearance.visibleCondition}` : ''}
${context.playerAppearance.npcReaction.fear > 20 ? `- You feel somewhat AFRAID of them (they look dangerous)` : ''}
${context.playerAppearance.npcReaction.concern > 20 ? `- You feel CONCERNED for them (they seem hurt or unwell)` : ''}
${context.playerAppearance.npcReaction.disgust > 20 ? `- You find their appearance UNPLEASANT (dirty, unkempt)` : ''}
${context.playerAppearance.npcReaction.respect > 10 ? `- Their fine attire commands RESPECT` : context.playerAppearance.npcReaction.respect < -10 ? `- Their shabby appearance makes you think LESS of them` : ''}` : ''}

The player ${player.name} says: "${playerMessage}"

Respond as ${npc.name} would. Keep your response SHORT (1-3 sentences) and in character. Include your character's speech mannerisms. If relevant, mention your current desire or feelings. If you don't know something, stay in character about it.
IMPORTANT: React to the player's appearance! If they look wealthy, be more deferential. If they look poor or dirty, be more dismissive. If they're bloody or wounded, show concern or fear.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    return response.trim();
  } catch (error) {
    console.error('Gemini dialogue error:', error);
    return `${npc.name} mumbles something unintelligible.`;
  }
}

/**
 * Generate a dynamic social emote
 */
export async function generateSocialEmote(socialName: string): Promise<SocialDefinition | null> {
  const prompt = `Generate a MUD social emote called "${socialName}" for a Hobbit-themed game.

Generate SHORT messages (under 12 words each) for all perspectives:
- NO_TARGET_SELF: What the actor sees when doing this alone (use "You")
- NO_TARGET_OTHERS: What others see (use {actor} for the actor's name)
- WITH_TARGET_SELF: What the actor sees with a target (use "You" and {target})
- WITH_TARGET_TARGET: What the target sees (use {actor} for actor's name, "you" for target)
- WITH_TARGET_OTHERS: What bystanders see (use {actor} and {target})
- SENTIMENT: One of: friendly, hostile, neutral, romantic, playful

Respond in this exact JSON format:
{
  "no_target_self": "You ...",
  "no_target_others": "{actor} ...",
  "with_target_self": "You ... {target}.",
  "with_target_target": "{actor} ... you.",
  "with_target_others": "{actor} ... {target}.",
  "sentiment": "friendly"
}

Only respond with the JSON, no other text.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const data = JSON.parse(jsonMatch[0]);

    return {
      name: socialName,
      sentiment: data.sentiment || 'neutral',
      noTargetSelf: data.no_target_self,
      noTargetOthers: data.no_target_others,
      withTargetSelf: data.with_target_self,
      withTargetTarget: data.with_target_target,
      withTargetOthers: data.with_target_others,
    };
  } catch (error) {
    console.error('Gemini social generation error:', error);
    return null;
  }
}

/**
 * Generate a new desire for an NPC based on their personality and context
 */
export async function generateNpcDesire(
  npc: NpcTemplate,
  currentContext: string
): Promise<{ desireType: string; desireContent: string; desireReason: string; priority: number } | null> {
  const prompt = `You are generating a new desire for ${npc.name} in a Hobbit-themed MUD.

CHARACTER:
- Name: ${npc.name}
- Personality: ${npc.personality}
- Background: ${npc.backstory}

CURRENT CONTEXT:
${currentContext}

Generate a new, contextually appropriate desire for this character. It should fit their personality and the Shire setting.

Respond in this exact JSON format:
{
  "desire_type": "item|action|information|company",
  "desire_content": "What they want (brief)",
  "desire_reason": "Why they want it (1 sentence)",
  "priority": 1-10
}

Only respond with the JSON, no other text.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const data = JSON.parse(jsonMatch[0]);

    return {
      desireType: data.desire_type,
      desireContent: data.desire_content,
      desireReason: data.desire_reason,
      priority: data.priority,
    };
  } catch (error) {
    console.error('Gemini desire generation error:', error);
    return null;
  }
}

export interface NpcFullContext {
  mood: string;
  currentDesire?: string;
  desireReason?: string;
  recentMemories?: string[];
  feelingsToward?: Record<string, { trust: number; affection: number }>;
}

/**
 * Generate NPC-to-NPC interaction dialogue with full context
 */
export async function generateNpcToNpcDialogue(
  npc1: NpcTemplate,
  npc2: NpcTemplate,
  context: string,
  npc1Context?: NpcFullContext,
  npc2Context?: NpcFullContext,
  playersPresent?: string[],
  roomDescription?: string
): Promise<{ speaker: number; dialogue: string; action?: string }[]> {
  const prompt = `Generate a short interaction between two NPCs in a Hobbit-themed MUD set in The Shire.

LOCATION: ${roomDescription || 'The Shire'}
PLAYERS WATCHING: ${playersPresent?.join(', ') || 'A traveler'}

NPC 1: ${npc1.name}
- Personality: ${npc1.personality}
- Speech style: ${npc1.speechStyle}
- Current mood: ${npc1Context?.mood || 'neutral'}
${npc1Context?.currentDesire ? `- Wants: ${npc1Context.currentDesire}` : ''}
${npc1Context?.recentMemories?.length ? `- Recent events: ${npc1Context.recentMemories.slice(0, 2).join('; ')}` : ''}

NPC 2: ${npc2.name}
- Personality: ${npc2.personality}
- Speech style: ${npc2.speechStyle}
- Current mood: ${npc2Context?.mood || 'neutral'}
${npc2Context?.currentDesire ? `- Wants: ${npc2Context.currentDesire}` : ''}
${npc2Context?.recentMemories?.length ? `- Recent events: ${npc2Context.recentMemories.slice(0, 2).join('; ')}` : ''}

Context: ${context}

Generate 2-4 short lines of natural dialogue/actions between them. Include actions in *asterisks*. The dialogue should:
- Reflect their personalities and current moods
- Be appropriate for the Shire setting
- Occasionally reference their desires or recent events
- Feel natural, not forced

Respond in this exact JSON format:
[
  {"speaker": 1, "dialogue": "...", "action": "*optional action*"},
  {"speaker": 2, "dialogue": "...", "action": "*optional action*"}
]

Only respond with the JSON array, no other text.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Gemini NPC dialogue error:', error);
    return [];
  }
}

/**
 * Decide if an NPC should initiate interaction with a player
 */
export async function shouldNpcInitiateWithPlayer(
  npc: NpcTemplate,
  player: Player,
  npcContext: NpcFullContext,
  roomDescription: string,
  otherNpcsPresent: string[],
  otherPlayersPresent: string[]
): Promise<{ shouldInitiate: boolean; reason?: string }> {
  const prompt = `You are ${npc.name} in a Hobbit-themed MUD. Decide if you should spontaneously speak to the player.

YOUR CHARACTER:
- Name: ${npc.name}
- Personality: ${npc.personality}
- Current mood: ${npcContext.mood}
${npcContext.currentDesire ? `- You want: ${npcContext.currentDesire} (${npcContext.desireReason || ''})` : ''}
${npcContext.feelingsToward?.[player.name] ? `- Your feelings toward ${player.name}: Trust ${npcContext.feelingsToward[player.name].trust}/100, Affection ${npcContext.feelingsToward[player.name].affection}/100` : `- You don't know ${player.name} well yet`}
${npcContext.recentMemories?.length ? `- Recent memories: ${npcContext.recentMemories.slice(0, 3).join('; ')}` : ''}

SITUATION:
- Location: ${roomDescription}
- Player present: ${player.name}
${otherPlayersPresent.length ? `- Other players: ${otherPlayersPresent.join(', ')}` : ''}
${otherNpcsPresent.length ? `- Other NPCs here: ${otherNpcsPresent.join(', ')}` : ''}

Would ${npc.name} spontaneously say something to ${player.name} right now? Consider:
- Is there a reason to speak (desire, greeting, gossip, warning)?
- Does your personality make you talkative or reserved?
- Is this an appropriate moment?

Respond with JSON only:
{"should_initiate": true/false, "reason": "brief reason why or why not"}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { shouldInitiate: false };

    const data = JSON.parse(jsonMatch[0]);
    return {
      shouldInitiate: data.should_initiate === true,
      reason: data.reason,
    };
  } catch (error) {
    console.error('Gemini initiation check error:', error);
    return { shouldInitiate: false };
  }
}

/**
 * Generate proactive NPC dialogue to a player
 */
export async function generateNpcInitiatedDialogue(
  npc: NpcTemplate,
  player: Player,
  npcContext: NpcFullContext,
  reason: string,
  roomDescription: string,
  otherNpcsPresent: string[]
): Promise<{ dialogue: string; action?: string }> {
  const prompt = `You are ${npc.name} in a Hobbit-themed MUD, spontaneously speaking to ${player.name}.

YOUR CHARACTER:
- Name: ${npc.name}
- Personality: ${npc.personality}
- Speech style: ${npc.speechStyle}
- Current mood: ${npcContext.mood}
${npcContext.currentDesire ? `- You want: ${npcContext.currentDesire}` : ''}
${npcContext.feelingsToward?.[player.name] ? `- Feelings toward ${player.name}: Trust ${npcContext.feelingsToward[player.name].trust}/100, Affection ${npcContext.feelingsToward[player.name].affection}/100` : ''}

SITUATION:
- Location: ${roomDescription}
- Reason you're speaking: ${reason}
${otherNpcsPresent.length ? `- Others present: ${otherNpcsPresent.join(', ')}` : ''}

Generate what ${npc.name} says to ${player.name}. Keep it SHORT (1-2 sentences). Stay in character with your speech style. You may include an action in *asterisks*.

Respond with JSON only:
{"dialogue": "what you say", "action": "*optional action*"}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { dialogue: `${npc.name} glances at you.` };

    const data = JSON.parse(jsonMatch[0]);
    return {
      dialogue: data.dialogue,
      action: data.action,
    };
  } catch (error) {
    console.error('Gemini initiated dialogue error:', error);
    return { dialogue: `${npc.name} seems about to say something but hesitates.` };
  }
}

/**
 * Generate a memory summary from an interaction
 */
export async function generateMemorySummary(
  npcName: string,
  playerName: string,
  interactionType: string,
  details: string
): Promise<string> {
  const prompt = `Summarize this interaction for ${npcName}'s memory in under 15 words:
Player ${playerName} ${interactionType}: ${details}

Just respond with the summary, no quotes or extra text.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Gemini memory error:', error);
    return `${playerName} ${interactionType}`;
  }
}

export default {
  generateNpcDialogue,
  generateSocialEmote,
  generateNpcDesire,
  generateNpcToNpcDialogue,
  generateMemorySummary,
  shouldNpcInitiateWithPlayer,
  generateNpcInitiatedDialogue,
};
