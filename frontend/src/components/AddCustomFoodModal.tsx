import { useState } from 'react'
import { X, Apple, Plus, AlertCircle, Loader2 } from 'lucide-react'
import type { FridgeItem } from '../types'

interface AddCustomFoodModalProps {
  isOpen: boolean
  onClose: () => void
  onItemAdded: (item: FridgeItem) => void
}

export function AddCustomFoodModal({ isOpen, onClose, onItemAdded }: AddCustomFoodModalProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Produce')
  const [servingSizeG, setServingSizeG] = useState('100')
  const [calories, setCalories] = useState('120')
  const [proteinG, setProteinG] = useState('20')
  const [carbsG, setCarbsG] = useState('0')
  const [fatG, setFatG] = useState('2')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('count')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please provide an ingredient or food name')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          serving_size_g: parseFloat(servingSizeG) || 100,
          calories: parseFloat(calories) || 0,
          protein_g: parseFloat(proteinG) || 0,
          carbs_g: parseFloat(carbsG) || 0,
          fat_g: parseFloat(fatG) || 0,
          quantity: parseFloat(quantity) || 1,
          unit: unit.trim() || 'count'
        })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save food to inventory')
      }

      const created: FridgeItem = await res.json()
      onItemAdded(created)
      onClose()
      // Reset form
      setName('')
      setCategory('Produce')
      setCalories('120')
      setProteinG('20')
      setCarbsG('0')
      setFatG('2')
      setQuantity('1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating item')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-emerald-400">
              <Apple className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Add Custom / Fresh Food</h3>
              <p className="text-xs text-slate-400">Produce, butcher cuts, bulk staples</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Food Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Honeycrisp Apple, Ground Turkey 93/7"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Produce">Produce / Veggies</option>
                <option value="Meat">Meat & Poultry</option>
                <option value="Seafood">Seafood</option>
                <option value="Dairy">Dairy & Eggs</option>
                <option value="Pantry">Pantry & Grains</option>
                <option value="Bakery">Bakery / Bread</option>
                <option value="Snacks">Snacks & Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Serving Weight (g)</label>
              <input
                type="number"
                step="any"
                value={servingSizeG}
                onChange={(e) => setServingSizeG(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Macros row */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Nutritional Profile (per serving)</label>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Calories</span>
                <input
                  type="number"
                  step="any"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-center text-white font-mono focus:border-emerald-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Protein (g)</span>
                <input
                  type="number"
                  step="any"
                  value={proteinG}
                  onChange={(e) => setProteinG(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-center text-sky-400 font-mono focus:border-emerald-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Carbs (g)</span>
                <input
                  type="number"
                  step="any"
                  value={carbsG}
                  onChange={(e) => setCarbsG(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-center text-amber-400 font-mono focus:border-emerald-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Fat (g)</span>
                <input
                  type="number"
                  step="any"
                  value={fatG}
                  onChange={(e) => setFatG(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-center text-rose-400 font-mono focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Stock Quantity */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Initial Quantity</label>
              <input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="count">Count / Items</option>
                <option value="grams">Grams (g)</option>
                <option value="oz">Ounces (oz)</option>
                <option value="lbs">Pounds (lbs)</option>
                <option value="ml">Milliliters (ml)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Add to Fridge</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
