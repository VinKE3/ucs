'use client';

import React, { useState } from 'react';

interface CategoriaDistribucion {
  categoria: string;
  total: number;
  color?: string;
  icono?: string;
}

interface GraficoDonaMotivosProps {
  distribucion: CategoriaDistribucion[];
  totalGeneral: number;
}

export const GraficoDonaMotivos: React.FC<GraficoDonaMotivosProps> = ({
  distribucion,
  totalGeneral,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const defaultColors = ['#ff5a00', '#38bdf8', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#64748b'];

  if (!distribucion || distribucion.length === 0 || totalGeneral === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '220px',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          gap: '0.5rem',
        }}
      >
        <span style={{ fontSize: '2rem' }}>📭</span>
        <span>Sin incidencias registradas en el período seleccionado</span>
      </div>
    );
  }

  // Dimensiones del SVG
  const size = 200;
  const center = size / 2;
  const radius = 80;
  const innerRadius = 48;

  let cumulativeAngle = -90; // Empezar arriba (12 en punto)

  const slices = distribucion.map((cat, idx) => {
    const percentage = cat.total / totalGeneral;
    const angle = percentage * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle += angle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const x3 = center + innerRadius * Math.cos(endRad);
    const y3 = center + innerRadius * Math.sin(endRad);
    const x4 = center + innerRadius * Math.cos(startRad);
    const y4 = center + innerRadius * Math.sin(startRad);

    const largeArc = angle > 180 ? 1 : 0;

    // SVG path para el sector de corona circular (donut slice)
    const pathData =
      angle >= 359.9
        ? `M ${center - radius} ${center} A ${radius} ${radius} 0 1 0 ${center + radius} ${center} A ${radius} ${radius} 0 1 0 ${center - radius} ${center} M ${center - innerRadius} ${center} A ${innerRadius} ${innerRadius} 0 1 1 ${center + innerRadius} ${center} A ${innerRadius} ${innerRadius} 0 1 1 ${center - innerRadius} ${center} Z`
        : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;

    const color = cat.color || defaultColors[idx % defaultColors.length];

    return {
      cat,
      idx,
      pathData,
      color,
      percentage: Math.round(percentage * 100),
    };
  });

  const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.25rem',
      }}
    >
      {/* DONUT SVG */}
      <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices.map((slice) => {
            const isHovered = hoveredIdx === slice.idx;
            return (
              <path
                key={slice.idx}
                d={slice.pathData}
                fill={slice.color}
                style={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, opacity 0.2s ease',
                  opacity: hoveredIdx === null || isHovered ? 1 : 0.6,
                  transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                  transformOrigin: `${center}px ${center}px`,
                }}
                onMouseEnter={() => setHoveredIdx(slice.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* ETIQUETA CENTRAL EN LA DONA */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
            {activeSlice ? activeSlice.cat.total : totalGeneral}
          </span>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {activeSlice ? `${activeSlice.percentage}%` : 'ALERTAS'}
          </span>
        </div>
      </div>

      {/* LEYENDA DETALLADA CON BARRITAS */}
      <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        {slices.slice(0, 6).map((slice) => {
          const isHovered = hoveredIdx === slice.idx;
          return (
            <div
              key={slice.idx}
              onMouseEnter={() => setHoveredIdx(slice.idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.3rem 0.5rem',
                borderRadius: '6px',
                background: isHovered ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '3px',
                    background: slice.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: isHovered ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {slice.cat.icono || '🚨'} {slice.cat.categoria}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{slice.cat.total}</strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({slice.percentage}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
