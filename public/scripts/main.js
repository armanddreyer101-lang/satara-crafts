// ==================== PocketBase Config ====================
const PB_URL = 'https://satara-crafts.pockethost.io';

// ==================== State ====================
let items    = [];
let itemById = {};

const CATEGORIES = [
  { name: 'All Creations',      slug: 'all' },
  { name: 'Fatladies',          slug: 'fatladies' },
  { name: 'Gin Glasses',        slug: 'gin-glasses' },
  { name: 'Wine Glasses',       slug: 'wine-glasses' },
  { name: 'Frida Kahlo',        slug: 'frida-kahlo' },
  { name: 'Printed Gifts',      slug: 'printed-gifts' },
  { name: 'Coffee Collection',  slug: 'coffee' },
  { name: 'Kitchen Gifts',      slug: 'kitchen-gifts' },
  { name: 'Artisan Hats',       slug: 'hats' },
  { name: 'Luxury Gift Sets',   slug: 'gift-sets' }
];

// ==================== Helpers ====================
const currency    = (n) => 'R ' + Number(n || 0).toFixed(0);
const formatPrice = (p) => currency(p);
const parsePrice  = (s) => Number(String(s || '').replace(/[^\d.]/g, '')) || 0;
const cartTotal   = () => cart.reduce((s, i) => s + parsePrice(i.price) * (i.qty || 1), 0);

function imageUrl(record, filename) {
  if (!filename) return '';
  return `${PB_URL}/api/files/${record.collectionId}/${record.id}/${filename}`;
}

function getPrimaryImage(item) {
  if (Array.isArray(item.images) && item.images.length) {
    return imageUrl(item, item.images[0]);
  }
  return '';
}

// ==================== Filters ====================
const ui = {
  q: '', min: null, max: null,
  material: '', sort: 'name',
  chip: null, newIn: false,
  limited: false, category: 'all'
};
let page = 0;
const pageSize = 20;
let currentList = [];
let observer;

// ==================== Load Products ====================
async function loadItems() {
  const grid = document.getElementById('gallery-grid');
  if (grid) grid.innerHTML = `<div class="loading-state">
    <div class="loading-spinner"></div>
    <p>Loading beautiful things…</p>
  </div>`;

  try {
    const res = await fetch(
      `${PB_URL}/api/collections/products/records?perPage=200&filter=active=true`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    const data = await res.json();
    items    = (data.items || []);
    itemById = Object.fromEntries(items.map(i => [i.id, i]));
  } catch (err) {
    console.error('Failed to load products:', err);
    items    = [];
    itemById = {};
  }

  if (document.getElementById('gallery-grid')) renderGallery('all');
}

// ==================== Sidebar ====================
function renderCategorySidebar() {
  const ul = document.getElementById('category-list');
  if (!ul) return;
  ul.innerHTML = CATEGORIES.map((c, idx) => `
    <li data-category="${c.slug}" class="${idx === 0 ? 'active' : ''}">
      <span>${c.name}</span>
      <i class="fas fa-chevron-right"></i>
    </li>`).join('');
  ul.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
      ul.querySelectorAll('li').forEach(n => n.classList.remove('active'));
      li.classList.add('active');
      renderGallery(li.dataset.category);
    });
  });
}

// ==================== Gallery ====================
function renderGallery(filter) {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  ui.category = filter || 'all';

  let list = ui.category === 'all'
    ? items.slice()
    : items.filter(i => i.category === ui.category);

  if (ui.chip === 'under-300') list = list.filter(p => parsePrice(p.price) < 300);
  if (ui.chip === '300-600')   list = list.filter(p => { const r = parsePrice(p.price); return r >= 300 && r <= 600; });
  if (ui.chip === 'over-600')  list = list.filter(p => parsePrice(p.price) > 600);
  if (ui.limited)              list = list.filter(p => !!p.limited);
  if (ui.material)             list = list.filter(p => (p.material||'').toLowerCase() === ui.material);

  if (ui.q) {
    const q = ui.q.toLowerCase();
    list = list.filter(p => [p.name, p.desc, p.material, p.category].join(' ').toLowerCase().includes(q));
  }
  if (ui.min != null) list = list.filter(p => parsePrice(p.price) >= ui.min);
  if (ui.max != null) list = list.filter(p => parsePrice(p.price) <= ui.max);

  if (ui.sort === 'price-asc')  list.sort((a,b) => parsePrice(a.price) - parsePrice(b.price));
  if (ui.sort === 'price-desc') list.sort((a,b) => parsePrice(b.price) - parsePrice(a.price));
  if (ui.sort === 'name')       list.sort((a,b) => (a.name||'').localeCompare(b.name||''));

  currentList = list.slice();
  page = 0;
  grid.innerHTML = '';

  if (!currentList.length) {
    grid.innerHTML = `<div class="empty-state">
      <i class="fas fa-paint-brush"></i>
      <p>No products found in this category yet.</p>
      <p style="font-size:.9rem;opacity:.7">Check back soon — more beautiful pieces are on the way!</p>
    </div>`;
    return;
  }

  appendNextPage();
  setupInfinite();
}

