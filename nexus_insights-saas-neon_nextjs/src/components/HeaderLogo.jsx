import Link from 'next/link';

export default function HeaderLogo() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <img src="/carbonless.png" alt="Carbonless" className="h-8 w-8 sm:h-10 sm:w-10" />
      <span className="text-[18px] sm:text-[20px] font-semibold tracking-tight text-[#302817]">Carbonless</span>
    </Link>
  );
}
