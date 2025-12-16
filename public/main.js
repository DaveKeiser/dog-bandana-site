/**
 * public/main.js
 *
 * Runs in the browser.
 * - Loads products + posts
 * - Renders product cards (including color swatches when available)
 * - Quick View modal for options like size / name / special request
 * - Cart stores per-item options (size, dog name, note, color)
 */
// cart edit consistency branch   and again

// ------------------------------
// STATE
// ------------------------------
let PRODUCTS = [];
let CART = [];

// Persist cart across pages
const LS_CART_KEY = "gf_cart_v1";

function loadCart() {
  try {
    const raw = localStorage.getItem(LS_CART_KEY);
    CART = raw ? JSON.parse(raw) : [];
  } catch {
    CART = [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(LS_CART_KEY, JSON.stringify(CART));
  } catch {
    // ignore
  }
}

/**
 * Per-product "current settings" that show on the card.
 * Persist while the page is open.
 *
 * Example:
 * SELECTIONS["bandana-001"] = { size:"M", dogName:"Max", note:"", color:"forest" }
 */
const SELECTIONS = {};

let MODAL_PRODUCT_ID = null;
let EDITING_CART_INDEX = null;

// ------------------------------
// DOM ELEMENTS
// ------------------------------
const productGridEl = document.getElementById("productGrid");
const blogGridEl = document.getElementById("blogGrid");

const cartButtonEl = document.getElementById("cartButton");
const cartDrawerEl = document.getElementById("cartDrawer");
const closeCartEl = document.getElementById("closeCart");
const cartItemsEl = document.getElementById("cartItems");
const cartTotalEl = document.getElementById("cartTotal");
const cartCountEl = document.getElementById("cartCount");
const checkoutButtonEl = document.getElementById("checkoutButton");

// Modal
const modalOverlayEl = document.getElementById("modalOverlay");
const modalCloseEl = document.getElementById("modalClose");
const modalTitleEl = document.getElementById("modalTitle");
const modalImageEl = document.getElementById("modalImage");
const modalDescEl = document.getElementById("modalDesc");

const modalSizeWrapEl = document.getElementById("modalSizeWrap");
const modalSizeEl = document.getElementById("modalSize");
const modalSizeErrorEl = document.getElementById("modalSizeError");
const modalSizeLabelEl = document.getElementById("modalSizeLabel"); // optional but recommended

const modalDogNameWrapEl = document.getElementById("modalDogNameWrap");
const modalDogNameEl = document.getElementById("modalDogName");
const modalDogNameErrorEl = document.getElementById("modalDogNameError");

const modalNoteWrapEl = document.getElementById("modalNoteWrap");
const modalNoteEl = document.getElementById("modalNote");

const modalAddToCartEl = document.getElementById("modalAddToCart");
const modalSaveEl = document.getElementById("modalSave");
const modalUpdateItemEl = document.getElementById("modalUpdateItem");

// ------------------------------
// HELPERS
// ------------------------------
function dollars(n) {
  return `$${Number(n).toFixed(2)}`;
}

function findProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
}

function getOptions(product) {
  return product?.options || {};
}

function getSel(productId) {
  if (!SELECTIONS[productId]) {
    SELECTIONS[productId] = { size: "", dogName: "", note: "", color: "" };
  }
  return SELECTIONS[productId];
}

function setSel(productId, patch) {
  SELECTIONS[productId] = { ...getSel(productId), ...patch };
}

function cartCount() {
  return CART.reduce((sum, item) => sum + item.quantity, 0);
}

function cartTotal() {
  return CART.reduce((sum, item) => {
    const p = findProduct(item.id);
    return p ? sum + p.price * item.quantity : sum;
  }, 0);
}

function renderCartBadge() {
  if (!cartCountEl) return;
  cartCountEl.textContent = String(cartCount());
}

// If index.html + product.html live together in /public,
// use ./product.html (NOT /product.html) so it works everywhere.
function productHrefById(id) {
  return `./product.html?id=${encodeURIComponent(id)}`;
}

