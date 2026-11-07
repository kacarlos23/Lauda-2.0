# Publicador do Lauda

O publicador recebe pedidos pela pasta local `.lauda-publisher`, processa um por vez e grava o resultado por ID. Nao abre uma porta HTTP. O Windows executa a tarefa `Lauda-Publisher` pela conta que fez a instalacao, com token padrao, sem SYSTEM e sem elevacao. A instalacao concede aos usuarios locais CodexSandboxOffline e CodexSandboxOnline acesso apenas a fila; as restricoes de cada conversa continuam valendo.

## Instalacao unica

Abra **PowerShell como administrador**, usando sua propria conta habitual do Windows, e execute:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\092687\Documents\Dev\SaaS\Lauda 2.0\scripts\install-publisher.ps1"
```

O instalador copia o worker para `C:\ProgramData\Lauda\Publisher`, protege esses arquivos, cria a tarefa usando sua sessao interativa com token padrao e verifica um pedido de status. Nao pede nem armazena sua senha. Inicia no logon e funciona enquanto sua conta estiver conectada, inclusive com a tela bloqueada. Nao inicia antes do login nem continua apos sair da conta. Nao altera o tunnel, banco, supervisor ou release ativo. A instalacao deve terminar com o status dos dois ambientes.

### Reparar instalacao que ficou sem heartbeat

Se a tarefa foi registrada mas o publicador nao iniciou, execute em PowerShell administrador, na mesma conta da instalacao original:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\092687\Documents\Dev\SaaS\Lauda 2.0\scripts\install-publisher.ps1" -Repair
```

O reparo confirma conta, comando e diretorio de trabalho da tarefa existente; guarda o diagnostico e uma copia XML da configuracao anterior; recusa interromper uma publicacao em processamento ou um publicador ja saudavel. Recupera as permissoes somente da pasta instalada e dos cinco arquivos conhecidos antes de ler `config.json`, inclusive quando a tentativa anterior deixou esse arquivo com acesso negado. Confirma entao o projeto na configuracao, antes de substituir seu conteudo. Usa DACLs explicitas e separadas para pastas e arquivos: SYSTEM e Administradores com controle total; a conta do publicador com leitura e execucao. Os chats continuam tendo acesso somente a fila.

Atualiza somente a tarefa do publicador e seus arquivos, usando a sessao ja conectada em vez do logon S4U da primeira versao. O gateway, supervisor e APIs nao sao encerrados pelo reparo. Qualquer falha do instalador, inclusive antes do heartbeat, tenta gravar a mensagem original em `.lauda-publisher/installation-failed.json`.

`launcher.log`, `worker.stdout.log` e `worker.stderr.log` em `.lauda-publisher` capturam tambem erros anteriores ao heartbeat. Uma falha de ativacao grava `installation-startup-failed.json` com o estado e o codigo hexadecimal do Agendador. A ausencia de heartbeat isoladamente nao identifica a causa: esse codigo e os logs sao necessarios para confirmar o diagnostico.

O repositorio e os artefatos continuam sendo codigo confiado a sua conta de usuario, como ao executar o Lauda manualmente. O worker nao executa esse codigo como administrador. O Agendador nao precisa liberar aos chats a permissao de executar tarefas: eles escrevem na fila.

## Comandos para os chats

Execute na raiz deste projeto:

```powershell
node scripts/request-publication.cjs status
node scripts/request-publication.cjs restart-staging
node scripts/request-publication.cjs publish-staging
# Somente quando a publicacao em producao estiver autorizada:
node scripts/request-publication.cjs restart-production
node scripts/request-publication.cjs publish-production
```

O comando informa o ID e aguarda ate cinco minutos. Se a ferramenta devolver uma sessao em andamento, acompanhe essa sessao. Se houver timeout, falha ou interrupcao, nao envie outro pedido automaticamente:

```powershell
node scripts/request-publication.cjs --result ID-DO-PEDIDO
```

