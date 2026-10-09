/* =====================================================================
   LICITAETP v2.2 — NÚCLEO COMPLETO
   Estudo Técnico Preliminar · Lei nº 14.133/2021
   Parser de DFD robusto por âncoras · Sanitização · Fallback JSON
   ===================================================================== */
'use strict';

/* =====================================================================
   0. HELPERS GERAIS
   ===================================================================== */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

/* =====================================================================
   1. LOGO / FAVICON SVG — FUNDO VERDE + LETRAS BRANCAS
   ===================================================================== */
const SVG_LOGO = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="etpGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10B981"/>
      <stop offset="1" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#etpGrad)"/>
  <text x="32" y="43"
        font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="26" font-weight="900"
        fill="#FFFFFF" text-anchor="middle"
        letter-spacing="0.5">ETP</text>
</svg>`.trim();

const svgToDataUrl = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

const svgToPngDataUrl = (svg, size = 256) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    c.getContext('2d').drawImage(img, 0, 0, size, size);
    resolve(c.toDataURL('image/png'));
  };
  img.onerror = reject;
  img.src = svgToDataUrl(svg);
});

function injetarIdentidadeVisual(){
  const link = document.getElementById('favicon');
  if (link) link.href = svgToDataUrl(SVG_LOGO);
  const brand = document.getElementById('brandLogo');
  if (brand) brand.innerHTML = SVG_LOGO;
  const w = document.getElementById('welcomeLogo');
  if (w) w.innerHTML = SVG_LOGO;
}

/* =====================================================================
   2. TEMA DARK / LIGHT
   ===================================================================== */
const TEMA_KEY = 'licitaetp_theme';

function lerTemaSalvo(){
  try {
    const t = localStorage.getItem(TEMA_KEY);
    if (t === 'light' || t === 'dark') return t;
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch(e){}
  return 'light';
}

function aplicarTema(tema){
  document.documentElement.setAttribute('data-theme', tema);
  const sun = document.getElementById('iconSun');
  const moon = document.getElementById('iconMoon');
  if (!sun || !moon) return;
  if (tema === 'dark'){ sun.style.display = 'block'; moon.style.display = 'none'; }
  else { sun.style.display = 'none'; moon.style.display = 'block'; }
}

function alternarTema(){
  const atual = document.documentElement.getAttribute('data-theme') || 'light';
  const novo = atual === 'dark' ? 'light' : 'dark';
  aplicarTema(novo);
  try { localStorage.setItem(TEMA_KEY, novo); } catch(e){}
  toast(`Tema alterado para ${novo === 'dark' ? 'escuro' : 'claro'}.`);
}

/* =====================================================================
   3. NUMERAÇÃO DINÂMICA DO ETP
   ===================================================================== */
const ETP_COUNTER_KEY = 'licitaetp_counter';

function obterProximoNumeroETP(exercicio){
  const ex = String(exercicio || new Date().getFullYear());
  let counters = {};
  try { counters = JSON.parse(localStorage.getItem(ETP_COUNTER_KEY) || '{}'); } catch(e){}
  const atual = parseInt(counters[ex] || '0', 10);
  return { proximo: atual + 1, counters, ex };
}

function consumirNumeroETP(exercicio){
  const { proximo, counters, ex } = obterProximoNumeroETP(exercicio);
  counters[ex] = proximo;
  try { localStorage.setItem(ETP_COUNTER_KEY, JSON.stringify(counters)); } catch(e){}
  return String(proximo).padStart(3, '0');
}

function preencherNumeroETPInicial(){
  const exEl = document.getElementById('exercicio');
  const numEl = document.getElementById('numeroEtp');
  if (!exEl || !numEl) return;

  if (!exEl.value) exEl.value = String(new Date().getFullYear());
  if (numEl.value && numEl.value !== '042') return;
  if (numEl.dataset.userEdited === '1') return;

  const { proximo } = obterProximoNumeroETP(exEl.value);
  numEl.value = String(proximo).padStart(3, '0');
  numEl.placeholder = String(proximo).padStart(3, '0');
}

function marcarNumeroEditado(){
  const numEl = document.getElementById('numeroEtp');
  if (numEl) numEl.dataset.userEdited = '1';
}

/* =====================================================================
   4. MODAL DE BOAS-VINDAS
   ===================================================================== */
const WELCOME_KEY = 'licitaetp_welcome_dismissed';

function deveExibirWelcome(){
  try { return localStorage.getItem(WELCOME_KEY) !== '1'; }
  catch(e){ return true; }
}

function abrirWelcome(){
  const m = document.getElementById('welcomeModal');
  if (!m) return;
  m.classList.add('show');
  m.setAttribute('aria-hidden', 'false');
}

function fecharWelcome(){
  const cb = document.getElementById('welcomeDontShow');
  if (cb?.checked){
    try { localStorage.setItem(WELCOME_KEY, '1'); } catch(e){}
  }
  const m = document.getElementById('welcomeModal');
  m.classList.remove('show');
  m.setAttribute('aria-hidden', 'true');
}

function abrirAjuda(){
  const cb = document.getElementById('welcomeDontShow');
  if (cb) cb.checked = false;
  abrirWelcome();
}

/* =====================================================================
   5. ESTADO GLOBAL
   ===================================================================== */
let logoDataUrl   = null;
let logoPadraoPng = null;
let current = 0;
let panels = [];
let TOTAL  = 0;

/* =====================================================================
   6. NAVEGAÇÃO / WIZARD
   ===================================================================== */
const PASSOS = [
  { t:'Identificação do ETP',        s:'Dados institucionais e objeto' },
  { t:'I · Necessidade',             s:'Problema a ser resolvido' },
  { t:'II · Alinhamento ao PCA',     s:'Plano de Contratações Anual' },
  { t:'III · Requisitos',            s:'Sustentabilidade e padrões' },
  { t:'IV · Quantidades',            s:'Memória de cálculo' },
  { t:'V · Levantamento de mercado', s:'Alternativas e riscos' },
  { t:'VI · Estimativa de preços',   s:'Método de cotação' },
  { t:'VII · Solução como um todo',  s:'Descrição integrada' },
  { t:'VIII · Parcelamento',         s:'Justificativa técnica' },
  { t:'IX · Resultados pretendidos', s:'Economicidade' },
  { t:'X · Providências prévias',    s:'Contratações correlatas' },
  { t:'XI · Posicionamento',         s:'Conclusão e viabilidade' },
  { t:'Aprovadores',                 s:'Elaboradores e validadores' }
];

function renderNav(){
  const nav = document.getElementById('stepNav');
  if (!nav) return;
  nav.innerHTML = PASSOS.map((p, i) => `
    <button class="step ${i === current ? 'active' : ''} ${i < current ? 'done' : ''}" onclick="goTo(${i})">
      <span class="step-num">${i < current ? '✓' : i + 1}</span>
      <span>
        <span class="step-title" style="display:block">${esc(p.t)}</span>
        <span class="step-sub" style="display:block">${esc(p.s)}</span>
      </span>
    </button>`).join('');
}

function goTo(i){
  if (i < 0 || i >= TOTAL) return;
  current = i;
  panels.forEach((p, idx) => p.classList.toggle('hidden', idx !== current));
  renderNav();
  const counter = document.getElementById('stepCounter');
  if (counter) counter.textContent = `${current + 1} / ${TOTAL}`;
  const bar = document.getElementById('progressBar');
  if (bar) bar.style.width = `${((current + 1) / TOTAL) * 100}%`;
  const btnV = document.getElementById('btnVoltar');
  const btnP = document.getElementById('btnProximo');
  const btnG = document.getElementById('btnGerar');
  if (btnV) btnV.disabled = current === 0;
  if (btnP) btnP.classList.toggle('hidden', current === TOTAL - 1);
  if (btnG) btnG.classList.toggle('hidden', current !== TOTAL - 1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* =====================================================================
   7. LINHAS DINÂMICAS
   ===================================================================== */
function addQtd(d = {}){
  const tb = document.getElementById('tbQtd');
  if (!tb) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="inp" data-k="item" value="${esc(d.item||'')}" placeholder="1"></td>
    <td><input class="inp" data-k="descricao" value="${esc(d.descricao||'')}" placeholder="Descrição do bem/serviço"></td>
    <td><input class="inp" data-k="quantidade" type="number" step="any" value="${esc(d.quantidade||'')}" placeholder="0"></td>
    <td><input class="inp" data-k="unidade" value="${esc(d.unidade||'')}" placeholder="un"></td>
    <td><textarea class="ta ta-sm" data-k="memoria" placeholder="Fórmula / fonte do quantitativo">${esc(d.memoria||'')}</textarea></td>
    <td style="text-align:center"><button class="btn-xs" onclick="this.closest('tr').remove();recalcularTotal()">×</button></td>`;
  tb.appendChild(tr);
}

function addMercado(d = {}){
  const tb = document.getElementById('tbMercado');
  if (!tb) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="inp" data-k="alternativa" value="${esc(d.alternativa||'')}" placeholder="Ex.: Aquisição direta"></td>
    <td><textarea class="ta ta-sm" data-k="descricao" placeholder="Como resolve o problema">${esc(d.descricao||'')}</textarea></td>
    <td><textarea class="ta ta-sm" data-k="vantagens" placeholder="Vantagens técnicas e econômicas">${esc(d.vantagens||'')}</textarea></td>
    <td><textarea class="ta ta-sm" data-k="riscos" placeholder="Riscos e limitações">${esc(d.riscos||'')}</textarea></td>
    <td style="text-align:center"><button class="btn-xs" onclick="this.closest('tr').remove()">×</button></td>`;
  tb.appendChild(tr);
}

function addPreco(d = {}){
  const tb = document.getElementById('tbPreco');
  if (!tb) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="inp" data-k="item" value="${esc(d.item||'')}" placeholder="Item / descrição"></td>
    <td><input class="inp" data-k="fonte" value="${esc(d.fonte||'')}" placeholder="Fornecedor / Painel de Preços"></td>
    <td><input class="inp" data-k="unitario" type="number" step="0.01" value="${esc(d.unitario||'')}" placeholder="0,00"></td>
    <td><input class="inp" data-k="quantidade" type="number" step="any" value="${esc(d.quantidade||'')}" placeholder="0"></td>
    <td><input class="inp" data-k="total" readonly style="background:var(--bg-3)"></td>
    <td style="text-align:center"><button class="btn-xs" onclick="this.closest('tr').remove();recalcularTotal()">×</button></td>`;
  tb.appendChild(tr);
  tr.querySelectorAll('input').forEach(i => i.addEventListener('input', recalcularTotal));
}

