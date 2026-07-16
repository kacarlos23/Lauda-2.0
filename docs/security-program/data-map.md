# Data Map v1

Versao: 1.0
Data: 2026-07-16
Status: baseline tecnico; validacao juridica, operacional e de owners pendente
Aprovadores: Engenharia TBD; Juridico/Privacidade TBD; Operacao/Produto TBD
Proxima revisao: 2026-08-16 ou antes de producao com dados reais

Este mapa foi produzido a partir de inspecao do schema Prisma, rotas Express, servicos, repositories, scripts, cliente Expo/React Native, CI e configuracoes presentes no repositorio. Ele nao define base legal nem aprova retencao; campos `TBD` bloqueiam producao com dados reais quando indicados.

## Evidencias inspecionadas

- Prisma: `prisma/schema.prisma`.
- API e auth: `src/app.ts`, `src/routes/*`, `src/services/*`, `src/repositories/*`, `src/middlewares/*`, `src/config/*`.
- Mobile/web: `mobile/src/services/api.ts`, `mobile/src/services/sessionStorage.ts`, `mobile/src/store/authStore.ts`, `mobile/app/(tabs)/profile.tsx`.
- Scripts/admin: `scripts/promote-global-admin.ts`, `scripts/debug-admin-tenants.ts`, `scripts/start-project.ps1`, `scripts/setup-cloudflare-tunnel.ps1`.
- Infra/CI: `docker-compose.yml`, `.github/workflows/backend.yml`, `.github/workflows/mobile.yml`, `cloudflare/laudaapp-tunnel.example.yml`, `.env.example`.
- Documentacao anterior: `docs/security-program/*`.

## Inventario de entidades Prisma

| Entidade | Dados principais | Operacoes relacionadas | Classificacao inicial | Observacao |
|---|---|---|---|---|
| `Tenant` | Igreja/tenant, dominio, status, timestamps | Cadastro de igreja, administracao global, visao do tenant | Organizacional; pode revelar contexto religioso | `domain` unico; soft delete por `deletedAt`. |
| `User` | Nome, e-mail, telefone, avatar, senha hash, role, tenant, status, reset de senha | Auth, membros, admins, reset, perfil | Pessoal; credencial; possivel dado sensivel por associacao religiosa | `email` unico global; avatar pode conter imagem pessoal em URL/data URL. |
| `MemberInvite` | Codigo, tenant, ministerio opcional, status, expiracao | Convite e cadastro publico de membro | Pessoal indireto/seguranca | Link compartilhavel; expiracao opcional hoje. |
| `Ministry` | Nome, descricao, tenant, status | Organizacao ministerial | Organizacional; possivel contexto religioso | Nome/descricao podem revelar atividade religiosa. |
| `MinistryMember` | Usuario, ministerio, funcao, skills, notas, status, lideranca | Viculo ministerial, lideranca, permissao operacional | Pessoal; possivel dado sensivel por contexto religioso | `notes` e `skills` exigem minimizacao. |
| `Instrument` | Nome/cargo, cor, tenant | Catalogo de instrumentos/cargos | Organizacional; pode indicar perfil/atividade | Criado por tenant/admin. |
| `UserInstrument` | Usuario, instrumento/cargo, tenant | Perfil e escala | Pessoal; possivel perfil de habilidade | Pode influenciar alocacao em escalas. |
| `Schedule` | Titulo, data, tenant, ministerio | Escalas/eventos | Organizacional; possivel contexto religioso | Pode revelar participacao em cultos/eventos. |
| `ScheduleAssignment` | Usuario, escala, funcao, status, motivo de recusa, substituicao | Convocacao, aceite/recusa, substitutos | Pessoal; possivel dado sensivel por contexto religioso | `declineReason` e notas de substituicao exigem minimizacao. |
| `ScheduleSong` | Escala, musica, ordem | Repertorio da escala | Organizacional | Relaciona evento a repertorio. |
| `Artist` | Nome, imagem, tenant | Catalogo musical | Catalogo | Normalizacao por tenant. |
| `Song` | Titulo, compositor, tom, cifra, links, criador/editor, tenant | Catalogo, importacao, exportacao PDF | Conteudo; autoria interna pode ser pessoal | `createdById`/`updatedById` ligam usuarios a edicoes. |
| `MinistrySong` | Musica, ministerio, tenant | Repertorio por ministerio | Organizacional | Relacao por tenant. |
| `Permission` | Chave, descricao, categoria, delegavel | RBAC granular | Seguranca | Catalogo global. |
| `UserPermission` | Usuario, permissao, tenant, concedente, efeito | Overrides ALLOW/DENY | Seguranca/pessoal administrativo | Usa `basePrisma`; exige controles de tenant e auditoria. |
| `AdminAuditLog` | Ator, role, acao, recurso, payload, tenant | Auditoria de admin global/permissoes | Seguranca; pode conter PII em payload | Sanitiza senha, mas outros campos pessoais podem permanecer. |

