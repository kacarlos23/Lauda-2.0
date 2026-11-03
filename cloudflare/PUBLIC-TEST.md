# Ambiente público de testes

URL: https://testes.laudaapp.com

Este checkout isolado parte da versão publicada `15d77bc27f04fc00954fd2d5316654812a88cea5`. Não publica mudanças na produção nem usa o banco ou o Redis de produção. As alterações locais do checkout principal foram preservadas.

## Infraestrutura

- Túnel exclusivo `laudaapp-testes`, com configuração em `%USERPROFILE%/.cloudflared/laudaapp-testes.yml`.
- Gateway em `127.0.0.1:8095`; API compilada em `127.0.0.1:3020`.
- PostgreSQL exclusivo: container `lauda-public-test-db`, volume `lauda-public-test-data`, porta `127.0.0.1:5436`, banco `lauda_public_test`, usuário `lauda_test`.
- Segredos exclusivos em `.env.public-test`, fora do Git. Nenhuma credencial de produção é carregada pelo ambiente.
- Frontend exportado em `mobile/web-build/public-test`, com API `https://testes.laudaapp.com/api` e barra superior de 22px.
- A configuração recusa qualquer outro banco/porta, chaves compartilhadas, Redis compartilhado ou entrega externa. CSP limita conexões do navegador ao próprio site.
- Cloudflare Tunnel oferece acesso público por HTTPS; os serviços continuam neste computador, que precisa ficar ligado e conectado. Não é hospedagem independente nos servidores da Cloudflare.

## Dados

`scripts/initialize-public-test.cjs` faz uma única cópia consistente com `pg_dump`, somente leitura na produção. A restauração ocorre exclusivamente no container novo. O script recusa inicializar sobre um ambiente existente.

Músicas, cifras, artistas, usuários, igrejas, escalas, vínculos e permissões são copiados. Os usuários podem entrar com o mesmo e-mail e senha da data da cópia. Sessões, tokens de redefinição, segredos MFA, dispositivos push, eventos e notificações operacionais da produção são removidos da cópia. E-mail e push ficam desativados. Chaves JWT e emissor são exclusivos. Não há sincronização automática com a produção.

Os dados cadastrados ou editados nos testes ficam apenas neste banco, inclusive senhas, convites e exclusões. Não executar inicialização/reset do banco sem solicitação explícita.

## Operação

No PowerShell, a partir deste checkout:

```powershell
# Compilar e validar a URL incorporada (não toca na produção)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-public-test.ps1

# Iniciar o supervisor (também registrado para iniciar no login do Windows)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-public-test.ps1

# Verificar configuração e executar edição real pelo endereço público
node --test scripts/public-test-config.test.cjs
node scripts/verify-public-test.cjs
```

O verificador cria um usuário temporário apenas na cópia, entra pela API, edita uma cifra, compara a assinatura do catálogo completo em produção, restaura a cifra de teste, verifica o navegador em desktop/celular e remove o usuário temporário. Na produção só executa SELECT e requisições de leitura/autenticação inválida.

Evidências locais: `test-results/public-test/snapshot.json`, `verification.json` e screenshots. O dump inicial fica em `.resilience/public-test`, nunca no diretório servido pelo site.

O supervisor dedicado reinicia os processos de teste sem alterar o túnel ou os serviços de produção. Tarefa do Windows: `Lauda Public Test Environment`.

O editor visual de cifras está integrado à etapa da cifra em criar/editar músicas, habilitado somente no build de staging. Consulte `cloudflare/VISUAL-CHORD-EDITOR.md` para operação e validação.
