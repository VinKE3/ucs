'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Swal from 'sweetalert2';
import {
  initFaceApi,
  initSsdMobilenet,
  extractFaceDescriptor,
  findMatchingUser,
  findDuplicateEnrolledFace,
  computeCentroid,
  getEnrolledFaces,
  syncEnrolledFacesFromDB,
  saveEnrolledFaceToDB,
  evaluateFaceQuality,
  type EnrolledFace,
  type FaceQualityResult,
} from '@/lib/faceBiometricService';

type AngleKey = 'frente' | 'izquierda' | 'derecha';

interface AngleConfig {
  key: AngleKey;
  step: string;
  label: string;
  icon: string;
  guide: string;
}

const ANGLES_3D: AngleConfig[] = [
  {
    key: 'frente',
    step: '1/3',
    label: 'Frente',
    icon: '🎯',
    guide: 'Mira directo a la cámara con expresión neutra',
  },
  {
    key: 'izquierda',
    step: '2/3',
    label: 'Izquierda',
    icon: '👈',
    guide: 'Gira ligeramente tu rostro hacia la izquierda (~20°)',
  },
  {
    key: 'derecha',
    step: '3/3',
    label: 'Derecha',
    icon: '👉',
    guide: 'Gira ligeramente tu rostro hacia la derecha (~20°)',
  },
];

interface ModalEscaneoFacialBetaProps {
  isOpen: boolean;
  onClose: () => void;
  onUserIdentified: (dni: string) => void;
  currentUserId?: number;
  currentUserName?: string;
  currentUserDni?: string;
  requireLiveness?: boolean;
  initialMode?: 'escanear' | 'enrolar';
}

