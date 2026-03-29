import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Upload, Zap, Heart, MapPin, DollarSign, Clock,
    Smile, Lightbulb, Shield, AlertTriangle, CheckCircle,
    RefreshCw, ChevronRight, Star, Activity, Camera,
    Volume2, VolumeX, FileDown, Navigation, X, History
} from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const HISTORY_KEY = 'tomfinder_history'
const MAX_HISTORY = 10

// ── Helpers ──────────────────────────────────────────────────────────────────

function HealthBadge({ label }) {
    const isHealthy = label.toLowerCase().includes('healthy')
    const isWarning = label.toLowerCase().includes('possible') || label.toLowerCase().includes('signs')
    const color = isHealthy ? 'var(--green)' : isWarning ? 'var(--yellow)' : 'var(--red)'
    const bg = isHealthy ? 'var(--greenl)' : isWarning ? 'var(--yellowl)' : 'var(--redl)'
    const Icon = isHealthy ? CheckCircle : AlertTriangle
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: bg, color, border: `1px solid ${color}40`,
            borderRadius: 999, padding: '4px 12px', fontSize: 13,
            fontFamily: 'var(--font-body)', fontWeight: 500,
        }}>
            <Icon size={13} /> {label}
        </span>
    )
}

function EmotionBadge({ emotion, emoji, confidence }) {
    return (
        <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.3 }}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'var(--purplel)', border: '1px solid rgba(167,139,250,0.3)',
                borderRadius: 999, padding: '6px 16px', fontSize: 14,
                fontFamily: 'var(--font-body)', fontWeight: 600,
                color: 'var(--purple)',
            }}
        >
            <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                style={{ fontSize: 20 }}
            >
                {emoji}
            </motion.span>
            {emotion}
            <span style={{ fontSize: 11, opacity: 0.7 }}>{confidence}%</span>
        </motion.div>
    )
}

function InfoCard({ icon: Icon, label, value, color = 'var(--accent)', id, readingId }) {
    return (
        <motion.div
            id={id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={readingId === id ? 'reading-highlight' : ''}
            style={{
                background: 'var(--card2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '18px 20px',
                display: 'flex', gap: 14, alignItems: 'flex-start',
                transition: 'background 0.3s ease, border-left 0.3s ease',
            }}
        >
            <span style={{
                width: 36, height: 36, borderRadius: 10,
                background: `${color}20`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0, color,
            }}>
                <Icon size={18} />
            </span>
            <div>
                <div style={{
                    fontSize: 11, color: 'var(--text3)', fontWeight: 500,
                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3
                }}>
                    {label}
                </div>
                <div style={{ fontSize: 15, color: 'var(--text)', fontWeight: 400, lineHeight: 1.5 }}>
                    {value || '—'}
                </div>
            </div>
        </motion.div>
    )
}

function ConfidenceBar({ value }) {
    const color = value > 85 ? 'var(--green)' : value > 65 ? 'var(--yellow)' : 'var(--red)'
    return (
        <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Confidence</span>
                <span style={{ fontSize: 12, color, fontWeight: 600 }}>{value}%</span>
            </div>
            <div style={{ height: 5, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    style={{ height: '100%', background: color, borderRadius: 999 }}
                />
            </div>
        </div>
    )
}

// ── Dropzone ─────────────────────────────────────────────────────────────────

function Dropzone({ onFile }) {
    const onDrop = useCallback(accepted => { if (accepted[0]) onFile(accepted[0]) }, [onFile])
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop, accept: { 'image/*': [] }, multiple: false,
    })
    const [pasteFlash, setPasteFlash] = useState(false)
    const dropzoneRef = useRef(null)

    // ── Clipboard paste support ─────────────────────────────────────────────
    useEffect(() => {
        const handlePaste = (e) => {
            const items = e.clipboardData?.items
            if (!items) return
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault()
                    const blob = item.getAsFile()
                    if (blob) {
                        const file = new File([blob], `pasted_image.${blob.type.split('/')[1] || 'png'}`, { type: blob.type })
                        setPasteFlash(true)
                        setTimeout(() => setPasteFlash(false), 600)
                        onFile(file)
                    }
                    return
                }
            }
        }
        document.addEventListener('paste', handlePaste)
        return () => document.removeEventListener('paste', handlePaste)
    }, [onFile])

    return (
        <motion.div
            ref={dropzoneRef}
            {...getRootProps()}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            style={{
                border: `2px dashed ${pasteFlash ? 'var(--green)' : isDragActive ? 'var(--accent)' : 'var(--border2)'}`,
                borderRadius: 'var(--radius)',
                background: pasteFlash ? 'var(--greenl)' : isDragActive ? 'var(--accentl)' : 'var(--card)',
                padding: '56px 32px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <input {...getInputProps()} />
            <div style={{
                position: 'absolute', width: 200, height: 200, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(232,108,58,0.12) 0%, transparent 70%)',
                top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                pointerEvents: 'none',
            }} />
            <motion.div
                animate={{ y: isDragActive ? -6 : 0 }}
                transition={{ duration: 0.2 }}
                style={{
                    width: 64, height: 64, borderRadius: 18,
                    background: 'var(--accentl)', border: '1px solid rgba(232,108,58,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px', color: 'var(--accent)',
                }}
            >
                <Upload size={28} />
            </motion.div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                {pasteFlash ? '✅ Image pasted!' : isDragActive ? 'Drop it here' : 'Drop your pet photo'}
            </div>
            <div style={{ color: 'var(--text2)', fontSize: 14 }}>
                or <span style={{ color: 'var(--accent)', fontWeight: 500 }}>browse files</span> — JPG, PNG, WEBP
            </div>
            <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 10, opacity: 0.7 }}>
                💡 You can also paste an image from clipboard (Ctrl+V / ⌘V)
            </div>
        </motion.div>
    )
}

