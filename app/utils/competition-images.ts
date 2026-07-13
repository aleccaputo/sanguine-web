/**
 * Utility for getting OSRS Wiki images based on competition metrics
 */

const TITLE_CASE_LOWERCASE_WORDS = new Set(['of', 'the', 'a', 'an']);

/**
 * "theatre_of_blood_hard_mode" -> "Theatre of Blood Hard Mode";
 * acronym metrics (ehb, ehp) read fully uppercased.
 */
export const humanizeMetric = (metric: string | null) => {
  if (!metric) return 'Unknown';
  if (['ehb', 'ehp'].includes(metric)) return metric.toUpperCase();
  return metric
    .split('_')
    .map((part, i) => {
      if (!part.length) return part;
      if (i > 0 && TITLE_CASE_LOWERCASE_WORDS.has(part)) return part;
      return part[0].toUpperCase() + part.slice(1);
    })
    .join(' ');
};

// The transparent clan scythe from /public — the SVG sprite variant bakes in a dark
// square background, so raster fallbacks use this instead.
const SanguineLogo = '/sanguine_icon_small.png';

// Mapping for complex metric names to proper OSRS Wiki image names
const METRIC_TO_IMAGE_NAME: Record<string, string> = {
  // Bosses with special naming
  chambers_of_xeric: 'Chambers of Xeric',
  chambers_of_xeric_challenge_mode: 'Chambers of Xeric',
  theatre_of_blood: 'Theatre of Blood',
  theatre_of_blood_hard_mode: 'Theatre of Blood',
  tombs_of_amascut: 'Tombs of Amascut - Normal Mode icon',
  tombs_of_amascut_expert: 'Tombs of Amascut - Expert Mode icon',
  the_gauntlet: 'The Gauntlet',
  the_corrupted_gauntlet: 'Corrupted Gauntlet',
  king_black_dragon: 'King Black Dragon',
  chaos_elemental: 'Chaos Elemental',
  chaos_fanatic: 'Chaos Fanatic',
  crazy_archaeologist: 'Crazy Archaeologist',
  deranged_archaeologist: 'Deranged Archaeologist',
  thermonuclear_smoke_devil: 'Thermonuclear smoke devil',
  abyssal_sire: 'Abyssal Sire',
  alchemical_hydra: 'Alchemical Hydra',
  cerberus: 'Cerberus',
  kraken: 'Kraken',
  giant_mole: 'Giant Mole',
  kalphite_queen: 'Kalphite Queen',
  kree_arra: "Kree'arra",
  commander_zilyana: 'Commander Zilyana',
  general_graardor: 'General Graardor',
  k_ril_tsutsaroth: "K'ril Tsutsaroth",
  corporeal_beast: 'Corporeal Beast',
  zulrah: 'Zulrah',
  vorkath: 'Vorkath',
  scorpia: 'Scorpia',
  callisto: 'Callisto',
  venenatis: 'Venenatis',
  vet_ion: "Vet'ion",
  dagannoth_prime: 'Dagannoth Prime',
  dagannoth_rex: 'Dagannoth Rex',
  dagannoth_supreme: 'Dagannoth Supreme',
  yama: 'Yama',
  maggot_king: 'Maggot King',

  // Nightmare bosses
  nightmare: 'The Nightmare',
  phosanis_nightmare: "Phosani's Nightmare",

  // DT2 bosses
  duke_sucellus: 'Duke Sucellus',
  the_leviathan: 'The Leviathan',
  the_whisperer: 'The Whisperer',
  vardorvis: 'Vardorvis',

  // Skills - use skill names directly
  attack: 'Attack',
  defence: 'Defence',
  strength: 'Strength',
  hitpoints: 'Hitpoints',
  ranged: 'Ranged',
  prayer: 'Prayer',
  magic: 'Magic',
  cooking: 'Cooking',
  woodcutting: 'Woodcutting',
  fletching: 'Fletching',
  fishing: 'Fishing',
  firemaking: 'Firemaking',
  crafting: 'Crafting',
  smithing: 'Smithing',
  mining: 'Mining',
  herblore: 'Herblore',
  agility: 'Agility',
  thieving: 'Thieving',
  slayer: 'Slayer',
  farming: 'Farming',
  runecrafting: 'Runecraft',
  hunter: 'Hunter',
  construction: 'Construction',

  // Activities
  clue_scrolls_all: 'Clue scroll',
  clue_scrolls_beginner: 'Clue scroll (beginner)',
  clue_scrolls_easy: 'Clue scroll (easy)',
  clue_scrolls_medium: 'Clue scroll (medium)',
  clue_scrolls_hard: 'Clue scroll (hard)',
  clue_scrolls_elite: 'Clue scroll (elite)',
  clue_scrolls_master: 'Clue scroll (master)',

  // Special metrics - use Sanguine fallback
  overall: 'Sanguine fallback',
  ehp: 'Sanguine fallback',
  ehb: 'Sanguine fallback',
};

