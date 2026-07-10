import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import {
  Link,
  ShouldRevalidateFunction,
  useLoaderData,
  useSearchParams,
} from '@remix-run/react';
import {
  Badge,
  Box,
  Card,
  Container,
  Flex,
  Heading,
  Table,
  Tabs,
  Text,
} from '@radix-ui/themes';
import {
  getNicknameMapByDiscordIds,
  getUserWithNickname,
} from '~/services/sanguine-service.server';
import { getAuditDataForUserById } from '~/data/points-audit';
import { getUserAlts } from '~/data/user';
import {
  getPersonalBestCategoryKeysForDiscordId,
  getPersonalBestsByCategoryKeys,
} from '~/data/personal-bests';
import {
  buildUserCategoryBests,
  collectParticipantDiscordIds,
  formatScaleLabel,
} from '~/utils/personal-bests';
import { buildBossImageMap } from '~/utils/pb-boss-image.server';
import { PbTeam, PbTime, rankBadge } from '~/components/PbTeam';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { fetchOSRSItem } from '~/services/osrs-wiki-prices-service';
import { AccountsTooltip } from '~/components/AccountsTooltip';
import { DropItem } from '~/components/DropItem';
import { Pagination } from '~/components/Pagination';
import {
  getClanFromWom,
  getCompetitions,
} from '~/services/wom-api-service.server';
import {
  getCompetitionImageUrl,
  getFallbackImageUrl,
} from '~/utils/competition-images';
import { fetchRankImage } from '~/utils/clan-ranks';
import { matchesAccountName } from '~/utils/account-matching';
import { getRaidCompletionsForDiscordId } from '~/data/raid-completions';
import {
  isClanPointAudit,
  isLegacyCompetitionAudit,
} from '~/utils/point-types';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const title = data?.user?.nickname
    ? `Members | ${data.user.nickname}`
    : 'Members | Sanguine Member';

  const description = data?.user?.nickname
    ? `More information about ${data.user.nickname}`
    : 'More information about a member';

  return [{ title }, { name: 'description', content: description }];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const discordId = params.id ?? '';

  const [
    user,
    userAuditData,
    sanguineWomMembers,
    userAlts,
    pbCategoryKeys,
    raidCompletions,
  ] = await Promise.all([
    getUserWithNickname(discordId),
    getAuditDataForUserById(discordId),
    getClanFromWom(18435),
    getUserAlts(discordId),
    getPersonalBestCategoryKeysForDiscordId(discordId),
    getRaidCompletionsForDiscordId(discordId),
  ]);

  // Clan-bucket audit rows (raid payouts, manual clan adjustments, post-cutover competition
  // rewards) belong to the clan-points total shown in the header, not the drop-point history
  // charted below.
  const dropAuditData = userAuditData.filter(x => !isClanPointAudit(x));

  // Pre-cutover COMPETITION awards count as clan points retroactively (while staying in the
  // drop-point history above) — the stored clanPoints total never included them.
  const legacyCompetitionPoints = userAuditData
    .filter(isLegacyCompetitionAudit)
    .reduce((sum, x) => sum + x.pointsGiven, 0);

  // Clan Points tab sections. Competitions span the cutover (every COMPETITION award counts as
  // clan points now); GROUP_RAID audits aren't listed — the richer RaidCompletions rows below
  // cover raids.
  const competitionRows = userAuditData
    .filter(x => x.type === 'COMPETITION')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const labeledCompetitionRows = competitionRows.filter(
    x => x.competitionTitle != null,
  );
  // Thumbnails key off the comp's WOM metric, which the audit doesn't store — join against
  // the (cached) group competition list. Comps missing from it fall back to the clan logo.
  const womCompetitions =
    labeledCompetitionRows.length > 0 ? await getCompetitions() : undefined;
  const metricByCompId = new Map(
    (womCompetitions ?? []).map(comp => [comp.id, comp.metric]),
  );
  const competitionAwards = labeledCompetitionRows.map(
    ({
      id,
      createdAt,
      pointsGiven,
      competitionTitle,
      competitionId,
      placement,
    }) => {
      const metric =
        competitionId === null ? undefined : metricByCompId.get(competitionId);
      return {
        id,
        createdAt,
        pointsGiven,
        competitionTitle,
        competitionId,
        placement,
        imageUrl:
          metric === undefined
            ? getFallbackImageUrl()
            : getCompetitionImageUrl(metric),
      };
    },
  );
  // Rows the backfill couldn't attribute to a competition collapse into one summary line —
  // per-row dashes would just be noise for awards that predate reliable records.
  const historicalAwards = competitionRows.filter(
    x => x.competitionTitle == null,
  );
  const historicalCompetitions =
    historicalAwards.length > 0
      ? {
          points: historicalAwards.reduce((sum, x) => sum + x.pointsGiven, 0),
          count: historicalAwards.length,
          from: historicalAwards[historicalAwards.length - 1].createdAt,
          to: historicalAwards[0].createdAt,
        }
      : null;
  // Manual clan awards (event prizes, corrections) — surfaced as one lump sum, not a ledger.
  const otherClanAudits = userAuditData.filter(x => x.type === 'CLAN_MANUAL');
  const otherAwards =
    otherClanAudits.length > 0
      ? {
          points: otherClanAudits.reduce((sum, x) => sum + x.pointsGiven, 0),
          count: otherClanAudits.length,
        }
      : null;

  // Flatten each raid to the member's own award — the roster is shown, but the points column is
  // theirs alone.
  const raids = raidCompletions.map(raid => {
    const award = raid.awards.find(a => a.discordId === discordId);
    return {
      id: raid.id,
      raidDisplayName: raid.raidDisplayName,
      participantDiscordIds: raid.participantDiscordIds,
      approvedAt: raid.approvedAt,
      pointsAwarded: award?.totalPoints ?? 0,
      rotwApplied: award?.rotwApplied ?? false,
      capped: award?.capped ?? false,
    };
  });

  // Pull the full field for the member's categories so their times can be ranked against the clan.
  const allPbsInCategories =
    await getPersonalBestsByCategoryKeys(pbCategoryKeys);
  const personalBests = buildUserCategoryBests(discordId, allPbsInCategories);

  // Only resolve names for the people who actually appear in those PBs or raid rosters
  // ({} and no query if none).
  const pbNameByDiscordId = await getNicknameMapByDiscordIds([
    ...new Set([
      ...collectParticipantDiscordIds(allPbsInCategories),
      ...raids.flatMap(raid => raid.participantDiscordIds),
    ]),
  ]);

  const pbBossImageByName = buildBossImageMap([
    ...personalBests.map(pb => pb.bossName),
    ...raids.map(raid => raid.raidDisplayName),
  ]);

  const allAutomatedItems = userAuditData
    .filter(x => x.type === 'AUTOMATED')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const itemsWithData = await Promise.all(
    allAutomatedItems.map(async item => {
      if (item.itemId === null) {
        return { ...item, osrsData: null };
      }
      const osrsData = await fetchOSRSItem(item.itemId);
      return { ...item, osrsData };
    }),
  );

  const findWomRole = (name: string) =>
    sanguineWomMembers.find(
      x => x.player.displayName.toLowerCase() === name.toLowerCase(),
    )?.role;

  const allAccountNames = [
    ...(user.nickname ? [user.nickname] : []),
    ...userAlts.map(alt => alt.altName),
  ];
  const womRoles = Object.fromEntries(
    allAccountNames.map(name => [name, findWomRole(name)]),
  );

  return json({
    user: { ...user, clanPoints: user.clanPoints + legacyCompetitionPoints },
    auditData: dropAuditData,
    allItemsLogged: itemsWithData,
    womRoles,
    userAlts,
    personalBests,
    raids,
    competitionAwards,
    historicalCompetitions,
    otherAwards,
    pbNameByDiscordId,
    pbBossImageByName,
  });
}

