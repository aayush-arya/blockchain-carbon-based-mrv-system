import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16">
        <Link href="/">
          <Logo />
        </Link>
        <div className="mx-auto w-full max-w-sm py-12">{children}</div>
        <p className="text-center text-xs text-ink-faint lg:text-left">
          Prototype MRV platform &middot; not a legally certified carbon registry
        </p>
      </div>

      <div className="relative hidden overflow-hidden bg-brand-900 lg:block">
        <div className="grid-faint-bg absolute inset-0 opacity-[0.15]" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-800/60 via-transparent to-brand-900" />
        <div className="relative flex h-full flex-col justify-end p-16">
          <blockquote className="max-w-md">
            <p className="font-display text-2xl font-medium leading-snug text-white">
              &ldquo;Every ton of carbon traced from field photo to validated ledger entry
              &mdash; nothing asserted without a chain of evidence.&rdquo;
            </p>
            <footer className="mt-4 text-sm text-brand-200">
              Field Evidence → AI Analysis → Carbon Calc → Validation → Hyperledger Fabric → Tokenized Asset
            </footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
