// ---------- Audio (synthesized, no external files) ----------
let audioCtx = null;
let masterGain = null;
let muted = false;
let bgmHandle = null;

function ensureAudio() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audioCtx = new AC();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = muted ? 0 : 0.5;
  masterGain.connect(audioCtx.destination);
  startBGM();
}

function toggleMute() {
  ensureAudio();
  muted = !muted;
  if (masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : 0.5, audioCtx.currentTime, 0.05);
  const btn = document.getElementById('muteBtn');
  if (btn) btn.textContent = muted ? '🔇' : '🔊';
}

function tone(freq, dur, opts = {}) {
  if (!audioCtx) return;
  const { type = 'sine', vol = 0.22, delay = 0, sweepTo = null } = opts;
  const t0 = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur, opts = {}) {
  if (!audioCtx) return;
  const { vol = 0.2, delay = 0 } = opts;
  const t0 = audioCtx.currentTime + delay;
  const size = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
  const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(gain);
  gain.connect(masterGain);
  src.start(t0);
}

// notes: [[freq, dur, gapAfter], ...] played back to back starting now
function melody(notes, opts = {}) {
  let t = 0;
  notes.forEach(([freq, dur, gap = 0.02]) => {
    tone(freq, dur, { ...opts, delay: t });
    t += dur + gap;
  });
  return t;
}

const SFX = {
  click: () => tone(600, 0.045, { type: 'square', vol: 0.1 }),
  dice: () => { noiseBurst(0.12, { vol: 0.12 }); tone(180, 0.06, { type: 'square', vol: 0.08, delay: 0.05 }); },
  doubleDing: () => melody([[1200, 0.05], [1600, 0.08]], { type: 'sine', vol: 0.15 }),
  buy: () => melody([[523, 0.07], [784, 0.13]], { type: 'triangle', vol: 0.22 }),
  build: () => melody([[440, 0.06], [660, 0.06], [880, 0.12]], { type: 'triangle', vol: 0.2 }),
  pay: () => melody([[380, 0.09], [280, 0.16]], { type: 'sawtooth', vol: 0.16 }),
  tax: () => melody([[300, 0.08], [220, 0.1], [180, 0.16]], { type: 'sawtooth', vol: 0.15 }),
  gain: () => melody([[660, 0.06], [880, 0.06], [1108, 0.1]], { type: 'sine', vol: 0.18 }),
  card: () => melody([[880, 0.05], [1108, 0.05], [1318, 0.05], [1568, 0.1]], { type: 'sine', vol: 0.18 }),
  casinoSpin: () => noiseBurst(0.4, { vol: 0.08 }),
  casinoWin: () => melody([[523, 0.07], [659, 0.07], [784, 0.07], [1047, 0.2]], { type: 'square', vol: 0.22 }),
  casinoLose: () => tone(220, 0.32, { type: 'sawtooth', vol: 0.18, sweepTo: 90 }),
  monopoly: () => melody([[523, 0.09], [659, 0.09], [784, 0.09], [1047, 0.09], [1318, 0.22]], { type: 'triangle', vol: 0.24 }),
  landmark: () => melody([[392, 0.1], [523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.1], [1318, 0.28]], { type: 'triangle', vol: 0.26 }),
  warp: () => tone(200, 0.35, { type: 'sine', vol: 0.16, sweepTo: 1400 }),
  jail: () => tone(140, 0.3, { type: 'square', vol: 0.16, sweepTo: 70 }),
  bankrupt: () => melody([[300, 0.18], [220, 0.18], [140, 0.4]], { type: 'sawtooth', vol: 0.22 }),
  win: () => melody([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.12], [1318, 0.12], [1568, 0.4]], { type: 'triangle', vol: 0.26 }),
};

const BGM_NOTES = [
  [220, 0.42], [261.6, 0.42], [329.6, 0.42], [440, 0.42],
  [392, 0.42], [329.6, 0.42], [261.6, 0.42], [246.9, 0.6],
];
function startBGM() {
  if (bgmHandle) return;
  const loop = () => {
    const dur = melody(BGM_NOTES, { type: 'triangle', vol: 0.05 });
    bgmHandle = setTimeout(loop, dur * 1000 + 400);
  };
  loop();
}
