import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: '2cloudnine Migration Tool',
  description: 'Standalone Salesforce data migration platform',
  keywords: ['Salesforce', 'migration', 'data', 'automation', '2cloudnine'],
  authors: [{ name: '2cloudnine' }],
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        <div className="min-h-screen bg-background font-sans">
          <Providers>
            {children}
          </Providers>
        </div>
      </body>
    </html>
  )
} 