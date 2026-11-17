# Plano de instalação mobile e funcionamento offline do Lauda

Proposta de implementação · 17 de novembro de 2026

O Lauda terá a ação **Instalar Lauda** na tela inicial autenticada e no menu **Mais** do navegador mobile. No primeiro acesso, um tutorial curto percorre as abas e orienta a vincular ao perfil o instrumento ou cargo em que a pessoa poderá ser escalada. Depois de preparar os dados no dispositivo, ela poderá pesquisar, consultar, criar e editar os registros disponíveis offline. Quando a API voltar a responder, o Lauda enviará as alterações e buscará atualizações. Se houver versões divergentes de um registro, os editores autorizados receberão uma notificação que abre a tela de revisão.

## 1. Instalação no navegador e APK Android

| Canal | O que a pessoa verá | Trabalho previsto |
| --- | --- | --- |
| Navegador Android com instalação compatível | **Instalar Lauda** abre a confirmação do navegador. O Lauda ganha ícone e pode abrir em janela própria. Em dispositivos e navegadores compatíveis, a instalação usa o formato WebAPK. | Completar o manifesto com identidade estável, escopo, rota inicial e ícone adaptável. Capturar `beforeinstallprompt` no início da aplicação e compartilhar o estado entre a tela inicial e o menu **Mais**. |
| iPhone e navegadores sem confirmação automática | A ação explica como usar **Adicionar à Tela de Início** quando disponível. No iPhone, o fluxo usa o menu de compartilhamento. | Mostrar instrução conforme o navegador e ocultar a ação na instância que já roda em modo instalado. Considerar instalação cancelada e eventos ausentes sem deixar um botão inoperante. |
| APK Android assinado | **Baixar APK para Android**, como ação secundária no mesmo painel de instalação, só aparece quando existir versão disponibilizada para o público daquele ambiente. O Android solicita a confirmação da instalação. | Usar o Expo/EAS com perfil explícito de APK, API do ambiente, assinatura de release e versão crescente. Validar instalação e atualização por cima da versão anterior. Distribuir por link HTTPS controlado pelo Lauda, com versão e checksum. |

O [manifesto atual](../mobile/public/site.webmanifest) já declara ícones e `display: standalone`, e o [HTML raiz](../mobile/app/+html.tsx) já o referencia. Os pontos de entrada previstos são o [painel inicial](../mobile/app/(tabs)/index.tsx) e o [menu Mais](../mobile/app/(tabs)/more.tsx). A mesma ação pode aparecer discretamente na [tela de login](../mobile/app/(auth)/login.tsx) para permitir a instalação no primeiro acesso. A configuração Android já usa `com.lauda.app`, e o [EAS](../mobile/eas.json) já tem um perfil interno para servir de ponto de partida. Para o piloto com APK, usar identidade própria de testes para poder manter as duas instalações no aparelho.

O fluxo principal será a instalação pelo navegador, que permite distribuir atualizações web pelo próprio Lauda. O APK assinado terá seu próprio ciclo de versão e atualização. Navegador/PWA e APK nativo usam armazenamentos distintos no aparelho e trocam dados entre si pela API após sincronizar.

