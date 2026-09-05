-- ════════════════════════════════════════════════════════════════════════════
-- A PORTA DO ESVAZIAR SE FECHA — BANCO DO ALEX OS (30/08/2026)
--
-- ⚠ ESTE ARQUIVO NÃO FOI APLICADO EM PRODUÇÃO. Quem aplica é o Alex, depois do
--   QA, arrastando este arquivo para `_comandos/aplicar-migracao-alex-os.command`.
--
-- ⚠ ELE SÓ SERVE PARA O BANCO DO ALEX OS (sobmjqounukzbplrmhkr). Se for aplicado
--   no banco da ElpIA, a primeira coisa que ele faz é RECUSAR e não mudar nada.
--   O gêmeo dele é
--   `pandora-os/db/migrations/20260830u_seguranca_padrao_e_varredura_elpia.sql`.
--
-- ⚠ ESTA É A PRIMEIRA MIGRAÇÃO VERSIONADA DESTE REPOSITÓRIO. A pasta
--   `db/migrations/` nasceu com ela. Até hoje a estrutura deste banco vivia só
--   no `schema.sql`, que é um ESPELHO (descreve o que deveria estar lá) e não
--   um arquivo que alguém reaplica. A diferença entre as duas coisas é o achado
--   do `garimpo_achados`, contado mais abaixo, e custou uma tabela aberta a
--   quem não fez login por 51 dias.
--
-- ─── O QUE ESTÁ ERRADO, E POR QUE ISSO NÃO É CULPA DE NINGUÉM DA CASA ───────
--
-- Toda tabela tem DUAS trancas em série:
--   1. a PERMISSÃO DE TABELA  — "você pode disparar este comando aqui?"
--   2. a REGRA DE LINHA (RLS) — "de quais linhas estamos falando?"
--
-- Quase toda a proteção do sistema foi construída na segunda. A primeira ficou
-- como veio da plataforma: aberta. Isso funciona para os quatro comandos do dia
-- a dia (ler, inserir, alterar, apagar linha), porque a regra de linha alcança
-- os quatro. NÃO funciona para os outros quatro, e quem diz isso é o manual:
--
--   "Operations that apply to the whole table, such as TRUNCATE and REFERENCES,
--    are not subject to row security."
--   `_manuais/postgresql/01_BANCO_o-que-a-regra-por-linha-NAO-protege.md`:87
--
-- Em português: o que pega a tabela inteira passa POR FORA da tranca de linha.
-- São quatro, e é por isso que só estas quatro são revogadas aqui:
--
--   TRUNCATE   esvazia a tabela inteira de uma vez
--              "Allows TRUNCATE on a table."
--              `_manuais/postgresql/04_BANCO_a-tabela-das-letras-de-permissao.md`:170
--   MAINTAIN   manutenção pesada: limpeza, análise, reagrupamento, reconstrução
--              de índice e atualização de quadro de resumo
--              "Allows VACUUM, ANALYZE, CLUSTER, REFRESH MATERIALIZED VIEW,
--               REINDEX, and LOCK TABLE on a relation."
--              `_manuais/postgresql/04_BANCO_a-tabela-das-letras-de-permissao.md`:226
--
--              ⚠ CORREÇÃO DE 30/08/2026: uma versão anterior deste cabeçalho
--              dizia que tirar a manutenção IMPEDE TRANCAR A TABELA. É FALSO.
--              O QA mandou o comando de verdade, com a manutenção já retirada, e
--              a tabela trancou. Quem manda é o manual do próprio comando:
--                "To lock a table, the user must have the right privilege for the
--                 specified lockmode. If the user has MAINTAIN, UPDATE, DELETE,
--                 or TRUNCATE privileges on the table, any lockmode is permitted."
--                `_manuais/postgresql/09_BANCO_LOCK_trancar-a-tabela.md`:178
--              Ou seja: quem tem ALTERAR ou APAGAR LINHA já tranca a tabela, e
--              esta obra tem ordem de não tocar nessas duas. O manual 04:228 já
--              mandava ir à página do comando ("The privileges required by other
--              commands are listed on the reference page of the respective
--              command."), e essa página não tinha sido baixada. Foi baixada
--              agora. O que tirar a manutenção ENTREGA de fato: impede limpeza
--              (VACUUM), análise (ANALYZE), reagrupamento (CLUSTER), reconstrução
--              de índice (REINDEX) e atualização de quadro de resumo (REFRESH
--              MATERIALIZED VIEW). NÃO impede trancar.
--   TRIGGER    pendura gatilho na tabela
--              "…any triggers added to a table or view will be executed with
--               the privileges of users who modify it."
--              `_manuais/postgresql/04_BANCO_a-tabela-das-letras-de-permissao.md`:178
--   REFERENCES pendura amarração de chave
--              "…a user who creates a foreign key can arrange for enforcement
--               of that foreign key to call an arbitrary function … called with
--               the privileges of the table owner."
--              `_manuais/postgresql/04_BANCO_a-tabela-das-letras-de-permissao.md`:174
--
-- ─── ⚠ A RECEITA DO PRÓPRIO FORNECEDOR FAZ O CONTRÁRIO DISTO ────────────────
--
-- A página do Supabase "Securing your API", seção "Revoke default privileges"
-- (`_manuais/supabase/10_API_protegendo-a-api-de-dados.md`:211), manda rodar:
--
--     alter default privileges for role postgres in schema public
--       revoke select, insert, update, delete on tables from anon, authenticated, service_role;
--
-- Copiar isso QUEBRARIA O SISTEMA INTEIRO E NÃO FECHARIA NADA: ela revoga
-- exatamente os quatro comandos do dia a dia (que aqui ficam de pé), não fala de
-- esvaziar nem de manutenção (que são os que a obra existe para tirar) e mexe
-- em `service_role`, que é por onde as peças de servidor entram. O comando deste
-- arquivo é o INVERSO do exemplo do fornecedor, e isso é de propósito.
--
-- ─── POR QUE DUAS FRENTES, E NÃO UMA ────────────────────────────────────────
--
-- Mudar o molde de tabela nova NÃO conserta o que já existe. O manual:
--   "(It does not affect privileges assigned to already-existing objects.)"
--   `_manuais/postgresql/03_BANCO_o-padrao-de-tabela-nova.md`:169
-- Por isso: primeiro o molde, depois a varredura, as duas na mesma transação.
-- A ordem importa. Se parar no meio, sobra o estado de hoje, que a guarda acusa
-- em voz alta. Na ordem inversa sobraria um estado que PARECE resolvido.
--
-- ─── POR QUE `in schema public` E NÃO GLOBAL ────────────────────────────────
--
-- O manual avisa que revogar por esquema só desfaz o que foi concedido por
-- esquema:
--   "Per-schema REVOKE is only useful to reverse the effects of a previous
--    per-schema GRANT."
--   `_manuais/postgresql/03_BANCO_o-padrao-de-tabela-nova.md`:177
-- MEDIDO NESTE BANCO EM 30/08/2026: as entradas de `pg_default_acl` dos dois
-- criadores estão no esquema `public`, não são globais. Logo `in schema public`
-- é a forma certa. Não foi copiado do fornecedor: foi medido.
--
-- ─── POR QUE A VARREDURA NÃO USA `ALL TABLES IN SCHEMA` ─────────────────────
--
-- Porque o manual diz o que aquele atalho alcança, e a lista dele é curta:
--   "ALL TABLES also affects views and foreign tables"
--   `_manuais/postgresql/02_BANCO_GRANT_as-letras-de-cada-permissao.md`:267
-- Quadro de resumo (materialized view) e tabela particionada NÃO estão na frase.
-- E neste banco isso não é teoria: o quadro de resumo `ruas_itbi` É UMA DAS
-- PORTAS ABERTAS a quem não fez login (medido em 30/08/2026). O atalho de uma
-- linha teria deixado ele de pé e a conferência teria dito "está tudo certo".
--
-- ─── AS ONZE QUE ESTÃO ABERTAS A QUEM NÃO FEZ LOGIN, UMA A UMA ──────────────
-- Medido em 30/08/2026 com `has_table_privilege`. Depois desta migração:
-- nenhuma das quatro, em nenhuma delas. Nenhuma linha é apagada.
--
--    #   objeto                  o que quem NÃO fez login tem HOJE
--    1.  dd_emissoes             esvaziar, manutenção, gatilho, amarração
--    2.  dd_verificacoes_tjsp    esvaziar, manutenção, gatilho, amarração
--    3.  garimpo_achados         esvaziar, manutenção, gatilho, amarração
--    4.  leads_vendidos          esvaziar, manutenção, gatilho, amarração
--    5.  pauta_feedback          esvaziar, manutenção, gatilho, amarração
--    6.  pessoas_bkp_reforma     esvaziar, manutenção, gatilho, amarração
--    7.  piloto_acm              esvaziar, manutenção, gatilho, amarração
--    8.  piloto_gestoes          esvaziar, manutenção, gatilho, amarração
--    9.  piloto_importacoes      esvaziar, manutenção, gatilho, amarração
--   10.  ruas_itbi (quadro de resumo)  esvaziar, manutenção, gatilho, amarração
--   11.  vendas_itbi             SÓ manutenção
--
-- ⚠ São ONZE, e não nove nem dez, e as duas diferenças ensinam a mesma coisa.
--   A décima (`ruas_itbi`) só apareceu quando o INSTRUMENTO mudou: a visão
--   `information_schema` não enxerga quadro de resumo, e por isso contava nove.
--   A décima primeira (`vendas_itbi`) só apareceu quando a PERMISSÃO contada
--   mudou: ela não tem esvaziar, tem manutenção — e manutenção é a mais
--   silenciosa das quatro. Contar por esvaziar dá 10; contar por manutenção dá
--   11. É exatamente o erro que esta obra existe para não cometer, e é por isso
--   que a guarda imprime os dois instrumentos e as quatro permissões, sempre.
--
-- ─── OS TRÊS ACESSOS SEM LOGIN QUE SÃO PROPOSITAIS E NÃO SE ENCOSTAM ────────
-- Medido em 30/08/2026 neste banco:
--   `leads_vendidos`  política `anon_insert_only` (INSERT, alcança anon)
--   `pauta_feedback`  política `anon_insere`      (INSERT, alcança anon) —
--                     é o canal PRINCIPAL de resposta de cliente
--   `vendas_itbi`     política `Leitura pública`  (SELECT, alcança todo mundo)
-- Esta obra mexe em PERMISSÃO DE TABELA, nunca em política. Nenhuma das três é
-- criada, alterada ou apagada aqui, e as três continuam funcionando: inserir e
-- ler são do dia a dia, e o dia a dia não é tocado.
-- ⚠ Correção de fato ao 02_ARQUITETURA.md, medida por mim: `vendas_itbi` existe
--   NOS DOIS BANCOS, e nos dois ela é lida sem login (aqui pela política
--   `Leitura pública`, na ElpIA pela política `anonimo_le`). A planta dizia que
--   ela estava só na ElpIA.
--
-- ─── ⚠ O MISTÉRIO DO `garimpo_achados`, RESOLVIDO COM PROVA ─────────────────
-- O `schema.sql` deste repositório tem um laço com 28 nomes escritos à mão que
-- roda `revoke all … from anon` (linhas 665 a 683), e `garimpo_achados` ESTÁ na
-- lista. Mesmo assim ela continuava aberta. Não é defeito do laço. As provas:
--   (a) o laço é da Fase 2, de 19/06/2026 (comentário do `schema.sql`:655);
--   (b) a tabela foi criada em 10/07/2026 (`schema.sql`:439), 21 dias DEPOIS;
--   (c) o número interno dela no banco (19141) é maior que o de todas as
--       tabelas daquele lote e menor que o das que vieram depois, o que casa
--       com a data;
--   (d) as permissões dela hoje são o molde de fábrica INTACTO
--       (`anon=arwdDxtm`), enquanto as vizinhas do laço mostram a marca do
--       revoke. Se o laço tivesse rodado nela, a marca estaria lá.
-- Conclusão: o nome entrou na lista do DOCUMENTO, e o documento não é executado.
-- A migração que você está lendo NÃO herda esse defeito, porque ela não lê
-- lista nenhuma: ela varre o banco de verdade, na hora.
--
-- ─── ⚠ ACHADO QUE VAI PARA A PRIMEIRA LINHA DA ENTREGA ──────────────────────
--
-- MEDIDO EM 30/08/2026, nos dois bancos, com o mesmo crachá que aplica migração:
--     select current_user                                       -> postgres
--     select pg_has_role(current_user,'supabase_admin','member') -> FALSO
--     select rolsuper from pg_roles where rolname=current_user   -> FALSO
--
-- E o manual diz quem pode mexer no molde de quem:
--   "While you can change your own default privileges and the defaults of roles
--    that you are a member of…"
--   `_manuais/postgresql/03_BANCO_o-padrao-de-tabela-nova.md`:171
--
-- Ou seja: com o crachá que a casa tem, NÃO DÁ para fechar o molde do segundo
-- criador (`supabase_admin`). Este arquivo TENTA, e quando não consegue ele
-- AVISA em voz alta e segue, em vez de abortar. O tamanho do que sobra também
-- foi medido: TODOS os objetos do `public` deste banco pertencem a `postgres` e
-- ZERO pertencem a `supabase_admin` (conferido em 30/08/2026, quando eram 39),
-- e toda migração roda como
-- `postgres`. Continua sendo um furo, e continua sendo do Alex a decisão de
-- aceitar alarme no lugar de tranca.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── TRAVA DE BANCO CERTO ───────────────────────────────────────────────────
-- `current_database()` não serve: nos dois bancos ele responde "postgres".
-- Os sinais abaixo foram MEDIDOS nos dois em 30/08/2026: a tabela `bairros`
-- existe só aqui; o esquema `app` e a tabela `fms_lancamentos` existem só na
-- ElpIA. São três sinais, e não um, porque um sinal só pode ser apagado.
do $trava$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relname = 'bairros')
     or exists (select 1 from pg_namespace where nspname = 'app')
     or exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relname = 'fms_lancamentos')
  then
    raise exception 'BANCO ERRADO. Este arquivo é do banco do Alex OS e nada foi mudado. O da ElpIA chama-se 20260830u_seguranca_padrao_e_varredura_elpia.sql';
  end if;
