import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { incidenciasSala, sedes, ambientes, categoriasIncidencia } from '@/db/schema';
import { eq, desc, sql, gte, lte, and } from 'drizzle-orm';
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

    // 1. Construir condiciones de filtrado
    const conditions = [];

    if (sedeIdStr && sedeIdStr !== 'todas') {
      const sId = parseInt(sedeIdStr, 10);
      if (!isNaN(sId)) {
        conditions.push(eq(incidenciasSala.sedeId, sId));
      }
    }

    if (desdeStr) {
      const fechaDesde = new Date(`${desdeStr}T00:00:00-05:00`);
      if (!isNaN(fechaDesde.getTime())) {
        conditions.push(gte(incidenciasSala.createdAt, fechaDesde));
      }
    }

    if (hastaStr) {
      const fechaHasta = new Date(`${hastaStr}T23:59:59-05:00`);
      if (!isNaN(fechaHasta.getTime())) {
        conditions.push(lte(incidenciasSala.createdAt, fechaHasta));
      }
    }

    // 2. Traer incidencias filtradas
    let baseQuery = db
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
      .orderBy(desc(incidenciasSala.createdAt));

    const rows = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).limit(1000)
      : await baseQuery.limit(500);

    // 3. Catálogo de categorías para obtener color e icono
    const cats = await db.select().from(categoriasIncidencia);
    const catMap = new Map(cats.map((c) => [c.nombre.toLowerCase().trim(), c]));

    // 4. Procesar estadísticas para el período
    let totalPeriodo = 0;
    let pendientes = 0;
    let enCamino = 0;
    let resueltas = 0;

    let sumaTiemposRespuesta = 0;
    let countTiemposRespuesta = 0;

    let sumaTiemposResolucion = 0;
    let countTiemposResolucion = 0;

    // SLA: rapido (< 5 min), regular (5 - 10 min), demorado (> 10 min)
    let slaRapido = 0;
    let slaRegular = 0;
    let slaDemorado = 0;

    const ambientesCountMap = new Map<string, { ambienteNombre: string; sedeNombre: string; total: number }>();
    const categoriasCountMap = new Map<string, number>();
    const tecnicosCountMap = new Map<string, number>();

    // Inicializar 24 horas para horas punta
    const horasCount = Array.from({ length: 24 }, (_, i) => ({
      hora: i,
      label: `${i.toString().padStart(2, '0')}:00`,
      total: 0,
    }));

    const incidenciasConTiempos = rows.map((r) => {
      const createdDate = new Date(r.createdAt);
      totalPeriodo++;

      if (r.estado === 'pendiente') pendientes++;
      if (r.estado === 'en_camino') enCamino++;
      if (r.estado === 'resuelto') resueltas++;

      // Registrar hora punta en horario Perú (UTC-5)
      try {
        const horaPeru = parseInt(
          new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', hour: 'numeric', hour12: false }).format(createdDate),
          10
        ) % 24;
        if (!isNaN(horaPeru) && horasCount[horaPeru]) {
          horasCount[horaPeru].total++;
        }
      } catch {
        const h = createdDate.getHours();
        if (horasCount[h]) horasCount[h].total++;
      }

      // Tiempo de respuesta (minutos desde created hasta atendido)
      let tiempoRespuestaMinutos: number | null = null;
      if (r.atendidoAt) {
        const atendidoDate = new Date(r.atendidoAt);
        const diffMs = atendidoDate.getTime() - createdDate.getTime();
        if (diffMs >= 0) {
          tiempoRespuestaMinutos = Math.round((diffMs / (1000 * 60)) * 10) / 10;
          if (tiempoRespuestaMinutos <= 120) {
            sumaTiemposRespuesta += tiempoRespuestaMinutos;
            countTiemposRespuesta++;

            if (tiempoRespuestaMinutos < 5) slaRapido++;
            else if (tiempoRespuestaMinutos <= 10) slaRegular++;
            else slaDemorado++;
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

    const tasaResolucionPorcentaje = totalPeriodo > 0 
      ? Math.round((resueltas / totalPeriodo) * 100) 
      : 0;

    return NextResponse.json({
      success: true,
      metricas: {
        totalHoy: totalPeriodo,
        pendientesHoy: pendientes,
        enCaminoHoy: enCamino,
        resueltasHoy: resueltas,
        tiempoPromedioRespuestaMins,
        tiempoPromedioResolucionMins,
        topAmbientes,
        distribucionCategorias,
        topTecnicos,
        distribucionHoras: horasCount,
        tasaResolucionPorcentaje,
        slaCumplimiento: {
          rapido: slaRapido,
          regular: slaRegular,
          demorado: slaDemorado,
        },
        rangoPeriodoLabel: desdeStr && hastaStr ? `${desdeStr} al ${hastaStr}` : 'Período Completo',
      },
      incidencias: incidenciasConTiempos,
    });
  } catch (error: any) {
    console.error('Error al calcular métricas de soporte:', error);
    return NextResponse.json({ error: 'Error interno al consultar métricas' }, { status: 500 });
  }
}

