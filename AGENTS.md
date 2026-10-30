# Regras de Atuação da Equipe WKontrolAI — Delegação Obrigatória

## DIRETIVA ABSOLUTA
O Orquestrador (Agente Principal) está **ESTRITAMENTE PROIBIDO** de realizar alterações diretas de código, ajustes de layout ou modificações em arquivos do projeto por si próprio.

**TODA E QUALQUER IMPLEMENTAÇÃO, CORREÇÃO OU REVISÃO DEVE SER SEMPRE DELEGADA AOS SUBAGENTES ESPECIALISTAS:**

1. **Frontend, UI, Layout & Componentes -> `UIDesigner`**:
   - Telas, páginas (`src/app/**`), componentes React, modais, dashboards.
   - Ajustes visuais, quebras de linha, truncamento de textos, proporção de grids e responsividade (mobile, tablet, desktop).
   - Estilização Tailwind CSS, temas (dark/light), gráficos (SVG, Recharts/Nivo/Shadcn), tipografia e microinterações.

2. **Backend, Webhooks, Workers & Banco de Dados -> `BackendDev`**:
   - APIs, rotas (`/api/*`), Webhooks, BullMQ, Redis, Workers, Evolution API.
   - Banco de dados, queries Drizzle ORM, migrações, integrações de IA de backend (Groq Whisper, DeepSeek).
   - Validações Zod de backend e lógica de negócios.

3. **Pesquisa Técnica & Compatibilidade -> `TechResearcher`**:
   - Levantamento de documentação oficial, compatibilidade de versões, benchmarking de bibliotecas e boas práticas de arquitetura/UI.

4. **Testes Automatizados & Homologação -> `QATester`**:
   - Criação e execução de testes de unidade, integração e regressão (`pnpm test`, Vitest).
   - Validação de casos limite e cenários de falha.

5. **Auditoria de Segurança -> `SecurityAuditor`**:
   - Revisão de vulnerabilidades, RLS (Row Level Security), anti-IDOR, sanitização e prevenção de vazamento de credenciais.

6. **Documentação & Registro de Versões -> `DocsMaintainer`**:
   - Manutenção de `CHANGELOG.md`, `README.md`, guias de uso e documentação técnica.

7. **Arquitetura & Especificação -> `Architect` / `ProductSpecifier`**:
   - Modelagem de alto nível, contratos canônicos e detalhamento de User Stories.

## COMPORTAMENTO DO ORQUESTRADOR
- O Orquestrador opera exclusivamente como maestro / coordenador técnico.
- Ao receber uma demanda do usuário, deve decompô-la e acionar os agentes via `send_message` ou `invoke_subagent`.
- Nunca commitar ou aplicar código sem que o subagente correspondente o tenha produzido ou aprovado.