// ------------------------------
// VALIDATION HELPERS
// ------------------------------
function showSizeError(show) {
  if (!modalSizeErrorEl) return;
  modalSizeErrorEl.classList.toggle("hidden", !show);
}

function showDogNameError(show) {
  if (!modalDogNameErrorEl) return;
  modalDogNameErrorEl.classList.toggle("hidden", !show);
}

/**
 * Dog name rules:
 * - required only when opt.dogNamePrompt is true
 * - allow user to type "blank" or "none" → store "none"
 * - cap to 15 characters
 */
function normalizeDogName(raw) {
  const v = (raw || "").trim();
  if (!v) return null;

  if (/^(blank|none)$/i.test(v)) return "none";

  return v.length > 15 ? v.slice(0, 15) : v;
}

// ------------------------------
// SIZE HELPERS (supports strings OR {value,label})
// ------------------------------
function sizeValue(sizeItem) {
  return typeof sizeItem === "string" ? sizeItem : (sizeItem?.value || "");
}

function sizeLabel(sizeItem) {
  return typeof sizeItem === "string" ? sizeItem : (sizeItem?.label || sizeItem?.value || "");
}

function getSizeLabelFromValue(opt, value) {
  if (!opt?.sizes || !Array.isArray(opt.sizes) || !value) return value;
  const found = opt.sizes.find((s) => sizeValue(s) === value);
  return found ? sizeLabel(found) : value;
}

function getColorLabel(opt, value) {
  if (!opt?.colors || !Array.isArray(opt.colors) || !value) return value;
  const found = opt.colors.find((c) => c.value === value);
  return found ? (found.label || value) : value;
}

// ------------------------------
// DISPLAY IMAGE LOGIC (swatches)
// ------------------------------
function getDisplayImage(product, sel) {
  const opt = getOptions(product);

  if (opt.colors && Array.isArray(opt.colors)) {
    const selectedValue = sel.color || opt.colors[0]?.value || "";
    const colorObj = opt.colors.find((c) => c.value === selectedValue);
    if (colorObj?.image) return colorObj.image;
  }

  return product.image;
}

function getCartItemImage(product, item) {
  const opt = getOptions(product);

  if (opt.colors && Array.isArray(opt.colors) && item.color) {
    const colorObj = opt.colors.find((c) => c.value === item.color);
    if (colorObj?.image) return colorObj.image;
  }

  return product.image;
}

// ------------------------------
// CART DRAWER OPEN/CLOSE
// ------------------------------
function openCart() {
  if (!cartDrawerEl) return;
  cartDrawerEl.classList.remove("translate-x-full");
  renderCart();
}

function closeCart() {
  if (!cartDrawerEl) return;
  cartDrawerEl.classList.add("translate-x-full");
}

cartButtonEl?.addEventListener("click", (e) => {
  e.stopPropagation();
  openCart();
});

closeCartEl?.addEventListener("click", (e) => {
  e.stopPropagation();
  closeCart();
});

// Keep cart open when clicking inside it
cartDrawerEl?.addEventListener("click", (e) => e.stopPropagation());

// Click-away to close cart (ignore clicks inside drawer or on cart button)
document.addEventListener("click", (e) => {
  const isOpen = cartDrawerEl && !cartDrawerEl.classList.contains("translate-x-full");
  if (!isOpen) return;

  if (cartDrawerEl.contains(e.target) || cartButtonEl?.contains(e.target)) return;

  closeCart();
});

