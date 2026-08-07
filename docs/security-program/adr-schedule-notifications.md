# ADR — Notificações de escala com outbox, Redis, WebSocket e Expo Push

Data: 2026-08-04  
Status: aceito para implementação; ativação externa condicionada aos gates de infraestrutura e privacidade

## Contexto

Alterações em escalas precisam chegar aos membros em primeiro e segundo plano sem transformar Redis ou o serviço de push em fonte de verdade. A gravação da escala e o registro da intenção de notificar não podem divergir, e uma indisponibilidade temporária de tempo real não pode apagar o histórico recuperável pelo aplicativo.

## Decisão

- PostgreSQL mantém `DomainEventOutbox`, `Notification`, `PushDevice` e `PushDelivery`.
- Toda mutação instrumentada registra um evento no outbox na mesma transação da mudança de domínio.
- O dispatcher oferece entrega pelo menos uma vez, projeta uma notificação única por `eventId + userId`, usa retentativa exponencial e registra o último erro.
- Redis Pub/Sub faz somente fan-out entre instâncias. Em desenvolvimento sem Redis, um barramento em memória atende uma única instância.
- O servidor HTTP existente recebe o WebSocket em `/api/realtime`. A conexão usa um ticket opaco de uso único e curta duração, emitido após autenticação REST e ligado à sessão ativa.
- PostgreSQL é usado para recuperar notificações perdidas. O cliente deduplica por `notification.id`, reconecta com backoff e atualiza os dados da escala afetada.
- Expo Push atende Android/iOS em segundo plano. O payload visível é genérico e os dados silenciosos contêm somente IDs e tipos técnicos. A web usa apenas WebSocket e caixa persistente.
- Notificações expiram em 90 dias. A leitura da notificação não altera a resposta da atribuição.
- `REALTIME_ENABLED` e `PUSH_NOTIFICATIONS_ENABLED` permitem ativação independente.

## Alternativas avaliadas

- Publicar diretamente depois do `commit`: rejeitado porque uma falha entre o commit e o envio perde a notificação.
- Usar Redis Streams ou uma fila externa como fonte durável: adiado; acrescentaria operação e fornecedor sem necessidade para o volume atual.
- Polling como único mecanismo: mantido apenas como recuperação; isoladamente pioraria latência e custo.
- Web Push via Expo: descartado porque o Expo Notifications não oferece esse canal. A versão web permanece com WebSocket e inbox.
- Push com detalhes da escala: rejeitado por exposição na tela bloqueada e por minimização de dados.

## Modo degradado

- Redis indisponível: a instância continua com fan-out local; em múltiplas instâncias o cliente recupera perdas pela API.
- WebSocket indisponível: badge e histórico são recuperados por `GET /api/notifications` ao abrir/retomar o app.
- Expo indisponível ou push desativado: as notificações persistentes continuam sendo criadas.
- Dispatcher interrompido: eventos permanecem no outbox e voltam a ser processados após recuperação.

## Consequências operacionais

Produção multi-instância exige Redis com TLS, autenticação e rede restrita. Expo/EAS, FCM v1 e APNs exigem credenciais fora do repositório e revisão de fornecedor/privacidade. Backlog, tentativas, falhas, latência e conexões devem ser coletados pelo provider de observabilidade aprovado.
