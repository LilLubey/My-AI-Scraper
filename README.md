**Langkah-langkah Menjalankan Proyek:**
Instalasi Dependensi

Jalankan perintah berikut di terminal untuk menginstal semua library yang dibutuhkan:

npm install express axios cheerio puppeteer puppeteer-extra puppeteer-extra-plugin-stealth cors dotenv

**Membuat API Key DeepSeek**

- Buka website https://platform.deepseek.com di browser.
- Login menggunakan akun kamu.
- Buat API Key pribadi.

**Konfigurasi File .env**

Buat file .env di root folder proyek, lalu isi dengan format berikut:

DEEPSEEK_API_KEY=masukkan_api_key_di_sini
PORT=3000

**Menjalankan Proyek**

Buka terminal, lalu jalankan:
- cd src
- node server.js
Buka terminal baru, lalu jalankan perintah berikut untuk melakukan scraping (ganti (link contoh produk eBay) dengan link asli produk):

curl -X POST http://localhost:3000/scrape-product \
-H "Content-Type: application/json" \
-d '{"url":"(link contoh produk eBay)"}'

**Hasil**
Scraper akan otomatis membuka tab browser baru dan menampilkan hasil scrape dari produk tersebut.
