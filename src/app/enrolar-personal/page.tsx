'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Swal from 'sweetalert2';
import {
  initFaceApi,
  extractFaceDescriptor,
  saveEnrolledFaceToDB,
  syncEnrolledFacesFromDB,
} from '@/lib/faceBiometricService';

interface AdminUser {
  userId: number;
  dni: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  rolSistema: string;
}

interface ColaboradorLookup {
  id: number;
  dni: string;
  nombres: string;
  apellidos: string;
  tipoPersonal: string;
  activo: boolean;
  tieneDescriptorFacial?: boolean;
  enroladoFacialAt?: string | null;
  fotoPerfilUrl?: string | null;
}

export default function EnrolarPersonalPage() {
  // --- AUTENTICACIÓN ADMIN ---
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [authIdentificador, setAuthIdentificador] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // --- MOTOR BIOMÉTRICO Y CÁMARA ---
  const [modelLoading, setModelLoading] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment'); // Por defecto cámara trasera en celular
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // --- BÚSQUEDA Y ENROLAMIENTO ---
  const [dniInput, setDniInput] = useState('');
  const [searchingDni, setSearchingDni] = useState(false);
  const [colaborador, setColaborador] = useState<ColaboradorLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [enrolando, setEnrolando] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. Verificar sesión de administrador al montar
  useEffect(() => {
    async function checkAdminSession() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (
            data.authenticated &&
            data.user &&
            ['super_admin', 'admin', 'administrativo'].includes(data.user.rolSistema)
          ) {
            setAdminUser(data.user);
          }
        }
      } catch (err) {
        console.error('Error al verificar sesión de admin:', err);
      } finally {
        setCheckingAuth(false);
      }
    }
    checkAdminSession();
  }, []);

  // 2. Iniciar sesión de admin si no está autenticado
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authIdentificador.trim() || !authPassword.trim()) {
      setAuthError('Ingresa tu DNI/Correo y Contraseña');
      return;
    }

    setAuthSubmitting(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identificador: authIdentificador.trim(),
          password: authPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Credenciales inválidas');
      }

      if (
        !data.user ||
        !['super_admin', 'admin', 'administrativo'].includes(data.user.rolSistema)
      ) {
        throw new Error('Esta cuenta no cuenta con permisos administrativos para enrolar personal.');
      }

      setAdminUser(data.user);
    } catch (err: any) {
      setAuthError(err.message || 'Error al iniciar sesión');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // 3. Iniciar cámara (delantera o trasera)
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }

      setCameraActive(true);
      setCameraError(null);
    } catch (err: any) {
      console.error('Error al encender cámara móvil:', err);
      setCameraError('No se pudo acceder a la cámara. Concede los permisos en tu navegador móvil.');
      setCameraActive(false);
    }
  }, []);

  // Detener cámara
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // 4. Cargar modelos de face-api y encender cámara una vez autenticado
  useEffect(() => {
    if (!adminUser) return;

    let isMounted = true;
    setModelLoading(true);

    initFaceApi().then((ok) => {
      if (!isMounted) return;
      setModelLoading(false);
      if (ok) {
        startCamera(facingMode);
      } else {
        setCameraError('No se pudieron descargar los modelos de visión artificial.');
      }
    });

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [adminUser, startCamera, stopCamera, facingMode]);

  // Cambiar entre cámara trasera y delantera
  const toggleCameraFacing = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // 5. Buscar colaborador al escribir DNI
  const handleDniChange = async (val: string) => {
    const cleanDni = val.replace(/\D/g, '');
    setDniInput(cleanDni);
    setLookupError(null);

    if (cleanDni.length === 8) {
      setSearchingDni(true);
      try {
        const res = await fetch(`/api/kiosco/lookup?dni=${cleanDni}`);
        const data = await res.json();

        if (res.ok && data.usuario) {
          // Verificar si ya tiene biometría
          const bioRes = await fetch(`/api/biometria/descriptores?dni=${cleanDni}`);
          const bioData = await bioRes.json();
          const hasBio = bioData.success && bioData.descriptores && bioData.descriptores.length > 0;
          const bioItem = hasBio ? bioData.descriptores[0] : null;

          setColaborador({
            id: data.usuario.id,
            dni: data.usuario.dni,
            nombres: data.usuario.nombres,
            apellidos: data.usuario.apellidos,
            tipoPersonal: data.usuario.tipoPersonal,
            activo: data.usuario.activo,
            tieneDescriptorFacial: hasBio,
            enroladoFacialAt: bioItem?.enrolledAt || null,
            fotoPerfilUrl: bioItem?.fotoPreview || null,
          });
        } else {
          setColaborador(null);
          setLookupError(data.error || 'Colaborador no encontrado en el sistema');
        }
      } catch (err: any) {
        setLookupError('Error al conectar con el servidor.');
      } finally {
        setSearchingDni(false);
      }
    } else {
      setColaborador(null);
    }
  };

  // 6. Capturar fotograma y enrolar en Neon Postgres
  const handleCapturarYEnrolar = async () => {
    if (!colaborador) {
      Swal.fire({
        icon: 'warning',
        title: 'Selecciona un Colaborador',
        text: 'Ingresa primero el DNI del Paciente Simulado o Técnico a enrolar.',
        background: '#091322',
        color: '#f8fafc',
        confirmButtonColor: '#38bdf8',
      });
      return;
    }

    if (!videoRef.current || videoRef.current.readyState !== 4) {
      Swal.fire({
        icon: 'warning',
        title: 'Cámara no lista',
        text: 'Asegúrate de que la cámara esté encendida y apuntando al colaborador.',
        background: '#091322',
        color: '#f8fafc',
        confirmButtonColor: '#38bdf8',
      });
      return;
    }

    setEnrolando(true);

    try {
      const { descriptor, error } = await extractFaceDescriptor(videoRef.current);

      if (error || !descriptor) {
        Swal.fire({
          icon: 'info',
          title: 'Rostro no Detectado',
          text: 'Pide al colaborador que mire de frente hacia la cámara con buena iluminación.',
          background: '#091322',
          color: '#f8fafc',
          confirmButtonColor: '#38bdf8',
        });
        setEnrolando(false);
        return;
      }

      // Generar snapshot miniatura en base64 para perfil
      let previewUrl: string | undefined = undefined;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 160, 120);
          previewUrl = canvas.toDataURL('image/webp', 0.6);
        }
      } catch {}

      const res = await saveEnrolledFaceToDB({
        dni: colaborador.dni,
        nombre: `${colaborador.nombres} ${colaborador.apellidos}`.trim(),
        tipoPersonal: colaborador.tipoPersonal,
        descriptor: Array.from(descriptor),
        enrolledAt: new Date().toISOString(),
        fotoPreview: previewUrl,
      });

      if (!res.success) {
        throw new Error(res.error || 'Error al guardar en la base de datos');
      }

      // Sincronizar memoria local
      await syncEnrolledFacesFromDB();

      // Éxito con SweetAlert2
      const nombreColab = `${colaborador.nombres} ${colaborador.apellidos}`;
      const swalResult = await Swal.fire({
        icon: 'success',
        title: '¡Rostro Enrolado con Éxito!',
        html: `
          <div style="font-size: 0.95rem; line-height: 1.5; color: #cbd5e1; text-align: center;">
            <div style="background: rgba(0, 230, 153, 0.12); border: 1.5px solid #00e699; padding: 0.65rem 1rem; border-radius: 10px; color: #00e699; font-weight: 700; margin: 0.8rem 0; font-size: 1rem;">
              👤 ${nombreColab}
              <div style="font-size: 0.8rem; color: #94a3b8; font-weight: 500; margin-top: 0.2rem;">DNI: ${colaborador.dni}</div>
            </div>
            <p style="font-size: 0.82rem; color: #94a3b8; margin: 0;">
              Biometría registrada en el sistema. Ya puede marcar ingreso o salida mirando al Kiosco.
            </p>
          </div>
        `,
        background: '#091322',
        color: '#f8fafc',
        confirmButtonColor: '#00e699',
        confirmButtonText: '➕ Enrolar Siguiente Colaborador',
      });

      if (swalResult.isConfirmed) {
        // Limpiar para el siguiente
        setDniInput('');
        setColaborador(null);
      }
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error de Enrolamiento',
        text: err.message,
        background: '#091322',
        color: '#f8fafc',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setEnrolando(false);
    }
  };

  // Cerrar sesión
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setAdminUser(null);
    } catch {
      setAdminUser(null);
    }
  };

  // --- CARGANDO VERIFICACIÓN DE SESIÓN ---
  if (checkingAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #00e699', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Verificando credenciales...</p>
        </div>
      </div>
    );
  }

  // --- PANTALLA 1: GATE DE SEGURIDAD / LOGIN ADMINISTRADOR ---
  if (!adminUser) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #020617 0%, #0b192c 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#f8fafc',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            background: 'rgba(9, 19, 34, 0.95)',
            border: '1.5px solid rgba(56, 189, 248, 0.35)',
            borderRadius: '20px',
            padding: '2rem 1.5rem',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.15)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{ width: 64, height: 64, borderRadius: '16px', background: 'rgba(56, 189, 248, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', border: '1px solid rgba(56, 189, 248, 0.3)', marginBottom: '0.75rem' }}>
              📱👁️
            </div>
            <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.4rem', fontWeight: 900, color: '#ffffff' }}>
              Enrolador Móvil UCS
            </h1>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
              Acceso restringido únicamente para personal administrativo
            </p>
          </div>

          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {authError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.65rem 0.85rem', borderRadius: '10px', fontSize: '0.82rem' }}>
                ⚠️ {authError}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                DNI o Correo Institucional
              </label>
              <input
                type="text"
                value={authIdentificador}
                onChange={(e) => setAuthIdentificador(e.target.value)}
                placeholder="49074636 o correo@ucsur.edu.pe"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 0.9rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                Contraseña de Administrador
              </label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 0.9rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              style={{
                marginTop: '0.5rem',
                padding: '0.85rem',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #0284c7 0%, #00e699 100%)',
                color: '#020617',
                fontWeight: 800,
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0, 230, 153, 0.3)',
              }}
            >
              {authSubmitting ? 'Verificando...' : '🔓 Ingresar al Enrolador'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- PANTALLA 2: ENROLADOR MÓVIL EN VIVO (OPTIMIZADO PARA SMARTPHONE) ---
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#020617',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* BARRA SUPERIOR MOBILE */}
      <header
        style={{
          padding: '0.75rem 1rem',
          background: 'rgba(9, 19, 34, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>📱👁️</span>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>
              Enrolador Móvil
            </div>
            <div style={{ fontSize: '0.7rem', color: '#38bdf8' }}>
              Admin: {adminUser.nombres.split(' ')[0]}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={toggleCameraFacing}
            style={{
              padding: '0.4rem 0.65rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            title="Cambiar entre cámara trasera y delantera"
          >
            🔄 {facingMode === 'environment' ? 'Trasera' : 'Frontal'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: '0.4rem 0.6rem',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
            title="Cerrar sesión"
          >
            Salir
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main
        style={{
          flex: 1,
          padding: '1rem',
          maxWidth: '480px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {/* BUSCADOR DE DNI DEL PS / TÉCNICO */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1.5px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '16px',
            padding: '1rem',
          }}
        >
          <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 700 }}>
            DNI DEL PACIENTE SIMULADO O TÉCNICO {searchingDni && '🔍'}
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={dniInput}
            onChange={(e) => handleDniChange(e.target.value)}
            placeholder="Ingresa los 8 dígitos..."
            maxLength={10}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: '1.5px solid rgba(56, 189, 248, 0.4)',
              background: 'rgba(2, 6, 23, 0.9)',
              color: '#ffffff',
              fontSize: '1.15rem',
              fontFamily: 'monospace',
              fontWeight: 800,
              letterSpacing: '0.05em',
            }}
          />

          {lookupError && (
            <div style={{ marginTop: '0.5rem', color: '#f87171', fontSize: '0.78rem' }}>
              ⚠️ {lookupError}
            </div>
          )}

          {/* FICHA DEL COLABORADOR ENCONTRADO */}
          {colaborador && (
            <div
              style={{
                marginTop: '0.75rem',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '12px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
                  {colaborador.nombres} {colaborador.apellidos}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <span style={{ color: colaborador.tipoPersonal === 'paciente_simulado' ? '#c084fc' : '#fbbf24', fontWeight: 700 }}>
                    {colaborador.tipoPersonal === 'paciente_simulado' ? '🎭 PS' : '🔧 Técnico'}
                  </span>
                  <span>• DNI: {colaborador.dni}</span>
                </div>
              </div>

              <div>
                {colaborador.tieneDescriptorFacial ? (
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '0.2rem 0.5rem', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    🟢 Ya Enrolado
                  </span>
                ) : (
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', padding: '0.2rem 0.5rem', borderRadius: '20px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    ⚪ Sin Enrolar
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* VISOR DE CÁMARA */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '320px',
            backgroundColor: '#020617',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '2px solid rgba(0, 230, 153, 0.4)',
            boxShadow: '0 0 25px rgba(0, 230, 153, 0.15)',
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
            }}
          />

          {/* MÁSCARA OVALADA HUD */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '190px',
              height: '240px',
              border: '2px dashed #00e699',
              borderRadius: '50%',
              pointerEvents: 'none',
              boxShadow: '0 0 15px rgba(0, 230, 153, 0.35)',
            }}
          />

          {modelLoading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(2, 6, 23, 0.9)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              <div style={{ width: 32, height: 32, border: '3px solid #00e699', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Preparando modelos de visión...</span>
            </div>
          )}

          {cameraError && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(2, 6, 23, 0.95)',
                padding: '1.5rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '2rem' }}>📷⚠️</span>
              <p style={{ fontSize: '0.82rem', color: '#f87171', margin: '0.5rem 0' }}>{cameraError}</p>
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                style={{ padding: '0.45rem 1rem', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700 }}
              >
                Reintentar Cámara
              </button>
            </div>
          )}
        </div>

        {/* BOTÓN DE ACCIÓN: CAPTURAR Y ENROLAR */}
        <button
          type="button"
          onClick={handleCapturarYEnrolar}
          disabled={!colaborador || enrolando || modelLoading || !cameraActive}
          style={{
            padding: '1rem',
            borderRadius: '16px',
            border: 'none',
            background: !colaborador
              ? 'rgba(255, 255, 255, 0.08)'
              : 'linear-gradient(135deg, #00e699 0%, #00b4d8 100%)',
            color: !colaborador ? '#64748b' : '#020617',
            fontWeight: 900,
            fontSize: '1.05rem',
            cursor: !colaborador ? 'not-allowed' : 'pointer',
            boxShadow: !colaborador ? 'none' : '0 6px 20px rgba(0, 230, 153, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            transition: 'all 0.15s ease',
          }}
        >
          <span>📸</span>
          <span>
            {enrolando
              ? 'Analizando y Guardando...'
              : colaborador
              ? `Capturar y Enrolar a ${colaborador.nombres.split(' ')[0]}`
              : 'Ingresa un DNI para Enrolar'}
          </span>
        </button>

        {/* INSTRUCCIONES PRÁCTICAS */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '0.85rem',
            fontSize: '0.78rem',
            color: '#94a3b8',
            lineHeight: 1.45,
          }}
        >
          💡 <strong style={{ color: '#f8fafc' }}>Tips para el Enrolamiento</strong>:
          <ul style={{ margin: '0.4rem 0 0 1.1rem', padding: 0 }}>
            <li>Usa la cámara trasera (🔄) para enfocar con comodidad al colaborador.</li>
            <li>Alinea su rostro dentro de la elipse verde con buena iluminación.</li>
            <li>Si el PS ya marcó su ingreso hoy, no se verá afectado; podrá usar su rostro al marcar la salida.</li>
          </ul>
        </div>
      </main>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

