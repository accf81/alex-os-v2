/* ══════════════════════════════════════════════════════════════════════════════
   js/quadro.js — Quadro de Gestão (Kanban) da área IA do Alex OS v2
   ------------------------------------------------------------------------------
   O que é: o quadro de 6 colunas que substituiu a aba Backlog (decisão D-1).
   Base: Esteira/quadro-gestao-kanban/ 01_REQUISITOS · 02_ARQUITETURA · 03_UXUI
         + mockup aprovado Mockups/mockup-quadro-gestao.html

   Quem manda no dado: a coluna `coluna` da tabela `backlog_itens`.
   O banco tem um gatilho (trg_backlog_itens_sync) que, sozinho, mantém o
   `status` (aberto/feito), carimba a data de publicação e liga/desliga o
   relógio do "cutucar". Por isso aqui só se grava `coluna` — nunca as datas.

   ATENÇÃO: arquivo .js externo NÃO é conferido pelo pre-publish-check.js.
   Rodar `node --check js/quadro.js` sempre que mexer aqui (lição L-1).
   ══════════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ── 1. Cadastro de clientes ────────────────────────────────────────────────
     Cliente novo = UMA linha a mais aqui (R-25). Nada de tabela nova.
     A cor é a mesma no chip, na bolinha do cartão, no Histórico e na Caixa. */
  var CLIENTES = [
    { k: 'alexos',      n: 'Alex OS',      c: '#5b8def' },
    { k: 'remax',       n: 'RE/MAX',       c: '#e0653a' },
    { k: 'robos',       n: 'robôs-auto',   c: '#14b8a6' },
    { k: 'pandoradata', n: 'Pandora Data', c: '#a855c7' }
  ];

  /* ── 1b. De quem é um trabalho — CRITÉRIO ÚNICO ────────────────────────────
     Usado por TODO MUNDO (chip, contagem do chip, colunas, contadores do topo,
     relatório). Existir um só critério é o que impede o chip dizer "0" e o
     quadro ao lado mostrar 10 cartões.

     "Compartilhado" hoje é só um sim/não (dívida assumida pelo Arquiteto no
     D-3): o campo não sabe dizer COM QUEM o trabalho é compartilhado. Enquanto
     for assim, compartilhado quer dizer "vale para Alex OS e RE/MAX" — que é o
     que existe de verdade (Due Diligence). Assim um cliente que nunca teve
     trabalho nenhum aparece zerado de verdade, que é a decisão D-3 do Alex.
     No dia em que "compartilhado" virar lista de clientes, muda só aqui. */
  var CLIENTES_COMPARTILHADO = ['alexos', 'remax'];

  function clientesDoItem(it) {
    var donos = [it.projeto];
    if (it.compartilhado === true) {
      CLIENTES_COMPARTILHADO.forEach(function (k) { if (donos.indexOf(k) === -1) donos.push(k); });
    }
    return donos;
  }
  // O trabalho aparece neste filtro?
  function pertence(it, filtro) {
    return filtro === 'todos' || clientesDoItem(it).indexOf(filtro) >= 0;
  }

  /* ── 2. As 6 colunas, na ordem (R-1) ───────────────────────────────────────*/
  var COLUNAS = [
    { k: 'a_fazer',            n: 'A fazer',           i: 'fazer',
      vazio: 'Nada a fazer por aqui.' },
    { k: 'engatilhado',        n: 'Engatilhado',       i: 'engat',
      vazio: 'Nada engatilhado.<br>Entra aqui o que já foi entregue e espera seu OK.' },
    { k: 'em_andamento',       n: 'Em andamento',      i: 'andam',
      vazio: 'Nada rodando agora.' },
    { k: 'aguardando_cliente', n: 'Aguardando cliente', i: 'aguard',
      vazio: 'Ninguém devendo resposta. Ótimo sinal.<br>Quando um trabalho parar esperando outra pessoa, ele fica aqui.' },
    { k: 'em_teste',           n: 'Em teste (você)',   i: 'teste',
      vazio: 'Nada para você testar.' },
    { k: 'publicado',          n: 'Publicado',         i: 'public',
      vazio: 'Nenhuma entrega nos últimos 30 dias.' }
  ];

  /* ── 3. Números que mandam na regra (um lugar só — R-21) ───────────────────*/
  var DIAS_CUTUCAR = 5;    // a partir daqui o cartão vira alerta de cobrança
  var DIAS_RECENTE = 30;   // corte da coluna Publicado
  var MAX_POR_GAVETA = 10; // cartões mostrados de cara dentro de uma gaveta

  var AGENTES = ['Requisitos', 'Arquiteto', 'UX/UI', 'Engenheiro', 'QA'];

  var PRIO_GRUPOS = [
    { k: 'ALTA',   label: 'Alta',             badge: 'badge-red' },
    { k: 'MEDIA',  label: 'Média',            badge: 'badge-yellow' },
    { k: 'BAIXA',  label: 'Baixa',            badge: 'badge-gray' },
    { k: 'FUTURO', label: 'Futuro',           badge: 'badge-orange' },
    { k: '_OP',    label: 'Fila operacional', badge: 'badge-gray' },
    { k: '_OUTROS', label: 'Outros',          badge: 'badge-gray' }  // salva-vidas: prioridade estranha nunca some
  ];
  var PRIO_LABEL = { ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa', FUTURO: 'Futuro' };

  /* ── 4. Ícones (SVG no padrão do sistema — zero emoji, R-15) ───────────────*/
  function S(d, w) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
      (w || '1.8') + '" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  }
  var ICO = {
    fazer:   S('<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><line x1="4" y1="6" x2="4.01" y2="6"/><line x1="4" y1="12" x2="4.01" y2="12"/><line x1="4" y1="18" x2="4.01" y2="18"/>'),
    engat:   S('<path d="M6 4l12 8-12 8V4z"/>'),
    andam:   S('<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.5 4.5V10h-5.5"/>'),
    aguard:  S('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>'),
    teste:   S('<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M9 10.5l2 2 4-4"/>'),
    public:  S('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.3l2.4 2.4 4.6-5"/>'),
    chev:    S('<path d="M9 5l7 7-7 7"/>', '2.2'),
    chevd:   S('<path d="M5 9l7 7 7-7"/>', '2.2'),
    alerta:  S('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13.5"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    relogio: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>'),
    busca:   S('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.2" y2="16.2"/>'),
    mover:   S('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    mais:    S('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    check:   S('<path d="M20 6L9 17l-5-5"/>', '2.4'),
    x:       S('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', '2.2'),
    user:    S('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    pausa:   S('<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5M12 16h.01"/>'),
    quadro:  S('<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>'),
    lista:   S('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3.5" y1="6" x2="3.51" y2="6"/><line x1="3.5" y1="12" x2="3.51" y2="12"/><line x1="3.5" y1="18" x2="3.51" y2="18"/>'),
    compart: S('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>'),
    lixo:    S('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>'),
    doc:     S('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
    info:    S('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4.5M12 8h.01"/>')
  };

  /* ── 5. Utilidades ─────────────────────────────────────────────────────────*/
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function cliente(k) {
    for (var i = 0; i < CLIENTES.length; i++) if (CLIENTES[i].k === k) return CLIENTES[i];
    return { k: k || '?', n: k || 'sem cliente', c: '#8a9099' };
  }
  function coluna(k) {
    for (var i = 0; i < COLUNAS.length; i++) if (COLUNAS[i].k === k) return COLUNAS[i];
    return COLUNAS[0];
  }
  // 'AAAA-MM-DD' → Date local à meia-noite (evita o pulo de fuso do new Date(string))
  function dataLocal(s) {
    if (!s) return null;
    var p = String(s).slice(0, 10).split('-');
    if (p.length !== 3) return null;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  function hoje0() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  // Dias corridos desde a entrada em "Aguardando cliente". Nunca NaN, nunca negativo (CA-22).
  function diasEspera(it) {
    var d = dataLocal(it.aguardando_desde);
    if (!d) return 0;
    var n = Math.floor((hoje0().getTime() - d.getTime()) / 86400000);
    return n > 0 ? n : 0;
  }
  function dataCurta(s) { // '2026-07-24' → '24/jul'
    var d = dataLocal(s);
    if (!d) return '';
    return d.getDate() + '/' + d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  }
  function dataBR(s) {
    var d = dataLocal(s);
    return d ? d.toLocaleDateString('pt-BR') : '';
  }
  function grupoPrio(it) {
    if (!it.prioridade) return '_OP';
    if (PRIO_LABEL[it.prioridade]) return it.prioridade;
    return '_OUTROS';
  }

  /* ── 6. Estado de tela (nada disso vai para o banco) ───────────────────────*/
  var ctx = null;                    // ligações com a projetos.html (ver init)
  var salvando = {};                 // id → true enquanto grava (trava do duplo arrasto, R-37)
  var falhas   = {};                 // id → {destino, colunaOrigem} quando a gravação falhou
  var gavetasAbertas = {};           // prioridade → true
  var gavetasExpandidas = {};        // prioridade → true (mostrar além do MAX_POR_GAVETA)
  var publicadoAntigos = false;      // "ver concluídos anteriores"
  var recemCriados = {};             // id → true (fica no alto da coluna durante a visita)
  var arrastando = null;             // id do cartão sendo arrastado
  var scrollCols = {};               // lugar da página (não perder o ponto ao repintar)
  var gravandoJanela = false;        // trava de clique repetido em Criar/Salvar/Excluir (R-37)

  /* ── 7. Ligação com a página ───────────────────────────────────────────────*/
  function init(o) {
    ctx = o;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { fecharPop(); fecharModais(); }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.q-pop') && !e.target.closest('.q-move')) fecharPop();
    });
    // a lista "mover para" flutua presa à tela: rolar ou mudar o tamanho da janela fecha
    window.addEventListener('scroll', fecharPop, true);
    window.addEventListener('resize', fecharPop);
  }
  function itens() { return ctx.getItens(); }
  function acha(id) {
    var a = itens();
    for (var i = 0; i < a.length; i++) if (String(a[i].id) === String(id)) return a[i];
    return null;
  }
  function estado() { return ctx.getEstado(); }

  /* ══════════════════════════════════════════════════════════════════════════
     8. O CARTÃO (T-5)
     ══════════════════════════════════════════════════════════════════════════ */
  function trilhoHTML(t) {
    if (t === 'rapido')   return '<span class="q-trilho rap">Rápido</span>';
    if (t === 'completo') return '<span class="q-trilho com">Completo</span>';
    return '<span class="q-trilho def">Trilho a definir</span>';
  }
  function cardHTML(it) {
    var cli = cliente(it.projeto);
    var col = it.coluna;
    var cls = '';
    var salv = !!salvando[it.id];
    var falha = falhas[it.id];
    var dias = col === 'aguardando_cliente' ? diasEspera(it) : null;
    var vencido = dias !== null && dias >= DIAS_CUTUCAR;

    if (salv) cls += ' saving';
    if (falha) cls += ' failed';
    if (vencido) cls += ' vencido';

    var h = '<div class="q-card' + cls + '" draggable="true" data-id="' + esc(it.id) + '">';
    h += '<div class="q-move" title="Mover para outra coluna">' + ICO.mover + '</div>';
    h += '<div class="t">' + esc(it.titulo || '(sem título)') + '</div>';
    h += '<div class="meta"><i style="background:' + cli.c + '"></i>' + esc(cli.n) +
         (it.item_id ? ' · ' + esc(it.item_id) : '') + '</div>';
    h += '<div class="meta">' + trilhoHTML(it.trilho) +
         (it.compartilhado ? '<span class="q-compart">' + ICO.compart + 'Compart.</span>' : '') + '</div>';

    if (col === 'em_andamento' && it.agente_atual)
      h += '<div class="q-agente">' + ICO.user + esc(it.agente_atual) + '</div>';

    if (col === 'engatilhado')
      h += '<div class="q-espera">' + ICO.pausa + '<span>' +
           esc(it.espera_nota || 'aguardando seu OK para seguir') + '</span></div>';

    if (dias !== null) {
      h += '<div class="q-dias' + (vencido ? ' alerta' : '') + '">' +
           (vencido ? ICO.alerta : ICO.relogio) +
           (vencido ? dias + ' dias — hora de cobrar'
                    : dias + (dias === 1 ? ' dia' : ' dias') + ' — cutucar em ' + DIAS_CUTUCAR) +
           '</div>';
    }
    if (col === 'em_teste')
      h += '<div class="q-dias">' + ICO.teste + 'testar no Chrome</div>';

    if (col === 'publicado')
      h += '<div class="q-ok">' + ICO.check + 'no ar · ' +
           (it.concluido_em ? esc(dataCurta(it.concluido_em)) : 'sem data') + '</div>';

    if (salv)  h += '<div class="q-saving"><span class="spinner"></span>gravando…</div>';
    if (falha) h += '<div class="q-fail">' + ICO.alerta + '<span>Não foi salvo — o cartão voltou para <b>' +
                    esc(coluna(falha.origem).n) + '</b>. <u data-retry="' + esc(it.id) + '">Tentar de novo</u></span></div>';
    return h + '</div>';
  }

  /* ══════════════════════════════════════════════════════════════════════════
     9. AS COLUNAS
     ══════════════════════════════════════════════════════════════════════════ */
  function vazioHTML(txt) { return '<div class="q-empty">' + txt + '</div>'; }

  function colunaHTML(col, inner, count, extra) {
    return '<div class="q-col" data-col="' + col.k + '">' +
      '<div class="q-colh">' + ICO[col.i] + '<span class="n">' + esc(col.n) + '</span>' +
      (extra || '') + '<span class="c">' + count + '</span></div>' +
      '<div class="q-cards" data-col="' + col.k + '">' + inner + '</div></div>';
  }

  // Coluna "A fazer" — gavetas por prioridade, fechadas (T-4, o problema central)
  function colunaAFazerHTML(lista) {
    var busca = estado().busca;
    var h = '';

    var novos = lista.filter(function (it) { return recemCriados[it.id]; });
    if (novos.length) {
      h += '<div class="q-area">Recém-criados</div>' + novos.map(cardHTML).join('');
    }
    var resto = lista.filter(function (it) { return !recemCriados[it.id]; });

    if (!resto.length && !novos.length) {
      if (busca) {
        return '<div class="q-empty q-empty-busca">Nenhum trabalho com <b>"' + esc(busca) +
          '"</b>.<br><br>Tente outra palavra ou <b>limpe a busca</b> para ver as gavetas de novo.</div>';
      }
      return vazioHTML('Nada em "A fazer" com este filtro.');
    }

    var grupos = PRIO_GRUPOS.map(function (g) {
      return { g: g, itens: resto.filter(function (it) { return grupoPrio(it) === g.k; }) };
    }).filter(function (x) { return x.itens.length > 0; });

    if (grupos.length > 1)
      h += '<div class="q-hint">' + ICO.info +
        '<span>Gavetas por prioridade. Clique para abrir; a busca do topo abre sozinha as que tiverem resultado.</span></div>';

    grupos.forEach(function (x) {
      var aberta = busca ? true : !!gavetasAbertas[x.g.k];
      h += '<div class="q-grp' + (aberta ? ' open' : '') + '" data-grp="' + x.g.k + '">' +
        '<div class="q-grph">' + ICO.chev.replace('<svg', '<svg class="chev"') +
        '<span class="lbl badge ' + x.g.badge + '">' + esc(x.g.label) + '</span>' +
        '<span class="cnt">' + x.itens.length + '</span></div><div class="q-grpb">';
      if (aberta) {
        var mostrar = x.itens;
        var sobra = 0;
        if (!gavetasExpandidas[x.g.k] && x.itens.length > MAX_POR_GAVETA) {
          mostrar = x.itens.slice(0, MAX_POR_GAVETA);
          sobra = x.itens.length - MAX_POR_GAVETA;
        }
        var areas = [];
        mostrar.forEach(function (it) {
          var a = it.area || 'Sem área';
          if (areas.indexOf(a) === -1) areas.push(a);
        });
        areas.forEach(function (a) {
          h += '<div class="q-area">' + esc(a) + '</div>';
          h += mostrar.filter(function (it) { return (it.area || 'Sem área') === a; }).map(cardHTML).join('');
        });
        if (sobra) h += '<div class="q-mais" data-expandir="' + x.g.k + '">mostrar mais ' + sobra + '</div>';
        else if (gavetasExpandidas[x.g.k] && x.itens.length > MAX_POR_GAVETA)
          h += '<div class="q-mais" data-expandir="' + x.g.k + '">mostrar menos</div>';
      }
      h += '</div></div>';
    });
    return h;
  }

  // Coluna "Publicado" — só os últimos 30 dias por padrão (T-7)
  function colunaPublicadoHTML(lista) {
    var corte = hoje0(); corte.setDate(corte.getDate() - DIAS_RECENTE);
    var recentes = [], antigos = [];
    lista.forEach(function (it) {
      var d = dataLocal(it.concluido_em);
      if (d && d.getTime() >= corte.getTime()) recentes.push(it); else antigos.push(it);
    });
    var ord = function (a, b) { return String(b.concluido_em || '').localeCompare(String(a.concluido_em || '')); };
    recentes.sort(ord); antigos.sort(ord);

    var h = recentes.length ? recentes.map(cardHTML).join('')
                            : vazioHTML('Nenhuma entrega nos últimos ' + DIAS_RECENTE + ' dias.');
    if (antigos.length) {
      if (publicadoAntigos) {
        h += '<div class="q-area">Anteriores a ' + DIAS_RECENTE + ' dias</div>' + antigos.map(cardHTML).join('');
        h += '<div class="q-mais" data-antigos="1">Ocultar anteriores</div>';
      } else {
        h += '<div class="q-mais" data-antigos="1">Ver concluídos anteriores (' + antigos.length + ')</div>';
      }
    }
    return { html: h, visiveis: recentes.length + (publicadoAntigos ? antigos.length : 0) };
  }

  /* ══════════════════════════════════════════════════════════════════════════
     10. DESENHO GERAL
     ══════════════════════════════════════════════════════════════════════════ */
  /* Quem rola é a PÁGINA (a coluna não tem rolagem por dentro — decisão de
     13/07 da _docs/ARQUITETURA.md, confirmada pelo teste do Alex em 28/07).
     Como repintar o quadro troca o conteúdo inteiro, guardamos o lugar da
     página antes e devolvemos depois: abrir uma gaveta não pode jogar o Alex
     de volta para o alto da tela. O elemento que rola no Alex OS é a `.page`. */
  function caixaDeRolagem() {
    return document.querySelector('.page') || document.scrollingElement || null;
  }
  function guardaScroll() {
    var c = caixaDeRolagem();
    scrollCols.pagina = c ? c.scrollTop : 0;
  }
  function devolveScroll() {
    var c = caixaDeRolagem();
    if (!c || !scrollCols.pagina) return;
    var max = c.scrollHeight - c.clientHeight;             // a página pode ter encolhido
    c.scrollTop = Math.min(scrollCols.pagina, max > 0 ? max : 0);
  }

  function visiveis() { return itens().filter(ctx.passa); }

  function render() {
    var root = ctx.root();
    if (!root) return;
    guardaScroll();
    if (estado().modo === 'lista') { root.innerHTML = listaHTML(); ligarEventos(); return; }

    var lista = visiveis();
    var h = '';

    // Cliente escolhido sem nenhum trabalho: informação, não erro (D-3).
    // UMA mensagem só — as 6 colunas continuam visíveis, mas caladas: repetir
    // "Nada a fazer / Nada engatilhado / …" seis vezes vira parede de texto.
    var st = estado();
    var clienteZerado = false;
    if (st.projeto !== 'todos') {
      var totalCliente = itens().filter(function (it) { return pertence(it, st.projeto); }).length;
      if (!totalCliente) {
        clienteZerado = true;
        h += '<div class="zero-nota">' + ICO.info + '<span>Nada cadastrado ainda em <b>' +
          esc(cliente(st.projeto).n) + '</b>. Faz um tempo que esse projeto não anda — é justamente para isso que ele fica na barra.</span>' +
          '<button class="btn btn-primary btn-sm" data-novo="1">' + ICO.mais + 'Criar o primeiro trabalho</button></div>';
      }
    }

    h += '<div class="q-board">';
    COLUNAS.forEach(function (col) {
      var doCol = lista.filter(function (it) { return it.coluna === col.k; });
      var inner, count = doCol.length, extra = '';

      if (clienteZerado) {
        // a explicação já está lá em cima, uma vez só: aqui a coluna fica vazia
        inner = '';
        if (col.k === 'a_fazer') extra = '<span class="q-add" data-novo="1" title="Novo trabalho">' + ICO.mais + '</span>';
      } else if (col.k === 'a_fazer') {
        extra = '<span class="q-add" data-novo="1" title="Novo trabalho">' + ICO.mais + '</span>';
        inner = colunaAFazerHTML(doCol);
      } else if (col.k === 'publicado') {
        // A contagem é a dos cartões que estão na tela (CA-2 e mockup renderP5):
        // os concluídos antigos só entram na conta quando o Alex abre "ver anteriores".
        var r = colunaPublicadoHTML(doCol);
        inner = r.html; count = r.visiveis;
      } else if (col.k === 'aguardando_cliente') {
        doCol.sort(function (a, b) { return diasEspera(b) - diasEspera(a) || (a.ordem || 0) - (b.ordem || 0); });
        inner = doCol.length ? doCol.map(cardHTML).join('') : vazioHTML(col.vazio);
      } else {
        doCol.sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
        inner = doCol.length ? doCol.map(cardHTML).join('') : vazioHTML(col.vazio);
      }
      h += colunaHTML(col, inner, count, extra);
    });
    h += '</div>';
    root.innerHTML = h;
    devolveScroll();
    ligarEventos();
  }

  function renderCarregando() {
    var root = ctx.root();
    if (root) root.innerHTML = '<div class="full-load"><span class="spinner"></span>Carregando o quadro…</div>';
  }
  function renderErro(msg) {
    var root = ctx.root();
    if (!root) return;
    root.innerHTML = '<div class="full-err">' + ICO.alerta +
      '<div class="t">Não consegui carregar o quadro</div>' +
      '<div class="s">' + esc(msg || 'A conexão com o banco falhou.') +
      ' Seus trabalhos estão salvos — é só a tela que não conseguiu buscar agora.</div>' +
      '<button class="btn btn-primary" data-recarregar="1">Tentar de novo</button></div>';
    root.querySelectorAll('[data-recarregar]').forEach(function (b) {
      b.addEventListener('click', function () { ctx.recarregar(); });
    });
  }

  /* ── Visão em Lista (a mesma verdade, outro formato) ───────────────────────*/
  function listaHTML() {
    var lista = visiveis().filter(function (it) { return it.coluna !== 'publicado'; });
    if (!lista.length) return '<div class="bl-inbox-empty">Nenhum trabalho encontrado.</div>';
    var busca = estado().busca;
    var h = '';
    PRIO_GRUPOS.forEach(function (g) {
      var itensG = lista.filter(function (it) { return grupoPrio(it) === g.k; });
      if (!itensG.length) return;
      var aberta = busca ? true : !!gavetasAbertas[g.k];
      h += '<div class="ls-grp' + (aberta ? ' open' : '') + '" data-grp="' + g.k + '">' +
        '<div class="ls-grph">' + (aberta ? ICO.chevd : ICO.chev).replace('<svg', '<svg class="chev"') +
        '<span class="badge ' + g.badge + '">' + esc(g.label) + '</span>' +
        '<span class="cnt">' + itensG.length + (itensG.length > 1 ? ' itens' : ' item') + '</span></div>';
      if (aberta) {
        h += '<div class="ls-b">';
        var areas = [];
        itensG.forEach(function (it) { var a = it.area || 'Sem área'; if (areas.indexOf(a) === -1) areas.push(a); });
        areas.forEach(function (a) {
          h += '<div class="ls-area">' + esc(a) + '</div>';
          itensG.filter(function (it) { return (it.area || 'Sem área') === a; }).forEach(function (it) {
            var col = coluna(it.coluna);
            var cli = cliente(it.projeto);
            h += '<div class="ls-it" data-id="' + esc(it.id) + '">' +
              '<span class="id">' + esc(it.item_id || '—') + '</span>' +
              '<div class="mn"><div class="tt">' + esc(it.titulo) + '</div>' +
              (it.descricao ? '<div class="ds">' + esc(it.descricao) + '</div>' : '') + '</div>' +
              '<div class="tg">' +
              '<span class="ls-cli"><i style="background:' + cli.c + '"></i>' + esc(cli.n) + '</span>' +
              (it.compartilhado ? '<span class="badge badge-blue">Compartilhado</span>' : '') +
              '<span class="badge badge-gray">' + esc(it.tipo || 'Dev') + '</span>' +
              '<span class="ls-col">' + ICO[col.i] + esc(col.n) + '</span>' +
              '</div></div>';
          });
        });
        h += '</div>';
      }
      h += '</div>';
    });
    return h;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     11. EVENTOS (arrastar, abrir ficha, mover sem arrastar)
     ══════════════════════════════════════════════════════════════════════════ */
  function ligarEventos() {
    var root = ctx.root();

    root.querySelectorAll('.q-grph').forEach(function (el) {
      el.addEventListener('click', function () {
        var k = el.parentElement.dataset.grp;
        gavetasAbertas[k] = !gavetasAbertas[k];
        render();
      });
    });
    root.querySelectorAll('.ls-grph').forEach(function (el) {
      el.addEventListener('click', function () {
        var k = el.parentElement.dataset.grp;
        gavetasAbertas[k] = !gavetasAbertas[k];
        render();
      });
    });
    root.querySelectorAll('[data-expandir]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var k = el.dataset.expandir;
        gavetasExpandidas[k] = !gavetasExpandidas[k];
        render();
      });
    });
    root.querySelectorAll('[data-antigos]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.stopPropagation(); publicadoAntigos = !publicadoAntigos; render(); });
    });
    root.querySelectorAll('[data-novo]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.stopPropagation(); abrirNovo(); });
    });
    root.querySelectorAll('[data-retry]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = el.dataset.retry, f = falhas[id];
        if (f) { delete falhas[id]; moverCartao(id, f.destino, true); }
      });
    });
    root.querySelectorAll('.ls-it').forEach(function (el) {
      el.addEventListener('click', function () { abrirFicha(el.dataset.id); });
    });

    root.querySelectorAll('.q-card').forEach(function (el) {
      var id = el.dataset.id;
      el.addEventListener('click', function (e) {
        if (e.target.closest('.q-move') || e.target.closest('.q-pop') || e.target.closest('[data-retry]')) return;
        abrirFicha(id);
      });
      el.addEventListener('dragstart', function (e) {
        arrastando = id;
        el.classList.add('dragging');
        try { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
      });
      el.addEventListener('dragend', function () { arrastando = null; el.classList.remove('dragging'); limpaAlvos(); });
      var mv = el.querySelector('.q-move');
      if (mv) mv.addEventListener('click', function (e) { e.stopPropagation(); abrirPop(el, id); });
    });

    // A coluna INTEIRA é área de soltar (não só a lista de cartões): assim dá para
    // largar o cartão em qualquer ponto dela, inclusive no cabeçalho.
    root.querySelectorAll('.q-col').forEach(function (zona) {
      zona.addEventListener('dragover', function (e) {
        if (!arrastando) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        zona.classList.add('alvo');
      });
      zona.addEventListener('dragleave', function (e) {
        if (!zona.contains(e.relatedTarget)) zona.classList.remove('alvo');
      });
      zona.addEventListener('drop', function (e) {
        e.preventDefault();
        zona.classList.remove('alvo');
        var id = arrastando || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : '');
        arrastando = null;
        if (id) moverCartao(id, zona.dataset.col);
      });
    });
  }
  function limpaAlvos() {
    ctx.root().querySelectorAll('.alvo').forEach(function (z) { z.classList.remove('alvo'); });
  }

  /* Mover sem arrastar — a listinha das 6 colunas no cartão (4.3 do UX/UI).
     Ela vive no fim da página (presa à tela), e não dentro do cartão: dentro,
     a lista do último cartão sairia pela borda da coluna. Como é presa à tela,
     a posição é recalculada na abertura e a lista fecha assim que a página
     rola (senão ela ficaria parada enquanto o cartão anda por baixo). */
  var popAberto = null;   // id do cartão com a lista aberta
  function fecharPop() {
    document.querySelectorAll('.q-pop').forEach(function (p) { p.remove(); });
    document.querySelectorAll('.q-card.showmove').forEach(function (c) { c.classList.remove('showmove'); });
    popAberto = null;
  }
  function abrirPop(cardEl, id) {
    var jaAberto = (popAberto === id);
    fecharPop();
    if (jaAberto) return;
    var it = acha(id); if (!it) return;
    var pop = document.createElement('div');
    pop.className = 'q-pop';
    pop.innerHTML = '<div class="h">Mover para</div>' + COLUNAS.map(function (c) {
      return '<div class="opt' + (c.k === it.coluna ? ' cur' : '') + '" data-dest="' + c.k + '">' +
        ICO[c.i] + esc(c.n) + '</div>';
    }).join('');
    cardEl.classList.add('showmove');
    document.body.appendChild(pop);
    popAberto = id;
    posicionaPop(pop, cardEl);
    pop.querySelectorAll('.opt').forEach(function (o) {
      o.addEventListener('click', function (e) {
        e.stopPropagation();
        fecharPop();
        moverCartao(id, o.dataset.dest);
      });
    });
  }
  // Encosta a lista no cartão. Coordenada é dado, não estilo — o visual vem do CSS.
  function posicionaPop(pop, cardEl) {
    if (typeof cardEl.getBoundingClientRect !== 'function') return;
    var r = cardEl.getBoundingClientRect();
    var largura = 172, altura = pop.offsetHeight || 210;
    var esq = r.right - largura;
    var topo = r.top + 24;
    if (esq < 8) esq = 8;
    var limite = (window.innerHeight || 800) - altura - 8;
    if (topo > limite) topo = limite > 8 ? limite : 8;
    pop.style.left = Math.round(esq) + 'px';
    pop.style.top = Math.round(topo) + 'px';
  }

  /* ══════════════════════════════════════════════════════════════════════════
     12. MOVER E GRAVAR (R-5 a R-9, R-37)
     ══════════════════════════════════════════════════════════════════════════ */
  function avisoSaidaPublicado(it) {
    var d = it.concluido_em ? dataBR(it.concluido_em) : null;
    return 'Este trabalho está no ar' + (d ? ' desde ' + d : ' (sem data registrada)') + '.\n\n' +
      'Tirar de "Publicado" devolve ele para a fila de trabalho. ' +
      'A data de publicação fica guardada — nada é apagado.\n\nPode mover?';
  }

  async function moverCartao(id, destino, ehRetry) {
    var it = acha(id);
    if (!it || !destino) return;
    if (it.coluna === destino) return;              // soltou onde já estava (CA-6)
    if (salvando[id]) return;                       // segundo arrasto durante a gravação (CA-7)
    if (it.coluna === 'publicado' && destino !== 'publicado') {
      if (!confirm(avisoSaidaPublicado(it))) return;   // aviso, não destruição (D-6)
    }
    var origem = it.coluna;
    delete falhas[id];
    salvando[id] = true;
    it.coluna = destino;                            // desenha primeiro
    ctx.afterChange();
    try {
      var r = await db().from('backlog_itens').update({ coluna: destino }).eq('id', id).select().single();
      if (r.error) throw r.error;
      if (r.data) Object.assign(it, r.data);        // traz o que o gatilho decidiu (status, datas)
      delete salvando[id];
      ctx.afterChange();
      if (ehRetry) toast('✅ Movido para ' + coluna(destino).n);
    } catch (e) {
      it.coluna = origem;                           // volta visualmente (R-6 / CA-4)
      delete salvando[id];
      falhas[id] = { destino: destino, origem: origem };
      ctx.afterChange();
      toast('❌ Não consegui salvar o movimento — o cartão voltou para ' + coluna(origem).n);
      console.error('Quadro — falha ao mover:', e);
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     13. FICHA DO TRABALHO (T-8) e NOVO TRABALHO (T-9)
     ══════════════════════════════════════════════════════════════════════════ */
  function fecharModais() {
    document.querySelectorAll('.mk-overlay.open').forEach(function (m) { m.classList.remove('open'); });
  }
  function overlay(id) {
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = 'mk-overlay';
      el.addEventListener('click', function (e) { if (e.target === el) el.classList.remove('open'); });
      document.body.appendChild(el);
    }
    return el;
  }
  function opcoes(lista, atual) {
    return lista.map(function (o) {
      var v = typeof o === 'string' ? o : o.v, n = typeof o === 'string' ? o : o.n;
      return '<option value="' + esc(v) + '"' + (String(v) === String(atual == null ? '' : atual) ? ' selected' : '') + '>' + esc(n) + '</option>';
    }).join('');
  }
  function areasConhecidas(extra) {
    var as = [];
    itens().forEach(function (it) { if (it.area && as.indexOf(it.area) === -1) as.push(it.area); });
    if (extra && as.indexOf(extra) === -1) as.push(extra);
    as.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    return as;
  }
  var OPC_PRIO = [
    { v: 'ALTA', n: 'Alta' }, { v: 'MEDIA', n: 'Média' }, { v: 'BAIXA', n: 'Baixa' },
    { v: 'FUTURO', n: 'Futuro' }, { v: '', n: 'Fila operacional (sem prioridade)' }
  ];
  var OPC_TIPO = ['Dev', 'Operacional', 'Dev+Op', 'Pesquisa', 'Design'];

  /* Nenhuma lista pode escolher um valor sozinha (regra do Alex: nada de ação
     escondida). Se o item não tem área/cliente, entra a opção "não definida",
     já selecionada; se tem um valor fora da lista, o valor dele entra na lista. */
  function listaAreas(atual) {
    var l = areasConhecidas(atual).map(function (a) { return { v: a, n: a }; });
    if (!atual) l.unshift({ v: '', n: '— área não definida —' });
    return l;
  }
  function listaClientes(atual) {
    var l = CLIENTES.map(function (c) { return { v: c.k, n: c.n }; });
    var conhecido = CLIENTES.some(function (c) { return c.k === atual; });
    if (!conhecido) l.unshift({ v: atual || '', n: atual ? 'cliente desconhecido: ' + atual : '— escolha o cliente —' });
    return l;
  }
  var OPC_TRILHO = [{ v: '', n: 'Trilho a definir' }, { v: 'rapido', n: 'Rápido' }, { v: 'completo', n: 'Completo' }];

  function erroCampo(txt) {
    return '<div class="field-error">' + ICO.alerta + '<span>' + txt + '</span></div>';
  }
  function limpaErros(box) {
    box.querySelectorAll('.field-error').forEach(function (e) { e.remove(); });
    box.querySelectorAll('.err').forEach(function (e) { e.classList.remove('err'); });
  }
  function marcaErro(campo, txt) {
    campo.classList.add('err');
    campo.insertAdjacentHTML('afterend', erroCampo(txt));
    campo.focus();
  }

  function abrirFicha(id) {
    var it = acha(id); if (!it) return;
    gravandoJanela = false;
    var ov = overlay('mkFicha');
    var cli = cliente(it.projeto);
    var prioOpts = OPC_PRIO.slice();
    if (it.prioridade && !PRIO_LABEL[it.prioridade]) prioOpts.push({ v: it.prioridade, n: it.prioridade });
    var tipoOpts = OPC_TIPO.slice();
    if (it.tipo && tipoOpts.indexOf(it.tipo) === -1) tipoOpts.push(it.tipo);

    var histPub = (it.publicado_em || []).filter(Boolean);

    ov.innerHTML = '<div class="mk">' +
      '<div class="mk-h"><div class="mk-hmain"><div class="tt">' + esc(it.titulo || '(sem título)') + '</div>' +
        '<div class="cl"><i style="background:' + cli.c + '"></i>' + esc(cli.n) +
        (it.area ? ' · ' + esc(it.area) : '') + (it.item_id ? ' · <span>item ' + esc(it.item_id) + '</span>' : '') + '</div></div>' +
        '<div class="mk-x" data-fechar="1">' + ICO.x + '</div></div>' +
      '<div id="fiBanner"></div>' +
      '<div class="form-group"><label>Título do trabalho</label>' +
        '<input type="text" id="fiTitulo" value="' + esc(it.titulo) + '"></div>' +
      '<div class="form-group"><label>Descrição</label>' +
        '<textarea id="fiDesc">' + esc(it.descricao || '') + '</textarea></div>' +
      '<div class="form-row cols-3">' +
        '<div><label>Cliente</label><select id="fiCliente">' +
          opcoes(listaClientes(it.projeto), it.projeto) + '</select></div>' +
        '<div><label>Área</label><select id="fiArea">' +
          opcoes(listaAreas(it.area), it.area || '') + '</select></div>' +
        '<div><label>Prioridade</label><select id="fiPrio">' + opcoes(prioOpts, it.prioridade || '') + '</select></div>' +
      '</div>' +
      '<div class="form-row cols-2">' +
        '<div><label>Tipo</label><select id="fiTipo">' + opcoes(tipoOpts, it.tipo || 'Dev') + '</select></div>' +
        '<div><label>Trilho</label><select id="fiTrilho">' + opcoes(OPC_TRILHO, it.trilho || '') + '</select></div>' +
      '</div>' +
      '<div class="mk-sec">Em que coluna está</div>' +
      '<div class="mk-cols" id="fiCols">' + COLUNAS.map(function (c) {
        return '<div class="mk-colopt' + (c.k === it.coluna ? ' on' : '') + '" data-col="' + c.k + '">' +
          ICO[c.i] + esc(c.n) + '</div>';
      }).join('') + '</div>' +
      '<div class="form-row cols-2 mk-gap">' +
        '<div><label>Agente que está com o trabalho <span class="op6">(só em Em andamento)</span></label>' +
          '<select id="fiAgente">' + opcoes([{ v: '', n: '—' }].concat(AGENTES.map(function (a) { return { v: a, n: a }; })), it.agente_atual || '') + '</select></div>' +
        '<div><label>O que está esperando <span class="op6">(só em Engatilhado)</span></label>' +
          '<input type="text" id="fiEspera" value="' + esc(it.espera_nota || '') + '" placeholder="ex.: mockup aprovado — aguardando seu OK p/ codar"></div>' +
      '</div>' +
      (histPub.length ? '<div class="mk-ro mk-gap">' + ICO.check + ' Publicado em: <b>' +
        histPub.map(function (d) { return esc(dataBR(d)); }).join(' · ') + '</b></div>' : '') +
      '<div class="mk-act" id="fiAcoes">' +
        '<button class="btn btn-ghost mk-left" data-excluir="1">' + ICO.lixo + 'Excluir</button>' +
        '<button class="btn btn-ghost" data-fechar="1">Cancelar</button>' +
        '<button class="btn btn-primary" data-salvar="1">' + ICO.check + 'Salvar</button>' +
      '</div></div>';

    ov.classList.add('open');
    var box = ov.querySelector('.mk');

    function sincronizaCampos() {
      var col = box.querySelector('.mk-colopt.on').dataset.col;
      var ag = box.querySelector('#fiAgente'), es = box.querySelector('#fiEspera');
      ag.disabled = col !== 'em_andamento';
      es.disabled = col !== 'engatilhado';
      ag.classList.toggle('apagado', ag.disabled);
      es.classList.toggle('apagado', es.disabled);
      es.placeholder = es.disabled ? 'disponível quando a coluna for Engatilhado'
                                   : 'ex.: mockup aprovado — aguardando seu OK p/ codar';
    }
    box.querySelectorAll('.mk-colopt').forEach(function (o) {
      o.addEventListener('click', function () {
        box.querySelectorAll('.mk-colopt').forEach(function (x) { x.classList.toggle('on', x === o); });
        sincronizaCampos();
      });
    });
    sincronizaCampos();

    ov.querySelectorAll('[data-fechar]').forEach(function (b) {
      b.addEventListener('click', function () { ov.classList.remove('open'); });
    });
    ov.querySelector('[data-excluir]').addEventListener('click', function () { confirmarExcluir(ov, it); });
    ov.querySelector('[data-salvar]').addEventListener('click', function () { salvarFicha(ov, it); });
  }

  function confirmarExcluir(ov, it) {
    var banner = ov.querySelector('#fiBanner');
    banner.innerHTML = '<div class="mk-banner warn">' + ICO.alerta + '<span><b>Excluir "' + esc(it.titulo) +
      '"?</b> Ele sai do quadro e do backlog para sempre. O que já foi registrado no Histórico não é apagado.</span></div>';
    var acoes = ov.querySelector('#fiAcoes');
    acoes.innerHTML = '<button class="btn btn-ghost mk-left" data-voltar="1">Cancelar exclusão</button>' +
      '<button class="btn btn-danger" data-excluirmesmo="1">' + ICO.lixo + 'Excluir mesmo assim</button>';
    acoes.querySelector('[data-voltar]').addEventListener('click', function () { abrirFicha(it.id); });
    acoes.querySelector('[data-excluirmesmo]').addEventListener('click', async function () {
      if (gravandoJanela) return;
      gravandoJanela = true;
      try {
        var r = await db().from('backlog_itens').delete().eq('id', it.id);
        if (r.error) throw r.error;
        ctx.removerItem(it.id);
        delete recemCriados[it.id];
        gravandoJanela = false;
        ov.classList.remove('open');
        toast('🗑️ Trabalho excluído');
        ctx.afterChange();
      } catch (e) {
        gravandoJanela = false;
        banner.innerHTML = '<div class="mk-banner err">' + ICO.alerta + '<span><b>Não consegui excluir.</b> ' +
          esc(e.message || e) + '</span></div>';
      }
    });
  }

  async function salvarFicha(ov, it) {
    if (gravandoJanela) return;
    var box = ov.querySelector('.mk');
    limpaErros(box);
    var titulo = box.querySelector('#fiTitulo').value.trim();
    if (!titulo) {
      marcaErro(box.querySelector('#fiTitulo'),
        'O título não pode ficar em branco — é o que aparece no cartão. Nada foi salvo.');
      return;
    }
    if (!box.querySelector('#fiCliente').value) {
      marcaErro(box.querySelector('#fiCliente'),
        'Escolha de qual cliente é este trabalho. Nada foi salvo.');
      return;
    }
    var destino = box.querySelector('.mk-colopt.on').dataset.col;
    if (it.coluna === 'publicado' && destino !== 'publicado') {
      if (!confirm(avisoSaidaPublicado(it))) return;
    }
    var payload = {
      titulo: titulo,
      descricao: box.querySelector('#fiDesc').value.trim() || null,
      projeto: box.querySelector('#fiCliente').value,
      area: box.querySelector('#fiArea').value || null,
      prioridade: box.querySelector('#fiPrio').value || null,
      tipo: box.querySelector('#fiTipo').value || 'Dev',
      trilho: box.querySelector('#fiTrilho').value || null,
      coluna: destino,
      agente_atual: destino === 'em_andamento' ? (box.querySelector('#fiAgente').value || null) : null,
      espera_nota: destino === 'engatilhado' ? (box.querySelector('#fiEspera').value.trim() || null) : null
    };
    var btn = box.querySelector('[data-salvar]');
    gravandoJanela = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-sm"></span>Salvando…';
    try {
      // Alguém pode ter mexido neste trabalho por fora (o Orquestrador grava no
      // backlog enquanto a tela está aberta). Se mudou, aviso ANTES de gravar em
      // cima — nada de sobrescrever calado.
      var atual = await db().from('backlog_itens').select('updated_at').eq('id', it.id).single();
      if (!atual.error && atual.data && it.updated_at && atual.data.updated_at !== it.updated_at) {
        gravandoJanela = false;
        btn.disabled = false;
        btn.innerHTML = ICO.check + 'Salvar';
        ov.querySelector('#fiBanner').innerHTML = '<div class="mk-banner warn">' + ICO.alerta +
          '<span><b>Este trabalho mudou por fora enquanto a ficha estava aberta.</b> ' +
          'Para não apagar a alteração de outra sessão, nada foi gravado. Feche a ficha, ' +
          'recarregue a tela e refaça a mudança. <u data-forcar="1">Gravar assim mesmo</u></span></div>';
        var forcar = ov.querySelector('[data-forcar]');
        if (forcar) forcar.addEventListener('click', function () { it.updated_at = atual.data.updated_at; salvarFicha(ov, it); });
        return;
      }
      var r = await db().from('backlog_itens').update(payload).eq('id', it.id).select().single();
      if (r.error) throw r.error;
      if (r.data) Object.assign(it, r.data);
      gravandoJanela = false;
      ov.querySelector('#fiBanner').innerHTML = '<div class="mk-banner ok">' + ICO.check +
        '<span>Salvo. O cartão já está atualizado no quadro.</span></div>';
      ctx.afterChange();
      setTimeout(function () { ov.classList.remove('open'); }, 700);
    } catch (e) {
      gravandoJanela = false;
      ov.querySelector('#fiBanner').innerHTML = '<div class="mk-banner err">' + ICO.alerta +
        '<span><b>Não consegui salvar.</b> A gravação falhou e nada foi alterado. A ficha continua aberta com o que você escreveu — tente salvar de novo.<br>' +
        esc(e.message || e) + '</span></div>';
      btn.disabled = false;
      btn.innerHTML = ICO.check + 'Salvar';
    }
  }

  /* ── Novo trabalho (T-9) ───────────────────────────────────────────────────*/
  function abrirNovo() {
    gravandoJanela = false;
    var ov = overlay('mkNovo');
    var st = estado();
    var clienteAtual = st.projeto === 'todos' ? '' : st.projeto;
    ov.innerHTML = '<div class="mk">' +
      '<div class="mk-h"><div class="tt mk-hmain">Novo trabalho</div><div class="mk-x" data-fechar="1">' + ICO.x + '</div></div>' +
      '<div id="nvBanner"></div>' +
      '<div class="form-group"><label>Título do trabalho</label>' +
        '<input type="text" id="nvTitulo" placeholder="O que precisa ser feito"></div>' +
      '<div class="form-row cols-2">' +
        '<div><label>Cliente</label><select id="nvCliente">' +
          (clienteAtual ? '' : '<option value="">Escolha o cliente…</option>') +
          opcoes(CLIENTES.map(function (c) { return { v: c.k, n: c.n }; }), clienteAtual) + '</select></div>' +
        '<div><label>Área</label><select id="nvArea">' +
          opcoes(areasConhecidas().map(function (a) { return { v: a, n: a }; }), 'IA') + '</select></div>' +
      '</div>' +
      '<div class="form-row cols-3">' +
        '<div><label>Prioridade</label><select id="nvPrio">' + opcoes(OPC_PRIO, 'MEDIA') + '</select></div>' +
        '<div><label>Tipo</label><select id="nvTipo">' + opcoes(OPC_TIPO, 'Dev') + '</select></div>' +
        '<div><label>Trilho <span class="op6">(pode deixar para depois)</span></label>' +
          '<select id="nvTrilho">' + opcoes(OPC_TRILHO, '') + '</select></div>' +
      '</div>' +
      '<div class="mk-ro">' + ICO.info + ' Ele nasce na coluna <b>A fazer</b>.</div>' +
      '<div class="mk-act"><button class="btn btn-ghost" data-fechar="1">Cancelar</button>' +
        '<button class="btn btn-primary" data-criar="1">' + ICO.mais + 'Criar trabalho</button></div></div>';
    ov.classList.add('open');
    ov.querySelectorAll('[data-fechar]').forEach(function (b) {
      b.addEventListener('click', function () { ov.classList.remove('open'); });
    });
    ov.querySelector('[data-criar]').addEventListener('click', function () { criarTrabalho(ov); });
    setTimeout(function () { var i = ov.querySelector('#nvTitulo'); if (i) i.focus(); }, 30);
  }

  async function criarTrabalho(ov) {
    if (gravandoJanela) return;
    var box = ov.querySelector('.mk');
    limpaErros(box);
    var titulo = box.querySelector('#nvTitulo').value.trim();
    var cli = box.querySelector('#nvCliente').value;
    var falhou = false;
    if (!titulo) {
      marcaErro(box.querySelector('#nvTitulo'),
        'Escreva um título — sem ele o cartão fica sem nome no quadro. Nada foi criado.');
      falhou = true;
    }
    if (!cli) {
      var sel = box.querySelector('#nvCliente');
      sel.classList.add('err');
      sel.insertAdjacentHTML('afterend', erroCampo(
        'Você está vendo "Todos" no topo. Escolha de qual cliente é este trabalho — "Todos" é jeito de olhar, não é cliente.'));
      falhou = true;
    }
    if (falhou) return;

    var maxOrdem = 0;
    itens().forEach(function (it) { if ((it.ordem || 0) > maxOrdem) maxOrdem = it.ordem || 0; });
    var payload = {
      titulo: titulo,
      projeto: cli,
      area: box.querySelector('#nvArea').value || null,
      prioridade: box.querySelector('#nvPrio').value || null,
      tipo: box.querySelector('#nvTipo').value || 'Dev',
      trilho: box.querySelector('#nvTrilho').value || null,
      coluna: 'a_fazer',
      ordem: maxOrdem + 1
    };
    var btn = box.querySelector('[data-criar]');
    gravandoJanela = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-sm"></span>Criando…';
    try {
      var r = await db().from('backlog_itens').insert(payload).select().single();
      if (r.error) throw r.error;
      ctx.adicionarItem(r.data);
      recemCriados[r.data.id] = true;
      gravandoJanela = false;
      ov.classList.remove('open');
      toast('✅ Trabalho criado em "A fazer"');
      ctx.afterChange();
    } catch (e) {
      gravandoJanela = false;
      ov.querySelector('#nvBanner').innerHTML = '<div class="mk-banner err">' + ICO.alerta +
        '<span><b>Não consegui criar.</b> ' + esc(e.message || e) + '</span></div>';
      btn.disabled = false;
      btn.innerHTML = ICO.mais + 'Criar trabalho';
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     14. REGRA DO CUTUCAR — o aviso fora do quadro (R-19)
     ══════════════════════════════════════════════════════════════════════════ */
  function atrasados() {
    return itens().filter(function (it) {
      return it.coluna === 'aguardando_cliente' && pertence(it, estado().projeto) && diasEspera(it) >= DIAS_CUTUCAR;
    });
  }
  function renderCutuca(el) {
    if (!el) return;
    var n = atrasados().length;
    if (!n) { el.innerHTML = ''; el.classList.add('bl-hidden'); return; }
    el.classList.remove('bl-hidden');
    el.innerHTML = '<div class="cutuca" id="cutucaBt">' + ICO.alerta +
      '<span><b>' + n + ' trabalho' + (n > 1 ? 's' : '') + '</b> esperando resposta há ' + DIAS_CUTUCAR +
      ' dias ou mais — hora de cobrar.</span>' +
      '<span class="go">Ver na coluna ' + ICO.mover + '</span></div>';
    el.querySelector('#cutucaBt').addEventListener('click', function () {
      if (estado().modo === 'lista') { ctx.irParaQuadro(); }
      var col = ctx.root().querySelector('.q-col[data-col="aguardando_cliente"]');
      if (col) {
        col.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        col.classList.add('foco');
        setTimeout(function () { col.classList.remove('foco'); }, 1800);
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     15. API pública
     ══════════════════════════════════════════════════════════════════════════ */
  global.Quadro = {
    CLIENTES: CLIENTES,
    COLUNAS: COLUNAS,
    DIAS_CUTUCAR: DIAS_CUTUCAR,
    ICO: ICO,
    init: init,
    render: render,
    renderCarregando: renderCarregando,
    renderErro: renderErro,
    renderCutuca: renderCutuca,
    abrirNovo: abrirNovo,
    abrirFicha: abrirFicha,
    cliente: cliente,
    coluna: coluna,
    pertence: pertence,
    clientesDoItem: clientesDoItem,
    diasEspera: diasEspera,
    atrasados: atrasados,
    grupoPrio: grupoPrio,
    esc: esc
  };
})(window);
