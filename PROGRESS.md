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
        │   ├── AsistenciasTab.tsx        # Vista dual: Turnos detallados vs. Resumen consolidado por persona con exportación CSV
        │   └── PlanillaTab.tsx           # Pestaña dedicada: Planilla mensual de honorarios PS, cortes quincenales, comparativas y reportes Finanzas
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
            ├── ModalCurso.tsx            # Creación y edición de cursos
            └── ModalFichaPacienteSimulado.tsx # Expediente 360° exclusivo del actor: honorarios, sesiones y perfil casting ECOE
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
7. **Control y Alerta de Turnos Prolongados / Olvidados (> 5 horas) & Regularización Bimodal (Entrada y Salida)**:
   - Detección en tiempo real de turnos que superen las 5 horas continuas sin salida registrada.
   - Banner de advertencia en el tab de Asistencias con filtro directo de turnos abiertos.
   - Fila resaltada con insignia `⚠️ Prolongado` y botón `⚠️ Regularizar` en la tabla.
   - **Corrección de Ingreso y Salida en 1 Clic (`ModalCerrarTurno.tsx` & `/api/asistencias`)**:
     - Permite editar tanto la **Fecha y Hora de Ingreso Real** como la de salida si el colaborador omitió marcar al llegar o digitó entrada al retirarse.
     - **Atajos Inteligentes de Turno**: Si el colaborador tiene turno asignado (ej: `13:00 - 22:00` o `06:00 - 15:00`), un solo clic ajusta la entrada y salida exactas, recalcula automáticamente la puntualidad (eliminando tardanzas erróneas) y autocompleta el motivo de auditoría.
     - Cálculo en tiempo real de duración efectiva antes de guardar.
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
13. **Protección y Modo Fantasma Permanente de Cuenta Maestra TI (`00000001` - Super Admin)**:
    - **Invisibilidad Absoluta (Cuenta Fantasma)**: La cuenta raíz `00000001` está excluida permanentemente tanto en backend (`/api/usuarios` mediante `ne(usuarios.dni, '00000001')`) como en frontend (`PersonalTab.tsx`). Se eliminó por completo el botón `🛡️ Cuenta Maestra Visible` y cualquier rastro visual o badge en el directorio. No infla conteos ni aparece bajo ningún filtro.
    - **Aislamiento en Kiosco (`/api/kiosco/lookup` & `/api/kiosco/marcar`)**: Bloqueo preventivo en el terminal táctil si se digita `00000001` (*«Esta cuenta es de gestión administrativa y no registra turnos de asistencia en el kiosco»*).
    - **Estadísticas Reales de Personal (`/api/dashboard/stats` & `AdminDashboard.tsx`)**: La cuenta maestra no altera los contadores de personal clínico (técnicos, docentes, administrativos).
    - **Protección y Operatividad Total**: La cuenta mantiene 100% sus privilegios de login maestro (`/login`), emparejamiento de terminales físicas (`/api/kiosco/terminal/autorizar`) y reseteo de claves, pero está blindada contra eliminación (`DELETE` bloqueado con HTTP 403).
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
      - Grilla optimizada a **2 columnas** (`repeat(2, minmax(0, 1fr))`, 1 columna en móvil) con diseño de tarjetas alargado, espacioso y rectangular apaisado (eliminando la sobrecarga y apiñamiento de 5 columnas estrechas).
      - Separación vertical y visual limpia entre la barra de búsqueda de salas, el selector de categorías de simulación y la grilla de ambientes.
      - Corrección y estilización de insignias de disponibilidad (`occupancyBadgeInUse`, `occupancyBadgeFree`) con punto de estado integrado.
      - Aviso minimalista y horizontal para salas libres sin cajas de espacio vacío gigantes.
      - Acciones contextuales limpias (`+ Agregar Sala` y `🏷️ Categorías`) dentro del encabezado propio de la vista.
    - **Navegación Superior Despejada**:
      - Se eliminaron por completo los botones flotantes duplicados (`+ Nueva Sede` y `+ Agregar Sala a Campus`) que sobrecargaban la barra principal de tabs.
    - **Orden Estricto de Navegación**:
      1. **SEDES**
      2. **AMBIENTES**
      3. **CURSOS**
      4. **PERSONAL CLÍNICA**
      5. **HISTORIAL DE ASISTENCIA**

  * **Control de Presencia Física & Terminales Oficiales de Kiosco (Token en Navegador)**:
    - **Protección contra Marcación Remota / Fuera de Sede**:
      - Si una persona obtiene la URL de la web y la abre en su celular o computadora personal desde su casa, el Kiosco se bloquea automáticamente:
        > 🔒 *Terminal de Autoservicio Bloqueada: Este dispositivo no cuenta con autorización para registrar asistencias.*
    - **Token Criptográfico Permanente en Navegador (`localStorage`)**:
      - Compatible con Microsoft Edge, Google Chrome y navegadores táctiles de tablets. Persiste a través de cierres de navegador, reinicios de equipo y cortes de energía.
    - **Flujo de Emparejamiento Directo en Pantalla**:
      - El Administrador se acerca a la tablet/PC física de la clínica y hace clic en `🔑 Autorizar este Dispositivo`.
      - Ingresa sus credenciales de Administrador (correo/DNI y contraseña), asigna un nombre (ej: "Tablet Recepción Villa") y la sede asignada.
      - El sistema genera un token seguro único (`trm_...`), lo almacena en `localStorage` y desbloquea el Kiosco al instante.
    - **Validación Estricta en Backend (`/api/kiosco/marcar`)**:
      - El endpoint de marcación exige el encabezado `x-terminal-token`. Si la petición no tiene un token registrado y activo en la tabla `terminales_kiosco`, es rechazada con `HTTP 403 Forbidden`. Imposible de burlar con cURL, Postman o scripts externos.
    - **Panel de Gestión de Dispositivos (`ModalGestionTerminales.tsx`)**:
      - Botón `🖥️ Terminales Kiosco` en el tab de **SEDES**.
      - El Administrador visualiza todas las tablets/PCs vinculadas, su campus, su última fecha/hora de uso, botón para desactivar temporalmente (`⏸️`) y botón para revocar/eliminar permanentemente (`🗑️`).

