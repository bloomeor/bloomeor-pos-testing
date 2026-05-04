/**
 * =========================================================
 * Bloomeor POS Backend
 * Files: Code.gs
 * Description: Server-side logic for Google Apps Script SPA
 * Features: Google Sheets Database, Emailing, WhatsApp links
 * =========================================================
 */

const CACHE_TIME = 21600; 

function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Bloomeor POS - Indian Retail System')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Ensures all required sheets exist for a generic small business
 */
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = {
    'Users': ['id', 'name', 'email', 'phone', 'password', 'role', 'is_active'],
    'Products': ['id', 'name', 'category', 'buy_rate', 'sell_rate', 'qty', 'status', 'expiry_date', 'createdAt'],
    'Customers': ['id', 'name', 'phone', 'address', 'email', 'gstin', 'category', 'createdAt'],
    'Sales': ['id', 'date', 'customerName', 'customerPhone', 'items', 'paymentMethod', 'total', 'paymentStatus', 'tax', 'discount'],
    'Sale_Items': ['saleId', 'productId', 'productName', 'qty', 'price', 'total'],
    'Payments': ['id', 'type', 'entity', 'amount', 'method', 'date', 'reference', 'notes', 'createdAt'],
    'Suppliers': ['id', 'name', 'phone', 'email', 'address', 'gstin', 'category', 'is_active', 'createdAt'],
    'Purchases': ['id', 'date', 'supplierName', 'items', 'total', 'status', 'paymentMethod'],
    'Expenses': ['id', 'category', 'amount', 'date', 'payMethod', 'description', 'reference', 'createdAt'],
    'Settings': ['key', 'value']
  };
  
  Object.keys(sheets).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(sheets[name]);
      sheet.getRange(1, 1, 1, sheets[name].length).setFontWeight('bold').setBackground('#f3f3f3');
    } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(sheets[name]);
      sheet.getRange(1, 1, 1, sheets[name].length).setFontWeight('bold').setBackground('#f3f3f3');
    }
  });

  // Default Settings if empty
  const setSheet = ss.getSheetByName('Settings');
  if (setSheet.getLastRow() <= 1) {
    setSheet.appendRow(['bizName', 'Bloomeor Mart']);
    setSheet.appendRow(['currencySymbol', '₹']);
    setSheet.appendRow(['defaultTax', '18']);
  }
}

/**
 * Save settings to the cloud
 */
function saveSettings(settings) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Settings');
    if (!sheet) {
      sheet = ss.insertSheet('Settings');
      sheet.appendRow(['key', 'value']);
    }
    
    const data = sheet.getDataRange().getValues();
    const keys = data.map(r => String(r[0]));
    
    Object.keys(settings).forEach(key => {
      const idx = keys.indexOf(key);
      if (idx > -1) {
        sheet.getRange(idx + 1, 2).setValue(settings[key]);
      } else {
        sheet.appendRow([key, settings[key]]);
      }
    });
    
    return { success: true, message: 'Settings saved to cloud.' };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}



