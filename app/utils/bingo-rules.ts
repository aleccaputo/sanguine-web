export const tileRules = [
  {
    title: 'Huey Uniques',
    rules: [
      {
        text: 'Hides count as 1 drop',
        type: 'note' as const,
      },
    ],
  },
  {
    title: 'CoX Uniques',
    rules: [
      {
        text: 'Excludes Prayer Scrolls',
        type: 'prohibited' as const,
      },
    ],
  },
  {
    title: 'Zulrah Unique',
    rules: [
      {
        text: 'Excludes Teleports and Scales',
        type: 'prohibited' as const,
      },
    ],
  },
  {
    title: 'PK Tile',
    rules: [
      {
        text: 'Must be legitimate PKs in the wilderness',
        type: 'requirement' as const,
      },
      {
        text: 'Solo or team PKs both allowed',
        type: 'allowed' as const,
      },
      {
        text: 'No paid actors or boosting',
        type: 'prohibited' as const,
      },
    ],
  },
  {
    title: 'Yama Unique',
    rules: [
      {
        text: 'Must be Oathplate piece or Horn',
        type: 'requirement' as const,
      },
      {
        text: 'No contracts allowed',
        type: 'prohibited' as const,
      },
    ],
  },
  {
    title: 'Nex Unique',
    rules: [
      {
        text: 'Excludes Nihil Shards',
        type: 'prohibited' as const,
      },
    ],
  },
  {
    title: 'ToB Uniques',
    rules: [
      {
        text: 'Must be purple chest',
        type: 'requirement' as const,
      },
      {
        text: 'Excludes Vials',
        type: 'prohibited' as const,
      },
    ],
  },
  {
    title: 'Complete Barrows Set',
    rules: [
      {
        text: 'Must be all from one set (full Guthans or full Dharoks)',
        type: 'requirement' as const,
      },
      {
        text: 'No mixing sets',
        type: 'prohibited' as const,
      },
    ],
  },
  {
    title: '8 Man Banana 5',
    rules: [
      {
        text: 'Must have 8 people from your team',
        type: 'requirement' as const,
      },
      {
        text: '5 invocation raid with "Jungle Japes" invocation active',
        type: 'requirement' as const,
      },
    ],
  },
  {
    title: 'Original GWD Uniques',
    rules: [
      {
        text: 'Bandos/Sara/Zammy/Arma Uniques all count',
        type: 'allowed' as const,
      },
      {
        text: 'Zamorakian Spear, Steam Battlestaff, Saradomin Sword count as 0.5 points',
        type: 'note' as const,
      },
      {
        text: 'All other drops count as 1 point',
        type: 'note' as const,
      },
    ],
  },
  {
    title: 'Perilous Moon Set',
    rules: [
      {
        text: 'Must be complete set from ONE moon type including weapon',
        type: 'requirement' as const,
      },
      {
        text: 'Cannot mix pieces from different moon types',
        type: 'prohibited' as const,
      },
    ],
  },
  {
    title: 'Nightmare Uniques',
    rules: [
      {
        text: 'Excludes Parasitic egg or Tablet',
        type: 'prohibited' as const,
      },
    ],
  },
  {
    title: 'TOA Uniques',
    rules: [
      {
        text: 'Only Purple chests',
        type: 'requirement' as const,
      },
      {
        text: 'Excludes gems/threads/etc.',
        type: 'prohibited' as const,
      },
    ],
  },
  {
    title: 'Colosseum Uniques',
    rules: [
      {
        text: 'Excludes Quiver or Sunfire Splinters',
        type: 'prohibited' as const,
      },
    ],
  },
  {
    title: 'PVM Pet',
    rules: [
      {
        text: 'Excludes Chompy Chick, Dom, Chaos Elemental, Skotizo',
        type: 'prohibited' as const,
      },
      {
        text: 'No pet contracts in Yama',
        type: 'prohibited' as const,
      },
      {
        text: 'Excludes non-PVM pets (Tiny Tempor, Phoenix, Lil Creator, etc.)',
        type: 'prohibited' as const,
      },
      {
        text: 'No gambling for pets (exchanging quivers, fire capes, infernal capes)',
        type: 'prohibited' as const,
      },
      {
        text: 'Can receive pet through content itself',
        type: 'allowed' as const,
      },
    ],
  },
];
