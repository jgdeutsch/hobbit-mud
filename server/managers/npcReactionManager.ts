import { NpcTemplate, Player } from '../../shared/types';
import { npcManager } from './npcManager';
import { connectionManager } from './connectionManager';
import { worldManager } from './worldManager';
import geminiService from '../services/geminiService';
import { gameLog } from '../services/logger';
import { ITEM_TEMPLATES } from '../data/items';

export interface WitnessedEvent {
  type: 'say' | 'emote' | 'social' | 'action' | 'arrival' | 'departure';
  actor: { type: 'player' | 'npc'; name: string; id: number };
  target?: { type: 'player' | 'npc'; name: string; id: number };
  content: string; // The message or action description
  roomId: string;
}

// Track recent conversations: who spoke to whom recently
interface ConversationContext {
  npcId: number;
  npcName: string;
  playerId: number;
  lastMessage: string;
  timestamp: number;
}

// Track pending quest offers waiting for player acceptance
interface PendingQuestOffer {
  npcId: number;
  npcName: string;
  playerId: number;
  playerName: string;
  roomId: string;
  desire: { desireType: string; desireContent: string; desireReason?: string };
  timestamp: number;
}

class NpcReactionManager {
  // Track recent NPC-to-player conversations (for determining who should respond)
  private recentConversations: Map<string, ConversationContext> = new Map(); // key: `${roomId}-${playerId}`
  private conversationTimeout = 30000; // 30 seconds to consider it the same conversation

  // Track pending quest offers (NPC offered quest, waiting for player to accept)
  private pendingQuestOffers: Map<string, PendingQuestOffer> = new Map(); // key: `${roomId}-${playerId}`
  private questOfferTimeout = 60000; // 60 seconds to accept a quest offer
  // Common greeting words that should prompt NPC responses
  private greetingPatterns = [
    'hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon',
    'good evening', 'good day', 'howdy', 'nice day', 'fine day', 'well met',
    'morning', 'afternoon', 'evening', 'fellows', 'friends', 'everyone',
    'hail', 'salutations', 'travelers', 'travellers', 'good folk', 'hullo',
    'gentlemen', 'ladies', 'all', 'folks', 'hobbits', 'good sirs', 'sirs',
    'how do you do', 'pleased to meet', 'nice to meet', 'good to see'
  ];

  // Question patterns that invite response
  private questionPatterns = [
    '?', 'how are', 'what do you', 'anyone', 'somebody', 'does anyone',
    'can someone', 'who knows', 'what\'s', 'where is', 'have you'
  ];

  // Affirmative/response patterns that suggest answering a question
  private responsePatterns = [
    'yes', 'yeah', 'yep', 'certainly', 'of course', 'absolutely', 'indeed',
    'no', 'nope', 'never', 'not', 'i would', 'i will', 'i do', 'i am',
    'sure', 'okay', 'ok', 'alright', 'right', 'exactly', 'definitely',
    'i suppose', 'i think', 'i believe', 'perhaps', 'maybe', 'probably',
    'oh', 'ah', 'well', 'hmm', 'great', 'wonderful', 'lovely', 'fine',
    'that sounds', 'sounds good', 'sounds like', 'i see', 'i understand',
    'thank you', 'thanks', 'please', 'allow me', 'let me', 'i can', 'i could',
    'why', 'how', 'what', 'when', 'where', 'who', 'really', 'truly'
  ];

  // Quest acceptance patterns - player agreeing to help
  private questAcceptPatterns = [
    'yes', 'yeah', 'yep', 'sure', 'okay', 'ok', 'alright',
    'i can help', 'i\'ll help', 'i will help', 'i can do that',
    'i\'ll do it', 'i will do it', 'count me in', 'happy to help',
    'of course', 'certainly', 'absolutely', 'gladly', 'definitely',
    'what do you need', 'tell me more', 'what is it', 'go on',
    'how can i help', 'what can i do', 'sure thing', 'you got it',
    'no problem', 'i\'m in', 'let\'s do it', 'sounds good'
  ];

  // Quest decline patterns - player refusing
  private questDeclinePatterns = [
    'no', 'nope', 'nah', 'no thanks', 'not now', 'not interested',
    'can\'t', 'cannot', 'i can\'t', 'too busy', 'maybe later',
    'sorry', 'afraid not', 'not right now', 'pass', 'i\'ll pass'
  ];

