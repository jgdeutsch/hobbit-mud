import * as net from 'net';
import { initializeDatabase } from './database';
import { connectionManager } from './managers/connectionManager';
import { playerManager } from './managers/playerManager';
import { worldManager } from './managers/worldManager';
import { npcManager } from './managers/npcManager';
import { processCommand, generateRoomOutput } from './commands';
import { startGameLoop, stopGameLoop } from './gameLoop';

const TELNET_PORT = parseInt(process.env.TELNET_PORT || '4000', 10);

// Initialize everything
console.log('Initializing Hobbit MUD...');
initializeDatabase();
worldManager.initializeRoomItems();
npcManager.initializeNpcs();

// Start game loop
startGameLoop();

// Connection states
type ConnectionState = 'welcome' | 'username' | 'password' | 'new_username' | 'new_password' | 'new_password_confirm' | 'character_name' | 'playing';

interface TelnetConnection {
  socket: net.Socket;
  state: ConnectionState;
  username?: string;
  password?: string;
  buffer: string;
}

const telnetConnections = new Map<net.Socket, TelnetConnection>();

// Create Telnet server
const telnetServer = net.createServer((socket: net.Socket) => {
  console.log('New telnet connection from', socket.remoteAddress);

  // Set up connection
  socket.setEncoding('utf8');

  const conn: TelnetConnection = {
    socket,
    state: 'welcome',
    buffer: '',
  };
  telnetConnections.set(socket, conn);

  // Add to connection manager (using socket as the "ws" equivalent)
  connectionManager.addConnection(socket as any);

  // Send welcome message
  const welcomeMsg = `
\x1b[32m╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║       THE HOBBIT: A MUD IN THE SHIRE                     ║
║                                                           ║
║   "In a hole in the ground there lived a hobbit."        ║
║                                                           ║
║   It is the year 2941 of the Third Age, and an           ║
║   unexpected adventure is about to begin...              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝\x1b[0m

Welcome, traveler!

  (L)ogin to an existing account
  (N)ew account

Enter your choice: `;

  socket.write(welcomeMsg);

  // Handle incoming data
  socket.on('data', async (data: string) => {
    const tc = telnetConnections.get(socket);
    if (!tc) return;

    // Add to buffer and process complete lines
    tc.buffer += data;

    // Process each complete line
    while (tc.buffer.includes('\n') || tc.buffer.includes('\r')) {
      const lineEnd = Math.min(
        tc.buffer.includes('\n') ? tc.buffer.indexOf('\n') : Infinity,
        tc.buffer.includes('\r') ? tc.buffer.indexOf('\r') : Infinity
      );

      let line = tc.buffer.substring(0, lineEnd).trim();
      tc.buffer = tc.buffer.substring(lineEnd + 1).replace(/^[\r\n]+/, '');

      if (!line) continue;

      // Check for pending prompt
      const pendingPrompt = connectionManager.getPendingPrompt(socket as any);
      if (pendingPrompt) {
        pendingPrompt.callback(line);
        continue;
      }

      // Handle authentication flow
      if (tc.state !== 'playing') {
        await handleAuth(socket, line, tc);
        continue;
      }

      // Process game command
      await processCommand(socket as any, line);
    }
  });

  socket.on('close', () => {
    const player = connectionManager.getPlayer(socket as any);
    if (player) {
      connectionManager.sendToRoom(
        player.currentRoom,
        { type: 'output', content: `\n${player.name} has left the Shire.\n` },
        player.id
      );
    }

    connectionManager.removeConnection(socket as any);
    telnetConnections.delete(socket);
    console.log('Telnet connection closed');
  });

  socket.on('error', (error) => {
    console.error('Telnet socket error:', error.message);
    telnetConnections.delete(socket);
  });
});

