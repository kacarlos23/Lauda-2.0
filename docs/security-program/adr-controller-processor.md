# ADR-PRIV-001 - Controlador e operador por operacao

Versao: 1.0
Data: 2026-07-16
Status: decisao juridica/negocio pendente; matriz tecnica inicial
Aprovadores: Juridico/Privacidade TBD; Negocio TBD; Data Owners TBD
Proxima revisao: 2026-08-16 ou antes de contratos/clientes reais

## Contexto

O Lauda 2.0 e uma aplicacao SaaS multi-tenant para igrejas. O mesmo sistema pode tratar dados em nome do tenant e tambem tomar decisoes proprias sobre seguranca, administracao da plataforma, fornecedores, logs e suporte. Por isso, a definicao de controlador/operador deve ser feita por operacao, nao por sistema inteiro.

Este ADR nao decide juridicamente os papeis; ele registra hipoteses e pendencias para aprovacao.

## Matriz inicial

| Operacao | Papel provavel a validar | Racional tecnico | Decisao pendente |
|---|---|---|---|
| Cadastro de tenant e conta admin | Lauda como controlador conjunto/independente ou operador do tenant fundador TBD | Lauda define produto, auth e plataforma; tenant decide uso institucional | Contrato, termos e onboarding. |
| Cadastro de membros por convite | Tenant controlador e Lauda operador TBD | Tenant convida e decide membros/ministerios; Lauda processa no SaaS | Contrato tenant, avisos e instrucao documentada. |
| Perfil, ministerios, escalas e instrumentos | Tenant controlador e Lauda operador TBD | Tenant define finalidade operacional; Lauda hospeda/processa | Data Owner por tenant e acordo de tratamento. |
| Catalogo musical | Tenant controlador para repertorio interno; Lauda papel TBD para importacao externa | Tenant cria conteudo; Lauda fornece integracao Cifra Club | Termos de uso e propriedade/licenca de conteudo. |
| Autenticacao, seguranca, rate limiting, logs tecnicos | Lauda controlador para seguranca da plataforma ou operador com finalidade propria TBD | Lauda define meios essenciais de seguranca | Aviso de privacidade e base juridica. |
| Admin global/suporte | Lauda controlador para administracao/suporte ou operador sob instrucao TBD | Acesso atravessa tenants e e controlado pela plataforma | Politica de suporte, break-glass, auditoria, contrato. |
| Incidentes | Depende da operacao afetada | Pode exigir notificacao ao controlador se Lauda for operador | Playbook e matriz de comunicacao. |
| Fornecedores de infra | Lauda contrata como operador/suboperador ou controlador de plataforma TBD | Lauda escolhe hosting, Redis, SMTP, Cloudflare | DPA, subprocessadores, regioes. |

## Decisao provisoria

Enquanto juridico/negocio nao aprovarem a matriz:

1. documentos devem usar "papel a validar" por operacao;
2. comunicacoes de incidente devem identificar rapidamente se o tenant precisa ser notificado como controlador;
3. novos fornecedores nao podem ser ativados em producao sem registrar papel e subprocessadores;
4. nenhum documento deve afirmar que Lauda e apenas controlador ou apenas operador para todo o sistema.

## Separacao do encarregado

A definicao de encarregado/DPO nao altera automaticamente o papel controlador/operador. A governanca do encarregado esta em `dpo-governance.md` e deve ser aprovada separadamente.

## Pendencias

| ID | Decisao/acao necessaria | Papel responsavel por decidir/executar | Bloqueio provocado | Etapa limite |
|---|---|---|---|---|
| CP-01 | Aprovar matriz controlador/operador por operacao. | Juridico/Negocio; nomes TBD. | Contratos e responsabilidades ficam indefinidos; bloqueia tenant real. | Etapa 0, antes de contrato/tenant real. |
| CP-02 | Definir se tenants recebem papel de controlador e quais instrucoes documentadas sao exigidas. | Juridico/Operacao; nomes TBD. | Onboarding e instrucoes de tratamento ficam incompletos; bloqueia onboarding real. | Etapa 0, antes de onboarding. |
| CP-03 | Definir subprocessadores e fluxo de notificacao de mudancas. | Juridico/Infra; nomes TBD. | Vendor governance e comunicacao contratual ficam indefinidas; bloqueia fornecedores produtivos. | Etapa 0, antes de ativar fornecedores produtivos. |
| CP-04 | Atualizar playbook de incidentes com comunicacao por papel. | Juridico/DPO/Security; nomes TBD. | Notificacao entre operador/controlador fica indefinida; bloqueia producao. | Etapa 0, antes de producao. |
