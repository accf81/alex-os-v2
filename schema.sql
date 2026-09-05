-- ─── Alex OS v2 — Schema do banco Supabase ───────────────────────────────────
-- Espelho da estrutura REAL do banco (projeto sobmjqounukzbplrmhkr).
-- Regenerado a partir do banco em 2026-06-28 (20 tabelas na época).
-- Última atualização: 2026-07-28 — Frente A (índices únicos anti-duplicata em
-- imoveis_carteira) + coluna regiao em bairros (D-15). Antes: 2026-07-25 — reforma
-- Lead+Imobiliárias (bairros, imobiliarias, imobiliaria_pessoas, imobiliaria_bairros).
-- O banco tem hoje 35 tabelas no public.
-- Ordem das tabelas respeita as dependências (chaves estrangeiras).
--
-- A fonte da verdade é o banco no Supabase; este arquivo é referência.
-- RLS (a "tranca" de segurança) está LIGADO em todas as tabelas — ver fim do arquivo.

-- ─── 1. Pessoas (contatos) ────────────────────────────────────────────────────
create table if not exists pessoas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  tel         text,
  email       text,
  empresa     text,
  tipos       jsonb default '[]'::jsonb,
  obs         text,
  origem      text,                              -- de onde veio o contato (já existia no banco, faltava aqui)
  -- Etapa 2 da reforma de criação de Lead (migração de 29/07/2026) — todos opcionais
  rg          text,                              -- texto livre (formato varia por estado)
  cpf         text,                              -- máscara 000.000.000-00, sem validação de dígito
  creci       text,                              -- registro do corretor; só aparece na ficha quando o tipo Corretor está marcado
  corretor_autonomo boolean not null default false, -- true = corretor por conta própria (distingue "autônomo" de "ainda não sei" — ADR D-16)
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
-- Backup frio de antes da migração de 29/07/2026: public.pessoas_bkp_reforma
-- (cópia de 58 linhas, RLS ligado e sem policy — não é lido pela aplicação).

-- ─── 2. Condomínios (vem antes de imóveis, que referencia condomínios) ────────
create table if not exists condominios (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  tipo             text,
  bairro           text,
  rua              text,
  num              text,
  ano_construcao   text,
  proximo_metro    text,
  construtora      text,
  url_quinto       text,
  url_imovel_web   text,
  url_loft         text,
  obs              text,
  tipologias       jsonb default '[]'::jsonb, -- existe no banco, ainda não usada no código (ver backlog 10.6)
  fotos            jsonb default '[]'::jsonb, -- existe no banco, ainda não usada no código (galeria — backlog 10.6)
  infra            jsonb default '{}'::jsonb, -- existe no banco, ainda não usada no código
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  foto_capa        text,
  similares        jsonb default '[]'::jsonb
);

-- ─── 3. Imóveis (pipeline de captação) ───────────────────────────────────────
create table if not exists imoveis (
  id                  uuid primary key default gen_random_uuid(),
  owner               text not null,
  tipo                text,
  tel                 text,
  email               text,
  nome_conjuge        text,
  tel_conjuge         text,
  contato_principal   text,
  rua                 text,
  num                 text,
  apto                text,
  imovel              text,
  bairro              text,
  dormitorios         int,
  suites              int,
  vagas               int,
  area_privativa      numeric,
  valor_pretendido    numeric,
  conservacao         text,
  ocupacao            text,
  restricao           text,
  condominio_id       uuid references condominios(id) on delete set null,
  matricula_cartorio  text,
  matricula_num       text,
  area_real_reg       numeric,
  matricula_data      date,
  condominio_mensal   numeric,
  iptu_anual          numeric,
  estagio             text default 'Prospecção',
  origem              text,
  obs                 jsonb default '[]'::jsonb,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  pessoa_id           uuid references pessoas(id) on delete set null,
  marcos              jsonb default '{}'::jsonb,
  proxima_acao        text
);

