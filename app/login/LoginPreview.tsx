// Decorative product preview for the sign-in page: a tiny roster, coverage bars and three floating chips.
// It is an illustration with made-up sample values (not data), hidden from assistive tech and from phones.

type Tone = "indigo" | "violet" | "pink" | "amber" | "emerald";

// Sample week: shift/leave codes per person (null = day off). People are shown as initials only.
const WEEK = ["M", "T", "W", "T", "F", "S", "S"];
const ROWS: { who: string; tone: Tone; days: ({ code: string; tone: Tone } | null)[] }[] = [
  { who: "A", tone: "indigo", days: [{ code: "STD", tone: "amber" }, { code: "STD", tone: "amber" }, { code: "STD", tone: "amber" }, { code: "STD", tone: "amber" }, { code: "STD", tone: "amber" }, null, null] },
  { who: "B", tone: "pink", days: [{ code: "STD", tone: "amber" }, { code: "STD", tone: "amber" }, { code: "AL", tone: "emerald" }, { code: "AL", tone: "emerald" }, { code: "STD", tone: "amber" }, null, null] },
  { who: "C", tone: "violet", days: [null, { code: "STD", tone: "amber" }, { code: "STD", tone: "amber" }, { code: "STD", tone: "amber" }, { code: "MC", tone: "pink" }, { code: "STD", tone: "amber" }, null] },
  { who: "D", tone: "emerald", days: [{ code: "STD", tone: "amber" }, { code: "PH", tone: "violet" }, { code: "STD", tone: "amber" }, { code: "STD", tone: "amber" }, { code: "STD", tone: "amber" }, null, { code: "STD", tone: "amber" }] },
];
const BARS = [48, 62, 55, 78, 66, 86, 100]; // coverage as % of target; the last one is "met"

export default function LoginPreview() {
  return (
    <div className="landing-preview" aria-hidden="true">
      <div className="pv-window">
        <div className="pv-head">
          <span className="pv-dot tone-pink" /><span className="pv-dot tone-amber" /><span className="pv-dot tone-emerald" />
          <span className="pv-title">WorkForce · Roster</span>
        </div>
        <div className="pv-body">
          <div className="pv-row pv-days">
            <span />
            {WEEK.map((d, i) => <span key={i}>{d}</span>)}
          </div>
          {ROWS.map((r) => (
            <div className="pv-row" key={r.who}>
              <span className={`pv-avatar tone-${r.tone}`}>{r.who}</span>
              {r.days.map((c, i) => (
                c ? <span key={i} className={`pv-chip tone-${c.tone}`}>{c.code}</span> : <span key={i} className="pv-chip is-off" />
              ))}
            </div>
          ))}
          <div className="pv-bars-label">Coverage this week</div>
          <div className="pv-bars">
            {BARS.map((h, i) => <span key={i} className={`pv-bar ${i === BARS.length - 1 ? "is-met" : ""}`} style={{ height: `${h}%` }} />)}
          </div>
        </div>
      </div>

      <div className="pv-float pv-met"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> Coverage met</div>
      <div className="pv-float pv-ring-card">
        <span className="pv-ring" />
        <span><strong>12 of 14</strong><small>on shift today</small></span>
      </div>
      <div className="pv-float pv-sync">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg> Leave approved · roster updated
      </div>
    </div>
  );
}
