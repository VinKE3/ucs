'use client';

import React, { useState, useEffect } from 'react';
import styles from '@/app/admin/admin.module.css';
import { confirmModal, showToast } from '@/lib/alerts';
import type { SedeAdminItem } from '@/types/admin';

interface TerminalItem {
  id: number;
  token: string;
  nombre: string;
  sedeId: number | null;
  sedeNombre: string | null;
  sedeCodigo: string | null;
  dispositivoInfo: string | null;
  ipRegistro: string | null;
  activo: boolean;
  ultimoUso: string | null;
  createdAt: string;
  creadorNombre: string | null;
  creadorApellido: string | null;
}

interface ModalGestionTerminalesProps {
  isOpen: boolean;
  onClose: () => void;
  sedesList: SedeAdminItem[];
}

export const ModalGestionTerminales: React.FC<ModalGestionTerminalesProps> = ({
  isOpen,
  onClose,
  sedesList,
}) => {
  const [terminales, setTerminales] = useState<TerminalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchTerminales = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/terminales');
      if (res.ok) {
        const data = await res.json();
        setTerminales(data.terminales || []);
      }
    } catch (err) {
      console.error('Error cargando terminales:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTerminales();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleActivo = async (term: TerminalItem) => {
    setTogglingId(term.id);
    try {
      const res = await fetch('/api/admin/terminales', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: term.id, activo: !term.activo }),
      });
      if (res.ok) {
        setTerminales((prev) =>
          prev.map((t) => (t.id === term.id ? { ...t, activo: !term.activo } : t))
        );
        showToast(
          `Terminal "${term.nombre}" ${!term.activo ? 'activada' : 'desactivada'}`,
          'success'
        );
      } else {
        showToast('Error al modificar estado de la terminal', 'error');
      }
    } catch {
      showToast('Error de red al actualizar terminal', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleEliminar = async (term: TerminalItem) => {
    const confirmed = await confirmModal({
      title: '¿Revocar y eliminar terminal?',
      text: `El dispositivo "${term.nombre}" perderá la autorización inmediatamente y no podrá registrar asistencias.`,
      confirmText: 'Sí, revocar terminal',
      isDanger: true,
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/terminales?id=${term.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setTerminales((prev) => prev.filter((t) => t.id !== term.id));
        showToast(`Terminal "${term.nombre}" revocada exitosamente`, 'success');
      } else {
        showToast('Error al eliminar la terminal', 'error');
      }
    } catch {
      showToast('Error de red al revocar terminal', 'error');
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '780px', width: '95%' }}
      >
        {/* CABECERA */}
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🖥️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Terminales Kiosco Autorizadas
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Dispositivos físicos (tablets / PCs) habilitados para registrar asistencia en sedes UCS
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className={styles.closeBtn}>
            ✕
          </button>
        </div>

        {/* INSTRUCCIÓN / AYUDA RÁPIDA */}
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            fontSize: '0.825rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem',
          }}
        >
          <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>💡</span>
          <div>
            <strong style={{ color: 'var(--ucs-blue-sky, #38bdf8)' }}>
              ¿Cómo autorizar una nueva tablet o pantalla de clínica?
            </strong>
            <p style={{ margin: '0.25rem 0 0 0', lineHeight: 1.45 }}>
              Abre el enlace de la web directamente en la tablet/PC de la clínica (en Edge o Chrome). En la pantalla de bloqueo, haz clic en{' '}
              <strong>"Autorizar este Dispositivo"</strong> e ingresa tus credenciales de Administrador. El token quedará guardado permanentemente en ese navegador.
            </p>
          </div>
        </div>

        {/* LISTADO DE TERMINALES */}
        <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              Cargando terminales registradas...
            </div>
          ) : terminales.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                background: 'var(--pill-bg)',
                border: '1px dashed var(--border-color)',
                borderRadius: '12px',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📱</div>
              <h4 style={{ color: 'var(--text-primary)', margin: '0 0 0.35rem 0', fontWeight: 700 }}>
                No hay terminales vinculadas aún
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: 0 }}>
                Cualquier intento de marcar desde fuera de una tablet autorizada será bloqueado.
                Acércate a la tablet de simulación para autorizarla por primera vez.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {terminales.map((term) => (
                <div
                  key={term.id}
                  style={{
                    background: 'var(--bg-secondary, #0c1c38)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '1rem 1.15rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        background: term.activo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                        border: `1px solid ${term.activo ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.4rem',
                      }}
                    >
                      {term.activo ? '📱' : '🔒'}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {term.nombre}
                        </strong>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '9999px',
                            background: term.activo ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                            color: term.activo ? '#10b981' : '#ef4444',
                            border: `1px solid ${term.activo ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                          }}
                        >
                          ● {term.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                        <span>
                          📍 {term.sedeNombre ? term.sedeNombre : 'Cualquier Campus'}
                        </span>
                        <span>•</span>
                        <span>
                          Último uso:{' '}
                          {term.ultimoUso
                            ? new Date(term.ultimoUso).toLocaleString('es-PE', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Sin actividad'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      disabled={togglingId === term.id}
                      onClick={() => handleToggleActivo(term)}
                      className={styles.secondaryActionBtn}
                      style={{ fontSize: '0.775rem', padding: '0.4rem 0.75rem' }}
                      title={term.activo ? 'Desactivar temporalmente' : 'Reactivar'}
                    >
                      {term.activo ? '⏸️ Desactivar' : '▶️ Activar'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEliminar(term)}
                      className={styles.secondaryActionBtn}
                      style={{ fontSize: '0.775rem', padding: '0.4rem 0.65rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      title="Revocar permanentemente"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PIE DEL MODAL */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
          <button type="button" onClick={onClose} className={styles.submitBtn} style={{ width: 'auto', padding: '0.6rem 1.5rem' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
