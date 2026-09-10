export function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-xl border-b border-outline-variant/20" aria-label="Project navigation">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <a className="font-label text-xs sm:text-sm tracking-widest text-outline hover:text-primary transition-colors" href="/">
            ← Back to Scaler
          </a>
          <span className="text-outline-variant">/</span>
          <span className="font-headline font-bold text-base sm:text-xl truncate">Interactive Demo</span>
        </div>
        <div className="flex items-center gap-4">
          <a className="hidden sm:flex items-center gap-2 text-outline hover:text-primary transition-colors" href="https://github.com/maimon33/scaler" target="_blank" rel="noopener noreferrer">
            <span className="text-sm">GitHub</span>
            <span className="material-symbols-outlined text-sm">arrow_outward</span>
          </a>
        </div>
      </div>
    </nav>
  )
}
