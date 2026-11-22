import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { REPORT_TYPES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("reports.view")) redirect("/?error=forbidden");
  return (
    <div>
      <PageHeader title="Reports" description="Filter by date, product, and category, then export to Excel or PDF." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORT_TYPES.map((report) => (
          <Link key={report.type} href={`/reports/${report.type}`}>
            <Card className="h-full transition hover:border-primary">
              <CardContent>
                <h2 className="font-semibold">{report.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{report.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
