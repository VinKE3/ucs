# 📌 Bitácora de Proyecto & Estado de Sincronización (PROGRESS.md)

> **Propósito**: Este archivo sirve como memoria viva y punto de sincronización de contexto entre computadoras (Oficina 🏢 <-> Casa 🏠) para los asistentes de Antigravity IDE / Gemini.
> **Regla para el Asistente**: Al iniciar una nueva conversación o continuar el trabajo, lee este archivo para comprender el estado actual, las decisiones arquitectónicas y los pendientes inmediatos.

---

## 🏛️ 1. Visión General del Proyecto
* **Nombre**: Sistema de Registro y Control de Presencia para Simulación Clínica.
* **Institución**: Universidad Científica del Sur (UCS).
* **Entorno complementario**: Funciona en conjunto operativo con **SimClic** (`cientifica.simclic.com`), actuando como el sistema de presencia real, control de horas efectivas y auditoría de sala.
* **Stack Tecnológico**:
  * **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5.
  * **Estilos**: Vanilla CSS Modules (sin Tailwind) adaptados a la paleta oficial UCS (`#06152d`, `#0d346c`, `#ff5a00`, etc.) con soporte completo para Tema Oscuro / Claro / Sistema.
  * **Base de Datos**: PostgreSQL Serverless (Neon) gestionado con **Drizzle ORM**.
  * **Autenticación**: JWT (`jose`) y hashing seguro con `bcryptjs`.

---

## 📂 2. Estructura y Arquitectura Modular

El proyecto fue refactorizado y desacoplado para máxima mantenibilidad:

```
src/
├── types/
│   └── admin.ts                          # Tipos globales centralizados (Usuario, Asistencia, Sede, etc.)
├── db/
│   ├── schema.ts                         # Tablas: sedes, ambientes, categoriasAmbiente, usuarios, asistencias, cursos, auditoria
│   └── migrate_categorias.ts             # Script de inicialización de categorías
├── app/
│   ├── KioscoTerminal.tsx                # Terminal de autoservicio para marcación con DNI
│   ├── admin/
│   │   ├── AdminDashboard.tsx            # Orquestador del panel de administración (~800 líneas)
│   │   ├── DateRangePicker.tsx           # Selector de rango de fechas adaptado
│   │   └── admin.module.css              # Estilos del dashboard y tablas
│   └── api/                              # Rutas REST (asistencias, usuarios, sedes, ambientes, cursos, categorias, auditoria)
└── components/
    └── admin/
        ├── AdminNavbar.tsx               # Barra superior, navegación móvil y switch de tema
        ├── AdminStatsCards.tsx           # Métricas resumen en vivo (Sedes, Salas, Personal, En Turno, Cursos)
        ├── tabs/
        │   ├── AmbientesTab.tsx          # Gestión de sedes/salas, categorías dinámicas, filtros y tarjetas de ocupación
        │   ├── PersonalTab.tsx           # Directorio de personal, presencia en vivo, edición, inactivación y acceso a Kardex
        │   ├── CursosTab.tsx             # Catálogo de cursos/escenarios médicos con borrado seguro
        │   └── AsistenciasTab.tsx        # Vista dual: Turnos detallados vs. Resumen consolidado por persona con exportación CSV
        └── modals/
            ├── KardexDrawer.tsx          # Ficha 360° individual de horas (KPIs, barra de carga semanal docente y sesiones)
            ├── ModalGestionCategorias.tsx # Administración dinámica de categorías de sala (iconos, colores, orden)
            ├── ModalCrearSede.tsx        # Creación y edición de sedes
            ├── ModalCrearAmbiente.tsx    # Creación, edición y mantenimiento de ambientes
            ├── ModalCrearPersonal.tsx    # Registro de colaboradores con tope semanal opcional
            ├── ModalCrearAsistenciaManual.tsx # Registro justificado de asistencias extemporáneas
            ├── ModalAuditoriaAsistencia.tsx # Trazabilidad de cambios y justificaciones de auditoría
            ├── ModalCerrarTurno.tsx      # Cierre forzado de turnos olvidados
            ├── ModalAnularAsistencia.tsx # Anulación justificada de registros erróneos
            ├── ModalResetPassword.tsx    # Cambio de claves de acceso al panel
            └── ModalCurso.tsx            # Creación y edición de cursos
```

---

## 🚀 3. Funcionalidades Principales Implementadas

1. **Kiosco de Autoservicio (`KioscoTerminal.tsx`)**:
   - Marcación ágil por DNI (teclado táctil en pantalla y físico).
   - Detección de relevos en salas y regularización de turnos anteriores.
   - **Concurrencia Multirrol Inteligente (Docente + Paciente Simulado)**: Si un paciente simulado marca primero y luego llega el docente (o al revés), el Kiosco reconoce la sesión conjunta, hereda automáticamente el curso asignado y muestra avisos/botones específicos (`INICIAR SIMULACIÓN CON PACIENTE` / `INGRESAR COMO PACIENTE SIMULADO`). Notas de auditoría limpias en BD.
2. **Kardex 360° de Horas (`KardexDrawer.tsx`)**:
   - Monitoreo en vivo de horas trabajadas por colaborador: Hoy, Esta Semana, Este Mes, Histórico.
   - **Termómetro de Carga Semanal Docente**: Barra de progreso con alertas de cobertura (`<80%` disponible, `80-99%` alerta, `>=100%` excedido).
   - Modificación rápida de tope semanal sin salir de la ficha.
