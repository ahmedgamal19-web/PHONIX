// script.js (Firestore Edition)
// يعتمد على auth.js الذي يعرف db = firebase.firestore() و auth

// ---------- helpers ----------
function escapeHtml(t) { return String(t).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); }

function placeholderImageSvg(w, h, text) {
  return "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='#0b1220'/><text x='50%' y='50%' fill='#9aa6b2' font-size='18' text-anchor='middle' dominant-baseline='middle'>${text}</text></svg>`);
}

// ---------- global products cache (لتجنب async في كل مرة) ----------
let _productsCache = [];

async function loadProductsFromFirestore() {
  const snap = await db.collection('products').get();
  _productsCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return _productsCache;
}

function getProducts() {
  return _productsCache;
}

// ---------- cart (localStorage) ----------
const LS_CART_KEY = "mf_cart_v2";
function getCart() { return JSON.parse(localStorage.getItem(LS_CART_KEY) || '[]'); }
function setCart(arr) { localStorage.setItem(LS_CART_KEY, JSON.stringify(arr)); updateCartCountHeader(); }
function updateCartCountHeader() {
  const els = document.querySelectorAll("#cart-count-header");
  const cnt = getCart().length;
  els.forEach(el => el.textContent = cnt);
}

// ---------- render quick products (home) ----------
function renderQuickProducts(limit = 6) {
  const grid = document.getElementById("quick-products-grid");
  if (!grid) return;
  const products = getProducts().slice(0, limit);
  grid.innerHTML = products.map(p => productCardHtml(p)).join("");
}

// ---------- product card html ----------
function productCardHtml(p) {
  const img = p.image || placeholderImageSvg(600, 400, "صورة المنتج");
  return `
    <div class="card product">
      <img src="${img}" alt="${escapeHtml(p.title)}" />
      <div>
        <h4>${escapeHtml(p.title)}</h4>
        <div class="price">${p.price} ج</div>
        <div style="color:var(--muted);font-size:13px;margin-top:6px">${escapeHtml(p.category)}</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn" onclick="openProductModal('${p.id}')">عرض</button>
        <button class="btn ghost" onclick="addToCart('${p.id}')">أضف للسلة</button>
      </div>
    </div>
  `;
}

