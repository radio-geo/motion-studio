/* slideshow.js — TEMPLATE 3 (Slideshow). STUB.
 * Drop a few photos -> gentle Ken Burns + clean cross-dissolves. Restraint is the goal.
 * OPEN QUESTIONS before building: photo count, and whether per-photo captions.
 * Built last, after Quote + Social.
 */
window.SlideshowTemplate = (function () {
  const SS = {
    id: "slideshow",
    name: "Slideshow",
    later: true,
    duration: 12.0,
    state: { photos: [], captions: false },   // captions toggle pending your call

    editor(container) {
      container.innerHTML = `
        <div class="section-title">Slideshow</div>
        <p class="hint">Drop a few photos and the engine adds a gentle Ken Burns drift
        with clean cross-dissolves. Deliberately restrained.</p>
        <div class="later-block">
          <div class="later-item"><span>Photo count</span><span class="pill">your call</span></div>
          <div class="later-item"><span>Per-photo captions</span><span class="pill">your call</span></div>
        </div>`;
    },

    drawFrame(ctx, t) {
      const W = ctx.canvas.width, H = ctx.canvas.height;
      ctx.fillStyle = "#0f1216"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#9aa3af"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `700 ${Math.round(W * 0.03)}px "Archy", sans-serif`;
      ctx.fillText("Slideshow — Ken Burns + cross-dissolve", W / 2, H / 2 - 20);
      ctx.font = `400 ${Math.round(W * 0.018)}px "Archy", sans-serif`;
      ctx.fillText("coming later (need photo count + captions decision)", W / 2, H / 2 + 30);
    },
  };
  return SS;
})();
