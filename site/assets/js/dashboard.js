/* لوحة تحكم مهدي فود
   كل التعديلات بتتعمل على نسخة في الذاكرة، وبتتبعت مرة واحدة لما تدوس «حفظ». */

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const DAYS = [
    ["sat", "السبت"], ["sun", "الأحد"], ["mon", "الإثنين"], ["tue", "الثلاثاء"],
    ["wed", "الأربعاء"], ["thu", "الخميس"], ["fri", "الجمعة"],
  ];
  const TAGS = [["bestseller", "الأكثر طلباً"], ["offer", "عرض"], ["signature", "توقيع الشيف"]];
  const BUNDLED_IMAGES = [
    "hero.jpg", "counter.jpg", "grill.jpg", "grilled-fish.jpg", "tagine.jpg", "crab.jpg",
    "crab-tray.jpg", "crab-tray2.jpg", "mixed-tray.jpg", "fresh-platter.jpg", "soup.jpg",
    "shrimp-tray.jpg", "menu-card.jpg",
  ];

  let data = null;
  let pw = sessionStorage.getItem("mf_pw") || "";
  let dirty = false;
  let tab = "prices";

  const imgSrc = (n) => (/^https?:\/\//.test(n) ? n : "assets/img/" + n);
  const uid = (p) => p + Math.random().toString(36).slice(2, 7);

  /* ---------- state ---------- */
  function markDirty(on = true) {
    dirty = on;
    const st = $("#status");
    st.className = "status" + (on ? " dirty" : "");
    st.textContent = on ? "● في تعديلات مش محفوظة" : "كل حاجة محفوظة";
    $("#saveBtn").disabled = !on;
  }

  function toast(msg, isErr) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast is-on" + (isErr ? " err" : "");
    clearTimeout(t._tm);
    t._tm = setTimeout(() => (t.className = "toast" + (isErr ? " err" : "")), 2600);
  }

  async function save(extra) {
    const btn = $("#saveBtn");
    btn.disabled = true;
    $("#status").className = "status";
    $("#status").textContent = "بيحفظ…";
    try {
      const res = await fetch("/api/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-password": pw },
        body: JSON.stringify(data),
      });
      if (res.status === 401) {
        sessionStorage.removeItem("mf_pw");
        location.reload();
        return;
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status);
      markDirty(false);
      $("#status").className = "status ok";
      $("#status").textContent = "✓ اتحفظ — الموقع اتحدّث";
      toast(extra || "اتحفظ ✓");
    } catch (err) {
      $("#status").className = "status err";
      $("#status").textContent = "✗ الحفظ فشل";
      $("#saveBtn").disabled = false;
      toast("الحفظ فشل: " + err.message, true);
    }
  }

  /* ---------- tab: أسعار اليوم ---------- */
  function viewPrices() {
    const view = $("#view");
    view.innerHTML = "";

    const p = el("section", "panel");
    p.append(
      el("h2", null, "🧊 أسعار السمك النهاردة"),
      el("p", "hint", "حط سعر الكيلو لكل صنف موجود النهاردة. اللي مش موجود اقفل المفتاح وهيظهر «خلص النهاردة» في الموقع. سيبه فاضي يعني «اسأل».")
    );

    const list = el("div");
    [...data.daily]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach((f) => {
        const row = el("div", "price-row" + (f.available === false ? " is-out" : ""));
        row.innerHTML = `
          <span class="nm">${esc(f.ar)}<small>${esc(f.en || "")}</small></span>
          <input type="number" inputmode="numeric" min="0" step="5" placeholder="اسأل" value="${f.price ?? ""}" aria-label="سعر ${esc(f.ar)}">
          <label class="sw"><input type="checkbox" ${f.available === false ? "" : "checked"} aria-label="متوفر"><span></span></label>`;

        row.querySelector('input[type="number"]').addEventListener("input", (e) => {
          const v = e.target.value.trim();
          f.price = v === "" ? null : Number(v);
          markDirty();
        });
        row.querySelector('input[type="checkbox"]').addEventListener("change", (e) => {
          f.available = e.target.checked;
          row.classList.toggle("is-out", !e.target.checked);
          markDirty();
        });
        list.append(row);
      });
    p.append(list);

    const act = el("div", null);
    act.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;margin-block-start:16px";
    const stampBtn = el("button", "btn btn-green", "✓ حفظ أسعار النهاردة");
    stampBtn.type = "button";
    stampBtn.addEventListener("click", () => {
      data.pricesUpdatedAt = new Date().toISOString();
      save("أسعار النهاردة اتنشرت ✓");
    });
    const clearBtn = el("button", "btn btn-ghost", "🧹 فضّي كل الأسعار");
    clearBtn.type = "button";
    clearBtn.addEventListener("click", () => {
      if (!confirm("تفضّي كل أسعار النهاردة؟")) return;
      data.daily.forEach((f) => { f.price = null; f.available = true; });
      markDirty();
      viewPrices();
    });
    act.append(stampBtn, clearBtn);
    p.append(act);

    const stamp = data.pricesUpdatedAt ? new Date(data.pricesUpdatedAt) : null;
    p.append(
      el("p", "hint", stamp && !isNaN(stamp)
        ? `آخر نشر للأسعار: ${stamp.toLocaleString("ar-EG")}`
        : "الأسعار لسه ما اتنشرتش")
    );

    const addP = el("section", "panel");
    addP.innerHTML = `<h2>➕ صنف سمك جديد</h2><p class="hint">لو جه نوع جديد مش في اللستة.</p>
      <div class="row2">
        <label class="field"><span>الاسم بالعربي</span><input id="nfAr" placeholder="مثال: مرجان أحمر"></label>
        <label class="field"><span>الاسم بالإنجليزي</span><input id="nfEn" placeholder="Red marjan"></label>
      </div>
      <button class="btn btn-ghost" type="button" id="nfAdd">إضافة</button>`;
    addP.querySelector("#nfAdd").addEventListener("click", () => {
      const ar = addP.querySelector("#nfAr").value.trim();
      if (!ar) return toast("اكتب الاسم بالعربي", true);
      data.daily.push({
        id: uid("d"), ar, en: addP.querySelector("#nfEn").value.trim(),
        price: null, available: true,
        order: Math.max(0, ...data.daily.map((d) => d.order || 0)) + 1,
      });
      markDirty();
      viewPrices();
      toast("اتضاف ✓");
    });

    view.append(p, addP);
  }

  /* ---------- tab: الأصناف ---------- */
  function viewItems() {
    const view = $("#view");
    view.innerHTML = "";

    const p = el("section", "panel");
    p.append(el("h2", null, "🍽️ أصناف المنيو"), el("p", "hint", "الأصناف دي أسعارها ثابتة — مش بتتغير كل يوم زي السمك."));

    const addBtn = el("button", "btn btn-primary", "➕ صنف جديد");
    addBtn.type = "button";
    addBtn.addEventListener("click", () => openSheet(null));
    p.append(addBtn);
    view.append(p);

    const cats = [...data.categories].sort((a, b) => (a.order || 0) - (b.order || 0));
    cats.forEach((c) => {
      const items = data.items.filter((i) => i.cat === c.id).sort((a, b) => (a.order || 0) - (b.order || 0));
      const sec = el("section", "panel");
      sec.append(el("div", "cat-head", `<span>${c.iconAr || "🍽️"}</span><span>${esc(c.ar)}</span><span class="count">${items.length} صنف</span>`));
      if (!items.length) sec.append(el("p", "empty", "مفيش أصناف هنا لسه"));

      items.forEach((item, idx) => {
        const row = el("div", "item-row");
        const thumb = item.image
          ? `<img class="thumb" src="${esc(imgSrc(item.image))}" alt="">`
          : `<span class="thumb">${c.iconAr || "🐟"}</span>`;
        const price = item.price == null ? "اسأل" : `${item.price} ج`;
        row.innerHTML = `${thumb}
          <span class="meta"><b>${esc(item.ar)}</b><small>${price}${item.available === false ? " · مش متاح" : ""}</small></span>
          <span class="acts">
            <button class="icon-btn" data-up title="لفوق" ${idx === 0 ? "disabled" : ""}>↑</button>
            <button class="icon-btn" data-down title="لتحت" ${idx === items.length - 1 ? "disabled" : ""}>↓</button>
            <button class="icon-btn" data-edit title="تعديل">✏️</button>
            <button class="icon-btn" data-del title="حذف">🗑️</button>
          </span>`;
        row.querySelector("[data-edit]").addEventListener("click", () => openSheet(item));
        row.querySelector("[data-del]").addEventListener("click", () => {
          if (!confirm(`تحذف «${item.ar}»؟`)) return;
          data.items = data.items.filter((x) => x.id !== item.id);
          markDirty();
          viewItems();
        });
        row.querySelector("[data-up]").addEventListener("click", () => swap(items, idx, idx - 1));
        row.querySelector("[data-down]").addEventListener("click", () => swap(items, idx, idx + 1));
        sec.append(row);
      });
      view.append(sec);
    });

    function swap(arr, a, b) {
      if (b < 0 || b >= arr.length) return;
      const oa = arr[a].order || a + 1;
      arr[a].order = arr[b].order || b + 1;
      arr[b].order = oa;
      markDirty();
      viewItems();
    }
  }

  /* ---------- sheet: تعديل صنف ---------- */
  function openSheet(item) {
    const isNew = !item;
    const draft = isNew
      ? {
          id: uid("i"),
          cat: data.categories[0]?.id || "grilled",
          ar: "", en: "", descAr: "", descEn: "",
          price: null, oldPrice: null, image: "", tags: [], available: true,
          order: Math.max(0, ...data.items.map((i) => i.order || 0)) + 1,
        }
      : JSON.parse(JSON.stringify(item));

    const bg = el("div", "sheet-bg");
    const sheet = el("div", "sheet");

    const catOpts = data.categories
      .map((c) => `<option value="${c.id}" ${c.id === draft.cat ? "selected" : ""}>${esc(c.ar)}</option>`)
      .join("");
    const imgOpts = ['<option value="">— من غير صورة —</option>']
      .concat(BUNDLED_IMAGES.map((f) => `<option value="${f}" ${f === draft.image ? "selected" : ""}>${f}</option>`))
      .concat(/^https?:\/\//.test(draft.image) ? [`<option value="${esc(draft.image)}" selected>صورة مرفوعة</option>`] : [])
      .join("");

    sheet.innerHTML = `
      <div class="sheet-head">
        <h3>${isNew ? "صنف جديد" : "تعديل الصنف"}</h3>
        <div class="spacer"></div>
        <button class="icon-btn" type="button" data-close>✕</button>
      </div>

      <div class="preview">
        <div class="pv-label">شكله في الموقع</div>
        <div class="pv-img" data-pv-img></div>
        <div class="pv-body">
          <div class="pv-name" data-pv-name>—</div>
          <div class="pv-desc" data-pv-desc></div>
          <div class="pv-price" data-pv-price></div>
        </div>
      </div>

      <div class="row2">
        <label class="field"><span>الاسم بالعربي *</span><input data-f="ar" value="${esc(draft.ar)}" placeholder="كيلو بوري مشوي"></label>
        <label class="field"><span>الاسم بالإنجليزي</span><input data-f="en" value="${esc(draft.en)}" placeholder="Grilled mullet — 1kg"></label>
      </div>
      <label class="field"><span>الوصف بالعربي</span><input data-f="descAr" value="${esc(draft.descAr)}" placeholder="على الفحم، متبّل بالبلدي"></label>
      <label class="field"><span>الوصف بالإنجليزي</span><input data-f="descEn" value="${esc(draft.descEn)}" placeholder="Charcoal-grilled"></label>
      <div class="row2">
        <label class="field"><span>السعر (سيبه فاضي = اسأل)</span><input type="number" inputmode="numeric" min="0" data-f="price" value="${draft.price ?? ""}"></label>
        <label class="field"><span>السعر قبل الخصم</span><input type="number" inputmode="numeric" min="0" data-f="oldPrice" value="${draft.oldPrice ?? ""}" placeholder="اختياري"></label>
      </div>
      <label class="field"><span>التصنيف</span><select data-f="cat">${catOpts}</select></label>
      <label class="field"><span>الصورة</span><select data-f="image">${imgOpts}</select></label>
      <label class="field"><span>أو ارفع صورة جديدة</span><input type="file" accept="image/jpeg,image/png,image/webp" data-upload></label>
      <div class="tagrow">${TAGS.map(([k, lbl]) => `<button type="button" data-tag="${k}" class="${draft.tags.includes(k) ? "is-on" : ""}">${lbl}</button>`).join("")}</div>
      <div class="price-row" style="border:0;padding-block-start:0">
        <span class="nm">متاح للطلب</span>
        <label class="sw"><input type="checkbox" data-f="available" ${draft.available === false ? "" : "checked"}><span></span></label>
      </div>
      <div style="display:flex;gap:10px;margin-block-start:14px">
        <button class="btn btn-primary" type="button" data-ok style="flex:1">${isNew ? "إضافة الصنف" : "تم"}</button>
        <button class="btn btn-ghost" type="button" data-close>إلغاء</button>
      </div>`;

    function paint() {
      sheet.querySelector("[data-pv-name]").textContent = draft.ar || "اسم الصنف";
      sheet.querySelector("[data-pv-desc]").textContent = draft.descAr || "";
      sheet.querySelector("[data-pv-price]").innerHTML =
        draft.price == null
          ? '<span style="font-size:.95rem;color:var(--dim)">اسأل</span>'
          : `${draft.price} ج${draft.oldPrice ? `<del>${draft.oldPrice}</del>` : ""}`;
      const box = sheet.querySelector("[data-pv-img]");
      box.innerHTML = draft.image ? `<img src="${esc(imgSrc(draft.image))}" alt="">` : "";
    }

    sheet.querySelectorAll("[data-f]").forEach((input) => {
      const key = input.dataset.f;
      input.addEventListener("input", () => {
        if (input.type === "checkbox") draft[key] = input.checked;
        else if (input.type === "number") draft[key] = input.value.trim() === "" ? null : Number(input.value);
        else draft[key] = input.value;
        paint();
      });
      input.addEventListener("change", () => {
        if (input.type === "checkbox") draft[key] = input.checked;
        else if (input.tagName === "SELECT") draft[key] = input.value;
        paint();
      });
    });

    sheet.querySelectorAll("[data-tag]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const k = btn.dataset.tag;
        draft.tags = draft.tags.includes(k) ? draft.tags.filter((x) => x !== k) : [...draft.tags, k];
        btn.classList.toggle("is-on");
      })
    );

    sheet.querySelector("[data-upload]").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      toast("بيرفع الصورة…");
      try {
        const res = await fetch(`/api/upload?name=${encodeURIComponent(draft.ar || "dish")}`, {
          method: "POST",
          headers: { "Content-Type": file.type, "x-admin-password": pw },
          body: file,
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status);
        const { url } = await res.json();
        draft.image = url;
        const sel = sheet.querySelector('[data-f="image"]');
        sel.insertAdjacentHTML("beforeend", `<option value="${esc(url)}" selected>صورة مرفوعة</option>`);
        sel.value = url;
        paint();
        toast("الصورة اترفعت ✓");
      } catch (err) {
        toast("رفع الصورة فشل: " + err.message, true);
      }
    });

    const close = () => bg.remove();
    sheet.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
    bg.addEventListener("click", (e) => e.target === bg && close());

    sheet.querySelector("[data-ok]").addEventListener("click", () => {
      if (!draft.ar.trim()) return toast("لازم اسم بالعربي", true);
      if (isNew) data.items.push(draft);
      else Object.assign(data.items.find((x) => x.id === draft.id), draft);
      markDirty();
      close();
      viewItems();
      toast(isNew ? "اتضاف ✓" : "اتعدّل ✓");
    });

    paint();
    bg.append(sheet);
    document.body.append(bg);
  }

  /* ---------- tab: التصنيفات ---------- */
  function viewCats() {
    const view = $("#view");
    view.innerHTML = "";
    const p = el("section", "panel");
    p.append(el("h2", null, "🗂️ التصنيفات"), el("p", "hint", "دي التابات اللي بتظهر فوق المنيو. الترتيب هنا هو الترتيب في الموقع."));

    const cats = [...data.categories].sort((a, b) => (a.order || 0) - (b.order || 0));
    cats.forEach((c, idx) => {
      const count = data.items.filter((i) => i.cat === c.id).length;
      const row = el("div", "item-row");
      row.innerHTML = `<span class="thumb">${c.iconAr || "🍽️"}</span>
        <span class="meta"><b>${esc(c.ar)}</b><small>${esc(c.en || "")} · ${count} صنف</small></span>
        <span class="acts">
          <button class="icon-btn" data-up ${idx === 0 ? "disabled" : ""}>↑</button>
          <button class="icon-btn" data-down ${idx === cats.length - 1 ? "disabled" : ""}>↓</button>
          <button class="icon-btn" data-edit>✏️</button>
          <button class="icon-btn" data-del>🗑️</button>
        </span>`;
      row.querySelector("[data-up]").addEventListener("click", () => {
        const o = cats[idx].order; cats[idx].order = cats[idx - 1].order; cats[idx - 1].order = o;
        markDirty(); viewCats();
      });
      row.querySelector("[data-down]").addEventListener("click", () => {
        const o = cats[idx].order; cats[idx].order = cats[idx + 1].order; cats[idx + 1].order = o;
        markDirty(); viewCats();
      });
      row.querySelector("[data-edit]").addEventListener("click", () => {
        const ar = prompt("الاسم بالعربي", c.ar); if (ar === null) return;
        const en = prompt("الاسم بالإنجليزي", c.en || ""); if (en === null) return;
        const ic = prompt("الإيموجي", c.iconAr || ""); if (ic === null) return;
        c.ar = ar.trim() || c.ar; c.en = en.trim(); c.iconAr = ic.trim();
        markDirty(); viewCats();
      });
      row.querySelector("[data-del]").addEventListener("click", () => {
        if (count) return alert(`فيه ${count} صنف في التصنيف ده. انقلهم أو امسحهم الأول.`);
        if (!confirm(`تحذف تصنيف «${c.ar}»؟`)) return;
        data.categories = data.categories.filter((x) => x.id !== c.id);
        markDirty(); viewCats();
      });
      p.append(row);
    });
    view.append(p);

    const addP = el("section", "panel");
    addP.innerHTML = `<h2>➕ تصنيف جديد</h2>
      <div class="row2">
        <label class="field"><span>بالعربي *</span><input id="ncAr" placeholder="مقليات"></label>
        <label class="field"><span>بالإنجليزي</span><input id="ncEn" placeholder="Fried"></label>
      </div>
      <label class="field"><span>إيموجي</span><input id="ncIc" placeholder="🍳" maxlength="4"></label>
      <button class="btn btn-ghost" type="button" id="ncAdd">إضافة</button>`;
    addP.querySelector("#ncAdd").addEventListener("click", () => {
      const ar = addP.querySelector("#ncAr").value.trim();
      if (!ar) return toast("اكتب الاسم بالعربي", true);
      data.categories.push({
        id: uid("c"), ar, en: addP.querySelector("#ncEn").value.trim(),
        iconAr: addP.querySelector("#ncIc").value.trim() || "🍽️", image: "",
        order: Math.max(0, ...data.categories.map((c) => c.order || 0)) + 1,
      });
      markDirty(); viewCats(); toast("اتضاف ✓");
    });
    view.append(addP);
  }

  /* ---------- tab: بيانات المطعم ---------- */
  function viewInfo() {
    const view = $("#view");
    const s = data.settings;
    view.innerHTML = "";

    const contact = el("section", "panel");
    contact.innerHTML = `<h2>📞 التواصل والتوصيل</h2>
      <div class="row2">
        <label class="field"><span>تليفون ١</span><input data-s="phone0" value="${esc(s.phones[0] || "")}" inputmode="tel"></label>
        <label class="field"><span>تليفون ٢</span><input data-s="phone1" value="${esc(s.phones[1] || "")}" inputmode="tel"></label>
      </div>
      <label class="field"><span>رقم الواتساب (بكود الدولة، من غير +)</span><input data-s="whatsapp" value="${esc(s.whatsapp)}" inputmode="tel" placeholder="201117161717"></label>
      <div class="row2">
        <label class="field"><span>سعر التوصيل</span><input type="number" data-s="deliveryFee" value="${s.deliveryFee ?? ""}"></label>
        <label class="field"><span>ملاحظة التوصيل (عربي)</span><input data-s="deliveryNoteAr" value="${esc(s.deliveryNoteAr || "")}"></label>
      </div>
      <label class="field"><span>ملاحظة التوصيل (إنجليزي)</span><input data-s="deliveryNoteEn" value="${esc(s.deliveryNoteEn || "")}"></label>`;

    const hours = el("section", "panel");
    hours.innerHTML = `<h2>🕐 مواعيد العمل</h2>
      <p class="hint">الموقع بيحسب «مفتوح الآن» من المواعيد دي. لو المطعم بيقفل بعد نص الليل اكتب القفل ٠٢:٠٠ عادي.</p>`;
    DAYS.forEach(([k, label]) => {
      const h = s.hours[k];
      const row = el("div", "price-row");
      row.innerHTML = `<span class="nm">${label}</span>
        <input type="time" value="${h ? h.open : ""}" data-day="${k}" data-part="open" style="width:132px;flex:none">
        <input type="time" value="${h ? h.close : ""}" data-day="${k}" data-part="close" style="width:132px;flex:none">
        <label class="sw"><input type="checkbox" data-day="${k}" data-part="on" ${h ? "checked" : ""}><span></span></label>`;
      hours.append(row);
    });
    const vrow = el("div", "price-row");
    vrow.innerHTML = `<span class="nm">المواعيد اتأكدت من المطعم<small>لو مقفول، بيظهر تحذير في الموقع</small></span>
      <label class="sw"><input type="checkbox" data-s="hoursVerified" ${s.hoursVerified ? "checked" : ""}><span></span></label>`;
    hours.append(vrow);

    const branches = el("section", "panel");
    branches.innerHTML = `<h2>📍 الفروع</h2>`;
    s.branches.forEach((b, i) => {
      const box = el("div");
      box.style.cssText = "border:1px solid var(--line);border-radius:12px;padding:14px;margin-block-end:12px";
      box.innerHTML = `
        <div class="row2">
          <label class="field"><span>اسم الفرع (عربي)</span><input data-b="${i}" data-bf="nameAr" value="${esc(b.nameAr)}"></label>
          <label class="field"><span>اسم الفرع (إنجليزي)</span><input data-b="${i}" data-bf="nameEn" value="${esc(b.nameEn)}"></label>
        </div>
        <label class="field"><span>العنوان (عربي)</span><input data-b="${i}" data-bf="addressAr" value="${esc(b.addressAr)}"></label>
        <label class="field"><span>العنوان (إنجليزي)</span><input data-b="${i}" data-bf="addressEn" value="${esc(b.addressEn)}"></label>
        <div class="row2">
          <label class="field"><span>تليفون الفرع</span><input data-b="${i}" data-bf="phone" value="${esc(b.phone)}" inputmode="tel"></label>
          <label class="field"><span>بحث الخريطة</span><input data-b="${i}" data-bf="mapQuery" value="${esc(b.mapQuery || "")}"></label>
        </div>
        <label class="field"><span>شارة (مثال: افتتاح جديد)</span><input data-b="${i}" data-bf="badgeAr" value="${esc(b.badgeAr || "")}"></label>
        <label class="field"><span>لينك خريطة جوجل (embed) — سيبه فاضي لو مش متأكد</span><input data-b="${i}" data-bf="mapEmbed" value="${esc(b.mapEmbed || "")}" placeholder="https://www.google.com/maps/embed?pb=..." dir="ltr"></label>`;
      branches.append(box);
    });

    view.append(contact, hours, branches);

    view.querySelectorAll("[data-s]").forEach((input) =>
      input.addEventListener("input", () => {
        const k = input.dataset.s;
        if (k === "phone0") s.phones[0] = input.value.trim();
        else if (k === "phone1") {
          const v = input.value.trim();
          if (v) s.phones[1] = v; else s.phones.length = 1;
        } else if (input.type === "checkbox") s[k] = input.checked;
        else if (input.type === "number") s[k] = input.value === "" ? null : Number(input.value);
        else s[k] = input.value;
        markDirty();
      })
    );
    view.querySelectorAll("[data-s]").forEach((input) =>
      input.addEventListener("change", () => { if (input.type === "checkbox") { s[input.dataset.s] = input.checked; markDirty(); } })
    );

    view.querySelectorAll("[data-day]").forEach((input) =>
      input.addEventListener("change", () => {
        const k = input.dataset.day, part = input.dataset.part;
        if (part === "on") {
          s.hours[k] = input.checked ? { open: "12:00", close: "02:00" } : null;
          markDirty();
          viewInfo();
          return;
        }
        if (!s.hours[k]) s.hours[k] = { open: "12:00", close: "02:00" };
        s.hours[k][part] = input.value;
        markDirty();
      })
    );

    view.querySelectorAll("[data-b]").forEach((input) =>
      input.addEventListener("input", () => {
        s.branches[+input.dataset.b][input.dataset.bf] = input.value;
        markDirty();
      })
    );
  }

  /* ---------- boot ---------- */
  const VIEWS = { prices: viewPrices, items: viewItems, cats: viewCats, info: viewInfo };

  function render() {
    $("#tabbar").querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", b.dataset.tab === tab));
    VIEWS[tab]();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function start() {
    const res = await fetch("/api/menu", { cache: "no-store" }).catch(() => null);
    data = res && res.ok ? await res.json() : await (await fetch("data/menu.json")).json();
    data.settings.phones = data.settings.phones || [];
    $("#lock").hidden = true;
    $("#app").hidden = false;
    markDirty(false);
    render();
  }

  $("#lockForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#lockBtn");
    btn.disabled = true;
    btn.textContent = "بيتأكد…";
    pw = $("#pw").value;
    // a tiny no-op write-check: ask the API whether this password is accepted
    const probe = await fetch("/api/menu", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-password": pw },
      body: "{}",
    }).catch(() => null);
    btn.disabled = false;
    btn.textContent = "دخول";
    // 400 = password fine but payload rejected (expected). 401 = wrong password.
    if (!probe || probe.status === 401) {
      $("#lockErr").hidden = false;
      return;
    }
    sessionStorage.setItem("mf_pw", pw);
    start();
  });

  $("#tabbar").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    tab = btn.dataset.tab;
    render();
  });

  $("#saveBtn").addEventListener("click", () => save());
  $("#logoutBtn").addEventListener("click", () => {
    if (dirty && !confirm("فيه تعديلات مش محفوظة. تخرج برضه؟")) return;
    sessionStorage.removeItem("mf_pw");
    location.reload();
  });

  window.addEventListener("beforeunload", (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  if (pw) start().catch(() => { sessionStorage.removeItem("mf_pw"); });
})();
