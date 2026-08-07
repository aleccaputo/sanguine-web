import { faker } from '@faker-js/faker';

faker.seed(2026);

const BOSSES = [
  'zulrah',
  'vorkath',
  'cerberus',
  'commander_zilyana',
  'corporeal_beast',
  'kalphite_queen',
  'kraken',
  'abyssal_sire',
  'alchemical_hydra',
  'giant_mole',
  'general_graardor',
  "kree'arra",
  'king_black_dragon',
  'callisto',
  'venenatis',
  'vetion',
  'scorpia',
  'duke_sucellus',
  'the_leviathan',
  'the_whisperer',
  'vardorvis',
];
const RAIDS = ['chambers_of_xeric', 'theatre_of_blood', 'tombs_of_amascut'];
const SKILLS = [
  'slayer',
  'runecrafting',
  'construction',
  'agility',
  'cooking',
  'thieving',
  'mining',
  'smithing',
  'farming',
  'herblore',
];

const GROUP_ID = 18435;

export type MockUser = {
  discordId: string;
  nickname: string;
  joined: string;
  points: number;
  clanPoints: number;
  womRole: string;
  alts: { id: string; altName: string }[];
};

const buildUsers = (): MockUser[] => {
  // Real Sanguine rank names — anything else has no icon under /rank-icons.
  const roles = [
    'Owner',
    'Deputy_owner',
    'Administrator',
    'Moderator',
    'Blood',
    'Wrath',
    'Hellcat',
    'Beast',
    'Myth',
    'Legend',
    'Sage',
    'Natural',
    'Guest',
  ];
  return Array.from({ length: 30 }, (_, i) => {
    const id = faker.string.numeric(18);
    const nickname = faker.internet.username().slice(0, 12).replace(/\./g, '_');
    const altCount = faker.helpers.weightedArrayElement([
      { value: 0, weight: 8 },
      { value: 1, weight: 3 },
      { value: 2, weight: 1 },
    ]);
    return {
      discordId: id,
      nickname,
      joined: faker.date
        .between({ from: '2020-01-01', to: '2024-12-31' })
        .toISOString(),
      points: faker.number.int({ min: 0, max: 5000 }),
      clanPoints: faker.number.int({ min: 0, max: 200 }),
      womRole: i === 0 ? 'Owner' : faker.helpers.arrayElement(roles),
      alts: Array.from({ length: altCount }, () => ({
        id: faker.string.uuid(),
        altName: `${nickname}_alt${faker.number.int({ min: 1, max: 9 })}`,
      })),
    };
  });
};

export const MOCK_USERS: MockUser[] = buildUsers();

const userByDiscordId = new Map(MOCK_USERS.map(u => [u.discordId, u]));

export const findMockUser = (discordId: string) =>
  userByDiscordId.get(discordId);

export type MockDrop = {
  id: string;
  v: number;
  createdAt: string;
  destinationDiscordId: string;
  sourceDiscordId: string;
  messageId: string;
  pointsGiven: number;
  type: string;
  itemId: number | null;
  bossName: string | null;
  osrsName: string | null;
};

