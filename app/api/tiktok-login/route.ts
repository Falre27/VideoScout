import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300 // 5 minutes for manual login
import fs from 'fs'
import path from 'path'

const SESSION_FILE = path.join(process.cwd(), '.tiktok-session.json')

// GET — check session status
export async function GET() {
  if (!fs.existsSync(SESSION_FILE)) {
    return NextResponse.json({ loggedIn: false })
  }
  try {
    const session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'))
    const sessionCookie = session.cookies?.find(
      (c: { name: string }) => c.name === 'sessionid' || c.name === 'sid_tt'
    )
    if (!sessionCookie) return NextResponse.json({ loggedIn: false })
    return NextResponse.json({
      loggedIn: true,
      savedAt: session.savedAt,
      cookieCount: session.cookies?.length ?? 0,
    })
  } catch {
    return NextResponse.json({ loggedIn: false })
  }
}

// POST — import session from Chrome or launch manual login
export async function POST(req: NextRequest) {
  const { action } = await req.json().catch(() => ({ action: 'chrome' }))

  if (action === 'logout') {
    if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE)
    return NextResponse.json({ ok: true })
  }

  const { chromium } = await import('playwright')

  // ── Option A: import from existing Chrome profile (user already logged in) ──
  if (action === 'chrome') {
    const os = await import('os')
    const chromePaths = [
      path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Default'),
      path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Profile 1'),
      path.join(os.homedir(), 'AppData/Local/Google/Chrome/User Data/Default'),
    ]
    const profilePath = chromePaths.find(p => fs.existsSync(p))
    if (!profilePath) {
      return NextResponse.json({ ok: false, error: 'Chrome profile not found' }, { status: 404 })
    }

    // Copy profile to temp dir so Chrome doesn't need to be closed
    const tmpProfile = path.join(os.tmpdir(), `vs-chrome-${Date.now()}`)
    fs.cpSync(profilePath, tmpProfile, { recursive: true, errorOnExist: false })

    let context
    try {
      context = await chromium.launchPersistentContext(tmpProfile, {
        channel: 'chrome',
        headless: true,
        args: ['--disable-blink-features=AutomationControlled'],
      })
    } catch {
      // Fallback: use Playwright's bundled Chromium with copied profile
      context = await chromium.launchPersistentContext(tmpProfile, {
        headless: true,
      })
    }

    const page = await context.newPage()
    await page.goto('https://www.tiktok.com', { waitUntil: 'domcontentloaded', timeout: 20_000 })
    await page.waitForTimeout(2_000)

    const cookies = await context.cookies('https://www.tiktok.com')
    await context.close()

    // Cleanup temp profile
    try { fs.rmSync(tmpProfile, { recursive: true, force: true }) } catch { /* ok */ }

    const hasSession = cookies.some(c =>
      ['sessionid', 'sid_tt', 'uid_tt'].includes(c.name)
    )

    if (!hasSession) {
      return NextResponse.json({ ok: false, error: 'not_logged_in_chrome' })
    }

    const session = { cookies, savedAt: new Date().toISOString() }
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2))
    return NextResponse.json({ ok: true, loggedIn: true, cookieCount: cookies.length })
  }

  // ── Option B: manual login with injected confirm button ──
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  })
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  const page = await context.newPage()
  // Go directly to email/password login — QR code polling doesn't work in Playwright
  await page.goto('https://www.tiktok.com/login/phone-or-email/email', { waitUntil: 'domcontentloaded' })

  const injectButton = async () => {
    await page.evaluate(() => {
      if (document.getElementById('vs-login-done')) return
      const btn = document.createElement('button')
      btn.id = 'vs-login-done'
      btn.textContent = '✓ Eingeloggt — Weiter'
      btn.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; z-index: 999999;
        background: linear-gradient(135deg, #ff4d6d, #ff8500);
        color: white; font-size: 15px; font-weight: 700;
        padding: 14px 24px; border-radius: 12px; border: none;
        cursor: pointer; box-shadow: 0 4px 20px rgba(255,77,109,0.5);
        font-family: -apple-system, sans-serif;
      `
      btn.onclick = () => { (window as any).__vsLoginDone = true }
      document.body.appendChild(btn)
    })
  }
  page.on('load', injectButton)
  await injectButton()

  let loggedIn = false
  try {
    await page.waitForFunction(() => (window as any).__vsLoginDone === true, {
      timeout: 180_000, polling: 500,
    })
    await page.waitForTimeout(2_000)
    loggedIn = true
  } catch { loggedIn = false }

  if (loggedIn) {
    const cookies = await context.cookies()
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookies, savedAt: new Date().toISOString() }, null, 2))
  }
  await browser.close()
  return NextResponse.json({ ok: loggedIn, loggedIn })
}
