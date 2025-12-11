/**
 * Type definitions for @xenova/transformers (optional dependency)
 */

declare module '@xenova/transformers' {
  export interface PipelineOptions {
    quantized?: boolean;
    progress_callback?: (progress: { status: string; progress?: number }) => void;
    dtype?: string;
    device?: string | number;
  }

  export interface EmbeddingResult {
    data: Float32Array | number[];
  }

  export function pipeline(
    task: string,
    model: string,
    options?: PipelineOptions
  ): Promise<(input: string | string[]) => Promise<EmbeddingResult>>;
}