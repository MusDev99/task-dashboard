//this is a custom 404 page
import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '60vh',
      padding: '2rem 1rem',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ 
          fontSize: 'clamp(4rem, 15vw, 8rem)', 
          fontWeight: 800, 
          background: 'var(--gradient-primary)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem',
          lineHeight: 1,
        }}>
          404
        </h1>
        <h2 style={{ 
          fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', 
          fontWeight: 600, 
          color: 'var(--text-primary)', 
          marginBottom: '0.75rem' 
        }}>
          Page Not Found
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
          Oops! The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link 
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.75rem 1.5rem',
            background: 'var(--gradient-primary)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            transition: 'all var(--transition-fast)',
          }}
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
