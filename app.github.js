/*
  app.github.js
  ----------------
  Esta versión usa la API de GitHub para leer y escribir inventario.json.

  ANTES DE USARLA:
  1) Sube todos los archivos al repositorio.
  2) Edita OWNER, REPO y BRANCH con tus datos.
  3) En index.html sustituye <script src="app.js"></script> por <script src="app.github.js"></script>

  Funcionamiento:
  - Sin token -> modo solo lectura.
  - Con token -> se puede añadir, editar y eliminar.
  - El token se guarda SOLO en el navegador del usuario.
*/

const OWNER = 'aragorn1998';
const REPO = 'trastero-inventario';
const BRANCH = 'main';
const PATH = 'inventario.json';
const TOKEN_STORAGE_KEY = 'trastero_github_token'

const state = {
  items: [],
  filteredItems: [],
  query: '',
  sha: null,
  token: localStorage.getItem(TOKEN_STORAGE_KEY) || '',
  canEdit: false
};

const el = {
  cardsContainer: document.getElementById('cardsContainer'),
  emptyState: document.getElementById('emptyState'),
  statsText: document.getElementById('statsText'),
  searchInput: document.getElementById('searchInput'),
  addBtn: document.getElementById('addBtn'),
  categoryFilter: document.getElementById('categoryFilter'),
  categoryList: document.getElementById('categoryList'),
  categoryClear: document.getElementById('categoryClear'),
  sortSelect: document.getElementById('sortSelect'),
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

init();

async function init() {
  bindEvents();
  await loadFromGitHub();
  populateCategoryFilter();
  await updatePermissionMode();
  applyFilter();
}

function bindEvents() {
  el.addBtn.addEventListener('click', function () {
    if (!state.canEdit) return;
    openModal();
  });

  el.closeModalBtn.addEventListener('click', closeModal);
  el.cancelBtn.addEventListener('click', closeModal);

  el.searchInput.addEventListener('input', function (event) {
    state.query = event.target.value.trim().toLowerCase();
    applyFilter();
  });

  // control limpiar categoría
  function updateCategoryClearVisibility() {
    if (!el.categoryFilter || !el.categoryClear) return;
    const has = !!el.categoryFilter.value && el.categoryFilter.value.trim() !== '';
    el.categoryClear.classList.toggle('hidden', !has);
  }

  if (el.categoryFilter) {
    el.categoryFilter.addEventListener('input', function () {
      applyFilter();
      updateCategoryClearVisibility();
    });
  }

  if (el.categoryClear) {
    el.categoryClear.addEventListener('click', function () {
      if (!el.categoryFilter) return;
      el.categoryFilter.value = '';
      el.categoryFilter.focus();
      applyFilter();
      updateCategoryClearVisibility();
    });
  }


  if (el.sortSelect) {
    el.sortSelect.addEventListener('change', function () {
      applyFilter();
    });
  }

  el.itemForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!state.canEdit) return;
    await saveFromForm();
  });

  el.modal.addEventListener('click', function (event) {
    if (event.target && event.target.dataset.close === 'true') {
      closeModal();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !el.modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  el.tokenBtn.classList.remove('hidden');

  // inicializar visibilidad del clear de categoría
  if (typeof updateCategoryClearVisibility === 'function') updateCategoryClearVisibility();

  el.tokenBtn.addEventListener('click', async function () {
    const current = state.token || '';
    const entered = window.prompt(
      'Pega aqui tu token personal de GitHub.\n\nSi borras el contenido, volveras a modo solo lectura.',
      current
    );

    if (entered === null) return;

    state.token = entered.trim();

    if (state.token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, state.token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }

    await updatePermissionMode();
    applyFilter();
  });
}

// Actualiza clases en <body> para que el logo muestre estado (verde/rojo)
function updateBodyPermissionClass() {
  document.body.classList.toggle('can-edit', !!state.canEdit);
  document.body.classList.toggle('read-only', !state.canEdit);
}

function populateCategoryFilter() {
  if (!el.categoryFilter || !el.categoryList) return;

  const categories = Array.from(new Set(state.items.map(i => (i.category || '').trim()).filter(Boolean))).sort();

  // poblar datalist
  el.categoryList.innerHTML = '';
  categories.forEach(function (cat) {
    const opt = document.createElement('option');
    opt.value = cat;
    el.categoryList.appendChild(opt);
  });
}

async function loadFromGitHub() {
  try {
    const response = await fetch(apiUrl(), {
      headers: githubHeaders(false)
    });

    if (!response.ok) {
      throw new Error('No se pudo leer inventario.json desde GitHub');
    }

    const data = await response.json();
    state.sha = data.sha;

    const decoded = decodeBase64Utf8(data.content || '');
    state.items = JSON.parse(decoded || '[]');
  } catch (error) {
    console.error('Error al cargar inventario:', error);
    state.items = [];
  }
}

async function updatePermissionMode() {
  state.canEdit = false;

  if (!state.token) {
    setReadOnlyUI(true);
    updateBodyPermissionClass();
    return;
  }

  try {
    const response = await fetch(apiUrl(), {
      headers: githubHeaders(true)
    });

    state.canEdit = response.ok;
  } catch (error) {
    console.error('No se pudo validar el token:', error);
    state.canEdit = false;
  }
  setReadOnlyUI(!state.canEdit);
  updateBodyPermissionClass();
}

function setReadOnlyUI(readOnly) {
  el.syncBadge.classList.remove('hidden');
  el.syncBadge.textContent = readOnly ? 'Solo lectura' : 'Edicion activada';
  el.addBtn.classList.toggle('hidden', readOnly);
}

function applyFilter() {
  const query = state.query || '';

  // inicial: copia completa
  state.filteredItems = state.items.slice();

  // búsqueda por texto -> SOLO por nombre
  if (query) {
    state.filteredItems = state.filteredItems.filter(function (item) {
      return (item.name || '').toLowerCase().indexOf(query) !== -1;
    });
  }

  // filtro por categoría: input libre (coincidencia parcial, case-insensitive)
  if (el.categoryFilter && el.categoryFilter.value && el.categoryFilter.value.trim() !== '') {
    const catQuery = el.categoryFilter.value.trim().toLowerCase();
    state.filteredItems = state.filteredItems.filter(function (item) {
      return (item.category || '').toLowerCase().indexOf(catQuery) !== -1;
    });
  }

  // orden
  const sortVal = el.sortSelect ? el.sortSelect.value : 'newest';
  if (sortVal === 'name-asc') {
    state.filteredItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sortVal === 'name-desc') {
    state.filteredItems.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
  } else if (sortVal === 'category-asc') {
    state.filteredItems.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
  } else if (sortVal === 'category-desc') {
    state.filteredItems.sort((a, b) => (b.category || '').localeCompare(a.category || ''));
  } else if (sortVal === 'location-asc') {
    state.filteredItems.sort((a, b) => (a.location || '').localeCompare(b.location || ''));
  } else if (sortVal === 'newest') {
    // items are unshifted on add, so keep current order (newest first)
  }

  renderItems();
}

function renderItems() {
  el.cardsContainer.innerHTML = '';
  el.statsText.textContent =
    state.filteredItems.length +
    ' objeto' +
    (state.filteredItems.length === 1 ? '' : 's');

  el.emptyState.classList.toggle('hidden', state.filteredItems.length !== 0);

  state.filteredItems.forEach(function (item) {
    const article = document.createElement('article');
    article.className = 'item-card';

    article.innerHTML =
      '<div class="item-header">' +
        '<div>' +
          '<h3 class="item-title"></h3>' +
          '<span class="item-category"></span>' +
        '</div>' +
      '</div>' +
      '<p class="item-location"></p>' +
      '<p class="item-notes"></p>' +
      '<div class="item-actions"></div>';

    article.querySelector('.item-title').textContent = item.name || '';
    article.querySelector('.item-category').textContent = item.category || '';
    article.querySelector('.item-location').textContent = item.location || 'Sin ubicacion';
    article.querySelector('.item-notes').textContent = item.notes || 'Sin notas';

    const actions = article.querySelector('.item-actions');

    if (state.canEdit) {
      const editBtn = document.createElement('button');
      editBtn.className = 'mini-btn';
      editBtn.textContent = 'Editar';
      editBtn.addEventListener('click', function () {
        openModal(item);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'mini-btn danger';
      deleteBtn.textContent = 'Eliminar';
      deleteBtn.addEventListener('click', function () {
        deleteItem(item.id);
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
    } else {
      const info = document.createElement('span');
      info.className = 'badge';
      info.textContent = 'Lectura publica';
      actions.appendChild(info);
    }

    el.cardsContainer.appendChild(article);
  });
}

function openModal(item) {
  el.itemForm.reset();

  if (item) {
    el.modalTitle.textContent = 'Editar objeto';
    el.itemId.value = item.id || '';
    el.nameInput.value = item.name || '';
    el.categoryInput.value = item.category || '';
    el.locationInput.value = item.location || '';
    el.notesInput.value = item.notes || '';
  } else {
    el.modalTitle.textContent = 'Anadir objeto';
    el.itemId.value = '';
  }

  el.modal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  setTimeout(function () {
    el.nameInput.focus();
  }, 20);
}

function closeModal() {
  el.modal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

async function saveFromForm() {
  const item = {
    id: el.itemId.value || createId(),
    name: el.nameInput.value.trim(),
    category: el.categoryInput.value.trim(),
    location: el.locationInput.value.trim(),
    notes: el.notesInput.value.trim()
  };

  const existingIndex = state.items.findIndex(function (entry) {
    return entry.id === item.id;
  });

  if (existingIndex >= 0) {
    state.items[existingIndex] = item;
  } else {
    state.items.unshift(item);
  }

  const ok = await pushToGitHub('Actualizar inventario');

  if (ok) {
    populateCategoryFilter();
    applyFilter();
    closeModal();
  } else {
    await loadFromGitHub();
    applyFilter();
  }
}

async function deleteItem(id) {
  const confirmed = window.confirm('Seguro que quieres eliminar este objeto?');
  if (!confirmed) return;

  state.items = state.items.filter(function (item) {
    return item.id !== id;
  });

  const ok = await pushToGitHub('Eliminar objeto del inventario');

  if (ok) {
    populateCategoryFilter();
    applyFilter();
  } else {
    await loadFromGitHub();
    applyFilter();
  }
}

async function pushToGitHub(message) {
  try {
    const body = {
      message: message,
      branch: BRANCH,
      sha: state.sha,
      content: encodeBase64Utf8(JSON.stringify(state.items, null, 2))
    };

    const response = await fetch(apiUrl(), {
      method: 'PUT',
      headers: githubHeaders(true),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || 'No se pudo guardar en GitHub');
    }

    const result = await response.json();
    state.sha = result.content.sha;
    return true;
  } catch (error) {
    console.error('Error al guardar en GitHub:', error);
    window.alert('No se pudo guardar en GitHub. Revisa el token y OWNER / REPO / BRANCH.');
    return false;
  }
}

function apiUrl() {
  return 'https://api.github.com/repos/' +
    OWNER + '/' +
    REPO + '/contents/' +
    PATH + '?ref=' +
    encodeURIComponent(BRANCH);
}

function githubHeaders(withAuth) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  if (withAuth && state.token) {
    headers.Authorization = 'Bearer ' + state.token;
  }

  return headers;
}

function createId() {
  return 'item-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

function encodeBase64Utf8(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function decodeBase64Utf8(base64Text) {
  return decodeURIComponent(escape(atob(base64Text.replace(/\n/g, ''))));
}
