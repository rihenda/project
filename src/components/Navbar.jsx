export default function Navbar() {
  return (
    <nav className="w-full bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="HostnFly" className="h-8 w-auto" />
      </div>

      {/* Right side — placeholder for future nav items */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500 font-medium">Finance Tool</span>
        <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-semibold">
          FT
        </div>
      </div>
    </nav>
  )
}
