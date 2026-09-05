// dd-emitir-certidao — emissão automática de certidões pela Infosimples (Due Diligence, Etapa D1).
// Irmã das dd-ler-matricula / dd-ler-certidao, MESMO padrão (CORS, verify_jwt=true → só logado,
// segredos via Deno.env.get). É a ÚNICA função que toca dinheiro e a única que conhece o
// token da Infosimples. Fluxo (ADR D-1/D-6/D-8/D-9 do 02_ARQUITETURA.md):
//   1. confere quem chamou (JWT) e lê a certidão + a parte no banco (service role);
//   2. valida os dados obrigatórios do service (R-6) — se faltar, NÃO cobra;
//   3. GUARDA DE DUPLA COBRANÇA: claim atômico (status → 'emitindo') só a partir de
//      em_aberto/pendencia/duvida — se já está emitindo/aguardando/recebida, recusa sem cobrar (CA-12);
//   4. monta os parâmetros certos por service (variante CPF/CNPJ) e lê os segredos do cofre;
//   5. chama a Infosimples;
//   6. REGISTRA em dd_emissoes SEMPRE (sucesso ou erro) — fidelidade do custo (R-13, CA-19/20);
//   7. trata o retorno: PDF na hora → cofre + status 'recebida' (devolve base64 pro front classificar);
//      TJSP sem certidão → 'aguardando' (guarda protocolo + data do pedido + previsão). A verificação/baixa
//      da certidão TJSP pronta é GRATUITA no portal e-SAJ + anexo manual (D-9) — SEM 2ª chamada paga aqui;
//      instabilidade do órgão → 'pendencia' (R-16).
//   A classificação é REUSO: o front recebe o base64 e chama dd-ler-certidao (ADR D-2) — zero código novo aqui.
//
// Deploy: via Supabase MCP (deploy_edge_function) ou `supabase functions deploy dd-emitir-certidao`.
//   verify_jwt = TRUE (default) — só usuário logado.
// Secrets (cofre do Supabase → Edge Functions → Secrets):
//   INFOSIMPLES_TOKEN (obrigatório) · DD_EMAIL_ENVIO (fallback alexccfontes@gmail.com) ·
//   DD_TJSP_FINALIDADE (fallback) · DD_GOVBR_CPF / DD_GOVBR_SENHA (só p/ Cível TJSP).
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY já vêm do ambiente da função.
// NENHUM segredo aparece em log nem no retorno pro front (R-9, R-17, CA-5, CA-18).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const INFOSIMPLES_BASE = 'https://api.infosimples.com/api/v2/consultas/';
const COFRE = 'dd-certidoes';

// TJSP (D-9, 25/07): a função faz SÓ o pedido inicial (pedido-certidao, R$0,24, 1×). Verificar/baixar
// a certidão pronta é GRATUITO no portal e-SAJ + anexo manual (fluxo você-resolve) — NÃO há 2ª chamada
// paga (obter-certidao), nem modo 'buscar', nem robô agendado. Custo do TJSP = R$0,24 fixos por certidão.

// Só dígitos (aceita CPF/CNPJ já formatado do cadastro).
const soDigitos = (s: string) => String(s || '').replace(/\D/g, '');

// ─── Mapa certidão(chave DD_CATALOGO) → service Infosimples ───────────────────
// AUTORIDADE dos parâmetros reais (o front carrega só o mínimo — ver risco §6.2 da arquitetura).
// Cada entrada sabe montar seus params conforme a parte (PF/PJ) e os segredos.
// requer = campos da PESSOA obrigatórios (validados ANTES de cobrar). email/finalidade/gov.br
// são configuração do escritório (segredos), não travam no front.
type Parte = Record<string, any>;
type Secrets = { email: string; finalidade: string; govbrCpf: string; govbrSenha: string };

interface ServiceDef {
  service: (p: Parte) => string;
  params: (p: Parte, s: Secrets) => Record<string, string>;
  requer?: string[];      // campos da parte obrigatórios
  assincrono?: boolean;   // TJSP pedido-certidao: pode não sair na hora
  govbr?: boolean;        // exige credencial gov.br do cofre
}

