const cards = [
  {
    id: 'threat',
    icon: '🚀',
    title: 'Threat Tracker',
    desc: 'Missiles, drones, interceptions across UAE/GCC',
  },
  {
    id: 'flights',
    icon: '✈️',
    title: 'Flight Monitor',
    desc: 'Airport status, regional air travel risk',
  },
  {
    id: 'hormuz',
    icon: '🛢️',
    title: 'Hormuz Watch',
    desc: 'Strait of Hormuz shipping traffic & oil flow',
  },
];

export default function Landing({ onSelect }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#E8E8E8', padding: '60px 20px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.4rem', fontWeight: 700, marginBottom: 8 }}>
          Conflict Intelligence
        </h1>
        <p style={{ color: '#888', fontSize: '1.1rem', marginBottom: 48 }}>
          Real-time conflict intelligence platform
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {cards.map((c) => (
            <div
              key={c.id}
              style={{
                background: '#111111',
                border: '1px solid #2a2a2a',
                borderRadius: 12,
                padding: '32px 24px',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>{c.icon}</div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: 8 }}>{c.title}</h2>
              <p style={{ color: '#888', fontSize: '0.95rem', marginBottom: 20 }}>{c.desc}</p>
              <button
                onClick={() => onSelect(c.id)}
                style={{
                  background: 'none',
                  border: '1px solid #C4A135',
                  color: '#C4A135',
                  padding: '8px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Open Dashboard →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
