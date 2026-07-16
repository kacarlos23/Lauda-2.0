# Modelo de Data Owner e System Owner v1

Versao: 1.0
Data: 2026-07-16
Status: modelo tecnico; nomeacao nominal pendente
Aprovadores: Direcao/Operacao TBD; Engenharia TBD; Juridico/Privacidade TBD
Proxima revisao: 2026-08-16

## Definicoes

| Papel | Decide | Executa | Nao substitui |
|---|---|---|---|
| Data Owner | Finalidade, necessidade, acesso, compartilhamento, classificacao operacional, retencao proposta e aceite de risco do dado | Aprova ROPA/Data Map do dominio, recertifica acessos e prioriza remediacoes | Juridico/encarregado; System Owner |
| System Owner | Arquitetura, implementacao, controles tecnicos, operacao, testes, observabilidade e disponibilidade do sistema | Implementa controles, fornece evidencias, monitora e corrige | Data Owner; juridico; aprovador de negocio |
| Security Owner | Politica de acesso, ameacas, controles, incidentes, excecoes e recertificacao privilegiada | Mantem threat model, access review e resposta tecnica | Data Owner juridico/operacional |
| Encarregado/DPO | Governanca de privacidade e canal com titulares/autoridade quando aplicavel | Orienta, monitora e escala temas de privacidade | Controlador/operador; Data Owner; System Owner |

## Matriz inicial de ownership

| Dominio | Dados/operacoes | Data Owner | System Owner | Security Owner | Status |
|---|---|---|---|---|---|
| Identidade e autenticacao | Conta, senha, reset, tokens, sessoes | Seguranca/Produto TBD | Engenharia TBD | Seguranca TBD | Pendente |
| Tenant/igreja | Tenant, dominio, status, instrumentos padrao | Operacao/Produto TBD | Engenharia TBD | Seguranca TBD | Pendente |
| Membros/perfil | Dados cadastrais, avatar, instrumentos/cargos | Operacao do tenant/Produto TBD | Engenharia TBD | Seguranca TBD | Pendente |
| Ministerios/lideranca | Ministerio, membros, lideranca, skills, notas | Operacao do tenant TBD | Engenharia TBD | Seguranca TBD | Pendente |
| Escalas/substituicoes | Escalas, atribuicoes, recusas, substituicoes, PDFs | Operacao do tenant TBD | Engenharia TBD | Seguranca TBD | Pendente |
| Catalogo musical | Musicas, artistas, links, Cifra Club, PDFs | Produto TBD | Engenharia TBD | Seguranca TBD | Pendente |
| RBAC/admin global | Roles, permissoes, overrides, audit logs, suporte | Seguranca/Operacao TBD | Engenharia TBD | Seguranca TBD | Pendente |
| Infra/runtime | Banco, Redis, SMTP, Cloudflare, logs, backups | Infra/Operacao TBD | Infra/Engenharia TBD | Seguranca TBD | Pendente |
| Mobile/web cliente | Sessao local, PDFs locais, avatar local, API URL | Produto/Mobile TBD | Engenharia Mobile TBD | Seguranca TBD | Pendente |
| CI/CD/supply chain | Workflows, dependencias, artefatos, secrets | Engenharia/Security TBD | Engenharia TBD | Seguranca TBD | Pendente |

## Workflow de aprovacao

1. System Owner abre mudanca com impacto em dados, acesso, fornecedor, logs, exportacao ou retencao.
2. Data Owner valida finalidade, minimizacao, titulares, acesso e retencao.
3. Juridico/Privacidade valida base, papel controlador/operador, avisos, direitos e contratos quando necessario.
4. Security Owner valida threat model, access review, logging, incident response e testes.
5. Evidencias sao anexadas em `docs/security-program/evidence/README.md` ou sistema equivalente.

## Registro minimo por owner

| Campo | Obrigatorio |
|---|---|
| Nome ou grupo | Sim |
| Escopo de dados | Sim |
| Escopo de sistema | Sim |
| Aprovador substituto | Sim para dados de producao |
| Frequencia de revisao | Minimo trimestral para acesso privilegiado; semestral para Data Map/ROPA |
| Criterio de escalonamento | Incidente, novo fornecedor, novo dado sensivel, mudanca de publico, novo tenant real |

## Pendencias

| ID | Decisao necessaria | Papel responsavel por decidir | Bloqueio provocado | Etapa limite |
|---|---|---|---|---|
| OWN-01 | Nomear Data Owners por dominio e, quando aplicavel, por tenant/cliente. | Direcao/Operacao; nomes/grupos TBD. | Finalidades, acessos, retencoes e riscos nao podem ser aprovados; bloqueia dados reais. | Etapa 0, antes de producao com dados reais. |
| OWN-02 | Nomear System Owners de backend, mobile/web e infra. | Engenharia/Infra; nomes/grupos TBD. | Implementacao, operacao e evidencias ficam sem accountable nominal; bloqueia producao. | Etapa 0, antes de producao. |
| OWN-03 | Nomear Security Owner e substituto para incidentes/access review. | Direcao/Seguranca; nomes TBD. | Incidentes e acessos privilegiados ficam sem aprovador; bloqueia painel global com dados reais. | Etapa 0, antes de acesso privilegiado produtivo. |
| OWN-04 | Definir aprovadores e substitutos para mudancas emergenciais. | Direcao/Operacao/Juridico; nomes TBD. | Mudancas emergenciais e suporte ficam sem segregacao/aprovacao; bloqueia suporte produtivo. | Etapa 0, antes de suporte produtivo. |
