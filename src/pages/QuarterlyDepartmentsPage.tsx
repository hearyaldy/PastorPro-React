import { departmentFormBlocker } from '../lib/departmentFormAccess';
import { useMemo, useRef, useState } from 'react';
import { FileText, Plus, RefreshCw, Settings2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { useHierarchyLabels } from '../hooks/useHierarchyLabels';
import { useDepartmentData } from '../hooks/useDepartmentData';
import { DepartmentForm } from '../components/department/DepartmentForm';
import { DepartmentTemplateEditor } from '../components/department/DepartmentTemplateEditor';
import { ReportPreview } from '../components/ReportPreview';
import { ReportTables } from '../components/ReportTables';
import { aggregateDepartment, answerRows, departmentExportRows, defaultDepartmentTemplates, departmentAnswers, departmentDocument, departmentKey, reportTemplate, validateTemplate, type DepartmentTemplate } from '../lib/departmentReports';
import { findDepartmentReports, saveDepartmentReport, saveDepartmentTemplate } from '../lib/departmentStorage';
import { quarterlyDocument } from '../lib/reportDocuments';
import { auth, db } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { exportToCsv, exportToExcel } from '../lib/exportUtils';
import { hasAlias, assignedMission } from '../lib/missionReporting';
import type { PrintableReport } from '../lib/pdfReport';
import type { QuarterlyDepartmentReport } from '../types';

export function QuarterlyDepartmentsPage({ adminMode = false, onManage }: { adminMode?: boolean; onManage?: () => void }) {
  const { profile } = useAuth();
  const { missions, districts, churches } = useMission();
  const labels = useHierarchyLabels();
  const [refresh, setRefresh] = useState(0), [view, setView] = useState<'forms' | 'responses' | 'settings'>('forms');
  const data = useDepartmentData(profile, refresh);
  const [year, setYear] = useState(new Date().getFullYear()), [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);
  const [churchId, setChurchId] = useState(adminMode ? '' : profile?.churchId || ''), [districtId, setDistrictId] = useState('all'), [missionId, setMissionId] = useState(''), [search, setSearch] = useState(''), [templateKey, setTemplateKey] = useState('all');
  const [editor, setEditor] = useState<DepartmentTemplate | null>(null), [form, setForm] = useState<{ template: DepartmentTemplate; existing: QuarterlyDepartmentReport | null; churchId: string } | null>(null);
  const [preview, setPreview] = useState<PrintableReport | null>(null), [inspect, setInspect] = useState<QuarterlyDepartmentReport | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const admin = !!profile?.isActive && ['super_admin', 'admin'].includes(profile.userRole);
  const canFill = !!profile?.isActive && (admin || profile.userRole === 'district_pastor');
  const ownMission = profile ? assignedMission(profile, missions) : null;
  const scopeMission = admin ? missions.find(item => item.id === missionId) : ownMission;
  const scopeDistrict = districts.find(item => item.id === (profile?.userRole === 'district_pastor' ? profile.districtId : districtId)) || districts.find(item => profile?.userRole === 'district_pastor' && hasAlias(profile.districtId, item));
  const scopedChurches = churches.filter(church => (!scopeMission || hasAlias(church.missionId, scopeMission)) && (profile?.userRole !== 'district_pastor' || (scopeDistrict && hasAlias(church.districtId, scopeDistrict))) && (districtId === 'all' || church.districtId === districtId));
  const selectedChurch = scopedChurches.find(item => item.id === churchId);
  const churchSelect = useRef<HTMLSelectElement>(null);
  const formAccess = { profile, churchId: selectedChurch?.id, churchCount: scopedChurches.length, districtAssigned: !!scopeDistrict,
    busy, templatesLoading: data.templatesLoading, reportsLoading: data.reportsLoading, templateError: data.templateError, reportError: data.reportError };
  const formBlocker = departmentFormBlocker(formAccess);
  const templates = data.templates;
  const activeTemplates = templates.filter(template => template.isActive);
  const reports = useMemo(() => data.reports.map(report => labels.withNames(report)), [data.reports, labels]);
  const filtered = reports.filter(report => report.year === year && report.quarter === quarter && (!scopeMission || hasAlias(report.missionId, scopeMission)) && (districtId === 'all' || report.districtId === districtId) && (!churchId || report.churchId === churchId) && (templateKey === 'all' || departmentKey(report.department) === templateKey) && `${report.churchName} ${report.districtName} ${report.sourceData?.departmentName || report.department} ${report.submittedByName || ''}`.toLowerCase().includes(search.toLowerCase()));
  const responseDocument = (report: QuarterlyDepartmentReport) => {
    const template = reportTemplate(report, templates);
    if (template) return departmentDocument(report, template);
    const legacy = quarterlyDocument(report, String(report.sourceData?.departmentName || report.department || 'Archived department report'));
    if (report.sourceData?.values) legacy.sections.push({ title: 'Recorded answers (form definition unavailable)', rows: Object.entries(departmentAnswers(report)).map(([key, value]) => [key.replace(/([A-Z])/g, ' $1'), typeof value === 'object' ? JSON.stringify(value) : String(value)]) });
    return legacy;
  };
  const openForm = async (template: DepartmentTemplate, existing?: QuarterlyDepartmentReport) => {
    const church = existing ? scopedChurches.find(item => item.id === existing.churchId) : selectedChurch;
    const blocker = departmentFormBlocker({ ...formAccess, churchId: church?.id, template });
    if (blocker || !profile || !church) { setError(blocker?.message || 'Select a church first.'); return; }
    setBusy(true); setError('');
    try {
      const matches = await findDepartmentReports(db, church.id, year, quarter, template.key);
      if (matches.length > 1 && !existing) { setError('Multiple saved responses exist. Open the exact response from the Responses tab.'); setView('responses'); return; }
      const record = existing ? matches.find(item => item.id === existing.id) : matches[0] || null;
      if (existing && !record) throw new Error('This response changed or was removed. Refresh before editing.');
      setForm({ template, existing: record || null, churchId: church.id });
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load this response. Check your reporting permissions.'); } finally { setBusy(false); }
  };
  const seed = async () => { if (!admin || !profile) return; setBusy(true); setError(''); try { for (const template of defaultDepartmentTemplates()) if (!templates.some(item => item.key === template.key)) await saveDepartmentTemplate(db, template, profile.uid); } catch (err) { setError(err instanceof Error ? err.message : 'Unable to add starter forms.'); } finally { setBusy(false); } };
  const summaryTemplate = templates.find(template => template.key === templateKey);
  const submitted = filtered.filter(report => report.status === 'submitted');
  const denominator = churchId ? scopedChurches.filter(church => church.id === churchId) : scopedChurches;
  const responseCount = new Set(submitted.filter(report => denominator.some(church => church.id === report.churchId)).map(report => report.churchId)).size;
  const missing = denominator.filter(church => !submitted.some(report => report.churchId === church.id));
  if (!profile?.isActive) return <p>Sign in with an active, approved account to access department reports.</p>;
  if (adminMode && !admin) return <p>Only Admin and Super Admin accounts can manage report forms.</p>;
  if (!admin && !ownMission && profile.userRole !== 'district_pastor') return <p>Your account needs a mission assignment before department responses can be reviewed.</p>;
  if (editor && admin) return <DepartmentTemplateEditor initial={editor} onResponses={() => { setTemplateKey(editor.key); setEditor(null); setView('responses'); }} onSave={template => saveDepartmentTemplate(db, template, profile.uid)} onClose={() => { setEditor(null); setRefresh(value => value + 1); }} />;
  if (form) {
    const church = scopedChurches.find(item => item.id === form.churchId);
    if (!church) return <p>The selected church is no longer in your reporting scope. <button onClick={() => setForm(null)}>Back to reports</button></p>;
    return <DepartmentForm key={`${form.template.id}:${church.id}:${year}:${quarter}`} template={form.template} initialValues={form.existing ? departmentAnswers(form.existing) : {}} editing={!!form.existing} context={`${church.name} · ${labels.district(church.districtId)} · Q${quarter} ${year}`} onClose={() => { setForm(null); setRefresh(value => value + 1); }} onSubmit={async values => {
      if (!auth.currentUser) throw new Error('Please sign in before submitting.');
      await saveDepartmentReport(db, { church, profile, template: form.template, year, quarter, values, existing: form.existing }, { projectId: firebaseConfig.projectId, databaseId: firebaseConfig.firestoreDatabaseId, getIdToken: () => auth.currentUser!.getIdToken() });
    }} />;
  }
  return <div className="department-forms df-workspace"><header className="df-workspace-header"><div className="df-brand-icon"><FileText size={26} /></div><div><h2>{adminMode ? 'Department report forms' : 'Quarterly department reports'}</h2><p>{adminMode ? 'Create forms, manage questions, and review responses.' : 'One church. One quarter. A clear record of your ministry.'}</p></div><button className="df-icon-button" aria-label="Refresh department reports" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={19} /></button>{admin && !adminMode && onManage && <button className="df-secondary" onClick={onManage}><Settings2 size={17} />Manage forms</button>}{admin && adminMode && <button className="df-primary" onClick={() => setEditor({ id: `form_${crypto.randomUUID()}`, key: '', name: 'Untitled form', description: '', isActive: true, order: templates.length, steps: [{ id: crypto.randomUUID(), title: 'Report details', fields: [{ id: crypto.randomUUID(), label: '', type: 'text', required: true }] }] })}><Plus size={18} />Blank form</button>}</header>
    <nav className="df-tabs" aria-label="Department report views">{(['forms', 'responses', ...(adminMode ? ['settings'] : [])] as const).map(tab => <button key={tab} className={view === tab ? 'active' : ''} aria-current={view === tab ? 'page' : undefined} onClick={() => { setView(tab as typeof view); setError(''); }}>{tab === 'forms' ? adminMode ? 'Forms' : 'Fill a report' : tab === 'responses' ? `Responses${data.reportsLoading || data.reportError ? '' : ` (${filtered.length})`}` : 'Settings'}</button>)}</nav>
    {(data.templateError || data.reportError || error) && <div className="df-card df-error" role="alert">{error || data.templateError || data.reportError}<button className="df-text-button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
    {data.cached && <p className="df-notice">Showing cached responses. Connect and refresh to confirm the latest submissions.</p>}
    {view !== 'settings' && <div className="df-scope-bar"><label>Year<input aria-label="Reporting year" type="number" min={2000} max={2100} value={year} onChange={event => { setYear(Number(event.target.value)); setInspect(null); }} /></label><label>Quarter<select aria-label="Reporting quarter" value={quarter} onChange={event => { setQuarter(Number(event.target.value)); setInspect(null); }}>{[1, 2, 3, 4].map(value => <option key={value} value={value}>Q{value}</option>)}</select></label>
      {admin && <label>Mission<select aria-label="Report mission" value={missionId} onChange={event => { setMissionId(event.target.value); setDistrictId('all'); setChurchId(''); }}><option value="">All missions</option>{missions.map(mission => <option key={mission.id} value={mission.id}>{mission.name}</option>)}</select></label>}
      {profile.userRole !== 'district_pastor' && <label>District<select aria-label="Report district" value={districtId} onChange={event => { setDistrictId(event.target.value); setChurchId(''); }}><option value="all">All districts</option>{districts.filter(district => !scopeMission || hasAlias(district.missionId, scopeMission)).map(district => <option value={district.id} key={district.id}>{district.name}</option>)}</select></label>}
      <label>Church<select ref={churchSelect} aria-label="Report church" value={churchId} onChange={event => setChurchId(event.target.value)}><option value="">{view === 'forms' && !adminMode ? 'Select a church' : 'All churches'}</option>{scopedChurches.map(church => <option key={church.id} value={church.id}>{church.name}</option>)}</select></label>
    </div>}
    {view === 'forms' && !adminMode && formBlocker && <div className="df-notice" role="status"><p>{formBlocker.message}</p>{formBlocker.code === 'church' && <div className="df-template-actions" style={{ marginTop: 10 }}><button className="df-secondary" onClick={() => { churchSelect.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); churchSelect.current?.focus(); }}>Choose church</button>{scopedChurches.length === 1 && <button className="df-primary" onClick={() => setChurchId(scopedChurches[0].id)}>Use {scopedChurches[0].name}</button>}</div>}</div>}
    {view === 'forms' && <>{data.templatesLoading ? <p role="status">Loading report forms…</p> : (adminMode ? templates : activeTemplates).length === 0 && !data.templateError ? <div className="df-card df-empty"><FileText size={36} /><h3>No report forms yet</h3><p>{admin ? 'Create a blank form or add the starter ministry forms.' : 'Your administrator has not published any report forms yet.'}</p>{admin && <button className="df-primary" disabled={busy} onClick={() => void seed()}>Add starter forms</button>}</div> : <div className="df-template-grid">{(adminMode ? templates : activeTemplates).map(template => {
      const response = selectedChurch ? reports.find(report => report.churchId === selectedChurch.id && report.year === year && report.quarter === quarter && departmentKey(report.department) === template.key) : undefined;
      const blocker = departmentFormBlocker({ ...formAccess, template });
      return <article className="df-template-card" key={template.id}><div className="df-template-cover"><FileText size={36} /><span>{template.isActive ? 'Accepting responses' : 'Closed'}</span></div><div className="df-template-body"><h3>{template.name}</h3><p>{template.description || `${template.steps.length} sections · ${template.steps.reduce((sum, step) => sum + step.fields.length, 0)} questions`}</p>{selectedChurch && !adminMode && !data.reportsLoading && !data.reportError && <p className="df-muted">{response ? response.status === 'submitted' ? '✓ Submitted' : 'Legacy draft · needs review' : 'Not submitted'}</p>}<div className="df-template-actions">{validateTemplate(template).length > 0 && <p className="df-error">This form needs an administrator’s review before it can accept responses.</p>}{adminMode ? <><button className="df-primary" onClick={() => setEditor(template)}>Edit form</button><button className="df-text-button" onClick={() => { setTemplateKey(template.key); setView('responses'); }}>Responses</button></> : <button className="df-primary" disabled={!!blocker} title={blocker?.message} aria-describedby={blocker ? `form-blocker-${template.id}` : undefined} onClick={() => void openForm(template)}>{response ? 'Edit response' : 'Fill report'}</button>}{!adminMode && blocker && <p className="df-muted" id={`form-blocker-${template.id}`}>{blocker.message}</p>}</div></div></article>;
    })}</div>}</>}
    {view === 'responses' && <div className="df-response-workspace"><div className="df-response-controls"><label>Form<select aria-label="Response form" value={templateKey} onChange={event => { setTemplateKey(event.target.value); setInspect(null); }}><option value="all">All forms</option>{templates.map(template => <option key={template.id} value={template.key}>{template.name}</option>)}</select></label><label>Search<input aria-label="Search responses" placeholder="Church, district or submitter" value={search} onChange={event => setSearch(event.target.value)} /></label><button className="df-secondary" disabled={data.reportsLoading || !!data.reportError || !filtered.length} onClick={() => exportToExcel(`Department_Responses_${year}_Q${quarter}`, [{ name: 'Responses', rows: departmentExportRows(filtered, templates) }, ...(summaryTemplate ? [{ name: 'Summary', rows: aggregateDepartment(summaryTemplate, submitted).map(([Question, Total]) => ({ Question, Total })) }] : [])])}>Export Excel</button><button className="df-secondary" disabled={data.reportsLoading || !!data.reportError || !filtered.length} onClick={() => exportToCsv(`Department_Responses_${year}_Q${quarter}`, departmentExportRows(filtered, templates))}>Export CSV</button></div>
      {data.reportsLoading ? <p role="status">Loading responses…</p> : !data.reportError && <><section className="df-card"><div className="df-response-heading"><h3>{filtered.length} response{filtered.length === 1 ? '' : 's'}</h3>{summaryTemplate && <button className="df-secondary" onClick={() => setPreview({ title: `${summaryTemplate.name} — Summary`, filename: `${summaryTemplate.key}_summary_${year}_Q${quarter}`, subtitle: `Q${quarter} ${year}`, metadata: [['Coverage', `${responseCount} of ${denominator.length} churches (visible records)`], ['Data', data.cached ? 'Cached: may be incomplete' : 'Live accessible responses']], sections: [{ title: 'Consolidated totals', rows: aggregateDepartment(summaryTemplate, submitted) }, ...submitted.map(report => ({ title: report.churchName, rows: answerRows(reportTemplate(report, templates) || summaryTemplate, departmentAnswers(report)) }))], blueHeader: true })}>Preview / Print summary</button>}</div>{summaryTemplate ? <><p>{responseCount} of {denominator.length} churches submitted{search ? ' (search filtered)' : ''}.</p><progress aria-label="Submission coverage" max={denominator.length || 1} value={responseCount} /><ReportTables sections={[{ title: 'Consolidated totals', rows: aggregateDepartment(summaryTemplate, submitted) }]} /><details><summary>Churches without a visible submission ({missing.length})</summary>{missing.map(church => <p key={church.id}>{church.name}</p>)}</details></> : <p className="df-muted">Select a form to view totals and church submission coverage.</p>}</section>
      <div className="df-card df-response-list">{!filtered.length && <p>No responses match this period and scope.</p>}{filtered.map(report => <article key={report.id}><div><h4>{report.churchName}</h4><p>{String(report.sourceData?.departmentName || templates.find(item => item.key === report.department)?.name || report.department || 'Archived report')} · {report.districtName}</p><small>{report.submittedByName || 'Name unavailable'} · {report.status}</small></div><button className="df-secondary" onClick={() => setInspect(report)}>View response</button></article>)}</div>
      {inspect && <section className="df-card df-response-detail"><div className="df-response-heading"><h3>{inspect.churchName} · Q{inspect.quarter} {inspect.year}</h3><button className="df-text-button" onClick={() => setInspect(null)}>Close</button></div><ReportTables sections={responseDocument(inspect).sections} /><div className="df-template-actions"><button className="df-secondary" onClick={() => setPreview(responseDocument(inspect))}>Preview / Print response</button>{canFill && templates.some(template => template.key === departmentKey(inspect.department) && template.isActive) && <button className="df-primary" disabled={busy} onClick={() => void openForm(templates.find(template => template.key === departmentKey(inspect.department))!, inspect)}>Edit response</button>}</div></section>}
      </>}
    </div>}
    {view === 'settings' && admin && <section className="df-card df-settings"><h3>Form management</h3><p>Use “Accepting responses” in each form to publish or close it. Closed forms keep their saved responses available for review.</p><p>Previously submitted responses keep the questions used at submission, so later form changes do not change their printed history.</p><button className="df-secondary" disabled={busy || data.templatesLoading || !!data.templateError} onClick={() => void seed()}>Add missing starter forms</button><p className="df-muted">Children’s Ministry and Stewardship. Existing forms are kept.</p></section>}
    {preview && <ReportPreview report={preview} onClose={() => setPreview(null)} />}
  </div>;
}