18. **Ampliación de Capacidades Operativas para el Rol Administrativo (`administrativo`)**:
    - **Gestión Completa de Personal**: Habilitada la creación (`+ Registrar Personal`), edición, alternancia de estado (`⏸️`/`▶️`) y eliminación (`🗑️`) de personal clínico. Blindaje activo: no pueden otorgar roles web de sistema ni eliminar administradores.
    - **CRUD Completo de Sedes**: Creación, edición, activación/inactivación y eliminación de campus.
    - **CRUD Completo de Ambientes y Categorías**: Creación de salas (`+ Agregar Sala`), edición, puesta en mantenimiento (`⏸️`/`▶️`), eliminación y administración de categorías de simulación (`🏷️ Categorías`).
    - **CRUD Completo de Cursos**: Creación, modificación de tarifas de pacientes simulados por asignatura, activación/desactivación y eliminación segura de cursos.
    - **Gestión de Catálogos ECOE**: Mantenimiento completo de rangos de edad, especialidades y restricciones para convocatoria de actores.

19. **Selector Buscable con Filtro de Roles en Asistencias Manuales (`ModalCrearAsistenciaManual.tsx`)**:
    - **Reemplazo del `<select>` Nativo**: Combobox interactivo con pestañas de rol rápido (`Todos`, `Docentes`, `Técnicos`, `Pacientes Simulados`, `Administrativos`).
    - **Búsqueda Instantánea**: Filtrado en tiempo real por apellido, nombre o DNI con exclusión automática de la cuenta maestra.
20. **Búsqueda Automática al 8° Dígito en Modo Kiosco (`KioscoTerminal.tsx`)**:
    - **Carga Inmediata (0 clics para buscar)**: Al completar los 8 dígitos del DNI (sea por teclado táctil en pantalla, teclado físico o lector de código de barras/fotocheck), el sistema consulta la base de datos automáticamente con un retardo natural de 200ms sin requerir clic en "Continuar >".
    - **Marcación a 1 Solo Clic Real**:
      - *Técnicos y Administrativos*: Al digitar sus 8 dígitos, ven inmediatamente su perfil y registran su entrada con **1 solo clic** (`🟢 REGISTRAR INGRESO`).
      - *Salida (Todos los roles)*: Si el colaborador tiene turno activo, se carga directamente su resumen y registra su salida con **1 solo clic** (`🛑 REGISTRAR SALIDA`).
      - *Docentes y Pacientes Simulados*: Se ahorran el clic de búsqueda; el sistema reconoce su rol y despliega de inmediato los selectores de Curso y Sala (manteniendo la auto-herencia de curso si la sala ya está activa).
    - **Feedback Visual Dinámico**: Indicador dinámico en tiempo real (`⚡ Consultando datos automáticamente...`) y limpieza segura de timers al desmontar o pulsar borrar/cancelar.

