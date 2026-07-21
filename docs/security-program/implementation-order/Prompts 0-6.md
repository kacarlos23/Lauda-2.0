# PROMPT 0 — Executar a Etapa 0: Gates documentais

Você está trabalhando no projeto Lauda 2.0, uma aplicação multi-tenant com backend que utiliza Prisma e possui clientes mobile/web. Sua tarefa é executar integralmente a **Etapa 0 — Gates documentais** do programa de segurança, privacidade e proteção de dados.

Este chat não possui contexto anterior. Antes de produzir qualquer alteração, faça uma inspeção completa do repositório para entender a arquitetura real, schema Prisma, rotas, serviços, repositories, jobs, scripts, clientes mobile/web, autenticação, integrações, logs, arquivos, infraestrutura e documentação existente.

Não presuma que documentos já existentes estejam corretos ou completos. Reaproveite o que existir quando válido, sem duplicar documentação desnecessariamente.

## Objetivo

Criar uma base verificável de:

- dados tratados;
- operações de tratamento;
- responsabilidades;
- ameaças;
- fornecedores;
- retenção;
- incidentes;
- privilégios.

Esta etapa deve definir quem decide, quem executa e quais riscos permanecem pendentes antes das mudanças estruturais posteriores.

## Execute nesta ordem

1. Completar um Data Map por operação e finalidade.
2. Nomear ou registrar como pendentes os Data Owners e System Owners.
3. Classificar dados e tratamentos, considerando explicitamente a possibilidade de dados relacionados ao contexto religioso.
4. Registrar, por operação, os papéis de controlador e operador.
5. Tratar a definição e governança do encarregado separadamente da classificação controlador/operador.
6. Documentar a decisão sobre público etário e critérios de avaliação de acesso provável por crianças ou adolescentes.
7. Produzir e aprovar tecnicamente o threat model inicial.
8. Inventariar fornecedores, regiões de processamento/armazenamento e subprocessadores conhecidos.
9. Criar a matriz inicial de retenção por categoria e finalidade.
10. Criar o playbook mínimo de incidentes e identificar os papéis responsáveis.
11. Executar a primeira revisão de privilégios da aplicação e, quando identificável no repositório/configuração, da infraestrutura.

## Entregas mínimas

Produza ou atualize:

- Data Map v1;
- ROPA/registro das operações de tratamento v1;
- modelo de Data Owner e System Owner;
- ADR sobre público etário e acesso provável;
- ADR sobre controlador e operador;
- documento separado sobre governança do encarregado;
- threat model v1;
- vendor register v1;
- política/matriz inicial de retenção;
- playbook mínimo de resposta a incidentes;
- access review inicial;
- registro consolidado de decisões, riscos e pendências.

## Requisitos do Data Map e ROPA

Inspecione, no mínimo:

- todas as entidades e relações Prisma;
- APIs e rotas;
- autenticação;
- mobile e web;
- jobs;
- scripts administrativos;
- uploads e arquivos;
- logs e auditoria;
- analytics/telemetria;
- e-mail/SMTP;
- Redis;
- armazenamento;
- backups quando houver configuração;
- integrações de terceiros.

Para cada tratamento, registre quando possível:

dado → titular → classificação → finalidade → origem → hipótese/base a validar → armazenamento → acesso → compartilhamento → fornecedor → região → retenção → eliminação → Data Owner → System Owner → controles → evidências.

Não invente conclusões jurídicas. Onde uma decisão depender de jurídico, privacidade, produto ou operação, registre explicitamente `TBD`, o responsável necessário e a decisão pendente.

## Threat model

Mapeie trust boundaries e ameaças relevantes, incluindo pelo menos:

- account takeover;
- cross-tenant/BOLA/IDOR;
- privilege escalation;
- mass assignment;
- abuso de GLOBAL_ADMIN;
- abuso de suporte;
- insider threat;
- token theft;
- comprometimento de CI/CD;
- vazamento de banco;
- vazamento de backup;
- logs contendo PII ou segredos;
- fornecedores comprometidos.

Relacione cada ameaça prioritária aos controles e testes existentes ou planejados.

## Access review

Revise privilégios de:

- GLOBAL_ADMIN;
- TENANT_ADMIN;
- demais roles;
- contas de suporte;
- contas de serviço;
- scripts administrativos;
- bypasses globais;
- acessos excepcionais identificáveis.

Registre owner, justificativa, necessidade atual e próxima revisão.

## Commits sugeridos

Mantenha mudanças documentais separadas:

1. `docs: add data map and ownership model`
2. `docs: add privacy and age-related decisions`
3. `docs: add threat model and vendor register`
4. `docs: add retention and incident response drafts`
5. `docs: add access review and evidence register`

Não afirme aprovação jurídica ou operacional quando aprovadores ainda estiverem `TBD`.

## Definition of Done

A etapa só pode ser declarada concluída quando:

- todas as entidades Prisma e integrações conhecidas estiverem inventariadas;
- cada tratamento possuir Data Owner e System Owner ou uma pendência formal com responsável;
- lacunas jurídicas/operacionais possuírem responsável e prazo;
- público etário e acesso provável possuírem critério formal de revisão;
- ameaças prioritárias estiverem ligadas a controles e testes;
- o playbook possuir papéis, canal, escalonamento e registro de T0;
- os documentos possuírem versão, aprovadores e próxima revisão;
- evidências estiverem ligadas aos controles correspondentes.

Produção com dados reais não deve ser considerada liberada apenas por esta implementação enquanto permanecerem sem definição mínima: ownership, incident response, fornecedores relevantes e decisão etária.

## Forma de trabalho

Primeiro apresente um diagnóstico breve do estado encontrado. Depois implemente as alterações possíveis.

