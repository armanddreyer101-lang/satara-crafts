// ==================== Imports ====================
import { app, db, storage } from '../firebase/firebase.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import {
  collection, addDoc, serverTimestamp, query, orderBy, getDocs, where,
  doc, updateDoc, deleteDoc, runTransaction, setDoc, getDoc
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import {
  getDownloadURL, ref as storageRef, uploadBytes, deleteObject, listAll
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js';

// ==================== Setup / Helpers ====================
const auth = getAuth(app);

const $  = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
const currency = (n) => `R${Number(n||0).toFixed(0)}`;
const slugify = (s='') => s.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const by = (k) => (a,b) => (a[k]||'').localeCompare(b[k]||'');

// ==================== DOM ====================
const signInSec   = $('#signIn');
const appSec      = $('#adminApp');
const whoEl       = $('#who');
const loginForm   = $('#loginForm');
const logoutBtn   = $('#logout');

const catForm     = $('#catForm');
const catName     = $('#catName');
const catSlug     = $('#catSlug');
const catsTblBody = () => $('#catsTbl tbody');
const fromCat     = $('#fromCat');
const toCat       = $('#toCat');

const prodForm    = $('#productForm');
const prodCatSel  = $('#prodCat');
const productsTbl = () => $('#productsTbl tbody');

const editModal   = $('#editModal');
const editClose   = $('#editClose');
const editForm    = $('#editForm');
const editCatSel  = $('#editCat');
const editAddImages = $('#editAddImages');
const editImagesGrid = $('#editImages');
const editSaveBtn = $('#editSave');
const editDeleteBtn = $('#editDelete');

// Orders
const ordersTblBody = () => $('#ordersTbl tbody');
const archivedTblBody = () => $('#archivedTbl tbody');
const orderModal = $('#orderModal');
const omTitle = $('#omTitle');
const omBody  = $('#omBody');
const omClose = $('#omClose');
const omArchiveToggle = $('#omArchiveToggle');

function openOrderModal()  { orderModal.classList.add('open');  orderModal.setAttribute('aria-hidden','false'); }
function closeOrderModal() { orderModal.classList.remove('open'); orderModal.setAttribute('aria-hidden','true'); }
omClose.addEventListener('click', closeOrderModal);
orderModal.addEventListener('click', (e) => { if (e.target === orderModal) closeOrderModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && orderModal.classList.contains('open')) closeOrderModal();
});

// ==================== Defaults ====================
const DEFAULT_CATS = [
  { name: 'Fatladies',             slug: 'fatladies' },
  { name: 'Gin Glasses',           slug: 'gin-glasses' },
  { name: 'Wine Glasses',          slug: 'wine-glasses' },
  { name: 'Frida Kahlo Glasses',   slug: 'frida-kahlo' },
  { name: 'Printed Gifts',         slug: 'printed-gifts' },
  { name: 'Coffee Collection',     slug: 'coffee' },
  { name: 'Kitchen Gifts',         slug: 'kitchen-gifts' },
  { name: 'Artisan Hats',          slug: 'hats' },
  { name: 'Luxury Gift Sets',      slug: 'gift-sets' },
];

// ==================== Modal ====================
function openModal()  { editModal.classList.add('open');  editModal.setAttribute('aria-hidden','false'); }
function closeModal() { editModal.classList.remove('open');editModal.setAttribute('aria-hidden','true');  }

// ==================== Auth State ====================
onAuthStateChanged(auth, async (user) => {
  signInSec.classList.toggle('hide', !!user);
  appSec.classList.toggle('hide', !user);
  if (!user) return;

  whoEl.textContent = user.email || user.uid;

  await ensureDefaultCategories();
  await loadCategories();
  await loadProducts();
  await loadOrders();            // <-- load orders after sign-in
  await loadArchivedOrders();   // <--- add this
});

// ==================== Sign in/out ====================
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  await signInWithEmailAndPassword(auth, f.get('email'), f.get('password'));
});
logoutBtn?.addEventListener('click', () => signOut(auth));

// ==================== Categories ====================
catName.addEventListener('input', () => catSlug.value = slugify(catName.value));

catForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = catName.value.trim();
  const slug = slugify(catSlug.value);
  if (!name || !slug) return;
  if (slug === 'all') return alert('“All Creations” is automatic and not a real category.');
  const catDoc = doc(db, 'categories', slug);
  await setDoc(catDoc, { name, slug, createdAt: serverTimestamp() }, { merge: true });
  e.target.reset();
  await loadCategories();
  fillCatSelects();
});

$('#reassignForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const from = fromCat.value; const to = toCat.value;
  if (!from || !to || from === to) return;
  const q = query(collection(db, 'products'), where('category','==',from));
  const snap = await getDocs(q);
  for (const d of snap.docs) await updateDoc(doc(db, 'products', d.id), { category: to });
  await Promise.all([loadCategories(), loadProducts()]);
  alert(`Moved ${snap.size} product(s) from "${from}" to "${to}".`);
});

async function ensureDefaultCategories() {
  const snap = await getDocs(collection(db, 'categories'));
  if (snap.size) return;
  for (const c of DEFAULT_CATS) {
    await setDoc(doc(db, 'categories', c.slug), { ...c, createdAt: serverTimestamp() }, { merge: true });
  }
}

async function loadCategories() {
  const snap = await getDocs(collection(db, 'categories'));
  const cats = snap.docs.map(d => d.data()).sort(by('name'));
  if (!cats.length) {
    catsTblBody().innerHTML = `<tr><td colspan="4" class="muted">No categories.</td></tr>`;
  } else {
    const counts = await countProductsByCategory();
    catsTblBody().innerHTML = cats.map(c => `
      <tr data-slug="${c.slug}">
        <td>${c.name}</td>
        <td class="muted">${c.slug}</td>
        <td>${counts[c.slug] || 0}</td>
        <td class="stack">
          <button class="btn-outline cat-del">Delete</button>
        </td>
      </tr>
    `).join('');
    $$('.cat-del', catsTblBody()).forEach(btn => btn.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr');
      const slug = tr.dataset.slug;
      const num = Number(tr.children[2].textContent || '0');
      if (num > 0) return alert(`This category has ${num} product(s). Reassign them first.`);
      if (!confirm('Delete this category?')) return;
      await deleteDoc(doc(db, 'categories', slug));
      tr.remove();
      fillCatSelects();
    }));
  }
  fillCatSelects();
}

async function countProductsByCategory() {
  const snap = await getDocs(collection(db, 'products'));
  const res = {};
  snap.forEach(d => { const s = (d.data().category||'').trim(); res[s] = (res[s]||0)+1; });
  return res;
}

function fillCatSelects() {
  const doFill = async (sel) => {
    const snap = await getDocs(collection(db, 'categories'));
    const cats = snap.docs.map(d => d.data()).sort(by('name'));
    sel.innerHTML = cats.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
  };
  doFill(prodCatSel);
  doFill(editCatSel);
  doFill(fromCat).then(()=>doFill(toCat));
}

// ==================== Product Code Counter ====================
async function getNextProductCode() {
  const ref = doc(db, 'counters', 'products');
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? (snap.data().next || 1000) : 1000;
    const updated = current + 1;
    tx.set(ref, { next: updated });
    return String(updated);
  });
}

// ==================== Add Product ====================
prodForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const name = String(f.get('name')||'').trim();
  const category = String(f.get('category')||'').trim();
  const price = Number(f.get('price')||0);
  const desc = String(f.get('desc')||'').trim();
  const active = $('#addActive').checked;
  const files = $('#images').files;
  const stock = Number(f.get('stock')||0);
  const material = String(f.get('material')||'').trim().toLowerCase();
  const care = String(f.get('care')||'').trim();
  const limited = document.getElementById('addLimited').checked;
  const draft = document.getElementById('addDraft').checked;
  const publishAtInput = document.getElementById('addPublishAt').value;
  const publishAt = publishAtInput ? new Date(publishAtInput) : null;
  let variations = [];
  try { const raw = f.get('variations'); if (raw) variations = JSON.parse(raw); } catch { variations = []; }

  if (!name || !category || !files.length) return;

  const code = await getNextProductCode();
  const docRef = await addDoc(collection(db, 'products'), {
    code, name, category, price, desc, active,
    images: [], createdAt: serverTimestamp(),
    stock, material, care, limited, draft,
    publishAt: publishAt || null,
    variations
  });

  const uploaded = [];
  for (const file of files) {
    const path = `product-images/${auth.currentUser.uid}/${docRef.id}/${Date.now()}-${file.name}`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, file);
    const url = await getDownloadURL(ref);
    uploaded.push({ url, storagePath: path, name: file.name.replace(/\.[^.]+$/,'') });
  }
  if (uploaded.length) await updateDoc(docRef, { images: uploaded });

  e.target.reset();
  await loadProducts();
});

