# Publicação automática em testes

A branch `staging` dispara o workflow **Staging release**. O GitHub valida e empacota a API e o frontend. A tarefa local `Lauda-Staging-Deploy` verifica a branch a cada dois minutos. Ela usa a credencial do Git Credential Manager da conta conectada e baixa apenas o pacote da execução bem-sucedida do commit que está no topo da branch. O workflow recebe apenas os arquivos da aplicação.

O banco de produção é exportado em uma sessão somente leitura. O dump passa direto para o PostgreSQL de testes, sem arquivo intermediário. O candidato fica separado do banco ativo enquanto a rotina descarta credenciais, sessões e dados de notificação, aplica as migrations e testa a API em loopback. Novas tabelas e mudanças nas colunas de usuários exigem revisar a política de cópia. A conta local precisa ter acesso aos contêineres de produção e de testes.

## Primeiro uso no host Windows

1. Confira `node scripts/request-publication.cjs status`.
2. Depois que o primeiro pacote da branch estiver disponível, execute `node scripts/staging-deploy/run.cjs --prepare-only` para validar um candidato temporário.
3. Execute `node scripts/staging-deploy/run.cjs` para aplicar a primeira publicação.
4. Registre a tarefa sob a conta do publicador com `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/staging-deploy/install-task.ps1`.

O Windows precisa estar ligado e com a conta conectada. Para recuperar a credencial exclusiva de testes, execute `node scripts/staging-deploy/run.cjs --show-login` nessa conta. A senha fica protegida pelo Windows no host. Alterações feitas em testes são substituídas em uma publicação bem-sucedida. O banco anterior permanece disponível para recuperação.

O estado fica em `test-results/staging-deploy/state.json`. Em uma interrupção, confira `activation.json`, o resultado do publicador por ID, os manifestos ativos e o banco anterior antes de retomar. A rotina deixa a tentativa pendente para inspeção quando o publicador ainda não tem resultado conclusivo. O código do publicador e as ações da fila continuam seguindo [PUBLISHER.md](../../PUBLISHER.md).
