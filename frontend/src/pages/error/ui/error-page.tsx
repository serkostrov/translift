import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '@/shared/ui/button';
import { ElevatorScene } from '@/shared/ui/elevator-scene';
import { House, RotateCw } from '@/shared/ui/icons';

/** Ошибка при отрисовке страницы (errorElement роутера). */
export function ErrorPage() {
  const error = useRouteError();
  const details = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error);

  // После выкладки новой версии старые куски приложения могут не загрузиться — лечится обновлением
  const outdated = /dynamically imported module|Failed to fetch|Importing a module script/i.test(
    details,
  );

  return (
    <div className="min-h-full bg-background">
      <ElevatorScene
        display="⚠"
        stuck
        title={outdated ? 'Вышла новая версия' : 'Лифт застрял между этажами'}
        text={
          <>
            <p>
              {outdated
                ? 'Обновите страницу, чтобы загрузить свежую версию приложения.'
                : 'Что-то пошло не так. Попробуйте обновить страницу. Если повторится — сообщите администратору, что делали перед этим.'}
            </p>
            {!outdated && (
              <details className="mt-3 text-left text-xs">
                <summary className="cursor-pointer">Подробности для администратора</summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-2 whitespace-pre-wrap">
                  {details}
                </pre>
              </details>
            )}
          </>
        }
        actions={
          <>
            <Button onClick={() => window.location.reload()}>
              <RotateCw />
              Обновить
            </Button>
            <Button variant="outline" onClick={() => window.location.assign('/')}>
              <House />
              На главную
            </Button>
          </>
        }
      />
    </div>
  );
}
