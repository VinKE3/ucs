import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getConfiguracionGemini,
  updateConfiguracionGemini,
  resetGeminiMetrics,
} from '@/lib/geminiService';
import { db } from '@/db';
import { logsGeminiRequests } from '@/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function esSuperAdmin(session: any): boolean {
  return (
    session?.rolSistema === 'super_admin' || session?.dni === '00000001'
  );
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !esSuperAdmin(session)) {
      return NextResponse.json(
        { error: 'Acceso denegado. Este panel está restringido exclusivamente a Super Administradores.' },
        { status: 403 }
      );
    }

    const config = await getConfiguracionGemini();

    // Obtener los últimos 50 logs de auditoría
    const logs = await db
      .select()
      .from(logsGeminiRequests)
      .orderBy(desc(logsGeminiRequests.createdAt))
      .limit(50);

    return NextResponse.json({
      success: true,
      config,
      logs,
    });
  } catch (err: any) {
    console.error('Error al obtener config de Gemini:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !esSuperAdmin(session)) {
      return NextResponse.json(
        { error: 'Acceso denegado. Solo el rol Super Administrador puede modificar la configuración de IA.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'toggle_enabled') {
      const habilitado = Boolean(body.habilitado);
      await updateConfiguracionGemini({ habilitado }, session.userId);
      const config = await getConfiguracionGemini();
      return NextResponse.json({
        success: true,
        mensaje: habilitado
          ? 'Asistente de IA Gemini activado exitosamente.'
          : 'Asistente de IA Gemini desactivado globalmente.',
        config,
      });
    }

    if (action === 'change_model') {
      const modelo = String(body.modelo || 'gemini-2.5-flash');
      await updateConfiguracionGemini({ modelo }, session.userId);
      const config = await getConfiguracionGemini();
      return NextResponse.json({
        success: true,
        mensaje: `Modelo actualizado a: ${modelo}`,
        config,
      });
    }

    if (action === 'reset_metrics') {
      await resetGeminiMetrics(session.userId);
      const config = await getConfiguracionGemini();
      return NextResponse.json({
        success: true,
        mensaje: 'Contadores de consumo de tokens reiniciados a 0.',
        config,
      });
    }

    return NextResponse.json(
      { error: 'Acción no reconocida' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Error al actualizar config de Gemini:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno al procesar configuración' },
      { status: 500 }
    );
  }
}