21. **Sistema Integral de Loaders Reactivos y Shimmer Skeletons (UX 60 FPS)**:
    - **Pantalla de Login (`/login`)**:
      - Spinner SVG dinámico en el botón de acceso (*«Validando credenciales...»*).
      - Bloqueo preventivo de formulario para evitar doble submit o manipulación de inputs en tránsito.
      - Animación de sacudida (*shake effect*) en caso de credenciales incorrectas.
    - **Kiosco Táctil de Autoservicio (`KioscoTerminal.tsx`)**:
      - **Skeleton Shimmer Card**: Al consultar DNI, se despliega una silueta animada con efecto de brillo (*shimmer*) que anticipa la tarjeta del colaborador con pulso indicador (*«Identificando colaborador en padrón de clínica...»*).
      - **Bloqueo Preventivo del Teclado Numérico**: Teclas táctiles desactivadas (`disabled={loadingSearch || marcando}`) durante búsquedas y marcaciones para evitar dobles toques por impaciencia en tablets.
      - **Botones de Marcación con Spinner Activo**: Spinners animados dentro de `🟢 REGISTRAR INGRESO` y `🛑 REGISTRAR SALIDA` mientras viaja la transacción.
    - **Tablas Administrativas (`AsistenciasTab.tsx`)**:
      - Sustitución de textos estáticos de carga por **Skeleton Shimmer Rows** (6 filas de siluetas de alta fidelidad) tanto en la sábana detallada como en el consolidado de colaboradores.

22. **Pre-Liquidación Automática de Honorarios y Planilla Consolidada para Finanzas (Pacientes Simulados)**:
    - **Pre-Liquidación Individual en Ficha/Kardex 360° (`KardexDrawer.tsx`)**:
      - Cálculo automático de honorarios netos en S/. agrupados por curso/estación ECOE (horas dictadas × tarifa por hora aplicada = subtotal).
      - Respaldo de tarifa por curso (`tarifa_hora_ps`) o tarifa base del actor (`tarifa_hora`) en caso de actividades clínicas generales.
      - Tarjeta de liquidación del período seleccionado con importe total destacado y desglose detallado.
      - **Comprobante de Pre-Liquidación Imprimible y Descargable (`ModalComprobanteLiquidacion.tsx`)**:
        - Membrete oficial de la Universidad Científica del Sur y Facultad de Ciencias de la Salud.
        - Detalle de cursos, horas netas, tarifa e importes, junto con la auditoría cronológica de marcaciones.
        - Espacio de firmas para Jefatura de Simulación y conformidad del Paciente Simulado.
        - Exportación a CSV/Excel y botón de impresión directa / PDF (`window.print()`).
    - **Planilla Mensual Consolidada de Honorarios PS para Finanzas (`ModalPlanillaPS.tsx` & `AsistenciasTab.tsx`)**:
      - Acceso directo mediante botón de alta visibilidad: *«📑 Planilla Mensual PS (Finanzas)»* en la cabecera de Asistencias.
      - Filtros de período inteligentes: Mes Actual, Mes Anterior y rango personalizado.
      - Tarjetas KPI consolidadas: Presupuesto total a liquidar (S/.), actores participantes, horas totales y cursos cubiertos.
      - Tabla unificada con: Nombre del Actor, DNI, N° Sesiones, Cursos participados, Horas Netas (hh:mm y decimal), Tarifas, Total a Pagar (S/.) y Estado de Liquidación (Listo para pago / En sala).
      - **Exportación Contable a Excel (CSV)** con 1 solo clic y membrete formal para enviar directamente a la oficina de Finanzas/RRHH de la Científica.

23. **Semillas y Limpieza de Demostración para Pacientes Simulados (Septiembre 2026)**:
    - **Semilla Automatizada (`src/db/seed_demo_ps.ts` / `npm run demo:ps:seed`)**:
      - Genera 8 Pacientes Simulados realistas con DNIs `77000001` al `77000008` con perfiles de casting y tarifas (S/. 28 a S/. 35 / hora).
      - Inserta 56 turnos de asistencia finalizados a lo largo de todo el mes de Septiembre 2026 distribuidos en cursos de simulación (Quirúrgica, Pediátrica, Obstétrica, SCI, SBS) con duraciones de 3 a 5 horas por jornada y observaciones clínicas detalladas.
    - **Limpieza Instantánea 100% Reversible (`src/db/cleanup_demo_ps.ts` / `npm run demo:ps:cleanup`)**:
      - Elimina limpiamente las 56 asistencias, los perfiles de casting y los 8 usuarios ficticios con 1 solo comando, restaurando la base de datos a su estado original sin afectar ningún registro real.

