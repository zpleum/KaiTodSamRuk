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
const fortunes = ["โชคชะตาบอกว่า... ไก่ทอดอยู่ใกล้กว่าที่คิด", "วันนี้ดวงการเงินดี แต่ดวงหิวดีกว่า", "เลขนำโชค 2 ชิ้น (สั่ง 4 ก็ไม่ว่ากัน)", "เนื้อคู่ของคุณอาจเป็นหนังไก่กรอบ", "ระวัง! อาจเผลอสั่งเพิ่มอีกหนึ่งเมนู", "คำทำนาย: ความสุขจะมาในกล่องกระดาษ"];
const eatingTypes = ["นักวางแผน: เปิดเมนู 20 นาที สั่งเมนูเดิม", "นักผจญภัย: ชี้เมนูมั่ว ๆ แล้วหวังว่าจะอร่อย", "สายแบ่ง: บอกกินนิดเดียว แต่ขอชิมทุกอย่าง", "นักสะสม: สั่งครบเหมือนกำลังทำภารกิจ", "สายคุ้ม: คิดราคาต่อชิ้นเร็วกว่าคิดเลขในห้องเรียน", "ผู้เชี่ยวชาญ: แค่เห็นรูปก็รู้ว่าควรสั่งอะไร"];
const fortunesOfLife = ["พรุ่งนี้คุณจะตื่นก่อนนาฬิกาปลุก... ในฝัน", "ดวงการเงิน: เงินเข้าแล้วออกไปซื้อของทันที", "มีเกณฑ์พบคนถูกใจ ถ้าออกจากห้องก่อน", "เลขนำโชควันนี้คือเลขที่คุณลืมว่าตั้งไว้", "จักรวาลบอกให้พัก แต่เดดไลน์บอกว่าไม่", "วันนี้เหมาะกับการเริ่มต้นใหม่ เช่น เปิดแท็บใหม่", "คนโสดมีเกณฑ์เจอรักแท้ในช่องคอมเมนต์", "คุณจะได้รับข่าวดี หลังจากรีเฟรชอีเมลครั้งที่ 47"];
const excuses = ["อินเทอร์เน็ตล่มเฉพาะไฟล์นี้ครับ", "ทำเสร็จแล้วครับ แต่เซฟไว้ในจักรวาลคู่ขนาน", "หนูคิดงานลึกมากจนยังไม่ได้เริ่ม", "แมวเดินผ่านคีย์บอร์ดแล้วส่งงานผิดมิติ", "กำลังรอแรงบันดาลใจ ติดอยู่รถติดในสมอง", "ส่งแล้วครับ แต่ระบบน่าจะเขินเลยซ่อนเอาไว้", "วันนี้ปฏิทินแจ้งว่าเป็นวันพักใจแห่งชาติ", "ผมทำไว้ในใจแล้ว เหลือแค่ทำลงคอม"];
const oracleReplies = ["มีโอกาส 50/50 คือใช่กับไม่ใช่", "ถามอาจารย์ลูกแก้วก่อนนะ", "คำตอบอยู่ในใจคุณ (แต่อาจอยู่ผิดลิ้นชัก)", "จักรวาลกำลังอ่าน... โปรดลองใหม่หลังพักเที่ยง", "ใช่! ถ้าคุณเชื่อมั่นมากพอ", "ไม่แน่ใจ แต่ทำหน้าเหมือนรู้ไว้ก่อน", "ดวงดาวแนะนำให้โยนเหรียญ", "คำถามดีมาก ขอเวลาประชุมกับตัวเอง"];
const compliments = ["คุณมีพลังงานตัวเอก แม้บางวันบทจะยังไม่เขียน", "รอยยิ้มคุณน่าจะช่วยลดค่าไฟได้", "วันนี้ดูดีจนกล้องหน้าขอถ่ายซ้ำ", "คุณเก่งมากที่ผ่านวันจันทร์มาได้", "ความสามารถพิเศษ: ทำให้ห้องเงียบได้ตอนเปิดไมค์", "คุณคือเวอร์ชันลิมิเต็ด ไม่มีใครก๊อปได้", "ออร่าคุณสว่างจนหน้าจอปรับความสว่างเอง", "คุณสมควรได้พัก แม้รายการสิ่งที่ต้องทำจะยาว"];
const bandWordsA = ["แมว", "ข้าวเหนียว", "ดาวเสาร์", "รองเท้าแตะ", "คุณลุง", "กะเพรา", "มนุษย์ต่างดาว", "หมอนข้าง"];
const bandWordsB = ["ไร้ทิศทาง", "เดือดปุด", "ในวันอังคาร", "กับจักรวาล", "คืนวันเงินเดือนออก", "ผู้ไม่ยอมแพ้", "และเครื่องซักผ้า", "เสียงดังแต่ใจดี"];
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
const dailyReports = ["งานวันนี้จะเสร็จทัน... ถ้าเวลาหยุดเดิน", "ดวงความรัก: มีคนแอบชอบคุณ (แม่คุณเอง)", "พลังงานวันนี้ 87% อีก 13% อยู่ในสายชาร์จ", "คำเตือน: อย่าตอบ ‘ครับ’ ในแชตกลุ่มที่ไม่รู้เรื่อง", "ดาวพุธถอยหลัง แต่คุณยังเดินไปหยิบขนมได้", "โชคลาภกำลังมาในรูปแบบเงินทอน 2 บาท", "คุณจะหัวเราะภายใน 24 ชั่วโมง หรือคืนเงินไม่ได้", "ระดับความขยัน: กำลังโหลด... 3%", "วันนี้เหมาะกับการจัดโต๊ะ แล้ววางของกลับที่เดิมไม่ได้", "ระวังคนชื่อเหมือนคุณ จะทำเรื่องที่คุณยังไม่ได้ทำ"];
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
  notify(enabled ? "67 MODE เปิดแล้ว" : "67 MODE ปิดแล้ว");
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
    <div><p class="tag">ARCADE · เล่นสะสม AURA ปลดล็อกธีม</p><h2 id="arcade-t">ARCADE<span>67</span></h2></div>
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
    <div class="cab__bar"><span>คะแนน <b id="c-score">0</b></span><span>เวลา <b id="c-time">30</b></span><span>สถิติ <b id="c-best">0</b></span></div>
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
    <div class="cab__bar"><span>ครั้งที่เปิด <b id="m-moves">0</b></span><span>เวลา <b id="m-time">0</b>s</span><span>ดีที่สุด <b id="m-best">–</b></span><button class="btn btn--lime btn--sm" id="m-reset" type="button">สับไพ่ใหม่ ↻</button></div>
    <div class="mem" id="mem" aria-label="เกมจับคู่"></div>
    <p class="cab__hint" id="m-msg">จับคู่รูปให้ครบ 6 คู่ ยิ่งเปิดน้อย ยิ่งได้ AURA เยอะ</p>
  </div>

  <div class="cab" data-panel="fry" hidden>
    <div class="cab__bar"><span>รอบ <b id="f-round">0</b>/5</span><span>คะแนน <b id="f-score">0</b></span><span>ดีที่สุด <b id="f-best">0</b></span></div>
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
    </div>
    <div class="whack-game">
      <p class="whack-instructions">แตะไก่ให้ไวเพื่อเก็บคะแนน! <b>67</b> โบนัส + 🌶️ หักคะแนน</p>
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
  $$(".arcade__tabs [role=tab]", sec).forEach(tab => tab.addEventListener("click", () => {
    stoppers.forEach(f => f());
    $$(".arcade__tabs [role=tab]", sec).forEach(t => t.setAttribute("aria-selected", String(t === tab)));
    $$(".cab", sec).forEach(p => p.hidden = p.dataset.panel !== tab.dataset.tab);
  }));

  /* ---------- เกม 1: รับไก่ (canvas) ---------- */
  (() => {
    const cv = $("#catch-cv"), ctx = cv.getContext("2d"), W = 720, H = 440, ov = $("#c-ov");
    const src = { nu: "imgs/nobg/pnu1.png", sky: "imgs/nobg/psky1.png", yell: "imgs/nobg/pyell1.png" };
    const img = {}; Object.keys(src).forEach(k => { img[k] = new Image(); img[k].src = src[k]; });
    const types = [{ e: "🍗", p: 1, w: 48, s: 1 }, { e: "🍟", p: 2, w: 22, s: 1.15 }, { e: "🌶️", p: -3, w: 14, s: 1.2 }, { e: "🥦", p: -2, w: 12, s: 1.1 }, { e: "67", p: 7, w: 4, s: 1.5, gold: true }];
    let who = "nu", running = false, score = 0, time = 30, px = W / 2, items = [], pops = [], last = 0, spawn = 0, raf = 0, dir = 0;
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
      if (spawn <= 0) { const ty = pickType(); items.push({ t: ty, x: 30 + Math.random() * (W - 60), y: -30, v: (150 + (30 - time) * 6) * ty.s, r: 0, vr: (Math.random() - .5) * 3 }); spawn = Math.max(.2, .62 - (30 - time) * .012); }
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
      score = 0; time = 30; items = []; pops = []; spawn = 0; dir = 0; px = W / 2; running = true;
      $("#c-score").textContent = 0; ov.hidden = true; last = performance.now(); raf = requestAnimationFrame(frame);
    }
    function end() {
      running = false; cancelAnimationFrame(raf); draw();
      const isBest = score > best; if (isBest) { best = score; store.set("best-catch", best); $("#c-best").textContent = best; }
      ov.hidden = false; $("h3", ov).textContent = isBest && score > 0 ? `สถิติใหม่! ${score} คะแนน 🎉` : `ได้ ${score} คะแนน`;
      $("#c-start").textContent = "เล่นอีกรอบ ↻"; if (score >= 25) burst(26);
      addAura(score, "รับไก่");
    }
    $("#c-start").addEventListener("click", start);
    stoppers.push(() => { if (running) { running = false; cancelAnimationFrame(raf); ov.hidden = false; $("h3", ov).textContent = "รับไก่ 30 วินาที"; $("#c-start").textContent = "เริ่มเกม ▶"; } });
    draw();
  })();

  /* ---------- เกม 2: จับคู่ 3 รัก ---------- */
  (() => {
    const keys = ["pyell2", "pnu1", "psky1", "psky2", "pyell1", "pnu2"], names = ["เยล", "นุ", "สกาย", "สกาย(ค่ำ)", "เยล(โต๊ะ)", "นุ(เคาน์เตอร์)"];
    const grid = $("#mem"); let open = [], lock = false, moves = 0, done = 0, t0 = 0, timer = 0, best = store.get("best-mem", 0);
    if (best) $("#m-best").textContent = best + " ครั้ง";
    function build() {
      clearInterval(timer); open = []; lock = false; moves = 0; done = 0; t0 = 0;
      $("#m-moves").textContent = 0; $("#m-time").textContent = 0; $("#m-msg").textContent = "จับคู่รูปให้ครบ 6 คู่ ยิ่งเปิดน้อย ยิ่งได้ AURA เยอะ";
      grid.innerHTML = shuffle([...keys, ...keys]).map((k, i) => `<button type="button" class="mc" data-k="${k}" aria-label="การ์ดใบที่ ${i + 1}"><span class="mc__in"><span class="mc__f">67</span><span class="mc__b"><img src="imgs/${k}.png" alt="${names[keys.indexOf(k)]}"></span></span></button>`).join("");
    }
    grid.addEventListener("click", e => {
      const c = e.target.closest(".mc"); if (!c || lock || c.classList.contains("is-open") || c.classList.contains("is-done")) return;
      if (!t0) { t0 = Date.now(); timer = setInterval(() => $("#m-time").textContent = Math.floor((Date.now() - t0) / 1000), 500); }
      c.classList.add("is-open"); open.push(c);
      if (open.length < 2) return;
      moves++; $("#m-moves").textContent = moves; lock = true;
      const [a, b] = open;
      if (a.dataset.k === b.dataset.k) {
        a.classList.add("is-done"); b.classList.add("is-done"); open = []; lock = false; done++;
        if (done === 6) win();
      } else setTimeout(() => { a.classList.remove("is-open"); b.classList.remove("is-open"); open = []; lock = false; }, 800);
    });
    function win() {
      clearInterval(timer); const sec = Math.floor((Date.now() - t0) / 1000), gain = Math.max(10, 70 - moves * 3 - Math.floor(sec / 4));
      const isBest = !best || moves < best; if (isBest) { best = moves; store.set("best-mem", best); $("#m-best").textContent = best + " ครั้ง"; }
      $("#m-msg").textContent = `ครบแล้ว! ใช้ ${moves} ครั้ง ใน ${sec} วินาที${isBest ? " · สถิติใหม่ 🎉" : ""}`;
      burst(30); addAura(gain, "จับคู่ 3 รัก");
    }
    $("#m-reset").addEventListener("click", build);
    stoppers.push(() => clearInterval(timer));
    build();
  })();

  /* ---------- เกม 3: ทอดให้พอดี ---------- */
  (() => {
    const bar = $("#f-bar"), cur = $("#f-cur"), zone = $("#f-zone"), go = $("#f-go"), msg = $("#f-msg"), chick = $("#f-chick");
    const zones = [26, 21, 17, 13, 10];
    let round = 0, total = 0, pos = 0, d = 1, raf = 0, running = false, last = 0, best = store.get("best-fry", 0);
    $("#f-best").textContent = best;
    function loop(t) {
      if (!running) return;
      const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
      pos += d * (75 + round * 30) * dt;
      if (pos >= 100) { pos = 100; d = -1; } if (pos <= 0) { pos = 0; d = 1; }
      cur.style.left = pos + "%"; raf = requestAnimationFrame(loop);
    }
    function begin() {
      if (round === 0 || round >= 5) { round = 0; total = 0; $("#f-score").textContent = 0; }
      zone.style.width = zones[round] + "%"; $("#f-round").textContent = round + 1;
      chick.className = "fry__chick"; chick.textContent = "🍗"; msg.textContent = "รอจังหวะ... แล้วกดยกไก่!";
      pos = Math.random() * 100; d = Math.random() < .5 ? 1 : -1; running = true; last = performance.now();
      go.textContent = "ยกไก่! 🍗"; go.dataset.mode = "stop"; raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false; cancelAnimationFrame(raf);
      const dist = Math.abs(pos - 50), half = zones[round] / 2, pts = Math.max(0, Math.round(20 - dist * .8));
      let text, cls;
      if (dist <= 2) { text = "กรอบสมบูรณ์แบบ! 🔥"; cls = "is-perfect"; } else if (dist <= half) { text = "กรอบพอดี 😋"; cls = "is-good"; }
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
    stoppers.push(() => { running = false; cancelAnimationFrame(raf); if (go.dataset.mode === "stop") { go.textContent = "เริ่มทอด ▶"; go.dataset.mode = "start"; round = 0; } });
  })();

  /* ---------- เกม 4: จับไก่ไว ---------- */
  (() => {
    const grid = $("#whack-grid"), cells = $$(".whack-cell", grid);
    const startButton = $("#w-start"), status = $("#w-status");
    let score = 0, combo = 0, misses = 0, best = store.get("best-whack", 0);
    let running = false, activeIndex = -1, activeKind = "";
    let clockTimer = 0, spawnTimer = 0, targetTimer = 0, endsAt = 0;
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
      const delay = Math.max(360, 760 - Math.floor(score / 60) * 35);
      spawnTimer = setTimeout(showTarget, delay);
    }

    function showTarget() {
      if (!running) return;
      clearTarget();
      activeIndex = Math.floor(Math.random() * cells.length);
      const roll = Math.random();
      activeKind = roll < .12 ? "golden" : roll < .32 ? "pepper" : "chicken";
      const cell = cells[activeIndex];
      cell.classList.add(`is-${activeKind}`);
      cell.textContent = activeKind === "golden" ? "67" : activeKind === "pepper" ? "🌶️" : "🍗";
      cell.disabled = false;
      cell.setAttribute("aria-label", activeKind === "pepper" ? "พริก ห้ามแตะ" : activeKind === "golden" ? "โบนัส 67 แตะเพื่อเก็บคะแนน" : "ไก่ แตะเพื่อเก็บคะแนน");
      targetTimer = setTimeout(() => {
        clearTarget();
        misses++;
        status.textContent = `ไก่หนีไปแล้ว! พลาด ${misses} ตัว`;
        scheduleTarget();
      }, 900);
    }

    function endRound() {
      if (!running) return;
      running = false;
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
      endsAt = Date.now() + 30000;
      $("#w-score").textContent = "0";
      $("#w-combo").textContent = "0";
      $("#w-time").textContent = "30";
      status.textContent = "เริ่มแล้ว! แตะไก่และ 67 ให้ทัน";
      startButton.disabled = true;
      startButton.textContent = "กำลังเล่น...";
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
      clearInterval(clockTimer);
      clearTimeout(spawnTimer);
      clearTarget();
      score = 0;
      combo = 0;
      misses = 0;
      $("#w-score").textContent = "0";
      $("#w-combo").textContent = "0";
      $("#w-time").textContent = "30";
      startButton.disabled = false;
      startButton.textContent = "เริ่มใหม่ ▶";
      status.textContent = "หยุดเกมเมื่อเปลี่ยนแท็บ · กดเริ่มใหม่เพื่อเล่นอีกครั้ง";
    });
  })();

  renderAura();
})();