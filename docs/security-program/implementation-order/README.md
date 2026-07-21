# Ordem de implementacao

Versao: 1.0  
Data: 2026-07-16  
Aprovadores: Engenharia TBD; Seguranca TBD  
Proxima revisao: 2026-08-16

Este diretorio divide o programa em etapas pequenas e sequenciais. Cada arquivo pode ser revisado isoladamente, mas nenhum controle deve ser declarado concluido antes de seus pre-requisitos.

## Navegacao

1. [Etapa 0 - Gates documentais](./00-gates-documentais.md)
2. [Etapa 1 - Contencao tecnica](./01-contencao-tecnica.md)
3. [Etapa 2 - Sessoes e revogacao](./02-sessoes-revogacao.md)
4. [Etapa 3 - Multi-tenant, RBAC e administracao](./03-multitenant-rbac-administracao.md)
5. [Etapa 4 - Lifecycle de dados e direitos](./04-lifecycle-direitos.md)
6. [Etapa 5 - Observabilidade, infraestrutura e resiliencia](./05-observabilidade-infra-resiliencia.md)
7. [Etapa 6 - Secure SDLC](./06-secure-sdlc.md)

## Dependencia principal

```text
Etapa 0: decisoes, ownership e riscos documentais
        |
Etapa 1: contencao imediata
        |
Etapa 2: sessoes e revogacao
        |
Etapa 3: autorizacao e administracao
        |
Etapa 4: retencao, direitos e eliminacao
        |
Etapa 5: logs, infraestrutura e recuperacao
        |
Etapa 6: garantia continua no SDLC
```

## Estado atual

- Etapa 0: baseline tecnico produzido; aprovacoes juridicas, operacionais e owners nominais pendentes.
- Etapa 1: parcialmente implementada/testada; dependencias operacionais e revogacao de sessoes permanecem abertas.
- Etapas 2 e 3: controles tecnicos implementados, com gates operacionais pendentes.
- Etapa 4: nao iniciada; ledger de eliminacoes bloqueia o replay de restore.
- Etapa 5: codigo e restore local comprovados; controles cloud/operacionais permanecem bloqueantes.
- Etapa 6: nao iniciada como implementacao completa.

## Padrao de conclusao

Cada etapa somente termina quando possuir:

- implementacao ou procedimento aplicavel;
- testes proporcionais ao risco;
- Data Owner e System Owner quando aplicavel;
- evidencia verificavel;
- data da proxima revisao;
- riscos residuais e excecoes registrados;
- owner e prazo de remocao para compatibilidade temporaria;
- aprovacao juridica/operacional quando o controle depender disso.
