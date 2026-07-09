'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MedLogoSVG } from '@/components/MedLogo'

export function ForgotPasswordForm() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 46, padding: '0 16px', borderRadius: 12,
    border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)',
    color: '#f1f5f9', fontSize: 14, outline: 'none',
    fontFamily: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      })
      if (error) throw error
      setSent(true)
    } catch (err: any) {
      // Mensagem genérica de propósito — não revela se o e-mail existe ou não na base.
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative', overflow: 'hidden' }}>

      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'url(/login-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }} />

      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, rgba(10,14,26,0.75) 0%, rgba(8,12,22,0.55) 50%, rgba(10,14,26,0.75) 100%)',
        backdropFilter: 'blur(1px)',
      }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', animation: 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
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

        <div style={{
          background: 'rgba(15,20,40,0.7)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 24, padding: '32px',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}>
          {!sent ? (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: '0 0 6px' }}>Esqueci minha senha</h2>
              <p style={{ fontSize: 13, color: 'rgba(241,245,249,0.5)', margin: '0 0 28px' }}>Enviaremos um link de redefinição para o seu e-mail</p>

              {error && (
                <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 20 }}>
                  <span style={{ color: '#fca5a5', fontSize: 13, fontWeight: 500 }}>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(241,245,249,0.8)' }}>Email</label>
                  <input name="email" type="email" required autoComplete="email" placeholder="seu@email.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.boxShadow = 'none' }} />
                </div>
                <button type="submit" disabled={loading}
                  style={{
                    height: 48, borderRadius: 13, fontSize: 15, fontWeight: 700,
                    border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    marginTop: 4, transition: 'all 0.18s',
                    background: loading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#ffffff',
                    boxShadow: '0 4px 20px rgba(99,102,241,0.4), 0 1px 4px rgba(0,0,0,0.3)',
                    letterSpacing: '-0.01em',
                  }}>
                  {loading ? 'Enviando...' : 'Enviar link de redefinição'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 6l8 6 8-6M4 6v12h16V6M4 6h16" stroke="#a5b4fc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px' }}>Verifique seu e-mail</h2>
              <p style={{ fontSize: 13, color: 'rgba(241,245,249,0.55)', margin: 0, lineHeight: 1.5 }}>
                Se <strong style={{ color: 'rgba(241,245,249,0.8)' }}>{email}</strong> estiver cadastrado, você vai receber um link para redefinir sua senha em alguns instantes.
              </p>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, marginTop: 20 }}>
          <Link href="/login" style={{ color: 'rgba(241,245,249,0.55)', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(241,245,249,0.85)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(241,245,249,0.55)'}>
            ← Voltar para o login
          </Link>
        </p>
      </div>

      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }`}</style>
    </div>
  )
}
