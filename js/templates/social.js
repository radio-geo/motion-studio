/* social.js — TEMPLATE 2 (Social Post). STUB.
 * Facebook skin first; X / IG are labeled slots for later.
 * Reuses the SAME text-targeting engine module for the zoom+pan+underline motion.
 * Built next once the Quote preview is approved.
 */
window.SocialTemplate = (function () {
  const ST = {
    id: "social",
    name: "Social",
    later: true,                 // shown in tab as "coming next"
    duration: 7.0,
    network: "facebook",         // facebook (first) | x | instagram (labeled later)
    state: {
      author: "Droeba",
      verified: true,
      date: "2h",
      text: "Your social post text will appear here.",
      postImage: null,
      avatar: null,
    },
    tt: window.TextTargeting.create("Your social post text will appear here."),
  };

  ST.editor = function (container) {
    container.innerHTML = `
      <div class="section-title">Social Post</div>
      <div class="seg" style="margin-bottom:14px">
        <button class="active">Facebook</button>
        <button disabled title="coming later">X</button>
        <button disabled title="coming later">Instagram</button>
      </div>
      <p class="hint">Facebook skin is built next: authentic header, verified tick,
      avatar, date, post text + image, and the like / comment / share bar. The post
      appears full, then the camera zooms and pans to your targeted phrase with the
      same underline sweep as Quote. X and Instagram are labeled slots for later.</p>
      <div class="later-block">
        <div class="later-item"><span>Build Facebook skin</span><span class="pill">next</span></div>
      </div>`;
  };

  ST.drawFrame = function (ctx, t) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.fillStyle = "#0f1216"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#9aa3af"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(W * 0.03)}px "Archy", sans-serif`;
    ctx.fillText("Social Post — Facebook skin", W / 2, H / 2 - 20);
    ctx.font = `400 ${Math.round(W * 0.018)}px "Archy", sans-serif`;
    ctx.fillText("coming next (reuses text-targeting engine)", W / 2, H / 2 + 30);
  };

  return ST;
})();
