// Curated boss/activity catalog for the tile-race image picker. Items come from
// the wiki mapping search (osrs-wiki-prices-service); bosses and minigames have
// no such index, so they're enumerated here with a known-good wiki filename.

export interface ITileImageOption {
  label: string;
  imageUrl: string;
}

const wiki = (file: string) =>
  `https://oldschool.runescape.wiki/images/${file}`;

const BOSSES_AND_ACTIVITIES: [label: string, file: string][] = [
  // Raids
  ['Chambers of Xeric (Olm)', 'Great_Olm.png'],
  ['Theatre of Blood (Verzik)', 'Verzik_Vitur.png'],
  ['Tombs of Amascut (Wardens)', 'Tumeken%27s_Warden_(level-544).png'],
  // God Wars
  ['General Graardor', 'General_Graardor.png'],
  ["Kree'arra", 'Kree%27arra.png'],
  ['Commander Zilyana', 'Commander_Zilyana.png'],
  ["K'ril Tsutsaroth", 'K%27ril_Tsutsaroth.png'],
  ['Nex', 'Nex.png'],
  // Wilderness
  ['Revenant maledictus', 'Revenant_maledictus.png'],
  ['Callisto', 'Callisto.png'],
  ['Venenatis', 'Venenatis.png'],
  ["Vet'ion", 'Vet%27ion.png'],
  ['Scorpia', 'Scorpia.png'],
  ['Chaos Elemental', 'Chaos_Elemental.png'],
  ['Chaos Fanatic', 'Chaos_Fanatic.png'],
  ['Crazy Archaeologist', 'Crazy_archaeologist.png'],
  ['King Black Dragon', 'King_Black_Dragon.png'],
  ['Corporeal Beast', 'Corporeal_Beast.png'],
  // Slayer
  ['Alchemical Hydra', 'Alchemical_Hydra_(serpentine).png'],
  ['Cerberus', 'Cerberus.png'],
  ['Kraken', 'Kraken.png'],
  ['Abyssal Sire', 'Abyssal_Sire.png'],
  ['Thermonuclear smoke devil', 'Thermonuclear_smoke_devil.png'],
  ['Grotesque Guardians', 'Dawn.png'],
  ['Araxxor', 'Araxxor.png'],
  ['Skotizo', 'Skotizo.png'],
  ['Dark beast', 'Dark_beast.png'],
  // World bosses & DT2
  ['Vorkath', 'Vorkath.png'],
  ['Zulrah', 'Zulrah_(serpentine).png'],
  ['Phantom Muspah', 'Phantom_Muspah_(ranged).png'],
  ['The Nightmare', 'The_Nightmare.png'],
  ['Vardorvis', 'Vardorvis.png'],
  ['The Leviathan', 'The_Leviathan.png'],
  ['The Whisperer', 'The_Whisperer.png'],
  ['Duke Sucellus', 'Duke_Sucellus.png'],
  ['Kalphite Queen', 'Kalphite_Queen.png'],
  ['Giant Mole', 'Giant_Mole.png'],
  ['Dagannoth Rex', 'Dagannoth_Rex.png'],
  ['Dagannoth Prime', 'Dagannoth_Prime.png'],
  ['Dagannoth Supreme', 'Dagannoth_Supreme.png'],
  ['Sarachnis', 'Sarachnis.png'],
  ['Scurrius', 'Scurrius.png'],
  ['Barrows (Ahrim)', 'Ahrim_the_Blighted.png'],
  ['Moons of Peril (Eclipse Moon)', 'Eclipse_Moon.png'],
  ['The Hueycoatl', 'The_Hueycoatl.png'],
  ['Amoxliatl', 'Amoxliatl.png'],
  ['Yama', 'Yama_chathead.png'],
  ['The Gauntlet', 'The_Gauntlet.png'],
  ['Corrupted Hunllef', 'Corrupted_Hunllef.png'],
  ['Obor', 'Obor.png'],
  ['Bryophyta', 'Bryophyta.png'],
  ['The Mimic', 'The_Mimic.png'],
  ['Hespori', 'Hespori.png'],
  // TzHaar
  ['TzTok-Jad (Fight Caves)', 'TzTok-Jad.png'],
  ['TzKal-Zuk (Inferno)', 'TzKal-Zuk.png'],
  ['Sol Heredit (Colosseum)', 'Sol_Heredit.png'],
  // Skilling bosses / minigames
  ['Wintertodt (Pyromancer)', 'Pyromancer.png'],
  ['Tempoross', 'Tempoross.png'],
  ['Zalcano', 'Zalcano.png'],
  ['Chompy bird', 'Chompy_bird.png'],
  // Clues
  ['Reward casket (beginner)', 'Reward_casket_(beginner)_detail.png'],
  ['Reward casket (easy)', 'Reward_casket_(easy)_detail.png'],
  ['Reward casket (medium)', 'Reward_casket_(medium)_detail.png'],
  ['Reward casket (hard)', 'Reward_casket_(hard)_detail.png'],
  ['Reward casket (elite)', 'Reward_casket_(elite)_detail.png'],
  ['Reward casket (master)', 'Reward_casket_(master)_detail.png'],
];

/**
 * Boss/activity options whose label contains every query token. Sync and cheap
 * — the list is small; item search is the async half of the picker's results.
 */
export const searchBossImages = (
  query: string,
  limit: number,
): ITileImageOption[] => {
  const tokens = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return BOSSES_AND_ACTIVITIES.filter(([label]) => {
    const lower = label.toLocaleLowerCase();
    return tokens.every(token => lower.includes(token));
  })
    .slice(0, limit)
    .map(([label, file]) => ({ label, imageUrl: wiki(file) }));
};