## Data Map por operacao e finalidade

| Operacao/finalidade | Dados tratados | Titular | Classificacao | Origem | Armazenamento | Acesso atual | Compartilhamento/fornecedor | Regiao | Retencao/eliminacao | Data Owner | System Owner | Controles/evidencias |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cadastro de tenant e primeiro administrador para criar igreja no SaaS | Nome da igreja, nome/e-mail/senha do admin, instrumentos padrao | Admin inicial; tenant | Pessoal; credencial; possivel contexto religioso | `POST /api/auth/register`; mobile/web auth | `Tenant`, `User`, `Instrument` em PostgreSQL | Usuario criado; `TENANT_ADMIN`; backend | PostgreSQL/hosting TBD; backups TBD | TBD | Conta/tenant soft delete; purge TBD | Produto/Operacao TBD | Engenharia TBD | `AuthService.register`, `AuthRepository.createTenantWithAdmin`, bcrypt. |
| Cadastro publico por convite para ingresso de membro | Codigo de convite, nome, e-mail, telefone opcional, senha, ministerio opcional | Membro/potencial membro | Pessoal; credencial; possivel contexto religioso | `POST /api/auth/member-register`; link de convite | `User`, `MemberInvite`, `MinistryMember` | Membro; admins/lideres conforme API | PostgreSQL; link pode ser compartilhado fora do sistema | TBD | Convite pode nao expirar; conta soft delete; purge TBD | Operacao do tenant TBD | Engenharia TBD | Rate limit; validacao de convite ativo; codigo unico. |
| Autenticacao e sessao | E-mail, senha, access token, refresh token, role, tenant, permissoes | Usuario | Credencial/seguranca | Login, refresh, `/auth/me` | Tokens no cliente; dados de usuario no PostgreSQL; tokens nao persistidos no servidor | Usuario; backend | SecureStore nativo; `localStorage` web | Dispositivo do usuario; backend TBD | Access 15m; refresh 7d; revogacao servidor pendente | Seguranca TBD | Engenharia TBD | `authMiddleware`, `authService`, `sessionStorage.ts`; testes de auth. |
| Reset de senha por PIN | E-mail, PIN transitorio, HMAC do PIN, challenge, pepper version, tentativas, expiracao | Usuario | Credencial/seguranca | `forgot-password`, `reset-password` | Campos de reset em `User`; PIN enviado via SMTP quando habilitado | Backend; usuario por e-mail | SMTP TBD | TBD | PIN 15min; limpeza periodica de desafios consumidos/expirados pendente | Seguranca TBD | Engenharia TBD | HMAC/pepper, tentativas, rate limit, entrega sem log de PIN. |
| Perfil do usuario e avatar | Nome, telefone, e-mail, avatar URL ou data URL, instrumentos | Usuario/membro | Pessoal; imagem pode ser biometrica apenas se usada para identificacao TBD | Mobile perfil; ImagePicker; APIs `/members/me/*` | `User`, `UserInstrument`; cache cliente | Proprio usuario; admins autorizados | Expo ImagePicker local; PostgreSQL | Dispositivo; backend TBD | Avatar sem prazo; remocao manual; purge TBD | Produto/Operacao TBD | Engenharia TBD | Validacao de tamanho/tipo; SecureStore/localStorage para sessao. |
| Gestao de membros | Nome, e-mail, telefone, role, status, tenant, instrumentos, ministerios | Membros | Pessoal; possivel dado sensivel por associacao religiosa | APIs `/members`; painel tenant/global | `User`, `MinistryMember`, `UserInstrument`, `UserPermission` | `TENANT_ADMIN`, permissoes `member:*`, self em alguns fluxos, `GLOBAL_ADMIN` | PostgreSQL/hosting TBD; backups TBD | TBD | Inativacao por `isActive=false`/`deletedAt`; anonim/purge TBD | Operacao do tenant TBD | Engenharia TBD | Tenant filters em repositories; requirePermission; testes de members/admin. |
| Gestao de ministerios e vinculos | Ministerio, descricao, membros, papel, skills, notas, status, lideranca | Membros; tenant | Pessoal; possivel dado sensivel religioso | APIs `/ministries`; mobile ministries | `Ministry`, `MinistryMember` | Admins, lideres do ministerio, membros em visoes proprias | PostgreSQL | TBD | Delete fisico em alguns fluxos; soft delete parcial; politica TBD | Operacao do tenant TBD | Engenharia TBD | Tenant scope; lider so gerencia ministerios que lidera; lacuna de minimizacao de notas. |
| Gestao de instrumentos/cargos | Nome/cor de instrumento/cargo; relacao usuario-instrumento | Membro; tenant | Pessoal quando associado a usuario | APIs `/instruments`, perfil | `Instrument`, `UserInstrument` | Membros para visualizar/selecionar; admins para catalogo | PostgreSQL | TBD | Remocao/substituicao sem politica formal | Operacao do tenant TBD | Engenharia TBD | Validacao de cor/nome; tenant scope. |
| Gestao de escalas e atribuicoes | Titulo, data, ministerio, membros escalados, funcoes, status, motivo de recusa, pedido/resolucao de substituto | Membros escalados; tenant | Pessoal; possivel sensivel por participacao religiosa; notas livres | APIs `/schedules`; mobile schedules | `Schedule`, `ScheduleAssignment`, `ScheduleSong` | Membro ve as proprias; admins/lideres veem/gerenciam conforme permissao | PostgreSQL; PDF export local | TBD | Cancelamento faz soft delete parcial; prazos TBD | Operacao do tenant TBD | Engenharia TBD | Tenant scope, `schedule:*`, lideranca; PDF em memoria/cache. |
| Catalogo de musicas/artistas e importacao Cifra Club | Artista, imagem, titulo, compositor, cifra, tom, BPM, URLs, criador/editor | Usuarios criadores/editores; tenant; conteudo publico | Conteudo; metadado pessoal por autoria; URLs externas | APIs `/artists`, `/songs`, Cifra Club | `Artist`, `Song`, `MinistrySong`, `ScheduleSong` | Usuarios com `song:*`; `GLOBAL_ADMIN` | Cifra Club; PostgreSQL; PDF export local | Cifra Club Brasil/TBD; hosting TBD | Sem prazo formal; soft delete de `Song`; purge TBD | Produto TBD | Engenharia TBD | Validacao URL, Playwright headless, user-agent; busca externa sem PII necessaria. |
| Exportacao de PDF de cifras e escalas | Conteudo de musicas; nomes de membros; funcoes; status; e-mail em relatorio backend | Usuarios/membros | Pessoal quando inclui escala; conteudo | API `/songs/export`, `/schedules/:id/report`; mobile/web export | Backend gera Buffer; mobile grava cache/Blob para compartilhar | Usuario autorizado que solicitou | Expo FileSystem/Sharing no dispositivo; navegador Blob | Dispositivo do usuario | Arquivo/cache sob controle do dispositivo; politica de limpeza TBD | Operacao do tenant TBD | Engenharia TBD | PDFKit; `expo-file-system`; `expo-sharing`; sem persistencia backend observada. |
| Administracao global e suporte | Todos os tenants, usuarios, roles, recursos, auditoria, permissao granular | Todos os usuarios/tenants | Alto risco; PII; seguranca; possivel sensivel religioso | `/api/admin/*`; painel global; scripts | PostgreSQL via `basePrisma`; `AdminAuditLog` | `GLOBAL_ADMIN` | PostgreSQL/hosting; GitHub/local scripts | TBD | Auditoria e dados admin sem prazo aprovado | Seguranca/Operacao TBD | Engenharia TBD | `requireRole(GLOBAL_ADMIN)`, auditoria parcial, script de promocao; access review obrigatorio. |
| Rate limiting e abuso | IP, e-mail/identificador/token/convite em HMAC, contadores, timestamps de janela | Solicitante/usuario | Pseudonimizado; seguranca | Middleware de auth/register/invite/reset | Memoria local ou Redis | Backend/infra | Redis em producao TBD | TBD | TTL da janela | Seguranca/Infra TBD | Engenharia/Infra TBD | HMAC SHA-256, Redis obrigatorio em prod, failure mode configuravel. |
| Logs, erros e auditoria tecnica | Erros nao tratados, mensagens, possiveis payloads em console/logs; audit payload admin | Usuarios/tenants afetados | Pessoal/seguranca se payload contiver PII ou segredo | `errorHandler`, logs locais, `AdminAuditLog` | Arquivos `.log` locais; stdout; PostgreSQL | Engenharia/infra; `GLOBAL_ADMIN` para audit logs | Hosting/log provider TBD; GitHub CI logs | TBD | Prazo TBD; redaction incompleta | Seguranca TBD | Engenharia/Infra TBD | `errorHandler` mascara 500 em producao; `console.error` e audit payload exigem redaction. |
| CI/CD e testes | Codigo, dependencias, envs de teste, resultados de testes | Desenvolvedores; dados sinteticos | Seguranca operacional | GitHub Actions backend/mobile | GitHub Actions logs/artifacts; npm cache | Mantenedores repo | GitHub; npm registry; Playwright browser install | GitHub/npm regioes TBD | Politica de logs/artifacts TBD | Engenharia/Seguranca TBD | Engenharia TBD | Workflows sem secrets de prod aparentes; permissoes do repo/GitHub TBD. |
| Cloudflare Tunnel/local public exposure | Trafego HTTP frontend/API, metadados, credenciais tunnel fora do repo | Usuarios e admins se usado | Pessoal em transito; segredo operacional | Script e config exemplo | Credenciais em `%USERPROFILE%\.cloudflared`; trafego no Cloudflare se ativo | Operador da maquina/Cloudflare | Cloudflare | TBD | Logs/retencao Cloudflare TBD | Infra/Seguranca TBD | Engenharia/Infra TBD | Config exemplo sem credenciais; uso produtivo nao confirmado. |
| Backups e restore | Todos os dados persistidos | Todos os titulares | Conforme dados originais | Configuracao de banco/hosting futura | Nao ha configuracao de backup no repo | Infra/DBA TBD | Hosting/backup TBD | TBD | RPO/RTO, criptografia, expiracao e purge TBD | Infra/Data Owners TBD | Infra TBD | Ausencia de evidencia; bloqueio para producao. |

