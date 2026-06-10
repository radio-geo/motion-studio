/* app.js — studio controller.
 * Login -> studio. Template registry, panels, transport, brand kit, export.
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
    // English version: load the Latin faces used by UI + canvas content.
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
      onTick: (frac) => { $("#scrub").value = Math.round(frac * 1000); },
    });

    buildBrandPanel();
    buildExportPanel();
    loadTemplate(active);

    wireTransport();
    wireSegs();
    $("#logout-btn").addEventListener("click", () => { window.Auth.signOut(); location.reload(); });

    // try to auto-load a Droeba logo if it was dropped in /assets/brand
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
    tpl.editor($("#editor-panel"), redraw);
    redraw();
  }

  function redraw() { window.Pipeline.renderAt(window.Pipeline.currentT()); }

  /* ---------- transport + segments ---------- */
  function wireTransport() {
    const playBtn = $("#play-btn");
    playBtn.addEventListener("click", () => { playBtn.textContent = window.Pipeline.toggle() ? "Pause" : "Play"; });
    $("#restart-btn").addEventListener("click", () => { window.Pipeline.restart(); playBtn.textContent = "Play"; });
    $("#scrub").addEventListener("input", e => {
      window.Pipeline.pause(); playBtn.textContent = "Play";
      window.Pipeline.seekFraction(e.target.value / 1000);
    });
  }

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
  }

  /* ---------- brand kit panel (shared across templates) ---------- */
  function buildBrandPanel() {
    const bk = window.BrandKit.get();
    const el = $("#brandkit-panel");
    const accents = ["#c1121f", "#e8b400", "#2563eb", "#10803a", "#111418"];
    const positions = ["tl","tc","tr","ml","mc","mr","bl","bc","br"];
    el.innerHTML = `
      <div class="section-title">Brand kit — ${bk.name}</div>
      <div class="field">
        <label>Accent color</label>
        <div class="swatches" id="bk-swatches"></div>
      </div>
      <div class="field">
        <label>Logo</label>
        <div class="logo-drop" id="bk-logo-drop">Click to upload logo (or drop in /assets/brand)</div>
        <input type="file" id="bk-logo" accept="image/*" hidden />
      </div>
      <div class="field">
        <label>Logo position</label>
        <div class="pos-grid" id="bk-pos"></div>
      </div>`;

    const sw = $("#bk-swatches");
    accents.forEach(c => {
      const d = document.createElement("div");
      d.className = "swatch" + (c === bk.palette.accent ? " active" : "");
      d.style.background = c;
      d.addEventListener("click", () => {
        window.BrandKit.setAccent(c);
        [...sw.children].forEach(x => x.classList.toggle("active", x === d));
        redraw();
      });
      sw.appendChild(d);
    });

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

    $("#bk-logo-drop").addEventListener("click", () => $("#bk-logo").click());
    $("#bk-logo").addEventListener("change", async e => {
      const f = e.target.files[0]; if (!f) return;
      await window.BrandKit.setLogo(URL.createObjectURL(f));
      $("#bk-logo-drop").textContent = f.name;
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