// ── Loading animation ─────────────────────────────────────────────────────────

function Loader() {
    const steps = ['Detecting species…', 'Identifying breed…', 'Assessing health…', 'Reading emotions…', 'Consulting AI expert…']
    const [step, setStep] = useState(0)
    useEffect(() => {
        const id = setInterval(() => setStep(s => (s + 1) % steps.length), 1200)
        return () => clearInterval(id)
    }, [])
    return (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 28px' }}>
                {[0, 1, 2].map(i => (
                    <motion.div key={i}
                        animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.8, delay: i * 0.6, repeat: Infinity }}
                        style={{
                            position: 'absolute', inset: 0, borderRadius: '50%',
                            border: '2px solid var(--accent)',
                        }}
                    />
                ))}
                <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'var(--accentl)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
                }}>
                    <Zap size={28} />
                </div>
            </div>
            <AnimatePresence mode="wait">
                <motion.div key={step}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}
                    style={{ fontFamily: 'var(--font-head)', fontSize: 18, color: 'var(--text2)' }}
                >
                    {steps[step]}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}

// ── Webcam Component ──────────────────────────────────────────────────────────

function WebcamCapture({ onCapture, onClose }) {
    const videoRef = useRef(null)
    const [stream, setStream] = useState(null)
    const [frozen, setFrozen] = useState(false)

    useEffect(() => {
        let mediaStream
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(s => {
                mediaStream = s
                setStream(s)
                if (videoRef.current) videoRef.current.srcObject = s
            })
            .catch(err => console.error('Webcam error:', err))

        return () => {
            if (mediaStream) mediaStream.getTracks().forEach(t => t.stop())
        }
    }, [])

    const capture = () => {
        if (!videoRef.current) return
        const canvas = document.createElement('canvas')
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0)
        setFrozen(true)

        canvas.toBlob(blob => {
            if (blob) {
                const file = new File([blob], 'webcam_capture.jpg', { type: 'image/jpeg' })
                onCapture(file)
            }
        }, 'image/jpeg', 0.9)
    }

    return (
        <div className="webcam-container">
            <video ref={videoRef} autoPlay playsInline muted
                style={{ opacity: frozen ? 0.5 : 1, transition: 'opacity 0.3s' }} />
            <div className="webcam-overlay">
                <motion.button
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={capture}
                    style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: 'var(--accent)', border: '3px solid #fff',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: '#fff',
                        boxShadow: '0 4px 20px rgba(232,108,58,0.4)',
                    }}
                >
                    <Camera size={24} />
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => {
                        if (stream) stream.getTracks().forEach(t => t.stop())
                        onClose()
                    }}
                    style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.6)', border: '1px solid var(--border2)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: 'var(--text2)',
                    }}
                >
                    <X size={18} />
                </motion.button>
            </div>
        </div>
    )
}

