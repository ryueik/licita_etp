/* =====================================================================
   OMNILICIT · LicitaETP · DFD Parser Universal v6.4
   ---------------------------------------------------------------------
   ✅ v6.4: STOPS plural-aware (Quantidades, Itens, etc.)
   ✅ Post-processing isolarObjeto() — belt-and-suspenders
   ✅ Corte inline de quantidades ("30 workstations e 20 notebooks")
   ✅ Regex prioritária: Nº DFD, PCA Item, Data, Objeto
   ===================================================================== */
'use strict';

const DFDParser = (() => {

  /* =====================================================================
     1. NORMALIZAÇÃO E BLACKLIST
     ===================================================================== */
  const norm = s => String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[:\-–—|.,;]+/g, ' ')
    .replace(/\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const BLACKLIST_LABELS = new Set([
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
    'gestor contratual','pca','alinhamento ao pca','quantitativo','quantidade',
    'emitido em','gerado em','documento gerado','pagina','page',
    'assinatura','carimbo','data de emissao','hash','tag','sha 256',
    'estimativa de quantidade','estimativa de quantidades','memoria de calculo'
  ]);

  /* =====================================================================
     2. DETECÇÃO DE RUÍDO
     ===================================================================== */
  function ehRuido(texto) {
    if (texto == null) return true;
    const s = String(texto).trim();
    if (!s) return true;
    if (s.length < 2) return true;

    if (/^[\w._%+\-]+@[\w.\-]+\.[A-Za-z]{2,}$/.test(s)) return true;
    if (/\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}(:\d{2})?/.test(s)) return true;
    if (/^(emitido|gerado|documento\s+gerado|documento\s+emitido)\s+(em|por)\b/i.test(s)) return true;
    if (/\b[A-F0-9]{64}\b/i.test(s)) return true;
    if (/OMNILICIT\s*::/i.test(s)) return true;
    if (/^https?:\/\//i.test(s)) return true;
    if (/^(P[áa]gina|Page)\s+\d+\s*(de|of|\/)\s*\d+/i.test(s)) return true;
    if (/^\d+\s*(de|\/)\s*\d+$/.test(s)) return true;
    if (/^[-=_•·●▪►◆]{3,}$/.test(s)) return true;
    if (/^[\d\s\.\-\/]+$/.test(s) && s.length < 6) return true;
    if (/^[^\w\s]{1,2}$/.test(s)) return true;

    return false;
  }

  function ehLabel(v) {
    if (v == null) return true;
    const n = norm(v);
    if (!n) return true;
    return BLACKLIST_LABELS.has(n);
  }

  /* =====================================================================
     3. SANITIZAÇÃO DO TEXTO COMPLETO
     ===================================================================== */
  function sanitizarTextoCompleto(txt) {
    if (!txt) return '';
    let t = String(txt);

    t = t.replace(/^[^\n]*\bEmitido\s+em\b[^\n]*$/gim, '');
    t = t.replace(/^[^\n]*\bGerado\s+em\b[^\n]*$/gim, '');
    t = t.replace(/^[^\n]*Documento\s+gerado\s+eletronicamente[^\n]*$/gim, '');
    t = t.replace(/^[^\n]*\bOMNILICIT\s*::[^\n]*$/gim, '');
    t = t.replace(/^[^\n]*\bSHA-?256\b[^\n]*$/gim, '');
    t = t.replace(/^[^\n]*\b[A-F0-9]{64}\b[^\n]*$/gim, '');
    t = t.replace(/^[^\n]*\bP[áa]gina\s+\d+\s*(de|of|\/)\s*\d+[^\n]*$/gim, '');
    t = t.replace(/^[^\n]*\bPage\s+\d+\s*(de|of|\/)\s*\d+[^\n]*$/gim, '');
    t = t.replace(/^[^\n]*https?:\/\/[^\n]*$/gim, '');
    t = t.replace(/^[^\n]*LicitaReq\s+[^\n]*$/gim, '');
    t = t.replace(/^[^\n]*LicitaAudit\s+[^\n]*$/gim, '');
    t = t.replace(/^[^\n]*LicitaETP\s+[^\n]*$/gim, '');
    t = t.replace(/\[\[PAGINA_\d+_DE_\d+\]\]/gi, '');
    t = t.replace(/^[-=_]{3,}\s*$/gm, '');
    t = t.replace(/\n{3,}/g, '\n\n');

    return t.trim();
  }

  /* =====================================================================
     4. CLEAN VALUE
     ===================================================================== */
  const cleanValue = text => {
    if (text == null) return '';
    let v = String(text).replace(/\r/g, '\n').replace(/\n+/g, ' ')
                        .replace(/\t/g, ' ').replace(/\s{2,}/g, ' ');

    v = v.replace(/\b(?:P[áa]gina|Page)\s+\d+\s*(?:de|of|\/)\s*\d+\b/gi, ' ');
    v = v.replace(/^\s*\d+\s*(?:de|\/)\s*\d+\s*$/gm, ' ');
    v = v.replace(/^[\s:;\-–—_\/|>»•·●◦‣▪►]+/, '');
    v = v.replace(/[\s:;\-–—_\/|]+$/, '');

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

    if (ehLabel(v) || ehRuido(v)) return '';
    return v;
  };

  /* =====================================================================
     5. VALIDADORES
     ===================================================================== */
  const normalizarMoeda = v => {
    if (!v) return '';
    let s = String(v).replace(/[^\d.,]/g, '');
    if (!s) return '';
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? '' : n.toFixed(2);
  };

  const validaNumeroDFD = v => {
    if (!v || v.length < 3) return false;
    const s = String(v).trim();
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(s)) return false;
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return false;
    if (/^\d{4,}$/.test(s)) return false;
    if (/^(Preg[ãa]o|Concorr[êe]ncia|Dispensa|Inexigibilidade|Leil[ãa]o|Di[áa]logo)/i.test(s)) return false;
    if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(s)) return false;
    if (/\bDFD\b/i.test(s)) return true;
    if (/^\s*\d{1,6}\s*[\/\-\.]\s*\d{2,4}\s*$/.test(s)) return true;
    if (/n[º°]?\s*\d{1,6}\s*[\/\-\.]\s*\d{2,4}/i.test(s)) return true;
    return false;
  };

  const validaPcaItem = v => {
    if (!v || v.length < 4) return false;
    const s = String(v).trim();
    if (/^(Preg[ãa]o|Concorr[êe]ncia|Dispensa|Inexigibilidade|Leil[ãa]o|Di[áa]logo)/i.test(s)) return false;
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(s)) return false;
    if (/^(DFD|ETP|TR|Edital|Processo|Ofício)\s*$/i.test(s)) return false;
    if (/\bPCA\b/i.test(s)) return true;
    if (/\bITE?M\b[\s\-–—_]?\d{1,6}/i.test(s)) return true;
    return false;
  };

  const validaData = v => {
    if (!v) return false;
    const s = String(v).trim();
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(s)) return true;
    if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(s)) return true;
    if (/^\d{1,2}\s+de\s+[a-zç]+(\s+de\s+\d{4})?/i.test(s)) return true;
    return false;
  };

  const validaObjeto = v => {
    if (!v || v.length < 8) return false;
    if (ehRuido(v)) return false;
    if (/^\s*[\d\/\-\.:\s]+\s*$/.test(v)) return false;
    if (/\b(emitido|gerado|p[áa]gina|page|sha-?256|omnilicit)\b/i.test(v)) return false;
    if (ehLabel(v)) return false;
    if (/^\s*(DFD|ETP)\s*\d/i.test(v) && v.length < 20) return false;
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(v)) return false;
    if (/^[A-ZÀ-Ú][a-zà-ú]+(\s+[A-ZÀ-Ú][a-zà-ú]+){1,3}$/.test(v) && v.length < 40) return false;
    return true;
  };

  const validaNome = v => {
    if (!v || v.length < 4) return false;
    if (/^\d/.test(v)) return false;
    if (/[0-9]{4,}/.test(v)) return false;
    if (ehRuido(v)) return false;
    const partes = v.split(/\s+/).filter(Boolean);
    return partes.length >= 2;
  };

  const validaValor = v => {
    if (!v) return false;
    if (!/\d/.test(v)) return false;
    const palavrasLongas = (v.match(/\b[a-zá-ú]{5,}\b/gi) || []).length;
    if (palavrasLongas >= 2) return false;
    return true;
  };

  /* =====================================================================
     ✅ v6.4: ISOLAR OBJETO — post-processing
     ---------------------------------------------------------------------
     Corta o objeto em qualquer ponto onde começar:
     1. Um label de outro campo (Quantidade, Valor, Prazo, ...)
     2. Uma linha iniciada por número + palavra (ex.: "30 workstations")
     3. Um trecho de quantidade inline ("30 (trinta) workstations")
     ===================================================================== */
  function isolarObjeto(textoBruto) {
    if (!textoBruto) return '';
    let t = String(textoBruto).trim();

    /* --- CORTE 1: Labels que indicam OUTRO campo (plural-aware) --- */
    const CORTES_LABEL = [
      /* Quantidade / Quantitativo — PLURAL E SINGULAR */
      /\bEstimativas?\s+de\s+Quantidades?\b/i,
      /\bEstimativas?\s+de\s+Quantidades?\s+Estimadas?\b/i,
      /\bQuantitativos?\s+Estimados?\b/i,
      /\bQuantitativos?\b/i,
      /\bQuantidades?\s+Estimadas?\b/i,
      /\bQuantidades?\b/i,
      /\bEspecifica[çc][ãa]o\s+de\s+Quantidades?\b/i,
      /\bMem[óo]ria\s+de\s+C[áa]lculo\b/i,
      /\bItens?\s+da\s+Contrata[çc][ãa]o\b/i,
      /\bListas?\s+de\s+Itens\b/i,
      /\bRela[çc][ãa]o\s+de\s+Itens\b/i,
      /\bN[º°]?\s+de\s+Itens\b/i,

      /* Valor */
      /\bValor\s+(?:Total\s+)?Estimados?\b/i,
      /\bValor\s+Estimados?\b/i,
      /\bValor\s+Global\b/i,
      /\bValor\s+Total\b/i,
      /\bValores?\b/i,

      /* Justificativa / Motivação / Fundamentação */
      /\bJustificativas?\s+(?:da\s+)?(?:Necessidades?|Demandas?|Contrata[çc][ãa]o)\b/i,
      /\bJustificativas?\b/i,
      /\bFundamenta[çc][ãa]o\b/i,
      /\bMotiva[çc][ãa]o\b/i,
      /\bRaz[ãa]o\s+da\s+Necessidades?\b/i,

      /* Enquadramento */
      /\bModalidades?\s+(?:Pretendidas?|de\s+Licita[çc][ãa]o)\b/i,
      /\bModalidades?\b/i,
      /\bCrit[ée]rios?\s+de\s+Julgamentos?\b/i,
      /\bNaturezas?\s+do\s+Objeto\b/i,
      /\bEnquadramentos?\b/i,

      /* Prazos e local */
      /\bPrazos?\s+de\s+Execu[çc][ãa]o\b/i,
      /\bPrazos?\s+de\s+Entregas?\b/i,
      /\bPrazos?\s+Contratuais?\b/i,
      /\bPrazos?\b/i,
      /\bLocais?\s+de\s+Entregas?\b/i,
      /\bLocais?\s+da\s+Presta[çc][ãa]o\b/i,
      /\bLocais?\b/i,

      /* Condições de pagamento */
      /\bCondi[çc][õo]es\s+de\s+Pagamentos?\b/i,
      /\bFormas?\s+de\s+Pagamentos?\b/i,

      /* Identificação */
      /\bData\s+de\s+Elabora[çc][ãa]o\b/i,
      /\bData\s+da\s+Formaliza[çc][ãa]o\b/i,
      /\bProcessos?\s+Administrativos?\b/i,
      /\bProcessos?\b/i,
      /\bRespons[áa]veis?\s+(?:pela|da)\b/i,
      /\bFiscais?\s+(?:Titulares?|Substitutos?|do\s+Contratos?)?\b/i,
      /\bGestores?\s+(?:do\s+Contratos?)?\b/i,

      /* Orçamento */
      /\bDota[çc][õo]es?\s+Or[çc]ament[áa]rias?\b/i,
      /\bFontes?\s+de\s+Recursos?\b/i,

      /* PCA */
      /\bItens?\s+do\s+PCA\b/i,
      /\bC[óo]digos?\s+do\s+PCA\b/i,
      /\bAlinhamentos?\s+ao\s+PCA\b/i,
      /\bPCA\b/,

      /* Blocos finais */
      /\bBenef[íi]cios\b/i,
      /\bResultados?\s+Pretendidos?\b/i,
      /\bProvid[êe]ncias?\b/i,
    ];

    let menorIdx = t.length;
    for (const rx of CORTES_LABEL) {
      const m = t.match(rx);
      if (m && m.index < menorIdx) menorIdx = m.index;
    }
    t = t.slice(0, menorIdx).trim();

    /* --- CORTE 2: Linha começando com número + palavra (quantidade) --- */
    const linhas = t.split(/\n/).map(l => l.trim()).filter(Boolean);
    while (linhas.length > 1) {
      const ultima = linhas[linhas.length - 1];

      // "30 (trinta) workstations e 20 (vinte) notebooks"
      if (/^\d+\s*(?:\([^)]+\))?\s+[A-Za-zÀ-Ú]/i.test(ultima)) {
        linhas.pop();
        continue;
      }
      // "30 unidades", "20 pçs", "5 kits", "10 caixas"
      if (/^\d+\s*(?:un|und|unidade|unidades|caixa|caixas|pe[çc]a|pe[çc]as|kit|kits|p[çc]s|pacote|pacotes|conjunto|conjuntos|par|pares)\b/i.test(ultima)) {
        linhas.pop();
        continue;
      }
      break;
    }
    t = linhas.join('\n').trim();

    /* --- CORTE 3: Quantidade inline ("30 (trinta) workstations") --- */
    const rxQtdInline = /\s+\d+\s*(?:\([^)]+\))?\s*(?:workstations?|notebooks?|computadores?|servidores?|cadeiras?|mesas?|monitores?|impressoras?|scanners?|esta[çc][õo]es|unidades?|unid\b|p[çc]s\b|kits?\b|caixas?\b|pe[çc]as?\b|licen[çc]as?\b|assinaturas?\b)/i;
    const m = t.match(rxQtdInline);
    if (m && m.index > 20) {
      t = t.slice(0, m.index).trim();
    }

    /* --- CORTE 4: Remover fragmentos residuais no fim --- */
    t = t.replace(/[\s,;:\-–—.]+$/, '').trim();

    /* --- CORTE 5: Parágrafo iniciando com "Quantidade:" ou "Qtd:" --- */
    t = t.replace(/\bQuantidade[s]?\s*:\s*[\s\S]*$/i, '').trim();
    t = t.replace(/\bQtd\.?\s*:\s*[\s\S]*$/i, '').trim();

    return t;
  }

  /* =====================================================================
     6. PARSER DE JSON
     ===================================================================== */
  async function fromJSON(file) {
    const txt = await file.text();
    let raw;
    try { raw = JSON.parse(txt); } catch { throw new Error('JSON inválido.'); }

    const d = raw?.dfd || raw?.dados?.dfd || raw?.documento?.dfd ||
              raw?.dados || raw?.documento || raw;

    const pick = (...keys) => {
      for (const k of keys) {
        let cur = d;
        for (const p of String(k).split('.')) {
          cur = cur?.[p];
          if (cur == null) break;
        }
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
        pcaItem:          cleanValue(pick('pcaItem','itemPca','codigoPca','pca')),
        pcaPrevisto:      cleanValue(pick('pcaPrevisto','previstoPca')) || 'Sim',
        pcaJustificativa: cleanValue(pick('pcaJustificativa','justificativaPca')),
        dotacao:      cleanValue(pick('dotacao','dotacaoOrcamentaria','rubrica')),
        fonteRecurso: cleanValue(pick('fonteRecurso','fonte','naturezaDespesa')),
        modalidade:   cleanValue(pick('modalidade','modalidadePretendida','modalidadeLicitacao')),
        criterio:     cleanValue(pick('criterio','criterioJulgamento','tipoJulgamento')),
        prazoExecucao:      cleanValue(pick('prazoExecucao','prazoEntrega','prazo')),
        localEntrega:       cleanValue(pick('localEntrega','local')),
        condicoesPagamento: cleanValue(pick('condicoesPagamento','formaPagamento')),
        fiscalTitular:    cleanValue(pick('fiscalTitular','fiscal')),
        fiscalSubstituto: cleanValue(pick('fiscalSubstituto')),
        gestorContrato:   cleanValue(pick('gestorContrato','gestor')),
        qtdDescricao: cleanValue(pick('quantidadeDescricao','qtdDescricao','quantitativo')),
        valor: normalizarMoeda(pick('valor','valorEstimado','valorTotal','valorGlobal','total'))
      },
      raw,
      logo: d.logo || d.logoInstitucional || d.logoBase64 || raw?.logo || null
    };
  }

  /* =====================================================================
     7. PARSER DE PDF
     ===================================================================== */
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
          if (c.text && !ehRuido(c.text)) celulas.push(c);
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
        if (exato || prefix) {
          achados.push({ cel, alvoLen: alvo.length, exato });
          break;
        }
      }
    }
    if (!achados.length) return null;
    achados.sort((a, b) =>
      (Number(b.exato) - Number(a.exato)) || (a.alvoLen - b.alvoLen)
    );
    return achados[0].cel;
  }

  function extrairCampoValidado(celulas, rotulos, validador) {
    const lc = buscarLabel(celulas, rotulos);
    if (!lc) return '';

    const candidatos = [];

    const direita = celulas.filter(c =>
      c.page === lc.page &&
      Math.abs(c.y - lc.y) < 3.5 &&
      c.x > lc.x + lc.w - 2 &&
      !ehLabel(c.text) && !ehRuido(c.text)
    ).sort((a, b) => a.x - b.x);
    candidatos.push(...direita.map(c => c.text));

    const x0 = lc.x - 15;
    const x1 = lc.x + Math.max(280, lc.w + 260);
    const abaixo = celulas.filter(c =>
      c.page === lc.page &&
      c.y < lc.y - 3 && c.y > lc.y - 90 &&
      c.x >= x0 && c.x <= x1 &&
      !ehLabel(c.text) && !ehRuido(c.text)
    ).sort((a, b) => (b.y - a.y) || (a.x - b.x));
    candidatos.push(...abaixo.map(c => c.text));

    const linhaInteira = celulas.filter(c =>
      c.page === lc.page &&
      Math.abs(c.y - lc.y) < 3.5 &&
      c.x > lc.x &&
      !ehLabel(c.text) && !ehRuido(c.text)
    ).sort((a, b) => a.x - b.x);
    candidatos.push(...linhaInteira.map(c => c.text));

    for (const raw of candidatos) {
      const v = cleanValue(raw);
      if (!v) continue;
      if (ehRuido(v)) continue;
      if (typeof validador === 'function' && !validador(v)) continue;
      return v;
    }

    return '';
  }

  /* =====================================================================
     EXTRATORES POR REGEX
     ===================================================================== */
  function extrairNumeroDFDDoTexto(texto) {
    if (!texto) return '';
    const padroes = [
      /\bDFD[\s\-–—:]*n?[º°]?\s*(\d{1,6})\s*[\/\-–—\s]\s*(?:de\s+)?(\d{2,4})\b/i,
      /\bDFD[\s\-–—_]*(\d{1,6})\s*[\/\-–—_]\s*(\d{2,4})\b/i,
      /(?:N[º°]?\s*DO\s+DFD|NÚMERO\s+DO\s+DFD|NUMERO\s+DO\s+DFD)[^\d]{0,30}(\d{1,6})\s*[\/\-–—_]\s*(\d{2,4})/i,
      /Expediente[^\d]{0,30}(\d{1,6})\s*[\/\-–—_]\s*(\d{2,4})/i,
    ];
    for (const rx of padroes) {
      const m = texto.match(rx);
      if (m) {
        const num = (m[1] || '').replace(/\D/g, '');
        const ano = (m[2] || '').replace(/\D/g, '');
        if (!num) continue;
        const val = ano ? `${num}/${ano}` : num;
        if (validaNumeroDFD(val)) return val;
      }
    }
    return '';
  }

  function extrairPcaItemDoTexto(texto) {
    if (!texto) return '';
    const padroes = [
      /\b(PCA[\s\-–—_\/]+\d{4}[\s\-–—_\/]+ITE?M[\s\-–—_\/]+\d{1,6})\b/i,
      /\bPCA\s+(\d{4})\s+ITE?M\s+(\d{1,6})\b/i,
      /\bITE?M\s+(\d{1,6})[\s\-–—]*(?:DO\s+|DA\s+)?PCA(?:\s+(\d{4}))?/i,
      /\b(PCA[\s\-–—_\/]+\d{4}[\s\-–—_\/]+\d{1,6})\b/i,
      /\bPCA\s*[:\-–—]\s*([\w\-–—_\/]{6,30})/i,
    ];
    for (const rx of padroes) {
      const m = texto.match(rx);
      if (m) {
        let val;
        if (m.length > 2 && m[2]) {
          val = [m[1], m[2], m[3], m[4]].filter(Boolean).join('-');
        } else {
          val = m[0];
        }
        val = cleanValue(val)
          .replace(/[\s_]+/g, '-')
          .replace(/[\/]+/g, '-')
          .replace(/-{2,}/g, '-')
          .toUpperCase();
        if (validaPcaItem(val)) return val;
      }
    }
    return '';
  }

  /**
   * ✅ v6.4: extrai objeto + aplica isolarObjeto() como pós-corte
   */
  function extrairObjetoDoTexto(texto) {
    if (!texto) return '';

    /* Labels sinônimos */
    const LABELS = [
      'Descri[çc][ãa]o\\s+Resumida\\s+do\\s+Objeto',
      'Objeto\\s+da\\s+Contrata[çc][ãa]o',
      'Objeto\\s+da\\s+Demanda',
      'Objeto\\s+da\\s+Necessidade',
      'Objeto\\s+da\\s+Aquisi[çc][ãa]o',
      'Objeto\\s+do\\s+Contrato',
      'Descri[çc][ãa]o\\s+do\\s+Objeto',
      'Especifica[çc][ãa]o\\s+do\\s+Objeto',
      'Objeto',
    ];

    /* Stops PLURAL-AWARE — depois do label, para onde parar */
    const STOPS = [
      'Estimativas?\\s+de\\s+Quantidades?(?:\\s+Estimadas?)?',
      'Quantitativos?(?:\\s+Estimados?)?',
      'Quantidades?(?:\\s+Estimadas?)?',
      'Especifica[çc][ãa]o\\s+de\\s+Quantidades?',
      'Mem[óo]ria\\s+de\\s+C[áa]lculo',
      'Itens?\\s+da\\s+Contrata[çc][ãa]o',
      'Listas?\\s+de\\s+Itens',
      'Rela[çc][ãa]o\\s+de\\s+Itens',
      'N[º°]?\\s+de\\s+Itens',
      'Justificativas?(?:\\s+(?:da\\s+)?(?:Necessidades?|Demandas?|Contrata[çc][ãa]o))?',
      'Fundamenta[çc][ãa]o',
      'Motiva[çc][ãa]o',
      'Raz[ãa]o\\s+da\\s+Necessidades?',
      'Valor(?:es)?\\s+(?:Total\\s+)?Estimados?',
      'Valores?',
      'Modalidades?(?:\\s+(?:Pretendidas?|de\\s+Licita[çc][ãa]o))?',
      'Crit[ée]rios?\\s+de\\s+Julgamentos?',
      'Naturezas?\\s+do\\s+Objeto',
      'Prazos?(?:\\s+(?:de\\s+(?:Execu[çc][ãa]o|Entregas?)|Contratuais?))?',
      'Locais?(?:\\s+(?:de\\s+Entregas?|da\\s+Presta[çc][ãa]o))?',
      'Condi[çc][õo]es\\s+de\\s+Pagamentos?',
      'Formas?\\s+de\\s+Pagamentos?',
      'Data\\s+(?:de\\s+Elabora[çc][ãa]o|da\\s+Formaliza[çc][ãa]o)',
      'Processos?(?:\\s+Administrativos?)?',
      'Respons[áa]veis?',
      'Fiscais?',
      'Gestores?',
      'Dota[çc][õo]es?(?:\\s+Or[çc]ament[áa]rias?)?',
      'Fontes?\\s+de\\s+Recursos?',
      'Itens?\\s+do\\s+PCA',
      'Alinhamentos?(?:\\s+ao\\s+PCA)?',
      'PCA',
      'Enquadramentos?',
      'Benef[íi]cios',
      'Resultados?\\s+Pretendidos?',
      'Provid[êe]ncias?',
    ];

    const LABEL_RX = '(?:' + LABELS.join('|') + ')';
    const STOP_RX  = '(?:' + STOPS.join('|') + ')(?=\\s|[:\\-–—]|$|\\n)';

    /* Padrão 1: label + valor na mesma linha */
    const rxMesmaLinha = new RegExp(
      LABEL_RX + '\\s*[:\\-–—]?\\s*([^\\n]{8,300}?)(?=' + STOP_RX + '|\\n|$)',
      'i'
    );
    let m = texto.match(rxMesmaLinha);
    if (m) {
      const v = isolarObjeto(cleanValue(m[1]));
      if (v && validaObjeto(v)) return v;
    }

    /* Padrão 2: label sozinho, valor na linha seguinte */
    const rxProximaLinha = new RegExp(
      LABEL_RX + '\\s*[:\\-–—]?\\s*[\\n\\r]+\\s*([^\\n]{8,300}?)(?=' + STOP_RX + '|\\n|$)',
      'i'
    );
    m = texto.match(rxProximaLinha);
    if (m) {
      const v = isolarObjeto(cleanValue(m[1]));
      if (v && validaObjeto(v)) return v;
    }

    /* Padrão 3: bloco multilinha até próximo stop */
    const rxGreedy = new RegExp(
      LABEL_RX + '\\s*[:\\-–—]?\\s*([\\s\\S]{8,600}?)(?=' + STOP_RX + ')',
      'i'
    );
    m = texto.match(rxGreedy);
    if (m) {
      const v = isolarObjeto(cleanValue(m[1]));
      if (v && validaObjeto(v)) return v;
    }

    return '';
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
        items.push({
          str: s,
          x: item.transform[4], y: item.transform[5],
          w: item.width || 0, h: item.height || 0
        });
      });
      paginas.push({ pageNum: i, items });
    }

    const celulas = construirCelulas(paginas);

    /* Texto para regex */
    const textoCompleto = paginas
      .flatMap(p => p.items.map(i => i.str))
      .join('\n');
    const textoLimpo = sanitizarTextoCompleto(textoCompleto);

    /* ============ REGEX PRIMEIRO, LABEL DEPOIS ============ */
    const numeroDFD =
      extrairNumeroDFDDoTexto(textoLimpo) ||
      extrairCampoValidado(celulas,
        ['Nº do DFD','Número do DFD','Nº do Expediente','Expediente','DFD'],
        validaNumeroDFD);

    const pcaItem =
      extrairPcaItemDoTexto(textoLimpo) ||
      extrairCampoValidado(celulas,
        ['Item / Código do PCA','Item do PCA','Código do PCA','Código no PCA','Nº do Item no PCA'],
        validaPcaItem);

    /* ✅ v6.4: Objeto com isolarObjeto aplicado em qualquer via */
    let objeto =
      extrairObjetoDoTexto(textoLimpo) ||
      extrairCampoValidado(celulas,
        [
          'Descrição Resumida do Objeto',
          'Objeto da Contratação',
          'Objeto da Demanda',
          'Objeto da Necessidade',
          'Objeto da Aquisição',
          'Objeto do Contrato',
          'Descrição do Objeto',
          'Especificação do Objeto',
          'Objeto',
        ],
        validaObjeto);

    /* Belt-and-suspenders: se veio da label e ainda tem resíduo, corta */
    if (objeto) objeto = isolarObjeto(objeto);
    if (objeto && !validaObjeto(objeto)) objeto = '';

    const campos = {
      orgao:       extrairCampoValidado(celulas, ['Órgão / Entidade','Órgão Entidade','Órgão','Entidade']),
      uasg:        extrairCampoValidado(celulas, ['UASG / Código','UASG','Código UASG']),
      unidade:     extrairCampoValidado(celulas, ['Unidade Requisitante','Unidade Demandante','Setor Requisitante','Setor Demandante','Unidade / Setor','Unidade','Setor']),
      responsavel: extrairCampoValidado(celulas, ['Responsável pela Demanda','Responsável Técnico','Responsável pela Elaboração','Responsável','Solicitante','Elaborador'], validaNome),
      cargo:       extrairCampoValidado(celulas, ['Cargo / Função','Cargo/Função','Cargo e Função','Cargo','Função']),
      processo:    extrairCampoValidado(celulas, ['Processo Administrativo','Nº do Processo','Processo']),

      data: (() => {
        const m = textoLimpo.match(
          /(?:Data\s+(?:de\s+Elabora[çc][ãa]o|da\s+Formaliza[çc][ãa]o|do\s+DFD)|Data)[^\d]{0,20}(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i
        );
        const regexVal = m ? cleanValue(m[1]) : '';
        return (validaData(regexVal) ? regexVal : '') ||
               extrairCampoValidado(celulas,
                 ['Data de Elaboração','Data da Formalização','Data do DFD','Data'],
                 validaData);
      })(),

      numero: numeroDFD,
      pcaItem: pcaItem,
      objeto: objeto,

      justificativa: extrairCampoValidado(celulas, ['Justificativa da Necessidade Pública','Justificativa da Necessidade','Justificativa da Demanda','Justificativa'], v => v.length >= 20),
      pcaPrevisto: extrairCampoValidado(celulas, ['Demanda prevista no PCA','Previsão no PCA']),
      dotacao:      extrairCampoValidado(celulas, ['Dotação Orçamentária','Dotação','Rubrica']),
      fonteRecurso: extrairCampoValidado(celulas, ['Fonte de Recurso','Fonte']),
      modalidade:   extrairCampoValidado(celulas, ['Modalidade Pretendida','Modalidade de Licitação','Modalidade']),
      criterio:     extrairCampoValidado(celulas, ['Critério de Julgamento','Tipo de Julgamento','Critério']),
      prazoExecucao:      extrairCampoValidado(celulas, ['Prazo de Execução','Prazo de Entrega','Prazo']),
      localEntrega:       extrairCampoValidado(celulas, ['Local de Entrega','Local']),
      condicoesPagamento: extrairCampoValidado(celulas, ['Condições de Pagamento','Forma de Pagamento']),
      fiscalTitular:    extrairCampoValidado(celulas, ['Fiscal Titular do Contrato','Fiscal Titular','Fiscal'], validaNome),
      fiscalSubstituto: extrairCampoValidado(celulas, ['Fiscal Substituto']),
      gestorContrato:   extrairCampoValidado(celulas, ['Gestor do Contrato','Gestor']),
      qtdDescricao: extrairCampoValidado(celulas, ['Estimativa de Quantidades','Quantidade Estimada','Quantitativo','Quantidades'], v => /\d/.test(v)),
      valor: normalizarMoeda(extrairCampoValidado(
        celulas,
        ['Valor Estimado da Contratação','Valor Total Estimado','Valor Estimado','Valor Global','Valor'],
        validaValor
      ))
    };

    /* Fallbacks no texto limpo */
    if (!campos.email) {
      const emailM = textoLimpo.match(/([\w._%+\-]+@[\w.\-]+\.[A-Za-z]{2,})/);
      if (emailM) campos.email = cleanValue(emailM[1]);
    }
    if (!campos.telefone) {
      const telM = textoLimpo.match(/(?:Telefone|Tel|Fone|Ramal)\s*[:\-–—]?\s*(\(?\d{2}\)?\s*[\s\-]?\d{4,5}[\s\-]?\d{4})/i);
      if (telM) campos.telefone = cleanValue(telM[1]);
    }
    if (!campos.modalidade) {
      const m = textoLimpo.match(/\b(Preg[ãa]o\s+Eletr[ôo]nico|Concorr[êe]ncia\s+Eletr[ôo]nica|Dispensa\s+Eletr[ôo]nica|Inexigibilidade|Leil[ãa]o|Di[áa]logo\s+Competitivo)\b/i);
      if (m) campos.modalidade = cleanValue(m[1]);
    }
    if (!campos.criterio) {
      const m = textoLimpo.match(/\b(Menor\s+Pre[çc]o|Maior\s+Desconto|Melhor\s+T[ée]cnica|T[ée]cnica\s+e\s+Pre[çc]o|Maior\s+Lance|Maior\s+Retorno\s+Econ[ôo]mico)\b/i);
      if (m) campos.criterio = cleanValue(m[1]);
    }
    if (!campos.valor) {
      const m = textoLimpo.match(/R\$\s*([\d]{1,3}(?:[.\s]\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{2})?)/);
      if (m) campos.valor = normalizarMoeda(m[1]);
    }

    /* Sanitização final */
    Object.keys(campos).forEach(k => {
      if (typeof campos[k] === 'string') {
        campos[k] = cleanValue(campos[k]);
        if (ehRuido(campos[k])) campos[k] = '';
      }
    });

    return { origem: 'pdf', campos, raw: textoLimpo };
  }

  /* =====================================================================
     8. ROTEADOR
     ===================================================================== */
  async function parse(file) {
    const nome = (file?.name || '').toLowerCase();
    const tipo = (file?.type || '').toLowerCase();
    if (nome.endsWith('.json') || tipo.includes('json')) return fromJSON(file);
    if (nome.endsWith('.pdf')  || tipo.includes('pdf'))  return fromPDF(file);
    throw new Error('Formato não suportado. Envie PDF ou JSON.');
  }

  return {
    parse, fromJSON, fromPDF,
    cleanValue, normalizarMoeda,
    ehRuido, sanitizarTextoCompleto,
    validaNumeroDFD, validaPcaItem, validaData,
    validaObjeto, validaNome, validaValor,
    extrairNumeroDFDDoTexto, extrairPcaItemDoTexto,
    extrairObjetoDoTexto, isolarObjeto
  };
})();

window.DFDParser = DFDParser;
