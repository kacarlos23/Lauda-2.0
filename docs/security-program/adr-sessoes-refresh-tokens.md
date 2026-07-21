# ADR: sessoes persistidas e rotacao de refresh tokens

Data: 2026-07-16  
Status: Aceito para implementacao  
Decisores: Engenharia (owner operacional nominal ainda TBD)  
Controles relacionados: SEC-02, SEC-03 e SEC-06

## Contexto

O Lauda 2.0 emitia access e refresh tokens JWT sem persistir sessao. O logout
removia apenas o estado do cliente, um refresh furtado permanecia valido ate a
expiracao e access tokens nao declaravam seu proposito. Usuario e tenant ja sao
validados por `isActive` e `deletedAt`, e o reset de senha ja possui consumo
atomico; esses controles serao preservados.

## Direcionadores

- logout e eventos de credencial devem produzir revogacao no servidor;
- nenhum refresh pode ser armazenado em claro;
- refresh concorrente nao pode criar duas cadeias validas;
- access e refresh devem falhar fechados por proposito, emissor, audiencia,
  algoritmo e claims obrigatorias;
- a solucao deve funcionar com PostgreSQL, Prisma, Expo nativo e Expo web;
- o rollout nao deve introduzir cookies sem CORS, CSRF e Origin coordenados.

## Opcoes consideradas

1. Manter JWT stateless e lista de bloqueio. Menor alteracao, mas a lista cresce
   por token e nao oferece uma representacao clara de dispositivo/login.
2. Uma sessao persistida com um refresh opaco. Simples, mas perde claims
   assinadas de proposito e exige trocar o contrato atual por completo.
3. Sessao persistida, familia e registros de refresh rotacionados. Exige mais
   persistencia, mas fornece historico minimo, reuse detection atomico e
   revogacao com escopo explicito. Esta e a opcao escolhida.

## Decisao

### Unidade e familia da sessao

Cada autenticacao bem-sucedida (login, cadastro de tenant ou cadastro publico
de membro) cria uma nova sessao. Portanto, a unidade e **por login**, nao uma
identidade de dispositivo duradoura. Metadados de IP e User-Agent ajudam a
identificar o cliente, mas nao sao usados como autenticador nem para fundir
sessoes. Cada sessao possui exatamente uma familia de refresh tokens.

O banco persiste `AuthSession`, `RefreshTokenFamily` e `RefreshToken`. Somente o
HMAC-SHA-256 do JWT de refresh, usando material secreto do servidor, e salvo.
Cada versao da familia tem `jti`, expiracao, consumo, substituto e eventual
revogacao. O token em claro existe apenas no cliente e na resposta que o emite.

### Contrato JWT

Todos os JWT aceitos usam exclusivamente `HS256`.

- issuer: `JWT_ISSUER` (padrao `lauda-api`);
- access audience: `JWT_ACCESS_AUDIENCE` (padrao `lauda-clients`);
- refresh audience: `JWT_REFRESH_AUDIENCE` (padrao `lauda-refresh`);
- access: `type: access`, `sid`, `jti`, `sub` e `userId` obrigatorios;
- refresh: `type: refresh`, `sid`, `jti`, `sub` e `userId` obrigatorios.

O middleware Bearer verifica somente o segredo/audiencia de access, confirma
`type: access` e exige uma sessao ativa. O endpoint de refresh verifica somente
o segredo/audiencia de refresh e `type: refresh`. Claims ausentes, issuer,
audience ou algoritmo divergentes falham com 401.

### Rotacao e concorrencia

A rotacao executa uma atualizacao condicional de uso unico no token atual dentro
de transacao PostgreSQL/Prisma. A mesma transacao marca o token consumido e cria
o sucessor. Apenas a requisicao que altera uma linha pode rotacionar.

Se dois refreshes chegam simultaneamente, um pode consumir a linha. O perdedor
observa a linha ja consumida, e tratado como reuse e revoga familia e sessao na
mesma transacao. Assim, pode haver uma resposta 200 e uma 401, mas o token da
resposta vencedora tambem fica revogado; nunca permanecem duas cadeias validas.
Clientes devem serializar refresh localmente para evitar esse encerramento
defensivo.

### Reuse detection e revogacao

Qualquer uso de um token conhecido que ja esteja consumido, substituido ou
revogado e reuse. O escopo e toda a familia e sua sessao, independentemente da
origem aparente. A telemetria registra somente o tipo do evento e IDs internos
de sessao/familia; nunca registra JWT, hash, e-mail, IP ou senha.

- logout atual revoga a sessao indicada pelo `sid` do access token;
- logout global revoga todas as sessoes ainda ativas do usuario autenticado;
- reset ou troca de senha revoga todas as sessoes do usuario;
- inativacao/exclusao de usuario revoga todas as suas sessoes;
- inativacao/exclusao de tenant revoga sessoes de todos os seus usuarios;
- exclusao fisica remove os registros relacionados por cascade.

Access tokens sao invalidados imediatamente porque o middleware consulta a
sessao. Revogacao e idempotente e conserva o primeiro instante/motivo.

### Retencao e metadados

Sessoes guardam `createdAt`, `lastUsedAt`, `expiresAt`, `revokedAt`, motivo,
User-Agent limitado e IP. Tokens guardam hashes, JTIs e timestamps de lifecycle.
O prazo tecnico inicial e a expiracao do refresh (padrao de sete dias) mais 30
dias para investigacao de reuse. Um job de purge deve ser implementado antes de
producao de longo prazo; ate la, o risco residual e crescimento da tabela.

### Mobile e web

Mobile preserva `expo-secure-store`; web preserva temporariamente
`localStorage`. Ambos usam fila single-flight para refresh, substituem o refresh
armazenado a cada rotacao e limpam toda a sessao local em 401 de refresh,
revogacao ou logout. Logout tenta primeiro a rota servidor-side e sempre limpa
o cliente em `finally`.

Nao sera feita migracao parcial para cookie. Uma futura decisao de cookie/BFF
devera implementar conjuntamente `HttpOnly`, `Secure`, `SameSite`, CORS com
credentials, CSRF e validacao de Origin.

### Rollout e tokens legados

O rollout e coordenado: migration aditiva, deploy do backend e depois clientes
que ja suportam rotacao. Tokens stateless anteriores serao **deliberadamente
invalidados** no deploy porque nao possuem `sid`/`jti` nem sessao persistida. Nao
ha modo de compatibilidade que aceite token legado.

Durante a observacao inicial, rejeicoes por claims legadas em refresh geram o
evento agregado `auth_legacy_refresh_rejected`, sem dados do token. Owner:
Engenharia. Remocao dessa telemetria temporaria: **2026-07-30**. A aceitacao de
tokens legados permanece desabilitada desde o primeiro deploy.

## Consequencias

Positivas: logout real, revogacao imediata, finalidade inequívoca, evidencia de
reuse e cadeia unica. Negativas: uma leitura de sessao por requisicao Bearer,
mais escritas no refresh e encerramento defensivo da sessao se o proprio cliente
disparar refresh concorrente. O cliente single-flight mitiga o ultimo ponto.

Riscos residuais: refresh no `localStorage` web continua exposto a XSS; purge e
alertas operacionais ainda precisam de job/SIEM; owners nominais permanecem TBD.

## Plano de implementacao

1. Fixar testes de contrato e concorrencia.
2. Aplicar migration aditiva e gerar Prisma Client.
3. Emitir/verificar tokens estritos e sessoes.
4. Integrar logout e eventos de lifecycle.
5. Atualizar clientes, evidencias e executar suites backend/mobile/E2E viaveis.

