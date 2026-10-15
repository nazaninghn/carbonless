import CompanyGuard from '@/components/CompanyGuard';
import DialogFocus from '@/components/DialogFocus';
import OfflineBanner from '@/components/OfflineBanner';

export default function DashboardLayout({ children }) {
  return (
    <>
      <CompanyGuard />
      <DialogFocus />
      <OfflineBanner />
      {children}
    </>
  );
}