function productCardHTML(item) {
  const img      = getPrimaryImage(item);
  const price    = currency(item.price);
  const ribbon   = item.stock && item.stock <= 3
    ? `<div class="stock-ribbon">Only ${item.stock} left</div>` : '';
  const limited  = item.limited ? ' data-badge="Limited"' : '';
  const wished   = wishlist.has(item.id) ? ' wished' : '';

  return `
    <div class="gallery-item" data-id="${item.id}"${limited}>
      ${ribbon}
      <button class="wish-btn${wished}" aria-label="Add to wishlist">♥</button>
      ${img ? `<img src="${img}" alt="${item.name}" loading="lazy">` : `<div class="no-image"><i class="fas fa-image"></i></div>`}
      <div class="item-info">
        <h3>${item.name || ''}</h3>
        <p class="item-price">${price}</p>
        ${item.material ? `<p class="item-material">${item.material}</p>` : ''}
        <button class="enquire-btn" data-id="${item.id}">View & Order</button>
      </div>
    </div>`;
}

function appendNextPage() {
  const grid  = document.getElementById('gallery-grid');
  if (!grid) return;
  const slice = currentList.slice(page * pageSize, (page + 1) * pageSize);
  if (!slice.length) return;
  grid.insertAdjacentHTML('beforeend', slice.map(productCardHTML).join(''));
  page++;
}

function setupInfinite() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  let sentinel = grid.querySelector('.sentinel');
  if (!sentinel) {
    sentinel = document.createElement('div');
    sentinel.className = 'sentinel';
    grid.appendChild(sentinel);
  }
  observer?.disconnect();
  observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) appendNextPage();
  }, { rootMargin: '400px' });
  observer.observe(sentinel);
}

// ==================== Cart ====================
let cart     = JSON.parse(localStorage.getItem('satara_cart')     || '[]');
let wishlist = new Set(JSON.parse(localStorage.getItem('satara_wishlist') || '[]'));

function saveCart()     { localStorage.setItem('satara_cart', JSON.stringify(cart)); updateBadge(); }
function saveWishlist() { localStorage.setItem('satara_wishlist', JSON.stringify([...wishlist])); }

function updateBadge() {
  const count = cart.reduce((s, i) => s + (i.qty || 0), 0);
  const el    = document.getElementById('cartCount');
  if (el) el.textContent = String(count);
}

function toggleWish(id, btn) {
  wishlist.has(id) ? wishlist.delete(id) : wishlist.add(id);
  saveWishlist();
  btn.classList.toggle('wished');
}

function addToCart(item, variant = null) {
  if (!item) return;
  const img  = getPrimaryImage(item);
  const key  = item.id + JSON.stringify(variant || {});
  const found = cart.find(ci => ci.key === key);
  if (found) { found.qty += 1; }
  else cart.push({ key, id: item.id, name: item.name, img, price: item.price, qty: 1, variant });
  saveCart();
  renderCart(true);
  showToast(`${item.name} added to basket!`);
}

function removeFromCart(key) {
  cart = cart.filter(i => i.key !== key);
  saveCart();
  renderCart();
}

function changeQty(key, delta) {
  const it = cart.find(i => i.key === key);
  if (!it) return;
  it.qty += delta;
  if (it.qty < 1) removeFromCart(key);
  else { saveCart(); renderCart(); }
}

