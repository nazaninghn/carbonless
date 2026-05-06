import Link from 'next/link';

export default function HeaderLogo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <img src="/carbonless.png" alt="Carbonless" className="h-11 w-11 sm:h-14 sm:w-14" />
      <span className="text-[20px] sm:text-[22px] font-bold tracking-tight text-[#302817]">Carbonless</span>
    </Link>
  );
}
