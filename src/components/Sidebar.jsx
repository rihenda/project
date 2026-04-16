import { NavLink } from 'react-router-dom'

const NAV = [
  {
    to: '/fournisseurs',
    label: 'Fournisseurs',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    to: '/factures',
    label: 'Factures',
    icon: (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-[#0C0F14] flex flex-col border-r border-white/[0.06]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/[0.06]">
        <img src="/logo.png" alt="HostnFly" className="h-5 w-auto brightness-0 invert opacity-90" />
        <div className="w-px h-3.5 bg-white/[0.12]" />
        <span className="text-[10.5px] font-bold tracking-[0.12em] text-white/25 uppercase">Finance</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] font-medium transition-all duration-100 ${
                isActive
                  ? 'bg-white/[0.09] text-white'
                  : 'text-white/35 hover:text-white/65 hover:bg-white/[0.05]'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-2.5 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-default">
          <div className="w-6 h-6 rounded-full bg-[#2563EB] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
            FT
          </div>
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold text-white/60 truncate leading-tight">Finance Team</p>
            <p className="text-[10.5px] text-white/20 truncate">HostnFly</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
