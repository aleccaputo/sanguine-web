import {
  getActiveSpins,
  getCompletedSpins,
  getSpinCountsByStatus,
  getSpinsForDiscordId,
  getWheelClanEvents,
  getWheelConfigs,
  SPIN_STATUS,
} from '~/data/slayer';
import { fetchOSRSItem } from '~/services/osrs-wiki-prices-service';
import { getSlayerBossImageUrl, WHEEL_MODE } from '~/utils/slayer';

// Sanguine Slayer: the Slayer Master assigns a random boss task, and a point-worthy drop from
// that boss completes it. The Discord bot models it as the Boss Wheel — one WheelEvents config
// per instance, one spin document per assigned task. This service turns those rows into the
// shapes the site renders: the task log, the tasks members are out on, and one member's record.

/** One instance of the feature: the always-on grind, or a time-boxed competition. */
export interface ISlayerWheel {
  clanEventId: string;
  mode: string;
  name: string;
  /** Event-mode bonus multiplier on drop points (1 during the standing grind). */
  multiplier: number;
  /** Flat clan points paid per completed task (0 during competitions). */
  taskClanPoints: number;
  startingRerolls: number;
  rerollEarnRate: number;
  respinCooldownHours: number;
  /** Podium and participation prizes, all zero during the standing grind. */
  prizePoints: { first: number; second: number; third: number };
  bossPoolSize: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

/** A completed task, with the drop that finished it. */
export interface ISlayerCompletion {
  id: string;
  discordId: string;
  bossDisplayName: string;
  bossImageUrl: string;
  itemId: number;
  itemName: string;
  itemIcon: string | null;
  /** GE value of the completing item, 0 for untradeables (pets, jars). */
  itemValue: number;
  /** What the drop was worth normally — already counted in the member's drop points. */
  dropPoints: number;
  /** Event-mode bonus drop points paid on top (0 during the standing grind). */
  bonusPoints: number;
  /** Flat clan points the completion paid. */
  clanPoints: number;
  completedAt: string;
  /** The account the drop came from, when it wasn't the main. */
  osrsName: string | null;
}

/** A task a member is out on right now. */
export interface ISlayerTask {
  id: string;
  discordId: string;
  bossDisplayName: string;
  bossImageUrl: string;
  spunAt: string;
}

// Row shapes come from the data layer so the mock and the real client can't drift apart.
type WheelConfigRow = Awaited<ReturnType<typeof getWheelConfigs>>[number];
type ClanEventRow = Awaited<ReturnType<typeof getWheelClanEvents>>[number];
type SpinRow = Awaited<ReturnType<typeof getCompletedSpins>>[number];

/** Pairs each wheel config with the ClanEvents row that owns its window. */
const buildWheels = (
  configs: WheelConfigRow[],
  clanEvents: ClanEventRow[],
  nowIso: string,
): ISlayerWheel[] => {
  const windowByEventId = new Map(clanEvents.map(event => [event.id, event]));
  return configs
    .flatMap(config => {
      const window = windowByEventId.get(config.clanEventId);
      if (!window) return [];
      return [
        {
          clanEventId: config.clanEventId,
          mode: config.mode,
          name: config.name,
          multiplier: config.multiplier,
          taskClanPoints: config.taskClanPoints,
          startingRerolls: config.startingRerolls,
          rerollEarnRate: config.rerollEarnRate,
          respinCooldownHours: config.respinCooldownHours,
          prizePoints: {
            first: config.prizePoints.first,
            second: config.prizePoints.second,
            third: config.prizePoints.third,
          },
          bossPoolSize: config.bossPool.length,
          startDate: window.startDate,
          endDate: window.endDate,
          isActive: window.startDate <= nowIso && window.endDate >= nowIso,
        },
      ];
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
};

/**
 * The instance in effect right now. A running competition supersedes the standing grind, the
 * same precedence the bot applies when a drop comes in.
 */
export const findLiveWheel = (wheels: ISlayerWheel[]): ISlayerWheel | null => {
  const active = wheels.filter(wheel => wheel.isActive);
  return (
    active.find(wheel => wheel.mode === WHEEL_MODE.EVENT) ?? active[0] ?? null
  );
};

/**
 * Resolves the completing item against the wiki (icon and GE value). The stored item name is
 * the verbatim Dink string; the wiki's is the one the rest of the site shows.
 */
const toCompletion = async (
  spin: SpinRow,
): Promise<ISlayerCompletion | null> => {
  const { completion } = spin;
  if (!completion) return null;
  const osrsData = await fetchOSRSItem(completion.itemId);
  return {
    id: spin.id,
    discordId: spin.discordId,
    bossDisplayName: spin.task.bossDisplayName,
    bossImageUrl: getSlayerBossImageUrl(
      spin.task.bossMetric,
      spin.task.bossDisplayName,
    ),
    itemId: completion.itemId,
    itemName: osrsData?.name ?? completion.itemName,
    itemIcon: osrsData?.icon ?? null,
    itemValue: osrsData?.price ?? 0,
    dropPoints: completion.dropPoints,
    bonusPoints: completion.bonusPoints,
    clanPoints: completion.taskClanPoints,
    completedAt: completion.completedAt,
    osrsName: completion.osrsName,
  };
};

const toCompletions = async (
  spins: SpinRow[],
): Promise<ISlayerCompletion[]> => {
  const completions = await Promise.all(spins.map(toCompletion));
  return completions
    .filter(
      (completion): completion is ISlayerCompletion => completion !== null,
    )
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
};

const toTask = (spin: SpinRow): ISlayerTask => ({
  id: spin.id,
  discordId: spin.discordId,
  bossDisplayName: spin.task.bossDisplayName,
  bossImageUrl: getSlayerBossImageUrl(
    spin.task.bossMetric,
    spin.task.bossDisplayName,
  ),
  spunAt: spin.spunAt,
});

export interface ISlayerLog {
  /** Null when nothing is running right now. */
  liveWheel: ISlayerWheel | null;
  /** The live instance, or the most recent one — whatever the rules should be read from. */
  rulesWheel: ISlayerWheel | null;
  /** Every completed task, newest first, across every instance. */
  completions: ISlayerCompletion[];
  /** Tasks out on the live instance only — older instances' tasks are dead. */
  activeTasks: ISlayerTask[];
  /** Tasks handed out in total, and how many were traded away for another. */
  tasksAssigned: number;
  tasksAbandoned: number;
}

/** Everything the Slayer page renders, member identity aside. */
export const getSlayerLog = async (
  nowIso: string = new Date().toISOString(),
): Promise<ISlayerLog> => {
  const [configs, clanEvents, completedSpins, activeSpins, spinCounts] =
    await Promise.all([
      getWheelConfigs(),
      getWheelClanEvents(),
      getCompletedSpins(),
      getActiveSpins(),
      getSpinCountsByStatus(),
    ]);

  const wheels = buildWheels(configs, clanEvents, nowIso);
  const liveWheel = findLiveWheel(wheels);
  const completions = await toCompletions(completedSpins);
  const activeTasks = activeSpins
    .filter(spin => spin.clanEventId === liveWheel?.clanEventId)
    .map(toTask)
    .sort((a, b) => b.spunAt.localeCompare(a.spunAt));

  return {
    liveWheel,
    // buildWheels sorts newest first, so the head is the most recent instance.
    rulesWheel: liveWheel ?? wheels[0] ?? null,
    completions,
    activeTasks,
    tasksAssigned: Object.values(spinCounts).reduce(
      (sum, count) => sum + count,
      0,
    ),
    tasksAbandoned: spinCounts[SPIN_STATUS.REPLACED] ?? 0,
  };
};

export interface ISlayerRecord {
  completions: ISlayerCompletion[];
  /** The member's task right now, if the live instance has one for them. */
  activeTask: ISlayerTask | null;
  /** Clan points their completed tasks paid, prizes aside. */
  taskClanPoints: number;
  /** Event-mode bonus drop points their tasks paid. */
  bonusDropPoints: number;
}

/** One member's slayer record, for their profile article. */
export const getSlayerRecordForDiscordId = async (
  discordId: string,
  nowIso: string = new Date().toISOString(),
): Promise<ISlayerRecord> => {
  const [spins, configs, clanEvents] = await Promise.all([
    getSpinsForDiscordId(discordId),
    getWheelConfigs(),
    getWheelClanEvents(),
  ]);
  const liveWheel = findLiveWheel(buildWheels(configs, clanEvents, nowIso));

  const completions = await toCompletions(
    spins.filter(spin => spin.status === SPIN_STATUS.COMPLETED),
  );
  const activeSpin = spins.find(
    spin =>
      spin.status === SPIN_STATUS.ACTIVE &&
      spin.clanEventId === liveWheel?.clanEventId,
  );

  return {
    completions,
    activeTask: activeSpin ? toTask(activeSpin) : null,
    taskClanPoints: completions.reduce((sum, c) => sum + c.clanPoints, 0),
    bonusDropPoints: completions.reduce((sum, c) => sum + c.bonusPoints, 0),
  };
};