const SERVICES: Record<string, ServiceDef> = {
  // Trabalhista CNDT (TST) — cpf OU cnpj
  cndt: {
    service: () => 'tribunal/tst/cndt',
    params: (p) => (p.tipo === 'empresa' ? { cnpj: soDigitos(p.documento) } : { cpf: soDigitos(p.documento) }),
  },
  // Trabalhista PJe (TRT-2) — cpf (PF) ou cnpj_raiz (PJ, 8 primeiros dígitos)
  pje: {
    service: () => 'tribunal/trt2/ceat-digital',
    params: (p) => (p.tipo === 'empresa'
      ? { cnpj_raiz: soDigitos(p.documento).slice(0, 8) }
      : { cpf: soDigitos(p.documento) }),
  },
  // Trabalhista físico (TRT-2) — cpf + nome (obrigatório)
  trt2_fisico: {
    service: () => 'tribunal/trt2/ceat',
    requer: ['nome'],
    params: (p) => ({ cpf: soDigitos(p.documento), nome: p.nome }),
  },
  // Cartão CNPJ (Receita) — cnpj
  cartao_cnpj: {
    service: () => 'receita-federal/cnpj',
    params: (p) => ({ cnpj: soDigitos(p.documento) }),
  },
  // CND Federal CPF (PGFN) — cpf + birthdate aaaa-mm-dd (obrigatório)
  cnd_federal_cpf: {
    service: () => 'receita-federal/pgfn',
    requer: ['data_nascimento'],
    params: (p) => ({ cpf: soDigitos(p.documento), birthdate: String(p.data_nascimento) }),
  },
  // Protestos (CENPROT-SP) — cpf (PF)
  protestos: {
    service: () => 'cenprot-sp/protestos',
    params: (p) => ({ cpf: soDigitos(p.documento) }),
  },
  // Protestos (CENPROT-SP) — cnpj (PJ)
  protestos_cnpj: {
    service: () => 'cenprot-sp/protestos',
    params: (p) => ({ cnpj: soDigitos(p.documento) }),
  },
  // Certidões do TJSP — modelo=4 + cpf + rg + genero(M/F) + email_envio + nome_completo. Assíncrono (2 etapas).
  certidoes_tjsp: {
    service: () => 'tribunal/tjsp/pedido-certidao',
    requer: ['rg', 'sexo'],
    assincrono: true,
    params: (p, s) => ({
      modelo: '4',
      cpf: soDigitos(p.documento),
      rg: String(p.rg || ''),
      genero: String(p.sexo || '').toUpperCase().startsWith('F') ? 'F' : 'M',
      email_envio: s.email,
      nome_completo: p.nome,
    }),
  },
  // Cível TJSP 1º grau — cpf + nome + email + finalidade + login gov.br (do cofre)
  civel_tjsp: {
    service: () => 'tribunal/tjsp/pedido-civel',
    govbr: true,
    params: (p, s) => ({
      cpf: soDigitos(p.documento),
      nome: p.nome,
      email: s.email,
      finalidade: s.finalidade,
      login_cpf: s.govbrCpf,
      login_senha: s.govbrSenha,
    }),
  },
};

// Rótulos simples do que falta (pro aviso "falta X" — mesma linguagem do front).
const REQUER_LBL: Record<string, string> = {
  rg: 'RG', sexo: 'sexo', data_nascimento: 'data de nascimento', nome: 'nome completo',
};

// hoje + N dias ÚTEIS (pula sábado/domingo; NÃO considera feriado — simplificação consciente §6.5).
function maisDiasUteis(n: number): string {
  const d = new Date();
  let add = 0;
  while (add < n) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) add++;
  }
  return d.toISOString().slice(0, 10);
}

// Data em ISO aaaa-mm-dd no fuso de Brasília (UTC-3). Usada para gravar `emissao_data`
// (a data do pedido do TJSP), que depois pré-preenche o link do portal e-SAJ (D-9).
function isoDateBRT(ts: string): string {
  const d = new Date(ts);
  const brt = new Date(d.getTime() - 3 * 3600 * 1000);
  return brt.toISOString().slice(0, 10);
}

