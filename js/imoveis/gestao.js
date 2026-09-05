// gestao.js — aba Gestão Exclusiva do módulo Imóveis.
// Extraído de imoveis.html em 05/07/2026 (item 12.4, extração 5). NÃO usar type=module — funções globais (onclick).
// Depende de: core.js (toast, todayISO/fmtDate, parseCur/setCur, emitirTarefa) + Captação (graduarContratoAssinado é chamado por salvarGestao/openModal em runtime)
// + Leads (renderGestaoDetalhe chama openLeadFicha/openVisitaFicha/leadsDoImovel — ainda no <script> principal, seguem funcionando pois as chamadas ocorrem em runtime).
// Usada por: Captação (openGestaoModal ao graduar assinado), Vendas/core (carregarGestao, renderGestao, openGestaoDetalhe via deep-link).

// ── Gestão Exclusiva ──────────────────────────────────────────────────────────
let gestaoExclusiva = [];
let editGestaoId    = null;
let editLeadId       = null;
let editDespId       = null;
let gestaoDetalhId   = null;
let editLeadGestaoId = null;
let editDespGestaoId = null;
let leadPessoaId     = null;
let editVisitaLeadId = null;
let editVisitaId     = null;
let editPropostaLeadId = null;
let editPropostaId     = null;

const LEAD_STATUS = {
  novo:       { label: '🆕 Novo',            color: '#3b82f6' },
  visitou:    { label: 'Visitou',          color: '#8b5cf6' },
  interesse:  { label: 'Com interesse',    color: '#22c55e' },
  proposta:   { label: 'Proposta enviada', color: '#f59e0b' },
  negociando: { label: 'Negociando',       color: '#ff6600' },
  descartado: { label: 'Descartado',       color: '#6b7280' },
};


async function carregarGestao() {
  const { data, error } = await db().from('gestao_exclusiva').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  gestaoExclusiva = data || [];
}

