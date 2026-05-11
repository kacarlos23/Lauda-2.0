# Implementação da Recuperação de Senha

Este documento descreve a abordagem técnica para implementar o fluxo de "Esqueci minha senha" (Forgot Password) na plataforma Lauda 2.0.

## User Review Required

> [!IMPORTANT]
> O envio de e-mails reais exige integração com serviços como Resend, SendGrid ou AWS SES. Como atualmente o projeto não possui uma dependência de envio de e-mails listada no `package.json`, o envio do código de recuperação será **simulado através de logs no console do backend**. Confirme se esta abordagem simulada é suficiente para esta etapa ou se devemos instalar e configurar um serviço real de envio de e-mails.
>
> Além disso, no fluxo mobile (Expo), a abordagem mais robusta sem lidar com deep links complexos é gerar um **código PIN de 6 dígitos** (ex: 123456) ao invés de um link. O usuário preenche o e-mail, recebe o PIN, e na próxima tela preenche o PIN e a nova senha. Confirme se essa abordagem está alinhada com a UX desejada.

## Open Questions

- Você tem preferência por algum provedor de e-mail (ex: NodeMailer com SMTP próprio, Resend, SendGrid) caso queiramos implementar o envio real agora?

## Proposed Changes

---

### Database Schema (Prisma)

Atualização do modelo `User` para suportar o armazenamento seguro de tokens de recuperação temporários.

#### [MODIFY] [schema.prisma](file:///c:/Users/092687/Documents/Dev/SaaS/Lauda%202.0/prisma/schema.prisma)
- Adicionar campo `resetPasswordToken String?`
- Adicionar campo `resetPasswordExpires DateTime?`

---

### Backend (Node.js/Express)

Implementação das rotas, validações e lógicas de serviço para gerar e validar o código de recuperação.

#### [NEW] [auth.schema.ts](file:///c:/Users/092687/Documents/Dev/SaaS/Lauda%202.0/src/validators/auth.schema.ts) (Modification)
- Adicionar `forgotPasswordSchema` (valida email).
- Adicionar `resetPasswordSchema` (valida email, token/pin, nova senha).

#### [MODIFY] [authRepository.ts](file:///c:/Users/092687/Documents/Dev/SaaS/Lauda%202.0/src/repositories/authRepository.ts)
- Adicionar método `savePasswordResetToken(userId, token, expiry)`.
- Adicionar método `updatePassword(userId, newHashedPassword)`.

#### [MODIFY] [authService.ts](file:///c:/Users/092687/Documents/Dev/SaaS/Lauda%202.0/src/services/authService.ts)
- Criar método `requestPasswordReset(email)`: Gera um PIN seguro de 6 dígitos, salva no banco com validade de 15 a 30 minutos e simula o envio por e-mail (console.log).
- Criar método `resetPassword(email, token, newPassword)`: Verifica se o PIN existe, se não está expirado, atualiza a senha (usando `bcrypt`) e limpa os campos de reset.

#### [MODIFY] [AuthController.ts](file:///c:/Users/092687/Documents/Dev/SaaS/Lauda%202.0/src/controllers/AuthController.ts)
- Adicionar método `forgotPassword(req, res)`.
- Adicionar método `resetPassword(req, res)`.

#### [MODIFY] [auth.routes.ts](file:///c:/Users/092687/Documents/Dev/SaaS/Lauda%202.0/src/routes/auth.routes.ts)
- Expor a rota `POST /api/auth/forgot-password`.
- Expor a rota `POST /api/auth/reset-password`.

---

### Frontend Mobile (Expo / React Native)

Criação das telas de recuperação de senha e integração com os novos endpoints da API.

#### [MODIFY] [login.tsx](file:///c:/Users/092687/Documents/Dev/SaaS/Lauda%202.0/mobile/app/(auth)/login.tsx)
- Adicionar o botão "Esqueci minha senha" abaixo do formulário de login, redirecionando para a nova tela.

#### [NEW] [forgot-password.tsx](file:///c:/Users/092687/Documents/Dev/SaaS/Lauda%202.0/mobile/app/(auth)/forgot-password.tsx)
- Tela para o usuário inserir seu e-mail registrado.
- Botão "Enviar código de recuperação".
- Ao obter sucesso (200 OK), redireciona o usuário para a tela `reset-password.tsx` passando o e-mail como parâmetro.

#### [NEW] [reset-password.tsx](file:///c:/Users/092687/Documents/Dev/SaaS/Lauda%202.0/mobile/app/(auth)/reset-password.tsx)
- Tela contendo três campos:
  - O Código recebido por e-mail (PIN).
  - A nova senha.
  - Confirmação da nova senha.
- Após o reset com sucesso, redirecionar de volta para a tela de Login com uma mensagem de sucesso.

## Verification Plan

### Automated Tests
- Criar teste de integração backend para solicitar o reset e para atualizar a senha com sucesso, verificando erros quando o token expira ou é inválido.

### Manual Verification
- Rodar migração do Prisma (`npx prisma migrate dev`).
- Testar a tela `forgot-password.tsx` digitando um e-mail válido.
- Pegar o PIN de 6 dígitos gerado no console do backend.
- Preencher a tela `reset-password.tsx` e validar se a troca de senha afeta o próximo login no aplicativo.
