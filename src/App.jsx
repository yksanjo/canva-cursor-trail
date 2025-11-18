import { useCallback, useEffect, useRef, useState } from 'react'
import { Brush, Circle, MonitorUp, Radio, Sparkles, Star, Wand2 } from 'lucide-react'

const MAX_POINTS = 48
const STORAGE_KEY = 'cursor-trail-settings-v1'

const TRAIL_STYLES = [
  { id: 'gradient', name: 'Gradient', icon: Circle },
  { id: 'sparkle', name: 'Sparkle', icon: Sparkles },
  { id: 'brush', name: 'Brush', icon: Brush },
  { id: 'star', name: 'Star', icon: Star },
  { id: 'glow', name: 'Glow', icon: Wand2 },
]

const COLOR_PRESETS = [
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Green', value: '#10B981' },
  { name: 'Orange', value: '#F59E0B' },
  { name: 'Canva', value: '#00C4CC' },
]

const PRESET_COMBOS = [
  {
    id: 'tutorial-pop',
    name: 'Tutorial Pop',
    shortcut: '1',
    description: 'Sparkle bursts that highlight quick steps.',
    config: { style: 'sparkle', color: '#F59E0B', size: 28, fade: 70 },
  },
  {
    id: 'signature-cyan',
    name: 'Canva Glow',
    shortcut: '2',
    description: 'Soft glow in Canva signature cyan.',
    config: { style: 'glow', color: '#00C4CC', size: 32, fade: 55 },
  },
  {
    id: 'brush-studio',
    name: 'Brush Studio',
    shortcut: '3',
    description: 'Organic brush strokes for live sketching.',
    config: { style: 'brush', color: '#8B5CF6', size: 36, fade: 85 },
  },
]