function addAprovador(d = {}){
  const lst = document.getElementById('listaAprovadores');
  if (!lst) return;
  const div = document.createElement('div');
  div.className = 'aprov-card';
  div.innerHTML = `
    <div class="aprov-card-head">
      <span class="aprov-card-title">Agente institucional</span>
      <button class="btn-xs" onclick="this.closest('.aprov-card').remove()">×</button>
    </div>
    <div class="aprov-grid">
      <div style="grid-column:span 2">
        <label class="lbl">Nome completo</label>
        <input class="inp" data-a="nome" value="${esc(d.nome||'')}" placeholder="Nome do agente">
      </div>
      <div>
        <label class="lbl">Papel</label>
        <select class="sel" data-a="papel">
          ${['Elaborador','Validador','Aprovador','Autoridade Competente','Fiscal Técnico']
            .map(p => `<option ${d.papel===p?'selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="lbl">Cargo / Função</label>
        <input class="inp" data-a="cargo" value="${esc(d.cargo||'')}" placeholder="Ex.: Diretor de Administração">
      </div>
      <div style="grid-column:span 2">
        <label class="lbl">Órgão / Unidade</label>
        <input class="inp" data-a="orgao" value="${esc(d.orgao||'')}" placeholder="Ex.: Coordenação-Geral de Logística">
      </div>
      <div style="grid-column:span 2">
        <label class="lbl">Matrícula / Identificador funcional</label>
        <input class="inp" data-a="matricula" value="${esc(d.matricula||'')}" placeholder="Opcional">
      </div>
    </div>`;
  lst.appendChild(div);
}

function recalcularTotal(){
  let soma = 0;
  $$('#tbPreco tr').forEach(tr => {
    const u = parseFloat(tr.querySelector('[data-k="unitario"]')?.value) || 0;
    const q = parseFloat(tr.querySelector('[data-k="quantidade"]')?.value) || 0;
    const t = u * q;
    const cell = tr.querySelector('[data-k="total"]');
    if (cell) cell.value = t ? t.toFixed(2) : '';
    soma += t;
  });
  const el = document.getElementById('valorTotal');
  if (el) el.textContent = soma.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  return soma;
}

/* =====================================================================
   8. COLETA DE DADOS
   ===================================================================== */
function readTable(tbodyId, keys){
  const tb = document.getElementById(tbodyId);
  if (!tb) return [];
  return $$(`#${tbodyId} tr`).map(tr => {
    const o = {};
    keys.forEach(k => {
      const el = tr.querySelector(`[data-k="${k}"]`);
      o[k] = el ? el.value.trim() : '';
    });
    return o;
  }).filter(o => Object.values(o).some(v => v));
}

function coletarDados(){
  const v = id => (document.getElementById(id)?.value || '').trim();
  const checks = name => $$(`input[name="${name}"]:checked`).map(i => i.value);
  return {
    id: {
      orgao: v('orgao'), unidade: v('unidade'), uasg: v('uasg'),
      processo: v('processo'), numero: v('numeroEtp'), exercicio: v('exercicio'),
      objeto: v('objeto'), responsavel: v('responsavel'), cargo: v('cargoResponsavel'),
      email: v('email'), telefone: v('telefone'), data: v('dataElaboracao')
    },
    nec: { necessidade: v('necessidade'), causaRaiz: v('causaRaiz'), publicoAlvo: v('publicoAlvo') },
    pca: { previsto: v('pcaPrevisto'), item: v('pcaItem'), justificativa: v('pcaJustificativa') },
    req: {
      sustentaveis: checks('sustent'), tecnicos: v('reqTecnicos'),
      habilitacao: v('reqHabilitacao'), garantia: v('reqGarantia'), entrega: v('reqEntrega')
    },
    qtd: { itens: readTable('tbQtd', ['item','descricao','quantidade','unidade','memoria']), metodo: v('metodoQtd') },
    mercado: { alternativas: readTable('tbMercado', ['alternativa','descricao','vantagens','riscos']), conclusao: v('conclusaoMercado') },
    precos: {
      metodo: v('metodoPreco'), itens: readTable('tbPreco', ['item','fonte','unitario','quantidade','total']),
      observacoes: v('obsPreco'), total: recalcularTotal()
    },
    solucao: { descricao: v('descricaoSolucao'), entregas: v('entregas'), ciclo: v('cicloVida') },
    parcel: { decisao: v('parcelar'), itens: v('itensParcelaveis'), justificativa: v('justificativaParcelamento') },
    result: { resultados: v('resultados'), economicidade: v('economicidade'), indicadores: v('indicadores') },
    prov: { providencias: v('providencias'), correlatas: v('correlatas'), impacto: v('impactoProvidencias') },
    conc: { posicionamento: v('posicionamento'), recomendacoes: v('recomendacoes'), conclusao: v('conclusao') },
    aprov: $$('#listaAprovadores > .aprov-card').map(div => {
      const g = k => div.querySelector(`[data-a="${k}"]`)?.value.trim() || '';
      return { nome: g('nome'), papel: g('papel'), cargo: g('cargo'), orgao: g('orgao'), matricula: g('matricula') };
    }).filter(a => a.nome || a.cargo)
  };
}

/* =====================================================================
   9. CONFORMIDADE
   ===================================================================== */
const INCISOS = [
  { n:'I',    t:'Descrição da necessidade',           f:d => [d.nec.necessidade, d.nec.causaRaiz, d.nec.publicoAlvo] },
  { n:'II',   t:'Alinhamento ao PCA',                 f:d => [d.pca.previsto, d.pca.item, d.pca.justificativa] },
  { n:'III',  t:'Requisitos da contratação',          f:d => [d.req.sustentaveis.join(' '), d.req.tecnicos, d.req.habilitacao, d.req.garantia, d.req.entrega] },
  { n:'IV',   t:'Quantidades e memória de cálculo',   f:d => [d.qtd.metodo, d.qtd.itens.map(i => JSON.stringify(i)).join(' ')] },
  { n:'V',    t:'Levantamento de mercado',            f:d => [d.mercado.conclusao, d.mercado.alternativas.map(i => JSON.stringify(i)).join(' ')] },
  { n:'VI',   t:'Estimativa preliminar de preços',    f:d => [d.precos.metodo, d.precos.observacoes, d.precos.itens.map(i => JSON.stringify(i)).join(' ')] },
  { n:'VII',  t:'Descrição da solução como um todo',  f:d => [d.solucao.descricao, d.solucao.entregas, d.solucao.ciclo] },
  { n:'VIII', t:'Justificativa para parcelamento',    f:d => [d.parcel.decisao, d.parcel.itens, d.parcel.justificativa] },
  { n:'IX',   t:'Resultados pretendidos',             f:d => [d.result.resultados, d.result.economicidade, d.result.indicadores] },
  { n:'X',    t:'Providências prévias',               f:d => [d.prov.providencias, d.prov.correlatas, d.prov.impacto] },
  { n:'XI',   t:'Posicionamento conclusivo',          f:d => [d.conc.posicionamento, d.conc.recomendacoes, d.conc.conclusao] }
];

function avaliarInciso(valores){
  const txt = valores.filter(Boolean).join(' ').trim();
  if (!txt)             return { status:'Não preenchido', pct:0,   cor:'#B91C1C', bg:'#FEF2F2' };
  if (txt.length < 140) return { status:'Parcial',        pct:50,  cor:'#B45309', bg:'#FFFBEB' };
  return                       { status:'Atendido',       pct:100, cor:'#15803D', bg:'#F0FDF4' };
}

function calcularConformidade(d){
  const linhas = INCISOS.map(i => ({ ...i, ...avaliarInciso(i.f(d)) }));
  const score = Math.round(linhas.reduce((a, l) => a + l.pct, 0) / linhas.length);
  return { linhas, score };
}

/* =====================================================================
   10. IMPORTAÇÃO DE DFD — PARSER ROBUSTO POR ÂNCORAS
   ===================================================================== */

/* -------- 10.1. CONSTANTES / HELPERS DE SANITIZAÇÃO -------- */

/** Remove ruído comum de PDFs (cabeçalhos, rodapés, numeração de página). */
const RUIDO_PDF = [
  /LicitaReq/gi,
  /LicitaAudit/gi,
  /LicitaETP/gi,
  /P[áa]gina\s+\d+\s*(?:de|\/)\s*\d+/gi,
  /^\s*\d+\s*\/\s*\d+\s*$/gm,
  /^\s*[-–—_=]{3,}\s*$/gm,
  /^\s*Sistema\s+de\s+[^\n]*$/gim,
  /Documento\s+gerado\s+eletronicamente[^\n]*/gi,
  /Emitido\s+em[^\n]*/gi
];

/** Limpeza geral de texto bruto do PDF. */
function sanitizarTextoPDF(txt){
  let t = String(txt || '').replace(/\r/g, '');
  RUIDO_PDF.forEach(rx => { t = t.replace(rx, ' '); });
  // Preserva quebras de linha significativas, mas normaliza espaços internos
  t = t.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
  return t;
}

/** Sanitiza um valor capturado por âncora: remove \n, espaços duplos e pontuação inicial. */
function limparValor(v){
  if (v == null) return '';
  return String(v)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s:;.\-–—_|]+/, '')
    .replace(/[\s:;.\-–—_|]+$/, '')
    .trim();
}

/** Remove "palavras soltas" que costumam aparecer após labels (ex.: "DEMANDA", "FUNÇÃO:"). */
function limparValorRotulo(v, palavrasRuido = []){
  let s = limparValor(v);
  for (const p of palavrasRuido){
    const rx = new RegExp(`^${p}\\b[\\s:;.\\-–—|]*`, 'i');
    s = s.replace(rx, '').trim();
  }
  return s;
}

/** Extrai um valor que aparece imediatamente DEPOIS de um rótulo,
 *  seja na mesma linha (`Rótulo: valor`) ou na linha seguinte. */