end $trava$;

begin;

-- Falhar rápido em vez de ficar na fila segurando quem está usando o sistema.
-- O manual diz que o que pega a tabela inteira pede a tranca mais forte que
-- existe (`_manuais/postgresql/08_BANCO_trancas-de-tabela.md`:189-191), e os
-- dois bancos têm tabela grande e lida sem login (`vendas_itbi`).
set local lock_timeout = '5s';

-- ─── A FOTOGRAFIA DE ANTES, dentro da própria transação ─────────────────────
-- Serve de cinto de segurança: no fim, a migração confere que NADA do dia a dia
-- mudou e que a chave de serviço continua intacta. Sem isto, "o comando rodou"
-- seria a única prova, e o manual avisa que rodar não prova nada:
--   "…the other forms will issue a warning if grant options for any of the
--    privileges specifically named in the command are not held."
--   `_manuais/postgresql/06_BANCO_REVOKE_tirar-permissao.md`:275
create temporary table _antes_da_obra on commit drop as
select c.oid,
       c.relname,
       has_table_privilege('anon',          c.oid, 'SELECT') as anon_select,
       has_table_privilege('anon',          c.oid, 'INSERT') as anon_insert,
       has_table_privilege('anon',          c.oid, 'UPDATE') as anon_update,
       has_table_privilege('anon',          c.oid, 'DELETE') as anon_delete,
       has_table_privilege('authenticated', c.oid, 'SELECT') as auth_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') as auth_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') as auth_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') as auth_delete,
       has_table_privilege('service_role',  c.oid, 'SELECT')     as sr_select,
       has_table_privilege('service_role',  c.oid, 'INSERT')     as sr_insert,
       has_table_privilege('service_role',  c.oid, 'UPDATE')     as sr_update,
       has_table_privilege('service_role',  c.oid, 'DELETE')     as sr_delete,
       has_table_privilege('service_role',  c.oid, 'TRUNCATE')   as sr_truncate,
       has_table_privilege('service_role',  c.oid, 'MAINTAIN')   as sr_maintain,
       has_table_privilege('service_role',  c.oid, 'TRIGGER')    as sr_trigger,
       has_table_privilege('service_role',  c.oid, 'REFERENCES') as sr_references
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p','v','m','f');

