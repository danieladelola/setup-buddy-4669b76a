import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Plus, MoreHorizontal, Users, Pencil, Trash2, Search, Download, RefreshCw, Upload,
} from "lucide-react";
import { ImportContactsDialog } from "@/components/admin/import-contacts-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/admin/page-header";
import {
  createList, deleteList, downloadCsv, listExportUrl, listLists, listMembers,
  removeMember, updateList,
} from "@/lib/contactsApi";
import type { ListMember, ListRow } from "@/lib/contactsApi";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/lists")({
  component: ListsPage,
});

const PAGE_SIZE = 20;
const fmt = new Intl.NumberFormat("en-US");

function ListsPage() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ListRow | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState<ListRow | null>(null);
  const [membersOf, setMembersOf] = useState<ListRow | null>(null);
  const [members, setMembers] = useState<ListMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [importInto, setImportInto] = useState<ListRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await listLists(q.trim() || undefined);
      setRows(r.data);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  const openCreate = () => {
    setEditing(null); setName(""); setDescription(""); setFormOpen(true);
  };
  const openEdit = (l: ListRow) => {
    setEditing(l); setName(l.name); setDescription(l.description || ""); setFormOpen(true);
  };

  const submit = async () => {
    if (!name.trim()) return toast.error("List name is required");
    setSaving(true);
    try {
      if (editing) {
        await updateList(editing.id, { name: name.trim(), description: description.trim() || null });
        toast.success("List updated");
        setFormOpen(false);
        load();
      } else {
        const created = await createList({ name: name.trim(), description: description.trim() || undefined });
        toast.success("List created — import contacts now?");
        setFormOpen(false);
        await load();
        setImportInto({ ...created, member_count: 0 } as ListRow);
      }
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteList(toDelete.id);
      toast.success("List deleted");
      setToDelete(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const openMembers = async (l: ListRow) => {
    setMembersOf(l);
    setMembersLoading(true);
    try {
      const r = await listMembers(l.id);
      setMembers(r.data);
    } catch (e: any) { toast.error(e.message); }
    finally { setMembersLoading(false); }
  };

  const removeFromList = async (contactId: string) => {
    if (!membersOf) return;
    try {
      await removeMember(membersOf.id, contactId);
      setMembers((m) => m.filter((x) => x.id !== contactId));
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paged = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Contact Lists"
        description="Group contacts for targeted campaigns. Backed by contact_lists + contact_list_members."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
            <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Create List</Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search lists…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>List</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Members</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                ) : paged.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No lists yet. Create one to get started.
                  </TableCell></TableRow>
                ) : paged.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell className="text-muted-foreground">{l.description || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt.format(l.member_count)}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openMembers(l)}>
                            <Users className="mr-2 h-4 w-4" />View members
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(l)}>
                            <Pencil className="mr-2 h-4 w-4" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setImportInto(l)}>
                            <Upload className="mr-2 h-4 w-4" />Import contacts
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => downloadCsv(listExportUrl(l.id), `${l.name}.csv`).catch((e) => toast.error(e.message))}>
                            <Download className="mr-2 h-4 w-4" />Export members
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setToDelete(l)}>
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

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-2 text-sm text-muted-foreground">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <span>Page {page + 1} / {pages}</span>
              <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit list" : "Create list"}</DialogTitle>
            <DialogDescription>Lists let you target specific groups of contacts.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Description</Label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete list "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The list will be removed. Contacts in this list are not deleted.
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

      {/* Members modal */}
      <Dialog open={!!membersOf} onOpenChange={(o) => !o && setMembersOf(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{membersOf?.name} — members</DialogTitle>
            <DialogDescription>{members.length} member{members.length === 1 ? "" : "s"}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Award category</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {membersLoading ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                ) : members.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No members. Add contacts to this list from the Contacts page.</TableCell></TableRow>
                ) : members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.email}</TableCell>
                    <TableCell className="text-muted-foreground">{[m.first_name, m.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                    <TableCell>
                      {(() => {
                        const listName = membersOf?.name ?? "";
                        const cat = /award\s*$/i.test(listName) ? listName : m.award_category;
                        return cat
                          ? <Badge variant="secondary" className="whitespace-nowrap">{cat}</Badge>
                          : <span className="text-muted-foreground">—</span>;
                      })()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(m.added_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFromList(m.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <ImportContactsDialog
        open={!!importInto}
        onOpenChange={(o) => !o && setImportInto(null)}
        listId={importInto?.id || null}
        listName={importInto?.name || ""}
        onImported={() => { load(); if (membersOf && importInto && membersOf.id === importInto.id) openMembers(membersOf); }}
      />
    </>
  );
}