function extrairAposRotulo(texto, rotulos, opts = {}){
  const { maxLen = 400, pararEmRotulo = true, palavrasRuido = [] } = opts;

  // Monta regex alternando todos os rótulos possíveis
  const alt = rotulos.map(r => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

  // 1ª tentativa: valor na mesma linha após dois-pontos ou traço
  const rxInline = new RegExp(
    `(?:${alt})\\s*[:\\-–—]?\\s*([^\\n]{1,${maxLen}})`,
    'i'
  );
  let m = texto.match(rxInline);
  if (m && m[1] && limparValor(m[1])){
    let val = limparValor(m[1]);
    // Se o valor "vazou" para o próximo rótulo, corta
    if (pararEmRotulo){
      val = val.split(/\s{2,}(?=[A-ZÀ-Ú][a-zà-ú]+\s*:)/)[0];
    }
    val = limparValorRotulo(val, palavrasRuido);
    if (val) return val;
  }

  // 2ª tentativa: valor na linha seguinte (quando o rótulo termina em :)
  const rxLinha = new RegExp(
    `(?:${alt})\\s*[:\\-–—]\\s*\\n+\\s*([^\\n]{1,${maxLen}})`,
    'i'
  );
  m = texto.match(rxLinha);
  if (m && m[1]){
    let val = limparValor(m[1]);
    val = limparValorRotulo(val, palavrasRuido);
    if (val) return val;
  }

  return '';
}

/** Captura um bloco de texto entre um rótulo inicial e um rótulo final.
 *  Útil para Objeto, Justificativa, etc. */
function extrairBloco(texto, rotuloInicio, rotulosFim, opts = {}){
  const { maxLen = 4000 } = opts;
  const altFim = (rotulosFim || []).map(r => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

  const rx = altFim
    ? new RegExp(
        `${rotuloInicio}\\s*[:\\-–—]?\\s*([\\s\\S]{0,${maxLen}}?)(?=\\n\\s*(?:${altFim})\\s*[:\\-–—]|$)`,
        'i'
      )
    : new RegExp(
        `${rotuloInicio}\\s*[:\\-–—]?\\s*([\\s\\S]{0,${maxLen}})`,
        'i'
      );

  const m = texto.match(rx);
  if (!m || !m[1]) return '';
  return limparValor(m[1]).slice(0, maxLen);
}

/** Converte string monetária brasileira em número formatado (ex.: "165.000,00" → "165000.00"). */
function normalizarValorMonetario(valor){
  if (valor == null) return '';
  let v = String(valor).replace(/[^\d.,]/g, '');
  if (!v) return '';
  // Se tem vírgula e ponto: ponto é milhar, vírgula é decimal
  if (v.includes(',') && v.includes('.')){
    v = v.replace(/\./g, '').replace(',', '.');
  } else if (v.includes(',')){
    v = v.replace(',', '.');
  }
  const n = parseFloat(v);
  return isNaN(n) ? '' : n.toFixed(2);
}

/* -------- 10.2. FLUXO PRINCIPAL -------- */

let dfdExtraido = null;

function abrirImportarDFD(){
  const m = document.getElementById('dfdModal');
  if (!m) return;
  m.classList.add('show');
  m.setAttribute('aria-hidden', 'false');
  document.getElementById('dfdResult')?.classList.add('hidden');
  const btn = document.getElementById('dfdApplyBtn');
  if (btn) btn.disabled = true;
  dfdExtraido = null;
}

function fecharImportarDFD(){
  const m = document.getElementById('dfdModal');
  if (!m) return;
  m.classList.remove('show');
  m.setAttribute('aria-hidden', 'true');
}

async function processarDFD(file){
  try {
    const resultado = await extrairDadosDFD(file);
    dfdExtraido = resultado;

    const list = document.getElementById('dfdResultList');
    const msgEl = document.getElementById('dfdResultMsg');
    const resultBox = document.getElementById('dfdResult');
    const btn = document.getElementById('dfdApplyBtn');

    const campos = Object.entries(resultado.campos).filter(([_, v]) => v && String(v).trim());
    if (!campos.length){
      toast('Nenhum campo reconhecido no arquivo. Verifique o formato do DFD.');
      return;
    }

    msgEl.textContent = `${campos.length} campo(s) identificado(s) via ${resultado.origem.toUpperCase()}`;
    list.innerHTML = campos.map(([k, v]) => {
      const label = {
        numero:       'Nº do DFD',
        objeto:       'Objeto',
        unidade:      'Unidade Requisitante',
        responsavel:  'Responsável',
        cargo:        'Cargo / Função',
        email:        'E-mail',
        telefone:     'Telefone',
        valor:        'Valor Estimado',
        justificativa:'Justificativa',
        processo:     'Processo',
        orgao:        'Órgão',
        uasg:         'UASG'
      }[k] || k;
      const val = String(v).length > 140 ? String(v).slice(0, 137) + '…' : String(v);
      return `<li><span>${esc(label)}</span><span>${esc(val)}</span></li>`;
    }).join('');

    resultBox.classList.remove('hidden');
    btn.disabled = false;
  } catch(e){
    console.error('[DFD] Erro:', e);
    toast('Falha ao ler o DFD: ' + (e?.message || e));
  }
}

async function extrairDadosDFD(file){
  const nome = (file.name || '').toLowerCase();
  const tipo = (file.type || '').toLowerCase();

  // JSON (LicitaReq ou exportado)
  if (nome.endsWith('.json') || tipo.includes('json')){
    return extrairDFDJson(file);
  }
  // PDF
  if (nome.endsWith('.pdf') || tipo.includes('pdf')){
    return extrairDFDPdf(file);
  }
  throw new Error('Formato não suportado. Envie PDF ou JSON.');
}

/* -------- 10.3. PARSER JSON (FALLBACK LICITAREQ) -------- */

async function extrairDFDJson(file){
  const txt = await file.text();
  let raw;
  try { raw = JSON.parse(txt); }
  catch(e){ throw new Error('JSON inválido: ' + e.message); }

  // Aceita múltiplas formas: pacote do LicitaReq, DFD direto, aninhado em "dados", etc.
  const d = raw.dfd || raw.dados || raw.documento || raw.dfdData || raw;

  // Extrator resiliente por múltiplas chaves candidatas
  const pick = (...keys) => {
    for (const k of keys){
      const caminho = k.split('.');
      let cur = d;
      for (const c of caminho){
        if (cur == null) break;
        cur = cur[c];
      }
      if (cur != null && String(cur).trim() !== '') return String(cur).trim();
    }
    return '';
  };

  const campos = {
    numero:        pick('numero', 'numeroDFD', 'numero_dfd', 'numeroDfd', 'id', 'codigo'),
    objeto:        pick('objeto', 'objetoContratacao', 'objeto_contratacao', 'descricao', 'descricaoResumida', 'descricao_resumida'),
    unidade:       pick('unidade', 'unidadeRequisitante', 'unidade_requisitante', 'setor', 'departamento', 'setorRequisitante'),
    responsavel:   pick('responsavel', 'responsavelDemanda', 'responsavel_demanda', 'solicitante', 'nome', 'autor'),
    cargo:         pick('cargo', 'funcao', 'cargoFuncao', 'cargoResponsavel', 'cargo_responsavel', 'funcaoResponsavel'),
    email:         pick('email', 'emailInstitucional', 'email_institucional'),
    telefone:      pick('telefone', 'telefoneInstitucional', 'fone', 'ramal'),
    valor:         normalizarValorMonetario(pick('valor', 'valorEstimado', 'valor_estimado', 'valorTotal', 'valor_total', 'total')),
    justificativa: pick('justificativa', 'descricaoNecessidade', 'descricao_necessidade', 'necessidade', 'motivacao'),
    processo:      pick('processo', 'processoAdministrativo', 'processo_administrativo', 'numeroProcesso', 'numero_processo'),
    orgao:         pick('orgao', 'orgaoEntidade', 'orgao_entidade', 'entidade', 'instituicao'),
    uasg:          pick('uasg', 'codigoUasg', 'codigo_uasg')
  };

  // Aplica sanitização leve em strings
  Object.keys(campos).forEach(k => {
    if (typeof campos[k] === 'string') campos[k] = limparValor(campos[k]);
  });

  return { origem: 'json', campos, raw };
}

/* -------- 10.4. PARSER PDF (pdf.js + ÂNCORAS) -------- */

async function extrairDFDPdf(file){
  if (!window.pdfjsLib) throw new Error('Biblioteca pdf.js não disponível.');

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

  let textoCompleto = '';
  const totalPaginas = pdf.numPages;

  for (let i = 1; i <= totalPaginas; i++){
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Reconstrução de linhas por coordenada Y
    const itensPorLinha = new Map();
    content.items.forEach(item => {
      const y = Math.round(item.transform[5] / 2) * 2; // agrupa por proximidade
      if (!itensPorLinha.has(y)) itensPorLinha.set(y, []);
      itensPorLinha.get(y).push({
        x: item.transform[4],
        str: item.str
      });
    });

    // Ordena Y decrescente (topo → base) e X crescente (esq → dir)
    const ys = Array.from(itensPorLinha.keys()).sort((a,b) => b - a);
    ys.forEach(y => {
      const linha = itensPorLinha.get(y)
        .sort((a,b) => a.x - b.x)
        .map(it => it.str)
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (linha) textoCompleto += linha + '\n';
    });

    textoCompleto += '\n';
    // Marcador de página — permite ao parser cortar cabeçalhos/rodapés repetidos
    textoCompleto += `\n[[PAGINA_${i}_DE_${totalPaginas}]]\n`;
  }

  const textoLimpo = sanitizarTextoPDF(textoCompleto);
  const campos = extrairCamposDFD(textoLimpo);

  return { origem: 'pdf', campos, raw: textoLimpo };
}

/* -------- 10.5. EXTRAÇÃO POR ÂNCORAS -------- */

function extrairCamposDFD(texto){
  const t = texto;
  const campos = {};

  /* ---------- Nº do DFD ---------- */
  // Formatos aceitos: "DFD 001/2026", "DFD nº 042/2025", "Nº do DFD: 123/2026"
  {
    const rx = /(?:N[º°º]?\s*(?:do\s*)?DFD|DFD\s*n?[º°º]?)\s*[:\-–—]?\s*(\d{1,6}\s*\/\s*\d{2,4})/i;
    const m = t.match(rx);
    campos.numero = m ? limparValor(m[1]).replace(/\s*\/\s*/, '/') : '';
  }

  /* ---------- Processo Administrativo ---------- */
  {
    const rx = /Processo(?:\s+Administrativo)?\s*(?:n[º°º]?)?\s*[:\-–—]?\s*([\d]{2,6}[.\-–\/]?\d{2,6}[.\-–\/]?\d{2,8}(?:[.\-–\/]\d{2,6})?(?:[.\-–\/]\d{2,6})?)/i;
    const m = t.match(rx);
    campos.processo = m ? limparValor(m[1]) : '';
  }

  /* ---------- Objeto ---------- */
  // Bloco entre "Descrição Resumida do Objeto" (ou variantes) e próxima seção
  {
    const rotulosInicio = [
      'Descri[çc][ãa]o\\s+Resumida\\s+do\\s+Objeto',
      'Objeto\\s+da\\s+Contrata[çc][ãa]o',
      'Objeto\\s+da\\s+Demanda',
      'Objeto'
    ];
    const rotulosFim = [
      'Justificativa',
      'Unidade\\s+Requisitante',
      'Respons[áa]vel\\s+(?:pela\\s+)?Demanda',
      'Respons[áa]vel',
      'Valor\\s+Estimado',
      'Cargo\\s*\\/\\s*Fun[çc][ãa]o',
      'Cargo',
      'Prazo',
      'Data\\s+Limite',
      'Prioridade',
      'Item',
      'Quantidade',
      'Unidade\\s+de\\s+Medida'
    ];
    for (const rot of rotulosInicio){
      const bloco = extrairBloco(t, rot, rotulosFim, { maxLen: 1200 });
      if (bloco && bloco.length > 5){
        campos.objeto = bloco;
        break;
      }
    }
    if (!campos.objeto) campos.objeto = '';
  }

  /* ---------- Unidade Requisitante ---------- */
  {
    campos.unidade = extrairAposRotulo(t, [
      'Unidade\\s+Requisitante',
      'Unidade\\s+Demandante',
      'Setor\\s+Requisitante',
      'Setor\\s+Demandante',
      'Unidade\\s+Solicitante'
    ], {
      maxLen: 200,
      palavrasRuido: ['REQUISITANTE', 'DEMANDANTE', 'SOLICITANTE']
    });
  }

  /* ---------- Responsável pela Demanda ---------- */
  {
    campos.responsavel = extrairAposRotulo(t, [
      'Respons[áa]vel\\s+pela\\s+Demanda',
      'Respons[áa]vel\\s+da\\s+Demanda',
      'Respons[áa]vel\\s+T[ée]cnico',
      'Respons[áa]vel\\s+pela\\s+Elabora[çc][ãa]o',
      'Respons[áa]vel\\s+pel[oa]\\s+Solicita[çc][ãa]o',
      'Solicitante',
      'Respons[áa]vel'
    ], {
      maxLen: 160,
      palavrasRuido: ['DEMANDA', 'SOLICITAÇÃO', 'TÉCNICO', 'ELABORAÇÃO', 'PELA', 'DA', 'DO', 'DE']
    });

    // Filtro defensivo: descarta valores que sejam claramente rótulos genéricos
    if (/^(demanda|solicita[çc][ãa]o|t[ée]cnico|elabora[çc][ãa]o)$/i.test(campos.responsavel)){
      campos.responsavel = '';
    }
  }

  /* ---------- Cargo / Função ---------- */
  {
    campos.cargo = extrairAposRotulo(t, [
      'Cargo\\s*\\/\\s*Fun[çc][ãa]o',
      'Cargo\\s*e\\s*Fun[çc][ãa]o',
      'Fun[çc][ãa]o',
      'Cargo'
    ], {
      maxLen: 160,
      palavrasRuido: ['FUNÇÃO', 'CARGO', 'E', 'FUNÇAO']
    });
  }

  /* ---------- E-mail ---------- */
  {
    const m = t.match(/([\w._%+\-]+@[\w.\-]+\.[A-Za-z]{2,})/);
    campos.email = m ? limparValor(m[1]) : '';
  }

  /* ---------- Telefone ---------- */
  {
    const rx = /(?:Telefone|Tel|Fone|Ramal)\s*[:\-–—]?\s*(\(?\d{2}\)?\s*[\s\-]?\d{4,5}[\s\-]?\d{4})/i;
    const m = t.match(rx);
    campos.telefone = m ? limparValor(m[1]) : '';
  }

  /* ---------- Valor Estimado ---------- */
  {
    // Tenta primeiro com rótulo explícito
    let valor = extrairAposRotulo(t, [
      'Valor\\s+Total\\s+Estimado',
      'Valor\\s+Estimado',
      'Valor\\s+da\\s+Contrata[çc][ãa]o',
      'Valor\\s+Global',
      'Valor\\s+Previsto'
    ], { maxLen: 60 });

    // Se o rótulo capturou apenas "R$", busca o número na mesma linha
    if (!/\d/.test(valor)){
      const rx = /(?:Valor\s+(?:Total\s+)?Estimado|Valor\s+Global)[^\n]{0,40}?R?\$?\s*([\d]{1,3}(?:[.\s]\d{3})*(?:,\d{2})?|\d+(?:\.\d{2})?)/i;
      const m = t.match(rx);
      if (m) valor = m[1];
    }

    // Fallback: primeiro R$ seguido de valor no documento
    if (!valor || !/\d/.test(valor)){
      const m = t.match(/R\$\s*([\d]{1,3}(?:[.\s]\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{2})?)/);
      if (m) valor = m[1];
    }

    // Fallback final: números com formato BR > 1000
    if (!valor || !/\d/.test(valor)){
      const m = t.match(/\b(\d{1,3}(?:\.\d{3})+,\d{2})\b/);
      if (m) valor = m[1];
    }

    campos.valor = normalizarValorMonetario(valor);
  }

  /* ---------- Justificativa ---------- */
  {
    const rotulosFim = [
      'Unidade\\s+Requisitante',
      'Respons[áa]vel',
      'Valor\\s+Estimado',
      'Cargo',
      'Prazo',
      'Item',
      'Prioridade',
      'Data\\s+Limite',
      'Servidores',
      'Quantidade'
    ];
    let just = extrairBloco(t, 'Justificativa(?:\\s+da\\s+Necessidade)?', rotulosFim, { maxLen: 2000 });
    if (!just){
      just = extrairBloco(t, 'Descri[çc][ãa]o\\s+da\\s+Necessidade', rotulosFim, { maxLen: 2000 });
    }
    if (!just){
      just = extrairBloco(t, 'Necessidade', rotulosFim, { maxLen: 2000 });
    }
    campos.justificativa = just;
  }

  /* ---------- Órgão / UASG ---------- */
  {
    campos.orgao = extrairAposRotulo(t, [
      '[ÓO]rg[ãa]o\\s*\\/\\s*Entidade',
      '[ÓO]rg[ãa]o',
      'Entidade'
    ], { maxLen: 180, palavrasRuido: ['ENTIDADE'] });

    campos.uasg = extrairAposRotulo(t, ['UASG'], { maxLen: 30 });
  }

  /* ---------- Limpeza final ---------- */
  Object.keys(campos).forEach(k => {
    if (typeof campos[k] === 'string') campos[k] = limparValor(campos[k]);
  });

  return campos;
}

/* -------- 10.6. APLICAÇÃO DOS CAMPOS NO ETP -------- */

function aplicarImportacaoDFD(){
  if (!dfdExtraido) return;
  const c = dfdExtraido.campos;
  const setV = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = String(v); };

  // Mapeamento DFD → ETP
  if (c.objeto)        setV('objeto', c.objeto);
  if (c.unidade)       setV('unidade', c.unidade);
  if (c.responsavel)   setV('responsavel', c.responsavel);
  if (c.cargo)         setV('cargoResponsavel', c.cargo);
  if (c.email)         setV('email', c.email);
  if (c.telefone)      setV('telefone', c.telefone);
  if (c.processo)      setV('processo', c.processo);
  if (c.justificativa) setV('necessidade', c.justificativa);
  if (c.orgao)         setV('orgao', c.orgao);
  if (c.uasg)          setV('uasg', c.uasg);

  // Referência do DFD na justificativa do PCA (só se vazio)
  if (c.numero){
    const justEl = document.getElementById('pcaJustificativa');
    if (justEl && !justEl.value){
      justEl.value = `Documento de Formalização da Demanda (DFD) nº ${c.numero} importado automaticamente.`;
    }
  }

  // Valor estimado → primeira linha de preços
  if (c.valor){
    const primeiro = document.querySelector('#tbPreco tr');
    if (primeiro){
      const itemEl  = primeiro.querySelector('[data-k="item"]');
      const fonteEl = primeiro.querySelector('[data-k="fonte"]');
      const unitEl  = primeiro.querySelector('[data-k="unitario"]');
      const qtdEl   = primeiro.querySelector('[data-k="quantidade"]');
      if (itemEl  && !itemEl.value)  itemEl.value  = c.objeto ? c.objeto.slice(0, 80) : 'Item importado do DFD';
      if (fonteEl && !fonteEl.value) fonteEl.value = 'Valor estimado — DFD';
      if (unitEl  && !unitEl.value)  unitEl.value  = c.valor;
      if (qtdEl   && !qtdEl.value)   qtdEl.value   = '1';
      recalcularTotal();
    }
  }

  const qtdAplicados = Object.keys(c).filter(k => c[k]).length;
  toast(`DFD importado · ${qtdAplicados} campo(s) aplicado(s).`);
  fecharImportarDFD();
  goTo(0);

  // Destaque visual nos campos preenchidos
  setTimeout(() => {
    ['objeto','unidade','responsavel','necessidade','cargoResponsavel','processo','orgao']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value){
          el.style.transition = 'box-shadow .4s';
          el.style.boxShadow = '0 0 0 3px rgba(16,185,129,.35)';
          setTimeout(() => el.style.boxShadow = '', 1400);
        }
      });
  }, 200);
}

