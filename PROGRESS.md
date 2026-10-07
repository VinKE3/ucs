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
        │   ├── SedesTab.tsx              # Gestión independiente de campus/sedes, estado operativo y conmutación ágil a salas
        │   ├── AmbientesTab.tsx          # Gestión de salas/ambientes por sede, categorías dinámicas, filtros y tarjetas de ocupación
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

10. **Módulo de Casting & Perfil Clínico para Pacientes Simulados**:
    - **CRUD Dinámico de Catálogos de Casting (`ModalGestionCastingCatalogos.tsx` & `/api/casting/catalogos`)**:
      - **Rangos de Edad**: Preset exacto con límites etarios: `Joven (18-28)`, `Adulto (30-50)`, `Adulto Mayor (60+)`.
      - **Especialidades y Casos Clínicos**: Preset de roles solicitados: `Paciente crítico/urgencias`, `Familiar angustiado`, `Paciente psiquiátrico/agitado`, `Paciente ambulatorio estándar`.
      - **Restricciones y Contraindicaciones**: Control de seguridad física: `Autoriza procedimientos de contacto (toma de signos, palpación, vendajes)`, `NO autoriza contacto físico directo ni invasivo`, etc.
      - **Modal Overlay Fijo (`z-index: 1200`)**: Corregido posicionamiento centrado en pantalla sobre la tabla y sobre el drawer de Kardex.
    - **Ficha de Casting de Actor (`ModalFichaCasting.tsx` & `/api/casting/perfiles`)**:
      - Perfil integral con edad real vs aparente, género, biotipo, selección interactiva de especialidades dominadas con insignias y activación de restricciones médicas/éticas.
      - **Privacidad de Tarifas / Honorarios**: Ocultadas tarifas en el Kiosco de autoservicio y en la ficha de estación de evaluadores; se mantienen exclusivamente como control interno para el administrador.
      - **Ficha Técnica de Estación ECOE Imprimible (`@media print`)**: Formato formal con membrete oficial UCS, recuadro de seguridad de restricciones en rojo para docentes evaluadores, y casillas de firma del actor y coordinación.
    - **Buscador de Convocatoria para ECOEs (`PersonalTab.tsx`)**:
      - Filtro avanzado de casting para convocar actores por rango de edad, especialidad requerida y exclusión de restricciones específicas.
      - **Copiar Resumen WhatsApp**: Genera un mensaje estructurado y listo para enviar al grupo de actores o coordinación con 1 clic.
      - **Exportar Convocatoria a CSV**: Descarga en Excel/CSV (UTF-8 BOM) con todos los atributos de perfil de los actores preseleccionados.
      - Distintivos visibles de casting en la tabla de personal y botón de acceso rápido `🎭 Casting`.
11. **Paginación Dinámica y Escalabilidad de Volumen (`PersonalTab.tsx` & `AsistenciasTab.tsx`)**:
    - **Directorio de Personal**: Paginador configurable (10, 15, 25, 50, o 'Todos') para manejar ágilmente listas de 50+ pacientes simulados, 20+ técnicos, 100+ docentes o cientos de colaboradores.
    - **Tab de Asistencias (Dual: Detallado y Resumen)**: Paginación reactiva tanto para la sábana de turnos detallados como para el consolidado acumulado por persona.
12. **Identidad Visual e Integración de Logo Oficial Científica (`/logo.png`)**:
    - **Logo Oficial Institucional**: Incorporado `public/logo.png` de la Universidad Científica del Sur.
    - **Diseño Minimalista y Limpio**: Se eliminaron los contenedores tipo tarjeta con borde blanco y los textos redundantes adyacentes (*«Clínica de Simulación • Control de Asistencias»*) en los encabezados, dejando exclusivamente el logo oficial integrado de forma limpia, espaciosa y adaptable a tema oscuro/claro sin sobrecargar la pantalla ni en móvil ni en desktop.
    - **Presencia en Módulos**: Kiosco Terminal, Navbar de Administración, Menú Móvil, Login y Ficha Imprimible ECOE.
13. **Protección y Modo Oculto de Cuenta Maestra TI (`00000001` - Super Admin)**:
    - **Aislamiento en Kiosco (`/api/kiosco/lookup` & `/api/kiosco/marcar`)**: Bloqueo preventivo en el terminal táctil si se digita `00000001` (*«Esta cuenta es de gestión administrativa y no registra turnos de asistencia en el kiosco»*).
    - **Estadísticas Reales de Personal (`/api/dashboard/stats` & `AdminDashboard.tsx`)**: La cuenta maestra no altera los contadores de personal clínico (técnicos/docentes).
    - **Interruptor Secreto de Super Admin (`PersonalTab.tsx`)**: Oculto 100% por defecto. Si el usuario logueado es `super_admin`, se habilita el botón `[ 🔒 Cuentas Sistema ]` / `[ 🛡️ Cuenta Maestra Activa ]` para revelarla bajo demanda con su distintivo dorado `🛡️ Cuenta Maestra TI`.
    - **Protección contra Bloqueo Accidental**: Deshabilitadas las opciones de borrado e inactivación para la cuenta raíz.
