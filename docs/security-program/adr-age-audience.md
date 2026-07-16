# ADR-AGE-001 - Publico etario e acesso provavel

Versao: 1.0
Data: 2026-07-16
Status: decisao juridica/produto pendente; criterio tecnico inicial definido
Aprovadores: Produto TBD; Juridico/Privacidade TBD; Engenharia TBD
Proxima revisao: 2026-08-16 ou antes de distribuicao publica

## Contexto

Lauda 2.0 gerencia igrejas, ministerios, membros, escalas e musicas. O app tem cadastro por convite publico e pode ser usado por membros de ministerios. O repositorio nao contem politica etaria, termos, consentimento parental, age gate, verificacao de idade ou restricao tecnica para menores.

Como ministerios de igrejas podem incluir adolescentes, nao e seguro presumir ausencia de acesso provavel por menores apenas porque o produto e operacional.

## Decisao tecnica provisoria

1. O produto nao deve ser apresentado como direcionado a criancas.
2. O acesso provavel por adolescentes permanece `TBD` e deve ser avaliado por Produto/Juridico antes de producao com dados reais.
3. Enquanto a decisao nao existir, o cadastro por convite deve ser tratado como potencialmente acessivel por adolescentes.
4. A classificacao de dados de menores, consentimento, avisos, direitos, suporte e retencao ficam bloqueados para decisao juridica/produto.

## Criterios formais de avaliacao

| Criterio | Pergunta | Evidencia necessaria | Responsavel |
|---|---|---|---|
| Publico-alvo | O produto sera ofertado a igrejas com membros menores de 18 anos? | Persona, termos comerciais, onboarding | Produto/Juridico TBD |
| Fluxo de convite | Convites podem ser compartilhados com adolescentes ou grupos jovens? | Politica de convite, texto no app, controles de tenant | Produto/Operacao TBD |
| Dados coletados | Dados de perfil, escala, ministerio, imagem ou recusa podem envolver menores? | ROPA/Data Map revisado | Juridico/Privacidade TBD |
| Capacidade de consentimento | E necessario consentimento do responsavel ou restricao por idade? | Parecer juridico | Juridico TBD |
| Design e linguagem | UI incentiva uso infantil ou coleta excessiva? | Revisao de UX/conteudo | Produto TBD |
| Suporte e incidentes | Como tratar solicitacoes/incidentes envolvendo menores? | Playbook e canal | DPO/Juridico TBD |

## Consequencias

- Producao com dados reais nao deve ser considerada liberada enquanto ADR-AGE-001 estiver pendente.
- Data Map, ROPA, incident response e retention devem destacar possivel acesso por adolescentes.
- Se menores forem permitidos, implementar controles de aviso, consentimento, minimizacao, retencao e atendimento de direitos antes do rollout.
- Se menores forem proibidos, implementar criterio de elegibilidade, comunicacao a tenants e enforcement proporcional.

## Pendencias

| ID | Decisao/acao necessaria | Papel responsavel por decidir/executar | Bloqueio provocado | Etapa limite |
|---|---|---|---|---|
| AGE-01 | Definir idade minima e politica de uso por adolescentes. | Produto/Juridico; nomes TBD. | Termos e elegibilidade indefinidos; bloqueia producao/distribuicao publica. | Etapa 0, antes de producao/distribuicao publica. |
| AGE-02 | Decidir se tenant pode convidar menores e quais obrigacoes assume. | Juridico/Negocio; nomes TBD. | Contrato e onboarding nao podem orientar tenants; bloqueia clientes reais. | Etapa 0, antes de contratos/onboarding. |
| AGE-03 | Atualizar UX, termos e convites conforme a decisao. | Produto/Engenharia; owners TBD. | Convites nao aplicam a politica etaria; bloqueia convites publicos reais. | Etapa 1/4, antes de habilitar convites publicos reais. |
| AGE-04 | Atualizar incident response para titulares menores. | DPO/Juridico/Security; nomes TBD. | Resposta e comunicacao para menores ficam indefinidas; bloqueia producao que admita menores. | Etapa 0/5, antes de producao. |
