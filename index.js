const menuList = document.getElementById("menu-list");
const searchInput = document.getElementById("menu-search");
const sortSelect = document.getElementById("menu-sort");
const countLabel = document.getElementById("menu-count");
const totalLabel = document.getElementById("menu-total");
let menus = [];
let searchTerm = "";
let sortMode = "featured";
let loadSequence = 0;
let favorites = readStore("crispy-favorites", []);
let cart = readStore("crispy-cart", {});
let compareIds = [];
let showFavorites = false;
let soundEnabled = false;
let challengeIndex = 0;
const is67Mode = () => document.body.classList.contains("meme-overdrive");

function initializeCustomDropdowns(root = document) {
  root.querySelectorAll("select:not([data-custom-dropdown])").forEach(select => {
    const wrapper = document.createElement("span");
    wrapper.className = "custom-dropdown";
    wrapper.dataset.customDropdown = "";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-dropdown__trigger";
    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.id = `${select.id || "dropdown"}-trigger`;
    const list = document.createElement("div");
    list.className = "custom-dropdown__list";
    list.id = `${select.id || "dropdown"}-options`;
    list.setAttribute("role", "listbox");
    list.hidden = true;
    trigger.setAttribute("aria-controls", list.id);

    const label = select.closest("label") || select.parentElement;
    const labelText = label?.querySelector(":scope > span")?.textContent.trim()
      || [...(label?.childNodes || [])].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join("").trim();
    trigger.setAttribute("aria-label", labelText || select.getAttribute("aria-label") || "เลือกค่า");

    function chooseOption(value, restoreFocus = true) {
      if (select.value !== value) {
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      close(restoreFocus);
    }

    const options = [...select.options].map((option, index) => {
      const item = document.createElement("div");
      item.className = "custom-dropdown__option";
      item.id = `${list.id}-${index}`;
      item.dataset.value = option.value;
      item.textContent = option.textContent.trim();
      item.setAttribute("role", "option");
      item.tabIndex = -1;
      list.append(item);
      item.addEventListener("pointerdown", event => {
        event.preventDefault();
        chooseOption(option.value);
      });
      item.addEventListener("click", event => {
        event.preventDefault();
        chooseOption(option.value);
      });
      item.addEventListener("pointermove", () => setActive(index));
      return item;
    });

    let activeIndex = Math.max(0, [...select.options].findIndex(option => option.value === select.value));
    function sync() {
      const selectedIndex = [...select.options].findIndex(option => option.value === select.value);
      trigger.textContent = select.options[selectedIndex]?.textContent.trim() || "";
      trigger.disabled = select.disabled;
      trigger.classList.toggle("is-67", select.value === "67");
      options.forEach((option, index) => option.setAttribute("aria-selected", String(index === selectedIndex)));
    }
    function setActive(index) {
      activeIndex = (index + options.length) % options.length;
      options.forEach((option, optionIndex) => option.classList.toggle("is-active", optionIndex === activeIndex));
      trigger.setAttribute("aria-activedescendant", options[activeIndex].id);
    }
    function open() {
      if (select.disabled) return;
      list.hidden = false;
      const bounds = trigger.getBoundingClientRect();
      const spaceAbove = bounds.top;
      const spaceBelow = window.innerHeight - bounds.bottom;
      const listHeight = Math.min(list.scrollHeight || options.length * 40, window.innerHeight * .5);
      const opensUp = wrapper.closest(".arcade") || (spaceBelow < listHeight + 12 && spaceAbove > spaceBelow);
      list.classList.toggle("opens-up", Boolean(opensUp));
      wrapper.closest(".arcade")?.classList.add("is-dropdown-open");
      trigger.setAttribute("aria-expanded", "true");
      activeIndex = Math.max(0, [...select.options].findIndex(option => option.value === select.value));
      setActive(activeIndex);
    }
    function close(restoreFocus = false) {
      list.hidden = true;
      wrapper.closest(".arcade")?.classList.remove("is-dropdown-open");
      trigger.setAttribute("aria-expanded", "false");
      trigger.removeAttribute("aria-activedescendant");
      options.forEach(option => option.classList.remove("is-active"));
      if (restoreFocus) trigger.focus();
    }
    function commitActive() {
      const option = select.options[activeIndex];
      if (!option || option.disabled) return;
      chooseOption(option.value, false);
    }

    trigger.addEventListener("click", event => {
      event.preventDefault();
      if (list.hidden) open();
      else close();
    });
    trigger.addEventListener("keydown", event => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (list.hidden) open();
        else setActive(activeIndex + (event.key === "ArrowDown" ? 1 : -1));
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        if (list.hidden) open();
        setActive(event.key === "Home" ? 0 : options.length - 1);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (list.hidden) open();
        else commitActive();
      } else if (event.key === "Escape" && !list.hidden) {
        event.preventDefault();
        close();
      }
    });
    trigger.addEventListener("blur", () => close());
    document.addEventListener("pointerdown", event => {
      if (!wrapper.contains(event.target)) close();
    });
    select.addEventListener("change", sync);
    const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    const disabledDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "disabled");
    Object.defineProperty(select, "value", {
      configurable: true,
      get() { return valueDescriptor.get.call(this); },
      set(value) { valueDescriptor.set.call(this, value); sync(); }
    });
    Object.defineProperty(select, "disabled", {
      configurable: true,
      get() { return disabledDescriptor.get.call(this); },
      set(value) { disabledDescriptor.set.call(this, value); sync(); }
    });

    select.dataset.customDropdown = "true";
    select.classList.add("custom-dropdown__native");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(select, trigger, list);
    sync();
  });
}

initializeCustomDropdowns();

(() => {
  const section = document.querySelector(".story-section");
  if (!section) return;
  const buttons = [...section.querySelectorAll("[data-story-view]")];
  const fullStory = section.querySelector(".story-full");
  const timeline = section.querySelector(".story-timeline");

  buttons.forEach(button => button.addEventListener("click", () => {
    const showTimeline = button.dataset.storyView === "timeline";
    fullStory.hidden = showTimeline;
    timeline.hidden = !showTimeline;
    buttons.forEach(option => {
      const active = option === button;
      option.classList.toggle("is-active", active);
      option.setAttribute("aria-pressed", String(active));
    });
  }));
})();

function readStore(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function safeId(item, index) {
  return String(item.id ?? `${item.productName}-${index}`);
}

let _notifyTimer = null;
function notify(message) {
  const box = document.getElementById("fun-message");
  box.textContent = message;
  box.classList.remove("is-visible");
  // force reflow so re-adding the class restarts any CSS transition
  void box.offsetWidth;
  box.classList.add("is-visible");
  // auto-dismiss after 4 s
  clearTimeout(_notifyTimer);
  _notifyTimer = setTimeout(() => box.classList.remove("is-visible"), 4000);
  if (soundEnabled) {
    try {
      const audio = new AudioContext();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value = 520;
      gain.gain.setValueAtTime(.06, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .13);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + .13);
      oscillator.onended = () => audio.close();
    } catch { }
  }
}
// click the popup to dismiss it early
document.getElementById("fun-message")?.addEventListener("click", () => {
  clearTimeout(_notifyTimer);
  document.getElementById("fun-message").classList.remove("is-visible");
});


function renderCart() {
  const entries = Object.entries(cart).filter(([, quantity]) => quantity > 0);
  const itemCount = entries.reduce((sum, [, quantity]) => sum + quantity, 0);
  const total = entries.reduce((sum, [id, quantity]) => {
    const item = menus.find((menu, index) => safeId(menu, index) === id);
    return sum + Number(item?.price || 0) * quantity;
  }, 0);
  document.getElementById("cart-summary").textContent = entries.length
    ? `${itemCount} ชิ้น · รวม ฿${total.toLocaleString("th-TH")} · ${entries.map(([id, quantity]) => `${menus.find((menu, index) => safeId(menu, index) === id)?.productName || "เมนู"} ×${quantity}`).join(" / ")}`
    : "ยังไม่มีเมนูในตะกร้า";
}

function updateCounters() {
  document.getElementById("favorite-count").textContent = favorites.length;
  document.getElementById("compare-count").textContent = `${compareIds.length}/2`;
  renderCart();
}

function renderMenus() {
  let filtered = menus.filter(item => String(item.productName || "").toLocaleLowerCase("th").includes(searchTerm));
  const budget = Number(document.getElementById("budget-input").value);
  if (Number.isFinite(budget) && budget > 0) filtered = filtered.filter(item => Number(item.price) <= budget);
  if (showFavorites) filtered = filtered.filter((item, index) => favorites.includes(safeId(item, index)));
  if (sortMode === "price-asc") filtered.sort((a, b) => Number(a.price) - Number(b.price));
  if (sortMode === "price-desc") filtered.sort((a, b) => Number(b.price) - Number(a.price));
  if (sortMode === "name") filtered.sort((a, b) => String(a.productName || "").localeCompare(String(b.productName || ""), "th"));

  menuList.replaceChildren();
  countLabel.textContent = `แสดง ${filtered.length} จาก ${menus.length} เมนู`;
  totalLabel.textContent = `มี ${menus.length} ความอร่อยให้เลือก`;

  if (!filtered.length) {
    const row = document.createElement("tr");
    row.className = "menu-loading";
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.innerHTML = '<span class="loading-mark">⌕</span><span>ไม่พบเมนูที่ค้นหา</span><small>ลองเปลี่ยนคำค้นหาแล้วค้นหาอีกครั้ง</small>';
    row.append(cell);
    menuList.append(row);
    return;
  }

  filtered.forEach((item, index) => {
    const row = document.createElement("tr");
    const itemId = safeId(item, menus.indexOf(item));
    const name = document.createElement("td");
    const title = document.createElement("span");
    title.textContent = item.productName || "เมนูอร่อย";
    const favoriteButton = document.createElement("button");
    favoriteButton.type = "button";
    favoriteButton.className = "row-action favorite-action";
    favoriteButton.textContent = favorites.includes(itemId) ? "♥" : "♡";
    favoriteButton.setAttribute("aria-label", "สลับเมนูโปรด");
    favoriteButton.addEventListener("click", () => {
      favorites = favorites.includes(itemId) ? favorites.filter(id => id !== itemId) : [...favorites, itemId];
      localStorage.setItem("crispy-favorites", JSON.stringify(favorites));
      updateCounters();
      renderMenus();
    });
    const cartButton = document.createElement("button");
    cartButton.type = "button";
    cartButton.className = "row-action cart-action";
    cartButton.textContent = `＋ ตะกร้า ${cart[itemId] ? `(${cart[itemId]})` : ""}`;
    cartButton.addEventListener("click", () => {
      cart[itemId] = (cart[itemId] || 0) + 1;
      localStorage.setItem("crispy-cart", JSON.stringify(cart));
      updateCounters();
      renderMenus();
      notify(`เพิ่ม ${item.productName} ลงตะกร้าแล้ว`);
    });
    const compareButton = document.createElement("button");
    compareButton.type = "button";
    compareButton.className = "row-action compare-action";
    compareButton.textContent = compareIds.includes(itemId) ? "✓ เลือกแล้ว" : "⚖ เทียบ";
    compareButton.addEventListener("click", () => {
      if (compareIds.includes(itemId)) compareIds = compareIds.filter(id => id !== itemId);
      else if (compareIds.length < 2) compareIds.push(itemId);
      else { notify("เลือกเทียบได้ครั้งละ 2 เมนูนะ"); return; }
      updateCounters();
      renderMenus();
      if (compareIds.length === 2) {
        const chosen = compareIds.map(id => menus.find((menu, index) => safeId(menu, index) === id));
        notify(`${chosen[0].productName} ฿${chosen[0].price} เทียบกับ ${chosen[1].productName} ฿${chosen[1].price}`);
      }
    });
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "row-action delete-action";
    deleteButton.textContent = "ลบ ×";
    deleteButton.setAttribute("aria-label", `ลบเมนู ${item.productName} จากฐานข้อมูล`);
    deleteButton.addEventListener("click", () => deleteMenuFromDatabase(item));
    name.append(title, favoriteButton, cartButton, compareButton, deleteButton);
    const amount = document.createElement("td");
    amount.textContent = `${item.amount ?? 1} ชิ้น`;
    const price = document.createElement("td");
    price.textContent = `฿${Number(item.price || 0).toLocaleString("th-TH")}`;
    const imageCell = document.createElement("td");
    const image = document.createElement("img");
    image.src = item.imageURL || "";
    image.alt = item.productName || "ภาพเมนูอาหาร";
    image.loading = "lazy";
    image.onerror = () => { imageCell.textContent = "ภาพเมนู"; imageCell.classList.add("image-fallback"); };
    imageCell.append(image);
    row.append(name, amount, price, imageCell);
    row.style.setProperty("--row-index", index);
    menuList.append(row);
  });
}

