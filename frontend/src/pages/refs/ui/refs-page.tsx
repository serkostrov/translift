import { useSearchParams } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { BrigadesTab } from './brigades-tab';
import { ContractsTab } from './contracts-tab';
import { TemplatesTab } from './templates-tab';

export function RefsPage() {
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
      </Tabs>
    </div>
  );
}
