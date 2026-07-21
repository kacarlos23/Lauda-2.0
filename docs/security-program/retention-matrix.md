# Matriz de Retencao v1

Versao: 1.0
Data: 2026-07-16
Status: matriz tecnica inicial; prazos juridicos e operacionais pendentes
Aprovadores: Data Owners TBD; Juridico/Privacidade TBD; Engenharia TBD
Proxima revisao: 2026-08-16 ou antes de producao com dados reais

Prazos `TBD` nao autorizam retencao indefinida. Enquanto Data Owners e juridico nao aprovarem prazos, o criterio tecnico e reter o minimo necessario, evitar dados reais em producao publica e bloquear novas coletas sem atualizacao do Data Map/ROPA.

| Categoria/finalidade | Dados | Retencao tecnica atual | Retencao proposta a validar | Eliminacao/anonimizacao | Owner | Estado |
|---|---|---|---|---|---|---|
| Conta ativa | Nome, e-mail, telefone, avatar, role, tenant | Durante conta ativa | TBD por contrato/uso do tenant | Exportacao, anonim/purge por solicitacao e encerramento TBD | Produto/Operacao/Juridico TBD | Pendente |
| Credencial de senha | Hash bcrypt | Durante conta ativa | Ate troca/exclusao da conta | Substituir hash na troca; remover/anonimizar no purge | Seguranca TBD | Parcial |
| Reset de senha | HMAC, challenge, pepper version, tentativas, expiracao | Validade 15 min; consumo limpa HMAC/challenge, mas campo `resetPasswordConsumedAt` permanece | Expirar e limpar desafios consumidos/expirados em job | Job de limpeza pendente; nao logar PIN | Seguranca/Engenharia TBD | Parcial |
| Access token | JWT no cliente | 15 min por default | 15 min ou menos conforme risco | Expiracao criptografica; logout remove do cliente | Seguranca TBD | Atual |
| Sessao e refresh token | JWT no cliente; HMAC/JTI/familia/metadados no PostgreSQL | Refresh/sessao 7 dias renovavel; revogados conservados | Expiracao + 30 dias para investigacao, sujeito a aprovacao | Rotacao/reuse e revogacao implementados; job de purge pendente | Seguranca/Produto TBD | Parcial |
| Convites de membro | Codigo, tenant, ministerio, status, expiracao | `expiresAt` opcional; regeneracao desativa convites ativos | Expiracao obrigatoria e quota a validar | Revogar/desativar; purge historico TBD | Operacao do tenant/Produto TBD | Insuficiente |
| Perfil/avatar | Nome, telefone, avatar data URL/URL, instrumentos | Sem prazo especifico | Enquanto conta ativa; avatar removivel | Remocao manual; purge em encerramento; tamanho maximo | Produto/Operacao TBD | Pendente |
| Vinculos religiosos/ministeriais | Tenant, ministerio, lideranca, skills, notas, status | Enquanto ativo; deletes mistos | TBD apos classificacao juridica | Minimizar notas; anonim/purge por encerramento ou direito aplicavel | Data Owner do tenant/Juridico TBD | Pendente |
| Escalas e atribuicoes | Escala, membro, funcao, status, recusa/substituicao | Soft delete parcial em cancelamento; sem prazo | TBD por necessidade operacional/historico | Anonimizar nomes/usuario ou purge apos prazo | Operacao do tenant/Juridico TBD | Pendente |
| Motivo de recusa e notas de substituicao | Texto livre ate 500 chars | Sem prazo especifico | Curto prazo, minimizacao forte | Purgar/anonimizar antes dos dados base da escala | Operacao/Juridico TBD | Alto risco pendente |
| Catalogo musical | Artistas, musicas, links, cifras, compositor, criador/editor | Enquanto tenant usa; soft delete de musicas | TBD por contrato/uso | Remover relacao a criador/editor quando necessario; purge conteudo | Produto TBD | Pendente |
| PDFs exportados | Cifras, nomes de membros, funcoes, status | Backend em memoria; cliente grava cache/Blob local | Nao persistir no backend; orientar limpeza local | Usuario controla arquivo; app pode limpar cache futuramente | Produto/Engenharia TBD | Parcial |
| Auditoria administrativa | Ator, role, evento tipado, recurso, tenant, request ID, metadados allowlisted | Sem prazo aprovado; registros historicos anteriores a 2026-07-20 podem conter PII | 365 dias propostos; legal hold quando aprovado | Expiracao automatica e saneamento do historico pendentes | Seguranca/Juridico TBD | Codigo parcial; operacao pendente |
| Logs de acesso | Metodo, rota parametrizada, status, duracao, outcome, request ID | stdout estruturado; provider prod TBD | 30 dias propostos | Expiracao automatica no provider | Engenharia/Infra TBD | Codigo implementado; operacao pendente |
| Logs de seguranca | Evento, outcome, IDs tecnicos allowlisted, request ID | stdout estruturado; provider prod TBD | 180 dias propostos | Expiracao; preservar sob incidente/legal hold aprovado | Seguranca/Infra TBD | Codigo implementado; operacao pendente |
| Logs de observabilidade | Componente, erro tipado sem mensagem bruta, status, duracao, request ID | stdout estruturado; provider prod TBD | 30 dias propostos | Expiracao automatica no provider | Engenharia/Infra TBD | Codigo implementado; operacao pendente |
| Rate limiting | HMAC de IP/identificador, contadores | TTL da janela em memoria/Redis | TTL por janela; sem persistencia duravel | Expira automaticamente; Redis persistence off/TBD | Seguranca/Infra TBD | Parcial |
| CI/CD logs/artifacts | Logs de build/teste, possiveis erros | Retencao padrao GitHub TBD | Minima necessaria | Nao anexar dados reais; artifact retention definida | Engenharia/Seguranca TBD | Pendente |
| Backups | Todos os dados persistidos | Drill local AES-256-GCM e restore completo; producao nao configurada | RPO 24 h/RTO 60 min usados apenas como alvos locais provisorios | Expiracao produtiva e reaplicacao de delecoes pendentes | Infra/Data Owners TBD | Local comprovado; producao bloqueante |
| Tenant encerrado | Todos os dados do tenant | Nao definido | Exportacao e periodo de carencia TBD | Purge/anonimizacao tenant-wide; legal hold quando aplicavel | Operacao/Juridico TBD | Bloqueante |

