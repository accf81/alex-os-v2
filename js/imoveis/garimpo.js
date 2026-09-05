// ── Garimpo — achados dos robôs de captação (Zap/Loft/QuintoAndar) ─────────────
// Kanban (item 14.3, 13/07/2026): 3 colunas Novo → Contatado → Promovido.
// Achados do mesmo prédio entram agrupados num card só (clica pra abrir a lista de unidades).

const GP_ICO = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  owner:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  broker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  dup:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4a2 2 0 0 1 2-2h12"/></svg>',
  up:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  pipe:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  pct:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  clock:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  pin:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  bed:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/></svg>',
  car:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
  area:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
  wa:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>',
  trend:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  floor:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 8.5 12 15 2 8.5 12 2"/><polyline points="2 15.5 12 22 22 15.5"/></svg>',
  bld:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  chev:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  chat:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>',
};
const GP_PORTAL_DOT = { zap: 'gp-dot-zap', loft: 'gp-dot-loft', quintoandar: 'gp-dot-qa' };
const GP_PORTAL_NOME = { zap: 'Zap', loft: 'Loft', quintoandar: 'QuintoAndar' };
const GP_COLUNAS = [
  { status: 'novo',      label: 'Novo',      ico: GP_ICO.search },
  { status: 'contatado', label: 'Contatado', ico: GP_ICO.chat },
];

let gpAchados = [];
let gpFiltro = { anunciante: 'todos', portais: new Set(), soNovos: false };
const gpItbiCache = new Map(); // rua -> {num_vendas, vm2_medio} | null
let gpGruposAbertos = new Set();  // chaves de grupo (edificio+rua) expandidas
let gpUnidadesAbertas = new Set(); // ids de achado mostrando o card completo dentro de um grupo

async function renderGarimpo() {
  const sv = document.getElementById('sv-garimpo');
  sv.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';
  try {
    const { data, error } = await db()
      .from('garimpo_achados')
      .select('*')
      .in('status', ['novo', 'contatado'])
      .order('coletado_em', { ascending: false });
    if (error) throw error;
    gpAchados = data || [];
    gpFiltro.portais = new Set(gpAchados.flatMap(a => (a.fontes || []).map(f => f.portal)));
    gpRender();
  } catch (e) {
    sv.innerHTML = '<div style="padding:20px;color:var(--danger)">Erro ao carregar o Garimpo: ' + e.message + '</div>';
  }
}

