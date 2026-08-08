/**
 * Shared card shell with an optional header. Keeps every panel visually
 * consistent without repeated classes.
 */

export function Card({
  title,
  subtitle,
  actions,
  className,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        "rounded-xl border border-edge bg-surface shadow-xl shadow-black/30 " +
        (className ?? "")
      }
    >
      {(title != null || actions != null) && (
        <header className="flex items-center justify-between gap-3 border-b border-edge px-5 py-3.5">
          <div className="min-w-0">
            {title != null && (
              <h2 className="truncate font-serif text-[15px] font-semibold tracking-tight text-ink">
                {title}
              </h2>
            )}
            {subtitle != null && (
              <p className="mt-0.5 truncate text-[11px] text-faint">
                {subtitle}
              </p>
            )}
          </div>
          {actions != null && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
