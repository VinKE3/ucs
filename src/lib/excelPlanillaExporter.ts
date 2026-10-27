import ExcelJS from 'exceljs';
import type { AsistenciaAdminItem, UsuarioItem } from '@/types/admin';

export interface ActorPlanillaExportItem {
  usuarioId: number;
  dni: string;
  apellidos: string;
  nombres: string;
  correo: string | null;
  telefono?: string | null;
  tarifaHoraBase: number | null;
  totalSesiones: number;
  sesionesEnCurso: number;
  minutosTotales: number;
  horasDecimal: number;
  horasFormato: string;
  cursosMap: Map<string, {
    cursoId?: number | null;
    cursoNombre: string;
    horas: number;
    tarifa: number;
    subtotal: number;
    sesionesCount?: number;
  }>;
  totalAPagar: number;
  estadoPlanilla: 'listo' | 'en_curso';
  usuarioObj?: UsuarioItem;
  asistenciasActor?: AsistenciaAdminItem[];
}

export interface KpisPlanillaExport {
  totalActores: number;
  totalHorasDecimal: string;
  totalHorasFormato: string;
  totalMontoGral: number;
  totalCursos: number;
}

interface ExportarPlanillaOptions {
  actores: ActorPlanillaExportItem[];
  kpis: KpisPlanillaExport;
  labelPeriodo: string;
  slugCorte: string;
  fechaEmision?: string;
}

/**
 * Genera un gráfico de Dona con la distribución presupuestal por curso (S/.) en Canvas en memoria.
 */