-- ════════════════════════════════════════════════════════════════════════════
-- FRENTE A — O MOLDE DE TABELA NOVA
-- ════════════════════════════════════════════════════════════════════════════
-- Rodar isto duas vezes não dá erro e não muda nada na segunda: revogar o que
-- já não está lá é operação vazia, não é erro.

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from anon, authenticated;

-- O SEGUNDO CRIADOR. Ver o achado no cabeçalho: com o crachá que a casa tem,
-- isto NÃO passa. Por que avisar e seguir, em vez de abortar tudo:
--   se abortasse, nada seria consertado — nem o molde do `postgres`, que é o
--   criador de 100% das tabelas destes dois bancos, nem os 86 objetos já
--   abertos. Trocaria um furo por dois. O furo que sobra fica BARULHENTO: a
--   guarda `ferramentas/guarda-portas-do-banco.mjs` continua acusando este
--   molde toda vez que rodar, com o nome do criador na frente.
do $segundo_criador$
begin
  if pg_has_role(current_user, 'supabase_admin', 'member') then
    execute 'alter default privileges for role supabase_admin in schema public
               revoke truncate, references, trigger, maintain on tables from anon, authenticated';
    raise notice 'MOLDE: fechado para os DOIS criadores (postgres e supabase_admin).';
  else
    raise warning 'MOLDE FECHADO PELA METADE, E ISTO É PARA O ALEX DECIDIR.';
    raise warning 'O crachá que aplicou esta migração (%) NÃO é membro de supabase_admin, e o manual só deixa mudar o molde do próprio papel ou de papel do qual se é membro (03_BANCO_o-padrao-de-tabela-nova.md:171).', current_user;
    raise warning 'O molde do postgres FOI fechado: é ele que cria toda tabela da casa. O molde do supabase_admin CONTINUA ABERTO: se um dia a plataforma criar uma tabela no esquema public, ela nascerá com as quatro permissões.';
    raise warning 'Medido em 30/08/2026: hoje, zero objetos deste banco pertencem a supabase_admin. A guarda acusa este molde toda vez que rodar.';
  end if;
