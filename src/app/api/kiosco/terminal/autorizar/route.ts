import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/db';
import { usuarios, terminalesKiosco, sedes } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { identificador, password, nombreTerminal, sedeId } = await request.json();

    if (!identificador || !password) {
      return NextResponse.json(
        { error: 'Debe ingresar credenciales de Administrador para autorizar este dispositivo.' },
        { status: 400 }
      );
    }

    if (!nombreTerminal || !nombreTerminal.trim()) {
      return NextResponse.json(
        { error: 'Debe asignar un nombre a la terminal (ej: "Tablet Recepción Villa").' },
        { status: 400 }
      );
    }

    // 1. Validar usuario administrador
    const foundUsers = await db
      .select()
      .from(usuarios)
      .where(
        or(
          eq(usuarios.correo, identificador.trim().toLowerCase()),
          eq(usuarios.dni, identificador.trim())
        )
      )
      .limit(1);

    if (foundUsers.length === 0) {
      return NextResponse.json(
        { error: 'Credenciales inválidas o usuario no encontrado.' },
        { status: 401 }
      );
    }

    const adminUser = foundUsers[0];

    if (!adminUser.activo) {
      return NextResponse.json(
        { error: 'El usuario administrador se encuentra inactivo.' },
        { status: 403 }
      );
    }

    if (adminUser.rolSistema !== 'super_admin' && adminUser.rolSistema !== 'admin') {
      return NextResponse.json(
        { error: 'Solo usuarios con rol Administrador o Super Admin pueden autorizar terminales físicas.' },
        { status: 403 }
      );
    }

    if (!adminUser.passwordHash) {
      return NextResponse.json(
        { error: 'El usuario no tiene una contraseña configurada.' },
        { status: 400 }
      );
    }

    const isMatch = await verifyPassword(password, adminUser.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Contraseña de administrador incorrecta.' },
        { status: 401 }
      );
    }

    // 2. Extraer información del dispositivo y red
    const userAgent = request.headers.get('user-agent') || 'Desconocido';
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipRegistro = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';

    // 3. Generar token único seguro
    const rawToken = crypto.randomBytes(32).toString('hex');
    const token = `trm_${rawToken}`;

    // 4. Guardar terminal en base de datos
    const [nuevaTerminal] = await db
      .insert(terminalesKiosco)
      .values({
        token,
        nombre: nombreTerminal.trim(),
        sedeId: sedeId ? Number(sedeId) : null,
        dispositivoInfo: userAgent,
        ipRegistro,
        activo: true,
        ultimoUso: new Date(),
        creadoPor: adminUser.id,
      })
      .returning();

    // Obtener nombre de sede si fue asignada
    let sedeNombre: string | null = null;
    if (nuevaTerminal.sedeId) {
      const [sedeObj] = await db
        .select({ nombre: sedes.nombre })
        .from(sedes)
        .where(eq(sedes.id, nuevaTerminal.sedeId))
        .limit(1);
      if (sedeObj) sedeNombre = sedeObj.nombre;
    }

    return NextResponse.json({
      success: true,
      message: `Dispositivo "${nuevaTerminal.nombre}" autorizado exitosamente.`,
      token: nuevaTerminal.token,
      terminal: {
        id: nuevaTerminal.id,
        nombre: nuevaTerminal.nombre,
        sedeId: nuevaTerminal.sedeId,
        sedeNombre,
      },
    });
  } catch (error: any) {
    console.error('Error al autorizar terminal kiosco:', error);
    return NextResponse.json(
      { error: error.message || 'Error al autorizar terminal.' },
      { status: 500 }
    );
  }
}
