/* brand-kit.js — ENGINE MODULE 2
 *
 * One brand kit drives every template: logo (+position), fonts, color palette,
 * lower-third style. Templates READ from the active kit; they never hardcode
 * brand values. Droeba ships as the default kit.
 *
 * Logo lands later as a file in /assets/brand. Until then logoImage is null and
 * templates draw a labeled placeholder slot.
 */
window.BrandKit = (function () {

  const DROEBA = {
    id: "droeba",
    name: "Droeba",
    palette: {
      // editorial, serious. Not clickbait.
      bg:      "#0f1216",
      surface: "#161b22",
      ink:     "#f3f4f6",
      muted:   "#9aa3af",
      accent:  "#c1121f",   // Droeba red (placeholder until brand sheet lands)
      accent2: "#e8b400",   // secondary
    },
    locale: "en",                // "en" active now; "ge" is the dormant flip
    fonts: {                     // active fonts (mirror of fontsByLocale[locale])
      display: "ArchivoNarrow",
      body:    "ArchivoNarrow",
      mtavruli:"MtavruliSquare",
    },
    fontsByLocale: {
      en: { display: "ArchivoNarrow", body: "ArchivoNarrow" },  // pure Latin, clean
      ge: { display: "ArchyEdit",     body: "Archy" },          // chosen Georgian faces, later
    },
    logo: {
      image: null,               // HTMLImageElement once /assets/brand/logo lands
      position: "tl",            // tl tc tr / ml mc mr / bl bc br
      scale: 0.10,               // fraction of stage width
      margin: 0.04,
    },
    lowerThird: {
      style: "bar",              // "bar" | "underline" | "block"
      accentBar: true,
    },
  };

  let active = clone(DROEBA);

  function clone(o){ return JSON.parse(JSON.stringify(o, (k,v)=> v)); }

  function get(){ return active; }

  function update(patch){
    deepMerge(active, patch);
    return active;
  }

  function setAccent(hex){ active.palette.accent = hex; return active; }

  /* Locale switch: flips content fonts (and later default copy). EN now, GE later. */
  function setLocale(loc){
    if (!active.fontsByLocale[loc]) return active;
    active.locale = loc;
    Object.assign(active.fonts, active.fontsByLocale[loc]);
    return active;
  }

  /* load a logo file (from upload or /assets/brand) into the kit */
  function setLogo(srcUrl){
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => { active.logo.image = img; res(img); };
      img.onerror = () => { active.logo.image = null; res(null); };
      img.src = srcUrl;
    });
  }

  function setLogoPosition(pos){ active.logo.position = pos; return active; }

  /* compute logo box in stage coords for a given canvas size */
  function logoBox(W, H){
    const lg = active.logo;
    const w = W * lg.scale;
    const ar = lg.image ? (lg.image.naturalHeight / lg.image.naturalWidth) : 0.4;
    const h = w * ar;
    const m = W * lg.margin;
    const [v, hpos] = posParts(lg.position);
    let x = hpos === "l" ? m : hpos === "r" ? W - w - m : (W - w)/2;
    let y = v === "t" ? m : v === "b" ? H - h - m : (H - h)/2;
    return { x, y, w, h };
  }
  function posParts(p){
    const map = { tl:["t","l"],tc:["t","c"],tr:["t","r"],
                  ml:["m","l"],mc:["m","c"],mr:["m","r"],
                  bl:["b","l"],bc:["b","c"],br:["b","r"] };
    return map[p] || map.tl;
  }

  function deepMerge(t, s){
    for (const k in s){
      if (s[k] && typeof s[k] === "object" && !Array.isArray(s[k]) && !(s[k] instanceof Image)){
        t[k] = t[k] || {}; deepMerge(t[k], s[k]);
      } else t[k] = s[k];
    }
    return t;
  }

  return { DEFAULT: DROEBA, get, update, setAccent, setLocale, setLogo, setLogoPosition, logoBox };
})();
