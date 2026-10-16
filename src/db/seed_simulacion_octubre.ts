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

async function simularMaster() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL no configurada');
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

  // Catálogo de ambientes para simular reubicaciones realistas
  const ambientesVilla = await sql`
    SELECT id, nombre, sede_id FROM ambientes WHERE activo = true ORDER BY id;
  ` as any[];

  let totalAsistencias = 0;

  // =========================================================================
  // 1. TÉCNICOS DE SIMULACIÓN (10 colaboradores de Sede Villa)
  // =========================================================================
  console.log('👷 1. Generando asistencias de TÉCNICOS (10 colaboradores)...');
  let tecCount = 0;

  for (const dia of DIAS_QUINCENA) {
    const { fecha, tipo } = dia;

    // A) Feriado 08 de octubre: 2 técnicos de guardia reducida
    if (tipo === 'feriado') {
      const guardias = [
        { tec: TECNICOS[0], entrada: '06:00', salida: '15:00', obs: 'Guardia feriado Angamos - Turno Mañana' },
        { tec: TECNICOS[6], entrada: '13:00', salida: '22:00', obs: 'Guardia feriado Angamos - Turno Tarde' },
      ];
      for (const g of guardias) {
        const hIngreso = toIsoLima(fecha, g.entrada, -4);
        const hSalida = toIsoLima(fecha, g.salida, 6);
        await sql`
          INSERT INTO asistencias (
            usuario_id, sede_id, ambiente_id, curso_id, fecha,
            hora_ingreso, hora_salida, minutos_totales,
            hora_entrada_programada, hora_salida_programada,
            minutos_tardanza, minutos_anticipo, minutos_extra,
            estado_asistencia, tipo_registro, observaciones
          ) VALUES (
            ${g.tec.id}, ${SEDE_VILLA}, NULL, NULL, ${fecha},
            ${hIngreso}, ${hSalida}, 550,
            ${g.entrada}, ${g.salida},
            NULL, NULL, 6,
            'finalizado', 'kiosco_autoservicio',
            ${`${SEED_TAG} ${g.obs}`}
          );
        `;
        tecCount++;
        totalAsistencias++;
      }
      continue;
    }

    // B) Sábados (03/10 y 10/10): 3 técnicos de soporte matutino
    if (tipo === 'sabado') {
      const sabadoTecs = [TECNICOS[1], TECNICOS[4], TECNICOS[9]]; // Palacios, Puma, Quispe
      for (const tec of sabadoTecs) {
        const hIngreso = toIsoLima(fecha, '07:00', -5);
        const hSalida = toIsoLima(fecha, '13:00', 10);
        await sql`
          INSERT INTO asistencias (
            usuario_id, sede_id, ambiente_id, curso_id, fecha,
            hora_ingreso, hora_salida, minutos_totales,
            hora_entrada_programada, hora_salida_programada,
            minutos_tardanza, minutos_anticipo, minutos_extra,
            estado_asistencia, tipo_registro, observaciones
          ) VALUES (
            ${tec.id}, ${SEDE_VILLA}, NULL, NULL, ${fecha},
            ${hIngreso}, ${hSalida}, 375,
            '07:00', '13:00',
            NULL, NULL, 10,
            'finalizado', 'kiosco_autoservicio',
            ${`${SEED_TAG} Guardia sábado soporte académico`}
          );
        `;
        tecCount++;
        totalAsistencias++;
      }
      continue;
    }

    // C) Días hábiles regulares
    for (let i = 0; i < TECNICOS.length; i++) {
      const tec = TECNICOS[i];

      // Casos de ausencia justificada
      if (fecha === '2026-10-06' && tec.id === 7) continue; // Jose Calderon permiso
      if (fecha === '2026-10-12' && tec.id === 8) continue; // Maykol Palacios compensatorio

      // Caso de cierre forzado con auditoría (Jean Pinchi el 07/10)
      if (fecha === '2026-10-07' && tec.id === 13) {
        const hIngreso = toIsoLima(fecha, tec.entrada, -2);
        const hSalida = toIsoLima(fecha, tec.salida, 0);
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
        await sql`
          INSERT INTO auditoria_asistencias (
            asistencia_id, usuario_admin_id, accion, motivo, datos_anteriores, datos_nuevos
          ) VALUES (
            ${inserted[0].id}, 1, 'CIERRE_FORZADO',
            'Colaborador omitió marcación en terminal al culminar turno. Se valida presencia por cámaras.',
            ${JSON.stringify({ hora_salida: null, estado: 'en_curso' })},
            ${JSON.stringify({ hora_salida: hSalida, estado: 'finalizado' })}
          );
        `;
        tecCount++;
        totalAsistencias++;
        continue;
      }

      // Variaciones realistas
      let desfaseEntrada = 0;
      let desfaseSalida = 0;
      let minTardanza: number | null = null;
      let minAnticipo: number | null = null;
      let minExtra: number | null = null;
      let detalleObs = 'Marcación puntual en terminal Kiosco';

      if (fecha === '2026-10-06' && tec.id === 10) {
        desfaseEntrada = 22; minTardanza = 22; detalleObs = 'Tardanza +22m por congestión en Panamericana Sur';
      } else if (fecha === '2026-10-09' && tec.id === 9) {
        desfaseEntrada = 35; minTardanza = 35; detalleObs = 'Tardanza +35m por demora en transporte público';
      } else if (fecha === '2026-10-13' && tec.id === 13) {
        desfaseEntrada = 15; minTardanza = 15; detalleObs = 'Tardanza +15m registrada en Kiosco';
      } else if (fecha === '2026-10-02' && tec.id === 12) {
        desfaseEntrada = 18; minTardanza = 18; detalleObs = 'Tardanza +18m registrada en Kiosco';
      } else if (fecha === '2026-10-05' && tec.id === 11) {
        desfaseSalida = -40; minAnticipo = 40; detalleObs = 'Retiro anticipado 40m justificado por cita médica';
      } else if (fecha === '2026-10-07' && tec.id === 14) {
        desfaseSalida = 65; minExtra = 65; detalleObs = 'Sobretiempo +65m por calibración de maniquíes SimMan';
      } else if (fecha === '2026-10-14' && tec.id === 5) {
        desfaseSalida = 45; minExtra = 45; detalleObs = 'Sobretiempo +45m por apoyo en cierre de estación ECOE';
      } else {
        desfaseEntrada = ((i + fecha.charCodeAt(9)) % 7) - 3; // -3 a +3
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
  console.log(`   ✅ ${tecCount} asistencias de técnicos generadas.`);

  // =========================================================================
  // 2. PACIENTES SIMULADOS (PS) — CON TODAS LAS PASTILLAS ACTIVAS
  // =========================================================================
  console.log('\n🎭 2. Generando asistencias de PACIENTES SIMULADOS con distribución de auditoría...');

  // Traer lista de usuarios PS
  const psUsers = await sql`
    SELECT id, dni, nombres, apellidos, correo, tarifa_hora
    FROM usuarios
    WHERE tipo_personal = 'paciente_simulado'
    ORDER BY id;
  ` as any[];

  // Traer sesiones reales de SimClic que tienen un PS programado por nombre
  const sesionesConPs = await sql`
    SELECT 
      sp.id, sp.fecha, sp.hora_inicio, sp.hora_fin, sp.sede_id, sp.ambiente_id,
      sp.ambiente_nombre_simclic, sp.curso_id, sp.curso_nombre_simclic,
      sp.paciente_simulado_nombre, sp.paciente_simulado_correo, sp.titulo
    FROM sesiones_programadas sp
    WHERE sp.fecha >= '2026-10-01' AND sp.fecha <= '2026-10-15'
      AND sp.paciente_simulado_nombre IS NOT NULL 
      AND sp.paciente_simulado_nombre != ''
      AND sp.ambiente_id IS NOT NULL
    ORDER BY sp.fecha, sp.hora_inicio;
  ` as any[];

  console.log(`   Total de sesiones con PS oficial en SimClic: ${sesionesConPs.length}`);

  let psAlineados = 0;
  let psTardanzas = 0;
  let psDiscrepanciaSala = 0;
  let psSinBloque = 0;

  // Agrupar sesiones por PS y por fecha
  const psSesionesMap = new Map<number, any[]>();
  for (const s of sesionesConPs) {
    const sNom = s.paciente_simulado_nombre.toLowerCase().trim();
    const matchedUser = psUsers.find((u: any) => {
      const uNom = `${u.nombres} ${u.apellidos}`.toLowerCase().trim();
      return sNom.includes(uNom) || uNom.includes(sNom);
    });
    if (matchedUser) {
      if (!psSesionesMap.has(matchedUser.id)) psSesionesMap.set(matchedUser.id, []);
      psSesionesMap.get(matchedUser.id)!.push({ ...s, user: matchedUser });
    }
  }

  // Generar turnos para los pacientes simulados
  // Queremos:
  // A) ~45 Conformes / Alineados (Puntual + Misma Sala)
  // B) ~18 Tardanza vs Programado (Llega 15-30 min tarde)
  // C) ~20 Discrepancia de Sala (Puntual + Sala Distinta)
  // D) ~12 Sin Bloque SimClic (Asistencia registrada en día libre / sin clase en SimClic)

  const psEntries = Array.from(psSesionesMap.entries());
  let targetTotal = 85;
  let generated = 0;

  for (let idx = 0; idx < psEntries.length; idx++) {
    const [userId, userSessions] = psEntries[idx];
    const user = userSessions[0].user;

    // Tomar 2 o 3 sesiones de este usuario en distintas fechas de la quincena
    const uniqueDates = Array.from(new Set(userSessions.map((s: any) => s.fecha)));
    const sampleDates = uniqueDates.slice(0, 3);

    for (let di = 0; di < sampleDates.length; di++) {
      const f = sampleDates[di];
      const sesion = userSessions.find((s: any) => s.fecha === f);
      if (!sesion) continue;

      const modulo = (userId * 7 + di * 13) % 100;

      // 1. TARDANZA VS PROGRAMADO (~20%): Llega 15 a 28 minutos tarde respecto al inicio de clase
      if (modulo < 22 && psTardanzas < 16) {
        const tardanzaMin = ((userId + di) % 15) + 15; // 15 a 29 min tarde (> 10 min)
        const hIngreso = toIsoLima(sesion.fecha, sesion.hora_inicio, tardanzaMin);
        const hSalida = toIsoLima(sesion.fecha, sesion.hora_fin, 10);
        const duracion = minDiff(sesion.hora_inicio, sesion.hora_fin) - tardanzaMin + 10;

        await sql`
          INSERT INTO asistencias (
            usuario_id, sede_id, ambiente_id, curso_id, fecha,
            hora_ingreso, hora_salida, minutos_totales,
            minutos_tardanza,
            estado_asistencia, tipo_registro, observaciones
          ) VALUES (
            ${user.id}, ${sesion.sede_id || SEDE_VILLA}, ${sesion.ambiente_id}, ${sesion.curso_id}, ${sesion.fecha},
            ${hIngreso}, ${hSalida}, ${duracion},
            ${tardanzaMin},
            'finalizado', 'kiosco_autoservicio',
            ${`${SEED_TAG} Marcación PS con retraso (+${tardanzaMin}m) por tráfico vehicular`}
          );
        `;
        psTardanzas++;
        totalAsistencias++;
        generated++;
        continue;
      }

      // 2. DISCREPANCIA / CAMBIO DE SALA (~25%): Llega puntual pero en otra sala diferente
      if (modulo < 48 && psDiscrepanciaSala < 20) {
        // Elegir una sala alternativa de la misma sede o de la lista
        const otraSala = ambientesVilla.find((a: any) => a.id !== sesion.ambiente_id) || ambientesVilla[0];
        const briefingMin = 20;
        const hIngreso = toIsoLima(sesion.fecha, sesion.hora_inicio, -briefingMin);
        const hSalida = toIsoLima(sesion.fecha, sesion.hora_fin, 10);
        const duracion = minDiff(sesion.hora_inicio, sesion.hora_fin) + briefingMin + 10;

        await sql`
          INSERT INTO asistencias (
            usuario_id, sede_id, ambiente_id, curso_id, fecha,
            hora_ingreso, hora_salida, minutos_totales,
            estado_asistencia, tipo_registro, observaciones
          ) VALUES (
            ${user.id}, ${sesion.sede_id || SEDE_VILLA}, ${otraSala.id}, ${sesion.curso_id}, ${sesion.fecha},
            ${hIngreso}, ${hSalida}, ${duracion},
            'finalizado', 'kiosco_autoservicio',
            ${`${SEED_TAG} Reubicación operativa de sala: Traslado a ${otraSala.nombre}`}
          );
        `;
        psDiscrepanciaSala++;
        totalAsistencias++;
        generated++;
        continue;
      }

      // 3. CONFORME / ALINEADO (~55%): Llega puntual (-15 min) y en la sala exacta de SimClic
      const briefingMin = 20;
      const hIngreso = toIsoLima(sesion.fecha, sesion.hora_inicio, -briefingMin);
      const hSalida = toIsoLima(sesion.fecha, sesion.hora_fin, 10);
      const duracion = minDiff(sesion.hora_inicio, sesion.hora_fin) + briefingMin + 10;

      await sql`
        INSERT INTO asistencias (
          usuario_id, sede_id, ambiente_id, curso_id, fecha,
          hora_ingreso, hora_salida, minutos_totales,
          estado_asistencia, tipo_registro, observaciones
        ) VALUES (
          ${user.id}, ${sesion.sede_id || SEDE_VILLA}, ${sesion.ambiente_id}, ${sesion.curso_id}, ${sesion.fecha},
          ${hIngreso}, ${hSalida}, ${duracion},
          'finalizado', 'kiosco_autoservicio',
          ${`${SEED_TAG} Actuación PS puntual: ${sesion.curso_nombre_simclic || 'Simulación Clínica'} (Briefing incluido)`}
        );
      `;
      psAlineados++;
      totalAsistencias++;
      generated++;
    }
  }

  // 4. SIN BLOQUE SIMCLIC (~12 casos): Asistencias registradas en días donde el PS no tenía clase agendada en SimClic
  // Usamos actores como Yesennia Berrocal (ID 1022) o fechas donde no tenían programación
  const fechasHabiles = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-07', '2026-10-09', '2026-10-14'];
  const psParaSinBloque = psUsers.slice(0, 12);

  for (let si = 0; si < psParaSinBloque.length; si++) {
    const ps = psParaSinBloque[si];
    const fecha = fechasHabiles[si % fechasHabiles.length];

    // Verificar que realmente no tenga sesión ese día
    const sesCheck = await sql`
      SELECT count(*)::int as count
      FROM sesiones_programadas
      WHERE fecha = ${fecha} AND LOWER(paciente_simulado_nombre) LIKE ${'%' + ps.apellidos.toLowerCase() + '%'};
    `;

    // Si tiene sesión, cambiamos la fecha a un sábado o día libre
    const fechaSinSesion = sesCheck[0].count === 0 ? fecha : '2026-10-03';

    const hIngreso = toIsoLima(fechaSinSesion, '08:00', 0);
    const hSalida = toIsoLima(fechaSinSesion, '11:30', 0);
    const sala = ambientesVilla[si % ambientesVilla.length];

    await sql`
      INSERT INTO asistencias (
        usuario_id, sede_id, ambiente_id, curso_id, fecha,
        hora_ingreso, hora_salida, minutos_totales,
        estado_asistencia, tipo_registro, observaciones
      ) VALUES (
        ${ps.id}, ${SEDE_VILLA}, ${sala.id}, NULL, ${fechaSinSesion},
        ${hIngreso}, ${hSalida}, 210,
        'finalizado', 'kiosco_autoservicio',
        ${`${SEED_TAG} Cobertura extemporánea / Guardia de refuerzo no agendada en SimClic`}
      );
    `;
    psSinBloque++;
    totalAsistencias++;
  }

  console.log(`   ✅ Pacientes Simulados generados:`);
  console.log(`      • Conformes / Alineados: ${psAlineados}`);
  console.log(`      • Tardanza vs Programado: ${psTardanzas}`);
  console.log(`      • Discrepancia / Cambio de Sala: ${psDiscrepanciaSala}`);
  console.log(`      • Sin Bloque SimClic: ${psSinBloque}`);

  // =========================================================================
  // 3. DOCENTES — CON TODAS LAS PASTILLAS ACTIVAS + ALERTAS SIN MARCAR
  // =========================================================================
  console.log('\n👨‍🏫 3. Generando asistencias de DOCENTES con distribución de auditoría...');

  const sesionesDocentes = await sql`
    SELECT 
      sp.id, sp.fecha, sp.hora_inicio, sp.hora_fin, sp.sede_id, sp.ambiente_id,
      sp.ambiente_nombre_simclic, sp.curso_id, sp.curso_nombre_simclic,
      sp.docente_id, sp.docente_nombre_simclic, sp.titulo
    FROM sesiones_programadas sp
    WHERE sp.fecha >= '2026-10-01' AND sp.fecha <= '2026-10-15'
      AND sp.docente_id IS NOT NULL
      AND sp.ambiente_id IS NOT NULL
    ORDER BY sp.fecha, sp.hora_inicio;
  ` as any[];

  let docAlineados = 0;
  let docTardanzas = 0;
  let docDiscrepanciaSala = 0;
  let docSinMarcar = 0;

  // Tomar una muestra representativa de 150 sesiones docentes
  const sesionesDocMuestra = sesionesDocentes.slice(0, 160);

  for (let di = 0; di < sesionesDocMuestra.length; di++) {
    const sesion = sesionesDocMuestra[di];
    const modulo = (di * 11 + sesion.id) % 100;

    // A) ~12% Docente ausente o no marcó en Kiosco (🚨 Sin Marcar)
    if (modulo < 12) {
      docSinMarcar++;
      // No creamos asistencia, se mantiene estado_ucs = 'programada'
      continue;
    }

    // B) ~18% Tardanza vs Programado (llega 12-25 min tarde)
    if (modulo < 30) {
      const tardanzaMin = (di % 14) + 12; // 12 a 25 min tarde
      const hIngreso = toIsoLima(sesion.fecha, sesion.hora_inicio, tardanzaMin);
      const hSalida = toIsoLima(sesion.fecha, sesion.hora_fin, 5);
      const duracion = minDiff(sesion.hora_inicio, sesion.hora_fin) - tardanzaMin + 5;

      const inserted = await sql`
        INSERT INTO asistencias (
          usuario_id, sede_id, ambiente_id, curso_id, fecha,
          hora_ingreso, hora_salida, minutos_totales,
          minutos_tardanza,
          estado_asistencia, tipo_registro, observaciones
        ) VALUES (
          ${sesion.docente_id}, ${sesion.sede_id || SEDE_VILLA}, ${sesion.ambiente_id}, ${sesion.curso_id}, ${sesion.fecha},
          ${hIngreso}, ${hSalida}, ${duracion},
          ${tardanzaMin},
          'finalizado', 'kiosco_autoservicio',
          ${`${SEED_TAG} Docente con retraso (+${tardanzaMin}m): ${sesion.titulo}`}
        ) RETURNING id;
      `;
      await sql`
        UPDATE sesiones_programadas SET asistencia_id = ${inserted[0].id}, estado_ucs = 'finalizada' WHERE id = ${sesion.id};
      `;
      docTardanzas++;
      totalAsistencias++;
      continue;
    }

    // C) ~15% Discrepancia de Sala (Puntual pero se trasladó de ambiente)
    if (modulo < 45) {
      const otraSala = ambientesVilla.find((a: any) => a.id !== sesion.ambiente_id) || ambientesVilla[0];
      const hIngreso = toIsoLima(sesion.fecha, sesion.hora_inicio, -5);
      const hSalida = toIsoLima(sesion.fecha, sesion.hora_fin, 5);
      const duracion = minDiff(sesion.hora_inicio, sesion.hora_fin) + 10;

      const inserted = await sql`
        INSERT INTO asistencias (
          usuario_id, sede_id, ambiente_id, curso_id, fecha,
          hora_ingreso, hora_salida, minutos_totales,
          estado_asistencia, tipo_registro, observaciones
        ) VALUES (
          ${sesion.docente_id}, ${sesion.sede_id || SEDE_VILLA}, ${otraSala.id}, ${sesion.curso_id}, ${sesion.fecha},
          ${hIngreso}, ${hSalida}, ${duracion},
          'finalizado', 'kiosco_autoservicio',
          ${`${SEED_TAG} Traslado de aula a ${otraSala.nombre}: ${sesion.titulo}`}
        ) RETURNING id;
      `;
      await sql`
        UPDATE sesiones_programadas SET asistencia_id = ${inserted[0].id}, estado_ucs = 'finalizada' WHERE id = ${sesion.id};
      `;
      docDiscrepanciaSala++;
      totalAsistencias++;
      continue;
    }

    // D) ~55% Conforme / Alineado (Puntual en la misma sala)
    const hIngreso = toIsoLima(sesion.fecha, sesion.hora_inicio, -8);
    const hSalida = toIsoLima(sesion.fecha, sesion.hora_fin, 5);
    const duracion = minDiff(sesion.hora_inicio, sesion.hora_fin) + 13;

    const inserted = await sql`
      INSERT INTO asistencias (
        usuario_id, sede_id, ambiente_id, curso_id, fecha,
        hora_ingreso, hora_salida, minutos_totales,
        estado_asistencia, tipo_registro, observaciones
      ) VALUES (
        ${sesion.docente_id}, ${sesion.sede_id || SEDE_VILLA}, ${sesion.ambiente_id}, ${sesion.curso_id}, ${sesion.fecha},
        ${hIngreso}, ${hSalida}, ${duracion},
        'finalizado', 'kiosco_autoservicio',
        ${`${SEED_TAG} Clase regular conforme en sala: ${sesion.titulo}`}
      ) RETURNING id;
    `;
    await sql`
      UPDATE sesiones_programadas SET asistencia_id = ${inserted[0].id}, estado_ucs = 'finalizada' WHERE id = ${sesion.id};
    `;
    docAlineados++;
    totalAsistencias++;
  }

  console.log(`   ✅ Docentes generados:`);
  console.log(`      • Conformes / Alineados: ${docAlineados}`);
  console.log(`      • Tardanza vs Programado: ${docTardanzas}`);
  console.log(`      • Discrepancia de Sala: ${docDiscrepanciaSala}`);
  console.log(`      • Sin Marcar (Alertas Rojas): ${docSinMarcar}`);

  console.log('\n====================================================');
  console.log(`🎉 SIMULACIÓN ULTRA-REALISTA COMPLETADA: ${totalAsistencias} asistencias.`);
  console.log(`   • Técnicos: ${tecCount}`);
  console.log(`   • Pacientes Simulados: ${psAlineados + psTardanzas + psDiscrepanciaSala + psSinBloque}`);
  console.log(`   • Docentes: ${docAlineados + docTardanzas + docDiscrepanciaSala}`);
  console.log('====================================================\n');

  process.exit(0);
}

simularMaster().catch((err) => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