async function deleteMenuFromDatabase(item) {
  const confirmed = window.confirm(`ยืนยันลบ “${item.productName}” ออกจากฐานข้อมูลจริง?\n\nการลบนี้มีผลกับทุกคนและย้อนกลับไม่ได้`);
  if (!confirmed) return;

  try {
    const response = await fetch(`/menu/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "ลบเมนูไม่สำเร็จ");
    const itemId = String(item.id);
    favorites = favorites.filter(id => id !== itemId);
    delete cart[itemId];
    compareIds = compareIds.filter(id => id !== itemId);
    localStorage.setItem("crispy-favorites", JSON.stringify(favorites));
    localStorage.setItem("crispy-cart", JSON.stringify(cart));
    await loadMenus();
    notify(`ลบ “${item.productName}” ออกจากฐานข้อมูลแล้ว`);
  } catch (error) {
    notify(error.message);
  }
}

async function loadMenus() {
  const sequence = ++loadSequence;
  const button = document.getElementById("menu-refresh");
  button.disabled = true;
  button.textContent = "กำลังโหลด...";
  countLabel.textContent = "กำลังเตรียมเมนู...";
  try {
    const response = await fetch("/menu", { cache: "no-store" });
    if (!response.ok) throw new Error("โหลดเมนูไม่สำเร็จ");
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("ข้อมูลเมนูไม่ถูกต้อง");
    if (sequence !== loadSequence) return;
    menus = data;
    renderMenus();
    updateCounters();
    const params = new URLSearchParams(location.search);
    const shared = params.get("pick");
    if (shared) {
      const sharedItem = menus.find((item, index) => safeId(item, index) === shared);
      if (sharedItem) notify(`เพื่อนแชร์เมนู ${sharedItem.productName} · ฿${sharedItem.price} มาให้!`);
    }
  } catch (error) {
    if (sequence !== loadSequence) return;
    menuList.replaceChildren();
    countLabel.textContent = "เชื่อมต่อเมนูไม่ได้";
    totalLabel.textContent = "ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง";
    const row = document.createElement("tr");
    row.className = "menu-loading";
    row.innerHTML = '<td colspan="4"><span class="loading-mark">!</span><span>THE KITCHEN IS OFFLINE</span><small>กดปุ่มโหลดเมนูใหม่เพื่อลองอีกครั้ง</small></td>';
    menuList.append(row);
  } finally {
    if (sequence === loadSequence) {
      button.disabled = false;
      button.textContent = "โหลดเมนูใหม่ ↻";
    }
  }
}

searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.trim().toLocaleLowerCase("th");
  renderMenus();
});
sortSelect.addEventListener("change", () => {
  sortMode = sortSelect.value;
  renderMenus();
});
document.getElementById("menu-refresh").addEventListener("click", loadMenus);
document.getElementById("budget-input").addEventListener("input", renderMenus);
document.getElementById("favorites-filter").addEventListener("click", event => {
  showFavorites = !showFavorites;
  event.currentTarget.classList.toggle("is-active", showFavorites);
  renderMenus();
});
document.getElementById("cart-clear").addEventListener("click", () => {
  cart = {};
  localStorage.setItem("crispy-cart", JSON.stringify(cart));
  updateCounters();
  renderMenus();
  notify("ล้างตะกร้าเรียบร้อย");
});
document.getElementById("random-menu").addEventListener("click", () => {
  if (!menus.length) return notify("เมนูยังโหลดไม่เสร็จ");
  const item = menus[Math.floor(Math.random() * menus.length)];
  notify(`🎲 วันนี้จัด ${item.productName} ราคา ฿${item.price} ไปเลย!`);
});
document.getElementById("challenge-menu").addEventListener("click", () => {
  const challenges = ["เลือกของอร่อยไม่เกิน 60 บาท", "เพิ่มของกินเล่นอีกหนึ่งอย่าง", "เลือกเมนูที่ไม่เคยลอง", "จัดเซ็ตให้ครบทั้งคาวและเครื่องดื่ม"];
  notify(`ภารกิจ #${++challengeIndex}: ${challenges[(challengeIndex - 1) % challenges.length]}`);
});
document.getElementById("party-plan").addEventListener("click", () => {
  if (!menus.length) return notify("เมนูยังโหลดไม่เสร็จ");
  const people = Math.max(1, Number(document.getElementById("party-input").value) || 1);
  const pick = [...menus].sort((a, b) => Number(a.price) - Number(b.price)).slice(0, people);
  const total = pick.reduce((sum, item) => sum + Number(item.price || 0), 0);
  notify(`🍗 ปาร์ตี้ ${people} คน: ${pick.map(item => item.productName).join(" + ")} · รวม ฿${total} (เฉลี่ย ฿${Math.ceil(total / people)}/คน)`);
});
document.getElementById("compare-mode").addEventListener("click", () => {
  notify(compareIds.length ? `เลือกแล้ว ${compareIds.length} เมนู · กด ⚖ เทียบ ที่แถวเมนูเพื่อเลือกได้ครบ 2` : "กด ⚖ เทียบ บนเมนู 2 รายการเพื่อเทียบกัน");
});
document.getElementById("sound-toggle").addEventListener("click", event => {
  soundEnabled = !soundEnabled;
  event.currentTarget.textContent = soundEnabled ? "🔊 เสียงเปิด" : "🔇 เสียงปิด";
  event.currentTarget.setAttribute("aria-pressed", String(soundEnabled));
  notify(soundEnabled ? "เปิดเสียงเอฟเฟกต์แล้ว" : "ปิดเสียงเอฟเฟกต์แล้ว");
});
document.getElementById("mood-select").addEventListener("change", event => {
  document.body.dataset.mood = event.target.value;
  notify(`เปลี่ยนเป็นโหมด ${event.target.selectedOptions[0].textContent} แล้ว`);
});
document.getElementById("share-menu").addEventListener("click", async () => {
  if (!menus.length) return notify("เมนูยังโหลดไม่เสร็จ");
  const item = menus[Math.floor(Math.random() * menus.length)];
  const url = `${location.origin}${location.pathname}?pick=${encodeURIComponent(safeId(item, menus.indexOf(item)))}`;
  try {
    await navigator.clipboard.writeText(url);
    notify(`คัดลอกลิงก์เมนู ${item.productName} แล้ว`);
  } catch {
    window.prompt("คัดลอกลิงก์นี้เพื่อแชร์", url);
  }
});
const hungerLines = ["แค่มองเฉย ๆ ไม่ได้แปลว่าหิวนะ (แต่เปิดตะกร้ารอไว้แล้ว)", "ระดับนี้ควรปรึกษาผู้เชี่ยวชาญด้านไก่ทอด", "หิวจนได้ยินเสียงกรอบจากหน้าจอแล้วหรือยัง?", "ท้องร้องเป็นจังหวะเพลงเปิดตัวไก่ทอด", "ระบบแนะนำให้กินก่อนเริ่มกินหน้าจอ"];
const fortunes = [
  // Original
  "โชคชะตาบอกว่า... ไก่ทอดอยู่ใกล้กว่าที่คิด",
  "วันนี้ดวงการเงินดี แต่ดวงหิวดีกว่า",
  "เลขนำโชค 2 ชิ้น (สั่ง 4 ก็ไม่ว่ากัน)",
  "เนื้อคู่ของคุณอาจเป็นหนังไก่กรอบ",
  "ระวัง! อาจเผลอสั่งเพิ่มอีกหนึ่งเมนู",
  "คำทำนาย: ความสุขจะมาในกล่องกระดาษ",
  // เพิ่มเติม - ใบเสี่ยงทายไก่ทอด
  "ดวงหิวระดับ 'เลgende' — ควรสั่งถังใหญ่เลย",
  "จะมีโอกาสกินฟรี... ถ้าเพื่อนจ่ายให้ (ขอโทษ)",
  "เลขเด็ดวันนี้: 6-7-67 (ราคาไก่ทอดชิ้นละ 67)",
  "คำทำนาย: คุณจะหยิบชิ้นสุดท้ายในถัง... และไม่ต้องแชร์!",
  "ดวงโชค: เจอซอสพิเศษที่ร้านยังไม่ได้เปิดขาย",
  "วันนี้เหมาะกับการ... สั่งเพิ่ม皮 (หนังไก่) ฟรี",
  "ระวัง! อาจกินจนลืมว่าเคยต้องการลดน้ำหนัก",
  "คำทำนาย: ความกรอบจะเข้าสู่หัวใจคุณตอน 3 ทุ่ม",
  "ดวงการเงิน: เงินเข้า แล้วออกไปเป็น 'ค่ากล่องไก่ทอด'",
  "จะมีคนสำคัญเข้ามาในชีวิต... คือพนักงานส่งอาหาร",
  "เลขนำโชค: จำนวนชิ้นไก่ที่คุณจะกินวันนี้",
  "ดวงหิว: จะเพิ่มขึ้น 300% หลังดูเมนูเว็บนี้",
  "คำทำนาย: คุณจะกลายเป็น 'ผู้เชี่ยวชาญด้านไก่ทอด' ในกลุ่มเพื่อน",
  "วันนี้ดวง 'แชร์อาหาร' อ่อนแอ — กินเองดีกว่า",
  "โชคลาภ: ได้กินชิ้นที่กรอบที่สุดในถัง",
  "ระวัง! อาจสั่งเครื่องดื่มเพิ่มเพราะเผ็ดเกินไหว",
  "คำทำนาย: ความสุขวันนี้อยู่ที่... มุมปากของคุณ (ขณะกินไก่)",
  "ดวงสุขภาพ: ท้องจะอิ่ม หัวใจจะอบอุ่น (จากไก่ร้อนๆ)",
  "จะมีโอกาส... ได้ลองซอสใหม่ที่ยังไม่เคยลอง",
  "67 บอกว่า: 'กินไก่ทอดให้มากที่สุด จนกว่าจะไม่กินได้แล้ว'",
];
const eatingTypes = [
  // Original
  "นักวางแผน: เปิดเมนู 20 นาที สั่งเมนูเดิม",
  "นักผจญภัย: ชี้เมนูมั่ว ๆ แล้วหวังว่าจะอร่อย",
  "สายแบ่ง: บอกกินนิดเดียว แต่ขอชิมทุกอย่าง",
  "นักสะสม: สั่งครบเหมือนกำลังทำภารกิจ",
  "สายคุ้ม: คิดราคาต่อชิ้นเร็วกว่าคิดเลขในห้องเรียน",
  "ผู้เชี่ยวชาญ: แค่เห็นรูปก็รู้ว่าควรสั่งอะไร",
  // เพิ่มเติม - นิสัยการกิน
  "สายหิวโหด: เปิดตู้เย็น 10 ครั้ง/ชม. แม้รู้ว่าว่าง",
  "นักโซเชียล: ถ่ายรูปอาหาร 50 รูป กิน 1 ชิ้น",
  "สายคุ้มค่า: คำนวณราคาต่อกรัม ไก่ทอด ก่อนสั่ง",
  "ผู้พิฆาต: สั่งเผ็ดสุด แล้วขอน้ำแข็ง 3 ถ้วย",
  "นักล่าซอส: ทดลองซอสทุกชนิด จนรู้สูตรลับ",
  "สายอิ่มเร็ว: สั่งมาก กิน 2 ชิ้น แล้วบอก 'อิ่มแล้ว'",
  "ผู้เชี่ยวชาญแท้: รู้ว่าวันไหนไก่ทอดกรอบที่สุด (คือทุกวัน)",
  "สายแบ่งปัน: สั่ง 1 ถัง แบ่ง 4 คน เองกิน 3 ชิ้น",
  "นักล่าโปรโมชั่น: รู้วันไหนมีโปรโมชั่น ไหนไม่มี",
  "สายขี้เกียจ: สั่งเดลิเวอรี่ แม้ร้านอยู่ใกล้บ้าน 50 เมตร",
  "ผู้กินแบบเร็ว: จบถังไก่ใน 5 นาที แล้วถาม 'กินไรต่อ'",
  "สายเลือกยาก: อยู่หน้าร้าน 30 นาที ยังสั่งไม่รอด",
  "นักทดสอบ: สั่งเมนูใหม่ทุกครั้ง ไม่เคยซ้ำ",
  "สายหิวตอนดึก: สั่งอาหาร 2 ทุ่ม กลางคืน",
  "ผู้เชี่ยวชาญหนังไก่: แยกหนังไก่กินก่อน ทิ้งเนื้อ (ผิดกฎหมาย)",
  "สายผสม: ไก่ทอด + ข้าวเหนียว + น้ำมาม่า = จบเลย",
  "นักสะสมแต้ม: สั่งผ่าน App ทุกครั้ง แลกของฟรีทุกอย่าง",
  "สาย 'กินเอง': ไม่อยากแบ่ง แม้เพื่อนขอแค่ 1 ชิ้น",
  "ผู้รู้ค่า: กินไก่ทอดร้อนๆ ถึงรสชาติจริง",
  "สายชิล: กินไก่ทอดขณะดูซีรีส์ นั่งขาไว้โต๊ะ",
];
const fortunesOfLife = [
  // Original
  "พรุ่งนี้คุณจะตื่นก่อนนาฬิกาปลุก... ในฝัน",
  "ดวงการเงิน: เงินเข้าแล้วออกไปซื้อของทันที",
  "มีเกณฑ์พบคนถูกใจ ถ้าออกจากห้องก่อน",
  "เลขนำโชควันนี้คือเลขที่คุณลืมว่าตั้งไว้",
  "จักรวาลบอกให้พัก แต่เดดไลน์บอกว่าไม่",
  "วันนี้เหมาะกับการเริ่มต้นใหม่ เช่น เปิดแท็บใหม่",
  "คนโสดมีเกณฑ์เจอรักแท้ในช่องคอมเมนต์",
  "คุณจะได้รับข่าวดี หลังจากรีเฟรชอีเมลครั้งที่ 47",
  // เพิ่มเติม - ตลก/ชีวิตประจำวัน
  "อาจารย์ดวงบอกว่า วันนี้ควรกินไก่ทอด 2 ถัง",
  "ดวงหิว: ระดับ 'กินจนท้องแตก' มีโอกาส 99%",
  "คุณจะหายเงิน 20 บาท แล้วเจออีก 20 บาทในกระเป๋ากางเกงเก่า",
  "มีคนคิดถึงคุณ... คนขับกรับที่คุณสั่งอาหาร",
  "วันนี้เหมาะกับการลืมพาสเวิร์ด WiFi แล้วต้องขอใหม่",
  "จะมีโอกาสเดินทางไกล... ไปซื้อของที่ 7-11 มุมถนน",
  "ดวงสุขภาพ: หลังคออักเสบ เพราะนั่งมองจอเกิน 10 ชม.",
  "เลขเด็ด: 6-7 (เพราะว่ามันคือ 67 ครับ)",
  "จะมีคนติดต่อมาขอความช่วยเหลือ... คือเพื่อนขอยืมเงิน",
  "คุณจะทำสิ่งมหัศจรรย์วันนี้: ลงเตียงก่อน 12 โมงคืน",
  "ดวงงาน: หัวหน้าจะไม่ได้มาส่งงานเพิ่มตอน 16:59 (อาจจะมาก็ได้)",
  "มีโอกาสได้ยินข่าวดี: เพื่อนส่งเมมให้หัวเราะในกลุ่มแชท",
  "ดวงรัก: คนที่คุณชอบอาจจะ... ไม่ตอบแชท (ขอโทษ)",
  "วันนี้คุณจะกลายเป็น 'ผู้เชี่ยวชาญ' ด้านอย่างหนึ่ง... คือการเล่นโซเชียล",
  "จะมีการตัดสินใจสำคัญ: กินข้าวนอกหรือสั่งเดลิเวอรี่",
  "ดวงโชค: พบที่จอดรถว่างหน้าร้านอาหารโปรด",
  "คุณจะได้สิ่งที่ต้องการ... แต่ต้องรอคิว 45 นาที",
  "มีโอกาสเจอเพื่อนเก่า ที่คุณทำเป็นไม่รู้จักในห้าง",
  "วันนี้เหมาะกับการซื้อของออนไลน์ แล้วลืมว่าเคยสั่งอะไรไป",
  "ดวงความสุข: อยู่ที่ 'มุมโซฟา + ผ้าห่ม + อากาศเย็น'",
  // เพิ่มเติม - แนว 67/ป่วน
  "67 แจ้งเตือน: ระดับออร่าของคุณกำลังเพิ่มขึ้น... อย่าให้ลด!",
  "จักรวาลส่งสัญญาณ: 'กินไก่ทอดให้ได้วันนี้'",
  "คุณกำลังเข้าสู่โหมด 'Main Character' แล้ว",
  "วันนี้คุณคือ NPC ที่มีออร่ามากที่สุดในเซิร์ฟเวอร์",
  "มีคนกำลังดูคุณ... จากหน้าจอโทรศัพท์ (คือตัวคุณเอง)",
  "คำเตือน: อย่าเปิดตู้เย็นถ้ายังไม่หิว จะกลายเป็นหิวทันที",
  "ดวง 'กรอบ' ของคุณสูงสุดในสัปดาห์นี้",
  "67 บอกว่า: 'ชีวิตสั้น กินไก่ทอดให้มากที่สุด'",
  "คุณจะปลดล็อกความสำเร็จ: 'กินไก่ทอดจนท้องแตก'",
  "ดวงแฟน: ยังไม่มี แต่มีไก่ทอดอยู่ข้างกายแล้ว (ในฝัน)",
];
const excuses = [
  // Original
  "อินเทอร์เน็ตล่มเฉพาะไฟล์นี้ครับ",
  "ทำเสร็จแล้วครับ แต่เซฟไว้ในจักรวาลคู่ขนาน",
  "หนูคิดงานลึกมากจนยังไม่ได้เริ่ม",
  "แมวเดินผ่านคีย์บอร์ดแล้วส่งงานผิดมิติ",
  "กำลังรอแรงบันดาลใจ ติดอยู่รถติดในสมอง",
  "ส่งแล้วครับ แต่ระบบน่าจะเขินเลยซ่อนเอาไว้",
  "วันนี้ปฏิทินแจ้งว่าเป็นวันพักใจแห่งชาติ",
  "ผมทำไว้ในใจแล้ว เหลือแค่ทำลงคอม",
  // เพิ่มเติม - ตลก/น่าสงสาร
  "ทำไว้แล้วครับ แต่ไฟล์หายไปใน 'โฟลเดอร์ลึกลับ' ของระบบ",
  "กำลัง Debug โค้ดครับ... Debug จนลืมว่าโค้ดตัวไหนทำอะไร",
  "ฮาร์ดดิสก์ตัดสินใจเกษียณก่อนวางไฟล์",
  "Git push แล้ว conflict จนอยากให้เวลาหยุดเดิน",
  "โดนแมวนั่งบนคีย์บอร์ด จนกด Ctrl+Z ไปหมด",
  "รอ Code Review จาก senior ที่กำลังดู Netflix",
  "Environment variables หายไปเอง ไม่รู้วิ่งไปไหน",
  "Docker build fail เหมือนเรื่องปกติ",
  "ลืมเซฟไฟล์ แล้วลaptop ตัดสินใจ restart เอง",
  "Stack Overflow ดาวน์ ตอนที่ต้องการมากที่สุด",
  "ทำเสร็จแล้ว แต่มัน run ไม่ได้บน production (แต่ local เร็วมาก)",
  "PR เปิดไว้ 2 สัปดาห์ ไม่มีใคร review",
  "Dependency ตัดสินใจ breaking change ช่วงกลางคืน",
  "Database migration รันแล้ว rollback ไม่ได้",
  "Production down เพราะ... ทดสอบบน production เลย",
  "เขียน test ครบ 100% แต่มันยังมีบั๊ก",
  "Server มียอดเงินคงเหลือ 0 บาท",
  "SSL certificate หมดอายุตอน 3 โมงเช้า",
  "ทำ feature ใหม่เสร็จ แล้วผู้ใช้บอกว่า 'ไม่ได้ใช้ฟีเจอร์นี้'",
  "Deployment Friday 4 โมงเย็น - best practice แหละ",
  // เพิ่มเติม - เนื้อหาเกี่ยวกับการเรียน/งาน
  "กลุ่มทำโปรเจค มีแค่คุณคนเดียวทำงาน",
  "Deadline พรุ่งนี้ แต่มึงยังไม่เริ่ม (ตอน 23:00)",
  "อาจารย์ขอเพิ่ม feature ใหม่ ก่อนส่ง 1 ชม.",
  "โน้ตบุ๊กช้าจนเปิด VS Code ใช้เวลา 5 นาที",
  "Copy code จาก ChatGPT แล้วมัน error เอง",
  "ทำงานเสร็จแล้ว Commit message เขียนว่า 'fix bug'",
  "Merge conflict แก้จนโค้ดตัวเองอ่านไม่เข้าใจ",
  "ลืม pull ก่อน push แล้ว force push ทับทีมเมท",
];
const oracleReplies = [
  // Original
  "มีโอกาส 50/50 คือใช่กับไม่ใช่",
  "ถามอาจารย์ลูกแก้วก่อนนะ",
  "คำตอบอยู่ในใจคุณ (แต่อาจอยู่ผิดลิ้นชัก)",
  "จักรวาลกำลังอ่าน... โปรดลองใหม่หลังพักเที่ยง",
  "ใช่! ถ้าคุณเชื่อมั่นมากพอ",
  "ไม่แน่ใจ แต่ทำหน้าเหมือนรู้ไว้ก่อน",
  "ดวงดาวแนะนำให้โยนเหรียญ",
  "คำถามดีมาก ขอเวลาประชุมกับตัวเอง",
  // เพิ่มเติม - ตลก/นาฬิกา/ชีวิต
  "ลูกบอลบอกว่า... 'ลองถามอีกครั้งพรุ่งนี้'",
  "คำตอบ: ขึ้นอยู่กับว่าคุณกินข้าวกลางวันยัง",
  "เครื่องหมายบ่งชี้ว่า: ควรนอนหลับก่อน 2 โมง",
  "ดวงดาวจัดเส้นให้... แต่ไวไฟไม่เสถียร",
  "ใช่ แต่อาจต้องแลกมาด้วยเงิน 50 บาท",
  "ไม่ ไม่น่าจะ... ยกเว้นวันอังคาร",
  "ลูกบอลมองไม่เห็นอนาคต เพราะมืดเกินไป",
  "คำถามนี้ลึกเกินไป ลูกบอลต้องไปหาคู่มือ",
  "67% ใช่ / 33% ไม่ / 1% 'กินไก่ทอดก่อนค่อยตัดสินใจ'",
  "หากคุณเชื่อมั่น มันก็จะกลายเป็นจริง (หรือไม่ก็ตาม)",
  "ลูกบอลขอโทษ ตอนนี้กำลังชาร์จแบตเตอรี่",
  "คำตอบซ่อนอยู่ใน... โฟลเดอร์ Downloads ของคุณ",
  "ดวงดาวบอกว่า: 'ไปนอนดีกว่า'",
  "มันขึ้นอยู่กับ... คุณกดปุ่ม Like ไหม",
  "ลูกบอลงงเหมือนคุณเลย",
  "โอกาสมีอยู่... ถ้าคุณกล้าตัดสินใจ",
  "คำตอบ: 'ลองทำดู แล้วค่อยคิดผลภายหลัง'",
  "จักรวาลส่ง Error 404: คำตอบไม่พบ",
  "ลองโยนเหรียญดูสิ หัว=ใช่ ก้อย=กินไก่ทอด",
  "คำถามนี้น่าจะถามหมอ แม่ หรือ Google Maps",
  "ลูกบอลบอก: 'ชีวิตคุณ คุณตัดสินใจ' (แต่ขอแนะนำกินไก่ทอด)",
];
const compliments = [
  // Original
  "คุณมีพลังงานตัวเอก แม้บางวันบทจะยังไม่เขียน",
  "รอยยิ้มคุณน่าจะช่วยลดค่าไฟได้",
  "วันนี้ดูดีจนกล้องหน้าขอถ่ายซ้ำ",
  "คุณเก่งมากที่ผ่านวันจันทร์มาได้",
  "ความสามารถพิเศษ: ทำให้ห้องเงียบได้ตอนเปิดไมค์",
  "คุณคือเวอร์ชันลิมิเต็ด ไม่มีใครก๊อปได้",
  "ออร่าคุณสว่างจนหน้าจอปรับความสว่างเอง",
  "คุณสมควรได้พัก แม้รายการสิ่งที่ต้องทำจะยาว",
  // เพิ่มเติม - ยิ้ม/กำลังใจ
  "คุณอร่อยกว่าไก่ทอดสามรัก 67 เท่า!",
  "วันนี้คุณส่องแสง... ไม่ใช่หน้าจอ นะ แต่นิสัยดีของคุณ",
  "คุณมีแรงดึงดูดใจแบบที่ไม่ต้องใช้โฆษณา",
  "ถ้าความเก่งเป็นไก่ทอด คุณคือถังใหญ่เต็ม!",
  "นิสัยดีของคุณติดเชื้อ... ทุกคนที่รู้จักคุณ",
  "คุณเป็น 'Main Character' จริงๆ ในชีวิตตัวเอง",
  "พลังงานบวกของคุณ พอขับเคลื่อนหมู่บ้านได้เลย",
  "วันนี้คุณปัง... ไม่ใช่แค่ปัง แต่ 'ปังแบบมีสติ'",
  "คุณมีไอเดียเยอะ... อย่าลืมเขียนไว้ก่อนนอน!",
  "การมีคุณอยู่ ทำให้ทีมงานมี 'ออร่า' เพิ่มขึ้น 67%",
  "คุณคือ 'Vitamin D' ให้คนรอบข้าง (แรงบันดาลใจ)",
  "แม้วันจะมืด คุณก็เป็น 'โคมไฟ' ให้คนรอบข้าง",
  "ความพยายามของคุณ ไม่ได้พลาดไปไหน (แม้ผลลัพธ์ยังไม่มองเห็น)",
  "คุณจัดการเรื่องยาก ได้ดีกว่าที่คุณคิด",
  "วันนี้คุณ 'เกินร้อย' แล้วนะ... ในดวงใจของผู้เขียนโค้ดนี้",
  "คุณมี 'Superpower' แอบๆ: ทำให้คนรอบข้างยิ้มได้",
  "อย่าลืม: คุณสำคัญกว่าที่คุณคิด (จริงๆ นะ ไม่ใช่แค่บอทบอก)",
  "คุณมีสไตล์ของตัวเอง ที่ไม่มีใครเลียนแบบได้",
  "วันนี้โลกสวยขึ้น... เพราะคุณอยู่ในมัน",
  "คุณคือ 'Human Sunshine' แบบไม่ต้องชาร์จแบต",
  // เพิ่มเติม - เนื้อหาเกี่ยวกับ 67/ไก่ทอด
  "คุณกรอบนอก นุ่มใน... เหมือนไก่ทอดสามรัก!",
  "ระดับออร่า 67: Unlocked! 🌟",
  "ถ้าความปังเป็นเมนู คุณคือ 'เซ็ตแก๊งหิวโซ'",
  "คุณมี 'Flavor' ของตัวเอง ที่ไม่มีร้านไหนเลียนแบบได้",
];
const bandWordsA = [
  // Original
  "แมว", "ข้าวเหนียว", "ดาวเสาร์", "รองเท้าแตะ", "คุณลุง", "กะเพรา", "มนุษย์ต่างดาว", "หมอนข้าง",
  // เพิ่มเติม
  "ไก่ทอด", "หนังไก่", "ซอสเผ็ด", "ถังใหญ่", "น้ำแข็ง", "กินโดน", "หิวโหด", "กรอบ",
  "เพื่อนร่วมงาน", "หัวหน้า", "เดดไลน์", "บั๊ก", "โค้ด", "เซิร์ฟเวอร์", "ดาต้าเบส", "API",
  "หมอน", "ผ้าห่ม", "แอร์", "วิปป์", "โซเฟอร์", "โทรทัศน์", "เนทฟลิกซ์", "ยูทูป",
  "กาแฟ", "ชาไทย", "โอวัลติน", "น้ำมะนาว", "โซดา", "เบียร์", "วิสกี้", "ไวน์",
  "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์", "อาทิตย์", "วันหยุด",
  "รถเมล์", "รถไฟฟ้า", "มอไซค์", "เดิน", "กรับ", "บอลต์", "แท็กซี่", "รถส่วนตัว",
];
const bandWordsB = [
  // Original
  "ไร้ทิศทาง", "เดือดปุด", "ในวันอังคาร", "กับจักรวาล", "คืนวันเงินเดือนออก", "ผู้ไม่ยอมแพ้", "และเครื่องซักผ้า", "เสียงดังแต่ใจดี",
  // เพิ่มเติม
  "ที่กรอบนอกนุ่มใน", "ที่เผ็ดจนต้องกินข้าว 3 จาน", "ที่หิวตอน 3 ทุ่ม", "ที่อิ่มจนต้องแก้กางเกง",
  "ที่ไม่มีวันหยุด", "ที่ทำงานไม่เสร็จ", "ที่โดนบั๊กตลอด", "ที่ Deploy วันศุกร์",
  "ที่นอนหลับไม่ได้", "ที่ตื่นไม่ทัน", "ที่ลืมกินยา", "ที่กินยาไม่ทัน",
  "ที่ดูซีรีส์จบซีซั่น", "ที่เล่นเกมจนตอน 6 โมงเช้า", "ที่สร้างฝันร้าย", "ที่ฝันดีจนไม่อยากตื่น",
  "ที่ราคาเพิ่งถูก", "ที่โปรโมชั่นจบวันนี้", "ที่คิวยาว 2 ชม.", "ที่เสิร์ฟช้า 45 นาที",
  "ที่ไม่ได้นอนมาก่อน 3 โมง", "ที่กาแฟ 3 แก้วต่อวัน", "ที่เงินเดือนหายใน 3 วัน", "ที่บัตรเครดิตแดง",
  "ที่ 67 คือคำตอบ", "ที่ไก่ทอดคือชีวิต", "ที่ออร่าสูง 67 ล้าน", "ที่ Vibe code ล้วนๆ",
];
const randomPick = list => list[Math.floor(Math.random() * list.length)];

function updateHunger() {
  const now = new Date();
  document.getElementById("clock-display").textContent = now.toLocaleTimeString("th-TH", { hour12: false });
  const seed = now.getHours() * 37 + now.getMinutes() * 11 + now.getSeconds();
  const score = 35 + (seed % 66);
  document.getElementById("hunger-score").textContent = `${score}%`;
  const comment = now.getHours() >= 22 || now.getHours() < 5 ? "โหมดหิวดึก: อย่าเพิ่งให้ท้องเป็นคนตัดสินใจ" : hungerLines[Math.floor(seed / 7) % hungerLines.length];
  document.getElementById("hunger-line").textContent = comment;
  document.querySelector(".hunger-meter").style.setProperty("--hunger", `${score}%`);
}

function showBingo() {
  if (!menus.length) return notify("กำลังตามหาไก่ในระบบ รอแป๊บ!");
  const card = document.getElementById("bingo-card");
  const shuffled = [...menus].sort(() => Math.random() - .5).slice(0, 9);
  card.replaceChildren();
  const heading = document.createElement("strong");
  heading.textContent = "บิงโกความหิว — แตะช่องที่เคยกิน!";
  card.append(heading);
  const grid = document.createElement("div");
  grid.className = "bingo-grid";
  shuffled.forEach(item => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.textContent = item.productName;
    tile.addEventListener("click", () => tile.classList.toggle("is-marked"));
    grid.append(tile);
  });
  card.append(grid);
  card.hidden = false;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
}

