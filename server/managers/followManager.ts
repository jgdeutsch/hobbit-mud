import { getDb } from '../database';
import { FollowRelationship, Player, NpcTemplate } from '../../shared/types';
import { npcManager } from './npcManager';
import { connectionManager } from './connectionManager';

class FollowManager {
  // Start following someone
  follow(
    followerId: number,
    followerType: 'player' | 'npc',
    leaderId: number,
    leaderType: 'player' | 'npc'
  ): boolean {
    const db = getDb();

    // Can't follow yourself
    if (followerType === leaderType && followerId === leaderId) {
      return false;
    }

    // Remove any existing follow relationship
    db.prepare('DELETE FROM follow_relationships WHERE follower_type = ? AND follower_id = ?').run(
      followerType,
      followerId
    );

    // Create new follow relationship
    db.prepare(
      `INSERT INTO follow_relationships (follower_type, follower_id, leader_type, leader_id)
       VALUES (?, ?, ?, ?)`
    ).run(followerType, followerId, leaderType, leaderId);

    return true;
  }

  // Stop following
  unfollow(followerId: number, followerType: 'player' | 'npc'): boolean {
    const db = getDb();

    const result = db
      .prepare('DELETE FROM follow_relationships WHERE follower_type = ? AND follower_id = ?')
      .run(followerType, followerId);

    return result.changes > 0;
  }

  // Get who this entity is following
  getLeader(
    followerId: number,
    followerType: 'player' | 'npc'
  ): { leaderType: 'player' | 'npc'; leaderId: number } | null {
    const db = getDb();

    const row = db
      .prepare(
        'SELECT leader_type, leader_id FROM follow_relationships WHERE follower_type = ? AND follower_id = ?'
      )
      .get(followerType, followerId) as { leader_type: string; leader_id: number } | undefined;

    if (!row) return null;

    return {
      leaderType: row.leader_type as 'player' | 'npc',
      leaderId: row.leader_id,
    };
  }

  // Get all followers of an entity
  getFollowers(
    leaderId: number,
    leaderType: 'player' | 'npc'
  ): { followerType: 'player' | 'npc'; followerId: number }[] {
    const db = getDb();

    const rows = db
      .prepare(
        'SELECT follower_type, follower_id FROM follow_relationships WHERE leader_type = ? AND leader_id = ?'
      )
      .all(leaderType, leaderId) as { follower_type: string; follower_id: number }[];

    return rows.map(row => ({
      followerType: row.follower_type as 'player' | 'npc',
      followerId: row.follower_id,
    }));
  }

  // Move all followers when leader moves
  async moveFollowers(
    leaderId: number,
    leaderType: 'player' | 'npc',
    newRoom: string,
    direction: string,
    leaderName: string
  ): Promise<string[]> {
    const followers = this.getFollowers(leaderId, leaderType);
    const messages: string[] = [];

    for (const follower of followers) {
      if (follower.followerType === 'player') {
        // Move player
        const { playerManager } = await import('./playerManager');
        playerManager.updateRoom(follower.followerId, newRoom);

        // Update connection state
        connectionManager.updatePlayer(follower.followerId, { currentRoom: newRoom });

        // Notify the follower
        connectionManager.sendToPlayer(follower.followerId, {
          type: 'output',
          content: `\nYou follow ${leaderName} ${direction}.\n`,
        });

        // Get the room description for the follower
        const { worldManager } = await import('./worldManager');
        const room = worldManager.getRoom(newRoom);
        if (room) {
          // They'll get the look output from their movement
        }
      } else {
        // Move NPC
        npcManager.moveNpc(follower.followerId, newRoom);
        const npcTemplate = npcManager.getNpcTemplate(follower.followerId);
        if (npcTemplate) {
          messages.push(`${npcTemplate.name} follows ${leaderName} ${direction}.`);
        }
      }
    }

    return messages;
  }

  // Get group info for a player (who they're following and who's following them)
  getGroupInfo(playerId: number): {
    following: { type: 'player' | 'npc'; id: number; name: string } | null;
    followers: { type: 'player' | 'npc'; id: number; name: string }[];
  } {
    const leader = this.getLeader(playerId, 'player');
    const followers = this.getFollowers(playerId, 'player');

    let following: { type: 'player' | 'npc'; id: number; name: string } | null = null;

    if (leader) {
      if (leader.leaderType === 'player') {
        const { playerManager } = require('./playerManager');
        const player = playerManager.getPlayer(leader.leaderId);
        if (player) {
          following = { type: 'player', id: leader.leaderId, name: player.name };
        }
      } else {
        const npc = npcManager.getNpcTemplate(leader.leaderId);
        if (npc) {
          following = { type: 'npc', id: leader.leaderId, name: npc.name };
        }
      }
    }

    const followerInfo = followers.map(f => {
      if (f.followerType === 'player') {
        const { playerManager } = require('./playerManager');
        const player = playerManager.getPlayer(f.followerId);
        return player ? { type: 'player' as const, id: f.followerId, name: player.name } : null;
      } else {
        const npc = npcManager.getNpcTemplate(f.followerId);
        return npc ? { type: 'npc' as const, id: f.followerId, name: npc.name } : null;
      }
    }).filter((x): x is { type: 'player' | 'npc'; id: number; name: string } => x !== null);

    return {
      following,
      followers: followerInfo,
    };
  }

  // Check if target is valid to follow (in same room)
  canFollow(followerRoom: string, targetType: 'player' | 'npc', targetId: number): boolean {
    if (targetType === 'player') {
      const { playerManager } = require('./playerManager');
      const player = playerManager.getPlayer(targetId);
      return player?.currentRoom === followerRoom;
    } else {
      const state = npcManager.getNpcState(targetId);
      return state?.currentRoom === followerRoom;
    }
  }
}

export const followManager = new FollowManager();
export default followManager;
