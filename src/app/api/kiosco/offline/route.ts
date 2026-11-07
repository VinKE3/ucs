import { NextRequest, NextResponse } from 'next/server';
import { db, runTransaction } from '@/db';
import {
  usuarios,
  asistencias,
  ambientes,
  sedes,
  cursos,
  terminalesKiosco,
  sesionesProgramadas,
  auditoriaAsistencias,
} from '@/db/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { getPeruDateString, getPeruTimeString } from '@/lib/peruTime';
import { parseJsonBody, kioscoOfflineBatchSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

/**
 * Valida que la terminal cuente con cookie o token de autorización oficial.
 */
async function validarTerminalOficial(request: NextRequest) {
  const cookieToken = request.cookies.get('ucs_terminal_token')?.value;
  const headerToken = request.headers.get('x-terminal-token');
  const token = cookieToken || headerToken;

  if (!token) return null;

  const [term] = await db
    .select({
      id: terminalesKiosco.id,
      nombre: terminalesKiosco.nombre,
      sedeId: terminalesKiosco.sedeId,
      activo: terminalesKiosco.activo,
    })
    .from(terminalesKiosco)
    .where(and(eq(terminalesKiosco.token, token), eq(terminalesKiosco.activo, true)))
    .limit(1);

  return term || null;
}

/**
 * GET /api/kiosco/offline
 * Descarga el snapshot compacto del día para precarga en IndexedDB de la tablet.
 * Pesa solo ~35-45 KB y garantiza que el Kiosco funcione 100% ante cortes de red.
 */
export async function GET(request: NextRequest) {
  try {
    const terminal = await validarTerminalOficial(request);
    if (!terminal) {
      return NextResponse.json(
        { error: 'Dispositivo no autorizado para descargar snapshot offline' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const targetSedeId = searchParams.get('sedeId') ? Number(searchParams.get('sedeId')) : terminal.sedeId;
    const hoyStr = getPeruDateString();

    // 1. Padrón compacto de personal activo (excluyendo super admin)
    const personalList = await db
      .select({
        id: usuarios.id,
        dni: usuarios.dni,
        nombres: usuarios.nombres,
        apellidos: usuarios.apellidos,
        tipoPersonal: usuarios.tipoPersonal,
        rolSistema: usuarios.rolSistema,
        activo: usuarios.activo,
        horaEntradaEsperada: usuarios.horaEntradaEsperada,
        horaSalidaEsperada: usuarios.horaSalidaEsperada,
        toleranciaMinutos: usuarios.toleranciaMinutos,
        esHorarioRotativo: usuarios.esHorarioRotativo,
        horasJornadaObjetivo: usuarios.horasJornadaObjetivo,
      })
      .from(usuarios)
      .where(and(eq(usuarios.activo, true), ne(usuarios.dni, '00000001')));

    // 2. Sesiones SimClic del día (filtradas por sede si aplica o todas las activas)
    let sessionConditions = [
      eq(sesionesProgramadas.fecha, hoyStr),
      ne(sesionesProgramadas.estadoUcs, 'cancelada'),
    ];
    if (targetSedeId) {
      sessionConditions.push(eq(sesionesProgramadas.sedeId, targetSedeId));
    }

    const sesionesList = await db
      .select({
        id: sesionesProgramadas.id,
        simclicId: sesionesProgramadas.simclicId,
        titulo: sesionesProgramadas.titulo,
        fecha: sesionesProgramadas.fecha,
        horaInicio: sesionesProgramadas.horaInicio,
        horaFin: sesionesProgramadas.horaFin,
        sedeId: sesionesProgramadas.sedeId,
        sedeNombre: sesionesProgramadas.sedeNombreSimclic,
        ambienteId: sesionesProgramadas.ambienteId,
        ambienteNombre: sesionesProgramadas.ambienteNombreSimclic,
        ambienteCodigo: sesionesProgramadas.ambienteCodigoSimclic,
        cursoId: sesionesProgramadas.cursoId,
        cursoNombre: sesionesProgramadas.cursoNombreSimclic,
        docenteId: sesionesProgramadas.docenteId,
        docenteNombreSimclic: sesionesProgramadas.docenteNombreSimclic,
        docentesJson: sesionesProgramadas.docentesJson,
        pacienteSimuladoNombre: sesionesProgramadas.pacienteSimuladoNombre,
        pacientesSimuladosJson: sesionesProgramadas.pacientesSimuladosJson,
        asistenciaId: sesionesProgramadas.asistenciaId,
        estadoUcs: sesionesProgramadas.estadoUcs,
      })
      .from(sesionesProgramadas)
      .where(and(...sessionConditions));

    // 3. Ambientes físicos activos
    let ambienteConditions = [eq(ambientes.activo, true)];
    if (targetSedeId) {
      ambienteConditions.push(eq(ambientes.sedeId, targetSedeId));
    }

    const ambientesList = await db
      .select({
        id: ambientes.id,
        nombre: ambientes.nombre,
        codigo: ambientes.codigo,
        tipo: ambientes.tipo,
        sedeId: ambientes.sedeId,
      })
      .from(ambientes)
      .where(and(...ambienteConditions));

    // 4. Cursos activos
    const cursosList = await db
      .select({
        id: cursos.id,
        nombre: cursos.nombre,
        codigo: cursos.codigo,
        prefijo: cursos.prefijo,
      })
      .from(cursos);

    return NextResponse.json({
      success: true,
      fecha: hoyStr,
      snapshot: {
        fecha: hoyStr,
        usuarios: personalList,
        sesiones: sesionesList,
        ambientes: ambientesList,
        cursos: cursosList,
      },
    });
  } catch (err: any) {
    console.error('Error generando snapshot offline:', err);
    return NextResponse.json({ error: 'Error generando snapshot offline' }, { status: 500 });
  }
}

/**
 * POST /api/kiosco/offline
 * Recibe un lote de marcaciones offline encoladas en IndexedDB, las inserta en Neon PostgreSQL
 * respetando el timestamp físico original de la pantalla y previene duplicados.
 */
export async function POST(request: NextRequest) {
  try {
    const terminal = await validarTerminalOficial(request);
    if (!terminal) {
      return NextResponse.json(
        { error: 'Dispositivo no autorizado para sincronizar marcaciones offline' },
        { status: 403 }
      );
    }

    const parsed = await parseJsonBody(request, kioscoOfflineBatchSchema);
    if (!parsed.success) {
      return parsed.response;
    }
    const lote = parsed.data.lote;

    if (lote.length === 0) {
      return NextResponse.json({ success: true, procesados: [] });
    }

    const procesados: string[] = [];

    for (const item of lote) {
      try {
        const timestamp = new Date(item.timestampLocal);
        const fechaStr = getPeruDateString(timestamp);
        const horaStr = getPeruTimeString(timestamp);

        // 1. Obtener datos del usuario
        const [user] = await db
          .select()
          .from(usuarios)
          .where(eq(usuarios.id, item.usuarioId))
          .limit(1);

        if (!user || !user.activo) {
          // Si el usuario no existe o está inactivo, lo sacamos de la cola igualmente
          procesados.push(item.idLocal);
          continue;
        }

        if (item.accion === 'ingreso') {
          // Validar si ya cuenta con una asistencia activa
          const [existente] = await db
            .select({ id: asistencias.id })
            .from(asistencias)
            .where(and(eq(asistencias.usuarioId, user.id), eq(asistencias.estado, 'en_curso')))
            .limit(1);

          if (existente) {
            // Ya tiene turno activo; no duplicar
            procesados.push(item.idLocal);
            continue;
          }

          // Cálculo de puntualidad offline
          let horaEntradaProg: string | null = null;
          let horaSalidaProg: string | null = null;
          let tardanzaMin = 0;
          let anticipoMin = 0;

          if (user.tipoPersonal === 'tecnico' || user.tipoPersonal === 'administrativo') {
            if (user.esHorarioRotativo) {
              const horasObj = user.horasJornadaObjetivo ? Number(user.horasJornadaObjetivo) : 9.0;
              const duracionMs = Math.round(horasObj * 60) * 60 * 1000;
              const projExit = new Date(timestamp.getTime() + duracionMs);
              horaEntradaProg = 'ROTATIVO';
              horaSalidaProg = getPeruTimeString(projExit);
            } else if (user.horaEntradaEsperada) {
              horaEntradaProg = user.horaEntradaEsperada;
              horaSalidaProg = user.horaSalidaEsperada || null;
              const [expH, expM] = user.horaEntradaEsperada.split(':').map(Number);
              const [actH, actM] = horaStr.split(':').map(Number);
              const diff = (actH * 60 + actM) - (expH * 60 + expM);
              const tol = user.toleranciaMinutos ?? 10;
              if (diff > tol) tardanzaMin = diff;
              else if (diff < 0) anticipoMin = Math.abs(diff);
            }
          }

          const notaFinal = item.observaciones
            ? `${item.observaciones} | 💾 Marcación Offline (Sincronizada automáticamente)`
            : '💾 Marcación Offline (Sincronizada automáticamente)';

          try {
            if (item.sesionProgramadaId) {
              // Transacción atómica interactiva: Inserción de asistencia offline y enlace con SimClic
              await runTransaction(async (tx) => {
                const [inserted] = await tx
                  .insert(asistencias)
                  .values({
                    usuarioId: user.id,
                    sedeId: item.sedeId || terminal.sedeId || 1,
                    ambienteId: (user.tipoPersonal === 'tecnico' || user.tipoPersonal === 'administrativo') ? null : (item.ambienteId ? Number(item.ambienteId) : null),
                    cursoId: (user.tipoPersonal === 'tecnico' || user.tipoPersonal === 'administrativo') ? null : (item.cursoId ? Number(item.cursoId) : null),
                    fecha: fechaStr,
                    terminalIngresoId: terminal.id,
                    terminalIngresoNombre: terminal.nombre,
                    horaIngreso: timestamp,
                    horaEntradaProgramada: horaEntradaProg,
                    horaSalidaProgramada: horaSalidaProg,
                    minutosTardanza: tardanzaMin,
                    minutosAnticipo: anticipoMin,
                    estado: 'en_curso',
                    tipoRegistro: 'kiosco_autoservicio',
                    observaciones: notaFinal,
                  })
                  .returning();

                await tx
                  .update(sesionesProgramadas)
                  .set({
                    asistenciaId: inserted.id,
                    estadoUcs: 'en_curso',
                    updatedAt: new Date(),
                  })
                  .where(eq(sesionesProgramadas.id, Number(item.sesionProgramadaId)));
              });
            } else {
              await db
                .insert(asistencias)
                .values({
                  usuarioId: user.id,
                  sedeId: item.sedeId || terminal.sedeId || 1,
                  ambienteId: (user.tipoPersonal === 'tecnico' || user.tipoPersonal === 'administrativo') ? null : (item.ambienteId ? Number(item.ambienteId) : null),
                  cursoId: (user.tipoPersonal === 'tecnico' || user.tipoPersonal === 'administrativo') ? null : (item.cursoId ? Number(item.cursoId) : null),
                  fecha: fechaStr,
                  terminalIngresoId: terminal.id,
                  terminalIngresoNombre: terminal.nombre,
                  horaIngreso: timestamp,
                  horaEntradaProgramada: horaEntradaProg,
                  horaSalidaProgramada: horaSalidaProg,
                  minutosTardanza: tardanzaMin,
                  minutosAnticipo: anticipoMin,
                  estado: 'en_curso',
                  tipoRegistro: 'kiosco_autoservicio',
                  observaciones: notaFinal,
                });
            }
          } catch (err: any) {
            // Manejo de carrera o índice único
            if (err?.code === '23505' || String(err?.message || '').includes('uq_asistencia_activa_usuario')) {
              procesados.push(item.idLocal);
              continue;
            }
            throw err;
          }

          procesados.push(item.idLocal);
        } else if (item.accion === 'salida') {
          // Buscar turno activo para cerrar
          const [activa] = await db
            .select()
            .from(asistencias)
            .where(and(eq(asistencias.usuarioId, user.id), eq(asistencias.estado, 'en_curso')))
            .limit(1);

          if (activa) {
            const ingresoTime = new Date(activa.horaIngreso).getTime();
            const salidaTime = timestamp.getTime();
            const duracionMinutos = Math.max(1, Math.round((salidaTime - ingresoTime) / (1000 * 60)));

            let minutosExtra = 0;
            let minutosAnticipo = 0;

            if ((user.tipoPersonal === 'tecnico' || user.tipoPersonal === 'administrativo') && user.esHorarioRotativo) {
              const horasObj = user.horasJornadaObjetivo ? Number(user.horasJornadaObjetivo) : 9.0;
              const duracionObjetivoMin = Math.round(horasObj * 60);
              const tolerancia = user.toleranciaMinutos ?? 10;
              const diff = duracionMinutos - duracionObjetivoMin;

              if (diff > tolerancia) minutosExtra = diff;
              else if (diff < -tolerancia) minutosAnticipo = Math.abs(diff);
            }

            const notaCierre = activa.observaciones
              ? `${activa.observaciones} | 💾 Salida Offline Sincronizada`
              : '💾 Salida Offline Sincronizada';

            // Transacción atómica batch: Cierre de asistencia y sesión programada en una sola operación
            await db.batch([
              db
                .update(asistencias)
                .set({
                  horaSalida: timestamp,
                  minutosTotales: duracionMinutos,
                  minutosExtra,
                  minutosAnticipo,
                  estado: 'finalizado',
                  observaciones: notaCierre,
                  terminalSalidaId: terminal.id,
                  terminalSalidaNombre: terminal.nombre,
                  updatedAt: new Date(),
                })
                .where(eq(asistencias.id, activa.id)),
              db
                .update(sesionesProgramadas)
                .set({ estadoUcs: 'finalizada', updatedAt: new Date() })
                .where(eq(sesionesProgramadas.asistenciaId, activa.id)),
            ]);
          }

          procesados.push(item.idLocal);
        }
      } catch (itemErr) {
        console.error('Error procesando ítem offline:', itemErr);
        // No agregamos a procesados para que reintente en el próximo ciclo
      }
    }

    return NextResponse.json({
      success: true,
      totalRecibidos: lote.length,
      procesados,
    });
  } catch (err: any) {
    console.error('Error en POST /api/kiosco/offline:', err);
    return NextResponse.json({ error: 'Error procesando lote offline' }, { status: 500 });
  }
}

