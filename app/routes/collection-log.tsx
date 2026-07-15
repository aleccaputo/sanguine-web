import { json, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData, useNavigate } from '@remix-run/react';
import { useState } from 'react';
import dayjs from 'dayjs';
import { Box, Container, Flex, Select, Text } from '@radix-ui/themes';
import { getRsnMemberBridge } from '~/services/member-lookup.server';
import {
  getClogCategories,
  getClogItemNames,
  getGroupCollectionLog,
  getGroupRecentNotableItems,
  TEMPLE_GROUP_URL,
} from '~/services/temple-api-service.server';
import { fetchRankImage, rankLabel } from '~/utils/clan-ranks';
import { PageHeader } from '~/components/PageHeader';
import {
  LeaderBand,
  ILeaderBoard,
  ILeaderEntry,
} from '~/components/LeaderBand';
import { SectionHeading } from '~/components/SectionHeading';
import { SortableHeaderButton } from '~/components/SortableHeaderButton';
import { ClogUnlockStrip } from '~/components/ClogUnlockStrip';
import { EmptyState } from '~/components/EmptyState';
import {
  proseLinkClass,
  zebraRowClass,
  zebraStripeClass,
} from '~/utils/styles';
import {
  CATEGORY_GROUP_LABELS,
  COLLECTION_LOG_ICON,
  formatCategoryName,
  normalizeRsn,
  resolveClogItemData,
  type ITempleClogCategories,
} from '~/utils/collection-log';
import { useSelectGhostClickGuard } from '~/utils/use-select-ghost-click';

type SortField = 'slots' | 'categories' | 'name' | 'lastSynced';
type SortDirection = 'asc' | 'desc';

export const meta: MetaFunction = () => {
  return [
    { title: 'Sanguine Collection Log' },
    {
      name: 'description',
      content:
        "The clan's collective collection log: slots filled, recent unlocks, and what Sanguine has never seen drop.",
    },
  ];
};

export async function loader() {
  // Each Temple call settles independently: the group log is the page's
  // backbone, but a flaky recent-items or categories endpoint should only
  // degrade its own section, never discard the others' successful results.
  // Unlock icon resolution chains onto its own fetch so the wiki round-trip
  // overlaps the slower group log instead of queuing behind it.
  const [
    { discordIdByRsn, roleByRsn },
    groupClog,
    resolvedRecentItems,
    clogCategories,
    itemNames,
  ] = await Promise.all([
    getRsnMemberBridge(),
    getGroupCollectionLog().catch(() => null),
    getGroupRecentNotableItems()
      .then(recentItems =>
        Promise.all(
          recentItems.map(async item => ({
            item,
            itemData: await resolveClogItemData(item),
          })),
        ),
      )
      .catch(() => []),
    getClogCategories().catch(() => null),
    getClogItemNames().catch(() => ({}) as Record<string, string>),
  ]);

  // Temple being unreachable shouldn't take the page down with a 500 — render
  // the header with an empty state instead.
  if (groupClog === null) {
    return json({
      available: false as const,
      templeGroupUrl: TEMPLE_GROUP_URL,
    });
  }

  // Display names come from Temple's capitalization field (the RSN as it reads
  // in-game); the normalized `player` field is only for matching.
  const members = groupClog.members.map(member => ({
    name: member.player_name_with_capitalization || member.player,
    slots: member.total_collections_finished,
    categories: member.total_categories_finished,
    lastSynced: member.last_changed,
    discordId: discordIdByRsn.get(normalizeRsn(member.player)) ?? null,
    role: roleByRsn.get(normalizeRsn(member.player)) ?? null,
  }));

  // The clan's collective log: an item counts as owned when any synced member
  // has it. No categories data means no clan-log section, nothing more.
  const ownedItemIds = new Set(groupClog.members.flatMap(m => m.items));
  const coverageGroups =
    clogCategories === null
      ? []
      : (
          Object.entries(CATEGORY_GROUP_LABELS) as [
            keyof ITempleClogCategories,
            string,
          ][]
        ).map(([groupKey, label]) => ({
          key: groupKey,
          label,
          categories: Object.entries(clogCategories[groupKey]).map(
            ([categoryKey, itemIds]) => {
              const missing = itemIds.filter(id => !ownedItemIds.has(id));
              return {
                key: categoryKey,
                name: formatCategoryName(categoryKey),
                total: itemIds.length,
                owned: itemIds.length - missing.length,
                missingCount: missing.length,
                // Naming every gap would bloat the payload; near-complete
                // categories are the interesting ones, so name the last few
                // missing items only.
                missingNames:
                  missing.length > 0 && missing.length <= 3
                    ? missing.map(id => itemNames[String(id)] ?? `Item ${id}`)
                    : [],
              };
            },
          ),
        }));
  const allCategories = coverageGroups.flatMap(group => group.categories);
  const completedCategories = allCategories.filter(
    category => category.owned === category.total,
  ).length;

  const recentUnlocks = resolvedRecentItems.map(({ item, itemData }) => ({
    key: `${item.id}-${item.player}-${item.date_unix}`,
    name: itemData.name,
    icon: itemData.icon,
    date: item.date,
    player: {
      name: item.player_name_with_capitalization || item.player,
      discordId: discordIdByRsn.get(normalizeRsn(item.player)),
    },
  }));

  return json(
    {
      available: true as const,
      templeGroupUrl: TEMPLE_GROUP_URL,
      syncedCount: groupClog.members_with_items_synced,
      slotsOwned: ownedItemIds.size,
      slotsTotal: groupClog.total_collections_available,
      categoriesCompleted: completedCategories,
      categoriesTotal: groupClog.total_categories_available,
      members,
      recentUnlocks,
      coverageGroups,
    },
    {
      headers: {
        'Cache-Control': 'max-age=300',
      },
    },
  );
}