function gpRender() {
  const sv = document.getElementById('sv-garimpo');
  const ativos = gpAchados.filter(a => a.status !== 'promovido');
  const novos = gpAchados.filter(a => a.status === 'novo');
  const kpiTotal = novos.length;
  const kpiProp = novos.filter(a => a.tipo_anunciante === 'proprietario').length;
  const kpiCorretor = novos.filter(a => a.tipo_anunciante === 'corretor').length;
  const kpiDup = novos.filter(a => a.possivel_duplicata_de).length;

  gpDesempenho().then(d => {
    const el = document.getElementById('gpDesempenhoRow');
    if (el) el.innerHTML = gpKpiTile(d.promovidos, 'Promovidos', GP_ICO.up)
      + gpKpiTile(d.contatados, 'Contatados', GP_ICO.chat)
      + gpKpiTile(d.descartados, 'Descartados', GP_ICO.dup)
      + gpKpiTile(d.conversao + '%', 'Conversão', GP_ICO.pct);
  });

  const ultimaColeta = gpAchados[0]?.coletado_em ? fmtTS(gpAchados[0].coletado_em) : '—';

  sv.innerHTML = `
    <div class="gp-updated">${GP_ICO.clock} Última coleta: ${ultimaColeta} — ${ativos.length} achados ativos</div>

    <div class="gp-kpi-block">
      <div class="gp-kpi-col">
        <div class="gp-kpi-col-lbl">Achados desta semana</div>
        <div class="gp-kpi-row">
          ${gpKpiTile(kpiTotal, 'Achados', GP_ICO.search)}
          ${gpKpiTile(kpiProp, 'Proprietário', GP_ICO.owner)}
          ${gpKpiTile(kpiCorretor, 'Concorrente', GP_ICO.broker)}
          ${gpKpiTile(kpiDup, 'Duplicata', GP_ICO.dup)}
        </div>
      </div>
      <div class="gp-kpi-divider"></div>
      <div class="gp-kpi-col">
        <div class="gp-kpi-col-lbl">Seu desempenho</div>
        <div class="gp-kpi-row" id="gpDesempenhoRow">
          ${gpKpiTile('—', 'Promovidos', GP_ICO.up)}
          ${gpKpiTile('—', 'Contatados', GP_ICO.chat)}
          ${gpKpiTile('—', 'Descartados', GP_ICO.dup)}
          ${gpKpiTile('—', 'Conversão', GP_ICO.pct)}
        </div>
      </div>
    </div>

    <div class="gp-toolbar">
      <div class="gp-count"><b>${gpListaFiltrada().length}</b> achados no quadro</div>
      <div class="gp-toolbar-divider"></div>
      <div class="gp-chip ${gpFiltro.anunciante==='todos'?'on':''}" data-anunciante="todos">Todos</div>
      <div class="gp-chip ${gpFiltro.anunciante==='proprietario'?'on':''}" data-anunciante="proprietario">${GP_ICO.owner}Proprietário</div>
      <div class="gp-chip ${gpFiltro.anunciante==='corretor'?'on':''}" data-anunciante="corretor">${GP_ICO.broker}Corretor concorrente</div>
      <div class="gp-toolbar-divider"></div>
      ${[...gpFiltro.portais].map(p => `<div class="gp-chip ${gpFiltro.portaisOff?.has(p) ? '' : 'on'}" data-portal="${p}"><i class="gp-dot ${GP_PORTAL_DOT[p]||''}"></i>${GP_PORTAL_NOME[p]||p}</div>`).join('')}
      <div class="gp-toolbar-spacer"></div>
      <div class="gp-chip ${gpFiltro.soNovos?'on':''}" id="gpChipSoNovos">Só novos</div>
    </div>

    <div class="pipeline pipeline-2col" id="gpBoard"></div>
  `;

  sv.querySelectorAll('.gp-chip[data-anunciante]').forEach(el => el.addEventListener('click', () => {
    gpFiltro.anunciante = el.dataset.anunciante;
    gpRender();
  }));
  sv.querySelectorAll('.gp-chip[data-portal]').forEach(el => el.addEventListener('click', () => {
    const p = el.dataset.portal;
    if (gpFiltro.portaisOff?.has(p)) gpFiltro.portaisOff.delete(p);
    else { gpFiltro.portaisOff = gpFiltro.portaisOff || new Set(); gpFiltro.portaisOff.add(p); }
    gpRender();
  }));
  document.getElementById('gpChipSoNovos')?.addEventListener('click', () => {
    gpFiltro.soNovos = !gpFiltro.soNovos;
    gpRender();
  });

  gpRenderBoard();
}

function gpKpiTile(num, lbl, ico) {
  return `<div class="kpi glass compact"><div><div class="kpi-num">${num}</div><div class="kpi-lbl">${lbl}</div></div><div class="kpi-ico">${ico}</div></div>`;
}

async function gpDesempenho() {
  const { data } = await db().from('garimpo_achados').select('status');
  const rows = data || [];
  const promovidos = rows.filter(r => r.status === 'promovido').length;
  const contatados = rows.filter(r => r.status === 'contatado').length;
  const descartados = rows.filter(r => r.status === 'descartado').length;
  const totalHist = rows.length || 1;
  const conversao = Math.round((promovidos / totalHist) * 100);
  return { promovidos, contatados, descartados, conversao };
}

function gpListaFiltrada() {
  return gpAchados.filter(a => {
    if (gpFiltro.anunciante !== 'todos' && a.tipo_anunciante !== gpFiltro.anunciante) return false;
    if (gpFiltro.soNovos && a.status !== 'novo') return false;
    const portais = (a.fontes || []).map(f => f.portal);
    if (gpFiltro.portaisOff && portais.every(p => gpFiltro.portaisOff.has(p))) return false;
    return true;
  });
}

// ── Agrupamento por prédio (edifício + rua) — achados sem edifício ficam soltos ──
function gpAgrupar(lista) {
  const grupos = new Map();
  const soltos = [];
  lista.forEach(a => {
    if (!a.edificio) { soltos.push({ tipo: 'solo', a }); return; }
    const chave = (a.edificio || '').toLowerCase().trim() + '|' + (a.rua || '').toLowerCase().trim();
    if (!grupos.has(chave)) grupos.set(chave, { tipo: 'grupo', chave, edificio: a.edificio, rua: a.rua, bairro: a.bairro, itens: [] });
    grupos.get(chave).itens.push(a);
  });
  const resultado = [];
  grupos.forEach(g => { if (g.itens.length === 1) soltos.push({ tipo: 'solo', a: g.itens[0] }); else resultado.push(g); });
  // Prédios agrupados aparecem primeiro (mais unidades = mais no topo) — sem precisar rolar
  // a lista inteira pra achar um. Dentro de cada grupo, mais recente primeiro.
  resultado.sort((x, y) => y.itens.length - x.itens.length);
  soltos.sort((x, y) => new Date(y.a.coletado_em) - new Date(x.a.coletado_em));
  return [...resultado, ...soltos];
}

