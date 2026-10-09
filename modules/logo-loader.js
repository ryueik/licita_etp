/* =====================================================================
   OMNILICIT · Logo Loader
   Carrega a logo oficial da pasta raiz e converte para Base64.
   Uso:  await OmniLogo.load()   → dataURL
         OmniLogo.get()          → dataURL em cache
   ===================================================================== */
'use strict';

const OmniLogo = (() => {
  const LOGO_PATH = 'logo-omnilicit.png';   // pasta raiz
  const FALLBACK_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 80">
      <rect width="320" height="80" rx="12" fill="#0E7C86"/>
      <text x="160" y="50" font-family="ui-sans-serif,system-ui" font-size="30"
            font-weight="900" fill="#FFFFFF" text-anchor="middle">OmniLicit</text>
    </svg>`.trim();

  let cacheDataUrl = null;
  let cacheOrigem  = 'none';

  async function fileToDataUrl(fileOrBlob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = e => resolve(e.target.result);
      r.onerror = reject;
      r.readAsDataURL(fileOrBlob);
    });
  }

  async function svgToPngDataUrl(svg, w = 480, h = 120) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  /**
   * Carrega a logo oficial. Se falhar, cai para o SVG interno.
   * @returns {Promise<string>} dataURL
   */
  async function load() {
    if (cacheDataUrl) return cacheDataUrl;
    try {
      const resp = await fetch(LOGO_PATH, { cache: 'force-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ao buscar ${LOGO_PATH}`);
      const blob = await resp.blob();
      cacheDataUrl = await fileToDataUrl(blob);
      cacheOrigem  = 'oficial';
    } catch (err) {
      console.warn('[OmniLogo] Falha ao carregar logo oficial, usando fallback.', err);
      cacheDataUrl = await svgToPngDataUrl(FALLBACK_SVG);
      cacheOrigem  = 'fallback';
    }
    return cacheDataUrl;
  }

  function get()       { return cacheDataUrl; }
  function origem()    { return cacheOrigem; }
  function set(dUrl, o = 'manual') { cacheDataUrl = dUrl; cacheOrigem = o; }
  function clear()     { cacheDataUrl = null; cacheOrigem = 'none'; }

  return { load, get, origem, set, clear, LOGO_PATH };
})();

window.OmniLogo = OmniLogo;