  /**
   * Record that an NPC spoke to a player (for conversation tracking)
   */
  recordNpcSpokeToPlayer(roomId: string, npcId: number, npcName: string, playerId: number, message: string): void {
    const key = `${roomId}-${playerId}`;
    this.recentConversations.set(key, {
      npcId,
      npcName,
      playerId,
      lastMessage: message,
      timestamp: Date.now(),
    });

    // Clean up old conversations
    this.cleanupOldConversations();
  }

  /**
   * Get the NPC who recently spoke to this player (if any)
   */
  getRecentConversationPartner(roomId: string, playerId: number): ConversationContext | null {
    const key = `${roomId}-${playerId}`;
    const context = this.recentConversations.get(key);

    if (!context) return null;

    // Check if conversation is still fresh
    if (Date.now() - context.timestamp > this.conversationTimeout) {
      this.recentConversations.delete(key);
      return null;
    }

    return context;
  }

  /**
   * Check if a message looks like a response to a previous question/statement
   */
  private looksLikeResponse(content: string): boolean {
    const lower = content.toLowerCase().trim();

    // Check for response patterns anywhere in the message
    if (this.responsePatterns.some(p => lower.includes(p))) {
      return true;
    }

    // Short messages (under 10 words) are often responses
    if (lower.split(' ').length <= 10) {
      return true;
    }

    // Starts with common response starters
    const firstWord = lower.split(' ')[0];
    const responseStarters = [
      'yes', 'yeah', 'no', 'nope', 'sure', 'certainly', 'absolutely', 'indeed',
      'okay', 'ok', 'oh', 'ah', 'well', 'hmm', 'i', 'that', 'it', 'why', 'how',
      'what', 'when', 'where', 'who', 'really', 'actually', 'perhaps', 'maybe'
    ];
    if (responseStarters.includes(firstWord)) {
      return true;
    }

    return false;
  }

  private cleanupOldConversations(): void {
    const now = Date.now();
    for (const [key, context] of this.recentConversations.entries()) {
      if (now - context.timestamp > this.conversationTimeout) {
        this.recentConversations.delete(key);
      }
    }
    // Also cleanup old quest offers
    for (const [key, offer] of this.pendingQuestOffers.entries()) {
      if (now - offer.timestamp > this.questOfferTimeout) {
        this.pendingQuestOffers.delete(key);
      }
    }
  }

  /**
   * Check if player is accepting a quest offer
   */
  private isAcceptingQuest(content: string): boolean {
    const lower = content.toLowerCase().trim();
    return this.questAcceptPatterns.some(p => lower.includes(p));
  }

  /**
   * Check if player is declining a quest offer
   */
  private isDecliningQuest(content: string): boolean {
    const lower = content.toLowerCase().trim();
    // Only match decline if it's at the start or is the whole message
    return this.questDeclinePatterns.some(p =>
      lower === p || lower.startsWith(p + ' ') || lower.startsWith(p + ',')
    );
  }

  /**
   * Get pending quest offer for a player in a room
   */
  private getPendingQuestOffer(roomId: string, playerId: number): PendingQuestOffer | null {
    const key = `${roomId}-${playerId}`;
    const offer = this.pendingQuestOffers.get(key);
    if (!offer) return null;

    // Check if still valid
    if (Date.now() - offer.timestamp > this.questOfferTimeout) {
      this.pendingQuestOffers.delete(key);
      return null;
    }
    return offer;
  }

  /**
   * Store a pending quest offer
   */
  private storePendingQuestOffer(offer: PendingQuestOffer): void {
    const key = `${offer.roomId}-${offer.playerId}`;
    this.pendingQuestOffers.set(key, offer);
  }

  /**
   * Clear a pending quest offer
   */
  private clearPendingQuestOffer(roomId: string, playerId: number): void {
    const key = `${roomId}-${playerId}`;
    this.pendingQuestOffers.delete(key);
  }

