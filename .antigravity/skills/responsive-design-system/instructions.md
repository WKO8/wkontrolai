# Skill: Responsive Design System & Microinteractions

Esta skill guia a implementação de interfaces dinâmicas, fluidas e acessíveis.

## Estados Interativos Obrigatórios:
Todo componente clicável ou interativo deve possuir tratamentos explícitos:
- **Hover:** Transições curtas e elegantes (`transition-colors duration-150`, sem pulos de layout).
- **Active / Press:** Feedback tátil (ex: micro-escala `active:scale-[0.98]`).
- **Focus-Visible:** Anel de foco visível e acessível para navegação por teclado (`focus-visible:ring-2 focus-visible:ring-offset-2`).
- **Feedback de Carregamento:** Botões devem desabilitar e mostrar spinners integrados ou estados otimistas. Cartões de dados devem usar Skeletons animados com opacidade pulsante suave.

## Responsividade Mobile-First:
- Desenhe pensando primeiro na viewport de 375px/390px, expandindo para tablets (768px) e desktops (1024px+).
- Modais e popovers devem se comportar como gavetas inferiores (*bottom drawers/sheets*) em telas móveis e como janelas flutuantes em desktops.
- Tabelas de dados devem virar cartões expansíveis ou possuir scroll horizontal suave com indicador de overflow em telas pequenas.