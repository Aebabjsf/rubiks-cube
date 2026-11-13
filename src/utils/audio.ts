import { useAuthStore } from '../store/authStore';

let audioCtx: AudioContext | null = null;

/**
 * Инициализация и безопасное возобновление AudioContext
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

// Автоматическая разблокировка AudioContext при первом взаимодействии пользователя
if (typeof window !== 'undefined') {
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

/**
 * Проверка, включен ли звук в настройках пользователя
 */
function isSoundEnabled(): boolean {
  try {
    const user = useAuthStore.getState().user;
    if (user && user.settings) {
      return user.settings.sound_enabled ?? true;
    }
    // Если пользователь не вошел, проверяем локальный флаг
    const localSetting = localStorage.getItem('cube-sound-enabled');
    if (localSetting !== null) {
      return localSetting === 'true';
    }
    return true; // По умолчанию включен
  } catch {
    return true;
  }
}

/**
 * Синтезирует реалистичный механический звук щелчка пластика и магнитов кубика Рубика
 */
export function playCubeClick() {
  if (!isSoundEnabled()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // Легкая вариация высоты звука для естественного ощущения механики
    const jitter = 0.92 + Math.random() * 0.16;

    // 1. Удар магнитов и крестовины (низкий глухой тон)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260 * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.035);

    oscGain.gain.setValueAtTime(0.35, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);

    // 2. Хруст/трение пластиковых граней (короткий шум через полосовой фильтр)
    const bufferSize = Math.floor(ctx.sampleRate * 0.022); // 22 мс
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2300 * jitter, now);
    filter.Q.setValueAtTime(2.5, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.28, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.025);
  } catch {
    // Игнорируем ошибки аудиоконтекста
  }
}

/**
 * Звук победы при успешной сборке головоломки
 */
export function playVictorySound() {
  if (!isSoundEnabled()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // Аккорд C-E-G-C
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    });
  } catch {
    // Игнорируем ошибки аудиоконтекста
  }
}