Não fabrique aprovações ou informações externas que não estejam disponíveis. Para decisões que dependam de pessoas ou fornecedores, crie o artefato e registre claramente a pendência.

Ao final, entregue:

1. resumo das alterações;
2. arquivos criados/alterados;
3. decisões tomadas;
4. decisões ainda pendentes;
5. riscos residuais;
6. evidências produzidas;
7. testes/verificações executados;
8. commits realizados ou divisão exata recomendada;
9. confirmação objetiva de cada item do Definition of Done.

---

# PROMPT 1 — Executar a Etapa 1: Contenção técnica

Você está trabalhando no projeto Lauda 2.0, uma aplicação multi-tenant com autenticação JWT, backend com Prisma e clientes mobile/web.

Sua tarefa é executar integralmente a **Etapa 1 — Contenção técnica**, reduzindo imediatamente riscos de tomada de conta, brute force e autorização indevida.

Este chat não possui contexto anterior. Antes de alterar código, inspecione o estado atual do repositório e identifique o que já foi implementado, o que está incompleto e o que ainda falta. Não reimplemente controles já corretos.

## Objetivos principais

Implementar e comprovar:

- recuperação de senha segura;
- ausência de PINs e segredos em logs;
- rate limiting distribuído quando aplicável;
- proteção de login, refresh, forgot/reset, registro e convites;
- prevenção de enumeração de usuários;
- elegibilidade canônica de usuário e tenant;
- classificação correta de erros JWT versus falhas de infraestrutura.

## Pré-requisitos a verificar

Confirme:

- secrets independentes por ambiente;
- disponibilidade/configuração prevista para Redis;
- comportamento quando Redis estiver indisponível;
- configuração real de `trust proxy`;
- provedor SMTP e forma de entrega do reset;
- migration e estratégia de rollback.

Dependências operacionais não disponíveis não devem ser simuladas como concluídas. Implemente o código/configuração possível e registre claramente o bloqueio operacional restante.

## Execute nesta ordem

1. Criar testes de caracterização do password reset e de ausência de dados sensíveis em logs.
2. Criar migration aditiva para um modelo seguro de challenge de reset.
3. Gerar PIN de seis dígitos com CSPRNG.
4. Armazenar HMAC do desafio usando pepper secreto externo ao banco.
5. Implementar limite de tentativas, expiração e consumo único atômico.
6. Garantir que duas requisições concorrentes não consumam o mesmo desafio.
7. Remover logs de PIN e outros segredos.
8. Configurar entrega segura do PIN/reset.
9. Criar infraestrutura compartilhada de rate limiting.
10. Proteger login e refresh.
11. Proteger forgot-password e reset-password.
12. Proteger registro e uso de convites.
13. Aplicar uma única regra canônica de elegibilidade de usuário e tenant em login, refresh, Bearer e contexto do tenant.
14. Separar erros de validação JWT de erros de banco, permissões ou infraestrutura.

## Requisitos do reset

Não use `Math.random`.

Não armazene PIN em claro.

Não use SHA-256 simples do PIN.

O dump do banco, isoladamente, não deve permitir validar os seis dígitos sem conhecimento do pepper.

O challenge deve possuir:

- expiração;
- contador de tentativas;
- estado de consumo;
- invalidação adequada;
- operação atômica;
- proteção contra concorrência.

## Rate limiting

Use Redis quando houver produção ou múltiplas instâncias.

Implemente limites por IP e por identificador quando aplicável.

O identificador utilizado nas chaves do limiter não deve conter em claro:

- e-mail;
- telefone;
- token;
- código de convite.

Normalize e pseudonimize/HMAC o identificador com chave independente.

Garanta respostas `429` e `Retry-After`.

A política de falha do Redis nos fluxos públicos sensíveis deve seguir a decisão operacional definida para o projeto e não pode permitir bypass silencioso em produção.

## Autenticação e enumeração

Login com usuário inexistente e senha incorreta devem produzir resposta equivalente e custo computacional razoavelmente semelhante.

Forgot-password não deve revelar se a conta existe.

Usuário deve ser considerado elegível somente quando atender às regras atuais de lifecycle.

Verifique, no mínimo:

- `user.isActive`;
- `user.deletedAt`;
- existência do tenant quando necessário;
- `tenant.isActive`;
- `tenant.deletedAt`.

GLOBAL_ADMIN deve seguir a política específica definida pelo sistema, sem confiar em `tenantId` ou role vindos do JWT como fonte canônica.

## Erros

JWT inválido deve gerar erro de autenticação apropriado.

Falha de banco ou serviço de permissões não deve ser convertida indevidamente em `401 Token inválido`.

Preserve o tratamento adequado de 500/503 conforme arquitetura existente.

## Testes obrigatórios

Inclua testes que provem:

- PIN CSPRNG sempre com seis dígitos;
- banco sem pepper não valida PIN;
- PIN expirado falha;
- PIN consumido falha;
- PIN bloqueado por tentativas falha;
- concorrência não permite consumo duplo;
- PIN, senha e tokens não aparecem em logs;
- e-mail desnecessário não aparece em logs;
- forgot-password não enumera usuário;
- login inexistente e senha errada são equivalentes;
- limites por IP e identificador funcionam separadamente;
- chaves Redis não contêm PII/segredos em claro;
- `429` e `Retry-After` são enviados;
- usuário inativo/excluído é negado;
- tenant inativo/excluído é negado;
- regras funcionam em login, refresh e Bearer;
- falha de banco não vira `401`.

## Commits sugeridos

1. `test: define password reset security regressions`
2. `db: add password reset challenge fields`
3. `security: harden password reset lifecycle`
4. `security: add rate limit infrastructure`
5. `security: rate limit authentication endpoints`
6. `security: rate limit registration and invite endpoints`
7. `security: enforce canonical auth eligibility`
8. `fix: preserve infrastructure authentication errors`

