/**
 * ============================================================================
 * STORE CLIENT SCRIPT (script.js)
 * Handles API calls, Cart management via localStorage, JWT Auth, and UI views.
 * ============================================================================
 */

// MANDATORY CURRENCY FORMATTER
const formatINR = (price) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(price);

// ----------------------------------------------------
// Toast Notification Utility
// ----------------------------------------------------
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span style="font-weight: bold; font-size: 1.1rem;">${icon}</span> <span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ----------------------------------------------------
// Cart Management (localStorage)
// ----------------------------------------------------
function getCart() {
  try {
    const cart = localStorage.getItem('cart');
    return cart ? JSON.parse(cart) : [];
  } catch (e) {
    console.error('Error reading cart from localStorage', e);
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCountBadge();
  initPolicyLinks();
  } catch (e) {
    console.error('Error saving cart to localStorage', e);
  }
}

function addToCart(product, quantity = 1) {
  if (product.price_status === 'unverified' || !product.is_purchasable || product.price == null) {
    showToast(`"${product.name}" is currently a catalog showcase item. Price on request.`, 'info');
    return;
  }

  const cart = getCart();
  const existingIndex = cart.findIndex((item) => item.id === product.id);

  if (existingIndex > -1) {
    cart[existingIndex].quantity += quantity;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      category: product.category,
      quantity: quantity
    });
  }

  saveCart(cart);
  showToast(`Added "${product.name}" to cart! 🛍️`, 'success');

  // Add bounce effect to cart badge
  const badge = document.querySelector('.cart-badge');
  if (badge) {
    badge.classList.remove('bump');
    void badge.offsetWidth; // trigger reflow
    badge.classList.add('bump');
  }
}

function removeFromCart(productId) {
  let cart = getCart();
  cart = cart.filter((item) => item.id !== productId);
  saveCart(cart);
  showToast('Item removed from cart.', 'info');
}

function updateCartQuantity(productId, quantity) {
  const cart = getCart();
  const index = cart.findIndex((item) => item.id === productId);

  if (index > -1) {
    if (quantity <= 0) {
      cart.splice(index, 1);
      showToast('Item removed from cart.', 'info');
    } else {
      cart[index].quantity = quantity;
    }
    saveCart(cart);
  }
}

function clearCart() {
  localStorage.removeItem('cart');
  updateCartCountBadge();
}

function updateCartCountBadge() {
  const cart = getCart();
  const totalCount = cart.reduce((acc, item) => acc + (item.quantity || 1), 0);
  const badges = document.querySelectorAll('.cart-badge');
  badges.forEach((badge) => {
    badge.textContent = totalCount;
  });
}

// ----------------------------------------------------
// Authentication Helpers (localStorage)
// ----------------------------------------------------
function getAuthToken() {
  return localStorage.getItem('token');
}

function setupPasswordToggle(btnId, inputId) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;

  const eyeIconSvg = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `;
  const eyeOffIconSvg = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
  `;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const isPassword = input.getAttribute('type') === 'password';
    input.setAttribute('type', isPassword ? 'text' : 'password');
    btn.innerHTML = isPassword ? eyeOffIconSvg : eyeIconSvg;
    btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    btn.setAttribute('title', isPassword ? 'Hide password' : 'Show password');
  });
}

function getAuthUser() {
  try {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch (e) {
    return null;
  }
}

function setAuthSession(token, user) {
  if (token) localStorage.setItem('token', token);
  if (user) localStorage.setItem('user', JSON.stringify(user));
  updateNavbarAuth();
}

async function performLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.error('Logout error:', err);
  }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showToast('You have been logged out.', 'info');
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 400);
}

