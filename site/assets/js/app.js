/* مهدي فود — front page runtime.
   Reads the live menu from /api/menu, falls back to the bundled copy so the
   page always renders a full menu even if the API is unreachable. */

(() => {
  const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const ORDERED_DAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];

  let lang = localStorage.getItem("mf_lang") || "ar";
  let data = null;
  let activeCat = null;

  const $ = (sel) => document.querySelector(sel);
  const t = (key) => (window.I18N[lang] || {})[key] ?? key;
  const num = (n) =>
    lang === "ar" ? String(n).replace(/\d/g, (d) => AR_DIGITS[+d]) : String(n);

  const imgSrc = (name) => (/^https?:\/\//.test(name) ? name : "assets/img/" + name);

  const pick = (obj, base) => (lang === "ar" ? obj[base + "Ar"] : obj[base + "En"]) || obj[base + "Ar"] || "";
  const pickShort = (obj) => (lang === "ar" ? obj.ar : obj.en) || obj.ar || "";

  /* ---------- data ---------- */
  async function load() {
    try {
      const res = await fetch("/api/menu", { cache: "no-store" });
      if (res.ok) {
        const live = await res.json();
        if (live && live.items) return live;
      }
    } catch (_) { /* offline or no API — use the bundled copy */ }
    const res = await fetch("data/menu.json", { cache: "no-store" });
    return res.json();
  }

  /* ---------- open / closed (always reckoned in Cairo, never the viewer's clock) ---------- */
  const TZ = "Africa/Cairo";

  function cairoParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ, hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit",
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type).value;
    const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get("weekday")];
    return { day: wd, minutes: +get("hour") * 60 + +get("minute") };
  }

  function hoursForDayIndex(i) {
    return (data.settings.hours || {})[DAY_KEYS[(i + 7) % 7]] || null;
  }

  function minutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function openState() {
    const now = cairoParts();
    const nowMin = now.minutes;
    const today = hoursForDayIndex(now.day);
    const yest = hoursForDayIndex(now.day - 1);

    // a shift that closes after midnight still counts as yesterday's shift
    if (yest && minutes(yest.close) < minutes(yest.open) && nowMin < minutes(yest.close)) {
      return { open: true, until: yest.close };
    }
    if (!today) return { open: false, next: null };
    const o = minutes(today.open);
    const c = minutes(today.close);
    const spansMidnight = c < o;
    const isOpen = spansMidnight ? nowMin >= o : nowMin >= o && nowMin < c;
    return { open: isOpen, next: today.open, until: today.close };
  }

  function renderStatus() {
    const st = openState();
    const dot = $("#statusDot");
    const txt = $("#statusText");
    if (!dot || !txt) return;
    dot.classList.toggle("is-closed", !st.open);
    if (st.open) {
      txt.textContent = t("openNow");
    } else {
      txt.textContent = st.next ? `${t("closedNow")} · ${t("opensAt")} ${num(st.next)}` : t("closedNow");
    }
  }

  /* ---------- renderers ---------- */
  function renderPrices() {
    const grid = $("#boardGrid");
    const rows = [...data.daily]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((f) => {
        const out = f.available === false;
        const priceCell = out
          ? `<span class="fish-ask">${t("unavailable")}</span>`
          : f.price
          ? `<span class="fish-price">${num(f.price)}<small>${t("egp")}</small></span>`
          : `<span class="fish-ask">${t("ask")}</span>`;
        return `<div class="fish${out ? " is-out" : ""}">
          <span class="fish-name">${pickShort(f)}${
            lang === "ar" && f.en ? `<span class="fish-en">${f.en}</span>` : ""
          }</span>${priceCell}
        </div>`;
      })
      .join("");
    grid.innerHTML = rows;

    const stamp = $("#priceStamp");
    const when = data.pricesUpdatedAt ? new Date(data.pricesUpdatedAt) : null;
    if (stamp && when && !isNaN(when)) {
      const dayOf = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
      const hhmm = new Intl.DateTimeFormat("en-GB", {
        timeZone: TZ, hour12: false, hour: "2-digit", minute: "2-digit",
      }).format(when);
      const sameDay = dayOf(when) === dayOf(new Date());
      stamp.textContent = sameDay
        ? (lang === "ar" ? `النهاردة ${num(hhmm)}` : `today ${hhmm}`)
        : new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", { timeZone: TZ }).format(when);
    }
  }

  function chipsFor(item) {
    const chips = [];
    if (item.available === false) chips.push(`<span class="chip chip-out">${t("unavailable")}</span>`);
    (item.tags || []).forEach((tag) => {
      if (["bestseller", "offer", "signature"].includes(tag)) {
        chips.push(`<span class="chip chip-${tag}">${t(tag)}</span>`);
      }
    });
    return chips.length ? `<div class="chips">${chips.join("")}</div>` : "";
  }

  function priceBlock(item) {
    if (item.price == null) return `<span class="price-ask">${t("ask")}</span>`;
    const old = item.oldPrice ? `<span class="price-old">${num(item.oldPrice)}</span>` : "";
    return `<span class="price">${num(item.price)}<small>${t("egp")}</small></span>${old}`;
  }

  function renderTabs() {
    const tabs = $("#tabs");
    const cats = [...data.categories].sort((a, b) => (a.order || 0) - (b.order || 0));
    if (!activeCat || !cats.some((c) => c.id === activeCat)) activeCat = cats[0]?.id;
    tabs.innerHTML = cats
      .map(
        (c) => `<button class="tab${c.id === activeCat ? " is-on" : ""}" role="tab" data-cat="${c.id}">
          <span>${c.iconAr || ""}</span><span>${pickShort(c)}</span>
        </button>`
      )
      .join("");
    tabs.querySelectorAll(".tab").forEach((btn) =>
      btn.addEventListener("click", () => {
        activeCat = btn.dataset.cat;
        renderTabs();
        renderMenu();
      })
    );
  }

  function renderMenu() {
    const grid = $("#menuGrid");
    const items = data.items
      .filter((i) => i.cat === activeCat)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (!items.length) {
      grid.innerHTML = `<p style="color:var(--foam-faint)">—</p>`;
      return;
    }

    grid.innerHTML = items
      .map((item) => {
        const cat = data.categories.find((c) => c.id === item.cat);
        // no photo of its own? borrow the category's, so cards never sit half-empty
        const photo = item.image || (cat && cat.image) || "";
        const img = photo
          ? `<div class="dish-img"><img src="${imgSrc(photo)}" alt="${pickShort(item)}" loading="lazy"></div>`
          : `<div class="dish-noimg">${(cat && cat.iconAr) || "🐟"}</div>`;
        const desc = pick(item, "desc");
        return `<article class="dish reveal is-in">
          ${chipsFor(item)}
          ${img}
          <div class="dish-body">
            <h3 class="dish-name">${pickShort(item)}</h3>
            ${lang === "ar" && item.en ? `<span class="dish-en">${item.en}</span>` : ""}
            ${desc ? `<p class="dish-desc">${desc}</p>` : ""}
            <div class="dish-foot">${priceBlock(item)}</div>
          </div>
        </article>`;
      })
      .join("");
  }

  function renderGallery() {
    $("#galGrid").innerHTML = (data.gallery || [])
      .map(
        (g) => `<figure class="gal-item">
          <img src="${imgSrc(g.image)}" alt="${pick(g, "caption")}" loading="lazy">
          <figcaption class="gal-cap">${pick(g, "caption")}</figcaption>
        </figure>`
      )
      .join("");
  }

  function renderBranches() {
    $("#branchGrid").innerHTML = (data.settings.branches || [])
      .map((b) => {
        const q = encodeURIComponent(b.mapQuery || pick(b, "address"));
        const badge = pick(b, "badge");
        // an embed only goes in when the restaurant has given us a real pin;
        // otherwise we show the address plainly instead of guessing a location
        const map = b.mapEmbed
          ? `<iframe src="${b.mapEmbed}" loading="lazy" title="${pick(b, "name")}"
               referrerpolicy="no-referrer-when-downgrade"></iframe>`
          : `<div class="branch-pin">
               <span class="dot">📍</span>
               <span class="where">${pick(b, "address")}</span>
               <span class="sub">${t("tapDirections")}</span>
             </div>`;
        return `<article class="branch">
          <div class="branch-map">${map}</div>
          <div class="branch-body">
            <h3>${pick(b, "name")}${badge ? `<span class="branch-badge">${badge}</span>` : ""}</h3>
            <p class="branch-addr">📍 ${pick(b, "address")}</p>
            <div class="branch-acts">
              <a class="btn btn-primary" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">${t("directions")}</a>
              <a class="btn btn-ghost" href="tel:${b.phone}">${t("callBranch")}</a>
            </div>
          </div>
        </article>`;
      })
      .join("");
  }

  function renderHours() {
    const todayKey = DAY_KEYS[cairoParts().day];
    $("#hoursList").innerHTML = ORDERED_DAYS.map((k) => {
      const h = (data.settings.hours || {})[k];
      const val = h ? `${num(h.open)} — ${num(h.close)}` : t("closedDay");
      return `<div class="hours-row${k === todayKey ? " is-today" : ""}">
        <span>${t("days")[k]}</span><span>${val}</span>
      </div>`;
    }).join("");
    $("#hoursWarn").hidden = data.settings.hoursVerified !== false;

    $("#phoneList").innerHTML = (data.settings.phones || [])
      .map((p) => `<div class="hours-row"><span>☎️</span><a href="tel:${p}" style="direction:ltr">${p}</a></div>`)
      .join("") +
      (data.settings.deliveryNoteAr
        ? `<div class="hours-row"><span>🛵</span><span>${pick(data.settings, "deliveryNote")}</span></div>`
        : "");
  }

  function renderLinks() {
    const s = data.settings;
    const wa = `https://wa.me/${s.whatsapp}?text=${encodeURIComponent(t("waMsg"))}`;
    ["#heroWa", "#contactWa", "#barWa", "#footWa"].forEach((sel) => {
      const el = $(sel);
      if (el) el.href = wa;
    });
    const tel = `tel:${(s.phones || [])[0] || ""}`;
    ["#headCall", "#barCall"].forEach((sel) => {
      const el = $(sel);
      if (el) el.href = tel;
    });
    if (s.facebook) $("#fbLink").href = s.facebook;
    if (s.instagram) $("#igLink").href = s.instagram;
  }

  /* ---------- language ---------- */
  function applyStaticStrings() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const val = t(el.dataset.i18n);
      if (typeof val === "string") el.innerHTML = val;
    });
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.body.dir = lang === "ar" ? "rtl" : "ltr";
    $("#langLabel").textContent = lang === "ar" ? "EN" : "ع";
    document.title =
      lang === "ar"
        ? "مهدي فود | مطعم أسماك ومشويات بحرية — برج العرب الجديدة"
        : "Mahdy Food | Seafood restaurant & charcoal grill — New Borg El Arab";
  }

  function renderAll() {
    applyStaticStrings();
    renderStatus();
    renderPrices();
    renderTabs();
    renderMenu();
    renderGallery();
    renderBranches();
    renderHours();
    renderLinks();
  }

  /* ---------- chrome ---------- */
  function initChrome() {
    const head = $("#head");
    const onScroll = () => head.classList.toggle("is-stuck", window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    $("#langBtn").addEventListener("click", () => {
      lang = lang === "ar" ? "en" : "ar";
      try { localStorage.setItem("mf_lang", lang); } catch (_) {}
      renderAll();
    });

    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("is-in")),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  }

  load()
    .then((d) => {
      data = d;
      renderAll();
      initChrome();
      setInterval(renderStatus, 60000);
    })
    .catch((err) => {
      console.error("menu load failed", err);
      document.body.insertAdjacentHTML(
        "afterbegin",
        '<p style="padding:90px 20px 20px;text-align:center">تعذّر تحميل المنيو. حدّث الصفحة من فضلك.</p>'
      );
    });
})();
