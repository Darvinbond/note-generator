import fs from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';

export type LoadedDoc = {
  file: string;
  text: string;
};

export async function loadDocxFromDir(dir: string): Promise<LoadedDoc[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const docs = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.docx'))
      .map((e) => path.join(dir, e.name));

    const results: LoadedDoc[] = [];
    for (const file of docs) {
      try {
        const buffer = await fs.readFile(file);
        const { value } = await mammoth.extractRawText({ buffer });
        // Normalize whitespace a bit
        const text = value.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
        results.push({ file: path.basename(file), text });
      } catch (err) {
        // skip file on error, but continue others
        console.warn('[knowledge] failed reading', file, err);
      }
    }
    return results;
  } catch (e) {
    // directory may not exist
    return [];
  }
}

export function pickRelevantExcerpt(
  docs: LoadedDoc[],
  query: string,
  maxChars = 6000
): { combined: string; sources: string[] } {
  if (docs.length === 0) return { combined: '', sources: [] };

  // naive relevance: rank by occurrences of query tokens
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = docs
    .map((d) => {
      const t = d.text.toLowerCase();
      const score = tokens.reduce((s, tok) => s + (t.includes(tok) ? 1 : 0), 0);
      return { d, score };
    })
    .sort((a, b) => b.score - a.score);

  const pieces: string[] = [];
  const sources: string[] = [];
  let total = 0;
  for (const { d } of scored) {
    if (total >= maxChars) break;
    const remaining = maxChars - total;
    const slice = d.text.slice(0, remaining);
    pieces.push(`# Source: ${d.file}\n\n${slice}`);
    sources.push(d.file);
    total += slice.length;
  }

  return { combined: pieces.join('\n\n---\n\n'), sources };
}