function generarGraficoDonaPresupuestoCursos(
  cursosDistribucion: Array<{ nombre: string; totalMonto: number; horas: number }>
): string {
  if (typeof window === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Título del gráfico
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Distribución Presupuestal por Curso / Asignatura', 20, 30);

  const totalGral = cursosDistribucion.reduce((sum, c) => sum + c.totalMonto, 0);
  if (totalGral === 0) {
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Sin presupuesto liquidado en el período', 20, 80);
    return canvas.toDataURL('image/png');
  }

  const centerX = 160;
  const centerY = 175;
  const outerRadius = 110;
  const innerRadius = 60;

  const defaultColors = [
    '#0d346c', // Azul Científica
    '#ff5a00', // Naranja UCS
    '#10b981', // Verde Esmeralda
    '#0284c7', // Azul Cielo
    '#8b5cf6', // Púrpura
    '#f59e0b', // Ámbar
    '#ec4899', // Rosa
    '#64748b', // Gris azulado
  ];

  let startAngle = -Math.PI / 2;

  cursosDistribucion.slice(0, 7).forEach((c, idx) => {
    const sliceAngle = (c.totalMonto / totalGral) * (2 * Math.PI);
    const endAngle = startAngle + sliceAngle;
    const color = defaultColors[idx % defaultColors.length];

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

  // Texto central de la dona
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`S/. ${Math.round(totalGral).toLocaleString('es-PE')}`, centerX, centerY - 6);

  ctx.font = '11px Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('HONORARIOS PS', centerX, centerY + 16);

  // Leyenda a la derecha
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let legendY = 65;

  cursosDistribucion.slice(0, 7).forEach((c, idx) => {
    const color = defaultColors[idx % defaultColors.length];
    const pct = Math.round((c.totalMonto / totalGral) * 100);

    ctx.fillStyle = color;
    ctx.fillRect(320, legendY - 12, 14, 14);

    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    const cLabel = c.nombre.length > 24 ? c.nombre.slice(0, 22) + '...' : c.nombre;
    ctx.fillText(cLabel, 342, legendY);

    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`S/. ${c.totalMonto.toFixed(2)} (${pct}%) • ${c.horas.toFixed(1)}h`, 342, legendY + 14);

    legendY += 34;
  });

  return canvas.toDataURL('image/png');
}

/**
 * Genera un gráfico de Barras con el Ranking de Actores con mayor compensación / horas.
 */
function generarGraficoBarrasTopActores(
  actores: Array<{ nombre: string; monto: number; horas: number }>
): string {
  if (typeof window === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Top 5 Actores con Mayor Participación y Honorarios', 20, 30);

  const top = actores.slice(0, 5);
  if (top.length === 0) {
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Sin datos de actores en el período', 20, 80);
    return canvas.toDataURL('image/png');
  }

  const maxMonto = Math.max(...top.map((a) => a.monto), 1);
  const startY = 60;
  const barHeight = 24;
  const gap = 22;
  const maxBarWidth = 380;
  const labelX = 20;
  const barStartX = 180;

  top.forEach((act, idx) => {
    const y = startY + idx * (barHeight + gap);
    const barWidth = Math.max(8, (act.monto / maxMonto) * maxBarWidth);

    // Nombre del actor
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'left';
    const cleanName = act.nombre.length > 20 ? act.nombre.slice(0, 18) + '...' : act.nombre;
    ctx.fillText(`${idx + 1}. ${cleanName}`, labelX, y + 17);

    // Barra de color
    const isTop1 = idx === 0;
    ctx.fillStyle = isTop1 ? '#ff5a00' : '#0d346c';
    ctx.beginPath();
    ctx.roundRect(barStartX, y, barWidth, barHeight, 5);
    ctx.fill();

    // Etiqueta del monto y horas
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left';
    ctx.fillText(`S/. ${act.monto.toFixed(2)} (${act.horas.toFixed(1)}h)`, barStartX + barWidth + 10, y + 17);
  });

  return canvas.toDataURL('image/png');
}

/**
 * Exporta la Planilla Consolidada de Pacientes Simulados a Microsoft Excel (.xlsx)
 * con Dashboard Ejecutivo, Gráficos Incrustados, Planilla Consolidada y Detalle de Sesiones.
 */
export async function exportarExcelPlanillaConGraficos({
  actores,
  kpis,
  labelPeriodo,
  slugCorte,
  fechaEmision = new Date().toLocaleDateString('es-PE'),
}: ExportarPlanillaOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Planilla de Pacientes Simulados UCS';
  workbook.lastModifiedBy = 'Facultad de Ciencias de la Salud - Simulación Clínica';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Consolidar distribución por cursos
  const cursosDistMap = new Map<string, { nombre: string; totalMonto: number; horas: number; sesiones: number }>();
  actores.forEach((a) => {
    a.cursosMap.forEach((c, cNom) => {
      const existing = cursosDistMap.get(cNom);
      if (!existing) {
        cursosDistMap.set(cNom, {
          nombre: cNom,
          totalMonto: c.subtotal,
          horas: c.horas,
          sesiones: c.sesionesCount || 1,
        });
      } else {
        existing.totalMonto += c.subtotal;
        existing.horas += c.horas;
        existing.sesiones += (c.sesionesCount || 1);
      }
    });
  });
  const cursosDistribucion = Array.from(cursosDistMap.values()).sort((a, b) => b.totalMonto - a.totalMonto);

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

  // 1. Encabezado Institucional
  wsDash.mergeCells('B2:I2');
  const cellTitulo = wsDash.getCell('B2');
  cellTitulo.value = 'UNIVERSIDAD CIENTÍFICA DEL SUR — PLANILLA EJECUTIVA DE PACIENTES SIMULADOS (ACTORES)';
  cellTitulo.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cellTitulo.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0D346C' }, // Azul Científica
  };
  cellTitulo.alignment = { vertical: 'middle', horizontal: 'center' };
  wsDash.getRow(2).height = 34;

  // 2. Subtítulo con metadata
  wsDash.mergeCells('B3:I3');
  const cellSub = wsDash.getCell('B3');
  cellSub.value = `Período Contable: ${labelPeriodo}  |  Actores: ${kpis.totalActores}  |  Presupuesto Total: S/. ${kpis.totalMontoGral.toFixed(2)}  |  Emisión: ${fechaEmision}`;
  cellSub.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF06152D' } };
  cellSub.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };
  cellSub.alignment = { vertical: 'middle', horizontal: 'center' };
  wsDash.getRow(3).height = 24;

  // 3. Tarjetas KPI
  const kpisItems = [
    {
      colStart: 'B',
      colEnd: 'C',
      label: 'PRESUPUESTO A PAGAR',
      val: `S/. ${kpis.totalMontoGral.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      bg: 'FFDCFCE7',
      border: 'FF10B981',
      textCol: 'FF16A34A',
    },
    {
      colStart: 'D',
      colEnd: 'E',
      label: 'ACTORES CONVOCADOS',
      val: `${kpis.totalActores} Actores`,
      bg: 'FFFFEDD5',
      border: 'FFFF5A00',
      textCol: 'FFC2410C',
    },
    {
      colStart: 'F',
      colEnd: 'G',
      label: 'HORAS DE SIMULACIÓN',
      val: kpis.totalHorasFormato,
      bg: 'FFDBEAFE',
      border: 'FF0284C7',
      textCol: 'FF0369A1',
    },
    {
      colStart: 'H',
      colEnd: 'I',
      label: 'CURSOS Y ESTACIONES',
      val: `${kpis.totalCursos} Asignaturas`,
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

  // 4. Tabla de Cursos / Asignaturas
  let currentY = 8;
  wsDash.mergeCells(`B${currentY}:F${currentY}`);
  const hCursos = wsDash.getCell(`B${currentY}`);
  hCursos.value = '📚 DISTRIBUCIÓN DEL GASTO POR ASIGNATURA DE SIMULACIÓN';
  hCursos.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  hCursos.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D346C' } };
  hCursos.alignment = { vertical: 'middle' };
  wsDash.getRow(currentY).height = 24;

  currentY++;
  wsDash.getCell(`B${currentY}`).value = 'Asignatura / Estación';
  wsDash.getCell(`C${currentY}`).value = 'N° Sesiones';
  wsDash.getCell(`D${currentY}`).value = 'Horas';
  wsDash.getCell(`E${currentY}`).value = 'Subtotal (S/.)';
  wsDash.getCell(`F${currentY}`).value = '% Presupuesto';

  ['B', 'C', 'D', 'E', 'F'].forEach((c) => {
    const cell = wsDash.getCell(`${c}${currentY}`);
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: c === 'B' ? 'left' : 'center' };
  });
  wsDash.getRow(currentY).height = 20;

  const totalGralMonto = kpis.totalMontoGral > 0 ? kpis.totalMontoGral : 1;
  cursosDistribucion.forEach((c) => {
    currentY++;
    const pct = Math.round((c.totalMonto / totalGralMonto) * 100);
    wsDash.getCell(`B${currentY}`).value = c.nombre;
    wsDash.getCell(`C${currentY}`).value = c.sesiones;
    wsDash.getCell(`D${currentY}`).value = Number(c.horas.toFixed(1));
    wsDash.getCell(`E${currentY}`).value = Number(c.totalMonto.toFixed(2));
    wsDash.getCell(`E${currentY}`).numFmt = '"S/." #,##0.00';
    wsDash.getCell(`F${currentY}`).value = `${pct}%`;

    ['B', 'C', 'D', 'E', 'F'].forEach((col) => {
      const cell = wsDash.getCell(`${col}${currentY}`);
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: col === 'B' ? 'left' : 'center' };
    });
    wsDash.getRow(currentY).height = 19;
  });

  // 5. Tabla Top Actores Participantes
  currentY += 2;
  wsDash.mergeCells(`B${currentY}:F${currentY}`);
  const hActores = wsDash.getCell(`B${currentY}`);
  hActores.value = '🎭 TOP ACTORES CON MAYOR CARGA Y HONORARIOS EN EL PERÍODO';
  hActores.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  hActores.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF5A00' } };
  hActores.alignment = { vertical: 'middle' };
  wsDash.getRow(currentY).height = 24;

  currentY++;
  wsDash.getCell(`B${currentY}`).value = 'Actor / Paciente Simulado';
  wsDash.getCell(`C${currentY}`).value = 'DNI';
  wsDash.getCell(`D${currentY}`).value = 'Horas Netas';
  wsDash.getCell(`E${currentY}`).value = 'Total a Pagar (S/.)';
  wsDash.getCell(`F${currentY}`).value = 'Estado';

  ['B', 'C', 'D', 'E', 'F'].forEach((c) => {
    const cell = wsDash.getCell(`${c}${currentY}`);
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: c === 'B' ? 'left' : 'center' };
  });
  wsDash.getRow(currentY).height = 20;

  actores.slice(0, 8).forEach((act) => {
    currentY++;
    wsDash.getCell(`B${currentY}`).value = `${act.apellidos}, ${act.nombres}`;
    wsDash.getCell(`C${currentY}`).value = act.dni;
    wsDash.getCell(`D${currentY}`).value = act.horasFormato;
    wsDash.getCell(`E${currentY}`).value = act.totalAPagar;
    wsDash.getCell(`E${currentY}`).numFmt = '"S/." #,##0.00';
    wsDash.getCell(`F${currentY}`).value = act.estadoPlanilla === 'listo' ? 'Listo para Pago' : 'Turno en Curso';

    ['B', 'C', 'D', 'E', 'F'].forEach((col) => {
      const cell = wsDash.getCell(`${col}${currentY}`);
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: col === 'B' ? 'left' : 'center' };
    });
    wsDash.getRow(currentY).height = 19;
  });

  // 6. Generar e incrustar Gráficos en la Hoja 1
  try {
    const donaPng = generarGraficoDonaPresupuestoCursos(cursosDistribucion);
    if (donaPng) {
      const img1 = workbook.addImage({ base64: donaPng, extension: 'png' });
      wsDash.addImage(img1, {
        tl: { col: 7, row: 7 },
        ext: { width: 570, height: 280 },
      });
    }

    const topParaGrafico = actores.map((a) => ({
      nombre: `${a.apellidos}, ${a.nombres.split(' ')[0]}`,
      monto: a.totalAPagar,
      horas: a.horasDecimal,
    }));
    const barrasPng = generarGraficoBarrasTopActores(topParaGrafico);
    if (barrasPng) {
      const img2 = workbook.addImage({ base64: barrasPng, extension: 'png' });
      wsDash.addImage(img2, {
        tl: { col: 7, row: 22 },
        ext: { width: 570, height: 260 },
      });
    }
  } catch (err) {
    console.warn('No se pudieron incrustar los gráficos en la hoja de Excel:', err);
  }

  // =========================================================================
  // HOJA 2: PLANILLA CONSOLIDADA
  // =========================================================================
  const wsPlanilla = workbook.addWorksheet('Planilla Consolidada', {
    views: [{ showGridLines: true }],
  });

  wsPlanilla.columns = [
    { header: '#', key: 'num', width: 6 },
    { header: 'DNI', key: 'dni', width: 12 },
    { header: 'Apellidos', key: 'apellidos', width: 22 },
    { header: 'Nombres', key: 'nombres', width: 22 },
    { header: 'Correo Electrónico', key: 'correo', width: 28 },
    { header: 'N° Sesiones', key: 'sesiones', width: 13 },
    { header: 'Horas (Decimal)', key: 'horasDec', width: 15 },
    { header: 'Horas (Formato)', key: 'horasFmt', width: 16 },
    { header: 'Tarifa Base (S/.)', key: 'tarifaBase', width: 16 },
    { header: 'Cursos y Estaciones Realizadas', key: 'cursos', width: 45 },
    { header: 'TOTAL A PAGAR (S/.)', key: 'totalPagar', width: 20 },
    { header: 'Estado Liquidación', key: 'estado', width: 18 },
  ];

  // Estilo de la cabecera
  const headerRow = wsPlanilla.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D346C' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  actores.forEach((act, idx) => {
    const detalleCursos = Array.from(act.cursosMap.values())
      .map((c) => `${c.cursoNombre} (${c.horas.toFixed(1)}h × S/.${c.tarifa.toFixed(2)} = S/.${c.subtotal.toFixed(2)})`)
      .join(' | ');

    const row = wsPlanilla.addRow({
      num: idx + 1,
      dni: act.dni,
      apellidos: act.apellidos,
      nombres: act.nombres,
      correo: act.correo || '—',
      sesiones: act.totalSesiones,
      horasDec: act.horasDecimal,
      horasFmt: act.horasFormato,
      tarifaBase: act.tarifaHoraBase ? act.tarifaHoraBase : 'Por curso',
      cursos: detalleCursos,
      totalPagar: act.totalAPagar,
      estado: act.estadoPlanilla === 'listo' ? 'Listo para Pago' : 'Turno en Curso',
    });

    row.height = 22;

    // Formato de moneda
    const celdaPagar = row.getCell('totalPagar');
    celdaPagar.numFmt = '"S/." #,##0.00';
    celdaPagar.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF16A34A' } };

    // Alineaciones
    row.getCell('num').alignment = { horizontal: 'center' };
    row.getCell('dni').alignment = { horizontal: 'center' };
    row.getCell('sesiones').alignment = { horizontal: 'center' };
    row.getCell('horasDec').alignment = { horizontal: 'center' };
    row.getCell('horasFmt').alignment = { horizontal: 'center' };
    row.getCell('tarifaBase').alignment = { horizontal: 'center' };
    row.getCell('totalPagar').alignment = { horizontal: 'right' };
    row.getCell('estado').alignment = { horizontal: 'center' };

    // Color condicional estado
    const estadoCell = row.getCell('estado');
    if (act.estadoPlanilla === 'listo') {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      estadoCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF16A34A' } };
    } else {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      estadoCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFD97706' } };
    }

    if (idx % 2 === 1) {
      row.eachCell((cell, colNumber) => {
        if (colNumber !== 12) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      });
    }
  });

  // Fila Total General
  const totalSesionesGeneral = actores.reduce((sum, a) => sum + a.totalSesiones, 0);
  const totalRow = wsPlanilla.addRow({
    num: '',
    dni: '',
    apellidos: 'TOTAL GENERAL',
    nombres: '',
    correo: '',
    sesiones: totalSesionesGeneral,
    horasDec: Number(kpis.totalHorasDecimal),
    horasFmt: kpis.totalHorasFormato,
    tarifaBase: '',
    cursos: 'Liquidación Consolidada Finanzas UCS',
    totalPagar: kpis.totalMontoGral,
    estado: 'Consolidado',
  });
  totalRow.height = 26;
  totalRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0D346C' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = {
      top: { style: 'double', color: { argb: 'FF0D346C' } },
      bottom: { style: 'double', color: { argb: 'FF0D346C' } },
    };
  });
  totalRow.getCell('totalPagar').numFmt = '"S/." #,##0.00';
  totalRow.getCell('totalPagar').font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF16A34A' } };

  wsPlanilla.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 12 },
  };

  // =========================================================================
  // HOJA 3: DETALLE DE SESIONES INDIVIDUALES
  // =========================================================================
  const wsSesiones = workbook.addWorksheet('Detalle de Sesiones', {
    views: [{ showGridLines: true }],
  });

  wsSesiones.columns = [
    { header: '#', key: 'num', width: 6 },
    { header: 'Fecha', key: 'fecha', width: 13 },
    { header: 'DNI', key: 'dni', width: 12 },
    { header: 'Actor / Paciente Simulado', key: 'actor', width: 28 },
    { header: 'Campus / Sede', key: 'sede', width: 16 },
    { header: 'Sala / Ambiente', key: 'sala', width: 20 },
    { header: 'Curso / Asignatura', key: 'curso', width: 28 },
    { header: 'Hora Ingreso', key: 'ingreso', width: 14 },
    { header: 'Hora Salida', key: 'salida', width: 14 },
    { header: 'Duración', key: 'duracion', width: 14 },
    { header: 'Horas (Dec)', key: 'horasDec', width: 13 },
    { header: 'Tarifa (S/.)', key: 'tarifa', width: 14 },
    { header: 'Subtotal (S/.)', key: 'subtotal', width: 16 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Observaciones / Auditoría', key: 'obs', width: 32 },
  ];

  const headerSesiones = wsSesiones.getRow(1);
  headerSesiones.height = 28;
  headerSesiones.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D346C' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  let sesionIdx = 1;
  actores.forEach((act) => {
    if (act.asistenciasActor && act.asistenciasActor.length > 0) {
      act.asistenciasActor.forEach((asist) => {
        const minutos = asist.minutosTotales || 0;
        const horasSesion = minutos / 60;
        const h = Math.floor(minutos / 60);
        const m = minutos % 60;

        let tarifa = 0;
        if (asist.cursoTarifaHoraPs !== undefined && asist.cursoTarifaHoraPs !== null && asist.cursoTarifaHoraPs !== '') {
          tarifa = Number(asist.cursoTarifaHoraPs);
        } else if (act.tarifaHoraBase) {
          tarifa = act.tarifaHoraBase;
        }
        const subtotal = horasSesion * tarifa;

        const dIng = new Date(asist.horaIngreso);
        const hIng = dIng.toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' });
        const hSal = asist.horaSalida
          ? new Date(asist.horaSalida).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })
          : 'En curso';

        const row = wsSesiones.addRow({
          num: sesionIdx++,
          fecha: asist.fecha,
          dni: act.dni,
          actor: `${act.apellidos}, ${act.nombres}`,
          sede: asist.sedeNombre,
          sala: asist.ambienteNombre || 'Simulación Clínica',
          curso: asist.cursoNombre || 'Simulación General',
          ingreso: hIng,
          salida: hSal,
          duracion: `${h}h ${m}m`,
          horasDec: Number(horasSesion.toFixed(2)),
          tarifa: tarifa > 0 ? tarifa : 'N/A',
          subtotal: Number(subtotal.toFixed(2)),
          estado: asist.estado === 'finalizado' ? 'Finalizado' : 'En Curso',
          obs: asist.motivoModificacion || asist.observaciones || '—',
        });

        row.height = 20;
        row.getCell('subtotal').numFmt = '"S/." #,##0.00';

        row.getCell('num').alignment = { horizontal: 'center' };
        row.getCell('fecha').alignment = { horizontal: 'center' };
        row.getCell('dni').alignment = { horizontal: 'center' };
        row.getCell('ingreso').alignment = { horizontal: 'center' };
        row.getCell('salida').alignment = { horizontal: 'center' };
        row.getCell('duracion').alignment = { horizontal: 'center' };
        row.getCell('horasDec').alignment = { horizontal: 'center' };
        row.getCell('tarifa').alignment = { horizontal: 'center' };
        row.getCell('subtotal').alignment = { horizontal: 'right' };
        row.getCell('estado').alignment = { horizontal: 'center' };
      });
    } else {
      act.cursosMap.forEach((c) => {
        const row = wsSesiones.addRow({
          num: sesionIdx++,
          fecha: 'Período',
          dni: act.dni,
          actor: `${act.apellidos}, ${act.nombres}`,
          sede: 'Sede Asignada',
          sala: 'Simulación Clínica',
          curso: c.cursoNombre,
          ingreso: '—',
          salida: '—',
          duracion: `${c.horas.toFixed(1)} hrs`,
          horasDec: Number(c.horas.toFixed(2)),
          tarifa: c.tarifa > 0 ? c.tarifa : 'N/A',
          subtotal: Number(c.subtotal.toFixed(2)),
          estado: act.estadoPlanilla === 'listo' ? 'Listo para Pago' : 'En Curso',
          obs: 'Registro consolidado por curso',
        });

        row.height = 20;
        row.getCell('subtotal').numFmt = '"S/." #,##0.00';

        row.getCell('num').alignment = { horizontal: 'center' };
        row.getCell('fecha').alignment = { horizontal: 'center' };
        row.getCell('dni').alignment = { horizontal: 'center' };
        row.getCell('ingreso').alignment = { horizontal: 'center' };
        row.getCell('salida').alignment = { horizontal: 'center' };
        row.getCell('duracion').alignment = { horizontal: 'center' };
        row.getCell('horasDec').alignment = { horizontal: 'center' };
        row.getCell('tarifa').alignment = { horizontal: 'center' };
        row.getCell('subtotal').alignment = { horizontal: 'right' };
        row.getCell('estado').alignment = { horizontal: 'center' };
      });
    }
  });

  wsSesiones.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 15 },
  };

  // Descarga del archivo
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `Planilla_PS_${slugCorte}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
