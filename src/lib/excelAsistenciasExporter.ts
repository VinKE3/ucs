import ExcelJS from 'exceljs';
import type { AsistenciaAdminItem, ResumenColaboradorItem } from '@/types/admin';

interface EvaluacionSimclicResultado {
  etiqueta: string;
  porcentajeTotal: number;
  totalSesiones: number;
  bloquesCubiertos: number;
  bloquesDesatendidos: number;
  diffMinutos: number;
  retiroAnticipadoMinutos: number;
  discrepanciaSala: boolean;
  bloquesEvaluados: Array<{
    idx: number;
    sesion: {
      horaInicio: string;
      horaFin: string;
      ambienteNombreSimclic?: string | null;
    };
    estado: string;
    porcentajeCobertura: number;
  }>;
}

interface ExportarAsistenciasOptions {
  asistencias: AsistenciaAdminItem[];
  resumenColaboradores: ResumenColaboradorItem[];
  evaluarCumplimientoSimclic?: (asist: AsistenciaAdminItem) => EvaluacionSimclicResultado;
  filtroFechaDesde?: string;
  filtroFechaHasta?: string;
  filtroSedeNombre?: string;
  filtroRolNombre?: string;
}

/**
 * Genera un gráfico de Dona con la distribución de horas por Rol de personal en Canvas.
 */
function generarGraficoDonaRoles(
  roles: Array<{ rol: string; horas: number; label: string; color: string }>
): string {
  if (typeof window === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 620;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Distribución de Horas Efectivas por Rol Clínico', 20, 30);

  const totalHoras = roles.reduce((sum, r) => sum + r.horas, 0);
  if (totalHoras === 0) {
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Sin horas registradas en el período', 20, 80);
    return canvas.toDataURL('image/png');
  }

  const centerX = 160;
  const centerY = 165;
  const outerRadius = 100;
  const innerRadius = 55;

  let startAngle = -Math.PI / 2;

  roles.forEach((r) => {
    if (r.horas <= 0) return;
    const sliceAngle = (r.horas / totalHoras) * (2 * Math.PI);
    const endAngle = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
    ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = r.color;
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    startAngle = endAngle;
  });

  // Centro
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(totalHoras)}h`, centerX, centerY - 6);

  ctx.font = '10px Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('TOTAL HORAS', centerX, centerY + 14);

  // Leyenda
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let legendY = 70;

  roles.forEach((r) => {
    const pct = Math.round((r.horas / totalHoras) * 100);

    ctx.fillStyle = r.color;
    ctx.fillRect(320, legendY - 12, 14, 14);

    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(r.label, 342, legendY);

    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${r.horas.toFixed(1)} hrs (${pct}%)`, 342, legendY + 14);

    legendY += 36;
  });

  return canvas.toDataURL('image/png');
}

/**
 * Genera un gráfico de Barras con las horas asistidas por Campus / Sede.
 */
function generarGraficoBarrasSedes(
  sedes: Array<{ nombre: string; horas: number; turnos: number }>
): string {
  if (typeof window === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 620;
  canvas.height = 280;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Volumen de Horas Clínicas por Campus / Sede', 20, 30);

  const maxHoras = Math.max(...sedes.map((s) => s.horas), 1);
  const startY = 65;
  const barHeight = 28;
  const gap = 24;
  const maxBarWidth = 340;
  const labelX = 20;
  const barStartX = 160;

  const colores = ['#0d346c', '#ff5a00', '#10b981', '#0284c7'];

  sedes.forEach((s, idx) => {
    const y = startY + idx * (barHeight + gap);
    const barWidth = Math.max(10, (s.horas / maxHoras) * maxBarWidth);

    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'left';
    ctx.fillText(s.nombre, labelX, y + 18);

    ctx.fillStyle = colores[idx % colores.length];
    ctx.beginPath();
    ctx.roundRect(barStartX, y, barWidth, barHeight, 6);
    ctx.fill();

    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`${s.horas.toFixed(1)}h (${s.turnos} turnos)`, barStartX + barWidth + 10, y + 18);
  });

  return canvas.toDataURL('image/png');
}

/**
 * Exporta el Historial de Asistencias a Microsoft Excel (.xlsx) con:
 * - Hoja 1: Dashboard Ejecutivo & Gráficos Incrustados
 * - Hoja 2: Resumen por Colaborador
 * - Hoja 3: Turnos Auditados (Detalle Completo + SimClic)
 */
