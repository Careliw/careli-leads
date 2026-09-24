/**
 * Placeholder até gerarmos os tipos reais a partir do schema do Supabase:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 *
 * Mantemos `Database = any` por enquanto para não travar o desenvolvimento
 * do MVP visual; os tipos de domínio usados pela UI estão em `domain.ts`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
