# 🤝 Guia de Contribuição — WKontrolAI

Obrigado pelo seu interesse em contribuir com o **WKontrolAI**! Este projeto é uma plataforma open source de gestão financeira inteligente orientada a Zero Fricção, combinando mensageria via WhatsApp, processamento multimodal por IA e um Dashboard PWA minimalista e reativo.

Este documento estabelece as diretrizes de engenharia, arquitetura, padrões de código e o fluxo de trabalho para colaboradores e avaliadores técnicos.

---

## 📑 Sumário

- [Visão Geral & Arquitetura Limpa](#-visão-geral--arquitetura-limpa)
- [Pré-requisitos do Ambiente](#-pré-requisitos-do-ambiente)
- [Passo a Passo de Setup Local](#-passo-a-passo-de-setup-local)
- [Execução de Testes & Qualidade](#-execução-de-testes--qualidade)
- [Padrão de Commits Semânticos](#-padrão-de-commits-semânticos)
- [Diretrizes de Desenvolvimento & Boas Práticas](#-diretrizes-de-desenvolvimento--boas-práticas)
- [Fluxo de Pull Requests](#-fluxo-de-pull-requests)
- [Licenciamento & Política de Contribuição](#-licenciamento--política-de-contribuição)

---

## 🏛️ Visão Geral & Arquitetura Limpa

O WKontrolAI foi desenhado seguindo princípios de **Clean Architecture**, alta coesão e baixo acoplamento, dividindo responsabilidades entre camadas bem delimitadas:

```
src/
├── app/                  # Presentation Layer: Next.js 15 App Router & API Route Handlers
│   ├── api/ai/chat/      # RAG Local & Assistente Conversacional (DeepSeek V3)
│   ├── api/auth/pair/    # Autenticação e pareamento WhatsApp via OTP
│   ├── api/categories/   # Gestão de categorias do workspace
│   ├── api/transactions/ # CRUD RESTful com RLS e escopo duplo anti-IDOR
│   └── api/webhooks/     # Ingestão de webhooks da Evolution API v2
├── components/           # UI Components: React 19, Tailwind CSS e acessibilidade WCAG AA
│   ├── dashboard/        # Telas especializadas: Métricas, Extrato e Insights
│   ├── layout/           # Navbar, BottomNav mobile e seletores
│   └── ui/               # Design System primitivo e acessível (Radix-like / Tailwind)
├── lib/                  # Core & Infrastructure: Serviços, integrações e persistência
│   ├── ai/               # Provedores de IA (Groq Whisper, DeepSeek V3, Jev System One)
│   ├── db/               # PostgreSQL 16 + Drizzle ORM (Schemas, RLS e transações)
│   ├── evolution/        # Cliente HTTP para envio de mensagens e botões interativos
│   ├── queue/            # Conexões Redis 7 e filas BullMQ
│   ├── utils/            # Normalização E.164, formatação monetária e helpers
│   └── validations/      # Contratos e validações de runtime estritas com Zod
└── workers/              # Background Worker: Consumidor assíncrono BullMQ
    └── whatsapp-worker.ts # Pipeline multimodal, deduplicação e mutex locks
```

### Tecnologias Centrais:
- **Next.js 15 (React 19 & Turbopack):** App Router com Server Components e Route Handlers otimizados para tempo de resposta sub-50ms.
- **PostgreSQL 16 & Drizzle ORM:** Modelagem relacional tipada de ponta a ponta com **Row Level Security (RLS)** nativo para isolamento multi-tenant matemático via `set_config('app.current_tenant_id', ...)`.
- **Redis 7 & BullMQ:** Mensageria assíncrona, deduplicação atômica de webhooks via `SET NX EX` (TTL 24h) e Mutex Locks distribuídos por telefone de usuário.
- **WhatsApp Engine (Evolution API v2):** Conexão direta baseada em Baileys, dispensando intermediários pesados como n8n.
- **IA Multimodal Híbrida:** Groq Cloud LPU (Whisper-large-v3 < 400ms), DeepSeek V3/Vision (OCR e RAG estruturado via Zod) e Jev TypeSafe AI (`noul`, `choice`, `score`).

---

## 💻 Pré-requisitos do Ambiente

Antes de iniciar, certifique-se de possuir instalado em sua máquina de desenvolvimento:

1. **Node.js:** Versão 22 LTS ou superior (`node -v`)
2. **PNPM:** Versão 9 ou superior (`pnpm -v`). Recomendamos ativar via Corepack:
   ```bash
   corepack enable && corepack prepare pnpm@latest --activate
   ```
3. **Docker & Docker Compose:** Versão recente com suporte a `compose v2` (`docker compose version`)
4. **Git:** Para versionamento (`git --version`)

---

## 🚀 Passo a Passo de Setup Local

Siga a sequência abaixo para inicializar o ambiente de desenvolvimento completo:

### 1. Clonar o Repositório
```bash
git clone https://github.com/seu-usuario/WKontrolAI.git
cd WKontrolAI
```

### 2. Instalar Dependências
Utilize exclusivamente o `pnpm` para garantir integridade via lockfile:
```bash
pnpm install
```

### 3. Configurar as Variáveis de Ambiente
Copie o template oficial e edite conforme necessário:
```bash
cp .env.example .env
```
Para desenvolvimento local com banco e Redis do Docker Compose, a maioria dos valores padrão já é funcional:
- `DATABASE_URL=postgres://postgres:postgres@localhost:5432/wkontrolai`
- `REDIS_URL=redis://localhost:6379`
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- `EVOLUTION_BOT_PHONE=5511999999999`
- `NEXT_PUBLIC_BOT_PHONE=5511999999999`
- Insira suas chaves de IA caso deseje testar integrações externas (`TYPESAFE_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`).

### 4. Inicializar Serviços de Infraestrutura (Postgres & Redis)
Suba os contêineres locais de banco de dados e cache:
```bash
docker compose up -d postgres redis
```

### 5. Sincronizar o Schema do Banco de Dados
Aplique as migrações e sincronize as tabelas com o Drizzle ORM:
```bash
pnpm db:push
```

### 6. Popular o Banco com Dados de Demonstração (Seed)
Popule o banco local instantaneamente com o usuário de teste (`+5511999999999`), categorias canônicas, transações dos últimos 6 meses e diagnósticos de IA:
```bash
pnpm db:seed
```

### 7. Iniciar a Aplicação em Modo Desenvolvimento
Em terminais distintos, execute o Dashboard PWA e o Worker de Mensageria:

**Terminal 1 — Web App (Next.js 15):**
```bash
pnpm dev
```
O painel estará disponível em `http://localhost:3000`.

**Terminal 2 — Background Worker (BullMQ WhatsApp Consumer):**
```bash
pnpm worker
```

---

## 🧪 Execução de Testes & Qualidade

A integridade do código e a ausência de regressões são garantidas por uma suíte completa de testes automatizados com Vitest:

### Executar a Suíte Completa de Testes
```bash
pnpm test
```

### Modo Interativo (Watch Mode)
```bash
pnpm test:watch
```

### Validação Estrita de Tipagem TypeScript
Garante que não existem erros de tipos ou tipagens `any` soltas:
```bash
pnpm exec tsc --noEmit
```

### Verificação de Linter
```bash
pnpm lint
```

> [!NOTE]
> Todo Pull Request deve passar com 100% dos testes aprovados (`pnpm test`) e zero erros no compilador TypeScript (`tsc --noEmit`).

---

## 📝 Padrão de Commits Semânticos

Adotamos a convenção do [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/) para manter o histórico do Git legível e compatível com ferramentas automatizadas de changelog.

### Estrutura da Mensagem:
```
<tipo>(<escopo opcional>): <descrição em voz ativa e imperativa>
```

### Tipos Permitidos:
| Tipo | Descrição | Exemplo |
| :--- | :--- | :--- |
| `feat` | Uma nova funcionalidade para o usuário | `feat(dashboard): adiciona exportação de relatório PDF A4` |
| `fix` | Correção de um bug | `fix(webhook): previne race condition com lock no Redis` |
| `docs` | Alterações puramente em documentação | `docs: atualiza guia de setup no CONTRIBUTING.md` |
| `refactor` | Refatoração de código sem alterar comportamento | `refactor(db): extrai helper withTenantContext` |
| `perf` | Melhoria de desempenho | `perf(whisper): otimiza stream OGG para LPU Groq` |
| `test` | Adição ou correção de testes automatizados | `test(api): adiciona cenários de teste anti-IDOR` |
| `chore` | Tarefas de manutenção, deps ou scripts | `chore(deps): atualiza drizzle-orm para 0.39.3` |
| `ci` | Modificações em scripts e pipelines de CI/CD | `ci: adiciona job de validação do vitest` |

---

## 🛡️ Diretrizes de Desenvolvimento & Boas Práticas

1. **Row Level Security (RLS) Mandatório:**  
   Nenhuma query de leitura ou mutação deve contornar o tenant do usuário. Sempre utilize `withTenantContext` ou inclua cláusulas explícitas `and(eq(table.id, id), eq(table.tenantId, tenantId))`.
2. **Defesa em Profundidade contra IDOR / Enumeração:**  
   Toda tentativa de acessar ou alterar registros de outro tenant deve retornar `HTTP 404 Not Found`, jamais `403 Forbidden`, impedindo a descoberta de IDs alheios.
3. **Validação de Entrada com Zod:**  
   Todas as rotas de API devem validar `req.json()` ou parâmetros de consulta via esquemas Zod estritos definidos em `src/lib/validations/`.
4. **Idempotência & Concorrência:**  
   Operações assíncronas no WhatsApp worker devem verificar deduplicação (`idemp:...`) e respeitar o mutex lock por telefone (`lock:whatsapp:user:...`).
5. **Limpeza Efêmera em `/tmp`:**  
   Arquivos temporários de áudio ou imagem processados devem ser removidos dentro de um bloco `finally` garantindo liberação imediata de descritores e espaço em disco.
6. **Acessibilidade & UI Limpa:**  
   Mantenha conformidade WCAG AA. Componentes interativos devem possuir estados de foco claros, labels descritivas (`aria-label`) e semântica HTML adequada.

---

## 🔄 Fluxo de Pull Requests

1. Crie um fork do repositório para a sua conta pessoal no GitHub.
2. Crie uma branch descritiva a partir da `main`:
   ```bash
   git checkout -b feat/sua-feature
   # ou
   git checkout -b fix/seu-bugfix
   ```
3. Faça suas alterações seguindo o padrão de código e as diretrizes do projeto.
4. Execute os testes e verifique os tipos:
   ```bash
   pnpm test
   pnpm exec tsc --noEmit
   ```
5. Realize o commit com mensagem semântica:
   ```bash
   git commit -m "feat(pwa): adiciona filtro de transações por método de pagamento"
   ```
6. Envie a branch para o seu repositório remoto:
   ```bash
   git push origin feat/sua-feature
   ```
7. Abra um **Pull Request** detalhando as alterações implementadas, motivação, testes realizados e eventuais screenshots/GIFs para modificações visuais.

---

## 📄 Licenciamento & Política de Contribuição

Ao contribuir com o WKontrolAI, você concorda que todas as suas contribuições de código serão licenciadas sob os termos da **GNU Affero General Public License v3 (AGPL-3.0)**.

Isso garante que o WKontrolAI permaneça livre e de código aberto para sempre, exigindo que melhorias implementadas em serviços disponibilizados em rede também compartilhem seu código-fonte com a comunidade. Para consultar os termos integrais, leia o arquivo [`LICENSE`](LICENSE).
