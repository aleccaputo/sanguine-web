export const tileRules = [
  {
    title: 'DT2 Unique',
    rules: [
      {
        text: 'Virtus pieces, Axe pieces, Vestiges',
        type: 'allowed' as const,
      },
      { text: 'Ingots, quartz, teleports', type: 'prohibited' as const },
    ],
  },
  {
    title: '5 Slayer Boss Uniques',
    rules: [
      {
        text: 'Must be from boss itself (not regular monsters)',
        type: 'requirement' as const,
      },
      {
        text: 'Occult from Thermy ✓, from Smoke Devils ✗',
        type: 'example' as const,
      },
    ],
  },
  {
    title: "Full God D'hide",
    rules: [
      {
        text: 'Coif, body, legs, boots, vambraces',
        type: 'allowed' as const,
      },
      { text: 'Shield not required', type: 'prohibited' as const },
      {
        text: 'Mix gods allowed (Bandos + Guthix pieces)',
        type: 'note' as const,
      },
    ],
  },
  {
    title: 'Ornament Kit',
    rules: [{ text: 'Any tier clue scroll', type: 'allowed' as const }],
  },
  {
    title: 'Perilous Moons Set',
    rules: [
      { text: 'Full Blood Moon set + weapon', type: 'allowed' as const },
      { text: 'Mixing Blood + Blue pieces', type: 'prohibited' as const },
      {
        text: 'Must be complete set from ONE moon type',
        type: 'requirement' as const,
      },
    ],
  },
  {
    title: 'Nex Unique',
    rules: [
      { text: 'Includes Pet', type: 'allowed' as const },
      { text: 'Excludes Nihil Shards', type: 'prohibited' as const },
    ],
  },
  {
    title: 'Full Armadyl or Bandos',
    rules: [
      {
        text: 'Cannot mix Arma + Bandos pieces',
        type: 'prohibited' as const,
      },
      { text: 'Must be from ONE boss only', type: 'requirement' as const },
    ],
  },
  {
    title: '25M PK',
    rules: [
      {
        text: 'Wilderness only, multi-pking allowed',
        type: 'allowed' as const,
      },
      {
        text: 'No Bounty Hunter, no boosting friends',
        type: 'prohibited' as const,
      },
    ],
  },
  {
    title: '1M Budget Raid',
    rules: [
      {
        text: 'Untradables allowed (count hidden values)',
        type: 'allowed' as const,
      },
      {
        text: 'Screenshots before + after with Party Hub plugin',
        type: 'requirement' as const,
      },
    ],
  },
  {
    title: 'Complete Barrows Set',
    rules: [
      { text: "Full Guthan's or Full Dharok's", type: 'allowed' as const },
      { text: 'No mixing sets', type: 'prohibited' as const },
      { text: 'Full set from ONE brother', type: 'requirement' as const },
    ],
  },
  {
    title: 'Colosseum Unique',
    rules: [
      {
        text: 'Does NOT include Quiver or Sunfire Splinters',
        type: 'prohibited' as const,
      },
    ],
  },
  {
    title: 'Any Jar',
    rules: [
      {
        text: 'Any jar from any content (including Skotizo)',
        type: 'allowed' as const,
      },
      { text: 'Stacked totems allowed', type: 'allowed' as const },
    ],
  },
  {
    title: 'Nightmare Unique',
    rules: [
      {
        text: 'Does NOT include Parasitic egg or Tablet',
        type: 'prohibited' as const,
      },
    ],
  },
];