document.getElementById("panic-order").addEventListener("click", () => {
  if (!menus.length) return notify("ครัวกำลังโหลดเมนู อย่าเพิ่งกินโทรศัพท์นะ");
  const item = [...menus].sort((a, b) => Number(a.price) - Number(b.price))[0];
  notify(`🚨 ภาวะฉุกเฉิน! หน่วยกู้ภัยส่ง ${item.productName} ฿${item.price} ถึงท้องคุณเดี๋ยวนี้ (ใส่ตะกร้าให้แล้ว)`);
  const id = safeId(item, menus.indexOf(item));
  cart[id] = (cart[id] || 0) + 1;
  localStorage.setItem("crispy-cart", JSON.stringify(cart));
  updateCounters();
  renderMenus();
});
document.getElementById("fortune-cookie").addEventListener("click", () => {
  const message = fortunes[Math.floor(Math.random() * fortunes.length)];
  notify(`🥠 ใบเสี่ยงทายกล่าวว่า: ${message}`);
});
document.getElementById("mood-quiz").addEventListener("click", () => {
  const type = eatingTypes[Math.floor(Math.random() * eatingTypes.length)];
  notify(`🧠 ผลวิเคราะห์จากผู้เชี่ยวชาญที่ไม่มีใบประกอบ: ${type}`);
});
document.getElementById("menu-bingo").addEventListener("click", showBingo);
document.getElementById("fortune-button").addEventListener("click", () => {
  document.getElementById("fortune-answer").textContent = randomPick(fortunesOfLife);
});
document.getElementById("excuse-button").addEventListener("click", () => {
  document.getElementById("excuse-answer").textContent = randomPick(excuses);
});
document.getElementById("oracle-button").addEventListener("click", () => {
  const question = document.getElementById("oracle-question").value.trim();
  document.getElementById("oracle-answer").textContent = question ? `ถามว่า “${question}” — ${randomPick(oracleReplies)}` : "ต้องถามก่อนสิ เราไม่ใช่หมอดูแบบอ่านใจได้!";
});
document.getElementById("oracle-question").addEventListener("keydown", event => {
  if (event.key === "Enter") document.getElementById("oracle-button").click();
});
document.getElementById("compliment-button").addEventListener("click", () => {
  document.getElementById("compliment-answer").textContent = randomPick(compliments);
});
document.getElementById("color-button").addEventListener("click", () => {
  const hue = Math.floor(Math.random() * 360);
  const color = `hsl(${hue} 78% 62%)`;
  const name = ["ชมพูดาวอังคาร", "เขียววันเงินเดือนออก", "ฟ้าคนเกือบตื่น", "ม่วงผู้ชนะเดดไลน์", "ส้มพลังงานล้น", "สีที่เครื่องปริ้นเตอร์ไม่ชอบ"][hue % 6];
  const panel = document.querySelector(".chaos-card--color");
  panel.style.setProperty("--lucky-color", color);
  document.getElementById("color-answer").textContent = `${name} · #${hue.toString(16).padStart(3, "0")}`;
});
document.getElementById("band-button").addEventListener("click", () => {
  document.getElementById("band-answer").textContent = `“${randomPick(bandWordsA)} ${randomPick(bandWordsB)}” — ทัวร์คอนเสิร์ตเริ่มที่ห้องนอนคุณ`;
});
let chaosCount = 0;
document.getElementById("coin-flip").addEventListener("click", () => {
  const side = Math.random() < .5 ? "หัว" : "ก้อย";
  document.getElementById("coin-result").textContent = `${side}! จักรวาลเลือกให้แล้ว อย่าโยนซ้ำจนกว่าจะได้คำตอบที่ชอบนะ`;
});
document.querySelectorAll("[data-rps]").forEach(button => button.addEventListener("click", () => {
  const picks = { rock: "✊ ค้อน", paper: "✋ กระดาษ", scissors: "✌️ กรรไกร" };
  const bot = ["rock", "paper", "scissors"][Math.floor(Math.random() * 3)];
  const user = button.dataset.rps;
  const outcome = user === bot ? "เสมอ! บอทก็ลังเลเหมือนคุณ" : (user === "rock" && bot === "scissors") || (user === "paper" && bot === "rock") || (user === "scissors" && bot === "paper") ? "ชนะ! ไปบอกเพื่อนว่าเป็นแชมป์ได้" : "แพ้! บอทฝากบอกว่าไม่ได้ตั้งใจ (ตั้งใจนิดนึง)";
  document.getElementById("rps-result").textContent = `คุณ ${picks[user]} · บอท ${picks[bot]} — ${outcome}`;
}));
let reactionTimer;
let reactionStarted = 0;
let reactionWaiting = false;
const reactionButton = document.getElementById("reaction-start");
reactionButton.addEventListener("click", () => {
  const result = document.getElementById("reaction-result");
  if (reactionButton.classList.contains("is-ready")) {
    const ms = Math.round(performance.now() - reactionStarted);
    result.textContent = `${ms} ms — ${ms < 250 ? "นิ้วไวกว่าแสง!" : ms < 450 ? "เร็วใช้ได้ ไม่ได้แอบซ้อมใช่ไหม" : "ช้ากว่าเต่ากดลิฟต์นิดเดียว"}`;
    reactionButton.classList.remove("is-ready");
    reactionButton.textContent = "ลองอีกที";
    return;
  }
  if (reactionWaiting) {
    clearTimeout(reactionTimer);
    reactionWaiting = false;
    result.textContent = "ฟาวล์! รีบคลิกจนปุ่มยังตกใจ";
    reactionButton.textContent = "ลองอีกที";
    return;
  }

  clearTimeout(reactionTimer);
  reactionButton.classList.remove("is-ready");
  reactionWaiting = true;
  reactionButton.textContent = "รอก่อน...";
  result.textContent = "อย่าเพิ่งคลิกนะ ใจเย็น ๆ ...";
  reactionTimer = setTimeout(() => {
    reactionWaiting = false;
    reactionStarted = performance.now();
    reactionButton.classList.add("is-ready");
    reactionButton.textContent = "คลิกเดี๋ยวนี้!";
  }, 1200 + Math.random() * 2800);
});
let secretNumber = Math.floor(Math.random() * 20) + 1;
let guessesLeft = 5;
document.getElementById("guess-button").addEventListener("click", () => {
  const input = document.getElementById("guess-input");
  const guess = Number(input.value);
  const result = document.getElementById("guess-result");
  if (!guess || guess < 1 || guess > 20) { result.textContent = "ใส่เลข 1 ถึง 20 ก่อน นักถอดรหัส"; return; }
  guessesLeft--;
  if (guess === secretNumber) {
    result.textContent = `ถูกต้อง! เลข ${secretNumber} ยอมแพ้ให้คุณแล้ว 🎉`;
    guessesLeft = 0;
  } else if (guessesLeft <= 0) {
    result.textContent = `หมดรอบ! เลขคือ ${secretNumber} — เลขมันเก่งไปหน่อย`;
  } else {
    result.textContent = `${guess < secretNumber ? "สูงกว่านี้!" : "ต่ำกว่านี้!"} เหลือ ${guessesLeft} ครั้ง`;
  }
  if (guessesLeft <= 0) {
    secretNumber = Math.floor(Math.random() * 20) + 1;
    guessesLeft = 5;
  }
});
document.getElementById("guess-input").addEventListener("keydown", event => {
  if (event.key === "Enter") document.getElementById("guess-button").click();
});
const dailyReports = [
  // Original
  "งานวันนี้จะเสร็จทัน... ถ้าเวลาหยุดเดิน",
  "ดวงความรัก: มีคนแอบชอบคุณ (แม่คุณเอง)",
  "พลังงานวันนี้ 87% อีก 13% อยู่ในสายชาร์จ",
  "คำเตือน: อย่าตอบ ‘ครับ’ ในแชตกลุ่มที่ไม่รู้เรื่อง",
  "ดาวพุธถอยหลัง แต่คุณยังเดินไปหยิบขนมได้",
  "โชคลาภกำลังมาในรูปแบบเงินทอน 2 บาท",
  "คุณจะหัวเราะภายใน 24 ชั่วโมง หรือคืนเงินไม่ได้",
  "ระดับความขยัน: กำลังโหลด... 3%",
  "วันนี้เหมาะกับการจัดโต๊ะ แล้ววางของกลับที่เดิมไม่ได้",
  "ระวังคนชื่อเหมือนคุณ จะทำเรื่องที่คุณยังไม่ได้ทำ",
  // เพิ่มเติม - ตลก/ชีวิตประจำวัน/67
  "ดวงหิววันนี้: ระดับ 'กินจนปุ่มกางเกงปั่น' 🍗",
  "จะมีเงินเข้ากระเป๋า... แล้วหายไปกับค่าอาหารกลางวัน",
  "วันนี้เหมาะกับการ: เปิด YouTube ดู 3 ชม. แล้วบอกตัวเองว่า 'พักแป๊บนึง'",
  "คำเตือน: อย่าตรวจสอบยอดเงินธนาคารถ้ายังไม่ได้เงินเดือน",
  "ดวงงาน: โอกาสได้ 'พักผ่อน' มากกว่า 'ทำงาน' 2:1",
  "จะมีข่าวสารสนุก... มาจากกลุ่มแชทเพื่อนที่อ่านแล้วไม่อ่าน",
  "เลขนำโชควันนี้: 6, 7, 67, และราคาไก่ทอดถังเล็ก",
  "ดวงสุขภาพ: คอ ปวด เพราะ มอง โทรศัพท์ ลง ไป นานเกินไป",
  "วันนี้คุณอาจ... ทำสิ่งที่ลืมว่าต้องทำ แล้วจำได้ตอนนอน",
  "โชคดี: เจอที่จอดรถหน้าร้านอาหารโปรด (ไก่ทอดสามรัก)",
  "ดวงรัก: โอกาสเจอ 'The One' ต่ำกว่าโอกาสเจอ 'ไก่ทอดอร่อย'",
  "คำแนะนำ: กินข้าวให้ทันเวลา มิฉะนั้น ท้องจะร้องเพลง 'หิว'",
  "พลังงาน 67%: พอทำงานได้ พอเล่นได้ พอกินไก่ทอดได้",
  "จะมีคนขอความช่วยเหลือ... คือเพื่อนขอ 'เช็คบิล' หน่อย",
  "วันนี้เหมาะกับ: ซื้อของออนไลน์ แล้วลืมว่าสั่งอะไรไป",
  "ดวง 'กรอบ': สูงสุดในสัปดาห์ - เหมาะกับการทอดไก่ (หรือทอดงาน)",
  "จะมีการตัดสินใจสำคัญ: สั่งไก่ทอด 2 ชิ้น หรือง 3 ชิ้น",
  "คำเตือน: อย่าเปิดตู้เย็นตอน 2 ทุ่ม ยกเว้นจะ तैयार กิน",
  "ดวงโชค: พบเงิน 20 บาท ในกระเป๋ากางเกงที่ไม่ได้สวมมานาน",
  "วันนี้คุณจะ... ยิ้มได้ โดยไม่ต้องแต่งหน้า",
  "67 Mode: เปิดใช้งานแล้ว - ชีวิตสนุกขึ้น 67%",
  "คำทำนาย: คุณจะได้ยินข่าวดี... หลังจากกินไก่ทอดเสร็จ",
];
function refreshDailyReport() {
  document.getElementById("daily-report").textContent = randomPick(dailyReports);
}
document.getElementById("daily-button").addEventListener("click", refreshDailyReport);
refreshDailyReport();
document.getElementById("menu-add-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const fields = new FormData(form);
  const productName = String(fields.get("productName") || "").trim();
  const amount = Number(fields.get("amount"));
  const price = Number(fields.get("price"));
  const imageURL = String(fields.get("imageURL") || "").trim();
  if (!productName || !Number.isInteger(amount) || amount < 1 || !Number.isFinite(price) || price < 0) {
    notify("ข้อมูลเมนูยังไม่ผ่านด่านตรวจ ลองเช็กชื่อ จำนวน และราคานะ");
    return;
  }
  if (imageURL) {
    let parsedURL;
    try { parsedURL = new URL(imageURL); } catch { notify("ลิงก์รูปไม่ถูกต้อง ใส่ URL ที่เปิดได้ก่อนน้า"); return; }
    if (!["http:", "https:"].includes(parsedURL.protocol)) {
      notify("ลิงก์รูปขอเป็น http หรือ https เท่านั้น เพื่อความปลอดภัย");
      return;
    }
  }
  const submitButton = form.querySelector("[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "กำลังบันทึก...";
  try {
    const response = await fetch("/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productName, amount, price, imageURL })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "เพิ่มเมนูลงฐานข้อมูลไม่สำเร็จ");
    form.reset();
    form.elements.amount.value = "1";
    await loadMenus();
    notify(`เพิ่ม “${productName}” ลงฐานข้อมูลแล้ว ✨`);
  } catch (error) {
    notify(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "＋ เพิ่มเมนู";
  }
});
document.getElementById("chaos-button").addEventListener("click", event => {
  chaosCount++;
  const button = event.currentTarget;
  const hue = (chaosCount * 67) % 360;
  document.body.style.setProperty("--chaos-hue", hue);
  button.innerHTML = ["กดแล้วนะ! จักรวาลรับทราบ", "อีกทีสิ กล้าปะล่ะ", "ระบบเริ่มสงสัยในตัวคุณ", "พอแล้ว ปุ่มขอพัก", "คุณปลดล็อกตำแหน่ง: ผู้กดปุ่มมืออาชีพ"][Math.min(chaosCount - 1, 4)];
  button.classList.toggle("chaos-shake");
  document.querySelector(".fun-lab").classList.toggle("chaos-mode");
  if (chaosCount === 5) notify("🏆 Achievement unlocked: กดปุ่มที่ไม่มีประโยชน์ครบ 5 ครั้ง!");
});
updateCounters();
updateHunger();
setInterval(updateHunger, 1000);
loadMenus();

const memeQuotes = [
  "touch grass challenge: ล้มเหลว",
  "aura points +67 (แหล่งข่าว: trust me bro)",
  "สมองออกจากแชตแล้ว",
  "วันนี้เราจะไม่ซื้อของฟุ่มเฟือย — ซื้อแล้ว",
  "delulu is the solulu แต่ขอมีสติด้วยนิดนึง",
  "ตัวแม่จะแคร์เพื่อ แต่ตัวเราแคร์ยอดเงิน",
  "ความพยายามอยู่ที่ไหน... อยู่ในวันหยุด",
  "กำลังโหลดความปัง กรุณาอย่าปิดใจ",
  "ภารกิจวันนี้: ทำตัวเหมือนรู้เรื่อง",
  "กดอีกทีสิ เผื่อชีวิตจะมีอัปเดต"
];
const burstEmojis = ["✨", "💥", "67", "🧠", "🫡", "🪩", "😭", "💅"];
let burstCount = 0;
let memeRainInterval = null;
const memeModeToggle = document.getElementById("meme-mode-toggle");

memeModeToggle.addEventListener("click", event => {
  const enabled = document.body.classList.toggle("meme-overdrive");
  event.currentTarget.setAttribute("aria-pressed", String(enabled));
  event.currentTarget.querySelector("small").textContent = enabled ? "ON" : "OFF";
  event.currentTarget.querySelector(".meme-mode-toggle__spark").textContent = enabled ? "💥" : "✳";
  notify(enabled ? "67 MODE เปิดแล้ว · เว็บเริ่มเต้นท่า 67!" : "67 MODE ปิดแล้ว · เว็บหยุดเต้นแล้ว");
  document.dispatchEvent(new CustomEvent("arcade:67-mode-change", { detail: { enabled } }));
  clearInterval(memeRainInterval);
  memeRainInterval = null;
  if (enabled && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    launch67Rain(12);
    memeRainInterval = setInterval(() => launch67Rain(6), 450);
  } else if (!enabled) {
    document.querySelectorAll(".rain").forEach(piece => piece.remove());
  }
});

function launchMemeBurst(x, y, amount = 7) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < amount && burstCount < 28; i++) {
    const piece = document.createElement("span");
    piece.className = "meme-particle";
    piece.textContent = randomPick(burstEmojis);
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.setProperty("--fly-x", `${Math.round((Math.random() - .5) * 300)}px`);
    piece.style.setProperty("--fly-y", `${Math.round(-80 - Math.random() * 220)}px`);
    piece.style.setProperty("--spin", `${Math.round((Math.random() - .5) * 800)}deg`);
    document.body.append(piece);
    burstCount++;
    piece.addEventListener("animationend", () => {
      piece.remove();
      burstCount--;
    }, { once: true });
  }
}

