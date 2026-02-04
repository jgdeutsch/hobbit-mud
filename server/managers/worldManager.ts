import { getDb } from '../database';
import { Room, ItemTemplate, DIRECTIONS, OPPOSITE_DIRECTIONS } from '../../shared/types';
import { ROOMS, getRoom } from '../data/rooms';
import { ITEM_TEMPLATES, getItemTemplate } from '../data/items';

class WorldManager {
  // Get a room by ID
  getRoom(roomId: string): Room | undefined {
    return getRoom(roomId);
  }

  // Get items in a room (from database - runtime state)
  getRoomItems(roomId: string): { item: ItemTemplate; quantity: number }[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT item_template_id, quantity FROM room_items WHERE room_id = ?')
      .all(roomId) as { item_template_id: number; quantity: number }[];

    return rows
      .map(row => {
        const item = getItemTemplate(row.item_template_id);
        return item ? { item, quantity: row.quantity } : null;
      })
      .filter((x): x is { item: ItemTemplate; quantity: number } => x !== null);
  }

  // Initialize room items from room templates (call at startup)
  initializeRoomItems(): void {
    const db = getDb();

    // Clear existing room items
    db.prepare('DELETE FROM room_items').run();

    // Add items from room templates
    const insertStmt = db.prepare(
      'INSERT INTO room_items (room_id, item_template_id, quantity) VALUES (?, ?, ?)'
    );

    for (const room of Object.values(ROOMS)) {
      if (room.items && room.items.length > 0) {
        // Count occurrences of each item
        const itemCounts = new Map<number, number>();
        for (const itemId of room.items) {
          itemCounts.set(itemId, (itemCounts.get(itemId) || 0) + 1);
        }

        for (const [itemId, quantity] of itemCounts) {
          insertStmt.run(room.id, itemId, quantity);
        }
      }
    }

    console.log('Room items initialized');
  }

  // Add item to a room
  addItemToRoom(roomId: string, itemTemplateId: number, quantity: number = 1): void {
    const db = getDb();

    const existing = db
      .prepare('SELECT id, quantity FROM room_items WHERE room_id = ? AND item_template_id = ?')
      .get(roomId, itemTemplateId) as { id: number; quantity: number } | undefined;

    if (existing) {
      db.prepare('UPDATE room_items SET quantity = quantity + ? WHERE id = ?').run(
        quantity,
        existing.id
      );
    } else {
      db.prepare('INSERT INTO room_items (room_id, item_template_id, quantity) VALUES (?, ?, ?)').run(
        roomId,
        itemTemplateId,
        quantity
      );
    }
  }

  // Remove item from a room
  removeItemFromRoom(roomId: string, itemTemplateId: number, quantity: number = 1): boolean {
    const db = getDb();

    const existing = db
      .prepare('SELECT id, quantity FROM room_items WHERE room_id = ? AND item_template_id = ?')
      .get(roomId, itemTemplateId) as { id: number; quantity: number } | undefined;

    if (!existing || existing.quantity < quantity) {
      return false;
    }

    if (existing.quantity === quantity) {
      db.prepare('DELETE FROM room_items WHERE id = ?').run(existing.id);
    } else {
      db.prepare('UPDATE room_items SET quantity = quantity - ? WHERE id = ?').run(
        quantity,
        existing.id
      );
    }

    return true;
  }

  // Find item in room by keyword
  findItemInRoom(roomId: string, keyword: string): { item: ItemTemplate; quantity: number } | undefined {
    const items = this.getRoomItems(roomId);
    const lower = keyword.toLowerCase();

    return items.find(
      ({ item }) =>
        item.keywords.some(k => k.toLowerCase() === lower) ||
        item.name.toLowerCase().includes(lower)
    );
  }

