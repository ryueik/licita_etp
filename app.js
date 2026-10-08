/* =====================================================================
   LICITAETP — NÚCLEO DE APLICAÇÃO (v1.1.0)
   Estudo Técnico Preliminar · Lei nº 14.133/2021
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
   1. IDENTIDADE VISUAL — LOGO / FAVICON SVG VERDE
   ===================================================================== */
const SVG_LOGO = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="etpGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10B981"/>
      <stop offset="1" stop-color="#0D9488"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#etpGrad)"/>
  <text x="32" y="43"
        font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        font-size="26" font-weight="900"
        fill="#04140E" text-anchor="middle"
        letter-spacing="0.5">ETP</text>
</svg>`.trim();

function svgToDataUrl(svg){
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function svgToPngDataUrl(svg, size = 256){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = svgToDataUrl(svg);
  });
}

function injetarIdentidadeVisual(){
  const link = document.getElementById('favicon');
  if (link) link.href = svgToDataUrl(SVG_LOGO);
  const brand = document.getElementById('brandLogo');
  if (brand) brand.innerHTML = SVG_LOGO;
}

/* =====================================================================
   2. PALETA DO PDF (mantém identidade executiva clara)
   ===================================================================== */
const BRAND   = '#0F2F5B';
const BRAND2  = '#1E6F5C';
const MUTED   = '#64748B';
const LINEC   = '#CBD5E1';
const PAGE_MARGINS = [40, 45, 40, 50];

/* =====================================================================
   3. ESTADO GLOBAL
   ===================================================================== */
let logoDataUrl   = null;   // dataURL do logotipo enviado pelo usuário
let logoPadraoPng = null;   // PNG pré-renderizado do logo SVG (fallback no PDF)
let current = 0;

/* =====================================================================
   4. NAVEGAÇÃO / WIZARD
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

let panels = [];
let TOTAL  = 0;

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
   5. LINHAS DINÂMICAS — TABELAS
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
    <td><input class="inp" data-k="total" readonly style="background:var(--bg-1)"></td>
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
   6. COLETA DE DADOS
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
    nec: {
      necessidade: v('necessidade'),
      causaRaiz: v('causaRaiz'),
      publicoAlvo: v('publicoAlvo')
    },
    pca: {
      previsto: v('pcaPrevisto'),
      item: v('pcaItem'),
      justificativa: v('pcaJustificativa')
    },
    req: {
      sustentaveis: checks('sustent'),
      tecnicos: v('reqTecnicos'),
      habilitacao: v('reqHabilitacao'),
      garantia: v('reqGarantia'),
      entrega: v('reqEntrega')
    },
    qtd: {
      itens: readTable('tbQtd', ['item','descricao','quantidade','unidade','memoria']),
      metodo: v('metodoQtd')
    },
    mercado: {
      alternativas: readTable('tbMercado', ['alternativa','descricao','vantagens','riscos']),
      conclusao: v('conclusaoMercado')
    },
    precos: {
      metodo: v('metodoPreco'),
      itens: readTable('tbPreco', ['item','fonte','unitario','quantidade','total']),
      observacoes: v('obsPreco'),
      total: recalcularTotal()
    },
    solucao: {
      descricao: v('descricaoSolucao'),
      entregas: v('entregas'),
      ciclo: v('cicloVida')
    },
    parcel: {
      decisao: v('parcelar'),
      itens: v('itensParcelaveis'),
      justificativa: v('justificativaParcelamento')
    },
    result: {
      resultados: v('resultados'),
      economicidade: v('economicidade'),
      indicadores: v('indicadores')
    },
    prov: {
      providencias: v('providencias'),
      correlatas: v('correlatas'),
      impacto: v('impactoProvidencias')
    },
    conc: {
      posicionamento: v('posicionamento'),
      recomendacoes: v('recomendacoes'),
      conclusao: v('conclusao')
    },
    aprov: $$('#listaAprovadores > .aprov-card').map(div => {
      const g = k => div.querySelector(`[data-a="${k}"]`)?.value.trim() || '';
      return {
        nome: g('nome'), papel: g('papel'), cargo: g('cargo'),
        orgao: g('orgao'), matricula: g('matricula')
      };
    }).filter(a => a.nome || a.cargo)
  };
}

/* =====================================================================
   7. CONFORMIDADE — SCORE POR INCISO
   ===================================================================== */
const INCISOS = [
  { n:'I',    t:'Descrição da necessidade (problema a ser resolvido)',   f:d => [d.nec.necessidade, d.nec.causaRaiz, d.nec.publicoAlvo] },
  { n:'II',   t:'Alinhamento ao Plano de Contratações Anual (PCA)',      f:d => [d.pca.previsto, d.pca.item, d.pca.justificativa] },
  { n:'III',  t:'Requisitos da contratação (sustentabilidade e padrões)', f:d => [d.req.sustentaveis.join(' '), d.req.tecnicos, d.req.habilitacao, d.req.garantia, d.req.entrega] },
  { n:'IV',   t:'Estimativa de quantidades e memória de cálculo',        f:d => [d.qtd.metodo, d.qtd.itens.map(i => JSON.stringify(i)).join(' ')] },
  { n:'V',    t:'Levantamento de mercado e alternativas',                f:d => [d.mercado.conclusao, d.mercado.alternativas.map(i => JSON.stringify(i)).join(' ')] },
  { n:'VI',   t:'Estimativa preliminar de preços e método de cotação',   f:d => [d.precos.metodo, d.precos.observacoes, d.precos.itens.map(i => JSON.stringify(i)).join(' ')] },
  { n:'VII',  t:'Descrição da solução como um todo',                     f:d => [d.solucao.descricao, d.solucao.entregas, d.solucao.ciclo] },
  { n:'VIII', t:'Justificativa para parcelamento (ou não)',              f:d => [d.parcel.decisao, d.parcel.itens, d.parcel.justificativa] },
  { n:'IX',   t:'Resultados pretendidos (economicidade)',                f:d => [d.result.resultados, d.result.economicidade, d.result.indicadores] },
  { n:'X',    t:'Providências prévias e contratações correlatas',        f:d => [d.prov.providencias, d.prov.correlatas, d.prov.impacto] },
  { n:'XI',   t:'Posicionamento conclusivo sobre a viabilidade',         f:d => [d.conc.posicionamento, d.conc.recomendacoes, d.conc.conclusao] }
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
   8. HELPERS DE CONTEÚDO PDF
   ===================================================================== */
function txtBloco(t){
  if (!t || !String(t).trim())
    return [{ text:'— não informado —', italics:true, color:'#94A3B8', fontSize:9.5 }];

  const lines = String(t).split('\n').map(l => l.trim()).filter(Boolean);
  const out = []; let ul = [];
  const flush = () => {
    if (ul.length){
      out.push({ ul, fontSize:9.5, lineHeight:1.3, margin:[0,0,0,6], color:'#1E293B' });
      ul = [];
    }
  };
  lines.forEach(l => {
    if (/^[-•*]\s+/.test(l)) ul.push(l.replace(/^[-•*]\s+/, ''));
    else {
      flush();
      out.push({ text:l, fontSize:9.5, lineHeight:1.4, alignment:'justify', color:'#1E293B', margin:[0,0,0,6] });
    }
  });
  flush();
  return out.length ? out : [{ text:'— não informado —', italics:true, color:'#94A3B8', fontSize:9.5 }];
}

function campo(rotulo, valor){
  return { stack: [
    { text: rotulo.toUpperCase(), fontSize:7.5, bold:true, color:BRAND2, characterSpacing:0.6, margin:[0,7,0,3] },
    ...txtBloco(valor)
  ]};
}

function secao(inciso, titulo, blocos){
  return { stack: [
    { table: { widths:['*'], body: [[{
        text:`${inciso} — ${titulo}`, bold:true, fontSize:10, color:'#FFFFFF',
        fillColor:BRAND, margin:[8,6,8,6], characterSpacing:0.3
      }]] },
      layout:'noBorders', margin:[0,12,0,7] },
    ...blocos
  ]};
}

function tabelaDados(header, rows, widths){
  if (!rows.length)
    return { text:'— não informado —', italics:true, color:'#94A3B8', fontSize:9.5, margin:[0,2,0,8] };

  return {
    table: {
      headerRows: 1,
      widths,
      body: [
        header.map(h => ({ text:h, bold:true, fontSize:7.5, color:'#FFFFFF', fillColor:BRAND2, margin:[4,5,4,5] })),
        ...rows.map(r => r.map(c => ({ text:String(c ?? ''), fontSize:8.5, color:'#1E293B', margin:[4,4,4,4] })))
      ]
    },
    layout: {
      hLineWidth: () => 0.5, vLineWidth: () => 0.5,
      hLineColor: () => LINEC, vLineColor: () => LINEC,
      paddingLeft: () => 2, paddingRight: () => 2, paddingTop: () => 1, paddingBottom: () => 1
    },
    margin: [0, 2, 0, 10]
  };
}

function barra(pct){
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return {
    table: { widths: [`${p}%`, `${100 - p}%`], body: [[
      { text:'', fillColor: p >= 80 ? '#15803D' : p >= 50 ? '#B45309' : '#B91C1C',
        border:[false,false,false,false], margin:[0,4,0,4] },
      { text:'', fillColor:'#E2E8F0', border:[false,false,false,false], margin:[0,4,0,4] }
    ]]},
    layout: 'noBorders'
  };
}

const moeda = n => Number(n || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
const dataBR = iso => {
  if (!iso) return new Date().toLocaleDateString('pt-BR');
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

/* =====================================================================
   9. BLOCO 1 — CAPA / TERMO DE ABERTURA EXECUTIVO
   ===================================================================== */
function blocoCapa(d, conf, meta){
  const logoImg = logoDataUrl || logoPadraoPng;
  const logo = logoImg
    ? { image: logoImg, width: 78, alignment: 'center', margin: [0, 0, 0, 14] }
    : { text: '', margin: [0, 0, 0, 6] };

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
      { text: '', margin: [0, 20, 0, 0] },
      logo,
      { text: (d.id.orgao || 'ÓRGÃO / ENTIDADE').toUpperCase(),
        alignment:'center', bold:true, fontSize:13, color:BRAND, characterSpacing:0.5 },
      { text: d.id.unidade || '', alignment:'center', fontSize:9, color:MUTED, margin:[0,3,0,0] },
      { text: d.id.uasg ? `UASG ${d.id.uasg}` : '',
        alignment:'center', fontSize:8, color:MUTED, margin:[0,2,0,0] },
      { canvas: [{ type:'line', x1:150, y1:0, x2:365, y2:0, lineWidth:1.1, lineColor:BRAND2 }],
        margin:[0,12,0,16] },
      { text:'ESTUDO TÉCNICO PRELIMINAR',
        alignment:'center', bold:true, fontSize:19, color:BRAND, characterSpacing:1.2 },
      { text:'E T P',
        alignment:'center', bold:true, fontSize:11, color:BRAND2, characterSpacing:6, margin:[0,3,0,0] },
      { text:'Fundamentação legal: Lei nº 14.133/2021, art. 18, § 1º, incisos I a XI',
        alignment:'center', fontSize:8.5, color:MUTED, margin:[0,9,0,0] },
      { text:'Documento integrante da fase preparatória da contratação',
        alignment:'center', fontSize:8, italics:true, color:MUTED, margin:[0,2,0,0] },
      { text:'', margin:[0,16,0,0] },
      {
        table: {
          widths: [135, '*'],
          body: resumo.map(([k, v]) => [
            { text: k.toUpperCase(), fontSize:7.8, bold:true, color:BRAND2, fillColor:'#F8FAFC', margin:[8,6,8,6] },
            { text: String(v), fontSize:9, color:'#1E293B', margin:[8,6,8,6] }
          ])
        },
        layout: {
          hLineWidth: () => 0.5, vLineWidth: () => 0.5,
          hLineColor: () => LINEC, vLineColor: () => LINEC,
          paddingLeft: () => 0, paddingRight: () => 0,
          paddingTop: () => 0, paddingBottom: () => 0
        }
      },
      { text:'', margin:[0,18,0,0] },
      { text:`Documento emitido eletronicamente em ${new Date().toLocaleString('pt-BR')} · TAG ${meta.tag}`,
        alignment:'center', fontSize:7, color:'#94A3B8' }
    ],
    pageBreak: 'after'
  };
}

/* =====================================================================
   10. BLOCO 2 — NOTA DE APRESENTAÇÃO INSTITUCIONAL
   ===================================================================== */
function blocoNota(d){
  return {
    stack: [
      { text:'NOTA DE APRESENTAÇÃO INSTITUCIONAL',
        alignment:'center', bold:true, fontSize:13, color:BRAND, characterSpacing:0.8, margin:[0,40,0,4] },
      { text:'Termo de Abertura',
        alignment:'center', fontSize:9, color:MUTED, margin:[0,0,0,18] },
      {
        table: { widths:['*'], body: [[{ stack: [
          { text:'FINALIDADE LEGAL DO DOCUMENTO',
            fontSize:8, bold:true, color:BRAND2, characterSpacing:0.8, margin:[0,0,0,8] },
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
        layout: {
          hLineWidth: () => 1, vLineWidth: () => 1,
          hLineColor: () => BRAND2, vLineColor: () => BRAND2,
          paddingLeft: () => 0, paddingRight: () => 0,
          paddingTop: () => 0, paddingBottom: () => 0
        }
      },
      { text:'', margin:[0,18,0,0] },
      { canvas: [{ type:'line', x1:60, y1:0, x2:455, y2:0, lineWidth:0.6, lineColor:LINEC }] },
      { text:`Processo administrativo nº ${d.id.processo || '—'} · ETP nº ${d.id.numero || '—'}/${d.id.exercicio || '—'}`,
        alignment:'center', fontSize:8, color:MUTED, margin:[0,10,0,0] }
    ],
    pageBreak: 'after'
  };
}

/* =====================================================================
   11. BLOCO 3 — PAINEL DE CONFORMIDADE
   ===================================================================== */
function blocoConformidade(d, conf, meta){
  const linhas = conf.linhas.map(l => [
    { text: l.n, bold:true, alignment:'center' },
    l.t,
    { text: l.status, bold:true, color:l.cor, fillColor:l.bg, alignment:'center' },
    { text: `${l.pct}%`, alignment:'center', bold:true, color:l.cor }
  ]);

  return {
    stack: [
      { text:'PAINEL DE CONFORMIDADE ETP',
        bold:true, fontSize:12, color:BRAND, characterSpacing:0.8, margin:[0,6,0,2] },
      { text:'Estrutura de leitura automatizada — compatível com validação por sistemas de auditoria',
        fontSize:8.5, color:MUTED, margin:[0,0,0,12] },
      {
        table: {
          headerRows: 1,
          widths: [38, '*', 72, 42],
          body: [
            [
              { text:'INCISO', bold:true, fontSize:7.5, color:'#FFF', fillColor:BRAND, alignment:'center', margin:[4,6,4,6] },
              { text:'REQUISITO LEGAL — ART. 18, § 1º, LEI 14.133/2021', bold:true, fontSize:7.5, color:'#FFF', fillColor:BRAND, margin:[4,6,4,6] },
              { text:'STATUS', bold:true, fontSize:7.5, color:'#FFF', fillColor:BRAND, alignment:'center', margin:[4,6,4,6] },
              { text:'SCORE', bold:true, fontSize:7.5, color:'#FFF', fillColor:BRAND, alignment:'center', margin:[4,6,4,6] }
            ],
            ...linhas
          ]
        },
        layout: {
          hLineWidth: () => 0.5, vLineWidth: () => 0.5,
          hLineColor: () => LINEC, vLineColor: () => LINEC,
          paddingLeft: () => 5, paddingRight: () => 5,
          paddingTop: () => 5, paddingBottom: () => 5
        }
      },
      { text:'', margin:[0,12,0,0] },
      { columns: [
          { width:'*', stack:[
            { text:'SCORE GLOBAL DE CONFORMIDADE', fontSize:7.5, bold:true, color:BRAND2, characterSpacing:0.6, margin:[0,0,0,5] },
            barra(conf.score),
            { text:`${conf.score}% de aderência aos incisos obrigatórios`, fontSize:8.5, color:'#334155', margin:[0,6,0,0] }
          ]},
          { width:110, stack:[
            { text:'TAG', fontSize:7.5, bold:true, color:BRAND2, characterSpacing:0.6, margin:[0,0,0,5] },
            { text: meta.tag, fontSize:8, bold:true, color:BRAND, alignment:'right' }
          ]}
        ]
      },
      { text:'', margin:[0,14,0,0] },
      {
        table: { widths:['*'], body: [[{ stack:[
          { text:'CRITÉRIO DE AVALIAÇÃO AUTOMATIZADA',
            fontSize:7.5, bold:true, color:BRAND2, margin:[0,0,0,4] },
          { text:'Atendido (100%) — conteúdo descritivo com fundamentação mínima de 140 caracteres. · Parcial (50%) — conteúdo insuficiente ou incompleto. · Não preenchido (0%) — inciso sem conteúdo.',
            fontSize:8, color:'#475569', lineHeight:1.35 }
        ], margin:[10,9,10,9] }]] },
        layout: {
          hLineWidth: () => 0.5, vLineWidth: () => 0.5,
          hLineColor: () => LINEC, vLineColor: () => LINEC,
          paddingLeft: () => 0, paddingRight: () => 0,
          paddingTop: () => 0, paddingBottom: () => 0
        }
      }
    ],
    pageBreak: 'after'
  };
}

/* =====================================================================
   12. BLOCO 4 — CORPO TÉCNICO
   ===================================================================== */
function blocoCorpo(d){
  const secoes = [];

  secoes.push(secao('I', 'DESCRIÇÃO DA NECESSIDADE', [
    campo('Problema a ser resolvido', d.nec.necessidade),
    campo('Causa-raiz', d.nec.causaRaiz),
    campo('Público-alvo / beneficiários', d.nec.publicoAlvo)
  ]));

  secoes.push(secao('II', 'ALINHAMENTO AO PLANO DE CONTRATAÇÕES ANUAL — PCA', [
    campo('Previsão no PCA', d.pca.previsto),
    campo('Item / código do PCA', d.pca.item),
    campo('Justificativa do alinhamento', d.pca.justificativa)
  ]));

  secoes.push(secao('III', 'REQUISITOS DA CONTRATAÇÃO', [
    campo('Critérios de sustentabilidade',
      d.req.sustentaveis.length ? d.req.sustentaveis.map(s => '- ' + s).join('\n') : ''),
    campo('Requisitos técnicos e de desempenho', d.req.tecnicos),
    campo('Requisitos de habilitação técnica', d.req.habilitacao),
    campo('Garantia, assistência técnica e manutenção', d.req.garantia),
    campo('Embalagem, entrega e recebimento', d.req.entrega)
  ]));

  secoes.push(secao('IV', 'ESTIMATIVA DE QUANTIDADES E MEMÓRIA DE CÁLCULO', [
    tabelaDados(
      ['ITEM', 'DESCRIÇÃO', 'QTD.', 'UN.', 'MEMÓRIA DE CÁLCULO'],
      d.qtd.itens.map(i => [i.item, i.descricao, i.quantidade, i.unidade, i.memoria]),
      [32, '*', 40, 34, '*']
    ),
    campo('Metodologia da estimativa', d.qtd.metodo)
  ]));

  secoes.push(secao('V', 'LEVANTAMENTO DE MERCADO E ALTERNATIVAS', [
    tabelaDados(
      ['ALTERNATIVA', 'DESCRIÇÃO', 'VANTAGENS', 'RISCOS'],
      d.mercado.alternativas.map(a => [a.alternativa, a.descricao, a.vantagens, a.riscos]),
      ['*', '*', '*', '*']
    ),
    campo('Conclusão do levantamento de mercado', d.mercado.conclusao)
  ]));

  secoes.push(secao('VI', 'ESTIMATIVA PRELIMINAR DE PREÇOS', [
    campo('Método de estimativa adotado', d.precos.metodo),
    tabelaDados(
      ['ITEM', 'FONTE / FORNECEDOR', 'VALOR UNIT.', 'QTD.', 'TOTAL'],
      d.precos.itens.map(i => [i.item, i.fonte, moeda(i.unitario), i.quantidade, moeda(i.total)]),
      ['*', '*', 70, 40, 75]
    ),
    {
      table: { widths:['*', 150], body: [[
        { text:'VALOR TOTAL ESTIMADO DA CONTRATAÇÃO', bold:true, fontSize:9, color:BRAND, margin:[8,8,8,8], fillColor:'#F0FDF4' },
        { text: moeda(d.precos.total), bold:true, fontSize:11, color:'#15803D', alignment:'right', margin:[8,7,8,7], fillColor:'#F0FDF4' }
      ]]},
      layout: {
        hLineWidth:()=>0.5, vLineWidth:()=>0.5,
        hLineColor:()=>'#BBF7D0', vLineColor:()=>'#BBF7D0',
        paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0
      },
      margin:[0,0,0,10]
    },
    campo('Observações sobre a estimativa', d.precos.observacoes)
  ]));

  secoes.push(secao('VII', 'DESCRIÇÃO DA SOLUÇÃO COMO UM TODO', [
    campo('Descrição integrada da solução', d.solucao.descricao),
    campo('Entregas e prazos', d.solucao.entregas),
    campo('Ciclo de vida e sustentabilidade', d.solucao.ciclo)
  ]));

  secoes.push(secao('VIII', 'JUSTIFICATIVA PARA PARCELAMENTO (OU NÃO)', [
    campo('Decisão sobre parcelamento', d.parcel.decisao),
    campo('Itens / lotes parceláveis', d.parcel.itens),
    campo('Fundamentação da decisão', d.parcel.justificativa)
  ]));

  secoes.push(secao('IX', 'RESULTADOS PRETENDIDOS', [
    campo('Resultados esperados', d.result.resultados),
    campo('Ganhos de economicidade', d.result.economicidade),
    campo('Indicadores de aferição', d.result.indicadores)
  ]));

  secoes.push(secao('X', 'PROVIDÊNCIAS PRÉVIAS E CONTRATAÇÕES CORRELATAS', [
    campo('Providências prévias ao certame', d.prov.providencias),
    campo('Contratações correlatas e interdependentes', d.prov.correlatas),
    campo('Impacto da não realização', d.prov.impacto)
  ]));

  secoes.push(secao('XI', 'POSICIONAMENTO CONCLUSIVO SOBRE A VIABILIDADE', [
    campo('Posicionamento', d.conc.posicionamento),
    campo('Recomendações e condicionantes', d.conc.recomendacoes),
    campo('Conclusão técnica fundamentada', d.conc.conclusao)
  ]));

  return { stack: secoes };
}

/* =====================================================================
   13. BLOCO 5 — FOLHA DE APROVAÇÃO DINÂMICA
   ===================================================================== */
function blocoAprovacao(d){
  const lista = d.aprov.length
    ? d.aprov
    : [{ nome: d.id.responsavel || '—', cargo: d.id.cargo || '—',
         orgao: d.id.unidade || d.id.orgao || '—', papel:'Elaborador' }];

  const rows = [];
  for (let i = 0; i < lista.length; i += 2){
    const par = lista.slice(i, i + 2);
    const cells = par.map(a => ({
      stack: [
        { text: (a.papel || 'AGENTE').toUpperCase(), fontSize:7.5, bold:true, color:BRAND2, characterSpacing:0.6, margin:[0,0,0,26] },
        { canvas: [{ type:'line', x1:0, y1:0, x2:215, y2:0, lineWidth:0.8, lineColor:'#94A3B8' }] },
        { text: a.nome || '—', bold:true, fontSize:9, color:'#0F172A', margin:[0,5,0,0] },
        { text: a.cargo || '—', fontSize:8, color:'#475569', margin:[0,1,0,0] },
        { text: a.orgao || '—', fontSize:7.5, color:MUTED, margin:[0,1,0,0] },
        a.matricula ? { text:`Matrícula: ${a.matricula}`, fontSize:7, color:'#94A3B8', margin:[0,2,0,0] } : { text:'' },
        { text:'Assinatura / Carimbo', fontSize:6.5, italics:true, color:'#94A3B8', margin:[0,4,0,0] }
      ],
      margin: [0, 6, 12, 20]
    }));
    while (cells.length < 2) cells.push({ text:'' });
    rows.push(cells);
  }

  return {
    stack: [
      { text:'FOLHA DE APROVAÇÃO E VALIDAÇÃO',
        bold:true, fontSize:12, color:BRAND, characterSpacing:0.8, margin:[0,6,0,2] },
      { text:'Documento sujeito a manifestação dos agentes abaixo identificados',
        fontSize:8.5, color:MUTED, margin:[0,0,0,16] },
      {
        table: { widths:['*', '*'], body: rows },
        layout: 'noBorders',
        dontBreakRows: true,
        margin: [0, 0, 0, 10]
      },
      { text:'', margin:[0,10,0,0] },
      {
        table: { widths:['*'], body: [[{ stack:[
          { text:'DECLARAÇÃO DE CIÊNCIA',
            fontSize:7.5, bold:true, color:BRAND2, characterSpacing:0.6, margin:[0,0,0,5] },
          { text:'Os agentes signatários declaram ter analisado o presente Estudo Técnico Preliminar e manifestam-se de acordo com o conteúdo técnico, a estimativa de quantidades, a estimativa de preços e o posicionamento conclusivo quanto à viabilidade da contratação, nos termos do art. 18 da Lei nº 14.133/2021.',
            fontSize:8.5, alignment:'justify', lineHeight:1.4, color:'#334155' }
        ], margin:[12,11,12,11] }]] },
        layout: {
          hLineWidth:()=>0.5, vLineWidth:()=>0.5,
          hLineColor:()=>LINEC, vLineColor:()=>LINEC,
          paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0
        }
      },
      { text:`${d.id.unidade || ''}${d.id.unidade && d.id.orgao ? ' — ' : ''}${d.id.orgao || ''}, ${dataBR(d.id.data)}.`,
        alignment:'right', fontSize:9, color:'#334155', margin:[0,22,0,0] }
    ],
    pageBreak: 'before'
  };
}

/* =====================================================================
   14. BLOCO 6 — AUTENTICAÇÃO E RASTREABILIDADE (PÁGINA FINAL ISOLADA)
   ===================================================================== */
function blocoAutenticacao(d, meta){
  const caixaLayout = {
    hLineWidth: () => 1.2, vLineWidth: () => 1.2,
    hLineColor: () => BRAND, vLineColor: () => BRAND,
    paddingLeft: () => 0, paddingRight: () => 0,
    paddingTop: () => 0, paddingBottom: () => 0
  };

  return {
    stack: [
      { text:'', margin:[0,40,0,0] },
      { text:'AUTENTICAÇÃO E RASTREABILIDADE',
        alignment:'center', bold:true, fontSize:13, color:BRAND, characterSpacing:1 },
      { text:'Documento eletrônico gerado pelo sistema LicitaETP',
        alignment:'center', fontSize:8.5, color:MUTED, margin:[0,4,0,22] },
      {
        table: { widths:['*'], body: [[{ stack: [
          { text:'SELO DIGITAL DO ESTUDO TÉCNICO PRELIMINAR',
            alignment:'center', fontSize:7.5, bold:true, color:BRAND2, characterSpacing:1, margin:[0,0,0,12] },
          { text: meta.tag,
            alignment:'center', fontSize:14, bold:true, color:BRAND, characterSpacing:1.4, margin:[0,0,0,10] },
          { canvas: [{ type:'line', x1:40, y1:0, x2:395, y2:0, lineWidth:0.6, lineColor:LINEC }], margin:[0,4,0,14] },
          { text:'HASH DE INTEGRIDADE — SHA-256',
            alignment:'center', fontSize:7, bold:true, color:BRAND2, characterSpacing:0.8, margin:[0,0,0,5] },
          { text: meta.hash,
            alignment:'center', fontSize:7.2, color:'#334155', characterSpacing:0.4, lineHeight:1.35, margin:[0,0,0,14] },
          { text:'', margin:[0,0,0,2] },
          {
            table: { widths:['*','*'], body: [
              [{ text:'EMITIDO EM', fontSize:6.8, bold:true, color:MUTED, alignment:'center', margin:[0,4,0,2] },
               { text:'EXERCÍCIO',   fontSize:6.8, bold:true, color:MUTED, alignment:'center', margin:[0,4,0,2] }],
              [{ text: meta.emitidoEm, fontSize:8.5, bold:true, color:'#0F172A', alignment:'center', margin:[0,2,0,6] },
               { text: `${d.id.exercicio || '—'}`, fontSize:8.5, bold:true, color:'#0F172A', alignment:'center', margin:[0,2,0,6] }],
              [{ text:'Nº DO ETP', fontSize:6.8, bold:true, color:MUTED, alignment:'center', margin:[0,4,0,2] },
               { text:'PROCESSO',  fontSize:6.8, bold:true, color:MUTED, alignment:'center', margin:[0,4,0,2] }],
              [{ text: `${d.id.numero || '—'}/${d.id.exercicio || '—'}`, fontSize:8.5, bold:true, color:'#0F172A', alignment:'center', margin:[0,2,0,6] },
               { text: d.id.processo || '—', fontSize:8.5, bold:true, color:'#0F172A', alignment:'center', margin:[0,2,0,6] }]
            ]},
            layout: {
              hLineWidth:()=>0.4, vLineWidth:()=>0.4,
              hLineColor:()=>'#E2E8F0', vLineColor:()=>'#E2E8F0',
              paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0
            }
          }
        ], margin:[22,20,22,20] }]] },
        layout: caixaLayout
      },
      { text:'', margin:[0,16,0,0] },
      {
        table: { widths:['*'], body: [[{ stack:[
          { text:'AVISO DE AUDITORIA E INTEGRAÇÃO',
            fontSize:7.5, bold:true, color:'#92400E', characterSpacing:0.6, margin:[0,0,0,5] },
          { text:'Este documento é auditável eletronicamente. A autenticidade pode ser verificada pela conferência da TAG exclusiva e do hash SHA-256 junto ao repositório institucional ou ao módulo LicitaAudit. Qualquer alteração posterior de conteúdo invalida o hash registrado, caracterizando adulteração documental.',
            fontSize:8, alignment:'justify', lineHeight:1.4, color:'#78350F', margin:[0,0,0,6] },
          { text:'A ausência de assinatura física não prejudica a validade do ato, nos termos do art. 4º, incisos I e II, e do art. 5º da Lei nº 14.133/2021, e da MP nº 2.200-2/2001.',
            fontSize:7.5, italics:true, color:'#92400E' }
        ], margin:[12,11,12,11] }]] },
        layout: {
          hLineWidth:()=>1, vLineWidth:()=>1,
          hLineColor:()=>'#FCD34D', vLineColor:()=>'#FCD34D',
          paddingLeft:()=>0, paddingRight:()=>0, paddingTop:()=>0, paddingBottom:()=>0
        },
        fillColor: '#FFFBEB'
      },
      { text:'', margin:[0,26,0,0] },
      { canvas: [{ type:'line', x1:100, y1:0, x2:415, y2:0, lineWidth:0.5, lineColor:LINEC }] },
      { text:'LicitaETP · Módulo de Estudo Técnico Preliminar · Padrão de auditoria LicitaAudit',
        alignment:'center', fontSize:7, color:'#94A3B8', margin:[0,8,0,0] },
      { text:'— FIM DO DOCUMENTO —',
        alignment:'center', fontSize:7, bold:true, color:'#94A3B8', characterSpacing:1, margin:[0,4,0,0] }
    ],
    pageBreak: 'before'
  };
}

/* =====================================================================
   15. MONTAGEM DO DOCUMENTO PDF
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
      creator: 'LicitaETP'
    },
    header: (currentPage, pageCount) => {
      if (currentPage <= 3 || currentPage === pageCount) return null;
      return {
        margin: [40, 18, 40, 0],
        columns: [
          { text: (d.id.orgao || '').toUpperCase(), fontSize:7, color:'#94A3B8', bold:true },
          { text: `ETP nº ${d.id.numero || '—'}/${d.id.exercicio || '—'}`, fontSize:7, color:'#94A3B8', alignment:'right' }
        ]
      };
    },
    footer: (currentPage, pageCount) => {
      if (currentPage === 1) return null;
      return {
        margin: [40, 14, 40, 0],
        columns: [
          { text: `TAG ${meta.tag}`, fontSize:6.5, color:'#94A3B8' },
          { text: `Página ${currentPage} de ${pageCount}`, fontSize:6.5, color:'#94A3B8', alignment:'right' }
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
   16. UTILITÁRIOS — NOME DE ARQUIVO, CÓDIGO, HASH
   ===================================================================== */
function nomeArquivo(){
  const raw = (document.getElementById('numeroEtp')?.value || '000');
  const num = (raw.replace(/^ETP[\s_\-:]*/i, '').match(/\d+/) || ['000'])[0].padStart(3, '0');
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
    // Fallback FNV-like (contextos não seguros / file://)
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
   17. GERAÇÃO DO PDF
   ===================================================================== */
async function gerarPDF(){
  const d = coletarDados();

  if (!d.id.orgao || !d.id.objeto){
    toast('Preencha ao menos Órgão/Entidade e Objeto na etapa de Identificação.');
    goTo(0);
    return;
  }

  const conf = calcularConformidade(d);
  const exercicio = (d.id.exercicio || '').match(/\d{4}/)?.[0] || String(new Date().getFullYear());
  const codigo  = gerarCodigo();
  const tag     = `LICITAETP::ETP::${codigo}::${exercicio}`;
  const emitidoEm = new Date().toLocaleString('pt-BR');
  const payload = JSON.stringify({ etp: d, conformidade: conf.score, tag, emitidoEm });
  const hash = await sha256Hex(payload);

  const meta = { tag, hash, emitidoEm, codigo, exercicio };
  const doc = montarDocumento(d, conf, meta);
  const arquivo = nomeArquivo();

  pdfMake.createPdf(doc).download(arquivo, () => {
    toast(`PDF gerado: ${arquivo} · ${tag}`);
    console.info('[LicitaAudit] Payload de auditoria:', { tag, hash, arquivo, conformidade: conf.score, dados: d });
  });
}

/* =====================================================================
   18. PERSISTÊNCIA — EXPORTAR PACOTE DE AUDITORIA
   ===================================================================== */
async function exportarJSON(){
  const d = coletarDados();
  const conf = calcularConformidade(d);
  const exercicio = (d.id.exercicio || '').match(/\d{4}/)?.[0] || String(new Date().getFullYear());
  const tag = `LICITAETP::ETP::${gerarCodigo()}::${exercicio}`;
  const emitidoEm = new Date().toISOString();
  const hash = await sha256Hex(JSON.stringify({ etp: d, tag, emitidoEm }));

  const pacote = {
    sistema: 'LicitaETP',
    versao: '1.1.0',
    trilha: 'LICITAETP',
    tipo: 'auditoria',
    tag, hash, emitidoEm,
    conformidade: {
      score: conf.score,
      incisos: conf.linhas.map(l => ({ inciso: l.n, status: l.status, pct: l.pct }))
    },
    etp: d
  };

  const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo().replace(/\.pdf$/, '_auditoria.json');
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Pacote JSON de auditoria exportado.');
}

/* =====================================================================
   19. PERSISTÊNCIA — SALVAR / CARREGAR RASCUNHO
   ===================================================================== */
function coletarSnapshotRascunho(){
  const d = coletarDados();
  return {
    sistema: 'LicitaETP',
    versao: '1.1.0',
    tipo: 'rascunho',
    salvoEm: new Date().toISOString(),
    logo: logoDataUrl,
    dados: d
  };
}

function salvarRascunho(){
  try {
    const pacote = coletarSnapshotRascunho();
    const json = JSON.stringify(pacote, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });

    const numero = (document.getElementById('numeroEtp')?.value || '').replace(/\D/g, '').padStart(3, '0') || '000';
    const exercicio = (document.getElementById('exercicio')?.value || '').match(/\d{4}/)?.[0] || new Date().getFullYear();
    const arquivo = `ETP_${numero}_${exercicio}_rascunho.json`;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = arquivo;
    a.click();
    URL.revokeObjectURL(a.href);

    toast(`Rascunho salvo: ${arquivo}`);
  } catch(e){
    console.error(e);
    toast('Falha ao salvar rascunho.');
  }
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
  } catch(e){
    console.error(e);
    toast('Arquivo JSON inválido ou corrompido.');
  }
}

function aplicarDados(d){
  const setV = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };

  /* --- Identificação --- */
  setV('orgao', d.id?.orgao);
  setV('uasg', d.id?.uasg);
  setV('unidade', d.id?.unidade);
  setV('exercicio', d.id?.exercicio);
  setV('numeroEtp', d.id?.numero);
  setV('processo', d.id?.processo);
  setV('dataElaboracao', d.id?.data);
  setV('objeto', d.id?.objeto);
  setV('responsavel', d.id?.responsavel);
  setV('cargoResponsavel', d.id?.cargo);
  setV('email', d.id?.email);
  setV('telefone', d.id?.telefone);

  /* --- I · Necessidade --- */
  setV('necessidade', d.nec?.necessidade);
  setV('causaRaiz', d.nec?.causaRaiz);
  setV('publicoAlvo', d.nec?.publicoAlvo);

  /* --- II · PCA --- */
  setV('pcaPrevisto', d.pca?.previsto);
  setV('pcaItem', d.pca?.item);
  setV('pcaJustificativa', d.pca?.justificativa);

  /* --- III · Requisitos --- */
  const sustSet = new Set(d.req?.sustentaveis || []);
  document.querySelectorAll('input[name="sustent"]').forEach(cb => {
    cb.checked = sustSet.has(cb.value);
  });
  setV('reqTecnicos', d.req?.tecnicos);
  setV('reqHabilitacao', d.req?.habilitacao);
  setV('reqGarantia', d.req?.garantia);
  setV('reqEntrega', d.req?.entrega);

  /* --- IV · Quantidades --- */
  const tbQ = document.getElementById('tbQtd');
  if (tbQ){
    tbQ.innerHTML = '';
    const itens = d.qtd?.itens || [];
    itens.forEach(addQtd);
    if (!itens.length) addQtd();
  }
  setV('metodoQtd', d.qtd?.metodo);

  /* --- V · Mercado --- */
  const tbM = document.getElementById('tbMercado');
  if (tbM){
    tbM.innerHTML = '';
    const alts = d.mercado?.alternativas || [];
    alts.forEach(addMercado);
    if (!alts.length){ addMercado(); addMercado(); }
  }
  setV('conclusaoMercado', d.mercado?.conclusao);

  /* --- VI · Preços --- */
  setV('metodoPreco', d.precos?.metodo);
  const tbP = document.getElementById('tbPreco');
  if (tbP){
    tbP.innerHTML = '';
    const precos = d.precos?.itens || [];
    precos.forEach(addPreco);
    if (!precos.length) addPreco();
  }
  setV('obsPreco', d.precos?.observacoes);
  recalcularTotal();

  /* --- VII · Solução --- */
  setV('descricaoSolucao', d.solucao?.descricao);
  setV('entregas', d.solucao?.entregas);
  setV('cicloVida', d.solucao?.ciclo);

  /* --- VIII · Parcelamento --- */
  setV('parcelar', d.parcel?.decisao);
  setV('itensParcelaveis', d.parcel?.itens);
  setV('justificativaParcelamento', d.parcel?.justificativa);

  /* --- IX · Resultados --- */
  setV('resultados', d.result?.resultados);
  setV('economicidade', d.result?.economicidade);
  setV('indicadores', d.result?.indicadores);

  /* --- X · Providências --- */
  setV('providencias', d.prov?.providencias);
  setV('correlatas', d.prov?.correlatas);
  setV('impactoProvidencias', d.prov?.impacto);

  /* --- XI · Posicionamento --- */
  setV('posicionamento', d.conc?.posicionamento);
  setV('recomendacoes', d.conc?.recomendacoes);
  setV('conclusao', d.conc?.conclusao);

  /* --- Aprovadores --- */
  const lst = document.getElementById('listaAprovadores');
  if (lst){
    lst.innerHTML = '';
    const aprovs = d.aprov || [];
    aprovs.forEach(addAprovador);
    if (!aprovs.length) addAprovador({ papel: 'Elaborador' });
  }
}

/* =====================================================================
   20. DRAG & DROP — ZONA DE LOGOTIPO
   ===================================================================== */
function inicializarDropzoneLogo(){
  const dz = document.getElementById('logoDropzone');
  const input = document.getElementById('logoFile');
  const empty = document.getElementById('logoDropzoneEmpty');
  const preview = document.getElementById('logoDropzonePreview');
  const img = document.getElementById('logoPreviewImg');
  const nameEl = document.getElementById('logoPreviewName');
  const sizeEl = document.getElementById('logoPreviewSize');
  const removeBtn = document.getElementById('logoRemoveBtn');

  if (!dz || !input) return;

  dz.addEventListener('click', (e) => {
    if (e.target.closest('#logoRemoveBtn')) return;
    if (dz.classList.contains('has-file')) return;
    input.click();
  });

  ['dragenter','dragover'].forEach(ev => {
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.add('dragover');
    });
  });

  ['dragleave','dragend'].forEach(ev => {
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dz.contains(e.relatedTarget)) dz.classList.remove('dragover');
    });
  });

  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dz.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) processarLogotipo(file);
  });

  input.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) processarLogotipo(file);
  });

  removeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    logoDataUrl = null;
    input.value = '';
    preview?.classList.add('hidden');
    empty?.classList.remove('hidden');
    dz.classList.remove('has-file');
    toast('Logotipo removido.');
  });

  async function processarLogotipo(file){
    const MAX = 2 * 1024 * 1024;
    if (!file.type.startsWith('image/')){
      toast('Formato inválido. Envie PNG, JPG ou SVG.');
      return;
    }
    if (file.size > MAX){
      toast('Arquivo excede 2 MB.');
      return;
    }
    try {
      const dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = ev => res(ev.target.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      logoDataUrl = dataUrl;
      if (img) img.src = dataUrl;
      if (nameEl) nameEl.textContent = file.name;
      if (sizeEl) sizeEl.textContent = formatBytes(file.size);
      empty?.classList.add('hidden');
      preview?.classList.remove('hidden');
      dz.classList.add('has-file');
      toast(`Logotipo carregado: ${file.name}`);
    } catch(e){
      console.error(e);
      toast('Falha ao ler o arquivo.');
    }
  }

  function formatBytes(b){
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(2) + ' MB';
  }
}

/* =====================================================================
   21. TOAST (FEEDBACK VISUAL)
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
   22. BOOTSTRAP
   ===================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  /* 1) Identidade visual */
  injetarIdentidadeVisual();

  /* 2) Logo padrão em PNG para o PDF */
  try { logoPadraoPng = await svgToPngDataUrl(SVG_LOGO, 256); }
  catch(e){ console.warn('Não foi possível pré-renderizar o logo padrão.', e); }

  /* 3) Data padrão */
  const dtEl = document.getElementById('dataElaboracao');
  if (dtEl) dtEl.value = new Date().toISOString().slice(0, 10);

  /* 4) Painéis e navegação */
  panels = $$('[data-panel]');
  TOTAL  = panels.length;

  /* 5) Dropzone do logotipo */
  inicializarDropzoneLogo();

  /* 6) Upload de JSON (Carregar Rascunho) */
  document.getElementById('jsonFile')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) processarArquivoJSON(f);
    e.target.value = '';
  });

  /* 7) Linhas iniciais */
  addQtd();
  addMercado(); addMercado();
  addPreco();
  addAprovador({ papel: 'Elaborador' });

  /* 8) Recálculo automático de preços */
  document.addEventListener('input', e => {
    if (e.target.closest('#tbPreco')) recalcularTotal();
  });

  /* 9) Navegação inicial */
  renderNav();
  goTo(0);

  /* 10) Score de conformidade em tempo real */
  setInterval(() => {
    const conf = calcularConformidade(coletarDados());
    const b = document.getElementById('scoreBadge');
    if (!b) return;
    b.textContent = `Conformidade ${conf.score}%`;
    if (conf.score >= 80){
      b.style.background = 'var(--ok-bg)';
      b.style.color = '#6EE7B7';
      b.style.borderColor = 'rgba(34,197,94,.35)';
    } else if (conf.score >= 50){
      b.style.background = 'var(--wa-bg)';
      b.style.color = '#FCD34D';
      b.style.borderColor = 'rgba(245,158,11,.35)';
    } else {
      b.style.background = 'var(--er-bg)';
      b.style.color = '#FCA5A5';
      b.style.borderColor = 'rgba(239,68,68,.35)';
    }
  }, 1200);
});

/* =====================================================================
   FIM DO ARQUIVO — LicitaETP v1.1.0
   ===================================================================== */