/* =====================================================================
   11. HELPERS PDF
   ===================================================================== */
const BRAND = '#0F2F5B', BRAND2 = '#1E6F5C', MUTED = '#64748B', LINEC = '#CBD5E1';
const PAGE_MARGINS = [40, 45, 40, 50];

function txtBloco(t){
  if (!t || !String(t).trim()) return [{ text:'— não informado —', italics:true, color:'#94A3B8', fontSize:9.5 }];
  const lines = String(t).split('\n').map(l => l.trim()).filter(Boolean);
  const out = []; let ul = [];
  const flush = () => { if (ul.length){ out.push({ ul, fontSize:9.5, lineHeight:1.3, margin:[0,0,0,6], color:'#1E293B' }); ul = []; } };
  lines.forEach(l => {
    if (/^[-•*]\s+/.test(l)) ul.push(l.replace(/^[-•*]\s+/, ''));
    else { flush(); out.push({ text:l, fontSize:9.5, lineHeight:1.4, alignment:'justify', color:'#1E293B', margin:[0,0,0,6] }); }
  });
  flush();
  return out.length ? out : [{ text:'— não informado —', italics:true, color:'#94A3B8', fontSize:9.5 }];
}

const campo = (r, v) => ({ stack: [
  { text: r.toUpperCase(), fontSize:7.5, bold:true, color:BRAND2, characterSpacing:0.6, margin:[0,7,0,3] },
  ...txtBloco(v)
]});

