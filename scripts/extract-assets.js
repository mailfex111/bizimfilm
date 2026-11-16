const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SRC = "C:/Users/90551/.gemini/antigravity/brain/d0708d21-e21a-49a0-8d16-b49d7e42c8f4/.user_uploaded/media_1794856796691.jpg";
const OUT_DIR = path.join(__dirname, "..", "public", "images");

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  // 1. Hero Couple area
  await sharp(SRC)
    .extract({ left: 392, top: 48, width: 480, height: 204 })
    .resize(1200, 510, { kernel: sharp.kernel.lanczos3 })
    .modulate({ saturation: 1.08 })
    .sharpen()
    .webp({ quality: 90 })
    .toFile(path.join(OUT_DIR, "hero-couple.webp"));

  // 2. Polaroid Sunset (full heart in sky + couple)
  await sharp(SRC)
    .extract({ left: 395, top: 48, width: 455, height: 204 })
    .resize(900, 620, { fit: "cover", position: "center", kernel: sharp.kernel.lanczos3 })
    .modulate({ saturation: 1.06 })
    .sharpen()
    .webp({ quality: 88 })
    .toFile(path.join(OUT_DIR, "polaroid-sunset.webp"));

  // 3. Polaroid Night (clean interior of night candlelight photo, excluding white border)
  await sharp(SRC)
    .extract({ left: 447, top: 405, width: 124, height: 59 })
    .resize(760, 480, { fit: "cover", kernel: sharp.kernel.lanczos3 })
    .sharpen()
    .webp({ quality: 86 })
    .toFile(path.join(OUT_DIR, "polaroid-night.webp"));

  // 4. Polaroid Hands (clean interior of holding hands photo)
  await sharp(SRC)
    .extract({ left: 586, top: 410, width: 64, height: 68 })
    .resize(600, 640, { fit: "cover", kernel: sharp.kernel.lanczos3 })
    .sharpen()
    .webp({ quality: 86 })
    .toFile(path.join(OUT_DIR, "polaroid-hands.webp"));

  // 5. Avatars (Ben & Sen)
  await sharp(SRC)
    .extract({ left: 927, top: 9, width: 28, height: 28 })
    .resize(128, 128, { kernel: sharp.kernel.lanczos3 })
    .sharpen()
    .webp({ quality: 90 })
    .toFile(path.join(OUT_DIR, "avatar-ben.webp"));

  await sharp(SRC)
    .extract({ left: 950, top: 9, width: 28, height: 28 })
    .resize(128, 128, { kernel: sharp.kernel.lanczos3 })
    .sharpen()
    .webp({ quality: 90 })
    .toFile(path.join(OUT_DIR, "avatar-sen.webp"));

  // 6. Album Art in bottom player
  await sharp(SRC)
    .extract({ left: 23, top: 531, width: 41, height: 39 })
    .resize(160, 160, { kernel: sharp.kernel.lanczos3 })
    .sharpen()
    .webp({ quality: 90 })
    .toFile(path.join(OUT_DIR, "album-art.webp"));

  // 7. Extract the 6 "Devam Et" card backgrounds from the clean top artwork region (top: 255, height: 47 -> zero baked-in text!)
  const cards = [
    { name: "card-book.webp", left: 38, width: 150, top: 255, height: 47 },
    { name: "card-videos.webp", left: 199, width: 151, top: 255, height: 47 },
    { name: "card-photos.webp", left: 362, width: 151, top: 255, height: 47 },
    { name: "card-music.webp", left: 525, width: 151, top: 255, height: 47 },
    { name: "card-dates.webp", left: 688, width: 151, top: 255, height: 47 },
    { name: "card-notes.webp", left: 851, width: 150, top: 255, height: 47 },
  ];

  for (const c of cards) {
    await sharp(SRC)
      .extract({ left: c.left, top: c.top, width: c.width, height: c.height })
      .resize(520, 260, { fit: "cover", position: "north", kernel: sharp.kernel.lanczos3 })
      .modulate({ saturation: 1.06 })
      .sharpen()
      .webp({ quality: 88 })
      .toFile(path.join(OUT_DIR, c.name));
  }

  console.log("Clean WebP assets generated!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
