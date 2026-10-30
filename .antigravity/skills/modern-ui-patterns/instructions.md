# Skill: Modern UI Patterns (Anti-AI Cliché Design)

Esta skill define as diretrizes inegociáveis de design visual para a construção de interfaces modernas e profissionais.

## Diretrizes Anti-AI (O que NUNCA fazer):
1. **Sem Gradientes Excessivos:** Evite gradientes espalhafatosos roxo/azul ou fundos "cósmicos" genéricos. Use paletas sólidas, refinadas e com tons neutros profundos (ex: zinc, slate ou neutral balanceados).
2. **Sombras Sutis:** Proibido sombras difusas e pesadas. Use sombras de camada dupla com baixa opacidade (ex: `shadow-sm` ou `shadow-[0_1px_2px_rgba(0,0,0,0.06)]`).
3. **Bordas Delicadas:** Prefira divisores sutis com opacidade controlada (`border-black/5` ou `border-white/10`) em vez de linhas duras ou caixas com bordas grossas.
4. **Hierarquia Tipográfica Clara:** 
   - Máximo de 2 famílias tipográficas (uma Sans geométrica/grotesca para títulos e leitura, e opcionalmente uma Mono para dados/código).
   - Use peso de fonte (`font-medium` a `font-semibold`) e variações de tom de texto (`text-muted-foreground`) para criar contraste, sem exagerar no tamanho da fonte.

## Padrões de Layout e Espaçamento:
- **Ritmo Espacial Estrito:** Baseie layouts em escalas múltiplas de 4px ou 8px (`gap-2`, `gap-4`, `gap-6`, `p-6`).
- **Densidade Balanceada:** Ajuste padding e altura de linha de acordo com o contexto (telas de dashboard pedem maior densidade de informação; páginas de conversão pedem respiro).
- **Consistência de Raios:** Se os cartões usam `rounded-lg` (8px), os botões internos devem usar `rounded-md` (6px) para manter proporção geométrica concêntrica.