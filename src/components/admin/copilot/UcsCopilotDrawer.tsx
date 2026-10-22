'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { SessionPayload } from '@/lib/auth';
import { showToast } from '@/lib/alerts';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  herramientas?: string[];
  tokens?: number;
  duracionMs?: number;
  timestamp: string;
}

const SUGGESTIONS = [
  '🔄 Sincronizar SimClic con las clases de hoy',
  '🔍 ¿Qué salas están disponibles en este momento?',
  '👥 ¿Quiénes han marcado asistencia el día de hoy?',
  '👨‍🔧 ¿El técnico vino a laborar hoy y en qué sede está?',
  '🧾 ¿Cómo van las horas de los Pacientes Simulados este mes?',
];

export const UcsCopilotDrawer: React.FC<{ session: SessionPayload }> = ({
  session,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [modelo, setModelo] = useState('gemini-3.5-flash');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: `¡Hola **${session.nombres}**! 👋 Soy el Copilot de Simulación Clínica de la UCS.\n\nTengo acceso a herramientas en tiempo real para:\n- 🔄 **Sincronizar con SimClic** al instante.\n- 🔍 **Consultar salas** libres u ocupadas.\n- 📅 **Revisar clases y docentes** de hoy o cualquier fecha.\n- 👥 **Ver asistencias y tardanzas** en vivo.\n- 🧾 **Revisar horas de Pacientes Simulados**.\n\n¿En qué te puedo ayudar hoy?`,
      timestamp: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Verificar estado del chatbot al montar
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/copilot/status');
        if (res.ok) {
          const data = await res.json();
          setEnabled(Boolean(data.habilitado));
          if (data.modelo) setModelo(data.modelo);
        }
      } catch (err) {
        console.error('Error al verificar estado de Copilot:', err);
      }
    }
    checkStatus();
  }, []);

  // Auto-scroll al final del chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  if (!enabled) {
    return null; // Si el super_admin lo deshabilitó, el widget flotante no se muestra
  }

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    setInput('');

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Construir historial previo para contexto de conversación
      const historial = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-6)
        .map((m) => ({
          role: m.sender === 'user' ? ('user' as const) : ('model' as const),
          parts: [{ text: m.text }],
        }));

      const res = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: query,
          historial,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al comunicarse con Gemini');
      }

      if (data.habilitado === false) {
        setEnabled(false);
        showToast('El asistente ha sido desactivado por el Super Admin', 'info');
        return;
      }

      const botMsg: Message = {
        id: `b-${Date.now()}`,
        sender: 'bot',
        text: data.respuesta,
        herramientas: data.herramientasEjecutadas,
        tokens: data.tokens?.total,
        duracionMs: data.duracionMs,
        timestamp: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error(err);
      const errMsg: Message = {
        id: `e-${Date.now()}`,
        sender: 'bot',
        text: `⚠️ **Error**: ${err.message || 'No pude procesar la consulta. Intenta nuevamente.'}`,
        timestamp: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* BOTÓN FLOTANTE TRIGGER */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 990,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1.25rem',
            borderRadius: '999px',
            border: 'none',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 50%, #06b6d4 100%)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            boxShadow: '0 8px 25px rgba(59, 130, 246, 0.45), 0 0 0 1px rgba(255,255,255,0.2)',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)';
            e.currentTarget.style.boxShadow =
              '0 12px 30px rgba(59, 130, 246, 0.6), 0 0 0 2px rgba(255,255,255,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow =
              '0 8px 25px rgba(59, 130, 246, 0.45), 0 0 0 1px rgba(255,255,255,0.2)';
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>✨</span>
          <span>Copilot UCS</span>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#00e699',
              boxShadow: '0 0 8px #00e699',
            }}
          />
        </button>
      )}

      {/* BACKDROP CUANDO ESTÁ ABIERTO */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(3px)',
            zIndex: 998,
          }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* DRAWER LATERAL */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '460px',
          background: 'var(--card-bg, #ffffff)',
          borderLeft: '1px solid var(--border-color)',
          boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.25)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* HEADER DEL CHAT */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-color)',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                color: '#fff',
                boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)',
              }}
            >
              🤖
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  Copilot Simulación
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    background: 'rgba(56, 189, 248, 0.18)',
                    color: '#0284c7',
                  }}
                >
                  {modelo}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Inteligencia artificial con herramientas en tiempo real
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '0.25rem',
            }}
            title="Cerrar Copilot"
          >
            ✕
          </button>
        </div>

        {/* CUERPO DE MENSAJES */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                }}
              >
                {/* TOOL BADGE */}
                {m.herramientas && m.herramientas.length > 0 && (
                  <div
                    style={{
                      marginBottom: '0.35rem',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.25rem',
                    }}
                  >
                    {m.herramientas.map((h, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#059669',
                        }}
                      >
                        ⚡ Ejecutó: {h}
                      </span>
                    ))}
                  </div>
                )}

                {/* MENSAJE BURBUJA */}
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isUser
                      ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                      : 'var(--bg-secondary, #f1f5f9)',
                    color: isUser ? '#ffffff' : 'var(--text-primary)',
                    fontSize: '0.875rem',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxShadow: isUser ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none',
                    border: isUser ? 'none' : '1px solid var(--border-color)',
                  }}
                >
                  {m.text}
                </div>

                <div
                  style={{
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    marginTop: '0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>{m.timestamp}</span>
                  {m.tokens && <span>• {m.tokens} tokens</span>}
                  {m.duracionMs && <span>• {(m.duracionMs / 1000).toFixed(1)}s</span>}
                </div>
              </div>
            );
          })}

          {/* INDICADOR DE CARGA */}
          {loading && (
            <div
              style={{
                alignSelf: 'flex-start',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.65rem 1rem',
                borderRadius: '16px 16px 16px 4px',
                background: 'var(--bg-secondary, #f1f5f9)',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
              }}
            >
              <span style={{ animation: 'spin 1.2s linear infinite', display: 'inline-block' }}>
                ⚙️
              </span>
              <span>Gemini está consultando las herramientas...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* CHIPS DE SUGERENCIAS */}
        {messages.length <= 3 && !loading && (
          <div
            style={{
              padding: '0.5rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              borderTop: '1px solid var(--border-color)',
              background: 'var(--bg-secondary, rgba(0,0,0,0.02))',
            }}
          >
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              💡 Preguntas sugeridas:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(s)}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--card-bg, #fff)',
                    color: 'var(--text-primary)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#38bdf8';
                    e.currentTarget.style.color = '#0284c7';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* INPUT FOOTER */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--border-color)',
            background: 'var(--card-bg, #ffffff)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <input
              type="text"
              placeholder="Pregunta sobre SimClic, salas, asistencias..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={loading}
              style={{
                flex: 1,
                padding: '0.65rem 0.9rem',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary, #f8fafc)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              style={{
                padding: '0.65rem 1rem',
                borderRadius: '10px',
                border: 'none',
                background: input.trim() && !loading ? '#3b82f6' : 'var(--border-color)',
                color: input.trim() && !loading ? '#fff' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              {loading ? '⏳' : '➔'}
            </button>
          </div>

          <div
            style={{
              marginTop: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.68rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>⚡ Potenciado por Google Gemini Pro API</span>
            <span>Usa ↵ Enter para enviar</span>
          </div>
        </div>
      </div>
    </>
  );
};
