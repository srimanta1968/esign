import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiService } from '../services/api';

interface ComplianceReport {
  totalActions: number;
  distinctUsers: number;
  complianceScore: number;
  actionBreakdown: Record<string, number>;
  topUsers: Array<{ user_id: string; user_email: string; action_count: number }>;
}

interface ComplianceAlert {
  id: string;
  rule_type: string;
  triggered_at: string;
  details: string;
  acknowledged: boolean;
}

interface AlertRule {
  rule_type: string;
  threshold: number;
  enabled: boolean;
}

function ComplianceDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showRuleConfig, setShowRuleConfig] = useState<boolean>(false);
  const [ruleForm, setRuleForm] = useState<AlertRule>({ rule_type: 'failed_logins', threshold: 5, enabled: true });
  const [savingRule, setSavingRule] = useState<boolean>(false);
  const [ruleSuccess, setRuleSuccess] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const fetchReport = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const qs = params.toString();

      const [reportRes, alertsRes] = await Promise.all([
        ApiService.get<ComplianceReport>(`/compliance/report${qs ? `?${qs}` : ''}`),
        ApiService.get<{ alerts: ComplianceAlert[] }>('/compliance/alerts'),
      ]);

      if (reportRes.success && reportRes.data) {
        setReport(reportRes.data);
      }
      if (alertsRes.success && alertsRes.data) {
        setAlerts(alertsRes.data.alerts || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchReport();
    }
  }, [fetchReport, user]);

  const handleAcknowledge = async (alertId: string): Promise<void> => {
    const res = await ApiService.patch(`/compliance/alerts/${alertId}/acknowledge`);
    if (res.success) {
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a)));
    }
  };

  const handleSaveRule = async (): Promise<void> => {
    setSavingRule(true);
    setRuleSuccess(false);
    try {
      const res = await ApiService.post('/compliance/alerts/config', ruleForm);
      if (res.success) {
        setRuleSuccess(true);
        setTimeout(() => setRuleSuccess(false), 3000);
      }
    } catch {
      /* ignore */
    } finally {
      setSavingRule(false);
    }
  };

  const handleExport = async (): Promise<void> => {
    setExporting(true);
    try {
      const token = ApiService.getToken();
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const response = await fetch(`/api/compliance/export?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch {
      /* ignore */
    } finally {
      setExporting(false);
    }
  };

  const scoreColor = (score: number): string => {
    if (score > 80) return 'text-green-600';
    if (score > 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const scoreBg = (score: number): string => {
    if (score > 80) return 'bg-green-50 border-green-200';
    if (score > 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  if (user?.role !== 'admin') return null;

  const maxBreakdown = report?.actionBreakdown
    ? Math.max(...Object.values(report.actionBreakdown), 1)
    : 1;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor compliance metrics and alerts</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {exporting ? 'Generating...' : 'Generate PDF Report'}
        </button>
      </div>

      {/* Date range selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <button
            onClick={fetchReport}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Update Report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500">Loading compliance data...</p>
        </div>
      ) : report ? (
        <>
          {/* Summary cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-gray-500 text-sm font-medium">Total Actions</h3>
              <p className="text-3xl font-bold text-gray-900 mt-1">{report.totalActions.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-gray-500 text-sm font-medium">Distinct Users</h3>
              <p className="text-3xl font-bold text-indigo-600 mt-1">{report.distinctUsers}</p>
            </div>
            <div className={`rounded-xl p-6 shadow-sm border ${scoreBg(report.complianceScore)}`}>
              <h3 className="text-gray-500 text-sm font-medium">Compliance Score</h3>
              <p className={`text-3xl font-bold mt-1 ${scoreColor(report.complianceScore)}`}>
                {report.complianceScore}%
              </p>
            </div>
          </div>

          {/* Action breakdown chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Action Breakdown</h2>
            {report.actionBreakdown && Object.keys(report.actionBreakdown).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(report.actionBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([actionName, count]) => (
                    <div key={actionName} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-40 shrink-0 truncate">
                        {actionName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-6 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: `${Math.max((count / maxBreakdown) * 100, 4)}%` }}
                        >
                          <span className="text-xs text-white font-medium">{count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No action data available</p>
            )}
          </div>

          {/* Top users table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Top Users</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Rank</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">User</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(report.topUsers || []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-500">No user data</td>
                    </tr>
                  ) : (
                    report.topUsers.map((u, i) => (
                      <tr key={u.user_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 font-medium">{i + 1}</td>
                        <td className="px-4 py-3 text-gray-900">{u.user_email || u.user_id}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                            {u.action_count}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alerts section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Compliance Alerts</h2>
              <button
                onClick={() => setShowRuleConfig(!showRuleConfig)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Configure Rules
              </button>
            </div>

            {/* Rule config form */}
            {showRuleConfig && (
              <div className="p-6 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Configure Alert Rule</h3>
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Rule Type</label>
                    <select
                      value={ruleForm.rule_type}
                      onChange={(e) => setRuleForm({ ...ruleForm, rule_type: e.target.value })}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    >
                      <option value="failed_logins">Failed Logins</option>
                      <option value="unusual_activity">Unusual Activity</option>
                      <option value="bulk_downloads">Bulk Downloads</option>
                      <option value="after_hours_access">After Hours Access</option>
                      <option value="permission_changes">Permission Changes</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Threshold</label>
                    <input
                      type="number"
                      min={1}
                      value={ruleForm.threshold}
                      onChange={(e) => setRuleForm({ ...ruleForm, threshold: Number(e.target.value) })}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-gray-500">Enabled</label>
                    <button
                      onClick={() => setRuleForm({ ...ruleForm, enabled: !ruleForm.enabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        ruleForm.enabled ? 'bg-indigo-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          ruleForm.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <button
                    onClick={handleSaveRule}
                    disabled={savingRule}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {savingRule ? 'Saving...' : 'Save Rule'}
                  </button>
                  {ruleSuccess && (
                    <span className="text-sm text-green-600 font-medium">Rule saved successfully!</span>
                  )}
                </div>
              </div>
            )}

            <div className="divide-y divide-gray-50">
              {alerts.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">No alerts triggered</div>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className={`p-4 flex items-start justify-between gap-4 ${alert.acknowledged ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${alert.acknowledged ? 'bg-gray-300' : 'bg-red-500'}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {alert.rule_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </p>
                        <p className="text-sm text-gray-600 mt-0.5">{alert.details}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(alert.triggered_at).toLocaleString()}</p>
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-500">Failed to load compliance data</p>
        </div>
      )}
    </div>
  );
}

export default ComplianceDashboardPage;
