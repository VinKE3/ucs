import { NextResponse } from 'next/server';
import { getConfiguracionGemini } from '@/lib/geminiService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await getConfiguracionGemini();
    return NextResponse.json({
      habilitado: config.habilitado,
      modelo: config.modelo,
    });
  } catch (err: any) {
    return NextResponse.json({ habilitado: false });
  }
}
