'use client';

/**
 * Root error boundary — catches failures in the root layout itself, so it must
 * render its own <html>/<body> and use no app components or styles.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: '#09090B',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 24, margin: 0 }}>Something went wrong</h1>
        <p style={{ color: '#B8B8C5', maxWidth: 360, margin: 0 }}>
          Nothing you said was lost. Reload to keep going.
        </p>
        <button
          onClick={reset}
          style={{
            minHeight: 44,
            padding: '10px 24px',
            borderRadius: 12,
            border: 'none',
            background: '#7C3AED',
            color: '#fff',
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
