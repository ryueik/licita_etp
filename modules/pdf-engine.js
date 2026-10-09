/* =====================================================================
   OMNILICIT · LicitaETP · PDF Engine v5.0
   Gera o PDF auditável com identidade visual OmniLicit.
   ===================================================================== */
'use strict';

const PDFEngine = (() => {

  /* ---------- 3.1 Paleta OmniLicit ---------- */
  const COR = {
    BRAND:     '#0E7C86',   // turquesa executivo
    BRAND_DK:  '#075056',   // turquesa profundo
    BRAND_LT:  '#E6F4F5',   // turquesa claro (fills)
    ACCENT:    '#1E6F5C',   // verde institucional
    MUTED:     '#64748B',
    LINE:      '#CBD5E1',
    TEXT:      '#1E293B',
    TEXT_SOFT: '#475569'
  };
  const PAGE_MARGINS = [42, 48, 42, 52];
  const VERSAO_MODULO = 'OmniLicit LicitaETP v5.0';
  const SISTEMA_AUDIT = 'OmniLicit Audit';

  /* ---------- 3.2 Helpers ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  const sanitizar = s => {
    if (s == null) return '';
    let t = String(s);
    t = t.replace(/[\[\]·•\-–—]*\s*(?:P[áa]gina|Page)\s+\d+\s*(?:de|of|\/)\s*\d+\s*[\[\]·•\-–—]*/gi, ' ');
    t = t.replace(/^\s*\d+\s*(?:de|\/)\s*\d+\s*$/gm, ' ');
    t = t.replace(/\s{2,}/g, ' ').trim();
    t = t.replace(/^[\s:;\-–—,\.]+|[\s:;\-–—,\.]+$/g, '').trim();
    return t;
  };

  const moeda = n => Number(n || 0).toLocaleString('pt-BR',
    { style: 'currency', currency: 'BRL' });

  const dataBR = iso => {
    if (!iso) return new Date().toLocaleDateString('pt-BR');
    const [y, m, d] = String(iso).split('-');
    return `${d}/${m}/${y}`;
  };

  const gerarCodigoTag = () => {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 8; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  };

  async function sha256Hex(str) {
    try {
      const buf = new TextEncoder().encode(str);
      const h = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(h))
        .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    } catch {
      let h1 = 0x811c9dc5, h2 = 0x1000193;
      for (let i = 0; i < str.length; i++) {
        h1 ^= str.charCodeAt(i); h1 = Math.imul(h1, 16777619) >>> 0;
        h2 = Math.imul(h2 ^ str.charCodeAt(i), 2246822519) >>> 0;
      }
      const base = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).toUpperCase();
      return base.repeat(4).slice(0, 64);
    }
  }

  const txtBloco = t => {
    const limpo = sanitizar(t);
    if (!limpo.trim()) return [{ text: '— não informado —', italics: true, color: '#94A3B8', fontSize: 9.5 }];
    const linhas = limpo.split('\n').map(sanitizar).filter(Boolean);
    const out = []; let ul = [];
    const flush = () => {
      if (ul.length) {
        out.push({ ul, fontSize: 9.5, lineHeight: 1.3, margin: [0, 0, 0, 6], color: COR.TEXT });
        ul = [];
      }
    };
    linhas.forEach(l => {
      if (/^[-•*]\s+/.test(l)) ul.push(l.replace(/^[-•*]\s+/, ''));
      else {
        flush();
        out.push({ text: l, fontSize: 9.5, lineHeight: 1.4, alignment: 'justify',
                   color: COR.TEXT, margin: [0, 0, 0, 6] });
      }
    });
    flush();
    return out.length ? out : [{ text: '— não informado —', italics: true, color: '#94A3B8', fontSize: 9.5 }];
  };

  const campo = (rotulo, valor) => ({ stack: [
    { text: rotulo.toUpperCase(), fontSize: 7.5, bold: true, color: COR.ACCENT,
      characterSpacing: 0.6, margin: [0, 7, 0, 3] },
    ...txtBloco(valor)
  ]});

  const secao = (n, t, blocos) => ({ stack: [
    { table: { widths: ['*'], body: [[{
      text: `${n} — ${t}`, bold: true, fontSize: 10, color: '#FFFFFF',
      fillColor: COR.BRAND, margin: [8, 6, 8, 6], characterSpacing: 0.3
    }]]}, layout: 'noBorders', margin: [0, 12, 0, 7] },
    ...blocos
  ]});

  function tabela(header, rows, widths, opts = {}) {
    const { wrapCols = [] } = opts;
    if (!rows.length) return { text: '— não informado —', italics: true,
                               color: '#94A3B8', fontSize: 9.5, margin: [0, 2, 0, 8] };
    return {
      table: {
        headerRows: 1, widths,
        body: [
          header.map(h => ({ text: sanitizar(h), bold: true, fontSize: 7.5,
                             color: '#FFFFFF', fillColor: COR.ACCENT,
                             margin: [4, 5, 4, 5] })),
          ...rows.map(r => r.map((c, idx) => ({
            text: sanitizar(String(c ?? '')), fontSize: wrapCols.includes(idx) ? 8 : 8.5,
            color: COR.TEXT, margin: [4, 4, 4, 4]
          })))
        ]
      },
      layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                hLineColor: () => COR.LINE, vLineColor: () => COR.LINE,
                paddingLeft: () => 2, paddingRight: () => 2,
                paddingTop: () => 1, paddingBottom: () => 1 },
      margin: [0, 2, 0, 10]
    };
  }

  function barra(pct) {
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    return { table: { widths: [`${p}%`, `${100 - p}%`], body: [[
      { text: '', fillColor: p >= 80 ? '#15803D' : p >= 50 ? '#B45309' : '#B91C1C',
        border: [false, false, false, false], margin: [0, 4, 0, 4] },
      { text: '', fillColor: '#E2E8F0', border: [false, false, false, false],
        margin: [0, 4, 0, 4] }
    ]]}, layout: 'noBorders' };
  }

  /* ---------- 3.3 Blocos ---------- */
  function blocoCapa(d, conf, meta, logoDataUrl) {
    const logo = logoDataUrl
      ? { image: logoDataUrl, width: 140, alignment: 'center', margin: [0, 0, 0, 18] }
      : { text: '', margin: [0, 0, 0, 6] };

    const resumo = [
      ['Nº do ETP',             `${sanitizar(d.id.numero) || '—'} / ${sanitizar(d.id.exercicio) || '—'}`],
      ['Processo',              sanitizar(d.id.processo) || '—'],
      ['Órgão / Unidade',       `${sanitizar(d.id.orgao) || '—'}${d.id.unidade ? ' — ' + sanitizar(d.id.unidade) : ''}`],
      ['Objeto',                sanitizar(d.id.objeto) || '—'],
      ['Responsável técnico',   `${sanitizar(d.id.responsavel) || '—'}${d.id.cargo ? ' — ' + sanitizar(d.id.cargo) : ''}`],
      ['Valor total estimado',  moeda(d.precos.total)],
      ['Posicionamento',        sanitizar(d.conc.posicionamento) || '—'],
      ['Score de conformidade', `${conf.score}% (${conf.linhas.filter(l => l.pct === 100).length}/${conf.linhas.length} incisos atendidos)`]
    ];

    return {
      stack: [
        { text: '', margin: [0, 20, 0, 0] },
        logo,
        { text: sanitizar((d.id.orgao || 'ÓRGÃO / ENTIDADE').toUpperCase()),
          alignment: 'center', bold: true, fontSize: 13, color: COR.BRAND_DK,
          characterSpacing: 0.5 },
        { text: sanitizar(d.id.unidade || ''), alignment: 'center', fontSize: 9,
          color: COR.MUTED, margin: [0, 3, 0, 0] },
        { text: d.id.uasg ? `UASG ${sanitizar(d.id.uasg)}` : '',
          alignment: 'center', fontSize: 8, color: COR.MUTED, margin: [0, 2, 0, 0] },
        { canvas: [{ type: 'line', x1: 150, y1: 0, x2: 365, y2: 0,
                     lineWidth: 1.1, lineColor: COR.ACCENT }],
          margin: [0, 14, 0, 18] },
        { text: 'ESTUDO TÉCNICO PRELIMINAR', alignment: 'center', bold: true,
          fontSize: 19, color: COR.BRAND_DK, characterSpacing: 1.2 },
        { text: 'E T P', alignment: 'center', bold: true, fontSize: 11,
          color: COR.ACCENT, characterSpacing: 6, margin: [0, 3, 0, 0] },
        { text: 'Fundamentação: Lei nº 14.133/2021, art. 18, § 1º, incisos I a XI',
          alignment: 'center', fontSize: 8.5, color: COR.MUTED, margin: [0, 9, 0, 0] },
        { text: 'Documento integrante da fase preparatória da contratação',
          alignment: 'center', fontSize: 8, italics: true, color: COR.MUTED,
          margin: [0, 2, 0, 0] },
        { text: '', margin: [0, 16, 0, 0] },
        { table: { widths: [135, '*'], body: resumo.map(([k, v]) => [
          { text: k.toUpperCase(), fontSize: 7.8, bold: true, color: COR.ACCENT,
            fillColor: COR.BRAND_LT, margin: [8, 6, 8, 6] },
          { text: String(v), fontSize: 9, color: COR.TEXT, margin: [8, 6, 8, 6] }
        ])},
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                    hLineColor: () => COR.LINE, vLineColor: () => COR.LINE,
                    paddingLeft: () => 0, paddingRight: () => 0,
                    paddingTop: () => 0, paddingBottom: () => 0 } },
        { text: '', margin: [0, 18, 0, 0] },
        { text: `Documento emitido eletronicamente em ${new Date().toLocaleString('pt-BR')} · TAG ${meta.tag}`,
          alignment: 'center', fontSize: 7, color: '#94A3B8' }
      ],
      pageBreak: 'after'
    };
  }

  function blocoConformidade(d, conf, meta) {
    const linhas = conf.linhas.map(l => [
      { text: l.n, bold: true, alignment: 'center' },
      { text: sanitizar(l.t) },
      { text: l.status, bold: true, color: l.cor, fillColor: l.bg, alignment: 'center' },
      { text: `${l.pct}%`, alignment: 'center', bold: true, color: l.cor }
    ]);

    return { stack: [
      { text: 'PAINEL DE CONFORMIDADE ETP', bold: true, fontSize: 12,
        color: COR.BRAND_DK, characterSpacing: 0.8, margin: [0, 6, 0, 2] },
      { text: 'Estrutura de leitura automatizada — compatível com validação pelo OmniLicit Audit',
        fontSize: 8.5, color: COR.MUTED, margin: [0, 0, 0, 12] },
      { table: { headerRows: 1, widths: [38, '*', 72, 42], body: [
        [
          { text: 'INCISO', bold: true, fontSize: 7.5, color: '#FFF',
            fillColor: COR.BRAND, alignment: 'center', margin: [4, 6, 4, 6] },
          { text: 'REQUISITO LEGAL — ART. 18, § 1º, LEI 14.133/2021', bold: true,
            fontSize: 7.5, color: '#FFF', fillColor: COR.BRAND, margin: [4, 6, 4, 6] },
          { text: 'STATUS', bold: true, fontSize: 7.5, color: '#FFF',
            fillColor: COR.BRAND, alignment: 'center', margin: [4, 6, 4, 6] },
          { text: 'SCORE', bold: true, fontSize: 7.5, color: '#FFF',
            fillColor: COR.BRAND, alignment: 'center', margin: [4, 6, 4, 6] }
        ], ...linhas
      ]},
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                  hLineColor: () => COR.LINE, vLineColor: () => COR.LINE,
                  paddingLeft: () => 5, paddingRight: () => 5,
                  paddingTop: () => 5, paddingBottom: () => 5 } },
      { text: '', margin: [0, 12, 0, 0] },
      { columns: [
        { width: '*', stack: [
          { text: 'SCORE GLOBAL DE CONFORMIDADE', fontSize: 7.5, bold: true,
            color: COR.ACCENT, characterSpacing: 0.6, margin: [0, 0, 0, 5] },
          barra(conf.score),
          { text: `${conf.score}% de aderência aos incisos obrigatórios`,
            fontSize: 8.5, color: COR.TEXT_SOFT, margin: [0, 6, 0, 0] }
        ]},
        { width: 130, stack: [
          { text: 'TAG DE AUTENTICAÇÃO', fontSize: 7.5, bold: true,
            color: COR.ACCENT, characterSpacing: 0.6, margin: [0, 0, 0, 5] },
          { text: meta.tag, fontSize: 8, bold: true, color: COR.BRAND_DK, alignment: 'right' }
        ]}
      ]}
    ], pageBreak: 'after' };
  }

  function blocoCorpo(d) {
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
        campo('Critérios de sustentabilidade', d.req.sustentaveis.length
          ? d.req.sustentaveis.map(s => '- ' + s).join('\n') : ''),
        campo('Requisitos técnicos e de desempenho', d.req.tecnicos),
        campo('Requisitos de habilitação técnica', d.req.habilitacao),
        campo('Garantia, assistência técnica e manutenção', d.req.garantia),
        campo('Embalagem, entrega e recebimento', d.req.entrega)
      ]),
      secao('IV', 'ESTIMATIVA DE QUANTIDADES E MEMÓRIA DE CÁLCULO', [
        campo('Descrição quantitativa (extraída do DFD)', d.qtd.descricao),
        tabela(['ITEM','DESCRIÇÃO','QTD.','UN.','MEMÓRIA DE CÁLCULO'],
          d.qtd.itens.map(i => [i.item, i.descricao, i.quantidade, i.unidade, i.memoria]),
          [32, '*', 40, 34, '*']),
        campo('Metodologia da estimativa', d.qtd.metodo)
      ]),
      secao('V', 'LEVANTAMENTO DE MERCADO E ALTERNATIVAS', [
        tabela(['ALTERNATIVA','DESCRIÇÃO','VANTAGENS','RISCOS'],
          d.mercado.alternativas.map(a => [a.alternativa, a.descricao, a.vantagens, a.riscos]),
          ['*','*','*','*']),
        campo('Conclusão do levantamento de mercado', d.mercado.conclusao)
      ]),
      secao('VI', 'ESTIMATIVA PRELIMINAR DE PREÇOS', [
        campo('Método de estimativa adotado', sanitizar(d.precos.metodo)),
        tabela(['ITEM / FONTE', 'DESCRIÇÃO / FORNECEDOR', 'VALOR UNIT.', 'QTD.', 'TOTAL'],
          d.precos.itens.map(i => [
            sanitizar(i.item) || '—',
            sanitizar(i.fonte) || '—',
            moeda(i.unitario),
            sanitizar(i.quantidade) || '—',
            moeda(i.total)
          ]),
          [115, 195, 70, 40, 75], { wrapCols: [1] }),
        { table: { widths: ['*', 150], body: [[
          { text: 'VALOR TOTAL ESTIMADO DA CONTRATAÇÃO', bold: true, fontSize: 9,
            color: COR.BRAND_DK, margin: [8, 8, 8, 8], fillColor: COR.BRAND_LT },
          { text: moeda(d.precos.total), bold: true, fontSize: 11,
            color: '#15803D', alignment: 'right', margin: [8, 7, 8, 7],
            fillColor: COR.BRAND_LT }
        ]]}, layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                        hLineColor: () => '#BBF7D0', vLineColor: () => '#BBF7D0',
                        paddingLeft: () => 0, paddingRight: () => 0,
                        paddingTop: () => 0, paddingBottom: () => 0 },
          margin: [0, 0, 0, 10] },
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

  function blocoAprovacao(d) {
    const lista = d.aprov.length ? d.aprov
      : [{ nome: d.id.responsavel || '—', cargo: d.id.cargo || '—',
           orgao: d.id.unidade || d.id.orgao || '—', papel: 'Elaborador' }];

    const rows = [];
    for (let i = 0; i < lista.length; i += 2) {
      const par = lista.slice(i, i + 2);
      const cells = par.map(a => ({
        stack: [
          { text: (sanitizar(a.papel) || 'AGENTE').toUpperCase(), fontSize: 7.5,
            bold: true, color: COR.ACCENT, characterSpacing: 0.6, margin: [0, 0, 0, 26] },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 215, y2: 0,
                       lineWidth: 0.8, lineColor: '#94A3B8' }] },
          { text: sanitizar(a.nome) || '—', bold: true, fontSize: 9,
            color: '#0F172A', margin: [0, 5, 0, 0] },
          { text: sanitizar(a.cargo) || '—', fontSize: 8, color: COR.TEXT_SOFT,
            margin: [0, 1, 0, 0] },
          { text: sanitizar(a.orgao) || '—', fontSize: 7.5, color: COR.MUTED,
            margin: [0, 1, 0, 0] },
          a.matricula ? { text: `Matrícula: ${sanitizar(a.matricula)}`, fontSize: 7,
                         color: '#94A3B8', margin: [0, 2, 0, 0] } : { text: '' },
          { text: 'Assinatura / Carimbo', fontSize: 6.5, italics: true,
            color: '#94A3B8', margin: [0, 4, 0, 0] }
        ], margin: [0, 6, 12, 20]
      }));
      while (cells.length < 2) cells.push({ text: '' });
      rows.push(cells);
    }

    const g = d.governanca || {};
    const temGov = g.fiscalTitular || g.fiscalSubstituto || g.gestor;
    const blocoGov = temGov ? [{ stack: [
      { text: 'GOVERNANÇA CONTRATUAL', fontSize: 8, bold: true,
        color: COR.ACCENT, characterSpacing: 0.8, margin: [0, 0, 0, 8] },
      { table: { widths: ['*','*','*'], body: [
        [
          { text: 'FISCAL TITULAR', fontSize: 7, bold: true, color: COR.ACCENT,
            fillColor: COR.BRAND_LT, alignment: 'center', margin: [6, 5, 6, 3] },
          { text: 'FISCAL SUBSTITUTO', fontSize: 7, bold: true, color: COR.ACCENT,
            fillColor: COR.BRAND_LT, alignment: 'center', margin: [6, 5, 6, 3] },
          { text: 'GESTOR DO CONTRATO', fontSize: 7, bold: true, color: COR.ACCENT,
            fillColor: COR.BRAND_LT, alignment: 'center', margin: [6, 5, 6, 3] }
        ],
        [
          { text: sanitizar(g.fiscalTitular) || '—', fontSize: 8.5, color: COR.TEXT,
            alignment: 'center', margin: [6, 4, 6, 6] },
          { text: sanitizar(g.fiscalSubstituto) || '—', fontSize: 8.5, color: COR.TEXT,
            alignment: 'center', margin: [6, 4, 6, 6] },
          { text: sanitizar(g.gestor) || '—', fontSize: 8.5, color: COR.TEXT,
            alignment: 'center', margin: [6, 4, 6, 6] }
        ]
      ]},
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                  hLineColor: () => COR.LINE, vLineColor: () => COR.LINE,
                  paddingLeft: () => 0, paddingRight: () => 0,
                  paddingTop: () => 0, paddingBottom: () => 0 },
        margin: [0, 0, 0, 14] }
    ]}] : [];

    return { stack: [
      { text: 'FOLHA DE APROVAÇÃO E VALIDAÇÃO', bold: true, fontSize: 12,
        color: COR.BRAND_DK, characterSpacing: 0.8, margin: [0, 6, 0, 2] },
      { text: 'Documento sujeito a manifestação dos agentes abaixo identificados',
        fontSize: 8.5, color: COR.MUTED, margin: [0, 0, 0, 16] },
      ...blocoGov,
      { table: { widths: ['*','*'], body: rows }, layout: 'noBorders',
        dontBreakRows: true, margin: [0, 0, 0, 10] },
      { text: '', margin: [0, 10, 0, 0] },
      { table: { widths: ['*'], body: [[{ stack: [
        { text: 'DECLARAÇÃO DE CIÊNCIA', fontSize: 7.5, bold: true,
          color: COR.ACCENT, characterSpacing: 0.6, margin: [0, 0, 0, 5] },
        { text: 'Os agentes signatários declaram ter analisado o presente Estudo Técnico Preliminar e manifestam-se de acordo com o conteúdo técnico, a estimativa de quantidades, a estimativa de preços e o posicionamento conclusivo quanto à viabilidade da contratação, nos termos do art. 18 da Lei nº 14.133/2021.',
          fontSize: 8.5, alignment: 'justify', lineHeight: 1.4,
          color: COR.TEXT_SOFT }
      ], margin: [12, 11, 12, 11] }]]},
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                  hLineColor: () => COR.LINE, vLineColor: () => COR.LINE,
                  paddingLeft: () => 0, paddingRight: () => 0,
                  paddingTop: () => 0, paddingBottom: () => 0 } },
      { text: `${sanitizar(d.id.unidade) || ''}${d.id.unidade && d.id.orgao ? ' — ' : ''}${sanitizar(d.id.orgao) || ''}, ${dataBR(d.id.data)}.`,
        alignment: 'right', fontSize: 9, color: COR.TEXT_SOFT, margin: [0, 22, 0, 0] }
    ], pageBreak: 'before' };
  }

  function blocoAutenticacao(d, meta) {
    const caixaLayout = { hLineWidth: () => 1.2, vLineWidth: () => 1.2,
                          hLineColor: () => COR.BRAND, vLineColor: () => COR.BRAND,
                          paddingLeft: () => 0, paddingRight: () => 0,
                          paddingTop: () => 0, paddingBottom: () => 0 };

    return { stack: [
      { text: '', margin: [0, 40, 0, 0] },
      { text: 'AUTENTICAÇÃO E RASTREABILIDADE', alignment: 'center', bold: true,
        fontSize: 13, color: COR.BRAND_DK, characterSpacing: 1 },
      { text: `Documento eletrônico gerado pelo sistema ${VERSAO_MODULO}`,
        alignment: 'center', fontSize: 8.5, color: COR.MUTED, margin: [0, 4, 0, 22] },
      { table: { widths: ['*'], body: [[{ stack: [
        { text: 'SELO DIGITAL DO ESTUDO TÉCNICO PRELIMINAR', alignment: 'center',
          fontSize: 7.5, bold: true, color: COR.ACCENT, characterSpacing: 1,
          margin: [0, 0, 0, 12] },
        { text: meta.tag, alignment: 'center', fontSize: 14, bold: true,
          color: COR.BRAND_DK, characterSpacing: 1.4, margin: [0, 0, 0, 10] },
        { canvas: [{ type: 'line', x1: 40, y1: 0, x2: 395, y2: 0,
                     lineWidth: 0.6, lineColor: COR.LINE }], margin: [0, 4, 0, 14] },
        { text: 'HASH DE INTEGRIDADE — SHA-256', alignment: 'center', fontSize: 7,
          bold: true, color: COR.ACCENT, characterSpacing: 0.8, margin: [0, 0, 0, 5] },
        { text: meta.hash, alignment: 'center', fontSize: 7.2, color: COR.TEXT_SOFT,
          characterSpacing: 0.4, lineHeight: 1.35, margin: [0, 0, 0, 14] },
        { table: { widths: ['*','*'], body: [
          [{ text: 'EMITIDO EM', fontSize: 6.8, bold: true, color: COR.MUTED,
             alignment: 'center', margin: [0, 4, 0, 2] },
           { text: 'EXERCÍCIO', fontSize: 6.8, bold: true, color: COR.MUTED,
             alignment: 'center', margin: [0, 4, 0, 2] }],
          [{ text: meta.emitidoEm, fontSize: 8.5, bold: true, color: '#0F172A',
             alignment: 'center', margin: [0, 2, 0, 6] },
           { text: sanitizar(d.id.exercicio) || '—', fontSize: 8.5, bold: true,
             color: '#0F172A', alignment: 'center', margin: [0, 2, 0, 6] }],
          [{ text: 'Nº DO ETP', fontSize: 6.8, bold: true, color: COR.MUTED,
             alignment: 'center', margin: [0, 4, 0, 2] },
           { text: 'PROCESSO', fontSize: 6.8, bold: true, color: COR.MUTED,
             alignment: 'center', margin: [0, 4, 0, 2] }],
          [{ text: `${sanitizar(d.id.numero) || '—'}/${sanitizar(d.id.exercicio) || '—'}`,
             fontSize: 8.5, bold: true, color: '#0F172A', alignment: 'center',
             margin: [0, 2, 0, 6] },
           { text: sanitizar(d.id.processo) || '—', fontSize: 8.5, bold: true,
             color: '#0F172A', alignment: 'center', margin: [0, 2, 0, 6] }]
        ]}, layout: { hLineWidth: () => 0.4, vLineWidth: () => 0.4,
                      hLineColor: () => '#E2E8F0', vLineColor: () => '#E2E8F0',
                      paddingLeft: () => 0, paddingRight: () => 0,
                      paddingTop: () => 0, paddingBottom: () => 0 } }
      ], margin: [22, 20, 22, 20] }]]}, layout: caixaLayout },
      { text: '', margin: [0, 16, 0, 0] },
      { table: { widths: ['*'], body: [[{ stack: [
        { text: 'AVISO DE AUDITORIA E INTEGRAÇÃO', fontSize: 7.5, bold: true,
          color: '#92400E', characterSpacing: 0.6, margin: [0, 0, 0, 5] },
        { text: `Este documento é auditável eletronicamente pelo módulo ${SISTEMA_AUDIT}. A autenticidade pode ser verificada pela conferência da TAG exclusiva e do hash SHA-256 junto ao repositório institucional. Qualquer alteração posterior de conteúdo invalida o hash registrado, caracterizando adulteração documental.`,
          fontSize: 8, alignment: 'justify', lineHeight: 1.4,
          color: '#78350F', margin: [0, 0, 0, 6] },
        { text: 'A ausência de assinatura física não prejudica a validade do ato, nos termos do art. 4º, incisos I e II, e do art. 5º da Lei nº 14.133/2021, e da MP nº 2.200-2/2001.',
          fontSize: 7.5, italics: true, color: '#92400E' }
      ], margin: [12, 11, 12, 11] }]]},
        layout: { hLineWidth: () => 1, vLineWidth: () => 1,
                  hLineColor: () => '#FCD34D', vLineColor: () => '#FCD34D',
                  paddingLeft: () => 0, paddingRight: () => 0,
                  paddingTop: () => 0, paddingBottom: () => 0 },
        fillColor: '#FFFBEB' },
      { text: '', margin: [0, 26, 0, 0] },
      { canvas: [{ type: 'line', x1: 100, y1: 0, x2: 415, y2: 0,
                   lineWidth: 0.5, lineColor: COR.LINE }] },
      { text: `${VERSAO_MODULO} · Padrão de auditoria ${SISTEMA_AUDIT}`,
        alignment: 'center', fontSize: 7, color: '#94A3B8', margin: [0, 8, 0, 0] },
      { text: '— FIM DO DOCUMENTO —', alignment: 'center', fontSize: 7, bold: true,
        color: '#94A3B8', characterSpacing: 1, margin: [0, 4, 0, 0] }
    ], pageBreak: 'before' };
  }

  /* ---------- 3.4 Montagem e disparo ---------- */
  function montar(d, conf, meta, logoDataUrl) {
    return {
      pageSize: 'A4',
      pageMargins: PAGE_MARGINS,
      info: {
        title: `Estudo Técnico Preliminar nº ${d.id.numero || ''}/${d.id.exercicio || ''}`,
        author: d.id.orgao || VERSAO_MODULO,
        subject: 'ETP — Lei nº 14.133/2021, art. 18, § 1º',
        keywords: `ETP, Licitações, Lei 14.133/2021, ${meta.tag}`,
        creator: VERSAO_MODULO
      },
      header: (cp, total) => {
        if (cp <= 3 || cp === total) return null;
        return { margin: [40, 18, 40, 0], columns: [
          { text: sanitizar((d.id.orgao || '').toUpperCase()), fontSize: 7,
            color: '#94A3B8', bold: true },
          { text: `ETP nº ${sanitizar(d.id.numero) || '—'}/${sanitizar(d.id.exercicio) || '—'}`,
            fontSize: 7, color: '#94A3B8', alignment: 'right' }
        ]};
      },
      footer: (cp, total) => {
        if (cp === 1) return null;
        return { margin: [40, 14, 40, 0], columns: [
          { text: `TAG ${meta.tag}`, fontSize: 6.5, color: '#94A3B8' },
          { text: `Página ${cp} de ${total}`, fontSize: 6.5, color: '#94A3B8',
            alignment: 'right' }
        ]};
      },
      content: [
        blocoCapa(d, conf, meta, logoDataUrl),
        blocoConformidade(d, conf, meta),
        blocoCorpo(d),
        blocoAprovacao(d),
        blocoAutenticacao(d, meta)
      ],
      defaultStyle: { font: 'Roboto', fontSize: 9.5, color: COR.TEXT }
    };
  }

  /**
   * Gera e baixa o PDF.
   * @param {object} dados — payload de `coletarDados()` do app.js
   * @param {object} conf  — { score, linhas }
   * @param {object} opts  — { exercicio, arquivoNome, logoDataUrl }
   */
  async function gerar(dados, conf, opts = {}) {
    const logoDataUrl = opts.logoDataUrl || OmniLogo.get() || null;
    const exercicio = opts.exercicio || dados.id.exercicio || String(new Date().getFullYear());
    const ano = (exercicio.match(/\d{4}/) || [String(new Date().getFullYear())])[0];

    /* Selo OMNILICIT::ETP::[TAG_UNICA]::[ANO] */
    const tag = `OMNILICIT::ETP::${gerarCodigoTag()}::${ano}`;
    const emitidoEm = new Date().toLocaleString('pt-BR');
    const hash = await sha256Hex(JSON.stringify({
      etp: dados, conformidade: conf.score, tag, emitidoEm, modulo: VERSAO_MODULO
    }));
    const meta = { tag, hash, emitidoEm, exercicio: ano, modulo: VERSAO_MODULO };

    const doc = montar(dados, conf, meta, logoDataUrl);
    const arquivo = opts.arquivoNome || `ETP_${dados.id.numero || '001'}_${ano}.pdf`;

    return new Promise(resolve => {
      pdfMake.createPdf(doc).download(arquivo, () => {
        console.info('[OmniLicit Audit] Payload emitido:', {
          tag, hash, arquivo, modulo: VERSAO_MODULO,
          conformidade: conf.score,
          logoOrigem: OmniLogo.origem(),
          dados
        });
        resolve({ tag, hash, arquivo });
      });
    });
  }

  return { gerar, montar, COR, VERSAO_MODULO, SISTEMA_AUDIT, sha256Hex };
})();

window.PDFEngine = PDFEngine;
