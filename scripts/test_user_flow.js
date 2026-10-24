const BASE_URL = 'http://localhost:3000';

async function runAudit() {
  console.log('=== STARTING SMART GRAB STORE FLOW AUDIT ===');
  const results = {};

  try {
    // 1. Health
    const healthRes = await fetch(BASE_URL + '/api/health');
    const healthData = await healthRes.json();
    results['Server & Health'] = healthRes.status === 200 && healthData.status === 'online' ? 'PASS' : 'FAIL';

    // 2. Signup / Register
    const testEmail = 'flow_tester_' + Date.now() + '@example.com';
    const regRes = await fetch(BASE_URL + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'CodeAlpha Tester',
        email: testEmail,
        password: 'Password123!',
        confirm_password: 'Password123!'
      })
    });
    const regData = await regRes.json();
    results['Signup (Registration)'] = regRes.status === 201 && regData.token ? 'PASS' : 'FAIL';

    // 3. Login
    const loginRes = await fetch(BASE_URL + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password123!'
      })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    results['Login'] = loginRes.status === 200 && token ? 'PASS' : 'FAIL';

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    };

    // 4. Products Loading
    const prodRes = await fetch(BASE_URL + '/api/products?page=1&limit=12', { headers: authHeaders });
    const prodData = await prodRes.json();
    results['Product Loading'] = (prodRes.status === 200 && prodData.products?.length > 0)
      ? `PASS (${prodData.products.length} products loaded)`
      : 'FAIL';

    // 5. Search
    const searchRes = await fetch(BASE_URL + '/api/products?search=Hat', { headers: authHeaders });
    const searchData = await searchRes.json();
    results['Product Search'] = (searchRes.status === 200 && searchData.products?.length > 0)
      ? `PASS (${searchData.products.length} items found for 'Hat')`
      : 'FAIL';

    // 6. Category Filtering
    const catListRes = await fetch(BASE_URL + '/api/categories', { headers: authHeaders });
    const categories = await catListRes.json();
    const testCat = categories[0] || 'Home & Garden';
    const catRes = await fetch(BASE_URL + '/api/products?category=' + encodeURIComponent(testCat), { headers: authHeaders });
    const catData = await catRes.json();
    results['Category Filtering'] = (catRes.status === 200 && catData.products?.length > 0)
      ? `PASS (${catData.products.length} items in '${testCat}')`
      : 'FAIL';

    // 7. Pagination
    const page2Res = await fetch(BASE_URL + '/api/products?page=2&limit=12', { headers: authHeaders });
    const page2Data = await page2Res.json();
    results['Pagination'] = (page2Res.status === 200 && page2Data.pagination?.page === 2)
      ? `PASS (Page 2 of ${page2Data.pagination.totalPages})`
      : 'FAIL';

    // 8. Checkout & Order Placement
    const purchasable = prodData.products.find(p => p.price && p.is_purchasable !== false && p.price_status !== 'unverified') || prodData.products[0];
    const checkoutRes = await fetch(BASE_URL + '/api/checkout', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        items: [{
          id: purchasable.id,
          name: purchasable.name,
          price: purchasable.price,
          quantity: 1,
          image_url: purchasable.image_url
        }],
        customerName: 'CodeAlpha Tester',
        customerEmail: testEmail,
        shippingAddress: '42 MG Road, Bengaluru, Karnataka, 560001',
        totalAmount: purchasable.price
      })
    });
    const checkoutData = await checkoutRes.json();
    const orderId = checkoutData.orderId;
    results['Checkout'] = (checkoutRes.status === 201 && orderId)
      ? `PASS (Order ID #${orderId} created)`
      : 'FAIL';

    // 9. Order Tracking
    if (orderId) {
      const trackRes = await fetch(BASE_URL + '/api/orders/' + orderId, { headers: authHeaders });
      const trackData = await trackRes.json();
      results['Order Tracking'] = (trackRes.status === 200 && trackData.id === orderId)
        ? `PASS (Retrieved Order #${trackData.id}, Status: ${trackData.status})`
        : 'FAIL';
    } else {
      results['Order Tracking'] = 'BLOCKED';
    }

    // 10. Logout
    const logoutRes = await fetch(BASE_URL + '/api/auth/logout', { method: 'POST', headers: authHeaders });
    const logoutData = await logoutRes.json();
    results['Logout'] = (logoutRes.status === 200 && logoutData.success) ? 'PASS' : 'FAIL';

    console.table(results);
    console.log('=== AUDIT COMPLETE ===');
  } catch (err) {
    console.error('Audit failed with error:', err);
  }
}

runAudit();
