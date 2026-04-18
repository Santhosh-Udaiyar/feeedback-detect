const { validationResult } = require('express-validator');
const pool = require('../config/database');

// ── Submit Feedback ──────────────────────────────────────────────────────────
exports.submitFeedback = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { category, rating, title, comment } = req.body;
  const userId = req.user.id;

  try {
    const [result] = await pool.query(
      `INSERT INTO feedback (user_id, category, rating, title, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, category, rating, title.trim(), comment.trim()]
    );
    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      feedbackId: result.insertId,
    });
  } catch (err) {
    console.error('Submit feedback error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get My Feedback ──────────────────────────────────────────────────────────
exports.getMyFeedback = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const [rows] = await pool.query(
      `SELECT f.id, f.category, f.rating, f.title, f.comment,
              f.status, f.admin_note, f.created_at, f.updated_at
       FROM feedback f
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, parseInt(limit), offset]
    );

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM feedback WHERE user_id = ?',
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get feedback error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get Single Feedback (owner only) ────────────────────────────────────────
exports.getFeedbackById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM feedback WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get by ID error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Update Feedback (owner only) ─────────────────────────────────────────────
exports.updateFeedback = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { category, rating, title, comment } = req.body;

  try {
    const [existing] = await pool.query(
      'SELECT id, status FROM feedback WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }
    if (existing[0].status !== 'pending') {
      return res
        .status(400)
        .json({ success: false, message: 'Only pending feedback can be edited' });
    }

    await pool.query(
      `UPDATE feedback SET category=?, rating=?, title=?, comment=?
       WHERE id = ? AND user_id = ?`,
      [category, rating, title.trim(), comment.trim(), req.params.id, req.user.id]
    );
    return res.status(200).json({ success: true, message: 'Feedback updated' });
  } catch (err) {
    console.error('Update feedback error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Delete Feedback (owner only) ─────────────────────────────────────────────
exports.deleteFeedback = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM feedback WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }
    return res.status(200).json({ success: true, message: 'Feedback deleted' });
  } catch (err) {
    console.error('Delete feedback error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
