/* textselect.js — phrase targeting shared by Quote (and Social).
   Tokenizes text, holds a contiguous word range, renders the chip picker,
   computes focus rects and the animated underline.
   V2 additions: dragTo() range building for on-canvas drag selection. */
window.TextTargeting = (function () {

  function create(text) {
    const inst = {
      raw: text || "",
      words: [],
      sel: null,            // {start,end} inclusive
      _pending: null,
      _anchor: null,        // drag anchor (canvas selection)
      _onChange: null,
    };

    function tokenize() {
      inst.words = (inst.raw.trim().length ? inst.raw.trim().split(/\s+/) : []).map(t => ({ text: t }));
      if (inst.sel) {
        if (!inst.words.length) inst.sel = null;
        else {
          inst.sel.start = Math.min(inst.sel.start, inst.words.length - 1);
          inst.sel.end   = Math.min(inst.sel.end,   inst.words.length - 1);
        }
      }
    }

    inst.setText = function (t) { inst.raw = t || ""; tokenize(); return inst; };
    inst.isSelected = i => !!(inst.sel && i >= inst.sel.start && i <= inst.sel.end);
    inst.clearSelection = function () {
      inst.sel = null; inst._pending = null; inst._anchor = null;
      if (inst._onChange) inst._onChange();
    };

    /* chip picker: click first word, click last word */
    inst.buildPicker = function (container, onChange) {
      inst._onChange = onChange || null;
      container.innerHTML = "";
      inst.words.forEach((w, i) => {
        const span = document.createElement("span");
        span.className = "w" + (inst.isSelected(i) ? " sel" : "");
        span.textContent = w.text;
        span.addEventListener("click", () => inst._pick(i, container));
        container.appendChild(span);
      });
    };
    inst._pick = function (i, container) {
      if (inst._pending === null) { inst._pending = i; inst.sel = { start: i, end: i }; }
      else { inst.sel = { start: Math.min(inst._pending, i), end: Math.max(inst._pending, i) }; inst._pending = null; }
      inst._repaint(container);
      if (inst._onChange) inst._onChange();
    };
    inst._repaint = function (container) {
      if (!container) return;
      [...container.children].forEach((el, idx) => el.classList.toggle("sel", inst.isSelected(idx)));
    };

    /* on-canvas drag selection */
    inst.dragStart = function (i) { inst._anchor = i; inst.sel = { start: i, end: i }; inst._pending = null; };
    inst.dragTo = function (i) {
      if (inst._anchor === null) return;
      inst.sel = { start: Math.min(inst._anchor, i), end: Math.max(inst._anchor, i) };
    };
    inst.dragEnd = function () { inst._anchor = null; if (inst._onChange) inst._onChange(); };

    /* bbox of selected word rects + padding */
    inst.focusRect = function (rects, pad) {
      if (!rects || !rects.length) return null;
      pad = pad || 0;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      rects.forEach(r => {
        x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
        x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
      });
      return { x: x0 - pad, y: y0 - pad, w: (x1 - x0) + pad * 2, h: (y1 - y0) + pad * 2,
               cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    };

    /* animated underline. prog 0..1 sweeps across the phrase; per line. */
    inst.drawUnderline = function (ctx, rects, prog, opts) {
      if (!rects || !rects.length || prog <= 0) return;
      opts = opts || {};
      const color  = opts.color || "#e8b400";
      const weight = opts.weight || 8;
      const gap    = opts.gap != null ? opts.gap : 10;
      const total  = rects.reduce((s, r) => s + r.w, 0);
      let drawn = total * Math.min(prog, 1);

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = weight;
      ctx.lineCap = "round";
      for (const r of rects) {
        if (drawn <= 0) break;
        const seg = Math.min(r.w, drawn);
        const y = (r.baseline != null ? r.baseline : r.y + r.h) + gap;
        ctx.beginPath();
        ctx.moveTo(r.x, y);
        ctx.lineTo(r.x + seg, y);
        ctx.stroke();
        drawn -= seg;
      }
      ctx.restore();
    };

    inst.setText(inst.raw);
    return inst;
  }

  return { create };
})();
