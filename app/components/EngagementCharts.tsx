import { Box, Flex, Text } from '@radix-ui/themes';
import type { MouseEvent, ReactNode } from 'react';
import { jumpToSection } from '~/utils/jump-to-section';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Charts for the admin insights page. Forms follow the data's job: horizontal bars for
// magnitude across a handful of categories, small multiples of single-series lines for change
// over time (six systems on one plot would tangle), and one stacked bar for part-to-whole.
// Marks stay thin, gridlines are solid hairlines one step off the surface, values are direct
// labelled at the bar tip or in the multiple's title, and every chart has a table twin.

/** The page surface the charts sit on (Radix dark), used for the surface ring on markers. */
export const CHART_SURFACE = '#111113';
/** Single-series hue: the site's readable red, validated at >= 3:1 on the surface. */
export const CHART_HUE = '#E2564A';
/**
 * Categorical order for the roster composition bar, validated for CVD separation on the dark
 * surface (site red, then reference-palette blue, amber, green). Assigned by slot, never cycled.
 */
export const COMPOSITION_HUES = ['#E2564A', '#3987e5', '#c98500', '#199e70'];

const GRID = '#1F2937';
const TICK = { fill: '#9CA3AF', fontSize: 14 };
const VALUE_LABEL = { fill: '#E5E7EB', fontSize: 14 };
const BAR_SIZE = 20;

interface ITooltipRow {
  label: string;
  value: string;
}

interface ITooltipBoxProps {
  rows: ITooltipRow[];
}

interface ITipLabelProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string;
}

/**
 * Value at the bar tip as one SVG text run. Recharts' own label component word-wraps to the
 * space it thinks it has, which split "34 11%" onto two lines in a narrow chart.
 */
const TipLabel = ({ x, y, width, height, value }: ITipLabelProps) => (
  <text
    x={Number(x) + Number(width) + 6}
    y={Number(y) + Number(height) / 2}
    dominantBaseline="central"
    fill={VALUE_LABEL.fill}
    fontSize={VALUE_LABEL.fontSize}
    style={{ whiteSpace: 'pre' }}
  >
    {value}
  </text>
);

/** Dark, square tooltip: value leads, label follows. */
const TooltipBox = ({ rows }: ITooltipBoxProps) => (
  <Box className="rounded-sm border border-gray-700 bg-[#1a1a1e] px-2 py-1 text-sm shadow-none">
    {rows.map(row => (
      <Flex key={row.label} gap="2" align="baseline">
        <span className="text-gray-100">{row.value}</span>
        <span className="text-gray-400">{row.label}</span>
      </Flex>
    ))}
  </Box>
);

export interface IBarRow {
  label: string;
  value: number;
  /** Optional suffix shown beside the value, e.g. a share of roster. */
  annotation?: string;
}

interface IHorizontalBarsProps {
  rows: IBarRow[];
  /** Fixes the axis end so bars read against a known total (e.g. the roster size). */
  max?: number;
  formatValue?: (value: number) => string;
  /** Width reserved for category labels. */
  labelWidth?: number;
}

