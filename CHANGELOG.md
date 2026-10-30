# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/spec/v2.0.0.html) (Versionamento Semântico 2.0.0).

---

## [1.2.0] - 2026-10-30

### Added
- **Licenciamento GNU Affero General Public License v3 (AGPL-3.0):**
  - Criação do arquivo [`LICENSE`](LICENSE) na raiz do projeto com os termos completos da AGPL-3.0 (copyright WKontrolAI Authors 2026).
  - Atualização dos badges de licença no [`README.md`](README.md).
- **Guia de Contribuição Open Source (`CONTRIBUTING.md`):**
  - Documentação da arquitetura limpa em camadas (Next.js 15, Drizzle ORM, PostgreSQL, Redis, BullMQ).
  - Passo a passo de setup local detalhado (`pnpm install`, `docker compose up -d`, `pnpm db:push`, `pnpm db:seed`, `pnpm dev`).
  - Guia de execução de testes com Vitest (`pnpm test`, `pnpm test:watch`).
  - Convenção de Conventional Commits (`feat`, `fix`, `docs`, etc.).
  - Políticas de governança de código e termos de submissão sob a licença AGPLv3.
- **Script e Passo Canônico de Seed de Demonstração:**
  - Inclusão do passo `pnpm db:seed` no Guia de Setup e Desenvolvimento Local do README e CONTRIBUTING para população instantânea do banco com dados de demonstração.

### Changed
- **Sanitização de Domínios Privados e Variáveis de Ambiente:**
  - Substituição de referências a domínios privados por placeholders genéricos (`app.exemplo.com`, `wa.exemplo.com`, `nao-responda@seudominio.com`) no template `.env.example` e na documentação.
  - Inclusão explícita das variáveis `EVOLUTION_BOT_PHONE` e `NEXT_PUBLIC_BOT_PHONE` no `.env.example`.
  - Remoção de links relativos para diretórios internos isolados (`.plans/`), mantendo links neutros e âncoras internas no README.

---

## [1.1.0] - 2026-10-25

### Added
- **Confirmação e Cancelamento Multimodal de Pendências via Áudio no WhatsApp:**
  - Suporte completo para responder a confirmações pendentes de despesas gravando áudios de voz no WhatsApp.
  - O pipeline transcreve o áudio via Groq Cloud Whisper (< 400ms) antes de acionar o avaliador de pendências, permitindo que comandos como *"Sim, pode salvar"* ou *"Cancela o segundo item"* sejam processados diretamente a partir de notas de voz.
- **Suporte a Botões Interativos Nativos & Prompt Híbrido com Fallback Autossuficiente:**
  - Envio de botões interativos WhatsApp via Evolution API (`btn_confirm`, `btn_edit`, `btn_cancel`) para confirmação em 1 toque.
  - Prompt híbrido resiliente com opções numéricas claras (`[1] Confirmar`, `[2] Editar / Ajustar`, `[3] Cancelar`), garantindo total usabilidade mesmo em clientes WhatsApp sem suporte a botões interativos nativos.
  - Regexes ultra-rápidos (`FAST_CONFIRM_REGEX` e `FAST_CANCEL_REGEX`) expandidos para suportar `btn_confirm`, `btn_cancel`, `1` e `3` com zero chamadas externas de IA.
- **Edição Conversacional e Remoção Seletiva de Itens Pré-Confirmação:**
  - Possibilidade de editar valores, categorias e métodos de pagamento ou remover itens específicos de despesas pendentes via mensagens de texto ou áudio (ex: *"tira a cerveja"*, *"troca o almoço para 45 no pix"*).
  - Schema Zod `parsedConfirmationIntentSchema` expandido com `removeItemIndex` e `userConfirmationPatchSchema` para atualização atômica do cache de confirmação pendente.
