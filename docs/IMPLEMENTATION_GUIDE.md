# Guia de Implementação & Roadmap Técnico | Lauda 2.0

> **Documento vivo** para alinhamento de equipe, planejamento de sprints e garantia de aderência à arquitetura definida em `system_design.md`, `implementation_plan.md` e `lauda_melhorias.md`.

---

## 1. Estado Atual vs. Meta Final

| Componente | Status | Meta |
|------------|--------|------|
| Schema Prisma | OK Validado | Mantido imutável até migrações explícitas |
| Estrutura de Camadas | OK Criada | Rigoroso `routes -> controllers -> services -> repositories` |
| Auth JWT | Parcial | Flow completo (Access + Refresh + SecureStore) |
| Isolamento Multi-Tenant | Pendente | Prisma Extension + Middleware de injeção de `tenantId` |
| Testes Automatizados | Ausentes | Jest/Supertest (backend) + RNTL/MSW (mobile) + CI/CD |
| Validação Zod | Parcial Estrutura pronta | 100% das rotas POST/PUT validadas |
| Mobile Base | OK Expo Router + Zustand | Telas, interceptors, sync offline |

---

## 2. Fase 1: Fundação Crítica *(Não pular esta fase)*

> **Regra de Ouro:** Nenhuma feature nova entra sem que os itens abaixo estejam concluídos e testados. Conforme `lauda_melhorias.md`, testes são o "seguro" do SaaS.

### 2.1 Isolamento Multi-Tenant
- [ ] Implementar `src/middlewares/auth.ts`: decodifica JWT, valida expiração, injeta `req.user = { id, email, role, tenantId }`
- [ ] Criar `src/config/prisma.ts` com `PrismaClient.$extends`:
  - Filtra automaticamente `find`, `update`, `delete` por `tenantId`
  - **Não** injeta em `create` (o `tenantId` deve vir explicitamente do service/controller)
- [ ] Teste de segurança: usuário do `tenant-A` tenta acessar `GET /ministries` -> retorna `403` ou lista vazia

### 2.2 Estratégia de Testes & CI/CD
- [ ] Backend: `Jest + Supertest + Testcontainers (PostgreSQL)`
- [ ] Mobile: `React Native Testing Library + MSW`
- [ ] Estrutura: `__tests__/unit/`, `__tests__/integration/`, `__tests__/fixtures/`
- [ ] GitHub Actions: `.github/workflows/test.yml` rodando `npm run test:ci` em `push/PR`
- [ ] Cobertura mínima inicial: 70% nas rotas `auth`, `ministries`, `schedules`

### 2.3 Validação & Tratamento de Erros
- [ ] Schemas Zod para todas as entidades (`Ministry`, `User`, `Schedule`, `Song`)
- [ ] Middleware global de erros (`src/middlewares/errorHandler.ts`): padroniza respostas `{ error, code, details }`
- [ ] Classes de erro customizadas (`AppError`, `ValidationError`, `ForbiddenError`)

---

## 3. Fase 2: Funcionalidades MVP (Backend + Mobile)

> **Padrão obrigatório:** `Route -> Controller -> Service -> Repository -> Prisma`
> **Segurança:** Todos os endpoints exigem `authenticate` middleware + validação RBAC no service.

| Feature | Endpoint | Responsável | Critério de Aceite |
|---------|----------|-------------|-------------------|
| **CRUD Ministérios** | `POST /ministries`<br>`GET /ministries` | Backend | Criação só por `TENANT_ADMIN`/`GLOBAL_ADMIN`. Lista filtrada por tenant. |
| **Vincular Membros** | `POST /ministries/:id/members`<br>`DELETE /ministries/:id/members/:userId` | Backend | `MINISTRY_LEADER` só gerencia seu ministério. `@@unique([userId, ministryId])` respeitado. |
| **Escalas** | `POST /schedules`<br>`GET /schedules?ministryId=&dateFrom=&dateTo=` | Backend | `date` em ISO, `ministryId` válido, `status: DRAFT` por padrão. |
| **Atribuições** | `POST /schedules/:id/assignments`<br>`PATCH /assignments/:id/status` | Backend | `role` (ex: "Guitarrista"), `status: PENDING`. Usuário só vê suas atribuições. |
| **Repertório** | `POST /songs`<br>`POST /ministries/:id/songs` | Backend | `bpm` opcional, vinculação `MinistrySong` com `@@unique`. |
| **Mobile Auth** | Login/Logout/Refresh | Mobile | SecureStore, refresh silencioso, redirect em 401 persistente. |
| **Mobile Telas** | Ministros, Escalas, Perfil | Mobile | Tabs baseadas em `role`, loading states, empty states tratados. |

---

## 4. Fase 3: Integração Mobile (React Native + Expo)

