/* brandkit.js — one kit drives every template: logo (+position/scale/opacity),
   fonts per locale, palette, lower-third style. Droeba is the default kit. */
window.BrandKit = (function () {

  const DROEBA = {
    id: "droeba",
    name: "Droeba",
    palette: {
      bg:      "#0f1216",
      surface: "#161b22",
      ink:     "#f3f4f6",
      muted:   "#9aa3af",
      accent:  "#c1121f",
      accent2: "#e8b400",
    },
    /* palette overrides when a light background theme is active */
    lightInk: { ink: "#15181d", muted: "#535b66", surface: "#e7e9ee", bg: "#f3f4f7" },
    locale: "en",
    fonts: { display: "ArchivoNarrow", body: "ArchivoNarrow", mtavruli: "MtavruliSquare" },
    fontsByLocale: {
      en: { display: "ArchivoNarrow", body: "ArchivoNarrow" },
      ge: { display: "ArchyEdit", body: "Archy" },
    },
    logo: {
      image: null,
      position: "tr",
      scale: 0.10,        // fraction of stage width
      margin: 0.04,
      opacity: 1,
    },
    lowerThird: { style: "bar", accentBar: true },
  };

  let active = clone(DROEBA);
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function get() { return active; }

  function setAccent(hex)  { active.palette.accent = hex; return active; }
  function setAccent2(hex) { active.palette.accent2 = hex; return active; }

  function setLocale(loc) {
    if (!active.fontsByLocale[loc]) return active;
    active.locale = loc;
    Object.assign(active.fonts, active.fontsByLocale[loc]);
    return active;
  }

  function setLogo(srcUrl) {
    return new Promise(res => {
      if (!srcUrl) { active.logo.image = null; return res(null); }
      const img = new Image();
      img.onload = () => { active.logo.image = img; res(img); };
      img.onerror = () => { res(null); };  // keep existing logo on failure
      img.src = srcUrl;
    });
  }

  function setLogoPosition(pos) { active.logo.position = pos; return active; }

  /* logo box in stage coords */
  function logoBox(W, H) {
    const lg = active.logo;
    const w = W * lg.scale;
    const ar = lg.image ? lg.image.naturalHeight / lg.image.naturalWidth : 0.4;
    const h = w * ar;
    const m = W * lg.margin;
    const [v, hp] = posParts(lg.position);
    const x = hp === "l" ? m : hp === "r" ? W - w - m : (W - w) / 2;
    const y = v === "t" ? m : v === "b" ? H - h - m : (H - h) / 2;
    return { x, y, w, h };
  }
  function posParts(p) {
    const map = { tl:["t","l"], tc:["t","c"], tr:["t","r"],
                  ml:["m","l"], mc:["m","c"], mr:["m","r"],
                  bl:["b","l"], bc:["b","c"], br:["b","r"] };
    return map[p] || map.tl;
  }

  /* serialize / restore (for project save). Logo image as dataURL. */
  function serialize() {
    const s = clone(active);
    s.logo.image = null;
    if (active.logo.image) {
      try {
        const c = document.createElement("canvas");
        c.width = active.logo.image.naturalWidth; c.height = active.logo.image.naturalHeight;
        c.getContext("2d").drawImage(active.logo.image, 0, 0);
        s.logo.imageData = c.toDataURL("image/png");
      } catch (e) {}
    }
    return s;
  }
  async function restore(data) {
    if (!data) return;
    const imgData = data.logo && data.logo.imageData;
    const keepImg = active.logo.image;
    const d = clone(data); delete (d.logo || {}).imageData;
    active = Object.assign(clone(DROEBA), d);
    active.logo.image = keepImg;
    if (imgData) await setLogo(imgData);
    setLocale(active.locale);
  }

  return { DEFAULT: DROEBA, get, setAccent, setAccent2, setLocale, setLogo,
           setLogoPosition, logoBox, posParts, serialize, restore };
})();