async function updateNavbarAuth() {
  const authNavContainer = document.getElementById('nav-auth-container');
  if (!authNavContainer) return;

  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      const user = data.user || getAuthUser();
      if (user) localStorage.setItem('user', JSON.stringify(user));

      const firstName = user && (user.name || user.full_name)
        ? (user.name || user.full_name).split(' ')[0]
        : 'Shopper';

      authNavContainer.innerHTML = `
        <span class="user-greeting">Hi, <strong>${escapeHtml(firstName)}</strong></span>
        <button type="button" class="btn-logout" id="btn-logout" title="Sign out of AuraStore">Logout</button>
      `;

      document.getElementById('btn-logout')?.addEventListener('click', (e) => {
        e.preventDefault();
        performLogout();
      });
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Check if current page is protected
      const pathname = window.location.pathname.toLowerCase();
      const isPublicPage = pathname.endsWith('login.html') || pathname.endsWith('register.html') || pathname === '/login' || pathname === '/register';
      if (!isPublicPage) {
        window.location.href = 'login.html';
        return;
      }

      authNavContainer.innerHTML = `
        <a href="login.html" class="nav-link" id="nav-login">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          Sign In
        </a>
        <a href="register.html" class="nav-link" id="nav-register">Create Account</a>
      `;
    }
  } catch (err) {
    console.warn('Navbar auth verification:', err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// ----------------------------------------------------
// Page: Index (Home - Catalog & Hero Carousel)
// ----------------------------------------------------
let allProductsCache = [];
let allCategoriesCache = [];
let activeCategory = 'All';
let activePriceMin = 0;
let activePriceMax = 999999;
let activeInStockOnly = false;
let activeFestiveOnly = false;
let activeSort = 'featured';
let isFilterDrawerOpen = false;

// Catalog Pagination State (batches of 12)
let catalogCurrentPage = 1;
const CATALOG_PAGE_SIZE = 12;
let catalogTotalPages = 1;
let catalogTotalCount = 0;
let catalogHasMore = false;
const catalogLoadedIds = new Set();
let isFetchingCatalog = false;
let searchDebounceTimer = null;

/**
 * Lightweight, Realistic Diwali Fireworks & Golden Particles Canvas
 * - Generates occasional firework spark bursts over night sky
 * - Gentle floating golden ambient dust
 * - Capped at low particle counts (<60) to avoid CPU load
 * - Respects prefers-reduced-motion
 * - Auto-pauses when hero section is not visible
 */
function initDiwaliFireworksCanvas() {
  const canvas = document.getElementById('diwali-fireworks-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isReducedMotion) {
    canvas.style.display = 'none';
    return;
  }

  let width = (canvas.width = canvas.offsetWidth || window.innerWidth);
  let height = (canvas.height = canvas.offsetHeight || 380);

  function resizeCanvas() {
    if (!canvas) return;
    width = canvas.width = canvas.offsetWidth || window.innerWidth;
    height = canvas.height = canvas.offsetHeight || 380;
  }
  window.addEventListener('resize', resizeCanvas, { passive: true });

  const particles = [];
  let isVisible = true;
  let animFrameId = null;

  // Use IntersectionObserver to sleep animation when hero is off-screen
  const heroSection = document.getElementById('hero-section');
  if ('IntersectionObserver' in window && heroSection) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isVisible = entry.isIntersecting;
        if (isVisible && !animFrameId) {
          animFrameId = requestAnimationFrame(renderLoop);
        }
      });
    }, { threshold: 0.05 });
    observer.observe(heroSection);
  }

  const sparkColors = [
    '#ff6000', // Vibrant Saffron
    '#fbbf24', // Warm Gold
    '#f43f5e', // Festive Crimson
    '#c084fc', // Royal Violet
    '#38bdf8', // Sparkler Sky Blue
    '#ffd700', // Deep Gold
    '#ffffff'  // Pure White
  ];

  function createFireworkBurst(x, y) {
    const count = 16 + Math.floor(Math.random() * 10);
    const col1 = sparkColors[Math.floor(Math.random() * sparkColors.length)];
    const col2 = sparkColors[Math.floor(Math.random() * sparkColors.length)];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.25 - 0.12);
      const speed = 1.4 + Math.random() * 2.8;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        decay: 0.016 + Math.random() * 0.018,
        radius: 1.2 + Math.random() * 1.6,
        color: Math.random() > 0.4 ? col1 : col2
      });
    }
  }

  // Floating ambient golden bokeh motes
  const ambientMotes = [];
  for (let i = 0; i < 20; i++) {
    ambientMotes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.15 - Math.random() * 0.35,
      radius: 1 + Math.random() * 1.8,
      alpha: 0.2 + Math.random() * 0.55,
      pulseSpeed: 0.02 + Math.random() * 0.03
    });
  }

  let nextBurstTime = Date.now() + 500;

  function renderLoop() {
    if (!isVisible) {
      animFrameId = null;
      return;
    }

    ctx.clearRect(0, 0, width, height);

    // 1. Ambient golden floating particles
    for (let i = 0; i < ambientMotes.length; i++) {
      const m = ambientMotes[i];
      m.x += m.vx;
      m.y += m.vy;
      m.alpha += Math.sin(Date.now() * m.pulseSpeed) * 0.008;
      if (m.y < 0) m.y = height;
      if (m.x < 0) m.x = width;
      if (m.x > width) m.x = 0;

      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(251, 191, 36, ${Math.max(0.12, Math.min(0.75, m.alpha))})`;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 4;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // 2. Trigger periodic firework bursts in upper sky area
    const now = Date.now();
    if (now > nextBurstTime && particles.length < 50) {
      const burstX = width * (0.2 + Math.random() * 0.6);
      const burstY = height * (0.15 + Math.random() * 0.32);
      createFireworkBurst(burstX, burstY);
      nextBurstTime = now + 1600 + Math.random() * 2000;
    }

    // 3. Update and draw burst sparks
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.038; // gravity
      p.vx *= 0.985; // air drag
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 5;
      ctx.fill();
    }

    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;

    animFrameId = requestAnimationFrame(renderLoop);
  }

  animFrameId = requestAnimationFrame(renderLoop);
}

async function initIndexPage() {
  const productsGrid = document.getElementById('products-grid');
  const categoryFilter = document.getElementById('category-filter');
  const searchInput = document.getElementById('search-input');
  const filterBtn = document.getElementById('btn-filter-toggle');
  const filterDrawer = document.getElementById('filter-drawer');
  const sortSelect = document.getElementById('sort-select');
  const clearFiltersBtn = document.getElementById('btn-clear-filters');
  const applyFiltersBtn = document.getElementById('btn-apply-filters');
  const inStockCheckbox = document.getElementById('filter-in-stock');
  const festiveCheckbox = document.getElementById('filter-festive-deals');
  const priceSlider = document.getElementById('price-range-slider');
  const priceSliderVal = document.getElementById('price-slider-val');

  if (!productsGrid) return;

  // 0. Initialize Diwali Fireworks Canvas & Hero CTAs
  initDiwaliFireworksCanvas();

  const shopDiwaliBtn = document.getElementById('btn-shop-diwali-deals');
  if (shopDiwaliBtn) {
    shopDiwaliBtn.addEventListener('click', (e) => {
      e.preventDefault();
      activeSort = 'featured';
      activeFestiveOnly = true;
      if (festiveCheckbox) festiveCheckbox.checked = true;
      if (sortSelect) sortSelect.value = 'featured';
      filterAndRenderProducts();
      document.getElementById('products-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Diwali Deals & Verified Showcase Activated! ✨', 'success');
    });
  }

  const viewAllBtn = document.getElementById('btn-view-all-products');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.resetAllFilters === 'function') {
        window.resetAllFilters();
      }
      document.getElementById('products-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Hero Slider carousel controls
  const heroPrevBtn = document.getElementById('hero-prev-btn');
  const heroNextBtn = document.getElementById('hero-next-btn');
  const heroDots = document.querySelectorAll('.hero-dot');
  let currentHeroSlide = 0;
  const totalHeroSlides = heroDots.length || 4;

  function updateHeroSlide(index) {
    currentHeroSlide = (index + totalHeroSlides) % totalHeroSlides;
    heroDots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === currentHeroSlide);
    });
  }

  heroPrevBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    updateHeroSlide(currentHeroSlide - 1);
  });

  heroNextBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    updateHeroSlide(currentHeroSlide + 1);
  });

  heroDots.forEach((dot) => {
    dot.addEventListener('click', (e) => {
      e.preventDefault();
      const slide = parseInt(dot.getAttribute('data-slide') || '0', 10);
      updateHeroSlide(slide);
    });
  });

  // Category horizontal scroll next button
  const catScrollNext = document.getElementById('cat-scroll-next');
  const catScrollWrapper = document.getElementById('diwali-categories-scroll-wrapper');
  if (catScrollNext && catScrollWrapper) {
    catScrollNext.addEventListener('click', (e) => {
      e.preventDefault();
      catScrollWrapper.scrollBy({ left: 240, behavior: 'smooth' });
    });
  }

  // 1. Filter Drawer Toggle Button
  if (filterBtn && filterDrawer) {
    filterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      isFilterDrawerOpen = !isFilterDrawerOpen;
      filterDrawer.style.display = isFilterDrawerOpen ? 'block' : 'none';
      filterBtn.classList.toggle('active', isFilterDrawerOpen);
      filterBtn.setAttribute('aria-expanded', String(isFilterDrawerOpen));

      if (isFilterDrawerOpen) {
        filterDrawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    applyFiltersBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      isFilterDrawerOpen = false;
      filterDrawer.style.display = 'none';
      filterBtn.classList.remove('active');
      filterBtn.setAttribute('aria-expanded', 'false');
    });
  }

  // 2. Sort Select Listener
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      activeSort = sortSelect.value;
      filterAndRenderProducts();
    });
  }

  // 3. Price Presets Chips Listener
  const priceChips = document.querySelectorAll('#price-presets .price-chip');
  priceChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      priceChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      activePriceMin = parseFloat(chip.getAttribute('data-min')) || 0;
      activePriceMax = parseFloat(chip.getAttribute('data-max')) || 999999;

      if (priceSlider && priceSliderVal) {
        if (activePriceMax >= 99999) {
          priceSlider.value = 4000;
          priceSliderVal.textContent = 'All (₹4,000+)';
        } else {
          priceSlider.value = activePriceMax;
          priceSliderVal.textContent = formatINR(activePriceMax);
        }
      }

      filterAndRenderProducts();
    });
  });

  // 4. Price Slider Listener
  if (priceSlider && priceSliderVal) {
    priceSlider.addEventListener('input', () => {
      activePriceMax = parseFloat(priceSlider.value) || 4000;
      activePriceMin = 0;
      priceSliderVal.textContent = formatINR(activePriceMax);

      // Deactivate presets if custom slider moved
      priceChips.forEach(c => c.classList.remove('active'));

      filterAndRenderProducts();
    });
  }

  // 5. In Stock & Festive Deals Checkbox Listeners
  if (inStockCheckbox) {
    inStockCheckbox.addEventListener('change', () => {
      activeInStockOnly = inStockCheckbox.checked;
      filterAndRenderProducts();
    });
  }

  if (festiveCheckbox) {
    festiveCheckbox.addEventListener('change', () => {
      activeFestiveOnly = festiveCheckbox.checked;
      filterAndRenderProducts();
    });
  }

  // 6. Reset Filters Button
  window.resetAllFilters = function() {
    activeCategory = 'All';
    activePriceMin = 0;
    activePriceMax = 999999;
    activeInStockOnly = false;
    activeFestiveOnly = false;
    activeSort = 'featured';

    if (inStockCheckbox) inStockCheckbox.checked = false;
    if (festiveCheckbox) festiveCheckbox.checked = false;
    if (sortSelect) sortSelect.value = 'featured';

    if (priceSlider && priceSliderVal) {
      priceSlider.value = 4000;
      priceSliderVal.textContent = '₹4,000';
    }

    priceChips.forEach((c, idx) => {
      c.classList.toggle('active', idx === 0);
    });

    // Reset pills
    categoryFilter?.querySelectorAll('.category-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-category') === 'All');
    });

    // Reset category radio inputs in drawer
    document.querySelectorAll('.cat-filter-radio').forEach(radio => {
      radio.checked = radio.value === 'All';
    });

    filterAndRenderProducts();
    showToast('Filters reset to default.', 'info');
  };

  clearFiltersBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    window.resetAllFilters();
  });

  // Individual chip clear helpers exposed on window
  window.clearCategoryFilter = function() {
    activeCategory = 'All';
    categoryFilter?.querySelectorAll('.category-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-category') === 'All');
    });
    document.querySelectorAll('.cat-filter-radio').forEach(radio => {
      radio.checked = radio.value === 'All';
    });
    filterAndRenderProducts();
  };

  window.clearPriceFilter = function() {
    activePriceMin = 0;
    activePriceMax = 999999;
    priceChips.forEach((c, idx) => c.classList.toggle('active', idx === 0));
    if (priceSlider && priceSliderVal) {
      priceSlider.value = 4000;
      priceSliderVal.textContent = '₹4,000';
    }
    filterAndRenderProducts();
  };

  window.clearInStockFilter = function() {
    activeInStockOnly = false;
    if (inStockCheckbox) inStockCheckbox.checked = false;
    filterAndRenderProducts();
  };

  window.clearFestiveFilter = function() {
    activeFestiveOnly = false;
    if (festiveCheckbox) festiveCheckbox.checked = false;
    filterAndRenderProducts();
  };

  window.clearSortFilter = function() {
    activeSort = 'featured';
    if (sortSelect) sortSelect.value = 'featured';
    filterAndRenderProducts();
  };

  // Load and render categories
  try {
    const catRes = await fetch('/api/categories');
    if (catRes.ok) {
      allCategoriesCache = await catRes.json();

      // Wire up Category Navigation cards (preserving custom icons from reference)
      if (categoryFilter) {
        const catButtons = categoryFilter.querySelectorAll('.category-pill, .diwali-cat-card');
        catButtons.forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            catButtons.forEach(b => {
              b.classList.remove('active');
              b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            activeCategory = btn.getAttribute('data-category') || 'All';

            // Sync with drawer radio
            document.querySelectorAll('.cat-filter-radio').forEach(radio => {
              radio.checked = radio.value === activeCategory;
            });

            filterAndRenderProducts();

            // Smooth scroll to catalog grid
            const grid = document.getElementById('products-grid');
            if (grid && window.scrollY < grid.offsetTop - 150) {
              grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        });
      }

      // Render categories inside filter drawer
      const drawerCatContainer = document.getElementById('filter-categories-checkboxes');
      if (drawerCatContainer) {
        let drawerCatHtml = `
          <label class="filter-checkbox-label">
            <input type="radio" name="drawer-cat" class="filter-checkbox cat-filter-radio" value="All" checked />
            <span>All Categories</span>
          </label>
        `;
        allCategoriesCache.forEach((cat) => {
          drawerCatHtml += `
            <label class="filter-checkbox-label">
              <input type="radio" name="drawer-cat" class="filter-checkbox cat-filter-radio" value="${escapeHtml(cat)}" />
              <span>${escapeHtml(cat)}</span>
            </label>
          `;
        });
        drawerCatContainer.innerHTML = drawerCatHtml;

        drawerCatContainer.querySelectorAll('.cat-filter-radio').forEach((radio) => {
          radio.addEventListener('change', () => {
            if (radio.checked) {
              activeCategory = radio.value;
              categoryFilter?.querySelectorAll('.category-pill').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-category') === activeCategory);
              });
              filterAndRenderProducts();
            }
          });
        });
      }
    }
  } catch (err) {
    console.error('Failed to load categories', err);
  }

  // Handle URL query parameter search on index page
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get('search');
  if (searchParam && searchInput) {
    searchInput.value = searchParam;
  }

  // Handle live search with debounce to reset pagination and avoid stale results
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        filterAndRenderProducts();
      }, 250);
    });
  }

  // Attach Load More button listener
  const loadMoreBtn = document.getElementById('btn-load-more');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!isFetchingCatalog && catalogHasMore) {
        fetchCatalogProducts(catalogCurrentPage + 1, true);
      }
    });
  }

  // Initial load: fetch page 1 (batch of 12)
  fetchCatalogProducts(1, false);
}

/**
 * Render single product card HTML
 * Consistently references stock_quantity for stock availability
 */
function renderProductCardHTML(product) {
  const isVerified = product.price_status === 'verified' && product.price != null;
  const isPurchasable = Boolean(product.is_purchasable) && isVerified;
  const stockQty = Number(product.stock_quantity !== undefined ? product.stock_quantity : (product.stock || 0));
  const isAvailable = isPurchasable && stockQty > 0;

  let stockBadgeHtml = '';
  if (isVerified) {
    stockBadgeHtml = `<span class="stock-tag ${isAvailable ? '' : 'out-of-stock'}">${isAvailable ? 'In Stock' : 'Out of Stock'}</span>`;
  } else {
    stockBadgeHtml = `<span class="stock-tag unverified-tag">Catalog Item</span>`;
  }

  let priceHtml = '';
  let buttonHtml = '';
  if (isVerified) {
    priceHtml = `<div class="product-price">${formatINR(product.price)}</div>`;
    buttonHtml = isAvailable ? `
      <button type="button" class="btn-add-cart" data-id="${product.id}" title="Add to Cart">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
        Add
      </button>
    ` : `
      <button type="button" class="btn-add-cart btn-disabled" disabled title="Out of Stock">Sold Out</button>
    `;
  } else {
    priceHtml = `<div class="product-price price-unverified">Price on Request</div>`;
    buttonHtml = `
      <a href="product.html?id=${product.id}" class="btn-inquire" title="View details and inquire">View</a>
    `;
  }

  let ratingHtml = '';
  if (product.rating != null && Number(product.rating) > 0) {
    ratingHtml = `<span class="product-rating-badge">★ ${Number(product.rating).toFixed(1)}</span>`;
  }

  let brandHtml = '';
  if (product.brand && product.brand !== 'AuraStore') {
    brandHtml = `<span class="product-card-brand" title="${escapeHtml(product.brand)}">${escapeHtml(product.brand)}</span>`;
  }

  return `
    <article class="product-card" id="product-card-${product.id}">
      <a href="product.html?id=${product.id}" class="product-card-img-wrapper" title="View details for ${escapeHtml(product.name)}">
        <img class="product-card-img" src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80';" />
        <span class="category-badge">${escapeHtml(product.category || 'Special')}</span>
        ${stockBadgeHtml}
      </a>
      <div class="product-card-body">
        <div class="product-meta-row">
          ${brandHtml}
          ${ratingHtml}
        </div>
        <h3 class="product-title">
          <a href="product.html?id=${product.id}">${escapeHtml(product.name)}</a>
        </h3>
        <p class="product-desc">${escapeHtml(product.description || '')}</p>
        <div class="product-card-footer">
          ${priceHtml}
          ${buttonHtml}
        </div>
      </div>
    </article>
  `;
}

/**
 * Attach Add to Cart event listeners to newly rendered product cards
 */
function attachAddToCartListeners(container) {
  if (!container) return;
  container.querySelectorAll('.btn-add-cart').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = parseInt(btn.getAttribute('data-id'), 10);
      const product = allProductsCache.find((p) => p.id === id);
      if (product) {
        addToCart(product, 1);
      }
    });
  });
}

/**
 * Update UI Filter Badges and Active Filter Chips Bar
 */
function updateActiveFilterUI() {
  const filterCountBadge = document.getElementById('filter-count-badge');
  const filterSummary = document.getElementById('filter-active-summary');
  const chipsContainer = document.getElementById('active-filter-chips');

  let activeFilterCount = 0;
  const chips = [];

  if (activeCategory && activeCategory !== 'All') {
    activeFilterCount++;
    chips.push(`
      <span class="filter-chip">
        Category: <strong>${escapeHtml(activeCategory)}</strong>
        <button type="button" class="filter-chip-remove" onclick="window.clearCategoryFilter()" title="Remove category filter">✕</button>
      </span>
    `);
  }

  if (activePriceMin > 0 || activePriceMax < 999999) {
    activeFilterCount++;
    const label = activePriceMax >= 99999 ? `₹2,000+` : (activePriceMin === 0 ? `Under ${formatINR(activePriceMax)}` : `${formatINR(activePriceMin)} - ${formatINR(activePriceMax)}`);
    chips.push(`
      <span class="filter-chip">
        Price: <strong>${label}</strong>
        <button type="button" class="filter-chip-remove" onclick="window.clearPriceFilter()" title="Remove price filter">✕</button>
      </span>
    `);
  }

  if (activeInStockOnly) {
    activeFilterCount++;
    chips.push(`
      <span class="filter-chip">
        <strong>In Stock Only</strong>
        <button type="button" class="filter-chip-remove" onclick="window.clearInStockFilter()" title="Remove in-stock filter">✕</button>
      </span>
    `);
  }

  if (activeFestiveOnly) {
    activeFilterCount++;
    chips.push(`
      <span class="filter-chip">
        <strong>Festive Deals (≤ ₹1,500)</strong>
        <button type="button" class="filter-chip-remove" onclick="window.clearFestiveFilter()" title="Remove festive deals filter">✕</button>
      </span>
    `);
  }

  if (activeSort && activeSort !== 'featured') {
    activeFilterCount++;
    const sortLabels = {
      'price-asc': 'Price: Low to High',
      'price-desc': 'Price: High to Low',
      'name-asc': 'Name: A to Z',
      'stock-desc': 'In-Stock First'
    };
    chips.push(`
      <span class="filter-chip">
        Sort: <strong>${sortLabels[activeSort] || activeSort}</strong>
        <button type="button" class="filter-chip-remove" onclick="window.clearSortFilter()" title="Reset sort">✕</button>
      </span>
    `);
  }

  if (filterCountBadge) {
    if (activeFilterCount > 0) {
      filterCountBadge.style.display = 'inline-flex';
      filterCountBadge.textContent = activeFilterCount;
    } else {
      filterCountBadge.style.display = 'none';
    }
  }

  if (filterSummary) {
    filterSummary.textContent = activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active` : 'All Items';
  }

  if (chipsContainer) {
    if (chips.length > 0) {
      chipsContainer.innerHTML = `
        <span class="active-chip-title">Active Filters:</span>
        ${chips.join('')}
        <button type="button" class="btn-clear-filters" onclick="window.resetAllFilters()" style="margin-left: 6px;">Clear All</button>
      `;
      chipsContainer.style.display = 'flex';
    } else {
      chipsContainer.innerHTML = '';
      chipsContainer.style.display = 'none';
    }
  }
}

