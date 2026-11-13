'use client';

/**
 * Servicio de Reconocimiento Facial en el Cliente (Edge AI / 100% Gratis)
 * Sincronizado permanentemente con Neon Postgres (descriptores de 128 floats en jsonb).
 * Utiliza @vladmandic/face-api cargado dinámicamente vía CDN.
 * Calcula vectores de características faciales (embeddings de 128 dimensiones).
 * Costo de servidor / APIs externas: $0.00 USD.
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
const CDN_SCRIPT = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js';
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

let isModelsLoaded = false;
let isSsdLoaded = false;
let scriptLoadPromise: Promise<boolean> | null = null;
let ssdLoadPromise: Promise<boolean> | null = null;
let memoryCache: EnrolledFace[] | null = null;

/**
 * Inyecta dinámicamente el script de face-api en el documento
 */
function loadFaceApiScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.faceapi) return Promise.resolve(true);

  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve) => {
    if (document.getElementById('face-api-cdn-script')) {
      const checkInterval = setInterval(() => {
        if (window.faceapi) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.id = 'face-api-cdn-script';
    script.src = CDN_SCRIPT;
    script.async = true;
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      console.log('✅ face-api.js cargado exitosamente desde CDN.');
      resolve(true);
    };

    script.onerror = (err) => {
      console.error('❌ Error al cargar face-api.js desde CDN:', err);
      resolve(false);
    };

    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * Inicializa y carga en memoria los 3 modelos ligeros de visión artificial
 */
export async function initFaceApi(): Promise<boolean> {
  try {
    if (isModelsLoaded && window.faceapi) return true;

    const scriptOk = await loadFaceApiScript();
    if (!scriptOk || !window.faceapi) {
      console.warn('⚠️ No se pudo inicializar window.faceapi.');
      return false;
    }

    const faceapi = window.faceapi;

    // Cargar modelos requeridos para detección, landmarks y embedding de 128 floats
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);

    isModelsLoaded = true;
    console.log('🧠 Modelos de Reconocimiento Facial cargados en memoria WebGL.');
    return true;
  } catch (error) {
    console.error('Error al inicializar modelos de face-api:', error);
    return false;
  }
}

/**
 * Inicializa y descarga bajo demanda el modelo de alta precisión SSD MobileNet v1.
 * Se utiliza primordialmente para el Enrolamiento de colaboradores (máxima resolución y landmarks exactos).
 */
export async function initSsdMobilenet(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const baseOk = await initFaceApi();
    if (!baseOk || !window.faceapi) return false;

    if (isSsdLoaded && window.faceapi.nets?.ssdMobilenetv1?.isLoaded) return true;
    if (ssdLoadPromise) return ssdLoadPromise;

    ssdLoadPromise = (async () => {
      const faceapi = window.faceapi;
      if (!faceapi.nets?.ssdMobilenetv1?.isLoaded) {
        console.log('📦 Cargando modelo de alta precisión SSD MobileNet v1 para Enrolamiento...');
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
      }
      isSsdLoaded = true;
      console.log('🎯 Modelo SSD MobileNet v1 cargado exitosamente en memoria WebGL.');
      return true;
    })();

    return await ssdLoadPromise;
  } catch (err: any) {
    console.warn('⚠️ No se pudo cargar SSD MobileNet v1, usando TinyFace como fallback seguro:', err.message);
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

export interface ExtractFaceOptions {
  useSsd?: boolean;
  minConfidence?: number;
}

/**
 * Extrae el descriptor de 128 dimensiones de un fotograma en vivo.
 * Soporta modo híbrido:
 * - TinyFaceDetector: por defecto para escaneo en tiempo real a 30+ FPS en el Kiosco.
 * - SSD MobileNet v1 (con `useSsd: true`): para enrolamiento de máxima precisión y fidelidad geométrica.
 * Incluye cálculo en tiempo real de EAR (Eye Aspect Ratio) para prueba de vida pasiva/activa (anti-spoofing).
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

    // Si se requiere alta precisión (SSD MobileNet v1)
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

    // Fallback seguro o modo continuo en tiempo real: TinyFaceDetector
    if (!detection) {
      detectorUsed = 'tiny';
      const tinyOpts = new faceapi.TinyFaceDetectorOptions({
        inputSize: 224, // 160 o 224 para ultra-velocidad en tiempo real
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

    return {
      descriptor: detection.descriptor,
      box: {
        x: Math.round(detection.detection.box.x),
        y: Math.round(detection.detection.box.y),
        width: Math.round(detection.detection.box.width),
        height: Math.round(detection.detection.box.height),
      },
      detectorUsed,
      ear,
      isBlinking,
    };
  } catch (err: any) {
    return { descriptor: null, box: null, detectorUsed, error: err.message };
  }
}

export type FaceQualityStatus = 'optimal' | 'too_far' | 'too_close' | 'off_center' | 'no_face';

export interface FaceQualityResult {
  status: FaceQualityStatus;
  isOptimal: boolean;
  message: string;
  icon: string;
  boxRatio: number;
  offsetNormX: number;
  offsetNormY: number;
}

/**
 * Evalúa en tiempo real el encuadre, distancia y centrado del rostro dentro del visor.
 * Evita procesar transeúntes de fondo a 3 metros (demasiado lejos) o capturas degradadas.
 */
export function evaluateFaceQuality(
  box: { x: number; y: number; width: number; height: number } | null,
  frameWidth: number,
  frameHeight: number
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
    };
  }

  // Proporción de la altura del rostro respecto a la altura total de la cámara
  const boxRatio = box.height / frameHeight;

  // Centroide del rostro relativo al centro del encuadre
  const faceCenterX = box.x + box.width / 2;
  const faceCenterY = box.y + box.height / 2;
  const frameCenterX = frameWidth / 2;
  const frameCenterY = frameHeight / 2;

  const offsetNormX = (faceCenterX - frameCenterX) / frameWidth;
  const offsetNormY = (faceCenterY - frameCenterY) / frameHeight;

  // 1. Demasiado lejos (por ejemplo, personas caminando en el pasillo a 3 metros)
  if (boxRatio < 0.28) {
    return {
      status: 'too_far',
      isOptimal: false,
      message: '📏 Acércate un poco más a la cámara',
      icon: '🔍',
      boxRatio: Number(boxRatio.toFixed(3)),
      offsetNormX: Number(offsetNormX.toFixed(3)),
      offsetNormY: Number(offsetNormY.toFixed(3)),
    };
  }

  // 2. Demasiado cerca (se sale del margen de captura)
  if (boxRatio > 0.82) {
    return {
      status: 'too_close',
      isOptimal: false,
      message: '📏 Aléjate un poco de la cámara',
      icon: '🔙',
      boxRatio: Number(boxRatio.toFixed(3)),
      offsetNormX: Number(offsetNormX.toFixed(3)),
      offsetNormY: Number(offsetNormY.toFixed(3)),
    };
  }

  // 3. Fuera de centro (desviación lateral o vertical excesiva)
  if (Math.abs(offsetNormX) > 0.22 || Math.abs(offsetNormY) > 0.26) {
    return {
      status: 'off_center',
      isOptimal: false,
      message: '🎯 Centra tu rostro en el óvalo',
      icon: '🎯',
      boxRatio: Number(boxRatio.toFixed(3)),
      offsetNormX: Number(offsetNormX.toFixed(3)),
      offsetNormY: Number(offsetNormY.toFixed(3)),
    };
  }

  // 4. Posición biométrica óptima
  return {
    status: 'optimal',
    isOptimal: true,
    message: '✨ Posición biométrica óptima',
    icon: '✨',
    boxRatio: Number(boxRatio.toFixed(3)),
    offsetNormX: Number(offsetNormX.toFixed(3)),
    offsetNormY: Number(offsetNormY.toFixed(3)),
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
 * Calcula el centroide normalizado a partir de múltiples descriptores faciales (ej. multi-ángulo)
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
  return normalizeVector(centroid);
}

/**
 * Extrae de forma segura todos los vectores de 128 flotantes asociados a un perfil enrolado,
 * soportando vectores planos v1 (legacy) y colecciones multi-ángulo v2.
 */
export function extractAllDescriptors(item: EnrolledFace): number[][] {
  const result: number[][] = [];

  // 1. Array explícito de descriptores
  if (Array.isArray(item.descriptors) && item.descriptors.length > 0) {
    for (const d of item.descriptors) {
      if (Array.isArray(d) && d.length === 128) result.push(d);
    }
  }

  // 2. Objeto con propiedad descriptors: { version: 2, descriptors: [...] }
  if (typeof item.descriptor === 'object' && item.descriptor !== null) {
    const obj = item.descriptor as any;
    if (Array.isArray(obj.descriptors)) {
      for (const d of obj.descriptors) {
        if (Array.isArray(d) && d.length === 128) result.push(d);
      }
    }
    // Si tiene centroide almacenado y no está ya incluido
    if (Array.isArray(obj.centroid) && obj.centroid.length === 128) {
      result.push(obj.centroid);
    }
  }

  // 3. Array directo (array de arrays o array simple de 128)
  if (Array.isArray(item.descriptor) && item.descriptor.length > 0) {
    if (Array.isArray(item.descriptor[0])) {
      for (const d of item.descriptor as unknown as number[][]) {
        if (Array.isArray(d) && d.length === 128) result.push(d);
      }
    } else if (typeof item.descriptor[0] === 'number' && item.descriptor.length === 128) {
      // Vector plano legacy v1 (128 floats)
      result.push(item.descriptor as number[]);
    }
  }

  return result;
}

/**
 * Compara un descriptor en vivo contra los rostros enrolados.
 * En perfiles multi-ángulo (v2), evalúa la distancia mínima frente a todos los ángulos registrados.
 * Umbral de reconocimiento: distancia < 0.55 (estándar internacional de face-api)
 */
export function findMatchingUser(
  currentDescriptor: Float32Array | number[]
): {
  matched: boolean;
  user?: EnrolledFace;
  confidence: number;
  distance: number;
} {
  const enrolled = getEnrolledFaces();
  if (enrolled.length === 0) {
    return { matched: false, confidence: 0, distance: 1.0 };
  }

  let bestMatch: EnrolledFace | undefined = undefined;
  let minDistance = 1.0;

  for (const item of enrolled) {
    const vectors = extractAllDescriptors(item);
    if (vectors.length === 0) continue;

    for (const vec of vectors) {
      const dist = euclideanDistance(currentDescriptor, vec);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = item;
      }
    }
  }

  // Umbral de coincidencia: < 0.55 es match confirmado
  const MATCH_THRESHOLD = 0.55;
  if (minDistance < MATCH_THRESHOLD && bestMatch) {
    // Confianza estimada: 0.0 -> 100%, 0.55 -> ~50%
    const confidence = Math.max(50, Math.min(99, Math.round((1 - minDistance / 0.8) * 100)));
    return {
      matched: true,
      user: bestMatch,
      confidence,
      distance: Number(minDistance.toFixed(3)),
    };
  }

  return {
    matched: false,
    confidence: Math.max(0, Math.round((1 - minDistance) * 100)),
    distance: Number(minDistance.toFixed(3)),
  };
}

/**
 * Obtener la lista de rostros enrolados (desde memoria o localStorage)
 */
export function getEnrolledFaces(): EnrolledFace[] {
  if (memoryCache && memoryCache.length > 0) {
    return memoryCache;
  }
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const parsed = data ? JSON.parse(data) : [];
    memoryCache = parsed;
    return parsed;
  } catch {
    return [];
  }
}

