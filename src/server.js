const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');
require('dotenv').config();
const siteSelectors = require('./siteselector');

// Initialize puppeteer with stealth plugin
puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// User Agent Rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// Helper functions
const formatValue = (value) => value || '-';

const getSiteSelectors = (url) => {
  if (url.includes('amazon.com')) return siteSelectors.amazon;
  if (url.includes('ebay.com')) return siteSelectors.ebay;
  return siteSelectors.default;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Configure Puppeteer browser
const getBrowser = async () => {
  return await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080'
    ],
    timeout: 60000
  });
};

// Auto-scroll function for lazy-loaded content
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 300);
    });
  });
}

// Enhanced retry mechanism
async function withRetry(fn, retries = 3, delayMs = 8000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`Retry ${i + 1}/${retries} after error:`, err.message);
      await delay(delayMs * (i + 1)); // Exponential backoff
    }
  }
}

// Routes
app.post('/scrape-product', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const productData = await withRetry(async () => {
      try {
        return await scrapeWithDeepSeek(url);
      } catch (deepseekError) {
        console.log('Falling back to Puppeteer:', deepseekError.message);
        return await scrapeWithPuppeteer(url);
      }
    });

    res.json(productData);
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ 
      error: 'Scraping failed',
      details: error.message
    });
  }
});

app.post('/scrape-products', async (req, res) => {
  try {
    const { baseUrl, maxPages = 2 } = req.body;
    
    if (!baseUrl) {
      return res.status(400).json({ error: 'baseUrl is required' });
    }

    const browser = await getBrowser();
    const allProducts = [];
    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage && currentPage <= maxPages) {
      const pageUrl = currentPage === 1 ? baseUrl : `${baseUrl}?page=${currentPage}`;
      
      try {
        const { products, nextPage } = await withRetry(() => scrapeProductList(pageUrl, browser));
        allProducts.push(...products);
        hasNextPage = nextPage;
        currentPage++;
        await delay(5000 + Math.random() * 3000);
      } catch (error) {
        console.error(`Error scraping page ${currentPage}:`, error);
        hasNextPage = false;
      }
    }

    await browser.close();
    res.json({ products: allProducts, total: allProducts.length });
  } catch (error) {
    console.error('Pagination scraping error:', error);
    res.status(500).json({ 
      error: 'Pagination scraping failed',
      details: error.message
    });
  }
});

// Scraping functions
async function scrapeWithDeepSeek(url) {
  const response = await axios.post(
    'https://api.deepseek.com/v1/chat/completions',
    {
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `Extract product information as JSON with fields: name, price, description. Return missing fields as '-'.`
        },
        {
          role: "user",
          content: `Extract product data from: ${url}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    },
    {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000 // Increased timeout
    }
  );

  const productData = JSON.parse(response.data.choices[0].message.content);
  return {
    name: formatValue(productData.name),
    price: formatValue(productData.price),
    description: formatValue(productData.description),
    source: 'DeepSeek'
  };
}

async function scrapeWithPuppeteer(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.setUserAgent(USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      ['image', 'stylesheet', 'font'].includes(req.resourceType()) ? req.abort() : req.continue();
    });

    await page.goto(url, { 
      waitUntil: 'domcontentloaded', // Changed from networkidle2
      timeout: 60000
    });

    // Special handling for eBay
    if (url.includes('ebay.com')) {
      // Wait for main container first
      await page.waitForSelector('#srp-river-main', { timeout: 20000 });
      
      // Then wait for product cards
      await page.waitForSelector('.s-item', { timeout: 20000 });
      
      // Scroll to trigger lazy loading
      await autoScroll(page);
      await delay(3000); // Additional delay after scrolling
    }

    const selectors = getSiteSelectors(url);
    const html = await page.content();
    const $ = cheerio.load(html);

    return {
      name: formatValue($(selectors.name).first().text().replace('New Listing', '').trim()),
      price: formatValue($(selectors.price).first().text().trim()),
      description: formatValue($(selectors.description).first().text().trim()),
      source: 'Puppeteer'
    };
  } finally {
    await page.close();
    await browser.close();
  }
}

async function scrapeProductList(url, browser) {
  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]);
    
    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      ['image', 'stylesheet', 'font'].includes(req.resourceType()) ? req.abort() : req.continue();
    });

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Special handling for eBay
    if (url.includes('ebay.com')) {
      // Wait for main container first
      await page.waitForSelector('#srp-river-main', { timeout: 20000 });
      
      // Then wait for product cards
      await page.waitForSelector('.s-item', { timeout: 20000 });
      
      // Scroll to trigger lazy loading
      await autoScroll(page);
      await delay(3000); // Additional delay after scrolling
    }

    const selectors = getSiteSelectors(url);
    const html = await page.content();
    const $ = cheerio.load(html);

    const productLinks = $(selectors.productCard)
      .map((i, el) => $(el).find(selectors.link).attr('href'))
      .get()
      .filter(link => link && !link.startsWith('javascript'));

    const nextPage = url.includes('ebay.com') 
      ? !!$('.pagination__next').length 
      : $('a.next-page, .pagination-next').length > 0;

    const products = [];
    for (const link of productLinks.slice(0, 3)) {
      try {
        const absoluteLink = link.startsWith('http') ? link : new URL(link, url).href;
        await delay(4000 + Math.random() * 3000);
        
        const productData = await withRetry(() => 
          scrapeWithDeepSeek(absoluteLink).catch(() => scrapeWithPuppeteer(absoluteLink))
        );
        
        products.push(productData);
      } catch (error) {
        console.error(`Error scraping product at ${link}:`, error.message);
        products.push({
          name: '-',
          price: '-',
          description: '-',
          source: 'Error'
        });
      }
    }

    return { products, nextPage };
  } finally {
    await page.close();
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});