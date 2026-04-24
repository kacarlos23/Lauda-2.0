# Design do Sistema: SaaS Multi-Tenant para Gerenciamento de Ministérios

## 1. Resumo do Entendimento
*   **Modelo de Negócio:** SaaS B2B Multi-Tenant (uma única aplicação servindo múltiplas igrejas).
*   **Escopo do MVP:** Cadastro/diretório de membros/voluntários E gestão de ministérios (escalas de cultos e repertório de músicas).
*   **Hierarquia e Controle de Acesso (RBAC):**
    1.  **Admin Global:** Acesso absoluto a todo o SaaS (CRUD geral de todas as igrejas).
    2.  **Líder da Igreja (Tenant Admin):** Gerencia exclusivamente sua própria igreja, distribuindo permissões para níveis inferiores.
    3.  **Líder de Ministério:** Gerencia apenas o seu departamento (escalas, músicas e a equipe de voluntários do seu ministério).
    4.  **Voluntários/Membros:** Visibilidade restrita; apenas visualizam as escalas e funções para as quais foram designados (Read-only do próprio contexto).

## 2. Premissas Assumidas
*   **Escala e Tráfego:** Projetado para milhares de usuários. Arquitetura robusta em Node.js com TypeScript.
*   **Segurança de Sessão:** JWT (SecureStore no mobile, HttpOnly Cookies/Session no Web).

## 3. Log de Decisões (Decision Log)

### 3.1 Stack do Backend
*   **Decisão:** Backend construído em **Node.js, Express, TypeScript, Prisma ORM e Zod**, seguindo estritamente a arquitetura limpa em camadas (routes, controllers, services, repositories).
*   **Motivo da Escolha:** Alta velocidade de desenvolvimento, forte tipagem end-to-end com TypeScript e segurança de validação via Zod. Total aderência ao ecossistema moderno de microsserviços/APIs.

### 3.2 Estratégia de Banco de Dados Multi-Tenant (Prisma)
*   **Decisão:** Isolamento Lógico (Row-level via `tenantId`).
*   **Motivo da Escolha:** O Prisma lida excelentemente com o isolamento lógico usando Extensões de Cliente (Client Extensions) ou Middlewares que injetam automaticamente a condição `where: { tenantId }` em todas as queries. Evita a complexidade extrema e os problemas de connection pool que múltiplos schemas do Postgres trariam no Prisma.

### 3.3 Gerenciador de Estado no Frontend
*   **Decisão Escolhida:** Zustand.
*   **Motivo da Escolha:** O Zustand evita renders desnecessários em listas pesadas e requer significativamente menos código boilerplate do que a Context API.

## 4. Design Final (Arquitetura)

### 4.1 Backend (Node.js + Express + Prisma)
*   **Arquitetura de Camadas Obrigatória:** 
    *   `Routes`: Apenas roteamento. Nenhuma regra de negócio.
    *   `Controllers`: Parse da request, chamada aos serviços e formatação de resposta. Herdam de um `BaseController`.
    *   `Services`: Contêm as regras de negócio puras (Injeção de dependências).
    *   `Repositories`: Única camada autorizada a fazer chamadas diretas ao banco de dados usando o `PrismaClient`.
*   **Validação:** Zod usado para validar todos os dados de entrada (body, query, params).
*   **Tratamento de Erros:** Middleware central de erros para capturar todas as exceções e garantir respostas consistentes.

### 4.2 Frontend (React Native + Expo)
*   **Roteamento:** Expo Router.
*   **Comunicação com a API:** Instância do Axios com Interceptors injetando o JWT salvo no SecureStore. Tratamento automático de erro 401.
*   **Interface Adaptativa:** O estado global no Zustand armazenará a `Role` do usuário logado. Funcionalidades e abas de administração só serão visíveis se o usuário tiver a permissão adequada.
