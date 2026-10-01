import { useState, useEffect } from 'react'
import {
  Refrigerator,
  QrCode,
  BookOpen,
  ChefHat,
  UtensilsCrossed,
  Activity,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Smartphone,
  Monitor
} from 'lucide-react'

interface HealthState {
  status: string
  database: string
  timestamp: string
}

export function App() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'scanner' | 'diary' | 'recipe' | 'restaurant'>('inventory')
  const [health, setHealth] = useState<HealthState | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = async () => {
    setLoadingHealth(true)
    setError(null)
    try {
      const res = await fetch('/api/health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: HealthState = await res.json()
      setHealth(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Backend unreachable')
    } finally {
      setLoadingHealth(false)
    }
  }

  useEffect(() => {
    fetchHealth()
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-emerald-400">
            <Refrigerator className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-tight">Macros Engine</h1>
            <p className="text-xs text-slate-400 hidden sm:block">Smart Fridge & Macro Optimizer</p>
          </div>
        </div>

        {/* Healthcheck Tracer Bullet Status */}
        <div className="flex items-center space-x-2 text-xs">
          {loadingHealth ? (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-800/80 rounded-full border border-slate-700 text-slate-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Connecting...</span>
            </div>
          ) : health ? (
            <div className="flex items-center space-x-2 px-2.5 py-1 bg-emerald-950/40 rounded-full border border-emerald-800/50 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-medium">Backend & SQLite Online</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 px-2.5 py-1 bg-rose-950/40 rounded-full border border-rose-800/50 text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>{error || 'Offline'}</span>
              <button
                onClick={fetchHealth}
                className="ml-1 hover:text-white underline cursor-pointer"
                title="Retry connection"
              >
                Retry
              </button>
            </div>
          )}

          {/* Desktop/Mobile indicator */}
          <div className="hidden md:flex items-center space-x-1 px-2 py-1 bg-slate-800/40 rounded border border-slate-700/50 text-slate-400">
            <Monitor className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </div>
          <div className="flex md:hidden items-center space-x-1 px-2 py-1 bg-slate-800/40 rounded border border-slate-700/50 text-slate-400">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-20 md:pb-6">
        {/* Tracer Bullet System Status Banner */}
        <section className="mb-6 p-4 rounded-xl border border-slate-800 bg-slate-900/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <Activity className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-200">Tracer Bullet: Foundation Operational</p>
              <p className="text-xs text-slate-400">
                GoFiber REST service connected to local SQLite (<code className="text-slate-300 font-mono">kitchen.db</code>).
                {health?.timestamp && ` Last heartbeat: ${new Date(health.timestamp).toLocaleTimeString()}`}
              </p>
            </div>
          </div>
          <button
            onClick={fetchHealth}
            className="self-start sm:self-auto px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? 'animate-spin' : ''}`} />
            <span>Test Health</span>
          </button>
        </section>

        {/* Responsive Multi-Column Dashboard (Desktop) / Tabbed Cards (Mobile) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Column 1: Fridge Inventory & Ingestion */}
          <div className={`lg:col-span-4 ${activeTab === 'inventory' || activeTab === 'scanner' ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Refrigerator className="w-4 h-4 text-emerald-400" />
                  <h2 className="font-semibold text-sm tracking-wide text-slate-200 uppercase">Virtual Fridge</h2>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">0 Items</span>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Track ingredients, expiry windows, and macronutrients. Items scanned via barcode resolve against Open Food Facts and cache in SQLite.
              </p>
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-lg p-6 text-center text-slate-500">
                <QrCode className="w-8 h-8 mb-2 opacity-50 text-emerald-400" />
                <p className="text-xs font-medium text-slate-300">Fridge is empty</p>
                <p className="text-[11px] text-slate-500 mt-1">Ready for Ticket 2 & 3: Barcode scanning & Fridge Ingestion</p>
              </div>
            </div>
          </div>

          {/* Column 2: Recipe Station & Formulation */}
          <div className={`lg:col-span-5 ${activeTab === 'recipe' ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <ChefHat className="w-4 h-4 text-emerald-400" />
                  <h2 className="font-semibold text-sm tracking-wide text-slate-200 uppercase">Culinary Formulation</h2>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">Gemini AI</span>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Formulate meals from available inventory and appliances. Includes knife technique guides and cooking station timers.
              </p>
              <div className="flex-1 border-2 border-dashed border-slate-800 rounded-lg p-6 flex flex-col items-center justify-center text-center text-slate-500">
                <UtensilsCrossed className="w-8 h-8 mb-2 opacity-50 text-emerald-400" />
                <p className="text-xs font-medium text-slate-300">Ready for Recipe Engine</p>
                <p className="text-[11px] text-slate-500 mt-1">Ready for Ticket 6 & 11: Real-time macro formulation</p>
              </div>
            </div>
          </div>

          {/* Column 3: Daily Macro Diary & Goals */}
          <div className={`lg:col-span-3 ${activeTab === 'diary' || activeTab === 'restaurant' ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <h2 className="font-semibold text-sm tracking-wide text-slate-200 uppercase">Macro Diary</h2>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">Today</span>
              </div>
              <div className="space-y-3 mb-4">
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Calories</span>
                    <span>0 / 2200 kcal</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-0 transition-all"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Protein</span>
                    <span>0 / 180g</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-sky-500 h-full w-0 transition-all"></div>
                  </div>
                </div>
              </div>
              <div className="flex-1 border-2 border-dashed border-slate-800 rounded-lg p-6 flex flex-col items-center justify-center text-center text-slate-500">
                <p className="text-xs font-medium text-slate-300">No Meals Logged</p>
                <p className="text-[11px] text-slate-500 mt-1">Ready for Ticket 7 & 8: Macro progress & Cronometer export</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar (Visible only on mobile) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-900/90 backdrop-blur z-40 px-2 py-2 flex justify-around items-center text-slate-400">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'inventory' ? 'text-emerald-400 bg-emerald-500/10' : 'hover:text-slate-200'
          }`}
        >
          <Refrigerator className="w-5 h-5 mb-0.5" />
          <span>Fridge</span>
        </button>
        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'scanner' ? 'text-emerald-400 bg-emerald-500/10' : 'hover:text-slate-200'
          }`}
        >
          <QrCode className="w-5 h-5 mb-0.5" />
          <span>Scanner</span>
        </button>
        <button
          onClick={() => setActiveTab('recipe')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'recipe' ? 'text-emerald-400 bg-emerald-500/10' : 'hover:text-slate-200'
          }`}
        >
          <ChefHat className="w-5 h-5 mb-0.5" />
          <span>Recipes</span>
        </button>
        <button
          onClick={() => setActiveTab('diary')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'diary' ? 'text-emerald-400 bg-emerald-500/10' : 'hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span>Diary</span>
        </button>
      </nav>
    </div>
  )
}

export default App
