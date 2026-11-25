import { useSearchParams } from 'react-router';
import { hasRole, useCurrentUser } from '@/entities/session';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { BrigadesTab } from './brigades-tab';
import { ContractsTab } from './contracts-tab';
import { TemplatesTab } from './templates-tab';
import { UsersTab } from './users-tab';

export function RefsPage() {
  const user = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'brigades';

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Справочники</h1>
      <Tabs value={tab} onValueChange={(t) => setParams({ tab: t }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="brigades">Бригады</TabsTrigger>
          <TabsTrigger value="contracts">Договоры</TabsTrigger>
          <TabsTrigger value="stages">Этапы</TabsTrigger>
          {hasRole(user, 'ADMIN') && <TabsTrigger value="users">Пользователи</TabsTrigger>}
        </TabsList>
        <TabsContent value="brigades">
          <BrigadesTab />
        </TabsContent>
        <TabsContent value="contracts">
          <ContractsTab />
        </TabsContent>
        <TabsContent value="stages">
          <TemplatesTab />
        </TabsContent>
        {hasRole(user, 'ADMIN') && (
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
