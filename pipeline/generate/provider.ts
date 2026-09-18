export interface StructuredGenerationRequest { schemaName: string; prompt: string; input: unknown; }
export interface AIProvider { readonly name: string; generateStructuredData<T>(request: StructuredGenerationRequest): Promise<T>; }

export class FixtureAIProvider implements AIProvider {
  readonly name = "fixture-provider-v1";
  constructor(private readonly fixtures: Record<string, unknown>) {}
  async generateStructuredData<T>(request: StructuredGenerationRequest): Promise<T> {
    const key = typeof request.input === "object" && request.input && "word" in request.input ? String((request.input as { word: unknown }).word) : "";
    if (!(key in this.fixtures)) throw new Error(`No fixture available for ${key}`);
    return structuredClone(this.fixtures[key]) as T;
  }
}
