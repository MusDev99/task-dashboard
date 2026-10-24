export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading teams">
      <div className="shimmer skeleton" style={{ height: 36, width: 220, borderRadius: 8, marginBottom: 12 }} />
      <div className="shimmer skeleton" style={{ height: 18, width: 340, borderRadius: 8, marginBottom: 32 }} />
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="shimmer skeleton" style={{ height: 96, borderRadius: 16 }} />
        ))}
      </div>
      <div className="shimmer skeleton" style={{ height: 420, borderRadius: 16 }} />
    </div>
  );
}
