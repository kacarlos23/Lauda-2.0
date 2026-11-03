# Editor visual de cifras

Abra https://laudaapp.com, entre com sua conta, acesse **Músicas** e edite uma música. Para experimentar com dados isolados, use https://testes.laudaapp.com. Na etapa da cifra estão os modos **Visual**, **Texto ChordPro** e **Prévia**. Em um cadastro novo, cole a letra e pressione **Começar a cifrar**.

## Uso

- Escolha um acorde na paleta e toque na letra/sílaba onde ele entra. O acorde permanece selecionado para ser repetido em outros pontos.
- Use **Adicionar acorde** para símbolos personalizados, incluindo baixos e extensões.
- Toque num acorde inserido para trocar, mover ou remover. Mover exige apenas tocar no destino; arrastar também funciona no computador.
- **Ampliar letras** aumenta os alvos para posicionamento no celular. Na navegação por teclado, foque uma linha, use as setas e pressione Enter para inserir.
- O lápis ao lado de cada linha permite editar a letra. Os acordes acompanham o texto preservado; apagar seu trecho mostra os acordes afetados e exige aplicação explícita.
- A lixeira à direita remove a linha inteira, com letra e acordes. Linhas com conteúdo pedem confirmação; linhas vazias são removidas diretamente. É possível desfazer e refazer antes de salvar. Diretivas e tablaturas continuam sendo editadas pelo modo Texto para preservar sua estrutura.
- Desfazer/refazer está disponível para inserções, movimentos, remoções, conversões e alterações de texto.
- Uma cifra tradicional exige conferir e aplicar a conversão antes de editar por toque. Cancelar a conversão mantém a fonte original. Blocos especiais, comentários, diretivas e tablaturas são preservados e podem ser editados pelo modo Texto.
- Somente **Salvar música** escreve na API/banco do ambiente aberto. As escolhas existentes de guardar rascunho, descartar e continuar editando permanecem no formulário.

## Arquitetura

`SongForm` usa `VisualChordEditor` no cadastro e na edição. A implementação web usa React/DOM e os tokens do Lauda. A implementação nativa mantém o campo de texto existente. A API, `Song.content`, permissões, tenant e exportações mantêm seus contratos. Somente o ambiente com `EXPO_PUBLIC_APP_ENV=staging` exibe as identificações de teste e ativa a proteção de URL exclusiva de homologação.

O modelo em `mobile/src/utils/visualChordEditor.ts` mantém as linhas e terminações originais. Posições novas respeitam grafemas, incluindo acentos combinados e emoji. As operações reescrevem somente a linha afetada e produzem ChordPro. A conversão tradicional reaproveita `ChordsOverWordsParser`; a prévia reaproveita `ChordSheetView`.

Sintaxe não reconhecida não é descartada: o trecho fica preservado no editor de texto. A conversão por colunas é uma proposta para conferência, especialmente para cifras com tabs e espaçamento inconsistente. Alterações extensas na letra podem exigir reposicionar os acordes indicados no aviso.

## Publicação e verificações

O build é criado em `mobile/web-build/public-test-candidate`, passa pelos typechecks e validação de API isolada e só depois é copiado ao diretório servido. Assets são copiados antes dos HTMLs, e a versão anterior é preservada em `.resilience/public-test-web-*`. A publicação do frontend não reinicia nem altera os serviços de produção.

```powershell
# No diretório mobile (os globs relativos contornam o caminho .codex no Jest Windows):
node node_modules/jest/bin/jest.js --config jest.config.js --runInBand --testMatch '**/src/**/*.test.ts' '**/src/**/*.test.tsx' --runTestsByPath src/utils/visualChordEditor.test.ts src/utils/chordEngine.test.ts

# Na raiz:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-public-test.ps1
node scripts/verify-visual-editor.cjs
node scripts/verify-public-test.cjs
```

O verificador visual usa um tenant, usuários e músicas sintéticos somente no banco de testes; remove as fixtures ao terminar. Confere o fluxo real pelo domínio público, permissão de edição, fronteira de tenant e a assinatura do catálogo de produção usando SELECT. Os dados do catálogo de testes anteriores à execução também devem permanecer intactos.

Evidências: `test-results/visual-chord-editor/verification.json`, `desktop-editor.png` e `mobile-editor.png`.

## Publicação em produção

O site público usa os mesmos componentes, com API `https://api.laudaapp.com/api` e sem a identificação de staging. O backend e o formato do banco permanecem compatíveis; esta publicação do editor não requer migration nem importação de dados.

Após validar a suíte completa e gerar `mobile/dist` com configuração de produção, use `node scripts/production-web-release.cjs prepare` para auditar UTF-8 e preservar dump/artefatos anteriores. Com o código revisado, commitado e enviado para `origin/main`, `publish` copia somente o frontend e o ajuste do launcher que mantém o artefato verificado nos reinícios. `verify` confere health, commit público, hashes dos bundles, codificação e preservação dos dados.

A publicação preserva os arquivos locais de desenvolvimento. Um início normal do supervisor reaproveita o frontend publicado quando seu manifesto identifica produção, commit e API esperados. Um início explícito com `-Production` continua recompilando o código do checkout escolhido.
