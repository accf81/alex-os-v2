// acm.js — abas ACM Lista + Builder (extraído de imoveis.html em 06/07/2026, item 12.4, extração 7 — a última do mapa).
// Depende de: core.js (toast, opcoes, STAGES, loadITBIdb, removeAccentsUpper, setupRuaNumACById), gestao.js/captacao.js (pontes).
// A exportação em HTML (exportACMHtml) vive em acm-export.js, carregado logo depois deste.

// ── ACM Builder: estado ──────────────────────────────────────────────────────
let currentACM       = null;
let acmCondId        = null; // id do condomínio vinculado ao edificio do ACM atual
let acmITBISearchVisible = false;
let acmConcDiscExpanded  = false; // Descartados de Concorrentes abertos/fechados
let acmVendDiscExpanded  = false; // Descartados de Vendidos ITBI abertos/fechados
let acmSimDiscExpanded   = false; // Descartados de Condomínios Similares abertos/fechados
let _acmSaveTimer    = null;
let _acTimer         = null;
let _descontoTimer   = null;

// ── Medição temporária da Fatia 1 (sai na Fatia 7) — cinto de segurança ────────
// Se o navegador servir um core.js VELHO do cache (trava ?v= desencontrada), as
// funções de medição não existem. Medir nunca pode derrubar o ACM: sem elas, a
// medição simplesmente não acontece e a tela segue normal (correção pós-QA P-2).
function _acmMedir(qual, marca, obs) {
  try {
    if (qual === 'inicio'    && typeof itbiMedirInicio    === 'function') itbiMedirInicio(marca);
    if (qual === 'fim'       && typeof itbiMedirFim       === 'function') itbiMedirFim(marca, obs);
    if (qual === 'descartar' && typeof itbiMedirDescartar === 'function') itbiMedirDescartar(marca);
  } catch (_) { /* medição nunca derruba a tela */ }
}

// Ícones do Builder (redesign 10.4, 19/07/2026) — reutilizados em Concorrentes e Vendidos ITBI.
const ICON_TRASH   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
const ICON_ARCHIVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>';
const ICON_UNDO    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
const ICON_EXTLINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
const ICON_EDIT    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const ICON_CHEVRON_SM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:11px;height:11px;vertical-align:-1px;margin-right:5px">%CHEVRON_DIR%</svg>';
const _CHEV_DOWN = '<polyline points="6 9 12 15 18 9"/>';
const _CHEV_RIGHT = '<polyline points="9 18 15 12 9 6"/>';
function chevronIcon(expanded) { return ICON_CHEVRON_SM.replace('%CHEVRON_DIR%', expanded ? _CHEV_DOWN : _CHEV_RIGHT); }

