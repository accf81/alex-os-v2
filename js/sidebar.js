/**
 * sidebar.js — Menu lateral compartilhado entre todas as páginas do Alex OS.
 * Injeta o HTML do menu no <nav id="sidebar"> de cada página automaticamente.
 * Para adicionar um novo item no futuro, edite apenas este arquivo.
 */
(function () {
  'use strict';

  // Detecta qual página está aberta
  const page = location.pathname.split('/').pop() || 'hoje.html';

  function active(p) {
    return page === p ? ' active' : '';
  }

  // Cadastros (Pessoas/Imóveis/Condomínios) mora dentro de Pandora como subgrupo
  // (igual "Ferramentas" dentro de FMS) — mudança de 13/07/2026, pra caber tudo sem rolar o menu.
  const imTab = localStorage.getItem('imoveis_tab') || 'pipeline';
  const onImoveis = page === 'imoveis.html';
  const pandoraActive = (onImoveis || page === 'contatos.html' || page === 'dd.html' || page === 'bairros.html' || page === 'imobiliarias.html') ? ' active' : '';

  // Sub-itens do Pandora (imoveis.html)
  function pandoraHref() { return page === 'imoveis.html' ? '#' : 'imoveis.html'; }
  function pandoraClick(tab) {
    return page === 'imoveis.html'
      ? `event.preventDefault();showTab('${tab}')`
      : `localStorage.setItem('imoveis_tab','${tab}')`;
  }

  // Sub-itens de P&V (photo.html)
  function pvHref() { return page === 'photo.html' ? '#' : 'photo.html'; }
  function pvClick(tab) {
    return page === 'photo.html'
      ? `event.preventDefault();showTab('${tab}')`
      : `localStorage.setItem('pv_tab','${tab}')`;
  }

  // Sub-itens do FMS (financeiro.html)
  function fmsHref() { return page === 'financeiro.html' ? '#' : 'financeiro.html'; }
  function fmsClick(tab) {
    return page === 'financeiro.html'
      ? `event.preventDefault();showTab('${tab}')`
      : `localStorage.setItem('fms_tab','${tab}')`;
  }

  const html = `
  <button class="sb-float-toggle" id="sbToggle" aria-label="Expandir/Recolher menu">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
  </button>
  <div class="sb-resizer" id="sbResizer" title="Arraste para ajustar a largura"></div>
  <div class="sb-header">
    <svg class="sb-logo" viewBox="0 0 585.31 585.31" xmlns="http://www.w3.org/2000/svg" aria-label="Pandora Homes">
      <path fill="var(--brand-orange)" d="M0,36.63v512.04l48.47-19.64V56.21L0,36.63ZM536.89,56.21v472.83l48.42,19.64V36.63l-48.42,19.58ZM56.27,536.84l-19.64,48.47h512.04l-19.58-48.47H56.27ZM36.63,0l19.64,48.42h472.83L548.68,0H36.63Z"/>
      <path fill="var(--brand-orange)" d="M311.64,118.15h-124.49v46.17h124.1c48.47,0,77.87,25.75,77.87,70.07s-29.4,71.19-77.87,71.19h-124.1v171.45h54.81v-125.22h69.68c80.51,0,132.29-42.47,132.29-117.76s-51.78-115.91-132.29-115.91Z"/>
    </svg>
    <div class="sb-brand"><span class="sb-brand-sub">Sistema</span><span class="sb-brand-name">Alex <em>OS</em></span></div>
  </div>
  <div class="sb-nav">
    <a class="sb-item${active('hoje.html')}" href="hoje.html">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
      <span class="sb-label">Dash</span>
    </a>
    <a class="sb-item${active('dia.html')}" href="dia.html">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      <span class="sb-label">Dia</span>
    </a>
    <a class="sb-item${active('tarefas.html')}" href="tarefas.html">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      <span class="sb-label">Tarefas</span>
    </a>
    <a class="sb-item${pandoraActive}" id="sb-area-pandora" data-area="pandora" href="imoveis.html">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/></svg>
      <span class="sb-label">Pandora</span>
      <span class="sb-chev" onclick="event.preventDefault();event.stopPropagation();aosToggleArea(this)" aria-label="Recolher área"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
    </a>
    <div class="sb-subs">
      <a class="sb-sub" data-tab="kpis" href="${pandoraHref()}" onclick="${pandoraClick('kpis')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><span class="sb-sub-label">KPIs</span></a>
      <a class="sb-sub" data-tab="garimpo" href="${pandoraHref()}" onclick="${pandoraClick('garimpo')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span class="sb-sub-label">Garimpo</span></a>
      <a class="sb-sub" data-tab="pipeline" href="${pandoraHref()}" onclick="${pandoraClick('pipeline')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg><span class="sb-sub-label">Captação</span></a>
      <a class="sb-sub" data-tab="acm" href="${pandoraHref()}" onclick="${pandoraClick('acm')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7"/><line x1="20.5" y1="20.5" x2="15" y2="15"/><line x1="7.5" y1="12" x2="7.5" y2="10.5"/><line x1="10" y1="12" x2="10" y2="8"/><line x1="12.5" y1="12" x2="12.5" y2="9.5"/></svg><span class="sb-sub-label">ACM</span></a>
      <a class="sb-sub" data-tab="gestao" href="${pandoraHref()}" onclick="${pandoraClick('gestao')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg><span class="sb-sub-label">Gestão Exclusiva</span></a>
      <a class="sb-sub${page === 'dd.html' ? ' active' : ''}" href="dd.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.4 0 2.72.32 3.9.9"/></svg><span class="sb-sub-label">Due Diligence</span></a>
      <a class="sb-sub" data-tab="visitas" href="${pandoraHref()}" onclick="${pandoraClick('visitas')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span class="sb-sub-label">Leads</span></a>
      <a class="sb-sub" data-tab="vendas" href="${pandoraHref()}" onclick="${pandoraClick('vendas')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span class="sb-sub-label">Vendas</span></a>
      <div class="sb-sub-group"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/></svg>Cadastros</div>
      <a class="sb-sub${page === 'contatos.html' ? ' active' : ''}" href="contatos.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span class="sb-sub-label">Pessoas</span></a>
      <a class="sb-sub" data-tab="carteira" href="${pandoraHref()}" onclick="${pandoraClick('carteira')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><span class="sb-sub-label">Imóveis</span></a>
      <a class="sb-sub" data-tab="condominios" href="${pandoraHref()}" onclick="${pandoraClick('condominios')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg><span class="sb-sub-label">Condomínios</span></a>
      <a class="sb-sub${page === 'bairros.html' ? ' active' : ''}" href="bairros.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span class="sb-sub-label">Bairros</span></a>
      <a class="sb-sub${page === 'imobiliarias.html' ? ' active' : ''}" href="imobiliarias.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V11l5-3v13M14 21V6l5 3v12M9 9v.01M9 13v.01M9 17v.01"/></svg><span class="sb-sub-label">Imobiliárias</span></a>
    </div>
    <a class="sb-item${active('photo.html')}" data-area="pv" href="photo.html">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
      <span class="sb-label">P&amp;V</span>
      <span class="sb-chev" onclick="event.preventDefault();event.stopPropagation();aosToggleArea(this)" aria-label="Recolher área"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
    </a>
    <div class="sb-subs">
      <a class="sb-sub" data-tab="jobs" href="${pvHref()}" onclick="${pvClick('jobs')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg><span class="sb-sub-label">Jobs</span></a>
      <a class="sb-sub" data-tab="resumo" href="${pvHref()}" onclick="${pvClick('resumo')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg><span class="sb-sub-label">Resumo Anual</span></a>
      <a class="sb-sub" data-tab="airbnb" href="${pvHref()}" onclick="${pvClick('airbnb')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span class="sb-sub-label">Pontos Airbnb</span></a>
    </div>
    <a class="sb-item${active('financeiro.html')}" data-area="fms" href="financeiro.html">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      <span class="sb-label">FMS</span>
      <span class="sb-chev" onclick="event.preventDefault();event.stopPropagation();aosToggleArea(this)" aria-label="Recolher área"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
    </a>
    <div class="sb-subs">
      <a class="sb-sub" data-tab="dash" href="${fmsHref()}" onclick="${fmsClick('dash')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg><span class="sb-sub-label">Dashboard</span></a>
      <a class="sb-sub" data-tab="lanc" href="${fmsHref()}" onclick="${fmsClick('lanc')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><line x1="8" y1="12" x2="16" y2="12"/></svg><span class="sb-sub-label">Lançamentos</span></a>
      <a class="sb-sub" data-tab="importar" href="${fmsHref()}" onclick="${fmsClick('importar')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span class="sb-sub-label">Importar</span></a>
      <a class="sb-sub" data-tab="fluxo" href="${fmsHref()}" onclick="${fmsClick('fluxo')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg><span class="sb-sub-label">Fluxo Mensal</span></a>
      <a class="sb-sub" data-tab="cpr" href="${fmsHref()}" onclick="${fmsClick('cpr')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span class="sb-sub-label">A Receber</span></a>
      <a class="sb-sub" data-tab="saldos" href="${fmsHref()}" onclick="${fmsClick('saldos')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg><span class="sb-sub-label">Saldos</span></a>
      <a class="sb-sub" data-tab="dre" href="${fmsHref()}" onclick="${fmsClick('dre')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span class="sb-sub-label">DRE</span></a>
      <div class="sb-sub-group"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>Ferramentas</div>
      <a class="sb-sub" data-tab="metas" href="${fmsHref()}" onclick="${fmsClick('metas')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg><span class="sb-sub-label">Metas</span></a>
      <a class="sb-sub" data-tab="res" href="${fmsHref()}" onclick="${fmsClick('res')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg><span class="sb-sub-label">Reservas</span></a>
      <a class="sb-sub" data-tab="sim" href="${fmsHref()}" onclick="${fmsClick('sim')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/></svg><span class="sb-sub-label">Simulador</span></a>
      <a class="sb-sub" data-tab="config" href="${fmsHref()}" onclick="${fmsClick('config')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><span class="sb-sub-label">Config</span></a>
    </div>
    <a class="sb-item${active('projetos.html')}" href="projetos.html">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M20 9h2M2 15h2M20 15h2"/><rect x="2" y="2" width="20" height="20" rx="3"/></svg>
      <span class="sb-label">IA</span>
    </a>
    <a class="sb-item${active('listas.html')}" href="listas.html">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      <span class="sb-label">Configurações</span>
    </a>
    <a class="sb-item" href="#" onclick="event.preventDefault();if(window.alexLogout)alexLogout();">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      <span class="sb-label">Sair</span>
    </a>
  </div>
  <div class="sb-foot">
    <div class="sb-foot-ava">AF</div>
    <div class="sb-foot-txt"><span class="sb-foot-name">Alex Fontes</span><span class="sb-foot-sub">Pandora Homes</span></div>
  </div>`;

  const nav = document.getElementById('sidebar');
  if (nav) nav.innerHTML = html;

  // ── Áreas recolhíveis: clicar na setinha abre/fecha os sub-itens (sem navegar) ──
  // O estado fica salvo por área; a área da página atual fica sempre aberta.
  window.aosToggleArea = function (chev) {
    const item = chev.closest('.sb-item');
    if (!item) return;
    const closed = item.classList.toggle('area-closed');
    const area = item.getAttribute('data-area');
    if (area) localStorage.setItem('sb_area_' + area + '_closed', closed ? '1' : '0');
  };
  if (nav) nav.querySelectorAll('.sb-item[data-area]').forEach(function (item) {
    const area = item.getAttribute('data-area');
    const isActive = item.classList.contains('active');
    if (!isActive && localStorage.getItem('sb_area_' + area + '_closed') === '1') {
      item.classList.add('area-closed');
    }
  });

  // ── Largura ajustável: arrastar a borda direita do menu (lembra a largura) ──
  (function () {
    const sb = document.getElementById('sidebar');
    const rz = document.getElementById('sbResizer');
    if (!sb || !rz) return;
    const saved = parseInt(localStorage.getItem('aos_sidebar_width'), 10);
    if (saved && saved >= 190) sb.style.setProperty('--sb-w', saved + 'px');
    let drag = false;
    rz.addEventListener('mousedown', function (e) {
      drag = true; sb.classList.add('sb-dragging');
      document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!drag) return;
      let w = e.clientX - sb.getBoundingClientRect().left;
      w = Math.max(190, Math.min(340, w));
      sb.style.setProperty('--sb-w', w + 'px');
      localStorage.setItem('aos_sidebar_width', w);
    });
    window.addEventListener('mouseup', function () {
      if (!drag) return;
      drag = false; sb.classList.remove('sb-dragging');
      document.body.style.cursor = ''; document.body.style.userSelect = '';
    });
  })();

  // Destaca o sub-item APENAS do módulo da página atual.
  // Em páginas sem abas (Dash, IA, Dia, Contatos) não acende nenhum sub-item.
  const tabKeyByPage = {
    'imoveis.html':    'imoveis_tab',
    'photo.html':      'pv_tab',
    'financeiro.html': 'fms_tab',
  };
  const tabKey = tabKeyByPage[page];
  if (tabKey) {
    const tab = localStorage.getItem(tabKey);
    const el = tab && nav && nav.querySelector(`.sb-sub[data-tab="${tab}"]`);
    if (el) el.classList.add('active');
  }

  // ── Barra de localização (breadcrumb "Área › Subárea") ─────────────────────
  const LBL_IM  = { kpis:'KPIs', pipeline:'Captação', acm:'ACM', gestao:'Gestão Exclusiva', visitas:'Leads', vendas:'Vendas', carteira:'Imóveis', condominios:'Condomínios' };
  const LBL_PV  = { jobs:'Jobs', resumo:'Resumo Anual', airbnb:'Pontos Airbnb' };
  const LBL_FMS = { dash:'Dashboard', lanc:'Lançamentos', importar:'Importar', fluxo:'Fluxo Mensal', cpr:'A Receber', saldos:'Saldos', dre:'DRE', metas:'Metas', res:'Reservas', sim:'Simulador', config:'Config' };

  // Atualiza o título do topo. sub vazio = só a área.
  window.alexSetCrumb = function (area, sub) {
    const el = document.querySelector('.sb-topbar-title');
    if (!el) return;
    el.innerHTML = sub
      ? '<span class="crumb-area">' + area + '</span>'
        + '<span class="crumb-sep">›</span>'
        + '<span>' + sub + '</span>'
      : area;
  };

  // Trilha do topo CLICÁVEL (padrão aprovado 26/07 junto com o .btn-back):
  // levels = [{ label, href?, onclick? }] — cada nível leva à tela correspondente;
  // o último é a tela atual (não clicável). Rótulos entram por textContent — texto
  // digitado pelo Alex (nome de ficha) nunca vira HTML nem código (lição do D-1).
  window.alexSetCrumbTrail = function (levels) {
    const el = document.querySelector('.sb-topbar-title');
    if (!el || !Array.isArray(levels) || !levels.length) return;
    el.textContent = '';
    levels.forEach(function (lv, i) {
      if (i) {
        const sep = document.createElement('span');
        sep.className = 'crumb-sep'; sep.textContent = '›';
        el.appendChild(sep);
      }
      const last = i === levels.length - 1;
      if (!last && (lv.href || lv.onclick)) {
        const a = document.createElement('a');
        a.className = 'crumb-link';
        a.textContent = lv.label;
        a.href = lv.href || '#';
        if (lv.onclick) a.addEventListener('click', function (e) { e.preventDefault(); lv.onclick(); });
        el.appendChild(a);
      } else {
        const s = document.createElement('span');
        s.className = last ? 'crumb-atual' : 'crumb-area';
        s.textContent = lv.label;
        el.appendChild(s);
      }
    });
  };

  function initCrumb() {
    let area = 'Alex OS', sub = '';
    if      (page === 'hoje.html')      area = 'Dash';
    else if (page === 'dia.html')       area = 'Dia';
    else if (page === 'tarefas.html')   area = 'Tarefas';
    else if (page === 'projetos.html')  area = 'IA';
    else if (page === 'contatos.html')  { area = 'Pandora'; sub = 'Pessoas'; }
    // Telas da reforma: trilha clicável em todos os níveis (padrão 26/07).
    // "Cadastros" é grupo de menu, sem tela própria — fica sem link.
    else if (page === 'bairros.html')      { window.alexSetCrumbTrail([{ label: 'Pandora', href: 'imoveis.html' }, { label: 'Cadastros' }, { label: 'Bairros' }]); return; }
    else if (page === 'imobiliarias.html') { window.alexSetCrumbTrail([{ label: 'Pandora', href: 'imoveis.html' }, { label: 'Cadastros' }, { label: 'Imobiliárias' }]); return; }
    else if (page === 'listas.html')       { window.alexSetCrumbTrail([{ label: 'Configurações' }, { label: 'Listas do sistema' }]); return; }
    else if (page === 'dd.html')        { area = 'Pandora'; sub = 'Due Diligence'; }
    else if (page === 'photo.html')     { area = 'P&V'; sub = LBL_PV[localStorage.getItem('pv_tab')] || 'Jobs'; }
    else if (page === 'financeiro.html'){ area = 'FMS'; sub = LBL_FMS[localStorage.getItem('fms_tab')] || 'Dashboard'; }
    else if (page === 'imoveis.html')   { area = 'Pandora'; sub = LBL_IM[imTab] || 'Captação'; }
    window.alexSetCrumb(area, sub);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCrumb);
  else initCrumb();
})();

