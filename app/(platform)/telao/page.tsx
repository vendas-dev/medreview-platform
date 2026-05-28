import { ModuleFrame } from '@/components/modules/ModuleFrame'

export default function TelaoPage() {
  return (
    <div className="h-[calc(100vh-0px)] lg:h-screen flex flex-col">
      <ModuleFrame
        url="https://telao-medreview.lovable.app"
        title="Telão ao Vivo"
      />
    </div>
  )
}
