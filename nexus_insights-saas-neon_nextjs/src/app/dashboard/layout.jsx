import CompanyGuard from '@/components/CompanyGuard';

export default function DashboardLayout({ children }) {
  return (
    <>
      <CompanyGuard />
      {children}
    </>
  );
}
