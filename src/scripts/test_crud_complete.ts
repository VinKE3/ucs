import {
  crearSedeSchema,
  actualizarSedeSchema,
  crearAmbienteSchema,
  actualizarAmbienteSchema,
  crearCursoSchema,
  actualizarCursoSchema,
  crearUsuarioSchema,
  actualizarUsuarioSchema,
  crearAsistenciaManualSchema,
  modificarAsistenciaSchema,
  kioscoMarcarSchema,
  kioscoLookupSchema,
  kioscoAutorizarSchema,
} from '../lib/validations';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`❌ FALLÓ: ${msg}`);
  }
  console.log(`  ✅ ${msg}`);
}

async function runCrudSanityTests() {
  console.log('\n======================================================');
  console.log('🚀 BATERÍA SANITY TEST CRUD: VALIDACIONES PRE-DEMOSTRACIÓN');
  console.log('======================================================\n');

  // --- 1. SEDES ---
  console.log('📦 1. Pruebas de Sedes (Campus)');
  const sedeCreate = crearSedeSchema.safeParse({
    nombre: 'Sede San Isidro Demo',
    codigo: 'SID-01',
    direccion: 'Av. El Ejército 123',
  });
  assert(sedeCreate.success, 'Crear sede con datos completos');

  const sedeCreateMin = crearSedeSchema.safeParse({
    nombre: 'Sede Surco',
  });
  assert(sedeCreateMin.success, 'Crear sede con solo nombre obligatorio');

  const sedeUpdate = actualizarSedeSchema.safeParse({
    id: 1,
    nombre: 'Sede San Isidro Campus Modificado',
    codigo: 'SID-02',
    direccion: 'Av. Brasil 456',
    activo: true,
  });
  assert(sedeUpdate.success, 'Actualizar sede con campos modificados');

  const sedeToggle = actualizarSedeSchema.safeParse({
    id: 1,
    activo: false,
  });
  assert(sedeToggle.success, 'Inactivar sede (toggle activo)');

  // --- 2. AMBIENTES ---
  console.log('\n🏥 2. Pruebas de Ambientes (Salas de Simulación)');
  const ambCreate = crearAmbienteSchema.safeParse({
    sedeId: 1,
    nombre: 'Sala Trauma Shock Demo',
    codigo: 'ST-101',
    tipo: 'alta_fidelidad',
    capacidad: '12', // Frontend envía como string en input
  });
  assert(ambCreate.success, 'Crear sala con capacidad coerceada desde string');

  const ambUpdate = actualizarAmbienteSchema.safeParse({
    id: 10,
    nombre: 'Sala Trauma Shock 101 B',
    capacidad: 15,
    tipo: 'debriefing',
    activo: true,
  });
  assert(ambUpdate.success, 'Actualizar sala de simulación');

  // --- 3. CURSOS ---
  console.log('\n📚 3. Pruebas de Cursos Académicos');
  const cursoCreate = crearCursoSchema.safeParse({
    nombre: 'SIM-EMERG: Medicina de Emergencia Demo',
    codigo: 'MED-501',
    prefijo: 'SIMEMERG',
    carreraId: 1,
    descripcion: 'Curso práctico para simulación clínica avanzada',
    tarifaHoraPs: '35.00',
  });
  assert(cursoCreate.success, 'Crear curso con tarifa PS opcional');

  const cursoCreateTarifaCero = crearCursoSchema.safeParse({
    nombre: 'SIM-PEDIATRIA: Caso Voluntariado',
    tarifaHoraPs: 0,
  });
  assert(cursoCreateTarifaCero.success, 'Crear curso con tarifa PS en 0');

  const cursoUpdate = actualizarCursoSchema.safeParse({
    id: 5,
    nombre: 'SIM-EMERG: Medicina de Emergencia Actualizado',
    tarifaHoraPs: '',
  });
  assert(cursoUpdate.success, 'Actualizar curso eliminando tarifa PS (string vacío a null)');

  // --- 4. PERSONAL (DOCENTES, TÉCNICOS, PACIENTES SIMULADOS) ---
  console.log('\n👥 4. Pruebas de Personal de Clínica (Usuarios)');
  
  // 4a. Paciente Simulado con tarifa 0 y rol 'ninguno'
  const psCreate = crearUsuarioSchema.safeParse({
    dni: '76827272',
    nombres: 'Angelo',
    apellidos: 'Caceres Puma',
    correo: 'cacerespumaangelo@gmail.com',
    telefono: '987654321',
    tipoPersonal: 'paciente_simulado',
    rolSistema: 'ninguno',
    tarifaHora: '0',
    horasSemanalesMax: '25',
  });
  assert(psCreate.success, 'Crear Paciente Simulado con tarifa 0 y rol ninguno');

  // 4b. Actualizar Paciente Simulado (caso que fallaba antes del fix)
  const psUpdate = actualizarUsuarioSchema.safeParse({
    id: 15,
    dni: '76827272',
    nombres: 'Angelo',
    apellidos: 'Caceres Puma',
    correo: 'cacerespumaangelo@gmail.com',
    tipoPersonal: 'paciente_simulado',
    rolSistema: 'ninguno',
    tarifaHora: '0',
    toleranciaMinutos: '10',
  });
  assert(psUpdate.success, 'Actualizar Paciente Simulado reteniendo rol ninguno y tarifa 0');

  // 4c. Crear Técnico con turno obligatorio
  const tecCreate = crearUsuarioSchema.safeParse({
    dni: '87654321',
    nombres: 'Carlos',
    apellidos: 'Mendoza',
    tipoPersonal: 'tecnico',
    horaEntradaEsperada: '07:00',
    horaSalidaEsperada: '16:00',
    toleranciaMinutos: '15',
    esHorarioRotativo: false,
  });
  assert(tecCreate.success, 'Crear Técnico con horario fijo');

  // 4d. Crear Docente
  const docCreate = crearUsuarioSchema.safeParse({
    dni: '11223344',
    nombres: 'Dra. Patricia',
    apellidos: 'Vargas',
    correo: 'pvargas@cientifica.edu.pe',
    tipoPersonal: 'docente',
    rolSistema: 'ninguno',
  });
  assert(docCreate.success, 'Crear Docente con correo institucional');

  // --- 5. ASISTENCIAS Y AUDITORÍA ---
  console.log('\n⏱️ 5. Pruebas de Asistencias y Auditoría Manual');
  const asistCreate = crearAsistenciaManualSchema.safeParse({
    usuarioId: 15,
    sedeId: 1,
    ambienteId: 10,
    cursoId: 5,
    fecha: '2026-11-02',
    horaIngreso: new Date('2026-11-02T08:00:00Z').toISOString(),
    horaSalida: new Date('2026-11-02T12:00:00Z').toISOString(),
    motivoJustificacion: 'Demostración de registro de asistencia manual para auditoría',
  });
  assert(asistCreate.success, 'Crear asistencia manual con justificación auditada');

  const asistCerrar = modificarAsistenciaSchema.safeParse({
    id: 100,
    accion: 'cerrar_turno',
    motivo: 'Cierre de turno en vivo',
    horaSalida: new Date().toISOString(),
  });
  assert(asistCerrar.success, 'Cerrar turno de asistencia manualmente');

  const asistAnular = modificarAsistenciaSchema.safeParse({
    id: 100,
    accion: 'anular',
    motivo: 'Registro duplicado por prueba técnica',
  });
  assert(asistAnular.success, 'Anular asistencia con justificación auditada');

  // --- 6. TERMINAL KIOSCO ---
  console.log('\n📱 6. Pruebas de Terminal Kiosco');
  const kioscoLook = kioscoLookupSchema.safeParse({
    dni: '76827272',
  });
  assert(kioscoLook.success, 'Búsqueda de colaborador por DNI');

  const kioscoIn = kioscoMarcarSchema.safeParse({
    usuarioId: 15,
    accion: 'ingreso',
    sedeId: 1,
    ambienteId: 10,
  });
  assert(kioscoIn.success, 'Marcación de ingreso en Kiosco');

  const kioscoOut = kioscoMarcarSchema.safeParse({
    usuarioId: 15,
    accion: 'salida',
    asistenciaId: 100,
  });
  assert(kioscoOut.success, 'Marcación de salida en Kiosco');

  const kioscoAuthOtp = kioscoAutorizarSchema.safeParse({
    metodo: 'otp',
    codigoOtp: '984521',
    sedeId: 1,
    nombreTerminal: 'Tablet Recepción Villa 01',
    deviceFingerprint: 'abc123hashhardware',
  });
  assert(kioscoAuthOtp.success, 'Autorización de terminal Kiosco con código OTP y huella');

  console.log('\n======================================================');
  console.log('🎉 ¡TODAS LAS 20 PRUEBAS SANITY CRUD FUERON EXITOSAS!');
  console.log('El sistema se encuentra blindado y consistente para la demo.');
  console.log('======================================================\n');
}

runCrudSanityTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