3. **Consolidado de Asistencias & Exportación para Nómina (`AsistenciasTab.tsx`)**:
   - Alternancia entre *Turnos Detallados* y *Resumen por Colaborador*.
   - Exportador nativo a Excel (`CSV` con UTF-8 BOM) con desglose de horas, días trabajados y cursos.
4. **Seguridad y CRUD Completo de Entidades**:
   - Edición y borrado seguro de ambientes, sedes, personal y cursos (previene borrados accidentales si existen asistencias históricas vinculadas).
   - Inactivación/reactivación de personal.
   - Registro manual justificado con auditoría completa (`auditoria_asistencias`).
6. **Ticket / Recibo Digital de Salida en Kiosco (`KioscoTerminal.tsx` & `/api/kiosco/marcar`)**:
   - Al marcar salida, el Kiosco presenta una constancia electrónica elegante con la jornada del día, el acumulado semanal (con barra de tope para docentes), el acumulado mensual y el cálculo de honorarios para pacientes simulados.
   - Temporizador inteligente de 8 segundos con barra de progreso y botón de avance inmediato.
7. **Control y Alerta de Turnos Prolongados / Olvidados (> 5 horas)**:
   - Detección en tiempo real de turnos que superen las 5 horas continuas sin salida registrada.
   - Banner de advertencia en el tab de Asistencias con filtro directo de turnos abiertos.
   - Fila resaltada con insignia `⚠️ Prolongado` y botón `⚠️ Regularizar` en la tabla.
   - Atajos rápidos de 1 clic en `ModalCerrarTurno.tsx` (+2h, +3h, +4h, 13:00, 18:00, Ahora) que autocompletan hora y motivo de auditoría.
8. **Pre-Liquidación de Honorarios para Pacientes Simulados**:
   - Campo `tarifaHora` en base de datos (`usuarios.tarifa_hora`), perfil y modales de registro/edición.
   - Desglose y liquidación estimada en la pestaña *Resumen por Colaborador* (`S/. Monto Estimado` y `Tarifa / hr`).
   - Exportación detallada y consolidada a Excel (CSV con UTF-8 BOM).
9. **Tarifas Diferenciadas por Curso, Tope de Horas para Actores y Ranking de Demanda**:
   - **Tarifa Diferenciada por Curso (`cursos.tarifa_hora_ps`)**: Cursos como Posgrado o Diplomados pueden fijar tarifas mayores (ej. S/. 50.00/h) y cursos como Ecografía menores (ej. S/. 25.00/h). La jerarquía de cálculo prioriza automáticamente la tarifa del curso sobre la tarifa base del actor.
   - **Tope de Horas Opcional con Checkbox para Actores**: En el registro y edición de Pacientes Simulados, checkbox `[✓] Asignar tope de horas para este actor` para controlar carga y fatiga académica, integrado con el Kardex semanal y visualizado en tablas.
   - **Ranking de Demanda Operativa de Pacientes Simulados (`CursosTab.tsx`)**:
     - Tarjetas destacadas en tiempo real de Top Cursos con mayor demanda de simulación (Horas acumuladas, Sesiones ejecutadas y Actores convocados).
     - Filtro selector para ordenar cursos por: *Mayor Demanda PS*, *Mayor Tarifa PS* o *Nombre A-Z*.
     - Columnas de `Tarifa PS (S/.)` y `Demanda PS` en el catálogo de cursos.
   - **Resolución Jerárquica en Kiosco, Resumen y Exportación CSV**:
     - El ticket de salida en el Kiosco calcula el honorario de la sesión utilizando la tarifa del curso correspondiente.
     - El Resumen consolidado y el reporte CSV aplican el cálculo proporcional por cada sesión y curso asistido.

---

## 📝 4. Últimos Commits Registrados

* `738d152`: feat(cursos): tarifas diferenciadas de pacientes simulados, tope de horas opcional y ranking de demanda operativa
* `d811528`: implenetando tarifa hora
* `9d24d92`: feat(kiosco): soporte inteligente de sesiones conjuntas Docente + Paciente Simulado y auto-seleccion de curso
* `bbc3ae2`: docs: agregar PROGRESS.md y configurar directiva de sincronizacion multi-pc en AGENTS.md
* `2ed46f2`: feat: implement kiosk terminal and admin dashboard for attendance tracking
* `2852792`: feat: safe course deletion and manual justified attendance registration
* `2733d7d`: Fase 1: Edicion, inactivacion y eliminacion segura de personal
* `0efdcfe`: Implementacion gestion dinamica de categorias de salas
* `670a937`: Implementacion editar, mantenimiento y eliminacion de ambientes
* `09b05d3`: Implementacion editar sedes
* `2cbbddc`: Puliendo kardex-asistencia-personaltab

---

## 🎯 5. Próximas Mejoras Planificadas (Backlog)

1. **Modo Live Board (Pantalla TV para Recepción) (`/live` o `/pantalla`)**:
   - Vista a pantalla completa en tiempo real con el estado de ocupación de las salas para proyectar en Smart TV en recepción/pasillo sin requerir login.
2. **Marcación con Fotocheck UCS (Código de Barras / QR)**:
   - Integración con lector USB en el kiosco para marcación instantánea sin digitar DNI.
3. **Ficha de Pacientes Simulados**:
   - Registro de perfiles de actuación y casos médicos que domina cada actor.
4. **Integración con Programación de SimClic**:
   - Importación de la sábana de programación de SimClic (`cientifica.simclic.com`) para sugerir salas y estaciones ECOE automáticamente al pasar el DNI.

