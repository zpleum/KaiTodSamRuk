const express = require("express");
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "10.200.210.117",
  port: 3306,
  user: "std09",
  password: "std09",
  database: "db_std09",
  waitForConnections: true
})

async function queryMenus() {
  const rows = await pool.query("SELECT * FROM menus");
  return rows[0];
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

// const menus = [
//   {
//     id: 1,
//     productName: "ไก่แซ่บ (2 ชิ้น)",
//     amount: 2,
//     price: 39,
//     imageURL: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800&auto=format&fit=crop&q=60",
//   },
//   {
//     id: 2,
//     productName: "ไก่ทอดกรอบ",
//     amount: 1,
//     price: 49,
//     imageURL: "https://images.unsplash.com/photo-1562967914-608f82629710?w=800&auto=format&fit=crop&q=60",
//   },
//   {
//     id: 3,
//     productName: "ทาร์ตไข่",
//     amount: 4,
//     price: 94,
//     imageURL: "https://images.unsplash.com/photo-1579372786545-d24232daf58c?w=800&auto=format&fit=crop&q=60",
//   },
//   {
//     id: 4,
//     productName: "ไก่ไม่มีกระดูก (2 ชิ้น)",
//     amount: 2,
//     price: 29,
//     imageURL: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&auto=format&fit=crop&q=60",
//   },
//   {
//     id: 5,
//     productName: "เฟรนช์ฟรายส์ (ปกติ)",
//     amount: 1,
//     price: 49,
//     imageURL: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&auto=format&fit=crop&q=60",
//   },
//   {
//     id: 6,
//     productName: "วิงส์แซ่บ (ชุด 4 ชิ้น)",
//     amount: 4,
//     price: 89,
//     imageURL: "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=800&auto=format&fit=crop&q=60",
//   },
//   {
//     id: 7,
//     productName: "เป๊ปซี่ (แก้วใหญ่)",
//     amount: 1,
//     price: 45,
//     imageURL: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=800&auto=format&fit=crop&q=60",
//   },
//   {
//     id: 8,
//     productName: "เดอะบอกซ์ ออลสตาร์",
//     amount: 1,
//     price: 169,
//     imageURL: "https://images.ctfassets.net/n4pc9wlortyn/5K1jergSBUiToYshHuHnTB/217680e95da8d849f7851615fb33b174/meals_800x600.png?h=600&w=800&fm=webp&fit=fill",
//   },
//   {
//     id: 9,
//     productName: "เบอร์เกอร์ไก่กรอบฮอตแอนด์สไปซี่",
//     amount: 1,
//     price: 69,
//     imageURL: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=60",
//   },
//   {
//     id: 10,
//     productName: "นักเก็ตส์ (4 ชิ้น)",
//     amount: 4,
//     price: 59,
//     imageURL: "https://images.unsplash.com/photo-1562967916-eb82221dfb92?w=800&auto=format&fit=crop&q=60",
//   },
//   {
//     id: 11,
//     productName: "ข้าวไก่กรอบแกงเขียวหวาน",
//     amount: 1,
//     price: 79,
//     imageURL: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=60",
//   },
//   {
//     id: 12,
//     productName: "มันสำหลังบด (แมดพาสต้า ไซส์ปกติ)",
//     amount: 1,
//     price: 49,
//     imageURL: "https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=800&auto=format&fit=crop&q=60",
//   },
// ];

app.get("/", (req, res) => {
  res.send("KFC API Server - Working");
});

app.get("/menu", async (req, res) => {
  try {
    res.json(await queryMenus());
  } catch (error) {
    console.error("Failed to load menus:", error.message);
    res.status(500).json({ error: "โหลดรายการเมนูไม่สำเร็จ" });
  }
});

app.post("/menu", async (req, res) => {
  const { productName, amount, price, imageURL = "" } = req.body || {};
  const name = typeof productName === "string" ? productName.trim() : "";
  const itemAmount = Number(amount);
  const itemPrice = Number(price);
  const image = typeof imageURL === "string" ? imageURL.trim() : "";

  if (!name || name.length > 100) {
    return res.status(400).json({ error: "ชื่อเมนูต้องมี 1-100 ตัวอักษร" });
  }
  if (!Number.isInteger(itemAmount) || itemAmount < 1 || itemAmount > 999) {
    return res.status(400).json({ error: "จำนวนต้องเป็นจำนวนเต็มระหว่าง 1-999" });
  }
  if (!Number.isFinite(itemPrice) || itemPrice < 0 || itemPrice > 100000) {
    return res.status(400).json({ error: "ราคาต้องอยู่ระหว่าง 0-100000 บาท" });
  }
  if (image) {
    try {
      const parsedImage = new URL(image);
      if (!["http:", "https:"].includes(parsedImage.protocol)) throw new Error("Invalid protocol");
    } catch {
      return res.status(400).json({ error: "ลิงก์รูปต้องเป็น URL แบบ HTTP หรือ HTTPS" });
    }
  }

  try {
    const [result] = await pool.execute(
      "INSERT INTO menus (productName, amount, price, imageURL) VALUES (?, ?, ?, ?)",
      [name, itemAmount, itemPrice, image]
    );
    res.status(201).json({
      id: result.insertId,
      productName: name,
      amount: itemAmount,
      price: itemPrice,
      imageURL: image
    });
  } catch (error) {
    console.error("Failed to create menu:", error.message);
    res.status(500).json({ error: "เพิ่มเมนูลงฐานข้อมูลไม่สำเร็จ" });
  }
});

app.delete("/menu/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: "รหัสเมนูไม่ถูกต้อง" });
  }

  try {
    const [result] = await pool.execute("DELETE FROM menus WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "ไม่พบเมนูนี้ในฐานข้อมูล" });
    }
    res.json({ success: true, id });
  } catch (error) {
    console.error("Failed to delete menu:", error.message);
    res.status(500).json({ error: "ลบเมนูจากฐานข้อมูลไม่สำเร็จ" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});