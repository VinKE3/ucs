import { describe, it, expect, beforeEach } from 'vitest';
import {
  euclideanDistance,
  computeCentroid,
  extractAllDescriptors,
  calculateEAR,
  evaluateFaceQuality,
  findMatchingUser,
  findDuplicateEnrolledFace,
  saveEnrolledFace,
  removeEnrolledFace,
  getEnrolledFaces,
} from '@/lib/faceBiometricService';

function makeVector(seed: number, offset = 0): number[] {
  return Array.from({ length: 128 }, (_, i) => Number((Math.sin(seed * 13 + i * 0.37) * 0.1 + offset).toFixed(5)));
}

function perturbVector(base: number[], delta: number): number[] {
  // Perturbación uniforme cuya distancia euclidiana total es ~ delta * sqrt(128)
  const step = delta / Math.sqrt(128);
  return base.map((v, i) => v + (i % 2 === 0 ? step : -step));
}

describe('faceBiometricService - Motor Biométrico', () => {
  beforeEach(() => {
    // Limpiar caché en memoria (simulando navegador mínimo)
    const store = new Map<string, string>();
    (globalThis as any).window = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    };
    for (const f of [...getEnrolledFaces()]) {
      removeEnrolledFace(f.dni);
    }
  });

  it('calcula distancia euclidiana exacta y devuelve 0 para vectores idénticos', () => {
    const v1 = makeVector(1);
    expect(euclideanDistance(v1, v1)).toBe(0);
    expect(euclideanDistance([0, 0, 0], [3, 4, 0])).toBe(5);
    expect(euclideanDistance([1, 2], [1])).toBe(1.0); // longitudes distintas
  });

  it('calcula el centroide geométrico exacto sin distorsionar la escala nativa', () => {
    const v1 = Array(128).fill(0.2);
    const v2 = Array(128).fill(0.4);
    const centroid = computeCentroid([v1, v2]);
    expect(centroid).toHaveLength(128);
    expect(centroid[0]).toBeCloseTo(0.3, 6);
    expect(centroid[127]).toBeCloseTo(0.3, 6);
  });

  it('extrae descriptores tanto de plantillas v1 (legacy) como v2 (multi-ángulo)', () => {
    const v1 = makeVector(1);
    const v2 = makeVector(2);
    const c = computeCentroid([v1, v2]);

    const legacy = extractAllDescriptors({
      dni: '11111111',
      nombre: 'Legacy User',
      descriptor: v1,
      enrolledAt: new Date().toISOString(),
    });
    expect(legacy).toHaveLength(1);

    const multi = extractAllDescriptors({
      dni: '22222222',
      nombre: 'Multi User',
      descriptor: { version: 2, mode: 'multi_angle', descriptors: [v1, v2], centroid: c },
      enrolledAt: new Date().toISOString(),
    });
    expect(multi).toHaveLength(3);
  });

  it('calcula EAR correctamente diferenciando ojos abiertos vs parpadeo', () => {
    const openEye = [
      { x: 0, y: 0 },
      { x: 3, y: 3 },
      { x: 7, y: 3 },
      { x: 10, y: 0 },
      { x: 7, y: -3 },
      { x: 3, y: -3 },
    ];
    const closedEye = [
      { x: 0, y: 0 },
      { x: 3, y: 0.5 },
      { x: 7, y: 0.5 },
      { x: 10, y: 0 },
      { x: 7, y: -0.5 },
      { x: 3, y: -0.5 },
    ];
    expect(calculateEAR(openEye)).toBeGreaterThan(0.3);
    expect(calculateEAR(closedEye)).toBeLessThan(0.15);
  });

  it('evalúa calidad de rostro: lejos, cerca, descentrado, poca luz, óptimo y ángulos laterales', () => {
    // Demasiado lejos (boxRatio < 0.28)
    expect(evaluateFaceQuality({ x: 280, y: 200, width: 80, height: 90 }, 640, 480).status).toBe('too_far');
    // Demasiado cerca (boxRatio > 0.84)
    expect(evaluateFaceQuality({ x: 100, y: 10, width: 420, height: 430 }, 640, 480).status).toBe('too_close');
    // Descentrado frontal (offsetNormX ~ -0.35)
    expect(evaluateFaceQuality({ x: 10, y: 120, width: 180, height: 220 }, 640, 480).status).toBe('off_center');
    // Poca luz
    expect(
      evaluateFaceQuality({ x: 220, y: 120, width: 200, height: 220 }, 640, 480, { brightness: 25 }).status
    ).toBe('too_dark');
    // Óptimo frontal
    const opt = evaluateFaceQuality({ x: 220, y: 120, width: 200, height: 220 }, 640, 480, { brightness: 130 });
    expect(opt.isOptimal).toBe(true);
    expect(opt.status).toBe('optimal');
    // Giro lateral permitido en ángulo izquierda/derecha (offsetNormX ~ 0.26)
    const side = evaluateFaceQuality({ x: 390, y: 120, width: 190, height: 200 }, 640, 480, {
      angle: 'derecha',
      brightness: 120,
    });
    expect(side.isOptimal).toBe(true);
  });

  it('identifica correctamente un usuario y rechaza coincidencias ambiguas Top-1 vs Top-2', () => {
    const aliceVec = makeVector(10, 0);
    const bobVec = makeVector(99, 0.25);

    saveEnrolledFace({
      dni: '10000001',
      nombre: 'Alice Perez',
      descriptor: { version: 2, descriptors: [aliceVec], centroid: aliceVec },
      enrolledAt: new Date().toISOString(),
    });
    saveEnrolledFace({
      dni: '20000002',
      nombre: 'Bob Ramos',
      descriptor: { version: 2, descriptors: [bobVec], centroid: bobVec },
      enrolledAt: new Date().toISOString(),
    });

    // Match limpio con Alice (distancia ~0.25)
    const liveAlice = perturbVector(aliceVec, 0.25);
    const res = findMatchingUser(liveAlice);
    expect(res.matched).toBe(true);
    expect(res.user?.dni).toBe('10000001');

    // Caso ambiguo: gemelo/muy parecido a distancia ~0.43 vs 0.45 (margen < 0.055)
    const base = makeVector(50);
    const twinA = perturbVector(base, 0.43);
    const twinB = perturbVector(base, 0.45);
    saveEnrolledFace({ dni: '30000003', nombre: 'Gemelo A', descriptor: twinA, enrolledAt: new Date().toISOString() });
    saveEnrolledFace({ dni: '40000004', nombre: 'Gemelo B', descriptor: twinB, enrolledAt: new Date().toISOString() });

    const ambiguousRes = findMatchingUser(base);
    expect(ambiguousRes.matched).toBe(false);
    expect(ambiguousRes.ambiguous).toBe(true);
  });

  it('detecta rostro duplicado cuando se intenta enrolar el mismo rostro bajo otro DNI', () => {
    const vec = makeVector(7);
    saveEnrolledFace({
      dni: '72481923',
      nombre: 'Carlos Mendoza',
      descriptor: vec,
      enrolledAt: new Date().toISOString(),
    });

    // Mismo DNI -> NO es duplicado (es actualización propia)
    expect(findDuplicateEnrolledFace(perturbVector(vec, 0.15), '72481923').isDuplicate).toBe(false);

    // Otro DNI con el mismo rostro -> SÍ es duplicado
    const dup = findDuplicateEnrolledFace(perturbVector(vec, 0.15), '99999999');
    expect(dup.isDuplicate).toBe(true);
    expect(dup.existingUser?.dni).toBe('72481923');
  });
});