end $segundo_criador$;

-- ════════════════════════════════════════════════════════════════════════════
-- FRENTE B — O QUE JÁ EXISTE
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠ ESTE BLOCO É IDÊNTICO, PALAVRA POR PALAVRA, AO DA MIGRAÇÃO DO ALEX OS.
--   É de propósito, e o QA compara os dois caractere a caractere.
do $varredura$
declare
  r          record;
  v_tocados  integer := 0;
  v_universo integer;
begin
  select count(*) into v_universo
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p','v','m','f');

  for r in
    select c.oid, c.relname, c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m','f')
    order by c.relname
  loop
    execute format(
      'revoke truncate, references, trigger, maintain on %s from anon, authenticated',
      r.oid::regclass);
    v_tocados := v_tocados + 1;
  end loop;

  -- O de cima e o de baixo da conta têm de bater. Se não baterem, alguém criou
  -- ou apagou objeto no meio da varredura, e a fotografia mentiu.
  if v_tocados <> v_universo then
    raise exception 'VARREDURA INCOMPLETA: o esquema tem % objetos e a varredura tocou %. Nada foi mudado.',
      v_universo, v_tocados;
  end if;

  raise notice 'VARREDURA: % objetos do esquema public, todos percorridos um a um.', v_tocados;
end $varredura$;

