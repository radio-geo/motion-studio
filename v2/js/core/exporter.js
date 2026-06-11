/* exporter.js — frame-accurate, fully browser-side export. Free forever.
 *
 * Primary path: WebCodecs VideoEncoder (hardware-accelerated in Chrome/Edge,
 * also in recent Firefox/Safari) + vendored muxers:
 *   MP4  : H.264 via mp4-muxer   (replaces the broken ffmpeg.wasm path)
 *   WebM : VP9/VP8 via webm-muxer
 *
 * The render loop is OFFLINE: it steps t frame by frame and encodes each one,
 * so nothing depends on machine speed and no frames are ever dropped. This is
 * why preview and file are identical. No SharedArrayBuffer, no COOP/COEP, no
 * 30 MB wasm download.
 *
 * Fallback (old browsers without WebCodecs): realtime captureStream +
 * MediaRecorder, WebM only, like V1.
 */
window.Exporter = (function () {
  const T = window.Timeline;

  let _cancel = false;
  function cancel() { _cancel = true; }

  async function pickConfig(kind, W, H, fps) {
    const bitrate = Math.max(4e6, Math.round(W * H * fps * 0.12));
    const candidates = kind === "mp4"
      ? ["avc1.640034", "avc1.64002a", "avc1.640028", "avc1.4d402a", "avc1.42e02a"]
      : ["vp09.00.41.08", "vp09.00.40.08", "vp8"];
    for (const codec of candidates) {
      try {
        const res = await VideoEncoder.isConfigSupported({
          codec, width: W, height: H, framerate: fps, bitrate, latencyMode: "quality",
        });
        if (res.supported) return res.config;
      } catch (e) { /* try next */ }
    }
    return null;
  }

  /* Offline frame-stepped render. drawFrame(t) must fully draw frame t. */
  async function renderOffline({ format, canvas, drawFrame, duration, fps, onProgress }) {
    _cancel = false;
    const W = canvas.width, H = canvas.height;
    const cfg = await pickConfig(format, W, H, fps);
    if (!cfg) throw new Error("No supported " + format.toUpperCase() + " encoder config");

    let muxer, isVp9 = false;
    if (format === "mp4") {
      muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: { codec: "avc", width: W, height: H },
        fastStart: "in-memory",
        firstTimestampBehavior: "offset",
      });
    } else {
      isVp9 = cfg.codec.indexOf("vp09") === 0;
      muxer = new WebMMuxer.Muxer({
        target: new WebMMuxer.ArrayBufferTarget(),
        video: { codec: isVp9 ? "V_VP9" : "V_VP8", width: W, height: H, frameRate: fps },
        firstTimestampBehavior: "offset",
      });
    }

    let encError = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: e => { encError = e; },
    });
    encoder.configure(cfg);

    const total = Math.max(1, Math.round(duration * fps));
    const usPerFrame = 1e6 / fps;

    for (let i = 0; i < total; i++) {
      if (_cancel) { try { encoder.close(); } catch (e) {} throw new Error("cancelled"); }
      if (encError) throw encError;

      drawFrame(i / fps);
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(i * usPerFrame),
        duration: Math.round(usPerFrame),
      });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();

      // backpressure + keep the UI alive
      while (encoder.encodeQueueSize > 6) await sleep(4);
      if (i % 4 === 0) {
        if (onProgress) onProgress(i / total);
        await sleep(0);
      }
    }
    await encoder.flush();
    if (encError) throw encError;
    muxer.finalize();
    if (onProgress) onProgress(1);

    const buffer = muxer.target.buffer;
    return new Blob([buffer], { type: format === "mp4" ? "video/mp4" : "video/webm" });
  }

  /* Fallback: realtime capture (WebM only) for browsers without WebCodecs. */
  function renderRealtimeWebM({ canvas, drawFrame, duration, fps, onProgress }) {
    return new Promise((resolve, reject) => {
      if (!canvas.captureStream || !window.MediaRecorder)
        return reject(new Error("This browser supports neither WebCodecs nor MediaRecorder"));
      const mimes = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
      const mime = mimes.find(m => MediaRecorder.isTypeSupported(m)) || "video/webm";
      const stream = canvas.captureStream(fps);
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10e6 });
      const chunks = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); resolve(new Blob(chunks, { type: "video/webm" })); };
      rec.onerror = e => reject(e.error || new Error("MediaRecorder error"));
      rec.start(100);
      const t0 = performance.now();
      (function drive() {
        const t = (performance.now() - t0) / 1000;
        drawFrame(Math.min(t, duration));
        if (onProgress) onProgress(Math.min(t / duration, 1));
        if (t < duration) requestAnimationFrame(drive);
        else setTimeout(() => { try { rec.stop(); } catch (e) {} }, 150);
      })();
    });
  }

  async function exportVideo(opts) {
    const stage = window.Stage;
    stage.pause();
    stage.setExporting(true);
    try {
      const job = {
        format: opts.format,
        canvas: stage.canvas,
        drawFrame: t => stage.renderExact(t),
        duration: stage.duration,
        fps: stage.fps,
        onProgress: opts.onProgress,
      };
      if ("VideoEncoder" in window) {
        return { blob: await renderOffline(job), ext: opts.format, engine: "webcodecs" };
      }
      const blob = await renderRealtimeWebM(job);
      return { blob, ext: "webm", engine: "mediarecorder",
               note: opts.format === "mp4" ? "noWebCodecs" : null };
    } finally {
      stage.setExporting(false);
    }
  }

  async function exportPNG() {
    const stage = window.Stage;
    stage.setExporting(true);
    stage.renderExact(stage.currentT());
    const blob = await new Promise(res => stage.canvas.toBlob(res, "image/png"));
    stage.setExporting(false);
    return blob;
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  return { exportVideo, exportPNG, download, cancel,
           get hasWebCodecs() { return "VideoEncoder" in window; } };
})();