function gpRenderBoard() {
  const board = document.getElementById('gpBoard');
  const lista = gpListaFiltrada();
  const countEl = document.querySelector('.gp-count b');
  if (countEl) countEl.textContent = lista.length;

  // Preserva a posição de rolagem de cada coluna — sem isso, abrir/fechar um grupo
  // ou clicar numa ação reconstrói o HTML e a coluna volta pro topo.
  const scrollPos = {};
  board.querySelectorAll('.pipe-col-cards').forEach(el => { scrollPos[el.dataset.status] = el.scrollTop; });

  board.innerHTML = GP_COLUNAS.map(col => {
    const itensColuna = gpAgrupar(lista.filter(a => a.status === col.status));
    const totalAchados = lista.filter(a => a.status === col.status).length;
    return `
    <div class="pipe-col glass" data-status="${col.status}">
      <div class="pipe-col-hdr">
        <div class="pipe-col-ico">${col.ico}</div>
        <div class="pipe-col-label">${col.label}</div>
        <div class="pipe-col-count">${totalAchados}</div>
      </div>
      <div class="pipe-col-cards gp-dnd-target gp-scroll" data-status="${col.status}">
        ${itensColuna.length ? itensColuna.map(it => it.tipo === 'grupo' ? gpGrupoHtml(it) : gpCardWrapHtml(it.a)).join('') : '<div class="gp-empty-col">Nada por aqui.</div>'}
      </div>
    </div>`;
  }).join('');

  board.querySelectorAll('.pipe-col-cards').forEach(el => { if (scrollPos[el.dataset.status]) el.scrollTop = scrollPos[el.dataset.status]; });

  gpAplicarComparacaoItbiEmLotes(lista);
  gpAttachDnD();
}

// Medição temporária da Fatia 1 (sai na Fatia 7) — cinto de segurança: se o navegador
// servir um core.js VELHO do cache, as funções de medição não existem. Medir nunca
// pode derrubar o Garimpo: sem elas, só a medição deixa de acontecer (pós-QA P-2).
function _gpMedir(qual, marca, obs) {
  try {
    if (qual === 'inicio'    && typeof itbiMedirInicio    === 'function') itbiMedirInicio(marca);
    if (qual === 'fim'       && typeof itbiMedirFim       === 'function') itbiMedirFim(marca, obs);
    if (qual === 'descartar' && typeof itbiMedirDescartar === 'function') itbiMedirDescartar(marca);
  } catch (_) { /* medição nunca derruba a tela */ }
}

// Compara com o ITBI aos poucos (8 por vez) — evita disparar centenas de buscas simultâneas
// no banco ITBI (~47MB) assim que a tela abre, que deixava o Garimpo lento pra carregar.
async function gpAplicarComparacaoItbiEmLotes(lista, tamanhoLote = 8) {
  _gpMedir('inicio', 'M3');   // medição temporária da Fatia 1 — sai na Fatia 7
  try {
    for (let i = 0; i < lista.length; i += tamanhoLote) {
      const lote = lista.slice(i, i + tamanhoLote);
      await Promise.all(lote.map(a => gpAplicarComparacaoItbi(a)));
    }
    _gpMedir('fim', 'M3', lista.length + ' cartões');
  } catch (e) {
    _gpMedir('descartar', 'M3');   // erro no meio do lote → medição fora da conta
    throw e;   // o erro segue o caminho que já seguia antes — nada muda além da medição
  }
}

function gpCardWrapHtml(a) {
  return `<div class="gp-dnd-item" draggable="true" data-ids="${a.id}">${gpCardHtml(a)}</div>`;
}

