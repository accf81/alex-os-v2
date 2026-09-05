// carteira.js — aba Imóveis (Cadastros) do módulo Imóveis.
// Extraído de imoveis.html em 05/07/2026 (item 12.4, extração 3). NÃO usar type=module — funções globais (onclick).

// ── Imóveis Carteira ──────────────────────────────────────────────────────────
let editCarteiraId        = null;
let carteiraViewId        = null;
let carteiraPessoas       = [];
let carteiraAnunciosExtra = [];
let carteiraFotosEdit     = []; // galeria em edição na aba Fotos (array de URLs)
let fotosSortableInstance = null;

const DEFAULT_CARACT = ['Reformado','Para reforma','Contra piso','Portaria 24h','Portaria virtual','Gerador','Academia','Piscina','Salão de festas','Vaga demarcada'];
const PESSOA_TIPOS   = ['Proprietário','Cônjuge','Procurador','Inventariante','Sócio'];

function getCaractOpcoes() {
  try { return JSON.parse(localStorage.getItem('carteira_caract') || 'null') || [...DEFAULT_CARACT]; }
  catch { return [...DEFAULT_CARACT]; }
}
function saveCaractOpcoes(list) { localStorage.setItem('carteira_caract', JSON.stringify(list)); }

// ── Status do imóvel (Fatia 1 + status "Inativo" do redesign 10.4) ──────────
const STATUS_OPTS = [
  { v:'a_classificar', label:'A classificar', card:'st-ac', view:'cv-badge-warn' },
  { v:'exclusivo',     label:'Exclusivo',     card:'st-ex', view:'cv-badge-accent' },
  { v:'aberto',        label:'Aberto',        card:'st-ab', view:'cv-badge-info' },
  { v:'terceiros',     label:'Terceiros',     card:'st-te', view:'cv-badge-muted' },
  { v:'vendido',       label:'Vendido',       card:'st-vd', view:'cv-badge-success' },
  { v:'inativo',       label:'Inativo',       card:'st-in', view:'cv-badge-neutral' },
];
// Status escondidos da vitrine por padrão — só aparecem clicando no chip deles (06/07/2026, pedido do Alex)
const STATUS_ESCONDIDOS_NO_TODOS = ['vendido', 'inativo'];
let carteiraStatusFil = 'todos';
function statusMeta(s){ return STATUS_OPTS.find(o=>o.v===s) || STATUS_OPTS[0]; }
function statusBadgeCard(s){ const m=statusMeta(s); return '<span class="carteira-badge-status '+m.card+'">'+m.label.toUpperCase()+'</span>'; }
function setCfStatus(v){
  const h=document.getElementById('cfStatus'); if(h) h.value=v;
  document.querySelectorAll('#cfStatusSeg .status-opt').forEach(b=>b.classList.toggle('on', b.dataset.v===v));
  const m=document.getElementById('cfMotivoInativo'); if(m) m.value='';   // status normal escolhido → sai do Inativo, limpa motivo
  renderCfInativoBox();
}

// ── Status Inativo — separado do Vendido, motivo obrigatório (redesign 10.4) ──
function renderCfInativoBox() {
  const box = document.getElementById('cfInativoBox'); if (!box) return;
  const status = document.getElementById('cfStatus')?.value;
  if (status === 'inativo') {
    const motivo = document.getElementById('cfMotivoInativo')?.value || '';
    box.innerHTML = '<span class="cv-badge-neutral">INATIVO</span>' +
      (motivo ? '<div class="ds-meta" style="margin:6px 0 8px">Motivo: '+motivo+'</div>' : '<div style="margin-bottom:8px"></div>') +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="reativarImovel()">Reativar</button>';
  } else {
    box.innerHTML = '<button type="button" class="btn btn-ghost btn-sm" onclick="abrirInativarModal()">Inativar imóvel</button>';
  }
}
function abrirInativarModal() { document.getElementById('inativarOverlay').classList.add('open'); }
function closeInativarModal()  { document.getElementById('inativarOverlay').classList.remove('open'); }
function confirmarInativar() {
  const motivo = document.getElementById('fInativoMotivo').value;
  document.getElementById('cfStatus').value = 'inativo';
  document.getElementById('cfMotivoInativo').value = motivo;
  document.querySelectorAll('#cfStatusSeg .status-opt').forEach(b=>b.classList.remove('on'));
  closeInativarModal();
  renderCfInativoBox();
}
function reativarImovel() { setCfStatus('a_classificar'); }
function setCarteiraStatusFil(v){
  carteiraStatusFil = v;
  document.querySelectorAll('#carteiraStatusChips .status-chip').forEach(c=>c.classList.toggle('on', c.dataset.v===v));
  filtrarCarteira();
}