function renderCart(open = false) {
  const wrap = document.getElementById('cartItems');
  if (!wrap) return;
  if (!cart.length) {
    wrap.innerHTML = `<div class="cart-empty">Your basket is empty.</div>`;
  } else {
    wrap.innerHTML = cart.map(i => `
      <div class="cart-item" data-key="${i.key}">
        ${i.img ? `<img src="${i.img}" alt="${i.name}">` : '<div class="cart-item-placeholder"></div>'}
        <div class="ci-meta">
          <div class="ci-name">${i.name}</div>
          <div class="ci-price">${formatPrice(i.price)}</div>
          ${i.variant ? `<div class="ci-variant">${i.variant.map(v=>v.value).join(', ')}</div>` : ''}
          <div class="qty-controls">
            <button class="qty-btn" data-action="dec" aria-label="Decrease">−</button>
            <span class="qty">${i.qty}</span>
            <button class="qty-btn" data-action="inc" aria-label="Increase">+</button>
          </div>
        </div>
        <button class="remove-item" aria-label="Remove"><i class="fas fa-trash"></i></button>
      </div>`).join('');

    // Total row
    wrap.innerHTML += `<div class="cart-total">
      <span>Total</span>
      <strong>${currency(cartTotal())}</strong>
    </div>`;
  }
  if (open) document.getElementById('cartSidebar')?.classList.add('open');
}

// ==================== Checkout ====================
let pendingOrder = null;

function openCheckout() {
  if (!cart.length) { showToast('Your basket is empty!'); return; }
  const m    = document.getElementById('checkoutModal');
  const list = document.getElementById('coItems');
  if (list) {
    list.innerHTML = cart.map(i => `
      <div class="co-row">
        ${i.img ? `<img src="${i.img}" alt="">` : ''}
        <div class="co-name">${i.name}${i.variant ? `<div style="font-size:.85rem;color:#777">${i.variant.map(v=>v.value).join(', ')}</div>` : ''}</div>
        <div class="co-qty">×${i.qty} — ${currency(parsePrice(i.price) * i.qty)}</div>
      </div>`).join('') +
      `<div class="co-total">Total: <strong>${currency(cartTotal())}</strong></div>`;
  }
  m?.classList.add('active');
}

function closeCheckout() {
  document.getElementById('checkoutModal')?.classList.remove('active');
}

function buildOrderFromForm() {
  const f = document.getElementById('checkoutForm');
  const d = new FormData(f);
  return {
    customer_name:  d.get('fullName'),
    customer_email: d.get('email'),
    customer_phone: d.get('phone'),
    items_json:     cart,
    total:          cartTotal(),
    gift_wrap:      !!document.getElementById('giftWrap')?.checked,
    notes:          d.get('notes') || '',
    status:         'new',
    company_json:   document.getElementById('isCompany')?.checked ? {
      companyName: d.get('companyName'),
      vat:         d.get('vatNumber'),
      reg:         d.get('regNumber'),
      address:     d.get('companyAddress')
    } : null
  };
}

async function submitOrder(order) {
  try {
    const res = await fetch(`${PB_URL}/api/collections/orders/records`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(order)
    });
    if (!res.ok) return null;
    return await res.json(); // includes the new record's id
  } catch (e) {
    console.error('Order save failed:', e);
    return null;
  }
}

// Redirects the browser to PayFast to complete payment for a saved order
async function redirectToPayfast(order, orderId) {
  const res = await fetch('/api/payfast-checkout', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order_id:  orderId,
      amount:    order.total,
      item_name: `Satara Crafts order #${orderId}`,
      name:      order.customer_name,
      email:     order.customer_email
    })
  });
  if (!res.ok) throw new Error('Could not start PayFast checkout');
  const { action, fields } = await res.json();

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  Object.entries(fields).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type  = 'hidden';
    input.name  = key;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

// ==================== Product Modal ====================
const pm = {
  wrap:     null, img: null, name: null,
  code:     null, price: null, desc: null,
  thumbs:   null, add: null, checkout: null,
  prev:     null, next: null, close: null,
  state:    { item: null, index: 0, images: [] }
};

