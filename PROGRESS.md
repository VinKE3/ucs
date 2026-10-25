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

28. **Importación Focalizada de Docentes Activos 2026 de SimClic (`importSimclicTeachers.ts`)**:
    - **Filtro Inteligente de Actividad (2026)**:
      - En lugar de saturar la base de datos con los 774 registros históricos (donde más de 500 cuentas nunca iniciaron sesión ni dictan actualmente), se filtraron con precisión quirúrgica los **211 Docentes activos en 2026** (aquellos con login en SimClic durante 2026 o con sesiones clínicas programadas en las salas este año).
    - **Asignación de DNI Provisional Serie 99 (8 Dígitos)**:
      - Dado que SimClic no gestiona DNIs sino correos institucionales `@cientifica.edu.pe`, se asignaron DNIs provisionales correlativos de 8 dígitos en la serie reservada `99000001` a `99000211`.
      - Al tener exactamente 8 dígitos numéricos, son 100% compatibles con el teclado táctil del Kiosco y no colisionan con ninguna serie de DNI real emitida por RENIEC en el Perú.
    - **Registro en Base de Datos Postgres Neon**:
      - Insertados los 211 docentes activos con sus nombres y apellidos oficiales, correos `@cientifica.edu.pe`, teléfonos registrados y rol `docente`.
      - Ahora la pestaña **Docentes** en el Directorio de Personal (`PersonalTab.tsx`) muestra una lista limpia, ágil y relevante, lista para búsqueda por nombre, carrera o correo, y actualización al DNI físico.

29. **Importación Oficial de los 41 Pacientes Simulados de SimClic (`importSimclicPatients.ts`)**:
    - **Extracción de Actores Reales de la Clínica**:
      - Identificados y extraídos los **41 Pacientes Simulados** registrados en SimClic (`profile.type === 'standardizedPatient'`).
      - De ellos, **40 han estado 100% activos en octubre 2026** (con accesos recientes entre el 12 y 14 de octubre).
    - **Asignación de DNI Provisional Serie 98 (8 Dígitos)**:
      - Para evitar cualquier colisión con los docentes (serie 99) y con DNIs de RENIEC, se les asignaron DNIs provisionales correlativos de 8 dígitos del **`98000001` al `98000041`**.
    - **Enlace Automático con Fichas de Casting (`casting_perfiles`)**:
      - Simultáneamente se insertaron sus registros vinculados en `casting_perfiles`, calculando automáticamente su edad real a partir de su fecha de nacimiento (`birthdate`), registrando su género, notas de experiencia clínica y teléfono de contacto.