### 4.1 Arquitetura de Comúnicação
```bash
mobile/src/services/api.ts
|-- Instância Axios base
|-- Interceptor request: injeta Access Token do SecureStore
|-- Interceptor response:
|   |-- 401 -> chama refreshAccessToken() -> retry da req original
|   `-- refresh falha -> limpa SecureStore -> navega para /login
`-- Timeout: 10s | baseURL: process.env.EXPO_PUBLIC_API_URL
```

### 4.2 Estado Global (Zustand)
```bash
mobile/src/store/
|-- authStore.ts      # token, user, role, tenantId, login(), logout()
|-- ministryStore.ts  # lista de ministérios, loading, fetch()
|-- scheduleStore.ts  # escalas do usuário, status PENDING/ACCEPTED
`-- uiStore.ts        # theme, loading global, snackbars
```

### 4.3 Navegação & Permissões
- `app/(auth)/login.tsx` -> `app/(tabs)/_layout.tsx`
- Tabs condicionais: `Admin`, `Ministries`, `Schedules`, `Profile` (exibidas conforme `role`)
- `RoleGuard` component: bloqueia acesso a rotas não autorizadas

---

## 5. Fase 4: Pós-MVP & Escala (Conforme `lauda_melhorias.md`)

| Melhoria | Impacto | Esforço | Quando implementar |
|----------|---------|---------|-------------------|
| OpenAPI/Swagger Automático | Médio | Baixo | Após Fase 2 (documentação viva para frontend) |
| Notificações (Push/Email) | Alto | Médio | Quando escalas forem usadas em produção |
| Cache Redis (listas frequentes) | Médio | Médio | Quando `GET /schedules` ou `GET /members` > 500ms |
| Soft Delete + Audit Log | Alto | Médio | Antes de abrir para múltiplos tenants reais |
| Offline-First Mobile | Alto | Alto | Após validação de fluxo online estável |

---

## 6. Matriz de Permissões (RBAC)

| Ação | `GLOBAL_ADMIN` | `TENANT_ADMIN` | `MINISTRY_LEADER` | `MEMBER` |
|------|----------------|----------------|-------------------|----------|
| Criar Igreja/Tenant | Sim | Não | Não | Não |
| Gerenciar Ministérios da Igreja | Sim | Sim | Não | Não |
| Adicionar/Remover Membros do Ministério | Sim | Sim | Sim (só seu) | Não |
| Criar/Editar Escalas | Sim | Sim | Sim (só seu) | Não |
| Ver/Aceitar/Recusar Atribuições | Sim | Sim | Sim | Sim (só suas) |
| Gerenciar Repertório | Sim | Sim | Sim (só seu) | Não |

> **Implementação:** Verificação de `role` deve ocorrer **no Service**, nunca no Controller. Use: `if (!allowedRoles.includes(user.role)) throw new ForbiddenError(...)`

---

## 7. Padrões de Código Obrigatórios

| Regra | Exemplo | Motivo |
|-------|---------|--------|
| `tenantId` nunca vem do `req.body` em `create` | `service.create({ ...data, tenantId: req.user.tenantId })` | Previne injeção maliciosa de dados cross-tenant |
| Zod em todos os inputs | `const validated = CreateMinistrySchema.parse(req.body)` | Fail-fast, tipos seguros, mensagens claras |
| Repositories só falam com Prisma | `return prisma.ministry.findMany(...)` | Camadas limpas, fácil mocking em testes |
| Services contêm regras puras | `if (date < now) throw new ValidationError(...)` | Reutilizável, testável sem HTTP |
| Controllers só orquestram | `try { const res = await service... } catch(e) { handleError(e) }` | Separation of concerns |
| JSDoc em funções públicas | `/** @param {User} user @returns {Ministry} */` | Autocompletar, docs automáticas, onboarding |

---

## 8. Como Usar Este Guia

1. **Planejamento de Sprint:** Copie as tabelas da Fase 2/3 para o board do projeto. Marque `status` conforme progresso.
2. **Code Review:** Use a seção `7. Padrões de Código` como checklist obrigatório em todo PR.
3. **Validação de Entrega:** Só considere uma feature "pronta" quando:
   - OK Passa nos testes de integração
   - OK Retorna `400/403/401` conforme esperado para inputs inválidos
   - OK Filtra dados por `tenantId` corretamente
   - OK Mobile exibe loading/error states adequados
4. **Atualização:** Mantenha este arquivo no repositório (`docs/IMPLEMENTATION_GUIDE.md`) e atualize a cada milestone concluída.

---

> **Próximo passo imediato:**
> Execute a **Fase 1** (Tenant Isolation + Testes Base + Zod + CI/CD).  
> Só então inicie `POST /ministries` e `POST /ministries/:id/members`.  
> Use o prompt otimizado fornecido anteriormente para gerar os scaffolds com as skills do repositório Antigravity.
