// siteSelectors.js
module.exports = {
    amazon: {
      name: '#productTitle',
      price: '.a-price-whole, .a-offscreen',
      description: '#productDescription',
      productCard: '.s-result-item',
      link: 'h2 a.a-link-normal'
    },
    ebay: {
      name: '.s-item__title',
      price: '.s-item__price',
      description: '.s-item__subtitle',
      productCard: '.s-item', // UPDATED
      link: '.s-item__link[href]', // UPDATED
      nextPage: '.pagination__next'
    },
    tokopedia: {
        name: '.x-item-title__main',
        price: '.x-price-primary',
        description: '.ux-layout-section__textual-display',
        productCard: '.s-item',
        link: '.s-item__link'
      },
    default: {
      name: 'h1',
      price: '.price, [itemprop="price"]',
      description: '.description, [itemprop="description"]',
      productCard: '.product',
      link: 'a.product-link'
    }
  };