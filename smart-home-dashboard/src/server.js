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


// Outside temperature for Bucharest using Open-Meteo API and Pi CPU temp
const https = require('https');
const fs = require('fs');
function fetchBucharestTemp(cb) {
  // Bucharest coordinates: 44.439663, 26.096306
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=44.439663&longitude=26.096306&current_weather=true';
  https.get(url, resp => {
    let data = '';
    resp.on('data', chunk => data += chunk);
    resp.on('end', () => {
      try {
        const obj = JSON.parse(data);
        const temp = obj.current_weather && obj.current_weather.temperature;
        cb(temp !== undefined ? Number(temp) : null);
      } catch (e) { cb(null); }
    });
  }).on('error', () => cb(null));
}

function getPiCpuTemp() {
  try {
    const tempStr = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8');
    return Number(tempStr) / 1000;
  } catch (e) {
    return null;
  }
}

function sampleSensors(cb) {
  fetchBucharestTemp(outsideTemp => {
    const cpuTemp = getPiCpuTemp();
    cb({ outside: outsideTemp, cpu: cpuTemp, time: new Date() });
  });
}

app.get('/api/sensors', (req, res) => {
  sampleSensors(sensor => res.json(sensor));
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
  sampleSensors((data) => {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for(const client of sseClients){
      try { 
        client.write(payload); 
      } catch(e) { 
        sseClients.delete(client); 
      }
    }
  });
}, 5000);

// Create HTTP server and attach Socket.IO for interactive terminal
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { /* defaults */ });
const pty = require('node-pty');

io.on('connection', (socket) => {
  // spawn a shell for each connected client
  const shell = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : 'bash');
  const term = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: process.env
  });

  term.on('data', (data) => {
    socket.emit('output', data);
  });

  socket.on('input', (data) => {
    term.write(data);
  });

  socket.on('resize', ({cols, rows}) => {
    try{ term.resize(cols, rows); }catch(e){}
  });

  socket.on('disconnect', () => {
    try{ term.kill(); }catch(e){}
  });
});

server.listen(PORT, () => {
  console.log(`Smart Home Dashboard running on http://localhost:${PORT}`);
});

module.exports = app;
