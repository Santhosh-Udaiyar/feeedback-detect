const express = require('express');
const { body } = require('express-validator');
const {
  submitFeedback,
  getMyFeedback,
  getFeedbackById,
  updateFeedback,
  deleteFeedback,
} = require('../controllers/feedbackController');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect); // All feedback routes require authentication

const feedbackValidation = [
  body('category')
    .isIn(['general','product','service','support','other'])
    .withMessage('Invalid category'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('title')
    .trim().notEmpty().withMessage('Title is required')
    .isLength({ min: 3, max: 200 }),
  body('comment')
    .trim().notEmpty().withMessage('Comment is required')
    .isLength({ min: 10, max: 2000 }),
];

router.post('/',        feedbackValidation, submitFeedback);
router.get('/',                             getMyFeedback);
router.get('/:id',                          getFeedbackById);
router.put('/:id',      feedbackValidation, updateFeedback);
router.delete('/:id',                       deleteFeedback);

module.exports = router;
