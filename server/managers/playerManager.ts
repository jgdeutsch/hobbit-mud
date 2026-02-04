import { getDb } from '../database';
import { Player, PlayerInventoryItem, ItemTemplate } from '../../shared/types';
import { getItemTemplate } from '../data/items';
import { createHash } from 'crypto';

class PlayerManager {
  // Hash password (simple for now - use bcrypt in production)
  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }

  // Create a new account
  createAccount(username: string, password: string): number | null {
    const db = getDb();

    try {
      const result = db
        .prepare('INSERT INTO accounts (username, password_hash) VALUES (?, ?)')
        .run(username, this.hashPassword(password));
      return result.lastInsertRowid as number;
    } catch (error) {
      // Username probably already exists
      return null;
    }
  }

  // Authenticate an account
  authenticate(username: string, password: string): number | null {
    const db = getDb();

    const account = db
      .prepare('SELECT id, password_hash FROM accounts WHERE username = ?')
      .get(username) as { id: number; password_hash: string } | undefined;

    if (!account) return null;
    if (account.password_hash !== this.hashPassword(password)) return null;

    return account.id;
  }

  // Create a new player character
  createPlayer(accountId: number, name: string): Player | null {
    const db = getDb();

    try {
      const result = db
        .prepare(
          `INSERT INTO players (account_id, name, current_room, hp, max_hp, gold)
           VALUES (?, ?, 'bag_end_garden', 100, 100, 5)`
        )
        .run(accountId, name);

      const playerId = result.lastInsertRowid as number;

      // Give starting items
      this.addToInventory(playerId, 21, 1); // Handkerchief
      this.addToInventory(playerId, 11, 1); // Pipe

      return this.getPlayer(playerId);
    } catch (error) {
      // Name probably already exists
      return null;
    }
  }

  // Get player by ID
  getPlayer(playerId: number): Player | null {
    const db = getDb();

    const row = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId) as any;
    if (!row) return null;

    return {
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      currentRoom: row.current_room,
      hp: row.hp,
      maxHp: row.max_hp,
      gold: row.gold,
    };
  }

  // Get player by name
  getPlayerByName(name: string): Player | null {
    const db = getDb();

    const row = db.prepare('SELECT * FROM players WHERE LOWER(name) = LOWER(?)').get(name) as any;
    if (!row) return null;

    return {
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      currentRoom: row.current_room,
      hp: row.hp,
      maxHp: row.max_hp,
      gold: row.gold,
    };
  }

  // Get players for an account
  getPlayersForAccount(accountId: number): Player[] {
    const db = getDb();

    const rows = db.prepare('SELECT * FROM players WHERE account_id = ?').all(accountId) as any[];

    return rows.map(row => ({
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      currentRoom: row.current_room,
      hp: row.hp,
      maxHp: row.max_hp,
      gold: row.gold,
    }));
  }

  // Update player's current room
  updateRoom(playerId: number, roomId: string): void {
    const db = getDb();
    db.prepare('UPDATE players SET current_room = ? WHERE id = ?').run(roomId, playerId);
  }

  // Update player stats
  updateStats(playerId: number, updates: Partial<Player>): void {
    const db = getDb();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.hp !== undefined) {
      fields.push('hp = ?');
      values.push(updates.hp);
    }
    if (updates.maxHp !== undefined) {
      fields.push('max_hp = ?');
      values.push(updates.maxHp);
    }
    if (updates.gold !== undefined) {
      fields.push('gold = ?');
      values.push(updates.gold);
    }
    if (updates.currentRoom !== undefined) {
      fields.push('current_room = ?');
      values.push(updates.currentRoom);
    }

    if (fields.length > 0) {
      values.push(playerId);
      db.prepare(`UPDATE players SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
  }

  // Get player inventory
  getInventory(playerId: number): { item: ItemTemplate; quantity: number }[] {
    const db = getDb();

    const rows = db
      .prepare('SELECT item_template_id, quantity FROM player_inventory WHERE player_id = ?')
      .all(playerId) as { item_template_id: number; quantity: number }[];

    return rows
      .map(row => {
        const item = getItemTemplate(row.item_template_id);
        return item ? { item, quantity: row.quantity } : null;
      })
      .filter((x): x is { item: ItemTemplate; quantity: number } => x !== null);
  }

  // Add item to inventory
  addToInventory(playerId: number, itemTemplateId: number, quantity: number = 1): void {
    const db = getDb();

    const existing = db
      .prepare(
        'SELECT id, quantity FROM player_inventory WHERE player_id = ? AND item_template_id = ?'
      )
      .get(playerId, itemTemplateId) as { id: number; quantity: number } | undefined;

    if (existing) {
      db.prepare('UPDATE player_inventory SET quantity = quantity + ? WHERE id = ?').run(
        quantity,
        existing.id
      );
    } else {
      db.prepare(
        'INSERT INTO player_inventory (player_id, item_template_id, quantity) VALUES (?, ?, ?)'
      ).run(playerId, itemTemplateId, quantity);
    }
  }

  // Remove item from inventory
  removeFromInventory(playerId: number, itemTemplateId: number, quantity: number = 1): boolean {
    const db = getDb();

    const existing = db
      .prepare(
        'SELECT id, quantity FROM player_inventory WHERE player_id = ? AND item_template_id = ?'
      )
      .get(playerId, itemTemplateId) as { id: number; quantity: number } | undefined;

    if (!existing || existing.quantity < quantity) {
      return false;
    }

    if (existing.quantity === quantity) {
      db.prepare('DELETE FROM player_inventory WHERE id = ?').run(existing.id);
    } else {
      db.prepare('UPDATE player_inventory SET quantity = quantity - ? WHERE id = ?').run(
        quantity,
        existing.id
      );
    }

    return true;
  }

  // Check if player has item
  hasItem(playerId: number, itemTemplateId: number, quantity: number = 1): boolean {
    const db = getDb();

    const row = db
      .prepare(
        'SELECT quantity FROM player_inventory WHERE player_id = ? AND item_template_id = ?'
      )
      .get(playerId, itemTemplateId) as { quantity: number } | undefined;

    return row !== undefined && row.quantity >= quantity;
  }

  // Find item in inventory by keyword
  findInInventory(
    playerId: number,
    keyword: string
  ): { item: ItemTemplate; quantity: number } | undefined {
    const inventory = this.getInventory(playerId);
    const lower = keyword.toLowerCase();

    return inventory.find(
      ({ item }) =>
        item.keywords.some(k => k.toLowerCase() === lower) ||
        item.name.toLowerCase().includes(lower)
    );
  }
}

export const playerManager = new PlayerManager();
export default playerManager;
