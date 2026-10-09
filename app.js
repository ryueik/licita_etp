/* =====================================================================
   LICITAETP v2.6 — NÚCLEO COMPLETO
   Estudo Técnico Preliminar · Lei nº 14.133/2021
   Parser DFD posicional + Captura de Logo + Delimitação Estrita
   + Anti-paginação + Integração de Metadados (enquadramento/prazos/governança)
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
   1. LOGO / FAVICON SVG
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
  <text x="32" y="43" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="26" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.5">ETP</text>
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
   2. TEMA
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
   3. NUMERAÇÃO ETP
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
   4. WELCOME
   ===================================================================== */
const WELCOME_KEY = 'licitaetp_welcome_dismissed';
function deveExibirWelcome(){
  try { return localStorage.getItem(WELCOME_KEY) !== '1'; } catch(e){ return true; }
}
function abrirWelcome(){
  const m = document.getElementById('welcomeModal');
  if (!m) return;
  m.classList.add('show');
  m.setAttribute('aria-hidden', 'false');
}
function fecharWelcome(){
  const cb = document.getElementById('welcomeDontShow');
  if (cb?.checked){ try { localStorage.setItem(WELCOME_KEY, '1'); } catch(e){} }
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
let logoOrigem    = 'default';
let logoPadraoPng = null;
let current = 0;
let panels = [];
let TOTAL  = 0;

/* =====================================================================
   6. NAVEGAÇÃO
   ===================================================================== */
const PASSOS = [
  { t:'Identificação do ETP',        s:'Dados institucionais e objeto' },
  { t:'I · Necessidade',             s:'Problema a ser resolvido' },
  { t:'II · PCA e Enquadramento',    s:'Dotação e modalidade' },
  { t:'III · Requisitos',            s:'Sustentabilidade e padrões' },
  { t:'IV · Quantidades',            s:'Memória de cálculo' },
  { t:'V · Levantamento de mercado', s:'Alternativas e riscos' },
  { t:'VI · Estimativa de preços',   s:'Método de cotação' },
  { t:'VII · Solução e prazos',      s:'Entrega e execução' },
  { t:'VIII · Parcelamento',         s:'Justificativa técnica' },
  { t:'IX · Resultados pretendidos', s:'Economicidade' },
  { t:'X · Providências prévias',    s:'Contratações correlatas' },
  { t:'XI · Posicionamento',         s:'Conclusão e viabilidade' },
  { t:'Aprovadores e Governança',    s:'Equipe e fiscalização' }
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
      <div style="grid-column:span 2"><label class="lbl">Nome completo</label><input class="inp" data-a="nome" value="${esc(d.nome||'')}" placeholder="Nome do agente"></div>
      <div><label class="lbl">Papel</label>
        <select class="sel" data-a="papel">
          ${['Elaborador','Validador','Aprovador','Autoridade Competente','Fiscal Técnico']
            .map(p => `<option ${d.papel===p?'selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div><label class="lbl">Cargo / Função</label><input class="inp" data-a="cargo" value="${esc(d.cargo||'')}" placeholder="Ex.: Diretor de Administração"></div>
      <div style="grid-column:span 2"><label class="lbl">Órgão / Unidade</label><input class="inp" data-a="orgao" value="${esc(d.orgao||'')}" placeholder="Ex.: Coordenação-Geral de Logística"></div>
      <div style="grid-column:span 2"><label class="lbl">Matrícula / Identificador funcional</label><input class="inp" data-a="matricula" value="${esc(d.matricula||'')}" placeholder="Opcional"></div>
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
    enq: {
      dotacao: v('dotacaoOrcamentaria'), fonte: v('fonteRecurso'),
      modalidade: v('modalidadePretendida'), criterio: v('criterioJulgamento')
    },
    req: {
      sustentaveis: checks('sustent'), tecnicos: v('reqTecnicos'),
      habilitacao: v('reqHabilitacao'), garantia: v('reqGarantia'), entrega: v('reqEntrega')
    },
    qtd: {
      descricao: v('qtdDescricao'),
      itens: readTable('tbQtd', ['item','descricao','quantidade','unidade','memoria']),
      metodo: v('metodoQtd')
    },
    mercado: { alternativas: readTable('tbMercado', ['alternativa','descricao','vantagens','riscos']), conclusao: v('conclusaoMercado') },
    precos: {
      metodo: v('metodoPreco'), itens: readTable('tbPreco', ['item','fonte','unitario','quantidade','total']),
      observacoes: v('obsPreco'), total: recalcularTotal()
    },
    solucao: { descricao: v('descricaoSolucao'), entregas: v('entregas'), ciclo: v('cicloVida') },
    prazos: { execucao: v('prazoExecucao'), local: v('localEntrega'), pagamento: v('condicoesPagamento') },
    parcel: { decisao: v('parcelar'), itens: v('itensParcelaveis'), justificativa: v('justificativaParcelamento') },
    result: { resultados: v('resultados'), economicidade: v('economicidade'), indicadores: v('indicadores') },
    prov: { providencias: v('providencias'), correlatas: v('correlatas'), impacto: v('impactoProvidencias') },
    conc: { posicionamento: v('posicionamento'), recomendacoes: v('recomendacoes'), conclusao: v('conclusao') },
    governanca: {
      fiscalTitular: v('fiscalTitular'),
      fiscalSubstituto: v('fiscalSubstituto'),
      gestor: v('gestorContrato')
    },
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
  { n:'II',   t:'Alinhamento ao PCA e enquadramento', f:d => [d.pca.previsto, d.pca.item, d.pca.justificativa, d.enq.dotacao, d.enq.fonte, d.enq.modalidade, d.enq.criterio] },
  { n:'III',  t:'Requisitos da contratação',          f:d => [d.req.sustentaveis.join(' '), d.req.tecnicos, d.req.habilitacao, d.req.garantia, d.req.entrega] },
  { n:'IV',   t:'Quantidades e memória de cálculo',   f:d => [d.qtd.descricao, d.qtd.metodo, d.qtd.itens.map(i => JSON.stringify(i)).join(' ')] },
  { n:'V',    t:'Levantamento de mercado',            f:d => [d.mercado.conclusao, d.mercado.alternativas.map(i => JSON.stringify(i)).join(' ')] },
  { n:'VI',   t:'Estimativa preliminar de preços',    f:d => [d.precos.metodo, d.precos.observacoes, d.precos.itens.map(i => JSON.stringify(i)).join(' ')] },
  { n:'VII',  t:'Descrição da solução como um todo',  f:d => [d.solucao.descricao, d.solucao.entregas, d.solucao.ciclo, d.prazos.execucao, d.prazos.local, d.prazos.pagamento] },
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
   10. PARSER DFD
   ===================================================================== */
const LABELS_BLACKLIST_RAW = [
  'ÓRGÃO / ENTIDADE','ÓRGÃO ENTIDADE','ÓRGÃO/ENTIDADE','ÓRGÃO','ENTIDADE',
  'UASG / CÓDIGO','UASG/CÓDIGO','UASG',
  'UNIDADE / SETOR DEMANDANTE','UNIDADE / SETOR',
  'UNIDADE REQUISITANTE','UNIDADE DEMANDANTE',
  'SETOR REQUISITANTE','SETOR DEMANDANTE',
  'UNIDADE SOLICITANTE','SETOR SOLICITANTE',
  'UNIDADE','SETOR',
  'EXERCÍCIO','EXERCICIO',
  'Nº DO ETP','NÚMERO DO ETP','NUMERO DO ETP',
  'Nº','NÚMERO','NUMERO',
  'PROCESSO ADMINISTRATIVO','PROCESSO',
  'Nº DO PROCESSO','NÚMERO DO PROCESSO','NUMERO DO PROCESSO',
  'DATA DE ELABORAÇÃO','DATA DE ELABORACAO','DATA',
  'OBJETO DA CONTRATAÇÃO','OBJETO DA CONTRATACAO',
  'OBJETO DA DEMANDA','OBJETO',
  'DESCRIÇÃO RESUMIDA DO OBJETO','DESCRIÇÃO DO OBJETO','DESCRIÇÃO',
  'JUSTIFICATIVA DA NECESSIDADE','JUSTIFICATIVA DA DEMANDA',
  'JUSTIFICATIVA','NECESSIDADE','MOTIVAÇÃO',
  'RESPONSÁVEL PELA ELABORAÇÃO','RESPONSÁVEL PELA DEMANDA',
  'RESPONSÁVEL DA DEMANDA','RESPONSÁVEL TÉCNICO',
  'RESPONSÁVEL','SOLICITANTE','ELABORADOR',
  'CARGO / FUNÇÃO','CARGO/FUNÇÃO','CARGO E FUNÇÃO','CARGO OU FUNÇÃO',
  'CARGO','FUNÇÃO','FUNCAO',
  'E-MAIL INSTITUCIONAL','E-MAIL','EMAIL',
  'TELEFONE','TEL','FONE','RAMAL',
  'LOGOTIPO INSTITUCIONAL','LOGOTIPO','LOGO',
  'VALOR ESTIMADO DA CONTRATAÇÃO','VALOR ESTIMADO DA CONTRATACAO',
  'VALOR TOTAL ESTIMADO','VALOR ESTIMADO',
  'VALOR GLOBAL','VALOR TOTAL','VALOR',
  'DFD','Nº DO DFD','NÚMERO DO DFD','NUMERO DO DFD',
  'DOCUMENTO DE FORMALIZAÇÃO DA DEMANDA','DOCUMENTO DE FORMALIZACAO DA DEMANDA',
  'NÃO INFORMADO','NÃO INFORMADA','NÃO SE APLICA',
  'N/A','N/D','ND','NA',
  '-','--','---','—','–','...',
  'DEMANDA','SOLICITAÇÃO','SOLICITACAO',
  'TÉCNICO','TECNICO','PELA','PELO',
  'ELABORAÇÃO','ELABORACAO'
];

function normalizarLabel(s){
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[:\-–—|.,;]+/g, ' ').replace(/\//g, ' ')
    .replace(/\s+/g, ' ').trim();
}
const LABELS_BLACKLIST = new Set(LABELS_BLACKLIST_RAW.map(normalizarLabel));

function ehLabelVisual(valor){
  if (valor == null) return true;
  const v = normalizarLabel(valor);
  if (!v) return true;
  return LABELS_BLACKLIST.has(v);
}

/* ---------- CLEAN VALUE (anti-paginação) ---------- */
function cleanValue(text){
  if (text == null) return '';
  let v = String(text);
  v = v.replace(/\r/g, '\n').replace(/\n+/g, ' ').replace(/\t/g, ' ');
  v = v.replace(/\s{2,}/g, ' ');
  v = v.replace(/\b(?:P[áa]gina|Page)\s+\d+\s*(?:de|of|\/)\s*\d+\b/gi, ' ');
  v = v.replace(/[\[\]·•\-–—]*\s*(?:P[áa]gina|Page)\s+\d+\s*(?:de|of|\/)\s*\d+\s*[\[\]·•\-–—]*/gi, ' ');
  v = v.replace(/^\s*\d+\s*(?:de|\/)\s*\d+\s*$/gm, ' ');
  v = v.replace(/^[\s:;\-–—_\/|>»•·●◦‣▪►]+/, '');
  v = v.replace(/[\s:;\-–—_\/|]+$/, '');

  const fragmentos = [
    /cargo\s*\/\s*fun[çc][ãa]o\s*[:\-–—]?\s*/gi,
    /cargo\s*e\s*fun[çc][ãa]o\s*[:\-–—]?\s*/gi,
    /cargo\s*[:\-–—]?\s*/gi,
    /fun[çc][ãa]o\s*[:\-–—]?\s*/gi,
    /respons[áa]vel\s+pela\s+demanda\s*[:\-–—]?\s*/gi,
    /respons[áa]vel\s+da\s+demanda\s*[:\-–—]?\s*/gi,
    /respons[áa]vel\s+t[ée]cnico\s*[:\-–—]?\s*/gi,
    /respons[áa]vel\s*[:\-–—]?\s*/gi,
    /unidade\s+requisitante\s*[:\-–—]?\s*/gi,
    /unidade\s+demandante\s*[:\-–—]?\s*/gi,
    /setor\s+requisitante\s*[:\-–—]?\s*/gi,
    /setor\s+demandante\s*[:\-–—]?\s*/gi,
    /valor\s+estimado\s+da\s+contrata[çc][ãa]o\s*[:\-–—]?\s*/gi,
    /valor\s+estimado\s*[:\-–—]?\s*/gi,
    /valor\s+total\s*[:\-–—]?\s*/gi,
    /valor\s+global\s*[:\-–—]?\s*/gi,
    /justificativa\s+da\s+necessidade\s*[:\-–—]?\s*/gi,
    /justificativa\s*[:\-–—]?\s*/gi,
    /necessidade\s*[:\-–—]?\s*/gi,
    /descri[çc][ãa]o\s+resumida\s+do\s+objeto\s*[:\-–—]?\s*/gi,
    /descri[çc][ãa]o\s+do\s+objeto\s*[:\-–—]?\s*/gi,
    /objeto\s+da\s+contrata[çc][ãa]o\s*[:\-–—]?\s*/gi,
    /objeto\s*[:\-–—]?\s*/gi,
    /processo\s+administrativo\s*[:\-–—]?\s*/gi,
    /n[º°º]?\s*do\s+dfd\s*[:\-–—]?\s*/gi,
    /^\s*dfd\s*[:\-–—]?\s*/gi,
    /[óo]rg[ãa]o\s*\/\s*entidade\s*[:\-–—]?\s*/gi,
    /[óo]rg[ãa]o\s+entidade\s*[:\-–—]?\s*/gi,
    /uasg\s*\/\s*c[óo]digo\s*[:\-–—]?\s*/gi
  ];
  fragmentos.forEach(rx => { v = v.replace(rx, ' '); });

  v = v.replace(/\s*\/\s*/g, ' / ').replace(/(^|\s)\/(\s|$)/g, ' ');
  v = v.replace(/\s{2,}/g, ' ').trim();
  if (ehLabelVisual(v)) return '';
  return v;
}

function sanitizarTextoPDF(txt){
  if (!txt) return '';
  let t = String(txt).replace(/\r/g, '\n');
  t = t.replace(/^[ \t]*LicitaReq[^\n]*$/gim, '');
  t = t.replace(/^[ \t]*LicitaAudit[^\n]*$/gim, '');
  t = t.replace(/^[ \t]*LicitaETP[^\n]*$/gim, '');
  t = t.replace(/^[ \t]*P[áa]gina\s+\d+\s*(?:de|\/)\s*\d+[^\n]*$/gim, '');
  t = t.replace(/^\s*\d+\s*\/\s*\d+\s*$/gm, '');
  t = t.replace(/^[-–—_=]{3,}\s*$/gm, '');
  t = t.replace(/Documento\s+gerado\s+eletronicamente[^\n]*/gi, '');
  t = t.replace(/Emitido\s+em[^\n]*/gi, '');
  t = t.replace(/\b(?:P[áa]gina|Page)\s+\d+\s*(?:de|of|\/)\s*\d+\b/gi, ' ');
  t = t.replace(/[\[\]·•\-–—]*\s*(?:P[áa]gina|Page)\s+\d+\s*(?:de|of|\/)\s*\d+\s*[\[\]·•\-–—]*/gi, ' ');

  t = t.replace(/CARGO\s*\/\s*\n\s*FUN[ÇC][ÃA]O/gi, 'CARGO / FUNÇÃO');
  t = t.replace(/RESPONS[ÁA]VEL\s*\n\s*PELA\s+DEMANDA/gi, 'RESPONSÁVEL PELA DEMANDA');
  t = t.replace(/UNIDADE\s*\n\s*REQUISITANTE/gi, 'UNIDADE REQUISITANTE');
  t = t.replace(/UNIDADE\s*\n\s*DEMANDANTE/gi, 'UNIDADE DEMANDANTE');
  t = t.replace(/SETOR\s*\n\s*REQUISITANTE/gi, 'SETOR REQUISITANTE');
  t = t.replace(/SETOR\s*\n\s*DEMANDANTE/gi, 'SETOR DEMANDANTE');
  t = t.replace(/VALOR\s*\n\s*ESTIMADO/gi, 'VALOR ESTIMADO');
  t = t.replace(/JUSTIFICATIVA\s*\n\s*DA\s+DEMANDA/gi, 'JUSTIFICATIVA DA DEMANDA');
  t = t.replace(/OBJETO\s*\n\s*DA\s+CONTRATA[ÇC][ÃA]O/gi, 'OBJETO DA CONTRATAÇÃO');
  t = t.replace(/[ÓO]RG[ÃA]O\s*\n\s*\/?\s*ENTIDADE/gi, 'ÓRGÃO / ENTIDADE');

  t = t.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n');
  return t;
}

function extrairPorRotulo(texto, rotulos, opts = {}){
  const { maxLen = 300, maxLinhasAdiante = 6 } = opts;
  const linhas = String(texto).split('\n');
  for (const rotulo of rotulos){
    const rotEsc = escapeRegex(rotulo);
    const rxRot = new RegExp(`^\\s*${rotEsc}\\s*[:\\-–—|]?\\s*(.*)$`, 'i');
    for (let i = 0; i < linhas.length; i++){
      const m = linhas[i].match(rxRot);
      if (!m) continue;
      const inline = cleanValue(m[1]);
      if (inline) return inline.slice(0, maxLen);
      for (let j = i + 1; j <= Math.min(i + maxLinhasAdiante, linhas.length - 1); j++){
        const candRaw = linhas[j];
        if (!candRaw || !candRaw.trim()) continue;
        if (ehLabelVisual(candRaw)) continue;
        const cand = cleanValue(candRaw);
        if (!cand) continue;
        return cand.slice(0, maxLen);
      }
    }
  }
  return '';
}

function extrairBloco(texto, rotulo, rotulosFim, opts = {}){
  const { maxLen = 2000 } = opts;
  const esc_rot = escapeRegex(rotulo);
  const rx = new RegExp(`(?:^|\\n)\\s*${esc_rot}\\s*[:\\-–—|]?\\s*([\\s\\S]{0,${maxLen}})`, 'i');
  const m = texto.match(rx);
  if (!m || !m[1]) return '';
  const linhas   = m[1].split('\n');
  const alvosFim = (rotulosFim || []).map(normBusca);
  const aceitas  = [];
  for (const linha of linhas){
    const norm = normBusca(linha);
    if (!norm) continue;
    if (alvosFim.some(a => norm === a || norm.startsWith(a + ' ') || norm.startsWith(a + ':'))) break;
    if (ehStopLabelUniversal(norm)) break;
    if (norm.startsWith('[[pagina_')) break;
    aceitas.push(linha);
    if (aceitas.join(' ').length > maxLen) break;
  }
  return cleanValue(aceitas.join(' ')).slice(0, maxLen);
}

function normalizarMoeda(v){
  if (!v) return '';
  let s = String(v).replace(/[^\d.,]/g, '');
  if (!s) return '';
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? '' : n.toFixed(2);
}

/* ---------- LOGO ---------- */
async function extrairLogoDoPdf(file){
  if (!window.pdfjsLib) return null;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  let pdf;
  try {
    const buf = await file.arrayBuffer();
    pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  } catch(e){ console.warn('[Logo] PDF inválido:', e); return null; }

  const paginasAlvo = Math.min(3, pdf.numPages);
  const candidatos  = [];

  for (let p = 1; p <= paginasAlvo; p++){
    let page; try { page = await pdf.getPage(p); } catch(e){ continue; }
    let opList; try { opList = await page.getOperatorList(); } catch(e){ continue; }
    const nomesXObj = new Set();
    const inlineImgs = [];
    for (let i = 0; i < opList.fnArray.length; i++){
      const fn = opList.fnArray[i]; const args = opList.argsArray[i];
      if (!args) continue;
      if (fn === pdfjsLib.OPS.paintImageXObject && args[0])   nomesXObj.add(args[0]);
      if (fn === pdfjsLib.OPS.paintJpegXObject  && args[0])   nomesXObj.add(args[0]);
      if (fn === pdfjsLib.OPS.paintInlineImageXObject && args[0]) inlineImgs.push(args[0]);
    }
    for (const nome of nomesXObj){
      const obj = await new Promise(resolve => {
        let done = false; const finish = v => { if (!done){ done = true; resolve(v); } };
        const timer = setTimeout(() => finish(null), 800);
        const cb = img => { clearTimeout(timer); finish(img); };
        try { page.objs.get(nome, cb); }
        catch(e){ try { page.commonObjs.get(nome, cb); } catch(e2){ clearTimeout(timer); finish(null); } }
      });
      if (obj && obj.width && obj.height && obj.data) candidatos.push({ obj, pagina: p, fonte: 'named' });
    }
    for (const obj of inlineImgs){
      if (obj && obj.width && obj.height && obj.data) candidatos.push({ obj, pagina: p, fonte: 'inline' });
    }
  }
  if (!candidatos.length) return null;
  const validos = [];
  for (const c of candidatos){
    const { width, height, data } = c.obj;
    if (!width || !height || !data) continue;
    if (width  < 24 || height < 24) continue;
    if (width > 1200 || height > 1200) continue;
    const ratio = width / height;
    if (ratio < 0.15 || ratio > 6) continue;
    const area = width * height;
    if (area < 2000) continue;
    const dataUrl = bitmapParaDataUrl(c.obj);
    if (!dataUrl) continue;
    if (dataUrl.length > 800 * 1024) continue;
    validos.push({ dataUrl, width, height, area, pagina: c.pagina, fonte: c.fonte });
  }
  if (!validos.length) return null;
  validos.sort((a, b) => b.area - a.area);
  const melhor = validos[0];
  console.info('[Logo] capturada:', `${melhor.width}×${melhor.height}`, 'pág', melhor.pagina, `(${melhor.fonte})`);
  return melhor.dataUrl;
}
function bitmapParaDataUrl(imgObj){
  try {
    const { width, height, data } = imgObj;
    if (!width || !height || !data) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx  = canvas.getContext('2d');
    const imgD = ctx.createImageData(width, height);
    const n    = width * height;
    if (data.length === n * 4){
      imgD.data.set(data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(data));
    } else if (data.length === n * 3){
      for (let i = 0, j = 0; i < data.length; i += 3, j += 4){
        imgD.data[j] = data[i]; imgD.data[j+1] = data[i+1]; imgD.data[j+2] = data[i+2]; imgD.data[j+3] = 255;
      }
    } else if (data.length === n){
      for (let i = 0, j = 0; i < data.length; i++, j += 4){
        const v = data[i];
        imgD.data[j] = imgD.data[j+1] = imgD.data[j+2] = v; imgD.data[j+3] = 255;
      }
    } else return null;
    ctx.putImageData(imgD, 0, 0);
    return canvas.toDataURL('image/png');
  } catch(e){ console.warn('[Logo] bitmapParaDataUrl falhou:', e); return null; }
}

/* ---------- STOP LABELS UNIVERSAIS (com v2.6) ---------- */
const STOP_LABELS_UNIVERSAL_RAW = [
  /* Seções típicas */
  'Justificativa da Necessidade','Justificativa da Necessidade Pública',
  'Justificativa da Necessidade Pública (Fundamentada)','Justificativa da Demanda',
  'Justificativa da Contratação','Justificativa',
  'Estimativa de Quantidades','Estimativa de Quantidade',
  'Estimativa de Quantidades e Memória de Cálculo',
  'Alinhamento ao Plano','Alinhamento ao Plano de Contratações Anual','Alinhamento ao PCA',
  'Enquadramento Legal','Fundamentação Legal','Fundamentacao Legal',
  'Requisitos da Contratação','Requisitos da Contratacao',
  'Levantamento de Mercado','Levantamento de Mercado e Alternativas',
  'Estimativa Preliminar de Preços','Estimativa de Preços','Estimativa de Precos',
  'Descrição da Solução','Descricao da Solucao','Descrição da Solução como um Todo',
  'Justificativa para Parcelamento','Justificativa para Parcelamento (ou não)',
  'Resultados Pretendidos',
  'Providências Prévias','Providencias Previas','Providências Prévias e Contratações Correlatas',
  'Posicionamento Conclusivo','Posicionamento Conclusivo sobre a Viabilidade',
  /* Campos de identificação */
  'Órgão / Entidade','Órgão/Entidade','Órgão Entidade',
  'UASG','UASG / Código',
  'Unidade Requisitante','Unidade Demandante','Unidade Solicitante',
  'Setor Requisitante','Setor Demandante','Setor Solicitante',
  'Unidade / Setor','Unidade / Setor Demandante',
  'Responsável pela Demanda','Responsável da Demanda','Responsável Técnico',
  'Responsável pela Elaboração','Responsável pela Solicitação','Responsável',
  'Cargo / Função','Cargo/Função','Cargo e Função','Cargo ou Função','Cargo','Função',
  'Valor Estimado','Valor Estimado da Contratação','Valor Total','Valor Total Estimado',
  'Valor Global','Valor',
  'Processo Administrativo','Nº do Processo','Número do Processo','Processo',
  'Nº do DFD','Número do DFD','DFD',
  'Data de Elaboração','Data',
  /* v2.6 · Enquadramento / prazos / governança */
  'Dotação Orçamentária','Dotacao Orcamentaria','Dotação','Rubrica Orçamentária','Rubrica',
  'Fonte de Recurso','Fonte do Recurso','Fonte','Elemento de Despesa','Natureza da Despesa',
  'Modalidade Pretendida','Modalidade de Licitação','Modalidade da Contratação','Modalidade',
  'Critério de Julgamento','Criterio de Julgamento','Tipo de Julgamento','Critério',
  'Prazo de Execução','Prazo de Entrega','Prazo de Vigência','Prazo Contratual','Prazo',
  'Local de Entrega','Local da Entrega','Local de Prestação','Local',
  'Condições de Pagamento','Condicoes de Pagamento','Forma de Pagamento','Condições de Recebimento',
  'Fiscal Titular do Contrato','Fiscal Titular','Fiscal Substituto do Contrato','Fiscal Substituto',
  'Fiscal do Contrato','Fiscal','Gestor do Contrato','Gestor Contratual','Gestor'
];

const STOP_LABELS_UNIVERSAL = STOP_LABELS_UNIVERSAL_RAW.map(normBusca);

function escapeRegex(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function ehStopLabelUniversal(norm){
  if (!norm) return false;
  for (const alvo of STOP_LABELS_UNIVERSAL){
    if (norm === alvo) return true;
    if (norm.startsWith(alvo + ' ')) return true;
    if (norm.startsWith(alvo + ':')) return true;
  }
  return false;
}

function construirCelulas(paginas){
  const celulas = [];
  for (const pag of paginas){
    const rows = [];
    const itens = [...pag.items].sort((a, b) => b.y - a.y || a.x - b.x);
    for (const item of itens){
      if (!item.str || !item.str.trim()) continue;
      let row = rows.find(r => Math.abs(r.y - item.y) < 3.5);
      if (!row){ row = { y: item.y, items: [] }; rows.push(row); }
      row.items.push(item);
    }
    for (const row of rows){
      row.items.sort((a, b) => a.x - b.x);
      let cur = null; const rowCells = [];
      for (const it of row.items){
        const fimAtual = cur ? (cur.x + cur.w) : 0;
        const gap = cur ? (it.x - fimAtual) : Infinity;
        if (cur && gap >= 0 && gap < 15){
          cur.text += ' ' + it.str;
          cur.w = (it.x + (it.w || 0)) - cur.x;
        } else {
          if (cur) rowCells.push(cur);
          cur = { x: it.x, y: row.y, w: it.w || 0, page: pag.pageNum, text: it.str };
        }
      }
      if (cur) rowCells.push(cur);
      for (const c of rowCells){
        c.text = c.text.replace(/\s+/g, ' ').trim();
        if (c.text) celulas.push(c);
      }
    }
  }
  return celulas;
}

function normBusca(s){
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').replace(/[:\-–—|.,;]+$/, '').trim();
}

function buscarLabelCelula(celulas, rotulos){
  const alvos = rotulos.map(normBusca);
  const achados = [];
  for (const cel of celulas){
    const norm = normBusca(cel.text);
    if (!norm || norm.length > 90) continue;
    for (const alvo of alvos){
      const exato  = norm === alvo;
      const prefix = norm.startsWith(alvo + ' ') || norm.startsWith(alvo + ':');
      if (exato || prefix){ achados.push({ cel, alvoLen: alvo.length, exato }); break; }
    }
  }
  if (!achados.length) return null;
  achados.sort((a, b) => (Number(b.exato) - Number(a.exato)) || (a.alvoLen - b.alvoLen));
  return achados[0].cel;
}

function extrairValorDeLabel(celulas, labelCel){
  if (!labelCel) return '';
  const direita = celulas
    .filter(c => c.page === labelCel.page && Math.abs(c.y - labelCel.y) < 3.5
              && c.x > labelCel.x + labelCel.w - 2 && !ehLabelVisual(c.text))
    .sort((a, b) => a.x - b.x);
  if (direita.length){
    const val = cleanValue(direita[0].text);
    if (val) return val;
  }
  const x0 = labelCel.x - 15;
  const x1 = labelCel.x + Math.max(280, labelCel.w + 260);
  const abaixo = celulas
    .filter(c => c.page === labelCel.page && c.y < labelCel.y - 3
              && c.y > labelCel.y - 90 && c.x >= x0 && c.x <= x1)
    .sort((a, b) => (b.y - a.y) || (a.x - b.x));
  for (const c of abaixo){
    if (ehLabelVisual(c.text)) continue;
    if (buscarLabelCelula([c], ['órgão','entidade','unidade','uasg','setor','responsável','cargo','função','valor','processo','exercício','data'])) break;
    const val = cleanValue(c.text);
    if (val) return val;
  }
  return '';
}

function extrairBlocoColuna(celulas, labelCel, rotulosFim){
  if (!labelCel) return '';
  const x0 = labelCel.x - 15;
  const x1 = labelCel.x + 640;
  const alvosFim = (rotulosFim || []).map(normBusca);
  const abaixo = celulas
    .filter(c => c.page === labelCel.page && c.y < labelCel.y - 2 && c.x >= x0 && c.x <= x1)
    .sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const partes = [];
  for (const c of abaixo){
    const norm = normBusca(c.text);
    if (!norm) continue;
    if (alvosFim.some(a => norm === a || norm.startsWith(a + ' ') || norm.startsWith(a + ':'))) break;
    if (ehStopLabelUniversal(norm)) break;
    if (buscarLabelCelula([c], ['órgão','entidade','unidade requisitante','unidade demandante','setor requisitante','setor demandante','uasg','responsável','cargo','função','valor','processo','data'])) break;
    partes.push(c.text);
    if (partes.join(' ').length > 2000) break;
  }
  return cleanValue(partes.join(' ')).slice(0, 2000);
}

function extrairCampo(celulas, rotulos){
  const lc = buscarLabelCelula(celulas, rotulos);
  return extrairValorDeLabel(celulas, lc);
}

/* ---------- FLUXO PRINCIPAL ---------- */
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
  const msgEl = document.getElementById('dfdResultMsg');
  const list  = document.getElementById('dfdResultList');
  const box   = document.getElementById('dfdResult');
  const btn   = document.getElementById('dfdApplyBtn');
  try {
    toast('Lendo DFD...');
    const resultado = await extrairDadosDFD(file);
    let logoCapturada = null;
    if ((file.name || '').toLowerCase().endsWith('.pdf')){
      toast('Capturando logotipo institucional...');
      try { logoCapturada = await extrairLogoDoPdf(file); } catch(e){ console.warn('[Logo]', e); }
    }
    dfdExtraido = { ...resultado, logo: logoCapturada };
    const campos = Object.entries(resultado.campos).filter(([_, v]) => v && String(v).trim());
    if (!campos.length && !logoCapturada){ toast('Nenhum campo ou logo reconhecido no arquivo.'); return; }
    msgEl.textContent = `${campos.length} campo(s) via ${resultado.origem.toUpperCase()}${logoCapturada ? ' + logotipo capturado' : ''}`;
    list.innerHTML = campos.map(([k, v]) => {
      const label = {
        numero:'Nº do DFD', objeto:'Objeto', unidade:'Unidade Requisitante',
        responsavel:'Responsável pela Demanda', cargo:'Cargo / Função',
        email:'E-mail', telefone:'Telefone', valor:'Valor Estimado',
        justificativa:'Justificativa', processo:'Processo', orgao:'Órgão', uasg:'UASG',
        dotacao:'Dotação Orçamentária', fonteRecurso:'Fonte de Recurso',
        modalidade:'Modalidade', criterio:'Critério de Julgamento',
        prazoExecucao:'Prazo de Execução', localEntrega:'Local de Entrega',
        condicoesPagamento:'Condições de Pagamento',
        fiscalTitular:'Fiscal Titular', fiscalSubstituto:'Fiscal Substituto',
        gestorContrato:'Gestor do Contrato', qtdDescricao:'Quantitativo'
      }[k] || k;
      const val = String(v).length > 140 ? String(v).slice(0, 137) + '…' : String(v);
      return `<li><span>${esc(label)}</span><span>${esc(val)}</span></li>`;
    }).join('');
    if (logoCapturada){
      const li = document.createElement('li');
      li.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px dashed rgba(22,163,74,.20);grid-column:1/-1';
      li.innerHTML = `<span style="color:var(--tx-3);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em">Logotipo institucional</span><span style="display:flex;align-items:center;gap:8px"><img src="${logoCapturada}" alt="Logo capturada" style="width:52px;height:52px;object-fit:contain;background:var(--bg-1);border:1px solid var(--bd-1);border-radius:8px;padding:3px" /><span style="color:var(--ok);font-weight:700;font-size:11.5px">✓ capturado</span></span>`;
      list.appendChild(li);
    } else {
      const li = document.createElement('li');
      li.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px dashed rgba(148,163,184,.25);grid-column:1/-1';
      li.innerHTML = `<span style="color:var(--tx-3);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em">Logotipo institucional</span><span style="color:var(--tx-3);font-size:11.5px">— mantida a logo padrão do ETP</span>`;
      list.appendChild(li);
    }
    box.classList.remove('hidden');
    btn.disabled = false;
  } catch(e){
    console.error('[DFD]', e);
    toast('Falha ao ler o DFD: ' + (e?.message || e));
  }
}

async function extrairDadosDFD(file){
  const nome = (file?.name || '').toLowerCase();
  const tipo = (file?.type || '').toLowerCase();
  if (nome.endsWith('.json') || tipo.includes('json')) return extrairDFDJson(file);
  if (nome.endsWith('.pdf')  || tipo.includes('pdf'))  return extrairDFDPdf(file);
  throw new Error('Formato não suportado. Envie PDF ou JSON.');
}

async function extrairDFDJson(file){
  const txt = await file.text();
  let raw;
  try { raw = JSON.parse(txt); } catch(e){ throw new Error('JSON inválido.'); }
  const d = raw?.dfd || raw?.dados?.dfd || raw?.documento?.dfd || raw?.dados || raw?.documento || raw;
  const pick = (...keys) => {
    for (const k of keys){
      const partes = String(k).split('.');
      let cur = d;
      for (const p of partes){ cur = cur?.[p]; if (cur == null) break; }
      if (cur != null && String(cur).trim() !== '') return String(cur).trim();
    }
    return '';
  };
  const campos = {
    numero:        cleanValue(pick('numero','numeroDFD','numero_dfd','numeroDfd','codigo','id')),
    objeto:        cleanValue(pick('objeto','objetoContratacao','descricao','descricaoObjeto','descricaoResumida','descricao_resumida')),
    unidade:       cleanValue(pick('unidade','unidadeRequisitante','unidade_requisitante','setor','departamento','setorRequisitante')),
    responsavel:   cleanValue(pick('responsavel','responsavelDemanda','responsavel_demanda','responsavelPelaDemanda','solicitante','nome','autor')),
    cargo:         cleanValue(pick('cargo','funcao','cargoFuncao','cargo_funcao','cargoResponsavel','cargo_responsavel')),
    email:         cleanValue(pick('email','emailInstitucional','email_institucional')),
    telefone:      cleanValue(pick('telefone','fone','ramal')),
    valor:         normalizarMoeda(pick('valor','valorEstimado','valor_estimado','valorTotal','valor_total','valorGlobal','total')),
    justificativa: cleanValue(pick('justificativa','descricaoNecessidade','descricao_necessidade','necessidade','motivacao')),
    processo:      cleanValue(pick('processo','processoAdministrativo','processo_administrativo','numeroProcesso','numero_processo')),
    orgao:         cleanValue(pick('orgao','orgaoEntidade','entidade','instituicao')),
    uasg:          cleanValue(pick('uasg','codigoUasg','codigo_uasg')),
    dotacao:       cleanValue(pick('dotacao','dotacaoOrcamentaria','dotacao_orcamentaria','rubrica')),
    fonteRecurso:  cleanValue(pick('fonteRecurso','fonte_recurso','fonte','naturezaDespesa')),
    modalidade:    cleanValue(pick('modalidade','modalidadePretendida','modalidadeLicitacao','modalidade_licitacao')),
    criterio:      cleanValue(pick('criterio','criterioJulgamento','criterio_julgamento','tipoJulgamento')),
    prazoExecucao: cleanValue(pick('prazoExecucao','prazo_execucao','prazoEntrega','prazo')),
    localEntrega:  cleanValue(pick('localEntrega','local_entrega','local')),
    condicoesPagamento: cleanValue(pick('condicoesPagamento','formaPagamento','condicoes_pagamento')),
    fiscalTitular: cleanValue(pick('fiscalTitular','fiscal_titular','fiscal')),
    fiscalSubstituto: cleanValue(pick('fiscalSubstituto','fiscal_substituto')),
    gestorContrato: cleanValue(pick('gestorContrato','gestor_contrato','gestor')),
    qtdDescricao:  cleanValue(pick('quantidadeDescricao','qtdDescricao','descricaoQuantidade','quantitativo'))
  };
  const logoJson = d.logo || d.logoInstitucional || d.logoBase64 || raw?.logo || null;
  return { origem: 'json', campos, raw, logoJson };
}

async function extrairDFDPdf(file){
  if (!window.pdfjsLib) throw new Error('Biblioteca pdf.js não disponível.');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const paginas = [];
  let textoCompleto = '';
  for (let i = 1; i <= pdf.numPages; i++){
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = [];
    content.items.forEach(item => {
      const str = String(item.str || '');
      if (!str) return;
      items.push({ str, x: item.transform[4], y: item.transform[5], w: item.width || 0, h: item.height || 0 });
    });
    paginas.push({ pageNum: i, items });
    const porLinha = new Map();
    items.forEach(it => {
      const yy = Math.round(it.y / 2) * 2;
      if (!porLinha.has(yy)) porLinha.set(yy, []);
      porLinha.get(yy).push(it);
    });
    const ys = Array.from(porLinha.keys()).sort((a, b) => b - a);
    ys.forEach(yy => {
      const linha = porLinha.get(yy).sort((a, b) => a.x - b.x).map(it => it.str).join(' ').replace(/\s{2,}/g, ' ').trim();
      if (linha) textoCompleto += linha + '\n';
    });
    textoCompleto += `\n[[PAGINA_${i}_DE_${pdf.numPages}]]\n\n`;
  }
  const textoLimpo = sanitizarTextoPDF(textoCompleto);
  const campos     = extrairCamposDFD(textoLimpo, paginas);
  return { origem: 'pdf', campos, raw: textoLimpo };
}

function extrairCamposDFD(texto, paginas){
  const t = texto;
  const celulas = construirCelulas(paginas || []);
  const campos = {
    numero:'', objeto:'', unidade:'', responsavel:'',
    cargo:'', email:'', telefone:'', valor:'',
    justificativa:'', processo:'', orgao:'', uasg:'',
    dotacao:'', fonteRecurso:'', modalidade:'', criterio:'',
    prazoExecucao:'', localEntrega:'', condicoesPagamento:'',
    fiscalTitular:'', fiscalSubstituto:'', gestorContrato:'',
    qtdDescricao:''
  };

  campos.orgao = extrairCampo(celulas, ['Órgão / Entidade','Órgão/Entidade','Órgão Entidade','Órgão','Entidade']) || '';
  campos.uasg  = extrairCampo(celulas, ['UASG / Código','UASG/Código','UASG','Código UASG']) || '';
  if (campos.uasg){ const m = campos.uasg.match(/\d{4,}/); campos.uasg = m ? m[0] : ''; }
  campos.unidade = extrairCampo(celulas, ['Unidade Requisitante','Unidade Demandante','Setor Requisitante','Setor Demandante','Unidade Solicitante','Setor Solicitante','Unidade / Setor Demandante','Unidade / Setor','Unidade','Setor']) || '';
  campos.responsavel = extrairCampo(celulas, ['Responsável pela Demanda','Responsável da Demanda','Responsável Técnico','Responsável pela Elaboração','Responsável pela Solicitação','Responsável','Solicitante','Elaborador']) || '';
  campos.cargo = extrairCampo(celulas, ['Cargo / Função','Cargo/Função','Cargo e Função','Cargo ou Função','Cargo','Função']) || '';
  campos.processo = extrairCampo(celulas, ['Processo Administrativo','Nº do Processo','Número do Processo','Numero do Processo','Processo']) || '';
  if (campos.processo && !/\d/.test(campos.processo)) campos.processo = '';

  /* v2.6 · Enquadramento */
  campos.dotacao      = extrairCampo(celulas, ['Dotação Orçamentária','Dotacao Orcamentaria','Dotação','Rubrica Orçamentária','Rubrica','Elemento de Despesa']) || '';
  campos.fonteRecurso = extrairCampo(celulas, ['Fonte de Recurso','Fonte do Recurso','Fonte','Natureza da Despesa']) || '';
  campos.modalidade   = extrairCampo(celulas, ['Modalidade Pretendida','Modalidade de Licitação','Modalidade da Contratação','Modalidade']) || '';
  campos.criterio     = extrairCampo(celulas, ['Critério de Julgamento','Criterio de Julgamento','Tipo de Julgamento','Critério']) || '';

  /* v2.6 · Prazos */
  campos.prazoExecucao = extrairCampo(celulas, ['Prazo de Execução','Prazo de Entrega','Prazo de Vigência','Prazo Contratual','Prazo']) || '';
  campos.localEntrega  = extrairCampo(celulas, ['Local de Entrega','Local da Entrega','Local de Prestação','Local']) || '';
  campos.condicoesPagamento = extrairCampo(celulas, ['Condições de Pagamento','Condicoes de Pagamento','Forma de Pagamento','Condições de Recebimento']) || '';

  /* v2.6 · Governança */
  campos.fiscalTitular    = extrairCampo(celulas, ['Fiscal Titular do Contrato','Fiscal Titular','Fiscal do Contrato','Fiscal']) || '';
  campos.fiscalSubstituto = extrairCampo(celulas, ['Fiscal Substituto do Contrato','Fiscal Substituto']) || '';
  campos.gestorContrato   = extrairCampo(celulas, ['Gestor do Contrato','Gestor Contratual','Gestor']) || '';

  /* v2.6 · Quantitativo textual */
  campos.qtdDescricao = extrairCampo(celulas, ['Estimativa de Quantidades','Estimativa de Quantidade','Quantidade Estimada','Quantitativo','Quantidades']) || '';

  /* Valor */
  let valorTxt = extrairCampo(celulas, ['Valor Estimado da Contratação','Valor Estimado da Contratacao','Valor Total Estimado','Valor Estimado','Valor Global','Valor Total','Valor Previsto','Valor']);
  if (!valorTxt || !/\d/.test(valorTxt)){
    const m = t.match(/(?:Valor\s+(?:Total\s+)?Estimado|Valor\s+Global)[^\n]{0,60}?R?\$?\s*([\d]{1,3}(?:[.\s]\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{2})?)/i);
    if (m) valorTxt = m[1];
  }
  if (!valorTxt || !/\d/.test(valorTxt)){
    const m = t.match(/R\$\s*([\d]{1,3}(?:[.\s]\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{2})?)/);
    if (m) valorTxt = m[1];
  }
  if (!valorTxt || !/\d/.test(valorTxt)){
    const m = t.match(/\b(\d{1,3}(?:\.\d{3})+,\d{2})\b/);
    if (m) valorTxt = m[1];
  }
  campos.valor = normalizarMoeda(valorTxt);

  { const m = t.match(/([\w._%+\-]+@[\w.\-]+\.[A-Za-z]{2,})/); if (m) campos.email = cleanValue(m[1]); }
  { const m = t.match(/(?:Telefone|Tel|Fone|Ramal)\s*[:\-–—]?\s*(\(?\d{2}\)?\s*[\s\-]?\d{4,5}[\s\-]?\d{4})/i); if (m) campos.telefone = cleanValue(m[1]); }
  {
    let m = t.match(/(?:N[º°º]?\s*(?:do\s*)?DFD|DFD\s*n?[º°º]?)\s*[:\-–—]?\s*(\d{1,6}\s*\/\s*\d{2,4})/i);
    if (!m) m = t.match(/\bDFD\s+(\d{1,6}\s*\/\s*\d{2,4})/i);
    if (m) campos.numero = cleanValue(m[1]).replace(/\s*\/\s*/, '/');
  }

  /* Objeto */
  {
    const STOP_OBJETO = [
      'Justificativa da Necessidade','Justificativa da Necessidade Pública',
      'Justificativa da Necessidade Pública (Fundamentada)','Justificativa da Demanda',
      'Justificativa da Contratação','Justificativa',
      'Estimativa de Quantidades','Estimativa de Quantidade',
      'Alinhamento ao Plano','Alinhamento ao PCA',
      'Enquadramento Legal','Fundamentação Legal',
      'Requisitos da Contratação','Levantamento de Mercado',
      'Estimativa Preliminar de Preços','Estimativa de Preços',
      'Descrição da Solução','Justificativa para Parcelamento',
      'Resultados Pretendidos','Providências Prévias','Posicionamento Conclusivo',
      'Dotação Orçamentária','Fonte de Recurso','Modalidade Pretendida',
      'Critério de Julgamento','Prazo de Execução','Local de Entrega',
      'Condições de Pagamento','Fiscal Titular','Gestor do Contrato'
    ];
    const labelObj = buscarLabelCelula(celulas, ['Descrição Resumida do Objeto','Descrição do Objeto','Descrição do Objeto da Contratação','Objeto da Contratação','Objeto da Contratacao','Objeto da Demanda','Objeto da Necessidade','Objeto']);
    if (labelObj){
      const inline = extrairValorDeLabel(celulas, labelObj);
      const bloco  = extrairBlocoColuna(celulas, labelObj, STOP_OBJETO);
      campos.objeto = (bloco && bloco.length > (inline || '').length) ? bloco.slice(0, 1500) : (inline || '').slice(0, 1500);
    }
    if (!campos.objeto){
      const inicio = ['Descrição Resumida do Objeto','Descrição do Objeto','Descrição do Objeto da Contratação','Objeto da Contratação','Objeto da Demanda','Objeto'];
      for (const rot of inicio){
        const b = extrairBloco(t, rot, STOP_OBJETO, { maxLen: 1500 });
        if (b && b.length > 5){ campos.objeto = b; break; }
      }
    }
  }

  /* Justificativa */
  {
    const STOP_JUST = [
      'Estimativa de Quantidades','Estimativa de Quantidade',
      'Estimativa de Quantidades e Memória de Cálculo',
      'Alinhamento ao Plano','Alinhamento ao PCA',
      'Enquadramento Legal','Fundamentação Legal',
      'Requisitos da Contratação','Levantamento de Mercado',
      'Estimativa Preliminar de Preços','Estimativa de Preços',
      'Descrição da Solução','Justificativa para Parcelamento',
      'Resultados Pretendidos','Providências Prévias','Posicionamento Conclusivo',
      'Unidade Requisitante','Unidade Demandante','Setor Requisitante','Setor Demandante',
      'Responsável pela Demanda','Responsável Técnico','Responsável',
      'Valor Estimado','Valor Global','Valor',
      'Cargo / Função','Cargo/Função','Cargo','Função',
      'Processo Administrativo','Processo',
      'Servidores','Quantidade','Item','Prioridade','Prazo',
      'Dotação Orçamentária','Fonte de Recurso','Modalidade Pretendida',
      'Critério de Julgamento','Prazo de Execução','Local de Entrega',
      'Condições de Pagamento'
    ];
    const labelJ = buscarLabelCelula(celulas, ['Justificativa da Necessidade Pública (Fundamentada)','Justificativa da Necessidade Pública','Justificativa da Necessidade','Justificativa da Demanda','Justificativa da Contratação','Descrição da Necessidade','Justificativa']);
    if (labelJ){
      const inline = extrairValorDeLabel(celulas, labelJ);
      const bloco  = extrairBlocoColuna(celulas, labelJ, STOP_JUST);
      campos.justificativa = (bloco && bloco.length > (inline || '').length) ? bloco.slice(0, 2000) : (inline || '').slice(0, 2000);
    }
    if (!campos.justificativa){
      let j = extrairBloco(t, 'Justificativa da Necessidade Pública (Fundamentada)', STOP_JUST, { maxLen: 2000 });
      if (!j) j = extrairBloco(t, 'Justificativa da Necessidade Pública', STOP_JUST, { maxLen: 2000 });
      if (!j) j = extrairBloco(t, 'Justificativa da Necessidade', STOP_JUST, { maxLen: 2000 });
      if (!j) j = extrairBloco(t, 'Justificativa da Contratação', STOP_JUST, { maxLen: 2000 });
      if (!j) j = extrairBloco(t, 'Justificativa', STOP_JUST, { maxLen: 2000 });
      if (!j) j = extrairBloco(t, 'Descrição da Necessidade', STOP_JUST, { maxLen: 2000 });
      if (!j) j = extrairBloco(t, 'Necessidade', STOP_JUST, { maxLen: 2000 });
      campos.justificativa = j;
    }
  }

  /* Fallbacks regex */
  if (!campos.dotacao){
    const m = t.match(/(?:Dota[çc][ãa]o\s+Or[çc]ament[áa]ria|Rubrica)[^\n:]*[:\-–—]?\s*([^\n]{3,80})/i);
    if (m) campos.dotacao = cleanValue(m[1]);
  }
  if (!campos.modalidade){
    const m = t.match(/\b(Preg[ãa]o\s+Eletr[ôo]nico|Concorr[êe]ncia\s+Eletr[ôo]nica|Dispensa\s+Eletr[ôo]nica|Inexigibilidade|Leil[ãa]o|Di[áa]logo\s+Competitivo)\b/i);
    if (m) campos.modalidade = cleanValue(m[1]);
  }
  if (!campos.criterio){
    const m = t.match(/\b(Menor\s+Pre[çc]o|Maior\s+Desconto|Melhor\s+T[ée]cnica|T[ée]cnica\s+e\s+Pre[çc]o|Maior\s+Lance|Maior\s+Retorno\s+Econ[ôo]mico)\b/i);
    if (m) campos.criterio = cleanValue(m[1]);
  }
  if (!campos.prazoExecucao){
    const m = t.match(/(?:Prazo\s+de\s+(?:Execu[çc][ãa]o|Entrega|Vig[êe]ncia))[^\n:]*[:\-–—]?\s*(\d{1,3}\s*(?:dias|meses|ano[s]?))/i);
    if (m) campos.prazoExecucao = cleanValue(m[1]);
  }
  if (!campos.fiscalTitular){
    const m = t.match(/(?:Fiscal\s+(?:Titular|do\s+Contrato))[^\n:]*[:\-–—]?\s*([A-ZÀ-Ú][^\n]{3,80})/);
    if (m) campos.fiscalTitular = cleanValue(m[1]);
  }
  if (!campos.gestorContrato){
    const m = t.match(/(?:Gestor\s+(?:do\s+Contrato|Contratual))[^\n:]*[:\-–—]?\s*([A-ZÀ-Ú][^\n]{3,80})/);
    if (m) campos.gestorContrato = cleanValue(m[1]);
  }

  /* Fallback linha-âncora */
  if (!campos.orgao) campos.orgao = extrairPorRotulo(t, ['ÓRGÃO / ENTIDADE','ORGAO / ENTIDADE','ÓRGÃO ENTIDADE','ORGAO ENTIDADE','ÓRGÃO','ORGAO','ENTIDADE'], { maxLen: 200, maxLinhasAdiante: 3 });
  if (!campos.unidade) campos.unidade = extrairPorRotulo(t, ['Unidade Requisitante','Unidade Demandante','Setor Requisitante','Setor Demandante','Unidade Solicitante','Setor Solicitante','Unidade / Setor Demandante','Unidade / Setor'], { maxLen: 200, maxLinhasAdiante: 3 });
  if (!campos.responsavel) campos.responsavel = extrairPorRotulo(t, ['Responsável pela Demanda','Responsavel pela Demanda','Responsável da Demanda','Responsável Técnico','Responsavel Tecnico','Responsável pela Elaboração','Responsável pela Solicitação','Responsável','Solicitante'], { maxLen: 160, maxLinhasAdiante: 3 });
  if (!campos.cargo) campos.cargo = extrairPorRotulo(t, ['Cargo / Função','Cargo/Função','Cargo / Funcao','Cargo/Funcao','Cargo e Função','Cargo ou Função','Cargo','Função'], { maxLen: 160, maxLinhasAdiante: 3 });
  if (!campos.processo){
    campos.processo = extrairPorRotulo(t, ['Processo Administrativo','Nº do Processo','Número do Processo','Numero do Processo','Processo'], { maxLen: 80, maxLinhasAdiante: 3 });
    if (campos.processo && !/\d/.test(campos.processo)) campos.processo = '';
  }

  /* Higienização */
  if (campos.responsavel){
    const partes = campos.responsavel.split(/\s+/).filter(Boolean);
    if (partes.length < 2 || !/[A-ZÀ-Ú]/.test(campos.responsavel)) campos.responsavel = '';
  }
  if (campos.cargo){
    const low = campos.cargo.toLowerCase().trim();
    if (['função','funcao','cargo','/','—','-','n/a'].includes(low)) campos.cargo = '';
  }
  if (campos.unidade && campos.orgao && campos.unidade === campos.orgao) campos.unidade = '';
  if (campos.unidade && campos.orgao && normBusca(campos.unidade).startsWith(normBusca(campos.orgao))){
    campos.unidade = campos.unidade.slice(campos.orgao.length).replace(/^[\s\-–—:]+/, '');
  }

  /* Anti-paginação */
  Object.keys(campos).forEach(k => {
    if (typeof campos[k] === 'string' && campos[k]){
      campos[k] = campos[k]
        .replace(/[\[\]·•\-–—]*\s*(?:P[áa]gina|Page)\s+\d+\s*(?:de|of|\/)\s*\d+\s*[\[\]·•\-–—]*/gi, ' ')
        .replace(/\s{2,}/g, ' ').trim();
    }
  });
  Object.keys(campos).forEach(k => {
    if (typeof campos[k] === 'string') campos[k] = cleanValue(campos[k]);
  });
  return campos;
}

/* ---------- APLICAÇÃO ---------- */
function aplicarImportacaoDFD(){
  try {
    if (!dfdExtraido){ toast('Nenhum DFD carregado. Importe o arquivo primeiro.'); return; }
    const c = dfdExtraido.campos || {};
    const setV = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = String(v); };

    if (c.objeto)             setV('objeto', c.objeto);
    if (c.unidade)            setV('unidade', c.unidade);
    if (c.responsavel)        setV('responsavel', c.responsavel);
    if (c.cargo)              setV('cargoResponsavel', c.cargo);
    if (c.email)              setV('email', c.email);
    if (c.telefone)           setV('telefone', c.telefone);
    if (c.processo)           setV('processo', c.processo);
    if (c.justificativa)      setV('necessidade', c.justificativa);
    if (c.orgao)              setV('orgao', c.orgao);
    if (c.uasg)               setV('uasg', c.uasg);

    if (c.dotacao)            setV('dotacaoOrcamentaria', c.dotacao);
    if (c.fonteRecurso)       setV('fonteRecurso', c.fonteRecurso);
    if (c.modalidade)         setV('modalidadePretendida', c.modalidade);
    if (c.criterio)           setV('criterioJulgamento', c.criterio);

    if (c.prazoExecucao)      setV('prazoExecucao', c.prazoExecucao);
    if (c.localEntrega)       setV('localEntrega', c.localEntrega);
    if (c.condicoesPagamento) setV('condicoesPagamento', c.condicoesPagamento);

    if (c.fiscalTitular)      setV('fiscalTitular', c.fiscalTitular);
    if (c.fiscalSubstituto)   setV('fiscalSubstituto', c.fiscalSubstituto);
    if (c.gestorContrato)     setV('gestorContrato', c.gestorContrato);

    if (c.qtdDescricao)       setV('qtdDescricao', c.qtdDescricao);

    if (c.numero){
      const justEl = document.getElementById('pcaJustificativa');
      if (justEl && !justEl.value){
        justEl.value = `Documento de Formalização da Demanda (DFD) nº ${c.numero} importado automaticamente.`;
      }
    }

    if (c.valor){
      let primeiro = document.querySelector('#tbPreco tr');
      if (!primeiro){ if (typeof addPreco === 'function') addPreco(); primeiro = document.querySelector('#tbPreco tr'); }
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

    if (c.qtdDescricao){
      let primeiroQ = document.querySelector('#tbQtd tr');
      if (!primeiroQ){ if (typeof addQtd === 'function') addQtd(); primeiroQ = document.querySelector('#tbQtd tr'); }
      if (primeiroQ){
        const descEl = primeiroQ.querySelector('[data-k="descricao"]');
        const memEl  = primeiroQ.querySelector('[data-k="memoria"]');
        if (descEl && !descEl.value) descEl.value = c.objeto ? c.objeto.slice(0, 120) : c.qtdDescricao.slice(0, 120);
        if (memEl && !memEl.value)   memEl.value  = c.qtdDescricao.slice(0, 240);
      }
    }

    const lstAprov = document.getElementById('listaAprovadores');
    if (lstAprov && c.fiscalTitular){
      const primeiroCard = lstAprov.querySelector('.aprov-card');
      const nomeEl  = primeiroCard?.querySelector('[data-a="nome"]');
      const cargoEl = primeiroCard?.querySelector('[data-a="cargo"]');
      const papelEl = primeiroCard?.querySelector('[data-a="papel"]');
      if (nomeEl && !nomeEl.value)  nomeEl.value  = c.fiscalTitular;
      if (cargoEl && !cargoEl.value) cargoEl.value = 'Fiscal Titular do Contrato';
      if (papelEl) papelEl.value = 'Fiscal Técnico';
    }

    let origemLogo = 'default';
    if (dfdExtraido.logo){ aplicarLogoCapturada(dfdExtraido.logo, 'dfd'); origemLogo = 'dfd'; }
    else if (dfdExtraido.logoJson){ aplicarLogoCapturada(dfdExtraido.logoJson, 'dfd'); origemLogo = 'dfd'; }

    const qtdAplicados = Object.keys(c).filter(k => c[k]).length;
    const msgLogo = origemLogo === 'dfd' ? ' · logotipo herdado do DFD' : '';
    toast(`DFD importado · ${qtdAplicados} campo(s)${msgLogo}.`);
    fecharImportarDFD();
    goTo(0);

    setTimeout(() => {
      ['objeto','unidade','responsavel','cargoResponsavel','necessidade','processo','orgao',
       'dotacaoOrcamentaria','fonteRecurso','modalidadePretendida','criterioJulgamento',
       'prazoExecucao','localEntrega','condicoesPagamento',
       'fiscalTitular','fiscalSubstituto','gestorContrato','qtdDescricao'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value){
          el.style.transition = 'box-shadow .4s';
          el.style.boxShadow = '0 0 0 3px rgba(16,185,129,.35)';
          setTimeout(() => el.style.boxShadow = '', 1400);
        }
      });
    }, 200);
  } catch(err){
    console.error('[DFD] Falha ao aplicar importação:', err);
    toast('Erro ao aplicar o DFD: ' + (err?.message || err));
  }
}

function aplicarLogoCapturada(dataUrl, origem = 'dfd'){
  if (!dataUrl) return;
  logoDataUrl = dataUrl;
  logoOrigem  = origem;
  const img     = document.getElementById('logoPreviewImg');
  const empty   = document.getElementById('logoDropzoneEmpty');
  const preview = document.getElementById('logoDropzonePreview');
  const dz      = document.getElementById('logoDropzone');
  const nameEl  = document.getElementById('logoPreviewName');
  const sizeEl  = document.getElementById('logoPreviewSize');
  if (img)     img.src = dataUrl;
  if (nameEl)  nameEl.textContent = origem === 'dfd' ? 'logotipo-herdado-do-dfd.png' : 'logotipo.png';
  if (sizeEl)  sizeEl.textContent = origem === 'dfd' ? '— herdado do DFD —' : '— carregado —';
  empty?.classList.add('hidden');
  preview?.classList.remove('hidden');
  dz?.classList.add('has-file');
  if (dz){
    dz.style.transition = 'box-shadow .5s';
    dz.style.boxShadow = '0 0 0 4px rgba(16,185,129,.45)';
    setTimeout(() => { dz.style.boxShadow = ''; }, 1800);
  }
}

/* =====================================================================
   10.12 · SANITIZAÇÃO FINAL (RENDER)
   ===================================================================== */
function sanitizarTextoRender(s){
  if (s == null) return '';
  let t = String(s);
  t = t.replace(/[\[\]·•\-–—]*\s*(?:P[áa]gina|Page)\s+\d+\s*(?:de|of|\/)\s*\d+\s*[\[\]·•\-–—]*/gi, ' ');
  t = t.replace(/^\s*\d+\s*(?:de|\/)\s*\d+\s*$/gm, ' ');
  t = t.replace(/\s{2,}/g, ' ').trim();
  t = t.replace(/^[\s:;\-–—,\.]+|[\s:;\-–—,\.]+$/g, '').trim();
  return t;
}

/* =====================================================================
   11. HELPERS PDF
   ===================================================================== */
const BRAND = '#0F2F5B', BRAND2 = '#1E6F5C', MUTED = '#64748B', LINEC = '#CBD5E1';
const PAGE_MARGINS = [40, 45, 40, 50];

function txtBloco(t){
  const limpo = sanitizarTextoRender(t);
  if (!limpo || !limpo.trim()) return [{ text:'— não informado —', italics:true, color:'#94A3B8', fontSize:9.5 }];
  const lines = String(limpo).split('\n').map(l => sanitizarTextoRender(l)).filter(Boolean);
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
  { table: { widths:['*'], body: [[{ text:`${n} — ${t}`, bold:true, fontSize:10, color:'#FFFFFF', fillColor:BRAND, margin:[8,6,8,6], characterSpacing:0.3 }]] }, layout:'noBorders', margin:[0,12,0,7] },
  ...blocos
]});

function tabelaDados(header, rows, widths, opts = {}){
  const { wrapCols = [] } = opts;
  if (!rows.length) return { text:'— não informado —', italics:true, color:'#94A3B8', fontSize:9.5, margin:[0,2,0,8] };
  return {
    table: {
      headerRows: 1, widths,
      body: [
        header.map(h => ({ text: sanitizarTextoRender(h), bold:true, fontSize:7.5, color:'#FFFFFF', fillColor:BRAND2, margin:[4,5,4,5], noWrap:false })),
        ...rows.map(r => r.map((c, idx) => ({
          text: sanitizarTextoRender(String(c ?? '')),
          fontSize: wrapCols.includes(idx) ? 8 : 8.5,
          color:'#1E293B',
          margin:[4,4,4,4],
          noWrap:false
        })))
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
   12. BLOCOS PDF
   ===================================================================== */
function blocoCapa(d, conf, meta){
  const logoImg = logoDataUrl || logoPadraoPng;
  const logo = logoImg ? { image: logoImg, width: 78, alignment: 'center', margin: [0, 0, 0, 14] } : { text: '', margin: [0, 0, 0, 6] };
  const objetoLimpo = sanitizarTextoRender(d.id.objeto);
  const resumo = [
    ['Nº do ETP',             `${sanitizarTextoRender(d.id.numero) || '—'} / ${sanitizarTextoRender(d.id.exercicio) || '—'}`],
    ['Processo',              sanitizarTextoRender(d.id.processo) || '—'],
    ['Órgão / Unidade',       `${sanitizarTextoRender(d.id.orgao) || '—'}${d.id.unidade ? ' — ' + sanitizarTextoRender(d.id.unidade) : ''}`],
    ['Objeto',                objetoLimpo || '—'],
    ['Responsável técnico',   `${sanitizarTextoRender(d.id.responsavel) || '—'}${d.id.cargo ? ' — ' + sanitizarTextoRender(d.id.cargo) : ''}`],
    ['Valor total estimado',  moeda(d.precos.total)],
    ['Posicionamento',        sanitizarTextoRender(d.conc.posicionamento) || '—'],
    ['Score de conformidade', `${conf.score}% (${conf.linhas.filter(l => l.pct === 100).length}/${conf.linhas.length} incisos atendidos)`]
  ];
  return {
    stack: [
      { text:'', margin:[0,20,0,0] }, logo,
      { text: sanitizarTextoRender((d.id.orgao || 'ÓRGÃO / ENTIDADE').toUpperCase()), alignment:'center', bold:true, fontSize:13, color:BRAND, characterSpacing:0.5 },
      { text: sanitizarTextoRender(d.id.unidade || ''), alignment:'center', fontSize:9, color:MUTED, margin:[0,3,0,0] },
      { text: d.id.uasg ? `UASG ${sanitizarTextoRender(d.id.uasg)}` : '', alignment:'center', fontSize:8, color:MUTED, margin:[0,2,0,0] },
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
      { text:`Documento emitido eletronicamente em ${new Date().toLocaleString('pt-BR')} · TAG ${meta.tag}`, alignment:'center', fontSize:7, color:'#94A3B8' }
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
      { text:'O presente Estudo Técnico Preliminar (ETP) constitui documento constitutivo da fase preparatória da contratação, elaborado em observância ao disposto no art. 18, § 1º, da Lei nº 14.133/2021, e tem por finalidade:', fontSize:9.5, alignment:'justify', lineHeight:1.45, color:'#1E293B', margin:[0,0,0,8] },
      { ul: ['Caracterizar o interesse público e descrever a necessidade a ser atendida;','Demonstrar a melhor solução dentre as alternativas de mercado analisadas;','Fundamentar a estimativa de quantidades, de preços e a definição dos requisitos;','Evidenciar os resultados pretendidos e os ganhos de economicidade;','Subsidiar a elaboração do Termo de Referência ou Projeto Básico.'], fontSize:9.5, lineHeight:1.4, color:'#1E293B', margin:[0,0,0,8] },
      { text:'A instrução processual observa, ainda, o disposto no art. 5º da Lei nº 14.133/2021, quanto aos princípios do planejamento, da transparência, da eficiência e da motivação dos atos administrativos, bem como o art. 11, que impõe a padronização e a rastreabilidade documental dos processos de contratação.', fontSize:9.5, alignment:'justify', lineHeight:1.45, color:'#1E293B', margin:[0,0,0,8] },
      { text:'O documento é rastreável e auditável, sendo identificado por TAG de autenticação exclusiva e hash de integridade SHA-256, aptos à validação automatizada por sistemas de auditoria (LicitaAudit).', fontSize:9.5, alignment:'justify', lineHeight:1.45, color:'#1E293B' }
    ], margin:[16,16,16,16] }]] },
      layout:{ hLineWidth:()=>1, vLineWidth:()=>1, hLineColor:()=>BRAND2, vLineColor:()=>BRAND2,
               paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0 } },
    { text:'', margin:[0,18,0,0] },
    { canvas: [{ type:'line', x1:60, y1:0, x2:455, y2:0, lineWidth:0.6, lineColor:LINEC }] },
    { text:`Processo administrativo nº ${sanitizarTextoRender(d.id.processo) || '—'} · ETP nº ${sanitizarTextoRender(d.id.numero) || '—'}/${sanitizarTextoRender(d.id.exercicio) || '—'}`, alignment:'center', fontSize:8, color:MUTED, margin:[0,10,0,0] }
  ], pageBreak: 'after' };
}

function blocoConformidade(d, conf, meta){
  const linhas = conf.linhas.map(l => [
    { text:l.n, bold:true, alignment:'center' },
    { text: sanitizarTextoRender(l.t) },
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
    secao('II', 'ALINHAMENTO AO PCA E ENQUADRAMENTO ORÇAMENTÁRIO', [
      campo('Previsão no PCA', d.pca.previsto),
      campo('Item / código do PCA', d.pca.item),
      campo('Justificativa do alinhamento', d.pca.justificativa),
      campo('Dotação orçamentária', d.enq.dotacao),
      campo('Fonte de recurso', d.enq.fonte),
      campo('Modalidade pretendida', d.enq.modalidade),
      campo('Critério de julgamento', d.enq.criterio)
    ]),
    secao('III', 'REQUISITOS DA CONTRATAÇÃO', [
      campo('Critérios de sustentabilidade', d.req.sustentaveis.length ? d.req.sustentaveis.map(s => '- ' + s).join('\n') : ''),
      campo('Requisitos técnicos e de desempenho', d.req.tecnicos),
      campo('Requisitos de habilitação técnica', d.req.habilitacao),
      campo('Garantia, assistência técnica e manutenção', d.req.garantia),
      campo('Embalagem, entrega e recebimento', d.req.entrega)
    ]),
    secao('IV', 'ESTIMATIVA DE QUANTIDADES E MEMÓRIA DE CÁLCULO', [
      campo('Descrição quantitativa (extraída do DFD)', d.qtd.descricao),
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
      campo('Método de estimativa adotado', sanitizarTextoRender(d.precos.metodo)),
      tabelaDados(
        ['ITEM / FONTE', 'DESCRIÇÃO / FORNECEDOR', 'VALOR UNIT.', 'QTD.', 'TOTAL'],
        d.precos.itens.map(i => [
          sanitizarTextoRender(i.item)  || '—',
          sanitizarTextoRender(i.fonte) || '—',
          moeda(i.unitario),
          sanitizarTextoRender(i.quantidade) || '—',
          moeda(i.total)
        ]),
        /* v2.6 · Larguras fixas — soma 495pt em A4 */
        [115, 195, 70, 40, 75],
        { wrapCols: [1] }
      ),
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
      campo('Ciclo de vida e sustentabilidade', d.solucao.ciclo),
      campo('Prazo de execução', d.prazos.execucao),
      campo('Local de entrega', d.prazos.local),
      campo('Condições de pagamento', d.prazos.pagamento)
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
        { text:(sanitizarTextoRender(a.papel) || 'AGENTE').toUpperCase(), fontSize:7.5, bold:true, color:BRAND2, characterSpacing:0.6, margin:[0,0,0,26] },
        { canvas:[{ type:'line', x1:0, y1:0, x2:215, y2:0, lineWidth:0.8, lineColor:'#94A3B8' }] },
        { text: sanitizarTextoRender(a.nome) || '—', bold:true, fontSize:9, color:'#0F172A', margin:[0,5,0,0] },
        { text: sanitizarTextoRender(a.cargo) || '—', fontSize:8, color:'#475569', margin:[0,1,0,0] },
        { text: sanitizarTextoRender(a.orgao) || '—', fontSize:7.5, color:MUTED, margin:[0,1,0,0] },
        a.matricula ? { text:`Matrícula: ${sanitizarTextoRender(a.matricula)}`, fontSize:7, color:'#94A3B8', margin:[0,2,0,0] } : { text:'' },
        { text:'Assinatura / Carimbo', fontSize:6.5, italics:true, color:'#94A3B8', margin:[0,4,0,0] }
      ], margin:[0,6,12,20]
    }));
    while (cells.length < 2) cells.push({ text:'' });
    rows.push(cells);
  }

  const g = d.governanca || {};
  const temGovernanca = g.fiscalTitular || g.fiscalSubstituto || g.gestor;

  const blocoGovernanca = temGovernanca
    ? [{ stack: [
        { text:'GOVERNANÇA CONTRATUAL', fontSize:8, bold:true, color:BRAND2, characterSpacing:0.8, margin:[0,0,0,8] },
        { table: {
            widths:['*','*','*'],
            body: [[
              { text:'FISCAL TITULAR',    fontSize:7, bold:true, color:BRAND2, fillColor:'#F8FAFC', alignment:'center', margin:[6,5,6,3] },
              { text:'FISCAL SUBSTITUTO', fontSize:7, bold:true, color:BRAND2, fillColor:'#F8FAFC', alignment:'center', margin:[6,5,6,3] },
              { text:'GESTOR DO CONTRATO',fontSize:7, bold:true, color:BRAND2, fillColor:'#F8FAFC', alignment:'center', margin:[6,5,6,3] }
            ],[
              { text: sanitizarTextoRender(g.fiscalTitular)    || '—', fontSize:8.5, color:'#1E293B', alignment:'center', margin:[6,4,6,6] },
              { text: sanitizarTextoRender(g.fiscalSubstituto) || '—', fontSize:8.5, color:'#1E293B', alignment:'center', margin:[6,4,6,6] },
              { text: sanitizarTextoRender(g.gestor)           || '—', fontSize:8.5, color:'#1E293B', alignment:'center', margin:[6,4,6,6] }
            ]]
          },
          layout:{ hLineWidth:()=>0.5, vLineWidth:()=>0.5, hLineColor:()=>LINEC, vLineColor:()=>LINEC,
                   paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0 },
          margin:[0,0,0,14] }
      ]}]
    : [];

  return { stack: [
    { text:'FOLHA DE APROVAÇÃO E VALIDAÇÃO', bold:true, fontSize:12, color:BRAND, characterSpacing:0.8, margin:[0,6,0,2] },
    { text:'Documento sujeito a manifestação dos agentes abaixo identificados', fontSize:8.5, color:MUTED, margin:[0,0,0,16] },
    ...blocoGovernanca,
    { table:{ widths:['*','*'], body:rows }, layout:'noBorders', dontBreakRows:true, margin:[0,0,0,10] },
    { text:'', margin:[0,10,0,0] },
    { table: { widths:['*'], body: [[{ stack:[
      { text:'DECLARAÇÃO DE CIÊNCIA', fontSize:7.5, bold:true, color:BRAND2, characterSpacing:0.6, margin:[0,0,0,5] },
      { text:'Os agentes signatários declaram ter analisado o presente Estudo Técnico Preliminar e manifestam-se de acordo com o conteúdo técnico, a estimativa de quantidades, a estimativa de preços e o posicionamento conclusivo quanto à viabilidade da contratação, nos termos do art. 18 da Lei nº 14.133/2021.', fontSize:8.5, alignment:'justify', lineHeight:1.4, color:'#334155' }
    ], margin:[12,11,12,11] }]] },
      layout:{ hLineWidth:()=>0.5, vLineWidth:()=>0.5, hLineColor:()=>LINEC, vLineColor:()=>LINEC,
               paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0 } },
    { text:`${sanitizarTextoRender(d.id.unidade) || ''}${d.id.unidade && d.id.orgao ? ' — ' : ''}${sanitizarTextoRender(d.id.orgao) || ''}, ${dataBR(d.id.data)}.`, alignment:'right', fontSize:9, color:'#334155', margin:[0,22,0,0] }
  ], pageBreak:'before' };
}

function blocoAutenticacao(d, meta){
  const caixaLayout = { hLineWidth:()=>1.2, vLineWidth:()=>1.2, hLineColor:()=>BRAND, vLineColor:()=>BRAND,
    paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0 };
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
         { text:`${sanitizarTextoRender(d.id.exercicio) || '—'}`, fontSize:8.5, bold:true, color:'#0F172A', alignment:'center', margin:[0,2,0,6] }],
        [{ text:'Nº DO ETP', fontSize:6.8, bold:true, color:MUTED, alignment:'center', margin:[0,4,0,2] },
         { text:'PROCESSO', fontSize:6.8, bold:true, color:MUTED, alignment:'center', margin:[0,4,0,2] }],
        [{ text:`${sanitizarTextoRender(d.id.numero) || '—'}/${sanitizarTextoRender(d.id.exercicio) || '—'}`, fontSize:8.5, bold:true, color:'#0F172A', alignment:'center', margin:[0,2,0,6] },
         { text: sanitizarTextoRender(d.id.processo) || '—', fontSize:8.5, bold:true, color:'#0F172A', alignment:'center', margin:[0,2,0,6] }]
      ]}, layout:{ hLineWidth:()=>0.4, vLineWidth:()=>0.4, hLineColor:()=>'#E2E8F0', vLineColor:()=>'#E2E8F0',
                   paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0 } }
    ], margin:[22,20,22,20] }]] }, layout: caixaLayout },
    { text:'', margin:[0,16,0,0] },
    { table: { widths:['*'], body: [[{ stack: [
      { text:'AVISO DE AUDITORIA E INTEGRAÇÃO', fontSize:7.5, bold:true, color:'#92400E', characterSpacing:0.6, margin:[0,0,0,5] },
      { text:'Este documento é auditável eletronicamente. A autenticidade pode ser verificada pela conferência da TAG exclusiva e do hash SHA-256 junto ao repositório institucional ou ao módulo LicitaAudit. Qualquer alteração posterior de conteúdo invalida o hash registrado, caracterizando adulteração documental.', fontSize:8, alignment:'justify', lineHeight:1.4, color:'#78350F', margin:[0,0,0,6] },
      { text:'A ausência de assinatura física não prejudica a validade do ato, nos termos do art. 4º, incisos I e II, e do art. 5º da Lei nº 14.133/2021, e da MP nº 2.200-2/2001.', fontSize:7.5, italics:true, color:'#92400E' }
    ], margin:[12,11,12,11] }]] },
      layout:{ hLineWidth:()=>1, vLineWidth:()=>1, hLineColor:()=>'#FCD34D', vLineColor:()=>'#FCD34D',
               paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0 }, fillColor:'#FFFBEB' },
    { text:'', margin:[0,26,0,0] },
    { canvas:[{ type:'line', x1:100, y1:0, x2:415, y2:0, lineWidth:0.5, lineColor:LINEC }] },
    { text:'LicitaETP · Módulo de Estudo Técnico Preliminar · Padrão de auditoria LicitaAudit', alignment:'center', fontSize:7, color:'#94A3B8', margin:[0,8,0,0] },
    { text:'— FIM DO DOCUMENTO —', alignment:'center', fontSize:7, bold:true, color:'#94A3B8', characterSpacing:1, margin:[0,4,0,0] }
  ], pageBreak:'before' };
}

/* =====================================================================
   13. MONTAGEM
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
      creator: 'LicitaETP v2.6'
    },
    header: (cp, total) => {
      if (cp <= 3 || cp === total) return null;
      return { margin: [40, 18, 40, 0], columns: [
        { text: sanitizarTextoRender((d.id.orgao || '').toUpperCase()), fontSize:7, color:'#94A3B8', bold:true },
        { text: `ETP nº ${sanitizarTextoRender(d.id.numero) || '—'}/${sanitizarTextoRender(d.id.exercicio) || '—'}`, fontSize:7, color:'#94A3B8', alignment:'right' }
      ]};
    },
    footer: (cp, total) => {
      if (cp === 1) return null;
      return { margin: [40, 14, 40, 0], columns: [
        { text: `TAG ${meta.tag}`, fontSize:6.5, color:'#94A3B8' },
        { text: `Página ${cp} de ${total}`, fontSize:6.5, color:'#94A3B8', alignment:'right' }
      ]};
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
   14. UTILITÁRIOS
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
   15. GERAR PDF
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
    console.info('[LicitaAudit] Payload de auditoria:', { tag, hash, arquivo, conformidade: conf.score, logoOrigem, dados:d });
  });
}

/* =====================================================================
   16. EXPORTAR JSON
   ===================================================================== */
async function exportarJSON(){
  const d = coletarDados();
  const conf = calcularConformidade(d);
  const exercicio = (d.id.exercicio || '').match(/\d{4}/)?.[0] || String(new Date().getFullYear());
  const tag = `LICITAETP::ETP::${gerarCodigo()}::${exercicio}`;
  const emitidoEm = new Date().toISOString();
  const hash = await sha256Hex(JSON.stringify({ etp:d, tag, emitidoEm }));
  const pacote = {
    sistema:'LicitaETP', versao:'2.6.0', trilha:'LICITAETP', tipo:'auditoria',
    tag, hash, emitidoEm,
    logo: logoDataUrl, logoOrigem,
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
   17. RASCUNHO
   ===================================================================== */
function salvarRascunho(){
  try {
    const pacote = {
      sistema:'LicitaETP', versao:'2.6.0', tipo:'rascunho',
      salvoEm: new Date().toISOString(),
      logo: logoDataUrl, logoOrigem,
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
function abrirCarregarRascunho(){ document.getElementById('jsonFile')?.click(); }

async function processarArquivoJSON(file){
  try {
    const txt = await file.text();
    const pacote = JSON.parse(txt);
    const d = pacote.dados || pacote;
    aplicarDados(d);
    if (pacote.logo){
      aplicarLogoCapturada(pacote.logo, 'rascunho');
      const nameEl = document.getElementById('logoPreviewName');
      const sizeEl = document.getElementById('logoPreviewSize');
      if (nameEl) nameEl.textContent = 'logotipo-restaurado.png';
      if (sizeEl) sizeEl.textContent = '— restaurado do rascunho —';
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

  /* v2.6 */
  setV('dotacaoOrcamentaria', d.enq?.dotacao);
  setV('fonteRecurso', d.enq?.fonte);
  setV('modalidadePretendida', d.enq?.modalidade);
  setV('criterioJulgamento', d.enq?.criterio);

  const sustSet = new Set(d.req?.sustentaveis || []);
  document.querySelectorAll('input[name="sustent"]').forEach(cb => { cb.checked = sustSet.has(cb.value); });
  setV('reqTecnicos', d.req?.tecnicos); setV('reqHabilitacao', d.req?.habilitacao);
  setV('reqGarantia', d.req?.garantia); setV('reqEntrega', d.req?.entrega);

  setV('qtdDescricao', d.qtd?.descricao);
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
  /* v2.6 · prazos */
  setV('prazoExecucao', d.prazos?.execucao);
  setV('localEntrega', d.prazos?.local);
  setV('condicoesPagamento', d.prazos?.pagamento);

  setV('parcelar', d.parcel?.decisao); setV('itensParcelaveis', d.parcel?.itens); setV('justificativaParcelamento', d.parcel?.justificativa);
  setV('resultados', d.result?.resultados); setV('economicidade', d.result?.economicidade); setV('indicadores', d.result?.indicadores);
  setV('providencias', d.prov?.providencias); setV('correlatas', d.prov?.correlatas); setV('impactoProvidencias', d.prov?.impacto);
  setV('posicionamento', d.conc?.posicionamento); setV('recomendacoes', d.conc?.recomendacoes); setV('conclusao', d.conc?.conclusao);

  /* v2.6 · governança */
  setV('fiscalTitular', d.governanca?.fiscalTitular);
  setV('fiscalSubstituto', d.governanca?.fiscalSubstituto);
  setV('gestorContrato', d.governanca?.gestor);

  const lst = document.getElementById('listaAprovadores');
  if (lst){ lst.innerHTML = ''; (d.aprov || []).forEach(addAprovador); if (!(d.aprov||[]).length) addAprovador({ papel:'Elaborador' }); }
}

/* =====================================================================
   18. DROPZONE LOGO
   ===================================================================== */
function inicializarDropzoneLogo(){
  const dz = document.getElementById('logoDropzone');
  const input = document.getElementById('logoFile');
  if (!dz || !input) return;
  const empty = document.getElementById('logoDropzoneEmpty');
  const preview = document.getElementById('logoDropzonePreview');
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
  input.addEventListener('change', e => { const f = e.target.files?.[0]; if (f) processar(f); });
  removeBtn?.addEventListener('click', e => {
    e.stopPropagation();
    logoDataUrl = null; logoOrigem = 'default';
    input.value = '';
    preview?.classList.add('hidden'); empty?.classList.remove('hidden');
    dz.classList.remove('has-file');
    toast('Logotipo removido. Voltando à logo padrão.');
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
      aplicarLogoCapturada(dataUrl, 'manual');
      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = fmt(file.size);
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
   19. DROPZONE DFD
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
  aplicarTema(lerTemaSalvo());
  injetarIdentidadeVisual();

  try { logoPadraoPng = await svgToPngDataUrl(SVG_LOGO, 256); }
  catch(e){ console.warn('Falha ao pré-renderizar logo padrão.', e); }

  const dtEl = document.getElementById('dataElaboracao');
  if (dtEl && !dtEl.value) dtEl.value = new Date().toISOString().slice(0, 10);

  panels = $$('[data-panel]');
  TOTAL  = panels.length;

  preencherNumeroETPInicial();
  const numEl = document.getElementById('numeroEtp');
  numEl?.addEventListener('input', marcarNumeroEditado);
  const exEl = document.getElementById('exercicio');
  exEl?.addEventListener('change', () => {
    if (!document.getElementById('numeroEtp').dataset.userEdited) preencherNumeroETPInicial();
  });

  inicializarDropzoneLogo();
  inicializarDropzoneDFD();

  document.getElementById('jsonFile')?.addEventListener('change', e => {
    const f = e.target.files?.[0]; if (f) processarArquivoJSON(f);
    e.target.value = '';
  });

  addQtd();
  addMercado(); addMercado();
  addPreco();
  addAprovador({ papel: 'Elaborador' });

  document.addEventListener('input', e => {
    if (e.target.closest('#tbPreco')) recalcularTotal();
  });

  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('.modal-overlay.show').forEach(m => m.classList.remove('show'));
  });

  renderNav();
  goTo(0);

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

  if (deveExibirWelcome()){ setTimeout(abrirWelcome, 500); }
});

/* =====================================================================
   FIM — LicitaETP v2.6
   ===================================================================== */
