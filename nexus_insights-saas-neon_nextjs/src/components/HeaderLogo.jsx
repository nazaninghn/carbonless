import Link from 'next/link';
import Image from 'next/image';

export default function HeaderLogo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Image src="/carbonless.png" alt="Carbonless" width={56} height={56} className="h-11 w-11 sm:h-14 sm:w-14" />
      <span className="text-[20px] sm:text-[22px] font-bold tracking-tight text-[#302817]">Carbonless</span>
    </Link>
  );
}
