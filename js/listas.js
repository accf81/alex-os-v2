// listas.js — listas editáveis do sistema (tabela listas_opcoes) + gerenciador compartilhado.
// Extraído/generalizado de js/imoveis/core.js em 25/07/2026 (reforma Lead+Imobiliárias, Etapa 0, D-8).
// Usado por: imoveis.html (Tipologia/Conservação nos selects) e listas.html (tela Listas do sistema).
// NÃO usar type=module — funções globais (onclick). Depende de: db() (supabase.js), toast() (página),
// SortableJS (reordenação por arrastar — mesma lib do kanban de Leads/Garimpo).

// ── Estado ────────────────────────────────────────────────────────────────────
let opcoesImovel = { tipologia: [], conservacao: [] };  // todas as categorias carregadas de listas_opcoes

// Rótulos amigáveis por categoria (substitui os antigos if hardcoded)
const LISTA_LABELS = {
  conservacao:       { titulo: 'Conservação',           singular: 'conservação' },
  tipologia:         { titulo: 'Tipologias',            singular: 'tipologia' },
  rotulo_tarefa:     { titulo: 'Rótulos de tarefa',     singular: 'rótulo' },
  rede_imobiliaria:  { titulo: 'Redes de imobiliária',  singular: 'rede' },
  papel_imobiliaria: { titulo: 'Papéis na imobiliária', singular: 'papel' },
};
function listaLabel(cat) { return LISTA_LABELS[cat] || { titulo: cat, singular: 'opção' }; }

// ── Ícones SVG do gerenciador (padrão stroke do sistema — zero emoji) ─────────
const OPC_ICO_GRIP   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r=".8"/><circle cx="15" cy="5" r=".8"/><circle cx="9" cy="12" r=".8"/><circle cx="15" cy="12" r=".8"/><circle cx="9" cy="19" r=".8"/><circle cx="15" cy="19" r=".8"/></svg>';
const OPC_ICO_PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const OPC_ICO_TRASH  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
const OPC_ICO_CHECK  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const OPC_ICO_X      = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

