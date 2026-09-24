/**
 * Fake mínimo de client Supabase para testes unitários — não é usado em
 * produção. Qualquer chamada encadeada (.eq(), .select(), .update()...)
 * retorna o próprio proxy; resolver a Promise (`await`/`.then`) consome a
 * próxima resposta da fila fornecida. Também grava, em ordem, quais
 * tabelas/RPCs foram chamadas e quais métodos foram encadeados, para dar
 * para os testes fazerem asserções de comportamento (ex: "não inseriu
 * atividade quando não havia job pendente").
 */

export interface FakeResponse {
  data: unknown;
  error: unknown;
}

export interface FakeCall {
  table: string;
  methods: string[];
}

export function createFakeSupabase(responses: FakeResponse[]) {
  const calls: FakeCall[] = [];
  let cursor = 0;

  function makeBuilder(table: string) {
    const record: FakeCall = { table, methods: [] };
    calls.push(record);

    const proxy: unknown = new Proxy(function noop() {}, {
      get(_target, prop) {
        if (prop === "then") {
          const result = responses[cursor] ?? { data: null, error: null };
          cursor += 1;
          return (resolve: (value: FakeResponse) => void) => resolve(result);
        }
        return () => {
          record.methods.push(String(prop));
          return proxy;
        };
      },
    });

    return proxy;
  }

  const client = {
    from: (table: string) => makeBuilder(table),
    rpc: (name: string) => makeBuilder(`rpc:${name}`),
  };

  return { client, calls };
}
