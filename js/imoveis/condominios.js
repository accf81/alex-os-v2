// condominios.js — aba Condomínios (lista, modal, ficha, similares, busca ITBI própria).
// Extraído de imoveis.html em 04/07/2026 (item 12.4). Redesign visual + filtros 05/07/2026 (10.4).
// Depende de core.js + loader ITBI (acm) em runtime.

// ── Condomínios — grade + filtros ───────────────────────────────────────────────
let condFiltro = { busca: '', bairro: '', tipos: [], ordem: 'recentes' };

function renderCondominios() {
  const el = document.getElementById('sv-condominios');

  if (!condominios.length) {
    el.innerHTML = '<div class="empty-state"><div class="es-icon"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="1"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="15" y2="15"/></svg></div><p>Nenhum condomínio ainda.</p></div>';
    return;
  }

  el.innerHTML =
    '<div class="cond-toolbar">' +
      '<div class="cond-search-wrap">' +
        '<input type="text" class="cond-search" id="condSearch" placeholder="Buscar por rua ou nome do edifício..." value="' + condFiltro.busca + '" oninput="condFiltro.busca=this.value;filtrarConds();document.getElementById(\'condSearchClear\').style.display=this.value?\'flex\':\'none\'">' +
        '<button class="cond-search-clear" id="condSearchClear" style="display:' + (condFiltro.busca ? 'flex' : 'none') + '" onclick="limparBuscaCond()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
      '</div>' +
      '<details class="cond-filter" id="condFiltroBairro" ontoggle="if(this.open)fecharOutrosFiltrosCond(this)">' +
        '<summary class="cond-filter-btn">Bairro <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></summary>' +
        '<div class="cond-filter-pop">' +
          '<div><span class="cond-filter-lbl">Bairro</span><input type="text" id="condFBairro" placeholder="Ex.: Jardim Paulista" value="' + condFiltro.bairro + '"></div>' +
          '<button class="btn btn-primary btn-sm" onclick="aplicarFiltroCondBairro()">Aplicar</button>' +
        '</div>' +
      '</details>' +
      '<details class="cond-filter" id="condFiltroTipo" ontoggle="if(this.open)fecharOutrosFiltrosCond(this)">' +
        '<summary class="cond-filter-btn">Tipo <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></summary>' +
        '<div class="cond-filter-pop">' +
          ['Residencial', 'Comercial', 'Misto'].map(t =>
            '<label class="cond-filter-check"><span>' + t + '</span><input type="checkbox" ' + (condFiltro.tipos.includes(t) ? 'checked ' : '') + 'onchange="toggleFiltroCondTipo(\'' + t + '\',this.checked)"></label>'
          ).join('') +
          '<button class="btn btn-primary btn-sm" onclick="document.getElementById(\'condFiltroTipo\').removeAttribute(\'open\');filtrarConds()">Aplicar</button>' +
        '</div>' +
      '</details>' +
    '</div>' +
    '<div class="cond-toolbar-row2">' +
      '<div class="cond-count" id="condCount"></div>' +
      '<div class="cond-sort">Ordenar por <select id="condOrdem" onchange="condFiltro.ordem=this.value;filtrarConds()">' +
        '<option value="recentes"' + (condFiltro.ordem === 'recentes' ? ' selected' : '') + '>Mais recentes</option>' +
        '<option value="nome"' + (condFiltro.ordem === 'nome' ? ' selected' : '') + '>Nome (A–Z)</option>' +
        '<option value="ano"' + (condFiltro.ordem === 'ano' ? ' selected' : '') + '>Ano de construção</option>' +
      '</select></div>' +
    '</div>' +
    '<div class="cond-grid" id="condGrid"></div>';

  filtrarConds();
}

// Fecha os outros popovers de filtro quando um é aberto (mesmo padrão da tela Imóveis, 06/07/2026).
function fecharOutrosFiltrosCond(atual) {
  document.querySelectorAll('.cond-filter').forEach(d => { if (d !== atual) d.removeAttribute('open'); });
}

function toggleFiltroCondTipo(tipo, checked) {
  if (checked) { if (!condFiltro.tipos.includes(tipo)) condFiltro.tipos.push(tipo); }
  else { condFiltro.tipos = condFiltro.tipos.filter(t => t !== tipo); }
}

function aplicarFiltroCondBairro() {
  condFiltro.bairro = (document.getElementById('condFBairro')?.value || '').trim();
  document.getElementById('condFiltroBairro')?.removeAttribute('open');
  filtrarConds();
}

function limparBuscaCond() {
  condFiltro.busca = '';
  const input = document.getElementById('condSearch');
  if (input) input.value = '';
  const clearBtn = document.getElementById('condSearchClear');
  if (clearBtn) clearBtn.style.display = 'none';
  filtrarConds();
}

function filtrarConds() {
  const q = condFiltro.busca.toLowerCase().trim();
  let fil = condominios.filter(c => {
    if (q && !((c.nome || '').toLowerCase().includes(q) || (c.rua || '').toLowerCase().includes(q))) return false;
    if (condFiltro.bairro && !(c.bairro || '').toLowerCase().includes(condFiltro.bairro.toLowerCase())) return false;
    if (condFiltro.tipos.length && !condFiltro.tipos.includes(c.tipo)) return false;
    return true;
  });

  if (condFiltro.ordem === 'nome') fil = fil.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  else if (condFiltro.ordem === 'ano') fil = fil.slice().sort((a, b) => (parseInt(b.ano_construcao) || 0) - (parseInt(a.ano_construcao) || 0));
  else fil = fil.slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const countEl = document.getElementById('condCount');
  if (countEl) countEl.innerHTML = '<b>' + fil.length + '</b> condomínio' + (fil.length === 1 ? '' : 's') + ' encontrado' + (fil.length === 1 ? '' : 's');
  const el = document.getElementById('condGrid');
  if (el) el.innerHTML = condominiosCards(fil);
}

