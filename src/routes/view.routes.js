const express = require('express');
const router = express.Router();
const viewController = require('../controllers/view.controller');

router.get('/', (req, res) => res.redirect('/login'));
router.get('/login', viewController.login);
router.get('/dashboard', viewController.dashboard);
router.get('/scan', viewController.scan);
router.get('/catalog', viewController.catalog);
router.get('/editor', viewController.editor);
router.get('/editor/:id', viewController.editor);

module.exports = router;