function launch67Rain(amount = 26) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < amount; i++) {
    const piece = document.createElement("span");
    piece.className = "rain";
    piece.textContent = ["🍗", "🍟", "67", "✨"][i % 4];
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.animationDelay = `${Math.random() * .9}s`;
    document.documentElement.append(piece);
    setTimeout(() => piece.remove(), 3400);
  }
}

document.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button || button.disabled || button.id === "meme-mode-toggle") return;
  launchMemeBurst(event.clientX, event.clientY, document.body.classList.contains("meme-overdrive") ? 10 : 3);
});

const progressBar = document.getElementById("scroll-progress");
let progressQueued = false;
window.addEventListener("scroll", () => {
  if (progressQueued) return;
  progressQueued = true;
  requestAnimationFrame(() => {
    const scrollable = document.documentElement.scrollHeight - innerHeight;
    progressBar.style.transform = `scaleX(${scrollable > 0 ? scrollY / scrollable : 0})`;
    progressQueued = false;
  });
}, { passive: true });

setInterval(() => {
  const ticker = document.querySelector(".marquee__track");
  const headline = ticker?.querySelector("span");
  if (headline) headline.textContent = randomPick(memeQuotes).toUpperCase();
}, 12000);

const speechBubble = document.getElementById("meme-speech");
const speechBits = ["6767", "6777", "67", "6", "7", "66776677", "67", "67"];
let lastSpeechAt = 0;
document.addEventListener("pointerdown", event => {
  if (event.pointerType === "touch" || Date.now() - lastSpeechAt < 950) return;
  lastSpeechAt = Date.now();
  speechBubble.textContent = randomPick(speechBits);
  speechBubble.style.left = `${Math.min(event.clientX + 14, innerWidth - 125)}px`;
  speechBubble.style.top = `${Math.max(12, event.clientY - 42)}px`;
  speechBubble.classList.remove("meme-speech--show");
  requestAnimationFrame(() => speechBubble.classList.add("meme-speech--show"));
});

