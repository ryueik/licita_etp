/* =====================================================================
   OMNILICIT · Logo Loader v5.2
   - Multi-path: tenta 13 nomes de arquivo antes de desistir
   - Fallback SVG: escudo com gradiente OmniLicit (não fica feio)
   ===================================================================== */
'use strict';

const OmniLogo = (() => {

  /* ✅ Ordem de tentativa (o primeiro que existir vence) */
  const CANDIDATOS = [
    'logo-omnlicit.png',
    'logo-omnilicit.png',
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

  /* 🛡️ Fallback: escudo OmniLicit (gradiente teal→azul) */
  const FALLBACK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220">
  <defs>
    <linearGradient id="omniGrad" x1="0.2" y1="0" x2="0.7" y2="1">
      <stop offset="0" stop-color="#29B5A7"/>
      <stop offset="0.5" stop-color="#00A896"/>
      <stop offset="1" stop-color="#05668D"/>
    </linearGradient>
    <linearGradient id="omniGrad2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5CC7BC"/>
      <stop offset="1" stop-color="#034462"/>
    </linearGradient>
  </defs>

  <!-- Escudo externo -->
  <g transform="translate(30, 20)">
    <path d="M85 5 L15 40 L5 95 L15 155 L85 205 L155 155 L165 95 L155 40 Z"
          fill="url(#omniGrad)"/>
    <!-- Borda interna clara -->
    <path d="M85 25 L30 52 L22 96 L30 145 L85 185 L140 145 L148 96 L140 52 Z"
          fill="none" stroke="#FFFFFF" stroke-width="2.5" opacity="0.35"/>
    <!-- Núcleo / "águia" central -->
    <path d="M85 35 L80 60 L74 105 L74 165 L85 178 L96 165 L96 105 L90 60 Z"
          fill="#FFFFFF" opacity="0.95"/>
    <!-- Linha central vertical -->
    <line x1="85" y1="65" x2="85" y2="160" stroke="url(#omniGrad2)" stroke-width="2.5"/>
    <!-- Asas laterais esquerdas -->
    <path d="M60 80 L40 100 L50 140 L70 130 Z" fill="#FFFFFF" opacity="0.20"/>
    <!-- Asas laterais direitas -->
    <path d="M110 80 L130 100 L120 140 L100 130 Z" fill="#FFFFFF" opacity="0.20"/>
  </g>

  <!-- Wordmark -->
  <text x="230" y="115"
        font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        font-size="34" font-weight="900" fill="#0A0F1E" letter-spacing="-0.5">
    Omni<tspan fill="#00A896">Licit</tspan>
  </text>
  <text x="232" y="140"
        font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        font-size="11" font-weight="700" fill="#64748B" letter-spacing="2.5">
    LICITAETP · LEI 14.133/2021
  </text>
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

  async function svgToPngDataUrl(svg, w = 800, h = 440) {
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
        img.src = url + '?t=' + Date.now();
      });
      const c = document.createElement('canvas');
      c.width  = img.naturalWidth  || img.width;
      c.height = img.naturalHeight || img.height;
      if (!c.width || !c.height) throw new Error('dimensão inválida');
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/png');
    } catch (_) { }

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
            cacheDataUrl = dUrl; cacheOrigem = 'oficial'; cachePath = path;
            console.info(`[OmniLogo] ✅ Via OmniLicit: ${path}`);
            return cacheDataUrl;
          }
        } catch (_) { }
      }
    }

    // 2) Tenta cada candidato localmente
    for (const path of CANDIDATOS) {
      const dUrl = await tentarUrl(path);
      if (dUrl && dUrl.length > 100) {
        cacheDataUrl = dUrl; cacheOrigem = 'oficial'; cachePath = path;
        console.info(`[OmniLogo] ✅ Logo encontrada: ${path}`);
        return cacheDataUrl;
      }
    }

    // 3) Fallback SVG (escudo OmniLicit)
    console.warn(
      '[OmniLogo] ⚠️ Arquivo de logo não encontrado — usando escudo SVG.\n' +
      'Para usar sua logo, coloque um arquivo na RAIZ com um destes nomes:\n' +
      CANDIDATOS.slice(0, 6).map(p => '  • ' + p).join('\n') +
      '\nDepois faça: git add <arquivo> && git commit -m "logo" && git push'
    );
    cacheDataUrl = await svgToPngDataUrl(FALLBACK_SVG);
    cacheOrigem  = 'fallback';
    cachePath    = null;
    return cacheDataUrl;
  }

  function get()    { return cacheDataUrl; }
  function origem() { return cacheOrigem; }
  function path()   { return cachePath; }
  function set(d, o = 'manual') { cacheDataUrl = d; cacheOrigem = o; }
  function clear()  { cacheDataUrl = null; cacheOrigem = 'none'; cachePath = null; }

  return { load, get, origem, path, set, clear, CANDIDATOS };
})();

window.OmniLogo = OmniLogo;
