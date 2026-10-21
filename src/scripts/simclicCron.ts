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

    // 1. Sincronizar Hoy
    console.log(`📡 Sincronizando clases de HOY...`);
    const resHoy = await syncSimclicSessions(new Date());

    if (resHoy.success) {
      console.log(`✅ [Hoy ${resHoy.fecha}] Clases: ${resHoy.total} en ${(resHoy.duracionMs / 1000).toFixed(1)}s (Nuevas: ${resHoy.creadas}, Act: ${resHoy.actualizadas})`);
      if (resHoy.reubicadas > 0) {
        console.log(`\n⚠️ ATENCIÓN: Se detectaron ${resHoy.reubicadas} cambios de sala por técnicos:`);
        resHoy.detallesReubicadas?.forEach((r) => {
          console.log(`  • [${r.simclicId}] ${r.titulo}: "${r.salaAnterior}" ➔ "${r.salaNueva}"`);
        });
      } else {
        console.log(`🟢 Sin traslados de ambiente detectados en este ciclo.`);
      }
    } else {
      console.error(`⚠️ Advertencia en sincronización de hoy:`, resHoy.error);
    }

    // 2. Sincronizar Mañana para consulta anticipada de docentes
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    console.log(`📡 Sincronizando clases de MAÑANA para consulta anticipada...`);
    const resManana = await syncSimclicSessions(manana);
    if (resManana.success) {
      console.log(`✅ [Mañana ${resManana.fecha}] Clases: ${resManana.total} en ${(resManana.duracionMs / 1000).toFixed(1)}s (Nuevas: ${resManana.creadas})`);
    } else {
      console.warn(`⚠️ Advertencia en sincronización de mañana:`, resManana.error);
    }

    // 3. Sincronización de Ventana Deslizante (Semana Completa) cada 4 ciclos (~2 horas) o en el primer ciclo
    const tocaSemana = iteracion === 1 || iteracion % 4 === 0;
    if (tocaSemana) {
      console.log(`📅 [Ventana Deslizante] Sincronizando preventivamente la SEMANA COMPLETA con SimClic...`);
      const resSemana = await syncSimclicSessions({ targetDate: new Date(), modo: 'semana' });
      if (resSemana.success) {
        console.log(`🎉 [Semana Completa] ${resSemana.total} clases procesadas en ${(resSemana.duracionMs / 1000).toFixed(1)}s (${resSemana.diasProcesados?.length || 7} días). Nuevas: ${resSemana.creadas}, Actualizadas: ${resSemana.actualizadas}, Canceladas: ${resSemana.canceladas}`);
      } else {
        console.warn(`⚠️ Advertencia sincronizando semana completa:`, resSemana.error);
      }
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
