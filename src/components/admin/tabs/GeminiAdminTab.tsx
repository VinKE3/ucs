'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { SessionPayload } from '@/lib/auth';
import type { GeminiConfigItem, GeminiLogItem } from '@/types/admin';
import { showToast, confirmDelete } from '@/lib/alerts';
import styles from '@/app/admin/admin.module.css';

interface GeminiAdminTabProps {
  session: SessionPayload;
}

export const GeminiAdminTab: React.FC<GeminiAdminTabProps> = ({ session }) => {
  const [config, setConfig] = useState<GeminiConfigItem | null>(null);
  const [logs, setLogs] = useState<GeminiLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');
  const [searchLog, setSearchLog] = useState('');
  const [selectedLog, setSelectedLog] = useState<GeminiLogItem | null>(null);

  const isSuperAdmin =
    session.rolSistema === 'super_admin' || session.dni === '00000001';

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/copilot/config');
      if (!res.ok) {
        throw new Error('Error al cargar la configuración de Gemini');
      }
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setLogs(data.logs || []);
        if (data.config?.modelo) {
          setSelectedModel(data.config.modelo);
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error al conectar con el servidor', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      loadData();
    }
  }, [isSuperAdmin, loadData]);

  // Si no es super admin, mostrar bloqueo estricto
  if (!isSuperAdmin) {
    return (
      <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Acceso Restringido a Super Administrador
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
          Este panel de control de IA, consumo de tokens y auditoría está reservado exclusivamente para la cuenta raíz del sistema (DNI: 00000001).
        </p>
      </div>
    );
  }

  // Activar / Desactivar Chatbot
  const handleToggleChatbot = async () => {
    if (!config || toggling) return;
    const nuevoEstado = !config.habilitado;
    setToggling(true);
    try {
      const res = await fetch('/api/copilot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_enabled',
          habilitado: nuevoEstado,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        showToast(
          nuevoEstado
            ? '✅ Asistente IA Gemini activado para los usuarios'
            : '⏸️ Asistente IA desactivado (0 consumo de tokens)',
          nuevoEstado ? 'success' : 'info'
        );
      } else {
        showToast(data.error || 'Error al cambiar estado', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error de conexión', 'error');
    } finally {
      setToggling(false);
    }
  };

  // Cambiar modelo de IA
  const handleChangeModel = async () => {
    if (savingModel) return;
    setSavingModel(true);
    try {
      const res = await fetch('/api/copilot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_model',
          modelo: selectedModel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        showToast(`Modelo actualizado a ${selectedModel}`, 'success');
      } else {
        showToast(data.error || 'Error al guardar modelo', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error de red', 'error');
    } finally {
      setSavingModel(false);
    }
  };

  // Probar conexión en vivo
  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/copilot/test', { method: 'POST' });
      const data = await res.json();
      if (data.exitoso) {
        showToast(
          `⚡ Gemini responde en ${data.duracionMs}ms (${data.modelo})`,
          'success'
        );
      } else {
        showToast(`❌ Error al conectar: ${data.error}`, 'error');
      }
    } catch (err: any) {
      showToast('Error de red al probar conexión', 'error');
    } finally {
      setTesting(false);
    }
  };

  // Reiniciar contadores
  const handleResetMetrics = async () => {
    const confirm = await confirmDelete(
      '¿Reiniciar los contadores de consumo de tokens a cero? Esta acción no borra el historial de logs, solo resetea el acumulador.'
    );
    if (!confirm) return;

    try {
      const res = await fetch('/api/copilot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_metrics' }),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        showToast('Contadores reiniciados a 0', 'success');
      }
    } catch (err: any) {
      showToast('Error al reiniciar métricas', 'error');
    }
  };

  // Filtrado de logs
  const logsFiltrados = logs.filter((l) => {
    if (!searchLog.trim()) return true;
    const term = searchLog.toLowerCase();
    return (
      l.prompt.toLowerCase().includes(term) ||
      (l.usuarioNombre && l.usuarioNombre.toLowerCase().includes(term)) ||
      (l.usuarioDni && l.usuarioDni.includes(term)) ||
      (l.respuesta && l.respuesta.toLowerCase().includes(term))
    );
  });

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '1rem 0 3rem 0' }}>
      {/* HEADER PRINCIPAL */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🤖</span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Centro de Control Gemini Pro & Consumo de Tokens
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Exclusivo Super Admin
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Supervisa en tiempo real el gasto de tokens, audita llamadas a herramientas SimClic y activa o suspende el asistente para toda la institución.
          </p>
        </div>

        {/* ACCIONES SUPERIORES */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              cursor: testing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <span>{testing ? '⏳' : '⚡'}</span>
            <span>{testing ? 'Probando...' : 'Probar Conexión'}</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <span>🔄</span>
            <span>Actualizar</span>
          </button>

          <button
            type="button"
            onClick={handleResetMetrics}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <span>🗑️</span>
            <span>Reiniciar Contadores</span>
          </button>
        </div>
      </div>

      {/* MASTER SWITCH CARD */}
      <div
        style={{
          background: config?.habilitado
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(56, 189, 248, 0.08) 100%)'
            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)',
          border: `1.5px solid ${config?.habilitado ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          borderRadius: '16px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: config?.habilitado ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
            }}
          >
            {config?.habilitado ? '🟢' : '🔴'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {config?.habilitado ? 'CHATBOT ACTIVO Y EN SERVICIO' : 'CHATBOT DESHABILITADO (0 CONSUMO)'}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  background: config?.habilitado ? '#10b981' : '#ef4444',
                  color: '#fff',
                }}
              >
                {config?.habilitado ? 'EN LÍNEA' : 'SUSPENDIDO'}
              </span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {config?.habilitado
                ? 'El botón flotante de Copilot está visible para administradores y responde consultas con herramientas SimClic.'
                : 'El acceso al chatbot está bloqueado en toda la plataforma. Ninguna llamada a la API de Gemini será permitida.'}
            </p>
          </div>
        </div>

        {/* BOTÓN TOGGLE SWITCH */}
        <button
          type="button"
          onClick={handleToggleChatbot}
          disabled={toggling}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1.5rem',
            borderRadius: '12px',
            border: 'none',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: toggling ? 'not-allowed' : 'pointer',
            background: config?.habilitado
              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#fff',
            boxShadow: config?.habilitado
              ? '0 4px 14px rgba(239, 68, 68, 0.35)'
              : '0 4px 14px rgba(16, 185, 129, 0.35)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <span>{toggling ? '⏳' : config?.habilitado ? '⏸️' : '▶️'}</span>
          <span>{config?.habilitado ? 'Deshabilitar Chatbot' : 'Habilitar Chatbot'}</span>
        </button>
      </div>

      {/* TARJETAS DE MÉTRICAS KPIS (4 GRID) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* KPI 1: TOTAL TOKENS */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.25rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Tokens Consumidos
            </span>
            <span style={{ fontSize: '1.4rem' }}>🪙</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.5rem' }}>
            {(config?.totalTokens || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Prompt: <b>{(config?.totalInputTokens || 0).toLocaleString()}</b> | Salida: <b>{(config?.totalOutputTokens || 0).toLocaleString()}</b>
          </div>
        </div>

        {/* KPI 2: COSTO ACUMULADO */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.25rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Costo Acumulado
            </span>
            <span style={{ fontSize: '1.4rem' }}>💵</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', marginTop: '0.5rem' }}>
            ${(config?.costoTotalEstimadoUsd || 0).toFixed(4)} <span style={{ fontSize: '1rem', fontWeight: 600 }}>USD</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Aprox. <b>S/. {(config?.costoTotalEstimadoPen || 0).toFixed(2)} PEN</b> (T.C. 3.75)
          </div>
        </div>

        {/* KPI 3: CONSULTAS REALIZADAS */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.25rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Consultas Totales
            </span>
            <span style={{ fontSize: '1.4rem' }}>💬</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#a855f7', marginTop: '0.5rem' }}>
            {config?.totalRequests || 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Peticiones atendidas con Google Gemini
          </div>
        </div>

        {/* KPI 4: MODELO SELECCIONADO */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '1.25rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Modelo Activo
            </span>
            <span style={{ fontSize: '1.4rem' }}>⚡</span>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.75rem' }}>
            {config?.modelo || 'gemini-3.8-flash'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Google Generative AI Pro / Flash
          </div>
        </div>
      </div>

      {/* SELECTOR DE MODELO */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              ⚙️ Selección de Modelo Google Gemini
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Elige entre el modelo ultrarrápido y económico (Flash) o el modelo de máxima capacidad y razonamiento (Pro).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary, #fff)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value="gemini-3.5-flash">gemini-3.5-flash (Recomendado - Ultrarrápido & Estable)</option>
              <option value="gemini-flash-latest">gemini-flash-latest (Última versión Flash)</option>
              <option value="gemini-pro-latest">gemini-pro-latest (Máximo Razonamiento Pro)</option>
              <option value="gemini-3.8-flash">gemini-3.8-flash (Preview)</option>
            </select>

            <button
              type="button"
              onClick={handleChangeModel}
              disabled={savingModel || selectedModel === config?.modelo}
              style={{
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                background: selectedModel === config?.modelo ? 'var(--border-color)' : '#38bdf8',
                color: selectedModel === config?.modelo ? 'var(--text-muted)' : '#000',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: selectedModel === config?.modelo || savingModel ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {savingModel ? 'Guardando...' : 'Aplicar Modelo'}
            </button>
          </div>
        </div>
      </div>

      {/* REGISTRO DE AUDITORÍA DE CONSULTAS (LOGS) */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '1.25rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              📜 Auditoría de Consultas & Ejecución de Herramientas
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Historial detallado de prompts de usuarios, tokens gastados, herramientas invocadas y costo individual.
            </p>
          </div>

          <div style={{ position: 'relative', minWidth: '260px' }}>
            <input
              type="text"
              placeholder="Buscar por usuario o pregunta..."
              value={searchLog}
              onChange={(e) => setSearchLog(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary, #fff)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            />
          </div>
        </div>

        {/* TABLA DE AUDITORÍA */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '2px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  textAlign: 'left',
                }}
              >
                <th style={{ padding: '0.65rem 0.75rem' }}>Fecha / Hora</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Usuario</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Pregunta / Prompt</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Herramientas Ejecutadas</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Tokens</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Costo ($)</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Latencia</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {logsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {searchLog ? 'No se encontraron consultas con ese filtro.' : 'Aún no hay registros de consultas en el sistema.'}
                  </td>
                </tr>
              ) : (
                logsFiltrados.map((log) => {
                  const fechaObj = new Date(log.createdAt);
                  const horaStr = fechaObj.toLocaleTimeString('es-PE', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });
                  const fechaStr = fechaObj.toLocaleDateString('es-PE');
                  const herramientas = Array.isArray(log.herramientasEjecutadas)
                    ? log.herramientasEjecutadas
                    : [];

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--row-hover-bg, rgba(0,0,0,0.02))';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{horaStr}</div>
                        <div style={{ fontSize: '0.75rem' }}>{fechaStr}</div>
                      </td>

                      <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {log.usuarioNombre || 'Anónimo'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          DNI: {log.usuarioDni || '--'}
                        </div>
                      </td>

                      <td style={{ padding: '0.65rem 0.75rem', maxWidth: '320px' }}>
                        <div
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                          }}
                          title={log.prompt}
                        >
                          {log.prompt}
                        </div>
                      </td>

                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        {herramientas.length === 0 ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ninguna (Chat)</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {herramientas.map((h, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  color: '#0284c7',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                ⚡ {h}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                          {log.totalTokens.toLocaleString()}
                        </span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {log.inputTokens} / {log.outputTokens}
                        </div>
                      </td>

                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap', color: '#10b981', fontWeight: 600 }}>
                        ${Number(log.costoEstimadoUsd || 0).toFixed(5)}
                      </td>

                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {log.duracionMs ? `${(log.duracionMs / 1000).toFixed(2)}s` : '--'}
                      </td>

                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-secondary, #f8fafc)',
                            color: 'var(--text-primary)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          👁️ Ver
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETALLE DE LOG */}
      {selectedLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setSelectedLog(null)}
        >
          <div
            style={{
              background: 'var(--card-bg, #fff)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              maxWidth: '750px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Detalle de Consulta #{selectedLog.id}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Usuario: {selectedLog.usuarioNombre} ({selectedLog.usuarioDni}) | Modelo: {selectedLog.modelo}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                ✕
              </button>
            </div>

            {/* PREGUNTA */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Pregunta del Usuario:
              </div>
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: 'var(--bg-secondary, #f1f5f9)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                }}
              >
                {selectedLog.prompt}
              </div>
            </div>

            {/* HERRAMIENTAS EJECUTADAS */}
            {selectedLog.herramientasEjecutadas && selectedLog.herramientasEjecutadas.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Herramientas / Function Calling:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {selectedLog.herramientasEjecutadas.map((h, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#0284c7',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                      }}
                    >
                      ⚡ {h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* RESPUESTA */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Respuesta Generada por Gemini:
              </div>
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '8px',
                  background: 'var(--bg-secondary, #f8fafc)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                }}
              >
                {selectedLog.respuesta || 'Sin respuesta almacenada'}
              </div>
            </div>

            {/* MÉTRICAS DE LA CONSULTA */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'var(--bg-secondary, #f1f5f9)',
                textAlign: 'center',
                fontSize: '0.8rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Tokens Totales</span>
                <b style={{ color: '#38bdf8', fontSize: '1rem' }}>{selectedLog.totalTokens}</b>
                <div style={{ fontSize: '0.7rem' }}>({selectedLog.inputTokens} In / {selectedLog.outputTokens} Out)</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Costo Estimado</span>
                <b style={{ color: '#10b981', fontSize: '1rem' }}>${Number(selectedLog.costoEstimadoUsd || 0).toFixed(5)} USD</b>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Duración</span>
                <b style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{selectedLog.duracionMs} ms</b>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                style={{
                  padding: '0.6rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#38bdf8',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
