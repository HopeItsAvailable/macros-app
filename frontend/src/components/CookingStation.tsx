import { useState, useEffect, useRef } from 'react'
import {
  ChefHat,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  CheckSquare,
  Square,
  Sparkles,
  BookOpen
} from 'lucide-react'
import { playTimerDone } from '../utils/audio'
import type { Recipe, RecipeStep, CulinaryTechnique } from '../types'

interface CookingStationProps {
  recipe: Recipe
  techniques: Record<string, CulinaryTechnique>
  onOpenTechnique: (technique: CulinaryTechnique) => void
  onExitCooking: () => void
  currentStepIndex: number
  setCurrentStepIndex: React.Dispatch<React.SetStateAction<number>>
  onRegisterTimerControls?: (controls: { start: () => void; stop: () => void; reset: () => void } | null) => void
}

export function CookingStation({
  recipe,
  techniques,
  onOpenTechnique,
  onExitCooking,
  currentStepIndex,
  setCurrentStepIndex,
  onRegisterTimerControls
}: CookingStationProps) {
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({})
  const [checkedUtensils, setCheckedUtensils] = useState<Record<string, boolean>>({})

  // Timers state per step: { [stepIndex]: { remaining: seconds, isRunning: bool, initial: seconds } }
  const [timers, setTimers] = useState<Record<number, { remaining: number; isRunning: boolean; initial: number }>>({})
  const timerIntervalRef = useRef<number | null>(null)

  // Initialize timers from recipe steps
  useEffect(() => {
    const initialTimers: Record<number, { remaining: number; isRunning: boolean; initial: number }> = {}
    recipe.steps.forEach((step, idx) => {
      const duration = step.timer_secs || 60
      initialTimers[idx] = {
        remaining: duration,
        isRunning: false,
        initial: duration
      }
    })
    setTimers(initialTimers)
  }, [recipe])

  // Timer countdown loop
  useEffect(() => {
    timerIntervalRef.current = window.setInterval(() => {
      setTimers((prev) => {
        let changed = false
        const next = { ...prev }

        Object.keys(next).forEach((keyStr) => {
          const idx = parseInt(keyStr, 10)
          const t = next[idx]
          if (t && t.isRunning && t.remaining > 0) {
            changed = true
            const newRemaining = t.remaining - 1
            next[idx] = {
              ...t,
              remaining: newRemaining,
              isRunning: newRemaining > 0
            }
            if (newRemaining === 0) {
              playTimerDone()
            }
          }
        })

        return changed ? next : prev
      })
    }, 1000)

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    }
  }, [])

  const currentStep: RecipeStep | undefined = recipe.steps[currentStepIndex]
  const currentTimer = timers[currentStepIndex] || { remaining: 0, isRunning: false, initial: 0 }

  const toggleTimer = (idx: number) => {
    setTimers((prev) => {
      const cur = prev[idx]
      if (!cur) return prev
      return {
        ...prev,
        [idx]: { ...cur, isRunning: !cur.isRunning }
      }
    })
  }

  const resetTimer = (idx: number) => {
    setTimers((prev) => {
      const cur = prev[idx]
      if (!cur) return prev
      return {
        ...prev,
        [idx]: { ...cur, remaining: cur.initial, isRunning: false }
      }
    })
  }

  // Expose timer controls to parent (e.g. for Hands-Free Voice Commands)
  useEffect(() => {
    if (onRegisterTimerControls) {
      onRegisterTimerControls({
        start: () => {
          setTimers((prev) => {
            const cur = prev[currentStepIndex]
            if (!cur) return prev
            return {
              ...prev,
              [currentStepIndex]: { ...cur, isRunning: true }
            }
          })
        },
        stop: () => {
          setTimers((prev) => {
            const cur = prev[currentStepIndex]
            if (!cur) return prev
            return {
              ...prev,
              [currentStepIndex]: { ...cur, isRunning: false }
            }
          })
        },
        reset: () => {
          resetTimer(currentStepIndex)
        }
      })
    }
    return () => {
      if (onRegisterTimerControls) {
        onRegisterTimerControls(null)
      }
    }
  }, [currentStepIndex, onRegisterTimerControls])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const toggleIngredient = (name: string) => {
    setCheckedIngredients((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  const toggleUtensil = (name: string) => {
    setCheckedUtensils((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-emerald-400">
            <ChefHat className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm tracking-wide text-slate-200 uppercase">{recipe.title}</h2>
            <span className="text-[11px] text-slate-400">Step-by-Step Cooking Station</span>
          </div>
        </div>

        <button
          onClick={onExitCooking}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
        >
          Exit Station
        </button>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center space-x-1.5 mb-5 overflow-x-auto pb-1 scrollbar-none">
        {recipe.steps.map((step, idx) => (
          <button
            key={step.step_number}
            onClick={() => setCurrentStepIndex(idx)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer flex items-center space-x-1.5 ${
              currentStepIndex === idx
                ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Step {step.step_number}</span>
            {step.stage === 'heat' && <Flame className="w-3 h-3 text-amber-400" />}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 overflow-y-auto">
        {/* Left Column: Active Step Details & Integrated Timer */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          {currentStep && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between flex-1">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-300">
                    Stage: {currentStep.stage === 'heat' ? '🔥 Active Cooking / Heat' : '🔪 Mise en Place / Prep'}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    Step {currentStepIndex + 1} of {recipe.steps.length}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-2">{currentStep.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">{currentStep.instruction}</p>

                {/* Clickable Technique Tags */}
                {currentStep.techniques && currentStep.techniques.length > 0 && (
                  <div className="pt-2 flex flex-wrap items-center gap-1.5 mb-4">
                    <span className="text-xs text-slate-400 flex items-center space-x-1 mr-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Learn technique:</span>
                    </span>
                    {currentStep.techniques.map((techKey) => {
                      const tech = techniques[techKey.toLowerCase()]
                      return (
                        <button
                          key={techKey}
                          onClick={() => tech && onOpenTechnique(tech)}
                          className="px-2.5 py-1 rounded-md bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-medium transition-colors flex items-center space-x-1 cursor-pointer"
                        >
                          <BookOpen className="w-3 h-3 text-emerald-400" />
                          <span>{tech ? tech.name : techKey}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Integrated Countdown Timer Display */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex items-center justify-between mt-4">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-0.5 uppercase tracking-wide">
                    Step Timer Countdown
                  </span>
                  <div
                    className={`text-3xl font-extrabold font-mono tracking-tight ${
                      currentTimer.remaining === 0
                        ? 'text-rose-400 animate-pulse'
                        : currentTimer.isRunning
                        ? 'text-emerald-400'
                        : 'text-white'
                    }`}
                  >
                    {formatTime(currentTimer.remaining)}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleTimer(currentStepIndex)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                      currentTimer.isRunning
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {currentTimer.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{currentTimer.isRunning ? 'Pause' : 'Start Timer'}</span>
                  </button>
                  <button
                    onClick={() => resetTimer(currentStepIndex)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Reset Timer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Step Navigation Controls */}
              <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-800">
                <button
                  disabled={currentStepIndex === 0}
                  onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous Step</span>
                </button>

                <button
                  disabled={currentStepIndex === recipe.steps.length - 1}
                  onClick={() => setCurrentStepIndex((prev) => Math.min(recipe.steps.length - 1, prev + 1))}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors flex items-center space-x-1 cursor-pointer"
                >
                  <span>Next Step</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Mise en Place Checklist */}
        <div className="lg:col-span-4 bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex flex-col space-y-4">
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ingredient Mise en Place</span>
            </h4>
            <div className="space-y-1.5">
              {recipe.ingredients.map((ing) => {
                const isChecked = !!checkedIngredients[ing]
                return (
                  <button
                    key={ing}
                    onClick={() => toggleIngredient(ing)}
                    className="w-full flex items-center space-x-2 text-left text-xs py-1 px-1.5 rounded hover:bg-slate-900 transition-colors cursor-pointer"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    )}
                    <span className={`truncate ${isChecked ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                      {ing}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">Required Utensils</h4>
            <div className="space-y-1.5">
              {recipe.utensils.map((ut) => {
                const isChecked = !!checkedUtensils[ut]
                return (
                  <button
                    key={ut}
                    onClick={() => toggleUtensil(ut)}
                    className="w-full flex items-center space-x-2 text-left text-xs py-1 px-1.5 rounded hover:bg-slate-900 transition-colors cursor-pointer"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    )}
                    <span className={`truncate ${isChecked ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                      {ut}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
