'use client'
import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from '@/components/shell/Sidebar'
import { MobileDrawer } from '@/components/shell/MobileDrawer'
import { ThemeProvider } from '@/components/ThemeProvider'
import { MedLogoSVG } from '@/components/MedLogo'


export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <ThemeProvider>
      <div style={{ display: 'flex', height: '100vh', background: 'var(--background)', overflow: 'hidden' }}>
        {/* Sidebar desktop */}
        {!isMobile && (
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
        )}

        {/* Drawer mobile */}
        {isMobile && (
          <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {/* Topbar mobile */}
          {isMobile && (
            <header style={{ height: 56, borderBottom: '1px solid var(--border)', background: 'var(--card)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
              <button onClick={() => setDrawerOpen(true)}
                style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
                <Menu size={20} />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MedLogoSVG size={22} color="#3d3d3d" />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>MedReview</span>
              </div>
            </header>
          )}
          <main style={{ flex: 1, overflowY: 'auto' }}>{children}</main>
        </div>
      </div>
    </ThemeProvider>
  )
}