/**
 * Fetch paginated products from backend API in batches of 12
 * Handles pagination state, deduplication, and safe appending
 */
async function fetchCatalogProducts(page = 1, append = false) {
  if (isFetchingCatalog) return;
  isFetchingCatalog = true;

  const productsGrid = document.getElementById('products-grid');
  const loadMoreBtn = document.getElementById('btn-load-more');
  const progressText = document.getElementById('catalog-progress-text');
  const resultsCountEl = document.getElementById('filtered-results-count');

  if (!productsGrid) {
    isFetchingCatalog = false;
    return;
  }

  // Reset pagination state when starting a fresh query
  if (!append) {
    catalogCurrentPage = 1;
    catalogLoadedIds.clear();
    allProductsCache = [];
    productsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px 20px;">
        <p style="font-size: 1.05rem; color: var(--text-muted);">Loading products...</p>
      </div>
    `;
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
  } else {
    if (loadMoreBtn) {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = 'Loading more products...';
    }
  }

  try {
    const url = new URL('/api/products', window.location.origin);
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(CATALOG_PAGE_SIZE));

    if (activeCategory && activeCategory !== 'All') {
      url.searchParams.set('category', activeCategory);
    }

    const searchInput = document.getElementById('search-input');
    const searchVal = searchInput ? searchInput.value.trim() : '';
    if (searchVal) {
      url.searchParams.set('search', searchVal);
    }

    if (activeInStockOnly) {
      url.searchParams.set('in_stock', 'true');
    }

    if (activeSort && activeSort !== 'featured') {
      url.searchParams.set('sort', activeSort);
    }

    if (activePriceMin > 0) {
      url.searchParams.set('min_price', String(activePriceMin));
    }

    if (activePriceMax < 999999) {
      url.searchParams.set('max_price', String(activePriceMax));
    }

    const res = await fetch(url.toString());
    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (!res.ok) throw new Error('Failed to fetch products');

    const data = await res.json();
    const rawProducts = Array.isArray(data) ? data : (data.products || []);
    const pagination = data.pagination || {
      page,
      limit: CATALOG_PAGE_SIZE,
      total: rawProducts.length,
      totalPages: Math.ceil(rawProducts.length / CATALOG_PAGE_SIZE) || 1,
      hasMore: false
    };

    catalogCurrentPage = pagination.page;
    catalogTotalPages = pagination.totalPages;
    catalogTotalCount = pagination.total;
    catalogHasMore = pagination.hasMore;

    // Deduplicate items against catalogLoadedIds Set to guarantee no duplicates
    const newProducts = [];
    for (const p of rawProducts) {
      if (!catalogLoadedIds.has(p.id)) {
        catalogLoadedIds.add(p.id);
        newProducts.push(p);
        allProductsCache.push(p);
      }
    }

    if (!append) {
      if (allProductsCache.length === 0) {
        productsGrid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
            <div style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
            <h3 style="font-size: 1.3rem; margin-bottom: 8px;">No matching products found</h3>
            <p style="color: var(--text-muted); margin-bottom: 18px;">Try adjusting your search query or clearing some filters.</p>
            <button type="button" class="btn-primary" onclick="window.resetAllFilters()" style="display: inline-flex; width: auto; padding: 8px 20px;">
              Reset Filters
            </button>
          </div>
        `;
        if (progressText) progressText.textContent = 'Showing 0 of 0 products';
        if (resultsCountEl) resultsCountEl.textContent = 'Showing 0 of 0 products';
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        isFetchingCatalog = false;
        return;
      }

      productsGrid.innerHTML = allProductsCache.map(renderProductCardHTML).join('');
    } else {
      if (newProducts.length > 0) {
        const html = newProducts.map(renderProductCardHTML).join('');
        productsGrid.insertAdjacentHTML('beforeend', html);
      }
    }

    attachAddToCartListeners(productsGrid);

    // Update Progress Indicator & Results Count
    const countStr = `Showing ${catalogLoadedIds.size} of ${catalogTotalCount} products`;
    if (progressText) progressText.textContent = countStr;
    if (resultsCountEl) resultsCountEl.textContent = countStr;

    // Update Load More Button visibility & state
    if (loadMoreBtn) {
      if (catalogHasMore) {
        loadMoreBtn.style.display = 'inline-flex';
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Load More Products';
      } else {
        loadMoreBtn.style.display = 'none';
      }
    }

    updateActiveFilterUI();
  } catch (err) {
    console.error('Error fetching catalog products:', err);
    if (!append) {
      productsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
          <p style="color: var(--danger); font-size: 1.1rem;">Failed to load products. Please check if server is running.</p>
        </div>
      `;
    }
  } finally {
    isFetchingCatalog = false;
    if (loadMoreBtn && append) {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = 'Load More Products';
    }
  }
}

/**
 * Filter change trigger: resets pagination to page 1 and fetches fresh data
 */
function filterAndRenderProducts() {
  fetchCatalogProducts(1, false);
}

// ----------------------------------------------------
// Page: Product Details (product.html)
// ----------------------------------------------------
async function initProductPage() {
  const container = document.getElementById('product-detail-view');
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');

  if (!productId) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h2 class="empty-state-title">No Product Selected</h2>
        <p class="empty-state-text">Please select a product from our catalogue.</p>
        <a href="index.html" class="btn-primary-large" style="display: inline-flex; width: auto;">Browse Products</a>
      </div>
    `;
    return;
  }

  try {
    container.innerHTML = `<div style="text-align: center; padding: 60px;"><p>Loading product details...</p></div>`;

    const res = await fetch(`/api/products/${productId}`);
    if (!res.ok) {
      throw new Error('Product not found');
    }

    const product = await res.json();
    document.title = `${product.name} | Smart Grab Store`;

    const isVerified = product.price_status === 'verified' && product.price != null;
    const isPurchasable = Boolean(product.is_purchasable) && isVerified;
    const availableStock = Number(product.stock_quantity !== undefined ? product.stock_quantity : (product.stock || 0));

    let stockTagHtml = '';
    if (isVerified) {
      stockTagHtml = `<span class="stock-tag" style="position: static;">${availableStock > 0 ? `In Stock (${availableStock} units)` : 'Out of Stock'}</span>`;
    } else {
      stockTagHtml = `<span class="stock-tag unverified-tag" style="position: static;">Catalog Showcase Item</span>`;
    }

    let priceHtml = '';
    if (isVerified) {
      priceHtml = `
        <div class="product-info-price">
          ${formatINR(product.price)}
          <span class="inclusive-tax">Inclusive of all taxes</span>
        </div>
      `;
    } else {
      priceHtml = `
        <div class="product-info-price price-unverified">
          Price on Request
          <span class="inclusive-tax">Commercial catalog item — quote available upon request</span>
        </div>
      `;
    }

    let actionsHtml = '';
    if (isPurchasable && availableStock > 0) {
      actionsHtml = `
        <div class="quantity-control">
          <span class="label">Quantity:</span>
          <div class="qty-btn-group">
            <button class="qty-btn" id="qty-minus" aria-label="Decrease quantity">−</button>
            <input type="number" id="detail-qty" class="qty-display" value="1" min="1" max="${availableStock}" readonly />
            <button class="qty-btn" id="qty-plus" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <div class="product-action-buttons">
          <button class="btn-primary-large" id="btn-detail-add-cart">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            Add to Cart
          </button>
          <button class="btn-secondary-large" id="btn-detail-buy-now">
            Buy Now
          </button>
        </div>
      `;
    } else if (isVerified && availableStock <= 0) {
      actionsHtml = `
        <div class="product-action-buttons">
          <button class="btn-primary-large btn-disabled" disabled style="opacity: 0.6; cursor: not-allowed;">
            Currently Out of Stock
          </button>
        </div>
      `;
    } else {
      actionsHtml = `
        <div class="product-action-buttons">
          <button type="button" class="btn-primary-large" id="btn-detail-inquire" style="cursor: pointer;">
            ✉️ Inquire for Pricing
          </button>
        </div>
      `;
    }

    let brandHtml = '';
    if (product.brand && product.brand !== 'AuraStore') {
      brandHtml = `<span style="font-size: 0.9rem; font-weight: 700; color: var(--primary); text-transform: uppercase; margin-bottom: 4px; display: inline-block;">${escapeHtml(product.brand)}</span>`;
    }

    container.innerHTML = `
      <div class="product-detail-container">
        <!-- Product Image Gallery -->
        <div class="product-gallery-main">
          <img class="product-gallery-img" src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80';" />
        </div>

        <!-- Product Details Info -->
        <div class="product-info-panel">
          <div class="product-info-meta">
            <span class="category-badge" style="position: static;">${escapeHtml(product.category || 'General')}</span>
            ${stockTagHtml}
          </div>

          ${brandHtml}
          <h1 class="product-info-title">${escapeHtml(product.name)}</h1>
          
          ${priceHtml}

          <p class="product-info-desc">${escapeHtml(product.description || 'Authentic high quality catalog product.')}</p>

          ${actionsHtml}

          <!-- Value Propositions -->
          <div class="product-props-box">
            <div class="prop-item"><span class="prop-icon">🚚</span> Express Delivery across India</div>
            <div class="prop-item"><span class="prop-icon">🛡️</span> 100% Genuine & Verified Sources</div>
            <div class="prop-item"><span class="prop-icon">🔄</span> Reliable Support Guarantee</div>
            <div class="prop-item"><span class="prop-icon">💳</span> Secure Encrypted Platform</div>
          </div>
        </div>
      </div>
    `;

    // Quantity selector buttons
    const qtyInput = document.getElementById('detail-qty');
    if (qtyInput) {
      document.getElementById('qty-minus')?.addEventListener('click', () => {
        let val = parseInt(qtyInput.value, 10) || 1;
        if (val > 1) qtyInput.value = val - 1;
      });

      document.getElementById('qty-plus')?.addEventListener('click', () => {
        let val = parseInt(qtyInput.value, 10) || 1;
        const max = availableStock > 0 ? availableStock : 99;
        if (val < max) qtyInput.value = val + 1;
      });
    }

    // Add to Cart
    document.getElementById('btn-detail-add-cart')?.addEventListener('click', () => {
      const qty = parseInt(qtyInput?.value, 10) || 1;
      addToCart(product, qty);
    });

    // Buy Now
    document.getElementById('btn-detail-buy-now')?.addEventListener('click', () => {
      const qty = parseInt(qtyInput?.value, 10) || 1;
      addToCart(product, qty);
      window.location.href = 'cart.html';
    });

    // Inquire Button
    document.getElementById('btn-detail-inquire')?.addEventListener('click', () => {
      showToast(`Inquiry request recorded for "${product.name}". Our team will contact you.`, 'info');
    });

  } catch (err) {
    console.error('Error loading product details:', err);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h2 class="empty-state-title">Product Not Found</h2>
        <p class="empty-state-text">The requested item could not be retrieved.</p>
        <a href="index.html" class="btn-primary-large" style="display: inline-flex; width: auto;">Return to Home</a>
      </div>
    `;
  }
}

// ----------------------------------------------------
// Page: Cart & Checkout (cart.html)
// ----------------------------------------------------
function initCartPage() {
  const cartView = document.getElementById('cart-view');
  if (!cartView) return;

  renderCartView();
}

function renderCartView() {
  const cartView = document.getElementById('cart-view');
  if (!cartView) return;

  const cart = getCart();

  if (cart.length === 0) {
    cartView.innerHTML = `
      <div class="empty-state" style="background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color); padding: 70px 20px;">
        <div class="empty-state-icon">🛒</div>
        <h2 class="empty-state-title">Your Shopping Cart is Empty</h2>
        <p class="empty-state-text">Looks like you haven't added any items to your bag yet.</p>
        <a href="index.html" class="btn-primary-large" style="display: inline-flex; width: auto; margin: 0 auto;">Start Shopping</a>
      </div>
    `;
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const delivery = subtotal >= 999 || subtotal === 0 ? 0 : 99;

  // Check active discount from promo code
  let activeCode = (localStorage.getItem('activeDiscountCode') || '').trim().toUpperCase();
  let discount = 0;
  let promoMessage = '';

  if (activeCode === 'WELCOME100') {
    discount = Math.min(subtotal, 100);
    promoMessage = '🎉 Welcome Voucher Applied: ₹100 Discount!';
  } else if (activeCode === 'SMART500' || activeCode === 'UTSAV500') {
    if (subtotal >= 2499) {
      discount = 500;
      promoMessage = '✨ Smart Saver Applied: Flat ₹500 Discount!';
    } else {
      activeCode = '';
      promoMessage = 'SMART500 requires min. order of ₹2,499.';
    }
  } else if (activeCode === 'SMART250' || activeCode === 'LUCKY250') {
    discount = Math.min(subtotal, 250);
    promoMessage = '🏷️ Promotional Discount Applied: ₹250 Off!';
  }

  const total = Math.max(0, subtotal - discount + delivery);

  const user = getAuthUser();

  cartView.innerHTML = `
    <div class="cart-layout">
      <!-- Left: Cart Items List -->
      <div class="cart-items-panel">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
          <h2 style="font-size: 1.35rem; font-weight: 700; color: var(--secondary);">Shopping Cart (${cart.length} ${cart.length === 1 ? 'item' : 'items'})</h2>
          <button id="btn-clear-cart" style="background:none; border:none; color: var(--danger); font-size: 0.85rem; font-weight: 600; cursor: pointer;">Clear Cart</button>
        </div>

        <div class="cart-items-list">
          ${cart.map((item) => `
            <div class="cart-item-row" id="cart-item-${item.id}">
              <img class="cart-item-img" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.name)}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80';" />
              <div class="cart-item-info">
                <h4 class="cart-item-title">${escapeHtml(item.name)}</h4>
                <div class="cart-item-unit-price">${formatINR(item.price)} each</div>
                <div style="margin-top: 8px;">
                  <div class="qty-btn-group" style="width: fit-content;">
                    <button class="qty-btn cart-qty-minus" data-id="${item.id}">−</button>
                    <input type="text" class="qty-display" value="${item.quantity}" readonly style="width: 38px; height: 32px; font-size: 0.9rem;" />
                    <button class="qty-btn cart-qty-plus" data-id="${item.id}">+</button>
                  </div>
                </div>
              </div>
              <div class="cart-item-subtotal">
                ${formatINR(item.price * item.quantity)}
              </div>
              <button class="btn-remove-item" data-id="${item.id}" title="Remove item" aria-label="Remove item">✕</button>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Right: Order Summary & Checkout Form -->
      <div class="checkout-panel">
        <h3 class="checkout-panel-title">Order Summary</h3>

        <div class="summary-row">
          <span>Bag Subtotal</span>
          <span style="font-weight: 600; color: var(--secondary);">${formatINR(subtotal)}</span>
        </div>

        ${discount > 0 ? `
          <div class="summary-row" style="color: var(--accent-green); font-weight: 600;">
            <span>Coupon Discount (${activeCode})</span>
            <span>-${formatINR(discount)}</span>
          </div>
        ` : ''}

        <div class="summary-row">
          <span>Standard Delivery</span>
          <span style="font-weight: 600; color: ${delivery === 0 ? 'var(--accent-green)' : 'var(--secondary)'};">
            ${delivery === 0 ? 'FREE' : formatINR(delivery)}
          </span>
        </div>

        <div class="summary-row total">
          <span>Total Amount</span>
          <span style="color: var(--primary);">${formatINR(total)}</span>
        </div>

        <!-- Promo / Discount Code Input -->
        <div style="margin: 16px 0 12px; padding: 12px 0; border-top: 1px dashed var(--border-color); border-bottom: 1px dashed var(--border-color);">
          <label style="display: block; font-size: 0.82rem; font-weight: 600; color: var(--secondary); margin-bottom: 6px;">
            🏷️ Apply Coupon or Discount Code:
          </label>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="cart-promo-input" class="form-control" placeholder="e.g. WELCOME100 or SMART500" style="text-transform: uppercase;" value="${activeCode}" />
            <button type="button" id="btn-apply-cart-promo" style="background: var(--secondary); color: #fff; border: none; padding: 0 16px; border-radius: var(--radius-md); font-weight: 600; font-size: 0.85rem; cursor: pointer; white-space: nowrap;">Apply</button>
          </div>
          ${promoMessage ? `<div style="font-size: 0.78rem; font-weight: 600; margin-top: 6px; color: ${discount > 0 ? 'var(--accent-green)' : 'var(--primary)'};">${promoMessage}</div>` : ''}
        </div>

        <!-- Checkout Information Form -->
        <form id="checkout-form" class="checkout-form" style="margin-top: 14px; padding-top: 0; border-top: none;">
          <h4 style="font-size: 1rem; font-weight: 600; margin-bottom: 14px; color: var(--secondary);">Shipping & Delivery Details</h4>

          ${!user ? `
            <div style="background: var(--primary-light); border: 1px solid rgba(194, 65, 12, 0.2); border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 16px; font-size: 0.85rem; color: var(--primary-hover);">
              💡 Have an account? <a href="login.html" style="font-weight: 700; text-decoration: underline;">Log in</a> for auto-filled details.
            </div>
          ` : ''}

          <div class="form-group">
            <label class="form-label" for="checkout-name">Full Name *</label>
            <input type="text" id="checkout-name" class="form-control" placeholder="e.g. Rahul Sharma" value="${user ? escapeHtml(user.name) : ''}" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="checkout-email">Email Address *</label>
            <input type="email" id="checkout-email" class="form-control" placeholder="e.g. rahul@example.com" value="${user ? escapeHtml(user.email) : ''}" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="checkout-address">Delivery Address *</label>
            <textarea id="checkout-address" class="form-control" placeholder="Flat / House No, Street, Landmark, City, State, PIN Code" required></textarea>
          </div>

          <div id="checkout-error" class="alert alert-danger" style="display: none;"></div>

          <button type="submit" id="btn-submit-order" class="btn-checkout-submit">
            Proceed to Checkout (${formatINR(total)})
          </button>
        </form>
      </div>
    </div>
  `;

  // Attach Cart Event Handlers
  document.getElementById('btn-clear-cart')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to empty your cart?')) {
      clearCart();
      renderCartView();
    }
  });

  // Apply Coupon / Scratch Gift Handler
  document.getElementById('btn-apply-cart-promo')?.addEventListener('click', () => {
    const inputVal = (document.getElementById('cart-promo-input')?.value || '').trim().toUpperCase();
    if (!inputVal) {
      localStorage.removeItem('activeDiscountCode');
      showToast('Coupon removed.', 'info');
      renderCartView();
      return;
    }
    if (inputVal === 'WELCOME100') {
      localStorage.setItem('activeDiscountCode', 'WELCOME100');
      showToast('🎉 Welcome Coupon Applied! ₹100 Discount deducted.', 'success');
      renderCartView();
    } else if (inputVal === 'SMART500' || inputVal === 'UTSAV500') {
      if (subtotal >= 2499) {
        localStorage.setItem('activeDiscountCode', inputVal);
        showToast('✨ Smart Saver Applied! ₹500 Discount deducted.', 'success');
        renderCartView();
      } else {
        alert('Code SMART500 requires a minimum cart subtotal of ₹2,499. Add more items to qualify!');
      }
    } else if (inputVal === 'SMART250' || inputVal === 'LUCKY250') {
      localStorage.setItem('activeDiscountCode', inputVal);
      showToast('🏷️ Promo Applied! ₹250 Discount deducted.', 'success');
      renderCartView();
    } else {
      alert('Invalid coupon code. Try WELCOME100 or SMART500 (for orders over ₹2,499)!');
    }
  });

  cartView.querySelectorAll('.cart-qty-minus').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-id'), 10);
      const item = cart.find((i) => i.id === id);
      if (item) {
        updateCartQuantity(id, item.quantity - 1);
        renderCartView();
      }
    });
  });

  cartView.querySelectorAll('.cart-qty-plus').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-id'), 10);
      const item = cart.find((i) => i.id === id);
      if (item) {
        updateCartQuantity(id, item.quantity + 1);
        renderCartView();
      }
    });
  });

  cartView.querySelectorAll('.btn-remove-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-id'), 10);
      removeFromCart(id);
      renderCartView();
    });
  });

  // Handle Checkout submission
  const checkoutForm = document.getElementById('checkout-form');
  checkoutForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('btn-submit-order');
    const errorBox = document.getElementById('checkout-error');

    errorBox.style.display = 'none';

    const customerName = document.getElementById('checkout-name').value.trim();
    const customerEmail = document.getElementById('checkout-email').value.trim();
    const shippingAddress = document.getElementById('checkout-address').value.trim();

    if (!customerName || !customerEmail || !shippingAddress) {
      errorBox.textContent = 'Please fill out all delivery fields.';
      errorBox.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing Order...';

    try {
      const token = getAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const orderPayload = {
        items: cart,
        customerName,
        customerEmail,
        shippingAddress,
        totalAmount: total
      };

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify(orderPayload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to place order.');
      }

      // Success! Clear cart and display Order Confirmation view
      clearCart();
      if (data.order && data.order.id) {
        localStorage.setItem('lastPlacedOrderId', String(data.order.id));
      }
      renderOrderSuccess(data.order);
    } catch (err) {
      console.error('Order error:', err);
      errorBox.textContent = err.message || 'Error occurred while placing order.';
      errorBox.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = `Place Order (${formatINR(total)})`;
    }
  });
}

