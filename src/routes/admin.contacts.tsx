import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Search, Upload, Download, MoreHorizontal, Trash2, Pencil,
  ChevronLeft, ChevronRight, RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { ContactFormDialog } from "@/components/admin/contact-form-dialog";
import {
  bulkDeleteContacts, deleteContact, downloadCsv, exportContactsUrl,
  importContacts, listContacts, listLists,
} from "@/lib/contactsApi";
import type { Contact, ListRow } from "@/lib/contactsApi";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/contacts")({
  component: ContactsPage,
});

const PAGE_SIZE = 25;

function ContactsPage() {
  const [rows, setRows] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [listId, setListId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<string[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async (resetPage = false) => {
    setLoading(true);
    try {
      const p = resetPage ? 0 : page;
      if (resetPage) setPage(0);
      const data = await listContacts({
        q: q.trim() || undefined,
        status: status === "all" ? undefined : status,
        list_id: listId === "all" ? undefined : listId,
        limit: PAGE_SIZE,
        offset: p * PAGE_SIZE,
      });
      setRows(data.data);
      setTotal(data.total);
      setSelected([]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadLists = async () => {
    try {
      const r = await listLists();
      setLists(r.data);
    } catch (e: any) {
      /* surfaced elsewhere */
    }
  };

  useEffect(() => { loadLists(); }, []);
  // load on filter changes & pagination
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, status, listId]);
  // debounced search
  useEffect(() => {
    const t = setTimeout(() => load(true), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allSelected = rows.length > 0 && selected.length === rows.length;
  const toggleAll = () => setSelected(allSelected ? [] : rows.map((r) => r.id));
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const onImport = async (file: File) => {
    try {
      const r = await importContacts(file, listId !== "all" ? listId : undefined);
      toast.success(
        `Import: ${r.inserted} new, ${r.updated} updated, ${r.duplicates} duplicates, ${r.invalid} invalid (of ${r.total})`,
      );
      load(true);
      loadLists();
    } catch (e: any) { toast.error(e.message); }
  };

  const onExport = async () => {
    try {
      await downloadCsv(
        exportContactsUrl({ q: q || undefined, list_id: listId !== "all" ? listId : undefined }),
        "contacts.csv",
      );
    } catch (e: any) { toast.error(e.message); }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      if (toDelete.length === 1) await deleteContact(toDelete[0]);
      else await bulkDeleteContacts(toDelete);
      toast.success("Deleted");
      setToDelete(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const fmtName = (c: Contact) =>
    [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";

  const statusVariant = (s: string) =>
    s === "subscribed" ? "default" : s === "unsubscribed" ? "secondary" : "destructive";

  const showingFrom = useMemo(() => (total === 0 ? 0 : page * PAGE_SIZE + 1), [page, total]);
  const showingTo = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Contacts"
        description="All contacts stored in the contacts table."
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
            />
            <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />Import CSV
            </Button>
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />Export
            </Button>
            <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />Add Contact
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, email, phone, company, status…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="subscribed">Subscribed</SelectItem>
                <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                <SelectItem value="bounced">Bounced</SelectItem>
                <SelectItem value="complained">Complained</SelectItem>
              </SelectContent>
            </Select>
            <Select value={listId} onValueChange={setListId}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All lists" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All lists</SelectItem>
                {lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {selected.length > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">{selected.length} selected</span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" className="text-destructive"
                  onClick={() => setToDelete(selected)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />Delete
                </Button>
              </div>
            </div>
          )}

          <div className="mt-4 overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Award category</TableHead>
                  <TableHead>Lists</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                    No contacts. Add one or import a CSV to get started.
                  </TableCell></TableRow>
                ) : rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{fmtName(c)}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.company || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.award_category ? (
                        <div className="flex flex-wrap gap-1">
                          {c.award_category.split(", ").map((a) => (
                            <Badge key={a} variant="secondary" className="text-xs font-normal">{a}</Badge>
                          ))}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.lists.length === 0 ? "—" : (
                        <div className="flex flex-wrap gap-1">
                          {c.lists.slice(0, 3).map((l) => (
                            <Badge key={l.id} variant="outline" className="text-xs">{l.name}</Badge>
                          ))}
                          {c.lists.length > 3 && <Badge variant="outline" className="text-xs">+{c.lists.length - 3}</Badge>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={statusVariant(c.status) as any}>{c.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(c); setFormOpen(true); }}>
                            <Pencil className="mr-2 h-4 w-4" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setToDelete([c.id])}>
                            <Trash2 className="mr-2 h-4 w-4" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <div>{total === 0 ? "0 contacts" : `Showing ${showingFrom}–${showingTo} of ${total}`}</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>Page {page + 1} / {pages}</span>
              <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page + 1 >= pages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ContactFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editing}
        lists={lists}
        onSaved={() => { load(); loadLists(); }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.length === 1 ? "contact" : `${toDelete?.length} contacts`}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The contact{toDelete && toDelete.length > 1 ? "s" : ""} will be removed from all lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
