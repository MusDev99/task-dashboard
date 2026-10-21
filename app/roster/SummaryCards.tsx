interface Props {
  scope: string;
  totalHours: number;
  avgPerWeek: number;
  leaveDays: number;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default function SummaryCards({ scope, totalHours, avgPerWeek, leaveDays }: Props) {
  const card = (label: string, value: string) => (
    <div className="stat-card summary-card">
      <div className="summary-label">{label}</div>
      <div className="summary-value">{value}</div>
    </div>
  );
  return (
    <section aria-label={`Summary for ${scope}`}>
      <div className="summary-grid">
        {card("Month total", `${fmt(totalHours)} h`)}
        {card("Avg / week", `${fmt(avgPerWeek)} h`)}
        {card("Leave days", `${leaveDays} ${leaveDays === 1 ? "day" : "days"}`)}
      </div>
    </section>
  );
}
