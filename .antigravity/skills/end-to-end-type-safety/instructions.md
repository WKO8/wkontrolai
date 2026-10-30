# Skill: End-to-End Type Safety & Contract Validation

Esta skill impõe o uso de tipagem de ponta a ponta, conectando o banco de dados até os componentes de interface sem perda de integridade de tipos.

## 1. Zero `any` e Tipos Estritos
- O uso de `any` é estritamente proibido no repositório.
- Tipos de dados desconhecidos em tempo de compilação devem ser tipados como `unknown` e obrigatoriamente validados via type guards ou schemas de parsing (ex: Zod) antes do consumo.
- Habilite sempre as flags de verificação estrita: `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`.

## 2. Fonte Única da Verdade (Single Source of Truth)
- Contratos de API não devem ser duplicados em arquivos separados de frontend e backend.
- A arquitetura deve inferir tipos estáticos a partir de schemas de validação de runtime:
  ```typescript
  import { z } from 'zod';

  export const UserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: z.enum(['admin', 'member']),
  });

  export type User = z.infer<typeof UserSchema>;
- Se o backend ou o schema de banco alterar um campo, a compilação do TypeScript no frontend deve quebrar imediatamente (tsc --noEmit), apontando exatamente os componentes que precisam de ajuste.