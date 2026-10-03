import { useState, useEffect } from 'react'
import {
  Utensils,
  ArrowRightLeft,
  PlusCircle,
  CheckCircle2,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react'
import type { RestaurantItem, CustomMealBuild } from '../types'

export function RestaurantOptimizer() {
  const [restaurant, setRestaurant] = useState<'subway' | 'chipotle'>('subway')
  const [goal, setGoal] = useState<'cutting' | 'bulking'>('cutting')
  const [viewMode, setViewMode] = useState<'presets' | 'custom'>('presets')
  const [maxCal, setMaxCal] = useState<number>(500)
  const [minCal, setMinCal] = useState<number>(500)
  const [minPro, setMinPro] = useState<number>(35)

  const [presets, setPresets] = useState<RestaurantItem[]>([])
  const [customBuild, setCustomBuild] = useState<CustomMealBuild | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch preset recommendations
  const fetchPresets = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        restaurant,
        goal,
        max_cal: maxCal.toString(),
        min_cal: minCal.toString(),
        min_pro: minPro.toString(),
        top_n: '10'
      })
      const res = await fetch(`/api/restaurant/preset?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: RestaurantItem[] = await res.json()
      setPresets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch restaurant presets')
    } finally {
      setLoading(false)
    }
  }

  // Fetch custom build
  const fetchCustomBuild = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        restaurant,
        goal
      })
      const res = await fetch(`/api/restaurant/custom?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: CustomMealBuild = await res.json()
      setCustomBuild(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assemble custom plate')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (viewMode === 'presets') {
      fetchPresets()
    } else {
      fetchCustomBuild()
    }
  }, [restaurant, goal, viewMode, maxCal, minCal, minPro])

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-2">
          <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-emerald-400">
            <Utensils className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm tracking-wide text-slate-200 uppercase">Restaurant Macro Optimizer</h2>
            <span className="text-[11px] text-slate-400">Dine out with surgical cutting & bulking targets</span>
          </div>
        </div>

        {/* Restaurant Selector & View Mode Switcher */}
        <div className="flex items-center space-x-2">
          <select
            value={restaurant}
            onChange={(e) => setRestaurant(e.target.value as 'subway' | 'chipotle')}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
          >
            <option value="subway">Subway</option>
            <option value="chipotle">Chipotle</option>
          </select>

          <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setViewMode('presets')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                viewMode === 'presets'
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Presets
            </button>
            <button
              onClick={() => setViewMode('custom')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                viewMode === 'custom'
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Custom Build
            </button>
          </div>
        </div>
      </div>

      {/* Goal Selector & Threshold Controls */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setGoal('cutting')
                setMaxCal(500)
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                goal === 'cutting'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              🔥 Cutting (Max Protein / Cal)
            </button>
            <button
              onClick={() => {
                setGoal('bulking')
                setMinCal(600)
                setMinPro(35)
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                goal === 'bulking'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              💪 Bulking (Calorie + Protein Floor)
            </button>
          </div>

          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
        </div>

        {/* Dynamic Sliders / Controls */}
        {goal === 'cutting' ? (
          <div className="flex items-center space-x-3 text-xs">
            <span className="text-slate-400 whitespace-nowrap">Calorie Ceiling:</span>
            <input
              type="range"
              min="200"
              max="1000"
              step="50"
              value={maxCal}
              onChange={(e) => setMaxCal(Number(e.target.value))}
              className="flex-1 accent-emerald-500"
            />
            <span className="font-mono text-emerald-400 font-semibold w-16 text-right">{maxCal} kcal</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 whitespace-nowrap">Min Cals:</span>
              <input
                type="number"
                step="50"
                value={minCal}
                onChange={(e) => setMinCal(Number(e.target.value))}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
              />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 whitespace-nowrap">Min Protein:</span>
              <input
                type="number"
                step="5"
                value={minPro}
                onChange={(e) => setMinPro(Number(e.target.value))}
                className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[460px]">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            <span className="text-xs">Optimizing nutrition data...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg text-xs">
            {error}
          </div>
        ) : viewMode === 'presets' ? (
          /* Preset Recommendations List */
          presets.length === 0 ? (
            <div className="border border-dashed border-slate-800 rounded-lg p-8 text-center text-slate-500 text-xs">
              No preset meals found meeting the specified thresholds.
            </div>
          ) : (
            presets.map((item, idx) => (
              <div
                key={item.item_name}
                className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-6 h-6 rounded-full bg-slate-800 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200">{item.item_name}</h4>
                      <span className="text-[10px] text-slate-400">{item.category}</span>
                    </div>
                  </div>

                  {item.pro_per_100_kcals !== undefined && (
                    <div className="bg-emerald-950/50 border border-emerald-800/50 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium text-emerald-400">
                      {item.pro_per_100_kcals.toFixed(1)}g Pro / 100 kcal
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono mt-2 pt-2 border-t border-slate-800/60">
                  <span className="text-white font-medium">{item.calories} kcal</span>
                  <span>•</span>
                  <span className="text-sky-400 font-medium">{item.protein_g}g Protein</span>
                  <span>•</span>
                  <span className="text-amber-400">{item.carbs_g}g Carbs</span>
                  <span>•</span>
                  <span className="text-rose-400">{item.fat_g}g Fat</span>
                </div>
              </div>
            ))
          )
        ) : customBuild ? (
          /* Custom Build-Your-Own View */
          <div className="space-y-4">
            {/* Total Base Plate */}
            <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-emerald-400 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Optimal Base Plate Assembly</span>
                </span>
                <span className="text-xs font-mono text-white font-bold">
                  {customBuild.total_macros.calories} kcal | {customBuild.total_macros.protein_g}g Pro
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                {customBuild.base_meal.map((item) => (
                  <div key={item.item_name} className="flex justify-between text-xs text-slate-300">
                    <span>• {item.item_name}</span>
                    <span className="font-mono text-slate-400 text-[11px]">
                      {item.calories} cal / {item.protein_g}g pro
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alternatives (e.g. Breads) */}
            {customBuild.alternatives?.breads && customBuild.alternatives.breads.length > 0 && (
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                  <span>Alternative Bread / Base Swaps</span>
                </h4>
                <div className="space-y-1.5">
                  {customBuild.alternatives.breads.slice(0, 4).map((alt) => (
                    <div key={alt.item_name} className="flex justify-between text-xs text-slate-400">
                      <span>~ Swap for: {alt.item_name}</span>
                      <span className="font-mono text-slate-300 text-[11px]">{alt.calories} kcal ({alt.carbs_g}g C)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alternatives (Proteins) */}
            {customBuild.alternatives?.proteins && customBuild.alternatives.proteins.length > 0 && (
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
                  <span>Alternative Protein Swaps</span>
                </h4>
                <div className="space-y-1.5">
                  {customBuild.alternatives.proteins.slice(0, 4).map((alt) => (
                    <div key={alt.item_name} className="flex justify-between text-xs text-slate-400">
                      <span>~ Swap for: {alt.item_name}</span>
                      <span className="font-mono text-slate-300 text-[11px]">{alt.calories} cal | {alt.protein_g}g P</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alternatives (Sauces) */}
            {customBuild.alternatives?.sauces && customBuild.alternatives.sauces.length > 0 && (
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-rose-400" />
                  <span>Alternative Sauce / Condiment Swaps</span>
                </h4>
                <div className="space-y-1.5">
                  {customBuild.alternatives.sauces.slice(0, 4).map((alt) => (
                    <div key={alt.item_name} className="flex justify-between text-xs text-slate-400">
                      <span>~ Swap for: {alt.item_name}</span>
                      <span className="font-mono text-slate-300 text-[11px]">{alt.calories} kcal</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Add-ons */}
            {customBuild.add_ons && customBuild.add_ons.length > 0 && (
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center space-x-1.5">
                  <PlusCircle className="w-3.5 h-3.5 text-sky-400" />
                  <span>Recommended Protein Add-Ons</span>
                </h4>
                <div className="space-y-2">
                  {customBuild.add_ons.map((addon) => {
                    const ratio = addon.kcal_per_g_pro || (addon.protein_g > 0 ? addon.calories / addon.protein_g : 0)
                    return (
                      <div key={addon.item_name} className="flex justify-between items-center text-xs">
                        <span className="text-slate-300">+ {addon.item_name}</span>
                        <div className="flex items-center space-x-2 font-mono text-[11px]">
                          <span className="text-sky-400">+{addon.protein_g}g P</span>
                          <span className="text-slate-500">({ratio.toFixed(1)} kcal/g pro)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
