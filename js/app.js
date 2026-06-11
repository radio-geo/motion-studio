/* app.js — studio controller */
(function () {
  const TEMPLATES = [window.QuoteTemplate, window.SocialTemplate, window.SlideshowTemplate, window.PressTemplate];
  let active = TEMPLATES[0];

  const ASPECTS = { "16:9": [1920, 1080], "9:16": [1080, 1920] };
  let aspect = "16:9";

  const $ = s => document.querySelector(s);

  /* ---------- helpers ---------- */
  function parseDuration(str) {
    str = String(str).trim();
    if (str.includes(':')) {
      const parts = str.split(':');
      const m = Math.max(0, parseInt(parts[0], 10) || 0);
      const s = Math.max(0, parseFloat(parts[1]) || 0);
      return m * 60 + s;
    }
    return Math.max(0.5, parseFloat(str) || 0);
  }
  function formatDuration(s) {
    if (s >= 60) {
      const m = Math.floor(s / 60);
      const sec = Math.round(s % 60);
      return m + ':' + String(sec).padStart(2, '0');
    }
    return (s % 1 !== 0 ? s.toFixed(1) : String(s));
  }

  /* ---------- i18n ---------- */
  const L = window.Lang;
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const val = L.t(key);
      // For labels with child inputs, update only the text node before the input
      if (el.tagName === 'LABEL' && el.querySelector('input')) {
        const input = el.querySelector('input');
        el.childNodes.forEach(n => { if (n.nodeType === 3) n.textContent = val + ' '; });
      } else if (el.tagName === 'BUTTON' || el.tagName === 'SPAN' || el.tagName === 'P') {
        el.textContent = val;
      }
    });
    // Sync html lang attr and body class for Georgian font
    document.documentElement.lang = L.getLocale() === 'ge' ? 'ka' : 'en';
    document.body.classList.toggle('lang-ge', L.getLocale() === 'ge');
    // Sync lang toggle active state
    const lt = $('#lang-toggle');
    if (lt) [...lt.children].forEach(b => b.classList.toggle('active', b.dataset.lang === L.getLocale()));
    // Update dur-presets labels
    updateDurPresetsLabels();
    // Update play button
    const pb = $('#play-btn');
    if (pb && pb.textContent !== L.t('pause')) pb.textContent = L.t('play');
  }
  function updateDurPresetsLabels() {
    const dp = $('#dur-presets'); if (!dp) return;
    const keys = ['durPreset5','durPreset15','durPreset30','durPreset1m','durPreset2m'];
    [...dp.children].forEach((b,i) => { if (keys[i]) b.textContent = L.t(keys[i]); });
  }

  /* ---------- LOGIN ---------- */
  function initLogin() {
    applyI18n();
    const form = $('#login-form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const r = window.Auth.signIn($('#login-user').value.trim(), $('#login-pass').value);
      if (r.ok) enterStudio(r.session);
      else { const err = $('#login-error'); err.hidden = false; err.textContent = L.t('loginError'); }
    });
    const cur = window.Auth.current();
    if (cur) enterStudio(cur);
  }

  async function enterStudio(session) {
    $('#login-screen').hidden = true;
    $('#studio-screen').hidden = false;
    $('#active-user').textContent = session.user;
    await preloadFonts();
    initStudio();
  }

  async function preloadFonts() {
    const faces = ['700 40px "ArchivoNarrow"','600 40px "ArchivoNarrow"','400 40px "ArchivoNarrow"','400 40px "AbrilFatface"'];
    try { await Promise.all(faces.map(f => document.fonts.load(f, 'Ag'))); await document.fonts.ready; }
    catch (e) {}
  }

  /* ---------- STUDIO ---------- */
  function initStudio() {
    buildTabs();
    const canvas = $('#stage-canvas');
    const [w, h] = ASPECTS[aspect];
    canvas.width = w; canvas.height = h;

    window.Pipeline.mount({
      canvas,
      drawFrame: (ctx, t) => active.drawFrame(ctx, t),
      duration: active.duration,
      fps: 25,
      onTick: (frac, t) => {
        $('#scrub').value = Math.round(frac * 1000);
        updateTimeDisplay(t);
      },
    });

    buildBrandPanel();
    buildExportPanel();
    loadTemplate(active);

    wireTransport();
    wireSegs();
    wireDuration();
    wireLangToggle();
    wireKeyboard();
    applyI18n();

    $('#logout-btn').addEventListener('click', () => { window.Auth.signOut(); location.reload(); });
    tryAutoLogo();
  }

  function buildTabs() {
    const nav = $('#template-tabs');
    nav.innerHTML = '';
    TEMPLATES.forEach(tpl => {
      const b = document.createElement('button');
      b.className = tpl === active ? 'active' : '';
      b.innerHTML = L.t('template' + tpl.id.charAt(0).toUpperCase() + tpl.id.slice(1)) +
                    (tpl.later ? ' <span class="mini">soon</span>' : '');
      b.addEventListener('click', () => { active = tpl; buildTabs(); loadTemplate(tpl); });
      nav.appendChild(b);
    });
  }

  function loadTemplate(tpl) {
    window.Pipeline.pause();
    const pb = $('#play-btn'); if (pb) pb.textContent = L.t('play');
    window.Pipeline.setTemplate((ctx, t) => tpl.drawFrame(ctx, t), tpl.duration);
    syncDurationControl(tpl.duration, tpl.id === 'slideshow');
    tpl.editor($('#editor-panel'), redraw);
    redraw();
  }

  function redraw() { window.Pipeline.renderAt(window.Pipeline.currentT()); }

  /* ---------- time display ---------- */
  function updateTimeDisplay(t) {
    const el = $('#time-display'); if (!el) return;
    const fmt = s => {
      const m = Math.floor(s / 60), sec = s % 60;
      return (m > 0 ? m + ':' : '') + sec.toFixed(1).padStart(m > 0 ? 4 : 3, '0');
    };
    el.textContent = fmt(t) + ' / ' + fmt(window.Pipeline.duration);
  }

  /* ---------- transport ---------- */
  function wireTransport() {
    const playBtn = $('#play-btn');
    const loopBtn = $('#loop-btn');
    let loopOn = true;
    window.Pipeline.setLoop(true);

    loopBtn && loopBtn.addEventListener('click', () => {
      loopOn = !loopOn;
      window.Pipeline.setLoop(loopOn);
      loopBtn.classList.toggle('active', loopOn);
      loopBtn.title = loopOn ? 'Loop on' : 'Loop off';
    });

    playBtn.addEventListener('click', () => {
      const nowPlaying = window.Pipeline.toggle();
      playBtn.textContent = nowPlaying ? L.t('pause') : L.t('play');
    });
    $('#restart-btn').addEventListener('click', () => {
      window.Pipeline.restart();
      playBtn.textContent = L.t('play');
    });

    let scrubTimer = null;
    $('#scrub').addEventListener('input', e => {
      window.Pipeline.pause();
      playBtn.textContent = L.t('play');
      if (scrubTimer) cancelAnimationFrame(scrubTimer);
      scrubTimer = requestAnimationFrame(() => {
        window.Pipeline.seekFraction(e.target.value / 1000);
      });
    });
  }

  /* ---------- keyboard shortcuts ---------- */
  function wireKeyboard() {
    const playBtn = $('#play-btn');
    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const FRAME = 1 / (window.Pipeline.fps || 25);
      if (e.code === 'Space') {
        e.preventDefault();
        const nowPlaying = window.Pipeline.toggle();
        playBtn.textContent = nowPlaying ? L.t('pause') : L.t('play');
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        window.Pipeline.restart(); playBtn.textContent = L.t('play');
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        window.Pipeline.pause(); playBtn.textContent = L.t('play');
        window.Pipeline.renderAt(window.Pipeline.currentT() + FRAME);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        window.Pipeline.pause(); playBtn.textContent = L.t('play');
        window.Pipeline.renderAt(window.Pipeline.currentT() - FRAME);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        window.Pipeline.pause(); playBtn.textContent = L.t('play');
      }
    });
  }

  /* ---------- aspect + fps ---------- */
  function wireSegs() {
    $('#aspect-seg').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      aspect = b.dataset.aspect;
      [...e.currentTarget.children].forEach(c => c.classList.toggle('active', c === b));
      const [w, h] = ASPECTS[aspect];
      active.invalidate && active.invalidate();
      window.Pipeline.resize(w, h);
      redraw();
    });
    $('#fps-seg').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      [...e.currentTarget.children].forEach(c => c.classList.toggle('active', c === b));
      window.Pipeline.setFps(parseInt(b.dataset.fps, 10));
    });
  }

  /* ---------- flexible duration control ---------- */
  function wireDuration() {
    const input = $('#dur-input');
    const presets = $('#dur-presets');

    // Debounced commit on text input
    let debTimer = null;
    input.addEventListener('input', () => {
      clearTimeout(debTimer);
      debTimer = setTimeout(() => commitDuration(parseDuration(input.value)), 400);
    });
    input.addEventListener('change', () => {
      clearTimeout(debTimer);
      commitDuration(parseDuration(input.value));
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { clearTimeout(debTimer); commitDuration(parseDuration(input.value)); input.blur(); }
    });

    presets.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !b.dataset.dur) return;
      const d = parseFloat(b.dataset.dur);
      [...presets.children].forEach(c => c.classList.toggle('active', c === b));
      input.value = formatDuration(d);
      commitDuration(d);
    });
  }

  function commitDuration(d) {
    if (!d || d < 0.5) return;
    window.Pipeline.setDuration(d);
    active.duration = d;
    updateTimeDisplay(window.Pipeline.currentT());
    syncPresetHighlight(d);
  }

  function syncDurationControl(dur, isAuto) {
    const input = $('#dur-input');
    if (!input) return;
    if (isAuto) {
      input.value = L.t('durAuto');
      input.disabled = true;
      input.title = 'Duration set automatically from slide lengths';
      [...($('#dur-presets').children)].forEach(b => b.classList.remove('active'));
    } else {
      input.disabled = false;
      input.title = 'Duration — type seconds or mm:ss';
      input.value = formatDuration(dur);
      syncPresetHighlight(dur);
    }
  }

  function syncPresetHighlight(dur) {
    const presets = $('#dur-presets'); if (!presets) return;
    const VALS = [5, 15, 30, 60, 120];
    [...presets.children].forEach((b, i) => b.classList.toggle('active', VALS[i] === dur));
  }

  /* ---------- language toggle (topbar) ---------- */
  function wireLangToggle() {
    const lt = $('#lang-toggle');
    if (!lt) return;
    // Set initial active state
    [...lt.children].forEach(b => b.classList.toggle('active', b.dataset.lang === L.getLocale()));

    lt.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !b.dataset.lang) return;
      L.setLocale(b.dataset.lang);
      [...lt.children].forEach(c => c.classList.toggle('active', c === b));
      window.BrandKit.setLocale(b.dataset.lang);
      TEMPLATES.forEach(t => t.invalidate && t.invalidate());
      // Rebuild everything that has translatable strings
      buildTabs();
      buildBrandPanel();
      buildExportPanel();
      loadTemplate(active);
      applyI18n();
    });
  }

  /* ---------- brand kit panel ---------- */
  function buildBrandPanel() {
    const bk = window.BrandKit.get();
    const el = $('#brandkit-panel');
    const accents = ['#c1121f','#e8b400','#2563eb','#10803a','#111418'];
    const positions = ['tl','tc','tr','ml','mc','mr','bl','bc','br'];

    el.innerHTML = `
      <div class="section-title">${L.t('brandKit')} — ${bk.name}</div>
      <div class="field">
        <label>${L.t('accentColor')}</label>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <div class="swatches" id="bk-swatches"></div>
          <input type="color" id="bk-custom-color" value="${bk.palette.accent}"
            title="Custom accent color"
            style="width:30px;height:30px;border-radius:6px;border:2px solid var(--line);background:none;cursor:pointer;padding:0" />
        </div>
      </div>
      <div class="field">
        <label>${L.t('logoLabel')}</label>
        <div class="logo-drop" id="bk-logo-drop">${L.t('logoDropText')}</div>
        <input type="file" id="bk-logo" accept="image/*" hidden />
      </div>
      <div class="field">
        <label>${L.t('logoPosition')}</label>
        <div class="pos-grid" id="bk-pos"></div>
      </div>`;

    const sw = $('#bk-swatches');
    accents.forEach(c => {
      const d = document.createElement('div');
      d.className = 'swatch' + (c === bk.palette.accent ? ' active' : '');
      d.style.background = c;
      d.addEventListener('click', () => {
        window.BrandKit.setAccent(c);
        $('#bk-custom-color').value = c;
        [...sw.children].forEach(x => x.classList.toggle('active', x === d));
        redraw();
      });
      sw.appendChild(d);
    });

    const colorPicker = $('#bk-custom-color');
    let cpTimer = null;
    colorPicker.addEventListener('input', e => {
      clearTimeout(cpTimer);
      cpTimer = setTimeout(() => {
        window.BrandKit.setAccent(e.target.value);
        [...sw.children].forEach(x => x.classList.remove('active'));
        redraw();
      }, 60);
    });

    const pg = $('#bk-pos');
    positions.forEach(p => {
      const b = document.createElement('button');
      b.className = p === bk.logo.position ? 'active' : '';
      b.addEventListener('click', () => {
        window.BrandKit.setLogoPosition(p);
        [...pg.children].forEach(x => x.classList.toggle('active', x === b));
        redraw();
      });
      pg.appendChild(b);
    });

    const logoDrop = $('#bk-logo-drop');
    logoDrop.addEventListener('click', () => $('#bk-logo').click());
    $('#bk-logo').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      await window.BrandKit.setLogo(URL.createObjectURL(f));
      logoDrop.textContent = f.name; redraw();
    });
    logoDrop.addEventListener('dragover', e => { e.preventDefault(); logoDrop.classList.add('drag-over'); });
    logoDrop.addEventListener('dragleave', () => logoDrop.classList.remove('drag-over'));
    logoDrop.addEventListener('drop', async e => {
      e.preventDefault(); logoDrop.classList.remove('drag-over');
      const f = e.dataTransfer.files[0]; if (!f || !f.type.startsWith('image/')) return;
      await window.BrandKit.setLogo(URL.createObjectURL(f));
      logoDrop.textContent = f.name; redraw();
    });
  }

  async function tryAutoLogo() {
    for (const name of ['assets/brand/logo.png','assets/brand/logo.svg','assets/brand/droeba.png']) {
      const ok = await window.BrandKit.setLogo(name);
      if (ok) { redraw(); break; }
    }
  }

  /* ---------- export panel ---------- */
  function buildExportPanel() {
    const F = window.FEATURES;
    const el = $('#export-panel');
    el.innerHTML = `
      <div class="section-title">${L.t('exportHD')}</div>
      <div class="export-row">
        <button class="btn primary" id="exp-webm">WebM</button>
        <button class="btn" id="exp-mp4">MP4</button>
      </div>
      <div class="render-status" id="render-status">${L.t('renderReady')}</div>
      <div class="later-block">
        ${laterItem(F.export4K, L.t('export4K'))}
        ${laterItem(F.proResAlpha, L.t('proRes'))}
        ${laterItem(F.serverRender, L.t('serverRender'))}
        ${laterItem(F.iconGeneration, L.t('iconGen'))}
        ${laterItem(F.assetLibrary, L.t('assetLib'))}
      </div>`;

    const status = $('#render-status');
    const webmBtn = $('#exp-webm'), mp4Btn = $('#exp-mp4');

    webmBtn.addEventListener('click', async () => {
      webmBtn.disabled = mp4Btn.disabled = true;
      status.className = 'render-status';
      status.textContent = L.t('renderingWebM') + ' 0%';
      try {
        const blob = await window.Pipeline.renderWebM(p => {
          status.textContent = L.t('renderingWebM') + ' ' + Math.round(p * 100) + '%';
        });
        window.Pipeline.exportFile(blob, `${active.id}_${aspect.replace(':','x')}.webm`);
        status.className = 'render-status go';
        status.textContent = L.t('webmDone');
      } catch (e) {
        status.className = 'render-status';
        status.textContent = L.t('exportFailed') + ' ' + (e.message || e);
      } finally { webmBtn.disabled = mp4Btn.disabled = false; }
    });

    mp4Btn.addEventListener('click', async () => {
      webmBtn.disabled = mp4Btn.disabled = true;
      status.className = 'render-status';
      status.textContent = L.t('renderingMP4') + ' (first run loads encoder, ~10–20s)';
      try {
        const r = await window.Pipeline.renderMP4(p => {
          status.textContent = L.t('renderingMP4') + ' ' + Math.round(p * 100) + '%';
        });
        if (r.blob) window.Pipeline.exportFile(r.blob, `${active.id}_${aspect.replace(':','x')}.${r.ext}`);
        status.className = 'render-status go';
        status.textContent = r.note || L.t('mp4Done');
      } catch (e) {
        status.className = 'render-status';
        status.textContent = L.t('exportFailed') + ' ' + (e.message || e);
      } finally { webmBtn.disabled = mp4Btn.disabled = false; }
    });
  }

  function laterItem(f, label) {
    return `<div class="later-item" title="${f.note}">
      <span>${label}</span>
      <span style="display:flex;align-items:center;gap:8px">
        <span class="pill">${L.t('comingLater')}</span><span class="toggle"></span>
      </span></div>`;
  }

  document.addEventListener('DOMContentLoaded', initLogin);
})();
