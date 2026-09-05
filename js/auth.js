/**
 * auth.js — Tranca de acesso (Fase 1b — Supabase Auth).
 * Carregado logo após js/supabase.js em todas as telas do sistema.
 *
 * O que faz:
 *  - Antes de mostrar a tela, confere se existe sessão válida (login feito).
 *  - Se NÃO houver sessão, manda para a tela de login (index.html).
 *  - Expõe window.alexLogout() para o botão "Sair" do menu.
 *
 * Observação honesta: esta é a tranca de PORTA (confere o crachá na entrada).
 * A tranca do banco em si (impedir a chave pública de ler/alterar dados) é a
 * Fase 2 (RLS no Supabase). Esta fase é pré-requisito daquela.
 */
(function () {
  'use strict';

  // Esconde a página enquanto confere o login — evita "piscar" o conteúdo
  // antes de redirecionar quem não está logado.
  var root = document.documentElement;
  root.style.visibility = 'hidden';

  function reveal() { root.style.visibility = ''; }

  async function guard() {
    try {
      const sb = await initSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        location.replace('index.html');
        return; // página será trocada; não revela
      }
      window._authSession = session;
    } catch (e) {
      // Falha de rede/biblioteca: não trancar o usuário para fora (fail-open).
      // A proteção real do banco virá da Fase 2 (RLS).
      console.error('Falha ao verificar login:', e);
    }
    reveal();
  }

  guard();

  // Logout — usado pelo item "Sair" do menu lateral (sidebar.js).
  window.alexLogout = async function () {
    try {
      const sb = await initSupabase();
      await sb.auth.signOut();
    } catch (e) {
      console.error('Falha ao sair:', e);
    }
    location.replace('index.html');
  };
})();