24. **Sistema Flexible de Cortes Quincenales y Mensuales para Planilla y Liquidación PS**:
    - **Planilla Mensual Consolidada (`ModalPlanillaPS.tsx`)**:
      - Selector inteligente de mes con botones de navegación rápida `◀ Mes Anterior` y `Mes Siguiente ▶`.
      - Botonera de presets a 1 solo clic: `📅 Mes Completo`, `1️⃣ 1ra Quincena (01-15)`, `2️⃣ 2da Quincena (16-fin)`, y `🎯 Personalizado (Rango Libre para ECOE)`.
      - Tarjeta ejecutiva de mini-comparativa: desglosa en tiempo real el monto acumulado en la 1ra Quincena vs. 2da Quincena vs. Mes Completo.
      - Nombres de archivo Excel y glosa adaptativos (ej. `Planilla_PS_1ra_Quincena_Septiembre_2026.csv`).
    - **Pre-Liquidación Individual en Ficha 360° (`KardexDrawer.tsx`)**:
      - Botonera quincenal integrada dentro de la tarjeta de pre-liquidación: permite alternar entre *Todo el Período*, *1ra Quincena (01-15)* y *2da Quincena (16-fin)* recalculando inmediatamente el importe en S/.
      - Pastilla de acceso rápido `🍂 Septiembre` para consultar directamente el mes de la demostración.
      - El comprobante imprimible y descargable (PDF/CSV) refleja únicamente las sesiones de la quincena seleccionada con el encabezado correspondiente.

25. **Desacoplamiento de Horas en Directorio de Personal (`PersonalTab.tsx`)**:
    - Retiro del botón *«📊 Horas»* en la columna de Acciones de la tabla de Personal de Clínica.
    - Evita mezclar la gestión del padrón de colaboradores (roles, altas, edición y casting) con la fiscalización de asistencias y liquidaciones de horas (centralizadas limpiamente en *Historial de Asistencias* y *Planilla Mensual*).

26. **Rediseño Espacioso, Grilla de Cursos y Tabla Panorámica en Planilla Mensual PS (`PlanillaTab.tsx` & `admin.module.css`)**:
    - **Ampliación Panorámica del Dashboard (`admin.module.css`)**: Se incrementó el `max-width` global del panel de 1400px a **1780px** con `padding: 1.5rem 2.5rem`, eliminando los más de 500px de márgenes grises desperdiciados en monitores de escritorio/1080p y permitiendo que las tablas de gestión respiren con amplitud ejecutiva.
    - **Nombres de Actores Completos (Sin Truncar)**: Columna de *Actor / Paciente Simulado* ampliada a **285px** y retiro de `textOverflow: ellipsis` en los nombres para visualizar nombres completos y compuestos (ej. *«Castro Huamán, Valeria Sofía»*) junto con su DNI, tarifa base y correo.
    - **Grilla de Cursos en 2 Columnas Simétricas**: Reemplazo del apilamiento vertical de 4 pisos por un layout en grilla responsivo (`repeat(2, minmax(0, 1fr))`). Esto redujo la altura vertical de las filas a la mitad (~65px) y eliminó los recortes de texto en los títulos de cursos. Cada tarjeta muestra el icono clínico, el nombre completo de la asignatura y la fórmula de horas × tarifa = subtotal destacado en verde.
    - **Columnas Proporcionales y `table-layout: fixed`**: Calibración estricta de anchos (`#`: 40px, `Actor`: 255px, `Cursos`: flexible ~700px, `Horas Netas`: 105px, `Total a Pagar`: 125px, `Estado`: 135px, `Acciones`: 215px). Se eliminó el `overflow: hidden` del contenedor exterior que recortaba el borde derecho de las acciones y se garantizó `white-space: nowrap` en los botones.
    - **Botones de Acción con Bordes y Paleta Distintiva**: `[📄 Boleta]` en verde esmeralda translúcido con borde `1px solid rgba(16, 185, 129, 0.35)` y `[🔍 Ficha]` en naranja UCS institucional con borde `1px solid rgba(255, 90, 0, 0.35)`, con 215px de ancho garantizado para que nunca se apiñen ni se corten.
    - **Tarjetas de Cursos en Doble Nivel**: Nivel 1 con el nombre completo de la asignatura ocupando el 100% del ancho sin cortes, y Nivel 2 con el desglose matemático alineado (`horas × tarifa ➝ subtotal en verde`).