// CSS do gerenciador injetado uma vez (componente autossuficiente — vale pro Imóveis e pra tela de Listas)
(function () {
  const css = `
  .opc-grip{width:22px;height:28px;display:inline-flex;align-items:center;justify-content:center;color:var(--muted);cursor:grab;flex-shrink:0;border-radius:5px;transition:.12s}
  .opc-grip:hover{color:var(--text);background:var(--surface3)}
  .opc-grip:active{cursor:grabbing}
  .opc-grip svg{width:14px;height:14px;stroke:currentColor;fill:none}
  .opc-grip.off{opacity:.3;cursor:default;pointer-events:none}
  .opc-row{background:var(--surface2)}
  .opc-row.opc-ghost{opacity:.45;border-style:dashed;border-color:var(--accent-line)}
  .opc-row .opc-ic{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex-shrink:0}
  .opc-row .opc-ic svg{width:15px;height:15px;stroke:currentColor;fill:none}
  .opc-row .opc-ic:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
  .opc-row .opc-del{color:var(--text)}
  .opc-row .opc-del:hover{border-color:rgba(239,68,68,.5)!important;color:var(--danger)!important}
  .opc-save{color:var(--success)!important;border-color:rgba(34,197,94,.4)!important}
  .opc-val-input{flex:1;padding:4px 8px;font-size:13px}
  .opc-confirm{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(239,68,68,.4);border-radius:7px;background:rgba(239,68,68,.06);margin-bottom:5px}
  .opc-confirm .ct{flex:1;font-size:12px}
  .opc-confirm .ct b{color:var(--text)}
  .opc-confirm .cw{color:var(--muted);display:block;font-size:11px;margin-top:1px}
  .opc-empty{font-size:12.5px;color:var(--muted);text-align:center;padding:22px 6px}`;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();

// ── Carregar / consultar ──────────────────────────────────────────────────────
async function carregarOpcoes() {
  const { data, error } = await db().from('listas_opcoes').select('*').eq('ativo', true).order('ordem');
  if (error) { console.error('opcoes:', error); return; }
  const g = { tipologia: [], conservacao: [] };
  (data || []).forEach(o => { (g[o.categoria] = g[o.categoria] || []).push(o); });
  opcoesImovel = g;
}
function opcoesDe(cat) { return (opcoesImovel[cat] || []).map(o => o.valor); }
function escOpc(s) { return ('' + s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escOpcAttr(s) { return escOpc(s).replace(/"/g, '&quot;'); }

// Monta as <option> a partir da lista + sentinela "Nova…". Valor já salvo fora da lista é preservado.
function opcoesHtml(cat, selected) {
  const vals = opcoesDe(cat).slice();
  if (selected && !vals.includes(selected)) vals.unshift(selected);
  const ph   = selected ? '' : '<option value="" selected hidden>—</option>';
  const opts = vals.map(v => '<option' + (v === selected ? ' selected' : '') + '>' + escOpc(v) + '</option>').join('');
  return ph + opts + '<option value="__nova__">＋ Nova…</option>';
}
// Só as <option> da lista (sem placeholder/sentinela) — para selects montados em template.
function opcoesOpts(cat, selected) {
  const vals = opcoesDe(cat).slice();
  if (selected && !vals.includes(selected)) vals.unshift(selected);
  return vals.map(v => '<option' + (v === selected ? ' selected' : '') + '>' + escOpc(v) + '</option>').join('');
}
// Preenche um <select> existente e o marca como gerenciado pela categoria.
function preencherSelectOpcoes(id, cat, selected) {
  const el = document.getElementById(id);
  if (!el) return;
  el.dataset.opcoes = cat;
  el.dataset.prev   = selected || '';
  el.innerHTML = opcoesHtml(cat, selected || '');
}
// Re-renderiza todos os selects de uma categoria preservando o valor atual.
function reRenderOpcoes(cat) {
  document.querySelectorAll('select[data-opcoes="' + cat + '"]').forEach(el => {
    const cur = (el.value && el.value !== '__nova__') ? el.value : (el.dataset.prev || '');
    el.innerHTML = opcoesHtml(cat, cur);
    el.dataset.prev = cur;
  });
}
// onchange dos selects gerenciados: "Nova…" pede o valor, salva e seleciona.
async function onOpcaoChange(el, cat) {
  if (!el) return;
  if (el.value !== '__nova__') { el.dataset.prev = el.value; return; }
  const nome = (prompt('Nova ' + listaLabel(cat).singular + ':') || '').trim();
  if (!nome) { el.value = el.dataset.prev || ''; return; }
  const novo = await adicionarOpcao(cat, nome);
  reRenderOpcoes(cat);
  if (novo) { el.value = novo.valor; el.dataset.prev = novo.valor; }
}
async function adicionarOpcao(cat, valor) {
  const existe = (opcoesImovel[cat] || []).find(o => o.valor.toLowerCase() === valor.toLowerCase());
  if (existe) { toast('⚠️ Já existe na lista'); return existe; }
  const ordem = (opcoesImovel[cat] || []).reduce((m, o) => Math.max(m, o.ordem), 0) + 1;
  const { data, error } = await db().from('listas_opcoes').insert({ categoria: cat, valor, ordem }).select().single();
  if (error) { toast('❌ ' + error.message); return null; }
  await carregarOpcoes();
  return data;
}

// ── Gerenciador (modal opcOverlay): adicionar / renomear inline / excluir inline / arrastar ──
let opcGerCat    = null;
let opcRenId     = null;   // linha em modo renomear
let opcDelId     = null;   // linha em modo confirmação de exclusão
let _opcSortable = null;
let _opcSalvandoOrdem = false;

function abrirGerenciadorOpcoes(cat) {
  opcGerCat = cat; opcRenId = null; opcDelId = null;
  document.getElementById('opcTitulo').textContent = listaLabel(cat).titulo;
  const hint = document.getElementById('opcHint');
  if (hint) hint.textContent = 'Arraste pela alça para mudar a ordem. Ao remover, quem já usa o valor continua com ele.';
  document.getElementById('opcNovo').value = '';
  opcErrLimpar();
  renderOpcLista();
  document.getElementById('opcOverlay').classList.add('open');
}
function fecharGerenciadorOpcoes() {
  document.getElementById('opcOverlay').classList.remove('open');
  if (_opcSortable) { _opcSortable.destroy(); _opcSortable = null; }
  if (opcGerCat) reRenderOpcoes(opcGerCat);
  opcGerCat = null; opcRenId = null; opcDelId = null;
  if (typeof renderListasIndex === 'function') renderListasIndex();  // atualiza contagens na tela de Listas
}
function renderOpcLista() {
  const lista = opcoesImovel[opcGerCat] || [];
  const el = document.getElementById('opcLista');
  if (_opcSortable) { _opcSortable.destroy(); _opcSortable = null; }
  if (!lista.length) {
    el.innerHTML = '<div class="opc-empty">Nenhum item ainda.<br>Use o campo abaixo para adicionar o primeiro.</div>';
    return;
  }
  el.innerHTML = lista.map(o => {
    if (opcDelId === o.id) {
      return '<div class="opc-confirm">' +
        '<div class="ct">Excluir <b>' + escOpc(o.valor) + '</b>?<span class="cw">Quem já usa esse valor continua com ele.</span></div>' +
        '<button class="opc-ic opc-del" title="Confirmar exclusão" onclick="opcExcluirConfirmar(\'' + o.id + '\')">' + OPC_ICO_CHECK + '</button>' +
        '<button class="opc-ic" title="Cancelar" onclick="opcDelId=null;renderOpcLista()">' + OPC_ICO_X + '</button>' +
      '</div>';
    }
    if (opcRenId === o.id) {
      return '<div class="opc-row">' +
        '<span class="opc-grip off">' + OPC_ICO_GRIP + '</span>' +
        '<input class="opc-val-input" id="opcRenInput" value="' + escOpcAttr(o.valor) + '" onkeydown="if(event.key===\'Enter\')opcRenSalvar(\'' + o.id + '\');if(event.key===\'Escape\'){opcRenId=null;renderOpcLista()}">' +
        '<button class="opc-ic opc-save" title="Salvar" onclick="opcRenSalvar(\'' + o.id + '\')">' + OPC_ICO_CHECK + '</button>' +
        '<button class="opc-ic" title="Cancelar" onclick="opcRenId=null;renderOpcLista()">' + OPC_ICO_X + '</button>' +
      '</div>';
    }
    return '<div class="opc-row" data-id="' + o.id + '">' +
      '<span class="opc-grip" title="Arraste para reordenar">' + OPC_ICO_GRIP + '</span>' +
      '<span class="opc-val">' + escOpc(o.valor) + '</span>' +
      '<button class="opc-ic" title="Renomear" onclick="opcRenomear(\'' + o.id + '\')">' + OPC_ICO_PENCIL + '</button>' +
      '<button class="opc-ic opc-del" title="Excluir" onclick="opcExcluir(\'' + o.id + '\')">' + OPC_ICO_TRASH + '</button>' +
    '</div>';
  }).join('');
  if (opcRenId) setTimeout(() => { const i = document.getElementById('opcRenInput'); if (i) { i.focus(); i.select(); } }, 30);
  // Reordenação por arrastar — SortableJS (mesma lib do kanban), grava `ordem` ao soltar.
  if (typeof Sortable !== 'undefined' && !opcRenId && !opcDelId) {
    _opcSortable = new Sortable(el, {
      handle: '.opc-grip', animation: 150, ghostClass: 'opc-ghost',
      onEnd: () => { opcSalvarOrdem(); },
    });
  }
}
async function opcSalvarOrdem() {
  if (_opcSalvandoOrdem) return;
  _opcSalvandoOrdem = true;
  try {
    const cat = opcGerCat;
    const ids = Array.from(document.querySelectorAll('#opcLista .opc-row[data-id]')).map(r => r.dataset.id);
    const lista = opcoesImovel[cat] || [];
    for (let i = 0; i < ids.length; i++) {
      const o = lista.find(x => x.id === ids[i]);
      if (o && o.ordem !== i + 1) {
        const { error } = await db().from('listas_opcoes').update({ ordem: i + 1 }).eq('id', ids[i]);
        if (error) { toast('❌ ' + error.message); break; }
      }
    }
    await carregarOpcoes();
    renderOpcLista();
    toast('✅ Ordem atualizada');
  } finally { _opcSalvandoOrdem = false; }
}
// Aviso de validação junto do campo (padrão do sistema, mockup-aviso-no-campo.html).
// Onde a página ainda não tem o #opcErrAdd, cai no toast (compatibilidade).
// Texto entra por textContent — nunca vira HTML nem código (lição do D-1).
function opcErrLimpar() {
  const inp = document.getElementById('opcNovo'); if (inp) inp.classList.remove('err');
  const box = document.getElementById('opcErrAdd'); if (box) { box.classList.remove('show'); box.innerHTML = ''; }
}
function opcErrMostrar(prefixo, valorDestacado, sufixo) {
  const box = document.getElementById('opcErrAdd');
  if (!box) { toast('⚠️ ' + prefixo + (valorDestacado || '') + (sufixo || '')); return; }
  const inp = document.getElementById('opcNovo'); if (inp) inp.classList.add('err');
  box.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  const sp = document.createElement('span');
  if (prefixo) sp.appendChild(document.createTextNode(prefixo));
  if (valorDestacado) { const b = document.createElement('b'); b.textContent = valorDestacado; sp.appendChild(b); }
  if (sufixo) sp.appendChild(document.createTextNode(sufixo));
  box.appendChild(sp);
  box.classList.add('show');
  if (inp) inp.focus();
  if (box.scrollIntoView) box.scrollIntoView({ block: 'nearest' });
}
async function opcAdd() {
  const v = document.getElementById('opcNovo').value.trim();
  opcErrLimpar();
  if (!v) { opcErrMostrar('Escreva o item para poder adicionar.'); return; }
  const dup = (opcoesImovel[opcGerCat] || []).find(o => o.valor.toLowerCase() === v.toLowerCase());
  if (dup) { opcErrMostrar('', dup.valor, ' já está nesta lista.'); return; }
  const antes = (opcoesImovel[opcGerCat] || []).length;
  await adicionarOpcao(opcGerCat, v);
  document.getElementById('opcNovo').value = '';
  document.getElementById('opcNovo').focus();
  renderOpcLista();
  if ((opcoesImovel[opcGerCat] || []).length > antes) toast('✅ "' + v + '" adicionado');
}
function opcRenomear(id) { opcRenId = id; opcDelId = null; renderOpcLista(); }
async function opcRenSalvar(id) {
  const inp = document.getElementById('opcRenInput');
  const novo = (inp ? inp.value : '').trim();
  const o = (opcoesImovel[opcGerCat] || []).find(x => x.id === id);
  if (!o) return;
  if (!novo) { toast('⚠️ O nome não pode ficar vazio'); return; }
  if (novo === o.valor) { opcRenId = null; renderOpcLista(); return; }
  const dup = (opcoesImovel[opcGerCat] || []).find(x => x.id !== id && x.valor.toLowerCase() === novo.toLowerCase());
  if (dup) { toast('⚠️ Já existe um item com esse nome'); return; }
  const { error } = await db().from('listas_opcoes').update({ valor: novo }).eq('id', id);
  if (error) { toast('❌ ' + error.message); return; }
  opcRenId = null;
  await carregarOpcoes();
  renderOpcLista();
  toast('✅ Renomeado');
}
function opcExcluir(id) { opcDelId = id; opcRenId = null; renderOpcLista(); }
async function opcExcluirConfirmar(id) {
  // soft delete: ativo=false — quem já usa o valor continua com ele
  const { error } = await db().from('listas_opcoes').update({ ativo: false }).eq('id', id);
  if (error) { toast('❌ ' + error.message); return; }
  opcDelId = null;
  await carregarOpcoes();
  renderOpcLista();
  toast('🗑️ Item removido');
}
