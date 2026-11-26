import { type ImportResultDto, WORK_TYPE_LABELS, WORK_TYPES, type WorkType } from '@contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useBrigades, useContracts } from '@/entities/refs';
import { isManager, useCurrentUser } from '@/entities/session';
import { apiUrl, download, errorMessage, http } from '@/shared/api/http';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/field';
import { FileSpreadsheet, Loader2, Upload } from '@/shared/ui/icons';
import { Input } from '@/shared/ui/input';
import { SimpleSelect } from '@/shared/ui/simple-select';

const iso = (d: Date) => d.toLocaleDateString('en-CA');
const monthAgo = () => iso(new Date(Date.now() - 30 * 86_400_000));

/** Скачивание с индикатором и ошибкой в тосте. */
function useDownload() {
  const [busy, setBusy] = useState(false);
  const run = async (url: string) => {
    setBusy(true);
    try {
      await download(url);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

function DownloadButton({
  busy,
  onClick,
  disabled,
}: {
  busy: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button onClick={onClick} disabled={busy || disabled}>
      {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
      Скачать .xlsx
    </Button>
  );
}

export function ReportsPage() {
  const user = useCurrentUser();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Отчёты</h1>
        <p className="text-sm text-muted-foreground">
          Выгрузка в Excel. Отчёт по одному объекту — кнопка «Отчёт» в карточке объекта.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ContractorReport />
        <SummaryReport />
      </div>
      {isManager(user) && <ImportCard />}
    </div>
  );
}

function ContractorReport() {
  const contracts = useContracts();
  const active = (contracts.data ?? []).filter((c) => c.isActive);
  const [contractId, setContractId] = useState<string | null>(null);
  const [date, setDate] = useState(iso(new Date()));
  const dl = useDownload();
  const selected = contractId ?? active[0]?.id ?? null;

  return (
    <ReportCard
      title="Отчёт генподрядчику"
      description="Еженедельный отчёт об исполнении договора по форме генподрядчика. Строки, изменённые за неделю, подсвечены."
      footer={
        <DownloadButton
          busy={dl.busy}
          disabled={!selected}
          onClick={() => dl.run(apiUrl('/reports/contractor.xlsx', { contractId: selected, date }))}
        />
      }
    >
      <Field>
        <FieldLabel htmlFor="c-contract">Договор</FieldLabel>
        <SimpleSelect
          id="c-contract"
          value={selected}
          onChange={setContractId}
          placeholder={
            contracts.isPending ? 'Загружаем…' : 'Нет договоров — заведите в справочниках'
          }
          options={active.map((c) => ({
            value: c.id,
            label: `№ ${c.number} · ${c.customer.name}`,
          }))}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="c-date">Дата отчёта</FieldLabel>
        <Input id="c-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </ReportCard>
  );
}

function SummaryReport() {
  const contracts = useContracts();
  const brigades = useBrigades();
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(iso(new Date()));
  const [contractId, setContractId] = useState<string | null>(null);
  const [brigadeId, setBrigadeId] = useState<string | null>(null);
  const [includeDone, setIncludeDone] = useState(true);
  const dl = useDownload();

  return (
    <ReportCard
      title="Сводный отчёт"
      description="Все объекты или выборка: этап, процент, сроки, отметки за период, флаги, рекламации и финансы."
      footer={
        <DownloadButton
          busy={dl.busy}
          onClick={() =>
            dl.run(
              apiUrl('/reports/summary.xlsx', { from, to, contractId, brigadeId, includeDone }),
            )
          }
        />
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="s-from">С</FieldLabel>
          <Input
            id="s-from"
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="s-to">По</FieldLabel>
          <Input
            id="s-to"
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="s-contract">Договор</FieldLabel>
          <SimpleSelect
            id="s-contract"
            value={contractId}
            onChange={setContractId}
            noneLabel="Все договоры"
            options={(contracts.data ?? []).map((c) => ({ value: c.id, label: `№ ${c.number}` }))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="s-brigade">Бригада</FieldLabel>
          <SimpleSelect
            id="s-brigade"
            value={brigadeId}
            onChange={setBrigadeId}
            noneLabel="Все бригады"
            options={(brigades.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
          />
        </Field>
      </div>
      <Field orientation="horizontal">
        <Checkbox
          id="s-done"
          checked={includeDone}
          onCheckedChange={(v) => setIncludeDone(v === true)}
        />
        <FieldLabel htmlFor="s-done">Включать сданные объекты</FieldLabel>
      </Field>
    </ReportCard>
  );
}

function ReportCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
      <CardFooter>{footer}</CardFooter>
    </Card>
  );
}

const ACTION: Record<ImportResultDto['rows'][number]['action'], [string, string]> = {
  create: ['новый', 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'],
  update: ['обновится', 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200'],
  skip: ['пропуск', 'bg-muted text-muted-foreground'],
  error: ['ошибка', 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'],
};

/** Импорт объектов из Excel: сначала проверка, потом применение. */
function ImportCard() {
  const contracts = useContracts();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [workType, setWorkType] = useState<WorkType>('REPLACEMENT');
  const [contractId, setContractId] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResultDto | null>(null);

  const send = useMutation({
    mutationFn: (dryRun: boolean) => {
      const form = new FormData();
      form.set('file', file as File);
      form.set('workType', workType);
      form.set('dryRun', String(dryRun));
      if (contractId) form.set('contractId', contractId);
      return http<ImportResultDto>('/import/objects', { method: 'POST', body: form });
    },
    onSuccess: (r) => {
      setResult(r);
      if (!r.dryRun) {
        toast.success(`Импорт выполнен: новых ${r.created}, обновлено ${r.updated}`);
        qc.invalidateQueries({ queryKey: ['objects'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
      }
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Загрузка объектов из Excel</CardTitle>
        <CardDescription>
          Подходит отчёт генподрядчику в той же форме: найденные по адресу объекты обновятся, новые
          добавятся. Сначала покажем, что будет сделано.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <Field>
            <FieldLabel>Файл</FieldLabel>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => fileRef.current?.click()}
            >
              <Upload />
              <span className="truncate">{file?.name ?? 'Выбрать .xlsx'}</span>
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setResult(null);
                e.target.value = '';
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="i-type">Тип работ для новых</FieldLabel>
            <SimpleSelect
              id="i-type"
              value={workType}
              onChange={(v) => v && setWorkType(v as WorkType)}
              options={WORK_TYPES.map((t) => ({ value: t, label: WORK_TYPE_LABELS[t] }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="i-contract">Договор</FieldLabel>
            <SimpleSelect
              id="i-contract"
              value={contractId}
              onChange={setContractId}
              noneLabel="Не менять"
              options={(contracts.data ?? []).map((c) => ({ value: c.id, label: `№ ${c.number}` }))}
            />
            <FieldDescription>Назначится всем объектам из файла</FieldDescription>
          </Field>
        </div>

        {result && (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="text-sm">
              {result.dryRun ? 'Проверка: ' : 'Готово: '}
              новых <b>{result.created}</b>, обновится <b>{result.updated}</b>
              {result.errors > 0 && (
                <>
                  , ошибок <b className="text-destructive">{result.errors}</b>
                </>
              )}
            </div>
            <ul className="max-h-80 divide-y overflow-y-auto text-sm">
              {result.rows.map((r) => (
                <li key={r.row} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-1.5">
                  <span className="w-10 text-xs text-muted-foreground tabular-nums">
                    стр. {r.row}
                  </span>
                  <Badge variant="secondary" className={cn('border-0', ACTION[r.action][1])}>
                    {ACTION[r.action][0]}
                  </Badge>
                  <span className="min-w-0 flex-1 basis-48">{r.address}</span>
                  {r.stage && <span className="text-muted-foreground">{r.stage}</span>}
                  {r.messages.map((m) => (
                    <span key={m} className="basis-full text-xs text-amber-700 dark:text-amber-400">
                      {m}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={!file || send.isPending}
          onClick={() => send.mutate(true)}
        >
          {send.isPending && send.variables ? <Loader2 className="animate-spin" /> : null}
          Проверить
        </Button>
        <Button
          disabled={!file || !result?.dryRun || send.isPending}
          onClick={() => send.mutate(false)}
        >
          {send.isPending && !send.variables ? <Loader2 className="animate-spin" /> : null}
          Загрузить
        </Button>
      </CardFooter>
    </Card>
  );
}
