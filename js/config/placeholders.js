/* placeholders.js
 * Feature flags for capabilities intentionally NOT built yet.
 * Designed as switches, not rewrites: flip `enabled:true` when the backing
 * seam is wired. The UI greys these out and labels them "coming later".
 */
window.FEATURES = {
  export4K:        { enabled:false, label:"4K export",                 note:"needs render server" },
  proResAlpha:     { enabled:false, label:"ProRes 4444 / alpha .mov",  note:"needs render server" },
  serverRender:    { enabled:false, label:"Server-side render",        note:"seam present, off" },
  iconGeneration:  { enabled:false, label:"AI icon generation",        note:"AI stub" },
  assetLibrary:    { enabled:false, label:"Asset library + Drive",     note:"connector seam, unwired" },

  // live capabilities
  aiTextHelp:      { enabled:true,  label:"AI help with text",         note:"central free key (Haiku/Flash); user key override in settings" },
};

/* Central AI key seam. Default: central free key on a cheap model.
 * User-own-key override stored client-side (settings). Unwired network call. */
window.AI_CONFIG = {
  mode:"central",                 // "central" | "user-key"
  model:"claude-haiku",           // cheap default
  centralEndpoint:"/api/ai-text", // server function added at deploy time
  userKey:null,                   // set from settings panel later
};
