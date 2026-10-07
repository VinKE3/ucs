export interface UsuarioItem {
  id: number;
  dni: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  tipoPersonal: 'docente' | 'tecnico' | 'paciente_simulado';
  rolSistema: 'super_admin' | 'admin' | 'ninguno';
  activo: boolean;
  tienePassword: boolean;
  horasSemanalesMax?: number | null;
  tarifaHora?: number | string | null;
  turnoActivoId?: number | null;
  horaIngreso?: string | null;
  sedeActualId?: number | null;
  sedeActualNombre?: string | null;
  ambienteActualId?: number | null;
  ambienteActualNombre?: string | null;
  ambienteActualCodigo?: string | null;
}

export interface ResumenColaboradorItem {
  usuarioId: number;
  dni: string;
  nombres: string;
  apellidos: string;
  tipoPersonal: 'docente' | 'tecnico' | 'paciente_simulado';
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
}

export interface TicketSalidaData {
  colaborador: string;
  tipoPersonal: 'docente' | 'tecnico' | 'paciente_simulado';
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
  tipoPersonal: 'docente' | 'tecnico' | 'paciente_simulado';
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
  tipoPersonal: 'docente' | 'tecnico' | 'paciente_simulado';
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
}

export interface CursoAdminItem {
  id: number;
  nombre: string;
  codigo: string | null;
  descripcion: string | null;
  tarifaHoraPs?: number | string | null;
  totalHorasPs?: number;
  totalMinutosPs?: number;
  totalSesionesPs?: number;
  totalActoresPs?: number;
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

export type AdminTab = 'personal' | 'ambientes' | 'asistencias' | 'cursos';

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