// ==================== List / Toggle / Edit / Delete Products ====================
async function loadProducts() {
  const q = query(collection(db, 'products'), orderBy('createdAt','desc'));
  const snap = await getDocs(q);
  if (!snap.size) {
    productsTbl().innerHTML = `<tr><td colspan="7" class="muted">No products yet.</td></tr>`;
    return;
  }
  productsTbl().innerHTML = snap.docs.map(d => {
    const p = d.data();
    const img = (Array.isArray(p.images) && p.images[0]?.url) || p.img || '';
    return `
      <tr data-id="${d.id}">
        <td>${img ? `<img src="${img}" alt="" class="thumb">` : ''}</td>
        <td>${p.name || ''}</td>
        <td class="muted">${p.code || ''}</td>
        <td class="muted">${p.category || ''}</td>
        <td>${currency(p.price)} ${p.limited ? '<span class="pill" style="border-color:#8e44ad;color:#8e44ad;margin-left:6px">Limited</span>' : ''}</td>
        <td><input type="checkbox" class="toggle" ${p.active ? 'checked' : ''}></td>
        <td class="stack">
          <button class="btn-outline edit">Edit</button>
          <button class="btn-outline del">Delete</button>
        </td>
      </tr>`;
  }).join('');

  $$('.toggle', productsTbl()).forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const tr = e.target.closest('tr');
      await updateDoc(doc(db, 'products', tr.dataset.id), { active: e.target.checked });
    });
  });

  $$('.del', productsTbl()).forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr');
      if (!confirm('Delete this product?')) return;
      const id = tr.dataset.id;
      await deleteAllProductImages(id);
      await deleteDoc(doc(db, 'products', id));
      tr.remove();
    });
  });

  $$('.edit', productsTbl()).forEach(btn => btn.addEventListener('click', (e) => {
    const tr = e.target.closest('tr');
    openEditor(tr.dataset.id);
  }));
}

async function deleteAllProductImages(productId) {
  const refDoc = doc(db, 'products', productId);
  const snap = await getDoc(refDoc);
  const p = snap.data() || {};
  if (Array.isArray(p.images)) {
    for (const it of p.images) {
      if (it.storagePath) { try { await deleteObject(storageRef(storage, it.storagePath)); } catch{} }
    }
  }
  // Best-effort cleanup of any leftovers inside the product folder
  const folder = storageRef(storage, `product-images/${auth.currentUser.uid}/${productId}`);
  try {
    const all = await listAll(folder);
    for (const itemRef of all.items) { try { await deleteObject(itemRef); } catch{} }
  } catch {}
}

// ==================== Editor ====================
editClose.addEventListener('click', closeModal);

