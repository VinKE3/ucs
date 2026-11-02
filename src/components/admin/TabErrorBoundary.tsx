'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

export interface TabErrorBoundaryProps {
  children: ReactNode;
  tabName?: string;
  onReset?: () => void;
  fallback?: ReactNode;
}

interface TabErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class TabErrorBoundary extends Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
  constructor(props: TabErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<TabErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[TabErrorBoundary] Error capturado en la pestaña "${this.props.tabName || 'Desconocida'}":`,
      error,
      errorInfo
    );
    this.setState({ errorInfo });
  }

  handleReset = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { tabName = 'esta sección' } = this.props;
      const { error, errorInfo, showDetails } = this.state;

      return (
        <div
          role="alert"
          style={{
            margin: '1.5rem 0',
            padding: '2.5rem 1.5rem',
            background: 'var(--bg-card, rgba(11, 34, 71, 0.75))',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '16px',
            boxShadow: '0 10px 30px -5px rgba(239, 68, 68, 0.12)',
            textAlign: 'center',
            color: 'var(--text-primary, #ffffff)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* Badge Icono de Alerta */}
          <div
            style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 1.25rem',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.85rem',
            }}
          >
            ⚠️
          </div>

          <h3
            style={{
              margin: '0 0 0.5rem 0',
              fontSize: '1.3rem',
              fontWeight: 700,
              color: 'var(--text-primary, #ffffff)',
              letterSpacing: '-0.01em',
            }}
          >
            Problema inesperado en la vista de {tabName}
          </h3>

          <p
            style={{
              margin: '0 auto 1.75rem',
              maxWidth: '560px',
              fontSize: '0.92rem',
              color: 'var(--text-muted, #94a3b8)',
              lineHeight: 1.55,
            }}
          >
            El resto del sistema sigue 100% operativo. Puedes intentar reiniciar esta pestaña sin perder tu sesión ni interrumpir el trabajo en otros campus.
          </p>

          {/* Botones de acción */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.7rem 1.5rem',
                backgroundColor: 'var(--ucs-orange, #ff5a00)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.92rem',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                boxShadow: '0 4px 14px rgba(255, 90, 0, 0.35)',
              }}
            >
              <span>🔄</span>
              <span>Reintentar pestaña</span>
            </button>

            <button
              type="button"
              onClick={this.toggleDetails}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.7rem 1.15rem',
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-secondary, #cbd5e1)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                borderRadius: '8px',
                fontWeight: 500,
                fontSize: '0.88rem',
                cursor: 'pointer',
              }}
            >
              <span>{showDetails ? 'Ocultar diagnóstico' : 'Ver diagnóstico técnico'}</span>
              <span>{showDetails ? '▲' : '▼'}</span>
            </button>
          </div>

          {/* Panel de diagnóstico desplegable */}
          {showDetails && (
            <div
              style={{
                marginTop: '1.75rem',
                textAlign: 'left',
                padding: '1.25rem',
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.82rem',
                color: '#f87171',
                overflowX: 'auto',
                maxHeight: '300px',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#fca5a5' }}>
                Error: {error?.message || 'Error desconocido'}
              </div>
              {error?.stack && (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.4 }}>
                  {error.stack}
                </pre>
              )}
              {errorInfo?.componentStack && (
                <div style={{ marginTop: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '0.65rem' }}>
                  <span style={{ color: 'var(--text-secondary, #cbd5e1)', fontWeight: 600 }}>Pila del Componente React:</span>
                  <pre style={{ margin: '0.35rem 0 0 0', whiteSpace: 'pre-wrap', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.4 }}>
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

