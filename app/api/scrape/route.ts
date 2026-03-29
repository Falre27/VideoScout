import { NextRequest, NextResponse } from 'next/server'
import { scrapeCreator } from '@/lib/scraper'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 })
    }
    const result = await scrapeCreator(url.trim())
    result.videos.sort((a, b) => b.views - a.views)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
