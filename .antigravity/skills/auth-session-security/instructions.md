# Skill: Authentication, Session & Token Security Audit

Esta skill guia a implementação e auditoria estrita de mecanismos de autenticação, tokens de acesso e proteção de sessão.

## 1. Auditoria de Tokens (JWT / Bearer)
- **Assinatura e Algoritmos:** A verificação de assinatura DEVE rejeitar explicitamente o algoritmo `none` e impedir ataques de confusão de chave (HMAC vs. RSA/ECDSA).
- **Validade Temporal:** Tokens de acesso (Access Tokens) devem ter vida curta (ex: 15 a 60 minutos). Verifique a presença obrigatória dos claims `exp`, `iat` e `nbf`.
- **Armazenamento:** Tokens de autenticação NUNCA devem ser gravados em `localStorage` ou `sessionStorage` no navegador (suscetíveis a furto via XSS). Devem trafegar exclusivamente em cookies `HttpOnly`, `Secure` e `SameSite=Lax` ou `Strict`.

## 2. Proteção de Cabeçalhos HTTP (Security Headers)
Toda resposta da aplicação deve conter os cabeçalhos de proteção recomendados:
- `Content-Security-Policy (CSP)`: Restrição rígida de origens de scripts, estilos e conexões.
- `X-Content-Type-Options: nosniff`: Previne sniffing de MIME-type.
- `X-Frame-Options: DENY` ou CSP `frame-ancestors 'none'`: Prevenção contra Clickjacking.
- `Strict-Transport-Security (HSTS)`: Força conexões HTTPS com subdomínios inclusos.

## 3. Gestão e Revogação de Sessões
- Logout deve invalidar o token/sessão no backend (blacklist em cache distribuído ou rotação de refresh token), não apenas apagar o cookie no cliente.
- Mecanismo contra fixação de sessão (*session fixation*): regenerar identificadores de sessão após qualquer mudança de privilégio (ex: após login bem-sucedido).