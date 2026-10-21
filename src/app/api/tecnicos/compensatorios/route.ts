import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bancoCompensatoriosTecnicos, usuarios, asistencias } from '@/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: Consultar saldo y movimientos del banco de días compensatorios
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const usuarioIdParam = searchParams.get('usuarioId');

    // 1. Si se solicita un técnico específico
    if (usuarioIdParam && !isNaN(Number(usuarioIdParam))) {
      const uId = Number(usuarioIdParam);

      const movimientos = await db
        .select({
          id: bancoCompensatoriosTecnicos.id,
          usuarioId: bancoCompensatoriosTecnicos.usuarioId,
          tipo: bancoCompensatoriosTecnicos.tipo,
          dias: bancoCompensatoriosTecnicos.dias,
          fechaReferencia: bancoCompensatoriosTecnicos.fechaReferencia,
          motivo: bancoCompensatoriosTecnicos.motivo,
          autorizadoPorId: bancoCompensatoriosTecnicos.autorizadoPorId,
          saldoResultante: bancoCompensatoriosTecnicos.saldoResultante,
          createdAt: bancoCompensatoriosTecnicos.createdAt,
          autorizadoPorNombres: usuarios.nombres,
          autorizadoPorApellidos: usuarios.apellidos,
        })
        .from(bancoCompensatoriosTecnicos)
        .leftJoin(usuarios, eq(bancoCompensatoriosTecnicos.autorizadoPorId, usuarios.id))
        .where(eq(bancoCompensatoriosTecnicos.usuarioId, uId))
        .orderBy(desc(bancoCompensatoriosTecnicos.createdAt));

      let saldoTotal = 0;
      let totalAcumulados = 0;
      let totalCanjeados = 0;

      for (const m of movimientos) {
        const val = Number(m.dias || 0);
        saldoTotal += val;
        if (val > 0) totalAcumulados += val;
        if (val < 0) totalCanjeados += Math.abs(val);
      }

      return NextResponse.json({
        success: true,
        usuarioId: uId,
        saldoDias: saldoTotal,
        totalAcumulados,
        totalCanjeados,
        movimientos,
      });
    }

    // 2. Si no se especifica usuarioId, obtener el resumen de balance para todos los técnicos
    const tecnicosList = await db
      .select({
        id: usuarios.id,
        nombres: usuarios.nombres,
        apellidos: usuarios.apellidos,
        dni: usuarios.dni,
        horaEntradaEsperada: usuarios.horaEntradaEsperada,
        horaSalidaEsperada: usuarios.horaSalidaEsperada,
      })
      .from(usuarios)
      .where(and(eq(usuarios.tipoPersonal, 'tecnico'), eq(usuarios.activo, true)));

    const todosMovimientos = await db
      .select({
        usuarioId: bancoCompensatoriosTecnicos.usuarioId,
        dias: bancoCompensatoriosTecnicos.dias,
      })
      .from(bancoCompensatoriosTecnicos);

    const saldosMap = new Map<number, number>();
    for (const m of todosMovimientos) {
      const cur = saldosMap.get(m.usuarioId) || 0;
      saldosMap.set(m.usuarioId, cur + Number(m.dias || 0));
    }

    const resumenTecnicos = tecnicosList.map((t) => ({
      ...t,
      saldoDiasCompensatorios: saldosMap.get(t.id) || 0,
    }));

    return NextResponse.json({
      success: true,
      resumenTecnicos,
    });
  } catch (error: unknown) {
    console.error('Error en GET /api/tecnicos/compensatorios:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener días compensatorios' },
      { status: 500 }
    );
  }
}

