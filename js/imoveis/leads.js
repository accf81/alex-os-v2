// leads.js — abas Leads (Kanban) + Visitas do módulo Imóveis.
// Extraído de imoveis.html em 06/07/2026 (item 12.4, extração 6). NÃO usar type=module — funções globais (onclick).
// Depende de: core.js (toast, todayISO/fmtDate, parseCur/setCur, fmtTelInput, emitirTarefa, carregarCarteira, carteiraItems, pessoasAll)
// + Gestão (openGestaoModal/openGestaoDetalhe, chamados em runtime) + Vendas (openVendasFicha, lfIniciarVenda).
// Usada por: Carteira/Gestão/Vendas/Captação (openLeadFicha, openVisitaFicha, leadsDoImovel, crmBlocoHtml, carregarLeads/carregarVisitas via init).

// Modal legado de Lead/Visita (openLeadModal/salvarLead/excluirLead/openVisitaModal/
// salvarVisita/excluirVisita + auxiliares) REMOVIDO em 25/07/2026 — código morto que
// gravava em gestao_exclusiva.dados.leads (JSONB) e não era chamado por ninguém (D-1).
// O campo gestao_exclusiva.dados no banco NÃO foi tocado.

// ── Fatia 4b — Visitas como entidade do imóvel (tabela `visitas`) ──────────────
let visitasItems    = [];
let editVisFichaId  = null;
let visCompradorIds = [];     // pessoas que vieram à visita (casal = mais de um)
let visParceiroId   = null;   // corretor parceiro (pessoa)
let visPreCarteira  = null;   // imóvel pré-fixado quando aberto pela ficha do imóvel

async function carregarVisitas() {
  const { data, error } = await db().from('visitas').select('*').order('data', { ascending: false });
  if (error) { console.error('visitas:', error); return; }
  visitasItems = data || [];
}

