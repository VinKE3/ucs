'use client';

import React, { useState, useMemo } from 'react';
import type {
  SesionProgramadaTimelineItem,
  UsuarioItem,
  PacienteSimuladoProgramadoItem,
} from '@/types/admin';
import { showToast } from '@/lib/alerts';

interface RadarLlegadaActoresProps {
  sesiones: SesionProgramadaTimelineItem[];
  fecha: string;
  selectedSedeId: number | null;
  nombreSede: string;
  nowMinutes: number;
  esHoy: boolean;
  usuariosList?: UsuarioItem[];
  onVerDetalleSesion?: (ses: SesionProgramadaTimelineItem) => void;
  onOpenCrearAsistenciaManual?: () => void;
  onIrAGantt?: () => void;
}

export type NivelRiesgoLlegada =
  | 'critico'         // <15 min para iniciar o en curso sin haber marcado (Rojo)
  | 'proximo'         // 16 a 35 min para iniciar (Amarillo)
  | 'en_sala'         // Ya marcó en el Kiosco y está en la sala (Verde)
  | 'programado_tarde'// >35 min para iniciar (Gris/Azul)
  | 'finalizado'      // Clase terminada y asistió (Morado/Gris)
  | 'ausente';        // Clase terminada y nunca marcó (Rojo apagado)

export interface ItemRadarActor {
  id: string; // sesionId-index
  sesionId: number;
  actorNombre: string;
  personaje: string;
  email?: string | null;
  telefono?: string | null;
  telefonoWsp?: string | null;
  curso: string;
  escenario: string;
  docenteNombre: string;
  docentePresente: boolean;
  salaNombre: string;
  salaCodigo?: string | null;
  sedeNombre: string;
  horaInicio: string;
  horaFin: string;
  startMins: number;
  endMins: number;
  duracionMinutos: number;
  presente: boolean;
  horaIngresoReal?: string | null;
  minutosParaInicio: number; // Positivo si falta, negativo si ya empezó
  nivelRiesgo: NivelRiesgoLlegada;
  sesionRef: SesionProgramadaTimelineItem;
}

