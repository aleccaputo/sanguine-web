import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import {
  Link,
  ShouldRevalidateFunction,
  useLoaderData,
} from '@remix-run/react';
import { Box, Container, Flex, Heading, Table, Text } from '@radix-ui/themes';
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
import { fetchRankImage, rankLabel } from '~/utils/clan-ranks';
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

  const handleAccountChange = (value: string) => {
    setSelectedAccount(value);
    setCurrentPage(1);
  };

  const displayName =
    selectedAccount === ALL_ACCOUNTS ? mainName : selectedAccount;

  // Clan Points tab groups every clan-point source; the per-section totals reconcile the
  // header total. Raid points come from the flattened completions, the rest from audit rows.
  const raidsPointsTotal = raids.reduce((sum, r) => sum + r.pointsAwarded, 0);
  const hasCompetitionHistory =
    competitionAwards.length > 0 || historicalCompetitions !== null;
  const historicalRange = historicalCompetitions && {
    from: dayjs(historicalCompetitions.from).format('MMM YYYY'),
    to: dayjs(historicalCompetitions.to).format('MMM YYYY'),
  };
  const competitionsPointsTotal =
    competitionAwards.reduce((sum, a) => sum + a.pointsGiven, 0) +
    (historicalCompetitions?.points ?? 0);
  const hasClanPointHistory =
    raids.length > 0 || hasCompetitionHistory || otherAwards !== null;
  // Subsection headers exist to divide multiple point sources (their totals reconcile
  // the section figure). With a single source they'd just repeat the h2 total — skip them.
  const clanPointSources = [
    raids.length > 0,
    hasCompetitionHistory,
    otherAwards !== null,
  ].filter(Boolean).length;

  // The page reads as the member's wiki article: sections with data render (and appear in
  // Contents); the chart always does, carrying its own empty state.
  const sections: { id: string; title: string; count?: number }[] = [
    ...(allItemsLogged.length > 0
      ? [{ id: 'drops', title: 'Drops', count: allItemsLogged.length }]
      : []),
    ...(personalBests.length > 0
      ? [
          {
            id: 'personal-bests',
            title: 'Personal bests',
            count: personalBests.length,
          },
        ]
      : []),
    ...(hasClanPointHistory
      ? [{ id: 'clan-points', title: 'Clan points' }]
      : []),
    { id: 'chart', title: 'Points chart' },
  ];

  // Lede and infobox facts always span every account — the switcher only filters the
  // Drops and Points chart sections. The article's subject is the member, so the title
  // and infobox key off the main account too.
  const allDropsGP = allItemsLogged.reduce(
    (sum, item) => sum + (item.osrsData?.price || 0),
    0,
  );
  const pbGolds = personalBests.filter(pb => pb.rank === 1).length;
  const pbSilvers = personalBests.filter(pb => pb.rank === 2).length;
  const pbBronzes = personalBests.filter(pb => pb.rank === 3).length;
  const pbMedalSummary = (
    [
      ['🥇', pbGolds],
      ['🥈', pbSilvers],
      ['🥉', pbBronzes],
    ] as const
  )
    .filter(([, count]) => count > 0)
    .map(([medal, count]) => `${medal} ${count}`)
    .join(' · ');
  const compPodiums = competitionAwards.filter(
    award => award.placement != null && award.placement <= 3,
  ).length;
  // Historical awards are competitions too — they just predate placement records.
  const totalComps =
    competitionAwards.length + (historicalCompetitions?.count ?? 0);
  const raidTeammates = new Set(
    raids
      .flatMap(raid => raid.participantDiscordIds)
      .filter(id => id !== user.discordId),
  ).size;
  const mainRole = womRoles[mainName] ?? 'Guest';
  const isGuest = !womRoles[mainName];
  const mainRankLabel = rankLabel(mainRole);
  // "the owner of Sanguine" for one-of-a-kind ranks, "a monarch" / "an officer" otherwise.
  const rankArticle = ['owner', 'deputy owner'].includes(
    mainRankLabel.toLocaleLowerCase(),
  )
    ? 'the'
    : /^[aeiou]/i.test(mainRankLabel)
      ? 'an'
      : 'a';
  const hasAnyRecord =
    user.points > 0 ||
    user.clanPoints > 0 ||
    allItemsLogged.length > 0 ||
    personalBests.length > 0;

  // Shown inside the Drops and Points Chart tabs only — those are the sections it filters.
  // Personal Bests and Raids are keyed to the member and span every account.
  const accountOptions: { key: string; label: string; role?: string }[] = [
    { key: ALL_ACCOUNTS, label: 'All accounts' },
    { key: mainName, label: mainName, role: womRoles[mainName] },
    ...userAlts.map(alt => ({
      key: alt.altName,
      label: alt.altName,
      role: womRoles[alt.altName],
    })),
  ];
  const accountSwitcher = hasAlts && (
    <Flex align="center" gap="2" wrap="wrap">
      {accountOptions.map(option => {
        const active = selectedAccount === option.key;
        return (
          <button
            key={option.key}
            onClick={() => handleAccountChange(option.key)}
            className={`flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-sm ${
              active
                ? 'border-sanguine-red bg-sanguine-red text-white'
                : 'border-gray-800 bg-gray-900 text-gray-300 hover:border-gray-600 hover:text-white'
            }`}
          >
            {option.role && (
              <img
                src={fetchRankImage(option.role)}
                alt={rankLabel(option.role)}
                width={16}
                height={16}
                className="shrink-0 [image-rendering:pixelated]"
              />
            )}
            {option.label}
            <span className={active ? 'text-white/70' : 'text-gray-600'}>
              {dropCountByAccount[option.key] ?? 0}
            </span>
          </button>
        );
      })}
    </Flex>
  );

  return (
    <Container size="4" mt="3" pb="6">
      {/* The member's page is their wiki article: a plain title over a hairline, an
          infobox with the vitals, a prose lede, a contents box, then sections. */}
      <Box className="border-b border-gray-700 pb-2">
        <Heading size="8" className="font-normal text-sanguine-bright">
          {mainName}
        </Heading>
        <Text as="p" size="2" className="mt-1 text-gray-500">
          From the records of Sanguine
        </Text>
      </Box>

      <div className="flex flex-col gap-6 lg:flex-row-reverse lg:gap-8">
        {/* Infobox — a functional table of vitals, portrait on top, wiki-style. */}
        <aside className="mt-6 w-full shrink-0 self-start border border-gray-700 lg:w-80">
          <Text
            as="div"
            size="3"
            weight="medium"
            className="bg-sanguine-red px-3 py-1.5 text-center text-white"
          >
            {mainName}
          </Text>
          <Flex
            direction="column"
            align="center"
            gap="1"
            className="bg-sanguine-red/[0.04] px-3 py-5"
          >
            <img
              src={fetchRankImage(mainRole)}
              alt={mainRankLabel}
              width={56}
              height={56}
              className="[image-rendering:pixelated]"
            />
            <Text size="2" className="text-gray-400">
              {mainRankLabel}
            </Text>
          </Flex>
          <dl>
            <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 border-t border-gray-800 px-3 py-2">
              <dt className="text-sm text-gray-500">Joined</dt>
              <dd className="text-sm text-gray-200">
                {dayjs(user.joined).format('MMMM YYYY')}
              </dd>
            </div>
            <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 border-t border-gray-800 px-3 py-2">
              <dt className="text-sm text-gray-500">Drop points</dt>
              <dd className="text-sm text-white">
                {user.points.toLocaleString()}
              </dd>
            </div>
            <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 border-t border-gray-800 px-3 py-2">
              <dt className="text-sm text-gray-500">Clan points</dt>
              <dd className="text-sm text-osrs-gold">
                {user.clanPoints.toLocaleString()}
              </dd>
            </div>
            {allItemsLogged.length > 0 && (
              <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 border-t border-gray-800 px-3 py-2">
                <dt className="text-sm text-gray-500">Drops logged</dt>
                <dd className="text-sm text-gray-200">
                  {allItemsLogged.length}
                </dd>
              </div>
            )}
            {allDropsGP > 0 && (
              <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 border-t border-gray-800 px-3 py-2">
                <dt className="text-sm text-gray-500">Loot value</dt>
                <dd className="text-sm text-osrs-gold">
                  <img
                    src="https://oldschool.runescape.wiki/images/Coins_detail.png"
                    alt=""
                    className="inline h-3.5 w-3.5 object-contain align-[-2px]"
                  />{' '}
                  {allDropsGP.toLocaleString()} gp
                </dd>
              </div>
            )}
            {raids.length > 0 && (
              <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 border-t border-gray-800 px-3 py-2">
                <dt className="text-sm text-gray-500">Raids</dt>
                <dd className="text-sm text-gray-200">{raids.length}</dd>
              </div>
            )}
            {personalBests.length > 0 && (
              <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 border-t border-gray-800 px-3 py-2">
                <dt className="text-sm text-gray-500">Personal bests</dt>
                <dd className="text-sm text-gray-200">
                  {personalBests.length}
                  {pbMedalSummary && (
                    <span className="ml-2 text-gray-400">{pbMedalSummary}</span>
                  )}
                </dd>
              </div>
            )}
            {hasAlts && (
              <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 border-t border-gray-800 px-3 py-2">
                <dt className="text-sm text-gray-500">Accounts</dt>
                <dd>
                  <Flex direction="column" gap="1">
                    {accountOptions
                      .filter(option => option.key !== ALL_ACCOUNTS)
                      .map(option => (
                        <Flex key={option.key} align="center" gap="2">
                          {option.role && (
                            <img
                              src={fetchRankImage(option.role)}
                              alt={rankLabel(option.role)}
                              width={16}
                              height={16}
                              className="shrink-0 [image-rendering:pixelated]"
                            />
                          )}
                          <span className="text-sm text-gray-200">
                            {option.label}
                          </span>
                        </Flex>
                      ))}
                  </Flex>
                </dd>
              </div>
            )}
          </dl>
        </aside>

        <Box className="min-w-0 flex-1">
          {/* Lede — the article's opening paragraph, assembled from what the member has
              actually done. Totals here span all accounts. */}
          <Text as="p" size="3" className="mt-6 leading-7 text-gray-300">
            <strong className="font-medium text-white">{mainName}</strong> is{' '}
            {rankArticle} {isGuest ? 'guest' : mainRankLabel} of{' '}
            <Link
              to="/"
              className="text-sanguine-bright transition-colors hover:text-white"
            >
              Sanguine
            </Link>
            , {isGuest ? 'on the record' : 'a member'} since{' '}
            {dayjs(user.joined).format('MMMM YYYY')}
            {hasAlts && <>, playing across {1 + userAlts.length} accounts</>}.
            {(user.points > 0 || user.clanPoints > 0) && (
              <>
                {' '}
                To date they have earned
                {user.points > 0 && (
                  <>
                    {' '}
                    <span className="text-white">
                      {user.points.toLocaleString()} drop points
                    </span>
                  </>
                )}
                {user.points > 0 && user.clanPoints > 0 && ' and'}
                {user.clanPoints > 0 && (
                  <>
                    {' '}
                    <span className="text-osrs-gold">
                      {user.clanPoints.toLocaleString()} clan points
                    </span>
                  </>
                )}
                .
              </>
            )}
            {allItemsLogged.length > 0 && (
              <>
                {' '}
                The drop log records{' '}
                <span className="text-white">{allItemsLogged.length}</span> of
                their finds, together worth{' '}
                <span className="text-osrs-gold">
                  {allDropsGP.toLocaleString()} gp
                </span>
                .
              </>
            )}
            {personalBests.length > 0 && (
              <>
                {' '}
                On the clan&apos;s personal-best boards they hold{' '}
                <span className="text-white">{personalBests.length}</span>{' '}
                {personalBests.length === 1 ? 'time' : 'times'}
                {pbGolds > 0 && (
                  <>
                    ,{' '}
                    <span className="text-osrs-gold">
                      {pbGolds} of them clan records
                    </span>
                  </>
                )}
                .
              </>
            )}
            {raids.length > 0 && (
              <>
                {' '}
                They have run{' '}
                <span className="text-white">{raids.length}</span> clan{' '}
                {raids.length === 1 ? 'raid' : 'raids'}
                {raidTeammates > 0 && (
                  <>
                    {' '}
                    alongside{' '}
                    <span className="text-white">{raidTeammates}</span>{' '}
                    different{' '}
                    {raidTeammates === 1 ? 'teammate' : 'teammates'}
                  </>
                )}
                .
              </>
            )}
            {totalComps > 0 && (
              <>
                {' '}
                They have entered{' '}
                <span className="text-white">{totalComps}</span> clan{' '}
                {totalComps === 1 ? 'competition' : 'competitions'}
                {compPodiums > 0 && (
                  <>
                    , finishing top three in{' '}
                    <span className="text-white">{compPodiums}</span>
                  </>
                )}
                .
              </>
            )}
            {!hasAnyRecord && <> So far, nothing interesting happens.</>}
          </Text>

          {/* Contents — numbered because the sections genuinely are ordered below.
              A single-section article doesn't need a table of contents. */}
          {sections.length > 1 && (
          <nav className="mt-6 inline-block border border-gray-800 bg-gray-900 px-5 py-3">
            <Text as="p" size="2" weight="medium" className="text-gray-300">
              Contents
            </Text>
            <ol className="mt-2 space-y-1">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-sm text-sanguine-bright transition-colors hover:text-white"
                  >
                    <span className="mr-2 text-gray-600">{index + 1}.</span>
                    {section.title}
                    {section.count !== undefined && (
                      <span className="text-gray-600"> ({section.count})</span>
                    )}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          )}

          {/* Drops — filtered by the account switcher */}
          {allItemsLogged.length > 0 && (
            <section id="drops" className="mt-10 scroll-mt-20">
              <Flex
                align="baseline"
                justify="between"
                gap="3"
                wrap="wrap"
                className="border-b border-gray-700 pb-1"
              >
                <Heading size="5" className="font-normal text-gray-100">
                  Drops
                </Heading>
                <Text size="2" className="text-gray-500">
                  <span className="text-white">{filteredItems.length}</span>{' '}
                  items
                  {totalGP > 0 && (
                    <>
                      {' worth '}
                      <img
                        src="https://oldschool.runescape.wiki/images/Coins_detail.png"
                        alt=""
                        className="inline h-3.5 w-3.5 object-contain align-[-2px]"
                      />{' '}
                      <span className="text-osrs-gold">
                        {totalGP.toLocaleString()}
                      </span>{' '}
                      gp
                    </>
                  )}
                </Text>
              </Flex>
              {hasAlts && <Box mt="3">{accountSwitcher}</Box>}
              {filteredItems.length > 0 ? (
                <Box mt="2">
                  {currentItems.map(item => (
                    <div
                      key={item.id}
                      className="px-2 even:bg-sanguine-red/[0.03] hover:bg-sanguine-red/[0.06]"
                    >
                      <DropItem
                        item={item}
                        showRecipient={false}
                        size="small"
                      />
                    </div>
                  ))}
                  <Pagination
                    page={currentPage}
                    totalPages={totalPages}
                    onPrev={() => setCurrentPage(p => Math.max(1, p - 1))}
                    onNext={() =>
                      setCurrentPage(p => Math.min(totalPages, p + 1))
                    }
                  />
                </Box>
              ) : (
                <Text as="p" align="center" className="py-12 text-gray-600">
                  Nothing interesting happens.
                </Text>
              )}
            </section>
          )}

          {/* Personal Bests — keyed to the member (discordId), so it spans every account
              and isn't affected by the account switcher. */}
          {personalBests.length > 0 && (
            <section id="personal-bests" className="mt-10 scroll-mt-20">
              <Flex
                align="baseline"
                justify="between"
                gap="3"
                wrap="wrap"
                className="border-b border-gray-700 pb-1"
              >
                <Heading size="5" className="font-normal text-gray-100">
                  Personal bests
                </Heading>
                {pbMedalSummary && (
                  <Text size="2" className="text-gray-400">
                    {pbMedalSummary}
                  </Text>
                )}
              </Flex>
              <Box mt="2" className="overflow-x-auto">
                <Table.Root size="2">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell className="text-osrs-orange">
                        Boss / Raid
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell className="text-osrs-orange">
                        Time
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell
                        className="text-osrs-orange"
                        align="center"
                      >
                        Clan Rank
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell className="hidden text-osrs-orange sm:table-cell">
                        Team
                      </Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell className="hidden text-osrs-orange sm:table-cell">
                        Proof
                      </Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {personalBests.map(pb => (
                      <Table.Row
                        key={pb.categoryKey}
                        className="even:bg-sanguine-red/[0.03] hover:bg-sanguine-red/[0.06]"
                      >
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
                                (pbBossCounts.get(pb.bossName) ?? 0) > 1) && (
                                <Text size="1" className="text-gray-400">
                                  {formatScaleLabel(pb.scale, pb.raidLevel)}
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
                        <Table.Cell className="whitespace-nowrap font-medium text-osrs-gold">
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
                              {pb.totalEntries > 1 && `of ${pb.totalEntries}`}
                            </Text>
                          </Flex>
                        </Table.Cell>
                        <Table.Cell className="hidden sm:table-cell">
                          <PbTeam
                            participantDiscordIds={
                              pb.best.participantDiscordIds
                            }
                            participantAltNames={pb.best.participantAltNames}
                            nameByDiscordId={pbNameByDiscordId}
                          />
                        </Table.Cell>
                        <Table.Cell className="hidden sm:table-cell">
                          {pb.best.proofMessageUrl ? (
                            <a
                              href={pb.best.proofMessageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-gray-400 transition-colors hover:text-sanguine-bright"
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
              </Box>
            </section>
          )}

          {/* Clan Points — everything paying into the clan bucket: raid completions,
              competition rewards (BOTW/SOTW/RoTW), and manual adjustments. Like PBs, keyed
              to the member (discordId) so it spans every account and ignores the account
              switcher. Each subsection carries its own total so the header figure
              reconciles. */}
          {hasClanPointHistory && (
            <section id="clan-points" className="mt-10 scroll-mt-20">
              <Flex
                align="baseline"
                justify="between"
                gap="3"
                wrap="wrap"
                className="border-b border-gray-700 pb-1"
              >
                <Heading size="5" className="font-normal text-gray-100">
                  Clan points
                </Heading>
                <Text size="2" className="whitespace-nowrap text-gray-500">
                  <span className="text-osrs-gold">
                    {user.clanPoints.toLocaleString()}
                  </span>{' '}
                  clan points
                </Text>
              </Flex>
              <Flex direction="column" gap="5" mt="4">
                {raids.length > 0 && (
                  <Box>
                    {clanPointSources > 1 && (
                      <Flex
                        align="baseline"
                        justify="between"
                        className="pb-1 pt-2"
                      >
                        <Text size="3" className="text-osrs-orange">
                          Raids
                        </Text>
                        <Text
                          size="2"
                          className="whitespace-nowrap text-gray-500"
                        >
                          <span className="text-osrs-gold">
                            {raidsPointsTotal}
                          </span>{' '}
                          clan points
                        </Text>
                      </Flex>
                    )}
                    <div className="overflow-x-auto">
                      <Table.Root size="2">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeaderCell className="text-osrs-orange">
                              Raid
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell className="hidden text-osrs-orange sm:table-cell">
                              Team
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell className="text-osrs-orange">
                              Date
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell
                              className="whitespace-nowrap text-osrs-orange"
                              align="right"
                            >
                              Clan pts
                            </Table.ColumnHeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {currentRaids.map(raid => (
                            <Table.Row
                              key={raid.id}
                              className="even:bg-sanguine-red/[0.03] hover:bg-sanguine-red/[0.06]"
                            >
                              <Table.Cell className="text-white">
                                <Flex align="center" gap="2">
                                  <Box className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
                                    <img
                                      src={
                                        pbBossImageByName[raid.raidDisplayName]
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
                                      <span className="whitespace-nowrap text-xs text-osrs-gold">
                                        ×2 RotW
                                      </span>
                                    )}
                                  </Flex>
                                </Flex>
                              </Table.Cell>
                              <Table.Cell className="hidden sm:table-cell">
                                <PbTeam
                                  participantDiscordIds={
                                    raid.participantDiscordIds
                                  }
                                  nameByDiscordId={pbNameByDiscordId}
                                />
                              </Table.Cell>
                              <Table.Cell className="whitespace-nowrap text-gray-400">
                                {dayjs(raid.approvedAt).format('MMM D, YYYY')}
                              </Table.Cell>
                              <Table.Cell
                                align="right"
                                className="whitespace-nowrap font-medium text-osrs-gold"
                              >
                                {raid.capped && raid.pointsAwarded === 0 ? (
                                  <Text size="2" className="text-gray-500">
                                    capped
                                  </Text>
                                ) : (
                                  `+${raid.pointsAwarded}`
                                )}
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
                )}

                {hasCompetitionHistory && (
                  <Box>
                    {clanPointSources > 1 && (
                      <Flex
                        align="baseline"
                        justify="between"
                        className="pb-1 pt-2"
                      >
                        <Text size="3" className="text-osrs-orange">
                          Competitions{' '}
                          <span className="hidden text-gray-600 sm:inline">
                            weeklies and one-off comps
                          </span>
                        </Text>
                        <Text
                          size="2"
                          className="whitespace-nowrap text-gray-500"
                        >
                          <span className="text-osrs-gold">
                            {competitionsPointsTotal}
                          </span>{' '}
                          clan points
                        </Text>
                      </Flex>
                    )}
                    <div className="overflow-x-auto">
                      <Table.Root size="2">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeaderCell className="text-osrs-orange">
                              Competition
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell className="hidden text-osrs-orange sm:table-cell">
                              Place
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell className="text-osrs-orange">
                              Date
                            </Table.ColumnHeaderCell>
                            <Table.ColumnHeaderCell
                              className="whitespace-nowrap text-osrs-orange"
                              align="right"
                            >
                              Clan pts
                            </Table.ColumnHeaderCell>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {competitionAwards.map(award => (
                            <Table.Row
                              key={award.id}
                              className="even:bg-sanguine-red/[0.03] hover:bg-sanguine-red/[0.06]"
                            >
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
                                      className="transition-colors hover:text-sanguine-bright"
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
                              <Table.Cell className="hidden whitespace-nowrap sm:table-cell">
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
                              <Table.Cell className="text-gray-400">
                                {/* Breakable only at the comma, so narrow screens get
                                    "Jun 25," / "2026" instead of a word-per-line date. */}
                                <span className="whitespace-nowrap">
                                  {dayjs(award.createdAt).format('MMM D,')}
                                </span>{' '}
                                <span className="whitespace-nowrap">
                                  {dayjs(award.createdAt).format('YYYY')}
                                </span>
                              </Table.Cell>
                              <Table.Cell
                                align="right"
                                className="whitespace-nowrap font-medium text-osrs-gold"
                              >
                                +{award.pointsGiven}
                              </Table.Cell>
                            </Table.Row>
                          ))}
                          {/* Awards that predate reliable competition records, rolled up */}
                          {historicalCompetitions && (
                            <Table.Row className="even:bg-sanguine-red/[0.03]">
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
                              <Table.Cell className="hidden whitespace-nowrap sm:table-cell">
                                <Text size="2" className="text-gray-600">
                                  —
                                </Text>
                              </Table.Cell>
                              <Table.Cell className="text-gray-400">
                                {historicalRange &&
                                  (historicalRange.from ===
                                  historicalRange.to ? (
                                    <span className="whitespace-nowrap">
                                      {historicalRange.from}
                                    </span>
                                  ) : (
                                    <>
                                      <span className="whitespace-nowrap">
                                        {historicalRange.from} –
                                      </span>{' '}
                                      <span className="whitespace-nowrap">
                                        {historicalRange.to}
                                      </span>
                                    </>
                                  ))}
                              </Table.Cell>
                              <Table.Cell
                                align="right"
                                className="whitespace-nowrap font-medium text-osrs-gold"
                              >
                                +{historicalCompetitions.points}
                              </Table.Cell>
                            </Table.Row>
                          )}
                        </Table.Body>
                      </Table.Root>
                    </div>
                  </Box>
                )}

                {/* Manual awards (event prizes, corrections) — one net figure, not a ledger */}
                {otherAwards && (
                  <Flex
                    align="baseline"
                    justify="between"
                    gap="3"
                    className="pb-1 pt-2"
                  >
                    <Text size="3" className="text-osrs-orange">
                      Other{' '}
                      <span className="hidden text-gray-600 sm:inline">
                        manual awards across {otherAwards.count}{' '}
                        {otherAwards.count === 1 ? 'entry' : 'entries'}
                      </span>
                    </Text>
                    <Text
                      size="2"
                      className={`font-medium ${
                        otherAwards.points < 0
                          ? 'text-red-400'
                          : 'text-osrs-gold'
                      }`}
                    >
                      {otherAwards.points < 0
                        ? otherAwards.points
                        : `+${otherAwards.points}`}
                    </Text>
                  </Flex>
                )}
              </Flex>
            </section>
          )}

          {/* Points chart — filtered by the account switcher */}
          <section id="chart" className="mt-10 scroll-mt-20">
            <Flex
              align="baseline"
              justify="between"
              gap="3"
              wrap="wrap"
              className="border-b border-gray-700 pb-1"
            >
              <Heading size="5" className="font-normal text-gray-100">
                Points chart
              </Heading>
              <Text size="2" className="text-gray-500">
                drop points by month · {displayName}
              </Text>
            </Flex>
            {hasAlts && <Box mt="3">{accountSwitcher}</Box>}
            {filteredAuditData.length > 0 ? (
              <Box className="mt-3 h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summedPointsByYearMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
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
                      cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                      contentStyle={{
                        backgroundColor: '#111113',
                        border: '1px solid #374151',
                        borderRadius: '2px',
                        color: '#F9FAFB',
                      }}
                      formatter={value => [
                        `${value} drop points`,
                        'Drop Points',
                      ]}
                    />
                    <Bar dataKey="points" fill="#BB2C23" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <Text as="p" align="center" className="py-12 text-gray-600">
                Nothing interesting happens.
              </Text>
            )}
          </section>
        </Box>
      </div>
    </Container>
  );
}
