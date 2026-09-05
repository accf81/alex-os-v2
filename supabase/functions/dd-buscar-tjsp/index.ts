// dd-buscar-tjsp — o "robô" que verifica sozinho, DE GRAÇA, se a certidão pedida ao TJSP
// (chave certidoes_tjsp, fluxo pedido-certidao) já ficou pronta no portal e-SAJ, baixa o PDF,
// deixa a IA que já existe (dd-ler-certidao) ler e grava a classificação. NUNCA gasta nada
// (portal gratuito) e NUNCA escreve em dd_emissoes (a tabela de custo da D1).
//
// Diferente das outras dd-*: roda POR AGENDAMENTO, sem usuário logado. Por isso
//   verify_jwt = FALSE + protegida pelo segredo de robô no cabeçalho x-robo-secret (== DD_ROBO_SECRET).
// Base: 02_ARQUITETURA.md (ADR D-1..D-8) + prova de conceito HTTP do e-SAJ (27/07, confirmada
// contra a página real: form downloadForm → POST /sco/realizarDownload.do, campos entity.*).
//
// Deploy (Orquestrador, após o QA): supabase functions deploy dd-buscar-tjsp --no-verify-jwt
//   (ou deploy_edge_function com verify_jwt=false).
// Secrets no cofre: DD_ROBO_SECRET (novo, string longa aleatória).
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY já vêm do ambiente. O e-SAJ NÃO tem login/token (portal aberto).
//
// Modos (ADR D-3):
//   body { certidao_id }         → confere SÓ aquela certidão (verificação imediata pós-pedido, R-3/CA-2).
//   body {} (sem certidao_id)    → varre a fila inteira (grade do pg_cron, R-2/R-5).
//   body { ciclo }               → rótulo do registro ('imediata' | 'agendada'); default deduzido.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-robo-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const COFRE = 'dd-certidoes';
const CHAVE = 'certidoes_tjsp';
const ESAJ_GET = 'https://esaj.tjsp.jus.br/sco/abrirDownload.do?servico=810103';
const ESAJ_BASE = 'https://esaj.tjsp.jus.br';
const FOLGA_EXPIRA_DIAS = 2;   // margem sobre emissao_previsao antes de marcar "expirado" (D-4: feriado forense)
const CLAIM_STALE_MIN = 15;    // um 'verificando' mais velho que isto é resquício de pane, recuperável (D-5)

const soDigitos = (s: unknown) => String(s || '').replace(/\D/g, '');