## Classificacao transversal

| Categoria | Exemplos | Classificacao inicial | Decisao pendente |
|---|---|---|---|
| Identificacao e contato | Nome, e-mail, telefone, avatar | Dado pessoal | Confirmar minimizacao, exibicao e retencao. |
| Credenciais e tokens | Senha hash, JWT, refresh token, PIN/HMAC reset, peppers/secrets | Seguranca/credencial | Definir sessao revogavel, rotacao e alertas. |
| Contexto religioso | Tenant igreja, ministerios, escalas, lideranca, instrumentos/cargos, convites | Possivel dado pessoal sensivel por associacao religiosa; classificacao juridica TBD | Juridico/Data Owners devem validar enquadramento, bases e RIPD. |
| Conteudo operacional | Cifras, repertorio, artistas, escalas | Organizacional; pode revelar pratica religiosa | Produto/Juridico validar publicacao/exportacao. |
| Auditoria e logs | AdminAuditLog, logs de erro, CI logs | Seguranca; pode conter PII/segredos | Redaction, retention e acesso precisam ser aprovados. |
| Fornecedores e subprocessadores | PostgreSQL/hosting, Redis, SMTP, GitHub, Cloudflare, Expo, Cifra Club | Compartilhamento/operacao | Vendor review e regioes pendentes. |

## Gate de mudanca

Antes de adicionar campo, log, evento, exportacao, fornecedor, job ou script administrativo, atualizar este Data Map e a ROPA com finalidade, titular, classificacao, origem, base a validar, armazenamento, acesso, compartilhamento, fornecedor, regiao, retencao, eliminacao, Data Owner, System Owner, controles e evidencias.