// ── Listagem — toolbar (busca + atalhos de filtro) + grade ──────────────────
function renderCarteira() {
  const el = document.getElementById('sv-carteira');
  if (!carteiraItems.length) {
    el.innerHTML = '<div class="empty-state"><div class="es-icon"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div><p class="empty-state-title">Nenhum imóvel cadastrado</p><p class="empty-state-hint">Clique em "+ Novo imóvel" para começar.</p></div>';
    return;
  }
  const chevron = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  const tipologiaChips = opcoesDe('tipologia').map(t=>'<span class="carteira-chip-opt" data-v="'+escOpc(t)+'" onclick="this.classList.toggle(\'on\')">'+t+'</span>').join('');
  const toolbar =
    '<div class="carteira-toolbar">' +
      '<input type="text" class="carteira-search" id="carteiraSearch" placeholder="Buscar por código, endereço ou bairro..." oninput="filtrarCarteira()">' +
      '<details class="carteira-filtro" id="cfilBairroWrap" ontoggle="if(this.open)fecharOutrosFiltros(this)">' +
        '<summary class="carteira-filtro-btn">Bairro '+chevron+'</summary>' +
        '<div class="card carteira-filtro-pop">' +
          '<div><span class="carteira-filtro-grp-lbl">Bairro</span><input type="text" id="cfilBairro" placeholder="Ex.: Jardim Paulista"></div>' +
          '<button class="btn btn-primary btn-sm" onclick="document.getElementById(\'cfilBairroWrap\').removeAttribute(\'open\');filtrarCarteira()">Aplicar</button>' +
        '</div>' +
      '</details>' +
      '<details class="carteira-filtro" id="cfilTipoOpWrap" ontoggle="if(this.open)fecharOutrosFiltros(this)">' +
        '<summary class="carteira-filtro-btn">Tipo de operação '+chevron+'</summary>' +
        '<div class="card carteira-filtro-pop">' +
          '<div class="carteira-filtro-toggle" id="cfilTipoOp">' +
            '<button type="button" onclick="toggleExclusivo(this,\'venda\')">Venda</button>' +
            '<button type="button" onclick="toggleExclusivo(this,\'aluguel\')">Aluguel</button>' +
          '</div>' +
          '<button class="btn btn-primary btn-sm" onclick="document.getElementById(\'cfilTipoOpWrap\').removeAttribute(\'open\');filtrarCarteira()">Aplicar</button>' +
        '</div>' +
      '</details>' +
      '<details class="carteira-filtro" id="cfilTiposWrap" ontoggle="if(this.open)fecharOutrosFiltros(this)">' +
        '<summary class="carteira-filtro-btn">Tipo de propriedade '+chevron+'</summary>' +
        '<div class="card carteira-filtro-pop">' +
          '<div class="carteira-chipwrap" id="cfilTipos">'+tipologiaChips+'</div>' +
          '<button class="btn btn-primary btn-sm" onclick="document.getElementById(\'cfilTiposWrap\').removeAttribute(\'open\');filtrarCarteira()">Aplicar</button>' +
        '</div>' +
      '</details>' +
      '<details class="carteira-filtro" id="cfilComodosWrap" ontoggle="if(this.open)fecharOutrosFiltros(this)">' +
        '<summary class="carteira-filtro-btn" id="cfilComodosBtn">Cômodos '+chevron+'</summary>' +
        '<div class="card carteira-filtro-pop wide">' +
          '<div class="carteira-comodos-grid" id="cfilComodos">' +
            ['Dormitórios|quartos','Suítes|suites','Banheiros|banheiros','Vagas|vagas'].map(par=>{
              const [lbl,campo]=par.split('|');
              return '<div><span class="carteira-comodos-lbl">'+lbl+'</span><div class="carteira-comodos-opts" data-campo="'+campo+'">' +
                [1,2,3,4,5,6].map(n=>'<div class="carteira-num-opt" data-n="'+n+'" onclick="toggleComodoBtn(this)">+'+n+'</div>').join('') +
              '</div></div>';
            }).join('') +
          '</div>' +
          '<button class="btn btn-primary btn-sm" onclick="document.getElementById(\'cfilComodosWrap\').removeAttribute(\'open\');filtrarCarteira()">Aplicar</button>' +
        '</div>' +
      '</details>' +
      '<details class="carteira-filtro" id="cfilAreaWrap" ontoggle="if(this.open)fecharOutrosFiltros(this)">' +
        '<summary class="carteira-filtro-btn">Área '+chevron+'</summary>' +
        '<div class="card carteira-filtro-pop">' +
          '<div class="carteira-range">' +
            '<div><label>Mínimo</label><input type="number" id="cfilAreaMin" placeholder="m²"></div>' +
            '<div><label>Máximo</label><input type="number" id="cfilAreaMax" placeholder="m²"></div>' +
          '</div>' +
          '<button class="btn btn-primary btn-sm" onclick="document.getElementById(\'cfilAreaWrap\').removeAttribute(\'open\');filtrarCarteira()">Aplicar</button>' +
        '</div>' +
      '</details>' +
      '<button class="btn btn-ghost btn-sm" onclick="limparFiltrosCarteira()">Limpar filtros</button>' +
      '<div class="carteira-toolbar-spacer"></div>' +
      '<button class="btn btn-ghost btn-sm" onclick="openCaractSettings()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Características</button>' +
    '</div>' +
    '<div class="carteira-toolbar-row2">' +
      '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">' +
        '<div class="carteira-count" id="carteiraCount"></div>' +
        '<div class="carteira-status-chips" id="carteiraStatusChips">' +
          '<span class="status-chip'+(carteiraStatusFil==='todos'?' on':'')+'" data-v="todos" onclick="setCarteiraStatusFil(\'todos\')">Todos</span>' +
          STATUS_OPTS.map(o=>'<span class="status-chip'+(carteiraStatusFil===o.v?' on':'')+'" data-v="'+o.v+'" onclick="setCarteiraStatusFil(\''+o.v+'\')">'+o.label+'</span>').join('') +
        '</div>' +
      '</div>' +
      '<div class="carteira-sort">Ordenar por <select class="carteira-select" id="carteiraOrdem" onchange="filtrarCarteira()">' +
        '<option value="recentes">Mais recentes</option>' +
        '<option value="menor_preco">Menor preço</option>' +
        '<option value="maior_preco">Maior preço</option>' +
        '<option value="maior_area">Maior área</option>' +
      '</select></div>' +
    '</div>' +
    '<div class="carteira-grid" id="carteiraGrid"></div>';
  el.innerHTML = toolbar;
  filtrarCarteira();
}

// Fecha os outros popovers de filtro quando um é aberto — evita ficar com vários abertos ao mesmo tempo.
function fecharOutrosFiltros(atual) {
  document.querySelectorAll('.carteira-filtro').forEach(d => { if (d !== atual) d.removeAttribute('open'); });
}
// Limpa todos os filtros da barra (busca, popovers e status) de uma vez.
function limparFiltrosCarteira() {
  const s = document.getElementById('carteiraSearch'); if (s) s.value = '';
  const b = document.getElementById('cfilBairro'); if (b) b.value = '';
  const tipoOpWrap = document.getElementById('cfilTipoOp'); if (tipoOpWrap) { tipoOpWrap.dataset.picked=''; tipoOpWrap.querySelectorAll('button').forEach(x=>x.classList.remove('on')); }
  document.querySelectorAll('#cfilTipos .carteira-chip-opt.on').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.carteira-comodos-opts .carteira-num-opt.on').forEach(x=>x.classList.remove('on'));
  const amin=document.getElementById('cfilAreaMin'); if (amin) amin.value='';
  const amax=document.getElementById('cfilAreaMax'); if (amax) amax.value='';
  carteiraStatusFil = 'todos';
  document.querySelectorAll('#carteiraStatusChips .status-chip').forEach(c=>c.classList.toggle('on', c.dataset.v==='todos'));
  document.querySelectorAll('.carteira-filtro[open]').forEach(d=>d.removeAttribute('open'));
  filtrarCarteira();
}
// Toggle exclusivo entre 2 botões de um popover (ex.: Venda/Aluguel) — clicar no já ativo desmarca.
function toggleExclusivo(el, v) {
  const wrap = el.parentElement;
  const already = wrap.dataset.picked === v;
  wrap.querySelectorAll('button').forEach(b=>b.classList.remove('on'));
  if (already) { wrap.dataset.picked=''; } else { wrap.dataset.picked=v; el.classList.add('on'); }
}
// Toggle exclusivo dentro de um grupo de Cômodos (ex.: Dormitórios +1..+6) — só 1 ativo por grupo.
function toggleComodoBtn(el) {
  const wasOn = el.classList.contains('on');
  el.parentElement.querySelectorAll('.carteira-num-opt').forEach(b=>b.classList.remove('on'));
  if (!wasOn) el.classList.add('on');
}

