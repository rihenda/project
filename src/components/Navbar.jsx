import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/fournisseurs', label: 'Fournisseurs' },
]

export default function Navbar() {
  return (
    <nav className="w-full bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-8">
        <img src="/logo.png" alt="HostnFly" className="h-8 w-auto" />

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#2563EB]/10 text-[#2563EB]'
                    : 'text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-400 font-medium">Finance Tool</span>
        <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-semibold">
          FT
        </div>
      </div>
    </nav>
  )
}
