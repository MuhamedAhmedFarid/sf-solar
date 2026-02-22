
import React, { useState } from 'react';
import { Sun, LogOut, Settings, Bell, LayoutDashboard, Menu, Bot } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  onLogout?: () => void;
  user?: any;
}

export const Layout: React.FC<LayoutProps> = ({ children, title, subtitle, onLogout, user }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentNav, setCurrentNav] = useState<'DASHBOARD' | 'AIDEN'>('DASHBOARD');

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${
          isCollapsed ? 'w-20' : 'w-72'
        } bg-white border-r border-slate-200 hidden md:flex flex-col transition-all duration-300 ease-in-out shrink-0`}
      >
        <div className={`p-6 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="size-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shrink-0">
            <Sun className="size-6 text-slate-900 sun-spin" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300 overflow-hidden">
              <h1 className="font-extrabold text-sm tracking-tight text-slate-900 whitespace-nowrap">SUNFLOWER LLC</h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold whitespace-nowrap">Workspace</p>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {!isCollapsed && (
            <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-in fade-in duration-300">
              Main Menu
            </div>
          )}
          
          <button 
            onClick={() => setCurrentNav('DASHBOARD')}
            type="button"
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 rounded-xl transition-all text-left group ${
              currentNav === 'DASHBOARD' 
                ? 'bg-primary/10 text-slate-900 font-black border-l-4 border-primary' 
                : 'text-slate-400 hover:bg-slate-50 font-bold'
            }`}
            title={isCollapsed ? 'Dashboard' : ''}
          >
             <LayoutDashboard className={`size-4 shrink-0 ${currentNav === 'DASHBOARD' ? 'text-slate-900' : ''}`} />
             {!isCollapsed && <span className="animate-in fade-in slide-in-from-left-2 duration-300">Dashboard</span>}
          </button>

          <button 
            onClick={() => setCurrentNav('AIDEN')}
            type="button"
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 rounded-xl transition-all text-left group ${
              currentNav === 'AIDEN' 
                ? 'bg-primary/10 text-slate-900 font-black border-l-4 border-primary' 
                : 'text-slate-400 hover:bg-slate-50 font-bold'
            }`}
            title={isCollapsed ? 'Aiden 2.0 🤖' : ''}
          >
             <Bot className={`size-4 shrink-0 ${currentNav === 'AIDEN' ? 'text-slate-900' : ''}`} />
             {!isCollapsed && <span className="animate-in fade-in slide-in-from-left-2 duration-300 flex items-center gap-2">Aiden 2.0 🤖</span>}
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
           {user && (
             <div className={`mb-4 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 p-3'} bg-slate-50 rounded-xl border border-slate-100`}>
               <div className="size-8 rounded-full bg-primary flex items-center justify-center text-xs font-black text-slate-900 shrink-0">
                 {user.name?.[0] || 'U'}
               </div>
               {!isCollapsed && (
                 <div className="overflow-hidden animate-in fade-in duration-300">
                   <p className="text-xs font-black truncate text-slate-950">{user.name || 'User'}</p>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Secure Session</p>
                 </div>
               )}
             </div>
           )}
           <button 
             onClick={onLogout}
             className={`w-full flex items-center justify-center ${isCollapsed ? '' : 'gap-2 px-4'} py-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all font-black text-sm`}
             title={isCollapsed ? 'Sign Out' : ''}
           >
             <LogOut className="size-4 shrink-0" />
             {!isCollapsed && <span className="animate-in fade-in duration-300">Sign Out</span>}
           </button>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all active:scale-95"
              aria-label="Toggle Sidebar"
            >
              <Menu className="size-6" />
            </button>
            <div>
              <h2 className="text-xl font-black text-slate-950">
                {currentNav === 'AIDEN' ? 'Aiden 2.0 Project' : title}
              </h2>
              {subtitle && <p className="text-xs text-slate-500 font-bold">{currentNav === 'AIDEN' ? 'AI Workforce Integration' : subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-primary transition-colors">
              <Bell className="size-5" />
            </button>
            <button className="p-2 text-slate-400 hover:text-primary transition-colors">
              <Settings className="size-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
          {currentNav === 'AIDEN' ? (
            <div className="h-full flex flex-col items-center justify-center animate-in fade-in zoom-in duration-700">
              <div className="relative group">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full group-hover:bg-primary/40 transition-all"></div>
                
                {/* Robot Icon */}
                <div className="relative size-64 lg:size-80 bg-white rounded-[4rem] border border-slate-200 shadow-2xl flex items-center justify-center overflow-hidden">
                  <Bot className="size-40 lg:size-48 text-slate-900 group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-primary/30 to-transparent"></div>
                </div>
              </div>

              <div className="mt-12 text-center">
                <h3 className="text-6xl lg:text-8xl font-black text-slate-900 tracking-tighter mb-4">
                  COMING <span className="text-primary">SOON</span>
                </h3>
                <div className="flex items-center justify-center gap-3">
                  <div className="h-px w-12 bg-slate-200"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Sunflower Intelligence Protocol</p>
                  <div className="h-px w-12 bg-slate-200"></div>
                </div>
              </div>

              <p className="mt-8 max-w-lg text-center text-slate-500 font-medium leading-relaxed">
                The next generation of autonomous workforce management is currently being calibrated. Aiden 2.0 will redefine Sunflower LLC efficiency.
              </p>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
};