function carteiraCards(list) {
  if (!list.length) return '<div class="cond-empty">Nenhum resultado.</div>';
  return list.map(p => {
    const tipol = [p.quartos&&p.quartos+'q', p.suites&&p.suites+'s', p.vagas&&p.vagas+'v'].filter(Boolean).join(' · ');
    const preco = p.valor_venda ? fmtMoeda(p.valor_venda) : (p.valor_aluguel ? fmtMoeda(p.valor_aluguel)+'/mês' : '');
    const ownerEntry = (p.pessoas||[]).find(x=>x.tipo==='Proprietário');
    const ownerNome  = ownerEntry ? (pessoasAll.find(ps=>ps.id===ownerEntry.id)?.nome || ownerEntry.nome || '') : '';
    const condNome   = p.condominio_id ? (condominios.find(c=>c.id===p.condominio_id)?.nome || '') : '';
    const nInteressados = leadsDoImovel(p.id).length;
    const nVisitas      = (visitasItems||[]).filter(v=>v.carteira_id===p.id).length;
    const nNegociacoes   = (fechamentos||[]).filter(f=>f.imovel_id===p.id).length;
    return '<div class="card carteira-card" onclick="openCarteiraView(\''+p.id+'\')">'+
      carteiraCardFotoHtml(p) +
      '<div class="carteira-card-body">'+
        '<div class="carteira-card-addr">'+(p.rua?(p.rua+(p.numero?', '+p.numero:'')):'—')+'</div>'+
        '<div class="carteira-card-sub">'+[p.complemento,condNome,p.bairro,ownerNome].filter(Boolean).join(' · ')+'</div>'+
        '<div class="carteira-card-meta">'+
          (p.area_util?'<span title="Área útil"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>'+p.area_util+' m²</span>':'')+
          (p.area_total?'<span title="Área total"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 6H8a2 2 0 0 0-2 2v10M3 6v4M7 6v3M11 6v3M15 6v3M19 6v3"/></svg>'+p.area_total+' m²</span>':'')+
          (p.quartos?'<span title="Dormitórios"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'+p.quartos+'</span>':'')+
          (p.suites?'<span title="Suítes"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'+p.suites+' suíte'+(p.suites!==1?'s':'')+'</span>':'')+
          (p.vagas?'<span title="Vagas"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>'+p.vagas+'</span>':'')+
        '</div>'+
        (p.tipo?'<div class="carteira-card-chips"><span class="carteira-chip">'+p.tipo+'</span></div>':'')+
        '<div class="carteira-card-footer">'+
          '<div class="carteira-card-crm">'+
            '<span title="Interessados"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>'+nInteressados+'</span>'+
            '<span title="Visitas"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'+nVisitas+'</span>'+
            '<span title="Negociações"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>'+nNegociacoes+'</span>'+
          '</div>'+
          (preco?'<div class="carteira-card-preco">'+preco+'</div>':'<div></div>')+
        '</div>'+
      '</div></div>';
  }).join('');
}

// ── Fotos do card/ficha — galeria (fotos jsonb, cai pra foto_capa se vazia) ──
function carteiraFotosDe(p) {
  if (Array.isArray(p.fotos) && p.fotos.length) return p.fotos;
  return p.foto_capa ? [p.foto_capa] : [];
}
// Ficha (leitura): sempre os 3 blocos do mosaico, mesmo com só 1-2 fotos reais — os slots que faltam
// mostram um placeholder (em vez de colapsar pra "1 foto = full width", que ficava inconsistente entre imóveis).
function carteiraFichaFotosHtml(fotos) {
  const onerr = ' onerror="this.style.display=\'none\'"';
  const vazio = '<div class="carteira-ficha-foto-vazia"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>';
  const slot = i => fotos[i] ? '<img src="'+fotos[i]+'"'+onerr+'>' : vazio;
  return '<div class="cond-ficha-fotos tres">' + slot(0) + slot(1) + slot(2) + '</div>';
}
const carteiraCardIdx = {};
function carteiraCardFotoHtml(p) {
  const fotos = carteiraFotosDe(p);
  const i = carteiraCardIdx[p.id] || 0;
  const badges = (p.codigo?'<span class="carteira-badge-codigo">'+p.codigo+'</span>':'') + statusBadgeCard(p.status);
  if (!fotos.length) {
    return '<div class="carteira-card-img-wrap"><div class="card-foto-placeholder"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>'+badges+'</div>';
  }
  const setas = fotos.length > 1
    ? '<button class="cond-carousel-arrow left" onclick="carteiraCardNav(\''+p.id+'\',-1,event)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<button class="cond-carousel-arrow right" onclick="carteiraCardNav(\''+p.id+'\',1,event)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>' +
      '<div class="cond-carousel-dots">' + fotos.map((_,idx)=>'<i class="'+(idx===i?'on':'')+'"></i>').join('') + '</div>'
    : '';
  return '<div class="carteira-card-img-wrap" id="carteiraCardFoto-'+p.id+'">' +
    '<img src="'+fotos[i]+'" class="carteira-card-foto" onerror="this.style.display=\'none\'">' +
    setas + badges +
  '</div>';
}
function carteiraCardNav(id, dir, ev) {
  ev.stopPropagation();
  const p = carteiraItems.find(x=>x.id===id); if (!p) return;
  const fotos = carteiraFotosDe(p); if (!fotos.length) return;
  const atual = carteiraCardIdx[id] || 0;
  carteiraCardIdx[id] = (atual + dir + fotos.length) % fotos.length;
  const wrap = document.getElementById('carteiraCardFoto-'+id);
  if (wrap) wrap.outerHTML = carteiraCardFotoHtml(p);
}

function carteiraFiltrados() {
  let fil = carteiraItems.filter(p => p.publicavel !== false);   // vitrine: esconde imóveis "em captação"
  if (carteiraStatusFil !== 'todos') fil = fil.filter(p => (p.status||'a_classificar') === carteiraStatusFil);
  else fil = fil.filter(p => !STATUS_ESCONDIDOS_NO_TODOS.includes(p.status));   // "Todos" esconde Vendido/Inativo por padrão (06/07/2026)

  const q = (document.getElementById('carteiraSearch')?.value||'').toLowerCase();
  if (q) fil = fil.filter(p => (p.codigo||'').toLowerCase().includes(q) || (p.rua||'').toLowerCase().includes(q) || (p.bairro||'').toLowerCase().includes(q));

  const bairro = (document.getElementById('cfilBairro')?.value||'').trim().toLowerCase();
  if (bairro) fil = fil.filter(p => (p.bairro||'').toLowerCase().includes(bairro));

  const tipoOp = document.getElementById('cfilTipoOp')?.dataset.picked;
  if (tipoOp === 'venda')   fil = fil.filter(p => p.valor_venda);
  if (tipoOp === 'aluguel') fil = fil.filter(p => p.valor_aluguel);

  const tipos = [...document.querySelectorAll('#cfilTipos .carteira-chip-opt.on')].map(e=>e.dataset.v);
  if (tipos.length) fil = fil.filter(p => tipos.includes(p.tipo));

  ['quartos','suites','banheiros','vagas'].forEach(campo => {
    const btn = document.querySelector('.carteira-comodos-opts[data-campo="'+campo+'"] .carteira-num-opt.on');
    if (btn) { const min = parseInt(btn.dataset.n); fil = fil.filter(p => (p[campo]||0) >= min); }
  });

  const areaMin = parseFloat(document.getElementById('cfilAreaMin')?.value);
  const areaMax = parseFloat(document.getElementById('cfilAreaMax')?.value);
  if (!isNaN(areaMin)) fil = fil.filter(p => (p.area_util||0) >= areaMin);
  if (!isNaN(areaMax)) fil = fil.filter(p => (p.area_util||0) <= areaMax);

  const ordem = document.getElementById('carteiraOrdem')?.value || 'recentes';
  if (ordem === 'menor_preco') fil = fil.slice().sort((a,b) => (a.valor_venda||a.valor_aluguel||0) - (b.valor_venda||b.valor_aluguel||0));
  else if (ordem === 'maior_preco') fil = fil.slice().sort((a,b) => (b.valor_venda||b.valor_aluguel||0) - (a.valor_venda||a.valor_aluguel||0));
  else if (ordem === 'maior_area') fil = fil.slice().sort((a,b) => (b.area_util||0) - (a.area_util||0));
  else fil = fil.slice().sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));

  return fil;
}

