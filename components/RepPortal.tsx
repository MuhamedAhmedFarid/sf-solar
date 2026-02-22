import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { Layout } from './Layout';
import { AgentPerformance } from '../types';
import { todayEST, formatDateEST, getMondayOfWeekEST } from '../utils/dateEST';
import { 
  Phone, Target, MessageCircle, BarChart3, ListChecks, 
  TrendingUp, Clock, Zap, Calendar, Loader2, 
  ChevronRight, ArrowUpRight, History, ShieldAlert,
  Filter, Search, ChevronDown, Coffee, Users, CheckCircle2, DollarSign
} from 'lucide-react';

type RepFilterMode = 'DAILY' | 'WEEKLY' | 'BI-WEEKLY' | 'MONTHLY' | 'RANGE';

export const RepPortal: React.FC<{ rep: any; onLogout: () => void }> = ({ rep, onLogout }) => {
  const [performance, setPerformance] = useState<AgentPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering & Aggregation States
  const [filterMode, setFilterMode] = useState<RepFilterMode>('DAILY');
  const [startDate, setStartDate] = useState(todayEST());
  const [endDate, setEndDate] = useState(todayEST());

  useEffect(() => {
    fetchRepPerformance();
  }, [rep.id, rep.agent_id]);

  const fetchRepPerformance = async () => {
    setLoading(true);
    try {
      const targetSyncId = rep.agent_id || rep.id;
      const { data, error } = await supabase
        .from('agent_performance_sync')
        .select('*')
        .eq('agent_id', targetSyncId)
        .order('sync_date', { ascending: false });

      if (error) throw error;
      if (data) setPerformance(data);
    } catch (err) {
      console.error("Error fetching rep performance:", err);
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

  const getStartOfWeek = (dateStr: string) => getMondayOfWeekEST(dateStr);

  const getMonthKey = (dateStr: string) => {
    return formatDateEST(dateStr + 'T12:00:00', { month: 'long', year: 'numeric' });
  };

  // 1. First, get the subset of performance records based on current date filters
  const currentFilteredRecords = useMemo(() => {
    return performance.filter(p => {
      const date = p.sync_date || '';
      if (filterMode === 'DAILY') return date === startDate;
      if (filterMode === 'RANGE') return date >= startDate && date <= endDate;
      // For other modes like Weekly/Monthly, if no range is active, we might show all,
      // but usually the date picker still acts as a constraint in this portal.
      // If we are in Monthly mode, we could filter by the month of startDate, etc.
      // To keep it strictly accurate to user selection:
      if (filterMode === 'WEEKLY' || filterMode === 'MONTHLY' || filterMode === 'BI-WEEKLY') {
        // If they pick Monthly, they usually mean "this month" starting from startDate
        const start = new Date(startDate);
        const end = new Date(endDate);
        const current = new Date(date);
        return current >= start && current <= end;
      }
      return true;
    });
  }, [performance, filterMode, startDate, endDate]);

  // 2. Aggregate table data from the filtered set
  const aggregatedData = useMemo(() => {
    const map = new Map<string, any>();

    currentFilteredRecords.forEach(p => {
      let groupKey = p.sync_date || 'Unknown';
      if (filterMode === 'WEEKLY') groupKey = `Week of ${getStartOfWeek(groupKey)}`;
      else if (filterMode === 'MONTHLY') groupKey = getMonthKey(groupKey);
      else if (filterMode === 'BI-WEEKLY') {
        const d = new Date(groupKey);
        const fortnight = Math.floor(d.getDate() / 14);
        groupKey = `Fortnight ${fortnight + 1}, ${getMonthKey(groupKey)}`;
      }

      const existing = map.get(groupKey) || {
        key: groupKey,
        calls: 0,
        talk_sec: 0,
        wait_sec: 0,
        records: 0,
        is_paid: true
      };

      existing.calls += (p.calls || 0);
      existing.talk_sec += toSeconds(p.talk_time);
      existing.wait_sec += toSeconds(p.wait_time);
      existing.records += 1;
      existing.number_of_sets = (existing.number_of_sets || 0) + (p.number_of_sets || 0);
      existing.meeting_hours = (existing.meeting_hours || 0) + (p.meeting_hours || 0);
      existing.break_hours = (existing.break_hours || 0) + (p.break_hours || 0);
      if (!p.is_paid) existing.is_paid = false;

      map.set(groupKey, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [currentFilteredRecords, filterMode]);

  // 3. Accurate Stats Logic: Using only the CURRENT filtered period
  const stats = useMemo(() => {
    const periodPerf = currentFilteredRecords;
    const unpaidInPeriod = periodPerf.filter(p => !p.is_paid);
    const paidInPeriod = periodPerf.filter(p => p.is_paid);

    const calc = (list: AgentPerformance[]) => ({
      calls: list.reduce((s, p) => s + (p.calls || 0), 0),
      seconds: list.reduce((s, p) => s + toSeconds(p.talk_time) + toSeconds(p.wait_time), 0),
    });

    const periodStats = calc(periodPerf);
    const paidStats = calc(paidInPeriod);
    const pendingStats = calc(unpaidInPeriod);

    // Sum per-record adjustments for the period
    const pendingSets = unpaidInPeriod.reduce((sum, p) => sum + (p.number_of_sets || 0), 0);
    const pendingMeetings = unpaidInPeriod.reduce((sum, p) => sum + (p.meeting_hours || 0), 0);
    const pendingBreaks = unpaidInPeriod.reduce((sum, p) => sum + (p.break_hours || 0), 0);

    const hourlyRate = (rep.status === 'TRAINING' || rep.status === 'PROBATION') ? 5 : 
                       (rep.status === 'WORKING' ? 6 : (rep.rate_per_hour || 0));

    const pendingEarnings = ((pendingStats.seconds / 3600 + pendingMeetings + pendingBreaks) * hourlyRate) + (pendingSets * 20);

    return {
      total: periodStats,
      paid: paidStats,
      pending: pendingStats,
      pendingEarnings,
      pendingSets
    };
  }, [currentFilteredRecords, rep]);

  const paidHistory = useMemo(() => performance.filter(p => p.is_paid), [performance]);

  if (loading) {
    return (
      <Layout title="Rep Portal" subtitle="Syncing Performance..." onLogout={onLogout} user={rep}>
        <div className="h-96 flex flex-col items-center justify-center gap-4">
          <Loader2 className="size-10 text-primary animate-spin" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retrieving Secure Data...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Rep Portal: ${rep.alias || rep.name || rep.username}`} subtitle="Live Performance Dashboard" onLogout={onLogout} user={rep}>
      {/* Top Metrics Grid - Now strictly reactive to filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Zap className="size-16" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Pending Calls</span>
          <p className="text-5xl font-black text-slate-900 tracking-tighter">{stats.pending.calls}</p>
          <div className="mt-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-amber-600 text-[9px] font-black uppercase">
              <Clock className="size-3" /> Selected Period
            </div>
            <div className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">
              {stats.paid.calls} Paid / {stats.total.calls} Total in Range
            </div>
          </div>
        </div>

        <div className="bg-slate-950 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign className="size-16 text-primary" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Unsettled Balance</span>
          <p className="text-5xl font-black text-primary tracking-tighter">${stats.pendingEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <div className="mt-3 flex items-center gap-1.5 text-primary text-[9px] font-black uppercase tracking-widest">
            <TrendingUp className="size-3" /> Selected Range Owed
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Pending Work Time</span>
          <p className="text-5xl font-black text-slate-900 tracking-tighter">{Math.floor(stats.pending.seconds / 3600)}h {Math.floor((stats.pending.seconds % 3600) / 60)}m</p>
          <div className="mt-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-blue-500 text-[9px] font-black uppercase">
              <Clock className="size-3" /> Unpaid Duration
            </div>
            <div className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">
              {Math.floor(stats.paid.seconds / 3600)}h {Math.floor((stats.paid.seconds % 3600) / 60)}m Settled
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Pending Sets</span>
          <p className="text-5xl font-black text-slate-900 tracking-tighter">{stats.pendingSets}</p>
          <div className="mt-3 flex items-center gap-1.5 text-slate-400 text-[9px] font-black uppercase tracking-widest">
            <Target className="size-3" /> Target Period
          </div>
        </div>
      </div>

      {/* Filter Suite */}
      <div className="bg-white p-4 rounded-[2.5rem] border border-slate-200 shadow-sm mb-8 flex flex-col lg:flex-row gap-6 items-center justify-between">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-2xl w-full lg:w-auto">
          {(['DAILY', 'WEEKLY', 'MONTHLY', 'RANGE'] as RepFilterMode[]).map(mode => (
            <button 
              key={mode} 
              onClick={() => setFilterMode(mode)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 w-full lg:w-auto px-2">
           <div className="flex flex-col">
             <span className="text-[8px] font-black text-slate-400 uppercase ml-1">
               {filterMode === 'DAILY' ? 'Target Date' : 'Start Date'}
             </span>
             <input 
              type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-slate-950 transition-all"
             />
           </div>
           
           {(filterMode === 'RANGE' || filterMode === 'WEEKLY' || filterMode === 'MONTHLY') && (
             <div className="flex flex-col">
               <span className="text-[8px] font-black text-slate-400 uppercase ml-1">End Date</span>
               <input 
                type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 outline-none focus:border-slate-950 transition-all"
               />
             </div>
           )}
        </div>
      </div>

      {/* Performance Ledger */}
      <div className="bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-xl mb-12">
        <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/20 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Performance Breakdown</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Status and payment reconciliation</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <History className="size-3" /> Daily Sync
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <th className="px-10 py-6">Period</th>
                <th className="px-6 py-6 text-center">Calls</th>
                <th className="px-6 py-6 text-center">Talk Time</th>
                <th className="px-6 py-6 text-center">Wait Time</th>
                <th className="px-6 py-6 text-center">Work Time</th>
                <th className="px-6 py-6 text-center">Zoom Schduled</th>
                <th className="px-6 py-6 text-center">Meetings</th>
                <th className="px-6 py-6 text-center">Breaks</th>
                <th className="px-6 py-6 text-center">Status</th>
                <th className="px-10 py-6 text-right">Estimated Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aggregatedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-10 py-24 text-center">
                    <p className="text-slate-300 font-bold uppercase text-xs tracking-widest">No matching records in selected range</p>
                  </td>
                </tr>
              ) : aggregatedData.map((item, idx) => {
                const workSec = item.talk_sec + item.wait_sec;
                const hourlyRate = (rep.status === 'TRAINING' || rep.status === 'PROBATION') ? 5 : 
                                   (rep.status === 'WORKING' ? 6 : (rep.rate_per_hour || 0));
                const rowEarnings = ((workSec / 3600) + (item.meeting_hours || 0) + (item.break_hours || 0)) * hourlyRate + ((item.number_of_sets || 0) * 20);

                return (
                  <tr key={idx} className={`hover:bg-slate-50/80 transition-all ${item.is_paid ? 'bg-emerald-50/40' : ''}`}>
                    <td className="px-10 py-6">
                      <p className="font-black text-slate-900 text-base">{item.key}</p>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <span className={`inline-block px-3 py-1 rounded-lg font-black text-sm ${item.is_paid ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'}`}>
                        {item.calls}
                      </span>
                    </td>
                    <td className="px-6 py-6 text-center font-mono text-emerald-600 font-black text-sm">
                      {formatDuration(item.talk_sec)}
                    </td>
                    <td className="px-6 py-6 text-center font-mono text-amber-600 font-black text-sm">
                      {formatDuration(item.wait_sec)}
                    </td>
                    <td className="px-6 py-6 text-center font-mono text-slate-900 font-black text-sm">
                      {formatDuration(workSec)}
                    </td>
                    <td className="px-6 py-6 text-center font-black text-slate-900 text-sm">
                      {item.number_of_sets ?? 0}
                    </td>
                    <td className="px-6 py-6 text-center font-black text-blue-600 text-sm">
                      {(item.meeting_hours ?? 0)}h
                    </td>
                    <td className="px-6 py-6 text-center font-black text-orange-600 text-sm">
                      {(item.break_hours ?? 0)}h
                    </td>
                    <td className="px-6 py-6 text-center">
                       {item.is_paid ? (
                         <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-[9px] font-black uppercase rounded-full shadow-sm">
                           <CheckCircle2 className="size-3.5" /> PAID
                         </span>
                       ) : (
                         <span className="px-3 py-1.5 bg-slate-100 text-slate-400 text-[9px] font-black uppercase rounded-full">
                           PENDING
                         </span>
                       )}
                    </td>
                    <td className="px-10 py-6 text-right font-black text-slate-900 text-lg tracking-tight">
                      ${rowEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paid History Grid */}
      {paidHistory.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-sm mb-12 animate-in fade-in duration-500">
           <div className="flex items-center gap-4 mb-8">
              <div className="size-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
                <History className="size-6" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Disbursement History</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Past settlement cycles successfully processed</p>
              </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from(new Set(paidHistory.map(p => p.batch_id))).filter(Boolean).map((batchId, idx) => {
                const batchPerf = paidHistory.filter(p => p.batch_id === batchId);
                const totalSec = batchPerf.reduce((s, p) => s + toSeconds(p.talk_time) + toSeconds(p.wait_time), 0);
                const hourlyRate = (rep.status === 'TRAINING' || rep.status === 'PROBATION') ? 5 : 
                                   (rep.status === 'WORKING' ? 6 : (rep.rate_per_hour || 0));
                const totalPay = (totalSec / 3600) * hourlyRate;
                return (
                  <div key={idx} className="bg-slate-50 border border-slate-100 rounded-3xl p-6 hover:border-emerald-200 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Verification ID</span>
                      <CheckCircle2 className="size-3 text-emerald-500" />
                    </div>
                    <p className="text-[10px] font-black text-slate-900 mb-6 truncate">{batchId}</p>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Settled Amount</p>
                        <p className="text-lg font-black text-emerald-600 tracking-tight">${totalPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-900">{(totalSec / 3600).toFixed(1)}h</p>
                      </div>
                    </div>
                  </div>
                );
              })}
           </div>
        </div>
      )}
    </Layout>
  );
};
