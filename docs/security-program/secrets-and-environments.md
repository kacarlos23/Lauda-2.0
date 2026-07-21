# Secrets, ambientes e rotacao v1

Data: 2026-07-20  
Status: gates de configuracao implementados; provisionamento produtivo nao comprovado

## Evidencia local

- `.env` esta ignorado e nao e rastreado pelo Git.
- Em 2026-07-20, varredura de 320 arquivos rastreados encontrou zero padroes de private key, AWS access key, GitHub token, Slack token ou Google API key.
- O workflow backend contem apenas credenciais deterministicas de teste. Nao ha workflow de deploy nem referencia verificavel a secrets produtivos.

## Gates de producao

`createConfig` recusa inicializar quando:

- `DEPLOYMENT_ENVIRONMENT` nao e `production`;
- `SECRETS_PROVIDER` e `local`;
- `SECRET_NAMESPACE` nao identifica namespace de producao isolado;
- `KMS_KEY_ID` esta ausente;
- secrets criptograficos sao ausentes, curtos ou reutilizados entre finalidades;
- PostgreSQL nao exige `sslmode=require`, `verify-ca` ou `verify-full`;
- Redis nao usa `rediss://`.

Esses gates comprovam fail-fast do aplicativo, nao comprovam que AWS Secrets Manager, GCP Secret Manager ou Azure Key Vault foi criado, que IAM e individual, nem que staging e producao usam valores diferentes.

## Runbook de rotacao

Cadencia proposta: 90 dias e imediatamente apos suspeita de comprometimento, mudanca de owner ou incidente no fornecedor.

1. Abrir ticket, identificar owner, ambiente, consumidores e rollback.
2. Criar nova versao no manager/KMS do ambiente correto; nao copiar valor de staging.
3. Para JWT/refresh, planejar revogacao de sessoes; para pepper/HMAC, manter versao anterior apenas durante janela documentada quando necessario.
4. Implantar nova referencia/version ID, observar erros e confirmar saude.
5. Revogar/desabilitar versao anterior, registrar horario, executor e evidencias do provider.
6. Testar que staging nao autentica/decifra com a chave de producao e vice-versa.
7. Encerrar o ticket com proxima data de rotacao.

## Pendencias bloqueantes

Provider, conta/projeto, regiao, namespace, KMS key, principals IAM, aprovador, segregacao staging/producao, logs de acesso e primeira rotacao real seguem **TBD**. Producao nao esta liberada por esta configuracao.
