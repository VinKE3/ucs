'use client';

import React from 'react';
import styles from '@/app/admin/admin.module.css';
import type { UsuarioItem, AsistenciaAdminItem } from '@/types/admin';

export interface DesgloseCursoPS {
  cursoId: number | null;
  cursoNombre: string;
  cursoCodigo?: string | null;
  horasDecimal: number;
  horasFormato: string;
  tarifaHora: number;
  subtotal: number;
  sesionesCount: number;
}

interface ModalComprobanteLiquidacionProps {
  isOpen: boolean;
  onClose: () => void;
  usuario: UsuarioItem | null;
  periodoLabel: string;
  desgloseCursos: DesgloseCursoPS[];
  totalHorasDecimal: number;
  totalHorasFormato: string;
  totalMonto: number;
  totalSesiones: number;
  asistencias: AsistenciaAdminItem[];
}

export const ModalComprobanteLiquidacion: React.FC<ModalComprobanteLiquidacionProps> = ({
  isOpen,
  onClose,
  usuario,
  periodoLabel,
  desgloseCursos,
  totalHorasDecimal,
  totalHorasFormato,
  totalMonto,
  totalSesiones,
  asistencias,
}) => {
  if (!isOpen || !usuario) return null;

  const fechaHoy = new Date().toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    const headers = [
      'UNIVERSIDAD CIENTÍFICA DEL SUR - PRE-LIQUIDACIÓN DE HONORARIOS PS',
      `Colaborador: ${usuario.apellidos}, ${usuario.nombres}`,
      `DNI: ${usuario.dni}`,
      `Período: ${periodoLabel}`,
      `Fecha Emisión: ${fechaHoy}`,
      '',
      'Curso / Estación',
      'Código',
      'N° Sesiones',
      'Horas (Decimal)',
      'Horas (Formato)',
      'Tarifa / Hora (S/.)',
      'Subtotal (S/.)',
    ];

    const rowsCursos = desgloseCursos.map((c) => [
      `"${c.cursoNombre}"`,
      `"${c.cursoCodigo || ''}"`,
      c.sesionesCount,
      c.horasDecimal.toFixed(2),
      `"${c.horasFormato}"`,
      c.tarifaHora.toFixed(2),
      c.subtotal.toFixed(2),
    ].join(';'));

    const resumenRows = [
      '',
      `"TOTAL GENERAL";"";${totalSesiones};${totalHorasDecimal.toFixed(2)};"${totalHorasFormato}";"";${totalMonto.toFixed(2)}`,
      '',
      'DETALLE DE TURNOS Y SESIONES DEL PERÍODO',
      'Fecha;Ingreso;Salida;Sede;Sala;Curso;Horas;Subtotal (S/.)',
    ];

    const sesionesRows = asistencias.map((a) => {
      const min = a.minutosTotales || 0;
      const horas = min / 60;
      let tarifa = 0;
      if (a.cursoTarifaHoraPs) tarifa = Number(a.cursoTarifaHoraPs);
      else if (usuario.tarifaHora) tarifa = Number(usuario.tarifaHora);
      const sub = horas * tarifa;

      const horaIn = a.horaIngreso ? new Date(a.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '-';
      const horaOut = a.horaSalida ? new Date(a.horaSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : 'En curso';

      return [
        a.fecha,
        horaIn,
        horaOut,
        `"${a.sedeNombre || ''}"`,
        `"${a.ambienteNombre || 'General'}"`,
        `"${a.cursoNombre || 'Sin curso'}"`,
        horas.toFixed(2),
        sub.toFixed(2),
      ].join(';');
    });

    const csvContent = '\uFEFF' + [
      ...headers,
      ...rowsCursos,
      ...resumenRows,
      ...sesionesRows,
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Liquidacion_PS_${usuario.dni}_${usuario.apellidos}_${fechaHoy.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 45px rgba(0,0,0,0.45)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL BARRA DE CONTROLES */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-elevated)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>💰</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Comprobante de Pre-Liquidación de Honorarios
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {usuario.apellidos}, {usuario.nombres} • {periodoLabel}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleDownloadCSV}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              title="Descargar desglose para Excel"
            >
              <span>📥</span> Excel / CSV
            </button>

            <button
              type="button"
              onClick={handlePrint}
              style={{
                background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                border: 'none',
                color: '#ffffff',
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)',
              }}
            >
              <span>🖨️</span> Imprimir / PDF
            </button>

            <button
              onClick={onClose}
              className={styles.closeBtn}
              style={{ marginLeft: '0.5rem' }}
              title="Cerrar modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* CONTENEDOR DOCUMENTO IMPRIMIBLE (TIPO FACTURA / VOUCHER) */}
        <div style={{ overflowY: 'auto', padding: '1.5rem', background: '#f8fafc' }}>
          <div
            id="comprobante-ps-print"
            style={{
              background: '#ffffff',
              color: '#0f172a',
              borderRadius: '10px',
              padding: '2rem',
              border: '1px solid #cbd5e1',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {/* MEMBRETE INSTITUCIONAL */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '2px solid #0d346c',
                paddingBottom: '1rem',
                marginBottom: '1.25rem',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <img
                  src="/logo.png"
                  alt="Universidad Científica del Sur"
                  style={{ height: '38px', width: 'auto', display: 'block' }}
                />
                <div style={{ borderLeft: '1.5px solid #cbd5e1', paddingLeft: '0.75rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.5px', color: '#0d346c', textTransform: 'uppercase' }}>
                    Centro de Simulación Clínica
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                    Facultad de Ciencias de la Salud
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    background: '#0d346c',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'inline-block',
                  }}
                >
                  PRE-LIQUIDACIÓN DE HONORARIOS
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.35rem' }}>
                  Emisión: <strong>{fechaHoy}</strong>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#ff5a00', fontWeight: 700 }}>
                  Período: {periodoLabel}
                </div>
              </div>
            </div>

            {/* DATOS DEL COLABORADOR */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '0.85rem',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.25rem',
                fontSize: '0.82rem',
              }}
            >
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>PACIENTE SIMULADO (ACTOR/ACTRIZ)</span>
                <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                  {usuario.apellidos}, {usuario.nombres}
                </strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>DOCUMENTO DE IDENTIDAD</span>
                <strong style={{ fontFamily: 'monospace', fontSize: '0.92rem' }}>DNI {usuario.dni}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>CORREO DE CONTACTO</span>
                <span>{usuario.correo || 'No registrado'}</span>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>TARIFA BASE ASIGNADA</span>
                <strong style={{ color: '#0284c7' }}>
                  {usuario.tarifaHora ? `S/. ${Number(usuario.tarifaHora).toFixed(2)}/hora` : 'Tarifa por curso'}
                </strong>
              </div>
            </div>

            {/* TABLA DE DESGLOSE POR CURSO */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>📋 DESGLOSE DE SIMULACIÓN POR CURSO</span>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{desgloseCursos.length} cursos/actividades</span>
              </div>

              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.82rem',
                  border: '1px solid #e2e8f0',
                }}
              >
                <thead>
                  <tr style={{ background: '#0d346c', color: '#ffffff', textAlign: 'left' }}>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Curso / Actividad ECOE</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Sesiones</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Horas Netas</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Tarifa / Hora</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Subtotal (S/.)</th>
                  </tr>
                </thead>
                <tbody>
                  {desgloseCursos.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        No hay horas registradas en este período.
                      </td>
                    </tr>
                  ) : (
                    desgloseCursos.map((c, i) => (
                      <tr
                        key={c.cursoId ?? `curso-${i}`}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          background: i % 2 === 0 ? '#ffffff' : '#f8fafc',
                        }}
                      >
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600 }}>
                          🎓 {c.cursoNombre} {c.cursoCodigo ? <span style={{ color: '#64748b', fontSize: '0.74rem' }}>({c.cursoCodigo})</span> : ''}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                          {c.sesionesCount}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontFamily: 'monospace' }}>
                          {c.horasFormato} <span style={{ color: '#64748b', fontSize: '0.74rem' }}>({c.horasDecimal.toFixed(2)}h)</span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontFamily: 'monospace' }}>
                          S/. {c.tarifaHora.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                          S/. {c.subtotal.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f1f5f9', borderTop: '2px solid #cbd5e1' }}>
                    <td colSpan={2} style={{ padding: '0.85rem', fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                      TOTAL GENERAL A LIQUIDAR
                    </td>
                    <td style={{ padding: '0.85rem', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace' }}>
                      {totalHorasFormato} <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({totalHorasDecimal.toFixed(2)}h)</span>
                    </td>
                    <td style={{ padding: '0.85rem', textAlign: 'right', color: '#64748b', fontSize: '0.78rem' }}>
                      -
                    </td>
                    <td
                      style={{
                        padding: '0.85rem',
                        textAlign: 'right',
                        fontWeight: 900,
                        fontSize: '1.15rem',
                        color: '#059669',
                        fontFamily: 'monospace',
                      }}
                    >
                      S/. {totalMonto.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* SECCIÓN DETALLADA DE SESIONES CONSOLIDADAS */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#475569', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                Registro Cronológico de Asistencias (Auditoría Kiosco)
              </div>
              <div
                style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Fecha</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Horario</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Sede / Sala</th>
                      <th style={{ padding: '0.4rem 0.6rem' }}>Curso</th>
                      <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Horas</th>
                      <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Importe (S/.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asistencias.map((a, idx) => {
                      const min = a.minutosTotales || 0;
                      const hrs = min / 60;
                      let tar = 0;
                      if (a.cursoTarifaHoraPs) tar = Number(a.cursoTarifaHoraPs);
                      else if (usuario.tarifaHora) tar = Number(usuario.tarifaHora);
                      const sub = hrs * tar;

                      const hIn = a.horaIngreso ? new Date(a.horaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '-';
                      const hOut = a.horaSalida ? new Date(a.horaSalida).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : 'Activo';

                      return (
                        <tr key={a.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.4rem 0.6rem' }}>{a.fecha}</td>
                          <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'monospace' }}>{hIn} - {hOut}</td>
                          <td style={{ padding: '0.4rem 0.6rem' }}>{a.sedeNombre} • {a.ambienteNombre || 'General'}</td>
                          <td style={{ padding: '0.4rem 0.6rem' }}>{a.cursoNombre || 'Simulación General'}</td>
                          <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontFamily: 'monospace' }}>{hrs.toFixed(2)}h</td>
                          <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                            S/. {sub.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* NOTA LEGAL Y FIRMAS */}
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '2.5rem', lineHeight: 1.4 }}>
              * Documento interno de control operacional para la emisión de Recibo por Honorarios Electrónico (RHE) a la Universidad Científica del Sur S.A.C.
              El importe final está sujeto a las retenciones de Ley (4ta Categoría / Impuesto a la Renta) según aplique al colaborador.
            </div>

            {/* CUADROS DE FIRMAS */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '3rem',
                paddingTop: '1rem',
                borderTop: '1px dashed #cbd5e1',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '45px' }} />
                <div style={{ borderTop: '1px solid #0f172a', paddingTop: '0.4rem', fontWeight: 700, fontSize: '0.78rem' }}>
                  CENTRO DE SIMULACIÓN CLÍNICA
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  V°B° Jefatura / Coordinación Operativa
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ height: '45px' }} />
                <div style={{ borderTop: '1px solid #0f172a', paddingTop: '0.4rem', fontWeight: 700, fontSize: '0.78rem' }}>
                  {usuario.nombres} {usuario.apellidos}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  Paciente Simulado • DNI {usuario.dni}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