// ----------------------------------------------------
// Order Tracking System (Straight Line Tracker)
// ----------------------------------------------------

const TRACKING_STEPS = [
  { step: 1, id: 'Order Placed', label: 'Order Placed', icon: '📝', subtitle: 'Order verified & payment confirmed' },
  { step: 2, id: 'Processing', label: 'Processing', icon: '⚙️', subtitle: 'Packed at fulfillment center' },
  { step: 3, id: 'Shipped', label: 'Shipped', icon: '🚚', subtitle: 'Handed to courier partner' },
  { step: 4, id: 'Out for Delivery', label: 'Out for Delivery', icon: '🛵', subtitle: 'Out for doorstep delivery today' },
  { step: 5, id: 'Delivered', label: 'Delivered', icon: '🏠', subtitle: 'Delivered securely to customer' }
];

function getTrackingStepIndex(status) {
  if (!status) return 1;
  const normalized = status.trim().toLowerCase();
  if (normalized.includes('deliv') && !normalized.includes('out')) return 5;
  if (normalized.includes('out')) return 4;
  if (normalized.includes('ship')) return 3;
  if (normalized.includes('process')) return 2;
  return 1; // Default: 'Order Placed'
}

function renderTrackerBarHTML(order, currentStatusOverride) {
  const currentStatus = currentStatusOverride || order.status || 'Order Placed';
  const currentStep = getTrackingStepIndex(currentStatus);

  // Line progress percentage across the straight bar (5 milestones -> 4 connecting segments of 25% each)
  const percentage = Math.min(100, Math.max(0, (currentStep - 1) * 25));

  // Calculate estimated delivery (+3 business days from order creation)
  const orderDate = order.created_at ? new Date(order.created_at) : (order.createdAt ? new Date(order.createdAt) : new Date());
  const etaDate = new Date(orderDate);
  etaDate.setDate(etaDate.getDate() + 3);
  const etaFormatted = etaDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  const stepsHTML = TRACKING_STEPS.map((s) => {
    let stateClass = '';
    let nodeContent = s.step;

    if (s.step < currentStep) {
      stateClass = 'completed';
      nodeContent = '✓';
    } else if (s.step === currentStep) {
      stateClass = 'active';
      nodeContent = s.icon;
    } else {
      nodeContent = s.step;
    }

    return `
      <div class="tracker-step ${stateClass}" id="tracker-step-${order.id}-${s.step}">
        <div class="step-node">${nodeContent}</div>
        <div class="step-title">${s.label}</div>
        <div class="step-subtitle">${s.subtitle}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="order-tracking-card" id="tracking-card-${order.id}">
      <div class="tracking-header">
        <div class="tracking-title-wrap">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
            <h3 style="margin: 0; font-size: 1.25rem;">Live Order Tracking: <span style="color: var(--primary); font-weight: 800;">${escapeHtml(currentStatus)}</span></h3>
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--accent-green); box-shadow: 0 0 0 4px rgba(5,150,105,0.2); animation: pulseDot 1.5s infinite;"></span>
          </div>
          <p>Order Reference: <strong>#ORD-${order.id}</strong> • Placed on ${orderDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <div class="tracking-eta-badge">
          <span>🚀</span> Est. Delivery: <strong>${etaFormatted}</strong>
        </div>
      </div>

      <!-- Straight Line Horizontal Progress Bar -->
      <div class="tracker-container">
        <div class="tracker-progress-bar">
          <div class="tracker-progress-line" id="tracker-line-${order.id}" style="width: calc((100% - 60px) * ${percentage / 100});"></div>
          ${stepsHTML}
        </div>
      </div>

      <!-- Logistics Shipment Details -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px 18px; margin-top: 24px; font-size: 0.88rem;">
        <div>
          <span style="color: var(--text-muted); display: block; font-size: 0.78rem; text-transform: uppercase; font-weight: 600;">Courier Partner</span>
          <strong style="color: var(--secondary);">BlueDart Surface Priority</strong>
        </div>
        <div>
          <span style="color: var(--text-muted); display: block; font-size: 0.78rem; text-transform: uppercase; font-weight: 600;">Air Waybill (AWB)</span>
          <strong style="color: var(--secondary); font-family: monospace;">BD-IND-${order.id}-9941</strong>
        </div>
        <div>
          <span style="color: var(--text-muted); display: block; font-size: 0.78rem; text-transform: uppercase; font-weight: 600;">Delivery Destination</span>
          <strong style="color: var(--secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;" title="${escapeHtml(order.shipping_address || order.shippingAddress || 'India')}">${escapeHtml(order.shipping_address || order.shippingAddress || 'India')}</strong>
        </div>
      </div>
    </div>
  `;
}



function renderOrderSuccess(order) {
  const cartView = document.getElementById('cart-view');
  if (!cartView) return;

  window.scrollTo({ top: 0, behavior: 'smooth' });

  const customerName = order.customerName || order.customer_name || 'Valued Customer';
  const customerEmail = order.customerEmail || order.customer_email || '';
  const shippingAddress = order.shippingAddress || order.shipping_address || '';
  const totalAmount = order.totalAmount || order.total_amount || 0;
  const items = order.items || [];

  cartView.innerHTML = `
    <div style="max-width: 900px; margin: 24px auto;">
      <!-- Order Placed Success Banner -->
      <div style="background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color); box-shadow: var(--shadow-md); padding: 36px 30px; text-align: center; margin-bottom: 24px;">
        <div style="width: 72px; height: 72px; background: var(--accent-green-light); color: var(--accent-green); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 2.2rem; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(5,150,105,0.15);">
          ✓
        </div>
        <h2 style="font-size: 2rem; font-weight: 800; color: var(--secondary); margin-bottom: 8px;">Order Placed Successfully!</h2>
        <p style="color: var(--text-muted); font-size: 1.05rem; max-width: 620px; margin: 0 auto 20px;">
          Thank you for shopping with us, <strong>${escapeHtml(customerName)}</strong>. Your order is confirmed and currently being prepared for dispatch.
        </p>
        <div style="display: inline-flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
          <a href="track.html?id=${order.id}" class="btn-primary" style="padding: 10px 22px; font-size: 0.95rem; text-decoration: none;">
            🔍 Open Full Tracking Page
          </a>
          <a href="index.html" class="btn-secondary" style="padding: 10px 22px; font-size: 0.95rem; text-decoration: none;">
            ← Continue Shopping
          </a>
        </div>
      </div>

      <!-- Real-time Straight Line Order Tracking Bar -->
      ${renderTrackerBarHTML(order)}

      <!-- Order Receipt Details -->
      <div style="background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color); box-shadow: var(--shadow-sm); padding: 28px; margin-top: 24px;">
        <h4 style="font-size: 1.15rem; font-weight: 700; color: var(--secondary); margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid var(--border-light);">
          Order Summary & Delivery Details
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; margin-bottom: 24px;">
          <div>
            <div style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; margin-bottom: 4px;">Delivery Address</div>
            <div style="font-weight: 600; color: var(--secondary);">${escapeHtml(customerName)}</div>
            <div style="color: var(--text-muted); font-size: 0.92rem; margin-top: 4px;">${escapeHtml(shippingAddress)}</div>
            ${customerEmail ? `<div style="color: var(--text-muted); font-size: 0.88rem; margin-top: 2px;">Email: ${escapeHtml(customerEmail)}</div>` : ''}
          </div>
          <div>
            <div style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; margin-bottom: 4px;">Payment Summary</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.92rem;">
              <span style="color: var(--text-muted);">Payment Method:</span>
              <span style="font-weight: 600;">Cash on Delivery / UPI</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.92rem;">
              <span style="color: var(--text-muted);">Delivery Fee:</span>
              <span style="color: var(--accent-green); font-weight: 600;">FREE (Festive Offer)</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 800; color: var(--secondary); padding-top: 10px; border-top: 1px dashed var(--border-color);">
              <span>Total Paid:</span>
              <span style="color: var(--primary);">${formatINR(totalAmount)}</span>
            </div>
          </div>
        </div>

        <!-- Items Ordered Table -->
        ${items && items.length ? `
          <div style="border-top: 1px solid var(--border-light); padding-top: 18px;">
            <div style="font-size: 0.88rem; font-weight: 700; color: var(--secondary); margin-bottom: 12px;">Items in this Shipment (${items.length})</div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${items.map(it => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--bg-main); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    ${it.image_url ? `<img src="${it.image_url}" alt="${escapeHtml(it.name)}" style="width: 44px; height: 44px; border-radius: var(--radius-sm); object-fit: cover;" />` : ''}
                    <div>
                      <div style="font-weight: 600; font-size: 0.92rem; color: var(--secondary);">${escapeHtml(it.name)}</div>
                      <div style="font-size: 0.8rem; color: var(--text-muted);">Qty: ${it.quantity} × ${formatINR(it.price)}</div>
                    </div>
                  </div>
                  <strong style="color: var(--secondary); font-size: 0.95rem;">${formatINR(it.subtotal || (it.price * it.quantity))}</strong>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// ----------------------------------------------------
// Page: Login (login.html)
// ----------------------------------------------------
function initLoginPage() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  // Initialize show/hide password toggle
  setupPasswordToggle('toggle-login-password', 'login-password');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('login-error');
    const successBox = document.getElementById('login-success');
    const submitBtn = document.getElementById('btn-login-submit');

    if (errorBox) errorBox.style.display = 'none';
    if (successBox) successBox.style.display = 'none';

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    // Frontend validation
    if (!email || !password) {
      if (errorBox) {
        errorBox.textContent = 'Please enter both your email address and password.';
        errorBox.style.display = 'block';
      }
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      if (errorBox) {
        errorBox.textContent = 'Please enter a valid email address format.';
        errorBox.style.display = 'block';
      }
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        // Generic error message without revealing if email exists
        throw new Error(data.error || 'Invalid email or password.');
      }

      setAuthSession(data.token, data.user);

      if (successBox) {
        successBox.textContent = 'Sign in successful! Redirecting to AuraStore...';
        successBox.style.display = 'block';
      }
      showToast('Welcome back! Redirecting to store...', 'success');

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 600);

    } catch (err) {
      console.error('Login error:', err);
      if (errorBox) {
        const isNetworkErr = err.name === 'TypeError' || err.message === 'Failed to fetch' || (err.message && err.message.includes('fetch'));
        errorBox.textContent = isNetworkErr
          ? 'Unable to connect to the store server. Please ensure the Express server is running at http://localhost:3000 and MySQL is active.'
          : (err.message || 'Invalid email or password.');
        errorBox.style.display = 'block';
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
}

// ----------------------------------------------------
// Page: Register (register.html)
// ----------------------------------------------------
function initRegisterPage() {
  const registerForm = document.getElementById('register-form');
  if (!registerForm) return;

  // Initialize show/hide password toggles
  setupPasswordToggle('toggle-register-password', 'register-password');
  setupPasswordToggle('toggle-register-confirm-password', 'register-confirm-password');

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('register-error');
    const successBox = document.getElementById('register-success');
    const submitBtn = document.getElementById('btn-register-submit');

    if (errorBox) errorBox.style.display = 'none';
    if (successBox) successBox.style.display = 'none';

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password')?.value;

    // Frontend validations
    if (!name || !email || !password || !confirmPassword) {
      if (errorBox) {
        errorBox.textContent = 'Please fill out all required fields.';
        errorBox.style.display = 'block';
      }
      return;
    }

    if (name.length < 2) {
      if (errorBox) {
        errorBox.textContent = 'Full name must be at least 2 characters.';
        errorBox.style.display = 'block';
      }
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      if (errorBox) {
        errorBox.textContent = 'Please enter a valid email address.';
        errorBox.style.display = 'block';
      }
      return;
    }

    if (password.length < 6) {
      if (errorBox) {
        errorBox.textContent = 'Password must be at least 6 characters long.';
        errorBox.style.display = 'block';
      }
      return;
    }

    if (password !== confirmPassword) {
      if (errorBox) {
        errorBox.textContent = 'Passwords do not match. Please verify both entries.';
        errorBox.style.display = 'block';
      }
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name,
          name: name,
          email,
          password,
          confirm_password: confirmPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      setAuthSession(data.token, data.user);

      if (successBox) {
        successBox.textContent = 'Account created successfully! Welcome to AuraStore.';
        successBox.style.display = 'block';
      }
      showToast('Account created successfully! Welcome to AuraStore.', 'success');

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 700);

    } catch (err) {
      console.error('Registration error:', err);
      if (errorBox) {
        const isNetworkErr = err.name === 'TypeError' || err.message === 'Failed to fetch' || (err.message && err.message.includes('fetch'));
        errorBox.textContent = isNetworkErr
          ? 'Unable to connect to the store server. Please ensure the Express server is running at http://localhost:3000 and MySQL is active.'
          : (err.message || 'Could not register account.');
        errorBox.style.display = 'block';
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });
}

// ----------------------------------------------------
// Page: Order Tracking (track.html)
// ----------------------------------------------------
function initTrackOrderPage() {
  const trackForm = document.getElementById('track-form');
  const trackInput = document.getElementById('track-order-id');
  const errorBox = document.getElementById('track-error');
  const resultContainer = document.getElementById('track-result-container');

  if (!trackForm || !trackInput || !resultContainer) return;

  async function loadOrder(orderId) {
    if (!orderId) {
      if (errorBox) {
        errorBox.textContent = 'Please enter a valid numeric Order ID (e.g. 1).';
        errorBox.style.display = 'block';
      }
      return;
    }

    if (errorBox) errorBox.style.display = 'none';
    resultContainer.innerHTML = `
      <div style="text-align: center; padding: 48px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
        <div style="font-size: 2rem; margin-bottom: 12px; animation: pulseDot 1.5s infinite;">📦</div>
        <p style="color: var(--text-muted); font-size: 1.05rem;">Fetching live order tracking details for #ORD-${escapeHtml(orderId)}...</p>
      </div>
    `;

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
      if (!response.ok) {
        throw new Error(`Order #${orderId} could not be found. Please check your order ID or place a new order.`);
      }

      const order = await response.json();
      window.currentTrackedOrder = order;
      renderTrackedOrderDetails(order);
    } catch (err) {
      console.error('Track order error:', err);
      resultContainer.innerHTML = `
        <div style="background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color); padding: 40px; text-align: center;">
          <div style="width: 60px; height: 60px; border-radius: 50%; background: var(--danger-light); color: var(--danger); font-size: 1.8rem; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
            ⚠️
          </div>
          <h3 style="font-size: 1.4rem; color: var(--secondary); margin-bottom: 8px;">Order Not Found</h3>
          <p style="color: var(--text-muted); max-width: 520px; margin: 0 auto 20px;">${escapeHtml(err.message)}</p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <a href="cart.html" class="btn-secondary" style="padding: 9px 18px; font-size: 0.9rem; text-decoration: none;">View Your Bag</a>
            <a href="index.html" class="btn-secondary" style="padding: 9px 18px; font-size: 0.9rem; text-decoration: none;">
              Browse Products
            </a>
          </div>
        </div>
      `;
    }
  }

  // Session-aware quick tracking helper
  const recentOrderId = localStorage.getItem('lastPlacedOrderId');
  const recentOrderWrap = document.getElementById('recent-order-suggestion');
  if (recentOrderWrap && recentOrderId) {
    recentOrderWrap.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; font-size: 0.88rem; color: var(--text-muted);">
        <span>Recent order:</span>
        <button type="button" id="btn-quick-recent-order" style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 5px 12px; border-radius: var(--radius-sm); font-size: 0.82rem; cursor: pointer; color: var(--primary); font-weight: 700;">
          #ORD-${escapeHtml(recentOrderId)} (Track)
        </button>
      </div>
    `;
    document.getElementById('btn-quick-recent-order')?.addEventListener('click', () => {
      trackInput.value = recentOrderId;
      loadOrder(recentOrderId);
    });
  }

  trackForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawVal = trackInput.value.trim().replace(/^#?ORD-?/i, '');
    loadOrder(rawVal);
  });

  // Check URL query parameter: track.html?id=123
  const urlParams = new URLSearchParams(window.location.search);
  const queryId = urlParams.get('id') || urlParams.get('orderId');
  if (queryId) {
    trackInput.value = queryId;
    loadOrder(queryId);
  }
}

function renderTrackedOrderDetails(order) {
  const resultContainer = document.getElementById('track-result-container');
  if (!resultContainer) return;

  const orderDate = order.created_at ? new Date(order.created_at) : (order.createdAt ? new Date(order.createdAt) : new Date());
  const customerName = order.customer_name || order.customerName || 'Valued Customer';
  const customerEmail = order.customer_email || order.customerEmail || '';
  const shippingAddress = order.shipping_address || order.shippingAddress || '';
  const totalAmount = order.total_amount || order.totalAmount || 0;
  const items = order.items || [];

  resultContainer.innerHTML = `
    <!-- Straight Line Progress Bar Component -->
    ${renderTrackerBarHTML(order)}

    <!-- Detailed Shipment Logistics & Package Contents -->
    <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; margin-top: 24px;">
      
      <!-- Left Column: Shipping & Activity Feed -->
      <div style="background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color); padding: 26px; box-shadow: var(--shadow-sm);">
        <h4 style="font-size: 1.15rem; font-weight: 700; color: var(--secondary); margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border-light);">
          📍 Delivery Activity Log
        </h4>
        <div style="display: flex; flex-direction: column; gap: 16px; position: relative; padding-left: 20px;">
          <!-- Timeline stem -->
          <div style="position: absolute; left: 6px; top: 8px; bottom: 8px; width: 2px; background: #e2e8f0;"></div>

          <div style="position: relative;">
            <div style="position: absolute; left: -19px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--accent-green); box-shadow: 0 0 0 3px rgba(5,150,105,0.2);"></div>
            <strong style="color: var(--secondary); font-size: 0.95rem;">Current Status: ${escapeHtml(order.status || 'Order Placed')}</strong>
            <p style="color: var(--text-muted); font-size: 0.82rem; margin-top: 2px;">Updated recently via logistics hub</p>
          </div>

          <div style="position: relative;">
            <div style="position: absolute; left: -19px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: #94a3b8;"></div>
            <strong style="color: var(--secondary); font-size: 0.95rem;">Order Verified & Payment Logged</strong>
            <p style="color: var(--text-muted); font-size: 0.82rem; margin-top: 2px;">${orderDate.toLocaleString('en-IN')}</p>
          </div>

          <div style="position: relative;">
            <div style="position: absolute; left: -19px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: #94a3b8;"></div>
            <strong style="color: var(--secondary); font-size: 0.95rem;">Assigned Carrier</strong>
            <p style="color: var(--text-muted); font-size: 0.82rem; margin-top: 2px;">BlueDart Express AWB #BD-IND-${order.id}-9941</p>
          </div>
        </div>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border-light);">
          <div style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; margin-bottom: 6px;">Ship To Address</div>
          <div style="font-weight: 600; color: var(--secondary);">${escapeHtml(customerName)}</div>
          <div style="color: var(--text-muted); font-size: 0.92rem; margin-top: 2px;">${escapeHtml(shippingAddress)}</div>
          ${customerEmail ? `<div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 2px;">${escapeHtml(customerEmail)}</div>` : ''}
        </div>
      </div>

      <!-- Right Column: Ordered Items -->
      <div style="background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color); padding: 26px; box-shadow: var(--shadow-sm);">
        <h4 style="font-size: 1.15rem; font-weight: 700; color: var(--secondary); margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border-light);">
          🛍️ Package Contents (${items.length} ${items.length === 1 ? 'item' : 'items'})
        </h4>
        <div style="display: flex; flex-direction: column; gap: 12px; max-height: 280px; overflow-y: auto; padding-right: 4px;">
          ${items.map(it => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--bg-main); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
              <div style="display: flex; align-items: center; gap: 10px;">
                ${it.image_url ? `<img src="${it.image_url}" alt="${escapeHtml(it.name)}" style="width: 44px; height: 44px; border-radius: var(--radius-sm); object-fit: cover;" />` : ''}
                <div>
                  <div style="font-weight: 600; font-size: 0.9rem; color: var(--secondary);">${escapeHtml(it.name)}</div>
                  <div style="font-size: 0.78rem; color: var(--text-muted);">Qty: ${it.quantity} × ${formatINR(it.price)}</div>
                </div>
              </div>
              <strong style="font-size: 0.92rem; color: var(--secondary);">${formatINR(it.subtotal || (it.price * it.quantity))}</strong>
            </div>
          `).join('')}
        </div>

        <div style="margin-top: 20px; padding-top: 14px; border-top: 1px dashed var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600; color: var(--secondary);">Total Invoice Amount:</span>
          <span style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">${formatINR(totalAmount)}</span>
        </div>
      </div>
    </div>
  `;
}


// ----------------------------------------------------
// Customer Care & Policy Dialog System
// ----------------------------------------------------
const STORE_POLICIES = {
  shipping: {
    title: 'Shipping & Delivery Policy',
    icon: '🚚',
    badge: 'Express Pan-India Logistics',
    content: `
      <p style="margin-bottom: 12px;">We partner with premier express carriers including BlueDart and Delhivery to deliver authentic artisanal essentials across every serviceable PIN code in India.</p>
      <ul style="padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 0.95rem; color: var(--secondary);">
        <li><strong>Free Express Delivery:</strong> Complimentary on all orders above ₹999. A flat nominal fee of ₹99 applies to orders under ₹999.</li>
        <li><strong>Dispatch Window:</strong> All orders are verified and dispatched from our logistics center within 24 to 48 hours of placement.</li>
        <li><strong>Estimated Transit Time:</strong> 2 to 4 business days for major metropolitan areas; 3 to 6 business days for rest of India.</li>
        <li><strong>Real-time Tracking:</strong> Every shipment includes a live Air Waybill (AWB) reference to follow milestone updates.</li>
      </ul>
    `
  },
  returns: {
    title: '7-Day Easy Returns & Exchanges',
    icon: '🔄',
    badge: 'Hassle-Free Doorstep Guarantee',
    content: `
      <p style="margin-bottom: 12px;">Your satisfaction is our priority. If an item does not meet your expectations, you may initiate a return or exchange within 7 days of delivery.</p>
      <ul style="padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 0.95rem; color: var(--secondary);">
        <li><strong>Eligibility:</strong> Items must be in original unworn condition with tags attached and packaging preserved.</li>
        <li><strong>Doorstep Pickup:</strong> Our carrier partner collects the package directly from your delivery address at no extra fee.</li>
        <li><strong>Speedy Refunds:</strong> Following quality verification at our hub, refunds are credited to your original payment method within 2 to 4 business days.</li>
      </ul>
    `
  },
  contact: {
    title: 'Customer Care & Help Desk',
    icon: '💬',
    badge: 'Dedicated Support Team',
    content: `
      <p style="margin-bottom: 12px;">Have questions about sizing, delivery, or custom orders? Our team is glad to assist you.</p>
      <ul style="padding-left: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 0.95rem; color: var(--secondary);">
        <li><strong>Support Email:</strong> <a href="mailto:care@smartgrabstore.in" style="color: var(--primary); font-weight: 600;">care@smartgrabstore.in</a></li>
        <li><strong>Support Hours:</strong> Monday – Saturday, 9:00 AM – 8:00 PM IST</li>
        <li><strong>Order Inquiries:</strong> Please mention your Order Reference ID (#ORD-XXXX) for rapid assistance.</li>
        <li><strong>Live Shipment Tracking:</strong> You can track active shipments directly on our <a href="track.html" style="color: var(--primary); font-weight: 600; text-decoration: underline;">Tracking Page</a>.</li>
      </ul>
    `
  }
};

function openPolicyModal(type) {
  const policy = STORE_POLICIES[type] || STORE_POLICIES.shipping;
  let modal = document.getElementById('store-policy-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'store-policy-modal';
    modal.className = 'policy-modal-backdrop';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="policy-modal-card" role="dialog" aria-modal="true" aria-labelledby="policy-modal-title">
      <div class="policy-modal-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 1.6rem;">${policy.icon}</span>
          <div>
            <h3 id="policy-modal-title" style="margin: 0; font-size: 1.25rem; color: var(--secondary); font-weight: 700;">${policy.title}</h3>
            <span style="font-size: 0.78rem; color: var(--primary); font-weight: 700; text-transform: uppercase;">${policy.badge}</span>
          </div>
        </div>
        <button type="button" class="policy-modal-close" id="btn-close-policy-modal" aria-label="Close dialog">✕</button>
      </div>
      <div class="policy-modal-body">
        ${policy.content}
      </div>
      <div class="policy-modal-footer">
        <button type="button" class="btn-primary" id="btn-dismiss-policy-modal" style="padding: 8px 24px; font-size: 0.9rem;">Close</button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const closeModal = () => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  document.getElementById('btn-close-policy-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-dismiss-policy-modal')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

function initPolicyLinks() {
  document.querySelectorAll('[data-policy]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const policyType = link.getAttribute('data-policy');
      openPolicyModal(policyType);
    });
  });
}

// ----------------------------------------------------
// DOM Content Loaded Initializer
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Update header auth state and cart counter on every page
  updateNavbarAuth();
  updateCartCountBadge();

  // Page-specific initializers based on presence of specific container IDs
  if (document.getElementById('products-grid')) {
    initIndexPage();
  } else if (document.getElementById('product-detail-view')) {
    initProductPage();
  } else if (document.getElementById('cart-view')) {
    initCartPage();
  } else if (document.getElementById('track-order-view')) {
    initTrackOrderPage();
  } else if (document.getElementById('login-form')) {
    initLoginPage();
  } else if (document.getElementById('register-form')) {
    initRegisterPage();
  }

  // Global search input enter listener on other pages
  const globalSearchInput = document.getElementById('search-input');
  if (globalSearchInput && !document.getElementById('products-grid')) {
    globalSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const term = globalSearchInput.value.trim();
        window.location.href = `index.html?search=${encodeURIComponent(term)}`;
      }
    });
  }
});
