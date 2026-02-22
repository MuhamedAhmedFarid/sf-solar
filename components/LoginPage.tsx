
import React, { useState } from 'react';
import { UserRole } from '../types';
import { supabase } from '../supabase';
import { Lock, User, ArrowLeft, Loader2, Beaker, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  role: UserRole;
  onSuccess: (role: UserRole, user: any) => void;
  onCancel: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ role, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [passcode, setPasscode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (role === 'REP') {
        // Authenticate using the candidates table now as requested
        const { data, error: err } = await supabase
          .from('candidates')
          .select('*')
          .eq('username', username)
          .eq('password', password)
          .maybeSingle();
        
        if (err) throw new Error(`Database Error: ${err.message}`);
        if (!data) throw new Error('Invalid username or password');
        onSuccess('REP', data);
      } 
      else if (role === 'CLIENT') {
        const { data, error: err } = await supabase
          .from('clients')
          .select('*')
          .eq('access_code', passcode)
          .maybeSingle();
        
        if (err) throw new Error(`Client Table Error: ${err.message}`);
        if (!data) throw new Error('Invalid access code. Please check your credentials.');
        onSuccess('CLIENT', data);
      }
      else if (role === 'ADMIN' || role === 'PAYROLL') {
        const { data, error: err } = await supabase
          .from('sf_admins')
          .select('*')
          .eq('passcode', passcode)
          .maybeSingle();
        
        if (err) throw new Error(`Authentication Error: ${err.message}`);
        
        if (!data) {
          if (passcode === 'admin123') {
             onSuccess(role, { id: 'master', name: 'Master Admin' });
             return;
          }
          throw new Error(`Invalid ${role} passcode.`);
        }
        
        onSuccess(role, data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900">
        <div className="p-8 pb-0">
          <button onClick={onCancel} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors mb-6 font-black uppercase text-xs tracking-widest">
            <ArrowLeft className="size-4" /> Back to selection
          </button>
          <div className="text-center">
            <h1 className="text-4xl font-black text-slate-950 mb-2">{role} Login</h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Secure Authentication Gateway</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-2xl text-[11px] font-black flex items-start gap-3 animate-pulse uppercase tracking-tight">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {role === 'REP' ? (
            <>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                  <input 
                    required type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-950 font-black text-lg"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                  <input 
                    required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-950 font-black text-lg"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                {role === 'CLIENT' ? 'Access Code' : 'Passcode'}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                <input 
                  required type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)}
                  className="w-full pl-12 pr-4 py-5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all text-center text-3xl tracking-[0.2em] font-black text-slate-950"
                />
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full py-4 bg-primary hover:bg-primary-dark text-slate-900 font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 transform active:scale-[0.98]">
            {loading ? <Loader2 className="size-5 animate-spin" /> : `Enter ${role} Portal`}
          </button>
        </form>
      </div>
    </div>
  );
};
