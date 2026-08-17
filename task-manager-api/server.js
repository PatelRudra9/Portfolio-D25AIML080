'use strict';

const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

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
//  Task Schema (extended with status & timestamps)
// ─────────────────────────────────────────────
const taskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'completed', 'deleted'], default: 'pending' },
    completedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
}, { timestamps: true });

const Task = mongoose.model('Task', taskSchema);

// ─────────────────────────────────────────────
//  Activity Log Schema
// ─────────────────────────────────────────────
const activityLogSchema = new mongoose.Schema({
    taskId: { type: String, required: true },
    taskTitle: { type: String, required: true },
    action: { type: String, required: true }, // created | completed | reopened | updated | deleted
    details: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
});

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

// ─────────────────────────────────────────────
//  Built-in middleware
// ─────────────────────────────────────────────
app.use(express.json());

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Request logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Content-Type validation
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
//  Helper: map doc to response shape
// ─────────────────────────────────────────────
const mapTask = (d) => ({
    id: String(d._id),
    title: d.title,
    description: d.description,
    status: d.status,
    completed: d.status === 'completed', // backward compat
    completedAt: d.completedAt,
    deletedAt: d.deletedAt,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    _links: { self: `/tasks/${d._id}`, delete: `/tasks/${d._id}` },
});

// ─────────────────────────────────────────────
//  TASK ROUTES
// ─────────────────────────────────────────────

// GET /tasks  (optional ?status=pending|completed|deleted|all)
app.get('/tasks', async (req, res, next) => {
    try {
        const statusFilter = req.query.status;
        const query = (statusFilter && statusFilter !== 'all')
            ? { status: statusFilter }
            : {};
        const docs = await Task.find(query).sort({ createdAt: 1 }).lean();
        res.status(200).json({ success: true, count: docs.length, data: docs.map(mapTask) });
    } catch (err) { next(err); }
});

// GET /tasks/:id
app.get('/tasks/:id', validateTaskId, async (req, res, next) => {
    try {
        const doc = await Task.findById(req.taskId).lean();
        if (!doc) return res.status(404).json({ error: 'Not Found', message: `Task ${req.taskId} not found.` });
        res.status(200).json({ success: true, data: mapTask(doc) });
    } catch (err) { next(err); }
});

// POST /tasks → create
app.post('/tasks', async (req, res, next) => {
    try {
        const { title, description } = req.body;
        if (!title || typeof title !== 'string' || title.trim() === '') {
            return res.status(400).json({ error: 'Validation Error', message: '"title" is required.' });
        }
        const doc = await Task.create({ title: title.trim(), description: description ? String(description).trim() : '' });
        res.status(201).json({ success: true, message: 'Task created successfully.', data: mapTask(doc) });
    } catch (err) { next(err); }
});

// PUT /tasks/:id → update (blocked if deleted)
app.put('/tasks/:id', validateTaskId, async (req, res, next) => {
    try {
        const existing = await Task.findById(req.taskId).lean();
        if (!existing) return res.status(404).json({ error: 'Not Found', message: `Task ${req.taskId} not found.` });
        if (existing.status === 'completed') {
            return res.status(403).json({ error: 'Forbidden', message: 'Cannot update a completed task.' });
        }
        if (existing.status === 'deleted') {
            return res.status(403).json({ error: 'Forbidden', message: 'Cannot update a deleted task.' });
        }

        const { title, description, status } = req.body;
        if (title === undefined && description === undefined && status === undefined) {
            return res.status(400).json({ error: 'Validation Error', message: 'Provide at least one of: title, description, status.' });
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
        if (status !== undefined) {
            if (!['pending', 'completed'].includes(status)) return res.status(400).json({ error: 'Validation Error', message: '"status" must be pending or completed.' });
            update.status = status;
            if (status === 'completed' && existing.status !== 'completed') {
                update.completedAt = new Date();
            } else if (status === 'pending') {
                update.completedAt = null;
            }
        }

        const doc = await Task.findByIdAndUpdate(req.taskId, update, { new: true, runValidators: true }).lean();
        res.status(200).json({ success: true, message: 'Task updated successfully.', data: mapTask(doc) });
    } catch (err) { next(err); }
});

// DELETE /tasks/:id → SOFT DELETE
app.delete('/tasks/:id', validateTaskId, async (req, res, next) => {
    try {
        const doc = await Task.findByIdAndUpdate(
            req.taskId,
            { status: 'deleted', deletedAt: new Date() },
            { new: true }
        ).lean();
        if (!doc) return res.status(404).json({ error: 'Not Found', message: `Task ${req.taskId} not found.` });
        res.status(200).json({ success: true, message: 'Task deleted successfully.', data: mapTask(doc) });
    } catch (err) { next(err); }
});

// ─────────────────────────────────────────────
//  ACTIVITY LOG ROUTES
// ─────────────────────────────────────────────

// GET /logs
app.get('/logs', async (req, res, next) => {
    try {
        const logs = await ActivityLog.find().sort({ timestamp: -1 }).limit(200).lean();
        res.status(200).json({ success: true, count: logs.length, data: logs });
    } catch (err) { next(err); }
});

// POST /logs → create log entry
app.post('/logs', async (req, res, next) => {
    try {
        const { taskId, taskTitle, action, details } = req.body;
        if (!taskId || !taskTitle || !action) {
            return res.status(400).json({ error: 'Validation Error', message: 'taskId, taskTitle, and action are required.' });
        }
        const log = await ActivityLog.create({ taskId, taskTitle, action, details: details || '' });
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
        console.log('Endpoints: GET|POST /tasks, GET|PUT|DELETE /tasks/:id, GET|POST /logs');
    });
}

module.exports = app;
