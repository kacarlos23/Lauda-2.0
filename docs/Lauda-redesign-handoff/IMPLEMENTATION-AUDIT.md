# Auditoria de implementação do redesign

Data da linha de base: 2026-07-23

Status da correção pós-auditoria: validada localmente na branch `fix/redesign-audit-2026-07-23`; smoke de produção pendente de aprovação, merge e deploy.

## Escopo confirmado

- Aplicação: Expo SDK 54.0.33, Expo Router 6.0.23, React Native 0.81.5, React 19.1 e React Native Web 0.21.
- Configuração: `mobile/app.json`; não há `app.config.*`.
- Rotas de produto: 26, mais `mobile/app/index.tsx`, que apenas redireciona.
- Referência visual: `ESBOCOS-TELAS-LAUDA.pdf` (SHA-256 `251843AEB06CA849624A38589BD08305749BDFD797AB444F5E5FE0DF6A7403AE`).
- Pacote de marca: `Lauda-brand-assets-web.zip` (SHA-256 `C8B40CA1567542582C90EC885852AFC11B0282AAA1D945249100BCB2E68C6C54`).
- O repositório já continha alterações locais antes do redesign, inclusive em músicas, componentes de UI, serviços, testes e scripts. Elas devem ser preservadas.

## Linha de base

| Verificação | Resultado |
| --- | --- |
| Backend typecheck/build (`npm run build`) | passou |
| Backend testes (`npm test -- --runInBand`) | 31/31 suítes, 228/228 testes |
| Mobile typecheck (`npx tsc --noEmit`) | passou |
| Mobile testes (`npm test -- --runInBand`) | 44/44 suítes, 252/252 testes |
| Mobile lint | não há script/configuração de lint no projeto |
| Web export (`npm run build:web`) | bloqueado antes do Expo porque `EXPO_PUBLIC_API_URL` não está definida no ambiente |

O bloqueio do export acima pertence à linha de base sem variáveis. Na validação final, o comando foi executado com `EXPO_PUBLIC_API_URL=https://api.laudaapp.com/api` e gerou 53 rotas.

## Correções da auditoria de 23/07

| Achado | Causa confirmada | Correção e cobertura |
| --- | --- | --- |
| React #418 em hard reload | `serve dist --single` devolvia o HTML da raiz para qualquer deep link | servidor sem fallback SPA e `serve.json` com rewrites apenas para IDs UUID; hard reload das seis rotas públicas e de `/schedules` autenticada coberto por Playwright |
| `<title>` vazio e duplicado | título manual em `+html.tsx` coexistia com o Head do Router, que não recebia metadado de rota no HTML estático | `RouteMetadata` centralizado para as 26 URLs; teste confirma um único título específico e não vazio por HTML |
| `/schedules` empilhada no desktop | calendário e agenda estavam no mesmo fluxo vertical da `FlatList` | duas colunas a partir de 1024 px e empilhamento preservado em tablet/mobile; screenshots e geometria cobertos no E2E |
| Deep link autenticado voltava ao dashboard | `TabsLayout` redirecionava antes de `loadSession` terminar | estado de carregamento acessível mantém a rota até a sessão ser resolvida |
| Evidência não recuperável no CI | screenshots locais estavam em diretórios ignorados | `mobile.yml` publica `playwright-report` e `test-results`, incluindo desktop/mobile de Escalas, por 30 dias |

Nenhuma dessas correções altera endpoints, payloads, stores, modelos, URLs, papéis ou regras de permissão.

## Componentes e estilos de maior impacto

- `mobile/src/theme.ts`: paleta, tipografia, espaçamento, radii, sombras e larguras.
- `mobile/app/(tabs)/_layout.tsx`: shell, tabs, header e regras de visibilidade.
- `mobile/src/components/SidebarNavigation.tsx`: navegação, permissões, perfil e logout.
- `mobile/src/components/ProfileHeaderButton.tsx`: ação de perfil no header.
- `mobile/src/components/ui`: 17 primitivos/estados compartilhados.
- `mobile/src/components/SongForm.tsx`, `BottomSheet.tsx`, `DateTimeInput.tsx` e componentes de seleção.
- Há 51 declarações `StyleSheet.create` em rotas/componentes. A migração deve favorecer tokens e primitivos sem reescrever regras ou stores.