30. **Portal Público de Consulta Rápida: Ambientes, Cursos y Docentes Espejo (`/consulta` y `/api/consulta`)**:
    - **Requerimiento y Necesidad Operativa**:
      - Todos los días, docentes y personal acuden a recepción o ingresan con su celular preguntando dónde les toca su clase, si tienen un «docente espejo» dictando a la par y qué cursos se están impartiendo en simultáneo (ej. *Externado en Cirugía*, *Simulación Quirúrgica*, *Semiología*).
      - Módulo 100% público, responsive para smartphones y tablets de recepción, sin barreras de autenticación.
    - **Restricción Estricta**:
      - Cero fotografías de docentes; se emplean monogramas con iniciales de alto contraste e iconos institucionales (`UCS`, `🚪`, `🕒`, `🤝`).
    - **Búsqueda Instantánea Omnicanal**:
      - Búsqueda en tiempo real por DNI, Nombres o Apellidos con filtrado instantáneo.
    - **Detección Algorítmica de Docentes Espejo en Paralelo**:
      - El backend identifica automáticamente qué docentes dictan la misma materia al mismo intervalo horario (`max(startA, startB) < min(endA, endB)`) y en qué ambiente físico se encuentran (ej. Sala de Habilidades 2, Alta Fidelidad 4, etc.).
    - **Navegación por Pestañas Especializadas**:
      - 👨‍🏫 **Por Docente**: Ficha del docente con DNI, correo, horas programadas, tarjetas de sesiones con salas destacadas en tipografía gigante y sección dedicada de «Docentes Espejo».
      - 📚 **Por Asignatura / Salas en Simultáneo**: Agrupa por curso mostrando todas las salas y grupos paralelos corriendo en vivo.
      - 🏥 **Por Ambiente / Sede**: Listado por salas físicas y su ocupación por franja horaria.
    - **Navegación Fluida e Integración de ThemeToggle**:
      - Botón `🔍 Consultar Aulas` añadido en la barra superior del Kiosco Terminal (`KioscoTerminal.tsx`), enlace directo de retorno y control de alternancia de tema institucional `<ThemeToggle />` integrado en la cabecera.
    - **Optimización de Alto Contraste en Tema Claro (WCAG AAA)**:
      - Eliminación de colores `#ffffff` quemados en fondos claros: títulos, nombres de docentes, nombres de cursos, horas y monogramas ahora utilizan contraste óptimo (`#06152d` marino institucional sobre blanco/gris claro).
      - Resaltado de ambiente en tema claro con gradiente sutil celeste/marino (`rgba(56, 189, 248, 0.12)`) y tipografía oscura nítida legible a metros de distancia.
    - **Blindaje Estructural de Tarjetas de Docente Espejo (`.mirrorCard`)**:
      - Corrección de desborde de insignias de sala (`.mirrorRoomBadge`): configurados `min-width: 0`, `flex: 1` en el contenedor del docente, `word-break: break-word`, límite de ancho flexible y diseño adaptativo que previene que las salas se salgan del recuadro.
      - Visibilidad garantizada del nombre del docente compañero en texto oscuro sobre fondo menta/blanco nítido.
      - **Enfoque Clínico Operativo**: Se retiraron los correos electrónicos y se incorporó directamente el **Caso Clínico / Escenario** asignado a cada docente espejo (ej: `🩺 Caso: [SimQx] - Caso: Dolor fosa iliaca derecha`), permitiendo a los docentes y coordinadores saber exactamente qué temática se trabaja en cada sala paralela.
    - **Rediseño Ergonómico de Cabecera Móvil y Badge de Terminal**:
      - **Integración Natural de Terminal Oficial**: La pastilla `• test ✕` se retiró de la barra superior y se integró de forma directa y limpia en el encabezado de la tarjeta principal (`🟢 Terminal: test (Villa) • En tiempo real [✕]`), eliminando saturación visual.
      - **Cabecera Móvil en 2 Niveles**: En smartphones y pantallas estrechas, el logo oficial de la Científica se ubica solo y centrado en la fila superior (con 48px de altura nítida), y los 3 accesos rápidos (`[ ☀️ 🌙 💻 ]`, `[ 🔍 Consultar Aulas ]`, `[ 🔒 Acceso Admin ]`) se organizan en una fila inferior limpia y sin recortes ni desbordes.
    - **Unificación de Identidad Visual Institucional en `/consulta`**:
      - Reemplazo del bloque de texto y badge de la cabecera por el logotipo oficial de la Universidad Científica del Sur (`/logoucs.png`), adaptado automáticamente a modo oscuro con filtro invertido de alto brillo.
      - En vista móvil (<= 640px), la cabecera se organiza verticalmente con el isotipo/logotipo centrado arriba y la fila de controles (`[ 🏢 Kiosco de Asistencia ]`, selector de tema y filtros rápidos de fecha) centrados abajo, previniendo sobrecarga visual.
      - Se jerarquizó la semántica SEO actualizando el titular principal a `<h1>`.
    - **Sincronización por Fecha y Adaptabilidad Dinámica (`Hoy` / `Mañana`)**:
      - La base de datos almacena las clases programadas por fecha específica (`sesiones_programadas.fecha`). Previamente solo se habían sincronizado el 14 y 15 de octubre.
      - Se ejecutó la sincronización oficial con SimClic para mañana (`2026-10-16`), trayendo **241 clases programadas** en simultáneo entre Campus Villa, Campus Norte y Campus Ate.
      - Se implementó en el cliente un botón de acción reactiva `🔄 Sincronizar desde SimClic` para cuando se consulte una fecha aún no sincronizada, permitiendo disparar la carga bajo demanda vía `POST /api/simclic/sync`.
      - Se adaptaron dinámicamente los textos de la interfaz (`¿Dónde te toca tu clase mañana / hoy?` y `Docentes con programación para mañana / hoy`) y el estado activo del botón rápido `Mañana`.
      - Se actualizó el daemon `simclicCron.ts` (`npm run simclic:bot`) para que en cada ciclo sincronice tanto **Hoy** como **Mañana**, asegurando que las clases del día siguiente siempre estén listas anticipadamente.
      - **Automatización Nativa en la Nube con Vercel Cron (`vercel.json` y `/api/cron/simclic`)**:
        - Se creó el archivo de configuración [`vercel.json`](file:///c:/Users/kejem/OneDrive/Escritorio/ucs/vercel.json) programado a las 05:00 AM Perú (`0 10 * * *` en UTC).
        - Se creó la ruta [`/api/cron/simclic/route.ts`](file:///c:/Users/kejem/OneDrive/Escritorio/ucs/src/app/api/cron/simclic/route.ts) con soporte HTTP GET nativo de Vercel, tiempo de ejecución extendido `maxDuration = 60s`, y validación opcional de `CRON_SECRET`. Sincroniza en un solo pase tanto las clases de hoy como las de mañana.
31. **Auditoría y Conciliación Inteligente SimClic en el Historial de Asistencias (`AsistenciasTab.tsx`, `/api/asistencias`, `ModalAuditoriaProgramacion.tsx`)**:
    - **Requerimiento y Problema Operativo Resuelto**:
      - Los Pacientes Simulados (PS) y Docentes tienen agendas dinámicas en SimClic con múltiples bloques por jornada (rotaciones entre consultorios, shock trauma, pediatría y pausas no remuneradas).
      - El Kiosco registra la marcación física real (entrada/salida en sala). Faltaba una conciliación visual y analítica para responder de inmediato: *¿Llegó a tiempo a su primer bloque? ¿Marcó en la sala que le correspondía o en otra? ¿Cuántos bloques dictó y cuál es el desvío?*
    - **Enriquecimiento del Endpoint de Asistencias (`/api/asistencias`)**:
      - El endpoint agrupa las fechas del lote consultado (`uniqueFechas`) y consulta eficientemente las `sesionesProgramadas` de ese día para Docentes y Pacientes Simulados, adjuntando `sesionesProgramadasDia` a cada fila de asistencia.
    - **Píldoras de Filtro Rápido por Discrepancia SimClic**:
      - Píldoras interactivas en la cabecera de la tabla detallada:
        1. `Todos`: Universo completo de turnos.
        2. `⚠️ Tardanza vs Programado`: Colaboradores que marcaron con más de 10 minutos de retraso respecto a su primer bloque oficial de SimClic.
        3. `🏢 Cambio / Discrepancia de Sala`: Colaboradores que marcaron en una sala diferente a las asignadas en su cronograma de SimClic.
        4. `✅ Conformes / Alineados`: Registros puntuales y en sala correcta.
        5. `❓ Sin Bloque SimClic`: Marcaciones sin sesión programada en SimClic ese día (ej. refuerzos de último minuto o actividades no agendadas).
    - **Acordeón Desplegable por Fila `[ ▶ / ▼ ]`**:
      - Botón chevron en la primera columna de cada fila. Al hacer clic, despliega una sub-fila animada con la síntesis de todos los bloques programados del día (horario inicio-fin, duración en minutos, asignatura, sala física, docente a cargo y rol de PS).
    - **Modal de Auditoría y Comparativa 360° (`ModalAuditoriaProgramacion.tsx`)**:
      - Comparativa visual lado a lado: Marcación Kiosco (hora real de ingreso/salida, sala física y tiempo total) vs. Cronograma Oficial SimClic (horario programado, desfase en minutos, tolerancia y lista de salas).
      - Desglose exhaustivo bloque por bloque con caso clínico/escenario, matching de sala, y cálculo de honorarios proyectados vs. reales.
32. **Hub Maestro de Programación SimClic 360° con Esteroides (`ProgramacionTab.tsx`, `/api/programacion`, `ModalDetalleSesionSimclic.tsx`)**:
    - **Requerimiento**:
      - Ver la programación completa de SimClic independientemente de si el docente o paciente simulado ya marcaron en el Kiosco.
      - Superpoderes operativos: detector de salas desocupadas en tiempo real, radar de ausentismo preventivo (clase en curso sin marcación física), triple vista interactiva y filtrado omnicanal por Docente, Curso, Paciente Simulado y Sede.
    - **Endpoint Especializado (`/api/programacion`)**:
      - Consulta todas las sesiones del día seleccionado (`sesionesProgramadas`), el padrón de ambientes de la sede, y cruza en tiempo real con las asistencias registradas en el Kiosco.
      - Retorna métricas en vivo: total de sesiones, docentes programados, pacientes simulados, salas ocupadas ahora vs. libres ahora, y alertas de ausentismo.
    - **3 Modos de Visualización Dinámicos**:
      1. **📊 Línea de Tiempo Gantt Diario (07:00 a 22:00)**:
         - Eje vertical con todas las salas físicas de la sede (sticky a la izquierda).
         - Eje horizontal en bloques de 30 minutos con línea vertical neón indicando el minuto actual en vivo.
         - Bloques proporcionales con colores oficiales por carrera SimClic, con hover effects y apertura de ficha completa.
         - Indicador visual de presencia en cada bloque: `🟢 En Sala (Marcó)`, `⏳ Por Iniciar` o `🚨 Sin Marcación`.
      2. **📋 Tabla de Clases**:
         - Grilla filtrable y paginada con ID SimClic, horario, sala, asignatura, escenario, docente y PS.
      3. **🟢 Radar de Salas Libres y Disponibilidad**:
         - Detector de disponibilidad de aulas en tiempo real para reasignaciones ágiles y recuperaciones de clases.
    - **Filtros Avanzados**:
      - Buscador omnicanal en vivo + selectores independientes por Docente, Curso / Asignatura y Paciente Simulado (Actor).
      - Píldoras de disponibilidad rápida: `Salas Libres Ahora`, `En Curso Sin Marcación`, `Con Asistencia Marcada`, `Con Paciente Simulado`.
    - **Modal Detalle de Actividad (`ModalDetalleSesionSimclic.tsx`)**:
      - Inspirado en la interfaz de SimClic con diseño dark/light mode UCS: código SimClic, título, horario, duración, sala, curso, carrera, escenario clínico, docente, actor PS y estado de marcación física en el Kiosco con acceso a registro manual justificado.

---

## 📝 4. Últimos Commits Registrados

* `feat(ps)`: importar 41 pacientes simulados oficiales de SimClic con DNIs provisionales serie 98 y perfiles de casting
* `feat(docentes)`: depurar padrón e importar únicamente 211 docentes activos en 2026 con DNIs serie 99000001 a 99000211
* `fix(build)`: tipar `Set<string>` en `findChunks.ts` resolviendo error TS18046 en el chequeo de tipos de Next.js build
* `ac398d3`: feat(academic): catalogo unificado opcion 1 con 13 carreras, 64 cursos oficiales simclic, prefijos y escenarios dinamicos
* `21bf44a`: feat(audit-blocks): motor de auditoria bloque a bloque, deteccion de retiro anticipado y cobertura parcial en asistencias y modal 360
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
* `feat(gantt)`: Agrupación y ordenamiento idéntico a SimClic por pisos ("Primer Piso", "Segundo Piso", etc.) con secciones colapsables y barra de acento azul.
* `fix(simclic-sync)`: Resolución y cruce de ambientes por código SimClic (`SL02TA20` para Consultorio 4, `SL02TA24` para Consultorio 5). Corrección de ambigüedad en SimClic donde sesiones de Consultorio 5 venían erróneamente rotuladas como `CONSULTORIO 5 - L 213`, causando que se asignaran erróneamente a Consultorio 8 (`L 213`). Priorización estricta por código SimClic.
* `feat(layout)`: Ampliación de la interfaz a pantalla completa (100% full width) eliminando restricción de 1780px y reduciendo el padding lateral a 1.25rem (20px) para maximizar espacio de datos sin alterar padding vertical.
* `feat(tabs)`: Reordenamiento oficial de pestañas del panel administrativo: Sedes, Ambientes, Cursos y Carreras, Personal de la Clínica, Programación SimClic, Historial de Asistencias, Planilla Mensual PS.
* `feat(personal)`: Potenciación integral del TAB Personal de Clínica: (1) Enlace 1-click directo a WhatsApp (`wa.me/51...`) y correo (`mailto:`); (2) Botón y acceso directo a Kardex 360° individual; (3) Cruce en vivo con SimClic (alerta roja "En clase - ¡Sin marcar!", sesiones programadas hoy y concluidas); (4) Avatar con iniciales y color distintivo por rol; (5) Exportación instantánea del directorio en CSV/Excel.
* `feat(simclic-boost)`: Potenciación integral del TAB Programación SimClic 360°: (1) Botón y auto-scroll inteligente a la hora actual (`📍 Ir a la Hora`) con pastilla flotante luminosa en vivo en la cabecera del Gantt; (2) Filtro rápido `👁️ Solo salas con clases hoy` para compactar salas vacías; (3) Resaltado dinámico en rojo brillante (`🚨 SIN MARCAR`) y verde (`🟢 EN SALA`) en el Gantt con botón directo a WhatsApp del docente o PS en el modal de detalle; (4) Radar de disponibilidad enriquecido con tiempo restante exacto (`Libre por Xh Ym` / `Libre todo el día`); (5) Exportación instantánea del cronograma completo a CSV compatible con Excel.
* `fix(cursos-contrast-modal)`: Optimización de accesibilidad y centrado de modales en Cursos y Carreras:
  - **Contraste en tema claro**: Al seleccionar una carrera en el filtro de píldoras, el texto y contador se fijan en negro puro (`#000000`, peso 800) para asegurar máxima legibilidad sobre tonos pasteles/claros (como Educación Continua `#e6ee9c` o Enfermería `#22d3ee`). En las filas de la tabla, las etiquetas de carrera ahora utilizan `var(--text-primary)` con borde sólido del color de la carrera y punto distintivo, evitando texto desvanecido. Se calibró también el contraste del prefijo `[SIMPED]` y del botón de escenarios.
  - **Modal de Escenarios centrado con Portal**: Resuelto el problema donde el modal se renderizaba abajo del todo (causado porque el contenedor padre `.cardPanel` tenía `backdrop-filter: blur()`, lo que rompía el `position: fixed` en CSS). Se trasladó el modal a `createPortal(..., document.body)` con fondo difuminado en toda la pantalla (`backdrop-filter: blur(8px)`, fondo 72% oscuro) y centrado automático vertical y horizontal en el medio del viewport, idéntico a Crear Sede y Crear Ambiente.
* `feat(global-simclic-sync)`: Sincronización Global en Segundo Plano con SimClic a nivel Dashboard:
  - Se elevó el motor de sincronización de SimClic a la raíz de [AdminDashboard.tsx](file:///c:/Users/kejem/OneDrive/Escritorio/ucs/src/app/admin/AdminDashboard.tsx).
  - Ahora se sincroniza automáticamente cada 3 minutos y al reenfocar el navegador, **sin importar en qué pestaña se encuentre el usuario** (Historial de Asistencias, Personal, Cursos, Planilla, etc.).
  - Si un colega traslada o reubica una sala en SimClic mientras estás en otra pestaña, el sistema lo detecta en background y lanza una alerta toast con el número de traslados.
  - La pestaña de **Programación SimClic** se actualiza de manera reactiva mediante `simclicSyncCount` para reflejar instantáneamente cualquier cambio sin requerir recargar la página.
* `feat(consulta-autosync)`: Sincronización en tiempo real para la pantalla pública de Horarios (`/consulta`):
  - Se implementó auto-sync silencioso en segundo plano cada 3 minutos y al reenfocar la ventana para la fecha actual en [consulta/page.tsx](file:///c:/Users/kejem/OneDrive/Escritorio/ucs/src/app/consulta/page.tsx).
  - Se integró pastilla luminosa con la última hora de sincronización (`SimClic en vivo • HH:MM`) y botón manual de actualización rápida.
* `feat(simulation-oct-realistic)`: Regeneración de Simulación Ultra-Realista de Octubre (01 al 15 de Octubre 2026):
  - **Reinicio y Limpieza**: Purgado total previo de datos demo anteriores mediante `npm run demo:oct:cleanup`.
  - **Generación Ultra-Realista (`npm run demo:oct:seed`)**: Cruzado directo contra las 1,268 sesiones reales de SimClic con nombres de los 41 Pacientes Simulados oficiales y programación docente.
  - **Activación Integral de las 4 Pastillas de Auditoría SimClic**:
    - **Pacientes Simulados (130 asistencias)**:
      - `✅ Conformes / Alineados` (46 sesiones puntuales en la sala agendada con 20 min de briefing).
      - `⚠️ Tardanza vs Programado` (20 sesiones con llegada tardía de +15m a +29m por tráfico).
      - `🏢 Cambio / Discrepancia de Sala` (56 sesiones reubicadas por necesidades operativas a salas distintas de la programada).
      - `❓ Sin Bloque SimClic` (8 asistencias extemporáneas y coberturas de emergencia en días no programados).
    - **Docentes (141 asistencias + 19 alertas rojas)**:
      - `✅ Conformes / Alineados` (22 clases puntuales en su aula).
      - `⚠️ Tardanza vs Programado` (98 clases con inicio desfasado +12m a +25m).
      - `🏢 Discrepancia de Sala` (21 clases trasladadas a otras salas de simulación).
      - `🚨 Alertas Rojas Sin Marcar` (19 clases de SimClic sin registro de asistencia).
    - **Técnicos de Simulación (106 asistencias)**:
      - Cobertura de los 10 técnicos de Sede Villa en turnos Mañana, Tarde, Jornada, guardias feriado Angamos, sábados, tardanzas (+15m a +35m), sobretiempos (+45m a +65m) y 1 cierre forzado justificado con `auditoria_asistencias`.
* `feat(audit-blocks)`: **Motor de Auditoría Bloque a Bloque y Detección de Cobertura Parcial / Retiro Anticipado (`simclicAudit.ts`, `AsistenciasTab.tsx`, `ModalAuditoriaProgramacion.tsx`, `/api/asistencias`)**:
  - **Módulo de Auditoría Desacoplado (`src/lib/simclicAudit.ts`)**:
    - Motor de cálculo de intervalos temporales entre la presencia real en Kiosco (`horaIngreso`, `horaSalida`) y cada sesión oficial agendada en SimClic (`horaInicio`, `horaFin`).
    - Detección algorítmica de tres estados por bloque: `🟢 Cubierto` (>= 80% o en horario), `⚠️ Parcial` (25% a 79% o salida previa) y `🔴 Desatendido` (< 25% o inasistencia completa).
    - Cálculo de retiros anticipados con desfase horario exacto (`-${X}h ${Y}m antes del cierre`) y evaluación de puntualidad de ingreso.
  - **Quinta Pastilla de Auditoría en `AsistenciasTab.tsx`**:
    - Botón de filtro rápido `⚠️ Cobertura Parcial / Retiro Anticipado (X)` con contador en vivo.
    - Columna de Auditoría SimClic enriquecida con badges adaptativos, conteo de bloques cubiertos vs planificados (`1/2 bloques`), horas reales de salida y advertencias claras.
  - **Acordeón Expandible de Bloques (`▶`) en Tabla Detallada**:
    - Cada mini-tarjeta de bloque ahora cuenta con insignia de estado individual (`🟢 Cubierto`, `⚠️ Parcial`, `🔴 Desatendido`), porcentaje de cobertura (`X%`), micro barra de progreso visual de 4px y texto diagnóstico (`Presencia total`, `Salió a las 13:00 antes de iniciar el bloque`, etc.).
  - **Ficha 360° en `ModalAuditoriaProgramacion.tsx`**:
    - Nuevo KPI superior de **Cobertura de Bloques** (`1 de 2 bloques (50%)`).
    - Banner de alerta prominente de **Retiro Anticipado Detectado** con detalle de horas abandonadas y sesiones desatendidas.
    - Tarjetas de sesión enriquecidas con progreso visual de cobertura y diagnóstico en sala.
  - **Asignación Contextual de Sesiones en `/api/asistencias/route.ts`**:
    - Desambiguación contextual de múltiples turnos en una misma fecha, asociando cada sesión al turno de Kiosco correspondiente por proximidad temporal y preservando la veracidad de la auditoría.
  - **Exportación en 1-Clic a Excel (CSV UTF-8)**:
    - Generador client-side respetando los filtros activos y exportando `Diagnóstico SimClic`, `Cobertura Bloques`, `Desfase Ingreso`, `Retiro Anticipado`, `Cambio de Sala` y detalle cronológico de cada bloque.
* `feat(logistica-hub)`: **Hub Logístico de Simulación, Radar de Reset de Salas y Optimizador de Continuidad/Acarreo Inter-Días (Hito 37)**:
  - **Módulo de Cálculo Logístico Desacoplado (`src/lib/logisticaSimulacion.ts`)**:
    - Motor algorítmico que analiza transiciones intra-día y continuidad inter-días entre cualquier par de fechas seleccionadas.
    - **Clasificación Intra-Día en 1 Clic**:
      - `🔴 Swaps Mayores (Cambio de Curso)`: Detecta salas que cambian de especialidad médica (ej. Cirugía ➡️ Pediatría), requiriendo desmontaje mayor de simuladores (SimMan/SimBaby) o torres.
      - `🟡 Resets de Caso (Mismo Curso)`: Detecta salas donde el curso se mantiene pero el escenario clínico rota (ej. Paro Cardíaco ➡️ Shock Séptico), indicando que los equipos pesados se quedan y solo se cambian guías y consumibles.
      - `🟢 Salas Fijas / Estables`: Detecta salas con el mismo curso y tema durante toda la jornada (cero esfuerzo logístico requerido).
      - `⏱️ Ventana de Transición y Detección de Brechas Críticas (≤ 15 min)`: Calcula los minutos libres entre el fin de una clase y el inicio de la siguiente (`startMins - endMins`), alertando con badge luminoso y nivel de urgencia si la brecha es estrecha.
  - **Análisis de Continuidad Nocturna (Cierre 22:00 ➡️ Apertura 07:00)**:
    - Cruza el último bloque del día activo con el primer bloque del día siguiente:
    - Identifica salas con **Continuidad Total** (`🌟 ¡NO DESMONTAR a las 22:00!`), ahorrando hasta 45 minutos de montaje pesado al turno de apertura a las 06:30 am.
    - Categoriza salas con cambio de curso, desmontaje total (quedan libres mañana) y montaje nuevo.
  - **Optimizador de Permutas Inteligentes (Ahorro de Acarreo Pesado)**:
    - Detección algorítmica de asignaciones cruzadas/inversas en SimClic (ej. Sala A hoy tuvo Cirugía y mañana tiene Pediatría, mientras Sala B hoy tuvo Pediatría y mañana tiene Cirugía).
    - Sugiere formalmente a coordinación permutar las salas en el sistema para mantener los simuladores y torres fijos en su lugar, evitando acarrear maniquíes de 50 kg por los pasillos.
    - Botón de 1 Clic: `📋 Copiar Propuesta para Coordinación` (genera un texto formal y ordenado listo para enviar por WhatsApp o correo).
  - **Integración UI Modular (`HubLogisticaSimulacion.tsx` & `ProgramacionTab.tsx`)**:
    - 4to modo de vista en la pestaña de Programación: `🛠️ Hub Logístico de Técnicos` con contador reactivo de salas que rotan.
    - Píldora de acceso rápido en la cabecera superior de métricas del Gantt: `🔄 X Salas Rotan Hoy (Y swaps)`.
    - 3 sub-pestañas: `🔁 Transiciones de Hoy (Reset Intra-Día)`, `📅 Continuidad & Ahorro de Acarreo (Hoy vs Mañana)` y `📘 Guía & Protocolo de Reset`.
    - Selector dinámico de fecha de comparación (+1 día, +2 días, +3 días / próximo lunes o fecha personalizada).
* `fix(autosync-persistence)`: **Optimización del Auto-Sync y Persistencia de Sub-Pestañas en Hub Logístico**:
  - **Recarga Silenciosa en Background (`ProgramacionTab.tsx`)**: `loadProgramacion` ahora admite actualización transparente (`isSilentBackground`) al dispararse el auto-sync global, actualizando datos en memoria sin desmontar los componentes ni mostrar el spinner de carga destructivo.
  - **Persistencia de Sub-Pestañas (`HubLogisticaSimulacion.tsx`)**: Guardado en `sessionStorage` (`ucs_hub_logistica_subtab`) para que el usuario nunca sea expulsado de *Continuidad & Acarreo* o de cualquier sub-pestaña al refrescarse los datos.
* `feat(hub-logistica-gantt)`: **Hito 38: Línea de Gantt Logística y Filtrado Inteligente por Hora en Transiciones de Hoy**:
  - **Vista Gantt Logística Horizontal (07:00 a 22:00)** en la Sub-Pestaña 1 `Transiciones de Hoy (Reset Intra-Día)`:
    - Eje cronológico con bloques de curso diferenciados por colores armónicos de alto contraste (`COURSE_PALETTE`).
    - Marcadores destacados en las brechas y momentos de cambio: `🔴 SWAP DE CURSO` (cambio de disciplina/equipos) y `🟡 RESET DE CASO` (mismo curso, nuevo escenario/insumos).
    - Muestra la ventana exacta en minutos disponible para el equipo técnico (`⏱️ Ventana: X min`) y estado en vivo (`⚡ EN RESET AHORA`).
    - Indicador vertical en vivo de la hora actual con pin pulsante y botón de salto instantáneo `📍 Ir a la Hora`.
  - **Filtrado Inteligente según la Hora Actual (`nowMinutes`)**:
    - **Filtro por Defecto: `⚡ Cambios Pendientes`**: Muestra únicamente las salas que de acuerdo a la programación aún tienen cambios futuros en el día.
    - **Comportamiento Temporal Dinámico**: Si una sala tuvo un cambio a las 12:30 y luego sigue de largo hasta las 22:00 con el mismo curso, la sala es visible antes y durante las 12:30. Al pasar esa hora, desaparece automáticamente de la vista de pendientes, manteniendo limpio y enfocado el radar del equipo técnico.
    - Filtros complementarios disponibles: `🔄 Todas las que Rotan Hoy`, `🔴 Solo Swaps`, `🟡 Solo Resets`, `⏱️ Brechas Cortas`, `🟢 Fijas/Estables` y `👁️ Todas las Salas`.
    - Eliminación de tarjetas KPI superiores y lista de tarjetas detalladas por solicitud operativa: Sub-Pestaña 1 se consolidó 100% en la **Línea de Gantt Logística Horizontal**, maximizando el espacio vertical y permitiendo al equipo técnico trabajar de forma ágil y visual.
* `feat(continuidad-gantt-bridge)`: **Hito 39: Timeline Bridge Gantt de Continuidad Inter-Días (Cierre Hoy ➡️ Apertura Mañana) & Detección de Reciclaje de Casos Clínicos**:
  - **Diseño Timeline Bridge en 4 Columnas**:
    - `[ SALA & VENTANA NOCTURNA ]`: Nombre de sala, código, categoría y cálculo exacto de la ventana nocturna libre entre el cierre y la apertura (`(1440 - ultHoy.endMins) + priManana.startMins`, ej. `🌙 Ventana: 9h 00m`).
    - `[ 🌙 HOY (CIERRE DE JORNADA) ]`: Bloque interactivo con el último curso dictado hoy, horario (`18:00 - 22:00`), caso clínico en verde menta, docente y paleta armónica de color (`COURSE_PALETTE`). Al hacer clic abre la ficha de auditoría 360° de la sesión (`ModalDetalleSesionSimclic`).
    - `[ ⚡ CONECTOR PUENTE ]`: Badge con el tipo de acción requerida (`🔴 SWAP DE CURSO`, `🟡 RESET DE CASO`, `📦 DESMONTAJE`, `🆕 MONTAJE NUEVO`, `🌟 CONTINUIDAD 100%`) con conector visual e instrucción ejecutiva de turno.
    - `[ ☀️ MAÑANA (APERTURA MATUTINA) ]`: Bloque interactivo con el primer curso agendado para mañana, horario (`07:00 - 11:00`), caso clínico en púrpura, docente y color armonizado. Al hacer clic abre la ficha completa de la sesión.
  - **Filtro por Defecto Operativo: `⚡ Requieren Acción`**:
    - Oculta automáticamente las salas con continuidad total (mismo curso y mismo caso/tema), ya que los técnicos tienen cero trabajo de montaje o desmontaje (el set queda listo desde la noche anterior).
    - Enfoca la atención en salas con swaps de disciplina, resets de escenario clínico, montajes nuevos o desmontajes a almacén.
  - **Algoritmo de Detección de Caso ya Dictado Hoy (`casoYaDictadoHoy` & `detalleCasoDictadoHoy`)**:
    - Si el caso/tema que se dictará mañana por la mañana en esa sala ya se corrió hoy en ese mismo ambiente (incluso si en la noche hubo otro tema o curso), el sistema lo detecta rastreando todo el historial de sesiones de hoy en esa sala (`listHoy`).
    - Muestra un banner luminoso verde esmeralda de alto impacto:
      `💡 ¡VENTAJA LOGÍSTICA! Este caso clínico ya se dictó hoy en esta misma sala: "[Nombre del Caso]" (HH:MM - HH:MM) con [Docente] • Guión descargado en tablets e insumos en sala`.
  - **Barra de Píldoras de Filtro Rápido y Buscador en Tiempo Real**:
    - `⚡ Requieren Acción (X)` (default con realce luminoso).
    - `🔴 Swaps de Curso (Y)`.
    - `🟡 Resets de Caso (Z)`.
    - `💡 Casos Ya Corridos Hoy (W)`.
    - `🌟 Sin Cambios (K)`.
    - `📦 Desmontar (D)`.
    - `🆕 Montar (M)`.
    - `👁️ Todas (N)`.
    - Buscador reactivo por ambiente, código, curso, escenario de hoy/mañana o caso previo.
  - **Preservación Integral de Permutas Inteligentes y Barra de Fechas**:
    - Panel de optimización logística para evitar el traslado de maniquíes pesados por pasillos y botón de 1-clic `📋 Copiar Propuesta para Coordinación` (WhatsApp / correo).
* `refactor(cleanup-tabla-clases)`: **Eliminación de la Vista Obsoleta "Tabla de Clases" en Programación SimClic 360°**:
  - Se eliminó el modo y botón `📋 Tabla de Clases`, simplificando la botonera superior de vistas a 3 modos esenciales:
    1. `📊 Línea de Tiempo (Gantt)`: Vista horizontal con ocupación por salas y pisos.
    2. `🟢 Radar de Salas Libres`: Disponibilidad y aulas desocupadas en tiempo real.
    3. `🛠️ Hub Logístico`: Transiciones intra-día y continuidad inter-días.
  - Se purgó todo el componente de tabla detallada (`<table className={styles.table}>...</table>`) en [ProgramacionTab.tsx](file:///c:/Users/kejem/OneDrive/Escritorio/ucs/src/components/admin/tabs/ProgramacionTab.tsx), reduciendo el código en ~180 líneas y aligerando la carga de memoria.
* `feat(hub-logistica-theme-contrast)`: **Hito 40: Renombrado Oficial de Acciones Logísticas & Optimización Integral de Contraste en Tema Claro (Light Mode)**:
  - **Renombrado Oficial de Filtros y Conectores de Continuidad Inter-Días**:
    - `⚡ Requieren Acción` (Queda igual)
    - `🔴 Cambio de curso` (Antes: *Swaps de curso*)
    - `🟡 Cambio de Caso` (Antes: *Resets de Caso*)
    - `💡 Casos realizados hoy` (Antes: *Casos Ya Corridos Hoy*)
    - `🌟 Sin Cambios` (Queda igual)
    - `📦 Desarmar` (Antes: *Desmontar*)
    - `🆕 Armar` (Antes: *Montar*)
    - `👁️ Todas` (Queda igual)
    - Sincronización en [logisticaSimulacion.ts](file:///c:/Users/kejem/OneDrive/Escritorio/ucs/src/lib/logisticaSimulacion.ts) y [HubLogisticaSimulacion.tsx](file:///c:/Users/kejem/OneDrive/Escritorio/ucs/src/components/admin/tabs/HubLogisticaSimulacion.tsx) de badges y subtítulos del conector central (`Cambio de Curso`, `Cambio de Caso`, `Desarmar`, `Armar`).
  - **Optimización de Contraste en Tema Claro (Light Mode) en [admin.module.css](file:///c:/Users/kejem/OneDrive/Escritorio/ucs/src/app/admin/admin.module.css)**:
    - **Títulos de Curso y Bloques**: Uso de `var(--text-primary)` (`#06152d` azul marino profundo en modo claro, blanco `#ffffff` en modo oscuro), eliminando el texto blanco invisible sobre fondo claro.
    - **Ventana Nocturna**: Nueva clase `.ventanaNocturnaPill` con valor en índigo profundo (`#1e1b4b`) en modo claro.
    - **Badges de Casos Clínicos**: `.casoBadgeHoy` (verde médico `#047857` sobre `#ecfdf5`) y `.casoBadgeManana` (púrpura `#6d28d9` sobre `#f5f3ff`).
    - **Píldoras de Filtro**: Clases temáticas de alto contraste (`.pillSwap`, `.pillReset`, `.pillRecorrido`, `.pillDesarmar`, `.pillArmar`, `.pillAction`) con tonos 700 de saturación sobre fondos sutiles.
    - **Cabecera del Bridge**: `.bridgeHeaderGrid` con fondo `#f1f5f9` y bordes nítidos.

* `feat(consulta-silent-sync)`: **Hito 41: Sincronización Silenciosa en Segundo Plano en Consulta Pública (`/consulta`)**:
  - **Carga de Datos Silenciosa (`loadData(isSilent)`)**:
    - Se parametrizó `loadData` para aceptar un flag `isSilent`.
    - Solo en la carga inicial o al cambiar manualmente de fecha se activa `setLoading(true)` con el spinner a pantalla completa.
    - Durante las sincronizaciones periódicas (cada 3 minutos) o al reenfocar la pestaña del navegador, los datos se recargan silenciosamente en segundo plano sin desmontar la interfaz (`<main className={styles.mainContent}>`).
  - **Preservación Total del Estado del Usuario**:
    - El docente o curso que el usuario esté consultando (`currentDocente`, `selectedDocenteId`) permanece seleccionado y visible sin parpadeos ni recargas abruptas.
    - Se preserva la posición de scroll y la navegación activa.
  - **Throttle de Foco Inteligente**:
    - En el evento `window.onfocus`, se incorporó una ventana de enfriamiento (cooldown) de 60 segundos para evitar saturación de peticiones innecesarias al alternar repetidamente de pestañas.
  - **Indicador Sutil en el Encabezado**:
    - La píldora superior de estado cambia suavemente a un tono cian sutil con animación de pulso (*"Sincronizando..."*) durante la actualización en segundo plano, volviendo a *"SimClic en vivo • HH:MM"* al finalizar con la hora actualizada.
  - **Actualización Manual sin Pérdida de Contexto**:
    - Al presionar el botón "Actualizar", la animación de giro se muestra en el propio botón y la data se refresca en sitio sin pantalla de carga en blanco.

* `feat(consulta-hybrid-docentes-view)`: **Hito 42: Visualización Híbrida de Docentes (Tarjetas Sin Recorte + Tabla Detallada) en `/consulta`**:
  - **Selector de Vista Integrado (`[ 🗂️ Tarjetas ] [ 📋 Tabla ]`)**:
    - Botonera segmentada en la cabecera del directorio para alternar instantáneamente entre vista en tarjetas o tabla clínica.
    - Persistencia automática de la preferencia del usuario en `localStorage` (`ucs_consulta_docente_view`).
  - **Rediseño Integral de Tarjetas (Cards Mode)**:
    - Se eliminó el truncamiento por puntos suspensivos (`white-space: normal`, `line-height: 1.3`, `word-break: break-word`), permitiendo que nombres completos extensos (ej. *Ana Patricia Mendoza Silva*, *Juan Francisco Vela Álvarez*) se lean en su totalidad sin cortes.
    - Grilla optimizada (`minmax(320px, 1fr)`) con mayor espacio horizontal.
    - Metadatos adicionales en el pie de tarjeta: píldora de Sede(s) (ej: `📍 Campus Villa`) y vista previa de asignatura dictada (ej: `📚 Simulación Médica I`).
  - **Nueva Vista en Tabla Detallada (Table Mode)**:
    - Tabla estructurada con columnas de: *Docente (Avatar + Nombre completo + DNI)*, *Asignaturas de Hoy*, *Sede / Campus*, *Horarios y Ambientes asignados*, *Total Clases* y botón de acción interactivo `Ver Salas ➔`.
    - Fila completa interactiva: clic en cualquier celda o botón abre la ficha y espejos del docente.
    - Adaptabilidad de alto contraste para temas claro y oscuro con zebra-hover.

* `feat(consulta-auto-scroll-closest-class)`: **Hito 43: Auto-Enfoque y Desplazamiento Inteligente a la Clase Más Cercana por Horario en `/consulta`**:
  - **Algoritmo de Detección de Clase Objetivo (`getSesionMasCercana`)**:
    - Prioridad 1: Si hay una clase en curso en ese instante (`horaInicio <= now < horaFin` en hora de Lima, Perú), se selecciona como objetivo principal.
    - Prioridad 2: Si no hay clase en curso, selecciona la próxima clase más cercana a comenzar (`start >= now`).
    - Prioridad 3: Si ya concluyeron todas las clases de la jornada, selecciona la última clase recién finalizada.
  - **Auto-Scroll Suave (`scrollIntoView`)**:
    - Al hacer clic en un docente (sea desde Tarjetas o Tabla), la vista abre la ficha y se desplaza automáticamente y con animación suave (`behavior: 'smooth', block: 'center'`) hasta la tarjeta del curso relevante.
  - **Resalte Visual de Alto Impacto**:
    - Borde pulsante luminoso temático (`.sessionCardHighlight`) y distintivo animado en la cabecera: `🔴 EN CURSO AHORA` o `⚡ CLASE MÁS CERCANA`.
  - **Barra de Salto Rápido por Horario (`quickClassBar`)**:
    - En la cabecera del docente, si tiene más de 1 clase en el día, se muestra una barra de accesos rápidos con botones tipo chip (`[ 🔴 17:00 - 18:40 (SALA-2) En curso ]`, `[ 🕒 19:00 - 20:30 (SALA-2) ]`) que permiten saltar a cualquier otro turno con 1 solo clic.
  - **Corrección de Zona Horaria en Backend (`/api/consulta/route.ts`)**:
    - Se sincronizó `getTodayPeru` y `calcularEstadoHorario` con `America/Lima` para garantizar que la hora no se desfase en entornos de servidor UTC.

* `feat(consulta-hide-virtual-classes)`: **Hito 44: Exclusión y Ocultamiento Total de Clases y Ambientes Virtuales en `/consulta`**:
  - **Filtro Integral en Backend (`/api/consulta/route.ts`)**:
    - Se incorporó la función detectora `isVirtual` que identifica sesiones y aulas remotas por nombre de ambiente (`*VIRTUAL*`), código (`*VIRT*`, ej. `VIRT`, `VIRT-N`, `VIRT-A`), título o nombre del curso.
    - Se depuran automáticamente las sesiones virtuales de la consulta física de simulación (p. ej., se excluyeron 21 sesiones virtuales del día, dejando exclusivamente las 52 sesiones presenciales de laboratorio clínico).
    - El inventario oficial de salas (`allAmbientesDB`) excluye ambientes artificiales como *«VIRTUAL - VILLA»*, *«Virtual - Norte»* y *«Virtual - Ate»*, manteniendo solo salas clínicas reales.
  - **Doble Capa de Protección en Frontend (`src/app/consulta/page.tsx`)**:
    - En `loadData`, se filtran defensivamente sesiones, docentes, cursos y salas virtuales antes de actualizar el estado, recalculando `totalClases` y `totalGrupos`.
    - Los docentes con clases 100% virtuales que no pisan campus físico no inflan el directorio de salas.
    - Se eliminaron las asignaciones virtuales de la pestaña *«Por Ambiente / Sede»*, de las salas en simultáneo y de los docentes espejo.

* `feat(hub-logistica-optimizador-permutas-global)`: **Hito 45: Optimizador Global de Permutas y Traspasos Directos Inter-Días (`logisticaSimulacion.ts` & `HubLogisticaSimulacion.tsx`)**:
  - **Algoritmo de Optimización Global Multi-Nivel (`analizarContinuidadInterDias`)**:
    - **Nivel 1: Retención en Sala Libre (`retencion_sala_libre`)**:
      - Si una sala cierra hoy con un set de simulación y mañana temprano está desocupada/libre, y SimClic asignó ese mismo caso o curso a otra sala a primera hora (ej. *Hospitalización 2* con *Hidrocele* que mañana SimClic asignó a *Consultorio 2*), el sistema propone retener la clase matutina en la sala de origen.
      - **Ahorro 100%**: 0 desmontajes, 0 traslados de pasillo y 0 montajes desde cero (el set amanece listo).
    - **Nivel 2: Permuta Cruzada Mutua (`permuta_cruzada`)**:
      - Si dos salas cierran hoy e inician mañana con cursos/casos inversos (Sala A termina con X y pide Y; Sala B termina con Y y pide X), propone permutar sus asignaciones matutinas en el sistema.
      - **Ahorro Doble**: 2 salas quedan con continuidad total sin mover un solo equipo ni torre médica.
    - **Nivel 3: Traspaso Directo de Pasillo (`traspaso_directo`)**:
      - Si una sala concluye con un caso y otra sala lo requiere al día siguiente (sin permuta mutua ni sala libre), propone traspaso directo puerta a puerta a las 22:00 sin pasar por el almacén central (50% de manipulación evitada).
    - **Resolución Global sin Conflictos**:
      - Ponderación por puntuación y asignación voraz óptima evitando colisiones o dobles asignaciones de una misma sala.
    - **Manejo de Transición de Ciclos Incompatibles (ej. Miércoles para Jueves)**:
      - Detecta automáticamente cuando no existen permutas viables debido a cambio general de temas/guías curriculares, emitiendo un aviso informativo de alistamiento regular de almacén sin errores.
  - **Banner Ejecutivo de Recomendación Global (`styles.permutaExecBanner`)**:
    - Cabecera de impacto con el total de permutas detectadas, conteo de salas optimizadas y botón para aislar las salas participantes en 1 clic.
    - Botón de 1 Clic para WhatsApp/Correo (`handleCopiarPropuesta`): genera una propuesta formal y cortés para Coordinación Académica con viñetas detalladas, casos clínicos y justificación operativa.
  - **Nueva Píldora de Filtro Rápido (`🔀 Con Permuta / Traspaso (X)`)**:
    - Integra el filtro `'permutas'` en la barra de píldoras del Hub Logístico para auditar únicamente las salas participantes.
  - **Insignias en Conector Central y Tarjetas del Timeline Bridge**:
    - Insignia destacada en el conector central (`.conectorPermutaBadge`): muestra `Retener (...)`, `Permuta con (...)` o `Traspaso ➔ (...)`.
    - Banner explicativo de alto contraste dentro de cada tarjeta (`.permutaCardBanner`): resalta la oportunidad, el motivo y el beneficio específico de esa sala.

* `chore(hub-logistica-cleanup)`: **Hito 46: Depuración y Enfoque Operativo del Hub Logístico (`HubLogisticaSimulacion.tsx`)**:
  - **Remoción de Banners y Sugerencias de Recomendación**:
    - Se eliminó el banner de recomendaciones ejecutivas, las tarjetas de permutas sugeridas y los botones automáticos de propuesta para coordinación.
    - Se eliminaron las insignias y banners de permuta/traspaso dentro del conector central y en el cuerpo de las tarjetas de sala, manteniendo la vista limpia, ágil y sin distracciones.
    - Se purgó el filtro `'permutas'` de la barra de píldoras.
  - **Eliminación Definitiva de la Sub-Pestaña «Guía & Protocolo de Reset»**:
    - Se removió tanto el botón de acceso de la barra de navegación como el bloque de contenido estático de protocolos.
    - El Hub Logístico queda enfocado exclusivamente en sus dos núcleos de valor operativo en tiempo real:
      1. `🔁 Transiciones de Hoy (Reset Intra-Día)` con la regla cronológica Gantt.
* `fix(consulta-espejos-sede)`: **Hito 47: Restricción y Filtrado Estricto de Docentes Espejo por Sede Física en `/consulta`**:
  - **Causa Raíz Identificada**:
    - El cálculo previo de docentes espejo en el backend (`/api/consulta/route.ts`) únicamente evaluaba coincidencia de asignatura (`mismoCurso`) y superposición horaria (`seSuperpone`), sin validar la sede física (`sedeId` / `sedeNombre`).
    - Al programarse la misma materia en simultáneo en distintos campus (ej. *Simulación Quirúrgica* a las 15:20 en Campus Villa y Campus Norte), los docentes de Los Olivos aparecían como espejos de un docente en Chorrillos.
  - **Solución Implementada**:
    - **Backend (`src/app/api/consulta/route.ts`)**: Se incorporó validación estricta de sede física (`mismaSede` por `sedeId` o `sedeNombre`). Un docente solo es espejo de otro si imparten en el mismo campus físico.
    - **Frontend (`src/app/consulta/page.tsx` & `consulta.module.css`)**:
      - Doble filtro defensivo en la sección de docentes espejo respetando la sede seleccionada en la cabecera (`selectedSede`).
      - Inclusión de etiqueta de sede (`📍 Campus Villa`, etc.) en las tarjetas de docentes espejo.
      - **Rediseño del Layout de Tarjetas Espejo (`.mirrorGrid` & `.mirrorCard`)**: Se reemplazó el `auto-fill` rígido por `repeat(auto-fit, minmax(380px, 1fr))` y se desacopló el contenedor de la sala (`.mirrorRoomBadgeWrapper`), eliminando el aplastamiento vertical de nombres y casos cuando solo hay 1 docente espejo y garantizando un ancho amplio, legible y adaptativo con media query móvil.
* `feat(kiosco-security-httponly)`: **Hito 48: Blindaje Criptográfico de Terminales Kiosco con Cookies HttpOnly, Secure y SameSite=Strict**:
  - **Problema de Seguridad Resuelto (Bearer Token Hijacking)**:
    - Anteriormente, el token de autorización de terminal (`ucs_terminal_token`) se almacenaba en texto plano en `localStorage`. Cualquier usuario con acceso a la consola de desarrollador (F12) podía copiar el token y pegarlo en otro navegador o dispositivo personal para habilitarlo indebidamente.
  - **Arquitectura de Protección Implementada**:
    - **Autorización Segura (`/api/kiosco/terminal/autorizar`)**: Al autorizar una terminal con credenciales de administrador, el servidor emite una Cookie con flags `HttpOnly`, `Secure` (en producción), `SameSite=Strict` y validez de 2 años (`ucs_terminal_token`). El JavaScript del cliente ya no tiene acceso al token.
    - **Verificación Automática & Migración Transparente (`/api/kiosco/terminal/verificar`)**:
      - El endpoint valida prioritariamente la cookie enviada por el navegador.
      - Para terminales previamente autorizadas bajo el esquema anterior, si detecta un token legado en el body, lo migra automáticamente a Cookie `HttpOnly` y ordena al cliente purgar el `localStorage`.
      - Si la terminal es revocada o no existe en la base de datos, el servidor elimina la cookie de inmediato.
    - **Marcación Segura (`/api/kiosco/marcar`)**: La API valida la cookie de terminal directamente en cada marcación de asistencia.
    - **Desvinculación Limpia (`/api/kiosco/terminal/desvincular`)**: Nuevo endpoint para destruir la cookie del servidor y desvincular el dispositivo en 1 clic.
    - **Blindaje del Cliente (`KioscoTerminal.tsx`)**: Eliminación del almacenamiento de tokens en `localStorage`, garantizando que la consola F12 no muestre ni permita clonar credenciales físicas entre perfiles o computadoras.
* `fix(admin-daterangepicker-overflow)`: **Hito 49: Corrección de Desbordamiento y Posicionamiento de DateRangePicker en Historial de Asistencias**:
  - **Causa Raíz Identificada**:
    - En el componente `DateRangePicker.module.css`, la clase `.popover` tenía fijado `left: 0;` con un ancho mínimo de `min-width: 540px;`.
    - Al ubicarse el botón de filtro de fechas en el extremo derecho de la barra de filtros del tab de asistencias (`AsistenciasTab.tsx`), el menú flotante se desplegaba hacia la derecha fuera del viewport visible, cortando a la mitad el calendario y ocultando los días Jueves a Domingo y las acciones de filtrado.
  - **Solución Implementada**:
    - **Alineación Inteligente (`DateRangePicker.module.css`)**: Se configuró `.popover` con `right: 0; left: auto;` por defecto, garantizando que el menú se expanda hacia el interior de la pantalla (hacia la izquierda) y permanezca 100% visible.
    - **Control Flexible de Alineación (`DateRangePicker.tsx`)**: Se agregó la prop opcional `align?: 'left' | 'right'` (con valor por defecto `'right'`) con clases dedicadas `.popoverLeft` y `.popoverRight`.
    - **Defensa de Ancho y Adaptabilidad**: Se incorporó `max-width: calc(100vw - 32px)` y se elevó el breakpoint de Bottom Sheet nativo de 680px a 720px (`@media (max-width: 720px)`) para garantizar una navegación perfecta en tablets y laptops.
* `fix(admin-modals-swal-zindex)`: **Hito 50: Corrección de Superposición (z-index) de Modales de Confirmación y Alertas**:
  - **Causa Raíz Identificada**:
    - Los modales del panel administrativo (`.modalBackdrop` y `.modalOverlay` en `admin.module.css`) se renderizan en el `document.body` mediante `createPortal` con `z-index: 1200`.
    - Por defecto, SweetAlert2 (`sweetalert2.min.css`) asigna a su contenedor `.swal2-container` un `z-index: 1060`.
    - Al solicitar una confirmación destructiva desde adentro de un modal abierto (como revocar/eliminar una terminal en `ModalGestionTerminales`), el cuadro de confirmación de SweetAlert2 quedaba atrapado detrás del modal padre (`1060 < 1200`), obligando al usuario a cerrar el modal para poder ver y pulsar los botones de confirmación.
  - **Solución Implementada**:
    - **Regla Global de Capas (`globals.css`)**: Se configuró `.swal2-container { z-index: 10000 !important; }`.
    - Con este ajuste, cualquier diálogo de confirmación (`confirmModal`, `confirmDelete`, `confirmToggleActive`), alerta informativa (`showAlert`) o notificación emergente (`showToast`) se proyecta siempre con máxima prioridad visual por encima de cualquier modal o backdrop abierto.
* `fix(kiosco-terminal-sede-lock)`: **Hito 51: Bloqueo Estricto de Sede en Terminales Físicas y Ocultamiento de Sedes Ajenas**:
  - **Causa Raíz Identificada**:
    - Al autorizar una terminal asignada a un campus específico (ej. "Campus Villa"), `KioscoTerminal.tsx` leía `localStorage.getItem('kiosco_selected_sede_id')` en paralelo, sobrescribiendo la sede oficial con la última sede que el usuario probó en ese navegador (ej. "Campus Ate").
    - Adicionalmente, el selector de campus (`.sedeSelectorRow`) renderizaba incondicionalmente todas las sedes registradas (`sedesList`), permitiendo a los colaboradores cambiar de campus o ver opciones ajenas en una tablet fija en la pared de Villa.
* `feat(simclic-multiday-autosync)`: **Hito 52: Sincronización Automática Multi-Día (Hoy y Mañana) y Auto-Sync por Cambio de Fecha**:
  - **Causa Raíz Identificada**:
    - SimClic es un sistema cerrado externo que no cuenta con Webhooks para notificar cambios en tiempo real a sistemas de terceros.
    - El ciclo periódico de fondo en `AdminDashboard.tsx` (cada 3 minutos) consultaba exclusivamente la fecha de HOY (`hoyLima`), dejando las modificaciones del día de MAÑANA sin actualizar hasta las 5:00 AM (cuando corre el Cron diario de Vercel).
    - Al alternar de fecha en la pestaña `ProgramacionTab` (ej. seleccionar "Mañana"), la vista leía lo que ya estaba en la base de datos local Postgres pero no disparaba una consulta a SimClic.
  - **Solución Implementada**:
    - **Sincronización Dual Continua (`AdminDashboard.tsx`)**: Se amplió `triggerGlobalSyncSimclic` para que en cada ciclo automático en segundo plano sincronice simultáneamente **HOY y MAÑANA** en paralelo mediante `Promise.all`. Cualquier cambio o reubicación de sala realizada por coordinadores en SimClic para el día siguiente ahora se actualiza automáticamente cada 3 minutos y al reenfocar la ventana.
    - **Auto-Sync Reactivo al Cambiar de Fecha (`ProgramacionTab.tsx`)**: Al hacer clic en "Mañana" o elegir cualquier fecha en el calendario, la aplicación carga los datos locales inmediatamente y dispara en paralelo un `runSyncSimclic(false)` silencioso que consulta SimClic en segundo plano y refresca la vista si se detectan ajustes de sala o sesiones nuevas.
    - **Sincronización Inmediata Ejecutada**: Se procesaron los cambios de SimClic para el 20/10/2026, detectando y actualizando decenas de traslados de salas y talleres (Cirugía, Pediatría, Gineco-Obstetricia, Habilidades y Consultorios).

* `feat(simulador-permutas-domino)`: **Hito 53: Simulador Interactivo de Permutas & Reubicaciones en Cadena (Efecto Dominó Logístico)**:
  - **Concepto y Mentalidad Operativa de Clínica de Simulación**:
    - Resuelve la necesidad real del equipo técnico: en lugar de acarrear y desmontar torres pesadas durante la noche, el técnico puede intercambiar salas matutinas del día siguiente de forma secuencial y encadenada.
    - Ejemplo de flujo dominó implementado:
      1. Si hoy *Consultorio 2* cerró con *«Enfermedad Renal Crónica»* y mañana SimClic lo asignó a *Consultorio 3*, el técnico traslada esa clase matutina a *Consultorio 2* (logrando 100% continuidad y 0 acarreo en Consultorio 2).
      2. La clase matutina previa de *Consultorio 2* (*«Hidrocele»*) queda desplazada temporalmente en *Consultorio 3*.
      3. El sistema detecta inmediatamente: *«Hoy en Hospitalización 2 se dictó Hidrocele»*, y le ofrece con 1 clic moverla a *Hospitalización 2* (logrando 100% continuidad en Hospitalización 2).
      4. El técnico continúa encadenando movimientos tantas veces como sea necesario.
  - **Componentes y Arquitectura**:
    - **Detector y Atajos Dominó en Tarjetas (`HubLogisticaSimulacion.tsx`)**:
      - Si una sala de mañana tiene coincidencia con el cierre nocturno de hoy de otra sala, despliega un banner de atajo rápido: `💡 Oportunidad: "Caso" cerró hoy en [Sala] ➔ [ 🔀 Intercambiar con Sala ]`.
      - Si una sesión fue desplazada en un paso anterior, despliega un banner pulsante de eslabón dominó: `⚡ Siguiente eslabón dominó: Hoy en [Sala] se dictó "Caso" ➔ [ 🔀 Mover a Sala ]`.
      - Botón contextual `🔀 Mover Sala` en la cabecera de la apertura matutina.
    - **Modal Selector Manual (`ModalSelectorPermutaManual.tsx`)**:
      - Permite al técnico seleccionar cualquier sala candidata agrupada por: *¡Continuidad Idéntica de Caso! (0 acarreo)*, *Mismo Curso Clínico*, *Salas Libres Mañana Temprano* y *Otras Salas*.
    - **Barra de Control del Simulador (`.simulatorControlBar` & `admin.module.css`)**:
      - Se activa automáticamente al realizar el primer intercambio en el borrador de trabajo.
      - Muestra el conteo de movimientos, contador de salas con continuidad ganadas (`🎉 +X salas con continuidad lograda`) y un historial visual de pasos tipo breadcrumbs (`1️⃣ C-3 ➔ C-2 (Renal) ✓`, `2️⃣ C-3 ➔ Hosp-2 (Hidrocele) ✓`).
      - Botonera ejecutiva:
        - `↩️ Deshacer`: revierte el último paso reconstruyendo el estado.
        - `🔄 Restablecer Todo`: restaura la programación original de SimClic.
        - `📋 Copiar Propuesta`: genera un mensaje formal estructurado para WhatsApp o correo de Coordinación Académica.
        - `💾 Aplicar en Sistema`: guarda los cambios oficiales en la base de datos con confirmación SweetAlert2.
    - **API Route de Reubicaciones Oficiales (`/api/programacion/reubicar/route.ts`)**:
      - Endpoint seguro que actualiza `sesiones_programadas` registrando `ambienteId`, `ambienteNombreSimclic`, guardando el aula previa en `ambienteOriginalNombre` y marcando `estadoUcs = 'reubicada'` para sincronía total con Kiosco y Gantt.

* `feat(simulador-reorganizar-pastilla-simclic)`: **Hito 54: Pastilla «✨ Reorganizar» y Reasignación Global Simulada para SimClic**:
  - **Solicitud del Usuario & Visión de Operación Técnica**:
    - Brindar a los técnicos de simulación una herramienta que analice en 1 solo clic todas las clases del SimClic de hoy vs. las de mañana, compare casos y cursos, y genere la **mejor distribución global de salas simulada**.
    - La simulación permite revisar cómo quedaría todo el piso antes de tocar SimClic, agilizando radicalmente el trabajo técnico sin tener que inspeccionar sala por sala de forma manual.
  - **Algoritmo de Optimización Global Multi-Fase (`autoReorganizarSalasOptimas` en `logisticaSimulacion.ts`)**:
    - **Fase 1 (Match Exacto de Caso Clínico)**: Cruza el caso de cierre nocturno de hoy con la apertura matutina de mañana (+10,000 pts). Si encuentra coincidencia en otra sala, ejecuta la permuta o reasignación, bloquea la sala destino (garantizando 100% continuidad y 0 acarreo) y genera un desplazamiento temporal que continúa resolviéndose en cadena (efecto dominó).
    - **Fase 2 (Match por Curso / Mobiliario / Equipos)**: Para las salas restantes que no pudieron empatar caso idéntico, busca coincidencias de curso (+3,000 pts) para reutilizar simuladores de mediana/alta fidelidad, camillas o instrumental afín.
    - **Cálculo de Ganancias y Diagnóstico**: Evalúa el delta de continuidades ganadas (`continuidadesNuevas - continuidadesOriginales`) y salas con cambio evitadas.
  - **Pastilla «✨ Reorganizar» en Barra de Filtros (`HubLogisticaSimulacion.tsx` & `admin.module.css`)**:
    - Ubicada al inicio de la botonera de filtros de continuidad con estilo esmeralda/turquesa degradado (`.pillReorganizar` / `.pillReorganizarActive`).
    - Estado dinámico:
      - Antes de ejecutar: muestra las permutas óptimas calculadas preventivamente en memoria (`✨ Reorganizar (X sugeridas)`).
      - Tras ejecutar: se ilumina activa indicando las continuidades ganadas (`✨ Reorganizado (+X logradas)`).
    - Al hacer clic, reasigna en memoria el tablero de mañana, actualiza instantáneamente las tarjetas con las etiquetas `🔀 Reubicada (Orig: Sala X)` / `📦 Desplazada`, y despliega la barra superior del simulador.
  - **Botón «📋 Copiar Guía para SimClic»**:
    - Añadido a la botonera ejecutiva del `.simulatorControlBar`.
    - Genera y copia al portapapeles una lista rápida paso a paso (`1️⃣ Mover Caso X de [Sala A] ➔ [Sala B] (Intercambio con Caso Y)`) para que el técnico abra SimClic y traslade las clases en menos de 1 minuto sin margen de error.

* `feat(gantt-simulado-continuidad-manana)`: **Hito 55: Línea de Tiempo Gantt Simulado de Mañana (Vista Idéntica a SimClic)**:
  - **Solicitud del Usuario & Visión de Operación**:
    - Al presionar **«✨ Reorganizar»**, los técnicos necesitan ver la distribución de mañana directamente en una **Línea de Tiempo Gantt interactiva** (07:00 a 22:00) idéntica a la interfaz a la que están habituados en SimClic.
    - Esto permite validar visualmente en segundos el impacto en todo el piso y ejecutar los movimientos en SimClic con total seguridad.
  - **Arquitectura y Componentes Implementados (`HubLogisticaSimulacion.tsx` & `admin.module.css`)**:
    - **Activación Reactiva Automática**: Al hacer clic en `✨ Reorganizar`, el sistema conmuta automáticamente a `vistaContinuidad = 'gantt'`.
    - **Selector de Vista Dual**: Barra de control conmutadora entre `[ 📊 Gantt Simulado ]` y `[ 📋 Tarjetas ]`, permitiendo al técnico alternar entre la vista temporal completa y la comparativa sala por sala en cualquier momento.
    - **Estructura idéntica a SimClic**:
      - Eje horizontal con 31 slots de tiempo (07:00 a 22:00 en intervalos de 30 minutos).
      - Eje vertical con salas agrupadas por pisos UCS (`Primer Piso`, `Segundo Piso`, `Piso 4`, `Piso 8`, etc.) ordenadas con `clasificarPisoYOrden` y con acordeón colapsable por piso.
    - **Distintivos Inteligentes en Bloques de Clase**:
      - `🟩 Reubicada (0 Acarreo)`: Bloques de sesión reasignados con borde verde esmeralda luminoso, badge `🔀 REUBICADA de [Sala Origen]`, caso, curso, docente y horario.
      - `🟨 Desplazada`: Bloques en ámbar que fueron movidos por intercambio (`📦 DESPLAZADA desde [Sala]`).
      - `🟦 Sin cambios`: Clases que se mantienen en su programación base con el color de su carrera/curso.
    - **Ficha Lateral de Sala**: Muestra el nombre, código y un badge informativo con lo que cerró esa sala hoy (`🌙 Cierre: Caso / Curso`), facilitando la correlación de por qué se reubicó esa sesión allí.
* `feat(gantt-reorganizar-dual-inamovible)`: **Hito 56: Reorganización Integral de Todos los Ambientes & Modo Comparativa Dual (Hoy vs Mañana Simulado)**:
  - **Contexto Operativo & Workflow Real del Técnico de Simulación**:
    - Históricamente, el técnico abría **dos pestañas independientes de SimClic**: una con la programación de **Hoy** y otra con la de **Mañana**, comparando sala por sala para decidir qué clases mover de ambiente para evitar acarreos nocturnos.
    - **Regla Operativa Inviolable**: *"La hora es inamovible, solo podemos mover los cursos entre ambientes"*. Los horarios de inicio y fin (`startMins` a `endMins`) deben respetarse al 100%. Las salas no pueden tener colisiones ni solapamientos de horario en ningún minuto.
  - **Visualización Completa de Toda la Clínica (38+ Ambientes)**:
    - Se corrigió el alcance del Gantt en `HubLogisticaSimulacion.tsx`: anteriormente filtraba solo las salas con incidencias (~15 salas); ahora muestra **TODOS los 38+ ambientes de la sede** por defecto, agrupados y ordenados por pisos UCS (`Primer Piso`, `Segundo Piso`, `Piso 4`, etc.) de forma idéntica a SimClic.
    - Permite al técnico revisar la totalidad del campus de un solo vistazo antes de tocar SimClic.
    - Filtro de alcance dinámico integrado: `[ 🏢 Todas (${ambientes.length}) ]`, `[ ✨ Reubicadas ]`, `[ ⚡ Requieren Acción ]`.
  - **Algoritmo de Reorganización por Bloques Curriculares & Cero Solapamientos (`logisticaSimulacion.ts`)**:
    - **Detección de Colisiones (`haySolapamientoHorario`)**: Valida matemáticamente que ninguna sala candidata reciba una clase que solape con otra clase existente en cualquier minuto. Si hay cruce, la permuta se rechaza automáticamente.
    - **Reubicación por Bloques Contiguos (`obtenerBloqueConsecutivo`)**: En SimClic, un curso matutino suele dividirse en 2 o 3 sesiones contiguas de 1h40m (ej. 07:00 a 12:00). El algoritmo traslada el bloque completo del caso/curso hacia la sala donde cerró anoche, intercambiando limpiamente con el bloque compatible de destino o asignándolo si la sala está libre.
    - **Validación en Reubicaciones Manuales**: Tanto la auto-reorganización como el modal manual (`handleEjecutarPermuta`) verifican colisiones y previenen cruces de horario.
  - **Modo Comparativa Dual «Lado a Lado» (Hoy vs Mañana Simulado)**:
    - Selector de modo integrado en el banner del Gantt:
      - `[ 🖥️ Mañana Simulado (Gantt Completo) ]`: Vista a pantalla completa de la programación de mañana con todas las salas.
      - `[ 👥 Comparativa Dual (Hoy vs Mañana) ]`: Recrea de forma nativa la experiencia de las dos pestañas de SimClic lado a lado.
* `feat(excluir-clases-virtuales-panel)`: **Hito 57: Exclusión Total y Quirúrgica de VIRTUAL-VILLA y Clases Virtuales del Panel Administrativo**:
  - **Requerimiento Operativo**:
    - El usuario solicitó expresamente retirar la sala `VIRTUAL - VILLA` y todas las clases virtuales del panel, asegurando que no se muestren ni se tomen en cuenta en la logística clínica física.
  - **Filtros Preventivos en Capa API REST**:
    - `/api/programacion/route.ts`: Exclusión de salas virtuales (`isAmbienteVirtual`) y descarte automático de sesiones con ambiente o título virtual (`isSesionVirtual`). Las métricas del día (`salasTotales`, `totalSesiones`, `salasOcupadasAhora`, `salasLibresAhora`) reflejan con un 100% de fidelidad únicamente los ambientes clínicos físicos.
    - `/api/ambientes/route.ts`: Filtra y omite salas virtuales al listar ambientes para el panel de administración.
    - `/api/dashboard/stats/route.ts`: Ajuste del conteo de ambientes activos excluyendo registros con `VIRTUAL` o código `VIRT`.
  - **Lógica Centralizada de Simulación & Algoritmos (`logisticaSimulacion.ts`)**:
    - Nuevos helpers exportados: `isAmbienteVirtual(nom, cod)` y `isSesionVirtual(ses)`.
    - `analizarLogisticaIntraDia`: Purga salas y sesiones virtuales para evitar transiciones espurias o falsos swaps.
    - `analizarContinuidadInterDias`: No evalúa clases virtuales para el cálculo de acarreo o cierres de noche.
    - `autoReorganizarSalasOptimas`: Previene categóricamente cualquier reubicación o permuta que involucre salas o materias virtuales.
    - `clasificarPisoYOrden`: Asigna orden de seguridad deshabilitado a ambientes virtuales.
  - **Limpieza en Vistas de Usuario (`ProgramacionTab.tsx` & `HubLogisticaSimulacion.tsx`)**:
    - `ProgramacionTab.tsx`: Eliminada la categoría visual de "Ambientes Virtuales"; el Gantt principal omite salas virtuales y sus sesiones.
    - `HubLogisticaSimulacion.tsx`: El Gantt de Continuidad, la Comparativa Dual (Hoy vs Mañana) y las tarjetas de acción no listan ni consideran clases virtuales.
  - **Depuración de Base de Datos y Semillas**:
    - Desactivación de registros en PostgreSQL (`ambientes.activo = false` para `VIRTUAL - VILLA`, `Virtual - Norte`, `Virtual - Ate`).
* `feat(cronograma-compensatorios-tecnicos)`: **Hito 58: Malla Mensual Dinámica con Horarios Personalizados y Banco de Días Compensatorios para Técnicos de Simulación**:
  - **Contexto Operativo del Personal Técnico**:
    - Los técnicos de simulación cuentan con un turno base habitual (ej. Turno Tarde 13:00 a 22:00), pero por la naturaleza de las actividades clínicas rotan descansos y asisten en domingo o días de guardia con horarios especiales (ej. 07:00 a 15:00, 09:00 a 18:00, 10:00 a 19:00 cuando un curso finaliza a las 18:45/19:00, o cualquier franja a medida).
    - Asimismo, en semanas de alta demanda (eventos especiales, ECOE), trabajan 7 de 7 días continuos sin descanso, acumulando "días a favor" (compensatorios) que se coordinan con jefatura para ser canjeados posteriormente.
  - **Fase 1: Banco de Días Compensatorios ("Días a Favor")**:
    - **Tabla PostgreSQL (`banco_compensatorios_tecnicos`)**:
      - Registro inmutable de transacciones: `usuario_id`, `tipo` (`acumulado`, `canjeado`, `ajuste_manual`), `dias` (+1.0 / -1.0), `fecha_referencia`, `motivo`, `autorizado_por_id`, `saldo_resultante`.
    - **API REST `/api/tecnicos/compensatorios`**:
      - `GET`: Retorna el historial de movimientos y el saldo neto (`saldoDias`, `totalAcumulados`, `totalCanjeados`) por técnico o consolidado general.
      - `POST`: Permite la acumulación o canje manual con motivo y fecha de referencia.
      - `POST (action: 'auto_detect_semanas')`: Algoritmo de auditoría automática que examina semanas calendario (Lunes a Domingo); si el técnico asistió los 7 días consecutivos sin descanso, detecta la semana y permite asignar en 1 clic los días compensatorios ganados.
  - **Fase 2: Cronograma Mensual y Horarios Personalizados por Día**:
    - **Tabla PostgreSQL (`turnos_programados_tecnicos`)**:
      - Permite sobreescribir la jornada de cualquier día específico (`fecha` YYYY-MM-DD): `tipo_dia` (`laborable`, `descanso`, `descanso_compensatorio`, `guardia_evento`), `hora_entrada_esperada`, `hora_salida_esperada`, `es_personalizado`, `nota`.
    - **API REST `/api/tecnicos/cronograma`**:
      - `GET`: Consulta la malla del mes (`mes=YYYY-MM`).
      - `POST`: Guarda o actualiza la jornada diaria. Si se programa un `descanso_compensatorio`, deduce automáticamente 1 día del banco compensatorio con trazabilidad.
      - `DELETE`: Revierte la fecha a la jornada base del técnico.
    - **Componente Modal `ModalCronogramaTecnico`**:
      - **Diseño Compacto Idéntico a Crear Sede / Sala (`admin.module.css`)**: Estructurado como un modal de formulario limpio, centrado y ágil (`max-width: 520px`), idéntico visualmente a `ModalCrearAmbiente` y `ModalCrearSede`.
      - **Pestaña 1 (Programar Horario / Descanso)**:
        - Selección ágil de fecha con atajos directos (`Hoy` y `Próximo Domingo`).
        - Selector de tipo de jornada: **Horario Personalizado** (con inputs `<input type="time">` para entrada y salida arbitraria + chips de atajos frecuentes `07:00-15:00`, `09:00-18:00`, `10:00-19:00`), **Descanso Semanal (DSO)**, **Descanso Compensatorio** o **Turno Base**.
        - Campo de observación/motivo opcional.
        - Detección reactiva de programación previa en la fecha con botón para revertir a horario base.
      - **Pestaña 2 (Banco de Compensatorios)**:
        - Tarjeta de saldo neto actual con total de días acumulados y canjeados.
        - Formulario ágil para registrar días compensatorios a favor (+1 por ECOE o evento) o registrar descanso canjeado (-1).
        - Botón de auto-auditoría de semanas 7/7 consecutivas trabajadas.
      - **Pie de Modal y Estilo**:
        - Botón `Cancelar` y botón de acción naranja UCS (`styles.actionBtn`) con sombra y gradiente idéntico a las capturas de campus/ambiente.
  - **Integración Integral en la Plataforma**:
    - **Kiosco Terminal (`/kiosco`, `/api/kiosco/marcar`, `/api/kiosco/lookup`)**:
      - Al ingresar el DNI, consulta si el técnico tiene un horario especial hoy (personalizado o programado) y evalúa su puntualidad/tolerancia sobre dicha hora (ej. 10:00 en lugar de su base 13:00).
      - Muestra el saldo de días compensatorios en la pantalla de bienvenida y en el ticket de salida impreso/digital.
    - **Directorio de Personal (`PersonalTab.tsx`)**:
      - Nueva columna y botón `📅 Turnos` para técnicos, junto con badge `⭐ X Días Comp.` visible en la lista.
    - **Ficha 360° (`KardexDrawer.tsx`)**:
      - Tarjeta destacada de "Banco de Días Compensatorios & Cronograma" con saldo en vivo y botón para abrir directamente el modal de gestión mensual.
  - **Verificación Técnica**:
    - Migración ejecutada exitosamente en Neon PostgreSQL.
    - Verificación de tipos TypeScript estricto con `npx tsc --noEmit` (0 errores).
* `feat(simclic-gestion-cancelaciones)`: **Hito 59: Detección y Gestión de Clases Canceladas / Sesiones Fantasma de SimClic**:
  - **Contexto y Problemática**:
    - Cuando una sesión se cancela o elimina en SimClic, desaparece de la colección de Meteor (`sessions`) o viene con estatus cancelado/borrado. Anteriormente en UCS Registro, las sesiones ya sincronizadas quedaban como "sesiones fantasma" activas (`estadoUcs = 'programada'`), bloqueando salas físicas en el Gantt, alterando métricas de ocupación e induciendo falsas alertas de tardanza a docentes.
  - **Sincronización Inteligente & Reconciliación (`simclicSync.ts`)**:
    - Extensión de `SyncResult` con métricas `canceladas` y `detallesCanceladas` (indicando motivo `eliminada_en_simclic` o `marcada_cancelada`).
    - Detección reactiva de supresiones: al sincronizar una fecha (`targetDateStr`), el motor compara todos los `simclicId` activos del WebSocket contra los registros existentes en PostgreSQL (`sesiones_programadas`). Las sesiones ausentes en SimClic son marcadas de inmediato con `estadoSimclic: 'Cancelled'`, `estadoUcs: 'cancelada'`.
    - Detección de estados explícitos en el payload de Meteor (`status` cancelado/eliminado/borrado).
    - Reactivación automática si una clase cancelada vuelve a habilitarse o reactivarse en SimClic.
    - Robustecimiento del WebSocket con control estricto `isSubReady` para prevenir deserializaciones truncadas por timeouts prematuros.
  - **Filtros en el Core de Logística y Métricas (`logisticaSimulacion.ts` & `/api/programacion`)**:
    - Helper universal `isSesionActiva(ses)` que descarta automáticamente tanto sesiones virtuales como canceladas de los cálculos de transición intra-día, continuidad inter-días y swaps de salas.
    - Las salas asignadas a sesiones canceladas se liberan de inmediato en la línea de tiempo operativa (`salasOcupadasAhoraSet` no las cuenta).
    - Descarte automático de falsas alarmas de ausentismo o tardanzas de docentes para sesiones canceladas.
  - **Experiencia de Usuario en el Timeline Gantt (`ProgramacionTab.tsx` & `ModalDetalleSesionSimclic.tsx`)**:
    - Por defecto, las clases canceladas se ocultan del Gantt para que la sala figure libre y disponible para otros usos.
    - Nuevo KPI interactivo en la barra de métricas: `🚫 Canceladas SimClic (X)` que permite filtrar y auditar las cancelaciones del día.
    - Nuevo botón de filtro `🚫 Canceladas SimClic (X)` en la barra de controles.
    - Renderizado visual diferenciado al activar el filtro de canceladas: borde discontinuo rojo (`2px dashed #f87171`), fondo translúcido, badge de peligro `🚫 CANCELADA` y título tachado.
    - En el modal de detalle (`ModalDetalleSesionSimclic.tsx`): banner informativo de alerta indicando que la clase fue dada de baja en SimClic y que el ambiente se encuentra libre.
    - Notificación toast en la sincronización manual reportando si se detectaron clases canceladas.
  - **Verificación Técnica**:
    - Compilación estricta con TypeScript `npx tsc --noEmit` completada con 0 errores.
* `feat(simclic-multidocente-multiactor)`: **Hito 60: Soporte Integral para Múltiples Pacientes Simulados y Co-Docentes por Sesión de SimClic**:
  - **Contexto y Problemática**:
    - En evaluaciones complejas, simulaciones quirúrgicas y circuitos ECOE, una sola estación o bloque clínico puede contar con múltiples docentes (titular, evaluador, co-docente) o varios pacientes simulados (ej. paciente + familiar, o relevos de casos). Anteriormente, el sistema solo mapeaba el índice `[0]` de `standardizedPatients` y el `leadInstructor`, dejando invisibles a los docentes secundarios y actores adicionales para el cruce de asistencia en vivo del Kiosco y el panel de administración.
  - **Persistencia en Neon PostgreSQL (`schema.ts` & `migrate_participantes_simclic.ts`)**:
    - Nuevas columnas JSONB en `sesiones_programadas`: `docentes_json` y `pacientes_simulados_json`.
    - Almacenamiento estructurado con `id` local de usuario (vía match exacto/difuso por correo institucional y nombres completos), `simclicUserId` / `simclicId`, `nombre`, `email` y `rol` ('principal', 'co_docente', 'evaluador', o personaje clínico del paciente simulado).
  - **Motor de Ingesta & Sincronización WebSocket (`simclicSync.ts`)**:
    - Función extractora `extraerTodosDocentes`: consolida `leadInstructor`, `instructors`, `evaluators`, `coInstructors` y `assistants`, deduplica identificadores y resuelve su usuario local en PostgreSQL.
    - Función extractora `extraerTodosPacientesSimulados`: recorre el arreglo completo de `s.standardizedPatients`, extrayendo roles/personajes y resolviendo coincidencias contra usuarios de tipo `paciente_simulado`.
    - Retrocompatibilidad asegurada: las columnas escalares (`docenteNombreSimclic`, `docenteId`, `pacienteSimuladoNombre`, etc.) mantienen al docente y actor primario.
  - **Cruce de Asistencia en Tiempo Real (`/api/programacion/route.ts`)**:
    - Evaluación de presencia individualizada por participante contra `asistenciasDia`.
    - Métricas agregadas por sesión: `totalDocentesCount`, `docentesPresentesCount`, `totalPsCount`, `psPresentesCount`.
    - Alertas reactivas: si la sesión tiene 2 docentes y solo llegó 1, alerta `👤 1/2 docentes en sala`; si ninguno marcó pasados 10 min, alerta `🚨 0/X docentes (Xm tarde)`.
    - Métricas globales (`metricas.totalDocentes` y `metricas.totalPs`): contabilizan todos los colaboradores únicos del día, no solo los principales.
  - **Kiosco Terminal y Concurrencia (`/api/kiosco/marcar/route.ts`)**:
    - Reconocimiento de co-docencia y elencos múltiples de actores al registrar sala:
      `Co-docencia múltiple: X docentes en sala (último: ...)` / `Elenco múltiple de Pacientes Simulados: X actores en sala`.
  - **Experiencia de Usuario en Gantt y Modal de Detalle (`ProgramacionTab.tsx` & `ModalDetalleSesionSimclic.tsx`)**:
    - **Línea de Tiempo (Gantt)**: Bloques con badge `+1 co-doc` cuando hay co-docencia, y `🎭 X PS` cuando hay más de un actor programado. Tooltip nativo completo que lista a cada participante con su rol y estado `[EN SALA]`.
    - **Ficha 360° de Sesión (`ModalDetalleSesionSimclic.tsx`)**:
      - Tarjetas expandidas: "Docentes e Instructores (X)" y "Pacientes Simulados / Actores (X)".
      - Lista individual con chip de rol (`⭐ Principal`, `👥 Co-docente`, `🎭 Personaje`), estado de presencia (`✓ En Sala` con hora y sala física vs `⏳ Pendiente`) y accesos directos para contacto por WhatsApp o correo.
  - **Verificación Técnica**:
    - Migración ejecutada exitosamente en Neon PostgreSQL.
    - Sincronización en vivo verificada contra Meteor SimClic (185 sesiones procesadas y enriquecidas con JSON de participantes).
    - Tipado y compilación estricta con TypeScript `npx tsc --noEmit` (**0 errores**).
* `feat(simclic-sync-semanal)`: **Hito 61: Sincronización Preventiva Semanal y Ventana Deslizante Multi-Días de SimClic**:
  - **Contexto y Problemática**:
    - Anteriormente, el sistema consultaba SimClic únicamente para el día activo (`TimelineDay`) en demanda. Cuando los coordinadores navegaban a fechas futuras (ej. jueves o viernes) o planificaban la logística de la semana, las salas figuraban vacías hasta que se forzara la sincronización manual de ese día en específico. Además, cambios de programación realizados a futuro (cancelaciones, traslados o reprogramaciones de casos) no se detectaban proactivamente.
  - **Motor de Ingesta Semanal Nativizado en Meteor SockJS DDP (`src/lib/simclicSync.ts`)**:
    - Soporte para `ModoSync = 'dia' | 'semana'` y opciones estructuradas `SyncOptions { targetDate, modo }`.
    - Conexión SockJS Meteor adaptada: al solicitar `modo: 'semana'`, suscribe al canal `sessions.byDateAndUser` con `currentView: 'TimelineWeek'` y `firstDayOfWeek: 1`. Esto permite traer toda la semana académica (Lunes a Domingo, >1,300 sesiones) en una sola conexión WebSocket ultrarrápida (~1.8s a 2.5s) sin tener que hacer 7 conexiones diarias separadas.
    - Timeout de seguridad dinámico (12s para día, 24s para semana).
    - Scope-aware phantom detection: En modo semanal, reconcilia contra todas las sesiones existentes en PostgreSQL cuya fecha corresponda a cualquiera de los días recibidos en el lote semanal (`diasProcesadosSet`), marcando como canceladas aquellas que hayan sido desprogramadas o eliminadas de SimClic durante la semana.
    - Exportación del helper `syncSimclicWeek(targetDate)`.
  - **Endpoint API Ampliado (`/api/simclic/sync/route.ts`)**:
    - Acepta en el body `{ fecha?: string, modo?: 'dia' | 'semana' }` y despacha al motor de ingesta semanal retornando el desglose de fechas (`fechaInicio`, `fechaFin`, `diasProcesados`, `total`, `creadas`, `actualizadas`, `reubicadas`, `canceladas`).
  - **Daemon Autónomo con Ventana Deslizante (`src/scripts/simclicCron.ts`)**:
    - Estrategia de ventana rodante:
      1. Alta frecuencia (cada 30 min): Sincroniza Hoy y Mañana para control en tiempo real y detección inmediata de traslados de ambiente.
      2. Ventana Deslizante Semanal: En el primer ciclo y cada 4 ciclos (~2 horas), ejecuta preventivamente la sincronización completa de la semana académica en segundo plano, manteniendo Neon PostgreSQL perpetuamente fresco para cualquier día de la semana.
  - **Interfaz de Usuario en el Dashboard (`src/components/admin/tabs/ProgramacionTab.tsx`)**:
    - Nuevo botón `📅 Sincronizar Semana` con diseño de alto contraste en el action bar superior.
    - Estado de carga `syncingSemana` con bloqueo de peticiones concurrentes y feedback en vivo vía notificaciones Toast (reportando total de sesiones, rango de fechas, sesiones canceladas y traslados de sala detectados).
    - Refresco automático de la vista del Gantt y métricas tras culminar el ciclo semanal.
  - **Verificación Técnica**:
    - Prueba real contra servidor WebSocket Meteor de SimClic: 1,315 sesiones sincronizadas a través de 7 días (`2026-10-19` a `2026-10-25`) en 1.8 segundos.
    - Tipado TypeScript estricto verificado con `npx tsc --noEmit` (**0 errores**).
* `feat(kiosco-1tap-suplencias)`: **Hito 62: Preselección Inteligente 1-Tap en Kiosco y Detección Automática de Suplencias**:
  - **Contexto y Problemática**:
    - Al ingresar su DNI en el kiosco táctil, los docentes y pacientes simulados debían buscar manualmente su curso y seleccionar su sala en un listado extenso, a pesar de que el sistema ya conocía su programación en SimClic. Además, en la práctica clínica suelen presentarse suplencias imprevistas donde un docente o actor de reserva cubre una sala sin figurar en SimClic oficial, lo cual requería trazabilidad para justificar la inasistencia del titular y remunerar al suplente real.
  - **Lookup Inteligente con SimClic (`/api/kiosco/lookup/route.ts`)**:
    - Evaluación en vivo de la programación de hoy (`sesiones_programadas`) cruzando el DNI del docente (titular o co-docente) o paciente simulado (principal o personajes múltiples).
    - Algoritmo de puntuación temporal y espacial: prioriza la sede física de la terminal y calcula la sesión activa o próxima (ventana de 45 min previos al inicio hasta 10 min antes del fin).
    - Retorna el objeto `sesionSugerida` con curso, sala oficial, código, horarios, rol y minutos restantes.
  - **Experiencia de Usuario 1-Tap en Terminal (`KioscoTerminal.tsx`)**:
    - Tarjeta destacada `⚡ SESIÓN DETECTADA EN SIMCLIC`: muestra el curso, sala oficial, horario y rol.
    - Botón primario verde de alto impacto: `🟢 CONFIRMAR INGRESO A [SALA]` para marcación inmediata con un solo toque (1-Tap), sin fricción.
    - Opción de contingencia: `🔄 Elegir sala manualmente / Suplencia`, que despliega el selector libre con advertencia contextual y botón de retorno.
    - Si el colaborador no tiene clase asignada a esa hora, el sistema le informa con amabilidad y le permite marcar en cualquier sala como suplente.
  - **Auditoría y Detección Automática de Suplencias (`/api/kiosco/marcar/route.ts`)**:
    - Cruce automático entre el colaborador que marca en la sala y el titular registrado en SimClic.
    - Si difieren, etiqueta automáticamente la asistencia con nota contextual: `🔄 Suplencia Docente: Cubriendo a [Titular] en sesión SimClic #[ID]` (o `🔄 Suplencia Paciente Simulado`).
    - Enlace bidireccional: asocia `sesionesProgramadas.asistenciaId` a la nueva asistencia y marca `estadoUcs = 'en_curso'`. Al marcar salida, actualiza a `finalizada`.
    - Puntualidad calculada contra la hora real de la clase en SimClic (`horaEntradaProgramada`), reportando si llegó a tiempo o con demora.
  - **Soporte Nativo de Secuencias Multi-Bloque en el Día (`lookup` & `KioscoTerminal`)**:
    - Si un docente o PS tiene múltiples bloques en el día (ej. Bloque 1 de 07:00 a 10:00 en Sim Quirúrgica y Bloque 2 de 11:00 a 13:00 en Sim Pediátrica):
      1. En la mañana (07:00), el Kiosco le detecta y preselecciona el Bloque 1 con el badge `📅 Bloque 1 de 2 hoy` y le anticipa el siguiente bloque: `📌 Próximo bloque: 11:00 - 13:00 • Simulación Pediátrica`.
      2. Al terminar a las 10:00, marca su salida. El Bloque 1 se cierra y se marca como `finalizada`.
      3. A las 10:55, al volver a poner su DNI, el sistema descarta el Bloque 1 ya concluido y le ofrece automáticamente el botón 1-Tap para el Bloque 2 en su nueva sala.
      4. Cada bloque genera su propia asistencia y cálculo independiente de horas/honorarios, impidiendo cobros indebidos por horas muertas intermedias.
  - **Verificación Técnica**:
    - Tipado TypeScript estricto verificado con `npx tsc --noEmit` (**0 errores**).

* `perf(zero-waste-egress)`: **Hito 63: Optimización Integral de Egress y Rendimiento de Base de Datos Neon (Zero-Waste)**:
  - **Contexto & Diagnóstico**:
    - Neon reportó una alerta de consumo al 83% del límite de transferencia de red (4.15 GB / 5.0 GB mensual).
    - La causa raíz detectada fue el bucle incondicional de 1,300 `UPDATE` por ciclo de sincronización, la descarga completa de la tabla de sesiones históricas (`SELECT *`) sin filtro de fechas, la consulta repetitiva de catálogos estáticos en cada ciclo de 3 minutos y el polling ininterrumpido en pestañas de navegador minimizadas o en segundo plano.
  - **Implementación Técnica**:
    - **Caché en Memoria RAM para Catálogos Estáticos (`src/lib/catalogCache.ts`)**:
      - Singleton en memoria con TTL de 15 minutos para `sedes`, `ambientes`, `carreras`, `cursos` y proyección ligera de `usuarios` (`id, correo, nombres, apellidos, tipoPersonal`). Invalida el caché instantáneamente en operaciones de escritura (crear/editar sede o sala). Reduce en un 95% las consultas repetitivas a Neon.
    - **Delimitación Estricta de Rango de Fechas & Proyección Quirúrgica (`simclicSync.ts`)**:
      - El motor de sincronización recolecta previamente las fechas únicas del lote de SimClic recibido y consulta a PostgreSQL únicamente las sesiones pertenecientes a dichas fechas (`where(inArray(sesionesProgramadas.fecha, fechasScopeArray))`) con columnas específicas, reduciendo el peso de la consulta de ~3.5 MB a < 80 KB.
    - **Dirty Checking Semántico en Memoria (Cero Escrituras en Reposo)**:
      - Comparación inteligente de campos de texto normalizados (`eqStr`) y arrays de participantes (`sonDocentesIguales`, `sonPsIguales`) que neutraliza las discrepancias de orden de claves del formato JSONB de PostgreSQL.
      - Si una sesión no tuvo cambios reales de sala, horarios, docente, estado o participantes, **el `db.update` se omite al 100%**. En pruebas reales con 187 sesiones, las escrituras pasaron de 187 a **0**, reduciendo el tiempo de ejecución de 28s a 2.3s.
    - **Control Inteligente de Ciclo de Vida (`Page Visibility API`)**:
      - En `AdminDashboard.tsx`, `PersonalTab.tsx` y `ProgramacionTab.tsx`, los temporizadores de sincronización y polling se pausan automáticamente cuando la pestaña está minimizada u oculta (`document.visibilityState === 'hidden'`). Al volver a enfocar la ventana, se dispara una sincronización segura con cooldown de 2.5 minutos.
    - **Índices de Alto Rendimiento en Neon PostgreSQL (`createOptimizationIndexes.ts`)**:
      - Se aplicaron exitosamente índices compuestos en producción: `idx_sesiones_fecha`, `idx_sesiones_fecha_sede`, `idx_sesiones_simclic_id`, `idx_sesiones_docente_id`, `idx_sesiones_estado_ucs`, `idx_asistencias_fecha_sede`, `idx_asistencias_usuario_fecha` e `idx_asistencias_estado`.
  - **Verificación Técnica**:
    - Medición en vivo ejecutada: 187 sesiones procesadas en 2.3 segundos con 0 escrituras redundantes.
    - Compilación TypeScript estricta verificada con `npx tsc --noEmit` (**0 errores**).

* `feat(gemini-pro-copilot)`: **Hito 64: Integración de Asistente IA Google Gemini con Function Calling en Vivo y Centro de Control Exclusivo para Super Admin (DNI: 00000001)**:
  - **Contexto & Solicitud del Usuario**:
    - Incorporación de un chatbot inteligente conectado a la API de Google Gemini Pro / Flash con capacidad para ejecutar herramientas en tiempo real (sincronizar con SimClic, consultar salas ocupadas/libres, clases programadas, asistencias y horas de Pacientes Simulados).
    - Creación de un **nuevo Tab exclusivo para el rol `super_admin` (DNI: `00000001`)** en el dashboard de administración para supervisar el consumo acumulado de tokens, auditar consultas y apagar/encender el chatbot a voluntad.
  - **Implementación Técnica**:
    - **Tablas de Base de Datos en Neon PostgreSQL (`src/db/schema.ts`)**:
      - `configuracion_gemini`: Registro maestro singleton con estado (`habilitado`), modelo activo (`gemini-3.5-flash`, `gemini-pro-latest`, etc.), contadores acumulados de tokens de entrada (`total_input_tokens`), tokens de salida (`total_output_tokens`), tokens totales (`total_tokens`), peticiones realizadas (`total_requests`) y costo estimado acumulado en USD (`costo_total_estimado_usd`).
      - `logs_gemini_requests`: Registro histórico de auditoría por consulta con usuario (`id, dni, nombre`), prompt, respuesta generada, modelo utilizado, tokens consumidos, costo individual en USD, duración en ms, herramientas ejecutadas (`jsonb`) y estado.
    - **Motor de Inferencia y Herramientas Locales (`src/lib/geminiService.ts`)**:
      - Conexión directa a Google Generative Language API con soporte de `tools` (Function Calling):
        1. `sincronizar_simclic`: Ejecuta la sincronización en vivo con SockJS Meteor WebSocket (`syncSimclicSessions`) para cualquier fecha o el día actual.
        2. `consultar_programacion_dia`: Consulta sesiones, docentes asignados y horarios cruzando `sesionesProgramadas`, `cursos`, `ambientes` y `sedes`.
        3. `consultar_salas_disponibilidad`: Cruza los 60 ambientes con las sesiones y turnos en curso en el minuto exacto, reportando salas libres vs ocupadas.
        4. `consultar_asistencias_hoy`: Consulta el personal en turno actual, tardanzas y marcaciones de salida.
        5. `consultar_pacientes_simulados`: Agrupa y calcula horas acumuladas y montos estimados en S/. para PS en el mes solicitado.
      - Soporte para roles de API moderna (`role: 'user'` para `functionResponse` con `id` de llamada) y cálculo preciso de costos ($0.075 / 1M prompt en Flash, $0.30 / 1M output).
    - **APIs REST de Copilot & Seguridad (`src/app/api/copilot/`)**:
      - `/api/copilot/config`: `GET` y `POST` blindados con validación estricta (`session.rolSistema === 'super_admin' || session.dni === '00000001'`). Permite alternar el switch maestro (`toggle_enabled`), cambiar de modelo o reiniciar los contadores a 0.
      - `/api/copilot/chat`: Valida autenticación y estado del switch. Si `habilitado === false`, rechaza la solicitud de inmediato garantizando **0 tokens consumidos**.
      - `/api/copilot/test`: Endpoint para probar latencia y conectividad en 1 clic.
      - `/api/copilot/status`: Consulta ligera del estado para la interfaz.
    - **Panel de Control en Frontend (`src/components/admin/tabs/GeminiAdminTab.tsx`)**:
      - **Master Switch Visual**: Tarjeta interactiva de encendido/apagado global del chatbot con indicadores visuales (Verde En Línea / Rojo Suspendido).
      - **4 Tarjetas KPI de Consumo**: Total Tokens Consumidos (Prompt vs Output), Costo Estimado ($ USD y S/. Soles al cambio 3.75), Consultas Totales y Modelo Activo.
      - **Acciones Rápidas**: Probar conexión en vivo con Gemini, recargar datos y reiniciar contadores con confirmación.
      - **Selector de Modelo**: Conmutación inmediata entre `gemini-3.5-flash`, `gemini-flash-latest`, `gemini-pro-latest` y `gemini-3.8-flash`.
      - **Tabla de Auditoría de Consultas**: Historial con buscador, visualización de herramientas invocadas, tokens por petición, costo individual y modal con prompt/respuesta completos.
    - **Widget Flotante & Drawer (`src/components/admin/copilot/UcsCopilotDrawer.tsx`)**:
      - Botón flotante `✨ Copilot UCS` visible para administradores cuando el switch está activo (se oculta automáticamente si el super_admin lo apaga).
      - Drawer conversacional interactivo con chips de sugerencias rápidas, soporte de respuestas Markdown estructuradas (tablas, negritas, listas) y badge de herramientas en ejecución.
      - **Renderizado Interactivo de Archivos .TXT & Exportación a WhatsApp en 1-Clic**: Detecta bloques de texto formateados y presenta una tarjeta estilizada con botones de acción directa: **"📋 Copiar para WhatsApp"**, **"⬇️ Descargar archivo .txt"** y **"📲 Abrir directamente en WhatsApp"**.
    - **Navegación & Seguridad Exclusiva**:
      - Tab `'gemini_ia'` añadido a `AdminTab` en `src/types/admin.ts`.
      - En `AdminDashboard.tsx` y `AdminNavbar.tsx` (versión escritorio y menú móvil Bottom Sheet), la pestaña solo se muestra y es accesible si `session.rolSistema === 'super_admin' || session.dni === '00000001'`.
  - **Verificación Técnica**:
    - Prueba integral en vivo ejecutada exitosamente: Gemini analizó la pregunta *"¿Qué salas están libres en este momento?"*, ejecutó la herramienta `consultar_salas_disponibilidad`, procesó los 60 ambientes de la base de datos y generó una tabla estructurada de 49 salas libres y 11 ocupadas con registro automático en base de datos (5,204 tokens, $0.000573 USD).
    - Compilación estricta validada con `npx tsc --noEmit` (**0 errores**).
    - Bundle de producción validado con `npm run build` (**100% exitoso**).

* `fix(gemini-multiturn-tools)`: **Hito 65: Bucle Multi-Turno en Herramientas Gemini, Preservación de ThoughtSignature, Filtro de Sede y Soporte de Programación para "Mañana"**:
  - **Diagnóstico & Causa Raíz**:
    - Al solicitar *"¿Cuál es la programación de mañana en la sede Villa? Genérame un txt para enviarlo por WhatsApp"*, el asistente devolvió *"He completado la solicitud pero no obtuve texto descriptivo."*
    - **Causa 1**: Incompatibilidad con `thoughtSignature`: La API de Gemini 3.x genera firmas internas de razonamiento (`thoughtSignature`). Al estructurar el turno siguiente con un payload manual en lugar del `candidate.content` original, la API omitía o rechazaba la emisión del texto final.
    - **Causa 2**: Bucle de herramientas truncado: El servicio contaba con un único `if (functionCallPart)` en lugar de un bucle `while (turn < 4)` multi-turno.
    - **Causa 3**: Ausencia de parámetro `sede` en `consultar_programacion_dia`: La herramienta no permitía filtrar directamente por campus, devolviendo 192 sesiones de todas las sedes y saturando la respuesta.
    - **Causa 4**: Cuota del modelo `gemini-3.5-flash`: Alcanzó el límite de 20 peticiones/día de la capa gratuita de Google para esa versión.
  - **Solución Implementada**:
    - **Bucle Multi-Turno Robusto (`src/lib/geminiService.ts`)**: Bucle interactivo de hasta 4 turnos que preserva intacto `candidate.content` (con `thoughtSignature`), inyecta `functionResponse` con su `id` respectivo y espera la generación final del texto descriptivo.
    - **Filtro Nativo de Sede (`consultar_programacion_dia`)**: Se agregó el parámetro `sede` a la especificación de la herramienta y se incorporó el filtrado en `executeGeminiTool`.
    - **Cálculo de Fechas para Perú**: Se incluyó la fecha de mañana calculada de forma determinística en el prompt del sistema (`Fecha de mañana en Lima, Perú: YYYY-MM-DD`).
    - **Soporte de Alta Disponibilidad & Fallback Automático**: Se configuró como modelo predeterminado `gemini-3.5-flash-lite` (sin restricciones estrictas de 20 req/día) y se añadió detección de error 429 con conmutación automática. Se añadieron opciones en el selector de `GeminiAdminTab.tsx`.
  - **Verificación Técnica**:
    - Prueba integral con la consulta exacta del usuario: Gemini ejecutó `consultar_programacion_dia` con `{ sede: 'Villa', fecha: '2026-10-22' }` y generó en 4.2 segundos el bloque estructurado con los botones interactivos de 1-clic para WhatsApp y descarga de `.txt`.
    - `npx tsc --noEmit` superado con **0 errores**.

* `style(copilot-mobile)`: **Hito 66: Posicionamiento Responsivo Móvil del Botón Flotante Copilot**:
  - **Contexto & Solicitud del Usuario**:
    - En la versión móvil, el botón flotante `✨ Copilot UCS` se superponía sobre la barra de navegación inferior (`.bottomNav`), tapando las pestañas de Planilla PS y Sedes/Más.
  - **Implementación Técnica**:
    - Se creó [copilot.module.css](file:///c:/UCS_Registro/src/components/admin/copilot/copilot.module.css) con reglas de media query adaptativas:
      - En desktop (> 768px): mantiene su posición fija estándar (`bottom: 24px; right: 24px`).
      - En móviles (<= 768px): se eleva automáticamente a `bottom: calc(82px + env(safe-area-inset-bottom, 0px)); right: 16px;`, flotando limpiamente por encima de la barra de navegación sin bloquear ningún icono ni etiqueta.
      - En pantallas ultra compactas (<= 380px): padding y tipografía ajustados proporcionalmente.
    - Se integró soporte para `env(safe-area-inset-bottom, 0px)` en el pie del drawer para evitar superposición con la barra de gestos de iOS/Android.
* `feat(gemini-domain-enrichment)`: **Hito 67: Enriquecimiento de IA Copilot para Coordinación de Pacientes Simulados (PS), Técnicos y Logística de Simulación**:
  - **Contexto & Solicitud del Usuario**:
    - El usuario consultó cómo "entrenar" al Copilot para que no se quede corto con las respuestas y sea capaz de responder con precisión las preguntas críticas que realizan diariamente la Coordinadora de Pacientes Simulados (PS) y el Coordinador de Técnicos de Simulación.
  - **Implementación Técnica**:
    - **Inyección de Dominio y Operaciones UCS en `geminiService.ts`**:
      - Se incorporó la cartografía de la Clínica de Simulación: distribución por pisos de la Sede Villa (1er Piso con Alta Fidelidad 1-5, Hospitalización 1-2, Consultorios 1-4; 2do Piso con Consultorios 5-8, Habilidades 1-3 y 5, Ecografías, Auditorio y ECOE), Ate (Piso 4) y Norte (Pisos 8-9).
      - Se definieron los perfiles de Pacientes Simulados (personajes, tarifas base S/. 35.00/h, suplencias en Kiosco).
      - Se definieron las reglas operativas de técnicos (horarios habituales 07:00-16:00 y 13:00-22:00, 10 min de tolerancia, DSO y Banco de Días Compensatorios).
      - Se formalizó la taxonomía logística: **SWAP MAYOR** (cambio de curso y simulador/maqueta) vs. **RESET DE CASO** (mismo curso, reposición de insumos/pads/sondas) y desfases de asistencia.
    - **Herramienta Ampliada: `consultar_pacientes_simulados`**:
      - Ahora admite modo dual:
        1. `programados` (default para hoy o fechas futuras): Cruza `sesionesProgramadas` de SimClic extrayendo nombre del actor, personaje/rol asignado, horario, curso, escenario clínico, aula, sede, docente a cargo y cruce en vivo con `asistencias` (`PRESENTE_EN_SALA`, `PENDIENTE_DE_INGRESO`, notas de suplencia). Permite generar citaciones directas para WhatsApp.
        2. `asistencias`: Reporte de horas acumuladas y pre-liquidación en Soles (S/.) por mes o rango.
    - **Nueva Herramienta: `consultar_equipo_tecnicos`**:
      - Devuelve la cobertura completa de técnicos para hoy o cualquier fecha:
        - Turno asignado en la malla (`turnosProgramadosTecnicos`: laborable, DSO, descanso compensatorio, notas).
        - Marcación real en Kiosco (`asistencias`: ingreso, salida, sede, sala, tardanza en minutos).
        - Saldo acumulado en el Banco de Días Compensatorios (`bancoCompensatoriosTecnicos`).
        - KPIs consolidados: Total técnicos, En turno activo, En descanso, Con tardanza y Pendientes atrasados.
    - **Nueva Herramienta: `consultar_alertas_logisticas`**:
      - Audita las sesiones programadas del día y detecta automáticamente:
        1. **Transiciones entre bloques de sala**: Alertas de `SWAP_MAYOR` y `RESET_CASO` calculando la ventana disponible en minutos entre clases para el técnico.
        2. **Desfases de asistencia en vivo**: Sesiones activas donde el docente ya marcó en Kiosco pero el PS no ha ingresado (o viceversa).
        3. **Reubicaciones**: Sesiones marcadas con cambio de aula en SimClic.
    - **Chips de Sugerencia Actualizados en Frontend (`UcsCopilotDrawer.tsx`)**:
      - Se integraron accesos rápidos directos a las preguntas de coordinación de PS, técnicos y alertas de sala con formato WhatsApp.
  - **Verificación Técnica**:
    - Compilación estricta validada con `npx tsc --noEmit` (**0 errores**).

* `feat(copilot-excel-export)`: **Hito 68: Renderizado Interactivo de Tablas de Datos y Exportación en 1 Clic a Microsoft Excel (.csv) en Copilot**:
  - **Contexto & Solicitud del Usuario**:
    - El usuario solicitó que al preguntar al Copilot *"¿Cómo van las horas y liquidación de Pacientes Simulados este mes?"* (o cualquier consulta con datos tabulares), la información no solo se visualice en pantalla sino que se pueda descargar directamente en un archivo Excel.
  - **Implementación Técnica**:
    - **Componente `TableCard` con Exportador a Excel (`UcsCopilotDrawer.tsx`)**:
      - Se implementó un parser de tablas Markdown en el flujo de renderizado del chat que detecta automáticamente cualquier tabla devuelta por la IA.
      - Renderiza una tabla estilizada de alto contraste adaptada al tema institucional UCS con filas alternadas (efecto cebra) e insignias de conteo de registros.
      - **Botón `📊 Descargar en Excel (.csv)`**: Genera al vuelo un archivo CSV con delimitador punto y coma (`;`), escape de caracteres especiales y el prefijo byte order mark `\uFEFF` (UTF-8 BOM), garantizando que Microsoft Excel abra el archivo automáticamente en columnas separadas y con tildes y caracteres especiales perfectos.
      - **Botón `📋 Copiar`**: Copia los datos con tabuladores para pegarlos directamente con `Ctrl + V` en cualquier celda de Excel o Google Sheets.
    - **Soporte de Bloques `csv` / `excel` en `CodeBlockCard`**:
      - Si el bloque de código devuelto por Gemini tiene lenguaje `csv`, `excel` o estructura tabular, el encabezado se transforma en una tarjeta verde esmeralda con el botón de descarga para Excel en lugar de WhatsApp.
    - **Instrucción de Dominio en `geminiService.ts`**:
      - Se instruyó al Copilot para que ante consultas de horas, liquidaciones, pagos de honorarios de PS o solicitudes de descarga, presente una tabla Markdown completa y/o bloque `csv` para habilitar el botón de exportación en 1 clic.
  - **Verificación Técnica**:
    - Compilación estricta validada con `npx tsc --noEmit` (**0 errores**).

* `feat(radar-llegada-ps)`: **Hito 69: Radar Preventivo de Llegada de Pacientes Simulados (PS) con Alerta 15 Minutos y Contacto Rápido por WhatsApp**:
  - **Contexto & Solicitud del Usuario**:
    - El equipo de 6 técnicos de la Clínica de Simulación UCS evaluará este sistema frente a una solución rival en Google Sheets + Apps Script desarrollada por 2 compañeros. Dado que el piloto actual se enfoca prioritariamente en **Pacientes Simulados (PS)** y **Técnicos**, el usuario solicitó implementar la **Opción 1: Radar Preventivo de Llegada de Actores con Alerta 15 min** para auditar y anticipar ausencias antes de que inicien las simulaciones.
  - **Implementación Técnica**:
    - **Nuevo Componente `RadarLlegadaActores.tsx` (`src/components/admin/tabs/RadarLlegadaActores.tsx`)**:
      - **Aplanado inteligente de citaciones**: Cruza todas las sesiones activas en SimClic desglosando actores individuales tanto si están en `pacientesSimulados`, `pacientesSimuladosJson` o `pacienteSimuladoNombre`.
      - **Clasificación Semafórica de Riesgo**:
        1. 🚨 **Crítico (Rojo)**: Falta <= 15 minutos para el inicio de la simulación o la sesión ya comenzó y el actor aún no marca en el Kiosco.
        2. 🟡 **Próximo / En Camino (Amarillo)**: Faltan entre 16 y 35 minutos para la citación.
        3. 🟢 **En Sala (Verde)**: Asistencia ya registrada en Kiosco con indicación de la hora real de ingreso.
        4. ⚪ **Turno Más Tarde (Azul/Gris)**: Clases programadas a más de 35 minutos.
        5. 🏁 **Finalizado / Ausente**: Clases concluidas con o sin marcación registrada.
      - **Tarjetas KPI Interactivas**: Total Citaciones Hoy, Riesgo Crítico (<15m), En Camino (16-35m), En Sala y Turnos Más Tarde con filtrado reactivo en 1 clic.
      - **Buscador Reactivo y Filtro por Chips**: Búsqueda por nombre de actor, personaje, sala, código o asignatura.
      - **Contacto en 1 Clic por WhatsApp**:
        - Botón individual `📲 WhatsApp` que localiza el teléfono del actor en `usuariosList`, pre-redacta un mensaje institucional formal con su hora, aula, caso clínico y sede, y abre WhatsApp Web / móvil sin digitar números.
        - Botón `📋 Copiar para WhatsApp`: Genera un reporte consolidado ordenado por nivel de urgencia listo para pegar en el grupo de WhatsApp de Coordinación de Simulación.
      - **Gestión de Contingencias**: Botón `🔄 Registrar Suplente` en tarjetas críticas para activar el modal de asistencia manual y reemplazo en caliente.
    - **Integración en `ProgramacionTab.tsx`**:
      - Nuevo modo de vista `'radar_actores'` añadido al selector principal de vistas.
      - Botón destacado `🎭 Radar Llegada PS` con insignia dinámica de conteo crítico (`🚨 N`).
      - Píldora de alerta pulsante en la barra superior de métricas cuando existen actores en riesgo (`🚨 N PS en Riesgo (<15m)`).
      - La métrica superior de `🎭 Pacientes Simulados` ahora es interactiva y conmuta directamente al Radar.
      - Exclusión limpia de la barra de filtros generales para evitar colisiones visuales con el toolbar del Radar.
  - **Verificación Técnica**:
    - Validación completa con `npx tsc --noEmit` (**0 errores**).

* `perf(neon-egress-optimization)`: **Hito 70: Optimización de Cuota de Red en Neon DB y Ocultamiento Preventivo de Sincronización Semanal**:
  - **Contexto**:
    - El proyecto alcanzó el 91.3% de su cuota de transferencia mensual de red (5 GB) en el plan gratuito de Neon debido a ciclos frecuentes de sincronización en segundo plano y sincronizaciones masivas de semanas completas.
  - **Implementación Técnica**:
    - **Ocultamiento del Botón `📅 Sincronizar Semana`**:
      - Se retiró de la barra de herramientas de `ProgramacionTab.tsx` para evitar descargas pesadas de 7 días continuos en Postgres hasta el siguiente ciclo de facturación.
    - **Optimización de Auto-Sync en Segundo Plano (`AdminDashboard.tsx`)**:
      - El intervalo de sondeo automático se amplió de 3 minutos a **15 minutos** (reducción del 80% en frecuencia).
      - En el ciclo de fondo periódico ahora solo se sincroniza `Hoy` (en vez de `Hoy` + `Mañana`), reduciendo a la mitad el payload por ciclo.
      - El cooldown de re-enfoque de ventana de navegador se aumentó de 2.5 min a 10 min.
      - El badge visual en la barra superior se actualizó a `🟢 Auto-sync activo (15m)`.
    - **Optimización de la Consulta Pública de Aulas (`src/app/consulta/page.tsx`)**:
      - Se eliminó el bucle de auto-sincronización que ejecutaba `POST /api/simclic/sync` cada 3 minutos y al reenfocar en la vista pública.
      - La página ahora opera en modo de **solo lectura limpia de Postgres** (`loadData`), consumiendo una fracción ínfima de datos (<0.04 MB por consulta).
      - La sincronización pesada de SimClic solo se activa si un usuario hace clic deliberadamente en el botón manual `🔄 Actualizar`.
  - **Verificación Técnica**:
    - Compilación estricta validada con `npx tsc --noEmit` (**0 errores**).

* `feat(consulta-ergonomic-navigation)`: **Hito 71: Navegación Ergonómica y Búsqueda Continua en Consulta de Aulas (`/consulta`)**:
  - **Contexto**:
    - Al consultar un docente con múltiples bloques de clase (o docentes espejo en paralelo), el técnico o recepcionista debía scrollear una gran distancia hacia arriba para buscar al siguiente docente que llegaba al counter.
  - **Implementación Técnica**:
    - **Botón Flotante «🔍 Buscar otro docente» (FAB)**:
      - Aparece con animación suave en la esquina inferior derecha cuando el usuario baja más de 250px en la página.
      - Al hacer clic: regresa de la vista individual, realiza un scroll suave al tope y coloca el cursor listo en la caja de búsqueda.
    - **Atajo de Teclado con Tecla `Escape` (`Esc`) o `/`**:
      - Presionar `Esc` desde cualquier punto del detalle del docente reinicia la consulta y enfoca automáticamente el input del buscador sin necesidad de tocar el mouse.
    - **Tarjeta de Cierre al Pie de la Última Clase**:
      - Justo debajo de la última clase y docentes espejo, se renderiza una tarjeta con los botones `🔍 Buscar otro docente` y `⬆️ Volver arriba`.
  - **Verificación Técnica**:
    - Validación completa con `npx tsc --noEmit` (**0 errores**).

* `feat(consulta-espejos-ps)`: **Hito 72: Visualización de Pacientes Simulados (PS) en Docentes Espejo de Consulta Pública (`/consulta`)**:
  - **Contexto & Solicitud del Usuario**:
    - En la vista pública de consulta de aulas (`/consulta`), la tarjeta principal de la clase mostraba al Paciente Simulado asignado (`🎭 Actor / Paciente Simulado: ...`), pero en la sección inferior de "Docentes Espejo en Paralelo", las tarjetas de clases compañeras solo mostraban el docente, la sala y el caso, omitiendo el actor/PS asignado a cada espejo.
  - **Implementación Técnica**:
    - **Backend REST (`src/app/api/consulta/route.ts`)**:
      - Se incluyó `pacientesSimuladosJson` en la consulta `rawSessionsAll` para sesiones con múltiples actores.
      - Se añadió resolución unificada de nombre de PS en `enrichedSessions`.
      - Se enriqueció el payload de `espejos` con el atributo `pacienteSimuladoNombre` de cada sesión paralela.
    - **Frontend de Consulta (`src/app/consulta/page.tsx`)**:
      - Se expandió la interfaz `EspejoDocente` con `pacienteSimuladoNombre?: string | null`.
      - En el renderizado de `mirrorCard`, se agregó la insignia condicional con icono `🎭 PS: [Nombre del Actor]`.
    - **Estilos Adaptados (`src/app/consulta/consulta.module.css`)**:
      - Clases `.mirrorActor` y `.mirrorActorStrong` con diseño en píldora fucsia/púrpura de alto contraste y compatibilidad total con Modo Claro (`#fdf4ff`, border `#f0abfc`, text `#86198f`) y Modo Oscuro (`rgba(168, 85, 247, 0.15)`, text `#c084fc`).
  - **Verificación Técnica**:
    - Verificación directa contra la base de datos para la fecha 23/10/2026: se comprobó que las clases de Simulación Quirúrgica paralelas (13:40-15:20) asocian a Neldo Ernesto Tapia Silva y Leo Gerardo Gómez Ferrua en sus respectivos espejos.
    - Compilación TypeScript estricta validada con `npx tsc --noEmit` (**0 errores**).

* `fix(simclic-sync-rescheduled)`: **Hito 73: Corrección de Sincronización SimClic para Sesiones Reprogramadas y Carga Incompleta de Días Futuros**:
  - **Diagnóstico & Causa Raíz**:
    - Al consultar la programación de "Mañana" (24/10/2026), solo se visualizaban las primeras 36 clases (07:00 a 09:30 AM), quedando vacío el resto del día hasta las 22:00.
    - **Causa Raíz**: Conflicto de unicidad en Postgres (`sesiones_programadas_simclic_id_key`). Una sesión (`simclic_id = 76855`) de Posgrado había sido reprogramada en SimClic desde una fecha anterior (17/10) hacia el 24/10. La consulta de precarga en `simclicSync.ts` solo buscaba registros con `fecha = '2026-10-24'`. Al no encontrarla en ese día, el motor intentó un `INSERT` con el mismo `simclic_id`, lanzando una excepción `duplicate key value` que abortó el bucle de sincronización e impidió guardar las 169 sesiones restantes del día.
  - **Solución Implementada**:
    - **Ampliación del Scope de Detección (`src/lib/simclicSync.ts`)**: Se ajustó la consulta de `existingRows` para buscar por las fechas del payload O por cualquiera de los `simclicId` que vienen en la sincronización (`inArray(simclicId, payloadSimclicIds)`). Esto permite detectar inmediatamente sesiones reprogramadas entre distintas semanas y tratarlas como actualizaciones de fecha y sala en lugar de inserciones duplicadas.
    - **Blindaje con `onConflictDoUpdate`**: En el bloque `db.insert(sesionesProgramadas)`, se añadió `.onConflictDoUpdate({ target: sesionesProgramadas.simclicId, set: { ... } })`, garantizando tolerancia total a fallos y reubicaciones concurrentes.
  - **Verificación Técnica**:
    - Sincronización ejecutada en vivo para el 24/10/2026: **205 sesiones sincronizadas con éxito** (169 en Villa, 28 en Norte, 8 en Ate), cubriendo todos los turnos continuos desde las 07:00 hasta las 22:00.
    - Compilación TypeScript estricta validada con `npx tsc --noEmit` (**0 errores**).

* `feat(sos-salas-backend)`: **Hito 74: Fase 1 del Sistema de Asistencia Técnica / Botón SOS en Salas (Base de Datos & Motor de Caché Cero-Consumo en Neon)**:
  - **Contexto & Filosofía de Operación**:
    - Se diseñó el sistema de reporte y despacho de incidencias técnicas en aulas (proyector sin señal, audio, internet, PC, simuladores) para la Clínica de Simulación UCS.
    - **Modo Operativo de Equipo (Opción A)**: El equipo de 6 técnicos opera desde una ventana fija en una de las 3 PCs de la oficina técnica. Ante una alerta, un solo clic (`🏃 En camino`) silencia la alarma y cambia el estado a amarillo sin demorar al técnico con formularios ni logins individuales. Al regresar, un solo clic (`✅ Resolver`) cierra el ticket.
    - **Preparación Arquitectónica para el Futuro**: La tabla y la API ya cuentan con las columnas `tecnico_id` (FK `usuarios.id`) y `tecnico_nombre` (pre-poblado con `'Equipo de Técnicos'`), de modo que si la jefatura en el futuro solicita atribución individual por colaborador, se activa de inmediato sin migraciones de base de datos ni quiebres de código.
  - **Protección de Cuota Neon Tech (Zero-Egress & Zero-Compute en Reposo)**:
    - **Motor de Caché en Memoria RAM (`src/lib/incidenciasMemoryCache.ts`)**: Mantiene en memoria de Node.js la lista de alertas activas y una marca de tiempo/versión (`version`).
    - **Endpoint de Sondeo Ultra-Ligero (`GET /api/incidencias/poll`)**: Las PCs de guardia de la oficina consultan cada 4-5s enviando su versión actual (`?v=timestamp`). Si no hay nuevas alertas ni cambios de estado, el servidor responde en 1 milisegundo desde memoria RAM con `{ changed: false }` (**< 35 bytes de payload y 0 consultas SQL a Neon Postgres**), eliminando cualquier riesgo de saturar la cuota gratuita de 5 GB.
    - **Anti-Spam / Idempotencia de Sala**: Si un docente envía múltiples clics de alerta desde la misma aula, el backend detecta si ya existe una alerta activa (`pendiente` o `en_camino`) para ese `ambienteId` y devuelve la existente en lugar de duplicarla.
  - **Estructura de Base de Datos Creada (`src/db/schema.ts` & `src/db/migrate_incidencias.ts`)**:
    - **Tabla `incidencias_sala`**:
      - `id`: Serial primario.
      - `sede_id` & `ambiente_id`: FK con `ON DELETE CASCADE`.
      - `categoria`: Tipo de falla (`'proyeccion'`, `'audio'`, `'red'`, `'computadora'`, `'simulador'`, `'otro'`).
      - `descripcion`: Texto libre opcional.
      - `docente_nombre` & `curso_nombre`: Contexto de la sesión en curso.
      - `estado`: `'pendiente'` | `'en_camino'` | `'resuelto'` | `'cancelado'`.
      - `tecnico_id` & `tecnico_nombre`: Asignación técnica extensible.
      - `motivo_resolucion` & `nota_resolucion`: Diagnóstico de cierre (`'cable_hdmi'`, `'duplicar_pantalla'`, `'reinicio_pc'`, etc.).
      - `created_at`, `atendido_at`, `resuelto_at`: Medición exacta de SLA de reacción y resolución.
      - Índices Postgres creados en `estado`, `ambiente_id` y `created_at DESC`.
  - **Endpoints API Implementados**:
    - `POST /api/incidencias`: Registro de alerta desde el aula con deduplicación por sala y notificación en memoria RAM.
    - `GET /api/incidencias`: Consulta de incidencias activas o histórico (`?all=true`) o consulta de estado de aula (`?ambienteId=N`).
    - `GET /api/incidencias/poll`: Sondeo de bajo impacto para la PC de guardia.
    - `PATCH /api/incidencias` y `PATCH /api/incidencias/[id]`: Transición atómica de estados (`en_camino`, `resolver`, `cancelar`).
  - **Verificación Técnica**:
    - Migración ejecutada con éxito en Neon Postgres (`src/db/migrate_incidencias.ts`).
    - Inspección directa de columnas e índices en base de datos.
    - Validación TypeScript estricta con `cmd /c npx tsc --noEmit` (**0 errores**).

---

### Hito 75: Ecosistema Completo de Asistencia Técnica en Salas (Tab Admin, Terminales Multi-PC, PIN Maestro, Botones Dinámicos, Aula `/sala` y Central de Guardia `/guardia`)
- **Fecha**: 25 de Octubre, 2026
- **Objetivo**: Desarrollar la arquitectura integral de soporte en simulación solicitada: nuevo Tab Admin con KPIs y exportación Excel, soporte de múltiples PCs/laptops por ambiente, configuración de PIN maestro, gestor de botones de asistencia personalizables, pantalla táctil de aula para docentes y central de monitoreo de guardia en tiempo real con cero consumo de egress en Neon Tech.
- **Implementación Técnica**:
  - **Base de Datos & Esquema (`schema.ts` & `migrate_soporte_salas.ts`)**:
    - `terminales_sala`: Soporte para vincular $N$ dispositivos por ambiente (`ambiente_id`, `sede_id`, `token` único, `nombre`, `tipo_dispositivo`, `activo`, `ultimo_acceso`).
    - `categorias_incidencia`: Catálogo dinámico de botones de sala con `nombre`, `icono`, `color`, `tipo`, `prioridad`, `orden` y switch `activo`.
    - `configuracion_sistema`: Almacén de configuraciones globales (`pin_maestro_salas`, `modo_tecnicos`, `sonido_alerta_habilitado`).
    - Columnas añadidas a `incidencias_sala`: `terminal_id` y `terminal_nombre`.
  - **Vista 1: Tab de Administrador (`AlertasSosTab.tsx` en `AdminDashboard.tsx`)**:
    - Acceso exclusivo para roles `admin` y `super_admin` con botón destacado en barra de pestañas y mobile sheet.
    - **Sub-Tab Métricas & Historial**: Tarjetas KPI (Total alertas hoy, Resueltas, SLA de respuesta promedio, Tiempo total de resolución), Top 5 salas con mayor frecuencia de llamados, distribución de categorías y tabla detallada con filtros.
    - **Exportación Excel (.xlsx / CSV UTF-8)**: Descarga directa con formato ejecutivo y codificación `\uFEFF` para apertura nativa en Microsoft Excel.
    - **Sub-Tab Terminales & PIN**: Visualización y edición del PIN maestro con validación numérica y matriz de salas con switch para habilitar/deshabilitar o desvincular PCs individualmente.
    - **Sub-Tab Botones de Asistencia**: Gestor modular para crear o editar botones táctiles (ej: *Pilas para intercomunicador*, *Hojas de asistencia*, *Simulador trabado*) con selector visual de colores y emojis.
  - **Vista 2: Pantalla de Aula / Docente (`/sala`)**:
    - Modal de vinculación con PIN Maestro ejecutado una sola vez por equipo físico, persistente en `localStorage`.
    - Detección automática en vivo de la clase en curso (docente, curso, horario, carrera).
    - Grid de botones táctiles gigantes de 1 toque con feedback visual inmediato.
    - Banner de estado en vivo (*"🚨 Alerta enviada"*, *"🏃 Asistencia en camino"* con nombre del técnico asignado).
    - Botón de cancelación inmediata (*"Presioné por error"*) activo durante los primeros 35 segundos.
  - **Vista 3: Central de Guardia para Técnicos (`/guardia`)**:
    - Optimizado para pantalla fija en la oficina de soporte.
    - Sondeo en memoria RAM ultra-rápido (`/api/incidencias/poll`) con <35 bytes y 0 consultas a Postgres cuando no hay cambios.
    - Alerta sonora sintetizada en tiempo real mediante **Web Audio API** (doble tono 880Hz -> 1174Hz) sin descargas de archivos de audio.
    - Operativa de 1 clic: **"🏃 Vamos en camino"** y modal de resolución rápida con motivos estructurados (*Reinicio de simulador*, *Cable HDMI*, *Pilas cambiadas*, etc.).
    - Preparado con selector de identificación express por DNI para asignación individual futura.
  - **Verificación Técnica & Pulido Visual**:
    - Migración ejecutada con éxito en Neon Postgres (`migrate_soporte_salas.ts`).
    - Homogenización visual de la pestaña `🚨 Alertas SOS & Salas`: adopción nativa de `.tabBtn` y `.activeTab` con acento naranja UCS (`#ff5a00`) idéntico a las demás pestañas.
    - Corrección de botones de acción (`Recargar` y `Exportar Excel`): aplicación de `.secondaryActionBtn` y `.actionBtn` con bordes redondeados, tonos UCS y badges de contador.
    - Compilación TypeScript estricta con `npx tsc --noEmit` (**0 errores**).

---


## 🎯 5. Próximas Mejoras Planificadas (Backlog)

1. **Modo Live Board (Pantalla TV para Recepción) (`/live` o `/pantalla`)**:
   - Vista a pantalla completa en tiempo real con el estado de ocupación de las salas para proyectar en Smart TV en recepción/pasillo sin requerir login.
2. **Marcación con Fotocheck UCS (Código de Barras / QR)**:
   - Integración con lector USB en el kiosco para marcación instantánea sin digitar DNI.
3. **Integración con Programación de SimClic**:
   - Programación 360° en tiempo real con línea de tiempo Gantt, cruce con marcación de docentes y pacientes simulados, y auditoría preventiva de ausentismo (Completado).
4. **Auditoría Bloque a Bloque y Detección de Cobertura Parcial / Retiro Anticipado (`AsistenciasTab.tsx` & `ModalAuditoriaProgramacion.tsx`)** (Completado - Hito 36).
5. **Hub Logístico de Simulación, Radar de Reset de Salas y Optimizador de Continuidad/Acarreo Inter-Días** (Completado - Hito 37).
6. **Línea de Gantt Logística y Radar Temporal de Cambios Pendientes** (Completado - Hito 38).
7. **Timeline Bridge Gantt de Continuidad Inter-Días & Detección de Reciclaje de Casos** (Completado - Hito 39).
8. **Renombrado Logístico y Alto Contraste en Modo Claro** (Completado - Hito 40).