Não misture refatorações não relacionadas.

## Definition of Done

A etapa só termina quando:

- nenhum PIN é armazenado ou registrado em claro;
- SHA-256 isolado não é usado;
- pepper e chave do limiter são independentes e externos ao banco;
- Redis está efetivamente usado em produção/múltiplas instâncias ou a dependência operacional está explicitamente bloqueando a conclusão;
- trust proxy corresponde à topologia real;
- lifecycle é consistente em todos os fluxos de autenticação;
- testes backend, integração e logs estão verdes;
- evidências estão associadas aos controles SEC-11, SEC-04, SEC-03 e SEC-18.

A revogação de sessões após reset de senha pertence à Etapa 2. Não implemente uma solução paralela incompatível com a futura arquitetura de sessões.

Ao final, entregue diagnóstico inicial, alterações realizadas, migrations, testes executados, resultados, compatibilidades afetadas, riscos residuais, pendências operacionais e confirmação item a item do Definition of Done.

---

# PROMPT 2 — Executar a Etapa 2: Sessões e revogação

Você está trabalhando no projeto Lauda 2.0, uma aplicação multi-tenant com backend Prisma, autenticação JWT e clientes mobile/web.

Sua tarefa é executar integralmente a **Etapa 2 — Sessões e revogação**, migrando refresh tokens stateless para sessões controláveis no servidor.

Este chat não possui contexto anterior. Antes de modificar o código, inspecione o estado real da autenticação e confirme se os requisitos de elegibilidade de usuário/tenant e o reset seguro já existem. Reaproveite implementações corretas.

## Objetivo

Implementar:

- sessões persistidas;
- famílias de refresh tokens;
- rotação atômica;
- detecção de reutilização;
- logout real no servidor;
- logout global;
- revogação após eventos de credencial/lifecycle;
- propósito inequívoco de access e refresh tokens;
- adaptação coordenada de backend, mobile e web.

## Primeira entrega obrigatória: ADR de sessões

Antes da implementação funcional, crie ou atualize um ADR definindo explicitamente:

- sessão por dispositivo ou por login;
- modelo de família de refresh tokens;
- comportamento de refresh concorrente;
- política de reuse detection;
- escopo de revogação quando reuse ocorrer;
- logout da sessão atual;
- logout global;
- retenção e metadados das sessões;
- rollout;
- tratamento de refresh tokens legados;
- prazo máximo da compatibilidade legada;
- comportamento mobile;
- comportamento web;
- claims `issuer`, `audience`, `type`, `sid` e `jti`;
- algoritmo JWT aceito.

Não deixe decisões críticas implícitas no código.

## Execute nesta ordem

1. Escrever testes do contrato de tokens e sessões.
2. Criar migration aditiva com sessões e famílias.
3. Implementar access token com `type: access`.
4. Implementar refresh token com `type: refresh`, `sid` e `jti`.
5. Definir e validar `issuer` e `audience`.
6. Restringir explicitamente o algoritmo aceito.
7. Armazenar somente hash seguro do refresh token/material necessário.
8. Implementar rotação transacional e atômica.
9. Implementar detecção de reuse.
10. Aplicar a política de revogação da família definida no ADR.
11. Implementar logout da sessão atual.
12. Implementar logout global.
13. Revogar sessões após reset de senha.
14. Revogar sessões após troca de senha.
15. Revogar conforme política após desativação/exclusão de usuário.
16. Revogar conforme política após desativação/exclusão de tenant.
17. Adaptar cliente mobile.
18. Adaptar cliente web.
19. Adicionar telemetria segura para medir compatibilidade legada.
20. Remover compatibilidade legada no prazo definido ou deixar mecanismo explícito com owner e data de remoção.

## Requisitos de segurança

Refresh token nunca pode ser aceito como Bearer.

Access token nunca pode ser aceito no endpoint de refresh.

Tokens com:

- purpose/type errado;
- issuer errado;
- audience errada;
- algoritmo inesperado;
- claims obrigatórias ausentes

devem ser rejeitados.

Logout deve ser efetivo no servidor, não apenas limpeza local.

Reuse detection deve ser segura contra concorrência.

Não armazene refresh token em claro.

## Concorrência

Defina e teste explicitamente o comportamento quando dois refreshes válidos chegam simultaneamente.

O resultado deve ser determinístico e não pode criar duas cadeias válidas independentes por acidente.

Use transação/controle de concorrência compatível com PostgreSQL/Prisma e com a arquitetura existente.

## Mobile e web

Atualize o interceptor/fluxo de autenticação sem criar loops infinitos de refresh.

Após logout ou revogação detectada, o mobile deve limpar credenciais locais.

Preserve armazenamento seguro nativo existente.

Para web, respeite a estratégia aprovada no ADR. Não faça migração improvisada para cookies sem implementar conjuntamente os requisitos necessários de CORS/credentials/CSRF/Origin.

## Compatibilidade

A introdução de novos claims pode invalidar tokens existentes.

Escolha explicitamente uma estratégia:

- invalidação deliberada;
- janela curta e mensurável de compatibilidade;
- expiração natural quando comprovadamente segura.

Nenhum modo legado pode permanecer sem owner e data de remoção.

## Testes obrigatórios

Prove:

- refresh nunca funciona como Bearer;
- access nunca funciona como refresh;
- claims inválidas são rejeitadas;
- algoritmo inesperado é rejeitado;
- refresh antigo falha após rotação;
- reuse gera a revogação definida;
- concorrência possui resultado determinístico;
- logout atual revoga apenas o escopo definido;
- logout global revoga todas as sessões elegíveis;
- reset de senha revoga sessões;
- troca de senha revoga sessões;
- usuário inativo/excluído não consegue refresh;
- tenant inativo/excluído não consegue refresh;
- mobile limpa credenciais após revogação/logout;
- fluxos backend, mobile, integração e E2E relevantes permanecem verdes.