// ------------------------------
// MODAL OPEN/CLOSE
// ------------------------------
function openModal(productId) {
  const p = findProduct(productId);
  if (!p) return;

  MODAL_PRODUCT_ID = productId;

  const opt = getOptions(p);
  const sel = getSel(productId);

  // Title/desc/image
  modalTitleEl.textContent = p.name;
  modalDescEl.textContent = p.description || "";
  modalImageEl.src = getDisplayImage(p, sel);
  modalImageEl.alt = p.name;

  // Reset errors
  showSizeError(false);
  showDogNameError(false);

  // Size label (optional)
  if (modalSizeLabelEl) {
    modalSizeLabelEl.textContent = opt.sizeLabel || "Size";
  }

  // Size dropdown (supports string OR object sizes)
  if (opt.sizes && Array.isArray(opt.sizes) && modalSizeWrapEl && modalSizeEl) {
    modalSizeWrapEl.classList.remove("hidden");

    const optionsHtml = opt.sizes
      .map((s) => {
        const v = sizeValue(s);
        const lbl = sizeLabel(s);
        return `<option value="${v}">${lbl}</option>`;
      })
      .join("");

    modalSizeEl.innerHTML = `<option value="">Select size…</option>${optionsHtml}`;
    modalSizeEl.value = sel.size || "";
  } else {
    modalSizeWrapEl?.classList.add("hidden");
    if (modalSizeEl) modalSizeEl.value = "";
  }

  // Dog name
  if (opt.dogName && modalDogNameWrapEl && modalDogNameEl) {
    modalDogNameWrapEl.classList.remove("hidden");
    modalDogNameEl.value = sel.dogName || "";
  } else {
    modalDogNameWrapEl?.classList.add("hidden");
    if (modalDogNameEl) modalDogNameEl.value = "";
  }

  // Note
  if (opt.note && modalNoteWrapEl && modalNoteEl) {
    modalNoteWrapEl.classList.remove("hidden");
    modalNoteEl.value = sel.note || "";
  } else {
    modalNoteWrapEl?.classList.add("hidden");
    if (modalNoteEl) modalNoteEl.value = "";
  }

  // Buttons: add vs update
  const editing = EDITING_CART_INDEX !== null;
  modalUpdateItemEl?.classList.toggle("hidden", !editing);
  modalAddToCartEl?.classList.toggle("hidden", editing);

  // Show modal
  modalOverlayEl.classList.remove("hidden");
  modalOverlayEl.classList.add("flex");
}

function closeModal() {
  MODAL_PRODUCT_ID = null;
  EDITING_CART_INDEX = null;

  modalOverlayEl.classList.add("hidden");
  modalOverlayEl.classList.remove("flex");

  modalUpdateItemEl?.classList.add("hidden");
  modalAddToCartEl?.classList.remove("hidden");

  showSizeError(false);
  showDogNameError(false);
}

modalCloseEl?.addEventListener("click", closeModal);
modalOverlayEl?.addEventListener("click", (e) => {
  if (e.target === modalOverlayEl) closeModal();
});

modalDogNameEl?.addEventListener("input", () => showDogNameError(false));
modalSizeEl?.addEventListener("change", () => showSizeError(false));

// ------------------------------
// ADD TO CART (uses current selections)
// ------------------------------
function addToCart(productId) {
  const p = findProduct(productId);
  if (!p) return;

  const opt = getOptions(p);
  const sel = getSel(productId);

  // Default first color if product has colors
  if (opt.colors && Array.isArray(opt.colors) && !sel.color) {
    setSel(productId, { color: opt.colors[0]?.value || "" });
  }

  const finalSel = getSel(productId);

  // Size required
  if (opt.sizesRequired && !finalSel.size) {
    EDITING_CART_INDEX = null;
    openModal(productId);
    showSizeError(true);
    return;
  }

  // Dog name required (prompted)
  if (opt.dogName && opt.dogNamePrompt) {
    const normalized = normalizeDogName(finalSel.dogName);
    if (!normalized) {
      EDITING_CART_INDEX = null;
      openModal(productId);
      showDogNameError(true);
      modalDogNameEl?.focus();
      return;
    }
    setSel(productId, { dogName: normalized });
  }

  const readySel = getSel(productId);

  // Unique cart line item by product + options
  const keyMatch = (item) =>
    item.id === productId &&
    (item.size || "") === (readySel.size || "") &&
    (item.dogName || "") === (readySel.dogName || "") &&
    (item.note || "") === (readySel.note || "") &&
    (item.color || "") === (readySel.color || "");

  const existing = CART.find(keyMatch);

  if (existing) existing.quantity += 1;
  else {
    CART.push({
      id: productId,
      quantity: 1,
      size: readySel.size || "",
      dogName: readySel.dogName || "",
      note: readySel.note || "",
      color: readySel.color || "",
    });
  }

  saveCart();

  renderCartBadge();
  renderCart();
}

