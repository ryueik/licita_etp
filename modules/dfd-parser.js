/* =====================================================================
   OMNILICIT · LicitaETP · DFD Parser Universal
   Extrai campos estruturados de DFD em PDF (posicional + textual)
   ou JSON (LicitaReq / OmniLicit).
   ===================================================================== */
'use strict';

const DFDParser = (() => {

  /* ---------- 2.1 Normalização e blacklist ---------- */
  const norm = s => String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[:\-–—|.,;]+/g, ' ')
    .replace(/\//g, ' ').replace(/\s+/g, ' ').trim();

  const BLACKLIST = new Set([
    'orgao','orgao entidade','orgao/entidade','entidade','uasg','uasg codigo',
    'unidade','unidade requisitante','unidade demandante','setor',
    'exercicio','numero','n do etp','processo','processo administrativo',
    'data','data de elaboracao','objeto','objeto da contratacao','objeto da demanda',
    'descricao','descricao do objeto','descricao resumida do objeto',
    'justificativa','justificativa da necessidade','justificativa da demanda',
    'necessidade','motivacao','responsavel','responsavel pela demanda',
    'responsavel tecnico','solicitante','elaborador','cargo','funcao',
    'cargo funcao','cargo/funcao','email','e-mail','telefone','tel','fone','ramal',
    'valor','valor estimado','valor total','valor global','valor total estimado',
    'valor estimado da contratacao','dfd','n do dfd','numero do dfd',
    'nao informado','nao informada','nao se aplica','n/a','n/d','nd','na',
    '-','--','---','—','–','...','demanda','solicitacao','pela','pelo',
    'elaboracao','dotacao','dotacao orcamentaria','rubrica','fonte','fonte de recurso',
    'fonte do recurso','natureza da despesa','elemento de despesa',
    'modalidade','modalidade pretendida','modalidade de licitacao','criterio',
    'criterio de julgamento','tipo de julgamento',
    'prazo','prazo de execucao','prazo de entrega','prazo de vigencia','prazo contratual',
    'local','local de entrega','local da entrega','local de prestacao',
    'condicoes de pagamento','forma de pagamento','condicoes de recebimento',
    'fiscal','fiscal titular','fiscal substituto','gestor','gestor do contrato',
    'gestor contratual','pca','alinhamento ao pca','quantitativo','quantidade'
  ]);

  const ehLabel = v => {
    if (v == null) return true;
    const n = norm(v);
    return !n || BLACKLIST.has(n);
  };

  const cleanValue = text => {
    if (text == null) return '';
    let v = String(text).replace(/\r/g, '\n').replace(/\n+/g, ' ')
                        .replace(/\t/g, ' ').replace(/\s{2,}/g, ' ');
    // Anti-paginação
    v = v.replace(/\b(?:P[áa]gina|Page)\s+\d+\s*(?:de|of|\/)\s*\d+\b/gi, ' ');
    v = v.replace(/^\s*\d+\s*(?:de|\/)\s*\d+\s*$/gm, ' ');
    v = v.replace(/^[\s:;\-–—_\/|>»•·●◦‣▪►]+/, '');
    v = v.replace(/[\s:;\-–—_\/|]+$/, '');
    // Fragmentos residuais de rótulos
    [
      /cargo\s*\/\s*fun[çc][ãa]o\s*[:\-–—]?\s*/gi,
      /respons[áa]vel\s+(?:pela|da)\s+demanda\s*[:\-–—]?\s*/gi,
      /respons[áa]vel\s+t[ée]cnico\s*[:\-–—]?\s*/gi,
      /justificativa\s+(?:da\s+necessidade|da\s+demanda)\s*[:\-–—]?\s*/gi,
      /descri[çc][ãa]o\s+resumida\s+do\s+objeto\s*[:\-–—]?\s*/gi,
      /objeto\s+da\s+contrata[çc][ãa]o\s*[:\-–—]?\s*/gi,
      /valor\s+(?:total\s+)?estimado\s*[:\-–—]?\s*/gi,
      /processo\s+administrativo\s*[:\-–—]?\s*/gi,
      /^\s*dfd\s*[:\-–—]?\s*/gi
    ].forEach(rx => { v = v.replace(rx, ' '); });

    v = v.replace(/\s{2,}/g, ' ').trim();
    return ehLabel(v) ? '' : v;
  };

  const normalizarMoeda = v => {
    if (!v) return '';
    let s = String(v).replace(/[^\d.,]/g, '');
    if (!s) return '';
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? '' : n.toFixed(2);
  };

  /* ---------- 2.2 JSON ---------- */
  async function fromJSON(file) {
    const txt = await file.text();
    let raw;
    try { raw = JSON.parse(txt); } catch { throw new Error('JSON inválido.'); }
    const d = raw?.dfd || raw?.dados?.dfd || raw?.documento?.dfd || raw?.dados || raw?.documento || raw;

    const pick = (...keys) => {
      for (const k of keys) {
        let cur = d;
        for (const p of String(k).split('.')) { cur = cur?.[p]; if (cur == null) break; }
        if (cur != null && String(cur).trim() !== '') return String(cur).trim();
      }
      return '';
    };

    return {
      origem: 'json',
      campos: {
        numero:      cleanValue(pick('numero','numeroDFD','numero_dfd','codigo','id')),
        orgao:       cleanValue(pick('orgao','orgaoEntidade','entidade','instituicao')),
        uasg:        cleanValue(pick('uasg','codigoUasg')),
        unidade:     cleanValue(pick('unidade','unidadeRequisitante','setor','departamento')),
        responsavel: cleanValue(pick('responsavel','responsavelDemanda','solicitante','nome','autor')),
        cargo:       cleanValue(pick('cargo','funcao','cargoFuncao','cargoResponsavel')),
        email:       cleanValue(pick('email','emailInstitucional')),
        telefone:    cleanValue(pick('telefone','fone','ramal')),
        processo:    cleanValue(pick('processo','processoAdministrativo','numeroProcesso')),
        data:        cleanValue(pick('data','dataElaboracao','data_elaboracao')),

        objeto:        cleanValue(pick('objeto','objetoContratacao','descricao','descricaoObjeto','descricaoResumida')),
        justificativa: cleanValue(pick('justificativa','descricaoNecessidade','necessidade','motivacao')),

        // PCA
        pcaItem:        cleanValue(pick('pcaItem','itemPca','codigoPca','pca')),
        pcaPrevisto:    cleanValue(pick('pcaPrevisto','previstoPca')) || 'Sim',
        pcaJustificativa: cleanValue(pick('pcaJustificativa','justificativaPca')),

        // Enquadramento
        dotacao:      cleanValue(pick('dotacao','dotacaoOrcamentaria','rubrica')),
        fonteRecurso: cleanValue(pick('fonteRecurso','fonte','naturezaDespesa')),
        modalidade:   cleanValue(pick('modalidade','modalidadePretendida','modalidadeLicitacao')),
        criterio:     cleanValue(pick('criterio','criterioJulgamento','tipoJulgamento')),

        // Prazos / entrega
        prazoExecucao:      cleanValue(pick('prazoExecucao','prazoEntrega','prazo')),
        localEntrega:       cleanValue(pick('localEntrega','local')),
        condicoesPagamento: cleanValue(pick('condicoesPagamento','formaPagamento')),

        // Governança
        fiscalTitular:    cleanValue(pick('fiscalTitular','fiscal')),
        fiscalSubstituto: cleanValue(pick('fiscalSubstituto')),
        gestorContrato:   cleanValue(pick('gestorContrato','gestor')),

        // Quantitativo textual
        qtdDescricao: cleanValue(pick('quantidadeDescricao','qtdDescricao','quantitativo')),

        valor: normalizarMoeda(pick('valor','valorEstimado','valorTotal','valorGlobal','total'))
      },
      raw,
      logo: d.logo || d.logoInstitucional || d.logoBase64 || raw?.logo || null
    };
  }

  /* ---------- 2.3 PDF (posicional + textual) ---------- */
  function construirCelulas(paginas) {
    const celulas = [];
    for (const pag of paginas) {
      const rows = [];
      const itens = [...pag.items].sort((a, b) => b.y - a.y || a.x - b.x);
      for (const item of itens) {
        if (!item.str?.trim()) continue;
        let row = rows.find(r => Math.abs(r.y - item.y) < 3.5);
        if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
        row.items.push(item);
      }
      for (const row of rows) {
        row.items.sort((a, b) => a.x - b.x);
        let cur = null; const rowCells = [];
        for (const it of row.items) {
          const fimAtual = cur ? cur.x + cur.w : 0;
          const gap = cur ? it.x - fimAtual : Infinity;
          if (cur && gap >= 0 && gap < 15) {
            cur.text += ' ' + it.str;
            cur.w = (it.x + (it.w || 0)) - cur.x;
          } else {
            if (cur) rowCells.push(cur);
            cur = { x: it.x, y: row.y, w: it.w || 0, page: pag.pageNum, text: it.str };
          }
        }
        if (cur) rowCells.push(cur);
        for (const c of rowCells) {
          c.text = c.text.replace(/\s+/g, ' ').trim();
          if (c.text) celulas.push(c);
        }
      }
    }
    return celulas;
  }

  function buscarLabel(celulas, rotulos) {
    const alvos = rotulos.map(norm);
    const achados = [];
    for (const cel of celulas) {
      const n = norm(cel.text);
      if (!n || n.length > 90) continue;
      for (const alvo of alvos) {
        const exato  = n === alvo;
        const prefix = n.startsWith(alvo + ' ') || n.startsWith(alvo + ':');
        if (exato || prefix) { achados.push({ cel, alvoLen: alvo.length, exato }); break; }
      }
    }
    if (!achados.length) return null;
    achados.sort((a, b) => (Number(b.exato) - Number(a.exato)) || (a.alvoLen - b.alvoLen));
    return achados[0].cel;
  }

  function extrairValorDeLabel(celulas, labelCel) {
    if (!labelCel) return '';
    const direita = celulas.filter(c =>
      c.page === labelCel.page &&
      Math.abs(c.y - labelCel.y) < 3.5 &&
      c.x > labelCel.x + labelCel.w - 2 &&
      !ehLabel(c.text)
    ).sort((a, b) => a.x - b.x);
    if (direita.length) {
      const v = cleanValue(direita[0].text);
      if (v) return v;
    }
    const x0 = labelCel.x - 15;
    const x1 = labelCel.x + Math.max(280, labelCel.w + 260);
    const abaixo = celulas.filter(c =>
      c.page === labelCel.page &&
      c.y < labelCel.y - 3 && c.y > labelCel.y - 90 &&
      c.x >= x0 && c.x <= x1
    ).sort((a, b) => (b.y - a.y) || (a.x - b.x));
    for (const c of abaixo) {
      if (ehLabel(c.text)) continue;
      const v = cleanValue(c.text);
      if (v) return v;
    }
    return '';
  }

  function extrairCampo(celulas, rotulos) {
    const lc = buscarLabel(celulas, rotulos);
    return extrairValorDeLabel(celulas, lc);
  }

  async function fromPDF(file) {
    if (!window.pdfjsLib) throw new Error('pdf.js não disponível.');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const paginas = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = [];
      content.items.forEach(item => {
        const s = String(item.str || '');
        if (!s) return;
        items.push({ str: s, x: item.transform[4], y: item.transform[5],
                     w: item.width || 0, h: item.height || 0 });
      });
      paginas.push({ pageNum: i, items });
    }

    const celulas = construirCelulas(paginas);
    const campos = {
      orgao:       extrairCampo(celulas, ['Órgão / Entidade','Órgão Entidade','Órgão','Entidade']),
      uasg:        extrairCampo(celulas, ['UASG / Código','UASG','Código UASG']),
      unidade:     extrairCampo(celulas, ['Unidade Requisitante','Unidade Demandante','Setor Requisitante','Setor Demandante','Unidade / Setor','Unidade','Setor']),
      responsavel: extrairCampo(celulas, ['Responsável pela Demanda','Responsável Técnico','Responsável pela Elaboração','Responsável','Solicitante','Elaborador']),
      cargo:       extrairCampo(celulas, ['Cargo / Função','Cargo/Função','Cargo e Função','Cargo','Função']),
      processo:    extrairCampo(celulas, ['Processo Administrativo','Nº do Processo','Processo']),
      data:        extrairCampo(celulas, ['Data de Elaboração','Data']),

      objeto:        extrairCampo(celulas, ['Descrição Resumida do Objeto','Descrição do Objeto','Objeto da Contratação','Objeto da Demanda','Objeto']),
      justificativa: extrairCampo(celulas, ['Justificativa da Necessidade Pública','Justificativa da Necessidade','Justificativa da Demanda','Justificativa']),

      pcaItem:      extrairCampo(celulas, ['Item / Código do PCA','Item do PCA','Código do PCA','PCA']),
      pcaPrevisto:  extrairCampo(celulas, ['Demanda prevista no PCA','Previsão no PCA','PCA']),

      dotacao:      extrairCampo(celulas, ['Dotação Orçamentária','Dotação','Rubrica']),
      fonteRecurso: extrairCampo(celulas, ['Fonte de Recurso','Fonte']),
      modalidade:   extrairCampo(celulas, ['Modalidade Pretendida','Modalidade de Licitação','Modalidade']),
      criterio:     extrairCampo(celulas, ['Critério de Julgamento','Tipo de Julgamento','Critério']),

      prazoExecucao:      extrairCampo(celulas, ['Prazo de Execução','Prazo de Entrega','Prazo']),
      localEntrega:       extrairCampo(celulas, ['Local de Entrega','Local']),
      condicoesPagamento: extrairCampo(celulas, ['Condições de Pagamento','Forma de Pagamento']),

      fiscalTitular:    extrairCampo(celulas, ['Fiscal Titular do Contrato','Fiscal Titular','Fiscal']),
      fiscalSubstituto: extrairCampo(celulas, ['Fiscal Substituto']),
      gestorContrato:   extrairCampo(celulas, ['Gestor do Contrato','Gestor']),

      qtdDescricao: extrairCampo(celulas, ['Estimativa de Quantidades','Quantidade Estimada','Quantitativo']),

      numero: extrairCampo(celulas, ['Nº do DFD','Número do DFD','DFD']),
      valor:  normalizarMoeda(extrairCampo(celulas, ['Valor Estimado da Contratação','Valor Total Estimado','Valor Estimado','Valor Global','Valor']))
    };

    // Fallback: e-mail e telefone por regex
    const textoPlano = paginas.flatMap(p => p.items.map(i => i.str)).join(' ');
    const emailM = textoPlano.match(/([\w._%+\-]+@[\w.\-]+\.[A-Za-z]{2,})/);
    if (emailM) campos.email = cleanValue(emailM[1]);
    const telM = textoPlano.match(/(?:Telefone|Tel|Fone|Ramal)\s*[:\-–—]?\s*(\(?\d{2}\)?\s*[\s\-]?\d{4,5}[\s\-]?\d{4})/i);
    if (telM) campos.telefone = cleanValue(telM[1]);

    // Fallback regex para modalidade / critério
    if (!campos.modalidade) {
      const m = textoPlano.match(/\b(Preg[ãa]o\s+Eletr[ôo]nico|Concorr[êe]ncia\s+Eletr[ôo]nica|Dispensa\s+Eletr[ôo]nica|Inexigibilidade|Leil[ãa]o|Di[áa]logo\s+Competitivo)\b/i);
      if (m) campos.modalidade = cleanValue(m[1]);
    }
    if (!campos.criterio) {
      const m = textoPlano.match(/\b(Menor\s+Pre[çc]o|Maior\s+Desconto|Melhor\s+T[ée]cnica|T[ée]cnica\s+e\s+Pre[çc]o|Maior\s+Lance|Maior\s+Retorno\s+Econ[ôo]mico)\b/i);
      if (m) campos.criterio = cleanValue(m[1]);
    }

    // Anti-paginação final
    Object.keys(campos).forEach(k => {
      if (typeof campos[k] === 'string') campos[k] = cleanValue(campos[k]);
    });

    return { origem: 'pdf', campos, raw: textoPlano };
  }

  /* ---------- 2.4 Roteador ---------- */
  async function parse(file) {
    const nome = (file?.name || '').toLowerCase();
    const tipo = (file?.type || '').toLowerCase();
    if (nome.endsWith('.json') || tipo.includes('json')) return fromJSON(file);
    if (nome.endsWith('.pdf')  || tipo.includes('pdf'))  return fromPDF(file);
    throw new Error('Formato não suportado. Envie PDF ou JSON.');
  }

  return { parse, fromJSON, fromPDF, cleanValue, normalizarMoeda };
})();

window.DFDParser = DFDParser;