export async function exportarExcelAsistenciasConGraficos({
  asistencias,
  resumenColaboradores,
  evaluarCumplimientoSimclic,
  filtroFechaDesde,
  filtroFechaHasta,
  filtroSedeNombre = 'Todas las Sedes',
  filtroRolNombre = 'Todos los Roles',
}: ExportarAsistenciasOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Control de Asistencias UCS';
  workbook.lastModifiedBy = 'Coordinación de Simulación Clínica';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Cálculos globales
  const totalTurnos = asistencias.length;
  const totalMinutos = asistencias.reduce((sum, a) => sum + (a.minutosTotales || 0), 0);
  const totalHorasDecimal = (totalMinutos / 60).toFixed(1);
  const totalHorasFormato = `${Math.floor(totalMinutos / 60)}h ${totalMinutos % 60}m`;
  const promedioTurnoHoras = totalTurnos > 0 ? (totalMinutos / totalTurnos / 60).toFixed(1) : '0';
  const colaboradoresCount = resumenColaboradores.length;

  // Agrupar por rol
  const horasPorRol: Record<string, { horas: number; label: string; color: string; turnos: number; count: number }> = {
    docente: { horas: 0, label: '👨‍⚕️ Docentes', color: '#ff5a00', turnos: 0, count: 0 },
    tecnico: { horas: 0, label: '🔧 Técnicos de Simulación', color: '#10b981', turnos: 0, count: 0 },
    paciente_simulado: { horas: 0, label: '🎭 Pacientes Simulados', color: '#0284c7', turnos: 0, count: 0 },
    administrativo: { horas: 0, label: '📋 Administrativos', color: '#8b5cf6', turnos: 0, count: 0 },
  };

  resumenColaboradores.forEach((r) => {
    const rolKey = r.tipoPersonal || 'docente';
    if (!horasPorRol[rolKey]) {
      horasPorRol[rolKey] = { horas: 0, label: rolKey, color: '#64748b', turnos: 0, count: 0 };
    }
    horasPorRol[rolKey].horas += r.minutosTotales / 60;
    horasPorRol[rolKey].turnos += r.totalSesiones;
    horasPorRol[rolKey].count++;
  });

  // Agrupar por sede
  const horasPorSedeMap = new Map<string, { nombre: string; horas: number; turnos: number }>();
  asistencias.forEach((a) => {
    const sNombre = a.sedeNombre || 'Campus General';
    const mins = a.minutosTotales || 0;
    const existing = horasPorSedeMap.get(sNombre);
    if (!existing) {
      horasPorSedeMap.set(sNombre, { nombre: sNombre, horas: mins / 60, turnos: 1 });
    } else {
      existing.horas += mins / 60;
      existing.turnos++;
    }
  });
  const sedesDistribucion = Array.from(horasPorSedeMap.values()).sort((a, b) => b.horas - a.horas);

  // =========================================================================
  // HOJA 1: DASHBOARD EJECUTIVO & GRÁFICOS
  // =========================================================================
  const wsDash = workbook.addWorksheet('Dashboard Ejecutivo', {
    views: [{ showGridLines: true }],
  });

  wsDash.columns = [
    { width: 4 },  // A
    { width: 26 }, // B
    { width: 14 }, // C
    { width: 16 }, // D
    { width: 16 }, // E
    { width: 18 }, // F
    { width: 14 }, // G
    { width: 16 }, // H
    { width: 14 }, // I
    { width: 4 },  // J
    { width: 45 }, // K
    { width: 45 }, // L
  ];

  // 1. Título
  wsDash.mergeCells('B2:I2');
  const cellTitulo = wsDash.getCell('B2');
  cellTitulo.value = 'UNIVERSIDAD CIENTÍFICA DEL SUR — REPORTE EJECUTIVO Y AUDITORÍA DE ASISTENCIAS';
  cellTitulo.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cellTitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D346C' } };
  cellTitulo.alignment = { vertical: 'middle', horizontal: 'center' };
  wsDash.getRow(2).height = 34;

  // 2. Subtítulo
  wsDash.mergeCells('B3:I3');
  const cellSub = wsDash.getCell('B3');
  const rangoTexto = (filtroFechaDesde || filtroFechaHasta)
    ? `Desde: ${filtroFechaDesde || 'Inicio'}  Hasta: ${filtroFechaHasta || 'Fin'}`
    : 'Período Completo';
  cellSub.value = `Filtros: ${rangoTexto}  |  Sede: ${filtroSedeNombre}  |  Rol: ${filtroRolNombre}  |  Emitido: ${new Date().toLocaleString('es-PE')}`;
  cellSub.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF06152D' } };
  cellSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  cellSub.alignment = { vertical: 'middle', horizontal: 'center' };
  wsDash.getRow(3).height = 24;

  // 3. Tarjetas KPI
  const kpisItems = [
    {
      colStart: 'B',
      colEnd: 'C',
      label: 'TOTAL DE TURNOS REGISTRADOS',
      val: `${totalTurnos} Turnos`,
      bg: 'FFDBEAFE',
      border: 'FF0284C7',
      textCol: 'FF0369A1',
    },
    {
      colStart: 'D',
      colEnd: 'E',
      label: 'HORAS EFECTIVAS TOTALES',
      val: totalHorasFormato,
      bg: 'FFDCFCE7',
      border: 'FF10B981',
      textCol: 'FF16A34A',
    },
    {
      colStart: 'F',
      colEnd: 'G',
      label: 'PERSONAL CON ASISTENCIA',
      val: `${colaboradoresCount} Personas`,
      bg: 'FFFFEDD5',
      border: 'FFFF5A00',
      textCol: 'FFC2410C',
    },
    {
      colStart: 'H',
      colEnd: 'I',
      label: 'DURACIÓN PROMEDIO / TURNO',
      val: `${promedioTurnoHoras} hrs`,
      bg: 'FFF3E8FF',
      border: 'FF8B5CF6',
      textCol: 'FF7E22CE',
    },
  ];

  kpisItems.forEach((k) => {
    wsDash.mergeCells(`${k.colStart}5:${k.colEnd}5`);
    const lbl = wsDash.getCell(`${k.colStart}5`);
    lbl.value = k.label;
    lbl.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF475569' } };
    lbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k.bg } };
    lbl.alignment = { vertical: 'middle', horizontal: 'center' };

    wsDash.mergeCells(`${k.colStart}6:${k.colEnd}6`);
    const val = wsDash.getCell(`${k.colStart}6`);
    val.value = k.val;
    val.font = { name: 'Arial', size: 14, bold: true, color: { argb: k.textCol } };
    val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k.bg } };
    val.alignment = { vertical: 'middle', horizontal: 'center' };

    ['5', '6'].forEach((r) => {
      [k.colStart, k.colEnd].forEach((c) => {
        const cell = wsDash.getCell(`${c}${r}`);
        cell.border = {
          top: { style: 'thin', color: { argb: k.border } },
          left: { style: 'thin', color: { argb: k.border } },
          bottom: { style: 'thin', color: { argb: k.border } },
          right: { style: 'thin', color: { argb: k.border } },
        };
      });
    });
  });

  wsDash.getRow(5).height = 18;
  wsDash.getRow(6).height = 28;

  // 4. Tabla de Distribución por Rol
  let currentY = 8;
  wsDash.mergeCells(`B${currentY}:F${currentY}`);
  const hRol = wsDash.getCell(`B${currentY}`);
  hRol.value = '👥 DISTRIBUCIÓN DE ASISTENCIA POR ROL DE PERSONAL';
  hRol.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  hRol.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D346C' } };
  hRol.alignment = { vertical: 'middle' };
  wsDash.getRow(currentY).height = 24;

  currentY++;
  wsDash.getCell(`B${currentY}`).value = 'Rol Clínico';
  wsDash.getCell(`C${currentY}`).value = 'Colaboradores';
  wsDash.getCell(`D${currentY}`).value = 'Turnos';
  wsDash.getCell(`E${currentY}`).value = 'Horas Efectivas';
  wsDash.getCell(`F${currentY}`).value = '% de Carga';

  ['B', 'C', 'D', 'E', 'F'].forEach((c) => {
    const cell = wsDash.getCell(`${c}${currentY}`);
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: c === 'B' ? 'left' : 'center' };
  });
  wsDash.getRow(currentY).height = 20;

  const totalHorasNum = Number(totalHorasDecimal) > 0 ? Number(totalHorasDecimal) : 1;
  Object.values(horasPorRol).forEach((r) => {
    currentY++;
    const pct = Math.round((r.horas / totalHorasNum) * 100);
    wsDash.getCell(`B${currentY}`).value = r.label;
    wsDash.getCell(`C${currentY}`).value = r.count;
    wsDash.getCell(`D${currentY}`).value = r.turnos;
    wsDash.getCell(`E${currentY}`).value = Number(r.horas.toFixed(1));
    wsDash.getCell(`F${currentY}`).value = `${pct}%`;

    ['B', 'C', 'D', 'E', 'F'].forEach((col) => {
      const cell = wsDash.getCell(`${col}${currentY}`);
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: col === 'B' ? 'left' : 'center' };
    });
    wsDash.getRow(currentY).height = 19;
  });

  // 5. Tabla por Campus
  currentY += 2;
  wsDash.mergeCells(`B${currentY}:F${currentY}`);
  const hSede = wsDash.getCell(`B${currentY}`);
  hSede.value = '📍 VOLUMEN DE HORAS POR CAMPUS / SEDE';
  hSede.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  hSede.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF5A00' } };
  hSede.alignment = { vertical: 'middle' };
  wsDash.getRow(currentY).height = 24;

  currentY++;
  wsDash.getCell(`B${currentY}`).value = 'Campus / Sede';
  wsDash.getCell(`C${currentY}`).value = 'Turnos';
  wsDash.getCell(`D${currentY}`).value = 'Horas (Dec)';
  wsDash.getCell(`E${currentY}`).value = '% del Total';
  wsDash.getCell(`F${currentY}`).value = 'Estado Operativo';

  ['B', 'C', 'D', 'E', 'F'].forEach((c) => {
    const cell = wsDash.getCell(`${c}${currentY}`);
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: c === 'B' ? 'left' : 'center' };
  });
  wsDash.getRow(currentY).height = 20;

  sedesDistribucion.forEach((s) => {
    currentY++;
    const pct = Math.round((s.horas / totalHorasNum) * 100);
    wsDash.getCell(`B${currentY}`).value = s.nombre;
    wsDash.getCell(`C${currentY}`).value = s.turnos;
    wsDash.getCell(`D${currentY}`).value = Number(s.horas.toFixed(1));
    wsDash.getCell(`E${currentY}`).value = `${pct}%`;
    wsDash.getCell(`F${currentY}`).value = s.turnos > 0 ? '🟢 Activa' : '⚪ Sin Actividad';

    ['B', 'C', 'D', 'E', 'F'].forEach((col) => {
      const cell = wsDash.getCell(`${col}${currentY}`);
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: col === 'B' ? 'left' : 'center' };
    });
    wsDash.getRow(currentY).height = 19;
  });

  // 6. Generar e incrustar Gráficos en la Hoja 1
  try {
    const rolesArray = Object.entries(horasPorRol).map(([key, val]) => ({
      rol: key,
      horas: val.horas,
      label: val.label,
      color: val.color,
    }));
    const donaPng = generarGraficoDonaRoles(rolesArray);
    if (donaPng) {
      const img1 = workbook.addImage({ base64: donaPng, extension: 'png' });
      wsDash.addImage(img1, {
        tl: { col: 7, row: 7 },
        ext: { width: 560, height: 270 },
      });
    }

    const barrasPng = generarGraficoBarrasSedes(sedesDistribucion);
    if (barrasPng) {
      const img2 = workbook.addImage({ base64: barrasPng, extension: 'png' });
      wsDash.addImage(img2, {
        tl: { col: 7, row: 22 },
        ext: { width: 560, height: 250 },
      });
    }
  } catch (err) {
    console.warn('No se pudieron incrustar los gráficos de asistencias en Excel:', err);
  }

  // =========================================================================
  // HOJA 2: RESUMEN POR COLABORADOR
  // =========================================================================
  const wsResumen = workbook.addWorksheet('Resumen por Colaborador', {
    views: [{ showGridLines: true }],
  });

  wsResumen.columns = [
    { header: '#', key: 'num', width: 6 },
    { header: 'DNI', key: 'dni', width: 12 },
    { header: 'Apellidos', key: 'apellidos', width: 22 },
    { header: 'Nombres', key: 'nombres', width: 22 },
    { header: 'Rol', key: 'rol', width: 16 },
    { header: 'Turno Programado', key: 'turnoProg', width: 18 },
    { header: 'Días Asistidos', key: 'dias', width: 14 },
    { header: 'Total Turnos', key: 'turnos', width: 13 },
    { header: 'Horas (Decimal)', key: 'horasDec', width: 15 },
    { header: 'Horas (hh:mm)', key: 'horasFmt', width: 15 },
    { header: 'Tardanza (min)', key: 'tardanza', width: 15 },
    { header: 'Sobretiempo (min)', key: 'extra', width: 16 },
    { header: 'Tope Semanal', key: 'tope', width: 14 },
    { header: 'Tarifa (S/.)', key: 'tarifa', width: 14 },
    { header: 'Monto Estimado PS (S/.)', key: 'montoPs', width: 22 },
    { header: 'Cursos Participados', key: 'cursos', width: 40 },
  ];

  const headerResumen = wsResumen.getRow(1);
  headerResumen.height = 28;
  headerResumen.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D346C' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  resumenColaboradores.forEach((r, idx) => {
    const turnoProg = (r.tipoPersonal === 'tecnico' || r.tipoPersonal === 'administrativo')
      ? (r.horaEntradaEsperada ? `${r.horaEntradaEsperada} - ${r.horaSalidaEsperada || '--:--'}` : '06:00 - 15:00')
      : 'N/A';

    const row = wsResumen.addRow({
      num: idx + 1,
      dni: r.dni,
      apellidos: r.apellidos,
      nombres: r.nombres,
      rol: r.tipoPersonal.toUpperCase(),
      turnoProg,
      dias: r.diasTrabajados,
      turnos: r.totalSesiones,
      horasDec: Number((r.minutosTotales / 60).toFixed(2)),
      horasFmt: r.horasTotalesFormato,
      tardanza: (r.tipoPersonal === 'tecnico' || r.tipoPersonal === 'administrativo') ? r.minutosTardanzaTotales : '—',
      extra: (r.tipoPersonal === 'tecnico' || r.tipoPersonal === 'administrativo') ? r.minutosExtraTotales : '—',
      tope: r.horasSemanalesMax ? `${r.horasSemanalesMax} hrs` : 'Sin tope',
      tarifa: r.tarifaHora ? Number(r.tarifaHora) : '—',
      montoPs: r.montoLiquidacionEstimado !== null && r.montoLiquidacionEstimado !== undefined ? r.montoLiquidacionEstimado : '—',
      cursos: r.cursosParticipados.join(', ') || '—',
    });

    row.height = 20;

    if (typeof r.montoLiquidacionEstimado === 'number') {
      row.getCell('montoPs').numFmt = '"S/." #,##0.00';
    }

    row.getCell('num').alignment = { horizontal: 'center' };
    row.getCell('dni').alignment = { horizontal: 'center' };
    row.getCell('rol').alignment = { horizontal: 'center' };
    row.getCell('turnoProg').alignment = { horizontal: 'center' };
    row.getCell('dias').alignment = { horizontal: 'center' };
    row.getCell('turnos').alignment = { horizontal: 'center' };
    row.getCell('horasDec').alignment = { horizontal: 'center' };
    row.getCell('horasFmt').alignment = { horizontal: 'center' };
    row.getCell('tardanza').alignment = { horizontal: 'center' };
    row.getCell('extra').alignment = { horizontal: 'center' };
    row.getCell('tope').alignment = { horizontal: 'center' };
    row.getCell('tarifa').alignment = { horizontal: 'center' };
    row.getCell('montoPs').alignment = { horizontal: 'right' };

    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  wsResumen.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 16 },
  };

  // =========================================================================
  // HOJA 3: TURNOS AUDITADOS (DETALLADO COMPLETO + SIMCLIC)
  // =========================================================================
  const wsTurnos = workbook.addWorksheet('Turnos Auditados', {
    views: [{ showGridLines: true }],
  });

  wsTurnos.columns = [
    { header: '#', key: 'num', width: 6 },
    { header: 'Fecha', key: 'fecha', width: 13 },
    { header: 'DNI', key: 'dni', width: 12 },
    { header: 'Apellidos', key: 'apellidos', width: 22 },
    { header: 'Nombres', key: 'nombres', width: 22 },
    { header: 'Rol', key: 'rol', width: 14 },
    { header: 'Campus / Sede', key: 'sede', width: 16 },
    { header: 'Sala / Ambiente', key: 'sala', width: 22 },
    { header: 'Curso / Asignatura', key: 'curso', width: 28 },
    { header: 'Ingreso', key: 'ingreso', width: 12 },
    { header: 'Salida', key: 'salida', width: 12 },
    { header: 'Horas (Dec)', key: 'horasDec', width: 13 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Diagnóstico SimClic', key: 'diagnostico', width: 24 },
    { header: 'Cobertura Bloques', key: 'cobertura', width: 20 },
    { header: 'Tardanza (min)', key: 'tardanza', width: 15 },
    { header: 'Retiro Anticipado', key: 'retiro', width: 16 },
    { header: 'Cambio Sala', key: 'cambioSala', width: 14 },
    { header: 'Observaciones / Justificación', key: 'obs', width: 35 },
  ];

  const headerTurnos = wsTurnos.getRow(1);
  headerTurnos.height = 28;
  headerTurnos.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D346C' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  asistencias.forEach((a, idx) => {
    const evalSim = evaluarCumplimientoSimclic ? evaluarCumplimientoSimclic(a) : null;
    const dIng = new Date(a.horaIngreso);
    const hIngStr = dIng.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });
    const hSalStr = a.horaSalida
      ? new Date(a.horaSalida).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })
      : 'En curso';

    const diagTexto = evalSim ? evalSim.etiqueta.replace(/[^\w\s\(\)\:\-\+\/\,\.]/gi, '').trim() : 'N/A';
    const coberturaTexto = evalSim && evalSim.totalSesiones > 0
      ? `${evalSim.bloquesCubiertos}/${evalSim.totalSesiones} (${evalSim.porcentajeTotal}%)`
      : 'N/A';

    const row = wsTurnos.addRow({
      num: idx + 1,
      fecha: a.fecha,
      dni: a.dni,
      apellidos: a.apellidos,
      nombres: a.nombres,
      rol: a.tipoPersonal.toUpperCase(),
      sede: a.sedeNombre,
      sala: a.ambienteNombre || 'Clínica General',
      curso: a.cursoNombre || '—',
      ingreso: hIngStr,
      salida: hSalStr,
      horasDec: Number(((a.minutosTotales || 0) / 60).toFixed(2)),
      estado: a.estado === 'finalizado' ? 'Finalizado' : 'En Curso',
      diagnostico: diagTexto,
      cobertura: coberturaTexto,
      tardanza: a.minutosTardanza || (evalSim ? evalSim.diffMinutos : 0) || '0',
      retiro: evalSim ? evalSim.retiroAnticipadoMinutos : '0',
      cambioSala: (evalSim && evalSim.discrepanciaSala) ? 'SÍ' : 'NO',
      obs: a.motivoModificacion || a.observaciones || '—',
    });

    row.height = 20;

    row.getCell('num').alignment = { horizontal: 'center' };
    row.getCell('fecha').alignment = { horizontal: 'center' };
    row.getCell('dni').alignment = { horizontal: 'center' };
    row.getCell('rol').alignment = { horizontal: 'center' };
    row.getCell('ingreso').alignment = { horizontal: 'center' };
    row.getCell('salida').alignment = { horizontal: 'center' };
    row.getCell('horasDec').alignment = { horizontal: 'center' };
    row.getCell('estado').alignment = { horizontal: 'center' };
    row.getCell('diagnostico').alignment = { horizontal: 'center' };
    row.getCell('cobertura').alignment = { horizontal: 'center' };
    row.getCell('tardanza').alignment = { horizontal: 'center' };
    row.getCell('retiro').alignment = { horizontal: 'center' };
    row.getCell('cambioSala').alignment = { horizontal: 'center' };

    // Colores condicionales en Estado
    const estadoCell = row.getCell('estado');
    if (a.estado === 'finalizado') {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      estadoCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF16A34A' } };
    } else {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      estadoCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFD97706' } };
    }

    if (idx % 2 === 1) {
      row.eachCell((cell, colNumber) => {
        if (colNumber !== 13) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      });
    }
  });

  wsTurnos.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 19 },
  };

  // Descarga
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const fDesde = filtroFechaDesde || 'inicio';
  const fHasta = filtroFechaHasta || 'fin';
  link.setAttribute('download', `UCS_Auditoria_Asistencias_${fDesde}_${fHasta}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
