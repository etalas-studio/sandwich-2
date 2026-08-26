import type { Metadata } from 'next'
import Script from 'next/script'
import Providers from '../components/Providers'
import AppEffects from '../components/AppEffects'
import ErrorBoundary from '../components/ErrorBoundary'
import '@fontsource-variable/geist'
import './globals.css'

export const metadata: Metadata = {
  title: 'SANDWICH',
  description: 'From a messy brief to an execution-ready spec.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Bowlby+One&family=Mouse+Memoirs&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/sandwich.webp" type="image/webp" />
      </head>
      <body>
        <Script
          src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"
          strategy="afterInteractive"
        />
        <ErrorBoundary>
          <Providers>
            <AppEffects />
            {children}
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  )
}
