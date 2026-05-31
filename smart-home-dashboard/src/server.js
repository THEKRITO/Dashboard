require('dotenv').config();
const express = require('express');
const os = require('os');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Authentication Middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Local Strategy
passport.use(new LocalStrategy((username, password, done) => {
  if (username !== process.env.LOCAL_USERNAME) return done(null, false, { message: 'Invalid username' });
  bcrypt.compare(password, process.env.LOCAL_PASSWORD_HASH, (err, res) => {
    if (res) return done(null, { username, method: 'local' });
    return done(null, false, { message: 'Invalid password' });
  });
}));

// GitHub Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_ID !== 'your_id_here') {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `http://localhost:${PORT}/auth/github/callback`
  }, (accessToken, refreshToken, profile, done) => {
    const allowedUsers = (process.env.GITHUB_ALLOWED_USERS || '').split(',').map(u => u.trim());
    if (allowedUsers.includes(profile.username)) {
      return done(null, { username: profile.username, method: 'github' });
    }
    return done(null, false, { message: 'GitHub user not authorized' });
  }));
}

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login.html');
}

// Auth Routes
app.post('/auth/login', passport.authenticate('local', {
  successRedirect: '/terminal.html',
  failureRedirect: '/login.html'
}));

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login.html' }),
  (req, res) => res.redirect('/terminal.html')
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

// Protect terminal.html specifically before static server
app.get('/terminal.html', ensureAuthenticated);

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
        console.log(`Fetched Bucharest temp: ${temp}`);
        cb(temp !== undefined ? Number(temp) : null);
      } catch (e) { 
        console.error('Error parsing weather data:', e);
        cb(null); 
      }
    });
  }).on('error', (err) => {
    console.error('Error fetching weather data:', err);
    cb(null);
  });
}

function getPiCpuTemp() {
  try {
    const tempPath = '/sys/class/thermal/thermal_zone0/temp';
    if (fs.existsSync(tempPath)) {
      const tempStr = fs.readFileSync(tempPath, 'utf8').trim();
      const temp = Number(tempStr) / 1000;
      console.log(`Read Pi CPU temp: ${temp}`);
      return temp;
    } else {
      console.warn(`CPU temp file not found at ${tempPath}. Returning mock data for testing.`);
      // Return a mock temperature if not on a Pi (e.g., between 40 and 50)
      return 40 + Math.random() * 10;
    }
  } catch (e) {
    console.error('Error reading CPU temp:', e);
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
app.post('/api/exec', ensureAuthenticated, (req, res) => {
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
const io = new Server(server);
const pty = require('node-pty');

// Middleware to share session with socket.io
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
})));
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));

io.on('connection', (socket) => {
  // Check if authenticated
  if (!socket.request.isAuthenticated || !socket.request.isAuthenticated()) {
    console.log('Unauthenticated socket connection rejected');
    socket.disconnect(true);
    return;
  }

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