function initPm() {
  pm.wrap     = document.getElementById('productModal');
  pm.img      = document.getElementById('pmImage');
  pm.name     = document.getElementById('pmName');
  pm.code     = document.getElementById('pmCode');
  pm.price    = document.getElementById('pmPrice');
  pm.desc     = document.getElementById('pmDesc');
  pm.thumbs   = document.getElementById('pmThumbs');
  pm.add      = document.getElementById('pmAddToCart');
  pm.checkout = document.getElementById('pmGoToCheckout');
  pm.prev     = document.querySelector('.pm-prev');
  pm.next     = document.querySelector('.pm-next');
  pm.close    = document.getElementById('pmClose');

  pm.add?.addEventListener('click',      () => { if (pm.state.item) addToCart(pm.state.item); });
  pm.checkout?.addEventListener('click', () => { if (pm.state.item) { addToCart(pm.state.item); closeProductModal(); openCheckout(); } });
  pm.prev?.addEventListener('click',     () => pmSetIndex(pm.state.index - 1));
  pm.next?.addEventListener('click',     () => pmSetIndex(pm.state.index + 1));
  pm.close?.addEventListener('click',    closeProductModal);
  pm.wrap?.addEventListener('click',     (e) => { if (e.target === pm.wrap) closeProductModal(); });
  pm.thumbs?.addEventListener('click',   (e) => {
    const b = e.target.closest('.pm-thumb');
    if (b) pmSetIndex(Number(b.dataset.i));
  });
}

