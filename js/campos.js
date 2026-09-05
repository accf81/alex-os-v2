// js/campos.js — Alex OS v2
// Ajudantes de campo compartilhados entre telas (ADR D-18 do 02_ARQUITETURA).
//
// O que mora aqui:
//   normTxt / esc / escAttr        → comparar e escapar texto com segurança
//   fieldErrMostrar / fieldErrLimpar → aviso VERMELHO junto do campo (bloqueia)
//   fieldWarnMostrar / fieldWarnLimpar → aviso ÂMBAR junto do campo (não bloqueia)
//   feLink                          → link clicável dentro do aviso
//
// REGRA DE SEGURANÇA (lição do defeito D-1): tudo que o usuário digitou entra por
// textContent / createTextNode — nunca dentro de string de HTML e nunca dentro de
// handler inline. Assim "Jardim D'Abril" e "O'Brien" funcionam e nada do que for
// digitado é executado como comando.
//
// Uso: <script src="js/campos.js?v=..."></script> ANTES do script da página.
// As telas já publicadas (imobiliarias/bairros/listas/imoveis) seguem com as cópias
// locais delas — o retrofit é dívida registrada, sem pressa (D-18).

(function (global) {
  'use strict';

  // ── Texto ──────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }
  // minúsculas, sem acento e sem espaço nas pontas — para comparar nome repetido
  function normTxt(s) {
    return String(s == null ? '' : s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // ── Ícones (padrão do sistema: SVG stroke, zero emoji) ─────────────────────
  var ICO_ERR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  var ICO_WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

  // `partes` = lista de strings e/ou nós de DOM já prontos
  function pintar(inpId, boxId, partes, classeCampo, ico, focar) {
    var inp = document.getElementById(inpId);
    var box = document.getElementById(boxId);
    if (!box) return;
    if (inp) inp.classList.add(classeCampo);
    box.innerHTML = ico;
    var sp = document.createElement('span');
    (partes || []).forEach(function (p) {
      sp.appendChild(typeof p === 'string' ? document.createTextNode(p) : p);
    });
    box.appendChild(sp);
    box.classList.add('show');
    if (focar && inp) inp.focus();
    if (box.scrollIntoView) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function apagar(inpId, boxId, classeCampo) {
    var inp = document.getElementById(inpId);
    if (inp) inp.classList.remove(classeCampo);
    var box = document.getElementById(boxId);
    if (box) { box.classList.remove('show'); box.innerHTML = ''; }
  }

  // Vermelho: impede seguir. Leva o foco para o campo.
  function fieldErrMostrar(inpId, boxId, partes) { pintar(inpId, boxId, partes, 'err', ICO_ERR, true); }
  function fieldErrLimpar(inpId, boxId) { apagar(inpId, boxId, 'err'); }

  // Âmbar: só avisa, dá para seguir. NÃO rouba o foco (o aviso costuma nascer
  // justamente quando a pessoa está saindo do campo).
  function fieldWarnMostrar(inpId, boxId, partes) { pintar(inpId, boxId, partes, 'warn', ICO_WARN, false); }
  function fieldWarnLimpar(inpId, boxId) { apagar(inpId, boxId, 'warn'); }

  function feLink(txt, acao) {
    var a = document.createElement('span');
    a.className = 'fe-link';
    a.textContent = txt;
    a.addEventListener('click', acao);
    return a;
  }

  var API = {
    esc: esc, escAttr: escAttr, normTxt: normTxt,
    fieldErrMostrar: fieldErrMostrar, fieldErrLimpar: fieldErrLimpar,
    fieldWarnMostrar: fieldWarnMostrar, fieldWarnLimpar: fieldWarnLimpar,
    feLink: feLink, ICO_ERR: ICO_ERR, ICO_WARN: ICO_WARN
  };

  global.AlexCampos = API;
  // Atalhos globais: a página chama fieldErrMostrar(...) direto, como já fazia
  // quando cada tela tinha a própria cópia. Só define o que ainda não existir,
  // para nunca atropelar a cópia local de uma tela já publicada.
  Object.keys(API).forEach(function (k) {
    if (typeof global[k] === 'undefined') global[k] = API[k];
  });
})(typeof window !== 'undefined' ? window : this);
