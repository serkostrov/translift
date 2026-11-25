/** Заглушка страницы, которая ещё не реализована. */
export function PageStub({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{children ?? 'Раздел в разработке.'}</p>
    </div>
  );
}
