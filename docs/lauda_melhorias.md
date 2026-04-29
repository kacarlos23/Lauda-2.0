# 💡 Sugestão de Melhoria para o Lauda-2.0

## 🧪 Implementar uma Estratégia de Testes Automatizados

### 🔍 Por que esta é a prioridade?

| Situação Atual | Risco |
|---------------|-------|
| Provavelmente sem testes ou testes mínimos | Regressões silenciosas em funcionalidades críticas |
| Crescimento do SaaS com múltiplos tenants | Bugs podem afetar várias igrejas simultaneamente |
| Alterações no schema do Prisma | Migrações podem quebrar funcionalidades existentes sem aviso |
| App mobile + backend | Dificuldade de validar integrações entre as pontas |

> ✅ **Testes são o "seguro" que permite evoluir o código com confiança.**

---

## 🛠️ Como Implementar (Passo a Passo)

### 1️⃣ Backend: Jest + Supertest + Testcontainers

```bash
# Instalar dependências de teste
npm install -D jest ts-jest @types/jest supertest @types/supertest testcontainers
```

**Estrutura sugerida:**
```
src/
├── __tests__/
│   ├── unit/          # Serviços, validators
│   ├── integration/   # Rotas da API com banco real (testcontainer)
│   └── fixtures/      # Dados de teste reutilizáveis
```

**Exemplo de teste de integração (escala):**
```typescript
// __tests__/integration/schedule.test.ts
describe('POST /schedules', () => {
  it('deve criar escala apenas para TENANT_ADMIN ou MINISTRY_LEADER', async () => {
    const response = await request(app)
      .post('/schedules')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Escala Domingo', ministryId: 'xyz', date: '2026-05-01' });
    
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      title: 'Escala Domingo',
      status: 'DRAFT'
    });
  });
});
```

### 2️⃣ Mobile: React Native Testing Library + MSW

```bash
cd mobile
npm install -D @testing-library/react-native react-test-renderer msw
```

**Teste de componente de escala:**
```typescript
// mobile/src/__tests__/ScheduleCard.test.tsx
it('exibe botão "Aceitar" quando status é PENDING', () => {
  render(<ScheduleCard assignment={{ status: 'PENDING', ... }} />);
  expect(screen.getByText('Aceitar')).toBeOnTheScreen();
});
```

### 3️⃣ CI/CD: GitHub Actions para Rodar Testes Automaticamente

```yaml
# .github/workflows/test.yml
name: Run Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env: { POSTGRES_PASSWORD: test }
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run test:ci
```

---

## 📊 Benefícios Esperados

| Benefício | Impacto |
|-----------|---------|
| 🔒 Confiança para refatorar | Reduz medo de quebrar funcionalidades existentes |
| 🐛 Detecção precoce de bugs | Economia de tempo em debugging em produção |
| 📚 Documentação viva do comportamento | Novos devs entendem o sistema pelos testes |
| 🚀 Deploy mais seguro | CI bloqueia merge se testes falharem |
| 🤝 Melhor experiência para contribuidores | PRs são revisados com base em critérios objetivos |

---

## 🎯 Bônus: Outras Melhorias Complementares (em ordem de prioridade)

1. **Documentação da API com OpenAPI/Swagger** → Facilita consumo por frontend e terceiros
2. **Sistema de notificações (email/push)** → Lembretes de escala aumentam engajamento
3. **Cache com Redis** → Melhora performance em consultas frequentes (ex: lista de membros)
4. **Soft delete + audit log** → Recuperação de dados e compliance para organizações religiosas
5. **Offline-first no mobile** → Funcionalidade crítica para usuários com conexão instável

---

> 💬 **Minha recomendação final**: Comece pequeno. Escolha **uma rota crítica** (ex: `POST /schedules/assignments`), escreva 2-3 testes para ela, e use isso como padrão para as próximas funcionalidades. Testes geram valor exponencial com o tempo — o investimento inicial se paga rapidamente em manutenção evitada.