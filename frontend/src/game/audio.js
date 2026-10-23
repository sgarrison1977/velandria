let ctx = null, master = null;
const cfg = { music: 0.35, ...JSON.parse(localStorage.getItem("sx_audio") || '{"vol":0.6,"muted":false}') };
export const audioCfg = () => ({ ...cfg });
export function setAudio(p) { Object.assign(cfg, p); localStorage.setItem("sx_audio", JSON.stringify(cfg)); if (master) master.gain.value = cfg.muted ? 0 : cfg.vol; music.refresh(); }

// background music: one looping <audio> per track, crossfaded
const tracks = {};
let current = null, fadeId = null;
const musicVol = () => (cfg.muted ? 0 : cfg.music * cfg.vol);
export const music = {
  play(name) {
    if (current === name) {
      const a = tracks[name], n = performance.now();
      if (a && a.paused && musicVol() > 0 && n - (this.retry || 0) > 1000) { this.retry = n; a.play().catch(() => {}); }
      return;
    }
    current = name;
    if (!tracks[name]) { const a = new Audio(`/music/${name}.mp3`); a.loop = true; a.volume = 0; a.preload = "auto"; tracks[name] = a; }
    tracks[name].play().catch(() => {});
    clearInterval(fadeId);
    fadeId = setInterval(() => {
      let done = true;
      for (const [k, a] of Object.entries(tracks)) {
        const target = k === current ? musicVol() : 0, v = a.volume + Math.sign(target - a.volume) * Math.min(0.02, Math.abs(target - a.volume));
        a.volume = Math.max(0, Math.min(1, v));
        if (Math.abs(a.volume - target) > 0.001) done = false; else if (target === 0 && !a.paused) a.pause();
      }
      if (done) clearInterval(fadeId);
    }, 60);
  },
  refresh() { if (current && tracks[current]) tracks[current].volume = musicVol(); },
  stop() { current = null; for (const a of Object.values(tracks)) { a.pause(); } },
};
// positional ambience loops (e.g. surf near beaches); level 0..1 eased per frame
const amb = {};
export const ambient = {
  set(name, level) {
    let a = amb[name];
    if (!a) { if (level <= 0) return; a = amb[name] = { el: new Audio(`/sfx/${name}.mp3`), v: 0 }; a.el.loop = true; a.el.volume = 0; }
    const target = cfg.muted ? 0 : level * cfg.vol * 0.55;
    a.v += (target - a.v) * 0.04;
    a.el.volume = Math.max(0, Math.min(1, a.v));
    if (a.v > 0.003 && a.el.paused) { const n = performance.now(); if (n - (a.retry || 0) > 1500) { a.retry = n; a.el.play().catch(() => {}); } }
    else if (a.v <= 0.003 && !a.el.paused) a.el.pause();
  },
  stop() { for (const a of Object.values(amb)) { a.el.pause(); a.v = 0; } },
};
let hum = null;
export function portalHum(level) {
  if (!hum) {
    if (level <= 0.001) return;
    const c = ac(); if (!c) return;
    const g = c.createGain(); g.gain.value = 0; const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520; lp.Q.value = 2;
    for (const [f, type, v] of [[55, "sine", 0.6], [82.6, "sine", 0.35], [110.4, "triangle", 0.18], [164.5, "sine", 0.08]]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f; const og = c.createGain(); og.gain.value = v; o.connect(og); og.connect(lp); o.start();
    }
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.35; lg.gain.value = 140; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    lp.connect(g); g.connect(master); hum = { g, c };
  }
  hum.g.gain.setTargetAtTime(cfg.muted ? 0 : Math.max(0, Math.min(1, level)) * 0.16, hum.c.currentTime, 0.25);
}
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
const CLIPS = { beam: ["beam1", "beam3"], step: ["step1", "step2", "step3"], swing: ["swing1", "swing2"], hit: ["hit1", "hit2"] };
const GAIN = { beam: 0.9, legendary: 0.9, step: 0.35, click: 0.5, open: 0.6, loot: 0.7, swing: 0.8, levelup: 0.9, growl_beast: 0.7, growl_undead: 0.7, roar: 0.8, error: 0.6 };
const FILES = ["step1", "step2", "step3", "swing1", "swing2", "hit1", "hit2", "crit", "heavy", "bow", "hurt", "mdeath", "death", "heal", "arcane", "fire", "frost",
  "poison", "portal", "zap", "buff", "loot", "coin", "levelup", "click", "error", "open", "growl_beast", "growl_undead", "roar", "dash", "moonbeam", "legendary", "beam1.wav", "beam3.wav", "rot.wav", "impdie.wav", "impgrr.wav", "imphit.wav", "angel.wav", "Spell4.wav", "Dstar.wav", "attwind.wav", "electric.wav"];
const bufs = {};
let loading = false;
function loadClips(c) {
  if (loading) return; loading = true;
  for (const f of FILES) fetch(`/sfx/${f.includes(".") ? f : f + ".mp3"}`).then((r) => r.arrayBuffer()).then((a) => c.decodeAudioData(a)).then((b) => { bufs[f.split(".")[0]] = b; }).catch(() => {});
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
