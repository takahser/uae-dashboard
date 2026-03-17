export default function MarketBadge({ x, y, label, price, change, changePercent }) {
  const isUp = (change ?? 0) >= 0;
  const arrow = isUp ? '\u25B2' : '\u25BC';
  const color = isUp ? '#27AE60' : '#EF4444';
  const w = 120;
  const h = 38;

  return (
    <g>
      <title>{label}: ${price?.toFixed(2) ?? '--'} ({isUp ? '+' : ''}{changePercent?.toFixed(1) ?? 0}%)</title>
      <rect
        x={x - w / 2} y={y - h / 2}
        width={w} height={h} rx={6}
        fill="rgba(5,11,26,0.88)"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1}
      />
      <text x={x} y={y - 5} fill="rgba(255,255,255,0.5)" fontSize={8} textAnchor="middle" fontWeight={600}>
        {label}
      </text>
      <text x={x - 14} y={y + 12} fill="#E8EDF5" fontSize={13} textAnchor="middle" fontWeight={700}>
        ${price?.toFixed(2) ?? '--'}
      </text>
      <text x={x + 36} y={y + 12} fill={color} fontSize={9} textAnchor="middle" fontWeight={600}>
        {arrow} {Math.abs(changePercent ?? 0).toFixed(1)}%
      </text>
    </g>
  );
}

export function SpreadBadge({ x, y, brentPrice, wtiPrice }) {
  const spread = (brentPrice ?? 0) - (wtiPrice ?? 0);
  const spreadColor = spread > 20 ? '#EF4444' : spread > 10 ? '#E67E22' : spread > 5 ? '#F1C40F' : '#27AE60';
  const w = 110;
  const h = 36;

  return (
    <g>
      <title>Hormuz Premium (Brent-WTI spread): +${spread.toFixed(2)}/bbl</title>
      <rect
        x={x - w / 2} y={y - h / 2}
        width={w} height={h} rx={6}
        fill="rgba(5,11,26,0.88)"
        stroke={spreadColor}
        strokeWidth={1.5}
      />
      <text x={x} y={y - 4} fill="rgba(255,255,255,0.5)" fontSize={7} textAnchor="middle" fontWeight={600}>
        HORMUZ PREMIUM
      </text>
      <text x={x} y={y + 11} fill={spreadColor} fontSize={12} textAnchor="middle" fontWeight={700}>
        +${spread.toFixed(2)}/bbl
      </text>
    </g>
  );
}
