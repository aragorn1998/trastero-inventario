const STORAGE_KEY = 'trastero_inventario_v1';

const state = {
  items: [],
  filteredItems: [],
  query: ''
};

const el = {
  cardsContainer: document.getElementById('cardsContainer'),
  emptyState: document.getElementById('emptyState'),
  statsText: document.getElementById('statsText'),
  searchInput: document.getElementById('searchInput'),
  addBtn: document.getElementById('addBtn'),
  modal: document.getElementById('itemModal'),
  modalTitle: document.getElementById('modalTitle'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  itemForm: document.getElementById('itemForm'),
  itemId: document.getElementById('itemId'),
  nameInput: document.getElementById('nameInput'),
  categoryInput: document.getElementById('categoryInput'),
  locationInput: document.getElementById('locationInput'),
  notesInput: document.getElementById('notesInput'),
  tokenBtn: document.getElementById('tokenBtn'),
  syncBadge: document.getElementById('syncBadge')
};

bootstrap();

async function bootstrap() {
  // En la versión local no usamos token ni sincronización.
  el.tokenBtn?.classList.add('hidden');
  el.syncBadge?.classList.add('hidden');

  state.items = await loadInitialItems();
  applyFilter();
  bindEvents();
}

async function loadInitialItems() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.warn('No se pudo leer localStorage, se cargará el JSON inicial.', error);
    }
  }

  try {
    const response = await fetch('inventario.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo cargar inventario.json');
    const data = await response.json();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  } catch (error) {
    console.warn('No se pudo cargar el JSON inicial. Se usará una lista vacía.', error);
    return [];
  }
}

function bindEvents() {
  el.addBtn.addEventListener('click', () => openModal());
  el.closeModalBtn.addEventListener('click', closeModal);
  el.cancelBtn.addEventListener('click', closeModal);
  el.searchInput.addEventListener('input', (event) => {
    state.query = event.target.value.trim().toLowerCase();
    applyFilter();
  });

  el.itemForm.addEventListener('submit', (event) => {
    event.preventDefault();
    saveFromForm();
  });

  el.modal.addEventListener('click', (event) => {
    if (event.target.dataset.close === 'true') closeModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !el.modal.classList.contains('hidden')) {
      closeModal();
    }
  });
}

function applyFilter() {
  const query = state.query;
  if (!query) {
    state.filteredItems = [...state.items];
  } else {
    state.filteredItems = state.items.filter((item) => {
      const haystack = [item.name, item.category, item.location, item.notes]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }
  renderItems();
}

function renderItems() {
  el.cardsContainer.innerHTML = '';
  el.statsText.textContent = `${state.filteredItems.length} objeto${state.filteredItems.length === 1 ? '' : 's'}`;

  if (state.filteredItems.length === 0) {
    el.emptyState.classList.remove('hidden');
  } else {
    el.emptyState.classList.add('hidden');
  }

  state.filteredItems.forEach((item) => {
    const article = document.createElement('article');
    article.className = 'item-card';
    article.innerHTML = `
      <div class="item-header">
        <div>
          <h3 class="item-title"></h3>
          <span class="item-category"></span>
        </div>
      </div>
      <p class="item-location"></p>
      <p class="item-notes"></p>
      <div class="item-actions">
        <button class="mini-btn" data-action="edit">✏️ Editar</button>
        <button class="mini-btn danger" data-action="delete">🗑️ Eliminar</button>
      </div>
    `;

    article.querySelector('.item-title').textContent = item.name;
    article.querySelector('.item-category').textContent = item.category;
    article.querySelector('.item-location').textContent = `📍 ${item.location}`;
    article.querySelector('.item-notes').textContent = item.notes ? `📝 ${item.notes}` : '📝 Sin notas';

    article.querySelector('[data-action="edit"]').addEventListener('click', () => openModal(item));
    article.querySelector('[data-action="delete"]').addEventListener('click', () => deleteItem(item.id));

    el.cardsContainer.appendChild(article);
  });
}

function openModal(item = null) {
  el.itemForm.reset();
  if (item) {
    el.modalTitle.textContent = 'Editar objeto';
    el.itemId.value = item.id;
    el.nameInput.value = item.name;
    el.categoryInput.value = item.category;
    el.locationInput.value = item.location;
    el.notesInput.value = item.notes || '';
  } else {
    el.modalTitle.textContent = 'Añadir objeto';
    el.itemId.value = '';
  }

  el.modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  setTimeout(() => el.nameInput.focus(), 20);
}

function closeModal() {
  el.modal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function saveFromForm() {
  const item = {
    id: el.itemId.value || createId(),
    name: el.nameInput.value.trim(),
    category: el.categoryInput.value.trim(),
    location: el.locationInput.value.trim(),
    notes: el.notesInput.value.trim()
  };

  const existingIndex = state.items.findIndex((entry) => entry.id === item.id);
  if (existingIndex >= 0) {
    state.items[existingIndex] = item;
  } else {
    state.items.unshift(item);
  }

  persistItems();
  applyFilter();
  closeModal();
}

function deleteItem(id) {
  const confirmed = window.confirm('¿Seguro que quieres eliminar este objeto?');
  if (!confirmed) return;

  state.items = state.items.filter((item) => item.id !== id);
  persistItems();
  applyFilter();
}

function persistItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
}

function createId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
