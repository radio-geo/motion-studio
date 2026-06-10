/* pipeline.js — ENGINE MODULE 3
 *
 * preview -> render -> export, fully browser-side (free forever).
 *   preview : live rAF playback of the active template's drawFrame(ctx, t)
 *   render  : capture canvas via captureStream + MediaRecorder -> WebM (live)
 *             MP4 via ffmpeg.wasm transcode seam (lazy CDN load; graceful fallback)
 *   export  : download the produced Blob
 *
 * Templates register a single source of truth: drawFrame(ctx, t). Because the
 * preview and the render both call the same drawFrame, what you see is what you get.
 *
 * Improvements applied:
 *   - HiDPI / devicePixelRatio aware: canvas backing store scales by dpr, CSS
 *     size stays as set. On Retina screens text is sharp instead of blurry.
 *   - loop flag: when false, playback stops at end instead of looping.
 */
window.Pipeline = (function () {
  let cv, ctx, dpr = 1;
  let duration = 6, fps = 25;
  let drawFrame = (c, t) => {};
  let onTick = null;
  let loop = true;  // loop flag: true = loop preview, false = stop at end

  let playing = false, raf = 0, startWall = 0, baseT = 0;

  function applyDpr() {
    // Scale the canvas backing store by dpr; keep CSS pixel size unchanged.
    dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    const cssW = cv.width  / (cv._dprApplied || 1);
    const cssH = cv.height / (cv._dprApplied || 1);
    cv.style.width  = cssW + "px";
    cv.style.height = cssH + "px";
    cv.width  = cssW * dpr;
    cv.height = cssH * dpr;
    cv._dprApplied = dpr;
    ctx = cv.getContext("2d");
    ctx.scale(dpr, dpr);
  }

  function mount(opts) {
    cv = opts.canvas;
    ctx = cv.getContext("2d");
    drawFrame = opts.drawFrame || drawFrame;
    duration = opts.duration || duration;
    fps = opts.fps || fps;
    onTick = opts.onTick || null;
    applyDpr();
    seekFraction(0);
  }

  function setTemplate(d, dur) {
    drawFrame = d;
    if (dur) duration = dur;
    seekFraction(0);
  }
  function setFps(f) { fps = f; }
  function setDuration(d) {
    duration = d;
    // clamp current position
    if (_t > duration) seekFraction(1);
  }
  function setLoop(v) { loop = !!v; }

  function resize(w, h) {
    // w/h are logical (CSS) pixels; dpr scaling is applied on top.
    cv._dprApplied = 1; // reset so applyDpr re-reads correctly
    cv.width  = w;
    cv.height = h;
    applyDpr();
    renderAt(currentT());
  }

  let _t = 0;
  function currentT() { return _t; }

  function renderAt(t) {
    _t = Math.max(0, Math.min(duration, t));
    ctx.save();
    // Templates draw in logical pixels (1920×1080 etc.). The dpr scale is already
    // on the context from applyDpr(), so we just call drawFrame.
    drawFrame(ctx, _t);
    ctx.restore();
    if (onTick) onTick(_t / duration, _t);
  }

  function seekFraction(p) { renderAt(p * duration); }

  function _loop() {
    if (!playing) return;
    const now = performance.now();
    let t = baseT + (now - startWall) / 1000;
    if (t >= duration) {
      if (loop) {
        t = 0; baseT = 0; startWall = now;
      } else {
        t = duration;
        playing = false;
        renderAt(t);
        if (onTick) onTick(1, t);
        return;
      }
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
  function restart() { pause(); seekFraction(0); }

  /* ---------- RENDER (WebM, live capture) ---------- */
  function pickMime() {
    const c = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    return c.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "video/webm";
  }

  function renderWebM(onProgress) {
    return new Promise((resolve, reject) => {
      try {
        pause();
        if (!cv.captureStream) return reject(new Error("captureStream unsupported in this browser"));
        if (!window.MediaRecorder) return reject(new Error("MediaRecorder unsupported in this browser"));

        const stream = cv.captureStream(fps);
        const rec = new MediaRecorder(stream, { mimeType: pickMime(), videoBitsPerSecond: 8_000_000 });
        const chunks = [];
        let stopped = false;
        const stop = () => { if (!stopped && rec.state !== "inactive") { stopped = true; try { rec.stop(); } catch (e) {} } };

        rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); resolve(new Blob(chunks, { type: "video/webm" })); };
        rec.onerror = e => reject(e.error || new Error("MediaRecorder error"));

        rec.start(100);
        const t0 = performance.now();
        // render frames bypassing the dpr scale (captureStream sees the real canvas pixels)
        (function drive() {
          const t = (performance.now() - t0) / 1000;
          renderAt(Math.min(t, duration));
          if (onProgress) onProgress(Math.min(t / duration, 1));
          if (t < duration) requestAnimationFrame(drive);
          else setTimeout(stop, 150);
        })();
      } catch (e) { reject(e); }
    });
  }

  /* ---------- MP4 via ffmpeg.wasm ---------- */
  let _ffmpeg = null;
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = () => rej(new Error("failed to load " + src));
      document.head.appendChild(s);
    });
  }
  async function getFFmpeg() {
    if (_ffmpeg) return _ffmpeg;
    if (!window.FFmpeg) await loadScript("https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js");
    const { createFFmpeg } = window.FFmpeg;
    _ffmpeg = createFFmpeg({ log: false, corePath: "https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js" });
    await _ffmpeg.load();
    return _ffmpeg;
  }

  async function renderMP4(onProgress) {
    let webm;
    try { webm = await renderWebM(p => onProgress && onProgress(p * 0.6)); }
    catch (e) { return { blob: null, ext: null, note: "Render failed: " + (e.message || e) }; }

    try {
      const ff = await getFFmpeg();
      const { fetchFile } = window.FFmpeg;
      if (onProgress) onProgress(0.65);
      ff.FS("writeFile", "in.webm", await fetchFile(webm));
      await ff.run("-i", "in.webm", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "faststart", "out.mp4");
      const data = ff.FS("readFile", "out.mp4");
      if (onProgress) onProgress(1);
      return { blob: new Blob([data.buffer], { type: "video/mp4" }), ext: "mp4", note: "MP4 (H.264) ready." };
    } catch (e) {
      if (onProgress) onProgress(1);
      return { blob: webm, ext: "webm", note: "MP4 transcode unavailable (" + (e.message || e) + "). Downloaded WebM instead." };
    }
  }

  function exportFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  return {
    mount, setTemplate, setFps, setDuration, setLoop, resize,
    play, pause, toggle, restart, seekFraction, renderAt, currentT,
    renderWebM, renderMP4, exportFile,
    get duration() { return duration; },
    get fps() { return fps; },
    get loop() { return loop; },
  };
})();
