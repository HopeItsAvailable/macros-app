import { useState, useEffect } from 'react'
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Flame,
  Dumbbell,
  CheckCircle2,
  RefreshCw
} from 'lucide-react'
import type { DailyDiaryData } from '../types'

interface DailyDiaryProps {
  initialDate?: string
  refreshKey?: number
}

export function DailyDiary({ initialDate, refreshKey }: DailyDiaryProps) {
  const [currentDate, setCurrentDate] = useState(
    initialDate || new Date().toISOString().split('T')[0]
  )
  const [diary, setDiary] = useState<DailyDiaryData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchDiary = async (date: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/diary?date=${date}`)
      if (res.ok) {
        const data: DailyDiaryData = await res.json()
        setDiary(data)
      }
    } catch (err) {
      console.warn('Failed to load diary:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDiary(currentDate)
  }, [currentDate, refreshKey])

  const changeDay = (deltaDays: number) => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + deltaDays)
    setCurrentDate(d.toISOString().split('T')[0])
  }

  const calGoal = diary?.goals?.calories || 2200
  const proGoal = diary?.goals?.protein_g || 180
  const calConsumed = diary?.totals?.calories || 0
  const proConsumed = diary?.totals?.protein_g || 0

  const calPercent = Math.min(100, Math.round((calConsumed / calGoal) * 100))
  const proPercent = Math.min(100, Math.round((proConsumed / proGoal) * 100))

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col h-full">
      {/* Header with Date Navigator */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-emerald-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm tracking-wide text-slate-200 uppercase">Macro Diary</h2>
            <span className="text-[11px] text-slate-400">Track daily consumption & goals</span>
          </div>
        </div>

        {/* Date Selector */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
          <button
            onClick={() => changeDay(-1)}
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 font-mono text-slate-300 font-medium flex items-center space-x-1">
            <Calendar className="w-3 h-3 text-emerald-400 inline mr-1" />
            <span>{currentDate}</span>
          </span>
          <button
            onClick={() => changeDay(1)}
            className="p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bars for Calories and Protein */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 mb-4 space-y-3">
        {/* Calories Progress */}
        <div>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-slate-300 font-medium flex items-center space-x-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Calories</span>
            </span>
            <span className="font-mono text-slate-400">
              <strong className="text-white">{calConsumed}</strong> / {calGoal} kcal ({calPercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full transition-all duration-500 rounded-full"
              style={{ width: `${calPercent}%` }}
            />
          </div>
        </div>

        {/* Protein Progress */}
        <div>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-slate-300 font-medium flex items-center space-x-1.5">
              <Dumbbell className="w-3.5 h-3.5 text-sky-400" />
              <span>Protein</span>
            </span>
            <span className="font-mono text-slate-400">
              <strong className="text-white">{proConsumed}g</strong> / {proGoal}g ({proPercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-sky-500 h-full transition-all duration-500 rounded-full"
              style={{ width: `${proPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Logged Meals List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[380px]">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            <span className="text-xs">Loading diary...</span>
          </div>
        ) : !diary || diary.meals.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-lg p-8 flex flex-col items-center justify-center text-center text-slate-500">
            <BookOpen className="w-8 h-8 mb-2 opacity-30 text-emerald-400" />
            <p className="text-xs font-medium text-slate-400">No meals logged for this date</p>
            <p className="text-[11px] text-slate-500 mt-1">Formulate meals from your fridge or log quick foods</p>
          </div>
        ) : (
          diary.meals.map((meal) => (
            <div
              key={meal.id}
              className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 flex flex-col space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                    {meal.meal_type}
                  </span>
                  <h4 className="text-xs font-semibold text-slate-200">{meal.name}</h4>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {meal.servings} serving{meal.servings > 1 ? 's' : ''}
                </span>
              </div>

              {/* Macro breakdown line */}
              <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                <span className="text-white font-medium">{meal.calories} kcal</span>
                <span>•</span>
                <span className="text-sky-400">{meal.protein_g}g P</span>
                <span>•</span>
                <span className="text-amber-400">{meal.carbs_g}g C</span>
                <span>•</span>
                <span className="text-rose-400">{meal.fat_g}g F</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Diary Footer Summary */}
      {diary && diary.meals.length > 0 && (
        <div className="border-t border-slate-800 pt-3 mt-3 flex items-center justify-between text-xs">
          <span className="text-slate-400 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{diary.meals.length} Meal{diary.meals.length > 1 ? 's' : ''} Recorded</span>
          </span>
          <span className="font-mono text-slate-300 font-semibold">
            {diary.totals.calories} kcal | {diary.totals.protein_g}g Pro
          </span>
        </div>
      )}
    </div>
  )
}
