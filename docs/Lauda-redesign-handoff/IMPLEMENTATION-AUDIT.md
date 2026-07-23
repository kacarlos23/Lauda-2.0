# Auditoria de implementação do redesign

Data da linha de base: 2026-07-23

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

## Componentes e estilos de maior impacto

- `mobile/src/theme.ts`: paleta, tipografia, espaçamento, radii, sombras e larguras.
- `mobile/app/(tabs)/_layout.tsx`: shell, tabs, header e regras de visibilidade.
- `mobile/src/components/SidebarNavigation.tsx`: navegação, permissões, perfil e logout.
- `mobile/src/components/ProfileHeaderButton.tsx`: ação de perfil no header.
- `mobile/src/components/ui`: 17 primitivos/estados compartilhados.
- `mobile/src/components/SongForm.tsx`, `BottomSheet.tsx`, `DateTimeInput.tsx` e componentes de seleção.
- Há 51 declarações `StyleSheet.create` em rotas/componentes. A migração deve favorecer tokens e primitivos sem reescrever regras ou stores.

## Inventário das 26 rotas

- [ ] 01 `/(auth)/login`: e-mail/senha, validação local, erro da store, loading, links para recuperação, convite e cadastro.
- [ ] 02 `/(auth)/register`: igreja, nome, e-mail, senha/confirmação, validações, loading, erro/sucesso via alerta e retorno.
- [ ] 03 `/(auth)/member-register`: código, dados pessoais, validações inline, loading, erro, parâmetros de convite e retorno.
- [ ] 04 `/convite`: alias funcional de `member-register`; deve manter parâmetros e comportamento.
- [ ] 05 `/(auth)/forgot-password`: e-mail, validação, loading, erro/sucesso e avanço para redefinição.
- [ ] 06 `/(auth)/reset-password`: PIN, senha/confirmação, validações, loading, erro/sucesso e retorno ao login.
- [ ] 07 `/(tabs)`: próximas escalas, carregamento/erro/vazio, ações centrais condicionais, permissões por perfil e atalhos administrativos.
- [ ] 08 `/schedules`: calendário, agenda, filtros, refresh, loading/erro/vazio, aceite/recusa/substituição, duplicação, exportações, edição e modais.
- [ ] 09 `/schedules/new`: dados da escala, ministério, equipe, repertório, buscas, criação rápida de música, loading/erros e três modais.
- [ ] 10 `/schedules/[id]/edit`: estados da criação mais reordenação, exportações, exclusão confirmada, área de risco, loading/erro e permissões.
- [ ] 11 `/ministries`: busca/filtros, refresh, loading/erro/vazio, criação condicional e sheet de formulário.
- [ ] 12 `/ministries/[id]`: loading/erro/vazio, edição, exclusão confirmada, membros, busca, vínculo assíncrono e permissões.
- [ ] 13 `/ministries/[id]/members`: busca/status, paginação incremental, refresh, loading/erro/vazio e atalho condicional de atribuição.
- [ ] 14 `/ministries/assign`: ministério, usuário, papel, habilidades, notas, status/liderança, carregamento, validação, permissão e confirmação.
- [ ] 15 `/songs`: busca/filtros, paginação, refresh, loading/erro/vazio, seleção em lote, exportação, feedback e permissões.
- [ ] 16 `/songs/new`: permissão, formulário em duas etapas, erros, salvamento e reinício do formulário.
- [ ] 17 `/songs/[id]`: loading/erro, tom, fonte, velocidade, rolagem automática, exportação, edição e exclusão condicionais.
- [ ] 18 `/songs/[id]/edit`: permissão, loading/erro, formulário em duas etapas e salvamento.
- [ ] 19 `/artists`: permissão, busca com debounce, loading/vazio, edição inline, validação e salvamento.
- [ ] 20 `/more`: atalhos condicionais para artistas, instrumentos, igreja e administração global.
- [ ] 21 `/members`: permissão, convite/copiar/regenerar, busca/filtros, refresh, loading/erro/vazio, edição de acesso, vínculos, comentários e modais.
- [ ] 22 `/members/new`: permissão, dados pessoais, papel, ministério/liderança, validações, loading/erro/sucesso.
- [ ] 23 `/global-admin`: autorização global, recursos internos, busca/filtro/paginação, loading/erro/vazio, CRUD, ciclo de vida e permissões granulares em modais.
- [ ] 24 `/church`: autorização, loading/erro, resumo, indicadores, edição de identidade e caminhos de gestão.
- [ ] 25 `/instruments`: autorização, busca/filtros, loading/erro/vazio, criação/edição inline, cor, validação e exclusão confirmada.
- [ ] 26 `/profile`: atualização de sessão, dados pessoais/avatar, instrumentos, picker/modal, criação condicional, loading/erro/vazio, administração e logout.

## Regras transversais preservadas

- Guards e itens condicionais continuam usando os utilitários existentes de permissões.
- Stores, serviços, endpoints, payloads, URLs e modelos não fazem parte do redesign.
- Permanecem todos os `testID`, `accessibilityLabel`, confirmações, estados de refresh/loading/error/empty/success e controles nativos.
- O alias `/convite`, os deep links e os parâmetros de retorno devem continuar funcionando.
- A barra lateral permanece no desktop e as tabs inferiores permanecem no mobile.
