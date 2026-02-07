import * as net from 'net';
import { Player } from '../../shared/types';
import { connectionManager } from '../managers/connectionManager';

// ANSI escape codes
const CLEAR_SCREEN = '\x1b[2J\x1b[H';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// Game dimensions
const GAME_WIDTH = 50;
const GAME_HEIGHT = 15;

// Arrow key sequences
const ARROW_UP = '\x1b[A';
const ARROW_DOWN = '\x1b[B';
const ARROW_LEFT = '\x1b[D';
const ARROW_RIGHT = '\x1b[C';

interface ConkersGame {
  socket: net.Socket;
  player: Player;
  running: boolean;
  score: number;
  round: number;
  maxRounds: number;
  playerHealth: number;
  opponentHealth: number;
  // Swing mechanics
  swingAngle: number;      // -3 to 3 (left to right)
  swingDirection: number;  // -1 or 1
  swingSpeed: number;
  targetZone: number;      // Where you need to hit (-1, 0, or 1)
  // Timing
  powerMeter: number;      // 0 to 10
  powerDirection: number;  // 1 or -1
  canSwing: boolean;
  swingResult: string | null;
  gameOver: boolean;
  intervalId: NodeJS.Timeout | null;
  inputBuffer: string;
  originalDataHandler: ((data: Buffer) => void) | null;
}

// Active games
const activeGames = new Map<net.Socket, ConkersGame>();

export function startConkersGame(socket: net.Socket, player: Player): void {
  // Check if already in a game
  if (activeGames.has(socket)) {
    socket.write('\nYou\'re already playing Conkers!\n> ');
    return;
  }

  const game: ConkersGame = {
    socket,
    player,
    running: true,
    score: 0,
    round: 1,
    maxRounds: 5,
    playerHealth: 3,
    opponentHealth: 3,
    swingAngle: 0,
    swingDirection: 1,
    swingSpeed: 0.5,
    targetZone: 0,
    powerMeter: 0,
    powerDirection: 1,
    canSwing: true,
    swingResult: null,
    gameOver: false,
    intervalId: null,
    inputBuffer: '',
    originalDataHandler: null,
  };

  activeGames.set(socket, game);

  // Store and replace the data handler for raw input
  const listeners = socket.listeners('data') as ((data: Buffer) => void)[];
  if (listeners.length > 0) {
    game.originalDataHandler = listeners[0];
  }
  socket.removeAllListeners('data');
  socket.on('data', (data: Buffer) => handleMinigameInput(socket, data));

  // Set terminal to raw mode (character-by-character input)
  socket.write('\xff\xfb\x01'); // IAC WILL ECHO - we'll handle echoing
  socket.write('\xff\xfb\x03'); // IAC WILL SUPPRESS-GO-AHEAD
  socket.write('\xff\xfd\x01'); // IAC DO ECHO (ask client to not echo)

  // Start the game
  socket.write(HIDE_CURSOR);
  randomizeTargetZone(game);
  renderGame(game);

  // Start game loop
  game.intervalId = setInterval(() => {
    if (!game.running) return;
    updateGame(game);
    renderGame(game);
  }, 100);
}

function handleMinigameInput(socket: net.Socket, data: Buffer): void {
  const game = activeGames.get(socket);
  if (!game) return;

  const input = data.toString();
  game.inputBuffer += input;

  // Check for escape sequences (arrow keys)
  while (game.inputBuffer.length > 0) {
    // Check for escape sequence start
    if (game.inputBuffer.startsWith('\x1b')) {
      // Need at least 3 chars for arrow key
      if (game.inputBuffer.length < 3) break;

      const seq = game.inputBuffer.substring(0, 3);
      game.inputBuffer = game.inputBuffer.substring(3);

      switch (seq) {
        case ARROW_LEFT:
          handleInput(game, 'left');
          break;
        case ARROW_RIGHT:
          handleInput(game, 'right');
          break;
        case ARROW_UP:
          handleInput(game, 'up');
          break;
        case ARROW_DOWN:
          handleInput(game, 'down');
          break;
      }
    } else {
      // Single character
      const char = game.inputBuffer[0];
      game.inputBuffer = game.inputBuffer.substring(1);

      if (char === ' ') {
        handleInput(game, 'space');
      } else if (char === 'q' || char === 'Q' || char === '\x1b') {
        // Q or ESC to quit
        endGame(game, 'quit');
      } else if (char === '\r' || char === '\n') {
        if (game.gameOver) {
          endGame(game, 'finished');
        }
      }
    }
  }
}