export const ModalEscaneoFacialBeta: React.FC<ModalEscaneoFacialBetaProps> = ({
  isOpen,
  onClose,
  onUserIdentified,
  currentUserName,
  currentUserDni,
  requireLiveness,
  initialMode = 'escanear',
}) => {
  const [modo, setModo] = useState<'escanear' | 'enrolar'>(initialMode);
  const [modelLoading, setModelLoading] = useState(true);
  const [dbSyncing, setDbSyncing] = useState(false);
  const [statusText, setStatusText] = useState('Inicializando modelos de visión artificial...');
  const [, setDetectedBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [faceQuality, setFaceQuality] = useState<FaceQualityResult | null>(null);
  const [matchedUser, setMatchedUser] = useState<{ nombre: string; dni: string; confidence: number } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [autoRedirectCountdown, setAutoRedirectCountdown] = useState<number | null>(null);

  // Prueba de Vida Anti-Spoofing (Detección de Parpadeo - EAR)
  const isLivenessRequired = Boolean(
    requireLiveness ??
      (typeof window !== 'undefined' && localStorage.getItem('kiosco_cfg_liveness_parpadeo') === 'true')
  );
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [, setCurrentEar] = useState<number | null>(null);

  const blinkTrackerRef = useRef<{
    hasClosed: boolean;
    closedAt: number;
    blinkConfirmed: boolean;
  }>({
    hasClosed: false,
    closedAt: 0,
    blinkConfirmed: false,
  });

  // Enrolamiento Multi-Ángulo 3D + Consentimiento Ley 29733
  const [dniParaEnrolar, setDniParaEnrolar] = useState(currentUserDni || '');
  const [nombreParaEnrolar, setNombreParaEnrolar] = useState(currentUserName || '');
  const [buscandoNombreDni, setBuscandoNombreDni] = useState(false);
  const [enrolados, setEnrolados] = useState<EnrolledFace[]>([]);
  const [enrolandoActivo, setEnrolandoActivo] = useState(false);
  const [enrolError, setEnrolError] = useState<string | null>(null);
  const [currentAngleKey, setCurrentAngleKey] = useState<AngleKey>('frente');
  const [capturedAngles, setCapturedAngles] = useState<
    Partial<Record<AngleKey, { descriptor: number[]; preview: string }>>
  >({});
  const [capturandoAngulo, setCapturandoAngulo] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [consentimientoLey29733, setConsentimientoLey29733] = useState(false);

  const capturedCount = Object.keys(capturedAngles).length;
  const currentAngleConfig = ANGLES_3D.find((a) => a.key === currentAngleKey) || ANGLES_3D[0];

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

  // Refs de ciclo de vida y prevención de closures obsoletos / frames huérfanos
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isLoopRunningRef = useRef(false);
  const loopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dniLookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modoRef = useRef<'escanear' | 'enrolar'>(initialMode);
  const isLivenessRequiredRef = useRef<boolean>(isLivenessRequired);
  const sessionIdRef = useRef<number>(0);

  useEffect(() => {
    isLivenessRequiredRef.current = isLivenessRequired;
  }, [isLivenessRequired]);

  const clearTimers = useCallback(() => {
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (dniLookupTimerRef.current) {
      clearTimeout(dniLookupTimerRef.current);
      dniLookupTimerRef.current = null;
    }
  }, []);

  // Limpieza total de la sesión biométrica para que nunca quede pegado un usuario anterior
  const resetScannerState = useCallback(
    (targetMode: 'escanear' | 'enrolar' = 'escanear') => {
      sessionIdRef.current += 1;
      isLoopRunningRef.current = false;
      clearTimers();

      modoRef.current = targetMode;
      setModo(targetMode);

      consensusTrackerRef.current = {
        candidateDni: null,
        candidateUser: null,
        hits: 0,
        confidences: [],
      };
      blinkTrackerRef.current = {
        hasClosed: false,
        closedAt: 0,
        blinkConfirmed: false,
      };

      setConsensusHits(0);
      setLivenessPassed(false);
      setCurrentEar(null);
      setDetectedBox(null);
      setFaceQuality(null);
      setMatchedUser(null);
      setAutoRedirectCountdown(null);
      setCameraError(null);
      setEnrolError(null);
      setEnrolandoActivo(false);
      setCurrentAngleKey('frente');
      setCapturedAngles({});
      setCapturandoAngulo(false);
      setFlashActive(false);
      setConsentimientoLey29733(false);
      setStatusText(
        targetMode === 'escanear'
          ? '👁️ Buscando rostro en el visor...'
          : '🎯 Paso 1/3 (Frente): Mira directo a la cámara y captura tu rostro'
      );
    },
    [clearTimers]
  );

  // Detener cámara y cancelar todos los timers e inferencias en vuelo
  const stopCamera = useCallback(() => {
    sessionIdRef.current += 1;
    isLoopRunningRef.current = false;
    clearTimers();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [clearTimers]);

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
      return true;
    } catch (err: any) {
      console.error('Error al iniciar cámara en modal facial:', err);
      setCameraError('No se pudo acceder a la cámara web. Concede los permisos en el navegador.');
      return false;
    }
  }, []);

  // Manejador para confirmar ingreso automático o manual
  const confirmarIngreso = useCallback(
    (dni: string) => {
      stopCamera();
      setMatchedUser(null);
      setAutoRedirectCountdown(null);
      setConsensusHits(0);
      setLivenessPassed(false);
      onUserIdentified(dni);
      onClose();
    },
    [stopCamera, onUserIdentified, onClose]
  );

  // Bucle de detección facial en vivo (protegido contra closures obsoletos y sesiones cruzadas)
  const runDetectionLoop = useCallback(
    async (expectedSessionId: number) => {
      if (
        sessionIdRef.current !== expectedSessionId ||
        !isLoopRunningRef.current ||
        !videoRef.current ||
        modoRef.current !== 'escanear'
      ) {
        return;
      }

      if (videoRef.current.readyState === 4 && !videoRef.current.paused) {
        try {
          const { descriptor, box, ear, isBlinking, brightness } = await extractFaceDescriptor(
            videoRef.current
          );

          // Descartar resultado si el modal se cerró, cambió de modo o reinició durante la inferencia
          if (
            sessionIdRef.current !== expectedSessionId ||
            !isLoopRunningRef.current ||
            modoRef.current !== 'escanear' ||
            !videoRef.current
          ) {
            return;
          }

          setDetectedBox(box);
          if (typeof ear === 'number') setCurrentEar(ear);

          const frameW = videoRef.current.videoWidth || 640;
          const frameH = videoRef.current.videoHeight || 480;
          const quality = evaluateFaceQuality(box, frameW, frameH, { brightness });
          setFaceQuality(quality);

          if (!descriptor || !box || quality.status === 'no_face') {
            consensusTrackerRef.current = {
              candidateDni: null,
              candidateUser: null,
              hits: 0,
              confidences: [],
            };
            blinkTrackerRef.current = { hasClosed: false, closedAt: 0, blinkConfirmed: false };
            setConsensusHits(0);
            setLivenessPassed(false);
            setDetectedBox(null);
            setStatusText('Colócate frente a la cámara web...');
          } else if (!quality.isOptimal) {
            consensusTrackerRef.current = {
              candidateDni: null,
              candidateUser: null,
              hits: 0,
              confidences: [],
            };
            setConsensusHits(0);
            setStatusText(quality.message);
          } else {
            const requireBlink = isLivenessRequiredRef.current;

            // Evaluar Liveness (Anti-Spoofing por Parpadeo) si está activo
            if (requireBlink && ear !== null && ear !== undefined) {
              const EAR_CLOSED = 0.20;
              const EAR_OPEN = 0.26;

              if (ear < EAR_CLOSED || isBlinking) {
                blinkTrackerRef.current.hasClosed = true;
                blinkTrackerRef.current.closedAt = Date.now();
              } else if (blinkTrackerRef.current.hasClosed && ear >= EAR_OPEN) {
                const elapsed = Date.now() - blinkTrackerRef.current.closedAt;
                if (elapsed >= 80 && elapsed <= 1800) {
                  blinkTrackerRef.current.blinkConfirmed = true;
                  setLivenessPassed(true);
                }
              }
            }

            const matchResult = findMatchingUser(descriptor);
            if (matchResult.matched && matchResult.user) {
              const REQUIRED_CONSENSUS_HITS = 3;
              const tracker = consensusTrackerRef.current;

              if (tracker.candidateDni === matchResult.user.dni) {
                tracker.hits += 1;
                tracker.confidences.push(matchResult.confidence);
              } else {
                tracker.candidateDni = matchResult.user.dni;
                tracker.candidateUser = matchResult.user;
                tracker.hits = 1;
                tracker.confidences = [matchResult.confidence];
                blinkTrackerRef.current = { hasClosed: false, closedAt: 0, blinkConfirmed: false };
                setLivenessPassed(false);
              }

              const currentHits = tracker.hits;
              setConsensusHits(currentHits);

              const isLivenessOk = !requireBlink || blinkTrackerRef.current.blinkConfirmed;
              const primerNombre = matchResult.user.nombre.split(' ')[0];

              if (currentHits < REQUIRED_CONSENSUS_HITS) {
                if (requireBlink && !isLivenessOk) {
                  setStatusText(
                    `🔍 Identificando a ${primerNombre}... (${currentHits}/${REQUIRED_CONSENSUS_HITS}) • 😉 Parpadea`
                  );
                } else {
                  setStatusText(
                    `🔍 Identificando a ${primerNombre}... (${currentHits}/${REQUIRED_CONSENSUS_HITS})`
                  );
                }
              } else if (!isLivenessOk) {
                setStatusText(
                  `😉 ¡Hola ${primerNombre}! Por favor, parpadea frente al visor para confirmar...`
                );
              } else {
                const avgConfidence = Math.round(
                  tracker.confidences.reduce((a, b) => a + b, 0) / tracker.confidences.length
                );

                setMatchedUser({
                  nombre: matchResult.user.nombre,
                  dni: matchResult.user.dni,
                  confidence: avgConfidence,
                });

                setStatusText(
                  requireBlink
                    ? `🎯 ¡Prueba de Vida y Rostro Confirmados: ${matchResult.user.nombre}! (${avgConfidence}% Coincidencia)`
                    : `🎯 ¡Rostro Confirmado: ${matchResult.user.nombre}! (${avgConfidence}% Coincidencia)`
                );

                isLoopRunningRef.current = false;
                if (loopTimeoutRef.current) {
                  clearTimeout(loopTimeoutRef.current);
                  loopTimeoutRef.current = null;
                }

                const dniConfirm = matchResult.user.dni;
                setAutoRedirectCountdown(2);
                let count = 2;
                if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = setInterval(() => {
                  if (sessionIdRef.current !== expectedSessionId) {
                    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                    return;
                  }
                  count -= 1;
                  if (count <= 0) {
                    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                    countdownTimerRef.current = null;
                    confirmarIngreso(dniConfirm);
                  } else {
                    setAutoRedirectCountdown(count);
                  }
                }, 1000);

                return;
              }
            } else if (matchResult.ambiguous) {
              consensusTrackerRef.current = {
                candidateDni: null,
                candidateUser: null,
                hits: 0,
                confidences: [],
              };
              setConsensusHits(0);
              setMatchedUser(null);
              setStatusText('🔍 Acércate un poco más y mira de frente para precisar tu identidad...');
            } else {
              consensusTrackerRef.current = {
                candidateDni: null,
                candidateUser: null,
                hits: 0,
                confidences: [],
              };
              setConsensusHits(0);
              setMatchedUser(null);
              setStatusText('👁️ Rostro centrado (no enrolado en la base de datos)');
            }
          }
        } catch {
          // Silenciar errores menores de frame
        }
      }

      if (
        sessionIdRef.current === expectedSessionId &&
        isLoopRunningRef.current &&
        modoRef.current === 'escanear'
      ) {
        loopTimeoutRef.current = setTimeout(() => runDetectionLoop(expectedSessionId), 200);
      }
    },
    [confirmarIngreso]
  );

  // Arrancar el modo escaneo de forma determinista y sin stale closures
  const startScanMode = useCallback(() => {
    resetScannerState('escanear');
    const activeSessionId = sessionIdRef.current;
    isLoopRunningRef.current = true;
    runDetectionLoop(activeSessionId);
  }, [resetScannerState, runDetectionLoop]);

  // Arrancar el modo enrolar
  const startEnrolMode = useCallback(() => {
    resetScannerState('enrolar');
    initSsdMobilenet(); // Precalentar SSD MobileNet v1 para captura de alta precisión
  }, [resetScannerState]);

  // Ciclo de vida principal al abrir / cerrar el modal
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      // Resetear estados visuales para la próxima apertura
      setMatchedUser(null);
      setAutoRedirectCountdown(null);
      setConsensusHits(0);
      setLivenessPassed(false);
      setFaceQuality(null);
      setDetectedBox(null);
      setEnrolError(null);
      return;
    }

    let isMounted = true;
    const targetMode = initialMode || 'escanear';

    // 1. Limpiar inmediatamente cualquier rastro del paciente anterior
    resetScannerState(targetMode);
    setDniParaEnrolar(currentUserDni || '');
    setNombreParaEnrolar(currentUserName || '');
    setModelLoading(true);
    setStatusText('Cargando modelos de visión artificial...');

    // 2. Cargar caché local + sincronizar plantilla fresca sin fotos Base64 desde BD
    setEnrolados(getEnrolledFaces());
    setDbSyncing(true);
    const syncPromise = syncEnrolledFacesFromDB().then((res) => {
      if (!isMounted) return;
      setDbSyncing(false);
      if (res.faces) {
        setEnrolados(res.faces);
      }
    });

    const openSessionId = sessionIdRef.current;

    // 3. Inicializar IA + cámara
    initFaceApi().then(async (ok) => {
      if (!isMounted || sessionIdRef.current !== openSessionId) return;
      if (ok) {
        const camOk = await startCamera();
        if (!isMounted || sessionIdRef.current !== openSessionId) return;
        setModelLoading(false);

        if (targetMode === 'enrolar') {
          initSsdMobilenet();
          setStatusText('🎯 Paso 1/3 (Frente): Mira directo a la cámara y captura tu rostro');
        } else if (camOk) {
          // Esperar un máximo breve a la sincronización fresca para no mostrar falsos "no enrolado"
          await Promise.race([syncPromise, new Promise((r) => setTimeout(r, 800))]);
          if (!isMounted || sessionIdRef.current !== openSessionId) return;
          setStatusText('👁️ Buscando rostro en el visor...');
          isLoopRunningRef.current = true;
          runDetectionLoop(openSessionId);
        }
      } else {
        setModelLoading(false);
        setStatusText('⚠️ No se pudieron cargar los modelos de visión.');
      }
    });

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [
    isOpen,
    initialMode,
    currentUserDni,
    currentUserName,
    resetScannerState,
    startCamera,
    stopCamera,
    runDetectionLoop,
  ]);

  // Autocompletar nombre al escribir DNI (8 dígitos) o Carnet de Extranjería (9-12 dígitos)
  const handleDniInputChange = (value: string) => {
    const cleanDni = value.replace(/\D/g, '');
    setDniParaEnrolar(cleanDni);
    setNombreParaEnrolar('');
    setEnrolError(null);
    setCapturedAngles({});
    setCurrentAngleKey('frente');
    setConsentimientoLey29733(false);

    if (dniLookupTimerRef.current) {
      clearTimeout(dniLookupTimerRef.current);
      dniLookupTimerRef.current = null;
    }

    if (cleanDni.length >= 8) {
      dniLookupTimerRef.current = setTimeout(async () => {
        setBuscandoNombreDni(true);
        try {
          const res = await fetch(`/api/kiosco/lookup?dni=${encodeURIComponent(cleanDni)}`, {
            cache: 'no-store',
          });
          const data = await res.json();
          if (res.ok && data.usuario) {
            setNombreParaEnrolar(`${data.usuario.nombres} ${data.usuario.apellidos}`.trim());
          }
        } catch {
          // Silenciar si no existe o no hay red
        } finally {
          setBuscandoNombreDni(false);
        }
      }, 220);
    }
  };

  // Reanudar escaneo manual
  const handleReintentarEscaneo = () => {
    startScanMode();
  };

  // Capturar un ángulo del Wizard 3D (Frente, Izquierda o Derecha) con SSD MobileNet v1
  const handleCapturarAngulo = async () => {
    if (!videoRef.current || dniParaEnrolar.trim().length < 8 || !nombreParaEnrolar.trim()) {
      setEnrolError('Ingresa un DNI/CE válido (8–12 dígitos) y verifica el nombre completo.');
      Swal.fire({
        icon: 'warning',
        title: 'Datos Incompletos',
        text: 'Ingresa tu DNI/CE y verifica tu nombre completo antes de capturar los ángulos faciales.',
        background: '#091322',
        color: '#f8fafc',
        confirmButtonColor: '#38bdf8',
      });
      return;
    }

    setEnrolError(null);
    setCapturandoAngulo(true);
    setStatusText(`📸 Analizando ángulo ${currentAngleConfig.label} con SSD MobileNet...`);

    try {
      const { descriptor, box, brightness } = await extractFaceDescriptor(videoRef.current, {
        useSsd: true,
      });

      if (!descriptor || !box) {
        setEnrolError(
          'No se detectó ningún rostro con claridad. Mantén buena iluminación y encuadra tu rostro en el óvalo.'
        );
        setStatusText(`${currentAngleConfig.icon} ${currentAngleConfig.guide}`);
        return;
      }

      const frameW = videoRef.current.videoWidth || 640;
      const frameH = videoRef.current.videoHeight || 480;
      const quality = evaluateFaceQuality(box, frameW, frameH, {
        angle: currentAngleKey,
        brightness,
      });
      setFaceQuality(quality);

      if (!quality.isOptimal) {
        setEnrolError(quality.message);
        setStatusText(quality.message);
        return;
      }

      // Flash visual de captura exitosa
      setFlashActive(true);
      setTimeout(() => setFlashActive(false), 180);

      // Snapshot miniatura WebP para tarjeta de vista previa
      let previewUrl = '';
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.translate(160, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(videoRef.current, 0, 0, 160, 120);
          previewUrl = canvas.toDataURL('image/webp', 0.6);
        }
      } catch {}

      const nextCaptured = {
        ...capturedAngles,
        [currentAngleKey]: {
          descriptor: Array.from(descriptor),
          preview: previewUrl,
        },
      };
      setCapturedAngles(nextCaptured);

      // Avanzar automáticamente al siguiente ángulo faltante
      const nextMissing = ANGLES_3D.find((a) => !nextCaptured[a.key]);
      if (nextMissing) {
        setCurrentAngleKey(nextMissing.key);
        setStatusText(
          `✅ ${currentAngleConfig.label} capturado • Siguiente: ${nextMissing.icon} ${nextMissing.label} (${nextMissing.step})`
        );
      } else {
        setStatusText('✨ ¡3 ángulos 3D capturados! Acepta el consentimiento y guarda tu biometría.');
      }
    } catch (err: any) {
      setEnrolError(`Error al capturar ángulo: ${err.message}`);
    } finally {
      setCapturandoAngulo(false);
    }
  };

  // Persistir plantilla biométrica Multi-Ángulo 3D (v2) en la base de datos con trazabilidad Ley 29733
  const handleGuardarBiometria = async () => {
    const cleanDni = dniParaEnrolar.trim();
    const cleanNombre = nombreParaEnrolar.trim();

    if (cleanDni.length < 8 || !cleanNombre) {
      setEnrolError('Ingresa el DNI/CE y el nombre completo del colaborador.');
      return;
    }

    const angleKeys = ANGLES_3D.map((a) => a.key).filter((k) => Boolean(capturedAngles[k]));
    if (angleKeys.length === 0) {
      setEnrolError('Captura al menos un ángulo facial (se recomiendan los 3 ángulos 3D).');
      return;
    }

    if (!consentimientoLey29733) {
      setEnrolError('Debes marcar el consentimiento informado biométrico (Ley N.° 29733) para guardar.');
      return;
    }

    setEnrolError(null);
    setEnrolandoActivo(true);
    setStatusText('💾 Calculando plantilla 3D y guardando de forma cifrada...');

    try {
      const descriptorsList = angleKeys.map((k) => capturedAngles[k]!.descriptor);
      const centroid = computeCentroid(descriptorsList);

      // Control anti-duplicados: verificar si este rostro ya pertenece a otro DNI
      const duplicateCheck = findDuplicateEnrolledFace(centroid, cleanDni);
      if (duplicateCheck.isDuplicate && duplicateCheck.existingUser) {
        const confirmDup = await Swal.fire({
          icon: 'warning',
          title: 'Rostro Similar Ya Registrado',
          html: `
            <div style="font-size: 0.9rem; color: #cbd5e1; line-height: 1.5;">
              Este rostro coincide en un <strong>${duplicateCheck.confidence}%</strong> con un colaborador ya enrolado bajo otro documento:<br/>
              <div style="margin: 0.65rem 0; padding: 0.6rem; border-radius: 8px; background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; color: #fde68a; font-weight: 700;">
                👤 ${duplicateCheck.existingUser.nombre} (DNI: ${duplicateCheck.existingUser.dni})
              </div>
              Verifica que el documento ingresado (<strong>${cleanDni}</strong>) sea el correcto antes de continuar.
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: 'Guardar de todos modos',
          cancelButtonText: 'Cancelar y revisar DNI',
          background: '#091322',
          color: '#f8fafc',
          confirmButtonColor: '#f59e0b',
          cancelButtonColor: '#475569',
        });
        if (!confirmDup.isConfirmed) {
          return;
        }
      }

      const payloadDescriptor = {
        version: 2,
        mode: descriptorsList.length >= 2 ? 'multi_angle' : 'single_angle',
        angles: angleKeys,
        descriptors: descriptorsList,
        centroid,
      };

      const previewUrl =
        capturedAngles.frente?.preview || capturedAngles[angleKeys[0]]?.preview || undefined;

      const result = await saveEnrolledFaceToDB({
        dni: cleanDni,
        nombre: cleanNombre,
        descriptor: payloadDescriptor,
        enrolledAt: new Date().toISOString(),
        fotoPreview: previewUrl,
        anglesCaptured: angleKeys,
        consentimientoAceptado: consentimientoLey29733,
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

      const syncRes = await syncEnrolledFacesFromDB();
      setEnrolados(syncRes.faces);

      await Swal.fire({
        icon: 'success',
        title: '¡Plantilla 3D Enrolada con Éxito!',
        html: `
          <div style="font-size: 0.95rem; line-height: 1.5; color: #cbd5e1; text-align: center;">
            <p style="margin-bottom: 0.6rem;">
              Tu plantilla biométrica (${angleKeys.length}/3 ángulos${angleKeys.length === 3 ? ' • 3D Completo' : ''}) fue registrada exitosamente.
            </p>
            <div style="background: rgba(0, 230, 153, 0.12); border: 1.5px solid #00e699; padding: 0.65rem 1rem; border-radius: 10px; color: #00e699; font-weight: 700; margin: 0.8rem 0; font-size: 1rem;">
              👤 ${cleanNombre}
              <div style="font-size: 0.8rem; color: #94a3b8; font-weight: 500; margin-top: 0.2rem;">Documento: ${cleanDni} • Consentimiento Ley 29733 registrado</div>
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

      startScanMode();
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
          maxHeight: '94vh',
          overflowY: 'auto',
          background: 'linear-gradient(135deg, #091322 0%, #0d1e38 100%)',
          border: '1.5px solid rgba(0, 230, 153, 0.45)',
          borderRadius: '20px',
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
                {isLivenessRequired && (
                  <span
                    style={{
                      background: 'rgba(2, 132, 199, 0.2)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      color: '#38bdf8',
                      fontWeight: 800,
                      fontSize: '0.65rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '20px',
                    }}
                  >
                    🛡️ ANTI-SPOOFING
                  </span>
                )}
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
            onClick={startScanMode}
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
            onClick={startEnrolMode}
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
              height: modo === 'enrolar' ? '235px' : '300px',
              backgroundColor: '#020617',
              borderRadius: '16px',
              overflow: 'hidden',
              border: '2px solid ' + (matchedUser ? '#00e699' : modo === 'enrolar' ? 'rgba(56, 189, 248, 0.45)' : 'rgba(0, 230, 153, 0.3)'),
              boxShadow: matchedUser
                ? '0 0 25px rgba(0, 230, 153, 0.5)'
                : 'inset 0 0 20px rgba(0, 0, 0, 0.8)',
              transition: 'height 0.2s ease',
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
                transform: 'scaleX(-1)',
              }}
            />

            {/* FLASH VISUAL DE CAPTURA 3D */}
            {flashActive && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(255, 255, 255, 0.8)',
                  zIndex: 15,
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* GUÍA DE ÁNGULO ACTIVO EN MODO ENROLAR 3D */}
            {modo === 'enrolar' && !cameraError && !modelLoading && (
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(2, 132, 199, 0.92)',
                  border: '1px solid #38bdf8',
                  color: '#ffffff',
                  padding: '0.24rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.73rem',
                  fontWeight: 800,
                  backdropFilter: 'blur(6px)',
                  zIndex: 7,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.45)',
                }}
              >
                <span>{currentAngleConfig.icon}</span>
                <span>
                  Paso {currentAngleConfig.step} ({currentAngleConfig.label}): {currentAngleConfig.guide}
                </span>
              </div>
            )}

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

            {/* PILL DE FEEDBACK DE CALIDAD, POSICIONAMIENTO E ILUMINACIÓN */}
            {modo === 'escanear' && faceQuality && faceQuality.status !== 'no_face' && !matchedUser && (
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

            {/* BADGE DE MODO LIVENESS / ANTI-SPOOFING EN EL VISOR */}
            {isLivenessRequired && !matchedUser && modo === 'escanear' && (
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: livenessPassed ? 'rgba(6, 78, 59, 0.92)' : 'rgba(2, 132, 199, 0.35)',
                  border: livenessPassed ? '1px solid #10b981' : '1px solid rgba(56, 189, 248, 0.6)',
                  color: livenessPassed ? '#6ee7b7' : '#38bdf8',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '12px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  backdropFilter: 'blur(6px)',
                  zIndex: 6,
                }}
                title={
                  livenessPassed
                    ? 'Prueba de vida confirmada por parpadeo'
                    : 'Modo Anti-Spoofing: requiere parpadeo'
                }
              >
                <span>{livenessPassed ? '✓' : '🛡️'}</span>
                <span>{livenessPassed ? 'Vida OK' : 'Anti-Spoofing'}</span>
              </div>
            )}

            {/* CALLOUT DESTACADO: ESPERANDO PARPADEO PARA PRUEBA DE VIDA */}
            {isLivenessRequired && consensusHits >= 3 && !livenessPassed && !matchedUser && modo === 'escanear' && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '75px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(2, 132, 199, 0.95)',
                  border: '1px solid #38bdf8',
                  color: '#ffffff',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '16px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  backdropFilter: 'blur(8px)',
                  zIndex: 10,
                  boxShadow: '0 0 20px rgba(56, 189, 248, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: '1rem' }}>😉</span>
                <span>¡Por favor, parpadea para confirmar!</span>
              </div>
            )}

            {/* MÁSCARA HUD FACIAL (RETÍCULA OVALADA) */}
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
                    : faceQuality?.status === 'too_close'
                    ? '#ef4444'
                    : faceQuality && !faceQuality.isOptimal && faceQuality.status !== 'no_face'
                    ? '#f59e0b'
                    : 'rgba(0, 230, 153, 0.4)'),
                borderRadius: '50%',
                pointerEvents: 'none',
                boxShadow: matchedUser
                  ? '0 0 25px rgba(0, 230, 153, 0.5)'
                  : consensusHits > 0
                  ? '0 0 15px rgba(56, 189, 248, 0.4)'
                  : faceQuality?.status === 'optimal'
                  ? '0 0 15px rgba(0, 230, 153, 0.35)'
                  : faceQuality?.status === 'too_close'
                  ? '0 0 15px rgba(239, 68, 68, 0.35)'
                  : faceQuality && !faceQuality.isOptimal && faceQuality.status !== 'no_face'
                  ? '0 0 15px rgba(245, 158, 11, 0.35)'
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
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      style={{
                        width: '14px',
                        height: '4px',
                        borderRadius: '2px',
                        background: consensusHits >= step ? '#00e699' : 'rgba(255, 255, 255, 0.2)',
                        transition: 'all 0.15s ease',
                      }}
                    />
                  ))}
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
                <div
                  style={{
                    width: 36,
                    height: 36,
                    border: '3px solid #00e699',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Cargando modelos neuronales...
                </span>
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
                  {dbSyncing && enrolados.length === 0 ? (
                    <div
                      style={{
                        background: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        padding: '0.65rem',
                        borderRadius: '10px',
                        color: '#38bdf8',
                      }}
                    >
                      ☁️ Sincronizando padrón biométrico actualizado...
                    </div>
                  ) : enrolados.length === 0 ? (
                    <div
                      style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        padding: '0.75rem',
                        borderRadius: '10px',
                        color: '#fbbf24',
                      }}
                    >
                      ⚠️ No hay rostros enrolados en la base de datos todavía. Pasa a la pestaña{' '}
                      <strong>"Enrolar mi Rostro"</strong> para vincular tu cara en 1 segundo.
                    </div>
                  ) : (
                    <span>
                      💡 Mantén la mirada fija en el visor.{' '}
                      {dbSyncing ? '(Actualizando padrón...)' : `(${enrolados.length} rostros activos)`}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: WIZARD MULTI-ÁNGULO 3D + CONSENTIMIENTO LEY 29733 */}
          {modo === 'enrolar' && (
            <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '0.2rem' }}>
                    DNI / CE {buscandoNombreDni && '🔍'}
                  </label>
                  <input
                    type="text"
                    value={dniParaEnrolar}
                    onChange={(e) => handleDniInputChange(e.target.value)}
                    placeholder="72481923"
                    maxLength={12}
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

              {/* TARJETAS DE 3 ÁNGULOS 3D (FRENTE / IZQUIERDA / DERECHA) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem' }}>
                {ANGLES_3D.map((ang) => {
                  const cap = capturedAngles[ang.key];
                  const isActive = currentAngleKey === ang.key;
                  return (
                    <button
                      key={ang.key}
                      type="button"
                      onClick={() => {
                        setCurrentAngleKey(ang.key);
                        setEnrolError(null);
                        setStatusText(`${ang.icon} Paso ${ang.step} (${ang.label}): ${ang.guide}`);
                      }}
                      style={{
                        position: 'relative',
                        padding: '0.45rem 0.35rem',
                        borderRadius: '10px',
                        border: cap
                          ? '1.5px solid #10b981'
                          : isActive
                          ? '1.5px solid #38bdf8'
                          : '1px solid rgba(255, 255, 255, 0.12)',
                        background: cap
                          ? 'rgba(16, 185, 129, 0.12)'
                          : isActive
                          ? 'rgba(56, 189, 248, 0.14)'
                          : 'rgba(15, 23, 42, 0.6)',
                        color: '#f8fafc',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.25rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {cap?.preview ? (
                        <img
                          src={cap.preview}
                          alt={ang.label}
                          style={{
                            width: '44px',
                            height: '34px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            border: '1px solid #10b981',
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '1.15rem', lineHeight: '34px' }}>{ang.icon}</span>
                      )}
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: cap ? '#34d399' : isActive ? '#38bdf8' : '#cbd5e1' }}>
                        {cap ? '✓ ' : ''}
                        {ang.label}
                      </div>
                      <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                        {cap ? 'Capturado' : `Paso ${ang.step}`}
                      </div>
                    </button>
                  );
                })}
              </div>

              {enrolError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    color: '#fca5a5',
                    padding: '0.45rem 0.7rem',
                    borderRadius: '8px',
                    fontSize: '0.76rem',
                  }}
                >
                  ⚠️ {enrolError}
                </div>
              )}

              {/* BOTÓN DE CAPTURA DEL ÁNGULO ACTUAL */}
              <button
                type="button"
                onClick={handleCapturarAngulo}
                disabled={capturandoAngulo || enrolandoActivo || modelLoading}
                style={{
                  width: '100%',
                  padding: '0.62rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  background: capturedAngles[currentAngleKey]
                    ? 'rgba(56, 189, 248, 0.16)'
                    : 'linear-gradient(135deg, #38bdf8, #0284c7)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.86rem',
                  cursor: capturandoAngulo || enrolandoActivo || modelLoading ? 'wait' : 'pointer',
                  boxShadow: capturedAngles[currentAngleKey]
                    ? 'none'
                    : '0 4px 14px rgba(56, 189, 248, 0.28)',
                }}
              >
                {capturandoAngulo
                  ? `⏳ Capturando ${currentAngleConfig.label}...`
                  : capturedAngles[currentAngleKey]
                  ? `🔄 Re-capturar ${currentAngleConfig.label} (${currentAngleConfig.step})`
                  : `📸 Capturar ${currentAngleConfig.label} (${currentAngleConfig.step})`}
              </button>

              {/* CONSENTIMIENTO INFORMADO LEY N.° 29733 */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.55rem',
                  background: consentimientoLey29733
                    ? 'rgba(16, 185, 129, 0.1)'
                    : 'rgba(56, 189, 248, 0.08)',
                  border: consentimientoLey29733
                    ? '1px solid rgba(16, 185, 129, 0.4)'
                    : '1px solid rgba(56, 189, 248, 0.22)',
                  borderRadius: '10px',
                  padding: '0.6rem 0.75rem',
                  fontSize: '0.74rem',
                  color: '#cbd5e1',
                  lineHeight: 1.4,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={consentimientoLey29733}
                  onChange={(e) => {
                    setConsentimientoLey29733(e.target.checked);
                    if (e.target.checked) setEnrolError(null);
                  }}
                  style={{
                    marginTop: '0.15rem',
                    width: '15px',
                    height: '15px',
                    accentColor: '#00e699',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                />
                <span>
                  <strong style={{ color: consentimientoLey29733 ? '#34d399' : '#38bdf8' }}>
                    Consentimiento Biométrico (Ley N.° 29733):
                  </strong>{' '}
                  Autorizo el registro de mi plantilla facial matemática exclusivamente para el control de asistencia en la UCS. Su desvinculación se gestiona desde el Panel de Control.
                </span>
              </label>

              {/* BOTONES DE GUARDAR PLANTILLA 3D / REINICIAR */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleGuardarBiometria}
                  disabled={enrolandoActivo || capturandoAngulo || capturedCount === 0 || !consentimientoLey29733}
                  style={{
                    flex: 1,
                    padding: '0.68rem',
                    borderRadius: '10px',
                    border: 'none',
                    background:
                      capturedCount > 0 && consentimientoLey29733
                        ? 'linear-gradient(135deg, #00e699, #059669)'
                        : 'rgba(148, 163, 184, 0.2)',
                    color: capturedCount > 0 && consentimientoLey29733 ? '#020617' : '#94a3b8',
                    fontWeight: 900,
                    fontSize: '0.88rem',
                    cursor:
                      enrolandoActivo || capturandoAngulo || capturedCount === 0 || !consentimientoLey29733
                        ? 'not-allowed'
                        : 'pointer',
                    boxShadow:
                      capturedCount > 0 && consentimientoLey29733
                        ? '0 4px 14px rgba(0, 230, 153, 0.3)'
                        : 'none',
                  }}
                >
                  {enrolandoActivo
                    ? '⏳ Guardando plantilla 3D...'
                    : capturedCount === 3
                    ? '💾 Guardar Plantilla 3D Completa (3/3)'
                    : `💾 Guardar Plantilla (${capturedCount}/3 ángulos)`}
                </button>

                {capturedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCapturedAngles({});
                      setCurrentAngleKey('frente');
                      setEnrolError(null);
                      setStatusText('🎯 Paso 1/3 (Frente): Mira directo a la cámara y captura tu rostro');
                    }}
                    disabled={enrolandoActivo || capturandoAngulo}
                    style={{
                      padding: '0.68rem 0.85rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.16)',
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: '#cbd5e1',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                    title="Limpiar ángulos capturados y volver a empezar"
                  >
                    ↺
                  </button>
                )}
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