## Commits sugeridos

1. `docs: decide session and token lifecycle`
2. `test: define token purpose and session rotation`
3. `db: add sessions and refresh families`
4. `security: add token purpose issuer and audience`
5. `security: rotate refresh tokens atomically`
6. `security: detect refresh token reuse`
7. `security: add current and global logout`
8. `security: revoke sessions on credential lifecycle`
9. `mobile: adopt server-side session lifecycle`
10. `security: remove legacy refresh compatibility`

Mantenha persistência, claims, rotação e clientes consumidores coordenados no rollout, mas preserve commits logicamente revisáveis.

## Definition of Done

A etapa termina apenas quando:

- rotação é atômica;
- reuse detection é atômico;
- logout funciona no servidor;
- eventos de credencial/lifecycle revogam sessões conforme política;
- access e refresh possuem propósito inequívoco;
- compatibilidade legada foi removida ou possui owner e prazo;
- testes backend, mobile, integração e E2E relevantes estão verdes;
- evidências estão ligadas a SEC-02, SEC-03 e SEC-06.

Ao final, entregue o ADR, diagnóstico do estado inicial, alterações, migrations, modelo de sessão escolhido, comportamento de concorrência, estratégia de rollout, testes/resultados, riscos residuais e confirmação item a item do Definition of Done.

# PROMPT 3 — Executar a Etapa 3: Multi-tenant, RBAC e administração

Você está trabalhando no projeto Lauda 2.0, uma aplicação multi-tenant com backend Prisma, autenticação baseada em sessões/JWT, múltiplas roles administrativas e clientes mobile/web.

Sua tarefa é executar integralmente a **Etapa 3 — Multi-tenant, RBAC e administração**.

Este chat não possui contexto anterior. Antes de alterar código, inspecione o repositório e confirme o estado real de sessões, identidade, roles, permissões, tenant context, `basePrisma`, GLOBAL_ADMIN e ferramentas administrativas.

Não presuma que todo isolamento atual esteja correto. Também não reescreva controles já comprovadamente seguros sem necessidade.

## Objetivo

Comprovar e reforçar que:

- Tenant A nunca acessa ou modifica dados do Tenant B;
- campos protegidos não sofrem mass assignment;
- o backend é a fonte canônica de autorização;
- mudanças de role/permissão têm efeito conforme o modelo atual;
- bypasses globais são mínimos e controlados;
- GLOBAL_ADMIN possui proteção forte;
- suporte usa acesso temporário, limitado e auditável;
- privilégios são periodicamente recertificados.

## Pré-requisitos

Confirme:

- sessões e identidade estáveis;
- contrato real das quatro roles;
- política de MFA e step-up;
- modelo de break-glass;
- inventário inicial ou usos existentes de `basePrisma`/cliente global.

Caso uma decisão administrativa externa ainda não esteja disponível, não fabrique aprovação. Implemente a estrutura segura possível e registre o bloqueio.

## Estratégia obrigatória por domínio

Primeiro identifique todos os domínios do sistema.

Para cada domínio, teste e corrija nesta ordem:

1. listagem e busca;
2. leitura por ID;
3. criação com IDs relacionais;
4. atualização parcial;
5. atualização total;
6. exclusão;
7. paginação;
8. filtros;
9. arquivos;
10. relatórios;
11. exportações.

Somente avance para o próximo domínio após a regressão do domínio atual ficar verde.

## Cross-tenant / BOLA / IDOR

Crie harness reutilizável com pelo menos:

- Tenant A;
- Tenant B;
- usuário/sessão válida de A;
- usuário/sessão válida de B;
- recursos válidos pertencentes a ambos.

Tente substituir IDs em:

- path;
- query;
- body;
- IDs relacionais;
- paginação;
- filtros;
- buscas;
- arquivos;
- relatórios;
- exportações.

Verifique tanto a resposta quanto o estado persistido.

Falhas de autorização não devem revelar indevidamente existência, metadata ou detalhes internos do recurso de outro tenant.

## Mass assignment / property-level authorization

Em todos os endpoints POST/PATCH/PUT relevantes, tente injetar campos protegidos, incluindo:

- `tenantId`;
- `role`;
- `permissions`;
- `ownerId`;
- `createdBy`;
- `isActive`;
- `deletedAt`.

Teste também:

- campos read-only;
- relações com IDs de outro tenant;
- objetos aninhados;
- arrays;
- parâmetros duplicados;
- casing alternativo;
- objeto completo retornado por GET reenviado em PATCH.

Critério: campos não autorizados devem ser explicitamente rejeitados ou ignorados de forma segura, sem alteração direta ou indireta no banco.

## basePrisma / acesso global

Inventarie todos os imports e usos do cliente Prisma sem escopo de tenant.

Para cada uso:

- justificar necessidade;
- identificar owner;
- definir contexto autorizado;
- adicionar teste;
- encapsular quando possível;
- impedir novos usos acidentais fora de uma allowlist.

Considere teste arquitetural/lint para restringir imports.

## RBAC

Consolide o contrato canônico no backend.

Teste:

- todas as quatro roles;
- permissões ALLOW/DENY;
- overrides;
- mudança de role;
- mudança de permissões;
- efeito na requisição seguinte conforme arquitetura atual.

Não confie em role/tenantId do JWT como fonte definitiva quando o sistema já utiliza estado atual do banco.

## GLOBAL_ADMIN