## Inventário das 26 rotas

- [x] 01 `/(auth)/login`: e-mail/senha, validação local, erro da store, loading, links para recuperação, convite e cadastro.
- [x] 02 `/(auth)/register`: igreja, nome, e-mail, senha/confirmação, validações, loading, erro/sucesso via alerta e retorno.
- [x] 03 `/(auth)/member-register`: código, dados pessoais, validações inline, loading, erro, parâmetros de convite e retorno.
- [x] 04 `/convite`: alias funcional de `member-register`; parâmetros e comportamento preservados.
- [x] 05 `/(auth)/forgot-password`: e-mail, validação, loading, erro/sucesso e avanço para redefinição.
- [x] 06 `/(auth)/reset-password`: PIN, senha/confirmação, validações, loading, erro/sucesso e retorno ao login.
- [x] 07 `/(tabs)`: próximas escalas, carregamento/erro/vazio, ações centrais condicionais, permissões por perfil e atalhos administrativos.
- [x] 08 `/schedules`: calendário, agenda, filtros, refresh, loading/erro/vazio, aceite/recusa/substituição, duplicação, exportações, edição e modais.
- [x] 09 `/schedules/new`: dados da escala, ministério, equipe, repertório, buscas, criação rápida de música, loading/erros e três modais.
- [x] 10 `/schedules/[id]/edit`: estados da criação mais reordenação, exportações, exclusão confirmada, área de risco, loading/erro e permissões.
- [x] 11 `/ministries`: busca/filtros, refresh, loading/erro/vazio, criação condicional e sheet de formulário.
- [x] 12 `/ministries/[id]`: loading/erro/vazio, edição, exclusão confirmada, membros, busca, vínculo assíncrono e permissões.
- [x] 13 `/ministries/[id]/members`: busca/status, paginação incremental, refresh, loading/erro/vazio e atalho condicional de atribuição.
- [x] 14 `/ministries/assign`: ministério, usuário, papel, habilidades, notas, status/liderança, carregamento, validação, permissão e confirmação.
- [x] 15 `/songs`: busca/filtros, paginação, refresh, loading/erro/vazio, seleção em lote, exportação, feedback e permissões.
- [x] 16 `/songs/new`: permissão, formulário em duas etapas, erros, salvamento e reinício do formulário.
- [x] 17 `/songs/[id]`: loading/erro, tom, fonte, velocidade, rolagem automática, exportação, edição e exclusão condicionais.
- [x] 18 `/songs/[id]/edit`: permissão, loading/erro, formulário em duas etapas e salvamento.
- [x] 19 `/artists`: permissão, busca com debounce, loading/vazio, edição inline, validação e salvamento.
- [x] 20 `/more`: atalhos condicionais para artistas, instrumentos, igreja e administração global.
- [x] 21 `/members`: permissão, convite/copiar/regenerar, busca/filtros, refresh, loading/erro/vazio, edição de acesso, vínculos, comentários e modais.
- [x] 22 `/members/new`: permissão, dados pessoais, papel, ministério/liderança, validações, loading/erro/sucesso.
- [x] 23 `/global-admin`: autorização global, recursos internos, busca/filtro/paginação, loading/erro/vazio, CRUD, ciclo de vida e permissões granulares em modais.
- [x] 24 `/church`: autorização, loading/erro, resumo, indicadores, edição de identidade e caminhos de gestão.
- [x] 25 `/instruments`: autorização, busca/filtros, loading/erro/vazio, criação/edição inline, cor, validação e exclusão confirmada.
- [x] 26 `/profile`: atualização de sessão, dados pessoais/avatar, instrumentos, picker/modal, criação condicional, loading/erro/vazio, administração e logout.

## Regras transversais preservadas

- Guards e itens condicionais continuam usando os utilitários existentes de permissões.
- Stores, serviços, endpoints, payloads, URLs e modelos não fazem parte do redesign.
- Permanecem todos os `testID`, `accessibilityLabel`, confirmações, estados de refresh/loading/error/empty/success e controles nativos.
- O alias `/convite`, os deep links e os parâmetros de retorno devem continuar funcionando.
- A barra lateral permanece no desktop e as tabs inferiores permanecem no mobile.
