import { useState, useEffect, useRef } from 'react'
import { X, Camera, QrCode, AlertCircle, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { playScanSuccess } from '../utils/audio'
import type { Item, FridgeItem } from '../types'

interface BarcodeScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onItemAdded: (item: FridgeItem) => void
}

export function BarcodeScannerModal({ isOpen, onClose, onItemAdded }: BarcodeScannerModalProps) {
  const [manualCode, setManualCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successItem, setSuccessItem] = useState<Item | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<number | null>(null)
  const isResolvingRef = useRef(false)
  const lastScannedCodeRef = useRef<{ code: string; time: number } | null>(null)
  const resolveAndAddRef = useRef<(code: string) => Promise<void>>(async () => {})

  // Resolve barcode and immediately add into fridge inventory
  const handleResolveAndAdd = async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed || isResolvingRef.current) return

    // Prevent duplicate adds of the same barcode within a 4-second cooldown window
    if (
      lastScannedCodeRef.current &&
      lastScannedCodeRef.current.code === trimmed &&
      Date.now() - lastScannedCodeRef.current.time < 4000
    ) {
      return
    }

    isResolvingRef.current = true
    setLoading(true)
    setError(null)
    setSuccessItem(null)

    try {
      // 1. Resolve barcode (queries SQLite cache or Open Food Facts)
      const res = await fetch(`/api/barcode/${encodeURIComponent(trimmed)}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Barcode ${trimmed} not found in database or Open Food Facts`)
      }
      const item: Item = await res.json()

      // 2. Play audio confirmation beep
      playScanSuccess()

      // 3. Immediately add to fridge inventory
      const addRes = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: item.id,
          quantity: 1,
          unit: 'count'
        })
      })

      if (!addRes.ok) {
        throw new Error('Resolved item, but failed to save to fridge inventory.')
      }

      const fridgeItem: FridgeItem = await addRes.json()
      lastScannedCodeRef.current = { code: trimmed, time: Date.now() }
      setSuccessItem(item)
      onItemAdded(fridgeItem)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error scanning barcode')
    } finally {
      setLoading(false)
      isResolvingRef.current = false
    }
  }

  useEffect(() => {
    resolveAndAddRef.current = handleResolveAndAdd
  })

  // Start Camera
  const startCamera = async () => {
    setCameraError(null)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported on this browser/insecure origin.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)

      // Initialize BarcodeDetector if supported
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as unknown as {
          BarcodeDetector: new (opts: { formats: string[] }) => {
            detect: (image: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>
          }
        }).BarcodeDetector({
          formats: ['ean_13', 'upc_a', 'upc_e', 'code_128', 'qr_code']
        })

        scanIntervalRef.current = window.setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current)
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                const code = barcodes[0].rawValue.trim()
                resolveAndAddRef.current(code)
              }
            } catch (err) {
              console.warn('Barcode detect frame error:', err)
            }
          }
        }, 350)
      }
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Could not start camera')
      setCameraActive(false)
    }
  }

  // Stop Camera
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
      setError(null)
      setSuccessItem(null)
      setManualCode('')
    }
    return () => {
      stopCamera()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Live Camera Barcode Scanner</h3>
              <p className="text-xs text-slate-400">Scan packaged items to resolve & stock automatically</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
          />

          {!cameraActive && (
            <div className="flex flex-col items-center justify-center text-slate-500 p-6 text-center">
              <Camera className="w-12 h-12 mb-2 opacity-40 text-emerald-400" />
              <p className="text-sm text-slate-400 font-medium">Camera Inactive</p>
              {cameraError && <p className="text-xs text-rose-400 mt-1 max-w-xs">{cameraError}</p>}
              <button
                onClick={startCamera}
                className="mt-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors"
              >
                Start Camera
              </button>
            </div>
          )}

          {/* Viewfinder Target Overlay */}
          {cameraActive && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-36 border-2 border-emerald-400/80 rounded-xl relative shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                <div className="w-full h-0.5 bg-emerald-400/50 absolute top-1/2 -translate-y-1/2 animate-pulse" />
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
              <span className="text-xs font-medium">Resolving product & caching macros...</span>
            </div>
          )}
        </div>

        {/* Scan Status Feedback */}
        <div className="p-5 space-y-4">
          {successItem && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-start space-x-3 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-white">{successItem.name}</span>
                  <span className="text-emerald-400 font-mono font-medium">Added to Fridge!</span>
                </div>
                <p className="text-slate-400 mt-0.5">
                  {successItem.calories} kcal | {successItem.protein_g}g Pro | {successItem.carbs_g}g Carb | {successItem.fat_g}g Fat
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Manual Entry or Direct Test Barcode Input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
              <QrCode className="w-3.5 h-3.5 text-emerald-400" />
              <span>Manual Barcode Entry (or Barcode Reader input)</span>
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Enter UPC/EAN (e.g. 737628064502)"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleResolveAndAdd(manualCode)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <button
                onClick={() => handleResolveAndAdd(manualCode)}
                disabled={!manualCode.trim() || loading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                Scan / Add
              </button>
            </div>
          </div>

          {/* Preset Grocery Barcodes for Testing */}
          <div className="border-t border-slate-800 pt-3">
            <span className="text-[11px] text-slate-500 flex items-center space-x-1 mb-2">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>One-click test grocery barcodes:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Thai Noodles', code: '737628064502' },
                { label: 'Greek Yogurt', code: '041220576920' },
                { label: 'Oat Milk', code: '025293002241' },
                { label: 'Eggs Cart', code: '078742351865' }
              ].map((btn) => (
                <button
                  key={btn.code}
                  onClick={() => handleResolveAndAdd(btn.code)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-mono transition-colors cursor-pointer"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
