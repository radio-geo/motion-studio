/* press.js — TEMPLATE 4 (Press)
 * Fetch article via Jina Reader API → select highlight → animated motion graphic.
 * Stages: Reveal (headline+source slide in) → Hold (quote prominent) → Out.
 */
window.PressTemplate = (function () {
  const T = window.Timeline;

  const PT = {
    id: 'press',
    name: 'Press',
    later: false,
    duration: 12.0,
    state: {
      url: '',
      headline: '',
      source: '',
      author: '',
      date: '',
      bodyText: '',
      excerpt: '',          // the highlighted/selected text
      bgImage: null,        // HTMLImageElement from article
      bgImageUrl: '',
      showBgImage: true,
      showAuthorDate: true,
      textReveal: 'word-fade',
      highlightColor: '',   // falls back to brand accent
      bgStyle: 0,           // 0-4 same as quote presets
      revealDur: 2.5,
      holdDur:   4.0,
      outDur:    1.5,
      fetching: false,
      fetchError: '',
    },
    _sig: '',
    _layout: null,
  };

  PT.invalidate = function () { PT._sig = ''; };

  /* ---- article fetch via Jina Reader ---- */
  async function fetchArticle(url) {
    const jinaUrl = 'https://r.jina.ai/' + encodeURIComponent(url);
    const res = await fetch(jinaUrl, { headers: { 'Accept': 'text/plain' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.text();
  }

  function parseMarkdown(md) {
    const lines = md.split('\n');
    let headline = '', source = '', author = '', date = '', body = '', imageUrl = '';

    // Jina Reader format: Title: ... / URL Source: ... / Published: ...
    lines.forEach(line => {
      if (!headline && /^#\s/.test(line)) { headline = line.replace(/^#\s+/, '').trim(); return; }
      if (!headline && /^Title:/i.test(line)) { headline = line.replace(/^Title:\s*/i,'').trim(); return; }
      if (!source && /^URL Source:/i.test(line)) { source = line.replace(/^URL Source:\s*/i,'').trim().replace(/https?:\/\/(www\.)?/,'').split('/')[0]; return; }
      if (!source && /^Source:/i.test(line)) { source = line.replace(/^Source:\s*/i,'').trim(); return; }
      if (!author && /^Author[s]?:/i.test(line)) { author = line.replace(/^Author[s]?:\s*/i,'').trim(); return; }
      if (!date && /^Published|^Date:/i.test(line)) { date = line.replace(/^Published:?\s*/i,'').replace(/^Date:\s*/i,'').trim().slice(0, 20); return; }
      if (!imageUrl) {
        const imgMatch = line.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
        if (imgMatch) imageUrl = imgMatch[1];
      }
    });

    // Body: everything after the metadata block
    let inBody = false;
    const bodyLines = [];
    lines.forEach(line => {
      if (inBody) {
        // Strip markdown formatting
        const clean = line
          .replace(/^#{1,6}\s+/, '')
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
          .replace(/`([^`]+)`/g, '$1')
          .trim();
        if (clean) bodyLines.push(clean);
      } else if (line.trim() === '---' || /^##\s/.test(line) || (bodyLines.length === 0 && line.trim().length > 40)) {
        inBody = true;
        const clean = line.replace(/^#{1,6}\s+/,'').replace(/---/,'').trim();
        if (clean.length > 30) bodyLines.push(clean);
      }
    });

    return {
      headline: headline || '(No headline found)',
      source, author, date,
      body: bodyLines.slice(0, 60).join(' '),
      imageUrl,
    };
  }

  /* ---- editor ---- */
  PT.editor = function (container, onChange) {
    const L = window.Lang;
    const s = PT.state;

    const revealOpts = [
      ['word-fade', L.t('revCascade')],
      ['type', L.t('revType')],
      ['wipe', L.t('revWipe')],
    ].map(([v,l]) => `<option value="${v}"${v===s.textReveal?' selected':''}>${l}</option>`).join('');

    container.innerHTML = `
      <div class="section-title">${L.t('templatePress')}</div>

      <div class="field">
        <label>${L.t('pressUrlLabel')}</label>
        <div style="display:flex;gap:6px">
          <input type="text" id="pt-url" value="${s.url}" placeholder="${L.t('pressUrlPlaceholder')}" style="flex:1" />
          <button class="btn small" id="pt-fetch">${L.t('pressFetch')}</button>
        </div>
        <div id="pt-fetch-status" class="hint" style="margin-top:6px;color:var(--muted)">${s.fetchError || ''}</div>
      </div>

      <div id="pt-article-area" ${!s.bodyText ? 'hidden' : ''}>
        <div class="field">
          <label>${L.t('pressHeadline')}</label>
          <input type="text" id="pt-headline" value="${s.headline.replace(/"/g,'&quot;')}" />
        </div>
        <div class="field" style="display:flex;gap:8px">
          <div style="flex:1">
            <label>${L.t('pressSource')}</label>
            <input type="text" id="pt-source" value="${s.source.replace(/"/g,'&quot;')}" />
          </div>
          <div style="flex:1">
            <label>${L.t('pressAuthor')}</label>
            <input type="text" id="pt-author" value="${s.author.replace(/"/g,'&quot;')}" />
          </div>
        </div>
        <div class="field">
          <label>${L.t('pressExcerpt')} <span style="color:var(--muted);font-weight:400">— ${L.t('pressSelectHint')}</span></label>
          <div id="pt-body-text" class="pt-body-selectable"></div>
          <textarea id="pt-excerpt" style="margin-top:8px;min-height:64px" placeholder="${L.t('pressExcerpt')}">${s.excerpt}</textarea>
        </div>
      </div>

      <div class="field">
        <label>${L.t('pressRevealStyle')}</label>
        <select id="pt-reveal">${revealOpts}</select>
      </div>
      <div class="field" style="display:flex;gap:8px">
        <label style="margin:0;flex:1">${L.t('pressRevealDur')} <input type="number" id="pt-rev-dur" value="${s.revealDur}" min="0.5" max="10" step="0.5" style="width:60px" /></label>
        <label style="margin:0;flex:1">${L.t('pressHoldDur')} <input type="number" id="pt-hold-dur" value="${s.holdDur}" min="0.5" max="30" step="0.5" style="width:60px" /></label>
        <label style="margin:0;flex:1">${L.t('pressOutDur')} <input type="number" id="pt-out-dur" value="${s.outDur}" min="0.5" max="10" step="0.5" style="width:60px" /></label>
      </div>
      <div class="field" style="display:flex;gap:10px;flex-wrap:wrap">
        <label style="margin:0;display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="pt-show-image" ${s.showBgImage ? 'checked' : ''} />
          ${L.t('pressShowImage')}
        </label>
        <label style="margin:0;display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="pt-show-author" ${s.showAuthorDate ? 'checked' : ''} />
          ${L.t('pressShowAuthor')}
        </label>
      </div>`;

    const $ = sel => container.querySelector(sel);

    // Render body text for selection
    function renderBodyText() {
      const el = $('#pt-body-text');
      if (!el || !s.bodyText) return;
      el.innerHTML = '';
      // Split into sentences for easier clicking
      const sentences = s.bodyText.match(/[^.!?]+[.!?]+/g) || [s.bodyText];
      sentences.forEach(sent => {
        const span = document.createElement('span');
        span.className = 'pt-sentence';
        span.textContent = sent.trim() + ' ';
        span.addEventListener('click', () => {
          // Toggle selection — click a sentence to set as excerpt
          const excerpt = $('#pt-excerpt');
          if (excerpt) {
            excerpt.value = sent.trim();
            s.excerpt = sent.trim();
            PT.invalidate(); onChange && onChange();
          }
          // Highlight selected sentence
          el.querySelectorAll('.pt-sentence').forEach(s2 => s2.classList.remove('selected'));
          span.classList.add('selected');
        });
        el.appendChild(span);
      });
      // Also support mouse drag-select + capture
      el.addEventListener('mouseup', () => {
        const sel = window.getSelection();
        if (sel && sel.toString().trim().length > 5) {
          const text = sel.toString().trim();
          const excerpt = $('#pt-excerpt');
          if (excerpt) { excerpt.value = text; s.excerpt = text; PT.invalidate(); onChange && onChange(); }
          sel.removeAllRanges();
        }
      });
    }

    if (s.bodyText) renderBodyText();

    // Fetch
    const fetchBtn = $('#pt-fetch');
    const fetchStatus = $('#pt-fetch-status');
    fetchBtn.addEventListener('click', async () => {
      const url = $('#pt-url').value.trim();
      if (!url) return;
      s.url = url;
      fetchBtn.disabled = true;
      fetchBtn.textContent = L.t('pressFetching');
      fetchStatus.textContent = '';
      fetchStatus.style.color = 'var(--muted)';
      try {
        const md = await fetchArticle(url);
        const parsed = parseMarkdown(md);
        s.headline = parsed.headline;
        s.source   = parsed.source;
        s.author   = parsed.author;
        s.date     = parsed.date;
        s.bodyText = parsed.body;
        s.excerpt  = '';
        if (parsed.imageUrl) {
          s.bgImageUrl = parsed.imageUrl;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => { s.bgImage = img; PT.invalidate(); onChange && onChange(); };
          img.onerror = () => { s.bgImage = null; };
          img.src = parsed.imageUrl;
        }
        PT.invalidate();
        // Rebuild editor with new data
        PT.editor(container, onChange);
      } catch (e) {
        fetchStatus.textContent = L.t('pressFetchError') + ' ' + (e.message || e);
        fetchStatus.style.color = '#f87171';
        fetchBtn.disabled = false;
        fetchBtn.textContent = L.t('pressFetch');
      }
    });

    // Manual edits
    ['#pt-headline','#pt-source','#pt-author'].forEach(sel => {
      const el = $(sel);
      if (!el) return;
      el.addEventListener('input', e => {
        const key = sel === '#pt-headline' ? 'headline' : sel === '#pt-source' ? 'source' : 'author';
        s[key] = e.target.value; PT.invalidate(); onChange && onChange();
      });
    });
    const excerptEl = $('#pt-excerpt');
    if (excerptEl) excerptEl.addEventListener('input', e => {
      s.excerpt = e.target.value; PT.invalidate(); onChange && onChange();
    });

    $('#pt-reveal').addEventListener('change', e => { s.textReveal = e.target.value; onChange && onChange(); });
    $('#pt-rev-dur').addEventListener('input', e => {
      s.revealDur = Math.max(0.5, parseFloat(e.target.value)||2.5);
      updateDuration(); onChange && onChange();
    });
    $('#pt-hold-dur').addEventListener('input', e => {
      s.holdDur = Math.max(0.5, parseFloat(e.target.value)||4.0);
      updateDuration(); onChange && onChange();
    });
    $('#pt-out-dur').addEventListener('input', e => {
      s.outDur = Math.max(0.5, parseFloat(e.target.value)||1.5);
      updateDuration(); onChange && onChange();
    });
    $('#pt-show-image').addEventListener('change', e => { s.showBgImage = e.target.checked; PT.invalidate(); onChange && onChange(); });
    $('#pt-show-author').addEventListener('change', e => { s.showAuthorDate = e.target.checked; onChange && onChange(); });
  };

  function updateDuration() {
    const s = PT.state;
    PT.duration = s.revealDur + s.holdDur + s.outDur;
    if (window.Pipeline) window.Pipeline.setDuration(PT.duration);
  }

  /* ---- layout cache ---- */
  function ensureLayout(ctx, W, H) {
    const s = PT.state;
    const bk = window.BrandKit.get();
    const sig = [W, H, s.excerpt, s.headline, bk.fonts.display].join('|');
    if (PT._sig === sig && PT._layout) return PT._layout;

    const excerptSize = Math.round(W * 0.042);
    const lineH = Math.round(excerptSize * 1.38);
    const margin = Math.round(W * 0.072);
    const maxW = W - margin * 2;
    const topY = Math.round(H * 0.40);

    ctx.font = `700 ${excerptSize}px "${bk.fonts.display}", "ArchivoNarrow", sans-serif`;
    const words = (s.excerpt || '').trim().split(/\s+/).filter(Boolean);
    const spaceW = ctx.measureText(' ').width;
    const rects = [];
    let x = margin, y = topY, lineCount = 0;
    words.forEach((wd, i) => {
      const ww = ctx.measureText(wd).width;
      if (x + ww > margin + maxW && x > margin) { x = margin; y += lineH; lineCount++; }
      rects.push({ x, y: y - excerptSize * 0.82, w: ww, h: excerptSize, baseline: y, wordIndex: i, text: wd });
      x += ww + spaceW;
    });

    PT._layout = { excerptSize, lineH, margin, maxW, topY, rects, lineCount: lineCount + 1 };
    PT._sig = sig;
    return PT._layout;
  }

  function drawBg(ctx, W, H, s, P) {
    if (s.showBgImage && s.bgImage) {
      const ar = s.bgImage.naturalWidth / s.bgImage.naturalHeight, far = W / H;
      let dw = W, dh = H, ox = 0, oy = 0;
      if (ar > far) { dw = H * ar; ox = (dw - W) / 2; } else { dh = W / ar; oy = (dh - H) / 2; }
      ctx.drawImage(s.bgImage, -ox, -oy, dw, dh);
      // Dark overlay for readability
      const ov = ctx.createLinearGradient(0, 0, 0, H);
      ov.addColorStop(0, 'rgba(0,0,0,.65)'); ov.addColorStop(1, 'rgba(0,0,0,.80)');
      ctx.fillStyle = ov; ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, P.bg); g.addColorStop(1, P.surface);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---- main frame ---- */
  PT.drawFrame = function (ctx, t) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const bk = window.BrandKit.get();
    const P = bk.palette;
    const s = PT.state;
    const L = ensureLayout(ctx, W, H);

    const revStart  = 0;
    const holdStart = s.revealDur;
    const outStart  = holdStart + s.holdDur;
    const totalDur  = outStart + s.outDur;

    // Background
    drawBg(ctx, W, H, s, P);

    const accentColor = s.highlightColor || P.accent2 || '#e8b400';

    // ---------- SOURCE BAR (slides in from left) ----------
    const srcEnter = T.tween(t, 0, 0.5, 0, 1, 'out');
    const srcExit  = T.tween(t, outStart, 0.4, 0, 1, 'inOut');
    const srcAlpha = srcEnter * (1 - srcExit);
    if (srcAlpha > 0 && (s.source || s.date)) {
      const srcSize  = Math.round(H * 0.022);
      const barH     = Math.round(H * 0.050);
      const barY     = Math.round(H * 0.085);
      const slideIn  = (1 - srcEnter) * Math.round(W * 0.05);
      ctx.save();
      ctx.globalAlpha = srcAlpha;
      ctx.translate(-slideIn, 0);
      // Accent bar
      ctx.fillStyle = P.accent;
      ctx.fillRect(L.margin, barY, Math.round(W * 0.005), barH);
      // Source text
      ctx.fillStyle = P.ink;
      ctx.font = `700 ${srcSize}px "ArchivoNarrow", sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(s.source || '', L.margin + Math.round(W * 0.012), barY + Math.round(barH * 0.68));
      if (s.date) {
        ctx.fillStyle = P.muted;
        ctx.font = `400 ${Math.round(srcSize * 0.85)}px "ArchivoNarrow", sans-serif`;
        ctx.fillText(s.date, L.margin + Math.round(W * 0.012), barY + Math.round(barH * 0.98));
      }
      ctx.restore();
    }

    // ---------- HEADLINE ----------
    const hlEnter = T.tween(t, 0.3, 0.7, 0, 1, 'out');
    const hlExit  = T.tween(t, outStart + 0.1, 0.5, 0, 1, 'inOut');
    const hlAlpha = hlEnter * (1 - hlExit);
    if (hlAlpha > 0 && s.headline) {
      const hlSize   = Math.round(W * 0.026);
      const hlLineH  = Math.round(hlSize * 1.35);
      const hlMaxW   = W - L.margin * 2;
      const hlY      = Math.round(H * 0.175);
      const slideIn  = (1 - hlEnter) * 18;
      ctx.save();
      ctx.globalAlpha = hlAlpha;
      ctx.fillStyle = P.ink;
      ctx.font = `700 ${hlSize}px "${bk.fonts.display}", "ArchivoNarrow", sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      // Word-wrap headline
      const hlWords = s.headline.split(' ');
      let hx = L.margin, hy = hlY + slideIn;
      hlWords.forEach(w => {
        const ww = ctx.measureText(w + ' ').width;
        if (hx + ww > L.margin + hlMaxW && hx > L.margin) { hx = L.margin; hy += hlLineH; }
        ctx.fillText(w, hx, hy); hx += ww;
      });
      ctx.restore();
    }

    // ---------- EXCERPT / QUOTE ----------
    if (L.rects.length > 0) {
      const qEnter = T.tween(t, holdStart > 0.8 ? holdStart - 0.6 : 0.4, 0.8, 0, 1, 'out');
      const qExit  = T.tween(t, outStart + 0.2, 0.5, 0, 1, 'inOut');
      const qAlpha = qEnter * (1 - qExit);

      // Accent left bar
      ctx.save();
      ctx.globalAlpha = qAlpha;
      ctx.fillStyle = P.accent;
      ctx.fillRect(L.margin - Math.round(L.excerptSize * 0.45), L.topY - Math.round(L.excerptSize * 1.0),
                   Math.round(L.excerptSize * 0.16), L.lineH * L.lineCount + L.excerptSize * 0.6);
      ctx.restore();

      // Large opening quote mark
      ctx.save();
      ctx.globalAlpha = qAlpha * 0.2;
      ctx.fillStyle = accentColor;
      ctx.font = `700 ${Math.round(L.excerptSize * 3.2)}px "${bk.fonts.display}", serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('“', L.margin - Math.round(L.excerptSize * 0.1), L.topY - Math.round(L.excerptSize * 0.4));
      ctx.restore();

      // Words
      ctx.font = `700 ${L.excerptSize}px "${bk.fonts.display}", "ArchivoNarrow", sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

      const revP = T.tween(t, holdStart > 0.8 ? holdStart - 0.5 : 0.5, Math.min(s.revealDur, 2.0), 0, 1, 'out');
      const totalChars = L.rects.reduce((sum, r) => sum + r.text.length, 0);
      const shownChars = Math.floor(revP * totalChars);
      let charCount = 0;

      L.rects.forEach((r, idx) => {
        let alpha = qAlpha, text = r.text;
        if (s.textReveal === 'word-fade') {
          alpha = qAlpha * T.tween(t, (holdStart > 0.8 ? holdStart - 0.5 : 0.5) + r.wordIndex * 0.07, 0.4, 0, 1, 'out');
        } else if (s.textReveal === 'type') {
          const start = charCount, end = start + r.text.length;
          charCount += r.text.length + 1;
          if (shownChars <= start) { alpha = 0; }
          else if (shownChars < end) text = r.text.slice(0, shownChars - start);
        } else if (s.textReveal === 'wipe') {
          alpha = qAlpha;
        }
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = accentColor;
        ctx.fillText(text, r.x, r.baseline);
        ctx.restore();
      });

      // Underline sweep during hold
      const underProg = T.tween(t, holdStart + 0.3, 0.8, 0, 1, 'out') * (1 - T.tween(t, outStart, 0.3, 0, 1, 'inOut'));
      if (underProg > 0) {
        const lineWeight = Math.round(L.excerptSize * 0.10);
        ctx.save();
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = lineWeight;
        ctx.lineCap = 'round';
        let drawn = L.rects.reduce((s2, r) => s2 + r.w, 0) * underProg;
        L.rects.forEach(r => {
          if (drawn <= 0) return;
          const seg = Math.min(r.w, drawn);
          const uy = r.baseline + L.excerptSize * 0.22;
          ctx.beginPath(); ctx.moveTo(r.x, uy); ctx.lineTo(r.x + seg, uy); ctx.stroke();
          drawn -= seg;
        });
        ctx.restore();
      }
    }

    // ---------- AUTHOR / DATE ----------
    if (s.showAuthorDate && (s.author || s.date)) {
      const atEnter = T.tween(t, s.revealDur * 0.6, 0.5, 0, 1, 'out');
      const atExit  = T.tween(t, outStart, 0.4, 0, 1, 'inOut');
      const atAlpha = atEnter * (1 - atExit);
      if (atAlpha > 0) {
        const atSize = Math.round(H * 0.024);
        const atY    = Math.round(H * 0.855);
        ctx.save();
        ctx.globalAlpha = atAlpha;
        ctx.fillStyle = P.muted;
        ctx.font = `400 ${atSize}px "ArchivoNarrow", sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        const atText = [s.author, s.date].filter(Boolean).join('  ·  ');
        ctx.fillText(atText, L.margin, atY);
        ctx.restore();
      }
    }

    // Logo
    if (bk.logo.image) {
      const box = window.BrandKit.logoBox(W, H);
      ctx.drawImage(bk.logo.image, box.x, box.y, box.w, box.h);
    }
  };

  return PT;
})();