Remova alvos/e-mails hardcoded de scripts de promoção.

Exija:

- alvo explícito;
- motivo;
- confirmação adequada;
- auditoria;
- proteção contra ações perigosas;
- MFA para conta GLOBAL_ADMIN em produção com dados reais;
- step-up para ações globais sensíveis/destrutivas.

Promoção e rebaixamento devem gerar auditoria.

## Suporte break-glass

Implemente acesso de suporte como mecanismo separado de GLOBAL_ADMIN cotidiano.

Exija:

- ticket/referência;
- motivo;
- step-up/MFA;
- tenant ou recurso específico;
- escopo mínimo;
- sessão/acesso identificável;
- prazo;
- expiração automática;
- auditoria completa.

Suporte cotidiano não deve usar poder global irrestrito.

## Access review

Execute a revisão inicial e prepare recorrência para:

- GLOBAL_ADMIN;
- TENANT_ADMIN;
- suporte;
- contas de serviço;
- bypasses globais;
- acessos excepcionais.

Registre owner, justificativa e próxima revisão.

## Commits sugeridos

1. `test: add cross-tenant harness`
2. Teste e correção separados por domínio
3. `test: add property authorization matrix`
4. `security: restrict mass assignment by endpoint group`
5. `security: inventory and encapsulate base prisma bypasses`
6. `security: consolidate backend rbac contract`
7. `security: harden global admin promotion`
8. `security: require global admin mfa and step-up`
9. `security: add scoped support break-glass`
10. `docs: operationalize privilege recertification`

Não esconda correções de autorização em grandes refatorações transversais.

## Definition of Done

A etapa termina somente quando:

- matriz A→B cobre todos os domínios relevantes;
- operações de leitura e escrita estão cobertas;
- campos protegidos resistem a mass assignment;
- cada uso de `basePrisma` possui justificativa, owner e teste;
- backend é a fonte canônica de autorização;
- GLOBAL_ADMIN em produção real exige MFA;
- ações globais sensíveis exigem step-up conforme política;
- suporte cotidiano não usa acesso global irrestrito;
- break-glass possui ticket, motivo, escopo, step-up e expiração;
- access review inicial foi concluído;
- próxima revisão está agendada;
- evidências cobrem SEC-07, SEC-07A, SEC-08, SEC-09, GOV-05 e GOV-06.

Ao final, entregue matriz de cobertura por domínio, vulnerabilidades encontradas, correções feitas, testes executados, usos legítimos de `basePrisma`, modelo RBAC final, desenho do GLOBAL_ADMIN/break-glass, riscos residuais e confirmação item a item do Definition of Done.

---

# PROMPT 4 — Executar a Etapa 4: Lifecycle de dados e direitos

Você está trabalhando no projeto Lauda 2.0, uma aplicação multi-tenant que trata dados pessoais e possui backend Prisma, autenticação/sessões, logs, tenants e clientes mobile/web.

Sua tarefa é executar integralmente a **Etapa 4 — Lifecycle de dados e direitos**, transformando políticas de retenção e direitos dos titulares em processos técnicos executáveis e auditáveis.

Este chat não possui contexto anterior. Antes de alterar código, inspecione schema, serviços, jobs, sessões, reset challenges, convites, usuários, tenants, logs, backups/configurações e documentação de retenção existente.

Não invente decisões jurídicas ou prazos de retenção. Utilize somente políticas aprovadas existentes. Quando uma decisão necessária estiver ausente, registre o bloqueio e implemente apenas a infraestrutura segura que não dependa da decisão.

## Objetivo

Definir e implementar quando dados são:

- mantidos;
- anonimizados;
- bloqueados;
- eliminados;
- exportados;
- preservados por legal hold.

## Decisões que devem existir ou ser registradas como pendentes

- retenção por categoria e finalidade;
- evento que inicia cada prazo;
- evento que encerra cada prazo;
- autoridade para legal hold;
- escopo do legal hold;
- requisitos de verificação de identidade;
- exportação por titular;
- exportação por Tenant Admin;
- acesso excepcional GLOBAL_ADMIN;
- anonimização versus exclusão por entidade;
- encerramento de tenant;
- tratamento de cópias em backup.

## Execute nesta ordem

1. Validar/aprovar tecnicamente a matriz de retenção existente.
2. Definir eventos de início/fim de cada prazo.
3. Criar testes de privacy lifecycle.
4. Implementar purge de reset challenges expirados.
5. Implementar purge/invalidação de convites conforme política.
6. Implementar limpeza de sessões conforme política.
7. Separar retenção das categorias de logs.
8. Criar workflow/protocolo de solicitações de titulares.
9. Implementar verificação de identidade proporcional.
10. Criar exportadores usando allowlist.
11. Tornar exportadores tenant-aware.
12. Implementar correção e bloqueio quando aplicável.
13. Implementar decisão/fluxo de eliminação.
14. Implementar anonimização ou purge de usuário.
15. Implementar encerramento e purge de tenant.
16. Criar ledger mínimo de eliminações.
17. Integrar legal hold.
18. Implementar mecanismo para reaplicar eliminações após restore de backup.

## Retenção

Separe, no mínimo, categorias distintas para:

- desafios de autenticação/reset;
- convites;
- sessões;
- registros de acesso;
- logs de segurança;
- logs de auditoria;
- logs de observabilidade;
- contas;
- tenants;
- evidências de incidentes/legal hold.

Cada categoria deve possuir:

- finalidade;
- owner;
- evento inicial;
- período aprovado;
- ação ao final;
- exceções;
- evidência do job/processo.

## Jobs

Jobs de retenção/purge devem ser:

- idempotentes;
- seguros para reexecução;
- observáveis;
- testáveis;
- auditáveis quando necessário.

