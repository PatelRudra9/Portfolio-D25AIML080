import { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API = '/api/tasks';
const LOGS_API = '/api/logs';
const AI_API = '/api/ai/suggest-description';

// ── Auth helper ───────────────────────────────────────────────────────────────
const getAuthHeaders = () => {
    const token = localStorage.getItem('tm_token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

const getUser = () => {
    try {
        return JSON.parse(localStorage.getItem('tm_user'));
    } catch { return null; }
};

// ── Toast helper ──────────────────────────────────────────────────────────────
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2800,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
    },
});

const showToast = (icon, title) => Toast.fire({ icon, title });

// ── Format datetime ───────────────────────────────────────────────────────────
const fmt = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ── Format date only (no time) ────────────────────────────────────────────────
const fmtDateOnly = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Human-readable status label (OVERDUE wins over the stored status) ────────
const statusLabel = (t) => {
    if (t.overdue) return 'OVERDUE';
    if (t.status === 'inprogress') return 'IN PROGRESS';
    return (t.status || '').toUpperCase();
};

// ── Priority colour for badges ────────────────────────────────────────────────
const PRIORITY_COLOR = { high: '#e63946', medium: '#ffc107', low: '#4cc9a1' };

// ── Log helper ────────────────────────────────────────────────────────────────
const postLog = async (taskId, taskTitle, action, details = '') => {
    try {
        await fetch(LOGS_API, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ taskId, taskTitle, action, details }),
        });
    } catch { /* silent fail */ }
};

// ── Icon components (Font Awesome) ────────────────────────────────────────────
const Icon = ({ name, style }) => <i className={`fas fa-${name}`} style={style}></i>;

