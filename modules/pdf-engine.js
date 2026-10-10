/* =====================================================================
   OMNILICIT · LicitaETP · PDF Engine v5.0
   ✅ Paleta unificada com LicitaReq (petróleo #00A896)
   ✅ Página de autenticação replicando o estilo LicitaReq
   ===================================================================== */
'use strict';

const PDFEngine = (() => {

  const COR = {
    petroleo:   '#00A896',
    petroleoD:  '#007568',
    petroleo400:'#29B5A7',
    petroleoLt: '#E6F7F5',
    executivo:  '#05668D',
    executivoD: '#034462',
    ink:        '#0A0F1E',
    muted:      '#475569',
    line:       '#E2E8F0',
    bg:         '#F8FAFC',
    white:      '#FFFFFF',
    avisoBg:    '#FEF3C7',
    avisoTx:    '#78350F',
    avisoBold:  '#92400E',
    ok:         '#059669',
    warn:       '#B45309',
    err:        '#DC2626'
  };
  const PAGE_MARGINS = [40, 62, 40, 78];
  const VERSAO_MODULO = 'OmniLicit LicitaETP v5.0';
  const SISTEMA_AUDIT = 'OmniLicit Audit';

  const sanitizar = s => {
    if (s == null) return '';
    return String(s)
      .replace(/[\[\]·•\-–—]*\s*(?:P[áa]gina|Page)\s+\d+\s*(?:de|of|\/)\s*\d+\s*[\[\]·•\-–—]*/gi, ' ')
      .replace(/^\s*\d+\s*(?:de|\/)\s*\d+\s*$/gm, ' ')
      .replace(/\s{2,}/g, ' ').trim()
      .replace(/^[\s:;\-–—,\.]+|[\s:;\-–—,\.]+$/g, '').trim();
  };

  const moeda = n => Number(n || 0).toLocaleString('pt-BR',
    { style: 'currency', currency: 'BRL' });

  const formatarDataHora = d => {
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt)) return '—';
    const p = n => String(n).padStart(2, '0');
    return p(dt.getDate()) + '/' + p(dt.getMonth()+1) + '/' + dt.getFullYear() +
           ' ' + p(dt.getHours()) + ':' + p(dt.getMinutes()) + ':' + p(dt.getSeconds());
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
      const base = (h1.toString(16).padStart(8,'0') + h2.toString(16).padStart(8,'0')).toUpperCase();
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
        out.push({ ul, fontSize: 9.5, lineHeight: 1.3, margin: [0, 0, 0, 6], color: COR.ink });
        ul = [];
      }
    };
    linhas.forEach(l => {
      if (/^[-•*]\s+/.test(l)) ul.push(l.replace(/^[-*•]\s+/, ''));
      else {
        flush();
        out.push({ text: l, fontSize: 9.5, lineHeight: 1.4, alignment: 'justify',
                   color: COR.ink, margin: [0, 0, 0, 6] });
      }
    });
    flush();
    return out.length ? out : [{ text: '— não informado —', italics: true, color: '#94A3B8', fontSize: 9.5 }];
  };

  const campo = (rotulo, valor) => ({ stack: [
    { text: rotulo.toUpperCase(), fontSize: 7.5, bold: true, color: COR.petroleoD,
      characterSpacing: 0.6, margin: [0, 7, 0, 3] },
    ...txtBloco(valor)
  ]});

  const secao = (n, t, blocos) => ({ stack: [
    { table: { widths: ['*'], body: [[{
      text: `${n} — ${t}`, bold: true, fontSize: 10, color: COR.white,
      fillColor: COR.petroleo, margin: [8, 6, 8, 6], characterSpacing: 0.3
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
                             color: COR.white, fillColor: COR.executivo,
                             margin: [4, 5, 4, 5] })),
          ...rows.map(r => r.map((c, idx) => ({
            text: sanitizar(String(c ?? '')), fontSize: wrapCols.includes(idx) ? 8 : 8.5,
            color: COR.ink, margin: [4, 4, 4, 4]
          })))
        ]
      },
      layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                hLineColor: () => COR.line, vLineColor: () => COR.line,
                paddingLeft: () => 2, paddingRight: () => 2,
                paddingTop: () => 1, paddingBottom: () => 1 },
      margin: [0, 2, 0, 10]
    };
  }

  function barra(pct) {
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    return { table: { widths: [`${p}%`, `${100 - p}%`], body: [[
      { text: '', fillColor: p >= 80 ? COR.ok : p >= 50 ? COR.warn : COR.err,
        border: [false, false, false, false], margin: [0, 4, 0, 4] },
      { text: '', fillColor: '#E2E8F0', border: [false, false, false, false],
        margin: [0, 4, 0, 4] }
    ]]}, layout: 'noBorders' };
  }

  /* ---------- CAPA ---------- */
  function blocoCapa(d, conf, meta, logoDataUrl) {
    const logo = logoDataUrl
      ? { image: logoDataUrl, fit: [110, 110], alignment: 'center', margin: [0, 0, 0, 14] }
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
        { table: { widths: ['*'], body: [[{
          stack: [
            { text: 'OMNILICIT · LICITAETP', fontSize: 8, bold: true,
              color: '#C2ECE7', alignment: 'center' },
            { text: 'ESTUDO TÉCNICO PRELIMINAR · DOCUMENTO OFICIAL', fontSize: 9.5, bold: true,
              color: COR.white, alignment: 'center', margin: [0, 4, 0, 0] },
          ],
          fillColor: COR.petroleo, margin: [0, 11, 0, 11],
        }]]}, layout: 'noBorders', margin: [0, 0, 0, 22] },

        logo,

        { text: sanitizar((d.id.orgao || 'ÓRGÃO / ENTIDADE').toUpperCase()),
          alignment: 'center', bold: true, fontSize: 15, color: COR.executivo,
          margin: [0, 0, 0, 4] },
        { text: sanitizar(d.id.unidade || ''), alignment: 'center', fontSize: 9,
          color: COR.muted },
        { text: d.id.uasg ? `UASG ${sanitizar(d.id.uasg)}` : '',
          alignment: 'center', fontSize: 8, color: COR.muted, margin: [0, 2, 0, 0] },

        { canvas: [{ type: 'line', x1: 60, y1: 0, x2: 455, y2: 0,
                     lineWidth: 1.2, lineColor: COR.petroleo }], margin: [0, 22, 0, 16] },

        { text: 'ESTUDO TÉCNICO PRELIMINAR',
          alignment: 'center', bold: true, fontSize: 20, color: COR.ink,
          characterSpacing: 1.2 },
        { text: 'E T P',
          alignment: 'center', bold: true, fontSize: 11, color: COR.executivo,
          characterSpacing: 6, margin: [0, 4, 0, 0] },
        { text: 'Lei nº 14.133/2021 · Art. 18, § 1º, incisos I a XI',
          alignment: 'center', fontSize: 9.5, color: COR.petroleoD, margin: [0, 10, 0, 0] },

        { canvas: [{ type: 'line', x1: 60, y1: 0, x2: 455, y2: 0,
                     lineWidth: 1.2, lineColor: COR.petroleo }], margin: [0, 16, 0, 20] },

        { table: { widths: [140, '*'], body: resumo.map(([k, v]) => [
          { text: k.toUpperCase(), fontSize: 7.8, bold: true, color: COR.petroleoD,
            fillColor: COR.petroleoLt, margin: [8, 6, 8, 6] },
          { text: String(v), fontSize: 9, color: COR.ink, margin: [8, 6, 8, 6] }
        ])},
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                    hLineColor: () => COR.line, vLineColor: () => COR.line,
                    paddingLeft: () => 0, paddingRight: () => 0,
                    paddingTop: () => 0, paddingBottom: () => 0 } },

        { text: '', margin: [0, 18, 0, 0] },
        { text: `Documento emitido eletronicamente em ${new Date().toLocaleString('pt-BR')} · TAG ${meta.tag}`,
          alignment: 'center', fontSize: 7, color: '#94A3B8' }
      ],
      pageBreak: 'after'
    };
  }

  /* ---------- NOTA DE ABERTURA ---------- */
  function blocoNota(d) {
    const blocoNotaItem = (titulo, texto, bg) => ({
      table: { widths: ['*'], body: [[{
        stack: [
          { text: titulo, fontSize: 9, bold: true, color: COR.petroleoD, margin: [0, 0, 0, 6] },
          { text: texto, fontSize: 10, color: '#334155', lineHeight: 1.7, alignment: 'justify' },
        ],
        fillColor: bg, margin: [20, 16, 20, 16],
      }]]},
      layout: { hLineColor: () => COR.petroleo, vLineColor: () => COR.petroleo,
                hLineWidth: () => 0.6, vLineWidth: () => 0.6,
                paddingLeft: () => 0, paddingRight: () => 0,
                paddingTop: () => 0, paddingBottom: () => 0 },
      margin: [0, 0, 0, 16],
    });

    return { stack: [
      { text: '', margin: [0, 20, 0, 0] },
      { text: 'NOTA DE APRESENTAÇÃO INSTITUCIONAL',
        alignment: 'center', bold: true, fontSize: 14, color: COR.executivo,
        characterSpacing: 0.8, margin: [0, 0, 0, 6] },
      { text: 'Termo de Abertura do Procedimento Administrativo',
        alignment: 'center', fontSize: 9.5, color: COR.petroleoD, margin: [0, 0, 0, 12] },
      { canvas: [{ type: 'line', x1: 60, y1: 0, x2: 455, y2: 0,
                   lineWidth: 1.2, lineColor: COR.petroleo }], margin: [0, 0, 0, 20] },

      blocoNotaItem('I. CONTEXTUALIZAÇÃO',
        'O presente Estudo Técnico Preliminar (ETP) formaliza o início da fase preparatória ' +
        'da contratação pública no âmbito deste órgão, em conformidade com a Lei nº 14.133/2021, ' +
        'seu Art. 18, § 1º, e demais normas correlatas. O documento é instruído com a identificação ' +
        'da necessidade, a devida motivação administrativa, a estimativa de valor e o enquadramento ' +
        'legal aplicável, servindo de base para as etapas subsequentes de planejamento da contratação.',
        COR.white),

      blocoNotaItem('II. FINALIDADE E FUNDAMENTAÇÃO LEGAL',
        'Este documento tem por finalidade subsidiar a elaboração do Termo de Referência ou ' +
        'Projeto Básico, garantindo a motivação e o planejamento previstos no Art. 18 da Lei ' +
        'nº 14.133/2021. A instrução processual observa ainda os princípios do Art. 5º — legalidade, ' +
        'impessoalidade, moralidade, publicidade, eficiência, interesse público, motivação, segurança ' +
        'jurídica, razoabilidade, competitividade e eficácia — bem como as diretrizes do Art. 11.',
        COR.bg),

      blocoNotaItem('III. AUTENTICIDADE E RASTREABILIDADE',
        'Este documento foi gerado eletronicamente pelo sistema LicitaETP (OmniLicit), possui TAG ' +
        'única rastreável pelo OmniLicit Audit e hash SHA-256 de integridade impresso no rodapé ' +
        'de cada página. Sua validade jurídica está condicionada à conferência pela assessoria ' +
        'jurídica, pelo controle interno e pela autoridade competente.',
        COR.petroleoLt),

      { text: `Processo administrativo nº ${sanitizar(d.id.processo) || '—'} · ETP nº ${sanitizar(d.id.numero) || '—'}/${sanitizar(d.id.exercicio) || '—'}`,
        alignment: 'center', fontSize: 8.5, italics: true, color: COR.muted, margin: [0, 14, 0, 0] }
    ], pageBreak: 'after' };
  }

  /* ---------- CONFORMIDADE ---------- */
  function blocoConformidade(d, conf, meta) {
    const linhas = conf.linhas.map(l => [
      { text: l.n, bold: true, alignment: 'center' },
      { text: sanitizar(l.t) },
      { text: l.status, bold: true, color: l.cor, fillColor: l.bg, alignment: 'center' },
      { text: `${l.pct}%`, alignment: 'center', bold: true, color: l.cor }
    ]);

    return { stack: [
      { text: 'PAINEL DE CONFORMIDADE ETP', bold: true, fontSize: 12,
        color: COR.petroleoD, alignment: 'center', characterSpacing: 0.8, margin: [0, 6, 0, 2] },
      { text: 'Estrutura de leitura automatizada — compatível com validação pelo OmniLicit Audit',
        fontSize: 8.5, color: COR.muted, alignment: 'center', margin: [0, 0, 0, 12] },
      { table: { headerRows: 1, widths: [38, '*', 72, 42], body: [
        [
          { text: 'INCISO', bold: true, fontSize: 7.5, color: COR.white,
            fillColor: COR.petroleo, alignment: 'center', margin: [4, 6, 4, 6] },
          { text: 'REQUISITO LEGAL — ART. 18, § 1º, LEI 14.133/2021', bold: true,
            fontSize: 7.5, color: COR.white, fillColor: COR.petroleo, margin: [4, 6, 4, 6] },
          { text: 'STATUS', bold: true, fontSize: 7.5, color: COR.white,
            fillColor: COR.petroleo, alignment: 'center', margin: [4, 6, 4, 6] },
          { text: 'SCORE', bold: true, fontSize: 7.5, color: COR.white,
            fillColor: COR.petroleo, alignment: 'center', margin: [4, 6, 4, 6] }
        ], ...linhas
      ]},
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                  hLineColor: () => COR.line, vLineColor: () => COR.line,
                  paddingLeft: () => 5, paddingRight: () => 5,
                  paddingTop: () => 5, paddingBottom: () => 5 } },
      { text: '', margin: [0, 12, 0, 0] },
      { columns: [
        { width: '*', stack: [
          { text: 'SCORE GLOBAL DE CONFORMIDADE', fontSize: 7.5, bold: true,
            color: COR.petroleoD, characterSpacing: 0.6, margin: [0, 0, 0, 5] },
          barra(conf.score),
          { text: `${conf.score}% de aderência aos incisos obrigatórios`,
            fontSize: 8.5, color: '#334155', margin: [0, 6, 0, 0] }
        ]},
        { width: 130, stack: [
          { text: 'TAG DE AUTENTICAÇÃO', fontSize: 7.5, bold: true,
            color: COR.petroleoD, characterSpacing: 0.6, margin: [0, 0, 0, 5] },
          { text: meta.tag, fontSize: 8, bold: true, color: COR.petroleoD, alignment: 'right' }
        ]}
      ]}
    ], pageBreak: 'after' };
  }

  /* ---------- CORPO ---------- */
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
            color: COR.petroleoD, margin: [8, 8, 8, 8], fillColor: COR.petroleoLt },
          { text: moeda(d.precos.total), bold: true, fontSize: 11,
            color: COR.ok, alignment: 'right', margin: [8, 7, 8, 7],
            fillColor: COR.petroleoLt }
        ]]}, layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5,
                        hLineColor: () => COR.petroleo, vLineColor: () => COR.petroleo,
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

  /* ---------- APROVAÇÃO ---------- */
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
            bold: true, color: COR.petroleoD, characterSpacing: 0.6, margin: [0, 0, 0, 26] },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 215, y2: 0,
                       lineWidth: 0.8, lineColor: '#94A3B8' }] },
          { text: sanitizar(a.nome) || '—', bold: true, fontSize: 9,
            color: COR.ink, margin: [0, 5, 0, 0] },
          { text: sanitizar(a.cargo) || '—', fontSize: 8, color: COR.muted,
            margin: [0, 1, 0, 0] },
          { text: sanitizar(a.orgao) || '—', fontSize: 7.5, color: COR.muted,
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
        color: COR.petroleoD, characterSpacing: 0.8, margin: [0, 0, 0, 8] },
      { table: { widths: ['*','*','*'], body: [
        [
          { text: 'FISCAL TITULAR', fontSize: 7, bold: true, color: COR.petroleoD,
            fillColor: COR.petroleoLt, alignment: 'center', margin: [6, 5, 6, 3] },
          { text: 'FISCAL SUBSTITUTO', fontSize: 7, bold: true, color: COR.petroleoD,
            fillColor: COR.petroleoLt, alignment: 'center', margin: [6, 5, 6, 3] },
          { text: 'GESTOR DO CONTRATO', fontSize: 7, bold: true, color: COR.petroleoD,
            fillColor: COR.petroleoLt, alignment: 'center', margin: [6, 5, 6, 3] }
        ],
        [
          { text: sanitizar(g.fiscalTitular) || '—', fontSize: 8.5, color: COR.ink,
            alignment: 'center', margin: [6, 4, 6, 6] },
          { text: sanitizar(g.fiscalSubstituto) || '—', fontSize: 8.5, color: COR.ink,
            alignment: 'center', margin: [6, 4, 6, 6] },
          { text: sanitizar(g.gestor) || '—', fontSize: 8.5, color: COR.ink,
            alignment: 'center', margin: [6, 4, 6, 6] }
        ]
      ]},
        layout: { hLineWidth: () => 0.
