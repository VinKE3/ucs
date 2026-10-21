import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { turnosProgramadosTecnicos, bancoCompensatoriosTecnicos, usuarios } from '@/db/schema';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: Consultar la programación de turnos de un técnico o de todos para un rango o mes
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const usuarioIdParam = searchParams.get('usuarioId');
    const mes = searchParams.get('mes'); // ej: "2026-10"
    const fechaInicio = searchParams.get('fechaInicio');
    const fechaFin = searchParams.get('fechaFin');

    const conditions = [];

    if (usuarioIdParam && !isNaN(Number(usuarioIdParam))) {
      conditions.push(eq(turnosProgramadosTecnicos.usuarioId, Number(usuarioIdParam)));
    }

    if (mes) {
      conditions.push(sql`${turnosProgramadosTecnicos.fecha} LIKE ${mes + '%'}`);
    } else if (fechaInicio && fechaFin) {
      conditions.push(
        and(
          gte(turnosProgramadosTecnicos.fecha, fechaInicio),
          lte(turnosProgramadosTecnicos.fecha, fechaFin)
        )
      );
    }

    const turnos = await db
      .select({
        id: turnosProgramadosTecnicos.id,
        usuarioId: turnosProgramadosTecnicos.usuarioId,
        fecha: turnosProgramadosTecnicos.fecha,
        tipoDia: turnosProgramadosTecnicos.tipoDia,
        horaEntradaEsperada: turnosProgramadosTecnicos.horaEntradaEsperada,
        horaSalidaEsperada: turnosProgramadosTecnicos.horaSalidaEsperada,
        esPersonalizado: turnosProgramadosTecnicos.esPersonalizado,
        nota: turnosProgramadosTecnicos.nota,
        programadoPorId: turnosProgramadosTecnicos.programadoPorId,
        createdAt: turnosProgramadosTecnicos.createdAt,
        updatedAt: turnosProgramadosTecnicos.updatedAt,
      })
      .from(turnosProgramadosTecnicos)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(turnosProgramadosTecnicos.fecha);

    return NextResponse.json({
      success: true,
      turnos,
    });
  } catch (error: unknown) {
    console.error('Error en GET /api/tecnicos/cronograma:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener cronograma de técnicos' },
      { status: 500 }
    );
  }
}

// POST: Registrar o actualizar la programación de un día para un técnico
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado para programar turnos' }, { status: 403 });
    }

    const body = await request.json();
    const {
      usuarioId,
      fecha,
      tipoDia = 'laborable',
      horaEntradaEsperada,
      horaSalidaEsperada,
      esPersonalizado = false,
      nota,
    } = body;

    if (!usuarioId || !fecha) {
      return NextResponse.json({ error: 'usuarioId y fecha son requeridos' }, { status: 400 });
    }

    // Verificar si ya existe programación para ese usuario y fecha
    const [existente] = await db
      .select()
      .from(turnosProgramadosTecnicos)
      .where(
        and(
          eq(turnosProgramadosTecnicos.usuarioId, Number(usuarioId)),
          eq(turnosProgramadosTecnicos.fecha, String(fecha))
        )
      );

    let guardado;

    if (existente) {
      [guardado] = await db
        .update(turnosProgramadosTecnicos)
        .set({
          tipoDia,
          horaEntradaEsperada: tipoDia === 'laborable' || tipoDia === 'guardia_evento' ? horaEntradaEsperada || null : null,
          horaSalidaEsperada: tipoDia === 'laborable' || tipoDia === 'guardia_evento' ? horaSalidaEsperada || null : null,
          esPersonalizado: Boolean(esPersonalizado),
          nota: nota || null,
          programadoPorId: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(turnosProgramadosTecnicos.id, existente.id))
        .returning();
    } else {
      [guardado] = await db
        .insert(turnosProgramadosTecnicos)
        .values({
          usuarioId: Number(usuarioId),
          fecha: String(fecha),
          tipoDia,
          horaEntradaEsperada: tipoDia === 'laborable' || tipoDia === 'guardia_evento' ? horaEntradaEsperada || null : null,
          horaSalidaEsperada: tipoDia === 'laborable' || tipoDia === 'guardia_evento' ? horaSalidaEsperada || null : null,
          esPersonalizado: Boolean(esPersonalizado),
          nota: nota || null,
          programadoPorId: session.userId,
        })
        .returning();
    }

    // Si se programó como "descanso_compensatorio", verificar si ya se descontó del banco
    if (tipoDia === 'descanso_compensatorio') {
      const [yaCanjeado] = await db
        .select()
        .from(bancoCompensatoriosTecnicos)
        .where(
          and(
            eq(bancoCompensatoriosTecnicos.usuarioId, Number(usuarioId)),
            eq(bancoCompensatoriosTecnicos.tipo, 'canjeado'),
            eq(bancoCompensatoriosTecnicos.fechaReferencia, String(fecha))
          )
        );

      if (!yaCanjeado) {
        // Calcular saldo previo
        const movimientos = await db
          .select({ dias: bancoCompensatoriosTecnicos.dias })
          .from(bancoCompensatoriosTecnicos)
          .where(eq(bancoCompensatoriosTecnicos.usuarioId, Number(usuarioId)));

        const saldoActual = movimientos.reduce((acc, m) => acc + Number(m.dias || 0), 0);
        const nuevoSaldo = saldoActual - 1.0;

        await db.insert(bancoCompensatoriosTecnicos).values({
          usuarioId: Number(usuarioId),
          tipo: 'canjeado',
          dias: '-1.0',
          fechaReferencia: String(fecha),
          motivo: `Descanso compensatorio tomado en fecha ${fecha}${nota ? ` (${nota})` : ''}`,
          autorizadoPorId: session.userId,
          saldoResultante: String(nuevoSaldo),
        });
      }
    }

    return NextResponse.json({
      success: true,
      turno: guardado,
    });
  } catch (error: unknown) {
    console.error('Error en POST /api/tecnicos/cronograma:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al guardar programación de turno' },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar la programación específica de un día (revertir al turno base del usuario)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    const usuarioIdParam = searchParams.get('usuarioId');
    const fechaParam = searchParams.get('fecha');

    if (idParam) {
      await db
        .delete(turnosProgramadosTecnicos)
        .where(eq(turnosProgramadosTecnicos.id, Number(idParam)));
      return NextResponse.json({ success: true, message: 'Turno programado eliminado' });
    }

    if (usuarioIdParam && fechaParam) {
      await db
        .delete(turnosProgramadosTecnicos)
        .where(
          and(
            eq(turnosProgramadosTecnicos.usuarioId, Number(usuarioIdParam)),
            eq(turnosProgramadosTecnicos.fecha, String(fechaParam))
          )
        );
      return NextResponse.json({ success: true, message: 'Turno programado eliminado' });
    }

    return NextResponse.json({ error: 'id o (usuarioId y fecha) requeridos' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error en DELETE /api/tecnicos/cronograma:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar turno programado' },
      { status: 500 }
    );
  }
}
