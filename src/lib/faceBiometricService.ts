'use client';

/**
 * Servicio de Reconocimiento Facial en el Cliente (Edge AI / 100% Gratis)
 * Sincronizado permanentemente con Neon Postgres (descriptores de 128 floats en jsonb).
 * Carga prioritaria desde modelos locales en /models/face-api/ con fallback automático a CDN.
 * Calcula vectores de características faciales (embeddings de 128 dimensiones).
 */

declare global {
  interface Window {
    faceapi: any;
  }
}

export interface EnrolledFace {
  id?: number;
  dni: string;
  nombre: string;
  tipoPersonal?: string;
  descriptor: any; // number[] | number[][] | { version: number; descriptors: number[][]; centroid?: number[]; angles?: string[] }
  descriptors?: number[][];
  enrolledAt: string;
  fotoPreview?: string;
  anglesCaptured?: string[];
}

const STORAGE_KEY = 'ucs_kiosk_enrolled_faces_beta';
const LOCAL_SCRIPT = '/models/face-api/face-api.js';
const CDN_SCRIPT = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js';
const LOCAL_MODEL_URL = '/models/face-api/';
const CDN_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

let isModelsLoaded = false;
let isSsdLoaded = false;
let activeModelBaseUrl = LOCAL_MODEL_URL;
let scriptLoadPromise: Promise<boolean> | null = null;
let initModelsPromise: Promise<boolean> | null = null;
let ssdLoadPromise: Promise<boolean> | null = null;
let memoryCache: EnrolledFace[] | null = null;
let illuminationCanvas: HTMLCanvasElement | null = null;

/**
 * Carga un script externo/local como promesa limpia (limpia el DOM si falla para permitir reintentos)
 */
function injectScript(src: string, id: string): Promise<boolean> {
  return new Promise((resolve) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (window.faceapi) {
        resolve(true);
        return;
      }
      // Si existía un script previo que pudo quedar colgado o roto, removerlo antes de reintentar
      existing.remove();
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    if (src.startsWith('http')) {
      script.crossOrigin = 'anonymous';
    }

    script.onload = () => {
      if (window.faceapi) {
        resolve(true);
      } else {
        script.remove();
        resolve(false);
      }
    };

    script.onerror = () => {
      script.remove();
      resolve(false);
    };

    document.head.appendChild(script);
  });
}

/**
 * Inyecta dinámicamente face-api.js (primero desde /models/face-api/ local, con fallback a CDN).
 * Si falla por red, resetea la promesa para permitir reintentos posteriores sin recargar la página.
 */
function loadFaceApiScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.faceapi) return Promise.resolve(true);

  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = (async () => {
    // 1. Intentar carga local (cero dependencia de internet/firewall)
    const localOk = await injectScript(LOCAL_SCRIPT, 'face-api-runtime-script');
    if (localOk && window.faceapi) {
      console.log('✅ face-api.js cargado localmente desde /models/face-api/.');
      return true;
    }

    // 2. Fallback seguro a CDN
    console.warn('⚠️ No se pudo cargar face-api.js local, intentando CDN...');
    const cdnOk = await injectScript(CDN_SCRIPT, 'face-api-runtime-script');
    if (cdnOk && window.faceapi) {
      console.log('✅ face-api.js cargado desde CDN (fallback).');
      return true;
    }

    // Limpiar promesa para permitir reintento posterior
    scriptLoadPromise = null;
    console.error('❌ Error al cargar face-api.js tanto local como desde CDN.');
    return false;
  })();

  return scriptLoadPromise;
}

/**
 * Inicializa y carga en memoria los 3 modelos ligeros de visión artificial.
 * Protegido contra llamadas concurrentes y con reintento limpio si falla la red.
 */
