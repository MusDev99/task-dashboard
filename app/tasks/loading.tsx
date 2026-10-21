export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading tasks" style={{ maxWidth: 1400 }}>
      <div className="shimmer skeleton" style={{ height: 40, width: 280, borderRadius: 8, marginBottom: 12 }} />
      <div className="shimmer skeleton" style={{ height: 18, width: 420, borderRadius: 8, marginBottom: 28 }} />
      <div className="shimmer skeleton" style={{ height: 56, borderRadius: 14, marginBottom: 16 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="shimmer skeleton" style={{ height: 380, borderRadius: 16 }} />)}
      </div>
    </div>
  );
}
