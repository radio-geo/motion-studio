/* timeline.js
 * Tiny easing + keyframe helpers shared by every template.
 * Time is normalized seconds. Templates query value at time t.
 */
window.Timeline = (function () {
  const Ease = {
    linear: t => t,
    inOut:  t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2,
    out:    t => 1 - Math.pow(1 - t, 3),
    outQuint: t => 1 - Math.pow(1 - t, 5),
    in:     t => t*t*t,
  };

  // clamp + normalize
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

  /* tween(t, start, dur, from, to, ease) -> value, ramping over [start, start+dur] */
  function tween(t, start, dur, from, to, ease) {
    const e = (typeof ease === "function") ? ease : (Ease[ease] || Ease.inOut);
    const p = clamp01((t - start) / dur);
    return from + (to - from) * e(p);
  }

  /* progress(t, start, dur) -> 0..1 within a window */
  function progress(t, start, dur) {
    return clamp01((t - start) / dur);
  }

  return { Ease, tween, progress, clamp01 };
})();