function filtrarCarteira() {
  const fil = carteiraFiltrados();
  const countEl = document.getElementById('carteiraCount');
  if (countEl) countEl.innerHTML = '<b>'+fil.length+'</b> imóve'+(fil.length===1?'l':'is')+' encontrado'+(fil.length===1?'':'s');
  // Badge de contagem no atalho "Cômodos" (quantos dos 4 campos têm filtro ativo)
  const nComodos = document.querySelectorAll('.carteira-comodos-opts .carteira-num-opt.on').length;
  const btnComodos = document.getElementById('cfilComodosBtn');
  if (btnComodos) btnComodos.innerHTML = 'Cômodos ' + (nComodos ? '<span class="cnt">'+nComodos+'</span> ' : '') + '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  const el=document.getElementById('carteiraGrid'); if(el) el.innerHTML=carteiraCards(fil);
}

// ── View (ficha read-only) ────────────────────────────────────────────────────
async function openCarteiraView(id) {
  carteiraViewId = id;
  await carregarPessoas();
  const p = carteiraItems.find(x => x.id === id);
  if (!p) return;
  document.getElementById('carteiraViewTitulo').textContent =
    p.rua ? (p.rua + (p.numero ? ', ' + p.numero : '')) : (p.codigo || 'Imóvel');
  renderCarteiraViewBody(p);
  document.getElementById('carteiraViewOverlay').classList.add('open');
}

function closeCarteiraView() {
  document.getElementById('carteiraViewOverlay').classList.remove('open');
  carteiraViewId = null;
  // se esta ficha foi aberta pelo "Abrir o que já existe", a janela de onde ele
  // veio (captação / cadastro) volta como estava
  if (typeof dupVoltarJanelaOrigem === 'function') dupVoltarJanelaOrigem();
}

function editarCarteiraView() {
  // Editar reaproveita a MESMA janela do cadastro. Se ele veio de um cadastro em
  // andamento ("Abrir o que já existe"), editar por cima jogaria fora o que ele
  // tinha digitado — então pergunta antes, em vez de descartar em silêncio.
  const pendente = (typeof dupJanelaOrigemPendente === 'function') ? dupJanelaOrigemPendente() : null;
  if (pendente === 'carteiraOverlay' &&
      !confirm('Você estava cadastrando um imóvel.\n\nAbrir este para editar descarta o que você tinha preenchido lá. Quer continuar?')) return;
  // ele escolheu editar ESTE imóvel: a janela recolhida não volta mais
  if (typeof dupEsquecerJanelaOrigem === 'function') dupEsquecerJanelaOrigem();
  if (carteiraViewId) openCarteiraFicha(carteiraViewId);
}

const FECH_ETAPA = { proposta:'Proposta', aceite:'Aceite', contrato:'Contrato', assinatura:'Assinatura', escritura:'Escritura' };
let _negRetorno = null;   // lembra de onde a negociação foi aberta, pra voltar ao fechar
async function novaNegociacaoImovel(imovelId) {
  _negRetorno = carteiraViewId ? { tipo: 'carteira', id: carteiraViewId }
              : (gestaoDetalhId ? { tipo: 'gestao', id: gestaoDetalhId } : null);
  if (typeof dupEsquecerJanelaOrigem === 'function') dupEsquecerJanelaOrigem();
  closeCarteiraView();
  showTab('vendas');
  if (typeof openVendasFicha === 'function') await openVendasFicha();
  const c = (carteiraItems || []).find(x => x.id === imovelId);
  if (c && typeof vfSelecionarImovel === 'function') vfSelecionarImovel(imovelId, visImovelLabel(imovelId));
}

