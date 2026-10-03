import { NextResponse } from 'next/server';
import { db } from '@/db';
import { usuarios } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { verifyPassword, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { identificador, password } = await request.json();

    if (!identificador || !password) {
      return NextResponse.json(
        { error: 'Debe ingresar su correo/DNI y contraseña' },
        { status: 400 }
      );
    }

    // Buscar por correo o DNI
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
        { error: 'Credenciales inválidas o usuario no encontrado' },
        { status: 401 }
      );
    }

    const user = foundUsers[0];

    if (!user.activo) {
      return NextResponse.json(
        { error: 'Este usuario se encuentra inactivo. Contacte al Super Admin.' },
        { status: 403 }
      );
    }

    if (user.rolSistema === 'ninguno') {
      return NextResponse.json(
        { error: 'Este usuario no tiene permisos de acceso al panel administrativo.' },
        { status: 403 }
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'El usuario no tiene una contraseña configurada. Solicite al Super Admin que le asigne una.' },
        { status: 400 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Credenciales incorrectas. Verifique su contraseña.' },
        { status: 401 }
      );
    }

    // Crear sesión
    const sessionData = {
      userId: user.id,
      dni: user.dni,
      nombres: user.nombres,
      apellidos: user.apellidos,
      correo: user.correo,
      rolSistema: user.rolSistema,
      tipoPersonal: user.tipoPersonal,
    };

    await setSessionCookie(sessionData);

    return NextResponse.json({
      ok: true,
      user: sessionData,
    });
  } catch (error) {
    console.error('Error en /api/auth/login:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al autenticar' },
      { status: 500 }
    );
  }
}
