import { cn } from '@/utilities/ui'
import React from 'react'

import { Card, CardData } from '@/components/Card'

export type Props = {
  posts: CardData[]
}

export const CollectionArchive: React.FC<Props> = (props) => {
  const { posts } = props

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts?.map((result, index) => {
        if (typeof result === 'object' && result !== null) {
          // Determine relationTo based on presence of categories (posts) or not (italy)
          const relationTo = 'categories' in result ? 'posts' : 'italy-posts'
          return (
            <Card
              key={index}
              className="h-full"
              doc={result}
              relationTo={relationTo}
              showCategories={relationTo === 'posts'}
            />
          )
        }

        return null
      })}
    </div>
  )
}
