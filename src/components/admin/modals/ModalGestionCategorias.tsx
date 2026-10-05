'use client';

import React, { useState } from 'react';
import styles from '@/app/admin/admin.module.css';
import type { CategoriaAmbienteItem } from '@/types/admin';

interface ModalGestionCategoriasProps {
  isOpen: boolean;
  categoriasList: CategoriaAmbienteItem[];
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const PRESET_COLORS = [
  '#0284c7', // Sky blue
  '#9333ea', // Purple
  '#059669', // Emerald
  '#d97706', // Amber
  '#db2777', // Pink
  '#dc2626', // Red
  '#ea580c', // Orange
  '#4f46e5', // Indigo
  '#0d9488', // Teal
  '#475569', // Slate
];

const PRESET_ICONS = ['🫀', '🧤', '🩺', '🛏️', '💡', '🔬', '🫁', '👶', '🧠', '🦷', '🚑', '🏥', '💉', '🩹', '🏢'];

export const ModalGestionCategorias: React.FC<ModalGestionCategoriasProps> = ({
  isOpen,
  categoriasList,
  loading: parentLoading,
  onClose,
  onRefresh,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    descripcion: '',
    color: '#0284c7',
    icono: '🫀',
    orden: 10,
  });

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingId(null);
    setIsCreating(true);
    setErrorMsg(null);
    setFormData({
      nombre: '',
      codigo: '',
      descripcion: '',
      color: '#0284c7',
      icono: '🫀',
      orden: (categoriasList.length + 1) * 5,
    });
  };

  const handleStartEdit = (cat: CategoriaAmbienteItem) => {
    setIsCreating(false);
    setEditingId(cat.id);
    setErrorMsg(null);
    setFormData({
      nombre: cat.nombre,
      codigo: cat.codigo,
      descripcion: cat.descripcion || '',
      color: cat.color || '#0284c7',
      icono: cat.icono || '🏥',
      orden: cat.orden || 0,
    });
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setEditingId(null);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (editingId) {
        // Actualizar existente
        const res = await fetch('/api/categorias-ambiente', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            ...formData,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar categoría');
      } else {
        // Crear nueva
        const res = await fetch('/api/categorias-ambiente', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al crear categoría');
      }

      handleCancelForm();
      onRefresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al procesar la categoría');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActivo = async (cat: CategoriaAmbienteItem) => {
    const accion = cat.activo ? 'desactivar' : 'activar';
    const confirmMsg = cat.activo
      ? `¿Deseas desactivar la categoría "${cat.nombre}"?\n\nAl desactivarla, dejará de aparecer en los filtros del Kiosco y no se podrá seleccionar para crear nuevas salas. Las salas existentes la conservarán.`
      : `¿Deseas activar la categoría "${cat.nombre}"?\n\nVolverá a estar disponible en el Kiosco y en la creación de salas.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/categorias-ambiente', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cat.id,
          activo: !cat.activo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error al ${accion} la categoría`);
      onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : `Error al ${accion} la categoría`);
    }
  };

  const handleDelete = async (cat: CategoriaAmbienteItem) => {
    if (cat.totalAmbientes && cat.totalAmbientes > 0) {
      alert(
        `⚠️ No se puede eliminar la categoría "${cat.nombre}" porque actualmente tiene ${cat.totalAmbientes} sala(s) asignada(s).\n\nEn su lugar, puedes DESACTIVARLA usando el botón de pausa (⏸️) para que no aparezca en el Kiosco.`
      );
      return;
    }

    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la categoría "${cat.nombre}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/categorias-ambiente?id=${cat.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar la categoría');
      onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al eliminar la categoría');
    }
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal} style={{ maxWidth: '780px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* HEADER */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>🏷️ Categorías de Salas de Simulación</h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Gestiona los tipos de simulación, sus colores distintivos y su visibilidad en el Kiosco.
            </p>
          </div>
          <button onClick={onClose} className={styles.closeBtn}>
            ✕
          </button>
        </div>

        {/* ERROR BANNER */}
        {errorMsg && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: 'rgba(239,68,68,0.15)',
              color: '#fca5a5',
              border: '1px solid rgba(239,68,68,0.3)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {errorMsg}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem' }}>
          {/* BOTÓN NUEVA CATEGORÍA O FORMULARIO */}
          {!isCreating && editingId === null ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
                paddingBottom: '0.85rem',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {categoriasList.length} Categorías registradas ({categoriasList.filter((c) => c.activo).length} activas)
              </span>
              <button
                type="button"
                onClick={handleStartCreate}
                className={styles.actionBtn}
                style={{ padding: '0.45rem 1rem', fontSize: '0.825rem' }}
              >
                <span>+</span> Nueva Categoría
              </button>
            </div>
          ) : (
            /* FORMULARIO DE CREACIÓN O EDICIÓN */
            <form
              onSubmit={handleSubmit}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '1.25rem',
                marginBottom: '1.5rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {editingId ? '✏️ Editar Categoría' : '✨ Crear Nueva Categoría'}
                </h3>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  ✕ Cancelar
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Nombre de la Categoría *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="ej: Cirugía Laparoscópica, Neonatología"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className={styles.inputField}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Código Identificador (Slug)</label>
                  <input
                    type="text"
                    placeholder="ej: cirugia_lap, neonato (autogenerado si vacío)"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    className={styles.inputField}
                  />
                </div>
              </div>

              <div className={styles.fieldGroup} style={{ marginTop: '0.75rem' }}>
                <label className={styles.label}>Descripción Breve</label>
                <input
                  type="text"
                  placeholder="Propósito clínico de este tipo de ambientes"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className={styles.inputField}
                />
              </div>

              {/* SELECTORES DE COLOR E ICONO */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div>
                  <label className={styles.label} style={{ marginBottom: '0.4rem', display: 'block' }}>
                    Color Distintivo del Badge
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {PRESET_COLORS.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: col })}
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          backgroundColor: col,
                          border: formData.color === col ? '2px solid #ffffff' : '2px solid transparent',
                          cursor: 'pointer',
                          transform: formData.color === col ? 'scale(1.15)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      />
                    ))}
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      style={{
                        width: '32px',
                        height: '28px',
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                      }}
                      title="Elegir color personalizado"
                    />
                  </div>
                </div>

                <div>
                  <label className={styles.label} style={{ marginBottom: '0.4rem', display: 'block' }}>
                    Icono / Emoji
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {PRESET_ICONS.map((ico) => (
                      <button
                        key={ico}
                        type="button"
                        onClick={() => setFormData({ ...formData, icono: ico })}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: formData.icono === ico ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
                          border: formData.icono === ico ? '1px solid #38bdf8' : '1px solid transparent',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {ico}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* VISTA PREVIA DEL BADGE */}
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vista previa:</span>
                <span
                  style={{
                    backgroundColor: `${formData.color}22`,
                    color: formData.color,
                    border: `1px solid ${formData.color}55`,
                    padding: '0.25rem 0.65rem',
                    borderRadius: '9999px',
                    fontSize: '0.825rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>{formData.icono}</span>
                  <span>{formData.nombre || 'Nombre de la Categoría'}</span>
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" onClick={handleCancelForm} className={styles.cancelBtn}>
                  Cancelar
                </button>
                <button type="submit" className={styles.actionBtn} disabled={loading}>
                  {loading ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Categoría'}
                </button>
              </div>
            </form>
          )}

          {/* TABLA / LISTADO DE CATEGORÍAS */}
          <div className={styles.tableWrapper} style={{ border: '1px solid var(--border-color)', borderRadius: '10px' }}>
            <table className={styles.table} style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Código</th>
                  <th style={{ textAlign: 'center' }}>Salas</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {categoriasList.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No hay categorías registradas.
                    </td>
                  </tr>
                ) : (
                  categoriasList.map((cat) => (
                    <tr key={cat.id} style={!cat.activo ? { opacity: 0.6 } : undefined}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              backgroundColor: `${cat.color || '#38bdf8'}22`,
                              color: cat.color || '#38bdf8',
                              border: `1px solid ${cat.color || '#38bdf8'}55`,
                              padding: '0.2rem 0.6rem',
                              borderRadius: '9999px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <span>{cat.icono || '🏥'}</span>
                            <span>{cat.nombre}</span>
                          </span>
                        </div>
                        {cat.descripcion && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem', maxWidth: '280px' }}>
                            {cat.descripcion}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '0.2rem 0.45rem',
                            borderRadius: '4px',
                          }}
                        >
                          {cat.codigo}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.825rem',
                            color: (cat.totalAmbientes || 0) > 0 ? '#38bdf8' : 'var(--text-muted)',
                          }}
                        >
                          {cat.totalAmbientes || 0}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {cat.activo ? (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#10b981',
                              background: 'rgba(16, 185, 129, 0.12)',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '9999px',
                            }}
                          >
                            ● Activa
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#94a3b8',
                              background: 'rgba(148, 163, 184, 0.12)',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '9999px',
                            }}
                          >
                            ○ Inactiva
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(cat)}
                            className={styles.iconBtn}
                            title="Editar nombre, color o icono"
                          >
                            <span>✏️</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleActivo(cat)}
                            className={styles.iconBtn}
                            style={!cat.activo ? { color: '#10b981', borderColor: '#10b981' } : undefined}
                            title={cat.activo ? 'Desactivar de Kiosco y creación de salas' : 'Activar categoría'}
                          >
                            <span>{cat.activo ? '⏸️' : '▶️'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(cat)}
                            className={styles.iconBtn}
                            style={{ color: '#ef4444' }}
                            title={
                              (cat.totalAmbientes || 0) > 0
                                ? 'No se puede eliminar porque tiene salas asociadas'
                                : 'Eliminar permanentemente esta categoría'
                            }
                          >
                            <span>🗑️</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className={styles.modalFooter} style={{ marginTop: '1rem', paddingTop: '0.75rem' }}>
          <button type="button" onClick={onClose} className={styles.actionBtn}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
