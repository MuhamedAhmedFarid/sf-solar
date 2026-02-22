
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { Layout } from './Layout';
import { Candidate, ClientData, AgentPerformance } from '../types';
import { 
  UserPlus, Briefcase, Search, Clock, Trash2, 
  Users, Edit2, Shield, Key, Settings, Zap, CheckCircle, 
  XCircle, Info, Lock, UserCog, Building, Phone, Mail,
  ChevronRight, BarChart3, Plus, Globe
} from 'lucide-react';

export const AdminPortal: React.FC<{ user: any; onLogout: () => void }> = ({ user, onLogout }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [performance, setPerformance] = useState<AgentPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'CANDIDATES' | 'CLIENTS' | 'HOURS' | 'SETTINGS'>('CANDIDATES');
  const [showModal, setShowModal] = useState<null | 'CANDIDATE' | 'CLIENT' | 'ACCESS'>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Payroll Admin Passcode State
  const [newPayrollPasscode, setNewPayrollPasscode] = useState('');
  const [updateStatus, setUpdateStatus] = useState<null | 'SAVING' | 'SUCCESS' | 'ERROR'>(null);

  // Candidate/Client Form States
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', access_code: '',
    whatsapp: '', country_code: '+1', role: '', resume_link: '', recording_link: '', 
    client_id: '', rate_per_hour: '', 
    alias: '', username: '', password: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cRes, clRes, pRes] = await Promise.all([
        supabase.from('candidates').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('agent_performance_sync').select('*').order('sync_date', { ascending: false })
      ]);
      
      if (cRes.data) setCandidates(cRes.data);
      if (clRes.data) setClients(clRes.data);
      if (pRes.data) setPerformance(pRes.data);
    } catch (e) {
      console.error('Data Fetch Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePayrollPass = async () => {
    if (!newPayrollPasscode) return;
    setUpdateStatus('SAVING');
    try {
      const { data: existing } = await supabase.from('sf_admins').select('id').limit(1).maybeSingle();
      let error;
      if (existing) {
        const res = await supabase.from('sf_admins').update({ passcode: newPayrollPasscode }).eq('id', existing.id);
        error = res.error;
      } else {
        const res = await supabase.from('sf_admins').insert([{ passcode: newPayrollPasscode }]);
        error = res.error;
      }
      if (error) throw error;
      setUpdateStatus('SUCCESS');
      setTimeout(() => { setUpdateStatus(null); setNewPayrollPasscode(''); }, 3000);
    } catch (err) { setUpdateStatus('ERROR'); }
  };

  const handleSaveClient = async () => {
    const payload = {
      name: formData.name,
      email: formData.email,
      phone_number: formData.phone,
      access_code: formData.access_code || Math.random().toString(36).substring(2, 8).toUpperCase()
    };

    const res = activeId 
      ? await supabase.from('clients').update(payload).eq('id', activeId)
      : await supabase.from('clients').insert([payload]);

    if (!res.error) { setShowModal(null); fetchData(); }
  };

  const handleSaveCandidate = async () => {
    // Combine country code and number for internal storage
    const fullPhone = `${formData.country_code}${formData.whatsapp.replace(/\D/g, '')}`;

    const payload = {
      name: formData.name, 
      email: formData.email, 
      role: formData.role,
      whatsapp_number: fullPhone, 
      resume_link: formData.resume_link,
      recording_link: formData.recording_link, 
      client_id: formData.client_id || null,
      rate_per_hour: parseFloat(formData.rate_per_hour) || 0,
      alias: formData.alias, 
      username: formData.username, 
      password: formData.password
    };

    const res = activeId 
      ? await supabase.from('candidates').update(payload).eq('id', activeId)
      : await supabase.from('candidates').insert([{ ...payload, status: 'PENDING', show_phone_to_client: false }]);

    if (!res.error) { setShowModal(null); fetchData(); }
  };

  const handleDeleteClient = async (id: string) => {
    if (!window.confirm('Delete this client and unassign all agents?')) return;
    await supabase.from('candidates').update({ client_id: null }).eq('client_id', id);
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (!error) fetchData();
  };

  const handleDeleteCandidate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this candidate?')) return;
    const { error } = await supabase.from('candidates').delete().eq('id', id);
    if (!error) fetchData();
  };

  const toSeconds = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.includes(':')) {
      const parts = val.split(':').map(Number);
      if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
      if (parts.length === 2) return (parts[0] * 60) + parts[1];
    }
    return Number(val) || 0;
  };

  const hourStats = useMemo(() => {
    const statsMap = new Map();
    performance.forEach(p => {
      const existing = statsMap.get(p.agent_id) || { total: 0, active: 0 };
      existing.total += toSeconds(p.talk_time) + toSeconds(p.wait_time);
      existing.active += toSeconds(p.talk_time);
      statsMap.set(p.agent_id, existing);
    });
    return statsMap;
  }, [performance]);

  const getStatusStyles = (status: string) => {
    const s = (status || 'PENDING').toUpperCase();
    switch (s) {
      case 'GOOD': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      case 'WORKING': return 'bg-forest text-white border-forest';
      case 'BAD': case 'REJECTED': return 'bg-rose-50 text-rose-600 border-rose-200';
      default: return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  return (
    <Layout title="Admin Control" subtitle="Sunflower LLC Management" onLogout={onLogout} user={user}>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
        <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
          {[
            { id: 'CANDIDATES', icon: Users, label: 'Pipeline' },
            { id: 'CLIENTS', icon: Briefcase, label: 'Accounts' },
            { id: 'HOURS', icon: Clock, label: "Mo's Hours" },
            { id: 'SETTINGS', icon: Settings, label: 'System' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all uppercase tracking-widest ${activeTab === tab.id ? 'bg-primary text-slate-900 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <tab.icon className="size-4" /> {tab.label}
            </button>
          ))}
        </div>
        
        <div className="flex gap-4">
          {activeTab === 'CLIENTS' ? (
            <button 
              onClick={() => { setActiveId(null); setFormData({name:'', email:'', phone:'', access_code:'', whatsapp:'', country_code: '+1', role:'', resume_link:'', recording_link:'', client_id:'', rate_per_hour:'', alias:'', username:'', password:''}); setShowModal('CLIENT'); }}
              className="flex items-center gap-3 px-8 py-3.5 bg-slate-950 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl active:scale-95"
            >
              <Building className="size-5" /> New Client
            </button>
          ) : (
            <button 
              onClick={() => { setActiveId(null); setFormData({name:'', email:'', phone:'', access_code:'', whatsapp:'', country_code: '+1', role:'', resume_link:'', recording_link:'', client_id:'', rate_per_hour:'', alias:'', username:'', password:''}); setShowModal('CANDIDATE'); }}
              className="flex items-center gap-3 px-8 py-3.5 bg-slate-950 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl active:scale-95"
            >
              <UserPlus className="size-5" /> New Candidate
            </button>
          )}
        </div>
      </div>

      {activeTab === 'CANDIDATES' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-500">
          <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <h3 className="text-xl font-black text-slate-900">Global Pipeline</h3>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
              <input 
                type="text" placeholder="Search resources..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-80 pl-10 pr-4 py-2.5 bg-white border border-slate-100 rounded-xl outline-none font-bold text-sm focus:border-primary transition-colors"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Candidate</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                  <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidates.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/30 group">
                    <td className="px-10 py-6">
                      <p className="font-bold text-slate-900">{c.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{c.role || 'Unspecified Role'}</p>
                    </td>
                    <td className="px-6 py-6">
                      {c.client_id ? (
                        <div className="flex items-center gap-2 text-slate-600 font-black text-xs">
                          <Building className="size-3 text-primary" /> {clients.find(cl => cl.id === c.client_id)?.name || 'Unknown Client'}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300 font-bold uppercase">Unassigned</span>
                      )}
                    </td>
                    <td className="px-10 py-6 text-center">
                      <span className={`px-4 py-1.5 rounded-lg text-[10px] font-black border uppercase ${getStatusStyles(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-10 py-6 text-right space-x-4">
                       <button onClick={() => { 
                         const existingCode = c.whatsapp_number?.startsWith('+20') ? '+20' : c.whatsapp_number?.startsWith('+63') ? '+63' : c.whatsapp_number?.startsWith('+52') ? '+52' : '+1';
                         const cleanNum = c.whatsapp_number?.replace(existingCode, '') || '';
                         setActiveId(c.id); 
                         setFormData({...formData, name:c.name, email:c.email, whatsapp:cleanNum, country_code: existingCode, role:c.role, resume_link:c.resume_link, recording_link:c.recording_link, client_id:c.client_id || '', rate_per_hour:c.rate_per_hour?.toString() || '', alias:c.alias||'', username:c.username||'', password:c.password||''}); 
                         setShowModal('CANDIDATE'); 
                        }} className="text-slate-300 hover:text-slate-900 transition-colors"><Edit2 className="size-4" /></button>
                       <button onClick={() => handleDeleteCandidate(c.id)} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 className="size-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'CLIENTS' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-500">
          <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <h3 className="text-xl font-black text-slate-900">Client Accounts</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Company / Name</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Access Code</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Staff Count</th>
                  <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.length === 0 ? (
                   <tr><td colSpan={4} className="px-10 py-20 text-center text-slate-400 font-bold uppercase text-xs">No clients found</td></tr>
                ) : clients.map((cl) => (
                  <tr key={cl.id} className="hover:bg-slate-50/30 group">
                    <td className="px-10 py-6">
                      <p className="font-bold text-slate-900">{cl.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{cl.email}</p>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className="px-4 py-2 bg-slate-100 rounded-xl font-black text-xs tracking-widest text-slate-900 border border-slate-200">
                        {cl.access_code}
                      </span>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className="font-black text-slate-900">{candidates.filter(c => c.client_id === cl.id).length} Reps</span>
                    </td>
                    <td className="px-10 py-6 text-right space-x-4">
                       <button onClick={() => { setActiveId(cl.id); setFormData({...formData, name:cl.name, email:cl.email, phone:cl.phone_number, access_code:cl.access_code}); setShowModal('CLIENT'); }} className="text-slate-300 hover:text-slate-900 transition-colors"><Edit2 className="size-4" /></button>
                       <button onClick={() => handleDeleteClient(cl.id)} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 className="size-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'HOURS' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10"><Zap className="size-12 text-primary" /></div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Peak Productivity</p>
               <h4 className="text-4xl font-black text-slate-900">Mo's Analytics</h4>
            </div>
          </div>
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="px-10 py-5 text-[10px] font-black uppercase tracking-widest">Agent Name</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-center">Active Hours (Talk)</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-center">Total Hours (Talk+Wait)</th>
                  <th className="px-10 py-5 text-[10px] font-black uppercase tracking-widest text-right">Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidates.map(c => {
                   const stats = hourStats.get(c.agent_id || c.id) || { total: 0, active: 0 };
                   const totalHrs = stats.total / 3600;
                   const activeHrs = stats.active / 3600;
                   const efficiency = totalHrs > 0 ? (activeHrs / totalHrs) * 100 : 0;
                   if (totalHrs === 0) return null;
                   return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-10 py-6 font-black text-slate-900">{c.name}</td>
                      <td className="px-6 py-6 text-center font-mono text-sm font-black text-emerald-600">{activeHrs.toFixed(2)}h</td>
                      <td className="px-6 py-6 text-center font-mono text-sm font-black text-slate-900">{totalHrs.toFixed(2)}h</td>
                      <td className="px-10 py-6 text-right">
                         <span className="font-black text-xs text-primary bg-slate-900 px-3 py-1 rounded-lg">{efficiency.toFixed(0)}%</span>
                      </td>
                    </tr>
                   );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'SETTINGS' && (
        <div className="max-w-2xl bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-10 animate-in zoom-in-95">
          <div className="flex Forest-items-center gap-4 mb-8">
            <div className="size-14 bg-slate-900 rounded-2xl flex items-center justify-center text-primary shadow-lg">
              <Shield className="size-8" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-950">System Security</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payroll Access Configuration</p>
            </div>
          </div>
          <div className="space-y-6">
             <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Payroll Passcode</label>
               <div className="relative">
                 <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
                 <input 
                  type="password" value={newPayrollPasscode} onChange={e => setNewPayrollPasscode(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-2xl tracking-widest outline-none focus:border-primary transition-all"
                 />
               </div>
             </div>
             <button 
              onClick={handleUpdatePayrollPass} disabled={updateStatus === 'SAVING' || !newPayrollPasscode}
              className="w-full py-5 bg-slate-950 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-slate-800 disabled:opacity-30 transition-all"
             >
               {updateStatus === 'SAVING' ? 'Processing...' : 'Update Payroll Passcode'}
             </button>
             {updateStatus === 'SUCCESS' && <p className="text-center text-emerald-600 font-black text-[10px] uppercase tracking-widest animate-bounce">Security Update Complete</p>}
             {updateStatus === 'ERROR' && <p className="text-center text-rose-600 font-black text-[10px] uppercase tracking-widest">Update Failed</p>}
          </div>
        </div>
      )}

      {/* Client Modal */}
      {showModal === 'CLIENT' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md">
          <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-10 text-slate-900 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black mb-2">{activeId ? 'Edit' : 'New'} Client Account</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Define workspace and access controls</p>
            <div className="space-y-4">
              <input placeholder="Company / Client Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-primary transition-colors" />
              <input placeholder="Contact Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-primary transition-colors" />
              <input placeholder="Phone Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-primary transition-colors" />
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-400 uppercase ml-2">Custom Access Code (Optional)</label>
                <input placeholder="Leave blank for auto-gen" value={formData.access_code} onChange={e => setFormData({...formData, access_code: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black tracking-widest outline-none focus:border-primary transition-colors" />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowModal(null)} className="flex-1 py-4 font-black uppercase text-xs text-slate-400">Cancel</button>
                <button onClick={handleSaveClient} className="flex-1 py-4 bg-primary text-slate-900 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Create Account</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Modal */}
      {showModal === 'CANDIDATE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-xl bg-white rounded-[2rem] shadow-2xl p-10 my-8 text-slate-900 animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black mb-2">{activeId ? 'Edit' : 'New'} Candidate</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Resource force record management</p>
            <div className="space-y-4">
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Identity</label>
                 <input placeholder="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Phone Number</label>
                  <div className="flex gap-2">
                    <select 
                      value={formData.country_code} 
                      onChange={e => setFormData({...formData, country_code: e.target.value})}
                      className="w-24 p-4 bg-slate-50 border border-slate-100 rounded-xl font-black text-xs outline-none focus:border-primary transition-all appearance-none"
                    >
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+20">🇪🇬 +20</option>
                      <option value="+63">🇵🇭 +63</option>
                      <option value="+52">🇲🇽 +52</option>
                    </select>
                    <input 
                      placeholder="Number" 
                      value={formData.whatsapp} 
                      onChange={e => setFormData({...formData, whatsapp: e.target.value})} 
                      className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all" 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Designated Role</label>
                  <input placeholder="e.g. Sales Rep" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Portfolio Links</label>
                  <input placeholder="Resume Link" value={formData.resume_link} onChange={e => setFormData({...formData, resume_link: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all" />
                </div>
                <div className="space-y-1 pt-5">
                  <input placeholder="Recording Link" value={formData.recording_link} onChange={e => setFormData({...formData, recording_link: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Compensation ($/hr)</label>
                  <input placeholder="Hourly Rate" type="number" value={formData.rate_per_hour} onChange={e => setFormData({...formData, rate_per_hour: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Assign to Client</label>
                  <select value={formData.client_id} onChange={e => setFormData({...formData, client_id: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all appearance-none">
                    <option value="">Unassigned</option>
                    {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button onClick={() => setShowModal(null)} className="flex-1 py-4 font-black uppercase text-xs text-slate-400">Cancel</button>
                <button onClick={handleSaveCandidate} className="flex-1 py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Save Record</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
