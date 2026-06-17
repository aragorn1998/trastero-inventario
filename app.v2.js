import { db } from './db.js';

const API_URL = 'https://api.github.com/repos/aragorn1998/trastero-inventario/contents/inventario.json';

let items = [];

// INIT
init();

async function init() {
  registerServiceWorker();
  await loadLocal();
  render();
  setupEvents();
}

async function loadLocal() {
  items = await db.getAll('items');
}

function setupEvents() {
  document.getElementById('addBtn').onclick = async () => {
    const name = prompt('Nombre');
    if (!name) return;

    const item = {
      id: Date.now().toString(),
      name
    };

    await db.add('items', item);
    await db.add('pending', { type: 'add', item });

    items.push(item);
    render();
  };

  document.getElementById('syncBtn').onclick = syncNow;

  window.addEventListener('online', syncNow);
}

function render() {
  const el = document.getElementById('cardsContainer');
  el.innerHTML = items.map(i => `<div>${i.name}</div>`).join('');
}

async function syncNow() {
  const pending = await db.getAll('pending');

  if (pending.length === 0) return;

  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    const remoteItems = JSON.parse(atob(data.content));

    const merged = [...remoteItems];

    pending.forEach(p => {
      if (p.type === 'add') merged.push(p.item);
    });

    await fetch(API_URL, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'sync',
        content: btoa(JSON.stringify(merged))
      })
    });

    await db.clear('pending');

    alert('Sync OK ✅');
  } catch (e) {
    console.error(e);
    alert('Sync failed');
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js');
  }
}