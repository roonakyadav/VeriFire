function createHealthHandler() {
  return (req, res) => {
    res.json({ status: 'ok' });
  };
}

module.exports = { createHealthHandler };
