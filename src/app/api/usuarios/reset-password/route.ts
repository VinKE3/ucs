import { NextResponse } from 'next/server';
import { db } from '@/db';
import { usuarios } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSession, hashPassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.rolSistema !== 'super_admin') {
      return NextResponse.json(
        { error: 'No autorizado. Solo el Super Admin puede restablecer contraseñas manualmente.' },
        { status: 403 }
      );
    }

    const { usuarioId, newPassword } = await request.json();

    if (!usuarioId || !newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return NextResponse.json(
        { error: 'Debe especificar el ID de usuario y una contraseña con al menos 6 caracteres.' },
        { status: 400 }
      );
    }

    const targetUsers = await db.select().from(usuarios).where(eq(usuarios.id, usuarioId)).limit(1);
    if (targetUsers.length === 0) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    const hashedPassword = await hashPassword(newPassword.trim());

    await db
      .update(usuarios)
      .set({
        passwordHash: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(usuarios.id, usuarioId));

    return NextResponse.json({
      ok: true,
      message: `Contraseña actualizada correctamente para ${targetUsers[0].nombres} ${targetUsers[0].apellidos}.`,
    });
  } catch (error) {
    console.error('Error restableciendo contraseña:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al restablecer contraseña' },
      { status: 500 }
    );
  }
}