// Handle authentication flow
async function handleAuth(socket: net.Socket, input: string, tc: TelnetConnection): Promise<void> {
  switch (tc.state) {
    case 'welcome':
      if (input.toLowerCase() === 'l' || input.toLowerCase() === 'login') {
        tc.state = 'username';
        socket.write('\nEnter your username: ');
      } else if (input.toLowerCase() === 'n' || input.toLowerCase() === 'new') {
        tc.state = 'new_username';
        socket.write('\nChoose a username: ');
      } else {
        socket.write('\nPlease enter L to login or N to create a new account: ');
      }
      break;

    case 'username':
      tc.username = input;
      tc.state = 'password';
      socket.write('Enter your password: ');
      break;

    case 'password':
      const accountId = playerManager.authenticate(tc.username!, input);
      if (accountId) {
        connectionManager.setAccountId(socket as any, accountId);

        const characters = playerManager.getPlayersForAccount(accountId);

        if (characters.length === 0) {
          tc.state = 'character_name';
          socket.write('\nNo characters found. Create a new one!\nEnter character name: ');
        } else if (characters.length === 1) {
          enterGame(socket, characters[0].id, tc);
        } else {
          let charList = '\nYour characters:\n';
          characters.forEach((char, i) => {
            charList += `  ${i + 1}. ${char.name}\n`;
          });
          charList += '\nEnter number or name to select: ';
          socket.write(charList);

          connectionManager.setPendingPrompt(socket as any, 'char_select', { characters }, (response: string) => {
            const idx = parseInt(response, 10) - 1;
            if (!isNaN(idx) && idx >= 0 && idx < characters.length) {
              enterGame(socket, characters[idx].id, tc);
            } else {
              const char = characters.find(c => c.name.toLowerCase() === response.toLowerCase());
              if (char) {
                enterGame(socket, char.id, tc);
              } else {
                socket.write('\x1b[31mCharacter not found. Disconnecting.\x1b[0m\n');
                socket.end();
              }
            }
          });
        }
      } else {
        socket.write('\x1b[31mInvalid username or password.\x1b[0m\n');
        tc.state = 'welcome';
        socket.write('  (L)ogin to an existing account\n  (N)ew account\n\nEnter your choice: ');
      }
      break;

    case 'new_username':
      if (input.length < 3) {
        socket.write('\x1b[31mUsername must be at least 3 characters.\x1b[0m\nChoose a username: ');
        return;
      }
      tc.username = input;
      tc.state = 'new_password';
      socket.write('Choose a password: ');
      break;

    case 'new_password':
      if (input.length < 4) {
        socket.write('\x1b[31mPassword must be at least 4 characters.\x1b[0m\nChoose a password: ');
        return;
      }
      tc.password = input;
      tc.state = 'new_password_confirm';
      socket.write('Confirm password: ');
      break;

    case 'new_password_confirm':
      if (input !== tc.password) {
        socket.write('\x1b[31mPasswords do not match.\x1b[0m\n');
        tc.state = 'new_password';
        socket.write('Choose a password: ');
        return;
      }

      const newAccountId = playerManager.createAccount(tc.username!, tc.password!);
      if (newAccountId) {
        connectionManager.setAccountId(socket as any, newAccountId);
        tc.state = 'character_name';
        socket.write('\n\x1b[32mAccount created!\x1b[0m Now create your character.\nEnter character name: ');
      } else {
        socket.write('\x1b[31mUsername already exists.\x1b[0m\n');
        tc.state = 'new_username';
        socket.write('Choose a different username: ');
      }
      break;

    case 'character_name':
      if (input.length < 2) {
        socket.write('\x1b[31mName must be at least 2 characters.\x1b[0m\nEnter character name: ');
        return;
      }

      const conn = connectionManager.getConnection(socket as any);
      if (!conn?.accountId) {
        socket.write('\x1b[31mSession error. Please reconnect.\x1b[0m\n');
        socket.end();
        return;
      }

      const newPlayer = playerManager.createPlayer(conn.accountId, input);
      if (newPlayer) {
        enterGame(socket, newPlayer.id, tc);
      } else {
        socket.write('\x1b[31mThat name is already taken.\x1b[0m\nChoose another name: ');
      }
      break;
  }
}

// Enter the game
function enterGame(socket: net.Socket, playerId: number, tc: TelnetConnection): void {
  const player = playerManager.getPlayer(playerId);
  if (!player) {
    socket.write('\x1b[31mError loading character.\x1b[0m\n');
    socket.end();
    return;
  }

  // Set player in connection
  connectionManager.setPlayer(socket as any, player);
  tc.state = 'playing';

  // Send welcome message
  socket.write(`\n\x1b[32mWelcome to the Shire, ${player.name}!\x1b[0m\n`);

  // Notify room
  connectionManager.sendToRoom(
    player.currentRoom,
    { type: 'output', content: `\n${player.name} arrives in the Shire.\n` },
    player.id
  );

  // Show room
  const room = worldManager.getRoom(player.currentRoom);
  if (room) {
    sendToTelnet(socket, generateRoomOutput(room, player.id));
  }

  socket.write('\nType "help" for a list of commands.\n\n> ');
}

// Helper to send to telnet socket
function sendToTelnet(socket: net.Socket, content: string): void {
  // Add color codes for room names
  let colored = content.replace(/\[([^\]]+)\]/g, '\x1b[36m[$1]\x1b[0m');
  socket.write(colored + '\n> ');
}

// Start telnet server
telnetServer.listen(TELNET_PORT, () => {
  console.log(`Telnet server listening on port ${TELNET_PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  stopGameLoop();
  telnetServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  stopGameLoop();
  telnetServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

console.log(`
╔═══════════════════════════════════════════════════════════╗
║       HOBBIT MUD SERVER STARTED                           ║
║                                                           ║
║   Connect with: telnet localhost ${TELNET_PORT}                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
