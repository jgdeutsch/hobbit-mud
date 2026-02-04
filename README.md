# The Hobbit: A MUD in the Shire

A text-based multiplayer game set in The Shire at the beginning of "The Hobbit."

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm run dev

# Open client.html in your browser, or:
# wscat -c ws://localhost:4000
```

## Features

- **20+ rooms** across The Shire (Bag End, Hobbiton, Green Dragon, etc.)
- **Dynamic NPCs** with AI-powered dialogue (Bilbo, Gandalf, Gaffer Gamgee, and more)
- **NPC desires** - NPCs want things and will reward you for helping
- **Dynamic socials** - Create new social emotes on the fly
- **Follow system** - Follow NPCs or other players
- **NPC-to-NPC interactions** - Watch NPCs chat when you're in the room
- **Timed dwarf arrivals** - The 13 dwarves arrive throughout the evening, just like in the book

## Commands

| Command | Description |
|---------|-------------|
| `n/s/e/w` | Move north/south/east/west |
| `look` | Look at the room |
| `look <target>` | Examine something |
| `take <item>` | Pick up an item |
| `drop <item>` | Drop an item |
| `give <item> to <target>` | Give item to NPC |
| `inventory` | Show your inventory |
| `talk <npc> [message]` | Talk to an NPC |
| `context <npc>` | See NPC's feelings/desires |
| `say <message>` | Speak to the room |
| `shout <message>` | Heard in adjacent rooms |
| `gossip <message>` | Global chat |
| `whisper <player> <msg>` | Private message |
| `follow <target>` | Follow someone |
| `unfollow` | Stop following |
| `group` | Show your group |
| `socials` | List available socials |
| `smile`, `wave`, etc. | Social emotes |
| `time` | Show game time |
| `score` | Show your stats |
| `who` | List online players |
| `help` | Show all commands |

## Dynamic Socials

If you use a social that doesn't exist, the game will offer to create it:

```
> tip hat bilbo
That social doesn't exist. Would you like to add 'tip hat'? (yes/no)
> yes
Generating 'tip hat' social...
Social 'tip hat' created!
You tip your hat at Bilbo.
```

## NPC Desires

NPCs have dynamic desires. Use `context <npc>` to see what they want:

```
> context gaffer
[Gaffer Gamgee's Context]
Current desire: New pruning shears (priority 7)
Mood: Content
Feelings toward you: (Just met)
```

Help them fulfill their desires for increased trust and affection!

## The Shire Map

```
                    [Overhill]
                        |
    [Party Field] - [The Hill] - [Bagshot Row] - [Bag End Garden]
                        |                              |
                 [Hobbiton Village] -------- [Bag End Hall]
                   /    |    \                /    |    \
        [Bywater] [Green Dragon] [Mill]  [Kitchen][Parlour][Study]
            |                      |
      [Bywater Pool] -------- [The Water]
            |
     [Stock Road]
            |
       [Woodhall] - [Farmer Maggot's Fields]
            |
      [Bucklebury]
            |
   [Bucklebury Ferry] -- (The Wide World...)
```

## Architecture

- **WebSocket server** - Real-time communication
- **SQLite database** - Persistent world state
- **Gemini AI** - NPC dialogue generation
- **TypeScript** - Type-safe codebase

## Files

- `server/index.ts` - Main server
- `server/database.ts` - SQLite schema
- `server/data/` - Room, NPC, item templates
- `server/managers/` - Game logic
- `server/commands/` - Command handlers
- `server/services/geminiService.ts` - AI integration
- `client.html` - Web client

## License

For personal/educational use.