function renderGestao() {
  const el = document.getElementById('sv-gestao'); if (!el) return;
  const today = new Date();

  // Sugerir imóveis assinados sem gestão
  const assinados = imoveis.filter(c => c.estagio === 'assinado' && !gestaoExclusiva.find(g => g.imovel_id === c.id));

  // 4d.2 — só gestões ATIVAS na lista. Vendidas/encerradas ficam no banco (histórico/KPI).
  const gestoesAtivas = gestaoExclusiva.filter(g => { const s = (g.dados || {}).status; return !s || s === 'ativa'; });

  if (!gestoesAtivas.length) {
    el.innerHTML =
      '<div class="empty-state"><div class="es-icon"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg></div><p style="font-weight:700;margin-bottom:6px">Nenhum imóvel em Gestão Exclusiva ativa.</p></div>' +
      (assinados.length ? renderAssinadosSugestao(assinados) : '');
    return;
  }

  const cards = gestoesAtivas.map(g => {
    const im = imoveis.find(c => c.id === g.imovel_id) || {};
    const d  = g.dados || {};
    const fim    = d.fim    ? new Date(d.fim)    : null;
    const inicio = d.inicio ? new Date(d.inicio) : null;
    const ulRev  = d.ultima_revisao ? new Date(d.ultima_revisao) : (inicio || today);
    const diasRest      = fim    ? Math.ceil((fim - today) / 86400000) : null;
    const diasDecorridos= inicio ? Math.floor((today - inicio) / 86400000) : null;
    const diasSemRev    = Math.floor((today - ulRev) / 86400000);
    const revAtrasada   = diasSemRev >= (d.revisao_freq || 30);
    const perto         = diasRest !== null && diasRest <= 30 && diasRest > 0;
    const vencido       = diasRest !== null && diasRest < 0;
    // 4c.2 — núcleo (carteira ligada) + contagens das tabelas
    const cart = (carteiraItems || []).find(c => c.gestao_id === g.id) || {};
    const cartId = cart.id || null;
    const propEntry = (cart.pessoas || []).find(x => x.tipo === 'Proprietário');
    const propNome  = (propEntry && ((pessoasAll.find(z => z.id === propEntry.id) || {}).nome || propEntry.nome)) || im.owner || '—';
    const endereco  = ([cart.rua, cart.numero].filter(Boolean).join(', ') + (cart.complemento ? ' · ' + cart.complemento : '')) || im.imovel || im.rua || '—';
    const edificio  = cart.condominio_id ? (condominios.find(c => c.id === cart.condominio_id) || {}).nome : '';
    const linksHtml = cartId ? (
      '<div class="gest-card-links">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>' +
        '<a href="imoveis.html?tab=carteira&abrir=' + cartId + '" class="gest-link" onclick="event.stopPropagation()">' + (cart.codigo || 'sem código') + '</a>' +
        (edificio
          ? '<span>·</span><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><a href="imoveis.html?tab=condominios&cond=' + cart.condominio_id + '" class="gest-link" onclick="event.stopPropagation()">' + edificio + '</a>'
          : '<span>· casa (sem condomínio)</span>') +
      '</div>'
    ) : '';
    const gLeads2       = cartId ? (leadsItems || []).filter(l => l.carteira_id === cartId) : [];
    const totalLeads    = gLeads2.length;
    const totalVisitas  = cartId ? (visitasItems || []).filter(v => v.carteira_id === cartId).length : 0;
    const totalProposta = cartId ? ((typeof fechamentos !== 'undefined' ? fechamentos : []) || []).filter(f => f.imovel_id === cartId).length : 0;

    // Preço e ACM
    const acm        = acmItems.find(a => a.imovel_id === g.imovel_id);
    const acmVal     = acm?.valor_sugerido;
    const precoAtual = cart.valor_venda || im.valor_pretendido;
    const diffPct    = acmVal && precoAtual ? Math.round((precoAtual - acmVal) / acmVal * 100) : null;
    const acmClass   = !acmVal ? 'sem' : diffPct === null ? 'sem' : diffPct > 10 ? 'acima' : diffPct < -5 ? 'abaixo' : 'igual';
    const acmLabel   = !acmVal ? 'sem ACM'
      : diffPct === null ? 'ACM ' + fmtMoneyInt(acmVal)
      : diffPct > 10 ? '+' + diffPct + '% acima do ACM'
      : diffPct < -5 ? Math.abs(diffPct) + '% abaixo do ACM'
      : 'igual ao ACM';

    const termCol = vencido ? 'color:var(--danger)' : perto ? 'color:var(--warn)' : '';
    const termSub = diasRest === null ? '—' : (diasRest < 0 ? 'vencido há ' + Math.abs(diasRest) + 'd' : diasRest + 'd restantes');

    return '<div class="card gest-card" onclick="openGestaoDetalhe(\'' + g.id + '\')">' +
      '<div class="gest-card-nome">' + propNome + '</div>' +
      '<div class="gest-card-end"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' + endereco + '</div>' +
      linksHtml +
      (precoAtual ? '<div class="gest-card-price-row"><span class="gest-card-price">' + fmtMoneyInt(precoAtual) + '</span><span class="gest-card-acm ' + acmClass + '">' + acmLabel + '</span></div>' : '') +
      '<div class="gest-kpi-row">' +
        '<div class="gest-kpi-cell"><div class="v">' + totalLeads + '</div><div class="l">LEADS</div></div>' +
        '<div class="gest-kpi-cell"><div class="v">' + totalVisitas + '</div><div class="l">VISITAS</div></div>' +
        '<div class="gest-kpi-cell"><div class="v">' + totalProposta + '</div><div class="l">PROPOSTA</div></div>' +
      '</div>' +
      '<div class="gest-date-row">' +
        '<div class="gest-date-cell"><div class="l">Início</div><div class="d">' + fmtDate(d.inicio) + '</div><div class="s" style="color:var(--muted)">' + (diasDecorridos !== null ? diasDecorridos + 'd corridos' : '—') + '</div></div>' +
        '<div class="gest-date-cell"><div class="l">Término</div><div class="d" style="' + termCol + '">' + fmtDate(d.fim) + '</div><div class="s" style="' + termCol + '">' + termSub + '</div></div>' +
      '</div>' +
      '<div class="gest-tags">' +
        (revAtrasada ? '<span class="gest-outline-badge warn"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Revisão há ' + diasSemRev + 'd</span>' : '') +
        (perto && !vencido ? '<span class="gest-outline-badge warn"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Renovação em ' + diasRest + 'd</span>' : '') +
        (vencido ? '<span class="gest-outline-badge danger"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Contrato vencido</span>' : '') +
        (d.comissao ? '<span class="gest-tag-gray">' + d.comissao + '% comissão</span>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  // Contagem de gestões + estado
  const nTot = gestoesAtivas.length;
  let nVenc = 0, nAlerta = 0;
  gestoesAtivas.forEach(g => {
    const dd = g.dados || {};
    const fim = dd.fim ? new Date(dd.fim) : null;
    const dr  = fim ? Math.ceil((fim - today) / 86400000) : null;
    const ulR = dd.ultima_revisao ? new Date(dd.ultima_revisao) : (dd.inicio ? new Date(dd.inicio) : today);
    const sr  = Math.floor((today - ulR) / 86400000);
    if (dr !== null && dr < 0) nVenc++;
    else if (sr >= (dd.revisao_freq || 30) || (dr !== null && dr > 0 && dr <= 30)) nAlerta++;
  });
  const header = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">' +
    '<span style="font-size:15px;font-weight:700">' + nTot + ' gest' + (nTot !== 1 ? 'ões' : 'ão') + ' exclusiva' + (nTot !== 1 ? 's' : '') + '</span>' +
    (nAlerta ? '<span class="gest-outline-badge warn"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + nAlerta + ' em atenção</span>' : '') +
    (nVenc ? '<span class="gest-outline-badge danger"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' + nVenc + ' vencida' + (nVenc !== 1 ? 's' : '') + '</span>' : '') +
  '</div>';

  el.innerHTML = header + '<div class="gest-grid">' + cards + '</div>' +
    (assinados.length ? renderAssinadosSugestao(assinados) : '');
}

function renderAssinadosSugestao(assinados) {
  return '<div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">' +
    '<div class="ds-section-label" style="margin-bottom:8px">Imóveis assinados sem gestão (' + assinados.length + ')</div>' +
    '<div style="display:flex;flex-direction:column;gap:6px">' +
    assinados.map(c =>
      '<div class="gest-suggest-item">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' +
        '<div style="flex:1"><div class="ds-nome-sm">' + (c.imovel || c.rua || '—') + '</div><div class="ds-meta">' + (c.owner || '—') + '</div></div>' +
        '<button class="btn btn-primary btn-sm" onclick="openGestaoModal(null,\'' + c.id + '\')" style="white-space:nowrap">+ Iniciar gestão</button>' +
      '</div>'
    ).join('') +
    '</div></div>';
}

// ── Modal Gestão ──────────────────────────────────────────────────────────────
function openGestaoModal(id, preImovelId) {
  editGestaoId = id || null;
  const g  = id ? gestaoExclusiva.find(x => x.id === id) : null;
  const d  = g?.dados || {};
  document.getElementById('gestaoModalTitulo').textContent = g ? 'Editar Gestão Exclusiva' : 'Nova Gestão Exclusiva';
  populateGestaoSelect(d.imovel_id || preImovelId || '');
  document.getElementById('fGestaoInicio').value        = d.inicio        || todayISO();
  document.getElementById('fGestaoPrazo').value         = d.prazo         || 180;
  document.getElementById('fGestaoFim').value           = d.fim           || '';
  document.getElementById('fGestaoComissao').value      = d.comissao      || 6;
  document.getElementById('fGestaoRevisaoFreq').value   = d.revisao_freq  || 60;
  document.getElementById('fGestaoObs').value           = d.obs           || '';
  document.getElementById('fGestaoLinkContrato').value  = d.link_contrato || '';
  if (!g) calcGestaoFim();
  onGestaoImovelChange();
  document.getElementById('btnGestaoDel').style.display = g ? '' : 'none';
  document.getElementById('gestaoOverlay').classList.add('open');
  setTimeout(() => document.getElementById('fGestaoInicio').focus(), 50);
}

function closeGestaoModal() { document.getElementById('gestaoOverlay').classList.remove('open'); editGestaoId = null; }

function populateGestaoSelect(currentId) {
  const sel = document.getElementById('fGestaoImovelId');
  const opts = imoveis.filter(c => c.estagio !== 'perdido')
    .sort((a, b) => { if (a.estagio === 'assinado' && b.estagio !== 'assinado') return -1; if (b.estagio === 'assinado' && a.estagio !== 'assinado') return 1; return (a.owner || '').localeCompare(b.owner || ''); });
  sel.innerHTML = '<option value="">— Selecione um imóvel —</option>' +
    opts.map(c => {
      const st = STAGES.find(s => s.id === c.estagio) || { label: c.estagio };
      return `<option value="${c.id}"${c.id === currentId ? ' selected' : ''}>${c.owner || '—'} — ${c.imovel || c.rua || '—'} [${st.label}]</option>`;
    }).join('');
}

function onGestaoImovelChange() {
  const id = document.getElementById('fGestaoImovelId').value;
  const im = imoveis.find(c => c.id === id);
  const info = document.getElementById('fGestaoImovelInfo');
  if (im) {
    const addr = [im.rua, im.num].filter(Boolean).join(', ') + (im.apto ? ' · Apto ' + im.apto : '');
    info.innerHTML = '<strong>' + (im.owner || '—') + '</strong> · ' + (im.imovel || '') + (addr ? ' · ' + addr : '') + (im.area_privativa ? ' · ' + im.area_privativa + 'm²' : '');
    info.style.display = '';
  } else { info.style.display = 'none'; }
}

function calcGestaoFim() {
  const ini   = document.getElementById('fGestaoInicio').value;
  const prazo = parseInt(document.getElementById('fGestaoPrazo').value) || 180;
  if (!ini) return;
  const d = new Date(ini); d.setDate(d.getDate() + prazo);
  document.getElementById('fGestaoFim').value = d.toISOString().slice(0, 10);
}

async function salvarGestao() {
  const imovelId = document.getElementById('fGestaoImovelId').value;
  if (!imovelId) { toast('⚠️ Selecione um imóvel'); return; }
  const inicio = document.getElementById('fGestaoInicio').value;
  if (!inicio) { toast('⚠️ Preencha a data de início'); return; }
  const existing = editGestaoId ? gestaoExclusiva.find(x => x.id === editGestaoId) : null;
  const dados = {
    ...(existing?.dados || {}),
    imovel_id:   imovelId,
    inicio,
    prazo:       parseInt(document.getElementById('fGestaoPrazo').value)       || 180,
    fim:         document.getElementById('fGestaoFim').value                   || '',
    comissao:    parseFloat(document.getElementById('fGestaoComissao').value)  || 6,
    revisao_freq:parseInt(document.getElementById('fGestaoRevisaoFreq').value) || 60,
    ultima_revisao:   existing?.dados?.ultima_revisao    || inicio,
    obs:              document.getElementById('fGestaoObs').value.trim(),
    link_contrato:    document.getElementById('fGestaoLinkContrato').value.trim(),
    leads:            existing?.dados?.leads             || [],
    despesas:         existing?.dados?.despesas          || [],
    historico_precos: existing?.dados?.historico_precos  || [],
  };
  const payload = { imovel_id: imovelId, dados, updated_at: new Date().toISOString() };
  let error, novaGestaoId = null;
  if (editGestaoId) {
    ({ error } = await db().from('gestao_exclusiva').update(payload).eq('id', editGestaoId));
  } else {
    let dataIns;
    ({ data: dataIns, error } = await db().from('gestao_exclusiva').insert(payload).select('id').single());
    novaGestaoId = dataIns?.id || null;
  }
  if (error) { toast('❌ ' + error.message); return; }

  // 4a — Gestão nova = mandato assinado. Gradua a captação e amarra status/gestão na Carteira.
  if (!editGestaoId && novaGestaoId) {
    await graduarContratoAssinado(imovelId, novaGestaoId, inicio);   // 5.1 — marco assinado = início da gestão
  }

  toast(editGestaoId ? '✅ Gestão atualizada' : '✅ Contrato assinado — imóvel em Gestão Exclusiva');
  closeGestaoModal();
  await Promise.all([carregarGestao(), carregarImoveis(), carregarCarteira()]);
  enriquecerImoveis();
  renderGestao();
  if (typeof renderPipeline === 'function') renderPipeline();
}

// 4a — Graduação do "Contrato assinado": amarra os três elos que ficavam soltos.
async function graduarContratoAssinado(capId, gestaoId, dataAssinatura) {
  // 1) A captação sai do quadro: estágio 'assinado' + marco = data de início da gestão (a assinatura real).
  const cap = (imoveis || []).find(x => x.id === capId);
  const marcos = Object.assign({}, (cap && cap.marcos) || {});
  marcos.assinado = dataAssinatura || marcos.assinado || todayISO();
  await db().from('imoveis').update({ estagio: 'assinado', marcos, updated_at: new Date().toISOString() }).eq('id', capId);

  // 2) Carteira (núcleo): status vira 'exclusivo' + vínculo da gestão. publicavel fica como está (escondido).
  const cart = (carteiraItems || []).find(x => x.pipeline_id === capId);
  if (cart) {
    await db().from('imoveis_carteira').update({ status: 'exclusivo', gestao_id: gestaoId, updated_at: new Date().toISOString() }).eq('id', cart.id);
    // 3) Tarefa: completar o cadastro do imóvel para publicar na vitrine, com link direto para a ficha.
    const label = [cart.rua, cart.numero].filter(Boolean).join(', ') || cart.codigo || (cap && cap.owner) || 'imóvel';
    emitirTarefa('Completar cadastro do imóvel para publicar: ' + label, { carteira_id: cart.id, rotulo: 'Imóvel' });
  }
}

async function excluirGestao() {
  if (!editGestaoId || !confirm('Excluir esta gestão exclusiva?')) return;
  const { error } = await db().from('gestao_exclusiva').delete().eq('id', editGestaoId);
  if (error) { toast('❌ ' + error.message); return; }
  toast('🗑️ Gestão excluída');
  closeGestaoModal();
  await carregarGestao();
  renderGestao();
}

// ── Detalhe da Gestão ─────────────────────────────────────────────────────────
function openGestaoDetalhe(gestaoId) {
  gestaoDetalhId = gestaoId;
  renderGestaoDetalhe();
}

function renderGestaoDetalhe() {
  const g = gestaoExclusiva.find(x => x.id === gestaoDetalhId); if (!g) return;
  const im = imoveis.find(c => c.id === g.imovel_id) || {};
  // 4c.2 — núcleo (imóvel da Carteira ligado por gestao_id), em vez do dado da captação
  const cart = (carteiraItems || []).find(c => c.gestao_id === g.id) || {};
  const cartId = cart.id || null;
  const propEntry = (cart.pessoas || []).find(x => x.tipo === 'Proprietário');
  const propNome  = (propEntry && ((pessoasAll.find(z => z.id === propEntry.id) || {}).nome || propEntry.nome)) || im.owner || '—';
  const endereco  = ([cart.rua, cart.numero].filter(Boolean).join(', ') + (cart.complemento ? ' · ' + cart.complemento : '')) || im.imovel || im.rua || '—';
  const condNome  = cart.condominio_id ? (condominios.find(c => c.id === cart.condominio_id) || {}).nome : '';
  const edificio  = condNome || im.imovel || '';
  const gLeads   = cartId ? leadsDoImovel(cartId) : [];
  const gVisitas = cartId ? (visitasItems || []).filter(v => v.carteira_id === cartId)
    .sort((a,b) => (b.data||b.created_at||'').localeCompare(a.data||a.created_at||'')) : [];
  const gFech    = cartId ? ((typeof fechamentos !== 'undefined' ? fechamentos : []) || []).filter(f => f.imovel_id === cartId) : [];
  const acm = (typeof acmItems !== 'undefined' ? acmItems : []).find(a => a.imovel_id === g.imovel_id);
  const acmVal = acm && acm.valor_sugerido;
  const precoAtual = cart.valor_venda || im.valor_pretendido;
  const diffPct = (acmVal && precoAtual) ? Math.round((precoAtual - acmVal) / acmVal * 100) : null;
  const diffColor = diffPct === null ? 'var(--text)' : diffPct > 10 ? 'var(--danger)' : diffPct < -5 ? 'var(--success)' : 'var(--warn)';
  const d  = g.dados || {};
  const today = new Date();
  const ulRev = d.ultima_revisao ? new Date(d.ultima_revisao) : (d.inicio ? new Date(d.inicio) : today);
  const diasSemRev = Math.floor((today - ulRev) / 86400000);
  const revAtrasada = diasSemRev >= (d.revisao_freq || 60);

  // CRM (Interessados/Visitas/Negociações) agora vem do componente compartilhado crmBlocoHtml (leads.js) — item 10.9

  const totalDesp = (d.despesas || []).reduce((s, x) => s + (parseFloat(x.valor) || 0), 0);
  const despHtml = (d.despesas || []).length
    ? (d.despesas || []).map((x, i) =>
        '<div class="gest-list-row">' +
          '<div class="gest-list-row-main"><div class="gest-list-row-title">' + (x.desc || '—') + '</div><div class="gest-list-row-sub">' + fmtDate(x.data) + '</div></div>' +
          '<div class="gest-list-row-val" style="color:var(--danger)">' + fmtMoeda(x.valor || 0) + '</div>' +
          '<button class="acm-xbtn" onclick="openDespModal(\'' + gestaoDetalhId + '\',\'' + x.id + '\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
        '</div>'
      ).join('')
    : '<div class="ds-meta" style="padding:8px 0">Nenhuma despesa registrada.</div>';

  // ── Histórico de preços ──
  const histPrecos = (d.historico_precos || []).slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const histHtml = histPrecos.length
    ? histPrecos.map(h =>
        '<div class="gest-list-row">' +
          '<div class="gest-list-row-main"><div class="gest-list-row-title">' + fmtMoeda(h.valor) + (h.obs ? ' — ' + h.obs : '') + '</div><div class="gest-list-row-sub">' + fmtDate(h.data) + '</div></div>' +
          '<button class="acm-xbtn" onclick="openHistPrecoModal(\'' + gestaoDetalhId + '\',\'' + h.id + '\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
        '</div>'
      ).join('')
    : '<div class="ds-meta" style="padding:8px 0">Nenhum preço registrado ainda.</div>';

  // ── Alerta de renovação ──
  const fim2       = d.fim ? new Date(d.fim) : null;
  const diasRest2  = fim2 ? Math.ceil((fim2 - new Date()) / 86400000) : null;
  const renovBreve = diasRest2 !== null && diasRest2 > 0 && diasRest2 <= 30;
  const renovVenc  = diasRest2 !== null && diasRest2 <= 0;

  const el = document.getElementById('sv-gestao');
  el.innerHTML =
    '<div style="margin-bottom:12px"><button class="btn btn-ghost btn-sm" onclick="gestaoDetalhId=null;renderGestao()">← Voltar</button></div>' +
    '<div class="card" style="margin-bottom:12px">' +
      '<div class="gest-det-hdr">' +
        '<div>' +
          '<div class="gest-det-nome">' + propNome + '</div>' +
          '<div class="gest-det-sub">' + endereco +
            (cartId ? ' · <a href="imoveis.html?tab=carteira&abrir=' + cartId + '" class="gest-link">' + (cart.codigo || 'sem código') + '</a>' : '') +
            (condNome ? ' · <a href="imoveis.html?tab=condominios&cond=' + cart.condominio_id + '" class="gest-link">' + condNome + '</a>' : (edificio ? ' · ' + edificio : '')) +
          '</div>' +
          (d.link_contrato ? '<a href="' + d.link_contrato + '" target="_blank" class="btn btn-ghost btn-sm" style="font-size:11px;margin-top:6px;display:inline-flex;align-items:center;gap:4px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Ver contrato ↗</a>' : '') +
        '</div>' +
        '<div class="gest-det-actions"><span class="gest-outline-badge" style="color:var(--accent)">EXCLUSIVO</span>' +
          '<button class="btn btn-ghost btn-sm" onclick="openGestaoModal(\'' + gestaoDetalhId + '\')" style="font-size:11px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar</button></div>' +
      '</div>' +
      '<div class="gest-meta-grid">' +
        '<div class="gest-meta-item"><div class="gest-meta-lbl">Início</div><div class="gest-meta-val">' + fmtDate(d.inicio) + '</div></div>' +
        '<div class="gest-meta-item"><div class="gest-meta-lbl">Término</div><div class="gest-meta-val">' + fmtDate(d.fim) + '</div></div>' +
        '<div class="gest-meta-item"><div class="gest-meta-lbl">Comissão</div><div class="gest-meta-val">' + (d.comissao || 6) + '%</div></div>' +
        '<div class="gest-meta-item"><div class="gest-meta-lbl">Leads</div><div class="gest-meta-val">' + gLeads.length + '</div></div>' +
        '<div class="gest-meta-item"><div class="gest-meta-lbl">Visitas</div><div class="gest-meta-val">' + gVisitas.length + '</div></div>' +
        '<div class="gest-meta-item"><div class="gest-meta-lbl">Propostas</div><div class="gest-meta-val">' + gFech.length + '</div></div>' +
      '</div>' +
      '<div class="gest-price-grid">' +
        '<div class="gest-price-col"><div class="gest-price-lbl">Preço atual</div><div class="gest-price-val">' + (precoAtual ? fmtMoeda(precoAtual) : '—') + '</div></div>' +
        '<div class="gest-price-col"><div class="gest-price-lbl">ACM sugerido</div><div class="gest-price-val" style="color:var(--muted);font-size:22px">' + (acmVal ? fmtMoeda(acmVal) : 'sem ACM') + '</div></div>' +
        '<div class="gest-price-col"><div class="gest-price-lbl">Diferença</div><div class="gest-price-val" style="font-size:22px' + (diffPct !== null ? ';color:' + diffColor : ';color:var(--muted)') + '">' + (diffPct !== null ? (diffPct > 0 ? '+' : '') + diffPct + '%' : '—') + '</div></div>' +
      '</div>' +
      (renovVenc ? '<div class="gest-alert r"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span>Contrato vencido há <strong>' + Math.abs(diasRest2) + ' dias</strong></span><span class="gest-alert-actions"><button class="btn btn-primary btn-sm" onclick="openRenovarModal(\'' + gestaoDetalhId + '\')" style="font-size:11px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Renovar</button><button class="btn btn-sm" onclick="confirmarEncerrarGestao(\'' + gestaoDetalhId + '\')" style="font-size:11px;background:transparent;border:1px solid rgba(239,68,68,.5);color:var(--danger)">Encerrar gestão</button></span></div>' : '') +
      (renovBreve && !renovVenc ? '<div class="gest-alert a"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>Contrato vence em <strong>' + diasRest2 + ' dias</strong></span><span class="gest-alert-actions"><button class="btn btn-primary btn-sm" onclick="openRenovarModal(\'' + gestaoDetalhId + '\')" style="font-size:11px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Renovar</button></span></div>' : '') +
      (revAtrasada ? '<div class="gest-alert a"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>Revisão de preço pendente há <strong>' + diasSemRev + ' dias</strong></span><span class="gest-alert-actions"><button class="btn btn-ghost btn-sm" onclick="registrarRevisao(\'' + gestaoDetalhId + '\')" style="font-size:11px">Marcar feita</button></span></div>' : '') +
    '</div>' +
    (cartId ? crmBlocoHtml(cartId, { negTitle: 'Negociações' }) : '') +
    '<div class="card" style="margin-bottom:12px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><div class="gest-sec-title"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>Histórico de Preços</div><button class="btn btn-ghost btn-sm" onclick="openHistPrecoModal(\'' + gestaoDetalhId + '\',null)" style="font-size:11px">+ Registrar preço</button></div>' + histHtml + '</div>' +
    '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><div class="gest-sec-title"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>Despesas' + (totalDesp > 0 ? ' <span style="font-size:12px;font-weight:700;color:var(--danger)">' + fmtMoeda(totalDesp) + '</span>' : '') + '</div><button class="btn btn-ghost btn-sm" onclick="openDespModal(\'' + gestaoDetalhId + '\',null)" style="font-size:11px">+ Despesa</button></div>' + despHtml + '</div>';
}

async function registrarRevisao(gestaoId) {
  const g = gestaoExclusiva.find(x => x.id === gestaoId); if (!g) return;
  g.dados = { ...(g.dados || {}), ultima_revisao: todayISO() };
  const { error } = await db().from('gestao_exclusiva').update({ dados: g.dados, updated_at: new Date().toISOString() }).eq('id', gestaoId);
  if (error) { toast('❌ ' + error.message); return; }
  toast('✅ Revisão registrada');
  renderGestaoDetalhe();
}

// ── 4d.2 — Renovar gestão ─────────────────────────────────────────────────────
let renovarGestaoId = null;
function openRenovarModal(gestaoId) {
  const g = gestaoExclusiva.find(x => x.id === gestaoId); if (!g) return;
  renovarGestaoId = gestaoId;
  const d = g.dados || {};
  const cart = (carteiraItems || []).find(c => c.gestao_id === g.id) || {};
  const im   = imoveis.find(c => c.id === g.imovel_id) || {};
  const end  = ([cart.rua, cart.numero].filter(Boolean).join(', ')) || im.imovel || im.rua || '—';
  document.getElementById('renovarImovelInfo').innerHTML = '<strong>' + end + '</strong>';
  document.getElementById('fRenovarData').value  = todayISO();
  document.getElementById('fRenovarPrazo').value = d.prazo || 180;
  calcRenovarFim();
  document.getElementById('renovarOverlay').classList.add('open');
}
function closeRenovarModal() {
  document.getElementById('renovarOverlay').classList.remove('open');
  renovarGestaoId = null;
}
function calcRenovarFim() {
  const ini = document.getElementById('fRenovarData').value;
  const prazo = parseInt(document.getElementById('fRenovarPrazo').value) || 180;
  if (!ini) { document.getElementById('renovarFimPreview').textContent = '—'; return; }
  const dt = new Date(ini); dt.setDate(dt.getDate() + prazo);
  document.getElementById('renovarFimPreview').textContent = fmtDate(dt.toISOString().slice(0, 10));
}
async function salvarRenovacao() {
  const g = gestaoExclusiva.find(x => x.id === renovarGestaoId); if (!g) return;
  const dataNovo = document.getElementById('fRenovarData').value;
  const prazo    = parseInt(document.getElementById('fRenovarPrazo').value) || 180;
  if (!dataNovo) { toast('⚠️ Preencha a data de assinatura'); return; }
  const dt = new Date(dataNovo); dt.setDate(dt.getDate() + prazo);
  const novoFim = dt.toISOString().slice(0, 10);
  const d = g.dados || {};
  const renovacoes = Array.isArray(d.renovacoes) ? d.renovacoes.slice() : [];
  renovacoes.push({ data_assinatura: dataNovo, prazo, fim_anterior: d.fim || null, fim_novo: novoFim });
  const dados = { ...d, status: 'ativa', prazo, fim: novoFim, ultima_renovacao: dataNovo, renovacoes };
  const { error } = await db().from('gestao_exclusiva').update({ dados, updated_at: new Date().toISOString() }).eq('id', g.id);
  if (error) { toast('❌ ' + error.message); return; }
  toast('Gestão renovada até ' + fmtDate(novoFim));
  closeRenovarModal();
  await carregarGestao();
  renderGestaoDetalhe();
}

// ── 4d.2 — Encerrar gestão (venceu sem renovar nem vender) ────────────────────
async function confirmarEncerrarGestao(gestaoId) {
  const g = gestaoExclusiva.find(x => x.id === gestaoId); if (!g) return;
  const cart = (carteiraItems || []).find(c => c.gestao_id === g.id);
  const end  = cart ? ([cart.rua, cart.numero].filter(Boolean).join(', ') || 'imóvel') : 'imóvel';
  if (!confirm('Encerrar esta gestão?\n' + end + '\n\n• Gestão → Encerrada (venceu sem vender)\n• Imóvel volta a Aberto na Carteira\n• Histórico (leads, visitas, preços) fica guardado')) return;

  // Gestão vira 'encerrada' (mantida p/ histórico e KPI de churn). Não apaga nada.
  const dados = { ...(g.dados || {}), status: 'encerrada', encerrada_em: todayISO() };
  const { error: e1 } = await db().from('gestao_exclusiva').update({ dados, updated_at: new Date().toISOString() }).eq('id', g.id);
  if (e1) { toast('❌ ' + e1.message); return; }

  // Imóvel volta a 'aberto'. Mantém gestao_id como rastro do histórico (não limpa). Zera 'exclusivo' legado.
  if (cart) {
    await db().from('imoveis_carteira').update({ status: 'aberto', exclusivo: false, updated_at: new Date().toISOString() }).eq('id', cart.id);
  }

  toast('Gestão encerrada — imóvel voltou a Aberto');
  gestaoDetalhId = null;
  await Promise.all([carregarGestao(), carregarCarteira()]);
  if (typeof filtrarCarteira === 'function') filtrarCarteira();
  renderGestao();
}

// ── Modal Histórico de Preços ─────────────────────────────────────────────────
let editHistPrecoGestaoId = null;
let editHistPrecoId       = null;

function openHistPrecoModal(gestaoId, histId) {
  editHistPrecoGestaoId = gestaoId;
  editHistPrecoId       = histId || null;
  const g    = gestaoExclusiva.find(x => x.id === gestaoId);
  const hist = histId && g ? (g.dados?.historico_precos || []).find(h => h.id === histId) : null;
  document.getElementById('histPrecoModalTitulo').textContent = hist ? 'Editar Preço' : 'Registrar Preço';
  document.getElementById('fHistPrecoData').value = hist?.data || todayISO();
  setCur('fHistPrecoValor', hist?.valor);
  document.getElementById('fHistPrecoObs').value  = hist?.obs || '';
  document.getElementById('btnHistPrecoDel').style.display = hist ? '' : 'none';
  document.getElementById('histPrecoOverlay').classList.add('open');
}

function closeHistPrecoModal() {
  document.getElementById('histPrecoOverlay').classList.remove('open');
  editHistPrecoGestaoId = null;
  editHistPrecoId       = null;
}

// Mantém o "Preço atual" do imóvel (Carteira, ou fallback direto no cadastro) em dia com o
// registro mais recente (por data) do Histórico de Preços da gestão. Chamado após salvar/excluir.
async function sincronizarPrecoAtualDaGestao(g) {
  const lista = g.dados?.historico_precos || [];
  if (!lista.length) return;   // sem registro nenhum: não mexe no preço já cadastrado
  const maisRecente = lista.slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''))[0];
  const cart = (carteiraItems || []).find(c => c.gestao_id === g.id);
  if (cart) {
    const { error } = await db().from('imoveis_carteira').update({ valor_venda: maisRecente.valor }).eq('id', cart.id);
    if (!error) cart.valor_venda = maisRecente.valor;
    return;
  }
  const im = (imoveis || []).find(x => x.id === g.imovel_id);
  if (im) {
    const { error } = await db().from('imoveis').update({ valor_pretendido: maisRecente.valor }).eq('id', im.id);
    if (!error) im.valor_pretendido = maisRecente.valor;
  }
}

async function salvarHistPreco() {
  const data  = document.getElementById('fHistPrecoData').value;
  const valor = parseCur(document.getElementById('fHistPrecoValor').value);
  if (!data)  { toast('⚠️ Preencha a data');  return; }
  if (!valor) { toast('⚠️ Preencha o valor'); return; }
  const g = gestaoExclusiva.find(x => x.id === editHistPrecoGestaoId); if (!g) return;
  const lista = g.dados?.historico_precos || [];
  if (editHistPrecoId) {
    const idx = lista.findIndex(h => h.id === editHistPrecoId);
    if (idx >= 0) lista[idx] = { ...lista[idx], data, valor, obs: document.getElementById('fHistPrecoObs').value.trim() };
  } else {
    lista.push({ id: crypto.randomUUID(), data, valor, obs: document.getElementById('fHistPrecoObs').value.trim() });
  }
  g.dados = { ...(g.dados || {}), historico_precos: lista };
  const { error } = await db().from('gestao_exclusiva').update({ dados: g.dados, updated_at: new Date().toISOString() }).eq('id', editHistPrecoGestaoId);
  if (error) { toast('❌ ' + error.message); return; }
  await sincronizarPrecoAtualDaGestao(g);
  toast('✅ Preço salvo');
  closeHistPrecoModal();
  renderGestaoDetalhe();
}

async function excluirHistPreco() {
  if (!editHistPrecoId || !confirm('Excluir este registro de preço?')) return;
  const g = gestaoExclusiva.find(x => x.id === editHistPrecoGestaoId); if (!g) return;
  g.dados = { ...(g.dados || {}), historico_precos: (g.dados?.historico_precos || []).filter(h => h.id !== editHistPrecoId) };
  const { error } = await db().from('gestao_exclusiva').update({ dados: g.dados, updated_at: new Date().toISOString() }).eq('id', editHistPrecoGestaoId);
  if (error) { toast('❌ ' + error.message); return; }
  await sincronizarPrecoAtualDaGestao(g);
  toast('🗑️ Registro excluído');
  closeHistPrecoModal();
  renderGestaoDetalhe();
}


// ── Modal Proposta ────────────────────────────────────────────────────────────
function togglePropostaObs() {
  const tipo = document.getElementById('fPropostaTipo').value;
  document.getElementById('propostaObsBox').style.display = tipo !== 'a_vista' ? '' : 'none';
}

function openPropostaModal(gestaoId, leadId, propostaId) {
  editLeadGestaoId    = gestaoId;
  editPropostaLeadId  = leadId;
  editPropostaId      = propostaId || null;
  const g    = gestaoExclusiva.find(x => x.id === gestaoId);
  const lead = g ? (g.dados?.leads || []).find(l => l.id === leadId) : null;
  const prop = propostaId ? (lead?.propostas || []).find(p => p.id === propostaId) : null;
  document.getElementById('propostaModalTitulo').textContent = prop ? 'Editar Proposta' : 'Nova Proposta — ' + (lead?.nome || '');
  document.getElementById('fPropostaData').value   = prop?.data   || todayISO();
  setCur('fPropostaValor', prop?.valor);
  document.getElementById('fPropostaTipo').value   = prop?.tipo   || 'a_vista';
  document.getElementById('fPropostaStatus').value = prop?.status || 'em_analise';
  document.getElementById('fPropostaObs').value    = prop?.obs    || '';
  document.getElementById('btnPropostaDel').style.display = prop ? '' : 'none';
  togglePropostaObs();
  document.getElementById('propostaOverlay').classList.add('open');
}

function closePropostaModal() { document.getElementById('propostaOverlay').classList.remove('open'); editPropostaId = null; }

async function salvarProposta() {
  const valor = parseCur(document.getElementById('fPropostaValor').value);
  if (!valor) { toast('⚠️ Preencha o valor da proposta'); return; }
  const g    = gestaoExclusiva.find(x => x.id === editLeadGestaoId); if (!g) return;
  const lidx = (g.dados?.leads || []).findIndex(l => l.id === editPropostaLeadId); if (lidx < 0) return;
  if (!g.dados.leads[lidx].propostas) g.dados.leads[lidx].propostas = [];
  const tipo = document.getElementById('fPropostaTipo').value;
  const prop = {
    id:     editPropostaId || Date.now().toString(),
    data:   document.getElementById('fPropostaData').value,
    valor,
    tipo,
    status: document.getElementById('fPropostaStatus').value,
    obs:    tipo !== 'a_vista' ? document.getElementById('fPropostaObs').value.trim() : '',
  };
  if (editPropostaId) {
    const idx = g.dados.leads[lidx].propostas.findIndex(p => p.id === editPropostaId);
    if (idx >= 0) g.dados.leads[lidx].propostas[idx] = prop; else g.dados.leads[lidx].propostas.push(prop);
  } else {
    g.dados.leads[lidx].propostas.push(prop);
    if (!['proposta','negociando'].includes(g.dados.leads[lidx].status)) g.dados.leads[lidx].status = 'proposta';
  }
  const { error } = await db().from('gestao_exclusiva').update({ dados: g.dados, updated_at: new Date().toISOString() }).eq('id', editLeadGestaoId);
  if (error) { toast('❌ ' + error.message); return; }
  toast(editPropostaId ? '✅ Proposta atualizada' : '✅ Proposta registrada');
  closePropostaModal();
  renderGestaoDetalhe();
}

async function excluirProposta() {
  if (!editPropostaId || !confirm('Excluir esta proposta?')) return;
  const g    = gestaoExclusiva.find(x => x.id === editLeadGestaoId); if (!g) return;
  const lidx = (g.dados?.leads || []).findIndex(l => l.id === editPropostaLeadId); if (lidx < 0) return;
  g.dados.leads[lidx].propostas = (g.dados.leads[lidx].propostas || []).filter(p => p.id !== editPropostaId);
  const { error } = await db().from('gestao_exclusiva').update({ dados: g.dados, updated_at: new Date().toISOString() }).eq('id', editLeadGestaoId);
  if (error) { toast('❌ ' + error.message); return; }
  toast('🗑️ Proposta excluída');
  closePropostaModal();
  renderGestaoDetalhe();
}

// ── Modal Despesa ─────────────────────────────────────────────────────────────
function openDespModal(gestaoId, despId) {
  editDespGestaoId = gestaoId;
  editDespId = despId || null;
  const g    = gestaoExclusiva.find(x => x.id === gestaoId);
  const desp = despId && g ? (g.dados?.despesas || []).find(x => x.id === despId) : null;
  document.getElementById('despModalTitulo').textContent = desp ? 'Editar Despesa' : 'Nova Despesa';
  document.getElementById('fDespDesc').value  = desp?.desc  || '';
  setCur('fDespValor', desp?.valor);
  document.getElementById('fDespData').value  = desp?.data  || todayISO();
  document.getElementById('btnDespDel').style.display = desp ? '' : 'none';
  document.getElementById('despOverlay').classList.add('open');
  setTimeout(() => document.getElementById('fDespDesc').focus(), 50);
}

function closeDespModal() { document.getElementById('despOverlay').classList.remove('open'); editDespId = null; }

async function salvarDesp() {
  const desc = document.getElementById('fDespDesc').value.trim();
  if (!desc) { toast('⚠️ Preencha a descrição'); return; }
  const valor = parseCur(document.getElementById('fDespValor').value) || 0;
  const g = gestaoExclusiva.find(x => x.id === editDespGestaoId); if (!g) return;
  if (!g.dados.despesas) g.dados.despesas = [];
  const desp = { id: editDespId || Date.now().toString(), desc, valor, data: document.getElementById('fDespData').value };
  if (editDespId) {
    const idx = g.dados.despesas.findIndex(x => x.id === editDespId);
    if (idx >= 0) g.dados.despesas[idx] = desp; else g.dados.despesas.push(desp);
  } else {
    g.dados.despesas.push(desp);
  }
  const { error } = await db().from('gestao_exclusiva').update({ dados: g.dados, updated_at: new Date().toISOString() }).eq('id', editDespGestaoId);
  if (error) { toast('❌ ' + error.message); return; }
  toast(editDespId ? '✅ Despesa atualizada' : '✅ Despesa adicionada');
  closeDespModal();
  renderGestaoDetalhe();
}

async function excluirDesp() {
  if (!editDespId || !confirm('Excluir esta despesa?')) return;
  const g = gestaoExclusiva.find(x => x.id === editDespGestaoId); if (!g) return;
  g.dados.despesas = (g.dados.despesas || []).filter(x => x.id !== editDespId);
  const { error } = await db().from('gestao_exclusiva').update({ dados: g.dados, updated_at: new Date().toISOString() }).eq('id', editDespGestaoId);
  if (error) { toast('❌ ' + error.message); return; }
  toast('🗑️ Despesa excluída');
  closeDespModal();
  renderGestaoDetalhe();
}

