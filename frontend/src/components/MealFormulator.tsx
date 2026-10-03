import { useState, useMemo } from 'react'
import {
  ChefHat,
  Flame,
  Minus,
  Plus,
  Trash2,
  BookOpen,
  Share2,
  UtensilsCrossed
} from 'lucide-react'
import type { MealIngredient, FridgeItem } from '../types'

interface MealFormulatorProps {
  selectedItems: FridgeItem[]
  onRemoveItem: (itemId: string) => void
  onLogMeal: (mealData: {
    name: string
    meal_type: string
    servings: number
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    items: MealIngredient[]
  }) => Promise<void>
  onExportCronometer: (mealSummary: {
    title: string
    servings: number
    ingredients: Array<{ name: string; grams: number; calories: number; protein_g: number; carbs_g: number; fat_g: number }>
    totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  }) => void
  onStartCooking: (recipeData: {
    title: string
    servings: number
    ingredients: Array<{ name: string; quantity: number; unit: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }>
  }) => void
}

export function MealFormulator({
  selectedItems,
  onRemoveItem,
  onLogMeal,
  onExportCronometer,
  onStartCooking
}: MealFormulatorProps) {
  const [mealName, setMealName] = useState('Custom Kitchen Skillet')
  const [mealType, setMealType] = useState('Lunch')
  const [servings, setServings] = useState(1)
  const [portions, setPortions] = useState<Record<string, { value: number; unit: 'g' | 'oz' | 'count' }>>({})
  const [logging, setLogging] = useState(false)

  // Initialize portions for newly selected items
  const ingredientPortions = useMemo(() => {
    return selectedItems.map((fi) => {
      const p = portions[fi.id] || {
        value: fi.item.serving_size_g || 100,
        unit: 'g'
      }
      return {
        item: fi.item,
        portion_g: p.unit === 'oz' ? p.value * 28.3495 : p.unit === 'count' ? p.value * (fi.item.serving_size_g || 100) : p.value,
        portion_count: p.value,
        unit: p.unit,
        fridgeId: fi.id
      }
    })
  }, [selectedItems, portions])

  const handlePortionChange = (id: string, value: number, unit: 'g' | 'oz' | 'count') => {
    setPortions((prev) => ({
      ...prev,
      [id]: { value: Math.max(0, value), unit }
    }))
  }

  // Real-time macro aggregation
  const calculatedMacros = useMemo(() => {
    let calories = 0
    let protein = 0
    let carbs = 0
    let fat = 0

    ingredientPortions.forEach((ing) => {
      const refGrams = ing.item.serving_size_g > 0 ? ing.item.serving_size_g : 100
      const ratio = ing.portion_g / refGrams
      calories += (ing.item.calories || 0) * ratio
      protein += (ing.item.protein_g || 0) * ratio
      carbs += (ing.item.carbs_g || 0) * ratio
      fat += (ing.item.fat_g || 0) * ratio
    })

    const total = {
      calories: Math.round(calories),
      protein_g: Math.round(protein * 10) / 10,
      carbs_g: Math.round(carbs * 10) / 10,
      fat_g: Math.round(fat * 10) / 10
    }

    const safeServings = servings > 0 ? servings : 1
    const perServing = {
      calories: Math.round(total.calories / safeServings),
      protein_g: Math.round((total.protein_g / safeServings) * 10) / 10,
      carbs_g: Math.round((total.carbs_g / safeServings) * 10) / 10,
      fat_g: Math.round((total.fat_g / safeServings) * 10) / 10
    }

    return { total, perServing }
  }, [ingredientPortions, servings])

  const handleLog = async () => {
    if (ingredientPortions.length === 0 || logging) return
    setLogging(true)
    try {
      await onLogMeal({
        name: mealName.trim() || 'Formulated Meal',
        meal_type: mealType,
        servings,
        calories: calculatedMacros.total.calories,
        protein_g: calculatedMacros.total.protein_g,
        carbs_g: calculatedMacros.total.carbs_g,
        fat_g: calculatedMacros.total.fat_g,
        items: ingredientPortions
      })
    } finally {
      setLogging(false)
    }
  }

  const handleExport = () => {
    onExportCronometer({
      title: mealName,
      servings,
      ingredients: ingredientPortions.map((ing) => {
        const refGrams = ing.item.serving_size_g > 0 ? ing.item.serving_size_g : 100
        const ratio = ing.portion_g / refGrams
        return {
          name: ing.item.name,
          grams: Math.round(ing.portion_g),
          calories: Math.round(ing.item.calories * ratio),
          protein_g: Math.round(ing.item.protein_g * ratio * 10) / 10,
          carbs_g: Math.round(ing.item.carbs_g * ratio * 10) / 10,
          fat_g: Math.round(ing.item.fat_g * ratio * 10) / 10
        }
      }),
      totals: calculatedMacros.total
    })
  }

  const handleCook = () => {
    onStartCooking({
      title: mealName,
      servings,
      ingredients: ingredientPortions.map((ing) => {
        const refGrams = ing.item.serving_size_g > 0 ? ing.item.serving_size_g : 100
        const ratio = ing.portion_g / refGrams
        return {
          name: ing.item.name,
          quantity: ing.portion_count,
          unit: ing.unit,
          calories: Math.round(ing.item.calories * ratio),
          protein_g: Math.round(ing.item.protein_g * ratio * 10) / 10,
          carbs_g: Math.round(ing.item.carbs_g * ratio * 10) / 10,
          fat_g: Math.round(ing.item.fat_g * ratio * 10) / 10
        }
      })
    })
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
            <h2 className="font-semibold text-sm tracking-wide text-slate-200 uppercase">Meal Formulator</h2>
            <span className="text-[11px] text-slate-400">Build plates & calculate real-time macros</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400">Servings:</span>
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="px-2 text-xs font-semibold text-emerald-400 font-mono">{servings}</span>
            <button
              onClick={() => setServings((s) => s + 1)}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Meal Name & Meal Type Inputs */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <input
          type="text"
          placeholder="Meal Name (e.g. Turkey & Veggies)"
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
          className="col-span-2 bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
        <select
          value={mealType}
          onChange={(e) => setMealType(e.target.value)}
          className="bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="Breakfast">Breakfast</option>
          <option value="Lunch">Lunch</option>
          <option value="Dinner">Dinner</option>
          <option value="Snack">Snack</option>
        </select>
      </div>

      {/* Selected Items Portions List */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1 max-h-[340px]">
        {ingredientPortions.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-lg p-8 flex flex-col items-center justify-center text-center text-slate-500">
            <UtensilsCrossed className="w-8 h-8 mb-2 opacity-30 text-emerald-400" />
            <p className="text-xs font-medium text-slate-400">Cooking pot is empty</p>
            <p className="text-[11px] text-slate-500 mt-1">Check boxes in your Virtual Fridge to add ingredients</p>
          </div>
        ) : (
          ingredientPortions.map((ing) => {
            const currentPortion = portions[ing.fridgeId] || { value: ing.portion_count, unit: ing.unit }
            const refGrams = ing.item.serving_size_g > 0 ? ing.item.serving_size_g : 100
            const ratio = ing.portion_g / refGrams
            const cals = Math.round(ing.item.calories * ratio)
            const pro = Math.round(ing.item.protein_g * ratio * 10) / 10

            return (
              <div
                key={ing.fridgeId}
                className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-medium text-slate-200 truncate">{ing.item.name}</h4>
                  <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono mt-0.5">
                    <span>{cals} kcal</span>
                    <span>•</span>
                    <span className="text-sky-400">{pro}g P</span>
                  </div>
                </div>

                {/* Portion Adjuster */}
                <div className="flex items-center space-x-1.5">
                  <input
                    type="number"
                    step="any"
                    value={currentPortion.value}
                    onChange={(e) =>
                      handlePortionChange(ing.fridgeId, parseFloat(e.target.value) || 0, currentPortion.unit)
                    }
                    className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white text-right font-mono focus:border-emerald-500"
                  />
                  <select
                    value={currentPortion.unit}
                    onChange={(e) =>
                      handlePortionChange(ing.fridgeId, currentPortion.value, e.target.value as 'g' | 'oz' | 'count')
                    }
                    className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-white"
                  >
                    <option value="g">g</option>
                    <option value="oz">oz</option>
                    <option value="count">count</option>
                  </select>
                  <button
                    onClick={() => onRemoveItem(ing.fridgeId)}
                    className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                    title="Remove ingredient"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Aggregate Real-Time Macro Cards */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 mb-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium flex items-center space-x-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Total Recipe Macros</span>
          </span>
          {servings > 1 && (
            <span className="text-[11px] text-emerald-400">
              Per Serving: {calculatedMacros.perServing.calories} kcal | {calculatedMacros.perServing.protein_g}g P
            </span>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Calories</span>
            <span className="text-xs font-bold text-white font-mono">{calculatedMacros.total.calories}</span>
          </div>
          <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Protein</span>
            <span className="text-xs font-bold text-sky-400 font-mono">{calculatedMacros.total.protein_g}g</span>
          </div>
          <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Carbs</span>
            <span className="text-xs font-bold text-amber-400 font-mono">{calculatedMacros.total.carbs_g}g</span>
          </div>
          <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Fat</span>
            <span className="text-xs font-bold text-rose-400 font-mono">{calculatedMacros.total.fat_g}g</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handleLog}
          disabled={ingredientPortions.length === 0 || logging}
          className="px-2 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Log Meal</span>
        </button>

        <button
          onClick={handleExport}
          disabled={ingredientPortions.length === 0}
          className="px-2 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center justify-center space-x-1.5 cursor-pointer border border-slate-700"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        <button
          onClick={handleCook}
          disabled={ingredientPortions.length === 0}
          className="px-2 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
        >
          <UtensilsCrossed className="w-3.5 h-3.5" />
          <span>Cook</span>
        </button>
      </div>
    </div>
  )
}
