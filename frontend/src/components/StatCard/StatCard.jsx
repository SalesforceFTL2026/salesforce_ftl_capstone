// A single impact figure: a large number over a short label. Used in the
// Impact section's stat grid. Purely presentational — copy comes from the parent.
const StatCard = ({ value, label }) => {
  return (
    <div className="rounded-2xl bg-white/5 dark:bg-surface-3/60 ring-1 ring-white/10 dark:ring-hairline p-6 sm:p-8 flex flex-col items-center text-center">
      <p className="font-display text-4xl sm:text-5xl md:text-6xl text-white dark:text-forest-300 leading-none mb-2 tracking-wide">
        {value}
      </p>
      <p className="text-sm sm:text-base text-white/70 dark:text-ink-muted leading-snug">
        {label}
      </p>
    </div>
  );
}

export default StatCard;