function handleInput(game: ConkersGame, input: string): void {
  if (game.gameOver) return;

  if (game.canSwing && input === 'space') {
    // Execute swing!
    executeSwing(game);
  }
}

function updateGame(game: ConkersGame): void {
  if (game.gameOver) return;

  // Update swing angle (pendulum motion)
  game.swingAngle += game.swingDirection * game.swingSpeed;
  if (game.swingAngle >= 3) {
    game.swingAngle = 3;
    game.swingDirection = -1;
  } else if (game.swingAngle <= -3) {
    game.swingAngle = -3;
    game.swingDirection = 1;
  }

  // Update power meter
  game.powerMeter += game.powerDirection * 0.8;
  if (game.powerMeter >= 10) {
    game.powerMeter = 10;
    game.powerDirection = -1;
  } else if (game.powerMeter <= 0) {
    game.powerMeter = 0;
    game.powerDirection = 1;
  }
}

function executeSwing(game: ConkersGame): void {
  game.canSwing = false;

  // Calculate accuracy based on swing angle vs target zone
  const angleZone = Math.round(game.swingAngle);
  const accuracy = Math.abs(angleZone - game.targetZone);
  const power = Math.round(game.powerMeter);

  let damage = 0;
  let resultMsg = '';

  if (accuracy === 0 && power >= 7) {
    // Perfect hit!
    damage = 2;
    game.score += 100;
    resultMsg = `${GREEN}${BOLD}CRACK! Perfect hit!${RESET}`;
  } else if (accuracy <= 1 && power >= 5) {
    // Good hit
    damage = 1;
    game.score += 50;
    resultMsg = `${YELLOW}Thwack! Good hit!${RESET}`;
  } else if (accuracy <= 2 && power >= 3) {
    // Glancing blow
    game.score += 10;
    resultMsg = `${DIM}Tap... glancing blow.${RESET}`;
  } else {
    // Miss!
    resultMsg = `${RED}Whoosh! You missed!${RESET}`;
    // Opponent counter-attacks
    game.playerHealth--;
    resultMsg += ` ${RED}They hit you back!${RESET}`;
  }

  game.opponentHealth -= damage;
  game.swingResult = resultMsg;

  // Check for round end
  setTimeout(() => {
    if (game.opponentHealth <= 0) {
      game.round++;
      game.score += 200;
      if (game.round > game.maxRounds) {
        game.gameOver = true;
        game.swingResult = `${GREEN}${BOLD}VICTORY! You are the Conkers Champion!${RESET}`;
      } else {
        game.swingResult = `${GREEN}Round won! Next opponent...${RESET}`;
        game.opponentHealth = 3;
        randomizeTargetZone(game);
      }
    } else if (game.playerHealth <= 0) {
      game.gameOver = true;
      game.swingResult = `${RED}${BOLD}DEFEAT! Your conker shattered!${RESET}`;
    }

    game.canSwing = true;
    if (!game.gameOver) {
      randomizeTargetZone(game);
    }
    renderGame(game);
  }, 1500);

  renderGame(game);
}

function randomizeTargetZone(game: ConkersGame): void {
  game.targetZone = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
}

