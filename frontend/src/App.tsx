import { useState, useEffect, useRef } from 'react'
import {
  Refrigerator,
  QrCode,
  BookOpen,
  ChefHat,
  UtensilsCrossed,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Utensils,
  X
} from 'lucide-react'
import type { FridgeItem, Recipe, CulinaryTechnique, AppConfig } from './types'
import { FridgeInventory } from './components/FridgeInventory'
import { BarcodeScannerModal } from './components/BarcodeScannerModal'
import { AddCustomFoodModal } from './components/AddCustomFoodModal'
import { MealFormulator } from './components/MealFormulator'
import { CronometerExportModal } from './components/CronometerExportModal'
import { DailyDiary } from './components/DailyDiary'
import { RestaurantOptimizer } from './components/RestaurantOptimizer'
import { CookingStation } from './components/CookingStation'
import { TechniqueModal } from './components/TechniqueModal'
import { VoiceNavigator } from './components/VoiceNavigator'

interface HealthState {
  status: string
  database: string
  timestamp: string
}

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'restaurant' | 'cooking'>('dashboard')
  const [mobileTab, setMobileTab] = useState<'inventory' | 'formulate' | 'diary' | 'restaurant'>('inventory')

  // Data states
  const [health, setHealth] = useState<HealthState | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [config, setConfig] = useState<AppConfig | null>(null)

  const [fridgeItems, setFridgeItems] = useState<FridgeItem[]>([])
  const [selectedFridgeIds, setSelectedFridgeIds] = useState<string[]>([])
  const [techniques, setTechniques] = useState<Record<string, CulinaryTechnique>>({})
  const [activeTechnique, setActiveTechnique] = useState<CulinaryTechnique | null>(null)

  // Modals state
  const [scannerOpen, setScannerOpen] = useState(false)
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [cronometerData, setCronometerData] = useState<any | null>(null)

  // Cooking station state
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const timerControlsRef = useRef<{ start: () => void; stop: () => void; reset: () => void } | null>(null)

  // Diary refresh and Toast notifications
  const [diaryRefreshKey, setDiaryRefreshKey] = useState(0)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // 1. Fetch Health
  const fetchHealth = async () => {
    setLoadingHealth(true)
    setHealthError(null)
    try {
      const res = await fetch('/api/health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: HealthState = await res.json()
      setHealth(data)
    } catch (err: unknown) {
      setHealthError(err instanceof Error ? err.message : 'Backend unreachable')
    } finally {
      setLoadingHealth(false)
    }
  }

  // 2. Fetch Config
  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config')
      if (res.ok) {
        const data: AppConfig = await res.json()
        setConfig(data)
      }
    } catch (err) {
      console.warn('Failed to load config:', err)
    }
  }

  // 3. Fetch Fridge Inventory
  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/inventory')
      if (res.ok) {
        const data: FridgeItem[] = await res.json()
        setFridgeItems(data)
      }
    } catch (err) {
      console.warn('Failed to load inventory:', err)
    }
  }

  // 4. Fetch Culinary Techniques
  const fetchTechniques = async () => {
    try {
      const res = await fetch('/api/techniques')
      if (res.ok) {
        const list: CulinaryTechnique[] = await res.json()
        const map: Record<string, CulinaryTechnique> = {}
        list.forEach((t) => {
          map[t.id.toLowerCase()] = t
        })
        setTechniques(map)
      }
    } catch (err) {
      console.warn('Failed to load techniques:', err)
    }
  }

  useEffect(() => {
    fetchHealth()
    fetchConfig()
    fetchInventory()
    fetchTechniques()
  }, [])

  // Inventory handlers
  const handleToggleSelectFridgeItem = (fi: FridgeItem) => {
    setSelectedFridgeIds((prev) =>
      prev.includes(fi.id) ? prev.filter((id) => id !== fi.id) : [...prev, fi.id]
    )
  }

  const handleUpdateFridgeItem = async (id: string, quantity: number, unit: string) => {
    const res = await fetch(`/api/inventory/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity, unit })
    })
    if (res.ok) {
      const updated: FridgeItem = await res.json()
      setFridgeItems((prev) => prev.map((item) => (item.id === id ? updated : item)))
    }
  }

  const handleDeleteFridgeItem = async (id: string) => {
    const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setFridgeItems((prev) => prev.filter((item) => item.id !== id))
      setSelectedFridgeIds((prev) => prev.filter((itemId) => itemId !== id))
    }
  }

  const handleItemAdded = (newFridgeItem: FridgeItem) => {
    setFridgeItems((prev) => [newFridgeItem, ...prev])
    setSelectedFridgeIds((prev) => [...prev, newFridgeItem.id])
  }

  // Meal Formulator handlers
  const handleLogMeal = async (mealData: {
    name: string
    meal_type: string
    servings: number
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    items: any[]
  }) => {
    const today = new Date().toISOString().split('T')[0]
    const res = await fetch('/api/diary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: today,
        meal_type: mealData.meal_type,
        name: mealData.name,
        servings: mealData.servings,
        calories: mealData.calories,
        protein_g: mealData.protein_g,
        carbs_g: mealData.carbs_g,
        fat_g: mealData.fat_g,
        items_json: JSON.stringify(mealData.items)
      })
    })

    if (res.ok) {
      setDiaryRefreshKey((k) => k + 1)
      setToastMessage(`Logged "${mealData.name}" (${mealData.calories} kcal, ${mealData.protein_g}g protein) to your daily diary!`)
      setTimeout(() => setToastMessage(null), 4000)
    }
  }

  const handleStartCooking = async (recipeData: {
    title: string
    servings: number
    ingredients: any[]
  }) => {
    try {
      const res = await fetch('/api/cook/recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipeData)
      })
      if (res.ok) {
        const recipe: Recipe = await res.json()
        setActiveRecipe(recipe)
        setCurrentStepIndex(0)
        setActiveTab('cooking')
      }
    } catch (err) {
      console.warn('Failed to generate recipe:', err)
    }
  }

  const selectedFridgeItems = fridgeItems.filter((fi) => selectedFridgeIds.includes(fi.id))

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-emerald-400">
            <Refrigerator className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-tight">Macros Engine</h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              {config ? `${config.user.name}'s Kitchen (${config.user.daily_goals.calories} kcal / ${config.user.daily_goals.protein_g}g Pro)` : 'Smart Fridge & Kitchen Macro Optimizer'}
            </p>
          </div>
        </div>

        {/* Center Navigation Tabs (Desktop) */}
        <div className="hidden md:flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Refrigerator className="w-3.5 h-3.5" />
            <span>Kitchen Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('restaurant')}
            className={`px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'restaurant'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Eat Out Optimizer</span>
          </button>
          {activeRecipe && (
            <button
              onClick={() => setActiveTab('cooking')}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'cooking'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ChefHat className="w-3.5 h-3.5 text-amber-400" />
              <span>Cooking Station</span>
            </button>
          )}
        </div>

        {/* Right Header: Hands-Free Voice + Healthcheck Status */}
        <div className="flex items-center space-x-3 text-xs">
          {/* Hands-Free Voice Navigator */}
          <VoiceNavigator
            onNextStep={() => setCurrentStepIndex((i) => Math.min((activeRecipe?.steps.length || 1) - 1, i + 1))}
            onPrevStep={() => setCurrentStepIndex((i) => Math.max(0, i - 1))}
            onStartTimer={() => {
              if (timerControlsRef.current) timerControlsRef.current.start()
            }}
            onStopTimer={() => {
              if (timerControlsRef.current) timerControlsRef.current.stop()
            }}
            onResetTimer={() => {
              if (timerControlsRef.current) timerControlsRef.current.reset()
            }}
            onQueryTechnique={(name) => {
              const tech = techniques[name.toLowerCase()]
              if (tech) setActiveTechnique(tech)
            }}
          />

          {/* Healthcheck Tracer Bullet Status */}
          {loadingHealth ? (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-slate-800/80 rounded-full border border-slate-700 text-slate-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Connecting...</span>
            </div>
          ) : health ? (
            <div className="flex items-center space-x-2 px-2.5 py-1 bg-emerald-950/40 rounded-full border border-emerald-800/50 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-medium hidden sm:inline">Online</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 px-2.5 py-1 bg-rose-950/40 rounded-full border border-rose-800/50 text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>{healthError || 'Offline'}</span>
            </div>
          )}
        </div>
      </header>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 bg-slate-900 border border-emerald-500/50 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 text-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-24 md:pb-6">
        {/* Active Tab View */}
        {activeTab === 'restaurant' ? (
          <RestaurantOptimizer />
        ) : activeTab === 'cooking' && activeRecipe ? (
          <CookingStation
            recipe={activeRecipe}
            techniques={techniques}
            onOpenTechnique={(t) => setActiveTechnique(t)}
            onExitCooking={() => setActiveTab('dashboard')}
            currentStepIndex={currentStepIndex}
            setCurrentStepIndex={setCurrentStepIndex}
            onRegisterTimerControls={(ctrls) => {
              timerControlsRef.current = ctrls
            }}
          />
        ) : (
          /* Multi-Column Desktop Dashboard / Tabbed Mobile View */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Column 1: Virtual Fridge & Scanning */}
            <div className={`lg:col-span-4 ${mobileTab === 'inventory' ? 'block' : 'hidden lg:block'}`}>
              <FridgeInventory
                items={fridgeItems}
                selectedItemIds={selectedFridgeIds}
                onToggleSelect={handleToggleSelectFridgeItem}
                onUpdateItem={handleUpdateFridgeItem}
                onDeleteItem={handleDeleteFridgeItem}
                onOpenScanner={() => setScannerOpen(true)}
                onOpenCustomModal={() => setCustomModalOpen(true)}
              />
            </div>

            {/* Column 2: Meal Formulation */}
            <div className={`lg:col-span-5 ${mobileTab === 'formulate' ? 'block' : 'hidden lg:block'}`}>
              <MealFormulator
                selectedItems={selectedFridgeItems}
                onRemoveItem={(id) => setSelectedFridgeIds((prev) => prev.filter((itemId) => itemId !== id))}
                onLogMeal={handleLogMeal}
                onExportCronometer={(data) => setCronometerData(data)}
                onStartCooking={handleStartCooking}
              />
            </div>

            {/* Column 3: Daily Macro Diary */}
            <div className={`lg:col-span-3 ${mobileTab === 'diary' ? 'block' : 'hidden lg:block'}`}>
              <DailyDiary refreshKey={diaryRefreshKey} />
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Hidden on desktop) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-900/95 backdrop-blur z-40 px-2 py-2 flex justify-around items-center text-slate-400">
        <button
          onClick={() => {
            setActiveTab('dashboard')
            setMobileTab('inventory')
          }}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'dashboard' && mobileTab === 'inventory'
              ? 'text-emerald-400 bg-emerald-500/10'
              : 'hover:text-slate-200'
          }`}
        >
          <Refrigerator className="w-5 h-5 mb-0.5" />
          <span>Fridge</span>
        </button>

        <button
          onClick={() => setScannerOpen(true)}
          className="flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium text-emerald-400 hover:text-emerald-300"
        >
          <QrCode className="w-5 h-5 mb-0.5" />
          <span>Scanner</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('dashboard')
            setMobileTab('formulate')
          }}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'dashboard' && mobileTab === 'formulate'
              ? 'text-emerald-400 bg-emerald-500/10'
              : 'hover:text-slate-200'
          }`}
        >
          <UtensilsCrossed className="w-5 h-5 mb-0.5" />
          <span>Cook Pot</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('dashboard')
            setMobileTab('diary')
          }}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'dashboard' && mobileTab === 'diary'
              ? 'text-emerald-400 bg-emerald-500/10'
              : 'hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-5 h-5 mb-0.5" />
          <span>Diary</span>
        </button>

        <button
          onClick={() => setActiveTab('restaurant')}
          className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === 'restaurant'
              ? 'text-emerald-400 bg-emerald-500/10'
              : 'hover:text-slate-200'
          }`}
        >
          <Utensils className="w-5 h-5 mb-0.5" />
          <span>Eat Out</span>
        </button>
      </nav>

      {/* Modals */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onItemAdded={handleItemAdded}
      />

      <AddCustomFoodModal
        isOpen={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        onItemAdded={handleItemAdded}
      />

      <CronometerExportModal
        isOpen={!!cronometerData}
        onClose={() => setCronometerData(null)}
        data={cronometerData}
      />

      <TechniqueModal
        isOpen={!!activeTechnique}
        onClose={() => setActiveTechnique(null)}
        technique={activeTechnique}
      />
    </div>
  )
}

export default App
