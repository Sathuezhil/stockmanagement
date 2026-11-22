import { Warehouse } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-[#0b1220] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.18),transparent_36%),linear-gradient(160deg,#0b1220,#122033)]" />
        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-teal-400 text-slate-950">
            <Warehouse className="size-5" />
          </div>
          <div>
            <p className="text-lg font-semibold">SS Stationers</p>
            <p className="text-sm text-slate-400">Stationery for schools and offices</p>
          </div>
        </div>
        <div className="relative my-auto max-w-lg">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">A clear view of every unit in stock.</h1>
          <p className="mt-4 text-slate-300">Track products, purchases, sales, and stock movements with role-based access and a full audit trail.</p>
        </div>
      </section>
      <section className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">Use your staff account to open the workspace.</p>
          <LoginForm />
          <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">First-run accounts</p>
            <p className="mt-2">admin@stockpro.local · Admin@12345</p>
            <p>manager@stockpro.local · Manager@12345</p>
            <p>staff@stockpro.local · Staff@12345</p>
          </div>
        </div>
      </section>
    </div>
  );
}