function renderCarteiraViewBody(p) {
  const body = document.getElementById('carteiraViewBody');
  const fmt  = v => v ? fmtMoeda(v) : '—';
  const condObj  = p.condominio_id ? condominios.find(c => c.id === p.condominio_id) : null;
  const condNome = condObj?.nome || '';

  // Dados principais
  const dados = [
    (p.rua||p.numero)     ? { l:'Endereço',    v: [p.rua, p.numero].filter(Boolean).join(', ') + (p.complemento ? ' · ' + p.complemento : '') } : null,
    p.bairro              ? { l:'Bairro',       v: p.bairro } : null,
    condNome              ? { l:'Condomínio',   v: condNome } : null,
    p.tipo                ? { l:'Tipo',         v: p.tipo } : null,
    p.area_util           ? { l:'Área útil',    v: p.area_util + ' m²' } : null,
    p.area_total          ? { l:'Área total',   v: p.area_total + ' m²' } : null,
    (p.quartos||p.suites||p.banheiros||p.vagas) ? { l:'Tipologia', v: [p.quartos&&p.quartos+'D', p.suites&&p.suites+'S', p.banheiros&&p.banheiros+'B', p.vagas&&p.vagas+'V'].filter(Boolean).join(' · ') } : null,
    p.andar               ? { l:'Andar',        v: p.andar } : null,
    p.valor_venda         ? { l:'Valor venda',  v: fmt(p.valor_venda) } : null,
    p.valor_aluguel       ? { l:'Valor aluguel',v: fmt(p.valor_aluguel) + '/mês' } : null,
    p.cond_mensal         ? { l:'Condomínio',   v: fmt(p.cond_mensal) + '/mês' } : null,
    p.iptu_mensal         ? { l:'IPTU mensal',  v: fmt(p.iptu_mensal) } : null,
    p.comissao            ? { l:'Comissão',     v: p.comissao + '%' } : null,
    condObj?.ano_construcao ? { l:'Construção', v: condObj.ano_construcao } : null,
  ].filter(Boolean);

  // Badges
  const stMeta = statusMeta(p.status);
  const badges = [
    '<span class="' + stMeta.view + '">' + stMeta.label.toUpperCase() + '</span>',
    p.lancamento ? '<span class="cv-badge-success">LANÇAMENTO</span>' : '',
    p.codigo     ? '<span class="cv-badge-neutral">' + p.codigo + '</span>' : '',
  ].filter(Boolean).join('');

  // Pessoas
  const resp = '<div class="cv-pessoa-row"><span class="cv-pessoa-role">Responsável</span>Alex Fontes</div>';
  const vinc = (p.pessoas||[]).map(pp => {
    const ps = pessoasAll.find(x => x.id === pp.id);
    const nome = ps?.nome || pp.nome || '—';
    const tel  = ps?.telefone || '';
    return '<div class="cv-pessoa-row cv-pessoa-row-flex">' +
      '<div style="flex:1"><div class="cv-pessoa-nome">' + nome + '</div>' + (tel?'<div class="cv-pessoa-tel">'+tel+'</div>':'') + '</div>' +
      '<span class="cv-pessoa-tipo">' + (pp.tipo||'') + '</span>' +
      '</div>';
  }).join('');

  // Anúncios
  const anuncios = [
    p.anuncio_pilar   ? '<a href="'+p.anuncio_pilar+'" target="_blank" class="btn btn-ghost btn-sm">Pilar ↗</a>' : '',
    p.anuncio_nonstop ? '<a href="'+p.anuncio_nonstop+'" target="_blank" class="btn btn-ghost btn-sm">NonStop ↗</a>' : '',
    ...(p.anuncios_extra||[]).map(a=>a.url?'<a href="'+a.url+'" target="_blank" class="btn btn-ghost btn-sm">'+(a.canal||'Link')+' ↗</a>':''),
    p.link_drive      ? '<a href="'+p.link_drive+'" target="_blank" class="btn btn-ghost btn-sm"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>Drive ↗</a>' : '',
  ].filter(Boolean).join('');

  // Características
  const caract = (p.caracteristicas||[]).length
    ? '<div class="cv-caract-list">' + p.caracteristicas.map(c=>'<span class="cv-caract-chip">'+c+'</span>').join('') + '</div>'
    : '<span class="cv-caract-empty">Nenhuma cadastrada.</span>';

  // Motivo do status Inativo, se houver
  const motivoInativo = (p.status === 'inativo' && p.motivo_inativo) ? '<div class="ds-meta" style="margin:-8px 0 12px">Motivo: ' + p.motivo_inativo + '</div>' : '';

  body.innerHTML =
    carteiraFichaFotosHtml(carteiraFotosDe(p)) +
    (badges ? '<div class="cv-badges">' + badges + '</div>' : '') +
    motivoInativo +
    '<div class="cv-top-grid">' +
      '<div class="cv-section cv-block"><div class="cv-section-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Dados do imóvel</div>' +
        '<div class="carteira-view-grid">' + dados.map(d => '<div><div class="cv-dado-label">' + d.l + '</div><div class="cv-dado-val">' + d.v + '</div></div>').join('') + '</div></div>' +
      '<div class="cv-top-right">' +
        '<div class="cv-section cv-block"><div class="cv-section-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Pessoas</div><div class="cv-pessoas-cols">' + resp + vinc + '</div></div>' +
        (anuncios ? '<div class="cv-section cv-block"><div class="cv-section-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>Anúncios</div><div class="cv-anuncios">' + anuncios + '</div></div>' : '') +
      '</div>' +
    '</div>' +
    crmBlocoHtml(p.id, { negTitle: 'Negociações deste imóvel' }) +
    '<div class="cv-section cv-block"><div class="cv-section-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Características</div>' + caract + '</div>' +
    (p.anotacoes ? '<div class="cv-section cv-block"><div class="cv-section-title"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Anotações</div><div class="cv-anotacoes">' + p.anotacoes + '</div></div>' : '');
}

function inserirNoPipeline() {
  const p = carteiraItems.find(x => x.id === carteiraViewId); if (!p) return;
  const propEntry  = (p.pessoas||[]).find(x => x.tipo === 'Proprietário');
  const propPessoa = propEntry ? pessoasAll.find(x => x.id === propEntry.id) : null;
  const propNome   = propPessoa?.nome || propEntry?.nome || '';
  if (typeof dupEsquecerJanelaOrigem === 'function') dupEsquecerJanelaOrigem();
  closeCarteiraView();
  showTab('pipeline');
  setTimeout(() => {
    openModal(null);
    const sv = (id, val) => { const el=document.getElementById(id); if(el && val!=null && val!=='') el.value=val; };
    sv('fOwner',  propNome);
    sv('fRua',    p.rua);
    sv('fNum',    p.numero);
    sv('fBairro', p.bairro);
    sv('fArea',   p.area_util);
    sv('fD',      p.quartos);
    sv('fS',      p.suites);
    sv('fV',      p.vagas);
    setCur('fValor', p.valor_venda);
    calcVm2();
    toast('✅ Dados do imóvel pré-preenchidos no Pipeline');
  }, 150);
}

// ── Ficha Edit ────────────────────────────────────────────────────────────────
async function openCarteiraFicha(id) {
  editCarteiraId = id || null;
  await carregarPessoas();
  const p = id ? carteiraItems.find(x=>x.id===id) : null;
  carteiraPessoas       = p ? JSON.parse(JSON.stringify(p.pessoas||[])) : [];
  carteiraAnunciosExtra = p ? JSON.parse(JSON.stringify(p.anuncios_extra||[])) : [];

  // Header
  const titulo = p ? (p.rua?(p.rua+(p.numero?', '+p.numero:'')):p.codigo||'Imóvel') : 'Novo Imóvel';
  document.getElementById('carteiraFichaTitulo').textContent = titulo;
  document.getElementById('carteiraFichaSub').textContent    = p ? (p.bairro||'') : '';
  document.getElementById('btnCarteiraExcluir').style.display = p ? '' : 'none';

  // Condomínio select
  const sel = document.getElementById('cfCondominio');
  sel.innerHTML = '<option value="">— Nenhum —</option>' +
    condominios.map(c=>`<option value="${c.id}"${p?.condominio_id===c.id?' selected':''}>${c.nome}</option>`).join('');

  // Form fields
  const v = (id, val) => { const el=document.getElementById(id); if(el) el.value=val??''; };
  const b = (id, val) => { const el=document.getElementById(id); if(el) el.checked=val||false; };
  v('cfRua',       p?.rua);        v('cfNum',    p?.numero);     v('cfCompl',  p?.complemento);
  v('cfBairro',    p?.bairro);     v('cfCep',    p?.cep);
  v('cfCodigo',    p?.codigo);     preencherSelectOpcoes('cfTipo', 'tipologia', p?.tipo || '');
  preencherSelectOpcoes('cfConservacao', 'conservacao', p?.conservacao || '');
  v('cfDrive',  p?.link_drive);
  setCur('cfValorVenda',p?.valor_venda);setCur('cfValorAlug',p?.valor_aluguel);
  v('cfAreaUtil',  p?.area_util);  v('cfAreaTotal',p?.area_total);
  v('cfQuartos',   p?.quartos);    v('cfSuites', p?.suites);
  v('cfBanhos',    p?.banheiros);  v('cfVagas',  p?.vagas);      v('cfAndar', p?.andar);
  setCur('cfIptu', p?.iptu_mensal);v('cfSql',    p?.iptu_sql);
  v('cfMatricula', p?.matricula_num); v('cfCri', p?.matricula_cri);
  setCur('cfCond', p?.cond_mensal);
  v('cfComissao',  p?.comissao??6);v('cfAnotacoes',p?.anotacoes);
  v('cfAnuncioPilar',p?.anuncio_pilar); v('cfAnuncioNonStop',p?.anuncio_nonstop);
  setCfStatus(p?.status || (p?.exclusivo ? 'exclusivo' : 'a_classificar'));  b('cfLancamento',p?.lancamento);
  v('cfMotivoInativo', p?.motivo_inativo);
  v('cfOrigem',    p?.origem);
  v('cfAnunciadoEm', p?.anunciado_em);

  renderCarteiraCaract(p?.caracteristicas||[]);
  renderAnunciosExtra();
  renderCfInativoBox();
  v('cfFotosPasta', p?.fotos_pasta_url);
  carteiraFotosEdit = p ? JSON.parse(JSON.stringify(carteiraFotosDe(p))) : [];
  renderCfFotosPreview();
  document.getElementById('carteiraOverlay').classList.add('open');
  showCarteiraTab(id ? 'pessoas' : 'imovel');
  cfDupReset();   // Frente A: avisos de duplicata limpos a cada abertura
  setTimeout(() => {
    setupRuaNumACById('cfRua','cfNum');
    // Frente A: verificação de endereço duplicado com atraso de digitação (~400ms)
    ['cfRua', 'cfNum', 'cfCompl'].forEach(fid => {
      const el = document.getElementById(fid);
      if (el && !el._dupHook) { el._dupHook = true; el.addEventListener('input', cfDupAgendar); }
    });
    const cod = document.getElementById('cfCodigo');
    if (cod && !cod._dupHook) { cod._dupHook = true; cod.addEventListener('input', cfCodigoErrLimpar); }
  }, 50);
  renderCarteiraPessoasTab();
}

