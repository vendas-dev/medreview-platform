import { ModuleFrame } from '@/components/modules/ModuleFrame'

export default function DisparosPage() {
  return (
    <div className="h-[calc(100vh-56px)] lg:h-screen flex flex-col">
      <ModuleFrame
        url="https://med-review-disparos.lovable.app"
        title="Dashboard de Disparos"
      />
    </div>
  )
}
