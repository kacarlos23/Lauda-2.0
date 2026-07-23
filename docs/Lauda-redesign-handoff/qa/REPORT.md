# QA visual e funcional

Data: 2026-07-23

Cobertura: 26 rotas, 4 larguras representativas, zoom de 200%, teclado e permissões

## Resumo

- Rotas cobertas: 26/26.
- E2E: 32/32 cenários.
- Console final: sem erros no build estático e no servidor de desenvolvimento.
- Overflow horizontal: não encontrado nos cenários representativos.
- Contraste: pares de texto críticos aprovados em WCAG AA.
- Achados de produto pendentes: nenhum.
- Build público: URL HTTPS confirmada no bundle, sem fallback local.

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
- Regressão: 32/32 E2E aprovados.

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

O diretório `screenshots` contém as demais evidências por rota e estado.
