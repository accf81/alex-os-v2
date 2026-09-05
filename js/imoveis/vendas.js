// js/imoveis/vendas.js — Alex OS v2
// Aba Vendas/Fechamentos + KPIs Pandora.
// Extraído de imoveis.html em 05/07/2026 (item 12.4, extração 2 — Claude Code Opus 4.8).
// Depende de: core.js (estado, toast, fmtMoeda, parseCur/setCur, fmtCurInput/fmtTelInput,
//   emitirTarefa, carregarFechamentos, todayISO/fmtDate) + Carteira/Leads (autocompletes) em runtime.
// Carregado ANTES do <script> inline (ordem: core → condominios → vendas → inline/start),
// para que init() e showTab() (no core) encontrem carregarFechamentos/renderVendas/renderKPIs.

// ── VENDAS / FECHAMENTOS ──────────────────────────────────────────────────────

const ETAPAS = ['proposta','aceite','contrato','assinatura','escritura'];
const ETAPA_LABEL = { proposta:'Proposta', aceite:'Aceite', contrato:'Contrato', assinatura:'Assinatura', escritura:'Escritura' };

// ── Render lista de cards ─────────────────────────────────────────────────────
function renderVendas() {
  const el = document.getElementById('vendasList');
  if (!el) return;
  el.classList.remove('loading');   // tira o flex-centralizado do spinner inicial (senão a grade não preenche a largura)
  if (!fechamentos.length) {
    el.innerHTML = '<div class="card venda-empty"><div class="venda-empty-title">Nenhum fechamento ainda</div><div class="venda-empty-hint">Clique em "+ Novo fechamento" para registrar uma venda.</div></div>';
    return;
  }
  // Card de venda ATIVA (esquerda 2/3): comprador no título, imóvel, valores, roadmap embaixo
  const cardAtivo = (f) => {
    const etapaIdx = ETAPAS.indexOf(f.etapa || 'proposta');
    const icoCheck = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    const progresso = ETAPAS.map((e, i) => {
      const done = i <= etapaIdx, cur = i === etapaIdx;
      return '<div class="venda-step-wrap">' +
        '<div class="venda-step' + (done ? (cur && e !== 'escritura' ? ' cur' : ' done') : '') + '">' + (done ? (cur && e !== 'escritura' ? '●' : icoCheck) : i + 1) + '</div>' +
        '<div class="venda-step-lbl' + (cur ? ' cur' : '') + '">' + ETAPA_LABEL[e] + '</div>' +
      '</div>' +
      (i < ETAPAS.length - 1 ? '<div class="venda-connector' + (i < etapaIdx ? ' done' : '') + '"></div>' : '');
    }).join('');
    const temLanc = f.parcela1_lanc_id || f.parcela2_lanc_id;
    return '<div class="card venda-card" onclick="openVendasFicha(\'' + f.id + '\')">' +
      '<div class="venda-card-hdr">' +
        '<div><div class="venda-card-comprador">' + (f.comprador || '—') + '</div>' +
          '<div class="venda-card-imovel">' + (f.imovel || '—') + '</div></div>' +
        '<div class="venda-card-valores">' +
          '<div class="venda-card-lbl">Venda</div>' +
          '<div class="venda-card-venda">' + fmtMoeda(f.valor_venda || 0) + '</div>' +
          '<div class="venda-card-lbl">A receber (você)</div>' +
          '<div class="venda-card-alex">' + fmtMoeda(f.valor_alex || 0) + '</div>' +
          '<div style="margin-top:6px">' + (temLanc ? '<span class="gest-outline-badge success">' + icoCheck + 'No FMS</span>' : '<span class="gest-tag-gray">Sem lançamento</span>') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="venda-steps">' + progresso + '</div>' +
    '</div>';
  };
  // Item de venda PERDIDA (painel direito 1/3)
  const itemPerd = (f) => {
    const p = (f.marcos && f.marcos.perdida) || {};
    const dBR = p.data ? p.data.split('-').reverse().join('/') : '';
    return '<div class="perd-item" onclick="openVendasFicha(\'' + f.id + '\')">' +
      '<div class="perd-item-comprador">' + (f.comprador || '—') + '</div>' +
      '<div class="perd-item-imovel">' + (f.imovel || '—') + '</div>' +
      '<div class="perd-item-motivo">' + (p.motivo || 'Perdida') + (dBR ? ' · ' + dBR : '') + '</div>' +
    '</div>';
  };

  const ativos   = fechamentos.filter(f => !(f.marcos && f.marcos.perdida));
  const perdidas = fechamentos.filter(f => f.marcos && f.marcos.perdida);

  const icoBriefcase = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>';
  const icoXCirc     = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

  const ativasHtml = '<div class="venda-col-h">' + icoBriefcase + 'Em andamento <span style="color:var(--muted);font-weight:500;text-transform:none;letter-spacing:0">' + ativos.length + '</span></div>' +
    (ativos.length ? ativos.map(cardAtivo).join('')
      : '<div class="card venda-empty"><div class="venda-empty-title">Nenhuma venda ativa</div><div class="venda-empty-hint">Clique em "+ Novo fechamento".</div></div>');

  const PERD_VIS = 4;   // quantas perdidas mostra antes do "ver todas"
  const visiveis = perdidas.slice(0, PERD_VIS), resto = perdidas.slice(PERD_VIS);
  const perdHtml =
    '<div class="venda-col-h" style="color:var(--danger);cursor:pointer" onclick="toggleVendasPerdidas()">' +
      icoXCirc + 'Perdidas <span style="color:var(--muted);font-weight:500;text-transform:none;letter-spacing:0">' + perdidas.length + '</span>' +
      '<span class="arrow" id="vpArrow" style="margin-left:auto;color:var(--muted)">' + (perdidas.length ? '▾' : '') + '</span></div>' +
    '<div class="perd-panel" id="vendasPerdidasBody">' +
      (perdidas.length
        ? visiveis.map(itemPerd).join('') +
          (resto.length ? '<div id="vpResto" style="display:none">' + resto.map(itemPerd).join('') + '</div>' +
            '<div class="perd-more" onclick="verTodasPerdidas()">ver todas (' + perdidas.length + ')</div>' : '')
        : '<div class="perd-empty">Nenhuma venda perdida.</div>') +
    '</div>';

  // Sem perdidas → ativas ocupam a tela toda
  el.innerHTML = perdidas.length
    ? '<div class="venda-layout"><div>' + ativasHtml + '</div><div>' + perdHtml + '</div></div>'
    : ativasHtml;
}
function toggleVendasPerdidas() {
  const b = document.getElementById('vendasPerdidasBody'); if (!b) return;
  const a = document.getElementById('vpArrow');
  const open = b.style.display !== 'none';
  b.style.display = open ? 'none' : '';
  if (a) a.textContent = open ? '▸' : '▾';
}
function verTodasPerdidas() {
  const r = document.getElementById('vpResto'); if (r) r.style.display = '';
  const m = document.querySelector('.perd-more'); if (m) m.style.display = 'none';
}

