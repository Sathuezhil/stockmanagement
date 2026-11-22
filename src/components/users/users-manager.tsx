"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveUserAction } from "@/server/actions/system";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type UserRow = { id: string; name: string; email: string; phone: string | null; role: string; roleName: string; isActive: boolean };

export function UsersManager({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [active, setActive] = useState(true);
  const [pending, start] = useTransition();

  function submit(formData: FormData) {
    start(async () => {
      const result = await saveUserAction({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
        role: formData.get("role"),
        phone: formData.get("phone"),
        isActive: active,
      }, editing?.id);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setEditing(null); setActive(true); setOpen(true); }}>Add user</Button>
      </div>
      <Table>
        <THead><tr><TH>Name</TH><TH>Email</TH><TH>Role</TH><TH>Status</TH><TH /></tr></THead>
        <tbody>
          {users.map((user) => (
            <TR key={user.id}>
              <TD>{user.name}</TD>
              <TD>{user.email}</TD>
              <TD><Badge value={user.role} /></TD>
              <TD>{user.isActive ? "Active" : "Inactive"}</TD>
              <TD className="text-right"><Button variant="ghost" size="sm" onClick={() => { setEditing(user); setActive(user.isActive); setOpen(true); }}>Edit</Button></TD>
            </TR>
          ))}
        </tbody>
      </Table>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit user" : "Add user"}</DialogTitle></DialogHeader>
          <form action={submit} className="grid gap-3">
            <Field label="Name"><Input name="name" defaultValue={editing?.name ?? ""} required /></Field>
            <Field label="Email"><Input name="email" type="email" defaultValue={editing?.email ?? ""} required /></Field>
            <Field label="Phone"><Input name="phone" defaultValue={editing?.phone ?? ""} /></Field>
            <Field label={editing ? "New password (optional)" : "Password"}><Input name="password" type="password" minLength={editing ? undefined : 8} /></Field>
            <Field label="Role">
              <Select name="role" defaultValue={editing?.role ?? "STAFF"}>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="STAFF">Staff</option>
              </Select>
            </Field>
            <label className="flex items-center justify-between text-sm">Active<Switch checked={active} onCheckedChange={setActive} /></label>
            <Button disabled={pending}>{pending ? "Saving..." : "Save user"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
