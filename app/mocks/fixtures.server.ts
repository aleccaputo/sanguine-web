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
  const roles = [
    'Owner',
    'Deputy_owner',
    'Coordinator',
    'Officer',
    'Member',
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

export const MOCK_DROPS: MockDrop[] = buildDrops();

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
