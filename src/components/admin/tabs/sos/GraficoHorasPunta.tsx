'use client';

import React, { useState } from 'react';

interface HoraDistribucion {
  hora: number;
  label: string;
  total: number;
}

interface GraficoHorasPuntaProps {
  distribucionHoras?: HoraDistribucion[];
}

export const GraficoHorasPunta: React.FC<GraficoHorasPuntaProps> = ({
  distribucionHoras = [],
}) => {
  const [hoveredHora, setHoveredHora] = useState<HoraDistribucion | null>(null);

  // Filtrar horario de clínica operativa: 07:00 a 22:00
  const horas = distribucionHoras.filter((h) => h.hora >= 7 && h.hora <= 22);
  const maxTotal = Math.max(...horas.map((h) => h.total), 1);
  const horaPico = horas.reduce((max, h) => (h.total > max.total ? h : max), horas[0] || { hora: 0, label: '', total: 0 });

  if (horas.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Sin registros de horario para graficar.
      </div>
    );
  }

  return (
    <div>
      {/* HEADER DEL GRÁFICO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Volumen de llamadas por hora del día
        </span>
        {horaPico && horaPico.total > 0 && (
          <span
            style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '6px',
              background: 'rgba(255, 90, 0, 0.15)',
              color: '#ff5a00',
              border: '1px solid rgba(255, 90, 0, 0.3)',
            }}
          >
            🔥 Hora Pico: {horaPico.label} ({horaPico.total} llamada{horaPico.total > 1 ? 's' : ''})
          </span>
        )}
      </div>

      {/* ÁREA DE BARRAS */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '6px',
          height: '150px',
          padding: '0 0.5rem 0.5rem',
          borderBottom: '1.5px solid var(--border-color)',
          position: 'relative',
        }}
      >
        {horas.map((item) => {
          const heightPct = item.total > 0 ? Math.max((item.total / maxTotal) * 100, 12) : 4;
          const isPeak = item.total === maxTotal && maxTotal > 0;
          const isHovered = hoveredHora?.hora === item.hora;

          let bg = 'rgba(255, 255, 255, 0.08)';
          if (isPeak) {
            bg = 'linear-gradient(180deg, #ff5a00 0%, #e64a00 100%)';
          } else if (item.total > 0) {
            bg = isHovered
              ? 'linear-gradient(180deg, #38bdf8 0%, #0d346c 100%)'
              : 'linear-gradient(180deg, rgba(56, 189, 248, 0.7) 0%, rgba(13, 52, 108, 0.7) 100%)';
          }

          return (
            <div
              key={item.hora}
              onMouseEnter={() => setHoveredHora(item)}
              onMouseLeave={() => setHoveredHora(null)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {/* TOOLTIP FLOTANTE EN HOVER */}
              {isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-36px',
                    background: '#0f172a',
                    color: '#ffffff',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-color)',
                    zIndex: 20,
                    pointerEvents: 'none',
                  }}
                >
                  {item.label}: {item.total} alertas
                </div>
              )}

              {/* VALOR SUPERIOR DE LA BARRA */}
              {item.total > 0 && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: isPeak ? '#ff5a00' : 'var(--text-secondary)',
                    marginBottom: '0.2rem',
                  }}
                >
                  {item.total}
                </span>
              )}

              {/* BARRA */}
              <div
                style={{
                  width: '100%',
                  height: `${heightPct}%`,
                  background: bg,
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.3s ease, transform 0.15s ease',
                  transform: isHovered ? 'scaleY(1.05)' : 'scaleY(1)',
                  transformOrigin: 'bottom',
                  boxShadow: isPeak ? '0 0 10px rgba(255, 90, 0, 0.4)' : 'none',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* EJE X CON HORAS */}
      <div style={{ display: 'flex', gap: '6px', padding: '0.4rem 0.5rem 0' }}>
        {horas.map((item) => (
          <div
            key={item.hora}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: '0.65rem',
              color: hoveredHora?.hora === item.hora ? 'var(--ucs-blue-sky)' : 'var(--text-muted)',
              fontWeight: hoveredHora?.hora === item.hora ? 700 : 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.hora}h
          </div>
        ))}
      </div>
    </div>
  );
};
