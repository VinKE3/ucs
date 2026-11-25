import type { PermutaCadenaPaso } from '@/types/admin';

export const COURSE_PALETTE = [
  { bg: 'rgba(2, 132, 199, 0.14)', border: 'rgba(2, 132, 199, 0.45)' },
  { bg: 'rgba(139, 92, 246, 0.14)', border: 'rgba(139, 92, 246, 0.45)' },
  { bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.45)' },
  { bg: 'rgba(99, 102, 241, 0.14)', border: 'rgba(99, 102, 241, 0.45)' },
  { bg: 'rgba(236, 72, 153, 0.14)', border: 'rgba(236, 72, 153, 0.45)' },
  { bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.45)' },
  { bg: 'rgba(20, 184, 166, 0.14)', border: 'rgba(20, 184, 166, 0.45)' },
] as const;

/**
 * Devuelve un color determinista para un nombre de curso en los diagramas Gantt logísticos.
 */
export function getCourseColor(courseName: string) {
  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = (hash << 5) - hash + courseName.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % COURSE_PALETTE.length;
  return COURSE_PALETTE[idx];
}

/**
 * Formatea minutos desde medianoche a "HH:MM".
 */
export function formatMinutesToHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Genera la regla horaria estándar de 07:00 a 22:00 en intervalos de 30 minutos.
 */
export function buildHubTimeSlots(): Array<{ label: string; mins: number; esHoraEnPunto: boolean }> {
  const slots: Array<{ label: string; mins: number; esHoraEnPunto: boolean }> = [];
  for (let h = 7; h <= 22; h++) {
    slots.push({
      label: `${h.toString().padStart(2, '0')}:00`,
      mins: h * 60,
      esHoraEnPunto: true,
    });
    if (h < 22) {
      slots.push({
        label: `${h.toString().padStart(2, '0')}:30`,
        mins: h * 60 + 30,
        esHoraEnPunto: false,
      });
    }
  }
  return slots;
}

/**
 * Calcula una fecha YYYY-MM-DD desplazada N días (en UTC sin desfase de huso horario).
 */
export function getOffsetDateStr(dateStr: string, offsetDays: number = 1): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  const date = new Date(Date.UTC(y, m - 1, d + offsetDays));
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * Construye el texto estructurado de propuesta de reubicación en cadena para Coordinación / WhatsApp.
 */
export function buildPropuestaCadenaText(params: {
  historialPermutas: PermutaCadenaPaso[];
  nombreSede: string;
  fecha: string;
  fechaComparacion: string;
  continuidadesGanadas: number;
}): string {
  const { historialPermutas, nombreSede, fecha, fechaComparacion, continuidadesGanadas } = params;
  const lineasPasos = historialPermutas.map((p, idx) => {
    const num = idx + 1;
    const interc = p.sesionDesplazadaTitulo
      ? `\n   ↳ 🔄 Intercambio con: "${p.sesionDesplazadaCaso || p.sesionDesplazadaTitulo}"`
      : '\n   ↳ ➡️ Movido a sala libre';
    const logro = p.logroContinuidadDestino
      ? `\n   ↳ ✨ Beneficio: ${p.ambienteDestinoNombre} amanece 100% armada con este caso (0 acarreo).`
      : '';
    return `${num}️⃣ *Mover:* ${p.sesionOrigenTitulo}${p.sesionOrigenCaso ? ` ("${p.sesionOrigenCaso}")` : ''}\n   *De:* ${p.ambienteOrigenNombre} ➔ *A:* ${p.ambienteDestinoNombre}${interc}${logro}`;
  });

  return `📋 *PROPUESTA DE REUBICACIÓN DE SALAS PARA MAÑANA*
📍 *Sede:* ${nombreSede}
📅 *Cierre:* ${fecha} (22:00) ➔ *Apertura:* ${fechaComparacion} (07:00)

Estimada Coordinación, para optimizar la logística técnica, evitar desmontajes nocturnos y suprimir el acarreo pesado de torres y simuladores, proponemos la siguiente reubicación en cadena de asignaciones matutinas:

${lineasPasos.join('\n\n')}

📈 *Impacto Operativo:*
• ${continuidadesGanadas > 0 ? `+${continuidadesGanadas} salas adicionales quedan con CONTINUIDAD TOTAL.` : 'Salas optimizadas para reducir traslados.'}
• Cero riesgo de retraso en la apertura matutina (ambientes amanecen listos).

_Generado desde el Hub Logístico de Simulación UCS._`;
}

/**
 * Construye la guía rápida de movimientos para aplicar manualmente en SimClic.
 */
export function buildGuiaSimclicText(params: {
  historialPermutas: PermutaCadenaPaso[];
  nombreSede: string;
  fechaComparacion: string;
  continuidadesGanadas: number;
}): string {
  const { historialPermutas, nombreSede, fechaComparacion, continuidadesGanadas } = params;
  const lineas: string[] = [];
  lineas.push(`📋 *GUÍA RÁPIDA DE REUBICACIÓN PARA SIMCLIC*`);
  lineas.push(`📍 *Sede:* ${nombreSede}`);
  lineas.push(`📅 *Fecha de Mañana:* ${fechaComparacion} (Apertura 07:00)`);
  lineas.push(``);
  lineas.push(
    `Estimado técnico, para evitar desmontajes y traslados pesados durante la noche, realiza estos ${historialPermutas.length} movimientos en SimClic:`
  );
  lineas.push(``);

  historialPermutas.forEach((p, idx) => {
    lineas.push(`${idx + 1}️⃣ *Mover:* ${p.sesionOrigenTitulo}${p.sesionOrigenCaso ? ` ("${p.sesionOrigenCaso}")` : ''}`);
    lineas.push(`   *De:* [${p.ambienteOrigenNombre}] ➔ *A:* [${p.ambienteDestinoNombre}]`);
    if (p.sesionDesplazadaTitulo) {
      lineas.push(
        `   *Intercambio con:* ${p.sesionDesplazadaTitulo}${p.sesionDesplazadaCaso ? ` ("${p.sesionDesplazadaCaso}")` : ''}`
      );
    }
    if (p.logroContinuidadDestino) {
      lineas.push(`   ↳ ✨ *Beneficio:* [${p.ambienteDestinoNombre}] ya tiene este set montado de anoche (0 acarreo).`);
    }
    lineas.push(``);
  });

  lineas.push(`🎉 *RESULTADO LOGÍSTICO TOTAL:*`);
  lineas.push(`• +${continuidadesGanadas} salas adicionales amanecen 100% armadas y listas para las 07:00 AM.`);
  lineas.push(`• Cero necesidad de desmontar ni acarrear simuladores pesados.`);
  lineas.push(``);
  lineas.push(`_Generado por el Hub Logístico de Simulación UCS_`);

  return lineas.join('\n');
}