export async function initFaceApi(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (isModelsLoaded && window.faceapi) return true;
  if (initModelsPromise) return initModelsPromise;

  initModelsPromise = (async () => {
    try {
      const scriptOk = await loadFaceApiScript();
      if (!scriptOk || !window.faceapi) {
        console.warn('⚠️ No se pudo inicializar window.faceapi.');
        initModelsPromise = null;
        return false;
      }

      const faceapi = window.faceapi;

      // Inicializar y sincronizar el backend de cómputo de TensorFlow.js antes de cargar los modelos
      if (faceapi.tf) {
        try {
          await faceapi.tf.setBackend('webgl');
          await faceapi.tf.ready();
          console.log('⚡ Backend WebGL (GPU) inicializado para visión artificial.');
        } catch (errWebGL) {
          console.warn('⚠️ WebGL no disponible. Activando fallback a CPU:', errWebGL);
          try {
            await faceapi.tf.setBackend('cpu');
            await faceapi.tf.ready();
            console.log('🛡️ Backend CPU activo como fallback universal.');
          } catch (errCpu) {
            console.warn('⚠️ Fallback final tf.ready():', errCpu);
            await faceapi.tf.ready().catch(() => {});
          }
        }
      }

      // Cargar modelos: primero desde /models/face-api/ local, con fallback automático a CDN
      const loadBaseNets = async (baseUrl: string) => {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(baseUrl),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(baseUrl),
          faceapi.nets.faceRecognitionNet.loadFromUri(baseUrl),
        ]);
      };

      try {
        await loadBaseNets(LOCAL_MODEL_URL);
        activeModelBaseUrl = LOCAL_MODEL_URL;
        console.log('🧠 Modelos base de Reconocimiento Facial cargados localmente.');
      } catch (localErr) {
        console.warn('⚠️ Fallo al cargar modelos locales, recurriendo a CDN:', localErr);
        await loadBaseNets(CDN_MODEL_URL);
        activeModelBaseUrl = CDN_MODEL_URL;
        console.log('🧠 Modelos base de Reconocimiento Facial cargados desde CDN.');
      }

      isModelsLoaded = true;
      return true;
    } catch (error) {
      console.error('Error al inicializar modelos de face-api:', error);
      initModelsPromise = null;
      return false;
    }
  })();

  return initModelsPromise;
}

/**
 * Inicializa y descarga bajo demanda el modelo de alta precisión SSD MobileNet v1.
 * Si falla por un microcorte de red, limpia ssdLoadPromise para permitir reintentos.
 */
export async function initSsdMobilenet(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const baseOk = await initFaceApi();
    if (!baseOk || !window.faceapi) return false;

    if (isSsdLoaded && window.faceapi.nets?.ssdMobilenetv1?.isLoaded) return true;
    if (ssdLoadPromise) return ssdLoadPromise;

    ssdLoadPromise = (async () => {
      try {
        const faceapi = window.faceapi;
        if (!faceapi.nets?.ssdMobilenetv1?.isLoaded) {
          try {
            console.log('📦 Cargando modelo SSD MobileNet v1 localmente...');
            await faceapi.nets.ssdMobilenetv1.loadFromUri(activeModelBaseUrl);
          } catch {
            const fallbackUrl = activeModelBaseUrl === LOCAL_MODEL_URL ? CDN_MODEL_URL : LOCAL_MODEL_URL;
            console.warn(`⚠️ Reintentando carga de SSD MobileNet v1 desde ${fallbackUrl}...`);
            await faceapi.nets.ssdMobilenetv1.loadFromUri(fallbackUrl);
          }
        }
        isSsdLoaded = true;
        console.log('🎯 Modelo SSD MobileNet v1 listo para enrolamiento de alta precisión.');
        return true;
      } catch (innerErr: any) {
        // Limpiar promesa fallida para permitir reintento futuro
        ssdLoadPromise = null;
        console.warn('⚠️ No se pudo cargar SSD MobileNet v1, usando TinyFace como fallback:', innerErr?.message);
        return false;
      }
    })();

    return await ssdLoadPromise;
  } catch (err: any) {
    ssdLoadPromise = null;
    console.warn('⚠️ Error al inicializar SSD MobileNet v1:', err?.message);
    return false;
  }
}

/**
 * Indica si el modelo SSD MobileNet v1 está cargado y disponible
 */
export function isSsdModelLoaded(): boolean {
  return isSsdLoaded && typeof window !== 'undefined' && !!window.faceapi?.nets?.ssdMobilenetv1?.isLoaded;
}

/**
 * Calcula el Eye Aspect Ratio (EAR) a partir de los 6 puntos anatómicos de un ojo.
 * Valores típicos: Ojos abiertos: 0.26 - 0.38 | Ojos cerrados/parpadeo: < 0.20
 */