- **Rotas Canônicas de Edição e Exclusão (`PATCH` e `DELETE` em `/api/transactions`):**
  - Implementação de `PATCH /api/transactions` com validação de esquema `updateTransactionSchema` para alteração granular de campos (descrição, valor, data, categoria, forma de pagamento).
  - Implementação de `DELETE /api/transactions` para exclusão de lançamentos.
  - Registro de auditoria imutável na tabela `audit_logs` (`TRANSACTION_EDITED` e `TRANSACTION_DELETED`).
- **Assistente Financeiro Conversacional RAG Local (`POST /api/ai/chat`):**
  - Novo endpoint ancorado estritamente nas transações históricas do tenant autenticado via DeepSeek V3.
  - Capacidade de responder dúvidas sobre fluxo de caixa, maiores centros de custo, projeções de gastos e comparações entre períodos.
  - Rate limiting atômico de 30 requisições/min por workspace via Redis (`ratelimit:ai_chat:${tenantId}`).
- **Redesenho SPA do Dashboard em 3 Telas Especializadas:**
  - **Métricas:** Painel executivo com KPIs consolidados (`Saldo Atual`, `Receitas`, `Despesas`), gráfico de fluxo mensal comparativo, Donut interativo de categorias, gráfico de tendência diária e ranking de meios de pagamento.
  - **Extrato:** Histórico completo com filtros avançados (período `last-90-days`, `all` ou mensal, tipos `EXPENSE`/`INCOME`, categorias, formas de pagamento e busca textual), paginação, modal de edição e exclusão com confirmação.
  - **Insights & IA:** Diagnósticos preditivos com alertas de consumo, simulador "Antes vs Depois" de economia acumulada (projeções mensal e anual), padrões temporais de gastos, chatbot financeiro integrado e exportação de relatório PDF A4 com diagramação CSS Print sem consumo de memória no servidor.
