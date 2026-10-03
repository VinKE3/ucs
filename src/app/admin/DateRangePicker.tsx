'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './DateRangePicker.module.css';

interface DateRangePickerProps {
  fechaDesde: string; // 'YYYY-MM-DD' o ''
  fechaHasta: string; // 'YYYY-MM-DD' o ''
  onChange: (desde: string, hasta: string) => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEKDAY_NAMES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  fechaDesde,
  fechaHasta,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Inicializar el mes visible
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    if (fechaDesde) {
      const parts = fechaDesde.split('-').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date();
  });

  // Rango temporal mientras interactúa en el calendario
  const [tempDesde, setTempDesde] = useState(fechaDesde);
  const [tempHasta, setTempHasta] = useState(fechaHasta);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Sincronizar estado cuando cambian las props
  useEffect(() => {
    setTempDesde(fechaDesde);
    setTempHasta(fechaHasta);
  }, [fechaDesde, fechaHasta]);

  // Click outside para cerrar el popover
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Funciones de formateo
  const formatIso = (d: Date) => {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatDisplayShort = (iso: string) => {
    if (!iso) return '';
    const parts = iso.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = d.getDate().toString().padStart(2, '0');
    const month = MONTH_NAMES[d.getMonth()].substring(0, 3);
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Label del botón trigger
  const getTriggerLabel = () => {
    if (!fechaDesde && !fechaHasta) {
      return 'Todas las Fechas (Histórico)';
    }
    if (fechaDesde && !fechaHasta) {
      return `Desde ${formatDisplayShort(fechaDesde)}`;
    }
    if (fechaDesde && fechaHasta) {
      if (fechaDesde === fechaHasta) {
        const todayIso = formatIso(new Date());
        return `${formatDisplayShort(fechaDesde)} ${fechaDesde === todayIso ? '(Hoy)' : ''}`;
      }
      return `${formatDisplayShort(fechaDesde)} – ${formatDisplayShort(fechaHasta)}`;
    }
    return 'Seleccionar Fechas';
  };

  // Navegación de mes
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Presets rápidos
  const applyPreset = (tipo: 'hoy' | 'ayer' | 'semana' | 'mes' | '30dias' | 'todo') => {
    const now = new Date();
    let desde = '';
    let hasta = '';

    if (tipo === 'hoy') {
      desde = formatIso(now);
      hasta = formatIso(now);
    } else if (tipo === 'ayer') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      desde = formatIso(yesterday);
      hasta = formatIso(yesterday);
    } else if (tipo === 'semana') {
      const dayOfWeek = (now.getDay() + 6) % 7; // Lunes = 0
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      desde = formatIso(startOfWeek);
      hasta = formatIso(now);
    } else if (tipo === 'mes') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      desde = formatIso(startOfMonth);
      hasta = formatIso(now);
    } else if (tipo === '30dias') {
      const past30 = new Date(now);
      past30.setDate(now.getDate() - 30);
      desde = formatIso(past30);
      hasta = formatIso(now);
    } else if (tipo === 'todo') {
      desde = '';
      hasta = '';
    }

    setTempDesde(desde);
    setTempHasta(hasta);
    onChange(desde, hasta);
    setIsOpen(false);
  };

  // Clic en un día del calendario (Estilo Airbnb / Booking)
  const handleDayClick = (isoString: string) => {
    if (!tempDesde || (tempDesde && tempHasta)) {
      // Primer clic: define inicio
      setTempDesde(isoString);
      setTempHasta('');
    } else {
      // Segundo clic
      if (isoString < tempDesde) {
        // Si hizo clic en un día anterior al inicio, se vuelve el nuevo inicio
        setTempDesde(isoString);
      } else {
        // Define fin de rango
        setTempHasta(isoString);
      }
    }
  };

  // Botón Aplicar del footer
  const handleApply = () => {
    onChange(tempDesde, tempHasta);
    setIsOpen(false);
  };

  // Botón Limpiar del footer
  const handleClear = () => {
    setTempDesde('');
    setTempHasta('');
    onChange('', '');
    setIsOpen(false);
  };

  // Construir matriz de días para el mes visible
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Día de la semana donde empieza el mes (0 = Lunes, 6 = Domingo)
  const startDayIndex = (firstDayOfMonth.getDay() + 6) % 7;

  // Días del mes anterior para rellenar
  const prevMonthLastDate = new Date(year, month, 0).getDate();
  const calendarCells = [];

  for (let i = startDayIndex - 1; i >= 0; i--) {
    const day = prevMonthLastDate - i;
    const d = new Date(year, month - 1, day);
    calendarCells.push({
      day,
      iso: formatIso(d),
      isCurrentMonth: false,
    });
  }

  // Días del mes actual
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    calendarCells.push({
      day,
      iso: formatIso(d),
      isCurrentMonth: true,
    });
  }

  // Días del mes siguiente para completar la grilla a múltiplos de 7
  const remainingCells = 7 - (calendarCells.length % 7);
  if (remainingCells < 7) {
    for (let day = 1; day <= remainingCells; day++) {
      const d = new Date(year, month + 1, day);
      calendarCells.push({
        day,
        iso: formatIso(d),
        isCurrentMonth: false,
      });
    }
  }

  const todayIso = formatIso(new Date());

  // Determinar clases de selección para cada celda
  const getCellClasses = (iso: string, isCurrentMonth: boolean) => {
    const classes = [styles.dayCell];

    if (!isCurrentMonth) {
      classes.push(styles.dayCellOutsideMonth);
    }

    if (iso === todayIso) {
      classes.push(styles.dayCellToday);
    }

    const isStart = tempDesde === iso;
    const isEnd = tempHasta === iso;

    if (isStart && isEnd) {
      classes.push(styles.dayCellSingle);
      return classes.join(' ');
    }

    if (isStart) {
      classes.push(tempHasta ? styles.dayCellStart : styles.dayCellSingle);
    } else if (isEnd) {
      classes.push(styles.dayCellEnd);
    } else if (tempDesde && tempHasta && iso > tempDesde && iso < tempHasta) {
      classes.push(styles.dayCellInRange);
    } else if (tempDesde && !tempHasta && hoverDate && iso > tempDesde && iso <= hoverDate) {
      classes.push(styles.dayCellHoverRange);
    }

    return classes.join(' ');
  };

  // Calcular cantidad de días en el rango seleccionado
  const calculateDaysCount = () => {
    if (!tempDesde) return null;
    if (!tempHasta || tempDesde === tempHasta) return 1;
    const d1 = new Date(tempDesde);
    const d2 = new Date(tempHasta);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const daysCount = calculateDaysCount();

  return (
    <div className={styles.container} ref={containerRef}>
      {/* BOTÓN DISPARADOR */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`${styles.triggerBtn} ${isOpen ? styles.triggerBtnActive : ''}`}
        title="Filtrar por rango de fechas interactivo"
      >
        <span className={styles.triggerIcon}>📅</span>
        <span className={styles.triggerText}>{getTriggerLabel()}</span>
        
        {(fechaDesde || fechaHasta) && (
          <span
            className={styles.clearTriggerBtn}
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            title="Quitar filtro de fechas y ver todo el histórico"
          >
            ✕
          </span>
        )}

        <span className={`${styles.triggerCaret} ${isOpen ? styles.triggerCaretOpen : ''}`}>
          ▼
        </span>
      </button>

      {/* POPOVER FLOTANTE ESTILO AIRBNB / BOOKING */}
      {isOpen && (
        <div className={styles.popover}>
          {/* SIDEBAR DE PRESETS RÁPIDOS */}
          <div className={styles.presetsSidebar}>
            <div className={styles.presetTitle}>Períodos</div>
            <button
              type="button"
              className={`${styles.presetBtn} ${tempDesde === todayIso && tempHasta === todayIso ? styles.presetBtnActive : ''}`}
              onClick={() => applyPreset('hoy')}
            >
              <span>⚡</span> Hoy
            </button>
            <button
              type="button"
              className={styles.presetBtn}
              onClick={() => applyPreset('ayer')}
            >
              <span>⏮️</span> Ayer
            </button>
            <button
              type="button"
              className={styles.presetBtn}
              onClick={() => applyPreset('semana')}
            >
              <span>🗓️</span> Esta Semana
            </button>
            <button
              type="button"
              className={styles.presetBtn}
              onClick={() => applyPreset('mes')}
            >
              <span>📅</span> Este Mes
            </button>
            <button
              type="button"
              className={styles.presetBtn}
              onClick={() => applyPreset('30dias')}
            >
              <span>⏳</span> Últimos 30 días
            </button>
            <button
              type="button"
              className={`${styles.presetBtn} ${!tempDesde && !tempHasta ? styles.presetBtnActive : ''}`}
              onClick={() => applyPreset('todo')}
            >
              <span>📋</span> Todo el Histórico
            </button>
          </div>

          {/* CUERPO DEL CALENDARIO */}
          <div className={styles.calendarMain}>
            {/* CABECERA CON NAVEGACIÓN DE MES */}
            <div className={styles.monthNavHeader}>
              <button
                type="button"
                onClick={handlePrevMonth}
                className={styles.navArrowBtn}
                title="Mes anterior"
              >
                ‹
              </button>

              <span className={styles.monthTitle}>
                {MONTH_NAMES[month]} {year}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className={styles.navArrowBtn}
                title="Mes siguiente"
              >
                ›
              </button>
            </div>

            {/* GRILLA DE DÍAS DE LA SEMANA */}
            <div className={styles.calendarGrid}>
              {WEEKDAY_NAMES.map((name) => (
                <div key={name} className={styles.weekdayHeader}>
                  {name}
                </div>
              ))}

              {/* CELDAS DE DÍAS */}
              {calendarCells.map((cell, idx) => (
                <button
                  key={`${cell.iso}-${idx}`}
                  type="button"
                  className={getCellClasses(cell.iso, cell.isCurrentMonth)}
                  onClick={() => handleDayClick(cell.iso)}
                  onMouseEnter={() => setHoverDate(cell.iso)}
                  onMouseLeave={() => setHoverDate(null)}
                >
                  {cell.day}
                </button>
              ))}
            </div>

            {/* PIE DEL POPOVER CON RESUMEN Y BOTONES DE APLICAR */}
            <div className={styles.popoverFooter}>
              <div className={styles.summaryText}>
                {tempDesde ? (
                  <>
                    <span>Desde: <strong className={styles.summaryHighlight}>{formatDisplayShort(tempDesde)}</strong></span>
                    {tempHasta && (
                      <>
                        <span>➔</span>
                        <span>Hasta: <strong className={styles.summaryHighlight}>{formatDisplayShort(tempHasta)}</strong></span>
                      </>
                    )}
                    {daysCount && (
                      <span style={{ color: '#00e699', fontWeight: 600, marginLeft: '0.3rem' }}>
                        ({daysCount} {daysCount === 1 ? 'día' : 'días'})
                      </span>
                    )}
                  </>
                ) : (
                  <span>Haz clic en un día para iniciar la selección</span>
                )}
              </div>

              <div className={styles.footerActions}>
                {(tempDesde || tempHasta) && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className={styles.clearBtn}
                  >
                    Limpiar
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleApply}
                  className={styles.applyBtn}
                >
                  Aplicar Rango
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
