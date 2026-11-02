import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

interface PublicHeaderProps {
  title: string;
  description?: ReactNode;
  // A small mono label above the title, e.g. "Program"
  eyebrow?: string;
  back?: { to: string; label: string };
  // Sits on the right from the large breakpoint up: counts, actions
  aside?: ReactNode;
  // A row of facts under the description: date, venue, organizer
  meta?: ReactNode;
  // Sits to the left of the title block: an avatar or photo
  leading?: ReactNode;
}

// The opening of every public page: a back link, a big uppercase title and a hairline rule beneath
export function PublicHeader({
  title,
  description,
  eyebrow,
  back,
  aside,
  meta,
  leading,
}: PublicHeaderProps) {
  return (
    <header className="flex flex-col gap-6">
      {back && (
        <Link
          to={back.to}
          className="group flex w-fit items-center gap-2 text-small text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft
            aria-hidden
            className="size-4 transition-transform group-hover:-translate-x-1"
            strokeWidth={1.75}
          />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-8 border-b border-neutral-900 pb-8 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div className="flex min-w-0 items-center gap-5 sm:gap-8">
          {leading}
          <div className="flex min-w-0 max-w-2xl flex-col gap-3">
            {eyebrow && (
              <p className="font-mono text-xs font-medium uppercase text-neutral-600">
                {eyebrow}
              </p>
            )}
            <h1 className="text-balance text-[clamp(1.25rem,1rem+1.1vw,1.75rem)] font-bold uppercase leading-[1.05] tracking-[-0.02em] text-neutral-900">
              {title}
            </h1>
            {description && (
              <p className="text-body text-neutral-600">{description}</p>
            )}
            {meta && <div className="pt-1">{meta}</div>}
          </div>
        </div>
        {aside}
      </div>
    </header>
  );
}

// One big figure with a mono label; a row of these sits in the header's aside
export function HeaderStat({
  value,
  label,
}: {
  value: ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-l border-neutral-300 px-5 first:border-l-0 first:pl-0 last:pr-0 sm:px-8">
      <dd className="text-[1.5rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-neutral-900 sm:text-[2rem]">
        {value}
      </dd>
      <dt className="whitespace-nowrap font-mono text-xs font-medium uppercase tracking-wide text-neutral-600">
        {label}
      </dt>
    </div>
  );
}

export function HeaderStats({ children }: { children: ReactNode }) {
  return <dl className="flex shrink-0 items-start">{children}</dl>;
}
