import React from 'react';
import Design1 from './Design1';
import Design2 from './Design2';
import Design3 from './Design3';
import Design4 from './Design4';
import Design5 from './Design5';

const designs = [
  { num: 1, name: 'War Room Black', desc: 'Military terminal aesthetic — NSA situation room', Component: Design1 },
  { num: 2, name: 'Intelligence Report', desc: 'Editorial layout — The Economist meets classified briefing', Component: Design2 },
  { num: 3, name: 'Cyberpunk Neon', desc: 'Futuristic HUD — Cyberpunk 2077 meets Palantir', Component: Design3 },
  { num: 4, name: 'Clean SaaS Dashboard', desc: 'Modern product design — Linear / Vercel / Stripe', Component: Design4 },
  { num: 5, name: 'Dark Glassmorphism', desc: 'Premium frosted glass — Apple Vision Pro meets finance', Component: Design5 },
];

export default function DesignShowcase() {
  return (
    <div style={{
      background: '#111', minHeight: '100vh', color: '#FFF',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      {/* Header */}
      <div style={{
        padding: '40px 48px 32px',
        borderBottom: '1px solid #333',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'
      }}>
        <div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 4, letterSpacing: 2, textTransform: 'uppercase' }}>
            ww3live.xyz redesign
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1 }}>
            Select your design
          </div>
          <div style={{ fontSize: 15, color: '#888', marginTop: 4 }}>
            5 concepts — scroll to compare, then pick your favourite
          </div>
        </div>
        <button onClick={() => { window.location.hash = '#/'; }} style={{
          padding: '8px 20px', background: '#333', border: '1px solid #555',
          color: '#FFF', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          fontFamily: 'inherit'
        }}>Back to Home</button>
      </div>

      {/* Designs */}
      {designs.map(({ num, name, desc, Component }) => (
        <div key={num}>
          <div style={{
            padding: '24px 48px 12px',
            display: 'flex', alignItems: 'baseline', gap: 16
          }}>
            <span style={{
              fontSize: 48, fontWeight: 800, color: '#333',
              fontVariantNumeric: 'tabular-nums', lineHeight: 1
            }}>{num}</span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{name}</div>
              <div style={{ fontSize: 13, color: '#888' }}>{desc}</div>
            </div>
          </div>
          <div style={{
            margin: '0 48px 48px',
            borderRadius: 12, overflow: 'hidden',
            border: '1px solid #333',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }}>
            <Component />
          </div>
        </div>
      ))}
    </div>
  );
}