Dados dentro do prazo devem ser preservados.

Dados após o prazo devem seguir exatamente a ação aprovada.

Legal hold deve suspender apenas o descarte necessário, não todo o lifecycle indiscriminadamente.

## Solicitações de titulares

Implemente workflow com:

- protocolo;
- solicitante;
- estado;
- datas;
- verificação de identidade;
- escopo;
- decisão;
- execução;
- trilha de auditoria.

Evite coletar dados excessivos apenas para validar identidade.

## Exportação

Use allowlist explícita. Não faça dump genérico de tabelas ou objetos Prisma.

Prove:

- Titular A nunca recebe dados de B;
- Tenant Admin A nunca exporta dados do Tenant B;
- GLOBAL_ADMIN só acessa excepcionalmente conforme política, com justificativa e auditoria.

A exportação deve respeitar tenant, identidade e autorização por domínio.

## Purge e anonimização

Defina tecnicamente dependências e efeitos sobre:

- relações;
- auditoria;
- relatórios;
- arquivos;
- integrações;
- referências históricas.

Usuário eliminado não deve reaparecer em APIs ou buscas normais.

Tenant encerrado não deve recuperar acesso.

Purge destrutivo deve respeitar legal hold e aprovações aplicáveis.

## Backups e restore

Backups não precisam necessariamente ser alterados registro a registro.

Implemente a política definida para:

- expiração;
- acesso restrito;
- ledger de eliminações;
- reaplicação automática das eliminações quando um backup for restaurado.

Um restore não pode reintroduzir silenciosamente dados que já deveriam permanecer eliminados.

## Commits sugeridos

1. `docs: approve retention and legal hold matrix`
2. `test: define privacy lifecycle regressions`
3. `privacy: purge expired auth challenges and invites`
4. `privacy: purge expired sessions`
5. `privacy: add data subject request workflow`
6. `privacy: add tenant-aware data export`
7. `privacy: anonymize or purge deleted users`
8. `privacy: close and purge terminated tenants`
9. `privacy: add deletion ledger and restore replay`

## Testes obrigatórios

Prove:

- job idempotente;
- reexecução segura;
- dados antes do prazo preservados;
- dados após prazo processados corretamente;
- legal hold com escopo adequado;
- Titular A nunca exporta B;
- Tenant Admin A nunca exporta Tenant B;
- GLOBAL_ADMIN excepcional gera justificativa e auditoria;
- usuário eliminado não aparece em APIs/buscas;
- tenant encerrado permanece inacessível;
- restore reaplica eliminações pendentes.

## Definition of Done

A etapa termina apenas quando:

- cada categoria possui retenção, descarte e owners;
- solicitações possuem protocolo, identidade, decisão e trilha;
- exportadores usam allowlist e são tenant-aware;
- jobs são idempotentes, observáveis e reexecutáveis;
- backup possui política de expiração e reaplicação;
- privacy regression está verde;
- evidências cobrem PRV-01, PRV-03 e PRV-04.

Ao final, entregue diagnóstico, matriz efetivamente aplicada, jobs criados, workflow de titulares, modelo de exportação, estratégia de purge/anonimização, ledger de eliminações, integração com restore, testes/resultados, riscos residuais e confirmação item a item do Definition of Done.

# PROMPT 5 — Executar a Etapa 5: Observabilidade, infraestrutura e resiliência

Você está trabalhando no projeto Lauda 2.0, uma aplicação multi-tenant com backend, banco PostgreSQL/Prisma, autenticação, logs, ambientes de deploy e dados pessoais.

Sua tarefa é executar integralmente a **Etapa 5 — Observabilidade, infraestrutura e resiliência**.

Este chat não possui contexto anterior. Antes de fazer alterações, inspecione o repositório, configurações de deploy disponíveis, logging atual, auditoria, gestão de secrets, TLS, banco, volumes, backups, CI/CD e documentação operacional.

Diferencie claramente:

1. controles implementáveis em código;
2. configuração de infraestrutura que pode ser alterada com o acesso disponível;
3. controles que exigem ação externa/cloud/operacional.

Não declare um controle operacional concluído sem evidência verificável.

## Objetivos

Tornar incidentes:

- detectáveis;
- correlacionáveis;
- investigáveis;
- contíveis;
- recuperáveis,

sem transformar logs, ferramentas de observabilidade ou backups em novas fontes de vazamento.

Comprovar também:

- gestão adequada de secrets;
- separação de ambientes;
- criptografia;
- backup;
- restore;
- capacidade de resposta a incidentes.

## Decisões necessárias

Valide ou registre como pendentes:

- campos permitidos por categoria de log;
- fornecedores de observabilidade;
- regiões utilizadas;
- Secret Manager/KMS;
- estratégia de rotação;
- RPO;
- RTO;
- frequência de restore;
- imutabilidade/segregação de backup;
- papéis nominais de incidente;
- canal 24x7;
- autoridade para declarar T0.

## Execute nesta ordem

1. Definir taxonomia de logs.
2. Criar allowlist de campos.
3. Introduzir request/correlation IDs.
4. Implantar logger estruturado.
5. Implantar redaction central.
6. Tipar eventos de auditoria administrativa.
7. Restringir acesso a logs.
8. Restringir acesso a secrets.
9. Migrar produção para Secret Manager/KMS quando o ambiente permitir.
10. Implementar/documentar rotação de chaves.
11. Comprovar TLS.
12. Comprovar separação de ambientes.
13. Comprovar que produção não reutiliza secrets de staging.
14. Criptografar/segregar backups conforme infraestrutura disponível.
15. Aprovar RPO e RTO.
16. Automatizar ou documentar restore.
17. Executar um restore completo real em ambiente seguro.
18. Medir o restore contra RPO/RTO.
19. Reaplicar eliminações registradas após restore.
20. Executar tabletop de incidente.
21. Atualizar playbook.
22. Registrar métricas e ações corretivas.