let typedDigits = "";
let digitReset;
document.addEventListener("keydown", event => {
  if (event.key !== "6" && event.key !== "7") return;
  typedDigits = `${typedDigits}${event.key}`.slice(-2);
  clearTimeout(digitReset);
  digitReset = setTimeout(() => { typedDigits = ""; }, 1500);
  if (typedDigits === "67") {
    typedDigits = "";
    document.getElementById("meme-mode-toggle").click();
  }
});
/* UX helpers: open status, floating cart pill, nav scroll-spy */
(() => {
  const chip = document.getElementById("open-chip");
  const updateOpen = () => {
    const hour = new Date().getHours(), open = hour >= 9 && hour < 23;
    chip.classList.toggle("is-open", open);
    chip.textContent = open ? "เปิดอยู่ตอนนี้ · ปิด 23:00" : "ปิดอยู่ · เปิดใหม่ 09:00";
  };
  updateOpen(); setInterval(updateOpen, 60000);

  const pill = document.getElementById("cart-pill"), summary = document.getElementById("cart-summary");
  const syncPill = () => {
    const match = summary.textContent.match(/^(\d+) ชิ้น · รวม ฿([\d,]+)/);
    pill.hidden = !match;
    if (match) pill.querySelector("span").textContent = `${match[1]} ชิ้น · ฿${match[2]}`;
  };
  new MutationObserver(syncPill).observe(summary, { childList: true, characterData: true, subtree: true });
  syncPill();
  pill.addEventListener("click", () => document.querySelector(".cart-panel").scrollIntoView({ behavior: "smooth", block: "center" }));

  const links = [...document.querySelectorAll(".nav__links a")];
  const homeLink = links.find(a => a.hash === "#top");
  const nav = document.querySelector(".nav");
  const updateActiveNav = () => {
    const marker = window.scrollY + nav.getBoundingClientRect().height + 1;
    let activeLink = homeLink;
    links.forEach(link => {
      const target = document.getElementById(link.hash.slice(1));
      if (target && target.getBoundingClientRect().top + window.scrollY <= marker) activeLink = link;
    });
    links.forEach(link => link.classList.toggle("is-active", link === activeLink));
  };
  updateActiveNav();
  window.addEventListener("scroll", updateActiveNav, { passive: true });
  window.addEventListener("hashchange", updateActiveNav);
  window.addEventListener("load", updateActiveNav);
})();

