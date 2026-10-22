import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { AdminToastProvider } from '../../context/admin/AdminToastContext'
import { useSeo } from '../../hooks/useSeo'
import '../../admin-theme.css'

/**
 * Sidebar groups are always visible so people can see everything at a glance.
 * Only the rarely used "More tools" group collapses (and opens by itself when
 * you are on one of its pages).
 */
const NAV_SECTIONS = [
  {
    id: 'home',
    label: null,
    items: [{ to: '/admin', label: 'Dashboard', end: true, icon: 'home' }],
  },
  {
    id: 'sell',
    label: 'Sell',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: 'orders' },
      { to: '/admin/customers', label: 'Customers', icon: 'customers' },
      { to: '/admin/shipments', label: 'Shipments', icon: 'shipments' },
      { to: '/admin/returns', label: 'Returns', icon: 'returns' },
      { to: '/admin/payments', label: 'Payments', icon: 'payments' },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    items: [
      { to: '/admin/products', label: 'Products', icon: 'products' },
      { to: '/admin/catalog', label: 'Brands & categories', icon: 'tag' },
      { to: '/admin/inventory', label: 'Stock levels', icon: 'stock' },
      { to: '/admin/reviews', label: 'Customer reviews', icon: 'star' },
    ],
  },
  {
    id: 'website',
    label: 'Website',
    items: [
      { to: '/admin/content', label: 'Website content', icon: 'content' },
      { to: '/admin/promotions', label: 'Offers & coupons', icon: 'offer' },
    ],
  },
  {
    id: 'more',
    label: 'More tools',
    collapsible: true,
    items: [
      { to: '/admin/reports', label: 'Reports', icon: 'reports' },
      { to: '/admin/erp', label: 'Accounting sync', icon: 'sync' },
      { to: '/admin/audit-log', label: 'Activity log', icon: 'log' },
      { to: '/admin/settings', label: 'Settings', icon: 'settings' },
    ],
  },
]

const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  orders: 'M6 3h12l1 5H5l1-5zM5 8h14v13H5zM9 12h6',
  customers: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  shipments: 'M2 7h12v9H2zM14 10h4l3 3v3h-7zM6 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  returns: 'M4 9h11a5 5 0 0 1 0 10H8M4 9l4-4M4 9l4 4',
  payments: 'M3 6h18v12H3zM3 10h18M7 15h3',
  products: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
  stock: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  content: 'M4 4h16v16H4zM4 9h16M9 9v11',
  offer: 'M20 12l-8 8-9-9V3h8zM7.5 7.5h.01',
  reports: 'M4 20h16M7 16V9M12 16V5M17 16v-4',
  sync: 'M4 12a8 8 0 0 1 14-5l2 2M20 4v5h-5M20 12a8 8 0 0 1-14 5l-2-2M4 20v-5h5',
  log: 'M6 3h9l3 3v15H6zM9 11h6M9 15h6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-4-2 .5-1.5-1-.5-2.5h-4l-.5 2.5-1.5 1L7 7 5 11l2 1v1l-2 1 2 4 2-.5 1.5 1 .5 2.5h4l.5-2.5 1.5-1 2 .5 2-4-2-1z',
}

function NavIcon({ name }) {
  return (
    <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] || ICONS.home} />
    </svg>
  )
}

function sectionOwnsPath(section, pathname) {
  return section.items.some((item) => {
    if (item.end) return pathname === item.to
    return pathname === item.to || pathname.startsWith(`${item.to}/`)
  })
}

const MORE_SECTION = NAV_SECTIONS.find((section) => section.collapsible)

export default function AdminLayout() {
  const { logout, session, configured } = useAuth()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(() => sectionOwnsPath(MORE_SECTION, pathname))
  const [menuOpen, setMenuOpen] = useState(false)

  useSeo({ title: 'Admin | iDermaCare', noindex: true })

  useEffect(() => {
    setMenuOpen(false)
    if (sectionOwnsPath(MORE_SECTION, pathname)) setMoreOpen(true)
  }, [pathname])

  return (
    <AdminToastProvider>
      <div className={`admin-shell${menuOpen ? ' is-menu-open' : ''}`}>
        <aside className="admin-sidebar">
          <div className="admin-sidebar-top">
            <Link to="/admin" className="admin-brand">
              <span className="admin-brand-mark">i</span>
              <span>
                iDermaCare
                <small>Store admin</small>
              </span>
            </Link>
            <button type="button" className="admin-menu-toggle" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
              {menuOpen ? 'Close' : 'Menu'}
            </button>
          </div>
          {!configured ? (
            <p className="admin-sidebar-email" style={{ margin: '0 20px 0.75rem' }}>
              UI preview (no Supabase)
            </p>
          ) : null}
          <nav className="admin-nav" aria-label="Admin">
            {NAV_SECTIONS.map((section) => {
              const open = !section.collapsible || moreOpen
              return (
                <div key={section.id} className="admin-nav-section">
                  {section.label ? (
                    section.collapsible ? (
                      <button type="button" className="admin-nav-section-toggle" aria-expanded={open} onClick={() => setMoreOpen((value) => !value)}>
                        <span>{section.label}</span>
                        <span className="admin-nav-section-chevron" aria-hidden="true">{open ? '−' : '+'}</span>
                      </button>
                    ) : (
                      <p className="admin-nav-section-label">{section.label}</p>
                    )
                  ) : null}
                  {open ? (
                    <div className="admin-nav-section-links">
                      {section.items.map((item) => (
                        <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                          <NavIcon name={item.icon} />
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </nav>
          <div className="admin-sidebar-footer">
            <p className="admin-sidebar-email">{session?.user?.email || (configured ? '' : 'local preview')}</p>
            <Link to="/" className="admin-sidebar-link" target="_blank" rel="noopener">
              View website ↗
            </Link>
            {configured ? (
              <button type="button" className="admin-sidebar-link admin-sidebar-signout" onClick={logout}>
                Sign out
              </button>
            ) : null}
          </div>
        </aside>
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </AdminToastProvider>
  )
}
