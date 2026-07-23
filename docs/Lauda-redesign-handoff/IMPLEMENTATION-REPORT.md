# Relatório final do redesign do Lauda

Data: 2026-07-23

Status: 26/26 rotas migradas e validadas localmente; smoke pós-deploy pendente

## Resultado

O frontend recebeu a nova identidade editorial verde-floresta, marfim e terracota sem alterar URLs, endpoints, payloads, stores, modelos, autenticação, persistência ou regras de permissão. A sidebar permanece no desktop, com estados aberto e recolhido, e a navegação inferior permanece no celular.

Os estados reais de loading, erro, vazio, sucesso, validação, confirmação, bloqueio, refresh, seleção e permissões foram preservados. Os testes funcionais usam os mesmos contratos de API e os identificadores estáveis existentes.

## Correção pós-auditoria

A revisão de 23/07/2026 identificou problemas no modo como o export era servido, nos metadados e na composição desktop de Escalas. A correção:

- remove o fallback SPA `--single`, que provocava React #418 em deep links;
- serve cada HTML exportado e usa rewrites restritos aos IDs UUID das cinco rotas dinâmicas;
- centraliza um título específico para cada uma das 26 URLs e elimina o `<title>` duplicado;
- preserva deep links autenticados enquanto a sessão local é carregada;
- reorganiza `/schedules` em calendário + agenda lado a lado no desktop e mantém o empilhamento mobile;
- publica relatórios, traces e screenshots do Playwright como artifact do Mobile CI por 30 dias.

Não houve alteração de API, store, modelo, autenticação, persistência, URL, fluxo ou permissão.

## Resumo por etapa

| Etapa | Entrega |
| --- | --- |
| 0 — Auditoria | Expo/rotas/permissões/estados mapeados, hashes das referências registrados e linha de base executada. |
| 1 — Marca | SVGs, ícones, favicon, apple touch icon, PWA e manifesto integrados em `mobile/assets/brand`, `mobile/public`, `app.json` e `+html.tsx`. |
| 2 — Tema e primitivos | Tokens centralizados, radii compactos, superfícies contínuas, foco visível e novos primitivos compartilhados. |
| 3 — Shell | Sidebar 248/72 px, grupos editoriais, marcador terracota, perfil na base, header mobile e cinco tabs essenciais no celular. |
| 4 — Autenticação | Seis rotas com composição dividida no desktop e assinatura compacta no celular. |
| 5 — Dashboard | Próxima escala como painel dominante, métricas compactas, ações retangulares e listas editoriais. |
| 6 — Listas | Catálogos convertidos para toolbars e listas/tabelas contínuas, preservando filtros, paginação e ações. |
| 7 — Formulários | Campos compactos agrupados por seção, etapas de música explícitas e ações previsíveis. |
| 8 — Detalhes | Cabeçalhos de entidade, relações contínuas e cifra como superfície dominante com toolbar aderente. |
| 9 — Administração | Hub mobile, operação global densa e responsiva, identidade da igreja e perfil reorganizados. |
| 10 — Qualidade | Desktop, laptop, tablet, celular, 200% de zoom, teclado, 44 px de toque, alertas e contraste WCAG AA verificados. |
| 11 — Entrega | Build, typecheck, testes unitários/integrados, 41 E2E sobre export estático e navegação das 26 rotas executados. |

## Checklist das 26 rotas

| # | Rota | Situação |
| ---: | --- | --- |
| 01 | `/(auth)/login` | ✓ migrada e validada |
| 02 | `/(auth)/register` | ✓ migrada e validada |
| 03 | `/(auth)/member-register` | ✓ migrada e validada |
| 04 | `/convite` | ✓ alias e parâmetros preservados |
| 05 | `/(auth)/forgot-password` | ✓ migrada e validada |
| 06 | `/(auth)/reset-password` | ✓ migrada e validada |
| 07 | `/(tabs)` | ✓ dashboard migrado |
| 08 | `/schedules` | ✓ calendário + agenda em duas colunas no desktop; empilhada no mobile |
| 09 | `/schedules/new` | ✓ migrada, incluindo modais |
| 10 | `/schedules/[id]/edit` | ✓ migrada, incluindo risco e confirmação |
| 11 | `/ministries` | ✓ migrada, incluindo sheet |
| 12 | `/ministries/[id]` | ✓ migrada e validada |
| 13 | `/ministries/[id]/members` | ✓ migrada e validada |
| 14 | `/ministries/assign` | ✓ migrada e validada |
| 15 | `/songs` | ✓ migrada, incluindo filtros, seleção e exportação |
| 16 | `/songs/new` | ✓ duas etapas preservadas |
| 17 | `/songs/[id]` | ✓ cifra e controles preservados |
| 18 | `/songs/[id]/edit` | ✓ duas etapas preservadas |
| 19 | `/artists` | ✓ edição inline preservada |
| 20 | `/more` | ✓ hub mobile migrado |
| 21 | `/members` | ✓ migrada, incluindo convite e modais |
| 22 | `/members/new` | ✓ migrada e validada |
| 23 | `/global-admin` | ✓ autorização, tabelas, filtros e modais validados por E2E |
| 24 | `/church` | ✓ migrada e validada |
| 25 | `/instruments` | ✓ catálogo e edição inline preservados |
| 26 | `/profile` | ✓ identidade, instrumentos, permissões e sair preservados |

