import fs from 'fs';
import path from 'path';

export interface GuardarFotoOptions {
  fotoBase64: string;
  usuarioId: number;
  asistenciaId: number;
  tipoPersonal?: string;
}

/**
 * Guarda la fotografía de evidencia de marcación de Kiosco.
 * - Si BLOB_READ_WRITE_TOKEN está configurado, la sube a Vercel Blob Storage en la nube.
 * - Si no está configurado (ej: desarrollo local inicial o demo), la guarda en public/uploads/asistencias/
 *   garantizando que la demo funcione al 100% de inmediato sin errores.
 */
export async function guardarFotoAsistencia(options: GuardarFotoOptions): Promise<string | null> {
  const { fotoBase64, usuarioId, asistenciaId } = options;
  if (!fotoBase64 || typeof fotoBase64 !== 'string') return null;

  try {
    // 1. Extraer los bytes en Buffer (admite data:image/webp;base64,... o data:image/jpeg;base64,...)
    const cleanBase64 = fotoBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    if (buffer.length === 0) return null;

    const fechaHoy = new Date().toISOString().slice(0, 10);
    const fileName = `asist_${asistenciaId}_user${usuarioId}_${Date.now()}.webp`;

    // 2. Ruta A: Vercel Blob Storage Oficial
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    if (blobToken && blobToken.length > 10 && !blobToken.includes('...')) {
      try {
        const { put } = await import('@vercel/blob');
        const blobPath = `asistencias/${fechaHoy}/${fileName}`;
        const blobResult = await put(blobPath, buffer, {
          access: 'public',
          contentType: 'image/webp',
          token: blobToken,
        });
        return blobResult.url;
      } catch (blobErr) {
        console.warn('⚠️ Falló subida a Vercel Blob, recurriendo a almacenamiento local de respaldo:', blobErr);
      }
    }

    // 3. Ruta B: Almacenamiento Local de Respaldo / Demo Inmediata en /public/uploads/asistencias/
    const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads', 'asistencias');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const localFilePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(localFilePath, buffer);
    return `/uploads/asistencias/${fileName}`;
  } catch (error) {
    console.error('❌ Error al procesar fotografía de asistencia:', error);
    return null;
  }
}

