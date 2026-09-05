/**
 * airbnb.js — Pontos / créditos do programa de anfitriões Airbnb.
 * Lógica compartilhada entre P&V (photo.html) e FMS (financeiro.html).
 *
 * Regras:
 *  - Cada job com `credito_para` preenchido gera pontos: Direto=1, 1º Indicado=1, Indicado seguinte=0,5.
 *  - Job pago = ponto confirmado; senão = pendente.
 *  - META pontos confirmados = 1 sessão fotográfica gratuita.
 *  - Job usado como prêmio (registrado em premios_airbnb.job_id) é NEUTRO: não soma pontos.
 */
(function () {
  'use strict';
  const META = 10;

  function pontosDoJob(j) {
    if (j.tipo_credito === 'Direto' || j.tipo_credito === '1º Indicado') return 1;
    if (j.tipo_credito === 'Indicado seguinte') return 0.5;
    return 0;
  }

  // Calcula o resumo por anfitrião. jobs = lista completa de jobs; premios = registros premios_airbnb.
  function resumo(jobs, premios) {
    const prizeJobIds = new Set((premios || []).map(p => p.job_id).filter(Boolean));
    const map = {};
    (jobs || []).forEach(j => {
      const cred = (j.credito_para || '').trim();
      if (!cred) return;
      if (!map[cred]) map[cred] = { nome: cred, confirmed: 0, pending: 0 };
      if (prizeJobIds.has(j.id)) return;               // job-prêmio é neutro
      const pts = pontosDoJob(j);
      if (j.status === 'pago') map[cred].confirmed += pts;
      else                     map[cred].pending   += pts;
    });
    Object.values(map).forEach(a => {
      a.usedPrizes    = (premios || []).filter(p => (p.anfitriao || '') === a.nome).length;
      a.earnedPrizes  = Math.floor(a.confirmed / META);
      a.available     = a.earnedPrizes - a.usedPrizes;
      a.cyclePoints   = a.confirmed % META;
    });
    return { map, prizeJobIds };
  }

  // Quantos prêmios disponíveis um anfitrião tem (0 se nenhum).
  function disponivel(nome, jobs, premios) {
    const a = resumo(jobs, premios).map[(nome || '').trim()];
    return a ? Math.max(0, a.available) : 0;
  }

  // Resgata: marca o job como sessão prêmio (pago, R$ 0, sem receita) e grava o uso.
  // NÃO cria lançamento no FMS (cortesia, não houve recebimento).
  async function redeem(jobId, anfitriao, dataUso, obs) {
    const d = window.db();
    const nota = obs || 'Sessão prêmio (crédito Airbnb)';
    const up = await d.from('jobs').update({
      status: 'pago', pago: true, preco: 0, obs: nota, updated_at: new Date().toISOString()
    }).eq('id', jobId);
    if (up.error) return up;
    return await d.from('premios_airbnb').insert({
      anfitriao: anfitriao, data_uso: dataUso, obs: obs || null, job_id: jobId
    });
  }

  window.AlexAirbnb = { META, pontosDoJob, resumo, disponivel, redeem };
})();
