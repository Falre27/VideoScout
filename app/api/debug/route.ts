import { NextRequest, NextResponse } from 'next/server'
import path from 'path'

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('u') || 'khaby.lame'
  const mode = req.nextUrl.searchParams.get('mode') || 'http'

  if (mode === 'browser') {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled'],
    })
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      geolocation: { latitude: 40.7128, longitude: -74.006 },
      permissions: ['geolocation'],
    })
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })
    const page = await context.newPage()
    const capturedUrls: string[] = []
    const capturedResponses: Array<{ url: string; status: number; bodySnippet: string }> = []

    page.on('response', async (response) => {
      const url = response.url()
      if (url.includes('tiktok.com/api/') || url.includes('/aweme/')) {
        capturedUrls.push(url)
        try {
          const text = await response.text()
          capturedResponses.push({ url: url.split('?')[0], status: response.status(), bodySnippet: text.slice(0, 200) })
        } catch { /* */ }
      }
    })

    await page.goto(`https://www.tiktok.com/@${username}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)

    // Try to click allow all cookie button
    let cookieClicked = false
    try {
      const btn = page.locator('button').filter({ hasText: /allow all/i }).first()
      await btn.waitFor({ timeout: 3_000 })
      await btn.click()
      cookieClicked = true
      await page.waitForTimeout(3_000)
    } catch { /* */ }

    await page.waitForTimeout(3_000)
    const screenshotPath = path.join('/tmp', `tiktok-debug-${Date.now()}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: false })
    const title = await page.title()
    const html = await page.content()
    const hasVideoList = html.includes('itemList') || html.includes('aweme_list')
    await browser.close()

    return NextResponse.json({
      mode: 'browser',
      title,
      screenshotPath,
      cookieClicked,
      hasVideoList,
      capturedApiUrls: capturedUrls.slice(0, 5),
      itemListResponses: capturedResponses.filter(r => r.url.includes('item_list')),
    })
  }

  const profileUrl = `https://www.tiktok.com/@${username}`

  const htmlRes = await fetch(profileUrl, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(20_000),
  })

  const html = await htmlRes.text()
  const scriptMatch = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
  )

  if (!scriptMatch) {
    return NextResponse.json({
      error: 'Script tag not found',
      httpStatus: htmlRes.status,
      htmlSnippet: html.slice(0, 2000),
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pageData: any
  try {
    pageData = JSON.parse(scriptMatch[1])
  } catch {
    return NextResponse.json({ error: 'Failed to parse JSON', raw: scriptMatch[1].slice(0, 500) })
  }

  const defaultScope = pageData?.__DEFAULT_SCOPE__ || {}
  const keys = Object.keys(defaultScope)

  const userDetail = defaultScope['webapp.user-detail']
  const user = userDetail?.userInfo?.user || {}
  const stats = userDetail?.userInfo?.stats || {}
  const secUid = String(user.secUid || '')

  // Extract cookies from the profile response
  const setCookieHeaders = htmlRes.headers.getSetCookie?.() ?? []
  const cookieString = setCookieHeaders.map((c: string) => c.split(';')[0]).join('; ')

  // Now test the item_list API call
  let apiResult: unknown = null
  let apiStatus = 0
  let apiRawSnippet = ''
  if (secUid) {
    const apiUrl = new URL('https://www.tiktok.com/api/post/item_list/')
    apiUrl.searchParams.set('aid', '1988')
    apiUrl.searchParams.set('count', '35')
    apiUrl.searchParams.set('cursor', '0')
    apiUrl.searchParams.set('device_platform', 'web_pc')
    apiUrl.searchParams.set('secUid', secUid)
    apiUrl.searchParams.set('region', 'US')

    const apiRes = await fetch(apiUrl.toString(), {
      headers: {
        ...BROWSER_HEADERS,
        'Referer': `https://www.tiktok.com/@${username}`,
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Accept': 'application/json, text/plain, */*',
        ...(cookieString ? { 'Cookie': cookieString } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    })
    apiStatus = apiRes.status
    const rawText = await apiRes.text()
    apiRawSnippet = rawText.slice(0, 500)
    try {
      apiResult = JSON.parse(rawText)
    } catch {
      apiResult = `JSON parse failed — raw: ${apiRawSnippet}`
    }
  }

  return NextResponse.json({
    httpStatus: htmlRes.status,
    cookieCount: setCookieHeaders.length,
    cookieNames: setCookieHeaders.map((c: string) => c.split('=')[0]),
    scopeKeys: keys,
    secUid: secUid ? 'present' : 'missing',
    userInfo: { nickname: user.nickname, followerCount: stats.followerCount },
    apiStatus,
    apiItemCount: Array.isArray((apiResult as Record<string, unknown>)?.itemList) ? ((apiResult as Record<string, unknown>).itemList as unknown[]).length : 0,
    apiHasMore: (apiResult as Record<string, unknown>)?.hasMore,
    apiResultKeys: apiResult && typeof apiResult === 'object' ? Object.keys(apiResult as object) : [],
    apiRawSnippet: typeof apiResult === 'string' ? apiRawSnippet : undefined,
  })
}