-- ════════════════════════════════════════════════════════════════════════════
-- O CINTO DE SEGURANÇA — a migração não acredita que rodou, ela mede
-- ════════════════════════════════════════════════════════════════════════════
-- ⚠ ESTE BLOCO TAMBÉM É IDÊNTICO AO DA MIGRAÇÃO DO ALEX OS.
--   Ele NÃO é a guarda. A guarda mora em `ferramentas/guarda-portas-do-banco.mjs`,
--   roda por fora dos dois bancos e continua rodando depois. Este bloco só
--   impede que ESTA transação confirme um estrago.
do $conferir$
declare
  v_abertas   integer;
  v_universo  integer;
  v_mudou     integer;
  v_controle  integer;
  v_molde     integer;
begin
  select count(*) into v_universo
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p','v','m','f');

  -- 1. Nenhuma das quatro sobrou, para nenhum dos dois crachás.
  select count(*) into v_abertas
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join lateral unnest(array['anon','authenticated']) as cracha
  cross join lateral unnest(array['TRUNCATE','MAINTAIN','TRIGGER','REFERENCES']) as perm
  where n.nspname = 'public' and c.relkind in ('r','p','v','m','f')
    and has_table_privilege(cracha, c.oid, perm);
  if v_abertas > 0 then
    raise exception 'A VARREDURA NÃO FECHOU TUDO: sobraram % permissões abertas em % objetos. Nada foi mudado.',
      v_abertas, v_universo;
  end if;

  -- 2. CONTROLE POSITIVO OBRIGATÓRIO (lição L-9): o dia a dia NÃO pode ter
  --    mudado. Se este número não for zero, a obra quebrou o sistema e a
  --    transação tem de morrer aqui, não na tela do Alex amanhã.
  select count(*) into v_mudou
  from _antes_da_obra a
  where a.anon_select  is distinct from has_table_privilege('anon',          a.oid, 'SELECT')
     or a.anon_insert  is distinct from has_table_privilege('anon',          a.oid, 'INSERT')
     or a.anon_update  is distinct from has_table_privilege('anon',          a.oid, 'UPDATE')
     or a.anon_delete  is distinct from has_table_privilege('anon',          a.oid, 'DELETE')
     or a.auth_select  is distinct from has_table_privilege('authenticated', a.oid, 'SELECT')
     or a.auth_insert  is distinct from has_table_privilege('authenticated', a.oid, 'INSERT')
     or a.auth_update  is distinct from has_table_privilege('authenticated', a.oid, 'UPDATE')
     or a.auth_delete  is distinct from has_table_privilege('authenticated', a.oid, 'DELETE');
  if v_mudou > 0 then
    raise exception 'ESTA OBRA MEXEU NO DIA A DIA, E NÃO PODIA: % objetos mudaram em ler/inserir/alterar/apagar linha. Nada foi mudado.', v_mudou;
  end if;

  -- 3. CONTROLE POSITIVO 2: a chave de serviço, intacta nas oito.
  select count(*) into v_controle
  from _antes_da_obra a
  where a.sr_select     is distinct from has_table_privilege('service_role', a.oid, 'SELECT')
     or a.sr_insert     is distinct from has_table_privilege('service_role', a.oid, 'INSERT')
     or a.sr_update     is distinct from has_table_privilege('service_role', a.oid, 'UPDATE')
     or a.sr_delete     is distinct from has_table_privilege('service_role', a.oid, 'DELETE')
     or a.sr_truncate   is distinct from has_table_privilege('service_role', a.oid, 'TRUNCATE')
     or a.sr_maintain   is distinct from has_table_privilege('service_role', a.oid, 'MAINTAIN')
     or a.sr_trigger    is distinct from has_table_privilege('service_role', a.oid, 'TRIGGER')
     or a.sr_references is distinct from has_table_privilege('service_role', a.oid, 'REFERENCES');
  if v_controle > 0 then
    raise exception 'A CHAVE DE SERVIÇO FOI TOCADA em % objetos, e as peças de servidor entram por ela. Nada foi mudado.', v_controle;
  end if;

  -- 4. O molde do `postgres` tem de estar fechado. O do `supabase_admin` é
  --    informado, não exigido, pelo motivo escrito no cabeçalho.
  select count(*) into v_molde
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral aclexplode(d.defaclacl) a
  where n.nspname = 'public' and d.defaclobjtype = 'r'
    and d.defaclrole = 'postgres'::regrole
    and a.grantee::regrole::text in ('anon','authenticated')
    and a.privilege_type in ('TRUNCATE','MAINTAIN','TRIGGER','REFERENCES');
  if v_molde > 0 then
    raise exception 'O MOLDE DE TABELA NOVA DO CRIADOR postgres CONTINUA ABERTO (% permissões). O comando rodou e não fez efeito. Nada foi mudado.', v_molde;
  end if;

  select count(*) into v_molde
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral aclexplode(d.defaclacl) a
  where n.nspname = 'public' and d.defaclobjtype = 'r'
    and d.defaclrole = 'supabase_admin'::regrole
    and a.grantee::regrole::text in ('anon','authenticated')
    and a.privilege_type in ('TRUNCATE','MAINTAIN','TRIGGER','REFERENCES');
  if v_molde > 0 then
    raise warning 'O MOLDE DO SEGUNDO CRIADOR (supabase_admin) CONTINUA ABERTO: % permissões. Está no cabeçalho deste arquivo e é decisão do Alex.', v_molde;
  end if;

  raise notice 'CONFERÊNCIA OK: % objetos, zero portas abertas, dia a dia intacto, chave de serviço intacta, molde do postgres fechado.', v_universo;
