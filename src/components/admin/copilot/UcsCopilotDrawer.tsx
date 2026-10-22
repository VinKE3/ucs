'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { SessionPayload } from '@/lib/auth';
import { showToast } from '@/lib/alerts';
import styles from './copilot.module.css';

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
  '🎭 ¿Qué pacientes simulados vienen mañana y en qué salas? Formato WhatsApp',
  '🔧 ¿Cuál es la cobertura y rol de turnos de los técnicos hoy?',
  '🚨 ¿Hay alertas logísticas o cambios de material (swaps/resets) hoy en Villa?',
  '🧾 ¿Cómo van las horas y liquidación de Pacientes Simulados este mes?',
  '🔍 ¿Qué salas están disponibles en este momento?',
  '🔄 Sincronizar SimClic con las clases de hoy',
];

const TableCard: React.FC<{
  headers: string[];
  rows: string[][];
}> = ({ headers, rows }) => {
  const [downloaded, setDownloaded] = useState(false);

  const handleDownloadExcel = () => {
    const escapeCsv = (str: string) => {
      const clean = (str || '').replace(/"/g, '""').trim();
      if (clean.includes(';') || clean.includes('\n') || clean.includes('"') || clean.includes(',')) {
        return `"${clean}"`;
      }
      return clean;
    };

    const headerLine = headers.map(escapeCsv).join(';');
    const rowLines = rows.map((row) => row.map(escapeCsv).join(';'));
    const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

    const filename = `Reporte_Copilot_UCS_${new Date().toISOString().slice(0, 10)}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloaded(true);
    showToast(`📊 Archivo "${filename}" descargado con éxito para Excel`, 'success');
    setTimeout(() => setDownloaded(false), 2500);
  };

  const handleCopy = () => {
    const textTable = [
      headers.join('\t'),
      ...rows.map((r) => r.join('\t')),
    ].join('\n');
    navigator.clipboard.writeText(textTable);
    showToast('📋 Tabla copiada (lista para pegar en Excel)', 'success');
  };

  return (
    <div
      style={{
        margin: '0.85rem 0',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(16, 185, 129, 0.35)',
        background: 'rgba(6, 21, 45, 0.85)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.55rem 0.85rem',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.25) 100%)',
          borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span style={{ fontSize: '1rem' }}>📊</span>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              color: '#34d399',
              letterSpacing: '0.3px',
            }}
          >
            Tabla de Datos ({rows.length} {rows.length === 1 ? 'registro' : 'registros'})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.3rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--text-primary)',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Copiar datos al portapapeles"
          >
            📋 Copiar
          </button>

          <button
            type="button"
            onClick={handleDownloadExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid rgba(16, 185, 129, 0.5)',
              background: downloaded ? 'rgba(16, 185, 129, 0.4)' : '#059669',
              color: '#ffffff',
              fontSize: '0.74rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
              transition: 'all 0.15s',
            }}
            title="Descargar tabla directamente en formato CSV compatible con Microsoft Excel"
          >
            <span>{downloaded ? '✓' : '📊'}</span>
            <span>{downloaded ? '¡Descargado!' : 'Descargar en Excel (.csv)'}</span>
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', maxHeight: '380px', overflowY: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.8rem',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              {headers.map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: '0.55rem 0.75rem',
                    fontWeight: 700,
                    color: '#38bdf8',
                    whiteSpace: 'nowrap',
                    borderRight: i < headers.length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : undefined,
                  }}
                >
                  {parseInlineFormatting(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                style={{
                  background: rIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    style={{
                      padding: '0.5rem 0.75rem',
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      borderRight: cIdx < row.length - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : undefined,
                    }}
                  >
                    {parseInlineFormatting(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CodeBlockCard: React.FC<{
  code: string;
  lang?: string;
}> = ({ code, lang }) => {
  const [copied, setCopied] = useState(false);

  const isCsvOrExcel =
    lang === 'csv' ||
    lang === 'excel' ||
    (code.includes(';') && code.includes('\n')) ||
    (code.split('\n')[0].includes(',') && code.split('\n')[0].toLowerCase().includes('dni'));

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    showToast(isCsvOrExcel ? '📋 Datos CSV copiados' : '📋 Texto copiado para WhatsApp', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (isCsvOrExcel) {
      const csvData = code.startsWith('\uFEFF') ? code : '\uFEFF' + code;
      const filename = `Reporte_Copilot_UCS_${new Date().toISOString().slice(0, 10)}.csv`;
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`📊 Archivo "${filename}" descargado con éxito para Excel`, 'success');
    } else {
      const filename = `programacion_simulacion_${new Date().toISOString().slice(0, 10)}.txt`;
      const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`💾 Archivo "${filename}" descargado con éxito`, 'success');
    }
  };

  const handleWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(code)}`;
    window.open(url, '_blank');
  };

  return (
    <div
      style={{
        margin: '0.75rem 0',
        borderRadius: '10px',
        overflow: 'hidden',
        border: isCsvOrExcel
          ? '1px solid rgba(16, 185, 129, 0.45)'
          : '1px solid rgba(56, 189, 248, 0.35)',
        background: '#0b1329',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* HEADER DE LA CAJA */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          background: isCsvOrExcel
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.2) 100%)'
            : 'rgba(255, 255, 255, 0.05)',
          borderBottom: isCsvOrExcel
            ? '1px solid rgba(16, 185, 129, 0.3)'
            : '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.9rem' }}>{isCsvOrExcel ? '📊' : '📄'}</span>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: isCsvOrExcel ? '#34d399' : '#38bdf8',
              letterSpacing: '0.5px',
            }}
          >
            {isCsvOrExcel
              ? 'Archivo para Excel (.csv) • Formato Oficial UCS'
              : lang === 'text' || lang === 'txt' || !lang
              ? 'Archivo de Texto (.txt) • Listo para WhatsApp'
              : lang}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {/* BOTÓN COPIAR */}
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.3rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              background: copied ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.15)',
              color: copied ? '#10b981' : '#38bdf8',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            title="Copiar contenido"
          >
            <span>{copied ? '✓' : '📋'}</span>
            <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
          </button>

          {/* BOTÓN DESCARGAR */}
          <button
            type="button"
            onClick={handleDownload}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.3rem 0.6rem',
              borderRadius: '6px',
              border: isCsvOrExcel
                ? '1px solid rgba(16, 185, 129, 0.6)'
                : '1px solid rgba(16, 185, 129, 0.35)',
              background: isCsvOrExcel ? '#059669' : 'rgba(16, 185, 129, 0.15)',
              color: isCsvOrExcel ? '#ffffff' : '#10b981',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            title={isCsvOrExcel ? 'Descargar archivo CSV compatible con Microsoft Excel' : 'Descargar como archivo de texto .txt'}
          >
            <span>{isCsvOrExcel ? '📊' : '⬇️'}</span>
            <span>{isCsvOrExcel ? 'Descargar en Excel (.csv)' : 'Descargar .txt'}</span>
          </button>

          {/* BOTÓN ENVIAR A WHATSAPP */}
          {!isCsvOrExcel && (
            <button
              type="button"
              onClick={handleWhatsApp}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid rgba(37, 211, 102, 0.4)',
                background: 'rgba(37, 211, 102, 0.18)',
                color: '#25d366',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              title="Abrir en WhatsApp Web o Móvil"
            >
              <span>📲</span>
              <span>WhatsApp</span>
            </button>
          )}
        </div>
      </div>

      {/* CONTENIDO TEXTO MONOSPACE */}
      <pre
        style={{
          margin: 0,
          padding: '0.85rem 1rem',
          fontSize: '0.82rem',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          color: '#f8fafc',
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '380px',
          overflowY: 'auto',
        }}
      >
        {code}
      </pre>
    </div>
  );
};

