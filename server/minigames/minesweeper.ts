import * as net from 'net';
import { Player } from '../../shared/types';

// ANSI escape codes
const CLEAR_SCREEN = '\x1b[2J\x1b[H';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const BG_WHITE = '\x1b[47m';
const BLACK = '\x1b[30m';

// Arrow key sequences
const ARROW_UP = '\x1b[A';
const ARROW_DOWN = '\x1b[B';
const ARROW_LEFT = '\x1b[D';
const ARROW_RIGHT = '\x1b[C';

// Board dimensions
const BOARD_WIDTH = 9;
const BOARD_HEIGHT = 9;
const NUM_MINES = 10;

// Cell states
const HIDDEN = 0;
const REVEALED = 1;
const FLAGGED = 2;

interface Cell {
  hasMine: boolean;
  state: number;
  adjacentMines: number;
}

interface MinesweeperGame {
  socket: net.Socket;
  player: Player;
  opponent: string;
  board: Cell[][];
  cursorX: number;
  cursorY: number;
  gameOver: boolean;
  won: boolean;
  minesPlaced: boolean;
  flagsPlaced: number;
  cellsRevealed: number;
  startTime: number;
  inputBuffer: string;
  originalDataHandler: ((data: Buffer) => void) | null;
}

// Active games
const activeGames = new Map<net.Socket, MinesweeperGame>();

// Opponents with their dialogue
const OPPONENTS = [
  { name: 'Bilbo Baggins', winLine: 'Well played! You have the makings of a burglar!', loseLine: 'Oh dear, that was rather explosive!' },
  { name: 'Gandalf', winLine: 'You have keen eyes, my friend. The mines held no secrets from you.', loseLine: 'Even the wise cannot see all ends... or all mines.' },
  { name: 'Samwise Gamgee', winLine: 'Cor! You did it, Mr. Player! Better than taters, that was!', loseLine: 'Oh no! Don\'t worry, we\'ll get \'em next time!' },
  { name: 'Lobelia Sackville-Baggins', winLine: 'Hmph! Beginner\'s luck, I\'m sure.', loseLine: 'Ha! I knew you couldn\'t do it!' },
];

export function startMinesweeperGame(socket: net.Socket, player: Player): void {
  if (activeGames.has(socket)) {
    socket.write('\nYou\'re already playing Minesweeper!\n> ');
    return;
  }

  const opponent = OPPONENTS[Math.floor(Math.random() * OPPONENTS.length)];

  const game: MinesweeperGame = {
    socket,
    player,
    opponent: opponent.name,
    board: createEmptyBoard(),
    cursorX: Math.floor(BOARD_WIDTH / 2),
    cursorY: Math.floor(BOARD_HEIGHT / 2),
    gameOver: false,
    won: false,
    minesPlaced: false,
    flagsPlaced: 0,
    cellsRevealed: 0,
    startTime: Date.now(),
    inputBuffer: '',
    originalDataHandler: null,
  };

  activeGames.set(socket, game);

  // Store and replace the data handler
  const listeners = socket.listeners('data') as ((data: Buffer) => void)[];
  if (listeners.length > 0) {
    game.originalDataHandler = listeners[0];
  }
  socket.removeAllListeners('data');
  socket.on('data', (data: Buffer) => handleInput(socket, data));

  // Set terminal mode
  socket.write('\xff\xfb\x01'); // WILL ECHO
  socket.write('\xff\xfb\x03'); // WILL SUPPRESS-GO-AHEAD

  socket.write(HIDE_CURSOR);
  renderGame(game);
}

function createEmptyBoard(): Cell[][] {
  const board: Cell[][] = [];
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    board[y] = [];
    for (let x = 0; x < BOARD_WIDTH; x++) {
      board[y][x] = {
        hasMine: false,
        state: HIDDEN,
        adjacentMines: 0,
      };
    }
  }
  return board;
}

