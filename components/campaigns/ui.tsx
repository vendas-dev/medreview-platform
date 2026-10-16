'use client'
import * as React from 'react'

// ══ Peças visuais das Campanhas (lista, cadastro, detalhe) ═══════════════════════
// Um só conjunto de botões, campos e controles, pra tudo ter o mesmo tamanho, o mesmo respiro e o mesmo foco.
// Escala de espaços: 4 · 8 · 12 · 16 · 20 · 24 · 28. Altura dos campos: 44. Dos botões: 40 (34 pequeno, 44 grande).

export const CAMPAIGN_CSS = `
.cp-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 16px;border-radius:12px;border:1px solid var(--border);background:var(--card);color:var(--foreground);font-family:inherit;font-size:13px;font-weight:700;line-height:1;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s,box-shadow .15s,transform .06s,opacity .15s}
.cp-btn:hover:not(:disabled){background:var(--secondary)}
.cp-btn:active:not(:disabled){transform:translateY(1px)}
.cp-btn:disabled{opacity:.5;cursor:not-allowed}
.cp-btn--sm{height:34px;padding:0 12px;font-size:12px;border-radius:10px}
.cp-btn--lg{height:44px;padding:0 22px;font-size:14px}
.cp-btn--full{width:100%}
.cp-btn--primary{border:none;color:#fff;background:linear-gradient(135deg,#6366f1,#8b5cf6);box-shadow:0 6px 16px rgba(99,102,241,.32)}
.cp-btn--primary:hover:not(:disabled){background:linear-gradient(135deg,#5558e8,#7c4ee8);box-shadow:0 8px 22px rgba(99,102,241,.42)}
.cp-btn--ghost{background:transparent;border-color:transparent;color:var(--muted-foreground)}
.cp-btn--ghost:hover:not(:disabled){background:var(--secondary);color:var(--foreground)}
.cp-btn--danger{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.32);color:#dc2626}
.cp-btn--danger:hover:not(:disabled){background:rgba(239,68,68,.16)}
.cp-btn--dangersolid{border:none;background:#ef4444;color:#fff}
.cp-btn--dangersolid:hover:not(:disabled){background:#dc2626}

.cp-ib{position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;border:1px solid var(--border);background:var(--card);color:var(--muted-foreground);cursor:pointer;transition:background .15s,color .15s,border-color .15s}
.cp-ib:hover{background:var(--secondary);color:var(--foreground)}
.cp-ib--danger:hover{background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.4);color:#dc2626}
.cp-ib[data-tip]::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%) translateY(4px);padding:5px 9px;border-radius:8px;background:var(--foreground);color:var(--background);font-size:11px;font-weight:700;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .15s,transform .15s;z-index:20}
.cp-ib[data-tip]:hover::after,.cp-ib[data-tip]:focus-visible::after{opacity:1;transform:translateX(-50%) translateY(0)}
.cp-ib--end[data-tip]::after{left:auto;right:0;transform:translateY(4px)}
.cp-ib--end[data-tip]:hover::after,.cp-ib--end[data-tip]:focus-visible::after{transform:translateY(0)}

.cp-btn:focus-visible,.cp-ib:focus-visible,.cp-opt:focus-visible,.cp-seg button:focus-visible,.cp-tab:focus-visible,.cp-link:focus-visible{outline:2px solid #6366f1;outline-offset:2px}

.cp-field{width:100%;height:44px;padding:0 14px;border-radius:12px;border:1px solid var(--border);background:var(--card);color:var(--foreground);font-family:inherit;font-size:14px;box-sizing:border-box;transition:border-color .15s,box-shadow .15s}
.cp-field:hover:not(:disabled){border-color:color-mix(in srgb,var(--foreground) 24%,var(--border))}
.cp-field:focus{outline:none;border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.18)}
.cp-field::placeholder{color:var(--muted-foreground);opacity:.7}
.cp-field:disabled{opacity:.55}

.cp-opt{position:relative;text-align:left;border:1.5px solid var(--border);background:var(--card);color:var(--muted-foreground);border-radius:14px;cursor:pointer;font-family:inherit;transition:border-color .15s,background .15s,box-shadow .15s}
.cp-opt:hover{border-color:color-mix(in srgb,#6366f1 45%,var(--border));background:color-mix(in srgb,#6366f1 4%,var(--card))}
.cp-opt[aria-pressed=true]{border-color:#6366f1;background:rgba(99,102,241,.1);color:var(--foreground);box-shadow:0 0 0 3px rgba(99,102,241,.12)}

.cp-seg{display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:14px;background:var(--secondary);border:1px solid var(--border)}
.cp-seg button{flex:1 1 auto;text-align:center;height:38px;padding:0 18px;border-radius:10px;border:none;background:transparent;color:var(--muted-foreground);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s,color .15s,box-shadow .15s}
.cp-seg button:hover{color:var(--foreground)}
.cp-seg button[aria-pressed=true]{background:var(--card);color:var(--foreground);box-shadow:0 1px 3px rgba(0,0,0,.14),0 0 0 1px rgba(99,102,241,.4)}

.cp-tabs{display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:14px;background:var(--secondary);border:1px solid var(--border)}
.cp-tab{height:34px;padding:0 14px;border-radius:10px;border:none;background:transparent;color:var(--muted-foreground);font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:0;transition:background .15s,color .15s}
.cp-tab:hover{color:var(--foreground)}
.cp-tab[aria-pressed=true]{background:var(--card);color:var(--foreground);box-shadow:0 1px 3px rgba(0,0,0,.14)}
.cp-tab b{margin-left:4px;font-weight:800;font-size:11px;padding:1px 7px;border-radius:999px;background:var(--border);color:var(--muted-foreground)}
.cp-tab[aria-pressed=true] b{background:rgba(99,102,241,.16);color:#6366f1}

.cp-link{border:none;background:transparent;padding:4px 6px;margin:-4px -6px;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;color:var(--muted-foreground);transition:color .15s,background .15s}
.cp-link:hover{color:#dc2626;background:rgba(239,68,68,.08)}

.cp-card{display:flex;flex-direction:column;overflow:hidden;border-radius:20px;background:var(--card);border:1px solid var(--border);transition:transform .18s,box-shadow .18s,border-color .18s}
.cp-card:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(0,0,0,.12);border-color:color-mix(in srgb,#6366f1 30%,var(--border))}

.cb-overlay{position:fixed;inset:0;z-index:200;background:rgba(8,6,20,.62);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:clamp(0px,2vw,28px)}
.cb-modal{width:min(1280px,100%);height:min(920px,100%);display:flex;flex-direction:column;overflow:hidden;background:var(--background);border:1px solid var(--border);border-radius:24px;box-shadow:0 30px 90px rgba(0,0,0,.45)}
.cb-head{flex:none;display:flex;align-items:center;gap:24px;padding:18px 28px;border-bottom:1px solid var(--border);background:var(--card)}
.cb-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(380px,470px)}
.cb-main{min-width:0;overflow-y:auto;padding:28px;display:flex;flex-direction:column;gap:24px;scroll-behavior:smooth}
.cb-aside{min-width:0;overflow-y:auto;padding:28px;background:var(--secondary);border-left:1px solid var(--border)}
.cb-foot{flex:none;display:flex;align-items:center;gap:20px;padding:16px 28px;border-top:1px solid var(--border);background:var(--card)}
.cb-foot-actions{display:flex;align-items:center;gap:10px;flex:none}
.cb-main::-webkit-scrollbar,.cb-aside::-webkit-scrollbar{width:10px}
.cb-main::-webkit-scrollbar-thumb,.cb-aside::-webkit-scrollbar-thumb{background:var(--border);border-radius:999px;border:3px solid transparent;background-clip:content-box}

.cb-sec{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:24px 26px;scroll-margin-top:4px}
.cb-sec-head{display:flex;align-items:flex-start;gap:14px;margin-bottom:22px}
.cb-badge{flex:none;width:30px;height:30px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;transition:background .2s}
.cb-sec[data-done="1"] .cb-badge{background:linear-gradient(135deg,#22c55e,#16a34a)}
.cb-sec-head h3{margin:0;font-size:16px;font-weight:800;color:var(--foreground);letter-spacing:-.01em}
.cb-sec-head p{margin:4px 0 0;font-size:12.5px;line-height:1.45;color:var(--muted-foreground)}
.cb-sec-body{display:flex;flex-direction:column;gap:22px}
.cb-field{display:flex;flex-direction:column;gap:8px;min-width:0}
.cb-label{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted-foreground)}
.cb-divider{height:1px;background:var(--border);margin:2px 0}
.cb-sub{margin:0;font-size:11px;font-weight:900;letter-spacing:.12em;color:var(--muted-foreground)}
.cb-card-in{padding:20px;border-radius:16px;background:var(--secondary);border:1px solid var(--border);display:flex;flex-direction:column;gap:16px}
.cb-check{display:flex;gap:14px;align-items:flex-start;padding:16px 18px;border-radius:14px;border:1px solid var(--border);background:var(--background);cursor:pointer;transition:border-color .15s,background .15s}
.cb-check:hover{border-color:color-mix(in srgb,#6366f1 40%,var(--border))}
.cb-check input{margin-top:3px;width:16px;height:16px;accent-color:#6366f1;flex:none}
.cb-check strong{display:block;font-size:13.5px;color:var(--foreground)}
.cb-check span span{display:block;margin-top:3px;font-size:12px;line-height:1.45;color:var(--muted-foreground)}
.cb-steps{flex:1;display:flex;align-items:center;gap:6px;min-width:0}
.cb-step{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px 0 6px;border-radius:999px;border:1px solid var(--border);background:var(--background);color:var(--muted-foreground);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .15s}
.cb-step:hover{color:var(--foreground);border-color:color-mix(in srgb,#6366f1 40%,var(--border))}
.cb-step i{font-style:normal;width:22px;height:22px;border-radius:50%;background:var(--border);color:var(--muted-foreground);font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;transition:all .2s}
.cb-step[data-done="1"]{color:var(--foreground)}
.cb-step[data-done="1"] i{background:#22c55e;color:#fff}

@media (max-width:1180px){.cb-steps .cb-step span{display:none}.cb-step{padding:0 6px}}
@media (max-width:980px){
  .cb-overlay{padding:0}
  .cb-modal{height:100%;border-radius:0;border:none}
  .cb-body{display:block;overflow-y:auto}
  .cb-main,.cb-aside{overflow:visible}
  .cb-main{padding:18px 16px;gap:18px}
  .cb-aside{padding:20px 16px 28px;border-left:none;border-top:1px solid var(--border)}
  .cb-head{padding:14px 16px;gap:12px}
  .cb-steps{display:none}
  .cb-sec{padding:20px 18px}
  .cb-foot{flex-wrap:wrap;padding:12px 16px;gap:12px}
  .cb-foot > [data-errors]{flex-basis:100%}
  .cb-foot{gap:10px}
  .cb-foot-actions{width:100%;gap:10px}
  .cb-foot-actions .cp-btn{flex:1 1 0;min-width:0;padding:0 10px}
  .cb-foot-actions .cb-cancel{display:none}
  .cb-long{display:none}
}
@media (prefers-reduced-motion:reduce){.cp-card,.cp-btn,.cb-main{transition:none;scroll-behavior:auto}}
`

export function CampaignStyles() { return <style>{CAMPAIGN_CSS}</style> }

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangersolid'; size?: 'sm' | 'md' | 'lg'; full?: boolean }
/** Botão padrão das campanhas. */
export function Btn({ variant = 'secondary', size = 'md', full, className = '', type = 'button', children, ...rest }: BtnProps) {
  return <button type={type} {...rest} className={`cp-btn cp-btn--${variant}${size !== 'md' ? ` cp-btn--${size}` : ''}${full ? ' cp-btn--full' : ''} ${className}`.trim()}>{children}</button>
}
/** Botão só de ícone, com legenda ao passar o mouse (e pro leitor de tela). `end` alinha a legenda à direita (último da fila). */
export function IconBtn({ tip, danger, end, className = '', type = 'button', children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tip: string; danger?: boolean; end?: boolean }) {
  return <button type={type} aria-label={tip} data-tip={tip} {...rest} className={`cp-ib${danger ? ' cp-ib--danger' : ''}${end ? ' cp-ib--end' : ''} ${className}`.trim()}>{children}</button>
}