[Instalação de aplicações web e WebAPK](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) · [Build de APK com Expo](https://docs.expo.dev/build-reference/apk/)

## 2. Funcionalidades offline

| Área | Disponibilidade planejada |
| --- | --- |
| Repertório | Pesquisar por título e artista, filtrar pelo escopo disponível e abrir letras, cifras, tons e comentários. Criar e editar músicas e artistas com permissão. Transpor cifras localmente quando houver conteúdo salvo. |
| Escalas e Ordem de Culto | Consultar agenda, escalas, repertório vinculado, ordem, leituras, comentários e atribuições preparadas. Criar e editar escalas e ordens, alterar repertório e registrar a resposta à própria escala conforme o acesso. |
| Outras áreas do Lauda | Ampliar por módulo para consulta e operações elegíveis de ministérios, instrumentos, membros, perfil e notificações já recebidas. Usar os campos necessários a cada tela e manter as regras de visibilidade do servidor. |
| Ações dependentes de servidor ou serviços externos | Login inicial, recuperação de senha, convites, gestão de permissões, busca/importação do Cifra Club e reprodução remota exigem conexão. PDFs existentes podem ser guardados para leitura. A geração offline de relatórios será avaliada conforme os modelos e dados que puderem ser produzidos no dispositivo. |

### Como os dados chegam ao aparelho

- Após login online, a ação **Preparar para uso offline** baixa o repertório e as escalas no recorte escolhido, junto com seus registros relacionados e as permissões aplicáveis. A tela indica o período, os ministérios e as coleções preparados, além do horário da última sincronização. Dentro desse recorte, a pesquisa cobre os dados baixados mesmo que a pessoa jamais tenha aberto determinada página de resultados.
- Persistir os dados estruturados por ambiente, igreja e usuário em IndexedDB no navegador/PWA e SQLite no APK. Compartilhar consultas, regras de pesquisa e protocolo de sincronização no código comum do Expo. Reutilizar os serviços e stores atuais como pontos de integração. O [rascunho de formulário existente](../mobile/src/hooks/useFormExit.tsx) continua útil durante a digitação. **Salvar offline** grava a alteração já pronta para sincronizar.
- Fazer o service worker armazenar o HTML e os arquivos públicos essenciais do export web do Expo. Validar escopo, recarga sem rede e abertura direta de rotas. Servir o script do service worker com revalidação nos dois ambientes e versionar o cache do aplicativo. Excluir respostas autenticadas da API e páginas com dados privados do cache genérico. Atualizações do aplicativo precisam preservar o banco local e a fila.
- Gravar a mudança visível no dispositivo e sua operação pendente na mesma transação local. Exibir **Salvo neste aparelho** após a gravação e **Sincronizado** após a confirmação do servidor. Mostrar **Sem conexão**, **Alterações pendentes**, **Sincronizando** e **Revisão necessária** quando forem acionáveis. Disponibilizar **Sincronizar agora** e informar quando um registro estiver fora do recorte preparado.
- Solicitar armazenamento persistente no navegador, quando disponível, e tratar falta de espaço antes de confirmar uma gravação. Dados locais podem ser removidos pelo navegador ou pela pessoa antes de chegar ao servidor.

[Armazenamento e descarte de dados no navegador](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) · [SQLite no Expo](https://docs.expo.dev/versions/latest/sdk/sqlite/)

## 3. Sincronização

1. **Registrar a alteração.** Persistir `operationId` único, recurso, identificador, revisão de base, campos alterados e dependências. Ao criar uma música e vinculá-la a uma escala offline, sincronizar a criação antes do vínculo. A mesma operação mantém o mesmo identificador após recarga, timeout ou reinício.
2. **Reconectar e conferir o acesso.** Iniciar ao abrir ou retomar o app, no retorno de rede com o app aberto e pelo botão manual. Confirmar que a API responde e revalidar a sessão e as permissões atuais antes de enviar. Sincronização com o app fechado pode complementar o fluxo conforme a plataforma e o ciclo de autenticação. A entrega principal funciona em primeiro plano. [Compatibilidade de sincronização em segundo plano na web](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
3. **Enviar com repetição segura.** A API valida cada operação no escopo e nas permissões atuais e usa os mesmos validadores e regras dos fluxos online. Compara a revisão de forma atômica na transação que grava a mudança e o resultado vinculado ao `operationId`. Uma repetição devolve o resultado já registrado, inclusive se a resposta anterior se perdeu. Processar por registro ou grupo transacional, mantendo operações dependentes em espera e permitindo que as independentes avancem.
4. **Baixar alterações por cursor.** Fazer uma carga inicial consistente e depois buscar mudanças paginadas, com registros removidos e perda de visibilidade sinalizados. Usar cursor gerado no servidor com ordenação que preserve alterações confirmadas concorrentemente. Gravar a página e avançar o cursor na mesma transação local. Quando o cursor expirar ou o escopo mudar, reconstruir a cópia de leitura sem perder a fila, os rascunhos e os conflitos pendentes.
5. **Aplicar as versões com segurança.** Usar revisões explícitas, atualizadas também pelos fluxos online. A revisão deve cobrir alterações em vínculos de música, ordem dos itens, leituras e atribuições conforme o recurso editado. A Ordem de Culto pode alterar mais de uma escala em uma transação, então o comando deve validar todas as revisões afetadas antes de gravar. Atribuições e operações independentes podem ter versões próprias se os fluxos atuais permitirem tratá-las separadamente. Preservar alterações locais ao atualizar a cópia confirmada.

Tratar problemas de rede e indisponibilidade como tentativas recuperáveis com espera progressiva. Sessão inválida pausa o envio até a reautenticação da mesma conta. Permissão removida bloqueia a operação e revoga o acesso à cópia correspondente na revalidação. Dados inválidos ficam identificados para correção quando autorizada. A fila fica ligada à identidade original e usa um único coordenador por conta no mesmo dispositivo, inclusive entre abas. A API continua idempotente quando houver concorrência entre dispositivos.

O [cliente HTTP](../mobile/src/services/api.ts) já coordena renovação de token em memória, e o [store de autenticação](../mobile/src/store/authStore.ts) carrega a sessão e consulta `/auth/me`. A implementação precisa distinguir falha transitória de renovação de sessão realmente revogada, além de coordenar o escopo e a limpeza no logout. O acesso offline requer sessão previamente validada e preparo explícito dos dados. Definir antes do piloto o prazo de acesso sem revalidação e os campos autorizados para uso offline. Revogação remota só pode chegar ao aparelho após reconexão. Ao sair da conta, avisar sobre mudanças pendentes antes do descarte e limpar a cópia local e os rascunhos daquela conta no logout confirmado. Uma sessão expirada pode bloquear a visualização e preservar o material para retomada pela mesma conta.

## 4. Divergências e revisão pelos editores

Se a operação chegar com uma revisão anterior e produzir uma versão diferente da atual, manter a versão oficial e guardar a proposta como conflito persistente. Suportar edição concorrente, alteração sobre registro excluído e colisão de cadastro por unicidade. Quando a intenção já estiver integralmente refletida no servidor, confirmar a operação sem abrir revisão. Na primeira versão, alterações diferentes sobre o mesmo registro vão para revisão mesmo quando atingem campos distintos. Isso aumenta o número de revisões e previne combinações automáticas incompatíveis em cifras, listas ordenadas e escalas.

- Guardar os valores de base e os propostos que a edição registrou no aparelho, junto à revisão em que a pessoa começou a editar. No conflito, vincular a proposta à revisão de base informada e à revisão atual do servidor. Os valores vindos do aparelho servem para comparação. Somente a versão do servidor e os dados validados no momento da resolução podem determinar o que será publicado.
- Na mesma transação que registra o conflito, usar `enqueueDomainEvent` para alimentar a [fila de eventos existente](../src/events/domainEvents.ts). Criar um tipo de notificação para revisão e reutilizar o sino, a caixa de entrada e o WebSocket. No APK, usar o push existente quando estiver habilitado. Identificar conflito e destinatário para que uma tentativa repetida gere um único aviso por editor.
- Avisar o autor, quando ainda tiver acesso, e os editores ativos com permissão efetiva sobre aquele registro dentro da igreja. Para escalas, a seleção respeita o ministério e as regras de edição e atribuição. Para músicas, respeita o escopo e as permissões do catálogo. Conferir acesso ao projetar ou listar o aviso e novamente ao abrir a revisão. O conteúdo do aviso fica genérico e o link aponta para o conflito.
- Mostrar, conforme a permissão vigente, a versão de base, a versão atual e a proposta offline com os campos alterados. Oferecer **Manter versão atual**, **Aplicar proposta** e **Combinar alterações** quando aplicável. Registro excluído exige ação explícita para recriar, com as permissões correspondentes. Registrar responsável, decisão, data e revisões. Antes de concluir, conferir que a versão atual e o conflito seguem nas revisões revisadas. Se outro editor tiver alterado o registro ou resolvido o conflito, recarregar a revisão antes de permitir nova aplicação.
- Marcar a notificação como lida independentemente do estado do conflito. Manter **Revisões pendentes** acessível mesmo quando o aviso já tiver sido lido ou expirar. Centralizar o destino usado pelo [sino](../mobile/src/components/NotificationBell.tsx), pelo [aviso na tela](../mobile/src/components/NotificationToast.tsx) e pela abertura via push, que hoje atendem fluxos de escala.

Exemplo de aceite. Um editor muda o tom e a cifra de uma música no ensaio sem internet. Outra pessoa edita a mesma música pela web. Na reconexão, o Lauda conserva a versão publicada, guarda a proposta do ensaio e avisa os editores da música. Um editor compara as versões, aplica a decisão e o resultado chega aos dois aparelhos na próxima sincronização.

## 5. Tutorial de primeiro acesso

Abrir o tutorial após o primeiro login bem-sucedido, com a tela **Início** e as permissões já carregadas. Destacar uma aba real por vez, com uma frase sobre o que a pessoa pode fazer ali. Oferecer **Voltar**, **Avançar** e **Pular tutorial**. O mesmo roteiro usa o menu lateral em telas largas e apresenta os atalhos que a pessoa pode acessar, conforme o [manifesto de navegação](../mobile/src/navigation/manifest.ts).

| Aba | O que mostrar |
| --- | --- |
| Início | Veja sua próxima escala e os atalhos disponíveis. |
| Escalas | Consulte as escalas e, quando estiver escalado, confirme ou recuse sua participação. |
| Ministérios | Consulte seus ministérios e acompanhe as equipes às quais tem acesso. |
| Músicas | Pesquise o repertório e abra as cifras. |
| Mais | Acesse seu perfil e os demais atalhos disponíveis para sua conta. |

Encerrar com o passo **Vincule seu instrumento ou cargo**. Exibir a instrução “Para ser escalado em uma função, vincule ao seu perfil o instrumento ou cargo correspondente.” O botão **Vincular instrumento ou cargo** abre direto a seção **Instrumentos/cargos** do [Meu perfil](../mobile/app/(tabs)/profile.tsx), também acessível em **Mais → Perfil → Instrumentos/cargos**. Ali, a pessoa toca em **Selecionar** e marca um ou mais itens do catálogo da igreja. O vínculo é confirmado quando o servidor salva a seleção. O [serviço de escalas](../src/services/scheduleService.ts) já verifica se a função escolhida na atribuição consta no perfil.

- Se a pessoa já tiver um vínculo confirmado, mostrar os itens vinculados e permitir concluir o tutorial. Se o instrumento ou cargo estiver ausente do catálogo, orientar a pedir o cadastro a um administrador ou oferecer **Criar e selecionar** a quem já tem essa permissão.
- Registrar conclusão ou dispensa por usuário e igreja, com retomada no mesmo aparelho se interrompido e compartilhamento do estado entre instalações após a sincronização. Oferecer **Rever tutorial** em **Mais**. Se o tutorial for pulado sem vínculo confirmado, mostrar um lembrete discreto em **Início** quando estiver confirmado que o perfil está sem instrumentos ou cargos. Uma seleção pendente de sincronização deve aparecer como pendente até a confirmação da API.
- Validar com contas de membro e de gestão, perfis com e sem vínculo e igreja com catálogo vazio. Confirmar que a pessoa encontra a seção certa, consegue voltar ou pular, pode rever o tutorial e que a atribuição da função fica disponível quando o vínculo está confirmado e as demais regras da escala são atendidas.

## 6. Sequência de entrega e validação

| Etapa | Entrega e critério de aceite |
| --- | --- |
| 1. Instalação e primeiro acesso | Botões no painel inicial e em **Mais**, manifesto atualizado, aplicativo web abrindo sem rede após a preparação dos arquivos públicos e APK assinado em testes. Validar instalação, cancelamento e abertura pelo ícone em Android físico. Validar instruções e abertura pelo ícone em iPhone físico. Conferir atualização do APK e do service worker. Entregar o tutorial das abas e o atalho de vínculo no Perfil como um fluxo que também funciona no navegador comum. |
| 2. Leitura e pesquisa | Preparação de dados por escopo, pesquisa local de títulos e artistas, cifras, escalas e ordens de culto. Em modo avião e após encerrar o app, reabrir e encontrar registros baixados que ainda não tinham sido acessados. Testar recorte parcial e troca de conta no aparelho. |
| 3. Escrita e revisão | Implementar primeiro músicas, depois escalas e Ordem de Culto com os vínculos e as permissões correspondentes. Testar em dois aparelhos, com perda de conexão após o servidor gravar, várias alterações no mesmo registro, conflito com exclusão, sessão expirada e perda de permissão. Confirmar aplicação única, preservação das versões, aviso único por editor elegível e resolução concorrente sem sobrescrita. |
| 4. Cobertura e piloto | Estender às operações elegíveis dos demais módulos, incluindo notificações já baixadas. Medir duração da preparação, volume local, idade das pendências, falhas e conflitos sem registrar conteúdo de cifras ou comentários em logs. Definir a cobertura para cada módulo pelo resultado do piloto e pelas regras de acesso. |

Antes de expor a escrita offline, fazer migration compatível com os clientes online existentes, preparar candidatos separados e executar a validação no ambiente de testes pelo [publicador do Lauda](../PUBLISHER.md). Usar o ambiente também para testar atualização e reversão preservando pendências, além do fluxo atual de edição com rede. Liberar leitura e escrita progressivamente, preservando a capacidade de consultar pendências e conflitos ao suspender novas operações offline. Publicação em produção exige autorização específica.

## 7. Mapa de implementação por entrega

Base da proposta técnica `main` em `e4027c2`. A base já tem a migration de leituras da Ordem de Culto e o filtro de temas do catálogo. Os nomes abaixo identificam os pontos de integração e os novos módulos propostos.

### Instalação web e APK

| Arquivos | Alteração |
| --- | --- |
| `mobile/public/site.webmanifest`, `mobile/public/icons/`, `mobile/app/+html.tsx` | Definir `id`, `start_url` e `scope` estáveis na raiz da origem, incluir ícone maskable e manter ícones de compatibilidade. O destino passa pelo roteamento de sessão existente. |
| `mobile/src/features/install/`, `mobile/app/_layout.tsx` | Registrar o estado de instalação web antes da renderização das telas. Tratar `beforeinstallprompt`, `appinstalled` e modo standalone. Expor a mesma ação e o mesmo estado ao painel e ao menu. O módulo nativo retorna interface vazia para a ação web. |
| `mobile/app/(tabs)/index.tsx`, `mobile/app/(tabs)/more.tsx`, `mobile/app/(auth)/login.tsx` | Reutilizar um componente de instalação com o botão no início e no menu. Na tela de login, usar a mesma ação compacta para permitir instalar antes de autenticar. O painel de instalação oferece o APK quando anunciado pelo ambiente. |
| `mobile/scripts/build-service-worker.cjs`, `mobile/public/`, `mobile/package.json` | Após a exportação, gerar o inventário versionado dos arquivos estáticos e o service worker no diretório de saída candidato, antes de preparar o manifesto de release. Guardar em cache apenas recursos do aplicativo. Instalação incompleta conserva o worker ativo. Aplicar navegação offline sobre o shell público validado com as rotas dinâmicas do Expo Router. Preservar os recursos usados por páginas já abertas durante a transição de versão. |
| `scripts/serve-transfer-staging.cjs`, configuração do servidor estático de produção e regras do Cloudflare | Servir o script como JavaScript na raiz com `Cache-Control: no-cache`. Verificar que o fallback HTML não intercepta a rota do worker e que `/api`, requisições autenticadas e downloads privados passam direto pela rede. Validar cabeçalhos na origem pública dos dois ambientes. |
| `mobile/eas.json`, `mobile/app.config.js`, `mobile/src/services/apiBaseUrl.ts` | Adicionar perfis Android assinados para testes e produção com `android.buildType: apk` e origem de API explícita. Fazer o pacote de testes coexistir com `com.lauda.app`. Publicar metadados do arquivo assinado junto ao frontend do ambiente correspondente. Validar versão, assinatura, checksum e atualização no Android físico. |

### Tutorial e cadastro no perfil

| Arquivos | Alteração |
| --- | --- |
| `mobile/src/features/onboarding/`, `mobile/app/(tabs)/_layout.tsx` | Montar o tutorial após resolver usuário, igreja e rota inicial. Usar `navigationItemsFor` e os componentes existentes de navegação. Renderizar um passo por aba, com foco e estado de progresso acessíveis. Quando a tela não comportar o destaque, usar o mesmo texto em um cartão com a ação para abrir a aba. Controlar retomada e saída sem impedir a navegação normal. |
| `mobile/src/navigation/routes.ts`, `mobile/app/(tabs)/profile.tsx`, `mobile/src/services/instrumentService.ts` | Dar ao Perfil um parâmetro tipado para abrir a seção `instruments`, preservando a abertura normal. Reutilizar a seleção atual e `updateMyInstruments`. Considerar o vínculo concluído apenas após confirmar o retorno do servidor e atualizar a sessão. |
| `mobile/app/(tabs)/index.tsx`, `mobile/app/(tabs)/more.tsx` | Ler o estado já carregado do perfil para mostrar o lembrete quando faltar vínculo. Permitir rever o tutorial em **Mais**, independentemente da conclusão. |
| `prisma/schema.prisma`, `src/routes/memberRoutes.ts`, controlador de perfil | Persistir o estado por igreja, usuário e versão do tutorial, com leitura e atualização idempotente no perfil da própria conta. Mapear `not_started`, `dismissed` e `completed`, com `completed` prevalecendo em atualizações concorrentes. Guardar o passo atual no aparelho. Para o rollout, iniciar automaticamente em novas contas e oferecer **Rever tutorial** às contas existentes. |

### Dados offline no cliente

| Arquivos | Alteração |
| --- | --- |
| `mobile/src/features/offline/contracts.ts`, `database.web.ts`, `database.native.ts` | Definir um contrato de armazenamento transacional com migrações por versão. Implementar no IndexedDB e no SQLite. Organizar coleções por `environment + tenantId + userId` e indexar identificador, título normalizado, artista, tema, ministério e data conforme a entidade. Persistir `records`, `pendingOperations`, `drafts`, `conflictRefs` e `syncState`. |
| `mobile/src/features/offline/syncService.ts`, `syncCoordinator.ts` | Consumir a API de sincronização e coordenar um envio por perfil. Usar exclusão mútua entre abas na web, comunicação de mudanças de estado e idempotência no servidor. No nativo, usar estado de foco do app e sinal de conectividade. Confirmar a API antes do primeiro envio e usar backoff após falhas recuperáveis. |
| `mobile/src/store/musicStore.ts`, `scheduleStore.ts`, `mobile/src/services/musicService.ts`, `scheduleService.ts`, `worshipOrderService.ts` | Adaptar leitura e pesquisa a partir dos dados locais preparados, inclusive paginação e filtros de tema. Usar os fluxos online durante a introdução. Ao ativar a escrita offline de um recurso, passar a salvar por meio da fila com o mesmo identificador da operação, também quando a rede estiver disponível. Só exibir **Salvo neste aparelho** após o commit local. |
| `mobile/src/services/api.ts`, `mobile/src/store/authStore.ts`, `mobile/src/services/formDraftStorage.ts`, `mobile/app/_layout.tsx` | Identificar indisponibilidade, sessão definitivamente inválida e falta de acesso. Restaurar cópia da conta autorizada, limpar dados da conta no logout confirmado e atualizar escopo antes de sincronizar. Concentrar avisos de preparo, fila e sincronização em um ponto de entrada no app. |

Começar com as coleções `Song`, `Artist`, referências de temas e ministérios, `Schedule`, repertório e atribuições visíveis, `WorshipOrder` e dados necessários a suas leituras. O preparo aceita catálogo autorizado, ministérios e intervalo de datas. A interface informa o recorte e a última sincronização. Expansões para instrumentos, membros, perfil, ministérios e caixa local de notificações recebem contratos e filtros próprios após a validação do piloto. Conteúdo sensível só entra nos campos acordados para uso offline. As operações externas dependentes de conexão continuam conforme a tabela da seção 2.

## 8. Contratos de sincronização e consistência

| Rota proposta | Requisição e resposta |
| --- | --- |
| `POST /api/sync/bootstrap` | Recebe coleções, ministérios e período, todos sujeitos à permissão do usuário. Devolve escopo aprovado, página de registros e um cursor opaco com limite de leitura e versão do escopo. |
| `GET /api/sync/changes?cursor=…` | Devolve `upsert` ou `remove` por registro, `nextCursor` e `hasMore`. Cursor expirado, incompatível ou de escopo alterado devolve instrução para refazer a carga com a mesma conta. IDs de outros usuários, igrejas e escopos ficam inacessíveis. |
| `POST /api/sync/operations` | Recebe lote limitado de operações de domínio com `operationId`, tipo e ID do recurso, revisões de base, alterações e dependências. Devolve estado por operação, revisões confirmadas e, em caso de divergência, `conflictId` autorizado. Reutilizar `operationId` com outro conteúdo dá erro de validação. |
| `GET /api/sync/conflicts` e `GET /api/sync/conflicts/:id` | Listam e carregam os conflitos no escopo visível à pessoa, incluindo estados e campos que ela pode consultar. Revisões ficam disponíveis aos editores autorizados mesmo após a notificação expirar. |
| `POST /api/sync/conflicts/:id/resolve` | Recebe `resolutionId`, revisão do conflito, revisões atuais e decisão `keep_current`, `apply_proposal` ou `apply_merge`. Revalida acesso e conteúdo. Nova alteração concorrente exige recarregar. A resolução também tem repetição segura. |

Tipos indicativos para organizar o cliente e a API. Cada comando terá seu próprio schema de validação e campos permitidos, reaproveitando os validadores de domínio.

```ts
type Revision = string;

type SyncOperation = {
  operationId: string;
  dependsOn: string[];
  baseRevisions: Record<string, Revision>;
  command: SongCommand | ScheduleCommand | WorshipOrderCommand;
};

type SyncResult =
  | { status: 'applied'; operationId: string; revisions: Record<string, Revision> }
  | { status: 'conflict'; operationId: string; conflictId: string }
  | { status: 'blocked'; operationId: string; code: 'permission' | 'dependency' }
  | { status: 'invalid'; operationId: string; code: string }
  | { status: 'retry'; operationId: string };
```

### API e persistência

- Criar `src/routes/syncRoutes.ts`, `src/controllers/SyncController.ts`, `src/validators/sync.schema.ts` e `src/services/sync/`. Montar o roteador em `src/app.ts` com a autenticação e o escopo de igreja existentes. Tratar o lote como invólucro para operações independentes. A Ordem de Culto, seus vínculos e as escalas que ela altera usam uma única transação de domínio.
- Acrescentar revisões em registros editáveis e tabelas propostas `SyncTenantCursor`, `SyncChange`, `SyncOperationReceipt` e `SyncConflict`. Indexar mudanças por `(tenantId, sequence)` e recibos por `(tenantId, userId, operationId)`. Vincular conflito ao recibo único e registrar estado, revisões, proposta, autor e decisão. Capturar snapshots mínimos para comparar campos e condicioná-los às permissões vigentes.
- Na primeira implementação, usar um contador do PostgreSQL por igreja com bloqueio de linha tomado no início da transação de escrita sincronizável. A atualização dos registros, a revisão, os eventos de mudança e o avanço do contador confirmam juntos. Assim, o cursor lido nunca passa por uma mudança ainda em transação. Fixar uma ordem de bloqueio nos serviços que gravam múltiplos recursos. Medir contenção com edição e importação simultâneas antes do piloto.
- Fazer os caminhos online usarem a mesma lógica transacional e os mesmos validadores. Levantar `songService`, `songTransferService`, `artistService`, `scheduleService`, `ScheduleRepository`, `WorshipOrderRepository` e ações administrativas que alterem escopo, relacionamentos ou registros preparados. Avançar a revisão em cada caminho que altere a coleção, inclusive importações, vínculos, exclusões e mudanças indiretas. Registrar remoções com identificador e revisão. Recálculo de escopo elimina cópias que perderam visibilidade.
- No bootstrap, fixar a marca global inicial e usar paginação estável por ID. Consultar somente registros com revisão até a marca aprovada. Qualquer criação, edição ou exclusão posterior aparece nas páginas de delta depois da marca. Aplicar bootstrap a uma geração local nova, prosseguir com os deltas e promover a geração em transação. Manter fila e rascunhos durante o processo. Se a versão do escopo mudar durante a carga, descartar a geração parcial e recomeçar.

### Sequência ao receber uma edição

1. Autorizar usuário, igreja, alvo, tipo de comando e campos. Determinar as dependências confirmadas e calcular um hash do comando validado. Um recibo anterior só devolve informação ainda autorizada ao mesmo usuário, com a mesma chave e conteúdo.
2. Dentro da transação, bloquear o contador do tenant e reservar ou encontrar o recibo, ler o agregado atual e comparar as revisões de base. Quando o conteúdo já for equivalente, confirmar como aplicado. Quando a revisão bater, executar a mesma regra de domínio da edição online, gravar a nova versão, registrar o delta e gravar o recibo. Criar registros offline com UUID válido e verificar escopo e unicidade no servidor.
3. Se houver divergência, salvar o conflito e seu recibo, sem aplicar a edição, e gravar o evento de notificação na mesma transação. Dependências daquele comando continuam aguardando. Timeout após o commit pode ser repetido com o mesmo `operationId`. Um resultado transitório permite a próxima tentativa com a mesma chave. Uma correção do conteúdo gera nova operação.
4. Ao receber o resultado, atualizar a cópia local confirmada, preservar edições mais recentes e retirar do envio somente o que o servidor confirmou ou registrou como conflito. Alterações feitas no mesmo registro enquanto a anterior está em envio ficam como dependentes. Atualizar automaticamente a base apenas quando a alteração anterior foi confirmada e os campos seguintes continuam com os valores esperados. Havendo nova divergência, submeter à revisão.
5. Na resolução, verificar a revisão comparada e o estado aberto do conflito junto com a transação da decisão. Se aplicada, gravar a versão e o delta pelo mesmo serviço de domínio. Guardar estado final e histórico mesmo quando a resolução mantém a versão publicada. Reavaliar as alterações locais dependentes com base no resultado. Exigir revisão quando a intenção ainda divergir.

### Notificações e tela de revisão

- Ampliar `NotificationType`, `src/events/domainEvents.ts` e `src/services/notificationService.ts` com o evento de revisão. Usar `resourceType` voltado a conflito e o ID como destino. Selecionar editores através de `permissionService` e das regras existentes por recurso. Verificar novamente a elegibilidade na entrega e no acesso à revisão. Reutilizar unicidade por `eventId + userId` e a recuperação pela API. O aviso carrega texto genérico e o ID do conflito.
- Atualizar `mobile/src/types/index.ts`, `NotificationBell.tsx`, `NotificationToast.tsx` e `NotificationRuntime.tsx` para resolver o destino de maneira compartilhada. Adicionar listagem e detalhe sob `mobile/app/(tabs)/` com navegação pelo sino e por **Revisões pendentes**. Mostrar diferenças por campo, usando linhas de cifra e posição de itens da escala para facilitar a comparação. Dar feedback de revisão desatualizada e atualizar a tela com a versão vigente.
- Registrar métricas de fila, conflitos e reenvios sem payloads pessoais. Alinhar retenção do histórico, validade de cursores, validade do acesso offline e janela de repetição dos recibos. Preservar idempotência para operações pendentes: se um recibo for descartado após a janela de suporte, rejeitar replay antigo e pedir reconciliação autenticada. Configurar limites com dados do piloto, sem remover pendências locais em caso de janela vencida.

## 9. Ordem dos commits de implementação e evidência de aceite

| Ordem | Mudança revisável | Evidência |
| --- | --- | --- |
| 1 | Instalação PWA, distribuição do APK de testes e tutorial, com integração de Perfil e seleção de instrumentos/cargos | Testes de componentes e navegação. Android físico confirma instalação via navegador e atualização do APK assinado. iPhone físico valida o fluxo de tela de início. Testar tutorial pulado, retomado e revisto, catálogo vazio e atribuição com vínculo confirmado. |
| 2 | Migrations aditivas, registro de revisões nos caminhos existentes, projeções de bootstrap e deltas | Integração com PostgreSQL real para ordem de commit concorrente, alterações durante bootstrap, exclusões, mudança de permissões e isolamento entre igrejas. Regressão de importação, edição online, escalas e Ordem de Culto. |
| 3 | Armazenamento local e preparo de leitura de repertório, escalas e Ordem de Culto | Playwright com Chromium offline, recarga de rota direta, troca de conta e atualização do worker. Android físico com APK reiniciado em modo avião. Comparar pesquisa, recorte de datas e filtros sobre dados baixados com a API. |
| 4 | Escrita offline para músicas, fila por dispositivo e revisão integrada às notificações | Integração e E2E com dois clientes, perda da resposta após commit, abas concorrentes, sessão expirada, edição conflitante, colisão por unicidade, editor com permissão revogada e resolução após nova revisão concorrente. |
| 5 | Escrita de escalas e Ordem de Culto, incluindo dependências e extensão gradual aos demais módulos | Em dois aparelhos, validar vínculo de nova música à escala, leituras e ordenação, alteração atômica em dois períodos, atribuições, registro removido e reconciliação após período prolongado offline. |

Usar o publicador de testes com frontend e API candidatos, habilitando leitura antes de escrita. Para reversão, suspender novas operações offline e manter leitura de pendências e conflitos enquanto houver clientes com fila. Conservar migrations aditivas e compatibilidade do contrato durante a transição. Testar explicitamente o tratamento de uma atualização de frontend com pendências no dispositivo. Operações e notificações de revisão só aparecem no ambiente habilitado e nos perfis autorizados.