const hexToRgba = (hex, alpha) => {
  const sanitized = hex.replace('#', '')
  const bigint = parseInt(sanitized, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function drawPoint(ctx, point, options) {
  const { style, color, size } = options
  const alpha = Math.max(point.life, 0)
  const radius = size * alpha

  ctx.save()

  switch (style) {
    case 'gradient': {
      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius)
      gradient.addColorStop(0, hexToRgba(color, alpha))
      gradient.addColorStop(1, hexToRgba(color, 0))
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'sparkle': {
      ctx.strokeStyle = hexToRgba(color, alpha)
      ctx.lineWidth = Math.max(1, radius / 6)
      const arms = 4
      const offset = point.seed

      for (let i = 0; i < arms; i++) {
        const angle = (Math.PI / 2) * i + offset
        const length = radius * 0.9
        ctx.beginPath()
        ctx.moveTo(point.x, point.y)
        ctx.lineTo(point.x + Math.cos(angle) * length, point.y + Math.sin(angle) * length)
        ctx.stroke()
      }
      break
    }
    case 'brush': {
      ctx.globalAlpha = alpha * 0.35
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.ellipse(point.x, point.y, radius, radius * 0.6, point.seed, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'star': {
      ctx.fillStyle = hexToRgba(color, alpha)
      ctx.beginPath()
      const spikes = 5
      for (let i = 0; i < spikes; i++) {
        const outerAngle = (Math.PI * 2 * i) / spikes - Math.PI / 2
        const innerAngle = outerAngle + Math.PI / spikes
        const outerX = point.x + Math.cos(outerAngle) * radius
        const outerY = point.y + Math.sin(outerAngle) * radius
        const innerX = point.x + Math.cos(innerAngle) * (radius * 0.45)
        const innerY = point.y + Math.sin(innerAngle) * (radius * 0.45)

        if (i === 0) ctx.moveTo(outerX, outerY)
        else ctx.lineTo(outerX, outerY)
        ctx.lineTo(innerX, innerY)
      }
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'glow': {
      const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 1.6)
      glow.addColorStop(0, hexToRgba(color, alpha * 0.9))
      glow.addColorStop(0.5, hexToRgba(color, alpha * 0.45))
      glow.addColorStop(1, hexToRgba(color, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(point.x, point.y, radius * 1.6, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    default:
      break
  }

  ctx.restore()
}

function App() {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const pointsRef = useRef([])
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const screenStreamRef = useRef(null)

  const [isActive, setIsActive] = useState(true)
  const [trailStyle, setTrailStyle] = useState('gradient')
  const [trailColor, setTrailColor] = useState('#8B5CF6')
  const [trailSize, setTrailSize] = useState(22)
  const [fadeSpeed, setFadeSpeed] = useState(55)
  const [activePresetId, setActivePresetId] = useState(null)
  const [settingsHydrated, setSettingsHydrated] = useState(false)
  const [obsReady, setObsReady] = useState(false)
  const [recordingState, setRecordingState] = useState('idle')
  const [recordingUrl, setRecordingUrl] = useState(null)
  const [recordingError, setRecordingError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (typeof parsed.isActive === 'boolean') setIsActive(parsed.isActive)
        if (typeof parsed.trailStyle === 'string') setTrailStyle(parsed.trailStyle)
        if (typeof parsed.trailColor === 'string') setTrailColor(parsed.trailColor)
        if (typeof parsed.trailSize === 'number') setTrailSize(parsed.trailSize)
        if (typeof parsed.fadeSpeed === 'number') setFadeSpeed(parsed.fadeSpeed)
        if (typeof parsed.activePresetId === 'string') setActivePresetId(parsed.activePresetId)
      }
    } catch (error) {
      console.warn('Cursor trail settings could not be restored.', error)
    } finally {
      setSettingsHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!settingsHydrated || typeof window === 'undefined') return
    const payload = { isActive, trailStyle, trailColor, trailSize, fadeSpeed, activePresetId }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [isActive, trailStyle, trailColor, trailSize, fadeSpeed, activePresetId, settingsHydrated])

  const applyPreset = useCallback((preset) => {
    if (!preset) return
    setTrailStyle(preset.config.style)
    setTrailColor(preset.config.color)
    setTrailSize(preset.config.size)
    setFadeSpeed(preset.config.fade)
    setActivePresetId(preset.id)
  }, [])

  const startRecording = useCallback(async () => {
    if (recordingState === 'recording') return
    if (!navigator?.mediaDevices?.getDisplayMedia) {
      setRecordingError('Screen capture is not supported in this browser yet.')
      return
    }

    setRecordingError('')
    setRecordingUrl(null)

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 60 },
        audio: false,
      })

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' })
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        setRecordingUrl(url)
        chunksRef.current = []
        stream.getTracks().forEach((track) => track.stop())
        screenStreamRef.current = null
        setRecordingState('idle')
      }

      mediaRecorderRef.current = recorder
      screenStreamRef.current = stream
      recorder.start()
      setRecordingState('recording')
    } catch (error) {
      setRecordingError(error?.message || 'Unable to start screen recording.')
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop())
        screenStreamRef.current = null
      }
      setRecordingState('idle')
    }
  }, [recordingState])

  const stopRecording = useCallback(() => {
    if (recordingState !== 'recording' || !mediaRecorderRef.current) return
    setRecordingState('processing')
    mediaRecorderRef.current.stop()
    mediaRecorderRef.current = null
  }, [recordingState])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const updateSize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!isActive) return
      pointsRef.current.push({
        x: event.clientX,
        y: event.clientY,
        life: 1,
        seed: Math.random() * Math.PI * 2,
      })

      if (pointsRef.current.length > MAX_POINTS) {
        pointsRef.current.shift()
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [isActive])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const nextPoints = []

      for (const point of pointsRef.current) {
        const nextLife = point.life - fadeSpeed / 1000
        if (nextLife <= 0) continue
        const updatedPoint = { ...point, life: nextLife }
        nextPoints.push(updatedPoint)
        drawPoint(ctx, updatedPoint, { style: trailStyle, color: trailColor, size: trailSize })
      }

      pointsRef.current = nextPoints
      animationRef.current = requestAnimationFrame(render)
    }

    render()
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [trailStyle, trailColor, trailSize, fadeSpeed])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateObsState = () => {
      setObsReady(Boolean(window.obsstudio))
    }

    updateObsState()
    const interval = window.setInterval(updateObsState, 2000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return

      const key = event.key.toLowerCase()

      if (key === 't') {
        event.preventDefault()
        setIsActive((prev) => !prev)
        return
      }

      if (key === 'r') {
        event.preventDefault()
        if (recordingState === 'recording') stopRecording()
        else startRecording()
        return
      }

      if (event.key === '[') {
        event.preventDefault()
        setTrailSize((current) => Math.max(12, current - 2))
        setActivePresetId(null)
        return
      }

      if (event.key === ']') {
        event.preventDefault()
        setTrailSize((current) => Math.min(60, current + 2))
        setActivePresetId(null)
        return
      }

      const preset = PRESET_COMBOS.find((combo) => combo.shortcut === event.key)
      if (preset) {
        event.preventDefault()
        applyPreset(preset)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [applyPreset, recordingState, startRecording, stopRecording])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const controls = {
      toggle: () => setIsActive((prev) => !prev),
      applyPreset: (presetId) => {
        const preset = PRESET_COMBOS.find((combo) => combo.id === presetId)
        if (preset) applyPreset(preset)
      },
      startRecording,
      stopRecording,
    }

    window.cursorTrailControls = controls
    return () => {
      if (window.cursorTrailControls === controls) {
        delete window.cursorTrailControls
      }
    }
  }, [applyPreset, startRecording, stopRecording])

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-10" />

      <div className="absolute top-6 left-6 z-20 w-80 rounded-2xl bg-white/95 p-6 shadow-2xl shadow-purple-500/20">
        <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
          <span className="flex items-center gap-2 text-slate-500">
            <Radio size={14} className={obsReady ? 'text-emerald-500' : 'text-slate-400'} />
            {obsReady ? 'OBS Browser Source linked' : 'Standalone mode'}
          </span>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700">T to toggle</span>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Borcelle Studio</p>
            <h2 className="font-display text-2xl font-semibold text-slate-900">Cursor Trail</h2>
          </div>
          <button
            onClick={() => setIsActive((prev) => !prev)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              isActive ? 'bg-purple-600 text-white shadow-md shadow-purple-400/40' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {isActive ? 'ON' : 'OFF'}
          </button>
        </div>

        <section className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-slate-600">Trail Style</label>
          <div className="grid grid-cols-3 gap-2">
            {TRAIL_STYLES.map((style) => {
              const Icon = style.icon
              const active = trailStyle === style.id
              return (
                <button
                  key={style.id}
                  onClick={() => {
                    setTrailStyle(style.id)
                    setActivePresetId(null)
                  }}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-3 text-xs font-semibold transition-all ${
                    active ? 'border-purple-500 bg-purple-50 text-purple-600 drop-shadow-glow' : 'border-slate-200 bg-white'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {style.name}
                </button>
              )
            })}
          </div>
        </section>

        <section className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-slate-600">Color</label>
          <div className="grid grid-cols-6 gap-2">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color.value}
                className={`h-10 w-10 rounded-xl border-2 transition-transform ${
                  trailColor === color.value ? 'border-slate-900 scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: color.value }}
                onClick={() => {
                  setTrailColor(color.value)
                  setActivePresetId(null)
                }}
                title={color.name}
              />
            ))}
          </div>
        </section>

        <section className="mb-6">
          <label className="mb-1 block text-sm font-semibold text-slate-600">Preset Combos</label>
          <div className="flex flex-col gap-3">
            {PRESET_COMBOS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={`flex items-start justify-between rounded-xl border-2 p-3 text-left transition-all ${
                  activePresetId === preset.id ? 'border-purple-500 bg-purple-50 drop-shadow-glow' : 'border-slate-200 bg-white'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">{preset.name}</p>
                  <p className="text-xs text-slate-500">{preset.description}</p>
                </div>
                <span className="text-xs font-semibold text-slate-500">{preset.shortcut}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <label className="mb-1 block text-sm font-semibold text-slate-600">Size: {trailSize}px</label>
          <input
            type="range"
            min="12"
            max="60"
            value={trailSize}
            onChange={(event) => {
              setTrailSize(Number(event.target.value))
              setActivePresetId(null)
            }}
            className="w-full accent-purple-600"
          />
        </section>

        <section className="mb-6">
          <label className="mb-1 block text-sm font-semibold text-slate-600">Fade Speed: {fadeSpeed}</label>
          <input
            type="range"
            min="20"
            max="120"
            value={fadeSpeed}
            onChange={(event) => {
              setFadeSpeed(Number(event.target.value))
              setActivePresetId(null)
            }}
            className="w-full accent-purple-600"
          />
        </section>

        <section className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-slate-600">Recording & OBS</label>
          <div className="space-y-3">
            <button
              onClick={() => (recordingState === 'recording' ? stopRecording() : startRecording())}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                recordingState === 'recording'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-400/40'
                  : 'bg-slate-900 text-white'
              }`}
            >
              <MonitorUp size={16} />
              {recordingState === 'recording' ? 'Stop Recording (R)' : 'Record Screen (R)'}
            </button>
            {recordingState === 'processing' && (
              <p className="text-xs font-semibold text-slate-500">Finalizing video…</p>
            )}
            {recordingUrl && (
              <a
                href={recordingUrl}
                download={`cursor-trail-${Date.now()}.webm`}
                className="block text-center text-xs font-semibold text-purple-600 underline"
              >
                Download last recording
              </a>
            )}
            {recordingError && <p className="text-xs text-rose-600">{recordingError}</p>}
            <p className="text-[11px] text-slate-500">
              Recording uses the browser Screen Capture API. Add this page as a Browser Source in OBS to sync the
              controls live.
            </p>
          </div>
        </section>

        <section className="mb-4">
          <label className="mb-2 block text-sm font-semibold text-slate-600">Keyboard Shortcuts</label>
          <ul className="text-xs text-slate-500">
            <li className="flex justify-between"><span>T</span><span>Toggle trail</span></li>
            <li className="flex justify-between"><span>R</span><span>Start/stop recording</span></li>
            <li className="flex justify-between"><span>[ / ]</span><span>Adjust size</span></li>
            <li className="flex justify-between"><span>1-3</span><span>Apply preset combos</span></li>
          </ul>
        </section>

        <p className="text-center text-xs font-medium text-slate-500">Move your cursor to paint the trail ✨</p>
      </div>

      <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center text-center text-white/30">
        <h1 className="font-display text-6xl font-semibold tracking-tight">Borcelle Studio</h1>
        <p className="mt-2 text-xl">Move your cursor to demo the trail</p>
        <p className="mt-1 text-sm uppercase tracking-[0.5em]">Shortcuts active</p>
      </div>
    </div>
  )
}

export default App
