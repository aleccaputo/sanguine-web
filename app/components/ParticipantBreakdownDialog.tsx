import { Dialog, Flex, Text, Box } from '@radix-ui/themes';
import { Link, useLocation, useNavigation } from '@remix-run/react';
import { useState } from 'react';
import { Pagination } from './Pagination';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DropItem } from './DropItem';
import { EmptyState } from './EmptyState';
import { SectionHeading } from './SectionHeading';
import type { OSRSItem } from '~/services/osrs-wiki-prices-service';

type BreakdownDrop = {
  id: string;
  createdAt: string;
  pointsGiven: number;
  destinationDiscordId?: string;
  itemId?: number | null;
  osrsData: OSRSItem | null;
};

type ChartPoint = {
  name: string;
  points: number;
};

type ParticipantBreakdownDialogProps = {
  discordId: string;
  nickname: string;
  gained: number;
  totalPoints: number;
  metric: string;
  drops: BreakdownDrop[];
  chartData: ChartPoint[];
  onClose: () => void;
};

const DROPS_PER_PAGE = 5;

export function ParticipantBreakdownDialog({
  discordId,
  nickname,
  gained,
  totalPoints,
  metric,
  drops,
  chartData,
  onClose,
}: ParticipantBreakdownDialogProps) {
  const navigation = useNavigation();
  const location = useLocation();
  const navigatingAway =
    navigation.state === 'loading' &&
    navigation.location?.pathname !== location.pathname;

  const [dropsPage, setDropsPage] = useState(1);
  const totalDropPages = Math.ceil(drops.length / DROPS_PER_PAGE);
  const pagedDrops = drops.slice(
    (dropsPage - 1) * DROPS_PER_PAGE,
    dropsPage * DROPS_PER_PAGE,
  );

  const totalGpGained = drops.reduce(
    (acc, cur) => acc + (cur.osrsData?.price ?? 0),
    0,
  );
  const hasDrops = drops.length > 0;

  if (navigatingAway) return null;

  return (
    <Dialog.Root defaultOpen onOpenChange={open => !open && onClose()}>
      <Dialog.Content
        style={{ maxWidth: 580, borderRadius: 2, padding: 0 }}
        className="max-h-[85vh] overflow-y-auto border border-gray-700 bg-[#111113]"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        {/* Title band — the dialog's infobox header */}
        <Flex
          align="center"
          justify="between"
          gap="3"
          className="sticky top-0 z-10 bg-sanguine-red px-4 py-2"
        >
          <Dialog.Title size="3" weight="medium" mb="0" className="text-white">
            <Link to={`/users/${discordId}`} className="hover:underline">
              {nickname}
            </Link>
          </Dialog.Title>
          <Dialog.Close>
            <button
              aria-label="Close"
              className="text-white/70 transition-colors hover:text-white"
            >
              ✕
            </button>
          </Dialog.Close>
        </Flex>

        <Flex direction="column" gap="5" className="px-4 pb-5 pt-4 sm:px-5">
          {/* Lede — the member's event narrated from the numbers */}
          <Text as="p" size="3" className="leading-7 text-gray-300">
            <Link
              to={`/users/${discordId}`}
              className="text-sanguine-bright transition-colors hover:text-white"
            >
              {nickname}
            </Link>{' '}
            {hasDrops ? (
              <>
                earned{' '}
                <span className="text-white">
                  {totalPoints.toLocaleString()} drop points
                </span>{' '}
                from <span className="text-white">{drops.length}</span>{' '}
                {drops.length === 1 ? 'drop' : 'drops'}
                {gained > 0 && (
                  <>
                    {' '}
                    while gaining{' '}
                    <span className="text-white">
                      {gained.toLocaleString()} {metric}
                    </span>
                  </>
                )}
                {totalGpGained > 0 && (
                  <>
                    , with loot worth{' '}
                    <span className="text-osrs-gold">
                      {totalGpGained.toLocaleString()} gp
                    </span>
                  </>
                )}
                .
              </>
            ) : gained > 0 ? (
              <>
                gained{' '}
                <span className="text-white">
                  {gained.toLocaleString()} {metric}
                </span>{' '}
                so far, with no drops logged yet.
              </>
            ) : (
              <>
                is entered in this event. So far, nothing interesting happens.
              </>
            )}
          </Text>

          {/* Progress — an all-zero chart says nothing, so it drops out with the drops */}
          {hasDrops && chartData.length > 0 && (
            <Box>
              <SectionHeading
                title="Progress"
                summary={
                  <Text size="2" className="text-gray-500">
                    cumulative drop points
                  </Text>
                }
              />
              <Box className="mt-3 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} />
                    <YAxis stroke="#9CA3AF" fontSize={11} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div
                            style={{
                              backgroundColor: '#111113',
                              border: '1px solid #374151',
                              borderRadius: '2px',
                              padding: '8px 12px',
                              fontSize: '12px',
                              color: '#F9FAFB',
                            }}
                          >
                            <div
                              style={{
                                color: '#9CA3AF',
                                marginBottom: '4px',
                                fontSize: '11px',
                              }}
                            >
                              {label}
                            </div>
                            <div style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {payload[0].value} points
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="stepAfter"
                      dataKey="points"
                      stroke="#BB2C23"
                      strokeWidth={2}
                      fill="#BB2C23"
                      fillOpacity={0.08}
                      dot={false}
                      activeDot={{ r: 4, fill: '#BB2C23' }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          )}

          {/* Drops */}
          <Box>
            <SectionHeading
              title="Drops"
              summary={
                <Text size="2" className="text-gray-500">
                  <span className="text-white">{drops.length}</span> logged
                </Text>
              }
            />
            {hasDrops ? (
              <Box className="mt-1">
                {pagedDrops.map(drop => (
                  <DropItem key={drop.id} size="small" item={drop} />
                ))}
                <Pagination
                  page={dropsPage}
                  totalPages={totalDropPages}
                  onPrev={() => setDropsPage(p => Math.max(1, p - 1))}
                  onNext={() =>
                    setDropsPage(p => Math.min(totalDropPages, p + 1))
                  }
                />
              </Box>
            ) : (
              <EmptyState />
            )}
          </Box>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
