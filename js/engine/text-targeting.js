/* text-targeting.js  — ENGINE MODULE 1 (shared by Quote + Social)
 *
 * Responsibilities:
 *   - tokenize text into words
 *   - hold a contiguous word-range selection (the "targeted phrase")
 *   - render a click-to-select word picker (click start word, click end word)
 *   - given per-word layout rects from a template, expose:
 *       focusRect(rects)            -> bbox for zoom/pan
 *       drawUnderline(ctx, ...)     -> animated underline-draw highlight
 *
 * Selection model: indices into the WORD list (non-space tokens), inclusive.
 * The template owns text layout; this module owns selection + highlight motion.
 */
window.TextTargeting = (function () {

  function create(text) {
    const inst = {
      raw: text || "",
      words: [],          // [{text}]
      sel: null,          // {start, end} inclusive word indices, or null
      _pending: null,     // first click while choosing a range
      _onChange: null,
    };

    function tokenize() {
      inst.words = (inst.raw.trim().length ? inst.raw.trim().split(/\s+/) : [])
        .map(t => ({ text: t }));
      if (inst.sel) {
        inst.sel.start = Math.min(inst.sel.start, inst.words.length - 1);
        inst.sel.end   = Math.min(inst.sel.end,   inst.words.length - 1);
        if (inst.words.length === 0) inst.sel = null;
      }
    }

    inst.setText = function (t) {
      inst.raw = t || "";
      tokenize();
      return inst;
    };

    inst.isSelected = function (wordIndex) {
      return inst.sel && wordIndex >= inst.sel.start && wordIndex <= inst.sel.end;
    };

    inst.clearSelection = function () {
      inst.sel = null; inst._pending = null;
      if (inst._onChange) inst._onChange();
    };

    /* Build the clickable word picker in `container`.
     * Click one word -> selects it. Click a second word -> selects the range. */
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
      if (inst._pending === null) {
        // first click = anchor the range (shown as a single highlighted word)
        inst._pending = i;
        inst.sel = { start: i, end: i };
      } else {
        // second click = close the range against the anchor (inclusive, any length)
        inst.sel = { start: Math.min(inst._pending, i), end: Math.max(inst._pending, i) };
        inst._pending = null;
      }
      // repaint picker
      [...container.children].forEach((el, idx) =>
        el.classList.toggle("sel", inst.isSelected(idx)));
      if (inst._onChange) inst._onChange();
    };

    /* bbox of selected word rects (canvas coords) + padding -> for zoom/pan */
    inst.focusRect = function (rects, pad) {
      if (!rects || !rects.length) return null;
      pad = pad || 0;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      rects.forEach(r => {
        x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
        x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
      });
      return { x:x0-pad, y:y0-pad, w:(x1-x0)+pad*2, h:(y1-y0)+pad*2,
               cx:(x0+x1)/2, cy:(y0+y1)/2 };
    };

    /* Animated underline draw. rects sorted left->right/top->bottom.
     * prog 0..1 sweeps the rule across the phrase. */
    inst.drawUnderline = function (ctx, rects, prog, opts) {
      if (!rects || !rects.length || prog <= 0) return;
      opts = opts || {};
      const color = opts.color || "#e8b400";
      const weight = opts.weight || 8;
      const gap = opts.gap != null ? opts.gap : 10; // below baseline
      const total = rects.reduce((s, r) => s + r.w, 0);
      let drawn = total * prog;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = weight;
      ctx.lineCap = "round";
      for (const r of rects) {
        if (drawn <= 0) break;
        const seg = Math.min(r.w, drawn);
        const y = r.baseline != null ? r.baseline + gap : r.y + r.h + gap;
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
