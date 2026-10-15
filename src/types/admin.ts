export type TipoPersonal = 'docente' | 'tecnico' | 'paciente_simulado' | 'administrativo';
export type RolSistema = 'super_admin' | 'admin' | 'administrativo' | 'ninguno';

export interface UsuarioItem {
  id: number;
  dni: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  tipoPersonal: TipoPersonal;
  rolSistema: RolSistema;
  activo: boolean;
  tienePassword: boolean;
  horasSemanalesMax?: number | null;
  tarifaHora?: number | string | null;
  horaEntradaEsperada?: string | null;
  horaSalidaEsperada?: string | null;
  toleranciaMinutos?: number | null;
  turnoActivoId?: number | null;
  horaIngreso?: string | null;
  sedeActualId?: number | null;
  sedeActualNombre?: string | null;
  ambienteActualId?: number | null;
  ambienteActualNombre?: string | null;
  ambienteActualCodigo?: string | null;
  castingPerfil?: CastingPerfilItem | null;
}

export interface ResumenColaboradorItem {
  usuarioId: number;
  dni: string;
  nombres: string;
  apellidos: string;
  tipoPersonal: TipoPersonal;
  horasSemanalesMax?: number | null;
  tarifaHora?: number | null;
  montoLiquidacionEstimado?: number | null;
  diasTrabajados: number;
  minutosTotales: number;
  horasTotalesFormato: string;
  totalSesiones: number;
  sesionesEnCurso: number;
  turnosSinCerrar: number;
  cursosParticipados: string[];
  enTurnoAhora: boolean;
  sedeActualNombre?: string | null;
  ambienteActualNombre?: string | null;
  minutosTardanzaTotales?: number;
  minutosAnticipoTotales?: number;
  minutosExtraTotales?: number;
  turnosPuntuales?: number;
  turnosConTardanza?: number;
  horaEntradaEsperada?: string | null;
  horaSalidaEsperada?: string | null;
}

export interface TicketSalidaData {
  colaborador: string;
  tipoPersonal: TipoPersonal;
  ambienteNombre: string;
  sedeNombre: string;
  cursoNombre: string | null;
  horaIngreso: string;
  horaSalida: string;
  minutosSesion: number;
  tiempoSesionTexto: string;
  minutosSemanaTotal: number;
  horasSemanaTexto: string;
  horasSemanaMax?: number | null;
  minutosMesTotal: number;
  horasMesTexto: string;
  tarifaHora?: number | null;
  montoSesionEstimado?: number | null;
  montoMesEstimado?: number | null;
}

export interface SedeAdminItem {
  id: number;
  nombre: string;
  codigo: string | null;
  direccion: string | null;
  activo: boolean;
  totalAmbientes: number;
}

export interface OcupanteItem {
  asistenciaId: number;
  usuarioId: number;
  nombres: string;
  apellidos: string;
  tipoPersonal: TipoPersonal;
  dni: string;
  horaIngreso: string;
}

export interface TecnicoTurnoItem {
  asistenciaId: number;
  usuarioId: number;
  nombres: string;
  apellidos: string;
  dni: string;
  horaIngreso: string;
}

export interface AmbienteAdminItem {
  id: number;
  sedeId: number;
  nombre: string;
  codigo: string | null;
  tipo: string;
  capacidad: number | null;
  activo: boolean;
  sedeNombre?: string;
  ocupada?: boolean;
  cursoActivo?: string | null;
  docentes?: OcupanteItem[];
  pacientesSimulados?: OcupanteItem[];
  otrosOcupantes?: OcupanteItem[];
}

export interface AsistenciaAdminItem {
  id: number;
  fecha: string;
  horaIngreso: string;
  horaSalida: string | null;
  minutosTotales: number | null;
  estado: 'en_curso' | 'finalizado' | 'anulado' | 'ajustado_manual';
  tipoRegistro: string;
  observaciones: string | null;
  motivoModificacion: string | null;
  createdAt: string;
  usuarioId: number;
  dni: string;
  nombres: string;
  apellidos: string;
  tipoPersonal: TipoPersonal;
  correo: string | null;
  sedeId: number;
  sedeNombre: string;
  sedeCodigo: string | null;
  ambienteId: number | null;
  ambienteNombre: string | null;
  ambienteCodigo: string | null;
  cursoId?: number | null;
  cursoNombre?: string | null;
  cursoCodigo?: string | null;
  tarifaHora?: number | string | null;
  horasSemanalesMax?: number | null;
  cursoTarifaHoraPs?: number | string | null;
  horaEntradaProgramada?: string | null;
  horaSalidaProgramada?: string | null;
  minutosTardanza?: number | null;
  minutosAnticipo?: number | null;
  minutosExtra?: number | null;
  sesionesProgramadasDia?: SesionProgramadaSimclicItem[];
}

