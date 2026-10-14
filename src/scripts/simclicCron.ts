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

const INTERVALO_MINUTOS = parseInt(process.env.SIMCLIC_SYNC_INTERVAL_MINUTES || '30', 10);
const INTERVALO_MS = INTERVALO_MINUTOS * 60 * 1000;

async function ejecutarCicloSincronizacion(iteracion: number) {
  const horaActual = new Date().toLocaleTimeString('es-PE', { timeZone: 'America/Lima' });
  console.log(`\n======================================================`);
  console.log(`🤖 [SimClic Bot] Ciclo #${iteracion} — ${horaActual}`);
  console.log(`======================================================`);

  try {
    const { syncSimclicSessions } = await import('../lib/simclicSync');
    const res = await syncSimclicSessions();

    if (res.success) {
      console.log(`✅ Sincronización exitosa en ${(res.duracionMs / 1000).toFixed(1)}s`);
      console.log(`📅 Fecha: ${res.fecha} | Total Clases: ${res.total}`);
      console.log(`✨ Nuevas: ${res.creadas} | 🔄 Actualizadas: ${res.actualizadas}`);

      if (res.reubicadas > 0) {
        console.log(`\n⚠️ ATENCIÓN: Se detectaron ${res.reubicadas} cambios de sala por técnicos:`);
        res.detallesReubicadas?.forEach((r) => {
          console.log(`  • [${r.simclicId}] ${r.titulo}: "${r.salaAnterior}" ➔ "${r.salaNueva}"`);
        });
      } else {
        console.log(`🟢 Sin traslados de ambiente detectados en este ciclo.`);
      }
    } else {
      console.error(`⚠️ Advertencia en sincronización:`, res.error);
    }
  } catch (err: any) {
    console.error(`❌ Error en ciclo #${iteracion}:`, err.message || err);
  }

  const proximaEjecucion = new Date(Date.now() + INTERVALO_MS).toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima',
  });
  console.log(`⏰ Próxima verificación automática a las: ${proximaEjecucion} (${INTERVALO_MINUTOS} min)`);
}

async function startBot() {
  console.log(`🚀 Iniciando Bot Autónomo de Sincronización SimClic`);
  console.log(`⏱️  Frecuencia configurada: Cada ${INTERVALO_MINUTOS} minutos`);
  console.log(`🎯 Modo: Reconciliación continua y detección de cambios de sala`);

  let ciclo = 1;
  // Ejecutar el primer ciclo de inmediato
  await ejecutarCicloSincronizacion(ciclo);

  // Programar repetición periódica
  setInterval(async () => {
    ciclo++;
    await ejecutarCicloSincronizacion(ciclo);
  }, INTERVALO_MS);
}

startBot().catch((err) => {
  console.error('Error fatal al iniciar el bot:', err);
  process.exit(1);
});