const VIS_STATUS    = { agendada:'Agendada', realizada:'Realizada', cancelada:'Cancelada' };
const VIS_INTERESSE = { quente:'Quente', morno:'Morno', frio:'Frio' };
function visImovelLabel(cartId) {
  const c = (carteiraItems || []).find(x => x.id === cartId);
  if (!c) return '—';
  const base = [c.rua, c.numero].filter(Boolean).join(', ');
  return (base + (c.complemento ? ' · ' + c.complemento : '')) || c.codigo || '—';
}
function visFeedback(v) { return (v.observacoes && v.observacoes.feedback) || ''; }
function visProximo(v)  { return (v.observacoes && v.observacoes.proximo)  || ''; }
function visPessoaNome(id) {
  const p = (pessoasAll || []).find(x => x.id === id);
  return p ? p.nome : '';
}
function visCompradoresLabel(v) {
  const ids = Array.isArray(v.cliente_ids) ? v.cliente_ids : [];
  return ids.map(visPessoaNome).filter(Boolean).join(', ');
}
function visDataFmt(v) {
  return v.data ? new Date(v.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
}

// Lembrete pós-visita: visita 'agendada' cuja data+hora já passou
function visitaPendente(v) {
  if ((v.status || 'agendada') !== 'agendada' || !v.data) return false;
  const hojeStr = todayISO();
  if (v.data < hojeStr) return true;
  if (v.data === hojeStr && v.horario) {
    const n = new Date();
    const hh = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
    return v.horario < hh;
  }
  return false;
}

// ── Quadro de Leads (Kanban) — Fatia 13.1b ─────────────────────────────────────
let leadFiltro = { imovel:'', temp:'', origem:'', busca:'', arquivados:false };
let _leadDebTimer = null;

function leadColOf(l){ return normLeadStatus(l.status); }
function leadVisitaInfo(l){
  const vs = leadVisitasDo(l);
  if(!vs.length) return null;
  vs.sort((a,b)=> (b.data||'').localeCompare(a.data||''));
  return vs[0];
}
function leadFirstContatoFmt(l){
  if(!l.primeiro_contato) return '';
  return '1º ' + new Date(l.primeiro_contato+'T00:00:00').toLocaleDateString('pt-BR');
}
function leadMatchFiltro(l){
  if(leadFiltro.imovel && l.carteira_id!==leadFiltro.imovel) return false;
  if(leadFiltro.origem && (l.origem||'direto')!==leadFiltro.origem) return false;
  if(leadFiltro.busca){ const q=leadFiltro.busca.toLowerCase().trim(); if(q && !(leadNome(l)||'').toLowerCase().includes(q)) return false; }
  if(leadFiltro.temp){ const v=leadVisitaInfo(l); if(!v || v.resultado!==leadFiltro.temp) return false; }
  return true;
}

function leadKanbanCard(l){
  const v = leadVisitaInfo(l);
  const col = leadColOf(l);
  let visTag='';
  if(v){
    if((v.status||'')==='realizada' || v.resultado){
      const tempClass = v.resultado==='quente'?'danger':v.resultado==='morno'?'warn':v.resultado==='frio'?'info':'';
      const temp = v.resultado ? '<span class="gest-outline-badge '+tempClass+'">'+(VIS_INTERESSE[v.resultado]||'')+'</span>' : '';
      visTag = '<span class="gest-outline-badge warn"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Visitou'+(v.data?' '+visDataFmt(v):'')+'</span>'+temp;
    } else if((v.status||'agendada')==='agendada'){
      visTag = '<span class="gest-outline-badge info"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'+visDataFmt(v)+(v.horario?' · '+v.horario:'')+'</span>';
    }
  }
  const origem = (l.origem==='parceiro') ? 'Via parceiro' : 'Direto';
  const cart = (carteiraItems||[]).find(c=>c.id===l.carteira_id);
  const cod = cart && cart.codigo ? cart.codigo : '';
  const prox = (l.proximo||'').trim();
  const parado = daysAgo((l.updated_at||l.created_at||'').slice(0,10));
  let vendaTag='';
  if(col==='negociacao'){ const fe=leadFechamentoDo(l); if(fe) vendaTag='<span class="gest-outline-badge success" style="cursor:pointer" onclick="event.stopPropagation();openVendasFicha(\''+fe.id+'\')"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>'+(FECH_ETAPA[fe.etapa]||'Em proposta')+'</span>'; }
  return '<div class="card lead-card" data-id="'+l.id+'" onclick="openLeadFicha(\''+l.id+'\')">'+
    '<div class="lead-card-nome">'+leadNome(l)+'</div>'+
    '<div class="lead-card-imovel">'+(cod?'<span class="lead-card-cod">'+cod+'</span> · ':'')+visImovelLabel(l.carteira_id)+'</div>'+
    '<div class="gest-tags" style="margin-bottom:8px"><span class="gest-tag-gray">'+origem+'</span>'+visTag+vendaTag+'</div>'+
    (prox?'<div class="cap-card-prox"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'+prox.replace(/</g,'&lt;')+'</div>':'')+
    '<div class="lead-card-foot"><span>'+leadFirstContatoFmt(l)+'</span><span>'+(parado>0?('parado há '+parado+'d'):'hoje')+'</span></div>'+
  '</div>';
}
function leadArchCard(l){
  return '<div class="card lead-card arch" data-id="'+l.id+'" onclick="openLeadFicha(\''+l.id+'\')">'+
    '<div class="lead-card-nome">'+leadNome(l)+'</div>'+
    '<div class="lead-card-imovel">'+visImovelLabel(l.carteira_id)+'</div>'+
    (l.motivo_arquivo?'<div class="lead-card-motivo">'+(l.motivo_arquivo+'').replace(/</g,'&lt;')+'</div>':'')+
  '</div>';
}

async function renderLeadsBoard(){
  const el = document.getElementById('sv-visitas'); if(!el) return;
  await carregarPessoas();
  const todos = leadsItems||[];
  const ativos = todos.filter(l=>leadColOf(l)!=='arquivado' && leadMatchFiltro(l));
  const arquivados = todos.filter(l=>leadColOf(l)==='arquivado' && leadMatchFiltro(l));

  const imovelOpts = '<option value="">Imóvel: todos</option>'+
    (carteiraItems||[]).slice().sort((a,b)=>(a.rua||'').localeCompare(b.rua||''))
      .map(c=>'<option value="'+c.id+'"'+(leadFiltro.imovel===c.id?' selected':'')+'>'+(c.codigo?c.codigo+' · ':'')+visImovelLabel(c.id)+'</option>').join('');
  const bar = '<div class="lead-toolbar">'+
    '<input type="text" id="leadSearch" class="cond-search" placeholder="Buscar lead..." value="'+(leadFiltro.busca||'').replace(/"/g,'&quot;')+'" oninput="leadFiltro.busca=this.value; leadRenderDebounce()">'+
    '<select class="lead-select" onchange="leadFiltro.imovel=this.value; renderLeadsBoard()">'+imovelOpts+'</select>'+
    '<select class="lead-select" onchange="leadFiltro.temp=this.value; renderLeadsBoard()"><option value="">Temperatura</option>'+
      ['quente','morno','frio'].map(t=>'<option value="'+t+'"'+(leadFiltro.temp===t?' selected':'')+'>'+VIS_INTERESSE[t]+'</option>').join('')+'</select>'+
    '<select class="lead-select" onchange="leadFiltro.origem=this.value; renderLeadsBoard()"><option value="">Origem</option>'+
      '<option value="direto"'+(leadFiltro.origem==='direto'?' selected':'')+'>Direto</option>'+
      '<option value="parceiro"'+(leadFiltro.origem==='parceiro'?' selected':'')+'>Via parceiro</option></select>'+
    '<label class="lead-toggle"><input type="checkbox" '+(leadFiltro.arquivados?'checked':'')+' onchange="leadFiltro.arquivados=this.checked; renderLeadsBoard()"> Mostrar arquivados</label>'+
  '</div>';

  let cols = LEAD_COLS.map(c=>{
    const items = ativos.filter(l=>leadColOf(l)===c.key);
    return '<div class="pipe-col">'+
      '<div class="pipe-col-hdr"><span class="pipe-col-ico" style="color:'+c.dot+'">'+c.icon+'</span><span class="pipe-col-label">'+c.label+'</span><span class="pipe-col-count">'+items.length+'</span><span class="pipe-col-add" title="Novo lead" onclick="openNovoLead(\''+c.key+'\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span></div>'+
      '<div class="pipe-col-cards" data-col="'+c.key+'">'+(items.length?items.map(leadKanbanCard).join(''):'<div class="gp-empty-col">—</div>')+'</div>'+
    '</div>';
  }).join('');
  if(leadFiltro.arquivados){
    cols += '<div class="pipe-col" style="border-style:dashed"><div class="pipe-col-hdr"><span class="pipe-col-ico" style="color:var(--danger)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></span><span class="pipe-col-label">Arquivados</span><span class="pipe-col-count">'+arquivados.length+'</span></div>'+
      '<div class="pipe-col-cards">'+(arquivados.length?arquivados.map(leadArchCard).join(''):'<div class="gp-empty-col">—</div>')+'</div></div>';
  }
  const arqNota = (arquivados.length && !leadFiltro.arquivados) ? ' · '+arquivados.length+' arquivado'+(arquivados.length!==1?'s':'')+' (escondidos)' : '';
  const count = '<div class="lead-count">'+ativos.length+' lead'+(ativos.length!==1?'s':'')+' ativo'+(ativos.length!==1?'s':'')+'<span>'+arqNota+'</span></div>';

  el.innerHTML = bar + count + '<div class="pipeline pipeline-4col">'+cols+'</div>';
  initLeadDnD();
  if(leadFiltro.busca){ const s=document.getElementById('leadSearch'); if(s){ s.focus(); s.setSelectionRange(s.value.length,s.value.length); } }
}
function leadRenderDebounce(){ clearTimeout(_leadDebTimer); _leadDebTimer=setTimeout(renderLeadsBoard, 220); }

function initLeadDnD(){
  if(typeof Sortable==='undefined') return;
  document.querySelectorAll('.pipe-col-cards[data-col]').forEach(col=>{
    new Sortable(col,{ group:'leads', animation:150, ghostClass:'cap-card-ghost',
      onEnd:(evt)=>{
        const id=evt.item.getAttribute('data-id');
        const destino=evt.to.getAttribute('data-col');
        const origem=evt.from.getAttribute('data-col');
        if(id && destino && destino!==origem) moverLeadEtapa(id, destino);
      }
    });
  });
}
async function moverLeadEtapa(id, novaCol){
  const l=(leadsItems||[]).find(x=>x.id===id); if(!l){ renderLeadsBoard(); return; }
  const {error}=await db().from('leads').update({status:novaCol, updated_at:new Date().toISOString()}).eq('id',id);
  if(error){ toast('❌ '+error.message); renderLeadsBoard(); return; }
  l.status=novaCol; l.updated_at=new Date().toISOString();
  toast('✅ '+leadNome(l)+' → '+((LEAD_COLS.find(c=>c.key===novaCol)||{}).label||novaCol));
  renderLeadsBoard();
}
function openNovoLead(col){ openLeadFicha(null, null, (typeof col==='string'?col:'novo')); }

// Blocos de imóvel (vários imóveis numa visita do mesmo dia → um registro por imóvel)
let visBlocks = [];
function visImovelOptions(sel) {
  const opts = (carteiraItems || []).slice().sort((a, b) => (a.rua || '').localeCompare(b.rua || ''));
  return '<option value="">— Selecione o imóvel —</option>' +
    opts.map(c => '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + visImovelLabel(c.id) + '</option>').join('');
}
function renderVisBlocks() {
  const cont = document.getElementById('visImoveisList'); if (!cont) return;
  const lock = !!visPreCarteira && !editVisFichaId;
  cont.innerHTML = visBlocks.map((b, i) => {
    const realizada = b.status === 'realizada';
    const statusPills = ['agendada','realizada','cancelada'].map(s =>
      '<span class="vis-pill ' + (b.status === s ? 'on vis-st-' + s : '') + '" onclick="visBlockSet(' + i + ',\'status\',\'' + s + '\')">' + VIS_STATUS[s] + '</span>').join('');
    const interPills = ['quente','morno','frio'].map(t =>
      '<span class="vis-pill ' + (b.interesse === t ? 'on vis-int-' + t : '') + '" onclick="visBlockSet(' + i + ',\'interesse\',\'' + t + '\')">' + VIS_INTERESSE[t] + '</span>').join('');
    const imovelField = b.carteira_id
      ? '<div class="vis-imovel-chosen"><span>' + visImovelLabel(b.carteira_id) + '</span>' + (lock ? '' : '<button type="button" class="btn btn-ghost btn-sm" onclick="visBlockSetImovel(' + i + ',\'\')">trocar</button>') + '</div>'
      : '<div class="vis-imovel-search"><input type="text" id="visImovelBusca_' + i + '" placeholder="Buscar imóvel por rua, número, edifício..." oninput="visImovelBuscar(' + i + ')" autocomplete="off"><div id="visImovelDrop_' + i + '" class="vis-imovel-drop" style="display:none"></div></div>';
    return '<div class="vis-block">' +
      '<div class="vis-block-top">' +
        imovelField +
        '<input type="time" value="' + (b.hora || '') + '" onchange="visBlockSet(' + i + ',\'hora\',this.value)">' +
        (visBlocks.length > 1 ? '<button type="button" class="vis-block-del" title="Remover imóvel" onclick="visRemBlock(' + i + ')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' : '') +
      '</div>' +
      '<div class="vis-pills"><span class="vis-pill-label">Status</span>' + statusPills + '</div>' +
      (realizada ?
        '<div class="vis-pills"><span class="vis-pill-label">Interesse</span>' + interPills + '</div>' +
        '<textarea rows="2" placeholder="O que gostou / o que travou..." oninput="visBlockSet(' + i + ',\'feedback\',this.value)">' + (b.feedback || '') + '</textarea>' +
        '<input type="text" placeholder="Próximo passo (vira tarefa no Dia)" value="' + (b.proximo || '').replace(/"/g, '&quot;') + '" oninput="visBlockSet(' + i + ',\'proximo\',this.value)">'
        : '') +
    '</div>';
  }).join('');
}
function visBlockSet(i, campo, val) {
  if (!visBlocks[i]) return;
  visBlocks[i][campo] = val;
  if (campo === 'status' || campo === 'interesse') renderVisBlocks();
}
function visAddBlock() { visBlocks.push({ carteira_id:'', hora:'', status:'agendada', interesse:'', feedback:'', proximo:'' }); renderVisBlocks(); }
function visRemBlock(i) { visBlocks.splice(i, 1); renderVisBlocks(); }
function visImovelBuscar(i) {
  const inp = document.getElementById('visImovelBusca_' + i), drop = document.getElementById('visImovelDrop_' + i);
  if (!inp || !drop) return;
  const q = (inp.value || '').toLowerCase().trim();
  if (!q) { drop.style.display = 'none'; return; }
  const res = (carteiraItems || []).filter(c =>
    [c.rua, c.numero, c.complemento, c.bairro, c.codigo].filter(Boolean).join(' ').toLowerCase().includes(q)).slice(0, 8);
  drop.innerHTML = res.length
    ? res.map(c => '<div class="vis-drop-item" onmousedown="visBlockSetImovel(' + i + ',\'' + c.id + '\')">' + visImovelLabel(c.id) + '</div>').join('')
    : '<div class="vis-drop-empty">Nenhum imóvel encontrado</div>';
  drop.style.display = '';
}
function visBlockSetImovel(i, id) { if (visBlocks[i]) { visBlocks[i].carteira_id = id; renderVisBlocks(); } }

let visLeadId = null;
function openVisitaFicha(id, preCarteiraId, leadId) {
  carregarPessoas();
  editVisFichaId = id || null;
  visPreCarteira = preCarteiraId || null;
  const v = id ? visitasItems.find(x => x.id === id) : null;
  visLeadId = (v && v.lead_id) || leadId || null;
  document.getElementById('visFichaTitulo').textContent = v ? 'Editar Visita' : 'Nova Visita';
  document.getElementById('fVisData').value = v?.data || todayISO();
  document.getElementById('fVisVia').value  = v?.cliente_tipo || 'direto';
  visParceiroId   = v?.parceiro_id || null;
  visCompradorIds = Array.isArray(v?.cliente_ids) ? [...v.cliente_ids] : [];
  visBlocks = v
    ? [{ carteira_id: v.carteira_id || '', hora: v.horario || '', status: v.status || 'agendada', interesse: v.resultado || '', feedback: visFeedback(v), proximo: visProximo(v) }]
    : [{ carteira_id: preCarteiraId || '', hora: '', status: 'agendada', interesse: '', feedback: '', proximo: '' }];
  renderVisBlocks();
  renderVisCompradorChips();
  setVisParceiroDisplay();
  toggleVisParceiro();
  document.getElementById('fVisCompradorBusca').value = '';
  document.getElementById('visCompradorDrop').style.display = 'none';
  document.getElementById('visNovoCompBox').style.display = 'none';
  document.getElementById('btnVisFichaDel').style.display = v ? '' : 'none';
  document.getElementById('btnVisAddImovel').style.display = v ? 'none' : '';   // edição mexe em 1 imóvel
  document.getElementById('visFichaOverlay').classList.add('open');
  setTimeout(() => { if (window.AlexMasks) AlexMasks.applyMasks(document.getElementById('visFichaOverlay')); }, 60);
}
function closeVisitaFicha() { document.getElementById('visFichaOverlay').classList.remove('open'); editVisFichaId = null; }

// Comprador(es) — busca, chips, criar inline
function visBuscarComprador() {
  const q = (document.getElementById('fVisCompradorBusca').value || '').toLowerCase();
  const drop = document.getElementById('visCompradorDrop');
  if (!q) { drop.style.display = 'none'; return; }
  const res = (pessoasAll || []).filter(p => (p.nome || '').toLowerCase().includes(q) && !visCompradorIds.includes(p.id)).slice(0, 8);
  if (!res.length) { drop.innerHTML = '<div class="vis-drop-empty">Não encontrado — use "+ novo contato" abaixo</div>'; drop.style.display = ''; return; }
  drop.innerHTML = res.map(p => '<div class="vis-drop-item" onmousedown="visAddComprador(\'' + p.id + '\')">' + p.nome + (p.tel ? ' <span class="ds-meta">' + p.tel + '</span>' : '') + '</div>').join('');
  drop.style.display = '';
}
function visAddComprador(id) {
  if (!visCompradorIds.includes(id)) visCompradorIds.push(id);
  document.getElementById('fVisCompradorBusca').value = '';
  document.getElementById('visCompradorDrop').style.display = 'none';
  renderVisCompradorChips();
}
function visRemComprador(id) { visCompradorIds = visCompradorIds.filter(x => x !== id); renderVisCompradorChips(); }
function renderVisCompradorChips() {
  document.getElementById('visCompradorChips').innerHTML = visCompradorIds.map(id =>
    '<span class="vis-chip">' + (visPessoaNome(id) || '—') + '<span class="vis-chip-x" onclick="visRemComprador(\'' + id + '\')">×</span></span>').join('');
}
function visToggleNovoComprador() {
  const el = document.getElementById('visNovoCompBox');
  el.style.display = el.style.display === 'none' ? '' : 'none';
  if (el.style.display !== 'none') document.getElementById('fVisNovoCompNome').focus();
}
function visToggleCompCompleto() {
  const el = document.getElementById('visCompCompletoBox');
  el.style.display = el.style.display === 'none' ? '' : 'none';
  if (el.style.display !== 'none') document.getElementById('fVisNovoCompEmail').focus();
}
async function visCriarComprador() {
  const nome = document.getElementById('fVisNovoCompNome').value.trim();
  if (!nome) { toast('⚠️ Preencha o nome'); return; }
  const tel     = document.getElementById('fVisNovoCompTel').value.trim();
  const email   = document.getElementById('fVisNovoCompEmail').value.trim();
  const empresa = document.getElementById('fVisNovoCompEmpresa').value.trim();
  const obs     = document.getElementById('fVisNovoCompObs').value.trim();
  const { data, error } = await db().from('pessoas').insert({ nome, tel: tel || null, email: email || null, empresa: empresa || null, obs: obs || null, tipos: ['Comprador'], updated_at: new Date().toISOString() }).select('id,nome,tel,email,empresa,tipos').single();
  if (error) { toast('❌ ' + error.message); return; }
  pessoasAll.push(data);
  visAddComprador(data.id);
  ['fVisNovoCompNome','fVisNovoCompTel','fVisNovoCompEmail','fVisNovoCompEmpresa','fVisNovoCompObs'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('visCompCompletoBox').style.display = 'none';
  document.getElementById('visNovoCompBox').style.display = 'none';
  toast('✅ Contato criado');
}

// Via direto/parceiro
function toggleVisParceiro() {
  document.getElementById('visParceiroBox').style.display = document.getElementById('fVisVia').value === 'parceiro' ? '' : 'none';
}
function setVisParceiroDisplay() {
  const has = !!visParceiroId;
  document.getElementById('visParceiroSel').style.display = has ? 'flex' : 'none';
  document.getElementById('fVisParceiroBusca').style.display = has ? 'none' : '';
  if (has) document.getElementById('visParceiroSelTxt').textContent = visPessoaNome(visParceiroId) || '—';
}
function visBuscarParceiro() {
  const q = (document.getElementById('fVisParceiroBusca').value || '').toLowerCase();
  const drop = document.getElementById('visParceiroDrop');
  if (!q) { drop.style.display = 'none'; return; }
  const res = (pessoasAll || []).filter(p => (p.nome || '').toLowerCase().includes(q)).slice(0, 8);
  if (!res.length) { drop.innerHTML = '<div class="vis-drop-empty">Não encontrado — use "+ novo corretor" abaixo</div>'; drop.style.display = ''; return; }
  drop.innerHTML = res.map(p => '<div class="vis-drop-item" onmousedown="visSelParceiro(\'' + p.id + '\')">' + p.nome + (p.tel ? ' <span class="ds-meta">' + p.tel + '</span>' : '') + '</div>').join('');
  drop.style.display = '';
}
function visSelParceiro(id) {
  visParceiroId = id;
  document.getElementById('visParceiroDrop').style.display = 'none';
  document.getElementById('fVisParceiroBusca').value = '';
  setVisParceiroDisplay();
}
function visClearParceiro() { visParceiroId = null; setVisParceiroDisplay(); }
function visToggleNovoParceiro() {
  const el = document.getElementById('visNovoParcBox');
  el.style.display = el.style.display === 'none' ? '' : 'none';
  if (el.style.display !== 'none') document.getElementById('fVisNovoParcNome').focus();
}
function visToggleParcCompleto() {
  const el = document.getElementById('visParcCompletoBox');
  el.style.display = el.style.display === 'none' ? '' : 'none';
  if (el.style.display !== 'none') document.getElementById('fVisNovoParcEmail').focus();
}
async function visCriarParceiro() {
  const nome = document.getElementById('fVisNovoParcNome').value.trim();
  if (!nome) { toast('⚠️ Preencha o nome'); return; }
  const tel     = document.getElementById('fVisNovoParcTel').value.trim();
  const email   = document.getElementById('fVisNovoParcEmail').value.trim();
  const empresa = document.getElementById('fVisNovoParcEmpresa').value.trim();
  const obs     = document.getElementById('fVisNovoParcObs').value.trim();
  const { data, error } = await db().from('pessoas').insert({ nome, tel: tel || null, email: email || null, empresa: empresa || null, obs: obs || null, tipos: ['Corretor'], updated_at: new Date().toISOString() }).select('id,nome,tel,email,empresa,tipos').single();
  if (error) { toast('❌ ' + error.message); return; }
  pessoasAll.push(data);
  visSelParceiro(data.id);
  ['fVisNovoParcNome','fVisNovoParcTel','fVisNovoParcEmail','fVisNovoParcEmpresa','fVisNovoParcObs'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('visParcCompletoBox').style.display = 'none';
  document.getElementById('visNovoParcBox').style.display = 'none';
  toast('✅ Corretor criado');
}

function visBlocoPayload(b, shared) {
  const cart = (carteiraItems || []).find(c => c.id === b.carteira_id);
  const realizada = b.status === 'realizada';
  return {
    ...shared,
    horario:      b.hora || null,
    carteira_id:  b.carteira_id,
    status:       b.status,
    resultado:    realizada ? (b.interesse || null) : null,                       // temperatura
    observacoes:  realizada ? { feedback: b.feedback || '', proximo: b.proximo || '' } : {},
    gestao_id:    cart?.gestao_id || null,   // liga à gestão se o imóvel for exclusivo (corrige 9.4)
    lead_id:      visLeadId || null,         // 13.1b: amarra a visita ao lead (quando agendada pela ficha)
    updated_at:   new Date().toISOString(),
  };
}
// Etapa 2 — soma uma etiqueta na pessoa sem duplicar (proprietário pode virar comprador etc.)
async function ensureTipo(pessoaId, tipo) {
  if (!pessoaId || !tipo) return;
  const p = (pessoasAll || []).find(x => x.id === pessoaId);
  if (!p) return;
  const tipos = Array.isArray(p.tipos) ? p.tipos.slice() : [];
  if (tipos.includes(tipo)) return;                 // já tem — não acumula lixo
  tipos.push(tipo);
  const { error } = await db().from('pessoas').update({ tipos, updated_at: new Date().toISOString() }).eq('id', pessoaId);
  if (!error) p.tipos = tipos;
}
// Etapa 2 — garante um lead para a visita (nunca deixa órfã). Reaproveita lead existente do mesmo imóvel/pessoa.
async function ensureLeadForVisita(carteiraId, via) {
  const pessoaId = visCompradorIds[0] || null;
  const parc = via === 'parceiro' ? (visParceiroId || null) : null;
  let existing = (leadsItems || []).find(l => l.carteira_id === carteiraId && (
    (pessoaId && l.pessoa_id === pessoaId) ||
    (!pessoaId && parc && l.parceiro_id === parc)
  ));
  if (existing) return existing.id;
  const cart = (carteiraItems || []).find(c => c.id === carteiraId);
  const nome = pessoaId ? (visPessoaNome(pessoaId) || null) : (parc ? (visPessoaNome(parc) || null) : null);
  const payload = {
    carteira_id: carteiraId, pessoa_id: pessoaId, nome,
    origem: via, parceiro_id: parc,
    status: 'visitando', gestao_id: cart?.gestao_id || null,
    primeiro_contato: todayISO(), updated_at: new Date().toISOString()
  };
  const { data, error } = await db().from('leads').insert(payload).select('*').single();
  if (error) throw error;
  leadsItems = [...(leadsItems || []), data];
  toast('✅ Lead de ' + (nome || 'contato') + ' criado neste imóvel');
  return data.id;
}
async function salvarVisitaFicha() {
  const data = document.getElementById('fVisData').value;
  if (!data) { toast('⚠️ Preencha a data'); return; }
  const blocos = visBlocks.filter(b => b.carteira_id);
  if (!blocos.length) { toast('⚠️ Selecione ao menos um imóvel'); return; }
  const via = document.getElementById('fVisVia').value;
  // Etapa 2 — quem visitou é obrigatório (senão a visita não teria lead e ficaria órfã)
  if (via === 'parceiro' && !visParceiroId) { toast('⚠️ Selecione o corretor parceiro'); return; }
  if (via !== 'parceiro' && !visCompradorIds.length) { toast('⚠️ Adicione ao menos um comprador'); return; }
  // Etapa 2 — a escolha simples/completo do contato é feita no "+ novo contato"; aqui o lead é
  // garantido em silêncio (ensureLeadForVisita, mais abaixo) e a visita nunca fica órfã.
  const shared = {
    data,
    cliente_tipo: via,
    cliente_ids:  visCompradorIds,
    parceiro_id:  via === 'parceiro' ? (visParceiroId || null) : null,
  };
  // Etapa 2 — soma as etiquetas das pessoas envolvidas (sem duplicar)
  for (const cid of visCompradorIds) await ensureTipo(cid, 'Comprador');
  if (via === 'parceiro' && visParceiroId) await ensureTipo(visParceiroId, 'Corretor');
  let error;
  try {
    if (editVisFichaId) {
      let lid = visLeadId || await ensureLeadForVisita(blocos[0].carteira_id, via);
      const payload = visBlocoPayload(blocos[0], shared); payload.lead_id = lid;
      ({ error } = await db().from('visitas').update(payload).eq('id', editVisFichaId));
    } else {
      const leadObj = (leadsItems || []).find(l => l.id === visLeadId);
      const payloads = [];
      for (const b of blocos) {
        // usa o lead do contexto só se for do mesmo imóvel; senão garante um lead próprio do bloco
        let lid = (visLeadId && (!leadObj || leadObj.carteira_id === b.carteira_id))
          ? visLeadId : await ensureLeadForVisita(b.carteira_id, via);
        const payload = visBlocoPayload(b, shared); payload.lead_id = lid;
        payloads.push(payload);
      }
      ({ error } = await db().from('visitas').insert(payloads));
    }
  } catch (e) { toast('❌ ' + e.message); return; }
  if (error) { toast('❌ ' + error.message); return; }
  blocos.forEach(b => {
    if (b.status === 'realizada' && (b.proximo || '').trim())
      emitirTarefa('Follow-up da visita — ' + visImovelLabel(b.carteira_id) + ': ' + b.proximo.trim(), { carteira_id: b.carteira_id, rotulo: 'Comprador' });
  });
  toast(editVisFichaId ? '✅ Visita atualizada' : (blocos.length > 1 ? '✅ ' + blocos.length + ' visitas registradas' : '✅ Visita registrada'));
  closeVisitaFicha();
  await carregarVisitas();
  await carregarLeads();
  renderLeadsBoard();
  if (document.getElementById('leadFichaOverlay').classList.contains('open') && typeof lfRenderVisitas === 'function') lfRenderVisitas();
  if (carteiraViewId) { const p = carteiraItems.find(x => x.id === carteiraViewId); if (p) renderCarteiraViewBody(p); }
}
async function excluirVisitaFicha() {
  if (!editVisFichaId || !confirm('Excluir esta visita?')) return;
  const { error } = await db().from('visitas').delete().eq('id', editVisFichaId);
  if (error) { toast('❌ ' + error.message); return; }
  toast('🗑️ Visita excluída');
  closeVisitaFicha();
  await carregarVisitas();
  renderLeadsBoard();
  if (document.getElementById('leadFichaOverlay').classList.contains('open') && typeof lfRenderVisitas === 'function') lfRenderVisitas();
  if (carteiraViewId) { const p = carteiraItems.find(x => x.id === carteiraViewId); if (p) renderCarteiraViewBody(p); }
}

// ── Fatia 4c.2 — Lead pendurado no imóvel (tabela `leads`) ─────────────────────
let leadsItems      = [];
let editLeadFichaId = null;
let lfPessoaId   = null;
let lfParceiroId = null;
let lfStatus     = 'novo';
let lfCarteira   = null;
const LEAD_ST = {
  novo:{label:'Novo',cls:'s-novo'}, contatado:{label:'Contatado',cls:'s-contatado'},
  visitando:{label:'Visitando',cls:'s-visitou'}, negociacao:{label:'Em negociação',cls:'s-negociacao'},
  arquivado:{label:'Arquivado',cls:'s-descartado'},
  // status legados (compat de leitura)
  nao_visitou:{label:'Contatado',cls:'s-contatado'}, visitou:{label:'Visitando',cls:'s-visitou'}, descartado:{label:'Arquivado',cls:'s-descartado'}
};
const LEAD_ST_ORDER = ['novo','contatado','visitando','negociacao','arquivado'];
// Colunas do quadro (13.1b) + normalização dos status antigos -> coluna nova
const LEAD_COLS = [
  { key:'novo',       label:'Novo',       dot:'var(--info)',    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>' },
  { key:'contatado',  label:'Contatado',  dot:'var(--accent)',  icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' },
  { key:'visitando',  label:'Visitando',  dot:'var(--warn)',    icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' },
  { key:'negociacao', label:'Negociação', dot:'var(--success)', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>' }
];
function normLeadStatus(s){
  switch(s){
    case 'visitou': case 'visita_agendada': return 'visitando';
    case 'nao_visitou': return 'contatado';       // "não quis visitar" não arquiva
    case 'descartado': return 'arquivado';
    case 'novo': case 'contatado': case 'visitando': case 'negociacao': case 'arquivado': return s;
    default: return 'novo';
  }
}

async function carregarLeads() {
  const { data, error } = await db().from('leads').select('*').order('created_at', { ascending:false });
  if (error) { console.error('leads:', error); return; }
  leadsItems = data || [];
}
function leadNome(l) { return l.nome || visPessoaNome(l.pessoa_id) || '—'; }
function leadNomeDaVisita(v){ if(!v||!v.lead_id) return ''; const l=(leadsItems||[]).find(x=>x.id===v.lead_id); return l?leadNome(l):''; }
function leadsDoImovel(cartId) {
  return (leadsItems||[]).filter(l => l.carteira_id === cartId)
    .sort((a,b) => (b.primeiro_contato||b.created_at||'').localeCompare(a.primeiro_contato||a.created_at||''));
}
function leadVisitasDo(l) {
  // 13.1b: prefere o vínculo direto lead_id; cai pro casamento pessoa+carteira nos registros antigos
  return (visitasItems||[]).filter(v =>
    (v.lead_id && v.lead_id===l.id) ||
    (!v.lead_id && v.carteira_id===l.carteira_id && Array.isArray(v.cliente_ids) && v.cliente_ids.includes(l.pessoa_id)));
}
function leadVisitasCount(l) { return leadVisitasDo(l).length; }
function leadPropostasCount(l) {
  return (typeof fechamentos!=='undefined'?fechamentos:[]).filter(f => f.imovel_id===l.carteira_id && f.comprador_id===l.pessoa_id).length;
}

// ── Bloco compartilhado CRM — Interessados / Visitas / Negociações (item 10.9) ──
// Usado idêntico na ficha da Carteira e na da Gestão Exclusiva. 3 colunas, cada uma
// recolhível na seta (começa aberta). Só visual — não muda dado nem função.
const CRM_LEAD_VARIANT = { novo:'muted', contatado:'accent', visitando:'info', negociacao:'success', arquivado:'danger' };
const CRM_VIS_VARIANT  = { agendada:'accent', realizada:'success', cancelada:'danger' };
const CRM_INT_VARIANT  = { quente:'danger', morno:'accent', frio:'muted' };

function crmLeadRow(l) {
  const st = LEAD_ST[l.status] || LEAD_ST.novo;
  const variant = CRM_LEAD_VARIANT[normLeadStatus(l.status)] || 'muted';
  const nv = leadVisitasCount(l), np = leadPropostasCount(l);
  const meta = [
    l.origem==='parceiro' ? ('Via parceiro' + (l.parceiro_id ? ' · '+visPessoaNome(l.parceiro_id) : '')) : 'Direto',
    nv ? nv+' visita'+(nv!==1?'s':'') : null,
    np ? np+' proposta'+(np!==1?'s':'') : null
  ].filter(Boolean).join(' · ');
  return '<div class="crm-row" onclick="openLeadFicha(\''+l.id+'\')">' +
    '<div class="crm-row-top"><span class="crm-row-name">'+leadNome(l)+'</span>' +
      '<span class="gest-outline-badge '+variant+'">'+st.label+'</span></div>' +
    (meta ? '<div class="crm-row-meta">'+meta+'</div>' : '') +
    (l.feedback ? '<div class="crm-row-note">'+l.feedback+'</div>' : '') +
  '</div>';
}
function crmVisitaRow(v) {
  const st = v.status || 'agendada';
  const stBadge = '<span class="gest-outline-badge '+(CRM_VIS_VARIANT[st]||'muted')+'">'+(VIS_STATUS[st]||st)+'</span>';
  const intBadge = v.resultado ? '<span class="gest-outline-badge '+(CRM_INT_VARIANT[v.resultado]||'muted')+'">'+(VIS_INTERESSE[v.resultado]||v.resultado)+'</span>' : '';
  const nome = visCompradoresLabel(v) || leadNomeDaVisita(v) || '—';
  const parc = v.cliente_tipo === 'parceiro' ? ' <span class="crm-row-dim">(parceiro'+(v.parceiro_id?' · '+visPessoaNome(v.parceiro_id):'')+')</span>' : '';
  const fb = visFeedback(v);
  return '<div class="crm-row" onclick="openVisitaFicha(\''+v.id+'\')">' +
    '<div class="crm-row-top"><span class="crm-row-date">'+visDataFmt(v)+(v.horario?' · '+v.horario:'')+'</span>'+stBadge+intBadge+'</div>' +
    '<div class="crm-row-meta">'+nome+parc+'</div>' +
    (fb ? '<div class="crm-row-note">'+fb+'</div>' : '') +
  '</div>';
}
function crmNegRow(f) {
  return '<div class="crm-row" onclick="openVendasFicha(\''+f.id+'\')">' +
    '<div class="crm-row-top"><span class="gest-outline-badge warn">'+(FECH_ETAPA[f.etapa]||f.etapa||'—')+'</span>' +
      (f.valor_venda ? '<span class="crm-row-val">'+fmtMoeda(f.valor_venda)+'</span>' : '') + '</div>' +
    '<div class="crm-row-meta">'+(f.comprador||'—')+'</div>' +
  '</div>';
}
function crmCol(idBase, iconPath, titulo, count, rowsHtml, emptyMsg) {
  return '<div class="crm-card" id="'+idBase+'">' +
    '<div class="crm-hdr" onclick="document.getElementById(\''+idBase+'\').classList.toggle(\'closed\')">' +
      '<svg class="crm-ic" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+iconPath+'</svg>' +
      '<span class="crm-title">'+titulo+'</span>' +
      '<span class="crm-count">'+count+'</span>' +
      '<svg class="crm-chev" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' +
    '</div>' +
    '<div class="crm-body">'+(count ? rowsHtml : '<div class="crm-empty">'+emptyMsg+'</div>')+'</div>' +
  '</div>';
}
// Barra de ação com os 3 botões primários (Novo lead / Visita / Nova negociação).
function crmActionbarHtml(cartId) {
  const plus = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M12 5v14M5 12h14"/></svg>';
  const btn = (fn, txt) => '<button class="btn btn-primary btn-sm" onclick="'+fn+'">'+plus+txt+'</button>';
  return '<div class="cv-actionbar">' +
    btn("openLeadFicha(null,'"+cartId+"')", 'Novo lead') +
    btn("openVisitaFicha(null,'"+cartId+"')", 'Visita') +
    btn("novaNegociacaoImovel('"+cartId+"')", 'Nova negociação') +
  '</div>';
}
// As 3 colunas (Interessados / Visitas / Negociações). cartId = id do imóvel na carteira.
function crmGridHtml(cartId, opts) {
  opts = opts || {};
  const negTitle = opts.negTitle || 'Negociações';
  const leads   = leadsDoImovel(cartId);
  const visitas = (visitasItems||[]).filter(v => v.carteira_id === cartId)
    .sort((a,b) => (b.data||b.created_at||'').localeCompare(a.data||a.created_at||''));
  const negs    = ((typeof fechamentos!=='undefined'?fechamentos:[])||[]).filter(f => f.imovel_id === cartId);
  const IC_INTER = '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>';
  const IC_VIS   = '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>';
  const IC_NEG   = '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>';
  // Interessados: ativos direto; arquivados agrupados num sub-bloco expansível (começa fechado)
  const ativos     = leads.filter(l => normLeadStatus(l.status) !== 'arquivado');
  const arquivados = leads.filter(l => normLeadStatus(l.status) === 'arquivado');
  const arqHtml = arquivados.length
    ? '<div class="crm-arch closed"><div class="crm-arch-hdr" onclick="this.parentElement.classList.toggle(\'closed\')">' +
        '<svg class="crm-arch-chev" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' +
        'Arquivados (' + arquivados.length + ')</div>' +
        '<div class="crm-arch-body">' + arquivados.map(crmLeadRow).join('') + '</div></div>'
    : '';
  const interBody = ativos.map(crmLeadRow).join('') + arqHtml;
  return '<div class="crm-grid">' +
    crmCol('crmInter', IC_INTER, 'Interessados', leads.length,   interBody,                          'Nenhum interessado.') +
    crmCol('crmVis',   IC_VIS,   'Visitas',      visitas.length, visitas.map(crmVisitaRow).join(''), 'Nenhuma visita.') +
    crmCol('crmNeg',   IC_NEG,   negTitle,       negs.length,    negs.map(crmNegRow).join(''),       'Nenhuma negociação.') +
  '</div>';
}
// Barra + grade juntas (usado onde as duas ficam contíguas, ex.: Gestão).
function crmBlocoHtml(cartId, opts) {
  return crmActionbarHtml(cartId) + crmGridHtml(cartId, opts);
}

function openLeadFicha(id, preCarteiraId, initStatus) {
  carregarPessoas();
  editLeadFichaId = id || null;
  const l = id ? leadsItems.find(x=>x.id===id) : null;
  lfCarteira   = (l?.carteira_id) || preCarteiraId || null;
  lfPessoaId   = l?.pessoa_id || null;
  lfParceiroId = l?.parceiro_id || null;
  lfStatus     = normLeadStatus(l?.status || initStatus || 'novo');
  document.getElementById('lfTitulo').textContent = l ? 'Editar lead' : 'Novo lead';
  // Imóvel: busca por código/rua, editável sempre (lead novo e já criado)
  document.getElementById('fLfImovelBusca').value = '';
  document.getElementById('lfImovelDrop').style.display = 'none';
  setLfImovelDisplay();
  document.getElementById('lfFeedback').value = l?.feedback || '';
  document.getElementById('lfProximo').value  = l?.proximo  || '';
  document.getElementById('fLfPessoaBusca').value = '';
  document.getElementById('lfPessoaDrop').style.display = 'none';
  document.getElementById('lfNovaPessoaBox').style.display = 'none';
  document.getElementById('fLfOrigem').value = l?.origem || 'direto';
  setLfPessoaDisplay();
  setLfParceiroDisplay();
  toggleLfParceiro();
  renderLfStatus();
  document.getElementById('btnLfDel').style.display = l ? '' : 'none';
  // 13.1b: cabeçalho/atividades só na edição; "Dados do lead" recolhe na edição, fica aberto no novo
  const lfEditing = !!l;
  document.getElementById('lfDadosHdr').style.display = lfEditing ? '' : 'none';
  document.getElementById('lfAtividades').style.display = lfEditing ? '' : 'none';
  document.getElementById('btnLfArquivar').style.display = (lfEditing && normLeadStatus(lfStatus)!=='arquivado') ? '' : 'none';
  lfDadosOpen = !lfEditing;
  document.getElementById('lfDadosBody').style.display = lfDadosOpen ? '' : 'none';
  document.getElementById('lfDadosCaret').textContent = lfDadosOpen ? '▾' : '▸';
  const lfP = (pessoasAll||[]).find(x=>x.id===lfPessoaId);
  document.getElementById('lfDadosResumo').textContent = lfP ? ((lfP.tel||'')+(lfP.email?' · '+lfP.email:'')) : '';
  document.getElementById('lfAnotacoes').value = l?.anotacoes || '';
  lfRenderStatusBadge();
  lfRenderVendaBtn();
  lfLoadTarefas(editLeadFichaId);
  lfRenderVisitas();
  document.getElementById('leadFichaOverlay').classList.add('open');
  setTimeout(()=>{ if (window.AlexMasks) AlexMasks.applyMasks(document.getElementById('leadFichaOverlay')); }, 60);
}
function closeLeadFicha(){ document.getElementById('leadFichaOverlay').classList.remove('open'); editLeadFichaId=null; }
function renderLfStatus(){
  // só as 4 etapas ativas; arquivar é pelo botão (com motivo)
  document.getElementById('lfStatusPills').innerHTML = LEAD_COLS.map(c =>
    '<span class="vis-pill '+(normLeadStatus(lfStatus)===c.key?'on '+LEAD_ST[c.key].cls:'')+'" onclick="lfSetStatus(\''+c.key+'\')">'+LEAD_ST[c.key].label+'</span>').join('');
}
function lfSetStatus(s){ lfStatus=s; renderLfStatus(); lfRenderStatusBadge(); lfRenderVendaBtn(); }
// interessado (pessoa única)
function setLfPessoaDisplay(){
  const has=!!lfPessoaId;
  document.getElementById('lfPessoaSel').style.display=has?'flex':'none';
  document.getElementById('fLfPessoaBusca').style.display=has?'none':'';
  if(has) document.getElementById('lfPessoaSelTxt').textContent=visPessoaNome(lfPessoaId)||'—';
  lfRenderWhats();
}
// ── Ficha do lead: WhatsApp, badge, recolhível, arquivar (13.1b) ──
let lfDadosOpen=false;
function lfToggleDados(){ lfDadosOpen=!lfDadosOpen; document.getElementById('lfDadosBody').style.display=lfDadosOpen?'':'none'; document.getElementById('lfDadosCaret').textContent=lfDadosOpen?'▾':'▸'; }
function lfWhatsHref(pessoaId){
  const p=(pessoasAll||[]).find(x=>x.id===pessoaId);
  const digits=((p&&p.tel)||'').replace(/\D/g,'');
  if(!digits) return '';
  return 'https://wa.me/'+(digits.length<=11?'55'+digits:digits);
}
function lfRenderWhats(){
  const a=document.getElementById('lfWhats'); if(!a) return;
  const href=lfPessoaId?lfWhatsHref(lfPessoaId):'';
  if(href){ a.href=href; a.style.display=''; } else { a.removeAttribute('href'); a.style.display='none'; }
}
function lfRenderStatusBadge(){
  const b=document.getElementById('lfStatusBadge'); if(!b) return;
  if(!editLeadFichaId){ b.style.display='none'; return; }
  const st=LEAD_ST[normLeadStatus(lfStatus)]||LEAD_ST.novo;
  b.textContent=st.label; b.className='lead-badge '+st.cls; b.style.display='';
}
// 13.1c — graduação Negociação → Vendas (botão deliberado na ficha)
function leadFechamentoDo(l){
  if(!l) return null;
  return (typeof fechamentos!=='undefined'?fechamentos:[]).find(f=> f.imovel_id===l.carteira_id && f.comprador_id===l.pessoa_id) || null;
}
function lfRenderVendaBtn(){
  const b=document.getElementById('btnLfVenda'); if(!b) return;
  const l=(leadsItems||[]).find(x=>x.id===editLeadFichaId);
  const fe=l?leadFechamentoDo(l):null;
  const mostrar = !!editLeadFichaId && (normLeadStatus(lfStatus)==='negociacao' || !!fe);
  b.style.display = mostrar ? '' : 'none';
  b.textContent = fe ? 'Abrir venda' : 'Iniciar venda';
}
async function lfIniciarVenda(){
  const l=(leadsItems||[]).find(x=>x.id===editLeadFichaId);
  if(!l){ toast('⚠️ Salve o lead primeiro'); return; }
  const fe=leadFechamentoDo(l);
  closeLeadFicha();
  showTab('vendas');
  await openVendasFicha(fe?fe.id:undefined);
  if(!fe){
    if(l.carteira_id && typeof vfSelecionarImovel==='function') vfSelecionarImovel(l.carteira_id, visImovelLabel(l.carteira_id));
    if(l.pessoa_id  && typeof vfSelecionarComprador==='function') vfSelecionarComprador(l.pessoa_id, leadNome(l));
  }
}
const LEAD_MOTIVOS=['Parou de responder','Desistiu','Já comprou outro imóvel','Não gostou da localização','Achou o imóvel pequeno','Comprou com outro corretor','Lead duplicado'];
let lfArqMotivo='';
function lfAbrirArquivar(){
  if(!editLeadFichaId) return;
  lfArqMotivo='';
  const lead=(leadsItems||[]).find(x=>x.id===editLeadFichaId)||{};
  document.getElementById('lfArqNome').textContent=visPessoaNome(lfPessoaId)||leadNome(lead)||'';
  document.getElementById('lfArqObs').value='';
  document.getElementById('lfArqMotivos').innerHTML=LEAD_MOTIVOS.concat(['Outro']).map(m=>'<span class="lf-mot" onclick="lfPickMotivo(this,this.textContent)">'+m+'</span>').join('');
  document.getElementById('lfArqOverlay').classList.add('open');
}
function lfFecharArquivar(){ document.getElementById('lfArqOverlay').classList.remove('open'); }
function lfPickMotivo(el,m){ lfArqMotivo=(m==='Outro')?'':m; document.querySelectorAll('#lfArqMotivos .lf-mot').forEach(x=>x.classList.remove('on')); el.classList.add('on'); }
async function lfConfirmarArquivar(){
  if(!editLeadFichaId) return;
  const obs=document.getElementById('lfArqObs').value.trim();
  const motivo=[lfArqMotivo,obs].filter(Boolean).join(' — ');
  if(!motivo){ toast('⚠️ Escolha um motivo ou escreva a observação'); return; }
  const {error}=await db().from('leads').update({status:'arquivado',motivo_arquivo:motivo,updated_at:new Date().toISOString()}).eq('id',editLeadFichaId);
  if(error){ toast('❌ '+error.message); return; }
  toast('Lead arquivado'); lfFecharArquivar(); closeLeadFicha(); await carregarLeads();
  if(currentTab==='visitas') renderLeadsBoard();
  if(carteiraViewId){const p=carteiraItems.find(x=>x.id===carteiraViewId); if(p) renderCarteiraViewBody(p);}
}
// ── Atividades da ficha: Tarefas (tabela `tarefas`) + Visitas (13.1b) ──
let lfTarefas=[]; let lfTarAdding=false;
async function lfLoadTarefas(leadId){
  lfTarAdding=false;
  if(!leadId){ lfTarefas=[]; lfRenderTarefas(); return; }
  const {data,error}=await db().from('tarefas').select('*').eq('lead_id',leadId).order('feito').order('quando',{ascending:true,nullsFirst:false});
  lfTarefas = error?[]:(data||[]);
  lfRenderTarefas();
}
function lfRenderTarefas(){
  const box=document.getElementById('lfTarefasList'); if(!box) return;
  const rows=(lfTarefas||[]).map(t=>{
    const when = t.quando ? new Date(t.quando).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
    const venc = t.quando && !t.feito && new Date(t.quando) < new Date();
    return '<div class="lf-tar'+(t.feito?' done':'')+'">'+
      '<span class="lf-tar-chk'+(t.feito?' on':'')+'" onclick="lfToggleTarefa(\''+t.id+'\')"></span>'+
      '<div class="lf-tar-body"><div class="lf-tar-txt">'+(t.texto||'').replace(/</g,'&lt;')+'</div>'+
        (when?'<div class="lf-tar-when'+(venc?' venc':'')+'"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'+when+'</div>':'')+'</div>'+
      '<span class="lf-tar-del" title="Excluir" onclick="lfDelTarefa(\''+t.id+'\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></span></div>';
  }).join('');
  const add = lfTarAdding
    ? '<div class="lf-tar-add"><input id="lfTarTexto" placeholder="O que fazer..."><div class="lf-tar-add-row"><input id="lfTarData" type="date"><input id="lfTarHora" type="time"><button type="button" class="btn btn-primary btn-sm" onclick="lfSalvarTarefa()">Salvar</button></div></div>'
    : '';
  box.innerHTML = (rows || (lfTarAdding?'':'<div class="ds-meta" style="font-size:12px">Nenhuma tarefa ainda.</div>')) + add;
  if(lfTarAdding){ const t=document.getElementById('lfTarTexto'); if(t) t.focus(); }
}
function lfNovaTarefa(){ if(!editLeadFichaId){ toast('⚠️ Salve o lead primeiro'); return; } lfTarAdding=true; lfRenderTarefas(); }
async function lfSalvarTarefa(){
  if(!editLeadFichaId) return;
  const texto=(document.getElementById('lfTarTexto').value||'').trim();
  if(!texto){ toast('⚠️ Escreva a tarefa'); return; }
  const data=document.getElementById('lfTarData').value, hora=document.getElementById('lfTarHora').value;
  const quando = data ? new Date(data+'T'+(hora||'09:00')).toISOString() : null;
  const {error}=await db().from('tarefas').insert({lead_id:editLeadFichaId, texto, quando, feito:false});
  if(error){ toast('❌ '+error.message); return; }
  await lfLoadTarefas(editLeadFichaId);
}
async function lfToggleTarefa(id){
  const t=(lfTarefas||[]).find(x=>x.id===id); if(!t) return;
  const {error}=await db().from('tarefas').update({feito:!t.feito, updated_at:new Date().toISOString()}).eq('id',id);
  if(error){ toast('❌ '+error.message); return; }
  t.feito=!t.feito; lfRenderTarefas();
}
async function lfDelTarefa(id){
  const {error}=await db().from('tarefas').delete().eq('id',id);
  if(error){ toast('❌ '+error.message); return; }
  lfTarefas=(lfTarefas||[]).filter(x=>x.id!==id); lfRenderTarefas();
}
function lfRenderVisitas(){
  const box=document.getElementById('lfVisitasList'); if(!box) return;
  const lead=(leadsItems||[]).find(x=>x.id===editLeadFichaId);
  const vs = lead ? leadVisitasDo(lead).slice() : [];
  if(!vs.length){ box.innerHTML='<div class="ds-meta" style="font-size:12px">Nenhuma visita ainda.</div>'; return; }
  vs.sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  box.innerHTML = vs.map(v=>{
    const st=VIS_STATUS[v.status||'agendada']||v.status||'';
    const temp=v.resultado?(' · '+(VIS_INTERESSE[v.resultado]||v.resultado)):'';
    const fb=visFeedback(v).trim();
    return '<div class="lf-vis" onclick="openVisitaFicha(\''+v.id+'\')"><div class="lf-vis-top">'+visDataFmt(v)+(v.horario?' · '+v.horario:'')+' <span class="ds-meta">— '+st+temp+'</span></div>'+
      (fb?'<div class="ds-meta" style="font-size:11.5px">'+fb.replace(/</g,'&lt;')+'</div>':'')+'</div>';
  }).join('');
}
function lfAgendarVisita(){
  if(!editLeadFichaId){ toast('⚠️ Salve o lead primeiro'); return; }
  openVisitaFicha(null, lfCarteira, editLeadFichaId);
  // pré-preenche o comprador com a pessoa do lead (Alex pode adicionar acompanhantes)
  const lead=(leadsItems||[]).find(x=>x.id===editLeadFichaId);
  if(lead){
    if(lead.pessoa_id){ visCompradorIds=[lead.pessoa_id]; renderVisCompradorChips(); }
    document.getElementById('fVisVia').value = lead.origem==='parceiro' ? 'parceiro' : 'direto';
    if(lead.origem==='parceiro' && lead.parceiro_id){ visParceiroId=lead.parceiro_id; setVisParceiroDisplay(); }
    toggleVisParceiro();
  }
}
function lfBuscarPessoa(){
  const q=(document.getElementById('fLfPessoaBusca').value||'').toLowerCase(); const drop=document.getElementById('lfPessoaDrop');
  if(!q){drop.style.display='none';return;}
  const res=(pessoasAll||[]).filter(p=>(p.nome||'').toLowerCase().includes(q)).slice(0,8);
  drop.innerHTML=res.length?res.map(p=>'<div class="vis-drop-item" onmousedown="lfSelPessoa(\''+p.id+'\')">'+p.nome+(p.tel?' <span class="ds-meta">'+p.tel+'</span>':'')+'</div>').join(''):'<div class="vis-drop-empty">Não encontrado — use "+ novo contato"</div>';
  drop.style.display='';
}
function lfSelPessoa(id){ lfPessoaId=id; document.getElementById('lfPessoaDrop').style.display='none'; setLfPessoaDisplay(); }
function lfClearPessoa(){ lfPessoaId=null; setLfPessoaDisplay(); }
// imóvel por busca (código/rua) — editável sempre (13.1b)
function setLfImovelDisplay(){
  const has=!!lfCarteira;
  document.getElementById('lfImovelSelBox').style.display=has?'flex':'none';
  document.getElementById('fLfImovelBusca').style.display=has?'none':'';
  if(has) document.getElementById('lfImovel').textContent=visImovelLabel(lfCarteira);
}
function lfBuscarImovel(){
  const inp=document.getElementById('fLfImovelBusca'), drop=document.getElementById('lfImovelDrop');
  const q=(inp.value||'').toLowerCase().trim();
  if(!q){ drop.style.display='none'; return; }
  const res=(carteiraItems||[]).filter(c=>[c.codigo,c.rua,c.numero,c.complemento,c.bairro].filter(Boolean).join(' ').toLowerCase().includes(q)).slice(0,8);
  drop.innerHTML=res.length
    ? res.map(c=>'<div class="vis-drop-item" onmousedown="lfSelImovel(\''+c.id+'\')">'+(c.codigo?'<b>'+c.codigo+'</b> · ':'')+visImovelLabel(c.id)+'</div>').join('')
    : '<div class="vis-drop-empty">Nenhum imóvel encontrado</div>';
  drop.style.display='';
}
function lfSelImovel(id){ lfCarteira=id; document.getElementById('lfImovelDrop').style.display='none'; document.getElementById('fLfImovelBusca').value=''; setLfImovelDisplay(); }
function lfClearImovel(){ lfCarteira=null; setLfImovelDisplay(); const i=document.getElementById('fLfImovelBusca'); if(i) i.focus(); }
function lfToggleNovaPessoa(){ const el=document.getElementById('lfNovaPessoaBox'); el.style.display=el.style.display==='none'?'':'none'; if(el.style.display!=='none')document.getElementById('fLfNovaNome').focus(); }
async function lfCriarPessoa(){
  const nome=document.getElementById('fLfNovaNome').value.trim(); if(!nome){toast('⚠️ Preencha o nome');return;}
  const tel=document.getElementById('fLfNovaTel').value.trim();
  const {data,error}=await db().from('pessoas').insert({nome,tel:tel||null,tipos:['Comprador'],updated_at:new Date().toISOString()}).select('id,nome,tel,email,tipos').single();
  if(error){toast('❌ '+error.message);return;}
  pessoasAll.push(data); lfSelPessoa(data.id);
  document.getElementById('fLfNovaNome').value=''; document.getElementById('fLfNovaTel').value='';
  document.getElementById('lfNovaPessoaBox').style.display='none'; toast('✅ Contato criado');
}
// origem parceiro
function toggleLfParceiro(){ document.getElementById('lfParceiroBox').style.display=document.getElementById('fLfOrigem').value==='parceiro'?'':'none'; }
function setLfParceiroDisplay(){
  const has=!!lfParceiroId;
  document.getElementById('lfParceiroSel').style.display=has?'flex':'none';
  document.getElementById('fLfParceiroBusca').style.display=has?'none':'';
  if(has) document.getElementById('lfParceiroSelTxt').textContent=visPessoaNome(lfParceiroId)||'—';
}
function lfBuscarParceiro(){
  const q=(document.getElementById('fLfParceiroBusca').value||'').toLowerCase(); const drop=document.getElementById('lfParceiroDrop');
  if(!q){drop.style.display='none';return;}
  const res=(pessoasAll||[]).filter(p=>(p.nome||'').toLowerCase().includes(q)).slice(0,8);
  drop.innerHTML=res.length?res.map(p=>'<div class="vis-drop-item" onmousedown="lfSelParceiro(\''+p.id+'\')">'+p.nome+(p.tel?' <span class="ds-meta">'+p.tel+'</span>':'')+'</div>').join(''):'<div class="vis-drop-empty">Não encontrado</div>';
  drop.style.display='';
}
function lfSelParceiro(id){ lfParceiroId=id; document.getElementById('lfParceiroDrop').style.display='none'; setLfParceiroDisplay(); }
function lfClearParceiro(){ lfParceiroId=null; setLfParceiroDisplay(); }

async function salvarLeadFicha(){
  if(!lfCarteira){ toast('⚠️ Escolha o imóvel'); return; }
  const origem=document.getElementById('fLfOrigem').value;
  // Etapa 2 — origem parceiro: o corretor é o obrigatório e o interessado fica opcional (caso Evelin)
  if(origem==='parceiro'){
    if(!lfParceiroId){ toast('⚠️ Selecione o corretor parceiro'); return; }
  } else if(!lfPessoaId){ toast('⚠️ Selecione o interessado'); return; }
  const cart=(carteiraItems||[]).find(c=>c.id===lfCarteira);
  const proximo=document.getElementById('lfProximo').value.trim();
  const nomeLead = visPessoaNome(lfPessoaId) || (origem==='parceiro' ? visPessoaNome(lfParceiroId) : null) || null;
  const payload={
    carteira_id:lfCarteira, pessoa_id:lfPessoaId||null, nome:nomeLead,
    origem, parceiro_id: origem==='parceiro'?(lfParceiroId||null):null,
    status:lfStatus, feedback:document.getElementById('lfFeedback').value.trim()||null,
    proximo:proximo||null, gestao_id:cart?.gestao_id||null,
    anotacoes:(document.getElementById('lfAnotacoes').value||'').trim()||null, updated_at:new Date().toISOString()
  };
  if(!editLeadFichaId) payload.primeiro_contato = todayISO();   // 13.1b: data de entrada do lead
  let error;
  if(editLeadFichaId) ({error}=await db().from('leads').update(payload).eq('id',editLeadFichaId));
  else ({error}=await db().from('leads').insert(payload));
  if(error){toast('❌ '+error.message);return;}
  // Etapa 2 — soma etiquetas (sem duplicar)
  if(lfPessoaId) await ensureTipo(lfPessoaId, 'Comprador');
  if(origem==='parceiro' && lfParceiroId) await ensureTipo(lfParceiroId, 'Corretor');
  if(proximo) emitirTarefa('Follow-up do lead — '+visImovelLabel(lfCarteira)+': '+proximo, editLeadFichaId ? { lead_id: editLeadFichaId, rotulo: 'Comprador' } : { carteira_id: lfCarteira, rotulo: 'Comprador' });
  toast(editLeadFichaId?'✅ Lead atualizado':'✅ Lead criado');
  closeLeadFicha();
  await carregarLeads();
  if(currentTab==='visitas') renderLeadsBoard();
  if(carteiraViewId){const p=carteiraItems.find(x=>x.id===carteiraViewId); if(p) renderCarteiraViewBody(p);}
}
async function excluirLeadFicha(){
  if(!editLeadFichaId) return;
  const lead=(leadsItems||[]).find(x=>x.id===editLeadFichaId);
  const nVis=lead?leadVisitasDo(lead).length:0;
  const aviso = nVis
    ? (nVis>1
        ? 'Excluir este lead?\n\nAtenção: as '+nVis+' visitas registradas neste lead também serão apagadas.'
        : 'Excluir este lead?\n\nAtenção: a visita registrada neste lead também será apagada.')
    : 'Excluir este lead?';
  if(!confirm(aviso)) return;
  const {error}=await db().from('leads').delete().eq('id',editLeadFichaId);
  if(error){toast('❌ '+error.message);return;}
  toast('🗑️ Lead excluído'); closeLeadFicha(); await carregarLeads();
  if(currentTab==='visitas') renderLeadsBoard();
  if(carteiraViewId){const p=carteiraItems.find(x=>x.id===carteiraViewId); if(p) renderCarteiraViewBody(p);}
}

