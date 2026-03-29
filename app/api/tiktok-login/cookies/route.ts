import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const SESSION_FILE = path.join(process.cwd(), '.tiktok-session.json')

export async function POST(req: NextRequest) {
  const { cookieString } = await req.json()
  if (!cookieString || typeof cookieString !== 'string') {
    return NextResponse.json({ ok: false, error: 'No cookie string provided' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cookies: any[] = []

  const trimmed = cookieString.trim()

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    // JSON format from Cookie-Editor extension
    try {
      const parsed = JSON.parse(trimmed)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      cookies = arr.map((c: Record<string, unknown>) => ({
        name: String(c.name ?? ''),
        value: String(c.value ?? ''),
        domain: String(c.domain ?? '.tiktok.com'),
        path: String(c.path ?? '/'),
      })).filter(c => c.name)
    } catch {
      return NextResponse.json({ ok: false, error: 'Ungültiges JSON-Format' }, { status: 400 })
    }
  } else {
    // Fallback: "name=value; name2=value2" string format
    cookies = trimmed.split(';').map(part => {
      const eqIdx = part.indexOf('=')
      if (eqIdx === -1) return null
      const name = part.slice(0, eqIdx).trim()
      const value = part.slice(eqIdx + 1).trim()
      if (!name) return null
      return { name, value, domain: '.tiktok.com', path: '/' }
    }).filter(Boolean)
  }

  const hasSession = cookies.some(c =>
    ['sessionid', 'sid_tt', 'uid_tt'].includes(c.name)
  )

  if (!hasSession) {
    return NextResponse.json({
      ok: false,
      error: `Kein Session-Cookie gefunden. Gefundene Cookies: ${cookies.map((c: {name: string}) => c.name).join(', ') || 'keine'}. Stelle sicher dass du auf tiktok.com eingeloggt bist und alle Cookies exportierst.`
    }, { status: 400 })
  }

  const session = { cookies, savedAt: new Date().toISOString() }
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2))

  return NextResponse.json({ ok: true, cookieCount: cookies.length })
}