export default function CollectionLog() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('slots');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [coverageGroupKey, setCoverageGroupKey] = useState('bosses');

  // On the stacked mobile layout the category Select can open over clickable
  // collector rows — guard against the Radix ghost click.
  const { onSelectOpenChange, isGhostClick } = useSelectGhostClickGuard();
  const navigateToUser = (discordId: string | null) => {
    if (!discordId || isGhostClick()) return;
    navigate(`/users/${discordId}`);
  };

  if (!data.available) {
    return (
      <Container size="3" mt="3">
        <PageHeader title="Collection Log" iconSrc={COLLECTION_LOG_ICON}>
          The clan&apos;s collective collection log, synced from{' '}
          <a
            href={data.templeGroupUrl}
            target="_blank"
            rel="noreferrer"
            className={proseLinkClass}
          >
            TempleOSRS
          </a>
          .
        </PageHeader>
        <EmptyState>
          The log&apos;s pages are stuck together. TempleOSRS isn&apos;t
          answering; try again shortly.
        </EmptyState>
      </Container>
    );
  }

  const {
    templeGroupUrl,
    syncedCount,
    slotsOwned,
    slotsTotal,
    categoriesCompleted,
    categoriesTotal,
    members,
    recentUnlocks,
    coverageGroups,
  } = data;

  const sortedMembers = [...members].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    const slotsTiebreak = b.slots - a.slots;
    switch (sortField) {
      case 'name':
        return direction * a.name.localeCompare(b.name) || slotsTiebreak;
      case 'categories':
        return direction * (a.categories - b.categories) || slotsTiebreak;
      case 'lastSynced':
        return (
          direction * a.lastSynced.localeCompare(b.lastSynced) || slotsTiebreak
        );
      case 'slots':
      default:
        return direction * (a.slots - b.slots) || b.categories - a.categories;
    }
  });

  const onSortColumn = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(direction => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    // Numeric and recency columns lead with the fullest logs; name reads A-Z.
    setSortDirection(field === 'name' ? 'asc' : 'desc');
  };

  type Collector = (typeof members)[number];
  const topThree = (
    compare: (a: Collector, b: Collector) => number,
    value: (member: Collector) => number,
  ): ILeaderEntry[] =>
    [...members]
      .sort(compare)
      .slice(0, 3)
      .map(member => ({
        key: member.name,
        iconSrc: fetchRankImage(member.role ?? 'Guest'),
        iconAlt: rankLabel(member.role ?? 'Guest'),
        label: member.name,
        value: value(member).toLocaleString(),
        onClick: member.discordId
          ? () => navigateToUser(member.discordId)
          : undefined,
      }));
  const leaderBoards: ILeaderBoard[] = [
    {
      key: 'slots',
      title: 'Most log slots filled',
      valueClassName: 'text-white',
      entries: topThree(
        (a, b) => b.slots - a.slots,
        member => member.slots,
      ),
    },
    {
      key: 'categories',
      title: 'Most categories completed',
      valueClassName: 'text-white',
      entries: topThree(
        (a, b) => b.categories - a.categories || b.slots - a.slots,
        member => member.categories,
      ),
    },
  ];

  const sortColumns: {
    field: SortField;
    label: string;
    align: 'left' | 'right';
    className: string;
  }[] = [
    { field: 'name', label: 'Member', align: 'left', className: '' },
    {
      field: 'slots',
      label: 'Log slots',
      align: 'right',
      className: 'justify-end',
    },
    {
      field: 'categories',
      label: 'Categories',
      align: 'right',
      className: 'justify-end',
    },
    {
      field: 'lastSynced',
      label: 'Last synced',
      align: 'right',
      className: 'hidden justify-end md:flex',
    },
  ];

  // Three tiers: phones get the compact grid (no Last synced), md gets the
  // full-width roster grid, and lg — where the table shares the row with the
  // clan log — drops back to narrower fixed columns that fit a half column.
  const rowGridClass =
    'grid grid-cols-[24px_1fr_76px_76px] items-center gap-2 px-2 md:grid-cols-[40px_1fr_110px_110px_130px] md:gap-3 md:px-3 lg:grid-cols-[28px_1fr_84px_84px_100px] lg:gap-2 lg:px-2';

  // Clan log rows share the collectors table's paddings so the two header
  // rows sit on the same line when the sections render side by side.
  const coverageGridClass =
    'grid grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)_64px] items-center gap-2 px-2 md:gap-3 md:px-3 lg:gap-2 lg:px-2';

  const activeCoverageGroup =
    coverageGroups.find(group => group.key === coverageGroupKey) ??
    coverageGroups[0];

  return (
    <Container size="4" mt="3" pb="6">
      <Flex direction="column">
        <PageHeader title="Collection Log" iconSrc={COLLECTION_LOG_ICON}>
          <span className="font-semibold text-sanguine-bright">
            {syncedCount}
          </span>{' '}
          members sync their collection logs on{' '}
          <a
            href={templeGroupUrl}
            target="_blank"
            rel="noreferrer"
            className={proseLinkClass}
          >
            TempleOSRS
          </a>
          . Between them the clan has filled{' '}
          <span className="font-semibold text-white">
            {slotsOwned.toLocaleString()}
          </span>{' '}
          of the log&apos;s{' '}
          <span className="font-semibold text-white">
            {slotsTotal.toLocaleString()}
          </span>{' '}
          slots
          {coverageGroups.length > 0 && (
            <>
              {' '}
              and completed{' '}
              <span className="font-semibold text-white">
                {categoriesCompleted}
              </span>{' '}
              of {categoriesTotal} categories
            </>
          )}
          .
        </PageHeader>

        {/* Recent unlocks marquee: the notable finds — pets, 3rd age, the
            things the gp-based drop log can't see — scrolling sideways in
            their own strip */}
        {recentUnlocks.length > 0 && (
          <ClogUnlockStrip
            title="Recent notable unlocks"
            unlocks={recentUnlocks}
          />
        )}

        <LeaderBand boards={leaderBoards} />

        {/* Collectors and the clan log share the row on large screens so the
            clan log isn't buried under 40+ roster rows; they stack on mobile.
            A red rule divides the columns; the clan log's Select trigger is
            height-capped (h-8, below the h2) so both heading rules and table
            headers sit on the same lines. Collectors takes the full row when
            categories data is unavailable. */}
        <div
          className={`grid grid-cols-1 gap-10 ${
            coverageGroups.length > 0
              ? 'lg:grid-cols-2 lg:gap-0 lg:divide-x-2 lg:divide-sanguine-red'
              : ''
          }`}
        >
          {/* Collectors: hiscores-style zebra table, one row per synced log */}
          <section className={coverageGroups.length > 0 ? 'lg:pr-8' : ''}>
            <SectionHeading
              title="Collectors"
              summary={
                <Text size="2" className="text-gray-500">
                  <span className="text-white">{members.length}</span> synced
                  logs
                </Text>
              }
            />
            <Box mt="2">
              <div
                className={`${rowGridClass} border-b border-gray-700 py-2.5 text-osrs-orange`}
              >
                <span className="text-right text-sm">#</span>
                {sortColumns.map(column => (
                  <SortableHeaderButton
                    key={column.field}
                    label={column.label}
                    align={column.align}
                    active={sortField === column.field}
                    direction={sortDirection}
                    onClick={() => onSortColumn(column.field)}
                    className={column.className}
                  />
                ))}
              </div>
              {sortedMembers.map((member, index) => (
                <div
                  key={member.name}
                  onClick={() => navigateToUser(member.discordId)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && member.discordId) {
                      navigate(`/users/${member.discordId}`);
                    }
                  }}
                  role={member.discordId ? 'link' : undefined}
                  tabIndex={member.discordId ? 0 : undefined}
                  className={`${rowGridClass} group py-2 ${zebraRowClass} ${
                    member.discordId ? 'cursor-pointer' : ''
                  }`}
                >
                  <Text as="div" size="2" className="text-right text-gray-600">
                    {index + 1}
                  </Text>
                  <Flex align="center" gap="3" className="min-w-0">
                    <img
                      src={fetchRankImage(member.role ?? 'Guest')}
                      alt={rankLabel(member.role ?? 'Guest')}
                      width={22}
                      height={22}
                      className="shrink-0 [image-rendering:pixelated]"
                    />
                    <Box className="min-w-0">
                      <Text
                        as="div"
                        className={`truncate leading-tight ${
                          member.discordId
                            ? 'text-sanguine-bright group-hover:text-white'
                            : 'text-gray-400'
                        }`}
                      >
                        {member.name}
                      </Text>
                      <Text as="div" size="1" className="text-gray-500">
                        {rankLabel(member.role ?? 'Guest')}
                      </Text>
                    </Box>
                  </Flex>
                  <Text as="div" className="text-right text-white">
                    {member.slots.toLocaleString()}
                  </Text>
                  <Text
                    as="div"
                    className={`text-right ${
                      member.categories === 0 ? 'text-gray-600' : 'text-white'
                    }`}
                  >
                    {member.categories}
                  </Text>
                  <Text
                    as="div"
                    size="2"
                    className="hidden text-right tabular-nums text-gray-400 md:block"
                  >
                    {dayjs(member.lastSynced).format('MMM D, YYYY')}
                  </Text>
                </div>
              ))}
            </Box>
          </section>

          {/* Clan log: what the clan collectively owns, category by category —
            and by name, the last few items a category is missing. Same grid-row
            idiom (and header metrics) as Collectors so the two tables line up.
            Drops out entirely if the categories endpoint is down. */}
          {coverageGroups.length > 0 && (
            <section className="lg:pl-8">
              <SectionHeading
                title="Clan log"
                summary={
                  <Select.Root
                    value={activeCoverageGroup.key}
                    onValueChange={setCoverageGroupKey}
                    onOpenChange={onSelectOpenChange}
                  >
                    <Select.Trigger color="gray" className="h-8" />
                    <Select.Content position="popper">
                      {coverageGroups.map(group => (
                        <Select.Item key={group.key} value={group.key}>
                          {`${group.label} (${group.categories.length})`}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                }
              />
              <Box mt="2">
                <div
                  className={`${coverageGridClass} border-b border-gray-700 py-2.5 text-sm text-osrs-orange`}
                >
                  <span>Category</span>
                  <span>Still missing</span>
                  <span className="whitespace-nowrap text-right">
                    Log slots
                  </span>
                </div>
                {activeCoverageGroup.categories.map(category => (
                  <div
                    key={category.key}
                    className={`${coverageGridClass} py-2 ${zebraStripeClass}`}
                  >
                    <Link
                      to={`/collection-log/${category.key}`}
                      className={`text-base leading-tight ${proseLinkClass}`}
                    >
                      {category.name}
                    </Link>
                    {category.missingCount === 0 ? (
                      <Text size="2" className="text-gray-600">
                        None
                      </Text>
                    ) : category.missingNames.length > 0 ? (
                      <Text size="2" className="text-gray-400">
                        {category.missingNames.join(', ')}
                      </Text>
                    ) : (
                      <Text size="2" className="text-gray-500">
                        {category.missingCount} items
                      </Text>
                    )}
                    <Text
                      className={`whitespace-nowrap text-right ${
                        category.missingCount === 0
                          ? 'font-medium text-osrs-gold'
                          : category.owned === 0
                            ? 'text-gray-600'
                            : 'text-white'
                      }`}
                    >
                      {category.owned}/{category.total}
                    </Text>
                  </div>
                ))}
              </Box>
            </section>
          )}
        </div>
      </Flex>
    </Container>
  );
}
