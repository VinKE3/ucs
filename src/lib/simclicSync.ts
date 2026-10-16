import crypto from 'crypto';
import { db } from '@/db';
import {
  sesionesProgramadas,
  sedes,
  ambientes,
  carreras,
  cursos,
  usuarios,
} from '@/db/schema';
import { eq, ilike } from 'drizzle-orm';

export interface SyncResult {
  success: boolean;
  total: number;
  creadas: number;
  actualizadas: number;
  reubicadas: number;
  fecha: string;
  duracionMs: number;
  error?: string;
  detallesReubicadas?: Array<{
    simclicId: string;
    titulo: string;
    salaAnterior: string;
    salaNueva: string;
  }>;
}

/**
 * Motor central de sincronización SimClic para UCS Registro.
 * Conecta de forma headless vía SockJS DDP WebSocket, autentica con credenciales
 * institucionales y sincroniza la programación del día detectando traslados de ambiente.
 */
export async function syncSimclicSessions(targetDate: Date = new Date()): Promise<SyncResult> {
  const startTime = Date.now();
  const user = process.env.SIMCLIC_USER;
  const password = process.env.SIMCLIC_PASSWORD;

  if (!user || !password) {
    return {
      success: false,
      total: 0,
      creadas: 0,
      actualizadas: 0,
      reubicadas: 0,
      fecha: targetDate.toISOString().slice(0, 10),
      duracionMs: 0,
      error: 'Credenciales SIMCLIC_USER o SIMCLIC_PASSWORD no configuradas en .env.local',
    };
  }

  // 1. Cargar catálogos locales de UCS para mapeo ultra-rápido en memoria
  const [allSedes, allAmbientes, allCarreras, allCursos, allUsuarios] = await Promise.all([
    db.select().from(sedes),
    db.select().from(ambientes),
    db.select().from(carreras),
    db.select().from(cursos),
    db.select().from(usuarios),
  ]);

  // Helpers de mapeo inteligente
  function resolveSede(campusSimclic?: { code?: string; name?: string }) {
    if (!campusSimclic) return null;
    const code = (campusSimclic.code || '').toLowerCase();
    const name = (campusSimclic.name || '').toLowerCase();

    return allSedes.find((s) => {
      const sCode = (s.codigo || '').toLowerCase();
      const sNom = s.nombre.toLowerCase();
      return (
        (code && sCode.includes(code)) ||
        (code && sNom.includes(code)) ||
        (name && sNom.includes(name))
      );
    }) || null;
  }

  function resolveAmbiente(roomSimclic?: { code?: string; name?: string }, sedeId?: number | null) {
    if (!roomSimclic?.name && !roomSimclic?.code) return null;
    const roomName = (roomSimclic.name || '').trim();
    const roomCode = (roomSimclic.code || '').trim().toLowerCase();

    // Regla de oro 1: Coincidencia exacta por código de ambiente de SimClic (ej: SL02TA20)
    if (roomCode) {
      const foundByCode = allAmbientes.find((a) => {
        const matchesSede = !sedeId || a.sedeId === sedeId;
        const aCode = (a.codigo || '').trim().toLowerCase();
        return matchesSede && aCode && aCode === roomCode;
      });
      if (foundByCode) return foundByCode;
    }

    // Regla de oro 2: Extraer código de laboratorio e.g. "L 102", "L 110", "L 218", "L102", "L-102"
    const labCodeMatch = roomName.match(/\bL\s*[-]?\s*(\d{3})\b/i);
    if (labCodeMatch) {
      const numCode = labCodeMatch[1]; // ej: "102"
      const foundByLabNum = allAmbientes.find((a) => {
        const matchesSede = !sedeId || a.sedeId === sedeId;
        const matchesCode =
          (a.nombre || '').toLowerCase().includes(`l ${numCode}`) ||
          (a.nombre || '').toLowerCase().includes(`l${numCode}`) ||
          (a.codigo || '').toLowerCase().includes(`l ${numCode}`) ||
          (a.codigo || '').toLowerCase().includes(`l${numCode}`);
        return matchesSede && matchesCode;
      });
      if (foundByLabNum) return foundByLabNum;
    }

    // Regla de oro 3: Coincidencia por Consultorio / Sala con número normalizado (ej: "CONSULTORIO 04" vs "CONSULTORIO 4")
    const consultorioMatch = roomName.match(/consultorio\s*0?(\d+)/i);
    if (consultorioMatch) {
      const consNum = consultorioMatch[1]; // ej: "4"
      const foundCons = allAmbientes.find((a) => {
        const matchesSede = !sedeId || a.sedeId === sedeId;
        const aNom = a.nombre.toLowerCase();
        return matchesSede && new RegExp(`consultorio\\s*0?${consNum}\\b`, 'i').test(aNom);
      });
      if (foundCons) return foundCons;
    }

    // Regla de oro 4: Búsqueda difusa por nombre
    const cleanRoom = roomName.toLowerCase().trim();
    const foundByText = allAmbientes.find((a) => {
      const matchesSede = !sedeId || a.sedeId === sedeId;
      const aNom = a.nombre.toLowerCase();
      return matchesSede && (cleanRoom.includes(aNom) || aNom.includes(cleanRoom));
    });

    return foundByText || null;
  }

  function resolveCarrera(degSimclic?: { code?: string; name?: string }) {
    if (!degSimclic) return null;
    const code = (degSimclic.code || '').toLowerCase().trim();
    const name = (degSimclic.name || '').toLowerCase().trim();

    return allCarreras.find((c) => {
      const cCode = c.codigo.toLowerCase().trim();
      const cName = c.nombre.toLowerCase().trim();
      return (code && cCode === code) || (name && (cName.includes(name) || name.includes(cName)));
    }) || null;
  }

  function resolveCurso(courseSimclic?: { code?: string; name?: string }, prefijo?: string | null) {
    const code = (courseSimclic?.code || '').trim();
    const name = (courseSimclic?.name || '').toLowerCase().trim();

    return allCursos.find((c) => {
      if (prefijo && c.prefijo && c.prefijo.toLowerCase() === prefijo.toLowerCase()) return true;
      if (code && c.codigo && c.codigo.trim() === code) return true;
      if (name && (c.nombre.toLowerCase().includes(name) || name.includes(c.nombre.toLowerCase()))) return true;
      return false;
    }) || null;
  }

  function resolveDocente(leadInstructor?: { username?: string; firstName?: string; lastName?: string }) {
    if (!leadInstructor) return null;
    const email = (leadInstructor.username || '').toLowerCase().trim();
    const fullName = `${leadInstructor.firstName || ''} ${leadInstructor.lastName || ''}`.toLowerCase().trim();

    return allUsuarios.find((u) => {
      if (email && u.correo && u.correo.toLowerCase().trim() === email) return true;
      const uFullName = `${u.nombres} ${u.apellidos}`.toLowerCase().trim();
      if (fullName && (uFullName.includes(fullName) || fullName.includes(uFullName))) return true;
      return false;
    }) || null;
  }

  // 2. Conectar por WebSocket SockJS a SimClic
  const rawSessions: any[] = await new Promise((resolve, reject) => {
    const serverId = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const sessionId = Math.random().toString(36).substring(2, 10);
    const wsUrl = `wss://cientifica.simclic.com/sockjs/${serverId}/${sessionId}/websocket`;

    const collected: any[] = [];
    let isDone = false;

    // Timeout de seguridad de 12 segundos
    const timer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        try { ws.close(); } catch {}
        resolve(collected);
      }
    }, 12000);

    // @ts-ignore
    const ws = new (globalThis.WebSocket as any)(wsUrl, {
      headers: {
        'Origin': 'https://cientifica.simclic.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
      },
    });

    function sendDDP(msgObj: any) {
      ws.send(JSON.stringify([JSON.stringify(msgObj)]));
    }

    ws.onmessage = (event: any) => {
      const raw = event.data.toString();
      if (raw === 'o') {
        sendDDP({ msg: 'connect', version: '1', support: ['1'] });
      } else if (raw.startsWith('a')) {
        const messages = JSON.parse(raw.slice(1));
        for (const mStr of messages) {
          const data = JSON.parse(mStr);

          if (data.msg === 'connected') {
            const passHash = crypto.createHash('sha256').update(password).digest('hex');
            const userObj = user.includes('@') ? { email: user } : { username: user };

            sendDDP({
              msg: 'method',
              id: 'login-simclic',
              method: 'login',
              params: [
                {
                  user: userObj,
                  password: {
                    digest: passHash,
                    algorithm: 'sha-256',
                  },
                },
              ],
            });
          }

          if (data.msg === 'result' && data.id === 'login-simclic') {
            if (data.error) {
              clearTimeout(timer);
              isDone = true;
              ws.close();
              reject(new Error(`Error al iniciar sesión en SimClic: ${data.error.reason || data.error.message}`));
              return;
            }

            // Suscribirse a las sesiones de la fecha solicitada
            sendDDP({
              msg: 'sub',
              id: 'sub-sessions-sync',
              name: 'sessions.byDateAndUser',
              params: [
                {
                  currentDate: { $date: targetDate.getTime() },
                  currentView: 'TimelineDay',
                  firstDayOfWeek: 1,
                },
                'America/Lima',
              ],
            });
          }

          if (data.msg === 'added' && data.collection === 'sessions') {
            collected.push({ ...data.fields, _id: data.id });
          }

          if (data.msg === 'ready' && data.subs?.includes('sub-sessions-sync')) {
            clearTimeout(timer);
            if (!isDone) {
              isDone = true;
              setTimeout(() => {
                try { ws.close(); } catch {}
                resolve(collected);
              }, 400);
            }
          }
        }
      }
    };

    ws.onerror = (err: any) => {
      if (!isDone) {
        clearTimeout(timer);
        isDone = true;
        reject(err);
      }
    };
  });

  function parseMeteorDate(d: any, fallback: Date = new Date()): Date {
    if (!d) return fallback;
    if (d instanceof Date && !isNaN(d.getTime())) return d;
    if (typeof d === 'number') return new Date(d);
    if (typeof d === 'object' && d.$date) return new Date(d.$date);
    if (typeof d === 'string') {
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? fallback : parsed;
    }
    return fallback;
  }

  // 3. Reconciliación e inserción/actualización ultra-rápida en Neon PostgreSQL
  let creadas = 0;
  let actualizadas = 0;
  let reubicadas = 0;
  const detallesReubicadas: SyncResult['detallesReubicadas'] = [];

  // Pre-cargar todas las sesiones existentes en memoria para evitar cientos de roundtrips HTTP
  const existingRows = await db.select().from(sesionesProgramadas);
  const existingMap = new Map(existingRows.map((r) => [r.simclicId, r]));

  for (const s of rawSessions) {
    const simclicId = String(s.id || s._id);
    const simclicMongoId = String(s._id || '');
    const titulo = s.name || 'Sin título';

    // Formatear fechas de Meteor ($date: ms) en zona horaria local de Perú
    const startD = parseMeteorDate(s.startDate, targetDate);
    const endD = parseMeteorDate(s.endDate, targetDate);

    // Convertir a YYYY-MM-DD
    const fecha = startD.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const horaInicio = startD.toLocaleTimeString('en-GB', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
    });
    const horaFin = endD.toLocaleTimeString('en-GB', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Extracción de prefijo [SIMPED], escenario clínico y paciente simulado
    const prefijoMatch = (s.name || '').match(/^\[(.*?)\]/);
    const prefijo = prefijoMatch ? prefijoMatch[1].trim() : null;

    const sedeObj = resolveSede(s.campus);
    const ambienteObj = resolveAmbiente(s.mainRoom, sedeObj?.id);
    const cursoObj = resolveCurso(s.courses?.[0], prefijo);
    const docenteObj = resolveDocente(s.leadInstructor);
    const carreraObj = resolveCarrera(s.degrees?.[0]);

    const sedeNombreSimclic = s.campus?.name || '';
    const ambienteNombreSimclic = s.mainRoom?.name || 'Sin sala';
    const ambienteCodigoSimclic = s.mainRoom?.code || '';
    const cursoNombreSimclic = s.courses?.[0]?.name || cursoObj?.nombre || '';
    const cursoCodigoSimclic = s.courses?.[0]?.code || cursoObj?.codigo || '';
    const docenteNombreSimclic = [s.leadInstructor?.firstName, s.leadInstructor?.lastName]
      .filter(Boolean)
      .join(' ');
    const docenteCorreoSimclic = s.leadInstructor?.username || '';
    
    const carrera = carreraObj?.nombre || s.degrees?.[0]?.name || '';
    const carreraCodigo = carreraObj?.codigo || s.degrees?.[0]?.code || '';
    const carreraColor = carreraObj?.color || '#38bdf8';

    const escenarioCodigo = s.scenarios?.[0]?.code || '';
    const escenarioNombre = s.scenarios?.[0]?.name || '';

    const ps = s.standardizedPatients?.[0];
    const pacienteSimuladoNombre = ps ? [ps.firstName, ps.lastName].filter(Boolean).join(' ') : null;
    const pacienteSimuladoCorreo = ps?.username || null;

    const estadoSimclic = s.status || 'Booked';

    const existente = existingMap.get(simclicId);

    if (existente) {
      // Detección de traslados/cambios de sala hechos por los técnicos en SimClic
      const cambioSala =
        ambienteNombreSimclic &&
        existente.ambienteNombreSimclic &&
        ambienteNombreSimclic !== existente.ambienteNombreSimclic;

      if (cambioSala) {
        reubicadas++;
        detallesReubicadas.push({
          simclicId,
          titulo,
          salaAnterior: existente.ambienteNombreSimclic || 'Sin sala previa',
          salaNueva: ambienteNombreSimclic,
        });

        await db
          .update(sesionesProgramadas)
          .set({
            titulo,
            fecha,
            horaInicio,
            horaFin,
            sedeId: sedeObj?.id || existente.sedeId,
            sedeNombreSimclic,
            ambienteId: ambienteObj?.id || null,
            ambienteNombreSimclic,
            ambienteCodigoSimclic,
            ambienteOriginalNombre: existente.ambienteNombreSimclic, // Guardar sala previa
            cursoId: cursoObj?.id || existente.cursoId,
            cursoNombreSimclic,
            cursoCodigoSimclic,
            docenteId: docenteObj?.id || existente.docenteId,
            docenteNombreSimclic,
            docenteCorreoSimclic,
            carreraId: carreraObj?.id || existente.carreraId,
            carrera,
            carreraCodigo,
            carreraColor,
            escenarioCodigo,
            escenarioNombre,
            prefijo: prefijo || cursoObj?.prefijo || existente.prefijo,
            pacienteSimuladoNombre,
            pacienteSimuladoCorreo,
            estadoSimclic,
            estadoUcs: 'reubicada',
            ultimaSincronizacion: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(sesionesProgramadas.id, existente.id));
      } else {
        actualizadas++;
        await db
          .update(sesionesProgramadas)
          .set({
            titulo,
            fecha,
            horaInicio,
            horaFin,
            sedeId: sedeObj?.id || existente.sedeId,
            sedeNombreSimclic,
            ambienteId: ambienteObj?.id || existente.ambienteId,
            ambienteNombreSimclic,
            ambienteCodigoSimclic,
            cursoId: cursoObj?.id || existente.cursoId,
            cursoNombreSimclic,
            cursoCodigoSimclic,
            docenteId: docenteObj?.id || existente.docenteId,
            docenteNombreSimclic,
            docenteCorreoSimclic,
            carreraId: carreraObj?.id || existente.carreraId,
            carrera,
            carreraCodigo,
            carreraColor,
            escenarioCodigo,
            escenarioNombre,
            prefijo: prefijo || cursoObj?.prefijo || existente.prefijo,
            pacienteSimuladoNombre,
            pacienteSimuladoCorreo,
            estadoSimclic,
            ultimaSincronizacion: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(sesionesProgramadas.id, existente.id));
      }
    } else {
      creadas++;
      await db.insert(sesionesProgramadas).values({
        simclicId,
        simclicMongoId,
        titulo,
        fecha,
        horaInicio,
        horaFin,
        sedeId: sedeObj?.id || null,
        sedeNombreSimclic,
        ambienteId: ambienteObj?.id || null,
        ambienteNombreSimclic,
        ambienteCodigoSimclic,
        cursoId: cursoObj?.id || null,
        cursoNombreSimclic,
        cursoCodigoSimclic,
        docenteId: docenteObj?.id || null,
        docenteNombreSimclic,
        docenteCorreoSimclic,
        carreraId: carreraObj?.id || null,
        carrera,
        carreraCodigo,
        carreraColor,
        escenarioCodigo,
        escenarioNombre,
        prefijo: prefijo || cursoObj?.prefijo || null,
        pacienteSimuladoNombre,
        pacienteSimuladoCorreo,
        estadoSimclic,
        estadoUcs: 'programada',
        ultimaSincronizacion: new Date(),
      });
    }
  }

  const duracionMs = Date.now() - startTime;

  return {
    success: true,
    total: rawSessions.length,
    creadas,
    actualizadas,
    reubicadas,
    fecha: targetDate.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }),
    duracionMs,
    detallesReubicadas,
  };
}
