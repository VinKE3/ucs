'use client';

import React, { useState } from 'react';
import styles from '@/app/admin/admin.module.css';
import type {
  CastingRangoEdadItem,
  CastingEspecialidadItem,
  CastingRestriccionItem,
} from '@/types/admin';
import { confirmDelete, showError, showToast } from '@/lib/alerts';

interface ModalGestionCastingCatalogosProps {
  isOpen: boolean;
  rangosList: CastingRangoEdadItem[];
  especialidadesList: CastingEspecialidadItem[];
  restriccionesList: CastingRestriccionItem[];
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

type CatalogoTab = 'rangos' | 'especialidades' | 'restricciones';

const PRESET_COLORS = [
  '#38bdf8', // Sky
  '#34d399', // Emerald
  '#fbbf24', // Amber
  '#f87171', // Red/Coral
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#f97316', // Orange
  '#64748b', // Slate
];

const PRESET_ICONS_ESP = ['🧠', '🤰', '🚑', '💬', '🩺', '👶', '🧤', '🫀', '🔬', '🩹', '💉', '🧘', '🏥', '👁️', '💊'];
const PRESET_ICONS_REST = ['🚫', '⚠️', '🩹', '🧘', '💻', '📅', '🛑', '❗', '♿', '❌'];

export const ModalGestionCastingCatalogos: React.FC<ModalGestionCastingCatalogosProps> = ({
  isOpen,
  rangosList,
  especialidadesList,
  restriccionesList,
  loading: parentLoading,
  onClose,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<CatalogoTab>('rangos');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [formRango, setFormRango] = useState({
    nombre: '',
    descripcion: '',
    edadMin: '',
    edadMax: '',
    color: '#38bdf8',
    orden: 0,
    activo: true,
  });

  const [formEsp, setFormEsp] = useState({
    nombre: '',
    descripcion: '',
    icono: '🧠',
    color: '#a855f7',
    orden: 0,
    activo: true,
  });

  const [formRest, setFormRest] = useState({
    nombre: '',
    descripcion: '',
    nivel: 'moderada',
    icono: '⚠️',
    color: '#ef4444',
    orden: 0,
    activo: true,
  });

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingId(null);
    setIsCreating(true);
    setErrorMsg(null);
    if (activeTab === 'rangos') {
      setFormRango({
        nombre: '',
        descripcion: '',
        edadMin: '',
        edadMax: '',
        color: '#38bdf8',
        orden: (rangosList.length + 1) * 5,
        activo: true,
      });
    } else if (activeTab === 'especialidades') {
      setFormEsp({
        nombre: '',
        descripcion: '',
        icono: '🩺',
        color: '#06b6d4',
        orden: (especialidadesList.length + 1) * 5,
        activo: true,
      });
    } else {
      setFormRest({
        nombre: '',
        descripcion: '',
        nivel: 'moderada',
        icono: '⚠️',
        color: '#ef4444',
        orden: (restriccionesList.length + 1) * 5,
        activo: true,
      });
    }
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setEditingId(null);
    setErrorMsg(null);
  };

  const handleStartEditRango = (r: CastingRangoEdadItem) => {
    setIsCreating(false);
    setEditingId(r.id);
    setErrorMsg(null);
    setFormRango({
      nombre: r.nombre,
      descripcion: r.descripcion || '',
      edadMin: r.edadMin !== null && r.edadMin !== undefined ? String(r.edadMin) : '',
      edadMax: r.edadMax !== null && r.edadMax !== undefined ? String(r.edadMax) : '',
      color: r.color || '#38bdf8',
      orden: r.orden || 0,
      activo: r.activo,
    });
  };

  const handleStartEditEsp = (esp: CastingEspecialidadItem) => {
    setIsCreating(false);
    setEditingId(esp.id);
    setErrorMsg(null);
    setFormEsp({
      nombre: esp.nombre,
      descripcion: esp.descripcion || '',
      icono: esp.icono || '🧠',
      color: esp.color || '#a855f7',
      orden: esp.orden || 0,
      activo: esp.activo,
    });
  };

  const handleStartEditRest = (rest: CastingRestriccionItem) => {
    setIsCreating(false);
    setEditingId(rest.id);
    setErrorMsg(null);
    setFormRest({
      nombre: rest.nombre,
      descripcion: rest.descripcion || '',
      nivel: rest.nivel || 'moderada',
      icono: rest.icono || '⚠️',
      color: rest.color || '#ef4444',
      orden: rest.orden || 0,
      activo: rest.activo,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setActionLoading(true);

    try {
      let body: any = {};
      let tipo = '';

      if (activeTab === 'rangos') {
        tipo = 'rango';
        body = {
          tipo,
          id: editingId,
          nombre: formRango.nombre,
          descripcion: formRango.descripcion,
          edadMin: formRango.edadMin,
          edadMax: formRango.edadMax,
          color: formRango.color,
          orden: formRango.orden,
          activo: formRango.activo,
        };
      } else if (activeTab === 'especialidades') {
        tipo = 'especialidad';
        body = {
          tipo,
          id: editingId,
          nombre: formEsp.nombre,
          descripcion: formEsp.descripcion,
          icono: formEsp.icono,
          color: formEsp.color,
          orden: formEsp.orden,
          activo: formEsp.activo,
        };
      } else {
        tipo = 'restriccion';
        body = {
          tipo,
          id: editingId,
          nombre: formRest.nombre,
          descripcion: formRest.descripcion,
          nivel: formRest.nivel,
          icono: formRest.icono,
          color: formRest.color,
          orden: formRest.orden,
          activo: formRest.activo,
        };
      }

      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch('/api/casting/catalogos', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar la solicitud');
      }

      setIsCreating(false);
      setEditingId(null);
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActivo = async (tipo: CatalogoTab, id: number, activoActual: boolean) => {
    setActionLoading(true);
    try {
      const tipoApi = tipo === 'rangos' ? 'rango' : tipo === 'especialidades' ? 'especialidad' : 'restriccion';
      const res = await fetch('/api/casting/catalogos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tipoApi, id, activo: !activoActual }),
      });
      if (res.ok) onRefresh();
    } catch (err) {
      console.error('Error toggling activo:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (tipo: CatalogoTab, id: number, nombre: string) => {
    const labelTipo = tipo === 'rangos' ? 'el rango de edad' : tipo === 'especialidades' ? 'la especialidad' : 'la restricción';
    const confirmed = await confirmDelete(
      `${labelTipo} "${nombre}"`,
      'Esta acción no se puede deshacer.'
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const tipoApi = tipo === 'rangos' ? 'rango' : tipo === 'especialidades' ? 'especialidad' : 'restriccion';
      const res = await fetch(`/api/casting/catalogos?tipo=${tipoApi}&id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        showError('No se pudo eliminar', data.error);
        return;
      }
      showToast('Elemento eliminado del catálogo', 'success');
      onRefresh();
    } catch (err) {
      showError('Error de conexión al eliminar');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      className={styles.modalBackdrop}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        zIndex: 1200,
      }}
      onClick={onClose}
    >
      <div
        className={styles.modal}
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1.5px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className={styles.modalHeader} style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h2 className={styles.modalTitle}>🎭 Catálogos Maestros de Casting</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Administra los rangos etarios, especialidades clínicas y restricciones de los Pacientes Simulados.
            </p>
          </div>
          <button type="button" onClick={onClose} className={styles.closeBtn} disabled={actionLoading} style={{ cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* TABS SELECTOR */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', padding: '0.75rem 1.5rem', background: 'var(--bg-elevated)' }}>
          <button
            type="button"
            onClick={() => { setActiveTab('rangos'); handleCancelForm(); }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'rangos' ? '#38bdf8' : 'transparent',
              color: activeTab === 'rangos' ? '#0f172a' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s',
            }}
          >
            <span>🎂</span> Rangos de Edad ({rangosList.length})
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('especialidades'); handleCancelForm(); }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'especialidades' ? '#c084fc' : 'transparent',
              color: activeTab === 'especialidades' ? '#0f172a' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s',
            }}
          >
            <span>🩺</span> Especialidades ({especialidadesList.length})
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('restricciones'); handleCancelForm(); }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'restricciones' ? '#ef4444' : 'transparent',
              color: activeTab === 'restricciones' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.2s',
            }}
          >
            <span>⚠️</span> Restricciones ({restriccionesList.length})
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL SCROLLEABLE */}
        <div style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', flex: 1 }}>
          {errorMsg && (
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.65rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.84rem' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* FORMULARIO DE CREACIÓN / EDICIÓN */}
          {(isCreating || editingId !== null) && (
            <form onSubmit={handleSubmit} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {editingId ? '✏️ Editar Elemento' : '✨ Nuevo Elemento'} — {activeTab === 'rangos' ? 'Rango de Edad' : activeTab === 'especialidades' ? 'Especialidad Clínica' : 'Restricción'}
                </h3>
                <button type="button" onClick={handleCancelForm} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem' }}>
                  Cancelar
                </button>
              </div>

              {/* CAMPOS PARA RANGOS DE EDAD */}
              {activeTab === 'rangos' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className={styles.label}>Nombre del Rango (ej: 26 - 40 años (Adulto Joven))</label>
                    <input
                      type="text"
                      required
                      value={formRango.nombre}
                      onChange={(e) => setFormRango({ ...formRango, nombre: e.target.value })}
                      className={styles.inputField}
                    />
                  </div>

                  <div>
                    <label className={styles.label}>Edad Mínima (Años)</label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      placeholder="ej: 26"
                      value={formRango.edadMin}
                      onChange={(e) => setFormRango({ ...formRango, edadMin: e.target.value })}
                      className={styles.inputField}
                    />
                  </div>

                  <div>
                    <label className={styles.label}>Edad Máxima (Años)</label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      placeholder="ej: 40"
                      value={formRango.edadMax}
                      onChange={(e) => setFormRango({ ...formRango, edadMax: e.target.value })}
                      className={styles.inputField}
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className={styles.label}>Descripción o Guía para Casting</label>
                    <input
                      type="text"
                      placeholder="ej: Adulto en edad laboral o paternidad temprana..."
                      value={formRango.descripcion}
                      onChange={(e) => setFormRango({ ...formRango, descripcion: e.target.value })}
                      className={styles.inputField}
                    />
                  </div>

                  <div>
                    <label className={styles.label}>Color de Distintivo</label>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setFormRango({ ...formRango, color: c })}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: c,
                            border: formRango.color === c ? '2px solid #ffffff' : 'none',
                            cursor: 'pointer',
                            outline: formRango.color === c ? '2px solid #38bdf8' : 'none',
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={styles.label}>Vista Previa</label>
                    <div style={{ marginTop: '0.35rem' }}>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          padding: '0.3rem 0.65rem',
                          borderRadius: '6px',
                          color: formRango.color,
                          background: `${formRango.color}22`,
                          border: `1px solid ${formRango.color}44`,
                        }}
                      >
                        🎂 {formRango.nombre || 'Nombre del rango'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* CAMPOS PARA ESPECIALIDADES */}
              {activeTab === 'especialidades' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className={styles.label}>Nombre de Especialidad / Caso (ej: Salud Mental / Psiquiatría)</label>
                    <input
                      type="text"
                      required
                      value={formEsp.nombre}
                      onChange={(e) => setFormEsp({ ...formEsp, nombre: e.target.value })}
                      className={styles.inputField}
                    />
                  </div>

                  <div>
                    <label className={styles.label}>Icono Representativo</label>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                      {PRESET_ICONS_ESP.map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setFormEsp({ ...formEsp, icono: ic })}
                          style={{
                            fontSize: '1.1rem',
                            padding: '0.2rem 0.4rem',
                            borderRadius: '6px',
                            background: formEsp.icono === ic ? 'var(--ucs-blue-sky)' : 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                          }}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={styles.label}>Color</label>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setFormEsp({ ...formEsp, color: c })}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: c,
                            border: formEsp.color === c ? '2px solid #ffffff' : 'none',
                            cursor: 'pointer',
                            outline: formEsp.color === c ? '2px solid #38bdf8' : 'none',
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className={styles.label}>Descripción de los Casos</label>
                    <input
                      type="text"
                      placeholder="ej: Ansiedad, psicosis, agitación psicomotriz o ideación suicida..."
                      value={formEsp.descripcion}
                      onChange={(e) => setFormEsp({ ...formEsp, descripcion: e.target.value })}
                      className={styles.inputField}
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className={styles.label}>Vista Previa</label>
                    <div style={{ marginTop: '0.35rem' }}>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          padding: '0.3rem 0.65rem',
                          borderRadius: '6px',
                          color: formEsp.color,
                          background: `${formEsp.color}22`,
                          border: `1px solid ${formEsp.color}44`,
                        }}
                      >
                        {formEsp.icono} {formEsp.nombre || 'Especialidad'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* CAMPOS PARA RESTRICCIONES */}
              {activeTab === 'restricciones' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className={styles.label}>Nombre de Restricción (ej: No contacto físico invasivo)</label>
                    <input
                      type="text"
                      required
                      value={formRest.nombre}
                      onChange={(e) => setFormRest({ ...formRest, nombre: e.target.value })}
                      className={styles.inputField}
                    />
                  </div>

                  <div>
                    <label className={styles.label}>Nivel de Riesgo</label>
                    <select
                      value={formRest.nivel}
                      onChange={(e) => {
                        const nivel = e.target.value;
                        const color = nivel === 'critica' ? '#ef4444' : nivel === 'moderada' ? '#f97316' : '#38bdf8';
                        setFormRest({ ...formRest, nivel, color });
                      }}
                      className={styles.select}
                    >
                      <option value="critica">🔴 Crítica (Contraindicación absoluta)</option>
                      <option value="moderada">🟠 Moderada (Precaución / Tiempo límite)</option>
                      <option value="leve">🔵 Leve (Preferencia de modalidad / horario)</option>
                    </select>
                  </div>

                  <div>
                    <label className={styles.label}>Icono</label>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                      {PRESET_ICONS_REST.map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setFormRest({ ...formRest, icono: ic })}
                          style={{
                            fontSize: '1.1rem',
                            padding: '0.2rem 0.4rem',
                            borderRadius: '6px',
                            background: formRest.icono === ic ? 'var(--ucs-blue-sky)' : 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                          }}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className={styles.label}>Detalle Médico / Motivo</label>
                    <input
                      type="text"
                      placeholder="ej: Contraindicado palpación profunda o maniobras de compresión..."
                      value={formRest.descripcion}
                      onChange={(e) => setFormRest({ ...formRest, descripcion: e.target.value })}
                      className={styles.inputField}
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className={styles.label}>Vista Previa</label>
                    <div style={{ marginTop: '0.35rem' }}>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          padding: '0.3rem 0.65rem',
                          borderRadius: '6px',
                          color: formRest.color,
                          background: `${formRest.color}22`,
                          border: `1px solid ${formRest.color}44`,
                        }}
                      >
                        {formRest.icono} {formRest.nombre || 'Restricción'} ({formRest.nivel})
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.25rem' }}>
                <button type="button" onClick={handleCancelForm} className={styles.secondaryBtn} disabled={actionLoading}>
                  Cancelar
                </button>
                <button type="submit" className={styles.actionBtn} disabled={actionLoading}>
                  {actionLoading ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Elemento'}
                </button>
              </div>
            </form>
          )}

          {/* LISTA Y TABLA SEGÚN TAB ACTIVA */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Elementos registrados en el sistema:
            </span>
            {!isCreating && editingId === null && (
              <button onClick={handleStartCreate} className={styles.actionBtnSmall} style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 700 }}>
                + Agregar {activeTab === 'rangos' ? 'Rango' : activeTab === 'especialidades' ? 'Especialidad' : 'Restricción'}
              </button>
            )}
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '45px' }}>#</th>
                  <th>Elemento</th>
                  {activeTab === 'rangos' && <th>Edades</th>}
                  {activeTab === 'restricciones' && <th>Nivel</th>}
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th style={{ width: '130px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {activeTab === 'rangos' &&
                  rangosList.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {r.id}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            color: r.color,
                            background: `${r.color}22`,
                            border: `1px solid ${r.color}44`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          🎂 {r.nombre}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                        {r.edadMin || r.edadMax ? `${r.edadMin ?? 0} - ${r.edadMax ?? 100} años` : 'Cualquiera'}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {r.descripcion || '—'}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', color: r.activo ? '#34d399' : '#94a3b8', fontWeight: 600 }}>
                          {r.activo ? '🟢 Activo' : '⚪ Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionRow}>
                          <button onClick={() => handleStartEditRango(r)} className={styles.iconBtn} title="Editar">
                            ✏️
                          </button>
                          <button
                            onClick={() => handleToggleActivo('rangos', r.id, r.activo)}
                            className={styles.iconBtn}
                            title={r.activo ? 'Desactivar' : 'Activar'}
                          >
                            {r.activo ? '⏸️' : '▶️'}
                          </button>
                          <button
                            onClick={() => handleDelete('rangos', r.id, r.nombre)}
                            className={styles.iconBtn}
                            style={{ color: '#ef4444' }}
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                {activeTab === 'especialidades' &&
                  especialidadesList.map((esp) => (
                    <tr key={esp.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {esp.id}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            color: esp.color,
                            background: `${esp.color}22`,
                            border: `1px solid ${esp.color}44`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <span>{esp.icono}</span> {esp.nombre}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {esp.descripcion || '—'}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', color: esp.activo ? '#34d399' : '#94a3b8', fontWeight: 600 }}>
                          {esp.activo ? '🟢 Activo' : '⚪ Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionRow}>
                          <button onClick={() => handleStartEditEsp(esp)} className={styles.iconBtn} title="Editar">
                            ✏️
                          </button>
                          <button
                            onClick={() => handleToggleActivo('especialidades', esp.id, esp.activo)}
                            className={styles.iconBtn}
                            title={esp.activo ? 'Desactivar' : 'Activar'}
                          >
                            {esp.activo ? '⏸️' : '▶️'}
                          </button>
                          <button
                            onClick={() => handleDelete('especialidades', esp.id, esp.nombre)}
                            className={styles.iconBtn}
                            style={{ color: '#ef4444' }}
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                {activeTab === 'restricciones' &&
                  restriccionesList.map((rest) => (
                    <tr key={rest.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {rest.id}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            color: rest.color,
                            background: `${rest.color}22`,
                            border: `1px solid ${rest.color}44`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <span>{rest.icono}</span> {rest.nombre}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            color: rest.nivel === 'critica' ? '#ef4444' : rest.nivel === 'moderada' ? '#f97316' : '#38bdf8',
                            background: rest.nivel === 'critica' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                          }}
                        >
                          {rest.nivel}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {rest.descripcion || '—'}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', color: rest.activo ? '#34d399' : '#94a3b8', fontWeight: 600 }}>
                          {rest.activo ? '🟢 Activo' : '⚪ Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionRow}>
                          <button onClick={() => handleStartEditRest(rest)} className={styles.iconBtn} title="Editar">
                            ✏️
                          </button>
                          <button
                            onClick={() => handleToggleActivo('restricciones', rest.id, rest.activo)}
                            className={styles.iconBtn}
                            title={rest.activo ? 'Desactivar' : 'Activar'}
                          >
                            {rest.activo ? '⏸️' : '▶️'}
                          </button>
                          <button
                            onClick={() => handleDelete('restricciones', rest.id, rest.nombre)}
                            className={styles.iconBtn}
                            style={{ color: '#ef4444' }}
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER */}
        <div className={styles.modalFooter}>
          <button type="button" onClick={onClose} className={styles.secondaryBtn}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
