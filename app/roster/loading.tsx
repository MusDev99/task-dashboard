export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading roster" style={{ maxWidth: "none" }}>
      <div className="shimmer skeleton" style={{ height: 36, width: 240, borderRadius: 8, marginBottom: 12 }} />
      <div className="shimmer skeleton" style={{ height: 18, width: 360, borderRadius: 8, marginBottom: 24 }} />
      <div className="shimmer skeleton" style={{ height: 88, borderRadius: 16, marginBottom: 16 }} />
      <div className="shimmer skeleton" style={{ height: 380, borderRadius: 16 }} />
    </div>
  );
}
