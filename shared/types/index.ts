// Room types
export interface Room {
  id: string;
  name: string;
  description: string;
  exits: Record<string, string>; // direction -> room_id
  features: RoomFeature[];
  items?: number[]; // item template IDs present by default
}

export interface RoomFeature {
  name: string;
  keywords: string[];
  description: string;
  takeable: boolean;
  itemTemplateId?: number; // if takeable, which item it becomes
}

// NPC types
export interface NpcTemplate {
  id: number;
  name: string;
  keywords: string[];
  shortDesc: string;
  longDesc: string;
  personality: string;
  backstory: string;
  speechStyle: string;
  homeRoom: string;
  arrivalHour?: number; // for dwarves - when they arrive
  arrivalGroup?: string; // for grouping dwarf arrivals
  extroversion: number; // 0-100: 0=very introverted, 100=very extroverted - affects chance to comment on general statements
  importantTopics?: string[]; // topics this NPC cares about and will react to even if not addressed
}

export interface NpcState {
  npcTemplateId: number;
  currentRoom: string;
  mood: string;
  currentTask: string | null;
  energy: number;
  lastPlayerInteraction: Date | null;
}

export interface NpcDesire {
  id: number;
  npcTemplateId: number;
  desireType: 'item' | 'action' | 'information' | 'company';
  desireContent: string;
  desireReason: string | null;
  priority: number;
  spawnedItemId: number | null;
  spawnedRoomId: string | null;
  fulfilledAt: Date | null;
  createdAt: Date;
}

export interface NpcFeeling {
  id: number;
  npcTemplateId: number;
  targetType: 'player' | 'npc';
  targetId: number;
  trust: number;
  affection: number;
  socialCapital: number;
  notes: string | null;
  updatedAt: Date;
}

export interface NpcMemory {
  id: number;
  npcTemplateId: number;
  aboutType: 'player' | 'npc';
  aboutId: number;
  memoryContent: string;
  importance: number;
  createdAt: Date;
}

// Equipment slot types (KCD2-style)
export type EquipmentSlot =
  | 'head'      // hats, hoods, helmets
  | 'neck'      // necklaces, scarves
  | 'body'      // shirts, tunics
  | 'torso'     // waistcoats, armor
  | 'cloak'     // cloaks, capes
  | 'hands'     // gloves, gauntlets
  | 'legs'      // trousers, breeches
  | 'feet'      // boots, shoes (hobbits rarely wear these!)
  | 'mainHand'  // weapons, walking sticks
  | 'offHand'   // shields, lanterns
  | 'ring';     // rings (like that one ring...)

// Item types
export interface ItemTemplate {
  id: number;
  name: string;
  keywords: string[];
  shortDesc: string;
  longDesc: string;
  itemType: 'consumable' | 'food' | 'drink' | 'equipment' | 'quest' | 'valuable' | 'tool' | 'special';
  weight: number;
  value: number;
  effects?: ItemEffect[];
  // Equipment-specific properties
  equipSlot?: EquipmentSlot;
  quality?: 'poor' | 'common' | 'fine' | 'exceptional' | 'masterwork';
  armorValue?: number;
  charismaBonus?: number; // affects NPC reactions
}

export interface ItemEffect {
  type: 'heal' | 'buff' | 'special';
  value: number;
  duration?: number;
}

// Player condition/status
export interface PlayerCondition {
  cleanliness: number;    // 0-100, degrades over time, low = dirty
  fatigue: number;        // 0-100, degrades over time, low = exhausted
  bloodiness: number;     // 0-100, from combat/wounds, 0 = clean
  wounds: number;         // 0-100, from damage taken, 0 = healthy
}

// Player types
export interface Player {
  id: number;
  accountId: number;
  name: string;
  currentRoom: string;
  hp: number;
  maxHp: number;
  gold: number;
  // Condition stats
  cleanliness: number;
  fatigue: number;
  bloodiness: number;
  wounds: number;
}

// Equipped items
export interface PlayerEquipment {
  head?: number;      // item_template_id
  neck?: number;
  body?: number;
  torso?: number;
  cloak?: number;
  hands?: number;
  legs?: number;
  feet?: number;
  mainHand?: number;
  offHand?: number;
  ring?: number;
}

export interface PlayerInventoryItem {
  itemTemplateId: number;
  quantity: number;
}

// Social types
export interface SocialDefinition {
  name: string;
  sentiment: 'friendly' | 'hostile' | 'neutral' | 'romantic' | 'playful';
  noTargetSelf: string;
  noTargetOthers: string;
  withTargetSelf: string;
  withTargetTarget: string;
  withTargetOthers: string;
}

// Follow types
export interface FollowRelationship {
  followerType: 'player' | 'npc';
  followerId: number;
  leaderType: 'player' | 'npc';
  leaderId: number;
}

// Quest types
export type QuestStatus = 'active' | 'completed' | 'abandoned';
export type QuestStepStatus = 'pending' | 'current' | 'completed';
export type QuestStepType = 'get_item' | 'visit_location' | 'talk_to_npc' | 'give_item' | 'use_service';

export interface Quest {
  id: number;
  playerId: number;
  questGiverNpcId: number;
  title: string;
  description: string | null;
  status: QuestStatus;
  acceptedAt: Date;
  completedAt: Date | null;
  desireId: number | null;
}

export interface QuestStep {
  id: number;
  questId: number;
  stepOrder: number;
  stepType: QuestStepType;
  targetId: string | null;      // item_template_id, room_id, or npc_template_id
  targetName: string;           // Human-readable name
  description: string;          // What player sees as objective
  npcHint: string;              // What NPCs say to guide player
  completionDialogue: string | null;  // Message when step completes
  status: QuestStepStatus;
  completedAt: Date | null;
}

export interface GeneratedQuestData {
  title: string;
  description: string;
  steps: {
    stepType: QuestStepType;
    targetId: string;
    targetName: string;
    description: string;
    npcHint: string;
    completionDialogue: string;
  }[];
}

// Game time
export interface GameTime {
  hour: number;
  day: number;
  month: number;
  year: number;
}

// WebSocket message types
export interface GameMessage {
  type: 'output' | 'prompt' | 'error' | 'system';
  content: string;
  timestamp?: number;
}

export interface ClientCommand {
  type: 'command' | 'login' | 'create' | 'response';
  content: string;
}

// Command context
export interface CommandContext {
  player: Player;
  room: Room;
  args: string[];
  rawInput: string;
}

// Direction mappings
export const DIRECTIONS: Record<string, string> = {
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
  u: 'up',
  d: 'down',
  north: 'north',
  south: 'south',
  east: 'east',
  west: 'west',
  up: 'up',
  down: 'down',
};

export const OPPOSITE_DIRECTIONS: Record<string, string> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
  up: 'down',
  down: 'up',
};
