export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading audit log">
      <div className="shimmer skeleton" style={{ height: 36, width: 220, borderRadius: 8, marginBottom: 12 }} />
      <div className="shimmer skeleton" style={{ height: 18, width: 340, borderRadius: 8, marginBottom: 32 }} />
      <div className="shimmer skeleton" style={{ height: 420, borderRadius: 16 }} />
    </div>
  );
}
