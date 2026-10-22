import { Link } from 'react-router-dom'
import { useSeo } from '../hooks/useSeo'
import { BLOG_POSTS, formatPostDate } from '../data/blogPosts'

export default function Blog() {
  useSeo({ title: 'Blog | iDermaCare', description: 'Skincare tips, ingredient guides and routines from iDermaCare.' })

  return (
    <section className="ssz-section">
      <div className="ssz-container">
        <h1>The iDermaCare Blog</h1>
        <p className="ssz-blog__lead">Skincare tips, ingredient guides and routines.</p>
        <div className="ssz-blog__grid">
          {BLOG_POSTS.map((post) => (
            <article key={post.slug} className="ssz-blog__card">
              <span className="ssz-blog__tag">{post.tag}</span>
              <h2><Link to={`/blog/${post.slug}`}>{post.title}</Link></h2>
              <time dateTime={post.date}>{formatPostDate(post.date)}</time>
              <p>{post.excerpt}</p>
              <Link className="ssz-blog__more" to={`/blog/${post.slug}`}>Read more →</Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
