import React from 'react';
import { UserRole } from '../types';
import { Shield, CreditCard, Briefcase, LayoutGrid } from 'lucide-react';

interface RoleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
}

const RoleCard: React.FC<RoleCardProps> = ({ title, description, icon, onClick, className }) => (
  <button 
    onClick={onClick}
    className={`group relative overflow-hidden bg-white/70 backdrop-blur-md p-8 rounded-[2.5rem] border border-slate-200 hover:border-primary/50 hover:shadow-[0_20px_50px_-12px_rgba(233,137,1,0.15)] transition-all duration-500 text-left flex flex-col justify-between min-h-[280px] ${className}`}
  >
    {/* Subtle background flare */}
    <div className="absolute -right-10 -top-10 size-40 bg-primary/5 blur-3xl group-hover:bg-primary/10 transition-all duration-700" />

    {/* Icon Container - Clean Light Style */}
    <div className="relative size-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center group-hover:bg-primary group-hover:rotate-[360deg] transition-all duration-700">
      <div className="text-primary group-hover:text-white transition-colors">
        {React.cloneElement(icon as React.ReactElement, { className: 'size-7' })}
      </div>
    </div>

    <div className="relative">
      <h3 className="text-2xl font-extrabold text-slate-900 mb-2 group-hover:text-primary transition-colors tracking-tight">
        {title}
      </h3>
      <p className="text-slate-500 text-sm leading-relaxed font-medium">
        {description}
      </p>
    </div>
    
    {/* Bottom Arrow Indicator */}
    <div className="relative mt-4 flex items-center text-xs font-bold uppercase tracking-widest text-primary opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
      Access Portal <span className="ml-2">→</span>
    </div>
  </button>
);

export const LandingPage: React.FC<{ onSelectRole: (role: UserRole) => void }> = ({ onSelectRole }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#fcfbf8] relative overflow-hidden">
      {/* Soft Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_20%,_rgba(233,137,1,0.05)_0%,_transparent_50%)]" />

      <div className="max-w-6xl w-full relative z-10">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <img src="../assets/logo.png" alt="Sunflower" className="h-40 w-auto object-contain" />
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-slate-900 mb-4 tracking-tighter">
            Sunflower <span className="text-primary">Portal</span>
          </h1>
          <p className="text-slate-500 text-lg font-semibold tracking-wide">
            Select a department to manage operations
          </p>
        </div>

        {/* RESTRUCTURED LAYOUT: Staggered Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 auto-rows-[140px]">
         
           <RoleCard 
            title="CEO"
            description="High-level client relations and status overview."
            icon={<LayoutGrid />}
            onClick={() => onSelectRole('CLIENT')}
            className="md:col-span-7 md:row-span-2 shadow-sm"
          />
          <RoleCard 
            title="Payroll"
            description="Financial disbursements and internal reporting."
            icon={<CreditCard />}
            onClick={() => onSelectRole('PAYROLL')}
            className="md:col-span-5 md:row-span-2 shadow-sm"
          />
          <RoleCard 
            title="Rep"
            description="Sales performance metrics and field worker tools."
            icon={<Briefcase />}
            onClick={() => onSelectRole('REP')}
            className="md:col-span-5 md:row-span-2 shadow-sm"
          />
           <RoleCard 
            title="Admin"
            description="Global system management and security protocols."
            icon={<Shield />}
            onClick={() => onSelectRole('ADMIN')}
            className="md:col-span-7 md:row-span-2 shadow-sm"
          />
         
        </div>
      </div>
    </div>
  );
};