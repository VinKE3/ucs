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
  configuracion: { label: 'Configuración', icon: '⚙️', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.14)' },
  asistencias: { label: 'Asistencias', icon: '📋', color: '#d97706', bg: 'rgba(245, 158, 11, 0.14)' },
  terminales: { label: 'Terminales', icon: '🖥️', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.14)' },
};

export const ModalAuditLogs: React.FC<ModalAuditLogsProps> = ({ isOpen, onClose }) => {
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moduloFilter, setModuloFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (moduloFilter !== 'todos') params.set('modulo', moduloFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
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
  }, [moduloFilter, searchQuery]);

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
          maxWidth: '860px',
          width: '95%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: '1.15rem 1.4rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              🛡️ Bitácora Institucional de Auditoría
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Trazabilidad inmutable de biometría (Ley 29733), configuración global y ajustes manuales
            </p>
          </div>
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

        {/* FILTROS */}
        <div
          style={{
            padding: '0.85rem 1.4rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.65rem',
            background: 'var(--bg-input, rgba(0,0,0,0.02))',
          }}
        >
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'biometria', label: '👁️ Biometría' },
              { id: 'configuracion', label: '⚙️ Configuración' },
              { id: 'asistencias', label: '📋 Asistencias' },
            ].map((pill) => {
              const active = moduloFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setModuloFilter(pill.id)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar actor, DNI o evento..."
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                minWidth: '210px',
              }}
            />
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
              No hay eventos registrados todavía para este filtro. Las acciones de biometría, configuración y ajustes manuales aparecerán aquí automáticamente.
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