function getServerData(endpoint, params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (endpoint === 'products')  return sheetToJSON(ss.getSheetByName('Products'));
  if (endpoint === 'customers') return sheetToJSON(ss.getSheetByName('Customers'));
  if (endpoint === 'purchases') {
    const sheet = ss.getSheetByName('Purchases');
    return sheet ? sheetToJSON(sheet) : [];
  }
  if (endpoint === 'sales') {
    const sheet = ss.getSheetByName('Sales');
    return sheet ? sheetToJSON(sheet) : [];
  }
  if (endpoint === 'suppliers') {
    const sheet = ss.getSheetByName('Suppliers');
    return sheet ? sheetToJSON(sheet) : [];
  }
  if (endpoint === 'payments') {
    const sheet = ss.getSheetByName('Payments');
    return sheet ? sheetToJSON(sheet) : [];
  }
  if (endpoint === 'expenses') {
    const sheet = ss.getSheetByName('Expenses');
    return sheet ? sheetToJSON(sheet) : [];
  }
    return { receivables, payables };
  }

  if (endpoint === 'all_alerts') {
    return {
      products: sheetToJSON(ss.getSheetByName('Products')) || [],
      reminders: getServerData('reminders')
    };
  }

  if (endpoint === 'reportData') {
    return {
      sales: sheetToJSON(ss.getSheetByName('Sales')) || [],
      expenses: sheetToJSON(ss.getSheetByName('Expenses')) || [],
      purchases: sheetToJSON(ss.getSheetByName('Purchases')) || [],
      products: sheetToJSON(ss.getSheetByName('Products')) || []
    };
  }
  
  if (endpoint === 'settings') {
    const sheet = ss.getSheetByName('Settings');
    const data = sheetToJSON(sheet);
    const settings = {};
    data.forEach(r => { settings[r.key] = r.value; });
    return settings;
  }
  
  if (endpoint === 'dashboardStats') {
    const salesSheet = ss.getSheetByName('Sales');
    const custSheet = ss.getSheetByName('Customers');
    const prodSheet = ss.getSheetByName('Products');
    
    const salesData = sheetToJSON(salesSheet);
    const customers = sheetToJSON(custSheet);
    const products = sheetToJSON(prodSheet);
    
    // Calculate Total Sales
    const totalSales = salesData.reduce((sum, row) => sum + (parseFloat(row.total) || 0), 0);
    
    // Calculate Sales Today
    const today = new Date().toDateString();
    const salesToday = salesData.filter(row => new Date(row.date).toDateString() === today)
                                .reduce((sum, row) => sum + (parseFloat(row.total) || 0), 0);
    
    // Low Stock Items
    const lowStockCount = products.filter(row => (parseInt(row.qty) || 0) < 5).length;
    
    // Recent Sales (Last 5)
    const recentSales = salesData.slice(-5).reverse();
    
    // Revenue over time (Last 7 days)
    const revenueByDay = {};
    const last7Days = [];
    for(let i=6; i>=0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      revenueByDay[dateStr] = 0;
      last7Days.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
    }
    
    salesData.forEach(row => {
      const dateStr = new Date(row.date).toDateString();
      if (revenueByDay.hasOwnProperty(dateStr)) {
        revenueByDay[dateStr] += (parseFloat(row.total) || 0);
      }
    });
    
    const revenueData = Object.values(revenueByDay);

    return {
      totalSales: totalSales,
      salesToday: salesToday,
      customerCount: customers.length,
      lowStock: lowStockCount,
      recentSales: recentSales,
      revenueChart: {
        labels: last7Days,
        data: revenueData
      }
    };
  }
  return [];
}

