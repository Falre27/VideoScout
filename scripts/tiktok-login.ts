/**
 * TikTok Login Script
 *
 * Run this ONCE to save your TikTok session:
 *   npx tsx scripts/tiktok-login.ts
 *
 * It opens a browser window → log in → session is saved to .tiktok-session.json
 * The scraper will use this session for all future requests.
 */

import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const SESSION_FILE = path.join(process.cwd(), '.tiktok-session.json')

async function main() {
  console.log('\n🚀 Starting TikTok login...\n')

  const browser = await chromium.launch({
    headless: false, // Must be visible so you can log in
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

  console.log('📂 Opening TikTok login page...')
  await page.goto('https://www.tiktok.com/login', { waitUntil: 'domcontentloaded' })

  console.log('\n👤 Please log in to TikTok in the browser window.')
  console.log('   Waiting for you to reach your profile page...\n')

  // Wait until the user is logged in — detected by profile page URL or avatar
  await page.waitForURL('https://www.tiktok.com/**', { timeout: 120_000 })

  // Wait a bit more to make sure all cookies are set
  let attempts = 0
  while (attempts < 30) {
    const cookies = await context.cookies()
    const sessionKey = cookies.find(c => c.name === 'sessionid' || c.name === 'sid_tt' || c.name === 'uid_tt')
    if (sessionKey) break
    await page.waitForTimeout(2_000)
    attempts++
  }

  const cookies = await context.cookies()
  const localStorage = await page.evaluate(() => {
    const data: Record<string, string> = {}
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key) data[key] = window.localStorage.getItem(key) ?? ''
    }
    return data
  })

  const session = { cookies, localStorage, savedAt: new Date().toISOString() }
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2))

  const sessionCookies = cookies.filter(c =>
    ['sessionid', 'sid_tt', 'uid_tt', 'ttwid', 'tt_csrf_token', 'msToken', 'passport_csrf_token'].includes(c.name)
  )

  console.log('\n✅ Session saved to .tiktok-session.json')
  console.log(`   Total cookies: ${cookies.length}`)
  console.log(`   Session cookies found: ${sessionCookies.map(c => c.name).join(', ')}\n`)

  await browser.close()
  process.exit(0)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
