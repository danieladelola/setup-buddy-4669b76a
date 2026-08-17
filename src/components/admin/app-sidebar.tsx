import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Send,
  
  Users,
  ListChecks,
  Filter,
  Mail,
  Inbox,
  BarChart3,
  LineChart,
  MousePointerClick,
  ShieldAlert,
  Ban,
  UserMinus,
  AtSign,
  Server,
  Cloud,
  Webhook,
  Images,
  ArrowDownUp,
  ScrollText,
  Settings,
  Rocket,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const groups = [
  {
    label: "Main",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/admin/campaigns", label: "Campaigns", icon: Send },
      { to: "/admin/contacts", label: "Contacts", icon: Users },
      { to: "/admin/lists", label: "Contact Lists", icon: ListChecks },
      { to: "/admin/segments", label: "Segments", icon: Filter },
      { to: "/admin/templates", label: "Email Templates", icon: Mail },
      { to: "/admin/queue", label: "Email Queue", icon: Inbox },
    ],
  },
  {
    label: "Analytics",
    items: [
      { to: "/admin/reports", label: "Reports", icon: BarChart3 },
      { to: "/admin/analytics", label: "Campaign Analytics", icon: LineChart },
      { to: "/admin/tracking", label: "Open & Click Tracking", icon: MousePointerClick },
      { to: "/admin/bounces", label: "Bounce & Complaint Logs", icon: ShieldAlert },
    ],
  },
  {
    label: "Deliverability",
    items: [
      { to: "/admin/suppression", label: "Suppression List", icon: Ban },
      { to: "/admin/unsubscribes", label: "Unsubscribes", icon: UserMinus },
      { to: "/admin/senders", label: "Senders", icon: AtSign },
      { to: "/admin/providers", label: "Email Providers", icon: Server },
      { to: "/admin/ses", label: "SES Configuration", icon: Cloud },
      { to: "/admin/sns", label: "SNS Webhooks", icon: Webhook },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/media", label: "Media Library", icon: Images },
      { to: "/admin/import-export", label: "Import / Export", icon: ArrowDownUp },
      { to: "/admin/logs", label: "Activity Logs", icon: ScrollText },
      { to: "/admin/settings", label: "Settings", icon: Settings },
      { to: "/admin/deployment", label: "Deployment", icon: Rocket },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b px-3 py-4">
        <Link to="/admin" className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-brand-glow text-primary-foreground shadow-md">
            <Mail className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight">HSENations</div>
              <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                Mail Platform
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-1">
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {g.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive(item.to, item.exact)} tooltip={item.label}>
                      <Link to={item.to} className="flex items-center gap-2.5">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
