// captacao.js — aba Captação (pipeline) do módulo Imóveis.
// Extraído de imoveis.html em 05/07/2026 (item 12.4, extração 4). NÃO usar type=module — funções globais (onclick).

// ── Render Pipeline ───────────────────────────────────────────────────────────
function renderPipeline() {
  const el = document.getElementById('pipeline');

  const ativos   = imoveis.filter(i => i.estagio !== 'perdido' && i.estagio !== 'assinado');
  const perdidos = imoveis.filter(i => i.estagio === 'perdido');

  el.innerHTML = STAGES.map(st => {
    const items = ativos.filter(i => i.estagio === st.id);
    const cards = items.map(i => capCardHtml(i)).join('');
    return '<div class="pipe-col">' +
      '<div class="pipe-col-hdr">' +
        '<span class="pipe-col-ico" style="color:' + st.color + '">' + st.icon + '</span>' +
        '<span class="pipe-col-label">' + st.label + '</span>' +
        '<span class="pipe-col-count">' + items.length + '</span>' +
      '</div>' +
      '<div class="pipe-col-cards" data-stage="' + st.id + '">' + cards + '</div>' +
      '<button class="btn-add-col" onclick="openModalStage(\'' + st.id + '\')">+ Adicionar</button>' +
    '</div>';
  }).join('');
  initPipelineDnD();

  // Perdidos
  const secPerd = document.getElementById('perdidoSection');
  secPerd.style.display = perdidos.length ? '' : 'none';
  document.getElementById('perdidoCount').textContent = perdidos.length;
  document.getElementById('perdidoGrid').innerHTML = perdidos.map(i => {
    const mot = (i.marcos && i.marcos.perdido && i.marcos.perdido.motivo) || '';
    return '<div class="perdido-card" onclick="openModal(\'' + i.id + '\')">' +
      '<div class="ds-section-title">' + (i.owner || '—') + '</div>' +
      '<div class="ds-meta">' + (i.imovel || i.rua || '—') + '</div>' +
      (mot ? '<div class="ds-meta" style="color:var(--danger);margin-top:2px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' + mot + '</div>' :'') +
    '</div>';
  }).join('');
}

// Arrastar e soltar entre etapas (SortableJS). Mover grava a data do marco (só na 1ª vez na etapa).
function initPipelineDnD() {
  if (typeof Sortable === 'undefined') return;
  document.querySelectorAll('.pipe-col-cards').forEach(col => {
    new Sortable(col, {
      group: 'pipeline',
      animation: 150,
      ghostClass: 'cap-card-ghost',
      onEnd: (evt) => {
        const id     = evt.item.getAttribute('data-id');
        const destino = evt.to.getAttribute('data-stage');
        const origem  = evt.from.getAttribute('data-stage');
        if (id && destino && destino !== origem) moverEstagio(id, destino);
      }
    });
  });
}

