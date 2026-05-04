let currentUser = null;
        let cart = [];
        let waLinkTemp = '';
        let discountType = 'pct'; // 'pct' or 'flat'
        let discountVal = 0;
        let selectedPaymentMethod = 'Cash';
        let promoDiscount = { type: 'pct', value: 0, code: '' };

        // ── XML AUTO-SAVE ENGINE (File System Access API) ─────────────────
        let _billingFileHandle = null;  // Holds the file handle once user picks it

        const connectBillingFile = async () => {
            if (!('showSaveFilePicker' in window)) {
                showAlert('Browser Error', 'Use Chrome or Edge for auto-save. Firefox not supported.');
                return;
            }
            try {
                _billingFileHandle = await window.showSaveFilePicker({
                    suggestedName: 'Bloomeor_Billing_Backup.xml',
                    types: [{ description: 'Bloomeor XML Billing File', accept: { 'text/xml': ['.xml'] } }],
                    startIn: 'documents'
                });
                // Update UI to show connected
                const nav = document.getElementById('fileStatusNav');
                if (nav) nav.innerHTML = '<i class="ph ph-check-circle" style="color:#10B981"></i> <span style="color:#10B981">File connected ✓</span>';
                const banner = document.getElementById('fileSetupBanner');
                if (banner) {
                    banner.style.borderBottomColor = '#10B981';
                    banner.style.background = 'linear-gradient(90deg,#0f2010,#0a1a0a)';
                    const msg = document.getElementById('fileStatusMsg');
                    if (msg) msg.innerHTML = '<strong style="color:#10B981">✓ Connected: ' + _billingFileHandle.name + '</strong> — Every sale will now auto-save to this file.';
                    const btn = document.getElementById('connectFileBtn');
                    if (btn) { btn.innerText = '✓ Connected'; btn.style.background = '#10B981'; btn.style.color = '#000'; }
                }
                showAlert('Connected!', 'Billing file connected. Sales will auto-save.');
            } catch (e) {
                if (e.name !== 'AbortError') showAlert('Error', 'Could not connect file: ' + e.message);
            }
        };

        const autoSaveXML = async () => {
            if (!_billingFileHandle) return;   // Not connected yet — silent skip

            const allSales = JSON.parse(localStorage.getItem('all_sales') || '[]');
            if (allSales.length === 0) return;

            // Build XML content
            const rows = allSales.map(s => {
                const items = (s.cart?.items || []).map(i =>
                    `<item name="${_esc(i.name)}" qty="${i.qty}" rate="${i.rate}" subtotal="${i.rate * i.qty}"/>`
                ).join('');
                return `  <sale>
    <invoiceId>${_esc(s.id)}</invoiceId>
    <date>${s.date}</date>
    <customerName>${_esc(s.payment?.customerName || '')}</customerName>
    <phone>${_esc(s.payment?.customerPhone || '')}</phone>
    <email>${_esc(s.payment?.customerEmail || '')}</email>
    <paymentMethod>${_esc(s.payment?.method || '')}</paymentMethod>
    <total>${s.cart?.total || 0}</total>
    <items>${items}</items>
  </sale>`;
            }).join('\n');

            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<billingData shop="Bloomeor POS" generated="${new Date().toISOString()}">
${rows}
</billingData>`;

            try {
                const writable = await _billingFileHandle.createWritable();
                await writable.write(xml);
                await writable.close();
                console.log('✅ XML auto-saved:', _billingFileHandle.name);
            } catch (e) {
                console.error('XML save failed:', e);
                showAlert('Save Failed', 'Could not write to XML file. Please reconnect.');
                _billingFileHandle = null;
            }
        };

        // XML escape helper
        const _esc = (str) => String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');



        const showAlert = (title, msg) => {
            document.getElementById('alertTitle').innerText = title;
            document.getElementById('alertMsg').innerText = msg;
            const al = document.getElementById('customAlert');
            al.classList.add('show');
            setTimeout(() => al.classList.remove('show'), 3000);
        };

        const nav = (page) => {
            document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
            document.getElementById(`page-${page}`).classList.add('active');
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            event && event.currentTarget && event.currentTarget.classList.add('active');
        };

        let allProductsRaw = [];

        window.onload = () => {
            console.log('🚀 App Loaded');
            window.loadProducts();
            if(typeof window.updateCart === 'function') window.updateCart();
            
            // Start Live Clock
            setInterval(() => {
                const el = document.getElementById('liveClock');
                if(el) el.innerText = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }, 1000);
        };


        window.loadProducts = () => {
            console.log('📦 Loading products...');
            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run.withSuccessHandler(data => {
                    allProductsRaw = Array.isArray(data) ? data : [];
                    window.renderPOSProducts(allProductsRaw);
                    window.renderPOSCategories(allProductsRaw);
                }).getServerData('products');
            } else {
                let localData = [];
                try {
                    localData = JSON.parse(localStorage.getItem('products') || '[]');
                } catch(e) { localData = []; }
                
                if (Array.isArray(localData) && localData.length > 0) {
                    allProductsRaw = localData;
                } else {
                    allProductsRaw = [
                        { id: 'E-001', name: 'Mechanical Keyboard', category: 'Electronics', sell_rate: 2500, qty: 15 },
                        { id: 'E-002', name: 'Wireless Mouse', category: 'Electronics', sell_rate: 850, qty: 45 },
                        { id: 'S-001', name: 'Premium Ink Pen', category: 'Stationery', sell_rate: 150, qty: 120 },
                        { id: 'G-001', name: 'Green Chilly (500g)', category: 'Groceries', sell_rate: 40, qty: 30 },
                        { id: 'G-002', name: 'Red Tomato (1kg)', category: 'Groceries', sell_rate: 60, qty: 50 },
                        { id: 'G-003', name: 'Organic Potato (1kg)', category: 'Groceries', sell_rate: 35, qty: 100 },
                        { id: 'G-004', name: 'Fresh Onion (1kg)', category: 'Groceries', sell_rate: 45, qty: 80 },
                        { id: 'G-005', name: 'Full Cream Milk (1L)', category: 'Groceries', sell_rate: 66, qty: 25 },
                        { id: 'G-006', name: 'Whole Wheat Bread', category: 'Groceries', sell_rate: 45, qty: 15 },
                        { id: 'F-001', name: 'Athletic Running Shoes', category: 'Footwear', sell_rate: 3200, qty: 12 }
                    ];
                    localStorage.setItem('products', JSON.stringify(allProductsRaw));
                }
                window.renderPOSProducts(allProductsRaw);
                window.renderPOSCategories(allProductsRaw);
            }
        };
        // ── REAL-TIME SYNC ENGINE ────────────────────────────────────────
        // Listen for changes from Inventory or other terminal tabs
        window.addEventListener('storage', (e) => {
            if (e.key === 'products' || e.key === 'inventory_sync_trigger') {
                console.log('🔄 Remote inventory update detected. Syncing...');
                window.loadProducts();
            }
        });

        // Auto-refresh when switching back to this tab
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('👁️ Tab active. Checking for inventory updates...');
                window.loadProducts();
            }
        });

        // Background polling fallback (every 60 seconds)
        setInterval(() => {
            if (document.visibilityState === 'visible') {
                window.loadProducts();
            }
        }, 60000);

        // ── UI RENDERING ENGINE ──────────────────────────────────────────
        window.renderPOSCategories = (data) => {
            const catNav = document.getElementById('posCategoryNav');
            if(!catNav) return;
            const items = data || [];
            const cats = ['All', ...new Set(items.map(p => p.category || 'General'))];
            catNav.innerHTML = cats.map(c => `
                <button class="cat-pill ${c === 'All' ? 'active' : ''}" onclick="filterByCat('${c}', this)">${c}</button>
            `).join('');
        };

        window.filterByCat = (cat, btn) => {
            document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filtered = (cat === 'All') ? allProductsRaw : allProductsRaw.filter(p => p.category === cat);
            window.renderPOSProducts(filtered);
        };

        window.renderPOSProducts = (data) => {
            const grid = document.getElementById('posProductGrid');
            if(!grid) return;
            console.log('🎨 Rendering products (grouped):', data?.length);
            
            const items = Array.isArray(data) ? data : [];
            if(items.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">No products found.</div>';
                return;
            }
            
            // Group by category if we are showing multiple
            const categories = [...new Set(items.map(p => p.category || 'General'))];
            let html = '';
            
            categories.forEach(cat => {
                const catItems = items.filter(p => (p.category || 'General') === cat);
                if (catItems.length > 0) {
                    // Add Category Header (spanning full width)
                    html += `
                        <div style="grid-column: 1/-1; padding: 15px 5px 10px; border-bottom: 1px solid rgba(212, 175, 55, 0.2); margin-top: 10px; display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 0.8rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.1em;">${cat}</span>
                            <div style="flex: 1; height: 1px; background: linear-gradient(90deg, rgba(212, 175, 55, 0.2), transparent);"></div>
                            <span style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.6;">${catItems.length} ITEMS</span>
                        </div>
                    `;
                    
                    html += catItems.map(d => {
                        const isLow = d.qty > 0 && d.qty < 10;
                        const isOut = d.qty <= 0;
                        return `
                            <div class="pos-item ${isOut ? 'out-of-stock' : ''}" onclick="${isOut ? '' : `addToCart('${d.id}', '${d.name}', ${d.sell_rate})`}">
                                <div style="width: 46px; height: 46px; background: rgba(212, 175, 55, 0.08); border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; border: 1px solid rgba(212, 175, 55, 0.2);">
                                    <i class="ph-bold ph-package" style="font-size:1.6rem; color:${isOut ? 'var(--text-muted)' : 'var(--primary)'};"></i>
                                </div>
                                <h4 style="color: var(--text-primary);">${d.name}</h4>
                                <div style="display:flex; flex-direction: column; width:100%; align-items:center; gap: 2px;">
                                    <span class="price" style="color: var(--primary);">₹${d.sell_rate}</span>
                                    <span class="stock" style="color:${isLow ? '#F59E0B' : 'var(--text-muted)'}; opacity:${isOut ? '0.4' : '0.8'}">
                                        ${isOut ? 'Out of Stock' : `${d.qty} in stock`}
                                    </span>
                                </div>
                                ${isLow && !isOut ? '<span style="position:absolute; top:12px; right:12px; width:6px; height:6px; background:#F59E0B; border-radius:50%; box-shadow: 0 0 10px #F59E0B;"></span>' : ''}
                                ${isOut ? '<div style="position:absolute; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; border-radius:18px; font-size:0.7rem; font-weight:900; color:#fff; text-transform:uppercase; backdrop-filter:blur(4px); letter-spacing:0.1em;">Sold Out</div>' : ''}
                            </div>
                        `;
                    }).join('');
                }
            });
            
            grid.innerHTML = html;
        };

        window.addToCart = (id, name, rate) => {
            const product = allProductsRaw.find(p => p.id === id);
            const existing = cart.find(c => c.id === id);
            
            // Real-World Algorithm: Stock Validation
            if (product) {
                const currentQtyInCart = existing ? existing.qty : 0;
                if (currentQtyInCart + 1 > product.qty) {
                    return showAlert('Stock Limit', `Only ${product.qty} units available in warehouse.`);
                }
            }

            if(existing) existing.qty++;
            else cart.push({id, name, rate, qty: 1, discount: 0, discountType: 'pct'});
            updateCart();
        };

        window.clearCart = () => {
            if(cart.length === 0) return;
            if(confirm('Are you sure you want to clear the current order?')) {
                cart = [];
                updateCart();
            }
        };

        window.updateCart = () => {
            let total = 0;
            let subtotal = 0;
            let totalDiscount = 0;
            let count = 0;
            
            const html = cart.map((c, index) => {
                const itemSubtotal = c.rate * c.qty;
                let itemDiscountAmt = 0;
                
                if (c.discountType === 'pct') {
                    itemDiscountAmt = itemSubtotal * (c.discount / 100);
                } else {
                    itemDiscountAmt = c.discount || 0;
                }
                
                const itemFinalTotal = Math.max(0, itemSubtotal - itemDiscountAmt);
                
                subtotal += itemSubtotal;
                totalDiscount += itemDiscountAmt;
                total += itemFinalTotal;
                count += c.qty;
                return `
                    <div class="cart-item">
                        <div class="cart-item-img">
                            <i class="ph-bold ph-package" style="font-size: 1.5rem; color: var(--primary); opacity: 0.6;"></i>
                        </div>
                        
                        <div class="cart-item-info">
                            <h4>${c.name || 'Unknown Product'}</h4>
                            <p>Rate: ₹${c.rate}</p>
                        </div>

                        <div class="cart-item-qty">
                            <button class="cart-qty-btn minus" onclick="updateQty('${c.id}', -1)">
                                <i class="ph-bold ph-minus"></i>
                            </button>
                            <span class="cart-qty-val">${c.qty}</span>
                            <button class="cart-qty-btn plus" onclick="updateQty('${c.id}', 1)">
                                <i class="ph-bold ph-plus"></i>
                            </button>
                        </div>

                        <div class="cart-item-divider"></div>

                        ${window.Auth && !window.Auth.hasPermission('apply_discount') ? '' : `
                        <div class="cart-item-disc">
                            <button onclick="setItemDiscountType('${c.id}', 'pct')" class="cart-disc-btn ${c.discountType === 'pct' ? 'active' : ''}">%</button>
                            <button onclick="setItemDiscountType('${c.id}', 'flat')" class="cart-disc-btn ${c.discountType === 'flat' ? 'active' : ''}">₹</button>
                            <div style="width: 1px; height: 20px; background: var(--border); margin: 0 4px;"></div>
                            <input type="number" value="${c.discount || ''}" oninput="updateItemDiscount('${c.id}', this.value)" placeholder="Offer" style="width: 45px; border: none; background: transparent; text-align: center; font-weight: 800; color: var(--text-primary); font-size: 0.85rem; padding: 0;">
                        </div>
                        `}

                        <button class="cart-item-clear" onclick="removeFromCart('${c.id}')" title="Remove Item">C</button>

                        <div class="cart-item-divider"></div>

                        <div class="cart-item-total">
                            ₹${Math.round(itemFinalTotal)}
                        </div>
                    </div>`;
            }).join('');
            
            // Apply Promo Discount
            let promoAmount = 0;
            if (promoDiscount.value > 0) {
                if (promoDiscount.type === 'pct') {
                    promoAmount = total * (promoDiscount.value / 100);
                } else {
                    promoAmount = promoDiscount.value;
                }
                totalDiscount += promoAmount;
                total = Math.max(0, total - promoAmount);
            }

            const gstAmount = total - (total / 1.18);

            document.getElementById('cartList').innerHTML = html || '<div style="text-align: center; color: var(--text-muted); padding: 40px 20px;"><i class="ph ph-shopping-bag-open" style="font-size: 3rem; opacity: 0.2; margin-bottom: 15px;"></i><p>Your cart is empty.<br>Select products to start an order.</p></div>';
            document.getElementById('cartTotal').innerText = `₹${Math.round(total)}`;
            if(document.getElementById('cartSubtotal')) document.getElementById('cartSubtotal').innerText = `₹${Math.round(subtotal)}`;
            
            // Toggle Discount Row
            const discRow = document.getElementById('discountLineRow');
            if(discRow) {
                if(totalDiscount > 0) {
                    discRow.style.display = 'flex';
                    const promoText = promoDiscount.code ? ` (${promoDiscount.code})` : '';
                    discRow.querySelector('span:first-child').innerText = `Discount${promoText}`;
                    document.getElementById('discountDisplayAmount').innerText = `-₹${Math.round(totalDiscount)}`;
                } else {
                    discRow.style.display = 'none';
                }
            }

            if(document.getElementById('cartGST')) document.getElementById('cartGST').innerText = `₹${gstAmount.toFixed(2)}`;
            if(document.getElementById('itemCountBadge')) document.getElementById('itemCountBadge').innerText = `${count} Items`;

            // Manual Promo Toggle Logic
            const promoBtn = document.getElementById('promoToggleBtn');
            const promoBox = document.getElementById('promoContainer');
            
            if(promoBtn && promoBox) {
                if(cart.length > 0) {
                    // Only show toggle if box is hidden AND no promo code is currently active
                    if(promoBox.style.display !== 'block' && !promoDiscount.code) {
                        promoBtn.style.display = 'flex';
                    } else {
                        promoBtn.style.display = 'none';
                    }
                } else {
                    promoBtn.style.display = 'none';
                    promoBox.style.display = 'none';
                }
            }
        };

        window.toggleEmailInput = () => {
            const container = document.getElementById('emailContainer');
            const btn = document.getElementById('emailToggleBtn');
            if (container.style.display === 'none') {
                container.style.display = 'block';
                btn.innerHTML = '<i class="ph-bold ph-minus-circle"></i> <span>Hide Email Address</span>';
            } else {
                container.style.display = 'none';
                btn.innerHTML = '<i class="ph-bold ph-plus-circle"></i> <span>Add Email Address</span>';
            }
        };

        window.toggleFBInputs = () => {
            const cont = document.getElementById('fbContainer');
            const btn = document.getElementById('fbToggleBtn');
            if (cont.style.display === 'none') {
                cont.style.display = 'block';
                btn.innerHTML = '<i class="ph-bold ph-minus-circle"></i> <span>Hide Table / Business Details</span>';
            } else {
                cont.style.display = 'none';
                btn.innerHTML = '<i class="ph-bold ph-plus-circle"></i> <span>Add Table / Business Details</span>';
            }
        };

        window.togglePromoInput = () => {
            const btn = document.getElementById('promoToggleBtn');
            const box = document.getElementById('promoContainer');
            if(btn && box) {
                btn.style.display = 'none';
                box.style.display = 'block';
                document.getElementById('promoCode').focus();
            }
        };

        window.applyOffer = () => {
            const codeInput = document.getElementById('promoCode');
            if(!codeInput) return;
            const code = codeInput.value.trim().toUpperCase();
            
            if(!code) {
                promoDiscount = { type: 'pct', value: 0, code: '' };
                updateCart();
                return;
            }

            if(code === 'BLOOM10') {
                promoDiscount = { type: 'pct', value: 10, code: 'BLOOM10' };
                if(typeof showAlert === 'function') showAlert('Success', '10% Promo Applied');
            } else if(code === 'SAVE100') {
                promoDiscount = { type: 'flat', value: 100, code: 'SAVE100' };
                if(typeof showAlert === 'function') showAlert('Success', '₹100 Promo Applied');
            } else if(code === 'SAVE50') {
                promoDiscount = { type: 'flat', value: 50, code: 'SAVE50' };
                if(typeof showAlert === 'function') showAlert('Success', '₹50 Promo Applied');
            } else {
                if(typeof showAlert === 'function') showAlert('Error', 'Invalid Promo Code');
                promoDiscount = { type: 'pct', value: 0, code: '' };
                codeInput.value = '';
            }
            updateCart();
        };

        window.applyOfferModal = () => {
            const codeInput = document.getElementById('promoCodeModal');
            if(!codeInput) return;
            const code = codeInput.value.trim().toUpperCase();
            
            if(!code) {
                promoDiscount = { type: 'pct', value: 0, code: '' };
                updateCart();
                // Update modal total after recalculation
                setTimeout(() => {
                    const total = document.getElementById('cartTotal')?.innerText;
                    if(document.getElementById('modalTotalAmount')) document.getElementById('modalTotalAmount').innerText = total;
                }, 50);
                return;
            }

            if(code === 'BLOOM10') {
                promoDiscount = { type: 'pct', value: 10, code: 'BLOOM10' };
                if(typeof showAlert === 'function') showAlert('Success', '10% Promo Applied');
            } else if(code === 'SAVE100') {
                promoDiscount = { type: 'flat', value: 100, code: 'SAVE100' };
                if(typeof showAlert === 'function') showAlert('Success', '₹100 Promo Applied');
            } else if(code === 'SAVE50') {
                promoDiscount = { type: 'flat', value: 50, code: 'SAVE50' };
                if(typeof showAlert === 'function') showAlert('Success', '₹50 Promo Applied');
            } else {
                if(typeof showAlert === 'function') showAlert('Error', 'Invalid Promo Code');
                promoDiscount = { type: 'pct', value: 0, code: '' };
                codeInput.value = '';
            }
            updateCart();
            // Update modal total after recalculation
            setTimeout(() => {
                const total = document.getElementById('cartTotal')?.innerText;
                if(document.getElementById('modalTotalAmount')) document.getElementById('modalTotalAmount').innerText = total;
            }, 50);
        };

        window.setItemDiscountType = (id, type) => {
            const item = cart.find(c => c.id === id);
            if(item) {
                item.discountType = type;
                updateCart();
            }
        };

        window.updateItemDiscount = (id, val) => {
            const item = cart.find(c => c.id === id);
            if(item) {
                item.discount = parseFloat(val) || 0;
                updateCart();
            }
        };

        window.removeFromCart = (id) => {
            cart = cart.filter(c => c.id !== id);
            updateCart();
        };

        window.updateQty = (id, delta) => {
            const item = cart.find(c => c.id === id);
            const product = allProductsRaw.find(p => p.id === id);

            if(item) {
                // Stock Check on Increment
                if (delta > 0 && product && item.qty + delta > product.qty) {
                    return showAlert('Stock Limit', `Only ${product.qty} units available.`);
                }

                item.qty += delta;
                if(item.qty <= 0) cart = cart.filter(c => c.id !== id);
                updateCart();
            }
        };

        window.sendToKitchen = () => {
            if(cart.length === 0) return showAlert('Cart Empty', 'Add items to cart first.');
            
            const custName = document.getElementById('posCustName')?.value || 'Walk-in Customer';
            const tableNo = document.getElementById('posTableNo')?.value || '';
            const orderType = document.getElementById('posOrderType')?.value || 'Dine-in';
            const business = document.getElementById('posCustBusiness')?.value || '';
            
            const kotId = 'KOT-' + Math.floor(1000 + Math.random() * 9000);
            const totalStr = document.getElementById('cartTotal').innerText.replace(/[^0-9.-]+/g,"");
            
            const orderObj = {
                id: kotId,
                date: new Date().toISOString(),
                customer_name: custName,
                customer_business: business,
                table_no: tableNo,
                order_type: orderType,
                items: JSON.parse(JSON.stringify(cart)),
                total: parseFloat(totalStr) || 0,
                status: 'Preparing'
            };
            
            let activeOrders = JSON.parse(localStorage.getItem('bloomeor_active_orders') || '[]');
            activeOrders.push(orderObj);
            localStorage.setItem('bloomeor_active_orders', JSON.stringify(activeOrders));
            
            showAlert('Sent to Kitchen', `${kotId} generated successfully.`);
            
            // Print KOT Receipt
            printKOT(orderObj);
            
            clearCart();
            if(document.getElementById('posTableNo')) document.getElementById('posTableNo').value = '';
        };

        window.printKOT = (order) => {
            const printWindow = window.open('', '', 'height=600,width=400');
            printWindow.document.write('<html><head><title>Kitchen Order Ticket</title>');
            printWindow.document.write('<style>body { font-family: monospace; font-size: 14px; padding: 20px; } h2 { margin: 0; text-align: center; } .item { display: flex; justify-content: space-between; border-bottom: 1px dashed #ccc; padding: 8px 0; }</style>');
            printWindow.document.write('</head><body>');
            printWindow.document.write('<h2>KOT</h2>');
            printWindow.document.write(`<p style="text-align:center; font-weight:bold; font-size:18px; margin: 5px 0;">${order.id}</p>`);
            printWindow.document.write(`<p><strong>Type:</strong> ${order.order_type}</p>`);
            if (order.table_no) printWindow.document.write(`<p><strong>Table:</strong> ${order.table_no}</p>`);
            printWindow.document.write('<hr>');
            order.items.forEach(item => {
                printWindow.document.write(`<div class="item"><span style="font-weight:bold;">${item.qty}x</span> <span>${item.name}</span></div>`);
            });
            printWindow.document.write('<hr>');
            printWindow.document.write(`<p style="text-align:center; font-size:12px;">${new Date(order.date).toLocaleString()}</p>`);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
        };

        window.openPaymentModal = () => {
            if(cart.length === 0) return showAlert('Cart Empty', 'Add items to cart first.');
            
            // Sync fields from POS sidebar to modal
            if(document.getElementById('posCustName')) document.getElementById('custName').value = document.getElementById('posCustName').value;
            if(document.getElementById('posCustPhone')) document.getElementById('custPhone').value = document.getElementById('posCustPhone').value;
            if(document.getElementById('posCustEmail')) document.getElementById('custEmail').value = document.getElementById('posCustEmail').value;
            if(document.getElementById('posCustBusiness')) document.getElementById('custBusiness').value = document.getElementById('posCustBusiness').value;
            
            // UI State Reset
            if(document.getElementById('paymentInputs')) document.getElementById('paymentInputs').style.display = 'block';
            if(document.getElementById('posSuccessState')) document.getElementById('posSuccessState').style.display = 'none';
            
            // Populate Amount Due
            if(document.getElementById('modalTotalAmount')) {
                document.getElementById('modalTotalAmount').innerText = document.getElementById('cartTotal').innerText;
            }
            
            // Reset Button
            const finalizeBtn = document.getElementById('finalizeBtn');
            if(finalizeBtn) {
                finalizeBtn.innerHTML = '<i class="ph-bold ph-check-circle"></i> Complete Sale';
                finalizeBtn.disabled = false;
            }
            
            document.getElementById('paymentModal').style.display = 'flex';
        };

        window.finalizeSale = () => {
            const finalizeBtn = document.getElementById('finalizeBtn');
            const originalHtml = finalizeBtn.innerHTML;
            finalizeBtn.innerHTML = '<i class="ph-bold ph-circle-notch ph-spin"></i> Processing...';
            finalizeBtn.disabled = true;
            
            const paymentData = {
                customerName: document.getElementById('custName').value || 'Walk-in Customer',
                customerPhone: document.getElementById('custPhone').value || '',
                customerEmail: document.getElementById('custEmail').value || '',
                customerBusiness: document.getElementById('custBusiness') ? document.getElementById('custBusiness').value : '',
                method: selectedPaymentMethod,
                type: 'Full'
            };
            
            const rawTotal = document.getElementById('cartTotal').innerText.replace(/[₹,]/g, '').trim();
            const subtotal = document.getElementById('cartSubtotal').innerText.replace(/[₹,]/g, '').trim();
            const discAmt = document.getElementById('discountDisplayAmount').innerText.replace(/[-₹,]/g, '').trim();

            const cartData = {
                items: cart.map(c => ({...c})),   // snapshot of cart items
                subtotal: parseInt(subtotal) || 0,
                discount: parseInt(discAmt) || 0,
                total: parseInt(rawTotal) || 0
            };
            
            if (typeof google !== 'undefined' && google.script && google.script.run) {
                // ONLINE MODE (Google Sheets)
                google.script.run.withSuccessHandler(res => {
                    if(res.success) {
                        showAlert('Success', `Invoice ${res.invoiceId} saved!`);
                        lastSaleData = { id: res.invoiceId, payment: paymentData, cart: cartData };
                        populateTemplates(res.invoiceId, paymentData, cartData);

                        // Layer 2: Save locally + auto-export Excel + auto-save XML
                        saveSaleToLocal(lastSaleData);
                        exportOfflineData(true);
                        autoSaveXML();   // ← writes directly to connected XML file

                        // Layer 3: Automatic Cloud Backup with all billing fields
                        saveToOnlineForm(lastSaleData);

                        if(document.getElementById('paymentInputs')) document.getElementById('paymentInputs').style.display = 'none';
                        if(document.getElementById('posSuccessState')) document.getElementById('posSuccessState').style.display = 'block';
                        if(document.getElementById('successInvoiceId')) document.getElementById('successInvoiceId').innerText = `#INV-${res.invoiceId || 'SYNCED'}`;

                        if(res.waLink) waLinkTemp = res.waLink;
                        loadProducts(); 
                    } else {
                        showAlert('Error', res.message);
                        finalizeBtn.innerHTML = originalHtml;
                        finalizeBtn.disabled = false;
                    }
                }).withFailureHandler(err => {
                    showAlert('Connection Error', 'Could not reach server. Saving locally...');
                    saveOffline(paymentData, cartData);
                }).processPOSCheckout(cartData, paymentData);
            } else {
                // OFFLINE / SIMULATION MODE
                saveOffline(paymentData, cartData);
            }
        };

        window.saveOffline = (paymentData, cartData) => {
            const fakeId = 'OFF-' + Date.now().toString().slice(-6);
            
            // Save to local storage for persistence in offline mode
            const offlineSales = JSON.parse(localStorage.getItem('offline_sales') || '[]');
            offlineSales.push({ id: fakeId, payment: paymentData, cart: cartData, date: new Date().toISOString() });
            localStorage.setItem('offline_sales', JSON.stringify(offlineSales));

            showAlert('Sale Saved!', 'Saved offline. Excel file downloading...');
            lastSaleData = { id: fakeId, payment: paymentData, cart: cartData };
            populateTemplates(fakeId, paymentData, cartData);

            // Layer 2: Save locally + auto-export Excel + auto-save XML
            saveSaleToLocal(lastSaleData);
            exportOfflineData(true);
            autoSaveXML();   // ← writes directly to connected XML file

            // Layer 3: Cloud backup even in offline mode
            saveToOnlineForm(lastSaleData);

            if(document.getElementById('paymentInputs')) document.getElementById('paymentInputs').style.display = 'none';
            if(document.getElementById('posSuccessState')) document.getElementById('posSuccessState').style.display = 'block';
            if(document.getElementById('successInvoiceId')) document.getElementById('successInvoiceId').innerText = `#INV-${fakeId}`;
        };

        let lastSaleData = null;

        window.populateTemplates = (invoiceId, paymentData, cartData) => {
            try {
                // Populate A4 Receipt
                const safeSet = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
                
                safeSet('receiptCustName', paymentData.customerName);
                safeSet('receiptCustPhone', paymentData.customerPhone || 'N/A');
                safeSet('receiptCustEmail', paymentData.customerEmail || 'N/A');
                safeSet('receiptInvoiceId', invoiceId);
                safeSet('receiptDate', new Date().toLocaleDateString());
                safeSet('receiptPaymentMethod', paymentData.method);
                
                const rowsHtml = cartData.items.map(item => `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px 5px;">${item.name}</td>
                        <td style="text-align: center;">${item.qty}</td>
                        <td style="text-align: right;">₹${item.rate}</td>
                        <td style="text-align: right;">₹${item.rate * item.qty}</td>
                    </tr>
                `).join('');
                const itemRows = document.getElementById('receiptItemRows');
                if(itemRows) itemRows.innerHTML = rowsHtml;
                
                const total = cartData.total;
                const disc = cartData.discount || 0;
                const subtotal = cartData.subtotal || total;
                const gst = total - (total / 1.18);
                
                safeSet('receiptSubtotal', '₹' + subtotal);
                
                const discRow = document.getElementById('receiptDiscountRow');
                if (disc > 0) {
                    discRow.style.display = 'flex';
                    safeSet('receiptDiscount', '-₹' + disc);
                } else {
                    discRow.style.display = 'none';
                }

                safeSet('receiptGST', '₹' + gst.toFixed(2));
                safeSet('receiptTotal', '₹' + total);

                // Populate Thermal Receipt
                safeSet('thInvoiceId', invoiceId);
                safeSet('thDate', new Date().toLocaleDateString());
                safeSet('thCustName', paymentData.customerName);
                
                const thDiscRow = document.getElementById('thDiscountRow');
                if (disc > 0) {
                    thDiscRow.style.display = 'flex';
                    safeSet('thDiscount', '-₹' + disc);
                } else {
                    thDiscRow.style.display = 'none';
                }
                
                const thRowsHtml = cartData.items.map(item => `
                    <div style="display: flex; margin-bottom: 1mm;">
                        <span style="flex: 2;">${item.name.substring(0, 15)}</span>
                        <span style="flex: 0.5; text-align: center;">${item.qty}</span>
                        <span style="flex: 1; text-align: right;">₹${item.rate * item.qty}</span>
                    </div>
                `).join('');
                const thItemRows = document.getElementById('thItemRows');
                if(thItemRows) thItemRows.innerHTML = thRowsHtml;
                safeSet('thTotal', '₹' + total);
            } catch (e) {
                console.error('Error populating templates:', e);
            }
        };

        function printReceipt(type) {
            if(!lastSaleData) return;
            
            if(type === 'a4') {
                const element = document.getElementById('receiptTemplate');
                element.style.display = 'block';
                const opt = {
                    margin: 10,
                    filename: `Invoice_${lastSaleData.id}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2 },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };
                html2pdf().set(opt).from(element).save().then(() => {
                    element.style.display = 'none';
                });
            } else if (type === 'thermal') {
                const element = document.getElementById('thermalTemplate');
                element.style.display = 'block';
                
                // Use browser print for thermal
                const printWindow = window.open('', '_blank');
                printWindow.document.write('<html><head><title>Print Receipt</title></head><body>');
                printWindow.document.write(element.outerHTML);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                    element.style.display = 'none';
                }, 500);
            }
        }
        window.printReceipt = printReceipt;
        window.printA4Receipt = () => printReceipt('a4');
        window.printThermalReceipt = () => printReceipt('thermal');

        // ── LOCAL STORAGE + AUTO EXCEL SAVE ─────────────────────────────
        const saveSaleToLocal = (saleObj) => {
            const allSales = JSON.parse(localStorage.getItem('all_sales') || '[]');
            // Avoid duplicates by invoice ID
            const exists = allSales.find(s => s.id === saleObj.id);
            if (!exists) {
                allSales.push({ ...saleObj, date: new Date().toISOString() });
                localStorage.setItem('all_sales', JSON.stringify(allSales));
            }
        };

        const exportOfflineData = (triggerSale) => {
            // Merge all saved sales + current sale
            const allSales = JSON.parse(localStorage.getItem('all_sales') || '[]');

            if (allSales.length === 0 && !triggerSale) {
                showAlert('Info', 'No sales recorded yet.');
                return;
            }

            // Build Excel rows with all billing fields
            const rows = allSales.map(s => ({
                'Date & Time'   : new Date(s.date).toLocaleString('en-IN'),
                'Invoice ID'    : s.id,
                'Customer Name' : s.payment?.customerName || '',
                'Phone'         : s.payment?.customerPhone || '',
                'Email'         : s.payment?.customerEmail || '',
                'Items Purchased': (s.cart?.items || []).map(i => `${i.name} x${i.qty}`).join('; '),
                'Payment Method': s.payment?.method || '',
                'Total (Rs.)'   : s.cart?.total || 0
            }));

            // Style the header row
            const ws = XLSX.utils.json_to_sheet(rows);

            // Set column widths
            ws['!cols'] = [
                { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 14 },
                { wch: 28 }, { wch: 40 }, { wch: 16 }, { wch: 12 }
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Billing Log');

            // Auto-download with professional filename
            XLSX.writeFile(wb, 'Bloomeor_Sales_Log.xlsx');

            if (triggerSale) {
                showAlert('Saved!', 'Billing details auto-saved — move file to "Billling Data" folder.');
            } else {
                showAlert('Success', 'Excel file downloaded. Save it to "Billling Data" folder.');
            }
        };


        const saveToOnlineForm = (saleData) => {
            // Use passed saleData OR lastSaleData
            const d = saleData || lastSaleData;
            if(!d) return;

            // Map payment method to form options
            const methodMap = { 'Cash': 'Cash', 'UPI': 'Upi/Other', 'Card': 'card' };
            const payMethod = methodMap[d.payment.method] || d.payment.method;

            // Build item list string — cart items use { name, rate, qty }
            const itemList = (d.cart.items || []).map(i => `${i.name} x${i.qty} (Rs.${i.rate * i.qty})`).join('; ');

            // Build full GET URL with all 6 form fields
            const formBase = 'https://docs.google.com/forms/d/e/1FAIpQLSd-TA73amOnEqSnH62t4qMqYlMoUsPnlSPMntDD_4IQmrUd_g/formResponse';
            const params = [
                `entry.776596112=${encodeURIComponent(d.payment.customerName || 'Walk-in')}`,
                `entry.936598784=${encodeURIComponent(d.payment.customerPhone || '')}`,
                `entry.1228758861=${encodeURIComponent(d.payment.customerEmail || '')}`,
                `entry.1488577737=${encodeURIComponent(itemList)}`,
                `entry.315318327=${encodeURIComponent(payMethod)}`,
                `entry.215186335=${encodeURIComponent(d.cart.total)}`,
                `submit=Submit`
            ].join('&');

            const finalUrl = `${formBase}?${params}`;

            // Silent submission via hidden iframe (most reliable for form POST)
            let iframe = document.getElementById('gform_iframe');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'gform_iframe';
                iframe.name = 'gform_iframe';
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
            }

            // Use a hidden form POST for reliability
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = formBase;
            form.target = 'gform_iframe';
            form.style.display = 'none';

            const fields = {
                'entry.776596112': d.payment.customerName || 'Walk-in',
                'entry.936598784': d.payment.customerPhone || '',
                'entry.1228758861': d.payment.customerEmail || '',
                'entry.1488577737': itemList,
                'entry.315318327': payMethod,
                'entry.215186335': String(d.cart.total)
            };

            Object.entries(fields).forEach(([name, value]) => {
                const inp = document.createElement('input');
                inp.type = 'hidden';
                inp.name = name;
                inp.value = value;
                form.appendChild(inp);
            });

            document.body.appendChild(form);
            form.submit();
            setTimeout(() => {
                if (form.parentNode) form.parentNode.removeChild(form);
            }, 3000);

            console.log('✅ Cloud backup submitted:', fields);
        };

        window.setPaymentMethod = (method) => {
            selectedPaymentMethod = method;
            document.querySelectorAll('.payment-opt').forEach(btn => {
                btn.classList.toggle('active', btn.id === `payMethod${method}`);
            });
            console.log('Payment Method selected:', selectedPaymentMethod);
        };

        const openWhatsApp = () => {
            window.open(waLinkTemp, '_blank');
        };

        window.resetPOS = () => {
            cart = [];
            updateCart();
            
            // Clear inputs
            if(document.getElementById('posCustName')) document.getElementById('posCustName').value = 'Walk-in Customer';
            if(document.getElementById('posCustPhone')) document.getElementById('posCustPhone').value = '';
            if(document.getElementById('posCustEmail')) document.getElementById('posCustEmail').value = '';
            if(document.getElementById('custPhone')) document.getElementById('custPhone').value = '';
            if(document.getElementById('custEmail')) document.getElementById('custEmail').value = '';
            
            // Reset Modal & Panels
            document.getElementById('paymentModal').style.display = 'none';
            if(document.getElementById('posCheckoutForm')) document.getElementById('posCheckoutForm').style.display = 'block';
            if(document.getElementById('posSuccessState')) document.getElementById('posSuccessState').style.display = 'none';
            
            if(document.getElementById('finalizeBtn')) {
                document.getElementById('finalizeBtn').innerHTML = '<i class="ph-bold ph-check-circle"></i> Complete Sale';
                document.getElementById('finalizeBtn').disabled = false;
            }
            
            // Reset Discount
            if(document.getElementById('discountInput')) document.getElementById('discountInput').value = '';
            discountVal = 0;
            
            showAlert('POS Reset', 'Ready for new transaction.');
        };

        window.searchProducts = () => {
            const query = document.getElementById('posSearch').value.toLowerCase();
            const filtered = allProductsRaw.filter(p => 
                (p.name && p.name.toLowerCase().includes(query)) || 
                (p.category && p.category.toLowerCase().includes(query)) ||
                (p.id && p.id.toLowerCase().includes(query))
            );
            window.renderPOSProducts(filtered);
        };

        // Init Empty Cart view
        updateCart();

        // --- Data Submission ---
        const submitNewProduct = () => {
            const data = {
                name: document.getElementById('newProdName').value,
                category: document.getElementById('newProdCat').value,
                buy_rate: parseFloat(document.getElementById('newProdBuy').value),
                sell_rate: parseFloat(document.getElementById('newProdSell').value),
                qty: parseInt(document.getElementById('newProdQty').value)
            };
            if(!data.name || !data.sell_rate) return showAlert('Error', 'Name and Sell Rate are required.');
            
            google.script.run.withSuccessHandler(res => {
                if(res.success) {
                    showAlert('Success', res.message);
                    document.getElementById('newProdName').value = '';
                    document.getElementById('newProdCat').value = '';
                    document.getElementById('newProdBuy').value = '';
                    document.getElementById('newProdSell').value = '';
                    document.getElementById('newProdQty').value = '';
                    loadProducts(); // Refresh POS grid in background
                } else showAlert('Error', res.message);
            }).saveProduct(data);
        };

        const submitNewCustomer = () => {
            const data = {
                name: document.getElementById('newCustName').value,
                phone: document.getElementById('newCustPhone').value,
                email: document.getElementById('newCustEmail').value
            };
            if(!data.name) return showAlert('Error', 'Customer Name is required.');
            
            google.script.run.withSuccessHandler(res => {
                if(res.success) {
                    showAlert('Success', res.message);
                    document.getElementById('newCustName').value = '';
                    document.getElementById('newCustPhone').value = '';
                    document.getElementById('newCustEmail').value = '';
                } else showAlert('Error', res.message);
            }).saveCustomer(data);
        };
/**
 * Bloomeor Notification Center
 * Handles real-time alerts for Low Stock, Expiry, and Overdue Payments
 */
const NotificationCenter = {
    notifications: [],
    
    init() {
        this.renderUI();
        this.refresh();
        // Auto-refresh every 5 minutes
        setInterval(() => this.refresh(), 300000);
        
        // Handle clicks outside to close panel
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('notificationPanel');
            const bell = document.querySelector('.notification-bell');
            if (panel && bell && !panel.contains(e.target) && !bell.contains(e.target)) {
                panel.style.display = 'none';
            }
        });
    },

    renderUI() {
        const topbarRight = document.querySelector('.topbar > div');
        if (!topbarRight) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'notification-wrapper';
        wrapper.innerHTML = `
            <div class="notification-bell" onclick="NotificationCenter.togglePanel()">
                <i class="ph-bold ph-bell"></i>
                <span id="notificationBadge" class="notification-badge" style="display:none;">0</span>
            </div>
            <div id="notificationPanel" class="notification-panel">
                <div class="notification-header">
                    <h4 style="margin:0; font-size:1rem; font-weight:700;">Notifications</h4>
                    <button onclick="NotificationCenter.markAllRead()" style="background:none; border:none; color:var(--primary); font-size:0.75rem; font-weight:600; cursor:pointer;">Mark all read</button>
                </div>
                <div id="notificationBody" class="notification-body">
                    <div style="padding:40px; text-align:center; color:var(--text-muted);">
                        <i class="ph ph-bell-slash" style="font-size:2rem; opacity:0.2;"></i>
                        <p style="margin-top:10px; font-size:0.85rem;">No new notifications</p>
                    </div>
                </div>
                <div class="notification-footer">
                    <a href="reminders.html" style="color:var(--text-muted); text-decoration:none; font-size:0.75rem; font-weight:600;">View All Reminders</a>
                </div>
            </div>
        `;
        topbarRight.insertBefore(wrapper, topbarRight.firstChild);
    },

    togglePanel() {
        const panel = document.getElementById('notificationPanel');
        if (!panel) return;
        panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
    },

    refresh() {
        if (typeof google !== 'undefined') {
            google.script.run.withSuccessHandler(data => {
                this.processData(data);
            }).getServerData('all_alerts'); // Assuming a combined alert endpoint exists or we'll make one
        } else {
            // Local fallback
            const products = JSON.parse(localStorage.getItem('products') || '[]');
            this.processData({ products });
        }
    },

    processData(data) {
        this.notifications = [];
        const products = data.products || [];
        const reminders = data.reminders || { receivables: [], payables: [] };
        
        // 1. Low Stock Alerts
        products.filter(p => p.qty > 0 && p.qty < 10).forEach(p => {
            this.notifications.push({
                id: 'low-' + p.id,
                type: 'stock',
                title: 'Low Stock Alert',
                message: `${p.name} is running low (${p.qty} remaining). Reorder soon.`,
                icon: 'ph-warning',
                color: '#F59E0B',
                time: 'Just now'
            });
        });

        // 2. Expiry Alerts
        const today = new Date();
        const next30 = new Date();
        next30.setDate(today.getDate() + 30);
        
        products.filter(p => p.expiry_date).forEach(p => {
            const ex = new Date(p.expiry_date);
            if (ex <= next30) {
                const diff = Math.ceil((ex - today) / (1000 * 60 * 60 * 24));
                this.notifications.push({
                    id: 'exp-' + p.id,
                    type: 'expiry',
                    title: diff <= 0 ? 'Product Expired' : 'Expiry Warning',
                    message: `${p.name} ${diff <= 0 ? 'expired' : 'expires'} on ${p.expiry_date}.`,
                    icon: 'ph-hourglass',
                    color: '#EF4444',
                    time: diff <= 0 ? 'Urgent' : diff + ' days left'
                });
            }
        });

        // 3. Payment Alerts (Receivables)
        reminders.receivables.forEach(r => {
            this.notifications.push({
                id: 'rec-' + r.id,
                type: 'payment',
                title: 'Payment Pending',
                message: `₹${r.total} pending from ${r.customerName} (Inv: ${r.id}).`,
                icon: 'ph-money',
                color: '#3B82F6',
                time: 'Receivable'
            });
        });

        // 4. Payment Alerts (Payables)
        reminders.payables.forEach(p => {
            this.notifications.push({
                id: 'pay-' + p.id,
                type: 'payment',
                title: 'Vendor Payment Due',
                message: `₹${p.total} due to ${p.supplierName} (Pur: ${p.id}).`,
                icon: 'ph-hand-coins',
                color: '#EF4444',
                time: 'Payable'
            });
        });

        this.renderNotifications();
    },

    renderNotifications() {
        const body = document.getElementById('notificationBody');
        const badge = document.getElementById('notificationBadge');
        if (!body) return;

        if (this.notifications.length === 0) {
            body.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);"><i class="ph ph-bell-slash" style="font-size:2rem; opacity:0.2;"></i><p style="margin-top:10px; font-size:0.85rem;">No new notifications</p></div>';
            badge.style.display = 'none';
            return;
        }

        badge.style.display = 'flex';
        badge.innerText = this.notifications.length;

        body.innerHTML = this.notifications.map(n => `
            <div class="notification-item unread">
                <div class="notification-icon" style="background:${n.color}20; color:${n.color};">
                    <i class="ph ${n.icon}"></i>
                </div>
                <div class="notification-content">
                    <h5>${n.title}</h5>
                    <p>${n.message}</p>
                    <div style="font-size:0.65rem; color:var(--text-muted); margin-top:6px; font-weight:600;">${n.time}</div>
                </div>
            </div>
        `).join('');
    },

    markAllRead() {
        this.notifications = [];
        this.renderNotifications();
        showAlert('Success', 'All notifications cleared.');
    }
};

// Hook into existing initApp
const originalInitApp = initApp;
initApp = () => {
    originalInitApp();
    NotificationCenter.init();
};

/**
 * PWA Service Worker Registration
 */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('../../sw.js')
            .then(reg => console.log('✅ Service Worker Registered', reg.scope))
            .catch(err => console.error('❌ Service Worker Failed', err));
    });
}