// POST: Registrar movimiento en el banco de días compensatorios
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado para gestionar compensatorios' }, { status: 403 });
    }

    const body = await request.json();
    const {
      action,
      usuarioId,
      tipo = 'acumulado', // 'acumulado' | 'canjeado' | 'ajuste_manual'
      dias = 1.0,
      fechaReferencia,
      motivo,
    } = body;

    // --- ACCIÓN ESPECIAL: Auto-detección de semanas 7/7 continuas sin descanso ---
    if (action === 'auto_detect_semanas') {
      if (!usuarioId) {
        return NextResponse.json({ error: 'usuarioId requerido para auto-detección' }, { status: 400 });
      }

      // Obtener todas las asistencias del técnico válidas
      const registros = await db
        .select({
          fecha: asistencias.fecha,
        })
        .from(asistencias)
        .where(
          and(
            eq(asistencias.usuarioId, Number(usuarioId)),
            sql`${asistencias.estado} != 'anulado'`
          )
        )
        .orderBy(asistencias.fecha);

      const diasAsistidos = Array.from(new Set(registros.map((r) => r.fecha)));

      // Mapear por semana (Lunes a Domingo)
      const semanasMap = new Map<string, string[]>();

      for (const fStr of diasAsistidos) {
        const [y, m, d] = fStr.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        const dayOfWeek = dt.getDay(); // 0 domingo, 1 lunes...
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const lunes = new Date(dt);
        lunes.setDate(dt.getDate() + diffToMonday);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const semanaKey = `${lunes.getFullYear()}-${pad(lunes.getMonth() + 1)}-${pad(lunes.getDate())}`;

        if (!semanasMap.has(semanaKey)) semanasMap.set(semanaKey, []);
        semanasMap.get(semanaKey)!.push(fStr);
      }

      // Buscar semanas con 7 días asistidos
      const semanasCompletas7Dias: Array<{
        lunesInicio: string;
        domingoFin: string;
        totalDias: number;
        dias: string[];
        yaRegistrado: boolean;
      }> = [];

      // Obtener compensatorios existentes para evitar duplicados
      const compensatoriosExistentes = await db
        .select()
        .from(bancoCompensatoriosTecnicos)
        .where(
          and(
            eq(bancoCompensatoriosTecnicos.usuarioId, Number(usuarioId)),
            eq(bancoCompensatoriosTecnicos.tipo, 'acumulado')
          )
        );

      for (const [lunesInicio, diasList] of semanasMap.entries()) {
        if (diasList.length >= 7) {
          const [y, m, d] = lunesInicio.split('-').map(Number);
          const dom = new Date(y, m - 1, d + 6);
          const pad = (n: number) => n.toString().padStart(2, '0');
          const domingoFin = `${dom.getFullYear()}-${pad(dom.getMonth() + 1)}-${pad(dom.getDate())}`;

          const yaReg = compensatoriosExistentes.some(
            (c) =>
              c.fechaReferencia === domingoFin ||
              c.fechaReferencia === lunesInicio ||
              (c.motivo && c.motivo.includes(lunesInicio))
          );

          semanasCompletas7Dias.push({
            lunesInicio,
            domingoFin,
            totalDias: diasList.length,
            dias: diasList,
            yaRegistrado: yaReg,
          });
        }
      }

      return NextResponse.json({
        success: true,
        semanasDetectadas: semanasCompletas7Dias,
      });
    }

    // --- REGISTRO DE MOVIMIENTO NORMAL ---
    if (!usuarioId || !motivo) {
      return NextResponse.json({ error: 'usuarioId y motivo son obligatorios' }, { status: 400 });
    }

    const valorDias = tipo === 'canjeado' ? -Math.abs(Number(dias)) : Math.abs(Number(dias));

    // Calcular saldo actual
    const movimientosPrevios = await db
      .select({ dias: bancoCompensatoriosTecnicos.dias })
      .from(bancoCompensatoriosTecnicos)
      .where(eq(bancoCompensatoriosTecnicos.usuarioId, Number(usuarioId)));

    const saldoActual = movimientosPrevios.reduce((acc, m) => acc + Number(m.dias || 0), 0);
    const nuevoSaldo = saldoActual + valorDias;

    const [nuevoMovimiento] = await db
      .insert(bancoCompensatoriosTecnicos)
      .values({
        usuarioId: Number(usuarioId),
        tipo,
        dias: String(valorDias),
        fechaReferencia: fechaReferencia || null,
        motivo: motivo.trim(),
        autorizadoPorId: session.userId,
        saldoResultante: String(nuevoSaldo),
      })
      .returning();

    return NextResponse.json({
      success: true,
      movimiento: nuevoMovimiento,
      saldoResultante: nuevoSaldo,
    });
  } catch (error: unknown) {
    console.error('Error en POST /api/tecnicos/compensatorios:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al registrar día compensatorio' },
      { status: 500 }
    );
  }
}
