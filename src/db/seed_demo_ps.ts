import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function seedDemoPS() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL no está configurada en .env.local');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  console.log('🎭 Iniciando creación de 8 Pacientes Simulados de Demostración (Septiembre)...');

  // 1. Asegurar tarifas por hora en los cursos principales para evidenciar cálculo automático
  await sql`
    UPDATE cursos SET tarifa_hora_ps = 35.00 WHERE codigo = 'SIM-Q' AND tarifa_hora_ps IS NULL;
  `;
  await sql`
    UPDATE cursos SET tarifa_hora_ps = 32.00 WHERE codigo = 'SIM-PED' AND tarifa_hora_ps IS NULL;
  `;
  await sql`
    UPDATE cursos SET tarifa_hora_ps = 35.00 WHERE codigo = 'SIM-GIN' AND tarifa_hora_ps IS NULL;
  `;
  await sql`
    UPDATE cursos SET tarifa_hora_ps = 30.00 WHERE codigo = 'SCI' AND tarifa_hora_ps IS NULL;
  `;
  await sql`
    UPDATE cursos SET tarifa_hora_ps = 28.00 WHERE codigo = 'SBS' AND tarifa_hora_ps IS NULL;
  `;

  // 2. Limpieza previa de cualquier corrida anterior con prefijo 7700000%
  console.log('🧹 Limpiando registros de demostración previos si existieran...');
  await sql`
    DELETE FROM asistencias WHERE usuario_id IN (
      SELECT id FROM usuarios WHERE dni LIKE '7700000%'
    );
  `;
  await sql`
    DELETE FROM casting_perfiles WHERE usuario_id IN (
      SELECT id FROM usuarios WHERE dni LIKE '7700000%'
    );
  `;
  await sql`
    DELETE FROM usuarios WHERE dni LIKE '7700000%';
  `;

  // 3. Obtener referencias existentes de sedes, salas y cursos
  const sedes = await sql`SELECT id FROM sedes WHERE activo = true LIMIT 3;`;
  const sedeId1 = sedes[0]?.id || 1;
  const sedeId2 = sedes[1]?.id || sedeId1;

  const ambientes = await sql`SELECT id FROM ambientes WHERE activo = true LIMIT 6;` as any[];
  const ambienteIds = ambientes.map((a: any) => a.id);
  if (ambienteIds.length === 0) ambienteIds.push(1);

  const cursos = await sql`SELECT id, nombre, codigo, tarifa_hora_ps FROM cursos WHERE activo = true;` as any[];
  const cQuirurgica = cursos.find((c: any) => c.codigo === 'SIM-Q')?.id || cursos[0]?.id;
  const cPediatrica = cursos.find((c: any) => c.codigo === 'SIM-PED')?.id || cursos[1]?.id;
  const cGinecologica = cursos.find((c: any) => c.codigo === 'SIM-GIN')?.id || cursos[2]?.id;
  const cSci = cursos.find((c: any) => c.codigo === 'SCI')?.id || cursos[0]?.id;
  const cSbs = cursos.find((c: any) => c.codigo === 'SBS')?.id || cursos[1]?.id;

  // Obtener rangos de edad para casting
  const rangos = await sql`SELECT id FROM casting_rangos_edad ORDER BY orden LIMIT 4;`;
  const rangoJoven = rangos[0]?.id || null;
  const rangoAdultoJoven = rangos[1]?.id || null;
  const rangoAdultoMaduro = rangos[2]?.id || null;

  // 4. Datos de los 8 Pacientes Simulados Ficticios
  const actoresDemo = [
    {
      dni: '77000001',
      nombres: 'Lucía Fernanda',
      apellidos: 'Morales Rivas',
      correo: 'lmorales.ps@cientifica.edu.pe',
      telefono: '987111222',
      tarifaHora: 32.00,
      genero: 'Femenino',
      biotipo: 'Mesomorfo (Estudiante)',
      rangoEdadId: rangoJoven,
      sesiones: [
        { dia: '02', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cQuirurgica, amb: ambienteIds[0], obs: 'Caso Shock Hipovolémico' },
        { dia: '05', horaIn: '08:30', horaOut: '12:30', min: 240, cursoId: cGinecologica, amb: ambienteIds[1], obs: 'Evaluación ECOE Parto Eutócico' },
        { dia: '09', horaIn: '13:00', horaOut: '17:00', min: 240, cursoId: cQuirurgica, amb: ambienteIds[0], obs: 'Simulación Apendicitis Aguda' },
        { dia: '12', horaIn: '08:00', horaOut: '13:00', min: 300, cursoId: cSci, amb: ambienteIds[2] || ambienteIds[0], obs: 'Estación Integrada Crisis Asmática' },
        { dia: '16', horaIn: '09:00', horaOut: '13:00', min: 240, cursoId: cGinecologica, amb: ambienteIds[1], obs: 'Taller de Examen Ginecológico' },
        { dia: '19', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cQuirurgica, amb: ambienteIds[0], obs: 'Manejo de Trauma Abdominal' },
        { dia: '23', horaIn: '14:00', horaOut: '18:00', min: 240, cursoId: cSci, amb: ambienteIds[2] || ambienteIds[0], obs: 'Simulación Anamnesis Difícil' },
        { dia: '26', horaIn: '08:00', horaOut: '12:30', min: 270, cursoId: cQuirurgica, amb: ambienteIds[0], obs: 'Examen Final ECOE Quirúrgico' },
      ],
    },
    {
      dni: '77000002',
      nombres: 'Carlos Alberto',
      apellidos: 'Mendoza Vega',
      correo: 'cmendoza.ps@cientifica.edu.pe',
      telefono: '987222333',
      tarifaHora: 30.00,
      genero: 'Masculino',
      biotipo: 'Ectomorfo',
      rangoEdadId: rangoAdultoJoven,
      sesiones: [
        { dia: '03', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cPediatrica, amb: ambienteIds[1], obs: 'Padre en consulta pediátrica' },
        { dia: '07', horaIn: '09:00', horaOut: '13:00', min: 240, cursoId: cSci, amb: ambienteIds[0], obs: 'Caso Dolor Torácico Atípico' },
        { dia: '10', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cPediatrica, amb: ambienteIds[1], obs: 'Estación Deshidratación Severa' },
        { dia: '14', horaIn: '13:30', horaOut: '17:30', min: 240, cursoId: cSbs, amb: ambienteIds[3] || ambienteIds[0], obs: 'Semiología Cardiovascular' },
        { dia: '18', horaIn: '08:00', horaOut: '13:00', min: 300, cursoId: cPediatrica, amb: ambienteIds[1], obs: 'ECOE Parcial Pediatría' },
        { dia: '22', horaIn: '09:00', horaOut: '13:00', min: 240, cursoId: cSci, amb: ambienteIds[0], obs: 'Manejo de Paciente Hostil' },
        { dia: '28', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cPediatrica, amb: ambienteIds[1], obs: 'Simulación Convulsión Febril' },
      ],
    },
    {
      dni: '77000003',
      nombres: 'Valeria Sofía',
      apellidos: 'Castro Huamán',
      correo: 'vcastro.ps@cientifica.edu.pe',
      telefono: '987333444',
      tarifaHora: 35.00,
      genero: 'Femenino',
      biotipo: 'Normolíneo',
      rangoEdadId: rangoAdultoJoven,
      sesiones: [
        { dia: '01', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cQuirurgica, amb: ambienteIds[0], obs: 'Colecistitis Aguda' },
        { dia: '04', horaIn: '08:30', horaOut: '12:30', min: 240, cursoId: cSbs, amb: ambienteIds[2] || ambienteIds[0], obs: 'Semiología Respiratoria' },
        { dia: '08', horaIn: '13:00', horaOut: '17:30', min: 270, cursoId: cQuirurgica, amb: ambienteIds[0], obs: 'Pancreatitis Aguda Biliar' },
        { dia: '11', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cGinecologica, amb: ambienteIds[1], obs: 'Preeclampsia Severa' },
        { dia: '15', horaIn: '08:00', horaOut: '13:00', min: 300, cursoId: cQuirurgica, amb: ambienteIds[0], obs: 'Jornada ECOE Quirúrgica' },
        { dia: '18', horaIn: '14:00', horaOut: '18:00', min: 240, cursoId: cSci, amb: ambienteIds[0], obs: 'Coma Cetoacidótico' },
        { dia: '22', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cQuirurgica, amb: ambienteIds[0], obs: 'Postoperatorio Complicado' },
        { dia: '25', horaIn: '08:30', horaOut: '12:30', min: 240, cursoId: cSbs, amb: ambienteIds[2] || ambienteIds[0], obs: 'Evaluación de Habilidades' },
        { dia: '29', horaIn: '08:00', horaOut: '13:00', min: 300, cursoId: cQuirurgica, amb: ambienteIds[0], obs: 'Cierre de Ciclo Quirúrgico' },
      ],
    },
    {
      dni: '77000004',
      nombres: 'Rodrigo Alejandro',
      apellidos: 'Quispe Flores',
      correo: 'rquispe.ps@cientifica.edu.pe',
      telefono: '987444555',
      tarifaHora: 28.00,
      genero: 'Masculino',
      biotipo: 'Endomorfo',
      rangoEdadId: rangoAdultoMaduro,
      sesiones: [
        { dia: '04', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cSci, amb: ambienteIds[0], obs: 'Síndrome Coronario Agudo' },
        { dia: '08', horaIn: '09:00', horaOut: '13:00', min: 240, cursoId: cSbs, amb: ambienteIds[3] || ambienteIds[0], obs: 'Semiología Digestiva' },
        { dia: '15', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cSci, amb: ambienteIds[0], obs: 'Emergencia Hipertensiva' },
        { dia: '19', horaIn: '13:30', horaOut: '17:30', min: 240, cursoId: cQuirurgica, amb: ambienteIds[1], obs: 'Hernia Inguinal Encarcelada' },
        { dia: '24', horaIn: '08:00', horaOut: '13:00', min: 300, cursoId: cSci, amb: ambienteIds[0], obs: 'Jornada ECOE Medicina' },
        { dia: '29', horaIn: '09:00', horaOut: '13:00', min: 240, cursoId: cSbs, amb: ambienteIds[2] || ambienteIds[0], obs: 'Examen de Habilidades Clínicas' },
      ],
    },
    {
      dni: '77000005',
      nombres: 'Camila Beatriz',
      apellidos: 'Benítez Torres',
      correo: 'cbenitez.ps@cientifica.edu.pe',
      telefono: '987555666',
      tarifaHora: 35.00,
      genero: 'Femenino',
      biotipo: 'Ectomorfo',
      rangoEdadId: rangoJoven,
      sesiones: [
        { dia: '02', horaIn: '08:30', horaOut: '12:30', min: 240, cursoId: cGinecologica, amb: ambienteIds[1], obs: 'Amenaza de Parto Prematuro' },
        { dia: '06', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cPediatrica, amb: ambienteIds[0], obs: 'Madre adolescente en consulta' },
        { dia: '09', horaIn: '13:00', horaOut: '17:00', min: 240, cursoId: cGinecologica, amb: ambienteIds[1], obs: 'Hemorragia Postparto' },
        { dia: '13', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cSci, amb: ambienteIds[2] || ambienteIds[0], obs: 'Cefalea en Trueno' },
        { dia: '17', horaIn: '08:00', horaOut: '13:00', min: 300, cursoId: cGinecologica, amb: ambienteIds[1], obs: 'Simulación de Alta Fidelidad Obstétrica' },
        { dia: '20', horaIn: '09:00', horaOut: '13:00', min: 240, cursoId: cPediatrica, amb: ambienteIds[0], obs: 'Reanimación Neonatal - Madre' },
        { dia: '24', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cGinecologica, amb: ambienteIds[1], obs: 'ECOE Ginecología y Obstetricia' },
        { dia: '27', horaIn: '14:00', horaOut: '18:00', min: 240, cursoId: cSci, amb: ambienteIds[0], obs: 'Manejo de Malas Noticias' },
      ],
    },
    {
      dni: '77000006',
      nombres: 'Diego Alonso',
      apellidos: 'Salazar Paredes',
      correo: 'dsalazar.ps@cientifica.edu.pe',
      telefono: '987666777',
      tarifaHora: 30.00,
      genero: 'Masculino',
      biotipo: 'Atlético',
      rangoEdadId: rangoAdultoJoven,
      sesiones: [
        { dia: '05', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cQuirurgica, amb: ambienteIds[0], obs: 'Neumotórax a Tensión' },
        { dia: '11', horaIn: '09:00', horaOut: '13:00', min: 240, cursoId: cSbs, amb: ambienteIds[2] || ambienteIds[0], obs: 'Examen Físico Neurológico' },
        { dia: '16', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cQuirurgica, amb: ambienteIds[0], obs: 'Oclusión Intestinal' },
        { dia: '21', horaIn: '13:30', horaOut: '17:30', min: 240, cursoId: cSci, amb: ambienteIds[1], obs: 'Intoxicación por Organofosforados' },
        { dia: '26', horaIn: '08:00', horaOut: '13:00', min: 300, cursoId: cQuirurgica, amb: ambienteIds[0], obs: 'Simulación Trauma Shock' },
      ],
    },
    {
      dni: '77000007',
      nombres: 'Mariana Estefanía',
      apellidos: 'Chávez Ruiz',
      correo: 'mchavez.ps@cientifica.edu.pe',
      telefono: '987777888',
      tarifaHora: 32.00,
      genero: 'Femenino',
      biotipo: 'Normolíneo',
      rangoEdadId: rangoAdultoJoven,
      sesiones: [
        { dia: '03', horaIn: '08:30', horaOut: '12:30', min: 240, cursoId: cPediatrica, amb: ambienteIds[1], obs: 'Madre preocupada por sepsis' },
        { dia: '07', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cSci, amb: ambienteIds[0], obs: 'Shock Anafiláctico' },
        { dia: '12', horaIn: '13:00', horaOut: '17:00', min: 240, cursoId: cPediatrica, amb: ambienteIds[1], obs: 'Caso de Maltrato Infantil - Simulación' },
        { dia: '18', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cSbs, amb: ambienteIds[3] || ambienteIds[0], obs: 'Semiología Endocrinológica' },
        { dia: '23', horaIn: '08:00', horaOut: '13:00', min: 300, cursoId: cPediatrica, amb: ambienteIds[1], obs: 'Estaciones ECOE Pediatría' },
        { dia: '30', horaIn: '09:00', horaOut: '12:30', min: 210, cursoId: cSci, amb: ambienteIds[0], obs: 'Simulación Paro Cardiorrespiratorio' },
      ],
    },
    {
      dni: '77000008',
      nombres: 'Gonzalo Matías',
      apellidos: 'Ramos Alarcón',
      correo: 'gramos.ps@cientifica.edu.pe',
      telefono: '987888999',
      tarifaHora: 35.00,
      genero: 'Masculino',
      biotipo: 'Endomorfo (Adulto Mayor)',
      rangoEdadId: rangoAdultoMaduro,
      sesiones: [
        { dia: '01', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cQuirurgica, amb: ambienteIds[0], obs: 'Abdomen Agudo Quirúrgico' },
        { dia: '06', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cSci, amb: ambienteIds[1], obs: 'Accidente Cerebrovascular (ACV)' },
        { dia: '10', horaIn: '13:30', horaOut: '17:30', min: 240, cursoId: cQuirurgica, amb: ambienteIds[0], obs: 'Trauma Torácico Abierto' },
        { dia: '14', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cSbs, amb: ambienteIds[2] || ambienteIds[0], obs: 'Anamnesis del Adulto Mayor' },
        { dia: '19', horaIn: '08:00', horaOut: '13:00', min: 300, cursoId: cQuirurgica, amb: ambienteIds[0], obs: 'Gran Simulacro Quirúrgico' },
        { dia: '24', horaIn: '09:00', horaOut: '13:00', min: 240, cursoId: cSci, amb: ambienteIds[1], obs: 'Manejo de Edema Agudo Pulmonar' },
        { dia: '28', horaIn: '08:00', horaOut: '12:00', min: 240, cursoId: cQuirurgica, amb: ambienteIds[0], obs: 'Examen Final ECOE' },
      ],
    },
  ];

  let totalSesionesInsertadas = 0;

  for (const act of actoresDemo) {
    // Insertar usuario
    const userRes = await sql`
      INSERT INTO usuarios (
        dni, nombres, apellidos, correo, telefono,
        tipo_personal, rol_sistema, tarifa_hora, activo
      ) VALUES (
        ${act.dni}, ${act.nombres}, ${act.apellidos}, ${act.correo}, ${act.telefono},
        'paciente_simulado', 'ninguno', ${act.tarifaHora}, true
      )
      RETURNING id;
    `;
    const usuarioId = userRes[0].id;

    // Insertar perfil de casting
    await sql`
      INSERT INTO casting_perfiles (
        usuario_id, rango_edad_id, edad_real, genero, biotipo,
        especialidades_ids, restricciones_ids, experiencia_notas, disponibilidad, activo_casting
      ) VALUES (
        ${usuarioId}, ${act.rangoEdadId}, 28, ${act.genero}, ${act.biotipo},
        '[]'::jsonb, '[]'::jsonb, 'Actor profesional capacitado en metodologías de simulación médica y debriefing.', 'Turno mañana y tarde', true
      );
    `;

    // Insertar asistencias en septiembre 2026
    for (const ses of act.sesiones) {
      const fecha = `2026-09-${ses.dia}`;
      const horaIngresoStr = `${fecha}T${ses.horaIn}:00.000Z`;
      const horaSalidaStr = `${fecha}T${ses.horaOut}:00.000Z`;

      await sql`
        INSERT INTO asistencias (
          usuario_id, sede_id, ambiente_id, curso_id,
          fecha, hora_ingreso, hora_salida, minutos_totales,
          estado_asistencia, tipo_registro, observaciones
        ) VALUES (
          ${usuarioId}, ${sedeId1}, ${ses.amb}, ${ses.cursoId},
          ${fecha}, ${horaIngresoStr}, ${horaSalidaStr}, ${ses.min},
          'finalizado', 'kiosco_autoservicio', ${ses.obs}
        );
      `;
      totalSesionesInsertadas++;
    }
  }

  console.log(`✅ ¡Éxito! Se insertaron 8 Pacientes Simulados ficticios.`);
  console.log(`📅 Total de asistencias del mes de Septiembre 2026 generadas: ${totalSesionesInsertadas}.`);
  console.log(`ℹ️ DNIs asignados: 77000001 al 77000008.`);
}

seedDemoPS().catch(console.error);
