import ExcelJS from 'exceljs';
import type { IncidenciaAdminItem, IncidenciasMetricsData } from '@/types/admin';

interface ExportarSosOptions {
  incidencias: IncidenciaAdminItem[];
  metricas: IncidenciasMetricsData | null;
  filtroRangoTexto: string;
  sedeNombreFiltro?: string;
}

/**
 * Dibuja un gráfico de dona en un elemento canvas en memoria y retorna su Base64 PNG.
 */
function generarGraficoDonaCategorias(
  categorias: Array<{ categoria: string; total: number; color?: string; icono?: string }>
): string {
  if (typeof window === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 620;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Fondo blanco con esquinas suaves
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Título
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Distribución de Requerimientos por Motivo', 20, 30);

  const total = categorias.reduce((sum, c) => sum + c.total, 0);
  if (total === 0) {
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Sin datos registrados en el período', 20, 80);
    return canvas.toDataURL('image/png');
  }

  // Parámetros de la dona
  const centerX = 160;
  const centerY = 175;
  const outerRadius = 110;
  const innerRadius = 60;

  const defaultColors = ['#ff5a00', '#38bdf8', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#64748b'];

  let startAngle = -Math.PI / 2;

  categorias.slice(0, 7).forEach((cat, idx) => {
    const sliceAngle = (cat.total / total) * (2 * Math.PI);
    const endAngle = startAngle + sliceAngle;
    const color = cat.color || defaultColors[idx % defaultColors.length];

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
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total.toString(), centerX, centerY - 6);

  ctx.font = '11px Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('ALERTAS', centerX, centerY + 16);

  // Leyenda a la derecha
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let legendY = 65;

  categorias.slice(0, 7).forEach((cat, idx) => {
    const color = cat.color || defaultColors[idx % defaultColors.length];
    const pct = Math.round((cat.total / total) * 100);

    // Cuadrado de color
    ctx.fillStyle = color;
    ctx.fillRect(320, legendY - 12, 14, 14);

    // Texto de categoría
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    const catLabel = cat.categoria.length > 22 ? cat.categoria.slice(0, 20) + '...' : cat.categoria;
    ctx.fillText(catLabel, 342, legendY);

    // Cantidad y porcentaje
    ctx.font = 'normal 12px Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${cat.total} (${pct}%)`, 530, legendY);

    legendY += 32;
  });

  return canvas.toDataURL('image/png');
}

/**
 * Dibuja un gráfico de barras horarias (07:00 a 22:00) y retorna su Base64 PNG.
 */
function generarGraficoBarrasHorarias(
  distribucionHoras?: Array<{ hora: number; label: string; total: number }>
): string {
  if (typeof window === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 680;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Título
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Horarios Punta de Incidencias SOS (07:00 a 22:00)', 20, 30);

  // Filtrar rango de 7 a 22
  const horas = (distribucionHoras || []).filter((h) => h.hora >= 7 && h.hora <= 22);
  const maxVal = Math.max(...horas.map((h) => h.total), 3);

  const startX = 50;
  const startY = 240;
  const chartWidth = 600;
  const chartHeight = 175;
  const barWidth = Math.floor(chartWidth / horas.length) - 8;

  // Líneas de fondo
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = startY - (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(startX + chartWidth, y);
    ctx.stroke();

    ctx.font = '10px Arial, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    const val = Math.round((maxVal / 4) * i);
    ctx.fillText(val.toString(), startX - 8, y + 4);
  }

  // Barras
  horas.forEach((item, idx) => {
    const x = startX + idx * (barWidth + 8) + 4;
    const h = item.total > 0 ? (item.total / maxVal) * chartHeight : 2;
    const y = startY - h;

    const isPeak = item.total === maxVal && maxVal > 1;

    // Gradiente de barra
    const grad = ctx.createLinearGradient(0, y, 0, startY);
    if (isPeak) {
      grad.addColorStop(0, '#ff5a00');
      grad.addColorStop(1, '#e64a00');
    } else if (item.total > 0) {
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(1, '#0d346c');
    } else {
      grad.addColorStop(0, '#e2e8f0');
      grad.addColorStop(1, '#cbd5e1');
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, barWidth, h, [4, 4, 0, 0]) : ctx.rect(x, y, barWidth, h);
    ctx.fill();

    // Valor encima de la barra
    if (item.total > 0) {
      ctx.font = 'bold 11px Arial, sans-serif';
      ctx.fillStyle = isPeak ? '#ff5a00' : '#0d346c';
      ctx.textAlign = 'center';
      ctx.fillText(item.total.toString(), x + barWidth / 2, y - 5);
    }

    // Etiqueta hora en el eje X
    ctx.font = '10px Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText(`${item.hora}h`, x + barWidth / 2, startY + 18);
  });

  return canvas.toDataURL('image/png');
}

/**
 * Función principal para exportar a Microsoft Excel (.xlsx) con Dashboard Ejecutivo,
 * Gráficos de alta resolución y Detalle estructurado.
 */
export async function exportarExcelSosConGraficos({
  incidencias,
  metricas,
  filtroRangoTexto,
  sedeNombreFiltro = 'Todas las Sedes',
}: ExportarSosOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Asistencias y Soporte UCS';
  workbook.lastModifiedBy = 'Coordinación de Simulación Clínica';
  workbook.created = new Date();
  workbook.modified = new Date();

  // =========================================================================
  // HOJA 1: DASHBOARD EJECUTIVO & GRÁFICOS
  // =========================================================================
  const wsDash = workbook.addWorksheet('Dashboard Ejecutivo', {
    views: [{ showGridLines: true }],
  });

  // Anchos de columna Hoja 1
  wsDash.columns = [
    { width: 4 },  // A
    { width: 22 }, // B
    { width: 14 }, // C
    { width: 16 }, // D
    { width: 14 }, // E
    { width: 16 }, // F
    { width: 14 }, // G
    { width: 16 }, // H
    { width: 14 }, // I
    { width: 4 },  // J
    { width: 45 }, // K (para gráficos)
    { width: 45 }, // L
  ];

  // 1. Encabezado Institucional
  wsDash.mergeCells('B2:I2');
  const cellTitulo = wsDash.getCell('B2');
  cellTitulo.value = 'UNIVERSIDAD CIENTÍFICA DEL SUR — REPORTE EJECUTIVO DE ALERTAS SOS Y OPERACIONES EN SALAS';
  cellTitulo.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  cellTitulo.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0D346C' }, // Azul Científica
  };
  cellTitulo.alignment = { vertical: 'middle', horizontal: 'center' };
  wsDash.getRow(2).height = 36;

  // 2. Subtítulo con metadata
  wsDash.mergeCells('B3:I3');
  const cellSub = wsDash.getCell('B3');
  cellSub.value = `Período: ${filtroRangoTexto}  |  Sede: ${sedeNombreFiltro}  |  Total Registros: ${incidencias.length}  |  Emitido: ${new Date().toLocaleString('es-PE')}`;
  cellSub.font = { name: 'Arial', size: 9.5, italic: true, color: { argb: 'FF06152D' } };
  cellSub.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' },
  };
  cellSub.alignment = { vertical: 'middle', horizontal: 'center' };
  wsDash.getRow(3).height = 24;

  // 3. Tarjetas KPI
  const kpis = [
    {
      colStart: 'B',
      colEnd: 'C',
      label: 'TOTAL DE ALERTAS',
      val: metricas?.totalHoy ?? incidencias.length,
      bg: 'FFFEE2E2',
      border: 'FFEF4444',
      textCol: 'FFDC2626',
    },
    {
      colStart: 'D',
      colEnd: 'E',
      label: 'RESUELTAS SATISFACTORIAMENTE',
      val: metricas?.resueltasHoy ?? incidencias.filter((i) => i.estado === 'resuelto').length,
      bg: 'FFDCFCE7',
      border: 'FF10B981',
      textCol: 'FF16A34A',
    },
    {
      colStart: 'F',
      colEnd: 'G',
      label: 'RESPUESTA PROMEDIO',
      val: `${metricas?.tiempoPromedioRespuestaMins ?? 0} min`,
      bg: 'FFDBEAFE',
      border: 'FF3B82F6',
      textCol: 'FF2563EB',
    },
    {
      colStart: 'H',
      colEnd: 'I',
      label: 'TASA DE RESOLUCIÓN',
      val: `${metricas?.tasaResolucionPorcentaje ?? (incidencias.length ? Math.round((incidencias.filter((i) => i.estado === 'resuelto').length / incidencias.length) * 100) : 0)}%`,
      bg: 'FFF3E8FF',
      border: 'FFA855F7',
      textCol: 'FF9333EA',
    },
  ];

  wsDash.getRow(5).height = 20;
  wsDash.getRow(6).height = 36;

  kpis.forEach((k) => {
    wsDash.mergeCells(`${k.colStart}5:${k.colEnd}5`);
    const cLabel = wsDash.getCell(`${k.colStart}5`);
    cLabel.value = k.label;
    cLabel.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF475569' } };
    cLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k.bg } };
    cLabel.alignment = { vertical: 'middle', horizontal: 'center' };

    wsDash.mergeCells(`${k.colStart}6:${k.colEnd}6`);
    const cVal = wsDash.getCell(`${k.colStart}6`);
    cVal.value = k.val;
    cVal.font = { name: 'Arial', size: 18, bold: true, color: { argb: k.textCol } };
    cVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k.bg } };
    cVal.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // 4. Tabla Resumen por Motivo / Categoría
  let currentY = 9;
  wsDash.mergeCells(`B${currentY}:E${currentY}`);
  const hCat = wsDash.getCell(`B${currentY}`);
  hCat.value = '🎛️ DISTRIBUCIÓN POR MOTIVO DE ASISTENCIA';
  hCat.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  hCat.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D346C' } };
  hCat.alignment = { vertical: 'middle' };
  wsDash.getRow(currentY).height = 24;

  currentY++;
  wsDash.getCell(`B${currentY}`).value = 'Motivo / Categoría';
  wsDash.getCell(`C${currentY}`).value = 'Total';
  wsDash.getCell(`D${currentY}`).value = '% del Total';
  wsDash.getCell(`E${currentY}`).value = 'Prioridad';
  ['B', 'C', 'D', 'E'].forEach((c) => {
    const cell = wsDash.getCell(`${c}${currentY}`);
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: c === 'B' ? 'left' : 'center' };
  });
  wsDash.getRow(currentY).height = 20;

  const totalAlertas = metricas?.totalHoy || incidencias.length || 1;
  const cats = metricas?.distribucionCategorias || [];

  cats.forEach((cat) => {
    currentY++;
    const pct = Math.round((cat.total / totalAlertas) * 100);
    wsDash.getCell(`B${currentY}`).value = `${cat.icono || '🚨'} ${cat.categoria}`;
    wsDash.getCell(`C${currentY}`).value = cat.total;
    wsDash.getCell(`D${currentY}`).value = `${pct}%`;
    wsDash.getCell(`E${currentY}`).value = pct > 30 ? 'Alta Frecuencia' : 'Normal';

    ['B', 'C', 'D', 'E'].forEach((c) => {
      const cell = wsDash.getCell(`${c}${currentY}`);
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: c === 'B' ? 'left' : 'center' };
    });
    wsDash.getRow(currentY).height = 19;
  });

  // 5. Tabla Top 5 Salas Críticas
  currentY += 2;
  wsDash.mergeCells(`B${currentY}:E${currentY}`);
  const hSalas = wsDash.getCell(`B${currentY}`);
  hSalas.value = '📍 TOP SALAS CON MAYOR INCIDENCIA';
  hSalas.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  hSalas.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D346C' } };
  hSalas.alignment = { vertical: 'middle' };
  wsDash.getRow(currentY).height = 24;

  currentY++;
  wsDash.getCell(`B${currentY}`).value = 'Sala / Ambiente';
  wsDash.getCell(`C${currentY}`).value = 'Campus / Sede';
  wsDash.getCell(`D${currentY}`).value = 'Llamadas';
  wsDash.getCell(`E${currentY}`).value = 'Criticidad';
  ['B', 'C', 'D', 'E'].forEach((c) => {
    const cell = wsDash.getCell(`${c}${currentY}`);
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: c === 'B' ? 'left' : 'center' };
  });
  wsDash.getRow(currentY).height = 20;

  const topSalas = metricas?.topAmbientes || [];
  topSalas.forEach((amb) => {
    currentY++;
    wsDash.getCell(`B${currentY}`).value = amb.ambienteNombre;
    wsDash.getCell(`C${currentY}`).value = amb.sedeNombre;
    wsDash.getCell(`D${currentY}`).value = amb.total;
    wsDash.getCell(`E${currentY}`).value = amb.total >= 3 ? '🔴 Requiere Revisión' : '🟡 Moderado';

    ['B', 'C', 'D', 'E'].forEach((c) => {
      const cell = wsDash.getCell(`${c}${currentY}`);
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: c === 'B' ? 'left' : 'center' };
    });
    wsDash.getRow(currentY).height = 19;
  });

  // 6. Generar e incrustar Gráficos en la Hoja 1
  try {
    const donaPng = generarGraficoDonaCategorias(cats);
    if (donaPng) {
      const imageId1 = workbook.addImage({
        base64: donaPng,
        extension: 'png',
      });
      wsDash.addImage(imageId1, {
        tl: { col: 6, row: 8 },
        ext: { width: 560, height: 280 },
      });
    }

    const barrasPng = generarGraficoBarrasHorarias(metricas?.distribucionHoras);
    if (barrasPng) {
      const imageId2 = workbook.addImage({
        base64: barrasPng,
        extension: 'png',
      });
      wsDash.addImage(imageId2, {
        tl: { col: 6, row: 23 },
        ext: { width: 580, height: 260 },
      });
    }
  } catch (err) {
    console.warn('No se pudieron incrustar los gráficos en el Excel:', err);
  }

  // =========================================================================
  // HOJA 2: DETALLE DE INCIDENCIAS
  // =========================================================================
  const wsDetalle = workbook.addWorksheet('Detalle Incidencias', {
    views: [{ showGridLines: true }],
  });

  wsDetalle.columns = [
    { header: '# ID', key: 'id', width: 8 },
    { header: 'Fecha', key: 'fecha', width: 13 },
    { header: 'Hora', key: 'hora', width: 10 },
    { header: 'Sede / Campus', key: 'sede', width: 22 },
    { header: 'Sala / Ambiente', key: 'ambiente', width: 26 },
    { header: 'Terminal', key: 'terminal', width: 16 },
    { header: 'Motivo de Asistencia', key: 'categoria', width: 26 },
    { header: 'Docente Solicitante', key: 'docente', width: 28 },
    { header: 'Curso / Escenario', key: 'curso', width: 28 },
    { header: 'Estado', key: 'estado', width: 15 },
    { header: 'Técnico Asignado', key: 'tecnico', width: 24 },
    { header: 'Tiempo Resp. (min)', key: 'tiempoResp', width: 18 },
    { header: 'Cumplimiento SLA', key: 'sla', width: 18 },
    { header: 'Tiempo Soluc. (min)', key: 'tiempoSoluc', width: 18 },
    { header: 'Motivo Resolución', key: 'motivoRes', width: 24 },
    { header: 'Observaciones / Nota Técnica', key: 'nota', width: 35 },
  ];

  // Estilo cabecera Detalle
  const rowHeader = wsDetalle.getRow(1);
  rowHeader.height = 28;
  rowHeader.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0D346C' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Filas de incidencias
  incidencias.forEach((inc, idx) => {
    const d = new Date(inc.createdAt);
    const fecha = d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

    let slaLabel = 'Sin datos';
    if (inc.tiempoRespuestaMinutos !== null && inc.tiempoRespuestaMinutos !== undefined) {
      if (inc.tiempoRespuestaMinutos < 5) slaLabel = '🟢 Excelente (<5m)';
      else if (inc.tiempoRespuestaMinutos <= 10) slaLabel = '🟡 Normal (5-10m)';
      else slaLabel = '🔴 Demorado (>10m)';
    }

    const row = wsDetalle.addRow({
      id: inc.id,
      fecha,
      hora,
      sede: inc.sedeNombre,
      ambiente: inc.ambienteNombre,
      terminal: inc.terminalNombre || 'PC Aula Principal',
      categoria: inc.categoria,
      docente: inc.docenteNombre || 'No identificado',
      curso: inc.cursoNombre || 'No especificado',
      estado: inc.estado.toUpperCase().replace('_', ' '),
      tecnico: inc.tecnicoNombre || 'Equipo Guardia',
      tiempoResp: inc.tiempoRespuestaMinutos !== null ? inc.tiempoRespuestaMinutos : '',
      sla: slaLabel,
      tiempoSoluc: inc.tiempoResolucionMinutos !== null ? inc.tiempoResolucionMinutos : '',
      motivoRes: inc.motivoResolucion || '',
      nota: inc.notaResolucion || inc.descripcion || '',
    });

    row.height = 22;

    // Colores condicionales en celda de estado
    const estadoCell = row.getCell('estado');
    if (inc.estado === 'resuelto') {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      estadoCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF16A34A' } };
    } else if (inc.estado === 'en_camino') {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      estadoCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFD97706' } };
    } else if (inc.estado === 'pendiente') {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      estadoCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFDC2626' } };
    }

    // Alineaciones
    row.getCell('id').alignment = { horizontal: 'center' };
    row.getCell('fecha').alignment = { horizontal: 'center' };
    row.getCell('hora').alignment = { horizontal: 'center' };
    row.getCell('estado').alignment = { horizontal: 'center' };
    row.getCell('tiempoResp').alignment = { horizontal: 'center' };
    row.getCell('tiempoSoluc').alignment = { horizontal: 'center' };
    row.getCell('sla').alignment = { horizontal: 'center' };

    // Fondo alterno suave estilo cebra
    if (idx % 2 === 1) {
      row.eachCell((cell, colNumber) => {
        if (colNumber !== 10) { // no sobreescribir el color del estado
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      });
    }
  });

  // Habilitar Autofiltro en la cabecera
  wsDetalle.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 16 },
  };

  // 7. Descargar archivo en el navegador
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const fechaHoyStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `UCS_Dashboard_SOS_Salas_${fechaHoyStr}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
