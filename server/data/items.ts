import { ItemTemplate } from '../../shared/types';

export const ITEM_TEMPLATES: ItemTemplate[] = [
  // Consumables - Pipe-weed
  {
    id: 1,
    name: 'Old Toby',
    keywords: ['old toby', 'pipe-weed', 'tobacco', 'toby'],
    shortDesc: 'a pouch of Old Toby pipe-weed',
    longDesc: 'The finest pipe-weed in the Southfarthing, grown by the Hornblower family. Its aroma is rich and mellow.',
    itemType: 'consumable',
    weight: 1,
    value: 5,
    effects: [{ type: 'buff', value: 5, duration: 10 }],
  },
  {
    id: 2,
    name: 'Longbottom Leaf',
    keywords: ['longbottom', 'leaf', 'pipe-weed', 'tobacco'],
    shortDesc: 'a pouch of Longbottom Leaf',
    longDesc: 'Good quality pipe-weed from the Longbottom family. Not quite as fine as Old Toby, but respectable.',
    itemType: 'consumable',
    weight: 1,
    value: 3,
    effects: [{ type: 'buff', value: 3, duration: 10 }],
  },

  // Food
  {
    id: 3,
    name: 'seed-cake',
    keywords: ['seed-cake', 'cake', 'seed cake', 'seedcake'],
    shortDesc: 'a delicious seed-cake',
    longDesc: 'A small, round cake studded with seeds. A Shire specialty, perfect with tea.',
    itemType: 'food',
    weight: 1,
    value: 2,
    effects: [{ type: 'heal', value: 10 }],
  },
  {
    id: 4,
    name: 'bacon',
    keywords: ['bacon', 'rashers'],
    shortDesc: 'some crispy bacon',
    longDesc: 'Thick-cut bacon, fried to crispy perfection. No proper hobbit breakfast is complete without it.',
    itemType: 'food',
    weight: 1,
    value: 3,
    effects: [{ type: 'heal', value: 15 }],
  },
  {
    id: 5,
    name: 'mushrooms',
    keywords: ['mushrooms', 'shrooms'],
    shortDesc: 'some fresh mushrooms',
    longDesc: 'Large, white mushrooms - possibly from Farmer Maggot\'s fields. Best not to ask where they came from.',
    itemType: 'food',
    weight: 1,
    value: 4,
    effects: [{ type: 'heal', value: 12 }],
  },

  // Drinks
  {
    id: 6,
    name: 'ale',
    keywords: ['ale', 'beer', 'drink'],
    shortDesc: 'a mug of ale',
    longDesc: 'A foaming mug of the Green Dragon\'s finest ale. Golden, malty, and strong.',
    itemType: 'drink',
    weight: 1,
    value: 2,
    effects: [{ type: 'heal', value: 5 }, { type: 'buff', value: 2, duration: 5 }],
  },
  {
    id: 7,
    name: 'tea',
    keywords: ['tea', 'cuppa'],
    shortDesc: 'a cup of tea',
    longDesc: 'A proper cup of tea, hot and fragrant. Every civilized hobbit drinks tea.',
    itemType: 'drink',
    weight: 1,
    value: 1,
    effects: [{ type: 'heal', value: 3 }],
  },

  // Equipment
  {
    id: 8,
    name: 'walking stick',
    keywords: ['stick', 'walking stick', 'staff'],
    shortDesc: 'a sturdy walking stick',
    longDesc: 'A well-worn walking stick of ash wood, perfect for long walks and the occasional prod.',
    itemType: 'equipment',
    weight: 2,
    value: 5,
  },
  {
    id: 9,
    name: 'waistcoat',
    keywords: ['waistcoat', 'vest'],
    shortDesc: 'a fine waistcoat',
    longDesc: 'An embroidered waistcoat in dark green velvet with brass buttons. Very respectable.',
    itemType: 'equipment',
    weight: 1,
    value: 15,
  },
  {
    id: 10,
    name: 'cloak',
    keywords: ['cloak', 'travelling cloak'],
    shortDesc: 'a travelling cloak',
    longDesc: 'A warm woolen cloak with a hood, suitable for travel in uncertain weather.',
    itemType: 'equipment',
    weight: 2,
    value: 10,
  },
  {
    id: 11,
    name: 'pipe',
    keywords: ['pipe', 'smoking pipe'],
    shortDesc: 'a clay pipe',
    longDesc: 'A long-stemmed clay pipe, well-seasoned from years of use. Essential for any hobbit.',
    itemType: 'equipment',
    weight: 1,
    value: 3,
  },

  // Quest Items
  {
    id: 12,
    name: "Thrór's Map",
    keywords: ['map', 'thror', 'thrór', 'thrors map'],
    shortDesc: 'an ancient map with dwarvish runes',
    longDesc: 'An old, yellowed map showing a mountain with a dragon above it. Strange runes mark a secret entrance. Moon-letters, invisible to normal sight, hint at hidden secrets.',
    itemType: 'quest',
    weight: 1,
    value: 0, // Priceless
  },
  {
    id: 13,
    name: "Thrór's Key",
    keywords: ['key', 'thror', 'thrór', 'thrors key'],
    shortDesc: 'an ornate dwarvish key',
    longDesc: 'A silver key of dwarvish make, ancient and intricate. It clearly opens something important.',
    itemType: 'quest',
    weight: 1,
    value: 0, // Priceless
  },
  {
    id: 14,
    name: 'contract',
    keywords: ['contract', 'burglar contract', 'agreement'],
    shortDesc: 'a lengthy contract',
    longDesc: 'A multi-page contract outlining the terms of employment for one Burglar. Includes clauses about funeral arrangements, cash on delivery, and division of profits (one fourteenth).',
    itemType: 'quest',
    weight: 1,
    value: 0,
  },

  // Valuable Items
  {
    id: 15,
    name: 'silver spoons',
    keywords: ['spoons', 'silver', 'silver spoons', 'cutlery'],
    shortDesc: 'a set of silver spoons',
    longDesc: 'Fine silver spoons bearing the Baggins family crest. Lobelia Sackville-Baggins has her eye on these.',
    itemType: 'valuable',
    weight: 1,
    value: 50,
  },

  // Tools
  {
    id: 16,
    name: 'pruning shears',
    keywords: ['shears', 'pruning shears', 'garden shears', 'clippers'],
    shortDesc: 'a pair of pruning shears',
    longDesc: 'Sharp garden shears for trimming hedges and roses. The Gaffer would appreciate a new pair.',
    itemType: 'tool',
    weight: 1,
    value: 8,
  },

  // Special Items
  {
    id: 17,
    name: 'firework',
    keywords: ['firework', 'rocket', 'gandalf firework'],
    shortDesc: 'a Gandalf firework',
    longDesc: 'One of Gandalf\'s famous fireworks - a paper tube decorated with stars and moons. Handle with care!',
    itemType: 'special',
    weight: 1,
    value: 25,
    effects: [{ type: 'special', value: 1 }],
  },

  // Additional items for dynamic spawning
  {
    id: 18,
    name: 'bread',
    keywords: ['bread', 'loaf'],
    shortDesc: 'a loaf of fresh bread',
    longDesc: 'A crusty loaf of bread, still warm from the oven.',
    itemType: 'food',
    weight: 1,
    value: 2,
    effects: [{ type: 'heal', value: 8 }],
  },
  {
    id: 19,
    name: 'cheese',
    keywords: ['cheese', 'wheel'],
    shortDesc: 'a wedge of cheese',
    longDesc: 'A wedge of sharp yellow cheese from the Shire\'s finest dairy.',
    itemType: 'food',
    weight: 1,
    value: 3,
    effects: [{ type: 'heal', value: 10 }],
  },
  {
    id: 20,
    name: 'honey',
    keywords: ['honey', 'pot', 'honeypot'],
    shortDesc: 'a pot of honey',
    longDesc: 'Golden honey in a small clay pot. Sweet and delicious.',
    itemType: 'food',
    weight: 1,
    value: 4,
    effects: [{ type: 'heal', value: 8 }],
  },
  {
    id: 21,
    name: 'handkerchief',
    keywords: ['handkerchief', 'hanky'],
    shortDesc: 'a fine handkerchief',
    longDesc: 'A clean white handkerchief with embroidered edges. No respectable hobbit leaves home without one.',
    itemType: 'equipment',
    weight: 1,
    value: 1,
  },
  {
    id: 22,
    name: 'rope',
    keywords: ['rope', 'coil'],
    shortDesc: 'a coil of rope',
    longDesc: 'Strong hemp rope, useful for all manner of things.',
    itemType: 'equipment',
    weight: 3,
    value: 5,
  },
];

export function getItemTemplate(id: number): ItemTemplate | undefined {
  return ITEM_TEMPLATES.find(item => item.id === id);
}

export function getItemByKeyword(keyword: string): ItemTemplate | undefined {
  const lower = keyword.toLowerCase();
  return ITEM_TEMPLATES.find(item =>
    item.keywords.some(k => k.toLowerCase() === lower) ||
    item.name.toLowerCase().includes(lower)
  );
}

export default ITEM_TEMPLATES;