function gpGrupoHtml(g) {
  const aberto = gpGruposAbertos.has(g.chave);
  const ids = g.itens.map(a => a.id).join(',');
  const unidades = g.itens.map(a => {
    if (gpUnidadesAbertas.has(a.id)) {
      return `<div class="gp-unit gp-unit-aberta">${gpCardHtml(a)}<button class="btn btn-ghost btn-sm gp-unit-fechar" onclick="gpFecharUnidade('${a.id}')">Fechar</button></div>`;
    }
    const dd = [a.dormitorios ? a.dormitorios+'d' : null, a.suites ? a.suites+'s' : null].filter(Boolean).join('·');
    const andarTxt = a.andar_min != null ? ((a.andar_max != null && a.andar_max !== a.andar_min) ? `${a.andar_min}º-${a.andar_max}º andar` : `${a.andar_min}º andar`) : '';
    const apto = a.endereco_numero ? '' : ''; // número do prédio já é o mesmo do grupo; sem nº de apto na fonte
    return `<div class="gp-unit" onclick="gpAbrirUnidade('${a.id}')">
      <div class="gp-unit-specs">
        <span>${(a.tipo_imovel||'apartamento').replace(/^./,c=>c.toUpperCase())}</span>
        ${dd ? `<span>${dd}</span>` : ''}
        ${a.vagas ? `<span>${a.vagas}v</span>` : ''}
        ${a.area ? `<span>${a.area}m²</span>` : ''}
        ${andarTxt ? `<span>${andarTxt}</span>` : '<span class="gp-unit-sem-andar">andar não informado</span>'}
      </div>
      <div class="gp-unit-price">${a.preco ? fmtMoneyInt(a.preco) : '—'}</div>
    </div>`;
  }).join('');

  const condId = g.itens[0]?.condominio_id;
  const linkPredioHtml = condId ? `<div class="gp-group-units-hdr"><a href="imoveis.html?tab=condominios&cond=${condId}" onclick="event.stopPropagation()" class="btn btn-ghost btn-sm">${GP_ICO.bld}&nbsp;Ver prédio na base de Condomínios →</a></div>` : '';

  return `
  <div class="card gp-group ${aberto ? 'open' : ''}">
    <div class="gp-group-hdr" draggable="true" data-ids="${ids}" onclick="gpToggleGrupo('${g.chave}')">
      <div class="gp-group-bld">
        ${GP_ICO.bld}
        <div>
          <div class="gp-group-name">${g.edificio}</div>
          <div class="gp-group-sub">${[g.rua, g.bairro, 'São Paulo'].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      <span class="gp-group-count">${g.itens.length} unidades</span>
      <span class="gp-group-chev">${GP_ICO.chev}</span>
    </div>
    ${aberto ? `<div class="gp-group-units">${linkPredioHtml}${unidades}</div>` : ''}
  </div>`;
}

function gpToggleGrupo(chave) {
  if (gpGruposAbertos.has(chave)) gpGruposAbertos.delete(chave); else gpGruposAbertos.add(chave);
  gpRenderBoard();
}
function gpAbrirUnidade(id) { gpUnidadesAbertas.add(id); gpRenderBoard(); }
function gpFecharUnidade(id) { gpUnidadesAbertas.delete(id); gpRenderBoard(); }

