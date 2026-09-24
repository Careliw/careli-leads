import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/crm/app-sidebar";
import { UserMenu } from "@/components/crm/user-menu";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar userMenu={<UserMenu />} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
