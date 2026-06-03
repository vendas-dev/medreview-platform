'use client'
import { createContext, useContext, useEffect, useState } from 'react'
type Theme = 'light' | 'dark' | 'system'
const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({ theme: 'dark', setTheme: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  useEffect(() => {
    const stored = (localStorage.getItem('mr-theme') as Theme) || 'dark'
    setThemeState(stored)
    document.documentElement.classList.toggle('dark', stored === 'dark' || (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches))
  }, [])
  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem('mr-theme', t)
    document.documentElement.classList.toggle('dark', t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches))
  }
  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>
}
export const useTheme = () => useContext(Ctx)
