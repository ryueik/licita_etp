/* =====================================================================
   OMNILICIT · Logo Loader
   Carrega a logo oficial da pasta raiz e converte para Base64.
   ✅ FIX: path alinhado com LicitaReq → 'logo-omnlicit.png'
   ===================================================================== */
'use strict';

const OmniLogo = (() => {
  // ⚠️ ATENÇÃO: o nome oficial do arquivo é 'logo-omnlicit.png' (sem o segundo 'i')
  const LOGO_PATH = 'logo-omnlicit.png';

  const FALLBACK_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 80">
      <rect width="320" height="80" rx="12" fill="#00A896"/>
      <text x="160" y="50" font-family="ui-sans-serif,system-ui" font-size="30"
            font-weight="900" fill="#FFFFFF" text-anchor="middle">OmniLicit</text>
    </svg>`.trim();

  let cacheDataUrl = null;
  let cacheOrigem  = 'none';

  async function fileToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = e => resolve(e.target.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
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

  async function load() {
    if (cacheDataUrl) return cacheDataUrl;

    // 1) Tenta aproveitar do core OmniLicit se já carregado (LicitaReq)
    if (window.OmniLicit?.carregarLogoBase64) {
      try {
        cacheDataUrl = await window.OmniLicit.carregarLogoBase64(LOGO_PATH);
        cacheOrigem  = 'oficial';
        return cacheDataUrl;
      } catch (_) { /* continua para tentativa local */ }
    }

    // 2) fetch + FileReader (mesma estratégia do omnlicit-core.js)
    try {
      const resp = await fetch(LOGO_PATH, { cache: 'force-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      cacheDataUrl = await fileToDataUrl(blob);
      cacheOrigem  = 'oficial';
    } catch (err) {
      // 3) Fallback via <img> + canvas (file:// restritivo)
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((res, rej) => {
          img.onload = res; img.onerror = rej; img.src = LOGO_PATH;
        });
        const c = document.createElement('canvas');
        c.width  = img.naturalWidth  || img.width;
        c.height = img.naturalHeight || img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        cacheDataUrl = c.toDataURL('image/png');
        cacheOrigem  = 'oficial';
      } catch (err2) {
        console.warn('[OmniLogo] Falha ao carregar logo oficial, usando fallback SVG.', err2);
        cacheDataUrl = await svgToPngDataUrl(FALLBACK_SVG);
        cacheOrigem  = 'fallback';
      }
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
