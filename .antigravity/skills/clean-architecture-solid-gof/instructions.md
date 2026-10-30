# Skill: Clean Architecture, SOLID Principles & GoF Design Patterns

Esta skill dita os padrões estruturais de código para manter a base desacoplada, extensível e manutenível.

## 1. Aplicação Cirúrgica dos Princípios SOLID

- **S - Single Responsibility Principle (SRP):**
  - Módulos, classes ou funções devem ter apenas uma razão para mudar.
  - Controllers/Route Handlers apenas orquestram I/O e status HTTP. A regra de negócio reside estritamente em Use Cases/Services dedicados.
  - Componentes de UI não fazem mutações de dados nem aplicam regras de cálculo complexas diretamente no JSX.

- **O - Open/Closed Principle (OCP):**
  - O sistema deve ser aberto para extensão, mas fechado para modificação.
  - Evite blocos gigantescos de `switch/case` ou cadeias de `if/else` para tratar múltiplos tipos de clientes, pagamentos ou métodos de envio. Use mapas polimórficos ou o pattern Strategy.

- **L - Liskov Substitution Principle (LSP):**
  - Subclasses ou implementações de contratos devem ser substituíveis por suas interfaces base sem quebrar o comportamento esperado do sistema.
  - Nunca lance exceções do tipo "Método Não Implementado" em classes concretas derivadas de uma interface comum.

- **I - Interface Segregation Principle (ISP):**
  - Interfaces devem ser pequenas e focadas no cliente que as consome.
  - Prefira múltiplas interfaces granulares (ex: `Reader`, `Writer`) a uma interface monolítica que obrigue consumidores a carregar métodos que não utilizam.

- **D - Dependency Inversion Principle (DIP):**
  - Módulos de alto nível não devem depender de módulos de baixo nível; ambos devem depender de abstrações (interfaces/ports).
  - Nunca instancie clientes de infraestrutura (bancos, gateways de pagamento, clientes HTTP) diretamente dentro de um serviço de domínio. Receba-os via injeção de dependência pelo construtor ou factory.

---

## 2. Padrões de Projeto GoF Aplicados na Prática

1. **Padrões Criacionais:**
   - **Factory Method:** Utilize para instanciar clientes externos e drivers (ex: instanciar provedor de email SendGrid vs. Resend baseado em configuração de ambiente sem poluir o código consumidor).
   - **Builder:** Utilize para construção de consultas complexas ou criação de payloads de teste sem parâmetros posicionais confusos.

2. **Padrões Estruturais:**
   - **Adapter:** Crie adaptadores em torno de bibliotecas de terceiros (ex: encapsular SDKs de pagamento ou serviços de mensageria). Se a biblioteca mudar, apenas a camada do Adapter é alterada.
   - **Decorator / Middleware:** Utilize para aplicar cross-cutting concerns (logging, tracing, métricas, caching de resposta e checagem de permissão) sem poluir a lógica de domínio.

3. **Padrões Comportamentais:**
   - **Strategy:** Para algoritmos intercambiáveis (cálculo de frete, estratégias de precificação, diferentes provedores de autenticação OAuth).
   - **Observer / Pub-Sub:** Para disparar efeitos colaterais desacoplados (ex: após a confirmação de um pagamento, emitir o evento `OrderPlaced` para que o serviço de notificação e o de estoque ajam de forma independente).