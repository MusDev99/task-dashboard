export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading settings" style={{ maxWidth: 1200 }}>
      <div className="shimmer skeleton" style={{ height: 36, width: 300, borderRadius: 8, marginBottom: 12 }} />
      <div className="shimmer skeleton" style={{ height: 18, width: 460, borderRadius: 8, marginBottom: 28 }} />
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>
        <div className="shimmer skeleton" style={{ height: 320, borderRadius: 16 }} />
        <div className="shimmer skeleton" style={{ height: 420, borderRadius: 16 }} />
      </div>
    </div>
  );
}