  /**
   * Determine if an NPC should react to a witnessed event
   * Returns probability 0-100 that NPC will react
   */
  getReactionProbability(npc: NpcTemplate, event: WitnessedEvent): number {
    // 100% if directly addressed
    if (event.target?.type === 'npc' && event.target.id === npc.id) {
      return 100;
    }

    const contentLower = event.content.toLowerCase();

    // High chance (85%) for greetings - polite hobbits respond to greetings!
    const isGreeting = this.greetingPatterns.some(pattern =>
      contentLower.includes(pattern)
    );
    if (isGreeting && event.actor.type === 'player') {
      return 85;
    }

    // High chance (75%) for questions directed at the room
    const isQuestion = this.questionPatterns.some(pattern =>
      contentLower.includes(pattern)
    );
    if (isQuestion && event.actor.type === 'player') {
      return 75;
    }

    // Medium-high chance (65%) for conversational engagement (statements that invite response)
    const isConversational = this.responsePatterns.some(pattern =>
      contentLower.includes(pattern)
    );
    if (isConversational && event.actor.type === 'player') {
      return 65;
    }

    // Check if event mentions important topics for this NPC
    const mentionsImportantTopic = npc.importantTopics?.some(topic =>
      contentLower.includes(topic.toLowerCase())
    ) || false;

    if (mentionsImportantTopic) {
      // 80% chance if it's about something they care about
      return 80;
    }

    // Check if event mentions something related to NPC's current desire
    const desire = npcManager.getCurrentDesire(npc.id);
    if (desire && event.actor.type === 'player') {
      const desireKeywords = desire.desireContent.toLowerCase().split(' ');
      const mentionsDesire = desireKeywords.some(keyword =>
        keyword.length > 3 && contentLower.includes(keyword)
      );
      if (mentionsDesire) {
        // 90% chance if it's about something they want!
        return 90;
      }
    }

    // For general statements, use extroversion
    // Extroversion 0 = 5% chance, Extroversion 100 = 50% chance
    const baseChance = 5 + (npc.extroversion / 100) * 45;

    // Reduce chance if it's NPC-to-NPC that doesn't involve them
    if (event.actor.type === 'npc' && event.target?.type === 'npc') {
      return Math.floor(baseChance * 0.3); // 30% of normal chance
    }

    return Math.floor(baseChance);
  }

  /**
   * Process an event witnessed by NPCs in a room
   * NPCs may react based on their personality and whether they're addressed
   */
  async processWitnessedEvent(event: WitnessedEvent): Promise<void> {
    const npcsInRoom = npcManager.getNpcsInRoom(event.roomId);

    // Filter out the actor if they're an NPC
    const witnessingNpcs = npcsInRoom.filter(({ template }) => {
      if (event.actor.type === 'npc' && event.actor.id === template.id) {
        return false;
      }
      return true;
    });

    if (witnessingNpcs.length === 0) return;

    // PRIORITY 1: If event has an explicit NPC target (like from a social), that NPC must respond
    if (event.target?.type === 'npc') {
      const targetNpc = witnessingNpcs.find(({ template }) => template.id === event.target!.id);
      if (targetNpc) {
        gameLog.log('NPC', 'TARGETED', `${targetNpc.template.name} was directly targeted by ${event.actor.name}'s ${event.type}`, {
          content: event.content,
        });

        // 100% chance for explicitly targeted NPC to respond
        await this.generateNpcReaction(targetNpc.template, targetNpc.state, event, false);
        return;
      }
    }

    // Check if there's a recent conversation partner for this player
    const conversationPartner = event.actor.type === 'player'
      ? this.getRecentConversationPartner(event.roomId, event.actor.id)
      : null;

    // PRIORITY 2: Check if the player is explicitly addressing an NPC by name in their message
    const contentLower = event.content.toLowerCase();
    const addressedNpc = witnessingNpcs.find(({ template }) => {
      // Check if player used NPC's name or keywords at the start of the message
      const nameLower = template.name.toLowerCase();
      const firstName = nameLower.split(' ')[0];
      // Check if message starts with NPC name/keyword or contains "NPC," pattern
      return contentLower.startsWith(firstName) ||
             contentLower.startsWith(nameLower) ||
             template.keywords.some(k => contentLower.startsWith(k.toLowerCase())) ||
             contentLower.includes(firstName + ',') ||
             contentLower.includes(firstName + '?') ||
             contentLower.includes(firstName + '!');
    });

    // If player explicitly addressed an NPC by name, that NPC should respond
    if (addressedNpc && (!conversationPartner || addressedNpc.template.id !== conversationPartner.npcId)) {
      gameLog.log('NPC', 'ADDRESSED', `${addressedNpc.template.name} was directly addressed by ${event.actor.name}`, {
        content: event.content,
      });

      // 95% chance for the addressed NPC to respond
      const roll = Math.random() * 100;
      if (roll < 95) {
        await this.generateNpcReaction(addressedNpc.template, addressedNpc.state, event, false);
        return;
      }
    }

    // If there's a recent conversation partner (and player didn't address someone else), they should respond
    if (conversationPartner && event.actor.type === 'player') {
      const partnerNpc = witnessingNpcs.find(({ template }) => template.id === conversationPartner.npcId);

      if (partnerNpc) {
        // Check if this looks like a response OR if it's just a short/natural follow-up
        const isLikelyResponse = this.looksLikeResponse(event.content);

        gameLog.log('NPC', 'CONVERSATION', `${conversationPartner.npcName} continues conversation with ${event.actor.name}`, {
          response: event.content,
          previousMessage: conversationPartner.lastMessage,
          isLikelyResponse,
        });

        // The conversation partner gets very high chance to respond
        // 98% if it looks like a response, 85% for anything else (they were just talking)
        const responseChance = isLikelyResponse ? 98 : 85;
        const roll = Math.random() * 100;
        if (roll < responseChance) {
          await this.generateNpcReaction(partnerNpc.template, partnerNpc.state, event, true);
          return; // Don't let others interrupt the conversation
        }
      }
    }

    // Normal processing for non-responses or when conversation partner doesn't respond
    // Sort NPCs by relevance: those whose desires relate to the content come first
    const eventContentLower = event.content.toLowerCase();
    const sortedNpcs = [...witnessingNpcs].sort((a, b) => {
      const aDesire = npcManager.getCurrentDesire(a.template.id);
      const bDesire = npcManager.getCurrentDesire(b.template.id);

      const aRelevant = aDesire && aDesire.desireContent.toLowerCase().split(' ')
        .some(k => k.length > 3 && eventContentLower.includes(k));
      const bRelevant = bDesire && bDesire.desireContent.toLowerCase().split(' ')
        .some(k => k.length > 3 && eventContentLower.includes(k));

      if (aRelevant && !bRelevant) return -1;
      if (bRelevant && !aRelevant) return 1;
      return 0;
    });

    // Limit to one NPC responding to avoid chaos
    let hasResponded = false;

    for (const { template, state } of sortedNpcs) {
      if (hasResponded) {
        // After one NPC responds, others have much lower chance (10%)
        const roll = Math.random() * 100;
        if (roll > 10) continue;
      }

      const probability = this.getReactionProbability(template, event);
      const roll = Math.random() * 100;

      if (roll < probability) {
        // This NPC will react
        const didRespond = await this.generateNpcReaction(template, state, event);
        if (didRespond) {
          hasResponded = true;
        }
      }
    }
  }

