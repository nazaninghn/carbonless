import CompanyGuard from '@/components/CompanyGuard';
import DialogFocus from '@/components/DialogFocus';

export default function DashboardLayout({ children }) {
  return (
    <>
      <CompanyGuard />
      <DialogFocus />
      {children}
    </>
  );
}
