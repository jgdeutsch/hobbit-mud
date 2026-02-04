import { worldManager } from './worldManager';
import { npcManager } from './npcManager';
import { followManager } from './followManager';
import { connectionManager } from './connectionManager';
import { NpcTemplate, Player } from '../../shared/types';
import { gameLog } from '../services/logger';

// Known location keywords mapped to room IDs
const LOCATION_KEYWORDS: Record<string, string> = {
  'green dragon': 'the_green_dragon',
  'dragon': 'the_green_dragon',
  'inn': 'the_green_dragon',
  'tavern': 'the_green_dragon',
  'bag end': 'bag_end_hall',
  'bilbo': 'bag_end_hall',
  'baggins': 'bag_end_hall',
  'garden': 'bag_end_garden',
  'hobbiton': 'hobbiton_village',
  'village': 'hobbiton_village',
  'market': 'hobbiton_village',
  'mill': 'the_mill',
  'sandyman': 'the_mill',
  'bywater': 'bywater',
  'pool': 'bywater_pool',
  'water': 'the_water',
  'river': 'the_water',
  'party field': 'party_field',
  'party tree': 'party_field',
  'hill': 'hobbiton_hill',
  'bagshot row': 'bagshot_row',
  'kitchen': 'bag_end_kitchen',
  'parlour': 'bag_end_parlour',
  'parlor': 'bag_end_parlour',
  'study': 'bag_end_study',
};

interface ActiveGuide {
  npcId: number;
  playerId: number;
  path: string[];  // Directions to take
  currentStep: number;
  destination: string;
}

class NpcGuideManager {
  private activeGuides: Map<number, ActiveGuide> = new Map();  // Keyed by NPC ID

  /**
   * Get available location names for AI to reference
   */
  getAvailableLocations(): string[] {
    return Object.keys(LOCATION_KEYWORDS);
  }

  /**
   * Find room ID from a location keyword
   */
  findRoomIdForLocation(locationKeyword: string): string | null {
    const lower = locationKeyword.toLowerCase();

    // Direct match
    if (LOCATION_KEYWORDS[lower]) {
      return LOCATION_KEYWORDS[lower];
    }

    // Partial match
    for (const [keyword, roomId] of Object.entries(LOCATION_KEYWORDS)) {
      if (lower.includes(keyword) || keyword.includes(lower)) {
        return roomId;
      }
    }

    return null;
  }

  /**
   * Start guiding a player to a destination
   */
  async startGuiding(
    npc: NpcTemplate,
    player: Player,
    destinationKeyword: string
  ): Promise<{ success: boolean; message: string }> {
    const npcState = npcManager.getNpcState(npc.id);
    if (!npcState) {
      return { success: false, message: `${npc.name} seems confused.` };
    }

    // Find the destination room
    const destinationRoomId = this.findRoomIdForLocation(destinationKeyword);
    if (!destinationRoomId) {
      return { success: false, message: `${npc.name} says: "I don't know where that is."` };
    }

    const destinationRoom = worldManager.getRoom(destinationRoomId);
    if (!destinationRoom) {
      return { success: false, message: `${npc.name} says: "I can't find that place."` };
    }

    // Already there?
    if (npcState.currentRoom === destinationRoomId) {
      return { success: false, message: `${npc.name} says: "We're already here!"` };
    }

    // Find path
    const path = worldManager.findPath(npcState.currentRoom, destinationRoomId);
    gameLog.log('NPC', 'GUIDE-PATH', `Path from ${npcState.currentRoom} to ${destinationRoomId}`, {
      path: path,
    });
    if (!path || path.length === 0) {
      return { success: false, message: `${npc.name} says: "I can't find a way there from here."` };
    }

    // Player must follow the NPC
    followManager.follow(player.id, 'player', npc.id, 'npc');

    // Store the active guide session
    this.activeGuides.set(npc.id, {
      npcId: npc.id,
      playerId: player.id,
      path: path,
      currentStep: 0,
      destination: destinationRoom.name,
    });

    gameLog.log('NPC', 'GUIDE', `${npc.name} started guiding ${player.name} to ${destinationRoom.name}`, {
      steps: path.length,
    });

    // Start the movement sequence
    this.continueGuiding(npc.id);

    return {
      success: true,
      message: `${npc.name} says: "Follow me to ${destinationRoom.name}."`,
    };
  }