  /**
   * Generate and send an NPC's reaction to an event
   * Returns true if the NPC actually said something
   */
  private async generateNpcReaction(
    npc: NpcTemplate,
    state: any,
    event: WitnessedEvent,
    isConversationContinuation: boolean = false
  ): Promise<boolean> {
    try {
      const isDirectlyAddressed = event.target?.type === 'npc' && event.target.id === npc.id;

      // FIRST: Check if there's a pending quest offer from this NPC to this player
      if (event.actor.type === 'player') {
        const pendingOffer = this.getPendingQuestOffer(event.roomId, event.actor.id);

        if (pendingOffer && pendingOffer.npcId === npc.id) {
          // Player is responding to a quest offer
          if (this.isAcceptingQuest(event.content)) {
            // Player accepted - give full quest details
            this.clearPendingQuestOffer(event.roomId, event.actor.id);
            return await this.generateQuestDetails(npc, event, pendingOffer.desire);
          } else if (this.isDecliningQuest(event.content)) {
            // Player declined
            this.clearPendingQuestOffer(event.roomId, event.actor.id);
            connectionManager.sendToRoom(event.roomId, {
              type: 'output',
              content: `\n${npc.name} says: "No worries, if you take my meaning. Perhaps another time."\n`,
            });
            this.recordNpcSpokeToPlayer(event.roomId, npc.id, npc.name, event.actor.id, "No worries, perhaps another time.");
            return true;
          }
          // If neither accept nor decline, continue with normal response
          // but the offer stays pending
        }
      }

      // Check if player is asking about work/quests and NPC has a desire
      const desire = npcManager.getCurrentDesire(npc.id);
      const isAskingAboutWork = geminiService.isAskingAboutWork(event.content);

      if (isAskingAboutWork && desire && event.actor.type === 'player') {
        // Offer the quest (hook only, wait for acceptance)
        return await this.offerQuest(npc, event, {
          desireType: desire.desireType,
          desireContent: desire.desireContent,
          desireReason: desire.desireReason || undefined,
        });
      }

      // Build context for the reaction
      const context = this.buildReactionContext(npc, state, event, isDirectlyAddressed, isConversationContinuation);

      // Generate the reaction via Gemini
      const reaction = await geminiService.generateNpcReaction(
        npc,
        event,
        context,
        isDirectlyAddressed || isConversationContinuation
      );

      if (reaction && reaction.trim()) {
        // Send the reaction to the room
        let message = '';
        if (reaction.startsWith('*') || reaction.startsWith('(')) {
          // It's an emote/action
          message = `\n${npc.name} ${reaction}\n`;
        } else {
          // It's speech
          message = `\n${npc.name} says: "${reaction}"\n`;
        }

        connectionManager.sendToRoom(event.roomId, {
          type: 'output',
          content: message,
        });

        // Log the reaction
        gameLog.log('NPC', 'REACT', `${npc.name} reacted to ${event.actor.name}'s ${event.type}`, {
          directlyAddressed: isDirectlyAddressed,
          conversationContinuation: isConversationContinuation,
        });

        // Record this as a conversation with the player (for continuity)
        if (event.actor.type === 'player') {
          this.recordNpcSpokeToPlayer(
            event.roomId,
            npc.id,
            npc.name,
            event.actor.id,
            reaction
          );

          // Store memory of the interaction
          npcManager.addMemory(
            npc.id,
            'player',
            event.actor.id,
            `Witnessed: ${event.content.substring(0, 50)}...`,
            isDirectlyAddressed || isConversationContinuation ? 6 : 3
          );
        }
        return true;
      }
      return false;
    } catch (error) {
      gameLog.error('NPC-REACTION', error);
      return false;
    }
  }

