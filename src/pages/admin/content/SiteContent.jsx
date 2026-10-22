import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SITE_CONTENT_LIMITS, loadSiteContent, saveSiteContent, uploadSiteAsset } from '../../../lib/siteContent'

const SECTIONS = [
  { id: 'business', label: 'Shop details', help: 'Name, logo, phone, email, WhatsApp', title: 'Shop details', intro: 'Your logo and contact details. They appear in the header, footer, contact page and order emails.' },
  { id: 'announcement', label: 'Top message bar', help: 'The thin bar above the menu', title: 'Top message bar', intro: 'Short messages that rotate in the bar at the very top of every page.' },
  { id: 'banners', label: 'Home page banners', help: 'Big pictures at the top of Home', title: 'Home page banners', intro: 'The large sliding banners on the home page. Use a wide picture and a short heading.' },
  { id: 'home', label: 'Home page circles', help: 'Story and brand circles, headings', title: 'Home page circles and headings', intro: 'The round story pictures, the brand circles and the section headings on the home page.' },
  { id: 'story', label: 'Our story block', help: 'Picture and text under the banners', title: 'Our story block', intro: 'The picture-and-text block on the home page that links to the About page.' },
  { id: 'watch', label: 'Product videos', help: 'Short clips on the home page', title: 'Product videos', intro: 'Short video clips shown in the "Watch and shop" area of the home page.' },
  { id: 'reviews', label: 'Customer reviews', help: 'Quotes shown on the home page', title: 'Customer reviews', intro: 'Review quotes and pictures shown on the home page.' },
  { id: 'trust', label: 'Promise badges', help: 'Cash on delivery, returns...', title: 'Promise badges', intro: 'Short promises shown under the banners, for example "Cash on delivery".' },
  { id: 'about', label: 'About page', help: 'Photo and paragraphs', title: 'About page', intro: 'The text and photo on the About us page.' },
  { id: 'contact', label: 'Contact page', help: 'Page title and WhatsApp label', title: 'Contact page', intro: 'Wording for the Contact page.' },
  { id: 'policies', label: 'Policies', help: 'Shipping, refunds, privacy, terms', title: 'Policy pages', intro: 'Shipping, refund, privacy and terms pages.' },
  { id: 'disclaimer', label: 'Product notice', help: 'Small print on product pages', title: 'Product notice', intro: 'The small-print notice shown at the bottom of every product page.' },
  { id: 'products', label: 'Product text & photos', help: 'Names, prices, descriptions', title: 'Product text and photos', intro: 'The words, prices and pictures visitors see for each product.' },
]

function Field({ id, label, value, onChange, rows, hint }) {
  return (
    <div className="form-field">
      <label className="form-label" htmlFor={id}>{label}</label>
      {rows ? (
        <textarea id={id} className="form-input" rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input id={id} className="form-input" value={value} onChange={(event) => onChange(event.target.value)} />
      )}
      {hint ? <p className="admin-hint">{hint}</p> : null}
    </div>
  )
}

