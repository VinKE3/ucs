/**
 * Generador de Huella Digital de Hardware y Entorno (Client-Side).
 * Produce una firma determinista de 64 caracteres SHA-256 basada en características
 * físicas inmutables del dispositivo (GPU, pantalla, subpíxeles de renderizado, CPU, audio).
 *
 * Esta huella NO cambia si el usuario borra las cookies o el historial del navegador.
 */

export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    return 'fp_server_side';
  }

  try {
    const components: string[] = [];

    // 1. Arquitectura de Pantalla y Píxeles Físicos
    components.push(`screen:${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`);
    components.push(`dpr:${window.devicePixelRatio || 1}`);

    // 2. Hardware y Concurrencia de CPU
    components.push(`cores:${navigator.hardwareConcurrency || 2}`);
    if ('deviceMemory' in navigator) {
      components.push(`ram:${(navigator as any).deviceMemory}`);
    }
    if ('maxTouchPoints' in navigator) {
      components.push(`touch:${navigator.maxTouchPoints || 0}`);
    }

    // 3. Sistema Operativo y Zona Horaria
    components.push(`platform:${navigator.platform || 'unknown'}`);
    try {
      components.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    } catch {
      components.push('tz:America/Lima');
    }

    // 4. Huella WebGL (GPU Renderer Físico y Vendedor)
    try {
      const canvas = document.createElement('canvas');
      const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
          components.push(`gpu:${vendor}~${renderer}`);
        } else {
          components.push(`gpu:${gl.getParameter(gl.VENDOR)}~${gl.getParameter(gl.RENDERER)}`);
        }
      }
    } catch {
      components.push('gpu:unavailable');
    }

    // 5. Huella Canvas 2D (Rasterizado Subpíxel y Suavizado de Fuentes dependiente de DirectX/GPU)
    try {
      const canvas2d = document.createElement('canvas');
      canvas2d.width = 240;
      canvas2d.height = 60;
      const ctx = canvas2d.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial, sans-serif';
        ctx.fillStyle = '#ff5a00';
        ctx.fillRect(10, 10, 60, 30);
        ctx.fillStyle = '#06152d';
        ctx.fillText('UCSur Simulación 2026 🫀', 15, 15);
        ctx.strokeStyle = '#38bdf8';
        ctx.arc(100, 30, 20, 0, Math.PI * 2);
        ctx.stroke();
        components.push(`canvas:${canvas2d.toDataURL().slice(-50)}`);
      }
    } catch {
      components.push('canvas:unavailable');
    }

    // 6. Huella de Procesamiento de Audio (DSP / Floating-point math del procesador de audio)
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const oscillator = audioCtx.createOscillator();
        const analyser = audioCtx.createAnalyser();
        const gain = audioCtx.createGain();
        gain.gain.value = 0; // Silencio total para no emitir sonido
        oscillator.type = 'triangle';
        oscillator.connect(analyser);
        analyser.connect(gain);
        gain.connect(audioCtx.destination);
        components.push(`audio:${audioCtx.sampleRate}~${analyser.fftSize}`);
        audioCtx.close().catch(() => {});
      }
    } catch {
      components.push('audio:unavailable');
    }

    // Concatenar todos los componentes y calcular hash SHA-256 nativo
    const rawSignature = components.join('|');
    const msgBuffer = new TextEncoder().encode(rawSignature);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return `fp_${hashHex}`;
  } catch (err) {
    console.error('Error calculando huella de hardware:', err);
    return 'fp_fallback_hash';
  }
}

