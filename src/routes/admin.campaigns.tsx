import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/campaigns")({
  component: CampaignsLayout,
});

function CampaignsLayout() {
  return <Outlet />;
}