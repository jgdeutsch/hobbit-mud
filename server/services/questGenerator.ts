import { GoogleGenerativeAI } from '@google/generative-ai';
import { NpcTemplate, NpcDesire, GeneratedQuestData, QuestStepType } from '../../shared/types';
import { questManager } from '../managers/questManager';
import { worldManager } from '../managers/worldManager';
import { ROOMS } from '../data/rooms';
import { NPC_TEMPLATES } from '../data/npcs';
import { ITEM_TEMPLATES } from '../data/items';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
const projectRoot = __dirname.includes('dist')
  ? path.join(__dirname, '..', '..', '..')
  : path.join(__dirname, '..', '..');

dotenv.config({ path: path.join(projectRoot, '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');

const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 1000,
  },
});

interface WorldContext {
  rooms: { id: string; name: string }[];
  npcs: { id: number; name: string; location: string; services?: string }[];
  items: { id: number; name: string; locations: string[] }[];
}

/**
 * Build world context for quest generation
 */
export function buildWorldContext(): WorldContext {
  // Get rooms
  const rooms = Object.entries(ROOMS).map(([id, room]) => ({
    id,
    name: room.name,
  }));

  // Get NPCs with their locations
  const npcs = NPC_TEMPLATES.map(npc => ({
    id: npc.id,
    name: npc.name,
    location: npc.homeRoom,
    services: undefined as string | undefined, // Could extend with services
  }));

  // Get items with their default locations
  const items = ITEM_TEMPLATES.map(item => ({
    id: item.id,
    name: item.name,
    locations: ['various'], // Items can be in multiple places
  }));

  return { rooms, npcs, items };
}

/**
 * Generate a full quest from an NPC desire using Gemini
 */
export async function generateQuestFromDesire(
  npc: NpcTemplate,
  desire: NpcDesire,
  playerName: string
): Promise<GeneratedQuestData | null> {
  const worldContext = buildWorldContext();

  const prompt = `You are a quest designer for a Hobbit MUD set in The Shire at the beginning of "The Hobbit."

QUEST GIVER: ${npc.name}
- Personality: ${npc.personality}
- Speech style: ${npc.speechStyle}
- Home: ${npc.homeRoom}

DESIRE: ${desire.desireContent}
REASON: ${desire.desireReason || 'Personal reasons'}

PLAYER: ${playerName}

AVAILABLE WORLD:
Rooms: ${JSON.stringify(worldContext.rooms.slice(0, 20))}
NPCs: ${JSON.stringify(worldContext.npcs.slice(0, 15))}
Items: ${JSON.stringify(worldContext.items.slice(0, 20))}

Design a quest with 2-4 steps using ONLY the above world data.
Each step must use existing rooms, items, or NPCs from the lists provided.
Make the quest feel organic to The Shire setting - cozy, pastoral, but with a sense of adventure.

Step types available:
- get_item: Player must pick up a specific item (target_id = item id as string)
- visit_location: Player must go to a specific room (target_id = room id)
- talk_to_npc: Player must speak with a specific NPC (target_id = npc id as string)
- give_item: Player must give an item to an NPC (target_id = "item_id:npc_id")
- use_service: Player must use an NPC's service (target_id = "npc_id:service_type")

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "Quest Title (short, evocative, Hobbit-themed)",
  "description": "One sentence describing the quest",
  "steps": [
    {
      "stepType": "get_item|visit_location|talk_to_npc|give_item|use_service",
      "targetId": "the exact id from the world data",
      "targetName": "human readable name",
      "description": "What player sees as the objective",
      "npcHint": "What NPCs say to guide player here (in character, using ${npc.speechStyle})",
      "completionDialogue": "Message when this step completes (in character)"
    }
  ]
}`;

  try {
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // Remove markdown code blocks if present
    if (text.startsWith('```')) {
      text = text.split('```')[1];
      if (text.startsWith('json')) {
        text = text.substring(4);
      }
    }
    text = text.trim();

    const questData = JSON.parse(text) as GeneratedQuestData;

    // Validate the data
    if (!questData.title || !questData.steps || questData.steps.length === 0) {
      console.error('Invalid quest data from Gemini:', questData);
      return null;
    }

    return questData;
  } catch (error) {
    console.error('Error generating quest:', error);
    return null;
  }
}

/**
 * Create a quest in the database from generated data
 */
export function createQuestFromGenerated(
  playerId: number,
  npcId: number,
  generated: GeneratedQuestData,
  desireId?: number
): number {
  // Create the quest
  const questId = questManager.createQuest(
    playerId,
    npcId,
    generated.title,
    generated.description,
    desireId
  );

  // Add all steps
  for (let i = 0; i < generated.steps.length; i++) {
    const step = generated.steps[i];
    questManager.addQuestStep(
      questId,
      i + 1, // step_order starts at 1
      step.stepType as QuestStepType,
      step.targetId,
      step.targetName,
      step.description,
      step.npcHint,
      step.completionDialogue
    );
  }

  // Start the quest (mark first step as current)
  questManager.startQuest(questId);

  return questId;
}

