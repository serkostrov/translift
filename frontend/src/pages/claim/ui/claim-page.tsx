import { useNavigate, useParams } from 'react-router';
import { ClaimCard } from '@/features/claim';
import { Button } from '@/shared/ui/button';
import { ArrowLeft } from '@/shared/ui/icons';

/** Рекламация на отдельной странице: ссылку можно переслать, «Назад» возвращает в список. */
export function ClaimPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
        <ArrowLeft />
        Назад
      </Button>
      <ClaimCard id={id} />
    </div>
  );
}
