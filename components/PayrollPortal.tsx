import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { Layout } from './Layout';
import { AgentPerformance, Candidate, ClientData, PaymentBatch } from '../types';
import { todayEST, formatDateEST } from '../utils/dateEST';
import { 
  DollarSign, TrendingUp, Calendar, Zap, Download, 
  Filter, User, Clock, Search, ArrowRight, ChevronDown,
  Key, UserCog, X, ShieldCheck, Loader2, ShieldAlert,
  Fingerprint, Save, Activity, History, Settings, Coffee, Users, Target, CheckCircle2, Package, Trash2
} from 'lucide-react';

export const PayrollPortal: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [performance, setPerformance] = useState<AgentPerformance[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [pendingBatches, setPendingBatches] = useState<PaymentBatch[]>([]);
  const [loading, setLoading] = useState(true);
  
  // View states
  const [viewMode, setViewMode] = useState<'LEDGER' | 'BATCHER'>('LEDGER');
  const [filterMode, setFilterMode] = useState<'DAILY' | 'RANGE' | 'ALL'>('DAILY');
  const [startDate, setStartDate] = useState(todayEST());
  const [endDate, setEndDate] = useState(todayEST());
  const [searchTerm, setSearchTerm] = useState('');

  // Batching Logic States
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [batchingLoading, setBatchingLoading] = useState(false);

  // Access Modal States
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [selectedAgentPerformance, setSelectedAgentPerformance] = useState<AgentPerformance[]>([]);
  const [loadingAgentPerf, setLoadingAgentPerf] = useState(false);
  
  const [overrideForm, setOverrideForm] = useState({
    agent_id: '',
    alias: '',
    username: '',
    password: ''
  });

  const [settingsForm, setSettingsForm] = useState({
    number_of_sets: 0,
    meeting_hours: 0,
    break_hours: 0,
    agent_name: ''
  });

  useEffect(() => {
    fetchPayrollData();
  }, []);

  const fetchPayrollData = async () => {
    setLoading(true);
    try {
      const [pRes, cRes, clRes, bRes] = await Promise.all([
        supabase.from('agent_performance_sync').select('*').order('sync_date', { ascending: false }),
        supabase.from('candidates').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('payment_batches').select('*').eq('status', 'pending_payment').order('created_at', { ascending: false })
      ]);
      
      if (pRes.data) setPerformance(pRes.data);
      if (cRes.data) setCandidates(cRes.data);
      if (clRes.data) setClients(clRes.data);
      if (bRes.data) setPendingBatches(bRes.data);
    } catch (err) {
      console.error("Critical Sync Error:", err);
    } finally {
      setLoading(false);
    }
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

  const formatDuration = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    return [hrs, mins, secs].map(v => v < 10 ? '0' + v : v).join(':');
  };

  const filteredAndAggregatedData = useMemo(() => {
    let baseData = performance;
    if (viewMode === 'BATCHER') {
      baseData = performance.filter(p => !p.batch_id);
    }

    const filtered = baseData.filter(p => {
      const pDateStr = p.sync_date || (p.created_at ? p.created_at.split('T')[0] : '');
      if (!pDateStr) return false;
      if (filterMode === 'ALL') return true;
      if (filterMode === 'DAILY') return pDateStr === startDate;
      return pDateStr >= startDate && pDateStr <= endDate;
    });

    const map = new Map<string, any>();
    filtered.forEach(p => {
      const pDateStr = p.sync_date || (p.created_at ? p.created_at.split('T')[0] : 'Unknown');
      const compositeKey = viewMode === 'LEDGER' ? `${p.agent_id}_${pDateStr}` : p.id;

      const existing = map.get(compositeKey) || {
        id: p.id,
        internal_id: '',
        agent_id: p.agent_id,
        full_name: p.full_name || 'System Agent',
        sync_date: pDateStr,
        calls: 0,
        wait_sec: 0,
        talk_sec: 0,
        rate: 0,
        number_of_sets: 0,
        meeting_hours: 0,
        break_hours: 0,
        moe_total: 0,
        net_owed: 0,
        is_paid: p.is_paid,
        batch_id: p.batch_id
      };

      const candidate = candidates.find(c => 
        (c.agent_id && String(c.agent_id) === String(p.agent_id)) || 
        (c.id === p.agent_id)
      );
      
      const hourlyRate = (candidate?.status === 'TRAINING' || candidate?.status === 'PROBATION') ? 5 : 
                         (candidate?.status === 'WORKING' ? 6 : (candidate?.rate_per_hour || 0));
      const sets = p.number_of_sets || 0;
      const meetings = p.meeting_hours || 0;
      const breaks = p.break_hours || 0;
      const pWait = toSeconds(p.wait_time);
      const pTalk = toSeconds(p.talk_time);
      const dailyWorkHrs = (pTalk + pWait) / 3600;
      
      existing.internal_id = candidate?.id || '';
      existing.calls += (p.calls || 0);
      existing.wait_sec += pWait;
      existing.talk_sec += pTalk;
      existing.rate = hourlyRate;
      existing.number_of_sets = sets;
      existing.meeting_hours = meetings;
      existing.break_hours = breaks;

      existing.moe_total = ((dailyWorkHrs + breaks + meetings) * 2) + (sets * 5);
      existing.net_owed = ((dailyWorkHrs + breaks + meetings) * hourlyRate) + (sets * 20) + existing.moe_total;

      map.set(compositeKey, existing);
    });

    return Array.from(map.values())
      .filter(a => {
        const name = a.full_name.toLowerCase().trim();
        const matchesSearch = name.includes(searchTerm.toLowerCase());
        const excludedNames = ['ben pfeiffer', 'matt waggoner', 'aiden price', 'mike ewing'];
        const isExcluded = excludedNames.includes(name);
        return matchesSearch && !isExcluded;
      })
      .sort((a, b) => b.sync_date.localeCompare(a.sync_date));
  }, [performance, candidates, filterMode, startDate, endDate, searchTerm, viewMode]);

  const handleToggleEntry = (id: string) => {
    const next = new Set(selectedEntries);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedEntries(next);
  };

  const handleSelectAll = () => {
    const allIds = filteredAndAggregatedData.map(r => r.id);
    setSelectedEntries(new Set(allIds));
  };

  const handleGenerateBatch = async () => {
    if (!selectedClientId || selectedEntries.size === 0) return;
    setBatchingLoading(true);
    try {
      const selectedRecords = filteredAndAggregatedData.filter(e => selectedEntries.has(e.id));
      const totalAmount = selectedRecords.reduce((sum, r) => sum + r.net_owed, 0);
      const batchName = `Batch ${formatDateEST(new Date(), { dateStyle: 'medium' })} - ${clients.find(c => c.id === selectedClientId)?.name}`;

      const { data: batchData, error: batchError } = await supabase
        .from('payment_batches')
        .insert([{
          client_id: selectedClientId,
          batch_name: batchName,
          total_amount: totalAmount,
          status: 'pending_payment'
        }])
        .select()
        .single();

      if (batchError) throw batchError;

      const { error: updateError } = await supabase
        .from('agent_performance_sync')
        .update({ batch_id: batchData.id })
        .in('id', Array.from(selectedEntries));

      if (updateError) throw updateError;

      alert('Payment Batch Generated Successfully');
      setSelectedEntries(new Set());
      setSelectedClientId('');
      await fetchPayrollData();
    } catch (err: any) {
      console.error("Batch Creation Error:", err);
      alert(`Failed to create batch: ${err.message}`);
    } finally {
      setBatchingLoading(false);
    }
  };

  const handleCancelBatch = async (batchId: string) => {
    if (!window.confirm('Are you sure you want to cancel this batch? Records will be returned to the Batcher pool.')) return;
    try {
      // 1. Release records
      const { error: updateError } = await supabase
        .from('agent_performance_sync')
        .update({ batch_id: null })
        .eq('batch_id', batchId);
      
      if (updateError) throw updateError;

      // 2. Delete the batch
      const { error: deleteError } = await supabase
        .from('payment_batches')
        .delete()
        .eq('id', batchId);
      
      if (deleteError) throw deleteError;

      alert('Batch canceled successfully.');
      await fetchPayrollData();
    } catch (err: any) {
      alert(`Cancel failed: ${err.message}`);
    }
  };

  const globalTotalOwed = useMemo(() => {
    const agentStats = new Map<string, { workHrs: number, rate: number, sets: number, meetings: number, breaks: number }>();
    filteredAndAggregatedData.forEach(row => {
      if (!row.internal_id) return;
      const existing = agentStats.get(row.internal_id) || { 
        workHrs: 0, rate: row.rate, sets: row.number_of_sets, 
        meetings: row.meeting_hours, breaks: row.break_hours 
      };
      existing.workHrs += (row.talk_sec + row.wait_sec) / 3600;
      agentStats.set(row.internal_id, existing);
    });

    let total = 0;
    agentStats.forEach(s => {
      const moe = ((s.workHrs + s.breaks + s.meetings) * 2) + (s.sets * 5);
      total += ((s.workHrs + s.breaks + s.meetings) * s.rate) + (s.sets * 20) + moe;
    });
    return total;
  }, [filteredAndAggregatedData]);

  const handleOpenSettings = (row: any) => {
    setSelectedRecordId(row.id);
    setSelectedAgentId(row.internal_id);
    setSettingsForm({
      number_of_sets: row.number_of_sets || 0,
      meeting_hours: row.meeting_hours || 0,
      break_hours: row.break_hours || 0,
      agent_name: row.full_name
    });
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async () => {
    if (!selectedRecordId) return;
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('agent_performance_sync')
        .update({
          number_of_sets: settingsForm.number_of_sets,
          meeting_hours: settingsForm.meeting_hours,
          break_hours: settingsForm.break_hours
        })
        .eq('id', selectedRecordId);

      if (error) throw error;
      await fetchPayrollData();
      setShowSettingsModal(false);
    } catch (err: any) {
      alert(`Failed to update: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <Layout title="Payroll Engine" subtitle={viewMode === 'BATCHER' ? "Batch Management" : "Performance Reconciliation"} onLogout={onLogout}>
      {/* Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <DollarSign className="size-16" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Net Payables</span>
          <p className="text-3xl font-black text-slate-900 tracking-tighter">
            ${globalTotalOwed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center gap-2 text-forest text-[9px] font-black uppercase">
            <TrendingUp className="size-3" /> Audit Verified
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">View Mode</span>
            <div className="flex gap-2">
              <button 
                onClick={() => setViewMode('LEDGER')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase ${viewMode === 'LEDGER' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}
              >
                Ledger
              </button>
              <button 
                onClick={() => setViewMode('BATCHER')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase ${viewMode === 'BATCHER' ? 'bg-primary text-slate-900' : 'bg-slate-100 text-slate-400'}`}
              >
                Batcher
              </button>
            </div>
           </div>
           <Package className={`size-8 ${viewMode === 'BATCHER' ? 'text-primary' : 'text-slate-200'} transition-colors`} />
        </div>

        <div className="bg-slate-900 p-6 rounded-[2rem] text-white shadow-lg relative overflow-hidden">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Sync Status</span>
          <div className="flex items-center gap-3">
            <div className="size-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
            <p className="text-3xl font-black text-white tracking-tighter">Live Engine</p>
          </div>
        </div>
      </div>

      {/* Controller Suite */}
      <div className="bg-white p-4 rounded-[2.5rem] border border-slate-200 shadow-sm mb-8 space-y-4">
        <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-full lg:w-auto">
            {(['DAILY', 'RANGE', 'ALL'] as const).map(mode => (
              <button 
                key={mode} 
                onClick={() => setFilterMode(mode)}
                className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {mode === 'DAILY' ? 'SINGLE DATE' : mode}
              </button>
            ))}
          </div>

          {(filterMode === 'DAILY' || filterMode === 'RANGE') && (
            <div className="flex items-center gap-4 w-full lg:w-auto">
              <input 
                type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none"
              />
              {filterMode === 'RANGE' && (
                <input 
                  type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none"
                />
              )}
            </div>
          )}

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:flex-none">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input 
                type="text" placeholder="Search Agent..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full lg:w-48 pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase"
              />
            </div>
            {viewMode === 'LEDGER' && (
              <button 
                onClick={() => setShowOverrideModal(true)}
                className="px-6 py-3 bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all flex items-center gap-2"
              >
                <UserCog className="size-4 text-primary" /> Manage Rep Access
              </button>
            )}
          </div>
        </div>

        {viewMode === 'BATCHER' && (
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-4">
               <select 
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className="p-3 bg-slate-100 border border-slate-300 rounded-xl font-black text-[10px] uppercase outline-none focus:border-primary text-slate-950 shadow-sm"
               >
                 <option value="">-- Select Client --</option>
                 {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-4">
                 <span>{selectedEntries.size} Records Selected</span>
                 <button 
                  onClick={handleSelectAll}
                  className="px-3 py-1 bg-slate-950 text-white rounded-lg hover:bg-slate-800 transition-colors"
                 >
                   All Candidates
                 </button>
               </div>
            </div>
            <button 
              disabled={batchingLoading || !selectedClientId || selectedEntries.size === 0}
              onClick={handleGenerateBatch}
              className="px-10 py-3 bg-primary text-slate-900 font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl hover:brightness-105 disabled:opacity-30 active:scale-95 transition-all"
            >
              {batchingLoading ? 'Generating...' : 'Generate Payment Batch'}
            </button>
          </div>
        )}
      </div>

      {/* Main Ledger */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-xl mb-12">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1300px]">
            <thead>
              <tr className="bg-slate-950 text-white">
                {viewMode === 'BATCHER' && <th className="px-4 py-6 w-10"></th>}
                <th className="px-6 py-6 text-[12px] font-black uppercase tracking-widest">Agent Identity</th>
                <th className="px-3 py-6 text-[12px] font-black uppercase tracking-widest text-center">Sync Date</th>
                <th className="px-3 py-6 text-[12px] font-black uppercase tracking-widest text-center">Calls</th>
                <th className="px-3 py-6 text-[12px] font-black uppercase tracking-widest text-center">Talk Time</th>
                <th className="px-3 py-6 text-[12px] font-black uppercase tracking-widest text-center">Wait Time</th>
                <th className="px-3 py-6 text-[12px] font-black uppercase tracking-widest text-center">Work Time</th>
                <th className="px-3 py-6 text-[12px] font-black uppercase tracking-widest text-center">Meeting</th>
                <th className="px-3 py-6 text-[12px] font-black uppercase tracking-widest text-center">Breaks</th>
                <th className="px-3 py-6 text-[12px] font-black uppercase tracking-widest text-center">Zoom Schduled</th>
                <th className="px-3 py-6 text-[12px] font-black uppercase tracking-widest text-center">Rate</th>
                <th className="px-3 py-6 text-[12px] font-black uppercase tracking-widest text-center">Moe's Total</th>
                <th className="px-6 py-6 text-[12px] font-black uppercase tracking-widest text-right">Net Owed</th>
                <th className="px-6 py-6 text-[12px] font-black uppercase tracking-widest text-center">Status</th>
                {viewMode === 'LEDGER' && <th className="px-6 py-6 text-center"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndAggregatedData.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-48 text-center text-slate-300 uppercase text-[12px] font-black">No matching records</td>
                </tr>
              ) : filteredAndAggregatedData.map((row, idx) => (
                <tr 
                  key={idx} 
                  className={`hover:bg-slate-50 transition-colors group ${row.is_paid ? 'bg-[#D1FAE5]' : ''}`}
                >
                  {viewMode === 'BATCHER' && (
                    <td className="px-4 py-8">
                      <input 
                        type="checkbox" 
                        checked={selectedEntries.has(row.id)}
                        onChange={() => handleToggleEntry(row.id)}
                        className="size-5 rounded-md border-slate-300 text-slate-900 focus:ring-primary"
                      />
                    </td>
                  )}
                  <td className="px-6 py-8 font-black text-slate-950 text-lg">
                    {row.full_name}
                  </td>
                  <td className="px-3 py-8 text-center text-[11px] font-black text-slate-400 uppercase">
                    {row.sync_date}
                  </td>
                  <td className="px-3 py-8 text-center">
                    <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-black text-sm text-slate-900">
                      {row.calls}
                    </span>
                  </td>
                  <td className="px-3 py-8 text-center font-mono text-emerald-600 text-base font-black">
                    {formatDuration(row.talk_sec)}
                  </td>
                  <td className="px-3 py-8 text-center font-mono text-amber-600 text-base font-black">
                    {formatDuration(row.wait_sec)}
                  </td>
                  <td className="px-3 py-8 text-center font-mono text-slate-950 text-base font-black">
                    {formatDuration(row.talk_sec + row.wait_sec)}
                  </td>
                  <td className="px-3 py-8 text-center font-black text-blue-600 text-base">
                    {row.meeting_hours}h
                  </td>
                  <td className="px-3 py-8 text-center font-black text-orange-600 text-base">
                    {row.break_hours}h
                  </td>
                  <td className="px-3 py-8 text-center font-black text-slate-900 text-base">
                    {row.number_of_sets}
                  </td>
                  <td className="px-3 py-8 text-center text-slate-950 font-black text-sm">
                    ${row.rate}/hr
                  </td>
                  <td className="px-3 py-8 text-center text-amber-700 font-black text-sm">
                    ${row.moe_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-8 text-right text-forest font-black text-xl tracking-tight">
                    ${row.net_owed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-8 text-center">
                    {row.is_paid ? (
                      <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
                        <CheckCircle2 className="size-3.5" /> PAID
                      </span>
                    ) : row.batch_id ? (
                      <span className="px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                        BATCHED
                      </span>
                    ) : (
                      <span className="px-4 py-2 bg-slate-100 text-slate-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                        PENDING
                      </span>
                    )}
                  </td>
                  {viewMode === 'LEDGER' && (
                    <td className="px-6 py-8 text-center">
                      {!row.is_paid && (
                        <button 
                          onClick={() => handleOpenSettings(row)}
                          className="p-2 text-slate-300 hover:text-slate-950 rounded-lg transition-colors"
                        >
                          <Settings className="size-5" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Batches Section */}
      {pendingBatches.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-xl mb-12 animate-in slide-in-from-bottom-4">
          <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
             <div className="flex items-center gap-3">
               <Package className="size-5 text-primary" />
               <h3 className="font-black text-slate-900 text-lg">Active Payment Batches</h3>
             </div>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{pendingBatches.length} Outstanding</span>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead>
                   <tr className="bg-slate-50">
                      <th className="px-10 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch Reference</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total Amount</th>
                      <th className="px-10 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {pendingBatches.map(batch => (
                     <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-10 py-6 font-black text-slate-900">{batch.batch_name}</td>
                        <td className="px-6 py-6 font-black text-slate-500 uppercase text-[10px]">{clients.find(c => c.id === batch.client_id)?.name || 'Unknown'}</td>
                        <td className="px-6 py-6 text-center font-black text-slate-950">${batch.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-10 py-6 text-right">
                           <button 
                            onClick={() => handleCancelBatch(batch.id)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                           >
                              <Trash2 className="size-3.5" /> Cancel Batch
                           </button>
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>
        </div>
      )}

      {/* Adjustments Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-xl animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="size-12 bg-slate-900 rounded-2xl flex items-center justify-center text-primary"><Settings className="size-6" /></div>
                <div><h4 className="text-xl font-black text-slate-950">Agent Adjustments</h4><p className="text-[9px] font-black text-slate-400 uppercase">{settingsForm.agent_name}</p></div>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-300 hover:text-slate-950"><X className="size-5" /></button>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 flex items-center gap-2"><Target className="size-3" /> Number of Sets</label>
                <input type="number" value={settingsForm.number_of_sets} onChange={e => setSettingsForm({...settingsForm, number_of_sets: parseInt(e.target.value) || 0})} className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl font-black text-lg outline-none text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 flex items-center gap-2"><Users className="size-3" /> Meetings</label>
                  <input type="number" step="0.5" value={settingsForm.meeting_hours} onChange={e => setSettingsForm({...settingsForm, meeting_hours: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl font-black text-lg text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1 flex items-center gap-2"><Coffee className="size-3" /> Breaks</label>
                  <input type="number" step="0.5" value={settingsForm.break_hours} onChange={e => setSettingsForm({...settingsForm, break_hours: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-slate-950 border border-slate-800 rounded-2xl font-black text-lg text-white" />
                </div>
              </div>
              <button onClick={handleSaveSettings} disabled={savingSettings} className="w-full py-5 bg-slate-950 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3">
                {savingSettings ? <Loader2 className="size-4 animate-spin" /> : <><Save className="size-4 text-primary" /> Apply Adjustments</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
