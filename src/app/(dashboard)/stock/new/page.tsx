import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { StockForm } from "@/components/stock/stock-form";
import { first } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewStockPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth();
  if (!session?.user.permissions.includes("stock.manage")) redirect("/?error=forbidden");
  const sp = await searchParams;
  return (
    <div>
      <PageHeader title="Record stock movement" description="Negative stock is blocked unless an administrator has enabled it in settings." />
      <StockForm initialProductId={first(sp.productId)} />
    </div>
  );
}
