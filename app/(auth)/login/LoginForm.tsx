'use client'
import { login } from './actions'
import { MedLogoSVG } from '@/components/MedLogo'

export function LoginForm({ isInvalid, isDeactivated }: { isInvalid: boolean; isDeactivated: boolean }) {
  const inputStyle: React.CSSProperties = {
    width: '100%', height: 46, padding: '0 16px', borderRadius: 12,
    border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)',
    color: '#f1f5f9', fontSize: 14, outline: 'none',
    fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative', overflow: 'hidden' }}>

      {/* Imagem de fundo */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/login-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }} />

      {/* Overlay para legibilidade */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, rgba(10,14,26,0.75) 0%, rgba(8,12,22,0.55) 50%, rgba(10,14,26,0.75) 100%)',
        backdropFilter: 'blur(1px)',
      }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            backdropFilter: 'blur(16px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}>
            <MedLogoSVG size={52} color="#e2e8f0" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', margin: '0 0 6px', textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>Med-Review</h1>
          <p style={{ fontSize: 14, color: 'rgba(241,245,249,0.6)', margin: 0 }}>Plataforma Operacional</p>
        </div>

        {/* Card glassmorphism */}
        <div style={{
          background: 'rgba(15,20,40,0.7)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 24, padding: '32px',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px' }}>Entrar na conta</h2>
          <p style={{ fontSize: 13, color: 'rgba(241,245,249,0.5)', margin: '0 0 28px' }}>Use suas credenciais de acesso</p>

          {isInvalid && (
            <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 20 }}>
              <span style={{ color: '#fca5a5', fontSize: 13, fontWeight: 500 }}>⚠ Email ou senha incorretos.</span>
            </div>
          )}
          {isDeactivated && (
            <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 20 }}>
              <span style={{ color: '#fca5a5', fontSize: 13, fontWeight: 500 }}>Conta desativada. Fale com o administrador.</span>
            </div>
          )}

          <form action={login} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(241,245,249,0.8)' }}>Email</label>
              <input name="email" type="email" required autoComplete="email" placeholder="seu@email.com"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.boxShadow = 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(241,245,249,0.8)' }}>Senha</label>
              <input name="password" type="password" required autoComplete="current-password" placeholder="••••••••"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.boxShadow = 'none' }} />
            </div>
            <button type="submit"
              style={{
                height: 48, borderRadius: 13, fontSize: 15, fontWeight: 700,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                marginTop: 4, transition: 'all 0.18s',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 20px rgba(99,102,241,0.4), 0 1px 4px rgba(0,0,0,0.3)',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,0.5), 0 2px 8px rgba(0,0,0,0.3)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.4), 0 1px 4px rgba(0,0,0,0.3)'
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            >
              Entrar
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(241,245,249,0.35)', marginTop: 20 }}>
          Problemas de acesso? Fale com o administrador.
        </p>
      </div>

      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }`}</style>
    </div>
  )
}