const secao = (n, t, blocos) => ({ stack: [
  { table: { widths:['*'], body: [[{ text:`${n} — ${t}`, bold:true, fontSize:10, color:'#FFFFFF', fillColor:BRAND, margin:[8,6,8,6], characterSpacing:0.3 }]] },
    layout:'noBorders', margin:[0,12,0,7] },
  ...blocos
]});

function tabelaDados(header, rows, widths){
  if (!rows.length) return { text:'— não informado —', italics:true, color:'#94A3B8', fontSize:9.5, margin:[0,2,0,8] };
  return {
    table: {
      headerRows: 1, widths,
      body: [
        header.map(h => ({ text:h, bold:true, fontSize:7.5, color:'#FFFFFF', fillColor:BRAND2, margin:[4,5,4,5] })),
        ...rows.map(r => r.map(c => ({ text:String(c ?? ''), fontSize:8.5, color:'#1E293B', margin:[4,4,4,4] })))
      ]
    },
    layout: { hLineWidth:()=>0.5, vLineWidth:()=>0.5, hLineColor:()=>LINEC, vLineColor:()=>LINEC,
              paddingLeft:()=>2, paddingRight:()=>2, paddingTop:()=>1, paddingBottom:()=>1 },
    margin: [0, 2, 0, 10]
  };
}

function barra(pct){
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return { table: { widths:[`${p}%`, `${100 - p}%`], body: [[
    { text:'', fillColor: p>=80?'#15803D':p>=50?'#B45309':'#B91C1C', border:[false,false,false,false], margin:[0,4,0,4] },
    { text:'', fillColor:'#E2E8F0', border:[false,false,false,false], margin:[0,4,0,4] }
  ]]}, layout:'noBorders' };
}

