'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from '@/app/admin/admin.module.css';
import { confirmModal, showToast } from '@/lib/alerts';
import type { SedeAdminItem, CodigoAutorizacionTerminalItem } from '@/types/admin';

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
  initialTab?: 'terminales' | 'codigos';
}

export const ModalGestionTerminales: React.FC<ModalGestionTerminalesProps> = ({
  isOpen,
  onClose,
  sedesList,
  initialTab = 'terminales',
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useState<'terminales' | 'codigos'>(initialTab);

  // Estados de Terminales
  const [terminales, setTerminales] = useState<TerminalItem[]>([]);
  const [loadingTerminales, setLoadingTerminales] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Estados de Códigos OTP
  const [codigos, setCodigos] = useState<CodigoAutorizacionTerminalItem[]>([]);
  const [loadingCodigos, setLoadingCodigos] = useState(false);
  const [showGenerador, setShowGenerador] = useState(false);
  const [generando, setGenerando] = useState(false);

  // Formulario nuevo código OTP
  const [genSedeId, setGenSedeId] = useState<number | ''>('');
  const [genNombreSugerido, setGenNombreSugerido] = useState('');
  const [genDuracion, setGenDuracion] = useState<number>(30); // 30 minutos
  const [genNota, setGenNota] = useState('');
  const [ultimoCodigoGenerado, setUltimoCodigoGenerado] = useState<CodigoAutorizacionTerminalItem | null>(null);

  // Sincronizar tab inicial cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      fetchTerminales();
      fetchCodigos();
      setShowGenerador(initialTab === 'codigos');
      setUltimoCodigoGenerado(null);
    }
  }, [isOpen, initialTab]);

  const fetchTerminales = async () => {
    setLoadingTerminales(true);
    try {
      const res = await fetch('/api/admin/terminales');
      if (res.ok) {
        const data = await res.json();
        setTerminales(data.terminales || []);
      }
    } catch (err) {
      console.error('Error cargando terminales:', err);
    } finally {
      setLoadingTerminales(false);
    }
  };

  const fetchCodigos = async () => {
    setLoadingCodigos(true);
    try {
      const res = await fetch('/api/admin/terminales/codigos');
      if (res.ok) {
        const data = await res.json();
        setCodigos(data.codigos || []);
      }
    } catch (err) {
      console.error('Error cargando códigos OTP:', err);
    } finally {
      setLoadingCodigos(false);
    }
  };

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

  const handleEliminarTerminal = async (term: TerminalItem) => {
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

  const handleGenerarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerando(true);
    try {
      const res = await fetch('/api/admin/terminales/codigos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sedeId: genSedeId ? Number(genSedeId) : null,
          nombreSugerido: genNombreSugerido.trim() || null,
          duracionMinutos: genDuracion,
          nota: genNota.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al generar código de autorización');
      }

      setUltimoCodigoGenerado(data.codigo);
      setCodigos((prev) => [data.codigo, ...prev]);
      setShowGenerador(false);
      setGenNombreSugerido('');
      setGenNota('');

      showToast(`Código OTP "${data.codigo.codigo}" generado exitosamente`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al generar código', 'error');
    } finally {
      setGenerando(false);
    }
  };

  const handleRevocarCodigo = async (codigoItem: CodigoAutorizacionTerminalItem) => {
    const confirmed = await confirmModal({
      title: '¿Revocar este código OTP?',
      text: `El código "${codigoItem.codigo}" quedará invalidado y nadie podrá usarlo para autorizar un dispositivo.`,
      confirmText: 'Sí, revocar código',
      isDanger: true,
    });

    if (!confirmed) return;

    try {
      const res = await fetch('/api/admin/terminales/codigos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: codigoItem.id }),
      });
      if (res.ok) {
        setCodigos((prev) =>
          prev.map((c) => (c.id === codigoItem.id ? { ...c, activo: false, estado: 'revocado' } : c))
        );
        if (ultimoCodigoGenerado?.id === codigoItem.id) {
          setUltimoCodigoGenerado(null);
        }
        showToast(`Código "${codigoItem.codigo}" revocado exitosamente`, 'success');
      } else {
        showToast('Error al revocar el código', 'error');
      }
    } catch {
      showToast('Error de red al revocar código', 'error');
    }
  };

  const handleEliminarCodigo = async (codigoItem: CodigoAutorizacionTerminalItem) => {
    try {
      const res = await fetch(`/api/admin/terminales/codigos?id=${codigoItem.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCodigos((prev) => prev.filter((c) => c.id !== codigoItem.id));
        showToast('Registro de código eliminado', 'success');
      } else {
        showToast('Error al eliminar registro', 'error');
      }
    } catch {
      showToast('Error de red', 'error');
    }
  };

  const handleCopiarWhatsApp = (codigoItem: CodigoAutorizacionTerminalItem) => {
    const sedeTexto = codigoItem.sedeNombre || 'Cualquier Campus (Multisede)';
    const terminalTexto = codigoItem.nombreSugerido || 'Terminal Kiosco Oficial';
    const msg = `🔐 *CÓDIGO DE ACTIVACIÓN DE KIOSCO - UCS*
📍 *Sede:* ${sedeTexto}
🖥️ *Dispositivo:* ${terminalTexto}
🔑 *Código de Activación:* ${codigoItem.codigo}
⏳ *Válido por:* ${codigoItem.tiempoRestanteMinutos ?? 30} minutos (Un solo uso)

👉 *Pasos para habilitar la PC o Tablet:*
1. Abre el sistema en Google Chrome o Edge.
2. Pulsa el botón "Autorizar este Dispositivo".
3. En la pestaña "Código de Un Solo Uso", digita: *${codigoItem.codigo}*
4. Confirma el nombre y pulsa "Vincular y Autorizar".`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(msg);
      showToast('¡Instrucciones y código copiados para WhatsApp!', 'success');
    } else {
      showToast(`Código: ${codigoItem.codigo}`, 'info');
    }
  };

  const codigosActivos = codigos.filter((c) => c.estado === 'activo');

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '820px', width: '95%' }}
      >
        {/* CABECERA */}
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.6rem' }}>🖥️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Gestión de Terminales Kiosco
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Autorización física y remota de tablets y computadoras para registro de asistencias
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className={styles.closeBtn}>
            ✕
          </button>
        </div>

        {/* NAVEGACIÓN DE PESTAÑAS (TABS) */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('terminales')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'terminales' ? '1px solid var(--ucs-blue-sky, #00b4d8)' : '1px solid transparent',
              background: activeTab === 'terminales' ? 'rgba(0, 180, 216, 0.12)' : 'transparent',
              color: activeTab === 'terminales' ? 'var(--ucs-blue-sky, #00b4d8)' : 'var(--text-secondary)',
              transition: 'all 0.2s ease',
            }}
          >
            <span>📱</span>
            <span>Dispositivos Vinculados ({terminales.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('codigos')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === 'codigos' ? '1px solid #ff5a00' : '1px solid transparent',
              background: activeTab === 'codigos' ? 'rgba(255, 90, 0, 0.12)' : 'transparent',
              color: activeTab === 'codigos' ? '#ff5a00' : 'var(--text-secondary)',
              transition: 'all 0.2s ease',
            }}
          >
            <span>🔑</span>
            <span>Códigos de Un Solo Uso (OTP)</span>
            {codigosActivos.length > 0 && (
              <span
                style={{
                  background: '#10b981',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '9999px',
                  fontWeight: 800,
                }}
              >
                {codigosActivos.length}
              </span>
            )}
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: DISPOSITIVOS FÍSICOS VINCULADOS                    */}
        {/* ========================================================= */}
        {activeTab === 'terminales' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* INSTRUCCIÓN / AYUDA RÁPIDA CON ACCESO DIRECTO A OTP */}
            <div
              style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                fontSize: '0.825rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.85rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', flex: 1, minWidth: '260px' }}>
                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>💡</span>
                <div>
                  <strong style={{ color: 'var(--ucs-blue-sky, #38bdf8)' }}>
                    ¿Necesitas habilitar una PC o tablet en otra sede a distancia?
                  </strong>
                  <p style={{ margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
                    No necesitas AnyDesk ni dar tus contraseñas maestras. Genera una contraseña temporal de un solo uso en segundos.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('codigos');
                  setShowGenerador(true);
                }}
                className={styles.actionBtn}
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              >
                <span>🔑</span> Generar Código OTP
              </button>
            </div>

            {/* LISTADO DE TERMINALES */}
            <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
              {loadingTerminales ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  Cargando terminales registradas...
                </div>
              ) : terminales.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '2.5rem 1rem',
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
                        padding: '0.9rem 1.15rem',
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
                            width: '42px',
                            height: '42px',
                            borderRadius: '10px',
                            background: term.activo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                            border: `1px solid ${term.activo ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.3rem',
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

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.25rem', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
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
                          onClick={() => handleEliminarTerminal(term)}
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
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CÓDIGOS DE UN SOLO USO (OTP)                       */}
        {/* ========================================================= */}
        {activeTab === 'codigos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* BARRA SUPERIOR DE CÓDIGOS */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.8rem',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Contraseñas de Activación Remota (OTP)
                </h4>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                  Códigos efímeros que se consumen al vincular una PC/tablet. Sin exponer tus credenciales maestras.
                </p>
              </div>

              {!showGenerador && (
                <button
                  type="button"
                  onClick={() => setShowGenerador(true)}
                  className={styles.actionBtn}
                  style={{ padding: '0.45rem 1rem', fontSize: '0.825rem' }}
                >
                  <span>+</span> Generar Nuevo Código
                </button>
              )}
            </div>

            {/* FORMULARIO DE GENERACIÓN DE CÓDIGO */}
            {showGenerador && (
              <form
                onSubmit={handleGenerarCodigo}
                style={{
                  background: 'var(--bg-secondary, #0c1c38)',
                  border: '1.5px solid #ff5a00',
                  borderRadius: '12px',
                  padding: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, color: '#ff5a00', fontSize: '0.9rem' }}>
                    <span>⚡</span> Configurar Nuevo Código OTP
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGenerador(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    ✕ Cerrar
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  {/* SEDE ASIGNADA */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                      Campus / Sede Asignada *
                    </label>
                    <select
                      value={genSedeId}
                      onChange={(e) => setGenSedeId(e.target.value ? Number(e.target.value) : '')}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        fontSize: '0.825rem',
                        outline: 'none',
                      }}
                    >
                      <option value="">Cualquier Campus (Multisede)</option>
                      {sedesList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DURACIÓN */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                      Tiempo de Validez *
                    </label>
                    <select
                      value={genDuracion}
                      onChange={(e) => setGenDuracion(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        fontSize: '0.825rem',
                        outline: 'none',
                      }}
                    >
                      <option value={15}>15 minutos</option>
                      <option value={30}>30 minutos (Recomendado)</option>
                      <option value={60}>1 hora</option>
                      <option value={120}>2 horas</option>
                      <option value={1440}>24 horas</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  {/* NOMBRE SUGERIDO */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                      Nombre Sugerido de la Terminal (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="ej: PC Simulación Norte - Aula 102"
                      value={genNombreSugerido}
                      onChange={(e) => setGenNombreSugerido(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        fontSize: '0.825rem',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* NOTA O DESTINATARIO */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                      Nota / ¿Para quién es? (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="ej: Para Técnico Carlos en Sede Norte"
                      value={genNota}
                      onChange={(e) => setGenNota(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        fontSize: '0.825rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.3rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowGenerador(false)}
                    className={styles.secondaryActionBtn}
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={generando}
                    className={styles.actionBtn}
                    style={{ padding: '0.45rem 1.15rem', fontSize: '0.825rem' }}
                  >
                    {generando ? 'Generando código...' : '⚡ Generar Código OTP'}
                  </button>
                </div>
              </form>
            )}

            {/* TARJETA DESTACADA DEL ÚLTIMO CÓDIGO GENERADO */}
            {ultimoCodigoGenerado && (
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 90, 0, 0.12) 0%, rgba(255, 112, 30, 0.05) 100%)',
                  border: '1.5px solid #ff5a00',
                  borderRadius: '12px',
                  padding: '1.15rem 1.35rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#ff5a00', fontWeight: 800 }}>
                    <span>✅ CÓDIGO GENERADO LISTO PARA ENVIAR</span>
                    <span>•</span>
                    <span>Válido por {ultimoCodigoGenerado.tiempoRestanteMinutos ?? 30}m</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.85rem', marginTop: '0.35rem' }}>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', Consolas, monospace",
                        fontSize: '1.85rem',
                        fontWeight: 900,
                        color: '#ff5a00',
                        letterSpacing: '0.12em',
                      }}
                    >
                      {ultimoCodigoGenerado.codigo}
                    </div>

                    <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      📍 {ultimoCodigoGenerado.sedeNombre || 'Cualquier Campus'}
                      {ultimoCodigoGenerado.nombreSugerido && ` (${ultimoCodigoGenerado.nombreSugerido})`}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleCopiarWhatsApp(ultimoCodigoGenerado)}
                    className={styles.actionBtn}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      padding: '0.55rem 1rem',
                      fontSize: '0.825rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                    }}
                  >
                    <span>📋</span> Copiar para WhatsApp
                  </button>
                </div>
              </div>
            )}

            {/* TABLA / LISTADO DE CÓDIGOS REGISTRADOS */}
            <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
              {loadingCodigos ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  Cargando códigos de autorización...
                </div>
              ) : codigos.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '2.5rem 1rem',
                    background: 'var(--pill-bg)',
                    border: '1px dashed var(--border-color)',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>🔑</div>
                  <h4 style={{ color: 'var(--text-primary)', margin: '0 0 0.25rem 0', fontWeight: 700 }}>
                    No hay códigos OTP generados aún
                  </h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', margin: 0 }}>
                    Pulsa en <strong>"+ Generar Nuevo Código"</strong> cuando un técnico o coordinador necesite habilitar una terminal en otra sede.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {codigos.map((c) => {
                    const isActivo = c.estado === 'activo';
                    const isUsado = c.estado === 'usado';
                    const isExpirado = c.estado === 'expirado';
                    const isRevocado = c.estado === 'revocado';

                    return (
                      <div
                        key={c.id}
                        style={{
                          background: 'var(--bg-secondary, #0c1c38)',
                          border: isActivo ? '1px solid rgba(255, 90, 0, 0.4)' : '1px solid var(--border-color)',
                          borderRadius: '10px',
                          padding: '0.8rem 1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '1rem',
                          flexWrap: 'wrap',
                          opacity: isExpirado || isRevocado ? 0.65 : 1,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <div
                            style={{
                              fontFamily: "'JetBrains Mono', Consolas, monospace",
                              fontSize: '1.25rem',
                              fontWeight: 800,
                              color: isActivo ? '#ff5a00' : isUsado ? '#10b981' : 'var(--text-muted)',
                              background: 'var(--bg-card)',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              letterSpacing: '0.08em',
                            }}
                          >
                            {c.codigo}
                          </div>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                {c.nombreSugerido || 'Terminal Kiosco'}
                              </strong>

                              {/* INSIGNIA DE ESTADO */}
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  padding: '0.12rem 0.45rem',
                                  borderRadius: '9999px',
                                  background: isActivo
                                    ? 'rgba(16, 185, 129, 0.18)'
                                    : isUsado
                                    ? 'rgba(56, 189, 248, 0.18)'
                                    : 'rgba(148, 163, 184, 0.15)',
                                  color: isActivo
                                    ? '#10b981'
                                    : isUsado
                                    ? '#38bdf8'
                                    : 'var(--text-muted)',
                                  border: `1px solid ${
                                    isActivo
                                      ? 'rgba(16, 185, 129, 0.4)'
                                      : isUsado
                                      ? 'rgba(56, 189, 248, 0.4)'
                                      : 'var(--border-color)'
                                  }`,
                                }}
                              >
                                {isActivo && `● Activo (${c.tiempoRestanteMinutos}m)`}
                                {isUsado && `✓ Usado`}
                                {isExpirado && `⏱️ Expirado`}
                                {isRevocado && `✕ Cancelado`}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                              <span>📍 {c.sedeNombre || 'Multisede'}</span>
                              <span>•</span>
                              <span>Por: {c.creadorNombre || 'Admin'}</span>
                              {c.nota && (
                                <>
                                  <span>•</span>
                                  <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>"{c.nota}"</span>
                                </>
                              )}
                              {isUsado && c.terminalNombre && (
                                <>
                                  <span>•</span>
                                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>Vinculó a: {c.terminalNombre}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          {isActivo && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCopiarWhatsApp(c)}
                                className={styles.secondaryActionBtn}
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.35rem 0.65rem',
                                  color: '#10b981',
                                  borderColor: 'rgba(16, 185, 129, 0.35)',
                                }}
                                title="Copiar mensaje con instrucciones para WhatsApp"
                              >
                                📋 Copiar WhatsApp
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRevocarCodigo(c)}
                                className={styles.secondaryActionBtn}
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.35rem 0.65rem',
                                  color: '#ef4444',
                                  borderColor: 'rgba(239, 68, 68, 0.35)',
                                }}
                                title="Cancelar este código"
                              >
                                🚫 Revocar
                              </button>
                            </>
                          )}

                          {!isActivo && (
                            <button
                              type="button"
                              onClick={() => handleEliminarCodigo(c)}
                              className={styles.secondaryActionBtn}
                              style={{ fontSize: '0.75rem', padding: '0.35rem 0.55rem', color: 'var(--text-muted)' }}
                              title="Eliminar del historial"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PIE DEL MODAL */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.65rem', borderTop: '1px solid var(--border-color)' }}>
          <button type="button" onClick={onClose} className={styles.submitBtn} style={{ width: 'auto', padding: '0.55rem 1.4rem', fontSize: '0.85rem' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