// ---------- modal ----------
function openProductModal(id) {
  const p = getProducts().find(x => x.id === id);
  if (!p) { alert("المنتج غير موجود"); return; }
  const body = document.createElement("div");
  body.innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap">
      <div style="flex:1;min-width:220px">
        <img style="width:100%;border-radius:8px;max-height:360px;object-fit:cover" src="${p.image || placeholderImageSvg(600,400,'صورة المنتج')}" />
      </div>
      <div style="flex:1">
        <h2>${escapeHtml(p.title)}</h2>
        <div style="font-weight:800;margin:8px 0">${p.price} ج</div>
        <div style="color:var(--muted);margin-bottom:10px">${escapeHtml(p.category)}</div>
        <p style="color:var(--muted);line-height:1.5">${escapeHtml(p.description || "لا يوجد وصف إضافي.")}</p>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button class="btn" onclick="addToCart('${p.id}'); closeModal();">أضف للسلة</button>
          <button class="btn ghost" onclick="closeModal()">إغلاق</button>
        </div>
      </div>
    </div>
  `;
  const overlay = document.createElement("div");
  overlay.className = "simple-modal-overlay";
  overlay.innerHTML = `<div class="simple-modal-window card"></div>`;
  overlay.querySelector(".simple-modal-window").appendChild(body);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}
function closeModal() { const el = document.querySelector(".simple-modal-overlay"); if (el) el.remove(); }

// ---------- cart actions ----------
function addToCart(productId) {
  const cart = getCart();
  cart.push(productId);
  setCart(cart);
  alert("تمت الإضافة إلى السلة");
}
function removeCartItemAt(index) {
  const cart = getCart();
  cart.splice(index, 1);
  setCart(cart);
}
function clearCart() {
  if (confirm("تفريغ السلة؟")) setCart([]);
}


// ---------- تشغيل قائمة الهامبرغر (لجميع الصفحات) ----------
// ---------- تشغيل قائمة الهامبرغر (لجميع الصفحات) ----------
function initHamburgerMenu() {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navLinks = document.querySelector('.nav-links');
  
  if (!hamburgerBtn || !navLinks) return;

  hamburgerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navLinks.classList.toggle('show');
  });

  // إغلاق القائمة عند النقر على أي رابط
  document.querySelectorAll('.nav-links .nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('show');
    });
  });

  // إغلاق عند النقر خارج القائمة
  document.addEventListener('click', (e) => {
    if (!navLinks.contains(e.target) && e.target !== hamburgerBtn) {
      navLinks.classList.remove('show');
    }
  });
}

// ---------- checkout with WhatsApp + Firestore ----------
async function checkout() {
  const cart = getCart();
  if (!cart.length) return alert("السلة فارغة");
  const products = getProducts();
  const items = cart.map(pid => products.find(p => p.id === pid)).filter(Boolean);
  const total = items.reduce((sum, p) => sum + p.price, 0);

  // إنشاء الطلب في Firestore
  const user = auth.currentUser;
  const order = {
    items: items.map(p => ({ id: p.id, title: p.title, price: p.price })),
    total,
    customerEmail: user ? user.email : 'مجهول',
    date: new Date().toISOString(),
    status: 'جديد'
  };
  await db.collection('orders').add(order);

  // فتح واتساب
  const itemsText = items.map(p => `${p.title} (${p.price} ج)`).join('%0A');
  const message = `طلب جديد من ${user ? user.email : 'مجهول'}:%0A${itemsText}%0Aالإجمالي: ${total} ج`;
  const phone = '201204818221'; // <-- ضع رقم الواتساب الخاص بالمتجر
  window.open(`https://wa.me/${phone}?text=${message}`, '_blank');

  setCart([]);
  alert("تم إرسال طلبك وسيتم التواصل معك عبر واتساب");
}

// ---------- repair form ----------
async function submitRepair(data) {
  const user = auth.currentUser;
  const repair = {
    ...data,
    userId: user.uid,
    userEmail: user.email,
    date: new Date().toISOString(),
    status: 'قيد الانتظار'
  };
  const docRef = await db.collection('repairs').add(repair);
  // فتح واتساب لمتابعة الطلب
  const message = `طلب صيانة جديد (رقم ${docRef.id}) من ${data.name} - ${data.device}: ${data.issue}`;
  const phone = '201204818221'; // نفس الرقم
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  alert("تم استلام طلب الصيانة، سنتواصل معك قريباً");
}

// ---------- Products Page ----------
function initProductsPage() {
  const grid = document.getElementById("products-grid-page");
  const search = document.getElementById("search-input-page");
  const filter = document.getElementById("filter-cat-page");
  const sort = document.getElementById("sort-select-page");

  function populateCategories() {
    const cats = Array.from(new Set(getProducts().map(p => p.category))).sort();
    filter.innerHTML = '<option value="">كل التصنيفات</option>' + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  }

  function render() {
    let arr = getProducts().slice();
    const q = (search.value || "").trim().toLowerCase();
    if (filter.value) arr = arr.filter(p => p.category === filter.value);
    if (q) arr = arr.filter(p => (p.title + " " + (p.description || "")).toLowerCase().includes(q));
    if (sort.value === "price-asc") arr.sort((a, b) => a.price - b.price);
    if (sort.value === "price-desc") arr.sort((a, b) => b.price - a.price);
    if (sort.value === "name-asc") arr.sort((a, b) => a.title.localeCompare(b.title));
    grid.innerHTML = arr.map(p => productCardHtml(p)).join("");
  }

  search.addEventListener("input", render);
  filter.addEventListener("change", render);
  sort.addEventListener("change", render);
  populateCategories();
  render();
}

