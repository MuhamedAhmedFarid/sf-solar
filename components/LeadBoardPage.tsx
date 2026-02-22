import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabase';
import { Copy, Loader2, Calendar, ArrowLeft, Trophy, Crown, Medal, Sparkles } from 'lucide-react';
import { todayEST, getWeekRangeEST, formatDateEST, formatLongEST, formatRangeShortEST } from '../utils/dateEST';

interface ScoreboardRow {
  id: string;
  agent_id: string;
  full_name: string;
  calls: number;
  number_of_sets: number;
  sync_date: string;
}

interface LeaderboardHistoryRow {
  id: string;
  created_at: string;
  agent_name: string;
  synced_date: string;
  calls: number;
  sets: number;
  ranking: number;
}

type RangeMode = 'TODAY' | 'RANGE';

function formatRangeLabel(mode: RangeMode, startDate: string, endDate: string): string {
  if (mode === 'TODAY') return formatLongEST(new Date());
  return formatRangeShortEST(startDate, endDate);
}

const defaultRange = getWeekRangeEST();

export const LeadBoardPage: React.FC = () => {
  const [rangeMode, setRangeMode] = useState<RangeMode>('TODAY');
  const [startDate, setStartDate] = useState(defaultRange[0]);
  const [endDate, setEndDate] = useState(defaultRange[1]);
  const [rawRows, setRawRows] = useState<ScoreboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<LeaderboardHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [copySaving, setCopySaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const dateRange = useMemo((): [string, string] => {
    if (rangeMode === 'TODAY') {
      const t = todayEST();
      return [t, t];
    }
    return [startDate, endDate];
  }, [rangeMode, startDate, endDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [start, end] = dateRange;
    try {
      const { data, error } = await supabase
        .from('agent_performance_sync')
        .select('id, agent_id, full_name, calls, number_of_sets, sync_date')
        .gte('sync_date', start)
        .lte('sync_date', end)
        .order('sync_date', { ascending: false });

      if (error) throw error;
      setRawRows((data ?? []) as ScoreboardRow[]);
    } catch (e) {
      console.error('Lead board fetch error:', e);
      setRawRows([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const rows = useMemo((): ScoreboardRow[] => {
    if (rangeMode === 'TODAY' || rawRows.length === 0) return rawRows;
    // RANGE: aggregate by agent (sum calls & sets)
    const byAgent = new Map<string, { full_name: string; calls: number; sets: number }>();
    rawRows.forEach((r) => {
      const key = r.agent_id || r.full_name || r.id;
      const cur = byAgent.get(key);
      const calls = (r.calls ?? 0) + (cur?.calls ?? 0);
      const sets = (r.number_of_sets ?? 0) + (cur?.sets ?? 0);
      byAgent.set(key, {
        full_name: r.full_name || cur?.full_name || '—',
        calls,
        sets,
      });
    });
    return Array.from(byAgent.entries())
      .map(([key, v]) => ({ key, full_name: v.full_name, calls: v.calls, sets: v.sets }))
      .sort((a, b) => (b.sets !== a.sets ? b.sets - a.sets : b.calls - a.calls))
      .map((r, i) => ({
        id: `agg-${r.key}-${i}`,
        agent_id: r.key,
        full_name: r.full_name,
        calls: r.calls,
        number_of_sets: r.sets,
        sync_date: dateRange[0],
      }));
  }, [rangeMode, rawRows, dateRange]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('leaderboard_history')
        .select('id, created_at, agent_name, synced_date, calls, sets, ranking')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory((data ?? []) as LeaderboardHistoryRow[]);
    } catch (e) {
      console.error('Leaderboard history fetch error:', e);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const showMessage = (text: string, ok: boolean) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleCopyAndSave = async () => {
    const el = document.getElementById('scoreboard-capture');
    if (!el) {
      showMessage('Scoreboard element not found.', false);
      return;
    }
    if (rows.length === 0) {
      showMessage('No data to save.', false);
      return;
    }
    setCopySaving(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(el, {
        backgroundColor: '#fcfbf8',
        pixelRatio: 2,
        cacheBust: true,
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();

      if (navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);
      }

      const toInsert = rows.map((row, idx) => ({
        agent_name: row.full_name || '—',
        synced_date: row.sync_date || todayEST(),
        calls: row.calls ?? 0,
        sets: row.number_of_sets ?? 0,
        ranking: idx + 1,
      }));

      const { error: insertError } = await supabase
        .from('leaderboard_history')
        .insert(toInsert);

      if (insertError) throw insertError;

      showMessage('Image copied to clipboard and saved to history.', true);
      fetchHistory();
    } catch (e: any) {
      console.error('Copy/save error:', e);
      showMessage(e?.message || 'Copy or save failed.', false);
    } finally {
      setCopySaving(false);
    }
  };

  const recordDate = (created_at: string) =>
    created_at ? formatDateEST(created_at, { dateStyle: 'medium' }) : '—';

  const historyBySnapshot = React.useMemo(() => {
    const map = new Map<string, LeaderboardHistoryRow[]>();
    history.forEach((row) => {
      const key = row.created_at ? row.created_at.slice(0, 19) : row.id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    });
    return Array.from(map.entries())
      .map(([_, rows]) => ({
        created_at: rows[0]?.created_at ?? '',
        rows: [...rows].sort((a, b) => a.ranking - b.ranking),
      }))
      .sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
  }, [history]);

  const handleBack = () => {
    window.location.href = '/';
  };

  const rankStyle = (idx: number) => {
    if (idx === 0) return 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30';
    if (idx === 1) return 'bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-lg shadow-slate-400/30';
    if (idx === 2) return 'bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-lg shadow-amber-700/30';
    return 'bg-slate-100 text-slate-600 border border-slate-200';
  };

  const RankBadge = ({ idx }: { idx: number }) => {
    const rank = idx + 1;
    if (rank === 1) return (
      <span className={`inline-flex items-center justify-center size-10 rounded-full font-black text-lg ${rankStyle(idx)}`} title="1st Place">
        <Crown className="size-5" />
      </span>
    );
    if (rank === 2) return (
      <span className={`inline-flex items-center justify-center size-10 rounded-full font-black text-lg ${rankStyle(idx)}`} title="2nd Place">
        <Medal className="size-5" />
      </span>
    );
    if (rank === 3) return (
      <span className={`inline-flex items-center justify-center size-10 rounded-full font-black text-lg ${rankStyle(idx)}`} title="3rd Place">
        <Medal className="size-5 scale-90" />
      </span>
    );
    return (
      <span className={`inline-flex items-center justify-center size-9 rounded-xl font-black text-sm ${rankStyle(idx)}`}>
        {rank}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-solar-bg text-slate-900">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-sm font-bold transition-colors"
          >
            <ArrowLeft className="size-4" /> Back
          </button>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">EST</span>
        </div>

        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-slate-900 shadow-xl shadow-primary/30 mb-4">
            <Trophy className="size-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-2 tracking-tighter">
            Daily Lead Board
          </h1>
          <p className="text-primary font-bold text-sm uppercase tracking-[0.2em] mb-1">
            <Sparkles className="inline-block size-4 mr-1 -translate-y-0.5" /> Live Scoreboard
          </p>
          <p className="text-slate-500 text-sm font-semibold">
            {formatRangeLabel(rangeMode, dateRange[0], dateRange[1])} · No login required
          </p>
        </div>

        {/* Tabs: Today | Date range */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
            {(['TODAY', 'RANGE'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setRangeMode(mode)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  rangeMode === mode
                    ? 'bg-primary text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {mode === 'TODAY' ? 'Today' : 'Date range'}
              </button>
            ))}
          </div>
          {rangeMode === 'RANGE' && (
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                From
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold text-xs outline-none focus:border-primary"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                To
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-bold text-xs outline-none focus:border-primary"
                />
              </label>
            </div>
          )}
        </div>

        {/* Live Scoreboard - gamified */}
        <div className="mb-10">
          <div
            id="scoreboard-capture"
            className="rounded-[2.5rem] overflow-hidden border-2 border-slate-200 bg-white shadow-xl shadow-slate-200/50 ring-2 ring-primary/5"
          >
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
                  <th className="px-6 py-5 text-xs font-black uppercase tracking-widest w-24">Rank</th>
                  <th className="px-6 py-5 text-xs font-black uppercase tracking-widest">Agent Name</th>
                  <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-center">Zoom Schduled</th>
                  <th className="px-6 py-5 text-xs font-black uppercase tracking-widest text-center">Calls</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-slate-400">
                      <Loader2 className="inline-block size-8 animate-spin text-primary" />
                      <p className="mt-3 font-bold uppercase text-xs tracking-widest">Loading scoreboard…</p>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-slate-400">
                      <Trophy className="inline-block size-10 text-slate-300 mb-2" />
                      <p className="font-bold uppercase text-xs tracking-widest">No records for this period</p>
                      <p className="text-[10px] mt-1">Change date or check back later</p>
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`transition-all ${
                        idx === 0
                          ? 'bg-gradient-to-r from-amber-50 to-white border-l-4 border-amber-400'
                          : idx === 1
                            ? 'bg-gradient-to-r from-slate-50 to-white border-l-4 border-slate-400'
                            : idx === 2
                              ? 'bg-gradient-to-r from-amber-50/50 to-white border-l-4 border-amber-600'
                              : idx % 2 === 0
                                ? 'bg-white'
                                : 'bg-slate-50/50'
                      } hover:bg-primary/5`}
                    >
                      <td className="px-6 py-4">
                        <RankBadge idx={idx} />
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${idx < 3 ? 'text-slate-900 text-base' : 'text-slate-800 text-sm'}`}>
                          {idx === 0 && <Crown className="inline-block size-4 text-amber-500 mr-2 -translate-y-0.5" />}
                          {row.full_name || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-1.5 rounded-xl font-black ${
                          idx === 0 ? 'bg-primary text-slate-900 text-lg shadow-md' : 'bg-primary/10 text-primary text-base'
                        }`}>
                          {row.number_of_sets ?? 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-black text-slate-700 tabular-nums">
                          {row.calls ?? 0}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Zoom Schduled = SETS · All times Eastern
            </span>
            <button
              type="button"
              onClick={handleCopyAndSave}
              disabled={copySaving || loading}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-amber-500 text-slate-900 text-xs font-black uppercase tracking-widest rounded-2xl hover:shadow-lg hover:shadow-primary/30 disabled:opacity-50 transition-all shadow-md active:scale-[0.98]"
            >
              {copySaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Copy className="size-4" />
              )}
              Copy & Save to History
            </button>
          </div>
          {message && (
            <p
              className={`mt-2 text-sm font-semibold ${message.ok ? 'text-emerald-600' : 'text-rose-600'}`}
            >
              {message.text}
            </p>
          )}
        </div>

        {/* Lead Board History */}
        <section className="pt-4 border-t border-slate-200">
          <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="size-5 text-primary" />
            Past Scoreboards
          </h2>
          {historyLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : historyBySnapshot.length === 0 ? (
            <p className="text-slate-500 text-sm py-8">No saved history yet.</p>
          ) : (
            <div className="space-y-6">
              {historyBySnapshot.map(({ created_at, rows: snapshotRows }) => (
                <div
                  key={created_at}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
                >
                  <p className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-50 border-b border-slate-100">
                    Saved {recordDate(created_at)}
                  </p>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-950 text-white">
                        <th className="px-4 py-2 font-bold">Rank</th>
                        <th className="px-4 py-2 font-bold">Agent Name</th>
                        <th className="px-4 py-2 font-bold text-center">SETS</th>
                        <th className="px-4 py-2 font-bold text-center">Calls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshotRows.map((row, idx) => (
                        <tr
                          key={row.id}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-primary/5'}
                        >
                          <td className="px-4 py-2 font-bold text-slate-700">{row.ranking}</td>
                          <td className="px-4 py-2 font-bold text-slate-900">{row.agent_name}</td>
                          <td className="px-4 py-2 text-center font-bold text-primary">{row.sets}</td>
                          <td className="px-4 py-2 text-center font-bold text-slate-700">{row.calls}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
