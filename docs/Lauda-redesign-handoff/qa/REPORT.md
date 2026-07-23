# QA visual e funcional

Data: 2026-07-23

Cobertura: 26 rotas, 4 larguras representativas, zoom de 200%, teclado e permissões

## Resumo

- Rotas cobertas: 26/26.
- E2E: 41/41 cenários sobre o export estático de produção.
- HTML: 26/26 rotas com um único título específico e não vazio.
- Hard reload: seis rotas públicas e `/schedules` autenticada sem React #418 ou erros de console.
- Overflow horizontal: não encontrado nos cenários representativos.
- Contraste: pares de texto críticos aprovados em WCAG AA.
- Achados de produto pendentes: smoke pós-deploy em produção.
- Build público: URL HTTPS confirmada no bundle, sem fallback local.
- Gates de segurança locais: Gitleaks sem achados, dependências sem alta/crítica de runtime e DAST lógico 18/18.

## Achados corrigidos durante o dogfood

### QA-01 — Rodapé de sheet inacessível em laptop

- Severidade: alta
- Área: sheets/modais
- Cenário: 1280 × 720
- Sintoma: ações de confirmação ficavam abaixo do viewport e o conteúdo não rolava.
- Correção: conteúdo passou a usar `ScrollView`, o gesto ficou restrito ao handle e o rodapé tornou-se fixo.
- Regressão: validada em `ministry-create-sheet-fixed.png` e pela suíte de ministérios.

### QA-02 — Barra inferior com labels truncadas

- Severidade: média
- Área: navegação mobile
- Cenário: 390 × 844
- Sintoma: sete tabs competiam por largura e perdiam legibilidade.
- Correção: cinco destinos essenciais na barra; `Membros` e `Igreja` permanecem em `/more` com as mesmas permissões.
- Regressão: validada em `dashboard-mobile-nav-fixed.png`.

### QA-03 — Contraste limítrofe em microtextos

- Severidade: média
- Área: tema
- Sintoma: texto secundário sobre marfim media 4,49:1; terracota textual, 4,01:1.
- Correção: variantes textuais `#63706A`, `#B2522A` e `#E8875E`, mantendo o terracota de marca para superfícies e acentos gráficos.
- Regressão: relações finais de 4,54:1 a 14,59:1.

### QA-04 — Expectativas E2E anteriores ao redesign

- Severidade: média
- Área: automação
- Sintoma: teste exigia ausência de foco, títulos antigos e seletores de navegação parciais.
- Correção: foco visível passou a ser requisito; seletores usam `testID` estável; agenda seleciona explicitamente o dia.
- Regressão: seletores semânticos e 41/41 E2E aprovados.

### QA-05 — React #418 em deep links de produção

- Severidade: bloqueadora
- Área: export web/hidratação
- Sintoma: hard reload de `/login` recebia o HTML da raiz e falhava na hidratação.
- Causa: `serve dist --single`.
- Correção: cada rota fixa usa seu HTML exportado; rotas dinâmicas usam rewrites restritos a UUID.
- Regressão: hard reload automatizado das seis rotas públicas e de `/schedules` autenticada, sem `pageerror` ou `console.error`.

### QA-06 — Título vazio e duplicado

- Severidade: alta
- Área: metadados
- Sintoma: `<title data-rh=""></title>` junto de `<title>Lauda</title>`, com `document.title` vazio.
- Correção: remoção do título manual e metadado centralizado por pathname.
- Regressão: matriz automatizada das 26 URLs exige exatamente um título específico e não vazio.

### QA-07 — Escalas não seguia o esboço desktop

- Severidade: alta
- Área: `/schedules`
- Sintoma: calendário em largura total e agenda abaixo.
- Correção: calendário e agenda em duas colunas a partir de 1024 px; tablet/mobile continuam empilhados.
- Regressão: geometria verificada por Playwright e screenshots `schedules-desktop.png`/`schedules-mobile.png`.

### QA-08 — Rota autenticada perdida no reload

- Severidade: alta
- Área: sessão/navegação
- Sintoma: a aba redirecionava antes de a leitura da sessão terminar, levando o usuário ao dashboard.
- Correção: estado acessível de carregamento mantém a rota até a sessão ser resolvida.
- Regressão: `/schedules` permanece ativa depois de `page.reload()`.

## Comparação prioritária com os esboços

Foram revistas as telas 04, 11, 13, 16, 18, 21, 24 e 25 contra os estados reais capturados:

- `/convite`;
- `/ministries`;
- `/ministries/[id]/members`;
- `/songs/new`;
- `/songs/[id]/edit`;
- `/members`;
- `/church`;
- `/instruments`.

As diferenças observadas são decorrentes de responsividade, dados vazios ou conteúdo real. Hierarquia, ações, estados e permissões permanecem presentes; não foi necessária mudança funcional nessas rotas.

## Evidências principais

- `login-current-desktop.png`
- `login-current-mobile.png`
- `login-keyboard-focus.png`
- `login-validation-alert.png`
- `dashboard-desktop.png`
- `dashboard-mobile-nav-fixed.png`
- `dashboard-tablet.png`
- `dashboard-zoom-200.png`
- `ministry-create-sheet-fixed.png`
- `song-detail-mobile.png`
- `global-admin-denied-mobile.png`

As capturas locais históricas permanecem no workspace de QA. O Mobile CI publica `playwright-report/` e `test-results/` no artifact `lauda-redesign-qa-<sha>` por 30 dias, incluindo as evidências novas de Escalas.

## Produção

Na abertura da auditoria, `https://laudaapp.com/login` ainda reproduzia React #418 e título vazio. A correção foi validada no export estático local. O smoke de produção será feito após aprovação, merge e deploy; não está marcado como concluído antecipadamente.