function placeMines(game: MinesweeperGame, safeX: number, safeY: number): void {
  let minesPlaced = 0;

  while (minesPlaced < NUM_MINES) {
    const x = Math.floor(Math.random() * BOARD_WIDTH);
    const y = Math.floor(Math.random() * BOARD_HEIGHT);

    // Don't place mine on first click or adjacent cells
    if (Math.abs(x - safeX) <= 1 && Math.abs(y - safeY) <= 1) continue;
    if (game.board[y][x].hasMine) continue;

    game.board[y][x].hasMine = true;
    minesPlaced++;
  }

  // Calculate adjacent mine counts
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (!game.board[y][x].hasMine) {
        game.board[y][x].adjacentMines = countAdjacentMines(game, x, y);
      }
    }
  }

  game.minesPlaced = true;
}

function countAdjacentMines(game: MinesweeperGame, x: number, y: number): number {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < BOARD_WIDTH && ny >= 0 && ny < BOARD_HEIGHT) {
        if (game.board[ny][nx].hasMine) count++;
      }
    }
  }
  return count;
}

function handleInput(socket: net.Socket, data: Buffer): void {
  const game = activeGames.get(socket);
  if (!game) return;

  const input = data.toString();
  game.inputBuffer += input;

  while (game.inputBuffer.length > 0) {
    // Check for escape sequences
    if (game.inputBuffer.startsWith('\x1b')) {
      if (game.inputBuffer.length < 3) break;

      const seq = game.inputBuffer.substring(0, 3);
      game.inputBuffer = game.inputBuffer.substring(3);

      if (!game.gameOver) {
        switch (seq) {
          case ARROW_UP:
            game.cursorY = Math.max(0, game.cursorY - 1);
            break;
          case ARROW_DOWN:
            game.cursorY = Math.min(BOARD_HEIGHT - 1, game.cursorY + 1);
            break;
          case ARROW_LEFT:
            game.cursorX = Math.max(0, game.cursorX - 1);
            break;
          case ARROW_RIGHT:
            game.cursorX = Math.min(BOARD_WIDTH - 1, game.cursorX + 1);
            break;
        }
      }
      renderGame(game);
    } else {
      const char = game.inputBuffer[0];
      game.inputBuffer = game.inputBuffer.substring(1);

      if (char === 'q' || char === 'Q') {
        endGame(game);
        return;
      }

      if (game.gameOver) {
        if (char === '\r' || char === '\n') {
          endGame(game);
          return;
        }
      } else {
        if (char === ' ') {
          revealCell(game, game.cursorX, game.cursorY);
        } else if (char === 'f' || char === 'F') {
          toggleFlag(game, game.cursorX, game.cursorY);
        }
      }
      renderGame(game);
    }
  }
}

function revealCell(game: MinesweeperGame, x: number, y: number): void {
  const cell = game.board[y][x];

  if (cell.state !== HIDDEN) return;

  // Place mines on first click
  if (!game.minesPlaced) {
    placeMines(game, x, y);
  }

  if (cell.hasMine) {
    // Game over - hit a mine!
    cell.state = REVEALED;
    game.gameOver = true;
    game.won = false;
    // Reveal all mines
    for (let ry = 0; ry < BOARD_HEIGHT; ry++) {
      for (let rx = 0; rx < BOARD_WIDTH; rx++) {
        if (game.board[ry][rx].hasMine) {
          game.board[ry][rx].state = REVEALED;
        }
      }
    }
    return;
  }

  // Reveal this cell
  cell.state = REVEALED;
  game.cellsRevealed++;

  // If no adjacent mines, reveal neighbors (flood fill)
  if (cell.adjacentMines === 0) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < BOARD_WIDTH && ny >= 0 && ny < BOARD_HEIGHT) {
          revealCell(game, nx, ny);
        }
      }
    }
  }

  // Check for win
  const totalSafeCells = BOARD_WIDTH * BOARD_HEIGHT - NUM_MINES;
  if (game.cellsRevealed === totalSafeCells) {
    game.gameOver = true;
    game.won = true;
  }
}

function toggleFlag(game: MinesweeperGame, x: number, y: number): void {
  const cell = game.board[y][x];

  if (cell.state === REVEALED) return;

  if (cell.state === HIDDEN) {
    cell.state = FLAGGED;
    game.flagsPlaced++;
  } else {
    cell.state = HIDDEN;
    game.flagsPlaced--;
  }
}

