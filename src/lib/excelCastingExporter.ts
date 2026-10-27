import ExcelJS from 'exceljs';
import type {
  UsuarioItem,
  CastingRangoEdadItem,
  CastingEspecialidadItem,
  CastingRestriccionItem,
} from '@/types/admin';

interface ExportarCastingOptions {
  actores: UsuarioItem[];
  rangosList?: CastingRangoEdadItem[];
  especialidadesList?: CastingEspecialidadItem[];
  restriccionesList?: CastingRestriccionItem[];
  filtroRangoNombre?: string;
  filtroEspecialidadNombre?: string;
  filtroRestriccionNombre?: string;
  fechaEmision?: string;
}

/**
 * Genera un gráfico de Dona con la cobertura de Especialidades / Casos Clínicos en Canvas.
 */
function generarGraficoDonaEspecialidades(
  especialidadesData: Array<{ nombre: string; count: number; color?: string }>
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
  ctx.fillText('Cobertura por Especialidad y Casos Clínicos ECOE', 20, 30);

  const totalMatch = especialidadesData.reduce((sum, e) => sum + e.count, 0);
  if (totalMatch === 0) {
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Sin especialidades registradas en el grupo', 20, 80);
    return canvas.toDataURL('image/png');
  }

  const centerX = 160;
  const centerY = 170;
  const outerRadius = 105;
  const innerRadius = 58;

  const defaultColors = [
    '#0d346c', // Azul UCS
    '#ff5a00', // Naranja UCS
    '#10b981', // Verde Esmeralda
    '#0284c7', // Azul Cielo
    '#8b5cf6', // Púrpura
    '#f59e0b', // Ámbar
    '#ec4899', // Rosa
    '#06b6d4', // Cyan
  ];

  let startAngle = -Math.PI / 2;

  especialidadesData.slice(0, 7).forEach((esp, idx) => {
    const sliceAngle = (esp.count / totalMatch) * (2 * Math.PI);
    const endAngle = startAngle + sliceAngle;
    const color = esp.color || defaultColors[idx % defaultColors.length];

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
  ctx.fillText(`${totalMatch}`, centerX, centerY - 6);

  ctx.font = '10px Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('HABILIDADES', centerX, centerY + 14);

  // Leyenda
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let legendY = 65;

  especialidadesData.slice(0, 7).forEach((esp, idx) => {
    const color = esp.color || defaultColors[idx % defaultColors.length];
    const pct = Math.round((esp.count / totalMatch) * 100);

    ctx.fillStyle = color;
    ctx.fillRect(320, legendY - 12, 14, 14);

    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    const eLabel = esp.nombre.length > 22 ? esp.nombre.slice(0, 20) + '...' : esp.nombre;
    ctx.fillText(eLabel, 342, legendY);

    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${esp.count} actores (${pct}%)`, 342, legendY + 14);

    legendY += 34;
  });

  return canvas.toDataURL('image/png');
}

/**
 * Genera un gráfico de Barras con la distribución de Rangos Etarios en Canvas.
 */
function generarGraficoBarrasRangosEtarios(
  rangosData: Array<{ nombre: string; count: number; color?: string }>
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
  ctx.fillText('Distribución de Actores por Grupo Etario (Biotipo)', 20, 28);

  const valores = rangosData.map((r) => r.count);
  const maxVal = Math.max(...valores, 1);

  const chartX = 35;
  const chartY = 55;
  const chartW = 560;
  const chartH = 170;
  const barGap = 16;
  const barW = Math.min(75, (chartW - (rangosData.length - 1) * barGap) / Math.max(1, rangosData.length));

  // Encontrar rango más abundante
  let maxPicoIdx = 0;
  let maxPicoVal = 0;
  rangosData.forEach((r, idx) => {
    if (r.count > maxPicoVal) {
      maxPicoVal = r.count;
      maxPicoIdx = idx;
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
  rangosData.forEach((r, idx) => {
    const val = r.count;
    const bHeight = val > 0 ? Math.max(8, (val / maxVal) * (chartH - 25)) : 3;
    const x = chartX + idx * (barW + barGap);
    const y = chartY + chartH - bHeight;

    const esPico = idx === maxPicoIdx && maxPicoVal > 0;
    ctx.fillStyle = esPico ? '#ff5a00' : val > 0 ? '#0d346c' : '#e2e8f0';

    ctx.beginPath();
    ctx.roundRect(x, y, barW, bHeight, 5);
    ctx.fill();

    // Valor encima de la barra
    if (val > 0) {
      ctx.font = esPico ? 'bold 12px Arial, sans-serif' : '11px Arial, sans-serif';
      ctx.fillStyle = esPico ? '#ea580c' : '#334155';
      ctx.textAlign = 'center';
      ctx.fillText(val.toString(), x + barW / 2, y - 6);
    }

    // Etiqueta abajo
    ctx.font = '10px Arial, sans-serif';
    ctx.fillStyle = esPico ? '#0f172a' : '#64748b';
    ctx.textAlign = 'center';
    const labelShort = r.nombre.length > 14 ? r.nombre.slice(0, 12) + '..' : r.nombre;
    ctx.fillText(labelShort, x + barW / 2, chartY + chartH + 16);
  });

  return canvas.toDataURL('image/png');
}

/**
 * Función principal para exportar la Convocatoria de Casting ECOE a Microsoft Excel (.xlsx)
 * con Dashboard Ejecutivo, Gráficos de alta definición, Padrón de Actores y Matriz de Salvaguarda Médica.
 */
export async function exportarExcelCastingConGraficos({
  actores,
  rangosList = [],
  especialidadesList = [],
  restriccionesList = [],
  filtroRangoNombre = 'Todos los Rangos',
  filtroEspecialidadNombre = 'Todas las Especialidades',
  filtroRestriccionNombre = 'Ninguna restricción excluida',
  fechaEmision = new Date().toLocaleString('es-PE'),
}: ExportarCastingOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Control y Simulación Clínica UCS';
  workbook.lastModifiedBy = 'Coordinación de Pacientes Simulados & Casting ECOE';
  workbook.created = new Date();
  workbook.modified = new Date();

  const totalActores = actores.length;

  // Cálculos KPI
  let sumaEdades = 0;
  let conteoConEdad = 0;
  let sumaTarifas = 0;
  let conteoConTarifa = 0;
  let aptosSinRestriccion = 0;

  // Mapa de especialidades
  const espCountMap = new Map<number, number>();
  // Mapa de rangos etarios
  const rangosCountMap = new Map<number, number>();

  actores.forEach((a) => {
    const p = a.castingPerfil;
    if (p?.edadReal && p.edadReal > 0) {
      sumaEdades += p.edadReal;
      conteoConEdad++;
    }
    if (a.tarifaHora && Number(a.tarifaHora) > 0) {
      sumaTarifas += Number(a.tarifaHora);
      conteoConTarifa++;
    }

    const tieneRestricciones = p?.restriccionesIds && p.restriccionesIds.length > 0;
    if (!tieneRestricciones) {
      aptosSinRestriccion++;
    }

    // Especialidades
    (p?.especialidadesIds || []).forEach((id) => {
      espCountMap.set(id, (espCountMap.get(id) || 0) + 1);
    });

    // Rangos
    if (p?.rangoEdadId) {
      rangosCountMap.set(p.rangoEdadId, (rangosCountMap.get(p.rangoEdadId) || 0) + 1);
    }
  });

  const edadPromedio = conteoConEdad > 0 ? (sumaEdades / conteoConEdad).toFixed(1) : '—';
  const tarifaPromedio = conteoConTarifa > 0 ? (sumaTarifas / conteoConTarifa).toFixed(2) : '—';

  // Datos para gráficos
  const especialidadesChartData = especialidadesList
    .map((e) => ({
      nombre: e.nombre,
      count: espCountMap.get(e.id) || 0,
      color: e.color || undefined,
    }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count);

  const rangosChartData = rangosList
    .map((r) => ({
      nombre: r.nombre,
      count: rangosCountMap.get(r.id) || 0,
      color: r.color || undefined,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  // =========================================================================
  // HOJA 1: DASHBOARD EJECUTIVO ECOE
  // =========================================================================
  const wsDash = workbook.addWorksheet('Dashboard Convocatoria', {
    views: [{ showGridLines: true }],
  });

  wsDash.columns = [
    { width: 4 },  // A
    { width: 28 }, // B
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
  cellTitulo.value = 'UNIVERSIDAD CIENTÍFICA DEL SUR — DOSSIER EJECUTIVO DE CASTING Y CONVOCATORIA ECOE';
  cellTitulo.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cellTitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D346C' } };
  cellTitulo.alignment = { vertical: 'middle', horizontal: 'center' };
  wsDash.getRow(2).height = 34;

  // 2. Subtítulo con filtros
  wsDash.mergeCells('B3:I3');
  const cellSub = wsDash.getCell('B3');
  cellSub.value = `Filtros: [Rango: ${filtroRangoNombre}] | [Especialidad: ${filtroEspecialidadNombre}] | [Excluir: ${filtroRestriccionNombre}] | Actores: ${totalActores} | Emisión: ${fechaEmision}`;
  cellSub.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF06152D' } };
  cellSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  cellSub.alignment = { vertical: 'middle', horizontal: 'center' };
  wsDash.getRow(3).height = 24;

  // 3. Tarjetas KPI
  const kpisItems = [
    {
      colStart: 'B',
      colEnd: 'C',
      label: 'ACTORES CONVOCADOS',
      val: `${totalActores} Actores`,
      bg: 'FFDBEAFE',
      border: 'FF0284C7',
      textCol: 'FF0369A1',
    },
    {
      colStart: 'D',
      colEnd: 'E',
      label: 'EDAD PROMEDIO',
      val: edadPromedio !== '—' ? `${edadPromedio} años` : 'N/D',
      bg: 'FFDCFCE7',
      border: 'FF10B981',
      textCol: 'FF16A34A',
    },
    {
      colStart: 'F',
      colEnd: 'G',
      label: 'TARIFA BASE PROMEDIO',
      val: tarifaPromedio !== '—' ? `S/. ${tarifaPromedio}/h` : 'A convenir',
      bg: 'FFFFEDD5',
      border: 'FFFF5A00',
      textCol: 'FFC2410C',
    },
    {
      colStart: 'H',
      colEnd: 'I',
      label: 'APTOS SIN RESTRICCIÓN',
      val: `${aptosSinRestriccion} / ${totalActores}`,
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

  // 4. Tabla de Especialidades Convocadas
  let currentY = 8;
  wsDash.mergeCells(`B${currentY}:F${currentY}`);
  const hEsp = wsDash.getCell(`B${currentY}`);
  hEsp.value = '🩺 COBERTURA DE ESPECIALIDADES & CASOS CLÍNICOS';
  hEsp.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  hEsp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D346C' } };
  hEsp.alignment = { vertical: 'middle' };
  wsDash.getRow(currentY).height = 24;

  currentY++;
  wsDash.getCell(`B${currentY}`).value = 'Especialidad / Caso';
  wsDash.getCell(`C${currentY}`).value = 'Actores';
  wsDash.getCell(`D${currentY}`).value = '% Cobertura';
  wsDash.getCell(`E${currentY}`).value = 'Biotipo Frecuente';
  wsDash.getCell(`F${currentY}`).value = 'Disponibilidad';

  ['B', 'C', 'D', 'E', 'F'].forEach((c) => {
    const cell = wsDash.getCell(`${c}${currentY}`);
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: c === 'B' ? 'left' : 'center' };
  });
  wsDash.getRow(currentY).height = 20;

  if (especialidadesChartData.length === 0) {
    currentY++;
    wsDash.getCell(`B${currentY}`).value = 'Sin especialidades específicas asignadas';
    wsDash.getCell(`C${currentY}`).value = totalActores;
    wsDash.getCell(`D${currentY}`).value = '100%';
    wsDash.getCell(`E${currentY}`).value = 'Estándar';
    wsDash.getCell(`F${currentY}`).value = 'Disponible';
    ['B', 'C', 'D', 'E', 'F'].forEach((col) => {
      const cell = wsDash.getCell(`${col}${currentY}`);
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: col === 'B' ? 'left' : 'center' };
    });
    wsDash.getRow(currentY).height = 19;
  } else {
    especialidadesChartData.slice(0, 8).forEach((esp) => {
      currentY++;
      const pct = totalActores > 0 ? Math.round((esp.count / totalActores) * 100) : 0;
      wsDash.getCell(`B${currentY}`).value = esp.nombre;
      wsDash.getCell(`C${currentY}`).value = esp.count;
      wsDash.getCell(`D${currentY}`).value = `${pct}%`;
      wsDash.getCell(`E${currentY}`).value = pct >= 40 ? '🔴 Prioritario' : '🟢 Apto';
      wsDash.getCell(`F${currentY}`).value = 'Inmediata';

      ['B', 'C', 'D', 'E', 'F'].forEach((col) => {
        const cell = wsDash.getCell(`${col}${currentY}`);
        cell.font = { name: 'Arial', size: 9 };
        cell.alignment = { vertical: 'middle', horizontal: col === 'B' ? 'left' : 'center' };
      });
      wsDash.getRow(currentY).height = 19;
    });
  }

  // 5. Tabla de Rangos Etarios
  currentY += 2;
  wsDash.mergeCells(`B${currentY}:F${currentY}`);
  const hRangos = wsDash.getCell(`B${currentY}`);
  hRangos.value = '🎂 DISTRIBUCIÓN POR RANGO ETARIO';
  hRangos.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  hRangos.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF5A00' } };
  hRangos.alignment = { vertical: 'middle' };
  wsDash.getRow(currentY).height = 24;

  currentY++;
  wsDash.getCell(`B${currentY}`).value = 'Rango Etario';
  wsDash.getCell(`C${currentY}`).value = 'Edad Mín/Máx';
  wsDash.getCell(`D${currentY}`).value = 'Actores';
  wsDash.getCell(`E${currentY}`).value = '% Grupo';
  wsDash.getCell(`F${currentY}`).value = 'Estado';

  ['B', 'C', 'D', 'E', 'F'].forEach((c) => {
    const cell = wsDash.getCell(`${c}${currentY}`);
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: c === 'B' ? 'left' : 'center' };
  });
  wsDash.getRow(currentY).height = 20;

  if (rangosChartData.length === 0) {
    currentY++;
    wsDash.getCell(`B${currentY}`).value = 'Padrón General sin rango asignado';
    wsDash.getCell(`C${currentY}`).value = '18 - 70';
    wsDash.getCell(`D${currentY}`).value = totalActores;
    wsDash.getCell(`E${currentY}`).value = '100%';
    wsDash.getCell(`F${currentY}`).value = 'Activo';
    ['B', 'C', 'D', 'E', 'F'].forEach((col) => {
      const cell = wsDash.getCell(`${col}${currentY}`);
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { vertical: 'middle', horizontal: col === 'B' ? 'left' : 'center' };
    });
    wsDash.getRow(currentY).height = 19;
  } else {
    rangosChartData.slice(0, 6).forEach((rg) => {
      currentY++;
      const pct = totalActores > 0 ? Math.round((rg.count / totalActores) * 100) : 0;
      const rObj = rangosList.find((r) => r.nombre === rg.nombre);
      const edadStr = rObj ? `${rObj.edadMin || 18} - ${rObj.edadMax || 99} años` : 'Sin rango';

      wsDash.getCell(`B${currentY}`).value = rg.nombre;
      wsDash.getCell(`C${currentY}`).value = edadStr;
      wsDash.getCell(`D${currentY}`).value = rg.count;
      wsDash.getCell(`E${currentY}`).value = `${pct}%`;
      wsDash.getCell(`F${currentY}`).value = pct >= 30 ? '⭐ Grupo Principal' : 'Disponible';

      ['B', 'C', 'D', 'E', 'F'].forEach((col) => {
        const cell = wsDash.getCell(`${col}${currentY}`);
        cell.font = { name: 'Arial', size: 9 };
        cell.alignment = { vertical: 'middle', horizontal: col === 'B' ? 'left' : 'center' };
      });
      wsDash.getRow(currentY).height = 19;
    });
  }

  // 6. Generar e incrustar Gráficos en Hoja 1
  try {
    const donaPng = generarGraficoDonaEspecialidades(especialidadesChartData);
    if (donaPng) {
      const img1 = workbook.addImage({ base64: donaPng, extension: 'png' });
      wsDash.addImage(img1, {
        tl: { col: 7, row: 7 },
        ext: { width: 560, height: 270 },
      });
    }

    const barrasPng = generarGraficoBarrasRangosEtarios(rangosChartData);
    if (barrasPng) {
      const img2 = workbook.addImage({ base64: barrasPng, extension: 'png' });
      wsDash.addImage(img2, {
        tl: { col: 7, row: 22 },
        ext: { width: 560, height: 250 },
      });
    }
  } catch (err) {
    console.warn('No se pudieron incrustar los gráficos de casting en Excel:', err);
  }

  // =========================================================================
  // HOJA 2: PADRÓN CONVOCADOS ECOE
  // =========================================================================
  const wsPadron = workbook.addWorksheet('Padrón Convocados ECOE', {
    views: [{ showGridLines: true }],
  });

  wsPadron.columns = [
    { header: '#', key: 'num', width: 6 },
    { header: 'DNI', key: 'dni', width: 14 },
    { header: 'Apellidos', key: 'apellidos', width: 22 },
    { header: 'Nombres', key: 'nombres', width: 22 },
    { header: 'Teléfono Celular', key: 'telefono', width: 18 },
    { header: 'Correo Electrónico', key: 'correo', width: 26 },
    { header: 'Edad Real', key: 'edadReal', width: 12 },
    { header: 'Rango Etario', key: 'rangoEtario', width: 18 },
    { header: 'Género', key: 'genero', width: 14 },
    { header: 'Biotipo', key: 'biotipo', width: 16 },
    { header: 'Tarifa / Hora', key: 'tarifa', width: 16 },
    { header: 'Tope Semanal', key: 'tope', width: 15 },
    { header: 'Especialidades / Casos Clínicos', key: 'especialidades', width: 32 },
    { header: 'Restricciones Físicas', key: 'restricciones', width: 30 },
    { header: 'Disponibilidad Horaria', key: 'disponibilidad', width: 24 },
    { header: 'Contacto Emergencia', key: 'contactoEmergencia', width: 24 },
  ];

  const headerPadron = wsPadron.getRow(1);
  headerPadron.height = 28;
  headerPadron.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D346C' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  actores.forEach((a, idx) => {
    const p = a.castingPerfil;
    const espStr = (p?.especialidadesIds || [])
      .map((id) => especialidadesList.find((e) => e.id === id)?.nombre)
      .filter(Boolean)
      .join(', ') || 'General / Estándar';

    const restStr = (p?.restriccionesIds || [])
      .map((id) => restriccionesList.find((r) => r.id === id)?.nombre)
      .filter(Boolean)
      .join(', ') || 'Sin restricciones';

    const tarifaNum = a.tarifaHora ? Number(a.tarifaHora) : 0;

    const row = wsPadron.addRow({
      num: idx + 1,
      dni: a.dni,
      apellidos: a.apellidos,
      nombres: a.nombres,
      telefono: a.telefono || '—',
      correo: a.correo || '—',
      edadReal: p?.edadReal || '—',
      rangoEtario: p?.rangoEdadNombre || 'General',
      genero: p?.genero || '—',
      biotipo: p?.biotipo || '—',
      tarifa: tarifaNum > 0 ? tarifaNum : 'A convenir',
      tope: a.horasSemanalesMax ? `${a.horasSemanalesMax} hrs` : 'Sin tope',
      especialidades: espStr,
      restricciones: restStr,
      disponibilidad: p?.disponibilidad || 'Tiempo completo / Fines de semana',
      contactoEmergencia: p?.contactoEmergencia || '—',
    });

    row.height = 20;

    row.getCell('num').alignment = { horizontal: 'center' };
    row.getCell('dni').alignment = { horizontal: 'center' };
    row.getCell('telefono').alignment = { horizontal: 'center' };
    row.getCell('edadReal').alignment = { horizontal: 'center' };
    row.getCell('rangoEtario').alignment = { horizontal: 'center' };
    row.getCell('genero').alignment = { horizontal: 'center' };
    row.getCell('biotipo').alignment = { horizontal: 'center' };
    row.getCell('tope').alignment = { horizontal: 'center' };

    if (tarifaNum > 0) {
      row.getCell('tarifa').numFmt = '"S/." #,##0.00';
      row.getCell('tarifa').alignment = { horizontal: 'right' };
    } else {
      row.getCell('tarifa').alignment = { horizontal: 'center' };
    }

    // Formato condicional de restricciones
    const cellRest = row.getCell('restricciones');
    if (restStr !== 'Sin restricciones') {
      cellRest.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      cellRest.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFDC2626' } };
    }

    if (idx % 2 === 1) {
      row.eachCell((cell, colNumber) => {
        if (colNumber !== 14) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      });
    }
  });

  wsPadron.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 16 },
  };

  // =========================================================================
  // HOJA 3: SALVAGUARDA MÉDICA & PROTOCOLO ECOE
  // =========================================================================
  const wsSalva = workbook.addWorksheet('Salvaguarda Médica ECOE', {
    views: [{ showGridLines: true }],
  });

  wsSalva.columns = [
    { header: '#', key: 'num', width: 6 },
    { header: 'DNI', key: 'dni', width: 14 },
    { header: 'Actor Convocado', key: 'actor', width: 28 },
    { header: 'Teléfono', key: 'tel', width: 16 },
    { header: 'Restricción Física / Médica', key: 'restriccion', width: 30 },
    { header: 'Nivel de Severidad', key: 'severidad', width: 20 },
    { header: 'Procedimiento Contraindicado en ECOE', key: 'contraindicacion', width: 38 },
    { header: 'Contacto de Emergencia', key: 'emergencia', width: 26 },
  ];

  const headerSalva = wsSalva.getRow(1);
  headerSalva.height = 28;
  headerSalva.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }; // Rojo salvaguarda
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const actoresConRestricciones = actores.filter(
    (a) => a.castingPerfil?.restriccionesIds && a.castingPerfil.restriccionesIds.length > 0
  );

  if (actoresConRestricciones.length === 0) {
    const rowVacia = wsSalva.addRow({
      num: 1,
      dni: '—',
      actor: 'Todos los actores convocados',
      tel: '—',
      restriccion: 'Sin restricciones médicas reportadas',
      severidad: '🟢 Apto Integral',
      contraindicacion: 'Apto para cualquier maniobra médica o procedimiento no invasivo',
      emergencia: 'Registrado en ficha técnica',
    });
    rowVacia.height = 24;
    rowVacia.getCell('restriccion').font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF16A34A' } };
  } else {
    let sIdx = 1;
    actoresConRestricciones.forEach((a) => {
      const p = a.castingPerfil;
      (p?.restriccionesIds || []).forEach((rId) => {
        const rObj = restriccionesList.find((r) => r.id === rId);
        const rNom = rObj?.nombre || 'Restricción no especificada';
        const rSev = rObj?.nivel === 'critica' ? '🔴 Crítica / No invasivo' : rObj?.nivel === 'moderada' ? '🟡 Moderada' : '🟢 Leve';

        const row = wsSalva.addRow({
          num: sIdx++,
          dni: a.dni,
          actor: `${a.apellidos}, ${a.nombres}`,
          tel: a.telefono || '—',
          restriccion: rNom,
          severidad: rSev,
          contraindicacion: 'Quedan contraindicadas maniobras dolorosas, tactos o punciones reales.',
          emergencia: p?.contactoEmergencia || 'Ver ficha técnica',
        });
        row.height = 20;

        row.getCell('num').alignment = { horizontal: 'center' };
        row.getCell('dni').alignment = { horizontal: 'center' };
        row.getCell('tel').alignment = { horizontal: 'center' };
        row.getCell('severidad').alignment = { horizontal: 'center' };
        row.getCell('restriccion').font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFDC2626' } };
      });
    });
  }

  wsSalva.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 8 },
  };

  // Descarga del libro Excel
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `Convocatoria_ECOE_Casting_UCS_${new Date().toISOString().slice(0, 10)}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
