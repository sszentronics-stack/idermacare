export const BLOG_POSTS = [
  {
    slug: 'build-a-simple-skincare-routine',
    title: 'How to Build a Simple Skincare Routine That Actually Works',
    date: '2026-10-01',
    tag: 'Skincare basics',
    excerpt: 'Four steps, five minutes, real results. Here is how to start without overwhelming your skin.',
    body: [
      'A good routine does not need ten products. Start with four steps: cleanse, treat, moisturise and protect.',
      'Cleanse: use a gentle cleanser morning and night. If your skin feels tight afterwards, the cleanser is too harsh.',
      'Treat: pick one active at a time, such as a collagen-supporting serum or a niacinamide product, and give it at least four weeks before judging results.',
      'Moisturise: even oily skin needs hydration. Look for lightweight, non-comedogenic formulas.',
      'Protect: sunscreen every morning is the single most effective anti-ageing step. Reapply when outdoors.',
      'Introduce new products one at a time and patch test on your inner arm first.',
    ],
  },
  {
    slug: 'what-is-collagen-skincare',
    title: 'Collagen Skincare: What It Can and Cannot Do',
    date: '2026-10-08',
    tag: 'Ingredients',
    excerpt: 'Collagen is everywhere in skincare marketing. We explain how it works on the skin surface and what to expect.',
    body: [
      'Collagen molecules in creams are too large to penetrate deeply, but they form a hydrating film that leaves skin plumper and smoother.',
      'Pairing collagen-based products with ingredients like peptides and vitamin C supports the skin barrier and a firmer look over time.',
      'Consistency matters more than quantity. Use your product daily and be patient: visible changes usually appear after four to eight weeks.',
      'Always buy authentic products from trusted sellers so you know exactly what you are putting on your skin.',
    ],
  },
  {
    slug: 'pimple-patch-guide',
    title: 'Pimple Patches 101: When and How to Use Them',
    date: '2026-10-15',
    tag: 'Acne care',
    excerpt: 'Hydrocolloid patches protect blemishes and speed up healing. Here is how to get the most from them.',
    body: [
      'Hydrocolloid patches absorb fluid from a whitehead and shield it from picking and bacteria.',
      'Apply to clean, dry skin. Press the patch gently and leave it on for at least six hours, or overnight.',
      'Patches work best on surface-level, pus-filled pimples. They will not do much for deep cystic breakouts.',
      'Remove the patch when it turns white and opaque. Follow with your normal moisturiser.',
    ],
  },
]

export function formatPostDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
