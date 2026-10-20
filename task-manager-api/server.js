'use strict';

const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const { authMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 5000;

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/task-manager';

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB at', MONGO_URI);
}).catch(err => {
    console.error('MongoDB connection error:', err.message);
});

// ─────────────────────────────────────────────
//  Task Schema (extended with userId)
// ─────────────────────────────────────────────
const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'inprogress', 'completed', 'deleted'], default: 'pending' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

const Task = mongoose.model('Task', taskSchema);

// ─────────────────────────────────────────────
//  Activity Log Schema (extended with userId)
// ─────────────────────────────────────────────
const activityLogSchema = new mongoose.Schema({
    taskId: { type: String, required: true },
    taskTitle: { type: String, required: true },
    action: { type: String, required: true },
    details: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

// ─────────────────────────────────────────────
//  Built-in middleware
// ─────────────────────────────────────────────
app.use(express.json());

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Request logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Content-Type validation (skip for auth routes that may be GET)
app.use((req, res, next) => {
    if (['POST', 'PUT'].includes(req.method)) {
        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('application/json')) {
            return res.status(415).json({
                error: 'Unsupported Media Type',
                message: 'Content-Type must be application/json for POST and PUT requests.',
            });
        }
    }
    next();
});

// ─────────────────────────────────────────────
//  Auth Routes (public — no middleware)
// ─────────────────────────────────────────────
app.use('/auth', authRoutes);

// ─────────────────────────────────────────────
//  Validate Task ID
// ─────────────────────────────────────────────
const validateTaskId = (req, res, next) => {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid ID', message: 'Task ID must be a valid MongoDB ObjectId.' });
    }
    req.taskId = id;
    next();
};

// ─────────────────────────────────────────────
//  Helper: is a task overdue? (has a past due date and isn't completed/deleted)
// ─────────────────────────────────────────────
const isOverdue = (d) => {
    if (!d.dueDate) return false;
    if (d.status === 'completed' || d.status === 'deleted') return false;
    return new Date(d.dueDate).getTime() < Date.now();
};

// ─────────────────────────────────────────────
//  Helper: map doc to response shape
// ─────────────────────────────────────────────
const mapTask = (d) => ({
    id: String(d._id),
    title: d.title,
    description: d.description,
    status: d.status,
    priority: d.priority || 'medium',
    dueDate: d.dueDate,
    completed: d.status === 'completed',
    overdue: isOverdue(d),
    completedAt: d.completedAt,
    deletedAt: d.deletedAt,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    _links: { self: `/tasks/${d._id}`, delete: `/tasks/${d._id}` },
});

// ─────────────────────────────────────────────
//  TASK ROUTES (all protected with authMiddleware)
// ─────────────────────────────────────────────

// GET /tasks  (optional ?status=pending|inprogress|completed|deleted|overdue|all
//              optional ?from=YYYY-MM-DD&to=YYYY-MM-DD  → filter by createdAt range)
app.get('/tasks', authMiddleware, async (req, res, next) => {
    try {
        const statusFilter = req.query.status;
        const query = { userId: req.userId };

        if (statusFilter === 'overdue') {
            // Overdue = has a past dueDate and isn't completed/deleted
            query.dueDate = { $lt: new Date() };
            query.status = { $nin: ['completed', 'deleted'] };
        } else if (statusFilter && statusFilter !== 'all') {
            query.status = statusFilter;
        }

        // Optional date-range filter on createdAt (used by PDF export)
        const from = req.query.from ? new Date(req.query.from) : null;
        const to = req.query.to ? new Date(req.query.to) : null;
        if (from && !isNaN(from)) {
            query.createdAt = { ...(query.createdAt || {}), $gte: from };
        }
        if (to && !isNaN(to)) {
            // Inclusive end-of-day
            const endOfDay = new Date(to);
            endOfDay.setHours(23, 59, 59, 999);
            query.createdAt = { ...(query.createdAt || {}), $lte: endOfDay };
        }

        const docs = await Task.find(query).sort({ createdAt: 1 }).lean();
        res.status(200).json({ success: true, count: docs.length, data: docs.map(mapTask) });
    } catch (err) { next(err); }
});

// GET /tasks/:id
app.get('/tasks/:id', authMiddleware, validateTaskId, async (req, res, next) => {
    try {
        const doc = await Task.findOne({ _id: req.taskId, userId: req.userId }).lean();
        if (!doc) return res.status(404).json({ error: 'Not Found', message: `Task ${req.taskId} not found.` });
        res.status(200).json({ success: true, data: mapTask(doc) });
    } catch (err) { next(err); }
});

// POST /tasks → create
app.post('/tasks', authMiddleware, async (req, res, next) => {
    try {
        const { title, description, priority, dueDate, status } = req.body;
        if (!title || typeof title !== 'string' || title.trim() === '') {
            return res.status(400).json({ error: 'Validation Error', message: '"title" is required.' });
        }
        if (priority !== undefined && !['low', 'medium', 'high'].includes(priority)) {
            return res.status(400).json({ error: 'Validation Error', message: '"priority" must be low, medium, or high.' });
        }
        if (status !== undefined && !['pending', 'inprogress'].includes(status)) {
            return res.status(400).json({ error: 'Validation Error', message: '"status" must be pending or inprogress on create.' });
        }
        let parsedDue = null;
        if (dueDate) {
            parsedDue = new Date(dueDate);
            if (isNaN(parsedDue)) {
                return res.status(400).json({ error: 'Validation Error', message: '"dueDate" must be a valid date.' });
            }
        }
        const doc = await Task.create({
            title: title.trim(),
            description: description ? String(description).trim() : '',
            priority: priority || 'medium',
            dueDate: parsedDue,
            status: status || 'pending',
            userId: req.userId,
        });
        res.status(201).json({ success: true, message: 'Task created successfully.', data: mapTask(doc) });
    } catch (err) { next(err); }
});

