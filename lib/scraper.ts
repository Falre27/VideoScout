import { Configuration, TikTokWebAPIApi } from '@tikhubio/tikhub-api-ts-sdk'

export interface ScrapedVideo {
  id: string
  url: string
  thumbnail: string
  views: number
  likes: number
  comments: number
  shares: number
  description: string
  createdAt: string
  duration?: number
  platform: 'tiktok' | 'instagram'
}

export interface ScraperResult {
  videos: ScrapedVideo[]
  creator: {
    username: string
    displayName: string
    followers: number
    avatar?: string
    platform: 'tiktok' | 'instagram'
  }
  scrapedAt: string
  mode: 'live' | 'demo'
  source: 'direct' | 'tikhub' | 'demo'
}

// ─── Demo data ────────────────────────────────────────────────────────────────
export function getDemoData(username: string): ScraperResult {
  const views = [
    1_240_000, 987_000, 876_500, 752_300, 612_000, 503_000,
    480_000, 421_700, 389_200, 310_000, 278_400, 243_100,
    198_700, 172_300, 144_000, 121_500, 98_200, 76_400,
    54_300, 38_100, 27_600, 18_900, 12_400, 8_700,
  ]
  const descs = [
    'POV: you found the best hack nobody talks about 🤫',
    'this changed everything for me (not clickbait)',
    'answering the questions you\'re all sending me',
    'day in my life honestly nobody asked for but here we go',
    'the truth about what happened last week',
    'i tried this for 30 days... here\'s what happened',
    'okay so this blew up and i need to explain',
    'the thing everyone gets wrong about this',
    'hot take: this is actually underrated',
    'when the algorithm finally works in your favor',
    'responding to the comments from that video',
    'my honest thoughts after 6 months',
    'i can\'t believe this actually works',
    'the ugly truth nobody wants to hear',
    'doing this every day for a week',
    'why i stopped doing what everyone told me to',
    'some people are going to hate this',
    'this is the one thing that made the difference',
    'a message to anyone struggling right now',
    'plot twist at the end 👀',
    'low key obsessed with how this turned out',
    'taking notes? you should be',
    'small update for those who care',
    'wait for the end 🤯',
  ]
  return {
    videos: views.map((v, i) => ({
      id: `demo_${username}_${i}`,
      url: `https://www.tiktok.com/@${username}/video/74800000000000${String(i).padStart(4, '0')}`,
      thumbnail: `https://picsum.photos/seed/${username}${i}/300/530`,
      views: v,
      likes: Math.floor(v * 0.08),
      comments: Math.floor(v * 0.006),
      shares: Math.floor(v * 0.012),
      description: descs[i % descs.length],
      createdAt: new Date(Date.now() - i * 3 * 24 * 60 * 60 * 1000).toISOString(),
      duration: 15 + Math.floor(Math.random() * 45),
      platform: 'tiktok',
    })),
    creator: {
      username,
      displayName: username.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      followers: 284_000,
      platform: 'tiktok',
    },
    scrapedAt: new Date().toISOString(),
    mode: 'demo',
    source: 'demo',
  }
}

// ─── URL parser ───────────────────────────────────────────────────────────────
export function detectPlatform(input: string): {
  platform: 'tiktok' | 'instagram' | null
  username: string | null
} {
  const s = input.trim()
  const tt = s.match(/tiktok\.com\/@?([a-z0-9_.]+)/i)
  if (tt) return { platform: 'tiktok', username: tt[1] }
  const ig = s.match(/instagram\.com\/([a-z0-9_.]+)/i)
  if (ig) return { platform: 'instagram', username: ig[1] }
  const bare = s.match(/^@?([a-z0-9_.]{2,30})$/i)
  if (bare) return { platform: 'tiktok', username: bare[1] }
  return { platform: null, username: null }
}


// ─── Apify: TikTok Profile Scraper ($5 free/month, resets monthly) ───────────
async function scrapeWithApify(username: string): Promise<{
  videos: ScrapedVideo[]
  creator: ScraperResult['creator']
}> {
  const apiKey = process.env.APIFY_API_KEY!
  const actorId = 'clockworks~tiktok-profile-scraper'

  // Start the actor run
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profiles: [`https://www.tiktok.com/@${username}`],
        resultsPerPage: 100,
        profileScrapingType: 'posts',
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      }),
      signal: AbortSignal.timeout(10_000),
    }
  )
  if (!startRes.ok) throw new Error(`Apify start failed: ${startRes.status}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: runData }: any = await startRes.json()
  const runId: string = runData.id

  // Poll until finished (max 90s)
  let status = 'RUNNING'
  for (let i = 0; i < 45 && status === 'RUNNING'; i++) {
    await new Promise(r => setTimeout(r, 2_000))
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${apiKey}`,
      { signal: AbortSignal.timeout(10_000) }
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: s }: any = await statusRes.json()
    status = s.status
  }
  if (status !== 'SUCCEEDED') throw new Error(`Apify run ${status}`)

  // Fetch results from default dataset
  const dataRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apiKey}&limit=500`,
    { signal: AbortSignal.timeout(20_000) }
  )
  if (!dataRes.ok) throw new Error(`Apify dataset fetch failed: ${dataRes.status}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = await dataRes.json()

  if (!items.length) throw new Error('Apify returned no items')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileItem = items.find((i: any) => i.authorMeta) || items[0]
  const authorMeta = profileItem?.authorMeta || {}

  const creator: ScraperResult['creator'] = {
    username,
    displayName: String(authorMeta.name || authorMeta.nickName || username),
    followers: Number(authorMeta.fans || authorMeta.followers || 0),
    avatar: String(authorMeta.avatar || ''),
    platform: 'tiktok',
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videos: ScrapedVideo[] = items.map((item: any) => ({
    id: String(item.id || Math.random()),
    url: String(item.webVideoUrl || item.url || `https://www.tiktok.com/@${username}/video/${item.id}`),
    thumbnail: String(item.covers?.default || item.coverUrl || item.cover || ''),
    views: Number(item.playCount || item.views || 0),
    likes: Number(item.diggCount || item.likes || 0),
    comments: Number(item.commentCount || item.comments || 0),
    shares: Number(item.shareCount || item.shares || 0),
    description: String(item.text || item.desc || item.description || ''),
    createdAt: item.createTime
      ? new Date(Number(item.createTime) * 1000).toISOString()
      : new Date().toISOString(),
    duration: Number(item.videoMeta?.duration || item.duration || 0),
    platform: 'tiktok',
  }))

  return { videos, creator }
}

