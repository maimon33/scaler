export function Footer() {
  return (
    <footer className="border-t border-outline-variant/20 mt-20">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row gap-5 justify-between text-sm">
        <span className="font-headline font-bold">© 2026 Assi Maimon</span>
        <div className="flex gap-7 text-outline">
          <a className="hover:text-primary transition-colors" href="/">Home</a>
          <a className="hover:text-primary transition-colors" href="https://github.com/maimon33/scaler" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a className="hover:text-primary transition-colors" href="https://github.com/maimon33/scaler#readme" target="_blank" rel="noopener noreferrer">Docs</a>
        </div>
      </div>
    </footer>
  )
}