/* ARCADE 67 — เกมหลัก + ระบบ Aura + ธีมปลดล็อก
   ใช้ร่วมกับ index.js เดิม (เรียก notify / launchMemeBurst ที่มีอยู่แล้ว) */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const say = m => { if (typeof notify === "function") notify(m); };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }
  };
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; };
  const burst = (n = 24) => { if (typeof launchMemeBurst === "function") launchMemeBurst(innerWidth / 2, innerHeight * .45, n); };

  /* ---------- Aura + ธีม ---------- */
  const titles = [[0, "มือใหม่หัดหิว"], [50, "สายกรอบ"], [150, "ตัวตึงร้านไก่"], [300, "เจ้าพ่อออร่า"], [600, "ตำนาน 67"]];
  const titleOf = n => titles.filter(t => n >= t[0]).pop()[1];
  const themes = [
    { id: "classic", name: "คลาสสิก 67", cost: 0, free: true, vars: {} },
    { id: "night", name: "ตลาดกลางคืน", cost: 0, free: true, vars: { "--blue": "#3a1fd6", "--org": "#ff4fa3", "--lime": "#7dffd2", "--pink": "#ffd84a" } },
    { id: "sunset", name: "ซันเซ็ตวิบวับ", cost: 0, free: true, vars: { "--blue": "#c0392b", "--org": "#f39c12", "--lime": "#f1c40f", "--pink": "#e74c3c" } },
    { id: "sky", name: "ท้องฟ้าใส", cost: 0, free: true, vars: { "--blue": "#0070f3", "--org": "#00bcd4", "--lime": "#b2f5ea", "--pink": "#e0f2fe" } },
    { id: "berry", name: "สตรอว์เบอร์รีช็อก", cost: 250, free: false, vars: { "--blue": "#e0245e", "--org": "#ff9d1a", "--lime": "#fff25c", "--pink": "#9be7ff" } },
    { id: "matcha", name: "มัทฉะออร่า", cost: 500, free: false, vars: { "--blue": "#0f7b4f", "--org": "#ff7a2e", "--lime": "#e6ff5c", "--pink": "#ffc2ef" } },
    { id: "ocean", name: "โอชันดีพ", cost: 300, free: false, vars: { "--blue": "#0a3d62", "--org": "#0097e6", "--lime": "#00d2d3", "--pink": "#a29bfe" } },
    { id: "thaigold", name: "ไทยทอง", cost: 750, free: false, vars: { "--blue": "#6c3483", "--org": "#d4ac0d", "--lime": "#f9e79f", "--pink": "#f0a500" } }
  ];

  let aura = store.get("aura-total", 0), themeId = store.get("aura-theme", "classic");
  function applyTheme(id) {
    const root = document.documentElement.style;
    themes.forEach(t => Object.keys(t.vars).forEach(k => root.removeProperty(k)));
    const t = themes.find(x => x.id === id) || themes[0];
    Object.entries(t.vars).forEach(([k, v]) => root.setProperty(k, v));
    themeId = t.id; store.set("aura-theme", themeId);
  }
  applyTheme(themeId);

  /* ---------- สร้าง section ---------- */
  const sec = document.createElement("section");
  sec.className = "arcade"; sec.id = "arcade"; sec.setAttribute("aria-labelledby", "arcade-t");
  sec.innerHTML = `
  <div class="arcade__head">
    <div><p class="tag">ARCADE · 5 ระดับ · เปิด 67 MODE เพิ่มความโหด</p><h2 id="arcade-t">ARCADE<span>67</span></h2></div>
    <div class="aura-hud" aria-live="polite">
      <small>AURA ของคุณ</small><b id="aura-total">0</b><span id="aura-title"></span>
      <i class="aura-bar"><u id="aura-fill"></u></i>
      <button type="button" id="rain-btn">🍗 ฝน 67</button>
    </div>
  </div>
  <div class="arcade__tabs" role="tablist" aria-label="เลือกเกม">
    <button role="tab" aria-selected="true" data-tab="catch">🍗 รับไก่</button>
    <button role="tab" aria-selected="false" data-tab="memory">🃏 จับคู่ 3 รัก</button>
    <button role="tab" aria-selected="false" data-tab="fry">🔥 ทอดให้พอดี</button>
    <button role="tab" aria-selected="false" data-tab="whack">🎯 จับไก่ไว</button>
  </div>

  <div class="cab" data-panel="catch">
    <div class="cab__bar"><span>คะแนน <b id="c-score">0</b></span><span>เวลา <b id="c-time">30</b></span><span>สถิติ <b id="c-best">0</b></span><div class="game-difficulty"><span>ระดับ</span><select id="c-difficulty" aria-label="ระดับรับไก่"><option value="easy">ง่าย</option><option value="medium">กลาง</option><option value="hard">ยาก</option><option value="extreme">ยากมาก</option><option value="67">67</option></select></div></div>
    <div class="cab__stage">
      <canvas id="catch-cv" width="720" height="440" aria-label="เกมรับไก่"></canvas>
      <div class="ov" id="c-ov">
        <h3>รับไก่ 30 วินาที</h3>
        <p>ลากเมาส์/นิ้ว หรือกดลูกศร ซ้าย–ขวา<br>🍗 +1 · 🍟 +2 · <b>67</b> +7 · 🌶️ −3 · 🥦 −2</p>
        <div class="pick" role="radiogroup" aria-label="เลือกตัวละคร">
          <button type="button" data-who="nu" aria-pressed="true"><img src="imgs/nobg/pnu1.png" alt="นุ"><span>นุ</span></button>
          <button type="button" data-who="sky" aria-pressed="false"><img src="imgs/nobg/psky1.png" alt="สกาย"><span>สกาย</span></button>
          <button type="button" data-who="yell" aria-pressed="false"><img src="imgs/nobg/pyell1.png" alt="เยล"><span>เยล</span></button>
        </div>
        <button class="btn btn--lime" id="c-start" type="button">เริ่มเกม ▶</button>
      </div>
    </div>
  </div>

  <div class="cab" data-panel="memory" hidden>
    <div class="cab__bar"><span>ครั้งที่เปิด <b id="m-moves">0</b></span><span><span id="m-time-label">เวลา</span> <b id="m-time">0</b>s</span><span>ดีที่สุด <b id="m-best">–</b></span><div class="game-difficulty"><span>ระดับ</span><select id="m-difficulty" aria-label="ระดับจับคู่"><option value="easy">ง่าย</option><option value="medium">กลาง</option><option value="hard">ยาก</option><option value="extreme">ยากมาก</option><option value="67">67</option></select></div><button class="btn btn--lime btn--sm" id="m-reset" type="button">สับไพ่ใหม่ ↻</button></div>
    <div class="mem" id="mem" aria-label="เกมจับคู่"></div>
    <p class="cab__hint" id="m-msg">จับคู่รูปให้ครบ 6 คู่ ยิ่งเปิดน้อย ยิ่งได้ AURA เยอะ</p>
  </div>

  <div class="cab" data-panel="fry" hidden>
    <div class="cab__bar"><span>รอบ <b id="f-round">0</b>/5</span><span>คะแนน <b id="f-score">0</b></span><span>ดีที่สุด <b id="f-best">0</b></span><div class="game-difficulty"><span>ระดับ</span><select id="f-difficulty" aria-label="ระดับทอดให้พอดี"><option value="easy">ง่าย</option><option value="medium">กลาง</option><option value="hard">ยาก</option><option value="extreme">ยากมาก</option><option value="67">67</option></select></div></div>
    <div class="fry">
      <div class="fry__chick" id="f-chick" aria-hidden="true">🍗</div>
      <div class="fry__bar" id="f-bar"><i class="fry__zone" id="f-zone"></i><b class="fry__cur" id="f-cur"></b></div>
      <div class="fry__labels"><span>ดิบ 🥶</span><span>กรอบพอดี</span><span>ไหม้ 💀</span></div>
      <p class="fry__msg" id="f-msg">กด “ยกไก่!” (หรือ Space) ตอนที่เข็มอยู่ตรงโซนกลาง</p>
      <button class="btn btn--red" id="f-go" type="button">เริ่มทอด ▶</button>
    </div>
  </div>

  <div class="cab" data-panel="whack" hidden>
    <div class="cab__bar">
      <span>คะแนน <b id="w-score">0</b></span>
      <span>เวลา <b id="w-time">30</b></span>
      <span>คอมโบ <b id="w-combo">0</b></span>
      <span>สถิติ <b id="w-best">0</b></span>
      <div class="game-difficulty"><span>ระดับ</span><select id="w-difficulty" aria-label="ระดับจับไก่ไว"><option value="easy">ง่าย</option><option value="medium">กลาง</option><option value="hard">ยาก</option><option value="extreme">ยากมาก</option><option value="67">67</option></select></div>
    </div>
    <div class="whack-game">
      <p class="whack-instructions">แตะไก่ให้ไวเพื่อเก็บคะแนน! <b>67</b> โบนัส · ห้ามแตะ 🌶️</p>
      <div class="whack-grid" id="whack-grid" aria-label="ช่องเกมจับไก่">
        ${Array.from({ length: 9 }, (_, i) => `<button class="whack-cell" type="button" data-cell="${i}" disabled aria-label="ช่องว่าง"></button>`).join("")}
      </div>
      <p id="w-status" class="whack-status" role="status" aria-live="polite">พร้อมแล้ว กดเริ่มเกมเพื่อเล่น 30 วินาที</p>
      <button class="btn btn--lime" id="w-start" type="button">เริ่มเกม ▶</button>
    </div>
  </div>

`;
  const lab = $("#lab");
  (lab || $("main")).before(sec);
  initializeCustomDropdowns(sec);

  /* ---------- สร้าง section ธีม แยกจาก arcade ---------- */
  const themeSec = document.createElement("section");
  themeSec.className = "themes-section"; themeSec.id = "themes";
  themeSec.setAttribute("aria-labelledby", "themes-t");
  themeSec.innerHTML = `
  <div class="themes-section__head">
    <p class="tag">ปรับแต่งเว็บตามสไตล์คุณ</p>
    <h2 id="themes-t">ปลดล็อก<span>ธีม</span></h2>
    <p class="themes-section__sub">4 ธีมฟรีให้เลือกเลย · อีก 4 ธีมปลดล็อกด้วย AURA จากการเล่นเกม</p>
  </div>
  <div class="theme-grid" id="theme-grid"></div>`;
  sec.after(themeSec);

  /* ---------- Aura HUD ---------- */
  function renderAura() {
    $("#aura-total").textContent = aura.toLocaleString("th-TH");
    $("#aura-title").textContent = titleOf(aura);
    const idx = titles.filter(t => aura >= t[0]).length - 1, next = titles[idx + 1];
    $("#aura-fill").style.width = (next ? (aura - titles[idx][0]) / (next[0] - titles[idx][0]) * 100 : 100) + "%";
    renderThemes();
  }
  function addAura(n, why) {
    if (n <= 0) { say(`${why} · คราวหน้าเอา AURA ให้ได้นะ`); return; }
    const before = titleOf(aura);
    aura += n; store.set("aura-total", aura); renderAura();
    say(`✨ ${why} · +${n} AURA`);
    if (titleOf(aura) !== before) { setTimeout(() => { say(`🏆 เลื่อนขั้นเป็น “${titleOf(aura)}”`); launch67Rain(); }, 900); }
  }
  function renderThemes() {
    const grid = $("#theme-grid"); if (!grid) return;
    const defaultVars = { "--blue": "#2536ff", "--org": "#ff6b1a", "--lime": "#c4ff3a", "--pink": "#ff8fe0" };
    grid.innerHTML = themes.map(t => {
      const unlocked = t.free || aura >= t.cost, on = t.id === themeId;
      const sw = ["--blue", "--org", "--lime", "--pink"].map(k => `<i style="background:${t.vars[k] || defaultVars[k]}"></i>`).join("");
      const badge = t.free ? `<span class="theme__badge theme__badge--free">FREE</span>` : `<span class="theme__badge theme__badge--aura">✨ ${t.cost} AURA</span>`;
      const btnLabel = on ? "✓ ใช้อยู่" : unlocked ? "ใช้ธีมนี้" : `🔒 ต้องมี ${t.cost} AURA`;
      return `<article class="theme ${on ? "is-on" : ""} ${unlocked ? "is-unlocked" : "is-locked"}">
        <div class="theme__sw">${sw}</div>
        ${badge}
        <h4>${t.name}</h4>
        <button type="button" data-theme="${t.id}" ${unlocked ? "" : "disabled"}>${btnLabel}</button>
      </article>`;
    }).join("");
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-theme]"); if (!b || b.disabled) return;
    applyTheme(b.dataset.theme); renderThemes(); say("เปลี่ยนธีมแล้ว"); burst(14);
  });
  $("#rain-btn").addEventListener("click", () => launch67Rain());

  /* ---------- แท็บ ---------- */
  const stoppers = [];
  function setupDifficulty(id, storageKey, onChange) {
    const select = $("#" + id);
    const saved = store.get(storageKey, "medium");
    select.value = ["easy", "medium", "hard", "extreme", "67"].includes(saved) ? saved : "medium";
    select.addEventListener("change", () => {
      store.set(storageKey, select.value);
      if (onChange) onChange(select.value);
    });
    return select;
  }
  $$(".arcade__tabs [role=tab]", sec).forEach(tab => tab.addEventListener("click", () => {
    stoppers.forEach(f => f());
    $$(".arcade__tabs [role=tab]", sec).forEach(t => t.setAttribute("aria-selected", String(t === tab)));
    $$(".cab", sec).forEach(p => p.hidden = p.dataset.panel !== tab.dataset.tab);
  }));

  /* ---------- เกม 1: รับไก่ (canvas) ---------- */
  (() => {
    const cv = $("#catch-cv"), ctx = cv.getContext("2d"), W = 720, H = 440, ov = $("#c-ov");
    const difficulty = setupDifficulty("c-difficulty", "difficulty-catch");
    const settings = {
      easy: { speed: .75, spawn: .82, acceleration: .006 },
      medium: { speed: 1, spawn: .62, acceleration: .012 },
      hard: { speed: 1.35, spawn: .44, acceleration: .016 },
      extreme: { speed: 1.7, spawn: .3, acceleration: .02 },
      67: { speed: 2.3, spawn: .18, acceleration: .025 }
    };
    const src = { nu: "imgs/nobg/pnu1.png", sky: "imgs/nobg/psky1.png", yell: "imgs/nobg/pyell1.png" };
    const img = {}; Object.keys(src).forEach(k => { img[k] = new Image(); img[k].src = src[k]; });
    const types = [{ e: "🍗", p: 1, w: 48, s: 1 }, { e: "🍟", p: 2, w: 22, s: 1.15 }, { e: "🌶️", p: -3, w: 14, s: 1.2 }, { e: "🥦", p: -2, w: 12, s: 1.1 }, { e: "67", p: 7, w: 4, s: 1.5, gold: true }];
    let who = "nu", running = false, round67Mode = false, score = 0, time = 30, px = W / 2, items = [], pops = [], last = 0, spawn = 0, raf = 0, dir = 0;
    let best = store.get("best-catch", 0); $("#c-best").textContent = best;
    $$("[data-who]", ov).forEach(b => b.addEventListener("click", () => { who = b.dataset.who; $$("[data-who]", ov).forEach(x => x.setAttribute("aria-pressed", String(x === b))); }));
    const pickType = () => { let r = Math.random() * 100; for (const t of types) { if ((r -= t.w) < 0) return t; } return types[0]; };
    const setX = cx => { const r = cv.getBoundingClientRect(); px = Math.max(40, Math.min(W - 40, (cx - r.left) / r.width * W)); };
    cv.addEventListener("pointermove", e => { if (running) setX(e.clientX); });
    cv.addEventListener("pointerdown", e => { if (running) setX(e.clientX); });
    addEventListener("keydown", e => {
      if (!running) return;
      if (e.key === "ArrowLeft") { dir = -1; e.preventDefault(); } if (e.key === "ArrowRight") { dir = 1; e.preventDefault(); }
    });
    addEventListener("keyup", e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") dir = 0; });
    function draw() {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#1b1b6b"); g.addColorStop(1, "#0b0b1a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(196,255,58,.12)"; for (let i = 0; i < 18; i++) ctx.fillRect((i * 97 + 20) % W, (i * 53) % (H - 80), 3, 3);
      ctx.fillStyle = "#c4ff3a"; ctx.fillRect(0, H - 14, W, 14);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      items.forEach(i => {
        ctx.save(); ctx.translate(i.x, i.y); ctx.rotate(i.r);
        if (i.t.gold) { ctx.fillStyle = "#ffd43a"; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 7); ctx.fill(); ctx.strokeStyle = "#0b0b1a"; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = "#0b0b1a"; ctx.font = "700 24px Mitr, sans-serif"; }
        else ctx.font = "38px sans-serif";
        ctx.fillText(i.t.e, 0, 2); ctx.restore();
      });
      const im = img[who], h = 130, w = im.naturalWidth ? im.naturalWidth / im.naturalHeight * h : 100;
      if (im.complete && im.naturalWidth) ctx.drawImage(im, px - w / 2, H - h - 6, w, h);
      pops.forEach(p => { ctx.globalAlpha = Math.max(0, p.t); ctx.fillStyle = p.c; ctx.font = "700 26px Mitr, sans-serif"; ctx.fillText(p.s, p.x, p.y); }); ctx.globalAlpha = 1;
    }
    function frame(t) {
      if (!running) return;
      const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
      time -= dt; spawn -= dt; px = Math.max(40, Math.min(W - 40, px + dir * 520 * dt));
      if (spawn <= 0) {
        const ty = pickType(), config = settings[difficulty.value], modeSpeed = round67Mode ? 1.35 : 1, modeSpawn = round67Mode ? .7 : 1;
        items.push({ t: ty, x: 30 + Math.random() * (W - 60), y: -30, v: (150 + (30 - time) * 6) * ty.s * config.speed * modeSpeed, r: 0, vr: (Math.random() - .5) * 3 });
        spawn = Math.max(.12, config.spawn * modeSpawn - (30 - time) * config.acceleration);
      }
      items.forEach(i => { i.y += i.v * dt; i.r += i.vr * dt; });
      items = items.filter(i => {
        if (i.y > H - 140 && i.y < H - 40 && Math.abs(i.x - px) < 48) {
          score = Math.max(0, score + i.t.p); pops.push({ x: i.x, y: i.y - 20, s: (i.t.p > 0 ? "+" : "") + i.t.p, c: i.t.p > 0 ? "#c4ff3a" : "#ff2f3f", t: 1 });
          $("#c-score").textContent = score; return false;
        }
        return i.y < H + 40;
      });
      pops.forEach(p => { p.y -= 40 * dt; p.t -= dt * 1.4; }); pops = pops.filter(p => p.t > 0);
      $("#c-time").textContent = Math.max(0, Math.ceil(time));
      draw();
      if (time <= 0) return end(); raf = requestAnimationFrame(frame);
    }
    function start() {
      score = 0; time = 30; items = []; pops = []; spawn = 0; dir = 0; px = W / 2; round67Mode = is67Mode(); running = true; difficulty.disabled = true;
      $("#c-score").textContent = 0; ov.hidden = true; last = performance.now(); raf = requestAnimationFrame(frame);
    }
    function end() {
      running = false; cancelAnimationFrame(raf); draw();
      difficulty.disabled = false;
      const isBest = score > best; if (isBest) { best = score; store.set("best-catch", best); $("#c-best").textContent = best; }
      ov.hidden = false; $("h3", ov).textContent = isBest && score > 0 ? `สถิติใหม่! ${score} คะแนน 🎉` : `ได้ ${score} คะแนน`;
      $("#c-start").textContent = "เล่นอีกรอบ ↻"; if (score >= 25) burst(26);
      addAura(score, "รับไก่");
    }
    $("#c-start").addEventListener("click", start);
    stoppers.push(() => { if (running) { running = false; cancelAnimationFrame(raf); difficulty.disabled = false; ov.hidden = false; $("h3", ov).textContent = "รับไก่ 30 วินาที"; $("#c-start").textContent = "เริ่มเกม ▶"; } });
    draw();
  })();

  /* ---------- เกม 2: จับคู่ 3 รัก ---------- */
  (() => {
    const keys = ["pyell2", "pnu1", "psky1", "psky2", "pyell1", "pnu2"], names = ["เยล", "นุ", "สกาย", "สกาย(ค่ำ)", "เยล(โต๊ะ)", "นุ(เคาน์เตอร์)"];
    const grid = $("#mem"); let open = [], lock = false, moves = 0, done = 0, t0 = 0, timer = 0, best = store.get("best-mem", 0);
    const difficulty = setupDifficulty("m-difficulty", "difficulty-memory");
    const pairCounts = { easy: 3, medium: 4, hard: 6, extreme: 12, 67: 18 };
    let pairsToMatch = pairCounts[difficulty.value], timeLimit = 0, round67Mode = false;
    if (best) $("#m-best").textContent = best + " ครั้ง";
    function build() {
      clearInterval(timer); open = []; lock = false; moves = 0; done = 0; t0 = 0;
      round67Mode = is67Mode();
      const modeOn = round67Mode;
      pairsToMatch = Math.min(18, pairCounts[difficulty.value] + (modeOn && difficulty.value !== "67" ? 3 : 0));
      timeLimit = difficulty.value === "67" ? (modeOn ? 33 : 67) : modeOn ? 67 : 0;
      const pairs = Array.from({ length: pairsToMatch }, (_, index) => {
        const key = keys[index % keys.length], variant = Math.floor(index / keys.length) + 1;
        return { id: `${key}-${variant}`, key, variant };
      });
      const deck = shuffle(pairs.flatMap(pair => [pair, pair]));
      $("#m-moves").textContent = 0; $("#m-time").textContent = 0; $("#m-time-label").textContent = timeLimit ? "เหลือเวลา" : "เวลา";
      $("#m-msg").textContent = `จับคู่รูปให้ครบ ${pairsToMatch} คู่${timeLimit ? ` · จำกัดเวลา ${timeLimit} วินาที` : " · ยิ่งเปิดน้อย ยิ่งได้ AURA เยอะ"}`;
      grid.innerHTML = deck.map((pair, i) => `<button type="button" class="mc" data-k="${pair.id}" aria-label="การ์ดใบที่ ${i + 1}"><span class="mc__in"><span class="mc__f">67</span><span class="mc__b"><img src="imgs/${pair.key}.png" alt="${names[keys.indexOf(pair.key)]}"><span class="mc__variant">${pair.variant}</span></span></span></button>`).join("");
    }
    grid.addEventListener("click", e => {
      const c = e.target.closest(".mc"); if (!c || lock || c.classList.contains("is-open") || c.classList.contains("is-done")) return;
      if (!t0) {
        t0 = Date.now();
        timer = setInterval(() => {
          const elapsed = Math.floor((Date.now() - t0) / 1000);
          if (timeLimit && elapsed >= timeLimit) {
            clearInterval(timer); lock = true; $("#m-time").textContent = "0";
            $("#m-msg").textContent = `หมดเวลา! ยังจับคู่ไม่ครบ ${done}/${pairsToMatch} คู่ · สับไพ่ใหม่เพื่อลองอีกครั้ง`;
            return;
          }
          $("#m-time").textContent = String(timeLimit ? timeLimit - elapsed : elapsed);
        }, 250);
      }
      c.classList.add("is-open"); open.push(c);
      if (open.length < 2) return;
      moves++; $("#m-moves").textContent = moves; lock = true;
      const [a, b] = open;
      if (a.dataset.k === b.dataset.k) {
        a.classList.add("is-done"); b.classList.add("is-done"); open = []; lock = false; done++;
        if (done === pairsToMatch) win();
      } else setTimeout(() => {
        a.classList.remove("is-open"); b.classList.remove("is-open"); open = [];
        lock = timeLimit > 0 && t0 && Math.floor((Date.now() - t0) / 1000) >= timeLimit;
      }, difficulty.value === "easy" ? 1000 : difficulty.value === "67" ? (round67Mode ? 120 : 180) : difficulty.value === "extreme" ? (round67Mode ? 250 : 400) : difficulty.value === "hard" ? 500 : 800);
    });
    function win() {
      clearInterval(timer); const sec = Math.floor((Date.now() - t0) / 1000), gain = Math.max(10, 70 - moves * 3 - Math.floor(sec / 4));
      const isBest = !best || moves < best; if (isBest) { best = moves; store.set("best-mem", best); $("#m-best").textContent = best + " ครั้ง"; }
      $("#m-msg").textContent = `ครบแล้ว! ใช้ ${moves} ครั้ง ใน ${sec} วินาที${isBest ? " · สถิติใหม่ 🎉" : ""}`;
      burst(30); addAura(gain, "จับคู่ 3 รัก");
    }
    $("#m-reset").addEventListener("click", build);
    difficulty.addEventListener("change", build);
    document.addEventListener("arcade:67-mode-change", () => {
      if (!t0 || done === pairsToMatch) build();
    });
    stoppers.push(() => clearInterval(timer));
    build();
  })();

  /* ---------- เกม 3: ทอดให้พอดี ---------- */
  (() => {
    const bar = $("#f-bar"), cur = $("#f-cur"), zone = $("#f-zone"), go = $("#f-go"), msg = $("#f-msg"), chick = $("#f-chick");
    const difficulty = setupDifficulty("f-difficulty", "difficulty-fry");
    const settings = {
      easy: { zones: [34, 29, 24, 20, 16], speed: .75 },
      medium: { zones: [26, 21, 17, 13, 10], speed: 1 },
      hard: { zones: [19, 15, 11, 8, 6], speed: 1.3 },
      extreme: { zones: [12, 9, 7, 5, 3], speed: 1.7 },
      67: { zones: [5, 4, 3, 2, 1], speed: 2.3 }
    };
    let round = 0, total = 0, pos = 0, d = 1, raf = 0, running = false, round67Mode = false, last = 0, best = store.get("best-fry", 0);
    $("#f-best").textContent = best;
    function loop(t) {
      if (!running) return;
      const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
      pos += d * (75 + round * 30) * settings[difficulty.value].speed * (round67Mode ? 1.35 : 1) * dt;
      if (pos >= 100) { pos = 100; d = -1; } if (pos <= 0) { pos = 0; d = 1; }
      cur.style.left = pos + "%"; raf = requestAnimationFrame(loop);
    }
    function begin() {
      if (round === 0 || round >= 5) { round = 0; total = 0; $("#f-score").textContent = 0; }
      round67Mode = is67Mode();
      zone.style.width = settings[difficulty.value].zones[round] * (round67Mode ? .7 : 1) + "%"; $("#f-round").textContent = round + 1;
      chick.className = "fry__chick"; chick.textContent = "🍗"; msg.textContent = "รอจังหวะ... แล้วกดยกไก่!";
      pos = Math.random() * 100; d = Math.random() < .5 ? 1 : -1; running = true; difficulty.disabled = true; last = performance.now();
      go.textContent = "ยกไก่! 🍗"; go.dataset.mode = "stop"; raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false; cancelAnimationFrame(raf);
      const dist = Math.abs(pos - 50), half = settings[difficulty.value].zones[round] * (round67Mode ? .7 : 1) / 2, pts = Math.max(0, Math.round(20 - dist * .8));
      difficulty.disabled = false;
      let text, cls;
      if (dist <= Math.min(2, half)) { text = "กรอบสมบูรณ์แบบ! 🔥"; cls = "is-perfect"; } else if (dist <= half) { text = "กรอบพอดี 😋"; cls = "is-good"; }
      else if (pos < 50) { text = "ยังดิบอยู่ 🥶"; cls = "is-raw"; } else { text = "ไหม้แล้ว!! 💀"; cls = "is-burnt"; }
      chick.className = "fry__chick " + cls; chick.textContent = cls === "is-burnt" ? "🔥" : cls === "is-raw" ? "🥶" : "🍗";
      total += pts; round++; $("#f-score").textContent = total; msg.textContent = `${text} +${pts}`;
      if (round >= 5) {
        const isBest = total > best; if (isBest) { best = total; store.set("best-fry", best); $("#f-best").textContent = best; }
        msg.textContent = `จบ 5 รอบ! ได้ ${total}/100${isBest ? " · สถิติใหม่ 🎉" : ""}`; if (total >= 70) burst(26);
        go.textContent = "ทอดใหม่ ↻"; go.dataset.mode = "start"; addAura(Math.round(total / 2), "ทอดให้พอดี");
      } else { go.textContent = `รอบถัดไป (${round + 1}/5) ▶`; go.dataset.mode = "start"; }
    }
    go.addEventListener("click", () => go.dataset.mode === "stop" ? stop() : begin());
    addEventListener("keydown", e => { if (e.code === "Space" && running && !$("[data-panel=fry]").hidden) { e.preventDefault(); stop(); } });
    stoppers.push(() => { running = false; cancelAnimationFrame(raf); difficulty.disabled = false; if (go.dataset.mode === "stop") { go.textContent = "เริ่มทอด ▶"; go.dataset.mode = "start"; round = 0; } });
  })();

  /* ---------- เกม 4: จับไก่ไว ---------- */
  (() => {
    const grid = $("#whack-grid"), cells = $$(".whack-cell", grid);
    const startButton = $("#w-start"), status = $("#w-status");
    const difficulty = setupDifficulty("w-difficulty", "difficulty-whack");
    let round67Mode = is67Mode();
    const settings = {
      easy: { duration: 45, target: 1300, spawn: 1050, spawnMin: 650, pepper: .1 },
      medium: { duration: 30, target: 900, spawn: 760, spawnMin: 360, pepper: .2 },
      hard: { duration: 20, target: 600, spawn: 520, spawnMin: 250, pepper: .3 },
      extreme: { duration: 15, target: 420, spawn: 300, spawnMin: 150, pepper: .4 },
      67: { duration: 15, target: 260, spawn: 210, spawnMin: 90, pepper: .48 }
    };
    function currentSettings() {
      const config = settings[difficulty.value], mode = round67Mode;
      return mode ? {
        ...config,
        duration: Math.max(8, Math.floor(config.duration * .75)),
        target: Math.max(120, Math.floor(config.target * .65)),
        spawn: Math.max(130, Math.floor(config.spawn * .65)),
        spawnMin: Math.max(70, Math.floor(config.spawnMin * .65)),
        pepper: Math.min(.7, config.pepper + .12)
      } : config;
    }
    let score = 0, combo = 0, misses = 0, best = store.get("best-whack", 0);
    let running = false, activeIndex = -1, activeKind = "";
    let clockTimer = 0, spawnTimer = 0, targetTimer = 0, endsAt = 0;
    $("#w-time").textContent = String(currentSettings().duration);
    status.textContent = `พร้อมแล้ว กดเริ่มเกมเพื่อเล่น ${currentSettings().duration} วินาที`;
    difficulty.addEventListener("change", () => {
      if (running) return;
      $("#w-time").textContent = String(currentSettings().duration);
      status.textContent = `พร้อมแล้ว กดเริ่มเกมเพื่อเล่น ${currentSettings().duration} วินาที`;
    });
    document.addEventListener("arcade:67-mode-change", () => {
      if (running) return;
      round67Mode = is67Mode();
      $("#w-time").textContent = String(currentSettings().duration);
      status.textContent = `พร้อมแล้ว กดเริ่มเกมเพื่อเล่น ${currentSettings().duration} วินาที`;
    });
    $("#w-best").textContent = best;

    function clearTarget() {
      clearTimeout(targetTimer);
      targetTimer = 0;
      if (activeIndex >= 0) {
        const cell = cells[activeIndex];
        cell.classList.remove("is-chicken", "is-golden", "is-pepper");
        cell.textContent = "";
        cell.disabled = true;
        cell.setAttribute("aria-label", "ช่องว่าง");
      }
      activeIndex = -1;
      activeKind = "";
    }

    function scheduleTarget() {
      if (!running) return;
      const config = currentSettings();
      const delay = Math.max(config.spawnMin, config.spawn - Math.floor(score / 60) * 35);
      spawnTimer = setTimeout(showTarget, delay);
    }

    function showTarget() {
      if (!running) return;
      clearTarget();
      activeIndex = Math.floor(Math.random() * cells.length);
      const roll = Math.random();
      const config = currentSettings();
      activeKind = roll < .12 ? "golden" : roll < .12 + config.pepper ? "pepper" : "chicken";
      const cell = cells[activeIndex];
      cell.classList.add(`is-${activeKind}`);
      cell.textContent = activeKind === "golden" ? "67" : activeKind === "pepper" ? "🌶️" : "🍗";
      cell.disabled = false;
      cell.setAttribute("aria-label", activeKind === "pepper" ? "พริก ห้ามแตะ" : activeKind === "golden" ? "โบนัส 67 แตะเพื่อเก็บคะแนน" : "ไก่ แตะเพื่อเก็บคะแนน");
      targetTimer = setTimeout(() => {
        const missedKind = activeKind;
        clearTarget();
        if (missedKind === "pepper") {
          status.textContent = "หลบพริกได้! ไม่เสียคะแนน";
        } else {
          misses++;
          status.textContent = `ไก่หนีไปแล้ว! พลาด ${misses} ตัว`;
        }
        scheduleTarget();
      }, config.target);
    }

    function endRound() {
      if (!running) return;
      running = false;
      difficulty.disabled = false;
      clearInterval(clockTimer);
      clearTimeout(spawnTimer);
      clearTarget();
      $("#w-time").textContent = "0";
      const isBest = score > best;
      if (isBest) {
        best = score;
        store.set("best-whack", best);
        $("#w-best").textContent = best;
      }
      status.textContent = `หมดเวลา! ${score} คะแนน · พลาด ${misses} ตัว${isBest ? " · สถิติใหม่! 🎉" : ""}`;
      startButton.disabled = false;
      startButton.textContent = "เล่นอีกครั้ง ↻";
      if (score > 0) addAura(Math.ceil(score / 10), "จับไก่ไว");
    }

    function startRound() {
      clearInterval(clockTimer);
      clearTimeout(spawnTimer);
      clearTarget();
      score = 0;
      combo = 0;
      misses = 0;
      running = true;
      round67Mode = is67Mode();
      const duration = currentSettings().duration;
      endsAt = Date.now() + duration * 1000;
      $("#w-score").textContent = "0";
      $("#w-combo").textContent = "0";
      $("#w-time").textContent = String(duration);
      status.textContent = `เริ่มแล้ว! แตะไก่และ 67 ให้ทัน · ${duration} วินาที`;
      startButton.disabled = true;
      startButton.textContent = "กำลังเล่น...";
      difficulty.disabled = true;
      showTarget();
      clockTimer = setInterval(() => {
        const remaining = Math.max(0, endsAt - Date.now());
        $("#w-time").textContent = String(Math.ceil(remaining / 1000));
        if (remaining <= 0) endRound();
      }, 100);
    }

    grid.addEventListener("click", event => {
      const cell = event.target.closest(".whack-cell");
      if (!running || !cell || cells[activeIndex] !== cell) return;
      const hitKind = activeKind;
      clearTarget();
      if (hitKind === "pepper") {
        score = Math.max(0, score - 8);
        combo = 0;
        status.textContent = "โดนพริก! −8 คะแนน · คอมโบถูกรีเซ็ต";
      } else {
        combo++;
        const points = hitKind === "golden" ? 25 + Math.min(combo - 1, 10) : 10 + Math.min(combo - 1, 10);
        score += points;
        status.textContent = `${hitKind === "golden" ? "โบนัส 67!" : "เก็บไก่ได้!"} +${points} คะแนน`;
      }
      $("#w-score").textContent = String(score);
      $("#w-combo").textContent = String(combo);
      scheduleTarget();
    });

    startButton.addEventListener("click", startRound);
    stoppers.push(() => {
      if (!running) return;
      running = false;
      difficulty.disabled = false;
      clearInterval(clockTimer);
      clearTimeout(spawnTimer);
      clearTarget();
      score = 0;
      combo = 0;
      misses = 0;
      $("#w-score").textContent = "0";
      $("#w-combo").textContent = "0";
      $("#w-time").textContent = String(currentSettings().duration);
      startButton.disabled = false;
      startButton.textContent = "เริ่มใหม่ ▶";
      status.textContent = "หยุดเกมเมื่อเปลี่ยนแท็บ · กดเริ่มใหม่เพื่อเล่นอีกครั้ง";
    });
  })();

  renderAura();
})();