function gpCardHtml(a) {
  const isProp = a.tipo_anunciante === 'proprietario';
  const anuncianteLbl = isProp
    ? `<div class="gp-anunciante">${GP_ICO.owner}Proprietário direto${a.anunciante_nome ? ' <span class="nome">· ' + a.anunciante_nome + '</span>' : ''}</div>`
    : `<div class="gp-anunciante corretor">${GP_ICO.broker}Corretor${a.anunciante_nome ? ' <span class="nome">· ' + a.anunciante_nome + '</span>' : ''}</div>`;

  const tel = (a.anunciante_tel || '').replace(/\D/g, '');
  const telLink = tel ? `<a href="https://wa.me/55${tel}" target="_blank" class="cap-badge wa" onclick="event.stopPropagation()">${GP_ICO.wa}${a.anunciante_tel}</a>` : '';
  const portalLinks = (a.fontes || []).map(f =>
    `<a href="${f.url}" target="_blank" class="cap-badge" onclick="event.stopPropagation()"><i class="gp-dot ${GP_PORTAL_DOT[f.portal]||''}"></i>&nbsp;Ver no ${GP_PORTAL_NOME[f.portal]||f.portal}</a>`
  ).join('');

  let statusBadge = '';
  if (a.status === 'contatado') {
    statusBadge = `<span class="cap-badge">Contatado${a.updated_at ? ' em ' + fmtDate(a.updated_at) : ''}</span>`;
  } else if (a.status === 'promovido') {
    statusBadge = `<span class="cap-badge">Na Captação</span>`;
  } else {
    const dias = daysAgo(a.coletado_em);
    statusBadge = dias <= 1 ? `<span class="gp-novo">NOVO</span>` : `<span class="gp-visto">visto há ${dias} dias</span>`;
  }

  const specs = [];
  specs.push(`<span>${(a.tipo_imovel||'apartamento').replace(/^./,c=>c.toUpperCase())}</span>`);
  const dd = [a.dormitorios ? a.dormitorios+'d' : null, a.suites ? a.suites+'s' : null].filter(Boolean).join(' · ');
  if (dd) specs.push(`<span>${GP_ICO.bed}${dd}</span>`);
  if (a.vagas) specs.push(`<span>${GP_ICO.car}${a.vagas}v</span>`);
  if (a.area) specs.push(`<span>${GP_ICO.area}${a.area}m²</span>`);

  // Andar vira parte do endereço (não fica mais na linha de specs) — assim a altura do card
  // não varia entre achados com e sem andar (QuintoAndar costuma ter, Zap quase nunca).
  const andarTxt = a.andar_min != null
    ? ((a.andar_max != null && a.andar_max !== a.andar_min) ? `${a.andar_min}º-${a.andar_max}º andar` : `${a.andar_min}º andar`)
    : null;
  const enderecoRua = [a.rua, a.endereco_numero].filter(Boolean).join(', ') || a.rua || '(endereço não informado)';
  const endereco = enderecoRua + (andarTxt ? ', ' + andarTxt : '') + (a.bairro || a.cidade ? ' — ' + [a.bairro, a.cidade].filter(Boolean).join(', ') : '');
  const bairroLine = a.edificio ? `${GP_ICO.bld}${a.edificio}` : '—';
  const linkPredio = a.condominio_id ? `<a href="imoveis.html?tab=condominios&cond=${a.condominio_id}" onclick="event.stopPropagation()" class="cap-badge gp-cond-badge">${GP_ICO.bld}&nbsp;Ver prédio</a>` : '';

  const alertRow = a.possivel_duplicata_de
    ? `<div class="gp-alert-row"><span class="cap-badge alert">${GP_ICO.dup}Pode ser o mesmo imóvel de outro achado — confirme antes de agir</span></div>`
    : '';

  const acoes = a.status === 'promovido' ? '' : `
    <div class="gp-actions">
      <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();gpDescartar('${a.id}')">Descartar</button>
      <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();gpContatar('${a.id}')" ${a.status==='contatado'?'disabled':''}>Contatado</button>
      <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();gpPromover('${a.id}')">Promover</button>
    </div>`;

  return `
  <div class="gp-card glass ${a.status === 'contatado' ? 'saved' : ''}" data-id="${a.id}">
    <div class="gp-card-hdr">
      <div class="gp-card-hdr-left">
        ${anuncianteLbl}
        <div class="gp-meta">${telLink}${portalLinks}${linkPredio}</div>
      </div>
      ${statusBadge}
    </div>
    ${alertRow}
    <div class="gp-card-body">
      <div class="gp-card-specs">${specs.join('')}</div>
      <div class="gp-card-addr">${GP_ICO.pin}${endereco}</div>
      <div class="gp-price">${a.preco ? fmtMoneyInt(a.preco) : '—'}</div>
      <div class="gp-card-bairro">${bairroLine || '—'}</div>
      <div class="gp-price-m2">${a.preco_m2 ? fmtMoneyInt(a.preco_m2) + '/m²' : ''}</div>
      <div class="gp-region-note-slot" data-rua="${(a.rua||'').replace(/"/g,'')}" data-m2="${a.preco_m2||''}"></div>
    </div>
    ${acoes}
  </div>`;
}