// Fotos: usa `fotos` (galeria) e cai pra `foto_capa` se a galeria estiver vazia (dado antigo).
function condFotosDe(c) {
  if (Array.isArray(c.fotos) && c.fotos.length) return c.fotos;
  return c.foto_capa ? [c.foto_capa] : [];
}

// Header da ficha: 1 foto = full width; 2 = lado a lado; 3+ = principal + 2 empilhadas (mostra só as 3 primeiras).
function condFichaFotosHtml(fotos) {
  if (!fotos.length) return '';
  const onerr = ' onerror="this.style.display=\'none\'"';
  if (fotos.length === 1) return '<div class="cond-ficha-fotos um">' + '<img src="' + fotos[0] + '"' + onerr + '></div>';
  if (fotos.length === 2) return '<div class="cond-ficha-fotos dois">' +
    '<img src="' + fotos[0] + '"' + onerr + '><img src="' + fotos[1] + '"' + onerr + '></div>';
  return '<div class="cond-ficha-fotos tres">' +
    '<img src="' + fotos[0] + '"' + onerr + '><img src="' + fotos[1] + '"' + onerr + '><img src="' + fotos[2] + '"' + onerr + '></div>';
}

const condCardIdx = {}; // índice da foto atual em cada card, por id do condomínio

function condCardFotoHtml(id, fotos) {
  const i = condCardIdx[id] || 0;
  const setas = fotos.length > 1
    ? '<button class="cond-carousel-arrow left" onclick="condCardNav(\'' + id + '\',-1,event)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<button class="cond-carousel-arrow right" onclick="condCardNav(\'' + id + '\',1,event)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>' +
      '<div class="cond-carousel-dots">' + fotos.map((_, idx) => '<i class="' + (idx === i ? 'on' : '') + '"></i>').join('') + '</div>'
    : '';
  return '<div class="cond-card-foto-wrap" id="condCardFoto-' + id + '">' +
    '<img src="' + fotos[i] + '" class="cond-card-foto" onerror="this.style.display=\'none\'">' +
    setas +
  '</div>';
}

function condCardNav(id, dir, ev) {
  ev.stopPropagation();
  const c = condominios.find(x => x.id === id);
  if (!c) return;
  const fotos = condFotosDe(c);
  if (!fotos.length) return;
  const atual = condCardIdx[id] || 0;
  condCardIdx[id] = (atual + dir + fotos.length) % fotos.length;
  const wrap = document.getElementById('condCardFoto-' + id);
  if (wrap) wrap.outerHTML = condCardFotoHtml(id, fotos);
}

