// dd-ler-matricula — leitor de matrícula (Due Diligence).
// Recebe o PDF (base64), pede a extração estruturada a uma IA e devolve JSON.
// Provedor trocável por env DD_IA_PROVIDER: 'gemini' (padrão) | (futuro) 'anthropic'.
// A chave fica no cofre do Supabase (Secrets) — nunca no código nem no navegador.
// verify_jwt=true: só usuário logado no Alex OS pode chamar.
//
// Deploy: via Supabase MCP (deploy_edge_function) ou `supabase functions deploy dd-ler-matricula`.
// Secrets: GEMINI_API_KEY (obrigatório). GEMINI_MODEL (opcional — fixa o modelo;
// se ausente, a função descobre sozinha um modelo Flash disponível pra chave).

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROMPT = `Você lê matrículas de imóveis do registro de imóveis brasileiro e extrai os dados.
Devolva SOMENTE um JSON válido, sem texto ao redor, neste formato exato:
{
  "imovel": { "endereco": "", "matricula_num": "", "matricula_cri": "", "area_privativa": "", "contribuinte": "", "tipo": "apartamento" },
  "proprietarios": [ { "nome": "", "documento": "", "rg": "", "rg_uf": "", "estado_civil": "solteiro", "regime": "", "conjuge": null } ],
  "empresas": [],
  "observacoes": []
}

Regras importantes:
- PROPRIETÁRIO ATUAL: é o da ÚLTIMA transmissão de propriedade (o registro R.xx mais recente de compra/venda). Se o imóvel foi vendido depois da abertura da matrícula, NÃO use o primeiro nome que aparece no topo (a incorporadora/construtora) — use o COMPRADOR MAIS RECENTE. Pode haver mais de um proprietário atual (co-proprietários); liste todos.
- documento: CPF do proprietário (ou CNPJ, se o dono atual for empresa).
- rg: número do RG (carteira de identidade) do proprietário pessoa física, se constar na matrícula (costuma vir junto do CPF). Se não constar, "".
- rg_uf: sigla do estado emissor do RG (ex.: "SP"), só se aparecer explicitamente; senão "".
- estado_civil: exatamente um de "solteiro", "casado", "divorciado", "viuvo", "uniao_estavel". Se a matrícula não disser, use "solteiro".
- regime: só quando casado/união estável — exatamente um de "comunhao_parcial", "comunhao_universal", "separacao_convencional", "separacao_obrigatoria". Caso contrário, "".
- conjuge: { "nome": "", "documento": "" } se a matrícula citar o cônjuge; senão null.
- empresas: SEMPRE lista vazia [] — empresas do proprietário NÃO constam na matrícula.
- tipo: exatamente um de "Apartamento", "Cobertura", "Garden", "Duplex", "Studio", "Casa", "Comercial". Se a matrícula descrever "studio", "garden", "cobertura", "duplex" etc., use o mais específico; senão "Apartamento" ou "Casa".
- observacoes: lista de frases curtas sobre ônus, hipotecas, penhoras, patrimônio de afetação, usufruto etc., dizendo se estão ATIVOS ou CANCELADOS (com o número da averbação, se houver). Se não houver ônus ativo, diga isso.
Responda APENAS o JSON.`;

// Descobre um modelo Flash disponível para esta chave (evita quebrar quando o Google renomeia/aposenta modelos).
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

async function lerComGemini(pdfB64: string, key: string) {
  const model = Deno.env.get('GEMINI_MODEL') || await descobrirModelo(key);
  if (!model) throw new Error('Nenhum modelo Gemini disponível para esta chave.');
  const body = {
    contents: [{ parts: [
      { inline_data: { mime_type: 'application/pdf', data: pdfB64 } },
      { text: PROMPT },
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

    const { pdf_base64, filename } = await req.json();
    if (!pdf_base64) return j({ error: 'PDF não recebido.' }, 400);

    const { text, model } = await lerComGemini(pdf_base64, key);
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { return j({ error: 'A IA não devolveu JSON válido.', raw: text.slice(0, 800) }, 502); }

    parsed.arquivo = filename || 'matricula.pdf';
    parsed.imovel = parsed.imovel || {};
    parsed.proprietarios = Array.isArray(parsed.proprietarios) ? parsed.proprietarios : [];
    parsed.empresas = []; // regra fixa: não vêm da matrícula
    parsed.observacoes = Array.isArray(parsed.observacoes) ? parsed.observacoes : [];
    parsed._modelo = model; // pra diagnóstico
    return j(parsed, 200);
  } catch (e) {
    return j({ error: String(e) }, 500);
  }
});