// ------------------------------
// RENDER PRODUCTS (cards)
// ------------------------------
function renderProducts() {
  if (!productGridEl) return;

  productGridEl.innerHTML = PRODUCTS
    .map((p) => {
      const opt = getOptions(p);
      const sel = getSel(p.id);

      // Default color for swatches/images
      if (opt.colors && Array.isArray(opt.colors) && !sel.color) {
        sel.color = opt.colors[0]?.value || "";
      }

      // Build "Current settings" line
      const parts = [];

      if (opt.colors && Array.isArray(opt.colors)) {
        const label = opt.colors.find((c) => c.value === sel.color)?.label || "";
        if (label) parts.push(label);
      }

      if (opt.sizes && Array.isArray(opt.sizes) && sel.size) {
        parts.push(getSizeLabelFromValue(opt, sel.size)); // shows inches
      }

      if (opt.dogName && sel.dogName) parts.push(sel.dogName);

      const selectedLine = parts.join(" • ");

      // Swatches HTML
      let swatchesHtml = "";
      if (opt.colors && Array.isArray(opt.colors)) {
        swatchesHtml = `
        <div class="mt-3 flex items-center gap-2 flex-wrap">
          ${opt.colors
            .map((c) => {
              const active = c.value === sel.color;
              return `
                <button
                  class="h-5 w-5 rounded-full border ${active ? "border-slate-900" : "border-slate-200"}"
                  style="background:${c.swatch || "#000"}"
                  title="${c.label}"
                  aria-label="${c.label}"
                  data-swatch="${p.id}"
                  data-color="${c.value}"
                  type="button"
                ></button>
              `;
            })
            .join("")}
        </div>
      `;
      }

      const hasModalOptions = !!(opt.sizes || opt.dogName || opt.note);
      const href = productHrefById(p.id);

      return `
      <article class="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div class="aspect-[4/5] bg-slate-100">
          <a href="${href}" class="block">
            <img src="${getDisplayImage(p, sel)}" alt="${p.name}" class="w-full h-full object-cover">
          </a>
        </div>

        <div class="p-4">
          <div class="flex justify-between items-start gap-3">
            <h3 class="font-semibold text-base">
              <a href="${href}" class="hover:text-emerald-700">${p.name}</a>
            </h3>
            <span class="text-emerald-700 font-semibold">${dollars(p.price)}</span>
          </div>

          <p class="text-sm text-slate-600 mt-2">${p.description || ""}</p>

          ${swatchesHtml}

          <div class="mt-3">
            ${
              selectedLine
                ? `<div class="text-xs text-slate-500 uppercase tracking-wide">Current settings</div>
                   <div class="text-sm text-slate-700 font-medium">${selectedLine}</div>`
                : `<div class="text-xs text-slate-500 min-h-[1.25rem]">&nbsp;</div>`
            }
          </div>

          <div class="mt-3 flex gap-2">
            <button
              class="flex-1 px-3 py-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-500 text-sm"
              data-add="${p.id}"
              type="button"
            >
              Add
            </button>

            ${
              hasModalOptions
                ? `<button
                     class="px-3 py-2 rounded-full border border-slate-200 hover:bg-slate-50 text-sm"
                     data-qv="${p.id}"
                     type="button"
                   >
                     Quick view
                   </button>`
                : ""
            }
          </div>
        </div>
      </article>
    `;
    })
    .join("");

  // Add handlers
  productGridEl.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => addToCart(btn.dataset.add));
  });

  // Quick view handlers
  productGridEl.querySelectorAll("[data-qv]").forEach((btn) => {
    btn.addEventListener("click", () => {
      EDITING_CART_INDEX = null;
      openModal(btn.dataset.qv);
    });
  });

  // Swatch handlers
  productGridEl.querySelectorAll("[data-swatch]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const productId = btn.getAttribute("data-swatch");
      const colorValue = btn.getAttribute("data-color");
      setSel(productId, { color: colorValue });
      renderProducts();
    });
  });
}