  // BFS pathfinding between rooms
  findPath(fromRoomId: string, toRoomId: string): string[] | null {
    if (fromRoomId === toRoomId) return [];

    const visited = new Set<string>();
    const queue: { roomId: string; path: string[] }[] = [{ roomId: fromRoomId, path: [] }];

    while (queue.length > 0) {
      const { roomId, path } = queue.shift()!;

      if (visited.has(roomId)) continue;
      visited.add(roomId);

      const room = this.getRoom(roomId);
      if (!room) continue;

      for (const [direction, nextRoomId] of Object.entries(room.exits)) {
        if (nextRoomId === toRoomId) {
          return [...path, direction];
        }

        if (!visited.has(nextRoomId)) {
          queue.push({ roomId: nextRoomId, path: [...path, direction] });
        }
      }
    }

    return null; // No path found
  }

  // Convert path to natural directions
  pathToDirections(path: string[]): string {
    if (path.length === 0) return 'You are already there.';
    if (path.length === 1) return `Go ${path[0]}.`;

    // Group consecutive same directions
    const groups: { direction: string; count: number }[] = [];
    for (const dir of path) {
      const last = groups[groups.length - 1];
      if (last && last.direction === dir) {
        last.count++;
      } else {
        groups.push({ direction: dir, count: 1 });
      }
    }

    const parts = groups.map(g => {
      if (g.count === 1) return g.direction;
      if (g.count === 2) return `${g.direction} twice`;
      return `${g.direction} ${g.count} times`;
    });

    if (parts.length === 1) return `Go ${parts[0]}.`;
    if (parts.length === 2) return `Go ${parts[0]}, then ${parts[1]}.`;

    const last = parts.pop();
    return `Go ${parts.join(', ')}, then ${last}.`;
  }

  // Get directions from one room to another (for NPCs giving directions)
  getDirections(fromRoomId: string, toRoomId: string): string | null {
    const path = this.findPath(fromRoomId, toRoomId);
    if (!path) return null;
    return this.pathToDirections(path);
  }

  // Spawn an item for a quest/desire
  spawnQuestItem(
    itemTemplateId: number,
    roomId: string,
    forNpcId: number,
    desireId?: number
  ): number {
    const db = getDb();

    // Add to room
    this.addItemToRoom(roomId, itemTemplateId, 1);

    // Record in spawned_quest_items
    const result = db
      .prepare(
        `INSERT INTO spawned_quest_items (item_template_id, room_id, spawned_for_npc_id, desire_id)
         VALUES (?, ?, ?, ?)`
      )
      .run(itemTemplateId, roomId, forNpcId, desireId || null);

    return result.lastInsertRowid as number;
  }

  // Get appropriate spawn room for an item type
  getSpawnRoomForItemType(itemType: string): string {
    const spawnLocations: Record<string, string[]> = {
      food: ['bag_end_kitchen', 'the_green_dragon', 'farmer_maggots_fields'],
      drink: ['the_green_dragon', 'bag_end_kitchen'],
      consumable: ['the_green_dragon', 'bag_end_parlour', 'hobbiton_village'],
      tool: ['the_mill', 'hobbiton_village'],
      equipment: ['bag_end_hall', 'hobbiton_village'],
      valuable: ['bag_end_study', 'bag_end_parlour'],
      quest: ['bag_end_study'],
      special: ['bag_end_parlour'],
    };

    const locations = spawnLocations[itemType] || ['hobbiton_village'];
    return locations[Math.floor(Math.random() * locations.length)];
  }

  // Get all rooms
  getAllRooms(): Room[] {
    return Object.values(ROOMS);
  }

  // Get item template
  getItemTemplate(id: number): ItemTemplate | undefined {
    return getItemTemplate(id);
  }

  // Find item template by keyword
  findItemTemplate(keyword: string): ItemTemplate | undefined {
    const lower = keyword.toLowerCase();
    return ITEM_TEMPLATES.find(
      item =>
        item.keywords.some(k => k.toLowerCase() === lower) ||
        item.name.toLowerCase().includes(lower)
    );
  }
}

export const worldManager = new WorldManager();
export default worldManager;
