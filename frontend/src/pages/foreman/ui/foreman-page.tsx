import { Link } from 'react-router';
import { NotificationList, useNotifications } from '@/entities/notification';
import { LiftBars, useObjects } from '@/entities/object';
import { useCurrentUser } from '@/entities/session';
import { InstallHint } from '@/features/pwa';
import { Card } from '@/shared/ui/card';
import { ChevronRight } from '@/shared/ui/icons';
import { Progress } from '@/shared/ui/progress';
import { CardsSkeleton } from '@/shared/ui/skeletons';

/** Экран бригадира: объекты его бригады. Отметка этапа с фото — следующий шаг. */
export function ForemanPage() {
  const user = useCurrentUser();
  const objects = useObjects();
  const fresh = (useNotifications().data?.items ?? []).filter((n) => n.unread).slice(0, 3);
  const active = (objects.data ?? [])
    .filter((o) => o.state !== 'DONE')
    .sort((a, b) => a.percent - b.percent);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Мои объекты</h1>
      <InstallHint />
      {fresh.length > 0 && <NotificationList items={fresh} />}
      {user.role === 'FOREMAN' && !user.brigadeId && (
        <p className="text-sm text-muted-foreground">
          Вы пока не привязаны к бригаде — попросите руководителя.
        </p>
      )}
      {objects.isPending ? (
        <CardsSkeleton count={4} />
      ) : active.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Объектов пока нет. Когда руководитель назначит объект, он появится здесь.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((o) => (
            <Link key={o.id} to={`/objects/${o.id}`} className="block h-full">
              <Card className="h-full gap-2 p-4 active:bg-muted">
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-medium">{o.shortAddress}</div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
                {o.lifts.length > 1 ? (
                  <LiftBars lifts={o.lifts} />
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground">
                      {o.currentStage
                        ? `Сейчас: ${o.currentStage.shortName} · ${o.percent}%`
                        : 'Новый объект'}
                    </div>
                    <Progress value={o.percent} />
                    {o.nextStage && (
                      <div className="text-sm">Следующий: {o.nextStage.shortName}</div>
                    )}
                  </>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
