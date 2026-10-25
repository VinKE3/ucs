import { pgTable, serial, text, varchar, timestamp, boolean, integer, jsonb, pgEnum, numeric } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- ENUMS ---
export const tipoPersonalEnum = pgEnum('tipo_personal', [
  'docente',
  'tecnico',
  'paciente_simulado',
  'administrativo',
]);

export const rolSistemaEnum = pgEnum('rol_sistema', [
  'super_admin',
  'admin',
  'administrativo',
  'ninguno',
]);

export const estadoAsistenciaEnum = pgEnum('estado_asistencia', [
  'en_curso',
  'finalizado',
  'anulado',
  'ajustado_manual',
]);

export const tipoRegistroEnum = pgEnum('tipo_registro', [
  'kiosco_autoservicio',
  'admin_manual',
]);

// --- 1. TABLA: SEDES ---
export const sedes = pgTable('sedes', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 150 }).notNull(), // Ej: "Campus Villa", "Campus Norte", "Campus Ate"
  codigo: varchar('codigo', { length: 20 }),            // Ej: "VILLA", "NORTE"
  direccion: text('direccion'),
  activo: boolean('activo').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- 2. TABLA: AMBIENTES (Salas de Simulación) ---
export const ambientes = pgTable('ambientes', {
  id: serial('id').primaryKey(),
  sedeId: integer('sede_id')
    .notNull()
    .references(() => sedes.id, { onDelete: 'cascade' }),
  nombre: varchar('nombre', { length: 150 }).notNull(), // Ej: "Quirófano A", "UCI Adultos", "Sala Gesell 1"
  codigo: varchar('codigo', { length: 50 }),            // Ej: "QUI-A", "SIM-101"
  tipo: varchar('tipo', { length: 80 }).default('general').notNull(), // "quirofano", "uci", "debriefing", "consultorio", "hospitalizacion"
  capacidad: integer('capacidad').default(10),
  activo: boolean('activo').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- 3. TABLA: USUARIOS (Personal de la Clínica & Accesos) ---
export const usuarios = pgTable('usuarios', {
  id: serial('id').primaryKey(),
  dni: varchar('dni', { length: 20 }).notNull().unique(), // Documento de identidad para marcación rápida
  nombres: varchar('nombres', { length: 120 }).notNull(),
  apellidos: varchar('apellidos', { length: 120 }).notNull(),
  correo: varchar('correo', { length: 255 }).unique(),
  telefono: varchar('telefono', { length: 30 }),
  
  // Función operativa en la clínica
  tipoPersonal: tipoPersonalEnum('tipo_personal').notNull(), // "docente", "tecnico", "paciente_simulado"
  
  // Nivel de acceso al sistema web
  rolSistema: rolSistemaEnum('rol_sistema').default('ninguno').notNull(), // "super_admin", "admin", "ninguno"
  passwordHash: text('password_hash'), // Solo para quienes tienen rol 'super_admin' o 'admin'

  // Tope de horas semanales (para docentes, coberturas)
  horasSemanalesMax: integer('horas_semanales_max'),

  // Tarifa por hora en Soles (especialmente para pacientes simulados / honorarios)
  tarifaHora: numeric('tarifa_hora', { precision: 8, scale: 2 }),

  // Control de Horario y Desempeño (Especialmente para Técnicos de Simulación)
  horaEntradaEsperada: varchar('hora_entrada_esperada', { length: 5 }), // Ej: "06:00"
  horaSalidaEsperada: varchar('hora_salida_esperada', { length: 5 }),   // Ej: "15:00"
  toleranciaMinutos: integer('tolerancia_minutos').default(10),         // Margen de gracia en minutos (default 10)
  
  activo: boolean('activo').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- 4. TABLA: ASISTENCIAS ---
export const asistencias = pgTable('asistencias', {
  id: serial('id').primaryKey(),
  usuarioId: integer('usuario_id')
    .notNull()
    .references(() => usuarios.id, { onDelete: 'restrict' }),
  
  sedeId: integer('sede_id')
    .notNull()
    .references(() => sedes.id, { onDelete: 'restrict' }),
  
  // ambienteId es NULL para Técnicos (dan soporte general a la clínica).
  // Es OBLIGATORIO para Docentes y Pacientes Simulados.
  ambienteId: integer('ambiente_id')
    .references(() => ambientes.id, { onDelete: 'set null' }),
  
  // cursoId opcional (para Docentes y Pacientes Simulados)
  cursoId: integer('curso_id')
    .references(() => cursos.id, { onDelete: 'set null' }),

  fecha: varchar('fecha', { length: 10 }).notNull(), // Formato "YYYY-MM-DD" para agrupación fácil
  horaIngreso: timestamp('hora_ingreso', { withTimezone: true }).defaultNow().notNull(),
  horaSalida: timestamp('hora_salida', { withTimezone: true }), // NULL mientras la sesión esté activa/en curso
  
  minutosTotales: integer('minutos_totales'), // Calculado al marcar salida o ajuste manual

  // Auditoría histórica de puntualidad y cumplimiento del turno programado
  horaEntradaProgramada: varchar('hora_entrada_programada', { length: 5 }), // Snapshot turno entrada
  horaSalidaProgramada: varchar('hora_salida_programada', { length: 5 }),   // Snapshot turno salida
  minutosTardanza: integer('minutos_tardanza'),                             // Minutos de retraso (> 0)
  minutosAnticipo: integer('minutos_anticipo'),                             // Minutos de anticipación (> 0)
  minutosExtra: integer('minutos_extra'),                                   // Minutos de sobretiempo (> 0)
  
  estado: estadoAsistenciaEnum('estado_asistencia').default('en_curso').notNull(),
  tipoRegistro: tipoRegistroEnum('tipo_registro').default('kiosco_autoservicio').notNull(),
  
  observaciones: text('observaciones'), // Ej: "Escenario OSCE Pediatría", "Guardia de tarde"
  
  // Auditoría en caso de modificación o anulación
  modificadoPorId: integer('modificado_por_id').references(() => usuarios.id),
  motivoModificacion: text('motivo_modificacion'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- 5. TABLA: AUDITORÍA DE CAMBIOS (Inmutabilidad y Trazabilidad) ---
export const auditoriaAsistencias = pgTable('auditoria_asistencias', {
  id: serial('id').primaryKey(),
  asistenciaId: integer('asistencia_id')
    .notNull()
    .references(() => asistencias.id, { onDelete: 'cascade' }),
  usuarioAdminId: integer('usuario_admin_id')
    .notNull()
    .references(() => usuarios.id),
  
  accion: varchar('accion', { length: 50 }).notNull(), // "CREACION_MANUAL", "EDICION_HORARIO", "ANULACION", "CIERRE_FORZADO"
  motivo: text('motivo').notNull(),                     // Explicación obligatoria requerida al Admin
  datosAnteriores: jsonb('datos_anteriores'),           // Snapshot de los valores antes del cambio
  datosNuevos: jsonb('datos_nuevos'),                   // Snapshot de los valores después del cambio
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- 5.5. TABLA: CARRERAS (Catálogo Oficial de Facultades / Especialidades) ---
export const carreras = pgTable('carreras', {
  id: serial('id').primaryKey(),
  codigo: varchar('codigo', { length: 50 }).notNull().unique(), // "Mhum", "ENF", "OBS", "PSI", etc.
  nombre: varchar('nombre', { length: 150 }).notNull(),        // "Medicina Humana", "Enfermería", etc.
  color: varchar('color', { length: 30 }).default('#38bdf8').notNull(), // Color corporativo oficial SimClic (#ffa200, #30c4c4, etc.)
  simclicId: varchar('simclic_id', { length: 100 }),          // ID original en SimClic
  activo: boolean('activo').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- 6. TABLA: CURSOS ---
export const cursos = pgTable('cursos', {
  id: serial('id').primaryKey(),
  carreraId: integer('carrera_id').references(() => carreras.id, { onDelete: 'set null' }),
  nombre: varchar('nombre', { length: 200 }).notNull(), // Ej: "Simulación Quirúrgica", "Simulación Pediátrica"
  codigo: varchar('codigo', { length: 50 }),            // Código numérico o alfanumérico SimClic (ej: "815363")
  prefijo: varchar('prefijo', { length: 50 }),          // Prefijo en corchetes ej: "SIMPED", "SimQx", "SCI", "MED_SBS"
  descripcion: text('descripcion'),
  simclicId: varchar('simclic_id', { length: 100 }),    // ID de MongoDB en SimClic
  tarifaHoraPs: numeric('tarifa_hora_ps', { precision: 8, scale: 2 }), // Tarifa por hora en S/. para paciente simulado en este curso
  activo: boolean('activo').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- RELACIONES (Drizzle ORM) ---
export const carrerasRelations = relations(carreras, ({ many }) => ({
  cursos: many(cursos),
  sesionesProgramadas: many(sesionesProgramadas),
}));

export const sedesRelations = relations(sedes, ({ many }) => ({
  ambientes: many(ambientes),
  asistencias: many(asistencias),
}));

export const ambientesRelations = relations(ambientes, ({ one, many }) => ({
  sede: one(sedes, {
    fields: [ambientes.sedeId],
    references: [sedes.id],
  }),
  asistencias: many(asistencias),
}));

export const cursosRelations = relations(cursos, ({ one, many }) => ({
  carrera: one(carreras, {
    fields: [cursos.carreraId],
    references: [carreras.id],
  }),
  asistencias: many(asistencias),
  sesionesProgramadas: many(sesionesProgramadas),
}));

export const usuariosRelations = relations(usuarios, ({ many }) => ({
  asistencias: many(asistencias),
  auditoriasRealizadas: many(auditoriaAsistencias),
}));

export const asistenciasRelations = relations(asistencias, ({ one, many }) => ({
  usuario: one(usuarios, {
    fields: [asistencias.usuarioId],
    references: [usuarios.id],
  }),
  sede: one(sedes, {
    fields: [asistencias.sedeId],
    references: [sedes.id],
  }),
  ambiente: one(ambientes, {
    fields: [asistencias.ambienteId],
    references: [ambientes.id],
  }),
  curso: one(cursos, {
    fields: [asistencias.cursoId],
    references: [cursos.id],
  }),
  modificadoPor: one(usuarios, {
    fields: [asistencias.modificadoPorId],
    references: [usuarios.id],
  }),
  auditorias: many(auditoriaAsistencias),
}));

export const auditoriaAsistenciasRelations = relations(auditoriaAsistencias, ({ one }) => ({
  asistencia: one(asistencias, {
    fields: [auditoriaAsistencias.asistenciaId],
    references: [asistencias.id],
  }),
  usuarioAdmin: one(usuarios, {
    fields: [auditoriaAsistencias.usuarioAdminId],
    references: [usuarios.id],
  }),
}));

// --- 7. TABLA: CATEGORÍAS DE AMBIENTE (Simulación) ---
export const categoriasAmbiente = pgTable('categorias_ambiente', {
  id: serial('id').primaryKey(),
  codigo: varchar('codigo', { length: 50 }).notNull().unique(), // ej: "alta_fidelidad", "habilidades", "consultorio", "hospitalizacion", "debriefing", "quirofano", "general"
  nombre: varchar('nombre', { length: 100 }).notNull(),         // ej: "Alta Fidelidad", "Habilidades y Destrezas"
  descripcion: text('descripcion'),
  color: varchar('color', { length: 30 }).default('#38bdf8').notNull(), // Color hexadecimal para badges y filtros
  icono: varchar('icono', { length: 20 }).default('🏥'),
  orden: integer('orden').default(0).notNull(),
  activo: boolean('activo').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- 8. TABLAS DEL MÓDULO DE CASTING (Pacientes Simulados) ---
export const castingRangosEdad = pgTable('casting_rangos_edad', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 100 }).notNull(),
  descripcion: text('descripcion'),
  edadMin: integer('edad_min'),
  edadMax: integer('edad_max'),
  color: varchar('color', { length: 30 }).default('#38bdf8').notNull(),
  orden: integer('orden').default(0).notNull(),
  activo: boolean('activo').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const castingEspecialidades = pgTable('casting_especialidades', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 120 }).notNull(),
  descripcion: text('descripcion'),
  icono: varchar('icono', { length: 20 }).default('🧠'),
  color: varchar('color', { length: 30 }).default('#c084fc').notNull(),
  orden: integer('orden').default(0).notNull(),
  activo: boolean('activo').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const castingRestricciones = pgTable('casting_restricciones', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 120 }).notNull(),
  descripcion: text('descripcion'),
  nivel: varchar('nivel', { length: 30 }).default('moderada').notNull(), // 'leve', 'moderada', 'critica'
  icono: varchar('icono', { length: 20 }).default('⚠️'),
  color: varchar('color', { length: 30 }).default('#ef4444').notNull(),
  orden: integer('orden').default(0).notNull(),
  activo: boolean('activo').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const castingPerfiles = pgTable('casting_perfiles', {
  id: serial('id').primaryKey(),
  usuarioId: integer('usuario_id')
    .notNull()
    .unique()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  rangoEdadId: integer('rango_edad_id')
    .references(() => castingRangosEdad.id, { onDelete: 'set null' }),
  edadReal: integer('edad_real'),
  genero: varchar('genero', { length: 50 }),
  biotipo: varchar('biotipo', { length: 50 }),
  especialidadesIds: jsonb('especialidades_ids').$type<number[]>().default([]).notNull(),
  restriccionesIds: jsonb('restricciones_ids').$type<number[]>().default([]).notNull(),
  experienciaNotas: text('experiencia_notas'),
  disponibilidad: text('disponibilidad'),
  contactoEmergencia: varchar('contacto_emergencia', { length: 150 }),
  activoCasting: boolean('activo_casting').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relaciones para Casting
export const castingPerfilesRelations = relations(castingPerfiles, ({ one }) => ({
  usuario: one(usuarios, {
    fields: [castingPerfiles.usuarioId],
    references: [usuarios.id],
  }),
  rangoEdad: one(castingRangosEdad, {
    fields: [castingPerfiles.rangoEdadId],
    references: [castingRangosEdad.id],
  }),
}));

// --- TIPOS INFERIDOS (TypeScript) ---
export type Sede = typeof sedes.$inferSelect;
export type NewSede = typeof sedes.$inferInsert;

export type Ambiente = typeof ambientes.$inferSelect;
export type NewAmbiente = typeof ambientes.$inferInsert;

export type Usuario = typeof usuarios.$inferSelect;
export type NewUsuario = typeof usuarios.$inferInsert;

export type Curso = typeof cursos.$inferSelect;
export type NewCurso = typeof cursos.$inferInsert;

export type Asistencia = typeof asistencias.$inferSelect;
export type NewAsistencia = typeof asistencias.$inferInsert;

export type AuditoriaAsistencia = typeof auditoriaAsistencias.$inferSelect;
export type NewAuditoriaAsistencia = typeof auditoriaAsistencias.$inferInsert;

export type CategoriaAmbiente = typeof categoriasAmbiente.$inferSelect;
export type NewCategoriaAmbiente = typeof categoriasAmbiente.$inferInsert;

export type CastingRangoEdad = typeof castingRangosEdad.$inferSelect;
export type NewCastingRangoEdad = typeof castingRangosEdad.$inferInsert;

export type CastingEspecialidad = typeof castingEspecialidades.$inferSelect;
export type NewCastingEspecialidad = typeof castingEspecialidades.$inferInsert;

export type CastingRestriccion = typeof castingRestricciones.$inferSelect;
export type NewCastingRestriccion = typeof castingRestricciones.$inferInsert;

export type CastingPerfil = typeof castingPerfiles.$inferSelect;
export type NewCastingPerfil = typeof castingPerfiles.$inferInsert;

// --- 8. TABLA: TERMINALES KIOSCO (Control de Dispositivos Autorizados) ---
export const terminalesKiosco = pgTable('terminales_kiosco', {
  id: serial('id').primaryKey(),
  token: varchar('token', { length: 120 }).notNull().unique(), // Token criptográfico único
  nombre: varchar('nombre', { length: 150 }).notNull(),        // Ej: "Tablet Recepción Villa"
  sedeId: integer('sede_id').references(() => sedes.id, { onDelete: 'set null' }),
  dispositivoInfo: text('dispositivo_info'),                   // Navegador / SO (Edge, Chrome, etc.)
  ipRegistro: varchar('ip_registro', { length: 50 }),
  activo: boolean('activo').default(true).notNull(),
  ultimoUso: timestamp('ultimo_uso'),
  creadoPor: integer('creado_por').references(() => usuarios.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const terminalesKioscoRelations = relations(terminalesKiosco, ({ one }) => ({
  sede: one(sedes, {
    fields: [terminalesKiosco.sedeId],
    references: [sedes.id],
  }),
  creador: one(usuarios, {
    fields: [terminalesKiosco.creadoPor],
    references: [usuarios.id],
  }),
}));

export type TerminalKiosco = typeof terminalesKiosco.$inferSelect;
export type NewTerminalKiosco = typeof terminalesKiosco.$inferInsert;

// --- 9. TABLA: SESIONES PROGRAMADAS (Sincronización SimClic) ---
export const sesionesProgramadas = pgTable('sesiones_programadas', {
  id: serial('id').primaryKey(),
  simclicId: varchar('simclic_id', { length: 50 }).notNull().unique(), // ID numérico de SimClic (ej: "59160")
  simclicMongoId: varchar('simclic_mongo_id', { length: 50 }),          // _id de Meteor MongoDB
  titulo: text('titulo').notNull(),                                      // Nombre actividad / escenario
  fecha: varchar('fecha', { length: 10 }).notNull(),                     // Formato "YYYY-MM-DD"
  horaInicio: varchar('hora_inicio', { length: 8 }).notNull(),           // "17:00"
  horaFin: varchar('hora_fin', { length: 8 }).notNull(),                 // "19:45"
  
  // Sede
  sedeId: integer('sede_id').references(() => sedes.id, { onDelete: 'set null' }),
  sedeNombreSimclic: varchar('sede_nombre_simclic', { length: 150 }),

  // Ambiente (Detección de traslados/cambios de sala)
  ambienteId: integer('ambiente_id').references(() => ambientes.id, { onDelete: 'set null' }),
  ambienteNombreSimclic: varchar('ambiente_nombre_simclic', { length: 150 }),
  ambienteCodigoSimclic: varchar('ambiente_codigo_simclic', { length: 50 }),
  ambienteOriginalNombre: varchar('ambiente_original_nombre', { length: 150 }), // Para trazabilidad si se movió de sala

  // Curso
  cursoId: integer('curso_id').references(() => cursos.id, { onDelete: 'set null' }),
  cursoNombreSimclic: varchar('curso_nombre_simclic', { length: 200 }),
  cursoCodigoSimclic: varchar('curso_codigo_simclic', { length: 50 }),

  // Docente
  docenteId: integer('docente_id').references(() => usuarios.id, { onDelete: 'set null' }),
  docenteNombreSimclic: varchar('docente_nombre_simclic', { length: 250 }),
  docenteCorreoSimclic: varchar('docente_correo_simclic', { length: 255 }),

  // Carrera
  carreraId: integer('carrera_id').references(() => carreras.id, { onDelete: 'set null' }),
  carrera: varchar('carrera', { length: 150 }),
  carreraCodigo: varchar('carrera_codigo', { length: 50 }),
  carreraColor: varchar('carrera_color', { length: 30 }),

  // Escenario y Prefijo
  escenarioCodigo: varchar('escenario_codigo', { length: 100 }), // "G-SPed-022"
  escenarioNombre: varchar('escenario_nombre', { length: 255 }), // "NEUMONIA"
  prefijo: varchar('prefijo', { length: 50 }),                   // "SIMPED"

  // Paciente Simulado programado en SimClic
  pacienteSimuladoNombre: varchar('paciente_simulado_nombre', { length: 250 }),
  pacienteSimuladoCorreo: varchar('paciente_simulado_correo', { length: 255 }),

  // Múltiples Docentes e Instructores (Docente principal, co-docentes, evaluadores)
  docentesJson: jsonb('docentes_json').$type<Array<{
    id?: number | null;
    simclicUserId?: string | null;
    nombre: string;
    email?: string | null;
    rol?: string;
  }>>().default([]),

  // Múltiples Pacientes Simulados / Actores
  pacientesSimuladosJson: jsonb('pacientes_simulados_json').$type<Array<{
    id?: number | null;
    simclicId?: string | null;
    nombre: string;
    email?: string | null;
    rol?: string | null;
  }>>().default([]),

  estadoSimclic: varchar('estado_simclic', { length: 50 }), // "Booked", "Cancelled", etc.
  estadoUcs: varchar('estado_ucs', { length: 50 }).default('programada').notNull(), // "programada", "en_curso", "finalizada", "reubicada", "cancelada"

  // Vínculo con asistencia activa
  asistenciaId: integer('asistencia_id').references(() => asistencias.id, { onDelete: 'set null' }),

  ultimaSincronizacion: timestamp('ultima_sincronizacion').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sesionesProgramadasRelations = relations(sesionesProgramadas, ({ one }) => ({
  sede: one(sedes, {
    fields: [sesionesProgramadas.sedeId],
    references: [sedes.id],
  }),
  ambiente: one(ambientes, {
    fields: [sesionesProgramadas.ambienteId],
    references: [ambientes.id],
  }),
  curso: one(cursos, {
    fields: [sesionesProgramadas.cursoId],
    references: [cursos.id],
  }),
  carrera: one(carreras, {
    fields: [sesionesProgramadas.carreraId],
    references: [carreras.id],
  }),
  docente: one(usuarios, {
    fields: [sesionesProgramadas.docenteId],
    references: [usuarios.id],
  }),
  asistencia: one(asistencias, {
    fields: [sesionesProgramadas.asistenciaId],
    references: [asistencias.id],
  }),
}));

export type Carrera = typeof carreras.$inferSelect;
export type NewCarrera = typeof carreras.$inferInsert;
export type SesionProgramada = typeof sesionesProgramadas.$inferSelect;
export type NewSesionProgramada = typeof sesionesProgramadas.$inferInsert;

// --- 8. TABLA: TURNOS PROGRAMADOS DE TÉCNICOS (Malla mensual, descansos y horarios personalizados) ---
export const turnosProgramadosTecnicos = pgTable('turnos_programados_tecnicos', {
  id: serial('id').primaryKey(),
  usuarioId: integer('usuario_id')
    .notNull()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  fecha: varchar('fecha', { length: 10 }).notNull(), // "YYYY-MM-DD"
  tipoDia: varchar('tipo_dia', { length: 30 }).default('laborable').notNull(), // 'laborable', 'descanso', 'descanso_compensatorio', 'guardia_evento'
  horaEntradaEsperada: varchar('hora_entrada_esperada', { length: 5 }), // ej: "09:00", "10:00", "13:00"
  horaSalidaEsperada: varchar('hora_salida_esperada', { length: 5 }),   // ej: "18:00", "19:00", "22:00"
  esPersonalizado: boolean('es_personalizado').default(false).notNull(), // true si se digitó horario específico
  nota: text('nota'), // Ej: "Guardia domingo - Cobertura ECOE"
  programadoPorId: integer('programado_por_id').references(() => usuarios.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- 9. TABLA: BANCO DE DÍAS COMPENSATORIOS DE TÉCNICOS ---
export const bancoCompensatoriosTecnicos = pgTable('banco_compensatorios_tecnicos', {
  id: serial('id').primaryKey(),
  usuarioId: integer('usuario_id')
    .notNull()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  tipo: varchar('tipo', { length: 30 }).notNull(), // 'acumulado', 'canjeado', 'ajuste_manual'
  dias: numeric('dias', { precision: 4, scale: 1 }).notNull(), // ej: +1.0 o -1.0
  fechaReferencia: varchar('fecha_referencia', { length: 10 }), // Fecha del día trabajado o descanso tomado
  motivo: text('motivo').notNull(), // Explicación de la acumulación o canje
  autorizadoPorId: integer('autorizado_por_id').references(() => usuarios.id, { onDelete: 'set null' }),
  saldoResultante: numeric('saldo_resultante', { precision: 4, scale: 1 }).default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type TurnoProgramadoTecnico = typeof turnosProgramadosTecnicos.$inferSelect;
export type NewTurnoProgramadoTecnico = typeof turnosProgramadosTecnicos.$inferInsert;
export type BancoCompensatorioTecnico = typeof bancoCompensatoriosTecnicos.$inferSelect;
export type NewBancoCompensatorioTecnico = typeof bancoCompensatoriosTecnicos.$inferInsert;

// --- 10. TABLA: CONFIGURACIÓN GEMINI IA ---
export const configuracionGemini = pgTable('configuracion_gemini', {
  id: serial('id').primaryKey(),
  habilitado: boolean('habilitado').default(true).notNull(), // Switch maestro para apagar/encender chatbot
  modelo: varchar('modelo', { length: 80 }).default('gemini-3.8-flash').notNull(),
  totalInputTokens: integer('total_input_tokens').default(0).notNull(),
  totalOutputTokens: integer('total_output_tokens').default(0).notNull(),
  totalTokens: integer('total_tokens').default(0).notNull(),
  totalRequests: integer('total_requests').default(0).notNull(),
  costoTotalEstimadoUsd: numeric('costo_total_estimado_usd', { precision: 12, scale: 6 }).default('0.000000').notNull(),
  temperatura: numeric('temperatura', { precision: 3, scale: 2 }).default('0.2').notNull(),
  instruccionesSistema: text('instrucciones_sistema'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedByUsuarioId: integer('updated_by_usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
});

// --- 11. TABLA: LOGS DE AUDITORÍA Y PETICIONES GEMINI IA ---
export const logsGeminiRequests = pgTable('logs_gemini_requests', {
  id: serial('id').primaryKey(),
  usuarioId: integer('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
  usuarioDni: varchar('usuario_dni', { length: 20 }),
  usuarioNombre: varchar('usuario_nombre', { length: 150 }),
  prompt: text('prompt').notNull(),
  respuesta: text('respuesta'),
  modelo: varchar('modelo', { length: 80 }).notNull(),
  inputTokens: integer('input_tokens').default(0).notNull(),
  outputTokens: integer('output_tokens').default(0).notNull(),
  totalTokens: integer('total_tokens').default(0).notNull(),
  costoEstimadoUsd: numeric('costo_estimado_usd', { precision: 10, scale: 6 }).default('0.000000').notNull(),
  duracionMs: integer('duracion_ms').default(0).notNull(),
  herramientasEjecutadas: jsonb('herramientas_ejecutadas').default('[]').notNull(),
  exitoso: boolean('exitoso').default(true).notNull(),
  errorMensaje: text('error_mensaje'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type ConfiguracionGemini = typeof configuracionGemini.$inferSelect;
export type NewConfiguracionGemini = typeof configuracionGemini.$inferInsert;
export type LogGeminiRequest = typeof logsGeminiRequests.$inferSelect;
export type NewLogGeminiRequest = typeof logsGeminiRequests.$inferInsert;

// --- 12. TABLA: INCIDENCIAS DE SALA (Botón de Ayuda / SOS Salas) ---
export const incidenciasSala = pgTable('incidencias_sala', {
  id: serial('id').primaryKey(),
  sedeId: integer('sede_id')
    .notNull()
    .references(() => sedes.id, { onDelete: 'cascade' }),
  ambienteId: integer('ambiente_id')
    .notNull()
    .references(() => ambientes.id, { onDelete: 'cascade' }),

  // Categoría de falla rápida y descripción
  categoria: varchar('categoria', { length: 50 }).notNull(), // 'proyeccion', 'audio', 'red', 'computadora', 'simulador', 'otro'
  descripcion: text('descripcion'), // Opcional, texto libre si el docente escribió algo

  // Contexto automático del momento
  docenteNombre: varchar('docente_nombre', { length: 255 }),
  cursoNombre: varchar('curso_nombre', { length: 255 }),

  // Flujo de estados: 'pendiente' -> 'en_camino' -> 'resuelto' | 'cancelado'
  estado: varchar('estado', { length: 20 }).default('pendiente').notNull(),

  // Preparado para el futuro: asignación individual si la jefatura lo requiere
  tecnicoId: integer('tecnico_id').references(() => usuarios.id, { onDelete: 'set null' }),
  tecnicoNombre: varchar('tecnico_nombre', { length: 150 }),

  // Terminal/dispositivo físico de donde provino la solicitud
  terminalId: integer('terminal_id'),
  terminalNombre: varchar('terminal_nombre', { length: 120 }),

  // Causa real encontrada para estadísticas y reportes
  motivoResolucion: varchar('motivo_resolucion', { length: 100 }), // 'cable_hdmi', 'duplicar_pantalla', 'reinicio_pc', 'equipo_danado', 'falsa_alarma', 'otro'
  notaResolucion: text('nota_resolucion'),

  // Marcas de tiempo para SLA y auditoría
  createdAt: timestamp('created_at').defaultNow().notNull(),
  atendidoAt: timestamp('atendido_at'), // Momento en que el técnico pulsó "En camino"
  resueltoAt: timestamp('resuelto_at'), // Momento en que se marcó "Resuelto"
});

export type IncidenciaSala = typeof incidenciasSala.$inferSelect;
export type NewIncidenciaSala = typeof incidenciasSala.$inferInsert;

// --- 13. TABLA: TERMINALES DE SALA (Multi-PC/Laptop por Ambiente) ---
export const terminalesSala = pgTable('terminales_sala', {
  id: serial('id').primaryKey(),
  sedeId: integer('sede_id')
    .notNull()
    .references(() => sedes.id, { onDelete: 'cascade' }),
  ambienteId: integer('ambiente_id')
    .notNull()
    .references(() => ambientes.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 100 }).notNull().unique(), // UUID secreto guardado en localStorage/cookie
  nombre: varchar('nombre', { length: 120 }).notNull(), // Ej: "PC Principal Docente", "Laptop Simulador 1", "PC 2 Debriefing"
  tipoDispositivo: varchar('tipo_dispositivo', { length: 50 }).default('pc').notNull(), // 'pc', 'laptop', 'tablet'
  activo: boolean('activo').default(true).notNull(), // Habilitar o deshabilitar remotamente desde el Admin
  ultimoAcceso: timestamp('ultimo_acceso').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type TerminalSala = typeof terminalesSala.$inferSelect;
export type NewTerminalSala = typeof terminalesSala.$inferInsert;

// --- 14. TABLA: CATEGORÍAS DE INCIDENCIA / BOTONES DE ASISTENCIA DINÁMICOS ---
export const categoriasIncidencia = pgTable('categorias_incidencia', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 150 }).notNull(), // Ej: "Simulador Bloqueado", "Pilas / Intercomunicador"
  icono: varchar('icono', { length: 50 }).default('🚨').notNull(), // Emoji o icono visual
  color: varchar('color', { length: 50 }).default('#ef4444').notNull(), // HEX o clase visual
  tipo: varchar('tipo', { length: 50 }).default('tecnico').notNull(), // 'tecnico', 'logistico', 'urgencia'
  prioridad: varchar('prioridad', { length: 50 }).default('normal').notNull(), // 'alta', 'normal', 'baja'
  orden: integer('orden').default(1).notNull(),
  activo: boolean('activo').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type CategoriaIncidencia = typeof categoriasIncidencia.$inferSelect;
export type NewCategoriaIncidencia = typeof categoriasIncidencia.$inferInsert;

// --- 15. TABLA: CONFIGURACIÓN GLOBAL DEL SISTEMA (PIN Maestro, etc.) ---
export const configuracionSistema = pgTable('configuracion_sistema', {
  clave: varchar('clave', { length: 100 }).primaryKey(), // Ej: 'pin_maestro_salas', 'modo_tecnicos'
  valor: text('valor').notNull(),
  descripcion: text('descripcion'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ConfiguracionSistema = typeof configuracionSistema.$inferSelect;
export type NewConfiguracionSistema = typeof configuracionSistema.$inferInsert;







