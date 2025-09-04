import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { UIMessage } from 'ai';
import type { ComponentProps, HTMLAttributes } from 'react';
import { MarkdownWithMath } from '../markdown-with-math';

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage['role'];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      'group flex w-full items-end justify-end gap-2 py-4',
      from === 'user' ? 'is-user' : 'is-assistant flex-row-reverse justify-end',
      // Default cap bubble width to 80%, but allow assistant to be full width
      'd[&>div]:max-w-[80%] group-[.is-assistant]:[&>div]:max-w-none group-[.is-assistant]:[&>div]:w-full',
      className
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => {
  // Check if children is a string (for text content)
  const content = typeof children === 'string' ? children : '';
  
  return (
    <div
      className={cn(
        'flex flex-col gap-2 overflow-hidden rounded-lg px-4 py-3 text-foreground text-sm',
        // User bubble styling
        'group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground is-user:dark',
        // Assistant should be plain (no background) and edge-to-edge content
        'group-[.is-assistant]:bg-transparent group-[.is-assistant]:px-0 group-[.is-assistant]:py-0 group-[.is-assistant]:rounded-none',
        className
      )}
      {...props}
    >
      {typeof children === 'string' ? (
        <MarkdownWithMath content={content} />
      ) : (
        children
      )}
    </div>
  );
};

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};

export const MessageAvatar = ({
  src,
  name,
  className,
  ...props
}: MessageAvatarProps) => (
  <Avatar className={cn('size-8 ring-1 ring-border', className)} {...props}>
    <AvatarImage alt="" className="mt-0 mb-0" src={src} />
    <AvatarFallback>{name?.slice(0, 2) || 'ME'}</AvatarFallback>
  </Avatar>
);
