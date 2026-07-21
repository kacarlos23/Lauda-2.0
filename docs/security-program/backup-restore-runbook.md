# Runbook de backup e restore v1

Data: 2026-07-20  
Status: automacao e restore local comprovados; politica/infra produtiva pendente

## Alvos

Para o drill local foram usados RPO de 24 horas e RTO de 60 minutos. Sao alvos **provisorios**, nao aprovados por Negocio, Infra, Security ou Data Owners.

## Automacao local

Execute `npm run resilience:restore-drill`. O script:

1. cria dump PostgreSQL custom completo;
2. copia-o para diretorio local ignorado pelo Git;
3. cifra com AES-256-GCM;
4. remove imediatamente o dump em claro;
5. decifra apenas para restaurar em banco temporario com nome validado;
6. compara contagem e hash de conteudo de cada tabela dentro do PostgreSQL;
7. mede idade do ponto e tempo de restore;
8. remove dump claro, chave efemera e banco temporario;
9. grava somente hashes e metricas em `docs/security-program/evidence`.

Para reter um artefato cifrado recuperavel, o operador deve fornecer `BACKUP_DRILL_KEY_B64` com 32 bytes e guardar essa chave em KMS separado. Sem essa variavel, a chave e somente em memoria e o artefato cifrado e apagado ao final.

## Resultado de 2026-07-20

- Dump: 1.879.825 bytes.
- Criptografia: AES-256-GCM.
- Restore completo: concluido em banco isolado.
- Hash logico origem/restore: identico.
- RTO medido: 25,654 segundos.
- Idade do ponto recuperado ao final: 25,664 segundos.
- Alvos locais provisorios: atendidos.
- Reaplicacao de eliminacoes: **nao executada**, pois a Etapa 4 ainda nao implementou ledger de eliminacoes.

## Producao ainda exige

- backups automatizados em conta/projeto e credencial separados;
- criptografia com KMS gerenciado e rotacao comprovada;
- storage privado, versionado e imutavel/WORM conforme risco;
- retencao/expiracao aprovada e monitorada;
- replica/regiao e data residency aprovadas;
- restore trimestral em ambiente seguro;
- ledger externo ao backup e replay idempotente de eliminacoes;
- alerta de falha, owners nominais e evidencia do provider.

Nenhuma dessas propriedades produtivas e inferida do drill local.
