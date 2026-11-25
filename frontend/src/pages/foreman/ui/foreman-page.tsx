import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { useObjects } from '@/entities/object';
import { useCurrentUser } from '@/entities/session';
import { Card } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';
import { Skeleton } from '@/shared/ui/skeleton';

/** Экран бригадира: объекты его бригады. Отметка этапа с фото — следующий шаг. */
export function ForemanPage() {
  const user = useCurrentUser();
  const objects = useObjects();
  const active = (objects.data ?? [])
    .filter((o) => o.state !== 'DONE')
    .sort((a, b) => a.percent - b.percent);

  return (
    <div className="mx-auto max-w-md space-y-3">
      <h1 className="text-xl font-semibold">Мои объекты</h1>
      {user.role === 'FOREMAN' && !user.brigadeId && (
        <p className="text-sm text-muted-foreground">
          Вы пока не привязаны к бригаде — попросите руководителя.
        </p>
      )}
      {objects.isPending ? (
        <Skeleton className="h-40" />
      ) : active.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Объектов пока нет. Когда руководитель назначит объект, он появится здесь.
        </Card>
      ) : (
        active.map((o) => (
          <Link key={o.id} to={`/objects/${o.id}`} className="block">
            <Card className="gap-2 p-4 active:bg-muted">
              <div className="flex items-center gap-2">
                <div className="flex-1 font-medium">{o.shortAddress}</div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
              <div className="text-sm text-muted-foreground">
                {o.currentStage
                  ? `Сейчас: ${o.currentStage.shortName} · ${o.percent}%`
                  : 'Новый объект'}
              </div>
              <Progress value={o.percent} />
              {o.nextStage && <div className="text-sm">Следующий: {o.nextStage.shortName}</div>}
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}
