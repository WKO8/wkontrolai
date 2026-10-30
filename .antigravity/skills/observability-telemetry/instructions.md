# Skill: Structured Logging, Tracing & Application Observability

Esta skill dita os padrões para instrumentação de telemetria, captura de erros e auditoria de runtime.

## 1. Logs Estruturados (JSON Only)
- Proibido usar `console.log("deu erro no id " + id)` em produção.
- Todos os logs devem ser emitidos no formato JSON estruturado com metadados padronizados:
  ```json
  {
    "timestamp": "2026-10-23T17:05:00Z",
    "level": "error",
    "event": "PAYMENT_PROCESSING_FAILED",
    "trace_id": "req-987abc",
    "tenant_id": "org_123",
    "error_code": "GATEWAY_TIMEOUT",
    "duration_ms": 1240
  }

- **Privacidade (PII Sanitization)**: Filtre e mascare dados sensíveis (senhas, CPFs, números de cartão e tokens) antes de persistir ou emitir logs.

## 2. Correlation & Trace IDs
- Toda requisição HTTP recebida deve ter ou herdar um identificador único de rastreamento (x-trace-id ou x-request-id).

- O Trace ID deve propagar para todas as chamadas de banco, serviços assíncronos e logs de erro correlacionados.

## 3. Endpoints de Saúde (Health Checks)
- A aplicação deve expor rotas dedicadas:

  - /api/health/live: Retorna status 200 simples indicando que o processo está de pé.

  - /api/health/ready: Valida conectividade real com dependências críticas (banco de dados, cache Redis) antes de receber tráfego de produção.