/* ─────────────────────────────────────────────────────────────
   Pandora OS — ACM · casca compartilhada
   Injeta menu lateral, cabeçalho, passos e rodapé em toda tela.
   Cada tela declara só o miolo + os atributos data-* no .app.
   Mudou aqui, muda nas seis telas de uma vez.
   ───────────────────────────────────────────────────────────── */
(function () {
  const PASSOS = [
    { n: 1, lb: 'Imóvel',           href: '01-imovel.html' },
    { n: 2, lb: 'Vendas do prédio', href: '02-vendas-do-predio.html' },
    { n: 3, lb: 'Concorrentes',     href: '03-concorrentes.html' },
    { n: 4, lb: 'Similares',        href: '04-similares.html' },
    { n: 5, lb: 'Revisão',          href: '05-revisao.html' },
    { n: 6, lb: 'Apresentação',     href: '06-apresentacao.html' }
  ];

  const AREAS = [
    ['Painel',     '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'],
    ['Imóveis',    '<path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M10 21v-6h4v6"/>'],
    ['Avaliações', '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>'],
    ['Contatos',   '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>'],
    ['Agenda',     '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'],
    ['Equipe',     '<path d="M17 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/>']
  ];

  const svg = (d, cls) => '<svg viewBox="0 0 24 24"' + (cls ? ' class="' + cls + '"' : '') + '>' + d + '</svg>';

  const app = document.querySelector('.app');
  if (!app) return;

  const atual   = parseInt(app.dataset.passo || '1', 10);
  const imovel  = app.dataset.imovel || 'Rua Cristiano Viana, 279 · Apto 112 · Pinheiros';
  const primario = app.dataset.primario || 'Continuar';
  const extra   = app.dataset.extra || '';           // botão fantasma adicional no rodapé
  const semVoltar = app.dataset.semVoltar === 'sim';

  // ── menu lateral ───────────────────────────────────────────
  const side = document.createElement('aside');
  side.className = 'side';
  side.innerHTML =
    '<div class="brand"><b>Pandora OS</b><span>Gestão imobiliária</span></div>' +
    AREAS.map(([nome, d]) =>
      '<a class="nav-i' + (nome === 'Avaliações' ? ' on' : '') + '">' + svg(d) + nome + '</a>'
    ).join('') +
    '<div class="side-foot">' +
      '<div class="av">' + svg('<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>') + '</div>' +
      '<div class="who"><b>Alex Fontes</b><span>CRECI 12345</span></div>' +
    '</div>';

  // ── cabeçalho + passos ─────────────────────────────────────
  const top = document.createElement('div');
  top.className = 'top';
  top.innerHTML =
    '<div class="imo">' +
      svg('<path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>') +
      '<b>' + imovel + '</b>' +
    '</div>' +
    '<button class="sair">' +
      svg('<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>') +
      'Sair da avaliação</button>';

  const steps = document.createElement('div');
  steps.className = 'steps';
  steps.innerHTML = PASSOS.map(p => {
    const cls = p.n < atual ? 'step done' : (p.n === atual ? 'step now' : 'step');
    const dot = p.n < atual ? svg('<path d="M20 6L9 17l-5-5"/>') : p.n;
    return '<a class="' + cls + '" href="' + p.href + '"><div class="dot">' + dot + '</div><div class="lb">' + p.lb + '</div></a>';
  }).join('');

  // ── rodapé ─────────────────────────────────────────────────
  const anterior = PASSOS[atual - 2];
  const proximo  = PASSOS[atual];
  const foot = document.createElement('div');
  foot.className = 'foot';
  foot.innerHTML =
    (semVoltar
      ? '<span></span>'
      : '<a class="btn btn-ghost"' + (anterior ? ' href="' + anterior.href + '"' : '') + '>' +
        svg('<path d="M19 12H5M11 18l-6-6 6-6"/>') + 'Voltar</a>') +
    '<div style="display:flex;gap:12px;align-items:center;">' +
      (extra ? '<button class="btn">' + extra + '</button>' : '') +
      '<a class="btn btn-primary"' + (proximo ? ' href="' + proximo.href + '"' : '') + '>' + primario +
        svg('<path d="M5 12h14M13 6l6 6-6 6"/>') + '</a>' +
    '</div>';

  // ── montagem ───────────────────────────────────────────────
  // os passos moram DENTRO da barra do topo, entre o endereço e o "sair" — economiza altura
  top.insertBefore(steps, top.lastElementChild);

  const main = document.createElement('div');
  main.className = 'main';
  const wrap = app.querySelector('.wrap');
  main.appendChild(top);
  if (wrap) main.appendChild(wrap);
  main.appendChild(foot);

  app.innerHTML = '';
  app.appendChild(side);
  app.appendChild(main);
})();