- **Agente Especialista `TechResearcher` Registrado:**
  - Integração do agente dedicado [.antigravity/agents/tech-researcher.md](file:///.antigravity/agents/tech-researcher.md) para investigação de APIs, protocolos de mensageria e benchmarks de IA.
- **Expansão da Suíte de Testes Automatizados (132 Testes Aprovados - 100%):**
  - Criação de `tests/transactions-routes.test.ts` (15 testes) cobrindo `PATCH`, `DELETE`, proteção anti-IDOR, trilhas de auditoria e RAG Chat.
  - Atualização de `tests/api-routes.test.ts` (25 testes), `tests/validations.test.ts` (35 testes), `tests/e164.test.ts` (17 testes), `tests/ai-parsers.test.ts` (22 testes) e `tests/idempotency.test.ts` (18 testes).
  - Homologação oficial no relatório [.plans/QA_REPORT.md](file:///.plans/QA_REPORT.md) (`[QA_RESULT: PASSED]`).

### Security
- **Proteção Anti-IDOR com Escopo Duplo em Mutações (VULN-09):**
  - Exigência mandatória de identificação do workspace (`tenantId` ou telefone pareado) em `PATCH` e `DELETE` `/api/transactions`.
  - Queries de mutação delimitadas obrigatoriamente por `and(eq(transactions.id, id), eq(transactions.tenantId, resolvedTenantId))`.
  - Tentativas de alteração ou deleção de transações pertencentes a outro workspace falham de forma segura com `HTTP 404 Not Found` (anti-enumeração de UUIDs alheios).
- **Isolamento Estrito de Contexto RAG e Rate Limiting de IA (VULN-10):**
  - Eliminação definitiva de qualquer fallback cross-tenant no assistente de IA. Se a sessão ou telefone não forem identificados, o endpoint não consulta o banco e retorna apenas diretrizes financeiras gerais.
  - Contexto RAG rigorosamente restrito a `eq(transactions.tenantId, resolvedTenantId)`.
  - Rate limiting defensivo limitando chamadas a 30 requisições por minuto por tenant no Redis.
- **Blindagem Anti-Prompt-Injection e Anti-Jailbreak (VULN-11):**
  - Isolamento estrito da entrada do usuário entre tags `<user_question>` no modelo DeepSeek.
  - Diretivas rígidas no system prompt bloqueando tentativas de sobrescrever diretrizes, revelar prompts de sistema ou adotar personas arbitrárias.

---

## [1.0.0] - 2026-10-23

### Added
- **Fluxo de Confirmação Interativa & Fast-Path Determinístico (US-05):**
  - Validação instantânea de respostas de confirmação ("Sim", "ok", "confirmo", "pode salvar", 👍, ✅) e de cancelamento ("Não", "cancela", "esquece", ❌) via regex compiladas com latência zero, reduzindo chamadas a APIs externas.
  - Mitigação de skew de timezone na busca de pendências via SQL `NOW()` no PostgreSQL, prevenindo descarte prematuro por divergências entre Node.js e banco.
- **Resolução de Schema da Jev API (Suporte a `criteria`):**
  - Adição do campo `criteria` estruturado por opção para perguntas categóricas `choice`, `noul` e `score`, eliminando a falha HTTP 422 Unprocessable Entity da TypeSafe System One API.
  - Implementação de fallbacks heurísticos locais para categorização financeira e formas de pagamento brasileiras em caso de indisponibilidade de IA.
- **Fluxo de Pareamento WhatsApp & Modal Interativo (US-01):**
  - Implementação do modal [`PairingModal.tsx`](file:///src/components/dashboard/PairingModal.tsx) acionado via `Navbar` e `EmptyState`.
  - Suporte à máscara de celular brasileiro `(DD) 9XXXX-XXXX`, geração de código OTP via Redis, deep link direto para o WhatsApp do bot (`wa.me/<bot>?text=VINCULAR%20<otp>`) e polling reativo com atualização automática da interface.
- **Endpoints Canônicos RESTful:**
  - `POST /api/auth/pair`: Cadastro rápido idempotente de usuário, inicialização de tenant padrão com 8 categorias e geração de OTP com TTL de 10 minutos.
  - `GET /api/auth/pair`: Verificação de status de vinculação do usuário por telefone ou userId.
  - `GET /api/transactions`: Consulta de extrato real no PostgreSQL com filtros dinâmicos (período, datas, tipo, categoria, busca), paginação e agregação em tempo real (`currentBalance`, `totalIncome`, `totalExpense`).
  - `POST /api/transactions`: Lançamento financeiro manual via Dashboard com validação de catálogo e auditoria imutável.
  - `GET /api/categories`: Listagem de categorias ativas do tenant com fallback para grade padrão.
- **Integração Direta Evolution API (Zero Dependência de n8n):**
  - Esclarecimento arquitetural e documentação canônica comprovando que a Evolution API despacha eventos diretamente para `/api/webhooks/evolution`, sem qualquer dependência de workflows do n8n para mensageria.
- **Descoberta & Especificações de Domínio:**
  - Levantamento e formalização das User Stories canônicas US-01 a US-10 em [.plans/SPECIFICATIONS.md](file:///.plans/SPECIFICATIONS.md).
  - Definição do Project Charter em [.plans/PROJECT_CHARTER.md](file:///.plans/PROJECT_CHARTER.md) e questionário de descoberta em [.plans/DISCOVERY_QUESTIONNAIRE.md](file:///.plans/DISCOVERY_QUESTIONNAIRE.md).
- **Arquitetura & Persistência com Row Level Security (RLS):**
  - Modelagem relacional canônica no PostgreSQL 16 com Drizzle ORM ([`src/lib/db/schema.ts`](file:///src/lib/db/schema.ts)).
  - Políticas estritas de RLS ativadas nas tabelas `categories`, `transactions`, `pending_confirmations` e `ai_insights`.
  - Tabela append-only imutável `audit_logs` com trigger PL/pgSQL impedindo `UPDATE` e `DELETE`.
  - Helper transacional [`withTenantContext`](file:///src/lib/db/rls.ts) com injeção segura de variáveis de sessão `app.current_tenant_id` e `app.current_user_id`.
- **Pipeline de Mensageria e WhatsApp Engine:**
  - Integração com Evolution API v2 (`atendai/evolution-api:v2.2.3`) rodando em Docker autocontido sem custos de gateway proprietário.
  - Fila assíncrona desacoplada com Redis 7 e BullMQ ([`src/lib/queue/whatsapp.ts`](file:///src/lib/queue/whatsapp.ts)).
  - Processamento em background via worker dedicado ([`src/workers/whatsapp-worker.ts`](file:///src/workers/whatsapp-worker.ts)).
  - Normalizador de telefones para formato canônico E.164 brasileiro com suporte aos 67 DDDs da Anatel e autocompletamento do nono dígito ([`src/lib/utils/phone.ts`](file:///src/lib/utils/phone.ts)).
- **Camadas de Inteligência Artificial Especializada:**
  - **Jev (TypeSafe AI — System One):** Decisões booleanas de confirmação (`noul`), classificação estruturada de categorias e formas de pagamento (`choice`) e pontuação de anomalias (`score`) via SDK oficial `@typesafe-ai/sdk` ([`src/lib/ai/jev.ts`](file:///src/lib/ai/jev.ts)).
  - **Groq Cloud Whisper:** Transcrição de áudios de voz em formato OGG/Opus em menos de 400ms utilizando chips LPU com o modelo `whisper-large-v3` ([`src/lib/ai/groq.ts`](file:///src/lib/ai/groq.ts)).
  - **DeepSeek V3 / Multimodal Vision:** Extração estruturada de valores e datas em pt-BR com esquemas Zod, OCR de cupons fiscais e comprovantes Pix, além de diagnósticos preditivos de consumo ([`src/lib/ai/deepseek.ts`](file:///src/lib/ai/deepseek.ts)).
- **Dashboard PWA (Progressive Web App):**
  - Interface construída com Next.js 15 (App Router), React 19 e Tailwind CSS.
  - Componentes acessíveis (WCAG AA): [`FinancialSummaryCards`](file:///src/components/dashboard/FinancialSummaryCards.tsx), [`TransactionsList`](file:///src/components/dashboard/TransactionsList.tsx), [`CategoryExpenseChart`](file:///src/components/dashboard/CategoryExpenseChart.tsx) e [`AiInsightsCard`](file:///src/components/dashboard/AiInsightsCard.tsx).
  - Web App Manifest ([`src/app/manifest.json`](file:///src/app/manifest.json)) com suporte standalone, ícones maskable e tema visual esmeralda `#059669`.
- **Infraestrutura & Deploy:**
  - Reverse proxy Caddy 2 com emissão e renovação automática de certificados SSL Let's Encrypt para `app.exemplo.com` e `wa.exemplo.com` ([`Caddyfile`](Caddyfile)).
  - Conexão de rede de contêineres entre o Caddy existente e a rede `wkontrolai_wkontrol_net`.
  - Orquestração completa de serviços via [`docker-compose.yml`](file:///docker-compose.yml) otimizada para a VPS Always Free da Oracle Cloud (Next.js App, BullMQ Worker, PostgreSQL 16 e Redis 7).
  - Guia passo a passo de deploy via terminal SSH em [.plans/DEPLOYMENT_GUIDE.md](file:///.plans/DEPLOYMENT_GUIDE.md).
- **Garantia de Qualidade & Testes Automatizados:**
  - Suíte completa de testes unitários e de integração com Vitest ([`vitest.config.ts`](file:///vitest.config.ts)), totalizando **105 testes aprovados (100%)**:
    * `tests/api-routes.test.ts`: 18 testes de contratos de rotas, pareamento seguro, webhook Evolution v2, mídias criptografadas e filtros temporais (`last-90-days` vs `all`).
    * `tests/validations.test.ts`: 30 testes de esquemas Zod, contratos monetários, áudios PTT e imagens criptografadas.
    * `tests/e164.test.ts`: 17 testes de normalização E.164 e validação de DDDs da Anatel.
    * `tests/ai-parsers.test.ts`: 22 testes de parsers DeepSeek, Groq Whisper, Jev System One com `criteria`, regex fast-path e sanitização de mimetypes.
    * `tests/idempotency.test.ts`: 18 testes de deduplicação atômica, descarte de acks (DELIVERY_ACK 200), decodificação Base64, desvio da CDN do WhatsApp (`isWhatsAppCdnUrl`) e concorrência em rajada.
  - Relatório oficial de QA documentado em [.plans/QA_REPORT.md](file:///.plans/QA_REPORT.md) (`[QA_RESULT: PASSED]`).

### Security
- **Blindagem Contra Vazamento de OTP no Endpoint de Status (`/api/auth/pair`):**
  - Remoção de qualquer exposição do código OTP numérico em consultas `GET /api/auth/pair`, retornando estritamente a flag booleana `hasPendingOtp`.
- **Rate Limiting em Vinculações de WhatsApp:**
  - Implementação de trava defensiva no Redis `ratelimit:pair:<phone>` limitando a geração de OTP a no máximo 5 tentativas por janela de 10 minutos por telefone.
- **Eliminação de Fallbacks Permissivos e Verificação Estrita de Tenant:**
  - Rejeição obrigatória (`HTTP 403 Forbidden`) em `POST /api/transactions` caso a categoria selecionada não pertença ao tenant informado.
- **Hardening Não-Root nos Contêineres Docker ([`Dockerfile`](file:///Dockerfile)):**
  - Execução restrita sem privilégios de root tanto no Next.js (`USER nextjs`, uid 1001) quanto no worker do BullMQ (`USER worker`, uid 1001, permissões controladas sobre `/app` e `/pnpm`).
- **Isolamento de Contexto de Build ([`.dockerignore`](file:///.dockerignore)):**
  - Criação de `.dockerignore` seguro impedindo que arquivos confidenciais (`.env*`, credenciais), diretórios de auditoria/metadados (`.plans`, `.antigravity`), diretórios `.git` e artefatos de compilação entrem nas imagens Docker.
- **Autenticação Mandatória no Webhook (VULN-01):**
  - Implementação de `timingSafeCompare` com `crypto.timingSafeEqual` nos headers `apikey`, `x-webhook-secret` e query param `token` da rota `/api/webhooks/evolution`, prevenindo timing attacks e requisições forjadas.
- **Mutex Lock Distribuído contra Race Conditions (VULN-02):**
  - Trava distribuída em Redis (`lock:whatsapp:user:${phone}`) com TTL de 10 segundos no processamento de mensagens no worker.
  - Mensagens concomitantes do mesmo usuário são reagendadas de forma segura com `job.moveToDelayed(1500)`.
  - Liberação segura de lock no bloco `finally` garantindo que apenas o detentor do lock possa removê-lo.
- **Injeção de Sessão RLS Nativa (VULN-03):**
  - Substituição de queries manuais pelo método nativo do PostgreSQL `set_config('app.current_tenant_id', $1, true)` compatível com prepared statements e imune a SQL injection.
- **Isolamento Estrito em Mutações e Confirmações (VULN-04):**
  - Inclusão mandatória do filtro de `tenantId` em todas as consultas, buscas por telefone, confirmações e exclusões na tabela `pending_confirmations`.
- **Proteção Anti-Brute Force em Códigos OTP (VULN-05):**
  - Remoção de comandos custosos `KEYS *` no Redis, implementando indexação direta O(1) através de `otp:code:${code}`.
  - Rate limiting bloqueando tentativas após 5 falhas consecutivas por telefone com janela de 1 hora.
- **Sanitização de Prompts de IA contra Injection (VULN-06):**
  - Delimitação estrita do conteúdo do usuário através de tags `<user_message>` no cliente DeepSeek com diretrizes defensivas no system prompt.
- **Ocultação de Erros Internos (VULN-07):**
  - Supressão de mensagens de exceção internas e stack traces nas respostas HTTP 500 do webhook da Evolution API.
- **Prevenção de SSRF e Limpeza de Disco (VULN-08):**
  - Validação estrita de URLs de mídia bloqueando loopback, IPs de redes privadas (RFC 1918) e metadados de nuvem.
  - Remoção determinística de arquivos de mídia de `/tmp` no bloco `finally`, prevenindo esgotamento de disco na VPS.
- **Frontend Imune a XSS e Vazamento de Segredos:**
  - Zero ocorrências de `dangerouslySetInnerHTML` ou manipulação direta de DOM no frontend React.
  - Sanitização de dígitos no deep link do WhatsApp no componente `EmptyState`.
  - Isolamento absoluto de credenciais e chaves privadas (`GROQ_API_KEY`, `DEEPSEEK_API_KEY`, `TYPESAFE_API_KEY`, `DATABASE_URL`) no backend.
- Homologação consolidada da segurança registrada em [.plans/SECURITY_AUDIT.md](file:///.plans/SECURITY_AUDIT.md) (`[STATUS: APPROVED]`).

### Changed
- **Alinhamento de Targets no Docker Multi-Stage ([`docker-compose.yml`](file:///docker-compose.yml)):**
  - Configuração de alvos dedicados para cada contêiner (`target: runner` para o serviço `app` e `target: worker` para o serviço `worker`), otimizando o isolamento de pacotes e reduzindo drasticamente o tempo de build e pegada de disco.
- **Resolução de Builds Nativos do PNPM ([`.npmrc`](file:///.npmrc), [`package.json`](file:///package.json)):**
  - Configuração de `strict-dep-builds=false` no `.npmrc` e declaração de dependências permitidas em `pnpm.onlyBuiltDependencies` (`esbuild`, `msgpackr-extract`), eliminando o erro `ERR_PNPM_IGNORED_BUILDS` em ambientes de contêiner.
- **Otimização de Footprint de Memória:**
  - Unificação de rotas e workers sobre a mesma base de código TypeScript, mantendo a pegada de RAM do monorepo abaixo de 1.2GB na VPS.
- **Deduplicação de Webhooks com Latência < 50ms:**
  - Migração de processamento síncrono para retorno imediato de `HTTP 200 OK` via deduplicação atômica `SET NX EX 86400` no Redis.

### Fixed
- **Filtro Temporal "Últimos 90 dias" no Dashboard e API:**
  - Correção no cálculo da janela temporal de 90 dias (`hoje - 90 dias` até `hoje`) no frontend ([`src/components/layout/Navbar.tsx`](file:///src/components/layout/Navbar.tsx)) e na rota [`src/app/api/transactions/route.ts`](file:///src/app/api/transactions/route.ts), eliminando o vazamento indevido de transações de anos anteriores (como Maio/2021) na visualização dos últimos 90 dias.
- **Opção "Todos os períodos" para Consulta Histórica:**
  - Adição da opção canônica no seletor de período da Navbar e no esquema Zod `transactionPeriodSchema` (`all`), permitindo ao usuário consultar e exportar o extrato financeiro histórico irrestrito do tenant no PostgreSQL.
- **Bloqueio de Download Criptografado da CDN do WhatsApp:**
  - URLs pertencentes à CDN do WhatsApp (`*.whatsapp.net`) não são mais baixadas via HTTP GET direto pelo cliente Evolution API ([`src/lib/evolution/client.ts`](file:///src/lib/evolution/client.ts)), pois a CDN entrega ciphertext cifrado de ponta a ponta que causava falha imediata nas IAs. O fluxo agora força a descriptografia através do Baileys na Evolution API via endpoint `/chat/getBase64FromMediaMessage/${instance}`.
- **Sanitização de Mimetypes para Groq Whisper e DeepSeek Vision:**
  - Remoção de parâmetros de codecs nos mimetypes de áudio (`audio/ogg; codecs=opus` -> `audio/ogg`), mapeamento correto da extensão para nomes canônicos de arquivo temporário (`audio.ogg`) e envio de data URIs com cabeçalhos MIME padronizados para a API de visão multimodal da DeepSeek.
- **Inspeção de Magic Numbers nos Logs do Worker:**
  - Validação e logging dos bytes iniciais do buffer de mídia (`OggS` para áudios OGG e `\xFF\xD8\xFF` para JPEG) no [`src/workers/whatsapp-worker.ts`](file:///src/workers/whatsapp-worker.ts), possibilitando diagnóstico instantâneo e rastreabilidade nos logs da aplicação.
- **Descarte Gracioso de Acks da Evolution API v2 (`DELIVERY_ACK`, `READ`, etc.) com HTTP 200 antes de Validação Zod:**
  - Tratamento prévio no webhook ([`src/app/api/webhooks/evolution/route.ts`](file:///src/app/api/webhooks/evolution/route.ts)) descartando eventos de status de entrega (`DELIVERY_ACK`, `READ`, `SERVER_ACK`, etc.) com retorno imediato de `HTTP 200 OK {"status": "ignored"}`, prevenindo erros de validação Zod (`HTTP 400 Bad Request`) em payloads que não possuem mensagem.
- **Resiliência contra Erro "Expected string, received object" no Webhook:**
  - Normalização defensiva de campos heterogêneos de identificação (como `sender`, `senderPn`, `participant` e estruturas aninhadas da Evolution API v2), garantindo a conversão correta para string antes de passar pelo validador Zod.
- **Decodificação Direta de Base64 em Mensagens de Áudio PTT e Imagem no WhatsApp Worker:**
  - Processamento imediato do buffer Base64 nativo ([`src/workers/whatsapp-worker.ts`](file:///src/workers/whatsapp-worker.ts)) sem requisições de rede adicionais quando a Evolution API já entrega o binário embutido no payload, reduzindo a latência para menos de 50ms antes do envio ao Groq Whisper e DeepSeek OCR.
- **Fallback de Mídias para a Evolution API com a Estrutura Completa do Baileys (`mediaPayload`):**
  - Encaminhamento do objeto de mídia completo com atributos criptográficos (`directPath`, `mediaKey`, `mimetype`, `fileLength`, etc.) no cliente Evolution API ([`src/lib/evolution/client.ts`](file:///src/lib/evolution/client.ts)) ao invocar `/chat/getBase64FromMediaMessage/${instance}`, garantindo descriptografia bem-sucedida mesmo quando `url` for nula.
- **Ingestão Multimodal & Suporte a Mídias Criptografadas com `url: null` (Evolution API):**
  - Correção na recepção de notas de voz gravadas nativamente (Push to Talk / PTT) e fotos de comprovantes fiscais/Pix enviadas pelo app do WhatsApp cujo webhook da Evolution API entrega `url: null`.
  - Atualização dos esquemas Zod ([`src/lib/validations/webhook.ts`](file:///src/lib/validations/webhook.ts)) tornando `url` opcional e anulável em `evolutionAudioMessageSchema`, `evolutionImageMessageSchema` e `whatsAppInboundJobDataSchema`, preservando atributos essenciais como `ptt`, `base64`, `directPath` e `mediaKey`.
  - Ativação do fallback determinístico via `/chat/getBase64FromMediaMessage/${instance}` no cliente Evolution API ([`src/lib/evolution/client.ts`](file:///src/lib/evolution/client.ts)), evitando rejeição de requisição com erro `HTTP 400 Bad Request` e garantindo o fluxo completo de transcrição no Groq Whisper e OCR no DeepSeek.
- **Sincronização de Estado de Pareamento no Dashboard:**
  - Atualização automática em tempo real do estado de vinculação do WhatsApp no Dashboard sem necessidade de reload de página pelo usuário.
- **Resolução de Erro de Build em Contêiner:**
  - Correção do bloqueio de compilação de binários nativos no estágio `deps` do Dockerfile pelo pnpm.
- **Tratamento de Rajadas Concorrentes:**
  - Correção de duplicação de lançamentos provocada por cliques múltiplos ou instabilidades de rede na entrega de webhooks.
- **Normalização de Telefonia Móvel Brasileira:**
  - Tratamento de sufixos de dispositivos e JIDs da Evolution API (`@s.whatsapp.net`, `:1@s.whatsapp.net`), garantindo identificação correta do usuário.
