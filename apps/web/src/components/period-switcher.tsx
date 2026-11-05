import { statsPeriods, type StatsPeriod } from '@reading-tracker/shared';
import { SegmentedControl } from './segmented-control';

const labels: Record<StatsPeriod, string> = { week: 'Week', month: 'Month', year: 'Year' };
const options = statsPeriods.map((period) => ({ value: period, label: labels[period] }));

/** Figma "PeriodSwitcher": a segmented control. (Figma's "Custom" range is not in the MVP.) */
export function PeriodSwitcher({
  value,
  onChange,
  className,
}: {
  value: StatsPeriod;
  onChange: (period: StatsPeriod) => void;
  className?: string;
}) {
  return (
    <SegmentedControl
      label="Period"
      options={options}
      value={value}
      onChange={onChange}
      className={className}
    />
  );
}