// ─── TikHub SDK (~$0.001/scan) ────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTikHubItem(item: any, username: string): ScrapedVideo {
  const stats = item.statistics || item.stats || {}
  const vid = item.video || {}
  const covers: string[] = vid.cover_url_list || vid.coverUrlList || []
  return {
    id: String(item.aweme_id || item.id || Math.random()),
    url: `https://www.tiktok.com/@${username}/video/${item.aweme_id || item.id || ''}`,
    thumbnail: covers[0] || String(vid.cover || item.cover || ''),
    views: Number(stats.play_count || stats.playCount || item.play_count || 0),
    likes: Number(stats.digg_count || stats.diggCount || item.digg_count || 0),
    comments: Number(stats.comment_count || stats.commentCount || item.comment_count || 0),
    shares: Number(stats.share_count || stats.shareCount || item.share_count || 0),
    description: String(item.desc || item.description || ''),
    createdAt: new Date(Number(item.create_time || 0) * 1000).toISOString(),
    duration: Number(vid.duration || 0),
    platform: 'tiktok',
  }
}

async function scrapeWithTikHub(username: string): Promise<{
  videos: ScrapedVideo[]
  creator: ScraperResult['creator']
}> {
  const apiKey = process.env.TIKHUB_API_KEY!
  const config = new Configuration({ basePath: 'https://api.tikhub.io', accessToken: apiKey })
  const api = new TikTokWebAPIApi(config)

  let secUid = ''
  let creator: ScraperResult['creator'] = {
    username, displayName: username, followers: 0, platform: 'tiktok',
  }

  try {
    const profileRes = await api.fetchUserProfileApiV1TiktokWebFetchUserProfileGet(username)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = profileRes.data
    const user = d?.data?.user || d?.data?.userInfo?.user || {}
    secUid = String(user.secUid || user.sec_uid || '')
    creator = {
      username,
      displayName: String(user.nickname || username),
      followers: Number(user.followerCount || 0),
      avatar: String(user.avatarLarger || ''),
      platform: 'tiktok',
    }
  } catch { /* optional */ }

  const allVideos: ScrapedVideo[] = []
  let cursor = 0
  let hasMore = true

  for (let page = 0; page < 10 && hasMore; page++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let res: any
      if (secUid) {
        res = await api.fetchUserPostApiV1TiktokWebFetchUserPostGet(secUid, cursor, 35)
      } else {
        const raw = await fetch(
          `https://api.tikhub.io/api/v1/tiktok/web/get_user_post?uniqueId=${username}&cursor=${cursor}&count=35`,
          { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(20_000) }
        )
        res = { data: await raw.json() }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = res.data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = data?.data?.itemList || data?.data?.aweme_list || []
      for (const item of items) allVideos.push(mapTikHubItem(item, username))
      hasMore = Boolean(data?.data?.hasMore ?? data?.data?.has_more)
      cursor = Number(data?.data?.cursor ?? 0)
      if (items.length === 0 || !hasMore) break
    } catch { break }
  }

  return { videos: allVideos, creator }
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function scrapeCreator(input: string): Promise<ScraperResult & { _errors?: string[] }> {
  const { platform, username } = detectPlatform(input)
  if (!username) throw new Error('Ungültiger Username oder URL')

  const errors: string[] = []

  // 1. TikHub (if key set)
  if (process.env.TIKHUB_API_KEY) {
    try {
      const { videos, creator } = await scrapeWithTikHub(username)
      videos.sort((a, b) => b.views - a.views)
      return { videos, creator: { ...creator, platform: platform || 'tiktok' }, scrapedAt: new Date().toISOString(), mode: 'live', source: 'tikhub' }
    } catch (e) { errors.push(`tikhub: ${(e as Error).message}`) }
  } else { errors.push('tikhub: no TIKHUB_API_KEY') }

  // 2. Apify (if key set)
  if (process.env.APIFY_API_KEY) {
    try {
      const { videos, creator } = await scrapeWithApify(username)
      videos.sort((a, b) => b.views - a.views)
      return { videos, creator: { ...creator, platform: platform || 'tiktok' }, scrapedAt: new Date().toISOString(), mode: 'live', source: 'direct' }
    } catch (e) { errors.push(`apify: ${(e as Error).message}`) }
  } else { errors.push('apify: no APIFY_API_KEY') }

  // 3. Demo
  return { ...getDemoData(username), _errors: errors }
}