// Decodifica o JWT (já validado pela plataforma via verify_jwt) só pra saber QUEM apertou o botão.
function decodeUser(auth: string | null): { sub?: string; email?: string } {
  try {
    const t = (auth || '').replace(/^Bearer\s+/i, '');
    const payload = t.split('.')[1];
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return { sub: json.sub, email: json.email };
  } catch (_e) { return {}; }
}

// Detecta instabilidade do órgão (R-16) pela mensagem/código — vira PENDÊNCIA, nunca negativa.
function ehInstabilidade(code: number, msg: string): boolean {
  const m = String(msg || '').toLowerCase();
  if (/dados incompletos|site de origem|sobrecarreg|indispon|instá|instabil|fora do ar|timeout|tempo (limite|esgotado)|tente novamente|temporariamente/.test(m)) return true;
  // Faixa de códigos da Infosimples para erro de site de origem / timeout (não erro de parâmetro).
  // 606 (parâmetros obrigatórios) e 607 (parâmetro inválido) NÃO entram aqui: são erro de montagem,
  // devem mostrar a mensagem real, não virar "pendência/tente de novo" (ajuste de deploy 25/07).
  if ([604, 605, 608, 609, 610, 612, 613, 614, 615].includes(code)) return true;
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const j = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  // Vars de escopo amplo pra registrar em dd_emissoes mesmo se algo estourar no meio.
  const supaUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const sb = createClient(supaUrl, serviceKey);

  let logBase: Record<string, any> = {};
  let claimed = false;
  let certId = '';
  let prevStatus = 'em_aberto';
  let releaseTo = 'pendencia'; // pra onde soltar o claim se a emissão der erro (volta pra pendência)

  // Grava uma linha em dd_emissoes. NUNCA deixa uma chamada cobrada sem registro (R-13).
  async function logEmissao(extra: Record<string, any>) {
    try { await sb.from('dd_emissoes').insert({ ...logBase, ...extra }); }
    catch (e) { console.error('dd_emissoes insert falhou:', String(e)); }
  }
  // Solta o claim (volta o status anterior) quando dá erro ANTES/na chamada — pra poder tentar de novo.
  async function soltarClaim(novo: string) {
    if (!claimed || !certId) return;
    try { await sb.from('dd_certidoes').update({ status: novo }).eq('id', certId); } catch (_e) {}
  }

  try {
    if (!supaUrl || !serviceKey) return j({ error: 'Ambiente da função sem SUPABASE_URL / SERVICE_ROLE_KEY.' }, 500);

    const token = Deno.env.get('INFOSIMPLES_TOKEN');
    if (!token) return j({ error: 'INFOSIMPLES_TOKEN não configurado no cofre do Supabase (Edge Functions → Secrets).' }, 500);

    const body = await req.json().catch(() => ({}));
    certId = String(body.certidao_id || '');
    // Na D1 só existe emissão cobrada (ADR D-9): a verificação/baixa da certidão TJSP pronta
    // é gratuita no portal e-SAJ, não chamada paga — não há mais modo 'buscar'.
    const acao = 'emitir';
    if (!certId) return j({ error: 'certidao_id não informado.' }, 400);

    const user = decodeUser(req.headers.get('authorization'));

    // 1) Lê a certidão + a parte + o dossiê (service role passa por cima da RLS).
    const { data: cert, error: eCert } = await sb.from('dd_certidoes').select('*').eq('id', certId).single();
    if (eCert || !cert) return j({ error: 'Certidão não encontrada.' }, 404);
    prevStatus = cert.status || 'em_aberto';

    let parte: Parte | null = null;
    if (cert.parte_id) {
      const { data: p } = await sb.from('dd_partes').select('*').eq('id', cert.parte_id).single();
      parte = p || null;
    }
    if (!parte) return j({ error: 'Esta certidão não tem uma pessoa/empresa vinculada — emissão automática indisponível.' }, 400);

    const def = SERVICES[cert.chave];
    if (!def) return j({ error: 'Esta certidão não tem emissão automática nesta etapa.' , tipo: 'sem_auto' }, 400);

    // Base do registro de consumo (cópias que sobrevivem ao apagar o caso — ADR D-6).
    logBase = {
      dossie_id: cert.dossie_id || null,
      certidao_id: cert.id,
      parte_id: parte.id || null,
      certidao_chave: cert.chave,
      parte_nome: parte.nome || null,
      parte_documento: parte.documento || null,
      service: def.service(parte),
      acao,
      disparado_por: user.sub || null,
      disparado_por_email: user.email || null,
    };

    // Segredos de configuração (nunca retornam pro front nem vão pra log).
    const secrets: Secrets = {
      email: Deno.env.get('DD_EMAIL_ENVIO') || 'alexccfontes@gmail.com',
      finalidade: Deno.env.get('DD_TJSP_FINALIDADE') || 'Due diligence imobiliaria (verificacao de certidoes)',
      govbrCpf: Deno.env.get('DD_GOVBR_CPF') || '',
      govbrSenha: Deno.env.get('DD_GOVBR_SENHA') || '',
    };

    // 2) Valida dados obrigatórios ANTES de cobrar (R-6, CA-9/10/11) — sem claim, sem custo.
    if (acao === 'emitir') {
      const faltando = (def.requer || []).filter((f) => !String(parte![f] || '').trim());
      if (faltando.length) {
        return j({
          error: 'faltam_dados',
          faltando,
          faltando_label: faltando.map((f) => REQUER_LBL[f] || f),
          tipo: 'faltam_dados',
        }, 422);
      }
      if (def.govbr && (!secrets.govbrCpf || !secrets.govbrSenha)) {
        return j({ error: 'Esta certidão exige login gov.br, que ainda não está configurado no cofre.', tipo: 'sem_govbr' }, 422);
      }
    }

    // 3) GUARDA DE DUPLA COBRANÇA — claim atômico (CA-12, ADR D-8).
    // Só reivindica a partir de estados re-emitíveis; se outra aba/pessoa já reivindicou
    // (status já 'emitindo'/'aguardando'/'recebida'/classificado), 0 linhas → recusa SEM cobrar.
    const reemitiveis = ['em_aberto', 'pendencia', 'duvida'];
    const { data: claim, error: eClaim } = await sb
      .from('dd_certidoes')
      .update({ status: 'emitindo' })
      .eq('id', certId)
      .in('status', reemitiveis)
      .select();
    if (eClaim) return j({ error: 'Falha ao reservar a emissão: ' + String(eClaim.message || eClaim) }, 500);
    if (!claim || !claim.length) {
      return j({ error: 'Esta certidão já está sendo emitida ou já foi resolvida — nada foi cobrado.', tipo: 'bloqueada' }, 409);
    }
    claimed = true;
    releaseTo = 'pendencia';

    // 4) Monta os parâmetros e chama a Infosimples (POST form — mantém token/senha fora da URL).
    const service = def.service(parte);
    const params: Record<string, string> = def.params(parte, secrets);

    const form = new URLSearchParams();
    form.set('token', token);
    form.set('timeout', '600');
    for (const [k, v] of Object.entries(params)) form.set(k, v);

    let resp: any = null;
    try {
      const r = await fetch(INFOSIMPLES_BASE + service, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: form.toString(),
      });
      resp = await r.json();
    } catch (e) {
      // Falha de REDE (não chegou a cobrar de forma confirmada). Registra como tentativa sem custo e libera.
      await logEmissao({ custo: 0, sucesso: false, code: 0, mensagem: 'Falha de rede ao chamar a Infosimples' });
      await soltarClaim('pendencia');
      return j({ error: 'Não consegui falar com a Infosimples agora. Tente de novo.', tipo: 'pendencia' }, 502);
    }

    const code: number = Number(resp?.code ?? 0);
    const codeMsg: string = String(resp?.code_message || (resp?.errors ? JSON.stringify(resp.errors) : '') || '');
    const price: number = Number(resp?.header?.price ?? 0);
    const receipts: string[] = Array.isArray(resp?.site_receipts) ? resp.site_receipts : [];
    const dado0: any = Array.isArray(resp?.data) && resp.data.length ? resp.data[0] : null;

    // 6) REGISTRA SEMPRE (deu certo ou não). Este é o passo que garante fidelidade do custo (R-13).
    const sucesso = code === 200;

    // 7) Trata o retorno.
    // 7a) Instabilidade do órgão → PENDÊNCIA (R-16, CA-22). Não classifica.
    if (!sucesso && ehInstabilidade(code, codeMsg)) {
      await logEmissao({ custo: price, sucesso: false, code, mensagem: codeMsg, comprovante_url: receipts[0] || null });
      await sb.from('dd_certidoes').update({ status: 'pendencia' }).eq('id', certId);
      return j({ tipo: 'pendencia', cert: { status: 'pendencia' }, mensagem: codeMsg || 'Instabilidade do órgão.' }, 200);
    }
    // 7b) Outro erro (parâmetro, saldo, etc.) → registra e volta pra pendência (permite corrigir e tentar).
    if (!sucesso) {
      await logEmissao({ custo: price, sucesso: false, code, mensagem: codeMsg, comprovante_url: receipts[0] || null });
      await soltarClaim('pendencia');
      return j({ error: codeMsg || ('Infosimples retornou código ' + code), tipo: 'erro', code }, 200);
    }

    // 7c) TJSP assíncrono: protocolo sem certidão pronta → AGUARDANDO (R-8, CA-16).
    // Guarda o nº e a DATA do pedido (pro link do e-SAJ) + a previsão. A verificação/baixa
    // da certidão pronta é GRATUITA no portal e-SAJ + anexo manual (ADR D-9) — a função NÃO
    // faz nenhuma 2ª chamada paga. Detecta o número de pedido no data[0].
    const protocolo = dado0
      ? (dado0.numero_pedido || dado0.protocolo || dado0.numero_solicitacao || dado0.numero_pedido_certidao || dado0.pedido || null)
      : null;
    // ⚠️ IMPORTANTE (bug corrigido 25/07): a certidoes_tjsp é assíncrona e retorna, junto do
    // numero_pedido, um `site_receipt` que é só o RECIBO DO PEDIDO em HTML — NÃO é a certidão e
    // NÃO é PDF. Por isso NÃO se olha `!receipts.length` aqui: havendo protocolo, SEMPRE vai pro
    // 'aguardando' e o recibo do pedido é IGNORADO (não sobe pro cofre, não vai pra IA). A certidão
    // pronta é verificada de graça no e-SAJ + anexo manual (D-9).
    if (def.assincrono) {
      if (protocolo) {
        const previsao = maisDiasUteis(5);
        const pedidoData = isoDateBRT(new Date().toISOString()); // data do pedido (ISO BRT) — pré-preenche o link do e-SAJ
        await logEmissao({ custo: price, sucesso: true, code, mensagem: codeMsg, protocolo: String(protocolo), comprovante_url: receipts[0] || null });
        await sb.from('dd_certidoes').update({
          status: 'aguardando',
          emissao_protocolo: String(protocolo),
          emissao_previsao: previsao,
          emissao_data: pedidoData,
        }).eq('id', certId);
        // Verificação IMEDIATA (R-3/CA-2): a certidão negativa do TJSP costuma já estar pronta
        // no instante do pedido (foi o caso do primeiro caso real testado). Dispara o robô dd-buscar-tjsp SÓ para
        // esta certidão, em SEGUNDO PLANO e BEST-EFFORT — se falhar, a emissão NÃO quebra e a
        // grade de 3h pega depois. Não segura a resposta do pedido.
        try {
          const roboSecret = Deno.env.get('DD_ROBO_SECRET') || '';
          if (roboSecret) {
            const pv = fetch(`${supaUrl}/functions/v1/dd-buscar-tjsp`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceKey}`,
                'apikey': serviceKey,
                'x-robo-secret': roboSecret,
              },
              body: JSON.stringify({ certidao_id: certId, ciclo: 'imediata' }),
            }).catch((e) => { console.error('Verificação imediata TJSP falhou (segue best-effort):', String(e)); });
            try { (globalThis as any).EdgeRuntime?.waitUntil?.(pv); } catch (_e) { /* fora do Edge Runtime */ }
          } else {
            console.warn('DD_ROBO_SECRET ausente: verificação imediata do TJSP pulada (a grade de 3h ainda pega).');
          }
        } catch (_e) { /* nunca quebra a emissão */ }
        return j({
          tipo: 'aguardando',
          cert: { status: 'aguardando', emissao_protocolo: String(protocolo), emissao_previsao: previsao, emissao_data: pedidoData },
        }, 200);
      }
      // Assíncrono mas SEM número de pedido (anômalo) → pendência; NUNCA classifica o recibo.
      await logEmissao({ custo: price, sucesso, code, mensagem: codeMsg || 'Pedido TJSP sem número de protocolo', comprovante_url: receipts[0] || null });
      await sb.from('dd_certidoes').update({ status: 'pendencia' }).eq('id', certId);
      return j({ tipo: 'pendencia', cert: { status: 'pendencia' }, mensagem: 'O TJSP não retornou o número do pedido. Tente de novo.' }, 200);
    }

    // 7d) Sucesso com comprovante na hora → cofre + status 'recebida' + devolve base64 pro front classificar.
    if (!receipts.length) {
      // Sucesso mas sem comprovante e sem protocolo (caso raro) → pendência p/ não classificar no vazio.
      await logEmissao({ custo: price, sucesso: true, code, mensagem: codeMsg || 'Sem comprovante retornado' });
      await sb.from('dd_certidoes').update({ status: 'pendencia' }).eq('id', certId);
      return j({ tipo: 'pendencia', cert: { status: 'pendencia' }, mensagem: 'A Infosimples não retornou o comprovante.' }, 200);
    }

    // Baixa o comprovante (PDF) e sobe pro cofre no MESMO padrão de nome da Etapa C.
    let arquivoPath: string | null = null;
    let arquivoNome: string | null = null;
    let pdfB64: string | null = null;
    try {
      const rf = await fetch(receipts[0]);
      const bytes = new Uint8Array(await rf.arrayBuffer());
      const slugNome = String(parte.nome || 'parte').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'parte';
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      arquivoNome = `${cert.chave}_${slugNome}_${stamp}.pdf`;
      arquivoPath = `${cert.dossie_id}/${arquivoNome}`;
      const up = await sb.storage.from(COFRE).upload(arquivoPath, bytes, { contentType: 'application/pdf', upsert: false });
      if (up.error) throw up.error;
      // base64 pro front reusar dd-ler-certidao (ADR D-2) sem baixar de novo.
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      pdfB64 = btoa(bin);
    } catch (e) {
      // Cobrou e recebeu, mas falhou ao guardar. Registra o custo (não some) e marca pendência.
      await logEmissao({ custo: price, sucesso: true, code, mensagem: 'Cobrado, mas falha ao guardar o comprovante no cofre', comprovante_url: receipts[0] || null });
      await sb.from('dd_certidoes').update({ status: 'pendencia' }).eq('id', certId);
      return j({ tipo: 'pendencia', cert: { status: 'pendencia' }, mensagem: 'A certidão foi emitida, mas não consegui guardar o comprovante. Tente de novo.' }, 200);
    }

    await logEmissao({ custo: price, sucesso: true, code, mensagem: codeMsg, comprovante_url: receipts[0] || null, protocolo: protocolo ? String(protocolo) : null });
    await sb.from('dd_certidoes').update({
      status: 'recebida',
      arquivo_path: arquivoPath,
      arquivo_nome: arquivoNome,
    }).eq('id', certId);

    return j({
      tipo: 'recebida',
      cert: { status: 'recebida', arquivo_path: arquivoPath, arquivo_nome: arquivoNome },
      pdf_base64: pdfB64,   // o front chama dd-ler-certidao com isto (reuso da classificação)
    }, 200);

  } catch (e) {
    // Erro inesperado: se já tinha reivindicado, devolve ao estado anterior (pendencia)
    // pra não travar em "emitindo".
    await soltarClaim('pendencia');
    return j({ error: String(e), tipo: 'erro' }, 500);
  }
});
