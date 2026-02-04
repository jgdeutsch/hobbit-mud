import { NpcTemplate, NpcDesire } from '../../shared/types';

export const NPC_TEMPLATES: NpcTemplate[] = [
  // Core Shire NPCs
  {
    id: 1,
    name: 'Bilbo Baggins',
    keywords: ['bilbo', 'baggins', 'mr baggins', 'hobbit'],
    shortDesc: 'a respectable-looking hobbit in a fine waistcoat',
    longDesc: 'Bilbo Baggins stands here, looking fussy and slightly anxious. He wears an embroidered waistcoat and keeps checking his pocket watch. Despite his respectable appearance, there is something in his eyes - a hint of curiosity, perhaps, or the echo of adventures yet to come.',
    personality: 'Fussy, hospitable, secretly adventurous. Prizes respectability but yearns for something more. Proud of his home and possessions.',
    backstory: 'The most respectable hobbit in Hobbiton, Bilbo lives alone in Bag End, the finest hobbit-hole in the Shire. His mother Belladonna was a Took - a family known for being "adventurous." He has never done anything unexpected in his life. Until now.',
    speechStyle: 'Polite, slightly pompous, prone to exclaiming "Good gracious!" and "Bless my soul!" Uses proper grammar.',
    homeRoom: 'bag_end_hall',
    extroversion: 35, // Somewhat introverted, prefers peace and quiet
    importantTopics: ['bag end', 'adventure', 'dwarves', 'gandalf', 'respectability', 'tooks', 'baggins'],
  },
  {
    id: 2,
    name: 'Gandalf the Grey',
    keywords: ['gandalf', 'wizard', 'grey', 'old man'],
    shortDesc: 'a tall old man in a grey cloak and pointed hat',
    longDesc: 'Gandalf the Grey towers above hobbit-height, leaning on a gnarled staff. His grey cloak is travel-stained, his pointed blue hat somewhat battered. A long grey beard flows down his chest, and beneath bushy eyebrows, his eyes twinkle with hidden knowledge and mischief.',
    personality: 'Mysterious, twinkling, cryptic. Speaks in riddles. Knows more than he says. Has a plan but never explains it fully.',
    backstory: 'The wandering wizard, known throughout Middle-earth. He was once a friend of Bilbo\'s mother and has memories of Bilbo as a young hobbit. He has come to Hobbiton seeking... something.',
    speechStyle: 'Enigmatic, sometimes stern, often amused. Speaks in riddles and half-answers. "A wizard is never late..."',
    homeRoom: 'bag_end_garden',
    extroversion: 55, // Moderate - speaks when he has something important to say
    importantTopics: ['adventure', 'dwarves', 'thorin', 'erebor', 'dragon', 'smaug', 'burglar', 'quest', 'bilbo'],
  },
  {
    id: 3,
    name: 'Gaffer Gamgee',
    keywords: ['gaffer', 'gamgee', 'old gamgee', 'gardener'],
    shortDesc: 'a weathered old hobbit with dirt under his fingernails',
    longDesc: 'The Gaffer is a bent, weathered hobbit with hands like tree roots from decades of gardening. His clothes are practical and dirt-stained, but his eyes are sharp and miss nothing. He tends the gardens of Bag End with fierce pride.',
    personality: 'Grumbling but good-hearted. Loves gossip. Fiercely loyal to the Baggins family. Suspicious of anything unusual.',
    backstory: 'Hamfast "Gaffer" Gamgee has tended the gardens at Bag End for years. He lives at Number 3 Bagshot Row with his family, including young Samwise. He knows every plant in the Shire.',
    speechStyle: 'Rural Shire dialect. Complains constantly but means well. "Begging your pardon..." and "If you take my meaning."',
    homeRoom: 'bag_end_garden',
    extroversion: 70, // Loves to gossip and chat
    importantTopics: ['garden', 'potatoes', 'plants', 'bilbo', 'baggins', 'samwise', 'gossip', 'weather'],
  },
  {
    id: 4,
    name: 'Lobelia Sackville-Baggins',
    keywords: ['lobelia', 'sackville', 'sackville-baggins'],
    shortDesc: 'a sharp-featured hobbit woman with a disapproving expression',
    longDesc: 'Lobelia Sackville-Baggins surveys everything with the air of someone counting silver spoons. Her clothes are expensive but not quite as fine as she thinks. Her sharp eyes miss nothing of value, and her thin lips are usually pursed in disapproval.',
    personality: 'Nosy, covetous, sharp-tongued. Believes she should have inherited Bag End. Counts every spoon.',
    backstory: 'A relative of Bilbo who has long coveted Bag End. She married Otho Sackville-Baggins and together they scheme to get their hands on Bilbo\'s property. She is convinced Bilbo stole her rightful inheritance.',
    speechStyle: 'Snide, pointed remarks. Always implies she deserves better. "Well, I NEVER!" and passive-aggressive comments.',
    homeRoom: 'hobbiton_village',
    extroversion: 85, // Very nosy and loves to insert herself into conversations
    importantTopics: ['bag end', 'bilbo', 'spoons', 'silver', 'inheritance', 'property', 'baggins'],
  },
  {
    id: 5,
    name: 'Otho Sackville-Baggins',
    keywords: ['otho', 'sackville', 'sackville-baggins'],
    shortDesc: 'a pompous-looking hobbit with an enormous waistcoat',
    longDesc: 'Otho Sackville-Baggins puffs himself up importantly, his waistcoat straining at the buttons. He has the look of someone who believes himself to be much more important than he actually is.',
    personality: 'Pompous, scheming, always has an angle. Follows Lobelia\'s lead in most things.',
    backstory: 'Married to Lobelia, Otho shares her obsession with Bag End. He considers himself the rightful heir to everything Baggins.',
    speechStyle: 'Pompous, self-important. Clears his throat before speaking. Uses long words incorrectly.',
    homeRoom: 'hobbiton_village',
    extroversion: 65, // Pompous and likes to be heard
    importantTopics: ['bag end', 'bilbo', 'inheritance', 'property', 'baggins', 'lobelia'],
  },
  {
    id: 6,
    name: 'Farmer Maggot',
    keywords: ['farmer', 'maggot', 'farmer maggot'],
    shortDesc: 'a stern-faced hobbit farmer with muddy boots',
    longDesc: 'Farmer Maggot is a broad, sturdy hobbit with the weathered face of one who works the land. His expression is stern and suspicious, and three large dogs usually lurk nearby. He takes the protection of his mushrooms very seriously.',
    personality: 'Gruff, protective of his crops, suspicious of strangers. But fair and honest underneath.',
    backstory: 'The most respected farmer in the Marish. His mushrooms are legendary, and so is his temper when he catches anyone stealing them. He has three dogs: Grip, Fang, and Wolf.',
    speechStyle: 'Direct, blunt, country speech. Threatens trespassers but is hospitable to honest folk.',
    homeRoom: 'farmer_maggots_fields',
    extroversion: 40, // Gruff, doesn't talk much unless provoked
    importantTopics: ['mushrooms', 'thieves', 'crops', 'dogs', 'farm', 'trespassers'],
  },
  {
    id: 7,
    name: 'Ted Sandyman',
    keywords: ['ted', 'sandyman', 'miller'],
    shortDesc: 'a sour-faced hobbit covered in flour dust',
    longDesc: 'Ted Sandyman has the perpetually sour expression of someone who thinks the world owes him more. Flour dust covers his clothes, and his eyes hold a mean, suspicious glint.',
    personality: 'Rude, suspicious, thinks himself clever. Loves gossip but only the mean kind.',
    backstory: 'The miller\'s son, Ted runs Sandyman\'s Mill. He resents the Bagginses and their wealth, and spreads rumors about "mad Baggins."',
    speechStyle: 'Sneering, dismissive. Makes snide comments. "That\'s what I heard, anyway..."',
    homeRoom: 'the_mill',
    extroversion: 60, // Likes to spread gossip and make snide remarks
    importantTopics: ['bilbo', 'baggins', 'mad', 'gossip', 'mill', 'rumors'],
  },
  {
    id: 8,
    name: 'Green Dragon Innkeeper',
    keywords: ['innkeeper', 'barkeep', 'landlord'],
    shortDesc: 'a jolly, round-faced hobbit polishing a mug',
    longDesc: 'The innkeeper of the Green Dragon is as round and comfortable as his establishment. His face is red from the fire and good ale, and he always seems to be laughing at some private joke.',
    personality: 'Jolly, loves stories and songs, knows everyone\'s business. Generous with ale to good customers.',
    backstory: 'Has run the Green Dragon for decades. Knows every regular by name and drink preference. The hub of all Hobbiton gossip.',
    speechStyle: 'Cheerful, welcoming. "What\'ll it be?" and "Have you heard the one about..."',
    homeRoom: 'the_green_dragon',
    extroversion: 90, // Very sociable, loves to chat with everyone
    importantTopics: ['ale', 'stories', 'gossip', 'news', 'travelers', 'songs'],
  },
  {
    id: 9,
    name: 'Daddy Twofoot',
    keywords: ['daddy', 'twofoot', 'old twofoot'],
    shortDesc: 'an elderly hobbit dozing on a bench',
    longDesc: 'Daddy Twofoot is ancient even by hobbit standards, his face a map of wrinkles. He spends most of his time dozing on benches or shuffling between the village and his hobbit-hole.',
    personality: 'Elderly, kind, a bit confused about the present but sharp about the past. Loves company.',
    backstory: 'One of the oldest hobbits in Hobbiton. He remembers Bilbo\'s grandfather and tells stories of the old days to anyone who will listen.',
    speechStyle: 'Rambling, nostalgic. "In my day..." and "That reminds me of the time..."',
    homeRoom: 'hobbiton_village',
    extroversion: 75, // Lonely, loves company and talking
    importantTopics: ['old days', 'history', 'bilbo', 'grandfather', 'stories', 'tea'],
  },

  // THE THIRTEEN DWARVES
  // They arrive in groups at Bag End during the course of the evening
  {
    id: 10,
    name: 'Dwalin',
    keywords: ['dwalin', 'dwarf', 'tattooed dwarf'],
    shortDesc: 'a fierce-looking dwarf with a bald head covered in tattoos',
    longDesc: 'Dwalin is the most intimidating of the dwarves - tall for his kind, with a shaven head covered in dwarvish tattoos. His arms are like tree trunks, and he carries massive axes. Despite his fierce appearance, he bows politely.',
    personality: 'Fierce warrior, taciturn, loyal. Not much for small talk. Lets his axes do the talking.',
    backstory: 'Brother to Balin, Dwalin is a veteran warrior. He was one of the dwarves who fought at Azanulbizar and carries the scars proudly.',
    speechStyle: 'Gruff, few words. Grunts more than speaks. When he does talk, it\'s direct.',
    homeRoom: 'bag_end_hall',
    arrivalHour: 1,
    arrivalGroup: 'first',
    extroversion: 20, // Very taciturn
    importantTopics: ['battle', 'orcs', 'thorin', 'erebor', 'axes', 'fight'],
  },
  {
    id: 11,
    name: 'Balin',
    keywords: ['balin', 'dwarf', 'white-bearded dwarf'],
    shortDesc: 'an elderly dwarf with a long white beard',
    longDesc: 'Balin has a kindly face for a dwarf, with a long white beard and wise eyes. He carries himself with the dignity of age and experience, and seems the most approachable of the company.',
    personality: 'Wise, diplomatic, the voice of reason. Remembers the glory days of Erebor.',
    backstory: 'The eldest of the company besides Thorin, Balin remembers the Lonely Mountain before Smaug came. He serves as an advisor to Thorin.',
    speechStyle: 'Courteous, thoughtful. "At your service!" and measured, wise observations.',
    homeRoom: 'bag_end_hall',
    arrivalHour: 2,
    arrivalGroup: 'second',
    extroversion: 60, // Diplomatic and approachable
    importantTopics: ['erebor', 'thorin', 'quest', 'dwarves', 'mountain', 'smaug'],
  },
  {
    id: 12,
    name: 'Fíli',
    keywords: ['fili', 'dwarf', 'blonde dwarf'],
    shortDesc: 'a young blonde-haired dwarf with a ready smile',
    longDesc: 'Fíli is young and handsome for a dwarf, with blonde braided hair and a cheerful demeanor. He carries an impressive array of throwing knives hidden about his person.',
    personality: 'Young, brave, loyal to his uncle Thorin. Protective of his brother Kíli.',
    backstory: 'Nephew of Thorin Oakenshield, son of his sister Dís. He and his brother Kíli are the youngest of the company.',
    speechStyle: 'Eager, respectful but playful with his brother. Quick to laugh.',
    homeRoom: 'bag_end_hall',
    arrivalHour: 3,
    arrivalGroup: 'third',
    extroversion: 70, // Young and eager
    importantTopics: ['kili', 'thorin', 'adventure', 'knives', 'uncle'],
  },
  {
    id: 13,
    name: 'Kíli',
    keywords: ['kili', 'dwarf', 'dark-haired dwarf'],
    shortDesc: 'a young dark-haired dwarf with barely any beard',
    longDesc: 'Kíli is the youngest of the dwarves, with dark hair and only the beginning of a beard - a source of some embarrassment. He carries a bow, unusual for a dwarf.',
    personality: 'Youngest, most reckless, eager to prove himself. Devoted to his brother Fíli.',
    backstory: 'The younger nephew of Thorin, Kíli is skilled with a bow - an unusual weapon for a dwarf.',
    speechStyle: 'Enthusiastic, sometimes speaks before thinking. Looks up to his brother and uncle.',
    homeRoom: 'bag_end_hall',
    arrivalHour: 3,
    arrivalGroup: 'third',
    extroversion: 80, // Most enthusiastic
    importantTopics: ['fili', 'thorin', 'adventure', 'bow', 'beard'],
  },
  {
    id: 14,
    name: 'Dori',
    keywords: ['dori', 'dwarf', 'fussy dwarf'],
    shortDesc: 'a fussy-looking dwarf with elaborate braids',
    longDesc: 'Dori is the strongest of the dwarves, though he doesn\'t look it. His hair and beard are elaborately braided, and he has a somewhat fussy manner.',
    personality: 'Strongest dwarf, but also the most fussy about comfort. Protective of his brothers, especially Ori.',
    backstory: 'The eldest of three brothers, Dori feels responsible for Nori and especially young Ori.',
    speechStyle: 'Fretful, complaining but capable. Worries about proper meals and safety.',
    homeRoom: 'bag_end_hall',
    arrivalHour: 4,
    arrivalGroup: 'fourth',
    extroversion: 50, // Fussy but not overly talkative
    importantTopics: ['ori', 'nori', 'safety', 'comfort', 'food'],
  },
  {
    id: 15,
    name: 'Nori',
    keywords: ['nori', 'dwarf', 'star-haired dwarf'],
    shortDesc: 'a shifty-eyed dwarf with star-shaped hair',
    longDesc: 'Nori has his hair styled into distinctive star-like points. His eyes are shifty, and his fingers seem to move of their own accord toward anything valuable.',
    personality: 'The thief of the group. Sneaky, clever, always looking for an angle.',
    backstory: 'Middle brother of Dori and Ori. Has a somewhat questionable past that he doesn\'t discuss.',
    speechStyle: 'Evasive, always knows things he shouldn\'t. Changes the subject when asked direct questions.',
    homeRoom: 'bag_end_hall',
    arrivalHour: 4,
    arrivalGroup: 'fourth',
    extroversion: 35, // Sneaky, keeps to himself
    importantTopics: ['treasure', 'gold', 'valuables', 'secrets'],
  },
  {
    id: 16,
    name: 'Ori',
    keywords: ['ori', 'dwarf', 'young dwarf', 'scribe'],
    shortDesc: 'a young dwarf carrying a notebook and quill',
    longDesc: 'Ori is young and scholarly for a dwarf, always carrying a notebook in which he records everything. His knitted mittens are slightly too big for him.',
    personality: 'Youngest and most innocent. Always taking notes. Eager to learn and prove himself.',
    backstory: 'The youngest of the three brothers, Ori is the scribe of the company. He records their journey in detail.',
    speechStyle: 'Polite, curious, always asking questions. "May I write that down?"',
    homeRoom: 'bag_end_hall',
    arrivalHour: 4,
    arrivalGroup: 'fourth',
    extroversion: 55, // Curious and asks questions
    importantTopics: ['writing', 'notes', 'history', 'stories'],
  },
  {
    id: 17,
    name: 'Óin',
    keywords: ['oin', 'dwarf', 'deaf dwarf'],
    shortDesc: 'a grey-haired dwarf with an ear trumpet',
    longDesc: 'Óin is somewhat hard of hearing and carries an ear trumpet. He also serves as the company\'s healer, with a knowledge of herbs and medicines.',
    personality: 'Hard of hearing, knowledgeable about medicine and portents. Reads omens.',
    backstory: 'Brother to Glóin, Óin interprets signs and portents. He also has medical knowledge.',
    speechStyle: 'Speaks loudly. "Eh? What\'s that?" Prone to dramatic pronouncements about omens.',
    homeRoom: 'bag_end_hall',
    arrivalHour: 5,
    arrivalGroup: 'fifth',
    extroversion: 45, // Hard of hearing limits conversation
    importantTopics: ['omens', 'portents', 'medicine', 'healing'],
  },
  {
    id: 18,
    name: 'Glóin',
    keywords: ['gloin', 'dwarf', 'red-bearded dwarf'],
    shortDesc: 'a fierce red-bearded dwarf counting coins',
    longDesc: 'Glóin has a magnificent red beard and a fierce temper. He seems constantly concerned with finances and carries a heavy purse.',
    personality: 'Fierce, proud of his family, obsessed with gold and accounts. Has a young son he misses.',
    backstory: 'Brother to Óin, Glóin manages the company\'s finances. He has a son named Gimli back home.',
    speechStyle: 'Talks about money, family, and dwarvish honor. Proud and fierce.',
    homeRoom: 'bag_end_hall',
    arrivalHour: 5,
    arrivalGroup: 'fifth',
    extroversion: 55, // Proud and will speak about family/honor
    importantTopics: ['gold', 'money', 'gimli', 'family', 'honor'],
  },
  {
    id: 19,
    name: 'Bifur',
    keywords: ['bifur', 'dwarf', 'axe-head dwarf'],
    shortDesc: 'a wild-looking dwarf with an axe blade embedded in his head',
    longDesc: 'Bifur has a piece of orc axe blade permanently embedded in his forehead from an old battle. It has affected his speech - he can only speak ancient Khuzdul.',
    personality: 'Wild appearance but gentle nature. Cannot speak Westron due to his injury. Communicates with gestures.',
    backstory: 'Cousin to Bofur and Bombur. The axe in his head is from a battle with orcs long ago.',
    speechStyle: 'Speaks only Khuzdul (dwarvish). Gestures and grunts. Others translate for him.',
    homeRoom: 'bag_end_hall',
    arrivalHour: 5,
    arrivalGroup: 'fifth',
    extroversion: 25, // Can't speak Westron, limited communication
    importantTopics: ['bofur', 'bombur', 'orcs'],
  },
  {
    id: 20,
    name: 'Bofur',
    keywords: ['bofur', 'dwarf', 'hatted dwarf'],
    shortDesc: 'a cheerful dwarf in a funny hat with braided mustache',
    longDesc: 'Bofur wears a distinctive hat with earflaps and has a magnificently braided mustache. His expression is permanently cheerful.',
    personality: 'The optimist of the group. Always has a joke or song. Genuinely kind.',
    backstory: 'Cousin to Bifur and brother to Bombur. A miner by trade, but happy to be on an adventure.',
    speechStyle: 'Cheerful, joking, often singing. "Could be worse!" Always looks on the bright side.',
    homeRoom: 'bag_end_hall',
    arrivalHour: 5,
    arrivalGroup: 'fifth',
    extroversion: 85, // Most cheerful and talkative
    importantTopics: ['songs', 'jokes', 'adventure', 'mining'],
  },
  {
    id: 21,
    name: 'Bombur',
    keywords: ['bombur', 'dwarf', 'fat dwarf'],
    shortDesc: 'an enormously fat dwarf thinking about food',
    longDesc: 'Bombur is enormously fat, even by dwarf standards. His first thought is always of food, and his second thought is usually also of food.',
    personality: 'Obsessed with food. Sleepy, slow-moving, but reliable. Excellent cook.',
    backstory: 'Brother to Bofur and cousin to Bifur. He serves as the company\'s cook.',
    speechStyle: 'Always mentions food. "Is it dinner time?" Complains about being hungry.',
    homeRoom: 'bag_end_hall',
    arrivalHour: 5,
    arrivalGroup: 'fifth',
    extroversion: 40, // Mostly interested in food, not conversation
    importantTopics: ['food', 'dinner', 'breakfast', 'hungry', 'cooking'],
  },
  {
    id: 22,
    name: 'Thorin Oakenshield',
    keywords: ['thorin', 'oakenshield', 'dwarf king', 'dwarf lord'],
    shortDesc: 'a proud, kingly dwarf with a silver-streaked beard',
    longDesc: 'Thorin Oakenshield carries himself with unmistakable majesty. His dark hair is streaked with silver, his beard magnificent, and his eyes burn with a fierce determination. This is a dwarf who was born to be king.',
    personality: 'Proud, noble, brooding. Carries the weight of his people\'s exile. Slow to trust, fierce in loyalty.',
    backstory: 'Heir to the throne of Erebor, the Lonely Mountain, lost when the dragon Smaug came. He has sworn to reclaim his homeland and is gathering a company for the quest.',
    speechStyle: 'Formal, kingly, given to dramatic pronouncements. "I am Thorin, son of Thrain, son of Thror, King under the Mountain!"',
    homeRoom: 'bag_end_hall',
    arrivalHour: 6,
    arrivalGroup: 'final',
    extroversion: 30, // Brooding, speaks when necessary
    importantTopics: ['erebor', 'smaug', 'dragon', 'mountain', 'king', 'quest', 'burglar', 'thror', 'thrain'],
  },
];