const moeda = n => Number(n || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const dataBR = iso => { if (!iso) return new Date().toLocaleDateString('pt-BR'); const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; };

/* =====================================================================
   12. BLOCOS DO PDF
   ===================================================================== */
function blocoCapa(d, conf, meta){
  const logoImg = logoDataUrl || logoPadraoPng;
  const logo = logoImg ? { image: logoImg, width: 78, alignment: 'center', margin: [0, 0, 0, 14] } : { text: '', margin: [0, 0, 0, 6] };
  const resumo = [
    ['Nº do ETP',             `${d.id.numero || '—'} / ${d.id.exercicio || '—'}`],
    ['Processo',              d.id.processo || '—'],
    ['Órgão / Unidade',       `${d.id.orgao || '—'}${d.id.unidade ? ' — ' + d.id.unidade : ''}`],
    ['Objeto',                d.id.objeto || '—'],
    ['Responsável técnico',   `${d.id.responsavel || '—'}${d.id.cargo ? ' — ' + d.id.cargo : ''}`],
    ['Valor total estimado',  moeda(d.precos.total)],
    ['Posicionamento',        d.conc.posicionamento || '—'],
    ['Score de conformidade', `${conf.score}% (${conf.linhas.filter(l => l.pct === 100).length}/${conf.linhas.length} incisos atendidos)`]
  ];
  return {
    stack: [
      { text:'', margin:[0,20,0,0] }, logo,
      { text: (d.id.orgao || 'ÓRGÃO / ENTIDADE').toUpperCase(), alignment:'center', bold:true, fontSize:13, color:BRAND, characterSpacing:0.5 },
      { text: d.id.unidade || '', alignment:'center', fontSize:9, color:MUTED, margin:[0,3,0,0] },
      { text: d.id.uasg ? `UASG ${d.id.uasg}` : '', alignment:'center', fontSize:8, color:MUTED, margin:[0,2,0,0] },
      { canvas: [{ type:'line', x1:150, y1:0, x2:365, y2:0, lineWidth:1.1, lineColor:BRAND2 }], margin:[0,12,0,16] },
      { text:'ESTUDO TÉCNICO PRELIMINAR', alignment:'center', bold:true, fontSize:19, color:BRAND, characterSpacing:1.2 },
      { text:'E T P', alignment:'center', bold:true, fontSize:11, color:BRAND2, characterSpacing:6, margin:[0,3,0,0] },
      { text:'Fundamentação legal: Lei nº 14.133/2021, art. 18, § 1º, incisos I a XI', alignment:'center', fontSize:8.5, color:MUTED, margin:[0,9,0,0] },
      { text:'Documento integrante da fase preparatória da contratação', alignment:'center', fontSize:8, italics:true, color:MUTED, margin:[0,2,0,0] },
      { text:'', margin:[0,16,0,0] },
      { table: { widths:[135,'*'], body: resumo.map(([k,v]) => [
        { text:k.toUpperCase(), fontSize:7.8, bold:true, color:BRAND2, fillColor:'#F8FAFC', margin:[8,6,8,6] },
        { text:String(v), fontSize:9, color:'#1E293B', margin:[8,6,8,6] }
      ])},
        layout:{ hLineWidth:()=>0.5, vLineWidth:()=>0.5, hLineColor:()=>LINEC, vLineColor:()=>LINEC,
                 paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0 } },
      { text:'', margin:[0,18,0,0] },
      { text:`Documento emitido eletronicamente em ${new Date().toLocaleString('pt-BR')} · TAG ${meta.tag}`,
        alignment:'center', fontSize:7, color:'#94A3B8' }
    ],
    pageBreak: 'after'
  };
}

function blocoNota(d){
  return { stack: [
    { text:'NOTA DE APRESENTAÇÃO INSTITUCIONAL', alignment:'center', bold:true, fontSize:13, color:BRAND, characterSpacing:0.8, margin:[0,40,0,4] },
    { text:'Termo de Abertura', alignment:'center', fontSize:9, color:MUTED, margin:[0,0,0,18] },
    { table: { widths:['*'], body: [[{ stack: [
      { text:'FINALIDADE LEGAL DO DOCUMENTO', fontSize:8, bold:true, color:BRAND2, characterSpacing:0.8, margin:[0,0,0,8] },
      { text:'O presente Estudo Técnico Preliminar (ETP) constitui documento constitutivo da fase preparatória da contratação, elaborado em observância ao disposto no art. 18, § 1º, da Lei nº 14.133/2021, e tem por finalidade:',
        fontSize:9.5, alignment:'justify', lineHeight:1.45, color:'#1E293B', margin:[0,0,0,8] },
      { ul: [
        'Caracterizar o interesse público e descrever a necessidade a ser atendida;',
        'Demonstrar a melhor solução dentre as alternativas de mercado analisadas;',
        'Fundamentar a estimativa de quantidades, de preços e a definição dos requisitos;',
        'Evidenciar os resultados pretendidos e os ganhos de economicidade;',
        'Subsidiar a elaboração do Termo de Referência ou Projeto Básico.'
      ], fontSize:9.5, lineHeight:1.4, color:'#1E293B', margin:[0,0,0,8] },
      { text:'A instrução processual observa, ainda, o disposto no art. 5º da Lei nº 14.133/2021, quanto aos princípios do planejamento, da transparência, da eficiência e da motivação dos atos administrativos, bem como o art. 11, que impõe a padronização e a rastreabilidade documental dos processos de contratação.',
        fontSize:9.5, alignment:'justify', lineHeight:1.45, color:'#1E293B', margin:[0,0,0,8] },
      { text:'O documento é rastreável e auditável, sendo identificado por TAG de autenticação exclusiva e hash de integridade SHA-256, aptos à validação automatizada por sistemas de auditoria (LicitaAudit).',
        fontSize:9.5, alignment:'justify', lineHeight:1.45, color:'#1E293B' }
    ], margin:[16,16,16,16] }]] },
      layout:{ hLineWidth:()=>1, vLineWidth:()=>1, hLineColor:()=>BRAND2, vLineColor:()=>BRAND2,
               paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0 } },
    { text:'', margin:[0,18,0,0] },
    { canvas: [{ type:'line', x1:60, y1:0, x2:455, y2:0, lineWidth:0.6, lineColor:LINEC }] },
    { text:`Processo administrativo nº ${d.id.processo || '—'} · ETP nº ${d.id.numero || '—'}/${d.id.exercicio || '—'}`,
      alignment:'center', fontSize:8, color:MUTED, margin:[0,10,0,0] }
  ], pageBreak: 'after' };
}

function blocoConformidade(d, conf, meta){
  const linhas = conf.linhas.map(l => [
    { text:l.n, bold:true, alignment:'center' }, l.t,
    { text:l.status, bold:true, color:l.cor, fillColor:l.bg, alignment:'center' },
    { text:`${l.pct}%`, alignment:'center', bold:true, color:l.cor }
  ]);
  return { stack: [
    { text:'PAINEL DE CONFORMIDADE ETP', bold:true, fontSize:12, color:BRAND, characterSpacing:0.8, margin:[0,6,0,2] },
    { text:'Estrutura de leitura automatizada — compatível com validação por sistemas de auditoria', fontSize:8.5, color:MUTED, margin:[0,0,0,12] },
    { table: { headerRows:1, widths:[38,'*',72,42], body: [
      [
        { text:'INCISO', bold:true, fontSize:7.5, color:'#FFF', fillColor:BRAND, alignment:'center', margin:[4,6,4,6] },
        { text:'REQUISITO LEGAL — ART. 18, § 1º, LEI 14.133/2021', bold:true, fontSize:7.5, color:'#FFF', fillColor:BRAND, margin:[4,6,4,6] },
        { text:'STATUS', bold:true, fontSize:7.5, color:'#FFF', fillColor:BRAND, alignment:'center', margin:[4,6,4,6] },
        { text:'SCORE', bold:true, fontSize:7.5, color:'#FFF', fillColor:BRAND, alignment:'center', margin:[4,6,4,6] }
      ], ...linhas ]},
      layout:{ hLineWidth:()=>0.5, vLineWidth:()=>0.5, hLineColor:()=>LINEC, vLineColor:()=>LINEC,
               paddingLeft:()=>5, paddingRight:()=>5, paddingTop:()=>5, paddingBottom:()=>5 } },
    { text:'', margin:[0,12,0,0] },
    { columns: [
      { width:'*', stack: [
        { text:'SCORE GLOBAL DE CONFORMIDADE', fontSize:7.5, bold:true, color:BRAND2, characterSpacing:0.6, margin:[0,0,0,5] },
        barra(conf.score),
        { text:`${conf.score}% de aderência aos incisos obrigatórios`, fontSize:8.5, color:'#334155', margin:[0,6,0,0] }
      ]},
      { width:110, stack: [
        { text:'TAG', fontSize:7.5, bold:true, color:BRAND2, characterSpacing:0.6, margin:[0,0,0,5] },
        { text: meta.tag, fontSize:8, bold:true, color:BRAND, alignment:'right' }
      ]}
    ]}
  ], pageBreak: 'after' };
}

function blocoCorpo(d){
  return { stack: [
    secao('I', 'DESCRIÇÃO DA NECESSIDADE', [
      campo('Problema a ser resolvido', d.nec.necessidade),
      campo('Causa-raiz', d.nec.causaRaiz),
      campo('Público-alvo / beneficiários', d.nec.publicoAlvo)
    ]),
    secao('II', 'ALINHAMENTO AO PCA', [
      campo('Previsão no PCA', d.pca.previsto),
      campo('Item / código do PCA', d.pca.item),
      campo('Justificativa do alinhamento', d.pca.justificativa)
    ]),
    secao('III', 'REQUISITOS DA CONTRATAÇÃO', [
      campo('Critérios de sustentabilidade', d.req.sustentaveis.length ? d.req.sustentaveis.map(s => '- ' + s).join('\n') : ''),
      campo('Requisitos técnicos e de desempenho', d.req.tecnicos),
      campo('Requisitos de habilitação técnica', d.req.habilitacao),
      campo('Garantia, assistência técnica e manutenção', d.req.garantia),
      campo('Embalagem, entrega e recebimento', d.req.entrega)
    ]),
    secao('IV', 'ESTIMATIVA DE QUANTIDADES E MEMÓRIA DE CÁLCULO', [
      tabelaDados(['ITEM','DESCRIÇÃO','QTD.','UN.','MEMÓRIA DE CÁLCULO'],
        d.qtd.itens.map(i => [i.item, i.descricao, i.quantidade, i.unidade, i.memoria]),
        [32,'*',40,34,'*']),
      campo('Metodologia da estimativa', d.qtd.metodo)
    ]),
    secao('V', 'LEVANTAMENTO DE MERCADO E ALTERNATIVAS', [
      tabelaDados(['ALTERNATIVA','DESCRIÇÃO','VANTAGENS','RISCOS'],
        d.mercado.alternativas.map(a => [a.alternativa, a.descricao, a.vantagens, a.riscos]),
        ['*','*','*','*']),
      campo('Conclusão do levantamento de mercado', d.mercado.conclusao)
    ]),
    secao('VI', 'ESTIMATIVA PRELIMINAR DE PREÇOS', [
      campo('Método de estimativa adotado', d.precos.metodo),
      tabelaDados(['ITEM','FONTE / FORNECEDOR','VALOR UNIT.','QTD.','TOTAL'],
        d.precos.itens.map(i => [i.item, i.fonte, moeda(i.unitario), i.quantidade, moeda(i.total)]),
        ['*','*',70,40,75]),
      { table: { widths:['*',150], body: [[
        { text:'VALOR TOTAL ESTIMADO DA CONTRATAÇÃO', bold:true, fontSize:9, color:BRAND, margin:[8,8,8,8], fillColor:'#F0FDF4' },
        { text: moeda(d.precos.total), bold:true, fontSize:11, color:'#15803D', alignment:'right', margin:[8,7,8,7], fillColor:'#F0FDF4' }
      ]]}, layout:{ hLineWidth:()=>0.5, vLineWidth:()=>0.5, hLineColor:()=>'#BBF7D0', vLineColor:()=>'#BBF7D0',
                    paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0 }, margin:[0,0,0,10] },
      campo('Observações sobre a estimativa', d.precos.observacoes)
    ]),
    secao('VII', 'DESCRIÇÃO DA SOLUÇÃO COMO UM TODO', [
      campo('Descrição integrada da solução', d.solucao.descricao),
      campo('Entregas e prazos', d.solucao.entregas),
      campo('Ciclo de vida e sustentabilidade', d.solucao.ciclo)
    ]),
    secao('VIII', 'JUSTIFICATIVA PARA PARCELAMENTO (OU NÃO)', [
      campo('Decisão sobre parcelamento', d.parcel.decisao),
      campo('Itens / lotes parceláveis', d.parcel.itens),
      campo('Fundamentação da decisão', d.parcel.justificativa)
    ]),
    secao('IX', 'RESULTADOS PRETENDIDOS', [
      campo('Resultados esperados', d.result.resultados),
      campo('Ganhos de economicidade', d.result.economicidade),
      campo('Indicadores de aferição', d.result.indicadores)
    ]),
    secao('X', 'PROVIDÊNCIAS PRÉVIAS E CONTRATAÇÕES CORRELATAS', [
      campo('Providências prévias ao certame', d.prov.providencias),
      campo('Contratações correlatas e interdependentes', d.prov.correlatas),
      campo('Impacto da não realização', d.prov.impacto)
    ]),
    secao('XI', 'POSICIONAMENTO CONCLUSIVO SOBRE A VIABILIDADE', [
      campo('Posicionamento', d.conc.posicionamento),
      campo('Recomendações e condicionantes', d.conc.recomendacoes),
      campo('Conclusão técnica fundamentada', d.conc.conclusao)
    ])
  ]};
}

function blocoAprovacao(d){
  const lista = d.aprov.length ? d.aprov
    : [{ nome:d.id.responsavel || '—', cargo:d.id.cargo || '—', orgao:d.id.unidade || d.id.orgao || '—', papel:'Elaborador' }];
  const rows = [];
  for (let i = 0; i < lista.length; i += 2){
    const par = lista.slice(i, i + 2);
    const cells = par.map(a => ({
      stack: [
        { text:(a.papel || 'AGENTE').toUpperCase(), fontSize:7.5, bold:true, color:BRAND2, characterSpacing:0.6, margin:[0,0,0,26] },
        { canvas:[{ type:'line', x1:0, y1:0, x2:215, y2:0, lineWidth:0.8, lineColor:'#94A3B8' }] },
        { text:a.nome || '—', bold:true, fontSize:9, color:'#0F172A', margin:[0,5,0,0] },
        { text:a.cargo || '—', fontSize:8, color:'#475569', margin:[0,1,0,0] },
        { text:a.orgao || '—', fontSize:7.5, color:MUTED, margin:[0,1,0,0] },
        a.matricula ? { text:`Matrícula: ${a.matricula}`, fontSize:7, color:'#94A3B8', margin:[0,2,0,0] } : { text:'' },
        { text:'Assinatura / Carimbo', fontSize:6.5, italics:true, color:'#94A3B8', margin:[0,4,0,0] }
      ], margin:[0,6,12,20]
    }));
    while (cells.length < 2) cells.push({ text:'' });
    rows.push(cells);
  }
  return { stack: [
    { text:'FOLHA DE APROVAÇÃO E VALIDAÇÃO', bold:true, fontSize:12, color:BRAND, characterSpacing:0.8, margin:[0,6,0,2] },
    { text:'Documento sujeito a manifestação dos agentes abaixo identificados', fontSize:8.5, color:MUTED, margin:[0,0,0,16] },
    { table:{ widths:['*','*'], body:rows }, layout:'noBorders', dontBreakRows:true, margin:[0,0,0,10] },
    { text:'', margin:[0,10,0,0] },
    { table: { widths:['*'], body: [[{ stack:[
      { text:'DECLARAÇÃO DE CIÊNCIA', fontSize:7.5, bold:true, color:BRAND2, characterSpacing:0.6, margin:[0,0,0,5] },
      { text:'Os agentes signatários declaram ter analisado o presente Estudo Técnico Preliminar e manifestam-se de acordo com o conteúdo técnico, a estimativa de quantidades, a estimativa de preços e o posicionamento conclusivo quanto à viabilidade da contratação, nos termos do art. 18 da Lei nº 14.133/2021.',
        fontSize:8.5, alignment:'justify', lineHeight:1.4, color:'#334155' }
    ], margin:[12,11,12,11] }]] },
      layout:{ hLineWidth:()=>0.5, vLineWidth:()=>0.5, hLineColor:()=>LINEC, vLineColor:()=>LINEC,
               paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0 } },
    { text:`${d.id.unidade || ''}${d.id.unidade && d.id.orgao ? ' — ' : ''}${d.id.orgao || ''}, ${dataBR(d.id.data)}.`,
      alignment:'right', fontSize:9, color:'#334155', margin:[0,22,0,0] }
  ], pageBreak:'before' };
}

function blocoAutenticacao(d, meta){
  const caixaLayout = {
    hLineWidth:()=>1.2, vLineWidth:()=>1.2, hLineColor:()=>BRAND, vLineColor:()=>BRAND,
    paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0
  };
  return { stack: [
    { text:'', margin:[0,40,0,0] },
    { text:'AUTENTICAÇÃO E RASTREABILIDADE', alignment:'center', bold:true, fontSize:13, color:BRAND, characterSpacing:1 },
    { text:'Documento eletrônico gerado pelo sistema LicitaETP', alignment:'center', fontSize:8.5, color:MUTED, margin:[0,4,0,22] },
    { table: { widths:['*'], body: [[{ stack: [
      { text:'SELO DIGITAL DO ESTUDO TÉCNICO PRELIMINAR', alignment:'center', fontSize:7.5, bold:true, color:BRAND2, characterSpacing:1, margin:[0,0,0,12] },
      { text: meta.tag, alignment:'center', fontSize:14, bold:true, color:BRAND, characterSpacing:1.4, margin:[0,0,0,10] },
      { canvas:[{ type:'line', x1:40, y1:0, x2:395, y2:0, lineWidth:0.6, lineColor:LINEC }], margin:[0,4,0,14] },
      { text:'HASH DE INTEGRIDADE — SHA-256', alignment:'center', fontSize:7, bold:true, color:BRAND2, characterSpacing:0.8, margin:[0,0,0,5] },
      { text: meta.hash, alignment:'center', fontSize:7.2, color:'#334155', characterSpacing:0.4, lineHeight:1.35, margin:[0,0,0,14] },
      { table: { widths:['*','*'], body: [
        [{ text:'EMITIDO EM', fontSize:6.8, bold:true, color:MUTED, alignment:'center', margin:[0,4,0,2] },
         { text:'EXERCÍCIO', fontSize:6.8, bold:true, color:MUTED, alignment:'center', margin:[0,4,0,2] }],
        [{ text:meta.emitidoEm, fontSize:8.5, bold:true, color:'#0F172A', alignment:'center', margin:[0,2,0,6] },
         { text:`${d.id.exercicio || '—'}`, fontSize:8.5, bold:true, color:'#0F172A', alignment:'center', margin:[0,2,0,6] }],
        [{ text:'Nº DO ETP', fontSize:6.8, bold:true, color:MUTED, alignment:'center', margin:[0,4,0,2] },
         { text:'PROCESSO', fontSize:6.8, bold:true, color:MUTED, alignment:'center', margin:[0,4,0,2] }],
        [{ text:`${d.id.numero || '—'}/${d.id.exercicio || '—'}`, fontSize:8.5, bold:true, color:'#0F172A', alignment:'center', margin:[0,2,0,6] },
         { text:d.id.processo || '—', fontSize:8.5, bold:true, color:'#0F172A', alignment:'center', margin:[0,2,0,6] }]
      ]}, layout:{ hLineWidth:()=>0.4, vLineWidth:()=>0.4, hLineColor:()=>'#E2E8F0', vLineColor:()=>'#E2E8F0',
                   paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0 } }
    ], margin:[22,20,22,20] }]] }, layout: caixaLayout },
    { text:'', margin:[0,16,0,0] },
    { table: { widths:['*'], body: [[{ stack: [
      { text:'AVISO DE AUDITORIA E INTEGRAÇÃO', fontSize:7.5, bold:true, color:'#92400E', characterSpacing:0.6, margin:[0,0,0,5] },
      { text:'Este documento é auditável eletronicamente. A autenticidade pode ser verificada pela conferência da TAG exclusiva e do hash SHA-256 junto ao repositório institucional ou ao módulo LicitaAudit. Qualquer alteração posterior de conteúdo invalida o hash registrado, caracterizando adulteração documental.',
        fontSize:8, alignment:'justify', lineHeight:1.4, color:'#78350F', margin:[0,0,0,6] },
      { text:'A ausência de assinatura física não prejudica a validade do ato, nos termos do art. 4º, incisos I e II, e do art. 5º da Lei nº 14.133/2021, e da MP nº 2.200-2/2001.',
        fontSize:7.5, italics:true, color:'#92400E' }
    ], margin:[12,11,12,11] }]] },
      layout:{ hLineWidth:()=>1, vLineWidth:()=>1, hLineColor:()=>'#FCD34D', vLineColor:()=>'#FCD34D',
               paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0 }, fillColor:'#FFFBEB' },
    { text:'', margin:[0,26,0,0] },
    { canvas:[{ type:'line', x1:100, y1:0, x2:415, y2:0, lineWidth:0.5, lineColor:LINEC }] },
    { text:'LicitaETP · Módulo de Estudo Técnico Preliminar · Padrão de auditoria LicitaAudit',
      alignment:'center', fontSize:7, color:'#94A3B8', margin:[0,8,0,0] },
    { text:'— FIM DO DOCUMENTO —', alignment:'center', fontSize:7, bold:true, color:'#94A3B8', characterSpacing:1, margin:[0,4,0,0] }
  ], pageBreak:'before' };
}

/* =====================================================================
   13. MONTAGEM FINAL DO PDF
   ===================================================================== */
function montarDocumento(d, conf, meta){
  return {
    pageSize: 'A4',
    pageMargins: PAGE_MARGINS,
    info: {
      title: `Estudo Técnico Preliminar nº ${d.id.numero || ''}/${d.id.exercicio || ''}`,
      author: d.id.orgao || 'LicitaETP',
      subject: 'ETP — Lei nº 14.133/2021, art. 18, § 1º',
      keywords: `ETP, Licitações, Lei 14.133/2021, ${meta.tag}`,
      creator: 'LicitaETP v2.2'
    },
    header: (cp, total) => {
      if (cp <= 3 || cp === total) return null;
      return {
        margin: [40, 18, 40, 0],
        columns: [
          { text: (d.id.orgao || '').toUpperCase(), fontSize:7, color:'#94A3B8', bold:true },
          { text: `ETP nº ${d.id.numero || '—'}/${d.id.exercicio || '—'}`, fontSize:7, color:'#94A3B8', alignment:'right' }
        ]
      };
    },
    footer: (cp, total) => {
      if (cp === 1) return null;
      return {
        margin: [40, 14, 40, 0],
        columns: [
          { text: `TAG ${meta.tag}`, fontSize:6.5, color:'#94A3B8' },
          { text: `Página ${cp} de ${total}`, fontSize:6.5, color:'#94A3B8', alignment:'right' }
        ]
      };
    },
    content: [
      blocoCapa(d, conf, meta),
      blocoNota(d),
      blocoConformidade(d, conf, meta),
      blocoCorpo(d),
      blocoAprovacao(d),
      blocoAutenticacao(d, meta)
    ],
    defaultStyle: { font: 'Roboto', fontSize: 9.5, color: '#1E293B' }
  };
}

/* =====================================================================
   14. UTILITÁRIOS — NOME, CÓDIGO, HASH
   ===================================================================== */
function nomeArquivo(){
  const raw = (document.getElementById('numeroEtp')?.value || '001');
  const num = (raw.replace(/^ETP[\s_\-:]*/i, '').match(/\d+/) || ['001'])[0].padStart(3, '0');
  const ex  = (document.getElementById('exercicio')?.value || '').match(/\d{4}/)?.[0] || String(new Date().getFullYear());
  return `ETP_${num}_${ex}.pdf`;
}

function gerarCodigo(){
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

async function sha256Hex(str){
  try {
    const buf = new TextEncoder().encode(str);
    const h = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  } catch(e){
    let h1 = 0x811c9dc5, h2 = 0x1000193;
    for (let i = 0; i < str.length; i++){
      h1 ^= str.charCodeAt(i); h1 = Math.imul(h1, 16777619) >>> 0;
      h2 = (Math.imul(h2 ^ str.charCodeAt(i), 2246822519) >>> 0);
    }
    const base = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).toUpperCase();
    return (base.repeat(4)).slice(0, 64);
  }
}

/* =====================================================================
   15. GERAÇÃO DO PDF
   ===================================================================== */
async function gerarPDF(){
  const d = coletarDados();
  if (!d.id.orgao || !d.id.objeto){
    toast('Preencha ao menos Órgão/Entidade e Objeto na etapa de Identificação.');
    goTo(0); return;
  }

  const conf = calcularConformidade(d);
  const exercicio = (d.id.exercicio || '').match(/\d{4}/)?.[0] || String(new Date().getFullYear());
  const tag = `LICITAETP::ETP::${gerarCodigo()}::${exercicio}`;
  const emitidoEm = new Date().toLocaleString('pt-BR');
  const hash = await sha256Hex(JSON.stringify({ etp:d, conformidade:conf.score, tag, emitidoEm }));
  const meta = { tag, hash, emitidoEm, exercicio };

  if (!d.id.numero || d.id.numero === '042' || !document.getElementById('numeroEtp').dataset.userEdited){
    const novo = consumirNumeroETP(exercicio);
    document.getElementById('numeroEtp').value = novo;
    d.id.numero = novo;
    meta.numeroConsumido = novo;
  }

  const doc = montarDocumento(d, conf, meta);
  const arquivo = nomeArquivo();

  pdfMake.createPdf(doc).download(arquivo, () => {
    toast(`PDF gerado: ${arquivo} · ${tag}`);
    console.info('[LicitaAudit] Payload de auditoria:', { tag, hash, arquivo, conformidade: conf.score, dados:d });
  });
}

/* =====================================================================
   16. EXPORTAR JSON DE AUDITORIA
   ===================================================================== */
async function exportarJSON(){
  const d = coletarDados();
  const conf = calcularConformidade(d);
  const exercicio = (d.id.exercicio || '').match(/\d{4}/)?.[0] || String(new Date().getFullYear());
  const tag = `LICITAETP::ETP::${gerarCodigo()}::${exercicio}`;
  const emitidoEm = new Date().toISOString();
  const hash = await sha256Hex(JSON.stringify({ etp:d, tag, emitidoEm }));
  const pacote = {
    sistema:'LicitaETP', versao:'2.2.0', trilha:'LICITAETP', tipo:'auditoria',
    tag, hash, emitidoEm,
    conformidade: { score:conf.score, incisos:conf.linhas.map(l => ({ inciso:l.n, status:l.status, pct:l.pct })) },
    etp:d
  };
  const blob = new Blob([JSON.stringify(pacote, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo().replace(/\.pdf$/, '_auditoria.json');
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Pacote JSON de auditoria exportado.');
}

/* =====================================================================
   17. SALVAR / CARREGAR RASCUNHO
   ===================================================================== */
function salvarRascunho(){
  try {
    const pacote = {
      sistema:'LicitaETP', versao:'2.2.0', tipo:'rascunho',
      salvoEm: new Date().toISOString(),
      logo: logoDataUrl,
      dados: coletarDados()
    };
    const json = JSON.stringify(pacote, null, 2);
    const blob = new Blob([json], { type:'application/json;charset=utf-8' });
    const numero = (document.getElementById('numeroEtp')?.value || '').replace(/\D/g, '').padStart(3,'0') || '001';
    const exercicio = (document.getElementById('exercicio')?.value || '').match(/\d{4}/)?.[0] || new Date().getFullYear();
    const arquivo = `ETP_${numero}_${exercicio}_rascunho.json`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = arquivo;
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`Rascunho salvo: ${arquivo}`);
  } catch(e){ console.error(e); toast('Falha ao salvar rascunho.'); }
}

function abrirCarregarRascunho(){
  document.getElementById('jsonFile')?.click();
}

async function processarArquivoJSON(file){
  try {
    const txt = await file.text();
    const pacote = JSON.parse(txt);
    const d = pacote.dados || pacote;
    aplicarDados(d);
    if (pacote.logo){
      logoDataUrl = pacote.logo;
      const img = document.getElementById('logoPreviewImg');
      if (img) img.src = pacote.logo;
      document.getElementById('logoDropzoneEmpty')?.classList.add('hidden');
      document.getElementById('logoDropzonePreview')?.classList.remove('hidden');
      document.getElementById('logoDropzone')?.classList.add('has-file');
      const nm = document.getElementById('logoPreviewName');
      const sz = document.getElementById('logoPreviewSize');
      if (nm) nm.textContent = 'logotipo-restaurado.png';
      if (sz) sz.textContent = '— restaurado do rascunho —';
    }
    toast(`Rascunho carregado · ${file.name}`);
  } catch(e){ console.error(e); toast('Arquivo JSON inválido ou corrompido.'); }
}

function aplicarDados(d){
  const setV = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };

  setV('orgao', d.id?.orgao); setV('uasg', d.id?.uasg); setV('unidade', d.id?.unidade);
  setV('exercicio', d.id?.exercicio); setV('numeroEtp', d.id?.numero);
  if (d.id?.numero) document.getElementById('numeroEtp').dataset.userEdited = '1';
  setV('processo', d.id?.processo); setV('dataElaboracao', d.id?.data);
  setV('objeto', d.id?.objeto); setV('responsavel', d.id?.responsavel);
  setV('cargoResponsavel', d.id?.cargo); setV('email', d.id?.email); setV('telefone', d.id?.telefone);

  setV('necessidade', d.nec?.necessidade); setV('causaRaiz', d.nec?.causaRaiz); setV('publicoAlvo', d.nec?.publicoAlvo);
  setV('pcaPrevisto', d.pca?.previsto); setV('pcaItem', d.pca?.item); setV('pcaJustificativa', d.pca?.justificativa);

  const sustSet = new Set(d.req?.sustentaveis || []);
  document.querySelectorAll('input[name="sustent"]').forEach(cb => { cb.checked = sustSet.has(cb.value); });
  setV('reqTecnicos', d.req?.tecnicos); setV('reqHabilitacao', d.req?.habilitacao);
  setV('reqGarantia', d.req?.garantia); setV('reqEntrega', d.req?.entrega);

  const tbQ = document.getElementById('tbQtd');
  if (tbQ){ tbQ.innerHTML = ''; (d.qtd?.itens || []).forEach(addQtd); if (!(d.qtd?.itens||[]).length) addQtd(); }
  setV('metodoQtd', d.qtd?.metodo);

  const tbM = document.getElementById('tbMercado');
  if (tbM){ tbM.innerHTML = ''; (d.mercado?.alternativas || []).forEach(addMercado); if (!(d.mercado?.alternativas||[]).length){ addMercado(); addMercado(); } }
  setV('conclusaoMercado', d.mercado?.conclusao);

  setV('metodoPreco', d.precos?.metodo);
  const tbP = document.getElementById('tbPreco');
  if (tbP){ tbP.innerHTML = ''; (d.precos?.itens || []).forEach(addPreco); if (!(d.precos?.itens||[]).length) addPreco(); }
  setV('obsPreco', d.precos?.observacoes);
  recalcularTotal();

  setV('descricaoSolucao', d.solucao?.descricao); setV('entregas', d.solucao?.entregas); setV('cicloVida', d.solucao?.ciclo);
  setV('parcelar', d.parcel?.decisao); setV('itensParcelaveis', d.parcel?.itens); setV('justificativaParcelamento', d.parcel?.justificativa);
  setV('resultados', d.result?.resultados); setV('economicidade', d.result?.economicidade); setV('indicadores', d.result?.indicadores);
  setV('providencias', d.prov?.providencias); setV('correlatas', d.prov?.correlatas); setV('impactoProvidencias', d.prov?.impacto);
  setV('posicionamento', d.conc?.posicionamento); setV('recomendacoes', d.conc?.recomendacoes); setV('conclusao', d.conc?.conclusao);

  const lst = document.getElementById('listaAprovadores');
  if (lst){ lst.innerHTML = ''; (d.aprov || []).forEach(addAprovador); if (!(d.aprov||[]).length) addAprovador({ papel:'Elaborador' }); }
}

/* =====================================================================
   18. DRAG & DROP — LOGOTIPO
   ===================================================================== */
function inicializarDropzoneLogo(){
  const dz = document.getElementById('logoDropzone');
  const input = document.getElementById('logoFile');
  if (!dz || !input) return;
  const empty = document.getElementById('logoDropzoneEmpty');
  const preview = document.getElementById('logoDropzonePreview');
  const img = document.getElementById('logoPreviewImg');
  const nameEl = document.getElementById('logoPreviewName');
  const sizeEl = document.getElementById('logoPreviewSize');
  const removeBtn = document.getElementById('logoRemoveBtn');

  dz.addEventListener('click', (e) => {
    if (e.target.closest('#logoRemoveBtn')) return;
    if (dz.classList.contains('has-file')) return;
    input.click();
  });

  ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation(); dz.classList.add('dragover');
  }));
  ['dragleave','dragend'].forEach(ev => dz.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation();
    if (!dz.contains(e.relatedTarget)) dz.classList.remove('dragover');
  }));
  dz.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation(); dz.classList.remove('dragover');
    const f = e.dataTransfer?.files?.[0]; if (f) processar(f);
  });
  input.addEventListener('change', e => {
    const f = e.target.files?.[0]; if (f) processar(f);
  });
  removeBtn?.addEventListener('click', e => {
    e.stopPropagation();
    logoDataUrl = null; input.value = '';
    preview?.classList.add('hidden'); empty?.classList.remove('hidden');
    dz.classList.remove('has-file');
    toast('Logotipo removido.');
  });

  async function processar(file){
    const MAX = 2*1024*1024;
    if (!file.type.startsWith('image/')){ toast('Formato inválido. Envie PNG, JPG ou SVG.'); return; }
    if (file.size > MAX){ toast('Arquivo excede 2 MB.'); return; }
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = ev => res(ev.target.result); r.onerror = rej; r.readAsDataURL(file);
      });
      logoDataUrl = dataUrl;
      if (img) img.src = dataUrl;
      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = fmt(file.size);
      empty?.classList.add('hidden'); preview?.classList.remove('hidden');
      dz.classList.add('has-file');
      toast(`Logotipo carregado: ${file.name}`);
    } catch(e){ console.error(e); toast('Falha ao ler o arquivo.'); }
  }
  function fmt(b){
    if (b < 1024) return b + ' B';
    if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
    return (b/1024/1024).toFixed(2) + ' MB';
  }
}

