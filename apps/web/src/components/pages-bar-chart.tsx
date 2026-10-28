'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDuration } from '@/lib/format';

export interface ChartBar {
  key: string;
  /** Axis label, e.g. "Oct 1", "Mon", "Jan" or "Today". */
  label: string;
  /** Tooltip heading, e.g. "Tue, Oct 20". */
  title: string;
  pages: number;
  minutes: number;
  /** Today (or this month) is drawn darker. */
  current: boolean;
}

/** Figma "PagesBarChart": one bar per day (or month), zero days as a short stub. */
export function PagesBarChart({
  bars,
  ticks,
  label,
}: {
  bars: ChartBar[];
  /** Keys of the bars that get an axis label. */
  ticks: string[];
  /** Accessible summary of the chart. */
  label: string;
}) {
  const labels = new Map(bars.map((b) => [b.key, b.label]));
  const first = bars[0]?.key;
  const last = bars.at(-1)?.key;
  // Shifts the edge labels to the outer edge of their bar (bars fill ~78% of each band).
  const bandOffset = 4;
  return (
    <div role="img" aria-label={label} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={bars}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          barCategoryGap="22%"
        >
          <YAxis hide domain={[0, 'dataMax']} />
          <XAxis
            dataKey="key"
            ticks={ticks}
            interval={0}
            tickLine={false}
            axisLine={false}
            height={28}
            // Figma aligns the first label left and the last right, so neither is clipped.
            tick={({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
              const anchor =
                payload.value === first ? 'start' : payload.value === last ? 'end' : 'middle';
              return (
                <text
                  x={anchor === 'start' ? x - bandOffset : anchor === 'end' ? x + bandOffset : x}
                  y={y + 14}
                  textAnchor={anchor}
                  fill="var(--muted)"
                  fontSize={12}
                >
                  {labels.get(payload.value) ?? ''}
                </text>
              );
            }}
          />
          <Tooltip
            cursor={{ fill: 'var(--bg)' }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const bar = payload?.[0]?.payload as ChartBar | undefined;
              if (!active || !bar) return null;
              return (
                <div className="rounded-input border border-border bg-surface px-3 py-2 text-meta shadow-sm">
                  <p className="font-semibold text-ink">{bar.title}</p>
                  <p className="text-muted">
                    {bar.pages} pages · {formatDuration(bar.minutes)}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="pages" radius={[3, 3, 0, 0]} minPointSize={4} isAnimationActive={false}>
            {bars.map((bar) => (
              <Cell
                key={bar.key}
                fill={
                  bar.pages === 0
                    ? 'var(--heat-0)'
                    : bar.current
                      ? 'var(--heat-4)'
                      : 'var(--heat-3)'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