function openProductModal(id) {
  const item = itemById[id];
  if (!item || !pm.wrap) return;
  pm.state.item   = item;
  pm.state.images = Array.isArray(item.images) && item.images.length
    ? item.images.map(f => ({ url: imageUrl(item, f), alt: item.name }))
    : [];
  pm.state.index  = 0;

  if (pm.name)  pm.name.textContent  = item.name  || '';
  if (pm.code)  pm.code.textContent  = item.code  || '—';
  if (pm.price) pm.price.textContent = formatPrice(item.price);
  if (pm.desc)  pm.desc.textContent  = item.desc  || '';

  renderPmImage();
  renderPmThumbs();

  pm.wrap.classList.add('active');
  pm.wrap.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  pm.wrap?.classList.remove('active');
  pm.wrap?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function renderPmImage() {
  if (!pm.img) return;
  const cur = pm.state.images[pm.state.index];
  if (cur) { pm.img.src = cur.url; pm.img.alt = cur.alt || ''; }
  else { pm.img.src = ''; }
  const show = pm.state.images.length > 1;
  if (pm.prev) pm.prev.style.display = show ? '' : 'none';
  if (pm.next) pm.next.style.display = show ? '' : 'none';
}

function renderPmThumbs() {
  if (!pm.thumbs) return;
  pm.thumbs.innerHTML = pm.state.images.map((it, i) => `
    <button class="pm-thumb ${i === pm.state.index ? 'active' : ''}" data-i="${i}" aria-label="Image ${i+1}">
      <img src="${it.url}" alt="">
    </button>`).join('');
}

function pmSetIndex(i) {
  const len = pm.state.images.length;
  if (!len) return;
  pm.state.index = (i + len) % len;
  renderPmImage();
  renderPmThumbs();
}

window.openProductModal = openProductModal;

// ==================== Toast ====================
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ==================== WhatsApp ====================
function openWhatsApp(item) {
  const msg = item
    ? `Hi! I'm interested in "${item.name}" (${formatPrice(item.price)}) from Satara Crafts.`
    : `Hi! I saw your Satara Crafts website and would like to enquire about your products.`;
  const url = `https://wa.me/27000000000?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// ==================== Boot ====================
document.addEventListener('DOMContentLoaded', async () => {
  initPm();
  renderCategorySidebar();
  await loadItems();

  // Keyboard nav
  document.addEventListener('keydown', (e) => {
    if (!pm.wrap?.classList.contains('active')) return;
    if (e.key === 'Escape')     closeProductModal();
    if (e.key === 'ArrowLeft')  pmSetIndex(pm.state.index - 1);
    if (e.key === 'ArrowRight') pmSetIndex(pm.state.index + 1);
  });

  // Category sidebar
  document.getElementById('category-list')?.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    document.querySelectorAll('#category-list li').forEach(n => n.classList.remove('active'));
    li.classList.add('active');
    renderGallery(li.dataset.category || 'all');
  });

  // Filters
  const bind = (id, prop, transform) => {
    const el = document.getElementById(id);
    el?.addEventListener('input',  () => { ui[prop] = transform(el.value); renderGallery(ui.category); });
    el?.addEventListener('change', () => { ui[prop] = transform(el.value); renderGallery(ui.category); });
  };
  bind('q',              'q',        v => v.trim().toLowerCase());
  bind('minPrice',       'min',      v => v ? Number(v) : null);
  bind('maxPrice',       'max',      v => v ? Number(v) : null);
  bind('materialFilter', 'material', v => v);
  bind('sortBy',         'sort',     v => v);

  document.querySelectorAll('[data-pricechip]').forEach(b =>
    b.addEventListener('click', () => { ui.chip = b.dataset.pricechip; ui.newIn = false; ui.limited = false; renderGallery(ui.category); })
  );
  document.querySelector('[data-newin]')?.addEventListener('click',   () => { ui.newIn = true;   ui.chip = null; ui.limited = false; renderGallery(ui.category); });
  document.querySelector('[data-limited]')?.addEventListener('click', () => { ui.limited = true; ui.chip = null; ui.newIn = false;   renderGallery(ui.category); });

  // Gallery click delegation
  document.getElementById('gallery-grid')?.addEventListener('click', (e) => {
    const card  = e.target.closest('.gallery-item');
    if (!card) return;
    const id    = card.dataset.id;
    const heart = e.target.closest('.wish-btn');
    if (heart) { toggleWish(id, heart); return; }
    const btn   = e.target.closest('.enquire-btn');
    if (btn || e.target.tagName === 'IMG' || e.target.closest('h3')) openProductModal(id);
  });

  // Cart
  const cartSidebar = document.getElementById('cartSidebar');
  window.openCart  = () => cartSidebar?.classList.add('open');
  window.closeCart = () => cartSidebar?.classList.remove('open');
  document.getElementById('cartOpenBtn')?.addEventListener('click',  openCart);
  document.getElementById('cartClose')?.addEventListener('click',    closeCart);
  document.getElementById('checkoutBtn')?.addEventListener('click',  openCheckout);

  cartSidebar?.addEventListener('click', (e) => {
    const item = e.target.closest('.cart-item');
    const key  = item?.dataset.key;
    if (!key) return;
    const qty  = e.target.closest('.qty-btn');
    if (qty)   { changeQty(key, qty.dataset.action === 'inc' ? 1 : -1); return; }
    if (e.target.closest('.remove-item')) removeFromCart(key);
  });

  // Checkout modal
  document.getElementById('coClose')?.addEventListener('click',  closeCheckout);
  document.getElementById('coCancel')?.addEventListener('click', closeCheckout);
  document.getElementById('checkoutModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'checkoutModal') closeCheckout();
  });

  document.getElementById('checkoutForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const order = buildOrderFromForm();
    const btn   = e.target.querySelector('[type=submit]');
    btn.textContent = 'Sending…';
    btn.disabled    = true;
    const record = await submitOrder(order);
    if (record) {
      btn.textContent = 'Redirecting to payment…';
      try {
        cart = []; saveCart(); renderCart(); closeCheckout();
        await redirectToPayfast(order, record.id);
        return; // page is navigating away, no need to reset the button
      } catch (err) {
        console.error(err);
        showToast('Order saved, but payment could not start. We will contact you.', 5000);
      }
    } else {
      showToast('Something went wrong. Please try WhatsApp or email.', 4000);
    }
    btn.textContent = 'Submit Order';
    btn.disabled    = false;
  });

  // Company fields toggle
  const isCompany     = document.getElementById('isCompany');
  const companyFields = document.getElementById('companyFields');
  isCompany?.addEventListener('change', () => {
    if (companyFields) companyFields.style.display = isCompany.checked ? 'block' : 'none';
  });

  // Shipping ack
  const ack      = document.getElementById('ackShipping');
  const coProceed = document.getElementById('coProceed');
  if (ack && coProceed) {
    coProceed.disabled = true;
    ack.addEventListener('change', () => { coProceed.disabled = !ack.checked; });
  }

  renderCart(false);
  updateBadge();
});
