// RBAC & Authorization Layer
const ROLES = {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    CASHIER: 'Cashier',
    AUDITOR: 'Auditor'
};

const PERMISSIONS = {
    [ROLES.ADMIN]: ['*'], // Full access
    [ROLES.MANAGER]: [
        'view_dashboard', 'view_pos', 'view_sales', 'view_customers', 'view_inventory',
        'view_purchases', 'view_suppliers', 'view_payments', 'view_expenses', 'view_reports',
        'apply_discount', 'process_refund', 'edit_inventory'
    ],
    [ROLES.CASHIER]: [
        'view_dashboard', 'view_pos', 'view_sales', 'view_customers'
        // Cashiers cannot apply arbitrary discounts, refund, or view sensitive reports
    ],
    [ROLES.AUDITOR]: [
        'view_dashboard', 'view_sales', 'view_inventory', 'view_purchases',
        'view_suppliers', 'view_payments', 'view_expenses', 'view_reports'
        // Auditors are read-only
    ]
};

class Auth {
    static getCurrentRole() {
        return localStorage.getItem('bloomeor_role') || ROLES.ADMIN;
    }

    static setRole(role) {
        if (!Object.values(ROLES).includes(role)) return;
        
        const PASSWORDS = {
            [ROLES.ADMIN]: 'admin123',
            [ROLES.MANAGER]: 'manager123',
            [ROLES.AUDITOR]: 'audit123'
        };

        if (PASSWORDS[role]) {
            const existing = document.getElementById('roleSelectorModal');
            if(existing) existing.remove();

            const html = `
                <div class="modal-overlay" id="passwordModal" style="display:flex; z-index:99999;">
                    <div class="modal-card" style="max-width:320px; text-align:center;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:15px;">
                            <h3 style="margin:0;"><i class="ph-bold ph-lock-key" style="color:var(--primary);"></i> Authenticate</h3>
                            <i class="ph-bold ph-x" style="cursor:pointer;" onclick="document.getElementById('passwordModal').remove()"></i>
                        </div>
                        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">Enter the password for <strong>${role}</strong>.</p>
                        <input type="password" id="rolePasswordInput" placeholder="Password" style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--border); background:var(--input-bg); color:var(--text-primary); margin-bottom:15px; font-weight:600; text-align:center;">
                        <button class="btn-gold" style="width:100%; padding:12px;" onclick="Auth.verifyPassword('${role}', '${PASSWORDS[role]}')">Login</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
            setTimeout(() => document.getElementById('rolePasswordInput').focus(), 100);
        } else {
            this.executeRoleSwitch(role);
        }
    }

    static verifyPassword(role, correctPassword) {
        const input = document.getElementById('rolePasswordInput').value;
        if (input === correctPassword) {
            document.getElementById('passwordModal').remove();
            this.executeRoleSwitch(role);
        } else {
            this.showAlert('Authentication Failed', 'Incorrect password.');
            document.getElementById('rolePasswordInput').value = '';
            document.getElementById('rolePasswordInput').focus();
        }
    }

    static executeRoleSwitch(role) {
        localStorage.setItem('bloomeor_role', role);
        this.logAction('ROLE_SWITCH', `User switched to ${role}`);
        location.reload();
    }

    static hasPermission(action) {
        const role = this.getCurrentRole();
        if (PERMISSIONS[role].includes('*')) return true;
        return PERMISSIONS[role].includes(action);
    }

    static enforceUI() {
        const role = this.getCurrentRole();
        
        // Hide elements that require specific permissions
        document.querySelectorAll('[data-permission]').forEach(el => {
            const requiredPerm = el.getAttribute('data-permission');
            if (!this.hasPermission(requiredPerm)) {
                el.style.display = 'none';
            }
        });

        // Update Topbar UI
        const userNameHeader = document.getElementById('userNameHeader');
        if (userNameHeader) {
            userNameHeader.innerHTML = `
                <div style="cursor:pointer; display:flex; align-items:center; gap:6px; background:var(--input-bg); padding:6px 12px; border-radius:20px; border:1px solid var(--border);" onclick="Auth.showRoleSelector()">
                    <i class="ph-bold ph-user-circle"></i>
                    <span>${role}</span>
                    <i class="ph-bold ph-caret-down" style="font-size:0.7rem;"></i>
                </div>
            `;
        }

        // Specific page enforcements based on URL
        const path = window.location.pathname;
        if (path.includes('pos.html') && role === ROLES.AUDITOR) {
            this.showAlert('Access Denied', 'Auditors cannot access the POS terminal.');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
        }
        if (path.includes('reports.html') && role === ROLES.CASHIER) {
            this.showAlert('Access Denied', 'Cashiers cannot access Financial Reports.');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
        }
        if (path.includes('settings.html') && role !== ROLES.ADMIN) {
            this.showAlert('Access Denied', 'Only Admins can access Settings.');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
        }
    }

    static logAction(action, details) {
        const logs = JSON.parse(localStorage.getItem('bloomeor_audit_logs') || '[]');
        logs.unshift({
            timestamp: new Date().toISOString(),
            role: this.getCurrentRole(),
            action: action,
            details: details
        });
        // Keep last 500 logs
        localStorage.setItem('bloomeor_audit_logs', JSON.stringify(logs.slice(0, 500)));
    }

    static showAlert(title, msg) {
        const al = document.getElementById('customAlert');
        if (al) {
            document.getElementById('alertTitle').innerText = title;
            document.getElementById('alertMsg').innerText = msg;
            al.classList.add('show');
            setTimeout(() => al.classList.remove('show'), 3500);
        } else {
            alert(`${title}: ${msg}`);
        }
    }

    static showRoleSelector() {
        const existing = document.getElementById('roleSelectorModal');
        if(existing) existing.remove();

        const currentRole = this.getCurrentRole();
        const html = `
            <div class="modal-overlay" id="roleSelectorModal" style="display:flex; z-index:99999;">
                <div class="modal-card" style="max-width:350px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:15px;">
                        <h3 style="margin:0;">Switch Role</h3>
                        <i class="ph-bold ph-x" style="cursor:pointer;" onclick="document.getElementById('roleSelectorModal').remove()"></i>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        ${Object.values(ROLES).map(r => `
                            <button onclick="Auth.setRole('${r}')" style="padding:12px; border-radius:8px; border:1px solid ${currentRole === r ? 'var(--primary)' : 'var(--border)'}; background:${currentRole === r ? 'rgba(212,175,55,0.1)' : 'var(--input-bg)'}; color:var(--text-primary); text-align:left; cursor:pointer; font-weight:600; display:flex; justify-content:space-between;">
                                <span>${r}</span>
                                ${currentRole === r ? '<i class="ph-bold ph-check-circle" style="color:var(--primary);"></i>' : ''}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    }
}

// Auto-enforce on load
document.addEventListener('DOMContentLoaded', () => {
    Auth.enforceUI();
});

// Expose globally
window.Auth = Auth;
window.ROLES = ROLES;
