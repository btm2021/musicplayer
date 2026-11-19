/* ============================================================
 *  Vibe visualizer — 8 chill "bar / lounge / club" scenes
 *  Data source: an AnalyserNode (local file / mic) or a musical simulation
 *  (YouTube / SoundCloud iframes can't be read by the browser).
 * ============================================================ */
const TAU = Math.PI * 2;
const gauss = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const SCENES = [
  { id: 'none', name: 'Không', icon: '⬛' },
  { id: 'lounge', name: 'Lounge', icon: '🕯️' },
  { id: 'vinyl', name: 'Vinyl', icon: '💿' },
  { id: 'fireplace', name: 'Fireplace', icon: '🔥' },
  { id: 'neon', name: 'Neon Bar', icon: '🍸' },
  { id: 'cocktail', name: 'Cocktail', icon: '🥃' },
  { id: 'rain', name: 'Rainy Window', icon: '🌧️' },
  { id: 'ocean', name: 'Moonlit Sea', icon: '🌊' },
  { id: 'aurora', name: 'Aurora', icon: '🌌' },
  { id: 'fireflies', name: 'Fireflies', icon: '✨' },
  { id: 'skyline', name: 'Night City', icon: '🏙️' },
  { id: 'synthwave', name: 'Synthwave', icon: '🌅' },
  { id: 'lavalamp', name: 'Lava Lamp', icon: '🫧' },
  { id: 'galaxy', name: 'Galaxy', icon: '🌀' },
  { id: 'tunnel', name: 'Warp Tunnel', icon: '🚀' },
  { id: 'kaleido', name: 'Kaleidoscope', icon: '🔮' },
  { id: 'disco', name: 'Disco Ball', icon: '🪩' },
  { id: 'lasers', name: 'Club Lasers', icon: '🔺' },
  { id: 'ledwall', name: 'LED Wall', icon: '🟩' },
];
const SPECTRA = [
  { id: 'off', name: 'Không', group: 'Cơ bản' },
  { id: 'bars', name: 'Bars', group: 'Cơ bản' },
  { id: 'mirror', name: 'Mirror', group: 'Cơ bản' },
  { id: 'blocks', name: 'LED Blocks', group: 'Cơ bản' },
  { id: 'mountain', name: 'Mountain', group: 'Cơ bản' },
  { id: 'line', name: 'Oscilloscope', group: 'Cơ bản' },
  { id: 'ribbon', name: 'Ribbon', group: 'Cơ bản' },
  { id: 'circle', name: 'Circle', group: 'Cơ bản' },
  { id: 'blob', name: 'Blob', group: 'Cơ bản' },
  { id: 'dots', name: 'Dots', group: 'Cơ bản' },
  { id: 'sides', name: 'Sides', group: 'Cơ bản' },
  { id: 'arc', name: 'Arc', group: 'Cơ bản' },
  { id: 'sparks', name: 'Sparks', group: 'Cơ bản' },
  { id: 'clubtunnel', name: 'Neon Tunnel', group: 'Club' },
  { id: 'ledfloor', name: 'LED Floor', group: 'Club' },
  { id: 'tubes', name: 'LED Tubes', group: 'Club' },
  { id: 'portal', name: 'Neon Portal', group: 'Club' },
  { id: 'biotunnel', name: 'Chrome Tunnel', group: 'VJ Tunnel' },
  { id: 'hexworm', name: 'Hex Wormhole', group: 'VJ Tunnel' },
  { id: 'mandala', name: 'Mandala Zoom', group: 'VJ Tunnel' },
  { id: 'vortex', name: 'Spiral Vortex', group: 'VJ Tunnel' },
  { id: 'cyberrings', name: 'Cyber Rings', group: 'VJ Tunnel' },
  { id: 'wiretube', name: 'Wire Tunnel', group: 'VJ Tunnel' },
];
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360; s /= 100; l /= 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
function rrect(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h);
}
const THEMES = [
  { id: 'sunset', name: 'Sunset' }, { id: 'warm', name: 'Whiskey' }, { id: 'neon', name: 'Neon' },
  { id: 'ocean', name: 'Ocean' }, { id: 'forest', name: 'Forest' }, { id: 'toxic', name: 'Toxic' }, { id: 'mono', name: 'Mono' },
];

class Visualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.scene = 'lounge';
    this.theme = 'sunset';
    this.sens = 1;
    this.overlay = false;           // video mode: draw on black, canvas is screen-blended over the video

    this.binCount = 1024;
    this.sampleRate = 48000;
    this.freq = new Uint8Array(this.binCount);
    this.wave = new Uint8Array(2048).fill(128);
    this.analyser = null;

    this.playing = false;
    this.simLevel = 0; this.simT = 0; this.seed = 0.37; this.bpm = 96; this.intens = 0.7;

    this.t = 0; this.last = performance.now();
    this.bass = 0; this.mid = 0; this.treble = 0; this.energy = 0;
    this.beat = 0; this.beatCount = 0; this.bassAvg = 0.2; this.lastBeat = 0; this.hue = 0;

    this.progress = 0;
    this.track = { title: '', artist: '', img: null };
    this.S = {};
    this.sp = new Map();
    this._edges = {}; this._bb = {};
    this.autoMode = 'off';          // off | seq | rand
    this.autoEvery = 60;            // seconds; 0 = change on every new track
    this.pool = null;               // scene ids in the rotation (null = all)
    this._bag = []; this.autoT = 0;
    this.xf = 0; this.snap = null;  // crossfade
    this.fx = { bloom: true, grain: true };
    this.grainPat = null;
    this.spec = { style: 'bars', size: 1 };   // foreground spectrum layer
    this.bgDim = 0.15;                        // darken the background scene under the spectrum
    this.strobe = 0.35;                       // 0 off · 0.35 soft · 1 hard
    this.prevTheme = null; this.themeMix = 1;  // smooth palette transitions
    this._sm = {}; this._pk = {}; this.specS = { rot: 0, art: 0, sparks: [] };

    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  /* ---------------- setup ---------------- */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setAnalyser(a) {
    this.analyser = a;
    this.sampleRate = a ? a.context.sampleRate : 48000;
    this._edges = {};
  }
  setPlaying(b) { this.playing = b; }
  setTrackSeed(str) {
    let h = 2166136261;
    for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    this.seed = ((h >>> 0) % 10000) / 10000;
    this.bpm = 78 + Math.floor(this.seed * 46);       // 78–124 bpm, chill range
    this.simT = 0;
  }
  setTrack({ title = '', artist = '', thumb = null } = {}) {
    this.track.title = title; this.track.artist = artist;
    if (thumb && thumb !== this.track.src) {
      this.track.src = thumb;
      const img = new Image();
      img.onload = () => { if (this.track.src === thumb) this.track.img = img; };
      img.src = thumb;
    } else if (!thumb) { this.track.src = null; this.track.img = null; }
  }
  setScene(id, animate = true) {
    if (!SCENES.some((s) => s.id === id)) id = 'lounge';
    this.autoT = 0;
    if (id === this.scene) return;
    if (animate) {
      const c = this.canvas;
      if (!this.snap) this.snap = document.createElement('canvas');
      this.snap.width = c.width; this.snap.height = c.height;
      this.snap.getContext('2d').drawImage(c, 0, 0);
      this.xf = 1;
    }
    this.scene = id;
  }
  setPool(ids) { this.pool = ids; this._bag = []; }
  pickNext(dir = 1) {
    const all = SCENES.map((s) => s.id).filter((id) => id !== 'none');
    const pool = (this.pool && this.pool.length ? this.pool : all).filter((id) => all.includes(id));
    if (!pool.length) return this.scene;
    if (this.autoMode === 'rand' && dir === 1) {
      if (!this._bag.length) this._bag = pool.filter((id) => id !== this.scene).sort(() => Math.random() - 0.5);
      return this._bag.pop() || pool[0];
    }
    const i = pool.indexOf(this.scene);
    return pool[(i + dir + pool.length) % pool.length];
  }
  autoNext() {
    const id = this.pickNext();
    if (id !== this.scene) { this.setScene(id); this.onAutoScene && this.onAutoScene(id); }
  }
  trackChanged() { if (this.autoMode !== 'off' && this.autoEvery === 0) this.autoNext(); }

  /* ---------------- data ---------------- */
  simulate(dt) {
    this.simLevel += ((this.playing ? 1 : 0) - this.simLevel) * Math.min(1, dt * (this.playing ? 1.5 : 3));
    if (this.playing) this.simT += dt;
    const L = this.simLevel, sd = this.seed * 100;
    const tb = this.simT * this.bpm / 60, bi = Math.floor(tb), ph = tb - bi;
    const bar = Math.floor(bi / 4), sec = Math.floor(bi / 16);
    const sh = hash(sec * 7.3 + sd);
    const ti = sh < 0.2 ? 0.35 : sh < 0.5 ? 0.65 : sh < 0.8 ? 0.85 : 1;   // song sections: break / verse / build / drop
    this.intens += (ti - this.intens) * Math.min(1, dt * 0.8);
    const I = this.intens;
    const kick = (I > 0.45 ? 1 : 0.25) * Math.exp(-ph * 9);
    const snare = (bi % 2 === 1 ? Math.exp(-ph * 11) : 0) * (I > 0.5 ? 1 : 0.4);
    const hat = Math.exp(-((tb * 2) % 1) * 18) * (0.4 + I * 0.6);
    const bassC = 0.27 + hash(bar * 3.1 + sd) * 0.1;
    const step = Math.floor(tb * 2), sp = (tb * 2) % 1;
    const mel = hash(step * 1.7 + sd * 9) > 0.35 ? Math.exp(-sp * 3) : 0;
    const melC = 0.5 + hash(step * 5.9 + sd * 3) * 0.25;
    const t = this.simT, n = this.binCount, logN = Math.log(n);
    for (let i = 0; i < n; i++) {
      const f = Math.log(i + 1) / logN;
      let v = 70 * Math.pow(1 - f, 0.7) * (0.75 + 0.25 * Math.sin(t * 0.6 + f * 9))
        + 230 * kick * gauss(f, 0.22, 0.06)
        + 170 * (0.6 + 0.4 * Math.exp(-ph * 2)) * gauss(f, bassC, 0.025) * (I > 0.3 ? 1 : 0.5)
        + 110 * snare * gauss(f, 0.62, 0.14)
        + 90 * hat * gauss(f, 0.88, 0.05)
        + mel * (150 * gauss(f, melC, 0.018) + 70 * gauss(f, melC + 0.1, 0.012) + 40 * gauss(f, melC + 0.16, 0.01))
        + Math.random() * 22 * (1 - f * 0.5);
      v *= L * (0.55 + 0.45 * I) * (f > 0.96 ? 0.3 : 1);
      this.freq[i] = this.freq[i] * 0.5 + Math.min(255, v) * 0.5;
    }
    const W = this.wave.length;
    for (let i = 0; i < W; i++) {
      const x = i / W;
      const s = kick * 0.5 * Math.sin(x * TAU * 3 + t * 2)
        + 0.22 * Math.sin(x * TAU * (14 + bassC * 20)) * (0.6 + 0.4 * I)
        + mel * 0.15 * Math.sin(x * TAU * 90)
        + hat * 0.12 * (Math.random() - 0.5);
      this.wave[i] = 128 + Math.max(-127, Math.min(127, s * L * 127));
    }
  }

  binOf(hz) { return Math.min(this.binCount - 1, Math.max(0, Math.round(hz / (this.sampleRate / 2) * this.binCount))); }
  avgRange(lo, hi) {
    const a = this.binOf(lo), b = Math.max(a + 1, this.binOf(hi));
    let s = 0;
    for (let i = a; i < b; i++) s += this.freq[i];
    return s / (b - a) / 255;
  }
  edges(n) {
    if (this._edges[n]) return this._edges[n];
    const fmin = 32, fmax = Math.min(16000, this.sampleRate / 2), e = new Int32Array(n + 1);
    for (let k = 0; k <= n; k++) {
      e[k] = this.binOf(fmin * Math.pow(fmax / fmin, k / n));
      if (k > 0 && e[k] <= e[k - 1]) e[k] = e[k - 1] + 1;
    }
    return (this._edges[n] = e);
  }
  /** n log-spaced bands, 0..1 */
  bands(n) {
    const e = this.edges(n);
    const out = this._bb[n] || (this._bb[n] = new Float32Array(n));
    for (let k = 0; k < n; k++) {
      let m = 0;
      const end = Math.min(e[k + 1], this.binCount);
      for (let b = e[k]; b < end; b++) if (this.freq[b] > m) m = this.freq[b];
      let v = Math.max(0, (m / 255 - 0.06) / 0.94);
      v = Math.pow(v, 1.35) * (0.9 + 0.45 * k / n) * this.sens;
      out[k] = Math.min(1, v);
    }
    return out;
  }
  analyze(dt) {
    const s = this.sens;
    this.bass = Math.min(1, this.avgRange(30, 150) * s);
    this.mid = Math.min(1, this.avgRange(250, 2000) * s);
    this.treble = Math.min(1, this.avgRange(3000, 12000) * s * 1.4);
    this.energy = this.bass * 0.5 + this.mid * 0.3 + this.treble * 0.2;
    if (this.bass > this.bassAvg * 1.25 && this.bass > 0.3 && this.t - this.lastBeat > 0.22) {
      this.beat = 1; this.lastBeat = this.t; this.beatCount++;
    }
    this.bassAvg = this.bassAvg * 0.94 + this.bass * 0.06;
    this.beat *= Math.exp(-dt * 6);
    this.hue = (this.hue + dt * (8 + this.energy * 40)) % 360;
  }

  /* ---------------- color + sprites ---------------- */
  /* palette of the current theme, cross-blended from the previous theme while switching */
  pal(t) {
    const a = this.palOf(this.theme, t);
    if (this.themeMix >= 1 || !this.prevTheme) return a;
    const b = this.palOf(this.prevTheme, t), m = this.themeMix * this.themeMix * (3 - 2 * this.themeMix);
    const dh = ((a[0] - b[0] + 540) % 360) - 180;
    return [(b[0] + dh * m + 360) % 360, b[1] + (a[1] - b[1]) * m, b[2] + (a[2] - b[2]) * m];
  }
  setTheme(id) {
    if (id === this.theme) return;
    this.prevTheme = this.theme; this.theme = id; this.themeMix = 0;
  }
  colOf(theme, t) { const [h, s, l] = this.palOf(theme, t); return `hsl(${h | 0},${s}%,${l}%)`; }
  palOf(theme, t) {
    switch (theme) {
      case 'warm': return [18 + t * 32, 95, 58];
      case 'neon': return [(this.hue + t * 260) % 360, 100, 62];
      case 'ocean': return [185 + t * 60, 90, 58];
      case 'forest': return [95 + t * 70, 75, 55];
      case 'toxic': return [(118 + t * 172) % 360, 95, 56 + t * 6];
      case 'mono': return [220, 12, 62 + t * 25];
      default: return [(320 + t * 75) % 360, 95, 62];
    }
  }
  col(t, a = 1, dl = 0) {
    const [h, s, l] = this.pal(t);
    return `hsla(${h | 0},${s}%,${Math.max(0, Math.min(100, l + dl))}%,${a})`;
  }
  sprite(t, kind = 'glow') {
    const [h, s, l] = this.pal(t);
    return this.spriteHSL(h, s, l, kind);
  }
  glowHSL(x, y, r, h, s, l, a, kind) {
    if (a <= 0.003 || r <= 0.3) return;
    const g = this.g;
    g.globalAlpha = Math.min(1, a);
    g.drawImage(this.spriteHSL(h, s, l, kind), x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1;
  }
  spriteHSL(h, s, l, kind = 'glow') {
    h = ((Math.round(h / 5) * 5) % 360 + 360) % 360; l = Math.round(l / 2) * 2; s = Math.round(s);
    const key = kind + h + '|' + s + '|' + l;
    let c = this.sp.get(key);
    if (c) return c;
    if (this.sp.size > 600) this.sp.clear();
    const C = (ll, a) => `hsla(${h},${s}%,${Math.min(97, ll)}%,${a})`;
    c = document.createElement('canvas');
    if (kind === 'strip') {
      c.width = 4; c.height = 256;
      const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, C(l, 0)); gr.addColorStop(0.55, C(l, 0.3)); gr.addColorStop(0.85, C(l + 12, 0.85));
      gr.addColorStop(0.93, C(l + 30, 1)); gr.addColorStop(1, C(l, 0));
      x.fillStyle = gr; x.fillRect(0, 0, 4, 256);
    } else {
      c.width = c.height = 96;
      const x = c.getContext('2d'), gr = x.createRadialGradient(48, 48, 0, 48, 48, 48);
      if (kind === 'disc') {   // bokeh: flat disc with a brighter rim
        gr.addColorStop(0, C(l + 8, 0.5)); gr.addColorStop(0.72, C(l, 0.6));
        gr.addColorStop(0.88, C(l + 14, 0.85)); gr.addColorStop(1, C(l, 0));
      } else {
        gr.addColorStop(0, C(l + 35, 1)); gr.addColorStop(0.18, C(l + 10, 0.7));
        gr.addColorStop(0.5, C(l, 0.18)); gr.addColorStop(1, C(l, 0));
      }
      x.fillStyle = gr; x.fillRect(0, 0, 96, 96);
    }
    this.sp.set(key, c);
    return c;
  }
  glowAt(x, y, r, t, a, kind) {
    if (a <= 0.003 || r <= 0.3) return;
    const g = this.g;
    g.globalAlpha = Math.min(1, a);
    g.drawImage(this.sprite(t, kind), x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1;
  }
  bg(fn) {
    const g = this.g;
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    if (this.overlay) { g.fillStyle = '#000'; g.fillRect(0, 0, this.w, this.h); }
    else fn(g, this.w, this.h);
  }
  st(name, init) { return this.S[name] || (this.S[name] = init()); }

  /* ---------------- loop ---------------- */
  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now; this.t += dt;
    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.freq);
      this.analyser.getByteTimeDomainData(this.wave);
    } else this.simulate(dt);
    this.analyze(dt);
    if (this.themeMix < 1) this.themeMix = Math.min(1, this.themeMix + dt / 2.5);

    if (this.autoMode !== 'off' && this.autoEvery > 0 && this.playing && this.xf <= 0) {
      this.autoT += dt;
      if (this.autoT >= this.autoEvery) { this.autoT = 0; this.autoNext(); }
    }

    const g = this.g;
    g.save();
    try { (this['s_' + this.scene] || this.s_lounge).call(this, dt); } catch (e) { console.error(e); }
    g.restore();
    if (this.xf > 0 && this.snap) {
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = this.xf * this.xf * (3 - 2 * this.xf);   // smoothstep
      g.drawImage(this.snap, 0, 0);
      g.restore();
      this.xf -= dt / 1.6;
    }
    // background dim + foreground spectrum
    const hasSpec = this.spec.style !== 'off';
    if (hasSpec && this.bgDim > 0) {
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.fillStyle = `rgba(0,0,0,${this.bgDim})`; g.fillRect(0, 0, this.w, this.h);
    }
    if (hasSpec) {
      g.save();
      try { const f = this['sp_' + this.spec.style]; f && f.call(this, dt); } catch (e) { console.error(e); }
      g.restore();
    }
    if (this.fx.bloom) this.applyBloom();
    if (this.fx.grain && !this.overlay) this.applyGrain();
    requestAnimationFrame(this.loop);
  }

  /* ---------- spectrum helpers ---------- */
  // bands with fast attack / slow release, for fluid motion
  smooth(n) {
    const b = this.bands(n), s = this._sm[n] || (this._sm[n] = new Float32Array(n));
    for (let i = 0; i < n; i++) s[i] += (b[i] - s[i]) * (b[i] > s[i] ? 0.55 : 0.16);
    return s;
  }
  // falling peak markers (0..1)
  peaksFor(n, b, dt) {
    const P = this._pk[n] || (this._pk[n] = { p: new Float32Array(n), v: new Float32Array(n) });
    for (let i = 0; i < n; i++) {
      if (b[i] >= P.p[i]) { P.p[i] = b[i]; P.v[i] = 0; }
      else { P.v[i] += dt * 1.3; P.p[i] = Math.max(0, P.p[i] - P.v[i] * dt); }
    }
    return P.p;
  }
  specCount(px, lo, hi) { return Math.max(lo, Math.min(hi, Math.floor(this.w / px))); }

  /* cheap bloom: blurred quarter-res copy added back on top */
  applyBloom() {
    const c = this.canvas, g = this.g;
    const bw = Math.max(1, c.width >> 2), bh = Math.max(1, c.height >> 2);
    if (!this.bc) { this.bc = document.createElement('canvas'); this.bx = this.bc.getContext('2d'); }
    if (this.bc.width !== bw || this.bc.height !== bh) { this.bc.width = bw; this.bc.height = bh; }
    const x = this.bx;
    x.globalCompositeOperation = 'copy';
    x.filter = 'blur(3px)';
    x.drawImage(c, 0, 0, bw, bh);
    x.filter = 'none';
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.5 + this.bass * 0.25;
    g.drawImage(this.bc, 0, 0, c.width, c.height);
    g.restore();
  }
  applyGrain() {
    const g = this.g;
    if (!this.grainPat) {
      const c = document.createElement('canvas'); c.width = c.height = 160;
      const x = c.getContext('2d'), id = x.createImageData(160, 160);
      for (let i = 0; i < 160 * 160; i++) { const v = Math.random() * 255 | 0; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
      x.putImageData(id, 0, 0);
      this.grainPat = g.createPattern(c, 'repeat');
    }
    g.save();
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.07;
    g.translate(-Math.random() * 160, -Math.random() * 160);
    g.fillStyle = this.grainPat; g.fillRect(0, 0, this.w + 160, this.h + 160);
    g.restore();
  }

  /* neon tube helper: wide glow + colored tube + white-hot core */
  neon(build, t, I, lw) {
    const g = this.g;
    g.lineJoin = 'round'; g.lineCap = 'round';
    build(); g.lineWidth = lw * 3.2; g.strokeStyle = this.col(t, 0.18 * I); g.stroke();
    build(); g.lineWidth = lw * 1.4; g.strokeStyle = this.col(t, 0.9 * I, 8); g.stroke();
    build(); g.lineWidth = Math.max(0.8, lw * 0.4); g.strokeStyle = `rgba(255,255,255,${0.85 * I})`; g.stroke();
  }
  neonText(txt, x, y, t, I, size) {
    const g = this.g;
    g.lineJoin = 'round';
    g.shadowColor = this.col(t, I); g.shadowBlur = size * 0.45;
    g.lineWidth = Math.max(2, size * 0.07); g.strokeStyle = this.col(t, 0.45 * I); g.strokeText(txt, x, y);
    g.shadowBlur = size * 0.12;
    g.lineWidth = Math.max(1.2, size * 0.035); g.strokeStyle = this.col(t, I, 22); g.strokeText(txt, x, y);
    g.shadowBlur = 0;
    g.lineWidth = Math.max(0.6, size * 0.012); g.strokeStyle = `rgba(255,255,255,${0.85 * I})`; g.strokeText(txt, x, y);
  }

  /* ================= SCENES ================= */

  /* None — plain black, spectrum only */
  s_none() {
    this.bg((g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); });
  }

  /* Lounge — drifting bokeh lights, warm lamp, dust in the air */
  s_lounge(dt) {
    const { g, w, h } = this, M = Math.max(w, h);
    const S = this.st('lounge', () => ({
      orbs: Array.from({ length: 55 }, (_, i) => ({
        x: Math.random(), y: Math.random(), r: 0.018 + Math.random() ** 2 * 0.07, t: Math.random(), b: i % 32,
        vx: (Math.random() - 0.5) * 0.012, vy: -(0.004 + Math.random() * 0.012), ph: Math.random() * TAU,
      })),
      motes: Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() })),
    }));
    this.bg((g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, this.col(0.2, 1, -57)); gr.addColorStop(1, this.col(0, 1, -51));
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    const b = this.bands(32), sp = 1 + this.energy * 2.5;
    g.globalCompositeOperation = 'lighter';
    this.glowAt(w * 0.5, h * 1.1, M * 0.55, 0.05, 0.16 + this.bass * 0.2);
    for (const o of S.orbs) {
      o.x += o.vx * dt * sp; o.y += o.vy * dt * sp;
      if (o.y < -0.15) { o.y = 1.15; o.x = Math.random(); }
      if (o.x < -0.15) o.x = 1.15; else if (o.x > 1.15) o.x = -0.15;
      const v = b[o.b];
      this.glowAt(o.x * w + Math.sin(this.t * 0.4 + o.ph) * 18, o.y * h,
        o.r * M * (0.85 + v * 0.45 + this.beat * 0.08), o.t, 0.05 + v * 0.5, 'disc');
    }
    for (const m of S.motes) {
      m.y -= dt * 0.01 * (0.5 + m.s) * sp;
      m.x += Math.sin(this.t * 0.5 + m.s * 20) * dt * 0.004;
      if (m.y < 0) { m.y = 1; m.x = Math.random(); }
      this.glowAt(m.x * w, m.y * h, 1.5 + m.s * 3, 0.1, 0.2 + this.treble * 0.6);
    }
  }

  /* Vinyl — spinning record with cover art, tonearm follows progress */
  s_vinyl(dt) {
    const { g, w, h } = this, M = Math.max(w, h), R = Math.min(w, h) * 0.3, cx = w / 2, cy = h * 0.5;
    const S = this.st('vinyl', () => ({ ang: 0, spd: 0, arm: Math.PI / 2 - 0.3 }));
    S.spd += ((this.playing ? 3.49 : 0) - S.spd) * Math.min(1, dt * 1.5);    // 33⅓ rpm
    S.ang += S.spd * dt;
    this.bg((g, w, h) => {
      const gr = g.createRadialGradient(cx, cy, R * 0.5, cx, cy, M * 0.75);
      gr.addColorStop(0, this.col(0.1, 1, -50)); gr.addColorStop(1, '#030203');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    g.globalCompositeOperation = 'lighter';
    this.glowAt(w * 0.12, h * 0.05, M * 0.45, 0.1, 0.22 + this.bass * 0.15);
    // spectrum halo
    const n = 96, half = 48, b = this.bands(half);
    g.lineCap = 'round'; g.lineWidth = Math.max(2, TAU * R / n * 0.4);
    for (let i = 0; i < n; i++) {
      const k = i < half ? i : n - 1 - i, v = b[k];
      const a = i / n * TAU - Math.PI / 2, r0 = R * 1.05, r1 = r0 + 3 + v * R * 0.42;
      g.strokeStyle = this.col(k / half, 0.2 + v * 0.75);
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    if (!this.overlay) { g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.arc(cx + R * 0.04, cy + R * 0.06, R * 1.01, 0, TAU); g.fill(); }
    g.fillStyle = '#0b0b0d'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    g.lineWidth = 1;
    for (let k = 0; k < 34; k++) {
      g.strokeStyle = `rgba(255,255,255,${k % 4 ? 0.025 : 0.055})`;
      g.beginPath(); g.arc(cx, cy, R * (0.36 + k * 0.0185), 0, TAU); g.stroke();
    }
    if (g.createConicGradient) {
      const cg = g.createConicGradient(-0.7, cx, cy);
      cg.addColorStop(0, 'rgba(255,255,255,0)'); cg.addColorStop(0.06, 'rgba(255,255,255,0.09)');
      cg.addColorStop(0.12, 'rgba(255,255,255,0)'); cg.addColorStop(0.5, 'rgba(255,255,255,0)');
      cg.addColorStop(0.56, 'rgba(255,255,255,0.06)'); cg.addColorStop(0.62, 'rgba(255,255,255,0)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cg; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    }
    // label (cover art)
    g.save(); g.translate(cx, cy); g.rotate(S.ang);
    g.beginPath(); g.arc(0, 0, R * 0.33, 0, TAU); g.clip();
    const img = this.track.img;
    if (img && img.naturalWidth) {
      const s = R * 0.66, sc = Math.max(s / img.naturalWidth, s / img.naturalHeight);
      g.drawImage(img, -img.naturalWidth * sc / 2, -img.naturalHeight * sc / 2, img.naturalWidth * sc, img.naturalHeight * sc);
    } else {
      g.fillStyle = this.col(0.2, 1, -12); g.fillRect(-R, -R, 2 * R, 2 * R);
      g.fillStyle = 'rgba(255,255,255,.85)'; g.textAlign = 'center';
      g.font = `600 ${Math.round(R * 0.055)}px "Segoe UI", sans-serif`;
      g.fillText((this.track.title || 'vibe').slice(0, 24), 0, -R * 0.1);
    }
    g.restore();
    g.fillStyle = '#151518'; g.beginPath(); g.arc(cx, cy, R * 0.03, 0, TAU); g.fill();
    // tonearm: binary-search the angle that puts the needle at the right groove radius
    const px = cx + R * 1.18, py = cy - R * 0.92, Ls = R * 1.55;
    let target = Math.PI / 2 - 0.3;
    if (this.playing || this.progress > 0) {
      const want = R * (0.93 - 0.55 * Math.min(1, this.progress));
      let lo = Math.PI / 2, hi = Math.PI * 0.75;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2, ex = px + Math.cos(mid) * Ls - cx, ey = py + Math.sin(mid) * Ls - cy;
        Math.hypot(ex, ey) > want ? (lo = mid) : (hi = mid);
      }
      target = lo;
    }
    S.arm += (target - S.arm) * Math.min(1, dt * 2.5);
    const ex = px + Math.cos(S.arm) * Ls, ey = py + Math.sin(S.arm) * Ls;
    g.lineCap = 'round';
    g.strokeStyle = '#2a2a30'; g.lineWidth = R * 0.05;
    g.beginPath(); g.moveTo(px - Math.cos(S.arm) * R * 0.22, py - Math.sin(S.arm) * R * 0.22); g.lineTo(px, py); g.stroke();
    g.strokeStyle = '#c8c8d0'; g.lineWidth = R * 0.022;
    g.beginPath(); g.moveTo(px, py); g.lineTo(ex, ey); g.stroke();
    g.save(); g.translate(ex, ey); g.rotate(S.arm + 0.5);
    g.fillStyle = '#d8d8de'; g.fillRect(-R * 0.03, -R * 0.045, R * 0.1, R * 0.09); g.restore();
    g.fillStyle = '#1c1c21'; g.beginPath(); g.arc(px, py, R * 0.09, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.15)'; g.lineWidth = 2; g.stroke();
  }

  /* Rainy window — neon city bokeh behind glass, rain streaks, drops, lightning */
  s_rain(dt) {
    const { g, w, h } = this, M = Math.max(w, h);
    const S = this.st('rain', () => ({
      lights: Array.from({ length: 45 }, (_, i) => ({ x: Math.random(), y: 0.35 + Math.random() * 0.6, r: 0.02 + Math.random() * 0.06, t: Math.random(), b: i % 32, ph: Math.random() * TAU })),
      streaks: Array.from({ length: 170 }, () => ({ x: Math.random(), y: Math.random(), l: 0.03 + Math.random() * 0.07, v: 0.9 + Math.random() * 0.8 })),
      drops: Array.from({ length: 70 }, () => this._drop()),
      flash: 0, beat: 0,
    }));
    this.bg((g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#03050b'); gr.addColorStop(1, this.col(0.5, 1, -52));
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    const b = this.bands(32);
    g.globalCompositeOperation = 'lighter';
    for (const o of S.lights) {
      const v = b[o.b], fl = 0.85 + 0.15 * Math.sin(this.t * 2 + o.ph);
      this.glowAt(o.x * w, o.y * h, o.r * M * (0.9 + v * 0.3), o.t, (0.05 + v * 0.42) * fl, 'disc');
    }
    g.strokeStyle = 'rgba(180,200,255,0.13)'; g.lineWidth = 1;
    g.beginPath();
    for (const s of S.streaks) {
      s.y += dt * s.v * 1.4;
      if (s.y > 1.1) { s.y = -0.1; s.x = Math.random(); }
      const x = s.x * w + s.y * w * 0.03;
      g.moveTo(x, s.y * h); g.lineTo(x - s.l * w * 0.03, (s.y - s.l) * h);
    }
    g.stroke();
    g.globalCompositeOperation = 'source-over';
    for (const d of S.drops) {
      d.hold -= dt;
      if (d.hold < 0) {
        d.vy += dt * 0.08; d.y += d.vy * dt;
        if (Math.random() < dt * 0.5) { d.vy = 0; d.hold = 1 + Math.random() * 4; }
      }
      if (d.y > 1.05) Object.assign(d, this._drop(), { y: -0.02 });
      const x = d.x * w, y = d.y * h;
      g.fillStyle = 'rgba(200,220,255,0.07)'; g.beginPath(); g.arc(x, y, d.r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x - d.r * 0.3, y - d.r * 0.35, d.r * 0.25, 0, TAU); g.fill();
    }
    if (S.beat !== this.beatCount) {
      S.beat = this.beatCount;
      if (this.energy > 0.55 && Math.random() < 0.05) S.flash = 1;
    }
    S.flash *= Math.exp(-dt * 5);
    if (S.flash > 0.01) { g.fillStyle = `rgba(200,210,255,${S.flash * 0.22})`; g.fillRect(0, 0, w, h); }
    if (!this.overlay) {
      const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, M * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)');
      g.fillStyle = v; g.fillRect(0, 0, w, h);
    }
  }
  _drop() { return { x: Math.random(), y: Math.random(), r: 2 + Math.random() * 5, vy: 0, hold: Math.random() * 8 }; }

  /* Aurora — northern lights curtains over mountains, twinkling stars */
  s_aurora(dt) {
    const { g, w, h } = this, hz = h * 0.8;
    const S = this.st('aurora', () => ({
      stars: Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random() * 0.75, s: Math.random(), p: Math.random() * TAU })),
      mt: [0, 1].map((k) => Array.from({ length: 41 }, (_, i) => hash(i * 3.7 + k * 50) * 0.5 + hash(i * 0.9 + k * 13) * 0.5)),
      shoot: null, beat: 0,
    }));
    this.bg((g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#01020a'); gr.addColorStop(0.75, this.col(0.4, 1, -50)); gr.addColorStop(1, '#020308');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    g.globalCompositeOperation = 'lighter';
    for (const s of S.stars) {
      const a = (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(this.t * (0.8 + s.s * 2) + s.p))) * (0.4 + s.s * 0.6) * (0.7 + this.treble * 0.6);
      g.fillStyle = `rgba(255,255,255,${Math.min(1, a * 0.8)})`;
      const z = s.s > 0.9 ? 2 : 1;
      g.fillRect(s.x * w, s.y * h, z, z);
    }
    const n = 48, b = this.bands(n), step = Math.max(3, Math.round(w / 320));
    for (let L = 0; L < 3; L++) {
      const spr = this.sprite(0.1 + L * 0.3, 'strip');
      for (let x = 0; x < w; x += step) {
        const nx = x / w;
        const y = h * (0.42 + L * 0.07) + Math.sin(nx * 3.2 + this.t * 0.12 * (L + 1) + L) * h * 0.07 + Math.sin(nx * 8.1 - this.t * 0.21) * h * 0.025;
        const v = b[Math.min(n - 1, Math.floor(nx * n))];
        const hh = h * (0.1 + 0.28 * v + 0.06 * Math.sin(nx * 6 + this.t * 0.5 + L));
        g.globalAlpha = Math.min(1, 0.12 + v * 0.6) * (L === 0 ? 1 : 0.7);
        g.drawImage(spr, x, y - hh, step + 1, hh * 1.15);
      }
    }
    g.globalAlpha = 1;
    if (S.beat !== this.beatCount) {
      S.beat = this.beatCount;
      if (!S.shoot && Math.random() < 0.1) S.shoot = { x: Math.random() * 0.7 + 0.2, y: Math.random() * 0.3, life: 1 };
    }
    if (S.shoot) {
      const s = S.shoot;
      s.life -= dt * 1.4; s.x -= dt * 0.35; s.y += dt * 0.18;
      g.strokeStyle = `rgba(255,255,255,${Math.max(0, s.life)})`; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(s.x * w, s.y * h); g.lineTo((s.x + 0.06) * w, (s.y - 0.03) * h); g.stroke();
      if (s.life <= 0) S.shoot = null;
    }
    g.globalCompositeOperation = 'source-over';
    for (let k = 0; k < 2; k++) {
      const m = S.mt[k];
      g.fillStyle = k ? '#010104' : '#05060e';
      g.beginPath(); g.moveTo(0, h);
      for (let i = 0; i < m.length; i++) g.lineTo(i / (m.length - 1) * w, hz - (k ? 0.0 : 0.07) * h - m[i] * h * (k ? 0.1 : 0.17));
      g.lineTo(w, h); g.closePath(); g.fill();
    }
  }

  /* Synthwave — retro sun, spectrum mountains, scrolling neon grid */
  s_synthwave(dt) {
    const { g, w, h } = this, hz = h * 0.62, cx = w / 2;
    const S = this.st('synth', () => ({ z: 0, stars: Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random() * 0.55, s: Math.random() })) }));
    S.z += dt * (this.playing ? 0.5 + this.energy * 1.6 : 0.1);
    let sky = '#000';
    this.bg((g, w, h) => {
      sky = g.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0, '#05020f'); sky.addColorStop(0.7, this.col(0, 1, -45)); sky.addColorStop(1, this.col(0.3, 1, -30));
      g.fillStyle = sky; g.fillRect(0, 0, w, hz);
      g.fillStyle = '#05010b'; g.fillRect(0, hz, w, h - hz);
    });
    g.globalCompositeOperation = 'lighter';
    for (const s of S.stars) { g.fillStyle = `rgba(255,255,255,${0.2 + s.s * 0.5})`; g.fillRect(s.x * w, s.y * h, 1, 1); }
    const R = Math.min(w, h) * 0.2 * (1 + this.bass * 0.06), sy = hz - R * 0.35;
    this.glowAt(cx, sy, R * 2.4, 0.1, 0.22 + this.bass * 0.25);
    g.globalCompositeOperation = 'source-over';
    g.save(); g.beginPath(); g.arc(cx, sy, R, 0, TAU); g.clip();
    const sg = g.createLinearGradient(0, sy - R, 0, sy + R);
    sg.addColorStop(0, this.col(0.95, 1, 18)); sg.addColorStop(1, this.col(0.05, 1, 0));
    g.fillStyle = sg; g.fillRect(cx - R, sy - R, 2 * R, 2 * R);
    g.fillStyle = sky;
    const shift = (S.z * 0.15 * R) % (R * 0.14);
    for (let k = 0; k < 8; k++) g.fillRect(cx - R, sy + R * (k * 0.14) + shift, 2 * R, R * (0.012 + k * 0.012));
    g.restore();
    // spectrum mountains
    const n = 40, b = this.bands(n);
    for (let L = 0; L < 2; L++) {
      g.beginPath(); g.moveTo(0, hz);
      for (let i = 0; i <= 80; i++) {
        const k = Math.abs(i - 40) / 40, v = b[Math.min(n - 1, Math.floor(k * n))];
        g.lineTo(i / 80 * w, hz - h * (L ? 0.09 : 0.15) * (0.2 + k) * (0.35 + v));
      }
      g.lineTo(w, hz); g.closePath();
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = L ? '#08020f' : '#0c0418'; g.fill();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = this.col(0.6 + L * 0.25, 0.8); g.lineWidth = 1.5; g.stroke();
    }
    // grid
    g.save(); g.beginPath(); g.rect(0, hz, w, h - hz); g.clip();
    g.strokeStyle = this.col(0.9, 0.8, 5); g.lineWidth = 1.2;
    const N = 18;
    for (let k = 0; k < N; k++) {
      const f = (k + (S.z % 1)) / N, y = hz + (h - hz) * Math.pow(f, 2.6);
      g.globalAlpha = Math.min(1, f * 1.6);
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    g.globalAlpha = 0.75;
    for (let i = -24; i <= 24; i++) {
      g.beginPath(); g.moveTo(cx + i * w * 0.004, hz); g.lineTo(cx + i * w * 0.09, h); g.stroke();
    }
    g.restore();
    g.globalAlpha = 1;
    g.fillStyle = this.col(0.1, 0.9, 15); g.fillRect(0, hz - 1, w, 2);
  }

  /* Disco ball — mirror ball, reflected light spots sweep the room */
  s_disco(dt) {
    const { g, w, h } = this, M = Math.max(w, h), R = Math.min(w, h) * 0.1, cx = w / 2, cy = h * 0.27;
    const S = this.st('disco', () => ({
      rot: 0, spots: Array.from({ length: 110 }, (_, i) => ({ lon: Math.random() * TAU, lat: Math.random() * 2 - 1, s: Math.random(), t: Math.random(), b: i % 24 })),
    }));
    S.rot += dt * (this.playing ? 0.35 + this.energy * 0.5 : 0.08);
    this.bg((g, w, h) => {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, M * 0.8);
      gr.addColorStop(0, this.col(0.6, 1, -48)); gr.addColorStop(1, '#030206');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const fg = g.createLinearGradient(0, h * 0.72, 0, h);
      fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, this.col(0.3, 0.3, -42));
      g.fillStyle = fg; g.fillRect(0, h * 0.72, w, h * 0.28);
    });
    const b = this.bands(24);
    g.globalCompositeOperation = 'lighter';
    for (const sx of [0.08, 0.92]) {
      const x0 = sx * w, y0 = h, ang = Math.atan2(cy - y0, cx - x0), px = -Math.sin(ang), py = Math.cos(ang), wd = R * 1.1;
      const gr = g.createLinearGradient(x0, y0, cx, cy);
      gr.addColorStop(0, this.col(sx, 0.16 + this.beat * 0.15)); gr.addColorStop(1, this.col(sx, 0));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(x0 - px * 20, y0 - py * 20); g.lineTo(cx + px * wd, cy + py * wd);
      g.lineTo(cx - px * wd, cy - py * wd); g.lineTo(x0 + px * 20, y0 + py * 20); g.closePath(); g.fill();
    }
    for (const s of S.spots) {
      const a = s.lon + S.rot, c = Math.cos(a);
      if (c < 0.05) continue;
      const v = b[s.b];
      this.glowAt(cx + Math.sin(a) * w * 0.62, cy + s.lat * h * 0.62 + h * 0.12,
        (5 + s.s * 10) * (1 + this.bass * 0.6) * (0.6 + c * 0.6), s.t, c * (0.15 + v * 0.75 + this.beat * 0.2));
    }
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(200,200,220,0.35)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, cy - R); g.stroke();
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
    const base = g.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
    base.addColorStop(0, '#8a8a98'); base.addColorStop(1, '#15151c');
    g.fillStyle = base; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    const rows = 12, cols = 26, fs = R * 2 / rows, tick = Math.floor(this.t * 6);
    for (let i = 0; i < rows; i++) {
      const lat = -Math.PI / 2 + (i + 0.5) / rows * Math.PI, cl = Math.cos(lat), y = cy + Math.sin(lat) * R;
      for (let j = 0; j < cols; j++) {
        const lon = j / cols * TAU + S.rot, z = Math.cos(lon) * cl;
        if (z <= 0) continue;
        const x = cx + Math.sin(lon) * cl * R, tw = hash(i * 31 + j * 7 + tick);
        g.fillStyle = tw > 0.96 ? this.col(tw, 1, 20) : `hsl(230,10%,${(22 + z * 45 + (tw > 0.9 ? 28 : 0) + this.beat * 10) | 0}%)`;
        const fw = (TAU * cl * R / cols) * Math.abs(Math.cos(lon)) * 0.85;
        g.fillRect(x - fw / 2, y - fs * 0.42, fw, fs * 0.84);
      }
    }
    g.restore();
    g.globalCompositeOperation = 'lighter';
    this.glowAt(cx - R * 0.35, cy - R * 0.4, R * 0.5, 0.5, 0.45 + this.beat * 0.4);
  }

  /* Club lasers — fans of beams from the ceiling through haze, LED floor */
  s_lasers(dt) {
    const { g, w, h } = this, M = Math.max(w, h);
    const S = this.st('lasers', () => ({
      smoke: Array.from({ length: 10 }, () => ({ x: Math.random(), y: 0.3 + Math.random() * 0.6, r: 0.25 + Math.random() * 0.3, v: (Math.random() - 0.5) * 0.02 })),
      pat: 0, beat: 0, sweep: 0,
    }));
    this.bg((g, w, h) => { g.fillStyle = '#030207'; g.fillRect(0, 0, w, h); });
    if (S.beat !== this.beatCount) { S.beat = this.beatCount; if (this.beatCount % 8 === 0) S.pat = (S.pat + 1) % 4; }
    S.sweep += dt * (0.3 + this.mid * 1.2);
    g.globalCompositeOperation = 'lighter';
    for (const s of S.smoke) {
      s.x += s.v * dt;
      if (s.x < -0.3) s.x = 1.3; else if (s.x > 1.3) s.x = -0.3;
      this.glowAt(s.x * w, s.y * h, s.r * M, 0.5, 0.03 + this.energy * 0.05);
    }
    const b = this.bands(24), floorY = h * 0.9, E = [0.12, 0.5, 0.88], n = 6;
    g.lineCap = 'round';
    for (let e = 0; e < 3; e++) {
      const ex = E[e] * w, ey = -10;
      for (let i = 0; i < n; i++) {
        const v = b[(e * n + i) % 24], u = i / (n - 1) - 0.5;
        let a;
        switch (S.pat) {
          case 0: a = Math.PI / 2 + u * 1.1 + Math.sin(S.sweep + e) * 0.45; break;
          case 1: a = Math.PI / 2 + u * 0.4 * (1 + v) + Math.sin(S.sweep * 1.7 + e * 2.1) * 0.7; break;
          case 2: a = Math.PI / 2 + Math.sin(S.sweep * 1.3 + i * 0.9 + e) * 0.8; break;
          default: a = Math.PI / 2 + u * 1.6 * Math.sin(S.sweep * 0.8) + (e - 1) * 0.3;
        }
        const ca = Math.cos(a), sa = Math.sin(a), d = (floorY - ey) / Math.max(0.15, sa);
        const x2 = ex + ca * d, y2 = ey + sa * d, alpha = 0.1 + v * 0.85, t = (i / n * 0.5 + e * 0.25) % 1;
        const gr = g.createLinearGradient(ex, ey, x2, y2);
        gr.addColorStop(0, this.col(t, alpha, 10)); gr.addColorStop(1, this.col(t, alpha * 0.35));
        g.strokeStyle = gr;
        g.beginPath(); g.moveTo(ex, ey); g.lineTo(x2, y2);
        g.lineWidth = 8; g.globalAlpha = 0.16; g.stroke();
        g.lineWidth = 1.6; g.globalAlpha = 1; g.stroke();
        this.glowAt(x2, y2, 16 + v * 40, t, alpha * 0.7);
      }
    }
    const nb = 48, fb = this.bands(nb), bw = w / nb;
    for (let i = 0; i < nb; i++) {
      const v = fb[i];
      g.fillStyle = this.col(i / nb, 0.1 + v * 0.6);
      g.fillRect(i * bw + 1, floorY + 4, bw - 2, (h - floorY - 4) * (0.3 + v * 0.7));
    }
    if (this.beat > 0.85 && this.energy > 0.55) {
      g.fillStyle = `rgba(255,255,255,${(this.beat - 0.85) * 0.35 * Math.min(1, this.strobe * 2)})`;
      g.fillRect(0, 0, w, h);
    }
  }

  /* LED wall — pub-style dot-matrix equalizer with scrolling track title */
  s_ledwall(dt) {
    const { g, w, h } = this;
    const cell = Math.max(9, Math.round(Math.min(w, h) / 58)), cols = Math.floor(w / cell), rows = Math.floor(h / cell);
    const ox = (w - cols * cell) / 2 + cell / 2, oy = (h - rows * cell) / 2 + cell / 2, d = cell * 0.62;
    const S = this.st('ledwall', () => ({ key: '', grid: null, text: null, th: 0, mask: null, tw: 0, off: 0, peaks: new Float32Array(512), pv: new Float32Array(512) }));
    const key = `${w}x${h}x${cell}`;
    if (S.key !== key) {
      S.key = key;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,255,0.045)';
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) x.fillRect(ox + q * cell - d / 2, oy + r * cell - d / 2, d, d);
      S.grid = c;
    }
    const th = Math.max(7, Math.min(14, Math.floor(rows * 0.16)));
    const label = (this.track.title || 'vibe player') + (this.track.artist ? '  ·  ' + this.track.artist : '') + '      ';
    if (S.text !== label || S.th !== th) {
      const tc = document.createElement('canvas'), x = tc.getContext('2d');
      const font = `bold ${th}px "Segoe UI", Arial, sans-serif`;
      x.font = font;
      const tw = Math.ceil(x.measureText(label).width) + 1;
      tc.width = tw; tc.height = th;
      x.font = font; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(label, 0, th / 2 + 0.5);
      const id = x.getImageData(0, 0, tw, th).data;
      S.mask = new Uint8Array(tw * th);
      for (let i = 0; i < tw * th; i++) S.mask[i] = id[i * 4 + 3] > 110 ? 1 : 0;
      S.tw = tw; S.th = th; S.text = label;
    }
    this.bg((g, w, h) => { g.fillStyle = '#040404'; g.fillRect(0, 0, w, h); });
    g.drawImage(S.grid, 0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    // marquee
    S.off += dt * (9 + this.energy * 8);
    const period = S.tw + cols, shift = S.off % period, top = 1;
    g.fillStyle = this.col(0.85, 1, 18);
    for (let r = 0; r < S.th; r++) {
      const y = oy + (top + r) * cell - d / 2;
      for (let q = 0; q < cols; q++) {
        const tx = Math.floor(q + shift) - cols;
        if (tx >= 0 && tx < S.tw && S.mask[r * S.tw + tx]) g.fillRect(ox + q * cell - d / 2, y, d, d);
      }
    }
    // spectrum
    const sTop = top + S.th + 2, H = rows - sTop - 1;
    if (H < 4) return;
    const nb = Math.min(cols, 200), b = this.bands(nb), lit = new Int16Array(cols);
    for (let q = 0; q < cols; q++) {
      const v = b[Math.min(nb - 1, Math.floor(q / cols * nb))];
      lit[q] = Math.round(v * H);
      if (lit[q] >= S.peaks[q]) { S.peaks[q] = lit[q]; S.pv[q] = 0; }
      else { S.pv[q] += dt * 25; S.peaks[q] = Math.max(0, S.peaks[q] - S.pv[q] * dt); }
    }
    for (let pass = 0; pass < 2; pass++) {
      const dd = pass ? d * 1.9 : d;
      g.globalAlpha = pass ? 0.16 : 1;
      for (let r = 0; r < H; r++) {
        const y = oy + (rows - 2 - r) * cell - dd / 2;
        g.fillStyle = this.col(r / H, 1, 0);
        for (let q = 0; q < cols; q++) if (lit[q] > r) g.fillRect(ox + q * cell - dd / 2, y, dd, dd);
      }
    }
    g.globalAlpha = 1;
    g.fillStyle = this.col(1, 1, 25);
    for (let q = 0; q < cols; q++) {
      const pr = Math.round(S.peaks[q]);
      if (pr > 0 && pr <= H) g.fillRect(ox + q * cell - d / 2, oy + (rows - 2 - pr) * cell - d / 2, d, d);
    }
  }

  /* ======================================================
   *  NEW SCENES
   * ====================================================== */

  /* Fireplace — cozy flames, embers on the beat */
  s_fireplace(dt) {
    const { g, w, h } = this, M = Math.max(w, h), cx = w / 2, base = h * 0.8, fw = Math.min(w * 0.5, h * 0.7);
    const S = this.st('fire', () => ({ p: [], emb: [], beat: 0, acc: 0 }));
    this.bg((g, w, h) => {
      const gr = g.createRadialGradient(cx, base, 0, cx, base, M * 0.8);
      gr.addColorStop(0, '#2a1206'); gr.addColorStop(0.45, '#0d0603'); gr.addColorStop(1, '#030101');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, base + fw * 0.07, w, h);
    });
    const b = this.bands(16);
    S.acc += (700 + this.energy * 1400) * dt;
    while (S.acc >= 1) {
      S.acc--;
      const u = (Math.random() - 0.5) * 2, v = b[Math.min(15, Math.floor(Math.abs(u) * 16))];
      S.p.push({
        x: cx + u * fw * 0.36, y: base,
        vx: -u * 10 + (Math.random() - 0.5) * 16,
        vy: -(50 + Math.random() * 90) * (0.6 + v * 0.9 + this.bass * 0.5),
        life: 1, d: 0.9 + Math.random() * 0.9, s: (0.6 + Math.random() * 0.8) * fw * 0.085 * (1 - Math.abs(u) * 0.5),
      });
    }
    if (S.p.length > 1100) S.p.splice(0, S.p.length - 1100);
    if (S.beat !== this.beatCount) {
      S.beat = this.beatCount;
      for (let k = 0; k < 3 + this.energy * 10; k++)
        S.emb.push({ x: cx + (Math.random() - 0.5) * fw * 0.5, y: base - 10, vx: (Math.random() - 0.5) * 90, vy: -(120 + Math.random() * 240), life: 1 });
    }
    g.globalCompositeOperation = 'lighter';
    const flick = 0.85 + 0.15 * Math.sin(this.t * 13) * Math.sin(this.t * 7.3);
    this.glowHSL(cx, base - fw * 0.15, M * 0.65, 22, 95, 50, (0.12 + this.bass * 0.18) * flick);
    const ps = S.p;
    let n = 0;
    for (const p of ps) {
      p.life -= dt * p.d;
      if (p.life <= 0) continue;
      ps[n++] = p;
      p.vx += (cx - p.x) * dt * 1.1 + Math.sin(this.t * 6 + p.y * 0.04) * dt * 45;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= 1 - dt * 0.25;
      const L = p.life;
      this.glowHSL(p.x, p.y, p.s * (0.35 + L * 0.85), 6 + L * 42, 100, 38 + L * 26, L * 0.5);
    }
    ps.length = n;
    let m = 0;
    for (const e of S.emb) {
      e.life -= dt * 0.55;
      if (e.life <= 0) continue;
      S.emb[m++] = e;
      e.vx += Math.sin(this.t * 3 + e.y * 0.02) * dt * 70; e.x += e.vx * dt; e.y += e.vy * dt; e.vy += dt * 35;
      this.glowHSL(e.x, e.y, 3 + e.life * 3, 30, 100, 60, e.life);
    }
    S.emb.length = m;
    if (!this.overlay) {
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#100703';
      for (const k of [-1, 1]) {
        g.save(); g.translate(cx + k * fw * 0.12, base + fw * 0.035); g.rotate(k * 0.13);
        rrect(g, -fw * 0.3, -fw * 0.045, fw * 0.6, fw * 0.09, fw * 0.045); g.fill(); g.restore();
      }
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(255,90,20,${(0.12 + this.bass * 0.3) * flick})`;
      g.fillRect(cx - fw * 0.28, base - fw * 0.005, fw * 0.56, fw * 0.018);
    }
  }

  /* Neon Bar — flickering neon signs on a brick wall */
  s_neon(dt) {
    const { g, w, h } = this, cx = w / 2, cy = h * 0.42;
    const S = this.st('neon', () => ({ key: '', wall: null, flick: 0 }));
    const key = w + 'x' + h;
    if (S.key !== key) {
      S.key = key;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.fillStyle = '#070606'; x.fillRect(0, 0, w, h);
      const bh = Math.max(18, h / 24), bw = bh * 2.6;
      for (let r = 0; r * bh < h; r++) for (let q = -1; q * bw < w; q++) {
        const v = 13 + Math.random() * 10;
        x.fillStyle = `rgb(${v + 9 | 0},${v | 0},${v - 3 | 0})`;
        x.fillRect(q * bw + (r % 2 ? bw / 2 : 0) + 2, r * bh + 2, bw - 4, bh - 4);
      }
      S.wall = c;
    }
    this.bg((g) => g.drawImage(S.wall, 0, 0, w, h));
    if (S.flick <= 0 && Math.random() < dt * 0.12) S.flick = 0.2 + Math.random() * 0.35;
    S.flick -= dt;
    const on = S.flick > 0 ? (Math.random() < 0.5 ? 0.12 : 1) : 1;
    const I = Math.min(1, (0.7 + this.bass * 0.35 + this.beat * 0.15)) * on;
    g.globalCompositeOperation = 'lighter';
    this.glowAt(cx, cy, Math.max(w, h) * 0.55, 0.15, 0.16 * I);
    const raw = (this.track.title || 'vibe').replace(/\s*[\(\[].*?[\)\]]/g, '').trim() || 'vibe';
    const txt = raw.length > 22 ? raw.slice(0, 21) + '…' : raw;
    const size = Math.min(w / (Math.max(6, txt.length) * 0.5), h * 0.16);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `italic 600 ${size}px "Segoe Script","Brush Script MT","Lucida Handwriting",cursive`;
    this.neonText(txt, cx, cy, 0, I, size);
    const sub = (this.track.artist || 'live music · cold drinks').toUpperCase();
    g.font = `600 ${Math.round(size * 0.24)}px "Segoe UI",sans-serif`;
    this.neonText(sub.length > 40 ? sub.slice(0, 39) + '…' : sub, cx, cy + size * 0.85, 0.6, I * 0.9, size * 0.24);
    const s = Math.min(w, h) * 0.07;
    g.font = `800 ${Math.round(s * 0.7)}px "Segoe UI",sans-serif`;
    this.neonText('OPEN', w * 0.86, h * 0.13, 0.95, (this.beatCount % 2 === 0 || !this.playing) ? 0.95 : 0.12, s * 0.7);
    // martini glass sign
    const gx = w * 0.13, gy = h * 0.12, gs = s * 2.2;
    this.neon(() => {
      g.beginPath();
      g.moveTo(gx - gs / 2, gy); g.lineTo(gx + gs / 2, gy); g.lineTo(gx, gy + gs * 0.5); g.closePath();
      g.moveTo(gx, gy + gs * 0.5); g.lineTo(gx, gy + gs * 0.95);
      g.moveTo(gx - gs * 0.25, gy + gs * 0.95); g.lineTo(gx + gs * 0.25, gy + gs * 0.95);
    }, 0.35, I, Math.max(2, s * 0.06));
    this.neon(() => { g.beginPath(); g.arc(gx + gs * 0.08, gy + gs * 0.17, gs * 0.07, 0, TAU); }, 0.15, I, Math.max(1.5, s * 0.045));
    // neon tube equalizer
    const n = 24, b = this.bands(n), tw = Math.min(w * 0.6 / n, 28), x0 = cx - n * tw / 2, yb = h * 0.9, maxH = h * 0.2;
    for (let i = 0; i < n; i++) {
      const v = b[i], x = x0 + i * tw + tw / 2;
      this.neon(() => { g.beginPath(); g.moveTo(x, yb); g.lineTo(x, yb - 3 - v * maxH); }, i / n, (0.35 + v * 0.7) * on, tw * 0.22);
    }
  }

  /* Cocktail — a drink on the bar: liquid, ice, fizz */
  s_cocktail(dt) {
    const { g, w, h } = this, M = Math.max(w, h), cx = w / 2;
    const gh = Math.min(h * 0.6, w * 0.5), gw = gh * 0.56, top = h * 0.47 - gh * 0.5, bot = top + gh, tw = gw / 2, bw2 = gw * 0.42;
    const S = this.st('cocktail', () => ({
      bub: [], acc: 0,
      lights: Array.from({ length: 26 }, (_, i) => ({ x: Math.random(), y: Math.random() * 0.5, r: 0.02 + Math.random() * 0.05, t: Math.random(), b: i % 24 })),
      ice: [{ x: -0.16, y: 0.1, a: 0.3, s: 0.36 }, { x: 0.16, y: 0.2, a: -0.4, s: 0.33 }, { x: 0, y: 0.38, a: 0.9, s: 0.3 }],
    }));
    this.bg((g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, this.col(0.1, 1, -56)); gr.addColorStop(1, '#050302');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const cg = g.createLinearGradient(0, bot, 0, h);
      cg.addColorStop(0, '#24130a'); cg.addColorStop(1, '#070302');
      g.fillStyle = cg; g.fillRect(0, bot - 2, w, h - bot + 2);
      g.fillStyle = 'rgba(255,200,150,0.08)'; g.fillRect(0, bot - 2, w, 2);
    });
    const b = this.bands(24);
    g.globalCompositeOperation = 'lighter';
    for (const o of S.lights) this.glowAt(o.x * w, o.y * h, o.r * M, o.t, 0.05 + b[o.b] * 0.4, 'disc');
    const glass = () => { g.beginPath(); g.moveTo(cx - tw, top); g.lineTo(cx - bw2, bot); g.lineTo(cx + bw2, bot); g.lineTo(cx + tw, top); g.closePath(); };
    const lvl = top + gh * 0.2;
    const surf = (x) => lvl + Math.sin(x * 0.025 + this.t * 2.2) * gh * 0.005 * (1 + this.bass * 5);
    g.save(); glass(); g.clip();
    g.globalCompositeOperation = 'source-over';
    const lg = g.createLinearGradient(0, lvl, 0, bot);
    lg.addColorStop(0, this.col(0, 0.8, -4)); lg.addColorStop(1, this.col(0.6, 0.92, -28));
    g.beginPath(); g.moveTo(cx - tw - 5, bot + 5);
    for (let x = cx - tw - 5; x <= cx + tw + 5; x += 6) g.lineTo(x, surf(x));
    g.lineTo(cx + tw + 5, bot + 5); g.closePath(); g.fillStyle = lg; g.fill();
    g.globalCompositeOperation = 'lighter';
    this.glowAt(cx, bot - gh * 0.28, gw * 0.85, 0.3, 0.14 + this.bass * 0.3);
    for (const ic of S.ice) {
      const s = ic.s * gw, x = cx + ic.x * gw, y = lvl + ic.y * gh * 0.28 + Math.sin(this.t * 0.8 + ic.a * 3) * gh * 0.008 * (1 + this.bass * 2);
      g.save(); g.translate(x, y); g.rotate(ic.a + Math.sin(this.t * 0.3 + ic.a) * 0.06);
      rrect(g, -s / 2, -s / 2, s, s, s * 0.18);
      g.fillStyle = 'rgba(255,255,255,0.1)'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(-s * 0.35, -s * 0.38, s * 0.5, s * 0.08);
      g.restore();
    }
    S.acc += (6 + this.energy * 55) * dt;
    while (S.acc >= 1) { S.acc--; S.bub.push({ x: cx + (Math.random() - 0.5) * bw2 * 1.7, y: bot - 4, r: 1 + Math.random() * 2.6, v: 40 + Math.random() * 80, ph: Math.random() * TAU }); }
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1;
    let n = 0;
    for (const p of S.bub) {
      p.y -= p.v * dt * (1 + this.mid * 1.2); p.x += Math.sin(this.t * 3 + p.ph) * dt * 9;
      if (p.y < surf(p.x) + 2) continue;
      S.bub[n++] = p;
      const r = p.r * (1 + this.treble * 0.8);
      g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.stroke();
    }
    S.bub.length = n;
    g.restore();
    g.globalCompositeOperation = 'source-over';
    glass(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(cx - bw2, bot - gh * 0.05, bw2 * 2, gh * 0.05);
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = gw * 0.035; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - tw * 0.8, top + gh * 0.08); g.lineTo(cx - bw2 * 0.82, bot - gh * 0.12); g.stroke();
    g.strokeStyle = this.col(0.9, 1, 8); g.lineWidth = gw * 0.05;
    g.beginPath(); g.moveTo(cx + tw * 0.15, bot - gh * 0.25); g.lineTo(cx + tw * 1.15, top - gh * 0.22); g.stroke();
    // lime wedge on the rim
    const lr = gw * 0.2;
    g.save(); g.translate(cx - tw * 0.92, top); g.rotate(-0.5);
    g.fillStyle = 'hsl(95,70%,38%)'; g.beginPath(); g.arc(0, 0, lr, Math.PI, TAU); g.fill();
    g.fillStyle = 'hsl(80,80%,70%)'; g.beginPath(); g.arc(0, 0, lr * 0.85, Math.PI, TAU); g.fill();
    g.strokeStyle = 'hsl(95,60%,45%)'; g.lineWidth = 1.5;
    for (let k = 1; k < 5; k++) { const a = Math.PI + k * Math.PI / 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * lr * 0.85, Math.sin(a) * lr * 0.85); g.stroke(); }
    g.restore();
    g.globalCompositeOperation = 'lighter';
    this.glowAt(cx, bot + gh * 0.02, gw * 0.9, 0.2, 0.16 + this.bass * 0.2);
  }

  /* Moonlit sea — moon path shimmering on spectrum-driven waves */
  s_ocean(dt) {
    // moon sits upper-right (off the center, so it never looks like a UI button)
    const { g, w, h } = this, hz = h * 0.52, cx = w * 0.78, mR = Math.min(w, h) * 0.045, my = h * 0.16;
    const S = this.st('ocean', () => ({ stars: Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random() * 0.5, s: Math.random(), p: Math.random() * TAU })) }));
    this.bg((g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, hz);
      gr.addColorStop(0, '#02030c'); gr.addColorStop(1, this.col(0.6, 1, -42));
      g.fillStyle = gr; g.fillRect(0, 0, w, hz);
      const sg = g.createLinearGradient(0, hz, 0, h);
      sg.addColorStop(0, this.col(0.6, 1, -50)); sg.addColorStop(1, '#010206');
      g.fillStyle = sg; g.fillRect(0, hz, w, h - hz);
    });
    g.globalCompositeOperation = 'lighter';
    for (const s of S.stars) {
      g.fillStyle = `rgba(255,255,255,${(0.2 + 0.6 * (0.5 + 0.5 * Math.sin(this.t * (1 + s.s * 2) + s.p))) * (0.3 + s.s * 0.7)})`;
      g.fillRect(s.x * w, s.y * h, s.s > 0.92 ? 2 : 1, s.s > 0.92 ? 2 : 1);
    }
    this.glowHSL(cx, my, mR * 7, 45, 60, 80, 0.22 + this.bass * 0.15);
    g.globalCompositeOperation = 'source-over';
    if (!this.overlay) {
      const mg = g.createRadialGradient(cx - mR * 0.35, my - mR * 0.35, mR * 0.1, cx, my, mR);
      mg.addColorStop(0, '#f6f1e2'); mg.addColorStop(1, '#bdb6a3');
      g.fillStyle = mg; g.beginPath(); g.arc(cx, my, mR, 0, TAU); g.fill();
      g.fillStyle = 'rgba(120,110,90,0.12)';
      for (const [dx, dy, r] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.35, 0.12], [0.35, -0.35, 0.1]]) {
        g.beginPath(); g.arc(cx + dx * mR, my + dy * mR, r * mR, 0, TAU); g.fill();
      }
    }
    g.globalCompositeOperation = 'lighter';
    const N = 46, b = this.bands(48);
    for (let k = 0; k < N; k++) {
      const f = (k + 1) / N, y0 = hz + (h - hz) * Math.pow(f, 1.7), amp = 2 + f * 13, step = 6 + f * 6;
      g.beginPath();
      for (let x = 0; x <= w + step; x += step) {
        const nx = x / w, v = b[Math.min(47, Math.floor(Math.abs(nx - 0.5) * 2 * 47))];
        const y = y0 + Math.sin(nx * (22 - f * 12) + this.t * (0.8 + f * 0.6) + k * 1.7) * amp * (0.35 + v * 1.3);
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.strokeStyle = this.col(0.5 + f * 0.3, 0.05 + f * 0.16, -6); g.lineWidth = 1 + f * 1.5; g.stroke();
      const spread = w * (0.015 + f * 0.13), tick = Math.floor(this.t * 3 + k * 0.37);
      for (let j = 0; j < 3 + f * 6; j++) {
        const gx = cx + (hash(k * 13 + j * 3.1 + tick) - 0.5) * 2 * spread, gw = (3 + f * 34) * (0.4 + hash(j * 7 + k));
        const a = (0.2 + this.treble * 0.7) * (1 - Math.abs(gx - cx) / spread * 0.8);
        g.fillStyle = `rgba(255,245,215,${Math.max(0, a)})`;
        g.fillRect(gx - gw / 2, y0 - 1, gw, 1 + f * 2);
      }
    }
    g.fillStyle = this.col(0.6, 0.25, 10); g.fillRect(0, hz - 0.5, w, 1);
  }

  /* Fireflies — blinking lights in a misty pine forest */
  s_fireflies(dt) {
    const { g, w, h } = this, M = Math.max(w, h);
    const S = this.st('flies', () => ({
      key: '', back: null, front: null,
      flies: Array.from({ length: 90 }, (_, i) => ({ x: Math.random(), y: 0.35 + Math.random() * 0.55, a: Math.random() * TAU, sp: 0.7 + Math.random() * 2, ph: Math.random() * TAU, t: Math.random(), b: i % 24 })),
      fog: Array.from({ length: 7 }, () => ({ x: Math.random(), y: 0.55 + Math.random() * 0.3, r: 0.3 + Math.random() * 0.3, v: (Math.random() - 0.5) * 0.015 })),
    }));
    const key = w + 'x' + h;
    if (S.key !== key) {
      S.key = key;
      const mk = (layers) => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const x = c.getContext('2d');
        for (const [base, col, scale] of layers) {
          x.fillStyle = col;
          for (let px = -60; px < w + 60; px += (25 + Math.random() * 60) * scale) {
            const th = h * (0.2 + Math.random() * 0.25) * scale, tw = th * 0.32;
            for (let tier = 0; tier < 4; tier++) {
              const ty = base - th + tier * th * 0.22, tws = tw * (0.45 + tier * 0.2);
              x.beginPath(); x.moveTo(px, ty); x.lineTo(px - tws, ty + th * 0.32); x.lineTo(px + tws, ty + th * 0.32); x.fill();
            }
            x.fillRect(px - tw * 0.06, base - th * 0.1, tw * 0.12, th * 0.12);
          }
          x.fillRect(0, base, w, h - base);
        }
        return c;
      };
      S.back = mk([[h * 0.66, '#0b1a1c', 0.8], [h * 0.76, '#061012', 1]]);
      S.front = mk([[h * 0.92, '#010304', 1.4]]);
      const x = S.front.getContext('2d');
      x.strokeStyle = '#010304'; x.lineWidth = 2;
      for (let px = 0; px < w; px += 3) { x.beginPath(); x.moveTo(px, h); x.quadraticCurveTo(px + 2, h - 10, px + (Math.random() - 0.5) * 12, h * 0.92 - Math.random() * 26); x.stroke(); }
    }
    this.bg((g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#02050a'); gr.addColorStop(0.7, this.col(0.5, 1, -50)); gr.addColorStop(1, '#010203');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      this.glowHSL(w * 0.78, h * 0.18, M * 0.25, 200, 40, 70, 0.18);
      g.globalCompositeOperation = 'source-over';
      g.drawImage(S.back, 0, 0, w, h);
    });
    const b = this.bands(24);
    g.globalCompositeOperation = 'lighter';
    for (const f of S.fog) {
      f.x += f.v * dt; if (f.x < -0.3) f.x = 1.3; else if (f.x > 1.3) f.x = -0.3;
      this.glowHSL(f.x * w, f.y * h, f.r * M, 200, 20, 60, 0.035);
    }
    for (const f of S.flies) {
      f.a += (Math.random() - 0.5) * dt * 4;
      const sp = 0.025 * (1 + this.energy);
      f.x += Math.cos(f.a) * sp * dt; f.y += Math.sin(f.a) * sp * dt * 0.6;
      if (f.x < -0.05) f.x = 1.05; else if (f.x > 1.05) f.x = -0.05;
      if (f.y < 0.3 || f.y > 0.95) f.a = -f.a;
      let br = Math.max(0, Math.sin(this.t * f.sp + f.ph));
      br = br * br * br * (0.35 + b[f.b] * 1.3);
      const x = f.x * w, y = f.y * h;
      this.glowAt(x, y, 8 + br * 22, f.t, br * 0.9);
      this.glowHSL(x, y, 2.5, 60, 100, 90, br);
    }
    g.globalCompositeOperation = 'source-over';
    if (!this.overlay) g.drawImage(S.front, 0, 0, w, h);
  }

  /* Night City — skyline whose windows light up like an equalizer */
  s_skyline(dt) {
    const { g, w, h } = this, ground = h * 0.86;
    const S = this.st('city', () => ({ key: '', blds: [], back: null, cars: [], stars: Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random() * 0.5, s: Math.random() })) }));
    const key = w + 'x' + h;
    if (S.key !== key) {
      S.key = key; S.blds = [];
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.fillStyle = '#0a0a14';
      for (let px = 0; px < w;) { const bw = 20 + Math.random() * 60, bh = h * (0.2 + Math.random() * 0.4); x.fillRect(px, ground - bh, bw, bh); px += bw; }
      S.back = c;
      let i = 0;
      for (let px = 0; px < w; i++) {
        const bw = 40 + Math.random() * 80, bh = h * (0.12 + Math.random() ** 1.5 * 0.5);
        const cols = Math.max(1, Math.floor((bw - 10) / 11)), rows = Math.max(1, Math.floor((bh - 14) / 15));
        S.blds.push({ x: px, w: bw, h: bh, cols, rows, lit: Uint8Array.from({ length: cols * rows }, () => Math.random() < 0.22), band: i % 32 });
        px += bw + 3 + Math.random() * 8;
      }
      S.cars = Array.from({ length: 14 }, () => ({ x: Math.random(), dir: Math.random() < 0.5 ? 1 : -1, v: 0.05 + Math.random() * 0.08 }));
    }
    this.bg((g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, ground);
      gr.addColorStop(0, '#03030b'); gr.addColorStop(1, this.col(0.2, 1, -40));
      g.fillStyle = gr; g.fillRect(0, 0, w, ground);
      g.fillStyle = '#030306'; g.fillRect(0, ground, w, h - ground);
      g.globalCompositeOperation = 'lighter';
      for (const s of S.stars) { g.fillStyle = `rgba(255,255,255,${0.15 + s.s * 0.4})`; g.fillRect(s.x * w, s.y * h, 1, 1); }
      this.glowHSL(w * 0.82, h * 0.15, Math.min(w, h) * 0.25, 40, 50, 80, 0.3);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#efe9da'; g.beginPath(); g.arc(w * 0.82, h * 0.15, Math.min(w, h) * 0.035, 0, TAU); g.fill();
      g.drawImage(S.back, 0, 0, w, h);
    });
    const b = this.bands(32);
    for (const B of S.blds) {
      const top = ground - B.h, v = b[B.band], litRows = v * B.rows;
      g.globalCompositeOperation = 'source-over';
      if (!this.overlay) { g.fillStyle = '#06060c'; g.fillRect(B.x, top, B.w, B.h); }
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,196,120,0.5)';
      for (let r = 0; r < B.rows; r++) for (let q = 0; q < B.cols; q++)
        if (B.lit[r * B.cols + q] && B.rows - 1 - r >= litRows) g.fillRect(B.x + 6 + q * 11, top + 8 + r * 15, 6, 8);
      for (let r = 0; r < B.rows; r++) {
        const fromBottom = B.rows - 1 - r;
        if (fromBottom >= litRows) continue;
        g.fillStyle = this.col(fromBottom / B.rows, 0.95, 5);
        for (let q = 0; q < B.cols; q++) g.fillRect(B.x + 6 + q * 11, top + 8 + r * 15, 6, 8);
      }
      if (B.h > h * 0.42) {
        g.fillStyle = '#06060c'; g.fillRect(B.x + B.w / 2 - 1, top - 24, 2, 24);
        this.glowHSL(B.x + B.w / 2, top - 24, 8 + this.beat * 10, 0, 100, 55, 0.4 + this.beat * 0.6);
      }
    }
    g.globalCompositeOperation = 'lighter';
    for (const c of S.cars) {
      c.x += c.dir * c.v * dt * (1 + this.energy);
      if (c.x > 1.1) c.x = -0.1; else if (c.x < -0.1) c.x = 1.1;
      const y = ground + (c.dir > 0 ? (h - ground) * 0.35 : (h - ground) * 0.65), x = c.x * w;
      const [hu, li] = c.dir > 0 ? [45, 85] : [0, 55];
      g.strokeStyle = `hsla(${hu},100%,${li}%,0.35)`; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - c.dir * 60, y); g.stroke();
      this.glowHSL(x, y, 7, hu, 100, li, 0.8);
    }
  }

  /* Lava lamp — soft metaballs rising and sinking */
  s_lavalamp(dt) {
    const { g, w, h } = this;
    const RH = 90, RW = Math.min(220, Math.max(40, Math.round(RH * w / h)));
    const S = this.st('lava', () => ({
      c: null, x: null, id: null,
      blobs: Array.from({ length: 9 }, (_, i) => ({ x0: 0.1 + Math.random() * 0.8, r: 0.09 + Math.random() * 0.09, sp: 0.05 + Math.random() * 0.1, ph: Math.random() * TAU, b: (i * 3) % 24 })),
    }));
    if (!S.c || S.c.width !== RW) {
      S.c = document.createElement('canvas'); S.c.width = RW; S.c.height = RH;
      S.x = S.c.getContext('2d'); S.id = S.x.createImageData(RW, RH);
    }
    const b = this.bands(24), lut = [];
    for (let i = 0; i < 64; i++) { const [hh, ss, ll] = this.pal(i / 63); lut.push(hsl2rgb(hh, ss, ll)); }
    const P = S.blobs.map((B) => {
      const v = b[B.b];
      return [(B.x0 + Math.sin(this.t * 0.17 + B.ph) * 0.07) * RW,
        (0.5 + Math.sin(this.simT * B.sp + this.t * 0.05 + B.ph) * 0.45) * RH,
        (B.r * RH * (1 + v * 0.45 + this.bass * 0.15)) ** 2];
    });
    const d = S.id.data;
    for (let y = 0; y < RH; y++) {
      const ci = Math.floor((0.15 + 0.7 * y / RH) * 63);
      for (let x = 0; x < RW; x++) {
        let f = 0;
        for (let k = 0; k < P.length; k++) { const dx = x - P[k][0], dy = y - P[k][1]; f += P[k][2] / (dx * dx + dy * dy + 1); }
        const o = (y * RW + x) * 4;
        if (f > 1) {
          const edge = Math.exp(-(f - 1) * 3) * 0.5, c = lut[Math.min(63, ci + Math.floor(Math.min(1, (f - 1) * 0.3) * 10))];
          d[o] = c[0] + (255 - c[0]) * edge; d[o + 1] = c[1] + (255 - c[1]) * edge; d[o + 2] = c[2] + (255 - c[2]) * edge; d[o + 3] = 255;
        } else {
          const c = lut[ci];
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = f * f * f * 110;
        }
      }
    }
    S.x.putImageData(S.id, 0, 0);
    this.bg((g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, this.col(0.8, 1, -56)); gr.addColorStop(1, this.col(0.2, 1, -54));
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(S.c, 0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    this.glowAt(w / 2, h * 1.05, Math.max(w, h) * 0.5, 0.1, 0.12 + this.bass * 0.2);
  }

  /* Galaxy — spiral arms with differential rotation, pulsing core */
  s_galaxy(dt) {
    const { g, w, h } = this, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.48;
    const S = this.st('galaxy', () => {
      const N = 2800, stars = [];
      for (let i = 0; i < N; i++) {
        const halo = Math.random() < 0.15, r = halo ? Math.random() : Math.pow(Math.random(), 1.5);
        const arm = i % 3;
        stars.push({ r, a: halo ? Math.random() * TAU : arm * TAU / 3 + r * 5.2 + (Math.random() - 0.5) * (0.6 - r * 0.3), s: Math.random() < 0.06 ? 2 : 1, k: Math.min(7, Math.floor(r * 8)) });
      }
      stars.sort((p, q) => p.k - q.k);
      return { stars, rot: 0, bgs: Array.from({ length: 180 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() })) };
    });
    S.rot += dt * (0.04 + this.energy * 0.22);
    this.bg((g, w, h) => {
      g.fillStyle = '#020108'; g.fillRect(0, 0, w, h);
      for (const s of S.bgs) { g.fillStyle = `rgba(255,255,255,${0.1 + s.s * 0.35})`; g.fillRect(s.x * w, s.y * h, 1, 1); }
    });
    const b = this.bands(32), tilt = 0.5 + 0.08 * Math.sin(this.t * 0.05);
    g.globalCompositeOperation = 'lighter';
    this.glowAt(cx, cy, R * 0.9, 0.4, 0.12 + this.mid * 0.1);
    let k = -1;
    for (const s of S.stars) {
      if (s.k !== k) { k = s.k; g.fillStyle = this.col(k / 7, 1, 18 - k * 2); }
      const ang = s.a + S.rot * (1.4 / Math.sqrt(s.r + 0.08));
      const v = b[Math.min(31, Math.floor(s.r * 32))];
      g.globalAlpha = Math.min(1, (0.2 + v * 0.95) * (1 - s.r * 0.45));
      g.fillRect(cx + Math.cos(ang) * s.r * R, cy + Math.sin(ang) * s.r * R * tilt, s.s, s.s);
    }
    g.globalAlpha = 1;
    this.glowAt(cx, cy, R * 0.22 * (1 + this.bass * 0.5 + this.beat * 0.2), 0.05, 0.75);
    this.glowHSL(cx, cy, R * 0.06 * (1 + this.bass), 40, 60, 92, 0.9);
  }

  /* Warp tunnel — hexagon rings rushing toward you */
  s_tunnel(dt) {
    const { g, w, h } = this, cx = w / 2, cy = h / 2, base = Math.min(w, h) * 0.07;
    const S = this.st('tunnel', () => ({
      rings: Array.from({ length: 28 }, (_, i) => ({ z: 0.05 + i / 28, k: i % 24 })),
      stars: Array.from({ length: 160 }, () => ({ a: Math.random() * TAU, z: Math.random() })),
    }));
    const sp = dt * (this.playing ? 0.16 + this.energy * 0.8 + this.beat * 0.25 : 0.03);
    for (const r of S.rings) { r.z -= sp; if (r.z <= 0.03) { r.z += 1; r.k = Math.floor(Math.random() * 24); } }
    S.rings.sort((p, q) => q.z - p.z);
    this.bg((g, w, h) => { g.fillStyle = '#020106'; g.fillRect(0, 0, w, h); });
    const ctr = (z) => [cx + Math.sin(this.t * 0.5 + z * 2.5) * w * 0.12 * z, cy + Math.cos(this.t * 0.37 + z * 2) * h * 0.1 * z];
    const b = this.bands(24);
    g.globalCompositeOperation = 'lighter';
    const [fx, fy] = ctr(1);
    this.glowAt(fx, fy, base * 4, 0.5, 0.35 + this.mid * 0.3);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1;
    g.beginPath();
    for (const s of S.stars) {
      s.z -= sp * 1.6; if (s.z <= 0.02) { s.z += 1; s.a = Math.random() * TAU; }
      const r1 = base * 3 / s.z, r2 = base * 3 / (s.z + 0.04 + sp * 3);
      g.moveTo(cx + Math.cos(s.a) * r1, cy + Math.sin(s.a) * r1); g.lineTo(cx + Math.cos(s.a) * r2, cy + Math.sin(s.a) * r2);
    }
    g.stroke();
    for (const r of S.rings) {
      const s = 1 / r.z, rad = base * s, [x, y] = ctr(r.z), v = b[r.k];
      const fade = Math.min(1, (1 - r.z) * 1.6) * Math.min(1, r.z * 12);
      const rot = this.t * 0.3 + r.z * 2.2;
      const path = () => {
        g.beginPath();
        for (let i = 0; i <= 6; i++) { const a = rot + i * TAU / 6; i ? g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad) : g.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
      };
      const lw = Math.min(14, 0.8 + s * 0.35) * (0.6 + v);
      path(); g.lineWidth = lw * 3; g.strokeStyle = this.col(r.k / 24, fade * (0.06 + v * 0.18)); g.stroke();
      path(); g.lineWidth = lw; g.strokeStyle = this.col(r.k / 24, fade * (0.25 + v * 0.75), 10); g.stroke();
    }
  }

  /* Kaleidoscope — one wedge of spectrum art mirrored 12 times */
  s_kaleido(dt) {
    const { g, w, h } = this, M = 6, R = Math.ceil(Math.hypot(w, h) / 2), WH = Math.ceil(R * Math.sin(Math.PI / M)) + 2;
    const S = this.st('kaleido', () => ({ c: null, x: null, rot: 0 }));
    if (!S.c || S.c.width !== R) { S.c = document.createElement('canvas'); S.c.width = R; S.c.height = WH; S.x = S.c.getContext('2d'); }
    const x = S.x;
    S.rot += dt * (0.05 + this.energy * 0.2);
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, R, WH);
    x.save();
    x.beginPath(); x.moveTo(0, 0); x.lineTo(R, 0); x.arc(0, 0, R, 0, Math.PI / M); x.closePath(); x.clip();
    x.globalCompositeOperation = 'lighter';
    const n = 24, b = this.bands(n), wedge = Math.PI / M;
    for (let i = 0; i < n; i++) {
      const v = b[i], r = (i + 0.5) / n * R * 0.85;
      const a = wedge * (0.5 + 0.45 * Math.sin(this.t * 0.5 + i * 0.7));
      const sz = 4 + v * R * 0.09, spr = this.sprite(i / n);
      x.globalAlpha = 0.25 + v * 0.75;
      x.drawImage(spr, Math.cos(a) * r - sz, Math.sin(a) * r - sz, sz * 2, sz * 2);
      x.globalAlpha = 0.15 + v * 0.5;
      x.strokeStyle = this.col(i / n + 0.3, 1, 5); x.lineWidth = 1 + v * 4;
      x.beginPath(); x.arc(0, 0, r, 0, wedge); x.stroke();
    }
    x.globalAlpha = 0.8; x.strokeStyle = this.col(0.7, 1, 20); x.lineWidth = 2;
    x.beginPath();
    const W = this.wave;
    for (let j = 0; j <= 120; j++) {
      const r = j / 120 * R, s = (W[Math.floor(j / 120 * (W.length - 1))] - 128) / 128;
      const a = wedge * 0.5 + s * wedge * 0.45 * this.sens;
      j ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(0, 0);
    }
    x.stroke();
    x.restore();
    x.globalAlpha = 1;
    this.bg((g, w, h) => { g.fillStyle = '#030208'; g.fillRect(0, 0, w, h); });
    g.save(); g.translate(w / 2, h / 2); g.rotate(S.rot);
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 2 * M; k++) {
      g.save();
      if (k % 2 === 0) g.rotate(k * Math.PI / M); else { g.rotate((k + 1) * Math.PI / M); g.scale(1, -1); }
      g.drawImage(S.c, 0, 0);
      g.restore();
    }
    g.restore();
    this.glowAt(w / 2, h / 2, Math.min(w, h) * 0.12 * (1 + this.bass * 0.6), 0.1, 0.5 + this.beat * 0.3);
  }

  /* ======================================================
   *  SPECTRUM LAYER (drawn on top of the scene)
   * ====================================================== */

  /* Bars — rounded bars on the bottom edge with falling peaks */
  sp_bars(dt) {
    const { g, w, h } = this, K = this.spec.size, n = this.specCount(16, 32, 96);
    const b = this.smooth(n), pk = this.peaksFor(n, b, dt);
    const base = h - 12, maxH = h * 0.3 * K, bw = w / n, gap = Math.max(2, bw * 0.3), bww = bw - gap;
    for (let i = 0; i < n; i++) {
      const bh = Math.max(3, b[i] * maxH), x = i * bw + gap / 2;
      g.fillStyle = this.col(i / n, 0.92);
      rrect(g, x, base - bh, bww, bh, Math.min(bww / 2, 4)); g.fill();
      g.fillStyle = this.col(i / n, 1, 28);
      g.fillRect(x, base - pk[i] * maxH - 6, bww, 2.5);
    }
  }

  /* Mirror — bars growing up & down from the center line, bass in the middle */
  sp_mirror() {
    const { g, w, h } = this, K = this.spec.size, n = this.specCount(18, 32, 80) & ~1, half = n / 2;
    const b = this.smooth(half), cy = h / 2, bw = w / n, gap = Math.max(2, bw * 0.3), bww = bw - gap;
    for (let i = 0; i < n; i++) {
      const k = Math.min(half - 1, Math.floor(Math.abs(i + 0.5 - half) / half * half)), v = b[k];
      const bh = 2 + v * h * 0.2 * K;
      g.fillStyle = this.col(k / half, 0.88);
      rrect(g, i * bw + gap / 2, cy - bh, bww, bh * 2, Math.min(bww / 2, 5)); g.fill();
    }
    g.fillStyle = this.col(0, 0.5, 20); g.fillRect(0, cy - 0.5, w, 1);
  }

  /* LED Blocks — segmented VU bars */
  sp_blocks(dt) {
    const { g, w, h } = this, K = this.spec.size, n = this.specCount(28, 16, 48), segs = 16;
    const b = this.smooth(n), pk = this.peaksFor(n, b, dt);
    const maxH = h * 0.32 * K, segH = maxH / segs, base = h - 12, bw = w / n, gap = Math.max(3, bw * 0.22);
    for (let s = 0; s < segs; s++) {
      g.fillStyle = this.col(s / segs, 0.95);
      for (let i = 0; i < n; i++) if (b[i] * segs > s) g.fillRect(i * bw + gap / 2, base - (s + 1) * segH + 1.5, bw - gap, segH - 3);
    }
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < n; i++) {
      const s = Math.floor(pk[i] * segs);
      if (s > 0) g.fillRect(i * bw + gap / 2, base - (s + 1) * segH + 1.5, bw - gap, segH - 3);
    }
  }

  /* Mountain — smooth filled spectrum curve with a ghost peak layer */
  sp_mountain(dt) {
    const { g, w, h } = this, K = this.spec.size, n = 48;
    const b = this.smooth(n), pk = this.peaksFor(n, b, dt), maxH = h * 0.36 * K;
    const curve = (arr) => {
      g.beginPath(); g.moveTo(0, h);
      let px = 0, py = h - 4 - arr[0] * maxH;
      g.lineTo(px, py);
      for (let i = 1; i < n; i++) {
        const x = i / (n - 1) * w, y = h - 4 - arr[i] * maxH;
        g.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
        px = x; py = y;
      }
      g.lineTo(w, py); g.lineTo(w, h); g.closePath();
    };
    curve(pk); g.fillStyle = this.col(0.8, 0.12); g.fill();
    curve(b);
    const gr = g.createLinearGradient(0, h - maxH, 0, h);
    gr.addColorStop(0, this.col(0.15, 0.75, 5)); gr.addColorStop(1, this.col(0.85, 0.06));
    g.fillStyle = gr; g.fill();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = this.col(0.2, 0.9, 20); g.lineWidth = 2; g.stroke();
  }

  /* Oscilloscope — glowing waveform across the screen */
  sp_line() {
    const { g, w, h } = this, K = this.spec.size, W = this.wave;
    let st = 0;
    for (let i = 1; i < W.length / 2; i++) if (W[i - 1] < 128 && W[i] >= 128) { st = i; break; }
    const span = Math.min(W.length - st, 1024), cy = h / 2, amp = h * 0.28 * K * this.sens;
    const gr = g.createLinearGradient(0, 0, w, 0);
    for (let k = 0; k <= 4; k++) gr.addColorStop(k / 4, this.col(k / 4, 1, 10));
    g.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const y = cy + (W[st + Math.floor(x / w * (span - 1))] - 128) / 128 * amp;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.strokeStyle = gr;
    g.lineWidth = 9; g.globalAlpha = 0.15; g.stroke();
    g.lineWidth = 2.2; g.globalAlpha = 1; g.stroke();
  }

  /* Ribbon — layered translucent sine ribbons shaped by the spectrum */
  sp_ribbon() {
    const { g, w, h } = this, K = this.spec.size, n = 32, b = this.smooth(n), cy = h / 2, L = 4;
    g.globalCompositeOperation = 'lighter';
    for (let layer = 0; layer < L; layer++) {
      const f = 1.2 + layer * 0.6, sp = 1.1 + layer * 0.45, ph = layer * 1.7, ys = [];
      for (let x = 0; x <= w + 6; x += 6) {
        const nx = x / w, env = Math.pow(Math.sin(Math.PI * Math.min(1, nx)), 2);
        const k = Math.min(n - 1, Math.floor(Math.abs(nx - 0.5) * 2 * n));
        ys.push((0.04 + b[k]) * h * 0.24 * K * env * Math.sin(nx * TAU * f + this.t * sp + ph));
      }
      g.beginPath();
      ys.forEach((y, j) => (j ? g.lineTo(j * 6, cy + y) : g.moveTo(0, cy + y)));
      for (let j = ys.length - 1; j >= 0; j--) g.lineTo(j * 6, cy - ys[j]);
      g.closePath();
      g.fillStyle = this.col(layer / L, 0.13); g.fill();
      g.strokeStyle = this.col(layer / L, 0.7, 15); g.lineWidth = 1.5; g.stroke();
    }
  }

  /* Circle — radial bars around the spinning cover art */
  sp_circle(dt) {
    const { g, w, h } = this, K = this.spec.size, S = this.specS, cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.15 * K * (1 + this.bass * 0.1 + this.beat * 0.04);
    const half = 64, n = 128, b = this.smooth(half);
    S.rot += dt * (this.playing ? 0.1 : 0.02);
    S.art += dt * (this.playing ? 0.35 : 0);
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    g.lineWidth = Math.max(2, TAU * R / n * 0.5);
    for (let i = 0; i < n; i++) {
      const k = i < half ? i : n - 1 - i, v = b[k], a = i / n * TAU - Math.PI / 2 + S.rot;
      const r0 = R * 1.1, r1 = r0 + 3 + v * R * 0.95, ca = Math.cos(a), sa = Math.sin(a);
      g.strokeStyle = this.col(k / half, 0.95);
      g.beginPath(); g.moveTo(cx + ca * r0, cy + sa * r0); g.lineTo(cx + ca * r1, cy + sa * r1); g.stroke();
    }
    if (this.beat > 0.05) {
      g.strokeStyle = this.col(0.1, this.beat * 0.45); g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, R * 1.1 + (1 - this.beat) * R * 1.3, 0, TAU); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
    const img = this.track.img;
    if (img && img.naturalWidth) {
      g.translate(cx, cy); g.rotate(S.art);
      const s = R * 2, sc = Math.max(s / img.naturalWidth, s / img.naturalHeight);
      g.drawImage(img, -img.naturalWidth * sc / 2, -img.naturalHeight * sc / 2, img.naturalWidth * sc, img.naturalHeight * sc);
    } else {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
      gr.addColorStop(0, this.col(0.2, 1, -20)); gr.addColorStop(1, '#050508');
      g.fillStyle = gr; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    }
    g.restore();
    g.strokeStyle = this.col(0.3, 0.8, 10); g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
  }

  /* Blob — organic closed spectrum shapes */
  sp_blob(dt) {
    const { g, w, h } = this, K = this.spec.size, S = this.specS, cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.17 * K, half = 48, b = this.smooth(half), pk = this.peaksFor(half, b, dt);
    S.rot += dt * (this.playing ? 0.15 : 0.02);
    const shape = (arr, amt, rot) => {
      const N = 96, P = [];
      for (let j = 0; j < N; j++) {
        const k = j < half ? j : N - 1 - j, r = R * (1 + arr[k] * amt), a = j / N * TAU + rot;
        P.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      g.beginPath();
      g.moveTo((P[N - 1][0] + P[0][0]) / 2, (P[N - 1][1] + P[0][1]) / 2);
      for (let j = 0; j < N; j++) { const q = P[(j + 1) % N]; g.quadraticCurveTo(P[j][0], P[j][1], (P[j][0] + q[0]) / 2, (P[j][1] + q[1]) / 2); }
      g.closePath();
    };
    g.globalCompositeOperation = 'lighter';
    shape(pk, 0.9 * K, S.rot); g.fillStyle = this.col(0.8, 0.08); g.fill(); g.strokeStyle = this.col(0.8, 0.35); g.lineWidth = 1.5; g.stroke();
    shape(b, 0.9 * K, S.rot); g.fillStyle = this.col(0.2, 0.16); g.fill(); g.strokeStyle = this.col(0.2, 0.95, 15); g.lineWidth = 2.2; g.stroke();
    shape(b, 0.45 * K, -S.rot * 1.3); g.strokeStyle = this.col(0.5, 0.55); g.lineWidth = 1.5; g.stroke();
  }

  /* Dots — columns of glowing dots */
  sp_dots() {
    const { g, w, h } = this, K = this.spec.size, n = this.specCount(22, 24, 72), rows = 14;
    const b = this.smooth(n), bw = w / n, stepY = h * 0.3 * K / rows, r = Math.min(bw * 0.3, stepY * 0.38), base = h - 14 - r;
    for (let s = 0; s < rows; s++) {
      g.fillStyle = this.col(s / rows, 1, 5);
      g.beginPath();
      const y = base - s * stepY;
      for (let i = 0; i < n; i++) if (b[i] * rows > s) { const x = i * bw + bw / 2; g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); }
      g.fill();
    }
  }

  /* Sides — horizontal bars from both screen edges, bass at the bottom */
  sp_sides() {
    const { g, w, h } = this, K = this.spec.size, n = Math.max(24, Math.min(64, Math.floor(h / 16)));
    const b = this.smooth(n), rowH = h / n, gap = Math.max(2, rowH * 0.3), maxL = w * 0.2 * K;
    for (let i = 0; i < n; i++) {
      const len = 2 + b[i] * maxL, y = h - (i + 1) * rowH + gap / 2, rr = Math.min((rowH - gap) / 2, 4);
      g.fillStyle = this.col(i / n, 0.9);
      rrect(g, 0, y, len, rowH - gap, rr); g.fill();
      rrect(g, w - len, y, len, rowH - gap, rr); g.fill();
    }
  }

  /* Arc — half-circle sunrise of rays from the bottom center */
  sp_arc() {
    const { g, w, h } = this, K = this.spec.size, cx = w / 2, cy = h - 6, R = Math.min(w, h) * 0.22 * K;
    const half = 48, n = 96, b = this.smooth(half);
    g.globalCompositeOperation = 'lighter';
    this.glowAt(cx, cy, R * 1.1, 0.3, 0.22 + this.bass * 0.3);
    g.lineCap = 'round'; g.lineWidth = Math.max(2, Math.PI * R / n * 0.55);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, a = Math.PI + t * Math.PI, k = Math.min(half - 1, Math.floor(Math.abs(t - 0.5) * 2 * half));
      const v = b[k], r1 = R + 3 + v * R * 1.1, ca = Math.cos(a), sa = Math.sin(a);
      g.strokeStyle = this.col(k / half, 0.95);
      g.beginPath(); g.moveTo(cx + ca * R, cy + sa * R); g.lineTo(cx + ca * r1, cy + sa * r1); g.stroke();
    }
    g.strokeStyle = this.col(0.4, 0.6, 10); g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, R * 0.92, Math.PI, TAU); g.stroke();
  }

  /* Sparks — thin bars that throw sparks from their tips */
  sp_sparks(dt) {
    const { g, w, h } = this, K = this.spec.size, n = this.specCount(14, 40, 110), S = this.specS;
    const b = this.smooth(n), base = h - 12, maxH = h * 0.28 * K, bw = w / n;
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    g.lineWidth = Math.max(1.5, bw * 0.35);
    for (let i = 0; i < n; i++) {
      const v = b[i], x = i * bw + bw / 2, top = base - 3 - v * maxH;
      g.strokeStyle = this.col(i / n, 0.85);
      g.beginPath(); g.moveTo(x, base); g.lineTo(x, top); g.stroke();
      if (Math.random() < v * v * dt * 14) S.sparks.push({ x, y: top, vx: (Math.random() - 0.5) * 40, vy: -(80 + v * 280), life: 1, t: i / n });
    }
    if (S.sparks.length > 600) S.sparks.splice(0, S.sparks.length - 600);
    let m = 0;
    for (const p of S.sparks) {
      p.vy += dt * 280; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 0.9;
      if (p.life <= 0 || p.y > h) continue;
      S.sparks[m++] = p;
      this.glowAt(p.x, p.y, 3 + p.life * 5, p.t, p.life);
    }
    S.sparks.length = m;
  }

  /* ======================================================
   *  NIGHTCLUB SPECTRA (full-screen)
   * ====================================================== */
  strobeFlash(k = 1) {
    if (!this.strobe || this.beat < 0.75 || this.energy < 0.45) return;
    const g = this.g;
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = `rgba(255,255,255,${(this.beat - 0.75) * 4 * 0.13 * this.strobe * k})`;
    g.fillRect(0, 0, this.w, this.h);
  }
  // 3-pass neon stroke of the current path builder
  tube(build, t, a, lw, white) {
    const g = this.g;
    if (a < 0.015) return;
    build(); g.lineWidth = lw * 3.5; g.strokeStyle = this.col(t, a * 0.16); g.stroke();
    build(); g.lineWidth = lw; g.strokeStyle = white ? `rgba(255,255,255,${Math.min(1, a)})` : this.col(t, Math.min(1, a), 12); g.stroke();
    build(); g.lineWidth = Math.max(0.6, lw * 0.3); g.strokeStyle = `rgba(255,255,255,${Math.min(1, a) * 0.7})`; g.stroke();
  }

  /* Neon Tunnel — chamfered neon frames rushing at you, LED rails, light pulses, strobe chase */
  sp_clubtunnel(dt) {
    const { g, w, h } = this, K = this.spec.size;
    const S = this.st('sp_tunnel', () => ({
      fr: Array.from({ length: 22 }, (_, i) => ({ z: (i + 0.5) / 22, k: i })), next: 22,
      pulses: Array.from({ length: 28 }, () => ({ z: Math.random(), e: Math.floor(Math.random() * 8) })),
    }));
    const cx = w / 2 + Math.sin(this.t * 0.3) * w * 0.03, cy = h / 2 + Math.cos(this.t * 0.23) * h * 0.03;
    const speed = this.playing ? 0.22 + this.energy * 0.8 + this.beat * 0.3 : 0.03;
    for (const f of S.fr) { f.z -= dt * speed; if (f.z <= 0) { f.z += 1; f.k = S.next++; } }
    S.fr.sort((a, b) => b.z - a.z);
    const near = 0.12, P = (z) => near / (z + near);
    const corners = (hw, hh) => {
      const c = Math.min(hw, hh) * 0.22;
      return [[-hw + c, -hh], [hw - c, -hh], [hw, -hh + c], [hw, hh - c], [hw - c, hh], [-hw + c, hh], [-hw, hh - c], [-hw, -hh + c]];
    };
    const b = this.smooth(24);
    g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.lineCap = 'round';
    this.glowAt(cx, cy, Math.min(w, h) * 0.4, (this.t * 0.05) % 1, 0.22 + this.mid * 0.35);
    // rails along the chamfer corners
    const p0 = corners(w * 0.6, h * 0.6);
    for (let e = 0; e < 8; e++) {
      const [px, py] = p0[e], gr = g.createLinearGradient(cx + px, cy + py, cx, cy);
      gr.addColorStop(0, this.col(e / 8, 0.55, 10)); gr.addColorStop(1, this.col(e / 8, 0));
      g.strokeStyle = gr; g.lineWidth = 2 * K;
      g.beginPath(); g.moveTo(cx + px, cy + py); g.lineTo(cx, cy); g.stroke();
    }
    for (const p of S.pulses) {
      p.z -= dt * speed * 1.7;
      if (p.z <= 0) { p.z += 1; p.e = Math.floor(Math.random() * 8); }
      const s = P(p.z), [px, py] = p0[p.e];
      this.glowAt(cx + px * s, cy + py * s, (5 + (1 - p.z) * 18) * K, p.e / 8, (1 - p.z) * 0.9);
    }
    // frames, far → near
    for (const f of S.fr) {
      const s = P(f.z), pts = corners(w * 0.6 * s, h * 0.6 * s);
      const v = b[f.k % 24], chase = (f.k + this.beatCount) % 4 === 0 ? 1 : 0;
      const a = (0.22 + v * 0.8 + chase * 0.35) * Math.min(1, f.z / 0.05) * Math.min(1, (1 - f.z) / 0.3);
      const t = (f.k * 0.07 + this.t * 0.05) % 1;
      const white = this.strobe > 0 && chase && this.beat > 0.6;
      this.tube(() => {
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(cx + x, cy + y) : g.moveTo(cx + x, cy + y)));
        g.closePath();
      }, t, a, (1 + s * 9) * K, white);
    }
    this.strobeFlash();
  }

  /* LED Floor — club dance floor + ceiling panels in perspective, EQ on the floor */
  sp_ledfloor(dt) {
    const { g, w, h } = this, K = this.spec.size;
    const S = this.st('sp_floor', () => ({ ph: 0 }));
    S.ph += dt * (this.playing ? 0.7 + this.energy * 2.4 : 0.08);
    const cx = w / 2, cy = h * 0.5, C = 12, R = 13, half = this.smooth(6);
    const frac = S.ph % 1, base = Math.floor(S.ph), ins = 0.07;
    const yAt = (d, sg) => cy + sg * h * 0.5 / d;
    const xAt = (X, d) => cx + X * (w * 0.5 * 1.25 * K) / d / (C / 2);
    g.globalCompositeOperation = 'lighter';
    for (const sg of [1, -1]) {
      for (let j = R - 1; j >= 0; j--) {
        const d0 = Math.max(0.3, 1 + j - frac), d1 = d0 + 1, row = base + j;
        const fade = 1 / (1 + (d0 - 1) * 0.28);
        const y0 = yAt(d0 + ins, sg), y1 = yAt(d1 - ins, sg);
        for (let c = 0; c < C; c++) {
          const k = Math.min(5, Math.floor(Math.abs(c + 0.5 - C / 2) / (C / 2) * 6)), v = half[k];
          let a;
          if (sg > 0) {
            a = j < v * R * 1.1 ? 0.85 - j / R * 0.4 : 0.035;
            if ((c + row) % 2 === 0) a += this.beat * 0.25;
          } else {
            a = hash(c * 7.1 + row * 13.3 + Math.floor(this.beatCount / 2) * 3.7) > 0.62 ? 0.25 + this.energy * 0.6 : 0.03;
          }
          a *= fade;
          if (a < 0.02) continue;
          const X0 = c - C / 2 + ins, X1 = c - C / 2 + 1 - ins;
          g.beginPath();
          g.moveTo(xAt(X0, d0 + ins), y0); g.lineTo(xAt(X1, d0 + ins), y0);
          g.lineTo(xAt(X1, d1 - ins), y1); g.lineTo(xAt(X0, d1 - ins), y1); g.closePath();
          g.fillStyle = this.col(sg > 0 ? c / C : 1 - c / C, Math.min(1, a), 5);
          g.fill();
        }
      }
    }
    const gr = g.createLinearGradient(0, cy - h * 0.06, 0, cy + h * 0.06);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, this.col(0.5, 0.35 + this.mid * 0.4, 15)); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, cy - h * 0.06, w, h * 0.12);
    this.strobeFlash();
  }

  /* LED Tubes — vertical light tubes with chase / strobe / EQ patterns + glossy floor reflection */
  sp_tubes(dt) {
    const { g, w, h } = this, K = this.spec.size, N = Math.max(12, Math.min(28, Math.floor(w / 60)));
    const b = this.smooth(N);
    const S = this.st('sp_tubes', () => ({ pat: 0, beat: 0, ph: 0 }));
    if (S.beat !== this.beatCount) { S.beat = this.beatCount; if (this.beatCount % 8 === 0) S.pat = (S.pat + 1) % 4; }
    S.ph += dt * (this.playing ? 1 + this.energy * 2 : 0.2);
    const top = h * 0.1, bot = h * 0.78, L = bot - top, gap = w / N, lw = Math.max(2, gap * 0.11) * K;
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (let i = 0; i < N; i++) {
      const x = gap * (i + 0.5), kk = Math.min(N - 1, Math.floor(Math.abs(i + 0.5 - N / 2) / (N / 2) * N)), v = b[kk], t = i / N;
      g.lineWidth = lw; g.strokeStyle = 'rgba(255,255,255,0.05)';
      g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke();
      let y0, y1, a;
      switch (S.pat) {
        case 0: { const m = (top + bot) / 2, hl = L * 0.5 * v; y0 = m - hl; y1 = m + hl; a = 0.4 + v * 0.6; break; }
        case 1: { const p = (S.ph * 0.6 + i * 0.07) % 1, y = top + p * L; y0 = Math.max(top, y - L * 0.14); y1 = Math.min(bot, y + L * 0.03); a = 0.3 + v * 0.9; break; }
        case 2: { const on = (i + this.beatCount) % 2 === 0; y0 = top; y1 = bot; a = on ? (0.25 + v * 0.75) * (0.4 + this.beat * 0.6) : 0.04; break; }
        default: { y0 = bot - L * (0.12 + 0.88 * v); y1 = bot; a = (0.5 + 0.5 * Math.sin(S.ph * 2 + i * 0.6)) * (0.3 + v * 0.7); }
      }
      if (y1 - y0 > 1) {
        const white = S.pat === 2 && this.strobe > 0.5 && this.beat > 0.7;
        this.tube(() => { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); }, t, a, lw, white);
        const r0 = 2 * bot - y1, r1 = Math.min(h, 2 * bot - y0);
        if (r1 > r0) this.tube(() => { g.beginPath(); g.moveTo(x, r0 + lw); g.lineTo(x, r1); }, t, a * 0.2, lw, false);
      }
    }
    g.fillStyle = this.col(0.5, 0.18, 10); g.fillRect(0, bot + lw * 0.5, w, 1);
    this.strobeFlash(0.8);
  }

  /* Neon Portal — nested neon shapes zooming out of the center, light rays */
  sp_portal(dt) {
    const { g, w, h } = this, K = this.spec.size, cx = w / 2, cy = h / 2, M = Math.hypot(w, h) * 0.6;
    const S = this.st('sp_portal', () => ({ ph: 0, shape: 0, beat: 0, rot: 0 }));
    if (S.beat !== this.beatCount) { S.beat = this.beatCount; if (this.beatCount % 8 === 0) S.shape = (S.shape + 1) % 4; }
    S.ph += dt * (this.playing ? 0.12 + this.energy * 0.45 : 0.02);
    S.rot += dt * (0.15 + this.mid * 0.6);
    const N = 16, b = this.smooth(N), sides = [4, 3, 6, 0][S.shape];
    g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round';
    g.lineWidth = 1;
    for (let r = 0; r < 24; r++) {
      const a = r / 24 * TAU + S.rot * 0.4;
      g.strokeStyle = this.col(r / 24, 0.05 + this.treble * 0.15);
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * M, cy + Math.sin(a) * M); g.stroke();
    }
    this.glowAt(cx, cy, Math.min(w, h) * 0.25 * (1 + this.bass * 0.5), 0.1, 0.4 + this.beat * 0.3);
    for (let k = 0; k < N; k++) {
      const u = (k / N + S.ph) % 1, s = Math.pow(u, 2.2), rad = 6 + s * M;
      const a = (0.2 + b[k] * 0.9) * Math.min(1, u * 6);
      const rot = S.rot * (k % 2 ? 1 : -1) + k * 0.2;
      const t = (k / N + this.t * 0.04) % 1;
      const white = this.strobe > 0 && k % 3 === this.beatCount % 3 && this.beat > 0.65;
      this.tube(() => {
        g.beginPath();
        if (!sides) g.arc(cx, cy, rad, 0, TAU);
        else for (let i = 0; i <= sides; i++) {
          const q = rot + i * TAU / sides;
          i ? g.lineTo(cx + Math.cos(q) * rad, cy + Math.sin(q) * rad) : g.moveTo(cx + Math.cos(q) * rad, cy + Math.sin(q) * rad);
        }
        g.closePath();
      }, t, a, (1 + s * 8) * K, white);
    }
    this.strobeFlash();
  }

  /* Chrome Tunnel — 8-fold biomechanical tunnel: neon octagon rings with spikes,
   * curved liquid-chrome arms with pink specular streaks, infinite zoom */
  sp_biotunnel(dt) {
    const { g, w, h } = this, K = this.spec.size, cx = w / 2, cy = h / 2, M = Math.hypot(w, h) / 2;
    const S = this.st('sp_bio', () => ({ ph: 0, rot: 0 }));
    S.ph += dt * (this.playing ? 0.1 + this.energy * 0.45 + this.beat * 0.12 : 0.015);
    S.rot += dt * (0.04 + this.mid * 0.15);
    const Z = 1.9, base = 5 * K, b = this.smooth(8), frac = S.ph % 1;
    const L = Math.ceil(Math.log((M * 1.8) / base) / Math.log(Z)) + 1;
    g.globalCompositeOperation = 'lighter';
    this.glowAt(cx, cy, Math.min(w, h) * 0.16, 0.02, 0.2 + this.bass * 0.35);
    for (let k = 0; k < L; k++) {
      const e = k + frac, s = base * Math.pow(Z, e);
      const a = Math.min(1, e / 1.6) * Math.max(0, Math.min(1, (M * 1.9 - s) / (M * 0.7)));
      if (a > 0.01) this._bioLayer(cx, cy, s, S.rot + e * 0.39, a, b);
    }
    this.strobeFlash(0.6);
  }

  _bioLayer(cx, cy, s, rot, a, b) {
    const g = this.g, W = s * 0.24, R0 = s * 0.95, R1 = s * 2.7, bend = 0.5 + this.mid * 0.5;
    g.lineCap = 'round'; g.lineJoin = 'round';
    // chrome arms
    for (let i = 0; i < 8; i++) {
      const th = rot + i * TAU / 8 + TAU / 16, dir = i % 2 ? 1 : -1, pts = [];
      for (let j = 0; j <= 10; j++) {
        const u = j / 10, r = R0 + (R1 - R0) * u;
        const an = th + dir * bend * Math.sin(u * Math.PI * 0.85) * 0.6 + Math.sin(this.t * 0.6 + i + u * 3) * 0.06;
        pts.push([cx + Math.cos(an) * r, cy + Math.sin(an) * r, an]);
      }
      const path = (off) => {
        g.beginPath();
        for (let j = 0; j < pts.length; j++) {
          const [x, y, an] = pts[j], ox = -Math.sin(an) * off, oy = Math.cos(an) * off;
          j ? g.lineTo(x + ox, y + oy) : g.moveTo(x + ox, y + oy);
        }
      };
      g.globalCompositeOperation = 'source-over';
      path(0); g.lineWidth = W; g.strokeStyle = `rgba(8,8,20,${a})`; g.stroke();
      path(-W * 0.12); g.lineWidth = W * 0.62; g.strokeStyle = `rgba(44,46,90,${a})`; g.stroke();
      path(-W * 0.2); g.lineWidth = W * 0.24; g.strokeStyle = `rgba(112,118,196,${a * 0.75})`; g.stroke();
      g.globalCompositeOperation = 'lighter';
      path(W * 0.36); g.lineWidth = Math.max(1, W * 0.09); g.strokeStyle = this.col(0.95, a * (0.5 + this.treble * 0.5), 14); g.stroke();
      path(-W * 0.32); g.lineWidth = Math.max(0.7, W * 0.045); g.strokeStyle = `rgba(255,255,255,${a * 0.45})`; g.stroke();
      // liquid-metal squiggle reflections flowing along the arm
      g.lineWidth = Math.max(0.8, W * 0.07);
      g.strokeStyle = this.col(0.9, a * (0.35 + this.treble * 0.65), 20);
      for (let q = 0; q < 3; q++) {
        const u = (q / 3 + this.t * 0.12 + i * 0.13) % 1, p = pts[Math.min(9, Math.floor(u * 10))];
        const tx = Math.cos(p[2]), ty = Math.sin(p[2]), nx = -ty, ny = tx, len = W * 1.5;
        g.beginPath();
        for (let m = 0; m <= 8; m++) {
          const v = m / 8 - 0.5, sw = Math.sin(m / 8 * TAU + this.t * 4 + q * 2) * W * 0.22 + W * 0.12;
          const x = p[0] + tx * v * len + nx * sw, y = p[1] + ty * v * len + ny * sw;
          m ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
      }
    }
    // green spikes from the octagon vertices
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) {
      const th = rot + i * TAU / 8, v = b[i], len = s * (0.3 + v * 0.65), wd = s * 0.15;
      const bx = cx + Math.cos(th) * s, by = cy + Math.sin(th) * s, px = -Math.sin(th) * wd, py = Math.cos(th) * wd;
      g.beginPath();
      g.moveTo(bx + px, by + py); g.lineTo(cx + Math.cos(th) * (s + len), cy + Math.sin(th) * (s + len)); g.lineTo(bx - px, by - py);
      g.closePath();
      g.fillStyle = this.col(0.02, a * (0.22 + v * 0.55), 6); g.fill();
    }
    // neon octagon ring + thin outer circle
    this.tube(() => {
      g.beginPath();
      for (let i = 0; i <= 8; i++) {
        const th = rot + i * TAU / 8;
        i ? g.lineTo(cx + Math.cos(th) * s, cy + Math.sin(th) * s) : g.moveTo(cx + Math.cos(th) * s, cy + Math.sin(th) * s);
      }
      g.closePath();
    }, 0.02, a * (0.5 + this.bass * 0.6), Math.max(1, s * 0.07));
    g.lineWidth = Math.max(0.7, s * 0.012);
    g.strokeStyle = this.col(0.05, a * 0.55, 5);
    g.beginPath(); g.arc(cx, cy, s * 1.38, 0, TAU); g.stroke();
  }

  /* ======================================================
   *  VJ TUNNELS
   * ====================================================== */

  /* Hex Wormhole — honeycomb cells lining a tunnel, lit by the spectrum in travelling waves */
  sp_hexworm(dt) {
    const { g, w, h } = this, K = this.spec.size;
    const S = this.st('sp_hex', () => ({ ph: 0, rot: 0 }));
    S.ph += dt * (this.playing ? 0.6 + this.energy * 2.2 + this.beat * 0.6 : 0.06);
    S.rot += dt * (0.05 + this.mid * 0.2);
    const cx = w / 2 + Math.sin(this.t * 0.4) * w * 0.04, cy = h / 2 + Math.cos(this.t * 0.31) * h * 0.04;
    const Rk = Math.min(w, h) * 0.42 * K, N = 16, ROWS = 18, dd = 0.5, da = TAU / N;
    const frac = S.ph % 1, base = Math.floor(S.ph), b = this.smooth(N / 2);
    const P = (a, d) => [cx + Math.cos(a) * Rk / d, cy + Math.sin(a) * Rk / d];
    g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round';
    this.glowAt(cx, cy, Math.min(w, h) * 0.22, 0.5, 0.3 + this.mid * 0.3);
    for (let j = ROWS - 1; j >= 0; j--) {
      const d = 0.45 + (j + 1 - frac) * dd, wid = j + base;
      const fade = Math.min(1, (d - 0.45) / 0.35) * Math.max(0, 1 - (d - 0.45) / (ROWS * dd));
      if (fade <= 0.01) continue;
      const off = (wid % 2) * da * 0.5;
      for (let i = 0; i < N; i++) {
        const ac = S.rot + i * da + off + d * 0.15;
        const v = b[Math.min(N / 2 - 1, i < N / 2 ? i : N - 1 - i)];
        const wave = 0.5 + 0.5 * Math.sin(wid * 0.9 - this.t * 3 + i * 0.4);
        const a = fade * (0.05 + v * 0.8 * wave + ((wid + i) % 7 === 0 ? this.beat * 0.6 : 0));
        const t = (i / N + wid * 0.03) % 1;
        g.beginPath();
        for (let c = 0; c < 6; c++) {
          const q = c / 6 * TAU + TAU / 12;
          const [x, y] = P(ac + Math.cos(q) * da * 0.46, d + Math.sin(q) * dd * 0.58);
          c ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.closePath();
        g.fillStyle = this.col(t, a * 0.5); g.fill();
        g.strokeStyle = this.col(t, Math.min(1, fade * 0.25 + a), 12);
        g.lineWidth = Math.max(0.6, 1.4 / d); g.stroke();
      }
    }
    this.strobeFlash(0.6);
  }

  /* Mandala Zoom — infinite zoom through nested neon flower mandalas */
  sp_mandala(dt) {
    const { g, w, h } = this, K = this.spec.size, cx = w / 2, cy = h / 2, M = Math.hypot(w, h) / 2;
    const S = this.st('sp_mandala', () => ({ ph: 0, rot: 0 }));
    S.ph += dt * (this.playing ? 0.08 + this.energy * 0.35 + this.beat * 0.08 : 0.01);
    S.rot += dt * (0.05 + this.mid * 0.2);
    const Z = 1.55, base = 6 * K, frac = S.ph % 1, fl = Math.floor(S.ph), b = this.smooth(12);
    const L = Math.ceil(Math.log((M * 1.7) / base) / Math.log(Z)) + 1;
    g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.lineCap = 'round';
    this.glowAt(cx, cy, Math.min(w, h) * 0.15, 0.1, 0.35 + this.bass * 0.3);
    for (let k = 0; k < L; k++) {
      const e = k + frac, s = base * Math.pow(Z, e);
      const a = Math.min(1, e / 1.5) * Math.max(0, Math.min(1, (M * 1.8 - s) / (M * 0.6)));
      if (a < 0.01) continue;
      const id = k - fl, P = [8, 12, 16][((id % 3) + 3) % 3], v = b[((id % 12) + 12) % 12];
      const rot = S.rot * (id % 2 ? 1 : -1) + e * 0.25, t = (((id * 0.13) % 1) + 1) % 1;
      const r0 = s * 0.55, r1 = s * (1.12 + v * 0.3), wd = TAU / P * 0.42, rm = (r0 + r1) / 2 * 1.05;
      this.tube(() => {
        g.beginPath();
        for (let p = 0; p < P; p++) {
          const th = rot + p * TAU / P, ax = cx + Math.cos(th) * r0, ay = cy + Math.sin(th) * r0;
          const tx = cx + Math.cos(th) * r1, ty = cy + Math.sin(th) * r1;
          g.moveTo(ax, ay);
          g.quadraticCurveTo(cx + Math.cos(th - wd) * rm, cy + Math.sin(th - wd) * rm, tx, ty);
          g.quadraticCurveTo(cx + Math.cos(th + wd) * rm, cy + Math.sin(th + wd) * rm, ax, ay);
        }
      }, t, a * (0.3 + v * 0.75), Math.max(0.8, s * 0.022));
      const dr = Math.max(0.8, s * 0.022);
      g.fillStyle = this.col(t + 0.3, a * (0.4 + v * 0.6), 20);
      g.beginPath();
      for (let p = 0; p < P; p++) {
        const th = rot + (p + 0.5) * TAU / P, x = cx + Math.cos(th) * s * 0.5, y = cy + Math.sin(th) * s * 0.5;
        g.moveTo(x + dr, y); g.arc(x, y, dr, 0, TAU);
      }
      g.fill();
      g.strokeStyle = this.col(t + 0.5, a * 0.35); g.lineWidth = Math.max(0.6, s * 0.008);
      g.beginPath(); g.arc(cx, cy, s * 0.44, 0, TAU); g.stroke();
    }
    this.strobeFlash(0.5);
  }

  /* Spiral Vortex — counter-rotating log spirals sucked into a black hole */
  sp_vortex(dt) {
    const { g, w, h } = this, K = this.spec.size, cx = w / 2, cy = h / 2, M = Math.hypot(w, h) / 2;
    const A = 10;
    const S = this.st('sp_vortex', () => ({ rot: 0, dots: Array.from({ length: 180 }, () => ({ u: Math.random(), arm: Math.floor(Math.random() * 10) })) }));
    S.rot += dt * (this.playing ? 0.35 + this.energy * 1.1 : 0.05);
    const b = this.smooth(A), rmin = 6, rmax = M * 1.1, twist = 1.1 * K;
    const pt = (arm, u, dir) => {
      const r = rmin * Math.pow(rmax / rmin, u);
      const th = arm * TAU / A + dir * (S.rot + twist * Math.log(r / rmin));
      return [cx + Math.cos(th) * r, cy + Math.sin(th) * r, r];
    };
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const dir of [-1, 1]) {
      for (let arm = 0; arm < A; arm++) {
        const v = b[arm], a = dir > 0 ? 0.25 + v * 0.75 : 0.1 + v * 0.25, t = (arm / A + (dir < 0 ? 0.5 : 0)) % 1;
        for (let c = 0; c < 6; c++) {
          g.beginPath();
          for (let q = 0; q <= 10; q++) {
            const [x, y] = pt(arm, (c + q / 10) / 6, dir);
            q ? g.lineTo(x, y) : g.moveTo(x, y);
          }
          const rMid = rmin * Math.pow(rmax / rmin, (c + 0.5) / 6);
          const lw = (1 + rMid * 0.012) * (dir > 0 ? 1 : 0.6);
          const fa = a * Math.min(1, c / 1.5 + 0.15);
          g.lineWidth = lw * 3; g.strokeStyle = this.col(t, fa * 0.15); g.stroke();
          g.lineWidth = lw; g.strokeStyle = this.col(t, fa, 12); g.stroke();
        }
      }
    }
    for (const d of S.dots) {
      d.u -= dt * (this.playing ? 0.06 + this.energy * 0.25 : 0.01);
      if (d.u < 0.02) { d.u = 1; d.arm = Math.floor(Math.random() * A); }
      const [x, y, r] = pt(d.arm, d.u, 1);
      this.glowAt(x, y, 2 + r * 0.02, d.arm / A, (0.35 + b[d.arm] * 0.65) * Math.min(1, d.u * 4));
    }
    const hr = Math.min(w, h) * 0.06 * (1 + this.bass * 0.35);
    g.globalCompositeOperation = 'source-over';
    const hg = g.createRadialGradient(cx, cy, 0, cx, cy, hr * 1.6);
    hg.addColorStop(0, 'rgba(0,0,0,1)'); hg.addColorStop(0.6, 'rgba(0,0,0,0.95)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hg; g.beginPath(); g.arc(cx, cy, hr * 1.6, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter';
    this.tube(() => { g.beginPath(); g.arc(cx, cy, hr, 0, TAU); }, 0.1, 0.5 + this.bass * 0.5, 2.5);
    this.strobeFlash(0.5);
  }

  /* Cyber Rings — sci-fi HUD tunnel: segmented arcs spinning at their own speeds */
  sp_cyberrings(dt) {
    const { g, w, h } = this, K = this.spec.size, cx = w / 2, cy = h / 2, M = Math.hypot(w, h) / 2;
    const S = this.st('sp_cyber', () => ({ ph: 0 }));
    S.ph += dt * (this.playing ? 0.12 + this.energy * 0.5 + this.beat * 0.1 : 0.015);
    const Z = 1.32, base = 8 * K, frac = S.ph % 1, fl = Math.floor(S.ph), b = this.smooth(16);
    const L = Math.ceil(Math.log((M * 1.5) / base) / Math.log(Z)) + 1;
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'butt';
    this.glowAt(cx, cy, Math.min(w, h) * 0.2, 0.6, 0.25 + this.mid * 0.3);
    for (let k = 0; k < L; k++) {
      const e = k + frac, s = base * Math.pow(Z, e);
      const a = Math.min(1, e / 2) * Math.max(0, Math.min(1, (M * 1.4 - s) / (M * 0.5)));
      if (a < 0.01) continue;
      const id = k - fl;
      const segs = 4 + Math.floor(hash(id * 1.3) * 20), gapR = 0.12 + hash(id * 2.7) * 0.5;
      const spd = (hash(id * 3.1) - 0.5) * 1.8, thick = hash(id * 4.9) > 0.72 ? s * 0.05 : s * 0.012;
      const flash = (id + this.beatCount) % 5 === 0 ? this.beat * 0.6 : 0;
      const rot = spd * this.t + id, t = (hash(id * 6.1) * 0.6 + this.t * 0.02) % 1;
      for (let q = 0; q < segs; q++) {
        const st = rot + q * TAU / segs, len = TAU / segs * (1 - gapR);
        const v = b[(((q + id) % 16) + 16) % 16], aa = a * (0.15 + v * 0.85 + flash);
        g.beginPath(); g.arc(cx, cy, s, st, st + len);
        g.lineWidth = Math.max(1, thick) * 3; g.strokeStyle = this.col(t, aa * 0.15); g.stroke();
        g.lineWidth = Math.max(0.8, thick); g.strokeStyle = flash > 0.3 ? `rgba(255,255,255,${Math.min(1, aa)})` : this.col(t, Math.min(1, aa), 12); g.stroke();
      }
      if (hash(id * 5.3) > 0.7) {
        g.strokeStyle = this.col(t + 0.2, a * 0.4); g.lineWidth = 1;
        g.beginPath();
        for (let q = 0; q < 72; q++) {
          const th = -rot * 0.5 + q * TAU / 72, r2 = s * (q % 6 ? 0.96 : 0.92);
          g.moveTo(cx + Math.cos(th) * s * 0.99, cy + Math.sin(th) * s * 0.99); g.lineTo(cx + Math.cos(th) * r2, cy + Math.sin(th) * r2);
        }
        g.stroke();
      }
    }
    this.strobeFlash(0.6);
  }

  /* Wire Tunnel — flying through a bending wireframe tube deformed by the spectrum */
  sp_wiretube(dt) {
    const { g, w, h } = this, K = this.spec.size, cx = w / 2, cy = h / 2;
    const S = this.st('sp_wire', () => ({ ph: 0, rot: 0 }));
    S.ph += dt * (this.playing ? 0.8 + this.energy * 2.5 + this.beat * 0.5 : 0.08);
    S.rot += dt * (0.08 + this.mid * 0.3);
    const RINGS = 20, NP = 28, frac = S.ph % 1, base = Math.floor(S.ph), b = this.smooth(14);
    const Rk = Math.min(w, h) * 0.34 * K;
    const ox = (z) => Math.sin(z * 0.35) * 1.1 + Math.sin(z * 0.13) * 0.7, oy = (z) => Math.cos(z * 0.27) * 0.8;
    const camX = ox(S.ph), camY = oy(S.ph), rings = [];
    for (let j = 0; j < RINGS; j++) {
      const d = Math.max(0.22, j + 1 - frac), zw = S.ph + d, wid = base + j;
      const ccx = cx + (ox(zw) - camX) * Rk / d * 0.8, ccy = cy + (oy(zw) - camY) * Rk / d * 0.8;
      const pts = [];
      for (let i = 0; i < NP; i++) {
        const k = Math.min(13, Math.floor(Math.abs(i + 0.5 - NP / 2) / (NP / 2) * 14));
        const r = Rk / d * (1 + b[k] * 0.35), a = S.rot + i / NP * TAU + d * 0.05;
        pts.push([ccx + Math.cos(a) * r, ccy + Math.sin(a) * r]);
      }
      rings.push({ d, wid, pts });
    }
    g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round';
    const far = rings[RINGS - 1];
    this.glowAt(far.pts.reduce((s, p) => s + p[0], 0) / NP, far.pts.reduce((s, p) => s + p[1], 0) / NP, Math.min(w, h) * 0.18, 0.5, 0.3 + this.mid * 0.3);
    for (let j = RINGS - 1; j >= 0; j--) {
      const R = rings[j], nx = rings[j - 1];
      const fade = Math.min(1, (R.d - 0.22) / 0.5) * Math.max(0, 1 - R.d / RINGS);
      if (fade <= 0.01) continue;
      const t = (R.wid * 0.045) % 1, pulse = (R.wid + this.beatCount) % 6 === 0 ? this.beat * 0.6 : 0;
      g.beginPath();
      R.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      if (nx) for (let i = 0; i < NP; i += 2) { g.moveTo(R.pts[i][0], R.pts[i][1]); g.lineTo(nx.pts[i][0], nx.pts[i][1]); }
      const lw = Math.min(6, 0.6 + 1.6 / R.d);
      g.lineWidth = lw * 3; g.strokeStyle = this.col(t, fade * (0.08 + pulse * 0.2)); g.stroke();
      g.lineWidth = lw; g.strokeStyle = this.col(t, Math.min(1, fade * (0.45 + this.energy * 0.4 + pulse)), 12); g.stroke();
    }
    this.strobeFlash(0.6);
  }
}

window.Visualizer = Visualizer;
window.SPECTRA = SPECTRA;
window.SCENES = SCENES;
window.THEMES = THEMES;
