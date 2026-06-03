import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MedReview — Plataforma Operacional',
  description: 'Central operacional MedReview',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