export function calculateEAR(eyePoints: { x: number; y: number }[]): number {
  if (!eyePoints || eyePoints.length < 6) return 0.3;
  const v1 = Math.hypot(eyePoints[1].x - eyePoints[5].x, eyePoints[1].y - eyePoints[5].y);
  const v2 = Math.hypot(eyePoints[2].x - eyePoints[4].x, eyePoints[2].y - eyePoints[4].y);
  const h = Math.hypot(eyePoints[0].x - eyePoints[3].x, eyePoints[0].y - eyePoints[3].y);
  if (h === 0) return 0.3;
  return (v1 + v2) / (2.0 * h);
}

/**
 * Evalúa el brillo promedio (0–255) dentro de la región del rostro para detectar
 * ambientes demasiado oscuros o contraluz severo antes de enrolar o validar.
 */
export function evaluateFaceIllumination(
  videoOrCanvas: HTMLVideoElement | HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number } | null
): number | null {
  if (typeof document === 'undefined' || !box || box.width <= 10 || box.height <= 10) return null;

  try {
    if (!illuminationCanvas) {
      illuminationCanvas = document.createElement('canvas');
      illuminationCanvas.width = 32;
      illuminationCanvas.height = 32;
    }

    const ctx = illuminationCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const srcW =
      videoOrCanvas instanceof HTMLVideoElement ? videoOrCanvas.videoWidth : videoOrCanvas.width;
    const srcH =
      videoOrCanvas instanceof HTMLVideoElement ? videoOrCanvas.videoHeight : videoOrCanvas.height;
    if (!srcW || !srcH) return null;

    const sx = Math.max(0, Math.min(srcW - 1, box.x));
    const sy = Math.max(0, Math.min(srcH - 1, box.y));
    const sw = Math.max(1, Math.min(srcW - sx, box.width));
    const sh = Math.max(1, Math.min(srcH - sy, box.height));

    ctx.drawImage(videoOrCanvas, sx, sy, sw, sh, 0, 0, 32, 32);
    const { data } = ctx.getImageData(0, 0, 32, 32);

    let lumSum = 0;
    const pixelCount = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      // Luminancia perceptual Rec. 601
      lumSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    return Math.round(lumSum / pixelCount);
  } catch {
    return null;
  }
}

export interface ExtractFaceOptions {
  useSsd?: boolean;
  minConfidence?: number;
}

/**
 * Extrae el descriptor de 128 dimensiones de un fotograma en vivo.
 * Soporta modo híbrido:
 * - TinyFaceDetector: por defecto para escaneo en tiempo real en el Kiosco.
 * - SSD MobileNet v1 (con `useSsd: true`): para enrolamiento de máxima precisión.
 * Incluye cálculo de EAR (Eye Aspect Ratio) y brillo facial.
 */
export async function extractFaceDescriptor(
  videoOrCanvas: HTMLVideoElement | HTMLCanvasElement,
  options?: ExtractFaceOptions
): Promise<{
  descriptor: Float32Array | null;
  box: { x: number; y: number; width: number; height: number } | null;
  detectorUsed?: 'ssd' | 'tiny';
  ear?: number | null;
  isBlinking?: boolean;
  brightness?: number | null;
  error?: string;
}> {
  if (!window.faceapi || !isModelsLoaded) {
    const ok = await initFaceApi();
    if (!ok) return { descriptor: null, box: null, detectorUsed: 'tiny', error: 'Modelos no disponibles' };
  }

  const faceapi = window.faceapi;
  let detectorUsed: 'ssd' | 'tiny' = 'tiny';

  try {
    let detection: any = null;

    if (options?.useSsd) {
      if (!isSsdLoaded) {
        await initSsdMobilenet();
      }

      if (faceapi.nets?.ssdMobilenetv1?.isLoaded) {
        detectorUsed = 'ssd';
        const ssdOpts = new faceapi.SsdMobilenetv1Options({
          minConfidence: options.minConfidence ?? 0.5,
        });
        detection = await faceapi
          .detectSingleFace(videoOrCanvas, ssdOpts)
          .withFaceLandmarks(true)
          .withFaceDescriptor();
      }
    }

    if (!detection) {
      detectorUsed = 'tiny';
      const tinyOpts = new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: options?.minConfidence ?? 0.5,
      });
      detection = await faceapi
        .detectSingleFace(videoOrCanvas, tinyOpts)
        .withFaceLandmarks(true)
        .withFaceDescriptor();
    }

    if (!detection) {
      return { descriptor: null, box: null, detectorUsed };
    }

    const box = {
      x: Math.round(detection.detection.box.x),
      y: Math.round(detection.detection.box.y),
      width: Math.round(detection.detection.box.width),
      height: Math.round(detection.detection.box.height),
    };

    // Cálculo de Eye Aspect Ratio (EAR) para Liveness Detection / Anti-Spoofing
    let ear: number | null = null;
    let isBlinking = false;
    if (detection.landmarks?.positions && detection.landmarks.positions.length >= 48) {
      const positions = detection.landmarks.positions;
      const leftEye = positions.slice(36, 42);
      const rightEye = positions.slice(42, 48);
      const leftEar = calculateEAR(leftEye);
      const rightEar = calculateEAR(rightEye);
      ear = Number(((leftEar + rightEar) / 2).toFixed(3));
      isBlinking = ear < 0.20;
    }

    const brightness = evaluateFaceIllumination(videoOrCanvas, box);

    return {
      descriptor: detection.descriptor,
      box,
      detectorUsed,
      ear,
      isBlinking,
      brightness,
    };
  } catch (err: any) {
    return { descriptor: null, box: null, detectorUsed, error: err.message };
  }
}

