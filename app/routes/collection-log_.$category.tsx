import { json, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { Link, useLoaderData, useNavigate } from '@remix-run/react';
import { Box, Container, Flex, Text } from '@radix-ui/themes';
import { getRsnMemberBridge } from '~/services/member-lookup.server';
import {
  getClogCategories,
  getClogItemNames,
  getGroupCollectionLog,
} from '~/services/temple-api-service.server';
import { fetchRankImage, rankLabel } from '~/utils/clan-ranks';
import { PageHeader } from '~/components/PageHeader';
import { CategoriesFooter } from '~/components/CategoriesFooter';
import { EmptyState } from '~/components/EmptyState';
import { SectionHeading } from '~/components/SectionHeading';
import { proseLinkClass, zebraRowClass } from '~/utils/styles';
import {
  CATEGORY_GROUP_LABELS,
  COLLECTION_LOG_ICON,
  formatCategoryName,
  normalizeRsn,
  resolveClogItemData,
  type ITempleClogCategories,
  type TempleClogCategoryGroup,
} from '~/utils/collection-log';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const name = data?.categoryName ?? 'Category';
  return [
    { title: `Sanguine Collection Log | ${name}` },
    {
      name: 'description',
      content: `Who in Sanguine has each ${name} collection log item.`,
    },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const categoryKey = params.category ?? '';

  const [{ discordIdByRsn, roleByRsn }, groupClog, clogCategories, itemNames] =
    await Promise.all([
      getRsnMemberBridge(),
      getGroupCollectionLog().catch(() => null),
      getClogCategories().catch(() => null),
      getClogItemNames().catch(() => ({}) as Record<string, string>),
    ]);

  // This page is nothing without the log and the category map — degrade to the
  // header + empty state rather than a 500 when Temple is unreachable.
  if (groupClog === null || clogCategories === null) {
    return json({
      available: false as const,
      categoryName: formatCategoryName(categoryKey),
    });
  }

  const groupEntries = Object.entries(CATEGORY_GROUP_LABELS) as [
    keyof ITempleClogCategories,
    string,
  ][];
  const match = groupEntries.flatMap(([groupKey, groupLabel]) => {
    const group: TempleClogCategoryGroup = clogCategories[groupKey] ?? {};
    return categoryKey in group
      ? [{ groupLabel, itemIds: group[categoryKey] }]
      : [];
  })[0];
  if (!match) {
    throw new Response(`No collection log category "${categoryKey}"`, {
      status: 404,
    });
  }
  const categoryName = formatCategoryName(categoryKey);

  // One row per synced member with at least one of the category's items,
  // fullest logs first. Rows carry only the item ids they own — the client
  // maps those back to items, so no boolean-per-item matrix ships.
  const rows = groupClog.members
    .map(member => {
      const ownedIds = new Set(member.items);
      const ownedItemIds = match.itemIds.filter(id => ownedIds.has(id));
      return {
        name: member.player_name_with_capitalization || member.player,
        discordId: discordIdByRsn.get(normalizeRsn(member.player)) ?? null,
        role: roleByRsn.get(normalizeRsn(member.player)) ?? null,
        ownedItemIds,
        count: ownedItemIds.length,
        totalSlots: member.total_collections_finished,
      };
    })
    .filter(row => row.count > 0)
    .sort((a, b) => b.count - a.count || b.totalSlots - a.totalSlots);

  // Each item carries its display data and how many collectors own it.
  const items = await Promise.all(
    match.itemIds.map(async id => {
      const itemData = await resolveClogItemData({
        id,
        name: itemNames[String(id)] ?? `Item ${id}`,
      });
      return {
        ...itemData,
        owners: rows.filter(row => row.ownedItemIds.includes(id)).length,
      };
    }),
  );
  const clanOwnedCount = items.filter(item => item.owners > 0).length;

  return json(
    {
      available: true as const,
      categoryName,
      groupLabel: match.groupLabel,
      items,
      rows,
      clanOwnedCount,
      syncedCount: groupClog.members_with_items_synced,
    },
    {
      headers: {
        'Cache-Control': 'max-age=300',
      },
    },
  );
}

export default function CollectionLogCategory() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  if (!data.available) {
    return (
      <Container size="4" mt="3" pb="6">
        <PageHeader title={data.categoryName} iconSrc={COLLECTION_LOG_ICON}>
          Part of the{' '}
          <Link to="/collection-log" className={proseLinkClass}>
            clan collection log
          </Link>
          .
        </PageHeader>
        <EmptyState>
          The log&apos;s pages are stuck together. TempleOSRS isn&apos;t
          answering; try again shortly.
        </EmptyState>
      </Container>
    );
  }

  const { categoryName, groupLabel, items, rows, clanOwnedCount, syncedCount } =
    data;

  const missingNames = items
    .filter(item => item.owners === 0)
    .map(item => item.name);

  return (
    <Container size="4" mt="3" pb="6">
      <Flex direction="column">
        <PageHeader title={categoryName} iconSrc={COLLECTION_LOG_ICON}>
          From the{' '}
          <Link to="/collection-log" className={proseLinkClass}>
            clan collection log
          </Link>
          : the clan owns{' '}
          <span className="font-semibold text-white">{clanOwnedCount}</span> of
          the <span className="font-semibold text-white">{items.length}</span>{' '}
          {categoryName} slots, and{' '}
          <span className="font-semibold text-sanguine-bright">
            {rows.length}
          </span>{' '}
          of the {syncedCount} synced collectors{' '}
          {rows.length === 1 ? 'has' : 'have'} loot here.
        </PageHeader>

        {/* The log — the clan's page of this category, in the spirit of the
            in-game interface: a spacious tile per item, its clan owner count
            beneath, unowned tiles ghosted. Tooltips carry the item names. */}
        <section>
          <SectionHeading
            title="The log"
            summary={
              <Text size="2" className="text-gray-500">
                <span
                  className={
                    clanOwnedCount === items.length
                      ? 'font-medium text-osrs-gold'
                      : 'text-white'
                  }
                >
                  {clanOwnedCount}/{items.length}
                </span>{' '}
                slots filled
              </Text>
            }
          />
          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-x-2 gap-y-5">
            {items.map(item => (
              <div
                key={item.id}
                title={`${item.name} · ${item.owners} of ${rows.length} collectors`}
                className="flex flex-col items-center gap-1.5"
              >
                <Box className="flex h-11 w-11 items-center justify-center">
                  <img
                    src={item.icon}
                    alt={item.name}
                    className={`max-h-11 max-w-11 object-contain ${
                      item.owners === 0 ? 'opacity-25 grayscale' : ''
                    }`}
                  />
                </Box>
                <Text
                  size="2"
                  className={
                    item.owners === 0 ? 'text-gray-600' : 'text-gray-400'
                  }
                >
                  <span className={item.owners === 0 ? '' : 'text-white'}>
                    {item.owners}
                  </span>{' '}
                  own
                </Text>
              </div>
            ))}
          </div>
          {missingNames.length > 0 && (
            <Text as="p" size="2" className="mt-5 text-gray-500">
              Nobody has logged{' '}
              <span className="text-gray-300">{missingNames.join(', ')}</span>{' '}
              yet.
            </Text>
          )}
        </section>

        {/* Collectors — one roomy row per member: their name, then only the
            items they own as a wrapped loot shelf. No ghost cells; a missing
            item simply isn't on the shelf. */}
        <section className="mt-10">
          <SectionHeading
            title="Collectors"
            summary={
              <Text size="2" className="text-gray-500">
                <span className="text-white">{rows.length}</span> with loot here
              </Text>
            }
          />
          {rows.length === 0 ? (
            <EmptyState />
          ) : (
            <Box mt="2">
              {rows.map((row, index) => (
                <div
                  key={row.name}
                  onClick={() => {
                    if (row.discordId) navigate(`/users/${row.discordId}`);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && row.discordId) {
                      navigate(`/users/${row.discordId}`);
                    }
                  }}
                  role={row.discordId ? 'link' : undefined}
                  tabIndex={row.discordId ? 0 : undefined}
                  className={`grid grid-cols-[28px_1fr_64px] items-baseline gap-2 px-2 py-2.5 md:gap-3 md:px-3 ${zebraRowClass} ${
                    row.discordId ? 'group cursor-pointer' : ''
                  }`}
                >
                  <Text as="div" size="2" className="text-right text-gray-600">
                    {index + 1}
                  </Text>
                  <Box className="min-w-0">
                    <Flex align="center" gap="2">
                      <img
                        src={fetchRankImage(row.role ?? 'Guest')}
                        alt={rankLabel(row.role ?? 'Guest')}
                        width={20}
                        height={20}
                        className="shrink-0 [image-rendering:pixelated]"
                      />
                      <Text
                        as="div"
                        className={`truncate leading-tight ${
                          row.discordId
                            ? 'text-sanguine-bright group-hover:text-white'
                            : 'text-gray-400'
                        }`}
                      >
                        {row.name}
                      </Text>
                    </Flex>
                    <Flex wrap="wrap" gap="1" className="mt-1.5 pl-7">
                      {items
                        .filter(item => row.ownedItemIds.includes(item.id))
                        .map(item => (
                          <Box
                            key={item.id}
                            className="flex h-6 w-6 items-center justify-center"
                          >
                            <img
                              src={item.icon}
                              alt={item.name}
                              title={item.name}
                              className="max-h-6 max-w-6 object-contain"
                            />
                          </Box>
                        ))}
                    </Flex>
                  </Box>
                  <Text
                    as="div"
                    className={`text-right ${
                      row.count === items.length
                        ? 'font-medium text-osrs-gold'
                        : 'text-white'
                    }`}
                  >
                    {row.count}/{items.length}
                  </Text>
                </div>
              ))}
            </Box>
          )}
        </section>
      </Flex>

      <CategoriesFooter
        to="/collection-log"
        primaryLabel="Collection log"
        categories={[groupLabel]}
      />
    </Container>
  );
}
