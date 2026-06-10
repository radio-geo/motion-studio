/* slideshow.js — TEMPLATE 3 (Slideshow)
 *
 * Up to 5 photos. Each slide gets a Ken Burns drift (slow pan + gentle zoom),
 * with a cross-dissolve between slides. Optional per-slide captions that
 * slide up with each new photo.
 *
 * Improvement #12: replaces the stub with a fully animated Ken Burns slideshow.
 *
 * Design decisions (previously "your call"):
 *   - Photo count: 1–5 (user uploads up to 5)
 *   - Per-photo captions: toggle in editor (off by default)
 *   - Slide duration: 3 seconds per slide (total = count × 3)
 *   - Dissolve duration: 0.6s overlap
 *   - Ken Burns: each slide has a unique direction from a table of 4 presets
 */
window.SlideshowTemplate = (function () {
  const T = window.Timeline;

  // Ken Burns: {x0,y0,x1,y1,s0,s1} in normalised stage coords, scale multipliers
  const KB_PRESETS = [
    { ox0: 0,    oy0: 0,    ox1: 0.03, oy1: 0.03, s0: 1.0,  s1: 1.12 }, // drift top-left -> bottom-right
    { ox0: 0.03, oy0: 0,    ox1: 0,    oy1: 0.03, s0: 1.08, s1: 1.0  }, // reverse drift
    { ox0: 0,    oy0: 0.03, ox1: 0.03, oy1: 0,    s0: 1.04, s1: 1.10 }, // drift up-right
    { ox0: 0.03, oy0: 0.03, ox1: 0,    oy1: 0,    s0: 1.10, s1: 1.02 }, // drift down-left
  ];
  const DISSOLVE = 0.6;   // seconds of cross-dissolve overlap
  const SLIDE_DUR = 3.0;  // seconds per slide

  const SS = {
    id: "slideshow",
    name: "Slideshow",
    later: false,
    duration: 6.0,        // recalculated when photos are added
    state: {
      photos: [],    // [{img: HTMLImageElement, caption:""}]
      captions: false,
    },
  };

  SS.invalidate = function () { /* no layout cache */ };

  /* ---------------- editor ---------------- */
  SS.editor = function (container, onChange) {
    container.innerHTML = `
      <div class="section-title">Slideshow</div>
      <div class="hint" style="margin-bottom:14px">
        Upload up to 5 photos. Each slide gets a gentle Ken Burns drift and a
        clean cross-dissolve. Deliberately restrained.
      </div>

      <div class="field" style="display:flex;align-items:center;gap:10px">
        <label style="margin:0;display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="ss-captions" ${SS.state.captions?"checked":""} />
          Show captions
        </label>
      </div>

      <div id="ss-slides"></div>

      <div class="logo-drop" id="ss-add-drop" style="margin-top:4px">
        + Click or drop photos here (up to 5)
      </div>
      <input type="file" id="ss-add-file" accept="image/*" multiple hidden />
    `;

    const $ = s => container.querySelector(s);
    const slidesEl = $("#ss-slides");

    function rebuildSlideList() {
      slidesEl.innerHTML = "";
      SS.state.photos.forEach((slot, i) => {
        const row = document.createElement("div");
        row.className = "ss-slide-row";
        row.innerHTML = `
          <div class="ss-thumb-wrap">
            <img class="ss-thumb" />
            <button class="ss-remove" title="Remove">✕</button>
          </div>
          ${SS.state.captions
            ? `<input type="text" class="ss-cap" placeholder="Caption ${i+1}" value="${slot.caption||""}" />`
            : ""}
        `;
        row.querySelector(".ss-thumb").src = slot.img.src;
        row.querySelector(".ss-remove").addEventListener("click", () => {
          SS.state.photos.splice(i, 1);
          updateDuration(); rebuildSlideList(); onChange && onChange();
        });
        const cap = row.querySelector(".ss-cap");
        if (cap) cap.addEventListener("input", e => { slot.caption = e.target.value; onChange && onChange(); });
        slidesEl.appendChild(row);
      });
    }

    $("#ss-captions").addEventListener("change", e => {
      SS.state.captions = e.target.checked; rebuildSlideList(); onChange && onChange();
    });

    function addFiles(files) {
      const remaining = 5 - SS.state.photos.length;
      [...files].slice(0, remaining).forEach(f => {
        if (!f.type.startsWith("image/")) return;
        const img = new Image();
        img.onload = () => {
          SS.state.photos.push({ img, caption: "" });
          updateDuration(); rebuildSlideList(); onChange && onChange();
        };
        img.src = URL.createObjectURL(f);
      });
    }

    const addDrop = $("#ss-add-drop");
    addDrop.addEventListener("click", () => { if (SS.state.photos.length < 5) $("#ss-add-file").click(); });
    $("#ss-add-file").addEventListener("change", e => { addFiles(e.target.files); });
    addDrop.addEventListener("dragover", e => { e.preventDefault(); addDrop.classList.add("drag-over"); });
    addDrop.addEventListener("dragleave", () => addDrop.classList.remove("drag-over"));
    addDrop.addEventListener("drop", e => { e.preventDefault(); addDrop.classList.remove("drag-over"); addFiles(e.dataTransfer.files); });

    rebuildSlideList();
  };

  function updateDuration() {
    const n = Math.max(1, SS.state.photos.length);
    SS.duration = n * SLIDE_DUR + DISSOLVE;
    if (window.Pipeline) window.Pipeline.setDuration(SS.duration);
  }

  /* ---------------- Ken Burns helper ---------------- */
  function kbTransform(img, prog, kb, W, H) {
    // Returns {dx, dy, scale} for drawImage
    const ar = img.naturalWidth / img.naturalHeight, far = W / H;
    // base cover scale
    const baseS = ar > far ? H / img.naturalHeight : W / img.naturalWidth;
    const s = (kb.s0 + (kb.s1 - kb.s0) * prog) * baseS;
    const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
    const cx = (W / 2) + (kb.ox0 + (kb.ox1 - kb.ox0) * prog) * W - iw / 2;
    const cy = (H / 2) + (kb.oy0 + (kb.oy1 - kb.oy0) * prog) * H - ih / 2;
    return { dx: cx, dy: cy, dw: iw, dh: ih };
  }

  /* ---------------- main frame ---------------- */
  SS.drawFrame = function (ctx, t) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const bk = window.BrandKit.get();
    const P = bk.palette;

    // Background
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);

    const photos = SS.state.photos;
    if (!photos.length) {
      ctx.fillStyle = "#9aa3af"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `700 ${Math.round(W * 0.028)}px "ArchivoNarrow", sans-serif`;
      ctx.fillText("Upload photos to begin", W / 2, H / 2 - 20);
      ctx.font = `400 ${Math.round(W * 0.018)}px "ArchivoNarrow", sans-serif`;
      ctx.fillText("Supports up to 5 photos · Ken Burns + cross-dissolve", W / 2, H / 2 + 28);
      return;
    }

    const n = photos.length;
    const dur = SS.duration;

    // Determine which slide(s) to draw at time t
    for (let i = 0; i < n; i++) {
      const slideStart = i * SLIDE_DUR;
      const slideEnd   = slideStart + SLIDE_DUR + (i < n - 1 ? DISSOLVE : 0);

      if (t < slideStart - DISSOLVE || t > slideEnd) continue;

      const kb = KB_PRESETS[i % KB_PRESETS.length];
      const slideT = t - slideStart;
      const slideProgress = T.clamp01(slideT / SLIDE_DUR);

      // Alpha: fade in at start, fade out at end for dissolve
      let alpha = 1;
      if (i > 0 && slideT < DISSOLVE) {
        // dissolve in (over prev slide)
        alpha = T.clamp01(slideT / DISSOLVE);
      } else if (i < n - 1 && slideT > SLIDE_DUR - DISSOLVE) {
        // dissolve out (into next slide)
        alpha = T.clamp01((SLIDE_DUR - slideT) / DISSOLVE);
      }

      const { dx, dy, dw, dh } = kbTransform(photos[i].img, slideProgress, kb, W, H);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(photos[i].img, dx, dy, dw, dh);

      // Vignette overlay
      const vig = ctx.createRadialGradient(W/2, H/2, H*0.12, W/2, H/2, H*0.82);
      vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,.42)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

      // Caption
      if (SS.state.captions && photos[i].caption) {
        const capEnter = T.tween(slideT, 0.1, 0.5, 0, 1, "out");
        const capExit  = i < n - 1 ? T.tween(slideT, SLIDE_DUR - 0.5, 0.4, 0, 1, "inOut") : 0;
        const capAlpha = capEnter * (1 - capExit);
        if (capAlpha > 0) {
          const capSize = Math.round(H * 0.032);
          const capY    = Math.round(H * 0.88) + (1 - capEnter) * 20;
          ctx.globalAlpha = alpha * capAlpha;
          ctx.fillStyle = "rgba(0,0,0,.45)";
          ctx.fillRect(0, capY - capSize * 1.2, W, capSize * 2.6);
          ctx.fillStyle = "#f3f4f6";
          ctx.font = `600 ${capSize}px "ArchivoNarrow", sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
          ctx.fillText(photos[i].caption, W / 2, capY);
          ctx.globalAlpha = alpha;
        }
      }

      ctx.restore();
    }

    // Slide counter dots
    if (n > 1) {
      const dotR    = Math.round(H * 0.007);
      const dotGap  = Math.round(dotR * 3.2);
      const dotsW   = n * dotGap - dotGap + dotR * 2;
      const dotsCx  = W / 2;
      const dotsY   = Math.round(H * 0.935);
      const curSlide = Math.min(n - 1, Math.floor(t / SLIDE_DUR));
      for (let i = 0; i < n; i++) {
        ctx.save();
        ctx.globalAlpha = i === curSlide ? 1 : 0.4;
        ctx.fillStyle = "#fff";
        const cx = dotsCx - dotsW / 2 + i * dotGap + dotR;
        ctx.beginPath(); ctx.arc(cx, dotsY, i === curSlide ? dotR * 1.2 : dotR, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // Logo
    if (bk.logo.image) {
      const box = window.BrandKit.logoBox(W, H);
      ctx.drawImage(bk.logo.image, box.x, box.y, box.w, box.h);
    }
  };

  return SS;
})();
