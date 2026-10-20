import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Dispositivo desvinculado del sistema exitosamente.',
  });

  response.cookies.delete('ucs_terminal_token');

  return response;
}
