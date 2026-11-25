import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiUrl, download, errorMessage } from '@/shared/api/http';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { Field, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';

const iso = (d: Date) => d.toLocaleDateString('en-CA');

/** Отчёт по объекту за период: этапы, процент, отметки, даты, финансы, рекламации. */
export function ObjectReportDialog({
  objectId,
  openedDate,
  triggerClassName,
}: {
  objectId: string;
  openedDate: string | null;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(openedDate ?? iso(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(iso(new Date()));
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await download(apiUrl(`/reports/objects/${objectId}/report.xlsx`, { from, to }));
      setOpen(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={triggerClassName}>
          <FileSpreadsheet />
          Отчёт
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Отчёт по объекту</DialogTitle>
          <DialogDescription>
            Excel: этапы, отметки за период, даты, финансы и рекламации.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="rep-from">С</FieldLabel>
            <Input
              id="rep-from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="rep-to">По</FieldLabel>
            <Input
              id="rep-to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={run} disabled={busy || !from || !to}>
            {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
            Скачать .xlsx
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