async function openEditor(id) {
  const ref = doc(db, 'products', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const p = snap.data();
  $('#editTitle').textContent = p.name ? `Edit product — ${p.name}` : 'Edit product';
  editForm.elements.id.value = id;
  editForm.elements.code.value = p.code || '';
  editForm.elements.name.value = p.name || '';
  editForm.elements.price.value = Number(p.price||0);
  editForm.elements.stock.value = Number(p.stock||0);
  editForm.elements.desc.value = p.desc || '';
  await fillCatSelects();
  editCatSel.value = p.category || '';
  editForm.elements.active.checked = !!p.active;
  editForm.elements.material.value = p.material || '';
  editForm.elements.care.value = p.care || '';
  editForm.elements.limited.checked = !!p.limited;
  editForm.elements.draft.checked = !!p.draft;
  const pubEl = editForm.querySelector('[name="publishAt"]');
  if (pubEl) {
    const dt = p.publishAt?.toDate ? p.publishAt.toDate() : null;
    pubEl.value = dt ? new Date(dt.getTime() - dt.getTimezoneOffset()*60000).toISOString().slice(0,16) : '';
  }
  editForm.elements.variations.value = JSON.stringify(p.variations || [], null, 2);
  renderEditImages(p.images || []);
  openModal();
}

function renderEditImages(images) {
  editImagesGrid.innerHTML = (images.length ? images : []).map((it, idx) => `
    <div class="imgbox" data-index="${idx}">
      <img src="${it.url}" alt="">
      <div class="field" style="margin-top:8px">
        <label>Image name</label>
        <input class="img-name" value="${it.name || ''}" placeholder="e.g. Blue front">
      </div>
      <div class="stack" style="margin-top:8px">
        <a href="${it.url}" target="_blank" class="btn-outline">Open</a>
        <button class="btn-outline img-del">Remove</button>
      </div>
    </div>
  `).join('') || `<div class="muted">No images yet.</div>`;

  $$('.img-name', editImagesGrid).forEach(inp => {
    inp.addEventListener('change', async (e) => {
      const box = e.target.closest('.imgbox');
      const idx = Number(box.dataset.index);
      await saveImageName(idx, e.target.value);
    });
  });
  $$('.img-del', editImagesGrid).forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const box = e.target.closest('.imgbox');
      const idx = Number(box.dataset.index);
      if (!confirm('Remove this image?')) return;
      await removeImage(idx);
    });
  });
}

editAddImages.addEventListener('change', async (e) => {
  const id = editForm.elements.id.value;
  if (!id) return;
  const files = e.target.files;
  if (!files?.length) return;
  const refDoc = doc(db, 'products', id);
  const snap = await getDoc(refDoc);
  const p = snap.data() || {};
  const list = Array.isArray(p.images) ? p.images.slice() : [];
  for (const file of files) {
    const path = `product-images/${auth.currentUser.uid}/${id}/${Date.now()}-${file.name}`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, file);
    const url = await getDownloadURL(ref);
    list.push({ url, storagePath: path, name: file.name.replace(/\.[^.]+$/,'') });
  }
  await updateDoc(refDoc, { images: list });
  renderEditImages(list);
  editAddImages.value = '';
});

async function saveImageName(index, name) {
  const id = editForm.elements.id.value;
  const refDoc = doc(db, 'products', id);
  const snap = await getDoc(refDoc);
  const p = snap.data() || {};
  const list = Array.isArray(p.images) ? p.images.slice() : [];
  if (!list[index]) return;
  list[index].name = name.trim();
  await updateDoc(refDoc, { images: list });
}

async function removeImage(index) {
  const id = editForm.elements.id.value;
  const refDoc = doc(db, 'products', id);
  const snap = await getDoc(refDoc);
  const p = snap.data() || {};
  const list = Array.isArray(p.images) ? p.images.slice() : [];
  const it = list[index];
  if (!it) return;
  if (it.storagePath) { try { await deleteObject(storageRef(storage, it.storagePath)); } catch{} }
  list.splice(index,1);
  await updateDoc(refDoc, { images: list });
  renderEditImages(list);
}