// CPF no formato do e-SAJ (o campo é nuCpfFormatado; o formato esperado é "000.000.000-00").
function fmtCpf(doc: unknown): string {
  const d = soDigitos(doc);
  if (d.length !== 11) return String(doc || '').trim();
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function fmtCnpj(doc: unknown): string {
  const d = soDigitos(doc);
  if (d.length !== 14) return String(doc || '').trim();
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// Data ISO (aaaa-mm-dd, como vem do tipo date) → dd/mm/aaaa (o que o e-SAJ espera em entity.dtPedido).
function isoParaBR(iso: string): string {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
}
// Hoje em aaaa-mm-dd no fuso de Brasília (UTC-3, sem horário de verão) — mesmo critério da D1.
function hojeBRT(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
// aaaa-mm-dd + n dias corridos.
function maisDias(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// slug do nome + carimbo — MESMO padrão de nome do dd-emitir-certidao (Etapa C).
function nomeArquivo(chave: string, nome: unknown): { nome: string } {
  const slug = String(nome || 'parte').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'parte';
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return { nome: `${chave}_${slug}_${stamp}.pdf` };
}

// PDF bytes → base64 (pro dd-ler-certidao, mesmo caminho do dd-emitir-certidao).
function bytesParaB64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// Extrai um input hidden pelo name, aceitando name/value em qualquer ordem.
function inputHidden(html: string, name: string): string | null {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<input[^>]*name=["']${esc}["'][^>]*>`, 'i');
  const tag = html.match(re);
  if (!tag) return null;
  const v = tag[0].match(/value=["']([^"']*)["']/i);
  return v ? v[1] : '';
}
// Todos os inputs hidden do formulário (carrega _csrf, conversationId, flSegundaVia sem hardcode).
function todosHidden(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<input[^>]*type=["']hidden["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const n = m[0].match(/name=["']([^"']+)["']/i);
    const v = m[0].match(/value=["']([^"']*)["']/i);
    if (n) out[n[1]] = v ? v[1] : '';
  }
  return out;
}

// Classifica o HTML devolvido pelo POST: 'processando' (normal), 'erro_portal' (erro real) ou
// 'resposta_desconhecida' (não reconhecida → trata como processando até o prazo, R-11/CA-10).
function classificaHtml(html: string): { desfecho: string; detalhe: string } {
  const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  // Erro real: dados não conferem / pedido inexistente / inválido (R-10, CA-9).
  const errosReais = [
    'não foi localizado', 'nao foi localizado', 'não localizado', 'nao localizado',
    'não encontrado', 'nao encontrado', 'nenhum registro', 'não confere', 'nao confere',
    'dados informados', 'inválido', 'invalido', 'verifique os dados', 'incorret',
    'pedido inexistente', 'não existe', 'nao existe',
  ];
  // Ainda em processamento — situação esperada e normal dentro dos 5 dias úteis (R-10, CA-8).
  const processando = [
    'em processamento', 'sendo processad', 'aguarde', 'ainda não', 'ainda nao',
    'em elaboração', 'em elaboracao', 'não está disponível', 'nao esta disponivel',
    'não disponível', 'nao disponivel', 'em análise', 'em analise', 'processada',
  ];
  const trecho = (arr: string[]) => arr.find((p) => t.includes(p)) || '';
  const proc = trecho(processando);
  if (proc) return { desfecho: 'processando', detalhe: proc };
  const err = trecho(errosReais);
  if (err) {
    // tenta capturar uma frase curta perto do gatilho pro operador
    const idx = t.indexOf(err);
    const detalhe = t.slice(Math.max(0, idx - 40), idx + 80).trim();
    return { desfecho: 'erro_portal', detalhe: detalhe || err };
  }
  return { desfecho: 'resposta_desconhecida', detalhe: t.slice(0, 160).trim() };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const j = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  // 1) AUTORIZA — segredo de robô no cabeçalho (ADR D-8). Sem ele, 401. É a proteção real.
  const secret = Deno.env.get('DD_ROBO_SECRET') || '';
  const given = req.headers.get('x-robo-secret') || '';
  if (!secret) return j({ error: 'DD_ROBO_SECRET não configurado no cofre.' }, 500);
  if (given !== secret) return j({ error: 'unauthorized' }, 401);

  const supaUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supaUrl || !serviceKey) return j({ error: 'Ambiente sem SUPABASE_URL / SERVICE_ROLE_KEY.' }, 500);
  const sb = createClient(supaUrl, serviceKey);

  const body = await req.json().catch(() => ({}));
  const certidaoId = String(body.certidao_id || '').trim();
  const ciclo = String(body.ciclo || (certidaoId ? 'imediata' : 'agendada'));

  // Registra uma conferência no diário de bordo (NUNCA em dd_emissoes).
  async function registra(cert: any, desfecho: string, extra: Record<string, any> = {}) {
    try {
      await sb.from('dd_verificacoes_tjsp').insert({
        certidao_id: cert?.id || null,
        dossie_id: cert?.dossie_id || null,
        parte_id: cert?.parte_id || null,
        desfecho,
        http_status: extra.http_status ?? null,
        content_type: extra.content_type ?? null,
        detalhe: extra.detalhe ?? null,
        ciclo,
      });
    } catch (e) { console.error('dd_verificacoes_tjsp insert falhou:', String(e)); }
  }

  try {
    // 2) MONTA A FILA.
    let fila: any[] = [];
    if (certidaoId) {
      const { data, error } = await sb.from('dd_certidoes').select('*').eq('id', certidaoId).single();
      if (error || !data) return j({ error: 'Certidão não encontrada.' }, 404);
      if (data.chave !== CHAVE) return j({ ok: true, pulado: 'nao_e_tjsp' }, 200);
      if (!['aguardando', 'verificando'].includes(data.status)) return j({ ok: true, pulado: 'estado_' + data.status }, 200);
      fila = [data];
    } else {
      const { data, error } = await sb.from('dd_certidoes').select('*')
        .eq('chave', CHAVE).in('status', ['aguardando', 'verificando']);
      if (error) return j({ error: 'Falha ao montar a fila: ' + String(error.message || error) }, 500);
      fila = data || [];
    }

    const hoje = hojeBRT();
    const resumo: Record<string, number> = {};
    const bump = (k: string) => { resumo[k] = (resumo[k] || 0) + 1; };

    for (const cert of fila) {
      const r = await processaUma(cert);
      bump(r);
    }

    return j({ ok: true, ciclo, total: fila.length, resumo }, 200);

    // ─── processa UMA certidão ────────────────────────────────────────────────
    async function processaUma(cert: any): Promise<string> {
      // 2a) PRAZO VENCIDO (R-14, CA-11) — antes de reservar. Só expira além de previsao + folga.
      if (cert.emissao_previsao) {
        const limite = maisDias(cert.emissao_previsao, FOLGA_EXPIRA_DIAS);
        if (limite < hoje) {
          const { data: exp } = await sb.from('dd_certidoes')
            .update({ status: 'expirado' })
            .eq('id', cert.id).eq('status', 'aguardando').select();
          if (exp && exp.length) {
            console.warn(`[dd-buscar-tjsp] AVISO prazo_vencido certidao=${cert.id} previsao=${cert.emissao_previsao}`);
            await registra(cert, 'prazo_vencido', { detalhe: `previsão ${cert.emissao_previsao} + folga ${FOLGA_EXPIRA_DIAS}d vencida` });
            return 'expirado';
          }
          // se não estava mais 'aguardando' (outro ciclo mexeu), segue o fluxo normal
        }
      }

      // 3) CADEADO ATÔMICO (D-5, CA-13) — um UPDATE condicional: só quem virar a linha de
      // 'aguardando' (ou de um 'verificando' velho, resquício de pane) segue. Concorrente pega
      // 0 linhas e pula. É atômico no banco: dois ciclos NÃO travam a mesma certidão ao mesmo tempo.
      const staleCorte = new Date(Date.now() - CLAIM_STALE_MIN * 60 * 1000).toISOString();
      const { data: c2, error: eClaim } = await sb.from('dd_certidoes')
        .update({ status: 'verificando', verificando_desde: new Date().toISOString() })
        .eq('id', cert.id)
        .or(`status.eq.aguardando,and(status.eq.verificando,verificando_desde.lt.${staleCorte})`)
        .select();
      if (eClaim) { console.error('[dd-buscar-tjsp] claim falhou:', String(eClaim.message || eClaim)); return 'claim_erro'; }
      if (!c2 || !c2.length) return 'concorrente_pulou';
      Object.assign(cert, c2[0]);

      // 4) DADOS DA CONSULTA — se faltar algo, pendência com motivo e PARA (R-6, CA-12).
      let parte: any = null;
      if (cert.parte_id) {
        const { data: p } = await sb.from('dd_partes').select('*').eq('id', cert.parte_id).single();
        parte = p || null;
      }
      const ehEmpresa = parte && parte.tipo === 'empresa';
      const falta: string[] = [];
      if (!parte) falta.push('a pessoa/empresa vinculada');
      if (!String(cert.emissao_protocolo || '').trim()) falta.push('o número do pedido');
      if (!String(cert.emissao_data || '').trim()) falta.push('a data do pedido');
      if (parte && !String(parte.nome || '').trim()) falta.push('o nome');
      if (parte && !soDigitos(parte.documento)) falta.push(ehEmpresa ? 'o CNPJ' : 'o CPF');
      if (parte && !ehEmpresa && !String(parte.rg || '').trim()) falta.push('o RG');
      if (falta.length) {
        const motivo = 'Falta ' + falta.join(', ') + ' para consultar no TJSP.';
        await sb.from('dd_certidoes').update({ status: 'pendencia', pendencia_motivo: motivo }).eq('id', cert.id);
        await registra(cert, 'falta_dado', { detalhe: motivo });
        return 'falta_dado';
      }

      // 5) GET no e-SAJ → _csrf + endereço do form + cookies (R-7). Sem captcha.
      let getResp: Response;
      try {
        getResp = await fetch(ESAJ_GET, { headers: { 'User-Agent': 'Mozilla/5.0 (DueDiligence-robo)' } });
      } catch (e) {
        // rede/portal fora do ar: não é culpa da certidão — mantém aguardando, tenta no próximo ciclo.
        await liberaParaAguardando(cert.id);
        await registra(cert, 'resposta_desconhecida', { detalhe: 'GET e-SAJ falhou: ' + String(e) });
        return 'esaj_indisponivel';
      }
      const getHtml = await getResp.text();
      const cookies = (getResp.headers as any).getSetCookie?.() as string[] | undefined;
      const cookieHeader = (cookies && cookies.length ? cookies : [])
        .map((c) => c.split(';')[0]).filter(Boolean).join('; ');

      const csrf = inputHidden(getHtml, '_csrf');
      const actionM = getHtml.match(/<form[^>]*action=["']([^"']*realizarDownload[^"']*)["']/i)
        || getHtml.match(/action=["']([^"']*realizarDownload[^"']*)["']/i);
      const action = actionM ? actionM[1] : '';
      if (!csrf || !action) {
        // O e-SAJ mudou (R-17, CA-15). AVISA, NÃO penaliza a certidão (culpa é do nosso raspador).
        console.error(`[dd-buscar-tjsp] ROBÔ QUEBRADO: e-SAJ sem _csrf/action. csrf=${!!csrf} action=${!!action}`);
        await liberaParaAguardando(cert.id);
        await registra(cert, 'robo_quebrado', {
          http_status: getResp.status,
          detalhe: 'Página inicial do e-SAJ sem _csrf ou sem endereço do formulário — o portal pode ter mudado.',
        });
        return 'robo_quebrado';
      }

      // 6) POST — envia o formulário com os dados do pedido (R-8). Carrega os hidden reais do form.
      const form = new URLSearchParams();
      const hidden = todosHidden(getHtml);
      for (const [k, v] of Object.entries(hidden)) form.set(k, v);
      form.set('_csrf', csrf);
      form.set('entity.tpPessoa', ehEmpresa ? 'J' : 'F');
      form.set('entity.nuPedido', String(cert.emissao_protocolo));
      form.set('entity.dtPedido', isoParaBR(String(cert.emissao_data)));
      form.set('entity.nmPesquisa', String(parte.nome || ''));
      if (ehEmpresa) {
        form.set('entity.nuCnpjFormatado', fmtCnpj(parte.documento));
        form.set('entity.nuCpfFormatado', '');
      } else {
        form.set('entity.nuCpfFormatado', fmtCpf(parte.documento));
        form.set('entity.nuCnpjFormatado', '');
        form.set('entity.nuRgFormatado', String(parte.rg || '').trim());
      }
      form.set('pbConsultar', 'Consultar');

      const postUrl = action.startsWith('http') ? action : ESAJ_BASE + action;
      let postResp: Response;
      try {
        postResp = await fetch(postUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookieHeader,
            'Referer': ESAJ_GET,
            'User-Agent': 'Mozilla/5.0 (DueDiligence-robo)',
          },
          body: form.toString(),
        });
      } catch (e) {
        await liberaParaAguardando(cert.id);
        await registra(cert, 'resposta_desconhecida', { detalhe: 'POST e-SAJ falhou: ' + String(e) });
        return 'esaj_indisponivel';
      }

      const ct = (postResp.headers.get('content-type') || '').toLowerCase();
      const cd = (postResp.headers.get('content-disposition') || '').toLowerCase();
      const buf = new Uint8Array(await postResp.arrayBuffer());
      const ehPdf = ct.includes('application/pdf')
        || (cd.includes('.pdf') && buf.length > 4)
        || (buf.length > 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46); // %PDF

      // 7) HTML → certidão ainda não saiu, ou erro (R-9/R-10/R-11).
      if (!ehPdf) {
        const html = new TextDecoder('utf-8', { fatal: false }).decode(buf);
        const cls = classificaHtml(html);
        if (cls.desfecho === 'erro_portal') {
          // erro real → pendência com motivo, NÃO classifica, não repete em loop (CA-9).
          await sb.from('dd_certidoes').update({ status: 'pendencia', pendencia_motivo: 'TJSP: ' + cls.detalhe }).eq('id', cert.id);
          await registra(cert, 'erro_portal', { http_status: postResp.status, content_type: ct, detalhe: cls.detalhe });
          return 'erro_portal';
        }
        // processando OU desconhecida → volta pra aguardando, tenta no próximo ciclo (CA-8/CA-10).
        await liberaParaAguardando(cert.id);
        await registra(cert, cls.desfecho, { http_status: postResp.status, content_type: ct, detalhe: cls.detalhe });
        return cls.desfecho;
      }

      // 8) PDF! Certidão pronta (R-12). Sobe ao cofre → IA lê → grava a classificação.
      const { nome: arquivoNome } = nomeArquivo(cert.chave, parte.nome);
      const arquivoPath = `${cert.dossie_id}/${arquivoNome}`;
      const up = await sb.storage.from(COFRE).upload(arquivoPath, buf, { contentType: 'application/pdf', upsert: false });
      if (up.error) {
        // upsert:false falhou = nome já existe (2ª trava anti-duplicação). Volta a aguardando e regista.
        await liberaParaAguardando(cert.id);
        await registra(cert, 'resposta_desconhecida', { detalhe: 'Falha ao subir PDF ao cofre: ' + String(up.error.message || up.error) });
        return 'falha_cofre';
      }

      // IA (dd-ler-certidao) — REUSO. Chamada com a chave de serviço como credencial (ADR D-2).
      const contexto = {
        chave: cert.chave, certidao_nome: cert.nome, grupo: 'pessoa',
        esperado_nome: parte.nome || '', esperado_documento: parte.documento || '',
        endereco: '', matricula_num: '',
      };
      const b64 = bytesParaB64(buf);
      let dadosIA: any = null;
      try {
        const { data, error } = await sb.functions.invoke('dd-ler-certidao', { body: { pdf_base64: b64, contexto } });
        if (error) throw error;
        if (data && data.error) throw new Error(data.error);
        dadosIA = data;
      } catch (e) {
        console.error('[dd-buscar-tjsp] dd-ler-certidao falhou:', String(e));
      }

      if (dadosIA) {
        const apts = Array.isArray(dadosIA.apontamentos) ? dadosIA.apontamentos : [];
        const status = dadosIA.resultado === 'negativa' ? 'negativa'
          : (dadosIA.resultado === 'positiva' ? 'apontamento' : 'duvida');
        await sb.from('dd_certidoes').update({
          status,
          resultado: status === 'duvida' ? null : dadosIA.resultado,
          arquivo_path: arquivoPath,
          arquivo_nome: arquivoNome,
          ia_resumo: dadosIA.resumo || '',
          ia_apontamentos: apts,
          ia_confere: dadosIA.confere || null,
          ia_modelo: dadosIA._modelo || null,
          lido_em: new Date().toISOString(),
          classificado_por: 'robo',
          pendencia_motivo: null,
        }).eq('id', cert.id);
      } else {
        // PDF salvo, mas a IA falhou → 'duvida' pro operador classificar na mão (espelha o front).
        await sb.from('dd_certidoes').update({
          status: 'duvida',
          arquivo_path: arquivoPath,
          arquivo_nome: arquivoNome,
          ia_resumo: 'A certidão foi baixada do TJSP e guardada no cofre, mas a leitura automática falhou — classifique na mão ou tente "Ler de novo".',
          ia_apontamentos: [],
          ia_confere: null,
          lido_em: new Date().toISOString(),
          classificado_por: null,
        }).eq('id', cert.id);
      }
      await registra(cert, 'baixou', { http_status: postResp.status, content_type: ct, detalhe: dadosIA ? 'classificada: ' + dadosIA.resultado : 'baixada; IA falhou' });
      return 'baixou';
    }

    // Solta o cadeado devolvendo a certidão a 'aguardando' (só se ainda estiver 'verificando').
    async function liberaParaAguardando(id: string) {
      try {
        await sb.from('dd_certidoes').update({ status: 'aguardando', verificando_desde: null }).eq('id', id).eq('status', 'verificando');
      } catch (_e) { /* best-effort */ }
    }

  } catch (e) {
    return j({ error: String(e) }, 500);
  }
});