// ------------------------------
// RENDER BLOG POSTS
// ------------------------------
function renderPosts(posts) {
  if (!blogGridEl) return;

  blogGridEl.innerHTML = posts
    .map(
      (post) => `
      <article class="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <div class="text-xs text-emerald-700 mb-2">${post.date}</div>
        <h3 class="font-semibold text-lg mb-2">${post.title}</h3>
        <p class="text-sm text-slate-600">${post.excerpt}</p>
      </article>
    `
    )
    .join("");
}

// ------------------------------
// MODAL SAVE / ADD / UPDATE
// ------------------------------
modalSaveEl?.addEventListener("click", () => {
  if (!MODAL_PRODUCT_ID) return;

  const p = findProduct(MODAL_PRODUCT_ID);
  const opt = getOptions(p);

  const next = {};
  if (opt.sizes) next.size = modalSizeEl?.value || "";
  if (opt.dogName) next.dogName = (modalDogNameEl?.value || "").trim();
  if (opt.note) next.note = (modalNoteEl?.value || "").trim();

  setSel(MODAL_PRODUCT_ID, next);
  renderProducts();
  closeModal();
});

modalAddToCartEl?.addEventListener("click", () => {
  if (!MODAL_PRODUCT_ID) return;

  const p = findProduct(MODAL_PRODUCT_ID);
  const opt = getOptions(p);

  // Validate size
  if (opt.sizesRequired && !(modalSizeEl?.value || "")) {
    showSizeError(true);
    return;
  }

  // Validate dog name (prompted)
  let dogNameValue = (modalDogNameEl?.value || "").trim();
  if (opt.dogName && opt.dogNamePrompt) {
    const normalized = normalizeDogName(dogNameValue);
    if (!normalized) {
      showDogNameError(true);
      modalDogNameEl?.focus();
      return;
    }
    dogNameValue = normalized;
  }

  const next = {};
  if (opt.sizes) next.size = modalSizeEl?.value || "";
  if (opt.dogName) next.dogName = dogNameValue;
  if (opt.note) next.note = (modalNoteEl?.value || "").trim();

  setSel(MODAL_PRODUCT_ID, next);

  addToCart(MODAL_PRODUCT_ID);
  renderProducts();
  closeModal();
});

modalUpdateItemEl?.addEventListener("click", () => {
  if (EDITING_CART_INDEX === null || !MODAL_PRODUCT_ID) return;

  const p = findProduct(MODAL_PRODUCT_ID);
  const opt = getOptions(p);

  // Validate size
  if (opt.sizesRequired && !(modalSizeEl?.value || "")) {
    showSizeError(true);
    return;
  }

  // Validate dog name (prompted)
  let dogNameValue = (modalDogNameEl?.value || "").trim();
  if (opt.dogName && opt.dogNamePrompt) {
    const normalized = normalizeDogName(dogNameValue);
    if (!normalized) {
      showDogNameError(true);
      modalDogNameEl?.focus();
      return;
    }
    dogNameValue = normalized;
  }

  const next = {};
  if (opt.sizes) next.size = modalSizeEl?.value || "";
  if (opt.dogName) next.dogName = dogNameValue;
  if (opt.note) next.note = (modalNoteEl?.value || "").trim();

  setSel(MODAL_PRODUCT_ID, next);

  // Update that cart line item
  const idx = EDITING_CART_INDEX;
  const line = CART[idx];
  if (!line) return;

  const sel = getSel(MODAL_PRODUCT_ID);
  line.size = sel.size || "";
  line.dogName = sel.dogName || "";
  line.note = sel.note || "";
  line.color = sel.color || line.color || "";

  saveCart();

  renderCartBadge();
  renderCart();
  renderProducts();
  closeModal();
});

