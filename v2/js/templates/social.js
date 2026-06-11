/* social.js — TEMPLATE 2 (Social Post)
 * Pixel-accurate platform skins: Facebook, Instagram, Twitter/X, LinkedIn.
 * Platform selector switches the card chrome, colors, and iconography.
 * After the card appears, camera zooms to the targeted phrase + underline sweep.
 */
window.SocialTemplate = (function () {
  const T = window.Timeline;

  const PLATFORMS = {
    facebook: {
      label: 'Facebook',
      bg0: '#18191a', bg1: '#242526',
      card: '#242526',
      cardBorder: 'rgba(255,255,255,.10)',
      headerBg: 'transparent',
      nameFill: '#e4e6eb',
      subFill: '#b0b3b8',
      textFill: '#e4e6eb',
      avatarFallback: '#1877f2',
      accentBar: '#1877f2',
      verifiedColor: '#1877f2',
      actFill: '#b0b3b8',
      actions: [
        { icon: 'fb-like',    label: 'Like'    },
        { icon: 'fb-comment', label: 'Comment' },
        { icon: 'fb-share',   label: 'Share'   },
      ],
      reactions: ['👍','❤️','😂','😮','😢','😡'],
      reactionCount: '1.2K',
      commentCount: '48',
      shareCount: '17',
      showReactionBar: true,
    },
    instagram: {
      label: 'Instagram',
      bg0: '#000', bg1: '#121212',
      card: '#1c1c1c',
      cardBorder: 'rgba(255,255,255,.12)',
      nameFill: '#fafafa',
      subFill: '#a8a8a8',
      textFill: '#fafafa',
      avatarFallback: '#833ab4',
      accentBar: '#833ab4',
      verifiedColor: '#fff',
      verifiedBg: '#3897f0',
      actFill: '#fafafa',
      actions: [
        { icon: 'ig-heart',   label: '' },
        { icon: 'ig-comment', label: '' },
        { icon: 'ig-share',   label: '' },
        { icon: 'ig-save',    label: '' },
      ],
      reactionCount: '4,821',
      commentCount: '234',
      showReactionBar: true,
      igStyle: true,
    },
    twitter: {
      label: 'X / Twitter',
      bg0: '#000', bg1: '#16181c',
      card: '#16181c',
      cardBorder: 'rgba(255,255,255,.12)',
      nameFill: '#e7e9ea',
      subFill: '#71767b',
      textFill: '#e7e9ea',
      avatarFallback: '#1d9bf0',
      accentBar: '#1d9bf0',
      verifiedColor: '#fff',
      verifiedBg: '#1d9bf0',
      actFill: '#71767b',
      actions: [
        { icon: 'x-reply',   label: '42'   },
        { icon: 'x-repost',  label: '1.2K' },
        { icon: 'x-like',    label: '8.4K' },
        { icon: 'x-views',   label: '92K'  },
      ],
      showReactionBar: false,
      xStyle: true,
    },
    linkedin: {
      label: 'LinkedIn',
      bg0: '#1b1f23', bg1: '#1b1f23',
      card: '#1d2226',
      cardBorder: 'rgba(255,255,255,.10)',
      nameFill: '#f5cba7',
      nameFill: '#e9e5df',
      subFill: '#b0b8b4',
      textFill: '#e9e5df',
      avatarFallback: '#0a66c2',
      accentBar: '#0a66c2',
      verifiedColor: '#fff',
      verifiedBg: '#0a66c2',
      actFill: '#b0b8b4',
      actions: [
        { icon: 'li-like',    label: 'Like'    },
        { icon: 'li-comment', label: 'Comment' },
        { icon: 'li-repost',  label: 'Repost'  },
        { icon: 'li-send',    label: 'Send'    },
      ],
      reactionCount: '847',
      commentCount: '63',
      showReactionBar: true,
    },
  };

  const ST = {
    id: 'social',
    name: 'Social Post',
    later: false,
    duration: 8.0,
    state: {
      platform: 'facebook',
      author:   'Droeba',
      handle:   '@droeba',
      verified: true,
      date:     '2h',
      text:     'We are building a tool that helps journalists create high-quality motion graphics in the browser.',
      postImage: null,
      avatar:    null,
      likeCount: '',
      commentCount: '',
    },
    tt: null,
    _layout: null,
    _sig: '',
  };

  ST.tt = window.TextTargeting.create(ST.state.text);
  ST.tt.sel = { start: 9, end: 11 };
  ST.invalidate = function () { ST._sig = ''; };

  /* ---- editor ---- */
  ST.editor = function (container, onChange) {
    const L = window.Lang;
    const s = ST.state;
    const platOpts = Object.entries(PLATFORMS)
      .map(([k, v]) => `<option value="${k}"${k === s.platform ? ' selected' : ''}>${v.label}</option>`)
      .join('');

    container.innerHTML = `
      <div class="section-title">${L.t('templateSocial')}</div>
      <div class="field">
        <label>${L.t('socialPlatform')}</label>
        <select id="st-platform">${platOpts}</select>
      </div>
      <div class="field">
        <label>${L.t('authorName')}</label>
        <input type="text" id="st-author" value="${s.author}" />
      </div>
      <div class="field">
        <label>${L.t('handleSource')}</label>
        <input type="text" id="st-handle" value="${s.handle}" />
      </div>
      <div class="field" style="display:flex;align-items:center;gap:10px">
        <label style="margin:0;display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="st-verified" ${s.verified ? 'checked' : ''} />
          ${L.t('verifiedTick')}
        </label>
        <div style="flex:1"></div>
        <label style="margin:0;white-space:nowrap">
          ${L.t('dateLabel')}&nbsp;<input type="text" id="st-date" value="${s.date}" style="width:60px" />
        </label>
      </div>
      <div class="field">
        <label>${L.t('postText')}</label>
        <textarea id="st-text"></textarea>
      </div>
      <div class="field">
        <label>${L.t('targetPhraseShort')}</label>
        <div class="word-pick" id="st-words"></div>
        <div class="hint"><a id="st-clear" style="color:var(--accent);cursor:pointer">${L.t('clearSelection')}</a></div>
      </div>
      <div class="field">
        <label>${L.t('avatarPhoto')}</label>
        <div class="logo-drop" id="st-avatar-drop">${L.t('avatarDropText')}</div>
        <input type="file" id="st-avatar-file" accept="image/*" hidden />
      </div>
      <div class="field">
        <label>${L.t('postImageOpt')}</label>
        <div class="logo-drop" id="st-img-drop">${L.t('postImgDropText')}</div>
        <input type="file" id="st-img-file" accept="image/*" hidden />
      </div>`;

    const $ = sel => container.querySelector(sel);
    $('#st-text').value = s.text;

    const repaint = () => ST.tt.buildPicker($('#st-words'), () => { ST.invalidate(); onChange && onChange(); });
    repaint();

    $('#st-platform').addEventListener('change', e => { s.platform = e.target.value; ST.invalidate(); onChange && onChange(); });
    $('#st-author').addEventListener('input', e => { s.author = e.target.value; ST.invalidate(); onChange && onChange(); });
    $('#st-handle').addEventListener('input', e => { s.handle = e.target.value; onChange && onChange(); });
    $('#st-verified').addEventListener('change', e => { s.verified = e.target.checked; onChange && onChange(); });
    $('#st-date').addEventListener('input', e => { s.date = e.target.value; onChange && onChange(); });
    $('#st-text').addEventListener('input', e => {
      s.text = e.target.value; ST.tt.setText(e.target.value);
      repaint(); ST.invalidate(); onChange && onChange();
    });
    $('#st-clear').addEventListener('click', () => { ST.tt.clearSelection(); repaint(); ST.invalidate(); onChange && onChange(); });
    wireFile($('#st-avatar-drop'), $('#st-avatar-file'), img => { s.avatar = img; onChange && onChange(); });
    wireFile($('#st-img-drop'), $('#st-img-file'), img => { s.postImage = img; ST.invalidate(); onChange && onChange(); });
  };

  function wireFile(dropEl, inputEl, onLoad) {
    dropEl.addEventListener('click', () => inputEl.click());
    inputEl.addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      loadImg(f, img => { onLoad(img); dropEl.textContent = f.name; });
    });
    ['dragover','dragleave','drop'].forEach(ev => dropEl.addEventListener(ev, e => {
      e.preventDefault();
      if (ev === 'dragover') dropEl.classList.add('drag-over');
      else dropEl.classList.remove('drag-over');
      if (ev === 'drop') {
        const f = e.dataTransfer.files[0];
        if (f && f.type.startsWith('image/')) loadImg(f, img => { onLoad(img); dropEl.textContent = f.name; });
      }
    }));
  }
  function loadImg(f, cb) {
    const img = new Image(); img.onload = () => cb(img); img.src = URL.createObjectURL(f);
  }

  /* ---- layout cache ---- */
  function ensureLayout(ctx, W, H) {
    const sig = [W, H, ST.state.text, ST.state.postImage ? 'img' : '', ST.state.platform].join('|');
    if (ST._sig === sig && ST._layout) return ST._layout;

    const P = PLATFORMS[ST.state.platform] || PLATFORMS.facebook;
    const igStyle = !!P.igStyle;
    const xStyle  = !!P.xStyle;

    const cardW   = Math.round(W * (xStyle ? 0.48 : 0.50));
    const cardX   = Math.round((W - cardW) / 2);
    const padH    = Math.round(H * 0.046);
    const padV    = Math.round(H * 0.030);
    const headerH = Math.round(H * 0.090);
    const avatarR = Math.round(H * (igStyle ? 0.035 : 0.038));
    const authorSize = Math.round(H * 0.028);
    const subSize    = Math.round(H * 0.019);
    const textSize   = Math.round(H * 0.025);
    const lineH      = Math.round(textSize * 1.44);

    const textX    = cardX + padH;
    const textMaxW = cardW - padH * 2;
    let textY = Math.round(H * 0.28) + headerH + padV + textSize;

    ctx.font = `400 ${textSize}px "ArchivoNarrow", sans-serif`;
    const spaceW = ctx.measureText(' ').width;
    const words  = ST.tt.words.map(w => w.text);
    const rects  = [];
    let x = textX, y = textY, lineCount = 0;
    words.forEach((wd, i) => {
      const ww = ctx.measureText(wd).width;
      if (x + ww > textX + textMaxW && x > textX) { x = textX; y += lineH; lineCount++; }
      rects.push({ x, y: y - textSize * 0.82, w: ww, h: textSize, baseline: y, wordIndex: i, text: wd });
      x += ww + spaceW;
    });
    const textBlockH = (lineCount + 1) * lineH;
    const imgH = ST.state.postImage ? Math.round(cardW * 0.52) : 0;
    const actBarH = Math.round(H * 0.065);
    const cardTopY = Math.round(H * 0.28);
    const cardH    = headerH + padV * 2 + textBlockH + padV + imgH + actBarH;

    ST._layout = { cardX, cardW, cardTopY, cardH, padH, padV, headerH, avatarR,
                   authorSize, subSize, textX, textSize, lineH, textY, rects,
                   textBlockH, imgH, actBarH };
    ST._sig = sig;
    return ST._layout;
  }

  function selectedRects(L) { return L.rects.filter(r => ST.tt.isSelected(r.wordIndex)); }

  /* ---- camera ---- */
  function camera(t, focus, W, H) {
    if (!focus) return { s: 1, tx: 0, ty: 0 };
    let target = Math.min((W * 0.45) / focus.w, (H * 0.38) / focus.h);
    target = Math.max(1.05, Math.min(target, 2.0));
    let tTx = W / 2 - focus.cx * target;
    let tTy = H / 2 - focus.cy * target;
    tTx = Math.min(0, Math.max(W - W * target, tTx));
    tTy = Math.min(0, Math.max(H - H * target, tTy));
    const pIn  = T.tween(t, 3.0, 1.0, 0, 1, 'inOut');
    const pOut = T.tween(t, 6.2, 1.0, 0, 1, 'inOut');
    return { s: 1 + (target - 1) * pIn * (1 - pOut), tx: tTx * pIn * (1 - pOut), ty: tTy * pIn * (1 - pOut) };
  }

  /* ---- canvas helpers ---- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
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

  /* ---- platform-specific icon drawing ---- */
  function drawPlatformIcon(ctx, type, cx, cy, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (type) {
      // ---- Facebook ----
      case 'fb-like': {
        // Thumb-up silhouette path
        ctx.beginPath();
        const s = size * 0.45;
        ctx.translate(cx - s * 0.5, cy - s * 0.5);
        ctx.scale(s, s);
        // Simple stylised thumb up
        ctx.moveTo(0.4, 1); ctx.lineTo(0.4, 0.5); ctx.lineTo(0.1, 0.5); ctx.lineTo(0, 0.3);
        ctx.lineTo(0.35, 0); ctx.lineTo(0.55, 0.1); ctx.lineTo(1, 0.1);
        ctx.lineTo(1, 0.5); ctx.lineTo(0.8, 0.5); ctx.lineTo(0.8, 1); ctx.closePath();
        ctx.fill(); break;
      }
      case 'fb-comment': {
        const s2 = size * 0.44;
        ctx.translate(cx - s2 * 0.5, cy - s2 * 0.52);
        ctx.scale(s2, s2);
        roundRect(ctx, 0, 0, 1, 0.76, 0.18); ctx.fill();
        ctx.fillRect(0.2, 0.78, 0.2, 0.22); break;
      }
      case 'fb-share': {
        ctx.setTransform(1,0,0,1,0,0); ctx.scale(1, 1);
        ctx.font = `${size}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('↗', cx, cy + size * 0.05); break;
      }

      // ---- Instagram ----
      case 'ig-heart': {
        ctx.translate(cx, cy);
        const r = size * 0.42;
        ctx.scale(r, r);
        ctx.beginPath();
        ctx.moveTo(0, 0.35);
        ctx.bezierCurveTo(0, -0.2, -1, -0.2, -1, 0.35);
        ctx.bezierCurveTo(-1, 0.8, 0, 1.1, 0, 1.1);
        ctx.bezierCurveTo(0, 1.1, 1, 0.8, 1, 0.35);
        ctx.bezierCurveTo(1, -0.2, 0, -0.2, 0, 0.35);
        ctx.fill(); break;
      }
      case 'ig-comment': {
        const s3 = size * 0.44;
        ctx.translate(cx - s3 * 0.5, cy - s3 * 0.55);
        ctx.scale(s3, s3);
        ctx.beginPath();
        ctx.arc(0.5, 0.45, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(0.25, 0.3, 0.5, 0.08);
        ctx.fillRect(0.25, 0.46, 0.35, 0.08); break;
      }
      case 'ig-share': {
        ctx.translate(cx, cy);
        ctx.rotate(-Math.PI * 0.25);
        ctx.lineWidth = size * 0.14;
        ctx.beginPath();
        ctx.moveTo(-size * 0.35, 0); ctx.lineTo(size * 0.35, 0);
        ctx.moveTo(size * 0.05, -size * 0.28); ctx.lineTo(size * 0.35, 0); ctx.lineTo(size * 0.05, size * 0.28);
        ctx.stroke(); break;
      }
      case 'ig-save': {
        ctx.translate(cx - size * 0.24, cy - size * 0.38);
        ctx.scale(size * 0.48, size * 0.48);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(1, 0); ctx.lineTo(1, 1.6);
        ctx.lineTo(0.5, 1.2); ctx.lineTo(0, 1.6); ctx.closePath();
        ctx.lineWidth = 0.12; ctx.stroke(); break;
      }

      // ---- X/Twitter ----
      case 'x-reply': {
        ctx.lineWidth = size * 0.13;
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.38, Math.PI * 0.3, Math.PI * 1.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.38 + size * 0.04, cy + size * 0.1);
        ctx.lineTo(cx - size * 0.38 - size * 0.14, cy + size * 0.3);
        ctx.lineTo(cx - size * 0.38 + size * 0.14, cy + size * 0.36);
        ctx.fill(); break;
      }
      case 'x-repost': {
        ctx.lineWidth = size * 0.12;
        const r2 = size * 0.34;
        ctx.beginPath();
        ctx.roundRect
          ? (ctx.roundRect(cx - r2, cy - r2 * 0.7, r2 * 2, r2 * 1.4, r2 * 0.3), ctx.stroke())
          : (roundRect(ctx, cx - r2, cy - r2 * 0.7, r2 * 2, r2 * 1.4, r2 * 0.3), ctx.stroke());
        // arrows
        ctx.beginPath();
        ctx.moveTo(cx - r2 * 0.5, cy - r2 * 0.7);
        ctx.lineTo(cx - r2 * 0.5 - size * 0.15, cy - r2 * 0.7 + size * 0.15);
        ctx.moveTo(cx - r2 * 0.5, cy - r2 * 0.7);
        ctx.lineTo(cx - r2 * 0.5 + size * 0.15, cy - r2 * 0.7 + size * 0.15);
        ctx.stroke(); break;
      }
      case 'x-like': {
        ctx.translate(cx, cy);
        const hr = size * 0.4;
        ctx.scale(hr, hr);
        ctx.beginPath();
        ctx.moveTo(0, 0.3);
        ctx.bezierCurveTo(0, -0.2, -1.05, -0.2, -1.05, 0.3);
        ctx.bezierCurveTo(-1.05, 0.85, 0, 1.15, 0, 1.15);
        ctx.bezierCurveTo(0, 1.15, 1.05, 0.85, 1.05, 0.3);
        ctx.bezierCurveTo(1.05, -0.2, 0, -0.2, 0, 0.3);
        ctx.lineWidth = 0.14; ctx.stroke(); break;
      }
      case 'x-views': {
        ctx.font = `${size * 0.9}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('👁', cx, cy + size * 0.05); break;
      }

      // ---- LinkedIn ----
      case 'li-like': {
        ctx.font = `${size}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('👍', cx, cy + size * 0.05); break;
      }
      case 'li-comment': {
        const s4 = size * 0.46;
        ctx.translate(cx - s4 * 0.5, cy - s4 * 0.5);
        ctx.scale(s4, s4);
        roundRect(ctx, 0, 0, 1, 0.78, 0.2); ctx.lineWidth = 0.14; ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillRect(0.2, 0.82, 0.18, 0.18); break;
      }
      case 'li-repost': {
        ctx.lineWidth = size * 0.12;
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.38, cy + size * 0.1);
        ctx.lineTo(cx, cy - size * 0.38); ctx.lineTo(cx + size * 0.38, cy + size * 0.1);
        ctx.stroke(); break;
      }
      case 'li-send': {
        ctx.lineWidth = size * 0.12;
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.38, cy + size * 0.3);
        ctx.lineTo(cx + size * 0.38, cy - size * 0.1);
        ctx.moveTo(cx + size * 0.38, cy - size * 0.1);
        ctx.lineTo(cx - size * 0.1, cy - size * 0.38);
        ctx.stroke(); break;
      }
    }
    ctx.restore();
  }

  /* ---- verified badge ---- */
  function drawVerified(ctx, x, y, size, P) {
    const platform = ST.state.platform;
    ctx.save();
    if (platform === 'twitter' || platform === 'linkedin' || platform === 'instagram') {
      // Filled circle with checkmark
      const r = size * 0.44;
      ctx.fillStyle = P.verifiedBg || P.accentBar;
      ctx.beginPath(); ctx.arc(x + r, y + r, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.24; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + r * 0.52, y + r * 0.98);
      ctx.lineTo(x + r * 0.88, y + r * 1.42);
      ctx.lineTo(x + r * 1.48, y + r * 0.56);
      ctx.stroke();
    } else {
      // Facebook style
      ctx.fillStyle = P.verifiedColor || P.accentBar;
      const vr = size * 0.40;
      ctx.beginPath(); ctx.arc(x + vr, y + vr, vr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = vr * 0.22;
      ctx.beginPath();
      ctx.moveTo(x + vr * 0.52, y + vr * 0.98);
      ctx.lineTo(x + vr * 0.88, y + vr * 1.42);
      ctx.lineTo(x + vr * 1.48, y + vr * 0.56);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---- reaction row (Facebook/LinkedIn/Instagram) ---- */
  function drawReactionRow(ctx, P, L, actY, cardX, cardW, actBarH, cardEnter) {
    const plat = ST.state.platform;
    const actTextSize = Math.round(L.textSize * 0.85);
    const iconSize = Math.round(L.textSize * 0.95);

    ctx.save();
    ctx.globalAlpha = cardEnter * T.tween(0, 0, 1, 0, 1, 'out'); // show immediately with card
    ctx.globalAlpha = cardEnter * 0.85;

    if (plat === 'facebook') {
      // Reaction emoji row + counts
      const reactions = P.reactions || [];
      let rx = cardX + L.padH;
      const emojiSize = Math.round(L.textSize * 0.88);
      ctx.font = `${emojiSize}px sans-serif`;
      ctx.textBaseline = 'middle';
      const acyCen = actY + actBarH * 0.35;
      reactions.slice(0, 5).forEach(em => {
        ctx.fillText(em, rx, acyCen); rx += emojiSize * 1.1;
      });
      // count
      ctx.font = `400 ${actTextSize}px "ArchivoNarrow", sans-serif`;
      ctx.fillStyle = P.subFill;
      ctx.textAlign = 'left';
      ctx.fillText(' ' + (P.reactionCount || ''), rx, acyCen);

      // Divider line
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cardX, actY + actBarH * 0.55); ctx.lineTo(cardX + cardW, actY + actBarH * 0.55); ctx.stroke();

      // Action buttons row
      const acyCen2 = actY + actBarH * 0.80;
      const actions = P.actions;
      ctx.font = `600 ${actTextSize}px "ArchivoNarrow", sans-serif`;
      actions.forEach((ac, i) => {
        const frac = (i + 0.5) / actions.length;
        const ax = cardX + cardW * frac;
        drawPlatformIcon(ctx, ac.icon, ax - actTextSize * 1.1, acyCen2, iconSize, P.actFill);
        ctx.fillStyle = P.actFill; ctx.textAlign = 'left';
        ctx.fillText(ac.label, ax - actTextSize * 0.55, acyCen2 + actTextSize * 0.04);
      });

    } else if (plat === 'instagram') {
      // IG: heart, comment, share left-aligned; save right-aligned; count below
      const acy = actY + actBarH * 0.35;
      const icons = [P.actions[0], P.actions[1], P.actions[2]];
      let ix = cardX + L.padH;
      icons.forEach(ac => {
        drawPlatformIcon(ctx, ac.icon, ix + iconSize * 0.5, acy, iconSize, P.actFill);
        ix += iconSize * 1.7;
      });
      // Save icon right
      if (P.actions[3]) {
        drawPlatformIcon(ctx, P.actions[3].icon, cardX + cardW - L.padH - iconSize * 0.5, acy, iconSize, P.actFill);
      }
      // Like count below
      ctx.font = `600 ${actTextSize}px "ArchivoNarrow", sans-serif`;
      ctx.fillStyle = P.nameFill; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText((P.reactionCount || '') + ' likes', cardX + L.padH, actY + actBarH * 0.75);

    } else if (plat === 'twitter') {
      // X: icon + count for each action
      const acy = actY + actBarH * 0.50;
      const gap = cardW / P.actions.length;
      ctx.font = `400 ${actTextSize * 0.9}px "ArchivoNarrow", sans-serif`;
      P.actions.forEach((ac, i) => {
        const ax = cardX + gap * i + gap * 0.2;
        drawPlatformIcon(ctx, ac.icon, ax + iconSize * 0.5, acy, iconSize, P.actFill);
        ctx.fillStyle = P.actFill; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(' ' + ac.label, ax + iconSize * 1.1, acy + iconSize * 0.04);
      });

    } else if (plat === 'linkedin') {
      // LI: reaction count line + action buttons
      const acyCen = actY + actBarH * 0.32;
      ctx.font = `400 ${actTextSize * 0.88}px "ArchivoNarrow", sans-serif`;
      ctx.fillStyle = P.subFill; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('👍 ' + (P.reactionCount || '') + '  · ' + (P.commentCount || '') + ' comments', cardX + L.padH, acyCen);

      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cardX, actY + actBarH * 0.52); ctx.lineTo(cardX + cardW, actY + actBarH * 0.52); ctx.stroke();

      const acy2 = actY + actBarH * 0.78;
      ctx.font = `600 ${actTextSize}px "ArchivoNarrow", sans-serif`;
      P.actions.forEach((ac, i) => {
        const frac = (i + 0.5) / P.actions.length;
        const ax = cardX + cardW * frac;
        drawPlatformIcon(ctx, ac.icon, ax - actTextSize * 1.0, acy2, iconSize, P.actFill);
        ctx.fillStyle = P.actFill; ctx.textAlign = 'left';
        ctx.fillText(ac.label, ax - actTextSize * 0.5, acy2 + iconSize * 0.04);
      });
    }
    ctx.restore();
  }

  /* ---- main frame ---- */
  ST.drawFrame = function (ctx, t) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const bk = window.BrandKit.get();
    const P = PLATFORMS[ST.state.platform] || PLATFORMS.facebook;
    const L = ensureLayout(ctx, W, H);

    // Background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, P.bg0); bg.addColorStop(1, P.bg1);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Platform color vignette (fixed: proper hex -> rgba conversion)
    const vig = ctx.createRadialGradient(W/2, H/2, H*0.1, W/2, H/2, H*0.8);
    const _ai = parseInt((P.accentBar || '#1877f2').slice(1), 16);
    vig.addColorStop(0, 'rgba(' + ((_ai>>16)&255) + ',' + ((_ai>>8)&255) + ',' + (_ai&255) + ',0.07)');
    vig.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, 0, W, H);

    const cardEnter = T.tween(t, 0.2, 0.6, 0, 1, 'out');
    const cardSlide = (1 - cardEnter) * Math.round(H * 0.04);

    const focus = ST.tt.sel ? ST.tt.focusRect(selectedRects(L), 30) : null;
    const cam = camera(t, focus, W, H);

    ctx.save();
    ctx.translate(cam.tx, cam.ty + cardSlide * (1 - (cam.s - 1) * 2));
    ctx.scale(cam.s, cam.s);
    ctx.globalAlpha = cardEnter;

    const { cardX, cardW, cardTopY, cardH, padH, padV, headerH, avatarR,
            authorSize, subSize, textX, textSize, lineH, rects, textBlockH,
            imgH, actBarH } = L;

    // Card shadow
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = Math.round(H * 0.04);
    roundRect(ctx, cardX, cardTopY, cardW, cardH, Math.round(H * 0.012));
    ctx.fillStyle = P.card; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.strokeStyle = P.cardBorder; ctx.lineWidth = 1; ctx.stroke();

    // Instagram: gradient ring on avatar
    const avatarCx = cardX + padH + avatarR;
    const avatarCy = cardTopY + padV + avatarR;

    if (ST.state.platform === 'instagram') {
      const ring = ctx.createLinearGradient(avatarCx - avatarR, avatarCy - avatarR, avatarCx + avatarR, avatarCy + avatarR);
      ring.addColorStop(0, '#f09433'); ring.addColorStop(0.25, '#e6683c');
      ring.addColorStop(0.5, '#dc2743'); ring.addColorStop(0.75, '#cc2366');
      ring.addColorStop(1, '#bc1888');
      ctx.strokeStyle = ring; ctx.lineWidth = Math.round(avatarR * 0.14);
      ctx.beginPath(); ctx.arc(avatarCx, avatarCy, avatarR + Math.round(avatarR * 0.18), 0, Math.PI * 2); ctx.stroke();
    }

    // Avatar
    if (ST.state.avatar) {
      circleImage(ctx, ST.state.avatar, avatarCx, avatarCy, avatarR);
    } else {
      ctx.fillStyle = P.avatarFallback;
      ctx.beginPath(); ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${Math.round(avatarR)}px "ArchivoNarrow", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((ST.state.author || '?')[0].toUpperCase(), avatarCx, avatarCy + avatarR * 0.04);
    }

    // Author name
    const nameX = avatarCx + avatarR + Math.round(H * 0.014);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = P.nameFill;
    ctx.font = `700 ${authorSize}px "ArchivoNarrow", sans-serif`;
    ctx.fillText(ST.state.author || '', nameX, avatarCy - Math.round(authorSize * 0.1));

    // Verified badge
    if (ST.state.verified) {
      const aw = ctx.measureText(ST.state.author || '').width;
      const vx = nameX + aw + Math.round(H * 0.008);
      const vy = avatarCy - Math.round(authorSize * 0.55);
      drawVerified(ctx, vx, vy, authorSize, P);
    }

    // Handle + date
    ctx.fillStyle = P.subFill;
    ctx.font = `400 ${subSize}px "ArchivoNarrow", sans-serif`;
    const handleText = (ST.state.handle || '') + '  ·  ' + (ST.state.date || '');
    ctx.fillText(handleText, nameX, avatarCy + subSize * 1.1);

    // Platform-specific chrome (X: "For you" pill, LinkedIn: connection degree, etc.)
    if (ST.state.platform === 'twitter') {
      // "Follow" button top-right of card
      const followW = Math.round(H * 0.065);
      const followH = Math.round(H * 0.026);
      const followX = cardX + cardW - padH - followW;
      const followY = cardTopY + padV;
      roundRect(ctx, followX, followY, followW, followH, followH / 2);
      ctx.fillStyle = P.nameFill; ctx.fill();
      ctx.font = `700 ${Math.round(followH * 0.65)}px "ArchivoNarrow", sans-serif`;
      ctx.fillStyle = P.card; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Follow', followX + followW / 2, followY + followH / 2);
      // "···" menu
      ctx.fillStyle = P.subFill; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    } else if (ST.state.platform === 'linkedin') {
      // "• 1st" connection degree
      ctx.font = `400 ${subSize * 0.85}px "ArchivoNarrow", sans-serif`;
      ctx.fillStyle = P.subFill;
      const hw = ctx.measureText(handleText).width;
      ctx.fillText('  · 1st', nameX + hw, avatarCy + subSize * 1.1);
    }

    // --- POST TEXT ---
    const textEnter = T.tween(t, 0.6, 0.6, 0, 1, 'out');
    ctx.font = `400 ${textSize}px "ArchivoNarrow", sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    rects.forEach(r => {
      const sel = ST.tt.isSelected(r.wordIndex);
      ctx.fillStyle = sel ? '#e8b400' : P.textFill;
      ctx.globalAlpha = cardEnter * textEnter * (sel ? 1 : 0.92);
      ctx.fillText(r.text, r.x, r.baseline);
    });
    ctx.globalAlpha = cardEnter;

    // --- POST IMAGE ---
    if (ST.state.postImage && imgH > 0) {
      const imgY = L.textY + textBlockH + padV;
      coverInRect(ctx, ST.state.postImage, cardX, imgY, cardW, imgH);
    }

    // --- REACTION / ACTION BAR ---
    const actY = cardTopY + cardH - actBarH;
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.fillRect(cardX, actY, cardW, 1);

    drawReactionRow(ctx, P, L, actY, cardX, cardW, actBarH, cardEnter);

    ctx.restore(); // camera

    // --- UNDERLINE (screen space) ---
    if (focus && cam.s > 1.01) {
      const underProg = T.tween(t, 4.2, 1.0, 0, 1, 'out');
      const sRects = selectedRects(L).map(r => ({
        ...r,
        x: r.x * cam.s + cam.tx, y: r.y * cam.s + cam.ty,
        w: r.w * cam.s, h: r.h * cam.s,
        baseline: r.baseline * cam.s + cam.ty,
      }));
      ST.tt.drawUnderline(ctx, sRects, underProg, {
        color: '#e8b400',
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