function closeCarteiraFicha() {
  document.getElementById('carteiraOverlay').classList.remove('open');
  editCarteiraId = null;
}

function showCarteiraTab(tab) {
  document.querySelectorAll('.carteira-tab').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.carteira-tab-view').forEach(el=>el.classList.remove('active'));
  document.getElementById('ctab-'+tab).classList.add('active');
  document.getElementById('ctv-'+tab).classList.add('active');
}

// ── Aba Pessoas ───────────────────────────────────────────────────────────────
function renderCarteiraPessoasTab() {
  const el = document.getElementById('carteiraFichaPessoas'); if (!el) return;
  const rows = carteiraPessoas.map((pp,i) => {
    const ps = pessoasAll.find(x=>x.id===pp.id);
    const nome = ps?.nome || pp.nome || '—';
    const sub  = [ps?.tel||pp.tel, ps?.email||pp.email].filter(Boolean).join(' · ');
    return '<div class="pessoa-row">'+
      '<div class="pessoa-row-info"><div class="pessoa-row-nome">'+nome+'</div>'+(sub?'<div class="pessoa-row-sub">'+sub+'</div>':'')+'</div>'+
      '<select class="carteira-tipo-select" onchange="carteiraPessoas['+i+'].tipo=this.value">'+
        PESSOA_TIPOS.map(t=>'<option'+(pp.tipo===t?' selected':'')+'>'+t+'</option>').join('')+
      '</select>'+
      '<button class="acm-xbtn" onclick="removeCarteiraPessoa('+i+')">×</button>'+
    '</div>';
  }).join('');

  el.innerHTML =
    '<div class="carteira-pessoas-grid">'+
    // Coluna esquerda: responsável + vinculadas
    '<div>'+
      '<div class="carteira-col-label">Responsável</div>'+
      '<div class="pessoa-row carteira-resp-row"><div class="pessoa-row-info"><div class="pessoa-row-nome">Alex Fontes</div><div class="pessoa-row-sub">Fixo — responsável pelo imóvel</div></div></div>'+
      '<div class="carteira-col-label">Pessoas vinculadas</div>'+
      (rows||'<div class="cond-empty">Nenhuma ainda.</div>')+
    '</div>'+
    // Coluna direita: busca
    '<div>'+
      '<div class="carteira-col-label">Vincular pessoa</div>'+
      '<div class="pessoa-search-wrap">'+
        '<input type="text" id="pessoaSearchInput" placeholder="Buscar pessoa nos Contatos..." oninput="searchPessoasDrop(this.value)" style="width:100%" autocomplete="off">'+
        '<div id="pessoaSearchDrop" class="pessoa-search-drop" style="display:none"></div>'+
      '</div>'+
    '</div>'+
    '</div>';
}

function searchPessoasDrop(q) {
  const drop = document.getElementById('pessoaSearchDrop'); if(!drop) return;
  if (!q.trim()) { drop.style.display='none'; return; }
  const linked = new Set(carteiraPessoas.map(x=>x.id));
  const results = pessoasAll.filter(p=>!linked.has(p.id)&&(p.nome||'').toLowerCase().includes(q.toLowerCase())).slice(0,8);
  drop.innerHTML = results.map(p=>
    '<div class="pessoa-search-item" onmousedown="vincularPessoa(\''+p.id+'\')"><strong>'+(p.nome||'—')+'</strong>'+(p.tel?' · '+p.tel:'')+'</div>'
  ).join('') +
  '<div class="pessoa-search-item pessoa-search-create" onmousedown="criarEVincularPessoa(\''+q.trim()+'\')">+ Criar "'+q.trim()+'" como novo contato</div>';
  drop.style.display='';
}

function vincularPessoa(pessoaId) {
  const ps = pessoasAll.find(x=>x.id===pessoaId); if(!ps) return;
  carteiraPessoas.push({ id:pessoaId, nome:ps.nome, tipo:'Proprietário' });
  const inp = document.getElementById('pessoaSearchInput'); if(inp) inp.value='';
  const drop = document.getElementById('pessoaSearchDrop'); if(drop) drop.style.display='none';
  renderCarteiraPessoasTab();
}

async function criarEVincularPessoa(nome) {
  const { data, error } = await db().from('pessoas').insert({ nome, tipos:['Proprietário'] }).select().single();
  if (error) { toast('❌ '+error.message); return; }
  pessoasAll.push(data);
  carteiraPessoas.push({ id:data.id, nome:data.nome, tipo:'Proprietário' });
  renderCarteiraPessoasTab(); // re-render first (creates fresh inputs)
  toast('✅ Contato criado e vinculado');
}

function removeCarteiraPessoa(idx) {
  carteiraPessoas.splice(idx,1);
  renderCarteiraPessoasTab();
}

// ── Características ───────────────────────────────────────────────────────────
function renderCarteiraCaract(selected) {
  const opcoes = getCaractOpcoes();
  const sel    = new Set(selected||[]);
  const el = document.getElementById('cfCaracteristicas'); if(!el) return;
  el.innerHTML = opcoes.map(op=>
    '<label class="carteira-caract-label">'+
      '<input type="checkbox" class="carteira-caract-check" value="'+op+'"'+(sel.has(op)?' checked':'')+'>'+op+
    '</label>'
  ).join('');
}

function getCarteiraCaractSelecionadas() {
  return [...document.querySelectorAll('#cfCaracteristicas input[type=checkbox]:checked')].map(el=>el.value);
}

