'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from '@/app/admin/admin.module.css';

interface AuditLogItem {
  id: number;
  actorId: number | null;
  actorNombre: string;
  actorRol: string;
  modulo: string;
  accion: string;
  entidadTipo: string | null;
  entidadId: string | null;
  resumen: string;
  detalles: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface ModalAuditLogsProps {
  isOpen: boolean;
  onClose: () => void;
}

const MODULO_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  biometria: { label: 'Biometría', icon: '👁️', color: '#059669', bg: 'rgba(16, 185, 129, 0.14)' },
  usuarios: { label: 'Usuarios', icon: '👤', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.14)' },
  terminales: { label: 'Terminales', icon: '🖥️', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.14)' },
  sedes_salas: { label: 'Sedes/Salas', icon: '🏛️', color: '#0d9488', bg: 'rgba(13, 148, 136, 0.14)' },
  asistencias: { label: 'Asistencias', icon: '📋', color: '#d97706', bg: 'rgba(245, 158, 11, 0.14)' },
  configuracion: { label: 'Config', icon: '⚙️', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.14)' },
  sistema: { label: 'Sistema', icon: '🚨', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.14)' },
};

export const ModalAuditLogs: React.FC<ModalAuditLogsProps> = ({ isOpen, onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moduloFilter, setModuloFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (moduloFilter !== 'todos') params.set('modulo', moduloFilter);
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (fechaDesde) params.set('fechaDesde', fechaDesde);
    if (fechaHasta) params.set('fechaHasta', fechaHasta);
    return params;
  }, [moduloFilter, searchQuery, fechaDesde, fechaHasta]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildFilterParams();
      params.set('limit', '100');

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo cargar la bitácora de auditoría');
      }
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar registros');
    } finally {
      setLoading(false);
    }
  }, [buildFilterParams]);

  const handleExportExcel = async () => {
    setExporting(true);
    setError(null);
    try {
      const params = buildFilterParams();
      params.set('export', 'xlsx');

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('No se pudo generar el archivo Excel de auditoría.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const todayStamp = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
      link.href = url;
      link.download = `UCS_Auditoria_${todayStamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Error exportando bitácora');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      fetchLogs();
    }, 180);
    return () => clearTimeout(t);
  }, [isOpen, fetchLogs]);

  if (!isOpen || !mounted) return null;

  const formatLimaDateTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return createPortal(
    <div
      className={styles.modalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ zIndex: 1100 }}
    >
      <div
        className={styles.modalContent}
        style={{
          maxWidth: '940px',
          width: '96%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: '1.1rem 1.4rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              🛡️ Bitácora Institucional de Auditoría
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Trazabilidad inmutable de biometría (Ley 29733), usuarios, terminales, sedes, asistencias y errores críticos
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting || loading}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                background: 'rgba(16, 185, 129, 0.14)',
                color: '#10b981',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: exporting || loading ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title="Descargar los registros filtrados en formato Excel (.xlsx)"
            >
              <span>📊</span>
              <span>{exporting ? 'Generando...' : 'Exportar Excel'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* FILTROS */}
        <div
          style={{
            padding: '0.8rem 1.4rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            background: 'var(--bg-input, rgba(0,0,0,0.02))',
          }}
        >
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'biometria', label: '👁️ Biometría' },
              { id: 'usuarios', label: '👤 Usuarios' },
              { id: 'terminales', label: '🖥️ Terminales' },
              { id: 'sedes_salas', label: '🏛️ Sedes/Salas' },
              { id: 'asistencias', label: '📋 Asistencias' },
              { id: 'configuracion', label: '⚙️ Config' },
              { id: 'sistema', label: '🚨 Sistema' },
            ].map((pill) => {
              const active = moduloFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setModuloFilter(pill.id)}
                  style={{
                    padding: '0.32rem 0.68rem',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: active ? '1px solid #0284c7' : '1px solid var(--border-color)',
                    background: active ? 'rgba(2, 132, 199, 0.14)' : 'transparent',
                    color: active ? '#0284c7' : 'var(--text-secondary)',
                  }}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar actor, DNI, acción o evento..."
              style={{
                flex: '1 1 200px',
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              <span>Desde:</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                style={{
                  padding: '0.36rem 0.5rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.76rem',
                }}
              />
              <span>Hasta:</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                style={{
                  padding: '0.36rem 0.5rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.76rem',
                }}
              />
            </div>

            {(fechaDesde || fechaHasta || searchQuery || moduloFilter !== 'todos') && (
              <button
                type="button"
                onClick={() => {
                  setModuloFilter('todos');
                  setSearchQuery('');
                  setFechaDesde('');
                  setFechaHasta('');
                }}
                style={{
                  padding: '0.38rem 0.65rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Limpiar
              </button>
            )}

            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Actualizar registros"
            >
              {loading ? '⏳' : '🔄'}
            </button>
          </div>
        </div>

        {/* LISTA DE EVENTOS */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {error && (
            <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: '0.84rem' }}>
              ⚠️ {error}
            </div>
          )}

          {!loading && !error && logs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              No hay eventos registrados todavía para este filtro. Las acciones administrativas, biométricas y errores críticos aparecerán aquí automáticamente.
            </div>
          )}

          {logs.map((item) => {
            const meta = MODULO_META[item.modulo] || {
              label: item.modulo,
              icon: '📌',
              color: '#64748b',
              bg: 'rgba(100,116,139,0.14)',
            };
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '0.75rem 0.95rem',
                  background: 'var(--bg-card)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '6px',
                        color: meta.color,
                        background: meta.bg,
                      }}
                    >
                      {meta.icon} {meta.label}
                    </span>
                    <code
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        background: 'var(--bg-input)',
                        padding: '0.12rem 0.45rem',
                        borderRadius: '5px',
                      }}
                    >
                      {item.accion}
                    </code>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      por <strong style={{ color: 'var(--text-primary)' }}>{item.actorNombre}</strong> ({item.actorRol})
                    </span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {formatLimaDateTime(item.createdAt)}
                  </span>
                </div>

                <p style={{ margin: '0.45rem 0 0', fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {item.resumen}
                </p>

                <div style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span>
                    {item.entidadId ? `ID/Ref: ${item.entidadId}` : ''}
                    {item.ipAddress ? ` • IP: ${item.ipAddress}` : ''}
                  </span>
                  {item.detalles && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#0284c7',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {isExpanded ? 'Ocultar JSON ▲' : 'Ver detalles ▼'}
                    </button>
                  )}
                </div>

                {isExpanded && item.detalles && (
                  <pre
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.6rem',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.9)',
                      color: '#cbd5e1',
                      fontSize: '0.72rem',
                      overflowX: 'auto',
                    }}
                  >
                    {JSON.stringify(item.detalles, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};
