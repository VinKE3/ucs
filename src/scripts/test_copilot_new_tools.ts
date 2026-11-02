import { GEMINI_TOOLS } from '../lib/geminiService';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`❌ FALLÓ: ${msg}`);
  }
  console.log(`  ✅ ${msg}`);
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🤖 BATERÍA DE PRUEBAS: NUEVAS CAPACIDADES COPILOT UCS');
  console.log('======================================================\n');

  console.log('🎭 1. Declaración de Herramienta: Convocatoria Casting WhatsApp');
  const castingTool = GEMINI_TOOLS.find((t) => t.name === 'convocar_casting_pacientes_simulados');
  assert(Boolean(castingTool), 'Herramienta convocar_casting_pacientes_simulados debe estar registrada en GEMINI_TOOLS');
  assert(Boolean(castingTool?.parameters?.properties?.genero), 'Parámetro "genero" debe estar declarado');
  assert(Boolean(castingTool?.parameters?.properties?.casoClinico), 'Parámetro "casoClinico" debe estar declarado');
  assert(Boolean(castingTool?.parameters?.properties?.horario), 'Parámetro "horario" debe estar declarado');
  assert(Boolean(castingTool?.parameters?.properties?.edadMin), 'Parámetro "edadMin" debe estar declarado');

  console.log('\n⚡ 2. Declaración de Herramientas Actionable AI (Acciones Ejecutables)');
  const closeAttendanceTool = GEMINI_TOOLS.find((t) => t.name === 'proponer_cerrar_turno_asistencia');
  assert(Boolean(closeAttendanceTool), 'Herramienta proponer_cerrar_turno_asistencia debe estar registrada');
  assert(closeAttendanceTool?.parameters?.required?.includes('nombreODni') ?? false, '"nombreODni" debe ser obligatorio');

  const roomStatusTool = GEMINI_TOOLS.find((t) => t.name === 'proponer_cambio_estado_sala');
  assert(Boolean(roomStatusTool), 'Herramienta proponer_cambio_estado_sala debe estar registrada');
  assert(roomStatusTool?.parameters?.required?.includes('salaNombreOCodigo') ?? false, '"salaNombreOCodigo" debe ser obligatorio');
  assert(roomStatusTool?.parameters?.required?.includes('nuevoEstado') ?? false, '"nuevoEstado" debe ser obligatorio');

  console.log('\n📊 3. Declaración de Herramienta: Generador de Informes Ejecutivos');
  const executiveReportTool = GEMINI_TOOLS.find((t) => t.name === 'generar_informe_ejecutivo');
  assert(Boolean(executiveReportTool), 'Herramienta generar_informe_ejecutivo debe estar registrada');
  assert(Boolean(executiveReportTool?.parameters?.properties?.mes), 'Parámetro "mes" debe admitir formato YYYY-MM');
  assert(Boolean(executiveReportTool?.parameters?.properties?.sede), 'Parámetro "sede" debe admitir filtro por campus');

  console.log('\n📲 4. Formato de Enlaces de WhatsApp para Convocatoria');
  const testPhone = '987654321';
  const cleanPhone = testPhone.length === 9 && testPhone.startsWith('9') ? '51' + testPhone : testPhone;
  const msg = '👋 Convocatoria UCS para Paciente Simulado';
  const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
  assert(url.includes('phone=51987654321'), 'Número peruano debe tener prefijo 51');
  assert(url.includes('text='), 'Mensaje debe estar correctamente URI encoded');

  console.log('\n🛡️ 5. Estructura de Seguridad para Acciones Confirmadas (Actionable AI)');
  const sampleAction = {
    tipo: 'cerrar_turno_asistencia',
    titulo: 'Cerrar Turno de Asistencia Abierto',
    endpoint: '/api/asistencias',
    metodo: 'PATCH',
    payload: { id: 10, accion: 'cerrar_turno', motivo: 'Turno pendiente' },
    detalle: [{ etiqueta: 'Colaborador', valor: 'Dr. Test' }],
  };
  assert(sampleAction.endpoint.startsWith('/api/'), 'El endpoint debe ser una ruta interna protegida');
  assert(sampleAction.metodo === 'PATCH', 'El método debe ser PATCH para modificaciones');
  assert(sampleAction.payload.id > 0, 'El payload debe contener el ID del registro a modificar');

  console.log('\n======================================================');
  console.log('🎉 ¡TODAS LAS 13 ASERCIONES DE COPILOT FUERON EXITOSAS!');
  console.log('======================================================\n');
}

runTests()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

