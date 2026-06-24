'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 max-w-md w-full text-center shadow-2xl">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-white text-xl font-bold mb-2">Dashboard Sedang Sibuk</h2>
        <p className="text-white/60 text-sm mb-6">
          Server sedang memproses data yang besar. Silakan coba lagi dalam beberapa detik.
        </p>
        <button
          onClick={() => reset()}
          className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-emerald-500/30"
        >
          🔄 Coba Lagi
        </button>
        <p className="text-white/30 text-xs mt-4">
          Error: {error?.message?.slice(0, 100) || 'Server timeout'}
        </p>
      </div>
    </div>
  )
}