export type FaceQualityStatus =
  | 'optimal'
  | 'too_far'
  | 'too_close'
  | 'off_center'
  | 'too_dark'
  | 'too_bright'
  | 'no_face';

export interface FaceQualityResult {
  status: FaceQualityStatus;
  isOptimal: boolean;
  message: string;
  icon: string;
  boxRatio: number;
  offsetNormX: number;
  offsetNormY: number;
  brightness?: number | null;
}

export interface FaceQualityOptions {
  angle?: 'frente' | 'izquierda' | 'derecha';
  brightness?: number | null;
}

/**
 * Evalúa en tiempo real el encuadre, distancia, centrado e iluminación del rostro dentro del visor.
 * Relaja ligeramente el margen horizontal para los ángulos laterales (izquierda/derecha) en el enrolador 3D.
 */
export function evaluateFaceQuality(
  box: { x: number; y: number; width: number; height: number } | null,
  frameWidth: number,
  frameHeight: number,
  options?: FaceQualityOptions
): FaceQualityResult {
  if (!box || frameWidth <= 0 || frameHeight <= 0) {
    return {
      status: 'no_face',
      isOptimal: false,
      message: 'Colócate frente a la cámara web...',
      icon: '👤',
      boxRatio: 0,
      offsetNormX: 0,
      offsetNormY: 0,
      brightness: null,
    };
  }

  const isSideAngle = options?.angle === 'izquierda' || options?.angle === 'derecha';
  const minBoxRatio = isSideAngle ? 0.24 : 0.28;
  const maxBoxRatio = 0.84;
  const maxOffsetX = isSideAngle ? 0.30 : 0.23;
  const maxOffsetY = 0.27;

  const boxRatio = box.height / frameHeight;
  const faceCenterX = box.x + box.width / 2;
  const faceCenterY = box.y + box.height / 2;
  const offsetNormX = (faceCenterX - frameWidth / 2) / frameWidth;
  const offsetNormY = (faceCenterY - frameHeight / 2) / frameHeight;
  const brightness = options?.brightness ?? null;

  // 1. Demasiado lejos (descarta personas caminando en el pasillo)
  if (boxRatio < minBoxRatio) {
    return {
      status: 'too_far',
      isOptimal: false,
      message: '📏 Acércate un poco más a la cámara',
      icon: '🔍',
      boxRatio: Number(boxRatio.toFixed(3)),
      offsetNormX: Number(offsetNormX.toFixed(3)),
      offsetNormY: Number(offsetNormY.toFixed(3)),
      brightness,
    };
  }

  // 2. Demasiado cerca
  if (boxRatio > maxBoxRatio) {
    return {
      status: 'too_close',
      isOptimal: false,
      message: '📏 Aléjate un poco de la cámara',
      icon: '🔙',
      boxRatio: Number(boxRatio.toFixed(3)),
      offsetNormX: Number(offsetNormX.toFixed(3)),
      offsetNormY: Number(offsetNormY.toFixed(3)),
      brightness,
    };
  }

  // 3. Fuera de centro
  if (Math.abs(offsetNormX) > maxOffsetX || Math.abs(offsetNormY) > maxOffsetY) {
    return {
      status: 'off_center',
      isOptimal: false,
      message: '🎯 Centra tu rostro en el óvalo',
      icon: '🎯',
      boxRatio: Number(boxRatio.toFixed(3)),
      offsetNormX: Number(offsetNormX.toFixed(3)),
      offsetNormY: Number(offsetNormY.toFixed(3)),
      brightness,
    };
  }

  // 4. Iluminación insuficiente o contraluz extremo
  if (typeof brightness === 'number' && brightness < 42) {
    return {
      status: 'too_dark',
      isOptimal: false,
      message: '💡 Muy poca luz: busca un lugar más iluminado',
      icon: '💡',
      boxRatio: Number(boxRatio.toFixed(3)),
      offsetNormX: Number(offsetNormX.toFixed(3)),
      offsetNormY: Number(offsetNormY.toFixed(3)),
      brightness,
    };
  }

  if (typeof brightness === 'number' && brightness > 238) {
    return {
      status: 'too_bright',
      isOptimal: false,
      message: '☀️ Demasiado brillo/contraluz en el rostro',
      icon: '☀️',
      boxRatio: Number(boxRatio.toFixed(3)),
      offsetNormX: Number(offsetNormX.toFixed(3)),
      offsetNormY: Number(offsetNormY.toFixed(3)),
      brightness,
    };
  }

  // 5. Posición biométrica óptima
  return {
    status: 'optimal',
    isOptimal: true,
    message: '✨ Posición biométrica óptima',
    icon: '✨',
    boxRatio: Number(boxRatio.toFixed(3)),
    offsetNormX: Number(offsetNormX.toFixed(3)),
    offsetNormY: Number(offsetNormY.toFixed(3)),
    brightness,
  };
}

