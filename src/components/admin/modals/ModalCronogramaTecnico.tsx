'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './ModalCronogramaTecnico.module.css';
import {
  UsuarioItem,
  TurnoProgramadoTecnicoItem,
  TipoDiaTecnico,
  BancoCompensatorioItem,
} from '@/types/admin';
import { showToast, confirmModal, showError } from '@/lib/alerts';

interface ModalCronogramaTecnicoProps {
  usuario: UsuarioItem | null;
  isOpen: boolean;
  onClose: () => void;
  onTurnoUpdated?: () => void;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const PRESETS_HORARIOS = [
  { label: '07:00 - 15:00', entrada: '07:00', salida: '15:00' },
  { label: '09:00 - 18:00', entrada: '09:00', salida: '18:00' },
  { label: '10:00 - 19:00', entrada: '10:00', salida: '19:00' },
  { label: '13:00 - 22:00', entrada: '13:00', salida: '22:00' },
];

export const ModalCronogramaTecnico: React.FC<ModalCronogramaTecnicoProps> = ({
  usuario,
  isOpen,
  onClose,
  onTurnoUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'cronograma' | 'compensatorios'>('cronograma');

  // Mes y Año de navegación (inicia en fecha actual Perú)
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth()); // 0-11

  // Estado de datos
  const [turnosMap, setTurnosMap] = useState<Map<string, TurnoProgramadoTecnicoItem>>(new Map());

  // Compensatorios
  const [saldoDias, setSaldoDias] = useState<number>(0);
  const [totalAcumulados, setTotalAcumulados] = useState<number>(0);
  const [totalCanjeados, setTotalCanjeados] = useState<number>(0);
  const [movimientos, setMovimientos] = useState<BancoCompensatorioItem[]>([]);

  // Día seleccionado para edición en el calendario
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editTipoDia, setEditTipoDia] = useState<TipoDiaTecnico>('laborable');
  const [editEsPersonalizado, setEditEsPersonalizado] = useState(false);
  const [editHoraEntrada, setEditHoraEntrada] = useState('');
  const [editHoraSalida, setEditHoraSalida] = useState('');
  const [editNota, setEditNota] = useState('');
  const [savingShift, setSavingShift] = useState(false);

  // Formulario para asignación manual de compensatorio
  const [showAddCompensatorio, setShowAddCompensatorio] = useState(false);
  const [compTipo, setCompTipo] = useState<'acumulado' | 'canjeado'>('acumulado');
  const [compDias, setCompDias] = useState('1');
  const [compFechaRef, setCompFechaRef] = useState('');
  const [compMotivo, setCompMotivo] = useState('');
  const [savingComp, setSavingComp] = useState(false);

  // Auto-detección
  const [detectingSemanas, setDetectingSemanas] = useState(false);

