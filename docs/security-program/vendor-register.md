# Vendor Register v1

Versao: 1.0
Data: 2026-07-16
Status: inventario tecnico; due diligence, contratos, regioes e subprocessadores pendentes
Aprovadores: Engenharia TBD; Juridico/Privacidade TBD; Infra/Operacao TBD
Proxima revisao: 2026-08-16 ou antes de ativar qualquer fornecedor em producao

## Fornecedores e subprocessadores conhecidos ou potenciais

| Fornecedor/servico | Situacao no repositorio | Dados potenciais | Regiao/subprocessadores | Retencao/exclusao | Papel provavel a validar | Acao antes de producao |
|---|---|---|---|---|---|---|
| PostgreSQL/hosting | Armazenamento principal via Prisma; fornecedor produtivo nao informado | Todos os dados persistidos, incluindo PII, credenciais hash e contexto religioso | TBD | TBD; backups TBD | Operador/suboperador TBD | Definir fornecedor, regiao, TLS, criptografia, backup, restore, DPA/SLA de incidente. |
| Docker local `postgres:15` | Desenvolvimento local em `docker-compose.yml` | Dados locais de desenvolvimento | Maquina local | Volume local `postgres_data`; limpeza manual | Nao produtivo | Proibir dados reais em ambiente local sem politica. |
| Redis | Necessario para rate limit em producao quando `RATE_LIMIT_STORE=redis` | Chaves HMAC pseudonimizadas, contadores, TTL | TBD | TTL por janela; persistencia Redis TBD | Operador/suboperador TBD | Definir fornecedor/regiao, TLS, auth, rede privada, politica de persistencia e monitoramento. |
| SMTP | Necessario para reset em producao (`PASSWORD_RESET_DELIVERY_MODE=smtp`) | E-mail do usuario e PIN transitorio | TBD | Retencao do provedor TBD | Operador/suboperador TBD | Escolher provedor, validar TLS, logs, retencao, subprocessadores, template e abuso. |
| Expo/React Native ecosystem | App Expo com EAS Build e Expo Push preparados; ativacao externa ainda bloqueada | Token Expo pseudonimo, plataforma, versao do app e IDs tecnicos de notificacao; builds e credenciais FCM/APNs | Expo/cloud, regioes e subprocessadores TBD | Token desativado no logout/erro; recibos e retencao cloud TBD | Operador/suboperador a validar | Concluir vendor review/DPA, configurar access token, `projectId`, FCM v1 e APNs antes da ativacao externa. Push visivel deve permanecer generico. |
| Navegador web/localStorage | Cliente web gerado por Expo | Access/refresh token e dados de usuario/tenant no `localStorage` | Dispositivo/navegador | Ate logout/limpeza do navegador | Nao fornecedor unico | Decidir cookie HttpOnly/BFF ou aceitar risco com controles compensatorios. |
| Cloudflare Tunnel | Config exemplo e script de criacao DNS/tunnel presentes | Trafego HTTP da API/web e metadados; credenciais fora do repo | Cloudflare regioes/subprocessadores TBD | Logs/retencao TBD | Operador/suboperador TBD | Confirmar se uso e produtivo; contrato, Zero Trust, TLS, logs e ownership. |
| GitHub Actions | CI backend/mobile em pull request/push; sem secrets produtivos aparentes | Codigo, logs de build/teste, envs de teste | GitHub regioes/subprocessadores TBD | Retencao GitHub Actions TBD | Operador/suboperador TBD | Definir permissao minima, branch protection, secret scanning, artifact retention e owners. |
| npm registry / dependencias | `npm ci`, pacote backend/mobile; Playwright instala browsers | Metadados de build; sem PII de usuarios prevista | npm/GitHub/CDN TBD | Retencao externa TBD | Subprocessador tecnico TBD | SBOM, lockfile review, audit e politica de dependencias. |
| Cifra Club | Integracao ativa via Playwright para busca/importacao | Termos de busca musical, URL importada, conteudo publico; PII nao necessaria | Brasil/TBD | Externo ao Lauda | Terceiro independente ou fornecedor TBD | Validar termos de uso, user-agent, logs, minimizacao e bloqueio de PII em query. |
| Playwright/browser automation | Usado no backend para Cifra Club e em E2E mobile | URLs/HTML de paginas externas; logs de teste | Ambiente local/CI | Cache/logs TBD | Ferramenta tecnica | Confirmar que nao captura dados reais em traces/screenshots de CI. |
| Observabilidade/crash/analytics | Nao confirmado no codigo | Poderia receber PII, tokens, payloads, device IDs | TBD | TBD | Operador/suboperador TBD | Integracao proibida sem Data Map, redaction, vendor review e DPA. |
| Backup/restore provider | Nao configurado no repo | Todos os dados persistidos | TBD | RPO/RTO, expiracao e purge TBD | Operador/suboperador TBD | Definir criptografia, imutabilidade, segregacao, teste de restore e delecao. |

## Pendencias de vendor review

| ID | Decisao/acao necessaria | Papel responsavel por decidir/executar | Bloqueio provocado | Etapa limite |
|---|---|---|---|---|
| VR-01 | Definir fornecedor produtivo de banco, regiao, criptografia, backup e restore. | Infra/Seguranca/Juridico; nomes TBD. | Persistencia e recuperacao nao possuem garantia verificavel; bloqueia dados reais. | Etapa 0/5, antes de producao com dados reais. |
| VR-02 | Escolher SMTP e documentar subprocessadores/retencao. | Produto/Infra/Privacidade; nomes TBD. | Reset nao pode operar com entrega aprovada; bloqueia reset produtivo. | Etapa 0/1, antes de habilitar reset em producao. |
| VR-03 | Provisionar Redis produtivo com TLS, auth e rede privada. | Infra/Seguranca; nomes TBD. | Rate limiting distribuido nao fica operacional; bloqueia producao multi-instancia. | Etapa 1/5, antes de producao. |
| VR-04 | Confirmar uso produtivo de Cloudflare Tunnel ou substituir por hosting gerenciado. | Infra/Seguranca; nomes TBD. | Exposicao publica, logs e ownership ficam indefinidos; bloqueia dominio publico. | Etapa 0/5, antes de expor dominios publicos. |
| VR-05 | Decidir servicos cloud Expo/EAS e impacto em dados/builds. | Mobile/Produto/Privacidade; nomes TBD. | Build/distribuicao pode incluir fornecedor nao revisado; bloqueia servico cloud externo. | Etapa 0/6, antes de build/distribuicao externa via cloud. |
| VR-06 | Definir politica de logs/artifacts GitHub Actions e permissoes do repo. | Engenharia/Seguranca; nomes TBD. | CI pode reter informacao ou ter privilegio excessivo; bloqueia dados reais em CI/ambientes conectados. | Etapa 5/6, antes de conectar CI a ambientes com dados reais. |
