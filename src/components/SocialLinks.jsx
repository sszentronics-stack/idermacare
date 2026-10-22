export const SOCIAL_LINKS = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/idermacare.pk/',
    path: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm5.5-2.2a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z',
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/idermacare.pk',
    path: 'M14 8h3V4h-3a4 4 0 0 0-4 4v2H7v4h3v7h4v-7h3l1-4h-4V8z',
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@idermacare.pk',
    path: 'M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.3 2.6 2 4.4 5 4.6',
  },
]

const BRAND_BADGE = {
  Instagram: (
    <>
      <defs>
        <radialGradient id="ssz-ig" cx="30%" cy="107%" r="140%">
          <stop offset="0" stopColor="#FED576" />
          <stop offset="0.26" stopColor="#F47133" />
          <stop offset="0.61" stopColor="#BC3081" />
          <stop offset="1" stopColor="#4C63D2" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ssz-ig)" />
    </>
  ),
  Facebook: <rect width="24" height="24" rx="6" fill="#1877F2" />,
  TikTok: <rect width="24" height="24" rx="6" fill="#000" />,
}

function SocialGlyph({ link }) {
  if (link.label === 'TikTok') {
    return (
      <>
        <path d={link.path} transform="translate(-0.7 -0.5)" stroke="#25F4EE" />
        <path d={link.path} transform="translate(0.7 0.5)" stroke="#FE2C55" />
        <path d={link.path} stroke="#fff" />
      </>
    )
  }
  if (link.label === 'Facebook') return <path d={link.path} fill="#fff" stroke="none" />
  return <path d={link.path} stroke="#fff" />
}

export default function SocialLinks({ className = '' }) {
  return (
    <div className={`ssz-social ${className}`.trim()}>
      {SOCIAL_LINKS.map((link) => (
        <a key={link.label} className="ssz-social__link" href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label} title={link.label}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {BRAND_BADGE[link.label]}
            <SocialGlyph link={link} />
          </svg>
        </a>
      ))}
    </div>
  )
}