function sheetToJSON(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const result = [];
  
  for(let i = 1; i < data.length; i++) {
    let obj = {};
    for(let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    result.push(obj);
  }
  return result;
}

function processPOSCheckout(cartData, paymentData) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const salesSheet = ss.getSheetByName('Sales');
    const itemsSheet = ss.getSheetByName('Sale_Items');
    const prodSheet = ss.getSheetByName('Products');
    
    const saleId = 'INV-' + new Date().getTime();
    
    // 1. Record Sale
    salesSheet.appendRow([saleId, paymentData.customerId, paymentData.customerName, cartData.total, new Date(), paymentData.type, paymentData.method]);
    
    // Backup to external Google Form (Online integration)
    try {
      const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSd-TA73amOnEqSnH62t4qMqYlMoUsPnlSPMntDD_4IQmrUd_g/formResponse';
      const dataStr = `ID: ${saleId} | Cust: ${paymentData.customerName} | Total: ₹${cartData.total} | Method: ${paymentData.method}`;
      const finalUrl = `${formUrl}?entry.1488577737=${encodeURIComponent(dataStr)}&submit=Submit`;
      
      UrlFetchApp.fetch(finalUrl, {
        method: 'get',
        muteHttpExceptions: true
      });
    } catch (e) {
      console.error('Backup log failed', e);
    }
    
    // 2. Record Items and Update Stock
    const prodData = prodSheet.getDataRange().getValues();
    const idIdx = prodData[0].indexOf('id');
    const qtyIdx = prodData[0].indexOf('qty');
    const statusIdx = prodData[0].indexOf('status');
    
    let invoiceBody = `<h2>Invoice: ${saleId}</h2><p>Thank you for shopping at Bloomeor Mart!</p><table border="1" cellpadding="5"><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr>`;
    
    cartData.items.forEach(item => {
      itemsSheet.appendRow([saleId, item.id, item.name, item.qty, item.rate]);
      invoiceBody += `<tr><td>${item.name}</td><td>${item.qty}</td><td>₹${item.rate}</td><td>₹${item.qty * item.rate}</td></tr>`;
      
      for(let i=1; i<prodData.length; i++) {
        if(prodData[i][idIdx] === item.id) {
          let currentQty = prodData[i][qtyIdx];
          let newQty = currentQty - item.qty;
          prodSheet.getRange(i+1, qtyIdx+1).setValue(newQty);
          if (newQty <= 0) prodSheet.getRange(i+1, statusIdx+1).setValue('Out of Stock');
        }
      }
    });
    
    invoiceBody += `</table><h3>Grand Total: ₹${cartData.total}</h3>`;
    
    // 3. Email Receipt (If email provided)
    if (paymentData.customerEmail && paymentData.customerEmail.includes('@')) {
      MailApp.sendEmail({
        to: paymentData.customerEmail,
        subject: `Your Receipt from Bloomeor Mart - ${saleId}`,
        htmlBody: invoiceBody
      });
    }
    
    // 4. Generate WhatsApp Link
    let waMessage = `*Invoice: ${saleId}*%0A_Thank you for shopping with us!_%0A%0A`;
    cartData.items.forEach(item => {
      waMessage += `${item.name} x ${item.qty} = ₹${item.qty * item.rate}%0A`;
    });
    waMessage += `%0A*Total: ₹${cartData.total}*`;
    
    let waLink = '';
    if(paymentData.customerPhone) {
      waLink = `https://wa.me/91${paymentData.customerPhone}?text=${waMessage}`;
    }
    
    return { success: true, invoiceId: saleId, waLink: waLink };
    
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * =======================
 * DATA WRITING ENDPOINTS
 * =======================
 */

function saveProduct(productData) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Products');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIdx = headers.indexOf('id');
    
    // Check if updating existing product
    if (productData.id) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][idIdx] === productData.id) {
          // Update columns based on headers
          headers.forEach((h, j) => {
            if (productData.hasOwnProperty(h)) {
              sheet.getRange(i + 1, j + 1).setValue(productData[h]);
            }
          });
          return { success: true, message: 'Product updated successfully!' };
        }
      }
    }
    
    // Create new product
    const newId = 'P' + new Date().getTime();
    sheet.appendRow([
      newId, 
      productData.name, 
      productData.category || 'General', 
      productData.buy_rate || 0, 
      productData.sell_rate || 0, 
      productData.qty || 0, 
      'Available',
      productData.expiry_date || '',
      new Date()
    ]);
    return { success: true, message: 'Product added successfully!' };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteProduct(productId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Products');
    const data = sheet.getDataRange().getValues();
    const idIdx = data[0].indexOf('id');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === productId) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Product deleted successfully!' };
      }
    }
    return { success: false, message: 'Product not found.' };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function saveCustomer(customerData) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Customers');
    if (!sheet) {
      sheet = ss.insertSheet('Customers');
      sheet.appendRow(['id', 'name', 'phone', 'address', 'email', 'gstin', 'category', 'createdAt']);
    }
    
    const data = sheet.getDataRange().getValues();
    const idIdx = data[0].indexOf('id');
    
    const rowData = [
      customerData.id || 'CST-' + Date.now().toString().slice(-6),
      customerData.name,
      customerData.phone || '',
      customerData.address || '',
      customerData.email || '',
      customerData.gstin || '',
      customerData.category || 'General',
      customerData.createdAt || new Date().toISOString()
    ];

    if (customerData.id) {
      // Update existing
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx]) === String(customerData.id)) {
          sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
          return { success: true, message: 'Customer updated successfully!' };
        }
      }
    }
    
    // Add new
    sheet.appendRow(rowData);
    return { success: true, message: 'Customer added successfully!' };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Delete a customer record
 */