// Initial desires for NPCs
export const INITIAL_DESIRES: Partial<NpcDesire>[] = [
  {
    npcTemplateId: 1, // Bilbo
    desireType: 'action',
    desireContent: 'Peace and quiet',
    desireReason: 'Just wants a normal, respectable day',
    priority: 5,
  },
  {
    npcTemplateId: 2, // Gandalf
    desireType: 'action',
    desireContent: 'Find a burglar for the dwarves',
    desireReason: 'The quest to Erebor needs a fourteenth member',
    priority: 9,
  },
  {
    npcTemplateId: 3, // Gaffer
    desireType: 'action',
    desireContent: 'Get shears sharpened',
    desireReason: 'His old pruning shears are dull and need sharpening at the mill',
    priority: 7,
  },
  {
    npcTemplateId: 4, // Lobelia
    desireType: 'item',
    desireContent: 'Bilbo\'s silver spoons',
    desireReason: 'Believes they should be hers by right',
    priority: 8,
  },
  {
    npcTemplateId: 5, // Otho
    desireType: 'action',
    desireContent: 'Inherit Bag End',
    desireReason: 'Considers himself the rightful heir',
    priority: 8,
  },
  {
    npcTemplateId: 6, // Farmer Maggot
    desireType: 'action',
    desireContent: 'Scare off mushroom thieves',
    desireReason: 'Tired of young hobbits stealing his crops',
    priority: 6,
  },
  {
    npcTemplateId: 7, // Ted Sandyman
    desireType: 'action',
    desireContent: 'More customers at the mill',
    desireReason: 'Business has been slow',
    priority: 5,
  },
  {
    npcTemplateId: 8, // Innkeeper
    desireType: 'information',
    desireContent: 'Good stories to tell',
    desireReason: 'Customers love a good tale with their ale',
    priority: 6,
  },
  {
    npcTemplateId: 9, // Daddy Twofoot
    desireType: 'company',
    desireContent: 'Someone to have tea with',
    desireReason: 'Gets lonely in his old age',
    priority: 7,
  },
  {
    npcTemplateId: 22, // Thorin
    desireType: 'action',
    desireContent: 'Reclaim Erebor from Smaug',
    desireReason: 'It is his birthright and destiny',
    priority: 10,
  },
];