const buildDrops = (): MockDrop[] => {
  const dropCount = 800;
  return Array.from({ length: dropCount }, () => {
    const user = faker.helpers.arrayElement(MOCK_USERS);
    const useAlt = user.alts.length > 0 && faker.datatype.boolean(0.3);
    const accountName = useAlt
      ? faker.helpers.arrayElement(user.alts).altName
      : user.nickname;

    const isRaid = faker.datatype.boolean(0.15);
    const bossName = isRaid
      ? faker.helpers.arrayElement(RAIDS)
      : faker.helpers.arrayElement(BOSSES);

    const hasItem = faker.datatype.boolean(0.85);

    return {
      id: faker.string.hexadecimal({ length: 24, casing: 'lower' }).slice(2),
      v: 0,
      createdAt: faker.date
        .between({ from: '2024-01-01', to: '2026-06-15' })
        .toISOString(),
      destinationDiscordId: user.discordId,
      sourceDiscordId: faker.string.numeric(18),
      messageId: faker.string.numeric(18),
      pointsGiven: faker.number.int({ min: 1, max: 100 }),
      type: 'AUTOMATED',
      itemId: hasItem ? faker.number.int({ min: 1, max: 30000 }) : null,
      bossName: bossName.replace(/_/g, ' '),
      osrsName: useAlt ? accountName : null,
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

// Clan-bucket audits so the profile's Clan points section has more than one source to divide
// (drops alone never exercise its subsections).
const buildClanAudits = (): MockDrop[] =>
  MOCK_USERS.slice(0, 12).flatMap(user =>
    Array.from(
      { length: faker.number.int({ min: 1, max: 4 }) },
      (): MockDrop => ({
        id: faker.string.hexadecimal({ length: 24, casing: 'lower' }).slice(2),
        v: 0,
        createdAt: faker.date
          .between({ from: '2025-01-01', to: '2026-08-01' })
          .toISOString(),
        destinationDiscordId: user.discordId,
        sourceDiscordId: faker.string.numeric(18),
        messageId: faker.string.numeric(18),
        pointsGiven: faker.number.int({ min: 3, max: 20 }),
        type: faker.helpers.weightedArrayElement([
          { value: 'COMPETITION', weight: 4 },
          { value: 'CLAN_MANUAL', weight: 1 },
        ]),
        itemId: null,
        bossName: null,
        osrsName: null,
      }),
    ),
  );

export const MOCK_DROPS: MockDrop[] = [...buildDrops(), ...buildClanAudits()];

export type MockMonthlyWinner = {
  eventId: string;
  type: 'BOSS' | 'RAID' | 'SKILL';
  metric: string;
  winnerDiscordId: string;
  winnerOsrsName: string | null;
  startDate: string;
  endDate: string;
};

const buildMonthlyWinners = (): MockMonthlyWinner[] => {
  const months = 8;
  return Array.from({ length: months }, (_, i) => i)
    .flatMap(monthOffset => {
      const baseEnd = new Date(2026, 5 - monthOffset, 15);
      return (['BOSS', 'RAID', 'SKILL'] as const).map(type => {
        const metric = faker.helpers.arrayElement(
          type === 'BOSS' ? BOSSES : type === 'RAID' ? RAIDS : SKILLS,
        );
        const winner = faker.helpers.arrayElement(MOCK_USERS);
        // Occasionally an alt account is the one that won.
        const winnerOsrsName =
          winner.alts.length > 0 && faker.datatype.boolean(0.4)
            ? faker.helpers.arrayElement(winner.alts).altName
            : null;
        const end = new Date(baseEnd);
        const start = new Date(end);
        start.setDate(end.getDate() - 6);
        return {
          eventId: faker.string
            .hexadecimal({ length: 24, casing: 'lower' })
            .slice(2),
          type,
          metric,
          winnerDiscordId: winner.discordId,
          winnerOsrsName,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        };
      });
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
};

export const MOCK_MONTHLY_WINNERS: MockMonthlyWinner[] = buildMonthlyWinners();

// ---- Sanguine Slayer ----

// Real WOM metric slugs and the display names the bot spins them with, so mocked tasks resolve
// to the same wiki thumbnails production does.
const SLAYER_BOSSES: [metric: string, displayName: string][] = [
  ['vorkath', 'Vorkath'],
  ['zulrah', 'Zulrah'],
  ['cerberus', 'Cerberus'],
  ['general_graardor', 'General Graardor'],
  ['kreearra', "Kree'Arra"],
  ['the_whisperer', 'The Whisperer'],
  ['vardorvis', 'Vardorvis'],
  ['nex', 'Nex'],
  ['araxxor', 'Araxxor'],
  ['duke_sucellus', 'Duke Sucellus'],
  ['alchemical_hydra', 'Alchemical Hydra'],
  ['phosanis_nightmare', "Phosani's Nightmare"],
  ['barrows_chests', 'Barrows Chests'],
  ['scurrius', 'Scurrius'],
  ['yama', 'Yama'],
  ['chambers_of_xeric', 'Chambers Of Xeric'],
];

const objectId = () =>
  faker.string.hexadecimal({ length: 24, casing: 'lower' }).slice(2);

const STANDING_CLAN_EVENT_ID = objectId();
const EVENT_CLAN_EVENT_ID = objectId();

export const MOCK_WHEEL_CLAN_EVENTS = [
  {
    id: STANDING_CLAN_EVENT_ID,
    v: 0,
    type: 'BOSS_WHEEL',
    startDate: '2026-05-01T00:00:00.000Z',
    endDate: '2126-05-01T00:00:00.000Z',
    winnerDiscordId: null,
    winnerOsrsName: null,
  },
  {
    id: EVENT_CLAN_EVENT_ID,
    v: 0,
    type: 'BOSS_WHEEL',
    startDate: '2026-07-06T00:00:00.000Z',
    endDate: '2026-07-13T00:00:00.000Z',
    winnerDiscordId: MOCK_USERS[3].discordId,
    winnerOsrsName: MOCK_USERS[3].nickname,
  },
];

export const MOCK_WHEELS = [
  {
    id: objectId(),
    v: 0,
    clanEventId: STANDING_CLAN_EVENT_ID,
    mode: 'STANDING',
    name: 'Sanguine Slayer',
    multiplier: 1,
    taskClanPoints: 5,
    startingRerolls: 3,
    rerollEarnRate: 0.3,
    respinCooldownHours: 8,
    prizePoints: { first: 0, second: 0, third: 0, participant: 0 },
    bossPool: SLAYER_BOSSES.map(([metric]) => metric),
    createdByDiscordId: MOCK_USERS[0].discordId,
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: objectId(),
    v: 0,
    clanEventId: EVENT_CLAN_EVENT_ID,
    mode: 'EVENT',
    name: 'July Slayer Sprint',
    multiplier: 2,
    taskClanPoints: 0,
    startingRerolls: 3,
    rerollEarnRate: 0.3,
    respinCooldownHours: 8,
    prizePoints: { first: 20, second: 15, third: 10, participant: 3 },
    bossPool: SLAYER_BOSSES.map(([metric]) => metric),
    createdByDiscordId: MOCK_USERS[0].discordId,
    createdAt: '2026-07-06T00:00:00.000Z',
  },
];

export type MockSpin = {
  id: string;
  v: number;
  clanEventId: string;
  discordId: string;
  task: {
    type: string;
    bossMetric: string;
    bossDisplayName: string;
    dinkNames: string[];
    itemFilter: { mode: string; itemIds: number[] };
  };
  spinType: string;
  status: string;
  spunAt: string;
  completion: {
    itemId: number;
    itemName: string;
    dropPoints: number;
    bonusPoints: number;
    eventPoints: number;
    taskClanPoints: number;
    bossNameRaw: string;
    osrsName: string | null;
    dropMessageId: string;
    completedAt: string;
  } | null;
};

const buildSpin = (
  clanEventId: string,
  user: MockUser,
  status: string,
  spunAt: Date,
  {
    multiplier,
    taskClanPoints,
  }: { multiplier: number; taskClanPoints: number },
): MockSpin => {
  const [bossMetric, bossDisplayName] =
    faker.helpers.arrayElement(SLAYER_BOSSES);
  const useAlt = user.alts.length > 0 && faker.datatype.boolean(0.25);
  const dropPoints = faker.number.int({ min: 1, max: 90 });
  const completedAt = new Date(
    spunAt.getTime() + faker.number.int({ min: 1, max: 40 }) * 3_600_000,
  );
  return {
    id: objectId(),
    v: 0,
    clanEventId,
    discordId: user.discordId,
    task: {
      type: 'BOSS_DROP',
      bossMetric,
      bossDisplayName,
      dinkNames: [bossDisplayName.toLowerCase()],
      itemFilter: { mode: 'ANY', itemIds: [] },
    },
    spinType: faker.helpers.arrayElement(['INITIAL', 'FREE_RESPIN', 'REROLL']),
    status,
    spunAt: spunAt.toISOString(),
    completion:
      status === 'COMPLETED'
        ? {
            itemId: faker.number.int({ min: 1, max: 30000 }),
            itemName: faker.commerce.productName(),
            dropPoints,
            bonusPoints: Math.round(dropPoints * (multiplier - 1)),
            eventPoints: Math.round(dropPoints * multiplier),
            taskClanPoints,
            bossNameRaw: bossDisplayName.toLowerCase(),
            osrsName: useAlt
              ? faker.helpers.arrayElement(user.alts).altName
              : null,
            dropMessageId: faker.string.numeric(18),
            completedAt: completedAt.toISOString(),
          }
        : null,
  };
};

const buildSpins = (): MockSpin[] => {
  // The standing grind: most members have completed a handful, a dozen are out on task now,
  // and plenty of tasks were skipped along the way.
  const grinders = MOCK_USERS.slice(0, 22);
  const standing = grinders.flatMap((user, index) =>
    Array.from(
      { length: faker.number.int({ min: 0, max: index < 6 ? 11 : 5 }) },
      () =>
        buildSpin(
          STANDING_CLAN_EVENT_ID,
          user,
          faker.helpers.weightedArrayElement([
            { value: 'COMPLETED', weight: 6 },
            { value: 'REPLACED', weight: 3 },
          ]),
          faker.date.between({ from: '2026-05-02', to: '2026-08-04' }),
          { multiplier: 1, taskClanPoints: 5 },
        ),
    ),
  );
  const outOnTask = faker.helpers
    .arrayElements(grinders, 11)
    .map(user =>
      buildSpin(
        STANDING_CLAN_EVENT_ID,
        user,
        'ACTIVE',
        faker.date.between({ from: '2026-08-04', to: '2026-08-06' }),
        { multiplier: 1, taskClanPoints: 5 },
      ),
    );
  // The July competition: double points, no per-task clan points, all long since finished.
  const sprint = faker.helpers.arrayElements(MOCK_USERS, 9).flatMap(user =>
    Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () =>
      buildSpin(
        EVENT_CLAN_EVENT_ID,
        user,
        faker.helpers.weightedArrayElement([
          { value: 'COMPLETED', weight: 5 },
          { value: 'EXPIRED', weight: 1 },
        ]),
        faker.date.between({ from: '2026-07-06', to: '2026-07-12' }),
        { multiplier: 2, taskClanPoints: 0 },
      ),
    ),
  );
  return [...standing, ...outOnTask, ...sprint];
};

export const MOCK_SPINS: MockSpin[] = buildSpins();

export type MockCompetition = {
  id: number;
  title: string;
  metric: string;
  type: string;
  startsAt: Date;
  endsAt: Date;
  groupId: number;
  score: number;
  createdAt: Date;
  updatedAt: Date;
  participantCount: number;
};

const buildCompetitions = (): MockCompetition[] => {
  return Array.from({ length: 15 }, (_, i) => {
    const startsAt = faker.date.between({
      from: '2024-06-01',
      to: '2026-07-01',
    });
    const endsAt = new Date(startsAt);
    endsAt.setDate(startsAt.getDate() + faker.number.int({ min: 3, max: 14 }));
    const allMetrics = [...BOSSES, ...RAIDS, ...SKILLS, 'ehb', 'ehp'];
    return {
      id: 100000 + i,
      title: faker.lorem.words({ min: 2, max: 4 }),
      metric: faker.helpers.arrayElement(allMetrics),
      type: 'classic',
      startsAt,
      endsAt,
      groupId: GROUP_ID,
      score: faker.number.int({ min: 0, max: 5000 }),
      createdAt: new Date(startsAt),
      updatedAt: new Date(endsAt),
      participantCount: faker.number.int({ min: 5, max: 30 }),
    };
  }).sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
};

export const MOCK_COMPETITIONS: MockCompetition[] = buildCompetitions();

export const buildCompetitionDetail = (id: number) => {
  const found = MOCK_COMPETITIONS.find(c => c.id === id);
  const base =
    found ??
    ({
      ...MOCK_COMPETITIONS[0],
      id,
      title: faker.lorem.words({ min: 2, max: 4 }),
    } as MockCompetition);

  const participants = faker.helpers.arrayElements(
    MOCK_USERS,
    faker.number.int({ min: 5, max: Math.min(25, MOCK_USERS.length) }),
  );

  const participations = participants.map((user, idx) => {
    const start = faker.number.int({ min: 0, max: 5000 });
    const gained = faker.number.int({ min: 0, max: 2000 });
    return {
      playerId: idx + 1,
      competitionId: base.id,
      teamName: null,
      createdAt: base.startsAt,
      updatedAt: base.endsAt,
      player: {
        id: idx + 1,
        username: user.nickname.toLowerCase(),
        displayName: user.nickname,
        type: 'regular',
        build: 'main',
        status: 'active',
        country: null,
        patron: false,
        ehp: 0,
        ehb: 0,
        ttm: 0,
        tt200m: 0,
        registeredAt: new Date(user.joined),
        updatedAt: new Date(),
        lastChangedAt: new Date(),
        lastImportedAt: new Date(),
      },
      progress: { start, end: start + gained, gained },
      levels: { start: 0, end: 0, gained: 0 },
    };
  });

  return {
    ...base,
    participantCount: participations.length,
    participations,
  };
};

export const MOCK_GROUP_MEMBERSHIPS = MOCK_USERS.map((user, idx) => ({
  playerId: idx + 1,
  groupId: GROUP_ID,
  role: user.womRole,
  createdAt: new Date(user.joined),
  updatedAt: new Date(),
  player: {
    id: idx + 1,
    username: user.nickname.toLowerCase(),
    displayName: user.nickname,
    type: 'regular',
    build: 'main',
    status: 'active',
    country: null,
    patron: false,
    ehp: 0,
    ehb: 0,
    ttm: 0,
    tt200m: 0,
    registeredAt: new Date(user.joined),
    updatedAt: new Date(),
    lastChangedAt: new Date(),
    lastImportedAt: new Date(),
  },
}));
