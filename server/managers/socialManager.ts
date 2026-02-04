import { getDb } from '../database';
import { SocialDefinition, Player } from '../../shared/types';
import geminiService from '../services/geminiService';

// Base hardcoded socials
const BASE_SOCIALS: SocialDefinition[] = [
  {
    name: 'smile',
    sentiment: 'friendly',
    noTargetSelf: 'You smile happily.',
    noTargetOthers: '{actor} smiles happily.',
    withTargetSelf: 'You smile at {target}.',
    withTargetTarget: '{actor} smiles at you.',
    withTargetOthers: '{actor} smiles at {target}.',
  },
  {
    name: 'grin',
    sentiment: 'playful',
    noTargetSelf: 'You grin mischievously.',
    noTargetOthers: '{actor} grins mischievously.',
    withTargetSelf: 'You grin at {target}.',
    withTargetTarget: '{actor} grins at you.',
    withTargetOthers: '{actor} grins at {target}.',
  },
  {
    name: 'laugh',
    sentiment: 'friendly',
    noTargetSelf: 'You laugh heartily.',
    noTargetOthers: '{actor} laughs heartily.',
    withTargetSelf: 'You laugh at {target}.',
    withTargetTarget: '{actor} laughs at you.',
    withTargetOthers: '{actor} laughs at {target}.',
  },
  {
    name: 'wave',
    sentiment: 'friendly',
    noTargetSelf: 'You wave.',
    noTargetOthers: '{actor} waves.',
    withTargetSelf: 'You wave at {target}.',
    withTargetTarget: '{actor} waves at you.',
    withTargetOthers: '{actor} waves at {target}.',
  },
  {
    name: 'bow',
    sentiment: 'friendly',
    noTargetSelf: 'You bow gracefully.',
    noTargetOthers: '{actor} bows gracefully.',
    withTargetSelf: 'You bow before {target}.',
    withTargetTarget: '{actor} bows before you.',
    withTargetOthers: '{actor} bows before {target}.',
  },
  {
    name: 'nod',
    sentiment: 'neutral',
    noTargetSelf: 'You nod.',
    noTargetOthers: '{actor} nods.',
    withTargetSelf: 'You nod at {target}.',
    withTargetTarget: '{actor} nods at you.',
    withTargetOthers: '{actor} nods at {target}.',
  },
  {
    name: 'hug',
    sentiment: 'friendly',
    noTargetSelf: 'You hug yourself.',
    noTargetOthers: '{actor} hugs themselves.',
    withTargetSelf: 'You hug {target} warmly.',
    withTargetTarget: '{actor} hugs you warmly.',
    withTargetOthers: '{actor} hugs {target} warmly.',
  },
  {
    name: 'shake',
    sentiment: 'friendly',
    noTargetSelf: 'You shake your head.',
    noTargetOthers: '{actor} shakes their head.',
    withTargetSelf: 'You shake hands with {target}.',
    withTargetTarget: '{actor} shakes your hand.',
    withTargetOthers: '{actor} shakes hands with {target}.',
  },
  {
    name: 'pat',
    sentiment: 'friendly',
    noTargetSelf: 'You pat yourself on the back.',
    noTargetOthers: '{actor} pats themselves on the back.',
    withTargetSelf: 'You pat {target} on the back.',
    withTargetTarget: '{actor} pats you on the back.',
    withTargetOthers: '{actor} pats {target} on the back.',
  },
  {
    name: 'poke',
    sentiment: 'playful',
    noTargetSelf: 'You poke yourself.',
    noTargetOthers: '{actor} pokes themselves.',
    withTargetSelf: 'You poke {target}.',
    withTargetTarget: '{actor} pokes you.',
    withTargetOthers: '{actor} pokes {target}.',
  },
  {
    name: 'frown',
    sentiment: 'hostile',
    noTargetSelf: 'You frown.',
    noTargetOthers: '{actor} frowns.',
    withTargetSelf: 'You frown at {target}.',
    withTargetTarget: '{actor} frowns at you.',
    withTargetOthers: '{actor} frowns at {target}.',
  },
  {
    name: 'sigh',
    sentiment: 'neutral',
    noTargetSelf: 'You sigh deeply.',
    noTargetOthers: '{actor} sighs deeply.',
    withTargetSelf: 'You sigh at {target}.',
    withTargetTarget: '{actor} sighs at you.',
    withTargetOthers: '{actor} sighs at {target}.',
  },
  {
    name: 'shrug',
    sentiment: 'neutral',
    noTargetSelf: 'You shrug.',
    noTargetOthers: '{actor} shrugs.',
    withTargetSelf: 'You shrug at {target}.',
    withTargetTarget: '{actor} shrugs at you.',
    withTargetOthers: '{actor} shrugs at {target}.',
  },
  {
    name: 'think',
    sentiment: 'neutral',
    noTargetSelf: 'You think deeply.',
    noTargetOthers: '{actor} appears to be deep in thought.',
    withTargetSelf: 'You think about {target}.',
    withTargetTarget: '{actor} appears to be thinking about you.',
    withTargetOthers: '{actor} appears to be thinking about {target}.',
  },
  {
    name: 'clap',
    sentiment: 'friendly',
    noTargetSelf: 'You clap your hands.',
    noTargetOthers: '{actor} claps their hands.',
    withTargetSelf: 'You clap for {target}.',
    withTargetTarget: '{actor} claps for you.',
    withTargetOthers: '{actor} claps for {target}.',
  },
  {
    name: 'cheer',
    sentiment: 'friendly',
    noTargetSelf: 'You cheer enthusiastically!',
    noTargetOthers: '{actor} cheers enthusiastically!',
    withTargetSelf: 'You cheer for {target}!',
    withTargetTarget: '{actor} cheers for you!',
    withTargetOthers: '{actor} cheers for {target}!',
  },
  {
    name: 'dance',
    sentiment: 'playful',
    noTargetSelf: 'You dance a merry jig.',
    noTargetOthers: '{actor} dances a merry jig.',
    withTargetSelf: 'You dance with {target}.',
    withTargetTarget: '{actor} dances with you.',
    withTargetOthers: '{actor} dances with {target}.',
  },
  {
    name: 'wink',
    sentiment: 'playful',
    noTargetSelf: 'You wink suggestively.',
    noTargetOthers: '{actor} winks suggestively.',
    withTargetSelf: 'You wink at {target}.',
    withTargetTarget: '{actor} winks at you.',
    withTargetOthers: '{actor} winks at {target}.',
  },
  {
    name: 'grumble',
    sentiment: 'hostile',
    noTargetSelf: 'You grumble under your breath.',
    noTargetOthers: '{actor} grumbles under their breath.',
    withTargetSelf: 'You grumble at {target}.',
    withTargetTarget: '{actor} grumbles at you.',
    withTargetOthers: '{actor} grumbles at {target}.',
  },
  {
    name: 'point',
    sentiment: 'neutral',
    noTargetSelf: 'You point into the distance.',
    noTargetOthers: '{actor} points into the distance.',
    withTargetSelf: 'You point a friendly finger at {target}.',
    withTargetTarget: '{actor} points a friendly finger at you.',
    withTargetOthers: '{actor} points a friendly finger at {target}.',
  },
  {
    name: 'yawn',
    sentiment: 'neutral',
    noTargetSelf: 'You yawn sleepily.',
    noTargetOthers: '{actor} yawns sleepily.',
    withTargetSelf: 'You yawn at {target}.',
    withTargetTarget: '{actor} yawns at you. How rude!',
    withTargetOthers: '{actor} yawns at {target}.',
  },
];