editSaveBtn.addEventListener('click', async () => {
  const id = editForm.elements.id.value;
  if (!id) return;

  const refDoc = doc(db, 'products', id);

  const updates = {
    name: editForm.elements.name.value.trim(),
    category: editCatSel.value,
    price: Number(editForm.elements.price.value || 0),
    desc: editForm.elements.desc.value.trim(),
    active: editForm.elements.active.checked,
    stock: Number(editForm.elements.stock.value || 0),
    material: String(editForm.elements.material.value || '').trim().toLowerCase(),
    care: String(editForm.elements.care.value || '').trim(),
    limited: !!editForm.elements.limited.checked,
    draft: !!editForm.elements.draft.checked,
    variations: (() => { 
      try { return JSON.parse(editForm.elements.variations.value || '[]'); } 
      catch { return []; } 
    })()
  };

  // publishAt: convert from local <input type="datetime-local"> back to UTC
  const pubEl = editForm.querySelector('[name="publishAt"]');
  if (pubEl && pubEl.value) {
    const local = new Date(pubEl.value);
    updates.publishAt = new Date(local.getTime() + local.getTimezoneOffset() * 60000);
  } else {
    updates.publishAt = null;
  }

  // WRITE to Firestore
  await updateDoc(refDoc, updates);

  // Refresh table and close modal so the change is visible immediately
  await loadProducts();
  closeModal();
});

editDeleteBtn.addEventListener('click', async () => {
  const id = editForm.elements.id.value;
  if (!id) return;
  if (!confirm('Delete this product?')) return;
  await deleteAllProductImages(id);
  await deleteDoc(doc(db, 'products', id));
  await loadProducts();
  closeModal();
});

// ==================== Orders ====================

// Active orders
async function loadOrders() {
  const snap = await getDocs(query(collection(db,'orders'), orderBy('createdAt','desc')));
  const docs = snap.docs.filter(d => !d.data()?.archived);
  if (!docs.length) {
    ordersTblBody().innerHTML = `<tr><td colspan="7" class="muted">No active orders.</td></tr>`;
  } else {
    renderOrders(ordersTblBody(), docs, { archived:false });
  }
}

// Archived orders
async function loadArchivedOrders() {
  const snap = await getDocs(query(collection(db,'orders'), orderBy('createdAt','desc')));
  const docs = snap.docs.filter(d => !!d.data()?.archived);
  if (!docs.length) {
    archivedTblBody().innerHTML = `<tr><td colspan="7" class="muted">No archived orders.</td></tr>`;
  } else {
    renderOrders(archivedTblBody(), docs, { archived:true });
  }
}

