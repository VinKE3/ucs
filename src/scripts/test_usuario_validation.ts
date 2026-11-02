import { crearUsuarioSchema, actualizarUsuarioSchema } from '../lib/validations/usuarios';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`✓ ${message}`);
}

async function runTests() {
  console.log('🧪 Probando esquemas de validación de Usuarios (Zod)...');

  // Test 1: Actualizar usuario con rolSistema = 'ninguno' y tarifaHora = '0'
  const res1 = actualizarUsuarioSchema.safeParse({
    id: 10,
    dni: '76827272',
    nombres: 'ANGELO',
    apellidos: 'CACERES PUMA',
    tipoPersonal: 'paciente_simulado',
    rolSistema: 'ninguno',
    tarifaHora: '0',
  });
  assert(res1.success, "actualizarUsuarioSchema acepta rolSistema='ninguno' y tarifaHora='0'");
  if (res1.success) {
    assert(res1.data.rolSistema === 'ninguno', "rolSistema permanece 'ninguno'");
    assert(res1.data.tarifaHora === '0', "tarifaHora se normaliza a '0'");
  }

  // Test 2: Actualizar usuario con tarifaHora numérica 0
  const res2 = actualizarUsuarioSchema.safeParse({
    id: 10,
    tarifaHora: 0,
  });
  assert(res2.success, "actualizarUsuarioSchema acepta tarifaHora=0 numérico");
  if (res2.success) {
    assert(res2.data.tarifaHora === '0', "tarifaHora numérico 0 se transforma en string '0'");
  }

  // Test 3: Actualizar usuario borrando tarifaHora (string vacío)
  const res3 = actualizarUsuarioSchema.safeParse({
    id: 10,
    tarifaHora: '',
  });
  assert(res3.success, "actualizarUsuarioSchema acepta tarifaHora='' (borrado de tarifa)");
  if (res3.success) {
    assert(res3.data.tarifaHora === null, "tarifaHora='' se transforma a null para la BD");
  }

  // Test 4: Rechazar tarifa negativa
  const res4 = actualizarUsuarioSchema.safeParse({
    id: 10,
    tarifaHora: -15,
  });
  assert(!res4.success, "actualizarUsuarioSchema rechaza tarifaHora negativa (-15)");

  // Test 5: Crear usuario con rolSistema vacío o nulo
  const res5 = crearUsuarioSchema.safeParse({
    dni: '12345678',
    nombres: 'Juan',
    apellidos: 'Perez',
    tipoPersonal: 'docente',
    rolSistema: '',
  });
  assert(res5.success, "crearUsuarioSchema transforma rolSistema='' en 'ninguno'");
  if (res5.success) {
    assert(res5.data.rolSistema === 'ninguno', "rolSistema es 'ninguno'");
  }

  // Test 6: Crear usuario con rolSistema = 'ninguno'
  const res6 = crearUsuarioSchema.safeParse({
    dni: '12345678',
    nombres: 'Juan',
    apellidos: 'Perez',
    tipoPersonal: 'paciente_simulado',
    rolSistema: 'ninguno',
    tarifaHora: '0',
  });
  assert(res6.success, "crearUsuarioSchema acepta rolSistema='ninguno'");

  console.log('\n🎉 ¡Todas las 6 pruebas de validación de usuarios pasaron exitosamente!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});