// ── Voice Readout ─────────────────────────────────────────────────────────────

function VoiceReadout({ data }) {
    const [reading, setReading] = useState(false)
    const [currentSection, setCurrentSection] = useState(null)
    const synthRef = useRef(window.speechSynthesis)

    const sections = [
        { id: 'info-breed', text: `This is a ${data.vision.animal_type}, breed: ${data.vision.breed}, with ${data.vision.confidence}% confidence.` },
        { id: 'info-health', text: `Health assessment: ${data.vision.health_conditions.join(', ')}.` },
        { id: 'info-emotion', text: `Detected emotion: ${data.vision.emotion}.` },
        { id: 'info-origin', text: `Origin: ${data.info.origin}.` },
        { id: 'info-lifespan', text: `Lifespan: ${data.info.lifespan}.` },
        { id: 'info-care', text: `Care tips: ${data.info.care_tips}.` },
        { id: 'info-funfact', text: `Fun fact: ${data.info.fun_fact}.` },
    ]

    const startReading = () => {
        if (reading) {
            synthRef.current.cancel()
            setReading(false)
            setCurrentSection(null)
            return
        }

        setReading(true)
        let idx = 0

        const readNext = () => {
            if (idx >= sections.length) {
                setReading(false)
                setCurrentSection(null)
                return
            }
            const section = sections[idx]
            setCurrentSection(section.id)
            const utter = new SpeechSynthesisUtterance(section.text)
            utter.rate = 0.95
            utter.pitch = 1.05
            utter.onend = () => { idx++; readNext() }
            utter.onerror = () => { setReading(false); setCurrentSection(null) }
            synthRef.current.speak(utter)
        }
        readNext()
    }

    useEffect(() => {
        return () => synthRef.current.cancel()
    }, [])

    return {
        readingId: currentSection,
        ReadButton: () => (
            <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={startReading}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px', borderRadius: 'var(--radius)',
                    background: reading ? 'var(--redl)' : 'var(--bluel)',
                    border: `1px solid ${reading ? 'var(--red)' : 'var(--blue)'}40`,
                    color: reading ? 'var(--red)' : 'var(--blue)',
                    fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.2s',
                }}
            >
                {reading ? <VolumeX size={16} /> : <Volume2 size={16} />}
                {reading ? 'Stop Reading' : 'Read Aloud'}
            </motion.button>
        ),
    }
}

// ── PDF Export ─────────────────────────────────────────────────────────────────

