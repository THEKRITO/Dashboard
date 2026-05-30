// dashboard.js — handles live sensor updates and charting
const tempEl = document.getElementById('temp');
const humEl = document.getElementById('hum');
const ctx = document.getElementById('sensor-chart').getContext('2d');

const data = { labels: [], datasets: [
  { label: 'Temperature (°C)', data: [], borderColor: 'rgb(255,99,71)', tension: 0.3 },
  { label: 'Humidity (%)', data: [], borderColor: 'rgb(54,162,235)', tension: 0.3 }
] };

const chart = new Chart(ctx, { type: 'line', data, options: { scales: { x: { type: 'time', time: { unit: 'second' } } } } });

function pushSample(sample){
  const t = new Date(sample.time);
  data.labels.push(t);
  data.datasets[0].data.push({ x: t, y: sample.temperature });
  data.datasets[1].data.push({ x: t, y: sample.humidity });
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
fetch('/api/sensors').then(r=>r.json()).then(s=>{
  tempEl.textContent = s.temperature + ' °C';
  humEl.textContent = s.humidity + ' %';
  pushSample(s);
}).catch(()=>{});

// SSE live stream
if(typeof EventSource !== 'undefined'){
  const es = new EventSource('/api/stream');
  es.onmessage = (e)=>{
    try{
      const obj = JSON.parse(e.data);
      tempEl.textContent = obj.temperature + ' °C';
      humEl.textContent = obj.humidity + ' %';
      pushSample(obj);
    }catch(err){ console.error(err) }
  };
  es.onerror = ()=>{ console.warn('SSE connection error') };
}

// periodic status refresh
fetchStatus();
setInterval(fetchStatus, 10000);
