export const ErrorBanner = ({ message }: { message: string }) => (
  <div
    role="alert"
    className="glass-soft mb-5 flex items-start gap-3 border-peach-deep/40 bg-peach-deep/10 px-4 py-3.5 text-[14px] leading-relaxed text-peach-soft"
  >
    <span aria-hidden className="mt-0.5">
      ⚠️
    </span>
    <p>{message}</p>
  </div>
);

export const InfoBanner = ({ message }: { message: string }) => (
  <div className="glass-soft mb-5 flex items-start gap-3 px-4 py-3.5 text-[14px] leading-relaxed text-slate-300">
    <span aria-hidden className="mt-0.5">
      💡
    </span>
    <p>{message}</p>
  </div>
);

export const LoadingBlock = ({ label = '불러오는 중이에요' }: { label?: string }) => (
  <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
    <span
      aria-hidden
      className="h-7 w-7 animate-spin rounded-full border-2 border-moonlight/30 border-t-moonlight"
    />
    <p className="text-[13.5px]">{label}</p>
  </div>
);

export const EmptyState = ({ message }: { message: string }) => (
  <div className="glass-soft px-5 py-12 text-center text-[14px] text-slate-400">{message}</div>
);
