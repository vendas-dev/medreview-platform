'use client'
import Link from 'next/link'
import { Plus, Users, ShieldCheck, UserCheck } from 'lucide-react'

export function AdminHeader({ total, admins, ativos }: { total: number; admins: number; ativos: number }) {
  const stats = [
    { label: 'Total',       value: total,  Icon: Users,        color: '#3b82f6', grad: 'linear-gradient(135deg,#3b82f6,#4f46e5)' },
    { label: 'Superadmins', value: admins, Icon: ShieldCheck,  color: '#8b5cf6', grad: 'linear-gradient(135deg,#8b5cf6,#a855f7)' },
    { label: 'Ativos',      value: ativos, Icon: UserCheck,    color: '#22c55e', grad: 'linear-gradient(135deg,#22c55e,#16a34a)' },
  ]

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 24, padding: 'clamp(18px,2vw,26px)', borderRadius: 18, background: 'linear-gradient(135deg,rgba(79,70,229,0.07) 0%,rgba(124,58,237,0.04) 100%)', border: '1px solid rgba(99,102,241,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 999, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', display: 'inline-block', marginBottom: 8 }}>
              ⚙️ Administração
            </span>
            <h1 style={{ fontSize: 'clamp(18px,3vw,22px)', fontWeight: 800, color: 'var(--foreground)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Gestão de Usuários</h1>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Gerencie acessos e permissões da plataforma</p>
          </div>
          <Link href="/admin/users/edit?id=new"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 42, padding: '0 20px', borderRadius: 11, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 14px rgba(79,70,229,0.35)', transition: 'all 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(79,70,229,0.45)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(79,70,229,0.35)' }}>
            <Plus size={14} /> Novo usuário
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {stats.map(s => {
          const Icon = s.Icon
          return (
            <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 20px', position: 'relative', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.grad }} />
              <div style={{ width: 38, height: 38, borderRadius: 10, background: s.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, boxShadow: `0 4px 12px ${s.color}40` }}>
                <Icon size={17} style={{ color: '#fff' }} />
              </div>
              <p style={{ fontSize: 28, fontWeight: 800, color: 'var(--foreground)', margin: '0 0 3px', lineHeight: 1, letterSpacing: '-0.03em' }}>{s.value}</p>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{s.label}</p>
            </div>
          )
        })}
      </div>
    </>
  )
}
