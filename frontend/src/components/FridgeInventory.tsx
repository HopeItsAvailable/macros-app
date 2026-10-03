import { useState } from 'react'
import {
  Refrigerator,
  Trash2,
  Edit2,
  Check,
  X,
  Plus,
  Camera,
  Search,
  CheckSquare,
  Square,
  RotateCcw
} from 'lucide-react'
import type { FridgeItem } from '../types'

interface FridgeInventoryProps {
  items: FridgeItem[]
  selectedItemIds: string[]
  onToggleSelect: (item: FridgeItem) => void
  onUpdateItem: (id: string, quantity: number, unit: string) => Promise<void>
  onDeleteItem: (id: string) => Promise<void>
  onOpenScanner: () => void
  onOpenCustomModal: () => void
}

export function FridgeInventory({
  items,
  selectedItemIds,
  onToggleSelect,
  onUpdateItem,
  onDeleteItem,
  onOpenScanner,
  onOpenCustomModal
}: FridgeInventoryProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState<string>('')
  const [editUnit, setEditUnit] = useState<string>('')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{
    item: FridgeItem
    timeoutId: ReturnType<typeof setTimeout>
  } | null>(null)

  const categories = ['All', 'Produce', 'Meat', 'Dairy', 'Pantry', 'Bakery', 'Seafood', 'Snacks']

  const filteredItems = items.filter((itm) => {
    if (pendingDelete && itm.id === pendingDelete.item.id) return false
    const matchesSearch = itm.item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (itm.item.brand && itm.item.brand.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = activeCategory === 'All' || itm.item.category.toLowerCase().includes(activeCategory.toLowerCase())
    return matchesSearch && matchesCategory
  })

  const startEdit = (itm: FridgeItem) => {
    setEditingId(itm.id)
    setEditQty(itm.quantity.toString())
    setEditUnit(itm.unit)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id: string) => {
    const qty = parseFloat(editQty)
    if (isNaN(qty) || qty <= 0) return
    setActionLoadingId(id)
    try {
      await onUpdateItem(id, qty, editUnit)
      setEditingId(null)
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDelete = (id: string) => {
    // If an existing item was in pending-delete, commit it immediately
    if (pendingDelete) {
      clearTimeout(pendingDelete.timeoutId)
      onDeleteItem(pendingDelete.item.id)
    }

    const target = items.find((itm) => itm.id === id)
    if (!target) return

    const timeoutId = setTimeout(async () => {
      try {
        await onDeleteItem(id)
      } finally {
        setPendingDelete(null)
      }
    }, 4500)

    setPendingDelete({ item: target, timeoutId })
  }

  const handleUndo = () => {
    if (pendingDelete) {
      clearTimeout(pendingDelete.timeoutId)
      setPendingDelete(null)
    }
  }

  const handleDismissUndo = async () => {
    if (pendingDelete) {
      clearTimeout(pendingDelete.timeoutId)
      const id = pendingDelete.item.id
      setPendingDelete(null)
      await onDeleteItem(id)
    }
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex flex-col h-full">
      {/* Header with Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-2">
          <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-emerald-400">
            <Refrigerator className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm tracking-wide text-slate-200 uppercase">Virtual Fridge</h2>
            <span className="text-[11px] text-slate-400">{items.length} ingredients in stock</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenScanner}
            className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Scan Barcode</span>
          </button>
          <button
            onClick={onOpenCustomModal}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Fresh / Custom</span>
          </button>
        </div>
      </div>

      {/* Search & Category Filter Pills */}
      <div className="space-y-2.5 mb-4">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search ingredients in fridge..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-[11px] scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-0.5 rounded-full border transition-colors whitespace-nowrap cursor-pointer ${
                activeCategory === cat
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-medium'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Item List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[500px]">
        {filteredItems.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-lg p-8 flex flex-col items-center justify-center text-center text-slate-500">
            <Refrigerator className="w-8 h-8 mb-2 opacity-30 text-emerald-400" />
            <p className="text-xs font-medium text-slate-400">No stocked items found</p>
            <p className="text-[11px] text-slate-500 mt-1">Scan grocery barcodes or add custom fresh foods above</p>
          </div>
        ) : (
          filteredItems.map((fi) => {
            const isSelected = selectedItemIds.includes(fi.id)
            const isEditing = editingId === fi.id
            const isLoading = actionLoadingId === fi.id

            return (
              <div
                key={fi.id}
                className={`group border rounded-xl p-3 transition-all ${
                  isSelected
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  {/* Select for Formulation Toggle */}
                  <button
                    onClick={() => onToggleSelect(fi)}
                    className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
                    title={isSelected ? 'Remove from Cooking Plate' : 'Add to Cooking Plate'}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  {/* Food Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-semibold text-slate-200 truncate">{fi.item.name}</h4>
                      {fi.item.brand && (
                        <span className="text-[10px] text-slate-500 truncate">({fi.item.brand})</span>
                      )}
                    </div>

                    {/* Category and Serving details */}
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800/60 text-slate-400 border border-slate-700/50">
                        {fi.item.category || 'Pantry'}
                      </span>
                      {fi.item.is_custom && (
                        <span className="text-[10px] text-emerald-400/80 font-medium">Custom</span>
                      )}
                    </div>

                    {/* Macros snippet */}
                    <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-1.5 font-mono">
                      <span>{fi.item.calories} cal</span>
                      <span>•</span>
                      <span className="text-sky-400">{fi.item.protein_g}g P</span>
                      <span>•</span>
                      <span className="text-amber-400">{fi.item.carbs_g}g C</span>
                      <span>•</span>
                      <span className="text-rose-400">{fi.item.fat_g}g F</span>
                    </div>
                  </div>

                  {/* Quantity & Edit/Delete Controls */}
                  <div className="flex flex-col items-end space-y-1">
                    {isEditing ? (
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          step="any"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          className="w-14 bg-slate-900 border border-emerald-500 rounded px-1.5 py-0.5 text-xs text-white font-mono"
                        />
                        <select
                          value={editUnit}
                          onChange={(e) => setEditUnit(e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-white"
                        >
                          <option value="count">count</option>
                          <option value="grams">g</option>
                          <option value="oz">oz</option>
                          <option value="lbs">lbs</option>
                        </select>
                        <button
                          onClick={() => saveEdit(fi.id)}
                          className="text-emerald-400 hover:text-emerald-300 p-0.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-slate-400 hover:text-slate-300 p-0.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-semibold text-slate-300 font-mono">
                          {fi.quantity} {fi.unit}
                        </span>
                        <button
                          onClick={() => startEdit(fi)}
                          className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 cursor-pointer opacity-70 group-hover:opacity-100"
                          title="Edit quantity"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(fi.id)}
                          className="text-slate-500 hover:text-rose-400 transition-colors p-0.5 cursor-pointer opacity-70 group-hover:opacity-100"
                          title="Remove from fridge"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Undo Toast Notification */}
      {pendingDelete && (
        <div className="mt-3 p-3 bg-slate-950 border border-emerald-500/40 rounded-xl flex items-center justify-between shadow-xl animate-fade-in text-xs">
          <div className="flex items-center space-x-2 text-slate-200 truncate">
            <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">
              Removed <strong className="text-white">{pendingDelete.item.item.name}</strong>
            </span>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleUndo}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-medium text-[11px] flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Undo</span>
            </button>
            <button
              onClick={handleDismissUndo}
              className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
