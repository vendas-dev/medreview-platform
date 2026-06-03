'use client'
import { login } from './actions'
import { MedLogoSVG } from '@/components/MedLogo'

export function LoginForm({ isInvalid, isDeactivated }: { isInvalid: boolean; isDeactivated: boolean }) {
  const inputStyle: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 16px', borderRadius: 10,
    border: '1.5px solid var(--border)', background: 'var(--background)',
    color: 'var(--foreground)', fontSize: 14, outline: 'none',
    fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s',
  }
  const focus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--primary)'
    e.target.style.boxShadow = '0 0 0 3px rgba(61,61,61,0.12)'
  }
  const blur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--border)'
    e.target.style.boxShadow = 'none'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative', overflow: 'hidden' }}>
      {/* Fundo sutil */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%,-50%)', width: 700, height: 700, borderRadius: '50%', background: 'rgba(61,61,61,0.04)', filter: 'blur(80px)' }} />
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.025,
          backgroundImage: 'linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
      </div>

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', animation: 'fadeUp 0.35s ease both' }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--card)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <MedLogoSVG size={46} color="#3d3d3d" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', margin: 0, letterSpacing: '-0.02em' }}>MedReview</h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '4px 0 0' }}>Plataforma Operacional</p>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '28px 28px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px' }}>Entrar na conta</h2>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 0 24px' }}>Use suas credenciais de acesso</p>

          {isInvalid && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 20 }}>
              <span style={{ color: '#ef4444', fontSize: 13 }}>⚠ Email ou senha incorretos.</span>
            </div>
          )}
          {isDeactivated && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 20 }}>
              <span style={{ color: '#ef4444', fontSize: 13 }}>Conta desativada. Fale com o administrador.</span>
            </div>
          )}

          <form action={login} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Email</label>
              <input name="email" type="email" required autoComplete="email" placeholder="seu@email.com" style={inputStyle} onFocus={focus} onBlur={blur} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Senha</label>
              <input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" style={inputStyle} onFocus={focus} onBlur={blur} />
            </div>
            <button type="submit" className="hover-opacity"
              style={{ height: 44, borderRadius: 10, background: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginTop: 4, transition: 'opacity 0.15s', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              Entrar
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted-foreground)', marginTop: 20 }}>
          Problemas de acesso? Fale com o administrador.
        </p>
      </div>

      <style>{`.hover-opacity:hover { opacity: 0.85 !important; }`}</style>
    </div>
  )
}
