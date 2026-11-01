import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { terminalesKiosco } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const cookieToken = request.cookies.get('ucs_terminal_token')?.value;

    if (cookieToken) {
      // Marcar autoRecuperable en falso para que no se auto-restaure inmediatamente si fue desvinculación explícita
      await db
        .update(terminalesKiosco)
        .set({ autoRecuperable: false, updatedAt: new Date() })
        .where(eq(terminalesKiosco.token, cookieToken))
        .catch(() => {});
    }

    const response = NextResponse.json({
      success: true,
      message: 'Dispositivo desvinculado del sistema exitosamente.',
    });

    response.cookies.delete('ucs_terminal_token');

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
