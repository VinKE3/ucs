import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

async function seed() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL no está configurada en .env.local');
    process.exit(1);
  }

  console.log('🌱 Iniciando carga de datos iniciales en Neon...');
  const sql = neon(dbUrl);
  const db = drizzle(sql, { schema });

  try {
    // 1. Crear Sedes de la Universidad Científica del Sur
    console.log('📍 Creando Sedes...');
    const sedesInsertadas = await db
      .insert(schema.sedes)
      .values([
        {
          nombre: 'Campus Villa (Chorrillos)',
          codigo: 'VILLA',
          direccion: 'Carretera Panamericana Sur Km 19, Villa El Salvador / Chorrillos',
          activo: true,
        },
        {
          nombre: 'Campus Norte (Los Olivos)',
          codigo: 'NORTE',
          direccion: 'Av. Alfredo Mendiola 6232, Los Olivos',
          activo: true,
        },
        {
          nombre: 'Campus Ate',
          codigo: 'ATE',
          direccion: 'Carretera Central Km 9.5, Ate',
          activo: true,
        },
      ])
      .returning();

    const sedeVilla = sedesInsertadas[0];
    const sedeNorte = sedesInsertadas[1];

    // 2. Crear Ambientes / Salas de Simulación
    console.log('🏥 Creando Ambientes de Simulación...');
    await db.insert(schema.ambientes).values([
      {
        sedeId: sedeVilla.id,
        nombre: 'SALA ALTA FIDELIDAD 4',
        codigo: 'L 103',
        tipo: 'alta_fidelidad',
        capacidad: 12,
        activo: true,
      },
      {
        sedeId: sedeVilla.id,
        nombre: 'SALA ALTA FIDELIDAD 5',
        codigo: 'L 113',
        tipo: 'alta_fidelidad',
        capacidad: 12,
        activo: true,
      },
      {
        sedeId: sedeVilla.id,
        nombre: 'Unidad de Cuidados Intensivos (UCI)',
        codigo: 'UCI-1',
        tipo: 'uci',
        capacidad: 10,
        activo: true,
      },
      {
        sedeId: sedeVilla.id,
        nombre: 'Consultorio Médico de Simulación 1',
        codigo: 'CONS-01',
        tipo: 'consultorio',
        capacidad: 6,
        activo: true,
      },
      {
        sedeId: sedeVilla.id,
        nombre: 'Sala de Debriefing 1',
        codigo: 'DEB-01',
        tipo: 'debriefing',
        capacidad: 15,
        activo: true,
      },
      {
        sedeId: sedeNorte.id,
        nombre: 'Sala de Hospitalización y Tareas Múltiples',
        codigo: 'HOSP-N1',
        tipo: 'hospitalizacion',
        capacidad: 14,
        activo: true,
      },
      {
        sedeId: sedeNorte.id,
        nombre: 'Sala de Habilidades 3',
        codigo: 'L 220',
        tipo: 'habilidades',
        capacidad: 10,
        activo: true,
      },
    ]);

    // 3. Crear Usuarios de Ejemplo
    console.log('👥 Creando Usuarios y Roles...');
    const bcrypt = await import('bcryptjs');
    const defaultPasswordHash = bcrypt.default.hashSync('Admin123*', 10);

    await db.insert(schema.usuarios).values([
      {
        dni: '00000001',
        nombres: 'Super',
        apellidos: 'Administrador',
        correo: 'admin.simulacion@cientifica.edu.pe',
        telefono: '999111222',
        tipoPersonal: 'tecnico',
        rolSistema: 'super_admin',
        passwordHash: defaultPasswordHash,
        activo: true,
      },
      {
        dni: '12345678',
        nombres: 'Dra. Andrea',
        apellidos: 'Castro Morales',
        correo: 'acastrom@cientifica.edu.pe',
        telefono: '987654321',
        tipoPersonal: 'docente',
        rolSistema: 'ninguno',
        activo: true,
      },
      {
        dni: '87654321',
        nombres: 'Carlos',
        apellidos: 'Mendoza Ramos',
        correo: 'cmendozar@cientifica.edu.pe',
        telefono: '912345678',
        tipoPersonal: 'tecnico',
        rolSistema: 'admin',
        passwordHash: defaultPasswordHash,
        activo: true,
      },
      {
        dni: '45678912',
        nombres: 'Lucía',
        apellidos: 'Fernández Silva',
        correo: 'lfernandezs@gmail.com',
        telefono: '934567890',
        tipoPersonal: 'paciente_simulado',
        rolSistema: 'ninguno',
        activo: true,
      },
    ]);

    console.log('✅ Base de datos poblada exitosamente.');
  } catch (error) {
    console.error('❌ Error ejecutando seed:', error);
    process.exit(1);
  }
}

seed();
