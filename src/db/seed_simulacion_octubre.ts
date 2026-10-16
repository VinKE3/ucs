import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

const SEED_TAG = '[SIM_OCT2026]';

// 1. TÉCNICOS OFICIALES DE LA CLÍNICA (Sede Villa)
const TECNICOS = [
  // Turno Mañana (06:00 - 15:00)
  { id: 10, nombre: 'Hugo Cruz Rengifo',             dni: '00119519', entrada: '06:00', salida: '15:00' },
  { id: 8,  nombre: 'Maykol Javier Palacios Pesantes', dni: '46269338', entrada: '06:00', salida: '15:00' },
  { id: 11, nombre: 'David Antony Poma Ramos',        dni: '74195503', entrada: '06:00', salida: '15:00' },
  { id: 12, nombre: 'Juan Manuel Torvisco Tuesta',   dni: '41704536', entrada: '06:00', salida: '15:00' },
  { id: 13, nombre: 'Jean Pieer Pinchi Bernuy Ortiz', dni: '72455873', entrada: '06:00', salida: '15:00' },
  { id: 14, nombre: 'Sebastián Gabriel Puma Beltran', dni: '81161551', entrada: '06:00', salida: '15:00' },
  // Turno Tarde (13:00 - 22:00)
  { id: 5,  nombre: 'Kevin Jesús Muñoz Nieto',       dni: '49074636', entrada: '13:00', salida: '22:00' },
  { id: 7,  nombre: 'Jose Humberto Calderon Castro', dni: '43658704', entrada: '13:00', salida: '22:00' },
  { id: 9,  nombre: 'German Elias Flores Castro',    dni: '42102991', entrada: '13:00', salida: '22:00' },
  // Turno Intermedio / Jornada (09:00 - 18:00)
  { id: 6,  nombre: 'Miguel Angel Quispe Estrella',  dni: '41021521', entrada: '09:00', salida: '18:00' },
];

const SEDE_VILLA = 1;

// Días de la quincena (1 al 15 de octubre)
const DIAS_QUINCENA = [
  { fecha: '2026-10-01', tipo: 'laborable', desc: 'Jueves' },
  { fecha: '2026-10-02', tipo: 'laborable', desc: 'Viernes' },
  { fecha: '2026-10-03', tipo: 'sabado',    desc: 'Sábado' },
  { fecha: '2026-10-05', tipo: 'laborable', desc: 'Lunes' },
  { fecha: '2026-10-06', tipo: 'laborable', desc: 'Martes' },
  { fecha: '2026-10-07', tipo: 'laborable', desc: 'Miércoles' },
  { fecha: '2026-10-08', tipo: 'feriado',   desc: 'Jueves (Combate de Angamos)' },
  { fecha: '2026-10-09', tipo: 'laborable', desc: 'Viernes' },
  { fecha: '2026-10-10', tipo: 'sabado',    desc: 'Sábado' },
  { fecha: '2026-10-12', tipo: 'laborable', desc: 'Lunes' },
  { fecha: '2026-10-13', tipo: 'laborable', desc: 'Martes' },
  { fecha: '2026-10-14', tipo: 'laborable', desc: 'Miércoles' },
  { fecha: '2026-10-15', tipo: 'laborable', desc: 'Jueves (Corte 1ra Quincena)' },
];

