# Implementar CRUD de Ministérios no Mobile

Este plano detalha a implementação da camada mobile para o CRUD de Ministérios do Lauda 2.0, baseando-se no documento `lauda_melhorias.md`.

## Open Questions
- A tipagem `AuthUser` atual em `types/index.ts` não possui `tenantId`. A nova interface `User` pede `tenantId`. Posso estender `AuthUser` ou criar uma nova interface `User` para atender à necessidade?
- Posso usar a biblioteca `lucide-react-native` (já instalada) para os ícones e botões de ação e `react-native-reanimated` se já estiver disponível, senão usarei animações padrão do React Native?

## Proposed Changes

### Types
Serão adicionados/atualizados os tipos necessários.

#### [MODIFY] [index.ts](file:///c:/Users/092687/Documents/Dev/SaaS/Lauda%202.0/mobile/src/types/index.ts)
- Adicionar interface `MinistryMember`.
- Adicionar/Atualizar a interface `User` contendo as propriedades solicitadas, incluindo `tenantId`.

---
### API Layer
Criação do serviço de chamadas HTTP.

#### [NEW] [ministryApi.ts](file:///c:/Users/092687/Documents/Dev/SaaS/Lauda%202.0/mobile/src/services/ministryApi.ts)
- Implementar as funções de requisição (GET, POST, PUT, DELETE) usando a instância do Axios `api`.
- Definir parâmetros e retorno tipados de acordo com os types acima.

---
### Global State
Criação do state manager para os ministérios.

#### [NEW] [ministryStore.ts](file:///c:/Users/092687/Documents/Dev/SaaS/Lauda%202.0/mobile/src/store/ministryStore.ts)
- Configurar store Zustand com loading, error, array `ministries` e objeto `currentMinistry`.
- Implementar os métodos assíncronos (`fetchMinistries`, `fetchMinistry`, `createMinistry`, `updateMinistry`, `deleteMinistry`, `addMember`, `removeMember`) encapsulando `ministryApi` e tratando erros.

---
### UI Components & Screens
As telas e o componente BottomSheet.

#### [NEW] [BottomSheet.tsx](file:///c:/Users/092687/Documents/Dev/SaaS/Lauda%202.0/mobile/src/components/BottomSheet.tsx)
- Criar o Modal usando a API do React Native com animações para surgir por baixo, servindo como base para os forms de criação e edição.

#### [NEW] [index.tsx](file:///c:/Users/092687/Documents/Dev/SaaS/Lauda%202.0/mobile/app/%28tabs%29/ministries/index.tsx)
- Tela de listagem com FlatList, suporte a Pull-to-refresh, Empty State e Skeletons.
- Validação de regras RBAC para exibir ou não o botão Floating Action Button (FAB) de adicionar ministério.

#### [NEW] [[id].tsx](file:///c:/Users/092687/Documents/Dev/SaaS/Lauda%202.0/mobile/app/%28tabs%29/ministries/[id].tsx)
- Tela de detalhes do Ministério, mostrando Header, Lista de Membros e o BottomSheet para edição ou adição de membros.
- Validações de RBAC locais (se é líder do ministério ou admin) para disponibilizar ações.

## Verification Plan

### Manual Verification
- Fazer login com 2 contas de tenants diferentes para confirmar o Tenant Isolation.
- Acessar a tela com usuário `TENANT_ADMIN` e confirmar presença de todos botões CRUD.
- Acessar a tela com usuário `MEMBER` e confirmar a não existência dos botões.
- Acessar a tela com usuário marcado como `isLeader: true` de um ministério para atestar que os botões do ministério correspondente estão ativos e exibe a label "Líder".
