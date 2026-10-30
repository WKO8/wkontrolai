# Skill: API Resilience & Error Handling

Esta skill estabelece os padrões inegociáveis para construção de APIs, Server Actions e manipuladores de rotas resilientes.

## 1. Idempotência e Concorrência
- Operações de mutação crítica (pagamentos, transações, disparos de webhooks, criação de pedidos) DEVEM aceitar ou gerar um `Idempotency-Key`.
- Nunca execute operações em banco de dados que alterem múltiplos registros sem blocos de transação explícitos (rollback automático em falha).
- Use controle de concorrência otimista (ex.: conferir coluna de `version` ou `updated_at`) para evitar que updates simultâneos sobrescrevam dados silenciosamente.

## 2. Padrão Canônico de Resposta
Toda resposta de endpoint de mutação ou consulta complexa deve seguir uma estrutura padronizada:
- Respostas de Sucesso:
  ```json
  {
    "success": true,
    "data": { ... },
    "meta": { "page": 1, "hasMore": false } // se aplicável
  }

- Respostas de Erro:
  ```json
  {
    "success": false,
    "error": {
      "code": "RESOURCE_NOT_FOUND",
      "message": "Mensagem amigável para a interface",
      "details": [] // erros de campo/validação detalhados (ex: do Zod)
    }
  }

## 3. Códigos de Status HTTP Semânticos
- 200: Sucesso com retorno de dados.
- 201: Recurso criado com sucesso.
- 400: Payload malformado ou rejeitado pelo schema de validação.
- 401: Usuário não autenticado (sessão ausente ou expirada).
- 403: Usuário autenticado, mas sem permissão de acesso ao recurso (RBAC/Tenancy).
- 404: Recurso não encontrado.
- 409: Conflito de estado ou violação de unicidade (ex: email já cadastrado).
- 429: Rate limit atingido.
- 500: Erro interno inesperado (NUNCA expor stack trace ao cliente).

## 4. Paginação e Limites
- Proibido expor consultas que retornem coleções inteiras sem paginação.
- Prefira paginação por cursor (cursor-based pagination) para dados em tempo real ou feeds longos.
- Se usar paginação por offset/limit, estipule um teto rígido (ex: limit máximo de 50 ou 100 itens).