import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';

const FEATURES = [
  {
    title: 'Field capture',
    description:
      'Geotagged photo evidence with vegetation coverage estimated by a computer-vision model, run against every submission.',
  },
  {
    title: 'MRV pipeline',
    description:
      'A traceable state machine — draft, submitted, AI-analyzed, pending validation, verified, tokenized — with duplicate detection at every stage.',
  },
  {
    title: 'Permissioned blockchain',
    description:
      'Every state transition is written to a Hyperledger Fabric ledger, giving verified carbon estimates an immutable, auditable lineage.',
  },
  {
    title: 'Independent validation',
    description:
      'Trained validators review AI output and evidence before a record can be tokenized as a carbon asset — no self-certification.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="flex items-center justify-between border-b border-border-subtle px-8 py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/register">
            <Button>Get started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-8 py-20 text-center">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            An auditable lineage from field evidence to verified carbon assets
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-ink-muted">
            A blue carbon MRV registry combining computer vision, geospatial intelligence, and a permissioned
            blockchain — built for mangrove, seagrass, and salt marsh restoration projects.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/register">
              <Button size="lg">Create an account</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Sign in
              </Button>
            </Link>
          </div>
        </section>

        <section className="border-t border-border-subtle bg-surface-raised px-8 py-16">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <h3 className="font-display text-base font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm text-ink-muted">{f.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border-subtle px-8 py-6 text-center text-xs text-ink-faint">
        Prototype MRV platform — not a legally certified carbon registry.
      </footer>
    </div>
  );
}
