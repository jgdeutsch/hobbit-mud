import { GoogleGenerativeAI } from '@google/generative-ai';
import { NpcTemplate, SocialDefinition, Player } from '../../shared/types';

const GEMINI_API_KEY = 'AIzaSyBxvpCeInudM1bs80tApSQ0XrqnKlaOXgk';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
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

The player ${player.name} says: "${playerMessage}"

Respond as ${npc.name} would. Keep your response SHORT (1-3 sentences) and in character. Include your character's speech mannerisms. If relevant, mention your current desire or feelings. If you don't know something, stay in character about it.`;

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

/**
 * Generate NPC-to-NPC interaction dialogue
 */
export async function generateNpcToNpcDialogue(
  npc1: NpcTemplate,
  npc2: NpcTemplate,
  context: string
): Promise<{ speaker: number; dialogue: string }[]> {
  const prompt = `Generate a short interaction between two NPCs in a Hobbit-themed MUD set in The Shire.

NPC 1: ${npc1.name}
- Personality: ${npc1.personality}
- Speech style: ${npc1.speechStyle}

NPC 2: ${npc2.name}
- Personality: ${npc2.personality}
- Speech style: ${npc2.speechStyle}

Context: ${context}

Generate 2-3 short lines of dialogue (max 15 words each) between them. The dialogue should reflect their personalities and be appropriate for the setting.

Respond in this exact JSON format:
[
  {"speaker": 1, "dialogue": "..."},
  {"speaker": 2, "dialogue": "..."}
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
};
