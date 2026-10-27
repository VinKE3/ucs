import ExcelJS from 'exceljs';
import type { SesionProgramadaTimelineItem, AmbienteAdminItem, SedeAdminItem } from '@/types/admin';

interface ExportarProgramacionOptions {
  sesiones: SesionProgramadaTimelineItem[];
  ambientes?: AmbienteAdminItem[];
  sede?: SedeAdminItem | null;
  fecha: string;
  fechaEmision?: string;
}

/**
 * Genera un gráfico de Dona con la distribución de horas por Carrera Médica en Canvas.
 */
function generarGraficoDonaCarreras(
  carreras: Array<{ carrera: string; horas: number; sesiones: number; color?: string }>
): string {
  if (typeof window === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 620;
  canvas.height = 310;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Distribución de Horas Académicas por Carrera', 20, 30);

  const totalHoras = carreras.reduce((sum, c) => sum + c.horas, 0);
  if (totalHoras === 0) {
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Sin horas programadas en el día', 20, 80);
    return canvas.toDataURL('image/png');
  }

  const centerX = 160;
  const centerY = 170;
  const outerRadius = 105;
  const innerRadius = 58;

  const defaultColors = [
    '#0d346c', // Azul Científica
    '#ff5a00', // Naranja UCS
    '#10b981', // Verde Esmeralda
    '#0284c7', // Azul Cielo
    '#8b5cf6', // Púrpura
    '#f59e0b', // Ámbar
    '#ec4899', // Rosa
    '#64748b', // Gris
  ];

  let startAngle = -Math.PI / 2;

  carreras.slice(0, 7).forEach((car, idx) => {
    const sliceAngle = (car.horas / totalHoras) * (2 * Math.PI);
    const endAngle = startAngle + sliceAngle;
    const color = car.color || defaultColors[idx % defaultColors.length];

    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
    ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
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
  ctx.fillText('SIMULACIÓN', centerX, centerY + 14);

  // Leyenda
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let legendY = 65;

  carreras.slice(0, 7).forEach((car, idx) => {
    const color = car.color || defaultColors[idx % defaultColors.length];
    const pct = Math.round((car.horas / totalHoras) * 100);

    ctx.fillStyle = color;
    ctx.fillRect(320, legendY - 12, 14, 14);

    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    const cLabel = car.carrera.length > 22 ? car.carrera.slice(0, 20) + '...' : car.carrera;
    ctx.fillText(cLabel, 342, legendY);

    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${car.horas.toFixed(1)}h (${pct}%) • ${car.sesiones} sesiones`, 342, legendY + 14);

    legendY += 34;
  });

  return canvas.toDataURL('image/png');
}

/**
 * Genera un gráfico de Barras de Distribución de Horas y Sesiones por Franja Horaria (07:00 a 22:00).
 */
function generarGraficoBarrasHorariasSimulacion(
  horasDistribucion: Record<number, number>
): string {
  if (typeof window === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 620;
  canvas.height = 270;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Carga Simultánea de Simulación por Franja Horaria (07:00 - 22:00)', 20, 28);

  const horas = Array.from({ length: 16 }, (_, i) => i + 7); // 7 a 22
  const valores = horas.map((h) => horasDistribucion[h] || 0);
  const maxVal = Math.max(...valores, 1);

  const chartX = 35;
  const chartY = 55;
  const chartW = 560;
  const chartH = 170;
  const barGap = 6;
  const barW = (chartW - (horas.length - 1) * barGap) / horas.length;

  // Encontrar hora pico
  let horaPico = 7;
  let maxPicoVal = 0;
  horas.forEach((h, idx) => {
    if (valores[idx] > maxPicoVal) {
      maxPicoVal = valores[idx];
      horaPico = h;
    }
  });

  // Líneas guía horizontales
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75, 1].forEach((ratio) => {
    const y = chartY + chartH - chartH * ratio;
    ctx.beginPath();
    ctx.moveTo(chartX, y);
    ctx.lineTo(chartX + chartW, y);
    ctx.stroke();
  });

  // Dibujar barras
  horas.forEach((h, idx) => {
    const val = valores[idx];
    const bHeight = val > 0 ? Math.max(6, (val / maxVal) * (chartH - 25)) : 2;
    const x = chartX + idx * (barW + barGap);
    const y = chartY + chartH - bHeight;

    const esPico = h === horaPico && maxPicoVal > 0;
    ctx.fillStyle = esPico ? '#ff5a00' : val > 0 ? '#0d346c' : '#e2e8f0';

    ctx.beginPath();
    ctx.roundRect(x, y, barW, bHeight, 4);
    ctx.fill();

    // Valor encima de la barra
    if (val > 0) {
      ctx.font = esPico ? 'bold 11px Arial, sans-serif' : '10px Arial, sans-serif';
      ctx.fillStyle = esPico ? '#ea580c' : '#334155';
      ctx.textAlign = 'center';
      ctx.fillText(val.toString(), x + barW / 2, y - 6);
    }

    // Etiqueta de hora al pie
    ctx.font = '10px Arial, sans-serif';
    ctx.fillStyle = esPico ? '#0f172a' : '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText(`${h}h`, x + barW / 2, chartY + chartH + 16);
  });

  return canvas.toDataURL('image/png');
}

/**
 * Función principal para exportar el Cronograma de Simulación de SimClic a Microsoft Excel (.xlsx)
 * con Dashboard Ejecutivo, Gráficos de alta definición, Detalle de sesiones y Auditoría de reubicaciones.
 */
export async function exportarExcelProgramacionConGraficos({
  sesiones,
  ambientes = [],
  sede,
  fecha,
  fechaEmision = new Date().toLocaleString('es-PE'),
}: ExportarProgramacionOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Control y Simulación Clínica UCS';
  workbook.lastModifiedBy = 'Coordinación Académica de Simulación';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Métricas y agregaciones
  const totalSesiones = sesiones.length;
  const totalMinutos = sesiones.reduce((sum, s) => sum + (s.duracionMinutos || 0), 0);
  const totalHorasDecimal = (totalMinutos / 60).toFixed(1);
  const totalHorasFormato = `${Math.floor(totalMinutos / 60)}h ${totalMinutos % 60}m`;

  const salasUtilizadasSet = new Set<string>();
  const docentesSet = new Set<string>();
  const psSet = new Set<string>();
  let reubicadasCount = 0;

  // Distribución por hora (07 a 22)
  const horasDistribucion: Record<number, number> = {};
  for (let h = 7; h <= 22; h++) horasDistribucion[h] = 0;

  // Distribución por carrera
  const carrerasMap = new Map<string, { carrera: string; horas: number; sesiones: number; color?: string }>();

  // Distribución por sala
  const salasOcupacionMap = new Map<string, { sala: string; codigo: string; horas: number; sesiones: number; reubicada: boolean }>();

  sesiones.forEach((s) => {
    if (s.ambienteNombreSimclic) salasUtilizadasSet.add(s.ambienteNombreSimclic);
    if (s.docenteNombreSimclic) docentesSet.add(s.docenteNombreSimclic);
    if (s.pacienteSimuladoNombre) psSet.add(s.pacienteSimuladoNombre);
    if (s.ambienteOriginalNombre || s.estadoUcs === 'reubicada') reubicadasCount++;

    // Horas simultáneas
    const startH = Math.floor(s.startMins / 60);
    const endH = Math.ceil(s.endMins / 60);
    for (let h = Math.max(7, startH); h < Math.min(23, endH); h++) {
      horasDistribucion[h] = (horasDistribucion[h] || 0) + 1;
    }

    // Por carrera
    const carNom = s.carrera || 'Medicina Humana (General)';
    const durH = (s.duracionMinutos || 0) / 60;
    const existingCar = carrerasMap.get(carNom);
    if (!existingCar) {
      carrerasMap.set(carNom, {
        carrera: carNom,
        horas: durH,
        sesiones: 1,
        color: s.carreraColor || undefined,
      });
    } else {
      existingCar.horas += durH;
      existingCar.sesiones += 1;
    }

    // Por sala
    const salaNom = s.ambienteNombreSimclic || 'Sin Sala Asignada';
    const existingSala = salasOcupacionMap.get(salaNom);
    if (!existingSala) {
      salasOcupacionMap.set(salaNom, {
        sala: salaNom,
        codigo: s.ambienteCodigoSimclic || '',
        horas: durH,
        sesiones: 1,
        reubicada: Boolean(s.ambienteOriginalNombre),
      });
    } else {
      existingSala.horas += durH;
      existingSala.sesiones += 1;
      if (s.ambienteOriginalNombre) existingSala.reubicada = true;
    }
  });

  const carrerasDistribucion = Array.from(carrerasMap.values()).sort((a, b) => b.horas - a.horas);
  const salasDistribucion = Array.from(salasOcupacionMap.values()).sort((a, b) => b.horas - a.horas);

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
  cellTitulo.value = 'UNIVERSIDAD CIENTÍFICA DEL SUR — REPORTE EJECUTIVO DE PROGRAMACIÓN SIMCLIC';
  cellTitulo.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cellTitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D346C' } };
  cellTitulo.alignment = { vertical: 'middle', horizontal: 'center' };
  wsDash.getRow(2).height = 34;

  // 2. Subtítulo
  wsDash.mergeCells('B3:I3');
  const cellSub = wsDash.getCell('B3');
  const sedeTexto = sede?.nombre || 'Todas las Sedes';
  cellSub.value = `Fecha Cronograma: ${fecha}  |  Campus: ${sedeTexto}  |  Total Sesiones: ${totalSesiones}  |  Horas: ${totalHorasFormato}  |  Emisión: ${fechaEmision}`;
  cellSub.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF06152D' } };
  cellSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  cellSub.alignment = { vertical: 'middle', horizontal: 'center' };
  wsDash.getRow(3).height = 24;

  // 3. Tarjetas KPI
  const kpisItems = [
    {
      colStart: 'B',
      colEnd: 'C',
      label: 'SESIONES PROGRAMADAS',
      val: `${totalSesiones} Sesiones`,
      bg: 'FFDBEAFE',
      border: 'FF0284C7',
      textCol: 'FF0369A1',
    },
    {
      colStart: 'D',
      colEnd: 'E',
      label: 'HORAS DE SIMULACIÓN',
      val: totalHorasFormato,
      bg: 'FFDCFCE7',
      border: 'FF10B981',
      textCol: 'FF16A34A',
    },
    {
      colStart: 'F',
      colEnd: 'G',
      label: 'SALAS UTILIZADAS',
      val: `${salasUtilizadasSet.size} Salas`,
      bg: 'FFFFEDD5',
      border: 'FFFF5A00',
      textCol: 'FFC2410C',
    },
    {
      colStart: 'H',
      colEnd: 'I',
      label: 'DOCENTES Y ACTORES',
      val: `${docentesSet.size} Doc • ${psSet.size} PS`,
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
    val.font = { name: 'Arial', size: 13, bold: true, color: { argb: k.textCol } };
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

  // 4. Tabla de Carreras Médicas
  let currentY = 8;
  wsDash.mergeCells(`B${currentY}:F${currentY}`);
  const hCar = wsDash.getCell(`B${currentY}`);
  hCar.value = '🩺 DISTRIBUCIÓN DE HORAS POR CARRERA';
  hCar.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  hCar.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D346C' } };
  hCar.alignment = { vertical: 'middle' };
  wsDash.getRow(currentY).height = 24;

  currentY++;
  wsDash.getCell(`B${currentY}`).value = 'Carrera';
  wsDash.getCell(`C${currentY}`).value = 'Sesiones';
  wsDash.getCell(`D${currentY}`).value = 'Horas';
  wsDash.getCell(`E${currentY}`).value = '% Carga';
  wsDash.getCell(`F${currentY}`).value = 'Prioridad';

  ['B', 'C', 'D', 'E', 'F'].forEach((c) => {
    const cell = wsDash.getCell(`${c}${currentY}`);
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: c === 'B' ? 'left' : 'center' };
  });
  wsDash.getRow(currentY).height = 20;

  const totalHorasNum = Number(totalHorasDecimal) > 0 ? Number(totalHorasDecimal) : 1;
  carrerasDistribucion.forEach((car) => {
    currentY++;
    const pct = Math.round((car.horas / totalHorasNum) * 100);
    wsDash.getCell(`B${currentY}`).value = car.carrera;
    wsDash.getCell(`C${currentY}`).value = car.sesiones;
    wsDash.getCell(`D${currentY}`).value = Number(car.horas.toFixed(1));
    wsDash.getCell(`E${currentY}`).value = `${pct}%`;
    wsDash.getCell(`F${currentY}`).value = pct >= 35 ? '🔴 Alta Demanda' : pct >= 15 ? '🟡 Moderada' : '🟢 Estándar';

    ['B', 'C', 'D', 'E', 'F'].forEach((col) => {
      const cell = wsDash.getCell(`${col}${currentY}`);
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: col === 'B' ? 'left' : 'center' };
    });
    wsDash.getRow(currentY).height = 19;
  });

  // 5. Tabla Top Salas con Mayor Ocupación
  currentY += 2;
  wsDash.mergeCells(`B${currentY}:F${currentY}`);
  const hSalas = wsDash.getCell(`B${currentY}`);
  hSalas.value = '🏥 TOP AULAS CON MAYOR OCUPACIÓN EN EL DÍA';
  hSalas.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  hSalas.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF5A00' } };
  hSalas.alignment = { vertical: 'middle' };
  wsDash.getRow(currentY).height = 24;

  currentY++;
  wsDash.getCell(`B${currentY}`).value = 'Sala / Laboratorio';
  wsDash.getCell(`C${currentY}`).value = 'Código';
  wsDash.getCell(`D${currentY}`).value = 'Sesiones';
  wsDash.getCell(`E${currentY}`).value = 'Horas (Dec)';
  wsDash.getCell(`F${currentY}`).value = 'Estado';

  ['B', 'C', 'D', 'E', 'F'].forEach((c) => {
    const cell = wsDash.getCell(`${c}${currentY}`);
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: c === 'B' ? 'left' : 'center' };
  });
  wsDash.getRow(currentY).height = 20;

  salasDistribucion.slice(0, 8).forEach((sal) => {
    currentY++;
    wsDash.getCell(`B${currentY}`).value = sal.sala;
    wsDash.getCell(`C${currentY}`).value = sal.codigo || '—';
    wsDash.getCell(`D${currentY}`).value = sal.sesiones;
    wsDash.getCell(`E${currentY}`).value = Number(sal.horas.toFixed(1));
    wsDash.getCell(`F${currentY}`).value = sal.reubicada ? '⚠️ Con Reubicación' : '🟢 Continua';

    ['B', 'C', 'D', 'E', 'F'].forEach((col) => {
      const cell = wsDash.getCell(`${col}${currentY}`);
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: col === 'B' ? 'left' : 'center' };
    });
    wsDash.getRow(currentY).height = 19;
  });

  // 6. Generar e incrustar Gráficos en Hoja 1
  try {
    const donaPng = generarGraficoDonaCarreras(carrerasDistribucion);
    if (donaPng) {
      const img1 = workbook.addImage({ base64: donaPng, extension: 'png' });
      wsDash.addImage(img1, {
        tl: { col: 7, row: 7 },
        ext: { width: 560, height: 270 },
      });
    }

    const barrasPng = generarGraficoBarrasHorariasSimulacion(horasDistribucion);
    if (barrasPng) {
      const img2 = workbook.addImage({ base64: barrasPng, extension: 'png' });
      wsDash.addImage(img2, {
        tl: { col: 7, row: 22 },
        ext: { width: 560, height: 250 },
      });
    }
  } catch (err) {
    console.warn('No se pudieron incrustar los gráficos de programación en Excel:', err);
  }

  // =========================================================================
  // HOJA 2: CRONOGRAMA DETALLADO
  // =========================================================================
  const wsCrono = workbook.addWorksheet('Cronograma Detallado', {
    views: [{ showGridLines: true }],
  });

  wsCrono.columns = [
    { header: '#', key: 'num', width: 6 },
    { header: 'ID SimClic', key: 'simclicId', width: 14 },
    { header: 'Fecha', key: 'fecha', width: 13 },
    { header: 'Hora Inicio', key: 'inicio', width: 13 },
    { header: 'Hora Fin', key: 'fin', width: 13 },
    { header: 'Duración (min)', key: 'durMins', width: 15 },
    { header: 'Duración (hrs)', key: 'durHrs', width: 15 },
    { header: 'Sala Programada', key: 'sala', width: 24 },
    { header: 'Código Sala', key: 'codigoSala', width: 15 },
    { header: 'Carrera', key: 'carrera', width: 22 },
    { header: 'Curso / Asignatura', key: 'curso', width: 28 },
    { header: 'Código Curso', key: 'codCurso', width: 15 },
    { header: 'Escenario Clínico', key: 'escenario', width: 24 },
    { header: 'Docente Titular', key: 'docente', width: 26 },
    { header: 'Correo Docente', key: 'correoDocente', width: 26 },
    { header: 'Paciente Simulado', key: 'ps', width: 24 },
    { header: 'Estado Kiosco', key: 'estadoKiosco', width: 18 },
    { header: 'Reubicada', key: 'reubicada', width: 14 },
    { header: 'Sala Original SimClic', key: 'salaOriginal', width: 22 },
  ];

  const headerCrono = wsCrono.getRow(1);
  headerCrono.height = 28;
  headerCrono.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D346C' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  sesiones.forEach((s, idx) => {
    const estadoKiosco = s.estadoUcs === 'cancelada' || (s as any).estadoSimclic === 'Cancelled'
      ? 'Cancelada en SimClic'
      : s.docentePresente
      ? 'En Sala (Marco)'
      : s.estadoEnVivo === 'sin_marcar'
      ? 'Sin Marcación'
      : 'Programada';

    const esReubicada = Boolean(s.ambienteOriginalNombre || s.estadoUcs === 'reubicada');

    const row = wsCrono.addRow({
      num: idx + 1,
      simclicId: s.simclicId,
      fecha: s.fecha,
      inicio: s.horaInicio,
      fin: s.horaFin,
      durMins: s.duracionMinutos,
      durHrs: Number(((s.duracionMinutos || 0) / 60).toFixed(2)),
      sala: s.ambienteNombreSimclic || 'Sin Sala',
      codigoSala: s.ambienteCodigoSimclic || '—',
      carrera: s.carrera || 'Medicina Humana',
      curso: s.cursoNombreSimclic || s.titulo,
      codCurso: s.cursoCodigoSimclic || '—',
      escenario: s.escenarioNombre || s.escenarioCodigo || '—',
      docente: s.docenteNombreSimclic || 'Docente de Guardia',
      correoDocente: s.docenteCorreoSimclic || '—',
      ps: s.pacienteSimuladoNombre || 'Sin Paciente Simulado',
      estadoKiosco,
      reubicada: esReubicada ? 'SÍ' : 'NO',
      salaOriginal: s.ambienteOriginalNombre || '—',
    });

    row.height = 20;

    row.getCell('num').alignment = { horizontal: 'center' };
    row.getCell('simclicId').alignment = { horizontal: 'center' };
    row.getCell('fecha').alignment = { horizontal: 'center' };
    row.getCell('inicio').alignment = { horizontal: 'center' };
    row.getCell('fin').alignment = { horizontal: 'center' };
    row.getCell('durMins').alignment = { horizontal: 'center' };
    row.getCell('durHrs').alignment = { horizontal: 'center' };
    row.getCell('codigoSala').alignment = { horizontal: 'center' };
    row.getCell('codCurso').alignment = { horizontal: 'center' };
    row.getCell('estadoKiosco').alignment = { horizontal: 'center' };
    row.getCell('reubicada').alignment = { horizontal: 'center' };

    // Formato condicional
    const estadoCell = row.getCell('estadoKiosco');
    if (s.docentePresente) {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      estadoCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF16A34A' } };
    } else if (s.estadoEnVivo === 'sin_marcar') {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      estadoCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFD97706' } };
    }

    if (esReubicada) {
      const cellReub = row.getCell('reubicada');
      cellReub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      cellReub.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFDC2626' } };
    }

    if (idx % 2 === 1) {
      row.eachCell((cell, colNumber) => {
        if (colNumber !== 17 && colNumber !== 18) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      });
    }
  });

  wsCrono.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 19 },
  };

  // =========================================================================
  // HOJA 3: AUDITORÍA DE REUBICACIONES Y TRASLADOS
  // =========================================================================
  const wsReub = workbook.addWorksheet('Auditoría de Reubicaciones', {
    views: [{ showGridLines: true }],
  });

  wsReub.columns = [
    { header: '#', key: 'num', width: 6 },
    { header: 'ID SimClic', key: 'simclicId', width: 14 },
    { header: 'Horario', key: 'horario', width: 15 },
    { header: 'Sala Actual (Reubicada)', key: 'salaActual', width: 24 },
    { header: 'Sala Original SimClic', key: 'salaOriginal', width: 24 },
    { header: 'Curso / Asignatura', key: 'curso', width: 28 },
    { header: 'Carrera', key: 'carrera', width: 20 },
    { header: 'Docente', key: 'docente', width: 26 },
    { header: 'Motivo / Diagnóstico', key: 'motivo', width: 32 },
  ];

  const headerReub = wsReub.getRow(1);
  headerReub.height = 28;
  headerReub.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } }; // Naranja advertencia
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const sesionesReubicadas = sesiones.filter((s) => s.ambienteOriginalNombre || s.estadoUcs === 'reubicada');

  if (sesionesReubicadas.length === 0) {
    const rowVacia = wsReub.addRow({
      num: 1,
      simclicId: '—',
      horario: 'Jornada Completa',
      salaActual: 'Todas las salas conformes',
      salaOriginal: 'Conformes a SimClic',
      curso: 'Sin reubicaciones detectadas',
      carrera: 'Todas',
      docente: 'Logística 100% conforme',
      motivo: 'No se registraron traslados ni reubicaciones en la jornada.',
    });
    rowVacia.height = 24;
    rowVacia.getCell('salaActual').font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF16A34A' } };
  } else {
    sesionesReubicadas.forEach((s, idx) => {
      const row = wsReub.addRow({
        num: idx + 1,
        simclicId: s.simclicId,
        horario: `${s.horaInicio} - ${s.horaFin}`,
        salaActual: s.ambienteNombreSimclic || 'Sin Sala',
        salaOriginal: s.ambienteOriginalNombre || 'No especificada',
        curso: s.cursoNombreSimclic || s.titulo,
        carrera: s.carrera || 'Medicina Humana',
        docente: s.docenteNombreSimclic || 'Docente Titular',
        motivo: 'Reubicación logística por aforo, equipo o cruce intra-día',
      });
      row.height = 20;

      row.getCell('num').alignment = { horizontal: 'center' };
      row.getCell('simclicId').alignment = { horizontal: 'center' };
      row.getCell('horario').alignment = { horizontal: 'center' };
      row.getCell('salaActual').font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FFDC2626' } };
      row.getCell('salaOriginal').font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF64748b' } };
    });
  }

  wsReub.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 9 },
  };

  // Descarga del libro
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `Cronograma_Simulacion_UCS_${fecha}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
