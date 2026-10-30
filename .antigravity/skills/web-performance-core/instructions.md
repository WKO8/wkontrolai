# Skill: Web Performance Core & Optimization

Esta skill define as regras de engenharia de frontend para garantir alta performance e fluidez.

## Regras de Construção:
1. **Zero Layout Shift (CLS):** Sempre defina dimensões explícitas (`aspect-ratio`, `width`, `height`) para imagens, vídeos, iframes e avatares antes do carregamento.
2. **Carregamento Condicional & Dinâmico:** 
   - Componentes pesados (gráficos complexos, editores ricos, modais de checkout) devem ser carregados dinamicamente via lazy loading (`next/dynamic` ou `React.lazy`).
3. **Gestão de Fontes e Ícones:** 
   - Nunca importe bibliotecas gigantescas de ícones inteiras. Importe apenas os ícones específicos como componentes SVG inline otimizados.
   - Use fontes com `font-display: swap` para evitar bloqueio de renderização de texto.
4. **Animações com Aceleração por Hardware:** 
   - Use apenas transições de `transform` e `opacity` para animações (evite animar `height`, `width` ou `top/left` que disparam repaints no navegador).