/**
 * Whether we have an explicit image mapping for a competition metric (vs. falling back).
 */
export function hasCompetitionImage(metric: string): boolean {
  return metric in METRIC_TO_IMAGE_NAME;
}

/**
 * Gets the OSRS Wiki image URL for a competition metric
 */
export function getCompetitionImageUrl(metric: string): string {
  const imageName = METRIC_TO_IMAGE_NAME[metric];

  if (!imageName) {
    // For unknown metrics, return the fallback
    return getFallbackImageUrl();
  }

  return getOSRSWikiImageUrl(imageName);
}

/**
 * Gets the OSRS Wiki image URL for a given image name
 */
function getOSRSWikiImageUrl(imageName: string): string {
  // Special cases that don't follow the _icon.png pattern
  const specialCases: Record<string, string> = {
    'Tombs of Amascut - Normal Mode icon': 'Tumeken%27s_Warden_(level-544).png',
    'Tombs of Amascut - Expert Mode icon': 'Tumeken%27s_Warden_(level-544).png',
    'Chambers of Xeric': 'Great_Olm.png',
    'Theatre of Blood': 'Verzik_Vitur.png',
    Yama: 'Yama_chathead.png',
    'Maggot King': 'Maggot_King.png',
    Callisto: 'Callisto_cub_chathead.png',
    "Phosani's Nightmare": 'The_Nightmare.png',
    Vardorvis: 'Vardorvis.png',
    'The Whisperer': 'The_Whisperer.png',
    'Chaos Elemental': 'Chaos_Elemental.png',
    'Chaos Fanatic': 'Chaos_Fanatic.png',
    'Crazy Archaeologist': 'Crazy_archaeologist.png',
    'Deranged Archaeologist': 'Deranged_archaeologist.png',
    Scorpia: 'Scorpia.png',
    Venenatis: 'Venenatis.png',
    'Dagannoth Prime': 'Dagannoth_Prime.png',
    'Dagannoth Rex': 'Dagannoth_Rex.png',
    'Dagannoth Supreme': 'Dagannoth_Supreme.png',
    'Duke Sucellus': 'Duke_Sucellus.png',
    'The Leviathan': 'The_Leviathan.png',
    'The Gauntlet': 'The_Gauntlet.png',
    'Corrupted Gauntlet': 'Corrupted_Hunllef.png',
    Zulrah: 'Zulrah_(serpentine).png',
    'Abyssal Sire': 'Abyssal_Sire.png',
    'Alchemical Hydra': 'Alchemical_Hydra_(serpentine).png',
    'Clue scroll': 'Reward_casket_(hard)_detail.png',
    'Clue scroll (easy)': 'Reward_casket_(easy)_detail.png',
    'Clue scroll (medium)': 'Reward_casket_(medium)_detail.png',
    'Clue scroll (hard)': 'Reward_casket_(hard)_detail.png',
    'Clue scroll (elite)': 'Reward_casket_(elite)_detail.png',
    'Clue scroll (master)': 'Reward_casket_(master)_detail.png',
    'Sanguine fallback': SanguineLogo,
  };

  if (specialCases[imageName]) {
    // If it's the Sanguine fallback, return the imported logo path directly
    if (imageName === 'Sanguine fallback') {
      return specialCases[imageName];
    }
    return `https://oldschool.runescape.wiki/images/${specialCases[imageName]}`;
  }

  // Default pattern: [Name]_icon.png
  const formattedName = imageName.replace(/\s+/g, '_');
  return `https://oldschool.runescape.wiki/images/${formattedName}_icon.png`;
}

/**
 * Alternative: Get skill icon specifically
 */
export function getSkillIconUrl(skillName: string): string {
  const formattedName = skillName.replace(/\s+/g, '_');
  return `https://oldschool.runescape.wiki/images/${formattedName}_icon.png`;
}

