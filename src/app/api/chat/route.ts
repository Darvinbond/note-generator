import { google } from '@ai-sdk/google';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import path from 'node:path';
import { loadDocxFromDir, pickRelevantExcerpt } from '@/lib/knowledge';
import * as XLSX from 'xlsx';

export const maxDuration = 30;
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json();
  const messages: UIMessage[] = body?.messages ?? [];
  const requestedModel: string | undefined = body?.model;
  const webSearch: boolean | undefined = body?.webSearch;
  const uploadedFile: { name: string; type?: string; data: string } | undefined = body?.file;
  const selectedColumn: number | undefined = body?.selectedColumn; // 1-based index from UI
  const weeklySelections: { [week: number]: string[] } | undefined = body?.weeklySelections;
  const classLevel: string | undefined = body?.classLevel;

  const SYSTEM_PROMPT = `I will be sending you topics with their subtopics. Starting from H1 (used only for the main topic header), followed by H2 and lower levels for subtopics, generate a well-structured lecture-style note aligned with Nigerian teaching and note-writing standards.

Include (And formatted this way in markdown):
- Topic/Heading (use Header1) – Clear and bold.
- Subtopics (use Header2, Header3 as needed) – Properly broken down for easy flow.
- Detailed Explanation – Engaging lecture tone, easy for students to follow.
- Examples – Worked examples and varied scenarios.
- Classwork – Short practice questions.
- Real-life Practical Classwork/Applications (if applicable) – Everyday Nigerian contexts.
- Summary/Key Points – Quick recap.
- Assignment (optional) – Extended practice task.

Goals:
- In-depth but simple to understand.
- Interactive (teacher-like delivery).
- Practical (connect theory to Nigerian life).
- Curriculum-focused (standard Nigerian secondary/tertiary lecture notes).

Format for weeks:
- Week {N} - {topic name} (use Header1)
- Start with a greeting, e.g., "Good day class, in today’s class we are going to…"

MOST IMPORTANT BULLET RULE:
Whenever you list bullet points (e.g., Key Characteristics), after each bullet add a colon and then a clear explanation (max 4 sentences) that simplifies the idea for easy understanding. Do not leave bullets as terse fragments.

Knowledge base and reference:
- Always check provided reference documents before writing. The user will place .docx reference files in the public folder at /public/knowledge/ (e.g., "5 - SCHEME 1ST TERM SSS 1- 3 AUG 2024.docx"). Use them to understand structure and curriculum mapping.
- When the user requests like: "Civic education SS1 week1", consult the scheme document columns (numbers, SS1, SS2, SS3) to find the appropriate content and structure your output accordingly.

VERY IMPORTANT: Do not add any conversational filler or commentary. Your response should be only the generated note, starting directly with the first H1 header.`;

  // --- Knowledge base loading (.docx placed under public/knowledge) ---
  // Derive a simple query: if file provided, use topics from file; otherwise, from last user message
  let userQuery = '';
  let fileInstruction = '';
  if (classLevel) {
    fileInstruction += `\n\nThe user has selected the following class level: ${classLevel}. Please tailor the content to be appropriate for this level of understanding.`;
  }
  if (weeklySelections) {
    // Custom mode
    const lines = Object.entries(weeklySelections)
      .map(([week, topics]) => `- Week ${week}: ${topics.join(', ')}`)
      .join('\n');
    fileInstruction += `\n\nThe user is in custom mode. Generate notes for the entire term using the following weekly topics:\n${lines}\n\nReminder: Start each week with an H1 exactly as: "Week {N} - {topic}" and then proceed with the required structure.`;
    userQuery = Object.values(weeklySelections).flat().join(' ');
  } else if (uploadedFile?.data) {
    try {
      const buf = Buffer.from(uploadedFile.data, 'base64');
      const wb = XLSX.read(buf, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rangeRef = ws['!ref'] || 'A1';
      const range = XLSX.utils.decode_range(rangeRef);
      const colIndex = Math.max(0, (selectedColumn ?? 1) - 1); // 0-based column index
      const weekTopics: { week: number; topic: string }[] = [];
      for (let r = range.s.r; r <= range.e.r; r++) {
        const addr = XLSX.utils.encode_cell({ r, c: colIndex });
        const cell = ws[addr];
        const topic = (cell?.v ?? '').toString().trim();
        const week = r - range.s.r + 1; // 1-indexed week number by row
        // Only add non-empty topics that aren't just a dash
        if (topic && topic !== '-') {
          weekTopics.push({ week, topic });
        }
      }

      if (weekTopics.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No topics found in first column of the uploaded file.' }),
          { status: 400, headers: { 'content-type': 'application/json' } }
        );
      }

      // Build instruction for the model and a query for KB
      const lines = weekTopics
        .sort((a, b) => a.week - b.week)
        .map((wt) => `- Week ${wt.week}: ${wt.topic}`)
        .join('\n');
      fileInstruction = `\n\nThe user uploaded a spreadsheet. Generate notes ONLY for the non-empty entries found in Column 1 (A) using the exact week numbers (row index as week).\nGenerate in ascending order by week number.\n\nWeeks to generate (skip weeks marked with "-"):\n${lines}\n\nReminder: Start each week with an H1 exactly as: "Week {N} - {topic}" and then proceed with the required structure.`;
      userQuery = weekTopics.map((w) => `${w.topic}`).join(' ');
    } catch (err) {
      console.error('[chat] Failed to parse uploaded file', err);
      return new Response(
        JSON.stringify({ error: 'Failed to parse uploaded spreadsheet. Ensure it is a valid xls/xlsx/csv file.' }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }
  } else {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    userQuery = lastUser
      ? lastUser.parts
          .filter((p) => p.type === 'text')
          .map((p: any) => p.text)
          .join(' ')
      : '';
  }

  const knowledgeDir = path.join(process.cwd(), 'public', 'knowledge');
  const docs = await loadDocxFromDir(knowledgeDir);
  const { combined: kbText, sources } = pickRelevantExcerpt(docs, userQuery, 8000);

  let systemWithKB = kbText
    ? `${SYSTEM_PROMPT}\n\n---\n\nReference Excerpts (from: ${sources.join(', ')}):\n\n${kbText}\n\n---\n\nFollow the structure strictly.`
    : SYSTEM_PROMPT;
  if (fileInstruction) {
    systemWithKB += fileInstruction;
  }

  // Map requested model to available providers. For now we only have Google Gemini.
  // You can install other providers (e.g., OpenAI, Deepseek) and extend this switch.
  let modelId = 'gemini-2.5-flash';
  switch (requestedModel) {
    case 'openai/gpt-4o':
    case 'deepseek/deepseek-r1':
    default:
      modelId = 'gemini-2.5-flash';
  }

  // Optionally, if webSearch is requested, you could augment prompts with retrieved context here.

  const result = await streamText({
    model: google(modelId),
    messages: convertToModelMessages(messages.slice(-1)),
    system: systemWithKB,
  });

  return result.toUIMessageStreamResponse();
}
