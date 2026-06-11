/* slideshow.js — TEMPLATE 3
 * Per-slide duration, animation (Ken Burns zoom-in/out, pan variants, static, random),
 * and transition (dissolve, slide-L/R, zoom-through, dip-black/white, cut).
 * Total duration auto-calculated from sum of slide durations + transition overlaps.
 */
window.SlideshowTemplate = (function () {
  const T = window.Timeline;

  const ANIM_OPTIONS = ['random','kb-in','kb-out','pan-lr','pan-rl','pan-tb','static'];
  const TRANS_OPTIONS = ['dissolve','slide-l','slide-r','zoom','dip-black','dip-white','cut'];
  const DEFAULT_SLIDE_DUR = 3.0;
  const DEFAULT_TRANS_DUR = 0.6;

  // Animation params per type: {ox0,oy0,ox1,oy1,s0,s1}
  function getAnimParams(type, idx) {
    if (type === 'random') {
      const opts = ANIM_OPTIONS.filter(a => a !== 'random');
      type = opts[idx % opts.length];
    }
    switch (type) {
      case 'kb-in':  return { ox0:0,    oy0:0,    ox1:0.03, oy1:0.03, s0:1.0,  s1:1.12 };
      case 'kb-out': return { ox0:0.03, oy0:0.03, ox1:0,    oy1:0,    s0:1.12, s1:1.0  };
      case 'pan-lr': return { ox0:-0.04,oy0:0,    ox1:0.04, oy1:0,    s0:1.05, s1:1.05 };
      case 'pan-rl': return { ox0:0.04, oy0:0,    ox1:-0.04,oy1:0,    s0:1.05, s1:1.05 };
      case 'pan-tb': return { ox0:0,    oy0:-0.04,ox1:0,    oy1:0.04, s0:1.05, s1:1.05 };
      case 'static': return { ox0:0,    oy0:0,    ox1:0,    oy1:0,    s0:1.0,  s1:1.0  };
      default:       return { ox0:0,    oy0:0,    ox1:0.03, oy1:0.03, s0:1.0,  s1:1.08 };
    }
  }

  const SS = {
    id: 'slideshow',
    name: 'Slideshow',
    later: false,
    duration: 6.0,
    state: {
      photos: [],     // [{img, caption, duration, animation, transition}]
      captions: false,
      globalTransition: 'dissolve',
      transDuration: DEFAULT_TRANS_DUR,
    },
  };

  SS.invalidate = function () {};

  /* ---- helpers ---- */
  function calcTotalDuration(photos, transDur) {
    if (!photos.length) return 6.0;
    const sum = photos.reduce((s, p) => s + (p.duration || DEFAULT_SLIDE_DUR), 0);
    const transitions = Math.max(0, photos.length - 1);
    return sum + transitions * transDur;
  }
  function updateDuration() {
    SS.duration = calcTotalDuration(SS.state.photos, SS.state.transDuration);
    if (window.Pipeline) {
      window.Pipeline.setDuration(SS.duration);
      // Update the dur-input display
      const di = document.getElementById('dur-input');
      if (di) {
        const m = Math.floor(SS.duration / 60), s = SS.duration % 60;
        di.value = m > 0 ? m + ':' + String(Math.round(s)).padStart(2,'0') : String(SS.duration.toFixed(1));
      }
    }
  }
  // Cumulative slide start times
  function slideStarts(photos, transDur) {
    const starts = [];
    let t = 0;
    photos.forEach((p, i) => {
      starts.push(t);
      t += (p.duration || DEFAULT_SLIDE_DUR);
      if (i < photos.length - 1) t += transDur;
    });
    return starts;
  }

  /* ---- editor ---- */
  SS.editor = function (container, onChange) {
    const L = window.Lang;
    const s = SS.state;

    const transOpts = TRANS_OPTIONS.map(k =>
      `<option value="${k}">${L.t('trans' + k.replace(/-([a-z])/g, (_,c) => c.toUpperCase()).replace(/^./,c=>c.toUpperCase()))}</option>`
    ).join('');

    container.innerHTML = `
      <div class="section-title">${L.t('templateSlideshow')}</div>
      <div class="hint" style="margin-bottom:14px">${L.t('ssHint')}</div>
      <div class="field" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
        <label style="margin:0;display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="ss-captions" ${s.captions ? 'checked' : ''} />
          ${L.t('ssShowCaptions')}
        </label>
      </div>
      <div class="field">
        <label>${L.t('ssGlobalTransition')}</label>
        <select id="ss-global-trans">${transOpts}</select>
      </div>
      <div class="field">
        <label>${L.t('ssTransDuration')}</label>
        <input type="number" id="ss-trans-dur" min="0.1" max="2" step="0.1" value="${s.transDuration}" style="width:80px" />
      </div>
      <div id="ss-slides"></div>
      <div class="logo-drop" id="ss-add-drop" style="margin-top:4px">${L.t('ssAddDrop')}</div>
      <input type="file" id="ss-add-file" accept="image/*" multiple hidden />
      <div class="ss-total" id="ss-total">${L.t('ssTotal')} <strong>${SS.duration.toFixed(1)}s</strong></div>
    `;

    const $ = sel => container.querySelector(sel);

    // Set select to current value
    $('#ss-global-trans').value = s.globalTransition;

    function getTransLabel(key) {
      const map = {
        'dissolve':'transDissolve','slide-l':'transSlideL','slide-r':'transSlideR',
        'zoom':'transZoom','dip-black':'transDipBlack','dip-white':'transDipWhite','cut':'transCut'
      };
      return L.t(map[key] || key);
    }
    function getAnimLabel(key) {
      const map = {
        'random':'animRandom','kb-in':'animKbIn','kb-out':'animKbOut',
        'pan-lr':'animPanLR','pan-rl':'animPanRL','pan-tb':'animPanTB','static':'animStatic'
      };
      return L.t(map[key] || key);
    }

    function rebuildSlideList() {
      const slidesEl = $('#ss-slides');
      slidesEl.innerHTML = '';
      s.photos.forEach((slot, i) => {
        const row = document.createElement('div');
        row.className = 'ss-slide-row';

        const animOpts = ANIM_OPTIONS.map(k =>
          `<option value="${k}"${k === slot.animation ? ' selected' : ''}>${getAnimLabel(k)}</option>`
        ).join('');
        const transOpts2 = TRANS_OPTIONS.map(k =>
          `<option value="${k}"${k === slot.transition ? ' selected' : ''}>${getTransLabel(k)}</option>`
        ).join('');

        row.innerHTML = `
          <div class="ss-thumb-wrap">
            <img class="ss-thumb" />
            <button class="ss-remove" title="Remove">✕</button>
          </div>
          <div class="ss-slide-controls">
            <label class="ss-ctrl-label">${L.t('ssDuration')}
              <input type="number" class="ss-dur" min="0.5" max="60" step="0.5" value="${slot.duration || DEFAULT_SLIDE_DUR}" />
            </label>
            <label class="ss-ctrl-label">${L.t('ssAnimation')}
              <select class="ss-anim">${animOpts}</select>
            </label>
            ${i < s.photos.length - 1 ? `
            <label class="ss-ctrl-label">${L.t('ssTransition')}
              <select class="ss-trans">${transOpts2}</select>
            </label>` : ''}
            ${s.captions ? `<input type="text" class="ss-cap" placeholder="${L.t('ssCaption')} ${i+1}" value="${slot.caption||''}" />` : ''}
          </div>`;

        row.querySelector('.ss-thumb').src = slot.img.src;
        row.querySelector('.ss-remove').addEventListener('click', () => {
          s.photos.splice(i, 1); updateDuration(); rebuildSlideList(); updateTotal(); onChange && onChange();
        });
        row.querySelector('.ss-dur').addEventListener('input', e => {
          slot.duration = Math.max(0.5, parseFloat(e.target.value) || DEFAULT_SLIDE_DUR);
          updateDuration(); updateTotal(); onChange && onChange();
        });
        row.querySelector('.ss-anim').addEventListener('change', e => {
          slot.animation = e.target.value; onChange && onChange();
        });
        const transEl = row.querySelector('.ss-trans');
        if (transEl) transEl.addEventListener('change', e => {
          slot.transition = e.target.value; onChange && onChange();
        });
        const capEl = row.querySelector('.ss-cap');
        if (capEl) capEl.addEventListener('input', e => { slot.caption = e.target.value; onChange && onChange(); });

        slidesEl.appendChild(row);
      });
    }

    function updateTotal() {
      const el = $('#ss-total');
      if (el) el.innerHTML = L.t('ssTotal') + ' <strong>' + SS.duration.toFixed(1) + 's</strong>';
    }

    $('#ss-captions').addEventListener('change', e => {
      s.captions = e.target.checked; rebuildSlideList(); onChange && onChange();
    });
    $('#ss-global-trans').addEventListener('change', e => {
      s.globalTransition = e.target.value;
      // Apply to all slides
      s.photos.forEach(p => { p.transition = e.target.value; });
      rebuildSlideList(); onChange && onChange();
    });
    $('#ss-trans-dur').addEventListener('input', e => {
      s.transDuration = Math.max(0.1, parseFloat(e.target.value) || DEFAULT_TRANS_DUR);
      updateDuration(); updateTotal(); onChange && onChange();
    });

    function addFiles(files) {
      const remaining = 5 - s.photos.length;
      [...files].slice(0, remaining).forEach(f => {
        if (!f.type.startsWith('image/')) return;
        const img = new Image();
        img.onload = () => {
          s.photos.push({
            img, caption: '',
            duration: DEFAULT_SLIDE_DUR,
            animation: 'random',
            transition: s.globalTransition,
          });
          updateDuration(); rebuildSlideList(); updateTotal(); onChange && onChange();
        };
        img.src = URL.createObjectURL(f);
      });
    }

    const addDrop = $('#ss-add-drop');
    addDrop.addEventListener('click', () => { if (s.photos.length < 5) $('#ss-add-file').click(); });
    $('#ss-add-file').addEventListener('change', e => addFiles(e.target.files));
    addDrop.addEventListener('dragover', e => { e.preventDefault(); addDrop.classList.add('drag-over'); });
    addDrop.addEventListener('dragleave', () => addDrop.classList.remove('drag-over'));
    addDrop.addEventListener('drop', e => {
      e.preventDefault(); addDrop.classList.remove('drag-over'); addFiles(e.dataTransfer.files);
    });

    rebuildSlideList();
  };

  /* ---- Ken Burns / animation transform ---- */
  function kbTransform(img, prog, anim, W, H) {
    const kb = getAnimParams(anim, 0);
    const ar = img.naturalWidth / img.naturalHeight, far = W / H;
    const baseS = ar > far ? H / img.naturalHeight : W / img.naturalWidth;
    const s = (kb.s0 + (kb.s1 - kb.s0) * prog) * baseS;
    const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
    const cx = (W / 2) + (kb.ox0 + (kb.ox1 - kb.ox0) * prog) * W - iw / 2;
    const cy = (H / 2) + (kb.oy0 + (kb.oy1 - kb.oy0) * prog) * H - ih / 2;
    return { dx: cx, dy: cy, dw: iw, dh: ih };
  }

  /* ---- draw a single slide image with animation ---- */
  function drawSlide(ctx, photo, prog, W, H, alpha) {
    if (!photo.img) return;
    const anim = photo.animation === 'random'
      ? ANIM_OPTIONS.filter(a => a !== 'random')[SS.state.photos.indexOf(photo) % 6]
      : (photo.animation || 'kb-in');
    const { dx, dy, dw, dh } = kbTransform(photo.img, prog, anim, W, H);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(photo.img, dx, dy, dw, dh);
    ctx.restore();
  }

  /* ---- transition between two slides ---- */
  function drawTransition(ctx, prev, next, tProg, transType, W, H, prevAnimProg, nextAnimProg) {
    const p = T.clamp01(tProg); // 0 = all prev, 1 = all next

    if (transType === 'cut') {
      drawSlide(ctx, p >= 0.5 ? next : prev, p >= 0.5 ? nextAnimProg : prevAnimProg, W, H, 1);
      return;
    }
    if (transType === 'dissolve') {
      drawSlide(ctx, prev, prevAnimProg, W, H, 1);
      drawSlide(ctx, next, nextAnimProg, W, H, p);
      return;
    }
    if (transType === 'dip-black' || transType === 'dip-white') {
      const dipColor = transType === 'dip-black' ? '#000' : '#fff';
      const dipAlpha = p < 0.5 ? (p * 2) : (1 - (p - 0.5) * 2);
      drawSlide(ctx, p < 0.5 ? prev : next, p < 0.5 ? prevAnimProg : nextAnimProg, W, H, 1);
      ctx.save();
      ctx.globalAlpha = dipAlpha;
      ctx.fillStyle = dipColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      return;
    }
    if (transType === 'slide-l') {
      // Prev slides out to the left, next comes from the right
      ctx.save();
      ctx.translate(-p * W, 0);
      drawSlide(ctx, prev, prevAnimProg, W, H, 1);
      ctx.restore();
      ctx.save();
      ctx.translate((1 - p) * W, 0);
      drawSlide(ctx, next, nextAnimProg, W, H, 1);
      ctx.restore();
      return;
    }
    if (transType === 'slide-r') {
      ctx.save();
      ctx.translate(p * W, 0);
      drawSlide(ctx, prev, prevAnimProg, W, H, 1);
      ctx.restore();
      ctx.save();
      ctx.translate(-(1 - p) * W, 0);
      drawSlide(ctx, next, nextAnimProg, W, H, 1);
      ctx.restore();
      return;
    }
    if (transType === 'zoom') {
      // Prev zooms in and fades, next zooms out from center
      const ease = T.Ease.inOut(p);
      ctx.save();
      ctx.globalAlpha = 1 - ease;
      const sc = 1 + ease * 0.3;
      ctx.translate(W * (1 - sc) / 2, H * (1 - sc) / 2);
      ctx.scale(sc, sc);
      drawSlide(ctx, prev, prevAnimProg, W, H, 1);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = ease;
      const sc2 = 1.3 - ease * 0.3;
      ctx.translate(W * (1 - sc2) / 2, H * (1 - sc2) / 2);
      ctx.scale(sc2, sc2);
      drawSlide(ctx, next, nextAnimProg, W, H, 1);
      ctx.restore();
      return;
    }
    // fallback dissolve
    drawSlide(ctx, prev, prevAnimProg, W, H, 1);
    drawSlide(ctx, next, nextAnimProg, W, H, p);
  }

  /* ---- main frame ---- */
  SS.drawFrame = function (ctx, t) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const bk = window.BrandKit.get();
    const photos = SS.state.photos;
    const transDur = SS.state.transDuration;

    // Background fill
    ctx.fillStyle = bk.palette.bg; ctx.fillRect(0, 0, W, H);

    if (!photos.length) {
      const L = window.Lang;
      ctx.fillStyle = '#9aa3af'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(W * 0.028)}px "ArchivoNarrow", sans-serif`;
      ctx.fillText(L.t('ssEmpty'), W / 2, H / 2 - 20);
      ctx.font = `400 ${Math.round(W * 0.018)}px "ArchivoNarrow", sans-serif`;
      ctx.fillText(L.t('ssEmptyHint'), W / 2, H / 2 + 28);
      return;
    }

    const n = photos.length;
    const starts = slideStarts(photos, transDur);

    // Find which slide(s) to render
    for (let i = 0; i < n; i++) {
      const slideStart = starts[i];
      const slideDur   = photos[i].duration || DEFAULT_SLIDE_DUR;
      const slideEnd   = slideStart + slideDur;
      const transEnd   = slideEnd + (i < n - 1 ? transDur : 0);

      if (t < slideStart || t > transEnd) continue;

      const inTransition = i < n - 1 && t > slideEnd;
      const slideProgress = T.clamp01((t - slideStart) / slideDur);

      if (!inTransition) {
        // Plain slide — full-frame animation
        drawSlide(ctx, photos[i], slideProgress, W, H, 1);
      } else {
        // Transition to next slide
        const tProg = (t - slideEnd) / transDur;
        const nextStart = starts[i + 1];
        const nextSlideDur = photos[i + 1].duration || DEFAULT_SLIDE_DUR;
        const nextProgress = T.clamp01((t - nextStart) / nextSlideDur);
        const transType = photos[i].transition || SS.state.globalTransition;
        drawTransition(ctx, photos[i], photos[i + 1], tProg, transType, W, H, slideProgress, nextProgress);
        // Skip drawing i+1 on its own — handled inside transition
        break;
      }

      // Vignette
      const vig = ctx.createRadialGradient(W/2, H/2, H*0.12, W/2, H/2, H*0.82);
      vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.38)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

      // Caption
      if (SS.state.captions && photos[i] && photos[i].caption) {
        const slideT = t - slideStart;
        const capEnter = T.tween(slideT, 0.1, 0.5, 0, 1, 'out');
        const capExit  = i < n - 1 ? T.tween(slideT, slideDur - 0.5, 0.4, 0, 1, 'inOut') : 0;
        const capAlpha = capEnter * (1 - capExit);
        if (capAlpha > 0) {
          const capSize = Math.round(H * 0.032);
          const capY    = Math.round(H * 0.88) + (1 - capEnter) * 20;
          ctx.save();
          ctx.globalAlpha = capAlpha;
          ctx.fillStyle = 'rgba(0,0,0,.45)';
          ctx.fillRect(0, capY - capSize * 1.2, W, capSize * 2.6);
          ctx.fillStyle = '#f3f4f6';
          ctx.font = `600 ${capSize}px "ArchivoNarrow", sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.fillText(photos[i].caption, W / 2, capY);
          ctx.restore();
        }
      }
    }

    // Vignette pass (always — even during transition the inner loop may break early)
    // Dot indicators
    if (n > 1) {
      const dotR   = Math.round(H * 0.007);
      const dotGap = Math.round(dotR * 3.2);
      const dotsW  = n * dotGap - dotGap + dotR * 2;
      const dotsCx = W / 2;
      const dotsY  = Math.round(H * 0.935);
      // Current slide based on cumulative starts
      let curSlide = 0;
      for (let i = n - 1; i >= 0; i--) { if (t >= starts[i]) { curSlide = i; break; } }
      for (let i = 0; i < n; i++) {
        ctx.save();
        ctx.globalAlpha = i === curSlide ? 1 : 0.4;
        ctx.fillStyle = '#fff';
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