/**
 * Calcula la distancia euclidiana entre dos descriptores faciales
 */
export function euclideanDistance(desc1: number[] | Float32Array, desc2: number[] | Float32Array): number {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) return 1.0;
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Normaliza un vector numérico a norma L2 = 1.0
 */
export function normalizeVector(vec: number[]): number[] {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  const mag = Math.sqrt(sum);
  if (mag === 0) return vec;
  return vec.map((x) => x / mag);
}

/**
 * Calcula el centroide geométrico exacto (media aritmética) de múltiples descriptores faciales.
 * Mantiene la misma escala nativa de faceRecognitionNet para comparaciones euclidianas sin sesgo.
 */
export function computeCentroid(descriptors: (number[] | Float32Array)[]): number[] {
  if (!descriptors || descriptors.length === 0) return [];
  if (descriptors.length === 1) return Array.from(descriptors[0]);

  const dim = descriptors[0].length;
  const centroid = new Array(dim).fill(0);
  for (const d of descriptors) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += d[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    centroid[i] /= descriptors.length;
  }
  return centroid;
}

/**
 * Extrae de forma segura todos los vectores de 128 flotantes asociados a un perfil enrolado,
 * soportando vectores planos v1 (legacy) y colecciones multi-ángulo v2.
 */
export function extractAllDescriptors(item: EnrolledFace): number[][] {
  const result: number[][] = [];

  if (Array.isArray(item.descriptors) && item.descriptors.length > 0) {
    for (const d of item.descriptors) {
      if (Array.isArray(d) && d.length === 128) result.push(d);
    }
  }

  if (typeof item.descriptor === 'object' && item.descriptor !== null) {
    const obj = item.descriptor as any;
    if (Array.isArray(obj.descriptors)) {
      for (const d of obj.descriptors) {
        if (Array.isArray(d) && d.length === 128) result.push(d);
      }
    }
    if (Array.isArray(obj.centroid) && obj.centroid.length === 128) {
      result.push(obj.centroid);
    }
  }

  if (Array.isArray(item.descriptor) && item.descriptor.length > 0) {
    if (Array.isArray(item.descriptor[0])) {
      for (const d of item.descriptor as unknown as number[][]) {
        if (Array.isArray(d) && d.length === 128) result.push(d);
      }
    } else if (typeof item.descriptor[0] === 'number' && item.descriptor.length === 128) {
      result.push(item.descriptor as number[]);
    }
  }

  return result;
}

/**
 * Compara un descriptor en vivo contra los rostros enrolados.
 * Evalúa por usuario único (DNI) y aplica:
 * - Umbral estricto: mejor distancia < 0.52
 * - Margen de separación Top-1 vs Top-2 (evita confusiones entre personas muy parecidas)
 */