class SocialManager {
  private baseSocials: Map<string, SocialDefinition> = new Map();

  constructor() {
    // Load base socials into memory
    for (const social of BASE_SOCIALS) {
      this.baseSocials.set(social.name.toLowerCase(), social);
    }
  }

  // Get a social by name (check base socials first, then custom)
  getSocial(name: string): SocialDefinition | null {
    const lower = name.toLowerCase();

    // Check base socials
    const base = this.baseSocials.get(lower);
    if (base) return base;

    // Check custom socials in database
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM custom_socials WHERE LOWER(name) = ?')
      .get(lower) as any;

    if (row) {
      // Increment usage count
      db.prepare('UPDATE custom_socials SET usage_count = usage_count + 1 WHERE id = ?').run(row.id);

      return {
        name: row.name,
        sentiment: row.sentiment,
        noTargetSelf: row.no_target_self,
        noTargetOthers: row.no_target_others,
        withTargetSelf: row.with_target_self,
        withTargetTarget: row.with_target_target,
        withTargetOthers: row.with_target_others,
      };
    }

    return null;
  }

  // Check if a social exists
  socialExists(name: string): boolean {
    return this.getSocial(name) !== null;
  }

  // Add a custom social
  addCustomSocial(social: SocialDefinition, createdBy?: number): boolean {
    const db = getDb();

    try {
      db.prepare(
        `INSERT INTO custom_socials
         (name, sentiment, no_target_self, no_target_others, with_target_self, with_target_target, with_target_others, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        social.name.toLowerCase(),
        social.sentiment,
        social.noTargetSelf,
        social.noTargetOthers,
        social.withTargetSelf,
        social.withTargetTarget,
        social.withTargetOthers,
        createdBy || null
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  // Generate a new social using AI
  async generateSocial(name: string): Promise<SocialDefinition | null> {
    return geminiService.generateSocialEmote(name);
  }

  // Execute a social emote
  executeSocial(
    social: SocialDefinition,
    actorName: string,
    targetName?: string
  ): {
    actorMessage: string;
    targetMessage?: string;
    othersMessage: string;
  } {
    const replace = (text: string) =>
      text.replace(/{actor}/g, actorName).replace(/{target}/g, targetName || '');

    if (targetName) {
      return {
        actorMessage: replace(social.withTargetSelf),
        targetMessage: replace(social.withTargetTarget),
        othersMessage: replace(social.withTargetOthers),
      };
    } else {
      return {
        actorMessage: social.noTargetSelf,
        othersMessage: replace(social.noTargetOthers),
      };
    }
  }

  // Get list of all available socials
  getAllSocialNames(): string[] {
    const db = getDb();
    const customRows = db.prepare('SELECT name FROM custom_socials').all() as { name: string }[];

    const names = new Set<string>();

    // Add base socials
    for (const name of this.baseSocials.keys()) {
      names.add(name);
    }

    // Add custom socials
    for (const row of customRows) {
      names.add(row.name);
    }

    return Array.from(names).sort();
  }

  // Get base social list
  getBaseSocials(): SocialDefinition[] {
    return Array.from(this.baseSocials.values());
  }
}

export const socialManager = new SocialManager();
export default socialManager;
