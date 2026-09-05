// dd-ler-certidao — leitor/classificador de certidão (Due Diligence, Etapa C).
// Irmã da dd-ler-matricula: recebe o PDF (base64) + o contexto (qual certidão é,
// nome e documento esperados), pede a leitura à IA e devolve a classificação.
// Provedor trocável por env DD_IA_PROVIDER: 'gemini' (padrão) | (futuro) 'anthropic'.
// A chave fica no cofre do Supabase (Secrets). verify_jwt=true: só usuário logado.
//
// Deploy: via Supabase MCP (deploy_edge_function) ou `supabase functions deploy dd-ler-certidao`.
// Secrets: GEMINI_API_KEY (obrigatório). GEMINI_MODEL (opcional).

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function montarPrompt(ctx: Record<string, string>) {
  const alvo = ctx.grupo === 'imovel'
    ? `O documento deve ser sobre o IMÓVEL: ${ctx.endereco || '(endereço não informado)'} — matrícula ${ctx.matricula_num || '?'}.`
    : `O documento deve ser da ${ctx.grupo === 'empresa' ? 'EMPRESA' : 'PESSOA'}: ${ctx.esperado_nome || '(nome não informado)'} — documento (CPF/CNPJ) ${ctx.esperado_documento || '(não informado)'}.`;
  return `Você lê certidões brasileiras (judiciais, fiscais, trabalhistas, de protesto, municipais) usadas em due diligence imobiliária e classifica o resultado.

CONTEXTO — o que este PDF deveria ser:
- Certidão esperada: ${ctx.certidao_nome || ctx.chave} (chave: ${ctx.chave}).
- ${alvo}

Devolva SOMENTE um JSON válido, sem texto ao redor, neste formato exato:
{
  "resultado": "negativa",
  "resumo": "",
  "apontamentos": [ { "descricao": "", "detalhe": "" } ],
  "confere": { "tipo_ok": true, "nome_ok": true, "documento_ok": true, "motivo": "" },
  "emitida_em": "",
  "valida_ate": ""
}

Regras:
- resultado: "negativa" = nada consta / sem pendência (inclui "positiva com efeito de negativa"). "positiva" = consta algo (processo, protesto, débito, pendência) — liste TUDO em apontamentos, um item por ocorrência, com número do processo/protesto, parte contrária, situação e ano quando houver (descricao = frase curta; detalhe = complemento como vara, cartório, valor). "duvida" = você não conseguiu ter certeza.
- Use "duvida" quando: o PDF está ilegível/protegido/corrompido; NÃO é a certidão esperada (tipo errado — ex.: veio uma matrícula, um contrato ou outra certidão); o nome ou o documento NÃO conferem com o esperado; ou é uma consulta/tela sem valor de certidão que você não consegue interpretar. Explique o motivo em confere.motivo, em linguagem simples.
- confere: tipo_ok = o PDF é mesmo a certidão esperada; nome_ok e documento_ok = batem com o esperado (tolerar abreviações, acentos e formatação de CPF/CNPJ; para certidão de imóvel, compare com o endereço/matrícula). Se algum for false, resultado deve ser "duvida" — NUNCA classifique negativa/positiva um documento que não confere.
- resumo: 1 a 3 frases, em português simples, dizendo o que a certidão é e o que diz (inclua nome, documento e datas quando constarem).
- emitida_em e valida_ate: datas em DD/MM/AAAA se constarem no documento; senão "".
- apontamentos: lista vazia quando negativa ou duvida.
Responda APENAS o JSON.`;
}

// Descobre um modelo Flash disponível para esta chave (igual à dd-ler-matricula).
async function descobrirModelo(key: string): Promise<string> {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + key);
  const d = await r.json();
  if (!r.ok) throw new Error('ListModels: ' + JSON.stringify(d).slice(0, 300));
  const gen: string[] = (d.models || [])
    .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m: any) => String(m.name).replace('models/', ''));
  const flash = gen.filter((n) => /flash/i.test(n) && !/lite|thinking|exp|preview|image|tts|audio|vision/i.test(n));
  return (
    flash.find((n) => /flash-latest/i.test(n)) ||
    flash.find((n) => /gemini-2\.5-flash$/i.test(n)) ||
    flash.sort().reverse()[0] ||
    gen.find((n) => /latest/i.test(n)) ||
    gen[0]
  );
}

async function lerComGemini(pdfB64: string, prompt: string, key: string) {
  const model = Deno.env.get('GEMINI_MODEL') || await descobrirModelo(key);
  if (!model) throw new Error('Nenhum modelo Gemini disponível para esta chave.');
  const body = {
    contents: [{ parts: [
      { inline_data: { mime_type: 'application/pdf', data: pdfB64 } },
      { text: prompt },
    ] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  };
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + key;
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) throw new Error('Gemini (' + model + '): ' + JSON.stringify(data).slice(0, 500));
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { text, model };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const j = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const provider = Deno.env.get('DD_IA_PROVIDER') || 'gemini';
    if (provider !== 'gemini') return j({ error: 'Provedor de IA não configurado: ' + provider }, 500);
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) return j({ error: 'GEMINI_API_KEY não configurada no cofre do Supabase (Edge Functions → Secrets).' }, 500);

    const { pdf_base64, contexto } = await req.json();
    if (!pdf_base64) return j({ error: 'PDF não recebido.' }, 400);

    const { text, model } = await lerComGemini(pdf_base64, montarPrompt(contexto || {}), key);
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { return j({ error: 'A IA não devolveu JSON válido.', raw: text.slice(0, 800) }, 502); }

    // Saneamento: só os campos esperados, com padrões seguros.
    const resultado = ['negativa', 'positiva', 'duvida'].includes(parsed.resultado) ? parsed.resultado : 'duvida';
    const apontamentos = Array.isArray(parsed.apontamentos)
      ? parsed.apontamentos.map((a: any) => ({ descricao: String(a?.descricao || a || ''), detalhe: String(a?.detalhe || '') })).filter((a: any) => a.descricao)
      : [];
    const confere = {
      tipo_ok: parsed?.confere?.tipo_ok !== false,
      nome_ok: parsed?.confere?.nome_ok !== false,
      documento_ok: parsed?.confere?.documento_ok !== false,
      motivo: String(parsed?.confere?.motivo || ''),
    };
    return j({
      resultado: (resultado !== 'duvida' && (!confere.tipo_ok || !confere.nome_ok || !confere.documento_ok)) ? 'duvida' : resultado,
      resumo: String(parsed.resumo || ''),
      apontamentos, confere,
      emitida_em: String(parsed.emitida_em || ''),
      valida_ate: String(parsed.valida_ate || ''),
      _modelo: model,
    }, 200);
  } catch (e) {
    return j({ error: String(e) }, 500);
  }
});
