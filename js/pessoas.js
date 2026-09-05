// js/pessoas.js — Alex OS v2
// Gravação de pessoa e do vínculo de corretor com imobiliária, num lugar só.
// (02_ARQUITETURA seções 3.2 e 14.2 · ADRs D-16/D-17)
//
// Por que existe: a mesma regra vai ser usada pela ficha de Pessoa (contatos.html,
// Etapa 2) e pela ficha de Lead/Visita (Etapa 3). Escrever duas vezes é como ter
// duas plantas da mesma casa — uma hora divergem.
//
// Depende de db() (js/supabase.js). Carregar DEPOIS dele.

(function (global) {
  'use strict';

  var COD_REPETIDO = '23505';   // o banco recusou porque esse vínculo já existe

  // Grava o vínculo de corretor por DIFERENÇA, agindo SÓ na linha que a tela
  // carregou (D-17) — nunca "apaga todos os vínculos de corretor e recria", que
  // removeria em silêncio um vínculo criado de propósito na ficha da Imobiliária.
  //
  // est = {
  //   ehCorretor        → o tipo Corretor está marcado agora?
  //   vinculo           → null (em branco) | 'auto' (autônomo) | { id: imobiliariaId, ... }
  //   vinculoId         → id da linha de imobiliaria_pessoas carregada ao abrir (ou null)
  //   vinculoOrigImobId → a qual imobiliária essa linha apontava quando abriu
  // }
  // Retorna { ok, mexeu, error }
  async function salvarVinculoCorretor(pessoaId, est) {
    est = est || {};
    // Corretor desmarcado: não cria, não remove, não mexe — "fica guardado".
    if (!est.ehCorretor) return { ok: true, mexeu: false };

    var alvo = (est.vinculo && est.vinculo !== 'auto') ? est.vinculo.id : null;

    if (alvo) {
      // já é essa imobiliária → nada a fazer (não escreve à toa)
      if (est.vinculoId && est.vinculoOrigImobId === alvo) return { ok: true, mexeu: false };
      if (est.vinculoId) {
        var up = await db().from('imobiliaria_pessoas')
          .update({ imobiliaria_id: alvo, updated_at: new Date().toISOString() })
          .eq('id', est.vinculoId);
        if (!up.error) return { ok: true, mexeu: true };
        // o trio já existia (criado pela ficha da Imobiliária): fica com o que já
        // existe e apaga a linha antiga, em vez de duplicar
        if (String(up.error.code) === COD_REPETIDO) {
          var del = await db().from('imobiliaria_pessoas').delete().eq('id', est.vinculoId);
          return del.error ? { ok: false, error: del.error } : { ok: true, mexeu: true };
        }
        return { ok: false, error: up.error };
      }
      var ins = await db().from('imobiliaria_pessoas')
        .insert({ imobiliaria_id: alvo, pessoa_id: pessoaId, papel: 'Corretor' });
      if (ins.error && String(ins.error.code) !== COD_REPETIDO) return { ok: false, error: ins.error };
      return { ok: true, mexeu: true };
    }

    // Autônomo ou em branco: sai a linha carregada, se havia. Outros vínculos de
    // corretor (caso raro) ficam intocados — quem gerencia é a ficha da imobiliária.
    if (est.vinculoId) {
      var d = await db().from('imobiliaria_pessoas').delete().eq('id', est.vinculoId);
      if (d.error) return { ok: false, error: d.error };
      return { ok: true, mexeu: true };
    }
    return { ok: true, mexeu: false };
  }

  // Cria uma pessoa a partir de qualquer tela (Visita, Lead, Captação), já com os
  // campos da Etapa 2, e grava o vínculo de corretor quando houver.
  // p = { nome, tel, email, empresa, obs, tipos, rg, cpf, creci, corretor_autonomo,
  //       imobiliaria }  → imobiliaria = { id, nome } | 'auto' | null
  // Retorna { ok, pessoa, avisoVinculo }
  async function criarPessoaInline(p) {
    p = p || {};
    var nome = String(p.nome || '').trim();
    if (!nome) return { ok: false, error: { message: 'Nome obrigatório' } };
    var tipos = Array.isArray(p.tipos) ? p.tipos : [];
    var corretor = tipos.indexOf('Corretor') >= 0;
    var payload = {
      nome: nome,
      tel:     (p.tel     || '').trim() || null,
      email:   (p.email   || '').trim() || null,
      empresa: (p.empresa || '').trim() || null,
      obs:     (p.obs     || '').trim() || null,
      rg:      (p.rg      || '').trim() || null,
      cpf:     (p.cpf     || '').trim() || null,
      creci:   (p.creci   || '').trim() || null,
      tipos: tipos,
      updated_at: new Date().toISOString()
    };
    if (corretor) payload.corretor_autonomo = (p.imobiliaria === 'auto') || !!p.corretor_autonomo;

    var r = await db().from('pessoas').insert(payload)
      .select('id,nome,tel,email,empresa,tipos,rg,cpf,creci,corretor_autonomo').single();
    if (r.error || !r.data) return { ok: false, error: r.error };

    var rv = await salvarVinculoCorretor(r.data.id, {
      ehCorretor: corretor,
      vinculo: p.imobiliaria || null,
      vinculoId: null,
      vinculoOrigImobId: null
    });
    // a pessoa fica criada mesmo se o vínculo falhar — quem chamou decide como avisar
    return { ok: true, pessoa: r.data, avisoVinculo: rv.ok ? null : (rv.error && rv.error.message) };
  }

  global.AlexPessoas = { salvarVinculoCorretor: salvarVinculoCorretor, criarPessoaInline: criarPessoaInline };
  if (typeof global.salvarVinculoCorretor === 'undefined') global.salvarVinculoCorretor = salvarVinculoCorretor;
  if (typeof global.criarPessoaInline === 'undefined') global.criarPessoaInline = criarPessoaInline;
})(typeof window !== 'undefined' ? window : this);
