# Skill: Database Reliability, Indexing & Query Optimization

Esta skill rege a modelagem de dados, estratégias de indexação e performance de consultas em bancos relacionais (PostgreSQL/Supabase).

## 1. Estratégias de Indexação
- **Foreign Keys:** Toda chave estrangeira usada em filtros (`WHERE`) ou junções (`JOIN`) DEVE possuir índice explícito.
- **Consultas Compostas:** Se uma query frequente filtra por `tenant_id` e ordena por `created_at`, crie um índice composto: `CREATE INDEX ON tabela (tenant_id, created_at DESC)`.
- **Busca Textual:** Para buscas por aproximação ou tags, utilize índices GIN/Trigram em vez de `ILIKE '%termo%'` com full table scan.

## 2. Eliminação de Gargalos Clássicos
- **Problema N+1:** Proibido disparar queries dentro de laços (`loops/maps`). Agrupe buscas com `WHERE id IN (...)`, utilize junções (`JOIN`) estruturadas ou Dataloaders.
- **Seleção de Colunas:** Nunca utilize `SELECT *` em endpoints de produção. Selecione explicitamente apenas as colunas necessárias para diminuir overhead de rede e memória.

## 3. Migrações Seguras (Zero-Downtime)
- Adicionar colunas com valor padrão (`DEFAULT`) e restrição `NOT NULL` em tabelas grandes deve ser feito de forma não-bloqueante.
- Índices em produção devem ser criados com concorrência (`CREATE INDEX CONCURRENTLY`) para evitar bloqueio de escrita na tabela.