function ImageField({ id, label, value, folder, kind = 'image', onChange }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const isVideo = kind === 'video'

  async function onFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      onChange(await uploadSiteAsset(file, folder))
    } catch (err) {
      setUploadError(err?.message || 'Could not upload the file.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="form-field">
      <label className="form-label" htmlFor={id}>{label}</label>
      {value && isVideo ? (
        <video src={value} muted playsInline width="160" height="90" style={{ display: 'block', width: 160, height: 90, objectFit: 'contain', marginBottom: 8, background: '#f3f3f3' }} />
      ) : null}
      {value && !isVideo ? (
        <img src={value} alt="" width="160" height="90" style={{ display: 'block', width: 160, height: 90, objectFit: 'contain', marginBottom: 8, background: '#f3f3f3' }} />
      ) : null}
      <input id={id} className="form-input" value={value || ''} onChange={(event) => onChange(event.target.value)} />
      <div className="admin-image-tile-actions" style={{ marginTop: 8 }}>
        <label className="admin-btn admin-btn-ghost admin-upload-btn">
          {uploading ? 'Uploading…' : isVideo ? 'Upload video' : 'Upload image'}
          <input
            type="file"
            accept={isVideo ? 'video/mp4,video/webm' : 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml'}
            hidden
            onChange={onFile}
            disabled={uploading}
          />
        </label>
        {value ? (
          <button type="button" className="admin-btn admin-btn-danger" onClick={() => onChange('')}>Remove</button>
        ) : null}
      </div>
      {uploadError ? <p className="form-error">{uploadError}</p> : null}
    </div>
  )
}

function moveItem(list, index, step) {
  const target = index + step
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

function ItemActions({ index, length, onMove, onRemove }) {
  return (
    <div className="admin-image-tile-actions" style={{ marginBottom: 12 }}>
      <button type="button" className="admin-btn admin-btn-ghost" disabled={index === 0} onClick={() => onMove(index, -1)}>Move up</button>
      <button type="button" className="admin-btn admin-btn-ghost" disabled={index === length - 1} onClick={() => onMove(index, 1)}>Move down</button>
      <button type="button" className="admin-btn admin-btn-danger" onClick={() => onRemove(index)}>Remove</button>
    </div>
  )
}

export default function SiteContent() {
  const [draft, setDraft] = useState(null)
  const [section, setSection] = useState('business')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [clipSlug, setClipSlug] = useState('')
  const [savedSnapshot, setSavedSnapshot] = useState('')

  useEffect(() => {
    let cancelled = false
    loadSiteContent().then((content) => {
      if (!cancelled) {
        setDraft(content)
        setSavedSnapshot(JSON.stringify(content))
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  function patch(recipe) {
    setDraft((current) => recipe(current))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setSaving(true)
    try {
      const result = await saveSiteContent(draft)
      setDraft(result.content)
      setSavedSnapshot(JSON.stringify(result.content))
      setNotice(result.remote
        ? 'Saved. Visitors will see this copy from Supabase.'
        : 'Saved in this browser. Add the Supabase URL and anon key on your static host so every visitor sees it.')
    } catch (err) {
      setError(err?.message || 'Could not save the storefront copy.')
    } finally {
      setSaving(false)
    }
  }

  const dirty = Boolean(draft) && JSON.stringify(draft) !== savedSnapshot
  const current = SECTIONS.find((item) => item.id === section) || SECTIONS[0]

  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (!draft) return <p>Loading website content…</p>

  return (
    <form onSubmit={handleSubmit} className="cms">
      <div className="admin-page-header">
        <div>
          <h1>Website content</h1>
          <p>
            Change the words, pictures and prices visitors see. Pick a part of the website on the left, edit it, then press <strong>Save changes</strong>.
          </p>
        </div>
        <a className="admin-btn admin-btn-ghost" href="/" target="_blank" rel="noopener noreferrer">View website ↗</a>
      </div>
      {error && <div className="form-banner form-banner-error">{error}</div>}
      {notice && <div className="form-banner form-banner-success">{notice}</div>}

      <div className="cms-layout">
        <nav className="cms-tabs" aria-label="Website parts">
          {SECTIONS.map((item) => (
            <button key={item.id} type="button" className={`cms-tab${item.id === section ? ' is-active' : ''}`} aria-current={item.id === section ? 'true' : undefined} onClick={() => setSection(item.id)}>
              <strong>{item.label}</strong>
              <span>{item.help}</span>
            </button>
          ))}
        </nav>

        <div>
        <div className="cms-panel">
          <div className="cms-panel-head">
            <h2>{current.title}</h2>
            <p>{current.intro}</p>
          </div>

      {section === 'business' && (
        <section>
          <ImageField id="logo" label="Header logo" folder="logo" value={draft.logo} onChange={(value) => patch((current) => ({ ...current, logo: value }))} />
          <Field id="biz-name" label="Shop name" hint="Shown in the footer and on the contact page." value={draft.business.name} onChange={(value) => patch((current) => ({ ...current, business: { ...current.business, name: value } }))} />
          <Field id="biz-address" label="Address" value={draft.business.address} onChange={(value) => patch((current) => ({ ...current, business: { ...current.business, address: value } }))} />
          <Field id="biz-phone" label="Phone" value={draft.business.phone} onChange={(value) => patch((current) => ({ ...current, business: { ...current.business, phone: value } }))} />
          <Field id="biz-email" label="Email" value={draft.business.email} onChange={(value) => patch((current) => ({ ...current, business: { ...current.business, email: value } }))} />
          <Field id="biz-whatsapp" label="WhatsApp number" hint="Digits only with country code, e.g. 923001234567." value={draft.business.whatsapp} onChange={(value) => patch((current) => ({ ...current, business: { ...current.business, whatsapp: value } }))} />
          <Field id="biz-payment" label="Bank / JazzCash / Easypaisa transfer details" value={draft.business.paymentInstructions || ''} rows="4" hint="Shown at checkout as an extra payment choice, e.g. bank name, account title, IBAN or wallet number. Leave empty to offer cash on delivery only." onChange={(value) => patch((current) => ({ ...current, business: { ...current.business, paymentInstructions: value } }))} />
          <Field id="biz-greeting" label="First message customers send you on WhatsApp" value={draft.business.whatsappGreeting} rows="3" onChange={(value) => patch((current) => ({ ...current, business: { ...current.business, whatsappGreeting: value } }))} />
        </section>
      )}

      {section === 'announcement' && draft.announcements.map((message, index) => (
        <Field key={index} id={`announce-${index}`} label={`Message ${index + 1}`} value={message} onChange={(value) => patch((current) => {
          const announcements = [...current.announcements]
          announcements[index] = value
          return { ...current, announcements }
        })} />
      ))}

      {section === 'banners' && (
        <section>
          {draft.slides.map((slide, index) => (
            <section className="cms-item" key={index}>
              <h3 className="font-medium mb-3">Banner {index + 1}</h3>
              <ItemActions
                index={index}
                length={draft.slides.length}
                onMove={(itemIndex, step) => patch((current) => ({ ...current, slides: moveItem(current.slides, itemIndex, step) }))}
                onRemove={(itemIndex) => patch((current) => ({ ...current, slides: current.slides.filter((_, i) => i !== itemIndex) }))}
              />
              <ImageField id={`slide-image-${index}`} label="Banner picture (computer and tablet)" hint="Wide picture, 2400 x 1000 px. JPG, PNG or WebP." folder="banners" value={slide.image} onChange={(value) => patch((current) => ({ ...current, slides: current.slides.map((item, i) => i === index ? { ...item, image: value } : item) }))} />
              <ImageField id={`slide-mobile-image-${index}`} label="Banner picture for phones (optional)" hint="Tall picture, 1080 x 1440 px. Leave empty to use the picture above." folder="banners" value={slide.mobileImage || ''} onChange={(value) => patch((current) => ({ ...current, slides: current.slides.map((item, i) => i === index ? { ...item, mobileImage: value } : item) }))} />
              <Field id={`slide-heading-${index}`} label="Heading" value={slide.heading} onChange={(value) => patch((current) => ({ ...current, slides: current.slides.map((item, i) => i === index ? { ...item, heading: value } : item) }))} />
              <Field id={`slide-text-${index}`} label="Text" value={slide.text} rows="3" onChange={(value) => patch((current) => ({ ...current, slides: current.slides.map((item, i) => i === index ? { ...item, text: value } : item) }))} />
              {slide.actions.map((action, actionIndex) => (
                <div className="grid sm:grid-cols-2 gap-4" key={actionIndex}>
                  <Field id={`slide-${index}-label-${actionIndex}`} label="Button label" value={action.label} onChange={(value) => patch((current) => ({
                    ...current,
                    slides: current.slides.map((item, i) => i === index ? { ...item, actions: item.actions.map((button, j) => j === actionIndex ? { ...button, label: value } : button) } : item),
                  }))} />
                  <Field id={`slide-${index}-to-${actionIndex}`} label="Where the button goes" hint="For example /shop or a product page address." value={action.to} onChange={(value) => patch((current) => ({
                    ...current,
                    slides: current.slides.map((item, i) => i === index ? { ...item, actions: item.actions.map((button, j) => j === actionIndex ? { ...button, to: value } : button) } : item),
                  }))} />
                </div>
              ))}
            </section>
          ))}
          {draft.slides.length < SITE_CONTENT_LIMITS.slides && (
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={() => patch((current) => ({
                ...current,
                slides: [...current.slides, { image: '', mobileImage: '', heading: 'New banner', text: '', actions: [{ label: 'Get this product', to: '/shop' }] }],
              }))}
            >
              Add banner
            </button>
          )}
        </section>
      )}

      {section === 'home' && (
        <section>
          <Field id="featured" label="Featured heading" value={draft.home.featuredHeading} onChange={(value) => patch((current) => ({ ...current, home: { ...current.home, featuredHeading: value } }))} />
          <Field id="view-all" label="View all label" value={draft.home.viewAllLabel} onChange={(value) => patch((current) => ({ ...current, home: { ...current.home, viewAllLabel: value } }))} />
          <Field id="brand-heading" label="Brand heading" value={draft.home.brandHeading} onChange={(value) => patch((current) => ({ ...current, home: { ...current.home, brandHeading: value } }))} />
          <h3 className="font-medium mb-3">Story circles (round pictures that open a photo or video)</h3>
          {draft.stories.map((item, index) => (
            <section className="cms-item" key={index}>
              <h4 className="font-medium mb-2">{item.label || `Story ${index + 1}`}</h4>
              <ItemActions
                index={index}
                length={draft.stories.length}
                onMove={(itemIndex, step) => patch((current) => ({ ...current, stories: moveItem(current.stories, itemIndex, step) }))}
                onRemove={(itemIndex) => patch((current) => ({ ...current, stories: current.stories.filter((_, i) => i !== itemIndex) }))}
              />
              <Field id={`story-circle-label-${index}`} label="Label" value={item.label} onChange={(value) => patch((current) => ({ ...current, stories: current.stories.map((card, i) => i === index ? { ...card, label: value } : card) }))} />
              <Field id={`story-circle-to-${index}`} label="Where it goes when tapped" value={item.to} onChange={(value) => patch((current) => ({ ...current, stories: current.stories.map((card, i) => i === index ? { ...card, to: value } : card) }))} />
              <div className="form-field">
                <label className="form-label" htmlFor={`story-type-${index}`}>What opens when tapped</label>
                <select
                  id={`story-type-${index}`}
                  className="form-input"
                  value={item.mediaType === 'video' ? 'video' : 'image'}
                  onChange={(event) => patch((current) => ({
                    ...current,
                    stories: current.stories.map((card, i) => i === index ? { ...card, mediaType: event.target.value } : card),
                  }))}
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </div>
              <ImageField id={`story-circle-image-${index}`} label="Small round picture" folder="stories" value={item.image} onChange={(value) => patch((current) => ({ ...current, stories: current.stories.map((card, i) => i === index ? { ...card, image: value } : card) }))} />
              {item.mediaType === 'video' ? (
                <ImageField id={`story-video-${index}`} label="Story video" folder="stories" kind="video" value={item.storyVideo} onChange={(value) => patch((current) => ({ ...current, stories: current.stories.map((card, i) => i === index ? { ...card, storyVideo: value } : card) }))} />
              ) : (
                <ImageField id={`story-photo-${index}`} label="Story photo" folder="stories" value={item.storyImage} onChange={(value) => patch((current) => ({ ...current, stories: current.stories.map((card, i) => i === index ? { ...card, storyImage: value } : card) }))} />
              )}
            </section>
          ))}
          {draft.stories.length < SITE_CONTENT_LIMITS.stories && (
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={() => patch((current) => ({
                ...current,
                stories: [...current.stories, { label: 'New story', to: '/shop', image: '', storyImage: '', mediaType: 'image', storyVideo: '' }],
              }))}
            >
              Add story
            </button>
          )}
          <h3 className="font-medium mb-3">Brand circles (links to each brand)</h3>
          {draft.brands.map((item, index) => (
            <section className="cms-item" key={index}>
              <h4 className="font-medium mb-2">{item.label || `Brand ${index + 1}`}</h4>
              <ItemActions
                index={index}
                length={draft.brands.length}
                onMove={(itemIndex, step) => patch((current) => ({ ...current, brands: moveItem(current.brands, itemIndex, step) }))}
                onRemove={(itemIndex) => patch((current) => ({ ...current, brands: current.brands.filter((_, i) => i !== itemIndex) }))}
              />
              <Field id={`brand-label-${index}`} label="Label" value={item.label} onChange={(value) => patch((current) => ({ ...current, brands: current.brands.map((card, i) => i === index ? { ...card, label: value } : card) }))} />
              <Field id={`brand-to-${index}`} label="Shop link" value={item.to} onChange={(value) => patch((current) => ({ ...current, brands: current.brands.map((card, i) => i === index ? { ...card, to: value } : card) }))} />
              <ImageField id={`brand-image-${index}`} label="Circle image" folder="brands" value={item.image} onChange={(value) => patch((current) => ({ ...current, brands: current.brands.map((card, i) => i === index ? { ...card, image: value } : card) }))} />
            </section>
          ))}
          {draft.brands.length < SITE_CONTENT_LIMITS.brands && (
            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={() => patch((current) => ({
                ...current,
                brands: [...current.brands, { label: 'New brand', to: '/shop', image: '' }],
              }))}
            >
              Add brand
            </button>
          )}
        </section>
      )}

      {section === 'story' && (
        <section>
          <ImageField id="story-image" label="Story image" folder="story" value={draft.story.image} onChange={(value) => patch((current) => ({ ...current, story: { ...current.story, image: value } }))} />
          <Field id="story-alt" label="Image description" value={draft.story.alt} onChange={(value) => patch((current) => ({ ...current, story: { ...current.story, alt: value } }))} />
          <Field id="story-heading" label="Heading" value={draft.story.heading} onChange={(value) => patch((current) => ({ ...current, story: { ...current.story, heading: value } }))} />
          <Field id="story-text" label="Text" value={draft.story.text} rows="4" onChange={(value) => patch((current) => ({ ...current, story: { ...current.story, text: value } }))} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field id="story-link-label" label="Link label" value={draft.story.linkLabel} onChange={(value) => patch((current) => ({ ...current, story: { ...current.story, linkLabel: value } }))} />
            <Field id="story-link" label="Link" value={draft.story.linkTo} onChange={(value) => patch((current) => ({ ...current, story: { ...current.story, linkTo: value } }))} />
          </div>
        </section>
      )}

      {section === 'watch' && (
        <section>
          <Field id="watch-heading" label="Heading" value={draft.watch.heading} onChange={(value) => patch((current) => ({ ...current, watch: { ...current.watch, heading: value } }))} />
          <Field id="watch-lead" label="Lead" value={draft.watch.lead} onChange={(value) => patch((current) => ({ ...current, watch: { ...current.watch, lead: value } }))} />
          {Object.entries(draft.watch.clips).map(([slug, clip]) => (
            <section className="cms-item" key={slug}>
              <h3 className="font-medium mb-3">{draft.products.find((product) => product.slug === slug)?.name || slug}</h3>
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                style={{ marginBottom: 12 }}
                onClick={() => patch((current) => {
                  const clips = { ...current.watch.clips }
                  delete clips[slug]
                  return { ...current, watch: { ...current.watch, clips } }
                })}
              >
                Remove video
              </button>
              <ImageField
                id={`clip-${slug}`}
                label="Video"
                folder="videos"
                kind="video"
                value={clip}
                onChange={(value) => patch((current) => {
                  const clips = { ...current.watch.clips }
                  if (value) clips[slug] = value
                  else delete clips[slug]
                  return { ...current, watch: { ...current.watch, clips } }
                })}
              />
            </section>
          ))}
          {draft.products.some((product) => !(product.slug in draft.watch.clips)) && (
            <div className="admin-image-tile-actions">
              <div className="form-field" style={{ margin: 0, minWidth: 220 }}>
                <label className="form-label" htmlFor="add-clip">Add a product video</label>
                <select id="add-clip" className="form-input" value={clipSlug} onChange={(event) => setClipSlug(event.target.value)}>
                  <option value="">Choose a product</option>
                  {draft.products.filter((product) => !(product.slug in draft.watch.clips)).map((product) => (
                    <option key={product.slug} value={product.slug}>{product.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                disabled={!clipSlug}
                onClick={() => {
                  const slug = clipSlug
                  setClipSlug('')
                  patch((current) => ({
                    ...current,
                    watch: { ...current.watch, clips: { ...current.watch.clips, [slug]: current.watch.clips[slug] || '' } },
                  }))
                }}
              >
                Add video
              </button>
            </div>
          )}
        </section>
      )}

      {section === 'reviews' && (
        <section>
          <Field id="reviews-heading" label="Heading" value={draft.reviews.heading} onChange={(value) => patch((current) => ({ ...current, reviews: { ...current.reviews, heading: value } }))} />
          {draft.reviews.items.map((item, index) => (
            <div key={index} className="grid gap-4 mb-4">
              <Field id={`review-text-${index}`} label={`Review ${index + 1}`} value={item.text} rows="2" onChange={(value) => patch((current) => ({ ...current, reviews: { ...current.reviews, items: current.reviews.items.map((review, i) => i === index ? { ...review, text: value } : review) } }))} />
              <div className="grid sm:grid-cols-2 gap-4">
                <Field id={`review-rating-${index}`} label="Stars" value={item.rating} onChange={(value) => patch((current) => ({ ...current, reviews: { ...current.reviews, items: current.reviews.items.map((review, i) => i === index ? { ...review, rating: value } : review) } }))} />
                <ImageField id={`review-image-${index}`} label="Image" folder="reviews" value={item.image} onChange={(value) => patch((current) => ({ ...current, reviews: { ...current.reviews, items: current.reviews.items.map((review, i) => i === index ? { ...review, image: value } : review) } }))} />
              </div>
            </div>
          ))}
        </section>
      )}

      {section === 'trust' && draft.trust.map((item, index) => (
        <Field key={index} id={`trust-${index}`} label={`Item ${index + 1}`} value={item} onChange={(value) => patch((current) => {
          const trust = [...current.trust]
          trust[index] = value
          return { ...current, trust }
        })} />
      ))}

      {section === 'about' && (
        <section>
          <Field id="about-title" label="Title" value={draft.about.title} onChange={(value) => patch((current) => ({ ...current, about: { ...current.about, title: value } }))} />
          <ImageField id="about-image" label="About photo" folder="about" value={draft.about.image} onChange={(value) => patch((current) => ({ ...current, about: { ...current.about, image: value } }))} />
          <Field id="about-alt" label="Image description" value={draft.about.alt} onChange={(value) => patch((current) => ({ ...current, about: { ...current.about, alt: value } }))} />
          {draft.about.paragraphs.map((paragraph, index) => (
            <Field key={index} id={`about-p-${index}`} label={`Paragraph ${index + 1}`} value={paragraph} rows="4" onChange={(value) => patch((current) => ({ ...current, about: { ...current.about, paragraphs: current.about.paragraphs.map((item, i) => i === index ? value : item) } }))} />
          ))}
        </section>
      )}

      {section === 'contact' && (
        <section>
          <Field id="contact-title" label="Page title" value={draft.contact.title} onChange={(value) => patch((current) => ({ ...current, contact: { ...current.contact, title: value } }))} />
          <Field id="contact-wa" label="WhatsApp link label" value={draft.contact.whatsappLabel} onChange={(value) => patch((current) => ({ ...current, contact: { ...current.contact, whatsappLabel: value } }))} />
        </section>
      )}

      {section === 'policies' && Object.entries(draft.policies).map(([key, page]) => (
        <section className="cms-item" key={key}>
          <Field id={`${key}-title`} label={`${page.title} title`} value={page.title} onChange={(value) => patch((current) => ({ ...current, policies: { ...current.policies, [key]: { ...current.policies[key], title: value } } }))} />
          <Field id={`${key}-body`} label="Text" value={page.body} rows="8" onChange={(value) => patch((current) => ({ ...current, policies: { ...current.policies, [key]: { ...current.policies[key], body: value } } }))} />
        </section>
      ))}

      {section === 'disclaimer' && (
        <Field id="disclaimer" label="Product disclaimer" value={draft.disclaimer} rows="8" onChange={(value) => patch((current) => ({ ...current, disclaimer: value }))} />
      )}

      {section === 'products' && (
        <>
        <p className="text-sm text-ink-soft">
          Upload a picture to replace the one visitors see. Remove it to show the catalog photo again. <Link to="/admin/products">Edit or archive a product</Link>
        </p>
        {draft.products.map((product, index) => (
        <section className="cms-item" key={product.slug}>
          <h3 className="font-medium mb-3">{product.name}</h3>
          <Field id={`${product.slug}-name`} label="Name" value={product.name} onChange={(value) => patch((current) => ({ ...current, products: current.products.map((item, i) => i === index ? { ...item, name: value } : item) }))} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field id={`${product.slug}-price`} label="Price (Rs)" value={product.price} onChange={(value) => patch((current) => ({ ...current, products: current.products.map((item, i) => i === index ? { ...item, price: value } : item) }))} />
            <Field id={`${product.slug}-compare`} label="Old price (crossed out)" hint="Leave empty if there is no sale." value={product.compareAt} onChange={(value) => patch((current) => ({ ...current, products: current.products.map((item, i) => i === index ? { ...item, compareAt: value } : item) }))} />
          </div>
          <Field id={`${product.slug}-tagline`} label="Tagline" value={product.tagline} onChange={(value) => patch((current) => ({ ...current, products: current.products.map((item, i) => i === index ? { ...item, tagline: value } : item) }))} />
          <Field id={`${product.slug}-description`} label="Description" value={product.description} rows="5" onChange={(value) => patch((current) => ({ ...current, products: current.products.map((item, i) => i === index ? { ...item, description: value } : item) }))} />
          <ImageField id={`${product.slug}-image`} label="Product picture" folder="products" value={product.image} onChange={(value) => patch((current) => ({ ...current, products: current.products.map((item, i) => i === index ? { ...item, image: value } : item) }))} />
        </section>
        ))}
        </>
      )}

        </div>

        <div className="cms-savebar">
          <span className={`cms-savebar-status${dirty ? ' is-dirty' : ''}`} role="status">
            {dirty ? 'You have unsaved changes.' : 'All changes saved.'}
          </span>
          <button type="submit" className="btn-lavender w-auto px-8" disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
        </div>
      </div>
    </form>
  )
}