function deleteCustomer(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Customers');
    if (!sheet) return { success: false, message: 'Customers sheet not found.' };
    const data = sheet.getDataRange().getValues();
    const idIdx = data[0].indexOf('id');
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(id)) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Customer deleted successfully!' };
      }
    }
    return { success: false, message: 'Customer not found.' };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}


function deleteProduct(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Products');
    const data = sheet.getDataRange().getValues();
    const idIdx = data[0].indexOf('id');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === id) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Product deleted successfully!' };
      }
    }
    return { success: false, message: 'Product not found.' };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Save a purchase order and auto-increment product stock
 */
function savePurchase(purchase) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Ensure Purchases sheet exists with headers
    let purchaseSheet = ss.getSheetByName('Purchases');
    if (!purchaseSheet) {
      purchaseSheet = ss.insertSheet('Purchases');
      purchaseSheet.appendRow(['id','productId','productName','supplier','qty','cost','total','status','date','invoice','notes','createdAt']);
    }

    const poId = 'PO-' + new Date().getTime().toString().slice(-8);
    purchaseSheet.appendRow([
      poId,
      purchase.productId,
      purchase.productName,
      purchase.supplier,
      purchase.qty,
      purchase.cost,
      purchase.total,
      purchase.status,
      purchase.date,
      purchase.invoice || '',
      purchase.notes   || '',
      new Date().toISOString()
    ]);

    // Auto-update product stock quantity
    const prodSheet = ss.getSheetByName('Products');
    if (prodSheet) {
      const prodData = prodSheet.getDataRange().getValues();
      const idIdx  = prodData[0].indexOf('id');
      const qtyIdx = prodData[0].indexOf('qty');
      for (let i = 1; i < prodData.length; i++) {
        if (String(prodData[i][idIdx]) === String(purchase.productId)) {
          const currentQty = parseInt(prodData[i][qtyIdx]) || 0;
          prodSheet.getRange(i + 1, qtyIdx + 1).setValue(currentQty + purchase.qty);
          break;
        }
      }
    }

    return { success: true, message: `Purchase ${poId} saved. Stock updated by +${purchase.qty} units.` };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Delete a purchase record (does NOT reverse stock)
 */
function deletePurchase(purchaseId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Purchases');
    if (!sheet) return { success: false, message: 'Purchases sheet not found.' };
    const data  = sheet.getDataRange().getValues();
    const idIdx = data[0].indexOf('id');
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] === purchaseId) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Purchase deleted.' };
      }
    }
    return { success: false, message: 'Purchase not found.' };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Save or update a supplier
 */
function saveSupplier(supplier) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Suppliers');
    if (!sheet) {
      sheet = ss.insertSheet('Suppliers');
      sheet.appendRow(['id', 'name', 'phone', 'email', 'address', 'gstin', 'category', 'is_active', 'createdAt']);
    }
    
    const data = sheet.getDataRange().getValues();
    const idIdx = data[0].indexOf('id');
    
    const rowData = [
      supplier.id || 'SUP-' + Date.now().toString().slice(-6),
      supplier.name,
      supplier.phone || '',
      supplier.email || '',
      supplier.address || '',
      supplier.gstin || '',
      supplier.category || 'General',
      supplier.is_active !== undefined ? supplier.is_active : true,
      supplier.createdAt || new Date().toISOString()
    ];

    if (supplier.id) {
      // Update existing
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx]) === String(supplier.id)) {
          sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
          return { success: true, message: 'Supplier updated successfully!' };
        }
      }
    }
    
    // Add new
    sheet.appendRow(rowData);
    return { success: true, message: 'Supplier added successfully!' };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Delete a supplier
 */
