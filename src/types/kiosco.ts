export interface TerminalData {
  id: number;
  nombre: string;
  sedeId: number | null;
  sedeNombre: string | null;
  sedeCodigo: string | null;
  camaraActiva?: boolean;
}

export interface AmbienteItem {
  id: number;
  nombre: string;
  codigo: string | null;
  tipo: string;
  capacidad: number | null;
  ocupada?: boolean;
  docenteActivo?: string | null;
  horaIngresoDocente?: string | null;
  cursoActivo?: string | null;
  cursoActivoId?: number | null;
  docentesActivos?: Array<{ usuarioId: number; nombres: string; apellidos: string; horaIngreso: string }>;
  pacientesActivos?: Array<{ usuarioId: number; nombres: string; apellidos: string; horaIngreso: string }>;
  totalOcupantes?: number;
}

export interface SedeItem {
  id: number;
  nombre: string;
  codigo: string | null;
  ambientes: AmbienteItem[];
}

export interface UsuarioData {
  id: number;
  dni: string;
  nombres: string;
  apellidos: string;
  tipoPersonal: 'docente' | 'tecnico' | 'paciente_simulado' | 'administrativo';
  horaEntradaEsperada?: string | null;
  horaSalidaEsperada?: string | null;
  esHorarioRotativo?: boolean;
  horasJornadaObjetivo?: number | string | null;
  turnoHoy?: {
    id: number;
    fecha: string;
    tipoDia: string;
    horaEntradaEsperada: string;
    horaSalidaEsperada: string;
    esPersonalizado: boolean;
    nota?: string | null;
  } | null;
  saldoDiasCompensatorios?: number | null;
  turnoCompletadoHoy?: {
    id: number;
    horaIngreso: string;
    horaSalida: string;
    minutosTotales: number;
    sedeId: number;
    sedeNombre: string | null;
    observaciones?: string | null;
  } | null;
}

export interface AsistenciaActiva {
  id: number;
  sedeId: number;
  ambienteId: number | null;
  cursoId?: number | null;
  cursoNombre?: string | null;
  horaIngreso: string;
  sedeNombre: string | null;
  ambienteNombre: string | null;
  ambienteCodigo: string | null;
}

export interface CursoItem {
  id: number;
  nombre: string;
  codigo: string | null;
}

export interface SesionSugeridaItem {
  id: number;
  simclicId: string;
  titulo: string;
  cursoId: number | null;
  cursoNombre: string | null;
  ambienteId: number | null;
  ambienteNombre: string | null;
  ambienteCodigo: string | null;
  horaInicio: string;
  horaFin: string;
  rol: 'docente_titular' | 'co_docente' | 'paciente_simulado';
  esProxima: boolean;
  minutosParaInicio: number;
  sedeId: number | null;
  sedeNombre: string | null;
  totalBloquesHoy?: number;
  numeroBloque?: number;
  proximoBloque?: {
    cursoNombre: string;
    ambienteNombre: string | null;
    horaInicio: string;
    horaFin: string;
  } | null;
}

export const DEFAULT_KIOSCO_ROOM_CATEGORIES: Array<{ id: string; label: string; icono?: string | null }> = [
  { id: 'todos', label: 'Todas' },
  { id: 'alta_fidelidad', label: 'Alta Fidelidad', icono: '🫀' },
  { id: 'habilidades', label: 'Habilidades', icono: '🧤' },
  { id: 'consultorio', label: 'Consultorios / OSCE', icono: '🩺' },
  { id: 'hospitalizacion', label: 'Hospitalización', icono: '🛏️' },
  { id: 'debriefing', label: 'Debriefing', icono: '💡' },
];