export function findMatchingUser(
  currentDescriptor: Float32Array | number[]
): {
  matched: boolean;
  ambiguous?: boolean;
  user?: EnrolledFace;
  confidence: number;
  distance: number;
  margin?: number;
} {
  const enrolled = getEnrolledFaces();
  if (enrolled.length === 0) {
    return { matched: false, confidence: 0, distance: 1.0 };
  }

  let bestMatch: EnrolledFace | undefined = undefined;
  let bestDist = 1.0;
  let secondBestDist = 1.0;

  for (const item of enrolled) {
    const vectors = extractAllDescriptors(item);
    if (vectors.length === 0) continue;

    let userMinDist = 1.0;
    for (const vec of vectors) {
      const dist = euclideanDistance(currentDescriptor, vec);
      if (dist < userMinDist) {
        userMinDist = dist;
      }
    }

    if (userMinDist < bestDist) {
      secondBestDist = bestDist;
      bestDist = userMinDist;
      bestMatch = item;
    } else if (userMinDist < secondBestDist) {
      secondBestDist = userMinDist;
    }
  }

  const MATCH_THRESHOLD = 0.52;
  const margin = Number((secondBestDist - bestDist).toFixed(3));

  if (bestDist < MATCH_THRESHOLD && bestMatch) {
    // Si hay 2 o más usuarios enrolados y el 2.° candidato está demasiado cerca, rechazar por ambigüedad
    const requiredMargin = bestDist <= 0.38 ? 0.03 : 0.055;
    if (enrolled.length >= 2 && margin < requiredMargin) {
      return {
        matched: false,
        ambiguous: true,
        confidence: Math.max(0, Math.round((1 - bestDist / 0.8) * 100)),
        distance: Number(bestDist.toFixed(3)),
        margin,
      };
    }

    const confidence = Math.max(55, Math.min(99, Math.round((1 - bestDist / 0.8) * 100)));
    return {
      matched: true,
      user: bestMatch,
      confidence,
      distance: Number(bestDist.toFixed(3)),
      margin,
    };
  }

  return {
    matched: false,
    confidence: Math.max(0, Math.round((1 - bestDist) * 100)),
    distance: Number(bestDist.toFixed(3)),
    margin,
  };
}

/**
 * Verifica antes de enrolar si el rostro capturado ya pertenece a otro colaborador registrado bajo un DNI distinto.
 * Previene errores humanos al enrolar rápidamente en campo.
 */
export function findDuplicateEnrolledFace(
  candidateDescriptor: Float32Array | number[],
  excludeDni: string
): {
  isDuplicate: boolean;
  existingUser?: EnrolledFace;
  distance: number;
  confidence: number;
} {
  const enrolled = getEnrolledFaces();
  const cleanExclude = excludeDni.trim();
  let bestMatch: EnrolledFace | undefined = undefined;
  let minDistance = 1.0;

  for (const item of enrolled) {
    if (item.dni.trim() === cleanExclude) continue;
    const vectors = extractAllDescriptors(item);
    for (const vec of vectors) {
      const dist = euclideanDistance(candidateDescriptor, vec);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = item;
      }
    }
  }

  const DUPLICATE_THRESHOLD = 0.45;
  if (minDistance < DUPLICATE_THRESHOLD && bestMatch) {
    const confidence = Math.max(60, Math.min(99, Math.round((1 - minDistance / 0.8) * 100)));
    return {
      isDuplicate: true,
      existingUser: bestMatch,
      distance: Number(minDistance.toFixed(3)),
      confidence,
    };
  }

  return { isDuplicate: false, distance: Number(minDistance.toFixed(3)), confidence: 0 };
}

/**
 * Persiste únicamente los vectores ligeros (sin fotos Base64) en localStorage para evitar QuotaExceededError.
 */