function deleteSupplier(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Suppliers');
    if (!sheet) return { success: false, message: 'Suppliers sheet not found.' };
    const data = sheet.getDataRange().getValues();
    const idIdx = data[0].indexOf('id');
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(id)) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Supplier deleted successfully!' };
      }
    }
    return { success: false, message: 'Supplier not found.' };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Save a payment transaction
 */
function savePayment(payment) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Payments');
    if (!sheet) {
      sheet = ss.insertSheet('Payments');
      sheet.appendRow(['id', 'type', 'entity', 'amount', 'method', 'date', 'reference', 'notes', 'createdAt']);
    }
    
    const rowData = [
      payment.id || 'TXN-' + Date.now().toString().slice(-8),
      payment.type,      // Inbound / Outbound
      payment.entity,    // Customer Name / Supplier Name
      payment.amount,
      payment.method,
      payment.date || new Date().toISOString().split('T')[0],
      payment.reference || '',
      payment.notes || '',
      new Date().toISOString()
    ];
    
    sheet.appendRow(rowData);
    return { success: true, message: 'Payment recorded successfully!' };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Delete a payment record
 */
function deletePayment(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Payments');
    if (!sheet) return { success: false, message: 'Payments sheet not found.' };
    const data = sheet.getDataRange().getValues();
    const idIdx = data[0].indexOf('id');
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(id)) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Payment record deleted.' };
      }
    }
    return { success: false, message: 'Payment record not found.' };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Update payment status for Sale or Purchase
 */
function updatePaymentStatus(id, type, newStatus) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = (type === 'sale') ? 'Sales' : 'Purchases';
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, message: sheetName + ' sheet not found.' };
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIdx = headers.indexOf('id');
    const statusColName = (type === 'sale') ? 'paymentStatus' : 'status';
    const statusIdx = headers.indexOf(statusColName);
    
    if (idIdx === -1 || statusIdx === -1) return { success: false, message: 'Column not found.' };
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(id)) {
        sheet.getRange(i + 1, statusIdx + 1).setValue(newStatus);
        return { success: true, message: 'Status updated to ' + newStatus };
      }
    }
    return { success: false, message: 'Record not found.' };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}


/**
 * Save or update an expense
 */
function saveExpense(expense) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Expenses');
    if (!sheet) {
      sheet = ss.insertSheet('Expenses');
      sheet.appendRow(['id', 'category', 'amount', 'date', 'payMethod', 'description', 'reference', 'createdAt']);
    }
    
    const data = sheet.getDataRange().getValues();
    const idIdx = data[0].indexOf('id');
    
    const rowData = [
      expense.id || 'EXP-' + Date.now().toString().slice(-6),
      expense.category || 'General',
      expense.amount,
      expense.date || new Date().toISOString().split('T')[0],
      expense.payMethod || 'Cash',
      expense.description || '',
      expense.reference || '',
      expense.createdAt || new Date().toISOString()
    ];

    if (expense.id) {
      // Update existing
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idIdx]) === String(expense.id)) {
          sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
          return { success: true, message: 'Expense updated successfully!' };
        }
      }
    }
    
    // Add new
    sheet.appendRow(rowData);
    return { success: true, message: 'Expense recorded successfully!' };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Delete an expense record
 */
function deleteExpense(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Expenses');
    if (!sheet) return { success: false, message: 'Expenses sheet not found.' };
    const data = sheet.getDataRange().getValues();
    const idIdx = data[0].indexOf('id');
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(id)) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Expense deleted.' };
      }
    }
    return { success: false, message: 'Expense not found.' };
  } catch(e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}




