import { Link } from 'react-router';
import { Button } from '@/shared/ui/button';

export function NotFoundPage() {
  return (
    <div className="space-y-3 py-10 text-center">
      <h1 className="text-xl font-semibold">Страница не найдена</h1>
      <Button asChild variant="outline">
        <Link to="/">На сводку</Link>
      </Button>
    </div>
  );
}
