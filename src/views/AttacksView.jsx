import AttackChart from '../components/AttackChart';

const BG         = '#050B1A';
const CARD_BG    = 'rgba(255,255,255,0.05)';
const GLASS_BORDER = '1px solid rgba(255,255,255,0.07)';
const GLASS_BLUR   = 'blur(40px)';
const GLASS_RADIUS = 16;
const TEXT       = '#E8E8ED';
const SUBTEXT    = '#E8E8ED88';
const AMBER      = '#F59E0B';
const AMBER_DARK = '#D97706';
const DM_SANS    = "'DM Sans', -apple-system, sans-serif";

export default function AttacksView({ onBack }) {
  return (
    <div style={{
      background: BG,
      minHeight: '100vh',
      color: TEXT,
      fontFamily: DM_SANS,
      padding: '0 0 60px',
      overflowX: 'hidden',
      position: 'relative',
    }}>
      {/* Background gradient orbs */}
      <div style={{ position: 'fixed', top: -200, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, #EF444411 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: -200, left: -100, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, #8B5CF611 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Header */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '14px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: CARD_BG,
                backdropFilter: GLASS_BLUR,
                border: GLASS_BORDER,
                color: AMBER,
                cursor: 'pointer',
                fontSize: 12,
                padding: '6px 12px',
                borderRadius: GLASS_RADIUS,
                fontFamily: DM_SANS,
              }}
            >
              ← Back
            </button>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: `linear-gradient(135deg, ${AMBER}, ${AMBER_DARK})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: '#050B1A', flexShrink: 0,
                cursor: onBack ? 'pointer' : 'default',
              }}
                onClick={() => onBack && onBack()}
              >W</div>
              <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3, color: TEXT }}>
                ww3live<span style={{ color: AMBER }}>.xyz</span>
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#E8E8ED44', textTransform: 'uppercase', letterSpacing: 3, marginTop: 2 }}>
              Attack Alarm Frequency
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: SUBTEXT }}>
          Feb 28 → Present · 6 Countries
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        {/* Page intro */}
        <div style={{ padding: '24px 0 8px' }}>
          <p style={{ fontSize: 13, color: SUBTEXT, margin: 0, lineHeight: 1.6 }}>
            Daily projectile counts (ballistic missiles, drones, cruise missiles) reported by each country&apos;s Ministry of Defence.
            Gaps indicate days with no official report — <strong style={{ color: TEXT }}>no data fabricated</strong>.
          </p>
        </div>

        {/* Chart section */}
        <AttackChart />
      </div>
    </div>
  );
}
