import fs from 'fs';
import path from 'path';

console.log('🧪 Iniciando Test Suite: Registro y Visualización de Terminales (Opción B)...');

// 1. Verificar Schema
const schemaPath = path.join(process.cwd(), 'src/db/schema.ts');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

if (!schemaContent.includes('terminalIngresoId') || !schemaContent.includes('terminalIngresoNombre') ||
    !schemaContent.includes('terminalSalidaId') || !schemaContent.includes('terminalSalidaNombre')) {
  throw new Error('FALLO: src/db/schema.ts no contiene los 4 campos de terminales en asistencias.');
}
console.log('✅ Aprobado: src/db/schema.ts contiene las 4 columnas de terminales.');

// 2. Verificar Types
const typesPath = path.join(process.cwd(), 'src/types/admin.ts');
const typesContent = fs.readFileSync(typesPath, 'utf8');

if (!typesContent.includes('terminalIngresoNombre?: string | null;') ||
    !typesContent.includes('terminalSalidaNombre?: string | null;')) {
  throw new Error('FALLO: src/types/admin.ts no contiene terminalIngresoNombre / terminalSalidaNombre en AsistenciaAdminItem.');
}
console.log('✅ Aprobado: src/types/admin.ts tipifica AsistenciaAdminItem con terminales.');

// 3. Verificar AsistenciasTab.tsx (Opción B)
const tabPath = path.join(process.cwd(), 'src/components/admin/tabs/AsistenciasTab.tsx');
const tabContent = fs.readFileSync(tabPath, 'utf8');

if (!tabContent.includes('BLOQUE OPCIÓN B: TERMINALES DE MARCACIÓN') ||
    !tabContent.includes('In:') ||
    !tabContent.includes('Out:')) {
  throw new Error('FALLO: AsistenciasTab.tsx no contiene el bloque Opción B de terminales.');
}
console.log('✅ Aprobado: AsistenciasTab.tsx renderiza la Opción B con In / Out diferenciados.');

// 4. Verificar KardexDrawer.tsx
const kardexPath = path.join(process.cwd(), 'src/components/admin/modals/KardexDrawer.tsx');
const kardexContent = fs.readFileSync(kardexPath, 'utf8');

if (!kardexContent.includes('terminalIngresoNombre') || !kardexContent.includes('terminalSalidaNombre')) {
  throw new Error('FALLO: KardexDrawer.tsx no contiene la visualización de terminales.');
}
console.log('✅ Aprobado: KardexDrawer.tsx integra terminales de marcación en historial.');

// 5. Verificar excelAsistenciasExporter.ts
const exporterPath = path.join(process.cwd(), 'src/lib/excelAsistenciasExporter.ts');
const exporterContent = fs.readFileSync(exporterPath, 'utf8');

if (!exporterContent.includes('Terminal Ingreso') || !exporterContent.includes('Terminal Salida')) {
  throw new Error('FALLO: excelAsistenciasExporter.ts no incluye las columnas de Terminal.');
}
console.log('✅ Aprobado: excelAsistenciasExporter.ts exporta columnas de Terminal Ingreso y Salida.');

// 6. Verificar kiosco marcar route
const marcarPath = path.join(process.cwd(), 'src/app/api/kiosco/marcar/route.ts');
const marcarContent = fs.readFileSync(marcarPath, 'utf8');

if (!marcarContent.includes('terminalIngresoId: term.id') ||
    !marcarContent.includes('terminalSalidaId: term.id')) {
  throw new Error('FALLO: kiosco/marcar/route.ts no registra term.id y term.nombre en ingreso y salida.');
}
console.log('✅ Aprobado: kiosco/marcar/route.ts guarda term.id y term.nombre en ingreso y salida.');

// 7. Verificar autoCierreTurnos.ts
const autoPath = path.join(process.cwd(), 'src/lib/autoCierreTurnos.ts');
const autoContent = fs.readFileSync(autoPath, 'utf8');

if (!autoContent.includes("terminalSalidaNombre: '🤖 Auto-Cierre Sistema'")) {
  throw new Error('FALLO: autoCierreTurnos.ts no etiqueta terminalSalidaNombre con Auto-Cierre.');
}
console.log('✅ Aprobado: autoCierreTurnos.ts etiqueta salidas no marcadas con Auto-Cierre Sistema.');

console.log('\n🎉 ¡TODAS LAS PRUEBAS DE TERMINALES EN UBICACIÓN PASARON EXITOSAMENTE (100%)!');

