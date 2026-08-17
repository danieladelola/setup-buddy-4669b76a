import { createFileRoute } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";

export const Route = createFileRoute("/admin/segments")({
  component: SegmentsPage,
});

function SegmentsPage() {
  return (
    <>
      <PageHeader
        title="Segments"
        description="Dynamic audience groups built from contact attributes and engagement."
        actions={
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Create Segment
            <Badge variant="secondary" className="ml-2 text-[10px]">Coming soon</Badge>
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold">Segments not yet available</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            Segments will allow audience grouping by rules such as list membership,
            engagement (opens / clicks), status, and tags. The backend for segment
            evaluation has not been implemented yet.
          </p>
          <p className="text-xs text-muted-foreground">
            For now, use Contact Lists to organize audiences.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