async function exportPDF(data) {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF('p', 'mm', 'a4')
    const w = doc.internal.pageSize.getWidth()
    let y = 20

    // Header
    doc.setFillColor(13, 15, 19)
    doc.rect(0, 0, w, 45, 'F')
    doc.setTextColor(232, 108, 58)
    doc.setFontSize(28)
    doc.setFont('helvetica', 'bold')
    doc.text('Tom Finder', w / 2, 20, { align: 'center' })
    doc.setFontSize(11)
    doc.setTextColor(156, 163, 175)
    doc.text('Finding Breed Using Hybrid ML Model', w / 2, 28, { align: 'center' })
    doc.setFontSize(9)
    doc.text(new Date().toLocaleString(), w / 2, 35, { align: 'center' })

    y = 55

    // Pet image
    if (data.preview) {
        try {
            doc.addImage(data.preview, 'JPEG', 20, y, 60, 60)
        } catch (e) { /* skip if image fails */ }
    }

    // Breed info
    const infoX = 90
    doc.setTextColor(240, 240, 245)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(data.vision.breed, infoX, y + 10)
    doc.setFontSize(12)
    doc.setTextColor(156, 163, 175)
    doc.text(`${data.vision.animal_type} • ${data.vision.confidence}% confidence`, infoX, y + 20)
    doc.text(`Emotion: ${data.vision.emotion} ${data.vision.emotion_emoji || ''}`, infoX, y + 28)
    doc.setFontSize(10)
    doc.text(`Health: ${data.vision.health_conditions.join(', ')}`, infoX, y + 38)

    y = 130

    // Info sections
    const infoSections = [
        ['Origin & Habitat', data.info.origin],
        ['Price Range', data.info.price_range],
        ['Lifespan', data.info.lifespan],
        ['Temperament', data.info.temperament],
        ['Care Tips', data.info.care_tips],
        ['Health Advice', data.info.health_advice],
        ['Fun Fact', data.info.fun_fact],
    ]

    for (const [title, content] of infoSections) {
        if (y > 270) { doc.addPage(); y = 20 }
        doc.setFontSize(10)
        doc.setTextColor(232, 108, 58)
        doc.setFont('helvetica', 'bold')
        doc.text(title.toUpperCase(), 20, y)
        y += 6
        doc.setTextColor(200, 200, 210)
        doc.setFont('helvetica', 'normal')
        const lines = doc.splitTextToSize(content || 'N/A', w - 40)
        doc.text(lines, 20, y)
        y += lines.length * 5 + 8
    }

    // Footer
    doc.setFontSize(8)
    doc.setTextColor(107, 114, 128)
    doc.text('Generated by Tom Finder — Finding Breed Using Hybrid ML Model', w / 2, 290, { align: 'center' })

    doc.save(`TomFinder_${data.vision.breed.replace(/\s+/g, '_')}_Report.pdf`)
}

// ── Vet Finder ────────────────────────────────────────────────────────────────

