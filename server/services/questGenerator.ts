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
  npcs: { id: number; name: string; location: string; role: string; services?: string }[];
  items: { id: number; name: string; type: string; location?: string }[];
}

// NPC roles and services for quest generation
const NPC_ROLES: Record<number, { role: string; services?: string }> = {
  1: { role: 'wealthy hobbit, master of Bag End' },
  2: { role: 'wizard, advisor' },
  3: { role: 'gardener at Bag End', services: 'gardening knowledge' },
  4: { role: 'nosy relative, troublemaker' },
  5: { role: 'greedy relative' },
  6: { role: 'farmer, owns mushroom fields' },
  7: { role: 'miller', services: 'can sharpen tools and blades at the mill' },
  8: { role: 'innkeeper at the Green Dragon', services: 'sells ale and food, knows gossip' },
  9: { role: 'elderly retired hobbit, likes tea and stories' }, // Daddy Twofoot - NOT a merchant!
};

/**
 * Build world context for quest generation
 */
export function buildWorldContext(): WorldContext {
  // Get rooms
  const rooms = Object.entries(ROOMS).map(([id, room]) => ({
    id,
    name: room.name,
  }));

  // Get NPCs with their locations and roles
  const npcs = NPC_TEMPLATES.filter(npc => !npc.arrivalHour).map(npc => ({
    id: npc.id,
    name: npc.name,
    location: npc.homeRoom,
    role: NPC_ROLES[npc.id]?.role || npc.personality,
    services: NPC_ROLES[npc.id]?.services,
  }));

  // Get items with their types and default locations
  const items = ITEM_TEMPLATES.map(item => {
    // Find which room has this item
    let location: string | undefined;
    for (const [roomId, room] of Object.entries(ROOMS)) {
      if (room.items?.includes(item.id)) {
        location = roomId;
        break;
      }
      // Also check features that are takeable
      const feature = room.features?.find(f => f.itemTemplateId === item.id && f.takeable);
      if (feature) {
        location = roomId;
        break;
      }
    }
    return {
      id: item.id,
      name: item.name,
      type: item.itemType || 'misc',
      location,
    };
  });

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

  // Filter NPCs to show only relevant ones with services
  const relevantNpcs = worldContext.npcs.filter(n => n.services || n.id === npc.id);

  const prompt = `You are a quest designer for a Hobbit MUD set in The Shire.

QUEST GIVER: ${npc.name}
- Role: ${NPC_ROLES[npc.id]?.role || npc.personality}
- Speech style: ${npc.speechStyle}
- Location: ${npc.homeRoom}

DESIRE: ${desire.desireContent}
REASON: ${desire.desireReason || 'Personal reasons'}

PLAYER: ${playerName}

IMPORTANT - NPCs WITH SERVICES (use these for quests):
${relevantNpcs.map(n => `- ${n.name} (id:${n.id}) at ${n.location}: ${n.role}${n.services ? ` - SERVICES: ${n.services}` : ''}`).join('\n')}

AVAILABLE ITEMS:
${worldContext.items.filter(i => i.location).map(i => `- ${i.name} (id:${i.id}) at ${i.location}`).join('\n')}

RULES:
1. DO NOT start with "talk to quest giver" - the player is ALREADY talking to them
2. ONLY use NPCs with services listed above for service-related steps
3. If an item needs sharpening/repair, use Ted Sandyman (id:7) at the mill
4. Make sure items actually exist at the locations you specify
5. The final step should return something to the quest giver or complete the task

Design a quest with 2-4 steps.

Step types:
- get_item: Pick up an item (targetId = item id as string)
- visit_location: Go to a room (targetId = room id)
- talk_to_npc: Speak with NPC (targetId = npc id as string)
- give_item: Give item to NPC (targetId = "item_id:npc_id")
- use_service: Use NPC service (targetId = "npc_id:service_type")

Return ONLY valid JSON:
{
  "title": "Quest Title",
  "description": "One sentence quest description",
  "steps": [
    {
      "stepType": "step type",
      "targetId": "exact id",
      "targetName": "readable name",
      "description": "Player objective",
      "npcHint": "NPC hint in ${npc.speechStyle} style",
      "completionDialogue": "Completion message"
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
  // Filter out any "talk to quest giver" steps at the beginning
  // since the player is already talking to them when accepting the quest
  let steps = generated.steps;
  if (steps.length > 0 && steps[0].stepType === 'talk_to_npc') {
    const firstTargetId = parseInt(steps[0].targetId, 10);
    if (firstTargetId === npcId) {
      // Skip this redundant step - player is already talking to the quest giver
      steps = steps.slice(1);
    }
  }

  // Create the quest
  const questId = questManager.createQuest(
    playerId,
    npcId,
    generated.title,
    generated.description,
    desireId
  );

  // Add all steps (renumber after potential filtering)
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
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