## Logging e redaction

Nunca registre por padrão:

- `Authorization`;
- cookies;
- access tokens;
- refresh tokens;
- PINs;
- códigos de convite;
- reset tokens;
- senhas;
- hashes quando desnecessários;
- request body integral;
- e-mail sem finalidade aprovada;
- telefone sem finalidade aprovada;
- notas/perfil sem finalidade aprovada;
- payload completo de usuário.

A mesma política deve ser aplicada, quando presentes, a:

- Sentry;
- Datadog;
- CloudWatch;
- Firebase;
- Expo;
- analytics;
- crash dumps;
- futuras ferramentas de observabilidade.

Prefira allowlist a blocklist isolada.

## Request IDs

Garanta correlação entre:

- requisição;
- logs;
- auditoria;
- erros;
- eventos administrativos.

O request ID deve ser propagado de forma consistente e segura.

## Auditoria

Crie eventos administrativos tipados.

Evite payload livre como padrão.

Eventos sensíveis devem registrar contexto suficiente para investigação sem persistir secrets ou PII desnecessária.

## Secrets e infraestrutura

Busque:

- secrets em `.env`;
- secrets no repositório;
- secrets no CI;
- secrets em configurações;
- credenciais compartilhadas;
- reutilização entre staging/produção.

Produção deve utilizar mecanismo gerenciado de secrets/KMS quando aplicável.

Acesso deve ser individual, mínimo e auditável.

Não marque Secret Manager/KMS como concluído apenas por adicionar código se o serviço não tiver sido realmente provisionado/configurado.

## Backup e restore

Avalie:

- criptografia;
- segregação de credenciais;
- retenção;
- imutabilidade quando aplicável;
- acesso;
- automação;
- restore.

Execute restore completo e meça:

- tempo de recuperação;
- ponto recuperado;
- aderência ao RPO;
- aderência ao RTO.

Após restore, prove que eliminações anteriores são reaplicadas conforme o ledger/política existente.

## Tabletop

Execute ou produza exercício formal para cenários:

- token theft;
- cross-tenant;
- comprometimento de banco;
- vazamento/comprometimento de backup;
- ransomware;
- incidente em fornecedor.

A timeline deve registrar:

- detecção;
- confirmação;
- T0;
- contenção;
- decisão;
- comunicação quando aplicável;
- recuperação.

Cada ação corretiva deve possuir owner e prazo.

## Commits/mudanças sugeridas

Código:

1. `observability: add request correlation ids`
2. `observability: add structured logger`
3. `security: centralize sensitive data redaction`
4. `audit: introduce typed administrative events`

Infra/operação:

5. `infra: adopt managed secrets and key rotation`
6. `infra: enforce encrypted transport and storage`
7. `resilience: define backup and restore automation`

Documentação/evidência:

8. `docs: record incident tabletop and remediations`

Mantenha código separado de mudanças operacionais.

## Testes e exercícios obrigatórios

Prove:

- redaction unitária;
- redaction de integração;
- request ID entre API e auditoria;
- ausência de secrets em logs de sucesso;
- ausência de secrets em logs de erro;
- acesso a secrets individual e auditável;
- produção não usa chaves de staging;
- restore cumpre ou mede claramente RPO/RTO;
- restore reaplica eliminações;
- tabletop realizado/documentado;
- timeline operacional contém T0 e marcos principais.

## Definition of Done

A etapa termina somente quando:

- logger usa allowlist e redaction central;
- retenção distingue acesso, segurança, auditoria e observabilidade;
- secrets, banco, volumes e backups atendem à política aplicável;
- restore foi de fato executado e medido;
- playbook possui pessoas, canal e relógio operacional;
- ações do tabletop possuem owners e prazos;
- evidências cobrem SEC-12, RES-01, RES-02 e RES-03.

Ao final, separe claramente:

- implementado e comprovado;
- implementado mas ainda não comprovado operacionalmente;
- bloqueado por infraestrutura/acesso externo.

Entregue também testes, evidências, resultados do restore, métricas, tabletop, riscos residuais e confirmação item a item do Definition of Done.

---

# PROMPT 6 — Executar a Etapa 6: Secure SDLC

Você está trabalhando no projeto Lauda 2.0, uma aplicação multi-tenant com backend, mobile/web, CI/CD e requisitos de segurança e proteção de dados.

Sua tarefa é executar integralmente a **Etapa 6 — Secure SDLC**, transformando controles de segurança pontuais em um processo contínuo de detecção, triagem, correção, teste e evidência.

Este chat não possui contexto anterior. Antes de implementar ferramentas, inspecione:

- linguagens e frameworks;
- package managers;
- lockfiles;
- GitHub Actions ou CI equivalente;
- infraestrutura como código;
- Dockerfiles/imagens;
- staging;
- processo de release;
- testes existentes;
- modelo multi-tenant;
- autenticação/sessões.

Não adicione ferramentas sem integrá-las ao fluxo real do projeto.

## Pré-requisitos

Confirme:

- sessões estabilizadas;
- multi-tenancy estabilizado;
- staging isolado;
- dados sintéticos disponíveis para DAST;
- owners definidos;
- política de exceções;
- critérios separados para runtime, desenvolvimento e infraestrutura.

Pentest independente deve ocorrer após estabilização de sessões e multi-tenancy.

## Princípio de implantação

Ferramentas novas devem seguir:

observar → criar baseline → triar achados → definir política → bloquear gradualmente.

Não introduza gates indiscriminados que quebrem a entrega devido a dívida histórica não triada.

