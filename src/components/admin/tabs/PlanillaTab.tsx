'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import styles from '@/app/admin/admin.module.css';
import type { AsistenciaAdminItem, UsuarioItem, CursoAdminItem } from '@/types/admin';
import { ModalComprobanteLiquidacion, type DesgloseCursoPS } from '@/components/admin/modals/ModalComprobanteLiquidacion';
import { ModalFichaPacienteSimulado } from '@/components/admin/modals/ModalFichaPacienteSimulado';
import type {
  CastingRangoEdadItem,
  CastingEspecialidadItem,
  CastingRestriccionItem,
} from '@/types/admin';

export interface PlanillaTabProps {
  asistenciasList?: AsistenciaAdminItem[];
  usuariosList?: UsuarioItem[];
  cursosList?: CursoAdminItem[];
  rangosList?: CastingRangoEdadItem[];
  especialidadesList?: CastingEspecialidadItem[];
  restriccionesList?: CastingRestriccionItem[];
  onOpenKardex?: (user: UsuarioItem) => void;
  loading?: boolean;
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
  cursosMap: Map<string, { cursoId: number | null; cursoNombre: string; horas: number; tarifa: number; subtotal: number; sesionesCount: number }>;
  totalAPagar: number;
  estadoPlanilla: 'listo' | 'en_curso';
  usuarioObj?: UsuarioItem;
  asistenciasActor: AsistenciaAdminItem[];
}

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const PlanillaTab: React.FC<PlanillaTabProps> = ({
  asistenciasList: asistenciasProp = [],
  usuariosList = [],
  cursosList = [],
  rangosList: rangosProp = [],
  especialidadesList: especialidadesProp = [],
  restriccionesList: restriccionesProp = [],
  onOpenKardex,
}) => {
  // Año y mes seleccionados (Por defecto Septiembre 2026 para la demostración de los 8 PS)
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(2026);
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(8); // 8 = Septiembre

  // Tipo de corte contable: Mes completo, 1ra Quincena, 2da Quincena o Personalizado
  const [corteTipo, setCorteTipo] = useState<'mes_completo' | 'quincena_1' | 'quincena_2' | 'personalizado'>('mes_completo');
  const [fechaDesdeManual, setFechaDesdeManual] = useState<string>('2026-09-01');
  const [fechaHastaManual, setFechaHastaManual] = useState<string>('2026-09-30');

  // Filtros reactivos
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'listo' | 'en_curso'>('todos');

  // Asistencias cargadas dinámicamente para el período
  const [asistenciasMes, setAsistenciasMes] = useState<AsistenciaAdminItem[]>([]);
  const [loadingMes, setLoadingMes] = useState<boolean>(true);

  // Modal para comprobante individual oficial
  const [actorComprobante, setActorComprobante] = useState<FilaPlanillaActor | null>(null);

  // Modal para Ficha Integral del Paciente Simulado
  const [actorFicha, setActorFicha] = useState<FilaPlanillaActor | null>(null);

  // Catálogos para el perfil de casting
  const [rangosCatalogos, setRangosCatalogos] = useState<CastingRangoEdadItem[]>(rangosProp);
  const [especialidadesCatalogos, setEspecialidadesCatalogos] = useState<CastingEspecialidadItem[]>(especialidadesProp);
  const [restriccionesCatalogos, setRestriccionesCatalogos] = useState<CastingRestriccionItem[]>(restriccionesProp);

  useEffect(() => {
    if (rangosProp.length > 0) setRangosCatalogos(rangosProp);
    if (especialidadesProp.length > 0) setEspecialidadesCatalogos(especialidadesProp);
    if (restriccionesProp.length > 0) setRestriccionesCatalogos(restriccionesProp);

    if (rangosProp.length === 0 || especialidadesProp.length === 0 || restriccionesProp.length === 0) {
      fetch('/api/casting/catalogos')
        .then((res) => res.json())
        .then((data) => {
          if (data.rangos && data.rangos.length > 0) setRangosCatalogos(data.rangos);
          if (data.especialidades && data.especialidades.length > 0) setEspecialidadesCatalogos(data.especialidades);
          if (data.restricciones && data.restricciones.length > 0) setRestriccionesCatalogos(data.restricciones);
        })
        .catch((err) => console.error('Error fetching catalogos casting:', err));
    }
  }, [rangosProp, especialidadesProp, restriccionesProp]);

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
        labelPeriodo: `RANGO PERSONALIZADO (${fechaDesdeManual} AL ${fechaHastaManual})`,
        labelCorteCorto: `Personalizado (${fechaDesdeManual} al ${fechaHastaManual})`,
        slugCorte: `Personalizado_${fechaDesdeManual}_${fechaHastaManual}`,
      };
    }

    // Mes completo
    const fDesde = `${anioSeleccionado}-${mesStr}-01`;
    const fHasta = `${anioSeleccionado}-${mesStr}-${ultimoDiaStr}`;
    return {
      fechaDesdeEfectiva: fDesde,
      fechaHastaEfectiva: fHasta,
      labelPeriodo: `MES COMPLETO DE ${mesNombre.toUpperCase()} ${anioSeleccionado} (01/${mesStr} AL ${ultimoDiaStr}/${mesStr})`,
      labelCorteCorto: `${mesNombre} ${anioSeleccionado}`,
      slugCorte: `${mesNombre}_${anioSeleccionado}`,
    };
  }, [anioSeleccionado, mesSeleccionado, corteTipo, fechaDesdeManual, fechaHastaManual]);

  // Consulta al backend para obtener todas las asistencias de PS en el mes seleccionado
  const cargarAsistenciasMes = useCallback(async () => {
    try {
      setLoadingMes(true);
      const mesStr = String(mesSeleccionado + 1).padStart(2, '0');
      const ultimoDia = new Date(anioSeleccionado, mesSeleccionado + 1, 0).getDate();
      const ultimoDiaStr = String(ultimoDia).padStart(2, '0');

      let fDesde = `${anioSeleccionado}-${mesStr}-01`;
      let fHasta = `${anioSeleccionado}-${mesStr}-${ultimoDiaStr}`;

      if (corteTipo === 'personalizado' && fechaDesdeManual && fechaHastaManual) {
        fDesde = fechaDesdeManual;
        fHasta = fechaHastaManual;
      }

      const res = await fetch(`/api/asistencias?tipoPersonal=paciente_simulado&fechaDesde=${fDesde}&fechaHasta=${fHasta}`);
      if (res.ok) {
        const data = await res.json();
        setAsistenciasMes(data.asistencias || []);
      } else {
        // Fallback a asistenciasProp si la llamada fallara
        setAsistenciasMes(asistenciasProp);
      }
    } catch (err) {
      console.error('Error cargando asistencias para la planilla:', err);
      setAsistenciasMes(asistenciasProp);
    } finally {
      setLoadingMes(false);
    }
  }, [anioSeleccionado, mesSeleccionado, corteTipo, fechaDesdeManual, fechaHastaManual, asistenciasProp]);

  useEffect(() => {
    cargarAsistenciasMes();
  }, [cargarAsistenciasMes]);

  // Métricas comparativas Quincena 1 vs Quincena 2 del mes seleccionado
  const comparativaQuincenal = useMemo(() => {
    const mesStr = String(mesSeleccionado + 1).padStart(2, '0');
    const ultimoDia = new Date(anioSeleccionado, mesSeleccionado + 1, 0).getDate();
    const fQ1Desde = `${anioSeleccionado}-${mesStr}-01`;
    const fQ1Hasta = `${anioSeleccionado}-${mesStr}-15`;
    const fQ2Desde = `${anioSeleccionado}-${mesStr}-16`;
    const fQ2Hasta = `${anioSeleccionado}-${mesStr}-${String(ultimoDia).padStart(2, '0')}`;

    let totalMontoQ1 = 0;
    let totalMontoQ2 = 0;

    for (const a of asistenciasMes) {
      if (a.estado === 'anulado') continue;

      const uInfo = usuariosList.find((u) => u.id === a.usuarioId);
      const tipo = a.tipoPersonal || uInfo?.tipoPersonal;
      if (tipo !== 'paciente_simulado') continue;

      let tarifaSesion: number = 0;
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
      } else if (a.fecha >= fQ2Desde && a.fecha <= fQ2Hasta) {
        totalMontoQ2 += subtotal;
      }
    }

    return {
      montoQ1: totalMontoQ1,
      montoQ2: totalMontoQ2,
      montoMes: totalMontoQ1 + totalMontoQ2,
    };
  }, [asistenciasMes, usuariosList, cursosList, anioSeleccionado, mesSeleccionado]);

  // Consolidación de datos de Pacientes Simulados para el corte actual
  const { actoresPlanilla, kpisPlanilla } = useMemo(() => {
    const map = new Map<number, FilaPlanillaActor>();
    const nowTimestamp = Date.now();

    for (const a of asistenciasMes) {
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
          asistenciasActor: [],
        };
        map.set(a.usuarioId, item);
      }

      item.asistenciasActor.push(a);

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
          cursoId: a.cursoId || null,
          cursoNombre: cNombre,
          horas: horasSesion,
          tarifa: tarifaSesion,
          subtotal: subtotalSesion,
          sesionesCount: 1,
        });
      } else {
        cExistente.horas += horasSesion;
        cExistente.subtotal += subtotalSesion;
        cExistente.sesionesCount++;
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
  }, [asistenciasMes, usuariosList, cursosList, fechaDesdeEfectiva, fechaHastaEfectiva]);

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

  const fechaHoy = new Date().toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Exportación formal a Excel (CSV con membrete institucional para Finanzas)
  const handleExportarExcelFinanzas = () => {
    if (actoresPlanilla.length === 0) {
      alert('No hay actores con horas registradas en el período seleccionado.');
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
    <section className={styles.cardPanel}>
      {/* HEADER DE LA PLANILLA (TÍTULO + ACCIONES DE EXPORTACIÓN) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #ff5a00 0%, #e04f00 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(255, 90, 0, 0.35)',
            }}
          >
            📑
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Planilla Mensual de Pacientes Simulados
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
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '20px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Honorarios & RHE
              </span>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Cálculo automático de horas y honorarios para Finanzas, Contabilidad y emisión de comprobantes individuales
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
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
        </div>
      </div>

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
          marginBottom: '1.25rem',
        }}
      >
        {/* FILA SUPERIOR: SELECTOR DE MES + BOTONERA DE PRESETS */}
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

          {/* BOTONERA DE PRESETS DE CORTE CONTABLE */}
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
                boxShadow: corteTipo === 'personalizado' ? '0 2px 8px rgba(124, 58, 237, 0.35)' : 'none',
              }}
            >
              🛠️ Personalizado
            </button>
          </div>
        </div>

        {/* SI ES RANGO PERSONALIZADO, MOSTRAR INPUTS DE FECHAS */}
        {corteTipo === 'personalizado' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              paddingTop: '0.65rem',
              borderTop: '1px dashed var(--border-color)',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Definir rango manual:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Desde:</span>
              <input
                type="date"
                value={fechaDesdeManual}
                onChange={(e) => setFechaDesdeManual(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Hasta:</span>
              <input
                type="date"
                value={fechaHastaManual}
                onChange={(e) => setFechaHastaManual(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                }}
              />
            </div>
          </div>
        )}

        {/* BANNER INFORMATIVO DEL CORTE ACTIVO */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: '0.55rem 0.85rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            borderLeft: '4px solid #ff5a00',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div>
            Período Activo: <strong style={{ color: 'var(--text-primary)' }}>{labelPeriodo}</strong>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem' }}>
            <span>Q1 (01-15): <strong>S/. {comparativaQuincenal.montoQ1.toFixed(2)}</strong></span>
            <span>•</span>
            <span>Q2 (16-Fin): <strong>S/. {comparativaQuincenal.montoQ2.toFixed(2)}</strong></span>
            <span>•</span>
            <span>Mes Completo: <strong style={{ color: '#10b981' }}>S/. {comparativaQuincenal.montoMes.toFixed(2)}</strong></span>
          </div>
        </div>
      </div>

      {/* TARJETAS DE MÉTRICAS (KPIs) DEL PERÍODO */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.05) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            padding: '1rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            💰 Total Honorarios ({labelCorteCorto})
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            S/. {kpisPlanilla.totalMontoGral.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Presupuesto consolidado a liquidar
          </div>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(2, 132, 199, 0.05) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '12px',
            padding: '1rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ⏱️ Horas Computadas
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {kpisPlanilla.totalHorasFormato}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {kpisPlanilla.totalHorasDecimal} horas efectivas netas
          </div>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, rgba(255, 90, 0, 0.12) 0%, rgba(224, 79, 0, 0.05) 100%)',
            border: '1px solid rgba(255, 90, 0, 0.3)',
            borderRadius: '12px',
            padding: '1rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: '#ff5a00', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🎭 Actores Participantes
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {kpisPlanilla.totalActores}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Pacientes simulados convocados
          </div>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(126, 34, 206, 0.05) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: '12px',
            padding: '1rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: '#a855f7', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            📚 Cursos Impartidos
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {kpisPlanilla.totalCursos}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Escenarios de simulación activa
          </div>
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTROS DE ESTADO */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ flex: '1 1 280px', maxWidth: '450px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre, apellido o DNI..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem 0.55rem 2.25rem',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            type="button"
            className={`${styles.pillBtn} ${filtroEstado === 'todos' ? styles.pillBtnActive : ''}`}
            onClick={() => setFiltroEstado('todos')}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
          >
            Todos ({actoresPlanilla.length})
          </button>
          <button
            type="button"
            className={`${styles.pillBtn} ${filtroEstado === 'listo' ? styles.pillBtnActive : ''}`}
            onClick={() => setFiltroEstado('listo')}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
          >
            ✅ Listos para Pago
          </button>
          <button
            type="button"
            className={`${styles.pillBtn} ${filtroEstado === 'en_curso' ? styles.pillBtnActive : ''}`}
            onClick={() => setFiltroEstado('en_curso')}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
          >
            ⚠️ En Sala ({actoresPlanilla.filter((a) => a.estadoPlanilla === 'en_curso').length})
          </button>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE LA PLANILLA */}
      <div
        className={styles.tableWrapper}
        style={{
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          overflowX: 'auto',
          background: 'var(--bg-card)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        }}
      >
        <table className={styles.table} style={{ width: '100%', minWidth: '1100px', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '0.85rem 0.4rem', textAlign: 'center', width: '40px' }}>#</th>
              <th style={{ padding: '0.85rem 0.85rem', textAlign: 'left', width: '255px' }}>Actor / Paciente Simulado</th>
              <th style={{ padding: '0.85rem 0.85rem', textAlign: 'left' }}>Cursos y Escenarios (Horas × Tarifa)</th>
              <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', width: '105px' }}>Horas Netas</th>
              <th style={{ padding: '0.85rem 0.75rem', textAlign: 'right', width: '125px' }}>Total a Pagar</th>
              <th style={{ padding: '0.85rem 0.5rem', textAlign: 'center', width: '135px' }}>Estado</th>
              <th style={{ padding: '0.85rem 0.75rem', textAlign: 'center', width: '215px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loadingMes ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ fontSize: '1.5rem', animation: 'spin 1s linear infinite' }}>⏳</div>
                    <div>Cargando asistencias y calculando planilla de honorarios...</div>
                  </div>
                </td>
              </tr>
            ) : actoresFiltrados.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎭</div>
                  <div>No se encontraron asistencias de Pacientes Simulados para el corte <strong>{labelCorteCorto}</strong>.</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.35rem', opacity: 0.8 }}>
                    Prueba cambiando el mes con las flechas o seleccionando "Mes Completo".
                  </div>
                </td>
              </tr>
            ) : (
              actoresFiltrados.map((actor, idx) => (
                <tr
                  key={actor.usuarioId}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <td style={{ padding: '0.85rem 0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', verticalAlign: 'middle' }}>
                    {idx + 1}
                  </td>

                  <td style={{ padding: '0.85rem', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #0d346c 0%, #06152d 100%)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          flexShrink: 0,
                          border: '2px solid rgba(255, 90, 0, 0.45)',
                          boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        {actor.nombres.charAt(0)}{actor.apellidos.charAt(0)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.15rem', lineHeight: 1.25 }}>
                          {actor.apellidos}, {actor.nombres}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span>DNI: <strong style={{ color: 'var(--text-secondary)' }}>{actor.dni}</strong></span>
                          <span>•</span>
                          <span>Base: <strong style={{ color: 'var(--ucs-clinical-green, #10b981)' }}>{actor.tarifaHoraBase ? `S/. ${actor.tarifaHoraBase.toFixed(2)}/h` : 'Por curso'}</strong></span>
                        </div>
                        {actor.correo && (
                          <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {actor.correo}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* CURSOS Y ESCENARIOS: GRID BALANCEADO CON TÍTULO COMPLETO Y FÓRMULA CLARA */}
                  <td style={{ padding: '0.85rem', verticalAlign: 'middle' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: actor.cursosMap.size === 1 ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                        gap: '0.45rem',
                        width: '100%',
                      }}
                    >
                      {Array.from(actor.cursosMap.values()).map((c, cIdx) => (
                        <div
                          key={cIdx}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            background: 'var(--bg-secondary)',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            gap: '0.25rem',
                            minWidth: 0,
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                            transition: 'all 0.15s ease',
                          }}
                          title={`${c.cursoNombre}: ${c.horas.toFixed(1)} hrs × S/. ${c.tarifa.toFixed(2)} = S/. ${c.subtotal.toFixed(2)}`}
                        >
                          {/* Nivel 1: Título completo del Curso (Aprovecha el 100% del ancho) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                            <span style={{ fontSize: '0.82rem', flexShrink: 0 }}>🩺</span>
                            <span
                              style={{
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                fontSize: '0.8rem',
                                lineHeight: 1.2,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={c.cursoNombre}
                            >
                              {c.cursoNombre}
                            </span>
                          </div>

                          {/* Nivel 2: Desglose matemático horas × tarifa ➝ subtotal en verde */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.4rem',
                              fontFamily: 'var(--font-mono)',
                              paddingLeft: '1.15rem',
                            }}
                          >
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.73rem' }}>
                              {c.horas.toFixed(1)}h <span style={{ opacity: 0.65 }}>× S/.{c.tarifa.toFixed(0)}/h</span>
                            </span>
                            <strong
                              style={{
                                color: 'var(--ucs-clinical-green, #10b981)',
                                fontSize: '0.82rem',
                                fontWeight: 800,
                              }}
                            >
                              S/. {c.subtotal.toFixed(2)}
                            </strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>

                  <td
                    style={{
                      padding: '0.85rem 0.75rem',
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      verticalAlign: 'middle',
                    }}
                  >
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.96rem' }}>
                      {actor.horasFormato}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      {actor.horasDecimal.toFixed(1)} hrs netas
                    </div>
                  </td>

                  <td
                    style={{
                      padding: '0.85rem 0.75rem',
                      textAlign: 'right',
                      fontWeight: 900,
                      fontSize: '1.15rem',
                      color: 'var(--ucs-clinical-green, #10b981)',
                      fontFamily: 'var(--font-mono)',
                      verticalAlign: 'middle',
                    }}
                  >
                    S/. {actor.totalAPagar.toFixed(2)}
                  </td>

                  {/* ESTADO CON ESPACIO DESAHOGADO Y SEPARACIÓN CLARA */}
                  <td style={{ padding: '0.85rem 0.4rem', textAlign: 'center', verticalAlign: 'middle' }}>
                    {actor.estadoPlanilla === 'en_curso' ? (
                      <span
                        style={{
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#f59e0b',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '12px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          display: 'inline-block',
                          whiteSpace: 'nowrap',
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
                          padding: '0.3rem 0.65rem',
                          borderRadius: '12px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          display: 'inline-block',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ✅ Listo Pago
                      </span>
                    )}
                  </td>

                  {/* ACCIONES: ANCHO SUFICIENTE (215px) PARA QUE NINGÚN BOTÓN SE CORTE NI SE APLASTE */}
                  <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => setActorComprobante(actor)}
                        className={styles.actionBtn}
                        style={{
                          padding: '0.42rem 0.75rem',
                          fontSize: '0.78rem',
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          fontWeight: 700,
                          borderRadius: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          boxShadow: '0 1px 3px rgba(16, 185, 129, 0.15)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                        title="Ver Comprobante de Pre-Liquidación Oficial"
                      >
                        <span>📄</span> Boleta
                      </button>

                      <button
                        type="button"
                        onClick={() => setActorFicha(actor)}
                        className={styles.actionBtn}
                        style={{
                          padding: '0.42rem 0.75rem',
                          fontSize: '0.78rem',
                          background: 'rgba(255, 90, 0, 0.12)',
                          color: '#ff5a00',
                          border: '1px solid rgba(255, 90, 0, 0.35)',
                          fontWeight: 700,
                          borderRadius: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          boxShadow: '0 1px 3px rgba(255, 90, 0, 0.15)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                        title="Abrir Expediente y Ficha Integral del Paciente Simulado"
                      >
                        <span>🔍</span> Ficha
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER INFORMATIVO */}
      <div
        style={{
          marginTop: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
        }}
      >
        <div>
          Mostrando <strong>{actoresFiltrados.length}</strong> de <strong>{actoresPlanilla.length}</strong> actores en nómina • Corte: <strong>{labelPeriodo}</strong>
        </div>

        <div>
          Total General a Pagar: <strong style={{ color: '#10b981', fontSize: '0.95rem' }}>S/. {kpisPlanilla.totalMontoGral.toFixed(2)}</strong>
        </div>
      </div>

      {/* MODAL DE COMPROBANTE OFICIAL INDIVIDUAL */}
      {actorComprobante && (
        <ModalComprobanteLiquidacion
          isOpen={true}
          onClose={() => setActorComprobante(null)}
          usuario={actorComprobante.usuarioObj || null}
          periodoLabel={labelPeriodo}
          desgloseCursos={Array.from(actorComprobante.cursosMap.values()).map((c) => ({
            cursoId: c.cursoId,
            cursoNombre: c.cursoNombre,
            horasDecimal: Number(c.horas.toFixed(2)),
            horasFormato: `${Math.floor(c.horas)}h ${Math.round((c.horas % 1) * 60)}m`,
            tarifaHora: c.tarifa,
            subtotal: Number(c.subtotal.toFixed(2)),
            sesionesCount: c.sesionesCount,
          }))}
          totalHorasDecimal={actorComprobante.horasDecimal}
          totalHorasFormato={actorComprobante.horasFormato}
          totalMonto={actorComprobante.totalAPagar}
          totalSesiones={actorComprobante.totalSesiones}
          asistencias={actorComprobante.asistenciasActor}
        />
      )}
      {actorFicha && (
        <ModalFichaPacienteSimulado
          isOpen={true}
          onClose={() => setActorFicha(null)}
          actor={actorFicha}
          periodoLabel={labelPeriodo}
          rangosList={rangosCatalogos}
          especialidadesList={especialidadesCatalogos}
          restriccionesList={restriccionesCatalogos}
        />
      )}
    </section>
  );
};
