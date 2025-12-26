const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scan.controller');
const storageController = require('../controllers/storage.controller');
const catalogController = require('../controllers/catalog.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Protect all API routes with authenticate middleware
router.post('/scan', authenticate, scanController.scan);
router.post('/search-metadata', authenticate, scanController.searchMetadata);
router.post('/save-db', authenticate, storageController.saveDb);

// Catalog Routes
router.get('/catalog/stats', authenticate, catalogController.getStats);
router.get('/catalog/landing', authenticate, catalogController.getCatalogData);
router.get('/catalog/search', authenticate, catalogController.searchTitles);
router.get('/catalog/title/:id', authenticate, catalogController.getTitle);
router.post('/catalog/title', authenticate, catalogController.saveTitle);
router.delete('/catalog/title/:id', authenticate, catalogController.deleteTitle);
router.post('/catalog/title/:id/import-mega', authenticate, catalogController.importMegaToTitle);
router.post('/catalog/import-imdb', authenticate, catalogController.importFromImdb);

router.post('/catalog/stream', authenticate, catalogController.saveStream);
router.delete('/catalog/stream/:id', authenticate, catalogController.deleteStream);
router.get('/catalog/stream/:id/play', authenticate, catalogController.streamContent);

module.exports = router;
