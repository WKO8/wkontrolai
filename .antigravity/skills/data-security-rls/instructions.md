# Skill: Multi-Tenant Data Isolation & Row Level Security (RLS)

Esta skill define as regras de arquitetura e implementação para garantir que nenhum usuário ou tenant acesse dados de terceiros.

## 1. Princípio do Multi-Tenancy Rígido
- Toda tabela de negócio no banco de dados DEVE conter uma coluna de isolamento clara (`tenant_id`, `organization_id` ou `user_id`).
- Nunca confie que o frontend enviará o ID correto no corpo da requisição. O ID do usuário/organização deve ser extraído EXCLUSIVAMENTE do token de sessão autenticado no servidor.

## 2. Políticas de Row Level Security (RLS)
- O RLS deve estar ativado por padrão em TODAS as tabelas:
  ```sql
  ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;

- Crie políticas explícitas e separadas para cada operação:
 - FOR SELECT: Apenas se tenant_id = auth.current_tenant_id() ou user_id = auth.uid().
 - FOR INSERT: Com WITH CHECK garantindo que o novo registro pertença ao tenant da sessão ativa.
 - FOR UPDATE: Garantindo que registros de outros tenants não possam ser modificados via brute-force de IDs.
 - FOR DELETE: Restrito a roles administrativas do próprio tenant.

## 3. Prevenção de Injeção e Sanitização
- Nenhuma query dinâmica pode ser montada via concatenação direta de strings. Use sempre consultas parametrizadas ou queries geradas por Query Builders/ORMs tipados.

- Campos que aceitam formatação rica (HTML ou Markdown) devem passar obrigatoriamente por sanitização contra XSS (ex: DOMPurify ou sanitizadores de servidor) antes de persistir ou renderizar.