'use client'
import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from '@/components/shell/Sidebar'
import { MobileDrawer } from '@/components/shell/MobileDrawer'
import { ThemeProvider } from '@/components/ThemeProvider'
import { MedLogoSVG } from '@/components/MedLogo'

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <ThemeProvider>
      <div style={{ display: 'flex', height: '100vh', background: 'var(--background)', overflow: 'hidden' }}>
        <div className="lg-flex" style={{ display: 'none' }}>
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
        </div>
        <div className="lg-hidden">
          <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <header className="mobile-topbar" style={{ height: 56, borderBottom: '1px solid var(--border)', background: 'var(--card)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
            <button onClick={() => setDrawerOpen(true)} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
              <Menu size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MedLogoSVG size={22} color="#3d3d3d" />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>MedReview</span>
            </div>
          </header>
          <main style={{ flex: 1, overflowY: 'auto' }}>{children}</main>
        </div>
      </div>
      <style>{`
        @media (min-width: 1024px) {
          .lg-flex { display: flex !important; }
          .mobile-topbar { display: none !important; }
        }
        @media (max-width: 1023px) {
          .lg-hidden { display: block; }
        }
      `}</style>
    </ThemeProvider>
  )
}