function parseInlineFormatting(text: string): React.ReactNode {
  // Parsear **negrita**
  const boldParts = text.split(/(\*\*.*?\*\*)/g);
  return boldParts.map((part, pIdx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={pIdx} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    // Parsear `código inline`
    const codeParts = part.split(/(`.*?`)/g);
    return codeParts.map((cPart, cIdx) => {
      if (cPart.startsWith('`') && cPart.endsWith('`')) {
        return (
          <code
            key={`${pIdx}-${cIdx}`}
            style={{
              padding: '0.15rem 0.35rem',
              borderRadius: '4px',
              background: 'rgba(56, 189, 248, 0.12)',
              color: '#0284c7',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
            }}
          >
            {cPart.slice(1, -1)}
          </code>
        );
      }
      return cPart;
    });
  });
}

function renderMarkdownText(raw: string): React.ReactNode {
  const lines = raw.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detectar si empieza una tabla Markdown (| ... |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerCells = tableLines[0]
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());

        const dataLines = tableLines
          .slice(1)
          .filter((l) => !/^\|[\s\-:\:]+\|$/.test(l.replace(/\|/g, '||')));

        const dataRows = dataLines.map((l) =>
          l
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim())
        );

        blocks.push(
          <TableCard
            key={`table-${i}`}
            headers={headerCells}
            rows={dataRows}
          />
        );
        continue;
      } else {
        blocks.push(<div key={`line-${i}`}>{parseInlineFormatting(tableLines[0])}</div>);
        continue;
      }
    }

    // Regla horizontal
    if (line.trim() === '---' || line.trim() === '___') {
      blocks.push(
        <hr
          key={`hr-${i}`}
          style={{
            margin: '0.5rem 0',
            border: 'none',
            borderTop: '1px solid var(--border-color)',
          }}
        />
      );
      i++;
      continue;
    }

    // Encabezado nivel 3
    if (line.startsWith('### ')) {
      blocks.push(
        <div
          key={`h3-${i}`}
          style={{
            fontWeight: 800,
            fontSize: '0.95rem',
            margin: '0.4rem 0 0.2rem 0',
            color: 'var(--text-primary)',
          }}
        >
          {parseInlineFormatting(line.replace('### ', ''))}
        </div>
      );
      i++;
      continue;
    }

    // Encabezado nivel 2 o 1
    if (line.startsWith('## ') || line.startsWith('# ')) {
      blocks.push(
        <div
          key={`h1-${i}`}
          style={{
            fontWeight: 800,
            fontSize: '1.05rem',
            margin: '0.5rem 0 0.25rem 0',
            color: 'var(--text-primary)',
          }}
        >
          {parseInlineFormatting(line.replace(/^#+ /, ''))}
        </div>
      );
      i++;
      continue;
    }

    // Viñetas (* item o - item)
    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      blocks.push(
        <div
          key={`li-${i}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.4rem',
            margin: '0.15rem 0',
            paddingLeft: '0.25rem',
          }}
        >
          <span style={{ color: '#38bdf8' }}>•</span>
          <span>{parseInlineFormatting(line.trim().replace(/^[\*\-] /, ''))}</span>
        </div>
      );
      i++;
      continue;
    }

    // Línea de texto estándar
    blocks.push(
      <div key={`line-${i}`} style={{ minHeight: line.trim() ? undefined : '0.4rem' }}>
        {parseInlineFormatting(line)}
      </div>
    );
    i++;
  }

  return blocks;
}

const FormattedMessage: React.FC<{ text: string; isUser: boolean }> = ({ text, isUser }) => {
  if (isUser) {
    return <span>{text}</span>;
  }

  // Separar bloques de código con regex ```lang\n...```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Texto antes del bloque de código
    if (match.index > lastIndex) {
      const textBefore = text.substring(lastIndex, match.index);
      parts.push(
        <span key={`txt-${lastIndex}`}>{renderMarkdownText(textBefore)}</span>
      );
    }

    const lang = match[1] || 'text';
    const code = match[2];
    parts.push(
      <CodeBlockCard key={`code-${match.index}`} code={code.trim()} lang={lang} />
    );

    lastIndex = match.index + match[0].length;
  }

  // Texto restante después del último bloque
  if (lastIndex < text.length) {
    const textAfter = text.substring(lastIndex);
    parts.push(
      <span key={`txt-${lastIndex}`}>{renderMarkdownText(textAfter)}</span>
    );
  }

  // Verificar si hubo bloques de código
  const hasCodeBlock = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/.test(text);

  return (
    <div>
      <div>{parts.length > 0 ? parts : renderMarkdownText(text)}</div>
      {!hasCodeBlock && text.length > 180 && (
        <div
          style={{
            marginTop: '0.6rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.72rem',
          }}
        >
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(text);
              showToast('📋 Respuesta copiada', 'success');
            }}
            style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            📋 Copiar texto
          </button>
          <button
            type="button"
            onClick={() => {
              const filename = `consulta_ucs_${new Date().toISOString().slice(0, 10)}.txt`;
              const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              showToast(`💾 Descargado como ${filename}`, 'success');
            }}
            style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            ⬇️ Descargar .txt
          </button>
          <button
            type="button"
            onClick={() => {
              const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
              window.open(url, '_blank');
            }}
            style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              border: '1px solid rgba(37, 211, 102, 0.3)',
              background: 'rgba(37, 211, 102, 0.1)',
              color: '#25d366',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            📲 WhatsApp
          </button>
        </div>
      )}
    </div>
  );
};

const getFormattedTime = () => {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

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
      timestamp: getFormattedTime(),
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
      timestamp: getFormattedTime(),
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
        timestamp: getFormattedTime(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error(err);
      const errMsg: Message = {
        id: `e-${Date.now()}`,
        sender: 'bot',
        text: `⚠️ **Error**: ${err.message || 'No pude procesar la consulta. Intenta nuevamente.'}`,
        timestamp: getFormattedTime(),
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
          className={styles.copilotTriggerButton}
          aria-label="Abrir Asistente Copilot UCS"
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
                    wordBreak: 'break-word',
                    boxShadow: isUser ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none',
                    border: isUser ? 'none' : '1px solid var(--border-color)',
                  }}
                >
                  <FormattedMessage text={m.text} isUser={isUser} />
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
                  <span suppressHydrationWarning>{m.timestamp}</span>
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
            padding: '0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom, 0px))',
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
