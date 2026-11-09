## Qué cambia

<!-- Una o dos líneas: qué hace este PR y por qué. -->

## Cómo probarlo

<!-- Pasos para verlo en el link de vista previa de Vercel. -->

## Checklist

- [ ] `npm run typecheck && npm test && npm run test:sql` pasan
- [ ] Si cambia un cálculo: test nuevo en `tests/calculos.test.ts`
- [ ] Si hay migración nueva (`supabase/migrations/000X_...sql`): **hay que correrla en Supabase antes de mergear** → avisar al admin
- [ ] Sin claves ni `.env` en el código
