```markdown
# 🎯 Contexto do Projeto | Lauda-2.0

Você é um engenheiro full-stack sênior especializado em SaaS multi-tenant com React Native + Node.js.

**Objetivo imediato:** Implementar a camada mobile para o CRUD de Ministérios, conectando-se ao backend já existente.

## 📦 Stack & Arquitetura

| Camada | Tecnologias |
|--------|------------|
| **Backend** | Node.js + Express 5 + TypeScript + Prisma + Zod |
| **Mobile** | React Native + Expo Router + Zustand + Axios + SecureStore |
| **Auth** | JWT duplo (Access 15min + Refresh 7d) com renovação silenciosa |
| **Multi-tenant** | Isolamento lógico via `tenantId` injetado no Prisma + RBAC |

## 🗂️ Estrutura de Pastas (Mobile)

mobile/
├── app/(tabs)/
│   ├── ministries/
│   │   ├── index.tsx          # [TO-DO] Lista de ministérios
│   │   └── [id].tsx           # [TO-DO] Detalhes + membros + ações
│   └── _layout.tsx            # [EXISTENTE] Tabs navigation
├── src/
│   ├── services/
│   │   ├── api.ts             # [EXISTENTE] Axios com interceptors
│   │   └── ministryApi.ts     # [TO-DO] Chamadas específicas /ministries
│   ├── store/
│   │   ├── authStore.ts       # [EXISTENTE] Zustand auth + SecureStore
│   │   └── ministryStore.ts   # [TO-DO] Estado reativo de ministérios
│   ├── components/
│   │   └── BottomSheet.tsx    # [OPTIONAL] Componente reutilizável
│   ├── types/
│   │   └── index.ts           # [TO-DO] Tipagem TypeScript compartilhada
│   └── theme.ts               # [EXISTENTE] Design system com cores


## 🔐 Regras de Negócio Críticas (NÃO IGNORE)

1. **Tenant Isolation**: Todas as requisições devem enviar o Access Token no header. O backend filtra automaticamente por `tenantId` — nunca confie no frontend para isso.
2. **RBAC Visual**: 
   - Botão "Criar Ministério" → visível APENAS se `user.role === 'TENANT_ADMIN' || 'GLOBAL_ADMIN'`
   - Botão "Adicionar Membro" → visível APENAS se `isAdmin || (user é líder DO ministério)`
   - Ações de editar/excluir → mesmas regras acima
3. **Estados de UI**: Implementar loading skeletons, empty states e snackbars de erro com mensagens do backend (`errorHandler` retorna `{ error, code, details }`).

---

# 🛠️ Tarefas de Execução (Ordem Obrigatória)

## 🔹 Tarefa 1: Tipagem Compartilhada (`mobile/src/types/index.ts`)
**Skill:** `@modern-javascript-patterns`

> Defina interfaces TypeScript para `Ministry`, `MinistryMember` e `User` alinhadas ao schema Prisma.

```typescript
// Exemplo de saída esperada:
export interface Ministry {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  createdAt: string; // ISO datetime
  _count?: { members: number }; // Prisma include
}

export interface MinistryMember {
  id: string;
  userId: string;
  user: Pick<User, 'id' | 'name' | 'email'>;
  ministryId: string;
  isLeader: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'GLOBAL_ADMIN' | 'TENANT_ADMIN' | 'MINISTRY_LEADER' | 'MEMBER';
  tenantId: string;
}
```

---

## 🔹 Tarefa 2: Camada de API (`mobile/src/services/ministryApi.ts`)
**Skill:** `@react-best-practices` + `@native-data-fetching`

> Crie um módulo com funções tipadas para todas as rotas de ministérios, usando a instância Axios configurada.

```typescript
// Rotas obrigatórias:
// GET /ministries
// GET /ministries/:id (incluir members via ?include=members)
// POST /ministries
// PUT /ministries/:id
// DELETE /ministries/:id
// POST /ministries/:id/members
// DELETE /ministries/:id/members/:userId

// Requisitos:
// - Usar a instância `api` já configurada com interceptors de auth
// - Tipar requests/responses com as interfaces de types/index.ts
// - Lançar erros com mensagem legível para o usuário final
```

---

## 🔹 Tarefa 3: Estado Global (`mobile/src/store/ministryStore.ts`)
**Skill:** `@senior-frontend` + `@react-best-practices`

> Implemente um Zustand store reativo para gerenciar ministérios com loading, error e ações assíncronas.

```typescript
// Métodos obrigatórios:
- fetchMinistries(): Promise<void>          // GET /ministries
- fetchMinistry(id: string): Promise<void>  // GET /ministries/:id + members
- createMinistry(data): Promise<void>       // POST + refresh da lista
- updateMinistry(id, data): Promise<void>   // PUT + refresh
- deleteMinistry(id: string): Promise<void> // DELETE + refresh
- addMember(ministryId, userId, isLeader): Promise<void>
- removeMember(ministryId, userId): Promise<void>

// Estados:
- ministries: Ministry[]
- currentMinistry: Ministry | null
- loading: boolean
- error: string | null

