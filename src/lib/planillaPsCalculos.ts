import type { AsistenciaAdminItem, CursoAdminItem, UsuarioItem, SesionProgramadaSimclicItem } from '@/types/admin';
import { getMinutosLima } from '@/lib/simclicAudit';

/**
 * Resuelve la tarifa horaria para un curso de paciente simulado:
 * 1. Tarifa específica del curso en el padrón (`cFound.tarifaHoraPs`).
 * 2. Si el curso es de Ecografía (ej. 'Ecografía', 'Diplomado de Ecografía'): S/. 15.00/h.
 * 3. Tarifa base del usuario (`tarifaUsuarioBase` si es > 0).
 * 4. Tarifa general institucional por defecto: S/. 25.00/h.
 */
export function resolverTarifaPs(
  cursoId: number | null | undefined,
  cursoNombre: string | null | undefined,
  cursoTarifaHoraPs: string | number | null | undefined,
  tarifaUsuarioBase: number | null | undefined,
  cursosList: CursoAdminItem[] = []
): number {
  if (cursoTarifaHoraPs !== undefined && cursoTarifaHoraPs !== null && cursoTarifaHoraPs !== '') {
    const val = Number(cursoTarifaHoraPs);
    if (!isNaN(val) && val > 0) return val;
  }

  if (cursoId) {
    const cFound = cursosList.find((c) => c.id === cursoId);
    if (cFound?.tarifaHoraPs !== undefined && cFound?.tarifaHoraPs !== null && cFound?.tarifaHoraPs !== '') {
      const val = Number(cFound.tarifaHoraPs);
      if (!isNaN(val) && val > 0) return val;
    }
  }

  // Comprobar si el curso corresponde a Ecografía
  const cNorm = (cursoNombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (cNorm.includes('ecograf')) {
    return 15;
  }

  // Tarifa base del usuario
  if (tarifaUsuarioBase && !isNaN(tarifaUsuarioBase) && tarifaUsuarioBase > 0) {
    return tarifaUsuarioBase;
  }

  // Tarifa institucional por defecto para cualquier otro curso
  return 25;
}

export interface BloqueLiquidadoPS {
  cursoId: number | null;
  cursoNombre: string;
  cursoCodigo: string | null;
  horaInicio: string;
  horaFin: string;
  minutosPresencia: number;
  horasDecimal: number;
  tarifa: number;
  subtotal: number;
}

export interface CalculoAsistenciaPSResult {
  asistenciaId: number;
  fecha: string;
  minutosFisicos: number;
  minutosEfectivos: number;
  minutosDescontadosVentana: number;
  horasEfectivasDecimal: number;
  horasEfectivasFormato: string;
  horasDescontadasFormato: string;
  bloques: BloqueLiquidadoPS[];
  totalAPagar: number;
  tieneVentanasSimclic: boolean;
  esMultiCurso: boolean;
}

/**
 * Calcula las horas efectivas y la liquidación de una asistencia individual de Paciente Simulado,
 * aplicando la regla académica de SimClic:
 * - Si el colaborador tiene sesiones oficiales en SimClic, computa la presencia en cada bloque.
 * - Descarta automáticamente ventanas libres / recesos no lectivos entre bloques.
 * - Aplica la tarifa respectiva de cada curso (S/. 15 para Ecografía, S/. 25 para cursos generales).
 * - Si no cuenta con sesiones en SimClic, liquida sobre la permanencia física en Kiosco.
 */
export function calcularHorasEfectivasSesion(
  asist: AsistenciaAdminItem,
  cursosList: CursoAdminItem[] = [],
  tarifaUsuarioBase?: number | null,
  modoCalculo: 'simclic_efectivo' | 'permanencia_fisica' = 'simclic_efectivo'
): CalculoAsistenciaPSResult {
  const ingresoMins = getMinutosLima(asist.horaIngreso);

  let salidaMins: number;
  if (asist.horaSalida) {
    salidaMins = getMinutosLima(asist.horaSalida);
  } else {
    // Si la sesión está en curso, computamos contra el reloj de Lima
    const nowLima = getMinutosLima(new Date().toISOString());
    salidaMins = nowLima > ingresoMins ? nowLima : ingresoMins + (asist.minutosTotales || 0);
  }

  const minutosFisicos = asist.minutosTotales && asist.minutosTotales > 0
    ? asist.minutosTotales
    : Math.max(1, salidaMins - ingresoMins);

  const sesionesValidas = (asist.sesionesProgramadasDia || []).filter(
    (s) => Boolean(s.horaInicio && s.horaFin)
  );

  // Si se solicita permanencia física o no hay programación académica, calculamos bruto
  if (modoCalculo === 'permanencia_fisica' || sesionesValidas.length === 0) {
    const cursoId = asist.cursoId || null;
    const cursoNombre = asist.cursoNombre || 'Simulación General';
    const cursoCodigo = asist.cursoCodigo || null;
    const tarifa = resolverTarifaPs(cursoId, cursoNombre, asist.cursoTarifaHoraPs, tarifaUsuarioBase, cursosList);
    const horasDecimal = Number((minutosFisicos / 60).toFixed(2));
    const subtotal = Number((horasDecimal * tarifa).toFixed(2));

    const h = Math.floor(minutosFisicos / 60);
    const m = minutosFisicos % 60;

    return {
      asistenciaId: asist.id,
      fecha: asist.fecha,
      minutosFisicos,
      minutosEfectivos: minutosFisicos,
      minutosDescontadosVentana: 0,
      horasEfectivasDecimal: horasDecimal,
      horasEfectivasFormato: `${h}h ${m}m`,
      horasDescontadasFormato: '0h 0m',
      bloques: [
        {
          cursoId,
          cursoNombre,
          cursoCodigo,
          horaInicio: asist.horaIngreso,
          horaFin: asist.horaSalida || '',
          minutosPresencia: minutosFisicos,
          horasDecimal,
          tarifa,
          subtotal,
        },
      ],
      totalAPagar: subtotal,
      tieneVentanasSimclic: false,
      esMultiCurso: false,
    };
  }

  // MODO 'simclic_efectivo': Evaluación bloque a bloque
  const sesionesOrdenadas = [...sesionesValidas].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  const bloquesLiquidados: BloqueLiquidadoPS[] = [];

  for (const ses of sesionesOrdenadas) {
    let bIniMins = 0;
    let bFinMins = 0;
    try {
      const [iH, iM] = ses.horaInicio.split(':').map(Number);
      const [fH, fM] = ses.horaFin.split(':').map(Number);
      bIniMins = iH * 60 + iM;
      bFinMins = fH * 60 + fM;
    } catch {
      continue;
    }

    const duracionBloque = Math.max(0, bFinMins - bIniMins);
    if (duracionBloque === 0) continue;

    // Presencia efectiva en la ventana lectiva del bloque
    const solapamientoIni = Math.max(ingresoMins, bIniMins);
    const solapamientoFin = Math.min(salidaMins, bFinMins);
    let minutosPresencia = Math.max(0, solapamientoFin - solapamientoIni);
    minutosPresencia = Math.min(duracionBloque, minutosPresencia);

    if (minutosPresencia > 0) {
      const cursoId = ses.cursoId || asist.cursoId || null;
      const cursoNombre = ses.cursoNombreSimclic || asist.cursoNombre || 'Simulación General';
      const cursoCodigo = ses.cursoCodigoSimclic || asist.cursoCodigo || null;
      const tarifa = resolverTarifaPs(cursoId, cursoNombre, asist.cursoTarifaHoraPs, tarifaUsuarioBase, cursosList);
      const horasDecimal = Number((minutosPresencia / 60).toFixed(2));
      const subtotal = Number((horasDecimal * tarifa).toFixed(2));

      bloquesLiquidados.push({
        cursoId,
        cursoNombre,
        cursoCodigo,
        horaInicio: ses.horaInicio,
        horaFin: ses.horaFin,
        minutosPresencia,
        horasDecimal,
        tarifa,
        subtotal,
      });
    }
  }

  const minutosEfectivos = bloquesLiquidados.reduce((acc, b) => acc + b.minutosPresencia, 0);

  // Fallback de seguridad: si los bloques no tuvieron solapamiento pero el usuario asistió
  if (minutosEfectivos === 0 && minutosFisicos > 0) {
    const cursoId = asist.cursoId || null;
    const cursoNombre = asist.cursoNombre || 'Simulación General';
    const cursoCodigo = asist.cursoCodigo || null;
    const tarifa = resolverTarifaPs(cursoId, cursoNombre, asist.cursoTarifaHoraPs, tarifaUsuarioBase, cursosList);
    const horasDecimal = Number((minutosFisicos / 60).toFixed(2));
    const subtotal = Number((horasDecimal * tarifa).toFixed(2));

    const h = Math.floor(minutosFisicos / 60);
    const m = minutosFisicos % 60;

    return {
      asistenciaId: asist.id,
      fecha: asist.fecha,
      minutosFisicos,
      minutosEfectivos: minutosFisicos,
      minutosDescontadosVentana: 0,
      horasEfectivasDecimal: horasDecimal,
      horasEfectivasFormato: `${h}h ${m}m`,
      horasDescontadasFormato: '0h 0m',
      bloques: [
        {
          cursoId,
          cursoNombre,
          cursoCodigo,
          horaInicio: asist.horaIngreso,
          horaFin: asist.horaSalida || '',
          minutosPresencia: minutosFisicos,
          horasDecimal,
          tarifa,
          subtotal,
        },
      ],
      totalAPagar: subtotal,
      tieneVentanasSimclic: false,
      esMultiCurso: false,
    };
  }

  const minutosDescontadosVentana = Math.max(0, minutosFisicos - minutosEfectivos);
  const totalAPagar = Number(bloquesLiquidados.reduce((acc, b) => acc + b.subtotal, 0).toFixed(2));

  const hEf = Math.floor(minutosEfectivos / 60);
  const mEf = minutosEfectivos % 60;
  const hDesc = Math.floor(minutosDescontadosVentana / 60);
  const mDesc = minutosDescontadosVentana % 60;

  const cursosDistintos = new Set(bloquesLiquidados.map((b) => b.cursoNombre));

  return {
    asistenciaId: asist.id,
    fecha: asist.fecha,
    minutosFisicos,
    minutosEfectivos,
    minutosDescontadosVentana,
    horasEfectivasDecimal: Number((minutosEfectivos / 60).toFixed(2)),
    horasEfectivasFormato: `${hEf}h ${mEf}m`,
    horasDescontadasFormato: `${hDesc}h ${mDesc}m`,
    bloques: bloquesLiquidados,
    totalAPagar,
    tieneVentanasSimclic: minutosDescontadosVentana > 0,
    esMultiCurso: cursosDistintos.size > 1,
  };
}

