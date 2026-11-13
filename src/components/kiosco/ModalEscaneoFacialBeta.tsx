'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Swal from 'sweetalert2';
import {
  initFaceApi,
  initSsdMobilenet,
  extractFaceDescriptor,
  findMatchingUser,
  getEnrolledFaces,
  syncEnrolledFacesFromDB,
  saveEnrolledFaceToDB,
  evaluateFaceQuality,
  type EnrolledFace,
  type FaceQualityResult,
} from '@/lib/faceBiometricService';

interface ModalEscaneoFacialBetaProps {
  isOpen: boolean;
  onClose: () => void;
  onUserIdentified: (dni: string) => void;
  currentUserId?: number;
  currentUserName?: string;
  currentUserDni?: string;
}

export const ModalEscaneoFacialBeta: React.FC<ModalEscaneoFacialBetaProps> = ({
  isOpen,
  onClose,
  onUserIdentified,
  currentUserName,
  currentUserDni,
}) => {
  const [modo, setModo] = useState<'escanear' | 'enrolar'>('escanear');
  const [modelLoading, setModelLoading] = useState(true);
  const [dbSyncing, setDbSyncing] = useState(false);
  const [statusText, setStatusText] = useState('Inicializando modelos de visión artificial...');
  const [detectedBox, setDetectedBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [faceQuality, setFaceQuality] = useState<FaceQualityResult | null>(null);
  const [matchedUser, setMatchedUser] = useState<{ nombre: string; dni: string; confidence: number } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [autoRedirectCountdown, setAutoRedirectCountdown] = useState<number | null>(null);

  // Enrolamiento
  const [dniParaEnrolar, setDniParaEnrolar] = useState(currentUserDni || '');
  const [nombreParaEnrolar, setNombreParaEnrolar] = useState(currentUserName || '');
  const [buscandoNombreDni, setBuscandoNombreDni] = useState(false);
  const [enrolados, setEnrolados] = useState<EnrolledFace[]>([]);
  const [enrolandoActivo, setEnrolandoActivo] = useState(false);
  const [enrolError, setEnrolError] = useState<string | null>(null);

  // Consenso Temporal (Filtro anti-falsos positivos: 3 fotogramas consecutivos)
  const [consensusHits, setConsensusHits] = useState(0);
  const consensusTrackerRef = useRef<{
    candidateDni: string | null;
    candidateUser: EnrolledFace | null;
    hits: number;
    confidences: number[];
  }>({
    candidateDni: null,
    candidateUser: null,
    hits: 0,
    confidences: [],
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isLoopRunningRef = useRef(false);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sincronizar desde Neon Postgres al abrir el modal
  useEffect(() => {
    if (isOpen) {
      // 1. Mostrar caché local de inmediato
      setEnrolados(getEnrolledFaces());
      if (currentUserDni) {
        setDniParaEnrolar(currentUserDni);
        setNombreParaEnrolar(currentUserName || '');
      }

      // 2. Sincronizar plantilla biométrica fresca desde Neon Postgres
      setDbSyncing(true);
      syncEnrolledFacesFromDB().then((res) => {
        setDbSyncing(false);
        if (res.success && res.faces) {
          setEnrolados(res.faces);
        }
      });
    }
  }, [isOpen, currentUserDni, currentUserName]);

  // Autocompletar nombre al escribir 8 dígitos de DNI en enrolamiento
  const handleDniInputChange = async (value: string) => {
    const cleanDni = value.replace(/\D/g, '');
    setDniParaEnrolar(cleanDni);
    setEnrolError(null);

    if (cleanDni.length === 8 && !nombreParaEnrolar) {
      setBuscandoNombreDni(true);
      try {
        const res = await fetch(`/api/kiosco/lookup?dni=${cleanDni}`);
        const data = await res.json();
        if (res.ok && data.usuario) {
          setNombreParaEnrolar(`${data.usuario.nombres} ${data.usuario.apellidos}`.trim());
        }
      } catch {
        // Silenciar si no existe o no hay red
      } finally {
        setBuscandoNombreDni(false);
      }
    }
  };

  // Iniciar cámara
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }
      setCameraError(null);
    } catch (err: any) {
      console.error('Error al iniciar cámara en modal facial:', err);
      setCameraError('No se pudo acceder a la cámara web. Concede los permisos en el navegador.');
    }
  }, []);

  // Detener cámara
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    isLoopRunningRef.current = false;
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  // Inicializar face-api y arrancar visor
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let isMounted = true;
    setModelLoading(true);
    setStatusText('Cargando modelos de visión artificial (WebGL)...');

    initFaceApi().then(async (ok) => {
      if (!isMounted) return;
      if (ok) {
        setModelLoading(false);
        setStatusText('👁️ Buscando rostro en el visor...');
        await startCamera();
        isLoopRunningRef.current = true;
        runDetectionLoop();
      } else {
        setModelLoading(false);
        setStatusText('⚠️ No se pudieron cargar los modelos de visión.');
      }
    });

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Manejador para confirmar ingreso automático o manual
  const confirmarIngreso = useCallback((dni: string) => {
    stopCamera();
    onUserIdentified(dni);
    onClose();
  }, [stopCamera, onUserIdentified, onClose]);

  // Bucle de detección facial en vivo con Filtro de Consenso Temporal y Guiado en Tiempo Real
  const runDetectionLoop = async () => {
    if (!isLoopRunningRef.current || !videoRef.current || modo !== 'escanear') return;

    if (videoRef.current.readyState === 4 && !videoRef.current.paused) {
      try {
        const { descriptor, box } = await extractFaceDescriptor(videoRef.current);
        setDetectedBox(box);

        const frameW = videoRef.current.videoWidth || 640;
        const frameH = videoRef.current.videoHeight || 480;
        const quality = evaluateFaceQuality(box, frameW, frameH);
        setFaceQuality(quality);

        if (!descriptor || !box || quality.status === 'no_face') {
          // Sin rostro en el visor: limpiar consenso
          consensusTrackerRef.current = { candidateDni: null, candidateUser: null, hits: 0, confidences: [] };
          setConsensusHits(0);
          setDetectedBox(null);
          setStatusText('Colócate frente a la cámara web...');
        } else if (!quality.isOptimal) {
          // Rostro detectado pero distancia o encuadre subóptimo (ej. transeúnte de fondo o muy cerca)
          // Bloqueamos el avance del consenso para evitar falsos positivos
          consensusTrackerRef.current = { candidateDni: null, candidateUser: null, hits: 0, confidences: [] };
          setConsensusHits(0);
          setStatusText(quality.message);
        } else {
          // Posición biométrica óptima: Proceder con matching y filtro de consenso
          const matchResult = findMatchingUser(descriptor);
          if (matchResult.matched && matchResult.user) {
            const REQUIRED_CONSENSUS_HITS = 3;
            const tracker = consensusTrackerRef.current;

            // Verificar si es el mismo colaborador acumulando consenso consecutivo
            if (tracker.candidateDni === matchResult.user.dni) {
              tracker.hits += 1;
              tracker.confidences.push(matchResult.confidence);
            } else {
              tracker.candidateDni = matchResult.user.dni;
              tracker.candidateUser = matchResult.user;
              tracker.hits = 1;
              tracker.confidences = [matchResult.confidence];
            }

            const currentHits = tracker.hits;
            setConsensusHits(currentHits);

            if (currentHits < REQUIRED_CONSENSUS_HITS) {
              // Estabilizando match (consenso en progreso)
              const primerNombre = matchResult.user.nombre.split(' ')[0];
              setStatusText(`🔍 Identificando a ${primerNombre}... (${currentHits}/${REQUIRED_CONSENSUS_HITS})`);
            } else {
              // Consenso confirmado: 3 fotogramas consecutivos avalan la identidad
              const avgConfidence = Math.round(
                tracker.confidences.reduce((a, b) => a + b, 0) / tracker.confidences.length
              );

              setMatchedUser({
                nombre: matchResult.user.nombre,
                dni: matchResult.user.dni,
                confidence: avgConfidence,
              });
              setStatusText(`🎯 ¡Rostro Confirmado: ${matchResult.user.nombre}! (${avgConfidence}% Coincidencia)`);

              // Detener bucle y arrancar cuenta regresiva de 2 segundos para marcar
              isLoopRunningRef.current = false;

              const dniConfirm = matchResult.user.dni;
              setAutoRedirectCountdown(2);
              let count = 2;
              countdownTimerRef.current = setInterval(() => {
                count -= 1;
                if (count <= 0) {
                  if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                  confirmarIngreso(dniConfirm);
                } else {
                  setAutoRedirectCountdown(count);
                }
              }, 1000);

              return;
            }
          } else {
            // Rostro centrado pero no reconocido: limpiar acumulador de consenso
            consensusTrackerRef.current = { candidateDni: null, candidateUser: null, hits: 0, confidences: [] };
            setConsensusHits(0);
            setMatchedUser(null);
            setStatusText('👁️ Rostro centrado (no enrolado en la base de datos)');
          }
        }
      } catch (err) {
        // Silenciar errores menores de frame
      }
    }

    if (isLoopRunningRef.current && modo === 'escanear') {
      setTimeout(runDetectionLoop, 200);
    }
  };

  // Reanudar escaneo manual
  const handleReintentarEscaneo = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    consensusTrackerRef.current = { candidateDni: null, candidateUser: null, hits: 0, confidences: [] };
    setConsensusHits(0);
    setFaceQuality(null);
    setAutoRedirectCountdown(null);
    setMatchedUser(null);
    isLoopRunningRef.current = true;
    setStatusText('👁️ Buscando rostro en el visor...');
    runDetectionLoop();
  };

  // Enrolar rostro actual y persistirlo en Neon Postgres
  const handleEjecutarEnrolamiento = async () => {
    if (!videoRef.current || !dniParaEnrolar.trim() || !nombreParaEnrolar.trim()) {
      setEnrolError('Ingresa el DNI y el nombre del colaborador.');
      Swal.fire({
        icon: 'warning',
        title: 'Datos Incompletos',
        text: 'Por favor ingresa el DNI y verifica el nombre del colaborador antes de enrolar.',
        background: '#091322',
        color: '#f8fafc',
        confirmButtonColor: '#38bdf8',
      });
      return;
    }

    setEnrolError(null);
    setEnrolandoActivo(true);
    setStatusText('📸 Analizando biometría y vector de 128 flotantes...');

    try {
      const { descriptor, box, detectorUsed } = await extractFaceDescriptor(videoRef.current, { useSsd: true });
      if (!descriptor || !box) {
        setEnrolError('No se detectó ningún rostro con claridad. Mira fijamente a la cámara con buena iluminación.');
        Swal.fire({
          icon: 'info',
          title: 'Rostro No Detectado',
          text: 'No se detectó ningún rostro con claridad en el visor. Mira de frente a la cámara con buena iluminación y sin accesorios que cubran el rostro.',
          background: '#091322',
          color: '#f8fafc',
          confirmButtonColor: '#38bdf8',
        });
        setEnrolandoActivo(false);
        return;
      }

      const frameW = videoRef.current.videoWidth || 640;
      const frameH = videoRef.current.videoHeight || 480;
      const quality = evaluateFaceQuality(box, frameW, frameH);
      if (!quality.isOptimal) {
        setEnrolError(quality.message);
        Swal.fire({
          icon: 'warning',
          title: 'Posicionamiento Subóptimo',
          text: `${quality.message}. Ajusta la posición de tu rostro frente a la cámara antes de enrolar.`,
          background: '#091322',
          color: '#f8fafc',
          confirmButtonColor: '#38bdf8',
        });
        setEnrolandoActivo(false);
        return;
      }

      // Snapshot miniatura en base64 para preview
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

      // Persistir en Neon Postgres vía API route
      const result = await saveEnrolledFaceToDB({
        dni: dniParaEnrolar.trim(),
        nombre: nombreParaEnrolar.trim(),
        descriptor: Array.from(descriptor),
        enrolledAt: new Date().toISOString(),
        fotoPreview: previewUrl,
      });

      if (!result.success) {
        setEnrolError(result.error || 'Error al persistir en la base de datos.');
        Swal.fire({
          icon: 'error',
          title: 'Error de Enrolamiento',
          text: result.error || 'No se pudo guardar la información biométrica en la base de datos.',
          background: '#091322',
          color: '#f8fafc',
          confirmButtonColor: '#ef4444',
        });
        return;
      }

      // Refrescar lista de enrolados
      const syncRes = await syncEnrolledFacesFromDB();
      setEnrolados(syncRes.faces);

      await Swal.fire({
        icon: 'success',
        title: '¡Rostro Enrolado con Éxito!',
        html: `
          <div style="font-size: 0.95rem; line-height: 1.5; color: #cbd5e1; text-align: center;">
            <p style="margin-bottom: 0.6rem;">
              Tu plantilla biométrica facial fue registrada exitosamente en el sistema.
            </p>
            <div style="background: rgba(0, 230, 153, 0.12); border: 1.5px solid #00e699; padding: 0.65rem 1rem; border-radius: 10px; color: #00e699; font-weight: 700; margin: 0.8rem 0; font-size: 1rem;">
              👤 ${nombreParaEnrolar.trim()}
              <div style="font-size: 0.8rem; color: #94a3b8; font-weight: 500; margin-top: 0.2rem;">DNI: ${dniParaEnrolar.trim()}</div>
            </div>
            <p style="font-size: 0.82rem; color: #94a3b8; margin: 0;">
              Ahora puedes ingresar al Kiosco directamente mirando al visor de la cámara.
            </p>
          </div>
        `,
        background: '#091322',
        color: '#f8fafc',
        confirmButtonColor: '#00e699',
        confirmButtonText: '⚡ Probar Escaneo Facial Ahora',
      });

      setModo('escanear');
      isLoopRunningRef.current = true;
      runDetectionLoop();
    } catch (err: any) {
      setEnrolError(`Error al enrolar rostro: ${err.message}`);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message,
        background: '#091322',
        color: '#f8fafc',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setEnrolandoActivo(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.88)',
        backdropFilter: 'blur(10px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          background: 'linear-gradient(135deg, #091322 0%, #0d1e38 100%)',
          border: '1.5px solid rgba(0, 230, 153, 0.45)',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 25px 65px -15px rgba(0, 230, 153, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* CABECERA */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'rgba(6, 17, 34, 0.9)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '1.5rem' }}>👁️</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                  Reconocimiento Facial
                </h3>
                <span
                  style={{
                    background: 'linear-gradient(135deg, #00e699, #00b4d8)',
                    color: '#020617',
                    fontWeight: 900,
                    fontSize: '0.65rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '20px',
                    letterSpacing: '0.05em',
                  }}
                >
                  FASE BETA
                </span>
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                Identificación biométrica para registro de asistencia
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* SELECTOR DE MODO (ESCANEAR / ENROLAR) */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.7)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            padding: '0.4rem 1.5rem',
            gap: '0.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setModo('escanear');
              isLoopRunningRef.current = true;
              runDetectionLoop();
            }}
            style={{
              flex: 1,
              padding: '0.55rem',
              borderRadius: '8px',
              border: modo === 'escanear' ? '1px solid #00e699' : '1px solid transparent',
              background: modo === 'escanear' ? 'rgba(0, 230, 153, 0.15)' : 'transparent',
              color: modo === 'escanear' ? '#00e699' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            ⚡ Escanear y Marcar
          </button>
          <button
            type="button"
            onClick={() => {
              setModo('enrolar');
              isLoopRunningRef.current = false;
              initSsdMobilenet(); // Precalentar SSD MobileNet v1 para captura de alta precisión
            }}
            style={{
              flex: 1,
              padding: '0.55rem',
              borderRadius: '8px',
              border: modo === 'enrolar' ? '1px solid #38bdf8' : '1px solid transparent',
              background: modo === 'enrolar' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              color: modo === 'enrolar' ? '#38bdf8' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            👤 Enrolar mi Rostro
          </button>
        </div>

        {/* CONTENEDOR PRINCIPAL */}
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          
          {/* VISOR DE CÁMARA CON HUD CYBER-MÉDICO */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '440px',
              height: '300px',
              backgroundColor: '#020617',
              borderRadius: '16px',
              overflow: 'hidden',
              border: '2px solid ' + (matchedUser ? '#00e699' : 'rgba(0, 230, 153, 0.3)'),
              boxShadow: matchedUser
                ? '0 0 25px rgba(0, 230, 153, 0.5)'
                : 'inset 0 0 20px rgba(0, 0, 0, 0.8)',
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
                transform: 'scaleX(-1)', // Espejo natural
              }}
            />

            {/* ERROR DE CÁMARA */}
            {cameraError && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(2, 6, 23, 0.95)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1.5rem',
                  textAlign: 'center',
                  color: '#f87171',
                }}
              >
                <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷⚠️</span>
                <p style={{ fontSize: '0.85rem', margin: 0 }}>{cameraError}</p>
                <button
                  onClick={startCamera}
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.45rem 1rem',
                    background: '#0284c7',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                  }}
                >
                  Reintentar Acceso
                </button>
              </div>
            )}

            {/* PILL DE FEEDBACK DE CALIDAD Y POSICIONAMIENTO EN VIVO */}
            {faceQuality && faceQuality.status !== 'no_face' && !matchedUser && (
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: faceQuality.isOptimal
                    ? 'rgba(6, 78, 59, 0.9)'
                    : faceQuality.status === 'too_close'
                    ? 'rgba(127, 29, 29, 0.9)'
                    : 'rgba(120, 53, 15, 0.9)',
                  border: faceQuality.isOptimal
                    ? '1px solid #10b981'
                    : faceQuality.status === 'too_close'
                    ? '1px solid #ef4444'
                    : '1px solid #f59e0b',
                  color: '#ffffff',
                  padding: '0.22rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  backdropFilter: 'blur(6px)',
                  zIndex: 5,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{faceQuality.icon}</span>
                <span>{faceQuality.message}</span>
              </div>
            )}

            {/* MÁSCARA HUD FACIAL (RETÍCULA OVALADA CON ADAPTACIÓN DE COLOR POR CALIDAD) */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '180px',
                height: '220px',
                border:
                  '2px dashed ' +
                  (matchedUser
                    ? '#00e699'
                    : consensusHits > 0
                    ? '#38bdf8'
                    : faceQuality?.status === 'optimal'
                    ? '#00e699'
                    : faceQuality?.status === 'too_far' || faceQuality?.status === 'off_center'
                    ? '#f59e0b'
                    : faceQuality?.status === 'too_close'
                    ? '#ef4444'
                    : 'rgba(0, 230, 153, 0.4)'),
                borderRadius: '50%',
                pointerEvents: 'none',
                boxShadow: matchedUser
                  ? '0 0 25px rgba(0, 230, 153, 0.5)'
                  : consensusHits > 0
                  ? '0 0 15px rgba(56, 189, 248, 0.4)'
                  : faceQuality?.status === 'optimal'
                  ? '0 0 15px rgba(0, 230, 153, 0.35)'
                  : faceQuality?.status === 'too_far' || faceQuality?.status === 'off_center'
                  ? '0 0 15px rgba(245, 158, 11, 0.35)'
                  : faceQuality?.status === 'too_close'
                  ? '0 0 15px rgba(239, 68, 68, 0.35)'
                  : 'none',
                transition: 'all 0.2s ease',
              }}
            />

            {/* RAYO LÁSER ESCANEADOR ANIMADO */}
            {!matchedUser && !modelLoading && modo === 'escanear' && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #00e699, transparent)',
                  boxShadow: '0 0 10px #00e699',
                  animation: 'kioskScanLaser 2.2s infinite ease-in-out',
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* INDICADOR DE CONSENSO TEMPORAL EN VIVO */}
            {consensusHits > 0 && !matchedUser && modo === 'escanear' && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '48px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(2, 6, 23, 0.9)',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  backdropFilter: 'blur(6px)',
                  zIndex: 4,
                }}
              >
                <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 700 }}>
                  Estabilidad:
                </span>
                <div style={{ display: 'flex', gap: '3px' }}>
                  <div
                    style={{
                      width: '14px',
                      height: '4px',
                      borderRadius: '2px',
                      background: consensusHits >= 1 ? '#00e699' : 'rgba(255, 255, 255, 0.2)',
                      transition: 'all 0.15s ease',
                    }}
                  />
                  <div
                    style={{
                      width: '14px',
                      height: '4px',
                      borderRadius: '2px',
                      background: consensusHits >= 2 ? '#00e699' : 'rgba(255, 255, 255, 0.2)',
                      transition: 'all 0.15s ease',
                    }}
                  />
                  <div
                    style={{
                      width: '14px',
                      height: '4px',
                      borderRadius: '2px',
                      background: consensusHits >= 3 ? '#00e699' : 'rgba(255, 255, 255, 0.2)',
                      transition: 'all 0.15s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {/* BADGE DE ESTADO FLOTANTE */}
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                right: 12,
                background: matchedUser ? 'rgba(0, 230, 153, 0.95)' : 'rgba(2, 6, 23, 0.85)',
                color: matchedUser ? '#020617' : '#ffffff',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                textAlign: 'center',
                backdropFilter: 'blur(6px)',
                border: '1px solid ' + (matchedUser ? '#00e699' : 'rgba(255, 255, 255, 0.15)'),
              }}
            >
              {statusText}
            </div>

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
                  gap: '0.75rem',
                }}
              >
                <div style={{ width: 36, height: 36, border: '3px solid #00e699', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Descargando modelos neuronales...</span>
              </div>
            )}
          </div>

          {/* VISTA 1: RESULTADO DEL ESCANEO */}
          {modo === 'escanear' && (
            <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {matchedUser ? (
                <div
                  style={{
                    background: 'rgba(0, 230, 153, 0.12)',
                    border: '1.5px solid #00e699',
                    borderRadius: '12px',
                    padding: '1rem',
                    textAlign: 'center',
                    animation: 'fadeIn 0.2s ease',
                  }}
                >
                  <div style={{ fontSize: '1.4rem' }}>🎉</div>
                  <h4 style={{ margin: '0.2rem 0', fontSize: '1.15rem', color: '#00e699', fontWeight: 800 }}>
                    ¡Bienvenido(a), {matchedUser.nombre}!
                  </h4>
                  <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.8rem', color: '#cbd5e1' }}>
                    DNI: <strong>{matchedUser.dni}</strong> • Confianza: <strong>{matchedUser.confidence}%</strong>
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => confirmarIngreso(matchedUser.dni)}
                      style={{
                        padding: '0.65rem 1.4rem',
                        borderRadius: '10px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #00e699, #00b4d8)',
                        color: '#020617',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(0, 230, 153, 0.35)',
                      }}
                    >
                      ⚡ Continuar a Marcar Asistencia {autoRedirectCountdown !== null && `(${autoRedirectCountdown}s)`}
                    </button>
                    <button
                      type="button"
                      onClick={handleReintentarEscaneo}
                      style={{
                        padding: '0.65rem 0.9rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                      }}
                    >
                      🔄 Reintentar
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
                  {enrolados.length === 0 ? (
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.75rem', borderRadius: '10px', color: '#fbbf24' }}>
                      ⚠️ No hay rostros enrolados en la base de datos todavía. Pasa a la pestaña <strong>"Enrolar Rostros"</strong> para vincular tu cara en 1 segundo y probar la demo.
                    </div>
                  ) : (
                    <span>💡 Mantén la mirada fija en el visor. Al identificarte se completará tu DNI de forma automática.</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: FORMULARIO DE ENROLAMIENTO */}
          {modo === 'enrolar' && (
            <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
                    DNI {buscandoNombreDni && '🔍'}
                  </label>
                  <input
                    type="text"
                    value={dniParaEnrolar}
                    onChange={(e) => handleDniInputChange(e.target.value)}
                    placeholder="72481923"
                    maxLength={10}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(15, 23, 42, 0.8)',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    value={nombreParaEnrolar}
                    onChange={(e) => setNombreParaEnrolar(e.target.value)}
                    placeholder="Ej: Carlos Mendoza"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(15, 23, 42, 0.8)',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>

              {enrolError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem' }}>
                  ⚠️ {enrolError}
                </div>
              )}

              <button
                type="button"
                onClick={handleEjecutarEnrolamiento}
                disabled={enrolandoActivo || modelLoading}
                style={{
                  width: '100%',
                  padding: '0.7rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(56, 189, 248, 0.3)',
                }}
              >
                {enrolandoActivo ? '⏳ Guardando...' : '📸 Capturar y Guardar Rostro'}
              </button>

              {/* NOTA DE PRIVACIDAD Y SEGURIDAD UCS */}
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: '10px',
                  padding: '0.75rem 0.9rem',
                  fontSize: '0.78rem',
                  color: '#94a3b8',
                  lineHeight: 1.45,
                  marginTop: '0.25rem',
                }}
              >
                🔒 <strong style={{ color: '#38bdf8' }}>Privacidad y Seguridad</strong>: Tus datos biométricos se procesan y almacenan de forma segura y cifrada en el sistema. La gestión y desvinculación se administra exclusivamente desde el Panel de Control.
              </div>
            </div>
          )}

        </div>

      </div>

      <style jsx global>{`
        @keyframes kioskScanLaser {
          0% { top: 15%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { top: 85%; opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