// ── Abrir ficha ───────────────────────────────────────────────────────────────
async function openVendasFicha(id) {
  editFechId = id || null;
  const f = id ? fechamentos.find(x => x.id === id) : null;
  const n = v => v != null ? String(v) : '';

  // Imóvel
  document.getElementById('vfImovelId').value = f?.imovel_id || '';
  document.getElementById('vfImovelBusca').value = '';
  const selIm = document.getElementById('vfImovelSel');
  const selImTxt = document.getElementById('vfImovelSelTxt');
  if (f?.imovel) {
    selIm.style.display = 'flex'; selImTxt.textContent = f.imovel;
    document.getElementById('vfImovelBusca').style.display = 'none';
  } else {
    selIm.style.display = 'none';
    document.getElementById('vfImovelBusca').style.display = '';
  }
  document.getElementById('vfMiniImovel').style.display = 'none';
  document.getElementById('vfImovelDrop').style.display = 'none';

  // Comprador
  document.getElementById('vfCompradorId').value = f?.comprador_id || '';
  document.getElementById('vfCompradorBusca').value = '';
  const selCo = document.getElementById('vfCompradorSel');
  const selCoTxt = document.getElementById('vfCompradorSelTxt');
  if (f?.comprador) {
    selCo.style.display = 'flex'; selCoTxt.textContent = f.comprador;
    document.getElementById('vfCompradorBusca').style.display = 'none';
  } else {
    selCo.style.display = 'none';
    document.getElementById('vfCompradorBusca').style.display = '';
  }
  document.getElementById('vfMiniComprador').style.display = 'none';
  document.getElementById('vfCompradorDrop').style.display = 'none';

  // Campos
  document.getElementById('vfEtapa').value        = f?.etapa || 'proposta';
  setCur('vfValorVenda',  f?.valor_venda);
  setCur('vfComissao',    f?.comissao_total);
  document.getElementById('vfComissaoPct').value  = f?.comissao_pct != null ? f.comissao_pct : '';
  document.getElementById('vfOutroCorretor').checked = f ? !!f.outro_corretor : false;
  if (f?.tipo_corretor) document.getElementById('vfTipoCorretor').value = f.tipo_corretor;
  document.getElementById('vfPctPilar').value     = f?.pct_pilar != null ? f.pct_pilar : '';
  setCur('vfValorPilar',  f?.valor_pilar);
  setCur('vfValorAlex',   f?.valor_alex);
  document.getElementById('vfTipoPag').value      = f?.tipo_pagamento || 'avista';
  setCur('vfRecProprios', f?.valor_recursos_proprios);
  setCur('vfFinanciado',  f?.valor_financiado);
  document.getElementById('vfPagObs').value       = f?.pagamento_obs || '';
  document.getElementById('vfNParcelas').value    = f?.n_parcelas || 1;
  document.getElementById('vfP1Pct').value        = f?.parcela1_pct != null ? f.parcela1_pct : '';
  document.getElementById('vfP1Data').value       = f?.parcela1_data || '';
  document.getElementById('vfP2Pct').value        = f?.parcela2_pct != null ? f.parcela2_pct : '';
  document.getElementById('vfP2Data').value       = f?.parcela2_data || '';
  document.getElementById('vfObs').value          = f?.obs || '';

  document.getElementById('vfTitulo').textContent = f ? 'Editar Fechamento' : 'Novo Fechamento';
  document.getElementById('btnVFDel').style.display  = f ? '' : 'none';

  // Checar se lançamentos FMS ainda existem
  let mostrarBtnLanc = f && !f.parcela1_lanc_id;
  if (f?.parcela1_lanc_id) {
    const { data: lancCheck } = await db().from('lancamentos').select('id').eq('id', f.parcela1_lanc_id).maybeSingle();
    if (!lancCheck) {
      // Lançamento foi excluído — limpar IDs e mostrar botão
      await db().from('fechamentos').update({ parcela1_lanc_id: null, parcela2_lanc_id: null, updated_at: new Date().toISOString() }).eq('id', f.id);
      const idx = fechamentos.findIndex(x => x.id === f.id);
      if (idx >= 0) { fechamentos[idx].parcela1_lanc_id = null; fechamentos[idx].parcela2_lanc_id = null; }
      mostrarBtnLanc = true;
    }
  }
  document.getElementById('btnVFLanc').style.display = mostrarBtnLanc ? '' : 'none';

  onOutroCorretorChange();
  onNParcelasChange();
  onTipoPagChange();
  onVfEtapaChange();

  // 13.2 — estado de venda perdida
  const perd = f && f.marcos && f.marcos.perdida;
  const badge = document.getElementById('vfPerdidaBadge');
  if (perd) {
    const dBR = perd.data ? perd.data.split('-').reverse().join('/') : '';
    badge.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Venda perdida' + (perd.motivo ? ' · ' + perd.motivo : '') + (dBR ? ' · ' + dBR : '');
    badge.style.display = '';
    document.getElementById('btnVFVendido').style.display = 'none';
  } else {
    badge.style.display = 'none';
  }
  document.getElementById('btnVFPerdida').style.display  = (f && !perd) ? '' : 'none';
  document.getElementById('btnVFReativar').style.display = perd ? '' : 'none';

  document.getElementById('vendasOverlay').classList.add('open');
}

