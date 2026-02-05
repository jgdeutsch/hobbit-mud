import { Room } from '../../shared/types';

export const ROOMS: Record<string, Room> = {
  // Bag End
  bag_end_garden: {
    id: 'bag_end_garden',
    name: 'Bag End Garden',
    description: `You stand in a well-tended garden before the most famous hobbit-hole in all the Shire. A perfectly round green door is set into the hillside, gleaming with fresh paint and a brass knob in the exact center. The garden is immaculate - flower beds burst with color, and vegetable patches show neat rows of beans and potatoes. A wooden bench sits beneath an old oak tree, and a gravel path leads to the road below.`,
    exits: {
      north: 'bag_end_hall',
      south: 'bagshot_row',
    },
    features: [
      {
        name: 'round door',
        keywords: ['door', 'green door', 'round door'],
        description: 'A perfectly round green door with a shiny brass knob in the exact center. It looks freshly painted and very respectable.',
        takeable: false,
      },
      {
        name: 'flower beds',
        keywords: ['flowers', 'flower beds', 'beds'],
        description: 'Snapdragons, marigolds, and nasturtiums bloom in cheerful profusion. The Gaffer keeps them in perfect order.',
        takeable: false,
      },
      {
        name: 'wooden bench',
        keywords: ['bench', 'wooden bench'],
        description: 'A comfortable wooden bench beneath the oak tree, perfect for smoking a pipe and watching the world go by.',
        takeable: false,
      },
      {
        name: 'vegetable patches',
        keywords: ['vegetables', 'patches', 'potatoes', 'beans'],
        description: 'Neat rows of potatoes, beans, and other vegetables. The Gaffer takes great pride in them.',
        takeable: false,
      },
      {
        name: 'garden shed',
        keywords: ['shed', 'garden shed', 'tool shed'],
        description: 'A small wooden shed tucked behind the vegetable patches. Inside you can see gardening tools - rakes, hoes, and a pair of old pruning shears hanging on a hook.',
        takeable: false,
      },
      {
        name: 'pruning shears',
        keywords: ['shears', 'pruning shears', 'old shears'],
        description: 'A pair of old pruning shears hanging in the shed. They look well-used but the blades are dull and nicked. The Gaffer could probably use a new pair.',
        takeable: true,
        itemTemplateId: 16,
      },
    ],
    items: [16], // Pruning shears in the shed
  },

  bag_end_hall: {
    id: 'bag_end_hall',
    name: 'Bag End - Hallway',
    description: `You enter the main hallway of Bag End, and it is everything a proper hobbit-hole should be. The walls are paneled in oak, the floor tiled in colorful patterns. Round passages lead off in several directions, and pegs line the walls for hanging cloaks and hats. A large grandfather clock ticks steadily in one corner, and the smell of good cooking wafts from somewhere deeper within.`,
    exits: {
      south: 'bag_end_garden',
      east: 'bag_end_parlour',
      west: 'bag_end_kitchen',
      north: 'bag_end_study',
    },
    features: [
      {
        name: 'coat pegs',
        keywords: ['pegs', 'coat pegs', 'cloaks'],
        description: 'Sturdy brass pegs for hanging cloaks and hats. Several well-worn walking sticks lean in the corner.',
        takeable: false,
      },
      {
        name: 'grandfather clock',
        keywords: ['clock', 'grandfather clock'],
        description: 'A handsome grandfather clock with a brass pendulum. It shows the time as perpetually "time for tea."',
        takeable: false,
      },
      {
        name: 'tiled floor',
        keywords: ['floor', 'tiles'],
        description: 'Colorful ceramic tiles in geometric patterns, polished to a shine.',
        takeable: false,
      },
    ],
    items: [8], // Walking stick
  },

  bag_end_kitchen: {
    id: 'bag_end_kitchen',
    name: 'Bag End - Kitchen',
    description: `The heart of any hobbit-hole! Copper pots hang from hooks, their bottoms blackened from years of use. A massive iron stove dominates one wall, always warm. Shelves groan under the weight of jars, bottles, and tins. The pantry door stands slightly ajar, revealing glimpses of cheese wheels, hanging hams, and casks of ale. A sturdy wooden table fills the center of the room, scored with countless knife marks.`,
    exits: {
      east: 'bag_end_hall',
    },
    features: [
      {
        name: 'copper pots',
        keywords: ['pots', 'copper pots', 'cookware'],
        description: 'An impressive collection of copper pots and pans, each one perfectly suited to its purpose.',
        takeable: false,
      },
      {
        name: 'iron stove',
        keywords: ['stove', 'iron stove', 'oven'],
        description: 'A massive black iron stove that radiates comfortable warmth. Something is always simmering on it.',
        takeable: false,
      },
      {
        name: 'pantry',
        keywords: ['pantry', 'pantry door'],
        description: 'The pantry is stocked for any occasion - cheeses, cold meats, pickles, preserves, casks of ale and bottles of wine. A hobbit could withstand a siege.',
        takeable: false,
      },
      {
        name: 'kitchen table',
        keywords: ['table', 'kitchen table', 'wooden table'],
        description: 'A massive oak table, its surface marked by generations of meal preparation.',
        takeable: false,
      },
    ],
    items: [3, 4, 7], // Seed-cake, bacon, tea
  },

  bag_end_parlour: {
    id: 'bag_end_parlour',
    name: 'Bag End - Parlour',
    description: `A cozy sitting room with deep armchairs arranged before a stone fireplace. The mantelpiece is cluttered with curiosities - a dwarvish candle-holder, an elvish brooch, strange coins from distant lands. Bookshelves line the walls between round windows that look out over the garden. A pipe-rack holds several fine pipes, and a jar of Old Toby sits on a side table.`,
    exits: {
      west: 'bag_end_hall',
    },
    features: [
      {
        name: 'fireplace',
        keywords: ['fireplace', 'fire', 'hearth'],
        description: 'A comfortable stone fireplace with a crackling fire. The warmth is perfect for dozing after second breakfast.',
        takeable: false,
      },
      {
        name: 'armchairs',
        keywords: ['chairs', 'armchairs'],
        description: 'Deep, comfortable armchairs upholstered in faded green velvet. Perfect for reading or napping.',
        takeable: false,
      },
      {
        name: 'mantelpiece curiosities',
        keywords: ['curiosities', 'mantelpiece', 'trinkets'],
        description: 'Souvenirs from Bilbo\'s parents\' adventures - dwarvish work, elvish crafts, and foreign coins that hint at stories untold.',
        takeable: false,
      },
      {
        name: 'pipe rack',
        keywords: ['pipes', 'pipe rack', 'rack'],
        description: 'A wooden rack holding several fine clay pipes of various sizes.',
        takeable: false,
      },
      {
        name: 'jar of Old Toby',
        keywords: ['old toby', 'pipe-weed', 'tobacco', 'jar'],
        description: 'A glass jar filled with the finest pipe-weed from the Southfarthing - Old Toby himself.',
        takeable: true,
        itemTemplateId: 1,
      },
    ],
    items: [1, 11], // Old Toby, Pipe
  },

  bag_end_study: {
    id: 'bag_end_study',
    name: 'Bag End - Study',
    description: `Bilbo's private study is cluttered with the detritus of a scholarly hobbit. Maps cover the walls - maps of the Shire, maps of Eriador, and one very old map with strange runes that looks like it belongs in a museum. A writing desk overflows with papers, quills, and half-written letters. Leather-bound books fill every available surface.`,
    exits: {
      south: 'bag_end_hall',
    },
    features: [
      {
        name: 'maps',
        keywords: ['maps', 'map'],
        description: 'Maps of all kinds cover the walls. Most show the Shire and surrounding lands, but one ancient map catches your eye - it shows a mountain and strange runes.',
        takeable: false,
      },
      {
        name: 'writing desk',
        keywords: ['desk', 'writing desk'],
        description: 'A proper writing desk cluttered with papers, quills, ink bottles, and sealing wax. Bilbo is clearly working on something.',
        takeable: false,
      },
      {
        name: 'leather books',
        keywords: ['books', 'leather books'],
        description: 'Books on every subject - history, geography, languages, and even a few volumes of elvish poetry.',
        takeable: false,
      },
    ],
    items: [],
  },

  // Bagshot Row and surroundings
  bagshot_row: {
    id: 'bagshot_row',
    name: 'Bagshot Row',
    description: `A pleasant lane runs along the base of the Hill, lined with modest hobbit-holes. Number 3, belonging to the Gamgees, has a particularly well-tended garden. Washing hangs on lines between holes, and the smell of cooking comes from several round windows. The lane leads south toward Hobbiton village and north up to Bag End.`,
    exits: {
      north: 'bag_end_garden',
      south: 'hobbiton_hill',
      west: 'the_water',
    },
    features: [
      {
        name: 'Gamgee garden',
        keywords: ['gamgee', 'number 3', 'garden'],
        description: 'The Gamgees\' garden at Number 3 is nearly as fine as Bag End\'s - perhaps even better in some respects. The Gaffer\'s expertise shows in every row.',
        takeable: false,
      },
      {
        name: 'hobbit-holes',
        keywords: ['holes', 'hobbit-holes', 'houses'],
        description: 'Comfortable hobbit-holes with round doors and windows, smoke rising from their chimneys.',
        takeable: false,
      },
    ],
    items: [],
  },

  hobbiton_hill: {
    id: 'hobbiton_hill',
    name: 'The Hill',
    description: `You stand on a gentle rise overlooking Hobbiton. The famous Party Tree stands nearby - a massive oak under which Bilbo holds his legendary birthday celebrations. Below, the village spreads out in a patchwork of gardens, lanes, and cozy hobbit-holes. Smoke rises from dozens of chimneys, and the sound of hobbits going about their business drifts up on the breeze.`,
    exits: {
      north: 'bagshot_row',
      south: 'hobbiton_village',
      east: 'party_field',
    },
    features: [
      {
        name: 'Party Tree',
        keywords: ['party tree', 'tree', 'oak'],
        description: 'An enormous oak tree, perfect for hanging lanterns and bunting. Many a fine party has been held beneath its spreading branches.',
        takeable: false,
      },
      {
        name: 'view of Hobbiton',
        keywords: ['view', 'hobbiton', 'village'],
        description: 'From here you can see all of Hobbiton spread out below - the mill, the Green Dragon, and countless comfortable hobbit-holes.',
        takeable: false,
      },
    ],
    items: [],
  },

  party_field: {
    id: 'party_field',
    name: 'The Party Field',
    description: `A large open field perfect for celebrations. The grass is kept short and even, and posts stand ready for tent ropes. The great Party Tree marks the western edge, its branches spreading wide. This is where Bilbo hosts his famous birthday parties, complete with fireworks, feasting, and dancing.`,
    exits: {
      west: 'hobbiton_hill',
    },
    features: [
      {
        name: 'tent posts',
        keywords: ['posts', 'tent posts'],
        description: 'Sturdy wooden posts driven into the ground, ready for the next celebration.',
        takeable: false,
      },
      {
        name: 'field',
        keywords: ['field', 'grass'],
        description: 'Well-maintained grass, perfect for dancing and games.',
        takeable: false,
      },
    ],
    items: [],
  },

  hobbiton_village: {
    id: 'hobbiton_village',
    name: 'Hobbiton Village',
    description: `The center of Hobbiton bustles with activity. Hobbits hurry between the market stalls and shops, exchanging gossip and goods. A well stands in the village square, surrounded by benches where elderly hobbits sit and watch the world go by. The Green Dragon inn dominates the south side of the square, its sign creaking in the breeze.`,
    exits: {
      north: 'hobbiton_hill',
      south: 'the_green_dragon',
      east: 'the_mill',
      west: 'bywater',
    },
    features: [
      {
        name: 'market stalls',
        keywords: ['market', 'stalls', 'shops'],
        description: 'Stalls selling everything a hobbit could want - vegetables, cheese, cloth, pottery, and of course, pipe-weed.',
        takeable: false,
      },
      {
        name: 'village well',
        keywords: ['well'],
        description: 'A stone well with a wooden roof and a bucket on a rope. The water is sweet and cold.',
        takeable: false,
      },
      {
        name: 'benches',
        keywords: ['benches', 'seats'],
        description: 'Worn wooden benches where hobbits gather to gossip and complain about the weather.',
        takeable: false,
      },
    ],
    items: [2], // Longbottom Leaf at market
  },

  the_green_dragon: {
    id: 'the_green_dragon',
    name: 'The Green Dragon Inn',
    description: `The finest inn in Hobbiton, famous for its ale and its gossip. A cheerful fire blazes in the great stone hearth, casting dancing shadows on the walls hung with old farming tools and hunting trophies. Long tables fill the common room, and the smell of roasting meat and fresh bread makes your mouth water. A bar runs along one wall, behind which barrels of the Dragon's famous ale are stacked.`,
    exits: {
      north: 'hobbiton_village',
    },
    features: [
      {
        name: 'great fireplace',
        keywords: ['fireplace', 'fire', 'hearth'],
        description: 'A massive stone fireplace with a roaring fire. The warmest spot in Hobbiton on a cold evening.',
        takeable: false,
      },
      {
        name: 'bar',
        keywords: ['bar', 'counter'],
        description: 'A long wooden bar, its surface polished by countless elbows. Behind it, barrels of the finest ale in the Shire.',
        takeable: false,
      },
      {
        name: 'ale barrels',
        keywords: ['barrels', 'ale', 'beer'],
        description: 'Oak barrels of the Green Dragon\'s famous ale. The best in the Shire, or so they say.',
        takeable: false,
      },
      {
        name: 'long tables',
        keywords: ['tables'],
        description: 'Long wooden tables with benches, perfect for large groups of drinking hobbits.',
        takeable: false,
      },
    ],
    items: [1, 6], // Old Toby, Ale
  },

  the_mill: {
    id: 'the_mill',
    name: "Sandyman's Mill",
    description: `The great water-wheel turns steadily, powered by the Water that flows past. The mill building is old but well-maintained, its stones dusted with flour. Sacks of grain are stacked outside waiting to be ground, and the rhythmic rumble of the millstones can be heard within. Ted Sandyman runs this place with a suspicious eye on every customer.`,
    exits: {
      west: 'hobbiton_village',
      south: 'the_water',
    },
    features: [
      {
        name: 'water wheel',
        keywords: ['wheel', 'water wheel', 'mill wheel'],
        description: 'A great wooden water wheel, turning steadily in the current. It powers the grinding stones within.',
        takeable: false,
      },
      {
        name: 'grain sacks',
        keywords: ['sacks', 'grain', 'flour'],
        description: 'Sacks of grain waiting to be ground, and sacks of flour ready for collection.',
        takeable: false,
      },
      {
        name: 'millstones',
        keywords: ['millstones', 'stones'],
        description: 'You can hear the great millstones grinding within, turning grain to flour.',
        takeable: false,
      },
    ],
    items: [16], // Pruning shears (tools available here)
  },

  the_water: {
    id: 'the_water',
    name: 'The Water',
    description: `A pleasant stream flows through Hobbiton, its waters clear and cold. Willows trail their branches in the current, and small fish dart between the rocks. A path follows the bank south toward Bywater, and stepping stones allow crossing to the west. This is a popular spot for young hobbits to fish and older ones to sit and think.`,
    exits: {
      north: 'the_mill',
      south: 'bywater_pool',
      east: 'bagshot_row',
    },
    features: [
      {
        name: 'willows',
        keywords: ['willows', 'willow trees', 'trees'],
        description: 'Graceful willow trees lean over the water, their trailing branches creating cool shade.',
        takeable: false,
      },
      {
        name: 'stepping stones',
        keywords: ['stepping stones', 'stones'],
        description: 'Flat stones set in the stream, allowing careful hobbits to cross without getting wet.',
        takeable: false,
      },
      {
        name: 'fish',
        keywords: ['fish'],
        description: 'Small fish dart between the rocks - minnows and perhaps a trout or two.',
        takeable: false,
      },
    ],
    items: [],
  },

  bywater: {
    id: 'bywater',
    name: 'Bywater',
    description: `A small village south of Hobbiton, quieter but no less comfortable. The road passes through on its way to distant places, and the occasional wagon rumbles by. Gardens here are perhaps even more elaborate than in Hobbiton - Bywater folk take great pride in their flowers. The Pool lies to the east, a favorite swimming spot.`,
    exits: {
      east: 'hobbiton_village',
      south: 'stock_road',
      west: 'bywater_pool',
    },
    features: [
      {
        name: 'elaborate gardens',
        keywords: ['gardens', 'flowers'],
        description: 'Bywater gardens are famous throughout the Shire. Roses, lilies, and flowers you can\'t even name grow in profusion.',
        takeable: false,
      },
      {
        name: 'road',
        keywords: ['road'],
        description: 'The main road continues south and west, toward places most hobbits never go.',
        takeable: false,
      },
    ],
    items: [],
  },

  bywater_pool: {
    id: 'bywater_pool',
    name: 'The Pool',
    description: `A wide, calm stretch of the Water forms a natural pool here, perfect for swimming on hot summer days. Willows line the banks, and a rickety wooden dock juts out over the water. Young hobbits splash and play while their elders sit on the bank, smoking pipes and pretending not to watch.`,
    exits: {
      north: 'the_water',
      east: 'bywater',
    },
    features: [
      {
        name: 'pool',
        keywords: ['pool', 'water', 'swimming hole'],
        description: 'The water is clear and deep enough for swimming, with a sandy bottom visible through the gentle ripples.',
        takeable: false,
      },
      {
        name: 'wooden dock',
        keywords: ['dock', 'pier'],
        description: 'A weathered wooden dock extends over the water. It creaks alarmingly but has held up for generations.',
        takeable: false,
      },
      {
        name: 'willow shade',
        keywords: ['willows', 'shade'],
        description: 'Ancient willows provide cool shade along the banks.',
        takeable: false,
      },
    ],
    items: [],
  },

  stock_road: {
    id: 'stock_road',
    name: 'The Stock Road',
    description: `The road stretches east toward Stock and the Brandywine Bridge. Few hobbits travel this way - it leads toward the edge of the Shire and beyond, to places that respectable folk don't think about. The woods press close on either side, and the comfortable sounds of Hobbiton fade behind you.`,
    exits: {
      north: 'bywater',
      east: 'woodhall',
    },
    features: [
      {
        name: 'woods',
        keywords: ['woods', 'forest', 'trees'],
        description: 'Dark woods crowd the road on either side. You think you see movement in the shadows, but it\'s probably just rabbits.',
        takeable: false,
      },
      {
        name: 'road',
        keywords: ['road'],
        description: 'A well-worn dirt road, rutted by wagon wheels. It continues east toward adventure.',
        takeable: false,
      },
    ],
    items: [],
  },

  woodhall: {
    id: 'woodhall',
    name: 'Woodhall',
    description: `A small hamlet at the edge of the woods. The houses here are simpler than in Hobbiton, and the hobbits more rustic. Mushrooms grow in abundance in the nearby woods - Farmer Maggot's fields are famous for them, though he guards them jealously. The Brandywine lies somewhere to the east.`,
    exits: {
      west: 'stock_road',
      east: 'bucklebury',
      south: 'farmer_maggots_fields',
    },
    features: [
      {
        name: 'simple houses',
        keywords: ['houses', 'homes'],
        description: 'These hobbit-holes are simpler than those in Hobbiton, more concerned with function than appearance.',
        takeable: false,
      },
      {
        name: 'mushroom woods',
        keywords: ['woods', 'mushrooms'],
        description: 'The woods here are famous for their mushrooms. But watch out for Farmer Maggot!',
        takeable: false,
      },
    ],
    items: [5], // Mushrooms
  },

  farmer_maggots_fields: {
    id: 'farmer_maggots_fields',
    name: "Farmer Maggot's Fields",
    description: `Rich farmland stretches in all directions, the soil dark and fertile. Rows of vegetables grow in military precision, and in the distance you can see fields of grain. But what catches your eye are the mushroom patches - enormous, succulent mushrooms that make your mouth water. A farmhouse stands nearby, and you hear dogs barking.`,
    exits: {
      north: 'woodhall',
    },
    features: [
      {
        name: 'mushroom patches',
        keywords: ['mushrooms', 'patches'],
        description: 'The finest mushrooms in the Shire grow here. Large, white, and perfect. But taking them without permission would be... unwise.',
        takeable: true,
        itemTemplateId: 5,
      },
      {
        name: 'farmhouse',
        keywords: ['farmhouse', 'house', 'farm'],
        description: 'A sturdy farmhouse with smoke rising from the chimney. Dogs prowl the yard.',
        takeable: false,
      },
      {
        name: 'vegetable rows',
        keywords: ['vegetables', 'crops', 'rows'],
        description: 'Perfectly tended rows of carrots, turnips, and potatoes.',
        takeable: false,
      },
    ],
    items: [5, 5, 5], // Lots of mushrooms
  },

  bucklebury: {
    id: 'bucklebury',
    name: 'Bucklebury',
    description: `The easternmost village of any size in the Shire, Bucklebury sits near the great Brandywine River. The Brandybucks, a numerous and somewhat eccentric family, dominate the area. Brandy Hall, their ancestral smial, burrows into the hillside. The ferry crossing lies to the east - beyond it, the Old Forest looms.`,
    exits: {
      west: 'woodhall',
      east: 'bucklebury_ferry',
    },
    features: [
      {
        name: 'Brandy Hall',
        keywords: ['brandy hall', 'hall', 'smial'],
        description: 'The great smial of the Brandybucks tunnels deep into the hillside. It\'s said to have over a hundred rooms.',
        takeable: false,
      },
      {
        name: 'village',
        keywords: ['village', 'buildings'],
        description: 'Bucklebury is smaller than Hobbiton but has its own charm. The hobbits here are known for being adventurous - relatively speaking.',
        takeable: false,
      },
    ],
    items: [],
  },

  bucklebury_ferry: {
    id: 'bucklebury_ferry',
    name: 'Bucklebury Ferry',
    description: `The ferry landing marks the edge of civilized hobbit-lands. A flat-bottomed boat waits to carry travelers across the Brandywine, though few hobbits ever use it. Across the wide, slow river, the Old Forest rises dark and foreboding. Most sensible hobbits turn back here. But for those with adventure in their hearts... the wider world awaits.`,
    exits: {
      west: 'bucklebury',
    },
    features: [
      {
        name: 'ferry',
        keywords: ['ferry', 'boat'],
        description: 'A sturdy flat-bottomed boat large enough for several hobbits. A rope system allows it to be pulled across.',
        takeable: false,
      },
      {
        name: 'Brandywine River',
        keywords: ['river', 'brandywine', 'water'],
        description: 'The great Brandywine flows slowly here, wide and deep. The far shore seems very far away indeed.',
        takeable: false,
      },
      {
        name: 'Old Forest',
        keywords: ['old forest', 'forest', 'trees'],
        description: 'Across the river, ancient trees crowd the shore. The Old Forest has an evil reputation - trees that move, paths that shift. No sensible hobbit goes there.',
        takeable: false,
      },
    ],
    items: [],
  },

  overhill: {
    id: 'overhill',
    name: 'Overhill',
    description: `A small village north of Hobbiton, quieter and more rural. The hobbits here tend sheep on the gentle hills and grow the finest pipe-weed in the north Shire. From the hilltops you can see for miles - on clear days, the towers of distant lands are visible on the horizon. Or so travelers claim.`,
    exits: {
      // Exit set dynamically below (southeast to hobbiton_hill)
    },
    features: [
      {
        name: 'sheep pastures',
        keywords: ['sheep', 'pastures', 'fields'],
        description: 'Gentle hills dotted with grazing sheep. The wool from Overhill is prized throughout the Shire.',
        takeable: false,
      },
      {
        name: 'hilltop view',
        keywords: ['view', 'hilltop', 'horizon'],
        description: 'From the highest points, you can see far beyond the Shire\'s borders. It makes you feel small and perhaps a bit curious.',
        takeable: false,
      },
      {
        name: 'pipe-weed fields',
        keywords: ['pipe-weed', 'tobacco', 'fields'],
        description: 'Fields of pipe-weed grow here, the broad leaves soaking up the northern sun.',
        takeable: false,
      },
    ],
    items: [2], // Longbottom Leaf
  },
};

// Add overhill as a separate exit (northwest) so it doesn't break the path to Bag End
// The north exit should remain as bagshot_row for the main path to Bag End
ROOMS.hobbiton_hill.exits.northwest = 'overhill';
// Fix: add exit back from overhill
ROOMS.overhill.exits.southeast = 'hobbiton_hill';

export function getRoom(roomId: string): Room | undefined {
  return ROOMS[roomId];
}

export function getAllRooms(): Room[] {
  return Object.values(ROOMS);
}

export default ROOMS;
