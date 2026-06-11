/* app.js — V2 studio controller: two-panel UI, canvas element selection,
   on-canvas phrase drag, motion prefs, export, project save/load. */
(function () {
  const L = window.Lang;
  const $ = s => document.querySelector(s);

  const ASPECTS = { "16:9": [1920, 1080], "9:16": [1080, 1920] };
  let aspect = "16:9";
  let TEMPLATES = [];
  let active = null;
  let selectedEl = null;

  /* ---------- utils ---------- */
  function parseDuration(str) {
    str = String(str).trim();
    if (str.indexOf(":") >= 0) {
      const p = str.split(":");
      return Math.max(0.5, (parseInt(p[0], 10) || 0) * 60 + (parseFloat(p[1]) || 0));
    }
    return Math.max(0.5, parseFloat(str) || 0);
  }
  function formatDuration(s) {
    if (s >= 60) return Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0");
    return s % 1 !== 0 ? s.toFixed(1) : String(s);
  }

  /* ---------- i18n ---------- */
  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const val = L.t(el.dataset.i18n);
      if (el.tagName === "LABEL" && el.querySelector("input")) {
        el.childNodes.forEach(n => { if (n.nodeType === 3) n.textContent = val + " "; });
      } else el.textContent = val;
    });
    document.documentElement.lang = L.getLocale() === "ge" ? "ka" : "en";
    document.body.classList.toggle("lang-ge", L.getLocale() === "ge");
    const lt = $("#lang-toggle");
    if (lt) [...lt.children].forEach(b => b.classList.toggle("active", b.dataset.lang === L.getLocale()));
  }

  /* ---------- login ---------- */
  function initLogin() {
    applyI18n();
    $("#login-form").addEventListener("submit", e => {
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
    const faces = [
      '700 40px "ArchivoNarrow"', '600 40px "ArchivoNarrow"', '400 40px "ArchivoNarrow"',
      '400 40px "AbrilFatface"', '700 40px "ArchyEdit"', '400 40px "Archy"',
      '700 40px "MtavruliSquare"', '400 40px "Noto Sans Georgian"',
    ];
    try { await Promise.all(faces.map(f => document.fonts.load(f, "Agა"))); await document.fonts.ready; }
    catch (e) {}
  }

  /* ---------- studio ---------- */
  function initStudio() {
    TEMPLATES = [window.QuoteTemplate, window.SocialTemplate, window.SlideshowTemplate, window.PressTemplate].filter(Boolean);
    active = TEMPLATES[0];

    const canvas = $("#stage-canvas");
    const overlay = $("#overlay-canvas");
    const [w, h] = ASPECTS[aspect];
    canvas.width = w; canvas.height = h;
    overlay.width = w; overlay.height = h;

    window.Stage.mount({
      canvas, overlayCanvas: overlay,
      drawFrame: (ctx, t) => active.drawFrame(ctx, t),
      duration: active.duration,
      fps: 25,
      onTick: (frac, t) => {
        $("#scrub").value = Math.round(frac * 1000);
        updateTimeDisplay(t);
        syncPlayLabel();
        if (selectedEl && active.getElementRect)
          window.Stage.setSelectionRect(active.getElementRect(selectedEl));
      },
    });

    window.Project.init(collectProject, applyProject);

    buildTabs();
    buildMotionPanel();
    buildBrandPanel();
    buildExportPanel();
    buildProjectPanel();
    loadTemplate(active);

    wireTransport();
    wireSegs();
    wireDuration();
    wireLangToggle();
    wireKeyboard();
    wireCanvasPointer();
    applyI18n();

    $("#logout-btn").addEventListener("click", () => { window.Auth.signOut(); location.reload(); });
    tryAutoLogo();
    tryRestoreDraft();
  }

  /* ---------- template lifecycle ---------- */
  function buildTabs() {
    const nav = $("#template-tabs");
    nav.innerHTML = "";
    TEMPLATES.forEach(tpl => {
      const b = document.createElement("button");
      b.className = tpl === active ? "active" : "";
      b.textContent = L.t("template" + tpl.id.charAt(0).toUpperCase() + tpl.id.slice(1));
      b.addEventListener("click", () => { active = tpl; selectedEl = null; window.Stage.setSelectionRect(null); buildTabs(); loadTemplate(tpl); });
      nav.appendChild(b);
    });
  }

  function loadTemplate(tpl) {
    window.Stage.pause();
    syncPlayLabel();
    window.Stage.setTemplate((ctx, t) => tpl.drawFrame(ctx, t), tpl.duration);
    syncDurationControl(tpl.duration, tpl.id === "slideshow");
    tpl.editor($("#editor-panel"), redraw);
    selectedEl = tpl.inspector ? (tpl.elements ? tpl.elements[2] || tpl.elements[0] : null) : null;
    buildInspector();
    /* land on a composed "hero" frame instead of the empty first frame */
    window.Stage.seekFraction(0.66);
  }

  function redraw() { window.Stage.renderAt(window.Stage.currentT()); }

  /* expose a couple of hooks for templates/facade */
  window.App = {
    onDurationChanged(d) { syncDurationControl(d, active && active.id === "slideshow"); },
    refreshEditor() { active.editor($("#editor-panel"), redraw); },
    redraw,
  };

  /* ---------- inspector ---------- */
  function buildInspector() {
    const panel = $("#inspector-panel");
    if (!active.inspector || !active.elements) {
      panel.innerHTML = `<div class="section-title">${L.t("inspectorTitle")}</div>
        <div class="hint">${L.t("inspectorHint")}</div>`;
      return;
    }
    panel.innerHTML = `<div class="section-title">${L.t("inspectorTitle")}</div>
      <div class="el-chips" id="el-chips"></div>
      <div id="insp-body"></div>`;
    const chips = $("#el-chips");
    active.elements.forEach(id => {
      const b = document.createElement("button");
      b.dataset.el = id;
      b.textContent = L.t("el" + id.charAt(0).toUpperCase() + id.slice(1));
      b.className = id === selectedEl ? "active" : "";
      b.addEventListener("click", () => selectElement(id));
      chips.appendChild(b);
    });
    if (selectedEl) active.inspector(selectedEl, $("#insp-body"), redraw);
  }

  function selectElement(id) {
    selectedEl = id;
    const chips = $("#el-chips");
    if (chips) [...chips.children].forEach(b => b.classList.toggle("active", b.dataset.el === id));
    if (active.inspector) active.inspector(id, $("#insp-body"), redraw);
    window.Stage.setSelectionRect(active.getElementRect ? active.getElementRect(id) : null);
  }

  /* ---------- canvas pointer: element select + phrase drag ---------- */
  function wireCanvasPointer() {
    const canvas = $("#stage-canvas");
    let dragging = false, dragMoved = false, downPos = null;

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", e => {
      const p = window.Stage.toStage(e);
      downPos = p; dragMoved = false;
      if (active.wordAt) {
        const wi = active.wordAt(p.x, p.y);
        if (wi >= 0) {
          window.Stage.pause(); syncPlayLabel();
          active.tt.dragStart(wi);
          dragging = true;
          canvas.setPointerCapture(e.pointerId);
          redraw();
          return;
        }
      }
      dragging = false;
    });
    canvas.addEventListener("pointermove", e => {
      if (!dragging) return;
      const p = window.Stage.toStage(e);
      const wi = active.wordAt(p.x, p.y);
      if (wi >= 0) { active.tt.dragTo(wi); dragMoved = true; active.invalidate && active.invalidate(); redraw(); }
    });
    canvas.addEventListener("pointerup", e => {
      const p = window.Stage.toStage(e);
      if (dragging) {
        dragging = false;
        active.tt.dragEnd();
        active.invalidate && active.invalidate();
        window.App.refreshEditor();
        if (active.elements && active.elements.indexOf("phrase") >= 0) selectElement("phrase");
        redraw();
        return;
      }
      /* simple click: element selection */
      if (active.hit && downPos && Math.abs(p.x - downPos.x) < 14 && Math.abs(p.y - downPos.y) < 14) {
        selectElement(active.hit(p.x, p.y));
      }
    });
  }

  /* ---------- time / transport ---------- */
  function updateTimeDisplay(t) {
    const el = $("#time-display"); if (!el) return;
    const fmt = s => {
      const m = Math.floor(s / 60), sec = s % 60;
      return (m > 0 ? m + ":" : "") + sec.toFixed(1).padStart(m > 0 ? 4 : 3, "0");
    };
    el.textContent = fmt(t) + " / " + fmt(window.Stage.duration);
  }
  function syncPlayLabel() {
    const pb = $("#play-btn"); if (!pb) return;
    const want = window.Stage.playing ? L.t("pause") : L.t("play");
    if (pb.textContent !== want) pb.textContent = want;
  }

  function wireTransport() {
    $("#play-btn").addEventListener("click", () => { window.Stage.toggle(); syncPlayLabel(); });
    $("#restart-btn").addEventListener("click", () => { window.Stage.restart(); syncPlayLabel(); });
    const loopBtn = $("#loop-btn");
    loopBtn.addEventListener("click", () => {
      window.Stage.setLoop(!window.Stage.loop);
      loopBtn.classList.toggle("active", window.Stage.loop);
    });
    const guidesBtn = $("#guides-btn");
    guidesBtn.addEventListener("click", () => {
      const on = !guidesBtn.classList.contains("active");
      guidesBtn.classList.toggle("active", on);
      window.Stage.setSafeGuides(on);
    });
    let scrubTimer = null;
    $("#scrub").addEventListener("input", e => {
      window.Stage.pause(); syncPlayLabel();
      if (scrubTimer) cancelAnimationFrame(scrubTimer);
      scrubTimer = requestAnimationFrame(() => window.Stage.seekFraction(e.target.value / 1000));
    });
  }

  function wireKeyboard() {
    document.addEventListener("keydown", e => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const FRAME = 1 / (window.Stage.fps || 25);
      if (e.code === "Space") { e.preventDefault(); window.Stage.toggle(); syncPlayLabel(); }
      else if (e.code === "KeyR") { e.preventDefault(); window.Stage.restart(); syncPlayLabel(); }
      else if (e.code === "ArrowRight") { e.preventDefault(); window.Stage.pause(); window.Stage.renderAt(window.Stage.currentT() + FRAME); syncPlayLabel(); }
      else if (e.code === "ArrowLeft") { e.preventDefault(); window.Stage.pause(); window.Stage.renderAt(window.Stage.currentT() - FRAME); syncPlayLabel(); }
      else if (e.code === "Escape") { selectedEl = null; window.Stage.setSelectionRect(null); buildInspector(); }
    });
  }

  /* ---------- aspect + fps ---------- */
  function wireSegs() {
    $("#aspect-seg").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      aspect = b.dataset.aspect;
      [...e.currentTarget.children].forEach(c => c.classList.toggle("active", c === b));
      const [w, h] = ASPECTS[aspect];
      TEMPLATES.forEach(t => t.invalidate && t.invalidate());
      window.Stage.resize(w, h);
      $("#overlay-canvas").width = w; $("#overlay-canvas").height = h;
      redraw();
    });
    $("#fps-seg").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      [...e.currentTarget.children].forEach(c => c.classList.toggle("active", c === b));
      window.Stage.setFps(parseInt(b.dataset.fps, 10));
    });
  }

  /* ---------- duration ---------- */
  function wireDuration() {
    const input = $("#dur-input");
    const presets = $("#dur-presets");
    let deb = null;
    input.addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(() => commitDuration(parseDuration(input.value)), 400); });
    input.addEventListener("change", () => { clearTimeout(deb); commitDuration(parseDuration(input.value)); });
    input.addEventListener("keydown", e => { if (e.key === "Enter") { clearTimeout(deb); commitDuration(parseDuration(input.value)); input.blur(); } });
    presets.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b || !b.dataset.dur) return;
      const d = parseFloat(b.dataset.dur);
      [...presets.children].forEach(c => c.classList.toggle("active", c === b));
      input.value = formatDuration(d);
      commitDuration(d);
    });
  }
  function commitDuration(d) {
    if (!d || d < 0.5) return;
    window.Stage.setDuration(d);
    active.duration = d;
    active.invalidate && active.invalidate();
    updateTimeDisplay(window.Stage.currentT());
    syncPresetHighlight(d);
    redraw();
    window.Project.touch();
  }
  function syncDurationControl(dur, isAuto) {
    const input = $("#dur-input"); if (!input) return;
    if (isAuto) {
      input.value = L.t("durAuto"); input.disabled = true;
      [...$("#dur-presets").children].forEach(b => b.classList.remove("active"));
    } else {
      input.disabled = false;
      input.value = formatDuration(dur);
      syncPresetHighlight(dur);
    }
    window.Stage.setDuration(dur);
    updateTimeDisplay(window.Stage.currentT());
  }
  function syncPresetHighlight(dur) {
    const VALS = [5, 15, 30, 60, 120];
    [...$("#dur-presets").children].forEach((b, i) => b.classList.toggle("active", VALS[i] === dur));
  }

  /* ---------- language ---------- */
  function wireLangToggle() {
    $("#lang-toggle").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b || !b.dataset.lang) return;
      L.setLocale(b.dataset.lang);
      window.BrandKit.setLocale(b.dataset.lang);
      TEMPLATES.forEach(t => t.invalidate && t.invalidate());
      buildTabs();
      buildMotionPanel();
      buildBrandPanel();
      buildExportPanel();
      buildProjectPanel();
      loadTemplate(active);
      applyI18n();
    });
  }

  /* ---------- motion panel ---------- */
  function buildMotionPanel() {
    const el = $("#motion-panel");
    const cur = window.MotionPrefs.breath;
    const opts = [[0, "breathOff"], [0.5, "breathSubtle"], [1, "breathNormal"], [1.8, "breathStrong"]];
    el.innerHTML = `<div class="section-title">${L.t("motionTitle")}</div>
      <div class="field"><label>${L.t("breathing")}</label>
        <div class="seg" id="breath-seg">${opts.map(([v, k]) =>
          `<button data-v="${v}"${Math.abs(cur - v) < 0.01 ? ' class="active"' : ""}>${L.t(k)}</button>`).join("")}</div>
      </div>`;
    $("#breath-seg").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      window.MotionPrefs.breath = parseFloat(b.dataset.v);
      [...$("#breath-seg").children].forEach(c => c.classList.toggle("active", c === b));
      redraw();
      window.Project.touch();
    });
  }

  /* ---------- brand panel ---------- */
  function buildBrandPanel() {
    const bk = window.BrandKit.get();
    const el = $("#brandkit-panel");
    const accents = ["#c1121f", "#e8b400", "#2563eb", "#10803a", "#111418"];
    el.innerHTML = `
      <div class="section-title">${L.t("brandKit")} — ${bk.name}</div>
      <div class="field">
        <label>${L.t("accentColor")}</label>
        <div class="row">
          <div class="swatches fixed" id="bk-swatches"></div>
          <input class="fixed" type="color" id="bk-custom-color" value="${bk.palette.accent}" />
        </div>
      </div>
      <div class="field">
        <label>${L.t("accent2Color")}</label>
        <input type="color" id="bk-accent2" value="${bk.palette.accent2}" />
      </div>
      <div class="field">
        <label>${L.t("logoLabel")}</label>
        <div class="logo-drop" id="bk-logo-drop">${L.t("logoDropText")}</div>
        <input type="file" id="bk-logo" accept="image/*" hidden />
      </div>`;
    const sw = $("#bk-swatches");
    accents.forEach(c => {
      const d = document.createElement("div");
      d.className = "swatch" + (c === bk.palette.accent ? " active" : "");
      d.style.background = c;
      d.addEventListener("click", () => {
        window.BrandKit.setAccent(c);
        $("#bk-custom-color").value = c;
        [...sw.children].forEach(x => x.classList.toggle("active", x === d));
        redraw(); window.Project.touch();
      });
      sw.appendChild(d);
    });
    $("#bk-custom-color").addEventListener("input", e => {
      window.BrandKit.setAccent(e.target.value);
      [...sw.children].forEach(x => x.classList.remove("active"));
      redraw(); window.Project.touch();
    });
    $("#bk-accent2").addEventListener("input", e => { window.BrandKit.setAccent2(e.target.value); redraw(); window.Project.touch(); });
    const drop = $("#bk-logo-drop");
    drop.addEventListener("click", () => $("#bk-logo").click());
    $("#bk-logo").addEventListener("change", async e => {
      const f = e.target.files[0]; if (!f) return;
      await window.BrandKit.setLogo(URL.createObjectURL(f));
      drop.textContent = f.name; redraw(); window.Project.touch();
    });
    drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("drag-over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
    drop.addEventListener("drop", async e => {
      e.preventDefault(); drop.classList.remove("drag-over");
      const f = e.dataTransfer.files[0]; if (!f || f.type.indexOf("image/") !== 0) return;
      await window.BrandKit.setLogo(URL.createObjectURL(f));
      drop.textContent = f.name; redraw(); window.Project.touch();
    });
  }

  async function tryAutoLogo() {
    const candidates = [
      "/assets/brand/logo.png", "/assets/brand/logo.svg", "/assets/brand/droeba.png",
      "/droeba%20logos/92215501_2546196645485331_4754839275562860544_n.png",
    ];
    for (const src of candidates) {
      const ok = await window.BrandKit.setLogo(src);
      if (ok) { redraw(); break; }
    }
  }

  /* ---------- export panel ---------- */
  function buildExportPanel() {
    const F = window.FEATURES;
    const el = $("#export-panel");
    el.innerHTML = `
      <div class="section-title">${L.t("exportHD")}</div>
      <div class="export-row">
        <button class="btn primary" id="exp-mp4">MP4</button>
        <button class="btn" id="exp-webm">WebM</button>
        <button class="btn" id="exp-png">${L.t("pngFrame")}</button>
      </div>
      <div class="progress" id="exp-progress" hidden><div></div></div>
      <div class="render-status" id="render-status">${L.t("renderReady")}</div>
      <div class="hint">${L.t("engineNote")}</div>
      <button class="btn ghost small" id="exp-cancel" hidden>${L.t("exportCancel")}</button>
      <div class="later-block">
        ${laterItem(F.export4K, L.t("export4K"))}
        ${laterItem(F.proResAlpha, L.t("proRes"))}
        ${laterItem(F.serverRender, L.t("serverRender"))}
        ${laterItem(F.iconGeneration, L.t("iconGen"))}
        ${laterItem(F.assetLibrary, L.t("assetLib"))}
      </div>`;

    const status = $("#render-status");
    const bar = $("#exp-progress");
    const cancelBtn = $("#exp-cancel");
    const btns = ["#exp-mp4", "#exp-webm", "#exp-png"].map(s => $(s));

    async function runVideo(format) {
      btns.forEach(b => b.disabled = true);
      bar.hidden = false; cancelBtn.hidden = false;
      bar.firstElementChild.style.width = "0%";
      status.className = "render-status";
      status.textContent = L.t("rendering") + " " + format.toUpperCase() + " · 0%";
      try {
        const r = await window.Exporter.exportVideo({
          format,
          onProgress: p => {
            bar.firstElementChild.style.width = Math.round(p * 100) + "%";
            status.textContent = L.t("rendering") + " " + format.toUpperCase() + " · " + Math.round(p * 100) + "%";
          },
        });
        const name = "motion-studio_" + active.id + "_" + aspect.replace(":", "x") + "." + r.ext;
        window.Exporter.download(r.blob, name);
        status.className = "render-status go";
        status.textContent = (r.note === "noWebCodecs" ? L.t("noWebCodecs") + " " : "") +
          (r.ext === "mp4" ? L.t("mp4Done") : L.t("webmDone"));
      } catch (e) {
        status.className = "render-status bad";
        status.textContent = (e && e.message === "cancelled") ? L.t("exportCancelled")
          : L.t("exportFailed") + " " + (e.message || e);
      } finally {
        btns.forEach(b => b.disabled = false);
        bar.hidden = true; cancelBtn.hidden = true;
      }
    }
    $("#exp-mp4").addEventListener("click", () => runVideo("mp4"));
    $("#exp-webm").addEventListener("click", () => runVideo("webm"));
    $("#exp-png").addEventListener("click", async () => {
      try {
        const blob = await window.Exporter.exportPNG();
        window.Exporter.download(blob, "motion-studio_" + active.id + "_frame.png");
        status.className = "render-status go";
        status.textContent = L.t("pngDone");
      } catch (e) {
        status.className = "render-status bad";
        status.textContent = L.t("exportFailed") + " " + (e.message || e);
      }
    });
    cancelBtn.addEventListener("click", () => window.Exporter.cancel());
  }
  function laterItem(f, label) {
    return `<div class="later-item" title="${f.note}"><span>${label}</span><span class="pill">${L.t("comingLater")}</span></div>`;
  }

  /* ---------- project panel ---------- */
  function buildProjectPanel() {
    const el = $("#project-panel");
    el.innerHTML = `
      <div class="section-title">${L.t("projectTitle")}<span id="autosave-dot" title="${L.t("autosaved")}"></span></div>
      <div class="proj-row">
        <button class="btn" id="proj-save">${L.t("saveProject")}</button>
        <button class="btn" id="proj-open">${L.t("openProject")}</button>
        <button class="btn ghost" id="proj-reset">${L.t("resetProject")}</button>
      </div>
      <input type="file" id="proj-file" accept=".json,.msproj" hidden />
      <div class="hint" id="proj-status"></div>`;
    $("#proj-save").addEventListener("click", () => window.Project.save());
    $("#proj-open").addEventListener("click", () => $("#proj-file").click());
    $("#proj-file").addEventListener("change", async e => {
      const f = e.target.files[0]; if (!f) return;
      try { await window.Project.openFile(f); $("#proj-status").textContent = f.name; }
      catch (err) { $("#proj-status").textContent = String(err.message || err); }
    });
    $("#proj-reset").addEventListener("click", () => {
      if (confirm(L.t("resetConfirm"))) { window.Project.clearDraft(); location.reload(); }
    });
  }

  function collectProject() {
    return {
      templateId: active.id,
      aspect,
      fps: window.Stage.fps,
      duration: window.Stage.duration,
      motion: window.MotionPrefs.breath,
      state: active.serialize ? active.serialize() : null,
    };
  }
  async function applyProject(data) {
    if (data.templateId) {
      const tpl = TEMPLATES.find(t => t.id === data.templateId);
      if (tpl) active = tpl;
    }
    if (data.motion != null) window.MotionPrefs.breath = data.motion;
    if (data.aspect && ASPECTS[data.aspect]) {
      aspect = data.aspect;
      const seg = $("#aspect-seg");
      [...seg.children].forEach(c => c.classList.toggle("active", c.dataset.aspect === aspect));
      const [w, h] = ASPECTS[aspect];
      window.Stage.resize(w, h);
      $("#overlay-canvas").width = w; $("#overlay-canvas").height = h;
    }
    if (data.state && active.restore) await active.restore(data.state);
    if (data.duration) active.duration = data.duration;
    buildTabs();
    buildMotionPanel();
    loadTemplate(active);
  }
  async function tryRestoreDraft() {
    const ok = await window.Project.restoreDraft();
    if (ok) {
      const st = $("#proj-status");
      if (st) st.textContent = L.t("restoredDraft");
    }
  }

  document.addEventListener("DOMContentLoaded", initLogin);
})();
