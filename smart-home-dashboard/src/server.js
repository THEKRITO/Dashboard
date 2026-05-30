const express = require('express');
const os = require('os');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json({ limit: '1mb' }));

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

// Simple simulated sensors
function sampleSensors(){
  const temp = 20 + Math.random() * 10; // 20-30°C
  const hum = 30 + Math.random() * 40; // 30-70%
  return { temperature: Number(temp.toFixed(1)), humidity: Number(hum.toFixed(1)), time: new Date() };
}

app.get('/api/sensors', (req, res) => {
  // return a single sample
  res.json(sampleSensors());
});

// Execute shell commands (CAUTION: exposes shell access). Only use on trusted networks.
const { exec } = require('child_process');
app.post('/api/exec', (req, res) => {
  const { cmd } = req.body || {};
  if(!cmd || typeof cmd !== 'string') return res.status(400).json({ error: 'cmd required' });
  // Run command with timeout and limited buffer
  exec(cmd, { timeout: 20_000, maxBuffer: 1024 * 500 }, (err, stdout, stderr) => {
    const code = err && err.code ? err.code : 0;
    res.json({ code, stdout: stdout || '', stderr: stderr || (err ? String(err) : '') });
  });
});

// Server-Sent Events for live sensor updates
const sseClients = new Set();

app.get('/api/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders && res.flushHeaders();
  res.write('\n');
  const client = res;
  sseClients.add(client);
  req.on('close', () => {
    sseClients.delete(client);
  });
});

// Periodically broadcast sensor data to SSE clients
setInterval(() => {
  const data = sampleSensors();
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for(const client of sseClients){
    try{ client.write(payload); }catch(e){ sseClients.delete(client); }
  }
}, 5000);

app.listen(PORT, () => {
  console.log(`Smart Home Dashboard running on http://localhost:${PORT}`);
});

module.exports = app;