// PUT /tasks/:id → update (blocked if deleted)
app.put('/tasks/:id', authMiddleware, validateTaskId, async (req, res, next) => {
    try {
        const existing = await Task.findOne({ _id: req.taskId, userId: req.userId }).lean();
        if (!existing) return res.status(404).json({ error: 'Not Found', message: `Task ${req.taskId} not found.` });
        if (existing.status === 'completed') {
            return res.status(403).json({ error: 'Forbidden', message: 'Cannot update a completed task.' });
        }
        if (existing.status === 'deleted') {
            return res.status(403).json({ error: 'Forbidden', message: 'Cannot update a deleted task.' });
        }

        const { title, description, status, priority, dueDate } = req.body;
        if (title === undefined && description === undefined && status === undefined && priority === undefined && dueDate === undefined) {
            return res.status(400).json({ error: 'Validation Error', message: 'Provide at least one of: title, description, status, priority, dueDate.' });
        }

        const update = {};
        if (title !== undefined) {
            if (typeof title !== 'string' || title.trim() === '') return res.status(400).json({ error: 'Validation Error', message: '"title" must be a non-empty string.' });
            update.title = title.trim();
        }
        if (description !== undefined) {
            if (typeof description !== 'string') return res.status(400).json({ error: 'Validation Error', message: '"description" must be a string.' });
            update.description = description.trim();
        }
        if (priority !== undefined) {
            if (!['low', 'medium', 'high'].includes(priority)) return res.status(400).json({ error: 'Validation Error', message: '"priority" must be low, medium, or high.' });
            update.priority = priority;
        }
        if (dueDate !== undefined) {
            if (dueDate === null || dueDate === '') {
                update.dueDate = null;
            } else {
                const parsed = new Date(dueDate);
                if (isNaN(parsed)) return res.status(400).json({ error: 'Validation Error', message: '"dueDate" must be a valid date or null.' });
                update.dueDate = parsed;
            }
        }
        if (status !== undefined) {
            if (!['pending', 'inprogress', 'completed'].includes(status)) return res.status(400).json({ error: 'Validation Error', message: '"status" must be pending, inprogress, or completed.' });
            update.status = status;
            if (status === 'completed' && existing.status !== 'completed') {
                update.completedAt = new Date();
            } else if (status !== 'completed') {
                update.completedAt = null;
            }
        }

        const doc = await Task.findOneAndUpdate(
            { _id: req.taskId, userId: req.userId },
            update,
            { new: true, runValidators: true }
        ).lean();
        res.status(200).json({ success: true, message: 'Task updated successfully.', data: mapTask(doc) });
    } catch (err) { next(err); }
});

// DELETE /tasks/:id → SOFT DELETE
app.delete('/tasks/:id', authMiddleware, validateTaskId, async (req, res, next) => {
    try {
        const doc = await Task.findOneAndUpdate(
            { _id: req.taskId, userId: req.userId },
            { status: 'deleted', deletedAt: new Date() },
            { new: true }
        ).lean();
        if (!doc) return res.status(404).json({ error: 'Not Found', message: `Task ${req.taskId} not found.` });
        res.status(200).json({ success: true, message: 'Task deleted successfully.', data: mapTask(doc) });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  ACTIVITY LOG ROUTES (protected)
// ─────────────────────────────────────────────

// GET /logs
app.get('/logs', authMiddleware, async (req, res, next) => {
    try {
        const logs = await ActivityLog.find({ userId: req.userId }).sort({ timestamp: -1 }).limit(200).lean();
        res.status(200).json({ success: true, count: logs.length, data: logs });
    } catch (err) { next(err); }
});

// POST /logs → create log entry
app.post('/logs', authMiddleware, async (req, res, next) => {
    try {
        const { taskId, taskTitle, action, details } = req.body;
        if (!taskId || !taskTitle || !action) {
            return res.status(400).json({ error: 'Validation Error', message: 'taskId, taskTitle, and action are required.' });
        }
        const log = await ActivityLog.create({
            taskId,
            taskTitle,
            action,
            details: details || '',
            userId: req.userId,
        });
        res.status(201).json({ success: true, data: log });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  404 Handler
// ─────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.url} does not exist.` });
});

// ─────────────────────────────────────────────
//  Global Error Handler
// ─────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('[ERROR]', err.stack);
    res.status(500).json({ error: 'Internal Server Error', message: 'Something went wrong on the server.' });
});

// ─────────────────────────────────────────────
//  Start server
// ─────────────────────────────────────────────
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Task Manager API running on http://localhost:${PORT}`);
        console.log('Endpoints: POST /auth/register, POST /auth/login, POST /auth/google, POST /auth/forgot-password, POST /auth/reset-password');
        console.log('Protected: GET|POST /tasks, GET|PUT|DELETE /tasks/:id, GET|POST /logs');
    });
}

module.exports = app;
