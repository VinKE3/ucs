'use client';

import React, { useState, useMemo } from 'react';
import styles from '@/app/admin/admin.module.css';
import type { AsistenciaAdminItem, UsuarioItem, CursoAdminItem } from '@/types/admin';

interface ModalPlanillaPSProps {
  isOpen: boolean;
  onClose: () => void;
  asistenciasList: AsistenciaAdminItem[];
  usuariosList?: UsuarioItem[];
  cursosList?: CursoAdminItem[];
  fechaDesdeDefecto?: string;
  fechaHastaDefecto?: string;
  onOpenKardex?: (user: UsuarioItem) => void;
}

export interface FilaPlanillaActor {
  usuarioId: number;
  dni: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  tarifaHoraBase: number | null;
  totalSesiones: number;
  sesionesEnCurso: number;
  minutosTotales: number;
  horasDecimal: number;
  horasFormato: string;
  cursosMap: Map<string, { cursoNombre: string; horas: number; tarifa: number; subtotal: number }>;
  totalAPagar: number;
  estadoPlanilla: 'listo' | 'en_curso';
  usuarioObj?: UsuarioItem;
}

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const ModalPlanillaPS: React.FC<ModalPlanillaPSProps> = ({
  isOpen,
  onClose,
  asistenciasList,
  usuariosList = [],
  cursosList = [],
  fechaDesdeDefecto = '',
  fechaHastaDefecto = '',
  onOpenKardex,
}) => {
  // Año y mes seleccionados (Por defecto Septiembre 2026 o el año/mes del filtro activo)
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(() => {
    if (fechaDesdeDefecto && fechaDesdeDefecto.startsWith('202')) {
      return parseInt(fechaDesdeDefecto.substring(0, 4), 10);
    }
    return 2026;
  });

  const [mesSeleccionado, setMesSeleccionado] = useState<number>(() => {
    if (fechaDesdeDefecto && fechaDesdeDefecto.includes('-')) {
      return parseInt(fechaDesdeDefecto.split('-')[1], 10) - 1; // 0-indexed (8 = Septiembre)
    }
    return 8; // Septiembre por defecto para demostración
  });

  // Tipo de corte contable: Mes completo, 1ra Quincena, 2da Quincena o Personalizado
  const [corteTipo, setCorteTipo] = useState<'mes_completo' | 'quincena_1' | 'quincena_2' | 'personalizado'>('mes_completo');
  const [fechaDesdeManual, setFechaDesdeManual] = useState<string>('2026-09-01');
  const [fechaHastaManual, setFechaHastaManual] = useState<string>('2026-09-30');

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'listo' | 'en_curso'>('todos');

  // Navegación de mes
  const handleMesAnterior = () => {
    if (mesSeleccionado === 0) {
      setMesSeleccionado(11);
      setAnioSeleccionado((prev) => prev - 1);
    } else {
      setMesSeleccionado((prev) => prev - 1);
    }
  };

  const handleMesSiguiente = () => {
    if (mesSeleccionado === 11) {
      setMesSeleccionado(0);
      setAnioSeleccionado((prev) => prev + 1);
    } else {
      setMesSeleccionado((prev) => prev + 1);
    }
  };

  // Cálculo de fechas efectivas y labels según corte
  const { fechaDesdeEfectiva, fechaHastaEfectiva, labelPeriodo, labelCorteCorto, slugCorte } = useMemo(() => {
    const mesNombre = NOMBRES_MESES[mesSeleccionado];
    const mesStr = String(mesSeleccionado + 1).padStart(2, '0');
    const ultimoDia = new Date(anioSeleccionado, mesSeleccionado + 1, 0).getDate();
    const ultimoDiaStr = String(ultimoDia).padStart(2, '0');

    if (corteTipo === 'quincena_1') {
      const fDesde = `${anioSeleccionado}-${mesStr}-01`;
      const fHasta = `${anioSeleccionado}-${mesStr}-15`;
      return {
        fechaDesdeEfectiva: fDesde,
        fechaHastaEfectiva: fHasta,
        labelPeriodo: `1RA QUINCENA DE ${mesNombre.toUpperCase()} ${anioSeleccionado} (01/${mesStr} AL 15/${mesStr})`,
        labelCorteCorto: `1ra Quincena (01-15 ${mesNombre})`,
        slugCorte: `1ra_Quincena_${mesNombre}_${anioSeleccionado}`,
      };
    }

    if (corteTipo === 'quincena_2') {
      const fDesde = `${anioSeleccionado}-${mesStr}-16`;
      const fHasta = `${anioSeleccionado}-${mesStr}-${ultimoDiaStr}`;
      return {
        fechaDesdeEfectiva: fDesde,
        fechaHastaEfectiva: fHasta,
        labelPeriodo: `2DA QUINCENA DE ${mesNombre.toUpperCase()} ${anioSeleccionado} (16/${mesStr} AL ${ultimoDiaStr}/${mesStr})`,
        labelCorteCorto: `2da Quincena (16-${ultimoDiaStr} ${mesNombre})`,
        slugCorte: `2da_Quincena_${mesNombre}_${anioSeleccionado}`,
      };
    }

    if (corteTipo === 'personalizado') {
      return {
        fechaDesdeEfectiva: fechaDesdeManual,
        fechaHastaEfectiva: fechaHastaManual,
        labelPeriodo: `PERÍODO PERSONALIZADO (${fechaDesdeManual} AL ${fechaHastaManual})`,
        labelCorteCorto: `Personalizado (${fechaDesdeManual} a ${fechaHastaManual})`,
        slugCorte: `Personalizado_${fechaDesdeManual}_al_${fechaHastaManual}`,
      };
    }

    // Default: Mes completo
    const fDesde = `${anioSeleccionado}-${mesStr}-01`;
    const fHasta = `${anioSeleccionado}-${mesStr}-${ultimoDiaStr}`;
    return {
      fechaDesdeEfectiva: fDesde,
      fechaHastaEfectiva: fHasta,
      labelPeriodo: `MES COMPLETO DE ${mesNombre.toUpperCase()} ${anioSeleccionado} (01/${mesStr} AL ${ultimoDiaStr}/${mesStr})`,
      labelCorteCorto: `Mes Completo (${mesNombre} ${anioSeleccionado})`,
      slugCorte: `Mes_Completo_${mesNombre}_${anioSeleccionado}`,
    };
  }, [corteTipo, anioSeleccionado, mesSeleccionado, fechaDesdeManual, fechaHastaManual]);

  // Mini comparativa quincenal (Monto Q1 vs Monto Q2 vs Mes)
  const statsComparativasQuincenas = useMemo(() => {
    const mesStr = String(mesSeleccionado + 1).padStart(2, '0');
    const fQ1Desde = `${anioSeleccionado}-${mesStr}-01`;
    const fQ1Hasta = `${anioSeleccionado}-${mesStr}-15`;
    const fQ2Desde = `${anioSeleccionado}-${mesStr}-16`;
    const ultimoDia = new Date(anioSeleccionado, mesSeleccionado + 1, 0).getDate();
    const fQ2Hasta = `${anioSeleccionado}-${mesStr}-${String(ultimoDia).padStart(2, '0')}`;

    let totalMontoQ1 = 0;
    let totalSesionesQ1 = 0;
    let totalMontoQ2 = 0;
    let totalSesionesQ2 = 0;

    for (const a of asistenciasList) {
      if (a.estado === 'anulado') continue;
      const uInfo = usuariosList.find((u) => u.id === a.usuarioId);
      const tipo = a.tipoPersonal || uInfo?.tipoPersonal;
      if (tipo !== 'paciente_simulado') continue;

      let tarifaSesion = 0;
      if (a.cursoTarifaHoraPs !== undefined && a.cursoTarifaHoraPs !== null && a.cursoTarifaHoraPs !== '') {
        tarifaSesion = Number(a.cursoTarifaHoraPs);
      } else if (a.cursoId) {
        const cFound = cursosList.find((c) => c.id === a.cursoId);
        if (cFound?.tarifaHoraPs !== undefined && cFound?.tarifaHoraPs !== null && cFound?.tarifaHoraPs !== '') {
          tarifaSesion = Number(cFound.tarifaHoraPs);
        }
      }
      if (tarifaSesion === 0 && uInfo?.tarifaHora) {
        tarifaSesion = Number(uInfo.tarifaHora);
      }

      const min = a.minutosTotales || 0;
      const subtotal = (min / 60) * tarifaSesion;

      if (a.fecha >= fQ1Desde && a.fecha <= fQ1Hasta) {
        totalMontoQ1 += subtotal;
        totalSesionesQ1++;
      } else if (a.fecha >= fQ2Desde && a.fecha <= fQ2Hasta) {
        totalMontoQ2 += subtotal;
        totalSesionesQ2++;
      }
    }

    return {
      montoQ1: totalMontoQ1,
      sesionesQ1: totalSesionesQ1,
      montoQ2: totalMontoQ2,
      sesionesQ2: totalSesionesQ2,
      montoMes: totalMontoQ1 + totalMontoQ2,
      sesionesMes: totalSesionesQ1 + totalSesionesQ2,
    };
  }, [asistenciasList, usuariosList, cursosList, anioSeleccionado, mesSeleccionado]);

  // Consolidación de datos de Pacientes Simulados para el corte actual
  const { actoresPlanilla, kpisPlanilla } = useMemo(() => {
    const map = new Map<number, FilaPlanillaActor>();
    const nowTimestamp = Date.now();

    for (const a of asistenciasList) {
      if (a.estado === 'anulado') continue;

      // Filtro de fechas efectivo según el corte seleccionado
      if (fechaDesdeEfectiva && a.fecha < fechaDesdeEfectiva) continue;
      if (fechaHastaEfectiva && a.fecha > fechaHastaEfectiva) continue;

      // Solo pacientes simulados
      const uInfo = usuariosList.find((u) => u.id === a.usuarioId);
      const tipo = a.tipoPersonal || uInfo?.tipoPersonal;
      if (tipo !== 'paciente_simulado') continue;

      let item = map.get(a.usuarioId);
      if (!item) {
        const tarifaBase = uInfo?.tarifaHora !== undefined && uInfo?.tarifaHora !== null && uInfo?.tarifaHora !== ''
          ? Number(uInfo.tarifaHora)
          : null;

        item = {
          usuarioId: a.usuarioId,
          dni: a.dni,
          nombres: a.nombres,
          apellidos: a.apellidos,
          correo: a.correo || uInfo?.correo || null,
          tarifaHoraBase: tarifaBase,
          totalSesiones: 0,
          sesionesEnCurso: 0,
          minutosTotales: 0,
          horasDecimal: 0,
          horasFormato: '0h 0m',
          cursosMap: new Map(),
          totalAPagar: 0,
          estadoPlanilla: 'listo',
          usuarioObj: uInfo,
        };
        map.set(a.usuarioId, item);
      }

      // Minutos de la sesión
      let minutos = a.minutosTotales || 0;
      if (a.estado === 'en_curso') {
        item.sesionesEnCurso++;
        item.estadoPlanilla = 'en_curso';
        if (a.horaIngreso) {
          const diff = Math.round((nowTimestamp - new Date(a.horaIngreso).getTime()) / 60000);
          if (diff > 0) minutos = diff;
        }
      }

      item.totalSesiones++;
      item.minutosTotales += minutos;

      // Determinación de tarifa para esta sesión
      let tarifaSesion: number = 0;
      if (a.cursoTarifaHoraPs !== undefined && a.cursoTarifaHoraPs !== null && a.cursoTarifaHoraPs !== '') {
        tarifaSesion = Number(a.cursoTarifaHoraPs);
      } else if (a.cursoId) {
        const cFound = cursosList.find((c) => c.id === a.cursoId);
        if (cFound?.tarifaHoraPs !== undefined && cFound?.tarifaHoraPs !== null && cFound?.tarifaHoraPs !== '') {
          tarifaSesion = Number(cFound.tarifaHoraPs);
        }
      }
      if (tarifaSesion === 0 && item.tarifaHoraBase) {
        tarifaSesion = item.tarifaHoraBase;
      }

      const horasSesion = minutos / 60;
      const subtotalSesion = horasSesion * tarifaSesion;
      item.totalAPagar += subtotalSesion;

      // Agrupar por curso
      const cNombre = a.cursoNombre || 'Simulación General';
      const cExistente = item.cursosMap.get(cNombre);
      if (!cExistente) {
        item.cursosMap.set(cNombre, {
          cursoNombre: cNombre,
          horas: horasSesion,
          tarifa: tarifaSesion,
          subtotal: subtotalSesion,
        });
      } else {
        cExistente.horas += horasSesion;
        cExistente.subtotal += subtotalSesion;
        if (!cExistente.tarifa && tarifaSesion > 0) cExistente.tarifa = tarifaSesion;
      }
    }

    const lista = Array.from(map.values()).map((actor) => {
      const horasNetas = actor.minutosTotales / 60;
      const h = Math.floor(actor.minutosTotales / 60);
      const m = Math.floor(actor.minutosTotales % 60);

      return {
        ...actor,
        horasDecimal: Number(horasNetas.toFixed(2)),
        horasFormato: `${h}h ${m}m`,
        totalAPagar: Number(actor.totalAPagar.toFixed(2)),
      };
    }).sort((a, b) => b.totalAPagar - a.totalAPagar);

    // Métricas globales
    const totalActores = lista.length;
    const totalMinutosGral = lista.reduce((acc, curr) => acc + curr.minutosTotales, 0);
    const totalMontoGral = lista.reduce((acc, curr) => acc + curr.totalAPagar, 0);
    const cursosSet = new Set<string>();
    lista.forEach((act) => act.cursosMap.forEach((_, cNom) => cursosSet.add(cNom)));

    return {
      actoresPlanilla: lista,
      kpisPlanilla: {
        totalActores,
        totalHorasDecimal: (totalMinutosGral / 60).toFixed(1),
        totalHorasFormato: `${Math.floor(totalMinutosGral / 60)}h ${totalMinutosGral % 60}m`,
        totalMontoGral: Number(totalMontoGral.toFixed(2)),
        totalCursos: cursosSet.size,
      },
    };
  }, [asistenciasList, usuariosList, cursosList, fechaDesdeEfectiva, fechaHastaEfectiva]);

  // Filtrado reactivo en pantalla
  const actoresFiltrados = useMemo(() => {
    return actoresPlanilla.filter((a) => {
      if (busqueda.trim()) {
        const query = busqueda.toLowerCase();
        const coincide =
          a.nombres.toLowerCase().includes(query) ||
          a.apellidos.toLowerCase().includes(query) ||
          a.dni.includes(query);
        if (!coincide) return false;
      }
      if (filtroEstado !== 'todos' && a.estadoPlanilla !== filtroEstado) {
        return false;
      }
      return true;
    });
  }, [actoresPlanilla, busqueda, filtroEstado]);

  if (!isOpen) return null;

  const fechaHoy = new Date().toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Exportación formal a Excel (CSV con membrete adaptado al corte)
  const handleExportarExcelFinanzas = () => {
    if (actoresPlanilla.length === 0) {
      alert('No hay actores con horas para exportar en el período seleccionado.');
      return;
    }

    const headers = [
      'UNIVERSIDAD CIENTÍFICA DEL SUR - CLÍNICA DE SIMULACIÓN',
      'PLANILLA CONSOLIDADA DE HONORARIOS DE PACIENTES SIMULADOS (ACTORES)',
      `Período Contable: ${labelPeriodo}`,
      `Fecha de Emisión: ${fechaHoy}`,
      `Presupuesto Total a Pagar: S/. ${kpisPlanilla.totalMontoGral.toFixed(2)}`,
      '',
      'DNI',
      'Apellidos',
      'Nombres',
      'Correo Electrónico',
      'N° Sesiones',
      'Horas Netas (Decimal)',
      'Horas (Formato)',
      'Tarifa Base (S/.)',
      'Cursos y Estaciones Realizadas',
      'TOTAL A PAGAR (S/.)',
      'Estado Liquidación',
    ];

    const rows = actoresPlanilla.map((a) => {
      const detalleCursos = Array.from(a.cursosMap.values())
        .map((c) => `${c.cursoNombre} (${c.horas.toFixed(1)}h × S/.${c.tarifa.toFixed(2)} = S/.${c.subtotal.toFixed(2)})`)
        .join(' | ');

      return [
        a.dni,
        `"${a.apellidos}"`,
        `"${a.nombres}"`,
        `"${a.correo || ''}"`,
        a.totalSesiones,
        a.horasDecimal.toFixed(2),
        `"${a.horasFormato}"`,
        a.tarifaHoraBase ? a.tarifaHoraBase.toFixed(2) : 'Por curso',
        `"${detalleCursos}"`,
        a.totalAPagar.toFixed(2),
        a.estadoPlanilla === 'listo' ? 'Listo para Pago' : 'Turno en Curso',
      ].join(';');
    });

    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows,
      '',
      `"TOTAL GENERAL";"";"";"";${actoresPlanilla.reduce((acc, c) => acc + c.totalSesiones, 0)};${kpisPlanilla.totalHorasDecimal};"${kpisPlanilla.totalHorasFormato}";"";"";${kpisPlanilla.totalMontoGral.toFixed(2)};"Resumen Finanzas"`,
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Planilla_PS_${slugCorte}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 1250,
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
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1200px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER MODAL */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-elevated)',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #ff5a00 0%, #e04f00 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.35rem',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(255, 90, 0, 0.3)',
              }}
            >
              📑
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Planilla de Honorarios PS — Liquidación y Finanzas
                </h2>
                <span
                  style={{
                    background: 'rgba(255, 90, 0, 0.15)',
                    color: '#ff5a00',
                    border: '1px solid rgba(255, 90, 0, 0.3)',
                    padding: '0.15rem 0.55rem',
                    borderRadius: '20px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Cortes Quincenales & Mensuales
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                Cálculo automático para emisión de planillas de Finanzas, Contabilidad y comprobantes RHE
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={handleExportarExcelFinanzas}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '0.55rem 1.15rem',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
              }}
              title={`Exportar planilla de ${labelCorteCorto}`}
            >
              <span>📥</span> Exportar Excel ({labelCorteCorto})
            </button>

            <button
              type="button"
              onClick={handleImprimir}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '0.55rem 0.95rem',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>🖨️</span> Imprimir PDF
            </button>

            <button
              onClick={onClose}
              className={styles.closeBtn}
              style={{ marginLeft: '0.25rem' }}
              title="Cerrar planilla"
            >
              ✕
            </button>
          </div>
        </div>

        {/* BODY */}
        <div style={{ overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* PANEL DE CONTROL DE CORTE CONTABLE (MES + PRESETS QUINCENALES) */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              padding: '1.1rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* FILA SUPERIOR: SELECTOR DE MES + NAVEGACIÓN + PRESETS DE CORTE */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              {/* SELECTOR DE MES CON FLECHAS */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                  Mes Contable:
                </span>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    padding: '0.15rem 0.35rem',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleMesAnterior}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                    }}
                    title="Mes anterior"
                  >
                    ◀
                  </button>

                  <select
                    value={mesSeleccionado}
                    onChange={(e) => setMesSeleccionado(parseInt(e.target.value, 10))}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '0.25rem 0.5rem',
                      outline: 'none',
                    }}
                  >
                    {NOMBRES_MESES.map((m, idx) => (
                      <option key={idx} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={anioSeleccionado}
                    onChange={(e) => setAnioSeleccionado(parseInt(e.target.value, 10))}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '0.25rem 0.5rem',
                      outline: 'none',
                    }}
                  >
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleMesSiguiente}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                    }}
                    title="Mes siguiente"
                  >
                    ▶
                  </button>
                </div>
              </div>

              {/* BOTONERA DE PRESETS DE CORTE CONTABLE (1 CLIC) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                  Corte:
                </span>

                <button
                  type="button"
                  onClick={() => setCorteTipo('mes_completo')}
                  style={{
                    background: corteTipo === 'mes_completo' ? 'var(--ucs-orange)' : 'var(--bg-secondary)',
                    color: corteTipo === 'mes_completo' ? '#ffffff' : 'var(--text-primary)',
                    border: '1px solid',
                    borderColor: corteTipo === 'mes_completo' ? 'var(--ucs-orange)' : 'var(--border-color)',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: corteTipo === 'mes_completo' ? '0 2px 8px rgba(255, 90, 0, 0.35)' : 'none',
                  }}
                >
                  📅 Mes Completo (01 - {new Date(anioSeleccionado, mesSeleccionado + 1, 0).getDate()})
                </button>

                <button
                  type="button"
                  onClick={() => setCorteTipo('quincena_1')}
                  style={{
                    background: corteTipo === 'quincena_1' ? '#0284c7' : 'var(--bg-secondary)',
                    color: corteTipo === 'quincena_1' ? '#ffffff' : 'var(--text-primary)',
                    border: '1px solid',
                    borderColor: corteTipo === 'quincena_1' ? '#0284c7' : 'var(--border-color)',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: corteTipo === 'quincena_1' ? '0 2px 8px rgba(2, 132, 199, 0.35)' : 'none',
                  }}
                >
                  1️⃣ 1ra Quincena (01 - 15)
                </button>

                <button
                  type="button"
                  onClick={() => setCorteTipo('quincena_2')}
                  style={{
                    background: corteTipo === 'quincena_2' ? '#059669' : 'var(--bg-secondary)',
                    color: corteTipo === 'quincena_2' ? '#ffffff' : 'var(--text-primary)',
                    border: '1px solid',
                    borderColor: corteTipo === 'quincena_2' ? '#059669' : 'var(--border-color)',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: corteTipo === 'quincena_2' ? '0 2px 8px rgba(5, 150, 105, 0.35)' : 'none',
                  }}
                >
                  2️⃣ 2da Quincena (16 - {new Date(anioSeleccionado, mesSeleccionado + 1, 0).getDate()})
                </button>

                <button
                  type="button"
                  onClick={() => setCorteTipo('personalizado')}
                  style={{
                    background: corteTipo === 'personalizado' ? '#7c3aed' : 'var(--bg-secondary)',
                    color: corteTipo === 'personalizado' ? '#ffffff' : 'var(--text-primary)',
                    border: '1px solid',
                    borderColor: corteTipo === 'personalizado' ? '#7c3aed' : 'var(--border-color)',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  🎯 Personalizado
                </button>
              </div>
            </div>

            {/* SI SE ELIGIÓ PERSONALIZADO: INPUTS DE FECHA */}
            {corteTipo === 'personalizado' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  background: 'rgba(124, 58, 237, 0.1)',
                  border: '1px solid rgba(124, 58, 237, 0.3)',
                  borderRadius: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '0.78rem', color: '#c4b5fd', fontWeight: 600 }}>
                  Rango Libre para Exámenes ECOE / Campañas:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Desde:</label>
                  <input
                    type="date"
                    value={fechaDesdeManual}
                    onChange={(e) => setFechaDesdeManual(e.target.value)}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      borderRadius: '6px',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.8rem',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Hasta:</label>
                  <input
                    type="date"
                    value={fechaHastaManual}
                    onChange={(e) => setFechaHastaManual(e.target.value)}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      borderRadius: '6px',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.8rem',
                    }}
                  />
                </div>
              </div>
            )}

            {/* MINI COMPARATIVA DE QUINCENAS (RESUMEN EJECUTIVO DEL MES) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '0.65rem',
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '10px',
                padding: '0.65rem 0.9rem',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>1️⃣ 1ra Quincena (01-15):</span>
                <strong style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                  S/. {statsComparativasQuincenas.montoQ1.toFixed(2)} ({statsComparativasQuincenas.sesionesQ1} turnos)
                </strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>2️⃣ 2da Quincena (16-fin):</span>
                <strong style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>
                  S/. {statsComparativasQuincenas.montoQ2.toFixed(2)} ({statsComparativasQuincenas.sesionesQ2} turnos)
                </strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Mes Completo:</span>
                <strong style={{ color: '#ff701e', fontFamily: 'var(--font-mono)' }}>
                  S/. {statsComparativasQuincenas.montoMes.toFixed(2)} ({statsComparativasQuincenas.sesionesMes} turnos)
                </strong>
              </div>
            </div>

            {/* BARRA INFERIOR DE FILTROS EN TABLA */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                paddingTop: '0.35rem',
              }}
            >
              <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                📋 Mostrando: <span style={{ color: 'var(--ucs-orange)' }}>{labelPeriodo}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <input
                  type="text"
                  placeholder="Buscar actor por DNI o nombre..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '8px',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.82rem',
                    minWidth: '230px',
                  }}
                />

                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value as any)}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: '8px',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.82rem',
                  }}
                >
                  <option value="todos">Todos los estados</option>
                  <option value="listo">✅ Listos para pago</option>
                  <option value="en_curso">⚠️ En sala ahora</option>
                </select>
              </div>
            </div>
          </div>

          {/* KPIS DE PLANILLA DEL CORTE ACTIVO */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1rem',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.05) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
              }}
            >
              <div style={{ fontSize: '0.74rem', color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>
                💰 Presupuesto a Liquidar ({labelCorteCorto})
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#10b981', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                S/. {kpisPlanilla.totalMontoGral.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Total devengado en el corte seleccionado
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
              }}
            >
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                🎭 Actores en este Corte
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                {kpisPlanilla.totalActores}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Con marcaciones en este período
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
              }}
            >
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                ⏱️ Horas Netas Computadas
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#38bdf8', marginTop: '0.2rem', fontFamily: 'var(--font-mono)' }}>
                {kpisPlanilla.totalHorasFormato}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {kpisPlanilla.totalHorasDecimal} hrs netas computadas
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
              }}
            >
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                🎓 Cursos y Exámenes ECOE
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#f59e0b', marginTop: '0.2rem' }}>
                {kpisPlanilla.totalCursos}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Estaciones con cobertura en el corte
              </div>
            </div>
          </div>

          {/* TABLA CONSOLIDADA */}
          <div
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              overflow: 'hidden',
              background: 'var(--bg-secondary)',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Paciente Simulado (Actor)</th>
                    <th style={{ padding: '0.85rem 1rem' }}>DNI</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Sesiones</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Cursos Participados en el Corte</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Total Horas</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Tarifa Base</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right', color: '#10b981', fontWeight: 800 }}>Total a Pagar (S/.)</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Estado</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {actoresFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No se encontraron registros de Pacientes Simulados en este corte o filtro ({labelPeriodo}).
                      </td>
                    </tr>
                  ) : (
                    actoresFiltrados.map((actor) => (
                      <tr
                        key={actor.usuarioId}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background 0.15s',
                        }}
                      >
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, rgba(255, 90, 0, 0.2), rgba(255, 90, 0, 0.4))',
                                color: '#ff5a00',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                              }}
                            >
                              {actor.nombres.charAt(0)}{actor.apellidos.charAt(0)}
                            </div>
                            <div>
                              <strong style={{ color: 'var(--text-primary)', display: 'block' }}>
                                {actor.apellidos}, {actor.nombres}
                              </strong>
                              {actor.correo && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {actor.correo}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {actor.dni}
                        </td>

                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 700 }}>
                          {actor.totalSesiones}
                        </td>

                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxWidth: '280px' }}>
                            {Array.from(actor.cursosMap.values()).map((c, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  background: 'rgba(255, 90, 0, 0.1)',
                                  color: 'var(--ucs-orange)',
                                  border: '1px solid rgba(255, 90, 0, 0.25)',
                                  whiteSpace: 'nowrap',
                                }}
                                title={`${c.cursoNombre}: ${c.horas.toFixed(1)}h a S/.${c.tarifa.toFixed(2)}/h = S/.${c.subtotal.toFixed(2)}`}
                              >
                                {c.cursoNombre} ({c.horas.toFixed(1)}h)
                              </span>
                            ))}
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          <strong>{actor.horasFormato}</strong>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {actor.horasDecimal.toFixed(2)} hrs
                          </div>
                        </td>

                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {actor.tarifaHoraBase ? `S/. ${actor.tarifaHoraBase.toFixed(2)}/h` : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Por curso</span>}
                        </td>

                        <td
                          style={{
                            padding: '0.85rem 1rem',
                            textAlign: 'right',
                            fontWeight: 900,
                            fontSize: '1rem',
                            color: '#10b981',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          S/. {actor.totalAPagar.toFixed(2)}
                        </td>

                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          {actor.estadoPlanilla === 'en_curso' ? (
                            <span
                              style={{
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#f59e0b',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '12px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                              }}
                            >
                              ⚠️ En Sala ({actor.sesionesEnCurso})
                            </span>
                          ) : (
                            <span
                              style={{
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '12px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                              }}
                            >
                              ✅ Listo Pago
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (actor.usuarioObj && onOpenKardex) {
                                onOpenKardex(actor.usuarioObj);
                              }
                            }}
                            className={styles.actionBtn}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            title="Abrir Kardex / Ficha 360° individual"
                          >
                            <span>🔍</span> Ficha
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div
          style={{
            padding: '1rem 1.75rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-elevated)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Mostrando <strong>{actoresFiltrados.length}</strong> de <strong>{actoresPlanilla.length}</strong> actores en planilla • Corte: <strong>{labelPeriodo}</strong>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={onClose}
              style={{
                padding: '0.55rem 1.25rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