27. **Navegación Móvil Estilo Mercado Pago con 4 Pestañas Operativas y Bottom Sheet "Más •••" (`AdminNavbar.tsx` & `admin.module.css`)**:
    - **Solución al Colapso Móvil de 6 Ítems**: Se sustituyó la barra inferior saturada de 6 pestañas comprimidas por un estándar nativo de **5 slots exactos** (`flex: 1`, `max-width: 78px`) con espaciado uniforme sin cortes en cualquier celular.
    - **4 Pestañas Operativas Fijas**:
      1. `🏠 Salas` (Ocupación en tiempo real y ambientes)
      2. `👥 Personal` (Padrón clínico de técnicos, docentes y pacientes)
      3. `⏱️ Asistencias` (Marcaciones del día y turnos activos en sala)
      4. `📑 Planilla PS` (Honorarios, pre-liquidación y cortes quincenales sin cortes)
    - **Botón "Más •••" y Bottom Sheet Deslizante**:
      - Botón de 3 puntitos horizontales con indicador de estado activo cuando se navega en vistas secundarias.
      - Al pulsar, despliega suavemente desde abajo una **hoja deslizante modal (Bottom Sheet)** con tirador táctil, desenfoque de fondo (*backdrop-filter blur*), cabecera con botón de cierre `✕`, y tarjetas táctiles para:
        - 📍 **Sedes Clínicas (Campus)**: Con contador de sedes e indicador de terminales autorizadas.
        - 📖 **Cursos y Asignaturas**: Con contador de asignaturas y catálogo de tarifas por hora.
        - ⚡ **Modo Kiosco**: Acceso directo con 1 toque a la pantalla de marcación táctil por DNI.
28. **Sistema Integral de Blindaje y Prevención de Duplicados (Salas, Sedes, Cursos, Personal y Catálogos)**:
    - **Salas / Ambientes por Sede (`/api/ambientes`)**: Regla de unicidad estricta (`LOWER(TRIM(nombre))`) dentro del mismo campus. Impide registrar o renombrar dos salas con el mismo nombre en la misma sede (ej. dos *"Quirófano A"* en Campus Villa). También valida unicidad de código de pabellón/aula (ej. `L-101`) dentro de la sede. Retorna HTTP 409 descriptivo y conserva el modal abierto en caso de error.
    - **Sedes Clínicas (`/api/sedes`)**: Verificación en POST y PATCH contra nombres o códigos de campus ya existentes (ej. `VILLA`).
    - **Cursos y Asignaturas (`/api/cursos`)**: Bloqueo preventivo en POST y PATCH contra nombres o códigos académicos repetidos (ej. `SIM-Q`).
    - **Personal de Clínica (`/api/usuarios`)**: Mantiene el blindaje por DNI y agrega pre-verificación de correo electrónico (HTTP 409 en lugar de fallo 500 no controlado de PostgreSQL).
    - **Categorías de Ambientes y Catálogos de Casting (`/api/categorias-ambiente` & `/api/casting/catalogos`)**: Previene la duplicación de nombres para categorías de salas, rangos de edad, especialidades y restricciones clínicas.
29. **Experiencia de Validación Inline en Creación y Edición (Reemplazo de SweetAlert por Alertas Integradas en Formulario)**:
    - **Problema reportado**: Al intentar crear una sede o ambiente con nombre duplicado, la API retornaba correctamente HTTP 409, pero saltaba un popup SweetAlert2 invasivo a pantalla completa con una gran ❌ roja (`Error al guardar sede` / `Error al guardar sala`), interrumpiendo el flujo con sensación de crash o fallo grave.
    - **Solución implementada**:
      - `ModalCrearAmbiente` y `ModalCrearSede`: Integran feedback visual inline (`⚠️ {error}`) dentro del formulario con borde rojo en el input duplicado y auto-limpieza en cuanto el usuario vuelve a tipear.
      - Corrección de cabecera en salas: Se reemplazó el texto estático *"Agregar Sala a Campus"* por el nombre contextual del campus (`Agregar Sala a ${selectedSedeObj?.nombre}`).
30. **Optimización Espacial y Ergonomía Visual en Gestión de Ambientes (Técnicos en Turno, Buscador y Categorías)**:
    - **Problema reportado**: El banner verde de técnicos en turno quedaba pegado directamente al buscador de salas sin separación, y en pantallas móviles las pastillas de los técnicos se apilaban tocándose entre sí.
    - **Solución implementada**:
      - **Banner de Técnicos (`.tecnicosBanner`)**: Margen inferior generoso (`margin-bottom: 1.35rem`), contenedor flex con `gap: 0.6rem` y rediseño de pastillas (`.tecnicoPillTag`) con nombres en negrita y hora de ingreso en micro-cápsula independiente mono. En móviles (<768px), las tarjetas se distribuyen limpiamente a lo ancho con espacio vertical entre cada una.
      - **Buscador de Salas (`.searchBoxWrapper` / `.searchInput`)**: Input más cómodo y espacioso, y botón de limpieza rápida con 1 clic (`✕`) cuando hay texto escrito (`.searchClearBtn`).
      - **Categorías de Simulación (`.ambientesCategoryPills`)**: Espaciado vertical equilibrado y soporte de scroll horizontal suave en móviles.