function condominiosCards(list) {
  if (!list.length) return '<div class="cond-empty">Nenhum resultado.</div>';
  return list.map(c => {
    const urls = [
      c.url_quinto     ? '<span class="badge badge-gray" onclick="event.stopPropagation();window.open(\'' + c.url_quinto     + '\',\'_blank\')">QuintoAndar</span>' : '',
      c.url_imovel_web ? '<span class="badge badge-gray" onclick="event.stopPropagation();window.open(\'' + c.url_imovel_web + '\',\'_blank\')">ImóvelWeb</span>'   : '',
      c.url_loft       ? '<span class="badge badge-gray" onclick="event.stopPropagation();window.open(\'' + c.url_loft       + '\',\'_blank\')">Loft</span>'          : '',
    ].filter(Boolean).join('');
    const fotos = condFotosDe(c);
    const fotoHtml = fotos.length ? condCardFotoHtml(c.id, fotos) :
      '<div class="cond-card-foto-wrap"><div class="card-foto-placeholder"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div></div>';
    return '<div class="cond-card" onclick="openCondFicha(\'' + c.id + '\')">' +
      fotoHtml +
      '<div class="cond-card-body">' +
      '<div class="cond-card-nome">' + (c.nome || '—') + '</div>' +
      '<div class="cond-card-sub"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>' +
        (c.bairro || '—') +
      '</div>' +
      '<div class="cond-card-endereco">' + ([c.rua, c.num].filter(Boolean).join(', ') || '—') + '</div>' +
      '<div class="cond-card-meta">' +
        (c.ano_construcao ? '<span class="tag"><i></i>' + c.ano_construcao + (c.construtora ? ' · ' + c.construtora : '') + '</span>' : '') +
        (c.proximo_metro  ? '<span class="tag" data-tone="accent"><i></i>' + c.proximo_metro + '</span>' : '') +
      '</div>' +
      '<div class="cond-card-urls">' + (urls || '<span class="ds-meta">Sem anúncios cadastrados</span>') + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ── Modal Condomínio ──────────────────────────────────────────────────────────
function openCondModal(id) {
  editCondId = id || null;
  const c = id ? condominios.find(x => x.id === id) : null;
  document.getElementById('condModalTitulo').textContent = c ? 'Editar Condomínio' : 'Novo Condomínio';
  document.getElementById('cNome').value        = c?.nome          || '';
  document.getElementById('cTipo').value        = c?.tipo          || 'Residencial';
  document.getElementById('cBairro').value      = c?.bairro        || '';
  document.getElementById('cRua').value         = c?.rua           || '';
  document.getElementById('cNum').value         = c?.num           || '';
  document.getElementById('cAno').value         = c?.ano_construcao|| '';
  document.getElementById('cConstrutora').value = c?.construtora   || '';
  document.getElementById('cMetro').value       = c?.proximo_metro || '';
  document.getElementById('cUrlQuinto').value   = c?.url_quinto    || '';
  document.getElementById('cUrlImovelWeb').value= c?.url_imovel_web|| '';
  document.getElementById('cUrlLoft').value     = c?.url_loft      || '';
  condFotosEdit = JSON.parse(JSON.stringify(condFotosDe(c || {})));
  document.getElementById('condFotosPasta').value = c?.fotos_pasta_url || '';
  renderCondFotosPreview();
  document.getElementById('cObs').value         = c?.obs           || '';
  document.getElementById('btnCondDel').style.display = c ? '' : 'none';
  document.getElementById('condOverlay').classList.add('open');
  setTimeout(() => { document.getElementById('cNome').focus(); setupRuaNumACById('cRua','cNum'); }, 50);
}

function closeCondModal() {
  document.getElementById('condOverlay').classList.remove('open');
  editCondId = null;
}

// ── Fotos do condomínio (modal) — galeria via pasta do Google Drive (redesign 10.4, 06/07/2026) ──
let condFotosEdit = []; // array de URLs em edição no modal
let condFotosSortableInstance = null;

function renderCondFotosPreview() {
  const wrap = document.getElementById('condFotosPreview'); if (!wrap) return;
  const countEl = document.getElementById('condFotosCount'); if (countEl) countEl.textContent = condFotosEdit.length;
  if (!condFotosEdit.length) { wrap.innerHTML = '<div class="drive-empty">Nenhuma foto ainda — cole o link da pasta do Drive acima.</div>'; return; }
  wrap.innerHTML = condFotosEdit.map((url,i) =>
    '<div class="drive-thumb">' +
      '<div class="drag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg></div>' +
      '<img src="'+url+'" onerror="this.parentNode.style.opacity=\'.35\'">' +
      '<span class="x" onclick="removerCondFotoEdit('+i+')">×</span>' +
      (i===0 ? '<div class="capa">Capa</div>' : '') +
    '</div>'
  ).join('');
  const wrapEl = document.getElementById('condFotosPreview');
  if (wrapEl && typeof Sortable !== 'undefined') {
    if (condFotosSortableInstance) condFotosSortableInstance.destroy();
    condFotosSortableInstance = new Sortable(wrapEl, { animation: 150, onEnd: (evt) => {
      const moved = condFotosEdit.splice(evt.oldIndex, 1)[0];
      condFotosEdit.splice(evt.newIndex, 0, moved);
      renderCondFotosPreview();
    }});
  }
}

function removerCondFotoEdit(i) { condFotosEdit.splice(i,1); renderCondFotosPreview(); }

async function salvarCond() {
  const nome = document.getElementById('cNome').value.trim();
  if (!nome) { toast('⚠️ Nome obrigatório'); return; }

  const fotos = condFotosEdit;

  const payload = {
    nome,
    tipo:           document.getElementById('cTipo').value         || null,
    bairro:         document.getElementById('cBairro').value.trim()|| null,
    rua:            document.getElementById('cRua').value.trim()   || null,
    num:            document.getElementById('cNum').value.trim()   || null,
    ano_construcao: document.getElementById('cAno').value.trim()   || null,
    construtora:    document.getElementById('cConstrutora').value.trim() || null,
    proximo_metro:  document.getElementById('cMetro').value.trim() || null,
    url_quinto:     document.getElementById('cUrlQuinto').value.trim()   || null,
    url_imovel_web: document.getElementById('cUrlImovelWeb').value.trim()|| null,
    url_loft:       document.getElementById('cUrlLoft').value.trim()     || null,
    fotos:          fotos,
    foto_capa:      fotos[0] || null,
    fotos_pasta_url: document.getElementById('condFotosPasta').value.trim() || null,
    obs:            document.getElementById('cObs').value.trim()   || null,
    updated_at:     new Date().toISOString()
  };

  let error;
  if (editCondId) {
    ({ error } = await db().from('condominios').update(payload).eq('id', editCondId));
  } else {
    ({ error } = await db().from('condominios').insert(payload));
  }
  if (error) { toast('❌ Erro: ' + error.message); return; }
  toast(editCondId ? '✅ Condomínio atualizado' : '✅ Condomínio criado');
  const fichaIdParaReabrir = condFichaId && editCondId === condFichaId ? condFichaId : null;
  closeCondModal();
  await carregarCondominios();
  renderCondominios();
  if (fichaIdParaReabrir) openCondFicha(fichaIdParaReabrir);
}

async function excluirCond() {
  if (!editCondId || !confirm('Excluir este condomínio?')) return;
  const { error } = await db().from('condominios').delete().eq('id', editCondId);
  if (error) { toast('❌ Erro: ' + error.message); return; }
  toast('🗑️ Condomínio excluído');
  closeCondModal();
  closeCondFicha();
  await carregarCondominios();
  renderCondominios();
}

// ── Ficha Condomínio ──────────────────────────────────────────────────────────
function openCondFicha(id) {
  condFichaId = id;
  const c = condominios.find(x => x.id === id);
  if (!c) return;
  condFichaSim = Array.isArray(c.similares) ? JSON.parse(JSON.stringify(c.similares)) : [];
  document.getElementById('condFichaTitulo').textContent = c.nome || '—';
  renderCondFichaBody(c);
  condCarregarGarimpoResumo(c.id);
  document.getElementById('condFichaOverlay').classList.add('open');
  condFichaAjustarSimList(); // com a ficha já visível, mede a galeria e limita a lista de similares
  // Auto-busca ITBI com rua+num do condomínio
  if (c.rua) {
    const ruaEl = document.getElementById('condITBIRua');
    const numEl = document.getElementById('condITBINum');
    if (ruaEl) ruaEl.value = c.rua || '';
    if (numEl) numEl.value = c.num || '';
    doCondITBISearch();
  }
}

function closeCondFicha() {
  document.getElementById('condFichaOverlay').classList.remove('open');
  condFichaId = null;
}

function editarCondDaFicha() {
  if (condFichaId) openCondModal(condFichaId);
}

// ── Galeria da ficha (10.6, Etapa 1) — estado da galeria em tela cheia ──
let condGalFotos = [];
let condGalIdx = 0;
const COND_GAL_THUMB_N = 8; // quantas miniaturas cabem na tira (a última vira "+N" se houver mais)

function renderCondFichaBody(c) {
  const body = document.getElementById('condFichaBody');
  condGalFotos = condFotosDe(c);
  condGalIdx = 0;

  const dados = [
    c.bairro         ? { l:'Bairro',      v: c.bairro } : null,
    (c.rua||c.num)   ? { l:'Rua',         v: [c.rua, c.num].filter(Boolean).join(', ') } : null,
    c.tipo           ? { l:'Tipo',         v: c.tipo } : null,
    c.ano_construcao ? { l:'Ano',          v: c.ano_construcao } : null,
    c.construtora    ? { l:'Construtora',  v: c.construtora } : null,
    c.proximo_metro  ? { l:'Metrô',        v: c.proximo_metro } : null,
  ].filter(Boolean);
  const urls = [
    c.url_quinto     ? '<a href="' + c.url_quinto     + '" target="_blank" class="btn btn-primary btn-sm">QuintoAndar ↗</a>' : '',
    c.url_imovel_web ? '<a href="' + c.url_imovel_web + '" target="_blank" class="btn btn-primary btn-sm">ImóvelWeb ↗</a>' : '',
    c.url_loft       ? '<a href="' + c.url_loft       + '" target="_blank" class="btn btn-primary btn-sm">Loft ↗</a>' : '',
  ].filter(Boolean).join('');

  // ── Bloco 1: Galeria (foto principal 3:2 + tira de miniaturas + ações) ──
  const galIcoImg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
  const galBlock =
    '<div class="cv-block">' +
    (condGalFotos.length
      ? '<div class="cond-gal-main" id="condGalMain">' +
          '<img class="cond-gal-img" id="condGalMainImg" onerror="this.style.visibility=\'hidden\'">' +
          (condGalFotos.length > 1
            ? '<button class="cond-gal-nav l" onclick="condGalStep(-1)"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>' +
              '<button class="cond-gal-nav r" onclick="condGalStep(1)"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>'
            : '') +
          '<div class="cond-gal-count" id="condGalCount"></div>' +
        '</div>' +
        '<div class="cond-gal-thumbs" id="condGalThumbs"></div>'
      : '<div class="cond-gal-empty">' + galIcoImg + '</div>') +
    '<div class="cond-gal-actions">' +
      '<button class="btn btn-primary btn-sm" onclick="openCondModal(condFichaId)">' + galIcoImg + 'Gerenciar fotos</button>' +
      (condGalFotos.length > COND_GAL_THUMB_N ? '<button class="btn btn-ghost btn-sm" onclick="condOpenGalGrid()">Ver todas (' + condGalFotos.length + ')</button>' : '') +
    '</div>' +
    '</div>';

  // ── Bloco 2: Dados do edifício ──
  const dadosBlock =
    '<div class="cv-block">' +
    '<div class="cond-section-title"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Dados do edifício</div>' +
    (dados.length ? '<div class="cond-dados-grid">' + dados.map(d =>
      '<div><div class="cond-dado-label">' + d.l + '</div><div class="cond-dado-val">' + d.v + '</div></div>'
    ).join('') + '</div>' : '<div class="cond-empty">Sem dados cadastrados.</div>') +
    (urls ? '<div class="cond-ficha-urls">' + urls + '</div>' : '') +
    (c.obs ? '<div class="cond-ficha-obs">' + c.obs + '</div>' : '') +
    '</div>';

  // ── Bloco 3: Condomínios Similares ──
  const simBlock =
    '<div class="cv-block cond-sim-block">' +
    '<div class="cond-section-hdr">' +
    '<div class="cond-section-title"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="1"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="15" y2="15"/></svg>Condomínios Similares <span id="condSimCount" class="cond-sim-count">(' + condSimAtivos().length + ')</span></div>' +
    '<button class="btn btn-primary btn-sm" onclick="toggleCondAddForm()">+ Adicionar similar</button>' +
    '</div>' +
    '<div class="cond-sim-list" id="condSimList">' + renderCondSimItems() + '</div>' +
    '<div class="cond-add-form" id="condAddForm" style="display:none">' +
    '<div class="cond-search-label">Buscar na base</div>' +
    '<input type="text" id="condSimSearch" placeholder="Buscar por nome ou bairro..." oninput="filtrarCondSimSearch()" style="width:100%">' +
    '<div class="cond-add-results" id="condSimResults"></div>' +
    '<div class="cond-divider-label">Ou adicionar manualmente</div>' +
    '<div class="cond-manual-grid">' +
    '<div class="cond-grid-full"><input type="text" id="csNome" placeholder="Nome do edifício *" style="width:100%"></div>' +
    '<input type="text" id="csRua" placeholder="Rua">' +
    '<input type="text" id="csNum" placeholder="Nº">' +
    '<input type="text" id="csBairro" placeholder="Bairro" class="cond-grid-full">' +
    '</div>' +
    '<div class="cond-form-actions">' +
    '<button class="btn btn-ghost btn-sm" onclick="toggleCondAddForm()">Cancelar</button>' +
    '<button class="btn btn-primary btn-sm" onclick="adicionarSimilarManual()">+ Adicionar</button>' +
    '</div>' +
    '</div>' +
    '</div>';

  // ── Bloco largura cheia: Vendidos ITBI (render pela doCondITBISearch, padrão do sistema) ──
  const itbiBlock =
    '<div class="cv-block">' +
    '<div class="cond-section-title"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Vendidos — ITBI</div>' +
    '<div class="cond-itbi-hint">Banco ITBI SP · carrega ~47MB na primeira busca da sessão. Já busca sozinho com a rua/número salvos — corrija aqui se estiver errado.</div>' +
    '<div class="cond-itbi-row">' +
    '<input type="text" id="condITBIRua" placeholder="Nome da rua" style="flex:1;min-width:160px">' +
    '<input type="text" id="condITBINum" placeholder="Nº" style="flex:0 0 80px">' +
    '<button class="btn btn-primary btn-sm" onclick="doCondITBISearch()">Buscar</button>' +
    '</div>' +
    '<div id="condITBIResults"></div>' +
    '<div id="condITBISimilares"></div>' +
    '</div>';

  body.innerHTML =
    '<div class="cond-ficha-topgrid">' + galBlock + dadosBlock + simBlock + '</div>' +
    '<div id="condGarimpoResumo"></div>' +
    itbiBlock;

  if (condGalFotos.length) condGalSet(0);
  renderCondITBISimilares();
  if (!window.__condSimResizeBound) {
    window.__condSimResizeBound = true;
    window.addEventListener('resize', () => {
      if (document.getElementById('condFichaOverlay')?.classList.contains('open')) condFichaAjustarSimList();
    });
  }
}

// Similares ativos (não descartados no ACM Builder).
function condSimAtivos() { return condFichaSim.filter(s => !s.descartado); }

// Limita a lista de Similares à altura natural da galeria, pra os 3 blocos do topo
// terminarem alinhados sem deixar vão quando há muitos similares (item 10.6, 23/07).
function condFichaAjustarSimList() {
  const list = document.getElementById('condSimList');
  if (!list) return;
  const h = el => el ? el.getBoundingClientRect().height : 0;
  const imgArea = document.querySelector('#condFichaBody .cond-gal-main, #condFichaBody .cond-gal-empty');
  const thumbs = document.getElementById('condGalThumbs');
  const actions = document.querySelector('#condFichaBody .cond-gal-actions');
  const hdr = document.querySelector('.cond-sim-block .cond-section-hdr');
  const galNatural = h(imgArea) + h(thumbs) + h(actions) + (thumbs ? 8 : 0) + 12 + 32; // gaps + padding do bloco
  const cap = Math.max(220, Math.round(galNatural - h(hdr) - 32));
  list.style.maxHeight = cap + 'px';
  list.style.overflowY = 'auto';
  list.style.paddingRight = '4px';
}

// ── Galeria em tela cheia — navegação, miniaturas e grade "ver todas" ──
function condGalSet(i) {
  if (!condGalFotos.length) return;
  condGalIdx = (i + condGalFotos.length) % condGalFotos.length;
  const img = document.getElementById('condGalMainImg');
  if (img) { img.style.visibility = 'visible'; img.src = condGalFotos[condGalIdx]; }
  const cnt = document.getElementById('condGalCount');
  if (cnt) cnt.textContent = (condGalIdx + 1) + ' / ' + condGalFotos.length;
  condGalRenderThumbs();
}

function condGalStep(d) { condGalSet(condGalIdx + d); }

function condGalRenderThumbs() {
  const wrap = document.getElementById('condGalThumbs');
  if (!wrap) return;
  const n = condGalFotos.length;
  const visible = Math.min(COND_GAL_THUMB_N, n);
  let html = '';
  for (let i = 0; i < visible; i++) {
    const isLast = (i === COND_GAL_THUMB_N - 1) && (n > COND_GAL_THUMB_N);
    if (isLast) {
      const restante = n - (COND_GAL_THUMB_N - 1);
      html += '<div class="t more" data-more="+' + restante + '" onclick="condOpenGalGrid()"><img onerror="this.style.visibility=\'hidden\'" src="' + condGalFotos[i] + '"></div>';
    } else {
      html += '<div class="t' + (i === condGalIdx ? ' on' : '') + '" onclick="condGalSet(' + i + ')"><img onerror="this.style.visibility=\'hidden\'" src="' + condGalFotos[i] + '"></div>';
    }
  }
  wrap.innerHTML = html;
}

function condOpenGalGrid() {
  const grid = document.getElementById('condGalGrid');
  if (!grid || !condGalFotos.length) return;
  const c = condominios.find(x => x.id === condFichaId);
  const titEl = document.getElementById('condGalGridTitle');
  if (titEl) titEl.textContent = (c?.nome || 'Fotos') + ' · ' + condGalFotos.length + ' fotos';
  grid.innerHTML = condGalFotos.map((u, i) =>
    '<div class="g" onclick="condGalSet(' + i + ');condCloseGalGrid()"><img onerror="this.style.visibility=\'hidden\'" src="' + u + '"></div>'
  ).join('');
  document.getElementById('condGalGridOverlay').classList.add('open');
}

function condCloseGalGrid() {
  const o = document.getElementById('condGalGridOverlay');
  if (o) o.classList.remove('open');
}

function renderCondSimItems() {
  // Descartados (marcados dentro do ACM Builder) ficam fora daqui — a gestão deles é lá.
  const ativos = condFichaSim.map((s, i) => ({ s, i })).filter(o => !o.s.descartado);
  if (!ativos.length) return '<div class="cond-empty">Nenhum similar cadastrado.</div>';
  return ativos.map(({ s, i }) =>
    '<div class="cond-sim-item">' +
    '<div class="cond-sim-info">' +
    '<div class="cond-sim-nome">' + (s.nome || '—') + '</div>' +
    '<div class="cond-sim-sub">' + [s.bairro, [s.rua, s.num].filter(Boolean).join(', ')].filter(Boolean).join(' · ') + '</div>' +
    '</div>' +
    '<button class="btn btn-danger btn-sm" onclick="removerSimilarCond(' + i + ')">✕</button>' +
    '</div>'
  ).join('');
}

function toggleCondAddForm() {
  const f = document.getElementById('condAddForm'); if (!f) return;
  const open = f.style.display !== 'none';
  f.style.display = open ? 'none' : 'block';
  if (!open) setTimeout(() => setupRuaNumACById('csRua','csNum'), 30);
  if (!open) {
    ['condSimSearch','csNome','csRua','csNum','csBairro'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
    const r = document.getElementById('condSimResults'); if(r) r.innerHTML='';
  }
}

function filtrarCondSimSearch() {
  const q = (document.getElementById('condSimSearch')?.value || '').toLowerCase().trim();
  const el = document.getElementById('condSimResults');
  if (!q || q.length < 2) { el.innerHTML = ''; return; }
  const excIds = new Set([condFichaId, ...condFichaSim.filter(s => s.id).map(s => s.id)]);
  const matches = condominios.filter(c => !excIds.has(c.id) &&
    ((c.nome||'').toLowerCase().includes(q) || (c.bairro||'').toLowerCase().includes(q))
  ).slice(0, 8);
  if (!matches.length) { el.innerHTML = '<div class="cond-empty">Nenhum resultado na base.</div>'; return; }
  el.innerHTML = matches.map(c =>
    '<div class="cond-add-result-item" onclick="adicionarSimilarDaBase(\'' + c.id + '\')">' +
    '<strong>' + (c.nome||'—') + '</strong> ' +
    '<span class="cond-result-meta">' + [c.bairro, c.rua].filter(Boolean).join(' · ') + '</span>' +
    '</div>'
  ).join('');
}

async function adicionarSimilarDaBase(id) {
  const c = condominios.find(x => x.id === id); if (!c) return;
  if (condFichaSim.find(s => s.id === id)) { toast('⚠️ Já adicionado'); return; }
  condFichaSim.push({ id: c.id, nome: c.nome, rua: c.rua||'', num: c.num||'', bairro: c.bairro||'' });
  await salvarSimilaresCond();
  atualizarCondSimList();
  toggleCondAddForm();
}

async function adicionarSimilarManual() {
  const nome = (document.getElementById('csNome')?.value||'').trim();
  if (!nome) { toast('⚠️ Nome obrigatório'); return; }
  condFichaSim.push({
    nome,
    rua:    (document.getElementById('csRua')?.value||'').trim(),
    num:    (document.getElementById('csNum')?.value||'').trim(),
    bairro: (document.getElementById('csBairro')?.value||'').trim(),
  });
  await salvarSimilaresCond();
  atualizarCondSimList();
  toggleCondAddForm();
}

async function removerSimilarCond(idx) {
  condFichaSim.splice(idx, 1);
  await salvarSimilaresCond();
  atualizarCondSimList();
}

function atualizarCondSimList() {
  const el = document.getElementById('condSimList');
  if (el) el.innerHTML = renderCondSimItems();
  const cnt = document.getElementById('condSimCount');
  if (cnt) cnt.textContent = '(' + condSimAtivos().length + ')';
  const c = condominios.find(x => x.id === condFichaId);
  if (c) c.similares = condFichaSim;
  condFichaAjustarSimList();   // recalcula a altura da lista (scroll)
  renderCondITBISimilares();   // atualiza os painéis de Vendidos dos similares
}

async function salvarSimilaresCond() {
  if (!condFichaId) return;
  const { error } = await db().from('condominios').update({ similares: condFichaSim, updated_at: new Date().toISOString() }).eq('id', condFichaId);
  if (error) { toast('❌ Erro ao salvar: ' + error.message); return; }
  toast('✅ Similares salvos');
}

async function sugerirBairroCond() {
  const rua = (document.getElementById('cRua')?.value||'').trim();
  if (!rua) { toast('⚠️ Preencha a rua primeiro'); return; }
  const btn = document.querySelector('[onclick="sugerirBairroCond()"]');
  if (btn) { btn.textContent = 'Buscando...'; btn.disabled = true; }
  try {
    const database = await loadITBIdb();
    let sql = 'SELECT bairro, COUNT(*) as cnt FROM vendas WHERE logradouro_norm LIKE ?';
    const params = ['%' + removeAccentsUpper(rua) + '%'];
    const num = (document.getElementById('cNum')?.value||'').trim();
    if (num) { sql += ' AND numero LIKE ?'; params.push('%' + num + '%'); }
    sql += ' AND ' + ITBI_SQL_ANO + ' GROUP BY bairro ORDER BY cnt DESC LIMIT 1';
    const stmt = database.prepare(sql); stmt.bind(params);
    let bairro = '';
    if (stmt.step()) bairro = stmt.getAsObject().bairro || '';
    stmt.free();
    if (bairro) {
      document.getElementById('cBairro').value = titleRua(bairro);
      toast('✅ Bairro sugerido: ' + titleRua(bairro));
    } else {
      toast('⚠️ Nenhum resultado no ITBI para essa rua');
    }
  } catch(e) { toast('❌ ' + e.message); }
  finally { if (btn) { btn.textContent = 'Sugerir'; btn.disabled = false; } }
}

// Consulta o banco ITBI por rua (+ número opcional). Retorna as linhas já filtradas (sem vagas).
async function condITBIQuery(ruaNorm, num) {
  const database = await loadITBIdb();
  const conds = [], params = [];
  if (num) { conds.push('(logradouro_norm LIKE ? AND numero LIKE ?)'); params.push('%'+ruaNorm+'%', '%'+num+'%'); }
  else { conds.push('logradouro_norm LIKE ?'); params.push('%'+ruaNorm+'%'); }
  const sql = 'SELECT data_transacao,logradouro,logradouro_fmt,numero,complemento,bairro,referencia,area_construida_m2,valor_transacao,valor_m2 FROM vendas WHERE (' + conds.join(' OR ') + ') AND ' + ITBI_SQL_ANO + ' ORDER BY data_transacao DESC LIMIT 200';
  const stmt = database.prepare(sql); stmt.bind(params);
  const rows = [];
  while(stmt.step()){ const r=stmt.getAsObject(); const comp=(r.complemento||'').toUpperCase(); if(comp.startsWith('VAGA')||comp.startsWith('VG')||comp.startsWith('GARAGEM')||comp.startsWith('BOX'))continue; rows.push(r); }
  stmt.free();
  return rows;
}

function condITBIMedM2(rows) {
  const v = rows.filter(r => parseFloat(r.valor_m2) > 0);
  return v.reduce((s,r) => s + parseFloat(r.valor_m2), 0) / (v.length || 1);
}

// Monta o resumo + tabela de resultados ITBI (padrão único do sistema, usado no prédio e nos similares).
function condITBITableHtml(rows) {
  const df = s => { const m=s?.match(/^(\d{4})-(\d{2})-(\d{2})/); return m?m[3]+'/'+m[2]+'/'+m[1]:s||'—'; };
  return '<div class="cond-itbi-summary">' + rows.length + ' transações · Média R$/m²: <strong class="ds-accent">' + fmtMoneyInt(condITBIMedM2(rows)) + '</strong></div>' +
    '<div class="cond-itbi-table-wrap">' +
    '<table class="cond-itbi-table">' +
    '<thead><tr><th>Data</th><th>Rua</th><th>Nº</th><th>Compl.</th><th>Edifício</th><th style="text-align:center">A.C.</th><th style="text-align:right">Valor</th><th style="text-align:right">R$/m²</th></tr></thead>' +
    '<tbody>' + rows.map(r =>
      '<tr>' +
      '<td class="cond-itbi-td-nowrap">' + df(r.data_transacao) + '</td>' +
      '<td>' + (ruaExib(r)||'—') + '</td>' +
      '<td>' + (r.numero||'—') + '</td>' +
      '<td>' + (titleRua(r.complemento)||'—') + '</td>' +
      '<td>' + (titleRua(r.referencia)||'—') + '</td>' +
      '<td class="cond-itbi-td-center">' + (r.area_construida_m2||'—') + '</td>' +
      '<td class="cond-itbi-td-success">' + (parseFloat(r.valor_transacao)>0?fmtMoeda(parseFloat(r.valor_transacao)):'—') + '</td>' +
      '<td class="cond-itbi-td-accent">'  + (parseFloat(r.valor_m2)>0?fmtMoneyInt(parseFloat(r.valor_m2)):'—') + '</td>' +
      '</tr>'
    ).join('') + '</tbody></table></div>';
}

const CI_ITBI_SPINNER = '<div class="cond-itbi-msg" style="display:flex;align-items:center;gap:6px"><div class="spinner" style="width:12px;height:12px;border-width:2px"></div>Buscando...</div>';
const CI_ITBI_ERR = e => '<div class="cond-itbi-error"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Erro: ' + e + '</div>';

async function doCondITBISearch() {
  const rua = removeAccentsUpper(document.getElementById('condITBIRua')?.value || '');
  const num = (document.getElementById('condITBINum')?.value || '').trim();
  if (!rua) { toast('⚠️ Preencha a rua'); return; }
  const resultsEl = document.getElementById('condITBIResults');
  resultsEl.innerHTML = CI_ITBI_SPINNER;
  try {
    const rows = await condITBIQuery(rua, num);
    resultsEl.innerHTML = rows.length ? condITBITableHtml(rows) : '<div class="cond-itbi-msg">Nenhum resultado.</div>';
  } catch(e) { resultsEl.innerHTML = CI_ITBI_ERR(e.message); }
}

// ── Vendidos dos Similares — painéis expansíveis dentro do bloco ITBI (item 10.6, 23/07) ──
function renderCondITBISimilares() {
  const wrap = document.getElementById('condITBISimilares');
  if (!wrap) return;
  const sims = condSimAtivos().filter(s => (s.rua || '').trim());
  if (!sims.length) { wrap.innerHTML = ''; return; }
  const chev = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
  wrap.innerHTML =
    '<div class="cond-itbi-sim-hdr">Vendidos nos similares</div>' +
    sims.map((s, i) =>
      '<div class="cond-itbi-sim" id="condITBISim-' + i + '">' +
      '<button class="cond-itbi-sim-toggle" onclick="condToggleSimITBI(' + i + ')">' +
      chev +
      '<span class="nm">' + (s.nome || '—') + '</span>' +
      '<span class="ad">' + [s.rua, s.num].filter(Boolean).join(', ') + '</span>' +
      '<span class="cnt" id="condITBISimCnt-' + i + '"></span>' +
      '</button>' +
      '<div class="cond-itbi-sim-body" id="condITBISimBody-' + i + '" style="display:none"></div>' +
      '</div>'
    ).join('');
}

async function condToggleSimITBI(i) {
  const cont = document.getElementById('condITBISim-' + i);
  const body = document.getElementById('condITBISimBody-' + i);
  if (!cont || !body) return;
  const open = body.style.display !== 'none';
  if (open) { body.style.display = 'none'; cont.classList.remove('open'); return; }
  cont.classList.add('open'); body.style.display = 'block';
  if (body.dataset.loaded) return; // já buscou, só reabre
  const s = condSimAtivos().filter(x => (x.rua || '').trim())[i];
  if (!s) return;
  body.innerHTML = CI_ITBI_SPINNER;
  try {
    const rows = await condITBIQuery(removeAccentsUpper(s.rua), (s.num || '').trim());
    const cnt = document.getElementById('condITBISimCnt-' + i);
    if (!rows.length) { body.innerHTML = '<div class="cond-itbi-msg">Nenhum resultado.</div>'; if (cnt) cnt.textContent = '0'; }
    else { body.innerHTML = condITBITableHtml(rows); if (cnt) cnt.textContent = rows.length + ' · ' + fmtMoneyInt(condITBIMedM2(rows)) + '/m²'; }
    body.dataset.loaded = '1';
  } catch(e) { body.innerHTML = CI_ITBI_ERR(e.message); }
}

// ── Resumo do Garimpo (item 14.3, 13/07/2026) — unidades ativas deste prédio ──
async function condCarregarGarimpoResumo(condominioId) {
  const el = document.getElementById('condGarimpoResumo');
  if (!el) return;
  const { data, error } = await db().from('garimpo_achados')
    .select('id,tipo_imovel,endereco_numero,dormitorios,vagas,area,andar_min,andar_max,preco,coletado_em')
    .eq('condominio_id', condominioId)
    .in('status', ['novo', 'contatado'])
    .order('preco', { ascending: true });
  if (error || !data || !data.length) { el.innerHTML = ''; return; }
  const linhas = data.map(a => {
    const dd = a.dormitorios ? a.dormitorios + 'd' : null;
    const andarTxt = a.andar_min != null ? ((a.andar_max != null && a.andar_max !== a.andar_min) ? a.andar_min + 'º-' + a.andar_max + 'º andar' : a.andar_min + 'º andar') : null;
    const specs = [(a.tipo_imovel||'apartamento').replace(/^./,c=>c.toUpperCase()), dd, a.vagas ? a.vagas+'v' : null, a.area ? a.area+'m²' : null, andarTxt].filter(Boolean).join(' · ');
    const novo = daysAgo(a.coletado_em) <= 1 ? '<span class="gp-novo" style="margin-left:6px">NOVO</span>' : '';
    return '<div class="cond-gp-row"><div class="cond-gp-row-specs">' + specs + novo + '</div><div class="cond-gp-row-price">' + (a.preco ? fmtMoneyInt(a.preco) : '—') + '</div></div>';
  }).join('');
  el.innerHTML =
    '<div class="cv-block">' +
    '<div class="cond-section-hdr">' +
    '<div class="cond-section-title">' + GP_ICO.search + data.length + ' unidade' + (data.length > 1 ? 's' : '') + ' no Garimpo</div>' +
    '<a href="imoveis.html?tab=garimpo" class="cond-gp-link">Ver no Garimpo →</a>' +
    '</div>' +
    '<div class="cond-gp-list">' + linhas + '</div>' +
    '</div>';
}

