import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

export function InformationPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#070506] text-white">
      <div className="paint-backdrop opacity-45" aria-hidden="true" />
      <div className="oil-grain" aria-hidden="true" />
      <div
        className="fixed inset-0 z-0 bg-[linear-gradient(115deg,rgba(5,3,4,.96),rgba(7,4,5,.82)_52%,rgba(18,5,7,.88))]"
        aria-hidden="true"
      />

      <header className="relative z-10 flex h-20 items-center justify-between border-b border-white/8 px-5 sm:px-8 lg:px-12">
        <Link className="flex items-center gap-3" href="/" aria-label="ChatSaver home">
          <Image
            src="/cs-transparent.png"
            alt=""
            width={40}
            height={40}
            className="size-10 object-cover"
            priority
          />
          <span className="text-[15px] font-semibold tracking-[-0.03em]">ChatSaver</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65 transition-colors hover:border-primary/40 hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          Back to app
        </Link>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="max-w-3xl">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.055em] text-white sm:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-white/62 sm:text-lg">
            {description}
          </p>
        </div>

        <article className="mt-12 grid gap-5 text-sm leading-7 text-white/65 [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-[-0.025em] [&_h2]:text-white [&_li]:ms-5 [&_li]:list-disc [&_p+p]:mt-3 [&_section]:rounded-2xl [&_section]:border [&_section]:border-white/8 [&_section]:bg-black/25 [&_section]:p-6 [&_section]:backdrop-blur-md sm:[&_section]:p-8">
          {children}
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