// ---------- Cart Page ----------
function initCartPage() {
  const container = document.getElementById("cart-items-page");
  const totalEl = document.getElementById("cart-total-page");
  const clearBtn = document.getElementById("clear-cart-page");
  const checkoutBtn = document.getElementById("checkout-page");

  function render() {
    const cart = getCart();
    if (!cart.length) {
      container.innerHTML = '<p style="color:var(--muted)">السلة فارغة</p>';
      totalEl.textContent = "0";
      updateCartCountHeader();
      return;
    }
    const products = getProducts();
    container.innerHTML = cart.map((pid, idx) => {
      const p = products.find(x => x.id === pid);
      if (!p) return "";
      return `
        <div class="cart-item card">
          <img src="${p.image || placeholderImageSvg(200,200,'صورة')}" />
          <div style="flex:1">
            <div style="font-weight:700">${escapeHtml(p.title)}</div>
            <div style="color:var(--muted);font-size:13px">${p.price} ج</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
            <button class="btn ghost" onclick="removeCartItemAt(${idx}); initCartPage();">حذف</button>
          </div>
        </div>
      `;
    }).join("");
    const total = cart.reduce((s, pid) => { const p = products.find(x => x.id === pid); return s + (p ? p.price : 0); }, 0);
    totalEl.textContent = total;
    updateCartCountHeader();
  }

  clearBtn.addEventListener("click", () => { clearCart(); render(); });
  checkoutBtn.addEventListener("click", async () => { await checkout(); render(); });
  render();
}

