export default function NotFound() {
  return (
    <main className="container-screen flex min-h-[60vh] items-center justify-center py-20">
      <div className="soft-card max-w-lg p-10 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-[#ffb27e]">404</p>
        <h1 className="mt-4 text-4xl font-display font-bold text-white">This page does not exist</h1>
        <p className="mt-4 text-slate-300">The route you requested is not available in XE3AGLE yet.</p>
      </div>
    </main>
  );
}