14. **Optimización de Accesibilidad y Alto Contraste en Tema Claro (WCAG AAA)**:
    - **Banner de Técnicos de Turno (`tecnicosBanner` & `tecnicoPillTag`)**: En tema claro, el texto verde pastel deslavado (`#a7f3d0`) y el texto blanco sobre fondo translúcido fueron reemplazados por un contenedor menta nítido (`#ecfdf5`), títulos en verde bosque profundo (`#064e3b`, ratio > 10:1) y distintivos de técnicos en tarjeta blanca sólida con texto verde esmeralda de alta saturación (`#065f46` e ingreso `#047857`).
    - **Variables Globales de Color Clínico (`globals.css`)**: Definición de `--ucs-clinical-green: #047857` en modo claro para indicadores de turnos activos y salas operativas.
    - **Pills de Presencia y Filtros**: Ajustados `pillLiveActive` y `presenceStatusActive` para visibilidad impecable sobre fondo claro.
15. **Integración de SweetAlert2 con Identidad Institucional UCS (Reemplazo Total de Modales Nativos)**:
    - **Eliminación de `window.confirm` y `window.alert`**: Se reemplazaron todos los diálogos nativos del navegador por modales estilizados con diseño premium acorde a la paleta institucional UCS.
    - **Módulo Unificado de Notificaciones (`src/lib/alerts.ts`)**: Creadas funciones modulares (`confirmModal`, `confirmDelete`, `confirmToggleActive`, `showAlert`, `showError`, `showToast`).
    - **Estilizado Completo UCS (`globals.css`)**:
      - Modales con bordes adaptables a temas claro y oscuro, tipografía institucional y botones con gradiente naranja UCS (`linear-gradient(135deg, #ff5a00, #ff701e)`) o carmesí (`#ef4444`) para acciones destructivas.
      - Notificaciones Toast superiores derechas de alta fidelidad para feedback instantáneo sin interrumpir el flujo.
    - **Cobertura Completa**: Personal (inactivación/eliminación), Sedes y Salas, Cursos, Categorías de Salas, Convocatoria ECOE y Kardex de Horas.