// ── Anúncios Extra ────────────────────────────────────────────────────────────
function renderAnunciosExtra() {
  const el = document.getElementById('cfAnunciosExtra'); if(!el) return;
  el.innerHTML = carteiraAnunciosExtra.map((a,i)=>
    '<div class="anuncio-row">'+
      '<input type="text" value="'+(a.nome||'')+'" placeholder="Canal" class="anuncio-canal-input" oninput="carteiraAnunciosExtra['+i+'].nome=this.value">'+
      '<input type="text" value="'+(a.link||'')+'" placeholder="https://..." class="anuncio-link-input" oninput="carteiraAnunciosExtra['+i+'].link=this.value">'+
      '<button class="acm-xbtn" onclick="carteiraAnunciosExtra.splice('+i+',1);renderAnunciosExtra()">×</button>'+
    '</div>'
  ).join('');
}

function addAnuncioExtra() {
  carteiraAnunciosExtra.push({ nome:'', link:'' });
  renderAnunciosExtra();
}

// ── Aba Fotos — galeria via pasta do Google Drive (arrastar pra reordenar, 1ª = capa) ──
function renderCfFotosPreview() {
  const wrap = document.getElementById('cfFotosPreview'); if (!wrap) return;
  const countEl = document.getElementById('cfFotosCount'); if (countEl) countEl.textContent = carteiraFotosEdit.length;
  if (!carteiraFotosEdit.length) { wrap.innerHTML = '<div class="drive-empty">Nenhuma foto ainda — cole o link da pasta do Drive acima.</div>'; return; }
  wrap.innerHTML = carteiraFotosEdit.map((url,i) =>
    '<div class="drive-thumb">' +
      '<div class="drag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg></div>' +
      '<img src="'+url+'" onerror="this.parentNode.style.opacity=\'.35\'">' +
      '<span class="x" onclick="removerFotoEdit('+i+')">×</span>' +
      (i===0 ? '<div class="capa">Capa</div>' : '') +
    '</div>'
  ).join('');
  initFotosSortable();
}

function removerFotoEdit(i) { carteiraFotosEdit.splice(i,1); renderCfFotosPreview(); }

function initFotosSortable() {
  const wrap = document.getElementById('cfFotosPreview'); if (!wrap || typeof Sortable === 'undefined') return;
  if (fotosSortableInstance) fotosSortableInstance.destroy();
  fotosSortableInstance = new Sortable(wrap, { animation: 150, onEnd: (evt) => {
    const moved = carteiraFotosEdit.splice(evt.oldIndex, 1)[0];
    carteiraFotosEdit.splice(evt.newIndex, 0, moved);
    renderCfFotosPreview();
  }});
}

async function buscarFotosDaPasta(area) {
  const input = document.getElementById(area === 'carteira' ? 'cfFotosPasta' : 'condFotosPasta');
  const url = input?.value?.trim();
  if (!url) { toast('⚠️ Cole o link da pasta do Drive primeiro'); return; }
  toast('Buscando fotos da pasta...');
  const fotos = await listarFotosDrivePasta(url);
  if (!fotos.length) return;
  if (area === 'carteira') { carteiraFotosEdit = fotos; renderCfFotosPreview(); }
  else if (typeof condFotosEdit !== 'undefined') { condFotosEdit = fotos; if (typeof renderCondFotosPreview === 'function') renderCondFotosPreview(); }
  toast('✅ '+fotos.length+' foto'+(fotos.length!==1?'s':'')+' encontrada'+(fotos.length!==1?'s':''));
}

