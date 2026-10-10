/* =====================================================================
   OMNILICIT · Logo Loader v5.1 — Multi-path robusto
   Tenta vários nomes de arquivo até encontrar a logo oficial.
   ===================================================================== */
'use strict';

const OmniLogo = (() => {

  // ✅ Lista de caminhos a tentar (o primeiro que existir vence)
  const CANDIDATOS = [
    'logo-omnlicit.png',      // ← nome oficial (igual LicitaReq)
    'logo-omnilicit.png',     // variação com 2 "i"
    'logo.png',
    'Logo.png',
    'LOGO.png',
    'logo-omnlicit.jpg',
    'logo-omnlicit.jpeg',
    'logo-omnlicit.webp',
    'logo-omnilicit.jpg',
    'logo-omnilicit.webp',
    'assets/logo-omnlicit.png',
    'img/logo-omnlicit.png',
    'images/logo-omnlicit.png'
  ];

  const FALLBACK_SVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 80">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#29B5A7"/>
          <stop offset="1" stop-color="#05668D"/>
        </linearGradient>
      </defs>
      <rect width="320" height="80" rx="12" fill="url(#g)"/>
      <text x="160" y="50" font-family="ui-sans-serif,system-ui" font-size="28"
            font-weight="900" fill="#FFFFFF" text-anchor="middle">OmniLicit</text>
    </svg>`.trim();

  let cacheDataUrl = null;
  let cacheOrigem  = 'none';
  let cachePath    = null;

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

  /**
   * Tenta carregar UMA url. Retorna dataURL ou null.
   */
  async function tentarUrl(url) {
    // 1) fetch + FileReader
    try {
      const resp = await fetch(url, { cache: 'force-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();
      if (!blob.type.startsWith('image/') && blob.size < 100) throw new Error('não é imagem');
      return await fileToDataUrl(blob);
    } catch (_) { /* tenta <img> */ }

    // 2) <img> + canvas (funciona em file://)
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error('img load fail'));
        img.src = url + '?t=' + Date.now(); // cache-bust
      });
      const c = document.createElement('canvas');
      c.width  = img.naturalWidth  || img.width;
      c.height = img.naturalHeight || img.height;
      if (!c.width || !c.height) throw new Error('dimensão inválida');
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/png');
    } catch (_) { /* desiste desta URL */ }

    return null;
  }

  async function load() {
    if (cacheDataUrl) return cacheDataUrl;

    // 1) Reaproveita do core OmniLicit (LicitaReq) se já carregado
    if (window.OmniLicit?.carregarLogoBase64) {
      for (const path of CANDIDATOS) {
        try {
          const dUrl = await window.OmniLicit.carregarLogoBase64(path);
          if (dUrl && dUrl.length > 100) {
            cacheDataUrl = dUrl;
            cacheOrigem  = 'oficial';
            cachePath    = path;
            console.info(`[OmniLogo] Logo carregada via OmniLicit: ${path}`);
            return cacheDataUrl;
          }
        } catch (_) { /* tenta próximo */ }
      }
    }

    // 2) Tenta cada candidato localmente
    for (const path of CANDIDATOS) {
      const dUrl = await tentarUrl(path);
      if (dUrl && dUrl.length > 100) {
        cacheDataUrl = dUrl;
        cacheOrigem  = 'oficial';
        cachePath    = path;
        console.info(`[OmniLogo] ✅ Logo encontrada em: ${path}`);
        return cacheDataUrl;
      }
    }

    // 3) Fallback SVG
    console.warn('[OmniLogo] ⚠️ Nenhum arquivo encontrado. Usando fallback SVG.\n' +
                 'Coloque o arquivo na raiz com um destes nomes:\n' +
                 CANDIDATOS.map(p => '  • ' + p).join('\n'));
    cacheDataUrl = await svgToPngDataUrl(FALLBACK_SVG);
    cacheOrigem  = 'fallback';
    cachePath    = null;
    return cacheDataUrl;
  }

  function get()       { return cacheDataUrl; }
  function origem()    { return cacheOrigem; }
  function path()      { return cachePath; }
  function set(d, o = 'manual') { cacheDataUrl = d; cacheOrigem = o; }
  function clear()     { cacheDataUrl = null; cacheOrigem = 'none'; cachePath = null; }

  return { load, get, origem, path, set, clear, CANDIDATOS };
})();

window.OmniLogo = OmniLogo;
