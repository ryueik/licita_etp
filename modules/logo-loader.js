/* =====================================================================
   OMNILICIT · Logo Loader (IIFE) — LicitaETP v5.0
   ✅ Path: 'logo-omnlicit.png' (nome oficial, sem o 2º "i")
   ===================================================================== */
'use strict';

const OmniLogo = (() => {
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

    if (window.OmniLicit?.carregarLogoBase64) {
      try {
        cacheDataUrl = await window.OmniLicit.carregarLogoBase64(LOGO_PATH);
        cacheOrigem  = 'oficial';
        return cacheDataUrl;
      } catch (_) { }
    }

    try {
      const resp = await fetch(LOGO_PATH, { cache: 'force-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      cacheDataUrl = await fileToDataUrl(blob);
      cacheOrigem  = 'oficial';
    } catch (err) {
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
        console.warn('[OmniLogo] Fallback SVG.', err2);
        cacheDataUrl = await svgToPngDataUrl(FALLBACK_SVG);
        cacheOrigem  = 'fallback';
      }
    }
    return cacheDataUrl;
  }

  function get()    { return cacheDataUrl; }
  function origem() { return cacheOrigem; }
  function set(d, o = 'manual') { cacheDataUrl = d; cacheOrigem = o; }
  function clear()  { cacheDataUrl = null; cacheOrigem = 'none'; }

  return { load, get, origem, set, clear, LOGO_PATH };
})();

window.OmniLogo = OmniLogo;
