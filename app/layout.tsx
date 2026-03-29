import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Video Scout',
  description: 'Discover top-performing videos from any creator',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
