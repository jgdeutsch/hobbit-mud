import * as net from 'net';
import { Player, GameMessage } from '../../shared/types';

// Generic socket type that works for both WebSocket and net.Socket
type AnySocket = net.Socket | any;

interface Connection {
  socket: AnySocket;
  accountId?: number;
  player?: Player;
  state: 'connected' | 'login' | 'playing' | 'creating';
  pendingPrompt?: {
    type: string;
    data: any;
    callback: (response: string) => void;
  };
}

class ConnectionManager {
  private connections: Map<AnySocket, Connection> = new Map();
  private playerConnections: Map<number, AnySocket> = new Map();

  addConnection(socket: AnySocket): void {
    this.connections.set(socket, {
      socket,
      state: 'connected',
    });
  }

  removeConnection(socket: AnySocket): void {
    const conn = this.connections.get(socket);
    if (conn?.player) {
      this.playerConnections.delete(conn.player.id);
    }
    this.connections.delete(socket);
  }

  getConnection(socket: AnySocket): Connection | undefined {
    return this.connections.get(socket);
  }

  setConnectionState(socket: AnySocket, state: Connection['state']): void {
    const conn = this.connections.get(socket);
    if (conn) {
      conn.state = state;
    }
  }

  setAccountId(socket: AnySocket, accountId: number): void {
    const conn = this.connections.get(socket);
    if (conn) {
      conn.accountId = accountId;
    }
  }

  setPlayer(socket: AnySocket, player: Player): void {
    const conn = this.connections.get(socket);
    if (conn) {
      conn.player = player;
      conn.state = 'playing';
      this.playerConnections.set(player.id, socket);
    }
  }

  getPlayer(socket: AnySocket): Player | undefined {
    return this.connections.get(socket)?.player;
  }

  getPlayerConnection(playerId: number): AnySocket | undefined {
    return this.playerConnections.get(playerId);
  }

  updatePlayer(playerId: number, updates: Partial<Player>): void {
    const socket = this.playerConnections.get(playerId);
    if (socket) {
      const conn = this.connections.get(socket);
      if (conn?.player) {
        Object.assign(conn.player, updates);
      }
    }
  }

  setPendingPrompt(
    socket: AnySocket,
    type: string,
    data: any,
    callback: (response: string) => void
  ): void {
    const conn = this.connections.get(socket);
    if (conn) {
      conn.pendingPrompt = { type, data, callback };
    }
  }

  getPendingPrompt(socket: AnySocket): Connection['pendingPrompt'] | undefined {
    const conn = this.connections.get(socket);
    if (conn) {
      const prompt = conn.pendingPrompt;
      conn.pendingPrompt = undefined;
      return prompt;
    }
    return undefined;
  }

  // Send message to a specific connection (telnet)
  send(socket: AnySocket, message: GameMessage): void {
    if (socket && typeof socket.write === 'function') {
      // Telnet socket - send plain text with ANSI colors
      let text = message.content;

      // Add colors based on message type
      if (message.type === 'error') {
        text = `\x1b[31m${text}\x1b[0m`;
      } else if (message.type === 'system') {
        text = `\x1b[33m${text}\x1b[0m`;
      } else if (message.type === 'prompt') {
        text = `\x1b[33m${text}\x1b[0m`;
      }

      // Highlight room names in brackets
      text = text.replace(/\[([^\]]+)\]/g, '\x1b[36m[$1]\x1b[0m');

      socket.write(text + '\n> ');
    }
  }

  sendToPlayer(playerId: number, message: GameMessage): void {
    const socket = this.playerConnections.get(playerId);
    if (socket) {
      this.send(socket, message);
    }
  }

  sendToRoom(roomId: string, message: GameMessage, excludePlayerId?: number): void {
    for (const [socket, conn] of this.connections) {
      if (conn.player && conn.player.currentRoom === roomId) {
        if (excludePlayerId === undefined || conn.player.id !== excludePlayerId) {
          this.send(socket, message);
        }
      }
    }
  }

  broadcast(message: GameMessage, excludePlayerId?: number): void {
    for (const [socket, conn] of this.connections) {
      if (conn.player) {
        if (excludePlayerId === undefined || conn.player.id !== excludePlayerId) {
          this.send(socket, message);
        }
      }
    }
  }

  getPlayersInRoom(roomId: string): Player[] {
    const players: Player[] = [];
    for (const conn of this.connections.values()) {
      if (conn.player && conn.player.currentRoom === roomId) {
        players.push(conn.player);
      }
    }
    return players;
  }

  getOnlinePlayers(): Player[] {
    const players: Player[] = [];
    for (const conn of this.connections.values()) {
      if (conn.player) {
        players.push(conn.player);
      }
    }
    return players;
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getPlayerCount(): number {
    return this.playerConnections.size;
  }
}

export const connectionManager = new ConnectionManager();
export default connectionManager;
