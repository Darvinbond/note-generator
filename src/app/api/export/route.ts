import { NextRequest } from 'next/server';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import htmlToDocx from 'html-to-docx';
import puppeteer from 'puppeteer';

export const runtime = 'nodejs';
export const maxDuration = 60;

const require = createRequire(import.meta.url);
let cachedKatexCss: string | null = null;
async function getKatexCss(): Promise<string> {
  if (cachedKatexCss) return cachedKatexCss;
  try {
    const cssPath = require.resolve('katex/dist/katex.min.css');
    cachedKatexCss = await readFile(cssPath, 'utf8');
  } catch {
    cachedKatexCss = '';
  }
  return cachedKatexCss;
}

async function markdownToHtml(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

function addPageBreaksBeforeWeeks(html: string): string {
  let seenFirst = false;
  // Match h1-h3 that start with "Week <num>" allowing -, –, —, or : after the number
  const pattern = /<(h[1-3])\b[^>]*>\s*Week\s+\d+\s*[\-–—:]?.*?<\/\1>/gi;
  return html.replace(pattern, (m) => {
    if (!seenFirst) {
      seenFirst = true;
      return m;
    }
    return `<div class="page-break" style="page-break-before: always;"></div>${m}`;
  });
}

function wrapHtmlDocument(innerHtml: string, inlineKatexCss: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono&display=swap" rel="stylesheet">
  <style>
    ${inlineKatexCss}
    @page { 
      margin: 0.5in;
      @top-center { content: element(header); }
      @bottom-center { content: element(footer); }
    }
    
    body { 
      font-family: 'Geist', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; 
      line-height: 1.6; 
      color: #111;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      position: relative;
    }

    body::after {
      content: "";
      background-image: url(http://localhost:3000/bg.png);
      background-repeat: no-repeat;
      background-position: center;
      background-size: 400px;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: -1;
      opacity: 0.1;
    }
    
    code, pre, kbd, samp {
      font-family: 'Geist Mono', 'Courier New', Courier, monospace;
      font-size: 0.2em;
    }
    
    h1 { 
      font-family: 'Geist', system-ui, -apple-system, sans-serif;
      font-weight: 700;
      font-size: 24px; 
      margin: 0 0 12px; 
    }
    
    h2 { 
      font-family: 'Geist', system-ui, -apple-system, sans-serif;
      font-weight: 600;
      font-size: 20px; 
      margin: 16px 0 8px; 
    }
    
    h3 { 
      font-family: 'Geist', system-ui, -apple-system, sans-serif;
      font-weight: 500;
      font-size: 18px; 
      margin: 14px 0 6px; 
    }
    
    p { margin: 8px 0; }
    ul, ol { padding-left: 1.5rem; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #ddd; padding: 6px; }
    .page-break { page-break-before: always; break-before: page; }
    
    /* Better code block styling */
    pre {
      background: #f5f5f5;
      padding: 1em;
      border-radius: 4px;
      overflow-x: auto;
    }
    
    /* Better inline code */
    :not(pre) > code {
      background: #f0f0f0;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-size: 0.2em;
    }
  </style>
</head>
<body>
${innerHtml}
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const { format, content } = (await req.json()) as { format: 'docx' | 'pdf'; content: string };
    if (!content || (format !== 'docx' && format !== 'pdf')) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Convert markdown -> HTML with math support
    const htmlBody = await markdownToHtml(content);
    const withBreaks = addPageBreaksBeforeWeeks(htmlBody);
    const katexCss = await getKatexCss();
    const fullHtml = wrapHtmlDocument(withBreaks, katexCss);

    if (format === 'docx') {
      const buffer = await htmlToDocx(fullHtml);
      return new Response(buffer, {
        status: 200,
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'content-disposition': 'attachment; filename="notes.docx"',
        },
      });
    }

    // format === 'pdf'
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--font-render-hinting=none',
        '--enable-font-antialiasing',
        '--enable-gpu-rasterization',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
    try {
      const page = await browser.newPage();
      
      // Wait for fonts to load
      await page.evaluateHandle('document.fonts.ready');
      
      // Set the content and wait for fonts to be loaded
      await page.setContent(fullHtml, { 
        waitUntil: 'networkidle0',
        timeout: 60000 // Increase timeout to ensure fonts load
      });
      
      // Additional wait to ensure all fonts are loaded
      await page.evaluate(async () => {
        const style = document.createElement('style');
        style.textContent = `
          @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono&display=swap');
          body { opacity: 0; transition: opacity 0.5s; }
        `;
        document.head.appendChild(style);
        
        // Wait for fonts to load
        await document.fonts.ready;
        
        // Make content visible after fonts are loaded
        document.body.style.opacity = '1';
      });
      
      // Wait a bit more to ensure rendering is complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '1in', right: '0.5in', bottom: '1in', left: '0.5in' },
        preferCSSPageSize: true,
        displayHeaderFooter: false,
      });
      
      return new Response(pdf, {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename=notes.pdf',
        },
      });
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error('[export] failed', err);
    return new Response(JSON.stringify({ error: 'Failed to export document.' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