  /**
   * Continue the guiding process - move one step
   */
  private async continueGuiding(npcId: number): Promise<void> {
    const guide = this.activeGuides.get(npcId);
    if (!guide) return;

    const npc = npcManager.getNpcTemplate(npcId);
    const npcState = npcManager.getNpcState(npcId);
    if (!npc || !npcState) {
      this.activeGuides.delete(npcId);
      return;
    }

    // Check if we're done
    if (guide.currentStep >= guide.path.length) {
      // Announce arrival
      connectionManager.sendToRoom(npcState.currentRoom, {
        type: 'output',
        content: `\n${npc.name} says: "Here we are - ${guide.destination}."\n`,
      });

      // Stop following before cleaning up guide session
      const wasFollowing = followManager.unfollow(guide.playerId, 'player');
      gameLog.log('NPC', 'GUIDE', `Unfollow result for player ${guide.playerId}: ${wasFollowing}`);

      // Notify player they stopped following
      connectionManager.sendToPlayer(guide.playerId, {
        type: 'output',
        content: `\nYou stop following ${npc.name}.\n`,
      });

      // Stop the guide session
      this.activeGuides.delete(npcId);

      gameLog.log('NPC', 'GUIDE', `${npc.name} finished guiding to ${guide.destination}`);
      return;
    }

    // Get next direction
    const direction = guide.path[guide.currentStep];
    const currentRoom = worldManager.getRoom(npcState.currentRoom);

    gameLog.log('NPC', 'GUIDE-STEP', `Step ${guide.currentStep}: NPC at ${npcState.currentRoom}, going ${direction}`, {
      pathRemaining: guide.path.slice(guide.currentStep),
    });

    if (!currentRoom || !currentRoom.exits[direction]) {
      // Path is blocked
      connectionManager.sendToRoom(npcState.currentRoom, {
        type: 'output',
        content: `\n${npc.name} says: "Hmm, the way seems blocked."\n`,
      });
      this.activeGuides.delete(npcId);
      return;
    }

    const nextRoomId = currentRoom.exits[direction];

    // Announce departure
    connectionManager.sendToRoom(npcState.currentRoom, {
      type: 'output',
      content: `\n${npc.name} heads ${direction}.\n`,
    });

    // Move NPC
    npcManager.moveNpc(npcId, nextRoomId);

    // Move followers (including the player being guided)
    await followManager.moveFollowers(npcId, 'npc', nextRoomId, direction, npc.name);

    // Announce arrival in new room (to others already there)
    connectionManager.sendToRoom(nextRoomId, {
      type: 'output',
      content: `\n${npc.name} arrives from the ${this.getOppositeDirection(direction)}.\n`,
    }, guide.playerId);  // Exclude the player who's following (they get their own message)

    // Show room to the follower
    const newRoom = worldManager.getRoom(nextRoomId);
    if (newRoom) {
      const { generateRoomOutput } = require('../commands/movement');
      const roomOutput = generateRoomOutput(newRoom, guide.playerId);
      connectionManager.sendToPlayer(guide.playerId, {
        type: 'output',
        content: `\n${roomOutput}\n`,
      });
    }

    // Increment step
    guide.currentStep++;

    // Schedule next movement (give time for player to read)
    setTimeout(() => {
      this.continueGuiding(npcId);
    }, 2500);  // 2.5 seconds between moves
  }

  /**
   * Check if an NPC is currently guiding someone
   */
  isGuiding(npcId: number): boolean {
    return this.activeGuides.has(npcId);
  }

  /**
   * Stop guiding (if player unfollows or leaves)
   */
  stopGuiding(npcId: number): void {
    const guide = this.activeGuides.get(npcId);
    if (guide) {
      const npc = npcManager.getNpcTemplate(npcId);
      const npcState = npcManager.getNpcState(npcId);

      if (npc && npcState) {
        connectionManager.sendToRoom(npcState.currentRoom, {
          type: 'output',
          content: `\n${npc.name} stops and looks around.\n`,
        });
      }

      this.activeGuides.delete(npcId);
    }
  }

  private getOppositeDirection(dir: string): string {
    const opposites: Record<string, string> = {
      north: 'south',
      south: 'north',
      east: 'west',
      west: 'east',
      up: 'below',
      down: 'above',
    };
    return opposites[dir] || 'somewhere';
  }
}

export const npcGuideManager = new NpcGuideManager();
export default npcGuideManager;
