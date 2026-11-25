import { ArrowLeft, House } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/shared/ui/button';
import { ElevatorScene } from '@/shared/ui/elevator-scene';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <ElevatorScene
      display="404"
      title="Такого этажа нет"
      text="Лифт доехал, но страницы по этому адресу не существует. Возможно, ссылка устарела или объект удалили."
      actions={
        <>
          <Button asChild>
            <Link to="/">
              <House />
              На главную
            </Link>
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft />
            Назад
          </Button>
        </>
      }
    />
  );
}
