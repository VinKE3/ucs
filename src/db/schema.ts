import { pgTable, serial, text, varchar, timestamp, boolean, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- ENUMS ---
export const tipoPersonalEnum = pgEnum('tipo_personal', [
  'docente',
  'tecnico',
  'paciente_simulado',
]);

export const rolSistemaEnum = pgEnum('rol_sistema', [
  'super_admin',
  'admin',
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
  
  fecha: varchar('fecha', { length: 10 }).notNull(), // Formato "YYYY-MM-DD" para agrupación fácil
  horaIngreso: timestamp('hora_ingreso', { withTimezone: true }).defaultNow().notNull(),
  horaSalida: timestamp('hora_salida', { withTimezone: true }), // NULL mientras la sesión esté activa/en curso
  
  minutosTotales: integer('minutos_totales'), // Calculado al marcar salida o ajuste manual
  
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

// --- RELACIONES (Drizzle ORM) ---
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

// --- TIPOS INFERIDOS (TypeScript) ---
export type Sede = typeof sedes.$inferSelect;
export type NewSede = typeof sedes.$inferInsert;

export type Ambiente = typeof ambientes.$inferSelect;
export type NewAmbiente = typeof ambientes.$inferInsert;

export type Usuario = typeof usuarios.$inferSelect;
export type NewUsuario = typeof usuarios.$inferInsert;

export type Asistencia = typeof asistencias.$inferSelect;
export type NewAsistencia = typeof asistencias.$inferInsert;

export type AuditoriaAsistencia = typeof auditoriaAsistencias.$inferSelect;
export type NewAuditoriaAsistencia = typeof auditoriaAsistencias.$inferInsert;
