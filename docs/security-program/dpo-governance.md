# Governanca do Encarregado v1

Versao: 1.0
Data: 2026-07-16
Status: modelo inicial; encarregado e processo formal pendentes
Aprovadores: Direcao/Juridico TBD; Encarregado TBD; Engenharia TBD
Proxima revisao: 2026-08-16

## Principio

A governanca do encarregado e separada da classificacao controlador/operador. Nomear um encarregado nao decide quem e controlador ou operador por operacao; essa decisao fica no ADR de controlador/operador e na ROPA.

## Responsabilidades propostas

| Area | Responsabilidade do encarregado/DPO |
|---|---|
| Titulares | Receber, registrar e coordenar respostas a solicitacoes de titulares. |
| Autoridade | Atuar como ponto de contato quando aplicavel. |
| Orientacao interna | Orientar Data Owners, System Owners e suporte sobre privacidade. |
| Monitoramento | Acompanhar Data Map, ROPA, retention, vendor review e incident response. |
| Incidentes | Participar da avaliacao de T0, risco, comunicacao e pos-incidente. |
| Treinamento | Definir conteudo minimo para administradores/suporte com acesso a dados. |
| Conflito de interesses | Escalar decisoes quando o owner operacional tiver conflito com privacidade. |

## Processo minimo

| Processo | Requisito |
|---|---|
| Nomeacao | Registrar nome, contato, substituto, escopo e independencia. |
| Canal | Publicar canal para titulares/tenants; canal deve funcionar fora do app. |
| SLA interno | Definir triagem, resposta, escalonamento e evidencias. |
| Registro | Manter log de solicitacoes, decisoes, prazos, dados envolvidos e resposta. |
| Acesso | DPO nao recebe acesso irrestrito por padrao; acesso a dados deve seguir necessidade e registro. |
| Revisao | Revisao trimestral de pendencias de privacidade e incidentes. |

## Interface com outros artefatos

| Artefato | Papel do encarregado |
|---|---|
| Data Map/ROPA | Revisar completude, titulares, finalidades, compartilhamentos e pendencias juridicas. |
| ADR idade | Validar decisao sobre menores e criterio de acesso provavel. |
| ADR controlador/operador | Revisar coerencia com contratos e comunicacoes. |
| Vendor Register | Validar subprocessadores, regioes, DPA e notificacao. |
| Retention Matrix | Revisar prazos, legal hold, purge e direitos. |
| Incident Response | Participar de T0, risco a titulares e comunicacoes. |
| Access Review | Revisar acessos de suporte/admin quando envolver dados pessoais. |

## Pendencias

| ID | Decisao/acao necessaria | Papel responsavel por decidir/executar | Bloqueio provocado | Etapa limite |
|---|---|---|---|---|
| DPO-01 | Decidir se havera encarregado interno, externo ou funcao equivalente. | Direcao/Juridico; nomes TBD. | Governanca e accountable de privacidade ficam indefinidos; bloqueia dados reais. | Etapa 0, antes de producao com dados reais. |
| DPO-02 | Publicar canal e substituto. | Direcao/DPO; nomes TBD. | Titulares/tenants ficam sem canal resiliente; bloqueia onboarding real. | Etapa 0, antes de onboarding real. |
| DPO-03 | Criar registro de solicitacoes de titulares e procedimento operacional. | DPO/Juridico/Operacao; nomes TBD. | Direitos nao podem ser atendidos com evidencia; bloqueia producao. | Etapa 0 para procedimento; Etapa 4 para implementacao, antes de producao. |
| DPO-04 | Definir envolvimento do DPO em incidentes e T0. | DPO/Juridico/Security; nomes TBD. | Tabletop e comunicacao de incidentes ficam incompletos; bloqueia prontidao operacional. | Etapa 0, antes do tabletop e da producao. |
