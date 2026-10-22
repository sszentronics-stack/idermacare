import { Link, useParams } from 'react-router-dom'
import { useSeo } from '../hooks/useSeo'
import { BLOG_POSTS, formatPostDate } from '../data/blogPosts'

export default function BlogPost() {
  const { slug } = useParams()
  const post = BLOG_POSTS.find((item) => item.slug === slug)
  useSeo({ title: `${post ? post.title : 'Post not found'} | iDermaCare`, description: post?.excerpt })

  if (!post) {
    return (
      <section className="ssz-section">
        <div className="ssz-container ssz-narrow">
          <h1>Post not found</h1>
          <Link to="/blog">← Back to the blog</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="ssz-section">
      <article className="ssz-container ssz-narrow ssz-blog__post">
        <Link to="/blog">← All posts</Link>
        <h1>{post.title}</h1>
        <time dateTime={post.date}>{formatPostDate(post.date)} · {post.tag}</time>
        {post.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </article>
    </section>
  )
}
