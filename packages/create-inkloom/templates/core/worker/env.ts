export type D1Value =
  | string
  | number
  | null
  | ArrayBuffer
  | ArrayBufferView;

export interface D1PreparedStatementBinding {
  bind(...values: D1Value[]): D1PreparedStatementBinding;
  first<TResult = Record<string, unknown>>(
    column?: string,
  ): Promise<TResult | null>;
  all<TResult = Record<string, unknown>>(): Promise<{
    success: boolean;
    results: TResult[];
  }>;
  run(): Promise<unknown>;
}

export interface D1DatabaseBinding {
  prepare(query: string): D1PreparedStatementBinding;
  batch(statements: D1PreparedStatementBinding[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
}

export interface WorkerBindings {
  DB: D1DatabaseBinding;
  /**
   * Optional shared secret for server-to-server deployments. Standalone local
   * development intentionally works without it.
   */
  DATA_API_TOKEN?: string;
  /** Comma-separated browser origins allowed to call the Worker directly. */
  DATA_API_ALLOWED_ORIGINS?: string;
}

export interface WorkerEnv {
  Bindings: WorkerBindings;
}
