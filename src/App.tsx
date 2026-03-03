export default function App() {
  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        background: 'var(--bg-void)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.3em',
          color: 'var(--accent-green)',
          fontWeight: 700,
          textTransform: 'uppercase',
        }}
      >
        KORTANA
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          letterSpacing: '0.15em',
          color: 'var(--text-ghost)',
          textTransform: 'uppercase',
        }}
      >
        S-01 — scaffold complete
      </span>
    </div>
  )
}