// Requisitos:
- Usar `useAuthStore` para acessar `user` e `tenantId` quando necessário
- Tratar erros chamando `setError()` com mensagem legível
- Atualizar a lista localmente após create/update/delete para UX responsiva
```

---

## 🔹 Tarefa 4: Tela de Listagem (`mobile/app/(tabs)/ministries/index.tsx`)
**Skill:** `@frontend-design` + `@mobile-design`

> Construa uma lista elegante de cards com FlatList, skeletons, empty state e FAB condicional.

```tsx
// Requisitos de UI:
- Card por ministério: nome, descrição (truncada), contagem de membros
- Skeleton loading enquanto busca dados
- Empty state com ilustração + mensagem amigável + CTA para admin criar
- FAB (botão flutuante) "+" visível APENAS para TENANT_ADMIN/GLOBAL_ADMIN
- Toque no card → navega para `/ministries/[id]`
- Pull-to-refresh para recarregar lista
- Snackbar de erro se `ministryStore.error` não for null

// Design:
- Usar cores de `theme.ts` (primary, background, surface, text)
- Bordas arredondadas, sombra sutil, padding consistente
- Micro-animação: fade-in ao carregar lista (react-native-reanimated opcional)
```

---

## 🔹 Tarefa 5: Tela de Detalhes (`mobile/app/(tabs)/ministries/[id].tsx`)
**Skill:** `@frontend-design` + `@auth-implementation-patterns`

> Exiba detalhes do ministério + lista de membros + ações condicionais por RBAC.

```tsx
// Seções da tela:
1. Header: Nome do ministério + descrição + botões de ação (editar/excluir)
2. Lista de membros: avatar/nome + badge "👑 Líder" se `isLeader`
3. FAB "Adicionar Membro" (visível apenas para isAdmin || isMinistryLeader)

// Comportamentos:
- Fetch de `ministry + members` ao montar (usar `useFocusEffect` do Expo Router)
- Botão editar → abre BottomSheet com formulário pré-preenchido
- Botão excluir → modal de confirmação → chama `deleteMinistry` → volta para lista
- Toque em membro → (futuro) abre perfil ou opções de gestão
- Badge de líder com cor diferenciada (ex: dourado do theme.ts)

// RBAC Visual:
- isAdmin: vê todos os botões de gestão
- isMinistryLeader (deste ministério): vê "Adicionar Membro" e editar membros
- MEMBER: vê apenas lista (read-only)
```

---

## 🔹 Tarefa 6: Componente BottomSheet (Opcional, mas Recomendado)
**Skill:** `@minimalist-ui` + `@frontend-design`

> Crie um componente reutilizável para formulários deslizantes (criar ministério, buscar membros).

```tsx
// Props esperadas:
- isOpen: boolean
- onClose: () => void
- title: string
- children: React.ReactNode
- footer?: React.ReactNode (botões de ação)

// Comportamento:
- Desliza de baixo para cima com backdrop semi-transparente
- Fecha ao tocar no backdrop ou arrastar para baixo
- Animação suave (300ms ease-out)
- Acessível: focus trap, aria-labels, suporte a escape key (web)

// Uso exemplo:
<BottomSheet isOpen={showCreate} onClose={() => setShowCreate(false)} title="Novo Ministério">
  <FormMinistry onSubmit={handleCreate} />
</BottomSheet>
```

---

# 🧪 Critérios de Aceite (Validação Obrigatória)

```markdown
## Funcional
- [ ] `GET /ministries` retorna lista filtrada por tenant (validar com 2 usuários de tenants diferentes)
- [ ] `POST /ministries` cria com `tenantId` correto e retorna 201
- [ ] FAB "Criar" aparece APENAS para TENANT_ADMIN/GLOBAL_ADMIN
- [ ] Badge "👑" aparece corretamente para `isLeader: true`
- [ ] Snackbar exibe erro do backend com mensagem legível (não "Internal Server Error")

## UX/UI
- [ ] Skeleton loading visível enquanto busca dados
- [ ] Empty state com CTA amigável quando lista está vazia
- [ ] Cores e tipografia seguem `theme.ts`
- [ ] Toque em card navega corretamente para detalhes
- [ ] Pull-to-refresh funciona e mostra indicador visual

## Qualidade de Código
- [ ] Todas as funções têm JSDoc com @param e @returns
- [ ] Tipagem TypeScript estrita (sem `any`)
- [ ] Componentes extraídos quando > 50 linhas
- [ ] Tratamento de erro centralizado (não `try/catch` espalhado)
- [ ] Comentários explicam "porquê", não "o quê"
```

---

# 🔄 Formato da Resposta Esperada

Para **cada tarefa**, forneça:

1. 📄 **Código completo** do arquivo (pronto para copiar/colar)
2. 🧪 **Exemplo de uso** ou teste manual para validar
3. ⚠️ **Armadilhas comuns** e como evitá-las (ex: race condition no refresh)
4. 🔗 **Referência** a docs oficiais quando relevante (Expo Router, Zustand, etc.)

> 💡 **Priorize clareza e segurança sobre otimização prematura.** Se uma decisão de arquitetura for ambígua, explique as opções e recomende uma com justificativa.

---

# 🚀 Dica de Execução

Execute **uma tarefa por vez** e valide antes de avançar:

```bash
# Após Tarefa 1+2+3:
npm run android  # ou ios
# Validar: lista carrega, loading aparece, erro é tratado

# Após Tarefa 4:
# Validar: FAB condicional, navegação para detalhes, pull-to-refresh

# Após Tarefa 5:
# Validar: RBAC visual, badge de líder, ações de editar/excluir
```