function renderOrders(tbodyEl, docList, { archived }) {
  tbodyEl.innerHTML = docList.map(d => {
    const o = d.data();
    const when = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString() : '';

    // ✅ Items with variants inline
    const itemsTxt = (o.items||[]).map(i => {
      let line = `${i.name} ×${i.qty}`;
      if (i.variant && Array.isArray(i.variant) && i.variant.length) {
        line += `<div class="muted" style="font-size:.85rem;margin-left:4px">
          ${i.variant.map(v=>`${v.label||''}: ${v.value}`).join(', ')}
        </div>`;
      }
      return `<div>${line}</div>`;
    }).join('');

    return `<tr data-id="${d.id}">
      <td>${when}</td>
      <td>${o.customer?.fullName || ''}
        <div class="muted">${o.customer?.email||''} · ${o.customer?.phone||''}</div>
      </td>
      <td class="muted">${itemsTxt}</td>
      <td>${currency(o.totals?.amount || 0)}</td>
      <td>
        <select class="ord-status">
          ${['new','paid','packed','shipped','delivered','cancelled']
            .map(s=>`<option ${o.status===s?'selected':''} value="${s}">${s}</option>`).join('')}
        </select>
      </td>
      <td><input class="ord-track" value="${o.tracking||''}" placeholder="Tracking #"></td>
      <td class="stack">
        <button class="btn-outline ord-view">View</button>
        ${archived
          ? `<button class="btn-outline ord-restore">Restore</button>`
          : `<button class="btn-outline ord-save">Save</button>
             <button class="btn-outline ord-archive">Archive</button>`}
      </td>
    </tr>`;
  }).join('');

  // ====== View order modal ======
  $$('.ord-view', tbodyEl).forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr');
      const id = tr?.dataset?.id;
      if (!id) return;
      const snap = await getDoc(doc(db,'orders', id));
      if (!snap.exists()) return;
      const o = snap.data();

      omTitle.textContent = `Order — ${o.customer?.fullName || id}`;

      const items = (o.items||[]).map(i => {
        const img = i.img || i.image?.url || '';
        const varTxt = (i.variant && Array.isArray(i.variant) && i.variant.length)
          ? `<div class="muted">Variant: ${i.variant.map(v=>`${v.label||''}: ${v.value}`).join(', ')}</div>`
          : '';
        return `
          <div style="display:flex;gap:12px;align-items:flex-start;margin:8px 0;">
            ${img ? `<img src="${img}" alt="" class="thumb" style="width:56px;height:56px;">` : ''}
            <div>
              <div><strong>${i.name||''}</strong></div>
              <div class="muted">Qty ${i.qty||1} · ${currency(i.price||0)} each</div>
              ${varTxt}
            </div>
          </div>`;
      }).join('') || '<div class="muted">No items</div>';

      const cust = o.customer||{};
      const notes = o.notes || '';

      omBody.innerHTML = `
        <div class="grid" style="grid-template-columns:1fr 1fr;">
          <div>
            <h4 style="margin:0 0 6px 0;">Customer</h4>
            <div>${cust.fullName||''}</div>
            <div class="muted">${cust.email||''} · ${cust.phone||''}</div>
            ${notes ? `<div style="margin-top:8px"><strong>Notes:</strong> ${notes}</div>` : ''}
          </div>
          <div>
            <h4 style="margin:0 0 6px 0;">Totals</h4>
            <div>Amount: <strong>${currency(o.totals?.amount||0)}</strong></div>
            ${o.giftWrap ? `<div class="muted">Gift wrap requested</div>` : ''}
          </div>
        </div>
        <div class="section">
          <h4 style="margin:0 0 6px 0;">Products</h4>
          ${items}
        </div>
      `;

      omArchiveToggle.textContent = (o.archived ? 'Restore' : 'Archive');
      omArchiveToggle.onclick = async () => {
        await updateDoc(doc(db,'orders', id), o.archived
          ? { archived:false }
          : { archived:true, archivedAt: serverTimestamp() });
        closeOrderModal();
        await Promise.all([loadOrders(), loadArchivedOrders()]);
      };

      openOrderModal();
    });
  });

  // ====== Save (active orders) ======
  $$('.ord-save', tbodyEl).forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr');
      const id = tr?.dataset?.id;
      if (!id) return;
      const status = tr.querySelector('.ord-status')?.value || '';
      const tracking = tr.querySelector('.ord-track')?.value.trim() || '';
      const payload = { status, tracking };
      if (status === 'delivered') payload.fulfilledAt = serverTimestamp();
      await updateDoc(doc(db, 'orders', id), payload);
      alert('Saved');
    });
  });

  // ====== Archive (active) ======
  $$('.ord-archive', tbodyEl).forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr');
      const id = tr?.dataset?.id;
      if (!id) return;
      if (!confirm('Archive this order?')) return;
      await updateDoc(doc(db, 'orders', id), { archived:true, archivedAt: serverTimestamp() });
      tr.remove();
      await loadArchivedOrders();
    });
  });

  // ====== Restore (archived) ======
  $$('.ord-restore', tbodyEl).forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr');
      const id = tr?.dataset?.id;
      if (!id) return;
      await updateDoc(doc(db, 'orders', id), { archived:false });
      tr.remove();
      await loadOrders();
    });
  });
}

// ==== Tabs for Orders / Archived ====
const tabActive = document.getElementById('tabActive');
const tabArchived = document.getElementById('tabArchived');
const ordersTblEl = document.getElementById('ordersTbl');
const archivedTblEl = document.getElementById('archivedTbl');

tabActive?.addEventListener('click', () => {
  tabActive.classList.add('active');
  tabArchived.classList.remove('active');
  ordersTblEl.classList.remove('hide');
  archivedTblEl.classList.add('hide');
});

tabArchived?.addEventListener('click', () => {
  tabArchived.classList.add('active');
  tabActive.classList.remove('active');
  archivedTblEl.classList.remove('hide');
  ordersTblEl.classList.add('hide');
});

// Close when clicking the backdrop
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeModal();
});

// Close on ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && editModal.classList.contains('open')) closeModal();
});
