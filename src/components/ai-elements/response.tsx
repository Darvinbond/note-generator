'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo } from 'react';
import { Streamdown } from 'streamdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        'ai-response size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className
      )}
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = 'Response';