## Decisões responsivas

- No celular, `Membros` e `Igreja` saem da barra inferior para evitar sete tabs truncadas, mas continuam disponíveis em `/more`, respeitando as mesmas permissões.
- No tablet, a sidebar inicia recolhida e preserva labels acessíveis e expansão.
- Tabelas administrativas viram linhas empilhadas em larguras menores.
- O `BottomSheet` usa conteúdo rolável com rodapé fixo, mantendo confirmação e cancelamento acessíveis em 720 px de altura.
- O dashboard a 200% de zoom não produz scroll horizontal da página.
- A recarga direta de uma rota autenticada mantém o destino enquanto a sessão é resolvida.

## Acessibilidade

- Foco web sólido e visível, com espessura mínima testada de 2 px.
- Validações continuam anunciadas como `alert`.
- Alvos interativos visíveis verificados com mínimo de 44 px no celular.
- Pares tipográficos críticos atendem AA: texto primário 14,59:1, secundário 4,62:1, terracota sobre marfim 4,54:1, terracota claro sobre verde escuro 5,99:1 e texto inverso sobre verde 5,77:1.
- A ordem de foco, labels e nomes acessíveis foi exercitada nos E2E e na navegação manual.

## Arquivos e áreas alteradas

- Identidade/configuração: `mobile/app.json`, `mobile/app/+html.tsx`, `mobile/assets/brand/**`, `mobile/public/**`.
- Renderização web: `mobile/serve.json`, `mobile/package.json`, `mobile/src/components/RouteMetadata.tsx` e `mobile/playwright.config.ts`.
- Sistema visual: `mobile/src/theme.ts`, `mobile/src/components/ui/**`, `AuthShell.tsx`, `BrandLogo.tsx`, `SidebarNavigation.tsx`, `ProfileHeaderButton.tsx`, `BottomSheet.tsx`.
- Shell e rotas: `mobile/app/_layout.tsx`, `mobile/app/(auth)/**`, `mobile/app/(tabs)/**`.
- Fluxos compartilhados: `SongForm.tsx`, `ArtistPicker.tsx`, `ScheduleCard.tsx` e componentes de músicas.
- Testes atualizados para o novo contrato visual: `mobile/tests/e2e/app.spec.ts`, `layout-search-fixes.spec.ts`, `music-fixes-visual.spec.ts` e `static-rendering.spec.ts`.
- Evidências no CI: `.github/workflows/mobile.yml`.

Alterações locais que já existiam no backend, serviços, stores, músicas e scripts foram preservadas; nenhuma delas foi revertida.

## Verificações finais

| Comando/verificação | Resultado |
| --- | --- |
| `git diff --check` | passou; apenas avisos de normalização LF/CRLF |
| `npm run build` | passou |
| `npm test -- --runInBand` | 31/31 suítes, 228/228 testes |
| `mobile: npx tsc --noEmit` | passou |
| `mobile: npm test -- --runInBand` | 44/44 suítes, 252/252 testes |
| `mobile: npm run test:e2e` | 41/41 cenários sobre build estático |
| `mobile: npm run build:web` | passou; 53 rotas estáticas e URL pública validada no bundle |
| Títulos dos HTMLs | 26/26 com um único título específico e não vazio |
| Hard reload local | seis rotas públicas e `/schedules` autenticada sem erros de console/hidratação |
| Lint | não existe script ou configuração de lint no repositório |

## Build público

O comando agregado foi validado com `EXPO_PUBLIC_API_URL=https://api.laudaapp.com/api`. O prebuild aprovou a URL HTTPS, o Expo gerou as 53 rotas estáticas e o postbuild confirmou a mesma URL no bundle sem fallback local.

## Evidências

As capturas históricas de autenticação, dashboard, listas, formulários, detalhes, administração, tablet, mobile, foco e zoom ficam no workspace de QA. Em cada execução do Mobile CI, `playwright-report/` e `test-results/` são publicados no artifact `lauda-redesign-qa-<sha>`; ele inclui as evidências desktop/mobile atualizadas de `/schedules`.

## Limite da validação

A produção em `https://laudaapp.com` ainda refletia o deploy anterior quando a auditoria foi iniciada. O smoke pós-correção em produção deve ocorrer somente após aprovação, merge e deploy desta branch; ele não é declarado como concluído neste relatório.
