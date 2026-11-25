import { ThemeProvider } from 'next-themes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { QueryProvider } from '@/app/providers/query-provider';
import { router } from '@/app/router';
import { Toaster } from '@/shared/ui/sonner';
import { TooltipProvider } from '@/shared/ui/tooltip';
import '@/app/styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster position="top-center" />
        </TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  </StrictMode>,
);