function VetFinder() {
    const [vets, setVets] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [found, setFound] = useState(false)

    const findVets = async () => {
        setLoading(true)
        setError(null)

        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
            })
            const { latitude, longitude } = pos.coords

            // Use OpenStreetMap Nominatim (free, no API key needed)
            const res = await axios.get(
                `https://nominatim.openstreetmap.org/search?q=veterinary+clinic&format=json&limit=3&lat=${latitude}&lon=${longitude}&bounded=1&viewbox=${longitude - 0.1},${latitude + 0.1},${longitude + 0.1},${latitude - 0.1}`,
                { headers: { 'User-Agent': 'TomFinder/2.0' } }
            )

            if (res.data.length === 0) {
                // Fallback: broader search
                const res2 = await axios.get(
                    `https://nominatim.openstreetmap.org/search?q=veterinary&format=json&limit=3&lat=${latitude}&lon=${longitude}`,
                    { headers: { 'User-Agent': 'PawSense/2.0' } }
                )
                setVets(res2.data.map(v => ({
                    name: v.display_name.split(',')[0],
                    address: v.display_name.split(',').slice(1, 3).join(','),
                    lat: v.lat, lon: v.lon,
                    distance: calcDistance(latitude, longitude, parseFloat(v.lat), parseFloat(v.lon)),
                })))
            } else {
                setVets(res.data.map(v => ({
                    name: v.display_name.split(',')[0],
                    address: v.display_name.split(',').slice(1, 3).join(','),
                    lat: v.lat, lon: v.lon,
                    distance: calcDistance(latitude, longitude, parseFloat(v.lat), parseFloat(v.lon)),
                })))
            }
            setFound(true)
        } catch (e) {
            setError('Could not access location. Please enable location services.')
        }
        setLoading(false)
    }

    const calcDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371
        const dLat = (lat2 - lat1) * Math.PI / 180
        const dLon = (lon2 - lon1) * Math.PI / 180
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
        return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1)
    }

    if (!found) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ marginTop: 14 }}
            >
                <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={findVets}
                    disabled={loading}
                    style={{
                        width: '100%', padding: '14px', borderRadius: 'var(--radius)',
                        background: 'var(--bluel)', border: '1px solid rgba(96,165,250,0.3)',
                        color: 'var(--blue)', fontFamily: 'var(--font-head)', fontSize: 15,
                        fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                >
                    <MapPin size={16} />
                    {loading ? 'Finding nearby vets…' : '🏥 Find a Vet Near You'}
                </motion.button>
                {error && (
                    <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error}</div>
                )}
            </motion.div>
        )
    }

    return (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: 14 }}
        >
            <div style={{
                fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase',
                letterSpacing: '0.1em', fontWeight: 500, marginBottom: 12,
            }}>🏥 Nearby Veterinary Clinics</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {vets.length === 0 ? (
                    <div style={{ color: 'var(--text2)', fontSize: 14 }}>No veterinary clinics found nearby.</div>
                ) : vets.map((vet, i) => (
                    <div key={i} className="vet-card">
                        <div style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                            {vet.name}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>{vet.address}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: 'var(--blue)' }}>📍 {vet.distance} km away</span>
                            <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${vet.lat},${vet.lon}`}
                                target="_blank" rel="noopener noreferrer"
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '6px 14px', borderRadius: 999,
                                    background: 'var(--bluel)', border: '1px solid rgba(96,165,250,0.25)',
                                    color: 'var(--blue)', fontSize: 12, fontWeight: 600,
                                    textDecoration: 'none', transition: 'all 0.2s',
                                }}
                            >
                                <Navigation size={12} /> Get Directions
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    )
}

// ── History Strip ─────────────────────────────────────────────────────────────

function HistoryStrip({ onRestore }) {
    const [history, setHistory] = useState([])

    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
            setHistory(saved)
        } catch { setHistory([]) }
    }, [])

    if (history.length === 0) return null

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: 20 }}
        >
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
            }}>
                <History size={14} style={{ color: 'var(--text3)' }} />
                <span style={{
                    fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase',
                    letterSpacing: '0.1em', fontWeight: 500
                }}>
                    Recent Analyses
                </span>
            </div>
            <div className="history-strip">
                {history.map((item, i) => (
                    <motion.div
                        key={i}
                        className="history-thumb"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onRestore(item)}
                        title={`${item.vision?.breed || 'Pet'} — click to restore`}
                    >
                        <img src={item.preview} alt={item.vision?.breed || 'pet'} />
                        <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                            padding: '2px 4px', fontSize: 8, color: '#fff',
                            fontWeight: 600, textAlign: 'center',
                        }}>
                            {item.vision?.breed?.split(' ').slice(0, 2).join(' ') || '?'}
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    )
}

// ── Multi-Pet Cards ──────────────────────────────────────────────────────────

function MultiPetCards({ pets }) {
    if (!pets || pets.length <= 1) return null

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ marginTop: 24 }}
        >
            <div style={{
                fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase',
                letterSpacing: '0.1em', fontWeight: 500, marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 8,
            }}>
                🐾 {pets.length} Pets Detected
            </div>
            <div className="multi-pet-grid">
                {pets.map((pet, i) => (
                    <motion.div
                        key={i}
                        className="pet-card"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        <div className="pet-number">{i + 1}</div>
                        {pet.crop_preview && (
                            <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 14, marginTop: 8 }}>
                                <img src={pet.crop_preview} alt={`Pet ${i + 1}`}
                                    style={{ width: '100%', height: 160, objectFit: 'cover' }} />
                            </div>
                        )}
                        <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
                            {pet.breed}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                            <span style={{
                                fontSize: 12, padding: '3px 10px', borderRadius: 999,
                                background: pet.animal_type === 'Dog' ? 'var(--bluel)' : 'var(--accentl)',
                                color: pet.animal_type === 'Dog' ? 'var(--blue)' : 'var(--accent)',
                                fontWeight: 600,
                            }}>
                                {pet.animal_type === 'Dog' ? '🐶' : '🐱'} {pet.animal_type}
                            </span>
                            {pet.emotion && (
                                <span style={{
                                    fontSize: 12, padding: '3px 10px', borderRadius: 999,
                                    background: 'var(--purplel)', color: 'var(--purple)', fontWeight: 600,
                                }}>
                                    {pet.emotion_emoji} {pet.emotion}
                                </span>
                            )}
                        </div>
                        <ConfidenceBar value={pet.confidence} />
                    </motion.div>
                ))}
            </div>
        </motion.div>
    )
}

// ── Results panel ─────────────────────────────────────────────────────────────

function Results({ data, onReset }) {
    const { vision, info, preview, multi_pets } = data
    const isdog = vision.animal_type === 'Dog'
    const accentColor = isdog ? 'var(--blue)' : 'var(--accent)'

    const voice = VoiceReadout({ data })
    const readingId = voice.readingId

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            {/* Action bar */}
            <div style={{
                display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap',
            }}>
                <motion.button
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={onReset}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px', borderRadius: 'var(--radius)',
                        background: 'var(--accentl)', border: '1px solid rgba(232,108,58,0.3)',
                        color: 'var(--accent)', fontFamily: 'var(--font-body)', fontSize: 14,
                        fontWeight: 600, cursor: 'pointer',
                    }}
                >
                    <Upload size={16} /> New Image
                </motion.button>
                <voice.ReadButton />
                <motion.button
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={() => exportPDF(data)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 20px', borderRadius: 'var(--radius)',
                        background: 'var(--greenl)', border: '1px solid rgba(52,211,153,0.3)',
                        color: 'var(--green)', fontFamily: 'var(--font-body)', fontSize: 14,
                        fontWeight: 600, cursor: 'pointer',
                    }}
                >
                    <FileDown size={16} /> Export PDF
                </motion.button>
            </div>

            {/* Hero row */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24,
            }}>
                {/* Preview image */}
                <div style={{
                    borderRadius: 'var(--radius)', overflow: 'hidden', position: 'relative',
                    aspectRatio: '1', background: 'var(--card)',
                }}>
                    <img src={preview} alt="pet"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                        padding: '32px 16px 16px',
                        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
                    }}>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: accentColor, borderRadius: 999,
                            padding: '4px 14px', fontSize: 13, fontWeight: 700,
                            fontFamily: 'var(--font-head)', color: '#fff',
                        }}>
                            {isdog ? '🐶' : '🐱'} {vision.animal_type}
                        </div>
                        {vision.emotion && (
                            <EmotionBadge
                                emotion={vision.emotion}
                                emoji={vision.emotion_emoji || '😊'}
                                confidence={vision.emotion_confidence || 75}
                            />
                        )}
                    </div>
                </div>

                {/* Breed card */}
                <div id="info-breed" style={{
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: 24, display: 'flex',
                    flexDirection: 'column', justifyContent: 'space-between',
                    ...(readingId === 'info-breed' ? { borderLeftColor: 'var(--accent)', borderLeftWidth: 3 } : {}),
                }}>
                    <div>
                        <div style={{
                            fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase',
                            letterSpacing: '0.1em', fontWeight: 500, marginBottom: 8,
                        }}>Detected breed</div>
                        <div style={{
                            fontFamily: 'var(--font-head)', fontSize: 28, fontWeight: 800,
                            lineHeight: 1.1, marginBottom: 12, color: 'var(--text)',
                        }}>
                            {vision.breed}
                        </div>
                        <ConfidenceBar value={vision.confidence} />
                    </div>

                </div>
            </div>

            {/* Info grid */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 24,
            }}>
                <InfoCard id="info-origin" icon={MapPin} label="Origin & Habitat" value={info.origin} color="var(--blue)" readingId={readingId} />
                <InfoCard icon={DollarSign} label="Price Range" value={info.price_range} color="var(--green)" readingId={readingId} />
                <InfoCard id="info-lifespan" icon={Clock} label="Lifespan" value={info.lifespan} color="var(--accent)" readingId={readingId} />
                <InfoCard icon={Smile} label="Temperament" value={info.temperament} color="var(--yellow)" readingId={readingId} />
            </div>

            {/* Full-width cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
                <InfoCard id="info-care" icon={Heart} label="Care Tips" value={info.care_tips} color="var(--red)" readingId={readingId} />
                <InfoCard icon={Activity} label="Health Advice" value={info.health_advice} color="var(--yellow)" readingId={readingId} />
                <InfoCard id="info-funfact" icon={Lightbulb} label="Fun Fact" value={info.fun_fact} color="var(--accent)" readingId={readingId} />
            </div>

            {/* Multi-pet cards */}
            <MultiPetCards pets={multi_pets} />

            {/* Vet finder */}
            <VetFinder />

            {/* Reset */}
            <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={onReset}
                style={{
                    width: '100%', padding: '14px', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border2)', background: 'var(--card)',
                    color: 'var(--text2)', fontFamily: 'var(--font-head)', fontSize: 15,
                    fontWeight: 600, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s', marginTop: 20,
                }}
            >
                <RefreshCw size={16} /> Analyze another pet
            </motion.button>
        </motion.div>
    )
}

// ── App shell ─────────────────────────────────────────────────────────────────

export default function App() {
    const [file, setFile] = useState(null)
    const [preview, setPreview] = useState(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)
    const [webcamMode, setWebcamMode] = useState(false)

    const handleFile = useCallback(f => {
        setFile(f)
        setPreview(URL.createObjectURL(f))
        setResult(null)
        setError(null)
        setWebcamMode(false)
    }, [])

    const saveToHistory = (data) => {
        try {
            const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
            const entry = { ...data, timestamp: Date.now() }
            const updated = [entry, ...history.filter((_, i) => i < MAX_HISTORY - 1)]
            localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
        } catch { /* localStorage might be full */ }
    }

    const restoreFromHistory = (item) => {
        setResult(item)
        setPreview(item.preview)
        setFile(null)
        setError(null)
        setWebcamMode(false)
    }

    const analyze = async () => {
        if (!file) return
        setLoading(true); setError(null)
        const form = new FormData()
        form.append('file', file)
        try {
            const { data } = await axios.post(`${API}/analyze`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 120000,
            })
            setResult(data)
            saveToHistory(data)
        } catch (e) {
            setError(e?.response?.data?.detail || 'Could not reach the API. Is the backend running?')
        } finally {
            setLoading(false)
        }
    }

    const reset = () => {
        setFile(null); setPreview(null); setResult(null); setError(null); setWebcamMode(false)
    }

    return (
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
            {/* Background gradient blobs */}
            <div style={{
                position: 'fixed', top: -200, right: -200, width: 600, height: 600,
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,108,58,0.06) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />
            <div style={{
                position: 'fixed', bottom: -200, left: -200, width: 500, height: 500,
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.05) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />
            <div style={{
                position: 'fixed', top: '40%', left: '60%', width: 400, height: 400,
                borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,0.04) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <div style={{ maxWidth: 780, margin: '0 auto', padding: '40px 24px 80px' }}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                    style={{ textAlign: 'center', marginBottom: 48 }}
                >
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: 'var(--accentl)', border: '1px solid rgba(232,108,58,0.25)',
                        borderRadius: 999, padding: '6px 16px', fontSize: 12, fontWeight: 600,
                        color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase',
                        marginBottom: 20,
                    }}>
                        <Zap size={12} /> Finding Breed Using Hybrid ML Model
                    </div>
                    <h1 style={{
                        fontFamily: 'var(--font-head)', fontSize: 'clamp(36px, 6vw, 60px)',
                        fontWeight: 800, lineHeight: 1.05, marginBottom: 16,
                    }}>
                        <span style={{ color: 'var(--accent)' }}>Tom</span> Finder
                    </h1>
                    <p style={{ color: 'var(--text2)', fontSize: 16, maxWidth: 520, margin: '0 auto' }}>
                        Machine learning laboratory project by M Sri Sai Ritesh
                    </p>
                </motion.div>

                {/* Main card */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    style={{
                        background: 'var(--bg2)', border: '1px solid var(--border)',
                        borderRadius: 20, padding: 28, boxShadow: 'var(--shadow)',
                    }}
                >
                    <AnimatePresence mode="wait">
                        {loading ? (
                            <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <Loader />
                            </motion.div>
                        ) : result ? (
                            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <Results data={result} onReset={reset} />
                            </motion.div>
                        ) : webcamMode ? (
                            <motion.div key="webcam" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                <WebcamCapture onCapture={handleFile} onClose={() => setWebcamMode(false)} />
                            </motion.div>
                        ) : (
                            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                {!file ? (
                                    <>
                                        <Dropzone onFile={handleFile} />
                                        {/* Webcam toggle */}
                                        <div style={{ textAlign: 'center', marginTop: 16 }}>
                                            <motion.button
                                                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                                onClick={() => setWebcamMode(true)}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                                    padding: '10px 24px', borderRadius: 999,
                                                    background: 'var(--card)', border: '1px solid var(--border2)',
                                                    color: 'var(--text2)', fontSize: 14, fontWeight: 500,
                                                    cursor: 'pointer', fontFamily: 'var(--font-body)',
                                                    transition: 'all 0.2s',
                                                }}
                                            >
                                                <Camera size={16} /> Use Camera
                                            </motion.button>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        {/* Preview */}
                                        <div style={{
                                            borderRadius: 'var(--radius)', overflow: 'hidden',
                                            marginBottom: 20, position: 'relative', maxHeight: 360,
                                        }}>
                                            <img src={preview} alt="preview"
                                                style={{ width: '100%', objectFit: 'cover', display: 'block', maxHeight: 360 }} />
                                            <button onClick={reset} style={{
                                                position: 'absolute', top: 12, right: 12,
                                                background: 'rgba(0,0,0,0.6)', border: '1px solid var(--border2)',
                                                borderRadius: 8, padding: '6px 12px', color: 'var(--text2)',
                                                fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
                                            }}>
                                                Change
                                            </button>
                                        </div>

                                        {error && (
                                            <div style={{
                                                background: 'var(--redl)', border: '1px solid var(--red)',
                                                borderRadius: 'var(--radius-sm)', padding: '12px 16px',
                                                color: 'var(--red)', fontSize: 14, marginBottom: 16,
                                                display: 'flex', alignItems: 'center', gap: 8,
                                            }}>
                                                <AlertTriangle size={16} /> {error}
                                            </div>
                                        )}

                                        <motion.button
                                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                            onClick={analyze}
                                            style={{
                                                width: '100%', padding: '15px', borderRadius: 'var(--radius)',
                                                background: 'var(--accent)', border: 'none',
                                                color: '#fff', fontFamily: 'var(--font-head)', fontSize: 17,
                                                fontWeight: 700, cursor: 'pointer',
                                                display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', gap: 8,
                                                boxShadow: '0 4px 24px rgba(232,108,58,0.35)',
                                            }}
                                        >
                                            <Zap size={18} /> Analyze with AI <ChevronRight size={18} />
                                        </motion.button>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* History strip */}
                {!result && !loading && (
                    <HistoryStrip onRestore={restoreFromHistory} />
                )}

                {/* Feature pills */}
                {!result && !loading && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                        style={{
                            display: 'flex', flexWrap: 'wrap', gap: 10,
                            justifyContent: 'center', marginTop: 28,
                        }}
                    >
                        {[
                            ['🐾', 'Cat & Dog detection'],
                            ['🔬', '120+ breeds'],
                            ['🏥', 'Health assessment'],
                            ['😊', 'Emotion detection'],
                            ['🤖', 'LLM insights'],
                            ['📸', 'Webcam mode'],
                            ['🗣️', 'Voice readout'],
                            ['📄', 'PDF export'],
                            ['🏥', 'Vet finder'],
                        ].map(([icon, label]) => (
                            <span key={label} style={{
                                background: 'var(--card)', border: '1px solid var(--border)',
                                borderRadius: 999, padding: '7px 16px', fontSize: 13,
                                color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                                {icon} {label}
                            </span>
                        ))}
                    </motion.div>
                )}
            </div>
        </div>
    )
}
