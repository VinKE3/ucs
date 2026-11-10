import { normalizarTextoBusqueda, coincideBusquedaAcentos } from '../lib/stringUtils';

function runTests() {
  console.log('🧪 Iniciando pruebas de búsqueda insensible a tildes y diacríticos...');

  const casos = [
    { target: 'Rubí Flores', query: 'rubi', expected: true },
    { target: 'Rubí Flores', query: 'rubí', expected: true },
    { target: 'rubi flores', query: 'Rubí', expected: true },
    { target: 'Carlos Álvarez Peña', query: 'alvarez', expected: true },
    { target: 'Carlos Álvarez Peña', query: 'carlos alvarez', expected: true },
    { target: 'Simulación Quirúrgica II', query: 'simulacion quirurgica', expected: true },
    { target: 'Sala de Imágenes', query: 'imagenes', expected: true },
    { target: 'Consultorio 04 - Niño Jesús', query: 'nino jesus', expected: true },
    { target: 'María Fernanda Muñoz', query: 'maria munoz', expected: true },
  ];

  let fallos = 0;
  for (const c of casos) {
    const res = coincideBusquedaAcentos(c.target, c.query);
    if (res === c.expected) {
      console.log(`✅ [OK] "${c.query}" en "${c.target}" => ${res}`);
    } else {
      console.error(`❌ [FALLO] "${c.query}" en "${c.target}" => esperado ${c.expected}, obtenido ${res}`);
      fallos++;
    }
  }

  if (fallos === 0) {
    console.log('\n🎉 ¡Todos los casos de prueba pasaron exitosamente!');
  } else {
    process.exit(1);
  }
}

runTests();

