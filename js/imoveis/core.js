// core.js — núcleo compartilhado do módulo Imóveis (estado, utils, tabs, init, listas/opções, gerenciador).
// Extraído de imoveis.html em 04/07/2026 (item 12.4). NÃO usar type=module — as funções são globais (onclick).

// ── Galeria de fotos via pasta do Google Drive — compartilhada (Imóveis + Condomínios, redesign 10.4) ──
// Chave de API do Google Cloud (Drive API v3), restrita por domínio/referrer — configurar quando criada.
// Ver _docs/ARQUITETURA.md para o passo a passo de criação.
const DRIVE_API_KEY = 'AIzaSyAnvrgeR46nq74K0rTiQGc0nNHnI9USuJg';
function extrairDriveFolderId(url) {
  const m = (url || '').match(/folders\/([a-zA-Z0-9_-]+)/) || (url || '').match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}
// Busca as imagens de uma pasta pública do Drive (precisa estar compartilhada "Qualquer pessoa com o link").
// Retorna array de URLs prontas pra <img src>, ou [] se der erro (mostra toast do motivo).
async function listarFotosDrivePasta(url) {
  const folderId = extrairDriveFolderId(url);
  if (!folderId) { toast('❌ Link de pasta do Drive inválido'); return []; }
  if (!DRIVE_API_KEY) { toast('⚠️ Chave do Google Drive ainda não configurada — ver ARQUITETURA.md'); return []; }
  try {
    const q = encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,thumbnailLink)&pageSize=200&key=${DRIVE_API_KEY}`);
    const data = await res.json();
    if (data.error) { toast('❌ '+data.error.message); return []; }
    return (data.files || []).map(f => (f.thumbnailLink || '').replace(/=s\d+$/, '=s1600'));
  } catch (e) { toast('❌ Erro ao buscar fotos: '+e.message); return []; }
}

// ── Estado ────────────────────────────────────────────────────────────────────
let imoveis      = [];
let acmItems     = [];
let condominios  = [];
// opcoesImovel (listas editáveis) mudou pra js/listas.js — extração 25/07/2026 (reforma Etapa 0, D-8)
let fechamentos  = [];
let editFechId   = null;
let editId       = null;
let editObs      = [];
let editMarcos   = {};
// Nova Captação — estado de vínculo
let capPessoaId       = null;
let capPropNovo       = null;   // 6.10 — nome digitado p/ criar pessoa nova (null = vinculado/vazio)
let capPropEditOpen   = false;  // 6.10 — painel de dados do proprietário aberto p/ edição
let capCondominioId   = null;
let capCondominioNovo = false;
// Wizard de Captação (2 etapas) — só na criação; edição = tela única
let capMode      = 'novo';   // 'novo' | 'edit'
let capStep      = 1;        // etapa atual no modo 'novo'
let capCondCands = [];       // candidatos de condomínio [{source:'own'|'itbi', id?, nome, bairro, rua, num}]
let capCondIdx   = 0;        // candidato exibido no cartão
let editCondId   = null;
let condFichaId  = null;
let condFichaSim = [];
let perdidoAberto = false;
let currentTab   = 'pipeline';
// ITBI (movido de imoveis.html/acm.js na extração 7, 06/07/2026 — usado por Captação, Condomínios, Carteira e ACM).
let itbiDB           = null;
let itbiDBPromise    = null;

// 4a: 'assinado' deixou de ser coluna do quadro — virou graduação (vira Gestão e sai do quadro).
// O valor 'assinado' segue válido nos dados; cards assinados são filtrados para fora do board.
const STAGES = [
  { id:'prospeccao', label:'Prospecção', icon:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>', color:'#6b7280' },
  { id:'visita1',   label:'1ª Visita',  icon:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', color:'#3b82f6' },
  { id:'acm',       label:'ACM',        icon:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>', color:'#8b5cf6' },
];
const STAGE_MIGRATE = { contato: 'prospeccao', contrato: 'assinado', visita2: 'acm', proposta: 'acm' };
// Prazo esperado por etapa (dias): verde dentro, amarelo no prazo, vermelho passou. 'assinado' = fim, sem prazo.
const STAGE_PRAZO = { prospeccao: 5, visita1: 7, acm: 7 };

// ── Utils ─────────────────────────────────────────────────────────────────────
// Sidebar
(function() {
  const SB_KEY = 'aos_sidebar_collapsed';
  const sb = document.getElementById('sidebar');
  function setSidebar(c) { sb.classList.toggle('collapsed', c); localStorage.setItem(SB_KEY, c ? '1' : '0'); }
  setSidebar(localStorage.getItem(SB_KEY) !== '0');
  document.getElementById('sbToggle').addEventListener('click', () => setSidebar(!sb.classList.contains('collapsed')));
  // clock and theme handlers moved to js/sidebar.js
})();

// ── Capitalização de dados do ITBI (26/07/2026) ───────────────────────────────
// O banco da Prefeitura guarda tudo em CAIXA ALTA ("R DR RENATO PAES DE BARROS").
// Esta função deixa o texto apresentável na tela. É SÓ EXIBIÇÃO — o dado gravado não muda.
// Veio de acm-export.js (era local) e virou helper compartilhado: ACM, Condomínios, Captação e export.
// Regras: expande abreviação de logradouro no começo (R/AV/AL/TV/PC/EST/ROD/LG/VD),
// expande título (DR/DRA/PROF/PROFA/ENG/CEL) e apartamento (AP/APTO/APARTAMENTO),
// mantém em maiúscula qualquer palavra com número ("APTO 51", "2VG", "1DEP") e algarismo romano ("ED. SANDRA II"),
// e deixa conectivos em minúscula ("de", "da", "dos").
const _TITLE_MINOR  = new Set(['de','da','do','das','dos','e','em','a','o','as','os','del','la','las','los']);
const _TITLE_ABBR   = { R:'Rua', RUA:'Rua', AV:'Avenida', AVENIDA:'Avenida', AL:'Alameda', ALAMEDA:'Alameda', TV:'Travessa', TRAVESSA:'Travessa', PC:'Praça', PCA:'Praça', PRACA:'Praça', EST:'Estrada', ROD:'Rodovia', LG:'Largo', LARGO:'Largo', VD:'Viaduto', AP:'Apto', APTO:'Apto', APARTAMENTO:'Apto' };
const _TITLE_TITULO = { DR:'Dr.', DRA:'Dra.', PROF:'Prof.', PROFA:'Profa.', ENG:'Eng.', CEL:'Cel.' };
const _TITLE_ROMAN  = /^(II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)$/;
function titleRua(s) {
  const txt = String(s == null ? '' : s).trim()
    .replace(/\.(?=[A-Za-zÀ-ÿ])/g, '. ')   // "ED.SANDRA" -> "ED. SANDRA"
    .replace(/\s+/g, ' ');
  if (!txt) return '';
  return txt.split(' ').map((w, i) => {
    const bare = w.replace(/\.$/, ''), up = bare.toUpperCase(), dot = w.endsWith('.') ? '.' : '';
    if (/\d/.test(w))              return w.toUpperCase();          // "APTO 51", "2VG", "1DEP"
    if (i === 0 && _TITLE_ABBR[up]) return _TITLE_ABBR[up];         // só no começo: "AL FRANCA" -> "Alameda Franca"
    if (_TITLE_TITULO[up])          return _TITLE_TITULO[up];       // "DR" -> "Dr."
    if (_TITLE_ROMAN.test(up))      return up + dot;                // "II", "IV"
    const low = bare.toLowerCase();
    if (i > 0 && _TITLE_MINOR.has(low)) return low + dot;
    return low.replace(/(^|[^a-zà-ÿ])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase()) + dot;
  }).join(' ');
}

// Nome da rua de um registro do ITBI, pronto pra tela (15.31, 02/08/2026).
// Por que existe: o banco guarda DUAS colunas de rua. `logradouro` é o texto cru da
// Prefeitura, que escreve a mesma rua de jeitos diferentes ("R MIN ALVARO DE SOUZA LIMA"
// e "AV MINISTRO ALVARO DE SOUZA LIMA" são a MESMA avenida). A busca sempre usou
// `logradouro_norm`, então achava as duas juntas — mas a tela mostrava o cru, e a mesma
// rua aparecia com dois nomes na mesma lista, parecendo dado partido.
// `logradouro_fmt` já vem do banco unificado e formatado; o titleRua fica de rede pra
// ACM antigo salvo antes desta data, que não tem a coluna guardada.
function ruaExib(r) {
  return (r && r.logradouro_fmt) || titleRua(r && r.logradouro) || '';
}

const TOAST_ICO = {
  '✅':'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px"><polyline points="20 6 9 17 4 12"/></svg>',
  '❌':'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  '⚠️':'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  '🗑️':'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7a7d82" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>'
};
TOAST_ICO['⚠'] = TOAST_ICO['⚠️']; TOAST_ICO['🗑'] = TOAST_ICO['🗑️'];
function toast(msg, dur = 3000) {
  const t = document.getElementById('toast');
  let icon = '', text = String(msg == null ? '' : msg);
  for (const k in TOAST_ICO) { if (text.indexOf(k) === 0) { icon = TOAST_ICO[k]; text = text.slice(k.length).trim(); break; } }
  t.innerHTML = icon + '<span style="vertical-align:middle">' + text.replace(/</g,'&lt;') + '</span>';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}

function fmtMoeda(v) {
  return 'R$ ' + Number(v||0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtMoneyInt(v) {
  return 'R$ ' + Math.round(Number(v||0)).toLocaleString('pt-BR');
}
function fmtTS(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}
function daysAgo(ds) {
  if (!ds) return 0;
  return Math.floor((Date.now() - new Date(ds).getTime()) / 86400000);
}
// Helpers de data (movidos de imoveis.html na extração 5, 05/07/2026 — nasciam na seção Gestão mas são usados por 18+ seções).
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(s) { if (!s) return '—'; const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : s; }

// ── Tabs ──────────────────────────────────────────────────────────────────────
let _urlDeepLinkPronta = false; // true depois que a URL de entrada (?cond=/?abrir=/?visita=/?lead=) já foi lida e usada
function showTab(tab) {
  currentTab = tab;
  localStorage.setItem('imoveis_tab', tab);
  // Limpa parâmetros de deep-link antigos da URL (cond/abrir/visita/lead) — sem isso, um link tipo
  // "?cond=ID" clicado uma vez ficava preso na barra de endereço e reabria a mesma ficha a cada F5,
  // mesmo depois de trocar de aba pelo menu. Só limpa depois que o deep-link de entrada já rodou
  // (senão apaga o próprio parâmetro antes dele ser lido).
  if (_urlDeepLinkPronta && location.search && location.search !== '?tab=' + tab) {
    history.replaceState(null, '', location.pathname + '?tab=' + tab);
  }
  document.querySelectorAll('.subtab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.subview').forEach(el => el.classList.remove('active'));
  document.getElementById('stab-' + tab).classList.add('active');
  document.getElementById('sv-' + tab).classList.add('active');

  // Barra de localização (topo): tudo dentro de Pandora agora (Cadastros virou subgrupo, 13/07/2026)
  const TAB_TITLES = { garimpo:'Garimpo', pipeline:'Captação', acm:'ACM', condominios:'Condomínios', gestao:'Gestão Exclusiva', carteira:'Imóveis', visitas:'Leads', vendas:'Vendas', kpis:'KPIs' };
  if (window.alexSetCrumb) window.alexSetCrumb('Pandora', TAB_TITLES[tab] || 'Captação');
  document.getElementById('sb-area-pandora')?.classList.add('active');

  // Botão "Novo" contextual
  const btnNovo = document.getElementById('btnNovo');
  if (tab === 'pipeline')    { btnNovo.textContent = '+ Nova Captação';   btnNovo.style.display = ''; }
  if (tab === 'acm')         { btnNovo.style.display = 'none'; }
  if (tab === 'condominios') { btnNovo.textContent = '+ Novo condomínio'; btnNovo.style.display = ''; }
  if (tab === 'gestao')      { btnNovo.textContent = '+ Nova gestão';     btnNovo.style.display = ''; }
  if (tab === 'carteira')    { btnNovo.textContent = '+ Novo imóvel';     btnNovo.style.display = ''; }
  if (tab === 'visitas')     { btnNovo.textContent = '+ Novo lead';       btnNovo.style.display = ''; }
  if (tab === 'vendas')      { btnNovo.textContent = '+ Novo fechamento'; btnNovo.style.display = ''; }
  if (tab === 'kpis')        { btnNovo.style.display = 'none'; }
  if (tab === 'garimpo')     { btnNovo.style.display = 'none'; }

  if (tab === 'garimpo')     renderGarimpo();
  if (tab === 'pipeline')    renderPipeline();
  if (tab === 'acm')         renderACMLista();
  if (tab === 'condominios') renderCondominios();
  if (tab === 'gestao')      { gestaoDetalhId = null; renderGestao(); }
  if (tab === 'carteira')    renderCarteira();
  if (tab === 'visitas')     renderLeadsBoard();
  if (tab === 'vendas')      renderVendas();
  if (tab === 'kpis')        renderKPIs();
  // Sync sidebar subitem
  document.querySelectorAll('.sb-sub[data-tab]').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
}

function onNovoBtnClick() {
  if (currentTab === 'pipeline')    openModal();
  if (currentTab === 'condominios') openCondModal();
  if (currentTab === 'gestao')      openGestaoModal();
  if (currentTab === 'carteira')    openCarteiraFicha();
  if (currentTab === 'visitas')     openNovoLead();
  if (currentTab === 'vendas')      openVendasFicha();
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await initSupabase();
  await Promise.all([
    carregarImoveis().catch(e    => console.error('imoveis:', e)),
    carregarACMs().catch(e       => console.error('acms:', e)),
    carregarCondominios().catch(e=> console.error('condominios:', e)),
    carregarOpcoes().catch(e     => console.error('opcoes:', e)),
    carregarGestao().catch(e     => console.error('gestao:', e)),
    carregarCarteira().catch(e   => console.error('carteira:', e)),
    carregarVisitas().catch(e    => console.error('visitas:', e)),
    carregarLeads().catch(e      => console.error('leads:', e)),
    carregarFechamentos().catch(e=> console.error('fechamentos:', e)),
    db().from('pessoas').select('id,nome,tel').order('nome').then(({data}) => { window._pessoas = data || []; }),
  ]);
  enriquecerImoveis();   // 2b: sobrepõe imóvel da carteira (depois que captação + carteira carregaram)
  const tabSalva = localStorage.getItem('imoveis_tab') || 'pipeline';
  showTab(tabSalva);

  // Deep-link de tarefa: abrir direto numa aba/ficha (?tab=carteira&abrir=ID)
  try {
    const q = new URLSearchParams(location.search);
    const tabQ = q.get('tab'), abrir = q.get('abrir'), visita = q.get('visita'), lead = q.get('lead'), cond = q.get('cond');
    if (tabQ) showTab(tabQ);
    if (abrir) setTimeout(() => { if (typeof openCarteiraFicha === 'function') openCarteiraFicha(abrir); }, 300);
    if (visita) setTimeout(() => { showTab('visitas'); if (typeof openVisitaFicha === 'function') openVisitaFicha(visita); }, 350);
    if (lead) setTimeout(() => { showTab('visitas'); if (typeof openLeadFicha === 'function') openLeadFicha(lead); }, 350);
    if (cond) setTimeout(() => { showTab('condominios'); if (typeof openCondFicha === 'function') openCondFicha(cond); }, 350);
  } catch(e) {}
  setTimeout(() => { _urlDeepLinkPronta = true; }, 500);
}

async function carregarImoveis() {
  const { data, error } = await db().from('imoveis').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  imoveis = data || [];
  enriquecerImoveis();
}

// 2b: o imóvel vive na CARTEIRA (base única). Sobrepõe os campos de imóvel da captação
// a partir do imóvel da carteira ligado (via pipeline_id). Campos de processo ficam na captação.
function enriquecerImoveis() {
  (imoveis || []).forEach(im => {
    const c = (carteiraItems || []).find(x => x.pipeline_id === im.id);
    im._carteiraId = c ? c.id : null;
    if (!c) return;
    if (c.rua           != null) im.rua               = c.rua;
    if (c.numero        != null) im.num               = c.numero;
    if (c.complemento   != null) im.apto              = c.complemento;
    if (c.bairro        != null) im.bairro            = c.bairro;
    if (c.quartos       != null) im.dormitorios       = c.quartos;
    if (c.suites        != null) im.suites            = c.suites;
    if (c.vagas         != null) im.vagas             = c.vagas;
    if (c.area_util     != null) im.area_privativa    = c.area_util;
    if (c.cond_mensal   != null) im.condominio_mensal = c.cond_mensal;
    if (c.matricula_num != null) im.matricula_num     = c.matricula_num;
    if (c.condominio_id != null) im.condominio_id     = c.condominio_id;
    if (c.tipo          != null) im.tipologia         = c.tipo;
  });
}

async function carregarACMs() {
  const { data, error } = await db().from('acms').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  acmItems = data || [];
}

async function carregarCondominios() {
  const { data, error } = await db().from('condominios').select('*').order('nome');
  if (error) { console.error(error); return; }
  condominios = data || [];
}

// ── Listas editáveis (tipologia/conservação/redes/papéis/rótulos) ────────────
// TODO o bloco (carregarOpcoes, opcoesHtml, preencherSelectOpcoes, onOpcaoChange,
// abrirGerenciadorOpcoes etc.) mudou para js/listas.js — extração 25/07/2026
// (reforma Lead+Imobiliárias, Etapa 0, decisão D-8). imoveis.html inclui js/listas.js
// ANTES deste arquivo; as funções continuam globais com os mesmos nomes.

// ── Vendas: carregador (movido de imoveis.html na extração 2, 05/07/2026) ─────
// Chamado pelo init() acima e por vendas.js após salvar/excluir fechamento.
async function carregarFechamentos() {
  const { data, error } = await db().from('fechamentos').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return; }
  fechamentos = data || [];
}

// ── Carteira: estado + carregadores (movidos de imoveis.html na extração 3, 05/07/2026) ──
// Chamados pelo init() acima e por várias áreas (Captação, Gestão, Vendas, Leads).
let carteiraItems = [];
let pessoasAll    = [];
async function carregarCarteira() {
  const { data, error } = await db().from('imoveis_carteira').select('*').order('created_at', { ascending: false });
  if (error) { console.error('carteira:', error); return; }
  carteiraItems = data || [];
}

async function carregarPessoas() {
  if (pessoasAll.length) return;
  const { data } = await db().from('pessoas').select('id,nome,tel,email,tipos').order('nome');
  pessoasAll = data || [];
}

// ── Utilitário: máscara de telefone ──────────────────────────────────────────
function fmtTelInput(el) {
  let v = el.value.replace(/\D/g,'').slice(0,11);
  if (v.length > 10) v = '(' + v.slice(0,2) + ') ' + v.slice(2,7) + '-' + v.slice(7);
  else if (v.length > 6) v = '(' + v.slice(0,2) + ') ' + v.slice(2,6) + '-' + v.slice(6);
  else if (v.length > 2) v = '(' + v.slice(0,2) + ') ' + v.slice(2);
  else if (v.length > 0) v = '(' + v;
  el.value = v;
}

// ── Utilitário: formatação de valores (R$) ───────────────────────────────────
function fmtCurInput(el) {
  // Mantém apenas dígitos e vírgula
  let raw = el.value.replace(/[^\d,]/g, '');
  const parts = raw.split(',');
  let int = parts[0].replace(/^0+/, '') || '0';
  // Separador de milhares
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  el.value = parts.length > 1 ? int + ',' + parts[1].slice(0,2) : int;
}

function parseCur(val) {
  if (!val) return null;
  const num = parseFloat(String(val).replace(/\./g,'').replace(',','.'));
  return isNaN(num) ? null : num;
}

function setCur(id, val) {
  if (val == null || val === '') { document.getElementById(id).value = ''; return; }
  const n = parseFloat(val);
  if (isNaN(n)) { document.getElementById(id).value = ''; return; }
  const [int, dec] = n.toFixed(2).split('.');
  document.getElementById(id).value = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + dec;
}

// ── Utilitário: emitir tarefa ─────────────────────────────────────────────────
// Ponto único de emissão de tarefa da esteira Pandora. Grava na tabela `tarefas`
// (Supabase) → a tarefa aparece no Dashboard, no DIA e no módulo Tarefas. O link
// na tela é derivado do vínculo (carteira_id/lead_id/pessoa_id) pelos renderizadores.
// vinc (opcional): { carteira_id, lead_id, pessoa_id, rotulo }.
// Nasce com data = hoje (sem hora) → cai no grupo "Hoje" dos lembretes.
// Trava anti-duplicata: não recria se já existe tarefa com o mesmo TEXTO (em aberto
// OU concluída). Não filtra por vínculo nem por status:
//  - vínculo: o mesmo follow-up às vezes era emitido ligado ao lead, às vezes à
//    carteira/pessoa — comparar vínculo deixava cópias passarem.
//  - status: marcar a tarefa como concluída e salvar de novo recriava outra.
//  O texto já é específico (inclui imóvel/lead + próximo passo); só recria de fato
//  quando o próximo passo muda (aí o texto muda junto).
async function emitirTarefa(texto, vinc) {
  vinc = vinc || {};
  const carteira_id = vinc.carteira_id || null;
  const lead_id     = vinc.lead_id || null;
  const pessoa_id   = vinc.pessoa_id || null;
  try {
    const { data: jaExiste } = await db().from('tarefas')
      .select('id').eq('texto', texto).limit(1);
    if (jaExiste && jaExiste.length) return;   // já existe (aberta ou concluída) — não duplica

    const quando = new Date(todayISO() + 'T00:00').toISOString();
    const { error } = await db().from('tarefas').insert({
      texto, quando, feito: false,
      rotulo: vinc.rotulo || null,
      carteira_id, lead_id, pessoa_id,
    });
    if (error) toast('⚠️ Não consegui criar a tarefa: ' + error.message);
  } catch (e) { toast('⚠️ Não consegui criar a tarefa: ' + e.message); }
}
function addDiaTask(texto, vinc) { return emitirTarefa(texto, vinc); }

// ═══════════════════════════════════════════════════════════════════════════════
// BALCÃO DO ITBI — o único lugar do Alex OS que conversa com o banco de vendas
// do ITBI no Supabase (a mesma fonte que o site Pandora Data SP já usa).
// Criado em 31/07/2026, Fatia 1 da tarefa "acm-fonte-unica-supabase".
//
// Em português simples: em vez de cada tela montar sua própria consulta e tratar
// erro do seu jeito, todas passam por aqui e recebem SEMPRE as mesmas quatro coisas:
//   1) o que veio          → .linhas / .dados
//   2) quem não respondeu  → .falhas  (com o rótulo pronto pra tela: "Rua X, 758")
//   3) se veio inteiro     → .completo (quem faz conta é obrigado a olhar isso antes
//                            de mostrar média — nunca conta sobre resposta pela metade)
//   4) como refazer só o que faltou → .refazer()  (é o botão "Tentar de novo")
//
// REGRAS DE USO (registradas na Fatia 2, itens 5.3/5.5/5.6/5.7 do QA da Fatia 1):
//   a) .refazer() devolve SÓ o resultado do pedaço refeito (os pedidos que falharam).
//      Quem chama é responsável por juntar esse pedaço com o que já tinha na tela —
//      o balcão não guarda nem devolve de novo o que já tinha dado certo.
//   b) Lista VAZIA de pedidos é válida: devolve { linhas: [], falhas: [], completo: true }
//      — "completo, zero linhas". Não é erro: ninguém pediu nada, nada faltou.
//   c) Pedido null/undefined é ERRO DE PROGRAMAÇÃO e escapa como erro claro (throw),
//      nunca como falha silenciosa — ver a validação no início do itbiSelect/itbiRpc.
//   d) A rua deve chegar MAIÚSCULA E SEM ACENTO (o campo logradouro_norm do banco é
//      assim; rua com acento devolveria vazio em silêncio — a pior falha possível).
//      Por segurança o balcão normaliza de novo com removeAccentsUpper antes de
//      consultar, então passar "Padre João" também funciona — mas o combinado é
//      normalizar na origem, como todas as telas já fazem hoje.
//
// USADO DESDE A FATIA 2 pelo autopreencher de rua e número (C-1, C-2, C-6, C-7).
// As demais consultas (C-3 a C-12) continuam lendo o arquivo baixado até as
// fatias 3 a 6.
// ═══════════════════════════════════════════════════════════════════════════════

// O ano do corte. É o ÚNICO lugar do Alex OS onde esse número está escrito (R-13):
// trocar aqui muda junto o Garimpo, a Captação e o seletor de período do ACM.
//
// Ajuste 15.31 (02/08/2026): até esta data a constante existia mas NÃO era usada em
// lugar nenhum — o corte de 2019 era só intenção. O banco tem 4.310 vendas anteriores a
// 2019 (a mais antiga de 1994): são vendas velhas declaradas com atraso, que vieram
// dentro das planilhas de 2019 em diante. Elas continuam no banco (decisão do Alex —
// esconder é reversível, apagar não), mas ficam fora de tudo que a tela mostra.
// Voltar a mostrá-las = trocar este número aqui E na definição da view ruas_itbi no
// Supabase (a lista de sugestão de ruas, que precisa respeitar o mesmo corte pra não
// sugerir rua que devolve busca vazia). São OS DOIS ÚNICOS lugares — o comentário
// acima dizia "único lugar" e deixou de ser verdade em 02/08/2026.
const ITBI_ANO_MIN = 2019;
// Mesmo corte, na forma que o SQL do arquivo baixado (sql.js) entende. As buscas do
// arquivo montam SQL na mão, então precisam desta cláusula colada no WHERE.
const ITBI_SQL_ANO = 'ano >= ' + ITBI_ANO_MIN;

const ITBI_TABELA    = 'vendas_itbi';
// As 13 colunas que o ACM usa hoje (+ id, que só existe no Supabase e serve para
// identificar linha repetida quando a busca é de vários endereços de uma vez).
// logradouro_fmt entrou em 15.31: é o nome da rua já arrumado pra leitura
// ("Av. Ministro Alvaro de Souza Lima") — ver ruaExib() logo abaixo.
const ITBI_COLS_ACM  = 'id,data_transacao,logradouro,logradouro_fmt,numero,complemento,bairro,referencia,area_construida_m2,valor_transacao,valor_m2,cartorio,matricula,sql,proporcao_transmitida';
// As 9 colunas que a ficha de condomínio usa hoje.
const ITBI_COLS_COND = 'id,data_transacao,logradouro,logradouro_fmt,numero,complemento,bairro,referencia,area_construida_m2,valor_transacao,valor_m2';
const ITBI_PRAZO_MS  = 12000;   // espera máxima: consulta nenhuma fica pendurada na tela
const ITBI_PARALELO  = 4;       // quantas consultas saem ao mesmo tempo (Garimpo com 15 cartões)
// O Supabase devolve NO MÁXIMO 1.000 linhas por resposta — e corta em silêncio, sem
// erro. Resposta que veio exatamente nesse teto pode estar pela metade (ADR D-2).
const ITBI_TETO_RESPOSTA = 1000;
const ITBI_VAGA_PREFIXOS = ['VAGA', 'VG', 'GARAGEM', 'BOX'];

// Vaga pura se descarta por "COMEÇA COM", nunca por "contém" — em 03/06/2026 o
// "contém" escondeu 119.695 apartamentos que tinham vaga junto. Não inverter.
function itbiEhVaga(complemento) {
  const c = (complemento || '').toUpperCase();
  return ITBI_VAGA_PREFIXOS.some(p => c.startsWith(p));
}

// As TRÊS regras de número que o sistema usa hoje (cada família de consulta usa a sua;
// copiar uma para todas mudaria resultado na tela). Este é o único lugar onde elas moram.
//   A — "quase número": casa por texto exato OU pelo valor numérico.
//       "758" acha "758", " 758", "0758", "758.0", "758A", "758-B"; não acha "7580", "1758", "75".
//       Usada em: C-3, C-4, C-5 (as três do ACM).
//   B — "contém": "32" acha "32", "132", "320". Usada em: C-2, C-7, C-8, C-9.
//   C — "igual, cru": só o texto idêntico. Usada em: C-10 e C-11 (Captação).
// Devolve null quando não há número — aí a busca fica só pela rua.
function itbiFiltroNumero(num, regra) {
  const n = String(num == null ? '' : num).trim();
  if (!n) return null;
  const r = String(regra || 'A').toUpperCase();
  if (r === 'C') return { op: 'eq',    valor: n };
  if (r === 'B') return { op: 'ilike', valor: '%' + n + '%' };
  // Regra A. Comparação por PADRÃO DE TEXTO, nunca convertendo texto em número:
  // no banco do Supabase converter "758A" para número derruba a consulta inteira.
  // O padrão é: espaços à esquerda, zeros à esquerda, os dígitos, e então fim do
  // texto ou um caractere que não é dígito.
  if (/^\d+$/.test(n)) return { op: 'match', valor: '^\\s*0*' + String(parseInt(n, 10)) + '([^0-9]|$)' };
  // Número que não é só dígito (ex.: "S/N"): texto igual, sem diferenciar maiúscula.
  return { op: 'imatch', valor: '^\\s*' + n.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$' };
}

// Memória da sessão: consulta idêntica repetida não vai duas vezes ao servidor.
// Só guarda o que DEU CERTO (falha guardada faria o "Tentar de novo" mentir).
// Morre quando a aba fecha; o ITBI muda uma vez por mês, então não há risco de dado velho.
const _itbiMemoria = new Map();
// Consultas em andamento: dois cliques seguidos no mesmo botão viram uma consulta só.
const _itbiEmVoo   = new Map();

function itbiLimparMemoria() { _itbiMemoria.clear(); _itbiEmVoo.clear(); }

function _itbiRotulo(p) {
  if (p.rotulo) return p.rotulo;
  const rua = typeof titleRua === 'function' ? titleRua(p.rua || '') : (p.rua || '');
  return rua + (p.num ? ', ' + p.num : '');
}

function _itbiMotivoDaFalha(e) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'sem-internet';
  const m = String((e && (e.message || e.name)) || '').toLowerCase();
  if (m.includes('abort') || m.includes('prazo')) return 'demorou';
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) return 'sem-resposta';
  return 'erro';
}

// Prazo máximo: se o servidor não responder a tempo, a consulta é cancelada e vira
// falha declarada — nunca uma tela que fica girando para sempre.
function _itbiComPrazo(promessa, cancelar) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { try { cancelar && cancelar(); } catch (_) {} reject(new Error('Prazo esgotado')); }, ITBI_PRAZO_MS);
    promessa.then(r => { clearTimeout(t); resolve(r); }, e => { clearTimeout(t); reject(e); });
  });
}

// Resposta que veio exatamente no teto de 1.000 linhas pode ter sido cortada pelo
// servidor em silêncio (ADR D-2) — quem recebe isso nunca pode dizer "completo".
function _itbiBateuTeto(lista) {
  return Array.isArray(lista) && lista.length >= ITBI_TETO_RESPOSTA;
}

// Uma consulta de lista. Devolve {ok:true, linhas} ou {ok:false, motivo, erro}.
async function _itbiUmaConsulta(p) {
  // Cinto da regra (d) do cabeçalho: a rua entra sempre maiúscula e sem acento —
  // normalizar aqui de novo é barato e evita o "vazio em silêncio" de uma rua acentuada.
  if (p && p.rua) p = Object.assign({}, p, { rua: removeAccentsUpper(p.rua) });
  const chave = 'sel|' + JSON.stringify([p.rua, p.num, p.regraNum, p.bairro, p.dataDe, p.dataAte,
                                         p.colunas, p.limite, p.ordemCampo, p.ordemAsc]);
  if (_itbiMemoria.has(chave)) return { ok: true, linhas: _itbiMemoria.get(chave) };
  if (_itbiEmVoo.has(chave))   return _itbiEmVoo.get(chave);

  const tarefa = (async () => {
    try {
      const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      let q = db().from(ITBI_TABELA).select(p.colunas || ITBI_COLS_ACM);
      // Corte de 2019 (15.31): vale pra TODA consulta que passa por aqui — ACM,
      // autopreencher de rua e de número. Fica antes dos outros filtros de propósito,
      // pra deixar claro que não é opcional nem depende do que a tela pediu.
      q = q.gte('ano', ITBI_ANO_MIN);
      if (p.rua)     q = q.like('logradouro_norm', '%' + p.rua + '%');
      const fn = itbiFiltroNumero(p.num, p.regraNum);
      if (fn)        q = q.filter('numero', fn.op, fn.valor);
      if (p.bairro)  q = q.ilike('bairro', '%' + p.bairro + '%');
      if (p.dataDe)  q = q.gte('data_transacao', p.dataDe);
      if (p.dataAte) q = q.lte('data_transacao', p.dataAte);
      if (p.ordemCampo !== null) q = q.order(p.ordemCampo || 'data_transacao', { ascending: !!p.ordemAsc });
      if (p.limite)  q = q.limit(p.limite);
      if (ctrl && q.abortSignal) q = q.abortSignal(ctrl.signal);
      const { data, error } = await _itbiComPrazo(q, () => ctrl && ctrl.abort());
      if (error) throw new Error(error.message || 'Erro na consulta');
      const linhas = data || [];
      _itbiMemoria.set(chave, linhas);
      return { ok: true, linhas };
    } catch (e) {
      return { ok: false, motivo: _itbiMotivoDaFalha(e), erro: e };
    } finally {
      _itbiEmVoo.delete(chave);
    }
  })();
  _itbiEmVoo.set(chave, tarefa);
  return tarefa;
}

// ── Porta 1 do balcão: consulta de LISTA ────────────────────────────────────────
// pedidos: um objeto ou uma lista deles. Cada pedido:
//   { rotulo, rua, num, regraNum:'A'|'B'|'C', bairro, dataDe, dataAte,
//     colunas, limite, ordemCampo, ordemAsc }
// opcoes (para várias buscas de uma vez, como a busca manual do ACM):
//   { ordenarPor:'data_transacao', desc:true, limiteTotal:300 }
// Cada endereço vai numa consulta própria: assim um endereço pode falhar sozinho,
// com nome e sobrenome, sem derrubar a busca inteira — é isso que permite o aviso
// "faltou a Alameda Casa Branca, 200".
async function itbiSelect(pedidos, opcoes) {
  // Regra (c) do cabeçalho: pedido null é erro de programação e reclama alto, na hora —
  // deixá-lo passar viraria uma consulta sem filtro nenhum ou um erro confuso lá na frente.
  if (pedidos == null) throw new Error('itbiSelect: pedido null/undefined — passe um pedido {rua, num, ...} ou uma lista de pedidos');
  const lista = Array.isArray(pedidos) ? pedidos : [pedidos];
  if (lista.some(x => x == null || typeof x !== 'object'))
    throw new Error('itbiSelect: a lista de pedidos tem um item null/undefined — cada item precisa ser um objeto {rua, num, ...}');
  // Regra (b): lista vazia é válida — o laço abaixo não roda e a resposta sai
  // { linhas: [], falhas: [], completo: true }: "completo, zero linhas".
  const o = opcoes || {};
  let linhas = [];
  const falhas = [], aRefazer = [];
  let bateuTeto = false;   // alguma resposta pode ter vindo cortada no teto do servidor?

  for (let i = 0; i < lista.length; i += ITBI_PARALELO) {
    const lote = lista.slice(i, i + ITBI_PARALELO);
    const res  = await Promise.all(lote.map(p => _itbiUmaConsulta(p)));
    res.forEach((r, k) => {
      const p = lote[k];
      if (r.ok) {
        linhas.push(...r.linhas);
        // Teto do servidor (ADR D-2): se o pedido queria MAIS do que 1.000 linhas
        // (ou não pediu limite) e a resposta veio exatamente no teto, pode ter
        // ficado linha de fora SEM NENHUM ERRO. Aí .completo tem de virar false —
        // é o que impede média errada com cara de certa nas fatias 2 a 6.
        const pediu = p.limite || Infinity;
        if (pediu > ITBI_TETO_RESPOSTA && r.linhas.length >= ITBI_TETO_RESPOSTA) bateuTeto = true;
      }
      else { falhas.push({ rotulo: _itbiRotulo(p), motivo: r.motivo }); aRefazer.push(p); }
    });
  }

  // A mesma venda pode casar com dois endereços digitados — tira repetida pelo id.
  const vistos = new Set(); const unicas = [];
  for (const l of linhas) {
    const k = (l && l.id != null) ? 'id' + l.id : ((l && l.matricula) || '') + ((l && l.data_transacao) || '');
    if (vistos.has(k)) continue;
    vistos.add(k); unicas.push(l);
  }
  linhas = unicas;

  // Junta, ordena e SÓ ENTÃO corta no limite. O descarte de vaga é sempre depois
  // disso, na tela que pediu — inverter mudaria a quantidade que o Alex vê (R-3.3).
  if (o.ordenarPor) {
    const c = o.ordenarPor, sinal = (o.desc === false) ? 1 : -1;
    linhas.sort((a, b) => (String(a[c] || '') < String(b[c] || '') ? sinal : String(a[c] || '') > String(b[c] || '') ? -sinal : 0));
  }
  if (o.limiteTotal) linhas = linhas.slice(0, o.limiteTotal);

  return {
    linhas,
    falhas,
    // Completo = ninguém falhou E nenhuma resposta bateu no teto de 1.000 linhas.
    completo: falhas.length === 0 && !bateuTeto,
    refazer: aRefazer.length ? (() => itbiSelect(aRefazer, o)) : null
  };
}

// ── Porta 2 do balcão: CONTA PRONTA (as três funções que vivem dentro do banco) ──
//   itbi_bairro_top(termo, num)                 → bairro que mais aparece na rua
//   itbi_edificios_top5(termo, num, ano_min)    → 5 edifícios + quantidade + média R$/m²
//   itbi_rua_stats(termo, ano_min)              → quantidade e média R$/m² da rua
// Devolve as mesmas quatro coisas do itbiSelect. Aqui o .refazer() refaz a própria
// chamada inteira (uma conta pronta não tem "pedaço": ou veio, ou não veio).
async function itbiRpc(nome, args, rotulo) {
  // Regra (c) do cabeçalho: chamada sem nome de função é erro de programação — reclama alto.
  if (!nome || typeof nome !== 'string') throw new Error('itbiRpc: informe o nome da função do banco (ex.: itbi_rua_stats)');
  const chave = 'rpc|' + nome + '|' + JSON.stringify(args || {});
  if (_itbiMemoria.has(chave)) {
    const d = _itbiMemoria.get(chave);
    return { dados: d, falhas: [], completo: !_itbiBateuTeto(d), refazer: null };
  }
  if (_itbiEmVoo.has(chave))   return _itbiEmVoo.get(chave);

  const tarefa = (async () => {
    try {
      const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      let q = db().rpc(nome, args || {});
      if (ctrl && q.abortSignal) q = q.abortSignal(ctrl.signal);
      const { data, error } = await _itbiComPrazo(q, () => ctrl && ctrl.abort());
      if (error) throw new Error(error.message || 'Erro na consulta');
      const dados = data || [];
      _itbiMemoria.set(chave, dados);
      // O teto de 1.000 linhas (ADR D-2) vale também para conta pronta que devolva lista.
      return { dados, falhas: [], completo: !_itbiBateuTeto(dados), refazer: null };
    } catch (e) {
      return {
        dados: [],
        falhas: [{ rotulo: rotulo || nome, motivo: _itbiMotivoDaFalha(e) }],
        completo: false,
        refazer: () => itbiRpc(nome, args, rotulo)
      };
    } finally {
      _itbiEmVoo.delete(chave);
    }
  })();
  _itbiEmVoo.set(chave, tarefa);
  return tarefa;
}

// ── MEDIÇÃO TEMPORÁRIA (Fatia 1) — SAI NA FATIA 7 ───────────────────────────────
// Serve só para comparar a velocidade antes × depois da migração. Não muda nada na
// tela: escreve no console do navegador (F12 → Console) linhas como "ITBI M1: 8320 ms".
const _itbiCronometro = {};
function itbiMedirInicio(marca) { _itbiCronometro[marca] = (typeof performance !== 'undefined' ? performance.now() : Date.now()); }
function itbiMedirFim(marca, obs) {
  const t0 = _itbiCronometro[marca];
  if (!t0) return;
  delete _itbiCronometro[marca];
  const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
  console.log('ITBI ' + marca + ': ' + ms + ' ms' + (obs ? ' · ' + obs : ''));
  // Guarda também no navegador, para o Alex não precisar deixar o console aberto:
  // ele usa o sistema normalmente e depois roda itbiMedicoes() uma vez só.
  try {
    const reg = JSON.parse(localStorage.getItem('aos_itbi_medicoes') || '[]');
    reg.push({ marca: marca, ms: ms, obs: obs || '', quando: new Date().toISOString(), via: 'arquivo' });
    localStorage.setItem('aos_itbi_medicoes', JSON.stringify(reg.slice(-200)));
  } catch (e) { /* localStorage cheio ou bloqueado — o console já registrou */ }
}
// Cancela uma medição em andamento SEM registrar nada. É o que o caminho de erro e o
// caso fora do roteiro usam: medição de erro não pode entrar na mediana do "antes"
// (correção pós-QA, 01/08/2026 — problema P-5).
function itbiMedirDescartar(marca) { delete _itbiCronometro[marca]; }
// Mostra o resumo do que foi medido até agora. Uso: abrir o console (F12) e digitar itbiMedicoes()
function itbiMedicoes() {
  let reg = [];
  try { reg = JSON.parse(localStorage.getItem('aos_itbi_medicoes') || '[]'); } catch (e) { reg = []; }
  // Cinto de segurança: se alguma medição de erro ficou gravada por uma versão antiga
  // do sistema, ela não entra na conta (o caminho de erro hoje descarta antes de gravar).
  reg = reg.filter(r => r && r.obs !== 'FALHOU' && r.obs !== '0 resultados');
  if (!reg.length) { console.log('Nenhuma medição registrada ainda — use o ACM e o Garimpo primeiro.'); return []; }
  const marcas = {};
  reg.forEach(r => { (marcas[r.marca + ' · ' + r.via] = marcas[r.marca + ' · ' + r.via] || []).push(r.ms); });
  const linhas = Object.keys(marcas).sort().map(k => {
    const v = marcas[k].slice().sort((a, b) => a - b);
    const mediana = v.length % 2 ? v[(v.length - 1) / 2] : Math.round((v[v.length / 2 - 1] + v[v.length / 2]) / 2);
    return { medida: k, vezes: v.length, mediana_ms: mediana, menor_ms: v[0], maior_ms: v[v.length - 1] };
  });
  console.table(linhas);
  return linhas;
}
// Apaga o que foi medido (usar antes de começar uma rodada limpa de medição).
function itbiMedicoesLimpar() { try { localStorage.removeItem('aos_itbi_medicoes'); } catch (e) {} console.log('Medições apagadas.'); }

// ── ITBI: loader do banco + autocomplete de rua/número (movidos de imoveis.html/acm.js
// na extração 7, 06/07/2026 — usados por Captação, Condomínios, Carteira e ACM) ─────
async function loadITBIdb() {
  if (itbiDB) return itbiDB;
  if (itbiDBPromise) return itbiDBPromise;
  itbiDBPromise = _baixarITBIdb().catch(e => {
    itbiDBPromise = null;
    const statusEl = document.getElementById('acmITBISearchResults');
    if (statusEl) statusEl.innerHTML = '<div style="padding:10px;color:var(--danger);font-size:12px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Falha ao carregar o banco ITBI — verifique a internet e tente de novo</div>';
    throw e;
  });
  return itbiDBPromise;
}
async function _baixarITBIdb() {
  const statusEl = document.getElementById('acmITBISearchResults');
  if (statusEl) statusEl.innerHTML='<div style="padding:10px;color:var(--muted);font-size:12px;display:flex;align-items:center;gap:6px"><div class="spinner" style="width:12px;height:12px;border-width:2px"></div>Carregando banco ITBI (~47MB, apenas uma vez por sessão)...</div>';
  if (!window.SQL) {
    await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
    await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
  }
  const SQL = await initSqlJs({ locateFile: f=>`https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}` });
  if (statusEl) statusEl.innerHTML='<div style="padding:10px;color:var(--muted);font-size:12px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>Baixando banco...</div>';
  // Banco hospedado no Supabase (cofre público "itbi") desde 31/07/2026 — o arquivo saiu do
  // repositório do site em 27/07 e o ACM ficou sem dado. Passo 0 da migração pro Supabase (item 15.7).
  //
  // 07/08/2026 — passou a vir do projeto NOVO (Pandora OS), gerado da base ITBI definitiva.
  // O que muda no conteúdo: nada que o ACM enxergue. Continua sendo o mesmo RECORTE de
  // sempre — só residencial, só de 2019 em diante, as mesmas 16 colunas —, agora com
  // 817.674 vendas em vez de 795.468. O arquivo até encolheu (67 MB contra 71 MB).
  //
  // POR QUE CONTINUA SENDO RECORTE: a base nova tem 2,66 milhões de transações e todos os
  // tipos de imóvel (loja, terreno, galpão). Este arquivo é baixado INTEIRO no navegador a
  // cada sessão; com a base completa passaria de 300 MB e travaria a aba. Quem precisa do
  // comercial (ACM Builder do Pandora OS, market share) consulta o banco, não este arquivo.
  //
  // A partir de agora a rotina mensal republica este arquivo sozinha. Antes disso ninguém
  // republicava: o arquivo do projeto antigo estava parado no conteúdo de 26/07/2026.
  const res = await fetch('https://ijyxkyxovhvifrtfnqvs.supabase.co/storage/v1/object/public/itbi/ITBI_SP_residencial.db.gz');
  if (!res.ok) throw new Error('HTTP '+res.status);
  if (statusEl) statusEl.innerHTML='<div style="padding:10px;color:var(--muted);font-size:12px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Descomprimindo...</div>';
  const buf = await res.arrayBuffer();
  itbiDB = new SQL.Database(window.pako.inflate(new Uint8Array(buf)));
  if (statusEl) statusEl.innerHTML='<div style="padding:10px;color:var(--success);font-size:12px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><polyline points="20 6 9 17 4 12"/></svg>Banco carregado!</div>';
  return itbiDB;
}
function removeAccentsUpper(s) { return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().trim(); }
function setupRuaNumAC(ruaEl, numEl) {
  _applyFieldAC(ruaEl, 'rua', null);
  if (numEl) _applyFieldAC(numEl, 'num', ruaEl);
}
function setupRuaNumACById(ruaId, numId) {
  const r = document.getElementById(ruaId);
  const n = numId ? document.getElementById(numId) : null;
  setupRuaNumAC(r, n);
}
// Ruas já cadastradas localmente (condomínios + captações + carteira) — fallback do autocomplete sem ITBI.
function ruasLocaisFiltradas(valUpper) {
  const m = new Map();
  const push = (rua) => {
    if (!rua) return;
    const norm = removeAccentsUpper(rua);
    if (norm.includes(valUpper) && !m.has(norm)) m.set(norm, ('' + rua).trim());
  };
  (typeof condominios !== 'undefined' ? condominios : []).forEach(c => push(c.rua));
  (typeof imoveis !== 'undefined' ? imoveis : []).forEach(i => push(i.rua));
  (typeof carteiraItems !== 'undefined' ? carteiraItems : []).forEach(c => push(c.rua));
  return Array.from(m.values()).slice(0, 12);
}
// ── Consultas do autopreencher via BALCÃO (Fatia 2, 01/08/2026 — C-1/C-2/C-6/C-7) ──
// Comparação feita antes de escolher o caminho (registrada no 04_ENGENHARIA.md):
//  · RUAS: a função do site `buscar_ruas_itbi` devolve o MESMO resultado da consulta
//    que o Alex OS fazia no arquivo (contém + ordem alfabética; devolve 15, cortamos
//    em 12) — conferido no banco real, 12 de 12 iguais. REUSADA.
//  · NÚMEROS: a função do site `buscar_numeros_itbi` NÃO bate (rua por igual exato,
//    número por "começa com", não-numéricos por último) — devolveria vazio onde hoje
//    aparecem 12 sugestões. Vai por CONSULTA DIRETA com a regra B ("contém"), juntando
//    repetidos e ordenando como número no navegador, como o SQLite fazia.
async function itbiAcRuas(termo) {
  const r = await itbiRpc('buscar_ruas_itbi', { termo: termo }, 'ITBI — sugestão de ruas');
  if (r.falhas.length) return { ok: false, motivo: r.falhas[0].motivo };
  // Ajuste 15.28 (01/08/2026, pós-teste do Alex): a sugestão do ITBI sai FORMATADA com
  // titleRua ("Rua Padre João Manuel"), igual às ruas do cadastro — o MAIÚSCULO cru do
  // banco misturado com as formatadas "parecia sistema mal feito". Ao escolher, o valor
  // entra formatado no campo; buscar com ele funciona porque o balcão renormaliza
  // (regra d do cabeçalho), e a de-duplicação com as ruas locais continua comparando
  // por removeAccentsUpper, que desfaz exatamente esta formatação.
  // Este é o ponto ÚNICO dos dois caminhos (fichas C-1 e painel do ACM C-6).
  // A sugestão de NOME DE EDIFÍCIO da Captação é outra peça e continua crua (decisão 27/07).
  // Cinto do QA (recusa de 01/08): 19 ruas do banco têm ponto colado no nome (ex.:
  // "RUA M.M.D.C.") e o titleRua insere espaço — o texto mudaria e a busca com a
  // sugestão escolhida voltaria vazia em silêncio. Regra: só formata quando desfazer a
  // formatação devolve exatamente o texto original; senão, exibe cru (como hoje).
  return { ok: true, ruas: (r.dados || []).map(x => x && x.logradouro_norm).filter(Boolean)
    .map(v => { const f = titleRua(v); return removeAccentsUpper(f) === v ? f : v; }) };
}
async function itbiAcNumeros(ruaFiltro, termo) {
  // Sem ordenação no servidor de propósito (risco 6.4 do plano: termo curto + ORDER BY
  // estoura o tempo). A ordenação numérica é feita aqui, sobre a lista já sem repetidos.
  // O id vai junto só para a linha não ser confundida com outra na junção do balcão.
  const r = await itbiSelect({ rua: ruaFiltro, num: termo, regraNum: 'B',
                               colunas: 'id,numero', ordemCampo: null,
                               rotulo: 'ITBI — sugestão de números' });
  if (r.falhas.length) return { ok: false, motivo: r.falhas[0].motivo };
  const vistos = new Set(); const nums = [];
  (r.linhas || []).forEach(l => { const n = l && l.numero; if (n == null || vistos.has(n)) return; vistos.add(n); nums.push(n); });
  nums.sort((a, b) => _itbiAcNumOrdem(a) - _itbiAcNumOrdem(b));   // mesma ordem do CAST(numero AS INTEGER)
  return { ok: true, numeros: nums.slice(0, 12) };
}
// Reproduz o CAST(numero AS INTEGER) do SQLite: dígitos do começo valem como número;
// o que não começa com dígito ("S/N") vale 0 e fica no início, como hoje.
function _itbiAcNumOrdem(n) { const m = String(n == null ? '' : n).match(/^\s*(\d+)/); return m ? parseInt(m[1], 10) : 0; }

// Rodapé da lista de sugestões (peça do mockup aprovado, seção 6): o sinal discreto
// de "buscando" e o aviso de falha DENTRO da própria lista. Zero emoji — ícone SVG.
function _itbiAcFootHtml(estado) {
  if (!estado) return '';
  if (estado.buscando) return '<div class="acm-ac-foot"><div class="spinner"></div>Procurando no ITBI...</div>';
  if (!estado.falha) return '';
  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6"/><path d="M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  const msg = estado.falha === 'sem-internet' ? 'Sem internet — o ITBI precisa de conexão.'
            : estado.soCadastro               ? 'Só as ruas do seu cadastro — o ITBI não respondeu.'
            : 'Não deu para consultar o ITBI — verifique a internet.';
  return '<div class="acm-ac-foot">' + svg + msg + '</div>';
}
// Desenha a lista de sugestões. Sem sugestão e sem aviso, a lista simplesmente não
// abre — comportamento de hoje, mantido de propósito (decisão do mockup para o vazio).
function _itbiAcRender(drop, input, rows, estado) {
  // A consulta agora é assíncrona: se a resposta chegar DEPOIS de o Alex já ter saído
  // do campo, a lista não pode reabrir sozinha por cima de outra coisa da tela.
  if (typeof document !== 'undefined' && document.activeElement !== input) { drop.style.display = 'none'; return; }
  const foot = _itbiAcFootHtml(estado);
  if (!rows.length && !foot) { drop.style.display = 'none'; return; }
  drop.innerHTML = rows.map(r => '<div class="acm-ac-item">' + String(r).replace(/</g, '&lt;') + '</div>').join('') + foot;
  drop.querySelectorAll('.acm-ac-item').forEach(el => el.addEventListener('mousedown', e => {
    e.preventDefault(); input.value = el.textContent; drop.style.display = 'none';
    input.dispatchEvent(new Event('change'));
  }));
  drop.style.display = 'block';
}

function _applyFieldAC(input, type, getRuaEl) {
  if (!input || input.parentNode?.className === 'acm-ac-wrap') return;
  const wrap = document.createElement('div'); wrap.className = 'acm-ac-wrap'; wrap.style.flex = input.style.flex||'';
  input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
  const drop = document.createElement('div'); drop.className = 'acm-ac-drop'; drop.style.display = 'none'; wrap.appendChild(drop);
  let _t, _seq = 0;
  input.addEventListener('input', () => {
    clearTimeout(_t);
    const val = removeAccentsUpper(input.value);
    if (val.length < 2) { drop.style.display = 'none'; _seq++; return; }
    _t = setTimeout(async () => {
      const meu = ++_seq;   // se o Alex digitar mais enquanto a consulta viaja, a resposta velha não desenha por cima
      try {
        if (type === 'rua') {
          const locais = ruasLocaisFiltradas(val);               // dados locais — sempre disponíveis, na hora
          _itbiAcRender(drop, input, locais, { buscando: true });
          const r = await itbiAcRuas(val);
          if (meu !== _seq) return;
          let rows = locais.slice();
          if (r.ok) r.ruas.forEach(v => { if (!rows.some(x => removeAccentsUpper(x) === removeAccentsUpper(v))) rows.push(v); });
          rows = rows.slice(0, 12);
          _itbiAcRender(drop, input, rows, r.ok ? null : { falha: r.motivo, soCadastro: locais.length > 0 });
        } else {
          const rua = removeAccentsUpper(getRuaEl?.value || '');
          _itbiAcRender(drop, input, [], { buscando: true });
          // Sem rua preenchida, o próprio texto vira filtro de rua — comportamento de
          // hoje (era o '%'+(rua||val)+'%' da consulta no arquivo), mantido igual.
          const r = await itbiAcNumeros(rua || val, val);
          if (meu !== _seq) return;
          _itbiAcRender(drop, input, r.ok ? r.numeros : [], r.ok ? null : { falha: r.motivo });
        }
      } catch (e) { if (meu === _seq) drop.style.display = 'none'; }
    }, 200);
  });
  input.addEventListener('blur', () => setTimeout(() => drop.style.display = 'none', 200));
}