Exceção: segredo real/confirmado introduzido no código deve poder bloquear CI imediatamente conforme política definida.

## Execute nesta ordem

1. Definir baseline de segurança.
2. Definir severidades.
3. Definir SLA por severidade/categoria.
4. Definir owners.
5. Definir processo de exceção.
6. Implantar secret scanning.
7. Implantar dependency scanning separando runtime e desenvolvimento/tooling.
8. Implantar SAST.
9. Implantar IaC scanning quando houver IaC.
10. Implantar container scanning quando houver imagens.
11. Gerar SBOM por release.
12. Implantar DAST tradicional em staging.
13. Criar DAST lógico/harness multi-tenant.
14. Triar findings existentes.
15. Registrar exceções temporárias.
16. Introduzir gates graduais no CI.
17. Preparar e executar pentest independente.
18. Corrigir achados em lotes isolados.
19. Executar reteste.
20. Guardar evidências por release.

## Secret scanning

Integre scanning ao repositório e CI.

Diferencie:

- possível secret;
- falso positivo;
- secret confirmado.

Secret confirmado não deve ser aceito silenciosamente.

Registre processo de revogação/rotação quando um secret real for encontrado.

## Dependency scanning

Separe claramente:

- dependências de runtime/produção;
- dependências de desenvolvimento;
- tooling.

Não trate automaticamente vulnerabilidade de ferramenta de testes como exposição equivalente ao runtime.

Evite upgrades forçados indiscriminados que quebrem compatibilidade.

## SAST, IaC e containers

Escolha ferramentas compatíveis com o stack real.

Para cada ferramenta, registre:

- owner;
- versão/configuração;
- baseline;
- severidades;
- supressões;
- justificativa;
- prazo de expiração da exceção.

IaC/container scanning só deve ser declarado aplicável onde esses artefatos realmente existirem.

## SBOM

Gere SBOM reproduzível por release.

Associe-o ao processo de release/artefato correspondente.

## DAST tradicional

Execute em staging isolado com dados sintéticos.

Cubra vulnerabilidades/configurações tradicionais aplicáveis, como:

- headers;
- TLS;
- injection;
- XSS;
- exposição de endpoints;
- configurações inseguras.

Não use produção com dados reais como alvo padrão.

## DAST lógico multi-tenant

Scanner tradicional NÃO é evidência suficiente de autorização lógica.

Crie harness próprio usando simultaneamente:

- Tenant A;
- Tenant B;
- GLOBAL_ADMIN;
- suporte temporário/break-glass quando implementado.

Troque IDs em:

- path;
- query;
- body;
- relações;
- arquivos;
- paginação;
- filtros;
- buscas;
- relatórios;
- exportações.

Teste respostas e estado persistido.

Inclua BOLA/IDOR e mass assignment/property-level authorization.

## CI gates

Primeiro triagem, depois bloqueio.

Implemente gates graduais e proporcionais.

Achados antigos devem possuir tratamento explícito, não serem silenciosamente ignorados.

Toda exceção/risco aceito deve possuir:

- justificativa;
- owner;
- data de expiração;
- condição de revisão.

Nenhum risco aceito deve permanecer indefinidamente.

## Pentest

Defina escopo independente incluindo, no mínimo:

- autenticação;
- sessões;
- multi-tenancy;
- BOLA/IDOR;
- RBAC;
- GLOBAL_ADMIN;
- mass assignment;
- APIs;
- clientes relevantes.

Registre:

- escopo;
- metodologia;
- findings;
- severidades;
- correções;
- riscos aceitos;
- reteste.

Não considere finding corrigido sem reteste adequado quando aplicável.

## Commits sugeridos

1. `ci: establish security scanning baseline`
2. `ci: add secret scanning`
3. `ci: separate runtime and development dependency audit`
4. `ci: add sast`
5. `ci: add iac and container scanning`
6. `ci: generate release sbom`
7. `test: add traditional dast job`
8. `test: add logical multi-tenant dast harness`
9. Commits separados por lote de correções
10. `docs: record pentest scope findings and retest`

## Evidências obrigatórias

Prove:

- secret confirmado bloqueia conforme política;
- runtime e tooling possuem relatórios separados;
- findings existentes foram triados antes dos gates;
- SBOM é reproduzível por release;
- DAST utiliza staging isolado/dados sintéticos;
- DAST lógico cobre sessões A/B/GLOBAL_ADMIN/suporte;
- riscos aceitos têm justificativa, owner e validade;
- pentest ocorreu após estabilização das áreas críticas;
- reteste confirmou correções.

## Definition of Done

A etapa termina somente quando:

- cada ferramenta possui owner;
- cada ferramenta possui baseline;
- cada ferramenta possui política de exceção;
- gates de CI são graduais e proporcionais;
- nenhum risco aceito fica sem expiração;
- SBOM acompanha releases;
- DAST tradicional gera evidência;
- DAST lógico gera evidência;
- pentest está registrado;
- reteste está registrado;
- evidências cobrem GOV-03, GOV-04 e SEC-19.

Ao final, entregue:

1. diagnóstico inicial do pipeline;
2. ferramentas adicionadas e justificativa;
3. configuração de cada scanner;
4. baseline;
5. política de severidades/SLA;
6. política de exceções;
7. resultados iniciais;
8. findings triados;
9. gates ativados;
10. SBOM;
11. resultados DAST tradicional;
12. resultados DAST lógico;
13. situação do pentest/reteste;
14. riscos residuais;
15. confirmação item a item do Definition of Done.

Após esta etapa, documente o ciclo operacional recorrente:

detectar → triar → corrigir → testar → evidenciar → revisar.

Também estabeleça revisão quando mudarem finalidade, público, fornecedor, arquitetura, classificação dos dados ou perfil de risco.
