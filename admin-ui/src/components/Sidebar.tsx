import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, ShieldAlert, ScrollText, ShieldCheck, FolderGit2, Users, LogOut, Menu, X } from 'lucide-react';

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsOpen(false);
  };

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/scans', label: 'Scans', icon: ShieldAlert },
    { to: '/projects', label: 'Projects', icon: FolderGit2 },
    { to: '/audit-log', label: 'Audit Log', icon: ScrollText },
    { to: '/armoriq', label: 'ArmorIQ', icon: ShieldCheck },
  ];

  if (user?.role === 'admin') {
    navLinks.push({ to: '/users', label: 'Users', icon: Users });
  }

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#0F172A] flex items-center justify-between px-4 border-b border-slate-800 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 flex items-center justify-center">
            <img src="/codearmor.png" alt="" className="w-full h-full object-contain" />
          </div>
          <span className="text-white font-semibold text-sm">CodeArmor</span>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
      </header>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-40 flex flex-col w-60 bg-[#0F172A] select-none
        transition-transform duration-200 ease-in-out
        md:translate-x-0 md:static md:min-h-screen md:shrink-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center">
              <img src="/codearmor.png" alt="CodeArmor" className="w-full h-full object-contain" />
            </div>
            <span className="text-white font-semibold text-base">CodeArmor</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-armor-primary text-white'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-md bg-armor-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.username?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-slate-200 text-xs font-medium truncate leading-tight">{user?.username ?? 'User'}</p>
              <p className="text-slate-500 text-[10px] font-medium uppercase tracking-wider mt-0.5">{user?.role ?? 'User'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-red-400 transition-colors py-2 px-3 rounded-md hover:bg-slate-800/60"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
