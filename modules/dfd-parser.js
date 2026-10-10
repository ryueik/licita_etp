/* =====================================================================
   OMNILICIT · LicitaETP · DFD Parser Universal v6.0
   ---------------------------------------------------------------------
   ✅ Sanitização de rodapé (Emitido em, SHA-256, TAGs, paginação)
   ✅ Filtro ehRuido() em todos os valores extraídos
   ✅ Validadores específicos por campo
   ✅ Mapeamento correto para os 11 incisos do ETP
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
    /* ✅ Ruídos extras */
    'emitido em','gerado em','documento gerado','pagina','page',
    'assinatura','carimbo','data de emissao','hash','tag','sha 256'
  ]);

  /* =====================================================================
     2. DETECÇÃO DE RUÍDO (rodapé, hash, timestamps, tags)
     ===================================================================== */
  function ehRuido(texto) {
    if (texto == null) return true;
    const s = String(texto).trim();
    if (!s) return true;
    if (s.length < 2) return true;

    /* E-mail completo */
    if (/^[\w._%+\-]+@[\w.\-]+\.[A-Za-z]{2,}$/.test(s)) return true;

    /* Timestamp completo dd/mm/yyyy hh:mm:ss */
    if (/\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}(:\d{2})?/.test(s)) return true;

    /* "Emitido em", "Gerado em", "Documento gerado" */
    if (/^(emitido|gerado|documento\s+gerado|documento\s+emitido)\s+(em|por)\b/i.test(s)) return true;

    /* SHA-256 (64 caracteres hexadecimais seguidos) */
    if (/\b[A-F0-9]{64}\b/i.test(s)) return true;

    /* Tag OmniLicit */
    if (/OMNILICIT\s*::/i.test(s)) return true;

    /* URL */
    if (/^https?:\/\//i.test(s)) return true;

    /* Paginação "Página X de Y" ou "X de Y" sozinho */
    if (/^(P[áa]gina|Page)\s+\d+\s*(de|of|\/)\s*\d+/i.test(s)) return true;
    if (/^\d+\s*(de|\/)\s*\d+$/.test(s)) return true;

    /* Marcadores de linha (-----------, =====, ••••) */
    if (/^[-=_•·●▪►◆]{3,}$/.test(s)) return true;

    /* Só números e pontos/barra (provável número de página) */
    if (/^[\d\s\.\-\/]+$/.test(s) && s.length < 6) return true;

    /* Emoji ou símbolo solto */
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
     3. SANITIZAÇÃO DO TEXTO COMPLETO (antes do parse)
     ===================================================================== */
  function sanitizarTextoCompleto(txt) {
    if (!txt) return '';
    let t = String(txt);

    /* Remove linhas de rodapé típicas */
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

    /* Marcadores "[[PAGINA_X_DE_Y]]" */
    t = t.replace(/\[\[PAGINA_\d+_DE_\d+\]\]/gi, '');

    /* Linhas horizontais */
    t = t.replace(/^[-=_]{3,}\s*$/gm, '');

    /* Reduz múltiplos \n consecutivos */
    t = t.replace(/\n{3,}/g, '\n\n');

    return t.trim();
  }

  /* =====================================================================
     4. CLEAN VALUE (chamado após extração)
     ===================================================================== */
  const cleanValue = text => {
    if (text == null) return '';
    let v = String(text).replace(/\r/g, '\n').replace(/\n+/g, ' ')
                        .replace(/\t/g, ' ').replace(/\s{2,}/g, ' ');

    /* Remove fragmentos de paginação */
    v = v.replace(/\b(?:P[áa]gina|Page)\s+\d+\s*(?:de|of|\/)\s*\d+\b/gi, ' ');
    v = v.replace(/^\s*\d+\s*(?:de|\/)\s*\d+\s*$/gm, ' ');

    /* Remove lixo de borda */
    v = v.replace(/^[\s:;\-–—_\/|>»•·●◦‣▪►]+/, '');
    v = v.replace(/[\s:;\-–—_\/|]+$/, '');

    /* Remove fragmentos residuais de rótulos */
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

    /* Filtro final */
    if (ehLabel(v) || ehRuido(v)) return '';
    return v;
  };

  /* =====================================================================
     5. MOEDA E VALIDAÇÕES ESPECÍFICAS
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

  /* Objeto: pelo menos 15 chars, não pode ser timestamp/data */
  const validaObjeto = v => {
    if (!v || v.length < 10) return false;
    if (ehRuido(v)) return false;
    // Se é apenas número/data, rejeita
    if (/^\s*[\d\/\-\.:\s]+\s*$/.test(v)) return false;
    // Se contém "Emitido em", "Página", etc.
    if (/\b(emitido|gerado|p[áa]gina|page|sha-?256|omnilicit)\b/i.test(v)) return false;
    return true;
  };

  /* Nome próprio: 2+ palavras, capitalizado, sem números */
  const validaNome = v => {
    if (!v || v.length < 4) return false;
    if (/^\d/.test(v)) return false;
    if (/[0-9]{4,}/.test(v)) return false;
    if (ehRuido(v)) return false;
    const partes = v.split(/\s+/).filter(Boolean);
    return partes.length >= 2;
  };

  /* Valor: contém dígito, não contém palavras longas (evita "Emitido em") */
  const validaValor = v => {
    if (!v) return false;
    if (!/\d/.test(v)) return false;
    // Se tem 2+ palavras alfabéticas de 5+ letras, provavelmente é texto
    const palavrasLongas = (v.match(/\b[a-zá-ú]{5,}\b/gi) || []).length;
    if (palavrasLongas >= 2) return false;
    return true;
  };

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
     7. PARSER DE PDF (posicional + textual)
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

  function extrairValorDeLabel(celulas, labelCel) {
    if (!labelCel) return '';

    /* 1) Tenta pegar o texto à DIREITA (mesma linha) */
    const direita = celulas.filter(c =>
      c.page === labelCel.page &&
      Math.abs(c.y - labelCel.y) < 3.5 &&
      c.x > labelCel.x + labelCel.w - 2 &&
      !ehLabel(c.text) &&
      !ehRuido(c.text)
    ).sort((a, b) => a.x - b.x);
    if (direita.length) {
      const v = cleanValue(direita[0].text);
      if (v) return v;
    }

    /* 2) Tenta pegar o texto ABAIXO (mesma coluna) */
    const x0 = labelCel.x - 15;
    const x1 = labelCel.x + Math.max(280, labelCel.w + 260);
    const abaixo = celulas.filter(c =>
      c.page === labelCel.page &&
      c.y < labelCel.y - 3 && c.y > labelCel.y - 90 &&
      c.x >= x0 && c.x <= x1 &&
      !ehLabel(c.text) &&
      !ehRuido(c.text)
    ).sort((a, b) => (b.y - a.y) || (a.x - b.x));

    for (const c of abaixo) {
      const v = cleanValue(c.text);
      if (v) return v;
    }

    return '';
  }

  function extrairCampoValidado(celulas, rotulos, validador) {
    const lc = buscarLabel(celulas, rotulos);
    const raw = extrairValorDeLabel(celulas, lc);
    if (!raw) return '';
    if (ehRuido(raw)) return '';
    if (typeof validador === 'function' && !validador(raw)) return '';
    return raw;
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

    /* ============ EXTRAÇÃO COM VALIDADORES ESPECÍFICOS ============ */
    const campos = {
      /* -------- Cabeçalho institucional -------- */
      orgao:       extrairCampoValidado(celulas, ['Órgão / Entidade','Órgão Entidade','Órgão','Entidade']),
      uasg:        extrairCampoValidado(celulas, ['UASG / Código','UASG','Código UASG']),
      unidade:     extrairCampoValidado(celulas, ['Unidade Requisitante','Unidade Demandante','Setor Requisitante','Setor Demandante','Unidade / Setor','Unidade','Setor']),
      responsavel: extrairCampoValidado(celulas, ['Responsável pela Demanda','Responsável Técnico','Responsável pela Elaboração','Responsável','Solicitante','Elaborador'], validaNome),
      cargo:       extrairCampoValidado(celulas, ['Cargo / Função','Cargo/Função','Cargo e Função','Cargo','Função']),
      processo:    extrairCampoValidado(celulas, ['Processo Administrativo','Nº do Processo','Processo']),
      data:        extrairCampoValidado(celulas, ['Data de Elaboração','Data']),

      /* -------- Objeto e Justificativa (Incisos I e II) -------- */
      objeto:        extrairCampoValidado(celulas, ['Objeto da Contratação','Objeto da Demanda','Descrição Resumida do Objeto','Descrição do Objeto','Objeto'], validaObjeto),
      justificativa: extrairCampoValidado(celulas, ['Justificativa da Necessidade Pública','Justificativa da Necessidade','Justificativa da Demanda','Justificativa'], v => v.length >= 20),

      /* -------- PCA (Inciso II) -------- */
      pcaItem:     extrairCampoValidado(celulas, ['Item / Código do PCA','Item do PCA','Código do PCA','PCA']),
      pcaPrevisto: extrairCampoValidado(celulas, ['Demanda prevista no PCA','Previsão no PCA','PCA']),

      /* -------- Enquadramento (Inciso II) -------- */
      dotacao:      extrairCampoValidado(celulas, ['Dotação Orçamentária','Dotação','Rubrica']),
      fonteRecurso: extrairCampoValidado(celulas, ['Fonte de Recurso','Fonte']),
      modalidade:   extrairCampoValidado(celulas, ['Modalidade Pretendida','Modalidade de Licitação','Modalidade']),
      criterio:     extrairCampoValidado(celulas, ['Critério de Julgamento','Tipo de Julgamento','Critério']),

      /* -------- Prazos e entrega (Inciso VII) -------- */
      prazoExecucao:      extrairCampoValidado(celulas, ['Prazo de Execução','Prazo de Entrega','Prazo']),
      localEntrega:       extrairCampoValidado(celulas, ['Local de Entrega','Local']),
      condicoesPagamento: extrairCampoValidado(celulas, ['Condições de Pagamento','Forma de Pagamento']),

      /* -------- Governança (Etapa 12) -------- */
      fiscalTitular:    extrairCampoValidado(celulas, ['Fiscal Titular do Contrato','Fiscal Titular','Fiscal'], validaNome),
      fiscalSubstituto: extrairCampoValidado(celulas, ['Fiscal Substituto']),
      gestorContrato:   extrairCampoValidado(celulas, ['Gestor do Contrato','Gestor']),

      /* -------- Quantitativo (Inciso IV) -------- */
      qtdDescricao: extrairCampoValidado(celulas, ['Estimativa de Quantidades','Quantidade Estimada','Quantitativo'], v => /\d/.test(v)),

      /* -------- Valor (Inciso VI) -------- */
      numero: extrairCampoValidado(celulas, ['Nº do DFD','Número do DFD','DFD']),
      valor:  normalizarMoeda(extrairCampoValidado(
        celulas,
        ['Valor Estimado da Contratação','Valor Total Estimado','Valor Estimado','Valor Global','Valor'],
        validaValor
      ))
    };

    /* ============ FALLBACKS POR REGEX NO TEXTO PLANO ============ */
    const textoCompleto = paginas
      .flatMap(p => p.items.map(i => i.str))
      .join(' ');

    const textoLimpo = sanitizarTextoCompleto(textoCompleto);

    /* E-mail */
    if (!campos.email) {
      const emailM = textoLimpo.match(/([\w._%+\-]+@[\w.\-]+\.[A-Za-z]{2,})/);
      if (emailM) campos.email = cleanValue(emailM[1]);
    }

    /* Telefone */
    if (!campos.telefone) {
      const telM = textoLimpo.match(/(?:Telefone|Tel|Fone|Ramal)\s*[:\-–—]?\s*(\(?\d{2}\)?\s*[\s\-]?\d{4,5}[\s\-]?\d{4})/i);
      if (telM) campos.telefone = cleanValue(telM[1]);
    }

    /* Modalidade */
    if (!campos.modalidade) {
      const m = textoLimpo.match(/\b(Preg[ãa]o\s+Eletr[ôo]nico|Concorr[êe]ncia\s+Eletr[ôo]nica|Dispensa\s+Eletr[ôo]nica|Inexigibilidade|Leil[ãa]o|Di[áa]logo\s+Competitivo)\b/i);
      if (m) campos.modalidade = cleanValue(m[1]);
    }

    /* Critério */
    if (!campos.criterio) {
      const m = textoLimpo.match(/\b(Menor\s+Pre[çc]o|Maior\s+Desconto|Melhor\s+T[ée]cnica|T[ée]cnica\s+e\s+Pre[çc]o|Maior\s+Lance|Maior\s+Retorno\s+Econ[ôo]mico)\b/i);
      if (m) campos.criterio = cleanValue(m[1]);
    }

    /* Valor (fallback) */
    if (!campos.valor) {
      const m = textoLimpo.match(/R\$\s*([\d]{1,3}(?:[.\s]\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{2})?)/);
      if (m) campos.valor = normalizarMoeda(m[1]);
    }

    /* Remove campos vazios/quebrados por segurança */
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
    ehRuido, sanitizarTextoCompleto
  };
})();

window.DFDParser = DFDParser;