export interface SesionProgramadaSimclicItem {
  id: number;
  simclicId: string;
  titulo: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  sedeId: number | null;
  sedeNombreSimclic: string | null;
  ambienteId: number | null;
  ambienteNombreSimclic: string | null;
  ambienteCodigoSimclic: string | null;
  cursoId: number | null;
  cursoNombreSimclic: string | null;
  cursoCodigoSimclic: string | null;
  docenteId: number | null;
  docenteNombreSimclic: string | null;
  docenteCorreoSimclic: string | null;
  pacienteSimuladoNombre: string | null;
  pacienteSimuladoCorreo: string | null;
  carrera: string | null;
  carreraCodigo: string | null;
  carreraColor: string | null;
  escenarioCodigo: string | null;
  escenarioNombre: string | null;
  prefijo: string | null;
  estadoUcs: string;
}

export interface CarreraAdminItem {
  id: number;
  codigo: string;
  nombre: string;
  color: string;
  simclicId?: string | null;
  totalCursos?: number;
  activo: boolean;
}

export interface CursoAdminItem {
  id: number;
  nombre: string;
  codigo: string | null;
  prefijo?: string | null;
  carreraId?: number | null;
  carreraCodigo?: string | null;
  carreraNombre?: string | null;
  carreraColor?: string | null;
  descripcion: string | null;
  tarifaHoraPs?: number | string | null;
  totalHorasPs?: number;
  totalMinutosPs?: number;
  totalSesionesPs?: number;
  totalActoresPs?: number;
  escenariosMuestra?: string[];
  activo: boolean;
  createdAt?: string;
}

export interface StatsData {
  sedes: number;
  ambientes: number;
  usuarios: number;
  enCurso: number;
  cursos?: number;
}

export interface CategoriaAmbienteItem {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  icono: string | null;
  orden: number;
  activo: boolean;
  totalAmbientes?: number;
  createdAt?: string;
}

export type AdminTab = 'sedes' | 'ambientes' | 'programacion' | 'cursos' | 'personal' | 'asistencias' | 'planilla';

export interface SesionProgramadaTimelineItem extends SesionProgramadaSimclicItem {
  startMins: number;
  endMins: number;
  duracionMinutos: number;
  estadoEnVivo: 'en_sala' | 'por_llegar' | 'sin_marcar' | 'finalizada' | 'programada';
  alertaTexto?: string;
  docentePresente?: boolean;
  psPresente?: boolean;
  asistenciaDocenteId?: number | null;
  asistenciaDocenteHora?: string | null;
  asistenciaDocenteAmbiente?: string | null;
}

export interface ProgramacionDocenteOption {
  id: number | null;
  nombre: string;
  correo: string | null;
}

export interface ProgramacionCursoOption {
  id: number | null;
  nombre: string;
  codigo: string | null;
  carrera: string | null;
}

export interface ProgramacionMetricas {
  totalSesiones: number;
  totalDocentes: number;
  totalPs: number;
  salasTotales: number;
  salasOcupadasAhora: number;
  salasLibresAhoraCount: number;
  salasLibresAhora: Array<{ id: number; nombre: string; codigo: string | null; tipo: string }>;
  ausentismosCount: number;
}

export interface AuditoriaItem {
  id: number;
  asistenciaId: number;
  usuarioAdminId: number;
  accion: string;
  motivo: string;
  datosAnteriores: any;
  datosNuevos: any;
  createdAt: string;
  adminNombres?: string | null;
  adminApellidos?: string | null;
  adminDni?: string | null;
  adminCorreo?: string | null;
}

export interface CastingRangoEdadItem {
  id: number;
  nombre: string;
  descripcion: string | null;
  edadMin: number | null;
  edadMax: number | null;
  color: string;
  orden: number;
  activo: boolean;
  createdAt?: string;
}

export interface CastingEspecialidadItem {
  id: number;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  color: string;
  orden: number;
  activo: boolean;
  createdAt?: string;
}

export interface CastingRestriccionItem {
  id: number;
  nombre: string;
  descripcion: string | null;
  nivel: 'leve' | 'moderada' | 'critica' | string;
  icono: string | null;
  color: string;
  orden: number;
  activo: boolean;
  createdAt?: string;
}

export interface CastingPerfilItem {
  id: number;
  usuarioId: number;
  rangoEdadId: number | null;
  rangoEdadNombre?: string | null;
  rangoEdadColor?: string | null;
  edadReal: number | null;
  genero: string | null;
  biotipo: string | null;
  especialidadesIds: number[];
  restriccionesIds: number[];
  experienciaNotas: string | null;
  disponibilidad: string | null;
  contactoEmergencia: string | null;
  activoCasting: boolean;
  createdAt?: string;
}