// Tab and account switching only rewrite search params, which the loader ignores — skip the
// expensive revalidation (WOM + wiki price fetches) unless the route itself changes.
export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) =>
  currentUrl.pathname === nextUrl.pathname ? false : defaultShouldRevalidate;

// Account key used for "all accounts" combined view
const ALL_ACCOUNTS = 'all';

export default function UserById() {
  const {
    user,
    auditData,
    allItemsLogged,
    womRoles,
    userAlts,
    personalBests,
    raids,
    competitionAwards,
    historicalCompetitions,
    otherAwards,
    pbNameByDiscordId,
    pbBossImageByName,
  } = useLoaderData<typeof loader>();

  const hasAlts = userAlts.length > 0;
  const mainName = user.nickname ?? '';

  // How many distinct categories each boss spans for this member, so we know when to print a
  // scale/invocation sublabel to disambiguate (e.g. a solo CoX row next to a trio CoX row).
  const pbBossCounts = useMemo(
    () =>
      personalBests.reduce(
        (map, pb) => map.set(pb.bossName, (map.get(pb.bossName) ?? 0) + 1),
        new Map<string, number>(),
      ),
    [personalBests],
  );

  // selectedAccount is either ALL_ACCOUNTS, mainName, or an alt's altName
  const [selectedAccount, setSelectedAccount] = useState(ALL_ACCOUNTS);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  const filteredItems = useMemo(() => {
    if (selectedAccount === ALL_ACCOUNTS) return allItemsLogged;
    return allItemsLogged.filter(item =>
      matchesAccountName(item.osrsName, selectedAccount, mainName),
    );
  }, [selectedAccount, allItemsLogged, mainName]);

  const filteredAuditData = useMemo(() => {
    if (selectedAccount === ALL_ACCOUNTS) return auditData;
    return auditData.filter(item =>
      matchesAccountName(item.osrsName, selectedAccount, mainName),
    );
  }, [selectedAccount, auditData, mainName]);

  const dropCountByAccount: Record<string, number> = useMemo(
    () => ({
      [ALL_ACCOUNTS]: allItemsLogged.length,
      ...Object.fromEntries(
        [mainName, ...userAlts.map(alt => alt.altName)].map(name => [
          name,
          allItemsLogged.filter(item =>
            matchesAccountName(item.osrsName, name, mainName),
          ).length,
        ]),
      ),
    }),
    [allItemsLogged, userAlts, mainName],
  );

  const currentWomRole =
    selectedAccount === ALL_ACCOUNTS
      ? womRoles[mainName]
      : womRoles[selectedAccount];

  const summedPointsByYearMonth: { date: string; points: number }[] =
    Object.entries(
      filteredAuditData.reduce(
        (acc: { [yearMonth: string]: number }, message) => {
          const ym = dayjs(message.createdAt).format('YYYY-MMM');
          acc[ym] = (acc[ym] || 0) + message.pointsGiven;
          return acc;
        },
        {},
      ),
    ).map(([date, points]) => ({ date, points }));

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredItems.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  // Raids paginate independently of drops — they ignore the account switcher, so their page
  // never needs resetting.
  const [raidsPage, setRaidsPage] = useState(1);
  const raidsTotalPages = Math.ceil(raids.length / itemsPerPage);
  const raidsStartIndex = (raidsPage - 1) * itemsPerPage;
  const currentRaids = raids.slice(
    raidsStartIndex,
    raidsStartIndex + itemsPerPage,
  );

  const totalGP = filteredItems.reduce(
    (sum, item) => sum + (item.osrsData?.price || 0),
    0,
  );

  const getRankIcon = (rankName: string) => (
    <img
      src={fetchRankImage(rankName)}
      alt={rankName}
      width={26}
      height={26}
      className="inline-block"
    />
  );

  const handleAccountChange = (value: string) => {
    setSelectedAccount(value);
    setCurrentPage(1);
  };

  const displayName =
    selectedAccount === ALL_ACCOUNTS ? mainName : selectedAccount;

  // Clan Points tab groups every clan-point source; the summary line reconciles the header
  // total. Raid points come from the flattened completions, the rest from audit rows.
  const raidsPointsTotal = raids.reduce((sum, r) => sum + r.pointsAwarded, 0);
  const hasCompetitionHistory =
    competitionAwards.length > 0 || historicalCompetitions !== null;
  const historicalRange = historicalCompetitions && {
    from: dayjs(historicalCompetitions.from).format('MMM YYYY'),
    to: dayjs(historicalCompetitions.to).format('MMM YYYY'),
  };
  const historicalRangeLabel =
    historicalRange &&
    (historicalRange.from === historicalRange.to
      ? historicalRange.from
      : `${historicalRange.from} – ${historicalRange.to}`);
  const competitionsPointsTotal =
    competitionAwards.reduce((sum, a) => sum + a.pointsGiven, 0) +
    (historicalCompetitions?.points ?? 0);
  const hasClanPointHistory =
    raids.length > 0 || hasCompetitionHistory || otherAwards !== null;
  const clanPointsBreakdown = [
    ...(raids.length > 0 ? [`${raidsPointsTotal} from raids`] : []),
    ...(hasCompetitionHistory
      ? [`${competitionsPointsTotal} from competitions`]
      : []),
    ...(otherAwards !== null ? [`${otherAwards.points} other`] : []),
  ].join(' · ');

  // Section tabs — only sections with data get a tab; the chart always renders (it has its own
  // empty state). The active tab lives in the URL so sections are deep-linkable.
  const [searchParams, setSearchParams] = useSearchParams();
  const availableTabs = [
    ...(allItemsLogged.length > 0 ? ['drops'] : []),
    ...(personalBests.length > 0 ? ['personal-bests'] : []),
    ...(hasClanPointHistory ? ['clan-points'] : []),
    'chart',
  ];
  const tabParam = searchParams.get('tab');
  const activeTab =
    tabParam && availableTabs.includes(tabParam) ? tabParam : availableTabs[0];

  const handleTabChange = (value: string) =>
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.set('tab', value);
        return next;
      },
      { preventScrollReset: true },
    );

  // Shown inside the Drops and Points Chart tabs only — those are the sections it filters.
  // Personal Bests and Raids are keyed to the member and span every account.
  const accountSwitcher = hasAlts && (
    <Card className="border border-gray-800 bg-gray-900">
      <Box px="5" py="3">
        <Flex align="center" gap="3" wrap="wrap">
          <Text size="2" className="text-gray-400">
            Account:
          </Text>
          <Tabs.Root
            value={selectedAccount}
            onValueChange={handleAccountChange}
          >
            <Tabs.List>
              <Tabs.Trigger value={ALL_ACCOUNTS}>
                <Flex align="center" gap="2">
                  All
                  <Badge color="gray" variant="soft" radius="full" size="1">
                    {dropCountByAccount[ALL_ACCOUNTS]}
                  </Badge>
                </Flex>
              </Tabs.Trigger>
              <Tabs.Trigger value={mainName}>
                <Flex align="center" gap="2">
                  {womRoles[mainName] && getRankIcon(womRoles[mainName]!)}
                  {mainName}
                  <Badge color="gray" variant="soft" radius="full" size="1">
                    {dropCountByAccount[mainName] ?? 0}
                  </Badge>
                </Flex>
              </Tabs.Trigger>
              {userAlts.map(alt => (
                <Tabs.Trigger key={alt.id} value={alt.altName}>
                  <Flex align="center" gap="2">
                    {womRoles[alt.altName] &&
                      getRankIcon(womRoles[alt.altName]!)}
                    {alt.altName}
                    <Badge color="gray" variant="soft" radius="full" size="1">
                      {dropCountByAccount[alt.altName] ?? 0}
                    </Badge>
                  </Flex>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>
        </Flex>
      </Box>
    </Card>
  );

  return (
    <Container size="4" mt="3" pb="6">
      <Flex direction="column" gap="6">
        {/* User Header */}
        <Card className="border border-gray-800 bg-gray-900">
          <Box p="5">
            <Flex
              direction={{ initial: 'column', md: 'row' }}
              justify={{ md: 'between' }}
              align={{ initial: 'center', md: 'center' }}
              gap="4"
            >
              {/* Name, rank, and points */}
              <Flex
                direction="column"
                gap="2"
                align={{ initial: 'center', md: 'start' }}
              >
                <Flex align="center" gap="2">
                  {getRankIcon(currentWomRole ?? 'Guest')}
                  <Heading size="6" className="text-white">
                    {displayName}
                  </Heading>
                  {hasAlts && selectedAccount === ALL_ACCOUNTS && (
                    <AccountsTooltip
                      accounts={[
                        { name: mainName, role: womRoles[mainName] },
                        ...userAlts.map(alt => ({
                          name: alt.altName,
                          role: womRoles[alt.altName],
                        })),
                      ]}
                    >
                      <Badge color="gray" variant="soft" radius="full">
                        {1 + userAlts.length} accounts
                      </Badge>
                    </AccountsTooltip>
                  )}
                </Flex>
                {/* Two separate buckets: `points` is drop-driven (the number next to a member's
                    name), `clanPoints` covers clan activity — team raids, events, competitions. */}
                <Flex
                  direction="column"
                  align={{ initial: 'center', md: 'start' }}
                >
                  <Text size="4" className="text-sanguine-red">
                    {user.points} drop points
                  </Text>
                  <Text size="4" className="text-amber-400">
                    {user.clanPoints} clan points
                  </Text>
                </Flex>
              </Flex>

              {/* Stats */}
              <Flex gap="6" align="center">
                <Flex direction="column" gap="2" align="center">
                  <Box className="text-center">
                    <Text size="2" className="text-gray-400">
                      {'Member Since: '}
                    </Text>
                    <Text size="3" className="text-white">
                      {dayjs(user.joined).format('MMM YYYY')}
                    </Text>
                  </Box>
                  {filteredItems.length > 0 && (
                    <Box className="text-center">
                      <Text size="2" className="text-gray-400">
                        {'Total Items: '}
                      </Text>
                      <Text size="3" className="text-white">
                        {filteredItems.length}
                      </Text>
                    </Box>
                  )}
                </Flex>
                {totalGP > 0 && (
                  <Box className="text-center">
                    <Text size="2" className="text-gray-400">
                      Total Value
                    </Text>
                    <Flex align="center" justify="center" gap="1">
                      <img
                        src="https://oldschool.runescape.wiki/images/Coins_detail.png"
                        alt="GP"
                        className="h-4 w-4 object-contain"
                      />
                      <Text size="3" className="text-amber-400">
                        {totalGP.toLocaleString()}
                      </Text>
                    </Flex>
                  </Box>
                )}
              </Flex>
            </Flex>
          </Box>
        </Card>

        {/* Section tabs — the tab labels carry the counts so members can see what exists
            without scrolling. Active tab is synced to ?tab= for shareable links. */}
        <Tabs.Root value={activeTab} onValueChange={handleTabChange}>
          <Tabs.List>
            {allItemsLogged.length > 0 && (
              <Tabs.Trigger value="drops">
                <Flex align="center" gap="2">
                  Drops
                  <Badge color="gray" variant="soft" radius="full" size="1">
                    {allItemsLogged.length}
                  </Badge>
                </Flex>
              </Tabs.Trigger>
            )}
            {personalBests.length > 0 && (
              <Tabs.Trigger value="personal-bests">
                <Flex align="center" gap="2">
                  Personal Bests
                  <Badge color="gray" variant="soft" radius="full" size="1">
                    {personalBests.length}
                  </Badge>
                </Flex>
              </Tabs.Trigger>
            )}
            {hasClanPointHistory && (
              <Tabs.Trigger value="clan-points">
                <Flex align="center" gap="2">
                  Clan Points
                  <Badge color="amber" variant="soft" radius="full" size="1">
                    {user.clanPoints}
                  </Badge>
                </Flex>
              </Tabs.Trigger>
            )}
            <Tabs.Trigger value="chart">Points Chart</Tabs.Trigger>
          </Tabs.List>

          {/* Personal Bests — keyed to the member (discordId), so it spans every account and
              isn't affected by the account switcher. */}
          {personalBests.length > 0 && (
            <Tabs.Content value="personal-bests">
              <Box mt="4">
                <Card className="border border-gray-800 bg-gray-900">
                  <Box p="5">
                    <div className="overflow-x-auto">
                      <Table.Root size="1">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeaderCell className="text-gray-400">
                              Boss / Raid
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell className="text-gray-400">
                              Time
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell
                              className="text-gray-400"
                              align="center"
                            >
                              Clan Rank
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell className="hidden text-gray-400 sm:table-cell">
                              Team
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell className="text-gray-400">
                              Proof
                            </Table.ColumnHeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {personalBests.map(pb => (
                            <Table.Row key={pb.categoryKey}>
                              <Table.Cell className="text-white">
                                <Flex align="center" gap="2">
                                  <Box className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
                                    <img
                                      src={pbBossImageByName[pb.bossName]}
                                      alt={pb.bossName}
                                      className="max-h-7 max-w-7 object-contain"
                                    />
                                  </Box>
                                  <Flex direction="column">
                                    <Text size="2" weight="medium">
                                      {pb.bossName}
                                    </Text>
                                    {(pb.scale > 1 ||
                                      pb.raidLevel != null ||
                                      (pbBossCounts.get(pb.bossName) ?? 0) >
                                        1) && (
                                      <Text size="1" className="text-gray-400">
                                        {formatScaleLabel(
                                          pb.scale,
                                          pb.raidLevel,
                                        )}
                                      </Text>
                                    )}
                                    {pb.userAltName && (
                                      <Text size="1" className="text-gray-500">
                                        on {pb.userAltName}
                                      </Text>
                                    )}
                                  </Flex>
                                </Flex>
                              </Table.Cell>
                              <Table.Cell className="whitespace-nowrap font-medium text-amber-400">
                                <PbTime
                                  timeDisplay={pb.best.timeDisplay}
                                  isPreciseTime={pb.best.isPreciseTime}
                                />
                              </Table.Cell>
                              <Table.Cell align="center">
                                {/* Fixed-width slots so the rank marker and "of N" line up vertically
                              across rows regardless of each part's width. */}
                                <Flex align="center" justify="center" gap="1">
                                  <Text
                                    size="2"
                                    className="w-8 text-right text-white"
                                  >
                                    {pb.rank <= 3
                                      ? rankBadge(pb.rank)
                                      : `#${pb.rank}`}
                                  </Text>
                                  <Text
                                    size="1"
                                    className="w-8 text-left text-gray-500"
                                  >
                                    {pb.totalEntries > 1 &&
                                      `of ${pb.totalEntries}`}
                                  </Text>
                                </Flex>
                              </Table.Cell>
                              <Table.Cell className="hidden sm:table-cell">
                                <PbTeam
                                  participantDiscordIds={
                                    pb.best.participantDiscordIds
                                  }
                                  participantAltNames={
                                    pb.best.participantAltNames
                                  }
                                  nameByDiscordId={pbNameByDiscordId}
                                />
                              </Table.Cell>
                              <Table.Cell>
                                {pb.best.proofMessageUrl ? (
                                  <a
                                    href={pb.best.proofMessageUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-gray-400 transition-colors hover:text-sanguine-red"
                                  >
                                    View
                                  </a>
                                ) : (
                                  <Text size="2" className="text-gray-600">
                                    —
                                  </Text>
                                )}
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Root>
                    </div>
                  </Box>
                </Card>
              </Box>
            </Tabs.Content>
          )}

          {/* Clan Points — everything paying into the clan bucket: raid completions,
              competition rewards (BOTW/SOTW/RoTW), and manual adjustments. Like PBs, keyed to
              the member (discordId) so it spans every account and ignores the account
              switcher. */}
          {hasClanPointHistory && (
            <Tabs.Content value="clan-points">
              <Flex direction="column" gap="4" mt="4">
                <Text size="2" className="text-gray-400">
                  {clanPointsBreakdown}
                </Text>
                {raids.length > 0 && (
                  <Card className="border border-gray-800 bg-gray-900">
                    <Box p="5">
                      <Heading size="4" className="mb-4 text-white">
                        Raids
                      </Heading>
                      <div className="overflow-x-auto">
                        <Table.Root size="1">
                          <Table.Header>
                            <Table.Row>
                              <Table.ColumnHeaderCell className="text-gray-400">
                                Raid
                              </Table.ColumnHeaderCell>
                              <Table.ColumnHeaderCell className="text-gray-400">
                                Clan Points
                              </Table.ColumnHeaderCell>
                              <Table.ColumnHeaderCell className="hidden text-gray-400 sm:table-cell">
                                Team
                              </Table.ColumnHeaderCell>
                              <Table.ColumnHeaderCell className="text-gray-400">
                                Date
                              </Table.ColumnHeaderCell>
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {currentRaids.map(raid => (
                              <Table.Row key={raid.id}>
                                <Table.Cell className="text-white">
                                  <Flex align="center" gap="2">
                                    <Box className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
                                      <img
                                        src={
                                          pbBossImageByName[
                                            raid.raidDisplayName
                                          ]
                                        }
                                        alt={raid.raidDisplayName}
                                        className="max-h-7 max-w-7 object-contain"
                                      />
                                    </Box>
                                    <Flex align="center" gap="2">
                                      <Text size="2" weight="medium">
                                        {raid.raidDisplayName}
                                      </Text>
                                      {raid.rotwApplied && (
                                        <Badge
                                          color="amber"
                                          variant="soft"
                                          size="1"
                                        >
                                          RoTW ×2
                                        </Badge>
                                      )}
                                    </Flex>
                                  </Flex>
                                </Table.Cell>
                                <Table.Cell className="whitespace-nowrap font-medium text-amber-400">
                                  {raid.capped && raid.pointsAwarded === 0 ? (
                                    <Text size="2" className="text-gray-500">
                                      capped
                                    </Text>
                                  ) : (
                                    `+${raid.pointsAwarded}`
                                  )}
                                </Table.Cell>
                                <Table.Cell className="hidden sm:table-cell">
                                  <PbTeam
                                    participantDiscordIds={
                                      raid.participantDiscordIds
                                    }
                                    nameByDiscordId={pbNameByDiscordId}
                                  />
                                </Table.Cell>
                                <Table.Cell className="whitespace-nowrap text-gray-300">
                                  {dayjs(raid.approvedAt).format('MMM D, YYYY')}
                                </Table.Cell>
                              </Table.Row>
                            ))}
                          </Table.Body>
                        </Table.Root>
                      </div>
                      <Pagination
                        page={raidsPage}
                        totalPages={raidsTotalPages}
                        onPrev={() => setRaidsPage(p => Math.max(1, p - 1))}
                        onNext={() =>
                          setRaidsPage(p => Math.min(raidsTotalPages, p + 1))
                        }
                      />
                    </Box>
                  </Card>
                )}

                {hasCompetitionHistory && (
                  <Card className="border border-gray-800 bg-gray-900">
                    <Box p="5">
                      <Heading size="4" className="mb-4 text-white">
                        Competitions
                        <Text
                          size="2"
                          className="ml-2 font-normal text-gray-400"
                          as="span"
                        >
                          WOM competition rewards. Weeklies and one-off comps
                        </Text>
                      </Heading>
                      <div className="overflow-x-auto">
                        <Table.Root size="1">
                          <Table.Header>
                            <Table.Row>
                              <Table.ColumnHeaderCell className="text-gray-400">
                                Competition
                              </Table.ColumnHeaderCell>
                              <Table.ColumnHeaderCell className="text-gray-400">
                                Place
                              </Table.ColumnHeaderCell>
                              <Table.ColumnHeaderCell className="text-gray-400">
                                Date
                              </Table.ColumnHeaderCell>
                              <Table.ColumnHeaderCell className="text-gray-400">
                                Clan Points
                              </Table.ColumnHeaderCell>
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {competitionAwards.map(award => (
                              <Table.Row key={award.id}>
                                <Table.Cell className="text-white">
                                  <Flex align="center" gap="2">
                                    <Box className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
                                      <img
                                        src={award.imageUrl}
                                        alt=""
                                        className="max-h-7 max-w-7 object-contain"
                                      />
                                    </Box>
                                    {award.competitionId !== null ? (
                                      <Link
                                        to={`/events/${award.competitionId}`}
                                        className="transition-colors hover:text-sanguine-red"
                                      >
                                        <Text size="2" weight="medium">
                                          {award.competitionTitle}
                                        </Text>
                                      </Link>
                                    ) : (
                                      <Text size="2" weight="medium">
                                        {award.competitionTitle}
                                      </Text>
                                    )}
                                  </Flex>
                                </Table.Cell>
                                <Table.Cell className="whitespace-nowrap">
                                  {award.placement == null ? (
                                    <Text size="2" className="text-gray-600">
                                      —
                                    </Text>
                                  ) : award.placement <= 3 ? (
                                    <Text size="2" className="text-white">
                                      {rankBadge(award.placement)}
                                    </Text>
                                  ) : (
                                    <Text size="2" className="text-gray-400">
                                      Participant
                                    </Text>
                                  )}
                                </Table.Cell>
                                <Table.Cell className="whitespace-nowrap text-gray-300">
                                  {dayjs(award.createdAt).format('MMM D, YYYY')}
                                </Table.Cell>
                                <Table.Cell className="whitespace-nowrap font-medium text-amber-400">
                                  +{award.pointsGiven}
                                </Table.Cell>
                              </Table.Row>
                            ))}
                            {/* Awards that predate reliable competition records, rolled up */}
                            {historicalCompetitions && (
                              <Table.Row>
                                <Table.Cell>
                                  <Flex align="center" gap="2">
                                    <Box className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
                                      <img
                                        src={getFallbackImageUrl()}
                                        alt=""
                                        className="max-h-7 max-w-7 object-contain opacity-50"
                                      />
                                    </Box>
                                    <Text size="2" className="text-gray-400">
                                      Historical events ×
                                      {historicalCompetitions.count}
                                    </Text>
                                  </Flex>
                                </Table.Cell>
                                <Table.Cell className="whitespace-nowrap">
                                  <Text size="2" className="text-gray-600">
                                    —
                                  </Text>
                                </Table.Cell>
                                <Table.Cell className="whitespace-nowrap text-gray-400">
                                  {historicalRangeLabel}
                                </Table.Cell>
                                <Table.Cell className="whitespace-nowrap font-medium text-amber-400">
                                  +{historicalCompetitions.points}
                                </Table.Cell>
                              </Table.Row>
                            )}
                          </Table.Body>
                        </Table.Root>
                      </div>
                    </Box>
                  </Card>
                )}

                {/* Manual awards (event prizes, corrections) — one net figure, not a ledger */}
                {otherAwards && (
                  <Card className="border border-gray-800 bg-gray-900">
                    <Box p="5">
                      <Flex align="center" justify="between" gap="3">
                        <Heading size="4" className="text-white">
                          Other
                          <Text
                            size="2"
                            className="ml-2 font-normal text-gray-400"
                            as="span"
                          >
                            manual awards across {otherAwards.count}{' '}
                            {otherAwards.count === 1 ? 'entry' : 'entries'}
                          </Text>
                        </Heading>
                        <Text
                          size="4"
                          className={`font-medium ${
                            otherAwards.points < 0
                              ? 'text-red-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {otherAwards.points < 0
                            ? otherAwards.points
                            : `+${otherAwards.points}`}
                        </Text>
                      </Flex>
                    </Box>
                  </Card>
                )}
              </Flex>
            </Tabs.Content>
          )}

          {/* Drops — filtered by the account switcher */}
          {allItemsLogged.length > 0 && (
            <Tabs.Content value="drops">
              <Flex direction="column" gap="4" mt="4">
                {accountSwitcher}
                {filteredItems.length > 0 && (
                  <Card className="border border-gray-800 bg-gray-900">
                    <Box p="5">
                      <Flex direction="column">
                        {currentItems.map(item => (
                          <DropItem
                            key={item.id}
                            item={item}
                            showRecipient={false}
                            size="small"
                          />
                        ))}
                      </Flex>

                      <Pagination
                        page={currentPage}
                        totalPages={totalPages}
                        onPrev={() => setCurrentPage(p => Math.max(1, p - 1))}
                        onNext={() =>
                          setCurrentPage(p => Math.min(totalPages, p + 1))
                        }
                      />
                    </Box>
                  </Card>
                )}
                {filteredItems.length === 0 &&
                  selectedAccount !== ALL_ACCOUNTS && (
                    <Card className="border border-gray-800 bg-gray-900">
                      <Box p="5" className="py-12 text-center">
                        <Text size="3" className="text-gray-400">
                          No drops recorded for {selectedAccount}
                        </Text>
                      </Box>
                    </Card>
                  )}
              </Flex>
            </Tabs.Content>
          )}

          {/* Points chart — also filtered by the account switcher */}
          <Tabs.Content value="chart">
            <Flex direction="column" gap="4" mt="4">
              {accountSwitcher}
              <Card className="border border-gray-800 bg-gray-900">
                <Box p="5">
                  <Heading size="5" className="mb-4 text-white">
                    {selectedAccount === ALL_ACCOUNTS
                      ? mainName
                      : selectedAccount}{' '}
                    Drop Points Earned by Month
                  </Heading>

                  {filteredAuditData.length > 0 ? (
                    <Box className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={summedPointsByYearMonth}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#374151"
                          />
                          <XAxis
                            dataKey="date"
                            stroke="#9CA3AF"
                            fontSize={12}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis stroke="#9CA3AF" fontSize={12} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1F2937',
                              border: '1px solid #374151',
                              borderRadius: '8px',
                              color: '#F9FAFB',
                            }}
                            formatter={value => [
                              `${value} drop points`,
                              'Drop Points',
                            ]}
                          />
                          <Bar
                            dataKey="points"
                            fill="#BB2C23"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : (
                    <Box className="py-12 text-center">
                      <Text size="3" className="text-gray-400">
                        No drop points on record
                      </Text>
                    </Box>
                  )}
                </Box>
              </Card>
            </Flex>
          </Tabs.Content>
        </Tabs.Root>
      </Flex>
    </Container>
  );
}
