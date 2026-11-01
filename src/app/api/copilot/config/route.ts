import { parseJsonBody, copilotConfigSchema } from '@/lib/validations';
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

    const parsed = await parseJsonBody(request, copilotConfigSchema);
    if (!parsed.success) {
      return parsed.response;
    }
    const { action, habilitado, modelo } = parsed.data;

    if (action === 'toggle_enabled') {
      const habVal = Boolean(habilitado);
      await updateConfiguracionGemini({ habilitado: habVal }, session.userId);
      const config = await getConfiguracionGemini();
      return NextResponse.json({
        success: true,
        mensaje: habVal
          ? 'Asistente de IA Gemini activado exitosamente.'
          : 'Asistente de IA Gemini desactivado globalmente.',
        config,
      });
    }

    if (action === 'change_model') {
      const modVal = String(modelo || 'gemini-2.5-flash');
      await updateConfiguracionGemini({ modelo: modVal }, session.userId);
      const config = await getConfiguracionGemini();
      return NextResponse.json({
        success: true,
        mensaje: `Modelo actualizado a: ${modVal}`,
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
