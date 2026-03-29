'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Search, Video, Eye, Heart, MessageCircle, Share2,
  Plus, Check, X, Download, ExternalLink, Loader2,
  TrendingUp, BarChart2, Zap, ChevronDown, Filter,
  PlayCircle, BookmarkPlus, Bookmark, AlertCircle,
  RefreshCw, Globe, Users
} from 'lucide-react'
import type { ScrapedVideo, ScraperResult } from '@/lib/scraper'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}
function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d === 0) return 'today'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}
const LS_KEY = 'videoscout_replicator_v1'

function loadReplicator(): ScrapedVideo[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function saveReplicator(items: ScrapedVideo[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(items))
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-[#111114] border border-[#1e1e24]">
      <div className="shimmer aspect-[9/16] w-full" />
      <div className="p-3 space-y-2">
        <div className="shimmer h-3 rounded w-3/4" />
        <div className="shimmer h-3 rounded w-1/2" />
        <div className="shimmer h-8 rounded-lg w-full mt-2" />
      </div>
    </div>
  )
}

// ─── Video Card ───────────────────────────────────────────────────────────────
function VideoCard({
  video, rank, inReplicator, onAdd, onRemove, style
}: {
  video: ScrapedVideo
  rank: number
  inReplicator: boolean
  onAdd: (v: ScrapedVideo) => void
  onRemove: (id: string) => void
  style?: React.CSSProperties
}) {
  const [imgErr, setImgErr] = useState(false)
  return (
    <div
      className="video-card-hover rounded-xl overflow-hidden bg-[#111114] border border-[#1e1e24] flex flex-col animate-fade-in"
      style={style}
    >
      <div className="relative aspect-[9/16] bg-[#0d0d10] overflow-hidden">
        {video.thumbnail && !imgErr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail} alt="" className="w-full h-full object-cover" onError={() => setImgErr(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PlayCircle className="w-10 h-10 text-[#2a2a32]" />
          </div>
        )}
        <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-bold text-white">#{rank}</div>
        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-semibold text-white flex items-center gap-1">
          <Eye className="w-3 h-3" />{fmt(video.views)}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-xs text-[#9090a0] line-clamp-2 leading-relaxed">{video.description || '(no caption)'}</p>
        <div className="flex items-center gap-3 text-[11px] text-[#606070]">
          <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{fmt(video.likes)}</span>
          <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{fmt(video.comments)}</span>
          <span className="flex items-center gap-1"><Share2 className="w-3 h-3" />{fmt(video.shares)}</span>
          <span className="ml-auto">{timeAgo(video.createdAt)}</span>
        </div>
        <div className="flex gap-2 mt-auto pt-1">
          <button
            onClick={() => inReplicator ? onRemove(video.id) : onAdd(video)}
            className={`replicator-btn flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-white ${inReplicator ? 'added' : ''}`}
          >
            {inReplicator
              ? <><Check className="w-3.5 h-3.5" /> In Replicator</>
              : <><Plus className="w-3.5 h-3.5" /> Add to Replicator</>}
          </button>
          <a href={video.url} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-[#1a1a20] hover:bg-[#222228] transition-colors" title="Open">
            <ExternalLink className="w-3.5 h-3.5 text-[#606070]" />
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function Stats({ result }: { result: ScraperResult }) {
  const totalViews = result.videos.reduce((s, v) => s + v.views, 0)
  const avg = result.videos.length ? Math.round(totalViews / result.videos.length) : 0
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: 'TOTAL VIDEOS', val: result.videos.length, Icon: Video },
        { label: 'TOTAL VIEWS', val: fmt(totalViews), Icon: Eye },
        { label: 'AVG VIEWS', val: fmt(avg), Icon: BarChart2 },
        { label: 'FOLLOWERS', val: result.creator.followers > 0 ? fmt(result.creator.followers) : '—', Icon: Users },
      ].map(({ label, val, Icon }) => (
        <div key={label} className="bg-[#111114] border border-[#1e1e24] rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Icon className="w-3.5 h-3.5 text-[#505060]" />
            <span className="text-[10px] font-semibold tracking-widest text-[#505060] uppercase">{label}</span>
          </div>
          <span className="text-2xl font-bold text-white">{val}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Replicator Panel ─────────────────────────────────────────────────────────
function ReplicatorPanel({ items, onRemove, onClose }: {
  items: ScrapedVideo[]
  onRemove: (id: string) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-[#0e0e11] border-l border-[#1e1e24] flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e24]">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-[#ff4d6d]" />
            <h2 className="font-semibold text-white">Replicator</h2>
            <span className="ml-1 bg-[#1e1e24] text-[#9090a0] text-xs px-2 py-0.5 rounded-full">{items.length}</span>
          </div>
          <button onClick={onClose} className="text-[#505060] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#404050]">
            <BookmarkPlus className="w-10 h-10" />
            <p className="text-sm">No videos saved yet</p>
            <p className="text-xs">Hit &ldquo;Add to Replicator&rdquo; on any video</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {items.map((v, i) => (
              <div key={v.id} className="flex gap-3 bg-[#111114] rounded-lg p-3 border border-[#1e1e24]">
                <div className="w-12 h-20 bg-[#0d0d10] rounded-md overflow-hidden flex-shrink-0">
                  {v.thumbnail && <img src={v.thumbnail} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-[#ff4d6d]">#{i + 1}</span>
                    <button onClick={() => onRemove(v.id)} className="text-[#404050] hover:text-[#ff4d6d] transition-colors flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-[#8080a0] line-clamp-2 mt-0.5">{v.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs font-semibold text-white flex items-center gap-1">
                      <Eye className="w-3 h-3 text-[#505060]" />{fmt(v.views)}
                    </span>
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#505060] hover:text-white underline">Open ↗</a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {items.length > 0 && (
          <div className="border-t border-[#1e1e24] p-4 space-y-2">
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' })
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
                a.download = 'replicator.json'; a.click()
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#1a1a20] hover:bg-[#222228] transition-colors text-sm text-[#9090a0] hover:text-white"
            >
              <Download className="w-4 h-4" /> Export JSON
            </button>
            <p className="text-[10px] text-[#404050] text-center">Saved in your browser — no account needed</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<ScraperResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replicator, setReplicator] = useState<ScrapedVideo[]>([])
  const [replicatorIds, setReplicatorIds] = useState<Set<string>>(new Set())
  const [showReplicator, setShowReplicator] = useState(false)
  const [sortBy, setSortBy] = useState<'views' | 'likes' | 'comments' | 'recent'>('views')
  const [filter, setFilter] = useState('')
  const [minViews, setMinViews] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const [hydrated, setHydrated] = useState(false)
  const [loginStatus, setLoginStatus] = useState<'unknown' | 'loggedIn' | 'loggedOut'>('unknown')
  const [loginLoading, setLoginLoading] = useState(false)
  const [showCookieModal, setShowCookieModal] = useState(false)
  const [cookiePaste, setCookiePaste] = useState('')
  const [cookieError, setCookieError] = useState('')

  useEffect(() => {
    const saved = loadReplicator()
    setReplicator(saved)
    setReplicatorIds(new Set(saved.map(v => v.id)))
    setHydrated(true)
    // Check TikTok session status on mount
    fetch('/api/tiktok-login')
      .then(r => r.json())
      .then(d => setLoginStatus(d.loggedIn ? 'loggedIn' : 'loggedOut'))
      .catch(() => setLoginStatus('loggedOut'))
  }, [])

  const handleTikTokLogin = useCallback(async (action: 'chrome' | 'manual' = 'chrome') => {
    setLoginLoading(true)
    try {
      const res = await fetch('/api/tiktok-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      const data = await res.json()
      if (!data.loggedIn && data.error === 'not_logged_in_chrome') {
        alert('TikTok nicht in Chrome eingeloggt. Bitte zuerst in Chrome auf tiktok.com einloggen, dann hier nochmal versuchen.')
      }
      setLoginStatus(data.loggedIn ? 'loggedIn' : 'loggedOut')
    } catch {
      setLoginStatus('loggedOut')
    } finally {
      setLoginLoading(false)
    }
  }, [])

  const handleTikTokLogout = useCallback(async () => {
    await fetch('/api/tiktok-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) })
    setLoginStatus('loggedOut')
  }, [])

  const handleCookieSave = useCallback(async () => {
    setCookieError('')
    try {
      const res = await fetch('/api/tiktok-login/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookieString: cookiePaste.trim() }),
      })
      const data = await res.json()
      if (!data.ok) { setCookieError(data.error || 'Fehler'); return }
      setLoginStatus('loggedIn')
      setShowCookieModal(false)
      setCookiePaste('')
    } catch { setCookieError('Netzwerkfehler') }
  }, [cookiePaste])

  const handleScrape = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: q }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scrape failed')
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally { setLoading(false) }
  }, [query])

  const handleAdd = useCallback((video: ScrapedVideo) => {
    setReplicator(prev => {
      if (prev.find(v => v.id === video.id)) return prev
      const next = [...prev, video]
      saveReplicator(next)
      return next
    })
    setReplicatorIds(prev => new Set([...Array.from(prev), video.id]))
  }, [])

  const handleRemove = useCallback((id: string) => {
    setReplicator(prev => {
      const next = prev.filter(v => v.id !== id)
      saveReplicator(next)
      return next
    })
    setReplicatorIds(prev => { const s = new Set(Array.from(prev)); s.delete(id); return s })
  }, [])

  const displayed = result ? [...result.videos]
    .filter(v => {
      if (filter && !v.description.toLowerCase().includes(filter.toLowerCase())) return false
      if (minViews && v.views < minViews) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'views') return b.views - a.views
      if (sortBy === 'likes') return b.likes - a.likes
      if (sortBy === 'comments') return b.comments - a.comments
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    : []

  return (
    <div className="min-h-screen bg-[#080809]">
      {/* Header */}
      <header className="border-b border-[#1a1a20] bg-[#080809]/90 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff4d6d] to-[#ff8500] flex items-center justify-center">
              <Video className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold hidden sm:inline">
              <span className="text-white">Video</span>
              <span className="bg-gradient-to-r from-[#ff4d6d] to-[#ff8500] bg-clip-text text-transparent"> Scout</span>
            </span>
          </div>

          <div className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#404050]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleScrape()}
                placeholder="TikTok or Instagram profile URL..."
                className="w-full bg-[#111114] border border-[#1e1e24] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#404050] focus:border-[#3a3a44] transition-colors"
              />
            </div>
            <button
              onClick={handleScrape}
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#ff4d6d] to-[#ff8500] text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</> : <><Zap className="w-4 h-4" /> Scout</>}
            </button>
          </div>

          {/* TikTok Login Status */}
          {loginStatus === 'loggedIn' ? (
            <button
              onClick={handleTikTokLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#111114] border border-[#2a3a2a] hover:border-[#ff4d6d]/40 transition-colors text-sm flex-shrink-0"
              title="TikTok session aktiv — klicken zum Ausloggen"
            >
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-green-400 text-xs hidden sm:inline">TikTok aktiv</span>
            </button>
          ) : loginLoading ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#111114] border border-[#1e1e24] text-sm text-[#9090a0] flex-shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs hidden sm:inline">Warte auf Login...</span>
            </div>
          ) : loginStatus === 'loggedOut' ? (
            <button
              onClick={() => setShowCookieModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#111114] border border-[#1e1e24] hover:border-[#3a3a44] transition-colors text-xs text-[#9090a0] hover:text-white flex-shrink-0"
            >
              <span className="w-2 h-2 rounded-full bg-[#404050]" />
              <span className="hidden sm:inline">TikTok Session</span>
            </button>
          ) : null}

          {hydrated && (
            <button
              onClick={() => setShowReplicator(true)}
              className="relative flex items-center gap-2 px-3 py-2 rounded-xl bg-[#111114] border border-[#1e1e24] hover:border-[#2e2e3a] transition-colors text-sm text-[#9090a0] hover:text-white flex-shrink-0"
            >
              <Bookmark className="w-4 h-4" />
              <span className="hidden sm:inline">Replicator</span>
              {replicator.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gradient-to-br from-[#ff4d6d] to-[#ff8500] rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                  {replicator.length}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-32 gap-5 text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#111114] border border-[#1e1e24] flex items-center justify-center">
              <Globe className="w-10 h-10 text-[#303040]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Scout any creator</h2>
              <p className="text-[#505060] text-sm max-w-md">
                Paste a TikTok or Instagram profile URL to see all their videos ranked by views.
                Add top performers to your Replicator for content inspiration.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {['https://www.tiktok.com/@charlidamelio', '@khaby.lame', '@mrbeast'].map(ex => (
                <button key={ex} onClick={() => { setQuery(ex); inputRef.current?.focus() }}
                  className="px-3 py-1.5 rounded-lg bg-[#111114] border border-[#1e1e24] text-xs text-[#606070] hover:text-white hover:border-[#2e2e3a] transition-colors">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[0,1,2,3].map(i => <div key={i} className="shimmer h-20 rounded-xl" />)}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} />)}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#1e0a0a] border border-[#3a1a1a] flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-[#ff4d6d]" />
            </div>
            <div>
              <h3 className="text-white font-semibold mb-1">Scrape failed</h3>
              <p className="text-[#606070] text-sm max-w-md">{error}</p>
            </div>
            <button onClick={handleScrape}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111114] border border-[#1e1e24] text-sm text-[#9090a0] hover:text-white transition-colors">
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-bold text-white">@{result.creator.username}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[#505060]">{result.videos.length} videos</span>
                  {result.mode === 'demo' && (
                    <button
                      onClick={loginStatus !== 'loggedIn' ? () => setShowCookieModal(true) : undefined}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1a0a] border border-[#3a300a] text-[#c8a020] font-medium hover:bg-[#2a2410] transition-colors cursor-pointer"
                      title="TikTok Login für echte Daten"
                    >
                      DEMO — {loginStatus !== 'loggedIn' ? 'Login für echte Daten →' : 'Scout erneut versuchen'}
                    </button>
                  )}
                  {(result as any).source === 'direct' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0a1e0a] border border-[#0a3a0a] text-[#20c820] font-medium">● Kostenlos</span>
                  )}
                  {(result as any).source === 'tikhub' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0a0a1e] border border-[#1a1a3a] text-[#6060e0] font-medium">● TikHub</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                    className="appearance-none bg-[#111114] border border-[#1e1e24] rounded-lg pl-3 pr-7 py-2 text-xs text-[#9090a0] cursor-pointer hover:border-[#2e2e3a] transition-colors">
                    <option value="views">Views</option>
                    <option value="likes">Likes</option>
                    <option value="comments">Comments</option>
                    <option value="recent">Recent</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#505060] pointer-events-none" />
                </div>
                <div className="relative">
                  <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#404050]" />
                  <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
                    placeholder="Filter captions..."
                    className="bg-[#111114] border border-[#1e1e24] rounded-lg pl-7 pr-3 py-2 text-xs text-white placeholder:text-[#404050] w-36 focus:border-[#3a3a44] transition-colors" />
                </div>
              </div>
            </div>

            <Stats result={result} />

            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-xs text-[#505060]">Min views:</span>
              {[0, 10_000, 100_000, 500_000, 1_000_000].map(v => (
                <button key={v} onClick={() => setMinViews(v)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${minViews === v
                    ? 'bg-[#1e1014] border-[#ff4d6d] text-[#ff4d6d]'
                    : 'bg-[#111114] border-[#1e1e24] text-[#606070] hover:text-white hover:border-[#2e2e3a]'}`}>
                  {v === 0 ? 'All' : fmt(v) + '+'}
                </button>
              ))}
              <span className="text-xs text-[#404050] ml-auto">
                {displayed.length} of {result.videos.length} shown
              </span>
            </div>

            {displayed.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {displayed.map((v, i) => (
                  <VideoCard key={v.id} video={v} rank={i + 1}
                    inReplicator={replicatorIds.has(v.id)}
                    onAdd={handleAdd} onRemove={handleRemove}
                    style={{ animationDelay: `${Math.min(i * 25, 400)}ms`, opacity: 0 }} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#404050]">
                <Filter className="w-8 h-8" />
                <p className="text-sm">No videos match your filters</p>
                <button onClick={() => { setFilter(''); setMinViews(0) }} className="text-xs text-[#606070] hover:text-white underline">Clear filters</button>
              </div>
            )}
          </div>
        )}
      </main>

      {showReplicator && (
        <ReplicatorPanel items={replicator} onRemove={handleRemove} onClose={() => setShowReplicator(false)} />
      )}

      {/* Cookie Import Modal */}
      {showCookieModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111114] border border-[#1e1e24] rounded-2xl w-full max-w-lg p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-white font-semibold text-lg">TikTok Session importieren</h2>
                <p className="text-[#606070] text-sm mt-1">Kopiere deine Cookies aus dem Browser — einmalig nötig</p>
              </div>
              <button onClick={() => setShowCookieModal(false)} className="text-[#404050] hover:text-white mt-0.5"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-[#0a0a0c] border border-[#1e1e24] rounded-xl p-4 space-y-3">
              <p className="text-xs text-[#9090a0] font-medium uppercase tracking-wide">Schritt für Schritt</p>
              <ol className="space-y-2.5 text-sm text-[#8080a0]">
                <li className="flex gap-2 items-start">
                  <span className="text-[#ff4d6d] font-bold flex-shrink-0">1.</span>
                  <span>Installiere die Extension <a href="https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalyna" target="_blank" rel="noopener noreferrer" className="text-white underline">Cookie-Editor</a> für Chrome <span className="text-[#505060]">(oder Firefox)</span></span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="text-[#ff4d6d] font-bold flex-shrink-0">2.</span>
                  <span>Öffne <a href="https://www.tiktok.com" target="_blank" rel="noopener noreferrer" className="text-white underline">tiktok.com</a> — stelle sicher dass du eingeloggt bist</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="text-[#ff4d6d] font-bold flex-shrink-0">3.</span>
                  <span>Klicke auf das Cookie-Editor Icon oben rechts im Browser</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="text-[#ff4d6d] font-bold flex-shrink-0">4.</span>
                  <span>Klicke unten auf <span className="text-white font-semibold">Export → Export as JSON</span> — kopiert automatisch</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="text-[#ff4d6d] font-bold flex-shrink-0">5.</span>
                  <span>Füge das JSON unten ein</span>
                </li>
              </ol>
              <p className="text-[10px] text-[#505060]">Benötigt wird der <code className="text-[#8080a0]">sessionid</code> Cookie — dieser ist nur über Extensions zugänglich, nicht über die Browser-Konsole.</p>
            </div>

            <div className="space-y-2">
              <textarea
                value={cookiePaste}
                onChange={e => { setCookiePaste(e.target.value); setCookieError('') }}
                placeholder="sessionid=abc123; ttwid=xyz..."
                rows={3}
                className="w-full bg-[#0a0a0c] border border-[#1e1e24] focus:border-[#3a3a44] rounded-xl p-3 text-xs text-white font-mono placeholder:text-[#303040] resize-none outline-none"
              />
              {cookieError && <p className="text-xs text-[#ff4d6d]">{cookieError}</p>}
            </div>

            <button
              onClick={handleCookieSave}
              disabled={!cookiePaste.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff4d6d] to-[#ff8500] text-white font-semibold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              Session speichern
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
