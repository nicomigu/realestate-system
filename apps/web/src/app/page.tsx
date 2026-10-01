import { LeadForm } from './lead-form';

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black sm:py-24">
      <div className="grid w-full max-w-5xl gap-10 md:grid-cols-2 md:items-center">
        <section>
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">Riverside Realty</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Find your dream home
          </h1>
          <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Tell us how to reach you. We reply in seconds, learn what you&apos;re looking for, and book a call with
            an agent at a time that suits you.
          </p>
        </section>
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800 sm:p-8">
          <LeadForm />
        </section>
      </div>
    </main>
  );
}