/**
 * Guardar localmente un rostro enrolado
 */
export function saveEnrolledFace(newFace: EnrolledFace): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getEnrolledFaces();
    const filtered = current.filter((f) => f.dni !== newFace.dni);
    filtered.push(newFace);
    memoryCache = filtered;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Error al guardar rostro enrolado localmente:', err);
  }
}

/**
 * Eliminar localmente el enrolamiento de un usuario
 */
export function removeEnrolledFace(dni: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getEnrolledFaces();
    const filtered = current.filter((f) => f.dni !== dni);
    memoryCache = filtered;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Error al eliminar rostro enrolado localmente:', err);
  }
}

/**
 * Sincroniza los descriptores biométricos desde Neon Postgres a la memoria del navegador.
 * Permite que cualquier terminal Kiosco conozca a todos los colaboradores enrolados.
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
    const response = await fetch('/api/biometria/descriptores', {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();
    if (data.success && Array.isArray(data.descriptores)) {
      const faces: EnrolledFace[] = data.descriptores;
      memoryCache = faces;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(faces));
      console.log(`☁️ Sincronizados ${faces.length} rostros desde Neon Postgres.`);
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
      headers: { 'Content-Type': 'application/json' },
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

    // Actualizar caché local
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
    // Si falla el servidor, igual removemos de local
    removeEnrolledFace(dni);
    return {
      success: false,
      error: `Error de conexión: ${err.message}. Se removió localmente.`,
    };
  }
}