/* =====================================================================
   19. DRAG & DROP — DFD (MODAL)
   ===================================================================== */
function inicializarDropzoneDFD(){
  const dz = document.getElementById('dfdDropzone');
  const input = document.getElementById('dfdFile');
  if (!dz || !input) return;

  dz.addEventListener('click', () => input.click());
  ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation(); dz.classList.add('dragover');
  }));
  ['dragleave','dragend'].forEach(ev => dz.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation();
    if (!dz.contains(e.relatedTarget)) dz.classList.remove('dragover');
  }));
  dz.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation(); dz.classList.remove('dragover');
    const f = e.dataTransfer?.files?.[0]; if (f) processarDFD(f);
  });
  input.addEventListener('change', e => {
    const f = e.target.files?.[0]; if (f) processarDFD(f);
    e.target.value = '';
  });
}

/* =====================================================================
   20. TOAST
   ===================================================================== */
let toastTimer;
function toast(msg){
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
}

/* =====================================================================
   21. BOOTSTRAP
   ===================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  /* --- Tema --- */
  aplicarTema(lerTemaSalvo());

  /* --- Identidade visual --- */
  injetarIdentidadeVisual();

  /* --- Logo padrão em PNG --- */
  try { logoPadraoPng = await svgToPngDataUrl(SVG_LOGO, 256); }
  catch(e){ console.warn('Falha ao pré-renderizar logo padrão.', e); }

  /* --- Data padrão --- */
  const dtEl = document.getElementById('dataElaboracao');
  if (dtEl && !dtEl.value) dtEl.value = new Date().toISOString().slice(0, 10);

  /* --- Painéis --- */
  panels = $$('[data-panel]');
  TOTAL  = panels.length;

  /* --- Numeração dinâmica --- */
  preencherNumeroETPInicial();
  const numEl = document.getElementById('numeroEtp');
  numEl?.addEventListener('input', marcarNumeroEditado);
  const exEl = document.getElementById('exercicio');
  exEl?.addEventListener('change', () => {
    if (!document.getElementById('numeroEtp').dataset.userEdited) preencherNumeroETPInicial();
  });

  /* --- Dropzones --- */
  inicializarDropzoneLogo();
  inicializarDropzoneDFD();

  /* --- Carregar rascunho --- */
  document.getElementById('jsonFile')?.addEventListener('change', e => {
    const f = e.target.files?.[0]; if (f) processarArquivoJSON(f);
    e.target.value = '';
  });

  /* --- Linhas iniciais --- */
  addQtd();
  addMercado(); addMercado();
  addPreco();
  addAprovador({ papel: 'Elaborador' });

  /* --- Recálculo --- */
  document.addEventListener('input', e => {
    if (e.target.closest('#tbPreco')) recalcularTotal();
  });

  /* --- Fechar modais clicando no overlay / ESC --- */
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('.modal-overlay.show').forEach(m => m.classList.remove('show'));
  });

  /* --- Navegação --- */
  renderNav();
  goTo(0);

  /* --- Score em tempo real --- */
  setInterval(() => {
    const conf = calcularConformidade(coletarDados());
    const b = document.getElementById('scoreBadge');
    if (!b) return;
    b.textContent = `Conformidade ${conf.score}%`;
    if (conf.score >= 80){
      b.style.background = 'var(--ok-bg)'; b.style.color = 'var(--ok)'; b.style.borderColor = 'rgba(22,163,74,.35)';
    } else if (conf.score >= 50){
      b.style.background = 'var(--wa-bg)'; b.style.color = 'var(--wa)'; b.style.borderColor = 'rgba(217,119,6,.35)';
    } else {
      b.style.background = 'var(--er-bg)'; b.style.color = 'var(--er)'; b.style.borderColor = 'rgba(220,38,38,.35)';
    }
  }, 1200);

  /* --- Welcome modal --- */
  if (deveExibirWelcome()){
    setTimeout(abrirWelcome, 500);
  }
});

/* =====================================================================
   FIM — LicitaETP v2.2
   ===================================================================== */
