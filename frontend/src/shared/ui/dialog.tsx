import { Dialog as DialogPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { XIcon } from '@/shared/ui/icons';

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Окно — одно на всё приложение:
 * - телефон (до 640px) — шторка снизу во всю ширину, с ручкой, прокручивается внутри;
 * - компьютер — крупный блок посередине экрана.
 * `size`: `md` — формы (по умолчанию), `lg` — широкие формы и карточки,
 * `viewer` — просмотр фото: по центру и на телефоне.
 */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  size = 'md',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  size?: 'md' | 'lg' | 'viewer';
}) {
  const sheet = size !== 'viewer';
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-size={size}
        className={cn(
          'fixed z-50 grid gap-4 bg-popover text-sm text-popover-foreground ring-1 ring-foreground/10 duration-200 outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
          sheet
            ? [
                // Телефон: шторка снизу
                'inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-xl p-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]',
                'max-sm:data-open:slide-in-from-bottom max-sm:data-closed:slide-out-to-bottom',
                // Компьютер: блок посередине
                'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[88dvh] sm:w-[calc(100%-3rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-6 sm:data-open:zoom-in-95 sm:data-closed:zoom-out-95',
                size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl',
              ]
            : 'top-1/2 left-1/2 w-full max-w-[min(96vw,1100px)] -translate-x-1/2 -translate-y-1/2 rounded-xl p-2 data-open:zoom-in-95 data-closed:zoom-out-95 sm:p-3',
          className,
        )}
        {...props}
      >
        {sheet && (
          <div
            aria-hidden
            className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/30 sm:hidden"
          />
        )}
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button variant="ghost" className="absolute top-3 right-3" size="icon-sm">
              <XIcon />
              <span className="sr-only">Закрыть</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1.5 pr-8', className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // Кнопки всегда видны: прилипают к низу окна, даже если форма длинная
        'sticky -bottom-4 z-10 -mx-4 -mb-4 flex flex-col-reverse gap-2 border-t bg-popover p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:px-6 sm:pb-4',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('font-heading text-lg leading-tight font-semibold', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        'text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
