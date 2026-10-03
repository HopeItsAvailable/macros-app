import { X, Video, ShieldAlert, BookOpen, ExternalLink } from 'lucide-react'
import type { CulinaryTechnique } from '../types'

interface TechniqueModalProps {
  isOpen: boolean
  onClose: () => void
  technique: CulinaryTechnique | null
}

export function TechniqueModal({ isOpen, onClose, technique }: TechniqueModalProps) {
  if (!isOpen || !technique) return null

  const handleLaunchVideo = () => {
    if (technique.video_url) {
      window.open(technique.video_url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">{technique.name}</h3>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                {technique.category === 'knife_skills' ? 'Knife Skills & Prep' : 'Cooking Method'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-slate-300 mb-1">Technique Overview</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{technique.summary}</p>
          </div>

          {/* Safety Tips Banner */}
          <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-3 flex items-start space-x-2.5 text-amber-300 text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-amber-200">Chef Safety Tip</span>
              <p className="text-amber-400/90 mt-0.5 leading-relaxed">{technique.safety_tips}</p>
            </div>
          </div>

          {/* Video Launcher Action */}
          <div className="pt-2 flex justify-end space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleLaunchVideo}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-all flex items-center space-x-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            >
              <Video className="w-4 h-4" />
              <span>Watch Video ({technique.timestamp})</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
