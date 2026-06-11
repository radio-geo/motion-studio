/* stage.js — preview renderer.
 *
 * THE V2 FIX: the canvas backing store is always exactly the export resolution
 * (1920x1080 or 1080x1920). No devicePixelRatio scaling of the buffer, ever.
 * CSS scales the canvas to fit the stage, which downsamples (supersampled
 * preview, sharp on every display), and what you export is what you previewed.
 *
 * Preview-only overlays (safe-area guides, selection outline) are drawn on a
 * separate transparent canvas stacked above the render canvas, so the render
 * canvas stays clean for captureStream/VideoFrame export.
 */
window.Stage = (function () {
  let cv, octx, ocv;           // render canvas, overlay canvas
  let ctx;
  let duration = 5, fps = 25;
  let drawFrame = function () {};
  let onTick = null;
  let loop = true;
  let playing = false, raf = 0, startWall = 0, baseT = 0;
  let _t = 0;
  let exporting = false;

  const overlays = { safe: false, selRect: null };   // selRect: {x,y,w,h} stage coords

  function mount(opts) {
    cv = opts.canvas;
    ocv = opts.overlayCanvas;
    ctx = cv.getContext("2d");
    octx = ocv ? ocv.getContext("2d") : null;
    drawFrame = opts.drawFrame || drawFrame;
    duration = opts.duration || duration;
    fps = opts.fps || fps;
    onTick = opts.onTick || null;
    seek(0);
  }

  function setTemplate(d, dur) {
    drawFrame = d;
    if (dur) duration = dur;
    seek(0);
  }
  function setFps(f) { fps = f; }
  function setDuration(d) {
    duration = Math.max(0.5, d);
    if (_t > duration) seek(duration);
    if (onTick) onTick(_t / duration, _t);
  }
  function setLoop(v) { loop = !!v; }

  function resize(w, h) {
    cv.width = w; cv.height = h;
    if (ocv) { ocv.width = w; ocv.height = h; }
    renderAt(_t);
  }

  function currentT() { return _t; }

  function renderAt(t) {
    _t = Math.max(0, Math.min(duration, t));
    ctx.save();
    drawFrame(ctx, _t);
    ctx.restore();
    if (!exporting) drawOverlays();
    if (onTick) onTick(duration ? _t / duration : 0, _t);
  }
  function seek(t) { renderAt(t); }
  function seekFraction(p) { renderAt(p * duration); }

  /* exact, overlay-free draw used by the exporter */
  function renderExact(t) {
    ctx.save();
    drawFrame(ctx, Math.max(0, Math.min(duration, t)));
    ctx.restore();
  }
  function setExporting(v) {
    exporting = !!v;
    if (!exporting) renderAt(_t);       // restore preview frame + overlays
    else if (octx) octx.clearRect(0, 0, ocv.width, ocv.height);
  }

  /* ---------- overlays (preview only, separate canvas) ---------- */
  function drawOverlays() {
    if (!octx) return;
    const W = ocv.width, H = ocv.height;
    octx.clearRect(0, 0, W, H);

    if (overlays.safe) {
      octx.save();
      octx.lineWidth = 2;
      octx.setLineDash([10, 8]);
      octx.strokeStyle = "rgba(120,200,255,.4)";          // action safe 93%
      octx.strokeRect(W * 0.035, H * 0.035, W * 0.93, H * 0.93);
      octx.strokeStyle = "rgba(255,200,90,.35)";          // title safe 90%
      octx.strokeRect(W * 0.05, H * 0.05, W * 0.9, H * 0.9);
      octx.setLineDash([]);
      octx.restore();
    }
    if (overlays.selRect) {
      const r = overlays.selRect;
      octx.save();
      octx.lineWidth = 3;
      octx.setLineDash([8, 6]);
      octx.strokeStyle = "rgba(99,140,255,.95)";
      octx.strokeRect(r.x - 8, r.y - 8, r.w + 16, r.h + 16);
      octx.restore();
    }
  }
  function setSafeGuides(v) { overlays.safe = !!v; drawOverlays(); }
  function setSelectionRect(r) { overlays.selRect = r || null; drawOverlays(); }

  /* ---------- transport ---------- */
  function _loop() {
    if (!playing) return;
    const now = performance.now();
    let t = baseT + (now - startWall) / 1000;
    if (t >= duration) {
      if (loop) { t = 0; baseT = 0; startWall = now; }
      else { playing = false; renderAt(duration); return; }
    }
    renderAt(t);
    raf = requestAnimationFrame(_loop);
  }
  function play() {
    if (playing) return;
    playing = true;
    startWall = performance.now();
    baseT = _t >= duration ? 0 : _t;
    _loop();
  }
  function pause() { playing = false; cancelAnimationFrame(raf); }
  function toggle() { playing ? pause() : play(); return playing; }
  function restart() { pause(); seek(0); }

  /* pointer mapping: CSS px -> stage coords */
  function toStage(e) {
    const r = cv.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (cv.width / r.width),
      y: (e.clientY - r.top) * (cv.height / r.height),
    };
  }

  return {
    mount, setTemplate, setFps, setDuration, setLoop, resize,
    play, pause, toggle, restart, seek, seekFraction, renderAt, renderExact,
    currentT, setExporting, setSafeGuides, setSelectionRect, toStage,
    get canvas() { return cv; },
    get duration() { return duration; },
    get fps() { return fps; },
    get playing() { return playing; },
    get loop() { return loop; },
  };
})();

/* Compatibility facade for templates written against the V1 Pipeline API. */
window.Pipeline = {
  setDuration(d) {
    window.Stage.setDuration(d);
    if (window.App && window.App.onDurationChanged) window.App.onDurationChanged(d);
  },
  renderAt(t) { window.Stage.renderAt(t); },
  pause() { window.Stage.pause(); },
  currentT() { return window.Stage.currentT(); },
  seekFraction(p) { window.Stage.seekFraction(p); },
  get duration() { return window.Stage.duration; },
  get fps() { return window.Stage.fps; },
};