function toIsoLima(fecha: string, hora: string, desfaseMin: number = 0): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, min] = hora.split(':').map(Number);
  let totalMin = h * 60 + min + desfaseMin;
  if (totalMin < 0) totalMin = 0;
  const finalH = Math.floor(totalMin / 60) % 24;
  const finalMin = totalMin % 60;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(finalH).padStart(2, '0')}:${String(finalMin).padStart(2, '0')}:00-05:00`;
}

function minDiff(horaInicio: string, horaFin: string): number {
  const [h1, m1] = horaInicio.split(':').map(Number);
  const [h2, m2] = horaFin.split(':').map(Number);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}

async function simularReal() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL no encontrada en .env.local');
    process.exit(1);
  }
  const sql = neon(dbUrl);

  console.log('🧹 Limpiando cualquier dato previo de simulación [SIM_OCT2026]...');
  await sql`
    UPDATE sesiones_programadas 
    SET asistencia_id = NULL, estado_ucs = 'programada'
    WHERE fecha >= '2026-10-01' AND fecha <= '2026-10-15' 
      AND asistencia_id IN (SELECT id FROM asistencias WHERE observaciones LIKE '%[SIM_OCT2026]%');
  `;
  await sql`
    DELETE FROM auditoria_asistencias
    WHERE asistencia_id IN (SELECT id FROM asistencias WHERE observaciones LIKE '%[SIM_OCT2026]%');
  `;
  await sql`
    DELETE FROM asistencias
    WHERE observaciones LIKE '%[SIM_OCT2026]%';
  `;
  console.log('✅ Base de datos limpia de simulaciones anteriores.\n');

  let totalAsistencias = 0;

  // =========================================================================
  // 1. SIMULACIÓN DE TÉCNICOS DE SIMULACIÓN (CONTROL DE TURNOS Y AUDITORÍA)
  // =========================================================================
  console.log('👷 Generando asistencias de TÉCNICOS (10 colaboradores)...');
  let tecCount = 0;

  for (const dia of DIAS_QUINCENA) {
    const { fecha, tipo } = dia;

    // A) En días feriados (08 de octubre), solo guardia de 2 técnicos
    if (tipo === 'feriado') {
      const guardias = [
        { tec: TECNICOS[0], entrada: '06:00', salida: '15:00', obs: 'Guardia feriado Angamos - Turno Mañana' },
        { tec: TECNICOS[6], entrada: '13:00', salida: '22:00', obs: 'Guardia feriado Angamos - Turno Tarde' },
      ];
      for (const g of guardias) {
        const hIngreso = toIsoLima(fecha, g.entrada, -3);
        const hSalida = toIsoLima(fecha, g.salida, 5);
        await sql`
          INSERT INTO asistencias (
            usuario_id, sede_id, ambiente_id, curso_id, fecha,
            hora_ingreso, hora_salida, minutos_totales,
            hora_entrada_programada, hora_salida_programada,
            minutos_tardanza, minutos_anticipo, minutos_extra,
            estado_asistencia, tipo_registro, observaciones
          ) VALUES (
            ${g.tec.id}, ${SEDE_VILLA}, NULL, NULL, ${fecha},
            ${hIngreso}, ${hSalida}, 548,
            ${g.entrada}, ${g.salida},
            NULL, NULL, 5,
            'finalizado', 'kiosco_autoservicio',
            ${`${SEED_TAG} ${g.obs}`}
          );
        `;
        tecCount++;
        totalAsistencias++;
      }
      continue;
    }

    // B) En Sábados, guardia reducida de 3 técnicos de mañana
    if (tipo === 'sabado') {
      const sabadoTecs = [TECNICOS[1], TECNICOS[4], TECNICOS[9]]; // Palacios, Puma, Quispe
      for (const tec of sabadoTecs) {
        const hIngreso = toIsoLima(fecha, '07:00', -4);
        const hSalida = toIsoLima(fecha, '13:00', 8);
        await sql`
          INSERT INTO asistencias (
            usuario_id, sede_id, ambiente_id, curso_id, fecha,
            hora_ingreso, hora_salida, minutos_totales,
            hora_entrada_programada, hora_salida_programada,
            minutos_tardanza, minutos_anticipo, minutos_extra,
            estado_asistencia, tipo_registro, observaciones
          ) VALUES (
            ${tec.id}, ${SEDE_VILLA}, NULL, NULL, ${fecha},
            ${hIngreso}, ${hSalida}, 372,
            '07:00', '13:00',
            NULL, NULL, 8,
            'finalizado', 'kiosco_autoservicio',
            ${`${SEED_TAG} Guardia sábado soporte académico`}
          );
        `;
        tecCount++;
        totalAsistencias++;
      }
      continue;
    }

    // C) Días hábiles regulares (Lunes a Viernes)
    for (let i = 0; i < TECNICOS.length; i++) {
      const tec = TECNICOS[i];

      // Casos específicos de ausentismo justificado
      if (fecha === '2026-10-06' && tec.id === 7) {
        // Jose Calderon permiso institucional
        continue;
      }
      if (fecha === '2026-10-12' && tec.id === 8) {
        // Maykol Palacios día compensatorio
        continue;
      }

      // Caso especial: Olvido de salida cerrado administrativamente (Jean Pinchi el 07/10)
      if (fecha === '2026-10-07' && tec.id === 13) {
        const hIngreso = toIsoLima(fecha, tec.entrada, -2);
        const hSalida = toIsoLima(fecha, tec.salida, 0); // Cerrado a las 15:00
        const inserted = await sql`
          INSERT INTO asistencias (
            usuario_id, sede_id, ambiente_id, curso_id, fecha,
            hora_ingreso, hora_salida, minutos_totales,
            hora_entrada_programada, hora_salida_programada,
            minutos_tardanza, minutos_anticipo, minutos_extra,
            estado_asistencia, tipo_registro, observaciones,
            modificado_por_id, motivo_modificacion
          ) VALUES (
            ${tec.id}, ${SEDE_VILLA}, NULL, NULL, ${fecha},
            ${hIngreso}, ${hSalida}, 542,
            ${tec.entrada}, ${tec.salida},
            NULL, NULL, NULL,
            'finalizado', 'kiosco_autoservicio',
            ${`${SEED_TAG} Regularización: Olvido de marcación de salida en Kiosco`},
            1, 'Cierre administrativo forzado por omisión involuntaria de marcación de salida'
          ) RETURNING id;
        `;
        const asisId = inserted[0].id;
        // Insertar auditoría oficial de la modificación
        await sql`
          INSERT INTO auditoria_asistencias (
            asistencia_id, usuario_admin_id, accion, motivo, datos_anteriores, datos_nuevos
          ) VALUES (
            ${asisId}, 1, 'CIERRE_FORZADO',
            'Colaborador omitió marcación en terminal al culminar guardia. Se valida presencia por cámaras.',
            ${JSON.stringify({ hora_salida: null, estado: 'en_curso' })},
            ${JSON.stringify({ hora_salida: hSalida, estado: 'finalizado' })}
          );
        `;
        tecCount++;
        totalAsistencias++;
        continue;
      }

      // Casos de tardanzas realistas
      let desfaseEntrada = 0;
      let desfaseSalida = 0;
      let minTardanza: number | null = null;
      let minAnticipo: number | null = null;
      let minExtra: number | null = null;
      let detalleObs = 'Marcación puntual en terminal Kiosco';

      if (fecha === '2026-10-06' && tec.id === 10) {
        // Hugo Cruz tardanza 22m por congestión
        desfaseEntrada = 22;
        minTardanza = 22;
        detalleObs = 'Tardanza +22m por congestión en Panamericana Sur';
      } else if (fecha === '2026-10-09' && tec.id === 9) {
        // German Flores tardanza 35m
        desfaseEntrada = 35;
        minTardanza = 35;
        detalleObs = 'Tardanza +35m por demora en transporte público';
      } else if (fecha === '2026-10-13' && tec.id === 13) {
        // Jean Pinchi tardanza 15m
        desfaseEntrada = 15;
        minTardanza = 15;
        detalleObs = 'Tardanza +15m registrada en Kiosco';
      } else if (fecha === '2026-10-02' && tec.id === 12) {
        // Juan Torvisco tardanza 18m
        desfaseEntrada = 18;
        minTardanza = 18;
        detalleObs = 'Tardanza +18m registrada en Kiosco';
      } else if (fecha === '2026-10-05' && tec.id === 11) {
        // David Poma salida anticipada 40m por cita médica
        desfaseSalida = -40;
        minAnticipo = 40;
        detalleObs = 'Retiro anticipado 40m justificado por cita médica';
      } else if (fecha === '2026-10-07' && tec.id === 14) {
        // Sebastián Puma sobretiempo 65m por calibración de simuladores
        desfaseSalida = 65;
        minExtra = 65;
        detalleObs = 'Sobretiempo +65m por calibración y mantenimiento de maniquíes SimMan';
      } else if (fecha === '2026-10-14' && tec.id === 5) {
        // Kevin Muñoz sobretiempo 45m por cierre de examen
        desfaseSalida = 45;
        minExtra = 45;
        detalleObs = 'Sobretiempo +45m por apoyo en cierre de estación ECOE';
      } else {
        // Puntual normal (fluctuación de -4 a +3 min)
        desfaseEntrada = ((i + fecha.charCodeAt(9)) % 7) - 3;
        desfaseSalida = ((i * 2 + fecha.charCodeAt(9)) % 8) - 2;
        if (desfaseSalida > 5) minExtra = desfaseSalida;
      }

      const hIngreso = toIsoLima(fecha, tec.entrada, desfaseEntrada);
      const hSalida = toIsoLima(fecha, tec.salida, desfaseSalida);
      const duracionTurno = minDiff(tec.entrada, tec.salida) - desfaseEntrada + desfaseSalida;

      await sql`
        INSERT INTO asistencias (
          usuario_id, sede_id, ambiente_id, curso_id, fecha,
          hora_ingreso, hora_salida, minutos_totales,
          hora_entrada_programada, hora_salida_programada,
          minutos_tardanza, minutos_anticipo, minutos_extra,
          estado_asistencia, tipo_registro, observaciones
        ) VALUES (
          ${tec.id}, ${SEDE_VILLA}, NULL, NULL, ${fecha},
          ${hIngreso}, ${hSalida}, ${duracionTurno},
          ${tec.entrada}, ${tec.salida},
          ${minTardanza}, ${minAnticipo}, ${minExtra},
          'finalizado', 'kiosco_autoservicio',
          ${`${SEED_TAG} ${detalleObs}`}
        );
      `;
      tecCount++;
      totalAsistencias++;
    }
  }
  console.log(`✅ ${tecCount} asistencias de técnicos insertadas con patrones reales de puntualidad.\n`);

  // =========================================================================
  // 2. SIMULACIÓN DE DOCENTES CRUZADOS CON SESIONES REALES DE SIMCLIC
  // =========================================================================
  console.log('👨‍🏫 Vinculando asistencias de DOCENTES a sesiones reales de SimClic...');

  // Traer sesiones que tienen docente asignado en la BD
  const sesionesDocentes = await sql`
    SELECT 
      sp.id, sp.fecha, sp.hora_inicio, sp.hora_fin, sp.sede_id, sp.ambiente_id,
      sp.curso_id, sp.docente_id, sp.titulo, sp.docente_nombre_simclic
    FROM sesiones_programadas sp
    WHERE sp.fecha >= '2026-10-01' AND sp.fecha <= '2026-10-15'
      AND sp.docente_id IS NOT NULL
      AND sp.ambiente_id IS NOT NULL
    ORDER BY sp.fecha, sp.hora_inicio;
  ` as any[];

  console.log(`   Total de sesiones con docente identificado: ${sesionesDocentes.length}`);

  let docentesMarcados = 0;
  let docentesSinMarcar = 0;

  // Seleccionar una muestra representativa de ~160 sesiones para la quincena (12-16 por día)
  // para balancear volumen y detalle
  const sesionesPorFecha: { [key: string]: any[] } = {};
  for (const s of sesionesDocentes) {
    if (!sesionesPorFecha[s.fecha]) sesionesPorFecha[s.fecha] = [];
    sesionesPorFecha[s.fecha].push(s);
  }

  for (const f of Object.keys(sesionesPorFecha)) {
    const list = sesionesPorFecha[f];
    // Tomar entre 10 y 16 sesiones por día
    const cupoDia = Math.min(list.length, 14);
    const seleccionadas = list.slice(0, cupoDia);

    for (let si = 0; si < seleccionadas.length; si++) {
      const sesion = seleccionadas[si];

      // 10% Sin Marcar (Ausentismo o no registró en Kiosco)
      if ((si + f.charCodeAt(9)) % 9 === 0) {
        docentesSinMarcar++;
        // No se inserta asistencia, queda en estado 'programada' para alertar "Sin marcar"
        continue;
      }

      // 15% Tardanza de docente (llega 8 a 22 min tarde)
      const esTardanza = (si + f.charCodeAt(8)) % 6 === 0;
      const desfaseInicio = esTardanza ? ((si * 7) % 15) + 8 : -Math.floor(Math.random() * 8 + 3); // Llega 3-10m antes si es puntual
      const desfaseFin = Math.floor(Math.random() * 8); // Se retira 0-8m después de fin

      const hIngreso = toIsoLima(sesion.fecha, sesion.hora_inicio, desfaseInicio);
      const hSalida = toIsoLima(sesion.fecha, sesion.hora_fin, desfaseFin);
      const duracionClase = minDiff(sesion.hora_inicio, sesion.hora_fin) - desfaseInicio + desfaseFin;
      const minTardanza = esTardanza ? desfaseInicio : null;

      const tardanzaTexto = esTardanza ? ` (Tardanza +${desfaseInicio}m)` : '';
      const obs = `${SEED_TAG} Docente en sala: ${sesion.titulo}${tardanzaTexto}`;

      const inserted = await sql`
        INSERT INTO asistencias (
          usuario_id, sede_id, ambiente_id, curso_id, fecha,
          hora_ingreso, hora_salida, minutos_totales,
          minutos_tardanza,
          estado_asistencia, tipo_registro, observaciones
        ) VALUES (
          ${sesion.docente_id}, ${sesion.sede_id || SEDE_VILLA}, ${sesion.ambiente_id}, ${sesion.curso_id}, ${sesion.fecha},
          ${hIngreso}, ${hSalida}, ${duracionClase},
          ${minTardanza},
          'finalizado', 'kiosco_autoservicio', ${obs}
        ) RETURNING id;
      `;

      // Vincular sesión de SimClic con la asistencia generada
      await sql`
        UPDATE sesiones_programadas 
        SET asistencia_id = ${inserted[0].id}, estado_ucs = 'finalizada'
        WHERE id = ${sesion.id};
      `;

      docentesMarcados++;
      totalAsistencias++;
    }
  }

  console.log(`✅ ${docentesMarcados} asistencias docentes registradas y vinculadas.`);
  console.log(`🚨 ${docentesSinMarcar} sesiones programadas marcadas como "Sin marcar" para auditoría preventiva.\n`);

  // =========================================================================
  // 3. SIMULACIÓN DE PACIENTES SIMULADOS (PS) (PLANILLA MENSUAL Y FINANZAS)
  // =========================================================================
  console.log('🎭 Generando asistencias de PACIENTES SIMULADOS para la 1ra Quincena...');

  // Traer los 41 Pacientes Simulados de la BD
  const psList = await sql`
    SELECT id, dni, nombres, apellidos, tarifa_hora 
    FROM usuarios 
    WHERE tipo_personal = 'paciente_simulado'
    ORDER BY id;
  ` as any[];

  // Traer sesiones de cursos clínicos que requieren actuación de paciente simulado
  const sesionesParaPs = await sql`
    SELECT 
      sp.id, sp.fecha, sp.hora_inicio, sp.hora_fin, sp.sede_id, sp.ambiente_id,
      sp.curso_id, sp.titulo, c.nombre as curso_nombre, c.tarifa_hora_ps
    FROM sesiones_programadas sp
    JOIN cursos c ON sp.curso_id = c.id
    WHERE sp.fecha >= '2026-10-01' AND sp.fecha <= '2026-10-15'
      AND sp.ambiente_id IS NOT NULL
      AND (
        c.prefijo IN ('SIMPED', 'SimQx', 'MED_SBS', 'SCI', 'SimGO', 'Ext Med')
        OR LOWER(c.nombre) LIKE '%pediat%'
        OR LOWER(c.nombre) LIKE '%semiolog%'
        OR LOWER(c.nombre) LIKE '%ginecolog%'
        OR LOWER(c.nombre) LIKE '%clínica integrada%'
      )
    ORDER BY sp.fecha, sp.hora_inicio;
  ` as any[];

  console.log(`   Total de sesiones clínicas disponibles para PS: ${sesionesParaPs.length}`);

  // Usar un pool rotativo de 24 Pacientes Simulados para darles carga quincenal realista
  const psActivos = psList.slice(0, 24);
  let psAsistenciasCount = 0;

  // Distribuir entre 4 y 7 actuaciones de PS por día hábil
  const sesionesPsPorFecha: { [key: string]: any[] } = {};
  for (const s of sesionesParaPs) {
    if (!sesionesPsPorFecha[s.fecha]) sesionesPsPorFecha[s.fecha] = [];
    sesionesPsPorFecha[s.fecha].push(s);
  }

  let psIndex = 0;

  for (const f of Object.keys(sesionesPsPorFecha)) {
    const list = sesionesPsPorFecha[f];
    const cupoDia = Math.min(list.length, 6); // 5-6 sesiones de PS por día

    for (let si = 0; si < cupoDia; si++) {
      const sesion = list[si];
      const ps = psActivos[psIndex % psActivos.length];
      psIndex++;

      // PS llega 20-30 min antes para briefing / caracterización
      const briefingMin = 25;
      // PS sale 10 min después por debriefing
      const debriefingMin = 10;

      const hIngreso = toIsoLima(sesion.fecha, sesion.hora_inicio, -briefingMin);
      const hSalida = toIsoLima(sesion.fecha, sesion.hora_fin, debriefingMin);
      const minutosTotales = minDiff(sesion.hora_inicio, sesion.hora_fin) + briefingMin + debriefingMin;

      const obs = `${SEED_TAG} Actuación PS: ${sesion.curso_nombre} - ${sesion.titulo} (Inc. Briefing y Debriefing)`;

      await sql`
        INSERT INTO asistencias (
          usuario_id, sede_id, ambiente_id, curso_id, fecha,
          hora_ingreso, hora_salida, minutos_totales,
          estado_asistencia, tipo_registro, observaciones
        ) VALUES (
          ${ps.id}, ${sesion.sede_id || SEDE_VILLA}, ${sesion.ambiente_id}, ${sesion.curso_id}, ${sesion.fecha},
          ${hIngreso}, ${hSalida}, ${minutosTotales},
          'finalizado', 'kiosco_autoservicio', ${obs}
        );
      `;
      psAsistenciasCount++;
      totalAsistencias++;
    }
  }

  console.log(`✅ ${psAsistenciasCount} asistencias de Pacientes Simulados generadas.\n`);

  console.log('====================================================');
  console.log(`🎉 SIMULACIÓN COMPLETADA CON ÉXITO: ${totalAsistencias} registros generados.`);
  console.log(`   • Técnicos: ${tecCount} asistencias (con tardanzas, anticipos, sobretiempos y auditoría forzada)`);
  console.log(`   • Docentes: ${docentesMarcados} asistencias reales cruzadas con SimClic (${docentesSinMarcar} alertas sin marcar)`);
  console.log(`   • Pacientes Simulados: ${psAsistenciasCount} sesiones para liquidación quincenal`);
  console.log('====================================================');
  process.exit(0);
}

simularReal().catch((err) => {
  console.error('❌ Error fatal en simulación:', err);
  process.exit(1);
});
