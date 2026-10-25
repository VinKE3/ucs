import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { incidenciasSala, sedes, ambientes, categoriasIncidencia } from '@/db/schema';
import { eq, desc, sql, gte } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sedeIdStr = searchParams.get('sedeId');
    const desdeStr = searchParams.get('desde');
    const hastaStr = searchParams.get('hasta');

    // 1. Obtener fecha de hoy en zona horaria Perú (YYYY-MM-DD)
    const hoyLima = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const inicioHoy = new Date(`${hoyLima}T00:00:00-05:00`);

    // 2. Traer las incidencias de los últimos 30 días (o filtradas) para métricas
    const rows = await db
      .select({
        id: incidenciasSala.id,
        sedeId: incidenciasSala.sedeId,
        sedeNombre: sedes.nombre,
        ambienteId: incidenciasSala.ambienteId,
        ambienteNombre: ambientes.nombre,
        terminalId: incidenciasSala.terminalId,
        terminalNombre: incidenciasSala.terminalNombre,
        categoria: incidenciasSala.categoria,
        descripcion: incidenciasSala.descripcion,
        docenteNombre: incidenciasSala.docenteNombre,
        cursoNombre: incidenciasSala.cursoNombre,
        estado: incidenciasSala.estado,
        tecnicoId: incidenciasSala.tecnicoId,
        tecnicoNombre: incidenciasSala.tecnicoNombre,
        motivoResolucion: incidenciasSala.motivoResolucion,
        notaResolucion: incidenciasSala.notaResolucion,
        createdAt: incidenciasSala.createdAt,
        atendidoAt: incidenciasSala.atendidoAt,
        resueltoAt: incidenciasSala.resueltoAt,
      })
      .from(incidenciasSala)
      .innerJoin(sedes, eq(incidenciasSala.sedeId, sedes.id))
      .innerJoin(ambientes, eq(incidenciasSala.ambienteId, ambientes.id))
      .orderBy(desc(incidenciasSala.createdAt))
      .limit(300);

    // 3. Catálogo de categorías para obtener color e icono
    const cats = await db.select().from(categoriasIncidencia);
    const catMap = new Map(cats.map((c) => [c.nombre.toLowerCase().trim(), c]));

    // 4. Procesar estadísticas
    let totalHoy = 0;
    let pendientesHoy = 0;
    let enCaminoHoy = 0;
    let resueltasHoy = 0;

    let sumaTiemposRespuesta = 0;
    let countTiemposRespuesta = 0;

    let sumaTiemposResolucion = 0;
    let countTiemposResolucion = 0;

    const ambientesCountMap = new Map<string, { ambienteNombre: string; sedeNombre: string; total: number }>();
    const categoriasCountMap = new Map<string, number>();
    const tecnicosCountMap = new Map<string, number>();

    const incidenciasConTiempos = rows.map((r) => {
      const createdDate = new Date(r.createdAt);
      const isToday = createdDate >= inicioHoy;

      if (isToday) {
        totalHoy++;
        if (r.estado === 'pendiente') pendientesHoy++;
        if (r.estado === 'en_camino') enCaminoHoy++;
        if (r.estado === 'resuelto') resueltasHoy++;
      }

      // Tiempo de respuesta (minutos desde created hasta atendido)
      let tiempoRespuestaMinutos: number | null = null;
      if (r.atendidoAt) {
        const atendidoDate = new Date(r.atendidoAt);
        const diffMs = atendidoDate.getTime() - createdDate.getTime();
        if (diffMs >= 0) {
          tiempoRespuestaMinutos = Math.round((diffMs / (1000 * 60)) * 10) / 10;
          if (tiempoRespuestaMinutos <= 120) { // filtrar valores atípicos absurdos
            sumaTiemposRespuesta += tiempoRespuestaMinutos;
            countTiemposRespuesta++;
          }
        }
      }

      // Tiempo de resolución (minutos desde created hasta resuelto)
      let tiempoResolucionMinutos: number | null = null;
      if (r.resueltoAt) {
        const resueltoDate = new Date(r.resueltoAt);
        const diffMs = resueltoDate.getTime() - createdDate.getTime();
        if (diffMs >= 0) {
          tiempoResolucionMinutos = Math.round((diffMs / (1000 * 60)) * 10) / 10;
          if (tiempoResolucionMinutos <= 240) {
            sumaTiemposResolucion += tiempoResolucionMinutos;
            countTiemposResolucion++;
          }
        }
      }

      // Conteo por Ambiente
      const ambKey = `${r.sedeNombre} - ${r.ambienteNombre}`;
      const existingAmb = ambientesCountMap.get(ambKey);
      if (existingAmb) {
        existingAmb.total++;
      } else {
        ambientesCountMap.set(ambKey, {
          ambienteNombre: r.ambienteNombre,
          sedeNombre: r.sedeNombre,
          total: 1,
        });
      }

      // Conteo por Categoría
      const catKey = r.categoria.trim();
      categoriasCountMap.set(catKey, (categoriasCountMap.get(catKey) || 0) + 1);

      // Conteo por Técnico
      if (r.tecnicoNombre && r.estado === 'resuelto') {
        const tecKey = r.tecnicoNombre.trim();
        tecnicosCountMap.set(tecKey, (tecnicosCountMap.get(tecKey) || 0) + 1);
      }

      return {
        ...r,
        estado: r.estado as 'pendiente' | 'en_camino' | 'resuelto' | 'cancelado',
        createdAt: createdDate.toISOString(),
        atendidoAt: r.atendidoAt ? new Date(r.atendidoAt).toISOString() : null,
        resueltoAt: r.resueltoAt ? new Date(r.resueltoAt).toISOString() : null,
        tiempoRespuestaMinutos,
        tiempoResolucionMinutos,
      };
    });

    const tiempoPromedioRespuestaMins = countTiemposRespuesta > 0 
      ? Math.round((sumaTiemposRespuesta / countTiemposRespuesta) * 10) / 10 
      : 0;

    const tiempoPromedioResolucionMins = countTiemposResolucion > 0 
      ? Math.round((sumaTiemposResolucion / countTiemposResolucion) * 10) / 10 
      : 0;

    const topAmbientes = Array.from(ambientesCountMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const distribucionCategorias = Array.from(categoriasCountMap.entries())
      .map(([categoria, total]) => {
        const found = catMap.get(categoria.toLowerCase());
        return {
          categoria,
          total,
          color: found?.color || '#3b82f6',
          icono: found?.icono || '🚨',
        };
      })
      .sort((a, b) => b.total - a.total);

    const topTecnicos = Array.from(tecnicosCountMap.entries())
      .map(([tecnicoNombre, total]) => ({ tecnicoNombre, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      metricas: {
        totalHoy,
        pendientesHoy,
        enCaminoHoy,
        resueltasHoy,
        tiempoPromedioRespuestaMins,
        tiempoPromedioResolucionMins,
        topAmbientes,
        distribucionCategorias,
        topTecnicos,
      },
      incidencias: incidenciasConTiempos,
    });
  } catch (error: any) {
    console.error('Error al calcular métricas de soporte:', error);
    return NextResponse.json({ error: 'Error interno al consultar métricas' }, { status: 500 });
  }
}
