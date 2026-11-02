import React from 'react';
import { TabErrorBoundary } from '@/components/admin/TabErrorBoundary';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Falló la aserción: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ ${message}`);
  }
}

async function runTests() {
  console.log('--- INICIANDO PRUEBAS DE RESILIENCIA Y TAB ERROR BOUNDARY ---');

  // 1. Estado inicial
  const spy = { resetCalled: false };
  const mockReset = () => {
    spy.resetCalled = true;
  };

  const instance = new TabErrorBoundary({
    tabName: 'Salas y Ambientes de Simulación',
    children: React.createElement('div', null, 'Contenido Sala'),
    onReset: mockReset,
  });

  // Emulador de setState para pruebas unitarias sin DOM
  instance.setState = function (updater: any) {
    const next = typeof updater === 'function' ? updater(this.state) : updater;
    this.state = { ...this.state, ...next };
  };

  assert(instance.state.hasError === false, 'El estado inicial de hasError debe ser false');
  assert(instance.state.error === null, 'El estado inicial de error debe ser null');
  assert(instance.state.showDetails === false, 'El estado inicial de showDetails debe ser false');

  // 2. Renderizado normal sin error
  const normalRender = instance.render();
  assert(
    React.isValidElement(normalRender),
    'El renderizado normal debe retornar el ReactElement hijo'
  );

  // 3. Captura estática de error con getDerivedStateFromError
  const simulatedError = new Error('Fallo crítico simulado en tabla de ambientes');
  const derivedState = TabErrorBoundary.getDerivedStateFromError(simulatedError);
  assert(derivedState.hasError === true, 'getDerivedStateFromError debe retornar hasError: true');
  assert(derivedState.error === simulatedError, 'getDerivedStateFromError debe guardar el error original');

  // 4. Actualizar estado del boundary al modo de error
  instance.state = {
    hasError: true,
    error: simulatedError,
    errorInfo: { componentStack: '\n    in AmbientesTable\n    in AmbientesTab' },
    showDetails: false,
  };

  // 5. Renderizado en modo error
  const errorRender = instance.render() as React.ReactElement<any>;
  assert(React.isValidElement(errorRender), 'El renderizado en error debe retornar un ReactElement (UI de fallback)');
  assert(errorRender.props.role === 'alert', 'El contenedor de error debe tener role="alert" para accesibilidad');

  // 6. Prueba de reseteo y recuperación controlada
  instance.handleReset();
  assert(spy.resetCalled === true, 'handleReset debe invocar el callback onReset proporcionado por AdminDashboard');
  assert(instance.state.hasError === false, 'handleReset debe reiniciar hasError a false');
  assert(instance.state.error === null, 'handleReset debe reiniciar error a null');
  assert(instance.state.showDetails === false, 'handleReset debe reiniciar showDetails a false');

  // 7. Prueba del toggle de diagnóstico técnico
  assert(instance.state.showDetails === false, 'showDetails debe iniciar en false');
  instance.toggleDetails();
  assert(instance.state.showDetails === true, 'toggleDetails debe alternar showDetails a true');
  instance.toggleDetails();
  assert(instance.state.showDetails === false, 'toggleDetails debe volver a alternar showDetails a false');

  console.log('--- TODAS LAS PRUEBAS DE RESILIENCIA Y RECUPERACIÓN PASARON CON ÉXITO ---');
}

runTests().catch((err) => {
  console.error('Error durante la ejecución de pruebas:', err);
  process.exit(1);
});