16. **Control de Horarios Obligatorios, Presets Rápidos y Auditoría de Puntualidad para Técnicos**:
    - **Horarios Obligatorios Asignables (`usuarios.hora_entrada_esperada`, `usuarios.hora_salida_esperada`, `usuarios.tolerancia_minutos`)**:
      - Al registrar o editar un colaborador de tipo `Técnico de Simulación`, la asignación de horario es obligatoria para auditar el desempeño de sala.
      - **Presets Rápidos de Turno Clave de la Clínica (1 Clic)**:
        - 🌅 **Mañana**: `06:00 - 15:00`
        - 🌇 **Tarde**: `13:00 - 22:00`
        - 🏢 **Jornada**: `09:00 - 18:00`
        - ⚙️ **Personalizado**: Selectores manuales de hora y tolerancia de gracia (por defecto 10 minutos).
    - **Evaluación en Tiempo Real en Kiosco (`/api/kiosco/marcar`)**:
      - Cálculo automático contra la hora oficial de Lima, Perú (`America/Lima`):
        - Entrada: determina llegada puntual (dentro de tolerancia), anticipada (`minutosAnticipo`) o con tardanza (`minutosTardanza`).
        - Salida: determina salida regular, anticipada o sobretiempo acumulado (`minutosExtra`).
      - Feedback instantáneo en pantalla y notas estructuradas en `asistencias`.
    - **Monitoreo en el Tab de Asistencias (`AsistenciasTab.tsx` & `/api/asistencias/export`)**:
      - **Vista Detallada**: Insignias visuales de alta precisión por turno (`⏰ Turno: 06:00 - 15:00`, `✅ Puntual`, `⚠️ Tardanza +Xm`, `🌅 Anticipo Ym`, `⏱️ +Zm extra`).
      - **Vista Resumen**: Indicador de turno habitual, tardanzas acumuladas y sobretiempo acumulado por técnico.
      - **Exportación CSV**: Columnas dedicadas de `Turno Programado`, `Puntualidad Entrada`, `Tardanza (min)`, `Anticipo (min)` y `Sobretiempo (min)`.
    - **Scorecard 360° en Kardex del Técnico (`KardexDrawer.tsx`)**:
      - Tarjeta destacada de *Auditoría de Desempeño y Puntualidad* con ratio porcentual de puntualidad (`%`), tardanza total acumulada, sobretiempo adicional y turnos anticipados.
      - Desglose por sesión y exportación a CSV con datos de auditoría horaria.

  * **Rol y Perfil "Administrativo" (Control & Fiscalización de Asistencias)**:
    - **Doble Dimensión (DB & Enums)**:
      - `tipo_personal`: `'administrativo'` para personal de coordinación clínica, secretaría y supervisión operativa que registra asistencia sin asociarse a un ambiente clínico ni curso médico.
      - `rol_sistema`: `'administrativo'` para acceso web enfocado en control y fiscalización del sistema.
    - **Permisos y Control de Acceso Granular**:
      - **Asistencias (`/api/asistencias`, `AsistenciasTab.tsx`)**: Acceso completo a ver turnos en curso, filtrar por sede/rol/fechas, registrar asistencias manuales justificadas, regularizar turnos, ver auditorías y exportar informes en CSV/Excel. La vista por defecto al iniciar sesión se orienta automáticamente a este módulo.
      - **Personal & Salas (Solo Lectura Segura)**: Acceso a consultar el directorio de colaboradores, fichas Kardex 360° y visualización en tiempo real de la ocupación de salas/sedes.
      - **Protección de Infraestructura y Catálogos**: Se ocultan y restringen operaciones destructivas o críticas (crear/eliminar usuarios, modificar sedes/ambientes, configurar cursos o catálogos de casting).
    - **Identidad Visual & Estilos (Dark & Light Mode)**:
      - Insignia distintiva violeta/púrpura institucional (`.roleAdministrativo` y `.badgeAdministrativo` con fondo `rgba(168, 85, 247, 0.15)` y texto `#c084fc` en oscuro; y `#f3e8ff` con texto `#7e22ce` en tema claro para óptima legibilidad).
    - **Terminal Kiosco Autoservicio (`KioscoTerminal.tsx`)**:
      - Marcación ágil directa a la sede general sin obligar a seleccionar ambientes clínicos ni cursos de simulación médica. Soporte de horarios programados y control de puntualidad.

  * **Separación de Tabs (Sedes y Ambientes) & Reordenamiento de Navegación**:
    - **Pestaña Independiente de Sedes (`SedesTab.tsx`)**:
      - Vista en cuadrícula de todos los campus registrados con insignias de estado operativo, dirección y total de salas activas.
      - Botón de acceso directo `Ver Salas (X)` que conmuta inmediatamente a `AmbientesTab` prefiltrando por el campus seleccionado.
      - CRUD integrado para creación (`+ Nueva Sede`), edición, inactivación y eliminación segura de sedes.
    - **Pestaña Independiente de Ambientes (`AmbientesTab.tsx`)**:
      - Conmutador horizontal por campus (`📍 Campus Ate`, `Campus Norte`, etc.) en lugar de barra lateral fija.
      - Grilla a pantalla completa para salas de simulación con filtros por categoría dinámica, buscador en tiempo real e indicador de técnico de turno.
      - Acciones contextuales limpias (`+ Agregar Sala` y `🏷️ Categorías`) dentro del encabezado propio de la vista.
    - **Navegación Superior Despejada**:
      - Se eliminaron por completo los botones flotantes duplicados (`+ Nueva Sede` y `+ Agregar Sala a Campus`) que sobrecargaban la barra principal de tabs.
    - **Orden Estricto de Navegación**:
      1. **SEDES**
      2. **AMBIENTES**
      3. **CURSOS**
      4. **PERSONAL CLÍNICA**
      5. **HISTORIAL DE ASISTENCIA**

---

## 📝 4. Últimos Commits Registrados

* `b30734e`: feat(auth): rol Administrativo para control y fiscalizacion de asistencias
* `6f0532d`: docs: actualizar PROGRESS.md con hito de control de turnos obligatorios
* `2f4eafe`: feat(turnos): control de horarios obligatorios, presets rapidos y auditoria de puntualidad para tecnicos
* `d22c0ba`: feat(ux): integrar sweetalert2 institucional reemplazando modales nativos de confirmacion y alertas
* `abb46a2`: style(theme): alto contraste y legibilidad para banner de tecnicos y acentos verdes en tema claro
* `222be76`: feat(security): modo oculto e interruptor secreto para cuenta maestra de super admin 00000001

* `4f183db`: style: aumentar dimension y visibilidad del logo en version de escritorio
* `d97b0a8`: style(branding): simplificar cabecera dejando exclusivamente el logo oficial limpio y estilizado
* `ec72217`: feat(branding): incorporar logo oficial de la Cientifica en Kiosco, AdminNavbar, Login y Ficha ECOE
* `eb5c223`: feat(pagination): paginacion dinamica y controles de navegacion en Directorio de Personal y Asistencias
* `f645ec8`: fix(estilos): definir clases completas para closeBtn, submitBtn y secondaryBtn en modales
* `f79e4ca`: fix(modales): corregir modal de auditoria y asegurar overlay global centrado z-index 1200
* `b41982c`: fix(casting): corregir modales flotantes, ocultar cobros en kiosco y alinear presets de casting
* `fb6c08c`: feat(casting): crud completo de catalogos, ficha de actor, convocatoria ecoe y ficha imprimible
* `7f5d396`: feat(cursos): tarifas diferenciadas de pacientes simulados, tope de horas opcional y ranking de demanda operativa
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
3. **Integración con Programación de SimClic**:
   - Importación de la sábana de programación de SimClic (`cientifica.simclic.com`) para sugerir salas y estaciones ECOE automáticamente al pasar el DNI.

