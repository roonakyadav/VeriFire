const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const { createRouter } = require('./routes');

const PORT = process.env.VERIFIRE_PORT || 7310;

function createApp() {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json({ limit: '1mb' }));

  const router = createRouter({
    dataDir: path.join(__dirname, '..', '..', 'data'),
  });

  app.use('/api', router);

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[VeriFire] Backend listening on http://localhost:${PORT}`);
  });
}

module.exports = { createApp };
