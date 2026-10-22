import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getConfiguracionGemini } from '@/lib/geminiService';

export const dynamic = 'force-dynamic';

function esSuperAdmin(session: any): boolean {
  return (
    session?.rolSistema === 'super_admin' || session?.dni === '00000001'
  );
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session || !esSuperAdmin(session)) {
      return NextResponse.json(
        { error: 'No autorizado. Solo Super Admin puede realizar pruebas de conectividad.' },
        { status: 403 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'La variable GEMINI_API_KEY no está configurada.' },
        { status: 500 }
      );
    }

    const config = await getConfiguracionGemini();
    const modelo = config.modelo || 'gemini-2.5-flash';

    const tStart = Date.now();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Responde únicamente con "CONECTADO_OK"' }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 10,
          },
        }),
      }
    );

    const duracionMs = Date.now() - tStart;

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        {
          exitoso: false,
          error: `Error HTTP ${res.status}: ${errText}`,
          duracionMs,
          modelo,
        },
        { status: 502 }
      );
    }

    const data = await res.json();
    const respuesta =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'OK';

    return NextResponse.json({
      exitoso: true,
      mensaje: 'Conexión con Google Gemini Pro API validada exitosamente.',
      respuesta,
      duracionMs,
      modelo,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error en /api/copilot/test:', err);
    return NextResponse.json(
      { exitoso: false, error: err.message || 'Error de red con Google AI' },
      { status: 500 }
    );
  }
}
