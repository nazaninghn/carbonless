import AuthGate from "@/components/AuthGate";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function DashboardLayout({ children }) {
  return (
    <AuthGate>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <Topbar />
          <main className="flex-1 px-8 pt-7 pb-12 max-w-[1200px] w-full">{children}</main>
        </div>
      </div>
    </AuthGate>
  );
}
