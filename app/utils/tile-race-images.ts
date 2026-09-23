// Task-tile artwork for the tile race board. Task names are freeform prose
// ("60KC @ Barrows", "Punch Vorkath to death"), so tiles match by keyword
// against a dictionary of bosses/activities rather than by exact name.

interface ITileImageRule {
  keywords: string[];
  /** OSRS Wiki image filename (URL-encoded where needed). */
  image: string;
}

// First matching rule wins — specific names (Phosani, Corrupted Gauntlet)
// must sit above the generic words they contain (Nightmare, Gauntlet).
const TILE_IMAGE_RULES: ITileImageRule[] = [
  // Raids
  { keywords: ['corrupted gauntlet', 'cg', 'hunllef'], image: 'Corrupted_Hunllef.png' },
  { keywords: ['gauntlet'], image: 'The_Gauntlet.png' },
  { keywords: ['chambers of xeric', 'chambers', 'cox', 'olm'], image: 'Great_Olm.png' },
  { keywords: ['theatre of blood', 'theatre', 'tob', 'verzik'], image: 'Verzik_Vitur.png' },
  { keywords: ['tombs of amascut', 'tombs', 'toa', 'amascut', 'warden'], image: 'Tumeken%27s_Warden_(level-544).png' },
  { keywords: ['raid', 'raids'], image: 'Great_Olm.png' },
  // God Wars
  { keywords: ['bandos', 'graardor'], image: 'General_Graardor.png' },
  { keywords: ['armadyl', 'arma', 'kree'], image: 'Kree%27arra.png' },
  { keywords: ['saradomin', 'zilyana'], image: 'Commander_Zilyana.png' },
  { keywords: ['zamorak', 'kril', "k'ril"], image: 'K%27ril_Tsutsaroth.png' },
  { keywords: ['nex'], image: 'Nex.png' },
  { keywords: ['god wars', 'gwd'], image: 'General_Graardor.png' },
  // Wilderness
  { keywords: ['revenant', 'revenants', 'rev', 'revs'], image: 'Revenant_maledictus.png' },
  { keywords: ['callisto', 'artio'], image: 'Callisto.png' },
  { keywords: ['venenatis', 'spindel'], image: 'Venenatis.png' },
  { keywords: ["vet'ion", 'vetion', "calvar'ion", 'calvarion'], image: 'Vet%27ion.png' },
  { keywords: ['scorpia'], image: 'Scorpia.png' },
  { keywords: ['chaos elemental'], image: 'Chaos_Elemental.png' },
  { keywords: ['king black dragon', 'kbd'], image: 'King_Black_Dragon.png' },
  { keywords: ['corporeal beast', 'corp'], image: 'Corporeal_Beast.png' },
  // Slayer bosses
  { keywords: ['alchemical hydra', 'hydra'], image: 'Alchemical_Hydra_(serpentine).png' },
  { keywords: ['cerberus', 'cerb'], image: 'Cerberus.png' },
  { keywords: ['kraken'], image: 'Kraken.png' },
  { keywords: ['abyssal sire', 'sire'], image: 'Abyssal_Sire.png' },
  { keywords: ['thermonuclear', 'thermy', 'smoke devil'], image: 'Thermonuclear_smoke_devil.png' },
  { keywords: ['grotesque guardians', 'grotesque', 'dusk', 'dawn'], image: 'Dawn.png' },
  { keywords: ['araxxor', 'araxyte'], image: 'Araxxor.png' },
  { keywords: ['skotizo'], image: 'Skotizo.png' },
  { keywords: ['slayer'], image: 'Slayer_icon.png' },
  // World / quest bosses
  { keywords: ["phosani's nightmare", 'phosani'], image: 'The_Nightmare.png' },
  { keywords: ['nightmare'], image: 'The_Nightmare.png' },
  { keywords: ['vorkath'], image: 'Vorkath.png' },
  { keywords: ['zulrah'], image: 'Zulrah_(serpentine).png' },
  { keywords: ['muspah'], image: 'Phantom_Muspah_(ranged).png' },
  { keywords: ['vardorvis'], image: 'Vardorvis.png' },
  { keywords: ['leviathan'], image: 'The_Leviathan.png' },
  { keywords: ['whisperer'], image: 'The_Whisperer.png' },
  { keywords: ['duke sucellus', 'duke'], image: 'Duke_Sucellus.png' },
  { keywords: ['kalphite queen', 'kalphite', 'kq'], image: 'Kalphite_Queen.png' },
  { keywords: ['giant mole', 'mole'], image: 'Giant_Mole.png' },
  { keywords: ['dagannoth kings', 'dagannoth', 'dks'], image: 'Dagannoth_Rex.png' },
  { keywords: ['sarachnis'], image: 'Sarachnis.png' },
  { keywords: ['scurrius'], image: 'Scurrius.png' },
  { keywords: ['barrows'], image: 'Ahrim_the_Blighted.png' },
  { keywords: ['moons of peril', 'moons', 'perilous', 'lunar chest'], image: 'Eclipse_Moon.png' },
  { keywords: ['hueycoatl', 'huey'], image: 'The_Hueycoatl.png' },
  { keywords: ['amoxliatl'], image: 'Amoxliatl.png' },
  { keywords: ['yama'], image: 'Yama_chathead.png' },
  { keywords: ['chompy'], image: 'Chompy_bird.png' },
  // TzHaar
  { keywords: ['inferno', 'zuk'], image: 'TzKal-Zuk.png' },
  { keywords: ['fight cave', 'fight caves', 'jad'], image: 'TzTok-Jad.png' },
  { keywords: ['colosseum', 'sol heredit'], image: 'Sol_Heredit.png' },
  // Skilling activities
  // The Wintertodt page image is an animated gif; the pyromancer is the static stand-in.
  { keywords: ['wintertodt', 'todt'], image: 'Pyromancer.png' },
  { keywords: ['tempoross'], image: 'Tempoross.png' },
  { keywords: ['zalcano'], image: 'Zalcano.png' },
  // Clues
  { keywords: ['master clue'], image: 'Reward_casket_(master)_detail.png' },
  { keywords: ['elite clue'], image: 'Reward_casket_(elite)_detail.png' },
  { keywords: ['hard clue'], image: 'Reward_casket_(hard)_detail.png' },
  { keywords: ['clue', 'clues', 'casket', 'caskets'], image: 'Reward_casket_(hard)_detail.png' },
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compiled = TILE_IMAGE_RULES.map(rule => ({
  // Word boundaries keep short aliases honest: "cg" matches "3KC @ CG" but not "McGrubor".
  pattern: new RegExp(
    `(?:^|[^a-z0-9])(?:${rule.keywords.map(escapeRegExp).join('|')})(?=$|[^a-z0-9])`,
    'i',
  ),
  image: rule.image,
}));

/**
 * Wiki artwork for a task tile, matched by keyword against its name and
 * description (name wins when the two disagree). Null when nothing matches —
 * callers should render the plain tile rather than guess.
 */
export const getTileImageUrl = (
  name?: string,
  description?: string,
): string | null => {
  const match =
    compiled.find(rule => name && rule.pattern.test(name)) ??
    compiled.find(rule => description && rule.pattern.test(description));
  return match
    ? `https://oldschool.runescape.wiki/images/${match.image}`
    : null;
};
