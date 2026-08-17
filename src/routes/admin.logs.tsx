import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollText } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { api } from "@/lib/api";

export const Route = createFileRoute("/admin/logs")({
  component: LogsPage,
});

interface LogEntry {
  id: number;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

const PAGE = 50;

function LogsPage() {
  const [actionFilter, setActionFilter] = useState("");
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", actionFilter, offset],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (actionFilter) params.set("action", actionFilter);
      return api<{ data: LogEntry[]; total: number }>(`/api/logs?${params.toString()}`);
    },
  });

  const entries = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Activity Logs"
        description="Audit trail of admin actions. Currently records logins and media library changes."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filter by action (e.g. auth.login)"
          value={actionFilter}
          onChange={(e) => {
            setOffset(0);
            setActionFilter(e.target.value.trim());
          }}
          className="max-w-xs"
        />
        <div className="ml-auto text-sm text-muted-foreground">
          {total} {total === 1 ? "entry" : "entries"}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
                <ScrollText className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold">No activity yet</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Audit entries appear here as admins sign in and act on the system.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">{e.actor_email ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{e.action}</TableCell>
                    <TableCell className="text-xs">
                      {e.entity_type ? `${e.entity_type}${e.entity_id ? `/${e.entity_id.slice(0, 8)}` : ""}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.ip ?? "—"}</TableCell>
                    <TableCell className="max-w-[320px] truncate font-mono text-[11px] text-muted-foreground">
                      {e.metadata && Object.keys(e.metadata).length > 0
                        ? JSON.stringify(e.metadata)
                        : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > PAGE && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE))}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            {offset + 1}–{Math.min(offset + PAGE, total)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={offset + PAGE >= total}
            onClick={() => setOffset((o) => o + PAGE)}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
