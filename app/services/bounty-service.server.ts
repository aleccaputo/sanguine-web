import { getBounties, getBountiesForDiscordId } from '~/data/bounties';
import { fetchOSRSItem } from '~/services/osrs-wiki-prices-service';
import { getSlayerBossImageUrl } from '~/utils/slayer';

// Clan bounties: the Slayer Master puts a boss up, and the first N members to get a point-worthy
// drop from it win clan points. The Discord bot keeps one document per bounty with the winners
// embedded in claim order. This service turns those rows into the shapes the site renders: the
// bounty board, and one member's record of bounties won.

/** One winner of a bounty, with the drop that claimed it. */
export interface IBountyClaim {
  discordId: string;
  /** 1-based finishing position (the claim's index in the bot's append-only array). */
  placement: number;
  itemId: number;
  itemName: string;
  itemIcon: string | null;
  /** GE value of the claiming item, 0 for untradeables. */
  itemValue: number;
  /** Clan points this claim paid. */
  clanPoints: number;
  claimedAt: string;
  /** The account the drop came from, when it wasn't the main. */
  osrsName: string | null;
}

export interface IBounty {
  id: string;
  bossMetric: string;
  bossDisplayName: string;
  bossImageUrl: string;
  /** Names of the only items that count, empty when any point-worthy drop does. */
  onlyItems: string[];
  /** Clan points paid to each winner. */
  rewardClanPoints: number;
  maxWinners: number;
  claims: IBountyClaim[];
  status: string;
  postedAt: string;
  /** Null for "open until every slot is claimed". */
  expiresAt: string | null;
  closedAt: string | null;
}

type BountyRow = Awaited<ReturnType<typeof getBounties>>[number];

/** Resolves an item against the wiki (name, icon, GE value), tolerating a miss. */
const resolveItem = async (itemId: number, fallbackName: string) => {
  const osrsData = await fetchOSRSItem(itemId);
  return {
    name: osrsData?.name ?? fallbackName,
    icon: osrsData?.icon ?? null,
    value: osrsData?.price ?? 0,
  };
};

const toBounty = async (row: BountyRow): Promise<IBounty> => {
  const [claims, onlyItems] = await Promise.all([
    Promise.all(
      row.claims.map(async (claim, index) => {
        const item = await resolveItem(claim.itemId, claim.itemName);
        return {
          discordId: claim.discordId,
          placement: index + 1,
          itemId: claim.itemId,
          itemName: item.name,
          itemIcon: item.icon,
          itemValue: item.value,
          clanPoints: claim.rewardClanPoints,
          claimedAt: claim.claimedAt,
          osrsName: claim.osrsName ?? null,
        };
      }),
    ),
    row.task.itemFilter.mode === 'INCLUDE'
      ? Promise.all(
          row.task.itemFilter.itemIds.map(async itemId => {
            const item = await resolveItem(itemId, `item ${itemId}`);
            return item.name;
          }),
        )
      : Promise.resolve([]),
  ]);
  return {
    id: row.id,
    bossMetric: row.task.bossMetric,
    bossDisplayName: row.task.bossDisplayName,
    bossImageUrl: getSlayerBossImageUrl(
      row.task.bossMetric,
      row.task.bossDisplayName,
    ),
    onlyItems,
    rewardClanPoints: row.rewardClanPoints,
    maxWinners: row.maxWinners,
    claims,
    status: row.status,
    postedAt: row.postedAt,
    expiresAt: row.expiresAt ?? null,
    closedAt: row.closedAt ?? null,
  };
};

const toBounties = async (rows: BountyRow[]): Promise<IBounty[]> =>
  Promise.all(rows.map(toBounty));

/** Every bounty ever posted, newest first — the board's whole history. */
export const getBountyBoard = async (): Promise<IBounty[]> =>
  toBounties(await getBounties());

/** One bounty a member won, flattened to their claim. */
export interface IBountyWin extends IBountyClaim {
  bountyId: string;
  bossDisplayName: string;
  bossImageUrl: string;
  maxWinners: number;
}

export interface IBountyRecord {
  /** Bounties the member has claimed, newest first. */
  wins: IBountyWin[];
  /** Clan points their bounty claims paid. */
  clanPoints: number;
}

/** One member's bounty record, for their profile article. */
export const getBountyRecordForDiscordId = async (
  discordId: string,
): Promise<IBountyRecord> => {
  const bounties = await toBounties(await getBountiesForDiscordId(discordId));
  const wins = bounties
    .flatMap(bounty =>
      bounty.claims
        .filter(claim => claim.discordId === discordId)
        .map(claim => ({
          ...claim,
          bountyId: bounty.id,
          bossDisplayName: bounty.bossDisplayName,
          bossImageUrl: bounty.bossImageUrl,
          maxWinners: bounty.maxWinners,
        })),
    )
    .sort((a, b) => b.claimedAt.localeCompare(a.claimedAt));
  return {
    wins,
    clanPoints: wins.reduce((sum, win) => sum + win.clanPoints, 0),
  };
};
