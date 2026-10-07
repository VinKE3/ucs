import { NextResponse } from 'next/server';
import { db } from '@/db';
import { asistencias, usuarios, sedes, ambientes, cursos } from '@/db/schema';
import { desc, eq, and, gte, lte } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return new NextResponse('No autorizado', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sedeId = searchParams.get('sedeId');
    const tipoPersonal = searchParams.get('tipoPersonal');
    const estado = searchParams.get('estado');
    const cursoId = searchParams.get('cursoId');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');

    let query = db
      .select({
        id: asistencias.id,
        fecha: asistencias.fecha,
        horaIngreso: asistencias.horaIngreso,
        horaSalida: asistencias.horaSalida,
        minutosTotales: asistencias.minutosTotales,
        estado: asistencias.estado,
        tipoRegistro: asistencias.tipoRegistro,
        observaciones: asistencias.observaciones,
        motivoModificacion: asistencias.motivoModificacion,
        dni: usuarios.dni,
        nombres: usuarios.nombres,
        apellidos: usuarios.apellidos,
        tipoPersonal: usuarios.tipoPersonal,
        tarifaHora: usuarios.tarifaHora,
        sedeNombre: sedes.nombre,
        ambienteNombre: ambientes.nombre,
        ambienteCodigo: ambientes.codigo,
        cursoNombre: cursos.nombre,
        cursoCodigo: cursos.codigo,
        cursoTarifaHoraPs: cursos.tarifaHoraPs,
        horaEntradaProgramada: asistencias.horaEntradaProgramada,
        horaSalidaProgramada: asistencias.horaSalidaProgramada,
        minutosTardanza: asistencias.minutosTardanza,
        minutosAnticipo: asistencias.minutosAnticipo,
        minutosExtra: asistencias.minutosExtra,
      })
      .from(asistencias)
      .innerJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
      .innerJoin(sedes, eq(asistencias.sedeId, sedes.id))
      .leftJoin(ambientes, eq(asistencias.ambienteId, ambientes.id))
      .leftJoin(cursos, eq(asistencias.cursoId, cursos.id))
      .$dynamic();

    const conditions = [];

    if (sedeId && sedeId !== 'todas') {
      conditions.push(eq(asistencias.sedeId, Number(sedeId)));
    }

    if (tipoPersonal && tipoPersonal !== 'todos') {
      conditions.push(eq(usuarios.tipoPersonal, tipoPersonal as any));
    }

    if (estado && estado !== 'todos') {
      conditions.push(eq(asistencias.estado, estado as any));
    }

    if (cursoId && cursoId !== 'todos') {
      conditions.push(eq(asistencias.cursoId, Number(cursoId)));
    }

    if (fechaDesde) {
      conditions.push(gte(asistencias.fecha, fechaDesde));
    }

    if (fechaHasta) {
      conditions.push(lte(asistencias.fecha, fechaHasta));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const list = await query.orderBy(desc(asistencias.horaIngreso));

    // Construcción de CSV con BOM UTF-8 (\uFEFF)
    const headers = [
      'ID',
      'Fecha',
      'DNI',
      'Apellidos',
      'Nombres',
      'Tipo de Personal',
      'Turno Programado',
      'Puntualidad Entrada',
      'Tardanza (min)',
      'Anticipo (min)',
      'Sobretiempo (min)',
      'Sede',
      'Sala / Ambiente',
      'Código de Sala',
      'Curso / Asignatura',
      'Hora Ingreso',
      'Hora Salida',
      'Minutos Totales',
      'Horas (Decimal)',
      'Tarifa / Hora (S/.)',
      'Monto Sesión Estimado (S/.)',
      'Estado',
      'Modo Registro',
      'Observaciones / Auditoría',
    ];

    const escapeCsv = (str: string | number | null | undefined) => {
      if (str === null || str === undefined) return '""';
      const val = String(str).replace(/"/g, '""');
      return `"${val}"`;
    };

    const rows = list.map((item) => {
      const ingresoStr = item.horaIngreso
        ? new Date(item.horaIngreso).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '';
      const salidaStr = item.horaSalida
        ? new Date(item.horaSalida).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '';
      const minutos = item.minutosTotales || 0;
      const horasDecimal = (minutos / 60).toFixed(2);
      // Tarifa efectiva: si es paciente simulado y el curso tiene tarifa propia, prima el curso; de lo contrario se usa la tarifa base del usuario
      const tarifaNum = (item.tipoPersonal === 'paciente_simulado' && item.cursoTarifaHoraPs)
        ? Number(item.cursoTarifaHoraPs)
        : (item.tarifaHora ? Number(item.tarifaHora) : null);
      const montoSesion = (tarifaNum && minutos > 0 && item.estado !== 'anulado')
        ? ((minutos / 60) * tarifaNum).toFixed(2)
        : '';

      let tipoPersonalLabel: string = item.tipoPersonal;
      if (item.tipoPersonal === 'docente') tipoPersonalLabel = 'Docente';
      if (item.tipoPersonal === 'tecnico') tipoPersonalLabel = 'Técnico de Simulación';
      if (item.tipoPersonal === 'paciente_simulado') tipoPersonalLabel = 'Paciente Simulado';

      let estadoLabel: string = item.estado;
      if (item.estado === 'en_curso') estadoLabel = 'En Curso';
      if (item.estado === 'finalizado') estadoLabel = 'Finalizado';
      if (item.estado === 'ajustado_manual') estadoLabel = 'Ajustado Manual';
      if (item.estado === 'anulado') estadoLabel = 'Anulado';

      // Turno y métricas de puntualidad
      const turnoProg = (item.horaEntradaProgramada || item.horaSalidaProgramada)
        ? `${item.horaEntradaProgramada || '--:--'} a ${item.horaSalidaProgramada || '--:--'}`
        : '';

      let puntualidadLabel = '';
      if (item.horaEntradaProgramada) {
        if (item.minutosTardanza && item.minutosTardanza > 0) {
          puntualidadLabel = `Tardanza (+${item.minutosTardanza}m)`;
        } else if (item.minutosAnticipo && item.minutosAnticipo > 0) {
          puntualidadLabel = `Anticipo (${item.minutosAnticipo}m)`;
        } else {
          puntualidadLabel = 'Puntual';
        }
      }

      return [
        escapeCsv(item.id),
        escapeCsv(item.fecha),
        escapeCsv(item.dni),
        escapeCsv(item.apellidos),
        escapeCsv(item.nombres),
        escapeCsv(tipoPersonalLabel),
        escapeCsv(turnoProg || '—'),
        escapeCsv(puntualidadLabel || '—'),
        escapeCsv(item.minutosTardanza ?? ''),
        escapeCsv(item.minutosAnticipo ?? ''),
        escapeCsv(item.minutosExtra ? `+${item.minutosExtra}` : ''),
        escapeCsv(item.sedeNombre),
        escapeCsv(item.ambienteNombre || 'Clínica General'),
        escapeCsv(item.ambienteCodigo || '—'),
        escapeCsv(item.cursoNombre ? `${item.cursoNombre}${item.cursoCodigo ? ` (${item.cursoCodigo})` : ''}` : '—'),
        escapeCsv(ingresoStr),
        escapeCsv(salidaStr),
        escapeCsv(minutos),
        escapeCsv(horasDecimal),
        escapeCsv(tarifaNum ? tarifaNum.toFixed(2) : ''),
        escapeCsv(montoSesion),
        escapeCsv(estadoLabel),
        escapeCsv(item.tipoRegistro),
        escapeCsv(item.motivoModificacion || item.observaciones || ''),
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="asistencias_simulacion_ucs_${todayStr}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exportando asistencias CSV:', error);
    return new NextResponse('Error al exportar datos', { status: 500 });
  }
}
