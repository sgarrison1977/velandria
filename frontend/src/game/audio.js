let ctx = null, master = null;
const cfg = JSON.parse(localStorage.getItem("sx_audio") || '{"vol":0.6,"muted":false}');
export const audioCfg = () => ({ ...cfg });
export function setAudio(p) { Object.assign(cfg, p); localStorage.setItem("sx_audio", JSON.stringify(cfg)); if (master) master.gain.value = cfg.muted ? 0 : cfg.vol; }
function ac() {
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); master = ctx.createGain(); master.gain.value = cfg.muted ? 0 : cfg.vol; master.connect(ctx.destination); }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
let noiseBuf = null;
const noise = (c) => { if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const s = c.createBufferSource(); s.buffer = noiseBuf; return s; };
function env(c, node, t0, a, d, peak) { const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); node.connect(g); g.connect(master); return g; }
function nz(c, t, dur, type, f0, f1, peak, q = 1) { const s = noise(c), f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); s.connect(f); env(c, f, t, 0.005, dur, peak); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); }
function tone(c, t, dur, type, f0, f1, peak) { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); env(c, o, t, 0.01, dur, peak); o.start(t); o.stop(t + dur + 0.05); }
const SOUNDS = {
  step: (c, t) => nz(c, t, 0.07, "lowpass", 600 + Math.random() * 200, 200, 0.12),
  swing: (c, t) => nz(c, t, 0.18, "bandpass", 900, 3000, 0.25, 2),
  bow: (c, t) => { tone(c, t, 0.12, "triangle", 220, 110, 0.2); nz(c, t, 0.15, "highpass", 2000, 5000, 0.08); },
  zap: (c, t) => { tone(c, t, 0.25, "sawtooth", 880, 220, 0.08); tone(c, t, 0.3, "sine", 1200, 600, 0.1); },
  hit: (c, t) => { nz(c, t, 0.09, "lowpass", 2500, 400, 0.35); tone(c, t, 0.1, "sine", 160, 60, 0.3); },
  crit: (c, t) => { nz(c, t, 0.14, "lowpass", 4000, 300, 0.45); tone(c, t, 0.18, "square", 220, 55, 0.18); },
  hurt: (c, t) => { tone(c, t, 0.2, "sawtooth", 200, 90, 0.18); nz(c, t, 0.1, "lowpass", 1200, 300, 0.2); },
  heavy: (c, t) => { nz(c, t, 0.3, "lowpass", 1800, 100, 0.5); tone(c, t, 0.3, "sine", 120, 40, 0.4); },
  spell: (c, t) => { tone(c, t, 0.4, "sine", 300, 1200, 0.12); tone(c, t + 0.05, 0.35, "triangle", 600, 1800, 0.06); },
  heal: (c, t) => [523, 659, 784].forEach((f, i) => tone(c, t + i * 0.08, 0.4, "sine", f, f * 1.01, 0.1)),
  mdeath: (c, t) => { tone(c, t, 0.5, "sawtooth", 320, 60, 0.12); nz(c, t, 0.4, "lowpass", 800, 100, 0.15); },
  death: (c, t) => [392, 330, 262, 196].forEach((f, i) => tone(c, t + i * 0.18, 0.5, "triangle", f, f * 0.98, 0.15)),
  loot: (c, t) => { tone(c, t, 0.12, "sine", 880, 880, 0.12); tone(c, t + 0.08, 0.2, "sine", 1320, 1320, 0.1); },
  coin: (c, t) => { tone(c, t, 0.1, "square", 1800, 1800, 0.05); tone(c, t + 0.06, 0.18, "square", 2400, 2400, 0.04); },
  levelup: (c, t) => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, t + i * 0.1, 0.6, "triangle", f, f, 0.12)),
  click: (c, t) => tone(c, t, 0.04, "square", 1400, 900, 0.04),
  error: (c, t) => tone(c, t, 0.18, "square", 140, 120, 0.07),
  open: (c, t) => nz(c, t, 0.12, "bandpass", 500, 1500, 0.1, 3),
};
// recorded-style clips in /public/sfx; variants picked at random, synth fallback while loading
const CLIPS = { step: ["step1", "step2", "step3"], swing: ["swing1", "swing2"], hit: ["hit1", "hit2"] };
const GAIN = { step: 0.35, click: 0.5, open: 0.6, loot: 0.7, swing: 0.8, levelup: 0.9, growl_beast: 0.7, growl_undead: 0.7, roar: 0.8, error: 0.6 };
const FILES = ["step1", "step2", "step3", "swing1", "swing2", "hit1", "hit2", "crit", "heavy", "bow", "hurt", "mdeath", "death", "heal", "arcane", "fire", "frost",
  "poison", "portal", "zap", "buff", "loot", "coin", "levelup", "click", "error", "open", "growl_beast", "growl_undead", "roar", "dash"];
const bufs = {};
let loading = false;
function loadClips(c) {
  if (loading) return; loading = true;
  for (const f of FILES) fetch(`/sfx/${f}.mp3`).then((r) => r.arrayBuffer()).then((a) => c.decodeAudioData(a)).then((b) => { bufs[f] = b; }).catch(() => {});
}
const lastPlay = {};
export function sfx(name) {
  if (cfg.muted) return;
  const c = ac(); if (!c) return;
  loadClips(c);
  const opts = CLIPS[name] || [name], file = opts[Math.floor(Math.random() * opts.length)], b = bufs[file];
  if (b) {
    const now = c.currentTime;
    if (now - (lastPlay[name] || 0) < 0.045) return;
    lastPlay[name] = now;
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = b; src.playbackRate.value = 0.94 + Math.random() * 0.12; g.gain.value = GAIN[name] ?? 1;
    src.connect(g); g.connect(master); src.start(now + 0.005);
    return;
  }
  if (!SOUNDS[name]) return;
  try { SOUNDS[name](c, c.currentTime + 0.01); } catch (e) { /* ignore */ }
}
sfx.unlock = () => { const c = ac(); if (c) loadClips(c); };
