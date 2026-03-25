import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import React from 'react'

import { AdminBar } from '@/components/AdminBar'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { draftMode } from 'next/headers'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'

const jsonLd = {
  '@context': 'https://schema.org/',
  '@type': 'Person',
  '@id': 'https://jontyknox.com/#JontyKnox',
  url: 'https://jontyknox.com',
  affiliation: [
    {
      '@type': 'Organization',
      '@id': 'https://www.wikidata.org/wiki/Q132456993',
      url: 'https://customeros.ai/',
      name: 'CustomerOS',
    },
    {
      '@type': 'Organization',
      '@id': 'https://www.wikidata.org/wiki/Q2616400',
      url: 'https://www.ycombinator.com/',
      name: 'Y Combinator',
    },
    {
      '@type': 'Organization',
      '@id': 'https://www.wikidata.org/wiki/Q4854759',
      url: 'https://www.bandwidth.com/',
      name: 'Bandwidth.com',
    },
  ],
  description:
    'Jonty Knox is an Australian entrepreneur and the co-founder of CustomerOS, a Y Combinator-backed company building AI agents for sales, marketing, and customer success. Previously, he was Head of Product at Voxbone, which was acquired by Bandwidth for $519M in 2020. He is passionate about using AI to transform customer interactions to be a pleasure every single time.',
  image: 'https://jontyknox.com/images/jonty-knox.jpg',
  name: 'Jonty Knox',
  givenName: 'Jonty',
  familyName: 'Knox',
  gender: 'Male',
  birthPlace: {
    '@type': 'Place',
    name: 'Adelaide, Australia',
  },
  email: 'jonty@customeros.ai',
  jobTitle: 'COO and Co-Founder',
  sameAs: [
    'https://www.linkedin.com/in/jontyknox',
    'https://twitter.com/jontyknox',
    'https://x.com/jontyknox',
    'https://www.crunchbase.com/person/jonty-knox',
    'https://www.instagram.com/jontyknox',
    'https://www.ycombinator.com/companies/founders?query=Jonty%20Knox',
    'https://github.com/jontyk',
    'https://theorg.com/org/customeros/org-chart/jonty-knox',
    'https://www.google.com/search?kgmid=/g/11vwqnv6bv',
    'https://www.producthunt.com/@jontyk',
  ],
  knowsAbout: [
    {
      '@type': 'Organization',
      '@id': 'https://www.wikidata.org/wiki/Q4854759',
      name: 'Bandwidth.com',
    },
    {
      '@type': 'Thing',
      '@id': 'https://www.wikidata.org/wiki/Q1780667',
      name: 'Product Management',
    },
    {
      '@type': 'Thing',
      '@id': 'https://www.wikidata.org/wiki/Q1254596',
      name: 'Software as a Service',
    },
    {
      '@type': 'Organization',
      '@id': 'https://www.wikidata.org/wiki/Q2616400',
      name: 'Y Combinator',
    },
  ],
  knowsLanguage: [
    {
      '@type': 'Language',
      name: 'English',
    },
  ],
  nationality: [
    {
      '@type': 'Country',
      '@id': 'https://www.wikidata.org/wiki/Q408',
      name: 'Australia',
    },
    {
      '@type': 'Country',
      '@id': 'https://www.wikidata.org/wiki/Q145',
      name: 'United Kingdom',
    },
    {
      '@type': 'Country',
      '@id': 'https://www.wikidata.org/wiki/Q233',
      name: 'Malta',
    },
  ],
  alumniOf: [
    {
      '@type': 'EducationalOrganization',
      '@id': 'https://www.wikidata.org/wiki/Q2616400',
      name: 'Y Combinator',
      url: 'https://www.ycombinator.com/',
    },
    {
      '@type': 'EducationalOrganization',
      '@id': 'https://www.wikidata.org/wiki/Q270532',
      name: 'University of Aberdeen',
      url: 'https://www.abdn.ac.uk/',
    },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()

  return (
    <html className={cn(GeistSans.variable, GeistMono.variable)} lang="en" suppressHydrationWarning>
      <head>
        <InitTheme />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#5bbad5" />
        <meta name="msapplication-TileColor" content="#da532c" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              mainEntity: {
                '@id': 'https://jontyknox.com/#JontyKnox',
              },
              name: 'Jonty Knox',
              description:
                'Jonty Knox is an Australian software entrepreneur, engineer, designer, and Co-founder of CustomerOS.',
              author: {
                '@type': 'Person',
                name: 'Jonty Knox',
              },
              url: 'https://jontyknox.com',
            }),
          }}
        />
      </head>
      <body>
        <Providers>
          <AdminBar
            adminBarProps={{
              preview: isEnabled,
            }}
          />

          <Header />
          {children}
          {/* <Footer /> */}
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    creator: '@payloadcms',
  },
}