export const RadarLlegadaActores: React.FC<RadarLlegadaActoresProps> = ({
  sesiones,
  fecha,
  selectedSedeId,
  nombreSede,
  nowMinutes,
  esHoy,
  usuariosList = [],
  onVerDetalleSesion,
  onOpenCrearAsistenciaManual,
  onIrAGantt,
}) => {
  // Filtros interactivos del radar
  const [filtroRiesgo, setFiltroRiesgo] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState<string>('');

  // 1. Extraer y aplanar todas las citaciones individuales de actores
  const actoresList = useMemo(() => {
    const list: ItemRadarActor[] = [];

    // Normalizador de texto tolerante a tildes
    const norm = (s: string) =>
      (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    // Crear mapa rápido de usuarios tipo paciente_simulado para teléfonos
    const usuariosMap = new Map<string, UsuarioItem>();
    for (const u of usuariosList) {
      if (u.tipoPersonal === 'paciente_simulado' || u.tipoPersonal === 'docente') {
        const keyNom = norm(`${u.nombres} ${u.apellidos}`);
        usuariosMap.set(keyNom, u);
        // También por apellidos solos si es único
        if (u.apellidos) usuariosMap.set(norm(u.apellidos), u);
      }
    }

    for (const ses of sesiones) {
      // Ignorar canceladas
      if (ses.estadoUcs === 'cancelada' || (ses as any).estadoSimclic === 'Cancelled') {
        continue;
      }

      // Obtener lista de actores de esta sesión
      const psItems: PacienteSimuladoProgramadoItem[] = [];
      if (
        ses.pacientesSimulados &&
        Array.isArray(ses.pacientesSimulados) &&
        ses.pacientesSimulados.length > 0
      ) {
        psItems.push(...ses.pacientesSimulados);
      } else if (
        ses.pacientesSimuladosJson &&
        Array.isArray(ses.pacientesSimuladosJson) &&
        ses.pacientesSimuladosJson.length > 0
      ) {
        psItems.push(...ses.pacientesSimuladosJson);
      } else if (ses.pacienteSimuladoNombre) {
        psItems.push({
          nombre: ses.pacienteSimuladoNombre,
          email: ses.pacienteSimuladoCorreo,
          rol: 'Paciente Estandarizado',
          presente: ses.psPresente,
        });
      }

      // Si no requiere actores, pasar a la siguiente
      if (psItems.length === 0) continue;

      for (let idx = 0; idx < psItems.length; idx++) {
        const ps = psItems[idx];
        const actorNombre = ps.nombre || 'Actor sin asignar';
        const actorNorm = norm(actorNombre);

        // Buscar teléfono en usuariosList
        let telefonoRaw: string | null = null;
        let telefonoWsp: string | null = null;

        const matchUser =
          usuariosMap.get(actorNorm) ||
          Array.from(usuariosMap.values()).find((u) => {
            const uFull = norm(`${u.nombres} ${u.apellidos}`);
            return uFull.includes(actorNorm) || actorNorm.includes(uFull);
          });

        if (matchUser?.telefono) {
          telefonoRaw = matchUser.telefono;
          const digits = matchUser.telefono.replace(/\D/g, '');
          if (digits.length === 9 && digits.startsWith('9')) {
            telefonoWsp = `51${digits}`;
          } else if (digits.length >= 7) {
            telefonoWsp = digits;
          }
        }

        const minutosParaInicio = ses.startMins - nowMinutes;
        const presente = Boolean(ps.presente || ses.psPresente);
        let horaIngresoReal: string | null = null;

        if (ps.horaIngreso) {
          try {
            const d = new Date(ps.horaIngreso);
            horaIngresoReal = isNaN(d.getTime())
              ? String(ps.horaIngreso).slice(0, 5)
              : d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
          } catch {
            horaIngresoReal = String(ps.horaIngreso).slice(0, 5);
          }
        }

        // Determinar Nivel de Riesgo
        let nivelRiesgo: NivelRiesgoLlegada = 'programado_tarde';

        if (presente) {
          if (esHoy && nowMinutes >= ses.endMins) {
            nivelRiesgo = 'finalizado';
          } else {
            nivelRiesgo = 'en_sala';
          }
        } else if (esHoy) {
          if (nowMinutes >= ses.endMins) {
            nivelRiesgo = 'ausente';
          } else if (nowMinutes >= ses.startMins) {
            // Ya empezó la clase y NO ha marcado
            nivelRiesgo = 'critico';
          } else if (minutosParaInicio <= 15) {
            // Falta 15 min o menos y NO ha marcado
            nivelRiesgo = 'critico';
          } else if (minutosParaInicio <= 35) {
            // Falta entre 16 y 35 min
            nivelRiesgo = 'proximo';
          } else {
            nivelRiesgo = 'programado_tarde';
          }
        } else {
          // Fecha futura o pasada
          nivelRiesgo = 'programado_tarde';
        }

        list.push({
          id: `${ses.id}-${idx}`,
          sesionId: ses.id,
          actorNombre,
          personaje: ps.rol || 'Paciente Clínico',
          email: ps.email,
          telefono: telefonoRaw,
          telefonoWsp,
          curso: ses.cursoNombreSimclic || ses.titulo,
          escenario: ses.escenarioNombre || ses.escenarioCodigo || 'Caso General',
          docenteNombre: ses.docenteNombreSimclic || 'Sin docente titular',
          docentePresente: Boolean(ses.docentePresente),
          salaNombre: ses.ambienteNombreSimclic || 'Sala sin asignar',
          salaCodigo: ses.ambienteCodigoSimclic,
          sedeNombre: ses.sedeNombreSimclic || nombreSede,
          horaInicio: ses.horaInicio,
          horaFin: ses.horaFin,
          startMins: ses.startMins,
          endMins: ses.endMins,
          duracionMinutos: ses.duracionMinutos,
          presente,
          horaIngresoReal,
          minutosParaInicio,
          nivelRiesgo,
          sesionRef: ses,
        });
      }
    }

    // Ordenar con prioridad operativa:
    // 1. Críticos (<15 min / en curso sin marcar)
    // 2. Próximos (16-35 min)
    // 3. En sala (presentes)
    // 4. Programados más tarde
    // 5. Finalizados
    // 6. Ausentes
    const ordenPeso: Record<NivelRiesgoLlegada, number> = {
      critico: 1,
      proximo: 2,
      en_sala: 3,
      programado_tarde: 4,
      finalizado: 5,
      ausente: 6,
    };

    list.sort((a, b) => {
      const pesoA = ordenPeso[a.nivelRiesgo];
      const pesoB = ordenPeso[b.nivelRiesgo];
      if (pesoA !== pesoB) return pesoA - pesoB;
      return a.startMins - b.startMins;
    });

    return list;
  }, [sesiones, nowMinutes, esHoy, usuariosList, nombreSede]);

  // Métricas consolidadas del Radar
  const metricasRadar = useMemo(() => {
    const total = actoresList.length;
    const criticos = actoresList.filter((a) => a.nivelRiesgo === 'critico').length;
    const proximos = actoresList.filter((a) => a.nivelRiesgo === 'proximo').length;
    const enSala = actoresList.filter((a) => a.nivelRiesgo === 'en_sala').length;
    const masTarde = actoresList.filter((a) => a.nivelRiesgo === 'programado_tarde').length;
    const finalizados = actoresList.filter((a) => a.nivelRiesgo === 'finalizado').length;
    const ausentes = actoresList.filter((a) => a.nivelRiesgo === 'ausente').length;

    return { total, criticos, proximos, enSala, masTarde, finalizados, ausentes };
  }, [actoresList]);

  // Filtrado según chips y búsqueda
  const actoresFiltrados = useMemo(() => {
    let result = actoresList;

    if (filtroRiesgo !== 'todos') {
      result = result.filter((a) => a.nivelRiesgo === filtroRiesgo);
    }

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.actorNombre.toLowerCase().includes(q) ||
          a.personaje.toLowerCase().includes(q) ||
          a.salaNombre.toLowerCase().includes(q) ||
          (a.salaCodigo && a.salaCodigo.toLowerCase().includes(q)) ||
          a.curso.toLowerCase().includes(q) ||
          a.docenteNombre.toLowerCase().includes(q)
      );
    }

    return result;
  }, [actoresList, filtroRiesgo, busqueda]);

  // Generador de Mensaje de WhatsApp Individual
  const handleEnviarWspIndividual = (actor: ItemRadarActor) => {
    const mensaje = `Hola *${actor.actorNombre}*, te saludamos de la Coordinación de Simulación Clínica UCS (${actor.sedeNombre}). Te recordamos tu citación de hoy a las *${actor.horaInicio}* en la sala *${actor.salaNombre}* para el caso *${actor.personaje}* (${actor.curso}). ¿Estás en camino? Por favor confirma tu llegada. ¡Gracias!`;
    const url = actor.telefonoWsp
      ? `https://api.whatsapp.com/send?phone=${actor.telefonoWsp}&text=${encodeURIComponent(mensaje)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  // Exportar Reporte Consolidado para WhatsApp
  const handleCopiarReporteWsp = () => {
    const fechaFormat = fecha.split('-').reverse().join('/');
    const lineas: string[] = [
      `🎭 *UCS SIMULACIÓN - REPORTE DE LLEGADA DE ACTORES (PS)*`,
      `📅 Fecha: ${fechaFormat} | 🏛️ Sede: ${nombreSede}`,
      `📊 Resumen: ${metricasRadar.total} citaciones | 🟢 ${metricasRadar.enSala} en sala | 🚨 ${metricasRadar.criticos} en riesgo crítico | 🟡 ${metricasRadar.proximos} próximos`,
      `------------------------------------------`,
    ];

    if (metricasRadar.criticos > 0) {
      lineas.push(`🚨 *RIESGO CRÍTICO / FALTAN MARCAR (<15 min o en curso):*`);
      actoresList
        .filter((a) => a.nivelRiesgo === 'critico')
        .forEach((a) => {
          const tiempoStr =
            a.minutosParaInicio < 0
              ? `Inició hace ${Math.abs(a.minutosParaInicio)}m`
              : `Faltan ${a.minutosParaInicio}m`;
          lineas.push(`• *${a.actorNombre}* (${a.horaInicio}) | 🚪 ${a.salaNombre} | 🎭 ${a.personaje} | ⚠️ *${tiempoStr}*`);
        });
      lineas.push(``);
    }

    if (metricasRadar.proximos > 0) {
      lineas.push(`🟡 *EN CAMINO / TOLERANCIA (16 a 35 min):*`);
      actoresList
        .filter((a) => a.nivelRiesgo === 'proximo')
        .forEach((a) => {
          lineas.push(`• *${a.actorNombre}* (${a.horaInicio}) | 🚪 ${a.salaNombre} | ⏳ Faltan ${a.minutosParaInicio}m`);
        });
      lineas.push(``);
    }

    if (metricasRadar.enSala > 0) {
      lineas.push(`🟢 *EN SALA / ASISTENCIA REGISTRADA:*`);
      actoresList
        .filter((a) => a.nivelRiesgo === 'en_sala')
        .forEach((a) => {
          lineas.push(`• *${a.actorNombre}* | 🚪 ${a.salaNombre} | Marcó: ${a.horaIngresoReal || 'Sí'}`);
        });
      lineas.push(``);
    }

    const textoCompleto = lineas.join('\n');
    navigator.clipboard.writeText(textoCompleto);
    showToast('📋 Reporte copiado al portapapeles listo para WhatsApp', 'success');
  };

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      {/* 1. HEADER HERO DEL RADAR */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(13, 52, 108, 0.25) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.6rem' }}>🎭</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Radar Preventivo de Llegada de Pacientes Simulados
            </h3>
            <span
              style={{
                background: metricasRadar.criticos > 0 ? '#ef4444' : '#10b981',
                color: '#ffffff',
                padding: '0.2rem 0.65rem',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.4px',
                animation: metricasRadar.criticos > 0 ? 'pulse 1.8s infinite' : 'none',
              }}
            >
              {metricasRadar.criticos > 0
                ? `🚨 ${metricasRadar.criticos} EN RIESGO CRÍTICO`
                : '🟢 COBERTURA EN REGLA'}
            </span>
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Auditoría en tiempo real para la Coordinación de PS: detecta ausencias 15 minutos antes de la simulación, coordina suplencias y contacta por WhatsApp en 1 clic.
          </div>
        </div>

        {/* BOTONES DE ACCIÓN RÁPIDA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {onIrAGantt && (
            <button
              type="button"
              onClick={onIrAGantt}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>📊</span> Volver al Gantt
            </button>
          )}

          <button
            type="button"
            onClick={handleCopiarReporteWsp}
            style={{
              padding: '0.45rem 0.95rem',
              borderRadius: '8px',
              border: '1px solid rgba(37, 211, 102, 0.4)',
              background: 'rgba(37, 211, 102, 0.15)',
              color: '#25d366',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s',
            }}
            title="Copiar reporte completo estructurado con formato para WhatsApp"
          >
            <span>📋</span> Copiar para WhatsApp
          </button>

          {onOpenCrearAsistenciaManual && (
            <button
              type="button"
              onClick={onOpenCrearAsistenciaManual}
              style={{
                padding: '0.45rem 0.95rem',
                borderRadius: '8px',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              title="Registrar manualmente un reemplazo o suplencia de último minuto"
            >
              <span>🔄</span> Registrar Suplente
            </button>
          )}
        </div>
      </div>

      {/* 2. TARJETAS KPI DE SEMÁFORO DE RIESGO */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.85rem',
          marginBottom: '1.25rem',
        }}
      >
        {/* KPI 1: TOTAL CITADOS */}
        <div
          onClick={() => setFiltroRiesgo('todos')}
          style={{
            background: filtroRiesgo === 'todos' ? 'rgba(168, 85, 247, 0.12)' : 'var(--bg-elevated)',
            border: filtroRiesgo === 'todos' ? '2px solid #a855f7' : '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '0.9rem 1.1rem',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase' }}>
            👥 Total Citaciones Hoy
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {metricasRadar.total}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Actores en agenda de SimClic
          </div>
        </div>

        {/* KPI 2: RIESGO CRÍTICO (<15 MIN O EN CURSO) */}
        <div
          onClick={() => setFiltroRiesgo('critico')}
          style={{
            background:
              filtroRiesgo === 'critico'
                ? 'rgba(239, 68, 68, 0.2)'
                : metricasRadar.criticos > 0
                ? 'rgba(239, 68, 68, 0.08)'
                : 'var(--bg-elevated)',
            border:
              metricasRadar.criticos > 0
                ? '2px solid #ef4444'
                : filtroRiesgo === 'critico'
                ? '2px solid #ef4444'
                : '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '0.9rem 1.1rem',
            cursor: 'pointer',
            transition: 'all 0.15s',
            boxShadow: metricasRadar.criticos > 0 ? '0 0 12px rgba(239, 68, 68, 0.25)' : 'none',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>
            🚨 Riesgo Crítico (&lt;15m)
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ef4444', marginTop: '0.2rem' }}>
            {metricasRadar.criticos}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#ef4444' }}>
            {metricasRadar.criticos > 0 ? '⚠️ No han marcado en Kiosco' : 'Sin alertas de ausencia'}
          </div>
        </div>

        {/* KPI 3: PRÓXIMOS EN CAMINO (16 A 35 MIN) */}
        <div
          onClick={() => setFiltroRiesgo('proximo')}
          style={{
            background: filtroRiesgo === 'proximo' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-elevated)',
            border: filtroRiesgo === 'proximo' ? '2px solid #f59e0b' : '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '0.9rem 1.1rem',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' }}>
            🟡 En Camino (16-35m)
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f59e0b', marginTop: '0.2rem' }}>
            {metricasRadar.proximos}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Ventana normal de llegada
          </div>
        </div>

        {/* KPI 4: EN SALA (MARCARON) */}
        <div
          onClick={() => setFiltroRiesgo('en_sala')}
          style={{
            background: filtroRiesgo === 'en_sala' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-elevated)',
            border: filtroRiesgo === 'en_sala' ? '2px solid #10b981' : '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '0.9rem 1.1rem',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
            🟢 En Sala (Presentes)
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981', marginTop: '0.2rem' }}>
            {metricasRadar.enSala}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Marcaron en Kiosco
          </div>
        </div>

        {/* KPI 5: TURNO TARDE (>35 MIN) */}
        <div
          onClick={() => setFiltroRiesgo('programado_tarde')}
          style={{
            background: filtroRiesgo === 'programado_tarde' ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-elevated)',
            border: filtroRiesgo === 'programado_tarde' ? '2px solid #38bdf8' : '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '0.9rem 1.1rem',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
            ⚪ Turnos Más Tarde
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {metricasRadar.masTarde}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Inician en &gt;35 minutos
          </div>
        </div>
      </div>

      {/* 3. BARRA DE HERRAMIENTAS: BÚSQUEDA Y FILTROS */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '0.85rem 1.15rem',
          marginBottom: '1rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
      >
        {/* BUSCADOR */}
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
          <span
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
            }}
          >
            🔍
          </span>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por actor, personaje, sala o curso..."
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem 0.45rem 2.2rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              outline: 'none',
            }}
          />
        </div>

        {/* CHIPS DE ESTADO */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '0.2rem' }}>
            Filtrar:
          </span>
          {[
            { id: 'todos', label: `Todos (${metricasRadar.total})` },
            { id: 'critico', label: `🚨 Críticos (${metricasRadar.criticos})`, color: '#ef4444' },
            { id: 'proximo', label: `🟡 En camino (${metricasRadar.proximos})`, color: '#f59e0b' },
            { id: 'en_sala', label: `🟢 En sala (${metricasRadar.enSala})`, color: '#10b981' },
            { id: 'programado_tarde', label: `⚪ Más tarde (${metricasRadar.masTarde})` },
            { id: 'finalizado', label: `🏁 Finalizados (${metricasRadar.finalizados})` },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFiltroRiesgo(chip.id)}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '6px',
                border: 'none',
                background:
                  filtroRiesgo === chip.id
                    ? chip.color || 'var(--ucs-blue, #0d346c)'
                    : 'rgba(255, 255, 255, 0.05)',
                color: filtroRiesgo === chip.id ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: filtroRiesgo === chip.id ? 700 : 500,
                fontSize: '0.75rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. LISTADO DE CITACIONES CON SEMÁFORO Y ACCIÓN EN 1 CLIC */}
      {actoresFiltrados.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 1.5rem',
            background: 'var(--bg-elevated)',
            border: '1px dashed var(--border-color)',
            borderRadius: '16px',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎭</div>
          <h4 style={{ margin: '0 0 0.35rem 0', color: 'var(--text-primary)', fontSize: '1.05rem' }}>
            No se encontraron actores con los filtros seleccionados
          </h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            Prueba seleccionando otro chip de riesgo o limpiando la búsqueda.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {actoresFiltrados.map((actor) => {
            // Estilos dinámicos según el nivel de riesgo
            let borderLeftColor = '#94a3b8';
            let bgBadge = 'rgba(148, 163, 184, 0.12)';
            let colorBadge = '#94a3b8';
            let badgeText = '⚪ PROGRAMADO';
            let alertBox = null;

            if (actor.nivelRiesgo === 'critico') {
              borderLeftColor = '#ef4444';
              bgBadge = '#ef4444';
              colorBadge = '#ffffff';
              if (actor.minutosParaInicio < 0) {
                badgeText = `🚨 SESIÓN INICIÓ HACE ${Math.abs(actor.minutosParaInicio)} MIN SIN ACTOR`;
              } else {
                badgeText = `🚨 RIESGO CRÍTICO: INICIA EN ${actor.minutosParaInicio} MIN`;
              }
              alertBox = (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#ef4444',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <span>⚠️</span>
                  <span>
                    El paciente simulado aún no ha registrado ingreso en el Kiosco. El docente ya está
                    esperando en sala o la simulación está por comenzar.
                  </span>
                </div>
              );
            } else if (actor.nivelRiesgo === 'proximo') {
              borderLeftColor = '#f59e0b';
              bgBadge = 'rgba(245, 158, 11, 0.2)';
              colorBadge = '#f59e0b';
              badgeText = `🟡 EN CAMINO: INICIA EN ${actor.minutosParaInicio} MIN`;
            } else if (actor.nivelRiesgo === 'en_sala') {
              borderLeftColor = '#10b981';
              bgBadge = 'rgba(16, 185, 129, 0.2)';
              colorBadge = '#34d399';
              badgeText = `🟢 EN SALA (MARCÓ A LAS ${actor.horaIngresoReal || '--:--'})`;
            } else if (actor.nivelRiesgo === 'finalizado') {
              borderLeftColor = '#8b5cf6';
              bgBadge = 'rgba(139, 92, 246, 0.2)';
              colorBadge = '#c084fc';
              badgeText = '🏁 TURNO FINALIZADO';
            } else if (actor.nivelRiesgo === 'ausente') {
              borderLeftColor = '#6b7280';
              bgBadge = 'rgba(107, 114, 128, 0.2)';
              colorBadge = '#9ca3af';
              badgeText = '❌ NO MARCÓ ASISTENCIA';
            }

            return (
              <div
                key={actor.id}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderLeft: `5px solid ${borderLeftColor}`,
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  boxShadow:
                    actor.nivelRiesgo === 'critico'
                      ? '0 4px 15px rgba(239, 68, 68, 0.15)'
                      : '0 2px 8px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* FILA SUPERIOR: BADGE DE RIESGO + HORARIO + SALA */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        background: bgBadge,
                        color: colorBadge,
                        padding: '0.2rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        letterSpacing: '0.3px',
                      }}
                    >
                      {badgeText}
                    </span>

                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)',
                        background: 'rgba(255, 255, 255, 0.06)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                      }}
                    >
                      ⏰ {actor.horaInicio} - {actor.horaFin} ({actor.duracionMinutos} min)
                    </span>

                    <span
                      style={{
                        background: 'rgba(56, 189, 248, 0.12)',
                        color: '#38bdf8',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                      }}
                    >
                      🚪 {actor.salaCodigo ? `[${actor.salaCodigo}] ` : ''}
                      {actor.salaNombre}
                    </span>
                  </div>

                  {/* ESTADO DEL DOCENTE */}
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    👨‍⚕️ Docente:{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{actor.docenteNombre}</strong>
                    {actor.docentePresente ? (
                      <span
                        style={{
                          marginLeft: '0.4rem',
                          color: '#10b981',
                          fontWeight: 700,
                          background: 'rgba(16, 185, 129, 0.15)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                        }}
                      >
                        ✓ En sala
                      </span>
                    ) : (
                      <span
                        style={{
                          marginLeft: '0.4rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        (Pendiente)
                      </span>
                    )}
                  </div>
                </div>

                {/* FILA MEDIA: DATOS DEL ACTOR Y DEL CASO CLÍNICO */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    marginTop: '0.2rem',
                  }}
                >
                  <div>
                    {/* NOMBRE DEL ACTOR */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {actor.actorNombre}
                      </span>
                      {actor.telefono && (
                        <span
                          style={{
                            fontSize: '0.74rem',
                            color: 'var(--text-muted)',
                            background: 'rgba(255, 255, 255, 0.05)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          📞 {actor.telefono}
                        </span>
                      )}
                    </div>

                    {/* PERSONAJE Y CURSO */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '0.45rem',
                        marginTop: '0.25rem',
                        fontSize: '0.8rem',
                      }}
                    >
                      <span
                        style={{
                          background: 'rgba(168, 85, 247, 0.15)',
                          color: '#c084fc',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '5px',
                          fontWeight: 700,
                        }}
                      >
                        🎭 {actor.personaje}
                      </span>

                      <span style={{ color: 'var(--text-secondary)' }}>•</span>

                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        📚 {actor.curso}
                      </span>

                      <span style={{ color: 'var(--text-secondary)' }}>•</span>

                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        🔬 {actor.escenario}
                      </span>
                    </div>
                  </div>

                  {/* BOTONES DE ACCIÓN RÁPIDA POR ACTOR */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {/* BOTÓN WHATSAPP */}
                    <button
                      type="button"
                      onClick={() => handleEnviarWspIndividual(actor)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(37, 211, 102, 0.4)',
                        background: 'rgba(37, 211, 102, 0.12)',
                        color: '#25d366',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        transition: 'all 0.15s',
                      }}
                      title="Abrir chat de WhatsApp con recordatorio pre-redactado"
                    >
                      <span>📲</span>
                      <span>WhatsApp</span>
                    </button>

                    {/* BOTÓN SUPLENTE (SI ESTÁ EN RIESGO O AUSENTE) */}
                    {(actor.nivelRiesgo === 'critico' || actor.nivelRiesgo === 'ausente') &&
                      onOpenCrearAsistenciaManual && (
                        <button
                          type="button"
                          onClick={onOpenCrearAsistenciaManual}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                          title="Cubrir turno con un actor suplente"
                        >
                          <span>🔄</span>
                          <span>Suplente</span>
                        </button>
                      )}

                    {/* BOTÓN DETALLE SESIÓN */}
                    {onVerDetalleSesion && (
                      <button
                        type="button"
                        onClick={() => onVerDetalleSesion(actor.sesionRef)}
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                          fontSize: '0.76rem',
                          cursor: 'pointer',
                        }}
                        title="Ver detalles de la sesión académica en SimClic"
                      >
                        👁️
                      </button>
                    )}
                  </div>
                </div>

                {/* BANNER DE ALERTA CONTEXTUAL SI ESTÁ EN RIESGO */}
                {alertBox}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
