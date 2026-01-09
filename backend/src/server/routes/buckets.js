const path = require('path');
const { readJsonSafe, writeJsonSafe, ensureDirSync } = require('../../shared/fileStore');
const { parseInstructionsToRules, parseInstructionsToBucketModel } = require('../../core/parser/instructionParser');

const BUCKET_INDEX_FILE = 'bucket-index.json';

function createBucketsHandler(config) {
  const dataDir = config.dataDir;
  const bucketsDir = path.join(dataDir, 'buckets');
  ensureDirSync(bucketsDir);

  function getIndexPath() {
    return path.join(bucketsDir, BUCKET_INDEX_FILE);
  }

  function list(req, res) {
    const index = readJsonSafe(getIndexPath(), { buckets: [] });
    res.json(index);
  }

  function createOrUpdate(req, res) {
    const { id, name, description, tags = [], instructions } = req.body || {};

    if (!instructions || typeof instructions !== 'string') {
      return res.status(400).json({ error: 'instructions must be a non-empty string' });
    }

    const bucketId = id || Date.now().toString(36);
    const model = parseInstructionsToBucketModel(instructions);
    const rules = model.flatRules || [];

    const indexPath = getIndexPath();
    const index = readJsonSafe(indexPath, { buckets: [] });

    const existingIndex = index.buckets.findIndex((b) => b.id === bucketId);
    const bucketMeta = {
      id: bucketId,
      name: name || `Bucket ${bucketId}`,
      description: description || '',
      tags,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      index.buckets[existingIndex] = bucketMeta;
    } else {
      index.buckets.push(bucketMeta);
    }

    writeJsonSafe(indexPath, index);

    const bucketPath = path.join(bucketsDir, `bucket-${bucketId}.json`);
    const bucketData = {
      ...bucketMeta,
      instructions: model.rawInstructions,
      projects: model.projects,
      globalRules: model.globalRules,
      rules,
    };

    writeJsonSafe(bucketPath, bucketData);

    res.json(bucketData);
  }

  return { list, createOrUpdate };
}

module.exports = { createBucketsHandler };
