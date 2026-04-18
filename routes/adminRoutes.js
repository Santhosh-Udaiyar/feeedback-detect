const express = require('express');
const { body } = require('express-validator');
const {
  getAnalytics,
  getAllFeedback,
  updateFeedbackStatus,
  deleteFeedback,
  getAllUsers,
  toggleUserStatus,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(protect, adminOnly); // All admin routes require admin JWT

const statusValidation = [
  body('status')
    .isIn(['pending','reviewed','resolved'])
    .withMessage('Invalid status'),
  body('admin_note')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Admin note too long'),
];

// Analytics
router.get('/analytics',              getAnalytics);

// Feedback management
router.get('/feedback',               getAllFeedback);
router.patch('/feedback/:id/status',  statusValidation, updateFeedbackStatus);
router.delete('/feedback/:id',        deleteFeedback);

// User management
router.get('/users',                  getAllUsers);
router.patch('/users/:id/toggle',     toggleUserStatus);

module.exports = router;
