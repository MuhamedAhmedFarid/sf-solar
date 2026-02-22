
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Layout } from './Layout';
import { Candidate, AgentPerformance, PaymentBatch } from '../types';
import { 
  Phone, FileText, Play, Check, X, ShieldAlert, Star, Clock, 
  Briefcase, MessageSquare, Coffee, Filter, Search, DollarSign, 
  TrendingUp, CreditCard, Zap, ShieldQuestion, Activity, CheckCircle2, 
  History, Package, ChevronDown, ChevronRight, Loader2, AlertCircle, Info
} from 'lucide-react';

export const ClientPortal: React.FC<{ client: any; onLogout: () => void }> = ({ client, onLogout }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [batches, setBatches] = useState<PaymentBatch[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'PIPELINE' | 'SUMMARY' | 'PAYMENTS'>('PIPELINE');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Batch Details State
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [batchDetails, setBatchDetails] = useState<Record<string, any[]>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Payment Confirmation State
  const [confirmingBatch, setConfirmingBatch] = useState<PaymentBatch | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    fetchPortalData();
  }, [client.id]);

  const fetchPortalData = async () => {
    setLoading(true);
    try {
      const [candRes, batchRes, historyRes] = await Promise.all([
        supabase.from('candidates').select('*').eq('client_id', client.id),
        supabase.from('payment_batches').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
        supabase.from('payment_history').select('*').eq('client_id', client.id).order('paid_at', { ascending: false })
      ]);
      
      if (candRes.data) setCandidates(candRes.data);
      if (batchRes.data) setBatches(batchRes.data);
      if (historyRes.data) setPaymentHistory(historyRes.data);
    } catch (err) { 
      console.error("Portal Fetch Error:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  const fetchBatchDetails = async (batchId: string) => {
    if (batchDetails[batchId]) {
      setExpandedBatchId(expandedBatchId === batchId ? null : batchId);
      return;
    }

    setLoadingDetails(true);
    setExpandedBatchId(batchId);
    try {
      const { data, error } = await supabase
        .from('agent_performance_sync')
        .select('*')
        .eq('batch_id', batchId);

      if (error) throw error;

      // Group by agent to calculate subtotals
      const details = data.map(p => {
        const candidate = candidates.find(c => String(c.agent_id) === String(p.agent_id) || c.id === p.agent_id);
        const rate = candidate?.rate_per_hour || 0;
        const sets = candidate?.number_of_sets || 0;
        const meetings = candidate?.meeting_hours || 0;
        const breaks = candidate?.break_hours || 0;
        
        const toSeconds = (val: any): number => {
          if (!val) return 0;
          if (typeof val === 'number') return val;
          if (typeof val === 'string' && val.includes(':')) {
            const parts = val.split(':').map(Number);
            return parts.length === 3 ? (parts[0] * 3600) + (parts[1] * 60) + parts[2] : (parts[0] * 60) + parts[1];
          }
          return Number(val) || 0;
        };

        const workHrs = (toSeconds(p.talk_time) + toSeconds(p.wait_time)) / 3600;
        const subtotal = ((workHrs + meetings + breaks) * rate) + (sets * 20);

        return {
          name: p.full_name || 'System Agent',
          hours: workHrs.toFixed(2),
          sets: sets,
          subtotal: subtotal
        };
      });

      setBatchDetails(prev => ({ ...prev, [batchId]: details }));
    } catch (err) {
      console.error("Error fetching batch details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!confirmingBatch) return;
    setProcessingPayment(true);
    try {
      const { error: batchError } = await supabase
        .from('payment_batches')
        .update({ status: 'paid' })
        .eq('id', confirmingBatch.id);
      
      if (batchError) throw batchError;

      const { error: perfError } = await supabase
        .from('agent_performance_sync')
        .update({ is_paid: true })
        .eq('batch_id', confirmingBatch.id);

      if (perfError) throw perfError;

      const { error: historyError } = await supabase
        .from('payment_history')
        .insert([{
          client_id: client.id,
          batch_id: confirmingBatch.id,
          total_amount: confirmingBatch.total_amount,
          paid_at: new Date().toISOString()
        }]);

      if (historyError) {
        console.warn("History logging failed, but payment succeeded:", historyError);
      }

      alert(`Payment for ${confirmingBatch.batch_name} processed successfully.`);
      setConfirmingBatch(null);
      await fetchPortalData();
    } catch (err: any) {
      console.error("Payment Process Error:", err);
      alert(`Payment execution failed: ${err.message}`);
    } finally {
      setProcessingPayment(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from('candidates').update({ status: newStatus }).eq('id', id);
    if (!error) setCandidates(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
  };

  const getStatusStyles = (status: string) => {
    const s = (status || 'PENDING').toUpperCase();
    switch (s) {
      case 'GOOD': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'TRAINING': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'BAD': case 'REJECTED': return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'WORKING': return 'bg-slate-900 text-white border-slate-950';
      case 'PREPARATION': return 'bg-sky-100 text-sky-800 border-sky-300';
      case 'PROBATION': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const totalNetOwed = candidates.reduce((sum, c) => sum + (c.total_owed || 0), 0);
  const totalMoes = candidates.reduce((sum, c) => sum + (c.moes_total || 0), 0);

  return (
    <Layout title={`CEO: ${client.name}`} subtitle="Workforce Management" onLogout={onLogout} user={client}>
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit mb-10">
        <button onClick={() => setActiveTab('PIPELINE')} className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest ${activeTab === 'PIPELINE' ? 'bg-primary shadow-sm' : 'text-slate-400'}`}>Pipeline</button>
        <button onClick={() => setActiveTab('SUMMARY')} className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest ${activeTab === 'SUMMARY' ? 'bg-primary shadow-sm' : 'text-slate-400'}`}>Summary</button>
        <button onClick={() => setActiveTab('PAYMENTS')} className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest ${activeTab === 'PAYMENTS' ? 'bg-primary shadow-sm' : 'text-slate-400'}`}>Payments</button>
      </div>

      {activeTab === 'PIPELINE' && (
        <div className="space-y-8 animate-in fade-in">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-wrap gap-2">
              {['ALL', 'GOOD', 'BAD', 'TRAINING', 'WORKING', 'PROBATION'].map(f => (
                <button 
                  key={f} onClick={() => setStatusFilter(f)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border tracking-tight transition-all ${statusFilter === f ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="relative w-full lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none font-bold text-sm w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {candidates.filter(c => (statusFilter === 'ALL' || c.status.toUpperCase() === statusFilter) && c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(c => (
              <div key={c.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm flex flex-col group overflow-hidden transition-all h-full">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">{c.name}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{c.role}</p>
                  </div>
                  <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border flex items-center gap-1.5 shadow-sm ${getStatusStyles(c.status)}`}>
                    {c.status}
                  </span>
                </div>
                
                <div className="space-y-4 mb-8">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <span className="text-xs font-black text-slate-900">{c.show_phone_to_client ? c.whatsapp_number : '***-***-****'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <a href={c.resume_link} target="_blank" className="py-3.5 bg-slate-950 text-white text-[10px] font-black uppercase rounded-2xl text-center hover:bg-slate-800 transition-all shadow-sm">CV</a>
                    <a href={c.recording_link} target="_blank" className="py-3.5 bg-slate-100 text-slate-900 text-[10px] font-black uppercase rounded-2xl text-center hover:bg-slate-200 transition-all border border-slate-200 shadow-sm">CLIP</a>
                  </div>
                </div>

                <div className="mt-auto pt-6 border-t border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Update Status</p>
                  <div className="grid grid-cols-2 gap-2">
                    {['GOOD', 'REJECTED', 'TRAINING', 'PROBATION'].map(s => (
                      <button 
                        key={s} 
                        onClick={() => updateStatus(c.id, s)} 
                        className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tight border transition-all text-center
                          ${c.status.toUpperCase() === s.toUpperCase() 
                            ? s === 'GOOD' ? 'bg-emerald-600 text-white border-emerald-700 shadow-md scale-[1.02]' :
                              s === 'REJECTED' ? 'bg-rose-600 text-white border-rose-700 shadow-md scale-[1.02]' :
                              s === 'TRAINING' ? 'bg-amber-500 text-white border-amber-600 shadow-md scale-[1.02]' :
                              s === 'PROBATION' ? 'bg-orange-500 text-white border-orange-600 shadow-md scale-[1.02]' :
                              'bg-slate-900 text-white'
                            : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                          }
                        `}
                      >
                        {s}
                      </button>
                    ))}
                    <button 
                      onClick={() => updateStatus(c.id, 'WORKING')}
                      className={`col-span-2 px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-tight border transition-all text-center
                        ${c.status.toUpperCase() === 'WORKING'
                          ? 'bg-slate-900 text-white border-slate-950 shadow-md scale-[1.02]'
                          : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                        }
                      `}
                    >
                      WORKING
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'SUMMARY' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Total Net Payables</p>
               <h4 className="text-5xl font-black text-slate-900 tracking-tighter">${totalNetOwed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h4>
            </div>
            <div className="bg-slate-950 p-10 rounded-[2.5rem] text-white shadow-xl">
               <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-4">Moe's Service Total</p>
               <h4 className="text-5xl font-black text-white tracking-tighter">${totalMoes.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h4>
            </div>
          </div>
          <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-xl">
            <div className="px-10 py-6 border-b border-slate-100 bg-slate-50/50">
               <h3 className="font-black text-slate-900 text-lg">Workforce Ledger</h3>
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase">Agent</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase text-center">Moe's Total</th>
                  <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase text-right">Net Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {candidates.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-10 py-6 font-black text-slate-900">{c.name}</td>
                    <td className="px-6 py-6 text-center font-black text-xs">${(c.moes_total || 0).toFixed(2)}</td>
                    <td className="px-10 py-6 text-right font-black text-forest text-lg">${(c.total_owed || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'PAYMENTS' && (
        <div className="space-y-12 animate-in slide-in-from-right-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-6 text-primary/10 group-hover:text-primary/20 transition-colors">
                 <CreditCard className="size-20" />
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Outstanding Settlements</p>
               <h4 className="text-5xl font-black text-slate-900 tracking-tighter">
                 ${batches.filter(b => b.status === 'pending_payment').reduce((s, b) => s + b.total_amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
               </h4>
               <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest border border-slate-100">
                  <Clock className="size-4" /> Awaiting Payment
               </div>
            </div>
            
            <div className="bg-emerald-600 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-6 text-white/5 group-hover:text-white/10 transition-colors">
                 <ShieldQuestion className="size-20" />
               </div>
               <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] mb-4">Lifetime Settlements</p>
               <h4 className="text-5xl font-black text-white tracking-tighter">
                 ${(paymentHistory.reduce((s, b) => s + (b.total_amount || 0), 0) + batches.filter(b => b.status === 'paid').reduce((s, b) => s + b.total_amount, 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
               </h4>
               <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl text-[10px] font-black text-white uppercase tracking-widest border border-white/5">
                  <CheckCircle2 className="size-4" /> Audit Verified
               </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
               <div className="size-10 bg-slate-950 rounded-xl flex items-center justify-center text-primary shadow-lg"><Package className="size-5" /></div>
               <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Active Invoices</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select batch to view agent details and initiate payment</p>
               </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                    <th className="px-10 py-5 w-16"></th>
                    <th className="px-4 py-5">Batch Reference</th>
                    <th className="px-6 py-5 text-center">Date Issued</th>
                    <th className="px-6 py-5 text-center">Amount Due</th>
                    <th className="px-6 py-5 text-center">Status</th>
                    <th className="px-10 py-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batches.filter(b => b.status === 'pending_payment').length === 0 ? (
                    <tr><td colSpan={6} className="px-10 py-20 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">No pending settlements</td></tr>
                  ) : batches.filter(b => b.status === 'pending_payment').map(batch => (
                    <React.Fragment key={batch.id}>
                      <tr className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-10 py-6">
                          <button 
                            onClick={() => fetchBatchDetails(batch.id)}
                            className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all hover:border-primary"
                          >
                            {expandedBatchId === batch.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-6">
                          <span className="font-black text-slate-900 text-sm">{batch.batch_name}</span>
                        </td>
                        <td className="px-6 py-6 text-center text-[10px] font-black text-slate-400 uppercase">
                          {new Date(batch.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-6 text-center font-black text-slate-950">
                          ${batch.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-6 text-center">
                          <span className="px-4 py-1.5 rounded-full bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-widest border border-amber-100">
                            PENDING
                          </span>
                        </td>
                        <td className="px-10 py-6 text-right">
                          <button 
                            onClick={() => setConfirmingBatch(batch)}
                            className="px-6 py-2.5 bg-slate-950 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                          >
                            Settle Batch
                          </button>
                        </td>
                      </tr>
                      {expandedBatchId === batch.id && (
                        <tr className="bg-slate-50/30 animate-in slide-in-from-top-1 duration-200">
                           <td colSpan={6} className="px-10 py-6">
                              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                                 <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                   <Info className="size-3" /> Agent Performance Composition
                                 </h5>
                                 {loadingDetails ? (
                                   <div className="flex items-center gap-3 text-slate-400 py-4 justify-center">
                                      <Loader2 className="size-4 animate-spin" />
                                      <span className="text-[9px] font-black uppercase tracking-widest">Retrieving Agent Logs...</span>
                                   </div>
                                 ) : (
                                   <table className="w-full text-left">
                                      <thead>
                                        <tr className="text-[9px] font-black text-slate-400 uppercase border-b border-slate-50 pb-2">
                                          <th className="py-2">Resource Name</th>
                                          <th className="py-2 text-center">Billable Hours</th>
                                          <th className="py-2 text-center">Active Sets</th>
                                          <th className="py-2 text-right">Subtotal</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50">
                                        {batchDetails[batch.id]?.map((d, i) => (
                                          <tr key={i} className="text-xs">
                                            <td className="py-3 font-black text-slate-900">{d.name}</td>
                                            <td className="py-3 text-center text-slate-500 font-bold">{d.hours}h</td>
                                            <td className="py-3 text-center text-slate-500 font-bold">{d.sets}</td>
                                            <td className="py-3 text-right font-black text-slate-950">${d.subtotal.toFixed(2)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                   </table>
                                 )}
                              </div>
                           </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
             <div className="flex items-center gap-4">
               <div className="size-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm"><History className="size-5" /></div>
               <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Payment History</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archived settlements and verified audits</p>
               </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
               <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                      <th className="px-10 py-5">Settlement Date</th>
                      <th className="px-6 py-5">Batch ID</th>
                      <th className="px-6 py-5 text-center">Total Amount</th>
                      <th className="px-10 py-5 text-right">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paymentHistory.length === 0 ? (
                      <tr><td colSpan={4} className="px-10 py-16 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">No historical records found</td></tr>
                    ) : paymentHistory.map((hist, i) => (
                      <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="size-4 text-emerald-600" />
                            <span className="font-black text-slate-900 text-sm">{new Date(hist.paid_at).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-6 font-mono text-xs text-slate-400 uppercase tracking-widest">
                          {hist.batch_id?.substring(0, 13)}...
                        </td>
                        <td className="px-6 py-6 text-center font-black text-emerald-600">
                          ${(hist.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-10 py-6 text-right">
                          <button 
                            onClick={() => hist.batch_id && fetchBatchDetails(hist.batch_id)}
                            className="px-4 py-2 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all"
                          >
                            View Audit
                          </button>
                        </td>
                      </tr>
                    ))}
                    {batches.filter(b => b.status === 'paid').map(batch => (
                      <tr key={batch.id} className="hover:bg-slate-50/30 transition-colors bg-emerald-50/20">
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="size-4 text-emerald-600" />
                            <span className="font-black text-slate-900 text-sm">{new Date(batch.created_at).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-6 font-mono text-xs text-slate-400 uppercase tracking-widest">
                          {batch.id?.substring(0, 13)}...
                        </td>
                        <td className="px-6 py-6 text-center font-black text-emerald-600">
                          ${batch.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-10 py-6 text-right">
                           <span className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest">SETTLED</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
        </div>
      )}

      {confirmingBatch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in">
           <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl p-10 animate-in zoom-in-95">
              <div className="flex items-center gap-4 mb-6">
                 <div className="size-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm"><AlertCircle className="size-8" /></div>
                 <div>
                    <h4 className="text-2xl font-black text-slate-950 tracking-tight">Final Settlement</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Confirmation Required</p>
                 </div>
              </div>
              
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 mb-8 space-y-3">
                 <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                    <span>Batch Ref:</span>
                    <span className="text-slate-950">{confirmingBatch.batch_name}</span>
                 </div>
                 <div className="flex justify-between text-sm font-black text-slate-950 pt-2 border-t border-slate-200">
                    <span>Total Owed:</span>
                    <span className="text-forest">${confirmingBatch.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                 </div>
              </div>

              <p className="text-xs text-slate-400 font-medium leading-relaxed mb-10 text-center">
                Are you sure you want to pay for this batch? This action triggers the disbursement ledger and <span className="text-rose-500 font-black">cannot be undone</span>.
              </p>

              <div className="grid grid-cols-2 gap-4">
                 <button 
                  onClick={() => setConfirmingBatch(null)}
                  disabled={processingPayment}
                  className="py-4 font-black uppercase text-xs text-slate-400 hover:text-slate-900 transition-colors"
                 >
                   Discard
                 </button>
                 <button 
                  onClick={handleConfirmPayment}
                  disabled={processingPayment}
                  className="py-4 bg-slate-950 text-white rounded-2xl font-black uppercase text-xs shadow-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
                 >
                   {processingPayment ? <Loader2 className="size-4 animate-spin text-primary" /> : <><Check className="size-4 text-primary" /> Confirm Pay</>}
                 </button>
              </div>
           </div>
        </div>
      )}
    </Layout>
  );
};
