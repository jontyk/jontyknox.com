import type { Metadata } from 'next/types'

import { CollectionArchive } from '@/components/CollectionArchive'
import { PageRange } from '@/components/PageRange'
import { Pagination } from '@/components/Pagination'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import PageClient from './page.client'

export const dynamic = 'force-dynamic'
export const revalidate = 600

export default async function Page() {
  const payload = await getPayload({ config: configPromise })

  const posts = await payload.find({
    collection: 'posts',
    depth: 1,
    limit: 12,
    overrideAccess: false,
    select: {
      title: true,
      slug: true,
      meta: true,
      categories: true,
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
      {posts.totalPages > 1 && posts.page && (
        <div className="container pb-16">
          <Pagination page={posts.page} totalPages={posts.totalPages} />
        </div>
      )}
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: 'Writing | Jonty Knox',
    description:
      'Thoughts on building products, startups, and life from Jonty Knox, co-founder of CustomerOS.',
  }
}