/** Ranked or categorical magnitudes: one hue, thin bars, value at the tip. */
export function HorizontalBars({
  rows,
  max,
  formatValue = value => value.toLocaleString(),
  labelWidth = 120,
}: IHorizontalBarsProps) {
  const height = rows.length * (BAR_SIZE + 14) + 8;
  const data = rows.map(row => ({
    ...row,
    tip: row.annotation
      ? `${formatValue(row.value)} ${row.annotation}`
      : formatValue(row.value),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 88, bottom: 0, left: 0 }}
        barCategoryGap={12}
      >
        <XAxis type="number" hide domain={[0, max ?? 'auto']} />
        <YAxis
          type="category"
          dataKey="label"
          width={labelWidth}
          tick={TICK}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: 'rgba(226, 86, 74, 0.08)' }}
          content={({ active, payload }) =>
            active && payload && payload.length > 0 ? (
              <TooltipBox
                rows={[
                  {
                    label: String(payload[0].payload.label),
                    value: String(payload[0].payload.tip),
                  },
                ]}
              />
            ) : null
          }
        />
        <Bar
          dataKey="value"
          fill={CHART_HUE}
          barSize={BAR_SIZE}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
        >
          <LabelList dataKey="tip" content={TipLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface ISeriesPoint {
  /** Short x label, e.g. "Apr". */
  label: string;
  value: number;
}

export interface ISmallMultiple {
  key: string;
  title: string;
  points: ISeriesPoint[];
}

interface ISmallMultiplesProps {
  series: ISmallMultiple[];
  /** Shared y-axis top so the multiples compare honestly. */
  max: number;
  formatValue?: (value: number) => string;
}

/** One small line chart per series on a shared scale; the latest value is the title's label. */
export function SmallMultiples({
  series,
  max,
  formatValue = value => value.toLocaleString(),
}: ISmallMultiplesProps) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {series.map(item => {
        const latest = item.points.at(-1)?.value ?? 0;
        return (
          <Box key={item.key}>
            <Flex justify="between" align="baseline" gap="2">
              <Text size="2" className="text-gray-300">
                {item.title}
              </Text>
              <Text size="2" className="tabular-nums text-gray-100">
                {formatValue(latest)}
              </Text>
            </Flex>
            <ResponsiveContainer width="100%" height={96}>
              <LineChart
                data={item.points}
                margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid
                  horizontal
                  vertical={false}
                  stroke={GRID}
                  strokeWidth={1}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  height={18}
                />
                <YAxis hide domain={[0, Math.max(1, max)]} />
                <Tooltip
                  cursor={{ stroke: '#4B5563', strokeWidth: 1 }}
                  content={({ active, payload, label }) =>
                    active && payload && payload.length > 0 ? (
                      <TooltipBox
                        rows={[
                          {
                            label: `${item.title}, ${String(label)}`,
                            value: formatValue(Number(payload[0].value)),
                          },
                        ]}
                      />
                    ) : null
                  }
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={CHART_HUE}
                  strokeWidth={2}
                  dot={{
                    r: 3,
                    fill: CHART_HUE,
                    stroke: CHART_SURFACE,
                    strokeWidth: 2,
                  }}
                  activeDot={{ r: 5, stroke: CHART_SURFACE, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        );
      })}
    </div>
  );
}

export interface ICompositionSegment {
  key: string;
  label: string;
  value: number;
  /** Id of the section that details this slice; the slice and its legend entry jump there. */
  targetId?: string;
}

interface ICompositionBarProps {
  /** What the bar splits, shown above it; needed once two bars sit together. */
  title?: string;
  segments: ICompositionSegment[];
  /** Legend suffix per segment, e.g. a share; defaults to the count. */
  formatValue?: (value: number, total: number) => ReactNode;
}

/**
 * Part-to-whole as one thin stacked bar with 2px surface gaps, colored by slot from
 * COMPOSITION_HUES, plus a legend that carries every value so nothing is color-only.
 */
export function CompositionBar({
  title,
  segments,
  formatValue = value => value.toLocaleString(),
}: ICompositionBarProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const shown = segments.filter(segment => segment.value > 0);
  const jump = (targetId: string) => (event: MouseEvent) => {
    event.preventDefault();
    jumpToSection(targetId);
  };
  return (
    <Box>
      {title && (
        <Text as="p" size="2" className="mb-1 text-gray-500">
          {title}
        </Text>
      )}
      <Flex gap="2px" className="h-3 w-full overflow-hidden rounded-sm">
        {shown.map(segment => {
          const style = {
            width: `${(segment.value / Math.max(1, total)) * 100}%`,
            backgroundColor:
              COMPOSITION_HUES[segments.indexOf(segment)] ?? '#6B7280',
          };
          const title = `${segment.label}: ${segment.value.toLocaleString()}`;
          return segment.targetId ? (
            <a
              key={segment.key}
              href={`#${segment.targetId}`}
              onClick={jump(segment.targetId)}
              title={title}
              aria-label={title}
              className="block hover:brightness-125"
              style={style}
            />
          ) : (
            <div key={segment.key} title={title} style={style} />
          );
        })}
      </Flex>
      <Flex gap="4" wrap="wrap" mt="2">
        {segments.map((segment, index) => (
          <Flex key={segment.key} gap="2" align="center">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: COMPOSITION_HUES[index] ?? '#6B7280' }}
            />
            {segment.targetId ? (
              <a
                href={`#${segment.targetId}`}
                onClick={jump(segment.targetId)}
                className="text-sm text-gray-400 hover:text-white"
              >
                {segment.label}{' '}
                <span className="text-gray-100">
                  {formatValue(segment.value, total)}
                </span>
              </a>
            ) : (
              <Text size="2" className="text-gray-400">
                {segment.label}{' '}
                <span className="text-gray-100">
                  {formatValue(segment.value, total)}
                </span>
              </Text>
            )}
          </Flex>
        ))}
      </Flex>
    </Box>
  );
}