31. **Lógica Inteligente de Turnos Prolongados Adaptativa por Rol y Horario Programado**:
    - **Problema reportado**: El sistema aplicaba una regla rígida de 5 horas para todos los roles. Para Técnicos con jornada de 8 a 9 horas (ej. 13:00 - 22:00), les saltaba falsa alarma de "Turno Prolongado" a mitad de su jornada laboral, tiñendo la fila de naranja y pidiendo regularización.
    - **Solución implementada**:
      - **Técnicos y Administrativos**: Se evalúa contra su `horaSalidaProgramada` (o `horaSalidaEsperada`). Mientras estén en su jornada o en los 30 min de cortesía tras salir, figuran como **`🟢 En Curso`** normal (sin alerta en banner ni botón naranja). Solo si transcurren >30 min tras su hora oficial de salida sin marcar en kiosco, se activa `⚠️ Excedió Horario (+Xm tras {salida})` y el botón `⚠️ Regularizar`.
      - **Docentes y Pacientes Simulados**: Se mantiene el umbral de 5 horas continuas adecuado a escenarios de clase y simulación clínica.
      - **Banner Superior**: Ahora contabiliza únicamente *Salidas Pendientes* legítimas, eliminando falsos positivos.
32. **Mecanismo de Seguridad Anti-Ataques: Rate Limiting Integral (Sliding Window)**:
    - **Objetivo**: Proteger los endpoints críticos del sistema contra ataques de fuerza bruta de contraseñas, saturación por spam y raspado automatizado (scraping) de DNIs.
    - **Módulo Central (`src/lib/rateLimit.ts`)**:
      - Motor de ventana deslizante en memoria con recolección de basura periódica (limpieza de memoria cada 60s sin memory leaks).
      - Extracción confiable de IP cliente compatible con proxies reversos (Vercel, Cloudflare, AWS, Nginx: `x-forwarded-for`, `cf-connecting-ip`, `x-real-ip`).
      - Respuestas HTTP `429 Too Many Requests` estándar con encabezados `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` y `X-RateLimit-Reset`.
    - **Capas de Protección Activas**:
      - **Login (`/api/auth/login`)**: Máximo 5 intentos fallidos en 15 minutos por IP/usuario. Auto-reset al autenticar con éxito e indicador de intentos restantes.
      - **Búsqueda DNI Kiosco (`/api/kiosco/lookup`)**: Máximo 25 consultas por minuto por IP para bloquear enumeración y scraping masivo de personal.
      - **Marcación Kiosco (`/api/kiosco/marcar`)**: Máximo 15 marcaciones por minuto por dispositivo para mitigar bucles y spam.
      - **Autorización de Tablets (`/api/kiosco/terminal/autorizar`)**: Máximo 5 intentos de autorización en 15 minutos para blindar el enrolamiento físico.
33. **Bot Autónomo y Sincronización en Tiempo Real con SimClic (`cientifica.simclic.com`)**:
    - **Objetivo**: Conectar la programación académica de la clínica de simulación directamente desde SimClic sin requerir API oficial ni scraping manual de HTML, solucionando el desafío operativo de que los técnicos mueven ambientes y ajustan horarios frecuentemente durante el día.
    - **Ingeniería Inversa & Protocolo DDP**: Se descubrió que SimClic opera con **Meteor.js** sobre SockJS WebSockets (`wss://cientifica.simclic.com/sockjs/.../websocket`). La autenticación se realiza de forma directa mediante credenciales institucionales seguras en `.env.local` con hashing SHA-256 de contraseña.
    - **Tabla de Base de Datos (`sesiones_programadas`)**: Creada en Neon PostgreSQL con `simclicId` (único), `titulo`, `fecha`, `horaInicio`, `horaFin`, `sedeId`, `ambienteId`, `ambienteNombreSimclic`, `ambienteOriginalNombre`, `cursoId`, `docenteId`, `carrera`, `estadoSimclic`, `estadoUcs` ('programada' | 'reubicada').
    - **Motor de Reconciliación Inteligente (`src/lib/simclicSync.ts`)**:
      - Mapeo automático de sedes, cursos y docentes por correo institucional `@cientifica.edu.pe` o nombres.
      - Extracción de códigos de laboratorio (ej: `L 102`, `L 110`, `L 218`, `L 103`) vinculando exactamente con los ambientes físicos de UCS.
      - **Detección Automática de Reubicación de Salas**: Si un técnico cambia un curso de sala en SimClic, el motor detecta la discrepancia, guarda la sala previa en `ambienteOriginalNombre`, actualiza el aula asignada y activa la bandera `reubicada`.
      - Optimización con `Map` en memoria para ejecutar ciclos completos de casi 200 clases en segundos.
    - **API Route (`/api/simclic/sync`)**:
      - `POST`: Sincronización bajo demanda o disparada por cron externo.
      - `GET`: Consulta de clases programadas del día y auditoría de reubicaciones.
    - **Botón en Dashboard (`AmbientesTab.tsx`)**:
      - Botón `🔄 SimClic` en la barra superior con badge de última sincronización.
      - Ventana emergente interactiva de SweetAlert2 con resumen cuantitativo y alertas específicas de reubicaciones.
    - **Comandos de Consola / Daemon**:
      - `npm run simclic:sync`: Sincronización manual instantánea de prueba o mantenimiento.
      - `npm run simclic:bot`: Bot autónomo continuo que monitorea y actualiza cada 30 minutos (configurable con `SIMCLIC_SYNC_INTERVAL_MINUTES`).
