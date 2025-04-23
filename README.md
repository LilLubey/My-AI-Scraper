Install dulu prerequisite dibawah ini:
- npm install express axios cheerio puppeteer puppeteer-extra puppeteer-extra-plugin-stealth cors dotenv

buka website "platform.deepseek.com" di browser, login, lalu buatlah API key pribadi
lalu buat file .env dan isi dengan

"DEEPSEEK_API_KEY=Api_key_disini
PORT=3000"

untuk menjalankan project

buka terminal -> ketik "cd src" -> lalu ketik "node server.js" -> buka terminal baru -> 
ketik "curl -X POST http://localhost:3000/scrape-product \
  -H "Content-Type: application/json" \
  -d '{"url":"(link contoh produk eBay)"}'

dan proyek otomatis menghasilkan output scrape di browser tab baru
