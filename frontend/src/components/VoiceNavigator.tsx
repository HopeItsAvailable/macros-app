import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Volume2 } from 'lucide-react'

// Define speech recognition interface for TypeScript
interface IWindow extends Window {
  SpeechRecognition?: any
  webkitSpeechRecognition?: any
}

interface VoiceNavigatorProps {
  onNextStep: () => void
  onPrevStep: () => void
  onStartTimer: () => void
  onStopTimer: () => void
  onResetTimer: () => void
  onQueryTechnique?: (techniqueName: string) => void
}

export function VoiceNavigator({
  onNextStep,
  onPrevStep,
  onStartTimer,
  onStopTimer,
  onResetTimer,
  onQueryTechnique
}: VoiceNavigatorProps) {
  const [isListening, setIsListening] = useState(false)
  const [lastAction, setLastAction] = useState<string>('')
  const [supported, setSupported] = useState(true)

  const recognitionRef = useRef<any>(null)
  const isListeningRef = useRef(false)
  const callbacksRef = useRef({
    onNextStep,
    onPrevStep,
    onStartTimer,
    onStopTimer,
    onResetTimer,
    onQueryTechnique
  })

  useEffect(() => {
    callbacksRef.current = {
      onNextStep,
      onPrevStep,
      onStartTimer,
      onStopTimer,
      onResetTimer,
      onQueryTechnique
    }
  }, [onNextStep, onPrevStep, onStartTimer, onStopTimer, onResetTimer, onQueryTechnique])

  useEffect(() => {
    const win = window as unknown as IWindow
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition
    if (!SpeechRecognitionClass) {
      setSupported(false)
      return
    }

    const recognition = new SpeechRecognitionClass()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      const current = event.resultIndex
      const transcript = event.results[current][0].transcript.toLowerCase().trim()
      const c = callbacksRef.current

      // Command dispatching
      if (transcript.includes('next') || transcript.includes('forward')) {
        setLastAction('Advanced to next step')
        c.onNextStep()
      } else if (transcript.includes('previous') || transcript.includes('back')) {
        setLastAction('Returned to previous step')
        c.onPrevStep()
      } else if (transcript.includes('start timer') || transcript.includes('begin timer') || transcript.includes('play timer')) {
        setLastAction('Started countdown timer')
        c.onStartTimer()
      } else if (transcript.includes('stop timer') || transcript.includes('pause timer')) {
        setLastAction('Paused countdown timer')
        c.onStopTimer()
      } else if (transcript.includes('reset timer')) {
        setLastAction('Reset countdown timer')
        c.onResetTimer()
      } else if (transcript.includes('julienne')) {
        setLastAction('Opened Julienne guide')
        c.onQueryTechnique?.('julienne')
      } else if (transcript.includes('chiffonade')) {
        setLastAction('Opened Chiffonade guide')
        c.onQueryTechnique?.('chiffonade')
      } else if (transcript.includes('dice')) {
        setLastAction('Opened Dice guide')
        c.onQueryTechnique?.('dice')
      } else if (transcript.includes('sear')) {
        setLastAction('Opened Sear guide')
        c.onQueryTechnique?.('sear')
      } else if (transcript.includes('deglaze')) {
        setLastAction('Opened Deglaze guide')
        c.onQueryTechnique?.('deglaze')
      } else {
        setLastAction(`Heard: "${transcript}"`)
      }
    }

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error)
      if (event.error === 'not-allowed') {
        isListeningRef.current = false
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      if (isListeningRef.current) {
        try {
          recognition.start()
        } catch {
          // ignore already started
        }
      }
    }

    recognitionRef.current = recognition

    return () => {
      isListeningRef.current = false
      try {
        recognition.stop()
      } catch {
        // ignore
      }
    }
  }, [])

  const toggleListening = () => {
    if (!supported || !recognitionRef.current) return
    if (isListening) {
      isListeningRef.current = false
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      setIsListening(false)
      setLastAction('')
    } else {
      try {
        isListeningRef.current = true
        recognitionRef.current.start()
        setIsListening(true)
        setLastAction('Listening for commands...')
      } catch (err) {
        console.warn('Speech start error:', err)
        isListeningRef.current = false
        setIsListening(false)
      }
    }
  }

  if (!supported) return null

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={toggleListening}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
          isListening
            ? 'bg-rose-950/80 border border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse'
            : 'bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300'
        }`}
        title={isListening ? 'Click to disable hands-free voice control' : 'Enable hands-free voice control'}
      >
        {isListening ? <Mic className="w-3.5 h-3.5 text-rose-400" /> : <MicOff className="w-3.5 h-3.5 text-slate-400" />}
        <span>{isListening ? 'Voice Active' : 'Hands-Free Voice'}</span>
      </button>

      {/* Voice feedback badge */}
      {isListening && lastAction && (
        <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-full text-[11px] text-emerald-400 font-mono">
          <Volume2 className="w-3 h-3 animate-pulse" />
          <span className="truncate max-w-xs">{lastAction}</span>
        </div>
      )}
    </div>
  )
}