// ── ACM Lista ─────────────────────────────────────────────────────────────────
// Ícone por tipologia do imóvel (imoveis_carteira.tipo, via enriquecerImoveis): Casa → casa,
// qualquer outra tipologia cadastrada → prédio, sem tipologia → interrogação (não avisamos errado).
function acmTipoIco(tipologia) {
  if (!tipologia) return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  if (tipologia === 'Casa') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>';
}
function renderACMLista() {
  const el = document.getElementById('sv-acm');

  // Imóveis sem ACM
  const semACM = imoveis.filter(im =>
    im.estagio !== 'perdido' && !acmItems.find(a => a.imovel_id === im.id)
  );

  if (!acmItems.length && !semACM.length) {
    el.innerHTML = '<div class="empty-state"><div class="es-icon"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>' +
      '<p class="ds-section-title" style="margin-bottom:6px">Nenhuma ACM ainda</p>' +
      '<p class="ds-meta">Clique em "ACM" em qualquer card do Pipeline para criar.</p></div>';
    return;
  }

  // Helper: calcula faixa e medITBI a partir dos dados da ACM
  function acmCalc(a) {
    const cfg  = a.faixas || {};
    const area = parseFloat(cfg.areaProp) || 0;
    const vp   = parseMoney(cfg.valorPretendido);
    const desc = (parseFloat(cfg.desconto) || 10) / 100;
    const vendF = (a.vendidos || []).filter(r => !r.descartado && parseFloat(r.valorM2) > 0);
    const concF = (a.concorrentes || []).filter(r => !r.descartado && parseFloat(r.au) > 0 && parseFloat(r.valorPedido) > 0);
    const medITBI   = vendF.length ? vendF.reduce((s, r) => s + (parseFloat(r.valorM2) || 0), 0) / vendF.length : 0;
    const medPedido = concF.length ? concF.reduce((s, r) => s + (parseFloat(r.valorPedido) || 0) / (parseFloat(r.au) || 1), 0) / concF.length : 0;
    const medVend   = concF.length ? concF.reduce((s, r) => s + (parseFloat(r.valorPedido) || 0) / (parseFloat(r.au) || 1) * (1 - desc), 0) / concF.length : 0;
    const f1 = medVend * area, f2 = medPedido * area, f3 = medPedido * 1.1 * area;
    let faixaTag = '';
    if (vp > 0 && f1 > 0) {
      if (vp <= f1)      faixaTag = '<span class="gest-outline-badge success">Venda rápida</span>';
      else if (vp <= f2) faixaTag = '<span class="gest-outline-badge warn">Concorrida</span>';
      else if (vp <= f3) faixaTag = '<span class="gest-outline-badge warn">Acima do mercado</span>';
      else               faixaTag = '<span class="gest-outline-badge danger">Poucas chances</span>';
    }
    return { medITBI, area, vp, faixaTag };
  }

  const acmCards = acmItems.map(a => {
    const cfg    = a.faixas || {};
    const imovel = imoveis.find(i => i.id === a.imovel_id);
    const nVend  = (a.vendidos || []).filter(r => !r.descartado).length;
    const nConc  = (a.concorrentes || []).filter(r => !r.descartado).length;
    const { medITBI, area, vp, faixaTag } = acmCalc(a);
    const stage  = imovel ? (STAGES.find(s => s.id === imovel.estagio) || {}) : {};
    const titulo = a.titulo || cfg.edificio || '—';
    const owner  = cfg.proprietario || imovel?.owner || '';
    const dtStr  = a.updated_at ? new Date(a.updated_at).toLocaleDateString('pt-BR') : '';

    return '<div class="card acm-card" onclick="openACMBuilderById(\'' + a.id + '\')">' +
      '<div class="acm-card-titulo">' + (owner || titulo || '—') + '</div>' +
      '<div class="acm-card-sub">' +
        (titulo && titulo !== (owner || '') ? titulo + (area ? ' · ' + area + 'm²' : '') : (area ? area + 'm²' : '')) +
      '</div>' +
      '<div class="acm-card-tags">' +
        (stage.label ? '<span class="gest-tag-gray">' + stage.label + '</span>' : '') +
        (nVend > 0 ? '<span class="gest-outline-badge success">ITBI: ' + (medITBI > 0 ? fmtMoneyInt(medITBI) + '/m²' : '') + ' (' + nVend + 'x)</span>' : '') +
        (nConc > 0 ? '<span class="gest-outline-badge info">' + nConc + ' conc.</span>' : '') +
        faixaTag +
      '</div>' +
      '<div class="acm-card-foot">' +
        '<div>' + (vp > 0 ? '<span class="acm-card-preco">' + fmtMoeda(vp) + '</span>' + (area > 0 ? '<span class="acm-card-m2">' + fmtMoneyInt(vp / area) + '/m²</span>' : '') : '') + '</div>' +
        (dtStr ? '<div class="acm-card-data">' + dtStr + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  const semACMSection = semACM.length ? (
    '<div style="margin-top:20px">' +
    '<div class="ds-section-label" style="margin-bottom:8px">Pipeline sem ACM (' + semACM.length + ')</div>' +
    '<div class="acm-grid">' +
    semACM.map(im => {
      const stage = STAGES.find(s => s.id === im.estagio) || {};
      return '<div class="acm-sem-item">' +
        acmTipoIco(im.tipologia) +
        '<div class="acm-sem-info">' +
          '<div class="acm-sem-nome">' + (im.imovel || im.rua || '—') + '</div>' +
          '<div class="acm-sem-sub">' + (im.owner || '—') + (stage.label ? ' · ' + stage.label : '') + '</div>' +
        '</div>' +
        '<button class="btn btn-ghost btn-sm" style="flex-shrink:0" onclick="openACMBuilder(\'' + im.id + '\')">+ Criar ACM</button>' +
      '</div>';
    }).join('') +
    '</div></div>'
  ) : '';

  el.innerHTML = '<div class="acm-grid">' + acmCards + '</div>' + semACMSection;
}

function parseMoney(s) {
  if (!s) return 0;
  return parseFloat(String(s).replace(/[R$\s.]/g,'').replace(',','.')) || 0;
}

function maskMoneyInput(el) {
  const raw = el.value.replace(/\D/g,'');
  if (!raw) { el.value = ''; return; }
  el.value = (parseInt(raw,10)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function openACMBuilder(imovelId) {
  const imovel = imoveis.find(i => i.id === imovelId) || {};
  let acm = acmItems.find(a => a.imovel_id === imovelId);
  if (!acm) {
    acm = {
      id: null, imovel_id: imovelId,
      titulo: imovel.imovel || '',
      vendidos: [], concorrentes: [],
      faixas: {
        proprietario: imovel.owner || '',
        edificio:     imovel.imovel || '',
        rua:          imovel.rua   || '',
        num:          imovel.num   || '',
        apto:         imovel.apto  || '',
        areaProp:     imovel.area_privativa || '',
        d: imovel.dormitorios || '', s: imovel.suites || '', v: imovel.vagas || '',
        valorPretendido: imovel.valor_pretendido || '',
        desconto: 10,
      },
      valor_sugerido: imovel.valor_pretendido || null,
    };
  }
  _abrirACM(acm);
}

function openACMBuilderById(acmId) {
  const acm = acmItems.find(a => a.id === acmId);
  if (!acm) { toast('⚠️ ACM não encontrada'); return; }
  _abrirACM(acm);
}

let _syncTimer = null;
function syncACMToPipeline() {
  scheduleSave();
  if (!currentACM?.imovel_id) return;
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    const cfg = currentACM?.faixas || {};
    const payload = {};
    if (cfg.proprietario !== undefined) payload.owner   = cfg.proprietario;
    if (cfg.rua          !== undefined) payload.rua     = cfg.rua;
    if (cfg.num          !== undefined) payload.num     = cfg.num;
    if (!Object.keys(payload).length) return;
    const { error } = await db().from('imoveis').update(payload).eq('id', currentACM.imovel_id);
    if (error) console.warn('syncACMToPipeline:', error.message);
    else {
      const im = imoveis.find(x => x.id === currentACM.imovel_id);
      if (im) Object.assign(im, payload);
    }
  }, 1500);
}

function resolveACMCond(edificio) {
  const nome = (edificio||'').trim().toLowerCase();
  const match = nome ? condominios.find(c => (c.nome||'').toLowerCase() === nome) : null;
  acmCondId = match ? match.id : null;
}

function _abrirACM(acm) {
  currentACM = acm;
  acmITBISearchVisible = false;
  acmConcDiscExpanded = false;
  acmVendDiscExpanded = false;
  acmSimDiscExpanded  = false;
  // Garantir que faixas existe
  if (!acm.faixas) acm.faixas = {};
  resolveACMCond(acm.faixas?.edificio);
  const cfg = acm.faixas;
  // Pre-popular campos se estiverem vazios
  if (!cfg.edificio) {
    // 1. Usar titulo do registro como ponto de partida para Edifício
    cfg.edificio = acm.titulo && acm.titulo !== '—' ? acm.titulo : '';
    cfg.desconto = cfg.desconto || 10;
    // 2. Tentar achar imóvel vinculado (por id ou por nome como fallback)
    let im = acm.imovel_id ? imoveis.find(i => i.id === acm.imovel_id) : null;
    if (!im && cfg.edificio) {
      im = imoveis.find(i => i.imovel && i.imovel.toLowerCase() === cfg.edificio.toLowerCase());
      if (im && !acm.imovel_id) acm.imovel_id = im.id; // vincular automaticamente
    }
    if (im) {
      cfg.proprietario    = im.owner            || '';
      cfg.apto            = im.apto             || '';
      cfg.areaProp        = im.area_privativa   || '';
      cfg.d               = im.dormitorios      || '';
      cfg.s               = im.suites           || '';
      cfg.v               = im.vagas            || '';
      cfg.valorPretendido = im.valor_pretendido || '';
    }
  }
  document.getElementById('acmHdrTitle').textContent = 'ACM — ' + (cfg.edificio || acm.titulo || 'Imóvel');
  document.getElementById('acmHdrSub').textContent   = 'Proprietário: ' + (cfg.proprietario || '—');
  document.getElementById('acmOverlay').classList.add('open');
  renderACM();
  // M1 (medição temporária da Fatia 1 — sai na Fatia 7): abrir o ACM → primeira linha
  // de vendidos. Só mede o caso do roteiro: a abertura que INCLUI o download do banco
  // (a 1ª da sessão). Abrir outro ACM com o banco já carregado não entra na conta —
  // misturaria ~200 ms com vários segundos na mesma mediana (correção pós-QA P-5).
  if (cfg.rua && !(acm.vendidos||[]).length) {
    if (typeof itbiDB !== 'undefined' && typeof itbiDBPromise !== 'undefined' &&
        !itbiDB && !itbiDBPromise) _acmMedir('inicio', 'M1');
    autoLoadITBIForACM(cfg);
  }
}

function closeACMBuilder() {
  saveACM();
  document.getElementById('acmOverlay').classList.remove('open');
  currentACM = null;
}

function saveACMBtn() {
  saveACM();
  const btn = document.getElementById('acmSaveBtn');
  if (btn) { btn.textContent = 'Salvo!'; setTimeout(() => { btn.textContent = 'Salvar'; }, 2000); }
}

async function saveACM() {
  if (!currentACM) return;
  const acm = currentACM;
  const cfg = acm.faixas || {};
  cfg.proprietario    = document.getElementById('acmProp')?.value         ?? cfg.proprietario    ?? '';
  cfg.edificio        = document.getElementById('acmEdif')?.value         ?? cfg.edificio        ?? '';
  cfg.andar           = document.getElementById('acmAndar')?.value        ?? cfg.andar           ?? '';
  cfg.apto            = document.getElementById('acmApto')?.value         ?? cfg.apto            ?? '';
  cfg.areaProp        = document.getElementById('acmArea')?.value         ?? cfg.areaProp        ?? '';
  cfg.d               = document.getElementById('acmD')?.value            ?? cfg.d               ?? '';
  cfg.s               = document.getElementById('acmS')?.value            ?? cfg.s               ?? '';
  cfg.v               = document.getElementById('acmV')?.value            ?? cfg.v               ?? '';
  cfg.valorPretendido = document.getElementById('acmValor')?.value        ?? cfg.valorPretendido ?? '';
  cfg.recomendacao    = document.getElementById('acmRecomendacao')?.value ?? cfg.recomendacao    ?? '';
  cfg.pontosFort      = document.getElementById('acmPontosFort')?.value   ?? cfg.pontosFort      ?? '';
  cfg.pontosAtencao   = document.getElementById('acmPontosAtencao')?.value?? cfg.pontosAtencao   ?? '';
  cfg.oportunidades   = document.getElementById('acmOportunidades')?.value?? cfg.oportunidades   ?? '';
  cfg.desconto        = parseFloat(document.getElementById('acmDesconto')?.value) || cfg.desconto || 10;
  acm.faixas  = cfg;
  acm.titulo  = cfg.edificio || acm.titulo;
  acm.valor_sugerido = parseMoney(cfg.valorPretendido) || null;
  const payload = {
    imovel_id:     acm.imovel_id,
    titulo:        acm.titulo || '—',
    vendidos:      acm.vendidos     || [],
    concorrentes:  acm.concorrentes || [],
    faixas:        acm.faixas,
    valor_sugerido: acm.valor_sugerido,
  };
  try {
    if (acm.id) {
      await db().from('acms').update(payload).eq('id', acm.id);
    } else {
      const { data, error } = await db().from('acms').insert(payload).select().single();
      if (error) { console.error('saveACM:', error); return; }
      if (data) { acm.id = data.id; acm.created_at = data.created_at; }
    }
    const idx = acmItems.findIndex(a => a.id === acm.id);
    if (idx >= 0) acmItems[idx] = { ...acmItems[idx], ...acm };
    else if (acm.id) acmItems.push(acm);
    document.getElementById('acmHdrTitle').textContent = 'ACM — ' + (acm.titulo || 'Imóvel');
  } catch(e) { console.error('saveACM error', e); }
}

function scheduleSave() {
  clearTimeout(_acmSaveTimer);
  _acmSaveTimer = setTimeout(() => saveACM(), 2000);
}

function renderACM() {
  const acm = currentACM; if (!acm) return;
  const cfg  = acm.faixas || {};
  const area = parseFloat(cfg.areaProp) || 0;
  const vp   = parseMoney(cfg.valorPretendido);
  const vm2  = area > 0 && vp > 0 ? vp / area : 0;
  const desc = (parseFloat(cfg.desconto) || 10) / 100;
  const vendAll  = acm.vendidos     || [];
  const concAll  = acm.concorrentes || [];
  const vendF = vendAll.filter(r => !r.descartado && parseFloat(r.valorM2) > 0);
  const concF = concAll.filter(r => !r.descartado && parseFloat(r.au) > 0 && parseFloat(r.valorPedido) > 0);
  const medITBI   = vendF.length  ? vendF.reduce((s,r) => s + (parseFloat(r.valorM2)||0), 0) / vendF.length  : 0;
  const medPedido = concF.length  ? concF.reduce((s,r) => s + (parseFloat(r.valorPedido)||0)/(parseFloat(r.au)||1), 0) / concF.length : 0;
  const medVend   = concF.length  ? concF.reduce((s,r) => s + (parseFloat(r.valorPedido)||0)/(parseFloat(r.au)||1)*(1-desc), 0) / concF.length : 0;
  const f1 = medVend*area, f2 = medPedido*area, f3 = medPedido*1.1*area;

  const IS = 'width:100%;background:transparent;border:none;border-bottom:1px dashed var(--border);font-size:11px;color:var(--text);padding:1px 2px;min-width:0';
  const concRowHtml = (c, i, discarded) => {
    const au=parseFloat(c.au)||0, vp2=parseFloat(c.valorPedido)||0;
    const vm2p=au>0?vp2/au:0, vDes=vp2*(1-desc), vm2v=au>0?vDes/au:0;
    const _imgSrc = url => { const m=(url||'').match(/\/file\/d\/([^/]+)/); return m?'https://drive.google.com/thumbnail?id='+m[1]+'&sz=w200':url; };
    const img = c.img
      ? `<img class="acmb-img" src="${_imgSrc(c.img)}" style="cursor:pointer" onclick="setConcImg(${i})" title="Alterar">`
      : `<div class="acmb-img-ph" onclick="setConcImg(${i})" style="cursor:pointer" title="Adicionar imagem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>`;
    const editLinkBtn = `<button class="acm-link-btn" title="${c.link?'Editar link':'Adicionar link'}" onclick="setConcLink(${i})">${ICON_EDIT}</button>`;
    const linkBtn = c.link ? `<a class="acm-link-btn" href="${c.link}" target="_blank" title="Ver anúncio">${ICON_EXTLINK}</a>` : '';
    const actions = discarded
      ? `${editLinkBtn}${linkBtn}<button class="acm-link-btn" title="Restaurar" onclick="restaurarConcorrente(${i})">${ICON_UNDO}</button><button class="acm-xbtn" title="Apagar definitivamente" onclick="removeConcorrente(${i})">${ICON_TRASH}</button>`
      : `${editLinkBtn}${linkBtn}<button class="acm-xbtn" title="Descartar" onclick="descartarConcorrente(${i})">${ICON_ARCHIVE}</button>`;
    return `<tr${discarded?' style="opacity:.55"':''}>
      <td style="text-align:center">${i+1}</td><td>${img}</td>
      <td style="max-width:110px"><input style="${IS}" value="${(c.edificio||'').replace(/"/g,'&quot;')}" onchange="updateConc(${i},'edificio',this.value)" placeholder="Edifício"/></td>
      <td style="max-width:100px"><input style="${IS}" value="${(c.rua||'').replace(/"/g,'&quot;')}" onchange="updateConc(${i},'rua',this.value)" placeholder="Rua"/></td>
      <td><input style="${IS};width:40px" value="${c.num||''}" onchange="updateConc(${i},'num',this.value)"/></td>
      <td><select style="font-size:11px;background:transparent;border:none;color:var(--text)" onchange="updateConc(${i},'tipologia',this.value)">
        ${opcoesOpts('tipologia', c.tipologia||'')}
      </select></td>
      <td><select style="font-size:11px;background:transparent;border:none;color:var(--text)" onchange="updateConc(${i},'estado',this.value)">
        ${opcoesOpts('conservacao', c.estado||'')}
      </select></td>
      <td style="white-space:nowrap"><input style="${IS};width:100px" value="${vp2>0?vp2.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):''}" onchange="updateConc(${i},'valorPedido',parseMoney(this.value))" oninput="maskMoneyInput(this)" placeholder="R$ 0,00"/></td>
      <td><input style="${IS};width:44px;text-align:center" value="${c.au||''}" onchange="updateConc(${i},'au',parseFloat(this.value)||0)"/></td>
      <td><input style="${IS};width:24px;text-align:center" value="${c.d||''}" onchange="updateConc(${i},'d',this.value)"/></td>
      <td><input style="${IS};width:24px;text-align:center" value="${c.s||''}" onchange="updateConc(${i},'s',this.value)"/></td>
      <td><input style="${IS};width:24px;text-align:center" value="${c.v||''}" onchange="updateConc(${i},'v',this.value)"/></td>
      <td style="color:var(--accent);white-space:nowrap">${vm2p>0?fmtMoneyInt(vm2p):'—'}</td>
      <td style="white-space:nowrap">${vDes>0?fmtMoeda(vDes):'—'}</td>
      <td style="color:var(--success);white-space:nowrap">${vm2v>0?fmtMoneyInt(vm2v):'—'}</td>
      <td style="text-align:center"><div class="acmb-row-actions">${actions}</div></td>
    </tr>`;
  };
  const concIdx = concAll.map((c,i) => ({ c, i }));
  const concValRows  = concIdx.filter(o => !o.c.descartado);
  const concDiscRows = concIdx.filter(o => o.c.descartado);
  const concRows = concValRows.map(o => concRowHtml(o.c, o.i, false)).join('') +
    (concDiscRows.length ? `<tr class="acmb-disc-divider" onclick="toggleACMConcDisc()"><td colspan="16">${chevronIcon(acmConcDiscExpanded)}Descartados (${concDiscRows.length}) — não entram nas faixas nem na apresentação exportada · clique para ${acmConcDiscExpanded?'esconder':'ver'}</td></tr>` + (acmConcDiscExpanded ? concDiscRows.map(o => concRowHtml(o.c, o.i, true)).join('') : '') : '');

  const df = s => { if(!s) return '—'; const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m?`${m[3]}/${m[2]}/${m[1]}`:s; };
  const vendRowHtml = (r, i, discarded) => {
    const propBadge = acmPropBadge(r);
    const actions = discarded
      ? `<button class="acm-link-btn" title="Restaurar" onclick="restaurarVendido(${i})">${ICON_UNDO}</button><button class="acm-xbtn" title="Apagar definitivamente" onclick="removeVendido(${i})">${ICON_TRASH}</button>`
      : `<button class="acm-xbtn" title="Descartar" onclick="descartarVendido(${i})">${ICON_ARCHIVE}</button>`;
    return `<tr${discarded?' style="opacity:.55"':''}>
      <td>${df(r.data)}</td><td>${ruaExib(r)||'—'}</td><td>${r.numero||'—'}</td>
      <td>${titleRua(r.complemento)||'—'}</td><td>${titleRua(r.bairro)||'—'}</td><td>${titleRua(r.referencia)||'—'}</td>
      <td><input type="number" value="${r.area||''}" style="width:54px;background:transparent;border:1px solid transparent;border-radius:4px;padding:2px 3px;text-align:center;font-size:11px;color:var(--text)" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='transparent';updateVendidoArea(${i},this.value)"/></td>
      ${propBadge?`<td><div class="acm-prop-cell"><span style="color:var(--success);font-weight:600">${r.valor>0?fmtMoeda(r.valor):'—'}</span>${propBadge}</div></td>`:`<td style="color:var(--success);font-weight:600">${r.valor>0?fmtMoeda(r.valor):'—'}</td>`}
      <td style="color:var(--accent);font-weight:600">${parseFloat(r.valorM2)>0?fmtMoneyInt(r.valorM2):'—'}</td>
      <td>${r.cartorio||'—'}</td><td>${r.matricula||'—'}</td><td>${r.sql||'—'}</td>
      <td style="text-align:center"><div class="acmb-row-actions">${actions}</div></td>
    </tr>`;
  };
  // Vendidos ITBI sempre em ordem de data (mais recente primeiro), independente da ordem de inserção/importação.
  const vendIdx = vendAll.map((r,i) => ({ r, i })).sort((a,b) => (b.r.data||'').localeCompare(a.r.data||''));
  const vendValRows  = vendIdx.filter(o => !o.r.descartado);
  const vendDiscRows = vendIdx.filter(o => o.r.descartado);
  const itbiRows = vendValRows.map(o => vendRowHtml(o.r, o.i, false)).join('') +
    (vendDiscRows.length ? `<tr class="acmb-disc-divider" onclick="toggleACMVendDisc()"><td colspan="13">${chevronIcon(acmVendDiscExpanded)}Descartados (${vendDiscRows.length}) · clique para ${acmVendDiscExpanded?'esconder':'ver'}</td></tr>` + (acmVendDiscExpanded ? vendDiscRows.map(o => vendRowHtml(o.r, o.i, true)).join('') : '') : '');

  const faixaBadge = v => {
    if (!v||!f1) return '';
    if (v<=f1) return '<span class="gest-outline-badge success" style="margin-left:6px">Venda rápida</span>';
    if (v<=f2) return '<span class="gest-outline-badge warn" style="margin-left:6px">Concorrida</span>';
    if (v<=f3) return '<span class="gest-outline-badge warn" style="margin-left:6px">Acima do mercado</span>';
    return '<span class="gest-outline-badge danger" style="margin-left:6px">Poucas chances</span>';
  };
  const itbiLen = vendAll.length;
  const concLen = concAll.length;
  const periodoStr = (() => {
    const ds = vendValRows.map(o=>o.r.data).filter(Boolean).sort();
    if (ds.length < 2) return '';
    return `${df(ds[0])} → ${df(ds[ds.length-1])}`;
  })();
  const condOpts = condominios.map(c=>`<option value="${(c.nome||'').replace(/"/g,'&quot;')}">`).join('');

  document.getElementById('acmBody').innerHTML = `
  <div class="acmb-card acmb-sticky">
    <div class="acmb-hdr"><span class="acmb-title">Imóvel avaliado</span></div>
    <div class="acmb-body">
      <div class="acm-row">
        <div class="acm-fi" style="flex:1.4;min-width:120px"><label>Proprietário</label><input id="acmProp" value="${(cfg.proprietario||'').replace(/"/g,'&quot;')}" oninput="currentACM.faixas.proprietario=this.value;syncACMToPipeline()"/></div>
        <div class="acm-fi" style="flex:2;min-width:130px"><label>Rua</label><input id="acmRua" value="${(cfg.rua||'').replace(/"/g,'&quot;')}" oninput="currentACM.faixas.rua=this.value;syncACMToPipeline()"/></div>
        <div class="acm-fi w50"><label>Nº</label><input id="acmNum" value="${(cfg.num||'').replace(/"/g,'&quot;')}" oninput="currentACM.faixas.num=this.value;syncACMToPipeline()"/></div>
        <div class="acm-fi" style="flex:1.4;min-width:110px"><label>Edifício</label>
          <datalist id="acmEdifList">${condOpts}</datalist>
          <input id="acmEdif" value="${(cfg.edificio||'').replace(/"/g,'&quot;')}" list="acmEdifList" oninput="currentACM.faixas.edificio=this.value;onACMEdifChange()"/>
        </div>
        <div class="acm-fi w50"><label>Andar</label><input id="acmAndar" value="${cfg.andar||''}" oninput="currentACM.faixas.andar=this.value"/></div>
        <div class="acm-fi w50"><label>Apto</label><input id="acmApto" value="${cfg.apto||''}" oninput="currentACM.faixas.apto=this.value"/></div>
        <div class="acm-fi w46"><label>A.U.</label><input id="acmArea" value="${cfg.areaProp||''}" oninput="currentACM.faixas.areaProp=this.value;renderACMFaixas()"/></div>
        <div class="acm-fi w36"><label>D</label><input id="acmD" value="${cfg.d||''}" oninput="currentACM.faixas.d=this.value"/></div>
        <div class="acm-fi w36"><label>S</label><input id="acmS" value="${cfg.s||''}" oninput="currentACM.faixas.s=this.value"/></div>
        <div class="acm-fi w36"><label>V</label><input id="acmV" value="${cfg.v||''}" oninput="currentACM.faixas.v=this.value"/></div>
        <div class="acm-fi grow ac"><label>Valor pretendido</label><input id="acmValor" value="${cfg.valorPretendido||''}" oninput="currentACM.faixas.valorPretendido=this.value;renderACMFaixas()" placeholder="Ex: 850000"/></div>
        <div class="acm-fi grow ac"><label>R$/m²</label><input id="acmVm2" value="${vm2>0?fmtMoneyInt(vm2):''}" readonly style="opacity:.7"/></div>
      </div>
    </div>
  </div>

  <div class="acmb-card" id="acmFaixasCard">
    <div class="acmb-hdr"><span class="acmb-title">Faixas de preço${area>0?' · '+area+'m²':''}</span></div>
    ${f1>0||f2>0?`<div class="acmb-faixas-row">
      ${f1>0?`<div class="acmb-fx g"><div class="acmb-fx-lbl">Venda rápida</div><div class="acmb-fx-val">${fmtMoeda(f1)}</div><div class="acmb-fx-sub">${fmtMoneyInt(medVend)}/m² · c/ desconto · &lt;30 dias</div></div>`:''}
      ${f2>0?`<div class="acmb-fx y"><div class="acmb-fx-lbl">Venda concorrida</div><div class="acmb-fx-val">${fmtMoeda(f2)}</div><div class="acmb-fx-sub">${fmtMoneyInt(medPedido)}/m² · preço pedido · 60–120 dias</div></div>`:''}
      ${f3>0?`<div class="acmb-fx r"><div class="acmb-fx-lbl">Poucas chances</div><div class="acmb-fx-val">${fmtMoeda(f3)}</div><div class="acmb-fx-sub">${fmtMoneyInt(medPedido*1.1)}/m² · +10% do mercado · +6 meses</div></div>`:''}
    </div>`:`<div style="padding:12px 14px;font-size:12px;color:var(--muted)">Adicione concorrentes para calcular as faixas de preço</div>`}
    <div class="acmb-vr-row">
      <div class="acmb-vr-col">
        <div class="acmb-vr-lbl">Valor pretendido</div>
        <div class="acmb-vr-val">${vp>0?fmtMoeda(vp):'—'}${vm2>0?` <span class="acmb-vr-sub">· ${fmtMoneyInt(vm2)}/m²</span>`:''}${vp>0?faixaBadge(vp):''}</div>
      </div>
      <div class="acmb-vr-col">
        <div class="acmb-vr-lbl accent">Recomendação Pandora Homes</div>
        <input id="acmRecomendacao" value="${(cfg.recomendacao||'').replace(/"/g,'&quot;')}" oninput="maskMoneyInput(this);currentACM.faixas.recomendacao=this.value" placeholder="Ex: 1.250.000" style="background:none;border:none;color:var(--accent);font-weight:800;font-size:18px;font-family:inherit;width:100%;padding:0"/>
      </div>
    </div>
  </div>

  <div class="acmb-card">
    <div class="acmb-hdr">
      <span class="acmb-title">Vendidos — ITBI${itbiLen?` <span class="n">${itbiLen}</span>`:''}</span>
      <span class="acmb-hdr-stats">Média (válidos): <strong>${medITBI>0?fmtMoneyInt(medITBI)+'/m²':'—'}</strong>${periodoStr?` · Período: <strong>${periodoStr}</strong>`:''}</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="toggleACMITBISearch()" style="font-size:11px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Buscar ITBI</button>
        <button class="btn btn-ghost btn-sm" onclick="addConcorrentesVendidos(event)" style="font-size:11px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Buscar todos conc.</button>
      </div>
    </div>
    <div id="acmITBISearchPanel" style="display:none">
      <div class="acm-itbi-search">
        <div style="font-size:10px;color:var(--muted);margin-bottom:10px">Banco ITBI SP — carrega ~47MB na primeira busca da sessão. Busque por endereço (rua + número).</div>
        <div class="acm-search-group">
          <div class="acm-search-group-label">Por endereço (Rua + Número)</div>
          <div id="acmSearchRuas"><div class="acm-search-addr-row"><input class="acm-sr-rua" placeholder="Nome da rua (ex: OLAVO BILAC)"/><input class="acm-sr-num" placeholder="Nº" style="flex:0 0 70px"/></div></div>
          <button class="btn btn-ghost btn-sm" onclick="addSearchRua()" style="font-size:10px;margin-top:4px">+ Endereço</button>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px">
          <input id="acmSrBairro" placeholder="Filtro bairro" style="flex:1;min-width:100px;padding:4px 7px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px"/>
          <select id="acmSrAnoIni" style="padding:4px 5px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px"><option>2019</option><option selected>2020</option><option>2021</option><option>2022</option><option>2023</option><option>2024</option><option>2025</option><option>2026</option></select>
          <span style="font-size:11px;color:var(--muted)">até</span>
          <select id="acmSrAnoFim" style="padding:4px 5px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px"><option>2023</option><option>2024</option><option>2025</option><option selected>2026</option></select>
          <button class="btn btn-primary btn-sm" onclick="doITBISearch()" style="font-size:11px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Buscar</button>
          <button class="btn btn-ghost btn-sm" onclick="limparITBISearch()" style="font-size:11px">✕ Limpar</button>
        </div>
        <div id="acmITBISearchResults"></div>
      </div>
    </div>
    <div class="acmb-tw">
      <table id="acmItbiTable">
        <thead><tr><th>Data</th><th>Rua</th><th>Nº</th><th>Complemento</th><th>Bairro</th><th>Edifício</th><th>A.C.</th><th>Valor</th><th>R$/m²</th><th>Cartório</th><th>Matrícula</th><th>SQL</th><th></th></tr></thead>
        <tbody>${itbiRows||'<tr><td colspan="13" style="text-align:center;color:var(--muted);padding:20px;font-size:12px">Nenhum vendido — use "Buscar ITBI" ou "Buscar todos conc."</td></tr>'}</tbody>
      </table>
    </div>
    <span id="acmITBIAutoLoad" style="display:block;padding:6px 12px;font-size:11px;color:var(--muted)"></span>
  </div>

  <div class="acmb-card">
    <div class="acmb-hdr">
      <span class="acmb-title">Concorrentes${concLen?` <span class="n">${concLen}</span>`:''}</span>
      <span class="acmb-hdr-stats">Média pedido: <strong>${medPedido>0?fmtMoneyInt(medPedido)+'/m²':'—'}</strong> · Média c/ desconto: <strong>${medVend>0?fmtMoneyInt(medVend)+'/m²':'—'}</strong></span>
      <div class="acmb-desconto">Desconto <input id="acmDesconto" type="number" value="${cfg.desconto||10}" min="0" max="50" step="0.5" oninput="onDescontoInput(this)"> %</div>
    </div>
    <div class="acm-new-conc">
      <div class="acm-new-conc-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Novo concorrente</div>
      <datalist id="condEdifList">${condOpts}</datalist>
      <div class="acm-arow">
        <input id="ccRua" placeholder="Rua" style="flex:3;min-width:120px"/>
        <input id="ccNum" placeholder="Nº" style="width:55px"/>
        <input id="cEdif" placeholder="Edifício" list="condEdifList" oninput="onConcEdifChange()" style="flex:3;min-width:120px"/>
        <input id="cValor" placeholder="Valor R$" type="text" oninput="maskMoneyInput(this)" style="flex:2;min-width:100px"/>
        <input id="cAU" placeholder="A.U." type="number" style="width:60px"/>
        <input id="cD" placeholder="D" type="number" style="width:45px;text-align:center"/>
        <input id="cS" placeholder="S" type="number" style="width:45px;text-align:center"/>
        <input id="cV" placeholder="V" type="number" style="width:45px;text-align:center"/>
      </div>
      <div class="acm-arow" style="flex-wrap:nowrap">
        <select id="ccTipo" style="flex:1;min-width:0"><option value="" disabled selected hidden>Tipologia</option>${opcoesOpts('tipologia','')}</select>
        <select id="cEst" style="flex:1;min-width:0"><option value="" disabled selected hidden>Estado</option>${opcoesOpts('conservacao','')}</select>
        <input id="cLink" placeholder="Link do anúncio" style="flex:2;min-width:0"/>
        <button class="btn btn-primary btn-sm" onclick="addConcorrente()" style="white-space:nowrap;flex-shrink:0">+ Adicionar</button>
      </div>
    </div>
    <div class="acmb-sub-lbl">Válidos (${concValRows.length})</div>
    <div class="acmb-tw">
      <table id="acmConcTable">
        <thead><tr><th>#</th><th>Img</th><th>Edifício</th><th>Rua</th><th>Nº</th><th>Tipologia</th><th>Estado</th><th>Valor Pedido</th><th>A.U.</th><th>D</th><th>S</th><th>V</th><th>R$/m² Pedido</th><th>Vlr Descontado</th><th>R$/m² Vend.</th><th></th></tr></thead>
        <tbody>${concRows||'<tr><td colspan="16" style="text-align:center;color:var(--muted);padding:16px;font-size:12px;font-style:italic">Nenhum concorrente ainda</td></tr>'}</tbody>
      </table>
    </div>
  </div>

  <div class="acmb-card" id="acmSimCard">
    ${renderACMSimHtml()}
  </div>

  <div class="acmb-card">
    <div class="acmb-hdr"><span class="acmb-title">Nossa Leitura</span></div>
    <div class="acmb-body">
      <div class="acmb-leitura-row">
        <div>
          <div class="acmb-fi-lbl" style="color:var(--success)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Pontos Fortes</div>
          <textarea id="acmPontosFort" rows="4" oninput="currentACM.faixas.pontosFort=this.value" style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:12px;width:100%;font-family:inherit;resize:vertical;line-height:1.5">${(cfg.pontosFort||'').replace(/</g,'&lt;')}</textarea>
        </div>
        <div>
          <div class="acmb-fi-lbl" style="color:var(--warn)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Pontos de Atenção</div>
          <textarea id="acmPontosAtencao" rows="4" oninput="currentACM.faixas.pontosAtencao=this.value" style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:12px;width:100%;font-family:inherit;resize:vertical;line-height:1.5">${(cfg.pontosAtencao||'').replace(/</g,'&lt;')}</textarea>
        </div>
        <div>
          <div class="acmb-fi-lbl" style="color:var(--accent)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>Oportunidades</div>
          <textarea id="acmOportunidades" rows="4" oninput="currentACM.faixas.oportunidades=this.value" style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:12px;width:100%;font-family:inherit;resize:vertical;line-height:1.5">${(cfg.oportunidades||'').replace(/</g,'&lt;')}</textarea>
        </div>
      </div>
    </div>
  </div>`;

  setTimeout(() => {
    initColResize('acmConcTable'); initColResize('acmItbiTable'); initACMSearchPanelAC();
    setupRuaNumACById('acmRua', 'acmNum');
    const recEl = document.getElementById('acmRecomendacao');
    if (recEl && recEl.value) { const n = parseMoney(recEl.value); if (n > 0) recEl.value = n.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  }, 80);
}

function renderACMFaixas() {
  if (!currentACM) return;
  const cfg = currentACM.faixas;
  cfg.areaProp        = document.getElementById('acmArea')?.value  || '';
  cfg.valorPretendido = document.getElementById('acmValor')?.value || '';
  const area = parseFloat(cfg.areaProp) || 0;
  const vp   = parseMoney(cfg.valorPretendido);
  const vm2  = area > 0 && vp > 0 ? vp / area : 0;
  const vm2El = document.getElementById('acmVm2');
  if (vm2El) vm2El.value = vm2 > 0 ? fmtMoneyInt(vm2) : '';
  const desc = (parseFloat(cfg.desconto) || 10) / 100;
  const concF = (currentACM.concorrentes||[]).filter(r => !r.descartado && parseFloat(r.au)>0 && parseFloat(r.valorPedido)>0);
  const medPedido = concF.length ? concF.reduce((s,r)=>s+(parseFloat(r.valorPedido)||0)/(parseFloat(r.au)||1),0)/concF.length : 0;
  const medVend   = concF.length ? concF.reduce((s,r)=>s+(parseFloat(r.valorPedido)||0)/(parseFloat(r.au)||1)*(1-desc),0)/concF.length : 0;
  const f1=medVend*area, f2=medPedido*area, f3=medPedido*1.1*area;
  const card = document.getElementById('acmFaixasCard'); if (!card) return;
  const hdr = card.querySelector('.acmb-title');
  if (hdr) hdr.textContent = 'Faixas de preço' + (area>0?' · '+area+'m²':'');
  const faixaBadge = v => { if(!v||!f1)return''; if(v<=f1)return'<span class="gest-outline-badge success" style="margin-left:6px">Venda rápida</span>'; if(v<=f2)return'<span class="gest-outline-badge warn" style="margin-left:6px">Concorrida</span>'; if(v<=f3)return'<span class="gest-outline-badge warn" style="margin-left:6px">Acima do mercado</span>'; return'<span class="gest-outline-badge danger" style="margin-left:6px">Poucas chances</span>'; };
  const vrRow = card.querySelector('.acmb-vr-row');
  let fRow = card.querySelector('.acmb-faixas-row');
  if (!fRow) { fRow = document.createElement('div'); fRow.className = 'acmb-faixas-row'; card.insertBefore(fRow, vrRow); }
  if (f1>0||f2>0) {
    fRow.innerHTML = (f1>0?`<div class="acmb-fx g"><div class="acmb-fx-lbl">Venda rápida</div><div class="acmb-fx-val">${fmtMoeda(f1)}</div><div class="acmb-fx-sub">${fmtMoneyInt(medVend)}/m²</div></div>`:'')+(f2>0?`<div class="acmb-fx y"><div class="acmb-fx-lbl">Venda concorrida</div><div class="acmb-fx-val">${fmtMoeda(f2)}</div><div class="acmb-fx-sub">${fmtMoneyInt(medPedido)}/m²</div></div>`:'')+(f3>0?`<div class="acmb-fx r"><div class="acmb-fx-lbl">Poucas chances</div><div class="acmb-fx-val">${fmtMoeda(f3)}</div><div class="acmb-fx-sub">${fmtMoneyInt(medPedido*1.1)}/m²</div></div>`:'');
  } else {
    fRow.innerHTML = '<div style="padding:12px 14px;font-size:12px;color:var(--muted)">Adicione concorrentes para calcular as faixas de preço</div>';
  }
  const vpCol = vrRow?.querySelector('.acmb-vr-col');
  if (vpCol) vpCol.innerHTML = `<div class="acmb-vr-lbl">Valor pretendido</div><div class="acmb-vr-val">${vp>0?fmtMoeda(vp):'—'}${vm2>0?` <span class="acmb-vr-sub">· ${fmtMoneyInt(vm2)}/m²</span>`:''}${vp>0?faixaBadge(vp):''}</div>`;
}
function toggleACMITBISearch() { acmITBISearchVisible=!acmITBISearchVisible; const p=document.getElementById('acmITBISearchPanel'); if(p) p.style.display=acmITBISearchVisible?'block':'none'; }
function toggleACMConcDisc() { acmConcDiscExpanded = !acmConcDiscExpanded; renderACM(); }
function toggleACMVendDisc() { acmVendDiscExpanded = !acmVendDiscExpanded; renderACM(); }

// Desconto: renderACM() reconstrói a tabela inteira e destruiria o foco a cada tecla digitada
// (por isso "não aceitava" digitar) — por isso o re-render só acontece depois de parar de digitar.
function onDescontoInput(el) {
  if (!currentACM) return;
  currentACM.faixas.desconto = parseFloat(el.value) || 10;
  clearTimeout(_descontoTimer);
  _descontoTimer = setTimeout(() => {
    renderACM();
    const d = document.getElementById('acmDesconto');
    if (d) { d.focus(); const v = d.value; d.value=''; d.value=v; }
  }, 600);
  scheduleSave();
}

function updateConc(idx, field, val) {
  if (!currentACM||!currentACM.concorrentes[idx]) return;
  currentACM.concorrentes[idx][field] = val;
  renderACM(); scheduleSave();
}

function updateVendidoArea(idx, val) {
  if (!currentACM) return;
  const area = parseFloat(val)||0;
  currentACM.vendidos[idx].area = area;
  if (area>0 && currentACM.vendidos[idx].valor>0)
    currentACM.vendidos[idx].valorM2 = currentACM.vendidos[idx].valor/area;
  renderACM(); scheduleSave();
}

function setConcImg(idx) {
  const url = prompt('Cole a URL da imagem:', currentACM.concorrentes[idx].img||'');
  if (url===null) return;
  currentACM.concorrentes[idx].img = url.trim();
  renderACM(); scheduleSave();
}

function setConcLink(idx) {
  const url = prompt('Cole o link do anúncio:', currentACM.concorrentes[idx].link||'');
  if (url===null) return;
  currentACM.concorrentes[idx].link = url.trim();
  renderACM(); scheduleSave();
}

async function addConcorrente() {
  if (!currentACM) return;
  const c = {
    id: Date.now().toString(),
    edificio: document.getElementById('cEdif')?.value.trim()||'',
    rua:      document.getElementById('ccRua')?.value.trim()||'',
    num:      document.getElementById('ccNum')?.value.trim()||'',
    tipologia:document.getElementById('ccTipo')?.value||'',
    estado:   document.getElementById('cEst')?.value||'',
    valorPedido: parseMoney(document.getElementById('cValor')?.value||'0'),
    au: parseFloat(document.getElementById('cAU')?.value)||0,
    d: document.getElementById('cD')?.value||'',
    s: document.getElementById('cS')?.value||'',
    v: document.getElementById('cV')?.value||'',
    link: document.getElementById('cLink')?.value.trim()||'',
  };
  if (!c.edificio && !c.valorPedido) { toast('⚠️ Preencha Edifício e Valor Pedido'); return; }
  if (!currentACM.concorrentes) currentACM.concorrentes=[];
  currentACM.concorrentes.push(c);
  renderACM(); scheduleSave();
  if (c.edificio) await linkConcorrenteASimilares(c);
}

// 5.8 — vincula automaticamente o edifício do concorrente aos Condomínios Similares do imóvel
// avaliado; se o edifício ainda não existir na base de Condomínios, cria o registro primeiro.
async function linkConcorrenteASimilares(c) {
  if (!acmCondId) return; // só faz sentido quando o imóvel avaliado já está vinculado a um condomínio real
  let cond = condominios.find(x => (x.nome||'').toLowerCase() === c.edificio.toLowerCase());
  if (!cond) {
    const { data, error } = await db().from('condominios').insert({ nome: c.edificio, rua: c.rua||'', num: c.num||'' }).select().single();
    if (error) { console.warn('linkConcorrenteASimilares (criar condomínio):', error.message); return; }
    cond = data; condominios.push(cond);
  }
  if (cond.id === acmCondId) return; // o próprio imóvel avaliado — não vira "similar" dele mesmo
  const sims = getACMSimList();
  if (sims.find(s => s.id === cond.id)) return; // já vinculado
  sims.push({ id: cond.id, nome: cond.nome, rua: cond.rua||'', num: cond.num||'', bairro: cond.bairro||'' });
  await salvarSimilaresACM(sims);
  renderACMSimSection();
}

function descartarConcorrente(idx) { if(!currentACM)return; currentACM.concorrentes[idx].descartado=true;  renderACM(); scheduleSave(); }
function restaurarConcorrente(idx) { if(!currentACM)return; currentACM.concorrentes[idx].descartado=false; renderACM(); scheduleSave(); }
function descartarVendido(idx)     { if(!currentACM)return; currentACM.vendidos[idx].descartado=true;      renderACM(); scheduleSave(); }
function restaurarVendido(idx)     { if(!currentACM)return; currentACM.vendidos[idx].descartado=false;     renderACM(); scheduleSave(); }

function removeConcorrente(idx) {
  if(!currentACM)return;
  if (!confirm('Apagar este concorrente definitivamente? Essa ação não pode ser desfeita.')) return;
  currentACM.concorrentes.splice(idx,1); renderACM(); scheduleSave();
}
function removeVendido(idx) {
  if(!currentACM)return;
  if (!confirm('Apagar este vendido definitivamente? Essa ação não pode ser desfeita.')) return;
  currentACM.vendidos.splice(idx,1); renderACM(); scheduleSave();
}

function onACMEdifChange() {
  const val = (document.getElementById('acmEdif')?.value||'').trim();
  if (currentACM) currentACM.faixas.edificio = val;
  resolveACMCond(val);
  renderACMSimSection();
}

function onConcEdifChange() {
  const val = (document.getElementById('cEdif')?.value||'').trim();
  const cond = condominios.find(c => c.nome&&c.nome.toLowerCase()===val.toLowerCase());
  if (cond) {
    const r=document.getElementById('ccRua'), n=document.getElementById('ccNum');
    if (r&&!r.value) r.value=cond.rua||'';
    if (n&&!n.value) n.value=cond.num||'';
  }
}

// ── ACM Similares ─────────────────────────────────────────────────────────────
function getACMSimList() {
  if (acmCondId) {
    const c = condominios.find(x => x.id === acmCondId);
    return Array.isArray(c?.similares) ? c.similares : [];
  }
  return Array.isArray(currentACM?.similares) ? currentACM.similares : [];
}

// Edifícios de concorrentes desta ACM que ainda não estão nos Similares — pra adicionar com 1 clique.
function getConcEdifSuggestionsACM() {
  if (!currentACM) return [];
  const already = new Set(getACMSimList().map(s => (s.nome||'').toLowerCase()));
  const seen = new Set(); const out = [];
  (currentACM.concorrentes||[]).forEach(c => {
    const nome = (c.edificio||'').trim(); if (!nome) return;
    const key = nome.toLowerCase();
    if (already.has(key) || seen.has(key)) return;
    seen.add(key); out.push({ nome, rua: c.rua||'', num: c.num||'' });
  });
  return out;
}

function renderACMSimHtml() {
  const simsAll  = getACMSimList();
  const simIdx   = simsAll.map((s,i) => ({ s, i }));
  const simVal   = simIdx.filter(o => !o.s.descartado);
  const simDisc  = simIdx.filter(o => o.s.descartado);
  const condLabel = acmCondId ? (condominios.find(c=>c.id===acmCondId)?.nome||'') : '';
  const srcNote = acmCondId
    ? '<span style="font-size:10px;color:var(--success);margin-left:6px">✓ vinculado a "'+condLabel+'"</span>'
    : (currentACM?.faixas?.edificio ? '<span style="font-size:10px;color:var(--muted);margin-left:6px">edifício não encontrado na base — salvando localmente</span>' : '');

  const simItemHtml = (s, i, discarded) => {
    const actions = discarded
      ? `<button class="acm-link-btn" title="Restaurar" onclick="restaurarSimilarACM(${i})">${ICON_UNDO}</button><button class="acm-xbtn" title="Apagar definitivamente" onclick="apagarSimilarACM(${i})">${ICON_TRASH}</button>`
      : `<button class="acm-xbtn" title="Descartar" onclick="descartarSimilarACM(${i})">${ICON_ARCHIVE}</button>`;
    return '<div class="acmb-sim-item"'+(discarded?' style="opacity:.55"':'')+'><div style="min-width:0">' +
      '<div class="acmb-sim-nome">'+(s.nome||'—')+'</div>' +
      '<div class="acmb-sim-sub">'+[s.bairro,[s.rua,s.num].filter(Boolean).join(', ')].filter(Boolean).join(' · ')+'</div></div>' +
      '<div class="acmb-row-actions">'+actions+'</div></div>';
  };
  const items = simsAll.length
    ? '<div class="acmb-sim-grid">' + simVal.map(o=>simItemHtml(o.s,o.i,false)).join('') + '</div>' +
      (simDisc.length ? '<div class="acmb-disc-divider" style="border-radius:var(--radius-md);margin-top:8px" onclick="toggleACMSimDisc()">'+chevronIcon(acmSimDiscExpanded)+'Descartados ('+simDisc.length+') · clique para '+(acmSimDiscExpanded?'esconder':'ver')+'</div>' +
        (acmSimDiscExpanded ? '<div class="acmb-sim-grid" style="margin-top:8px">'+simDisc.map(o=>simItemHtml(o.s,o.i,true)).join('')+'</div>' : '') : '')
    : '<div style="font-size:12px;color:var(--muted);padding:4px 0">Nenhum similar cadastrado.</div>';

  const excIds = new Set([acmCondId, ...simsAll.filter(s=>s.id).map(s=>s.id)].filter(Boolean));
  const suggestions = condominios.filter(c => !excIds.has(c.id)).slice(0,4).map(c =>
    '<div class="cond-add-result-item" style="margin-bottom:4px" onclick="adicionarSimilarACMFromBase(\''+c.id+'\')">' +
    '<strong>'+(c.nome||'—')+'</strong> <span style="color:var(--muted)">'+(c.bairro||'')+'</span></div>'
  ).join('');

  const concSugs = getConcEdifSuggestionsACM();
  const concSugsHtml = concSugs.length
    ? '<div style="border-top:1px solid var(--border);margin:10px 0;padding-top:10px;font-size:12px;font-weight:600">Concorrentes desta ACM</div>' +
      '<div class="cond-add-results">' + concSugs.map(s =>
        '<div class="cond-add-result-item" style="margin-bottom:4px" onclick="adicionarSimilarDeConcorrente(\''+s.nome.replace(/'/g,"\\'")+'\')">' +
        '<strong>'+s.nome+'</strong> <span style="color:var(--muted)">'+[s.rua,s.num].filter(Boolean).join(', ')+'</span></div>'
      ).join('') + '</div>'
    : '';

  return '<div class="acmb-hdr">' +
    '<span class="acmb-title">Condomínios Similares'+(simsAll.length?' <span class="n">'+simsAll.length+'</span>':'')+srcNote+'</span>' +
    '<button class="btn btn-ghost btn-sm" onclick="toggleACMSimForm()" style="font-size:11px">+ Adicionar similar</button>' +
    '</div>' +
    '<div class="acmb-body">' +
    '<div id="acmSimList">'+items+'</div>' +
    '<div id="acmSimForm" style="display:none;margin-top:10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px">' +
    '<div style="font-size:12px;font-weight:600;margin-bottom:8px">Buscar na base</div>' +
    '<input type="text" id="acmSimSearch" placeholder="Buscar por nome ou bairro..." oninput="filtrarACMSimSearch()" style="width:100%;margin-bottom:6px">' +
    '<div id="acmSimSearchResults" class="cond-add-results">'+suggestions+'</div>' +
    concSugsHtml +
    '<div style="border-top:1px solid var(--border);margin:10px 0;padding-top:10px;font-size:12px;font-weight:600">Ou adicionar manualmente</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">' +
    '<input type="text" id="acmSimNome" placeholder="Nome do edifício *" style="flex:2;min-width:140px">' +
    '<input type="text" id="acmSimRua" placeholder="Rua" style="flex:2;min-width:100px">' +
    '<input type="text" id="acmSimNum" placeholder="Nº" style="flex:0 0 55px">' +
    '<input type="text" id="acmSimBairro" placeholder="Bairro" style="flex:1;min-width:90px">' +
    '<button class="btn btn-ghost btn-sm" onclick="toggleACMSimForm()" style="white-space:nowrap;flex-shrink:0">Cancelar</button>' +
    '<button class="btn btn-primary btn-sm" onclick="adicionarSimilarACMManual()" style="white-space:nowrap;flex-shrink:0">+ Adicionar</button>' +
    '</div>' +
    '</div>' +
    '</div>';
}

function toggleACMSimDisc() { acmSimDiscExpanded = !acmSimDiscExpanded; renderACMSimSection(); }

function renderACMSimSection() {
  const card = document.getElementById('acmSimCard');
  if (card) card.innerHTML = renderACMSimHtml();
}

function toggleACMSimForm() {
  const f = document.getElementById('acmSimForm'); if(!f) return;
  const open = f.style.display !== 'none';
  f.style.display = open ? 'none' : 'block';
  if (!open) setTimeout(() => setupRuaNumACById('acmSimRua','acmSimNum'), 30);
  if (!open) {
    ['acmSimSearch','acmSimNome','acmSimRua','acmSimNum','acmSimBairro'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    filtrarACMSimSearch();
  }
}

function filtrarACMSimSearch() {
  const q = (document.getElementById('acmSimSearch')?.value||'').toLowerCase().trim();
  const el = document.getElementById('acmSimSearchResults'); if(!el) return;
  const sims = getACMSimList();
  const excIds = new Set([acmCondId, ...sims.filter(s=>s.id).map(s=>s.id)].filter(Boolean));
  const pool = q.length >= 2
    ? condominios.filter(c => !excIds.has(c.id) && ((c.nome||'').toLowerCase().includes(q)||(c.bairro||'').toLowerCase().includes(q))).slice(0,8)
    : condominios.filter(c => !excIds.has(c.id)).slice(0,4);
  if (!pool.length) { el.innerHTML='<div style="font-size:12px;color:var(--muted);padding:6px">Nenhum resultado.</div>'; return; }
  el.innerHTML = pool.map(c =>
    '<div class="cond-add-result-item" style="margin-bottom:4px" onclick="adicionarSimilarACMFromBase(\''+c.id+'\')">' +
    '<strong>'+(c.nome||'—')+'</strong> <span style="color:var(--muted)">'+(c.bairro||'')+'</span></div>'
  ).join('');
}

async function adicionarSimilarACMFromBase(id) {
  const c = condominios.find(x=>x.id===id); if(!c) return;
  const sims = getACMSimList();
  if (sims.find(s=>s.id===id)) { toast('⚠️ Já adicionado'); return; }
  sims.push({ id:c.id, nome:c.nome, rua:c.rua||'', num:c.num||'', bairro:c.bairro||'' });
  await salvarSimilaresACM(sims);
  renderACMSimSection();
  toggleACMSimForm();
}

async function adicionarSimilarACMManual() {
  const nome = (document.getElementById('acmSimNome')?.value||'').trim();
  if (!nome) { toast('⚠️ Nome obrigatório'); return; }
  const sims = getACMSimList();
  sims.push({
    nome,
    rua:    (document.getElementById('acmSimRua')?.value||'').trim(),
    num:    (document.getElementById('acmSimNum')?.value||'').trim(),
    bairro: (document.getElementById('acmSimBairro')?.value||'').trim(),
  });
  await salvarSimilaresACM(sims);
  renderACMSimSection();
  toggleACMSimForm();
}

async function adicionarSimilarDeConcorrente(nome) {
  const cond = condominios.find(c => (c.nome||'').toLowerCase() === nome.toLowerCase());
  if (cond) { await adicionarSimilarACMFromBase(cond.id); return; }
  const c = (currentACM?.concorrentes||[]).find(x => (x.edificio||'').toLowerCase() === nome.toLowerCase());
  const sims = getACMSimList();
  if (sims.find(s => (s.nome||'').toLowerCase() === nome.toLowerCase())) { toast('⚠️ Já adicionado'); return; }
  sims.push({ nome, rua: c?.rua||'', num: c?.num||'', bairro: '' });
  await salvarSimilaresACM(sims);
  renderACMSimSection();
}

async function descartarSimilarACM(idx) {
  const sims = [...getACMSimList()];
  if (!sims[idx]) return;
  sims[idx] = { ...sims[idx], descartado: true };
  await salvarSimilaresACM(sims); renderACMSimSection();
}
async function restaurarSimilarACM(idx) {
  const sims = [...getACMSimList()];
  if (!sims[idx]) return;
  sims[idx] = { ...sims[idx], descartado: false };
  await salvarSimilaresACM(sims); renderACMSimSection();
}
async function apagarSimilarACM(idx) {
  if (!confirm('Apagar este similar definitivamente? Essa ação não pode ser desfeita.')) return;
  const sims = [...getACMSimList()];
  sims.splice(idx, 1);
  await salvarSimilaresACM(sims);
  renderACMSimSection();
}

async function salvarSimilaresACM(sims) {
  if (acmCondId) {
    const { error } = await db().from('condominios').update({ similares: sims, updated_at: new Date().toISOString() }).eq('id', acmCondId);
    if (error) { toast('❌ Erro: '+error.message); return; }
    // Atualiza em memória
    const c = condominios.find(x=>x.id===acmCondId);
    if (c) c.similares = sims;
    toast('✅ Similares salvos');
  } else {
    if (!currentACM) return;
    currentACM.similares = sims;
    scheduleSave();
    toast('✅ Similares salvos');
  }
}

// Selo "% transmitido" — fonte única da regra (D-4): só mostra selo se 0 < proporcao < 100.
// Ausente, nulo, 0 ou >= 100 devolvem '' (ACMs antigos sem o campo ficam em silêncio).
function acmPropBadge(r) {
  const p = parseFloat(r && r.proporcao);
  if (!(p > 0 && p < 100)) return '';
  const txt = p.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return `<span class="gest-outline-badge warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${txt}% transmitido</span>`;
}

// Filtro de número EXATO (26/07/2026). Antes era numero LIKE '%372%', que trazia 1372 e 3720 junto.
// Aceita o número gravado com espaço em volta e com zero à esquerda ("0372" casa com "372").
// Número não numérico (ex.: "S/N") vira comparação exata de texto.
// Devolve null quando não há número — aí a busca fica só pela rua.
function itbiNumCond(num) {
  const n = String(num == null ? '' : num).trim();
  if (!n) return null;
  return /^\d+$/.test(n)
    ? { sql: "(TRIM(numero) = ? OR (TRIM(numero) GLOB '[0-9]*' AND CAST(TRIM(numero) AS INTEGER) = ?))", params: [n, parseInt(n, 10)] }
    : { sql: 'TRIM(UPPER(numero)) = ?', params: [n.toUpperCase()] };
}

// Carrega os vendidos do ITBI do próprio endereço do imóvel avaliado.
// 26/07/2026: deixou de buscar também por nome de edifício (UPPER(referencia) LIKE '%NOME%') —
// era o que trazia "Ed. Sandra" de outras ruas para dentro do ACM. Agora só rua + número.
async function autoLoadITBIForACM(cfg) {
  const rua      = removeAccentsUpper(cfg.rua || '');
  const num      = (cfg.num || '').trim();
  if (!rua) return;
  const loadEl = document.getElementById('acmITBIAutoLoad');
  const label  = titleRua(cfg.rua) + (num ? ', ' + num : '');
  if (loadEl) loadEl.textContent = 'Buscando vendidos de ' + label + '...';
  try {
    const database = await loadITBIdb();
    const conds = [], params = [];
    const nc = itbiNumCond(num);
    if (nc) { conds.push('(logradouro_norm LIKE ? AND ' + nc.sql + ')'); params.push('%'+rua+'%', ...nc.params); }
    else    { conds.push('logradouro_norm LIKE ?'); params.push('%'+rua+'%'); }
    const sql = 'SELECT data_transacao,logradouro,logradouro_fmt,numero,complemento,bairro,referencia,area_construida_m2,valor_transacao,valor_m2,cartorio,matricula,sql,proporcao_transmitida FROM vendas WHERE (' + conds.join(' OR ') + ') AND ' + ITBI_SQL_ANO + ' ORDER BY data_transacao DESC LIMIT 300';
    const stmt = database.prepare(sql); stmt.bind(params);
    const rows = [];
    while(stmt.step()){ const r=stmt.getAsObject(); const comp=(r.complemento||'').toUpperCase(); if(comp.startsWith('VAGA')||comp.startsWith('VG')||comp.startsWith('GARAGEM')||comp.startsWith('BOX'))continue; rows.push({data:r.data_transacao,logradouro:r.logradouro,logradouro_fmt:r.logradouro_fmt,numero:r.numero,complemento:r.complemento,bairro:r.bairro,referencia:r.referencia,area:parseFloat(r.area_construida_m2)||0,valor:parseFloat(r.valor_transacao)||0,valorM2:parseFloat(r.valor_m2)||0,cartorio:r.cartorio,matricula:r.matricula,sql:r.sql,proporcao:parseFloat(r.proporcao_transmitida)||null}); }
    stmt.free();
    if (rows.length) {
      const ex = new Set((currentACM.vendidos||[]).map(r=>r.matricula+r.data));
      currentACM.vendidos.push(...rows.filter(r=>!ex.has(r.matricula+r.data)));
      renderACM(); scheduleSave();
    }
    if (loadEl) loadEl.textContent = rows.length ? rows.length+' vendidos encontrados' : '';
    _acmMedir('fim', 'M1', rows.length + ' vendidos · ' + label);   // medição temporária (Fatia 1)
  } catch(e) { _acmMedir('descartar', 'M1'); if(loadEl) loadEl.textContent=''; }   // erro não entra na mediana
}

function addSearchRua() {
  const cont = document.getElementById('acmSearchRuas'); if(!cont) return;
  const div = document.createElement('div'); div.className='acm-search-addr-row';
  div.innerHTML='<input class="acm-sr-rua" placeholder="Nome da rua"/><input class="acm-sr-num" placeholder="Nº" style="flex:0 0 70px"/>';
  cont.appendChild(div); _initACRowAC(div);
}

function limparITBISearch() {
  const r = document.getElementById('acmITBISearchResults'); if(r) r.innerHTML='';
  document.querySelectorAll('#acmSearchRuas .acm-sr-rua, #acmSearchRuas .acm-sr-num').forEach(el=>el.value='');
  const b = document.getElementById('acmSrBairro'); if(b) b.value='';
}

async function doITBISearch() {
  if (!currentACM) return;
  const ruas  = [...document.querySelectorAll('#acmSearchRuas .acm-sr-rua')].map(el=>removeAccentsUpper(el.value)).filter(Boolean);
  const nums  = [...document.querySelectorAll('#acmSearchRuas .acm-sr-num')].map(el=>el.value.trim());
  const bairro  = removeAccentsUpper(document.getElementById('acmSrBairro')?.value||'');
  const anoIni  = document.getElementById('acmSrAnoIni')?.value||'2020';
  const anoFim  = document.getElementById('acmSrAnoFim')?.value||'2026';
  if (!ruas.length) { toast('⚠️ Preencha pelo menos uma rua'); return; }
  const resultsEl = document.getElementById('acmITBISearchResults');
  _acmMedir('inicio', 'M2');   // medição temporária da Fatia 1: clique em "Buscar" → lista na tela
  resultsEl.innerHTML='<div style="padding:10px;color:var(--muted);font-size:12px;display:flex;align-items:center;gap:6px"><div class="spinner" style="width:12px;height:12px;border-width:2px"></div>Buscando...</div>';
  try {
    const database = await loadITBIdb();
    const conds=[], params=[];
    ruas.forEach((rua,i)=>{ const nc=itbiNumCond(nums[i]); if(nc){conds.push('(logradouro_norm LIKE ? AND '+nc.sql+')');params.push('%'+rua+'%',...nc.params);}else{conds.push('logradouro_norm LIKE ?');params.push('%'+rua+'%');} });
    let sql='SELECT data_transacao,logradouro,logradouro_fmt,numero,complemento,bairro,referencia,area_construida_m2,valor_transacao,valor_m2,cartorio,matricula,sql,proporcao_transmitida FROM vendas WHERE ('+conds.join(' OR ')+') AND '+ITBI_SQL_ANO;
    if(bairro){sql+=' AND UPPER(bairro) LIKE ?';params.push('%'+bairro+'%');}
    sql+=` AND data_transacao >= '${anoIni}-01-01' AND data_transacao <= '${anoFim}-12-31' ORDER BY data_transacao DESC LIMIT 300`;
    const stmt=database.prepare(sql); stmt.bind(params);
    const rows=[];
    while(stmt.step()){const r=stmt.getAsObject();const comp=(r.complemento||'').toUpperCase();if(comp.startsWith('VAGA')||comp.startsWith('VG')||comp.startsWith('GARAGEM')||comp.startsWith('BOX'))continue;rows.push({data:r.data_transacao,logradouro:r.logradouro,logradouro_fmt:r.logradouro_fmt,numero:r.numero,complemento:r.complemento,bairro:r.bairro,referencia:r.referencia,area:parseFloat(r.area_construida_m2)||0,valor:parseFloat(r.valor_transacao)||0,valorM2:parseFloat(r.valor_m2)||0,cartorio:r.cartorio,matricula:r.matricula,sql:r.sql,proporcao:parseFloat(r.proporcao_transmitida)||null});}
    stmt.free();
    if (!rows.length) { resultsEl.innerHTML='<div style="padding:10px;color:var(--muted);font-size:12px">Nenhum resultado encontrado.</div>'; _acmMedir('descartar', 'M2'); return; }   // busca sem lista não entra na mediana
    const ex=new Set((currentACM.vendidos||[]).map(r=>r.matricula+r.data));
    const novos=rows.filter(r=>!ex.has(r.matricula+r.data));
    const df=s=>{if(!s)return'—';const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]}`:s;};
    window._itbiResults=rows;
    resultsEl.innerHTML=`<div style="padding:8px 0;display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:12px;color:var(--muted)">${rows.length} resultado${rows.length!==1?'s':''} · ${novos.length} novos</span>
      ${novos.length>0?`<button class="btn btn-primary btn-sm" onclick="addAllITBIResults(window._itbiResults)" style="font-size:11px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><polyline points="20 6 9 17 4 12"/></svg>Adicionar ${novos.length} novos</button>`:'<span style="font-size:11px;color:var(--muted)">Todos já adicionados</span>'}
    </div>
    <div class="acm-tw" style="max-height:260px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="background:var(--surface2)"><th style="padding:4px 6px">Data</th><th style="padding:4px 6px">Rua</th><th style="padding:4px 6px">Nº</th><th style="padding:4px 6px">Compl.</th><th style="padding:4px 6px">Edifício</th><th style="padding:4px 6px">A.C.</th><th style="padding:4px 6px">Valor</th><th style="padding:4px 6px">R$/m²</th><th></th></tr></thead>
        <tbody>${rows.map((r,i)=>{const isNew=!ex.has(r.matricula+r.data);return`<tr style="opacity:${isNew?1:0.4}"><td style="padding:3px 6px;white-space:nowrap">${df(r.data)}</td><td style="padding:3px 6px">${ruaExib(r)||'—'}</td><td style="padding:3px 6px">${r.numero||'—'}</td><td style="padding:3px 6px">${titleRua(r.complemento)||'—'}</td><td style="padding:3px 6px">${titleRua(r.referencia)||'—'}</td><td style="padding:3px 6px;text-align:center">${r.area||'—'}</td><td style="padding:3px 6px;text-align:right;color:var(--success)">${(pb=>pb?`<div class="acm-prop-cell" style="align-items:flex-end"><span>${r.valor>0?fmtMoeda(r.valor):'—'}</span>${pb}</div>`:(r.valor>0?fmtMoeda(r.valor):'—'))(acmPropBadge(r))}</td><td style="padding:3px 6px;text-align:right;color:var(--accent)">${r.valorM2>0?fmtMoneyInt(r.valorM2):'—'}</td><td>${isNew?`<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:1px 5px" onclick="addSingleITBIResult(${i})">+</button>`:'✓'}</td></tr>`;}).join('')}</tbody>
      </table>
    </div>`;
    _acmMedir('fim', 'M2', rows.length + ' resultados');   // medição temporária (Fatia 1)
  } catch(e) { _acmMedir('descartar', 'M2'); resultsEl.innerHTML='<div style="padding:10px;color:var(--danger);font-size:12px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Erro: '+e.message+'</div>'; }
}

function addAllITBIResults(rows) {
  if (!currentACM||!rows) return;
  const ex=new Set((currentACM.vendidos||[]).map(r=>r.matricula+r.data));
  const novos=rows.filter(r=>!ex.has(r.matricula+r.data));
  if (!currentACM.vendidos) currentACM.vendidos=[];
  currentACM.vendidos.push(...novos);
  renderACM(); scheduleSave(); toast('✅ '+novos.length+' vendidos adicionados');
}

function addSingleITBIResult(idx) {
  if (!currentACM||!window._itbiResults) return;
  const r=window._itbiResults[idx];
  if (!currentACM.vendidos) currentACM.vendidos=[];
  const ex=new Set(currentACM.vendidos.map(x=>x.matricula+x.data));
  if (!ex.has(r.matricula+r.data)) { currentACM.vendidos.push(r); renderACM(); scheduleSave(); }
}

// Busca no ITBI as vendas dos concorrentes do ACM.
// 26/07/2026: deixou de buscar por nome de edifício (trazia prédio homônimo de outra rua) —
// agora busca pelo endereço de cada concorrente (rua + número), igual ao resto do ACM.
async function addConcorrentesVendidos(evt) {
  if (!currentACM||!(currentACM.concorrentes||[]).length) { toast('⚠️ Adicione concorrentes primeiro'); return; }
  const enderecos=[];
  const vistos=new Set();
  const semEndereco=[];   // concorrentes sem rua ficam de fora — avisar explicitamente, nunca em silêncio
  (currentACM.concorrentes||[]).forEach(c=>{
    const rua=removeAccentsUpper(c.rua||'');
    if(!rua){ semEndereco.push(c.edificio||c.nome||'sem nome'); return; }
    const num=String(c.num||'').trim();
    const k=rua+'|'+num; if(vistos.has(k)) return; vistos.add(k);
    enderecos.push({rua,num});
  });
  if (!enderecos.length) { toast('⚠️ Preencha o campo Rua nos concorrentes'); return; }
  const btn=evt.target; btn.textContent='Buscando...'; btn.disabled=true;
  try {
    const database=await loadITBIdb();
    let added=0;
    const ex=new Set((currentACM.vendidos||[]).map(r=>r.matricula+r.data));
    enderecos.forEach(({rua,num})=>{
      const nc=itbiNumCond(num);
      const where=nc?'logradouro_norm LIKE ? AND '+nc.sql:'logradouro_norm LIKE ?';
      const stmt=database.prepare('SELECT data_transacao,logradouro,logradouro_fmt,numero,complemento,bairro,referencia,area_construida_m2,valor_transacao,valor_m2,cartorio,matricula,sql,proporcao_transmitida FROM vendas WHERE '+where+' AND '+ITBI_SQL_ANO+' ORDER BY data_transacao DESC LIMIT 100');
      stmt.bind(['%'+rua+'%',...(nc?nc.params:[])]);
      while(stmt.step()){const r=stmt.getAsObject();const comp=(r.complemento||'').toUpperCase();if(comp.startsWith('VAGA')||comp.startsWith('VG')||comp.startsWith('GARAGEM')||comp.startsWith('BOX'))continue;const k=(r.matricula||'')+(r.data_transacao||'');if(!ex.has(k)){currentACM.vendidos.push({data:r.data_transacao,logradouro:r.logradouro,logradouro_fmt:r.logradouro_fmt,numero:r.numero,complemento:r.complemento,bairro:r.bairro,referencia:r.referencia,area:parseFloat(r.area_construida_m2)||0,valor:parseFloat(r.valor_transacao)||0,valorM2:parseFloat(r.valor_m2)||0,cartorio:r.cartorio,matricula:r.matricula,sql:r.sql,proporcao:parseFloat(r.proporcao_transmitida)||null});ex.add(k);added++;}}
      stmt.free();
    });
    renderACM(); scheduleSave();
    toast('✅ '+added+' transações adicionadas');
    if (semEndereco.length) toast('⚠️ '+semEndereco.length+' concorrente'+(semEndereco.length>1?'s ficaram':' ficou')+' de fora por não ter rua preenchida: '+semEndereco.join(', '));
    btn.textContent='Buscar todos conc.'; btn.disabled=false;
  } catch(e) { btn.textContent='Buscar todos conc.'; btn.disabled=false; toast('❌ '+e.message); }
}

// ── Autocomplete ITBI (busca dentro dos campos de rua/número do painel de busca) ────
// Fatia 2 (01/08/2026): C-6 e C-7 passaram a consultar o balcão do ITBI (Supabase)
// via itbiAcRuas/itbiAcNumeros do core.js — sem baixar mais o banco para sugerir.
// Diferença proposital para o autopreencher do core: aqui NÃO entram as ruas do
// cadastro local (o painel de busca sempre foi só ITBI — comportamento mantido).
function setupACMSearchAC(input, type, getRuaEl) {
  const wrap=document.createElement('div'); wrap.className='acm-ac-wrap';
  input.parentNode.insertBefore(wrap,input); wrap.appendChild(input);
  const drop=document.createElement('div'); drop.className='acm-ac-drop'; drop.style.display='none'; wrap.appendChild(drop);
  let _seq=0;
  input.addEventListener('input',()=>{
    clearTimeout(_acTimer);
    const val=removeAccentsUpper(input.value);
    if(val.length<2){drop.style.display='none';_seq++;return;}
    _acTimer=setTimeout(async()=>{
      const meu=++_seq;   // resposta antiga não desenha por cima da digitação nova
      try {
        _itbiAcRender(drop,input,[],{buscando:true});
        if(type==='rua'){
          const r=await itbiAcRuas(val);
          if(meu!==_seq)return;
          _itbiAcRender(drop,input,r.ok?r.ruas.slice(0,12):[],r.ok?null:{falha:r.motivo});
        } else {
          const rua=removeAccentsUpper(getRuaEl?.value||'');
          // Rua vazia busca o número em todas as ruas — comportamento de hoje, mantido.
          const r=await itbiAcNumeros(rua,val);
          if(meu!==_seq)return;
          _itbiAcRender(drop,input,r.ok?r.numeros:[],r.ok?null:{falha:r.motivo});
        }
      } catch(e){ if(meu===_seq) drop.style.display='none'; }
    },250);
  });
  input.addEventListener('blur',()=>setTimeout(()=>drop.style.display='none',200));
}
function _initACRowAC(row) {
  const r=row.querySelector('.acm-sr-rua'), n=row.querySelector('.acm-sr-num');
  if(r) setupACMSearchAC(r,'rua',null);
  if(n) setupACMSearchAC(n,'num',r);
}
function initACMSearchPanelAC() {
  document.querySelectorAll('#acmSearchRuas .acm-search-addr-row').forEach(r=>_initACRowAC(r));
}

function initColResize(tableId) {
  const table=document.getElementById(tableId); if(!table) return;
  table.querySelectorAll('thead th').forEach(th=>{
    if(th.querySelector('.col-resizer'))return;
    const r=document.createElement('div'); r.className='col-resizer';
    th.style.position='relative'; th.appendChild(r);
    let startX,startW;
    r.addEventListener('mousedown',e=>{e.preventDefault();startX=e.clientX;startW=th.offsetWidth;
      const mv=ev=>th.style.minWidth=Math.max(30,startW+ev.clientX-startX)+'px';
      const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
      document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
    });
  });
}