  /**
   * Offer a quest to the player - just a hook, wait for acceptance
   */
  private async offerQuest(
    npc: NpcTemplate,
    event: WitnessedEvent,
    desire: { desireType: string; desireContent: string; desireReason?: string }
  ): Promise<boolean> {
    try {
      // Generate a brief hook/offer using AI
      const hookMessage = await geminiService.generateQuestHook(npc, event.actor.name, desire);

      connectionManager.sendToRoom(event.roomId, {
        type: 'output',
        content: `\n${npc.name} says: "${hookMessage}"\n`,
      });

      // Store the pending quest offer
      if (event.actor.type === 'player') {
        this.storePendingQuestOffer({
          npcId: npc.id,
          npcName: npc.name,
          playerId: event.actor.id,
          playerName: event.actor.name,
          roomId: event.roomId,
          desire,
          timestamp: Date.now(),
        });

        this.recordNpcSpokeToPlayer(event.roomId, npc.id, npc.name, event.actor.id, hookMessage);
      }

      gameLog.log('NPC', 'QUEST-OFFER', `${npc.name} offered quest to ${event.actor.name}`, {
        desire: desire.desireContent,
      });

      return true;
    } catch (error) {
      gameLog.error('NPC-QUEST-OFFER', error);
      return false;
    }
  }

