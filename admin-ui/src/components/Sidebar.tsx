import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LayoutDashboard, Shield, ShieldAlert, FolderGit2, ScrollText, Settings, LogOut, Menu, X, ShieldCheck } from 'lucide-react';

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
    { to: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
    { to: '/scans',      label: 'Threats',    icon: ShieldAlert },
    { to: '/audit-log',  label: 'Audit Log',  icon: ScrollText },
    { to: '/armoriq',    label: 'ArmorIQ',    icon: ShieldCheck },
  ];

  // Dynamically include User directory as Settings for admins
  if (user?.role === 'admin') {
    navLinks.push({ to: '/users', label: 'Settings', icon: Settings });
  }

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#111827] flex items-center justify-between px-4 border-b border-slate-800 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-tight tracking-wide font-display">CodeArmor</h1>
            <p className="text-slate-450 text-[8px] font-semibold tracking-wider uppercase">Security Intelligence</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 focus:outline-none transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5.5 h-5.5" />
        </button>
      </header>

      {/* Backdrop for Mobile */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-xs transition-opacity duration-305"
        />
      )}

      {/* Sidebar Drawer */}
      <aside className={`
        fixed inset-y-0 left-0 z-45 flex flex-col w-[280px] bg-[#111827] select-none
        transition-transform duration-300 ease-in-out
        md:translate-x-0 md:static md:h-screen md:min-h-screen md:shrink-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 py-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight tracking-wide font-display">CodeArmor</h1>
              <p className="text-slate-400 text-[10px] font-semibold tracking-wider uppercase mt-0.5">Security Intelligence</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 focus:outline-none transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={handleLinkClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/15'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-4 h-4 transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  }`} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Session Footer */}
        <div className="border-t border-slate-800 p-5 bg-[#0e1420]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-indigo-500/10 shrink-0">
              {user?.username?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-slate-200 text-xs font-semibold truncate leading-tight">{user?.username ?? 'User'}</p>
              <p className="text-slate-500 text-[9px] uppercase font-bold tracking-wider mt-0.5">{user?.role ?? 'User'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-rose-400 transition-all py-2.5 px-3 rounded-lg border border-transparent hover:border-rose-500/25 hover:bg-rose-500/5 font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
