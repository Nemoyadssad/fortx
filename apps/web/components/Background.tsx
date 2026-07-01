export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* base radial wash */}
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(245,197,66,0.10),transparent)]" />
      {/* subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.6]"
        style={{
          backgroundImage:
            'linear-gradient(rgb(var(--grid) / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--grid) / 0.05) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
          maskImage: 'radial-gradient(1000px 700px at 50% 0%, black, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(1000px 700px at 50% 0%, black, transparent 80%)',
        }}
      />
      {/* glows */}
      <div className="absolute left-1/2 top-[-20rem] h-[40rem] w-[60rem] -translate-x-1/2 rounded-full bg-gold/15 blur-[160px] animate-glowPulse" />
      <div className="absolute left-[-12rem] top-[20rem] h-[28rem] w-[28rem] rounded-full bg-[#3aa3ff]/[0.10] blur-[150px]" />
      <div className="absolute bottom-[-24rem] right-[-10rem] h-[36rem] w-[36rem] rounded-full bg-win/[0.08] blur-[150px]" />
    </div>
  );
}
