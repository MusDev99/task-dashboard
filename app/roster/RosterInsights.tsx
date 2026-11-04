import { COVERAGE_DAYS_LABEL, type CoverageGap, type CoverageTarget } from "../../lib/coverage";
import { RULE_LABEL, type RuleViolation } from "../../lib/roster-rules";
import { AlertIcon } from "../components/ui/Icons";
import { displayName } from "../lib/ui";

const SHOWN = 12;

const short = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
};

interface Props {
  gaps: CoverageGap[];
  violations: RuleViolation[];
  targets: CoverageTarget[];
  /** location id → name, person id → name */
  locationName: (id: string) => string;
  personName: (id: string) => string;
}

/** Read-only summary of days below their coverage target and people past a roster rule. Warns, never blocks. */
export default function RosterInsights({ gaps, violations, targets, locationName, personName }: Props) {
  const activeTargets = targets.filter((t) => t.active).length;
  const total = gaps.length + violations.length;
  return (
    <details className="insights" open={total > 0 && total <= 6}>
      <summary>
        <span className={`insights-icon ${total ? "is-warn" : "is-ok"}`} aria-hidden="true">{total ? <AlertIcon size={16} /> : "✓"}</span>
        <span className="insights-title">Coverage &amp; rules</span>
        <span className="insights-counts" aria-live="polite">
          {total === 0
            ? "All clear this month"
            : `${gaps.length} coverage ${gaps.length === 1 ? "gap" : "gaps"} · ${violations.length} rule ${violations.length === 1 ? "warning" : "warnings"}`}
        </span>
      </summary>
      <div className="insights-body">
        {total === 0 && <p className="muted">{activeTargets === 0 ? "No coverage targets are set." : `${activeTargets} coverage ${activeTargets === 1 ? "target" : "targets"} met.`} No one is past a rest or hours rule.</p>}
        {gaps.length > 0 && (
          <section aria-label="Coverage gaps">
            <h3 className="insights-head">Coverage gaps</h3>
            <ul className="insights-list">
              {gaps.slice(0, SHOWN).map((g) => {
                const t = targets.find((x) => x.id === g.targetId);
                return (
                  <li key={`${g.targetId}|${g.date}`}>
                    <b>{short(g.date)}</b> · {g.code} · {g.locationId ? locationName(g.locationId) : "All locations"}
                    <span className="insights-detail"> — {g.have} of {g.need} needed{t && t.days !== "every" ? ` (${COVERAGE_DAYS_LABEL[t.days]})` : ""}</span>
                  </li>
                );
              })}
            </ul>
            {gaps.length > SHOWN && <p className="muted">+{gaps.length - SHOWN} more</p>}
          </section>
        )}
        {violations.length > 0 && (
          <section aria-label="Rule warnings">
            <h3 className="insights-head">Rule warnings</h3>
            <ul className="insights-list">
              {violations.slice(0, SHOWN).map((v) => (
                <li key={`${v.userId}|${v.date}|${v.rule}`}>
                  <b>{displayName(personName(v.userId))}</b> · {short(v.date)} · {RULE_LABEL[v.rule]}
                  <span className="insights-detail"> — {v.detail}</span>
                </li>
              ))}
            </ul>
            {violations.length > SHOWN && <p className="muted">+{violations.length - SHOWN} more</p>}
          </section>
        )}
      </div>
    </details>
  );
}