function persistFacesToLocalStorage(faces: EnrolledFace[]): void {
  if (typeof window === 'undefined') return;
  try {
    const liteFaces = faces.map(({ fotoPreview: _omit, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(liteFaces));
  } catch (err) {
    console.warn('⚠️ No se pudo actualizar caché localStorage (se mantiene en RAM):', err);
  }
}

/**
 * Obtener la lista de rostros enrolados (desde memoria RAM o localStorage)
 */
export function getEnrolledFaces(): EnrolledFace[] {
  if (memoryCache !== null) {
    return memoryCache;
  }
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const parsed = data ? JSON.parse(data) : [];
    memoryCache = Array.isArray(parsed) ? parsed : [];
    return memoryCache;
  } catch {
    return [];
  }
}

/**
 * Guardar localmente un rostro enrolado (en RAM y caché ligero)
 */
export function saveEnrolledFace(newFace: EnrolledFace): void {
  if (typeof window === 'undefined') return;
  const current = getEnrolledFaces();
  const { fotoPreview: _omit, ...liteFace } = newFace;
  const filtered = current.filter((f) => f.dni !== liteFace.dni);
  filtered.push(liteFace);
  memoryCache = filtered;
  persistFacesToLocalStorage(filtered);
}

/**
 * Eliminar localmente el enrolamiento de un usuario
 */
export function removeEnrolledFace(dni: string): void {
  if (typeof window === 'undefined') return;
  const current = getEnrolledFaces();
  const filtered = current.filter((f) => f.dni !== dni);
  memoryCache = filtered;
  persistFacesToLocalStorage(filtered);
}

function getBiometricAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  if (typeof window !== 'undefined') {
    try {
      const token = localStorage.getItem('ucs_terminal_token');
      if (token) {
        headers['x-terminal-token'] = token;
      }
    } catch {
      // Silenciar si localStorage no está disponible
    }
  }
  return headers;
}

/**
 * Sincroniza los descriptores biométricos desde Neon Postgres a la memoria del navegador.
 * Usa modo ligero (?lite=true, sin Base64) y cache: 'no-store' para garantizar datos frescos siempre.
 */
export async function syncEnrolledFacesFromDB(): Promise<{
  success: boolean;
  faces: EnrolledFace[];
  error?: string;
}> {
  if (typeof window === 'undefined') {
    return { success: false, faces: [], error: 'Entorno no soportado' };
  }

  try {
    const response = await fetch(`/api/biometria/descriptores?lite=true&_t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: getBiometricAuthHeaders({ 'Cache-Control': 'no-cache' }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    if (data.success && Array.isArray(data.descriptores)) {
      const faces: EnrolledFace[] = data.descriptores;
      memoryCache = faces;
      persistFacesToLocalStorage(faces);
      console.log(`☁️ Sincronizados ${faces.length} rostros (modo ligero) desde la base de datos.`);
      return { success: true, faces };
    }

    return { success: false, faces: getEnrolledFaces(), error: data.error || 'Respuesta inválida' };
  } catch (err: any) {
    console.warn('⚠️ No se pudo sincronizar desde BD, usando caché local:', err.message);
    return { success: false, faces: getEnrolledFaces(), error: err.message };
  }
}

/**
 * Enrola un rostro en la base de datos Neon Postgres y actualiza el caché local.
 */
export async function saveEnrolledFaceToDB(face: EnrolledFace): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const response = await fetch('/api/biometria/enrolar', {
      method: 'POST',
      headers: getBiometricAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        dni: face.dni,
        descriptor: face.descriptor,
        fotoPreview: face.fotoPreview,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Error ${response.status} al guardar en base de datos.`,
      };
    }

    // Actualizar caché local inmediatamente
    saveEnrolledFace({
      ...face,
      nombre: data.usuario?.nombreCompleto || face.nombre,
      tipoPersonal: data.usuario?.tipoPersonal || face.tipoPersonal,
      enrolledAt: data.usuario?.enroladoAt || face.enrolledAt,
    });

    return {
      success: true,
      message: data.message || 'Rostro enrolado exitosamente en la base de datos.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Error de red al conectar con el servidor: ${err.message}`,
    };
  }
}

/**
 * Elimina el enrolamiento biométrico de un usuario tanto en Neon Postgres como localmente.
 */
export async function deleteEnrolledFaceFromDB(dni: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`/api/biometria/enrolar?dni=${encodeURIComponent(dni)}`, {
      method: 'DELETE',
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || `Error ${response.status} al eliminar en base de datos.`,
      };
    }

    removeEnrolledFace(dni);
    return {
      success: true,
      message: data.message || 'Enrolamiento eliminado correctamente.',
    };
  } catch (err: any) {
    removeEnrolledFace(dni);
    return {
      success: false,
      error: `Error de conexión: ${err.message}. Se removió localmente.`,
    };
  }
}