// ------------------------------
// RENDER CART
// ------------------------------
function renderCart() {
  if (!cartItemsEl || !cartTotalEl) return;

  if (CART.length === 0) {
    cartItemsEl.innerHTML = `<p class="text-slate-600">Your cart is empty.</p>`;
    cartTotalEl.textContent = dollars(0);
    return;
  }

  cartItemsEl.innerHTML = CART
    .map((item, idx) => {
      const p = findProduct(item.id);
      if (!p) return "";

      const opt = getOptions(p);

      const details = [
        item.color ? `Color: ${getColorLabel(opt, item.color)}` : "",
        item.size ? `Size: ${getSizeLabelFromValue(opt, item.size)}` : "",
        item.dogName ? `Name: ${item.dogName}` : "No personalization",
        item.note ? `Note: ${item.note}` : "",
      ]
        .filter(Boolean)
        .join(" • ");

      const thumb = getCartItemImage(p, item);

      return `
        <div class="py-3 border-b border-slate-200">
          <div class="flex justify-between gap-3">
            <div class="flex gap-3">
              <img
                src="${thumb}"
                alt="${p.name}"
                class="w-14 h-14 rounded-xl object-cover bg-slate-100 border border-slate-200"
              />
              <div>
                <p class="font-medium">${p.name}</p>
                <p class="text-xs text-slate-600 mt-1">${details}</p>
              </div>
            </div>

            <button
              class="text-xs text-slate-500 hover:text-emerald-700"
              data-edit="${idx}"
              type="button"
            >
              Edit
            </button>
          </div>

          <div class="mt-2 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <button
                class="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
                data-qty="${idx}"
                data-delta="-1"
                type="button"
              >-</button>

              <span class="text-sm">${item.quantity}</span>

              <button
                class="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
                data-qty="${idx}"
                data-delta="1"
                type="button"
              >+</button>
            </div>

            <p class="text-sm font-semibold">${dollars(p.price * item.quantity)}</p>
          </div>
        </div>
      `;
    })
    .join("");

  // Edit handlers
  cartItemsEl.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();

      const idx = Number(btn.getAttribute("data-edit"));
      const item = CART[idx];
      const p = findProduct(item.id);
      if (!p) return;

      setSel(item.id, {
        size: item.size || "",
        dogName: item.dogName || "",
        note: item.note || "",
        color: item.color || "",
      });

      EDITING_CART_INDEX = idx;
      openModal(item.id);
    });
  });

  // Qty handlers
  cartItemsEl.querySelectorAll("[data-qty]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();

      const idx = Number(btn.getAttribute("data-qty"));
      const delta = Number(btn.getAttribute("data-delta"));

      if (!CART[idx]) return;

      CART[idx].quantity += delta;
      if (CART[idx].quantity <= 0) CART.splice(idx, 1);

      saveCart();
      renderCartBadge();
      renderCart();
    });
  });

  cartTotalEl.textContent = dollars(cartTotal());
}

// ------------------------------
// CHECKOUT BUTTON (Stripe later)
// ------------------------------
checkoutButtonEl?.addEventListener("click", async () => {
  if (CART.length === 0) {
    alert("Your cart is empty.");
    return;
  }

  try {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: CART }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Checkout failed.");
      return;
    }

    window.location.href = data.url;
  } catch (err) {
    console.error(err);
    alert("Checkout failed. (We’ll fix this when we add Stripe keys.)");
  }
});

// ------------------------------
// STARTUP
// ------------------------------
async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function startup() {
  loadCart();

  try {
    // Products: API first (when server.js is running), fallback to local JSON for simple static testing
    try {
      PRODUCTS = await getJson("/api/products");
    } catch {
      PRODUCTS = await getJson("products.json");
    }

    // Posts: optional
    let posts = [];
    try {
      posts = await getJson("/api/posts");
    } catch {
      try {
        posts = await getJson("posts.json");
      } catch {
        posts = [];
      }
    }

    renderProducts();
    renderPosts(posts);
    renderCartBadge();
    renderCart();
  } catch (err) {
    console.error("Startup failed:", err);
  }
}


document.addEventListener("DOMContentLoaded", startup);
