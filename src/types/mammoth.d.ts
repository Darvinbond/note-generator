declare module 'mammoth' {
  export interface ExtractResult {
    value: string;
    messages?: unknown[];
  }
  export function extractRawText(input: { buffer: ArrayBuffer | Uint8Array | Buffer }): Promise<ExtractResult>;
  const _default: any;
  export default _default;
}