function renderGame(game: ConkersGame): void {
  let screen = CLEAR_SCREEN;

  // Title
  screen += `${CYAN}${BOLD}=== CONKERS - A Shire Tradition ===${RESET}\n\n`;

  // Status bar
  screen += `  Round: ${game.round}/${game.maxRounds}   Score: ${game.score}\n`;
  screen += `  Your Conker: ${'O'.repeat(game.playerHealth)}${'_'.repeat(3 - game.playerHealth)}   `;
  screen += `Opponent: ${'O'.repeat(game.opponentHealth)}${'_'.repeat(3 - game.opponentHealth)}\n\n`;

  // Draw the game area
  // Target zone indicator
  const zones = ['  LEFT  ', ' CENTER ', ' RIGHT  '];
  screen += '  ';
  for (let i = -1; i <= 1; i++) {
    if (i === game.targetZone) {
      screen += `${GREEN}[${zones[i + 1]}]${RESET}`;
    } else {
      screen += `${DIM} ${zones[i + 1]} ${RESET}`;
    }
  }
  screen += '\n';

  // Opponent's conker (static target)
  screen += '\n         ';
  for (let i = -3; i <= 3; i++) {
    if (Math.round(i / 2) === game.targetZone) {
      screen += `${YELLOW}@${RESET}`;
    } else {
      screen += ' ';
    }
  }
  screen += '  <- Their conker\n';

  // Swing indicator (your conker on a string)
  screen += '\n';
  const stringTop = '         \\     |     /';
  screen += stringTop + '\n';

  // Your swinging conker
  const conkerPos = Math.round(game.swingAngle) + 3; // 0-6 position
  let conkerLine = '          ';
  for (let i = 0; i < 7; i++) {
    if (i === conkerPos) {
      screen += conkerLine + `${CYAN}O${RESET}` + ' '.repeat(6 - i) + '  <- Your conker\n';
      break;
    }
    conkerLine += ' ';
  }

  // Power meter
  screen += '\n  Power: [';
  const powerFilled = Math.round(game.powerMeter);
  for (let i = 0; i < 10; i++) {
    if (i < powerFilled) {
      if (powerFilled >= 7) {
        screen += `${GREEN}=${RESET}`;
      } else if (powerFilled >= 4) {
        screen += `${YELLOW}=${RESET}`;
      } else {
        screen += `${RED}=${RESET}`;
      }
    } else {
      screen += '-';
    }
  }
  screen += ']\n';

  // Result message
  if (game.swingResult) {
    screen += `\n  ${game.swingResult}\n`;
  } else {
    screen += '\n\n';
  }

  // Instructions
  if (game.gameOver) {
    screen += `\n  ${BOLD}Final Score: ${game.score}${RESET}\n`;
    screen += `  Press ENTER to return to the game, or Q to quit.\n`;
  } else {
    screen += `\n  ${DIM}Press SPACEBAR to swing when aimed at the target!${RESET}\n`;
    screen += `  ${DIM}Q to quit${RESET}\n`;
  }

  game.socket.write(screen);
}

function endGame(game: ConkersGame, reason: string): void {
  game.running = false;

  // Clean up interval
  if (game.intervalId) {
    clearInterval(game.intervalId);
  }

  // Restore terminal
  game.socket.write(SHOW_CURSOR);
  game.socket.write('\xff\xfc\x01'); // IAC WON'T ECHO
  game.socket.write('\xff\xfc\x03'); // IAC WON'T SUPPRESS-GO-AHEAD

  // Clear screen and show result
  game.socket.write(CLEAR_SCREEN);

  let msg = `\n${CYAN}${BOLD}=== CONKERS COMPLETE ===${RESET}\n\n`;
  msg += `  Final Score: ${game.score}\n`;
  msg += `  Rounds Won: ${Math.min(game.round - 1, game.maxRounds)}/${game.maxRounds}\n\n`;

  if (game.round > game.maxRounds) {
    msg += `  ${GREEN}Congratulations! You've become a Conkers Champion!${RESET}\n`;
    msg += `  ${GREEN}The hobbits of the Shire will speak of your prowess!${RESET}\n`;
  } else if (reason === 'quit') {
    msg += `  ${YELLOW}You've stepped away from the game.${RESET}\n`;
  } else {
    msg += `  ${YELLOW}Better luck next time! Practice makes perfect.${RESET}\n`;
  }

  msg += `\n`;
  game.socket.write(msg);

  // Restore original data handler
  game.socket.removeAllListeners('data');
  if (game.originalDataHandler) {
    game.socket.on('data', game.originalDataHandler);
  }

  // Remove from active games
  activeGames.delete(game.socket);

  // Send prompt
  game.socket.write('> ');
}

// Check if a socket is in a minigame
export function isInMinigame(socket: net.Socket): boolean {
  return activeGames.has(socket);
}