/**
 * Check if a metric represents a skill
 */
export function getMetricType(metric: string): string {
  const skills = [
    'attack',
    'defence',
    'strength',
    'hitpoints',
    'ranged',
    'prayer',
    'magic',
    'cooking',
    'woodcutting',
    'fletching',
    'fishing',
    'firemaking',
    'crafting',
    'smithing',
    'mining',
    'herblore',
    'agility',
    'thieving',
    'slayer',
    'farming',
    'runecrafting',
    'hunter',
    'construction',
    'overall',
  ];

  return skills.includes(metric)
    ? 'XP Gained'
    : metric == 'ehb'
      ? 'EHB'
      : 'Kills';
}

/**
 * Get fallback Sanguine logo for unknown metrics
 */
export function getFallbackImageUrl(): string {
  // Return the imported Sanguine logo path
  return SanguineLogo;
}

// Boss display names that need special wiki image filenames
const BOSS_IMAGE_OVERRIDES: Record<string, string> = {
  'Chambers of Xeric': 'Great_Olm.png',
  'Chambers of Xeric: Challenge Mode': 'Great_Olm.png',
  'Chambers of Xeric Challenge Mode': 'Great_Olm.png',
  'Theatre of Blood': 'Verzik_Vitur.png',
  'Theatre of Blood: Hard Mode': 'Verzik_Vitur.png',
  'Theatre of Blood Hard Mode': 'Verzik_Vitur.png',
  'Tombs of Amascut': 'Tumeken%27s_Warden_(level-544).png',
  'Tombs of Amascut: Expert Mode': 'Tumeken%27s_Warden_(level-544).png',
  'Tombs of Amascut Expert Mode': 'Tumeken%27s_Warden_(level-544).png',
  "Phosani's Nightmare": 'The_Nightmare.png',
  'The Gauntlet': 'The_Gauntlet.png',
  'The Corrupted Gauntlet': 'Corrupted_Hunllef.png',
  'Corrupted Gauntlet': 'Corrupted_Hunllef.png',
  'Crazy Archaeologist': 'Crazy_archaeologist.png',
  'Deranged Archaeologist': 'Deranged_archaeologist.png',
  Zulrah: 'Zulrah_(serpentine).png',
  Barrows: 'Ahrim_the_Blighted.png',
  'Lunar Chest': 'Eclipse_Moon.png',
  Araxyte: 'Araxyte_(lv_96).png',
  'Abyssal Sire': 'Abyssal_Sire.png',
  'abyssal sire': 'Abyssal_Sire.png',
  'Phantom Muspah': 'Phantom_Muspah_(ranged).png',
  'Alchemical Hydra': 'Alchemical_Hydra_(serpentine).png',
  'Clue Scroll (Beginner)': 'Reward_casket_(easy)_detail.png',
  'Clue Scroll (Easy)': 'Reward_casket_(easy)_detail.png',
  'Clue Scroll (Medium)': 'Reward_casket_(medium)_detail.png',
  'Clue Scroll (Hard)': 'Reward_casket_(hard)_detail.png',
  'Clue Scroll (Elite)': 'Reward_casket_(elite)_detail.png',
  'Clue Scroll (Master)': 'Reward_casket_(master)_detail.png',
  'Thermonuclear Smoke Devil': 'Thermonuclear_smoke_devil.png',
  'Dark Beast': 'Dark_beast.png',
  Nightmare: 'The_Nightmare.png',
  'Grotesque Guardians': 'Dawn.png',
  Hueycoatl: 'The_Hueycoatl.png',
  'The Fortis Colosseum': 'Fortis_Colosseum.png',
  'Moons of Peril': 'Perilous_Moons.png',
  'Reward pool (Tempoross)': 'Spirit_pool.png',
  Elf: 'Iorwerth_Warrior_(1).png',
  'Tormented Demon': 'Tormented_Demon_(1).png',
};

/**
 * Gets the OSRS Wiki image URL for a boss by its display name
 */
export function getBossImageUrl(bossName: string): string {
  if (bossName === 'Unknown') return SanguineLogo;

  const override = BOSS_IMAGE_OVERRIDES[bossName];
  if (override) {
    return `https://oldschool.runescape.wiki/images/${override}`;
  }

  const formatted = bossName.replace(/\s+/g, '_').replace(/'/g, '%27');
  return `https://oldschool.runescape.wiki/images/${formatted}.png`;
}
