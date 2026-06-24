export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-white/15 backdrop-blur rounded-2xl mb-4 border border-white/20 shadow-xl">
          <span className="text-3xl">🖥️</span>
        </div>
        <h2 className="text-white text-xl font-bold mb-2">Memuat Dashboard...</h2>
        <p className="text-white/60 text-sm mb-6">Memproses data statistik PHBS</p>
        <div className="flex justify-center gap-1">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}
