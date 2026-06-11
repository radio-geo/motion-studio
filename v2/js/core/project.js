/* project.js — save / open / autosave. A project is one JSON file with the
   template state (images embedded as dataURLs), brand kit, and stage settings.
   Autosave keeps a draft in localStorage so a refresh never loses work. */
window.Project = (function () {
  const AUTOSAVE_KEY = "ms2_draft";
  let getCtx = null;        // () => {templateId, aspect, fps, duration, motion}
  let applyCtx = null;      // (data) => Promise
  let timer = null;

  function init(getter, applier) { getCtx = getter; applyCtx = applier; }

  function collect() {
    const ctx = getCtx ? getCtx() : {};
    return Object.assign({ v: 2, app: "motion-studio", savedAt: new Date().toISOString() }, ctx, {
      brandkit: window.BrandKit.serialize(),
    });
  }

  function save() {
    const data = collect();
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const name = "motion-studio_" + (data.templateId || "project") + "_" +
      new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-") + ".msproj.json";
    window.Exporter.download(blob, name);
  }

  function openFile(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = async () => {
        try {
          const data = JSON.parse(fr.result);
          if (data.brandkit) await window.BrandKit.restore(data.brandkit);
          if (applyCtx) await applyCtx(data);
          resolve(data);
        } catch (e) { reject(e); }
      };
      fr.onerror = () => reject(new Error("read failed"));
      fr.readAsText(file);
    });
  }

  /* ---- autosave (debounced, size-guarded) ---- */
  function touch() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const data = collect();
        let json = JSON.stringify(data);
        if (json.length > 4_000_000) {           // localStorage quota guard: drop images
          const slim = JSON.parse(json);
          stripImages(slim);
          json = JSON.stringify(slim);
        }
        localStorage.setItem(AUTOSAVE_KEY, json);
        const el = document.getElementById("autosave-dot");
        if (el) { el.classList.add("on"); setTimeout(() => el.classList.remove("on"), 900); }
      } catch (e) { /* quota exceeded: skip silently */ }
    }, 1500);
  }
  function stripImages(o) {
    if (!o || typeof o !== "object") return;
    for (const k in o) {
      if (typeof o[k] === "string" && o[k].slice(0, 5) === "data:") o[k] = null;
      else if (typeof o[k] === "object") stripImages(o[k]);
    }
  }
  async function restoreDraft() {
    try {
      const json = localStorage.getItem(AUTOSAVE_KEY);
      if (!json) return false;
      const data = JSON.parse(json);
      if (data.brandkit) await window.BrandKit.restore(data.brandkit);
      if (applyCtx) await applyCtx(data);
      return true;
    } catch (e) { return false; }
  }
  function clearDraft() { try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) {} }

  return { init, save, openFile, touch, restoreDraft, clearDraft };
})();

/* Feature flags for capabilities intentionally not built yet (switches, not
   rewrites). The UI greys these out and labels them "coming later". */
window.FEATURES = {
  export4K:       { enabled: false, label: "4K export",                note: "needs render server" },
  proResAlpha:    { enabled: false, label: "ProRes 4444 / alpha .mov", note: "needs render server" },
  serverRender:   { enabled: false, label: "Server-side render",       note: "seam present, off" },
  iconGeneration: { enabled: false, label: "AI icon generation",       note: "AI stub" },
  assetLibrary:   { enabled: false, label: "Asset library + Drive",    note: "connector seam, unwired" },
  aiTextHelp:     { enabled: true,  label: "AI help with text",        note: "central free key; user key override later" },
};
window.AI_CONFIG = {
  mode: "central", model: "claude-haiku",
  centralEndpoint: "/api/ai-text", userKey: null,
};
/* Global ambient-motion preference (multiplier consumed by templates). */
window.MotionPrefs = { breath: 1 };