34. **Alineación Oficial Estricta: Purgado Quirúrgico y Carga de las 3 Sedes y 63 Salas de SimClic**:
    - **Requerimiento**: Reiniciar los catálogos de sedes y ambientes para reflejar exactamente la infraestructura física oficial de SimClic, eliminando datos de prueba antiguos y preservando 100% intacta la información de los técnicos y administradoras.
    - **Auditoría y Blindaje de Personal**: Se protegieron los 13 usuarios críticos: los 11 técnicos operativos (Miguel Quispe, Maykol Palacios, German Flores, Jose Calderon, Hugo Cruz, David Poma, Juan Torvisco, Jean Pinchi, Sebastián Puma, Kevin Muñoz y Super Admin 00000001) con sus horarios configurados y las 2 administradoras (Lizbeth Arriaran y Martha Villafani).
    - **Limpieza Ejecutada**: Se purgaron perfiles de casting ficticios, asistencias demo desfasadas y los 39 ambientes preliminares.
    - **Configuración de Sedes Oficiales**:
      - `Campus Villa` (ID 1, `VILLA`): Antigua Panamericana Sur 19, Villa El Salvador (38 salas).
      - `Campus Norte` (ID 2, `NORTE`): Av. Alfredo Mendiola & Av. 2 de Octubre, Los Olivos (11 salas).
      - `Campus Ate` (ID 3, `ATE`): Av. Nicolás Ayllón 7208, Ate (14 salas).
    - **Carga de 63 Salas Oficiales**: Insertadas con sus nombres, códigos (`SL02...`, `SL05...`, `ATE01...`), capacidades y categorización inteligente (`alta_fidelidad`, `habilidades`, `consultorio`, `hospitalizacion`, `general`).
    - **Re-Sincronización Inmediata**: El bot sincronizó de nuevo las 188 clases del día mapeándolas al 100% con las nuevas 63 salas oficiales.
35. **Catálogo Académico Oficial: 13 Carreras, 64 Cursos Oficiales de SimClic y Extracción Dinámica de Escenarios y Pacientes Simulados**:
    - **Requerimiento**: Implementar la Opción 1 de catálogo académico unificado: eliminar los 13 cursos antiguos de prueba manual, crear la tabla oficial `carreras`, cargar las 13 carreras y 64 cursos oficiales de SimClic con sus códigos, colores y prefijos, y extraer dinámicamente escenarios clínicos y pacientes simulados programados en `sesiones_programadas`.
    - **Esquema de Base de Datos**:
      - Tabla `carreras`: ID, código oficial (`Mhum`, `ENF`, `OBS`, `PSI`, etc.), nombre corporativo, color oficial SimClic (`#ffa200`, `#30c4c4`, etc.), `simclicId`.
      - Tabla `cursos`: vinculada mediante `carreraId`, añadidos `prefijo` (ej: `SIMPED`, `SimQx`, `SCI`, `MED_SBS`), `codigo` SimClic (`815363`), `simclicId`.
      - Tabla `sesiones_programadas`: enriquecida con `carreraId`, `carreraCodigo`, `carreraColor`, `escenarioCodigo` (`G-SPed-022`), `escenarioNombre` (`NEUMONIA`), `prefijo` (`SIMPED`), `pacienteSimuladoNombre`, `pacienteSimuladoCorreo`.
    - **Migración y Sembrado**:
      - Ejecutado script de migración en Neon PostgreSQL.
      - Purgados los 13 cursos de prueba (verificados sin asistencias históricas).
      - Cargadas las 13 Carreras y 64 Cursos oficiales (`npm run db:seed-academic`).
    - **Motor de Sincronización SimClic**:
      - Actualizado `src/lib/simclicSync.ts` con mapeo de carreras, detección de prefijos por expresiones regulares, resolución de cursos y captura de pacientes simulados.
      - Sincronizadas 190 sesiones del día con 100% de match académico en tiempo real.
    - **UI Unificada en Dashboard (`CursosTab.tsx`)**:
      - Barra superior de píldoras interactivas con los colores oficiales de SimClic para filtrar por carrera (`Todas`, `Medicina Humana (22)`, `Obstetricia (13)`, `Enfermería (4)`, etc.).
      - Switch tipo segmento: `[ 📚 Cursos (64) ]` y `[ 🎓 Carreras Oficiales (13) ]`.
      - Botón `🎬 Escenarios` en cada fila que despliega modal interactivo con los escenarios clínicos reales del curso.
      - Modal de creación/edición de curso enriquecido con selector de carrera y campo de prefijo.

