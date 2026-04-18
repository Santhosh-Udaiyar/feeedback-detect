const { validationResult } = require('express-validator');
const pool = require('../config/database');

// ── Analytics Summary ─────────────────────────────────────────────────────────
exports.getAnalytics = async (req, res) => {
  try {
    const [[summary]] = await pool.query(`
      SELECT
        COUNT(*)                                        AS total_feedback,
        ROUND(AVG(rating), 2)                           AS avg_rating,
        SUM(rating = 5)                                 AS five_star,
        SUM(rating = 4)                                 AS four_star,
        SUM(rating = 3)                                 AS three_star,
        SUM(rating = 2)                                 AS two_star,
        SUM(rating = 1)                                 AS one_star,
        SUM(status = 'pending')                         AS pending,
        SUM(status = 'reviewed')                        AS reviewed,
        SUM(status = 'resolved')                        AS resolved
      FROM feedback
    `);

    const [categoryBreakdown] = await pool.query(`
      SELECT category, COUNT(*) AS count, ROUND(AVG(rating),2) AS avg_rating
      FROM feedback
      GROUP BY category
      ORDER BY count DESC
    `);

    const [trend] = await pool.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS month,
        COUNT(*)                          AS count,
        ROUND(AVG(rating), 2)             AS avg_rating
      FROM feedback
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `);

    const [totalUsers] = await pool.query(
      "SELECT COUNT(*) AS total FROM users WHERE role = 'user'"
    );

    return res.status(200).json({
      success: true,
      data: {
        summary: { ...summary, total_users: totalUsers[0].total },
        category_breakdown: categoryBreakdown,
        monthly_trend: trend.reverse(),
      },
    });
  } catch (err) {
    console.error('Analytics error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get All Feedback (paginated + filtered) ───────────────────────────────────
exports.getAllFeedback = async (req, res) => {
  const {
    page = 1,
    limit = 15,
    category,
    status,
    rating,
    search,
    sort = 'created_at',
    order = 'DESC',
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const allowedSort  = ['created_at', 'rating', 'status', 'category'];
  const allowedOrder = ['ASC', 'DESC'];
  const safeSort  = allowedSort.includes(sort)  ? sort  : 'created_at';
  const safeOrder = allowedOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

  const conditions = [];
  const params     = [];

  if (category) { conditions.push('f.category = ?'); params.push(category); }
  if (status)   { conditions.push('f.status = ?');   params.push(status); }
  if (rating)   { conditions.push('f.rating = ?');   params.push(parseInt(rating)); }
  if (search) {
    conditions.push('(f.title LIKE ? OR f.comment LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const [rows] = await pool.query(
      `SELECT f.id, f.category, f.rating, f.title, f.comment,
              f.status, f.admin_note, f.created_at, f.updated_at,
              u.id AS user_id, u.name AS user_name, u.email AS user_email
       FROM feedback f
       JOIN users u ON f.user_id = u.id
       ${whereClause}
       ORDER BY f.${safeSort} ${safeOrder}
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM feedback f
       JOIN users u ON f.user_id = u.id ${whereClause}`,
      params
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
    console.error('Get all feedback error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Update Feedback Status / Admin Note ──────────────────────────────────────
exports.updateFeedbackStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }

  const { status, admin_note } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE feedback SET status = ?, admin_note = ? WHERE id = ?',
      [status, admin_note || null, req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }
    return res.status(200).json({ success: true, message: 'Feedback status updated' });
  } catch (err) {
    console.error('Update status error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Delete Any Feedback (admin) ──────────────────────────────────────────────
exports.deleteFeedback = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM feedback WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }
    return res.status(200).json({ success: true, message: 'Feedback deleted' });
  } catch (err) {
    console.error('Admin delete error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get All Users (admin) ────────────────────────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
              COUNT(f.id) AS feedback_count
       FROM users u
       LEFT JOIN feedback f ON f.user_id = u.id
       WHERE u.role = 'user'
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('Get users error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Toggle User Active Status ────────────────────────────────────────────────
exports.toggleUserStatus = async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE users SET is_active = NOT is_active WHERE id = ? AND role = "user"',
      [req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, message: 'User status toggled' });
  } catch (err) {
    console.error('Toggle user error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