Pedidos vencem apos dez minutos. `results` preserva resultados; `processing` indica uma operacao em andamento. `state.json` tem conta e heartbeat; `worker.log` registra falhas da fila. O resultado `completed` da publicacao exige saude local e manifesto servido correspondentes. Confira tambem o endereco publico, login e uma rota autenticada antes de informar sucesso completo.

Esses comandos podem ser executados pelo terminal das conversas com acesso a este mesmo projeto, sem controlar a interface do Windows ou pedir permissao para usar o computador. A instalacao ou reparo em ProgramData continua sendo uma etapa manual no PowerShell administrador do proprietario. O publicador nao remove restricoes de rede ou de arquivos impostas a uma conversa, nem permite acesso por conversas em outro computador. Sem heartbeat, o solicitante explica quando usar `-Repair` e nao grava nenhum pedido na fila.

## Preparacao dos artefatos

O publicador nao compila nem executa testes ou migrations. Prepare os candidatos fora das pastas ativas, valide TypeScript, testes relevantes e o bundle com `scripts/validate-frontend-api.cjs`. Nao execute builds diretamente sobre `dist` ou `mobile/dist` em uso.

| Ambiente | Frontend candidato | API candidata | Pastas ativas |
| --- | --- | --- | --- |
| Testes | `mobile/web-build/transfer-staging-next` | `test-results/transfer-release/backend-next` | `mobile/web-build/transfer-staging`, `test-results/transfer-release/backend` |
| Producao | `mobile/web-build/production-next` | `test-results/production-release/backend-next` | `mobile/dist`, `dist` |

Ambos os candidatos devem conter `release.json` com o mesmo `sourceHash` SHA-256 da versao preparada e `environment` igual a `staging` ou `production`. O frontend tambem exige `apiUrl`: `https://testes.laudaapp.com/api` ou `https://api.laudaapp.com/api`. Producao exige `commit` de 40 caracteres hexadecimais em ambos os manifestos e `backendCommit` igual a `commit` no frontend, para que o supervisor mantenha o backend compilado. Inclua os demais metadados de build e validacao normalmente usados pelo projeto. Nao reutilize um hash para conteudos diferentes.

O worker valida os caminhos e recusa junctions/symlinks; valida ambiente, API e correspondencia dos manifestos; valida o bundle; identifica a API pela porta, comando e conta do Windows antes de trocar arquivos. Guarda as pastas anteriores com sufixo `-before-TIMESTAMP`, reinicia apenas a API correspondente e aguarda o gateway de testes ou supervisor existente recupera-la. Nao reinicia Cloudflare, Docker ou o outro ambiente.

Se o Windows recusar renomear a pasta web aberta (`EPERM`, `EBUSY` ou `EACCES`), o publicador preserva essa pasta, copia o frontend anterior inteiro para o backup e ativa os arquivos individualmente: assets primeiro, HTML depois e `release.json` por ultimo, com troca atomica por arquivo. Assets antigos sao mantidos para sessoes abertas. Uma falha restaura os arquivos do backup, remove somente os arquivos novos e reverte a API. Esse tratamento continua dentro da mesma acao fixa da fila; o chat nao copia arquivos sobre o release ativo.

Uma falha restaura as pastas anteriores e tenta reiniciar a API antiga. Se a recuperacao falhar, o resultado explica que e necessaria intervencao; os artefatos ficam preservados. O mecanismo nao reverte banco de dados. Mudancas de schema exigem planejamento e backup separados.

## Limites e diagnostico