  /**
   * Generate full quest details after player accepts
   */
  private async generateQuestDetails(
    npc: NpcTemplate,
    event: WitnessedEvent,
    desire: { desireType: string; desireContent: string; desireReason?: string }
  ): Promise<boolean> {
    try {
      // Get item location info if it's an item quest
      let itemLocation: string | undefined;
      let directions: string | undefined;

      if (desire.desireType === 'item') {
        // Try to find the item using pathfinding
        const itemTemplate = this.findItemTemplateFromDesire(desire.desireContent);
        if (itemTemplate) {
          // Get NPC's current room
          const npcState = npcManager.getNpcState(npc.id);
          const npcRoom = npcState?.currentRoom || 'bag_end_garden';

          const locationInfo = worldManager.getItemLocationDescription(
            itemTemplate.id,
            npcRoom,
            'exact' // NPCs in the Shire know their local area well
          );

          if (locationInfo) {
            itemLocation = locationInfo.location;
            directions = locationInfo.directions;
          }
        }
      }

      const intro = await geminiService.generateQuestIntroduction(
        npc,
        event.actor.name,
        desire,
        itemLocation,
        directions
      );

      // Send the action if there is one
      if (intro.action) {
        connectionManager.sendToRoom(event.roomId, {
          type: 'output',
          content: `\n${npc.name} ${intro.action}\n`,
        });
        await this.delay(600);
      }

      // Send each message with a short delay between them
      for (let i = 0; i < intro.messages.length; i++) {
        const msg = intro.messages[i];
        connectionManager.sendToRoom(event.roomId, {
          type: 'output',
          content: `${npc.name} says: "${msg}"\n`,
        });

        // Record the last message for conversation continuity
        if (i === intro.messages.length - 1 && event.actor.type === 'player') {
          this.recordNpcSpokeToPlayer(
            event.roomId,
            npc.id,
            npc.name,
            event.actor.id,
            msg
          );
        }

        // Small delay between messages (but not after the last one)
        if (i < intro.messages.length - 1) {
          await this.delay(1000);
        }
      }

      // Log quest accepted
      gameLog.log('NPC', 'QUEST-ACCEPTED', `${event.actor.name} accepted quest from ${npc.name}`, {
        desire: desire.desireContent,
      });

      // Store memory
      if (event.actor.type === 'player') {
        npcManager.addMemory(
          npc.id,
          'player',
          event.actor.id,
          `Accepted quest: ${desire.desireContent}`,
          7
        );
      }

      return true;
    } catch (error) {
      gameLog.error('NPC-QUEST-DETAILS', error);
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Find an item template based on desire content
   * Matches keywords in the desire against item templates
   */
  private findItemTemplateFromDesire(desireContent: string): typeof ITEM_TEMPLATES[0] | null {
    const lower = desireContent.toLowerCase();

    // Try to find a matching item template
    for (const item of ITEM_TEMPLATES) {
      // Check if any of the item's keywords appear in the desire
      for (const keyword of item.keywords) {
        if (lower.includes(keyword.toLowerCase())) {
          return item;
        }
      }
      // Also check the item name
      if (lower.includes(item.name.toLowerCase())) {
        return item;
      }
    }

    return null;
  }

  /**
   * Build context for reaction generation
   */
  private buildReactionContext(
    npc: NpcTemplate,
    state: any,
    event: WitnessedEvent,
    isDirectlyAddressed: boolean,
    isConversationContinuation: boolean = false
  ): string {
    const parts: string[] = [];

    parts.push(`Current mood: ${state.mood}`);

    // Get NPC's current desire
    const desire = npcManager.getCurrentDesire(npc.id);
    const contentLower = event.content.toLowerCase();

    if (desire) {
      parts.push(`You want: ${desire.desireContent} (reason: ${desire.desireReason || 'personal reasons'})`);

      // Check if the conversation is about the NPC's desire
      const desireKeywords = desire.desireContent.toLowerCase().split(' ');
      const mentionsDesire = desireKeywords.some(keyword =>
        keyword.length > 3 && contentLower.includes(keyword)
      );

      if (mentionsDesire) {
        if (desire.desireType === 'item') {
          parts.push(`IMPORTANT: The player is asking about something related to what you want.`);
          parts.push(`If they ask about ${desire.desireContent}, tell them you need it and would appreciate their help getting it.`);
          parts.push(`If they ask if they can take it or have it, say YES - you want them to bring you a new/better one.`);
          parts.push(`Be clear and direct about what you want, not evasive.`);
        }
      }
    }

    // Check if the content relates to important topics
    const relevantTopics = npc.importantTopics?.filter(topic =>
      contentLower.includes(topic.toLowerCase())
    ) || [];
    if (relevantTopics.length > 0) {
      parts.push(`This relates to topics you care about: ${relevantTopics.join(', ')}`);
    }

    parts.push(`Your extroversion level: ${npc.extroversion}/100`);

    if (isConversationContinuation) {
      // Get previous context
      const prevContext = event.actor.type === 'player'
        ? this.getRecentConversationPartner(event.roomId, event.actor.id)
        : null;
      parts.push('You were just speaking with this person - continue the conversation naturally.');
      if (prevContext) {
        parts.push(`Your last words to them: "${prevContext.lastMessage}"`);
      }
      parts.push('This is their response to you - follow up appropriately.');
    } else if (isDirectlyAddressed) {
      parts.push('You are being directly addressed - you should respond.');
    } else {
      parts.push('You are overhearing this - react only if appropriate for your personality.');
    }

    return parts.join('\n');
  }
}

export const npcReactionManager = new NpcReactionManager();
export default npcReactionManager;
