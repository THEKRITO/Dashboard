async function fetchStatus(){
  try{
    const res = await fetch('/api/status');
    const data = await res.json();
    document.getElementById('status-json').textContent = JSON.stringify(data, null, 2);
  }catch(err){
    document.getElementById('status-json').textContent = 'Error: ' + err.message;
  }
}

fetchStatus();
setInterval(fetchStatus, 5000);