function TaskManager({ onLogout }) {
    // ── State ──────────────────────────────────────────────────────────────────
    const [tasks, setTasks] = useState([]);
    const [logs, setLogs] = useState([]);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('medium');
    const [dueDate, setDueDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [backendOnline, setBackendOnline] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editPriority, setEditPriority] = useState('medium');
    const [editDueDate, setEditDueDate] = useState('');
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('pending');
    const [showLogs, setShowLogs] = useState(false);

    // AI description suggestion (Gemini, via backend). When active, holds
    // { text, prevDescription } so the user can discard and restore their draft.
    const [aiLoading, setAiLoading] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState(null);

    // Export dialog state (Fig 10)
    const [showExport, setShowExport] = useState(false);
    const [exportFrom, setExportFrom] = useState('');
    const [exportTo, setExportTo] = useState('');
    const [exportStatus, setExportStatus] = useState('all');
    const [exporting, setExporting] = useState(false);

    const user = getUser();

    // ── Handle 401 (auto-logout) ───────────────────────────────────────────────
    const handle401 = useCallback((res) => {
        if (res.status === 401) {
            showToast('error', 'Session expired. Please log in again.');
            if (onLogout) onLogout();
            return true;
        }
        return false;
    }, [onLogout]);

    // ── Fetch tasks ────────────────────────────────────────────────────────────
    const fetchTasks = useCallback(async () => {
        try {
            const res = await fetch(`${API}?status=all`, { headers: getAuthHeaders() });
            if (handle401(res)) return;
            if (!res.ok) throw new Error('fetch failed');
            const json = await res.json();
            setTasks(json.data || []);
            setBackendOnline(true);
            setError('');
        } catch {
            setBackendOnline(false);
            setError('Cannot connect to backend. Make sure the server is running on port 5000.');
        } finally {
            setLoading(false);
        }
    }, [handle401]);

    // ── Fetch logs ─────────────────────────────────────────────────────────────
    const fetchLogs = useCallback(async () => {
        try {
            const res = await fetch(LOGS_API, { headers: getAuthHeaders() });
            if (res.ok) {
                const json = await res.json();
                setLogs(json.data || []);
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => { fetchTasks(); fetchLogs(); }, [fetchTasks, fetchLogs]);

    // Poll backend every 10s
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(API, { method: 'GET', headers: getAuthHeaders() });
                if (handle401(res)) return;
                setBackendOnline(res.ok);
                if (res.ok) setError('');
            } catch { setBackendOnline(false); }
        }, 10000);
        return () => clearInterval(interval);
    }, [handle401]);

    // ── Create task ────────────────────────────────────────────────────────────
    const handleCreate = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSubmitting(true);
        try {
            const res = await fetch(API, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim(),
                    priority,
                    dueDate: dueDate || null,
                }),
            });
            if (handle401(res)) return;
            if (!res.ok) throw new Error('Create failed');
            const json = await res.json();
            setTasks(prev => [...prev, json.data]);
            await postLog(json.data.id, json.data.title, 'created', `Task created at ${fmt(json.data.createdAt)}`);
            setTitle('');
            setDescription('');
            setPriority('medium');
            setDueDate('');
            setAiSuggestion(null);
            fetchLogs();
            showToast('success', '✅ Task created successfully!');
            setActiveTab('pending');
        } catch (err) {
            setError('Failed to create task: ' + err.message);
            showToast('error', '❌ Failed to create task');
        } finally {
            setSubmitting(false);
        }
    };

    // ── AI: suggest a description from the title (Gemini/Groq/OpenAI via backend) ─
    // Errors degrade gracefully: a modal or toast explains what happened and
    // the form keeps working so the user can write the description manually.
    // Rate-limit (429) responses use a SweetAlert2 modal matching the spec screenshot.
    const handleAiSuggest = async () => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            showToast('warning', '💡 Enter a task title first, then let AI draft the description.');
            return;
        }
        setAiLoading(true);
        try {
            const res = await fetch(AI_API, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ title: trimmedTitle }),
                signal: AbortSignal.timeout(25000), // client-side safety net
            });
            if (handle401(res)) return;
            const json = await res.json().catch(() => ({}));

            // ── 429 Rate Limited → show the modal from the spec ──────────────
            if (res.status === 429) {
                const limitMsg = json.message ||
                    'You can generate an AI description once per minute per task. Please wait before requesting again.';
                await Swal.fire({
                    title: 'AI Generation',
                    html: `<p style="color:#a0a0b8;margin:0 0 4px">${limitMsg}</p>`,
                    icon: 'error',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#4361ee',
                    footer: '<span style="color:#a0a0b8;font-size:0.85rem">You can continue and write a description manually.</span>',
                    background: '#1a1a2e',
                    color: '#e0e0ff',
                    customClass: { popup: 'tm-swal-popup' },
                });
                return; // leave the form intact — user can type manually
            }

            if (!res.ok) throw new Error(json.message || 'AI suggestion is unavailable right now.');
            const suggestion = (json.data && json.data.description ? json.data.description : '').trim();
            if (!suggestion) throw new Error('The AI returned an empty suggestion. Please try again.');
            setAiSuggestion({ text: suggestion, prevDescription: description });
            setDescription(suggestion); // lands in the editable description textarea
            showToast('info', '✨ AI suggestion added — review it before saving.');
        } catch (err) {
            const msg = (err.name === 'TimeoutError' || err.name === 'AbortError')
                ? 'The AI took too long to respond. Please try again.'
                : (err.message || 'AI suggestion failed. You can still write the description manually.');
            showToast('error', `🤖 ${msg}`);
        } finally {
            setAiLoading(false);
        }
    };

    // ── AI: discard the suggestion and restore the previous description ──────
    const discardAiSuggestion = () => {
        if (aiSuggestion) setDescription(aiSuggestion.prevDescription || '');
        setAiSuggestion(null);
        showToast('info', '🗑️ AI suggestion discarded.');
    };

    // ── Toggle status (cycles pending → in-progress → completed → pending) ────
    const toggleStatus = async (task) => {
        if (task.status === 'deleted') return;
        const nextStatus = { pending: 'inprogress', inprogress: 'completed', completed: 'pending' };
        const newStatus = nextStatus[task.status] || 'pending';
        const action = newStatus === 'completed' ? 'completed'
            : newStatus === 'inprogress' ? 'started' : 'reopened';
        const label = newStatus === 'inprogress' ? 'in progress' : newStatus;
        try {
            const res = await fetch(`${API}/${task.id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status: newStatus }),
            });
            if (handle401(res)) return;
            if (!res.ok) throw new Error('Update failed');
            const json = await res.json();
            setTasks(prev => prev.map(t => t.id === task.id ? json.data : t));
            await postLog(task.id, task.title, action, `Marked as ${label} at ${fmt(new Date())}`);
            fetchLogs();
            showToast('success', newStatus === 'completed' ? '🎉 Task marked as completed!'
                : newStatus === 'inprogress' ? '🚀 Task started!' : '🔄 Task reopened!');
            setActiveTab(newStatus === 'completed' ? 'completed' : newStatus === 'inprogress' ? 'inprogress' : 'pending');
        } catch (err) {
            setError('Failed to update: ' + err.message);
            showToast('error', '❌ Status update failed');
        }
    };

    // ── Edit task ──────────────────────────────────────────────────────────────
    const startEdit = (task) => {
        setEditingId(task.id);
        setEditTitle(task.title);
        setEditDesc(task.description || '');
        setEditPriority(task.priority || 'medium');
        setEditDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditTitle('');
        setEditDesc('');
        setEditPriority('medium');
        setEditDueDate('');
    };

    const saveEdit = async (id) => {
        if (!editTitle.trim()) return;
        const task = tasks.find(t => t.id === id);
        try {
            const res = await fetch(`${API}/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    title: editTitle.trim(),
                    description: editDesc.trim(),
                    priority: editPriority,
                    dueDate: editDueDate || null,
                }),
            });
            if (handle401(res)) return;
            if (!res.ok) throw new Error('Update failed');
            const json = await res.json();
            setTasks(prev => prev.map(t => t.id === id ? json.data : t));
            await postLog(id, editTitle.trim(), 'updated', `Updated at ${fmt(new Date())}. Old title: "${task?.title}"`);
            fetchLogs();
            cancelEdit();
            showToast('info', '✏️ Task updated successfully!');
        } catch (err) {
            setError('Failed to save: ' + err.message);
            showToast('error', '❌ Failed to update task');
        }
    };

    // ── Delete task (soft) ─────────────────────────────────────────────────────
    const deleteTask = async (task) => {
        const result = await Swal.fire({
            title: 'Delete this task?',
            html: `<p style="color:#a0a0b8;margin:0">Task: <strong style="color:#fff">${task.title}</strong></p><p style="color:#ff6b6b;font-size:0.85rem;margin-top:8px">⚠️ This will move the task to the Deleted tab. You will not be able to edit or change its status.</p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e63946',
            cancelButtonColor: '#4361ee',
            confirmButtonText: '<i class="fas fa-trash"></i> Delete',
            cancelButtonText: '<i class="fas fa-times"></i> Cancel',
            background: '#1a1a2e',
            color: '#e0e0ff',
        });
        if (!result.isConfirmed) return;

        try {
            const res = await fetch(`${API}/${task.id}`, { method: 'DELETE', headers: getAuthHeaders() });
            if (handle401(res)) return;
            if (!res.ok) throw new Error('Delete failed');
            const json = await res.json();
            setTasks(prev => prev.map(t => t.id === task.id ? json.data : t));
            await postLog(task.id, task.title, 'deleted', `Deleted at ${fmt(new Date())}`);
            fetchLogs();
            showToast('warning', '🗑️ Task moved to Deleted!');
            setActiveTab('deleted');
        } catch (err) {
            setError('Failed to delete: ' + err.message);
            showToast('error', '❌ Failed to delete task');
        }
    };

    // ── Logout handler ─────────────────────────────────────────────────────────
    const handleLogout = async () => {
        const result = await Swal.fire({
            title: 'Log out?',
            text: 'Are you sure you want to log out?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#e63946',
            cancelButtonColor: '#4361ee',
            confirmButtonText: '<i class="fas fa-sign-out-alt"></i> Log Out',
            cancelButtonText: '<i class="fas fa-times"></i> Cancel',
            background: '#1a1a2e',
            color: '#e0e0ff',
        });
        if (result.isConfirmed && onLogout) {
            onLogout();
        }
    };

    // ── PDF Export (Fig 11) ───────────────────────────────────────────────────
    // Accepts optional filters { from, to, status } from the export dialog (Fig 10).
    const exportPDF = (filters = {}) => {
        const { from, to, status: statusFilter = 'all' } = filters;

        // Apply the same filters the dialog shows
        let rows = [...tasks];
        if (statusFilter === 'overdue') {
            rows = rows.filter(t => t.overdue);
        } else if (statusFilter !== 'all') {
            rows = rows.filter(t => t.status === statusFilter);
        }
        if (from) {
            const fromDate = new Date(from); fromDate.setHours(0, 0, 0, 0);
            rows = rows.filter(t => t.createdAt && new Date(t.createdAt) >= fromDate);
        }
        if (to) {
            const toDate = new Date(to); toDate.setHours(23, 59, 59, 999);
            rows = rows.filter(t => t.createdAt && new Date(t.createdAt) <= toDate);
        }

        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header band
        doc.setFillColor(26, 26, 46);
        doc.rect(0, 0, pageWidth, 24, 'F');
        doc.setFontSize(18);
        doc.setTextColor(138, 99, 255);
        doc.text('Task Management Report', 14, 15);
        doc.setFontSize(9);
        doc.setTextColor(160, 160, 184);
        doc.text(`Generated on ${fmt(new Date())}`, pageWidth - 14, 15, { align: 'right' });

        // Report meta: period + total (matches Fig 11)
        let metaY = 33;
        doc.setFontSize(11);
        doc.setTextColor(220, 220, 240);
        const periodLabel = (from || to)
            ? `${from ? fmtDateOnly(from) : 'Start'} to ${to ? fmtDateOnly(to) : 'Today'}`
            : 'All time';
        doc.text(`Report Period: ${periodLabel}`, 14, metaY);
        doc.text(`Total Tasks: ${rows.length}`, 14, metaY + 7);

        if (rows.length === 0) {
            doc.setFontSize(10);
            doc.setTextColor(120, 120, 140);
            doc.text('No tasks match the selected filters.', 14, metaY + 20);
        } else {
            autoTable(doc, {
                startY: metaY + 14,
                head: [['Task', 'Status', 'Priority', 'Due Date', 'Created']],
                body: rows.map((t) => [
                    t.title,
                    statusLabel(t),
                    (t.priority || 'medium').toUpperCase(),
                    t.dueDate ? fmtDateOnly(t.dueDate) : '—',
                    t.createdAt ? fmtDateOnly(t.createdAt) : '—',
                ]),
                styles: { fillColor: [20, 20, 38], textColor: [220, 220, 240], fontSize: 9, cellPadding: 4 },
                headStyles: { fillColor: [67, 97, 238], textColor: [255, 255, 255], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [28, 28, 50] },
                margin: { left: 14, right: 14 },
                theme: 'grid',
                didParseCell: (data) => {
                    // Colour-code the Status and Priority cells
                    if (data.section === 'body' && data.column.index === 1) {
                        const s = String(data.cell.raw);
                        if (s === 'COMPLETED') data.cell.styles.textColor = [76, 201, 161];
                        else if (s === 'IN PROGRESS') data.cell.styles.textColor = [67, 97, 238];
                        else if (s === 'OVERDUE') data.cell.styles.textColor = [230, 57, 70];
                        else data.cell.styles.textColor = [255, 193, 7];
                    }
                    if (data.section === 'body' && data.column.index === 2) {
                        const p = String(data.cell.raw);
                        if (p === 'HIGH') data.cell.styles.textColor = [230, 57, 70];
                        else if (p === 'LOW') data.cell.styles.textColor = [76, 201, 161];
                        else data.cell.styles.textColor = [255, 193, 7];
                    }
                },
            });
        }

        // Activity Log section (kept from before)
        if (logs.length > 0) {
            doc.addPage();
            doc.setFillColor(26, 26, 46);
            doc.rect(0, 0, pageWidth, 22, 'F');
            doc.setFontSize(16);
            doc.setTextColor(138, 99, 255);
            doc.text('Activity Log', 14, 14);
            autoTable(doc, {
                startY: 26,
                head: [['Time', 'Action', 'Task Title', 'Details']],
                body: logs.slice(0, 100).map(l => [fmt(l.timestamp), l.action.toUpperCase(), l.taskTitle, l.details || '—']),
                styles: { fillColor: [20, 20, 38], textColor: [220, 220, 240], fontSize: 8, cellPadding: 3 },
                headStyles: { fillColor: [67, 97, 238], textColor: [255, 255, 255], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [28, 28, 50] },
                margin: { left: 14, right: 14 },
                theme: 'grid',
            });
        }

        // Footer: page numbers on every page
        const total = doc.getNumberOfPages();
        for (let i = 1; i <= total; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(140, 140, 160);
            doc.text(
                `This report was generated automatically by Task Manager Application.`,
                14, doc.internal.pageSize.getHeight() - 8
            );
            doc.text(`Page ${i} of ${total}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
        }

        doc.save(`task-management-report-${new Date().toISOString().slice(0, 10)}.pdf`);
        showToast('success', '📄 PDF downloaded!');
    };

    // Run the export from the dialog, then close it
    const handleExportSubmit = (e) => {
        e.preventDefault();
        setExporting(true);
        // Small delay so the spinner paints before the synchronous PDF build
        setTimeout(() => {
            exportPDF({ from: exportFrom, to: exportTo, status: exportStatus });
            setExporting(false);
            setShowExport(false);
        }, 150);
    };

    // ── Derived ────────────────────────────────────────────────────────────────
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const inProgressTasks = tasks.filter(t => t.status === 'inprogress');
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const deletedTasks = tasks.filter(t => t.status === 'deleted');
    const overdueTasks = tasks.filter(t => t.overdue);

    const tabTasks = activeTab === 'pending' ? pendingTasks
        : activeTab === 'inprogress' ? inProgressTasks
            : activeTab === 'completed' ? completedTasks
                : activeTab === 'overdue' ? overdueTasks
                    : deletedTasks;

    const tabConfig = [
        { key: 'pending', label: 'Pending', icon: 'clock', count: pendingTasks.length, color: '#ffc107' },
        { key: 'inprogress', label: 'In Progress', icon: 'spinner', count: inProgressTasks.length, color: '#4361ee' },
        { key: 'completed', label: 'Completed', icon: 'check-circle', count: completedTasks.length, color: '#4cc9a1' },
        { key: 'overdue', label: 'Overdue', icon: 'exclamation-triangle', count: overdueTasks.length, color: '#e63946' },
        { key: 'deleted', label: 'Deleted', icon: 'trash-alt', count: deletedTasks.length, color: '#888' },
    ];

    const actionIconMap = { created: 'plus-circle', completed: 'check-circle', started: 'play-circle', reopened: 'undo', updated: 'edit', deleted: 'trash-alt' };
    const actionColorMap = { created: '#4cc9a1', completed: '#4361ee', started: '#4361ee', reopened: '#ffc107', updated: '#a29bfe', deleted: '#e63946' };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="main-content">
            <section className="tm-section">
                <div className="tm-bg-orb tm-orb-1"></div>
                <div className="tm-bg-orb tm-orb-2"></div>

                <div className="container tm-container">
                    {/* Header */}
                    <div className="section-header">
                        <h1 className="section-title"><Icon name="clipboard-list" style={{ marginRight: 10 }} /> Task Manager API</h1>
                        <div className="section-divider"></div>
                    </div>

                    {/* Top bar: user info + status + PDF + Logs + Logout */}
                    <div className="tm-topbar">
                        <div className="tm-topbar-left">
                            <div className={`tm-status-dot ${backendOnline ? 'online' : 'offline'}`}></div>
                            <span className="tm-status-text">SYSTEM: {backendOnline ? 'CONNECTED' : 'DISCONNECTED'}</span>
                            {user && (
                                <span className="tm-user-badge">
                                    <Icon name="user-circle" style={{ marginRight: 6 }} />
                                    {user.fullName}
                                </span>
                            )}
                        </div>
                        <div className="tm-topbar-actions">
                            <button className="tm-logs-btn" onClick={() => { setShowLogs(p => !p); fetchLogs(); }}>
                                <Icon name="history" /> {showLogs ? 'Hide' : 'Show'} Logs
                            </button>
                            <button className="tm-pdf-btn" onClick={() => setShowExport(true)} disabled={tasks.length === 0}>
                                <Icon name="file-pdf" /> Export PDF
                            </button>
                            <button className="tm-logout-btn" onClick={handleLogout}>
                                <Icon name="sign-out-alt" /> Logout
                            </button>
                        </div>
                    </div>

                    {/* Error Banner */}
                    {error && (
                        <div className="tm-error-bar">
                            <span>{error}</span>
                            <button onClick={() => setError('')} className="tm-error-close">✕</button>
                        </div>
                    )}

                    {/* Stats Row */}
                    {!loading && backendOnline && (
                        <div className="tm-stats-row">
                            <div className="tm-stat-card">
                                <div className="tm-stat-info">
                                    <span className="tm-stat-number">{tasks.length}</span>
                                    <span className="tm-stat-label">Total</span>
                                </div>
                                <div className="tm-stat-icon-wrapper"><Icon name="clipboard-list" style={{ fontSize: 22 }} /></div>
                            </div>
                            <div className="tm-stat-card tm-stat-pending">
                                <div className="tm-stat-info">
                                    <span className="tm-stat-number">{pendingTasks.length}</span>
                                    <span className="tm-stat-label">Pending</span>
                                </div>
                                <div className="tm-stat-icon-wrapper"><Icon name="clock" style={{ fontSize: 22 }} /></div>
                            </div>
                            <div className="tm-stat-card tm-stat-inprogress">
                                <div className="tm-stat-info">
                                    <span className="tm-stat-number">{inProgressTasks.length}</span>
                                    <span className="tm-stat-label">In Progress</span>
                                </div>
                                <div className="tm-stat-icon-wrapper"><Icon name="spinner" style={{ fontSize: 22 }} /></div>
                            </div>
                            <div className="tm-stat-card tm-stat-completed">
                                <div className="tm-stat-info">
                                    <span className="tm-stat-number">{completedTasks.length}</span>
                                    <span className="tm-stat-label">Completed</span>
                                </div>
                                <div className="tm-stat-icon-wrapper"><Icon name="check-circle" style={{ fontSize: 22 }} /></div>
                            </div>
                            <div className="tm-stat-card tm-stat-overdue">
                                <div className="tm-stat-info">
                                    <span className="tm-stat-number">{overdueTasks.length}</span>
                                    <span className="tm-stat-label">Overdue</span>
                                </div>
                                <div className="tm-stat-icon-wrapper"><Icon name="exclamation-triangle" style={{ fontSize: 22 }} /></div>
                            </div>
                        </div>
                    )}

                    {/* Activity Logs Panel */}
                    {showLogs && (
                        <div className="tm-logs-panel">
                            <div className="tm-logs-header">
                                <h3><Icon name="history" /> Activity Log</h3>
                                <span className="tm-logs-count">{logs.length} entries</span>
                            </div>
                            {logs.length === 0 ? (
                                <p className="tm-logs-empty">No activity recorded yet.</p>
                            ) : (
                                <div className="tm-logs-list">
                                    {logs.map((log, i) => (
                                        <div key={i} className="tm-log-entry">
                                            <span className="tm-log-icon" style={{ color: actionColorMap[log.action] || '#a0a0b8' }}>
                                                <Icon name={actionIconMap[log.action] || 'info-circle'} />
                                            </span>
                                            <div className="tm-log-body">
                                                <span className="tm-log-action" style={{ color: actionColorMap[log.action] || '#a0a0b8' }}>
                                                    {log.action.toUpperCase()}
                                                </span>
                                                <span className="tm-log-title">&nbsp;—&nbsp;{log.taskTitle}</span>
                                                {log.details && <span className="tm-log-details">{log.details}</span>}
                                            </div>
                                            <span className="tm-log-time">{fmt(log.timestamp)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Main Grid */}
                    <div className="tm-layout">
                        {/* Left: Input Form */}
                        <div className="tm-form-card">
                            <h2 className="tm-form-title">
                                <Icon name="plus-circle" style={{ marginRight: 8 }} /> New Task
                            </h2>
                            <form onSubmit={handleCreate} className="tm-form">
                                <div className="tm-group">
                                    <input
                                        id="task-title-input"
                                        type="text"
                                        className="tm-input"
                                        placeholder="Task title..."
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        required
                                        disabled={!backendOnline}
                                    />
                                </div>
                                <div className="tm-group">
                                    <textarea
                                        id="task-desc-input"
                                        className="tm-input tm-textarea"
                                        placeholder="Description (optional)... or click ✨ AI Suggest below"
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        disabled={!backendOnline}
                                    />
                                    <div className="tm-desc-footer">
                                        <button
                                            id="ai-suggest-btn"
                                            type="button"
                                            className="tm-ai-btn"
                                            onClick={handleAiSuggest}
                                            disabled={!backendOnline || aiLoading || !title.trim()}
                                            title="Generate a description from the task title using AI"
                                        >
                                            {aiLoading ? (
                                                <><span className="tm-btn-spinner"></span> Generating…</>
                                            ) : (
                                                <><Icon name="wand-magic-sparkles" style={{ marginRight: 6 }} /> AI Suggest</>
                                            )}
                                        </button>
                                    </div>
                                    {aiSuggestion && (
                                        <div className="tm-ai-banner" role="status">
                                            <span className="tm-ai-banner-text">
                                                <Icon name="circle-info" style={{ marginRight: 6 }} />
                                                AI-generated suggestion. Please review before saving.
                                            </span>
                                            <button
                                                type="button"
                                                className="tm-ai-discard"
                                                onClick={discardAiSuggestion}
                                            >
                                                <Icon name="xmark" style={{ marginRight: 4 }} /> Discard suggestion
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {/* Priority + Due Date (Fig 7 / Fig 11) */}
                                <div className="tm-group-row">
                                    <div className="tm-group">
                                        <label className="tm-field-label" htmlFor="task-priority-input">Priority</label>
                                        <select
                                            id="task-priority-input"
                                            className="tm-input tm-select"
                                            value={priority}
                                            onChange={e => setPriority(e.target.value)}
                                            disabled={!backendOnline}
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                        </select>
                                    </div>
                                    <div className="tm-group">
                                        <label className="tm-field-label" htmlFor="task-due-input">Due Date</label>
                                        <input
                                            id="task-due-input"
                                            type="date"
                                            className="tm-input tm-date"
                                            value={dueDate}
                                            onChange={e => setDueDate(e.target.value)}
                                            disabled={!backendOnline}
                                        />
                                    </div>
                                </div>
                                <button
                                    id="create-task-btn"
                                    type="submit"
                                    className="tm-create-btn"
                                    disabled={!title.trim() || submitting || !backendOnline}
                                >
                                    {submitting ? (
                                        <><span className="tm-btn-spinner"></span> Adding...</>
                                    ) : (
                                        <><Icon name="plus" style={{ marginRight: 6 }} /> Add Task</>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Right: Task List with Tabs */}
                        <div className="tm-list-panel">
                            {/* Tab Bar */}
                            <div className="tm-tabs">
                                {tabConfig.map(tab => (
                                    <button
                                        key={tab.key}
                                        className={`tm-tab ${activeTab === tab.key ? 'active' : ''}`}
                                        style={{ '--tab-color': tab.color }}
                                        onClick={() => setActiveTab(tab.key)}
                                    >
                                        <Icon name={tab.icon} />
                                        <span>{tab.label}</span>
                                        <span className="tm-tab-badge">{tab.count}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Task List */}
                            {loading ? (
                                <div className="spinner-container" style={{ minHeight: '200px' }}>
                                    <div className="spinner"></div>
                                    <p className="spinner-text">Loading tasks...</p>
                                </div>
                            ) : tabTasks.length === 0 ? (
                                <div className="tm-empty-state">
                                    <i className="fas fa-inbox tm-empty-icon-svg"></i>
                                    <h3>NO TASKS HERE</h3>
                                    <p>
                                        {activeTab === 'pending' ? 'Add a task using the form on the left.' :
                                            activeTab === 'completed' ? 'Complete some tasks to see them here.' :
                                                'Deleted tasks will appear here.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="tm-task-list">
                                    {tabTasks.map((task, i) => (
                                        <div
                                            key={task.id}
                                            className={`tm-task-card ${task.status === 'completed' ? 'task-card-completed' : ''} ${task.status === 'deleted' ? 'task-card-deleted' : ''}`}
                                            style={{ animationDelay: `${i * 0.05}s` }}
                                        >
                                            {editingId === task.id ? (
                                                /* Edit mode */
                                                <div className="tm-edit-mode">
                                                    <input
                                                        type="text"
                                                        className="tm-input"
                                                        value={editTitle}
                                                        onChange={e => setEditTitle(e.target.value)}
                                                        autoFocus
                                                    />
                                                    <textarea
                                                        className="tm-input tm-textarea"
                                                        value={editDesc}
                                                        onChange={e => setEditDesc(e.target.value)}
                                                        rows={3}
                                                    />
                                                    <div className="tm-group-row">
                                                        <div className="tm-group">
                                                            <label className="tm-field-label">Priority</label>
                                                            <select
                                                                className="tm-input tm-select"
                                                                value={editPriority}
                                                                onChange={e => setEditPriority(e.target.value)}
                                                            >
                                                                <option value="low">Low</option>
                                                                <option value="medium">Medium</option>
                                                                <option value="high">High</option>
                                                            </select>
                                                        </div>
                                                        <div className="tm-group">
                                                            <label className="tm-field-label">Due Date</label>
                                                            <input
                                                                type="date"
                                                                className="tm-input tm-date"
                                                                value={editDueDate}
                                                                onChange={e => setEditDueDate(e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="tm-edit-actions">
                                                        <button className="tm-btn tm-btn-save" onClick={() => saveEdit(task.id)}>
                                                            <Icon name="save" /> Save
                                                        </button>
                                                        <button className="tm-btn tm-btn-cancel" onClick={cancelEdit}>
                                                            <Icon name="times" /> Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* View mode */
                                                <>
                                                    <div className="tm-card-header">
                                                        <span className="tm-task-id-badge">#{task.id.slice(-6)}</span>
                                                        <span className="tm-priority-badge" style={{ background: PRIORITY_COLOR[task.priority] || PRIORITY_COLOR.medium }}>
                                                            <Icon name="flag" style={{ marginRight: 4 }} />{(task.priority || 'medium').toUpperCase()}
                                                        </span>
                                                        {task.overdue ? (
                                                            <span className="tm-status-badge badge-overdue">
                                                                <Icon name="exclamation-triangle" /> OVERDUE
                                                            </span>
                                                        ) : (
                                                            <span className={`tm-status-badge badge-${task.status}`}>
                                                                {task.status === 'pending' ? <><Icon name="clock" /> PENDING</> :
                                                                    task.status === 'inprogress' ? <><Icon name="spinner" /> IN PROGRESS</> :
                                                                        task.status === 'completed' ? <><Icon name="check-circle" /> DONE</> :
                                                                            <><Icon name="trash-alt" /> DELETED</>}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="tm-task-title">{task.title}</h3>
                                                    {task.description && <p className="tm-task-desc">{task.description}</p>}

                                                    {/* Due date + Timestamps */}
                                                    <div className="tm-timestamps">
                                                        {task.dueDate && (
                                                            <span style={{ color: task.overdue ? '#e63946' : undefined }}>
                                                                <Icon name="calendar" style={{ marginRight: 4, fontSize: '0.7rem' }} />Due: {fmtDateOnly(task.dueDate)}
                                                            </span>
                                                        )}
                                                        <span><Icon name="plus" style={{ marginRight: 4, fontSize: '0.7rem' }} />Added: {fmt(task.createdAt)}</span>
                                                        {task.completedAt && <span><Icon name="check" style={{ marginRight: 4, fontSize: '0.7rem', color: '#4cc9a1' }} />Completed: {fmt(task.completedAt)}</span>}
                                                        {task.deletedAt && <span><Icon name="trash" style={{ marginRight: 4, fontSize: '0.7rem', color: '#e63946' }} />Deleted: {fmt(task.deletedAt)}</span>}
                                                    </div>

                                                    {/* Actions – hidden for deleted tasks */}
                                                    {task.status !== 'deleted' && (
                                                        <div className="tm-card-actions">
                                                            {task.status !== 'completed' ? (
                                                                <>
                                                                    <button className="tm-btn tm-btn-edit" onClick={() => startEdit(task)}>
                                                                        <Icon name="edit" /> Edit
                                                                    </button>
                                                                    {task.status === 'pending' ? (
                                                                        <button className="tm-btn tm-btn-toggle" onClick={() => toggleStatus(task)}>
                                                                            <Icon name="play" /> Start
                                                                        </button>
                                                                    ) : (
                                                                        <button className="tm-btn tm-btn-toggle" onClick={() => toggleStatus(task)}>
                                                                            <Icon name="check" /> Complete
                                                                        </button>
                                                                    )}
                                                                </>
                                                            ) : null}
                                                            <button className="tm-btn tm-btn-delete" onClick={() => deleteTask(task)}>
                                                                <Icon name="trash-alt" /> Delete
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Completed state notice */}
                                                    {task.status === 'completed' && (
                                                        <div className="tm-completed-notice">
                                                            <Icon name="lock" /> Completed tasks cannot be edited or reopened.
                                                        </div>
                                                    )}

                                                    {/* Deleted state info */}
                                                    {task.status === 'deleted' && (
                                                        <div className="tm-deleted-notice">
                                                            <Icon name="lock" /> This task has been deleted and is read-only.
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Export Dialog (Fig 10) ─────────────────────────────────── */}
                {showExport && (
                    <div className="tm-modal-overlay" onClick={() => !exporting && setShowExport(false)}>
                        <div className="tm-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="export-title">
                            <div className="tm-modal-header">
                                <h3 id="export-title"><Icon name="file-pdf" style={{ marginRight: 8 }} /> Export Tasks Report</h3>
                                <button className="tm-modal-close" onClick={() => setShowExport(false)} disabled={exporting} aria-label="Close">✕</button>
                            </div>
                            <p className="tm-modal-subtitle">Generate a PDF report of your tasks with optional filtering.</p>

                            <form onSubmit={handleExportSubmit} className="tm-export-form">
                                <div className="tm-export-group">
                                    <label className="tm-field-label">Date Range</label>
                                    <div className="tm-group-row">
                                        <input
                                            type="date"
                                            className="tm-input tm-date"
                                            value={exportFrom}
                                            onChange={e => setExportFrom(e.target.value)}
                                            aria-label="From date"
                                        />
                                        <input
                                            type="date"
                                            className="tm-input tm-date"
                                            value={exportTo}
                                            onChange={e => setExportTo(e.target.value)}
                                            aria-label="To date"
                                        />
                                    </div>
                                </div>

                                <div className="tm-export-group">
                                    <label className="tm-field-label" htmlFor="export-status">Task Status</label>
                                    <select
                                        id="export-status"
                                        className="tm-input tm-select"
                                        value={exportStatus}
                                        onChange={e => setExportStatus(e.target.value)}
                                    >
                                        <option value="all">All Statuses</option>
                                        <option value="pending">Pending</option>
                                        <option value="inprogress">In Progress</option>
                                        <option value="completed">Completed</option>
                                        <option value="overdue">Overdue</option>
                                        <option value="deleted">Deleted</option>
                                    </select>
                                </div>

                                <p className="tm-export-note">
                                    <Icon name="info-circle" style={{ marginRight: 6 }} />
                                    The PDF will include task details, dates, statuses, and descriptions.
                                </p>

                                <div className="tm-modal-actions">
                                    <button type="button" className="tm-btn tm-btn-cancel" onClick={() => setShowExport(false)} disabled={exporting}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="tm-pdf-btn" disabled={exporting}>
                                        {exporting ? (
                                            <><span className="tm-btn-spinner"></span> Exporting...</>
                                        ) : (
                                            <><Icon name="download" style={{ marginRight: 6 }} /> Export</>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}

export default TaskManager;
