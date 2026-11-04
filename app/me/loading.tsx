export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading my schedule">
      <div className="shimmer skeleton" style={{ height: 36, width: 220, borderRadius: 8, marginBottom: 12 }} />
      <div className="shimmer skeleton" style={{ height: 120, borderRadius: 16, marginBottom: 16 }} />
      <div className="shimmer skeleton" style={{ height: 420, borderRadius: 16 }} />
    </div>
  );
}
