import fs from 'fs';
import path from 'path';

// Asegurar carga de .env.local cuando se ejecuta como script independiente
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
  console.log('🔄 Iniciando sincronización manual con SimClic...');
  const { syncSimclicSessions } = await import('../lib/simclicSync');

  const res = await syncSimclicSessions();
  if (res.success) {
    console.log(`\n🎉 Sincronización exitosa en ${res.duracionMs}ms!`);
    console.log(`📅 Fecha: ${res.fecha}`);
    console.log(`📊 Total recibidas: ${res.total}`);
    console.log(`✨ Nuevas creadas: ${res.creadas}`);
    console.log(`🔄 Actualizadas: ${res.actualizadas}`);
    console.log(`⚠️ Salas reubicadas por técnicos: ${res.reubicadas}`);

    if (res.detallesReubicadas && res.detallesReubicadas.length > 0) {
      console.log('\n--- DETALLES DE SESIONES REUBICADAS ---');
      res.detallesReubicadas.forEach((d) => {
        console.log(`• [ID ${d.simclicId}] ${d.titulo}: ${d.salaAnterior} ➔ ${d.salaNueva}`);
      });
    }
    process.exit(0);
  } else {
    console.error('❌ Error en sincronización:', res.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
