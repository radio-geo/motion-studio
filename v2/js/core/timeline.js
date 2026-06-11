/* timeline.js — easing + tween helpers. Time is seconds. Pure functions of t,
   so preview and offline export are pixel-identical. */
window.Timeline = (function () {
  const Ease = {
    linear:   t => t,
    inOut:    t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    out:      t => 1 - Math.pow(1 - t, 3),
    outQuint: t => 1 - Math.pow(1 - t, 5),
    outExpo:  t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    in:       t => t * t * t,
    inOutQ:   t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack:  t => { const c = 1.70158; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; },
  };

  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, p) => a + (b - a) * p;

  /* value ramping over [start, start+dur] */
  function tween(t, start, dur, from, to, ease) {
    const e = typeof ease === "function" ? ease : Ease[ease] || Ease.inOut;
    return from + (to - from) * e(clamp01((t - start) / (dur || 0.0001)));
  }
  /* 0..1 progress within a window */
  function progress(t, start, dur) { return clamp01((t - start) / (dur || 0.0001)); }

  return { Ease, tween, progress, clamp01, clamp, lerp };
})();
