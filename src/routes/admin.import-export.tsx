import { createFileRoute, Link } from "@tanstack/react-router";
import { Upload, Download, Users, ListChecks, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";

export const Route = createFileRoute("/admin/import-export")({
  component: ImportExportPage,
});

function ImportExportPage() {
  return (
    <>
      <PageHeader
        title="Import / Export"
        description="Move contacts and data in and out of HSENations Mail."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> Import
            </CardTitle>
            <CardDescription>
              Use the contacts and lists pages to import CSV files into specific destinations.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/admin/contacts">
                <Users className="mr-2 h-4 w-4" />
                Import contacts (Contacts page)
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/admin/lists">
                <ListChecks className="mr-2 h-4 w-4" />
                Import into a contact list (Lists page)
              </Link>
            </Button>
            <p className="pt-2 text-xs text-muted-foreground">
              A global cross-entity import is not yet supported.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-4 w-4" /> Export
            </CardTitle>
            <CardDescription>
              Export contacts, list members, and suppression data from their respective pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/admin/contacts">
                <Users className="mr-2 h-4 w-4" />
                Export contacts (Contacts page)
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/admin/lists">
                <ListChecks className="mr-2 h-4 w-4" />
                Export a list&apos;s members (Lists page)
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/admin/suppression">
                <Ban className="mr-2 h-4 w-4" />
                Suppression list
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" disabled>
              <Download className="mr-2 h-4 w-4" />
              Export campaigns
              <Badge variant="secondary" className="ml-2 text-[10px]">Coming soon</Badge>
            </Button>
            <Button variant="outline" className="justify-start" disabled>
              <Download className="mr-2 h-4 w-4" />
              Export tracking events
              <Badge variant="secondary" className="ml-2 text-[10px]">Coming soon</Badge>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardContent className="px-5 py-4 text-xs text-muted-foreground">
          Job history for imports / exports is not tracked yet. Each import or export
          runs synchronously from its source page and reports results inline.
        </CardContent>
      </Card>
    </>
  );
}