/**
 * Fallback quests for when Gemini is unavailable
 */
const FALLBACK_QUESTS: Record<number, GeneratedQuestData> = {
  // Gaffer (id: 3) - Sharp shears quest
  3: {
    title: "The Gaffer's Sharpened Shears",
    description: "Help the Gaffer get his pruning shears sharpened at the Mill.",
    steps: [
      {
        stepType: 'get_item',
        targetId: '16', // pruning shears
        targetName: 'pruning shears',
        description: 'Get the pruning shears from the garden shed',
        npcHint: "The shears should be in the garden shed, if my memory serves. Just head to Bag End's garden.",
        completionDialogue: "You pick up the dull pruning shears. They could certainly use a good sharpening."
      },
      {
        stepType: 'visit_location',
        targetId: 'sandyman_mill',
        targetName: "Sandyman's Mill",
        description: "Visit Sandyman's Mill",
        npcHint: "Ted Sandyman's Mill is down Bagshot Row, past the village. He's got a grinding wheel there.",
        completionDialogue: "You arrive at the Mill. The sound of the water wheel fills the air."
      },
      {
        stepType: 'use_service',
        targetId: '7:sharpen', // Ted Sandyman:sharpen
        targetName: 'sharpening service',
        description: 'Ask Ted Sandyman to sharpen the shears',
        npcHint: "Tell Ted you need the shears sharpened. He'll do it for a small fee, if you take my meaning.",
        completionDialogue: "Ted runs the shears across his grinding wheel. They gleam with a fresh edge."
      },
      {
        stepType: 'give_item',
        targetId: '16:3', // pruning shears:Gaffer
        targetName: 'sharpened shears',
        description: 'Return the sharpened shears to the Gaffer',
        npcHint: "Just bring 'em back to me when Ted's done, if you take my meaning.",
        completionDialogue: "The Gaffer examines the shears with approval. \"Now these'll trim proper!\""
      }
    ]
  },
  // Bilbo (id: 1) - A simple fetch quest
  1: {
    title: "A Spot of Tea",
    description: "Bilbo would appreciate some fresh tea leaves for his afternoon tea.",
    steps: [
      {
        stepType: 'visit_location',
        targetId: 'hobbiton_market',
        targetName: 'Hobbiton Market',
        description: 'Go to the market to find tea',
        npcHint: "The market in Hobbiton should have what we need. It's just down the Hill.",
        completionDialogue: "You arrive at the bustling Hobbiton Market."
      },
      {
        stepType: 'get_item',
        targetId: '99', // Placeholder - would need actual tea item
        targetName: 'tea leaves',
        description: 'Purchase some fine tea leaves',
        npcHint: "Look for the finest tea leaves they have. I prefer something aromatic.",
        completionDialogue: "You acquire some fragrant tea leaves."
      },
      {
        stepType: 'talk_to_npc',
        targetId: '1', // Bilbo
        targetName: 'Bilbo',
        description: 'Return to Bilbo with the tea',
        npcHint: "Bring them back to Bag End when you have them.",
        completionDialogue: "\"Excellent! These will make a wonderful brew. Thank you kindly!\""
      }
    ]
  }
};

/**
 * Get a fallback quest for an NPC if Gemini fails
 */
export function getFallbackQuest(npcId: number): GeneratedQuestData | null {
  return FALLBACK_QUESTS[npcId] || null;
}

/**
 * Main function to generate or get a quest for an NPC's desire
 */
export async function generateQuest(
  playerId: number,
  npc: NpcTemplate,
  desire: { id?: number; desireType: string; desireContent: string; desireReason: string | null; priority?: number },
  playerName: string
): Promise<{ questId: number; quest: GeneratedQuestData } | null> {
  // Build a compatible desire object for quest generation
  const desireForGen: NpcDesire = {
    id: desire.id ?? 0,
    npcTemplateId: npc.id,
    desireType: desire.desireType as NpcDesire['desireType'],
    desireContent: desire.desireContent,
    desireReason: desire.desireReason,
    priority: desire.priority ?? 5,
    spawnedItemId: null,
    spawnedRoomId: null,
    fulfilledAt: null,
    createdAt: new Date(),
  };

  // Try Gemini first
  let questData = await generateQuestFromDesire(npc, desireForGen, playerName);

  // Fall back to pre-defined quests if Gemini fails
  if (!questData) {
    questData = getFallbackQuest(npc.id);
  }

  if (!questData) {
    console.error(`No quest available for NPC ${npc.id}`);
    return null;
  }

  // Create the quest in the database (use desire.id if available)
  const questId = createQuestFromGenerated(playerId, npc.id, questData, desire.id);

  return { questId, quest: questData };
}

export default {
  buildWorldContext,
  generateQuestFromDesire,
  createQuestFromGenerated,
  getFallbackQuest,
  generateQuest,
};
