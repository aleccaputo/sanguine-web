import dayjs from 'dayjs';
import { OSRSItem } from '~/services/osrs-wiki-prices-service';
import { EVENTS_EXCLUDED_DISCORD_IDS } from '~/utils/events-config';

type DropRecord = {
  id: string;
  itemId: number | null;
  bossName: string | null;
  pointsGiven: number;
  createdAt: string;
  destinationDiscordId: string;
  osrsName: string | null;
};

type ItemMap = Map<number, OSRSItem>;

export type ClanTotals = {
  totalDrops: number;
  totalGP: number;
  totalPoints: number;
};

export type BossStats = {
  bossName: string;
  dropCount: number;
  totalGP: number;
};

export type ItemStats = {
  itemId: number;
  name: string;
  icon: string;
  count: number;
};

export type MemberStats = {
  discordId: string;
  dropCount: number;
  totalGP: number;
  totalPoints: number;
};

export type MonthlyDrops = {
  date: string;
  count: number;
};

export const computeClanTotals = (
  drops: DropRecord[],
  itemMap: ItemMap,
): ClanTotals =>
  drops.reduce(
    (acc, drop) => ({
      totalDrops: acc.totalDrops + 1,
      totalGP:
        acc.totalGP +
        (drop.itemId != null ? itemMap.get(drop.itemId)?.price ?? 0 : 0),
      totalPoints: acc.totalPoints + drop.pointsGiven,
    }),
    { totalDrops: 0, totalGP: 0, totalPoints: 0 },
  );

export type ValuableItem = {
  itemId: number;
  osrsData: OSRSItem;
  count: number;
  totalGP: number;
  recipients: { discordId: string; nickname: string; count: number }[];
};

export const getMostValuableItems = (
  drops: (DropRecord & { nickname: string })[],
  itemMap: ItemMap,
  limit = 10,
): ValuableItem[] => {
  const byItem = new Map<
    number,
    {
      count: number;
      recipients: Map<string, { nickname: string; count: number }>;
    }
  >();

  for (const drop of drops) {
    if (drop.itemId == null) continue;
    const item = itemMap.get(drop.itemId);
    if (!item?.price || item.price <= 0) continue;

    const existing = byItem.get(drop.itemId) ?? {
      count: 0,
      recipients: new Map(),
    };
    existing.count += 1;

    const recipientKey = drop.destinationDiscordId;
    const recipient = existing.recipients.get(recipientKey) ?? {
      nickname: drop.nickname,
      count: 0,
    };
    recipient.count += 1;
    existing.recipients.set(recipientKey, recipient);

    byItem.set(drop.itemId, existing);
  }

  return [...byItem.entries()]
    .map(([itemId, { count, recipients }]) => {
      const osrsData = itemMap.get(itemId)!;
      return {
        itemId,
        osrsData,
        count,
        totalGP: (osrsData.price ?? 0) * count,
        recipients: [...recipients.entries()]
          .map(([discordId, r]) => ({ discordId, ...r }))
          .sort((a, b) => b.count - a.count),
      };
    })
    .sort((a, b) => (b.osrsData.price ?? 0) - (a.osrsData.price ?? 0))
    .slice(0, limit);
};

export const getBossBreakdown = (
  drops: DropRecord[],
  itemMap: ItemMap,
): BossStats[] => {
  const byBoss = drops.reduce<Record<string, { count: number; gp: number }>>(
    (acc, drop) => {
      const boss = drop.bossName ?? 'Unknown';
      const existing = acc[boss] ?? { count: 0, gp: 0 };
      const price =
        drop.itemId != null ? itemMap.get(drop.itemId)?.price ?? 0 : 0;
      acc[boss] = { count: existing.count + 1, gp: existing.gp + price };
      return acc;
    },
    {},
  );

  return Object.entries(byBoss)
    .map(([bossName, { count, gp }]) => ({
      bossName,
      dropCount: count,
      totalGP: gp,
    }))
    .sort((a, b) => {
      if (a.bossName === 'Unknown') return 1;
      if (b.bossName === 'Unknown') return -1;
      return b.dropCount - a.dropCount;
    });
};

export const getMostCommonItems = (
  drops: DropRecord[],
  itemMap: ItemMap,
  limit = 15,
): ItemStats[] => {
  const byItem = drops.reduce<Record<number, number>>((acc, drop) => {
    if (drop.itemId != null) {
      acc[drop.itemId] = (acc[drop.itemId] ?? 0) + 1;
    }
    return acc;
  }, {});

  return Object.entries(byItem)
    .map(([itemIdStr, count]) => {
      const itemId = Number(itemIdStr);
      const item = itemMap.get(itemId);
      return {
        itemId,
        name: item?.name ?? `Item ${itemId}`,
        icon: item?.icon ?? '',
        count,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

export const getMemberLeaderboard = (
  drops: DropRecord[],
  itemMap: ItemMap,
  limit = 10,
): MemberStats[] => {
  const byMember = drops.reduce<
    Record<string, { dropCount: number; totalGP: number; totalPoints: number }>
  >((acc, drop) => {
    const id = drop.destinationDiscordId;
    const existing = acc[id] ?? { dropCount: 0, totalGP: 0, totalPoints: 0 };
    const price =
      drop.itemId != null ? itemMap.get(drop.itemId)?.price ?? 0 : 0;
    acc[id] = {
      dropCount: existing.dropCount + 1,
      totalGP: existing.totalGP + price,
      totalPoints: existing.totalPoints + drop.pointsGiven,
    };
    return acc;
  }, {});

  return Object.entries(byMember)
    .filter(([discordId]) => !EVENTS_EXCLUDED_DISCORD_IDS.has(discordId))
    .map(([discordId, stats]) => ({ discordId, ...stats }))
    .sort((a, b) => b.totalGP - a.totalGP)
    .slice(0, limit);
};

export const getDropsByMonth = (drops: DropRecord[]): MonthlyDrops[] => {
  const byMonth = drops.reduce<Record<string, number>>((acc, drop) => {
    const ym = dayjs(drop.createdAt).format('YYYY-MMM');
    acc[ym] = (acc[ym] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(byMonth)
    .map(([date, count]) => ({ date, count }))
    .sort(
      (a, b) =>
        dayjs(a.date, 'YYYY-MMM').unix() - dayjs(b.date, 'YYYY-MMM').unix(),
    );
};

export const getRecentValuableDrops = (
  drops: DropRecord[],
  itemMap: ItemMap,
  gpThreshold = 1_000_000,
  daysBack = 30,
): (DropRecord & { osrsData: OSRSItem | null })[] => {
  const cutoff = dayjs().subtract(daysBack, 'day');

  return drops
    .filter(drop => dayjs(drop.createdAt).isAfter(cutoff))
    .map(drop => ({
      ...drop,
      osrsData: drop.itemId != null ? itemMap.get(drop.itemId) ?? null : null,
    }))
    .filter(drop => (drop.osrsData?.price ?? 0) >= gpThreshold)
    .sort((a, b) => (b.osrsData?.price ?? 0) - (a.osrsData?.price ?? 0));
};
