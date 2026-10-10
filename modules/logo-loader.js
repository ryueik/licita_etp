/* =====================================================================
   OMNILICIT · Logo Loader v6.0 — Simplificado
   ----------------------------------------------------------------
   ✅ Prioridade: 'logo-omnlicit.png' (nome oficial do repositório)
   ✅ Fallback:   'logo.png' (nome genérico)
   ✅ Último recurso: SVG inline (escudo OmniLicit)
   ===================================================================== */
'use strict';

const OmniLogo = (() => {

  /* ---------------------------------------------------------------------
     LISTA DE BUSCA — apenas os nomes reais do projeto
     --------------------------------------------------------------------- */
  const CANDIDATOS = [
    'logo-omnlicit.png',    // ← nome oficial (pasta raiz)
    'logo.png',             // fallback genérico
  ];

  /* ---------------------------------------------------------------------
     FALLBACK SVG — Escudo OmniLicit (nunca fica sem logo)
     --------------------------------------------------------------------- */
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
  <g transform="translate(30, 20)">
    <path d="M85 5 L15 40 L5 95 L15 155 L85 205 L155 155 L165 95 L155 40 Z"
          fill="url(#omniGrad)"/>
    <path d="M85 25 L30 52 L22 96 L30 145 L85 185 L140 145 L148 96 L140 52 Z"
          fill="none" stroke="#FFFFFF" stroke-width="2.5" opacity="0.35"/>
    <path d="M85 35 L80 60 L74 105 L74 165 L85 178 L96 165 L96 105 L90 60 Z"
          fill="#FFFFFF" opacity="0.95"/>
    <line x1="85" y1="65" x2="85" y2="160" stroke="url(#omniGrad2)" stroke-width="2.5"/>
    <path d="M60 80 L40 100 L50 140 L70 130 Z" fill="#FFFFFF" opacity="0.20"/>
    <path d="M110 80 L130 100 L120 140 L100 130 Z" fill="#FFFFFF" opacity="0.20"/>
  </g>
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

  /* ---------------------------------------------------------------------
     ESTADO INTERNO
     --------------------------------------------------------------------- */
  let cacheDataUrl = null;
  let cacheOrigem  = 'none';   // 'oficial' | 'fallback' | 'manual' | 'none'
  let cachePath    = null;     // ex.: 'logo-omnlicit.png'
  let cachePromessa = null;

  /* ---------------------------------------------------------------------
     HELPERS
     --------------------------------------------------------------------- */
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
    // Camada 1: fetch
    try {
      const resp = await fetch(url, { cache: 'force-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();
      if (!blob.type.startsWith('image/') && blob.size < 100) {
        throw new Error('resposta não é imagem');
      }
      const dUrl = await fileToDataUrl(blob);
      if (dUrl && dUrl.length > 100) return { dataUrl: dUrl, via: 'fetch' };
    } catch (_) { }

    // Camada 2: <img> + <canvas>
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((res, rej) => {
        img.onload  = res;
        img.onerror = () => rej(new Error('img.onerror'));
        img.src = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
      });
      const w = img.naturalWidth  || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) throw new Error('dimensão inválida');
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0);
      const dUrl = c.toDataURL('image/png');
      if (dUrl && dUrl.length > 100) return { dataUrl: dUrl, via: 'img+canvas' };
    } catch (_) { }

    return null;
  }

  /* ---------------------------------------------------------------------
     LOAD
     --------------------------------------------------------------------- */
  async function load() {
    if (cacheDataUrl) return cacheDataUrl;
    if (cachePromessa) return cachePromessa;

    cachePromessa = (async () => {

      /* 1) Tenta cada candidato */
      for (const path of CANDIDATOS) {
        const resultado = await tentarUrl(path);
        if (resultado) {
          cacheDataUrl = resultado.dataUrl;
          cacheOrigem  = 'oficial';
          cachePath    = path;
          console.info(`[OmniLogo] ✅ Logo carregada → ${path} (via ${resultado.via})`);
          return cacheDataUrl;
        }
      }

      /* 2) Fallback SVG */
      console.warn(
        '[OmniLogo] ⚠️  Logo não encontrada — usando escudo SVG inline.\n' +
        'Para usar sua logo, coloque o arquivo na raiz do projeto:\n' +
        '    • ' + CANDIDATOS[0] + '\n' +
        '  Depois: git add ' + CANDIDATOS[0] + ' && git commit -m "add logo" && git push'
      );
      cacheDataUrl = await svgToPngDataUrl(FALLBACK_SVG);
      cacheOrigem  = 'fallback';
      cachePath    = null;
      return cacheDataUrl;

    })();

    try {
      return await cachePromessa;
    } finally {
      cachePromessa = null;
    }
  }

  /* ---------------------------------------------------------------------
     API PÚBLICA
     --------------------------------------------------------------------- */
  function get()    { return cacheDataUrl; }
  function origem() { return cacheOrigem; }
  function path()   { return cachePath; }
  function set(dUrl, o = 'manual') { cacheDataUrl = dUrl; cacheOrigem = o; cachePath = null; }
  function clear()  { cacheDataUrl = null; cacheOrigem = 'none'; cachePath = null; cachePromessa = null; }

  /* ---------------------------------------------------------------------
     DIAGNÓSTICO
     --------------------------------------------------------------------- */
  async function diagnostico() {
    console.group('[OmniLogo] Diagnóstico');
    console.log('Candidatos:', CANDIDATOS);
    console.log('Origem    :', cacheOrigem);
    console.log('Path      :', cachePath);
    console.log('dataURL   :', cacheDataUrl ? cacheDataUrl.slice(0, 80) + '…' : '(vazio)');

    const resultados = [];
    for (const path of CANDIDATOS) {
      const r = await tentarUrl(path);
      resultados.push({ path, existe: !!r, via: r?.via || '—' });
    }
    console.table(resultados);
    console.groupEnd();
    return resultados;
  }

  return { load, get, origem, path, set, clear, diagnostico, CANDIDATOS };
})();

window.OmniLogo = OmniLogo;
