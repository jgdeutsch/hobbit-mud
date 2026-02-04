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
}

export interface ItemEffect {
  type: 'heal' | 'buff' | 'special';
  value: number;
  duration?: number;
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