  // Estado para montar portal en cliente
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Clave del mes actual en formato "YYYY-MM"
  const currentMonthStr = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${currentYear}-${pad(currentMonth + 1)}`;
  }, [currentYear, currentMonth]);

  // Cargar cronograma del mes
  const loadCronograma = useCallback(async () => {
    if (!usuario?.id) return;
    try {
      const res = await fetch(`/api/tecnicos/cronograma?usuarioId=${usuario.id}&mes=${currentMonthStr}`);
      const data = await res.json();
      if (res.ok && data.success) {
        const map = new Map<string, TurnoProgramadoTecnicoItem>();
        for (const t of data.turnos || []) {
          map.set(t.fecha, t);
        }
        setTurnosMap(map);
      }
    } catch (err) {
      console.error('Error cargando cronograma de técnico:', err);
    }
  }, [usuario?.id, currentMonthStr]);

  // Cargar compensatorios
  const loadCompensatorios = useCallback(async () => {
    if (!usuario?.id) return;
    try {
      const res = await fetch(`/api/tecnicos/compensatorios?usuarioId=${usuario.id}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSaldoDias(data.saldoDias || 0);
        setTotalAcumulados(data.totalAcumulados || 0);
        setTotalCanjeados(data.totalCanjeados || 0);
        setMovimientos(data.movimientos || []);
      }
    } catch (err) {
      console.error('Error cargando compensatorios de técnico:', err);
    }
  }, [usuario?.id]);

  useEffect(() => {
    if (isOpen && usuario?.id) {
      loadCronograma();
      loadCompensatorios();
      setSelectedDate(null);
    }
  }, [isOpen, usuario?.id, loadCronograma, loadCompensatorios]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Navegación de mes
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDate(null);
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDate(null);
  };

  // Matriz de días del mes para el calendario (Lunes a Domingo)
  const calendarCells = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`;

    // getDay(): 0=Dom, 1=Lun... convertimos para que 0 sea Lunes
    const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const totalDays = lastDay.getDate();

    const cells: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isWeekend: boolean;
      turnoProg?: TurnoProgramadoTecnicoItem;
    }> = [];

    // Días del mes anterior para rellenar
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      cells.push({
        dateStr: '',
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: false,
        isWeekend: false,
      });
    }

    // Días del mes actual
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(d)}`;
      const dayDate = new Date(currentYear, currentMonth, d);
      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
      const isToday = dateStr === todayStr;
      const turnoProg = turnosMap.get(dateStr);

      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday,
        isWeekend,
        turnoProg,
      });
    }

    // Rellenar hasta múltiplo de 7 (hasta 35 o 42 celdas)
    const remainder = cells.length % 7;
    if (remainder > 0) {
      const nextDaysNeeded = 7 - remainder;
      for (let i = 1; i <= nextDaysNeeded; i++) {
        cells.push({
          dateStr: '',
          dayNumber: i,
          isCurrentMonth: false,
          isToday: false,
          isWeekend: false,
        });
      }
    }

    return cells;
  }, [currentYear, currentMonth, turnosMap]);

  // Al hacer clic en un día del calendario
  const handleSelectDay = (dateStr: string) => {
    if (!dateStr) return;
    setSelectedDate(dateStr);

    const prog = turnosMap.get(dateStr);
    if (prog) {
      setEditTipoDia(prog.tipoDia);
      setEditEsPersonalizado(prog.esPersonalizado);
      setEditHoraEntrada(prog.horaEntradaEsperada || usuario?.horaEntradaEsperada || '13:00');
      setEditHoraSalida(prog.horaSalidaEsperada || usuario?.horaSalidaEsperada || '22:00');
      setEditNota(prog.nota || '');
    } else {
      // Valor por defecto: si es domingo o fin de semana, sugerir personalizado o descanso
      const [y, m, d] = dateStr.split('-').map(Number);
      const isSunday = new Date(y, m - 1, d).getDay() === 0;

      if (isSunday) {
        setEditTipoDia('laborable');
        setEditEsPersonalizado(true);
        setEditHoraEntrada('09:00');
        setEditHoraSalida('18:00');
        setEditNota('Guardia Domingo');
      } else {
        setEditTipoDia('laborable');
        setEditEsPersonalizado(false);
        setEditHoraEntrada(usuario?.horaEntradaEsperada || '13:00');
        setEditHoraSalida(usuario?.horaSalidaEsperada || '22:00');
        setEditNota('');
      }
    }
  };

  // Guardar turno del día
  const handleSaveShift = async () => {
    if (!usuario?.id || !selectedDate) return;
    setSavingShift(true);
    try {
      const res = await fetch('/api/tecnicos/cronograma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: usuario.id,
          fecha: selectedDate,
          tipoDia: editTipoDia,
          horaEntradaEsperada: editTipoDia === 'laborable' || editTipoDia === 'guardia_evento' ? editHoraEntrada : null,
          horaSalidaEsperada: editTipoDia === 'laborable' || editTipoDia === 'guardia_evento' ? editHoraSalida : null,
          esPersonalizado: editEsPersonalizado,
          nota: editNota,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Programación guardada para el ${selectedDate}`, 'success');
        await loadCronograma();
        await loadCompensatorios();
        if (onTurnoUpdated) onTurnoUpdated();
        setSelectedDate(null);
      } else {
        showError('Error al guardar', data.error || 'No se pudo guardar el turno');
      }
    } catch {
      showError('Error de conexión', 'No se pudo comunicar con el servidor');
    } finally {
      setSavingShift(false);
    }
  };

  // Revertir turno a predeterminado
  const handleRevertShift = async () => {
    if (!usuario?.id || !selectedDate) return;
    const confirm = await confirmModal({
      title: '¿Revertir a turno habitual?',
      text: `Se eliminará la programación específica del ${selectedDate} y se usará el horario base (${usuario.horaEntradaEsperada || '13:00'} - ${usuario.horaSalidaEsperada || '22:00'}).`,
      confirmText: 'Sí, revertir',
    });
    if (!confirm) return;

    setSavingShift(true);
    try {
      const res = await fetch(`/api/tecnicos/cronograma?usuarioId=${usuario.id}&fecha=${selectedDate}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Turno revertido a horario base', 'info');
        await loadCronograma();
        if (onTurnoUpdated) onTurnoUpdated();
        setSelectedDate(null);
      } else {
        showError('Error', data.error || 'No se pudo revertir');
      }
    } catch {
      showError('Error de conexión', 'No se pudo comunicar con el servidor');
    } finally {
      setSavingShift(false);
    }
  };

  // Registrar compensatorio manual (acumular o canjear)
  const handleSaveCompensatorio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario?.id || !compMotivo.trim()) return;
    setSavingComp(true);
    try {
      const res = await fetch('/api/tecnicos/compensatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: usuario.id,
          tipo: compTipo,
          dias: Number(compDias) || 1,
          fechaReferencia: compFechaRef || null,
          motivo: compMotivo.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Movimiento registrado: ${compTipo === 'acumulado' ? '+1' : '-1'} día`, 'success');
        await loadCompensatorios();
        if (onTurnoUpdated) onTurnoUpdated();
        setShowAddCompensatorio(false);
        setCompMotivo('');
        setCompFechaRef('');
      } else {
        showError('Error', data.error || 'No se pudo registrar');
      }
    } catch {
      showError('Error de conexión', 'No se pudo comunicar con el servidor');
    } finally {
      setSavingComp(false);
    }
  };

  // Auto-auditar semanas 7/7
  const handleAutoDetectSemanas = async () => {
    if (!usuario?.id) return;
    setDetectingSemanas(true);
    try {
      const res = await fetch('/api/tecnicos/compensatorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'auto_detect_semanas',
          usuarioId: usuario.id,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const noRegistradas = data.semanasCompletasSinCompensatorio || [];
        if (noRegistradas.length === 0) {
          showToast(
            'Auditoría al día: no hay semanas continuas (7/7) pendientes de compensar.',
            'info'
          );
        } else {
          const confirmar = await confirmModal({
            title: `¡Se detectaron ${noRegistradas.length} semana(s) completa(s)!`,
            text: `El técnico asistió los 7 días consecutivos sin descanso en las siguientes semanas:\n\n${noRegistradas
              .map((s: { lunesInicio: string; domingoFin: string }) => `• Semana del ${s.lunesInicio} al ${s.domingoFin} (7 días)`)
              .join('\n')}\n\n¿Deseas registrar automáticamente +${noRegistradas.length} día(s) compensatorio(s) a su favor?`,
            confirmText: `Sí, asignar +${noRegistradas.length} día(s)`,
          });

          if (confirmar) {
            for (const sem of noRegistradas) {
              await fetch('/api/tecnicos/compensatorios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  usuarioId: usuario.id,
                  tipo: 'acumulado',
                  dias: 1,
                  fechaReferencia: sem.domingoFin,
                  motivo: `Semana continua trabajada (7/7 días) del ${sem.lunesInicio} al ${sem.domingoFin}`,
                }),
              });
            }
            showToast(`Se otorgaron +${noRegistradas.length} día(s) compensatorio(s)`, 'success');
            await loadCompensatorios();
            if (onTurnoUpdated) onTurnoUpdated();
          }
        }
      } else {
        showError('Error en auditoría', data.error);
      }
    } catch {
      showError('Error de conexión', 'No se pudo conectar para auditar');
    } finally {
      setDetectingSemanas(false);
    }
  };

  if (!isOpen || !usuario) return null;

  const modalNode = (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* ENCABEZADO CON IDENTIDAD UCS */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h2>
              <span>🛠️</span>
              <span>Gestión de Turnos & Compensatorios</span>
            </h2>
            <div className={styles.headerSubtitle}>
              <strong style={{ color: 'var(--text-primary)' }}>
                {usuario.nombres} {usuario.apellidos}
              </strong>
              <span>•</span>
              <span>DNI: {usuario.dni}</span>
              <span>•</span>
              <span
                style={{
                  color: '#ff5a00',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                ⏰ Turno Base: {usuario.horaEntradaEsperada || '13:00'} - {usuario.horaSalidaEsperada || '22:00'}
              </span>
              <span>•</span>
              <span
                style={{
                  background: saldoDias > 0 ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)',
                  color: saldoDias > 0 ? '#10b981' : 'var(--text-muted)',
                  border: `1px solid ${saldoDias > 0 ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-color)'}`,
                  padding: '0.15rem 0.55rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                }}
              >
                ⭐ {saldoDias} {saldoDias === 1 ? 'Día Compensatorio' : 'Días Compensatorios'}
              </span>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} title="Cerrar ventana">
            ✕
          </button>
        </div>

        {/* PESTAÑAS (Estilo UCS) */}
        <div className={styles.tabsBar}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'cronograma' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('cronograma')}
          >
            <span>📅</span>
            <span>Malla Mensual & Turnos</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'compensatorios' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('compensatorios')}
          >
            <span>⭐</span>
            <span>Banco de Días Compensatorios ({saldoDias})</span>
          </button>
        </div>

        {/* CUERPO PRINCIPAL */}
        <div className={styles.contentBody}>
          {activeTab === 'cronograma' ? (
            <div>
              {/* Barra de Navegación del Mes */}
              <div className={styles.monthNav}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <button type="button" className={styles.navActionBtn} onClick={handlePrevMonth} title="Mes anterior">
                    ◀ Anterior
                  </button>
                  <button type="button" className={styles.navActionBtn} onClick={handleCurrentMonth} title="Ir a hoy">
                    Hoy
                  </button>
                  <button type="button" className={styles.navActionBtn} onClick={handleNextMonth} title="Mes siguiente">
                    Siguiente ▶
                  </button>
                </div>
                <div className={styles.monthTitle}>
                  {MESES[currentMonth]} {currentYear}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Haz clic en un día para personalizar horario o descanso
                </div>
              </div>

              {/* Grid Calendario */}
              <div className={styles.calendarGrid}>
                {DIAS_SEMANA.map((d, i) => (
                  <div key={d} className={styles.dayHeader} style={{ color: i >= 5 ? '#ff5a00' : undefined }}>
                    {d}
                  </div>
                ))}

                {calendarCells.map((cell, idx) => {
                  if (!cell.isCurrentMonth) {
                    return (
                      <div key={`out_${idx}`} className={`${styles.dayCell} ${styles.dayCellOutside}`}>
                        <span className={styles.dayNumber}>{cell.dayNumber}</span>
                      </div>
                    );
                  }

                  const isSelected = selectedDate === cell.dateStr;
                  const turno = cell.turnoProg;

                  return (
                    <div
                      key={cell.dateStr}
                      className={`${styles.dayCell} ${cell.isWeekend ? styles.dayCellWeekend : ''} ${
                        cell.isToday ? styles.dayCellToday : ''
                      } ${isSelected ? styles.dayCellSelected : ''}`}
                      onClick={() => handleSelectDay(cell.dateStr)}
                      title={`Clic para programar jornada del ${cell.dateStr}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className={styles.dayNumber}>{cell.dayNumber}</span>
                        {cell.isToday && (
                          <span style={{ fontSize: '0.62rem', color: '#ff5a00', fontWeight: 800 }}>HOY</span>
                        )}
                      </div>

                      {/* Pill de Turno */}
                      {turno ? (
                        turno.tipoDia === 'descanso' ? (
                          <span className={`${styles.shiftPill} ${styles.shiftRest}`} title="Descanso Semanal Obligatorio">
                            🏖️ Descanso
                          </span>
                        ) : turno.tipoDia === 'descanso_compensatorio' ? (
                          <span className={`${styles.shiftPill} ${styles.shiftCompensatory}`} title="Descanso Compensatorio tomado">
                            ⭐ Compensado
                          </span>
                        ) : turno.esPersonalizado ? (
                          <span
                            className={`${styles.shiftPill} ${styles.shiftCustom}`}
                            title={`Turno personalizado: ${turno.horaEntradaEsperada} - ${turno.horaSalidaEsperada}${
                              turno.nota ? ` (${turno.nota})` : ''
                            }`}
                          >
                            ✏️ {turno.horaEntradaEsperada}-{turno.horaSalidaEsperada}
                          </span>
                        ) : (
                          <span
                            className={`${styles.shiftPill} ${styles.shiftRegular}`}
                            title={`Turno programado: ${turno.horaEntradaEsperada} - ${turno.horaSalidaEsperada}`}
                          >
                            🕒 {turno.horaEntradaEsperada}-{turno.horaSalidaEsperada}
                          </span>
                        )
                      ) : (
                        <span
                          className={styles.shiftBaseText}
                          title={`Horario base habitual: ${usuario.horaEntradaEsperada || '13:00'} a ${usuario.horaSalidaEsperada || '22:00'}`}
                        >
                          ⏰ {usuario.horaEntradaEsperada || '13:00'}-{usuario.horaSalidaEsperada || '22:00'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Panel de Edición para el Día Seleccionado */}
              {selectedDate && (
                <div className={styles.dayEditor}>
                  <div className={styles.dayEditorHeader}>
                    <div className={styles.dayEditorTitle}>
                      <span>📅</span>
                      <span>Configuración de Jornada para el: <strong>{selectedDate}</strong></span>
                    </div>
                    {turnosMap.has(selectedDate) && (
                      <button
                        type="button"
                        onClick={handleRevertShift}
                        className={styles.cancelBtn}
                        style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        title="Eliminar personalización y volver al horario base del usuario"
                      >
                        🗑️ Revertir a Horario Base
                      </button>
                    )}
                  </div>

                  {/* Opciones de Tipo de Día */}
                  <div className={styles.radioGroup}>
                    <label
                      className={`${styles.radioLabel} ${
                        editTipoDia === 'laborable' && !editEsPersonalizado ? styles.radioLabelActive : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="tipoDia"
                        checked={editTipoDia === 'laborable' && !editEsPersonalizado}
                        onChange={() => {
                          setEditTipoDia('laborable');
                          setEditEsPersonalizado(false);
                          setEditHoraEntrada(usuario.horaEntradaEsperada || '13:00');
                          setEditHoraSalida(usuario.horaSalidaEsperada || '22:00');
                        }}
                      />
                      <div>
                        <strong>Turno Base Habitual</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {usuario.horaEntradaEsperada || '13:00'} a {usuario.horaSalidaEsperada || '22:00'}
                        </div>
                      </div>
                    </label>

                    <label
                      className={`${styles.radioLabel} ${
                        editTipoDia === 'laborable' && editEsPersonalizado ? styles.radioLabelActive : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name="tipoDia"
                        checked={editTipoDia === 'laborable' && editEsPersonalizado}
                        onChange={() => {
                          setEditTipoDia('laborable');
                          setEditEsPersonalizado(true);
                        }}
                      />
                      <div>
                        <strong style={{ color: '#d97706' }}>✏️ Horario Personalizado</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          Para domingos, guardias o eventos (ej. 10:00 a 19:00)
                        </div>
                      </div>
                    </label>

                    <label className={`${styles.radioLabel} ${editTipoDia === 'descanso' ? styles.radioLabelActive : ''}`}>
                      <input
                        type="radio"
                        name="tipoDia"
                        checked={editTipoDia === 'descanso'}
                        onChange={() => {
                          setEditTipoDia('descanso');
                          setEditEsPersonalizado(false);
                        }}
                      />
                      <div>
                        <strong style={{ color: '#059669' }}>🏖️ Descanso Semanal (DSO)</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          Día de descanso regular rotativo
                        </div>
                      </div>
                    </label>

                    <label
                      className={`${styles.radioLabel} ${editTipoDia === 'descanso_compensatorio' ? styles.radioLabelActive : ''}`}
                    >
                      <input
                        type="radio"
                        name="tipoDia"
                        checked={editTipoDia === 'descanso_compensatorio'}
                        onChange={() => {
                          setEditTipoDia('descanso_compensatorio');
                          setEditEsPersonalizado(false);
                        }}
                      />
                      <div>
                        <strong style={{ color: '#7e22ce' }}>⭐ Descanso Compensatorio</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          Canje de día a favor por semana trabajada (Descuenta 1 día)
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Inputs para Horario Personalizado */}
                  {editTipoDia === 'laborable' && editEsPersonalizado && (
                    <div className={styles.customTimeInputs}>
                      <div className={styles.timeInputWrapper}>
                        <label>Hora Entrada:</label>
                        <input
                          type="time"
                          className={styles.timeInput}
                          value={editHoraEntrada}
                          onChange={(e) => setEditHoraEntrada(e.target.value)}
                        />
                      </div>
                      <div className={styles.timeInputWrapper}>
                        <label>Hora Salida:</label>
                        <input
                          type="time"
                          className={styles.timeInput}
                          value={editHoraSalida}
                          onChange={(e) => setEditHoraSalida(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '220px' }}>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                          Atajos Rápidos:
                        </span>
                        <div className={styles.quickPresets}>
                          {PRESETS_HORARIOS.map((p) => (
                            <button
                              key={p.label}
                              type="button"
                              className={styles.presetBtn}
                              onClick={() => {
                                setEditHoraEntrada(p.entrada);
                                setEditHoraSalida(p.salida);
                              }}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Campo de Nota / Observación */}
                  <div style={{ marginTop: '0.85rem' }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                      Nota u Observación (Opcional):
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Guardia domingo - Curso finaliza 18:45, Cobertura ECOE"
                      value={editNota}
                      onChange={(e) => setEditNota(e.target.value)}
                      className={styles.formInput}
                    />
                  </div>

                  {/* Acciones */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                    <button type="button" className={styles.cancelBtn} onClick={() => setSelectedDate(null)}>
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={handleSaveShift}
                      disabled={savingShift}
                    >
                      <span>💾</span>
                      <span>{savingShift ? 'Guardando...' : 'Guardar Programación'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Sección Banco de Días Compensatorios */}
              <div className={styles.compensatoriosCards}>
                <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
                  <span className={styles.kpiLabel}>⭐ Saldo de Días a Favor</span>
                  <span className={styles.kpiValue} style={{ color: saldoDias > 0 ? '#ff5a00' : 'var(--text-secondary)' }}>
                    {saldoDias} {saldoDias === 1 ? 'Día' : 'Días'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Disponibles para coordinar descanso con Jefatura
                  </span>
                </div>

                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Total Días Acumulados</span>
                  <span className={styles.kpiValue} style={{ color: '#059669' }}>
                    +{totalAcumulados}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Por semanas 7/7 continuas o guardias
                  </span>
                </div>

                <div className={styles.kpiCard}>
                  <span className={styles.kpiLabel}>Total Días Canjeados</span>
                  <span className={styles.kpiValue} style={{ color: '#7e22ce' }}>
                    -{totalCanjeados}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Descansos compensatorios tomados
                  </span>
                </div>
              </div>

              {/* Botones de Acción */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => {
                      setCompTipo('acumulado');
                      setCompDias('1');
                      setCompMotivo('Semana continua sin descanso / Evento especial');
                      setShowAddCompensatorio(true);
                    }}
                  >
                    <span>➕</span>
                    <span>Asignar Día Compensatorio (+1)</span>
                  </button>

                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => {
                      setCompTipo('canjeado');
                      setCompDias('1');
                      setCompMotivo('Descanso compensatorio coordinado');
                      setShowAddCompensatorio(true);
                    }}
                    disabled={saldoDias <= 0}
                    title={saldoDias <= 0 ? 'No tiene días compensatorios disponibles para canjear' : undefined}
                  >
                    <span>🏖️</span>
                    <span>Registrar Descanso Tomado (-1)</span>
                  </button>
                </div>

                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={handleAutoDetectSemanas}
                  disabled={detectingSemanas}
                  style={{ borderColor: 'rgba(245, 158, 11, 0.45)', color: '#d97706', fontWeight: 600 }}
                  title="Audita automáticamente si el técnico asistió 7 días continuos en alguna semana para otorgar el día compensatorio"
                >
                  <span>🔍</span>
                  <span>{detectingSemanas ? 'Auditando...' : 'Auto-auditar Semanas 7/7'}</span>
                </button>
              </div>

              {/* Formulario Inline para registrar movimiento */}
              {showAddCompensatorio && (
                <form
                  onSubmit={handleSaveCompensatorio}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1.5px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    marginBottom: '1.25rem',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.85rem', color: 'var(--text-primary)' }}>
                    {compTipo === 'acumulado' ? '➕ Asignar Día Compensatorio a Favor (+)' : '🏖️ Registrar Descanso Compensatorio Tomado (-)'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '0.85rem' }}>
                    <div>
                      <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                        Días:
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="10"
                        value={compDias}
                        onChange={(e) => setCompDias(e.target.value)}
                        required
                        className={styles.formInput}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                        Fecha de Referencia:
                      </label>
                      <input
                        type="date"
                        value={compFechaRef}
                        onChange={(e) => setCompFechaRef(e.target.value)}
                        className={styles.formInput}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                      Motivo / Justificación:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Cobertura Evento ECOE Domingo 18/10, o descanso acordado con jefatura"
                      value={compMotivo}
                      onChange={(e) => setCompMotivo(e.target.value)}
                      required
                      className={styles.formInput}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button type="button" className={styles.cancelBtn} onClick={() => setShowAddCompensatorio(false)}>
                      Cancelar
                    </button>
                    <button type="submit" className={styles.actionBtn} disabled={savingComp}>
                      {savingComp ? 'Guardando...' : 'Confirmar Registro'}
                    </button>
                  </div>
                </form>
              )}

              {/* Tabla de Historial */}
              <div className={styles.tableWrapper}>
                <table className={styles.tableCompensatorios}>
                  <thead>
                    <tr>
                      <th>Fecha Movimiento</th>
                      <th>Tipo</th>
                      <th>Días</th>
                      <th>Fecha Referencia</th>
                      <th>Motivo</th>
                      <th>Saldo Resultante</th>
                      <th>Autorizado Por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          No hay movimientos registrados en el banco de compensatorios de este colaborador.
                        </td>
                      </tr>
                    ) : (
                      movimientos.map((m) => {
                        const esPositivo = Number(m.dias) > 0;
                        return (
                          <tr key={m.id}>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>
                              {new Date(m.createdAt).toLocaleDateString('es-PE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </td>
                            <td>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '6px',
                                  background:
                                    m.tipo === 'acumulado'
                                      ? 'rgba(16, 185, 129, 0.15)'
                                      : m.tipo === 'canjeado'
                                      ? 'rgba(168, 85, 247, 0.15)'
                                      : 'rgba(59, 130, 246, 0.15)',
                                  color:
                                    m.tipo === 'acumulado'
                                      ? '#059669'
                                      : m.tipo === 'canjeado'
                                      ? '#7e22ce'
                                      : '#0284c7',
                                }}
                              >
                                {m.tipo}
                              </span>
                            </td>
                            <td
                              style={{
                                fontWeight: 800,
                                color: esPositivo ? '#059669' : '#ef4444',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {esPositivo ? `+${m.dias}` : m.dias}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{m.fechaReferencia || '—'}</td>
                            <td>{m.motivo}</td>
                            <td style={{ fontWeight: 700, color: '#ff5a00', fontFamily: 'var(--font-mono)' }}>
                              {m.saldoResultante ?? '—'}
                            </td>
                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                              {m.autorizadoPorNombre || 'Sistema / Admin'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* PIE DEL MODAL */}
        <div className={styles.modalFooter}>
          <button type="button" onClick={onClose} className={styles.cancelBtn}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );

  // Montar vía createPortal para oscurecer toda la pantalla sin importar contextos CSS del padre
  if (mounted && typeof document !== 'undefined') {
    return createPortal(modalNode, document.body);
  }

  return modalNode;
};
