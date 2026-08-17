import { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API = '/api/tasks';
const LOGS_API = '/api/logs';

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

// ── Log helper ────────────────────────────────────────────────────────────────
const postLog = async (taskId, taskTitle, action, details = '') => {
    try {
        await fetch(LOGS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId, taskTitle, action, details }),
        });
    } catch { /* silent fail */ }
};

// ── Icon components (Font Awesome) ────────────────────────────────────────────
const Icon = ({ name, style }) => <i className={`fas fa-${name}`} style={style}></i>;

function TaskManager() {
    // ── State ──────────────────────────────────────────────────────────────────
    const [tasks, setTasks] = useState([]);
    const [logs, setLogs] = useState([]);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [backendOnline, setBackendOnline] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('pending');
    const [showLogs, setShowLogs] = useState(false);

    // ── Fetch tasks ────────────────────────────────────────────────────────────
    const fetchTasks = useCallback(async () => {
        try {
            const res = await fetch(`${API}?status=all`);
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
    }, []);

    // ── Fetch logs ─────────────────────────────────────────────────────────────
    const fetchLogs = useCallback(async () => {
        try {
            const res = await fetch(LOGS_API);
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
                const res = await fetch(API, { method: 'GET' });
                setBackendOnline(res.ok);
                if (res.ok) setError('');
            } catch { setBackendOnline(false); }
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    // ── Create task ────────────────────────────────────────────────────────────
    const handleCreate = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSubmitting(true);
        try {
            const res = await fetch(API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title.trim(), description: description.trim() }),
            });
            if (!res.ok) throw new Error('Create failed');
            const json = await res.json();
            setTasks(prev => [...prev, json.data]);
            await postLog(json.data.id, json.data.title, 'created', `Task created at ${fmt(json.data.createdAt)}`);
            setTitle('');
            setDescription('');
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

    // ── Toggle status ──────────────────────────────────────────────────────────
    const toggleStatus = async (task) => {
        if (task.status === 'deleted') return;
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        try {
            const res = await fetch(`${API}/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error('Update failed');
            const json = await res.json();
            setTasks(prev => prev.map(t => t.id === task.id ? json.data : t));
            const action = newStatus === 'completed' ? 'completed' : 'reopened';
            await postLog(task.id, task.title, action, `Marked as ${newStatus} at ${fmt(new Date())}`);
            fetchLogs();
            showToast('success', newStatus === 'completed' ? '🎉 Task marked as completed!' : '🔄 Task reopened!');
            setActiveTab(newStatus === 'completed' ? 'completed' : 'pending');
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
    };

    const cancelEdit = () => { setEditingId(null); setEditTitle(''); setEditDesc(''); };

    const saveEdit = async (id) => {
        if (!editTitle.trim()) return;
        const task = tasks.find(t => t.id === id);
        try {
            const res = await fetch(`${API}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: editTitle.trim(), description: editDesc.trim() }),
            });
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
            const res = await fetch(`${API}/${task.id}`, { method: 'DELETE' });
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

    // ── PDF Export ─────────────────────────────────────────────────────────────
    const exportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFillColor(26, 26, 46);
        doc.rect(0, 0, pageWidth, 22, 'F');
        doc.setFontSize(18);
        doc.setTextColor(138, 99, 255);
        doc.text('Task Manager Report', 14, 14);
        doc.setFontSize(9);
        doc.setTextColor(160, 160, 184);
        doc.text(`Generated: ${fmt(new Date())}`, pageWidth - 14, 14, { align: 'right' });

        const sections = [
            { label: 'Pending Tasks', status: 'pending', color: [255, 193, 7] },
            { label: 'Completed Tasks', status: 'completed', color: [76, 201, 161] },
            { label: 'Deleted Tasks', status: 'deleted', color: [230, 57, 70] },
        ];

        let startY = 28;
        sections.forEach(({ label, status, color }) => {
            const filtered = tasks.filter(t => t.status === status);
            doc.setFontSize(13);
            doc.setTextColor(...color);
            doc.text(label + ` (${filtered.length})`, 14, startY);

            if (filtered.length === 0) {
                doc.setFontSize(9);
                doc.setTextColor(120, 120, 140);
                doc.text('No tasks in this category.', 14, startY + 6);
                startY += 16;
                return;
            }

            autoTable(doc, {
                startY: startY + 4,
                head: [['#', 'Title', 'Description', 'Status', 'Created At', 'Completed At', 'Deleted At']],
                body: filtered.map((t, i) => [
                    i + 1,
                    t.title,
                    t.description || '—',
                    t.status.toUpperCase(),
                    fmt(t.createdAt),
                    fmt(t.completedAt),
                    fmt(t.deletedAt),
                ]),
                styles: { fillColor: [20, 20, 38], textColor: [220, 220, 240], fontSize: 8, cellPadding: 3 },
                headStyles: { fillColor: color, textColor: [10, 10, 20], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [28, 28, 50] },
                margin: { left: 14, right: 14 },
                theme: 'grid',
            });

            startY = doc.lastAutoTable.finalY + 12;
        });

        // Logs section
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

        doc.save(`tasks-report-${new Date().toISOString().slice(0, 10)}.pdf`);
        showToast('success', '📄 PDF downloaded!');
    };

    // ── Derived ────────────────────────────────────────────────────────────────
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const deletedTasks = tasks.filter(t => t.status === 'deleted');

    const tabTasks = activeTab === 'pending' ? pendingTasks
        : activeTab === 'completed' ? completedTasks
            : deletedTasks;

    const tabConfig = [
        { key: 'pending', label: 'Pending', icon: 'clock', count: pendingTasks.length, color: '#ffc107' },
        { key: 'completed', label: 'Completed', icon: 'check-circle', count: completedTasks.length, color: '#4cc9a1' },
        { key: 'deleted', label: 'Deleted', icon: 'trash-alt', count: deletedTasks.length, color: '#e63946' },
    ];

    const actionIconMap = { created: 'plus-circle', completed: 'check-circle', reopened: 'undo', updated: 'edit', deleted: 'trash-alt' };
    const actionColorMap = { created: '#4cc9a1', completed: '#4361ee', reopened: '#ffc107', updated: '#a29bfe', deleted: '#e63946' };

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

                    {/* Top bar: status + PDF + Logs */}
                    <div className="tm-topbar">
                        <div className="tm-status-bar">
                            <div className={`tm-status-dot ${backendOnline ? 'online' : 'offline'}`}></div>
                            <span className="tm-status-text">SYSTEM: {backendOnline ? 'CONNECTED' : 'DISCONNECTED'}</span>
                        </div>
                        <div className="tm-topbar-actions">
                            <button className="tm-logs-btn" onClick={() => { setShowLogs(p => !p); fetchLogs(); }}>
                                <Icon name="history" /> {showLogs ? 'Hide' : 'Show'} Logs
                            </button>
                            <button className="tm-pdf-btn" onClick={exportPDF} disabled={tasks.length === 0}>
                                <Icon name="file-pdf" /> Export PDF
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
                            <div className="tm-stat-card tm-stat-completed">
                                <div className="tm-stat-info">
                                    <span className="tm-stat-number">{completedTasks.length}</span>
                                    <span className="tm-stat-label">Completed</span>
                                </div>
                                <div className="tm-stat-icon-wrapper"><Icon name="check-circle" style={{ fontSize: 22 }} /></div>
                            </div>
                            <div className="tm-stat-card tm-stat-pending">
                                <div className="tm-stat-info">
                                    <span className="tm-stat-number">{pendingTasks.length}</span>
                                    <span className="tm-stat-label">Pending</span>
                                </div>
                                <div className="tm-stat-icon-wrapper"><Icon name="clock" style={{ fontSize: 22 }} /></div>
                            </div>
                            <div className="tm-stat-card tm-stat-deleted">
                                <div className="tm-stat-info">
                                    <span className="tm-stat-number">{deletedTasks.length}</span>
                                    <span className="tm-stat-label">Deleted</span>
                                </div>
                                <div className="tm-stat-icon-wrapper"><Icon name="trash-alt" style={{ fontSize: 22 }} /></div>
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
                                        placeholder="Description (optional)..."
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        disabled={!backendOnline}
                                    />
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
                                                        <span className={`tm-status-badge badge-${task.status}`}>
                                                            {task.status === 'pending' ? <><Icon name="clock" /> PENDING</> :
                                                                task.status === 'completed' ? <><Icon name="check-circle" /> DONE</> :
                                                                    <><Icon name="trash-alt" /> DELETED</>}
                                                        </span>
                                                    </div>
                                                    <h3 className="tm-task-title">{task.title}</h3>
                                                    {task.description && <p className="tm-task-desc">{task.description}</p>}

                                                    {/* Timestamps */}
                                                    <div className="tm-timestamps">
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
                                                                    <button className="tm-btn tm-btn-toggle" onClick={() => toggleStatus(task)}>
                                                                        <Icon name="check" /> Complete
                                                                    </button>
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
            </section>
        </div>
    );
}

export default TaskManager;
