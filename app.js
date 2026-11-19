(() => {
'use strict';

const $ = (s) => document.querySelector(s);
const body = document.body;
const STORE = 'vibe:v2';

/* ---------------- icons ---------------- */
const F = 'fill="currentColor"';
const K = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const svg = (a, b) => `<svg viewBox="0 0 24 24" ${a}>${b}</svg>`;
const ICON = {
  play: svg(F, '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>'),
  pause: svg(F, '<rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/>'),
  stop: svg(F, '<rect x="6" y="6" width="12" height="12" rx="2.5"/>'),
  prev: svg(F, '<rect x="5" y="5" width="2.5" height="14" rx="1"/><path d="M19 6.2v11.6a1 1 0 0 1-1.55.83L9.2 12.83a1 1 0 0 1 0-1.66l8.25-5.8A1 1 0 0 1 19 6.2z"/>'),
  next: svg(F, '<rect x="16.5" y="5" width="2.5" height="14" rx="1"/><path d="M5 6.2v11.6a1 1 0 0 0 1.55.83l8.25-5.8a1 1 0 0 0 0-1.66L6.55 5.37A1 1 0 0 0 5 6.2z"/>'),
  shuffle: svg(K, '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
  repeat: svg(K, '<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 23-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
  repeatOne: svg(K, '<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 23-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><path d="M11 10h1v5" stroke-width="1.8"/>'),
  vol: svg(K, '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>'),
  mute: svg(K, '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6M17 9l6 6"/>'),
  fs: svg(K, '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>'),
  list: svg(K, '<path d="M3 6h13M3 12h9M3 18h9"/><circle cx="18" cy="17" r="3"/><path d="M21 17V7l-3 1"/>'),
  scene: svg(K, '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
};

/* ---------------- state ---------------- */
const state = Object.assign({
  list: [], index: -1, shuffle: false, repeat: 'all', view: 'music',
  volume: 80, muted: false, scene: 'lounge', theme: 'sunset', sens: 1,
  autoMode: 'off', autoEvery: 60, skip: [], bloom: true, grain: true,
  spectrum: 'bars', specSize: 1, specAuto: 'off', specEvery: 60, bgBright: 0.85, tab: 'spec', strobe: 'soft',
  themeAuto: 'off', themeEvery: 30,
},(() => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } })());
if (state.auto === true && state.autoMode === 'off') state.autoMode = 'seq';   // migrate old setting
delete state.auto;

const CLOUD_KEY = 'vibe:cloud';
const cloud = Object.assign({ bin: '0a2a1ee5218ce7717361', auto: true },
  (() => { try { return JSON.parse(localStorage.getItem(CLOUD_KEY) || '{}'); } catch { return {}; } })());
const saveCloudCfg = () => { try { localStorage.setItem(CLOUD_KEY, JSON.stringify(cloud)); } catch {} };
let pushTimer = null;

const rt = { playing: false, loadedId: null, pos: 0, dur: 0, seeking: false, bag: [], bagUsed: false, history: [], errors: 0 };

const cloudItems = () => state.list.filter((t) => t.type !== 'file')
  .map(({ id, type, url, vid, title, author, thumb }) => ({ id, type, url, vid, title, author, thumb }));
let lastListJson = null;      // last playlist snapshot — detects changes that need a cloud push

function save() {
  try {
    const list = cloudItems();
    const lj = JSON.stringify(list);
    if (lastListJson !== null && lj !== lastListJson) {
      lastListJson = lj;
      state.listUpdatedAt = Date.now();
      schedulePush();
    }
    const curId = state.list[state.index]?.id;
    localStorage.setItem(STORE, JSON.stringify({ ...state, list, index: Math.max(-1, list.findIndex((t) => t.id === curId)) }));
  } catch {}
}

const cur = () => state.list[state.index];
const loaded = () => state.list.find((t) => t.id === rt.loadedId);
const idxOf = (id) => state.list.findIndex((t) => t.id === id);
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s) => {
  if (!isFinite(s)) s = 0;
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`;
};
const SRC_NAME = { yt: 'YouTube', sc: 'SoundCloud', file: 'Local file' };

let toastTimer;
function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

/* ---------------- link parsing ---------------- */
function parseLink(raw) {
  const s = raw.trim();
  if (!s) return null;
  if (/^[\w-]{11}$/.test(s)) return ytTrack(s);
  let u;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch { return null; }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1, 12);
  else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com'))
    id = u.searchParams.get('v') || (u.pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/) || [])[1];
  if (id && /^[\w-]{11}$/.test(id)) return ytTrack(id);
  if (host.endsWith('soundcloud.com'))
    return { id: uid(), type: 'sc', url: host === 'on.soundcloud.com' ? u.href : u.origin + u.pathname.replace(/\/$/, ''), title: null, thumb: null };
  return null;
}
const ytTrack = (vid) => ({ id: uid(), type: 'yt', vid, url: `https://www.youtube.com/watch?v=${vid}`, title: null, thumb: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` });

async function fetchMeta(t) {
  const u = encodeURIComponent(t.url);
  const eps = t.type === 'yt'
    ? [`https://www.youtube.com/oembed?format=json&url=${u}`, `https://noembed.com/embed?url=${u}`]
    : [`https://soundcloud.com/oembed?format=json&url=${u}`, `https://noembed.com/embed?url=${u}`];
  for (const ep of eps) {
    try {
      const r = await fetch(ep);
      if (!r.ok) continue;
      const j = await r.json();
      if (!j || j.error || !j.title) continue;
      t.title = j.title; t.author = j.author_name || t.author;
      if (t.type === 'sc' && j.thumbnail_url) t.thumb = j.thumbnail_url;
      save(); renderList(); updateNow();
      return;
    } catch {}
  }
}

/* ---------------- Web Audio (local files + mic) ---------------- */
let actx = null, fileAnalyser = null, fileGain = null, micAnalyser = null, micStream = null;
const fileEl = $('#fileMedia');
const audioCtx = () => actx || (actx = new (window.AudioContext || window.webkitAudioContext)());
function mkAnalyser(c) {
  const a = c.createAnalyser();
  a.fftSize = 2048; a.smoothingTimeConstant = 0.8; a.minDecibels = -88; a.maxDecibels = -18;
  return a;
}
function ensureFileGraph() {
  if (fileAnalyser) return;
  const c = audioCtx();
  const src = c.createMediaElementSource(fileEl);
  fileAnalyser = mkAnalyser(c);
  fileGain = c.createGain();
  src.connect(fileAnalyser); fileAnalyser.connect(fileGain); fileGain.connect(c.destination);
  applyVolume();
}
function updateSource() {
  const t = loaded();
  let a = null, label = 'Mô phỏng theo nhịp';
  if (t?.type === 'file' && fileAnalyser) { a = fileAnalyser; label = 'Âm thanh thật (file)'; }
  else if (micAnalyser) { a = micAnalyser; label = 'Micro (thật)'; }
  viz.setAnalyser(a);
  $('#srcLabel').textContent = label;
  $('#micBtn').classList.toggle('on', !!micAnalyser);
}
async function toggleMic() {
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null; micAnalyser = null; updateSource();
    toast('Đã tắt micro'); return;
  }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const c = audioCtx(); await c.resume();
    micAnalyser = mkAnalyser(c);
    c.createMediaStreamSource(micStream).connect(micAnalyser);
    updateSource();
    toast('Micro đang nghe loa — visualizer theo nhạc thật 🎙');
  } catch { micStream = null; toast('Không mở được micro'); }
}

fileEl.addEventListener('play', () => { if (loaded()?.type === 'file') { setPlaying(true); rt.errors = 0; } });
fileEl.addEventListener('pause', () => { if (loaded()?.type === 'file') setPlaying(false); });
fileEl.addEventListener('ended', () => { if (loaded()?.type === 'file') onEnded(); });
fileEl.addEventListener('error', () => { if (loaded()?.type === 'file' && fileEl.getAttribute('src')) onTrackError('Không phát được file này'); });

/* ---------------- YouTube ---------------- */
let yt = null, ytReady = false, ytPending = null;
window.onYouTubeIframeAPIReady = () => {
  yt = new YT.Player('ytPlayer', {
    width: '100%', height: '100%',
    playerVars: { autoplay: 1, playsinline: 1, rel: 0, controls: 0, disablekb: 1, modestbranding: 1, iv_load_policy: 3, origin: location.origin },
    events: {
      onReady: () => { ytReady = true; applyVolume(); if (ytPending) { const f = ytPending; ytPending = null; f(); } },
      onStateChange: (e) => {
        const t = loaded();
        if (!t || t.type !== 'yt') return;
        if (e.data === YT.PlayerState.PLAYING) {
          setPlaying(true); rt.errors = 0;
          const d = yt.getVideoData?.();
          if (d?.title && t.title !== d.title) { t.title = d.title; t.author = d.author || t.author; save(); renderList(); updateNow(); }
        } else if (e.data === YT.PlayerState.PAUSED) setPlaying(false);
        else if (e.data === YT.PlayerState.ENDED) onEnded();
      },
      onError: (e) => {
        if (loaded()?.type !== 'yt') return;
        const msg = { 2: 'Link YouTube không hợp lệ', 5: 'Lỗi trình phát', 100: 'Video không tồn tại', 101: 'Video không cho nhúng', 150: 'Video không cho nhúng' }[e.data];
        onTrackError((msg || 'Lỗi YouTube ' + e.data) + ' — bỏ qua');
      },
    },
  });
};
loadScript('https://www.youtube.com/iframe_api').catch(() => toast('Không tải được YouTube API'));

/* ---------------- SoundCloud ---------------- */
let sc = null, scApi = null, scWaitReady = false;
const SC_OPTS = { auto_play: true, visual: true, show_comments: false, hide_related: true, show_teaser: false, show_reposts: false };
async function playSC(t) {
  try { await (scApi || (scApi = loadScript('https://w.soundcloud.com/player/api.js'))); }
  catch { onTrackError('Không tải được SoundCloud API'); return; }
  if (!sc) {
    const f = document.createElement('iframe');
    f.allow = 'autoplay; encrypted-media';
    const q = new URLSearchParams({ url: t.url });
    for (const [k, v] of Object.entries(SC_OPTS)) q.set(k, String(v));
    f.src = 'https://w.soundcloud.com/player/?' + q;
    $('#scWrap').appendChild(f);
    sc = SC.Widget(f);
    const E = SC.Widget.Events;
    scWaitReady = true;
    sc.bind(E.READY, () => { if (scWaitReady) { scWaitReady = false; afterScLoad(); } });
    sc.bind(E.PLAY, () => { if (loaded()?.type === 'sc') { setPlaying(true); rt.errors = 0; } });
    sc.bind(E.PAUSE, () => { if (loaded()?.type === 'sc') setPlaying(false); });
    sc.bind(E.FINISH, () => { if (loaded()?.type === 'sc') onEnded(); });
    sc.bind(E.ERROR, () => { if (loaded()?.type === 'sc') onTrackError('SoundCloud không phát được bài này — bỏ qua'); });
  } else sc.load(t.url, { ...SC_OPTS, callback: afterScLoad });
}
function afterScLoad() {
  const t = loaded();
  if (!t || t.type !== 'sc') { sc.pause(); return; }
  applyVolume(); sc.play();
  sc.getCurrentSound((s) => {
    if (!s) return;
    t.title = s.title || t.title; t.author = s.user?.username || t.author;
    const art = s.artwork_url || s.user?.avatar_url;
    if (art) t.thumb = art.replace('-large', '-t500x500');
    save(); renderList(); updateNow();
  });
}

/* ---------------- playback ---------------- */
function pauseOthers(type) {
  if (type !== 'yt' && ytReady) yt.pauseVideo();
  if (type !== 'sc' && sc) try { sc.pause(); } catch {}
  if (type !== 'file' && !fileEl.paused) fileEl.pause();
}

function playIndex(i) {
  const t = state.list[i];
  if (!t) return;
  if (rt.loadedId && rt.loadedId !== t.id) {
    viz.trackChanged();
    if (state.specAuto !== 'off' && +state.specEvery === 0) autoSpectrum();
    if (state.themeAuto !== 'off' && +state.themeEvery === 0) autoTheme();
  }
  state.index = i; rt.loadedId = t.id; t.error = false;
  updateTime(0, 0);
  $('#media').dataset.src = t.type;
  body.classList.add('has-track');
  viz.setTrackSeed(t.id);
  renderList(); updateNow(); save(); applyView();
  pauseOthers(t.type);
  if (t.type === 'yt') {
    const go = () => yt.loadVideoById(t.vid);
    ytReady ? go() : (ytPending = go);
  } else if (t.type === 'sc') playSC(t);
  else {
    ensureFileGraph(); audioCtx().resume();
    fileEl.src = t.url;
    fileEl.play().catch(() => {});
  }
  updateSource();
}

function togglePlay() {
  if (!state.list.length) { toast('Dán link YouTube / SoundCloud trước nhé'); return; }
  const t = loaded();
  if (!t || t.id !== cur()?.id) { playIndex(Math.max(0, state.index)); return; }
  if (t.type === 'yt' && ytReady) rt.playing ? yt.pauseVideo() : yt.playVideo();
  else if (t.type === 'sc' && sc) rt.playing ? sc.pause() : sc.play();
  else if (t.type === 'file') { audioCtx().resume(); rt.playing ? fileEl.pause() : fileEl.play(); }
}

function stop() {
  const t = loaded();
  if (!t) return;
  if (t.type === 'yt' && ytReady) { yt.pauseVideo(); yt.seekTo(0, true); }
  else if (t.type === 'sc' && sc) { sc.pause(); sc.seekTo(0); }
  else if (t.type === 'file') { fileEl.pause(); fileEl.currentTime = 0; }
  setPlaying(false); updateTime(0, rt.dur);
}

function seekTo(sec) {
  const t = loaded();
  if (!t) return;
  if (t.type === 'yt' && ytReady) yt.seekTo(sec, true);
  else if (t.type === 'sc' && sc) sc.seekTo(sec * 1000);
  else if (t.type === 'file') fileEl.currentTime = sec;
  rt.pos = sec;
}

function next(auto = false) {
  const n = state.list.length;
  if (!n) return;
  let i;
  if (state.shuffle && n > 1) {
    rt.bag = rt.bag.filter((x) => x < n && x !== state.index);
    if (!rt.bag.length) {
      if (rt.bagUsed && auto && state.repeat === 'off') { rt.bagUsed = false; stop(); toast('Đã phát hết danh sách'); return; }
      rt.bag = [...Array(n).keys()].filter((x) => x !== state.index);
      for (let k = rt.bag.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [rt.bag[k], rt.bag[j]] = [rt.bag[j], rt.bag[k]]; }
      rt.bagUsed = true;
    }
    i = rt.bag.pop();
  } else {
    i = state.index + 1;
    if (i >= n) {
      if (auto && state.repeat === 'off') { stop(); toast('Đã phát hết danh sách'); return; }
      i = 0;
    }
  }
  if (cur()) rt.history.push(cur().id);
  if (rt.history.length > 200) rt.history.shift();
  playIndex(i);
}

function prev() {
  const n = state.list.length;
  if (!n) return;
  if (rt.pos > 3) { seekTo(0); return; }
  if (state.shuffle) {
    while (rt.history.length) { const i = idxOf(rt.history.pop()); if (i >= 0) { playIndex(i); return; } }
  }
  playIndex((Math.max(0, state.index) - 1 + n) % n);
}

function onEnded() {
  if (state.repeat === 'one') {
    seekTo(0);
    const t = loaded();
    if (t?.type === 'yt') yt.playVideo(); else if (t?.type === 'sc') sc.play(); else fileEl.play();
    return;
  }
  next(true);
}

function onTrackError(msg) {
  const t = loaded();
  if (t) { t.error = true; renderList(); }
  toast(msg); setPlaying(false);
  rt.errors++;
  if (rt.errors < state.list.length) setTimeout(() => next(true), 1200);
  else { rt.errors = 0; toast('Không phát được bài nào trong danh sách'); }
}

function setPlaying(b) {
  rt.playing = b;
  $('#playBtn').innerHTML = b ? ICON.pause : ICON.play;
  $('#cPlay').innerHTML = b ? ICON.pause : ICON.play;
  body.classList.toggle('is-playing', b);
  viz.setPlaying(b);
  poke();
}

function applyVolume() {
  const v = state.muted ? 0 : state.volume;
  if (ytReady) yt.setVolume(v);
  if (sc) sc.setVolume(v);
  if (fileGain) fileGain.gain.value = v / 100; else fileEl.volume = v / 100;
  $('#vol').value = state.volume; fill($('#vol'));
  $('#muteBtn').innerHTML = v === 0 ? ICON.mute : ICON.vol;
}

setInterval(() => {
  const t = loaded();
  if (!t || rt.seeking) return;
  if (t.type === 'yt' && ytReady && yt.getCurrentTime) updateTime(yt.getCurrentTime() || 0, yt.getDuration() || 0);
  else if (t.type === 'sc' && sc) sc.getPosition((p) => sc.getDuration((d) => { if (!rt.seeking && loaded() === t) updateTime(p / 1000, d / 1000); }));
  else if (t.type === 'file') updateTime(fileEl.currentTime, fileEl.duration);
}, 250);

function updateTime(pos, dur) {
  rt.pos = pos; rt.dur = isFinite(dur) ? dur : 0;
  viz.progress = rt.dur ? pos / rt.dur : 0;
  $('#cur').textContent = fmt(pos); $('#dur').textContent = fmt(rt.dur);
  if (!rt.seeking) { $('#seek').value = rt.dur ? Math.round(pos / rt.dur * 1000) : 0; fill($('#seek')); }
}

/* ---------------- playlist ---------------- */
function renderList() {
  const ul = $('#playlist');
  $('#count').textContent = state.list.length ? `${state.list.length} bài` : '';
  body.classList.toggle('empty', !state.list.length);
  if (!state.list.length) {
    ul.innerHTML = '<li class="empty-li">Chưa có bài nào.<br>Dán link vào ô phía trên,<br>hoặc Ctrl+V ở bất cứ đâu.</li>';
    return;
  }
  ul.innerHTML = state.list.map((t, i) => `
    <li class="item${i === state.index ? ' active' : ''}${t.error ? ' err' : ''}" draggable="true" data-i="${i}">
      <div class="thumb">${t.thumb ? `<img src="${esc(t.thumb)}" loading="lazy" alt="">` : '♫'}<span class="eq"><i></i><i></i><i></i></span></div>
      <div class="meta">
        <div class="t" title="${esc(t.title || t.url)}">${esc(t.title || t.url.replace(/^https?:\/\/(www\.)?/, ''))}</div>
        <div class="s">${SRC_NAME[t.type]}${t.author ? ' · ' + esc(t.author) : ''}</div>
      </div>
      <button class="rm" title="Xoá">✕</button>
    </li>`).join('');
}

function updateNow() {
  const t = cur();
  $('#nowSrc').textContent = t ? SRC_NAME[t.type] : '';
  $('#nowTitle').textContent = t ? (t.title || t.url) : '';
  $('#nowArtist').textContent = t?.author || '';
  document.title = t?.title ? `♪ ${t.title}` : 'vibe';
  viz.setTrack({ title: t?.title || '', artist: t?.author || '', thumb: t?.thumb || null });
}

function listMutated(curId) {
  state.index = curId ? idxOf(curId) : -1;
  rt.bag = []; rt.bagUsed = false;
  save(); renderList(); updateNow();
}

function unload() {
  pauseOthers('none');
  if (ytReady) yt.stopVideo();
  fileEl.removeAttribute('src'); fileEl.load();
  rt.loadedId = null; setPlaying(false); updateTime(0, 0);
  delete $('#media').dataset.src;
  body.classList.remove('has-track');
  updateSource();
}

function removeAt(i) {
  const curId = cur()?.id;
  const [t] = state.list.splice(i, 1);
  if (t.id === rt.loadedId) unload();
  if (t.type === 'file') URL.revokeObjectURL(t.url);
  listMutated(t.id === curId ? null : curId);
}

function addLinks(text) {
  const parts = text.split(/[\s,]+/).filter(Boolean);
  const wasEmpty = !state.list.length, curId = cur()?.id;
  let added = 0, bad = 0;
  for (const p of parts) {
    const t = parseLink(p);
    if (!t) { bad++; continue; }
    state.list.push(t); fetchMeta(t); added++;
  }
  listMutated(curId);
  if (added) toast(`Đã thêm ${added} bài${bad ? ` · bỏ qua ${bad} link lạ` : ''}`);
  else if (bad) toast('Chỉ nhận link YouTube / SoundCloud');
  if (wasEmpty && added) playIndex(0);
  return added;
}

function addFiles(files) {
  const list = [...files].filter((f) => /^(audio|video)\//.test(f.type) || /\.(mp3|m4a|aac|flac|wav|ogg|opus|webm|mp4)$/i.test(f.name));
  if (!list.length) return;
  const wasEmpty = !state.list.length, curId = cur()?.id;
  for (const f of list) state.list.push({ id: uid(), type: 'file', url: URL.createObjectURL(f), title: f.name.replace(/\.[^.]+$/, ''), thumb: null });
  listMutated(curId);
  toast(`Đã thêm ${list.length} file — visualizer theo âm thanh thật`);
  if (wasEmpty) playIndex(0);
}

/* ---------------- visualizer ---------------- */
const viz = new Visualizer($('#viz'));
viz.setScene(state.scene, false);
viz.theme = state.theme; viz.sens = state.sens;
viz.fx.bloom = state.bloom; viz.fx.grain = state.grain;
const sceneMeta = (id) => SCENES.find((s) => s.id === id) || SCENES[0];
viz.onAutoScene = (id) => { state.scene = id; renderScenes(); save(); toast(sceneMeta(id).icon + '  ' + sceneMeta(id).name, 1400); };
setInterval(() => document.documentElement.style.setProperty('--accent', viz.col(0.3, 1, 2)), 250);

function applyAuto() {
  viz.autoMode = state.autoMode;
  viz.autoEvery = +state.autoEvery;
  viz.setPool(SCENES.map((s) => s.id).filter((id) => id !== 'none' && !state.skip.includes(id)));
  document.querySelectorAll('#autoSeg button').forEach((b) => b.classList.toggle('on', b.dataset.a === state.autoMode));
  $('#autoEvery').value = String(state.autoEvery);
  $('#autoEvery').disabled = state.autoMode === 'off';
}

function renderScenes() {
  $('#sceneGrid').innerHTML = SCENES.map((s) =>
    `<button data-s="${s.id}" class="${s.id === state.scene ? 'on' : ''}${s.id !== 'none' && state.skip.includes(s.id) ? ' out' : ''}">
      ${s.id === 'none' ? '' : '<i class="pin" data-pin title="Bật/tắt trong vòng xoay tự động"></i>'}<span>${s.icon}</span>${s.name}</button>`).join('');
}
function renderThemes() {
  $('#themeChips').innerHTML = THEMES.map((th) => {
    const dot = `background:linear-gradient(135deg,${viz.colOf(th.id, 0)},${viz.colOf(th.id, 1)})`;
    return `<button class="chip${th.id === state.theme ? ' on' : ''}" data-t="${th.id}"><i style="${dot}"></i>${th.name}</button>`;
  }).join('');
  document.querySelectorAll('#themeAutoSeg button').forEach((b) => b.classList.toggle('on', b.dataset.a === state.themeAuto));
  $('#themeEvery').value = String(state.themeEvery);
  $('#themeEvery').disabled = state.themeAuto === 'off';
}
function setTheme(id, quiet) {
  state.theme = id; viz.setTheme(id); renderThemes(); save();
  if (!quiet) toast('🎨  ' + (THEMES.find((t) => t.id === id)?.name || id), 1200);
}
let themeBag = [];
function autoTheme() {
  const pool = THEMES.map((t) => t.id);
  let id;
  if (state.themeAuto === 'seq') id = pool[(pool.indexOf(state.theme) + 1) % pool.length];
  else {
    if (!themeBag.length) themeBag = pool.filter((x) => x !== state.theme).sort(() => Math.random() - 0.5);
    id = themeBag.pop();
  }
  if (id) setTheme(id);
}
function randomTheme() {
  const pool = THEMES.map((t) => t.id).filter((x) => x !== state.theme);
  setTheme(pool[Math.floor(Math.random() * pool.length)]);
}
function randomAll() {
  const sc = SCENES.map((s) => s.id).filter((id) => id !== 'none' && id !== state.scene && !state.skip.includes(id));
  const sp = SPECTRA.map((s) => s.id).filter((id) => id !== 'off' && id !== state.spectrum);
  const th = THEMES.map((t) => t.id).filter((id) => id !== state.theme);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  if (sc.length) { state.scene = pick(sc); viz.setScene(state.scene); renderScenes(); }
  setSpectrum(pick(sp), true);
  setTheme(pick(th), true);
  toast(`🎲  ${sceneMeta(state.scene).name} · ${SPECTRA.find((s) => s.id === state.spectrum).name} · ${THEMES.find((t) => t.id === state.theme).name}`, 2200);
}
function setScene(id) {
  state.scene = id; viz.setScene(id); renderScenes(); save();
  toast(sceneMeta(id).icon + '  ' + sceneMeta(id).name, 1200);
}
function nextScene(dir = 1) {
  const i = SCENES.findIndex((s) => s.id === state.scene);
  setScene(SCENES[(i + dir + SCENES.length) % SCENES.length].id);
}
/* ---------------- spectrum layer ---------------- */
const SPEC_ICON = (() => {
  const S = (b) => `<svg viewBox="0 0 40 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${b}</svg>`;
  const bars = (hs, mid) => hs.map((v, i) => `M${5 + i * 6} ${mid ? 12 - v / 2 : 21}v${mid ? v : -v}`).join('');
  const ring = (n, r0, r1, half) => Array.from({ length: n }, (_, i) => {
    const a = half ? Math.PI + (i + 0.5) / n * Math.PI : i / n * Math.PI * 2, cx = 20, cy = half ? 21 : 12;
    const rr = r1 + (i % 3) * 1.2;
    return `M${(cx + Math.cos(a) * r0).toFixed(1)} ${(cy + Math.sin(a) * r0).toFixed(1)}L${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }).join('');
  const blob = Array.from({ length: 41 }, (_, i) => {
    const a = i / 40 * Math.PI * 2, r = 7 + 1.8 * Math.sin(a * 6);
    return `${i ? 'L' : 'M'}${(20 + Math.cos(a) * r).toFixed(1)} ${(12 + Math.sin(a) * r).toFixed(1)}`;
  }).join('');
  const dots = [3, 5, 4, 6, 3, 2].map((c, i) => Array.from({ length: c }, (_, j) => `<circle cx="${5 + i * 6}" cy="${20 - j * 3.3}" r="1.3" fill="currentColor" stroke="none"/>`).join('')).join('');
  const blocks = [3, 5, 4, 6, 3, 2].map((c, i) => Array.from({ length: c }, (_, j) => `<rect x="${3 + i * 6}" y="${19 - j * 3.2}" width="4" height="2.2" fill="currentColor" stroke="none"/>`).join('')).join('');
  return {
    off: S('<circle cx="20" cy="12" r="8" stroke-width="2"/><path d="M14.5 17.5 25.5 6.5" stroke-width="2"/>'),
    bars: S(`<path d="${bars([6, 12, 8, 15, 9, 5])}" stroke-width="3.5"/>`),
    mirror: S(`<path d="${bars([6, 14, 9, 18, 10, 4], true)}" stroke-width="3.5"/>`),
    blocks: S(blocks),
    mountain: S('<path d="M2 21C8 21 9 10 14 12S20 4 24 8 32 16 38 21Z" fill="currentColor" opacity=".75" stroke-width="1.5"/>'),
    line: S('<path d="M2 12C6 3 9 3 12 12S18 21 21 12 27 3 30 12 36 19 38 12" stroke-width="2"/>'),
    ribbon: S('<path d="M2 12C10 2 14 2 20 12S30 22 38 12" stroke-width="1.6"/><path d="M2 12C10 22 14 22 20 12S30 2 38 12" stroke-width="1.6" opacity=".6"/><path d="M2 12C12 6 28 18 38 12" stroke-width="1.2" opacity=".5"/>'),
    circle: S(`<circle cx="20" cy="12" r="4.5" stroke-width="1.6"/><path d="${ring(16, 6, 9)}" stroke-width="1.6"/>`),
    blob: S(`<path d="${blob}Z" stroke-width="1.8"/>`),
    dots: S(dots),
    sides: S('<path d="M3 20h8M3 15h12M3 10h6M3 5h4M37 20h-8M37 15h-12M37 10h-6M37 5h-4" stroke-width="3"/>'),
    arc: S(`<path d="${ring(13, 7, 12, true)}" stroke-width="1.8"/><path d="M14 21a6 6 0 0 1 12 0" stroke-width="1.5"/>`),
    sparks: S(`<path d="${bars([5, 10, 7, 13, 8, 4])}" stroke-width="1.8"/><circle cx="17" cy="5" r="1.2" fill="currentColor"/><circle cx="25" cy="3" r="1.2" fill="currentColor"/><circle cx="11" cy="7" r="1" fill="currentColor"/>`),
    clubtunnel: S('<path d="M5 2h30l3 3v14l-3 3H5l-3-3V5z" stroke-width="1.6"/><path d="M13 7h14l2 2v6l-2 2H13l-2-2V9z" stroke-width="1.4" opacity=".75"/><path d="M17.5 10.5h5v3h-5z" stroke-width="1.2" opacity=".5"/><path d="M5 2l12.5 8.5M35 2l-12.5 8.5M5 22l12.5-8.5M35 22l-12.5-8.5" stroke-width="1" opacity=".45"/>'),
    ledfloor: S('<path d="M2 22 15 14h10l13 8M9 22l8-8M15 22l4-8M21 22l-1-8M27 22l-4-8M33 22l-8-8M6 19.5h28M11 16.5h18M2 2 15 10h10L38 2" stroke-width="1.2"/>'),
    tubes: S('<path d="M5 3v14M11 6v11M17 2v15M23 5v12M29 3v14M35 7v10" stroke-width="2.4"/><path d="M5 19.5v2M11 19.5v2M17 19.5v2M23 19.5v2M29 19.5v2M35 19.5v2" stroke-width="2" opacity=".35"/>'),
    biotunnel: S('<path d="M20 7.2l3.4 1.4 1.4 3.4-1.4 3.4-3.4 1.4-3.4-1.4-1.4-3.4 1.4-3.4z" stroke-width="1.6"/><path d="M23.4 8.6C27 5 30 4 34 1.5M16.6 8.6C13 5 10 4 6 1.5M23.4 15.4C27 19 30 20 34 22.5M16.6 15.4C13 19 10 20 6 22.5M24.8 12C30 11 34 13 39 12M15.2 12C10 13 6 11 1 12" stroke-width="2.2" opacity=".6"/>'),
    hexworm: S('<path d="M20 9.5l2.2 1.25v2.5L20 14.5l-2.2-1.25v-2.5z" stroke-width="1.2"/><path d="M20 4.5l6.5 3.75v7.5L20 19.5l-6.5-3.75v-7.5z" stroke-width="1.3" opacity=".75"/><path d="M13.5 8.25 5 3M26.5 8.25 35 3M13.5 15.75 5 21M26.5 15.75 35 21M20 4.5V1M20 19.5V23" stroke-width="1.2" opacity=".5"/>'),
    mandala: S('<path d="M20 12C17 8 18 4 20 2c2 2 3 6 0 10zM20 12c3 4 2 8 0 10-2-2-3-6 0-10zM20 12c-4 3-8 2-10 0 2-2 6-3 10 0zM20 12c4-3 8-2 10 0-2 2-6 3-10 0z" stroke-width="1.3"/><path d="M20 12c-3-1-5-4-5-6 2 0 5 2 5 6zM20 12c3 1 5 4 5 6-2 0-5-2-5-6zM20 12c1-3 4-5 6-5 0 2-2 5-6 5zM20 12c-1 3-4 5-6 5 0-2 2-5 6-5z" stroke-width="1" opacity=".6"/>'),
    vortex: S('<path d="M20 12c0-1.5 2-2 3-.5s0 4-3 4-5-3-4-6 5-5 8-3 5 6 3 9-7 5-11 3-6-7-3-11 9-6 13-3" stroke-width="1.5"/><circle cx="20" cy="12" r="1.3" fill="currentColor"/>'),
    cyberrings: S('<path d="M20 2a10 10 0 0 1 9.5 7M29.8 14A10 10 0 0 1 22 21.8M15 20.7A10 10 0 0 1 10.2 9.5" stroke-width="2"/><path d="M20 6a6 6 0 0 1 5.6 4M24.5 16A6 6 0 0 1 15 15.5M14.3 10A6 6 0 0 1 17 6.8" stroke-width="1.4" opacity=".7"/><circle cx="20" cy="12" r="1.8" stroke-width="1.2"/>'),
    wiretube: S('<ellipse cx="22" cy="12" rx="3" ry="2.5" stroke-width="1.1" opacity=".6"/><ellipse cx="20" cy="12" rx="8" ry="6" stroke-width="1.3" opacity=".8"/><ellipse cx="18" cy="12" rx="15" ry="10" stroke-width="1.5"/><path d="M3 12h4M33 12h-4M18 2v3M18 22v-3M7.5 4.5l3 2.5M28.5 4.5l-3 2.5M7.5 19.5l3-2.5M28.5 19.5l-3-2.5" stroke-width="1" opacity=".6"/>'),
    portal: S('<rect x="14" y="6" width="12" height="12" transform="rotate(45 20 12)" stroke-width="1.6"/><path d="M20 7.5 24.5 12 20 16.5 15.5 12z" stroke-width="1.3" opacity=".7"/><path d="M20 1v2.5M20 20.5V23M7 12H4.5M35.5 12H33M10 3l2 2M30 3l-2 2M10 21l2-2M30 21l-2-2" stroke-width="1.2" opacity=".55"/>'),
  };
})();

const STROBE = { off: 0, soft: 0.35, hard: 1 };
function applyStrobe() {
  viz.strobe = STROBE[state.strobe] ?? 0.35;
  document.querySelectorAll('#strobeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.s === state.strobe));
}
function applySpectrum() {
  viz.spec.style = state.spectrum;
  viz.spec.size = +state.specSize;
  viz.bgDim = 1 - state.bgBright;
  document.querySelectorAll('#specAutoSeg button').forEach((b) => b.classList.toggle('on', b.dataset.a === state.specAuto));
  $('#specEvery').value = String(state.specEvery);
  $('#specEvery').disabled = state.specAuto === 'off';
}
function renderSpectra() {
  let group = null, html = '';
  for (const s of SPECTRA) {
    if (s.group !== group) { group = s.group; html += `<div class="grid-h">${group}</div>`; }
    html += `<button data-sp="${s.id}" class="${s.id === state.spectrum ? 'on' : ''}">${SPEC_ICON[s.id] || ''}${s.name}</button>`;
  }
  $('#specGrid').innerHTML = html;
}
function setSpectrum(id, quiet) {
  state.spectrum = id; applySpectrum(); renderSpectra(); save();
  if (!quiet) toast('Spectrum: ' + (SPECTRA.find((s) => s.id === id)?.name || id), 1200);
}
function nextSpectrum(dir = 1) {
  const i = SPECTRA.findIndex((s) => s.id === state.spectrum);
  setSpectrum(SPECTRA[(i + dir + SPECTRA.length) % SPECTRA.length].id);
}
let specBag = [];
function autoSpectrum() {
  const pool = SPECTRA.map((s) => s.id).filter((id) => id !== 'off');
  let id;
  if (state.specAuto === 'rand') {
    if (!specBag.length) specBag = pool.filter((x) => x !== state.spectrum).sort(() => Math.random() - 0.5);
    id = specBag.pop();
  } else id = pool[(pool.indexOf(state.spectrum) + 1) % pool.length];
  if (id) setSpectrum(id);
}
let specT = 0, themeT = 0;
setInterval(() => {
  if (!rt.playing) return;
  if (state.specAuto !== 'off' && +state.specEvery > 0 && ++specT >= +state.specEvery) { specT = 0; autoSpectrum(); }
  if (state.themeAuto !== 'off' && +state.themeEvery > 0 && ++themeT >= +state.themeEvery) { themeT = 0; autoTheme(); }
}, 1000);

function setTab(tab) {
  state.tab = tab;
  document.querySelectorAll('#panelTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  document.querySelectorAll('#scenePanel [data-pane]').forEach((p) => p.classList.toggle('on', p.dataset.pane === tab));
  save();
}

function randomScene() {
  const pool = SCENES.map((s) => s.id).filter((id) => id !== 'none' && id !== state.scene && !state.skip.includes(id));
  if (pool.length) setScene(pool[Math.floor(Math.random() * pool.length)]);
}

/* ---------------- view / modes ---------------- */
function applyView() {
  body.classList.toggle('view-video', state.view === 'video');
  body.classList.toggle('view-music', state.view === 'music');
  viz.overlay = state.view === 'video' && !!rt.loadedId;
  document.querySelectorAll('#viewSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === state.view));
}
function setView(v) { state.view = v; applyView(); save(); }

function applyModes() {
  $('#shuffleBtn').classList.toggle('on', state.shuffle);
  $('#shuffleBtn').title = (state.shuffle ? 'Ngẫu nhiên' : 'Tuần tự') + ' (S)';
  $('#repeatBtn').innerHTML = state.repeat === 'one' ? ICON.repeatOne : ICON.repeat;
  $('#repeatBtn').classList.toggle('on', state.repeat !== 'off');
  $('#repeatBtn').title = { off: 'Không lặp', all: 'Lặp danh sách', one: 'Lặp 1 bài' }[state.repeat] + ' (R)';
}
function toggleShuffle() {
  state.shuffle = !state.shuffle; rt.bag = []; rt.bagUsed = false;
  applyModes(); save(); toast(state.shuffle ? 'Phát ngẫu nhiên' : 'Phát tuần tự', 1200);
}
function cycleRepeat() {
  state.repeat = { off: 'all', all: 'one', one: 'off' }[state.repeat];
  applyModes(); save(); toast({ off: 'Không lặp', all: 'Lặp cả danh sách', one: 'Lặp 1 bài' }[state.repeat], 1200);
}

/* ---------------- panels & idle ---------------- */
function openPanel(which) {
  const d = $('#drawer'), p = $('#scenePanel');
  if (which === 'drawer') { d.classList.toggle('open'); p.classList.remove('open'); }
  else if (which === 'scene') { p.classList.toggle('open'); d.classList.remove('open'); }
  else { d.classList.remove('open'); p.classList.remove('open'); }
  body.classList.toggle('panel-open', d.classList.contains('open') || p.classList.contains('open'));
  poke();
}

let idleTimer;
function poke() {
  body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (rt.playing && !body.classList.contains('panel-open') && !document.activeElement?.matches('input[type=text], textarea, #heroInput'))
      body.classList.add('idle');
  }, 3200);
}
['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'].forEach((e) => addEventListener(e, poke, { passive: true }));

/* ---------------- wiring ---------------- */
function fill(el) { el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min)) * 100 + '%'); }

$('#prevBtn').innerHTML = ICON.prev; $('#nextBtn').innerHTML = ICON.next; $('#stopBtn').innerHTML = ICON.stop;
$('#shuffleBtn').innerHTML = ICON.shuffle; $('#fsBtn').innerHTML = ICON.fs; $('#listBtn').innerHTML = ICON.list;
$('#sceneBtn').innerHTML = ICON.scene;

$('#playBtn').onclick = togglePlay;
$('#cPlay').onclick = togglePlay;
$('#cPrev').onclick = prev;
$('#cNext').onclick = () => next(false);
$('#cPrev').innerHTML = ICON.prev; $('#cNext').innerHTML = ICON.next;
$('#stopBtn').onclick = stop;
$('#nextBtn').onclick = () => next(false);
$('#prevBtn').onclick = prev;
$('#shuffleBtn').onclick = toggleShuffle;
$('#repeatBtn').onclick = cycleRepeat;
$('#viewSeg').onclick = (e) => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); };
$('#listBtn').onclick = () => openPanel('drawer');
$('#closeDrawer').onclick = () => openPanel(null);
$('#sceneBtn').onclick = () => openPanel('scene');
$('#fsBtn').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
$('#muteBtn').onclick = () => { state.muted = !state.muted; applyVolume(); save(); };
$('#micBtn').onclick = toggleMic;
$('#clearBtn').onclick = () => {
  if (!state.list.length || !confirm('Xoá toàn bộ playlist?')) return;
  unload();
  state.list.forEach((t) => t.type === 'file' && URL.revokeObjectURL(t.url));
  state.list = []; rt.history = [];
  listMutated(null);
};

$('#vol').oninput = (e) => { state.volume = +e.target.value; state.muted = false; applyVolume(); save(); };
const seekEl = $('#seek');
seekEl.oninput = () => { rt.seeking = true; fill(seekEl); $('#cur').textContent = fmt(seekEl.value / 1000 * rt.dur); };
seekEl.onchange = () => { seekTo(seekEl.value / 1000 * rt.dur); setTimeout(() => (rt.seeking = false), 300); };

$('#sceneGrid').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const id = b.dataset.s;
  if (e.target.closest('[data-pin]')) {
    state.skip = state.skip.includes(id) ? state.skip.filter((x) => x !== id) : [...state.skip, id];
    if (state.skip.length >= SCENES.length) state.skip = state.skip.filter((x) => x !== id);   // keep at least one
    renderScenes(); applyAuto(); save();
    return;
  }
  setScene(id);
};
$('#autoSeg').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.autoMode = b.dataset.a; applyAuto(); save();
  toast({ off: 'Giữ nguyên scene', seq: 'Tự đổi scene: tuần tự', rand: 'Tự đổi scene: ngẫu nhiên' }[state.autoMode], 1400);
};
$('#autoEvery').onchange = (e) => { state.autoEvery = +e.target.value; applyAuto(); save(); };
$('#panelTabs').onclick = (e) => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); };
$('#specGrid').onclick = (e) => { const b = e.target.closest('button'); if (b) setSpectrum(b.dataset.sp); };
$('#specSize').oninput = (e) => { state.specSize = +e.target.value; fill(e.target); applySpectrum(); save(); };
$('#bgBright').oninput = (e) => { state.bgBright = +e.target.value; fill(e.target); applySpectrum(); save(); };
$('#specAutoSeg').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.specAuto = b.dataset.a; specT = 0; specBag = []; applySpectrum(); save();
  toast({ off: 'Giữ nguyên spectrum', seq: 'Tự đổi spectrum: tuần tự', rand: 'Tự đổi spectrum: ngẫu nhiên' }[state.specAuto], 1400);
};
$('#strobeSeg').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.strobe = b.dataset.s; applyStrobe(); save();
};
$('#specEvery').onchange = (e) => { state.specEvery = +e.target.value; specT = 0; applySpectrum(); save(); };
$('#fxBloom').onchange = (e) => { state.bloom = viz.fx.bloom = e.target.checked; save(); };
$('#fxGrain').onchange = (e) => { state.grain = viz.fx.grain = e.target.checked; save(); };
$('#themeChips').onclick = (e) => {
  const b = e.target.closest('button');
  if (b) setTheme(b.dataset.t, true);
};
$('#themeAutoSeg').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.themeAuto = b.dataset.a; themeT = 0; themeBag = []; renderThemes(); save();
  toast({ off: 'Giữ nguyên màu', seq: 'Tự đổi màu: tuần tự', rand: 'Tự đổi màu: ngẫu nhiên' }[state.themeAuto], 1400);
};
$('#themeEvery').onchange = (e) => { state.themeEvery = +e.target.value; themeT = 0; renderThemes(); save(); };
$('#themeRandBtn').onclick = randomTheme;
$('#randAllBtn').onclick = randomAll;
$('#sens').oninput = (e) => { state.sens = viz.sens = +e.target.value; fill(e.target); save(); };

// click empty space → close panels
$('#viz').addEventListener('click', () => openPanel(null));
document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('#scenePanel, #sceneBtn, #drawer, #listBtn')) {
    if ($('#scenePanel').classList.contains('open') || $('#drawer').classList.contains('open')) openPanel(null);
  }
});

// add links
$('#heroForm').onsubmit = (e) => { e.preventDefault(); const v = $('#heroInput').value; if (v.trim() && addLinks(v)) $('#heroInput').value = ''; };
const input = $('#linkInput');
$('#addForm').onsubmit = (e) => { e.preventDefault(); if (input.value.trim() && addLinks(input.value)) input.value = ''; };
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#addForm').requestSubmit(); } });
$('#fileInput').onchange = (e) => { addFiles(e.target.files); e.target.value = ''; };

// Ctrl+V anywhere
document.addEventListener('paste', (e) => {
  if (e.target.matches?.('input, textarea')) return;
  const text = e.clipboardData?.getData('text');
  if (text) { e.preventDefault(); addLinks(text); }
});

// playlist interactions
const ul = $('#playlist');
ul.addEventListener('click', (e) => {
  const li = e.target.closest('.item');
  if (!li) return;
  const i = +li.dataset.i;
  e.target.closest('.rm') ? removeAt(i) : playIndex(i);
});
let dragFrom = -1;
ul.addEventListener('dragstart', (e) => { const li = e.target.closest('.item'); if (li) { dragFrom = +li.dataset.i; e.dataTransfer.effectAllowed = 'move'; } });
ul.addEventListener('dragover', (e) => {
  const li = e.target.closest('.item');
  if (!li || dragFrom < 0) return;
  e.preventDefault();
  ul.querySelectorAll('.drag-over').forEach((x) => x.classList.remove('drag-over'));
  li.classList.add('drag-over');
});
ul.addEventListener('dragend', () => { dragFrom = -1; ul.querySelectorAll('.drag-over').forEach((x) => x.classList.remove('drag-over')); });
ul.addEventListener('drop', (e) => {
  const li = e.target.closest('.item');
  if (!li || dragFrom < 0) return;
  e.preventDefault(); e.stopPropagation();
  const to = +li.dataset.i;
  if (to !== dragFrom) {
    const curId = cur()?.id;
    const [t] = state.list.splice(dragFrom, 1);
    state.list.splice(to, 0, t);
    listMutated(curId);
  }
  dragFrom = -1;
});

// drop links / files on the page
let dragDepth = 0;
document.addEventListener('dragenter', (e) => { if (dragFrom < 0) { dragDepth++; body.classList.add('dragging'); } });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; body.classList.remove('dragging'); } });
document.addEventListener('dragover', (e) => { if (dragFrom < 0) e.preventDefault(); });
document.addEventListener('drop', (e) => {
  dragDepth = 0; body.classList.remove('dragging');
  if (dragFrom >= 0) return;
  e.preventDefault();
  if (e.dataTransfer.files?.length) return addFiles(e.dataTransfer.files);
  const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
  if (text) addLinks(text);
});

// keyboard
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input:not([type=range]), textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
  const act = {
    ' ': togglePlay, n: () => next(false), p: prev, s: toggleShuffle, r: cycleRepeat,
    v: () => setView(state.view === 'video' ? 'music' : 'video'),
    m: () => nextScene(e.shiftKey ? -1 : 1), x: randomScene, k: () => nextSpectrum(e.shiftKey ? -1 : 1), c: randomTheme, z: randomAll, l: () => openPanel('drawer'), f: () => $('#fsBtn').click(), escape: () => openPanel(null),
    arrowright: () => seekTo(Math.min(rt.dur, rt.pos + 5)), arrowleft: () => seekTo(Math.max(0, rt.pos - 5)),
    arrowup: () => { state.volume = Math.min(100, state.volume + 5); state.muted = false; applyVolume(); save(); },
    arrowdown: () => { state.volume = Math.max(0, state.volume - 5); applyVolume(); save(); },
  }[e.key.toLowerCase()];
  if (act) { e.preventDefault(); act(); }
});

/* ---------------- init ---------------- */
if (state.index >= state.list.length) state.index = state.list.length ? 0 : -1;
$('#sens').value = state.sens; fill($('#sens'));
$('#fxBloom').checked = state.bloom; $('#fxGrain').checked = state.grain;
$('#specSize').value = state.specSize; fill($('#specSize'));
$('#bgBright').value = state.bgBright; fill($('#bgBright'));
renderScenes(); renderThemes(); applyAuto();
renderSpectra(); applySpectrum(); applyStrobe(); setTab(state.tab || 'spec');
applyView(); applyModes(); applyVolume(); setPlaying(false);
renderList(); updateNow(); updateSource();
state.list.filter((t) => !t.title).forEach(fetchMeta);

/* ---------------- cloud sync (npoint.io) ---------------- */
function cloudStatus(text, kind = '') { const el = $('#cloudStatus'); el.textContent = text; el.dataset.s = kind; }
const hhmm = (d) => new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const binUrl = () => `https://api.npoint.io/${cloud.bin}`;
function parseBin(s) { const m = String(s || '').trim().match(/([a-z0-9]{12,})\/?(?:[?#].*)?$/i); return m ? m[1] : ''; }

async function cloudPush(manual) {
  clearTimeout(pushTimer);
  if (!cloud.bin) { if (manual) toast('Chưa nhập npoint bin'); return; }
  cloudStatus('☁ Đang lưu…', 'busy');
  try {
    const list = cloudItems();
    const body = { app: 'vibe-player', version: 1, updatedAt: state.listUpdatedAt || Date.now(), count: list.length, list };
    const r = await fetch(binUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'bin đang bị khoá (Lock) trên npoint' : 'HTTP ' + r.status);
    cloudStatus(`☁ Đã lưu ${hhmm(Date.now())} · ${list.length} bài`, 'ok');
    if (manual) toast(`Đã lưu ${list.length} bài lên cloud ☁`);
  } catch (e) {
    cloudStatus('☁ Lỗi lưu: ' + e.message, 'err');
    if (manual) toast('Không lưu được: ' + e.message, 4000);
  }
}
function schedulePush() {
  if (!cloud.auto || !cloud.bin) return;
  clearTimeout(pushTimer);
  cloudStatus('☁ Có thay đổi, sắp lưu…', 'busy');
  pushTimer = setTimeout(() => cloudPush(false), 2500);
}

async function cloudPull(manual) {
  if (!cloud.bin) { if (manual) toast('Chưa nhập npoint bin'); cloudStatus('☁ Chưa có bin'); return; }
  cloudStatus('☁ Đang tải…', 'busy');
  try {
    const r = await fetch(binUrl() + '?_=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!data || data.app !== 'vibe-player' || !Array.isArray(data.list)) {
      cloudStatus('☁ Cloud trống — sẽ lưu khi playlist thay đổi', 'ok');
      if (manual) toast('Cloud chưa có playlist nào');
      else if (state.list.some((t) => t.type !== 'file')) schedulePush();
      return;
    }
    const remoteAt = +data.updatedAt || 0, localAt = +state.listUpdatedAt || 0;
    if (!manual && state.list.some((t) => t.type !== 'file') && remoteAt <= localAt) {
      if (remoteAt < localAt) schedulePush();           // local is newer → push it
      else cloudStatus(`☁ Đã đồng bộ · ${data.list.length} bài`, 'ok');
      return;
    }
    applyRemoteList(data.list, remoteAt);
    cloudStatus(`☁ Đã tải ${hhmm(Date.now())} · ${data.list.length} bài`, 'ok');
    if (manual) toast(`Đã tải ${data.list.length} bài từ cloud ☁`);
  } catch (e) {
    cloudStatus('☁ Lỗi tải: ' + e.message, 'err');
    if (manual) toast('Không tải được: ' + e.message, 4000);
  }
}

function applyRemoteList(items, remoteAt) {
  const loadedUrl = loaded()?.url, curUrl = cur()?.url;
  const files = state.list.filter((t) => t.type === 'file');
  const list = items.filter((t) => t && t.url && (t.type === 'yt' || t.type === 'sc')).map((t) => ({
    id: t.id || uid(), type: t.type, url: t.url, vid: t.vid, title: t.title || null, author: t.author || null, thumb: t.thumb || null,
  }));
  if (loadedUrl) { const m = list.find((t) => t.url === loadedUrl); if (m) m.id = rt.loadedId; }   // keep playback going
  state.list = [...list, ...files];
  state.listUpdatedAt = remoteAt || Date.now();
  lastListJson = JSON.stringify(cloudItems());         // don't echo the download back up
  listMutated(state.list.find((t) => t.url === curUrl)?.id || null);
  state.list.filter((t) => !t.title).forEach(fetchMeta);
}

$('#cloudPull').onclick = () => {
  if (state.list.some((t) => t.type !== 'file') && !confirm('Thay playlist hiện tại bằng playlist trên cloud?')) return;
  cloudPull(true);
};
$('#cloudPush').onclick = () => cloudPush(true);
$('#cloudCfgBtn').onclick = () => { const c = $('#cloudCfg'); c.hidden = !c.hidden; };
$('#cloudBin').value = cloud.bin;
$('#cloudAuto').checked = cloud.auto;
$('#cloudBin').onchange = (e) => {
  const id = parseBin(e.target.value);
  e.target.value = id;
  if (id === cloud.bin) return;
  cloud.bin = id; saveCloudCfg();
  if (id) cloudPull(false); else cloudStatus('☁ Chưa có bin');
};
$('#cloudAuto').onchange = (e) => {
  cloud.auto = e.target.checked; saveCloudCfg();
  if (cloud.auto) cloudPull(false); else { clearTimeout(pushTimer); cloudStatus('☁ Đồng bộ thủ công'); }
};
$('#cloudOpen').onclick = () => cloud.bin && window.open(`https://www.npoint.io/docs/${cloud.bin}`, '_blank');

lastListJson = JSON.stringify(cloudItems());
if (cloud.auto && cloud.bin) cloudPull(false);
else cloudStatus(cloud.bin ? '☁ Đồng bộ thủ công' : '☁ Chưa có bin');
})();
