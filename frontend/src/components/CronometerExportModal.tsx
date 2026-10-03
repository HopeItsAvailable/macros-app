import { useState } from 'react'
import { X, Copy, Check, Share2 } from 'lucide-react'

interface CronometerExportModalProps {
  isOpen: boolean
  onClose: () => void
  data: {
    title: string
    servings: number
    ingredients: Array<{
      name: string
      grams: number
      calories: number
      protein_g: number
      carbs_g: number
      fat_g: number
    }>
    totals: {
      calories: number
      protein_g: number
      carbs_g: number
      fat_g: number
    }
  } | null
}

export function CronometerExportModal({ isOpen, onClose, data }: CronometerExportModalProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen || !data) return null

  const servings = data.servings > 0 ? data.servings : 1
  const perServing = {
    calories: Math.round(data.totals.calories / servings),
    protein_g: Math.round((data.totals.protein_g / servings) * 10) / 10,
    carbs_g: Math.round((data.totals.carbs_g / servings) * 10) / 10,
    fat_g: Math.round((data.totals.fat_g / servings) * 10) / 10
  }

  const todayStr = new Date().toISOString().split('T')[0]

  // Clean Cronometer input format
  const digestString = [
    `=== Cronometer Gram Digest ===`,
    `Meal: ${data.title}`,
    `Date: ${todayStr}`,
    `Yield: ${servings} serving(s)`,
    ``,
    `Ingredients:`,
    ...data.ingredients.map(
      (ing) => `- ${ing.name}: ${ing.grams}g (${ing.calories} kcal | ${ing.protein_g}g P | ${ing.carbs_g}g C | ${ing.fat_g}g F)`
    ),
    ``,
    `Total Recipe Macros:`,
    `Calories: ${data.totals.calories} kcal | Protein: ${data.totals.protein_g}g | Carbs: ${data.totals.carbs_g}g | Fat: ${data.totals.fat_g}g`,
    ``,
    `Per Serving (1 of ${servings}):`,
    `Calories: ${perServing.calories} kcal | Protein: ${perServing.protein_g}g | Carbs: ${perServing.carbs_g}g | Fat: ${perServing.fat_g}g`
  ].join('\n')

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(digestString)
      } else {
        // Fallback for older/unsupported environments
        const textArea = document.createElement('textarea')
        textArea.value = digestString
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      console.warn('Copy failed:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-emerald-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Cronometer Gram Digest</h3>
              <p className="text-xs text-slate-400">1-click itemized format for rapid 5-second entry</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Digest Preview Box */}
        <div className="p-5 space-y-4">
          <div className="relative">
            <pre className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[300px]">
              {digestString}
            </pre>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              Ready to paste into Cronometer, MyFitnessPal, or notes.
            </span>

            <button
              onClick={handleCopy}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center space-x-2 cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
