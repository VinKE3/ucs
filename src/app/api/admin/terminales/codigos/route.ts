import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/db';
import { codigosAutorizacionTerminal, sedes, usuarios, terminalesKiosco } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { parseJsonBody, crearCodigoOtpTerminalSchema, idSchema } from '@/lib/validations';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

function generarCodigoOtp(): string {
  // Genera un código de 6 dígitos numéricos legibles: formato "XXX-XXX" (ej: "749-182")
  const num = crypto.randomInt(100000, 999999);
  const str = num.toString();
  return `${str.slice(0, 3)}-${str.slice(3)}`;
}

// GET: Listar todos los códigos OTP de autorización generados
export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const rows = await db
      .select({
        id: codigosAutorizacionTerminal.id,
        codigo: codigosAutorizacionTerminal.codigo,
        nombreSugerido: codigosAutorizacionTerminal.nombreSugerido,
        sedeId: codigosAutorizacionTerminal.sedeId,
        creadoPor: codigosAutorizacionTerminal.creadoPor,
        nota: codigosAutorizacionTerminal.nota,
        expiraAt: codigosAutorizacionTerminal.expiraAt,
        usado: codigosAutorizacionTerminal.usado,
        usadoAt: codigosAutorizacionTerminal.usadoAt,
        terminalId: codigosAutorizacionTerminal.terminalId,
        ipUso: codigosAutorizacionTerminal.ipUso,
        activo: codigosAutorizacionTerminal.activo,
        createdAt: codigosAutorizacionTerminal.createdAt,
        sedeNombre: sedes.nombre,
        creadorNombre: usuarios.nombres,
        creadorApellido: usuarios.apellidos,
        terminalNombre: terminalesKiosco.nombre,
      })
      .from(codigosAutorizacionTerminal)
      .leftJoin(sedes, eq(codigosAutorizacionTerminal.sedeId, sedes.id))
      .leftJoin(usuarios, eq(codigosAutorizacionTerminal.creadoPor, usuarios.id))
      .leftJoin(terminalesKiosco, eq(codigosAutorizacionTerminal.terminalId, terminalesKiosco.id))
      .orderBy(desc(codigosAutorizacionTerminal.createdAt));

    const now = new Date().getTime();

    const codigosFormateados = rows.map((r) => {
      const expTime = new Date(r.expiraAt).getTime();
      let estado: 'activo' | 'usado' | 'expirado' | 'revocado' = 'activo';
      if (!r.activo) {
        estado = 'revocado';
      } else if (r.usado) {
        estado = 'usado';
      } else if (expTime <= now) {
        estado = 'expirado';
      } else {
        estado = 'activo';
      }

      const tiempoRestanteMinutos = Math.max(0, Math.round((expTime - now) / 60000));

      return {
        ...r,
        estado,
        tiempoRestanteMinutos,
      };
    });

    return NextResponse.json({ codigos: codigosFormateados });
  } catch (error: any) {
    console.error('Error al listar códigos OTP de terminales:', error);
    return NextResponse.json({ error: 'Error al listar códigos OTP' }, { status: 500 });
  }
}

// POST: Crear un nuevo código OTP de autorización
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const parsed = await parseJsonBody(request, crearCodigoOtpTerminalSchema);
    if (!parsed.success) {
      return parsed.response;
    }
    const { sedeId, nombreSugerido, duracionMinutos, nota } = parsed.data;

    // Generar código único asegurando que no colisione
    let codigo = generarCodigoOtp();
    let intentos = 0;
    while (intentos < 5) {
      const existing = await db
        .select({ id: codigosAutorizacionTerminal.id })
        .from(codigosAutorizacionTerminal)
        .where(eq(codigosAutorizacionTerminal.codigo, codigo))
        .limit(1);
      if (existing.length === 0) break;
      codigo = generarCodigoOtp();
      intentos++;
    }

    const duracionValida = Math.min(Math.max(Number(duracionMinutos) || 30, 5), 1440); // 5 min a 24 horas
    const expiraAt = new Date(Date.now() + duracionValida * 60 * 1000);

    const [nuevoCodigo] = await db
      .insert(codigosAutorizacionTerminal)
      .values({
        codigo,
        nombreSugerido: nombreSugerido ? String(nombreSugerido).trim() : null,
        sedeId: sedeId ? Number(sedeId) : null,
        creadoPor: session.userId,
        nota: nota ? String(nota).trim() : null,
        expiraAt,
        usado: false,
        activo: true,
      })
      .returning();

    // Obtener nombre de la sede
    let sedeNombre: string | null = null;
    if (nuevoCodigo.sedeId) {
      const [s] = await db
        .select({ nombre: sedes.nombre })
        .from(sedes)
        .where(eq(sedes.id, nuevoCodigo.sedeId))
        .limit(1);
      if (s) sedeNombre = s.nombre;
    }

    return NextResponse.json({
      success: true,
      message: `Código temporal "${nuevoCodigo.codigo}" generado exitosamente.`,
      codigo: {
        ...nuevoCodigo,
        sedeNombre,
        estado: 'activo',
        tiempoRestanteMinutos: duracionValida,
      },
    });
  } catch (error: any) {
    console.error('Error al generar código OTP de terminal:', error);
    return NextResponse.json({ error: 'Error al generar código OTP' }, { status: 500 });
  }
}

// PATCH: Revocar código antes de su expiración
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const parsed = await parseJsonBody(request, z.object({ id: idSchema }));
    if (!parsed.success) {
      return parsed.response;
    }
    const { id } = parsed.data;

    const [updated] = await db
      .update(codigosAutorizacionTerminal)
      .set({ activo: false, updatedAt: new Date() })
      .where(eq(codigosAutorizacionTerminal.id, Number(id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Código no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Código "${updated.codigo}" revocado exitosamente.`,
      codigo: updated,
    });
  } catch (error: any) {
    console.error('Error al revocar código OTP:', error);
    return NextResponse.json({ error: 'Error al revocar código OTP' }, { status: 500 });
  }
}

// DELETE: Eliminar registro de código OTP
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    if (!idParam) {
      return NextResponse.json({ error: 'ID no proporcionado' }, { status: 400 });
    }

    const id = parseInt(idParam, 10);
    const [deleted] = await db
      .delete(codigosAutorizacionTerminal)
      .where(eq(codigosAutorizacionTerminal.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Código no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Registro de código eliminado correctamente.`,
    });
  } catch (error: any) {
    console.error('Error al eliminar código OTP:', error);
    return NextResponse.json({ error: 'Error al eliminar código' }, { status: 500 });
  }
}

