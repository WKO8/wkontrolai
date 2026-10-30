# 📱 WKontrolAI — Gestão Financeira Inteligente via WhatsApp & PWA Minimalista

[![Next.js](https://img.shields.io/badge/Next.js-15.1.7-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.39.3-C5F74F?style=for-the-badge)](https://orm.drizzle.team/)
[![Redis](https://img.shields.io/badge/Redis-7.0-DC382D?style=for-the-badge&logo=redis)](https://redis.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-5.41.7-orange?style=for-the-badge)](https://bullmq.io/)
[![Vitest](https://img.shields.io/badge/Vitest-132%20Passed-6E9F18?style=for-the-badge&logo=vitest)](https://vitest.dev/)
[![Security Audit](https://img.shields.io/badge/Security-APPROVED-059669?style=for-the-badge)](#-qualidade--homologação-de-segurança)
[![License](https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge)](LICENSE)

O **WKontrolAI** é uma plataforma moderna e resiliente de gestão e inteligência financeira pessoal e para microempreendedores. Projetado sob a premissa de **Zero Fricção**, ele elimina planilhas e formulários complexos: o usuário simplesmente envia mensagens de texto, grava áudios no WhatsApp ou fotografa recibos e comprovantes Pix. Uma cadeia especializada de inteligência artificial multimodal extrai e valida os lançamentos, solicita confirmação *Human-in-the-Loop* (via botões interativos, texto ou áudio) e atualiza em tempo real um **Dashboard PWA (Progressive Web App)** em 3 telas especializadas com assistente conversacional RAG local.

---

## 📑 Sumário

- [Visão Geral & Proposta de Valor](#-visão-geral--proposta-de-valor)
- [Arquitetura da Solução](#-arquitetura-da-solução)
- [Camadas de IA e Tecnologias](#-camadas-de-ia-e-tecnologias)
  - [Jev (TypeSafe AI — System One) & Fast-Path](#1-jev-typesafe-ai--system-one--fast-path-determinístico)
  - [Groq Cloud Whisper (LPU)](#2-groq-cloud-whisper)
  - [DeepSeek V3 / Multimodal Vision & RAG Local](#3-deepseek-v3--multimodal-vision--rag-local)
  - [Next.js 15 PWA & Tailwind CSS (SPA em 3 Telas)](#4-nextjs-15-pwa--tailwind-css-spa-em-3-telas)
  - [PostgreSQL 16 & Drizzle ORM (RLS)](#5-postgresql-16--drizzle-orm-com-rls)
  - [Redis 7 & BullMQ](#6-redis-7--bullmq-idempotência--mutex)
  - [Evolution API v2 (Integração Direta sem n8n)](#7-evolution-api-v2-whatsapp-engine--integração-direta-sem-n8n)
  - [Caddy 2 Reverse Proxy](#8-caddy-2-reverse-proxy--ssl-automático)
  - [Pareamento WhatsApp Human-in-the-Loop](#9-pareamento-whatsapp-human-in-the-loop)
- [Rotas da API Canônicas (RESTful)](#-rotas-da-api-canônicas-restful)
- [Agentes Especialistas do Squad WKontrolAI](#-agentes-especialistas-do-squad-wkontrolai)
- [Tabela de Variáveis de Ambiente](#-tabela-de-variáveis-de-ambiente)
- [Guia de Setup e Desenvolvimento Local](#-guia-de-setup-e-desenvolvimento-local)
- [Guia de Deploy em Produção (VPS Oracle)](#-guia-de-deploy-em-produção-vps-oracle)
- [Qualidade & Homologação de Segurança](#-qualidade--homologação-de-segurança)
- [Estrutura do Repositório](#-estrutura-do-repositório)
- [Como Contribuir](#-como-contribuir)
- [Licença](#-licença)

---

## 🎯 Visão Geral & Proposta de Valor

1. **Entrada Zero Fricção no WhatsApp:** Envie *"Almoço executivo 42 reais no débito"*, grave um áudio de 5 segundos ou mande a foto de um Pix/cupom fiscal.
2. **Confirmação Multimodal & Botões Interativos:** Confirme com 1 toque através dos botões nativos (`Confirmar`, `Editar`, `Cancelar`), use comandos numéricos rápidos (`1`, `2`, `3`) ou responda gravando outro áudio de voz (*"Sim, pode salvar"*).
3. **Edição Conversacional Pré-Confirmação:** Ajuste valores, métodos de pagamento ou remova itens específicos via chat antes de efetivar o lançamento.
4. **Dashboard SPA em 3 Telas Especializadas:**
   - **Métricas:** KPIs executivos, gráfico comparativo de fluxo mensal, donut de categorias, tendência diária e ranking de formas de pagamento.
   - **Extrato:** Histórico completo com filtros temporais (`last-90-days`, `all` ou mensal), categorias, edição inline rápida (`PATCH`) e exclusão segura (`DELETE`).
   - **Insights & IA:** Diagnósticos preditivos de consumo, simulador "Antes vs Depois" de economia acumulada (mensal e anual), padrões temporais, chatbot financeiro integrado (RAG local) e exportação de PDF A4 via CSS Print com zero overhead no servidor.
5. **Segurança e Isolamento Rigoroso (LGPD & Anti-IDOR):** Dados isolados por Row Level Security (RLS) no PostgreSQL, mutações com escopo duplo anti-enumeração (404), `/tmp` efêmero com limpeza estrita no `finally` e sanitização de prompts contra jailbreak.

---

## 🏛️ Arquitetura da Solução

O **WKontrolAI** adota a topologia de microsserviços lógicos unificados em um Monorepo Next.js 15, operando com consumo de memória extremamente baixo (< 1.2GB totais) ideal para a VPS Always Free da Oracle Cloud:

```mermaid
graph TD
    subgraph CLIENTS ["Clientes & Acessos"]
        WA["📱 Usuário WhatsApp"]
        PWA["💻 Navegador Web / PWA Mobile & Desktop"]
    end

    subgraph VPS ["VPS Oracle Cloud Always Free (Docker Stack)"]
        CADDY["Caddy 2 Reverse Proxy<br/>SSL Automático Let's Encrypt"]
        
        subgraph NET ["Docker Network: wkontrol_net"]
            EVO["Evolution API v2.2.3<br/>Node.js WhatsApp Engine"]
            APP["Next.js 15 App Router<br/>PWA Frontend + API Routes"]
            WORKER["Node.js Background Worker<br/>BullMQ Queue Consumer"]
            REDIS[("Redis 7 In-Memory<br/>Deduplicação SETNX + Filas + Mutex")]
            PG[("PostgreSQL 16 Relational<br/>RLS Multi-Tenant Nativo")]
        end
    end

    subgraph AI_SERVICES ["Provedores Especializados de IA & Serviços"]
        GROQ["Groq Cloud API<br/>Whisper-large-v3 em LPUs (&lt;400ms)"]
        JEV["TypeSafe AI SDK<br/>Jev System One: noul, choice, score"]
        DEEPSEEK["DeepSeek API<br/>V3 Chat & Multimodal Vision OCR"]
        RESEND["Resend API<br/>Emails Transacionais & Magic Links"]
    end

    %% Fluxos de Mensagem
    WA -->|"Texto / Áudio / Foto"| EVO
    EVO -->|"Webhook HTTP POST /api/webhooks/evolution"| APP
    APP -->|"1. Valida Timing-Safe Key & SET NX EX"| REDIS
    APP -->|"2. Enfileira Job com deduplicação"| REDIS
    REDIS -->|"3. Pop Inbound Job com Mutex Lock"| WORKER
    
    %% Pipeline de IA
    WORKER -->|"Transcrição Áudio"| GROQ
    WORKER -->|"Decisão Booleana & Categorização"| JEV
    WORKER -->|"Extração Estruturada & OCR"| DEEPSEEK
    
    %% Persistência & Resposta
    WORKER -->|"SQL com SET LOCAL tenant_id"| PG
    WORKER -->|"Envia Mensagem Interativa / Resposta"| EVO
    EVO -->|"WhatsApp Message"| WA

    %% Acesso Web PWA
    PWA -->|"HTTPS / PWA Manifest"| CADDY
    CADDY -->|"Reverse Proxy :3000"| APP
    APP -->|"Queries Drizzle ORM + RLS"| PG
    APP -->|"Magic Links"| RESEND
```

---

## 🧠 Camadas de IA e Tecnologias

### 1. Jev (TypeSafe AI — System One) & Fast-Path Determinístico
Implementado via [`@typesafe-ai/sdk`](https://docs.typesafe.ai/introduction) em [`src/lib/ai/jev.ts`](src/lib/ai/jev.ts) e otimizado no worker [`src/workers/whatsapp-worker.ts`](src/workers/whatsapp-worker.ts):
- **Fast-Path com Latência Zero:** Avaliação instantânea de confirmações (*"sim"*, *"ok"*, *"confirmo"*, 👍, ✅, `btn_confirm`, `1`) e recusas (*"não"*, *"cancela"*, ❌, `btn_cancel`, `3`) via expressões regulares compiladas locais, economizando chamadas de rede e garantindo resposta imediata sem custo de tokens.
- **Edição Conversacional Pré-Confirmação:** Avalia intenções de ajuste (*"troca para 50 no débito"*, *"tira a taxa"*) com schema `parsedConfirmationIntentSchema`, suportando alteração de campos e remoção seletiva (`removeItemIndex`).
- **`noul` (Decisões Booleanas com `criteria`):** Resolução de intenções ambíguas via TypeSafe AI com schema estrito contendo critérios explicativos (`criteria`), prevenindo erros HTTP 422 e eliminando alucinações.
- **`choice` (Classificação Categórica Tipada):** Mapeia lançamentos para as categorias do workspace e métodos de pagamento (`PIX`, `CREDIT_CARD`, `DEBIT_CARD`, `CASH`, `BANK_TRANSFER`, `OTHER`) com fallbacks locais resilientes.
- **`score` (Detecção de Anomalias):** Calcula pontuação de risco e atipicidade para despesas fora do padrão habitual do usuário.
- **Mitigação de Skew de Fuso Horário:** As confirmações pendentes utilizam `expiresAt > NOW()` nativo do PostgreSQL, prevenindo descarte indevido por divergência de relógio entre os contêineres e o banco de dados.

### 2. Groq Cloud Whisper (LPU)
Configurado em [`src/lib/ai/groq.ts`](src/lib/ai/groq.ts). Transcreve arquivos de voz nos formatos OGG/Opus gerados pelo WhatsApp:
- Executa o modelo **`whisper-large-v3`** acelerado em chips LPU (Language Processing Units).
- Transcrição de áudios de até 60 segundos em **menos de 400ms**.
- **Entrada e Confirmação Multimodal:** O Whisper é invocado tanto para converter áudios de novos lançamentos quanto para decodificar mensagens de áudio respondendo a confirmações pendentes (*"Sim, pode salvar"* ou *"Cancela o segundo item"*), unificando a experiência de voz ponta a ponta.
- Descarta o arquivo temporário de `/tmp` imediatamente após o streaming para evitar saturação de disco.

### 3. DeepSeek V3 / Multimodal Vision & RAG Local
Localizado em [`src/lib/ai/deepseek.ts`](src/lib/ai/deepseek.ts):
- **Structured Output via Zod:** Extrai montantes monetários, datas relativas no fuso horário `America/Sao_Paulo`, termos coloquiais brasileiros (*"50 conto"*, *"30 pilas"*) e múltiplas despesas em um único enunciado.
- **OCR Multimodal de Cupons & Pix:** Analisa imagens de comprovantes de pagamento e notas fiscais (NFC-e), capturando o valor líquido efetivamente pago, data e favorecido, rejeitando automaticamente imagens não financeiras.
- **Geração de Insights Financeiros:** Analisa correlações de gastos, padrões temporais de consumo e elabora recomendações de economia personalizadas.
- **Assistente Conversacional RAG Local (`POST /api/ai/chat`):** Chatbot inteligente conectado ao histórico financeiro do tenant (RAG restrito ao workspace), blindado contra prompt injection através de tags `<user_question>` e protegido por rate limiting defensivo de 30 req/min no Redis.

### 4. Next.js 15 PWA & Tailwind CSS (SPA em 3 Telas)
- **App Router & Redesenho SPA Modular:** Interface construída com React 19 e Tailwind CSS, organizada em 3 telas especializadas:
  1. **Métricas:** Resumo executivo de saldo, receitas e despesas, fluxo mensal comparativo, gráfico Donut de categorias, tendência diária e meios de pagamento mais usados.
  2. **Extrato:** Histórico completo com paginação, filtros temporais (`last-90-days`, `all` e mensal), categorias, métodos de pagamento, busca textual, edição inline rápida (`PATCH`) e exclusão segura (`DELETE`).
  3. **Insights & IA:** Diagnósticos preditivos, simulador interativo "Antes vs Depois" de economia acumulada (projeções mensal e anual), padrões temporais de consumo, assistente financeiro RAG embutido e botão de **Exportação de Relatório PDF A4** via CSS Print (@media print nativo, consumindo 0 MB de memória no servidor).
- **PWA Standalone:** Totalmente configurado via [`public/manifest.json`](public/manifest.json) com suporte offline, ícones maskable e experiência nativa mobile-first.
- **Acessibilidade & Segurança de UI:** Conformidade com WCAG AA (contrastes estritos, modais com atributos `aria-*` e `role="dialog"`) e proteção absoluta contra XSS (zero chamadas a `dangerouslySetInnerHTML`).

### 5. PostgreSQL 16 & Drizzle ORM com RLS
- **Isolamento Multi-Tenant Estrito:** Todas as tabelas sensíveis (`transactions`, `categories`, `pending_confirmations`, `ai_insights`) possuem **Row Level Security (RLS)** ativado via PostgreSQL.
- **Helper Transacional Seguro:** A aplicação utiliza [`withTenantContext`](src/lib/db/rls.ts) executando nativamente `set_config('app.current_tenant_id', $1, true)`. É matematicamente impossível uma sessão visualizar registros de outro inquilino.
- **Tabela `audit_logs` Append-Only:** Imutabilidade garantida no banco via trigger PL/pgSQL que bloqueia qualquer comando `UPDATE` ou `DELETE`.

### 6. Redis 7 & BullMQ (Idempotência & Mutex)
- **Deduplicação Atômica (`SET NX EX`):** Webhooks recebidos da Evolution API são verificados via `idemp:evo:msg:<messageId>` com TTL de 24h. Requisições redundantes respondem `HTTP 200 OK {"deduplicated": true}` instantaneamente.
- **Mutex Lock por Telefone:** Evita race condition caso o usuário envie mensagens em rajada ou clique repetidamente. O worker adquire `lock:whatsapp:user:<phone>`; mensagens concorrentes são reenfileiradas com atraso (`job.moveToDelayed(1500)`).

### 7. Evolution API v2 (WhatsApp Engine — Integração Direta sem n8n)
- Servidor WhatsApp autônomo baseado em Baileys executado via contêiner oficial (`atendai/evolution-api:v2.2.3`).
- **Comunicação Direta sem n8n:** O WKontrolAI não depende do n8n para mensageria; a Evolution API dispara webhooks HTTP diretamente para a rota `/api/webhooks/evolution` com assinatura `timingSafeCompare` e resposta em menos de 50ms.
- Sem dependência de gateways proprietários pagos ou serviços externos de terceiros.
- Conecta-se diretamente ao Next.js através de rede privada interna Docker (`wkontrol_net`).

### 8. Caddy 2 Reverse Proxy & SSL Automático
- Imagem `caddy:2-alpine` escutando nas portas 80 e 443.
- Obtenção e renovação totalmente automatizada de certificados TLS via **Let's Encrypt** para `app.exemplo.com` e `wa.exemplo.com`.
- Suporte a compressão HTTP com gzip e zstd.

### 9. Pareamento WhatsApp Human-in-the-Loop
- **Fluxo de Vinculação com Duplo Fator (`PairingModal.tsx`):**
  - O usuário informa seu número com máscara brasileira `(DD) 9XXXX-XXXX` na Navbar ou no EmptyState.
  - O backend (`POST /api/auth/pair`) cadastra o usuário, vincula o workspace padrão com 8 categorias e gera um código OTP de 6 dígitos no Redis com TTL de 10 minutos (com rate limit de 5 requisições por 10 min por telefone).
  - Deep link oficial `https://wa.me/<bot>?text=VINCULAR%20<otp>` abre o WhatsApp com a mensagem pré-formatada.
  - Ao enviar a mensagem, o worker do BullMQ valida o OTP no Redis, atualiza `whatsappVerifiedAt` no PostgreSQL e ativa a conta.
  - Polling reativo em `GET /api/auth/pair?phone=...` detecta a ativação em tempo real e atualiza o Dashboard instantaneamente.

---

## 🔌 Rotas da API Canônicas (RESTful)

Todas as rotas da aplicação contam com tipagem estrita via Zod, auditoria imutável e proteção contra vulnerabilidades OWASP (BOLA/IDOR, XSS, SSRF e Prompt Injection):

| Método | Endpoint | Descrição & Regras de Negócio | Proteções & Segurança |
| :---: | :--- | :--- | :--- |
| `POST` | `/api/auth/pair` | Cadastra usuário e gera código OTP de 6 dígitos com TTL de 10 min. | Rate limit no Redis (5 req/10 min per-phone). |
| `GET` | `/api/auth/pair` | Consulta status de vinculação do WhatsApp (`isPaired`). | Zero vazamento de OTP (`hasPendingOtp: boolean`). |
| `GET` | `/api/transactions` | Consulta extrato histórico com filtros (`period`, `startDate`/`endDate`, `type`, `categoryId`, `search`), paginação e KPIs agregados (`currentBalance`, `totalIncome`, `totalExpense`). | Suporte a `last-90-days`, `all` ou `YYYY-MM`. Isolamento RLS por tenant. |
| `POST` | `/api/transactions` | Lançamento manual de receitas ou despesas via formulário PWA. | Validação de categoria do workspace e auditoria em `audit_logs`. |
| `PATCH` | `/api/transactions` | Edição granular de campos de uma transação existente (descrição, valor, data, categoria, meio de pagamento). | **Anti-IDOR (VULN-09):** escopo duplo `and(eq(id), eq(tenantId))` e `HTTP 404` anti-enumeração. Log `TRANSACTION_EDITED`. |
| `DELETE` | `/api/transactions` | Exclusão de transação financeira do workspace. | **Anti-IDOR (VULN-09):** verificação estrita de titularidade do tenant com `HTTP 404` seguro. Log `TRANSACTION_DELETED`. |
| `GET` | `/api/categories` | Lista as categorias ativas do workspace com ícones e cores hexadecimais. | Fallback determinístico para grade padrão durante inicialização. |
| `POST` | `/api/ai/chat` | Assistente financeiro conversacional (RAG local) conectado ao histórico de gastos do usuário via DeepSeek V3. | **VULN-10 & VULN-11:** rate limiting de 30 req/min no Redis, contexto RAG estrito ao tenant e delimitação `<user_question>` anti-jailbreak. |
| `POST` | `/api/webhooks/evolution` | Ingestão assíncrona de mensagens, áudios e imagens recebidos via Evolution API v2. | Autenticação timing-safe, deduplicação `SET NX EX` e descarte gracioso de ACKs (`DELIVERY_ACK 200`). |

---

## 👥 Agentes Especialistas do Squad WKontrolAI

O desenvolvimento, manutenção e evolução contínua da plataforma WKontrolAI são conduzidos por um squad de agentes especializados detalhados em [`AGENTS.md`](AGENTS.md):

| Agente | Documento de Referência | Responsabilidade Primária na Engenharia |
| :--- | :--- | :--- |
| **DiscoveryAdvisor** | [`AGENTS.md`](AGENTS.md) | Condução de entrevistas de descoberta, mapeamento de restrições de infraestrutura e definição de objetivos de negócio. |
| **ProductSpecifier** | [`AGENTS.md`](AGENTS.md) | Especificação formal de requisitos, User Stories canônicas (US-01 a US-10) e critérios de aceite BDD. |
| **Principal Architect** | [`AGENTS.md`](AGENTS.md) | Arquitetura de microsserviços lógicos, modelagem relacional Drizzle ORM, RLS e topologia Docker. |
| **UIDesigner** | [`AGENTS.md`](AGENTS.md) | UI/UX do Dashboard PWA com WCAG AA, SPA em 3 telas (Métricas, Extrato, Insights & IA) e diagramação CSS Print para PDF. |
| **BackendDev** | [`AGENTS.md`](AGENTS.md) | Desenvolvimento de rotas Next.js 15, worker BullMQ, pipeline de IA multimodal (Groq, DeepSeek, Jev) e Evolution API. |
| **SecurityAuditor** | [`AGENTS.md`](AGENTS.md) | Auditoria adversarial, modelagem de ameaças e mitigação de vulnerabilidades (VULN-01 a VULN-11). |
| **QATester** | [`AGENTS.md`](AGENTS.md) | Automação de testes no Vitest (132 testes aprovados, 100% de cobertura de contratos) e prevenção de regressão. |
| **TechResearcher** | [`AGENTS.md`](AGENTS.md) | Pesquisas técnicas aprofundadas, benchmarks de latência, protocolos WhatsApp e documentação de bibliotecas externas. |
| **DocsMaintainer** | [`AGENTS.md`](AGENTS.md) | Manutenção da documentação canônica, guias de deploy, governança open source e CHANGELOG estruturado. |

---

## 🔐 Tabela de Variáveis de Ambiente

Copie o template `.env.example` para `.env` e preencha as variáveis de acordo com a tabela:

| Variável | Descrição | Obrigatória | Exemplo / Padrão |
| :--- | :--- | :---: | :--- |
| `NODE_ENV` | Modo de execução da aplicação Node.js | Sim | `production` ou `development` |
| `APP_DOMAIN` | Domínio FQDN do Dashboard PWA (usado pelo Caddy) | Sim | `app.exemplo.com` |
| `EVOLUTION_DOMAIN` | Domínio FQDN da Evolution API (usado pelo Caddy) | Sim | `wa.exemplo.com` |
| `NEXT_PUBLIC_APP_URL` | URL canônica de acesso público ao PWA | Sim | `https://app.exemplo.com` |
| `DATABASE_URL` | String de conexão PostgreSQL 16 | Sim | `postgres://postgres:senha@localhost:5432/wkontrolai` |
| `POSTGRES_PASSWORD` | Senha do usuário `postgres` no contêiner | Sim | `wkontrol_super_secret_pass` |
| `REDIS_URL` | String de conexão ao Redis 7 | Sim | `redis://localhost:6379` |
| `EVOLUTION_API_URL` | URL interna de comunicação com a Evolution API | Sim | `http://evolution-api:8080` (Docker) |
| `EVOLUTION_API_KEY` | Chave de autenticação global da Evolution API | Sim | `crie_uma_chave_segura_hex_32` |
| `EVOLUTION_INSTANCE_NAME` | Nome da instância do bot de WhatsApp | Sim | `wkontrol_bot` |
| `EVOLUTION_WEBHOOK_SECRET` | Segredo para validação timing-safe de webhook | Sim | `chave_secreta_webhook_timing_safe` |
| `EVOLUTION_BOT_PHONE` | Número de telefone oficial do bot com DDI e DDD | Sim | `5511999999999` |
| `NEXT_PUBLIC_BOT_PHONE` | Telefone do bot exposto no PWA para deep link WhatsApp | Sim | `5511999999999` |
| `TYPESAFE_API_KEY` | Chave de acesso do Jev (TypeSafe AI) | Sim | `tsa_live_...` |
| `GROQ_API_KEY` | Chave de acesso à API Groq Cloud (Whisper LPU) | Sim | `gsk_...` |
| `DEEPSEEK_API_KEY` | Chave de acesso à API DeepSeek (V3 e Vision) | Sim | `sk-...` |
| `RESEND_API_KEY` | Chave para envio de e-mails transacionais Resend | Sim | `re_...` |
| `EMAIL_FROM` | Remetente autorizado para e-mails | Não | `WKontrolAI <nao-responda@seudominio.com>` |
| `GOOGLE_CLIENT_ID` | Client ID para login Google OAuth | Opcional | `seu_id.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Client Secret para login Google OAuth | Opcional | `seu_client_secret` |
| `AUTH_SECRET` | Segredo de 32 bytes para assinatura de tokens JWT | Sim | `openssl rand -base64 32` |

---

## 💻 Guia de Setup e Desenvolvimento Local

### Pré-requisitos
- **Node.js:** Versão 22 LTS ou superior
- **Gerenciador de Pacotes:** `pnpm` (versão 9+)
- **Docker & Docker Compose:** Instalados na máquina local

### 1. Clonar o Repositório e Instalar Dependências
```bash
git clone https://github.com/seu-usuario/WKontrolAI.git
cd WKontrolAI
pnpm install
```

### 2. Configurar o Ambiente Local
```bash
cp .env.example .env
```
Ajuste as chaves de API (`TYPESAFE_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`) no arquivo `.env`.

### 3. Iniciar Dependências de Infraestrutura (Postgres & Redis)
Suba os serviços de banco e cache em contêineres locais:
```bash
docker compose up -d postgres redis
```

### 4. Executar Migrações do Banco de Dados
Gere e sincronize o schema relacional com RLS via Drizzle ORM:
```bash
pnpm db:push
```

### 5. Popular o Banco com Dados de Demonstração (Seed)
Popule o banco local instantaneamente com o usuário de demonstração (`+5511999999999`), categorias canônicas, transações dos últimos 6 meses e diagnósticos preditivos de IA para avaliar o Dashboard completo:
```bash
pnpm db:seed
```

### 6. Iniciar os Serviços em Modo Desenvolvimento
Em terminais separados:

**Terminal 1 — Dashboard PWA Next.js 15:**
```bash
pnpm dev
```
O app estará acessível em `http://localhost:3000`.

**Terminal 2 — Background Worker BullMQ (WhatsApp Consumer):**
```bash
pnpm worker
```

### 7. Executar Testes Automatizados e Tipagem
```bash
# Executa a suíte completa de 132 testes automatizados no Vitest
pnpm test

# Valida tipagem estrita do TypeScript sem erros
pnpm exec tsc --noEmit
```

---

## 🚀 Guia de Deploy em Produção (VPS Oracle)

O WKontrolAI foi arquitetado para rodar com **custo zero de infraestrutura** na VPS Always Free da Oracle Cloud (4 OCPUs ARM Ampere / 24GB RAM ou AMD equivalente) via **Terminal SSH Puro** com Docker Compose e Caddy com SSL automático.

### 1. Portas Abertas no Painel da Oracle Cloud (VCN Ingress Rules)
No painel da Oracle Cloud (*Compute > Virtual Cloud Networks > Security Lists da VCN*):
- Adicione uma **Ingress Rule** liberando:
  - **Porta 80 (HTTP):** CIDR `0.0.0.0/0`, TCP, Port `80`
  - **Porta 443 (HTTPS):** CIDR `0.0.0.0/0`, TCP, Port `443`

> **Importante (iptables na Oracle Linux/Ubuntu):**  
> Na VPS, insira a liberação das portas no topo do firewall interno do sistema:
> ```bash
> sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
> sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
> sudo netfilter-persistent save
> ```

### 2. Configuração de DNS
No seu provedor de domínio (Cloudflare, Registro.br, etc.), crie dois apontamentos do tipo **A** direcionando para o IP público da sua VPS:

| Tipo | Host / Subdomínio | Destino | Modo Cloudflare |
| :---: | :--- | :--- | :---: |
| **A** | `app` (ex: `app.exemplo.com`) | `<IP_PUBLICO_DA_VPS>` | DNS Only (Nuvem Cinza na primeira emissão) |
| **A** | `wa` (ex: `wa.exemplo.com`) | `<IP_PUBLICO_DA_VPS>` | DNS Only (Nuvem Cinza na primeira emissão) |

### 3. Deploy via Terminal SSH
Conecte-se na VPS e clone o projeto:
```bash
ssh seu-usuario@<IP_PUBLICO_DA_VPS>

# Clone e acesse o diretório
git clone https://github.com/seu-usuario/WKontrolAI.git
cd WKontrolAI

# Configure as variáveis de produção
cp .env.example .env
nano .env
```

Suba todos os 6 contêineres orquestrados:
```bash
docker compose up -d --build
```

O Caddy provisionará e renovará automaticamente os certificados SSL Let's Encrypt para os dois domínios configurados.

### 4. Verificação de Saúde dos Serviços
```bash
docker compose ps
```
Você deverá ver todos os contêineres saudáveis:
- `wkontrol_caddy` (Portas 80 e 443 públicas)
- `wkontrol_app` (Next.js 15 PWA)
- `wkontrol_worker` (BullMQ Consumer)
- `wkontrol_evolution` (Evolution API v2)
- `wkontrol_postgres` (Postgres 16, isolado na rede interna)
- `wkontrol_redis` (Redis 7, isolado na rede interna)

Para acompanhar os logs em tempo real sem sobrecarregar o terminal:
```bash
docker compose logs -f --tail=50 worker app
```

### 5. Conectar o WhatsApp
1. Acesse `https://wa.exemplo.com/manager` no navegador.
2. Crie uma nova instância chamada `wkontrol_bot`.
3. Escaneie o QR Code com o aplicativo do WhatsApp no celular.
4. O bot está ativo! Mensagens e áudios enviados para o número serão recebidos e processados instantaneamente.

### 6. Atualização Contínua (Deploy de Novos Commits)
```bash
cd WKontrolAI
git pull
docker compose up -d --build app worker
```

---

## 🧪 Qualidade & Homologação de Segurança

O WKontrolAI possui cobertura abrangente de testes automatizados e passou por auditoria adversarial completa em todas as camadas:

- **Relatório de QA:** `[QA_RESULT: PASSED]`
  - **132 testes automatizados aprovados (100%)** no Vitest distribuídos em 6 suítes especializadas:
    * `tests/transactions-routes.test.ts`: 15 testes de integração de `PATCH`, `DELETE`, proteção anti-IDOR, trilhas de auditoria e RAG Chat.
    * `tests/api-routes.test.ts`: 25 testes de rotas RESTful, pareamento seguro, regexes rápidos de botões (`FAST_CONFIRM`/`FAST_CANCEL`) e webhook Evolution v2.
    * `tests/validations.test.ts`: 35 testes de esquemas Zod (patching granular, `removeItemIndex`, mídias cifradas e contratos).
    * `tests/e164.test.ts`: 17 testes de normalização E.164 e validação de DDDs da Anatel.
    * `tests/ai-parsers.test.ts`: 22 testes de parsers DeepSeek V3, Groq Whisper e Jev System One com `criteria`.
    * `tests/idempotency.test.ts`: 18 testes de deduplicação Redis, desvio de CDN WhatsApp (`isWhatsAppCdnUrl`) e descarte de ACKs (200).
  - **Zero erros no compilador TypeScript** (`pnpm exec tsc --noEmit` em modo estrito).
  - Teste de rajada de concorrência com 10 requisições simultâneas: 100% de sucesso na deduplicação com lock atômico.
- **Relatório de Segurança:** `[STATUS: APPROVED]`
  - **VULN-01 (Webhook Auth):** Mitigada via `timingSafeCompare` (`crypto.timingSafeEqual`).
  - **VULN-02 (Race Conditions):** Mitigada via Redis Mutex Lock per-phone (`lock:whatsapp:user:${phone}`).
  - **VULN-03 (RLS Injection):** Mitigada com `set_config('app.current_tenant_id', $1, true)`.
  - **VULN-04 (Multi-Tenant Leak):** Mitigada com inclusão mandatória de `tenantId` em todas as mutações.
  - **VULN-05 (OTP Brute Force):** Mitigada com indexação direta O(1) e rate limit de 5 tentativas por telefone.
  - **VULN-06 & VULN-11 (Prompt Injection & Jailbreak):** Mitigada com tags `<user_question>` e diretrizes defensivas rígidas no DeepSeek.
  - **VULN-07 (Error Masking):** Supressão de stack traces e mensagens internas nas respostas HTTP 500 do webhook.
  - **VULN-08 (SSRF Guard & OOM Prevention):** Bloqueio de IPs privados RFC1918, limites de buffer de mídia e descarte em `/tmp`.
  - **VULN-09 (Anti-IDOR em PATCH e DELETE):** Mitigada com escopo duplo `and(eq(id), eq(tenantId))` e retorno seguro de `HTTP 404`.
  - **VULN-10 (Isolamento RAG & Rate Limiting):** Mitigada com eliminação de fallback cross-tenant e rate limit de 30 req/min no Redis.
  - **Frontend:** Zero vazamento de variáveis de servidor em bundles cliente e proteção absoluta contra XSS.

---

## 📂 Estrutura do Repositório

```
WKontrolAI/
├── AGENTS.md                     # Regras de atuação e squad de subagentes especialistas
├── CHANGELOG.md                  # Histórico de versões estruturado (Keep a Changelog)
├── CONTRIBUTING.md               # Guia de contribuição, setup e padrões de código
├── LICENSE                       # Licença GNU Affero General Public License v3 (AGPL-3.0)
├── README.md                     # Documentação pública e guia completo da plataforma
├── public/                       # Assets estáticos e Web App Manifest
│   ├── manifest.json             # PWA Manifest (ícones maskable, theme-color, standalone)
│   └── sw.js                     # Service Worker PWA
├── src/
│   ├── app/                      # Next.js 15 App Router
│   │   ├── api/ai/chat/          # Endpoint RAG local com DeepSeek V3 e rate limiting
│   │   ├── api/auth/pair/        # Endpoints de pareamento OTP WhatsApp
│   │   ├── api/categories/       # Endpoint de categorias do workspace
│   │   ├── api/transactions/     # CRUD de transações (GET, POST, PATCH, DELETE com anti-IDOR)
│   │   ├── api/webhooks/         # Webhook Evolution API com auth timing-safe
│   │   ├── globals.css           # Tailwind CSS e regras de CSS Print (@media print)
│   │   ├── layout.tsx            # Root Layout com PWA provider
│   │   └── page.tsx              # Dashboard Financeiro SPA (Métricas, Extrato, Insights & IA)
│   ├── components/               # Componentes React
│   │   ├── dashboard/            # Cards de resumo, gráficos, lista e modais de edição
│   │   ├── layout/               # Navbar, BottomNav responsivo e seletores de período
│   │   └── ui/                   # Primitivos de UI acessíveis (Button, Card, Badge, Dialog)
│   ├── lib/
│   │   ├── ai/                   # Integrações Groq Whisper, DeepSeek V3/Vision e Jev System One
│   │   ├── db/                   # Drizzle ORM, schema relacional e RLS helpers
│   │   ├── evolution/            # Cliente HTTP para mensageria e botões WhatsApp
│   │   ├── queue/                # Clientes Redis e BullMQ
│   │   ├── utils/                # Normalização E.164 e helpers de formatação
│   │   └── validations/          # Schemas Zod de runtime
│   ├── scripts/
│   │   └── seed.ts               # Script de dados de demonstração (pnpm db:seed)
│   └── workers/
│       └── whatsapp-worker.ts    # Consumer BullMQ com pipeline multimodal, botões e mutex
├── tests/                        # Suíte de testes automatizados (132 testes no Vitest)
│   ├── ai-parsers.test.ts        # Parsers DeepSeek e decisões Jev
│   ├── api-routes.test.ts        # Rotas RESTful, regexes e webhook Evolution
│   ├── e164.test.ts              # Validação de DDDs Anatel e telefones
│   ├── idempotency.test.ts       # Deduplicação atômica, CDN WhatsApp e acks
│   ├── transactions-routes.test.ts # CRUD transações, anti-IDOR, auditoria e chat RAG
│   └── validations.test.ts       # Schemas Zod de transações, confirmações e mídias
├── .dockerignore                 # Proteção contra vazamento de credenciais e context build limpo
├── .env.example                  # Template canônico de variáveis de ambiente
├── .gitignore                    # Regras de exclusão do Git
├── .npmrc                        # Configuração de builds nativos do PNPM (strict-dep-builds=false)
├── Caddyfile                     # Configuração do Caddy com SSL automático
├── docker-compose.yml            # Orquestração de serviços com targets runner e worker
├── Dockerfile                    # Build multi-stage com targets runner e worker (não-root)
├── package.json                  # Dependências e scripts de automação
└── vitest.config.ts              # Configuração do executor de testes Vitest
```

---

## 🤝 Como Contribuir

Contribuições são muito bem-vindas! Se você deseja colaborar com novas funcionalidades, correções de bugs ou melhorias de documentação, consulte o nosso [**Guia de Contribuição**](CONTRIBUTING.md) para detalhes sobre fluxo de branches, padrões de commit e critérios de aceite de Pull Requests.

---

## 📄 Licença

Este projeto é software livre disponibilizado sob os termos da licença [**GNU Affero General Public License v3 (AGPL-3.0)**](LICENSE).

Consulte o arquivo [`LICENSE`](LICENSE) para ler os termos e condições integrais.
