// dashboard.js — handles live sensor updates and charting


const tempOutEl = document.getElementById('temp-out');
const tempCpuEl = document.getElementById('temp-cpu');
const ctx = document.getElementById('sensor-chart').getContext('2d');

const data = { labels: [], datasets: [
  { label: 'Outside Temp (°C)', data: [], borderColor: 'rgb(54,162,235)', tension: 0.3 },
  { label: 'CPU Temp (°C)', data: [], borderColor: 'rgb(255,99,71)', tension: 0.3 }
] };

const chart = new Chart(ctx, { type: 'line', data, options: { scales: { x: { type: 'time', time: { unit: 'second' } } } } });

function pushSample(sample){
  const t = new Date(sample.time);
  data.labels.push(t);
  data.datasets[0].data.push({ x: t, y: sample.outside });
  data.datasets[1].data.push({ x: t, y: sample.cpu });
  if(data.labels.length > 20){
    data.labels.shift();
    data.datasets.forEach(ds => ds.data.shift());
  }
  chart.update();
}

async function fetchStatus(){
  try{
    const res = await fetch('/api/status');
    const s = await res.json();
    document.getElementById('status-json').textContent = JSON.stringify(s, null, 2);
  }catch(err){ document.getElementById('status-json').textContent = 'Error: '+err.message }
}



// Load history on start
async function loadHistory() {
  try {
    const res = await fetch('/api/sensors/history');
    const history = await res.json();
    history.forEach(sample => {
      const t = new Date(sample.timestamp);
      data.labels.push(t);
      data.datasets[0].data.push({ x: t, y: sample.outside_temp });
      data.datasets[1].data.push({ x: t, y: sample.cpu_temp });
    });
    // Keep last 100 points
    if (data.labels.length > 100) {
      const toRemove = data.labels.length - 100;
      data.labels.splice(0, toRemove);
      data.datasets.forEach(ds => ds.data.splice(0, toRemove));
    }
    chart.update();
    
    // Update labels with the latest data
    if (history.length > 0) {
      const last = history[history.length - 1];
      tempOutEl.textContent = (last.outside_temp !== null ? last.outside_temp.toFixed(1) + ' °C' : 'N/A');
      tempCpuEl.textContent = (last.cpu_temp !== null ? last.cpu_temp.toFixed(1) + ' °C' : 'N/A');
    }
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

loadHistory();

// Poll every 30s for new data
setInterval(() => {
  fetch('/api/sensors').then(r=>r.json()).then(s => {
    tempOutEl.textContent = (s.outside !== null ? s.outside.toFixed(1) + ' °C' : 'N/A');
    tempCpuEl.textContent = (s.cpu !== null ? s.cpu.toFixed(1) + ' °C' : 'N/A');
    pushSample(s);
  });
}, 30000);

// periodic status refresh
fetchStatus();
setInterval(fetchStatus, 10000);
