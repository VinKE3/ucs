import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { procesarMensajeGemini } from '@/lib/geminiService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado. Debes iniciar sesión para usar el asistente.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { mensaje, historial } = body;

    if (!mensaje || typeof mensaje !== 'string' || !mensaje.trim()) {
      return NextResponse.json(
        { error: 'El mensaje no puede estar vacío.' },
        { status: 400 }
      );
    }

    const resultado = await procesarMensajeGemini({
      mensaje: mensaje.trim(),
      historial: Array.isArray(historial) ? historial : [],
      usuario: {
        id: session.userId,
        dni: session.dni,
        nombres: session.nombres,
        apellidos: session.apellidos,
        rolSistema: session.rolSistema,
      },
    });

    return NextResponse.json({
      success: true,
      ...resultado,
    });
  } catch (err: any) {
    console.error('Error en /api/copilot/chat:', err);
    return NextResponse.json(
      {
        error:
          err.message ||
          'Ocurrió un error al procesar tu consulta con Gemini IA.',
      },
      { status: 500 }
    );
  }
}
