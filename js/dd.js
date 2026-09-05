/**
 * dd.js — Due Diligence (recurso beta).
 * Duas telas: LISTA de verificações (fichas) e o DETALHE de um caso.
 *   dd.html            → lista de fichas
 *   dd.html?id=<uuid>  → detalhe do caso (igual ao mockup aprovado)
 *
 * Etapa A: lê do banco (dd_dossies / dd_partes / dd_certidoes) e mostra.
 * Etapa B: leitura da matrícula pela IA + conferência + montador do caso.
 * Etapa C (atual): anexo do PDF no cofre (Storage `dd-certidoes`) + leitura e
 *   classificação pela IA (Edge Function dd-ler-certidao) + correção manual.
 * Etapa D (a fazer): emissão automática (Infosimples/SERPRO) — Manual × Automático.
 */
(function () {
  'use strict';

  // ─── Cardápio de certidões ────────────────────────────────────────────────
  // A regra de "montar o dossiê" (Etapa B) usa esta lista: dado o imóvel + as
  // partes + o regime de casamento, o sistema cria as linhas certas.
  // fase: captacao (gratuitas) | venda (entram na venda — algumas pagas).
  window.DD_CATALOGO = {
    imovel: [
      { chave:'duc',              nome:'Certidão de Tributos Imobiliários (IPTU)', descricao:'Débitos de IPTU do imóvel · exige login Senha Web', metodo:'voce', fase:'captacao', pago:false },
      { chave:'cedi',             nome:'Regularidade do imóvel (edificação)',      descricao:'Histórico de edificação · Prefeitura SP',  metodo:'voce', fase:'captacao', pago:false, somenteCasa:true },
      { chave:'iptu_notificacao', nome:'Notificação de lançamento de IPTU',        descricao:'Cadastro do imóvel · exige login Senha Web', metodo:'voce', fase:'captacao', pago:false },
      { chave:'matricula_onus',   nome:'Matrícula atualizada + ônus (cartório)',   descricao:'Certidão digital · emolumento oficial (ONR)', metodo:'voce', fase:'venda', pago:true },
    ],
    // Pessoa física — as 8 certidões da lista do Dr. Wilton (PROCESSO_E_CERTIDOES §2).
    pessoa: [
      { chave:'protestos',        nome:'Consulta de protestos (CENPROT-SP)',       descricao:'Existência de protesto · consulta gratuita', metodo:'voce', fase:'captacao', pago:false },
      { chave:'pje',              nome:'Trabalhista — PJe (TRT-2)',                descricao:'Ações trabalhistas eletrônicas · tem captcha', metodo:'voce', fase:'captacao', pago:false },
      { chave:'trt2_fisico',      nome:'Trabalhista — processos físicos (TRT-2)',  descricao:'Processos antigos · tem captcha',           metodo:'voce', fase:'captacao', pago:false },
      { chave:'cndt',             nome:'Trabalhista — CNDT (TST)',                 descricao:'Débitos trabalhistas nacionais · tem captcha', metodo:'voce', fase:'captacao', pago:false },
      { chave:'civel_tjsp',       nome:'Cível — distribuição (TJSP / e-SAJ)',      descricao:'Ações cíveis no estado de SP',              metodo:'voce', fase:'captacao', pago:false },
      { chave:'certidoes_tjsp',   nome:'Certidões do TJSP (gov.br)',               descricao:'Interdições, falência, execuções fiscais · login gov.br', metodo:'voce', fase:'captacao', pago:false },
      { chave:'trf3',             nome:'Justiça Federal (TRF3) — distribuição',    descricao:'Cível, criminal e execução fiscal',        metodo:'voce', fase:'captacao', pago:false },
      { chave:'cnd_federal_cpf',  nome:'CND Federal — Receita/PGFN (CPF)',         descricao:'Débitos federais da pessoa · tem captcha', metodo:'voce', fase:'captacao', pago:false },
    ],
    // Empresa (PJ) — versão CNPJ das aplicáveis + as próprias de PJ.
    // Conjunto ainda a validar com o Dr. Wilton (pode ganhar FGTS/CRF, falência etc.).
    empresa: [
      { chave:'protestos_cnpj',   nome:'Consulta de protestos (CNPJ)',             descricao:'Existência de protesto · consulta gratuita', metodo:'voce', fase:'captacao', pago:false },
      { chave:'pje',              nome:'Trabalhista — PJe (TRT-2)',                descricao:'Ações trabalhistas eletrônicas · tem captcha', metodo:'voce', fase:'captacao', pago:false },
      { chave:'cndt',             nome:'Trabalhista — CNDT (TST)',                 descricao:'Débitos trabalhistas nacionais · tem captcha', metodo:'voce', fase:'captacao', pago:false },
      { chave:'civel_tjsp',       nome:'Cível — distribuição (TJSP / e-SAJ)',      descricao:'Ações cíveis da empresa em SP',             metodo:'voce', fase:'captacao', pago:false },
      { chave:'trf3',             nome:'Justiça Federal (TRF3) — distribuição',    descricao:'Cível, criminal e execução fiscal',        metodo:'voce', fase:'captacao', pago:false },
      { chave:'cartao_cnpj',      nome:'Cartão CNPJ (situação cadastral)',         descricao:'Receita Federal · tem captcha',             metodo:'voce', fase:'captacao', pago:false },
      { chave:'cnd_federal_cnpj', nome:'CND Federal — Receita/PGFN (CNPJ)',        descricao:'Débitos federais da empresa · tem captcha', metodo:'voce', fase:'captacao', pago:false },
    ],
  };

  // Regimes que exigem tirar certidões do cônjuge também (ver PROCESSO_E_CERTIDOES §4).
  window.DD_REGIME_INCLUI_CONJUGE = {
    comunhao_parcial:true, comunhao_universal:true, separacao_obrigatoria:true,
    uniao_estavel:true, separacao_convencional:false,
  };

  // ─── Emissão automática pela Infosimples (Etapa D1) ───────────────────────
  // Cópia LEVE por chave (a AUTORIDADE dos parâmetros reais é a Edge Function
  // dd-emitir-certidao — ver risco §6.2 da arquitetura). O front usa isto só pra:
  // mostrar o selo/botão "Automático", exibir o custo estimado e validar dado faltando.
  //   custo: aproximado (o valor real vem do header.price da resposta).
  //   requer: campos da PESSOA obrigatórios pra aquela consulta (travam a emissão, nunca a conferência).
  //   assincrono: TJSP pedido-certidao (pode não sair na hora → "aguardando").
  //   govbr: exige login gov.br (fica fora da emissão em lote).
  window.DD_INFOSIMPLES = {
    cndt:            { auto:true, custo:0.24 },
    pje:             { auto:true, custo:0.24 },
    trt2_fisico:     { auto:true, custo:0.24, requer:['nome'] },
    cartao_cnpj:     { auto:true, custo:0.24 },
    cnd_federal_cpf: { auto:true, custo:0.26, requer:['data_nascimento'] },
    protestos:       { auto:true, custo:0.26 },
    protestos_cnpj:  { auto:true, custo:0.26 },
    certidoes_tjsp:  { auto:true, custo:0.24, requer:['rg','sexo'], assincrono:true },
    civel_tjsp:      { auto:true, custo:0.24, govbr:true },
  };
  // Marca o bloco no cardápio também (pra preview/coerência), sem duplicar a fonte.
  [].concat(DD_CATALOGO.imovel, DD_CATALOGO.pessoa, DD_CATALOGO.empresa).forEach((c) => {
    if (DD_INFOSIMPLES[c.chave]) c.infosimples = DD_INFOSIMPLES[c.chave];
  });

  // ─── Ícones (padrão do sistema: stroke, currentColor) ─────────────────────
  const I = {
    check:  '<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    alert:  '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>',
    lock:   '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V6a3 3 0 016 0v5M7 11h10v9H7z"/></svg>',
    atom:   '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 00-3 3 3 3 0 00-3 3 3 3 0 000 6 3 3 0 003 3 3 3 0 006 0 3 3 0 003-3 3 3 0 000-6 3 3 0 00-3-3 3 3 0 00-3-3z"/></svg>',
    robot:  '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V4M15 7V4" stroke-linecap="round"/></svg>',
    lockSm: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V6a3 3 0 016 0v5M7 11h10v9H7z"/></svg>',
    file:   '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>',
    home:   '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>',
    user:   '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>',
    build:  '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V8h14v13M9 12h2M13 12h2M9 16h2M13 16h2"/></svg>',
    chev:   '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    back:   '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
    trash:  '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>',
    extlink:'<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.4 0 2.72.32 3.9.9"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
    x:      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    clock:  '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  const REGIME_LBL = {
    comunhao_parcial:'comunhão parcial', comunhao_universal:'comunhão universal',
    separacao_convencional:'separação convencional', separacao_obrigatoria:'separação obrigatória',
    uniao_estavel:'união estável',
  };
  const TIPO_LBL = { proprietario:'Proprietário', conjuge:'Cônjuge', empresa:'Empresa' };

  // ─── Estado do caso aberto (Etapa C) ──────────────────────────────────────
  // CTX guarda o caso na memória pra tela atualizar sem recarregar a página.
  let CTX = null;               // { dossie, partes, certs }
  const openIa = new Set();     // certidões com o painel "leitura" aberto (por id)
  const uploading = new Set();  // trava anti-duplo-clique no anexo/releitura
  const emitindo = new Set();   // trava anti-duplo-clique na emissão automática (por id) — CA-12
  const pendenciaAte = new Map(); // id da certidão → timestamp (ms) até quando o "tentar de novo" fica travado
  const COOLDOWN_PENDENCIA_MS = 3 * 60 * 1000; // após instabilidade do órgão, segura re-tentativa por 3 min
  let corrigindo = null;        // certidão com o "Corrigir classificação" aberto
  let ddModalAction = null;     // callback do "Confirmar" do modal de custo
  let ddModalEsc = null;        // handler de Esc do modal aberto

  const COFRE = 'dd-certidoes'; // bucket privado no Supabase Storage

  const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
  const findCert = (id) => (CTX ? CTX.certs.find(c => String(c.id) === String(id)) : null);
  const parteDe = (c) => (c && c.parte_id && CTX ? CTX.partes.find(p => p.id === c.parte_id) : null);
  const parseApts = (c) => {
    try { const a = typeof c.ia_apontamentos === 'string' ? JSON.parse(c.ia_apontamentos) : c.ia_apontamentos; return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  };
  function fmtDataHora(ts) {
    try { return new Date(ts).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
    catch (e) { return ''; }
  }
  function rerender() { if (CTX) renderDetalhe(CTX.dossie, CTX.partes, CTX.certs); }
  async function dbUpdateCert(sb, id, patch) {
    const { error } = await sb.from('dd_certidoes').update(patch).eq('id', id);
    if (error) throw error;
    const c = findCert(id); if (c) Object.assign(c, patch);
  }

  // ─── Emissão automática (Etapa D1) — helpers ──────────────────────────────
  const REQUER_LBL = { rg:'RG', sexo:'sexo', data_nascimento:'data de nascimento', nome:'nome completo' };
  const infoDe = (c) => (c && window.DD_INFOSIMPLES ? DD_INFOSIMPLES[c.chave] : null) || null;
  const custoBRL = (n) => 'R$ ' + Number(n || 0).toFixed(2).replace('.', ',');
  const iniciais = (nome) => (nome || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const optsSexo = (sel) => `<option value=""${!sel ? ' selected' : ''}>—</option>`
    + `<option value="F"${sel === 'F' ? ' selected' : ''}>Feminino</option>`
    + `<option value="M"${sel === 'M' ? ' selected' : ''}>Masculino</option>`;

  // Campos que a certidão exige e a parte não tem preenchido (trava a emissão, não a conferência).
  function faltaDados(c) {
    const info = infoDe(c);
    if (!info || !info.auto) return [];
    const p = parteDe(c);
    return (info.requer || []).filter(f => !String((p && p[f]) || '').trim());
  }
  // União dos campos faltando entre as certidões automáticas de uma pessoa (pro selo do mini-editor).
  function faltaDaPessoa(p) {
    if (!CTX || !p) return [];
    const need = new Set();
    CTX.certs.filter(c => c.parte_id === p.id).forEach(c => {
      const info = infoDe(c); if (!info || !info.auto) return;
      (info.requer || []).forEach(f => { if (!String(p[f] || '').trim()) need.add(f); });
    });
    return [...need];
  }
  // Certidões prontas pra emissão em lote (auto, ainda não emitidas, sem dado faltando, sem gov.br).
  function certsElegiveisLote() {
    if (!CTX) return [];
    return CTX.certs.filter(c => {
      const info = infoDe(c);
      if (!info || !info.auto) return false;
      if (!['em_aberto', 'pendencia'].includes(c.status)) return false;
      if (c.arquivo_path) return false;
      if (info.govbr) return false;
      if (faltaDados(c).length) return false;
      return true;
    });
  }
  // Auto ainda não emitidas que ficam FORA da leva (falta dado ou exige gov.br) — pro aviso do modal.
  function certsForaLote() {
    if (!CTX) return [];
    return CTX.certs.filter(c => {
      const info = infoDe(c);
      if (!info || !info.auto) return false;
      if (!['em_aberto', 'pendencia'].includes(c.status)) return false;
      if (c.arquivo_path) return false;
      return info.govbr || faltaDados(c).length > 0;
    });
  }

  // Conta resolvidas/apontamentos/aberto de um conjunto de certidões.
  function contar(certs) {
    const negativas = certs.filter(c => c.status === 'negativa').length;
    const apont = certs.filter(c => c.status === 'apontamento' || c.status === 'positiva').length;
    const total = certs.length;
    const resolvidas = negativas + apont;
    return { total, negativas, apont, resolvidas, aberto: total - resolvidas, pct: total ? Math.round(resolvidas/total*100) : 0 };
  }

  // ─── Classificação visual de cada certidão ────────────────────────────────
  function visual(c) {
    switch (c.status) {
      case 'negativa':   return { cls:'ok',   ic:I.check, cell:'<span class="badge badge-green">Negativa</span>' };
      case 'positiva':
      case 'apontamento': {
        const n = parseApts(c).length;
        const lbl = n ? `${n} apontamento${n > 1 ? 's' : ''}` : (c.status === 'positiva' ? 'Positiva' : 'Apontamento');
        return { cls:'pos', ic:I.alert, cell:`<span class="badge badge-red">${lbl}</span>` };
      }
      case 'duvida':     return { cls:'wait', ic:I.alert, cell:'<span class="badge badge-yellow">Você decide</span>' };
      case 'emitindo':   return { cls:'run',  ic:'<span class="spinner" style="width:18px;height:18px"></span>', cell:'<span class="st-line"><span class="spinner" style="width:11px;height:11px"></span> emitindo…</span>' };
      case 'recebida':
      case 'lendo':      return { cls:'run',  ic:'<span class="spinner" style="width:18px;height:18px"></span>', cell:'<span class="st-line" style="color:var(--info)"><span class="spinner" style="width:11px;height:11px"></span> no cofre · lendo com a IA…</span>' };
      case 'aguardando': return { cls:'wait', ic:I.clock, cell:'<span class="badge badge-gray">Aguardando</span>', emit:true };
      case 'verificando':return { cls:'run',  ic:'<span class="spinner" style="width:18px;height:18px"></span>', cell:'<span class="st-line"><span class="spinner" style="width:11px;height:11px"></span> verificando no TJSP…</span>', emit:true };
      case 'expirado':   return { cls:'pos',  ic:I.alert, cell:'<span class="badge badge-orange">Não saiu no prazo</span>', emit:true };
      case 'pendencia':  return { cls:'wait', ic:I.alert, cell:'<span class="badge badge-yellow">Instabilidade do órgão</span>', emit:true };
      default: { // em_aberto
        const info = infoDe(c);
        if (info && info.auto) {
          if (faltaDados(c).length) return { cls:'wait', ic:I.alert, cell:'<span class="badge badge-yellow">Falta um dado</span>', emit:true };
          // Automática pronta: painel abre direto (custo visível antes de qualquer clique).
          return { cls:'wait', ic:I.lock, cell:'<span class="badge badge-gray">Não emitida</span>', emit:true };
        }
        return { cls:'wait', ic:I.lock, cell:`<button class="btn btn-primary btn-sm" onclick="ddToggleEmit(this)">Emitir</button>`, emit:true };
      }
    }
  }

  const methodChip = (c) => {
    const info = infoDe(c);
    if (info && info.auto) return `<span class="method auto">${I.robot} Automático</span>`;
    return c.metodo === 'robo'
      ? `<span class="method robo">${I.robot} Robô</span>`
      : `<span class="method voce">${I.lockSm} Você resolve</span>`;
  };

  function arqCell(c) {
    // No cofre: abre por link temporário (assinado), gerado na hora do clique.
    if (c.arquivo_path) return `<div class="arq"><a title="${esc(c.arquivo_nome || 'Abrir PDF')}" href="#" onclick="event.preventDefault();ddAbrirArquivo('${c.id}')">${I.file}</a></div>`;
    if (c.arquivo_url) return `<div class="arq"><a title="${esc(c.arquivo_nome || '')}" href="${esc(c.arquivo_url)}" target="_blank" rel="noopener">${I.file}</a></div>`;
    if (c.arquivo_nome) return `<div class="arq"><span class="arq-file" title="${esc(c.arquivo_nome)}">${I.file}</span></div>`;
    return '<div class="arq"><span class="none">—</span></div>';
  }

  // Portal e-SAJ (1º grau) — página "Visualizar Certidão", onde o operador baixa DE GRAÇA a
  // certidão do TJSP quando ela fica pronta (ADR D-9). Verificar/baixar não custa nada.
  const ESAJ_VISUALIZAR = 'https://esaj.tjsp.jus.br/sco/abrirDownload.do';
  // Monta o link do e-SAJ com os dados do pedido por querystring (BEST-EFFORT: se o e-SAJ não
  // aceitar pré-preenchimento por URL, ele ignora os params e o operador usa os campos copiáveis).
  function montarUrlESaj(c, p) {
    const qs = new URLSearchParams();
    if (c.emissao_protocolo) qs.set('nuPedido', c.emissao_protocolo);
    if (c.emissao_data) qs.set('dtPedido', c.emissao_data);
    if (p && p.documento) qs.set('cpfCnpj', String(p.documento).replace(/\D/g, ''));
    const s = qs.toString();
    return s ? `${ESAJ_VISUALIZAR}?${s}` : ESAJ_VISUALIZAR;
  }

  // Caixa de anexo (arrastar/clicar o PDF) — reuso do fluxo "você-resolve" já testado.
  const dropzoneBloco = (c, label) => `<div class="dropzone" onclick="ddEscolher('${c.id}')" ondragover="event.preventDefault();this.classList.add('drag')" ondragleave="this.classList.remove('drag')" ondrop="ddCertDrop(event,'${c.id}')">
      ${I.upload}<div class="dt">${label || '2 · Arraste o PDF emitido aqui — ou clique pra escolher'}</div>
      <div class="dh">o sistema guarda no cofre, lê com a IA e classifica sozinho</div>
      <input type="file" accept="application/pdf" style="display:none" onclick="event.stopPropagation()" onchange="ddCertPick(this,'${c.id}')">
    </div>`;

  // Caminho MANUAL (abrir portal + arrastar PDF) — o "Você resolve" de sempre.
  // Continua disponível como alternativa mesmo nas certidões automáticas.
  function manualBloco(c) {
    const portal = c.portal_url || '';
    const p = parteDe(c);
    const doc = p && p.documento ? p.documento : '';
    const dado = p ? (p.tipo === 'empresa' ? 'CNPJ' : 'CPF') : '';
    const passo1 = !p
      ? 'Abre o portal da certidão. Informe o nº do <b style="color:var(--text)">contribuinte do IPTU</b> (está no carnê), resolva o acesso e emita — o PDF baixa na hora.'
      : /senha web|login/i.test(c.descricao || '')
        ? `Abre o portal da certidão. Você faz o login, cola o <b style="color:var(--text)">${dado}</b> e emite — o PDF baixa na hora.`
        : `Abre o portal da certidão. Cole o <b style="color:var(--text)">${dado}</b>, marque o "não sou robô" e emita — o PDF baixa na hora.`;
    const copiar = doc ? `<div class="copy-row"><span class="cp-doc">${esc(doc)}</span><button class="btn btn-ghost btn-sm" onclick="ddCopiar('${esc(doc)}', this)">Copiar ${dado}</button></div>` : '';
    const btnAbrir = portal
      ? `<a class="btn btn-primary btn-sm" href="${esc(portal)}" target="_blank" rel="noopener">${I.extlink} Abrir portal e emitir</a>`
      : `<button class="btn btn-primary btn-sm" disabled>${I.extlink} Abrir portal e emitir</button>`;
    return `<div class="emit-step"><div class="h"><span class="num">1</span> Abrir e emitir</div><p>${passo1}</p>${copiar}${btnAbrir}</div>
      ${dropzoneBloco(c)}`;
  }

  const manualAlt = (c) => `<div class="manual-alt">${I.extlink} Prefere resolver à mão? <b>Abrir o portal e anexar o PDF</b> continua disponível aqui embaixo, como antes.</div>`;

  // Bloco AUTOMÁTICO (substitui o "em breve") — a ação principal + o custo antes do clique.
  function autoBloco(c) {
    const info = infoDe(c);
    return `<div class="auto-panel">
      <div class="ap-ic">${I.robot}</div>
      <div class="ap-tx"><div class="t">Emitir automático pela Infosimples</div><div class="s">Sem captcha, sem sentar no portal — o comprovante cai direto no cofre e a IA já lê e classifica.</div></div>
      <span class="cost-pill">≈ ${custoBRL(info.custo)}</span>
      <button class="btn btn-primary btn-sm" onclick="ddEmitir('${c.id}')">Emitir automático</button>
    </div>`;
  }
  function faltaPanel(c, falta) {
    const labels = falta.map(f => REQUER_LBL[f] || f).join(', ');
    return `<div class="state-panel sp-warn">
      <div class="sp-ic">${I.alert}</div>
      <div class="sp-tx"><div class="t">Falta ${esc(labels)} para emitir</div><div class="s">Esta certidão exige ${esc(labels)}. Enquanto não for preenchido, o botão de emitir nem aparece — assim nada é cobrado à toa.</div></div>
      <button class="btn btn-primary btn-sm" onclick="ddIrParaPessoa('${c.parte_id || ''}')">Preencher agora</button>
    </div>`;
  }
  function emitindoPanel() {
    return `<div class="state-panel sp-run">
      <div class="sp-ic"><span class="spinner" style="width:18px;height:18px"></span></div>
      <div class="sp-tx"><div class="t">Emitindo pela Infosimples…</div><div class="s">Pedindo a certidão ao órgão. Assim que o comprovante chegar, vai pro cofre e a IA lê sozinha. Pode deixar a tela — a emissão roda no servidor.</div></div>
    </div>`;
  }
  // Estado "aguardando" do TJSP (D-9): o pedido foi feito (pago 1×); verificar/baixar a certidão
  // pronta é GRÁTIS no portal e-SAJ. Botão abre o e-SAJ pré-preenchido + campos copiáveis (fallback
  // seguro caso o e-SAJ não aceite querystring) + a caixa de anexo de sempre.
  function aguardandoPanel(c) {
    const prev = c.emissao_previsao ? fmtDataBR(c.emissao_previsao) : '';
    const prot = c.emissao_protocolo ? `Pedido nº <span class="prot">${esc(c.emissao_protocolo)}</span>. ` : '';
    const p = parteDe(c);
    const url = montarUrlESaj(c, p);
    const dados = [];
    if (c.emissao_protocolo) dados.push(['Nº do pedido', c.emissao_protocolo]);
    if (c.emissao_data) dados.push(['Data do pedido', fmtDataBR(c.emissao_data)]);
    if (p && p.documento) dados.push(['CPF', p.documento]);
    if (p && p.rg) dados.push(['RG', p.rg]);
    if (p && p.nome) dados.push(['Nome', p.nome]);
    const copias = dados.map(d => `<div class="copy-row"><span class="cp-doc">${esc(d[0])}: ${esc(String(d[1]))}</span><button class="btn btn-ghost btn-sm" onclick="ddCopiar('${esc(String(d[1]))}', this)">Copiar</button></div>`).join('');
    return `<div class="state-panel sp-info">
      <div class="sp-ic">${I.clock}</div>
      <div class="sp-tx">
        <div class="t">Aguardando o tribunal — o sistema confere sozinho</div>
        <div class="s">O sistema verifica no TJSP a cada 3 horas, das 7h às 19h${prev ? `, até <b style="color:var(--text)">${esc(prev)}</b>` : ''}. ${prot}<b style="color:var(--text)">Não precisa fazer nada</b> — quando a certidão sair, ela aparece aqui já classificada. Se preferir, você ainda pode verificar <b style="color:var(--text)">de graça</b> no portal e anexar à mão.</div>
        ${copias ? `<div class="esaj-copias">${copias}</div>` : ''}
      </div>
      <a class="btn btn-primary btn-sm" href="${esc(url)}" target="_blank" rel="noopener">${I.extlink} Verificar no portal do TJSP</a>
    </div>`;
  }
  // Estado passageiro (segundos): o robô "pegou" a certidão e está conferindo no TJSP agora.
  function verificandoPanel(c) {
    return `<div class="state-panel sp-info">
      <div class="sp-ic"><span class="spinner" style="width:18px;height:18px"></span></div>
      <div class="sp-tx"><div class="t">Verificando no TJSP…</div><div class="s">O sistema está conferindo agora se a certidão já ficou pronta. Isso leva alguns segundos — pode deixar a tela.</div></div>
    </div>`;
  }
  // "Não saiu no prazo" (expirado, R-14/CA-11): visualmente distinto de aguardando e de recebida.
  // O robô parou de tentar. Ação manual: verificar no portal (grátis) ou pedir de novo (nova emissão).
  function expiradoPanel(c) {
    const prev = c.emissao_previsao ? fmtDataBR(c.emissao_previsao) : '';
    const p = parteDe(c);
    const url = montarUrlESaj(c, p);
    return `<div class="state-panel sp-warn">
      <div class="sp-ic">${I.alert}</div>
      <div class="sp-tx">
        <div class="t">Não saiu no prazo</div>
        <div class="s">Passaram os 5 dias úteis${prev ? ` (previsão era até <b style="color:var(--text)">${esc(prev)}</b>)` : ''} e a certidão não ficou pronta no TJSP. O sistema parou de tentar sozinho — agora precisa de você: verifique à mão no portal (de graça) ou peça a certidão de novo.</div>
      </div>
      <div class="sp-actions">
        <a class="btn btn-primary btn-sm" href="${esc(url)}" target="_blank" rel="noopener">${I.extlink} Verificar no portal do TJSP</a>
        <button class="btn btn-ghost btn-sm" onclick="ddPedirDeNovo('${c.id}')">Pedir de novo</button>
      </div>
    </div>`;
  }
  function pendenciaPanel(c) {
    // Trava de custo: a Infosimples cobra mesmo quando o órgão instabiliza. Depois de uma
    // instabilidade, segura o "tentar de novo" por alguns minutos (evita gastar clicando).
    const ate = pendenciaAte.get(String(c.id)) || 0;
    const restaMs = ate - Date.now();
    const travado = restaMs > 0;
    const restaMin = Math.max(1, Math.ceil(restaMs / 60000));
    const btn = travado
      ? `<button class="btn btn-ghost btn-sm" disabled>Tentar de novo em ~${restaMin} min</button>`
      : `<button class="btn btn-primary btn-sm" onclick="ddEmitir('${c.id}')">Tentar de novo</button>`;
    const aviso = travado
      ? ` <b style="color:var(--text)">O órgão instabilizou agora</b> — você pode tentar de novo em ~${restaMin} min (cada tentativa é cobrada, mesmo dando erro).`
      : ' Cada nova tentativa é cobrada (mesmo se der erro), então você confirma o custo antes.';
    // Motivo real quando o robô do TJSP marcou a pendência (ex.: "o portal recusou: pedido não
    // localizado", "falta o RG"). Sem motivo, cai no texto genérico de instabilidade de sempre.
    const motivo = String(c.pendencia_motivo || '').trim();
    if (motivo) {
      return `<div class="state-panel sp-warn">
        <div class="sp-ic">${I.alert}</div>
        <div class="sp-tx"><div class="t">Esta certidão precisa de você</div><div class="s"><b style="color:var(--text)">${esc(motivo)}</b> Confira os dados e, se for o caso, tente de novo — cada nova emissão é cobrada, então você confirma o custo antes.</div></div>
        ${btn}
      </div>`;
    }
    return `<div class="state-panel sp-warn">
      <div class="sp-ic">${I.alert}</div>
      <div class="sp-tx"><div class="t">O órgão instabilizou na hora da consulta</div><div class="s">A consulta voltou com falha do site de origem. <b style="color:var(--text)">Isso não quer dizer que a pessoa tem débito</b> — foi instabilidade do órgão, não um resultado.${aviso}</div></div>
      ${btn}
    </div>`;
  }
  // Marca o cooldown de re-tentativa após instabilidade e reprograma a tela pra reabilitar sozinha.
  function marcarPendenciaCooldown(id) {
    id = String(id);
    pendenciaAte.set(id, Date.now() + COOLDOWN_PENDENCIA_MS);
    setTimeout(() => {
      if ((pendenciaAte.get(id) || 0) <= Date.now()) { pendenciaAte.delete(id); rerender(); }
    }, COOLDOWN_PENDENCIA_MS + 500);
  }

  function emitPanel(c) {
    const info = infoDe(c);
    const isAuto = !!(info && info.auto);
    if (isAuto) {
      if (c.status === 'emitindo') return `<div class="emit-panel">${emitindoPanel()}</div>`;
      // Verificando (TJSP, passageiro): o robô está conferindo agora — só o aviso, sem ações.
      if (c.status === 'verificando') return `<div class="emit-panel">${verificandoPanel(c)}</div>`;
      // Aguardando (TJSP): o robô confere sozinho + a caixa de anexo manual (você-resolve).
      if (c.status === 'aguardando') return `<div class="emit-panel">${aguardandoPanel(c)}${dropzoneBloco(c, 'Baixou a certidão no portal do TJSP? Arraste o PDF aqui — ou clique pra escolher')}</div>`;
      // Não saiu no prazo (expirado): ação manual (portal grátis ou pedir de novo) + anexo.
      if (c.status === 'expirado') return `<div class="emit-panel">${expiradoPanel(c)}${dropzoneBloco(c, 'Já tem a certidão em mãos? Arraste o PDF aqui — ou clique pra escolher')}</div>`;
      if (c.status === 'pendencia') return `<div class="emit-panel">${pendenciaPanel(c)}${manualAlt(c)}${manualBloco(c)}</div>`;
      if (c.status === 'em_aberto') {
        const falta = faltaDados(c);
        if (falta.length) return `<div class="emit-panel">${faltaPanel(c, falta)}</div>`;
        return `<div class="emit-panel">${autoBloco(c)}${manualAlt(c)}${manualBloco(c)}</div>`;
      }
      // certidão automática já classificada, reaberta pelo "Emitir no portal": oferece auto + manual.
      return `<div class="emit-panel">${autoBloco(c)}${manualAlt(c)}${manualBloco(c)}</div>`;
    }
    return `<div class="emit-panel">${manualBloco(c)}</div>`;
  }

  // Painel "leitura" — o que a IA achou na certidão (Etapa C).
  function iaPanel(c) {
    const conf = c.ia_confere || null;
    const apts = parseApts(c);
    const ehDuvida = c.status === 'duvida';
    const tone = ehDuvida ? ' amber' : (c.status === 'negativa' ? '' : ' red');
    const titulo = ehDuvida ? 'A IA não teve certeza'
      : 'Leitura da IA' + (apts.length ? ` — ${apts.length} apontamento${apts.length > 1 ? 's' : ''}` : '')
        + (c.classificado_por === 'manual' ? ' · classificação corrigida por você' : '');
    const chk = (ok, lbl) => `<span class="ia-chk${ok ? '' : ' bad'}">${ok ? I.check : I.alert} ${lbl}</span>`;
    const checks = conf ? `<div class="ia-checks">${chk(conf.tipo_ok !== false, 'É a certidão certa')}${chk(conf.nome_ok !== false, 'Nome confere')}${chk(conf.documento_ok !== false, 'CPF/CNPJ confere')}</div>` : '';
    const motivo = (ehDuvida && conf && conf.motivo) ? `<b>${esc(conf.motivo)}</b> ` : '';
    const aptsHtml = apts.length ? `<ul class="ia-apts">${apts.map(a => `<li>${esc(a.descricao)}${a.detalhe ? `<small>${esc(a.detalhe)}</small>` : ''}</li>`).join('')}</ul>` : '';
    const meta = `Lida em ${fmtDataHora(c.lido_em)}${c.ia_modelo ? ' · ' + esc(c.ia_modelo) : ''}${c.arquivo_nome ? ' · ' + esc(c.arquivo_nome) : ''}`;
    let acts;
    if (corrigindo === String(c.id)) {
      acts = `<span class="ia-lbl">Classificar como:</span>
        <button class="btn btn-primary btn-sm" onclick="ddClassificar('${c.id}','negativa')">Negativa</button>
        <button class="btn btn-ghost btn-sm" onclick="ddClassificar('${c.id}','apontamento')">Com apontamento</button>
        <button class="btn btn-ghost btn-sm" onclick="ddCancelarCorrecao()">Cancelar</button>`;
    } else if (ehDuvida) {
      acts = `<button class="btn btn-primary btn-sm" onclick="ddClassificar('${c.id}','negativa')">É negativa</button>
        <button class="btn btn-ghost btn-sm" onclick="ddClassificar('${c.id}','apontamento')">Tem apontamento</button>
        <button class="btn btn-ghost btn-sm" onclick="ddSubstituir('${c.id}')">Substituir PDF</button>
        <button class="btn btn-ghost btn-sm" onclick="ddReler('${c.id}')">Ler de novo</button>
        <button class="btn btn-ghost btn-sm" onclick="ddToggleEmitIa(this)">Emitir no portal</button>`;
    } else {
      acts = `<button class="btn btn-ghost btn-sm" onclick="ddCorrigir('${c.id}')">Corrigir classificação</button>
        <button class="btn btn-ghost btn-sm" onclick="ddSubstituir('${c.id}')">Substituir PDF</button>
        <button class="btn btn-ghost btn-sm" onclick="ddToggleEmitIa(this)">Emitir no portal</button>`;
    }
    return `<div class="ia-panel${tone}">
      <div class="ia-hd">${ehDuvida ? I.alert : I.atom}<h4>${esc(titulo)}</h4></div>
      ${checks}
      <div class="ia-resumo">${motivo}${esc(c.ia_resumo || '')}</div>
      ${aptsHtml}
      <div class="ia-meta">${meta}</div>
      <div class="ia-acts">${acts}</div>
    </div>`;
  }

  function certRow(c, n) {
    const v = visual(c);
    const temLeitura = !!(c.lido_em || c.ia_resumo);
    const toggle = temLeitura ? `<button class="ia-toggle" onclick="ddToggleIa('${c.id}')">${I.atom} leitura</button>` : '';
    const num = n ? `<span class="cnum">${n}.</span> ` : '';
    const row = `<div class="cert-row">
      <div class="st-ic">${v.ic}</div>
      <div class="nm"><div class="t">${num}${esc(c.nome)}</div><div class="d">${esc(c.descricao)}</div></div>
      ${methodChip(c)}
      <div class="st-cell">${v.cell}${toggle}</div>
      ${arqCell(c)}
    </div>`;
    const painel = temLeitura && openIa.has(String(c.id)) ? iaPanel(c) : '';
    // O painel de emitir também vai junto nas certidões já lidas (escondido);
    // o botão "Emitir no portal" do painel de leitura reabre ele.
    const emitHtml = (v.emit || temLeitura) ? emitPanel(c) : '';
    // Estados que precisam ficar VISÍVEIS sem clique (o operador tem que ver o
    // que está acontecendo e o custo antes de gastar): emitindo, aguardando (TJSP),
    // pendência, e toda certidão automática em aberto (mostra o custo direto).
    const infoRow = infoDe(c);
    const autoOpen = ['emitindo', 'verificando', 'aguardando', 'expirado', 'pendencia'].includes(c.status)
      || (c.status === 'em_aberto' && infoRow && infoRow.auto);
    const openCls = autoOpen ? ' open-emit' : '';
    return `<div class="cert-item ${v.cls}${openCls}" id="cert-${c.id}">${row}${emitHtml}${painel}</div>`;
  }

  function grpSummary(certs) {
    const k = contar(certs);
    const parts = [];
    if (k.apont) parts.push(`<span class="badge badge-red" style="font-size:9px">${k.apont} apont.</span>`);
    if (k.negativas) parts.push(`<span class="badge badge-green" style="font-size:9px">${k.negativas} ok</span>`);
    if (!k.negativas && !k.apont) parts.push('<span class="badge badge-gray" style="font-size:9px">não iniciada</span>');
    if (k.aberto) parts.push(`<span>· ${k.aberto} em aberto</span>`);
    else if (k.negativas || k.apont) parts.push(`<span>· ${k.total} certidões</span>`);
    return parts.join(' ');
  }

  function grupo(icon, titulo, sub, certs) {
    return `<div class="card grp" data-grp>
      <div class="grp-hd" onclick="ddToggleGrp(this)">
        <div class="gi">${icon}</div>
        <div class="gt">${esc(titulo)}<small>${esc(sub)}</small></div>
        <div class="gsum">${grpSummary(certs)}</div>
        <div class="chev">${I.chev}</div>
      </div>
      <div class="grp-bd">${certs.map((c, i) => certRow(c, i + 1)).join('')}</div>
    </div>`;
  }

  // ─── LISTA de verificações (fichas) ───────────────────────────────────────
  function fmtDataBR(ts) { try { return new Date(ts).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' }); } catch (e) { return ''; } }

  function renderLista(dossies, certsByDossie) {
    const root = document.getElementById('dd-root');
    const cards = dossies.map(d => {
      const certs = (certsByDossie[d.id] || []).filter(c => (c.fase || 'captacao') === (d.fase || 'captacao'));
      const k = contar(certs);
      const faseLbl = d.fase === 'venda' ? 'Venda' : 'Captação da gestão';
      // Selo com a mesma regra do parecer: concluída vira Apto / Apto c/ ressalvas.
      const apontBadge = (k.total > 0 && k.aberto === 0)
        ? (k.apont ? '<span class="badge badge-yellow">Apto c/ ressalvas</span>' : '<span class="badge badge-green">Apto</span>')
        : (k.apont ? `<span class="badge badge-red">${k.apont} apont.</span>` : '<span class="badge badge-orange">Em andamento</span>');
      return `<div class="dd-ficha" onclick="location.href='dd.html?id=${d.id}'">
        <div class="ficha-top">
          <div class="ficha-ic">${I.shield}</div>
          <div class="ficha-main">
            <div class="ficha-addr">${esc(d.endereco || d.titulo || 'Verificação')}</div>
            <div class="ficha-sub">${esc(faseLbl)} · matrícula ${esc(d.matricula_num || '—')} · ${fmtDataBR(d.created_at)}</div>
          </div>
          ${apontBadge}
          <button class="ficha-del" title="Apagar verificação" onclick="event.stopPropagation();ddApagarDossie('${d.id}')">${I.trash}</button>
        </div>
        <div class="ficha-bar"><i style="width:${k.pct}%"></i></div>
        <div class="ficha-foot">
          <span><b>${k.resolvidas}</b> de ${k.total} resolvidas</span>
          <span class="ficha-mini"><span class="mini g">${k.negativas} neg.</span><span class="mini r">${k.apont} apont.</span><span class="mini a">${k.aberto} aberto</span></span>
        </div>
      </div>`;
    }).join('');

    root.innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Due Diligence <span class="beta-tag">Beta</span></div>
          <div class="page-sub">Verificação de certidões na captação da gestão</div></div>
        <button class="btn btn-primary btn-sm" onclick="ddNovaVerificacao()">+ Nova verificação</button>
      </div>
      <div class="dd-fichas">${cards || '<div class="note">Nenhuma verificação ainda. Clique em <b>Nova verificação</b> pra começar (entra na Etapa B).</div>'}</div>`;
  }

  // ─── DETALHE de um caso ───────────────────────────────────────────────────
  function renderDetalhe(dossie, partes, certs) {
    const root = document.getElementById('dd-root');
    const k = contar(certs);

    partes.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    const byId = {}; partes.forEach(p => byId[p.id] = p);
    const certsDe = (pid) => certs.filter(c => c.parte_id === pid).sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const certsImovel = certs.filter(c => !c.parte_id).sort((a,b)=>(a.ordem||0)-(b.ordem||0));

    const partChips = partes.map(p => {
      const rel = p.tipo === 'proprietario' ? 'proprietário'
        : p.tipo === 'conjuge' ? `cônjuge (${REGIME_LBL[p.regime] || 'regime a confirmar'})`
        : 'empresa';
      const icon = p.tipo === 'empresa' ? I.build : I.user;
      const cls = p.tipo === 'empresa' ? 'part pj' : 'part';
      return `<span class="${cls}">${icon} ${esc(p.nome)} <span class="rel">· ${rel}</span></span>`;
    }).join('');

    const atencao = certs.filter(c => c.status === 'apontamento' || c.status === 'positiva');
    const atencaoHtml = atencao.length ? `
      <div class="attention">
        <div class="att-hd">${I.alert.replace('stroke-width="2.4"','stroke-width="2"')}<h3>Precisam de atenção</h3><span class="cnt">${atencao.length}</span></div>
        ${atencao.map(c => {
          const p = byId[c.parte_id];
          const who = p ? `· ${esc(p.nome)} (${TIPO_LBL[p.tipo]||p.tipo})` : '· imóvel';
          const badge = c.status === 'apontamento' ? '1 apontamento' : 'Positiva';
          return `<div class="att-row"><span class="t">${esc(c.nome)}</span><span class="who">${who}</span><span class="sp"></span><span class="badge badge-red">${badge}</span>${arqCell(c)}</div>`;
        }).join('')}
      </div>` : '';

    let gruposHtml = '';
    if (certsImovel.length) gruposHtml += grupo(I.home, 'Imóvel', dossie.endereco || '', certsImovel);
    partes.forEach(p => {
      const cs = certsDe(p.id);
      if (!cs.length) return;
      const sub = p.tipo === 'conjuge' ? `Cônjuge · ${p.motivo || 'incluído no caso'}`
        : p.tipo === 'empresa' ? (p.motivo || 'Empresa')
        : 'Proprietário';
      const icon = p.tipo === 'empresa' ? I.build : I.user;
      // Mini-editor dos 4 campos (D-5) — só pessoa física; empresa não usa esses campos.
      if (p.tipo === 'proprietario' || p.tipo === 'conjuge') gruposHtml += personEditor(p);
      gruposHtml += grupo(icon, p.nome, sub, cs);
    });

    // Barra "Emitir todas as automáticas" (topo do caso) — some quando não há elegíveis.
    const elegiveis = certsElegiveisLote();
    const loteBarHtml = elegiveis.length ? `<div class="lote-bar">
      <div class="lb-ic">${I.robot}</div>
      <div class="lb-tx"><div class="t">${elegiveis.length} certid${elegiveis.length > 1 ? 'ões podem ser emitidas automáticas' : 'ão pode ser emitida automática'}</div><div class="s">Sem captcha, direto pro cofre — você confirma o custo total antes de qualquer cobrança.</div></div>
      <button class="btn btn-primary" onclick="ddEmitirTodas()">${I.robot} Emitir todas as automáticas</button>
    </div>` : '';

    // ─── Parecer final (fechamento do caso) ───────────────────────────────
    // Sai automaticamente quando TODAS as certidões estão classificadas
    // (negativa ou apontamento). "Você decide" e "lendo" seguram o parecer.
    const duvidas = certs.filter(c => c.status === 'duvida').length;
    const concluida = k.total > 0 && k.aberto === 0;
    const faseNome = dossie.fase === 'venda' ? 'venda' : 'captação da gestão';
    const ultLeitura = certs.reduce((m, c) => (c.lido_em && (!m || c.lido_em > m)) ? c.lido_em : m, null);
    const parecerMeta = `${ultLeitura ? 'Verificação concluída em ' + fmtDataHora(ultLeitura) + ' · ' : ''}parecer gerado automaticamente pela classificação das certidões · a decisão final é sempre do responsável`;
    let parecerCls = '', parecerIc = I.alert, parecer;
    if (concluida && !k.apont) {
      parecerCls = ' apto'; parecerIc = I.shield;
      parecer = `<h3>Parecer: apto — nada consta</h3>
        <p>As <b>${k.total} certidões</b> da fase de ${faseNome} foram emitidas e classificadas: <b>${k.negativas} negativas</b>, nenhum apontamento. Pelo que consta nas certidões, o imóvel e as partes estão aptos para a ${faseNome}.</p>
        <div class="meta">${parecerMeta}</div>`;
    } else if (concluida) {
      parecerCls = ' ressalvas';
      const itens = atencao.map(c => {
        const p = byId[c.parte_id];
        const who = p ? `${esc(p.nome)} (${(TIPO_LBL[p.tipo] || p.tipo).toLowerCase()})` : 'imóvel';
        const apts = parseApts(c);
        const det = apts.length ? apts.map(a => esc(a.descricao)).join(' · ') : esc(c.ia_resumo || 'classificada com apontamento');
        return `<li><b>${esc(c.nome)}</b> <span class="who">· ${who}</span><small>${det}</small></li>`;
      }).join('');
      parecer = `<h3>Parecer: apto com ressalvas — ${k.apont} apontamento${k.apont > 1 ? 's' : ''}</h3>
        <p>As <b>${k.total} certidões</b> foram emitidas e classificadas: ${k.negativas} negativa${k.negativas === 1 ? '' : 's'} e <b>${k.apont} com apontamento</b>. Os pontos abaixo devem ser avaliados antes de fechar a ${faseNome}.</p>
        <ul class="ress">${itens}</ul>
        <div class="meta">${parecerMeta}</div>`;
    } else {
      const falta = [];
      if (k.aberto - duvidas > 0) falta.push(`${k.aberto - duvidas} em aberto`);
      if (duvidas) falta.push(`<b>${duvidas} esperando sua decisão</b> ("Você decide")`);
      const faltaTxt = `${k.aberto === 1 ? 'Falta 1 certidão' : 'Faltam ' + k.aberto + ' certidões'}${falta.length ? ' — ' + falta.join(' e ') : ''}`;
      parecer = k.apont
        ? `<h3>Verificação em andamento — ${k.apont} ponto${k.apont>1?'s':''} de atenção</h3><p>Foram encontrados <b>${k.apont} apontamento${k.apont>1?'s':''}</b>. ${faltaTxt}. O parecer final de aptidão sai quando tudo estiver classificado.</p>`
        : `<h3>Verificação em andamento</h3><p>${faltaTxt}. O parecer final de aptidão sai quando tudo estiver classificado.</p>`;
    }

    root.innerHTML = `
      <a class="dd-back" href="dd.html">${I.back} Verificações</a>
      <div class="page-header">
        <div><div class="page-title">${esc(dossie.endereco || dossie.titulo || 'Verificação')} <span class="beta-tag">Beta</span></div>
          <div class="page-sub">Fase: <b style="color:var(--text)">${dossie.fase === 'venda' ? 'venda' : 'captação da gestão'}</b> — verificação com as certidões gratuitas</div></div>
      </div>

      <div class="top-row">
        <div class="glass case-top">
          <div class="case-imovel">
            <div class="addr">${I.home} ${esc(dossie.endereco || dossie.titulo || 'Imóvel')}</div>
            <div class="mat">Matrícula nº ${esc(dossie.matricula_num || '—')} · ${esc(dossie.matricula_cri || 'Registro de Imóveis')}${dossie.matricula_path ? ` · <a href="#" style="color:var(--accent);text-decoration:none" onclick="event.preventDefault();ddAbrirCofre('${esc(dossie.matricula_path)}')">abrir PDF da matrícula</a>` : ' · dados do imóvel já no Alex OS'}</div>
            <div class="case-parts">${partChips}</div>
            <div class="case-ia">${I.atom} Partes e regime extraídos da matrícula pela IA · <span style="color:var(--accent);cursor:pointer" onclick="alert('Conferir/editar partes entra na Etapa B.')">conferir / editar</span></div>
          </div>
        </div>
        <div class="glass summary-card">
          <div>
            <div class="sc-top"><div class="sc-title"><span class="n">${k.resolvidas}</span><span class="of">de ${k.total} resolvidas</span></div><div class="badge badge-orange">${k.pct}%</div></div>
            <div class="bar"><i style="width:${k.pct}%"></i></div>
          </div>
          <div class="sc-stats">
            <div class="sc-stat g"><div class="v">${k.negativas}</div><div class="l">negativas</div></div>
            <div class="sc-stat r"><div class="v">${k.apont}</div><div class="l">apontamento${k.apont===1?'':'s'}</div></div>
            <div class="sc-stat a"><div class="v">${k.aberto}</div><div class="l">em aberto</div></div>
          </div>
          <button class="btn btn-primary" onclick="ddAbrirAuditoria()">${I.folder} Pasta de auditoria</button>
        </div>
      </div>

      ${atencaoHtml}

      ${loteBarHtml}

      <div class="col-head"><span></span><span>Certidão</span><span>Método</span><span class="c-st">Status</span><span class="c-arq">Arquivo</span></div>

      ${gruposHtml}

      <div class="result${parecerCls}">
        <div class="ric">${parecerIc}</div>
        <div class="rt">${parecer}</div>
      </div>

      <div class="note"><b>Recurso beta — captação da gestão.</b> <b>Automático</b> = o sistema emite sozinho pela Infosimples (com confirmação de custo antes de cada cobrança); <b>Você resolve</b> = "Emitir" abre o portal pra você passar o captcha e arrastar o PDF. Dados fictícios — o conjunto de certidões ainda será validado com o Dr. Wilton.</div>
    `;
  }

  // Handlers globais (usados no HTML gerado).
  window.ddToggleGrp = function (hd) { hd.closest('[data-grp]').classList.toggle('closed'); };
  window.ddToggleEmit = function (btn) {
    const item = btn.closest('.cert-item');
    item.classList.toggle('open-emit');
    btn.textContent = item.classList.contains('open-emit') ? 'Fechar' : 'Emitir';
  };
  // ─── Portais (link do "Você resolve") por certidão ────────────────────────
  const DD_PORTAIS = {
    duc:'https://duc.prefeitura.sp.gov.br', cedi:'https://cediconshistorico.prefeitura.sp.gov.br',
    iptu_notificacao:'https://notcertiptu.prefeitura.sp.gov.br',
    pje:'https://pje.trt2.jus.br/certidoes', protestos:'https://www.protestosp.com.br/consulta-de-protesto',
    trt2_fisico:'https://aplicacoes9.trt2.jus.br', certidoes_tjsp:'https://certidoes.tjsp.jus.br',
    trf3:'https://web.trf3.jus.br/certidao-regional', civel_tjsp:'https://esaj.tjsp.jus.br/sco',
    // CND Federal (Receita/PGFN) — links do Dr. Wilton (21/07). CPF: caminho inferido (/home/cpf), confirmar.
    cnd_federal_cpf:'https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cpf',
    protestos_cnpj:'https://www.protestosp.com.br/consulta-de-protesto',
    cartao_cnpj:'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/',
    cnd_federal_cnpj:'https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj', cndt:'https://www.tst.jus.br/certidao1',
  };

  // ─── Etapa C: anexo no cofre + leitura pela IA ────────────────────────────
  window.ddToggleIa = function (id) {
    id = String(id);
    if (openIa.has(id)) openIa.delete(id); else openIa.add(id);
    rerender();
  };
  // Reabre o painel do portal (link + copiar documento + arrastar) a partir
  // do painel de leitura — pra reemitir quando o PDF anexado era o errado.
  window.ddToggleEmitIa = function (btn) {
    const item = btn.closest('.cert-item');
    item.classList.toggle('open-emit');
    btn.textContent = item.classList.contains('open-emit') ? 'Fechar portal' : 'Emitir no portal';
  };
  window.ddCopiar = async function (txt, btn) {
    try {
      await navigator.clipboard.writeText(txt);
      if (btn) { const t = btn.textContent; btn.textContent = 'Copiado'; setTimeout(() => { btn.textContent = t; }, 1500); }
    } catch (e) { prompt('Copie o documento:', txt); }
  };
  window.ddEscolher = function (id) {
    const el = document.querySelector(`#cert-${id} .dropzone input[type=file]`);
    if (el) el.click();
  };
  window.ddCertPick = function (input, id) {
    const f = input.files && input.files[0]; input.value = '';
    if (f) ddAnexar(id, f);
  };
  window.ddCertDrop = function (e, id) {
    e.preventDefault(); e.currentTarget.classList.remove('drag');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) ddAnexar(id, f);
  };

  // Guarda o PDF no cofre e dispara a leitura. Também serve pra "Substituir PDF"
  // (apaga o arquivo antigo depois que o novo entra).
  async function ddAnexar(certId, file) {
    certId = String(certId);
    const c = findCert(certId);
    if (!c || !CTX) return;
    if (file.type !== 'application/pdf') { alert('Envie um PDF (o arquivo escolhido não é PDF).'); return; }
    if (file.size > 15 * 1024 * 1024) { alert('O PDF passa de 15 MB — o cofre aceita até 15 MB.'); return; }
    if (uploading.has(certId)) return; // já tem um anexo desta certidão em andamento
    uploading.add(certId);
    const oldPath = c.arquivo_path || null;
    let novoPath = null;
    try {
      const sb = await initSupabase();
      const b64 = await fileToBase64(file);
      const p = parteDe(c);
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); // AAAAMMDDHHMMSS
      const nomeArq = `${c.chave}_${slug(p ? p.nome : 'imovel')}_${stamp}.pdf`;
      const path = `${CTX.dossie.id}/${nomeArq}`;
      const up = await sb.storage.from(COFRE).upload(path, file, { contentType:'application/pdf' });
      if (up.error) throw up.error;
      novoPath = path;
      await dbUpdateCert(sb, certId, { arquivo_path: path, arquivo_nome: nomeArq, status:'lendo' });
      if (oldPath && oldPath !== path) sb.storage.from(COFRE).remove([oldPath]); // substituição
      rerender();
      await lerCertidao(sb, c, b64);
    } catch (e) {
      // Só cai aqui se o upload ou o registro falharam — o banco ainda está no
      // estado anterior (não mexer no status, senão apaga classificação antiga).
      console.error('DD anexo:', e);
      if (novoPath && c.arquivo_path !== novoPath) {
        try { const sb2 = await initSupabase(); sb2.storage.from(COFRE).remove([novoPath]); } catch (e2) {}
      }
      alert('Não consegui guardar o PDF no cofre. Veja o console e tente de novo.');
      rerender();
    } finally { uploading.delete(certId); }
  }

  // Chama a Edge Function dd-ler-certidao e grava a classificação.
  async function lerCertidao(sb, c, b64) {
    const p = parteDe(c);
    const contexto = {
      chave: c.chave, certidao_nome: c.nome, grupo: c.grupo,
      esperado_nome: p ? p.nome : '', esperado_documento: p ? (p.documento || '') : '',
      endereco: CTX.dossie.endereco || '', matricula_num: CTX.dossie.matricula_num || '',
    };
    try {
      const { data, error } = await sb.functions.invoke('dd-ler-certidao', { body: { pdf_base64: b64, contexto } });
      if (error) throw error;
      if (data && data.error) throw new Error(data.error);
      const apts = Array.isArray(data.apontamentos) ? data.apontamentos : [];
      const status = data.resultado === 'negativa' ? 'negativa' : (data.resultado === 'positiva' ? 'apontamento' : 'duvida');
      await dbUpdateCert(sb, c.id, {
        status,
        resultado: status === 'duvida' ? null : data.resultado,
        ia_resumo: data.resumo || '',
        ia_apontamentos: apts,
        ia_confere: data.confere || null,
        ia_modelo: data._modelo || null,
        lido_em: new Date().toISOString(),
        classificado_por: status === 'duvida' ? null : 'ia',
      });
    } catch (e) {
      console.error('DD leitura da certidão:', e);
      try {
        await dbUpdateCert(sb, c.id, {
          status:'duvida',
          ia_resumo:'A leitura automática falhou. O PDF está guardado no cofre — você pode classificar na mão ou tentar "Ler de novo". (Detalhe no console.)',
          ia_apontamentos:[], ia_confere:null,
          lido_em:new Date().toISOString(), classificado_por:null,
        });
      } catch (e2) { console.error('DD leitura (status):', e2); }
    }
    openIa.add(String(c.id));
    rerender();
  }

  // Abre um PDF do cofre por link temporário. A janela abre no clique (senão o
  // navegador bloqueia como pop-up) e recebe o endereço quando o link chega.
  window.ddAbrirCofre = async function (path) {
    if (!path) return;
    const w = window.open('', '_blank');
    try {
      const sb = await initSupabase();
      const { data, error } = await sb.storage.from(COFRE).createSignedUrl(path, 600);
      if (error) throw error;
      if (w) w.location = data.signedUrl; else window.open(data.signedUrl, '_blank');
    } catch (e) {
      if (w) w.close();
      console.error('DD abrir arquivo:', e);
      alert('Não consegui abrir o PDF. Veja o console.');
    }
  };
  window.ddAbrirArquivo = function (id) {
    const c = findCert(id);
    if (c) ddAbrirCofre(c.arquivo_path);
  };

  // ─── Pasta de auditoria: todos os PDFs do cofre deste caso, organizados ───
  function audBadge(c) {
    switch (c.status) {
      case 'negativa': return '<span class="badge badge-green badge-sm">Negativa</span>';
      case 'positiva':
      case 'apontamento': { const n = parseApts(c).length; return `<span class="badge badge-red badge-sm">${n || 1} apont.</span>`; }
      case 'duvida': return '<span class="badge badge-yellow badge-sm">Você decide</span>';
      default: return '';
    }
  }
  window.ddAbrirAuditoria = function () {
    if (!CTX || document.getElementById('dd-auditoria')) return;
    const { dossie, partes, certs } = CTX;
    let total = 0;
    const row = (titulo, sub, path, badge) => `<div class="aud-row">
      <div class="fi">${I.file}</div>
      <div class="ft"><div class="n">${esc(titulo)}</div><div class="s">${esc(sub)}</div></div>
      ${badge ? `<span class="st">${badge}</span>` : ''}
      <button class="btn btn-ghost btn-sm" onclick="ddAbrirCofre('${esc(path)}')">${I.extlink} Abrir</button>
    </div>`;
    const certRowsDe = (lista) => lista
      .filter(c => c.arquivo_path)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
      .map(c => { total++; return row(c.nome, `${c.arquivo_nome || ''}${c.lido_em ? ' · anexada em ' + fmtDataHora(c.lido_em) : ''}`, c.arquivo_path, audBadge(c)); })
      .join('');
    let html = '';
    let secImovel = '';
    if (dossie.matricula_path) {
      total++;
      secImovel += row('Matrícula do imóvel', dossie.matricula_nome || '', dossie.matricula_path, '<span class="badge badge-info badge-sm">Matrícula</span>');
    }
    secImovel += certRowsDe(certs.filter(c => !c.parte_id));
    if (secImovel) html += '<div class="aud-grp">Imóvel</div>' + secImovel;
    partes.slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).forEach(p => {
      const sec = certRowsDe(certs.filter(c => c.parte_id === p.id));
      if (sec) html += `<div class="aud-grp">${esc(p.nome)} · ${esc((TIPO_LBL[p.tipo] || p.tipo).toLowerCase())}</div>` + sec;
    });
    if (!total) html = '<div class="aud-vazio">Ainda não há PDFs no cofre deste caso. Eles aparecem aqui conforme as certidões forem anexadas.</div>';
    const ov = document.createElement('div');
    ov.className = 'dd-overlay'; ov.id = 'dd-auditoria';
    ov.addEventListener('click', (e) => { if (e.target === ov) ddFecharAuditoria(); });
    ov.innerHTML = `<div class="dd-modal">
      <div class="modal-hd">
        <div class="mi">${I.folder}</div>
        <div class="mt"><h3>Pasta de auditoria</h3><small>${esc(dossie.endereco || dossie.titulo || '')} · ${total} PDF${total === 1 ? '' : 's'} no cofre</small></div>
        <button class="modal-x" onclick="ddFecharAuditoria()" title="Fechar">${I.x}</button>
      </div>
      <div class="modal-bd">${html}</div>
      <div class="modal-ft">
        <span>${I.lockSm}Cofre privado — cada PDF abre por link temporário, só pra quem está logado</span>
        <button class="btn btn-ghost btn-sm" onclick="ddFecharAuditoria()">Fechar</button>
      </div>
    </div>`;
    document.body.appendChild(ov);
  };
  window.ddFecharAuditoria = function () {
    const el = document.getElementById('dd-auditoria');
    if (el) el.remove();
  };

  window.ddCorrigir = function (id) { corrigindo = String(id); rerender(); };
  window.ddCancelarCorrecao = function () { corrigindo = null; rerender(); };
  window.ddClassificar = async function (id, status) {
    try {
      const sb = await initSupabase();
      await dbUpdateCert(sb, id, { status, resultado: status === 'negativa' ? 'negativa' : 'positiva', classificado_por:'manual' });
      corrigindo = null; openIa.add(String(id));
      rerender();
    } catch (e) { console.error('DD classificar:', e); alert('Não consegui salvar a classificação. Veja o console.'); }
  };

  window.ddSubstituir = function (id) {
    let inp = document.getElementById('dd-subst-input');
    if (!inp) {
      inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/pdf'; inp.id = 'dd-subst-input'; inp.style.display = 'none';
      document.body.appendChild(inp);
    }
    inp.onchange = function () { const f = inp.files && inp.files[0]; inp.value = ''; if (f) ddAnexar(id, f); };
    inp.click();
  };

  // Relê o PDF que já está no cofre (usado quando a leitura falhou).
  window.ddReler = async function (id) {
    id = String(id);
    const c = findCert(id);
    if (!c || !c.arquivo_path || uploading.has(id)) return;
    uploading.add(id);
    try {
      const sb = await initSupabase();
      await dbUpdateCert(sb, id, { status:'lendo' });
      rerender();
      const { data, error } = await sb.storage.from(COFRE).download(c.arquivo_path);
      if (error) throw error;
      const b64 = await fileToBase64(data);
      await lerCertidao(sb, c, b64);
    } catch (e) {
      console.error('DD reler:', e);
      try { const sb = await initSupabase(); await dbUpdateCert(sb, id, { status:'duvida' }); } catch (e2) {}
      rerender();
      alert('Não consegui reler o PDF. Veja o console.');
    } finally { uploading.delete(id); }
  };

  // ─── Emissão automática (Etapa D1) — handlers ─────────────────────────────
  // Modal de confirmação de custo (nada é cobrado antes do OK — CA-2/3/7).
  function ddModal(html, onConfirm) {
    ddFecharModal();
    ddModalAction = onConfirm || null;
    const ov = document.createElement('div');
    ov.className = 'dd-overlay'; ov.id = 'dd-modal-custo';
    ov.addEventListener('click', (e) => { if (e.target === ov) ddFecharModal(); });
    ov.innerHTML = html;
    document.body.appendChild(ov);
    ddModalEsc = (e) => { if (e.key === 'Escape') ddFecharModal(); };
    document.addEventListener('keydown', ddModalEsc);
  }
  window.ddFecharModal = function () {
    const el = document.getElementById('dd-modal-custo');
    if (el) el.remove();
    if (ddModalEsc) { document.removeEventListener('keydown', ddModalEsc); ddModalEsc = null; }
    ddModalAction = null;
  };
  window.ddModalConfirmar = function () {
    const a = ddModalAction; ddModalAction = null;
    ddFecharModal();
    if (a) a();
  };

  // Emissão individual: valida dado faltando → confirma custo → dispara.
  window.ddEmitir = function (id) {
    const c = findCert(id); if (!c) return;
    const info = infoDe(c); if (!info || !info.auto) return;
    const falta = faltaDados(c);
    if (falta.length) { ddIrParaPessoa(c.parte_id); return; } // trava: não abre modal, não chama API
    // Trava de custo: durante o cooldown de instabilidade, não deixa nem abrir o modal (2b).
    const ate = pendenciaAte.get(String(id)) || 0;
    if (ate > Date.now()) { alert('O órgão instabilizou agora há pouco. Você pode tentar de novo em ~' + Math.max(1, Math.ceil((ate - Date.now()) / 60000)) + ' min.'); return; }
    const p = parteDe(c);
    const linhas = [
      `<div class="mrow"><span class="mc">Certidão</span><span class="mv" style="font-size:12.5px">${esc(c.nome)}</span></div>`,
      `<div class="mrow"><span class="mc">Pessoa</span><span class="mv" style="font-size:12.5px">${esc(p ? p.nome : '')}${p && p.documento ? ' · ' + esc(p.documento) : ''}</span></div>`,
    ].join('');
    ddModal(`<div class="dd-modal" style="max-width:460px">
      <div class="modal-hd"><div class="mi">${I.robot}</div><div class="mt"><h3>Emitir esta certidão?</h3><small>${esc(c.nome)}${p ? ' · ' + esc(p.nome) : ''}</small></div><button class="modal-x" onclick="ddFecharModal()">${I.x}</button></div>
      <div class="modal-bd" style="padding:16px 20px">
        ${linhas}
        <div class="mtotal"><span class="ml">Custo aproximado desta emissão</span><span class="mr">≈ ${custoBRL(info.custo)}</span></div>
        <div class="mnote">${I.alert}<span>Cada emissão gasta de verdade. <b>Nada é cobrado até você confirmar.</b> O gasto fica registrado no relatório do escritório.</span></div>
      </div>
      <div class="modal-ft" style="justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="ddFecharModal()">Cancelar</button>
        <button class="btn btn-primary btn-sm" onclick="ddModalConfirmar()">Confirmar e emitir</button>
      </div>
    </div>`, () => emitirCertidao(c, {}));
  };

  // "Pedir de novo" a partir de "Não saiu no prazo" (expirado): volta a certidão para o estado
  // inicial (em_aberto) e reabre o painel de emissão normal — com o custo à mostra ANTES do clique.
  // Nada é cobrado aqui; a cobrança só acontece se o operador confirmar a nova emissão.
  window.ddPedirDeNovo = async function (id) {
    const c = findCert(id); if (!c) return;
    try {
      const sb = await initSupabase();
      await dbUpdateCert(sb, id, { status: 'em_aberto', pendencia_motivo: null, verificando_desde: null });
      c.status = 'em_aberto'; c.pendencia_motivo = null; c.verificando_desde = null;
      rerender();
    } catch (e) { console.error('DD pedir de novo:', e); alert('Não consegui reabrir esta certidão. Veja o console.'); }
  };

  // Emissão em lote: confirma custo TOTAL → dispara uma a uma (uma falha não trava as outras — CA-8).
  window.ddEmitirTodas = function () {
    const lista = certsElegiveisLote();
    if (!lista.length) { alert('Não há certidões automáticas prontas pra emitir agora.'); return; }
    const total = lista.reduce((s, c) => s + Number((infoDe(c) || {}).custo || 0), 0);
    const linhas = lista.map(c => `<div class="mrow"><span class="mc">${esc(c.nome)}</span><span class="mv">≈ ${custoBRL((infoDe(c) || {}).custo)}</span></div>`).join('');
    const fora = certsForaLote();
    const foraTxt = fora.length
      ? `Fora desta leva: ${fora.map(c => `<b>${esc(c.nome)}</b> (${faltaDados(c).length ? 'falta ' + faltaDados(c).map(f => REQUER_LBL[f]).join(', ') : 'exige login gov.br'})`).join(' · ')}. Preencha/configure e elas entram na próxima.`
      : '';
    ddModal(`<div class="dd-modal" style="max-width:480px">
      <div class="modal-hd"><div class="mi">${I.robot}</div><div class="mt"><h3>Emitir todas as automáticas?</h3><small>${lista.length} certid${lista.length > 1 ? 'ões' : 'ão'}</small></div><button class="modal-x" onclick="ddFecharModal()">${I.x}</button></div>
      <div class="modal-bd" style="padding:16px 20px">
        ${linhas}
        <div class="mtotal"><span class="ml">${lista.length} certid${lista.length > 1 ? 'ões' : 'ão'} · custo total aproximado</span><span class="mr">≈ ${custoBRL(total)}</span></div>
        ${foraTxt ? `<div class="mexcl">${foraTxt}</div>` : ''}
        <div class="mnote">${I.alert}<span>Se uma falhar, as outras seguem. <b>Nada é cobrado até você confirmar.</b></span></div>
      </div>
      <div class="modal-ft" style="justify-content:flex-end">
        <button class="btn btn-ghost btn-sm" onclick="ddFecharModal()">Cancelar</button>
        <button class="btn btn-primary btn-sm" onclick="ddModalConfirmar()">Confirmar e emitir ${lista.length === 1 ? 'a certidão' : 'as ' + lista.length}</button>
      </div>
    </div>`, () => executarLote(lista));
  };
  async function executarLote(lista) {
    for (const item of lista) {
      const c = findCert(item.id);
      if (c) await emitirCertidao(c, { lote:true });
    }
  }

  // O disparo em si. A trava de duplo clique é dupla: o Set `emitindo` (front) e o
  // claim atômico no servidor (a Edge Function recusa cobrar se já está emitindo).
  async function emitirCertidao(c, opts) {
    opts = opts || {};
    const id = String(c.id);
    if (emitindo.has(id)) return;   // anti-duplo-clique (CA-12)
    emitindo.add(id);
    c.status = 'emitindo'; rerender(); // feedback imediato; o servidor faz o claim de verdade
    try {
      const sb = await initSupabase();
      const { data, error } = await sb.functions.invoke('dd-emitir-certidao', { body: { certidao_id: c.id, acao:'emitir' } });
      if (error) throw error;
      if (data && data.error) { await tratarErroEmissao(c, data, opts); return; }
      await aplicarRetornoEmissao(sb, c, data, opts);
    } catch (e) {
      console.error('DD emitir:', e);
      c.status = 'pendencia';
      try { const sb = await initSupabase(); await dbUpdateCert(sb, id, { status:'pendencia' }); } catch (e2) {}
      rerender();
      if (!opts.lote) alert('Não consegui emitir agora. Você pode tentar de novo. (Detalhe no console.)');
    } finally { emitindo.delete(id); }
  }

  async function tratarErroEmissao(c, data, opts) {
    if (data.error === 'faltam_dados' || data.tipo === 'faltam_dados') {
      c.status = 'em_aberto'; rerender();
      if (!opts.lote) { alert('Falta preencher: ' + (data.faltando_label || []).join(', ')); ddIrParaPessoa(c.parte_id); }
      return;
    }
    if (data.tipo === 'bloqueada') { c.status = 'emitindo'; rerender(); if (!opts.lote) alert('Esta certidão já está sendo emitida ou já foi resolvida — nada foi cobrado.'); return; }
    if (data.tipo === 'sem_govbr') { c.status = 'em_aberto'; rerender(); if (!opts.lote) alert('A certidão Cível TJSP exige login gov.br, que ainda não está configurado no cofre.'); return; }
    // erro do órgão / genérico: o servidor já marcou 'pendencia' no banco.
    c.status = 'pendencia'; rerender();
    if (!opts.lote) alert('Não foi possível emitir: ' + (data.error || 'erro do órgão') + '. Você pode tentar de novo.');
  }

  // Aplica o que o servidor devolveu e, se veio PDF, REUSA a classificação da Etapa C.
  async function aplicarRetornoEmissao(sb, c, data, opts) {
    if (data.cert) Object.assign(c, data.cert);
    if (data.tipo === 'recebida' && data.pdf_base64) {
      c.status = 'lendo'; rerender();
      await lerCertidao(sb, c, data.pdf_base64); // dd-ler-certidao — negativa/positiva/você decide + identidade
    } else {
      if (data.tipo === 'pendencia') marcarPendenciaCooldown(c.id); // instabilidade do órgão: segura re-tentativa (2b)
      rerender(); // aguardando / pendencia já refletidos em data.cert
    }
  }

  // (A 2ª etapa paga do TJSP — "Buscar certidão pronta" — foi REMOVIDA em 25/07, ADR D-9.
  //  Verificar/baixar a certidão pronta agora é grátis no portal e-SAJ + anexo manual, no
  //  painel "aguardando" — sem chamada cobrada. Ver aguardandoPanel/montarUrlESaj.)

  // Leva o operador ao mini-editor da pessoa (pra preencher o dado que falta).
  window.ddIrParaPessoa = function (parteId) {
    const el = document.getElementById('dd-person-' + parteId);
    if (el) { el.scrollIntoView({ behavior:'smooth', block:'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1400); }
  };

  // Salva um campo do mini-editor da pessoa (RG/UF/sexo/nascimento) direto no banco (inline).
  window.ddSalvarParteCampo = async function (parteId, campo, valor) {
    if (!CTX) return;
    const p = CTX.partes.find(x => String(x.id) === String(parteId));
    if (!p) return;
    const novo = (valor == null ? '' : String(valor)).trim() || null;
    if (p[campo] === novo) return;
    const antes = p[campo];
    p[campo] = novo;
    try {
      const sb = await initSupabase();
      const patch = {}; patch[campo] = novo;
      const { error } = await sb.from('dd_partes').update(patch).eq('id', parteId);
      if (error) throw error;
      rerender(); // atualiza o selo da pessoa e destrava as certidões que dependiam do campo
    } catch (e) {
      p[campo] = antes;
      console.error('DD salvar campo da parte:', e);
      alert('Não consegui salvar. Veja o console.');
    }
  };

  // Cartão mini-editor da pessoa na tela do caso (D-5). Só pessoa física.
  function personEditor(p) {
    const falta = faltaDaPessoa(p);
    const chip = falta.length
      ? `<span class="pchip warn">${I.alert} Falta ${esc(falta.map(f => REQUER_LBL[f]).join(', '))}</span>`
      : `<span class="pchip ok">${I.check} Dados completos</span>`;
    const doc = p.documento ? esc(p.documento) : '';
    const rel = TIPO_LBL[p.tipo] || p.tipo;
    const nasc = p.data_nascimento ? String(p.data_nascimento).slice(0, 10) : '';
    return `<div class="card person" id="dd-person-${p.id}">
      <div class="person-top">
        <div class="person-av">${esc(iniciais(p.nome))}</div>
        <div class="person-nm">${esc(p.nome)}<small>${esc(rel)}${doc ? ' · ' + doc : ''}</small></div>
        ${chip}
      </div>
      <div class="grid4">
        <div class="field"><label>RG (identidade)</label><input class="inp" value="${esc(p.rg || '')}" onchange="ddSalvarParteCampo('${p.id}','rg',this.value)"></div>
        <div class="field"><label>UF do RG</label><input class="inp" value="${esc(p.rg_uf || '')}" maxlength="2" onchange="ddSalvarParteCampo('${p.id}','rg_uf',this.value)"></div>
        <div class="field"><label>Sexo</label><select class="inp" onchange="ddSalvarParteCampo('${p.id}','sexo',this.value)">${optsSexo(p.sexo)}</select></div>
        <div class="field"><label>Data de nascimento</label><input type="date" class="inp${nasc ? '' : ' empty'}" value="${esc(nasc)}" onblur="ddSalvarParteCampo('${p.id}','data_nascimento',this.value)"></div>
      </div>
      <div class="person-save"${falta.length ? ' style="color:var(--warn)"' : ''}>${falta.length ? I.alert : I.check} ${falta.length
        ? 'Com esses campos em branco, algumas certidões automáticas ficam bloqueadas — mas o resto do caso funciona normal.'
        : 'Salvo automaticamente. As certidões automáticas desta pessoa já podem ser emitidas.'}</div>
    </div>`;
  }

  // ─── "Leitor em modo teste" ───────────────────────────────────────────────
  // Enquanto a API paga (Claude API) não está ligada, os dados da matrícula
  // entram por aqui (lidos por mim na sessão). Em produção, uma Edge Function
  // devolve exatamente este mesmo formato — a tela e o montador não mudam.
  window.DD_FIXTURES = {
    '000000': {
      arquivo:'Matricula_000000_Exemplo.pdf',
      imovel:{ endereco:'Rua de Exemplo, 100 — ap. 10 (Edifício Exemplo) · Cond. EXEMPLO · Bairro de Exemplo',
        matricula_num:'000.000', matricula_cri:'1º Registro de Imóveis de SP', area_privativa:'33,18 m²',
        contribuinte:'000.000.0000-0', tipo:'Studio' },
      proprietarios:[ { nome:'Fulano de Tal', documento:'000.000.000-00', estado_civil:'solteiro', regime:'', conjuge:null } ],
      empresas:[],
      observacoes:[
        'Houve hipoteca a um banco (garantia) — cancelada em 2015 (Av.02).',
        'Houve patrimônio de afetação — cancelado em 2017 (Av.05), na venda ao proprietário atual.',
        'Sem ônus ativo registrado até a data do documento. Vale conferir se há registro mais novo que o desta cópia.',
      ],
    },
  };

  // Espelha a lista 'tipologia' de listas_opcoes do Alex OS (mantê-las iguais).
  const TIPOLOGIAS = ['Apartamento', 'Cobertura', 'Garden', 'Duplex', 'Studio', 'Casa', 'Comercial'];
  const ehCasa = (t) => String(t || '').toLowerCase() === 'casa';
  const normalizeTipo = (t) => TIPOLOGIAS.find((x) => x.toLowerCase() === String(t || '').toLowerCase()) || 'Apartamento';
  const ESTADOS = [['solteiro','Solteiro(a)'],['casado','Casado(a)'],['uniao_estavel','União estável'],['divorciado','Divorciado(a)'],['viuvo','Viúvo(a)']];
  const REGIMES = [['comunhao_parcial','Comunhão parcial'],['comunhao_universal','Comunhão universal'],['separacao_convencional','Separação convencional'],['separacao_obrigatoria','Separação obrigatória'],['uniao_estavel','União estável (equiparado)']];
  const opts = (list, sel) => list.map(o => `<option value="${o[0]}"${o[0] === sel ? ' selected' : ''}>${o[1]}</option>`).join('');
  const temConjuge = (p) => (p.estado_civil === 'casado' || p.estado_civil === 'uniao_estavel');

  let novaState = null;

  function renderNova() {
    const root = document.getElementById('dd-root');
    root.innerHTML = `
      <a class="dd-back" href="dd.html">${I.back} Verificações</a>
      <div class="page-header"><div><div class="page-title">Nova verificação <span class="beta-tag">Beta</span></div>
        <div class="page-sub">Leia a matrícula e confira os dados antes de criar.</div></div></div>
      <div class="card nova-drop" id="dd-dz" ondragover="event.preventDefault();this.classList.add('drag')" ondragleave="this.classList.remove('drag')" ondrop="ddDrop(event)">
        <label class="ndz">${I.upload}
          <div class="dt">Arraste a matrícula (PDF) aqui — ou clique pra escolher</div>
          <div class="dh">A leitura ao vivo usa a IA (Gemini). Precisa da chave no cofre do Supabase; sem ela, use o Modo teste abaixo.</div>
          <input type="file" accept="application/pdf" style="display:none" onchange="ddArquivoSelecionado(this)">
        </label>
      </div>
      <div class="nova-teste">
        <div class="nt-h">Modo teste — matrícula já lida pela IA</div>
        <button class="btn btn-primary btn-sm" onclick="ddCarregarTeste('000000')">Carregar matrícula de exemplo</button>
      </div>
      <div id="dd-conf"></div>`;
  }

  function fileToBase64(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
  }
  function normalizeExtraction(d) {
    d = d || {}; d.imovel = d.imovel || {}; d.imovel.tipo = normalizeTipo(d.imovel.tipo);
    d.proprietarios = Array.isArray(d.proprietarios) && d.proprietarios.length ? d.proprietarios : [{ nome:'', documento:'', estado_civil:'solteiro', regime:'', conjuge:null }];
    d.empresas = []; d.observacoes = Array.isArray(d.observacoes) ? d.observacoes : [];
    d.proprietarios.forEach(p => {
      p.estado_civil = p.estado_civil || 'solteiro'; p.regime = p.regime || '';
      // Campos D1 (a IA já traz rg quando consta na matrícula; sexo/nascimento normalmente vazios).
      p.rg = p.rg || ''; p.rg_uf = p.rg_uf || ''; p.sexo = p.sexo || ''; p.data_nascimento = p.data_nascimento || '';
      if (!temConjuge(p)) p.conjuge = null; else if (!p.conjuge) p.conjuge = { nome:'', documento:'' };
    });
    return d;
  }
  async function ddLerArquivo(file) {
    if (file.type !== 'application/pdf') { alert('Envie um PDF da matrícula.'); return; }
    const dz = document.querySelector('#dd-dz .ndz');
    if (dz) dz.innerHTML = '<span class="spinner"></span><div class="dt">Lendo a matrícula com a IA…</div><div class="dh">pode levar alguns segundos</div>';
    try {
      const b64 = await fileToBase64(file);
      const sb = await initSupabase();
      const { data, error } = await sb.functions.invoke('dd-ler-matricula', { body: { pdf_base64: b64, filename: file.name } });
      if (error) throw error;
      if (data && data.error) throw new Error(data.error);
      novaState = normalizeExtraction(data);
      novaState._file = file; // guarda o PDF pra levar pro cofre na criação
      renderConferencia();
      const el = document.getElementById('dd-conf'); if (el) el.scrollIntoView({ behavior:'smooth' });
    } catch (e) {
      console.error('DD leitura ao vivo:', e);
      renderNova();
      alert('Não consegui ler a matrícula ao vivo.\n\nSe a chave do Gemini ainda não está no cofre do Supabase, use o "Modo teste" por enquanto.\n\nDetalhe no console.');
    }
  }
  window.ddArquivoSelecionado = function (input) { const f = input.files && input.files[0]; if (f) ddLerArquivo(f); };
  window.ddDrop = function (e) { e.preventDefault(); const dz = e.currentTarget; dz.classList.remove('drag'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) ddLerArquivo(f); };

  window.ddCarregarTeste = function (key) {
    const fx = window.DD_FIXTURES[key];
    if (!fx) return;
    novaState = JSON.parse(JSON.stringify(fx));
    renderConferencia();
    const el = document.getElementById('dd-conf'); if (el) el.scrollIntoView({ behavior:'smooth' });
  };

  const val = (sel) => { const el = document.querySelector(sel); return el ? el.value.trim() : ''; };
  function coletar() {
    if (!novaState) return;
    const im = novaState.imovel;
    im.endereco = val('[data-im="endereco"]'); im.matricula_num = val('[data-im="matricula_num"]');
    im.matricula_cri = val('[data-im="matricula_cri"]'); im.area_privativa = val('[data-im="area_privativa"]');
    im.contribuinte = val('[data-im="contribuinte"]'); im.tipo = val('[data-im="tipo"]') || im.tipo;
    novaState.proprietarios.forEach((p, i) => {
      p.nome = val(`[data-prop="${i}.nome"]`); p.documento = val(`[data-prop="${i}.doc"]`);
      p.estado_civil = val(`[data-prop="${i}.ec"]`) || p.estado_civil; p.regime = val(`[data-prop="${i}.reg"]`);
      // Campos D1 (só existem no DOM quando o bloco está renderizado; preserva se ausente).
      const g = (sel, cur) => { const el = document.querySelector(sel); return el ? el.value.trim() : cur; };
      p.rg = g(`[data-prop="${i}.rg"]`, p.rg || ''); p.rg_uf = g(`[data-prop="${i}.rguf"]`, p.rg_uf || '');
      p.sexo = g(`[data-prop="${i}.sexo"]`, p.sexo || ''); p.data_nascimento = g(`[data-prop="${i}.nasc"]`, p.data_nascimento || '') || null;
      if (p.conjuge) { p.conjuge.nome = val(`[data-conj="${i}.nome"]`); p.conjuge.documento = val(`[data-conj="${i}.doc"]`); }
    });
    // Empresas salvas são estáticas; só preservo o que está sendo digitado no "adicionar".
    if (novaState._adding) {
      const n = document.getElementById('emp-add-nome'); const d = document.getElementById('emp-add-doc');
      if (n) novaState._adding.nome = n.value.trim();
      if (d) novaState._adding.documento = d.value.trim();
    }
  }

  function previewGrupos() {
    const isCasa = ehCasa(novaState.imovel.tipo);
    const grupos = [{ t:'Imóvel', items: DD_CATALOGO.imovel.filter(c => c.fase === 'captacao' && (!c.somenteCasa || isCasa)).map(c => c.nome) }];
    const pessoaItems = DD_CATALOGO.pessoa.filter(c => c.fase === 'captacao').map(c => c.nome);
    const empresaItems = DD_CATALOGO.empresa.filter(c => c.fase === 'captacao').map(c => c.nome);
    novaState.proprietarios.forEach(p => {
      grupos.push({ t: p.nome || 'Proprietário', items: pessoaItems });
      if (temConjuge(p) && DD_REGIME_INCLUI_CONJUGE[p.regime] && p.conjuge && p.conjuge.nome) grupos.push({ t: p.conjuge.nome + ' (cônjuge)', items: pessoaItems });
    });
    novaState.empresas.forEach(e => { if (e.nome) grupos.push({ t: e.nome + ' (empresa)', items: empresaItems }); });
    return grupos;
  }

  function previewCount() {
    const isCasa = ehCasa(novaState.imovel.tipo);
    let n = DD_CATALOGO.imovel.filter(c => c.fase === 'captacao' && (!c.somenteCasa || isCasa)).length;
    const pessoaN = DD_CATALOGO.pessoa.filter(c => c.fase === 'captacao').length;
    const empN = DD_CATALOGO.empresa.filter(c => c.fase === 'captacao').length;
    novaState.proprietarios.forEach(p => { n += pessoaN; if (temConjuge(p) && DD_REGIME_INCLUI_CONJUGE[p.regime] && p.conjuge && p.conjuge.nome) n += pessoaN; });
    n += novaState.empresas.length * empN;
    return n;
  }

  function renderConferencia() {
    const box = document.getElementById('dd-conf');
    if (!box || !novaState) return;
    // Leitura terminou: some a caixa de arrastar e o modo teste (para o "Lendo…").
    const dz = document.getElementById('dd-dz'); if (dz) dz.style.display = 'none';
    const nt = document.querySelector('.nova-teste'); if (nt) nt.style.display = 'none';
    const s = novaState;

    const propsHtml = s.proprietarios.map((p, i) => {
      const ini = (p.nome || '?').split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase();
      const conjBlock = temConjuge(p) ? (() => {
        const inclui = DD_REGIME_INCLUI_CONJUGE[p.regime];
        const aviso = inclui
          ? `<div class="conjuge-hint">${I.atom.replace('stroke-width="2"','stroke-width="1.8"')} Neste regime o cônjuge <b style="color:var(--text)">entra na verificação</b>.</div>`
          : `<div class="conjuge-hint" style="color:var(--warn)">Neste regime o cônjuge <b>não entra</b> por padrão (só o titular).</div>`;
        return `<div class="grid" style="margin-top:10px">
            <div class="field"><label>Cônjuge — nome</label><input class="inp" data-conj="${i}.nome" value="${esc(p.conjuge ? p.conjuge.nome : '')}"></div>
            <div class="field"><label>Cônjuge — CPF</label><input class="inp" data-conj="${i}.doc" value="${esc(p.conjuge ? p.conjuge.documento : '')}"></div>
          </div>${aviso}`;
      })() : '';
      const rmBtn = s.proprietarios.length > 1 ? `<span class="conf-rm" onclick="ddRemProp(${i})" title="Remover">✕</span>` : '';
      return `<div class="parte">
        <div class="parte-top"><div class="parte-av">${esc(ini)}</div><div class="parte-nm">${esc(p.nome || 'Proprietário')}</div>${rmBtn}</div>
        <div class="grid g3">
          <div class="field"><label>Nome</label><input class="inp" data-prop="${i}.nome" value="${esc(p.nome)}"></div>
          <div class="field"><label>CPF</label><input class="inp" data-prop="${i}.doc" value="${esc(p.documento)}"></div>
          <div class="field"><label>Estado civil</label><select class="inp" data-prop="${i}.ec" onchange="ddEstadoCivil(${i})">${opts(ESTADOS, p.estado_civil)}</select></div>
        </div>
        <div class="grid grid4" style="margin-top:10px">
          <div class="field"><label>RG (identidade)${p.rg ? ` <span class="ia-fill">${I.atom} a IA leu</span>` : ''}</label><input class="inp" data-prop="${i}.rg" value="${esc(p.rg || '')}"></div>
          <div class="field"><label>UF do RG</label><input class="inp" data-prop="${i}.rguf" maxlength="2" value="${esc(p.rg_uf || '')}"></div>
          <div class="field"><label>Sexo</label><select class="inp" data-prop="${i}.sexo">${optsSexo(p.sexo)}</select></div>
          <div class="field"><label>Nascimento</label><input type="date" class="inp" data-prop="${i}.nasc" value="${esc(p.data_nascimento ? String(p.data_nascimento).slice(0, 10) : '')}"></div>
        </div>
        ${temConjuge(p) ? `<div class="grid" style="margin-top:10px"><div class="field"><label>Regime de bens</label><select class="inp" data-prop="${i}.reg" onchange="ddRegime(${i})">${opts(REGIMES, p.regime || 'comunhao_parcial')}</select></div></div>` : ''}
        ${conjBlock}
      </div>`;
    }).join('');

    // Empresas já salvas = linhas fixas; a que está sendo adicionada = mini-formulário com Salvar.
    const empHtml = s.empresas.map((e, i) => `<div class="emp-row">
      <div class="ei">${I.build}</div>
      <div class="en"><div class="n">${esc(e.nome)}</div><div class="c">${esc(e.documento || 'CNPJ não informado')}</div></div>
      <span class="rm" onclick="ddRemEmp(${i})" title="Remover">✕</span></div>`).join('');
    const empAdd = s._adding ? `<div class="emp-add">
        <div class="grid"><div class="field"><label>Razão social</label><input class="inp" id="emp-add-nome" placeholder="Nome da empresa" value="${esc(s._adding.nome)}"></div>
          <div class="field"><label>CNPJ</label><input class="inp" id="emp-add-doc" placeholder="00.000.000/0001-00" value="${esc(s._adding.documento)}"></div></div>
        <div class="emp-add-acts"><button class="btn btn-ghost btn-sm" onclick="ddCancelAddEmp()">Cancelar</button><button class="btn btn-primary btn-sm" onclick="ddSalvarEmp()">Salvar empresa</button></div>
      </div>` : `<button class="add-btn" onclick="ddAddEmp()">+ Adicionar empresa</button>`;

    box.innerHTML = `
      <div class="step-hd" style="margin-top:6px"><span class="step-num">1</span><span class="step-t">Matrícula lida <small>${esc(s.arquivo || '')}</small></span></div>
      <div class="step-hd"><span class="step-num">2</span><span class="step-t">Confira os dados <small>corrija o que precisar antes de criar</small></span></div>

      <div class="card conf-sec">
        <div class="conf-h">${I.home} Imóvel</div>
        <div class="grid">
          <div class="field full"><label>Endereço</label><input class="inp" data-im="endereco" value="${esc(s.imovel.endereco)}"></div>
          <div class="field"><label>Matrícula nº</label><input class="inp" data-im="matricula_num" value="${esc(s.imovel.matricula_num)}"></div>
          <div class="field"><label>Cartório (CRI)</label><input class="inp" data-im="matricula_cri" value="${esc(s.imovel.matricula_cri)}"></div>
          <div class="field"><label>Área privativa</label><input class="inp" data-im="area_privativa" value="${esc(s.imovel.area_privativa)}"></div>
          <div class="field"><label>Contribuinte (IPTU)</label><input class="inp" data-im="contribuinte" value="${esc(s.imovel.contribuinte)}"></div>
          <div class="field"><label>Tipo</label><select class="inp" data-im="tipo" onchange="ddTipo()">${opts(TIPOLOGIAS.map(t => [t, t]), s.imovel.tipo)}</select></div>
        </div>
      </div>

      <div class="card conf-sec">
        <div class="conf-h">${I.user} Proprietário(s) <span class="conf-hint">dono atual — a IA seguiu a cadeia de registros</span></div>
        ${propsHtml}
        <button class="add-btn" onclick="ddAddProp()">+ Adicionar proprietário</button>
      </div>

      <div class="card conf-sec">
        <div class="conf-h">${I.build} Empresas do proprietário <span class="conf-hint">não vêm na matrícula</span></div>
        <div class="emp-note"><b>As empresas não constam na matrícula.</b> São encontradas por pesquisa no CPF (via <b>Assertiva</b>). Por enquanto você adiciona na mão; a busca automática entra quando ligarmos a API do Assertiva.</div>
        <div class="search-cpf"><div class="sct">Pesquisar empresas pelo CPF no <b>Assertiva</b></div><span class="soon">em breve</span></div>
        ${empHtml}
        ${empAdd}
      </div>

      ${(s.observacoes && s.observacoes.length) ? `<div class="onus">
        <div class="onus-hd">${I.atom} <h4>O que a IA observou na matrícula</h4></div>
        <ul>${s.observacoes.map(o => `<li>${esc(o)}</li>`).join('')}</ul></div>` : ''}

      <div class="card conf-sec">
        <div class="conf-h">${I.shield} O que será criado <span class="conf-hint">${previewCount()} certidões</span></div>
        <div class="prev-groups">${previewGrupos().map(g => `<div class="prev-g"><div class="prev-gt">${esc(g.t)} <span>${g.items.length}</span></div>${g.items.map(n => `<div class="prev-i">${esc(n)}</div>`).join('')}</div>`).join('')}</div>
      </div>

      <div class="modal-actions">
        <span class="modal-actions-left prev">Vai criar <b>${previewCount()}</b> certidões pelo cardápio e pela regra de regime.</span>
        <a class="btn btn-ghost btn-sm" href="dd.html">Cancelar</a>
        <button class="btn btn-primary btn-sm" id="dd-criar" onclick="ddConfirmarCriacao()">Criar verificação</button>
      </div>`;
  }

  window.ddTipo = function () { coletar(); renderConferencia(); };
  window.ddEstadoCivil = function (i) {
    coletar(); const p = novaState.proprietarios[i];
    if (temConjuge(p)) { if (!p.conjuge) p.conjuge = { nome:'', documento:'' }; if (!p.regime) p.regime = 'comunhao_parcial'; }
    else { p.conjuge = null; p.regime = ''; }
    renderConferencia();
  };
  window.ddRegime = function (i) { coletar(); renderConferencia(); };
  window.ddAddProp = function () { coletar(); novaState.proprietarios.push({ nome:'', documento:'', estado_civil:'solteiro', regime:'', conjuge:null }); renderConferencia(); };
  window.ddRemProp = function (i) { coletar(); novaState.proprietarios.splice(i, 1); renderConferencia(); };
  window.ddAddEmp = function () { coletar(); novaState._adding = { nome:'', documento:'' }; renderConferencia(); };
  window.ddCancelAddEmp = function () { coletar(); novaState._adding = null; renderConferencia(); };
  window.ddSalvarEmp = function () {
    coletar();
    const nome = (novaState._adding && novaState._adding.nome || '').trim();
    if (!nome) { alert('Informe o nome da empresa.'); return; }
    novaState.empresas.push({ nome, documento:(novaState._adding.documento || '').trim(), origem:'manual' });
    novaState._adding = null;
    renderConferencia();
  };
  window.ddRemEmp = function (i) { coletar(); novaState.empresas.splice(i, 1); renderConferencia(); };

  function certObj(dossieId, parteId, grupo, c, ordem) {
    return { dossie_id:dossieId, parte_id:parteId, grupo, chave:c.chave, nome:c.nome, descricao:c.descricao,
      metodo:c.metodo, fase:c.fase, pago:!!c.pago, status:'em_aberto', portal_url:DD_PORTAIS[c.chave] || null, ordem };
  }

  async function montar(ex) {
    const sb = await initSupabase();
    const { data: dossie, error: e1 } = await sb.from('dd_dossies').insert({
      fase:'captacao', status:'em_andamento', titulo:ex.imovel.endereco, endereco:ex.imovel.endereco,
      matricula_num:ex.imovel.matricula_num, matricula_cri:ex.imovel.matricula_cri,
      obs:(ex.observacoes || []).join('\n'),
    }).select().single();
    if (e1) throw e1;
    const dossieId = dossie.id;
    const isCasa = ehCasa(ex.imovel.tipo);
    const certRows = [];

    DD_CATALOGO.imovel.filter(c => c.fase === 'captacao' && (!c.somenteCasa || isCasa))
      .forEach((c, i) => certRows.push(certObj(dossieId, null, 'imovel', c, i)));

    let ordem = 0;
    for (const p of ex.proprietarios) {
      const { data: pp, error: ep } = await sb.from('dd_partes').insert({
        dossie_id:dossieId, tipo:'proprietario', nome:p.nome, documento:p.documento, regime:p.regime || null,
        rg:p.rg || null, rg_uf:p.rg_uf || null, sexo:p.sexo || null, data_nascimento:p.data_nascimento || null,
        origem:'ia', ordem:ordem++,
      }).select().single();
      if (ep) throw ep;
      DD_CATALOGO.pessoa.filter(c => c.fase === 'captacao').forEach((c, i) => certRows.push(certObj(dossieId, pp.id, 'pessoa', c, i)));

      if (temConjuge(p) && DD_REGIME_INCLUI_CONJUGE[p.regime] && p.conjuge && p.conjuge.nome) {
        const { data: pc, error: ec } = await sb.from('dd_partes').insert({
          dossie_id:dossieId, tipo:'conjuge', nome:p.conjuge.nome, documento:p.conjuge.documento || null,
          regime:p.regime, vinculo_parte_id:pp.id, origem:'ia',
          motivo:'incluído por ' + (REGIME_LBL[p.regime] || 'regime'), ordem:ordem++,
        }).select().single();
        if (ec) throw ec;
        DD_CATALOGO.pessoa.filter(c => c.fase === 'captacao').forEach((c, i) => certRows.push(certObj(dossieId, pc.id, 'pessoa', c, i)));
      }
    }

    for (const emp of (ex.empresas || [])) {
      if (!emp.nome) continue;
      const { data: pe, error: ee } = await sb.from('dd_partes').insert({
        dossie_id:dossieId, tipo:'empresa', nome:emp.nome, documento:emp.documento || null,
        origem:emp.origem || 'manual', motivo:'empresa do proprietário', ordem:ordem++,
      }).select().single();
      if (ee) throw ee;
      DD_CATALOGO.empresa.filter(c => c.fase === 'captacao').forEach((c, i) => certRows.push(certObj(dossieId, pe.id, 'empresa', c, i)));
    }

    if (certRows.length) { const { error: eC } = await sb.from('dd_certidoes').insert(certRows); if (eC) throw eC; }

    // Matrícula vai pro cofre junto (aprovado 24/07). Se falhar, a verificação
    // já foi criada normal — só avisa no console (dá pra reanexar depois).
    if (ex._file) {
      try {
        const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const path = `${dossieId}/matricula_${slug(ex.imovel.matricula_num || 'imovel')}_${stamp}.pdf`;
        const up = await sb.storage.from(COFRE).upload(path, ex._file, { contentType:'application/pdf' });
        if (up.error) throw up.error;
        const { error: eM } = await sb.from('dd_dossies').update({ matricula_path: path, matricula_nome: ex._file.name || 'matricula.pdf' }).eq('id', dossieId);
        if (eM) throw eM;
      } catch (e) { console.warn('DD: a matrícula não foi pro cofre (a verificação foi criada normal)', e); }
    }
    location.href = 'dd.html?id=' + dossieId;
  }

  window.ddConfirmarCriacao = async function () {
    coletar();
    if (!novaState.imovel.endereco) { alert('Preencha o endereço do imóvel.'); return; }
    if (!novaState.proprietarios.some(p => p.nome)) { alert('Informe ao menos um proprietário.'); return; }
    const btn = document.getElementById('dd-criar');
    if (btn) { btn.disabled = true; btn.textContent = 'Criando…'; }
    try { await montar(novaState); }
    catch (e) { console.error('DD: falha ao criar', e); alert('Não foi possível criar a verificação. Veja o console.'); if (btn) { btn.disabled = false; btn.textContent = 'Confirmar e criar verificação'; } }
  };

  window.ddNovaVerificacao = function () { location.href = 'dd.html?novo=1'; };

  // Apagar uma verificação da lista. Cascata: leva partes e certidões junto —
  // e os PDFs do cofre também (senão viram arquivos órfãos no Storage).
  window.ddApagarDossie = async function (id) {
    if (!confirm('Apagar esta verificação?\n\nIsso remove a verificação, TODAS as certidões e partes dela e os PDFs guardados no cofre. Não dá pra desfazer.')) return;
    try {
      const sb = await initSupabase();
      try {
        const { data: files } = await sb.storage.from(COFRE).list(id, { limit: 200 });
        if (files && files.length) await sb.storage.from(COFRE).remove(files.map(f => id + '/' + f.name));
      } catch (e) { console.warn('DD: não consegui limpar o cofre desta verificação', e); }
      const { error } = await sb.from('dd_dossies').delete().eq('id', id);
      if (error) throw error;
      location.reload();
    } catch (e) { console.error('DD: falha ao apagar', e); alert('Não foi possível apagar. Veja o console.'); }
  };

  // ─── Aviso "o robô do TJSP pode ter quebrado" ─────────────────────────────
  // O robô (dd-buscar-tjsp) registra cada conferência em dd_verificacoes_tjsp.
  // Se a tentativa MAIS RECENTE terminou em 'robo_quebrado' (o portal mudou ou
  // respondeu algo irreconhecível) e faz menos de 7 dias, mostra a faixa no
  // topo da área — qualquer resposta reconhecível posterior derruba o aviso.
  async function checaRoboTjsp(sb) {
    const alvo = document.getElementById('dd-robo-aviso');
    if (!alvo) return;
    try {
      const { data } = await sb.from('dd_verificacoes_tjsp')
        .select('desfecho,created_at').order('created_at', { ascending: false }).limit(1);
      const ult = data && data[0];
      const recente = ult && (Date.now() - new Date(ult.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000;
      if (!ult || ult.desfecho !== 'robo_quebrado' || !recente) { alvo.innerHTML = ''; return; }
      alvo.innerHTML = `
        <div class="robo-aviso">
          <div class="ra-ic">${I.alert}</div>
          <div class="ra-tx">
            <div class="t">O robô do TJSP pode ter quebrado</div>
            <div class="s">Na última tentativa (${fmtDataHora(ult.created_at)}) o portal do TJSP respondeu algo que o robô não reconheceu — a conferência automática pode estar parada. Nenhuma certidão foi perdida: elas seguem aguardando. Enquanto isso, dá pra conferir manualmente no portal.</div>
          </div>
          <a class="btn btn-ghost btn-sm" href="${ESAJ_VISUALIZAR}?servico=810103" target="_blank" rel="noopener">${I.extlink} Abrir portal</a>
        </div>`;
    } catch (e) { console.warn('DD: não consegui checar o diário do robô do TJSP', e); }
  }

  // ─── Carga / roteamento ───────────────────────────────────────────────────
  async function boot() {
    const root = document.getElementById('dd-root');
    const params = new URLSearchParams(location.search);
    if (params.get('novo')) { renderNova(); return; }
    try {
      const sb = await initSupabase();
      checaRoboTjsp(sb); // roda em paralelo; não segura a tela
      const dossieId = params.get('id');

      if (dossieId) {
        const { data: dossie } = await sb.from('dd_dossies').select('*').eq('id', dossieId).single();
        if (!dossie) { root.innerHTML = '<div class="note">Verificação não encontrada.</div>'; return; }
        const [pr, cr] = await Promise.all([
          sb.from('dd_partes').select('*').eq('dossie_id', dossie.id),
          sb.from('dd_certidoes').select('*').eq('dossie_id', dossie.id),
        ]);
        CTX = {
          dossie,
          partes: pr.data || [],
          certs: (cr.data || []).filter(c => (c.fase || 'captacao') === (dossie.fase || 'captacao')),
        };
        // Certidões "Você decide" chegam com o painel da leitura já aberto.
        CTX.certs.forEach(c => { if (c.status === 'duvida') openIa.add(String(c.id)); });
        renderDetalhe(CTX.dossie, CTX.partes, CTX.certs);
      } else {
        const { data: dossies } = await sb.from('dd_dossies').select('*').order('created_at', { ascending:false });
        const { data: certs } = await sb.from('dd_certidoes').select('id,dossie_id,status,fase');
        const byDossie = {};
        (certs || []).forEach(c => { (byDossie[c.dossie_id] = byDossie[c.dossie_id] || []).push(c); });
        renderLista(dossies || [], byDossie);
      }
    } catch (e) {
      console.error('DD: falha ao carregar', e);
      root.innerHTML = '<div class="note" style="color:var(--danger)">Não foi possível carregar. Veja o console.</div>';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
