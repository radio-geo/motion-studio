/* quote.js — TEMPLATE 1 (Quote) */
window.QuoteTemplate = (function () {
  const T = window.Timeline;

  const QT = {
    id: "quote",
    name: "Quote",
    duration: 7.0,
    state: {
      quote: "We are building a tool that helps journalists create high-quality motion graphics in the browser.",
      name: "George Meladze",
      title: "Editor, Droeba",
      photo: null,
      photoAdjust: { scale: 1, ox: 0, oy: 0 },
      bg: { type: "preset", preset: 0, image: null },
      textReveal: "fade",
      textBacking: "none",
    },
    tt: null,
    _layout: null,
    _sig: "",
  };

  QT.tt = window.TextTargeting.create(QT.state.quote);
  QT.tt.sel = { start: 9, end: 11 };

  QT.BG_PRESETS = ["bgGradient","bgVignette","bgDiagonal","bgSpotlight","bgGrid"];
  QT.BG_LIBRARY = [
    "bg-texture-1","bg-texture-2","bg-texture-3",
    "bg-abstract-1","bg-abstract-2","bg-abstract-3",
    "bg-atmos-1","bg-atmos-2","bg-atmos-3",
  ];
  QT.REVEALS = [["fade","revFade"],["type","revType"],["wipe","revWipe"],["cascade","revCascade"]];
  QT.BACKINGS = [["none","backNone"],["shadow","backShadow"],["panel","backPanel"]];

  /* ---- drag-drop helper ---- */
  function wireDropZone(el, onFile) {
    el.addEventListener("dragover", e => { e.preventDefault(); el.classList.add("drag-over"); });
    el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
    el.addEventListener("drop", e => {
      e.preventDefault(); el.classList.remove("drag-over");
      const f = e.dataTransfer.files[0]; if (!f || !f.type.startsWith("image/")) return;
      onFile(f);
    });
  }
  function loadPhotoFile(f, dropEl, onChange) {
    const img = new Image();
    img.onload = () => { QT.state.photo = img; QT.invalidate(); onChange && onChange(); };
    img.src = URL.createObjectURL(f);
    dropEl.textContent = f.name;
  }
  function loadBgFile(f, dropEl, bgWrap, libWrap, onChange) {
    const img = new Image();
    img.onload = () => {
      QT.state.bg = { type: "image", preset: QT.state.bg.preset, image: img };
      [...bgWrap.children].forEach(c => c.classList.remove("active"));
      [...libWrap.children].forEach(c => c.classList.remove("active"));
      QT.invalidate(); onChange && onChange();
    };
    img.src = URL.createObjectURL(f);
    dropEl.textContent = f.name;
  }

  /* ---------------- editor panel (i18n-aware) ---------------- */
  QT.editor = function (container, onChange) {
    const L = window.Lang;
    const opts = (arr, cur) =>
      arr.map(([v, lk]) => `<option value="${v}"${v===cur?" selected":""}>${L.t(lk)}</option>`).join("");

    container.innerHTML = `
      <div class="section-title">${L.t('templateQuote')}</div>
      <div class="field">
        <label>${L.t('quoteText')}</label>
        <textarea id="q-text"></textarea>
        <button class="ai-btn" id="q-ai">${L.t('aiHelpText')}</button>
      </div>
      <div class="field">
        <label>${L.t('targetPhrase')}</label>
        <div class="word-pick" id="q-words"></div>
        <div class="hint">${L.t('targetHint')} <a id="q-clear" style="color:var(--accent);cursor:pointer">${L.t('clearSel')}</a></div>
      </div>
      <div class="field">
        <label>${L.t('textReveal')}</label>
        <select id="q-reveal">${opts(QT.REVEALS, QT.state.textReveal)}</select>
      </div>
      <div class="field">
        <label>${L.t('textBacking')} — ${L.t('backingHint')}</label>
        <select id="q-backing">${opts(QT.BACKINGS, QT.state.textBacking)}</select>
      </div>
      <div class="field">
        <label>${L.t('speakerPhoto')}</label>
        <div class="logo-drop" id="q-photo-drop">${L.t('photoDropText')}</div>
        <input type="file" id="q-photo" accept="image/*" hidden />
        <div class="adjust" id="q-photo-adj">
          <label>Zoom <input type="range" id="pa-scale" min="100" max="280" value="100"></label>
          <label>X <input type="range" id="pa-x" min="-100" max="100" value="0"></label>
          <label>Y <input type="range" id="pa-y" min="-100" max="100" value="0"></label>
        </div>
      </div>
      <div class="field">
        <label>${L.t('nameLabel')}</label>
        <input type="text" id="q-name" />
      </div>
      <div class="field">
        <label>${L.t('titleSource')}</label>
        <input type="text" id="q-title" />
      </div>
      <div class="field">
        <label>${L.t('bgPresets')}</label>
        <div class="bg-grid" id="q-bg"></div>
        <label style="margin-top:12px">${L.t('bgLibrary')}</label>
        <div class="bg-lib" id="q-bg-lib"></div>
        <div class="logo-drop" id="q-bg-drop" style="margin-top:8px">${L.t('bgDropText')}</div>
        <input type="file" id="q-bg-file" accept="image/*" hidden />
        <button class="ai-btn" id="q-bg-ai">${L.t('aiGenerateBg')}</button>
      </div>
    `;

    const $ = s => container.querySelector(s);
    $("#q-text").value = QT.state.quote;
    $("#q-name").value = QT.state.name;
    $("#q-title").value = QT.state.title;

    const repaintWords = () => QT.tt.buildPicker($("#q-words"), () => { QT.invalidate(); onChange && onChange(); });
    repaintWords();

    $("#q-text").addEventListener("input", e => {
      QT.state.quote = e.target.value; QT.tt.setText(e.target.value);
      repaintWords(); QT.invalidate(); onChange && onChange();
    });
    $("#q-clear").addEventListener("click", () => { QT.tt.clearSelection(); repaintWords(); QT.invalidate(); onChange && onChange(); });
    $("#q-name").addEventListener("input", e => { QT.state.name = e.target.value; QT.invalidate(); onChange && onChange(); });
    $("#q-title").addEventListener("input", e => { QT.state.title = e.target.value; QT.invalidate(); onChange && onChange(); });
    $("#q-reveal").addEventListener("change", e => { QT.state.textReveal = e.target.value; onChange && onChange(); });
    $("#q-backing").addEventListener("change", e => { QT.state.textBacking = e.target.value; onChange && onChange(); });

    // Speaker photo
    const photoDropEl = $("#q-photo-drop");
    photoDropEl.addEventListener("click", () => $("#q-photo").click());
    $("#q-photo").addEventListener("change", e => {
      const f = e.target.files[0]; if (!f) return;
      loadPhotoFile(f, photoDropEl, onChange);
    });
    wireDropZone(photoDropEl, f => loadPhotoFile(f, photoDropEl, onChange));

    const pa = () => { QT.invalidate(); onChange && onChange(); };
    $("#pa-scale").addEventListener("input", e => { QT.state.photoAdjust.scale = e.target.value / 100; pa(); });
    $("#pa-x").addEventListener("input", e => { QT.state.photoAdjust.ox = e.target.value / 100; pa(); });
    $("#pa-y").addEventListener("input", e => { QT.state.photoAdjust.oy = e.target.value / 100; pa(); });

    // Background presets
    const bgWrap = $("#q-bg");
    QT.BG_PRESETS.forEach((lk, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bg-cell bg-p" + idx + ((QT.state.bg.type === "preset" && QT.state.bg.preset === idx) ? " active" : "");
      b.title = L.t(lk);
      b.addEventListener("click", () => {
        QT.state.bg = { type: "preset", preset: idx, image: QT.state.bg.image };
        [...bgWrap.children].forEach(c => c.classList.remove("active"));
        [...libWrap.children].forEach(c => c.classList.remove("active"));
        b.classList.add("active");
        QT.invalidate(); onChange && onChange();
      });
      bgWrap.appendChild(b);
    });

    // Background library
    const libWrap = $("#q-bg-lib");
    QT.BG_LIBRARY.forEach(name => {
      const src = "assets/backgrounds/" + name + ".png";
      const th = document.createElement("img");
      th.className = "bg-thumb"; th.src = src; th.title = name; th.loading = "lazy";
      th.addEventListener("click", () => {
        const img = new Image();
        img.onload = () => {
          QT.state.bg = { type: "image", preset: QT.state.bg.preset, image: img };
          [...bgWrap.children].forEach(c => c.classList.remove("active"));
          [...libWrap.children].forEach(c => c.classList.remove("active"));
          th.classList.add("active");
          QT.invalidate(); onChange && onChange();
        };
        img.src = src;
      });
      libWrap.appendChild(th);
    });

    // Background upload
    const bgDropEl = $("#q-bg-drop");
    bgDropEl.addEventListener("click", () => $("#q-bg-file").click());
    $("#q-bg-file").addEventListener("change", e => {
      const f = e.target.files[0]; if (!f) return;
      loadBgFile(f, bgDropEl, bgWrap, libWrap, onChange);
    });
    wireDropZone(bgDropEl, f => loadBgFile(f, bgDropEl, bgWrap, libWrap, onChange));

    $("#q-bg-ai").addEventListener("click", () => alert(L.t('aiGenerateBg')));
    $("#q-ai").addEventListener("click", () => alert(L.t('aiHelpText')));
  };

  QT.invalidate = function () { QT._sig = ""; };

  /* ---------------- layout ---------------- */
  function ensureLayout(ctx, W, H) {
    const bk = window.BrandKit.get();
    const sig = [W, H, QT.state.quote, bk.fonts.display].join("|");
    if (QT._sig === sig && QT._layout) return QT._layout;

    const margin = Math.round(W * 0.072);
    const maxW = W - margin * 2 - Math.round(W * 0.02);
    const size = Math.round(W * 0.040);
    const lineH = Math.round(size * 1.34);
    const topY = Math.round(H * 0.30);
    ctx.font = `700 ${size}px "${bk.fonts.display}", "Archy", sans-serif`;

    const words = QT.tt.words.map(w => w.text);
    const spaceW = ctx.measureText(" ").width;
    const rects = [];
    let x = margin, y = topY, lineCount = 0;
    words.forEach((wd, i) => {
      const ww = ctx.measureText(wd).width;
      if (x + ww > margin + maxW && x > margin) { x = margin; y += lineH; lineCount++; }
      rects.push({ x, y: y - size * 0.82, w: ww, h: size, baseline: y, wordIndex: i, text: wd });
      x += ww + spaceW;
    });

    QT._layout = { margin, maxW, size, lineH, topY, rects, lineCount: lineCount + 1 };
    QT._sig = sig;
    return QT._layout;
  }

  function selectedRects(L) { return L.rects.filter(r => QT.tt.isSelected(r.wordIndex)); }

  function textBlockBBox(L) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    L.rects.forEach(r => {
      x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.baseline + L.size * 0.12);
    });
    if (!isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /* ---------------- camera ---------------- */
  function camera(t, focus, W, H) {
    if (!focus) return { s: 1, tx: 0, ty: 0 };
    let target = Math.min((W * 0.55) / focus.w, (H * 0.42) / focus.h);
    target = Math.max(1.05, Math.min(target, 2.1));
    let tTx = W / 2 - focus.cx * target;
    let tTy = H / 2 - focus.cy * target;
    tTx = Math.min(0, Math.max(W - W * target, tTx));
    tTy = Math.min(0, Math.max(H - H * target, tTy));
    const pIn = T.tween(t, 2.4, 1.0, 0, 1, "inOut");
    const pOut = T.tween(t, 5.0, 1.2, 0, 1, "inOut");
    const p = pIn * (1 - pOut);
    return { s: 1 + (target - 1) * p, tx: tTx * p, ty: tTy * p };
  }

  /* ---------------- draw helpers ---------------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function circleImage(ctx, img, cx, cy, rad, adj) {
    adj = adj || { scale: 1, ox: 0, oy: 0 };
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    const ar = img.naturalWidth / img.naturalHeight;
    let dw = rad * 2, dh = rad * 2;
    if (ar > 1) dw = dh * ar; else dh = dw / ar;
    dw *= adj.scale; dh *= adj.scale;
    const ccx = cx + adj.ox * rad, ccy = cy + adj.oy * rad;
    ctx.drawImage(img, ccx - dw / 2, ccy - dh / 2, dw, dh);
    ctx.restore();
  }
  function coverImage(ctx, img, W, H) {
    const ar = img.naturalWidth / img.naturalHeight, far = W / H;
    let dw = W, dh = H, ox = 0, oy = 0;
    if (ar > far) { dw = H * ar; ox = (dw - W) / 2; } else { dh = W / ar; oy = (dh - H) / 2; }
    ctx.drawImage(img, -ox, -oy, dw, dh);
  }

  function drawBackground(ctx, W, H, P, bg) {
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    if (bg.type === "image" && bg.image) {
      coverImage(ctx, bg.image, W, H);
      const s = ctx.createLinearGradient(0, 0, W, H);
      s.addColorStop(0, "rgba(8,10,13,.82)"); s.addColorStop(0.6, "rgba(8,10,13,.5)"); s.addColorStop(1, "rgba(8,10,13,.32)");
      ctx.fillStyle = s; ctx.fillRect(0, 0, W, H);
      return;
    }
    switch (bg.preset) {
      case 1: {
        ctx.fillStyle = P.surface; ctx.fillRect(0, 0, W, H);
        const r = ctx.createRadialGradient(W*0.4, H*0.45, H*0.2, W*0.5, H*0.5, H*0.95);
        r.addColorStop(0, "rgba(0,0,0,0)"); r.addColorStop(1, "rgba(0,0,0,.55)");
        ctx.fillStyle = r; ctx.fillRect(0, 0, W, H); break;
      }
      case 2: {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, P.surface); g.addColorStop(1, P.bg);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = P.accent;
        ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W, H*0.16); ctx.lineTo(W*0.62, 0); ctx.closePath(); ctx.fill();
        ctx.restore(); break;
      }
      case 3: {
        ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
        const r = ctx.createRadialGradient(W*0.18, H*0.82, H*0.05, W*0.18, H*0.82, H*0.7);
        r.addColorStop(0, "rgba(255,255,255,.10)"); r.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = r; ctx.fillRect(0, 0, W, H); break;
      }
      case 4: {
        ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(255,255,255,.05)"; ctx.lineWidth = 1;
        const step = Math.round(W / 24); ctx.beginPath();
        for (let x = step; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
        for (let y = step; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
        ctx.stroke(); break;
      }
      default: {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, P.bg); g.addColorStop(1, P.surface);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    }
  }

  function drawLogo(ctx, W, H, bk) {
    const box = window.BrandKit.logoBox(W, H);
    if (bk.logo.image) { ctx.drawImage(bk.logo.image, box.x, box.y, box.w, box.h); return; }
    ctx.save();
    ctx.setLineDash([6, 6]); ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 2;
    roundRect(ctx, box.x, box.y, box.w, box.h, 8); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,.4)";
    ctx.font = `600 ${Math.round(box.h * 0.28)}px "ArchivoNarrow", sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("LOGO", box.x + box.w / 2, box.y + box.h / 2);
    ctx.restore();
  }

  /* ---------------- lower-third ---------------- */
  function drawLowerThird(ctx, W, H, P, bk, t) {
    const lt = bk.lowerThird;
    if (!lt) return;

    const enter = T.tween(t, 0.6, 0.5, 0, 1, "out");
    const exit  = T.tween(t, QT.duration - 1.2, 0.5, 0, 1, "inOut");
    const alpha = enter * (1 - exit);
    if (alpha <= 0) return;

    const name  = QT.state.name  || "";
    const title = QT.state.title || "";
    if (!name && !title) return;

    const barH     = Math.round(H * 0.095);
    const barY     = H - barH - Math.round(H * 0.055);
    const nameSize = Math.round(H * 0.038);
    const subSize  = Math.round(H * 0.024);
    const margin   = Math.round(W * 0.072);
    const accentW  = Math.round(W * 0.005);
    const textX    = margin + (lt.accentBar ? accentW + Math.round(W * 0.018) : 0);
    const slideIn  = (1 - enter) * Math.round(W * 0.04);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(slideIn, 0);

    if (lt.style === "bar" || lt.style === "block") {
      const bg = lt.style === "block" ? P.bg : "rgba(0,0,0,0.55)";
      roundRect(ctx, margin - Math.round(W*0.015), barY - Math.round(H*0.015),
        Math.round(W * 0.5), barH + Math.round(H*0.030), Math.round(H*0.008));
      ctx.fillStyle = bg; ctx.fill();
    }

    if (lt.accentBar) {
      ctx.fillStyle = P.accent;
      ctx.fillRect(margin, barY, accentW, barH);
    }

    ctx.fillStyle = P.ink;
    ctx.font = `700 ${nameSize}px "${bk.fonts.display}", "ArchivoNarrow", sans-serif`;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(name, textX, barY + nameSize * 1.05);

    if (lt.style === "underline") {
      ctx.strokeStyle = P.accent; ctx.lineWidth = Math.round(H * 0.003);
      ctx.beginPath();
      const uw = ctx.measureText(name).width;
      ctx.moveTo(textX, barY + nameSize * 1.14);
      ctx.lineTo(textX + uw, barY + nameSize * 1.14);
      ctx.stroke();
    }

    if (title) {
      ctx.fillStyle = P.muted;
      ctx.font = `400 ${subSize}px "ArchivoNarrow", sans-serif`;
      ctx.fillText(title, textX, barY + nameSize * 1.10 + subSize * 1.3);
    }

    ctx.restore();
  }

  /* ---------------- quote text (inside camera transform) ---------------- */
  function drawQuoteText(ctx, L, t, P, bk, cam) {
    const size = L.size;
    const reveal = QT.state.textReveal;
    const backing = QT.state.textBacking;
    const textEnter = T.tween(t, 0.4, 0.7, 0, 1, "out");

    if (backing === "panel") {
      const bb = textBlockBBox(L);
      ctx.save();
      ctx.globalAlpha = 0.55 * textEnter; ctx.fillStyle = "#000";
      roundRect(ctx, bb.x - size*0.6, bb.y - size*0.5, bb.w + size*1.2, bb.h + size*0.7, size*0.22);
      ctx.fill(); ctx.restore();
    }

    // Accent bar + quotemark
    ctx.save(); ctx.globalAlpha = textEnter;
    ctx.fillStyle = P.accent;
    ctx.fillRect(L.margin - Math.round(size*0.45), L.topY - Math.round(size*1.0), Math.round(size*0.16), L.lineH * L.lineCount + size*0.6);
    ctx.globalAlpha = textEnter * 0.28; ctx.fillStyle = P.accent2;
    ctx.font = `700 ${Math.round(size*3.0)}px "${bk.fonts.display}", serif`;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText("“", L.margin - Math.round(size*0.1), L.topY - Math.round(size*0.55));
    ctx.restore();

    ctx.font = `700 ${size}px "${bk.fonts.display}", "Archy", sans-serif`;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";

    // Typewriter: cumulative character counts per word
    const offsets = []; let cc = 0;
    L.rects.forEach(r => { offsets.push(cc); cc += r.text.length + 1; /* +1 for space */ });
    const totalChars = cc;
    const revP = T.tween(t, 0.5, 1.5, 0, 1, "out");
    const shownChars = Math.floor(revP * totalChars);

    let clipped = false;
    if (reveal === "wipe") {
      const bb = textBlockBBox(L);
      ctx.save(); clipped = true;
      ctx.beginPath();
      ctx.rect(bb.x - size*0.3, bb.y - size*0.6, (bb.w + size*0.6) * revP, bb.h + size);
      ctx.clip();
    }

    L.rects.forEach((r, idx) => {
      const sel = QT.tt.isSelected(r.wordIndex);
      let alpha = 1, text = r.text;

      if (reveal === "fade") {
        alpha = textEnter;
      } else if (reveal === "cascade") {
        alpha = T.tween(t, 0.4 + r.wordIndex * 0.06, 0.45, 0, 1, "out");
      } else if (reveal === "type") {
        const start = offsets[idx];
        const end = start + r.text.length;
        if (shownChars <= start) return; // not reached yet
        if (shownChars < end) text = r.text.slice(0, shownChars - start);
        alpha = 1; // typewriter words are immediately visible once reached
      }

      const dim = sel ? 1 : (1 - 0.28 * (cam.s > 1.02 ? Math.min(1, (cam.s - 1) / 1.1) : 0));
      ctx.globalAlpha = alpha * dim;
      ctx.fillStyle = sel ? P.accent2 : P.ink;
      if (backing === "shadow") {
        ctx.shadowColor = "rgba(0,0,0,.8)";
        ctx.shadowBlur = size*0.32;
        ctx.shadowOffsetY = size*0.05;
      }
      ctx.fillText(text, r.x, r.baseline);
      if (backing === "shadow") {
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      }
    });
    ctx.globalAlpha = 1;
    if (clipped) ctx.restore();
  }

  /* ---------------- attribution (screen space) ---------------- */
  function drawAttribution(ctx, W, H, P, bk, t) {
    const photoEnter = T.tween(t, 0.15, 0.6, 0, 1, "out");
    const nameEnter  = T.tween(t, 1.5, 0.7, 0, 1, "out");
    const attrY  = Math.round(H * 0.80);
    const photoR = Math.round(H * 0.075);
    const photoCx = Math.round(W * 0.072) + photoR;

    ctx.save();
    ctx.globalAlpha = photoEnter;
    const rr = photoR * (0.92 + 0.08 * photoEnter);
    if (QT.state.photo) {
      circleImage(ctx, QT.state.photo, photoCx, attrY, rr, QT.state.photoAdjust);
      ctx.lineWidth = 4; ctx.strokeStyle = P.accent;
      ctx.beginPath(); ctx.arc(photoCx, attrY, rr, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = P.surface;
      ctx.beginPath(); ctx.arc(photoCx, attrY, rr, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.2)"; ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `600 ${Math.round(photoR * 0.4)}px "ArchivoNarrow", sans-serif`;
      ctx.fillText("PHOTO", photoCx, attrY);
    }
    ctx.restore();

    const slide = (1 - nameEnter) * 16;
    ctx.save(); ctx.globalAlpha = nameEnter;
    const tx = photoCx + photoR + Math.round(W * 0.022);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = P.ink;
    ctx.font = `700 ${Math.round(H * 0.040)}px "${bk.fonts.display}", "ArchivoNarrow", sans-serif`;
    ctx.fillText(QT.state.name || "", tx, attrY - Math.round(H * 0.004) + slide);
    ctx.fillStyle = P.muted;
    ctx.font = `400 ${Math.round(H * 0.028)}px "ArchivoNarrow", sans-serif`;
    ctx.fillText(QT.state.title || "", tx, attrY + Math.round(H * 0.040) + slide);
    ctx.restore();
  }

  /* ---------------- main frame ---------------- */
  QT.drawFrame = function (ctx, t) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const bk = window.BrandKit.get();
    const P = bk.palette;
    const Lay = ensureLayout(ctx, W, H);

    drawBackground(ctx, W, H, P, QT.state.bg);

    const focus = QT.tt.sel ? QT.tt.focusRect(selectedRects(Lay), 36) : null;
    const cam = camera(t, focus, W, H);
    ctx.save();
    ctx.translate(cam.tx, cam.ty);
    ctx.scale(cam.s, cam.s);
    drawQuoteText(ctx, Lay, t, P, bk, cam);
    const up = T.tween(t, 3.4, 1.0, 0, 1, "out");
    QT.tt.drawUnderline(ctx, selectedRects(Lay), up, {
      color: P.accent2,
      weight: Math.round(Lay.size * 0.12),
      gap: Math.round(Lay.size * 0.22),
    });
    ctx.restore();

    drawAttribution(ctx, W, H, P, bk, t);
    drawLowerThird(ctx, W, H, P, bk, t);
    drawLogo(ctx, W, H, bk);
  };

  return QT;
})();