end $conferir$;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- O RECADO QUE O ALEX VÊ NA TELA
-- ════════════════════════════════════════════════════════════════════════════
-- Os `raise notice` e `raise warning` acima podem não chegar à tela: o caminho
-- que aplica migração devolve as LINHAS da última consulta, não os avisos do
-- banco. Então o recado sai como consulta, que aparece sempre.
select
  'Alex OS'                                                              as banco,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m','f'))   as objetos_no_esquema,
  (select count(*)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     cross join lateral unnest(array['anon','authenticated']) as cracha
     cross join lateral unnest(array['TRUNCATE','MAINTAIN','TRIGGER','REFERENCES']) as perm
    where n.nspname = 'public' and c.relkind in ('r','p','v','m','f')
      and has_table_privilege(cracha, c.oid, perm))                      as portas_ainda_abertas,
  case when exists (
    select 1 from pg_default_acl d
    join pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral aclexplode(d.defaclacl) a
    where n.nspname = 'public' and d.defaclobjtype = 'r'
      and d.defaclrole = 'postgres'::regrole
      and a.grantee::regrole::text in ('anon','authenticated')
      and a.privilege_type in ('TRUNCATE','MAINTAIN','TRIGGER','REFERENCES'))
    then 'AINDA ABERTO' else 'fechado' end                               as molde_do_criador_postgres,
  case when exists (
    select 1 from pg_default_acl d
    join pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral aclexplode(d.defaclacl) a
    where n.nspname = 'public' and d.defaclobjtype = 'r'
      and d.defaclrole = 'supabase_admin'::regrole
      and a.grantee::regrole::text in ('anon','authenticated')
      and a.privilege_type in ('TRUNCATE','MAINTAIN','TRIGGER','REFERENCES'))
    then 'AINDA ABERTO — leia o cabeçalho deste arquivo, é decisão do Alex'
    else 'fechado' end                                                   as molde_do_criador_supabase_admin;

