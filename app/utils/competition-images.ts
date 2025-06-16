/**
 * Utility for getting OSRS Wiki images based on competition metrics
 */

import SanguineLogo from '../../other/svg-icons/SanguineIcon.svg';

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
    'Tombs of Amascut - Normal Mode icon':
      'Tombs_of_Amascut_-_Normal_Mode_icon.png',
    'Tombs of Amascut - Expert Mode icon':
      'Tombs_of_Amascut_-_Expert_Mode_icon.png',
    'Chambers of Xeric': 'Great_Olm.png',
    Yama: 'Yama_chathead.png',
    Callisto: 'Callisto_cub_chathead.png',
    "Phosani's Nightmare": 'The_Nightmare.png',
    Vardorvis: 'Vardorvis.png',
    'The Whisperer': 'The_Whisperer.png',
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
export function isSkillMetric(metric: string): boolean {
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

  return skills.includes(metric);
}

/**
 * Get fallback Sanguine logo for unknown metrics
 */
export function getFallbackImageUrl(): string {
  // Return the imported Sanguine logo path
  return SanguineLogo;
}
