const express = require('express');
const os = require('os');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/status', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    platform: os.platform(),
    arch: os.arch(),
    uptime: os.uptime(),
    loadavg: os.loadavg(),
    cpus: os.cpus().length,
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      node_rss: mem.rss,
      node_heapTotal: mem.heapTotal,
      node_heapUsed: mem.heapUsed
    },
    time: new Date()
  });
});

app.listen(PORT, () => {
  console.log(`Smart Home Dashboard running on http://localhost:${PORT}`);
});

module.exports = app;