-- ─── 4. Jobs de Foto/Vídeo (referenciada por lançamentos e prêmios) ──────────
create table if not exists jobs (
  id              uuid primary key default gen_random_uuid(),
  tipo            text,
  cliente_nome    text,
  corretor        text,
  data            date,
  horario         text,
  rua             text,
  num             text,
  complemento     text,
  edificio        text,
  tipo_imovel     text,
  metragem        text,
  servicos        jsonb default '[]'::jsonb,
  preco           numeric,
  codigo          text,
  ent_foto        date,
  ent_video       date,
  ent_reels       date,
  status          text default 'pendente',
  credito_para    text,
  tipo_credito    text,
  link            text,
  obs             text,
  pago            boolean default false,
  lancamento_id   uuid,
  enviado_foto_em    timestamptz,
  enviado_foto_link  text,
  enviado_video_em   timestamptz,
  enviado_video_link text,
  enviado_reels_em   timestamptz,
  enviado_reels_link text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── 5. Gestão Exclusiva ──────────────────────────────────────────────────────
create table if not exists gestao_exclusiva (
  id          uuid primary key default gen_random_uuid(),
  imovel_id   uuid references imoveis(id) on delete cascade,
  dados       jsonb default '{}'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── 6. ACMs (análise comparativa de mercado) ────────────────────────────────
create table if not exists acms (
  id              uuid primary key default gen_random_uuid(),
  imovel_id       uuid references imoveis(id) on delete cascade,
  titulo          text,
  vendidos        jsonb default '[]'::jsonb,
  concorrentes    jsonb default '[]'::jsonb,
  faixas          jsonb default '{}'::jsonb,
  valor_sugerido  numeric,
  obs             text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── 7. Lançamentos Financeiros ───────────────────────────────────────────────
create table if not exists lancamentos (
  id             uuid primary key default gen_random_uuid(),
  data           date not null,
  descricao      text not null,
  valor          numeric not null,
  tipo           text not null,
  conta          text,
  cat            text,
  sub            text,
  banco          text,
  obs            text,
  job_id         uuid references jobs(id) on delete set null,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  pago           boolean default true,
  etiquetas      text[] default '{}'::text[],
  transferencia  boolean default false,
  ext_id         text,
  import_lote    text
);

-- ─── 8. Categorias Financeiras ────────────────────────────────────────────────
create table if not exists categorias_fin (
  id          uuid primary key default gen_random_uuid(),
  estrutura   jsonb not null default '{}'::jsonb,
  updated_at  timestamptz default now()
);

-- ─── 9. Projetos ──────────────────────────────────────────────────────────────
create table if not exists projetos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  status        text default 'ativo',
  proxima_acao  text,
  acoes         jsonb default '[]'::jsonb,
  archived      boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── 10. Blocos de Agenda ─────────────────────────────────────────────────────
create table if not exists blocos_agenda (
  id      uuid primary key default gen_random_uuid(),
  icon    text default '📋',
  label   text not null,
  h_ini   int[],
  h_fim   int[],
  tipo    text default 'trabalho',
  ordem   int default 0
);

-- ─── 11. Imóveis em Carteira (estoque para divulgação) ───────────────────────
create table if not exists imoveis_carteira (
  id               uuid primary key default gen_random_uuid(),
  codigo           text,
  foto_capa        text,
  pessoas          jsonb default '[]'::jsonb,
  rua              text,
  numero           text,
  complemento      text,
  bairro           text,
  cep              text,
  condominio_id    uuid references condominios(id) on delete no action,
  tipo             text,
  valor_venda      numeric,
  valor_aluguel    numeric,
  area_util        numeric,
  area_total       numeric,
  quartos          int,
  suites           int,
  banheiros        int,
  vagas            int,
  andar            text,
  iptu_mensal      numeric,
  iptu_sql         text,
  matricula_num    text,
  matricula_cri    text,
  cond_mensal      numeric,
  data_construcao  date,
  exclusivo        boolean default false,
  lancamento       boolean default false,
  comissao         numeric default 6,
  link_drive       text,
  caracteristicas  jsonb default '[]'::jsonb,
  anuncio_pilar    text,
  anuncio_nonstop  text,
  anuncios_extra   jsonb default '[]'::jsonb,
  anotacoes        text,
  pipeline_id      uuid references imoveis(id) on delete no action,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  origem           text,
  gestao_id        uuid references gestao_exclusiva(id) on delete set null,
  status           text default 'a_classificar',
  publicavel       boolean default true,
  anunciado_em     date,
  conservacao      text
);
-- Travas contra duplicata (Frente A, ADR D-11 — migração
-- frente_a_indices_unicos_imoveis_carteira, 2026-07-28):
-- 1 captação = no máximo 1 imóvel espelho; código PD nunca se repete.
-- Endereço NÃO tem trava de banco (tem exceção legítima) — é aviso na tela.
create unique index imoveis_carteira_pipeline_uidx on imoveis_carteira (pipeline_id) where pipeline_id is not null;
create unique index imoveis_carteira_codigo_uidx   on imoveis_carteira (codigo)      where codigo is not null;

-- ─── 12. Leads ────────────────────────────────────────────────────────────────
create table if not exists leads (
  id                uuid primary key default gen_random_uuid(),
  carteira_id       uuid references imoveis_carteira(id) on delete no action,
  pessoa_id         uuid references pessoas(id) on delete no action,
  nome              text,
  origem            text default 'direto',
  parceiro_id       uuid references pessoas(id) on delete no action,
  status            text default 'novo',
  feedback          text,
  proximo           text,
  gestao_id         uuid references gestao_exclusiva(id) on delete no action,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  motivo_arquivo    text,
  primeiro_contato  date,
  anotacoes         text
);

-- ─── 13. Visitas ──────────────────────────────────────────────────────────────
create table if not exists visitas (
  id              uuid primary key default gen_random_uuid(),
  data            date not null,
  horario         text,
  status          text default 'agendado',
  tipo_imovel     text,
  carteira_id     uuid references imoveis_carteira(id) on delete set null,
  imovel_rua      text,
  imovel_num      text,
  imovel_apto     text,
  imovel_bairro   text,
  imovel_edificio text,
  imovel_codigo   text,
  cliente_tipo    text,
  cliente_ids     jsonb default '[]'::jsonb,
  parceiro_id     uuid references pessoas(id) on delete set null,
  origem          text,
  resultado       text,
  observacoes     jsonb default '[]'::jsonb,
  gestao_id       uuid references gestao_exclusiva(id) on delete set null,
  lead_id         uuid not null references leads(id) on delete cascade,  -- Etapa 2 (04/07): toda visita exige lead; apagar lead leva as visitas junto
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── 14. Tarefas ──────────────────────────────────────────────────────────────
create table if not exists tarefas (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references leads(id) on delete cascade,
  texto       text not null,
  quando      timestamptz,
  feito       boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  pessoa_id   uuid references pessoas(id) on delete set null,
  carteira_id uuid references imoveis_carteira(id) on delete set null,
  rotulo      text
);

-- ─── 15. Fechamentos (vendas / propostas) ────────────────────────────────────
-- imovel_id e comprador_id existem como colunas mas SEM chave estrangeira no banco.
create table if not exists fechamentos (
  id                       uuid primary key default gen_random_uuid(),
  imovel                   text,
  comprador                text,
  etapa                    text default 'proposta',
  valor_venda              numeric,
  comissao_total           numeric,
  outro_corretor           boolean default false,
  tipo_corretor            text,
  valor_alex               numeric,
  pct_pilar                numeric,
  n_parcelas               int default 1,
  parcela1_pct             numeric,
  parcela1_data            date,
  parcela1_lanc_id         uuid,
  parcela2_pct             numeric,
  parcela2_data            date,
  parcela2_lanc_id         uuid,
  obs                      text,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now(),
  imovel_id                uuid,
  comprador_id             uuid,
  tipo_pagamento           text default 'avista',
  valor_recursos_proprios  numeric,
  valor_financiado         numeric,
  pagamento_obs            text,
  comissao_pct             numeric,
  valor_pilar              numeric,
  marcos                   jsonb
);

-- ─── 16. Prêmios Airbnb (diárias de cortesia da Maria Clara) ──────────────────
create table if not exists premios_airbnb (
  id          uuid primary key default gen_random_uuid(),
  anfitriao   text not null,
  data_uso    date not null,
  obs         text,
  created_at  timestamptz not null default now(),
  job_id      uuid references jobs(id) on delete set null
);

-- ─── 17. Listas de Opções (valores de dropdowns configuráveis) ───────────────
create table if not exists listas_opcoes (
  id          uuid primary key default gen_random_uuid(),
  categoria   text not null,
  valor       text not null,
  ordem       int not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─── 18. Backlog — Itens (backlog do próprio sistema, área IA) ────────────────
create table if not exists backlog_itens (
  id            uuid primary key default gen_random_uuid(),
  item_id       text,
  prioridade    text,
  area          text,
  tipo          text default 'Dev',
  titulo        text not null,
  descricao     text,
  status        text default 'aberto',
  ordem         int default 0,
  projeto       text not null default 'alexos',  -- alexos | remax (seletor de projeto da área IA)
  compartilhado boolean not null default false,  -- true = aparece nos dois projetos (ex.: Due Diligence)
  modelo        text,                            -- IA usada (Fable 5, Opus 4.8…) — etiqueta do relatório
  esforco       text,                            -- baixo | médio | alto — termômetro de tamanho
  concluido_em  date,                            -- data em que ficou pronto (recorte do relatório semanal)
  -- Quadro de Gestão (Kanban) — migração de 27/07/2026
  coluna           text not null default 'a_fazer', -- em qual das 6 colunas o cartão está
  agente_atual     text,                            -- Requisitos | Arquiteto | UX/UI | Engenheiro | QA
  aguardando_desde date,                            -- dia em que entrou em "Aguardando cliente" (regra do cutucar)
  trilho           text,                            -- rapido | completo (vazio = "Trilho a definir")
  espera_nota      text,                            -- a linha do cartão em "Engatilhado"
  publicado_em     date[] not null default '{}',    -- todas as datas em que o item foi publicado (nunca apaga)
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  constraint backlog_itens_coluna_chk check (coluna in
    ('a_fazer','engatilhado','em_andamento','aguardando_cliente','em_teste','publicado')),
  constraint backlog_itens_trilho_chk check (trilho is null or trilho in ('rapido','completo')),
  constraint backlog_itens_agente_chk check (agente_atual is null or agente_atual in
    ('Requisitos','Arquiteto','UX/UI','Engenheiro','QA'))
);
create index if not exists idx_backlog_itens_projeto on backlog_itens(projeto);
create index if not exists backlog_itens_coluna_idx on backlog_itens(coluna, projeto);

-- Gatilho do Quadro de Gestão: mantém `status` (aberto/feito) de acordo com a coluna,
-- acumula as datas de publicação e liga/desliga o relógio do "cutucar em 5 dias".
-- A tela grava SÓ a coluna; o resto é o banco que decide (vale também para gravação via MCP).
-- Definição viva no Supabase: função public.backlog_itens_sync() + trigger trg_backlog_itens_sync.

-- ─── 19. Backlog — Histórico (alimenta IA > Histórico) ───────────────────────
create table if not exists backlog_historico (
  id          uuid primary key default gen_random_uuid(),
  sessao      text,
  data        date,
  conteudo    text not null,
  ordem       int default 0,
  projeto     text not null default 'alexos',  -- alexos | remax
  created_at  timestamptz default now()
);
create index if not exists idx_backlog_historico_projeto on backlog_historico(projeto);

-- ─── 20. Backlog — Inbox (captura rápida de ideias) ──────────────────────────
create table if not exists backlog_inbox (
  id            uuid primary key default gen_random_uuid(),
  texto         text not null,
  status        text default 'novo',
  projeto       text not null default 'alexos',  -- alexos | remax
  criado_em     timestamptz default now(),
  processado_em timestamptz
);

-- ─── Garimpo — achados dos robôs de captação (Zap/Loft/QuintoAndar) ───────────
-- Migração: criar_garimpo_achados (2026-07-10)
create table garimpo_achados (
  id uuid primary key default gen_random_uuid(),
  cidade text not null default 'São Paulo',
  bairro text not null,
  rua text,
  endereco_numero text,        -- raramente vem dos portais hoje; guardado pro robô próprio futuro
  edificio text,                -- idem — raramente vem hoje
  condominio_id uuid references condominios(id),
  latitude numeric,
  longitude numeric,
  tipo_imovel text,             -- apartamento | cobertura | garden
  dormitorios int,
  suites int,
  vagas int,
  area numeric,
  preco numeric,
  preco_m2 numeric,
  condominio_mensal numeric,
  iptu_mensal numeric,
  comodidades jsonb default '[]'::jsonb,
  descricao text,
  tipo_anunciante text,         -- proprietario | corretor
  anunciante_nome text,
  anunciante_tel text,
  fontes jsonb not null default '[]'::jsonb,  -- [{portal, portal_listing_id, url, preco, anunciante_nome, anunciante_tel, coletado_em}]
  possivel_duplicata_de uuid references garimpo_achados(id),
  -- comparação com o ITBI NÃO é guardada aqui — calculada ao vivo via SQL.js no navegador,
  -- igual já é feito no ACM (ver _docs/ITBI_DATABASE.md)
  status text not null default 'novo',   -- novo | guardado | descartado | promovido
  imovel_id uuid references imoveis(id),
  criado_no_portal_em timestamptz,
  atualizado_no_portal_em timestamptz,
  coletado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_garimpo_achados_bairro on garimpo_achados (bairro);
create index idx_garimpo_achados_status on garimpo_achados (status);
create index idx_garimpo_achados_coletado_em on garimpo_achados (coletado_em desc);

-- ─── Due Diligence (recurso beta) — 3 tabelas ────────────────────────────────
-- Migração: criar_due_diligence (2026-07-21). 1 dossiê → partes → certidões.
-- Fase captação usa só certidões gratuitas; campos fase/pago preparam a venda.
create table dd_dossies (
  id            uuid primary key default gen_random_uuid(),
  imovel_id     uuid references imoveis(id) on delete set null,
  fase          text default 'captacao',      -- captacao | venda
  status        text default 'em_andamento',  -- em_andamento | apto | com_apontamento | concluido
  titulo        text,
  endereco      text,                          -- snapshot do endereço pra exibir
  matricula_num text,
  matricula_cri text,
  pasta_url     text,                          -- pasta de auditoria (caminho no Storage)
  obs           text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create table dd_partes (
  id            uuid primary key default gen_random_uuid(),
  dossie_id     uuid not null references dd_dossies(id) on delete cascade,
  tipo          text not null,                 -- proprietario | conjuge | empresa
  nome          text not null,
  documento     text,                          -- CPF ou CNPJ
  regime        text,                          -- regime de casamento
  vinculo_parte_id uuid references dd_partes(id) on delete set null, -- cônjuge/empresa → qual proprietário
  origem        text default 'ia',             -- ia | manual
  motivo        text,                          -- ex.: "incluída por comunhão parcial"
  ordem         int default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create table dd_certidoes (
  id           uuid primary key default gen_random_uuid(),
  dossie_id    uuid not null references dd_dossies(id) on delete cascade,
  parte_id     uuid references dd_partes(id) on delete cascade,  -- null = certidão do imóvel
  grupo        text not null,                  -- imovel | pessoa | empresa
  chave        text not null,                  -- slug do catálogo (duc, cedi, pje, ...)
  nome         text not null,
  descricao    text,
  metodo       text default 'voce',            -- robo | voce
  fase         text default 'captacao',        -- captacao | venda
  pago         boolean default false,
  status       text default 'em_aberto',       -- em_aberto | emitindo | recebida | lendo | negativa | positiva | apontamento | duvida | aguardando
  resultado    text,                           -- negativa | positiva | apontamento
  arquivo_nome text,
  arquivo_url  text,
  portal_url   text,
  ordem        int default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  -- Etapa C (migração dd_etapa_c_cofre_e_leitura, 2026-07-23):
  arquivo_path    text,         -- caminho no bucket privado dd-certidoes (Storage)
  ia_resumo       text,         -- resumo da leitura pela IA
  ia_apontamentos jsonb,        -- [{descricao, detalhe}]
  ia_confere      jsonb,        -- {tipo_ok, nome_ok, documento_ok, motivo}
  ia_modelo       text,         -- modelo usado na leitura
  lido_em         timestamptz,  -- quando a IA leu
  classificado_por text,        -- ia | manual | robo (null = ainda sem classificação)
  -- Robô do TJSP (migração robo_tjsp_verificacoes_e_colunas, 2026-07-27/08-01):
  -- status ganhou os valores 'verificando' (o robô pegou pra conferir) e
  -- 'expirado' (não saiu no prazo — 5 dias úteis + folga).
  pendencia_motivo  text,        -- motivo real quando vira pendência (ex.: "TJSP: pedido não localizado")
  verificando_desde timestamptz  -- cadeado do robô; >15min sem desfecho = liberável (recuperação de pane)
);

-- Cofre das certidões (Etapa C): bucket PRIVADO 'dd-certidoes' no Storage —
-- só application/pdf, máx 15 MB, policies só pra usuário logado (authenticated).
-- Arquivos em <dossie_id>/<chave>_<parte>_<AAAAMMDDHHMMSS>.pdf; abertos por link
-- assinado temporário. Apagar o dossiê apaga os arquivos (feito pelo js/dd.js).
create index idx_dd_partes_dossie   on dd_partes (dossie_id);
create index idx_dd_certidoes_dossie on dd_certidoes (dossie_id);
create index idx_dd_certidoes_parte  on dd_certidoes (parte_id);

-- ─── Robô do TJSP — diário de bordo (migração robo_tjsp_verificacoes_e_colunas) ──
-- 1 linha por conferência do robô dd-buscar-tjsp no portal e-SAJ (custo R$0 —
-- o robô NUNCA grava em dd_emissoes). RLS: leitura pra usuário logado
-- (dd_verif_tjsp_auth_select); escrita SÓ pela chave de serviço (sem policy de
-- escrita pra authenticated). Agendador: pg_cron 'dd-buscar-tjsp-grade'
-- (0 10,13,16,19,22 UTC = 7/10/13/16/19h BRT), ligado em 01/08/2026.
create table dd_verificacoes_tjsp (
  id           uuid primary key default gen_random_uuid(),
  certidao_id  uuid references dd_certidoes(id) on delete set null,
  dossie_id    uuid references dd_dossies(id)   on delete set null,
  parte_id     uuid references dd_partes(id)    on delete set null,
  desfecho     text not null,   -- baixou | processando | erro_portal | resposta_desconhecida | falta_dado | robo_quebrado | expirado
  http_status  int,
  content_type text,
  detalhe      text,            -- trecho da resposta / motivo (calibra o classificador)
  ciclo        text,            -- imediata | agendada | cron | teste
  created_at   timestamptz default now()
);
create index idx_dd_verif_tjsp_cert     on dd_verificacoes_tjsp (certidao_id);
create index idx_dd_verif_tjsp_desfecho on dd_verificacoes_tjsp (desfecho, created_at);

-- ─── Bairros (cadastro próprio — fonte única de bairros do sistema) ──────────
-- Migração: criar_bairros (2026-07-25 — reforma Lead+Imobiliárias, Etapa 0.5, ADR D-6).
-- Antes o bairro era texto solto / item de listas_opcoes. Virou cadastro de verdade,
-- no mesmo nível de pessoas/condomínios, com id estável — para no futuro ligar a
-- imóveis, edifícios e ITBI de forma aditiva (fora do escopo por enquanto).
create table bairros (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  cidade      text default 'São Paulo',   -- permite bairro de outra cidade sem gambiarra
  zona        text,                        -- Zona Sul/Oeste/Norte/Leste/Centro (opcional)
  regiao      text,                        -- agrupamento COMERCIAL ("Jardins", "Ibirapuera") — ADR D-15;
                                           -- diferente de zona (geográfica); vira sinônimo de busca
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (nome, cidade)                    -- não duplica o mesmo bairro na mesma cidade
);
create index bairros_nome_idx on bairros (nome);
-- Semeado em 2026-07-25 com 129 bairros/distritos curados de São Paulo.
-- 2026-07-28 (migração bairros_regiao_e_novos_bairros_d15): coluna regiao +
-- região "Jardins" (Jardim América/Paulista/Europa) e "Ibirapuera" (Moema,
-- Moema Índios, Moema Pássaros, Vila Nova Conceição, Indianópolis) + bairros
-- novos Jardim Cordeiro, Jardim Canaã e Indianópolis (Zona Sul).

-- ─── Imobiliárias (cadastro próprio) ─────────────────────────────────────────
-- Migração: criar_imobiliarias (2026-07-25 — reforma Lead+Imobiliárias, Etapa 1).
-- Nome é sempre LIMPO ("Mosaic"); a rede fica no campo `rede`, separado (R-3),
-- para permitir filtrar "todas da rede Pilar". Rede em branco = independente.
create table imobiliarias (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  rede        text,        -- Pilar / RE/MAX / novas do Alex; opções em listas_opcoes
  telefone    text,        -- vira link de WhatsApp no card
  email       text,
  instagram   text,
  site        text,
  creci       text,        -- CRECI da empresa (registro jurídico)
  obs         text,
  origem      text,        -- de onde veio o cadastro (manual hoje; robô no futuro)
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index imobiliarias_rede_idx on imobiliarias (rede);
-- NÃO entram agora (futuro, aditivo trivial): cnpj, endereco.
-- Carga inicial 2026-07-25 (origem = 'carga inicial 2026-07-25'), 7 registros:
--   Apes com Estilo Imóveis, Casa Via Imóveis, Coelho da Fonseca (independentes),
--   Mosaic, Pandora Homes, Squadra Paulista (rede Pilar), Studio 76 (rede RE/MAX).
-- REGRA DO NOME (R-3/CA-5): nome sempre LIMPO, sem a rede junto. Por isso a loja da
-- RE/MAX entra como "Studio 76" + rede "RE/MAX", não "RE/MAX Studio 76"
-- (corrigido em 2026-07-26, migração corrigir_nome_studio76_tirar_rede_do_nome).

-- ─── Imobiliária ↔ Pessoas (equipe, com papel) ───────────────────────────────
-- Migração: criar_imobiliaria_pessoas (2026-07-25 — ADR D-7).
-- Tabela de ligação própria porque o vínculo carrega PAPEL (corretor, advogado,
-- recepção, marketing, sócio, gerente…). O CASCADE apaga só a linha de vínculo —
-- a pessoa e a imobiliária continuam existindo.
create table imobiliaria_pessoas (
  id             uuid primary key default gen_random_uuid(),
  imobiliaria_id uuid not null references imobiliarias(id) on delete cascade,
  pessoa_id      uuid not null references pessoas(id)      on delete cascade,
  papel          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (imobiliaria_id, pessoa_id, papel)
);
create index imob_pessoas_imob_idx   on imobiliaria_pessoas (imobiliaria_id);
create index imob_pessoas_pessoa_idx on imobiliaria_pessoas (pessoa_id);

-- ─── Imobiliária ↔ Bairros (áreas de atuação) ────────────────────────────────
-- Migração: criar_imobiliaria_bairros (2026-07-25 — ADR D-6).
-- Ligação por id (não texto): renomear um bairro não quebra o vínculo, e dá para
-- consultar nos dois sentidos ("bairros da imobiliária" e "imobiliárias do bairro",
-- este último é a base dos robôs de prospecção por bairro).
create table imobiliaria_bairros (
  id             uuid primary key default gen_random_uuid(),
  imobiliaria_id uuid not null references imobiliarias(id) on delete cascade,
  bairro_id      uuid not null references bairros(id)      on delete cascade,
  created_at     timestamptz default now(),
  unique (imobiliaria_id, bairro_id)
);
create index imob_bairros_imob_idx   on imobiliaria_bairros (imobiliaria_id);
create index imob_bairros_bairro_idx on imobiliaria_bairros (bairro_id);

-- ⚠ LEIA ISTO ANTES DE CONFIAR NO LAÇO ABAIXO (bilhete de 30/08/2026)
-- Este arquivo é um ESPELHO: ele descreve o que deveria estar no banco. Ele NÃO
-- é reaplicado. A lista de nomes escrita à mão do laço abaixo envelheceu, e isso
-- não é teoria: `garimpo_achados` está na lista e mesmo assim continuava, em
-- 30/08/2026, entregando as oito permissões a quem NÃO fez login. O motivo,
-- medido: a tabela nasceu em 10/07/2026 (linha 439 deste arquivo), 21 dias
-- DEPOIS de o laço ter rodado pela última vez. O nome entrou no documento; o
-- laço não voltou ao banco.
-- Quem conserta isso de verdade é a migração
-- `db/migrations/20260830u_seguranca_padrao_e_varredura_alex_os.sql` (a primeira
-- deste repositório), que não lê lista nenhuma: varre o banco na hora. E quem
-- avisa se a porta reabrir é `pandora-os/ferramentas/guarda-portas-do-banco.mjs`.
-- ─── RLS (Row Level Security) — Fase 2, aplicada em 2026-06-19 ────────────────
-- Sistema single-user. TODAS as tabelas têm RLS LIGADO: a chave pública (anon)
-- não acessa nada; só o usuário autenticado (login Supabase Auth) lê/grava.
-- Padrão por tabela:
--   alter table <t> enable row level security;
--   revoke all on <t> from anon;
--   create policy fase2_auth_all on <t> for all to authenticated
--     using (auth.uid() is not null);

do $$
declare t text;
begin
  foreach t in array array[
    'pessoas','condominios','imoveis','jobs','gestao_exclusiva','acms',
    'lancamentos','categorias_fin','projetos','blocos_agenda','imoveis_carteira',
    'leads','visitas','tarefas','fechamentos','premios_airbnb','listas_opcoes',
    'backlog_itens','backlog_historico','backlog_inbox','garimpo_achados',
    'dd_dossies','dd_partes','dd_certidoes',
    -- reforma Lead+Imobiliárias (2026-07-25):
    'bairros','imobiliarias','imobiliaria_pessoas','imobiliaria_bairros'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('revoke all on %I from anon;', t);
    execute format('drop policy if exists fase2_auth_all on %I;', t);
    execute format($f$create policy fase2_auth_all on %I for all to authenticated
      using (auth.uid() is not null);$f$, t);
  end loop;
end $$;

-- ─── Exceção: dd_emissoes é SOMENTE LEITURA pro usuário logado ────────────────
-- (migração dd_emissoes_rls_somente_leitura, 2026-08-01)
-- dd_emissoes é o registro de custo real (Infosimples hoje, Assertiva na Etapa D2).
-- Quem grava é SÓ a Edge Function pela chave de serviço (que passa por cima da RLS).
-- O site nunca insere linha de gasto — nem hoje nem depois. Mesmo padrão do
-- diário de bordo do robô do TJSP (dd_verif_tjsp_auth_select).
drop policy if exists fase2_auth_all on dd_emissoes;
create policy dd_emissoes_leitura_logado on dd_emissoes for select to authenticated
  using (auth.uid() is not null);
