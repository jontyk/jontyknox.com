import React from 'react'
import Link from 'next/link'

export default function ItalyPlaceholderPage() {
  return (
    <div className="page-wrapper">
      <header>
        <h1>Italy Blog</h1>
        <h2 className="subheading">Restoring a 200+ year old farm house in Tuscany</h2>
      </header>
      <main>
        <section>
          <p className="mb-4">
            Welcome! Explore stories, photos, and updates about the journey of restoring and
            renovating a historic farmhouse in Tuscany, Italy.
          </p>
          <Link href="/italy/posts" className="underline text-blue-600 hover:text-blue-800">
            View Italy Blog Posts
          </Link>
        </section>
      </main>
    </div>
  )
}
