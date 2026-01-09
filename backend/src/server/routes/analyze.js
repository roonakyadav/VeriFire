const path = require('path');
const { readJsonSafe } = require('../../shared/fileStore');
const { evaluateTextAgainstBuckets } = require('../../core/verification/outputVerifier');

function createAnalyzeHandler(config) {
  const dataDir = config.dataDir;
  const bucketsDir = path.join(dataDir, 'buckets');

  return async (req, res) => {
    const { promptText, responseText, bucketIds, chatId } = req.body || {};

    if (typeof promptText !== 'string' || typeof responseText !== 'string') {
      return res.status(400).json({ error: 'promptText and responseText are required strings' });
    }

    try {
      const bucketIndex = readJsonSafe(path.join(bucketsDir, 'bucket-index.json'), { buckets: [] });
      const selectedBucketsMeta = (bucketIndex.buckets || []).filter((b) =>
        !Array.isArray(bucketIds) || bucketIds.length === 0 ? true : bucketIds.includes(b.id)
      );

      const selectedBuckets = selectedBucketsMeta.map((meta) => {
        const bucketPath = path.join(bucketsDir, `bucket-${meta.id}.json`);
        return readJsonSafe(bucketPath, null);
      }).filter(Boolean);

      const analysis = await evaluateTextAgainstBuckets({
        promptText,
        responseText,
        buckets: selectedBuckets,
        chatId, // Pass chatId for conversation-aware analysis
      });

      res.json(analysis);
    } catch (err) {
      console.error('[VeriFire] analyze error', err);
      res.status(500).json({ error: 'internal_error' });
    }
  };
}

module.exports = { createAnalyzeHandler };