- Se producao retorna `Unknown API process on port 3000` e o comando so aparece no PowerShell administrador, a API antiga pode estar elevada. A transicao unica pelo proprietario e: `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\092687\Documents\Dev\SaaS\Lauda 2.0\scripts\repair-production-runtime.ps1"`, em PowerShell administrador da conta original. O comando valida conta, API compilada, launcher do projeto, heartbeat e fila vazia; salva o diagnostico; reinicia somente a API pela tarefa `Lauda-Production-API`, com sessao interativa e token padrao. O supervisor existente continua monitorando os demais servicos. A tarefa mantem a API compilada e permite os reinicios do publicador; a conta precisa permanecer conectada. Nao publica arquivos, compila, executa migrations, altera permissoes de processos, reinicia frontend, testes ou Cloudflare. Uma falha salva `installation-production-runtime-failed.json` e logs `production-api-*.log`; inspecione o resultado antes de repetir qualquer acao. Quando aparecer `PRODUCTION RUNTIME READY`, a publicacao continua somente pela fila normal.
- Se o publicador ja responde, mas `status` retorna `processManagementError` para os processos antigos de testes, nao repita publicacoes. A transicao inicial pode ser feita pelo proprietario em PowerShell administrador: `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\092687\Documents\Dev\SaaS\Lauda 2.0\scripts\repair-staging-runtime.ps1"`. Esse comando separado da instalacao valida os artefatos ativos, as duas portas de testes (8095 e 3020), conta, comandos e relacao pai/filho; salva o diagnostico; reinicia somente esse par pela tarefa `Lauda-Staging`, com token padrao e sessao interativa. Nao troca releases, executa migrations, altera permissoes de processos nem reinicia producao ou Cloudflare. A tarefa de testes inicia no logon; a conta precisa permanecer conectada. A publicacao normal continua exclusivamente pela fila do publicador. Uma falha salva `installation-staging-runtime-failed.json`; inspecione o resultado e `gateway-standard.err.log` antes de tentar qualquer outra acao.
- A instalacao nao conclui automaticamente a atualizacao pendente de testes. Apos instalar, use `status`, confira os artefatos ativos e solicite `restart-staging` para carregar a API que ja esta preparada, se esses artefatos ainda forem os desejados.
- APIs de outra conta ou processos desconhecidos sao recusados. Uma API previamente elevada pode exigir uma intervencao inicial do administrador para reiniciar pelo supervisor com token padrao. O publicador nao tenta contornar essa protecao.
- O gateway de testes (8095/API 3020) e o supervisor de producao (API 3000/web 8081) precisam estar ativos. O publicador nao os substitui nem garante que Docker Desktop inicie sem sessao interativa.
- Se a tarefa nao iniciar: consulte o relatorio `installation-startup-failed.json` e os logs de inicializacao. Em PowerShell administrador, `Get-ScheduledTaskInfo -TaskName Lauda-Publisher` e o Historico no Agendador tambem mostram o erro. Verifique se a conta da tarefa esta conectada e os caminhos do Node/projeto. A tarefa roda sem limite de tempo, reinicia em caso de falha e nao inicia uma segunda instancia.
- Para atualizar um publicador saudavel, execute em PowerShell administrador da conta original: `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\092687\Documents\Dev\SaaS\Lauda 2.0\scripts\update-publisher.ps1"`. O comando confere conta, tarefa, configuracao, heartbeat e fila vazia; salva os quatro arquivos instalados; para somente o publicador; atualiza `core.cjs`, `worker.cjs`, `processes.ps1` e `launch.ps1`; confere hashes e um novo heartbeat. Nao altera ACLs, definicao da tarefa, aplicacoes ou releases. Inspecione `installation-update-failed.json` se falhar, antes de repetir. `-Repair` destina-se a instalacoes sem heartbeat, nao substitui um publicador saudavel nem apaga releases/backups.
- Para desativar: pare e desregistre somente a tarefa `Lauda-Publisher` pelo Agendador, como administrador. Isso nao encerra o Lauda. Mantenha fila/resultados/backups para diagnostico.

## Validacao local do mecanismo

```powershell
node --test tests/publisher.test.cjs
```

Esses testes usam arquivos temporarios e adaptadores simulados para validar fila, isolamento e rollback. A verificacao real do Agendador, das permissoes da conta e do reinicio das APIs so fica concluida apos a instalacao no Windows.
