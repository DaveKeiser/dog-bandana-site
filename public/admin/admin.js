let PRODUCTS = [];

async function loadProducts() {
  const res = await fetch("/api/admin/products");
  if (!res.ok) throw new Error("Failed to load products");
  PRODUCTS = await res.json();
  render();
}

function byId(id) { return document.getElementById(id); }

function render() {
  const list = byId("list");
  list.innerHTML = "";

  for (const p of PRODUCTS) {
    const card = document.createElement("div");
    card.className = "card";

    const imgs = (p.images || []).map((src, idx) => `
      <div>
        <img class="thumb" src="${src}" />
        <div class="row" style="margin-top:6px">
          <button data-act="up" data-id="${p.id}" data-idx="${idx}">↑</button>
          <button data-act="down" data-id="${p.id}" data-idx="${idx}">↓</button>
          <button data-act="del" data-id="${p.id}" data-idx="${idx}">Remove</button>
        </div>
      </div>
    `).join("");

    card.innerHTML = `
      <h3>${p.name || "(no name)"} <span class="muted">(${p.id})</span></h3>
      <div class="muted">$${Number(p.price || 0).toFixed(2)}</div>
      <p>${p.description || ""}</p>
      <div class="imgrow">${imgs || "<span class='muted'>No images yet</span>"}</div>
      <div style="margin-top:10px">
        <button data-act="deleteProduct" data-id="${p.id}">Delete product</button>
      </div>
    `;

    list.appendChild(card);
  }

  list.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", () => {
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      const idx = Number(btn.dataset.idx);

      const prod = PRODUCTS.find(x => x.id === id);
      if (!prod) return;

      prod.images = prod.images || [];

      if (act === "up" && idx > 0) {
        [prod.images[idx - 1], prod.images[idx]] = [prod.images[idx], prod.images[idx - 1]];
      }
      if (act === "down" && idx < prod.images.length - 1) {
        [prod.images[idx + 1], prod.images[idx]] = [prod.images[idx], prod.images[idx + 1]];
      }
      if (act === "del") {
        prod.images.splice(idx, 1);
      }
      if (act === "deleteProduct") {
        PRODUCTS = PRODUCTS.filter(x => x.id !== id);
      }
      render();
    });
  });
}

async function saveAll() {
  const status = byId("status");
  status.textContent = "Saving...";
  const res = await fetch("/api/admin/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(PRODUCTS),
  });
  status.textContent = res.ok ? "Saved ✅" : "Save failed ❌";
}

async function uploadAndAttach() {
  const id = byId("uploadId").value.trim();
  const file = byId("uploadFile").files[0];
  if (!id) return alert("Enter a product ID");
  if (!file) return alert("Choose an image file");

  const prod = PRODUCTS.find(p => p.id === id);
  if (!prod) return alert("No product found with that ID");

  const form = new FormData();
  form.append("image", file);

  const res = await fetch("/api/admin/upload", { method: "POST", body: form });
  if (!res.ok) return alert("Upload failed");
  const data = await res.json();

  prod.images = prod.images || [];
  prod.images.push(data.url);
  render();
}

function addProduct() {
  const id = byId("id").value.trim();
  const name = byId("name").value.trim();
  const price = Number(byId("price").value || 0);
  const tags = byId("tags").value.split(",").map(s => s.trim()).filter(Boolean);
  const description = byId("description").value.trim();

  if (!id) return alert("ID is required");
  if (PRODUCTS.some(p => p.id === id)) return alert("ID must be unique");
  if (!name) return alert("Name is required");

  PRODUCTS.unshift({
    id,
    name,
    price,
    tags,
    description,
    images: [],
  });

  byId("id").value = "";
  byId("name").value = "";
  byId("price").value = "";
  byId("tags").value = "";
  byId("description").value = "";

  render();
}

document.addEventListener("DOMContentLoaded", async () => {
  byId("addBtn").addEventListener("click", addProduct);
  byId("saveBtn").addEventListener("click", saveAll);
  byId("uploadBtn").addEventListener("click", uploadAndAttach);

  try {
    await loadProducts();
  } catch (e) {
    console.error(e);
    alert("Could not load admin products. Is the server running? Did you log in when prompted?");
  }
});
