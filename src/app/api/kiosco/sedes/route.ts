import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sedes, ambientes, asistencias, usuarios, cursos } from '@/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sedesList = await db
      .select({
        id: sedes.id,
        nombre: sedes.nombre,
        codigo: sedes.codigo,
        direccion: sedes.direccion,
      })
      .from(sedes)
      .where(eq(sedes.activo, true));

    const ambientesList = await db
      .select({
        id: ambientes.id,
        sedeId: ambientes.sedeId,
        nombre: ambientes.nombre,
        codigo: ambientes.codigo,
        tipo: ambientes.tipo,
        capacidad: ambientes.capacidad,
      })
      .from(ambientes)
      .where(eq(ambientes.activo, true));

    // Obtener asistencias activas en curso para conocer la ocupación de salas en vivo
    const activeAsistencias = await db
      .select({
        asistenciaId: asistencias.id,
        ambienteId: asistencias.ambienteId,
        cursoId: asistencias.cursoId,
        cursoNombre: cursos.nombre,
        horaIngreso: asistencias.horaIngreso,
        usuarioId: usuarios.id,
        nombres: usuarios.nombres,
        apellidos: usuarios.apellidos,
        tipoPersonal: usuarios.tipoPersonal,
      })
      .from(asistencias)
      .innerJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
      .leftJoin(cursos, eq(asistencias.cursoId, cursos.id))
      .where(
        and(
          eq(asistencias.estado, 'en_curso'),
          isNotNull(asistencias.ambienteId)
        )
      );

    // Agrupar ambientes dentro de cada sede con datos de ocupación
    const sedesConAmbientes = sedesList.map((sede) => ({
      ...sede,
      ambientes: ambientesList
        .filter((a) => a.sedeId === sede.id)
        .map((amb) => {
          const ocupantes = activeAsistencias.filter((oa) => oa.ambienteId === amb.id);
          const docentes = ocupantes.filter((o) => o.tipoPersonal === 'docente');
          const pacientes = ocupantes.filter((o) => o.tipoPersonal === 'paciente_simulado');
          const ocupantePrincipal = docentes[0] || ocupantes[0];
          const cursoItem = ocupantes.find((o) => o.cursoId !== null);

          let ocupanteTexto: string | null = null;
          if (ocupantePrincipal) {
            const sufijoRol =
              ocupantePrincipal.tipoPersonal === 'paciente_simulado'
                ? ' (Paciente Simulado)'
                : ocupantePrincipal.tipoPersonal === 'tecnico'
                ? ' (Técnico)'
                : '';
            ocupanteTexto = `${ocupantePrincipal.nombres} ${ocupantePrincipal.apellidos}${sufijoRol}`;
          }

          return {
            ...amb,
            ocupada: ocupantes.length > 0,
            docenteActivo: ocupanteTexto,
            horaIngresoDocente: ocupantePrincipal ? ocupantePrincipal.horaIngreso : null,
            cursoActivo: cursoItem?.cursoNombre || null,
            cursoActivoId: cursoItem?.cursoId || null,
            docentesActivos: docentes.map((d) => ({
              usuarioId: d.usuarioId,
              nombres: d.nombres,
              apellidos: d.apellidos,
              horaIngreso: d.horaIngreso,
            })),
            pacientesActivos: pacientes.map((p) => ({
              usuarioId: p.usuarioId,
              nombres: p.nombres,
              apellidos: p.apellidos,
              horaIngreso: p.horaIngreso,
            })),
            totalOcupantes: ocupantes.length,
          };
        }),
    }));

    return NextResponse.json({ sedes: sedesConAmbientes });
  } catch (error) {
    console.error('Error cargando sedes para kiosco:', error);
    return NextResponse.json({ error: 'Error al consultar sedes' }, { status: 500 });
  }
}

