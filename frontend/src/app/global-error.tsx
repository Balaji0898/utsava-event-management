'use client';

/**
 * Root error boundary. Catches any error thrown while rendering the root
 * layout/providers so the app can never end up a permanently blank screen —
 * it replaces the whole document, so styles are inline (globals.css may not be
 * applied here).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Georgia, serif',
          color: '#F4EEE0',
          background:
            'radial-gradient(ellipse at 50% 35%, #14101c 0%, #07070c 60%, #030308 100%)',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 460 }}>
          <div
            style={{
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: '0.3em',
              background: 'linear-gradient(100deg,#8a5a10,#f5cc50 50%,#8a5a10)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            UTSAVA
          </div>
          <p style={{ marginTop: 18, fontSize: 15, opacity: 0.75 }}>
            Something went wrong while loading the page.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 22,
              padding: '10px 24px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              color: '#141210',
              background: 'linear-gradient(135deg,#E3C877,#D4AF37 45%,#A9861F)',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
