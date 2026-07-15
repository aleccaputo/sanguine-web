import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import {
  Link,
  ShouldRevalidateFunction,
  useLoaderData,
} from '@remix-run/react';
import { Box, Container, Flex, Table, Text } from '@radix-ui/themes';
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
import { ArticleTitle } from '~/components/ArticleTitle';
import { CategoriesFooter } from '~/components/CategoriesFooter';
import { ChipGroup } from '~/components/ChipGroup';
import { CoinsIcon } from '~/components/CoinsIcon';
import { ContentsBox } from '~/components/ContentsBox';
import { EmptyState } from '~/components/EmptyState';
import { Infobox, InfoboxBand, InfoboxRow } from '~/components/Infobox';
import { SectionHeading, SubsectionHeading } from '~/components/SectionHeading';
import {
  proseLinkClass,
  zebraRowClass,
  zebraStripeClass,
} from '~/utils/styles';
import { usePagination } from '~/utils/use-pagination';
import {
  getClanFromWom,
  getCompetitions,
} from '~/services/wom-api-service.server';
import {
  getGroupCollectionLog,
  getPlayerRecentItems,
} from '~/services/temple-api-service.server';
import {
  findClogMemberByName,
  resolveClogItemData,
} from '~/utils/collection-log';
import { ClogUnlockRow } from '~/components/ClogUnlockRow';
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
    ? `${data.user.nickname}'s Sanguine record: drops, personal bests, and clan points.`
    : 'A Sanguine member record: drops, personal bests, and clan points.';

  return [{ title }, { name: 'description', content: description }];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const discordId = params.id ?? '';

  // The Temple group log depends on nothing else — fetch it alongside the rest
  // so its round-trip overlaps the DB and WOM work. Temple being unreachable
  // just drops the collection log section, never the profile.
  const [
    user,
    userAuditData,
    sanguineWomMembers,
    userAlts,
    pbCategoryKeys,
    raidCompletions,
    templeClog,
  ] = await Promise.all([
    getUserWithNickname(discordId),
    getAuditDataForUserById(discordId),
    getClanFromWom(),
    getUserAlts(discordId),
    getPersonalBestCategoryKeysForDiscordId(discordId),
    getRaidCompletionsForDiscordId(discordId),
    getGroupCollectionLog().catch(() => null),
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

  // Collection log — opt-in TempleOSRS data covering whichever of the member's
  // accounts sync via the Temple RuneLite plugin.
  const clogAccounts = templeClog
    ? allAccountNames.flatMap(name => {
        const clogMember = findClogMemberByName(templeClog, name);
        return clogMember ? [{ name, clogMember }] : [];
      })
    : [];
  const clogSummaries = templeClog
    ? clogAccounts.map(({ name, clogMember }) => ({
        accountName: name,
        slots: clogMember.total_collections_finished,
        totalSlots: templeClog.total_collections_available,
      }))
    : [];
  // Recent unlocks per synced account — each account owns its own log, so the
  // section never merges them; the client filters by one account at a time.
  // Item resolution chains onto each account's fetch so wiki lookups overlap
  // Temple I/O. Temple only reports items obtained after an account's initial
  // sync.
  const clogUnlocks = (
    await Promise.all(
      clogAccounts.map(async ({ name }) => {
        const recentItems = await getPlayerRecentItems(name);
        return Promise.all(
          recentItems.map(async item => {
            const itemData = await resolveClogItemData(item);
            return {
              key: `${name}-${item.id}-${item.date_unix}`,
              name: itemData.name,
              icon: itemData.icon,
              date: item.date,
              accountName: name,
            };
          }),
        );
      }),
    )
  ).flat();

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
    clogSummaries,
    clogUnlocks,
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
    clogSummaries,
    clogUnlocks,
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

  const dropsPagination = usePagination(filteredItems, itemsPerPage);

  // Collection log — each account keeps its own log in-game, so the section
  // shows one synced account at a time (its own switcher, since the synced set
  // rarely matches the full account list). The infobox and lede lead with the
  // main account's log when it syncs.
  const mainClog =
    clogSummaries.find(summary => summary.accountName === mainName) ?? null;
  const primaryClog = mainClog ?? clogSummaries[0] ?? null;
  const otherClogs = clogSummaries.filter(summary => summary !== primaryClog);
  // Derived rather than seeded state: navigating to another member reuses this
  // component, and a choice that doesn't match the new member's synced
  // accounts must fall back to their primary log instead of sticking around.
  const [chosenClogAccount, setChosenClogAccount] = useState<string | null>(
    null,
  );
  const clogAccount =
    chosenClogAccount !== null &&
    clogSummaries.some(summary => summary.accountName === chosenClogAccount)
      ? chosenClogAccount
      : primaryClog?.accountName ?? '';
  const selectedClog =
    clogSummaries.find(summary => summary.accountName === clogAccount) ?? null;
  const accountClogUnlocks = useMemo(
    () => clogUnlocks.filter(unlock => unlock.accountName === clogAccount),
    [clogUnlocks, clogAccount],
  );
  const clogPagination = usePagination(accountClogUnlocks, itemsPerPage);
  const handleClogAccountChange = (value: string) => {
    setChosenClogAccount(value);
    clogPagination.reset();
  };

  // Raids paginate independently of drops — they ignore the account switcher, so their page
  // never needs resetting.
  const raidsPagination = usePagination(raids, itemsPerPage);

  const totalGP = filteredItems.reduce(
    (sum, item) => sum + (item.osrsData?.price || 0),
    0,
  );

  const handleAccountChange = (value: string) => {
    setSelectedAccount(value);
    dropsPagination.reset();
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
  // Contents); the chart always does, carrying its own empty state. Clan-point subsections
  // nest under their section (3.1, 3.2 …) exactly when their headers render.
  const sections: {
    id: string;
    title: string;
    count?: number;
    children?: { id: string; title: string }[];
  }[] = [
    ...(allItemsLogged.length > 0
      ? [{ id: 'drops', title: 'Drops', count: allItemsLogged.length }]
      : []),
    ...(clogUnlocks.length > 0
      ? [{ id: 'collection-log', title: 'Collection log' }]
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
      ? [
          {
            id: 'clan-points',
            title: 'Clan points',
            children:
              clanPointSources > 1
                ? [
                    ...(raids.length > 0
                      ? [{ id: 'raids', title: 'Raids' }]
                      : []),
                    ...(hasCompetitionHistory
                      ? [{ id: 'competitions', title: 'Competitions' }]
                      : []),
                    ...(otherAwards
                      ? [{ id: 'other-awards', title: 'Other' }]
                      : []),
                  ]
                : undefined,
          },
        ]
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
  // Top boss — where the member's fortune has come from, across all accounts.
  // Ranked by gp with drop count as the tiebreaker; drops without a recorded
  // boss don't count toward one.
  const topBoss = [
    ...allItemsLogged
      .reduce((map, item) => {
        if (!item.bossName) return map;
        const existing = map.get(item.bossName) ?? {
          count: 0,
          gp: 0,
          points: 0,
        };
        return map.set(item.bossName, {
          count: existing.count + 1,
          gp: existing.gp + (item.osrsData?.price ?? 0),
          points: existing.points + item.pointsGiven,
        });
      }, new Map<string, { count: number; gp: number; points: number }>())
      .entries(),
  ]
    .map(([bossName, totals]) => ({ bossName, ...totals }))
    .sort((a, b) => b.gp - a.gp || b.count - a.count)[0];
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
  const mainRole = womRoles[mainName] ?? 'Guest';
  const isGuest = !womRoles[mainName];
  const mainRankLabel = rankLabel(mainRole);
  // "the owner of Sanguine" for one-of-a-kind ranks, "a monarch" / "an officer" otherwise.
  // The monthly winner ranks are held by one member at a time, so they read as
  // "the current RotW winner of Sanguine".
  const rankArticle = ['owner', 'deputy owner'].includes(
    mainRankLabel.toLocaleLowerCase(),
  )
    ? 'the'
    : /^[aeiou]/i.test(mainRankLabel)
      ? 'an'
      : 'a';
  const isWinnerRank = ['blood', 'leader', 'skiller'].includes(
    mainRole.toLocaleLowerCase(),
  );
  const ledeRankPhrase = isGuest
    ? `${rankArticle} guest`
    : isWinnerRank
      ? `the current ${mainRankLabel}`
      : `${rankArticle} ${mainRankLabel}`;
  const hasAnyRecord =
    user.points > 0 ||
    user.clanPoints > 0 ||
    allItemsLogged.length > 0 ||
    personalBests.length > 0;
  // Categories footer — the wiki's bottom strip, generated from the record.
  const categories = [
    ...(isGuest ? [] : [mainRankLabel]),
    ...(raids.length > 0 ? ['Raiders'] : []),
    ...(pbGolds > 0 ? ['Clan record holders'] : []),
    ...(compPodiums > 0 ? ['Competition medalists'] : []),
  ];

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
    <ChipGroup
      options={accountOptions.map(option => ({
        key: option.key,
        label: option.label,
        iconSrc: option.role ? fetchRankImage(option.role) : undefined,
        iconAlt: option.role ? rankLabel(option.role) : undefined,
        count: dropCountByAccount[option.key] ?? 0,
      }))}
      value={selectedAccount}
      onChange={handleAccountChange}
    />
  );

  return (
    <Container size="4" mt="3" pb="6">
      {/* The member's page is their wiki article: a plain title over a hairline, an
          infobox with the vitals, a prose lede, a contents box, then sections. */}
      <ArticleTitle title={mainName} />

      <div className="flex flex-col gap-6 lg:flex-row-reverse lg:gap-8">
        {/* Infobox — a functional table of vitals, portrait on top, wiki-style. */}
        <Infobox>
          <InfoboxBand primary>{mainName}</InfoboxBand>
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
            <InfoboxRow label="Joined">
              {dayjs(user.joined).format('MMMM YYYY')}
            </InfoboxRow>
            {hasAlts && (
              <InfoboxRow label="Accounts">
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
                        <span className="text-base text-gray-200">
                          {option.label}
                        </span>
                      </Flex>
                    ))}
                </Flex>
              </InfoboxRow>
            )}
          </dl>
          {/* Second infobox band, wiki-style — vitals above, the clan record below */}
          <InfoboxBand>Clan record</InfoboxBand>
          <dl>
            <InfoboxRow label="Drop points" valueClassName="text-white">
              {user.points.toLocaleString()}
            </InfoboxRow>
            <InfoboxRow label="Clan points" valueClassName="text-osrs-gold">
              {user.clanPoints.toLocaleString()}
            </InfoboxRow>
            {allItemsLogged.length > 0 && (
              <InfoboxRow label="Drops logged">
                {allItemsLogged.length}
              </InfoboxRow>
            )}
            {primaryClog && (
              <InfoboxRow label="Log slots" valueClassName="text-white">
                {primaryClog.slots.toLocaleString()}{' '}
                <span className="text-gray-500">
                  of {primaryClog.totalSlots.toLocaleString()}
                </span>
                {!mainClog && (
                  <span className="block text-sm text-gray-500">
                    on {primaryClog.accountName}
                  </span>
                )}
                {otherClogs.map(summary => (
                  <span
                    key={summary.accountName}
                    className="block text-sm text-gray-500"
                  >
                    on {summary.accountName}: {summary.slots.toLocaleString()}
                  </span>
                ))}
              </InfoboxRow>
            )}
            {allDropsGP > 0 && (
              <InfoboxRow label="Loot value" valueClassName="text-osrs-gold">
                <CoinsIcon /> {allDropsGP.toLocaleString()} gp
              </InfoboxRow>
            )}
            {topBoss && (
              <InfoboxRow label="Top boss">
                {topBoss.bossName}
                <span className="block text-sm text-gray-500">
                  {topBoss.count} {topBoss.count === 1 ? 'drop' : 'drops'}
                  {topBoss.gp > 0 && (
                    <>
                      {' · '}
                      <span className="text-osrs-gold">
                        {topBoss.gp.toLocaleString()} gp
                      </span>
                    </>
                  )}
                  {topBoss.points > 0 && <> · {topBoss.points} pts</>}
                </span>
              </InfoboxRow>
            )}
            {raids.length > 0 && (
              <InfoboxRow label="Raids">{raids.length}</InfoboxRow>
            )}
            {totalComps > 0 && (
              <InfoboxRow label="Competitions">
                {totalComps}
                {compPodiums > 0 && (
                  <span className="ml-2 text-sm text-gray-400">
                    top three ×{compPodiums}
                  </span>
                )}
              </InfoboxRow>
            )}
            {personalBests.length > 0 && (
              <InfoboxRow label="Personal bests">
                {personalBests.length}
                {pbMedalSummary && (
                  <span className="ml-2 text-sm text-gray-400">
                    {pbMedalSummary}
                  </span>
                )}
              </InfoboxRow>
            )}
          </dl>
        </Infobox>

        <Box className="min-w-0 flex-1">
          {/* Lede — the article's opening paragraph, assembled from what the member has
              actually done. Totals here span all accounts. */}
          <Text as="p" size="3" className="mt-6 leading-7 text-gray-300">
            <strong className="font-medium text-white">{mainName}</strong> is{' '}
            {ledeRankPhrase} of{' '}
            <Link to="/" className={proseLinkClass}>
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
                The{' '}
                <Link to="/drops" className={proseLinkClass}>
                  drop log
                </Link>{' '}
                records{' '}
                <span className="text-white">{allItemsLogged.length}</span> of
                their finds, together worth{' '}
                <span className="text-osrs-gold">
                  {allDropsGP.toLocaleString()} gp
                </span>
                .
              </>
            )}
            {topBoss && topBoss.gp > 0 && (
              <>
                {' '}
                Their most profitable boss has been{' '}
                <a
                  href={`https://oldschool.runescape.wiki/w/${topBoss.bossName.replace(/ /g, '_')}`}
                  target="_blank"
                  rel="noreferrer"
                  className={proseLinkClass}
                >
                  {topBoss.bossName}
                </a>
                {/* Hard Mode variants already carry a colon — avoid "Hard Mode: 1 drop" */}
                {topBoss.bossName.includes(':') ? ', with' : ':'}{' '}
                <span className="text-white">{topBoss.count}</span>{' '}
                {topBoss.count === 1 ? 'drop' : 'drops'} worth{' '}
                <span className="text-osrs-gold">
                  {topBoss.gp.toLocaleString()} gp
                </span>
                {topBoss.points > 0 && (
                  <>
                    {' '}
                    and{' '}
                    <span className="text-white">
                      {topBoss.points} drop points
                    </span>
                  </>
                )}
                .
              </>
            )}
            {primaryClog && (
              <>
                {' '}
                Their{' '}
                <Link to="/collection-log" className={proseLinkClass}>
                  collection log
                </Link>{' '}
                fills{' '}
                <span className="text-white">
                  {primaryClog.slots.toLocaleString()}
                </span>{' '}
                of its {primaryClog.totalSlots.toLocaleString()} slots
                {!mainClog && <> on {primaryClog.accountName}</>}.
              </>
            )}
            {personalBests.length > 0 && (
              <>
                {' '}
                On the clan&apos;s{' '}
                <Link to="/personal-bests" className={proseLinkClass}>
                  personal-best boards
                </Link>{' '}
                they hold{' '}
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
            {!hasAnyRecord && <> So far, nothing interesting happens.</>}
          </Text>

          {/* A single-section article doesn't need a table of contents. */}
          {sections.length > 1 && <ContentsBox sections={sections} />}

          {/* Drops — filtered by the account switcher */}
          {allItemsLogged.length > 0 && (
            <section id="drops" className="mt-10 scroll-mt-20">
              <SectionHeading
                title="Drops"
                summary={
                  <Text size="2" className="text-gray-500">
                    <span className="text-white">{filteredItems.length}</span>{' '}
                    items
                    {totalGP > 0 && (
                      <>
                        {' worth '}
                        <CoinsIcon />{' '}
                        <span className="text-osrs-gold">
                          {totalGP.toLocaleString()}
                        </span>{' '}
                        gp
                      </>
                    )}
                  </Text>
                }
              />
              {hasAlts && <Box mt="3">{accountSwitcher}</Box>}
              {filteredItems.length > 0 ? (
                <Box mt="2">
                  {dropsPagination.pageItems.map(item => (
                    <div key={item.id} className={`px-2 ${zebraRowClass}`}>
                      <DropItem
                        item={item}
                        showRecipient={false}
                        size="small"
                      />
                    </div>
                  ))}
                  <Pagination
                    page={dropsPagination.page}
                    totalPages={dropsPagination.totalPages}
                    onPrev={dropsPagination.onPrev}
                    onNext={dropsPagination.onNext}
                  />
                </Box>
              ) : (
                <EmptyState />
              )}
            </section>
          )}

          {/* Collection log — one account's log at a time (they're separate
              in-game), switched by chips over the member's synced accounts.
              Temple only reports unlocks made after an account's initial sync,
              so this is a recent-history feed, not the full log. */}
          {clogUnlocks.length > 0 && (
            <section id="collection-log" className="mt-10 scroll-mt-20">
              <SectionHeading
                title="Collection log"
                summary={
                  selectedClog && (
                    <Text size="2" className="text-gray-500">
                      <span className="text-white">
                        {selectedClog.slots.toLocaleString()}
                      </span>{' '}
                      of {selectedClog.totalSlots.toLocaleString()} slots filled
                    </Text>
                  )
                }
              />
              {clogSummaries.length > 1 && (
                <Box mt="3">
                  <ChipGroup
                    options={clogSummaries.map(summary => ({
                      key: summary.accountName,
                      label: summary.accountName,
                      iconSrc: womRoles[summary.accountName]
                        ? fetchRankImage(womRoles[summary.accountName] ?? '')
                        : undefined,
                      iconAlt: womRoles[summary.accountName]
                        ? rankLabel(womRoles[summary.accountName] ?? '')
                        : undefined,
                      count: clogUnlocks.filter(
                        unlock => unlock.accountName === summary.accountName,
                      ).length,
                    }))}
                    value={clogAccount}
                    onChange={handleClogAccountChange}
                  />
                </Box>
              )}
              {accountClogUnlocks.length > 0 ? (
                <Box mt="2">
                  {clogPagination.pageItems.map(unlock => (
                    <div
                      key={unlock.key}
                      className={`px-2 ${zebraStripeClass}`}
                    >
                      <ClogUnlockRow unlock={unlock} />
                    </div>
                  ))}
                  <Pagination
                    page={clogPagination.page}
                    totalPages={clogPagination.totalPages}
                    onPrev={clogPagination.onPrev}
                    onNext={clogPagination.onNext}
                  />
                </Box>
              ) : (
                <EmptyState />
              )}
            </section>
          )}

          {/* Personal Bests — keyed to the member (discordId), so it spans every account
              and isn't affected by the account switcher. */}
          {personalBests.length > 0 && (
            <section id="personal-bests" className="mt-10 scroll-mt-20">
              <SectionHeading
                title="Personal bests"
                summary={
                  pbMedalSummary && (
                    <Text size="2" className="text-gray-400">
                      {pbMedalSummary}
                    </Text>
                  )
                }
              />
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
                      <Table.Row key={pb.categoryKey} className={zebraRowClass}>
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
              <SectionHeading
                title="Clan points"
                summary={
                  <Text size="2" className="whitespace-nowrap text-gray-500">
                    <span className="text-osrs-gold">
                      {user.clanPoints.toLocaleString()}
                    </span>{' '}
                    clan points
                  </Text>
                }
              />
              <Flex direction="column" gap="5" mt="4">
                {raids.length > 0 && (
                  <Box id="raids" className="scroll-mt-20">
                    {clanPointSources > 1 && (
                      <SubsectionHeading
                        title="Raids"
                        summary={
                          <Text
                            size="2"
                            className="whitespace-nowrap text-gray-500"
                          >
                            <span className="text-osrs-gold">
                              {raidsPointsTotal}
                            </span>{' '}
                            clan points
                          </Text>
                        }
                      />
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
                          {raidsPagination.pageItems.map(raid => (
                            <Table.Row key={raid.id} className={zebraRowClass}>
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
                      page={raidsPagination.page}
                      totalPages={raidsPagination.totalPages}
                      onPrev={raidsPagination.onPrev}
                      onNext={raidsPagination.onNext}
                    />
                  </Box>
                )}

                {hasCompetitionHistory && (
                  <Box id="competitions" className="scroll-mt-20">
                    {clanPointSources > 1 && (
                      <SubsectionHeading
                        title="Competitions"
                        hint="weeklies and one-off comps"
                        summary={
                          <Text
                            size="2"
                            className="whitespace-nowrap text-gray-500"
                          >
                            <span className="text-osrs-gold">
                              {competitionsPointsTotal}
                            </span>{' '}
                            clan points
                          </Text>
                        }
                      />
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
                            <Table.Row key={award.id} className={zebraRowClass}>
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
                            <Table.Row className={zebraStripeClass}>
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
                  <SubsectionHeading
                    id="other-awards"
                    title="Other"
                    hint={`manual awards across ${otherAwards.count} ${
                      otherAwards.count === 1 ? 'entry' : 'entries'
                    }`}
                    summary={
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
                    }
                  />
                )}
              </Flex>
            </section>
          )}

          {/* Points chart — filtered by the account switcher */}
          <section id="chart" className="mt-10 scroll-mt-20">
            <SectionHeading
              title="Points chart"
              summary={
                <Text size="2" className="text-gray-500">
                  drop points by month · {displayName}
                </Text>
              }
            />
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
              <EmptyState />
            )}
          </section>
        </Box>
      </div>

      {/* Categories — the wiki's footer strip, generated from the record */}
      <CategoriesFooter
        to="/users"
        primaryLabel={isGuest ? 'Sanguine guests' : 'Sanguine members'}
        categories={categories}
      />
    </Container>
  );
}
