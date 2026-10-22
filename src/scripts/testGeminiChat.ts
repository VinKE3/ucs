import fs from 'fs';
import path from 'path';

// Asegurar carga de .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [k, ...vParts] = trimmed.split('=');
    const key = k.trim();
    if (!process.env[key]) {
      process.env[key] = vParts.join('=').replace(/^["']|["']$/g, '').trim();
    }
  }
}

async function main() {
  console.log('🤖 Probando conexión y llamada a Gemini...');
  const { procesarMensajeGemini, getConfiguracionGemini } = await import(
    '../lib/geminiService'
  );

  const cfg = await getConfiguracionGemini();
  console.log('Configuracion actual de Gemini:', cfg);

  console.log('\n💬 Enviando consulta de prueba: "¿Qué salas están libres en este momento?"');
  const res = await procesarMensajeGemini({
    mensaje: '¿Qué salas o ambientes están libres en este momento para usar?',
    usuario: {
      id: 1,
      dni: '00000001',
      nombres: 'Super',
      apellidos: 'Admin',
      rolSistema: 'super_admin',
    },
  });

  console.log('\n✅ Respuesta de Gemini:');
  console.log(res.respuesta);
  console.log('\n⚡ Herramientas ejecutadas:', res.herramientasEjecutadas);
  console.log('🪙 Tokens consumidos:', res.tokens);
  console.log('💵 Costo USD:', res.costoUsd);
  console.log('⏱️ Duración:', res.duracionMs, 'ms');

  const cfgAfter = await getConfiguracionGemini();
  console.log('\n📊 Métricas actualizadas en DB:', {
    totalTokens: cfgAfter.totalTokens,
    totalRequests: cfgAfter.totalRequests,
    costoTotalEstimadoUsd: cfgAfter.costoTotalEstimadoUsd,
  });

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
