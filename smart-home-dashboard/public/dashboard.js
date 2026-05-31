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



// initial sensor fetch
function updateSensors(s) {
  tempOutEl.textContent = (s.outside !== null ? s.outside + ' °C' : 'N/A');
  tempCpuEl.textContent = (s.cpu !== null ? s.cpu + ' °C' : 'N/A');
  pushSample(s);
}

fetch('/api/sensors').then(r=>r.json()).then(updateSensors).catch(()=>{});

// Poll every 30s for new data
setInterval(() => {
  fetch('/api/sensors').then(r=>r.json()).then(updateSensors);
}, 30000);

// periodic status refresh
fetchStatus();
setInterval(fetchStatus, 10000);
