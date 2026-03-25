'use client'
import { cn } from '@/utilities/ui'
import useClickableCard from '@/utilities/useClickableCard'
import Link from 'next/link'
import React, { Fragment } from 'react'

import type { Post, ItalyPost } from '@/payload-types'

import { Media } from '@/components/Media'

export type CardData =
  | Pick<Post, 'slug' | 'categories' | 'meta' | 'title'>
  | Pick<ItalyPost, 'slug' | 'meta' | 'title'>

export const Card: React.FC<{
  alignItems?: 'center'
  className?: string
  doc?: CardData
  relationTo?: 'posts' | 'italy-posts'
  showCategories?: boolean
  title?: string
}> = (props) => {
  const { card, link } = useClickableCard({})
  const { className, doc, relationTo, showCategories, title: titleFromProps } = props

  if (!doc) {
    return null
  }

  const { slug, meta, title } = doc
  const categories = 'categories' in doc ? doc.categories : []
  const { description, image: metaImage } = meta || {}

  const hasCategories = categories && Array.isArray(categories) && categories.length > 0
  const titleToUse = titleFromProps || title
  const sanitizedDescription = description?.replace(/\s/g, ' ') // replace non-breaking space with white space
  const href = relationTo === 'italy-posts' ? `/italy/posts/${slug}` : `/${relationTo}/${slug}`

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all duration-200 hover:shadow-lg hover:border-foreground/20',
        className,
      )}
      ref={card.ref}
    >
      {/* Image Section */}
      {metaImage && typeof metaImage !== 'string' && (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          <Media
            resource={metaImage}
            size="33vw"
            fill
            imgClassName="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}

      {/* Content Section */}
      <div className="flex flex-1 flex-col p-6">
        {/* Categories */}
        {showCategories && hasCategories && (
          <div className="mb-3 flex flex-wrap gap-2">
            {categories?.map((category, index) => {
              if (typeof category === 'object') {
                const { title: titleFromCategory } = category
                const categoryTitle = titleFromCategory || 'Untitled category'

                return (
                  <span
                    key={index}
                    className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                  >
                    {categoryTitle}
                  </span>
                )
              }
              return null
            })}
          </div>
        )}

        {/* Title */}
        {titleToUse && (
          <h3 className="mb-2 text-xl font-semibold leading-tight tracking-tight">
            <Link
              href={href}
              ref={link.ref}
              className="hover:underline focus:underline outline-none"
            >
              {titleToUse}
            </Link>
          </h3>
        )}

        {/* Description */}
        {sanitizedDescription && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">
            {sanitizedDescription}
          </p>
        )}
      </div>
    </article>
  )
}
