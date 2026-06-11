/* quote.js — V2 flagship template.
 *
 * Implements the full feedback list:
 *  1  title (kicker) above the quote
 *  2  two-stage motion: full text first (auto-scroll when long), then camera
 *     zoom to the targeted phrase, underline sweep, hold
 *  3  positionable author block (9-grid + nudges, corner conflict avoidance)
 *  4  scrollable quote input (CSS) + autofit text so long quotes never overflow
 *  5  typewriter reveal actually types (deterministic, works in export)
 *  6  background system: solid / gradient / image + overlays + dark/light themes
 *  7  default duration 5 s
 *  8  exports through the V2 frame-accurate pipeline
 *  9  designed exit (underline retracts, word cascade, logo leaves last)
 * 10  per-element inspector (click elements on the canvas)
 * 11  always-on ambient breathing, controllable
 */
window.QuoteTemplate = (function () {
  const T = window.Timeline;
  const E = T.Ease;

  const QT = {
    id: "quote",
    name: "Quote",
    duration: 5.0,
    state: {
      title: "",
      quote: "We are building a tool that helps journalists create high-quality motion graphics in the browser.",
      name: "George Meladze",
      role: "Editor, Droeba",
      photo: null,
      photoAdjust: { scale: 1, ox: 0, oy: 0 },
      reveal: "fade",
      backing: "none",
      quoteStyle: { scale: 1, lineHeight: 1.32, align: "left", color: null },
      titleStyle: { show: true, scale: 1, color: "accent", upper: true },
      phraseStyle: { color: null, weight: 1, zoom: 0, dim: 0.35 },
      attribution: { pos: "bl", dx: 0, dy: 0, size: 1, backing: "none" },
      bg: {
        mode: "gradient", theme: "dark",
        c1: "#0f1216", c2: "#1b2330", angle: 135,
        overlays: { vignette: true, grid: false, dots: false, noise: true, diag: false },
        image: null, scrim: 0.55,
      },
    },
    tt: null,
    _layout: null,
    _sig: "",
    _hits: [],
    _cam: { s: 1, tx: 0, ty: 0, scrollY: 0 },
  };

  QT.tt = window.TextTargeting.create(QT.state.quote);
  QT.tt.sel = { start: 9, end: 11 };

  QT.BG_LIBRARY = ["bg-texture-1","bg-texture-2","bg-texture-3","bg-abstract-1","bg-abstract-2","bg-abstract-3","bg-atmos-1","bg-atmos-2","bg-atmos-3"];
  QT.REVEALS  = [["fade","revFade"],["type","revType"],["wipe","revWipe"],["cascade","revCascade"]];
  QT.BACKINGS = [["none","backNone"],["shadow","backShadow"],["panel","backPanel"]];

  QT.invalidate = function () { QT._sig = ""; };

  /* ============================ helpers ============================ */
  function brand() { return window.BrandKit.get(); }
  function breath() { return (window.MotionPrefs && window.MotionPrefs.breath) || 0; }

  /* effective palette: light theme flips ink colors; image mode forces dark */
  function pal() {
    const bk = brand();
    const p = Object.assign({}, bk.palette);
    const theme = QT.state.bg.mode === "image" ? "dark" : QT.state.bg.theme;
    if (theme === "light") Object.assign(p, bk.lightInk);
    p.theme = theme;
    return p;
  }

  function hexLerp(a, b, p) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * p);
    const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * p);
    const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * p);
    return "rgb(" + r + "," + g + "," + bl + ")";
  }

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
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.clip();
    const ar = img.naturalWidth / img.naturalHeight;
    let dw = rad * 2, dh = rad * 2;
    if (ar > 1) dw = dh * ar; else dh = dw / ar;
    dw *= adj.scale; dh *= adj.scale;
    ctx.drawImage(img, cx + adj.ox * rad - dw / 2, cy + adj.oy * rad - dh / 2, dw, dh);
    ctx.restore();
  }
  function coverImage(ctx, img, W, H) {
    const ar = img.naturalWidth / img.naturalHeight, far = W / H;
    let dw = W, dh = H, ox = 0, oy = 0;
    if (ar > far) { dw = H * ar; ox = (dw - W) / 2; } else { dh = W / ar; oy = (dh - H) / 2; }
    ctx.drawImage(img, -ox, -oy, dw, dh);
  }

  /* deterministic grain tile (built once, reused for preview + export) */
  let _noise = null;
  function noiseTile() {
    if (_noise) return _noise;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d");
    let seed = 1234567;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const im = x.createImageData(256, 256);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = 200 + rnd() * 55;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = rnd() < 0.5 ? 0 : 26;
    }
    x.putImageData(im, 0, 0);
    _noise = c;
    return c;
  }

  /* ============================ phases ============================ */
  function phases(D, hasPhrase, needScroll) {
    const c = T.clamp;
    let exit   = c(D * 0.14, 0.7, 1.5);
    let intro  = c(D * 0.09, 0.35, 0.8);
    let reveal = c(D * 0.20, 0.8, 2.4);
    let zoom   = hasPhrase ? c(D * 0.14, 0.6, 1.3) : 0;
    let hl     = hasPhrase ? c(D * 0.12, 0.45, 1.0) : 0;
    const fixed = intro + reveal + zoom + hl + exit;
    let rest = D - fixed;
    if (rest < 0.3) {
      const k = Math.max(0.1, (D - 0.3) / fixed);
      intro *= k; reveal *= k; zoom *= k; hl *= k; exit *= k;
      rest = 0.3;
    }
    const read = needScroll ? rest * 0.62 : rest * 0.34;
    const revealStart = intro * 0.55;
    const revealEnd = revealStart + reveal;
    const readEnd = revealEnd + read;
    const zoomEnd = readEnd + zoom;
    const hlEnd = zoomEnd + hl;
    const exitStart = D - exit;
    return { intro, revealStart, reveal, revealEnd, readEnd, zoom, zoomEnd, hl, hlEnd, exitStart, exit, D };
  }

  /* ============================ layout ============================ */
  function ensureLayout(ctx, W, H) {
    const bk = brand();
    const s = QT.state;
    const sig = [W, H, s.quote, s.title, s.quoteStyle.scale, s.quoteStyle.lineHeight,
                 s.quoteStyle.align, s.titleStyle.show, s.titleStyle.scale, s.titleStyle.upper,
                 bk.fonts.display, bk.locale].join("|");
    if (QT._sig === sig && QT._layout) return QT._layout;

    const portrait = H > W;
    const margin = Math.round(W * (portrait ? 0.09 : 0.072));
    const maxW = W - margin * 2 - Math.round(W * 0.02);
    const viewTop = Math.round(H * (portrait ? 0.20 : 0.22));
    const viewH = Math.round(H * (portrait ? 0.42 : 0.46));
    const fontFam = `"${bk.fonts.display}", "Archy", "Noto Sans Georgian", sans-serif`;

    /* autofit: shrink until the block fits viewH or min size reached */
    const base = W * (portrait ? 0.055 : 0.040) * s.quoteStyle.scale;
    const minSize = W * (portrait ? 0.034 : 0.024) * s.quoteStyle.scale;
    const words = QT.tt.words.map(w => w.text);

    function flow(size) {
      ctx.font = `700 ${Math.round(size)}px ${fontFam}`;
      const spaceW = ctx.measureText(" ").width;
      const lineH = Math.round(size * s.quoteStyle.lineHeight);
      const lines = [[]];
      let x = 0;
      words.forEach((wd, i) => {
        const ww = ctx.measureText(wd).width;
        if (x + ww > maxW && x > 0) { lines.push([]); x = 0; }
        lines[lines.length - 1].push({ i, text: wd, x, w: ww });
        x += ww + spaceW;
      });
      return { size: Math.round(size), lineH, lines, blockH: lines.length * lineH };
    }

    let fl = flow(base);
    while (fl.blockH > viewH && fl.size > minSize) fl = flow(fl.size * 0.94);
    const needScroll = fl.blockH > viewH + 2;

    /* title space */
    const titleSize = Math.round(W * (portrait ? 0.030 : 0.020) * s.titleStyle.scale);
    const hasTitle = !!(s.titleStyle.show && s.title.trim());
    const titleY = viewTop - Math.round(titleSize * 1.9);

    /* word rects in layout space */
    const rects = [];
    fl.lines.forEach((line, li) => {
      const lineW = line.length ? line[line.length - 1].x + line[line.length - 1].w : 0;
      const shift = s.quoteStyle.align === "center" ? (maxW - lineW) / 2 : 0;
      const baseline = viewTop + fl.lineH * li + Math.round(fl.size * 0.85);
      line.forEach(w => {
        rects.push({ x: margin + shift + w.x, y: baseline - fl.size * 0.82, w: w.w,
                     h: fl.size, baseline, wordIndex: w.i, text: w.text, line: li });
      });
    });

    let bb = { x: margin, y: viewTop, w: maxW, h: fl.blockH };
    if (rects.length) {
      let x0 = 1e9, x1 = -1e9;
      rects.forEach(r => { x0 = Math.min(x0, r.x); x1 = Math.max(x1, r.x + r.w); });
      bb = { x: x0, y: viewTop, w: x1 - x0, h: fl.blockH };
    }

    QT._layout = {
      margin, maxW, viewTop, viewH, size: fl.size, lineH: fl.lineH,
      rects, bb, needScroll, scrollMax: Math.max(0, fl.blockH - viewH),
      titleSize, titleY, hasTitle, fontFam, portrait,
    };
    QT._sig = sig;
    return QT._layout;
  }

  function selectedRects(L) { return L.rects.filter(r => QT.tt.isSelected(r.wordIndex)); }

  /* ============================ camera ============================ */
  function scrollAt(t, L, ph) {
    if (!L.needScroll) return 0;
    let target = L.scrollMax;
    const sel = selectedRects(L);
    if (sel.length) {
      const fr = QT.tt.focusRect(sel, 0);
      target = T.clamp(fr.cy - (L.viewTop + L.viewH * 0.5), 0, L.scrollMax);
    }
    return T.tween(t, ph.revealEnd, Math.max(0.2, ph.readEnd - ph.revealEnd), 0, target, "inOut");
  }

  function camera(t, L, ph, W, H) {
    const sel = selectedRects(L);
    const br = breath();
    const bs = 1 + 0.0035 * br * Math.sin(t * Math.PI * 2 / 5.5);
    const bx = br * W * 0.0012 * Math.sin(t * Math.PI * 2 / 8.3);
    const by = br * H * 0.0012 * Math.sin(t * Math.PI * 2 / 9.7);

    if (!sel.length || !ph.zoom) {
      return { s: bs, tx: (1 - bs) * W / 2 + bx, ty: (1 - bs) * H / 2 + by, zoomP: 0 };
    }
    const scrollY = scrollAt(ph.readEnd + 0.01, L, ph);  // final scroll position
    const fr = QT.tt.focusRect(sel, L.size * 0.45);
    let target = QT.state.phraseStyle.zoom > 0
      ? QT.state.phraseStyle.zoom
      : T.clamp(Math.min((W * 0.62) / fr.w, (H * 0.40) / fr.h), 1.15, 2.2);

    const zoomP = T.tween(t, ph.readEnd, ph.zoom, 0, 1, "inOutQ");
    const exitP = T.tween(t, ph.exitStart + ph.exit * 0.25, ph.exit * 0.6, 0, 1, "inOut");
    const p = zoomP * (1 - exitP);

    const s = 1 + (target - 1) * p;
    const cx = fr.cx, cy = fr.cy - scrollY;
    const tx = (W / 2 - cx * s) * p + (1 - p) * 0;
    const ty = (H * 0.46 - cy * s) * p + (1 - p) * 0;
    return { s: s * bs, tx: tx + (1 - bs) * W / 2 + bx, ty: ty + (1 - bs) * H / 2 + by, zoomP: p };
  }

  /* ============================ background ============================ */
  function drawBackground(ctx, W, H, P, t, ph) {
    const bg = QT.state.bg;
    const br = breath();
    const drift = br ? Math.sin(t * Math.PI * 2 / 11) : 0;

    if (bg.mode === "image" && bg.image) {
      ctx.save();
      const ds = 1.02 + 0.006 * br * Math.sin(t * Math.PI * 2 / 13);
      ctx.translate(W / 2, H / 2); ctx.scale(ds, ds); ctx.translate(-W / 2, -H / 2);
      coverImage(ctx, bg.image, W, H);
      ctx.restore();
      const s = ctx.createLinearGradient(0, 0, W, H);
      const a = bg.scrim;
      s.addColorStop(0, "rgba(6,8,11," + Math.min(1, a + 0.25) + ")");
      s.addColorStop(0.6, "rgba(6,8,11," + a + ")");
      s.addColorStop(1, "rgba(6,8,11," + Math.max(0, a - 0.2) + ")");
      ctx.fillStyle = s; ctx.fillRect(0, 0, W, H);
    } else if (bg.mode === "solid") {
      ctx.fillStyle = bg.c1; ctx.fillRect(0, 0, W, H);
    } else {
      const ang = (bg.angle + drift * 4) * Math.PI / 180;
      const r = Math.sqrt(W * W + H * H) / 2;
      const cx = W / 2 + drift * W * 0.01, cy = H / 2;
      const g = ctx.createLinearGradient(cx - Math.cos(ang) * r, cy - Math.sin(ang) * r,
                                         cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
      g.addColorStop(0, bg.c1); g.addColorStop(1, bg.c2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    const o = bg.overlays;
    const lineCol = P.theme === "light" ? "rgba(20,24,30,.07)" : "rgba(255,255,255,.05)";
    if (o.grid) {
      ctx.strokeStyle = lineCol; ctx.lineWidth = 1;
      const step = Math.round(W / 26);
      ctx.beginPath();
      for (let x = step; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = step; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    }
    if (o.dots) {
      ctx.fillStyle = lineCol;
      const step = Math.round(W / 38);
      for (let y = step; y < H; y += step)
        for (let x = step; x < W; x += step) { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); }
    }
    if (o.diag) {
      ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = brand().palette.accent;
      ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W, H * 0.14); ctx.lineTo(W * 0.66, 0); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, H * 0.92); ctx.lineTo(W * 0.18, H); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (o.noise) {
      ctx.save();
      ctx.globalAlpha = P.theme === "light" ? 0.5 : 0.85;
      const tile = noiseTile();
      const off = Math.floor((t * 4) % 256);
      const pat = ctx.createPattern(tile, "repeat");
      ctx.translate(-off, -off * 0.6);
      ctx.fillStyle = pat; ctx.fillRect(0, 0, W + 256, H + 256);
      ctx.restore();
    }
    /* vignette (deepens on exit) */
    const exitP = T.tween(t, ph.exitStart, ph.exit, 0, 1, "inOut");
    if (o.vignette || exitP > 0) {
      const base = o.vignette ? (P.theme === "light" ? 0.18 : 0.42) : 0;
      const a = Math.min(1, base + exitP * 0.38);
      const r = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.34, W / 2, H * 0.52, H * 1.05);
      r.addColorStop(0, "rgba(0,0,0,0)");
      r.addColorStop(1, "rgba(0,0,0," + a + ")");
      ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
    }
  }

  /* ============================ pieces ============================ */
  function drawTitle(ctx, L, t, P, ph, exitP) {
    if (!L.hasTitle) return null;
    const s = QT.state.titleStyle;
    const enter = T.tween(t, ph.intro * 0.25, 0.55, 0, 1, "out");
    const a = enter * (1 - T.clamp01(exitP * 1.6));
    if (a <= 0) return null;
    let text = QT.state.title.trim();
    if (s.upper) { try { text = text.toUpperCase(); } catch (e) {} }
    const color = s.color === "accent" ? brand().palette.accent
                : s.color === "ink" ? P.ink : s.color;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.font = `700 ${L.titleSize}px ${L.fontFam}`;
    ctx.textAlign = QT.state.quoteStyle.align === "center" ? "center" : "left";
    ctx.textBaseline = "alphabetic";
    const x = QT.state.quoteStyle.align === "center" ? L.margin + L.maxW / 2 : L.margin;
    const dy = (1 - enter) * L.titleSize * 0.8 + exitP * -L.titleSize * 0.6;
    ctx.fillText(text, x, L.titleY + dy);
    /* small accent tick under the title */
    const tw = Math.min(ctx.measureText(text).width, L.maxW);
    ctx.fillRect(QT.state.quoteStyle.align === "center" ? x - tw / 2 : x,
                 L.titleY + dy + L.titleSize * 0.45, Math.max(36, tw * 0.18) * enter, Math.max(3, L.titleSize * 0.09));
    ctx.restore();
    const tx0 = QT.state.quoteStyle.align === "center" ? x - tw / 2 : x;
    return { x: tx0, y: L.titleY - L.titleSize, w: tw, h: L.titleSize * 1.8 };
  }

  function drawQuoteBlock(ctx, L, t, P, ph, cam, exitP) {
    const s = QT.state;
    const size = L.size;
    const revP = T.tween(t, ph.revealStart, ph.reveal * 0.85, 0, 1, "out");
    const hasSel = selectedRects(L).length > 0;

    /* panel backing */
    if (s.backing === "panel") {
      ctx.save();
      ctx.globalAlpha = (P.theme === "light" ? 0.82 : 0.55) * revP * (1 - exitP);
      ctx.fillStyle = P.theme === "light" ? "#ffffff" : "#000000";
      roundRect(ctx, L.bb.x - size * 0.6, L.bb.y - size * 0.55,
                L.bb.w + size * 1.2, Math.min(L.bb.h, L.viewH) + size * 1.0, size * 0.22);
      ctx.fill();
      ctx.restore();
    }

    /* accent bar + quote mark */
    const barH = Math.min(L.bb.h, L.viewH) + size * 0.5;
    ctx.save();
    ctx.globalAlpha = revP * (1 - exitP);
    ctx.fillStyle = brand().palette.accent;
    const barGrow = T.tween(t, ph.intro * 0.3, 0.6, 0, 1, "out") * (1 - exitP * 0.6);
    ctx.fillRect(L.margin - Math.round(size * 0.45), L.viewTop - Math.round(size * 0.45),
                 Math.round(size * 0.14), barH * barGrow);
    ctx.globalAlpha = revP * 0.16 * (1 - exitP);
    ctx.fillStyle = brand().palette.accent2;
    ctx.font = `700 ${Math.round(size * 3.2)}px ${L.fontFam}`;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    const qPulse = 1 + 0.03 * breath() * Math.sin(t * Math.PI * 2 / 7);
    ctx.fillText("“", L.margin - size * 0.15, L.viewTop - size * 0.35 * qPulse);
    ctx.restore();

    /* typewriter offsets */
    const offsets = []; let cc = 0;
    L.rects.forEach(r => { offsets.push(cc); cc += r.text.length + 1; });
    const totalChars = Math.max(1, cc);
    const typeP = T.progress(t, ph.revealStart, ph.reveal);
    const shownChars = Math.floor(typeP * totalChars + 0.00001);

    /* wipe clip */
    let clipped = false;
    if (s.reveal === "wipe" && revP < 1) {
      ctx.save(); clipped = true;
      ctx.beginPath();
      ctx.rect(L.bb.x - size * 0.3, L.bb.y - size * 0.7,
               (L.bb.w + size * 0.6) * T.tween(t, ph.revealStart, ph.reveal, 0, 1, "inOut"),
               L.bb.h + size * 1.4);
      ctx.clip();
    }

    ctx.font = `700 ${size}px ${L.fontFam}`;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";

    const N = L.rects.length || 1;
    const exitUnit = Math.min(0.04, (ph.exit * 0.35) / N);
    const phraseCol = s.phraseStyle.color || brand().palette.accent2;
    const inkCol = s.quoteStyle.color || P.ink;

    L.rects.forEach((r, idx) => {
      const sel = QT.tt.isSelected(r.wordIndex);
      let alpha = 1, text = r.text, dy = 0;

      if (s.reveal === "fade") alpha = revP;
      else if (s.reveal === "cascade") {
        const wp = T.tween(t, ph.revealStart + (idx / N) * ph.reveal * 0.66, ph.reveal * 0.3, 0, 1, "out");
        alpha = wp; dy = (1 - wp) * size * 0.25;
      } else if (s.reveal === "type") {
        const start = offsets[idx], end = start + r.text.length;
        if (shownChars <= start) return;
        if (shownChars < end) text = r.text.slice(0, shownChars - start);
        alpha = 1;
      } else if (s.reveal === "wipe") alpha = 1;

      /* dim non-targeted words while zoomed */
      if (hasSel && !sel) alpha *= 1 - s.phraseStyle.dim * cam.zoomP;
      /* exit cascade */
      if (exitP > 0) {
        const we = T.tween(t, ph.exitStart + idx * exitUnit, ph.exit * 0.45, 0, 1, "inOut");
        alpha *= 1 - we; dy -= we * size * 0.3;
      }
      if (alpha <= 0.003) return;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = sel ? hexLerp(inkCol[0] === "#" ? inkCol : "#f3f4f6",
                                    phraseCol[0] === "#" ? phraseCol : "#e8b400",
                                    cam.zoomP) : inkCol;
      if (s.backing === "shadow") {
        ctx.shadowColor = "rgba(0,0,0,.75)"; ctx.shadowBlur = size * 0.3; ctx.shadowOffsetY = size * 0.05;
      }
      ctx.fillText(text, r.x, r.baseline + dy);
      if (s.backing === "shadow") { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
    });
    ctx.globalAlpha = 1;
    if (clipped) ctx.restore();

    /* underline sweep + retract */
    const selR = selectedRects(L);
    if (selR.length) {
      const sweep = T.tween(t, ph.zoomEnd - ph.zoom * 0.15, Math.max(0.3, ph.hl * 0.8), 0, 1, "inOutQ");
      const retract = T.tween(t, ph.exitStart, ph.exit * 0.3, 0, 1, "inOut");
      const prog = sweep * (1 - retract);
      QT.tt.drawUnderline(ctx, selR, prog, {
        color: phraseCol,
        weight: Math.max(3, Math.round(size * 0.11 * s.phraseStyle.weight)),
        gap: Math.round(size * 0.2),
      });
    }
  }

  function attributionAnchor(W, H, L) {
    const a = QT.state.attribution;
    const bk = brand();
    const m = Math.round(W * 0.072);
    const photoR = Math.round(H * 0.075 * a.size);
    const boxH = photoR * 2;
    const nameW = 0.34 * W;                       // generous estimate, refined at draw
    const [v, hp] = window.BrandKit.posParts(a.pos);
    let x = hp === "l" ? m : hp === "r" ? W - m - nameW : (W - nameW) / 2;
    let y = v === "t" ? m + boxH / 2 : v === "b" ? H - m - boxH / 2 : H / 2;
    /* corner conflict with logo: nudge inward */
    QT._cornerConflict = false;
    if (a.pos === bk.logo.position && ["tl","tr","bl","br"].indexOf(a.pos) >= 0) {
      QT._cornerConflict = true;
      y += v === "t" ? H * 0.12 : -H * 0.12;
    }
    x += a.dx * W * 0.01;
    y += a.dy * H * 0.01;
    return { x, y, photoR, v, hp };
  }

  function drawAttribution(ctx, W, H, P, t, ph, exitP) {
    const s = QT.state;
    if (!s.name && !s.role && !s.photo) return null;
    const an = attributionAnchor(W, H);
    const photoEnter = T.tween(t, ph.intro * 0.4, 0.6, 0, 1, "outBack");
    const nameEnter = T.tween(t, ph.intro * 0.7, 0.6, 0, 1, "out");
    const a = (1 - T.clamp01(exitP * 1.5));
    if (a <= 0) return null;

    const bk = brand();
    const photoR = an.photoR;
    const nameSize = Math.round(H * 0.040 * s.attribution.size);
    const roleSize = Math.round(H * 0.027 * s.attribution.size);
    const gap = Math.round(W * 0.018);

    /* measure for backing + hit rect */
    ctx.font = `700 ${nameSize}px ${L_fontFam()}`;
    const nameW = ctx.measureText(s.name || "").width;
    ctx.font = `400 ${roleSize}px "${bk.fonts.body}", "Noto Sans Georgian", sans-serif`;
    const roleW = ctx.measureText(s.role || "").width;
    const textW = Math.max(nameW, roleW);
    const hasPhoto = true;  // placeholder circle counts
    const totalW = photoR * 2 + gap + textW;

    let x0 = an.x;
    if (an.hp === "r") x0 = an.x + (0.34 * W) - totalW;       // right-align content
    if (an.hp === "c") x0 = an.x + (0.34 * W - totalW) / 2;
    const cy = an.y;

    /* backing */
    if (s.attribution.backing === "panel") {
      ctx.save();
      ctx.globalAlpha = 0.55 * a * nameEnter;
      ctx.fillStyle = P.theme === "light" ? "rgba(255,255,255,.9)" : "rgba(0,0,0,.55)";
      roundRect(ctx, x0 - photoR * 0.35, cy - photoR - photoR * 0.25,
                totalW + photoR * 0.9, photoR * 2 + photoR * 0.5, photoR * 0.3);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = photoEnter * a;
    const pr = photoR * (0.92 + 0.08 * photoEnter) * (1 + 0.01 * breath() * Math.sin(t * Math.PI * 2 / 6.1));
    const pcx = x0 + photoR, pcy = cy;
    if (s.photo) {
      circleImage(ctx, s.photo, pcx, pcy, pr, s.photoAdjust);
      ctx.lineWidth = Math.max(3, H * 0.004);
      ctx.strokeStyle = bk.palette.accent;
      ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = P.theme === "light" ? "#dfe3ea" : P.surface;
      ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = P.theme === "light" ? "rgba(0,0,0,.15)" : "rgba(255,255,255,.2)";
      ctx.stroke();
      ctx.fillStyle = P.theme === "light" ? "rgba(0,0,0,.35)" : "rgba(255,255,255,.35)";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `600 ${Math.round(photoR * 0.38)}px "ArchivoNarrow", sans-serif`;
      ctx.fillText("PHOTO", pcx, pcy);
    }
    ctx.restore();

    const slide = (1 - nameEnter) * 16 + exitP * 18;
    ctx.save();
    ctx.globalAlpha = nameEnter * a;
    const tx = x0 + photoR * 2 + gap;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    const shadow = s.attribution.backing === "shadow";
    if (shadow) { ctx.shadowColor = "rgba(0,0,0,.7)"; ctx.shadowBlur = H * 0.012; ctx.shadowOffsetY = H * 0.002; }
    ctx.fillStyle = P.ink;
    ctx.font = `700 ${nameSize}px ${L_fontFam()}`;
    ctx.fillText(s.name || "", tx, cy - H * 0.002 + slide);
    ctx.fillStyle = P.muted;
    ctx.font = `400 ${roleSize}px "${bk.fonts.body}", "Noto Sans Georgian", sans-serif`;
    ctx.fillText(s.role || "", tx, cy + H * 0.038 + slide);
    ctx.restore();

    return { x: x0 - 8, y: cy - photoR - 8, w: totalW + 16, h: photoR * 2 + 16 };
  }
  function L_fontFam() {
    const bk = brand();
    return `"${bk.fonts.display}", "Archy", "Noto Sans Georgian", sans-serif`;
  }

  function drawLogo(ctx, W, H, t, ph, exitP) {
    const bk = brand();
    const box = window.BrandKit.logoBox(W, H);
    const enter = T.tween(t, 0.05, 0.5, 0, 1, "out");
    const leave = T.tween(t, ph.exitStart + ph.exit * 0.55, ph.exit * 0.4, 0, 1, "inOut");
    const a = enter * (1 - leave) * (bk.logo.opacity != null ? bk.logo.opacity : 1);
    if (a <= 0) return box;
    ctx.save();
    ctx.globalAlpha = a;
    if (bk.logo.image) ctx.drawImage(bk.logo.image, box.x, box.y, box.w, box.h);
    else {
      ctx.setLineDash([6, 6]); ctx.strokeStyle = "rgba(150,160,175,.4)"; ctx.lineWidth = 2;
      roundRect(ctx, box.x, box.y, box.w, box.h, 8); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(150,160,175,.6)";
      ctx.font = `600 ${Math.round(box.h * 0.28)}px "ArchivoNarrow", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("LOGO", box.x + box.w / 2, box.y + box.h / 2);
    }
    ctx.restore();
    return box;
  }

  /* ============================ main frame ============================ */
  QT.drawFrame = function (ctx, t) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const P = pal();
    const L = ensureLayout(ctx, W, H);
    const sel = selectedRects(L);
    const ph = phases(QT.duration, sel.length > 0, L.needScroll);
    const exitP = T.tween(t, ph.exitStart, ph.exit, 0, 1, "inOut");

    drawBackground(ctx, W, H, P, t, ph);

    const scrollY = scrollAt(t, L, ph);
    const cam = camera(t, L, ph, W, H);
    QT._cam = { s: cam.s, tx: cam.tx, ty: cam.ty, scrollY };

    ctx.save();
    ctx.translate(cam.tx, cam.ty);
    ctx.scale(cam.s, cam.s);

    /* clip the scroll viewport when the text is long */
    if (L.needScroll) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, L.viewTop - L.size * 1.1, W, L.viewH + L.size * 2.0);
      ctx.clip();
    }
    ctx.translate(0, -scrollY);
    const titleRect = drawTitle(ctx, L, t, P, ph, exitP);
    drawQuoteBlock(ctx, L, t, P, ph, cam, exitP);
    ctx.translate(0, scrollY);
    if (L.needScroll) ctx.restore();

    ctx.restore();

    const attrRect = drawAttribution(ctx, W, H, P, t, ph, exitP);
    const logoBox = drawLogo(ctx, W, H, t, ph, exitP);

    /* hit registry (screen space) */
    const toScreen = r => r && ({
      x: r.x * cam.s + cam.tx, y: (r.y - scrollY) * cam.s + cam.ty,
      w: r.w * cam.s, h: r.h * cam.s,
    });
    QT._hits = [];
    if (titleRect) QT._hits.push({ id: "title", r: toScreen(titleRect) });
    QT._hits.push({ id: "quote", r: toScreen({ x: L.bb.x, y: Math.max(L.bb.y, L.viewTop), w: L.bb.w, h: Math.min(L.bb.h, L.viewH) }) });
    if (attrRect) QT._hits.push({ id: "attribution", r: attrRect });
    QT._hits.push({ id: "logo", r: { x: logoBox.x - 6, y: logoBox.y - 6, w: logoBox.w + 12, h: logoBox.h + 12 } });
  };

  /* ============================ picking ============================ */
  QT.hit = function (x, y) {
    for (let i = QT._hits.length - 1; i >= 0; i--) {
      const h = QT._hits[i];
      if (h.r && x >= h.r.x && x <= h.r.x + h.r.w && y >= h.r.y && y <= h.r.y + h.r.h) return h.id;
    }
    return "background";
  };
  QT.wordAt = function (x, y) {
    if (!QT._layout) return -1;
    const c = QT._cam;
    const lx = (x - c.tx) / c.s;
    const ly = (y - c.ty) / c.s + c.scrollY;
    const pad = QT._layout.size * 0.18;
    for (const r of QT._layout.rects) {
      if (lx >= r.x - pad && lx <= r.x + r.w + pad && ly >= r.y - pad && ly <= r.y + r.h + pad) return r.wordIndex;
    }
    return -1;
  };
  QT.getElementRect = function (id) {
    if (id === "phrase") {
      const selR = selectedRects(QT._layout || { rects: [] });
      if (!selR.length) return null;
      const fr = QT.tt.focusRect(selR, 6);
      const c = QT._cam;
      return { x: fr.x * c.s + c.tx, y: (fr.y - c.scrollY) * c.s + c.ty, w: fr.w * c.s, h: fr.h * c.s };
    }
    const h = QT._hits.find(h => h.id === id);
    return h ? h.r : null;
  };
  QT.elements = ["background", "title", "quote", "phrase", "attribution", "logo"];

  /* ============================ serialize ============================ */
  function imgToData(img) {
    if (!img) return null;
    try {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      return c.toDataURL("image/jpeg", 0.85);
    } catch (e) { return null; }
  }
  function dataToImg(data) {
    return new Promise(res => {
      if (!data) return res(null);
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = data;
    });
  }
  QT.serialize = function () {
    const s = JSON.parse(JSON.stringify(QT.state, (k, v) => (v instanceof Image ? undefined : v)));
    s.photoData = imgToData(QT.state.photo);
    s.bg.imageData = imgToData(QT.state.bg.image);
    s.sel = QT.tt.sel;
    return s;
  };
  QT.restore = async function (s) {
    if (!s) return;
    const photo = await dataToImg(s.photoData);
    const bgImg = await dataToImg(s.bg && s.bg.imageData);
    delete s.photoData; if (s.bg) delete s.bg.imageData;
    const sel = s.sel || null; delete s.sel;
    /* deep merge onto defaults to stay forward-compatible */
    const merge = (t, src) => { for (const k in src) {
      if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k]) && t[k]) merge(t[k], src[k]);
      else t[k] = src[k];
    } };
    merge(QT.state, s);
    QT.state.photo = photo;
    QT.state.bg.image = bgImg;
    QT.tt.setText(QT.state.quote);
    QT.tt.sel = sel;
    QT.invalidate();
  };

  /* ============================ editor (left panel) ============================ */
  function wireDropZone(el, onFile) {
    el.addEventListener("dragover", e => { e.preventDefault(); el.classList.add("drag-over"); });
    el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
    el.addEventListener("drop", e => {
      e.preventDefault(); el.classList.remove("drag-over");
      const f = e.dataTransfer.files[0];
      if (f && f.type.indexOf("image/") === 0) onFile(f);
    });
  }

  QT.editor = function (container, onChange) {
    const L = window.Lang;
    const ch = () => { QT.invalidate(); onChange && onChange(); window.Project.touch(); };

    container.innerHTML = `
      <div class="section-title">${L.t('templateQuote')}</div>
      <div class="field">
        <label>${L.t('titleField')}</label>
        <input type="text" id="q-title-in" />
      </div>
      <div class="field">
        <label>${L.t('quoteText')}</label>
        <textarea id="q-text" rows="5"></textarea>
        <button class="ai-btn" id="q-ai">${L.t('aiHelpText')}</button>
      </div>
      <div class="field">
        <label>${L.t('targetPhrase')}</label>
        <div class="word-pick" id="q-words"></div>
        <div class="hint">${L.t('targetHint')}
          <a id="q-all" style="cursor:pointer">${L.t('selectAll')}</a> ·
          <a id="q-clear" style="cursor:pointer">${L.t('clearSel')}</a></div>
      </div>
      <div class="field">
        <label>${L.t('textReveal')}</label>
        <select id="q-reveal">${QT.REVEALS.map(([v,k]) =>
          `<option value="${v}"${v===QT.state.reveal?" selected":""}>${L.t(k)}</option>`).join("")}</select>
      </div>
      <div class="field">
        <label>${L.t('nameLabel')}</label>
        <input type="text" id="q-name" />
      </div>
      <div class="field">
        <label>${L.t('titleSource')}</label>
        <input type="text" id="q-role" />
      </div>
      <div class="field">
        <label>${L.t('speakerPhoto')}</label>
        <div class="logo-drop" id="q-photo-drop">${L.t('photoDropText')}</div>
        <input type="file" id="q-photo" accept="image/*" hidden />
        <div class="adjust">
          <label>Zoom <input type="range" id="pa-scale" min="100" max="280" value="${QT.state.photoAdjust.scale*100}"></label>
          <label>X <input type="range" id="pa-x" min="-100" max="100" value="${QT.state.photoAdjust.ox*100}"></label>
          <label>Y <input type="range" id="pa-y" min="-100" max="100" value="${QT.state.photoAdjust.oy*100}"></label>
        </div>
        <div class="hint"><a id="q-photo-rm" style="cursor:pointer">${L.t('removePhoto')}</a></div>
      </div>
      <div class="field">
        <label>${L.t('bgTheme')}</label>
        <div class="theme-row">
          <div class="theme-card dark-c" id="q-theme-dark">${L.t('themeDark')}</div>
          <div class="theme-card light-c" id="q-theme-light">${L.t('themeLight')}</div>
        </div>
        <div class="hint">${L.t('inspectorHint')}</div>
      </div>`;

    const $ = s => container.querySelector(s);
    $("#q-title-in").value = QT.state.title;
    $("#q-text").value = QT.state.quote;
    $("#q-name").value = QT.state.name;
    $("#q-role").value = QT.state.role;

    const repaintWords = () => QT.tt.buildPicker($("#q-words"), ch);
    repaintWords();

    $("#q-title-in").addEventListener("input", e => { QT.state.title = e.target.value; ch(); });
    $("#q-text").addEventListener("input", e => {
      QT.state.quote = e.target.value; QT.tt.setText(e.target.value);
      repaintWords(); ch();
    });
    $("#q-all").addEventListener("click", () => {
      if (QT.tt.words.length) { QT.tt.sel = { start: 0, end: QT.tt.words.length - 1 }; }
      repaintWords(); ch();
    });
    $("#q-clear").addEventListener("click", () => { QT.tt.clearSelection(); repaintWords(); ch(); });
    $("#q-name").addEventListener("input", e => { QT.state.name = e.target.value; ch(); });
    $("#q-role").addEventListener("input", e => { QT.state.role = e.target.value; ch(); });
    $("#q-reveal").addEventListener("change", e => { QT.state.reveal = e.target.value; ch(); });

    const drop = $("#q-photo-drop");
    const loadPhoto = f => {
      const img = new Image();
      img.onload = () => { QT.state.photo = img; drop.textContent = f.name; ch(); };
      img.src = URL.createObjectURL(f);
    };
    drop.addEventListener("click", () => $("#q-photo").click());
    $("#q-photo").addEventListener("change", e => { if (e.target.files[0]) loadPhoto(e.target.files[0]); });
    wireDropZone(drop, loadPhoto);
    $("#q-photo-rm").addEventListener("click", () => {
      QT.state.photo = null; drop.textContent = L.t('photoDropText'); ch();
    });
    $("#pa-scale").addEventListener("input", e => { QT.state.photoAdjust.scale = e.target.value / 100; ch(); });
    $("#pa-x").addEventListener("input", e => { QT.state.photoAdjust.ox = e.target.value / 100; ch(); });
    $("#pa-y").addEventListener("input", e => { QT.state.photoAdjust.oy = e.target.value / 100; ch(); });

    $("#q-theme-dark").addEventListener("click", () => { applyTheme("dark"); ch(); });
    $("#q-theme-light").addEventListener("click", () => { applyTheme("light"); ch(); });
    $("#q-ai").addEventListener("click", () => alert(L.t('aiHelpText') + "\n(coming later: central free key, user key override)"));
  };

  function applyTheme(theme) {
    const bg = QT.state.bg;
    bg.theme = theme;
    if (bg.mode === "image") bg.mode = "gradient";
    if (theme === "dark") {
      bg.c1 = "#0f1216"; bg.c2 = "#1b2330";
      bg.overlays.vignette = true; bg.overlays.noise = true; bg.overlays.grid = false; bg.overlays.dots = false;
    } else {
      bg.c1 = "#f4f5f8"; bg.c2 = "#dde2ea";
      bg.overlays.vignette = false; bg.overlays.noise = true; bg.overlays.grid = true; bg.overlays.dots = false;
    }
  }

  /* ============================ inspector (right panel) ============================ */
  QT.inspector = function (el, container, onChange) {
    const L = window.Lang;
    const ch = () => { QT.invalidate(); onChange && onChange(); window.Project.touch(); };
    const fld = (label, inner) => `<div class="field"><label>${label}</label>${inner}</div>`;
    const slider = (id, min, max, val, step) =>
      `<input type="range" id="${id}" min="${min}" max="${max}" value="${val}" step="${step || 1}">`;

    let html = "";
    if (el === "background") {
      const bg = QT.state.bg;
      html += fld(L.t('bgTheme'), `<div class="theme-row">
          <div class="theme-card dark-c ${bg.theme==='dark'?'active':''}" id="i-th-dark">${L.t('themeDark')}</div>
          <div class="theme-card light-c ${bg.theme==='light'?'active':''}" id="i-th-light">${L.t('themeLight')}</div>
        </div>`);
      html += fld(L.t('bgMode'), `<div class="seg" id="i-mode">
          <button data-m="solid"${bg.mode==='solid'?' class="active"':''}>${L.t('bgSolid')}</button>
          <button data-m="gradient"${bg.mode==='gradient'?' class="active"':''}>${L.t('bgGradient')}</button>
          <button data-m="image"${bg.mode==='image'?' class="active"':''}>${L.t('bgImage')}</button>
        </div>`);
      html += `<div class="row" style="margin-bottom:13px">
          <div class="field" style="margin:0">
            <label>${L.t('color1')}</label><input type="color" id="i-c1" value="${bg.c1}">
          </div>
          <div class="field" style="margin:0">
            <label>${L.t('color2')}</label><input type="color" id="i-c2" value="${bg.c2}">
          </div>
        </div>`;
      html += fld(L.t('angleLabel'), slider("i-angle", 0, 360, bg.angle));
      const o = bg.overlays;
      html += fld(L.t('overlaysLabel'), `
        <label class="check"><input type="checkbox" id="i-ov-v"${o.vignette?' checked':''}>${L.t('ovVignette')}</label>
        <label class="check"><input type="checkbox" id="i-ov-g"${o.grid?' checked':''}>${L.t('ovGrid')}</label>
        <label class="check"><input type="checkbox" id="i-ov-d"${o.dots?' checked':''}>${L.t('ovDots')}</label>
        <label class="check"><input type="checkbox" id="i-ov-n"${o.noise?' checked':''}>${L.t('ovNoise')}</label>
        <label class="check"><input type="checkbox" id="i-ov-a"${o.diag?' checked':''}>${L.t('ovDiag')}</label>`);
      html += fld(L.t('scrimLabel'), slider("i-scrim", 0, 90, Math.round(bg.scrim * 100)));
      html += fld(L.t('bgLibrary'), `<div class="bg-lib" id="i-bg-lib"></div>
        <div class="logo-drop" id="i-bg-drop" style="margin-top:8px">${L.t('bgDropText')}</div>
        <input type="file" id="i-bg-file" accept="image/*" hidden />`);
    }
    else if (el === "title") {
      const ts = QT.state.titleStyle;
      html += fld(L.t('elTitle'), `<input type="text" id="i-title-text" value="">`);
      html += `<label class="check"><input type="checkbox" id="i-title-show"${ts.show?' checked':''}>${L.t('showTitle')}</label>`;
      html += `<label class="check"><input type="checkbox" id="i-title-up"${ts.upper?' checked':''}>${L.t('upperCase')}</label>`;
      html += fld(L.t('sizeLabel'), slider("i-title-size", 60, 160, Math.round(ts.scale * 100)));
      html += fld(L.t('colorLabel'), `<div class="seg" id="i-title-col">
          <button data-c="accent"${ts.color==='accent'?' class="active"':''}>${L.t('useAccent')}</button>
          <button data-c="ink"${ts.color==='ink'?' class="active"':''}>${L.t('useInk')}</button>
        </div>`);
    }
    else if (el === "quote") {
      const qs = QT.state.quoteStyle;
      html += fld(L.t('sizeLabel'), slider("i-q-size", 70, 130, Math.round(qs.scale * 100)));
      html += fld(L.t('lineHeight'), slider("i-q-lh", 110, 165, Math.round(qs.lineHeight * 100)));
      html += fld(L.t('alignLabel'), `<div class="seg" id="i-q-align">
          <button data-a="left"${qs.align==='left'?' class="active"':''}>${L.t('alignLeft')}</button>
          <button data-a="center"${qs.align==='center'?' class="active"':''}>${L.t('alignCenter')}</button>
        </div>`);
      html += fld(L.t('textBacking') + " · " + L.t('backingHint'),
        `<select id="i-q-back">${QT.BACKINGS.map(([v,k]) =>
          `<option value="${v}"${v===QT.state.backing?" selected":""}>${L.t(k)}</option>`).join("")}</select>`);
      html += fld(L.t('textReveal'),
        `<select id="i-q-reveal">${QT.REVEALS.map(([v,k]) =>
          `<option value="${v}"${v===QT.state.reveal?" selected":""}>${L.t(k)}</option>`).join("")}</select>`);
    }
    else if (el === "phrase") {
      const ps = QT.state.phraseStyle;
      const has = QT.tt.sel != null;
      html += `<div class="hint" style="margin:0 0 10px">${has ? L.t('phraseHint') : L.t('noPhrase')}</div>`;
      html += fld(L.t('accent2Color'), `<input type="color" id="i-p-col" value="${ps.color || brand().palette.accent2}">`);
      html += fld(L.t('underlineWeight'), slider("i-p-w", 50, 220, Math.round(ps.weight * 100)));
      html += fld(L.t('zoomStrength') + " (" + L.t('zoomAuto') + " = 0)", slider("i-p-z", 0, 220, Math.round(ps.zoom * 100)));
      html += fld(L.t('dimOthers'), slider("i-p-dim", 0, 70, Math.round(ps.dim * 100)));
      html += `<button class="btn small wide" id="i-p-clear">${L.t('clearSel')}</button>`;
    }
    else if (el === "attribution") {
      const at = QT.state.attribution;
      if (QT._cornerConflict) html += `<span class="insp-warn">${L.t('sameCornerWarn')}</span>`;
      html += fld(L.t('posLabel'), `<div class="pos-grid" id="i-a-pos"></div>`);
      html += fld(L.t('nudgeX'), slider("i-a-dx", -12, 12, at.dx, 0.5));
      html += fld(L.t('nudgeY'), slider("i-a-dy", -12, 12, at.dy, 0.5));
      html += fld(L.t('sizeLabel'), slider("i-a-size", 70, 140, Math.round(at.size * 100)));
      html += fld(L.t('attrBacking'),
        `<select id="i-a-back">${QT.BACKINGS.map(([v,k]) =>
          `<option value="${v}"${v===at.backing?" selected":""}>${L.t(k)}</option>`).join("")}</select>`);
    }
    else if (el === "logo") {
      const lg = brand().logo;
      html += fld(L.t('logoPosition'), `<div class="pos-grid" id="i-l-pos"></div>`);
      html += fld(L.t('logoScale'), slider("i-l-scale", 4, 22, Math.round(lg.scale * 100), 0.5));
      html += fld(L.t('logoOpacity'), slider("i-l-op", 10, 100, Math.round((lg.opacity != null ? lg.opacity : 1) * 100)));
    }
    container.innerHTML = html;

    const $ = s => container.querySelector(s);

    if (el === "background") {
      const bg = QT.state.bg;
      $("#i-th-dark").addEventListener("click", () => { applyTheme("dark"); QT.inspector(el, container, onChange); ch(); });
      $("#i-th-light").addEventListener("click", () => { applyTheme("light"); QT.inspector(el, container, onChange); ch(); });
      $("#i-mode").addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return;
        bg.mode = b.dataset.m;
        [...$("#i-mode").children].forEach(c => c.classList.toggle("active", c === b));
        ch();
      });
      $("#i-c1").addEventListener("input", e => { bg.c1 = e.target.value; ch(); });
      $("#i-c2").addEventListener("input", e => { bg.c2 = e.target.value; bg.mode = bg.mode === "solid" ? "gradient" : bg.mode; ch(); });
      $("#i-angle").addEventListener("input", e => { bg.angle = +e.target.value; ch(); });
      const ov = [["i-ov-v","vignette"],["i-ov-g","grid"],["i-ov-d","dots"],["i-ov-n","noise"],["i-ov-a","diag"]];
      ov.forEach(([id, key]) => $("#" + id).addEventListener("change", e => { bg.overlays[key] = e.target.checked; ch(); }));
      $("#i-scrim").addEventListener("input", e => { bg.scrim = e.target.value / 100; ch(); });
      const lib = $("#i-bg-lib");
      QT.BG_LIBRARY.forEach(name => {
        const src = "/assets/backgrounds/" + name + ".png";
        const th = document.createElement("img");
        th.className = "bg-thumb"; th.src = src; th.loading = "lazy";
        th.addEventListener("click", () => {
          const img = new Image();
          img.onload = () => { bg.image = img; bg.mode = "image";
            [...lib.children].forEach(c => c.classList.toggle("active", c === th)); ch(); };
          img.src = src;
        });
        lib.appendChild(th);
      });
      const bgDrop = $("#i-bg-drop");
      bgDrop.addEventListener("click", () => $("#i-bg-file").click());
      const loadBg = f => {
        const img = new Image();
        img.onload = () => { bg.image = img; bg.mode = "image"; bgDrop.textContent = f.name; ch(); };
        img.src = URL.createObjectURL(f);
      };
      $("#i-bg-file").addEventListener("change", e => { if (e.target.files[0]) loadBg(e.target.files[0]); });
      wireDropZone(bgDrop, loadBg);
    }
    else if (el === "title") {
      const ts = QT.state.titleStyle;
      $("#i-title-text").value = QT.state.title;
      $("#i-title-text").addEventListener("input", e => { QT.state.title = e.target.value; ch(); });
      $("#i-title-show").addEventListener("change", e => { ts.show = e.target.checked; ch(); });
      $("#i-title-up").addEventListener("change", e => { ts.upper = e.target.checked; ch(); });
      $("#i-title-size").addEventListener("input", e => { ts.scale = e.target.value / 100; ch(); });
      $("#i-title-col").addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return;
        ts.color = b.dataset.c;
        [...$("#i-title-col").children].forEach(c => c.classList.toggle("active", c === b));
        ch();
      });
    }
    else if (el === "quote") {
      const qs = QT.state.quoteStyle;
      $("#i-q-size").addEventListener("input", e => { qs.scale = e.target.value / 100; ch(); });
      $("#i-q-lh").addEventListener("input", e => { qs.lineHeight = e.target.value / 100; ch(); });
      $("#i-q-align").addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return;
        qs.align = b.dataset.a;
        [...$("#i-q-align").children].forEach(c => c.classList.toggle("active", c === b));
        ch();
      });
      $("#i-q-back").addEventListener("change", e => { QT.state.backing = e.target.value; ch(); });
      $("#i-q-reveal").addEventListener("change", e => { QT.state.reveal = e.target.value; ch(); });
    }
    else if (el === "phrase") {
      const ps = QT.state.phraseStyle;
      $("#i-p-col").addEventListener("input", e => { ps.color = e.target.value; ch(); });
      $("#i-p-w").addEventListener("input", e => { ps.weight = e.target.value / 100; ch(); });
      $("#i-p-z").addEventListener("input", e => { ps.zoom = e.target.value / 100; ch(); });
      $("#i-p-dim").addEventListener("input", e => { ps.dim = e.target.value / 100; ch(); });
      $("#i-p-clear").addEventListener("click", () => { QT.tt.clearSelection(); ch();
        if (window.App && window.App.refreshEditor) window.App.refreshEditor(); });
    }
    else if (el === "attribution") {
      const at = QT.state.attribution;
      const grid = $("#i-a-pos");
      const positions = ["tl","tc","tr","ml","mc","mr","bl","bc","br"];
      positions.forEach(p => {
        const b = document.createElement("button");
        b.className = (p === at.pos ? "active" : "") + (p === brand().logo.position ? " occupied" : "");
        b.title = p;
        b.addEventListener("click", () => {
          at.pos = p;
          [...grid.children].forEach(x => x.classList.toggle("active", x === b));
          ch();
          QT.inspector(el, container, onChange);   // refresh warning
        });
        grid.appendChild(b);
      });
      $("#i-a-dx").addEventListener("input", e => { at.dx = +e.target.value; ch(); });
      $("#i-a-dy").addEventListener("input", e => { at.dy = +e.target.value; ch(); });
      $("#i-a-size").addEventListener("input", e => { at.size = e.target.value / 100; ch(); });
      $("#i-a-back").addEventListener("change", e => { at.backing = e.target.value; ch(); });
    }
    else if (el === "logo") {
      const grid = $("#i-l-pos");
      const positions = ["tl","tc","tr","ml","mc","mr","bl","bc","br"];
      positions.forEach(p => {
        const b = document.createElement("button");
        b.className = (p === brand().logo.position ? "active" : "") + (p === QT.state.attribution.pos ? " occupied" : "");
        b.title = p;
        b.addEventListener("click", () => {
          window.BrandKit.setLogoPosition(p);
          [...grid.children].forEach(x => x.classList.toggle("active", x === b));
          ch();
        });
        grid.appendChild(b);
      });
      $("#i-l-scale").addEventListener("input", e => { brand().logo.scale = e.target.value / 100; ch(); });
      $("#i-l-op").addEventListener("input", e => { brand().logo.opacity = e.target.value / 100; ch(); });
    }
  };

  return QT;
})();
