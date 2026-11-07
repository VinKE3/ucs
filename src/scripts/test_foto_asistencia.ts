import { guardarFotoAsistencia } from '../lib/fotoStorage';
import { kioscoMarcarSchema } from '../lib/validations/kiosco';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('🧪 Iniciando pruebas de Verificación Visual y Almacenamiento Fotográfico (Vercel Blob / Fallback)...');

  // 1. Validar esquema Zod con fotoBase64
  const sampleValidPayload = {
    usuarioId: 10,
    accion: 'ingreso' as const,
    sedeId: 1,
    ambienteId: 5,
    fotoBase64: 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoB+AA/vlNAAP7/v23//////////8eP///////9/8//9//+AAAA',
  };

  const parsed = kioscoMarcarSchema.safeParse(sampleValidPayload);
  if (!parsed.success) {
    console.error('❌ Falló la validación Zod de fotoBase64:', parsed.error);
    process.exit(1);
  }
  console.log('✅ Validación Zod de fotoBase64 aprobada.');

  // 2. Probar guardarFotoAsistencia con fallback local (sin token en entorno de prueba)
  const fakePixelWebP = 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQAcJaACdLoB+AA/vlNAAP7/v23//////////8eP///////9/8//9//+AAAA';
  const urlGenerada = await guardarFotoAsistencia({
    fotoBase64: fakePixelWebP,
    usuarioId: 999,
    asistenciaId: 8888,
    tipoPersonal: 'paciente_simulado',
  });

  if (!urlGenerada) {
    console.error('❌ guardarFotoAsistencia devolvió null');
    process.exit(1);
  }

  console.log('✅ guardarFotoAsistencia generó exitosamente la URL:', urlGenerada);

  // Verificar que el archivo exista en disco local si se utilizó la ruta fallback
  if (urlGenerada.startsWith('/uploads/asistencias/')) {
    const localPath = path.join(process.cwd(), 'public', urlGenerada);
    if (!fs.existsSync(localPath)) {
      console.error('❌ El archivo guardado localmente no se encontró en disco:', localPath);
      process.exit(1);
    }
    console.log('✅ Archivo verificado físicamente en disco local:', localPath);

    // Limpieza de prueba
    try {
      fs.unlinkSync(localPath);
      console.log('🧹 Limpieza de archivo temporal de prueba completada.');
    } catch {}
  }

  console.log('🎉 Todas las pruebas del módulo de fotografías pasaron al 100%!');
}

runTest().catch((err) => {
  console.error('❌ Error ejecutando test:', err);
  process.exit(1);
});

