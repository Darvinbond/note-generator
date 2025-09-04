'use client';

import { useEffect, useRef, useState } from 'react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import 'katex/dist/katex.min.css';

// Add some global styles for math rendering
const mathStyles = `
  .katex { font-size: 1.1em !important; }
  .katex-display { margin: 0.5em 0 !important; overflow-x: auto; overflow-y: hidden; }
  .katex-display > .katex { display: inline-block; text-align: left; }
  .katex .base { margin: 0.25em 0; }
  .katex .mord + .mspace { margin-left: 0.16667em; }
  .katex .mspace + .mord { margin-left: 0.16667em; }
  
  /* Ensure proper spacing around math blocks */
  math-display, .math-display {
    margin: 1em 0 !important;
  }
`;

// Cache the processor to avoid recreating it on every render
const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypeStringify);

export function MarkdownWithMath({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const [processedHtml, setProcessedHtml] = useState('');

  useEffect(() => {
    // Add global styles if not already added
    if (!styleRef.current && typeof document !== 'undefined') {
      styleRef.current = document.createElement('style');
      styleRef.current.textContent = mathStyles;
      document.head.appendChild(styleRef.current);
    }

    let isMounted = true;

    const processMarkdown = async () => {
      try {
        // Process markdown through unified/remark/rehype pipeline
        const file = await markdownProcessor.process(content);
        if (isMounted) {
          setProcessedHtml(String(file));
        }
      } catch (error) {
        console.error('Error processing markdown:', error);
        if (isMounted) {
          setProcessedHtml(content);
        }
      }
    };

    processMarkdown();

    return () => {
      isMounted = false;
      if (styleRef.current && typeof document !== 'undefined') {
        document.head.removeChild(styleRef.current);
        styleRef.current = null;
      }
    };
  }, [content]);

  return (
    <div 
      ref={containerRef} 
      className="markdown-content" 
      style={{ whiteSpace: 'pre-wrap' }}
      dangerouslySetInnerHTML={{ __html: processedHtml }}
    />
  );
}
