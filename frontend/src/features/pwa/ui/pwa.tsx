/// <reference types="vite-plugin-pwa/react" />

import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';

/** Регистрирует service worker и предлагает обновиться, когда вышла новая версия. */
export function PwaUpdater() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Проверяем обновления раз в час — приложение может быть открыто весь день
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast('Доступна новая версия приложения', {
      duration: Number.POSITIVE_INFINITY,
      action: { label: 'Обновить', onClick: () => void updateServiceWorker(true) },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> };

const DISMISS_KEY = 'pwa-install-dismissed';
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/**
 * Подсказка «Установите на телефон». Android/Chrome — кнопка установки,
 * iPhone — инструкция «Поделиться → На экран Домой». Скрывается навсегда по крестику.
 */
export function InstallHint() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(
    () => isStandalone() || localStorage.getItem(DISMISS_KEY) === '1',
  );

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (hidden || (!prompt && !isIos())) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  };

  return (
    <Card className="flex-row items-center gap-3 border-dashed p-3 text-sm">
      <img src="/pwa-64x64.png" alt="" className="size-10 rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">Установите Транслифт на телефон</div>
        <div className="text-muted-foreground">
          {prompt ? (
            'Откроется отдельным окном, как приложение'
          ) : (
            <>
              Нажмите <Share className="inline size-4 align-text-bottom" /> «Поделиться», затем «На
              экран Домой»
            </>
          )}
        </div>
      </div>
      {prompt && (
        <Button
          size="sm"
          onClick={async () => {
            await prompt.prompt();
            setPrompt(null);
          }}
        >
          <Download />
          Установить
        </Button>
      )}
      <Button size="icon" variant="ghost" aria-label="Скрыть" onClick={dismiss}>
        <X />
      </Button>
    </Card>
  );
}
