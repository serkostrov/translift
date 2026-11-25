import { useHealth } from '@/entities/health';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

export function DashboardPage() {
  const health = useHealth();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Сводка</h1>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Состояние сервера</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          {health.isPending && <Badge variant="secondary">Проверяем…</Badge>}
          {health.isError && <Badge variant="destructive">Сервер недоступен</Badge>}
          {health.data && (
            <>
              <Badge variant={health.data.db ? 'default' : 'destructive'}>База данных</Badge>
              <Badge variant={health.data.storage ? 'default' : 'destructive'}>Хранилище S3</Badge>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
