let currentUser = null;
        let cart = [];
        let waLinkTemp = '';

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

        // Auto-initialize on load
        window.onload = () => {
            initApp();
        };

        let allProductsRaw = [];

        const initApp = () => {
            loadProducts();
        };

        const loadProducts = () => {
            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run.withSuccessHandler(data => {
                    allProductsRaw = data || [];
                    renderPOSProducts(allProductsRaw);
                }).getServerData('products');
            } else {
                // Simulation Mode (Empty by default for real-world integration)
                allProductsRaw = [];
                renderPOSProducts(allProductsRaw);
            }
        };


        const renderPOSProducts = (data) => {
            const grid = document.getElementById('posProductGrid');
            if(!grid) return;
            grid.innerHTML = data.filter(d => d.qty > 0).map(d => `
                <div class="pos-item" onclick="addToCart('${d.id}', '${d.name}', ${d.sell_rate})">
                    <i class="ph ph-package" style="font-size:2.5rem; color:var(--text-sub); margin-bottom:10px;"></i>
                    <h4 style="font-size: 0.9rem; margin-bottom: 5px;">${d.name}</h4>
                    <strong style="color:var(--primary)">₹${d.sell_rate}</strong>
                </div>
            `).join('');
        };

        const searchProducts = () => {
            const query = document.getElementById('posSearch').value.toLowerCase();
            const filtered = allProductsRaw.filter(p => 
                p.name.toLowerCase().includes(query) || 
                (p.category && p.category.toLowerCase().includes(query)) ||
                p.id.toLowerCase().includes(query)
            );
            renderPOSProducts(filtered);
        };

        const addToCart = (id, name, rate) => {
            const existing = cart.find(c => c.id === id);
            if(existing) existing.qty++;
            else cart.push({id, name, rate, qty: 1});
            updateCart();
        };

        const clearCart = () => {
            if(cart.length === 0) return;
            if(confirm('Are you sure you want to clear the current order?')) {
                cart = [];
                updateCart();
            }
        };

        const updateCart = () => {
            let total = 0;
            let count = 0;
            const html = cart.map((c, index) => {
                total += c.rate * c.qty;
                count += c.qty;
                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding: 15px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <div style="flex: 1;">
                            <p style="font-weight: 600; font-size: 1rem; margin-bottom: 4px;">${c.name}</p>
                            <p style="font-size: 0.85rem; color: var(--text-muted);">₹${c.rate} each</p>
                        </div>
                        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                            <p style="font-weight: 700; color: var(--primary); font-size: 1.1rem;">₹${c.rate * c.qty}</p>
                            <div style="display:flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.03); padding: 4px 8px; border-radius: 30px; border: 1px solid var(--border);">
                                <button onclick="updateQty('${c.id}', -1)" style="background: rgba(239, 68, 68, 0.1); border: none; color: #EF4444; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: all 0.2s;">
                                    <i class="ph ph-minus"></i>
                                </button>
                                <span style="font-weight: 700; font-size: 1rem; min-width: 20px; text-align: center;">${c.qty}</span>
                                <button onclick="updateQty('${c.id}', 1)" style="background: rgba(16, 185, 129, 0.1); border: none; color: #10B981; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; transition: all 0.2s;">
                                    <i class="ph ph-plus"></i>
                                </button>
                            </div>
                        </div>
                    </div>`;
            }).join('');
            
            // GST Calculations (Inclusive 18%)
            const gstAmount = total - (total / 1.18);

            document.getElementById('cartList').innerHTML = html || '<div style="text-align: center; color: var(--text-muted); padding: 40px 20px;"><i class="ph ph-shopping-bag-open" style="font-size: 3rem; opacity: 0.2; margin-bottom: 15px;"></i><p>Your cart is empty.<br>Select products to start an order.</p></div>';
            document.getElementById('cartTotal').innerText = `₹${Math.round(total)}`;
            if(document.getElementById('cartSubtotal')) document.getElementById('cartSubtotal').innerText = `₹${Math.round(total)}`;
            if(document.getElementById('cartGST')) document.getElementById('cartGST').innerText = `₹${gstAmount.toFixed(2)}`;
            if(document.getElementById('itemCountBadge')) document.getElementById('itemCountBadge').innerText = `${count} Items`;
        };

        const updateQty = (id, delta) => {
            const item = cart.find(c => c.id === id);
            if(item) {
                item.qty += delta;
                if(item.qty <= 0) cart = cart.filter(c => c.id !== id);
                updateCart();
            }
        };

        const openPaymentModal = () => {
            if(cart.length === 0) return showAlert('Cart Empty', 'Add items to cart first.');
            
            // Sync fields from POS sidebar to modal
            if(document.getElementById('posCustName')) document.getElementById('custName').value = document.getElementById('posCustName').value;
            if(document.getElementById('posCustPhone')) document.getElementById('custPhone').value = document.getElementById('posCustPhone').value;
            if(document.getElementById('posCustEmail')) document.getElementById('custEmail').value = document.getElementById('posCustEmail').value;
            
            document.getElementById('modalTotalDue').innerText = document.getElementById('cartTotal').innerText;
            
            // Reset modal state
            const postSaleActions = document.getElementById('postSaleActions');
            const confirmBtnRow = document.getElementById('confirmBtn').parentElement;
            
            if(postSaleActions) postSaleActions.style.display = 'none';
            if(confirmBtnRow) confirmBtnRow.style.display = 'flex';
            
            document.getElementById('paymentModal').style.display = 'flex';
        };

        const confirmPayment = () => {
            const confirmBtn = document.getElementById('confirmBtn');
            const originalHtml = confirmBtn.innerHTML;
            confirmBtn.innerHTML = '<i class="ph ph-circle-notch ph-spin"></i> Processing...';
            confirmBtn.disabled = true;
            
            const paymentData = {
                customerName: document.getElementById('custName').value || 'Walk-in Customer',
                customerPhone: document.getElementById('custPhone').value || '',
                customerEmail: document.getElementById('custEmail').value || '',
                method: document.getElementById('payMethod').value,
                type: 'Full'
            };
            
            const rawTotal = document.getElementById('cartTotal').innerText.replace(/[₹,]/g, '').trim();
            const cartData = {
                items: cart.map(c => ({...c})),   // snapshot of cart items
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

                        document.getElementById('postSaleActions').style.display = 'block';
                        confirmBtn.parentElement.style.display = 'none';

                        if(res.waLink) waLinkTemp = res.waLink;
                        loadProducts(); 
                    } else {
                        showAlert('Error', res.message);
                        confirmBtn.innerHTML = originalHtml;
                        confirmBtn.disabled = false;
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

        const saveOffline = (paymentData, cartData) => {
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

            document.getElementById('postSaleActions').style.display = 'block';
            document.getElementById('confirmBtn').parentElement.style.display = 'none';
        };

        let lastSaleData = null;

        const populateTemplates = (invoiceId, paymentData, cartData) => {
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
                const gst = total - (total / 1.18);
                const subtotal = total - gst;
                
                safeSet('receiptSubtotal', '₹' + subtotal.toFixed(2));
                safeSet('receiptGST', '₹' + gst.toFixed(2));
                safeSet('receiptTotal', '₹' + total);

                // Populate Thermal Receipt
                safeSet('thInvoiceId', invoiceId);
                safeSet('thDate', new Date().toLocaleDateString());
                safeSet('thCustName', paymentData.customerName);
                
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

        const printReceipt = (type) => {
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
        };

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

        const openWhatsApp = () => {
            window.open(waLinkTemp, '_blank');
        };

        const resetPOS = () => {
            cart = [];
            updateCart();
            document.getElementById('custPhone').value = '';
            document.getElementById('custEmail').value = '';
            document.getElementById('paymentModal').style.display = 'none';
            document.getElementById('postSaleActions').style.display = 'none';
            document.getElementById('confirmBtn').parentElement.style.display = 'flex';
            document.getElementById('confirmBtn').innerHTML = '<i class="ph ph-check-circle"></i> Confirm Sale';
            document.getElementById('confirmBtn').disabled = false;
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
