import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { terminalesSala, sedes, ambientes, configuracionSistema, categoriasIncidencia } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Memoria simple de intentos fallidos por IP (Rate Limiting básico anti-fuerza bruta)
const failedAttemptsMap = new Map<string, { count: number; blockedUntil: number }>();

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-ip';
    const now = Date.now();

    // 1. Verificar Rate-limiting por IP
    const ipRecord = failedAttemptsMap.get(ip);
    if (ipRecord && ipRecord.blockedUntil > now) {
      const waitMinutes = Math.ceil((ipRecord.blockedUntil - now) / 60000);
      return NextResponse.json(
        { success: false, error: `Demasiados intentos fallidos. Espera ${waitMinutes} minuto(s) para reintentar.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { pin, sedeId, ambienteId, nombreDispositivo, tipoDispositivo, tokenExistente } = body;

    // Caso A: Si ya tiene un token de terminal existente (reconexión automática)
    if (tokenExistente && !pin) {
      const [existingTerminal] = await db
        .select({
          id: terminalesSala.id,
          token: terminalesSala.token,
          nombre: terminalesSala.nombre,
          sedeId: terminalesSala.sedeId,
          sedeNombre: sedes.nombre,
          ambienteId: terminalesSala.ambienteId,
          ambienteNombre: ambientes.nombre,
          ambienteCodigo: ambientes.codigo,
          activo: terminalesSala.activo,
        })
        .from(terminalesSala)
        .innerJoin(sedes, eq(terminalesSala.sedeId, sedes.id))
        .innerJoin(ambientes, eq(terminalesSala.ambienteId, ambientes.id))
        .where(eq(terminalesSala.token, String(tokenExistente).trim()))
        .limit(1);

      if (existingTerminal) {
        if (!existingTerminal.activo) {
          return NextResponse.json(
            { success: false, error: 'Esta terminal ha sido deshabilitada por el administrador.' },
            { status: 403 }
          );
        }

        // Actualizar último acceso de forma silenciosa
        await db
          .update(terminalesSala)
          .set({ ultimoAcceso: new Date() })
          .where(eq(terminalesSala.id, existingTerminal.id));

        const categorias = await db
          .select()
          .from(categoriasIncidencia)
          .where(eq(categoriasIncidencia.activo, true))
          .orderBy(asc(categoriasIncidencia.orden));

        return NextResponse.json({
          success: true,
          reconnected: true,
          token: existingTerminal.token,
          terminal: existingTerminal,
          categorias,
        });
      }
    }

    // Caso B: Vinculación con PIN
    if (!pin) {
      return NextResponse.json({ success: false, error: 'Ingresa el PIN de autorización' }, { status: 400 });
    }

    // 2. Obtener PIN maestro configurado
    const [pinConfig] = await db
      .select()
      .from(configuracionSistema)
      .where(eq(configuracionSistema.clave, 'pin_maestro_salas'))
      .limit(1);

    const validPin = pinConfig?.valor || '2026';

    if (String(pin).trim() !== validPin.trim()) {
      // Registrar intento fallido
      const current = failedAttemptsMap.get(ip) || { count: 0, blockedUntil: 0 };
      current.count++;
      if (current.count >= 5) {
        current.blockedUntil = now + 15 * 60 * 1000; // 15 minutos de bloqueo
      }
      failedAttemptsMap.set(ip, current);

      return NextResponse.json(
        { success: false, error: 'PIN incorrecto. Consulta con el Administrador o Soporte Técnico.' },
        { status: 401 }
      );
    }

    // Si el PIN es correcto, limpiar intentos fallidos
    failedAttemptsMap.delete(ip);

    if (!sedeId || !ambienteId) {
      return NextResponse.json(
        { success: false, error: 'Debes seleccionar la Sede y el Ambiente/Sala' },
        { status: 400 }
      );
    }

    // 3. Validar existencia de sede y ambiente
    const [sedeRow] = await db.select().from(sedes).where(eq(sedes.id, Number(sedeId))).limit(1);
    const [ambienteRow] = await db.select().from(ambientes).where(eq(ambientes.id, Number(ambienteId))).limit(1);

    if (!sedeRow || !ambienteRow) {
      return NextResponse.json({ success: false, error: 'Sede o Sala no válidos' }, { status: 404 });
    }

    // 4. Crear o registrar la terminal
    const token = crypto.randomUUID();
    const aliasDispositivo = nombreDispositivo ? String(nombreDispositivo).trim() : 'PC Principal Aula';

    const [nuevaTerminal] = await db
      .insert(terminalesSala)
      .values({
        sedeId: Number(sedeId),
        ambienteId: Number(ambienteId),
        token,
        nombre: aliasDispositivo,
        tipoDispositivo: tipoDispositivo || 'pc',
        activo: true,
        ultimoAcceso: new Date(),
      })
      .returning();

    // 5. Cargar botones de auxilio activos
    const categorias = await db
      .select()
      .from(categoriasIncidencia)
      .where(eq(categoriasIncidencia.activo, true))
      .orderBy(asc(categoriasIncidencia.orden));

    return NextResponse.json({
      success: true,
      token: nuevaTerminal.token,
      terminal: {
        id: nuevaTerminal.id,
        nombre: nuevaTerminal.nombre,
        tipoDispositivo: nuevaTerminal.tipoDispositivo,
        sedeId: sedeRow.id,
        sedeNombre: sedeRow.nombre,
        ambienteId: ambienteRow.id,
        ambienteNombre: ambienteRow.nombre,
        ambienteCodigo: ambienteRow.codigo,
      },
      categorias,
    });
  } catch (error: any) {
    console.error('Error en /api/sala/auth:', error);
    return NextResponse.json({ success: false, error: 'Error interno al autorizar terminal' }, { status: 500 });
  }
}
