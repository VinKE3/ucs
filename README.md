# UCS Registro - Clínica de Simulación (Universidad Científica del Sur)

Sistema integral de registro de asistencias, control de ambientes de simulación y gestión de personal médico, técnico y pacientes simulados.

---

## 🏗️ Arquitectura de Datos

El esquema definido en [`src/db/schema.ts`](file:///c:/UCS_Registro/src/db/schema.ts) incluye:

1. **`sedes`**: Campus universitarios (Campus Villa Chorrillos, Campus Norte Los Olivos, Campus Ate, etc.).
2. **`ambientes`**: Salas de simulación asociadas a una sede (Quirófano Simulado, UCI, Consultorios, Debriefing, etc.).
3. **`usuarios`**:
   - `tipo_personal`: `docente` | `tecnico` | `paciente_simulado`
   - `rol_sistema`: `super_admin` | `admin` | `ninguno`
4. **`asistencias`**:
   - `sede_id`: Obligatorio para todos.
   - `ambiente_id`: **Opcional (`nullable`)**. Los técnicos registran asistencia a nivel de sede/clínica; los docentes y pacientes simulados seleccionan su ambiente específico.
   - `estado`: `en_curso` | `finalizado` | `anulado` | `ajustado_manual`.
5. **`auditoria_asistencias`**: Inmutabilidad y trazabilidad completa de modificaciones o anulaciones efectuadas por administradores con motivo justificado.

---

## 🚀 Puesta en Marcha

### 1. Variables de Entorno
Asegúrate de tener tu cadena de conexión de Neon en [`.env.local`](file:///c:/UCS_Registro/.env.local):

```env
DATABASE_URL="postgresql://usuario:contraseña@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

### 2. Sincronizar Esquema con Neon
Crea todas las tablas y relaciones en tu base de datos con Drizzle Kit:

```bash
npm run db:push
```

### 3. Poblar Datos Iniciales (Opcional pero Recomendado)
Inserta sedes de la Científica (Villa, Norte, Ate), salas de simulación y usuarios de prueba (Super Admin, Docente, Técnico, Paciente Simulado):

```bash
npm run db:seed
```

### 4. Iniciar el Servidor
```bash
npm run dev
```

---

## 🛠️ Comandos Disponibles

| Comando | Acción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo de Next.js en `http://localhost:3000` |
| `npm run db:push` | Sincroniza el esquema de Drizzle directamente con Neon PostgreSQL |
| `npm run db:seed` | Carga las sedes de la UCS, salas y usuarios base de prueba |
| `npm run db:studio` | Abre la interfaz web gráfica de Drizzle Studio para explorar los datos |
| `npm run build` | Compila la aplicación para producción |
| `npm run lint` | Ejecuta el análisis de linter |