// ── Topbar extras (relógio + toggle de tema) — centralizados aqui como piloto
(function () {
  function initTopbarExtras() {
    const right = document.querySelector('.sb-topbar-right');
    if (!right) {
      // se a topbar ainda não existe, tentar depois
      document.addEventListener('DOMContentLoaded', initTopbarExtras);
      return;
    }
    if (right.querySelector('.sb-clock')) return; // já injetado

    // 'beforeend': relógio + toggle SEMPRE por último — botões de conteúdo das
    // páginas ficam à esquerda deles (padrão de layout 21/06; regressão 6.12).
    right.insertAdjacentHTML('beforeend', `
      <div class="sb-clock">
        <span id="sbClockTime" class="sb-clock-time">--:--</span>
        <span id="sbClockDate" class="sb-clock-date"></span>
      </div>
      <div class="theme-seg" id="themeToggle">
        <div class="tt-opt" id="ttLight" title="Modo claro"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg></div>
        <div class="tt-opt" id="ttDark" title="Modo escuro"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></div>
      </div>
    `);

    function tick() {
      const n = new Date();
      const t = document.getElementById('sbClockTime');
      const d = document.getElementById('sbClockDate');
      if (t) t.textContent = n.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (d) d.textContent = n.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
    }
    tick();
    setInterval(tick, 1000);

    function applyTheme(t) {
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('aos_theme', t);
      const light = document.getElementById('ttLight');
      const dark  = document.getElementById('ttDark');
      if (light) light.classList.toggle('active', t === 'light');
      if (dark)  dark.classList.toggle('active', t === 'dark');
    }
    applyTheme(localStorage.getItem('aos_theme') || 'dark');

    right.addEventListener('click', function (e) {
      const opt = e.target.closest('.tt-opt');
      if (!opt) return;
      applyTheme(opt.id === 'ttLight' ? 'light' : 'dark');
    });
  }
  initTopbarExtras();
})();
