/* social.js — TEMPLATE 2 (Social Post).
 *
 * Facebook skin: authentic post card with header (avatar, name, verified tick,
 * date), post text, optional post image, and the like/comment/share bar.
 * After the card fully appears, the camera zooms to the targeted phrase and
 * draws the same underline sweep as Quote.
 *
 * X and Instagram remain labeled "coming later" per the original plan.
 *
 * Improvement #11: replaces the stub with a fully animated Facebook skin.
 */
window.SocialTemplate = (function () {
  const T = window.Timeline;

  const ST = {
    id: "social",
    name: "Social",
    later: false,          // no longer "coming soon" — it's built
    duration: 8.0,
    state: {
      author:    "Droeba",
      handle:    "@droeba",
      verified:  true,
      date:      "2h",
      text:      "We are building a tool that helps journalists create high-quality motion graphics in the browser.",
      postImage: null,   // HTMLImageElement
      avatar:    null,   // HTMLImageElement
    },
    tt: null,
    _layout: null,
    _sig: "",
  };

  ST.tt = window.TextTargeting.create(ST.state.text);
  ST.tt.sel = { start: 9, end: 11 };

  ST.invalidate = function () { ST._sig = ""; };

  /* ---------------- editor ---------------- */
  ST.editor = function (container, onChange) {
    container.innerHTML = `
      <div class="section-title">Social Post</div>
      <div class="seg" style="margin-bottom:14px">
        <button class="active">Facebook</button>
        <button disabled title="coming later">X</button>
        <button disabled title="coming later">Instagram</button>
      </div>
      <div class="field">
        <label>Author name</label>
        <input type="text" id="st-author" value="${ST.state.author}" />
      </div>
      <div class="field">
        <label>Handle / source</label>
        <input type="text" id="st-handle" value="${ST.state.handle}" />
      </div>
      <div class="field" style="display:flex;align-items:center;gap:10px">
        <label style="margin:0;display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="st-verified" ${ST.state.verified?"checked":""} />
          Verified tick
        </label>
        <div style="flex:1"></div>
        <label style="margin:0">
          Date&nbsp;<input type="text" id="st-date" value="${ST.state.date}" style="width:60px" />
        </label>
      </div>
      <div class="field">
        <label>Post text</label>
        <textarea id="st-text"></textarea>
      </div>
      <div class="field">
        <label>Target a phrase</label>
        <div class="word-pick" id="st-words"></div>
        <div class="hint"><a id="st-clear" style="color:var(--accent);cursor:pointer">clear selection</a></div>
      </div>
      <div class="field">
        <label>Avatar photo</label>
        <div class="logo-drop" id="st-avatar-drop">Click or drop an avatar image</div>
        <input type="file" id="st-avatar-file" accept="image/*" hidden />
      </div>
      <div class="field">
        <label>Post image (optional)</label>
        <div class="logo-drop" id="st-img-drop">Click or drop a post image</div>
        <input type="file" id="st-img-file" accept="image/*" hidden />
      </div>
    `;

    const $ = s => container.querySelector(s);
    $("#st-text").value = ST.state.text;

    const repaint = () => ST.tt.buildPicker($("#st-words"), () => { ST.invalidate(); onChange && onChange(); });
    repaint();

    $("#st-author").addEventListener("input", e => { ST.state.author = e.target.value; ST.invalidate(); onChange && onChange(); });
    $("#st-handle").addEventListener("input", e => { ST.state.handle = e.target.value; onChange && onChange(); });
    $("#st-verified").addEventListener("change", e => { ST.state.verified = e.target.checked; onChange && onChange(); });
    $("#st-date").addEventListener("input", e => { ST.state.date = e.target.value; onChange && onChange(); });
    $("#st-text").addEventListener("input", e => {
      ST.state.text = e.target.value; ST.tt.setText(e.target.value);
      repaint(); ST.invalidate(); onChange && onChange();
    });
    $("#st-clear").addEventListener("click", () => { ST.tt.clearSelection(); repaint(); ST.invalidate(); onChange && onChange(); });

    wireFile($("#st-avatar-drop"), $("#st-avatar-file"), img => { ST.state.avatar = img; onChange && onChange(); });
    wireFile($("#st-img-drop"),    $("#st-img-file"),    img => { ST.state.postImage = img; ST.invalidate(); onChange && onChange(); });
  };

  function wireFile(dropEl, inputEl, onLoad) {
    dropEl.addEventListener("click", () => inputEl.click());
    inputEl.addEventListener("change", e => {
      const f = e.target.files[0]; if (!f) return;
      loadImg(f, img => { onLoad(img); dropEl.textContent = f.name; });
    });
    dropEl.addEventListener("dragover", e => { e.preventDefault(); dropEl.classList.add("drag-over"); });
    dropEl.addEventListener("dragleave", () => dropEl.classList.remove("drag-over"));
    dropEl.addEventListener("drop", e => {
      e.preventDefault(); dropEl.classList.remove("drag-over");
      const f = e.dataTransfer.files[0]; if (!f || !f.type.startsWith("image/")) return;
      loadImg(f, img => { onLoad(img); dropEl.textContent = f.name; });
    });
  }
  function loadImg(f, cb) {
    const img = new Image(); img.onload = () => cb(img); img.src = URL.createObjectURL(f);
  }

  /* ---------------- card layout ---------------- */
  function ensureLayout(ctx, W, H) {
    const sig = [W, H, ST.state.text, ST.state.postImage ? "img" : ""].join("|");
    if (ST._sig === sig && ST._layout) return ST._layout;

    const cardW  = Math.round(W * 0.52);
    const cardX  = Math.round((W - cardW) / 2);
    const padH   = Math.round(H * 0.048);
    const padV   = Math.round(H * 0.032);
    const headerH = Math.round(H * 0.092);
    const avatarR = Math.round(H * 0.038);
    const authorSize = Math.round(H * 0.030);
    const subSize    = Math.round(H * 0.020);
    const textSize   = Math.round(H * 0.026);
    const lineH      = Math.round(textSize * 1.44);

    // Text layout (word rects)
    const textX  = cardX + padH;
    const textMaxW = cardW - padH * 2;
    let textY = Math.round(H * 0.28) + headerH + padV + textSize;

    ctx.font = `400 ${textSize}px "ArchivoNarrow", sans-serif`;
    const spaceW = ctx.measureText(" ").width;
    const words = ST.tt.words.map(w => w.text);
    const rects = [];
    let x = textX, lineCount = 0;
    let y = textY;
    words.forEach((wd, i) => {
      const ww = ctx.measureText(wd).width;
      if (x + ww > textX + textMaxW && x > textX) { x = textX; y += lineH; lineCount++; }
      rects.push({ x, y: y - textSize * 0.82, w: ww, h: textSize, baseline: y, wordIndex: i, text: wd });
      x += ww + spaceW;
    });
    const textBlockH = (lineCount + 1) * lineH;

    // Post image height
    const imgH = ST.state.postImage ? Math.round(cardW * 0.52) : 0;

    // Action bar
    const actBarH = Math.round(H * 0.065);

    const cardTopY   = Math.round(H * 0.28);
    const cardH      = headerH + padV * 2 + textBlockH + padV + imgH + actBarH;

    ST._layout = {
      cardX, cardW, cardTopY, cardH, padH, padV,
      headerH, avatarR, authorSize, subSize,
      textX, textSize, lineH, textY, rects, textBlockH,
      imgH, actBarH,
    };
    ST._sig = sig;
    return ST._layout;
  }

  function selectedRects(L) { return L.rects.filter(r => ST.tt.isSelected(r.wordIndex)); }

  /* ---------------- camera for zoom/pan ---------------- */
  function camera(t, focus, W, H) {
    if (!focus) return { s: 1, tx: 0, ty: 0 };
    let target = Math.min((W * 0.45) / focus.w, (H * 0.38) / focus.h);
    target = Math.max(1.05, Math.min(target, 2.0));
    let tTx = W / 2 - focus.cx * target;
    let tTy = H / 2 - focus.cy * target;
    tTx = Math.min(0, Math.max(W - W * target, tTx));
    tTy = Math.min(0, Math.max(H - H * target, tTy));
    const pIn  = T.tween(t, 3.0, 1.0, 0, 1, "inOut");
    const pOut = T.tween(t, 6.2, 1.0, 0, 1, "inOut");
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
  function circleImage(ctx, img, cx, cy, rad) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.clip();
    const ar = img.naturalWidth / img.naturalHeight;
    let dw = rad * 2, dh = rad * 2;
    if (ar > 1) dw = dh * ar; else dh = dw / ar;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
  }
  function coverInRect(ctx, img, x, y, w, h) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const ar = img.naturalWidth / img.naturalHeight, far = w / h;
    let dw = w, dh = h, ox = 0, oy = 0;
    if (ar > far) { dw = h * ar; ox = (dw - w) / 2; } else { dh = w / ar; oy = (dh - h) / 2; }
    ctx.drawImage(img, x - ox, y - oy, dw, dh);
    ctx.restore();
  }

  /* Facebook "thumbs up" icon rendered as canvas paths */
  function drawThumb(ctx, x, y, size, color) {
    ctx.save();
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = size * 0.12;
    // simplified: filled circle + "👍" text fallback
    ctx.font = `${size}px sans-serif`;
    ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.fillText("👍", x, y);
    ctx.restore();
  }

  /* ---------------- main frame ---------------- */
  ST.drawFrame = function (ctx, t) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const bk = window.BrandKit.get();
    const P = bk.palette;
    const L = ensureLayout(ctx, W, H);

    // Background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0a0d10"); bg.addColorStop(1, "#141820");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Subtle FB-blue vignette ring behind the card
    const vig = ctx.createRadialGradient(W/2, H/2, H*0.1, W/2, H/2, H*0.8);
    vig.addColorStop(0, "rgba(24,119,242,.06)"); vig.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

    const cardEnter = T.tween(t, 0.2, 0.6, 0, 1, "out");
    const cardSlide = (1 - cardEnter) * Math.round(H * 0.04);

    // Find camera
    const focus = ST.tt.sel ? ST.tt.focusRect(selectedRects(L), 30) : null;
    const cam = camera(t, focus, W, H);

    ctx.save();
    ctx.translate(cam.tx, cam.ty + cardSlide * (1 - cam.s));
    ctx.scale(cam.s, cam.s);
    ctx.globalAlpha = cardEnter;

    const { cardX, cardW, cardTopY, cardH, padH, padV, headerH, avatarR,
            authorSize, subSize, textX, textSize, lineH, rects, textBlockH,
            imgH, actBarH } = L;

    // Card background
    roundRect(ctx, cardX, cardTopY, cardW, cardH, Math.round(H * 0.012));
    ctx.fillStyle = "#1c2028"; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.lineWidth = 1; ctx.stroke();

    // ---- HEADER ----
    const avatarCx = cardX + padH + avatarR;
    const avatarCy = cardTopY + padV + avatarR;

    // Avatar
    if (ST.state.avatar) {
      circleImage(ctx, ST.state.avatar, avatarCx, avatarCy, avatarR);
    } else {
      ctx.fillStyle = "#1877f2";
      ctx.beginPath(); ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = `700 ${Math.round(avatarR)}px "ArchivoNarrow", sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText((ST.state.author || "?")[0].toUpperCase(), avatarCx, avatarCy);
    }

    // Author + verified
    const nameX = avatarCx + avatarR + Math.round(H * 0.014);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#e8eaed";
    ctx.font = `700 ${authorSize}px "ArchivoNarrow", sans-serif`;
    ctx.fillText(ST.state.author || "", nameX, avatarCy - Math.round(authorSize * 0.1));
    if (ST.state.verified) {
      const aw = ctx.measureText(ST.state.author || "").width;
      const vx = nameX + aw + Math.round(H * 0.008);
      const vy = avatarCy - Math.round(authorSize * 0.5);
      const vr = Math.round(authorSize * 0.38);
      ctx.fillStyle = "#1877f2";
      ctx.beginPath(); ctx.arc(vx + vr, vy + vr, vr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.round(vr * 0.22);
      ctx.beginPath();
      ctx.moveTo(vx + vr * 0.55, vy + vr);
      ctx.lineTo(vx + vr * 0.85, vy + vr * 1.38);
      ctx.lineTo(vx + vr * 1.45, vy + vr * 0.55);
      ctx.stroke();
    }

    // Handle + date
    ctx.fillStyle = "#9aa3af";
    ctx.font = `400 ${subSize}px "ArchivoNarrow", sans-serif`;
    ctx.fillText((ST.state.handle || "") + "  ·  " + (ST.state.date || ""), nameX, avatarCy + subSize * 1.1);

    // Globe icon (public post)
    ctx.fillStyle = "#9aa3af";
    ctx.font = `${subSize}px sans-serif`;
    ctx.fillText("🌐", nameX + ctx.measureText((ST.state.handle || "") + "  ·  " + (ST.state.date || "")).width + Math.round(H * 0.006), avatarCy + subSize * 1.1);

    // ---- POST TEXT ----
    const textEnter = T.tween(t, 0.6, 0.6, 0, 1, "out");
    ctx.globalAlpha = cardEnter * textEnter;
    ctx.font = `400 ${textSize}px "ArchivoNarrow", sans-serif`;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";

    rects.forEach(r => {
      const sel = ST.tt.isSelected(r.wordIndex);
      ctx.fillStyle = sel ? "#e8b400" : "#e8eaed";
      ctx.globalAlpha = cardEnter * textEnter * (sel ? 1 : 0.92);
      ctx.fillText(r.text, r.x, r.baseline);
    });
    ctx.globalAlpha = cardEnter;

    // ---- POST IMAGE ----
    if (ST.state.postImage && imgH > 0) {
      const imgY = L.textY + textBlockH + padV;
      coverInRect(ctx, ST.state.postImage, cardX, imgY, cardW, imgH);
    }

    // ---- ACTION BAR ----
    const actY = cardTopY + cardH - actBarH;
    ctx.fillStyle = "rgba(255,255,255,.04)";
    ctx.fillRect(cardX, actY, cardW, 1); // divider

    const actionEnter = T.tween(t, 1.0, 0.5, 0, 1, "out");
    ctx.globalAlpha = cardEnter * actionEnter * 0.7;
    const actions = [["👍 Like", 0.18], ["💬 Comment", 0.50], ["↗ Share", 0.82]];
    const actTextSize = Math.round(H * 0.022);
    ctx.font = `600 ${actTextSize}px "ArchivoNarrow", sans-serif`;
    ctx.textBaseline = "middle";
    const actCy = actY + actBarH / 2;
    actions.forEach(([label, frac]) => {
      ctx.fillStyle = "#b0b8c4";
      ctx.textAlign = "center";
      ctx.fillText(label, cardX + cardW * frac, actCy);
    });
    ctx.globalAlpha = cardEnter;

    ctx.restore(); // camera

    // ---- UNDERLINE (screen space after camera) ----
    if (focus && cam.s > 1.01) {
      const underProg = T.tween(t, 4.2, 1.0, 0, 1, "out");
      const sRects = selectedRects(L).map(r => ({
        ...r,
        x:  r.x  * cam.s + cam.tx,
        y:  r.y  * cam.s + cam.ty,
        w:  r.w  * cam.s,
        h:  r.h  * cam.s,
        baseline: r.baseline * cam.s + cam.ty,
      }));
      ST.tt.drawUnderline(ctx, sRects, underProg, {
        color: "#e8b400",
        weight: Math.round(L.textSize * cam.s * 0.12),
        gap: Math.round(L.textSize * cam.s * 0.22),
      });
    }

    // Logo
    if (bk.logo.image) {
      const box = window.BrandKit.logoBox(W, H);
      ctx.drawImage(bk.logo.image, box.x, box.y, box.w, box.h);
    }
  };

  return ST;
})();