// Knowledge that NPCs have about who can help with specific tasks
// This allows NPCs to refer players to the right person
export const NPC_KNOWLEDGE: Record<number, { knows: string[] }> = {
  // Gaffer knows about local services
  3: { // Gaffer Gamgee
    knows: [
      'Ted Sandyman at the Mill can sharpen tools and blades',
      'The Green Dragon Inn serves the best ale in Hobbiton',
      'Mr. Bilbo Baggins is the master of Bag End',
      'Farmer Maggot grows the finest mushrooms, but watch his dogs',
    ],
  },
  // Bilbo knows many things
  1: { // Bilbo
    knows: [
      'Gandalf the Grey is a wizard who visits from time to time',
      'The Gaffer tends the gardens here at Bag End',
      'Ted Sandyman runs the mill down by the Water',
      'The Green Dragon Inn is where hobbits gather for news',
    ],
  },
  // Gandalf knows much of the wider world
  2: { // Gandalf
    knows: [
      'The Gaffer knows every plant in the Shire',
      'Bilbo Baggins has more to him than meets the eye',
      'The dwarves seek a burglar for their quest',
      'Ted Sandyman at the mill is useful for practical matters',
    ],
  },
  // Ted Sandyman knows mill-related things
  7: { // Ted Sandyman
    knows: [
      'I can sharpen any blade or tool at my mill',
      'The Gaffer is always fussing about his garden tools',
      'Mad Baggins up on the hill has gold hidden, they say',
    ],
  },
  // Green Dragon Innkeeper knows gossip
  8: { // Innkeeper
    knows: [
      'The Gaffer comes in sometimes for an ale after gardening',
      'That Sandyman lad at the mill is a right gossip',
      'Mr. Bilbo throws the finest parties in the Shire',
      'Farmer Maggot\'s mushrooms are worth the risk of his dogs',
    ],
  },
};

// Get what an NPC knows that's relevant to a topic
export function getNpcKnowledge(npcId: number, topic?: string): string[] {
  const knowledge = NPC_KNOWLEDGE[npcId]?.knows || [];
  if (!topic) return knowledge;

  const topicLower = topic.toLowerCase();
  return knowledge.filter(k => k.toLowerCase().includes(topicLower));
}

export function getNpcTemplate(id: number): NpcTemplate | undefined {
  return NPC_TEMPLATES.find(npc => npc.id === id);
}

export function getNpcByKeyword(keyword: string): NpcTemplate | undefined {
  const lower = keyword.toLowerCase();
  return NPC_TEMPLATES.find(npc =>
    npc.keywords.some(k => k.toLowerCase() === lower) ||
    npc.name.toLowerCase().includes(lower)
  );
}

export function getDwarvesForHour(hour: number): NpcTemplate[] {
  return NPC_TEMPLATES.filter(npc => npc.arrivalHour === hour);
}

export default NPC_TEMPLATES;
