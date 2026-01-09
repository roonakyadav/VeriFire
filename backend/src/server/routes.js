const express = require('express');

const { createAnalyzeHandler } = require('./routes/analyze');
const { createBucketsHandler } = require('./routes/buckets');
const { createHealthHandler } = require('./routes/health');
const { createAIConfigHandler } = require('./routes/aiConfig');
const { createConversationHandler } = require('./routes/conversation');

function createRouter(config) {
  const router = express.Router();

  router.get('/health', createHealthHandler());
  router.get('/buckets', createBucketsHandler(config).list);
  router.post('/buckets', createBucketsHandler(config).createOrUpdate);
  router.post('/backend-api/analyze', createAnalyzeHandler(config));
  router.post('/ai-config', createAIConfigHandler(config));
  router.post('/backend-api/conversation/init', createConversationHandler(config));

  return router;
}

module.exports = { createRouter };