// ── Comparação com o ITBI, ao vivo (mesma base do ACM — não guardamos cópia no banco) ──
async function gpAplicarComparacaoItbi(a) {
  const el = document.querySelector(`.gp-card[data-id="${a.id}"] .gp-region-note-slot`);
  if (!el || !a.rua || !a.preco_m2) return;
  try {
    const stats = await gpItbiRuaStats(a.rua);
    if (!stats) { el.outerHTML = ''; return; }
    const diff = Math.round(((a.preco_m2 - stats.vm2_medio) / stats.vm2_medio) * 100);
    const cls = diff <= 0 ? 'abaixo' : 'acima';
    el.outerHTML = `<div class="gp-region-note ${cls}">${GP_ICO.trend}<span>Rua (ITBI, ${stats.num_vendas} vendas): ${fmtMoneyInt(stats.vm2_medio)}/m² · <b>${Math.abs(diff)}% ${cls}</b></span></div>`;
  } catch (e) {
    el.outerHTML = '';
  }
}
async function gpItbiRuaStats(rua) {
  const key = removeAccentsUpper(rua);
  if (gpItbiCache.has(key)) return gpItbiCache.get(key);
  await loadITBIdb();
  const norm = key.split(/\s+/).filter(w => !['RUA','AVENIDA','ALAMEDA','AV','AL'].includes(w)).join(' ');
  const res = itbiDB.exec(
    `SELECT COUNT(*) as total, ROUND(AVG(valor_m2),0) as vm2_medio FROM vendas WHERE logradouro_norm LIKE '%${norm.replace(/'/g,"''")}%' AND ${ITBI_SQL_ANO}`
  );
  const row = res[0]?.values?.[0];
  const result = (row && row[0] > 0) ? { num_vendas: row[0], vm2_medio: row[1] } : null;
  gpItbiCache.set(key, result);
  return result;
}

// ── Arrastar entre colunas (HTML5 drag and drop nativo) ─────────────────────
function gpAttachDnD() {
  const board = document.getElementById('gpBoard');
  if (!board) return;
  board.querySelectorAll('.gp-dnd-item').forEach(el => {
    el.addEventListener('dragstart', e => {
      e.stopPropagation();
      el.classList.add('gp-dragging');
      e.dataTransfer.setData('text/plain', el.dataset.ids);
    });
    el.addEventListener('dragend', () => el.classList.remove('gp-dragging'));
  });
  board.querySelectorAll('.gp-group-hdr').forEach(hdr => {
    hdr.addEventListener('dragstart', e => {
      e.stopPropagation();
      hdr.closest('.gp-group').classList.add('gp-dragging');
      e.dataTransfer.setData('text/plain', hdr.dataset.ids);
    });
    hdr.addEventListener('dragend', () => hdr.closest('.gp-group')?.classList.remove('gp-dragging'));
  });
  board.querySelectorAll('.gp-dnd-target').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('gp-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('gp-over'));
    col.addEventListener('drop', async e => {
      e.preventDefault();
      col.classList.remove('gp-over');
      const ids = (e.dataTransfer.getData('text/plain') || '').split(',').filter(Boolean);
      const novoStatus = col.dataset.status;
      if (!ids.length) return;
      await gpMoverStatus(ids, novoStatus);
    });
  });
}

async function gpMoverStatus(ids, novoStatus) {
  const { error } = await db().from('garimpo_achados')
    .update({ status: novoStatus, updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) { toast('⚠️ Não consegui mover: ' + error.message); return; }
  ids.forEach(id => {
    const a = gpAchados.find(x => x.id === id);
    if (a) { a.status = novoStatus; a.updated_at = new Date().toISOString(); }
  });
  gpRenderBoard();
}

// ── Ações ────────────────────────────────────────────────────────────────────
async function gpDescartar(id) {
  const { error } = await db().from('garimpo_achados').update({ status: 'descartado', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { toast('⚠️ Não consegui descartar: ' + error.message); return; }
  gpAchados = gpAchados.filter(a => a.id !== id);
  gpRenderBoard();
}
async function gpContatar(id) {
  await gpMoverStatus([id], 'contatado');
}
async function gpPromover(id) {
  const a = gpAchados.find(x => x.id === id);
  if (!a) return;
  if (!confirm('Promover este achado para a Captação? Vai criar um novo card no funil.')) return;
  try {
    const { data: novo, error: errIns } = await db().from('imoveis').insert({
      owner: a.anunciante_nome || (a.tipo_anunciante === 'proprietario' ? 'Proprietário (Garimpo)' : 'A identificar'),
      tel: a.anunciante_tel || null,
      rua: a.rua, num: a.endereco_numero, bairro: a.bairro,
      dormitorios: a.dormitorios, suites: a.suites, vagas: a.vagas,
      area_privativa: a.area, valor_pretendido: a.preco,
      origem: 'garimpo', estagio: 'Prospecção',
    }).select().single();
    if (errIns) throw errIns;
    const { error: errUp } = await db().from('garimpo_achados').update({
      status: 'promovido', imovel_id: novo.id, updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (errUp) throw errUp;
    toast('✅ Promovido para a Captação');
    a.status = 'promovido';
    a.imovel_id = novo.id;
    gpRenderBoard();
  } catch (e) {
    toast('⚠️ Não consegui promover: ' + e.message);
  }
}