// ---------- Admin Page ----------
function initAdminPage() {
  const form = document.getElementById("product-form-page");
  const resetBtn = document.getElementById("product-reset-page");
  const listDiv = document.getElementById("admin-products-list-page");
  const repairsDiv = document.getElementById("admin-repairs-list-page");
  
  // عناصر رفع الصورة
  const imageInput = document.getElementById('product-image-input');
  const imagePreview = document.getElementById('image-preview');
  const imageDataInput = document.getElementById('product-image-data');

  // تهيئة رفع الصورة
  if (imageInput) {
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(ev) {
          imageDataInput.value = ev.target.result; // base64
          imagePreview.src = ev.target.result;
          imagePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  let ordersDiv = document.getElementById("admin-orders-list-page");
  if (!ordersDiv) {
    const container = document.querySelector(".admin-right");
    const h4 = document.createElement("h4");
    h4.style.marginTop = "18px";
    h4.textContent = "طلبات الشراء";
    container.appendChild(h4);
    ordersDiv = document.createElement("div");
    ordersDiv.id = "admin-orders-list-page";
    ordersDiv.className = "admin-list";
    container.appendChild(ordersDiv);
  }

  async function renderProducts() {
    const products = getProducts();
    if (!products.length) {
      listDiv.innerHTML = '<p style="color:var(--muted)">لا توجد منتجات</p>';
      return;
    }
    listDiv.innerHTML = products.map(p => `
      <div class="row" style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px dashed rgba(255,255,255,0.02)">
        <div style="flex:1">
          <div style="font-weight:700">${escapeHtml(p.title)}</div>
          <div style="color:var(--muted);font-size:13px">${escapeHtml(p.category)} • ${p.price} ج</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn ghost" onclick="adminEditProduct('${p.id}')">تعديل</button>
          <button class="btn" onclick="adminDeleteProduct('${p.id}')">حذف</button>
        </div>
      </div>
    `).join("");
  }

  async function renderRepairs() {
    const snap = await db.collection('repairs').orderBy('date', 'desc').get();
    repairsDiv.innerHTML = snap.empty
      ? '<p style="color:var(--muted)">لا توجد طلبات صيانة</p>'
      : snap.docs.map(doc => {
          const r = doc.data();
          return `
            <div style="padding:8px;border-bottom:1px dashed rgba(255,255,255,0.02)">
              <div style="font-weight:700">${escapeHtml(r.name)} — ${escapeHtml(r.phone)}</div>
              <div style="color:var(--muted);font-size:13px">${escapeHtml(r.device||"")} | ${escapeHtml(r.userEmail||"")}</div>
              <div style="margin-top:6px;color:var(--muted)">${escapeHtml(r.issue)}</div>
              <div style="margin-top:8px;display:flex;gap:12px;align-items:center">
                <small style="color:var(--muted)">${new Date(r.date).toLocaleString('ar-EG')}</small>
                <span style="color:var(--accent);font-weight:bold">${r.status || 'قيد الانتظار'}</span>
              </div>
            </div>`;
        }).join("");
  }

  async function renderOrders() {
    const snap = await db.collection('orders').orderBy('date', 'desc').get();
    ordersDiv.innerHTML = snap.empty
      ? '<p style="color:var(--muted)">لا توجد طلبات شراء</p>'
      : snap.docs.map(doc => {
          const o = doc.data();
          const itemsList = o.items.map(i => `${i.title} (${i.price}ج)`).join('، ');
          return `
            <div style="padding:8px;border-bottom:1px dashed rgba(255,255,255,0.02)">
              <div style="font-weight:700">طلب #${doc.id}</div>
              <div style="color:var(--muted);font-size:13px">${new Date(o.date).toLocaleString('ar-EG')}</div>
              <div>العميل: ${escapeHtml(o.customerEmail||'مجهول')}</div>
              <div>المنتجات: ${escapeHtml(itemsList)}</div>
              <div>الإجمالي: ${o.total} ج</div>
              <div style="color:var(--accent);font-weight:bold">الحالة: ${o.status || 'جديد'}</div>
            </div>`;
        }).join("");
  }

  // حفظ منتج (إضافة أو تعديل)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.title || !data.category || !data.price) {
      showToast("⚠️ املأ الحقول المطلوبة");
      return;
    }
    const productData = {
      title: data.title,
      category: data.category,
      price: +data.price,
      description: data.description,
      image: data.image  // ستكون base64 أو رابط
    };

    if (data.id) {
      await db.collection('products').doc(data.id).update(productData);
    } else {
      await db.collection('products').add(productData);
    }
    form.reset();
    // إخفاء المعاينة
    if (imagePreview) imagePreview.style.display = 'none';
    if (imageDataInput) imageDataInput.value = '';
    if (imageInput) imageInput.value = '';
    await loadProductsFromFirestore();
    await renderProducts();
    showToast("💾 تم حفظ المنتج بنجاح");
  });

  resetBtn.addEventListener("click", () => {
    form.reset();
    if (imagePreview) imagePreview.style.display = 'none';
    if (imageDataInput) imageDataInput.value = '';
    if (imageInput) imageInput.value = '';
  });

  window.adminEditProduct = function(id) {
    const p = getProducts().find(x => x.id === id);
    if (!p) return;
    form.elements["id"].value = p.id;
    form.elements["title"].value = p.title;
    form.elements["category"].value = p.category;
    form.elements["price"].value = p.price;
    form.elements["description"].value = p.description;
    
    // التعامل مع الصورة
    if (imageDataInput) {
      imageDataInput.value = p.image || '';
      if (p.image) {
        imagePreview.src = p.image;
        imagePreview.style.display = 'block';
      } else {
        imagePreview.style.display = 'none';
      }
    }
    if (imageInput) imageInput.value = ''; // تفريغ input file
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.adminDeleteProduct = async function(id) {
    if (!confirm("هل تريد حذف هذا المنتج؟")) return;
    await db.collection('products').doc(id).delete();
    await loadProductsFromFirestore();
    await renderProducts();
    showToast("🗑️ تم حذف المنتج");
  };

  // تحميل البيانات أول مرة
  (async () => {
    await renderProducts();
    await renderRepairs();
    await renderOrders();
  })();
}

// ---------- Repair Page ----------
function initRepairPage() {
  const form = document.getElementById("repair-form-page");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.name || !data.phone || !data.issue) { alert("املأ الحقول المطلوبة"); return; }
    await submitRepair(data);
    form.reset();
  });
}

// ---------- ربط الدوال العامة ----------
window.openProductModal = openProductModal;
window.addToCart = addToCart;
window.removeCartItemAt = removeCartItemAt;
window.clearCart = clearCart;
window.checkout = checkout;

// ---------- تحميل المنتجات عند بدء أي صفحة (بعد الجلسة) ----------
// سيتم استدعاء هذه الدالة من checkAuthState في كل صفحة
async function initializeData() {
  await loadProductsFromFirestore();
  initHamburgerMenu();
  // يمكن إضافة أي تحميلات أخرى
}