## Jobs e mecanismos pendentes

| ID | Decisao/acao necessaria | Papel responsavel por decidir/executar | Bloqueio provocado | Etapa limite |
|---|---|---|---|---|
| RET-01 | Aprovar e implementar job para limpar desafios de reset expirados/consumidos. | Engenharia/Seguranca; owners TBD. | Dados transitorios permanecem alem da necessidade; bloqueia reset produtivo aprovado. | Etapa 1/4, antes de producao. |
| RET-02 | Aprovar e implementar purge/anonimizacao de contas e tenants encerrados. | Juridico/Data Owners/Engenharia; nomes TBD. | Lifecycle e direitos nao sao executaveis; bloqueia dados reais. | Etapa 0 para politica; Etapa 4 para implementacao, antes de dados reais. |
| RET-03 | Definir retencao e redaction de `AdminAuditLog.payload`. | Seguranca/Juridico/Engenharia; nomes TBD. | Auditoria pode reter PII sem limite/redaction; bloqueia uso operacional de `GLOBAL_ADMIN`. | Etapa 0/5, antes de uso operacional de `GLOBAL_ADMIN`. |
| RET-04 | Definir e implementar backup criptografado com expiracao e teste de restore. | Infra/Seguranca; nomes TBD. | Recuperacao e delecao verificavel inexistem; bloqueia producao. | Etapa 0 para decisao; Etapa 5 para implementacao/teste, antes de producao. |
| RET-05 | Definir retencao de logs de app, CI e provider. | Infra/Engenharia/Seguranca; nomes TBD. | Logs podem reter PII/segredos indefinidamente; bloqueia observabilidade produtiva. | Etapa 5/6, antes de observabilidade produtiva. |
