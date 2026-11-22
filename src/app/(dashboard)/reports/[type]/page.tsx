import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { Pagination, QuerySelect, SearchBox } from "@/components/data/controls";
import { PageHeader } from "@/components/data/page-header";
import { PrintButton } from "@/components/print-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { isReportType } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { first } from "@/lib/utils";
import { getSettingsDto } from "@/server/guard";
import { listCategories } from "@/server/services/catalog";
import { buildReport } from "@/server/services/reports";

export const dynamic = "force-dynamic";

const moneyColumns = new Set(["Cost", "Selling", "Stock value", "Retail value", "Value", "Subtotal", "Tax", "Total", "Discount", "Revenue", "Profit", "Purchase total", "Price"]);

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("reports.view")) redirect("/?error=forbidden");
  const { type } = await params;
  if (!isReportType(type)) notFound();
  const sp = await searchParams;
  const from = first(sp.from);
  const to = first(sp.to);
  const categoryId = first(sp.categoryId);
  const q = first(sp.q);
  const [report, categories, settings] = await Promise.all([
    buildReport(type, {
      q,
      categoryId,
      from: from ? new Date(`${from}T00:00:00`) : undefined,
      to: to ? new Date(`${to}T23:59:59`) : undefined,
      page: Number(first(sp.page) ?? 1),
      pageSize: 50,
    }),
    listCategories(),
    getSettingsDto(),
  ]);
  const exportQuery = new URLSearchParams({ type, format: "xlsx" });
  if (q) exportQuery.set("q", q);
  if (categoryId) exportQuery.set("categoryId", categoryId);
  if (from) exportQuery.set("from", from);
  if (to) exportQuery.set("to", to);
  const pdfQuery = new URLSearchParams(exportQuery);
  pdfQuery.set("format", "pdf");

  return (
    <div>
      <PageHeader title={report.title} description="The table is paged. Exports include the filtered rows, up to 10,000.">
        <Button asChild variant="outline"><Link href={`/api/reports/export?${exportQuery.toString()}`}>Export Excel</Link></Button>
        <Button asChild variant="outline"><Link href={`/api/reports/export?${pdfQuery.toString()}`}>Export PDF</Link></Button>
        <PrintButton />
      </PageHeader>
      <Card>
        <div className="grid gap-3 p-4 md:grid-cols-4">
          <SearchBox placeholder="Product name or SKU" />
          <QuerySelect name="categoryId" label="Category" value={categoryId} options={categories.map((item) => ({ value: item.id, label: item.name }))} />
          <form className="contents" action={`/reports/${type}`}>
            {q ? <input type="hidden" name="q" value={q} /> : null}
            {categoryId ? <input type="hidden" name="categoryId" value={categoryId} /> : null}
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">From<input className="h-10 rounded-lg border border-input bg-card px-3" type="date" name="from" defaultValue={from} /></label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">To<input className="h-10 rounded-lg border border-input bg-card px-3" type="date" name="to" defaultValue={to} /></label>
            <Button className="self-end" type="submit" variant="secondary">Apply dates</Button>
          </form>
        </div>
        <Table>
          <THead><tr>{report.columns.map((column) => <TH key={column}>{column}</TH>)}</tr></THead>
          <tbody>
            {report.rows.length === 0 ? <TR><TD colSpan={report.columns.length}>No rows for these filters.</TD></TR> : report.rows.map((row, index) => (
              <TR key={index}>
                {row.map((cell, cellIndex) => (
                  <TD key={cellIndex}>{typeof cell === "number" && moneyColumns.has(report.columns[cellIndex]) ? formatMoney(cell, settings.currency) : String(cell)}</TD>
                ))}
              </TR>
            ))}
          </tbody>
        </Table>
        <Pagination page={report.page} pages={Math.max(1, Math.ceil(report.total / report.pageSize))} total={report.total} pageSize={report.pageSize} params={{ q, categoryId, from, to }} />
      </Card>
    </div>
  );
}
