import { Dialog, Flex, Text, Heading, Box } from '@radix-ui/themes';
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

  if (navigatingAway) return null;

  return (
    <Dialog.Root defaultOpen onOpenChange={open => !open && onClose()}>
      <Dialog.Content
        style={{ maxWidth: 580 }}
        className="max-h-[85vh] overflow-y-auto border border-gray-700 bg-gray-900"
      >
        <Flex direction="column" gap="4">
          {/* Header + Stats */}
          <Flex direction="column" gap="1">
            <Flex justify="between" align="start">
              <Box>
                <Text size="1" className="uppercase tracking-wide text-gray-400">
                  Event Breakdown
                </Text>
                <Dialog.Title>
                  <Link
                    to={`/users/${discordId}`}
                    className="group mt-1 block"
                  >
                    <Heading size="5" className="text-white transition-colors group-hover:text-sanguine-red">
                      {nickname}
                    </Heading>
                  </Link>
                </Dialog.Title>
              </Box>
              <Dialog.Close>
                <button className="text-gray-400 transition-colors hover:text-white">
                  ✕
                </button>
              </Dialog.Close>
            </Flex>

          {/* Stats row */}
            <Flex gap="6">
              <Box>
                <Text size="1" className="block text-gray-400">
                  Points Earned
                </Text>
                <Text size="4" weight="bold" className="text-sanguine-red">
                  {totalPoints}
                </Text>
              </Box>
              <Box>
                <Text size="1" className="block text-gray-400">
                  {metric} Gained
                </Text>
                <Text size="4" weight="bold" className="text-green-400">
                  {gained.toLocaleString()}
                </Text>
              </Box>
            </Flex>
          </Flex>

          {/* Cumulative points chart */}
          {chartData.length > 0 && (
            <Box>
              <Heading size="3" className="mb-2 text-white">
                Cumulative Points
              </Heading>
              <Box className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="pointsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#BB2C23" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#BB2C23" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} />
                    <YAxis stroke="#9CA3AF" fontSize={11} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const entry = payload[0];
                        return (
                          <div style={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#F9FAFB', minWidth: '160px' }}>
                            <div style={{ color: '#9CA3AF', marginBottom: '6px', fontSize: '11px' }}>{label}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#BB2C2322', borderRadius: '4px', padding: '2px 4px', margin: '0 -4px', fontWeight: 600 }}>
                              <span style={{ color: '#BB2C23' }}>●</span>
                              <span style={{ flex: 1 }}>{nickname}</span>
                              <span style={{ color: '#D1D5DB', fontVariantNumeric: 'tabular-nums' }}>{entry.value}</span>
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
                      fill="url(#pointsGradient)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#BB2C23' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          )}

          {/* Drops */}
          <Box>
            <Heading size="3" className="mb-2 text-white">
              Drops ({drops.length})
            </Heading>
            {drops.length > 0 ? (
              <Box>
                {pagedDrops.map(drop => (
                  <DropItem key={drop.id} size="small" item={drop} />
                ))}
                <Pagination
                  page={dropsPage}
                  totalPages={totalDropPages}
                  onPrev={() => setDropsPage(p => Math.max(1, p - 1))}
                  onNext={() => setDropsPage(p => Math.min(totalDropPages, p + 1))}
                />
              </Box>
            ) : (
              <Text size="2" className="text-gray-400">
                No drops recorded for this event.
              </Text>
            )}
          </Box>

          {/* Footer */}
          <Flex
            justify="end"
            align="center"
            className="border-t border-gray-700 pt-3"
          >
            <Dialog.Close>
              <button className="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-600">
                Close
              </button>
            </Dialog.Close>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