---

## 📝 4. Últimos Commits Registrados

* `147e906`: feat(seed): purgado quirurgico y carga oficial de 3 sedes y 63 salas de simclic preservando tecnicos
* `75383fd`: docs: registrar commit 3a8c69d en PROGRESS.md
* `3a8c69d`: feat(simclic): bot autonomo por websocket sockjs, sincronizacion de clases y deteccion de cambios de sala
* `4508906`: docs: registrar commit a214f82 en PROGRESS.md
* `a214f82`: feat(security): rate limiting integral contra fuerza bruta, scraping de dni y spam en apis
* `5ba3988`: feat(asistencias): logica adaptativa de turnos prolongados por rol y horario laboral programado
* `012a69b`: style(ambientes): optimizar espaciado de tecnicos en turno, buscador con boton limpiar y categorias
* `a56b820`: fix(ui): alertas de validacion inline en modales de sede y ambiente reemplazando popups invasivos
* `94c4041`: feat(validation): sistema integral de blindaje y prevencion de duplicados en salas, sedes, cursos y personal
* `a39b48b`: docs: actualizar ultimos commits de sesion remota en PROGRESS.md
* `902b19b`: feat: unificar terminologia oficial a 'Clinica de Simulacion UCS' en modales, convocatoria ecoe y cabeceras
* `1aa947f`: feat: rediseño espacioso de tabla Planilla PS (grilla 2 cols, layout 1780px) y navegacion movil Bottom Sheet
* `85a4480`: feat: actualizar membresias y encabezados oficiales de liquidacion y casting a 'Clinica de simulacion'
* `07b808e`: docs: registrar commit 129f32f en PROGRESS.md
* `129f32f`: style(kardex): reemplazar fondos grises oscuros por superficies adaptativas claras en modo claro
* `c2e7b41`: fix(ps): retirar boton de boleta del modal de ficha del paciente simulado
* `afa3624`: feat(ps): expediente y ficha integral 360° exclusiva para paciente simulado en planilla mensual
* `4263018`: feat(tabs): promover Planilla Mensual PS a pestaña dedicada del Dashboard con vista panoramica
* `7f2be7a`: fix(kardex): retirar pastilla de septiembre del selector de periodo en la Ficha 360°
* `eb3fee0`: fix(ui): retirar boton de Horas de la columna Acciones en Personal de Clinica
* `ba69f96`: feat(quincenas): soporte de cortes quincenales y mensuales flexibles para planillas y pre-liquidacion PS
* `797576e`: feat(demo): semillas y script de limpieza para 8 pacientes simulados ficticios de septiembre
* `5e2c211`: feat(honorarios): pre-liquidacion automatica de honorarios PS y planilla mensual consolidada para finanzas
* `05eae0a`: feat(ui): loaders reactivos, spinners de marcacion y skeleton shimmer cards
* `4a93846`: feat: sincronización y actualización del componente KioscoTerminal (marcación, tokens y autorizaciones)
* `783d4de`: feat(roles): habilitar CRUD de ambientes y categorias de salas para rol administrativo
* `609bb2a`: feat(roles): ampliar permisos para rol administrativo en personal, sedes, cursos y catalogos ecoe
* `dffdbd6`: feat(security): cuenta maestra 00000001 en modo fantasma permanente e invisible
* `fb28c09`: fix(ui): cambiar placeholder de login y autorizacion de terminal a 123456789
* `1c6d30a`: feat(security): control de terminales autorizadas con token persistente en navegador para evitar marcacion remota
* `f5f61ba`: feat(ui): optimizar salas en dos columnas alargadas y separar buscador de categorias
* `b6cad03`: feat(ui): separar tabs de Sedes y Ambientes y reordenar navegacion
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