// 4d.1 — botão "Marcar como Vendido" só na Escritura, com imóvel ligado e ainda não vendido.
function onVfEtapaChange() {
  const etapa  = document.getElementById('vfEtapa').value;
  const imId   = document.getElementById('vfImovelId').value;
  const cart   = imId ? (carteiraItems || []).find(c => c.id === imId) : null;
  const jaVend = cart && cart.status === 'vendido';
  const mostrar = etapa === 'escritura' && !!imId && !jaVend;
  document.getElementById('btnVFVendido').style.display = mostrar ? '' : 'none';
}

// ── 13.2 — Venda perdida (marcos.perdida no fechamento) ───────────────────────
let vendaPerdidaFechId = null;
function openVendaPerdida(id) {
  if (!id) return;
  vendaPerdidaFechId = id;
  const f = fechamentos.find(x => x.id === id) || {};
  document.getElementById('vendaPerdidaInfo').innerHTML =
    '<strong>' + (f.comprador || '—') + '</strong>' + (f.imovel ? ' · ' + f.imovel : '');
  document.getElementById('fVPData').value   = todayISO();
  document.getElementById('fVPMotivo').value = 'Comprou com outro corretor';
  document.getElementById('fVPObs').value    = '';
  document.getElementById('vendaPerdidaOverlay').classList.add('open');
}
function closeVendaPerdida() {
  document.getElementById('vendaPerdidaOverlay').classList.remove('open');
  vendaPerdidaFechId = null;
}
async function confirmarVendaPerdida() {
  const id = vendaPerdidaFechId; if (!id) return;
  const f = fechamentos.find(x => x.id === id) || {};
  const obs = document.getElementById('fVPObs').value.trim();
  const marcos = Object.assign({}, f.marcos || {});
  marcos.perdida = {
    data:   document.getElementById('fVPData').value || todayISO(),
    motivo: document.getElementById('fVPMotivo').value,
    obs:    obs || null
  };
  const { error } = await db().from('fechamentos').update({ marcos, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { toast('❌ ' + error.message); return; }
  f.marcos = marcos;
  toast('Venda marcada como perdida');
  closeVendaPerdida(); closeVendasFicha(); renderVendas();
}
async function reativarVenda() {
  const id = editFechId; if (!id) return;
  if (!confirm('Reativar esta venda? Ela volta para o funil ativo.')) return;
  const f = fechamentos.find(x => x.id === id) || {};
  const marcos = Object.assign({}, f.marcos || {});
  delete marcos.perdida;
  const { error } = await db().from('fechamentos').update({ marcos, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { toast('❌ ' + error.message); return; }
  f.marcos = marcos;
  toast('Venda reativada');
  closeVendasFicha(); renderVendas();
}

async function confirmarVendido() {
  const f = editFechId ? fechamentos.find(x => x.id === editFechId) : null;
  const imId = document.getElementById('vfImovelId').value;
  if (!imId) { toast('⚠️ Vincule o imóvel antes de marcar como vendido'); return; }
  const cart = (carteiraItems || []).find(c => c.id === imId);
  const end  = cart ? ([cart.rua, cart.numero].filter(Boolean).join(', ') || cart.codigo || 'imóvel') : (f?.imovel || 'imóvel');
  if (!confirm('Marcar este imóvel como VENDIDO?\n' + end + '\n\n• Sai da vitrine (status Vendido)\n• Encerra a gestão como Vendida (se exclusivo)\n• Histórico e documentos ficam guardados')) return;

  // 1) Núcleo (Carteira): status Vendido + sai da vitrine. Zera o booleano legado 'exclusivo'.
  const { error: e1 } = await db().from('imoveis_carteira').update({ status: 'vendido', exclusivo: false, publicavel: false, updated_at: new Date().toISOString() }).eq('id', imId);
  if (e1) { toast('❌ ' + e1.message); return; }

  // 2) Gestão ligada (se houver): encerra como 'vendida' — distingue venda de churn por vencimento.
  if (cart && cart.gestao_id) {
    const g = (gestaoExclusiva || []).find(x => x.id === cart.gestao_id);
    if (g) {
      const dados = { ...(g.dados || {}), status: 'vendida', encerrada_em: todayISO() };
      await db().from('gestao_exclusiva').update({ dados, updated_at: new Date().toISOString() }).eq('id', g.id);
    }
  }

  // 3) Tarefa: lançar a comissão no FMS (se ainda não lançou).
  if (!f || !(f.parcela1_lanc_id || f.parcela2_lanc_id)) {
    emitirTarefa('Lançar comissão da venda: ' + end, { carteira_id: (cart && cart.id) || null, rotulo: 'Pagamento' });
  }

  toast('Imóvel vendido — saiu da vitrine');
  document.getElementById('btnVFVendido').style.display = 'none';
  await Promise.all([carregarCarteira(), carregarGestao()]);
  if (typeof filtrarCarteira === 'function') filtrarCarteira();
  if (typeof renderGestao === 'function') renderGestao();
}

// ── Autocomplete Imóvel ───────────────────────────────────────────────────────
function vfBuscarImovel() {
  const q = (document.getElementById('vfImovelBusca').value || '').toLowerCase();
  const drop = document.getElementById('vfImovelDrop');
  if (!q) { drop.style.display = 'none'; return; }
  const res = (carteiraItems || []).filter(i => {
    const txt = [(i.rua||''), (i.numero||''), (i.bairro||''), (i.codigo||''), (i.tipo||'')].join(' ').toLowerCase();
    return txt.includes(q);
  }).slice(0,8);
  if (!res.length) { drop.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--muted)">Não encontrado — use "+" para cadastrar</div>'; drop.style.display = ''; return; }
  drop.innerHTML = res.map(i => {
    const label = [i.rua, i.numero, i.complemento].filter(Boolean).join(', ') || i.codigo || '—';
    const sub   = [i.bairro, i.tipo].filter(Boolean).join(' · ');
    const safeLbl = label.replace(/'/g,"\\'");
    return `<div style="padding:8px 12px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border)" onmousedown="vfSelecionarImovel('${i.id}','${safeLbl}')">
      ${label} <span style="font-size:11px;color:var(--muted)">${sub}</span>
    </div>`;
  }).join('');
  drop.style.display = '';
}

function vfSelecionarImovel(id, label) {
  document.getElementById('vfImovelId').value = id;
  document.getElementById('vfImovelSelTxt').textContent = label;
  document.getElementById('vfImovelSel').style.display = 'flex';
  document.getElementById('vfImovelBusca').style.display = 'none';
  document.getElementById('vfImovelDrop').style.display = 'none';
}

function vfClearImovel() {
  document.getElementById('vfImovelId').value = '';
  document.getElementById('vfImovelSel').style.display = 'none';
  document.getElementById('vfImovelBusca').style.display = '';
  document.getElementById('vfImovelBusca').value = '';
  document.getElementById('vfImovelBusca').focus();
}

function vfToggleMiniImovel() {
  const el = document.getElementById('vfMiniImovel');
  el.style.display = el.style.display === 'none' ? '' : 'none';
  if (el.style.display !== 'none') document.getElementById('vfMIEnd').focus();
}

async function vfCriarImovelRapido() {
  const end = document.getElementById('vfMIEnd').value.trim();
  if (!end) { toast('⚠️ Preencha o endereço'); return; }
  const tipo = document.getElementById('vfMITipo').value;
  const { data, error } = await db().from('imoveis_carteira').insert({ rua: end, tipo, status: 'vendido', updated_at: new Date().toISOString() }).select('id').single();
  if (error) { toast('❌ Erro: ' + error.message); return; }
  await carregarCarteira();
  vfSelecionarImovel(data.id, end + (tipo ? ' · ' + tipo : ''));
  document.getElementById('vfMiniImovel').style.display = 'none';
  document.getElementById('vfMIEnd').value = '';
  emitirTarefa('Completar ficha do imóvel vendido: ' + end, { carteira_id: data.id, rotulo: 'Imóvel' });
  toast('✅ Imóvel criado (Vendido) — tarefa no Dia para completar o cadastro');
}

// ── Autocomplete Comprador ────────────────────────────────────────────────────
function vfBuscarComprador() {
  const q = (document.getElementById('vfCompradorBusca').value || '').toLowerCase();
  const drop = document.getElementById('vfCompradorDrop');
  if (!q) { drop.style.display = 'none'; return; }
  const pessoas = window._pessoas || [];
  const res = pessoas.filter(p => (p.nome||'').toLowerCase().includes(q)).slice(0,8);
  if (!res.length) { drop.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--muted)">Não encontrado — use "+" para cadastrar</div>'; drop.style.display = ''; return; }
  drop.innerHTML = res.map(p => `<div style="padding:8px 12px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border)" onmousedown="vfSelecionarComprador('${p.id}','${(p.nome||'').replace(/'/g,"\\'")}')">
    ${p.nome} <span style="font-size:11px;color:var(--muted)">${p.tel||''}</span>
  </div>`).join('');
  drop.style.display = '';
}

function vfSelecionarComprador(id, label) {
  document.getElementById('vfCompradorId').value = id;
  document.getElementById('vfCompradorSelTxt').textContent = label;
  document.getElementById('vfCompradorSel').style.display = 'flex';
  document.getElementById('vfCompradorBusca').style.display = 'none';
  document.getElementById('vfCompradorDrop').style.display = 'none';
}

function vfClearComprador() {
  document.getElementById('vfCompradorId').value = '';
  document.getElementById('vfCompradorSel').style.display = 'none';
  document.getElementById('vfCompradorBusca').style.display = '';
  document.getElementById('vfCompradorBusca').value = '';
  document.getElementById('vfCompradorBusca').focus();
}

function vfToggleMiniComprador() {
  const el = document.getElementById('vfMiniComprador');
  el.style.display = el.style.display === 'none' ? '' : 'none';
  if (el.style.display !== 'none') document.getElementById('vfMCNome').focus();
}

async function vfCriarCompradorRapido() {
  const nome = document.getElementById('vfMCNome').value.trim();
  if (!nome) { toast('⚠️ Preencha o nome'); return; }
  const tel = document.getElementById('vfMCTel').value.trim();
  const { data, error } = await db().from('pessoas').insert({ nome, tel: tel || null, tipos: ['Comprador'], updated_at: new Date().toISOString() }).select('id').single();
  if (error) { toast('❌ Erro: ' + error.message); return; }
  // Recarregar lista de pessoas
  const { data: pList } = await db().from('pessoas').select('id,nome,tel').order('nome');
  window._pessoas = pList || [];
  vfSelecionarComprador(data.id, nome);
  document.getElementById('vfMiniComprador').style.display = 'none';
  document.getElementById('vfMCNome').value = '';
  document.getElementById('vfMCTel').value = '';
  addDiaTask('Completar cadastro do contato: ' + nome, { pessoa_id: data.id, rotulo: 'Comprador' });
  toast('✅ Contato criado — tarefa adicionada no DIA para completar o cadastro');
}

// ── Cálculos bidirecionais ────────────────────────────────────────────────────
function vfCalc(changed) {
  const venda = parseCur(document.getElementById('vfValorVenda').value) || 0;
  const com   = parseCur(document.getElementById('vfComissao').value) || 0;
  const pct   = parseFloat(document.getElementById('vfComissaoPct').value) || 0;
  if (changed === 'venda' || changed === 'comissao') {
    if (venda > 0 && com > 0) document.getElementById('vfComissaoPct').value = (com / venda * 100).toFixed(2);
  } else if (changed === 'pct') {
    if (venda > 0 && pct > 0) setCur('vfComissao', venda * pct / 100);
  }
  vfCalcAlex();
}

function vfGetParteAlexBruta() {
  const com = parseCur(document.getElementById('vfComissao').value) || 0;
  const outro = document.getElementById('vfOutroCorretor').checked;
  const tipo = document.getElementById('vfTipoCorretor')?.value;
  if (outro && tipo) return tipo === 'autonomo' ? com * 0.6 : com * 0.5;
  return com;
}

function vfCalcPilar(changed) {
  const bruta = vfGetParteAlexBruta();
  if (!bruta) return;
  const pct   = parseFloat(document.getElementById('vfPctPilar').value) || 0;
  const valor = parseCur(document.getElementById('vfValorPilar').value) || 0;
  if (changed === 'pct') {
    setCur('vfValorPilar', bruta * pct / 100);
  } else if (changed === 'valor') {
    document.getElementById('vfPctPilar').value = (valor / bruta * 100).toFixed(2);
  }
  vfCalcAlex();
}

function vfCalcAlex() {
  const bruta    = vfGetParteAlexBruta();
  const valPilar = parseCur(document.getElementById('vfValorPilar').value) || 0;
  const liquido  = bruta - valPilar;
  if (liquido >= 0) setCur('vfValorAlex', liquido);
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────
function onOutroCorretorChange() {
  document.getElementById('vfOutroCorretorRow').style.display = document.getElementById('vfOutroCorretor').checked ? '' : 'none';
}

function onNParcelasChange() {
  document.getElementById('vfP2Row').style.display = parseInt(document.getElementById('vfNParcelas').value) >= 2 ? '' : 'none';
}

function onTipoPagChange() {
  const tipo = document.getElementById('vfTipoPag').value;
  document.getElementById('vfFinRow').style.display      = (tipo === 'financiamento' || tipo === 'consorcio') ? '' : 'none';
  document.getElementById('vfOutroPagRow').style.display = tipo === 'outro' ? '' : 'none';
  const label = document.getElementById('vfFinLabel');
  if (label) label.textContent = tipo === 'consorcio' ? 'Valor consórcio (R$)' : 'Valor financiado (R$)';
}

// ── Salvar / Excluir ──────────────────────────────────────────────────────────
async function salvarFechamento() {
  const imovelId  = document.getElementById('vfImovelId').value;
  const imovelTxt = document.getElementById('vfImovelSelTxt').textContent.trim();
  if (!imovelTxt && !imovelId) { toast('⚠️ Selecione ou cadastre o imóvel'); return; }

  // Validar soma das parcelas
  const nParc = parseInt(document.getElementById('vfNParcelas').value) || 1;
  if (nParc >= 2) {
    const p1 = parseFloat(document.getElementById('vfP1Pct').value) || 0;
    const p2 = parseFloat(document.getElementById('vfP2Pct').value) || 0;
    if (Math.abs(p1 + p2 - 100) > 0.01) {
      toast('⚠️ A soma das parcelas deve ser 100% (atual: ' + (p1+p2).toFixed(0) + '%)');
      return;
    }
  }

  // 5.B — carimba a data de cada etapa atingida (só na 1ª vez). Base dos KPIs de VGV/tempo de venda.
  const etapaAtual = document.getElementById('vfEtapa').value;
  const fechAtual  = editFechId ? (fechamentos || []).find(x => x.id === editFechId) : null;
  const fechMarcos = Object.assign({}, (fechAtual && fechAtual.marcos) || {});
  if (!fechMarcos[etapaAtual]) fechMarcos[etapaAtual] = todayISO();

  const payload = {
    imovel:          imovelTxt,
    imovel_id:       imovelId || null,
    comprador:       document.getElementById('vfCompradorSelTxt').textContent.trim() || null,
    comprador_id:    document.getElementById('vfCompradorId').value || null,
    etapa:           etapaAtual,
    marcos:          fechMarcos,
    valor_venda:     parseCur(document.getElementById('vfValorVenda').value),
    comissao_total:  parseCur(document.getElementById('vfComissao').value),
    comissao_pct:    parseFloat(document.getElementById('vfComissaoPct').value)||null,
    outro_corretor:  document.getElementById('vfOutroCorretor').checked,
    tipo_corretor:   document.getElementById('vfTipoCorretor')?.value || null,
    pct_pilar:       parseFloat(document.getElementById('vfPctPilar').value)||null,
    valor_pilar:     parseCur(document.getElementById('vfValorPilar').value),
    valor_alex:      parseCur(document.getElementById('vfValorAlex').value),
    tipo_pagamento:  document.getElementById('vfTipoPag').value,
    valor_recursos_proprios: parseCur(document.getElementById('vfRecProprios').value),
    valor_financiado:        parseCur(document.getElementById('vfFinanciado').value),
    pagamento_obs:   document.getElementById('vfPagObs').value.trim()||null,
    n_parcelas:      nParc,
    parcela1_pct:    parseFloat(document.getElementById('vfP1Pct').value)||null,
    parcela1_data:   document.getElementById('vfP1Data').value||null,
    parcela2_pct:    parseFloat(document.getElementById('vfP2Pct').value)||null,
    parcela2_data:   document.getElementById('vfP2Data').value||null,
    obs:             document.getElementById('vfObs').value.trim()||null,
    updated_at:      new Date().toISOString()
  };

  let error;
  if (editFechId) {
    ({ error } = await db().from('fechamentos').update(payload).eq('id', editFechId));
  } else {
    ({ error } = await db().from('fechamentos').insert(payload));
  }
  if (error) { toast('❌ Erro: ' + error.message); return; }
  toast(editFechId ? '✅ Atualizado' : '✅ Fechamento criado');
  closeVendasFicha();
  await carregarFechamentos();
  renderVendas();
}

async function excluirFechamento() {
  if (!editFechId || !confirm('Excluir este fechamento?')) return;
  const { error } = await db().from('fechamentos').delete().eq('id', editFechId);
  if (error) { toast('❌ Erro: ' + error.message); return; }
  toast('🗑️ Fechamento excluído');
  closeVendasFicha();
  await carregarFechamentos();
  renderVendas();
}

async function criarLancamentosFechamento() {
  const f = fechamentos.find(x => x.id === editFechId);
  if (!f || !f.valor_alex) { toast('⚠️ Preencha o valor líquido de Alex primeiro'); return; }
  if (!confirm('Criar lançamentos pendentes no FMS para este fechamento?')) return;
  const n = f.n_parcelas || 1;
  const desc = 'Comissão: ' + (f.imovel||'imóvel');
  const ids = {};
  for (let i = 1; i <= n; i++) {
    const pct   = parseFloat(i===1 ? f.parcela1_pct : f.parcela2_pct) || (100/n);
    const data  = (i===1 ? f.parcela1_data : f.parcela2_data) || new Date().toISOString().split('T')[0];
    const valor = Math.round(f.valor_alex * (pct/100) * 100) / 100;
    const { data: lanc, error } = await db().from('lancamentos').insert({
      data, descricao: desc + (n>1 ? ` (parcela ${i}/${n})` : ''),
      valor, tipo: 'receita', conta: 'Pandora Homes',
      pago: false, obs: 'Gerado via módulo Vendas', updated_at: new Date().toISOString()
    }).select('id').single();
    if (error) { toast('❌ Erro parcela ' + i + ': ' + error.message); return; }
    ids['parcela' + i + '_lanc_id'] = lanc.id;
  }
  await db().from('fechamentos').update({ ...ids, updated_at: new Date().toISOString() }).eq('id', editFechId);
  toast('✅ Lançamento' + (n>1?'s criados':' criado') + ' no FMS — aparece em A Receber');
  document.getElementById('btnVFLanc').style.display = 'none';
  await carregarFechamentos();
  renderVendas();
}

function closeVendasFicha() {
  document.getElementById('vendasOverlay').classList.remove('open');
  editFechId = null;
  // Etapa 2 (bar de ações) — se veio de um imóvel, volta pra ele ao fechar/cancelar
  if (_negRetorno) {
    const r = _negRetorno; _negRetorno = null;
    if (r.tipo === 'carteira') { showTab('carteira'); openCarteiraView(r.id); }
    else if (r.tipo === 'gestao') { showTab('gestao'); openGestaoDetalhe(r.id); }
  }
}

// ══ Fatia 5 — KPIs Pandora ═══════════════════════════════════════════════════
let kpiPeriodo = 'mes';   // 'mes' | 'tri' | 'ano'  (resultado). Atividade é sempre semanal.

function kpiParse(ds) {
  if (!ds) return null;
  const m = String(ds).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function kpiNoPeriodo(ds) {
  const d = kpiParse(ds); if (!d) return false;
  const now = new Date();
  if (kpiPeriodo === 'ano') return d.getFullYear() === now.getFullYear();
  if (kpiPeriodo === 'tri') return d.getFullYear() === now.getFullYear() && Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}
function kpiNoAno(ds) { const d = kpiParse(ds); return d ? d.getFullYear() === new Date().getFullYear() : false; }
function kpiNaSemana(ds) {
  // Semana corrente: segunda 00:00 → domingo 23:59
  const d = kpiParse(ds); if (!d) return false;
  const now = new Date();
  const offset = (now.getDay() + 6) % 7;                 // 0 = segunda … 6 = domingo
  const seg = new Date(now); seg.setHours(0,0,0,0); seg.setDate(now.getDate() - offset);
  const dom = new Date(seg); dom.setDate(seg.getDate() + 6); dom.setHours(23,59,59,999);
  return d >= seg && d <= dom;
}
function kpiPeriodoLabel() {
  const now = new Date();
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  if (kpiPeriodo === 'ano') return String(now.getFullYear());
  if (kpiPeriodo === 'tri') return (Math.floor(now.getMonth() / 3) + 1) + 'º trimestre/' + now.getFullYear();
  return meses[now.getMonth()] + '/' + now.getFullYear();
}
function kpiMoneyShort(v) {
  v = Number(v) || 0;
  if (Math.abs(v) >= 1e6) return 'R$ ' + (v / 1e6).toFixed(2).replace('.', ',') + 'M';
  if (Math.abs(v) >= 1e3) return 'R$ ' + Math.round(v / 1e3) + 'k';
  return 'R$ ' + Math.round(v).toLocaleString('pt-BR');
}
function setKpiPeriodo(p) { kpiPeriodo = p; renderKPIs(); }

function renderKPIs() {
  const el = document.getElementById('kpisBox'); if (!el) return;
  const caps  = imoveis || [];
  const fechs = (typeof fechamentos !== 'undefined' ? fechamentos : []) || [];
  const carts = carteiraItems || [];
  const gests = gestaoExclusiva || [];

  // ── 1. Funil de captação (CUMULATIVO pela etapa atual) ──
  // Os marcos guardam só a etapa atual; quem está em 'assinado' já passou por todas as
  // anteriores. Então conta por etapa alcançada (idx do estágio >= idx da etapa), não por marco.
  const ETAPAS_FUNIL = [
    { id:'prospeccao', label:'Prospecção' },
    { id:'visita1',    label:'1ª Visita' },
    { id:'acm',        label:'ACM' },
    { id:'assinado',   label:'Contrato (GE)' },
  ];
  const ORDER = ETAPAS_FUNIL.map(e => e.id);
  const refData = c => (c.marcos && c.marcos[c.estagio]) || c.created_at;       // data da etapa atual
  const capsFunil = caps.filter(c => c.estagio !== 'perdido' && kpiNoPeriodo(refData(c)));
  const funilN = ORDER.map((st, i) => capsFunil.filter(c => ORDER.indexOf(c.estagio) >= i).length);
  const maxFunil = Math.max(1, funilN[0]);

  // ── 2. Exclusividade (meta anual 20) ──
  const assinadosAno = caps.filter(c => c.marcos && kpiNoAno(c.marcos.assinado)).length;
  const convExcl = funilN[0] ? Math.round(funilN[3] / funilN[0] * 100) : 0;   // assinados ÷ prospectados no período
  const META = 20;
  const pctMeta = Math.min(100, Math.round(assinadosAno / META * 100));

  // ── 3. VGV no período (assinatura do CCV) ──
  const vendasCCV = fechs.filter(f => f.marcos && !f.marcos.perdida && kpiNoPeriodo(f.marcos.assinatura));
  const vgv = vendasCCV.reduce((s, f) => s + (Number(f.valor_venda) || 0), 0);
  const ticket = vendasCCV.length ? vgv / vendasCCV.length : 0;

  // ── 4. Tempo de venda (anúncio → assinatura) + dias no mercado ──
  const tempos = [];
  fechs.forEach(f => {
    if (!f.marcos || !kpiNoPeriodo(f.marcos.assinatura)) return;
    const cart = carts.find(c => c.id === f.imovel_id);
    const ini = cart && kpiParse(cart.anunciado_em);
    const fim = kpiParse(f.marcos.assinatura);
    if (ini && fim) tempos.push(Math.max(0, Math.round((fim - ini) / 86400000)));
  });
  const tempoMedio = tempos.length ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null;
  const ativosMercado = carts.filter(c => c.publicavel !== false && c.status !== 'vendido' && c.anunciado_em);
  const diasMercado = ativosMercado.length
    ? Math.round(ativosMercado.reduce((a, c) => a + Math.max(0, Math.floor((new Date() - kpiParse(c.anunciado_em)) / 86400000)), 0) / ativosMercado.length)
    : null;

  // ── 5. Comissão realizada (escriturada no período) × pipeline (negociações abertas) ──
  const comissaoReal = fechs.filter(f => f.marcos && kpiNoPeriodo(f.marcos.escritura))
    .reduce((s, f) => s + (Number(f.valor_alex) || 0), 0);
  const comissaoPipe = fechs.filter(f => (f.etapa || 'proposta') !== 'escritura' && !f.marcos?.perdida)
    .reduce((s, f) => s + (Number(f.valor_alex) || 0), 0);
  const nPipe = fechs.filter(f => (f.etapa || 'proposta') !== 'escritura' && !f.marcos?.perdida).length;

  // ── 6. Saúde da gestão (ano) ──
  const gAtivas    = gests.filter(g => { const s = (g.dados || {}).status; return !s || s === 'ativa'; }).length;
  const gVendidas  = gests.filter(g => (g.dados || {}).status === 'vendida' && kpiNoAno((g.dados || {}).encerrada_em)).length;
  const gEncerradas= gests.filter(g => (g.dados || {}).status === 'encerrada' && kpiNoAno((g.dados || {}).encerrada_em)).length;
  const gRenovadas = gests.filter(g => Array.isArray((g.dados || {}).renovacoes) && g.dados.renovacoes.length).length;
  const baseRenov  = gRenovadas + gEncerradas;
  const taxaRenov  = baseRenov ? Math.round(gRenovadas / baseRenov * 100) : null;

  // ── 7. Atividade (semana) ──
  const atvProsp = caps.filter(c => c.marcos && kpiNaSemana(c.marcos.prospeccao)).length;
  const atvVis   = (visitasItems || []).filter(v => kpiNaSemana(v.data)).length;
  const atvAcm   = caps.filter(c => c.marcos && kpiNaSemana(c.marcos.acm)).length;

  const seg = (p, lbl) => '<button class="kpi-period' + (kpiPeriodo === p ? ' on' : '') + '" onclick="setKpiPeriodo(\'' + p + '\')">' + lbl + '</button>';

  const funilRows = ETAPAS_FUNIL.map((e, i) => {
    const w = Math.round(funilN[i] / maxFunil * 100);
    const conv = i === 0 ? '' : (funilN[i - 1] ? Math.round(funilN[i] / funilN[i - 1] * 100) + '%' : '—');
    return '<div class="kpi-funnel-row">' +
      '<div class="kpi-funnel-stage">' + e.label + '</div>' +
      '<div class="kpi-funnel-track"><div class="kpi-funnel-bar" style="width:' + Math.max(w, 8) + '%">' + funilN[i] + '</div></div>' +
      '<div class="kpi-funnel-conv">' + conv + '</div>' +
    '</div>';
  }).join('');

  el.className = '';
  el.innerHTML =
    '<div class="kpi-head">' +
      '<div class="kpi-period-seg">' + seg('mes','Mensal') + seg('tri','Trimestral') + seg('ano','Anual') + '</div>' +
      '<div class="kpi-period-lbl">' + kpiPeriodoLabel() + '</div>' +
    '</div>' +

    '<div class="card" style="margin-bottom:14px">' +
      '<div style="padding:14px 16px;border-bottom:1px solid var(--border);background:var(--surface2);display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;font-weight:700">Funil de captação</span><span style="font-size:11px;color:var(--muted)">taxa entre etapas</span></div>' +
      '<div style="padding:16px">' + funilRows + '</div>' +
    '</div>' +

    '<div class="kpi-grid2">' +
      '<div class="card"><div class="kpi-card-hdr">Exclusividade · meta anual</div><div class="kpi-card-body">' +
        '<div style="display:flex;align-items:baseline;gap:10px"><div class="kpi-big col-accent">' + assinadosAno + '</div><div style="color:var(--muted);font-size:13px">de ' + META + ' GE · faltam ' + Math.max(0, META - assinadosAno) + '</div></div>' +
        '<div class="kpi-metabar"><div class="kpi-metabar-fill" style="width:' + pctMeta + '%"></div></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:6px"><span>' + pctMeta + '% da meta</span><span>conversão no período: ' + convExcl + '%</span></div>' +
      '</div></div>' +
      '<div class="card"><div class="kpi-card-hdr">VGV no período <span class="kpi-tag">CCV</span></div><div class="kpi-card-body">' +
        '<div class="kpi-big col-success">' + kpiMoneyShort(vgv) + '</div>' +
        '<div style="color:var(--muted);font-size:13px;margin-top:6px">' + vendasCCV.length + ' venda' + (vendasCCV.length !== 1 ? 's' : '') + ' compromissada' + (vendasCCV.length !== 1 ? 's' : '') + (vendasCCV.length ? ' · ticket ' + kpiMoneyShort(ticket) : '') + '</div>' +
      '</div></div>' +
    '</div>' +

    '<div class="kpi-grid3">' +
      '<div class="card"><div class="kpi-card-hdr">Tempo de venda</div><div class="kpi-card-body">' +
        '<div class="kpi-big">' + (tempoMedio !== null ? tempoMedio : '—') + (tempoMedio !== null ? '<span style="font-size:14px;font-weight:600;color:var(--muted)"> dias</span>' : '') + '</div>' +
        '<div style="color:var(--muted);font-size:12px;margin-top:6px">anúncio → assinatura (média)</div>' +
        '<div style="font-size:12px;margin-top:8px">No mercado: <b>' + (diasMercado !== null ? diasMercado + 'd' : '—') + '</b> em média</div>' +
      '</div></div>' +
      '<div class="card"><div class="kpi-card-hdr">Comissão</div><div class="kpi-card-body">' +
        '<div style="font-size:12px;color:var(--muted)">Realizada (escriturada)</div><div class="kpi-big col-success" style="font-size:22px">' + kpiMoneyShort(comissaoReal) + '</div>' +
        '<div style="font-size:12px;color:var(--muted);margin-top:8px">Em pipeline (' + nPipe + ')</div><div class="kpi-big col-accent" style="font-size:22px">' + kpiMoneyShort(comissaoPipe) + '</div>' +
      '</div></div>' +
      '<div class="card"><div class="kpi-card-hdr">Saúde da gestão</div><div class="kpi-card-body" style="font-size:13px;display:flex;flex-direction:column;gap:8px">' +
        '<div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Ativas</span><b>' + gAtivas + '</b></div>' +
        '<div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Vendidas (ano)</span><b class="col-success">' + gVendidas + '</b></div>' +
        '<div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Encerradas s/ vender</span><b class="col-danger">' + gEncerradas + '</b></div>' +
        '<div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Taxa de renovação</span><b>' + (taxaRenov !== null ? taxaRenov + '%' : '—') + '</b></div>' +
      '</div></div>' +
    '</div>' +

    '<div class="card" style="margin-top:14px"><div style="padding:14px 16px;border-bottom:1px solid var(--border);background:var(--surface2);display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;font-weight:700">Atividade</span><span style="font-size:11px;color:var(--muted)">recorte semanal</span></div>' +
      '<div style="padding:16px"><div class="kpi-grid3">' +
        '<div class="kpi-box"><div class="kpi-box-lbl">Prospecções (semana)</div><div class="kpi-box-val">' + atvProsp + '</div></div>' +
        '<div class="kpi-box"><div class="kpi-box-lbl">Visitas (semana)</div><div class="kpi-box-val">' + atvVis + '</div></div>' +
        '<div class="kpi-box"><div class="kpi-box-lbl">ACMs (semana)</div><div class="kpi-box-val">' + atvAcm + '</div></div>' +
      '</div></div>' +
    '</div>';
}
