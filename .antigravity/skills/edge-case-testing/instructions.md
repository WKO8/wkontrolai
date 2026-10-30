# Skill: Edge-Case & Adversarial Testing

Esta skill orienta a criação e execução de testes automatizados agressivos voltados a cenários limites, regressões e estresse de contratos.

## 1. Bateria de Entradas Adversariais
Para cada função, endpoint ou formulário, devem existir casos de teste com:
- **Limites de String:**
  - Strings vazias (`""`) e strings compostas apenas por espaços em branco (`"   "`).
  - Strings ultra-longas (1.000 a 10.000 caracteres para checar quebra de layout ou estouro de colunas `VARCHAR`).
  - Caracteres especiais, acentuação, emojis compostos (ex: 👨‍👩‍👧‍👦) e caracteres de controle invisíveis (`\u200B`, `\n`, `\0`).
- **Valores Numéricos:**
  - Zero, números negativos, decimais infinitos, números com precisão flutuante (ex: `0.1 + 0.2`) e estouro de inteiros (`MAX_SAFE_INTEGER`).
- **Coleções e Listas:**
  - Arrays vazios `[]`, arrays com 1 único item e arrays massivos (para checar performance de renderização).
  - Arrays contendo itens duplicados ou valores `null`/`undefined` intercalados.

## 2. Testes de Ciclo de Vida e Estados Assíncronos
- **Race Conditions:** Simular duas requisições idênticas disparadas no mesmo milissegundo pelo mesmo usuário para checar se uma é rejeitada ou se ambas debitam o saldo.
- **Falha de Rede e Timeouts:** Validar se a interface não trava em tela em branco quando a chamada de API falha ou demora mais de 10 segundos.
- **Testes de Regressão de Sessão:** O que acontece se o token de autenticação expirar exatamente durante o envio de um formulário longo? O dado é perdido ou salvo em draft?

## 3. Validação de Contratos
- Garantir que nenhum endpoint retorne `undefined` em campos declarados como obrigatórios no schema TypeScript/Zod.