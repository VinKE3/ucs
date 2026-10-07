'use client';

import React, { useState, useEffect } from 'react';
import styles from '@/app/admin/admin.module.css';
import type {
  UsuarioItem,
  CastingRangoEdadItem,
  CastingEspecialidadItem,
  CastingRestriccionItem,
} from '@/types/admin';

interface ModalFichaCastingProps {
  isOpen: boolean;
  actor: UsuarioItem | null;
  rangosList: CastingRangoEdadItem[];
  especialidadesList: CastingEspecialidadItem[];
  restriccionesList: CastingRestriccionItem[];
  onClose: () => void;
  onSaved: () => void;
}

export const ModalFichaCasting: React.FC<ModalFichaCastingProps> = ({
  isOpen,
  actor,
  rangosList,
  especialidadesList,
  restriccionesList,
  onClose,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'formulario' | 'imprimir'>('formulario');

  // Form State
  const [rangoEdadId, setRangoEdadId] = useState<number | ''>('');
  const [edadReal, setEdadReal] = useState<string>('');
  const [genero, setGenero] = useState<string>('Femenino');
  const [biotipo, setBiotipo] = useState<string>('Medio');
  const [especialidadesIds, setEspecialidadesIds] = useState<number[]>([]);
  const [restriccionesIds, setRestriccionesIds] = useState<number[]>([]);
  const [experienciaNotas, setExperienciaNotas] = useState<string>('');
  const [disponibilidad, setDisponibilidad] = useState<string>('');
  const [contactoEmergencia, setContactoEmergencia] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !actor) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    // Si el actor ya trae su castingPerfil precargado, inicializar
    if (actor.castingPerfil) {
      const p = actor.castingPerfil;
      setRangoEdadId(p.rangoEdadId || '');
      setEdadReal(p.edadReal !== null && p.edadReal !== undefined ? String(p.edadReal) : '');
      setGenero(p.genero || 'Femenino');
      setBiotipo(p.biotipo || 'Medio');
      setEspecialidadesIds(p.especialidadesIds || []);
      setRestriccionesIds(p.restriccionesIds || []);
      setExperienciaNotas(p.experienciaNotas || '');
      setDisponibilidad(p.disponibilidad || '');
      setContactoEmergencia(p.contactoEmergencia || '');
    } else {
      // Intentar cargar por API
      setLoading(true);
      fetch(`/api/casting/perfiles?usuarioId=${actor.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.perfil) {
            const p = data.perfil;
            setRangoEdadId(p.rangoEdadId || '');
            setEdadReal(p.edadReal !== null && p.edadReal !== undefined ? String(p.edadReal) : '');
            setGenero(p.genero || 'Femenino');
            setBiotipo(p.biotipo || 'Medio');
            setEspecialidadesIds(p.especialidadesIds || []);
            setRestriccionesIds(p.restriccionesIds || []);
            setExperienciaNotas(p.experienciaNotas || '');
            setDisponibilidad(p.disponibilidad || '');
            setContactoEmergencia(p.contactoEmergencia || '');
          } else {
            // Vacío
            setRangoEdadId('');
            setEdadReal('');
            setGenero('Femenino');
            setBiotipo('Medio');
            setEspecialidadesIds([]);
            setRestriccionesIds([]);
            setExperienciaNotas('');
            setDisponibilidad('');
            setContactoEmergencia('');
          }
        })
        .catch((err) => console.error('Error fetching perfil:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, actor]);

  if (!isOpen || !actor) return null;

  const toggleEspecialidad = (id: number) => {
    setEspecialidadesIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleRestriccion = (id: number) => {
    setRestriccionesIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSaveLoading(true);

    try {
      const res = await fetch('/api/casting/perfiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: actor.id,
          rangoEdadId: rangoEdadId !== '' ? Number(rangoEdadId) : null,
          edadReal: edadReal !== '' ? Number(edadReal) : null,
          genero,
          biotipo,
          especialidadesIds,
          restriccionesIds,
          experienciaNotas,
          disponibilidad,
          contactoEmergencia,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar perfil de casting');

      setSuccessMsg('✅ Ficha de Casting guardada exitosamente.');
      setTimeout(() => {
        onSaved();
      }, 700);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaveLoading(false);
    }
  };

  const rangoSeleccionado = rangosList.find((r) => r.id === Number(rangoEdadId));

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
          maxWidth: '860px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                boxShadow: '0 4px 12px rgba(168, 85, 247, 0.35)',
              }}
            >
              🎭
            </div>
            <div>
              <h2 className={styles.modalTitle} style={{ fontSize: '1.15rem' }}>
                Ficha de Casting: {actor.nombres} {actor.apellidos}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.2rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>DNI: <strong>{actor.dni}</strong></span>
                {actor.horasSemanalesMax && (
                  <>
                    <span>•</span>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>Tope: {actor.horasSemanalesMax}h/sem</span>
                  </>
                )}
                {actor.tarifaHora && (
                  <>
                    <span>•</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>(Control Interno Tarifa: S/. {Number(actor.tarifaHora).toFixed(2)}/h)</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className={styles.closeBtn} disabled={saveLoading} style={{ cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {/* SELECTOR DE MODO: EDICIÓN VS FICHA IMPRIMIBLE */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.55rem 1.5rem',
            borderBottom: '1px solid var(--border-color)',
            background: 'var(--bg-elevated)',
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('formulario')}
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '6px',
              border: 'none',
              background: viewMode === 'formulario' ? '#a855f7' : 'transparent',
              color: viewMode === 'formulario' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease',
            }}
          >
            <span>✏️</span> Editor de Ficha
          </button>
          <button
            type="button"
            onClick={() => setViewMode('imprimir')}
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '6px',
              border: 'none',
              background: viewMode === 'imprimir' ? '#a855f7' : 'transparent',
              color: viewMode === 'imprimir' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease',
            }}
          >
            <span>📄</span> Ficha Técnica de Estación (Imprimir)
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL SCROLLEABLE */}
        <div style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', flex: 1 }}>
          {errorMsg && (
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.65rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.84rem' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', color: '#10b981', padding: '0.65rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.84rem' }}>
              {successMsg}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Cargando ficha de casting...
            </div>
          ) : viewMode === 'imprimir' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* BARRA SUPERIOR DE ACCIÓN PARA IMPRESIÓN */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  📋 Vista lista para la carpeta de estación del docente evaluador o archivo del centro de simulación.
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={styles.actionBtn}
                  style={{
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                    padding: '0.45rem 1rem',
                    fontSize: '0.84rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>🖨️</span> Imprimir Ficha de Estación (PDF)
                </button>
              </div>

              {/* DOCUMENTO FORMAL IMPRIMIBLE */}
              <div
                id="ficha-estacion-print"
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  borderRadius: '8px',
                  padding: '2rem',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {/* Membrete Oficial */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '2px solid #0f172a',
                    paddingBottom: '0.85rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <img
                      src="/logo.png"
                      alt="Universidad Científica del Sur"
                      style={{ height: '36px', width: 'auto', display: 'block' }}
                    />
                    <div style={{ borderLeft: '1.5px solid #cbd5e1', paddingLeft: '0.75rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.5px', color: '#0d346c', textTransform: 'uppercase' }}>
                        Centro de Simulación Clínica
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                        Facultad de Ciencias de la Salud
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        background: '#0d346c',
                        color: '#ffffff',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Ficha de Estación ECOE
                    </span>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
                      Actualizada: {new Date().toLocaleDateString('es-PE')}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#06152d' }}>
                    FICHA TÉCNICA DE PACIENTE SIMULADO (ACTOR)
                  </h2>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.15rem' }}>
                    Validación de Competencias Clínicas & Contraindicaciones de Seguridad
                  </div>
                </div>

                {/* Cuadrícula de Datos Personales */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '0.75rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '1rem',
                    marginBottom: '1.25rem',
                    fontSize: '0.82rem',
                  }}
                >
                  <div>
                    <strong style={{ color: '#64748b' }}>Paciente Simulado:</strong>{' '}
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>
                      {actor.apellidos}, {actor.nombres}
                    </span>
                  </div>
                  <div>
                    <strong style={{ color: '#64748b' }}>DNI / Documento:</strong>{' '}
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{actor.dni}</span>
                  </div>
                  <div>
                    <strong style={{ color: '#64748b' }}>Edad Cronológica / Rango:</strong>{' '}
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>
                      {edadReal ? `${edadReal} años` : 'No especificada'}
                      {rangoSeleccionado ? ` (${rangoSeleccionado.nombre})` : ''}
                    </span>
                  </div>
                  <div>
                    <strong style={{ color: '#64748b' }}>Género / Biotipo Físico:</strong>{' '}
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>
                      {genero} • Biotipo {biotipo}
                    </span>
                  </div>
                  <div>
                    <strong style={{ color: '#64748b' }}>Contacto Telefónico:</strong>{' '}
                    <span style={{ color: '#0f172a' }}>{actor.telefono || 'No registrado'}</span>
                  </div>
                  <div>
                    <strong style={{ color: '#64748b' }}>Contacto de Emergencia:</strong>{' '}
                    <span style={{ color: '#0f172a' }}>{contactoEmergencia || 'No registrado'}</span>
                  </div>
                </div>

                {/* Casos y Especialidades Acreditadas */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0d346c', marginBottom: '0.45rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem' }}>
                    🩺 Especialidades y Escenarios Clínicos Acreditados
                  </div>
                  {especialidadesIds.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {especialidadesIds.map((id) => {
                        const esp = especialidadesList.find((e) => e.id === id);
                        return (
                          <span
                            key={id}
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              color: '#1e293b',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              padding: '0.25rem 0.55rem',
                              borderRadius: '4px',
                            }}
                          >
                            {esp ? `${esp.icono || '🩺'} ${esp.nombre}` : `Especialidad #${id}`}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                      No tiene especialidades específicas asignadas aún.
                    </div>
                  )}
                </div>

                {/* RECUADRO DE SEGURIDAD: RESTRICCIONES Y CONTRAINDICACIONES */}
                <div
                  style={{
                    border: '2px solid #ef4444',
                    background: '#fef2f2',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                    <strong style={{ color: '#b91c1c', fontSize: '0.86rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      ADVERTENCIA DE SEGURIDAD PARA DOCENTES EVALUADORES
                    </strong>
                  </div>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: '#7f1d1d' }}>
                    Por salvaguarda física, emocional y ética del paciente simulado, quedan estrictamente contraindicadas o restringidas las siguientes maniobras durante la estación:
                  </p>
                  {restriccionesIds.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {restriccionesIds.map((id) => {
                        const rest = restriccionesList.find((r) => r.id === id);
                        return (
                          <span
                            key={id}
                            style={{
                              background: '#fee2e2',
                              border: '1px solid #f87171',
                              color: '#991b1b',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              padding: '0.25rem 0.6rem',
                              borderRadius: '4px',
                            }}
                          >
                            {rest ? `${rest.icono || '🚫'} ${rest.nombre} (${rest.nivel})` : `Restricción #${id}`}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 600 }}>
                      ✅ Sin contraindicaciones ni restricciones médicas especiales reportadas para este actor.
                    </div>
                  )}
                </div>

                {/* Experiencia y Notas de Actuación */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0d346c', marginBottom: '0.35rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem' }}>
                    🎭 Impronta Teatral y Habilidades Escénicas
                  </div>
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      fontSize: '0.8rem',
                      color: '#334155',
                      lineHeight: 1.45,
                    }}
                  >
                    {experienciaNotas || 'Sin notas adicionales de improvisación o caracterización registradas.'}
                  </div>
                </div>

                {/* Disponibilidad */}
                {disponibilidad && (
                  <div style={{ marginBottom: '1.25rem', fontSize: '0.8rem', color: '#475569' }}>
                    <strong style={{ color: '#0d346c' }}>📅 Disponibilidad Declarada:</strong> {disponibilidad}
                  </div>
                )}

                {/* Firmas de Validación */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '2.5rem',
                    marginTop: '2.5rem',
                    paddingTop: '1.5rem',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #475569', paddingTop: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                      {actor.nombres} {actor.apellidos}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Paciente Simulado (Conformidad) • DNI: {actor.dni}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #475569', paddingTop: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                      Coordinación de Simulación Clínica
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Facultad de Ciencias de la Salud • UCS
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* SECCIÓN 1: BIOTIPO Y EDADES */}
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.15rem' }}>
                <h3 style={{ margin: '0 0 0.85rem', fontSize: '0.92rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span>🎂</span> Perfil Etario y Biotipo de Actuación
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
                  <div>
                    <label className={styles.label}>Rango de Edad Aparente</label>
                    <select
                      value={rangoEdadId}
                      onChange={(e) => setRangoEdadId(e.target.value === '' ? '' : Number(e.target.value))}
                      className={styles.select}
                    >
                      <option value="">-- Sin Rango Asignado --</option>
                      {rangosList
                        .filter((r) => r.activo || r.id === Number(rangoEdadId))
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            🎂 {r.nombre}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className={styles.label}>Edad Cronológica Real (Opcional)</label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      placeholder="ej: 28"
                      value={edadReal}
                      onChange={(e) => setEdadReal(e.target.value)}
                      className={styles.inputField}
                    />
                  </div>

                  <div>
                    <label className={styles.label}>Género de Representación</label>
                    <select
                      value={genero}
                      onChange={(e) => setGenero(e.target.value)}
                      className={styles.select}
                    >
                      <option value="Femenino">Femenino</option>
                      <option value="Masculino">Masculino</option>
                      <option value="No binario">No binario</option>
                      <option value="Otro">Otro / Versátil</option>
                    </select>
                  </div>

                  <div>
                    <label className={styles.label}>Biotipo Físico</label>
                    <select
                      value={biotipo}
                      onChange={(e) => setBiotipo(e.target.value)}
                      className={styles.select}
                    >
                      <option value="Medio">Medio / Promedio</option>
                      <option value="Ectomorfo / Delgado">Ectomorfo / Delgado</option>
                      <option value="Mesomorfo / Atlético">Mesomorfo / Atlético</option>
                      <option value="Robusto / Sobrepeso">Robusto / Sobrepeso</option>
                      <option value="Estatura Alta">Estatura Alta (&gt; 1.80m)</option>
                      <option value="Estatura Baja">Estatura Baja (&lt; 1.55m)</option>
                    </select>
                  </div>
                </div>

                {rangoSeleccionado && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        color: rangoSeleccionado.color,
                        background: `${rangoSeleccionado.color}22`,
                        border: `1px solid ${rangoSeleccionado.color}44`,
                      }}
                    >
                      🎂 {rangoSeleccionado.nombre}
                    </span>
                    {rangoSeleccionado.descripcion && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {rangoSeleccionado.descripcion}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* SECCIÓN 2: ESPECIALIDADES CLÍNICAS DOMINADAS */}
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.15rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span>🩺</span> Especialidades y Casos Clínicos Dominados ({especialidadesIds.length})
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Haz clic en los distintivos para activar/desactivar
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                  {especialidadesList.map((esp) => {
                    const isSelected = especialidadesIds.includes(esp.id);
                    return (
                      <button
                        key={esp.id}
                        type="button"
                        onClick={() => toggleEspecialidad(esp.id)}
                        style={{
                          padding: '0.4rem 0.8rem',
                          borderRadius: '8px',
                          border: isSelected ? `2px solid ${esp.color}` : '1px solid var(--border-color)',
                          background: isSelected ? `${esp.color}33` : 'var(--bg-secondary)',
                          color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? `0 2px 8px ${esp.color}44` : 'none',
                        }}
                      >
                        <span>{esp.icono}</span>
                        <span>{esp.nombre}</span>
                        {isSelected && <span style={{ color: '#34d399', fontWeight: 800 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECCIÓN 3: RESTRICCIONES Y CONTRAINDICACIONES */}
              <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.15rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span>⚠️</span> Restricciones Médicas y Contraindicaciones ({restriccionesIds.length})
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Activa las contraindicaciones aplicables a este actor
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
                  {restriccionesList.map((rest) => {
                    const isSelected = restriccionesIds.includes(rest.id);
                    return (
                      <button
                        key={rest.id}
                        type="button"
                        onClick={() => toggleRestriccion(rest.id)}
                        style={{
                          padding: '0.4rem 0.8rem',
                          borderRadius: '8px',
                          border: isSelected ? `2px solid ${rest.color}` : '1px solid var(--border-color)',
                          background: isSelected ? `${rest.color}33` : 'var(--bg-secondary)',
                          color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? `0 2px 8px ${rest.color}44` : 'none',
                        }}
                      >
                        <span>{rest.icono}</span>
                        <span>{rest.nombre}</span>
                        {isSelected && <span style={{ color: '#ef4444', fontWeight: 800 }}>⚠️</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECCIÓN 4: EXPERIENCIA, DISPONIBILIDAD Y CONTACTO */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className={styles.label}>
                    🎭 Experiencia Teatral, Notas Clínicas & Habilidades Destacadas
                  </label>
                  <textarea
                    rows={3}
                    placeholder="ej: Excelente manejo de crisis emocionales, improvisación médica fluida, experiencia de 3 años en ECOE de Medicina y Psicología..."
                    value={experienciaNotas}
                    onChange={(e) => setExperienciaNotas(e.target.value)}
                    className={styles.inputField}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label className={styles.label}>📅 Disponibilidad Horaria Habitual</label>
                  <input
                    type="text"
                    placeholder="ej: Lunes y Miércoles tardes, Sábados todo el día"
                    value={disponibilidad}
                    onChange={(e) => setDisponibilidad(e.target.value)}
                    className={styles.inputField}
                  />
                </div>

                <div>
                  <label className={styles.label}>🚨 Contacto de Emergencia</label>
                  <input
                    type="text"
                    placeholder="ej: María Torres (Hermana) - 987654321"
                    value={contactoEmergencia}
                    onChange={(e) => setContactoEmergencia(e.target.value)}
                    className={styles.inputField}
                  />
                </div>
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button type="button" onClick={onClose} className={styles.secondaryBtn} disabled={saveLoading}>
                  Cancelar
                </button>
                <button type="submit" className={styles.actionBtn} disabled={saveLoading} style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)' }}>
                  {saveLoading ? 'Guardando Ficha...' : '💾 Guardar Ficha de Casting'}
                </button>
              </div>
            </form>
          )}
        </div>
        <style>{`
          @media print {
            body * {
              visibility: hidden !important;
            }
            #ficha-estacion-print, #ficha-estacion-print * {
              visibility: visible !important;
            }
            #ficha-estacion-print {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 24px !important;
              background: #ffffff !important;
              color: #0f172a !important;
              box-shadow: none !important;
              border: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
};
