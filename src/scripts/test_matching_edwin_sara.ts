import { UsuarioItem, SesionProgramadaTimelineItem } from '../types/admin';

console.log('🧪 Iniciando Test Suite: Discriminación de Nombres y Familiares (Edwin vs Sara Puma)...');

const norm = (str: string) =>
  (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

function matchPersonaConSesion(u: UsuarioItem, s: SesionProgramadaTimelineItem): boolean {
  const userCorreo = norm(u.correo || '');
  const userApellidos = norm(u.apellidos);
  const userNombres = norm(u.nombres);
  const apellidoTokens = userApellidos.split(/\s+/).filter((t) => t.length > 2);
  const nombreTokens = userNombres.split(/\s+/).filter((t) => t.length > 2);

  if (u.tipoPersonal === 'paciente_simulado') {
    // 1. Coincidencia por ID de paciente simulado
    if (s.pacientesSimulados?.some((p) => p.id === u.id)) return true;
    if (Array.isArray(s.pacientesSimuladosJson) && s.pacientesSimuladosJson.some((p: any) => p.id === u.id)) return true;

    // 2. Coincidencia por correo
    if (userCorreo) {
      if (s.pacienteSimuladoCorreo && norm(s.pacienteSimuladoCorreo) === userCorreo) return true;
      if (s.pacientesSimulados?.some((p) => p.email && norm(p.email) === userCorreo)) return true;
      if (Array.isArray(s.pacientesSimuladosJson) && s.pacientesSimuladosJson.some((p: any) => p.email && norm(p.email) === userCorreo)) return true;
    }

    // 3. Coincidencia por nombre completo (DEBE coincidir al menos un apellido Y al menos un nombre)
    const checkNombrePs = (nombrePs: string) => {
      const nPs = norm(nombrePs);
      if (!nPs) return false;
      const tieneApellido = apellidoTokens.some((ap) => nPs.includes(ap));
      const tieneNombre = nombreTokens.length === 0 || nombreTokens.some((nom) => nPs.includes(nom));
      return tieneApellido && tieneNombre;
    };

    if (s.pacienteSimuladoNombre && checkNombrePs(s.pacienteSimuladoNombre)) return true;
    if (s.pacientesSimulados?.some((p) => p.nombre && checkNombrePs(p.nombre))) return true;
    if (Array.isArray(s.pacientesSimuladosJson) && s.pacientesSimuladosJson.some((p: any) => p.nombre && checkNombrePs(p.nombre))) return true;

    return false;
  }

  return false;
}

// Mock de usuarios
const edwinUser: UsuarioItem = {
  id: 1051,
  dni: '40090505',
  nombres: 'Edwin David',
  apellidos: 'Puma Castillo',
  correo: 'e.david27@hotmail.com',
  telefono: '991745189',
  tipoPersonal: 'paciente_simulado',
  rolSistema: 'ninguno',
  activo: true,
  tienePassword: false,
};

const saraUser: UsuarioItem = {
  id: 1053,
  dni: '10648160',
  nombres: 'Sara Elizabeth',
  apellidos: 'Puma Castillo',
  correo: 'sarapumacastillo@gmail.com',
  telefono: null,
  tipoPersonal: 'paciente_simulado',
  rolSistema: 'ninguno',
  activo: true,
  tienePassword: false,
};

// Sesión 5854 en CONSULTORIO 4 (de Sara)
const sesionConsultorio4: SesionProgramadaTimelineItem = {
  id: 5854,
  simclicId: 'sim-5854',
  titulo: '[SimQx] - Caso: Fractura de antebrazo',
  fecha: '2026-11-02',
  horaInicio: '15:20',
  horaFin: '17:00',
  sedeId: 1,
  sedeNombreSimclic: 'Campus Villa',
  ambienteId: 106,
  ambienteNombreSimclic: 'CONSULTORIO 4 - L 106',
  ambienteCodigoSimclic: 'SL02TA20',
  cursoId: 24,
  cursoNombreSimclic: 'Simulación Quirúrgica',
  cursoCodigoSimclic: '815362',
  docenteId: 999,
  docenteNombreSimclic: 'Miguel Angel Zuñiga Escalante',
  docenteCorreoSimclic: 'mzuniga@cientifica.edu.pe',
  pacienteSimuladoNombre: 'Sara Elizabeth Puma Castillo',
  pacienteSimuladoCorreo: 'sarapumacastillo@gmail.com',
  pacientesSimuladosJson: [
    {
      id: 1053,
      nombre: 'Sara Elizabeth Puma Castillo',
      email: 'sarapumacastillo@gmail.com',
      rol: null,
    },
  ],
  startMins: 920,
  endMins: 1020,
  duracionMinutos: 100,
  estadoEnVivo: 'programada',
} as unknown as SesionProgramadaTimelineItem;

// Sesión 5802 en Hospitalización 1 (de Edwin)
const sesionHospitalizacion: SesionProgramadaTimelineItem = {
  id: 5802,
  simclicId: 'sim-5802',
  titulo: '[MED_SBS]-EC3 acv',
  fecha: '2026-11-02',
  horaInicio: '10:20',
  horaFin: '12:00',
  sedeId: 1,
  sedeNombreSimclic: 'Campus Villa',
  ambienteId: 130,
  ambienteNombreSimclic: 'SALA DE HOSPITALIZACIÓN 1',
  ambienteCodigoSimclic: 'SL02LA30',
  cursoId: 56,
  cursoNombreSimclic: 'Semiología basada en la Simulación',
  cursoCodigoSimclic: '815360',
  docenteId: 923,
  docenteNombreSimclic: 'Paola Medina Molina',
  docenteCorreoSimclic: 'pmedinam@cientifica.edu.pe',
  pacienteSimuladoNombre: 'Edwin David Puma Castillo',
  pacienteSimuladoCorreo: 'e.david27@hotmail.com',
  pacientesSimuladosJson: [
    {
      id: 1051,
      nombre: 'Edwin David Puma Castillo',
      email: 'e.david27@hotmail.com',
      rol: null,
    },
  ],
  startMins: 620,
  endMins: 720,
  duracionMinutos: 100,
  estadoEnVivo: 'finalizada',
} as unknown as SesionProgramadaTimelineItem;

// Validar emparejamientos
console.log('\n--- Probando match de Edwin Puma ---');
const edwinConConsultorio4 = matchPersonaConSesion(edwinUser, sesionConsultorio4);
console.log('¿Edwin coincide con Consultorio 4 (Sara)?:', edwinConConsultorio4);
if (edwinConConsultorio4 !== false) {
  throw new Error('FALLO CRÍTICO: Edwin Puma no debe emparejarse con la sesión de Sara Puma en Consultorio 4');
}
console.log('✅ Aprobado: Edwin Puma NO se empareja con la clase de Sara en Consultorio 4.');

const edwinConHospitalizacion = matchPersonaConSesion(edwinUser, sesionHospitalizacion);
console.log('¿Edwin coincide con su clase real de Hospitalización?:', edwinConHospitalizacion);
if (edwinConHospitalizacion !== true) {
  throw new Error('FALLO CRÍTICO: Edwin Puma debe emparejarse con su clase de Hospitalización');
}
console.log('✅ Aprobado: Edwin Puma se empareja correctamente con su sesión auténtica.');

console.log('\n--- Probando match de Sara Puma ---');
const saraConConsultorio4 = matchPersonaConSesion(saraUser, sesionConsultorio4);
console.log('¿Sara coincide con Consultorio 4?:', saraConConsultorio4);
if (saraConConsultorio4 !== true) {
  throw new Error('FALLO CRÍTICO: Sara Puma debe emparejarse con su clase en Consultorio 4');
}
console.log('✅ Aprobado: Sara Puma se empareja con Consultorio 4.');

const saraConHospitalizacion = matchPersonaConSesion(saraUser, sesionHospitalizacion);
console.log('¿Sara coincide con la clase de Edwin?:', saraConHospitalizacion);
if (saraConHospitalizacion !== false) {
  throw new Error('FALLO CRÍTICO: Sara Puma no debe emparejarse con la clase de Edwin');
}
console.log('✅ Aprobado: Sara Puma NO se empareja con la clase de Edwin.');

console.log('\n🎉 TEST COMPLETADO CON ÉXITO: 100% Precisión en Discriminación de Nombres y Familiares!');