-- ════════════════════════════════════════════════════════════════════════════
-- O QUE ESTA OBRA NÃO CONSERTA NESTE BANCO, DECLARADO EM VEZ DE ESCONDIDO
-- ════════════════════════════════════════════════════════════════════════════
-- 1. Sete objetos continuam entregando ler/inserir/alterar/apagar linha a quem
--    NÃO fez login, sem nenhuma regra de linha escrita para ele: dd_emissoes,
--    dd_verificacoes_tjsp, pessoas_bkp_reforma, piloto_acm, piloto_gestoes,
--    piloto_importacoes e o quadro de resumo ruas_itbi. Hoje isso não vaza (a
--    tranca de linha, ligada e sem regra, nega tudo), mas basta alguém escrever
--    uma regra aberta. Tirar os quatro do dia a dia é OUTRA obra, porque ela
--    pode quebrar tela e esta não pode. É a dúvida 8.3 do 02_ARQUITETURA.md.
-- 2. `pessoas_bkp_reforma`: 58 linhas, cópia de uma reforma, tranca de linha
--    ligada e ZERO regras escritas — ninguém a lê pelo sistema. Ela ainda
--    precisa existir? Apagar é decisão do Alex, em obra própria.
-- 3. `ruas_itbi` é quadro de resumo, e quadro de resumo NÃO aceita tranca de
--    linha. A única proteção dele é a permissão de tabela, que é justamente o
--    que esta migração fecha. Depois dela, quem não fez login não tem mais nada
--    nele — nem ler, que ele já não tinha.
-- 4. `garimpo_achados` tem a política `fase2_auth_all` que alcança TODO MUNDO
--    (inclusive quem não fez login), e não só quem está logado como o nome
--    sugere. Esta obra NÃO mexe em política, então isso fica declarado, não
--    consertado. Depois desta migração quem não fez login perde as quatro
--    perigosas, mas a política continua como está.
--
-- ─── O TAMANHO DO RISCO, DITO SEM ALARME FALSO ──────────────────────────────
-- Para usar estas permissões é preciso CONEXÃO DIRETA AO BANCO, COM SENHA. Não
-- existe caminho pela internet: a porta pública aceita só GET, HEAD, POST e
-- OPTIONS, e não existe verbo de esvaziar. Isto é PERMISSÃO EXCESSIVA SEM
-- CAMINHO CONHECIDO DE USO, não "porta aberta para a internet". Continua
-- errado, continua a ser fechado, e não é motivo para acordar ninguém de
-- madrugada.
--
-- ─── COMO VOLTAR ATRÁS ──────────────────────────────────────────────────────
-- O caminho de volta é gerado da fotografia do estado de antes, não escrito à
-- mão, porque o estado de antes é DESIGUAL (manutenção alcançava 38 objetos,
-- esvaziar 13) e uma volta escrita à mão deixaria o banco MAIS ABERTO do que
-- estava. O gerador é
-- `pandora-os/ferramentas/guarda-portas-do-banco/miniatura.mjs`, e o arquivo de
-- volta fica em `Esteira/porta-do-truncate-no-banco/medicoes/`.
-- ⚠ Voltar atrás REABRE um buraco conhecido. É saída de incêndio, não plano.
