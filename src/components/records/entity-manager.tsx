"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/data/page-header";

type Item = { id: string } & Record<string, string | number | null | undefined>;
type Result = { ok: boolean; error?: string; message?: string };

export function EntityManager({
  items,
  columns,
  fields,
  onSave,
  onDelete,
  addLabel,
  empty,
}: {
  items: Item[];
  columns: { key: string; label: string }[];
  fields: { name: string; label: string; textarea?: boolean }[];
  onSave: (values: Record<string, string>, id?: string) => Promise<Result>;
  onDelete: (id: string) => Promise<Result>;
  addLabel: string;
  empty: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [pending, start] = useTransition();

  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  function submit(formData: FormData) {
    const values = Object.fromEntries(fields.map((field) => [field.name, String(formData.get(field.name) ?? "")]));
    start(async () => {
      const result = await onSave(values, editing?.id);
      if (!result.ok) {
        toast.error(result.error ?? "Could not save");
        return;
      }
      toast.success(result.message ?? "Saved");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={openNew}>{addLabel}</Button>
      </div>
      {items.length === 0 ? <EmptyState title="Nothing here yet" description={empty} /> : (
        <Table>
          <THead>
            <tr>
              {columns.map((column) => <TH key={column.key}>{column.label}</TH>)}
              <TH />
            </tr>
          </THead>
          <tbody>
            {items.map((item) => (
              <TR key={item.id}>
                {columns.map((column) => <TD key={column.key}>{item[column.key] ?? "—"}</TD>)}
                <TD className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(item); setOpen(true); }}>Edit</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="sm">Delete</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this record?</AlertDialogTitle>
                        <AlertDialogDescription>This cannot be undone. Records that are already used by products or documents will be kept.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={(event) => {
                          event.preventDefault();
                          start(async () => {
                            const result = await onDelete(item.id);
                            if (!result.ok) toast.error(result.error ?? "Could not delete");
                            else {
                              toast.success(result.message ?? "Deleted");
                              router.refresh();
                            }
                          });
                        }}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : addLabel}</DialogTitle>
          </DialogHeader>
          <form action={submit} className="grid gap-3">
            {fields.map((field) => (
              <Field key={field.name} label={field.label}>
                {field.textarea ? <Textarea name={field.name} defaultValue={String(editing?.[field.name] ?? "")} /> : <Input name={field.name} defaultValue={String(editing?.[field.name] ?? "")} />}
              </Field>
            ))}
            <Button disabled={pending}>{pending ? "Saving..." : "Save"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