function getCellDisplay(cell: Cell, isSelected: boolean): string {
  let content: string;
  let color = RESET;

  if (cell.state === HIDDEN) {
    content = '#';
    color = DIM;
  } else if (cell.state === FLAGGED) {
    content = 'F';
    color = RED + BOLD;
  } else if (cell.hasMine) {
    content = '*';
    color = RED + BOLD;
  } else if (cell.adjacentMines === 0) {
    content = '.';
    color = DIM;
  } else {
    content = cell.adjacentMines.toString();
    // Color by number
    switch (cell.adjacentMines) {
      case 1: color = BLUE; break;
      case 2: color = GREEN; break;
      case 3: color = RED; break;
      case 4: color = MAGENTA; break;
      default: color = CYAN; break;
    }
  }

  if (isSelected) {
    return `${BG_WHITE}${BLACK}${content}${RESET}`;
  }
  return `${color}${content}${RESET}`;
}

function renderGame(game: MinesweeperGame): void {
  let screen = CLEAR_SCREEN;

  // Title
  screen += `${CYAN}${BOLD}=== MINESWEEPER ===${RESET}\n`;
  screen += `${DIM}Playing against ${game.opponent}${RESET}\n\n`;

  // Stats
  const elapsed = Math.floor((Date.now() - game.startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  screen += `  Mines: ${NUM_MINES}  Flags: ${game.flagsPlaced}  Time: ${minutes}:${seconds.toString().padStart(2, '0')}\n\n`;

  // Column headers
  screen += '    ';
  for (let x = 0; x < BOARD_WIDTH; x++) {
    screen += `${x + 1} `;
  }
  screen += '\n';

  // Top border
  screen += '   +' + '-'.repeat(BOARD_WIDTH * 2 - 1) + '+\n';

  // Board
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    screen += ` ${String.fromCharCode(65 + y)} |`;
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const isSelected = x === game.cursorX && y === game.cursorY;
      screen += getCellDisplay(game.board[y][x], isSelected);
      if (x < BOARD_WIDTH - 1) screen += ' ';
    }
    screen += '|\n';
  }

  // Bottom border
  screen += '   +' + '-'.repeat(BOARD_WIDTH * 2 - 1) + '+\n\n';

  // Game state message
  if (game.gameOver) {
    const opponent = OPPONENTS.find(o => o.name === game.opponent)!;
    if (game.won) {
      screen += `${GREEN}${BOLD}YOU WIN!${RESET}\n`;
      screen += `${CYAN}${game.opponent} says: "${opponent.winLine}"${RESET}\n\n`;
    } else {
      screen += `${RED}${BOLD}BOOM! You hit a mine!${RESET}\n`;
      screen += `${CYAN}${game.opponent} says: "${opponent.loseLine}"${RESET}\n\n`;
    }
    screen += `${DIM}Press ENTER to return to the game, or Q to quit.${RESET}\n`;
  } else {
    screen += `${DIM}Arrow keys: move | SPACE: reveal | F: flag | Q: quit${RESET}\n`;
  }

  game.socket.write(screen);
}

function endGame(game: MinesweeperGame): void {
  // Restore terminal
  game.socket.write(SHOW_CURSOR);
  game.socket.write('\xff\xfc\x01'); // WON'T ECHO
  game.socket.write('\xff\xfc\x03'); // WON'T SUPPRESS-GO-AHEAD

  game.socket.write(CLEAR_SCREEN);

  let msg = `\n${CYAN}Thanks for playing Minesweeper!${RESET}\n\n`;
  game.socket.write(msg);

  // Restore original handler
  game.socket.removeAllListeners('data');
  if (game.originalDataHandler) {
    game.socket.on('data', game.originalDataHandler);
  }

  activeGames.delete(game.socket);
  game.socket.write('> ');
}

export function isInMinigame(socket: net.Socket): boolean {
  return activeGames.has(socket);
}
