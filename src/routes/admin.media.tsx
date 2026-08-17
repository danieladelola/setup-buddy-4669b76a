import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Upload, Image as ImageIcon, Trash2, Copy, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/media")({
  component: MediaPage,
});

interface MediaAsset {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by_email: string | null;
  created_at: string;
  url: string;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function MediaPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["media"],
    queryFn: () => api<{ data: MediaAsset[]; total: number }>("/api/media"),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api("/api/media", { method: "POST", body: fd, raw: true });
    },
    onSuccess: () => {
      toast.success("Uploaded");
      qc.invalidateQueries({ queryKey: ["media"] });
    },
    onError: (e: any) => toast.error(e?.message || "Upload failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/media/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["media"] });
    },
    onError: (e: any) => toast.error(e?.message || "Delete failed"),
  });

  const onPick = () => fileRef.current?.click();
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadMutation.mutate(f);
    e.target.value = "";
  };

  const copy = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  };

  const assets = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Media Library"
        description="Upload images and reference them by URL in your campaigns and templates."
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onChange}
            />
            <Button onClick={onPick} disabled={uploadMutation.isPending}>
              <Upload className="mr-2 h-4 w-4" />
              {uploadMutation.isPending ? "Uploading…" : "Upload"}
            </Button>
          </>
        }
      />

      {isLoading ? (
        <Card>
          <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      ) : assets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold">No media uploaded yet</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Upload an image (PNG, JPG, GIF, WebP — up to 5 MB) and reference its URL
              in your email templates.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((a) => (
            <Card key={a.id} className="overflow-hidden">
              <div className="aspect-square w-full overflow-hidden bg-muted">
                <img
                  src={a.url}
                  alt={a.filename}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <CardContent className="space-y-2 p-3">
                <div className="truncate text-sm font-medium" title={a.filename}>
                  {a.filename}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatBytes(a.size_bytes)} · {new Date(a.created_at).toLocaleDateString()}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => copy(a.url, a.id)}
                  >
                    {copiedId === a.id ? (
                      <><Check className="mr-1 h-3 w-3" />Copied</>
                    ) : (
                      <><Copy className="mr-1 h-3 w-3" />URL</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Delete ${a.filename}?`)) deleteMutation.mutate(a.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
