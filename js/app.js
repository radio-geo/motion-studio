/* app.js — studio controller.
 * Login -> studio. Template registry, panels, transport, brand kit, export.
 *
 * Improvements in this revision:
 *   #3  drag-drop on background upload (wired in quote.js editor build)
 *   #4  keyboard shortcuts: Space=play/pause, R=restart, ←/→=step frame, Esc=pause
 *   #5  time display on scrubber  (MM:SS.f / total)
 *   #6  duration segment control  (5 / 7 / 10 / 15 s)
 *   #7  custom accent color picker in Brand Kit
 *   #9  Georgian locale toggle in Brand Kit panel
 */
(function () {
  const TEMPLATES = [window.QuoteTemplate, window.SocialTemplate, window.SlideshowTemplate];
  let active = TEMPLATES[0];

  const ASPECTS = { "16:9": [1920, 1080], "9:16": [1080, 1920] };
  let aspect = "16:9";

  const $ = s => document.querySelector(s);

  /* ---------- LOGIN ---------- */
  function initLogin() {
    const form = $("#login-form");
    form.addEventListener("submit", e => {
      e.preventDefault();
      const r = window.Auth.signIn($("#login-user").value.trim(), $("#login-pass").value);
      if (r.ok) enterStudio(r.session);
      else $("#login-error").hidden = false;
    });
    const cur = window.Auth.current();
    if (cur) enterStudio(cur);
  }

  async function enterStudio(session) {
    $("#login-screen").hidden = true;
    $("#studio-screen").hidden = false;
    $("#active-user").textContent = session.user;
    await preloadFonts();
    initStudio();
  }

  async function preloadFonts() {
    const faces = ['700 40px "ArchivoNarrow"', '600 40px "ArchivoNarrow"', '400 40px "ArchivoNarrow"', '400 40px "AbrilFatface"'];
    try { await Promise.all(faces.map(f => document.fonts.load(f, "Ag"))); await document.fonts.ready; }
    catch (e) { /* fonts still resolve via font-display */ }
  }

  /* ---------- STUDIO ---------- */
  function initStudio() {
    buildTabs();
    const canvas = $("#stage-canvas");
    const [w, h] = ASPECTS[aspect];
    canvas.width = w; canvas.height = h;

    window.Pipeline.mount({
      canvas,
      drawFrame: (ctx, t) => active.drawFrame(ctx, t),
      duration: active.duration,
      fps: 25,
      onTick: (frac, t) => {
        $("#scrub").value = Math.round(frac * 1000);
        updateTimeDisplay(t);
      },
    });

    buildBrandPanel();
    buildExportPanel();
    loadTemplate(active);

    wireTransport();
    wireSegs();
    wireKeyboard();
    $("#logout-btn").addEventListener("click", () => { window.Auth.signOut(); location.reload(); });

    tryAutoLogo();
  }

  function buildTabs() {
    const nav = $("#template-tabs");
    nav.innerHTML = "";
    TEMPLATES.forEach(tpl => {
      const b = document.createElement("button");
      b.className = tpl === active ? "active" : "";
      b.innerHTML = tpl.name + (tpl.later ? ' <span class="mini">soon</span>' : "");
      b.addEventListener("click", () => { active = tpl; buildTabs(); loadTemplate(tpl); });
      nav.appendChild(b);
    });
  }

  function loadTemplate(tpl) {
    window.Pipeline.pause();
    window.Pipeline.setTemplate((ctx, t) => tpl.drawFrame(ctx, t), tpl.duration);
    // sync duration seg to the template's duration
    syncDurationSeg(tpl.duration);
    tpl.editor($("#editor-panel"), redraw);
    redraw();
  }

  function redraw() { window.Pipeline.renderAt(window.Pipeline.currentT()); }

  /* ---------- time display ---------- */
  function updateTimeDisplay(t) {
    const el = $("#time-display");
    if (!el) return;
    const fmt = s => {
      const m = Math.floor(s / 60), sec = s % 60;
      return (m > 0 ? m + ":" : "") + sec.toFixed(1).padStart(m > 0 ? 4 : 3, "0");
    };
    el.textContent = fmt(t) + " / " + fmt(window.Pipeline.duration);
  }

  /* ---------- transport + segments ---------- */
  function wireTransport() {
    const playBtn = $("#play-btn");

    // Loop toggle (improvement #8)
    const loopBtn = $("#loop-btn");
    let loopOn = true;
    window.Pipeline.setLoop(true);
    loopBtn && loopBtn.addEventListener("click", () => {
      loopOn = !loopOn;
      window.Pipeline.setLoop(loopOn);
      loopBtn.classList.toggle("active", loopOn);
      loopBtn.title = loopOn ? "Loop on (click to turn off)" : "Loop off (click to turn on)";
    });
    if (loopBtn) { loopBtn.classList.add("active"); loopBtn.title = "Loop on (click to turn off)"; }

    playBtn.addEventListener("click", () => {
      const nowPlaying = window.Pipeline.toggle();
      playBtn.textContent = nowPlaying ? "Pause" : "Play";
    });
    $("#restart-btn").addEventListener("click", () => { window.Pipeline.restart(); playBtn.textContent = "Play"; });
    $("#scrub").addEventListener("input", e => {
      window.Pipeline.pause(); playBtn.textContent = "Play";
      window.Pipeline.seekFraction(e.target.value / 1000);
    });
  }

  /* ---------- keyboard shortcuts (improvement #4) ---------- */
  function wireKeyboard() {
    const playBtn = $("#play-btn");
    document.addEventListener("keydown", e => {
      // Ignore when typing in an input / textarea / select
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      const FRAME = 1 / (window.Pipeline.fps || 25);

      if (e.code === "Space") {
        e.preventDefault();
        const nowPlaying = window.Pipeline.toggle();
        playBtn.textContent = nowPlaying ? "Pause" : "Play";
      } else if (e.code === "KeyR") {
        e.preventDefault();
        window.Pipeline.restart();
        playBtn.textContent = "Play";
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        window.Pipeline.pause(); playBtn.textContent = "Play";
        window.Pipeline.renderAt(window.Pipeline.currentT() + FRAME);
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        window.Pipeline.pause(); playBtn.textContent = "Play";
        window.Pipeline.renderAt(window.Pipeline.currentT() - FRAME);
      } else if (e.code === "Escape") {
        e.preventDefault();
        window.Pipeline.pause(); playBtn.textContent = "Play";
      }
    });
  }

  /* ---------- aspect + fps + duration segments ---------- */
  function wireSegs() {
    $("#aspect-seg").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      aspect = b.dataset.aspect;
      [...e.currentTarget.children].forEach(c => c.classList.toggle("active", c === b));
      const [w, h] = ASPECTS[aspect];
      active.invalidate && active.invalidate();
      window.Pipeline.resize(w, h);
      redraw();
    });
    $("#fps-seg").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      [...e.currentTarget.children].forEach(c => c.classList.toggle("active", c === b));
      window.Pipeline.setFps(parseInt(b.dataset.fps, 10));
    });

    // Duration segment (improvement #6)
    const durSeg = $("#dur-seg");
    if (durSeg) {
      durSeg.addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b || !b.dataset.dur) return;
        const d = parseFloat(b.dataset.dur);
        [...durSeg.children].forEach(c => c.classList.toggle("active", c === b));
        window.Pipeline.setDuration(d);
        active.duration = d;
        updateTimeDisplay(window.Pipeline.currentT());
      });
    }
  }

  function syncDurationSeg(dur) {
    const durSeg = $("#dur-seg"); if (!durSeg) return;
    const DURATIONS = [5, 7, 10, 15];
    // pick closest
    let best = DURATIONS.reduce((a, b) => Math.abs(b - dur) < Math.abs(a - dur) ? b : a);
    [...durSeg.children].forEach(b => {
      const d = parseFloat(b.dataset.dur);
      b.classList.toggle("active", d === best);
    });
  }

  /* ---------- brand kit panel ---------- */
  function buildBrandPanel() {
    const bk = window.BrandKit.get();
    const el = $("#brandkit-panel");
    const accents = ["#c1121f", "#e8b400", "#2563eb", "#10803a", "#111418"];
    const positions = ["tl","tc","tr","ml","mc","mr","bl","bc","br"];

    el.innerHTML = `
      <div class="section-title">Brand kit — ${bk.name}</div>

      <!-- Locale toggle (improvement #9) -->
      <div class="field">
        <label>Language / ენა</label>
        <div class="seg" id="locale-seg" style="width:fit-content">
          <button data-locale="en" class="active">EN</button>
          <button data-locale="ge">GE</button>
        </div>
      </div>

      <div class="field">
        <label>Accent color</label>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <div class="swatches" id="bk-swatches"></div>
          <!-- Custom color picker (improvement #7) -->
          <input type="color" id="bk-custom-color" value="${bk.palette.accent}"
            title="Custom accent color"
            style="width:30px;height:30px;border-radius:6px;border:2px solid var(--line);background:none;cursor:pointer;padding:0" />
        </div>
      </div>

      <div class="field">
        <label>Logo</label>
        <div class="logo-drop" id="bk-logo-drop">Click or drop a logo file</div>
        <input type="file" id="bk-logo" accept="image/*" hidden />
      </div>
      <div class="field">
        <label>Logo position</label>
        <div class="pos-grid" id="bk-pos"></div>
      </div>`;

    // Locale toggle
    const localeSeg = $("#locale-seg");
    localeSeg.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b || !b.dataset.locale) return;
      [...localeSeg.children].forEach(c => c.classList.toggle("active", c === b));
      window.BrandKit.setLocale(b.dataset.locale);
      // Invalidate every template that tracks layout sig
      TEMPLATES.forEach(t => t.invalidate && t.invalidate());
      redraw();
    });

    // Swatches
    const sw = $("#bk-swatches");
    accents.forEach(c => {
      const d = document.createElement("div");
      d.className = "swatch" + (c === bk.palette.accent ? " active" : "");
      d.style.background = c;
      d.addEventListener("click", () => {
        window.BrandKit.setAccent(c);
        $("#bk-custom-color").value = c;
        [...sw.children].forEach(x => x.classList.toggle("active", x === d));
        redraw();
      });
      sw.appendChild(d);
    });

    // Custom color picker (improvement #7)
    const colorPicker = $("#bk-custom-color");
    colorPicker.addEventListener("input", e => {
      window.BrandKit.setAccent(e.target.value);
      [...sw.children].forEach(x => x.classList.remove("active"));
      redraw();
    });

    // Logo position
    const pg = $("#bk-pos");
    positions.forEach(p => {
      const b = document.createElement("button");
      b.className = p === bk.logo.position ? "active" : "";
      b.addEventListener("click", () => {
        window.BrandKit.setLogoPosition(p);
        [...pg.children].forEach(x => x.classList.toggle("active", x === b));
        redraw();
      });
      pg.appendChild(b);
    });

    // Logo upload (click)
    const logoDrop = $("#bk-logo-drop");
    logoDrop.addEventListener("click", () => $("#bk-logo").click());
    $("#bk-logo").addEventListener("change", async e => {
      const f = e.target.files[0]; if (!f) return;
      await window.BrandKit.setLogo(URL.createObjectURL(f));
      logoDrop.textContent = f.name;
      redraw();
    });
    // Logo drop (improvement #3 applies here too)
    logoDrop.addEventListener("dragover", e => { e.preventDefault(); logoDrop.classList.add("drag-over"); });
    logoDrop.addEventListener("dragleave", () => logoDrop.classList.remove("drag-over"));
    logoDrop.addEventListener("drop", async e => {
      e.preventDefault(); logoDrop.classList.remove("drag-over");
      const f = e.dataTransfer.files[0]; if (!f || !f.type.startsWith("image/")) return;
      await window.BrandKit.setLogo(URL.createObjectURL(f));
      logoDrop.textContent = f.name;
      redraw();
    });
  }

  async function tryAutoLogo() {
    for (const name of ["assets/brand/logo.png", "assets/brand/logo.svg", "assets/brand/droeba.png"]) {
      const ok = await window.BrandKit.setLogo(name);
      if (ok) { redraw(); break; }
    }
  }

  /* ---------- export panel ---------- */
  function buildExportPanel() {
    const F = window.FEATURES;
    const el = $("#export-panel");
    el.innerHTML = `
      <div class="section-title">Export — HD</div>
      <div class="export-row">
        <button class="btn primary" id="exp-webm">WebM</button>
        <button class="btn" id="exp-mp4">MP4</button>
      </div>
      <div class="render-status" id="render-status">Live preview ready. Approve, then export.</div>
      <div class="later-block">
        ${laterItem(F.export4K)}
        ${laterItem(F.proResAlpha)}
        ${laterItem(F.serverRender)}
        ${laterItem(F.iconGeneration)}
        ${laterItem(F.assetLibrary)}
      </div>`;

    const status = $("#render-status");
    const webmBtn = $("#exp-webm"), mp4Btn = $("#exp-mp4");

    webmBtn.addEventListener("click", async () => {
      webmBtn.disabled = mp4Btn.disabled = true;
      status.className = "render-status"; status.textContent = "Rendering WebM… 0%";
      try {
        const blob = await window.Pipeline.renderWebM(p => status.textContent = `Rendering WebM… ${Math.round(p*100)}%`);
        window.Pipeline.exportFile(blob, `${active.id}_${aspect.replace(":","x")}.webm`);
        status.className = "render-status go"; status.textContent = "WebM downloaded.";
      } catch (e) {
        status.className = "render-status"; status.textContent = "Export failed: " + (e.message || e);
      } finally { webmBtn.disabled = mp4Btn.disabled = false; }
    });

    mp4Btn.addEventListener("click", async () => {
      webmBtn.disabled = mp4Btn.disabled = true;
      status.className = "render-status"; status.textContent = "Rendering MP4… (first run loads the encoder, ~10–20s)";
      try {
        const r = await window.Pipeline.renderMP4(p => status.textContent = `Rendering MP4… ${Math.round(p*100)}%`);
        if (r.blob) window.Pipeline.exportFile(r.blob, `${active.id}_${aspect.replace(":","x")}.${r.ext}`);
        status.className = "render-status go"; status.textContent = r.note || "Done.";
      } catch (e) {
        status.className = "render-status"; status.textContent = "Export failed: " + (e.message || e);
      } finally { webmBtn.disabled = mp4Btn.disabled = false; }
    });
  }

  function laterItem(f) {
    return `<div class="later-item" title="${f.note}">
      <span>${f.label}</span>
      <span style="display:flex;align-items:center;gap:8px">
        <span class="pill">coming later</span><span class="toggle"></span>
      </span></div>`;
  }

  document.addEventListener("DOMContentLoaded", initLogin);
})();
