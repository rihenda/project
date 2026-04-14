import { NavLink } from 'react-router-dom'

const NAV = [
  {
    to: '/fournisseurs',
    label: 'Fournisseurs',
    icon: (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    to: '/factures',
    label: 'Factures',
    icon: (
      <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[224px] bg-[#0F172A] flex flex-col z-40 select-none">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <img src="/logo.png" alt="HostnFly" className="h-7 w-auto brightness-0 invert opacity-90" />
        <span className="mt-2 block text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-500">
          Finance
        </span>
      </div>

      <div className="mx-4 h-px bg-white/[0.07]" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-[#2563EB] text-white shadow-[0_2px_12px_rgba(37,99,235,0.4)]'
                  : 'text-slate-400 hover:bg-white/[0.07] hover:text-white'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="mx-4 h-px bg-white/[0.07]" />
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.05] transition-colors cursor-default">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#1B2659] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
            FT
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-200 truncate leading-tight">Finance Team</p>
            <p className="text-[11px] text-slate-500 truncate">HostnFly</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