// ── Frente A (9.3) — duplicata no cadastro manual de Imóvel ──────────────────
// Endereço: cartão de aviso (dup-card) que NUNCA bloqueia — sempre há o "é outro
// imóvel". Código PD: aviso junto do campo e não grava (a trava do banco recusaria).
// Componente e busca compartilhados com a Captação (dupBuscarImoveis/dupCardMostrar
// em captacao.js — mesmo arquivo carregado nesta página).
let _cfSalvando   = false;   // guarda anti-duplo-clique
let _cfDupIgnorar = false;   // "é outro imóvel — pode salvar assim" já foi clicado
let _cfDupTimer   = null;
function cfDupReset() {
  _cfDupIgnorar = false;
  clearTimeout(_cfDupTimer);
  dupCardEsconder(document.getElementById('cfDupEndCard'));
  cfCodigoErrLimpar();
}
function cfDupAgendar() {
  _cfDupIgnorar = false;   // mudou o endereço → decisão anterior não vale mais
  clearTimeout(_cfDupTimer);
  _cfDupTimer = setTimeout(cfDupVerificar, 400);
}
function cfDupAcoes(card) {
  return {
    // mesma coisa da Captação: recolhe a ficha de cadastro (nada do que foi
    // digitado se perde) e devolve quando o Alex fecha a ficha do imóvel
    abrir: r => dupAbrirFicha(r.id, 'carteiraOverlay'),
    criarNovo: () => { _cfDupIgnorar = true; dupCardEsconder(card); },
    criarNovoLabel: 'É outro imóvel — pode salvar assim',
    textoTitulo: null,
  };
}
async function cfDupVerificar() {
  const card = document.getElementById('cfDupEndCard');
  if (!card) return;
  const gv = id => (document.getElementById(id)?.value || '').trim();
  const rua = gv('cfRua'), num = gv('cfNum'), compl = gv('cfCompl');
  if (!rua || !num) { dupCardEsconder(card); return; }
  dupCardChecando(card);
  const achados = await dupBuscarImoveis(rua, num, compl, editCarteiraId);
  if (_cfDupIgnorar) return;
  if (!achados.length) { dupCardEsconder(card); return; }
  dupCardMostrar(card, achados, cfDupAcoes(card), null);
}
function cfCodigoErrLimpar() {
  const inp = document.getElementById('cfCodigo'); if (inp) inp.classList.remove('err');
  const box = document.getElementById('cfCodigoErr'); if (box) { box.classList.remove('show'); box.innerHTML = ''; }
}
function cfCodigoErrMostrar(dup) {
  const inp = document.getElementById('cfCodigo');
  const box = document.getElementById('cfCodigoErr');
  if (!box) { toast('⚠️ Já existe um imóvel com o código ' + dup.codigo); return; }
  if (inp) inp.classList.add('err');
  box.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  const sp = document.createElement('span');
  const b = document.createElement('b'); b.textContent = dup.codigo || '';
  sp.appendChild(document.createTextNode('Já existe um imóvel com o código '));
  sp.appendChild(b);
  sp.appendChild(document.createTextNode(' — o código PD não pode se repetir. Troque o código ou '));
  if (dup.id) {
    const a = document.createElement('span');
    a.className = 'fe-link'; a.textContent = 'abra o que já existe';
    // recolhe a ficha de cadastro antes de abrir (senão a ficha do imóvel fica atrás)
    a.addEventListener('click', () => dupAbrirFicha(dup.id, 'carteiraOverlay'));
    sp.appendChild(a);
  }
  sp.appendChild(document.createTextNode('.'));
  box.appendChild(sp);
  box.setAttribute('role', 'alert');
  box.classList.add('show');
  if (inp) inp.focus();
  if (box.scrollIntoView) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
async function salvarCarteira() {
  if (_cfSalvando) return;   // guarda anti-duplo-clique
  const gv = id => document.getElementById(id)?.value?.trim()||null;
  const gn = id => parseCur(document.getElementById(id)?.value)||null;
  const gi = id => parseInt(document.getElementById(id)?.value)||null;
  const gb = id => document.getElementById(id)?.checked||false;

  const status = document.getElementById('cfStatus')?.value || 'a_classificar';
  const payload = {
    codigo:          gv('cfCodigo'),
    foto_capa:       carteiraFotosEdit[0] || null,
    fotos:           carteiraFotosEdit,
    fotos_pasta_url: gv('cfFotosPasta'),
    motivo_inativo:  status === 'inativo' ? gv('cfMotivoInativo') : null,
    pessoas:         carteiraPessoas,
    rua:             gv('cfRua'),      numero:       gv('cfNum'),     complemento: gv('cfCompl'),
    bairro:          gv('cfBairro'),   cep:          gv('cfCep'),
    condominio_id:   document.getElementById('cfCondominio')?.value||null,
    tipo:            gv('cfTipo'),
    conservacao:     gv('cfConservacao') || null,
    link_drive:      gv('cfDrive'),
    valor_venda:     gn('cfValorVenda'), valor_aluguel: gn('cfValorAlug'),
    area_util:       gn('cfAreaUtil'),  area_total:   gn('cfAreaTotal'),
    quartos:         gi('cfQuartos'),   suites:       gi('cfSuites'),
    banheiros:       gi('cfBanhos'),    vagas:        gi('cfVagas'),
    andar:           gv('cfAndar'),
    iptu_mensal:     gn('cfIptu'),      iptu_sql:     gv('cfSql'),
    matricula_num:   gv('cfMatricula'), matricula_cri: gv('cfCri'),
    cond_mensal:     gn('cfCond'),
    comissao:        parseFloat(document.getElementById('cfComissao')?.value)||6,
    status:          status,
    exclusivo:       (status === 'exclusivo'), lancamento: gb('cfLancamento'),
    caracteristicas: getCarteiraCaractSelecionadas(),
    anotacoes:       gv('cfAnotacoes'),
    anuncio_pilar:   gv('cfAnuncioPilar'),
    anuncio_nonstop: gv('cfAnuncioNonStop'),
    anuncios_extra:  carteiraAnunciosExtra,
    origem:          gv('cfOrigem'),
    updated_at:      new Date().toISOString(),
  };

  // 5.B — anunciado_em: data REAL de anúncio (base do tempo de venda), editável na ficha.
  // Usa o campo se preenchido; senão, só para imóvel NOVO publicável assume hoje (acabou de listar).
  // Imóvel existente sem data fica null (não inventa data de importação).
  const cartExist = editCarteiraId ? (carteiraItems || []).find(c => c.id === editCarteiraId) : null;
  const publicavelAtual = cartExist ? cartExist.publicavel !== false : true;
  const anunField = document.getElementById('cfAnunciadoEm')?.value || null;
  if (anunField) payload.anunciado_em = anunField;
  else if (!editCarteiraId && publicavelAtual) payload.anunciado_em = todayISO();

  _cfSalvando = true;
  try {
    // Frente A (9.3): duplicatas conferidas no BANCO antes de gravar.
    // 1) Código PD repetido — não grava (a trava única do banco recusaria de qualquer jeito).
    cfCodigoErrLimpar();
    if (payload.codigo) {
      const { data: cods, error: eCod } = await db().from('imoveis_carteira').select('id,codigo');
      if (!eCod) {
        const dupCod = (cods || []).find(r => r.id !== editCarteiraId &&
          (r.codigo || '').trim().toLowerCase() === payload.codigo.toLowerCase());
        if (dupCod) { showCarteiraTab('pessoas'); cfCodigoErrMostrar(dupCod); return; }
      }
    }
    // 2) Endereço parecido — aviso que nunca bloqueia: o cartão tem o
    //    "é outro imóvel — pode salvar assim", e aí o salvar passa.
    if (!_cfDupIgnorar && payload.rua && payload.numero) {
      const achados = await dupBuscarImoveis(payload.rua, payload.numero, payload.complemento, editCarteiraId);
      if (achados.length) {
        showCarteiraTab('pessoas');
        const card = document.getElementById('cfDupEndCard');
        dupCardMostrar(card, achados, cfDupAcoes(card), null);
        // Sem toast aqui (QA Rev 3, menor 2): o cartão inline É o aviso.
        if (card && card.scrollIntoView) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
    }

    let error;
    if (editCarteiraId) {
      ({ error } = await db().from('imoveis_carteira').update(payload).eq('id', editCarteiraId));
    } else {
      ({ error } = await db().from('imoveis_carteira').insert(payload));
    }
    if (error) {
      // Trava do banco (índice único): tradução amigável
      if (error.code === '23505' && (error.message || '').includes('codigo')) {
        showCarteiraTab('pessoas'); cfCodigoErrMostrar({ id: null, codigo: payload.codigo }); return;
      }
      toast('❌ ' + error.message); return;
    }
    toast(editCarteiraId ? '✅ Imóvel atualizado' : '✅ Imóvel cadastrado');
    const viewIdParaReabrir = carteiraViewId && editCarteiraId === carteiraViewId ? carteiraViewId : null;
    closeCarteiraFicha();
    await carregarCarteira();
    renderCarteira();
    if (viewIdParaReabrir) openCarteiraView(viewIdParaReabrir);
  } finally { _cfSalvando = false; }
}

async function excluirCarteira() {
  if (!editCarteiraId||!confirm('Excluir este imóvel?')) return;
  const { error } = await db().from('imoveis_carteira').delete().eq('id', editCarteiraId);
  if (error) { toast('❌ '+error.message); return; }
  toast('🗑️ Imóvel excluído');
  if (typeof dupEsquecerJanelaOrigem === 'function') dupEsquecerJanelaOrigem();
  closeCarteiraFicha();
  closeCarteiraView();
  await carregarCarteira();
  renderCarteira();
}

// ── Características Settings ──────────────────────────────────────────────────
function openCaractSettings() {
  renderCaractSettingsList();
  document.getElementById('caractSettingsOverlay').classList.add('open');
  document.getElementById('novaCaractInput').value='';
}
function closeCaractSettings() { document.getElementById('caractSettingsOverlay').classList.remove('open'); }

function renderCaractSettingsList() {
  const opcoes = getCaractOpcoes();
  document.getElementById('caractSettingsList').innerHTML = opcoes.map((op,i)=>
    '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--surface2)">'+
      '<span style="flex:1;font-size:13px">'+op+'</span>'+
      '<button class="acm-xbtn" onclick="removeCaract('+i+')">×</button>'+
    '</div>'
  ).join('');
}

function addCaract() {
  const input = document.getElementById('novaCaractInput');
  const val = input.value.trim(); if (!val) return;
  const opcoes = getCaractOpcoes();
  if (opcoes.includes(val)) { toast('⚠️ Já existe'); return; }
  opcoes.push(val);
  saveCaractOpcoes(opcoes);
  input.value='';
  renderCaractSettingsList();
  toast('✅ Adicionado');
}

function removeCaract(idx) {
  const opcoes = getCaractOpcoes();
  opcoes.splice(idx,1);
  saveCaractOpcoes(opcoes);
  renderCaractSettingsList();
}
