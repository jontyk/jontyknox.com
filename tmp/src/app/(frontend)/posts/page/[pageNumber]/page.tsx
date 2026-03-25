import type { Metadata } from 'next/types'

import { CollectionArchive } from '@/components/CollectionArchive'
import { PageRange } from '@/components/PageRange'
import { Pagination } from '@/components/Pagination'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import PageClient from './page.client'
import { notFound } from 'next/navigation'

export const revalidate = 600

type Args = {
  params: Promise<{
    pageNumber: string
  }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const { pageNumber } = await paramsPromise
  const payload = await getPayload({ config: configPromise })

  const sanitizedPageNumber = Number(pageNumber)

  if (!Number.isInteger(sanitizedPageNumber)) notFound()

  const posts = await payload.find({
    collection: 'posts',
    depth: 1,
    limit: 12,
    page: sanitizedPageNumber,
    overrideAccess: false,
    select: {
      title: true,
      slug: true,
      meta: true,
    },
  })

  return (
    <div className="min-h-screen">
      <PageClient />

      {/* Hero Section */}
      <div className="border-b border-border bg-card">
        <div className="container py-16 md:py-24">
          <h1 className="text-4xl md:text-5xl font-semibold mb-4">Writing</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Thoughts on building products, startups, and life.
          </p>
        </div>
      </div>

      {/* Posts Grid */}
      <div className="container py-12 md:py-16">
        <CollectionArchive posts={posts.docs} />
      </div>

      {/* Pagination */}
      {posts?.page && posts?.totalPages > 1 && (
        <div className="container pb-16">
          <Pagination page={posts.page} totalPages={posts.totalPages} />
        </div>
      )}
    </div>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { pageNumber } = await paramsPromise
  return {
    title: `Writing - Page ${pageNumber} | Jonty Knox`,
    description:
      'Thoughts on building products, startups, and life from Jonty Knox, co-founder of CustomerOS.',
  }
}

export async function generateStaticParams() {
  try {
    const payload = await getPayload({ config: configPromise })
    const { totalDocs } = await payload.count({
      collection: 'posts',
      overrideAccess: false,
    })

    const totalPages = Math.ceil(totalDocs / 10)

    const pages: { pageNumber: string }[] = []

    for (let i = 1; i <= totalPages; i++) {
      pages.push({ pageNumber: String(i) })
    }

    return pages
  } catch (error) {
    // Return empty array if database tables don't exist yet
    console.warn('Could not generate static params for posts pagination:', error)
    return []
  }
}