async function moverEstagio(id, novoEstagio) {
  const im = imoveis.find(x => x.id === id);
  if (!im) { renderPipeline(); return; }
  const marcos = Object.assign({}, im.marcos || {});
  if (!marcos[novoEstagio]) marcos[novoEstagio] = new Date().toISOString().slice(0, 10);
  const { error } = await db().from('imoveis')
    .update({ estagio: novoEstagio, marcos, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) { toast('❌ Erro ao mover: ' + error.message); renderPipeline(); return; }
  toast('✅ Movido para ' + ((STAGES.find(s => s.id === novoEstagio) || {}).label || novoEstagio));
  await carregarImoveis();
  renderPipeline();
}

function capDiasBadge(c) {
  const marco = c.marcos && c.marcos[c.estagio];
  const prazo = STAGE_PRAZO[c.estagio];
  if (!marco || !prazo) return '';                       // 'assinado' / sem marco: sem selo de prazo
  const dias = daysAgo(marco);
  let cls = 'g';                                          // até a metade do prazo
  if (dias > prazo)            cls = 'r';                 // passou do prazo
  else if (dias >= prazo / 2)  cls = 'a';                // da metade até o prazo
  return '<span class="cap-dias ' + cls + '">' + dias + 'd</span>';
}

const CAP_ICO = {
  pin:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  bed:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/></svg>',
  area: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
  car:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
  clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  wa:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  bars: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  cal:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
};
function capCardHtml(c) {
  const tel  = (c.tel || '').replace(/\D/g, '');
  const addr = [c.rua, c.num].filter(Boolean).join(', ') + (c.apto ? ' · Apto ' + c.apto : '');
  const edificio = (c.condominio_id && (condominios.find(x => x.id === c.condominio_id)||{}).nome) || c.imovel || '';
  const bairro = [edificio, c.bairro].filter(Boolean).join(' · ');
  const dd = [c.dormitorios ? c.dormitorios + 'd' : null, c.suites ? c.suites + 's' : null].filter(Boolean).join(' · ');
  const vm2 = c.area_privativa && c.valor_pretendido ? c.valor_pretendido / c.area_privativa : 0;
  const nObs = Array.isArray(c.obs) ? c.obs.length : 0;

  let specs = '';
  if (dd)               specs += '<span>' + CAP_ICO.bed + dd + '</span>';
  if (c.vagas)          specs += '<span>' + CAP_ICO.car + c.vagas + 'v</span>';
  if (c.area_privativa) specs += '<span>' + CAP_ICO.area + c.area_privativa + 'm²</span>';
  if (vm2 > 0)          specs += '<span class="m2">' + fmtMoneyInt(vm2) + '/m²</span>';

  let foot = '';
  if (c.tel) foot += '<a href="https://wa.me/55' + tel + '" target="_blank" onclick="event.stopPropagation()" class="cap-badge wa">' + CAP_ICO.wa + c.tel + '</a>';
  if (c.conservacao && c.conservacao !== 'Padrão') foot += '<span class="cap-badge">' + c.conservacao + '</span>';
  if (c.restricao && c.restricao !== 'Nenhuma')    foot += '<span class="cap-badge alert">' + CAP_ICO.warn + c.restricao + '</span>';
  if (nObs > 0) foot += '<span class="cap-badge">' + nObs + ' nota' + (nObs !== 1 ? 's' : '') + '</span>';
  if (c.marcos && c.marcos.acm) foot += '<span class="cap-badge">' + CAP_ICO.bars + 'ACM ' + c.marcos.acm.split('-').reverse().join('/').slice(0,5) + '</span>';
  else if (c.marcos && c.marcos.acm_agendado && c.marcos.acm_agendado.data) foot += '<span class="cap-badge">' + CAP_ICO.cal + 'ACM ' + c.marcos.acm_agendado.data.split('-').reverse().join('/').slice(0,5) + '</span>';
  if (!c.owner || !c.tel || !c.rua || !c.num) foot += '<span class="cap-badge alert">' + CAP_ICO.warn + 'Incompleto</span>';
  foot += capDiasBadge(c);

  const btnAcm = '<button class="btn btn-sm" onclick="event.stopPropagation();openACMBuilder(\'' + c.id + '\')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>ACM</button>';
  const btnAssinar = (c.estagio === 'acm') ? '<button class="btn btn-sm" onclick="event.stopPropagation();marcarContratoAssinado(\'' + c.id + '\')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>Assinar</button>' : '';

  return '<div class="cap-card" data-id="' + c.id + '" onclick="openModal(\'' + c.id + '\')">' +
    '<div class="cap-card-owner">' + (c.owner || '—') + (c.tipo && c.tipo !== 'PF' ? ' <span class="pj">' + c.tipo + '</span>' : '') + '</div>' +
    (addr ? '<div class="cap-card-addr">' + CAP_ICO.pin + addr + '</div>' : '') +
    (bairro ? '<div class="cap-card-bairro">' + bairro + '</div>' : '') +
    (specs ? '<div class="cap-card-specs">' + specs + '</div>' : '') +
    (c.proxima_acao ? '<div class="cap-card-prox">' + CAP_ICO.clock + c.proxima_acao + '</div>' : '') +
    '<div class="cap-card-foot">' + foot + '</div>' +
    '<div class="cap-actions">' + btnAssinar + btnAcm + '</div>' +
  '</div>';
}

// 4a — "Contrato assinado": abre a ficha de contrato (gestão) pré-preenchida.
// Ao salvar a gestão, a graduação amarra os elos (ver salvarGestao → graduarContratoAssinado).
function marcarContratoAssinado(id) {
  if (!id) return;
  closeModal();
  openGestaoModal(null, id);
}

function togglePerdidos() {
  perdidoAberto = !perdidoAberto;
  document.getElementById('perdidoGrid').style.display = perdidoAberto ? '' : 'none';
  document.getElementById('perdidoArrow').textContent  = perdidoAberto ? '▾' : '▸';
}

// ── 4d.3 — Captação perdida (finalização) ─────────────────────────────────────
let perdidaCapId = null;
function openPerdidaModal(id) {
  if (!id) return;
  perdidaCapId = id;
  const c = imoveis.find(x => x.id === id) || {};
  const end = [c.rua, c.num].filter(Boolean).join(', ') + (c.apto ? ' · Apto ' + c.apto : '');
  document.getElementById('perdidaImovelInfo').innerHTML = '<strong>' + (c.owner || '—') + '</strong>' + (end ? ' · ' + end : (c.imovel ? ' · ' + c.imovel : ''));
  document.getElementById('fPerdidaData').value = todayISO();
  document.getElementById('fPerdidaMotivo').value = 'Proprietário desistiu de vender';
  setPerdidaDestino('aberto');
  document.getElementById('perdidaOverlay').classList.add('open');
}
function closePerdidaModal() {
  document.getElementById('perdidaOverlay').classList.remove('open');
  perdidaCapId = null;
}
function setPerdidaDestino(v) {
  document.getElementById('fPerdidaDestino').value = v;
  document.querySelectorAll('#perdidaDestinoSeg .status-opt').forEach(b => b.classList.toggle('on', b.dataset.v === v));
}
function onPerdidaMotivoChange() {
  // O motivo sugere o destino: "fechou com outro corretor" → Terceiros; demais → Aberto.
  const m = document.getElementById('fPerdidaMotivo').value;
  setPerdidaDestino(m === 'Fechou com outro corretor' ? 'terceiros' : 'aberto');
}
async function confirmarPerdida() {
  const id = perdidaCapId; if (!id) return;
  const motivo  = document.getElementById('fPerdidaMotivo').value;
  const destino = document.getElementById('fPerdidaDestino').value || 'aberto';
  const cap = imoveis.find(x => x.id === id) || {};
  if (!confirm('Marcar esta captação como perdida?\nMotivo: ' + motivo + '\nImóvel na Carteira → ' + (destino === 'terceiros' ? 'Terceiros' : 'Aberto'))) return;

  // 1) Captação vira 'perdido', carimba data + motivo no JSONB de marcos (sem migração).
  const marcos = Object.assign({}, cap.marcos || {});
  marcos.perdido = { data: document.getElementById('fPerdidaData').value || todayISO(), motivo };
  const { error: e1 } = await db().from('imoveis').update({ estagio: 'perdido', marcos, updated_at: new Date().toISOString() }).eq('id', id);
  if (e1) { toast('❌ ' + e1.message); return; }

  // 2) O imóvel (núcleo ligado) deixa de ser "em captação": vira publicável, com o status escolhido.
  const cart = (carteiraItems || []).find(x => x.pipeline_id === id);
  if (cart) {
    const updCart = { status: destino, exclusivo: false, publicavel: true, updated_at: new Date().toISOString() };
    if (!cart.anunciado_em) updCart.anunciado_em = todayISO();   // entra na vitrine agora
    await db().from('imoveis_carteira').update(updCart).eq('id', cart.id);
  }

  toast('Captação perdida — imóvel na Carteira como ' + (destino === 'terceiros' ? 'Terceiros' : 'Aberto'));
  closePerdidaModal();
  closeModal();
  await Promise.all([carregarImoveis(), carregarCarteira()]);
  enriquecerImoveis();
  if (typeof renderPipeline === 'function') renderPipeline();
  if (typeof filtrarCarteira === 'function') filtrarCarteira();
}

// ── Modal ─────────────────────────────────────────────────────────────────────
// ── Wizard de Captação: controla as etapas (criação) × tela única (edição) ──
function renderWizard() {
  const novo = capMode === 'novo';
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('capProgress', novo);
  show('capTag1', novo);
  show('capTag2', novo);
  if (novo) {
    show('capStep1', capStep === 1);
    show('capStep2', capStep === 2);
    show('capExtra', false);
    show('capCondManual', false);          // some até o usuário recusar o cartão
  } else {
    show('capStep1', true);
    show('capStep2', true);
    show('capExtra', true);
    show('capCondManual', true);           // edição = busca/criação manual visível
    show('capCondCard', false);
  }
  // segmentos da barra de progresso (só o passo atual fica laranja)
  const seg1 = document.getElementById('capSeg1'), seg2 = document.getElementById('capSeg2');
  if (seg1) seg1.classList.toggle('on', capStep === 1);
  if (seg2) seg2.classList.toggle('on', capStep === 2);
  // rodapé
  show('btnWizVoltar',  novo && capStep === 2);
  show('btnWizProximo', novo && capStep === 1);
  show('btnCancelar',   !novo || capStep === 1);
  show('btnSalvar',     !novo || capStep === 2);
  const bs = document.getElementById('btnSalvar');
  if (bs) bs.textContent = novo ? 'Salvar captação' : 'Salvar';
}
function wizGo(step) {
  // 6.10 — se digitou um nome na busca mas não escolheu, resolve como novo proprietário
  if (step === 2 && !document.getElementById('fOwner').value.trim()) {
    const q = document.getElementById('capPropSearch').value.trim();
    if (q) { capCriarNovo(q); }
  }
  if (step === 2 && !document.getElementById('fOwner').value.trim()) {
    toast('⚠️ Informe o proprietário (buscar ou criar)'); return;
  }
  capStep = step;
  renderWizard();
  const m = document.querySelector('#capOverlay .modal');
  if (m) m.scrollTop = 0;
  if (step === 2 && !capCondCards_resolved()) capResolveCond();
}
function capCondCards_resolved() {
  // já há cartão visível ou condomínio vinculado?
  const card = document.getElementById('capCondCard');
  return (card && card.style.display !== 'none') || !!capCondominioId || capCondominioNovo;
}

// ── Resolução do condomínio (base própria → ITBI), 5.12 ─────────────────────
function normRua(s) {
  return ('' + (s || '')).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}
function ruaKeyword(rua) {
  return normRua(rua).split(' ')
    .filter(w => !['RUA','AVENIDA','ALAMEDA','AV','AL','PRACA','PCA','TRAVESSA','TV','ESTRADA','EST','RODOVIA','VILA','VL','LARGO','LG'].includes(w))
    .join(' ').trim();
}

// ── Frente A (D-10/D-12) — duplicata de imóvel: busca no BANCO + cartão de aviso ──
// Busca em imoveis_carteira por endereço normalizado (rua por palavra-chave + número
// + complemento). NO BANCO, não na memória — a lista da tela pode estar desatualizada.
// Regra do complemento: dois complementos preenchidos e DIFERENTES = outro imóvel
// (não entra no aviso); um deles vazio = parecido (entra, o Alex decide).
// Normalizador da BUSCA DE DUPLICATA: além do que o ruaKeyword faz, tira pontuação
// e reconhece abreviações curtas ("R." = "Rua", "Av." = "Avenida"). Função própria
// para não mudar o comportamento do ruaKeyword usado na resolução de condomínio.
function dupRuaKey(rua) {
  return normRua(rua).replace(/[.,;]/g, ' ').replace(/\s+/g, ' ').trim().split(' ')
    .filter(w => !['RUA','R','AVENIDA','AV','ALAMEDA','AL','PRACA','PCA','PC','TRAVESSA','TV','ESTRADA','EST','RODOVIA','ROD','VILA','VL','LARGO','LG'].includes(w))
    .join(' ').trim();
}
async function dupBuscarImoveis(rua, num, compl, excluirCarteiraId) {
  const key  = dupRuaKey(rua || '');
  const numV = ('' + (num || '')).trim();
  if (!key || !numV) return [];
  const { data, error } = await db().from('imoveis_carteira')
    .select('*')
    .eq('numero', numV);
  if (error) { console.error('dupBuscarImoveis:', error); return []; }
  const c = normRua(compl || '');
  return (data || []).filter(r => {
    if (excluirCarteiraId && r.id === excluirCarteiraId) return false;
    if (dupRuaKey(r.rua || '') !== key) return false;
    const rc = normRua(r.complemento || '');
    if (c && rc && c !== rc) return false;
    return true;
  });
}
function dupImovelLabel(r) {
  const end = [r.rua, r.numero].filter(Boolean).join(', ') + (r.complemento ? ' ' + r.complemento : '');
  return (r.codigo ? r.codigo + ' — ' : '') + (end || '(sem endereço)') + (r.bairro ? ' · ' + r.bairro : '');
}
// Vendido/inativo (reaproveitar seria pior que duplicar) e imóvel já ligado a OUTRA
// captação (a trava do banco recusaria): o cartão avisa e não oferece "usar este".
function dupImovelTrava(r, pipelineIdAtual) {
  if (r.status === 'vendido')  return 'Vendido';
  if (r.status === 'inativo')  return 'Inativo';
  if (r.pipeline_id && r.pipeline_id !== pipelineIdAtual) return 'Já ligado a outra captação';
  return '';
}

const DUP_ICO_WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
const DUP_ICO_OK   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

// Cartão de aviso inline (Tela A.1, molde do capCondCard). Estados: escondido ·
// verificando · 1 achado · vários (até 3 + "ver todos") · confirmado ("usar este").
// Tudo montado por JS com textContent + addEventListener — texto de endereço nunca
// vira HTML nem comando (lição do D-1).
// "Abrir o que já existe": a ficha do imóvel é uma janela de fundo (z-index menor)
// e ficava atrás da janela de onde o botão foi clicado — o Alex clicava e parecia
// que nada tinha acontecido. Agora a janela de origem é RECOLHIDA (só some da tela;
// nada do que foi digitado é apagado, os campos continuam preenchidos) e volta
// intacta quando ele fecha a ficha do imóvel.
// ORDEM IMPORTA: a janela de origem só é recolhida DEPOIS que a ficha do imóvel
// abre de verdade. Se a ficha não abrir, o que o Alex digitou continua na tela e
// ele é avisado — nunca some sem volta (defeito 2 do QA da Rev 4).
let _dupJanelaOrigem = null;
async function dupAbrirFicha(imovelId, overlayOrigemId) {
  const view = document.getElementById('carteiraViewOverlay');
  const abriu = () => !!(view && view.classList.contains('open'));

  if (typeof openCarteiraView === 'function') await openCarteiraView(imovelId);

  // A lista de imóveis carregada na memória desta aba pode estar velha (aba aberta
  // há horas, imóvel cadastrado de outro aparelho). Nesse caso a ficha não abre:
  // busca a lista atualizada do banco e tenta mais uma vez.
  if (!abriu() && typeof carregarCarteira === 'function') {
    try {
      await carregarCarteira();
      if (typeof renderCarteira === 'function') renderCarteira();
      await openCarteiraView(imovelId);
    } catch (e) { /* segue para o aviso abaixo */ }
  }

  if (!abriu()) {
    if (typeof closeCarteiraView === 'function') closeCarteiraView();   // não deixa a ficha meio aberta por dentro
    toast('⚠️ Não deu para abrir esse imóvel agora. O que você preencheu continua aqui — recarregue a página e tente de novo.');
    return false;   // nada foi recolhido: o formulário do Alex segue na tela
  }

  const ov = document.getElementById(overlayOrigemId);
  if (ov && ov.classList.contains('open')) { ov.classList.remove('open'); _dupJanelaOrigem = overlayOrigemId; }
  return true;
}
// chamado ao fechar a ficha do imóvel: devolve a janela recolhida, do jeito que estava
function dupVoltarJanelaOrigem() {
  if (!_dupJanelaOrigem) return false;
  const ov = document.getElementById(_dupJanelaOrigem);
  _dupJanelaOrigem = null;
  if (ov) { ov.classList.add('open'); return true; }
  return false;
}
// o Alex seguiu para outro caminho (editar aquele imóvel, abrir negociação):
// a janela recolhida não volta mais
function dupEsquecerJanelaOrigem() { _dupJanelaOrigem = null; }
// qual janela está recolhida esperando volta (null = nenhuma)
function dupJanelaOrigemPendente() { return _dupJanelaOrigem; }

function dupCardEsconder(card) { if (card) { card.classList.remove('show', 'ok'); card.innerHTML = ''; card._expandido = false; } }
function dupCardChecando(card) {
  if (!card) return;
  card.classList.add('show'); card.classList.remove('ok');
  card.innerHTML = '<div class="dc-checking"><div class="spinner" style="width:14px;height:14px;border-width:2px"></div>Verificando se este endereço já está em Imóveis…</div>';
}
// acoes: { abrir(r), usar(r)?, criarNovo()?, criarNovoLabel?, textoTitulo? }
function dupCardMostrar(card, achados, acoes, pipelineIdAtual) {
  if (!card) return;
  card.classList.add('show'); card.classList.remove('ok');
  card.innerHTML = '';
  const head = document.createElement('div'); head.className = 'dc-head';
  head.innerHTML = DUP_ICO_WARN;
  const txt = document.createElement('div'); txt.className = 'dc-txt';
  const tit = document.createElement('div');
  tit.textContent = acoes.textoTitulo || (achados.length === 1
    ? 'Este endereço já está em Imóveis:'
    : 'Este endereço já está em Imóveis (' + achados.length + ' parecidos):');
  txt.appendChild(tit);
  const max = card._expandido ? achados.length : 3;
  achados.slice(0, max).forEach(r => {
    const item = document.createElement('div'); item.className = 'dc-item';
    const b = document.createElement('strong'); b.textContent = dupImovelLabel(r);
    item.appendChild(b);
    const trava = dupImovelTrava(r, pipelineIdAtual || null);
    if (trava) { const st = document.createElement('span'); st.className = 'dc-status'; st.textContent = trava; item.appendChild(st); }
    const btns = document.createElement('div'); btns.className = 'dc-btns';
    const bAbrir = document.createElement('button');
    bAbrir.type = 'button'; bAbrir.className = 'btn btn-ghost btn-sm'; bAbrir.textContent = 'Abrir o que já existe';
    bAbrir.addEventListener('click', () => acoes.abrir(r));
    btns.appendChild(bAbrir);
    if (acoes.usar && !trava) {
      const bUsar = document.createElement('button');
      bUsar.type = 'button'; bUsar.className = 'btn btn-primary btn-sm'; bUsar.textContent = 'É o mesmo — usar este';
      bUsar.addEventListener('click', () => acoes.usar(r));
      btns.appendChild(bUsar);
    }
    item.appendChild(btns);
    txt.appendChild(item);
  });
  if (achados.length > 3 && !card._expandido) {
    const mais = document.createElement('span'); mais.className = 'dc-mais';
    mais.textContent = 'Ver todos (' + achados.length + ')';
    mais.addEventListener('click', () => { card._expandido = true; dupCardMostrar(card, achados, acoes, pipelineIdAtual); });
    txt.appendChild(mais);
  }
  if (acoes.criarNovo) {
    const rod = document.createElement('div'); rod.className = 'dc-btns';
    const bNovo = document.createElement('button');
    bNovo.type = 'button'; bNovo.className = 'btn btn-ghost btn-sm';
    bNovo.textContent = acoes.criarNovoLabel || 'É outro imóvel — criar novo';
    bNovo.addEventListener('click', () => acoes.criarNovo());
    rod.appendChild(bNovo);
    txt.appendChild(rod);
  }
  head.appendChild(txt);
  card.appendChild(head);
}
function dupCardConfirmado(card, texto, desfazer) {
  if (!card) return;
  card.classList.add('show', 'ok');
  card.innerHTML = '';
  const head = document.createElement('div'); head.className = 'dc-head';
  head.innerHTML = DUP_ICO_OK;
  const txt = document.createElement('div'); txt.className = 'dc-txt';
  const t = document.createElement('div'); t.textContent = texto; txt.appendChild(t);
  if (desfazer) {
    const rod = document.createElement('div'); rod.className = 'dc-btns';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn-ghost btn-sm'; b.textContent = 'Desfazer';
    b.addEventListener('click', () => desfazer());
    rod.appendChild(b);
    txt.appendChild(rod);
  }
  head.appendChild(txt);
  card.appendChild(head);
}

// ── Estado do cartão na CAPTAÇÃO (Tela A.2) ──────────────────────────────────
let capDup = { achados: [], escolhido: null, criarNovo: false, chave: '' };
let _capDupTimer = null;
function capDupChaveAtual() {
  const gv = id => (document.getElementById(id)?.value || '').trim();
  return dupRuaKey(gv('fRua')) + '|' + gv('fNum') + '|' + normRua(gv('fApto'));
}
function capDupReset() {
  capDup = { achados: [], escolhido: null, criarNovo: false, chave: '' };
  dupCardEsconder(document.getElementById('capDupCard'));
}
// Debounce ~400ms; só verifica com rua E número preenchidos, e só quando a captação
// ainda não tem espelho ligado. Mudou o endereço → decisão anterior ("é outro"/"usar
// este") é descartada e o cartão volta a valer.
function capDupAgendar() {
  const chave = capDupChaveAtual();
  if (chave !== capDup.chave) { capDup.escolhido = null; capDup.criarNovo = false; }
  clearTimeout(_capDupTimer);
  _capDupTimer = setTimeout(capDupVerificar, 400);
}
function capDupTemEspelho() {
  return !!(editId && (carteiraItems || []).some(c => c.pipeline_id === editId));
}
async function capDupVerificar() {
  const card = document.getElementById('capDupCard');
  if (!card) return;
  const rua  = (document.getElementById('fRua')?.value || '').trim();
  const num  = (document.getElementById('fNum')?.value || '').trim();
  const apto = (document.getElementById('fApto')?.value || '').trim();
  if (capDupTemEspelho() || !rua || !num) { capDup.achados = []; capDup.chave = capDupChaveAtual(); dupCardEsconder(card); return; }
  const chave = capDupChaveAtual();
  dupCardChecando(card);
  const achados = await dupBuscarImoveis(rua, num, apto, null);
  if (chave !== capDupChaveAtual()) return;   // endereço mudou enquanto buscava
  capDup.achados = achados; capDup.chave = chave;
  capDupRender();
}
function capDupRender() {
  const card = document.getElementById('capDupCard');
  if (!card) return;
  if (capDup.escolhido) {
    dupCardConfirmado(card,
      'Vai reaproveitar ' + dupImovelLabel(capDup.escolhido) + ' — a captação será ligada a ele, nada novo será criado.',
      () => { capDup.escolhido = null; capDupRender(); });
    return;
  }
  if (capDup.criarNovo || !capDup.achados.length) { dupCardEsconder(card); return; }
  dupCardMostrar(card, capDup.achados, {
    // recolhe o modal da captação (sem perder o que foi digitado) e abre a ficha
    abrir: r => dupAbrirFicha(r.id, 'capOverlay'),
    usar:  r => { capDup.escolhido = r; capDupRender(); },
    criarNovo: () => { capDup.criarNovo = true; capDupRender(); },
  }, editId ? editId : null);
}
async function capResolveCond() {
  if (capMode !== 'novo') return;               // só no wizard de criação
  // não atropela escolha já feita pelo usuário
  if (capCondominioId || capCondominioNovo) return;
  const rua = document.getElementById('fRua').value.trim();
  const num = document.getElementById('fNum').value.trim();
  const card = document.getElementById('capCondCard');
  capCondCands = []; capCondIdx = 0;
  card.style.display = 'none';
  if (!rua) return;
  const key = ruaKeyword(rua);
  if (!key) return;
  const cands = [];
  // 1) base própria de condomínios
  condominios.forEach(c => {
    if (c.rua && normRua(c.rua).includes(key) && (!num || ('' + (c.num || '')).trim() === num)) {
      cands.push({ source: 'own', id: c.id, nome: c.nome, bairro: c.bairro, rua: c.rua, num: c.num });
    }
  });
  // 2) ITBI (somente leitura — nunca grava)
  try {
    await loadITBIdb();
    let sql = `SELECT referencia, bairro, COUNT(*) as total
               FROM vendas WHERE logradouro_norm LIKE '%${key.replace(/'/g, "''")}%'`;
    if (num) sql += ` AND numero = '${num.replace(/'/g, "''")}'`;
    sql += ` AND ${ITBI_SQL_ANO} GROUP BY referencia, bairro ORDER BY total DESC LIMIT 5`;
    const res = itbiDB.exec(sql);
    if (res.length && res[0].values.length) {
      res[0].values.forEach(r => {
        const ref = (r[0] || '').trim();
        if (!ref) return;
        // evita repetir um edifício que já veio da base própria
        if (cands.some(x => normRua(x.nome) === normRua(ref))) return;
        // nome/bairro entram crus, como vêm do ITBI — este candidato pode virar dado gravado (decisão do Alex 26/07)
        cands.push({ source: 'itbi', nome: ref, bairro: r[1] || '', rua, num });
      });
    }
  } catch (e) { console.error('ITBI resolve:', e); }
  capCondCands = cands;
  capCondIdx = 0;
  if (cands.length) mostrarCartaoCond(cands[0]);
  // sem candidatos: cartão fica oculto → ao salvar cria condomínio incompleto da rua/número/edifício
}
function mostrarCartaoCond(cand) {
  const card = document.getElementById('capCondCard');
  document.getElementById('capCondCardSrc').textContent  = cand.source === 'own' ? 'condomínio (base):' : 'condomínio (ITBI):';
  document.getElementById('capCondCardNome').innerHTML   = '<strong>' + escOpc(cand.nome) + '</strong>' + (cand.bairro ? ' · ' + escOpc(cand.bairro) : '');
  document.getElementById('capCondCardBtns').style.display = '';
  card.classList.remove('ok');
  card.style.display = '';
}
function capCondConfirmar() {
  const c = capCondCands[capCondIdx];
  if (!c) return;
  if (c.source === 'own') {
    capCondominioId   = c.id;
    capCondominioNovo = false;
    document.getElementById('fCondominioId').value = c.id;
  } else {
    // ITBI: cria só ao salvar, na base do Alex OS — prepara o mini-form que salvarImovel lê
    capCondominioId   = null;
    capCondominioNovo = true;
    document.getElementById('fCondominioId').value     = '';
    document.getElementById('capCondNome').value       = c.nome;
    document.getElementById('capCondRua').value        = document.getElementById('fRua').value.trim();
    document.getElementById('capCondNum').value        = document.getElementById('fNum').value.trim();
    document.getElementById('capCondBairroNovo').value = c.bairro || document.getElementById('fBairro').value.trim() || '';
  }
  // autopreenche edifício/bairro do imóvel se vazios
  if (!document.getElementById('fImovel').value.trim()) document.getElementById('fImovel').value = c.nome;
  if (c.bairro && !document.getElementById('fBairro').value.trim()) document.getElementById('fBairro').value = c.bairro;
  // cartão em estado confirmado
  const card = document.getElementById('capCondCard');
  document.getElementById('capCondCardSrc').textContent = '✓';
  document.getElementById('capCondCardNome').innerHTML  = '<strong>' + escOpc(c.nome) + '</strong>' + (c.bairro ? ' · ' + escOpc(c.bairro) : '');
  document.getElementById('capCondCardBtns').style.display = 'none';
  card.classList.add('ok');
}
function capCondRejeitar() {
  capCondIdx++;
  if (capCondIdx < capCondCands.length) {
    mostrarCartaoCond(capCondCands[capCondIdx]);
    return;
  }
  // candidatos esgotados → busca/criação manual
  document.getElementById('capCondCard').style.display = 'none';
  document.getElementById('capCondManual').style.display = '';
  capClearCond();
}

function openModal(id) {
  editId = id || null;
  const c = id ? imoveis.find(x => x.id === id) : null;
  document.getElementById('capModalTitulo').textContent = c ? 'Editar Imóvel' : 'Nova Captação';
  capMode = c ? 'edit' : 'novo';
  capStep = 1;
  capCondCands = []; capCondIdx = 0;
  document.getElementById('capCondCard').style.display = 'none';
  capDupReset();   // Frente A: cartão de duplicidade limpo a cada abertura

  // Garante lista de pessoas carregada
  carregarPessoas();

  // Reset vínculo proprietário
  capPessoaId = null;
  document.getElementById('fPessoaId').value  = '';
  document.getElementById('capPropSearch').value = '';
  document.getElementById('capPropDrop').style.display = 'none';
  document.getElementById('capPropSel').style.display  = 'none';

  // Reset vínculo condomínio
  capCondominioId   = null;
  capCondominioNovo = false;
  document.getElementById('fCondominioId').value  = '';
  document.getElementById('capCondSearch').value  = '';
  document.getElementById('capCondDrop').style.display  = 'none';
  document.getElementById('capCondSel').style.display   = 'none';
  document.getElementById('capCondMiniForm').style.display = 'none';
  document.getElementById('capItbiInfo').style.display  = 'none';

  // Se editando, pré-preenche vínculos existentes (6.10: sempre resolve p/ uma pessoa)
  document.getElementById('capPropDetalhes').style.display = 'none';
  if (c?.pessoa_id) {
    carregarPessoas().then(() => {
      const p = pessoasAll.find(x => x.id === c.pessoa_id);
      if (p) capSelectProp(p.id, p.nome, p.tel||'', p.email||'');
      else if (c.owner) capLegacyOwner(c.owner);
    });
  } else if (c?.owner) {
    capLegacyOwner(c.owner);   // captação antiga sem pessoa → ao salvar vira pessoa
  }
  if (c?.condominio_id) {
    const cond = condominios.find(x => x.id === c.condominio_id);
    if (cond) capSelectCond(cond.id, cond.nome);
  }

  document.getElementById('fOwner').value          = c?.owner           || '';
  document.getElementById('fTipo').value           = c?.tipo            || 'PF';
  document.getElementById('fTel').value            = c?.tel             || '';
  document.getElementById('fEmail').value          = c?.email           || '';
  document.getElementById('fConjuge').value        = c?.nome_conjuge    || '';
  document.getElementById('fTelConjuge').value     = c?.tel_conjuge     || '';
  document.getElementById('fContatoPrincipal').value = c?.contato_principal || 'proprietario';
  document.getElementById('fRua').value            = c?.rua             || '';
  document.getElementById('fNum').value            = c?.num             || '';
  document.getElementById('fApto').value           = c?.apto            || '';
  document.getElementById('fImovel').value         = c?.imovel          || '';
  document.getElementById('fBairro').value         = c?.bairro          || '';
  document.getElementById('fD').value              = c?.dormitorios     || '';
  document.getElementById('fS').value              = c?.suites          || '';
  document.getElementById('fV').value              = c?.vagas           || '';
  document.getElementById('fArea').value           = c?.area_privativa  || '';
  setCur('fValor', c?.valor_pretendido);
  // Tipologia vem da carteira ligada (núcleo); Conservação fica no imóvel
  const _cartLig = (carteiraItems || []).find(ci => ci.pipeline_id === c?.id);
  preencherSelectOpcoes('fTipologia',   'tipologia',   _cartLig?.tipo  || '');
  preencherSelectOpcoes('fConservacao', 'conservacao', c?.conservacao  || '');
  document.getElementById('fOcupacao').value       = c?.ocupacao        || 'Ocupado';
  document.getElementById('fRestricao').value      = c?.restricao       || 'Nenhuma';
  document.getElementById('fCartorio').value       = c?.matricula_cartorio || '';
  document.getElementById('fMatricula').value      = c?.matricula_num   || '';
  document.getElementById('fAreaReal').value       = c?.area_real_reg   || '';
  document.getElementById('fMatriculaData').value  = c?.matricula_data  || '';
  setCur('fCondMensal', c?.condominio_mensal);
  setCur('fIPTU', c?.iptu_anual);
  document.getElementById('fOrigem').value         = c?.origem          || 'Captação ativa';

  calcVm2();
  toggleConjuge();

  const estagio = c?.estagio || 'prospeccao';
  document.getElementById('fEstagio').value = estagio;
  renderStageSel(estagio);
  document.getElementById('fProxAcao').value = c?.proxima_acao || '';
  editMarcos = (c && c.marcos && typeof c.marcos === 'object') ? { ...c.marcos } : {};
  // 5.1 — datas & agenda
  const _h = editMarcos.horarios || {};
  const _ag = editMarcos.acm_agendado || {};
  document.getElementById('fMarcoProspeccao').value = editMarcos.prospeccao || '';
  document.getElementById('fMarcoVisita1').value    = editMarcos.visita1 || '';
  document.getElementById('fHoraVisita1').value     = _h.visita1 || '';
  document.getElementById('fMarcoAcm').value        = editMarcos.acm || '';
  document.getElementById('fHoraAcm').value         = _h.acm || '';
  document.getElementById('fAcmAgendadoData').value = _ag.data || '';
  document.getElementById('fAcmAgendadoHora').value = _ag.hora || '';
  updateAcmApresentadoVis();

  editObs = Array.isArray(c?.obs) ? [...c.obs] : [];
  renderObs();
  document.getElementById('fObsNova').value = '';
  document.getElementById('btnDel').style.display = c ? '' : 'none';
  document.getElementById('btnVerACM').style.display = (c && acmItems.find(a => a.imovel_id === c.id)) ? '' : 'none';
  document.getElementById('btnContratoAssinado').style.display = (c && c.estagio !== 'assinado' && c.estagio !== 'perdido') ? '' : 'none';
  document.getElementById('btnCaptacaoPerdida').style.display = (c && c.estagio !== 'assinado' && c.estagio !== 'perdido') ? '' : 'none';
  renderWizard();
  document.getElementById('capOverlay').classList.add('open');
  setTimeout(() => {
    document.getElementById('fOwner').focus();
    setupRuaNumACById('fRua','fNum');
    AlexMasks.applyMasks(document.getElementById('capOverlay'));
    // Frente A: verificação de duplicidade com atraso de digitação (~400ms)
    ['fRua', 'fNum', 'fApto'].forEach(fid => {
      const el = document.getElementById(fid);
      if (el && !el._dupHook) { el._dupHook = true; el.addEventListener('input', capDupAgendar); }
    });
    if (capMode === 'edit') capDupAgendar();   // edição antiga sem espelho também confere
  }, 50);
}

function openModalStage(sid) {
  openModal(null);
  selectStage(sid);
}

function closeModal() {
  document.getElementById('capOverlay').classList.remove('open');
  editId  = null;
  editObs = [];
}

async function salvarEAbrirACM() {
  const id = editId;
  if (!id) return;
  await salvarImovel();
  // Se o modal fechou (salvo com sucesso), abre a ACM
  if (!document.getElementById('capOverlay').classList.contains('open')) {
    setTimeout(() => openACMBuilder(id), 150);
  }
}

// ── Nova Captação — Proprietário (6.10: campo único buscar-ou-criar) ─────────
function capEscA(s){ return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
// Descreve a que um contato já está ligado (p/ o usuário ter certeza ao deduplicar)
function capPropContexto(pid) {
  const cap = (typeof imoveis!=='undefined' ? imoveis : []).find(im => im.pessoa_id === pid);
  if (cap) return 'já é proprietário' + (cap.imovel || cap.rua ? ' de ' + (cap.imovel || cap.rua) : '');
  const p = pessoasAll.find(x => x.id === pid);
  if (p && Array.isArray(p.tipos) && p.tipos.length) return p.tipos.join('/').toLowerCase();
  return 'contato existente';
}
function capSearchProp(q) {
  const drop = document.getElementById('capPropDrop');
  q = (q || '').trim();
  if (q.length < 2) { drop.style.display = 'none'; return; }
  const low = q.toLowerCase();
  const hits = pessoasAll.filter(p => p.nome && p.nome.toLowerCase().includes(low)).slice(0, 8);
  let html = hits.map(p =>
    `<div onclick="capSelectProp('${capEscA(p.id)}','${capEscA(p.nome)}','${capEscA(p.tel||'')}','${capEscA(p.email||'')}')"`+
    ` style="padding:8px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)">`+
    `<strong>${p.nome}</strong>${p.tel ? ' · ' + p.tel : ''}`+
    `<div style="color:var(--muted);font-size:11px">${capPropContexto(p.id)}</div></div>`
  ).join('');
  html += `<div onclick="capCriarNovo('${capEscA(q)}')" style="padding:9px 10px;cursor:pointer;font-size:13px;color:var(--accent);font-weight:600"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Criar "${q}" como novo proprietário</div>`;
  drop.innerHTML = html;
  drop.style.display = '';
}
function capShowChip(nome, kind, kindTxt) {
  const sel = document.getElementById('capPropSel');
  document.getElementById('capPropSelTxt').textContent  = nome;
  document.getElementById('capPropSelKind').textContent = kindTxt ? '· ' + kindTxt : '';
  const ok = kind === 'exist';
  sel.style.background = ok ? 'var(--success-pale)' : 'var(--accent-pale)';
  sel.style.border     = '1px solid ' + (ok ? 'var(--success)' : 'var(--accent)');
  sel.style.color      = ok ? '#5fd98a' : 'var(--accent)';
  sel.style.display    = 'flex';
}
function capSelectProp(id, nome, tel, email) {
  capPessoaId = id; capPropNovo = null; capPropEditOpen = false;
  document.getElementById('fPessoaId').value = id;
  document.getElementById('fOwner').value    = nome;
  document.getElementById('capPropDrop').style.display = 'none';
  document.getElementById('capPropSearch').value = '';
  if (tel)   document.getElementById('fTel').value   = tel;
  if (email) document.getElementById('fEmail').value = email;
  capShowChip(nome, 'exist', 'contato existente');
  document.getElementById('capPropDetalhes').style.display = 'none';
  document.getElementById('capPropEditBtn').style.display  = '';   // existente: pode editar
}
// Escolheu "criar novo" — dedup por nome exato (pergunta), senão entra em modo novo
function capCriarNovo(nome) {
  nome = (nome || '').trim(); if (!nome) return;
  const low = nome.toLowerCase();
  const exato = pessoasAll.find(p => (p.nome||'').trim().toLowerCase() === low);
  if (exato) {
    if (confirm('Já existe "' + exato.nome + '" (' + capPropContexto(exato.id) + ').\n\nÉ a mesma pessoa?\n\nOK = vincular a esse contato\nCancelar = criar um novo mesmo assim')) {
      capSelectProp(exato.id, exato.nome, exato.tel||'', exato.email||''); return;
    }
  }
  capNovoModo(nome, 'novo contato será criado ao salvar');
}
// Coloca a tela em modo "novo proprietário" (campos abertos p/ preencher)
function capNovoModo(nome, kindTxt) {
  capPessoaId = null; capPropNovo = nome; capPropEditOpen = true;
  document.getElementById('fPessoaId').value = '';
  document.getElementById('fOwner').value    = nome;
  document.getElementById('capPropDrop').style.display = 'none';
  document.getElementById('capPropSearch').value = '';
  capShowChip(nome, 'novo', kindTxt);
  document.getElementById('capPropDetalhes').style.display = '';
  document.getElementById('capPropEditBtn').style.display  = 'none';  // já está aberto
}
// Captação antiga (tem owner em texto, sem pessoa) — ao salvar vira pessoa
function capLegacyOwner(nome) { capNovoModo(nome, 'sem contato — será criado ao salvar'); }
function capToggleDetalhes() {
  const d = document.getElementById('capPropDetalhes');
  capPropEditOpen = (d.style.display === 'none');
  d.style.display = capPropEditOpen ? '' : 'none';
}
function capClearProp() {
  capPessoaId = null; capPropNovo = null; capPropEditOpen = false;
  document.getElementById('fPessoaId').value = '';
  document.getElementById('fOwner').value    = '';
  document.getElementById('fTel').value      = '';
  document.getElementById('fEmail').value    = '';
  document.getElementById('capPropSel').style.display = 'none';
  document.getElementById('capPropSearch').value = '';
  document.getElementById('capPropDetalhes').style.display = 'none';
}

// ── Nova Captação — Condomínio ──────────────────────────────────────────────
function capSearchCond(q) {
  const drop = document.getElementById('capCondDrop');
  if (!q || q.length < 2) { drop.style.display = 'none'; return; }
  const low = q.toLowerCase();
  const hits = condominios.filter(c =>
    (c.nome && c.nome.toLowerCase().includes(low)) ||
    (c.rua  && c.rua.toLowerCase().includes(low))
  ).slice(0, 8);
  if (!hits.length) { drop.style.display = 'none'; return; }
  drop.innerHTML = hits.map(c =>
    `<div onclick="capSelectCond('${c.id}','${(c.nome||'').replace(/'/g,"\\'")}')"`+
    ` style="padding:8px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)">`+
    `<strong>${c.nome}</strong>${c.bairro ? ' · ' + c.bairro : ''}${c.rua ? ' · ' + c.rua : ''}</div>`
  ).join('');
  drop.style.display = '';
}
function capSelectCond(id, nome) {
  capCondominioId   = id;
  capCondominioNovo = false;
  document.getElementById('fCondominioId').value = id;
  document.getElementById('capCondDrop').style.display = 'none';
  document.getElementById('capCondSearch').value = '';
  document.getElementById('capCondSelTxt').textContent = nome;
  document.getElementById('capCondSel').style.display  = '';
  document.getElementById('capCondMiniForm').style.display = 'none';
  // Auto-preenche rua/bairro do imóvel — sempre sobrescreve com dados do condomínio selecionado
  const cond = condominios.find(c => c.id === id);
  if (cond) {
    const fRua    = document.getElementById('fRua');
    const fNum    = document.getElementById('fNum');
    const fBairro = document.getElementById('fBairro');
    const fImovel = document.getElementById('fImovel');
    if (cond.rua)    fRua.value    = cond.rua;
    if (cond.num)    fNum.value    = cond.num;
    if (cond.bairro) fBairro.value = cond.bairro;
    if (cond.nome)   fImovel.value = cond.nome;
  }
}
function capClearCond() {
  capCondominioId   = null;
  capCondominioNovo = false;
  document.getElementById('fCondominioId').value = '';
  document.getElementById('capCondSel').style.display = 'none';
  document.getElementById('capCondSearch').value = '';
}
function capToggleMiniCond() {
  const f = document.getElementById('capCondMiniForm');
  const open = f.style.display !== 'none';
  f.style.display = open ? 'none' : '';
  if (!open) {
    capCondominioId   = null;
    capCondominioNovo = true;
    document.getElementById('fCondominioId').value = '';
    document.getElementById('capCondSel').style.display = 'none';
  } else {
    capCondominioNovo = false;
  }
}
function capCondAutoFill() {
  // Preenche rua/num/bairro do imóvel conforme digitado no mini-form
  const rua    = document.getElementById('capCondRua').value.trim();
  const num    = document.getElementById('capCondNum').value.trim();
  const bairro = document.getElementById('capCondBairroNovo').value.trim();
  if (rua    && !document.getElementById('fRua').value)    document.getElementById('fRua').value    = rua;
  if (num    && !document.getElementById('fNum').value)    document.getElementById('fNum').value    = num;
  if (bairro && !document.getElementById('fBairro').value) document.getElementById('fBairro').value = bairro;
}
async function capItbiLookup() {
  const rua = document.getElementById('capCondRua').value.trim();
  const num = document.getElementById('capCondNum').value.trim();
  const el  = document.getElementById('capItbiInfo');
  if (!rua) { toast('⚠️ Informe a rua para buscar no ITBI'); return; }
  el.textContent = 'Carregando ITBI…';
  el.style.display = '';
  try {
    await loadITBIdb();
    // Normaliza rua: uppercase, remove acentos para comparação
    const norm = rua.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    const keyword = norm.split(/\s+/).filter(w => !['RUA','AVENIDA','ALAMEDA','AV','AL'].includes(w)).join(' ');
    let sql = `SELECT referencia, bairro, COUNT(*) as total, ROUND(AVG(valor_m2),0) as vm2_medio
               FROM vendas
               WHERE logradouro_norm LIKE '%${keyword}%'`;
    if (num) sql += ` AND numero = '${num}'`;
    sql += ` AND ${ITBI_SQL_ANO} GROUP BY referencia, bairro ORDER BY total DESC LIMIT 5`;
    const res = itbiDB.exec(sql);
    if (!res.length || !res[0].values.length) {
      el.textContent = 'Nenhum registro ITBI encontrado para esse endereço.';
      return;
    }
    const rows = res[0].values;
    el.innerHTML = '<strong>Encontrado no ITBI:</strong><br>' +
      rows.map(r => `${titleRua(r[0])||'(sem nome)'} — ${titleRua(r[1])} · ${r[2]} vendas · R$${Number(r[3]).toLocaleString('pt-BR')}/m²`).join('<br>');
    // Auto-preenche nome do condomínio se campo vazio e resultado único
    if (rows.length === 1 && !document.getElementById('capCondNome').value) {
      document.getElementById('capCondNome').value = rows[0][0] || '';
    }
  } catch(e) {
    el.textContent = 'Erro ao consultar ITBI: ' + e.message;
  }
}

function toggleConjuge() {
  const tipo = document.getElementById('fTipo').value;
  document.getElementById('conjuWrap').style.display = tipo === 'Casal' ? '' : 'none';
}

function calcVm2() {
  const area  = parseFloat(document.getElementById('fArea').value)  || 0;
  const valor = parseCur(document.getElementById('fValor').value) || 0;
  document.getElementById('fVm2').value = (area > 0 && valor > 0) ? fmtMoneyInt(valor / area) : '';
}

function renderStageSel(activeId) {
  // 4d.3 — "Perdido" deixa de ser chip de etapa (era fácil clicar sem querer);
  // virou ação dedicada no rodapé (botão "Captação perdida" → openPerdidaModal).
  const all = [...STAGES];
  document.getElementById('stageSel').innerHTML = all.map(s =>
    '<div class="stage-step ' + (s.id === activeId ? 'active' : '') + '" ' +
      'onclick="selectStage(\'' + s.id + '\')" ' +
      'style="' + (s.id === activeId ? 'border-color:' + s.color + ';color:' + s.color + ';background:' + s.color + '18' : '') + '">' +
      s.icon + ' ' + s.label +
    '</div>'
  ).join('');
}

function selectStage(id) {
  document.getElementById('fEstagio').value = id;
  renderStageSel(id);
}

// 5.1 — Revela "Já apresentei o ACM" só quando a data/hora agendada passou (ou já há registro/estágio ACM+).
function updateAcmApresentadoVis() {
  const row = document.getElementById('acmApresentadoRow'); if (!row) return;
  const apres = document.getElementById('fMarcoAcm').value;
  const agd   = document.getElementById('fAcmAgendadoData').value;
  const agh   = document.getElementById('fAcmAgendadoHora').value;
  const est   = document.getElementById('fEstagio').value;
  let venceu = false;
  if (agd) venceu = new Date(agd + 'T' + (agh || '23:59')) <= new Date();
  row.style.display = (apres || venceu || est === 'acm' || est === 'assinado') ? '' : 'none';

  // Estado do botão: acende quando passou a hora e ainda não foi marcado; vira "feito" quando há data.
  const btn = document.getElementById('btnAcmApresentado'); if (!btn) return;
  if (apres) {
    btn.className = 'btn btn-sm';
    btn.style.cssText = 'white-space:nowrap;align-self:flex-end;background:var(--success);border-color:var(--success);color:#fff';
    btn.textContent = '✓ Apresentado em ' + apres.split('-').reverse().join('/').slice(0,5);
  } else if (venceu) {
    btn.className = 'btn btn-primary btn-sm';
    btn.style.cssText = 'white-space:nowrap;align-self:flex-end';
    btn.textContent = '✓ Marcar apresentado';
  } else {
    btn.className = 'btn btn-ghost btn-sm';
    btn.style.cssText = 'white-space:nowrap;align-self:flex-end';
    btn.textContent = '✓ Apresentado';
  }
}

// 5.1 — "ACM apresentado": carimba a data do marco (usa a agendada como padrão) e move pra etapa ACM.
function marcarAcmApresentado() {
  const agd = document.getElementById('fAcmAgendadoData').value;
  const agh = document.getElementById('fAcmAgendadoHora').value;
  const campoAcm = document.getElementById('fMarcoAcm');
  if (!campoAcm.value) campoAcm.value = agd || todayISO();
  if (agh && !document.getElementById('fHoraAcm').value) document.getElementById('fHoraAcm').value = agh;
  selectStage('acm');
  updateAcmApresentadoVis();
  toast('ACM marcado como apresentado — confira a data e salve');
}

function renderObs() {
  const el = document.getElementById('obsLog');
  if (!editObs.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:4px 0">Nenhuma nota ainda.</div>';
    return;
  }
  el.innerHTML = [...editObs].reverse().map(e =>
    '<div class="obs-entry">' +
      '<div class="obs-entry-ts">' + fmtTS(e.ts) + '</div>' +
      '<div class="obs-entry-text">' + e.text + '</div>' +
    '</div>'
  ).join('');
}

function addObs() {
  const text = document.getElementById('fObsNova').value.trim();
  if (!text) return;
  editObs.push({ ts: new Date().toISOString(), text });
  document.getElementById('fObsNova').value = '';
  renderObs();
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
let _capSalvando = false;   // guarda anti-duplo-clique (dois cliques = duas captações + dois espelhos)
async function salvarImovel() {
  if (_capSalvando) return;
  _capSalvando = true;
  try { await _salvarImovelInner(); } finally { _capSalvando = false; }
}
async function _salvarImovelInner() {
  // Resolve nome do proprietário e valida ANTES de criar qualquer registro
  if (capPessoaId && !document.getElementById('fOwner').value.trim()) {
    const p = pessoasAll.find(x => x.id === capPessoaId);
    if (p?.nome) document.getElementById('fOwner').value = p.nome;
  }
  // 6.10 — nome digitado na busca sem ter escolhido → resolve como novo
  if (!document.getElementById('fOwner').value.trim()) {
    const q = document.getElementById('capPropSearch').value.trim();
    if (q) capCriarNovo(q);
  }
  const owner = document.getElementById('fOwner').value.trim();
  if (!owner) { toast('⚠️ Informe o proprietário (buscar ou criar)'); return; }

  // Frente A (D-10): endereço que já existe em Imóveis precisa estar RESOLVIDO no
  // cartão antes de gravar qualquer coisa (pessoa, condomínio, captação, espelho).
  // Conferência na hora do salvar, direto no banco — não confia no estado da tela.
  if (!capDupTemEspelho() && !capDup.escolhido && !capDup.criarNovo) {
    const ruaV  = document.getElementById('fRua').value.trim();
    const numV  = document.getElementById('fNum').value.trim();
    const aptoV = document.getElementById('fApto').value.trim();
    if (ruaV && numV) {
      const achados = await dupBuscarImoveis(ruaV, numV, aptoV, null);
      if (achados.length) {
        capDup.achados = achados; capDup.chave = capDupChaveAtual();
        capDupRender();
        // Sem toast aqui (QA Rev 3, menor 2): o cartão inline É o aviso —
        // toast do canto fica só para sucesso (regra da seção C do 03_UXUI).
        const card = document.getElementById('capDupCard');
        if (card && card.scrollIntoView) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
    }
  }

  // 6.10 — o proprietário é SEMPRE uma pessoa: cria nova (dedup por nome exato) ou atualiza a vinculada
  const propTel   = document.getElementById('fTel').value.trim()   || null;
  const propEmail = document.getElementById('fEmail').value.trim() || null;
  if (!capPessoaId) {
    const low = owner.toLowerCase();
    const exato = pessoasAll.find(p => (p.nome||'').trim().toLowerCase() === low);
    if (exato) {
      capPessoaId = exato.id;
    } else {
      const { data: np, error: npErr } = await db().from('pessoas')
        .insert({ nome: owner, tel: propTel, email: propEmail, tipos: ['Proprietário'] }).select().single();
      if (npErr) { toast('❌ Erro ao criar proprietário: ' + npErr.message); return; }
      capPessoaId = np.id; pessoasAll.push(np);
    }
  } else if (capPropEditOpen) {
    // editou os dados de um contato vinculado → atualiza o contato no sistema todo (decisão do Alex)
    await db().from('pessoas').update({ tel: propTel, email: propEmail, updated_at: new Date().toISOString() }).eq('id', capPessoaId);
    const p = pessoasAll.find(x => x.id === capPessoaId);
    if (p) { p.tel = propTel; p.email = propEmail; }
  }
  document.getElementById('fPessoaId').value = capPessoaId || '';

  // Se tem novo condomínio preenchido, cria primeiro
  if (capCondominioNovo) {
    const nomeC = document.getElementById('capCondNome').value.trim();
    if (nomeC) {
      const { data: nc, error: ncErr } = await db().from('condominios').insert({
        nome:   nomeC,
        rua:    document.getElementById('capCondRua').value.trim()    || null,
        num:    document.getElementById('capCondNum').value.trim()    || null,
        bairro: document.getElementById('capCondBairroNovo').value.trim() || null,
        tipo:   document.getElementById('capCondTipo').value          || null
      }).select().single();
      if (ncErr) { toast('❌ Erro ao criar condomínio: ' + ncErr.message); return; }
      capCondominioId   = nc.id;
      capCondominioNovo = false;
      condominios.push(nc);
    }
  }

  // 5.12: criação nova sem condomínio resolvido (nem base própria, nem ITBI, nem "+") →
  // cria um condomínio incompleto na base do Alex OS a partir do Edifício digitado.
  if (!editId && !capCondominioId && !capCondominioNovo) {
    const edif = document.getElementById('fImovel').value.trim();
    if (edif) {
      const ruaV = document.getElementById('fRua').value.trim();
      const numV = document.getElementById('fNum').value.trim();
      const baiV = document.getElementById('fBairro').value.trim();
      const dup = condominios.find(c => normRua(c.nome) === normRua(edif) &&
                  (!ruaV || normRua(c.rua || '') === normRua(ruaV)));
      if (dup) {
        capCondominioId = dup.id;
      } else {
        const { data: nc, error: ncErr } = await db().from('condominios').insert({
          nome: edif, rua: ruaV || null, num: numV || null, bairro: baiV || null
        }).select().single();
        if (ncErr) { toast('❌ Erro ao criar condomínio: ' + ncErr.message); return; }
        capCondominioId = nc.id;
        condominios.push(nc);
      }
    }
  }

  const payload = {
    owner,
    pessoa_id:          capPessoaId                                    || null,
    condominio_id:      capCondominioId                                || null,
    tipo:               document.getElementById('fTipo').value          || null,
    tel:                document.getElementById('fTel').value.trim()    || null,
    email:              document.getElementById('fEmail').value.trim()  || null,
    nome_conjuge:       document.getElementById('fConjuge').value.trim()     || null,
    tel_conjuge:        document.getElementById('fTelConjuge').value.trim()  || null,
    contato_principal:  document.getElementById('fContatoPrincipal').value   || null,
    rua:                document.getElementById('fRua').value.trim()    || null,
    num:                document.getElementById('fNum').value.trim()    || null,
    apto:               document.getElementById('fApto').value.trim()   || null,
    imovel:             document.getElementById('fImovel').value.trim() || null,
    bairro:             document.getElementById('fBairro').value.trim() || null,
    dormitorios:        parseInt(document.getElementById('fD').value)   || null,
    suites:             parseInt(document.getElementById('fS').value)   || null,
    vagas:              parseInt(document.getElementById('fV').value)   || null,
    area_privativa:     parseFloat(document.getElementById('fArea').value)   || null,
    valor_pretendido:   parseCur(document.getElementById('fValor').value),
    conservacao:        document.getElementById('fConservacao').value   || null,
    ocupacao:           document.getElementById('fOcupacao').value      || null,
    restricao:          document.getElementById('fRestricao').value     || null,
    matricula_cartorio: document.getElementById('fCartorio').value.trim()    || null,
    matricula_num:      document.getElementById('fMatricula').value.trim()   || null,
    area_real_reg:      parseFloat(document.getElementById('fAreaReal').value) || null,
    matricula_data:     document.getElementById('fMatriculaData').value || null,
    condominio_mensal:  parseCur(document.getElementById('fCondMensal').value),
    iptu_anual:         parseCur(document.getElementById('fIPTU').value),
    estagio:            document.getElementById('fEstagio').value       || 'prospeccao',
    proxima_acao:       document.getElementById('fProxAcao').value.trim() || null,
    marcos:             (function(){
                          const est = document.getElementById('fEstagio').value || 'prospeccao';
                          const m = Object.assign({}, editMarcos);   // preserva assinado/perdido
                          const gv = id => (document.getElementById(id)?.value || '').trim();
                          // marcos editáveis: o campo manda (vazio = remove)
                          ['prospeccao','visita1','acm'].forEach(k => {
                            const v = gv('fMarco' + k.charAt(0).toUpperCase() + k.slice(1));
                            if (v) m[k] = v; else delete m[k];
                          });
                          // horas (1ª visita, ACM apresentado)
                          const hv = gv('fHoraVisita1'), ha = gv('fHoraAcm');
                          const hor = {}; if (hv) hor.visita1 = hv; if (ha) hor.acm = ha;
                          if (Object.keys(hor).length) m.horarios = hor; else delete m.horarios;
                          // agenda da apresentação do ACM (futuro)
                          const agd = gv('fAcmAgendadoData'), agh = gv('fAcmAgendadoHora');
                          if (agd) m.acm_agendado = { data: agd, hora: agh || null }; else delete m.acm_agendado;
                          // default: ao entrar numa etapa sem data preenchida, carimba hoje
                          if (['prospeccao','visita1','acm'].includes(est) && !m[est]) m[est] = new Date().toISOString().slice(0,10);
                          return m;
                        })(),
    origem:             document.getElementById('fOrigem').value        || null,
    obs:                editObs,
    updated_at:         new Date().toISOString()
  };

  let error, savedId = editId;
  if (editId) {
    ({ error } = await db().from('imoveis').update(payload).eq('id', editId));
  } else {
    const r = await db().from('imoveis').insert(payload).select('id').single();
    error = r.error; savedId = r.data?.id || null;
  }
  if (error) { toast('❌ Erro: ' + error.message); return; }

  // 2b: grava os campos de imóvel na CARTEIRA ligada (base única). Cria "em captação" se for nova.
  let msgEspelho = '';
  if (savedId) {
    const imovelPayload = {
      tipo:          (function(){ const v = document.getElementById('fTipologia')?.value; return (v && v !== '__nova__') ? v : null; })(),
      conservacao:   payload.conservacao,
      rua:           payload.rua,
      numero:        payload.num,
      complemento:   payload.apto,
      bairro:        payload.bairro,
      quartos:       payload.dormitorios,
      suites:        payload.suites,
      vagas:         payload.vagas,
      area_util:     payload.area_privativa,
      cond_mensal:   payload.condominio_mensal,
      matricula_num: payload.matricula_num,
      condominio_id: payload.condominio_id,
      updated_at:    new Date().toISOString()
    };
    const cart = (carteiraItems || []).find(c => c.pipeline_id === savedId);
    if (cart) {
      await db().from('imoveis_carteira').update(imovelPayload).eq('id', cart.id);
      msgEspelho = '';
    } else if (capDup.escolhido) {
      // "É o mesmo — usar este" (D-10): NÃO insere nada. Grava o pipeline_id no
      // registro que já existe e preenche SÓ os campos vazios dele — dado preenchido
      // nunca é sobrescrito por vazio (foi o que fez estrago no caso real do PD619).
      const alvo = capDup.escolhido;
      // QA Rev 3 (menor 1): reconfere NO BANCO, imediatamente antes de gravar, que o
      // alvo continua sem vínculo — uma aba paralela pode ter ligado outra captação
      // nele enquanto este formulário estava aberto. Se mudou: avisa e não grava.
      const { data: alvoAtual } = await db().from('imoveis_carteira').select('id,pipeline_id').eq('id', alvo.id).single();
      if (!alvoAtual || (alvoAtual.pipeline_id && alvoAtual.pipeline_id !== savedId)) {
        editId = savedId;          // a captação em si já foi salva — salvar de novo edita, não duplica
        capDup.escolhido = null;
        toast('⚠️ Esse imóvel acabou de ser ligado a outra captação — escolha de novo no cartão', 6000);
        await capDupVerificar();   // cartão volta com a situação atual do banco
        return;
      }
      const upd = { pipeline_id: savedId, updated_at: new Date().toISOString() };
      Object.keys(imovelPayload).forEach(k => {
        if (k === 'updated_at') return;
        const novo  = imovelPayload[k];
        const atual = alvo[k];
        const alvoVazio = (atual === null || atual === undefined || atual === '');
        if (alvoVazio && novo !== null && novo !== undefined && novo !== '') upd[k] = novo;
      });
      const { error: eLig } = await db().from('imoveis_carteira').update(upd).eq('id', alvo.id);
      if (eLig) { toast('❌ Erro ao ligar ao imóvel existente: ' + eLig.message); return; }
      msgEspelho = ' — ligada ao imóvel que já existia' + (alvo.codigo ? ' (' + alvo.codigo + ')' : '');
    } else {
      // Nenhum parecido (ou o Alex decidiu "é outro imóvel"): cria o espelho — mas
      // ANUNCIANDO, nada de criar escondido (regra do controle explícito).
      const { error: eNovo } = await db().from('imoveis_carteira')
        .insert({ ...imovelPayload, status: 'aberto', publicavel: false, pipeline_id: savedId });
      if (eNovo) { toast('❌ Erro ao criar o imóvel em Imóveis: ' + eNovo.message); return; }
      const endTxt = [imovelPayload.rua, imovelPayload.numero].filter(Boolean).join(', ');
      msgEspelho = ' — criamos o imóvel' + (endTxt ? ' ' + endTxt : '') + ' em Imóveis a partir desta captação';
    }
  }

  toast((editId ? '✅ Captação atualizada' : '✅ Captação salva') + msgEspelho, 5000);
  closeModal();
  await carregarImoveis();
  await carregarCarteira();
  enriquecerImoveis();
  renderPipeline();
}

async function excluirImovel() {
  if (!editId || !confirm('Excluir este imóvel?')) return;
  const { error } = await db().from('imoveis').delete().eq('id', editId);
  if (error) { toast('❌ Erro: ' + error.message); return; }
  toast('🗑️ Imóvel excluído');
  closeModal();
  await carregarImoveis();
  renderPipeline();
}
