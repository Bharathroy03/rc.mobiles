// ==========================================================================
// RC MOBILES - AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)
// ==========================================================================

const RC_AUTH = {
    STORAGE_KEY: "rc_mobiles_auth_user",

    getUser() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY) || sessionStorage.getItem(this.STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    },

    setUser(user, remember = true) {
        const str = JSON.stringify(user);
        if (remember) {
            localStorage.setItem(this.STORAGE_KEY, str);
        } else {
            sessionStorage.setItem(this.STORAGE_KEY, str);
        }
    },

    clearUser() {
        localStorage.removeItem(this.STORAGE_KEY);
        sessionStorage.removeItem(this.STORAGE_KEY);
    },

    isAuthenticated() {
        const u = this.getUser();
        return u && u.token && u.username;
    },

    getRole() {
        const u = this.getUser();
        return u ? (u.role || "staff").toLowerCase() : "guest";
    },

    isAdmin() {
        return this.getRole() === "admin";
    },

    isManager() {
        return this.getRole() === "manager";
    },

    isStaff() {
        return this.getRole() === "staff";
    },

    hasAccess(allowedRoles = []) {
        if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true;
        const current = this.getRole();
        if (current === "admin") return true; // Admin has access to everything
        return allowedRoles.includes(current);
    },

    checkAuthGuard() {
        const isLoginPage = window.location.pathname.endsWith("login.html") || window.location.pathname.endsWith("login");
        if (!this.isAuthenticated()) {
            if (!isLoginPage) {
                window.location.href = "login.html";
            }
        } else {
            if (isLoginPage) {
                window.location.href = "index.html";
            }
        }
    },

    logout() {
        fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        this.clearUser();
        window.location.href = "login.html";
    },

    initPageAuth() {
        this.checkAuthGuard();
        if (this.isAuthenticated()) {
            document.addEventListener("DOMContentLoaded", () => {
                this.renderUserControls();
                this.applyRoleRestrictions();
            });
        }
    },

    renderUserControls() {
        const user = this.getUser();
        if (!user) return;

        // Role styling badge
        let roleName = "Sales Executive";
        let roleBg = "bg-slate-100 text-slate-700 border-slate-300";
        if (user.role === "admin") {
            roleName = "Admin / Owner";
            roleBg = "bg-purple-100 text-purple-800 border-purple-300 font-extrabold";
        } else if (user.role === "manager") {
            roleName = "Store Manager";
            roleBg = "bg-blue-100 text-blue-800 border-blue-300 font-extrabold";
        }

        // Find or create Top App Bar User Badge
        const headers = document.querySelectorAll("header");
        headers.forEach(header => {
            let userBox = header.querySelector(".app-user-badge-container");
            if (!userBox) {
                const rightGroup = header.lastElementChild;
                if (rightGroup) {
                    const badgeWrap = document.createElement("div");
                    badgeWrap.className = "app-user-badge-container flex items-center gap-1.5 sm:gap-3 pl-2 sm:pl-3 border-l border-slate-200 shrink-0";
                    badgeWrap.innerHTML = `
                        <div class="flex items-center gap-2 text-right hidden sm:flex">
                            <div>
                                <span class="block text-xs font-black text-slate-900 leading-none">${escapeHtml(user.full_name || user.username)}</span>
                                <span class="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider border ${roleBg}">${roleName}</span>
                            </div>
                            <div class="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center font-black text-xs shadow-sm">
                                ${(user.username || 'U').charAt(0).toUpperCase()}
                            </div>
                        </div>
                        <button onclick="RC_AUTH.logout()" class="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0" title="Logout (${escapeHtml(user.username)})">
                            <span class="material-symbols-outlined text-lg sm:text-xl">logout</span>
                        </button>
                    `;
                    rightGroup.appendChild(badgeWrap);
                }
            }
        });

        // Add User Management link to sidebar if Admin
        if (this.isAdmin()) {
            const sideNav = document.querySelector("nav .flex-1");
            if (sideNav && !document.getElementById("navUsersBtn")) {
                const usersLink = document.createElement("button");
                usersLink.id = "navUsersBtn";
                usersLink.onclick = () => {
                    if (typeof openModal === "function") {
                        openModal("usersModal");
                    } else if (typeof openUserManagementModal === "function") {
                        openUserManagementModal();
                    }
                };
                usersLink.className = "flex items-center text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 rounded-lg mx-2 px-4 py-3 transition-colors text-left w-full";
                usersLink.innerHTML = `
                    <span class="material-symbols-outlined mr-3 text-gray-500">manage_accounts</span>
                    <span class="text-sm font-semibold">Staff &amp; Users</span>
                `;
                sideNav.appendChild(usersLink);
            }
        }
    },

    applyRoleRestrictions() {
        const role = this.getRole();

        // 1. Staff restrictions
        if (role === "staff") {
            // Hide Store Settings
            document.querySelectorAll("[onclick*='settingsModal'], a[href*='settings']").forEach(el => el.classList.add("hidden"));
            // Hide Delete Invoice buttons
            document.querySelectorAll("[onclick*='deleteInvoice'], [onclick*='deleteInvoiceRecord']").forEach(el => el.classList.add("hidden"));
            // Hide Delete Product buttons
            document.querySelectorAll("[onclick*='deleteProductPrompt']").forEach(el => el.classList.add("hidden"));
            // Hide Add User
            document.querySelectorAll("#navUsersBtn, [onclick*='usersModal']").forEach(el => el.classList.add("hidden"));
        }

        // 2. Manager restrictions
        if (role === "manager") {
            // Hide Store Settings
            document.querySelectorAll("[onclick*='settingsModal']").forEach(el => el.classList.add("hidden"));
            // Hide User Management
            document.querySelectorAll("#navUsersBtn, [onclick*='usersModal']").forEach(el => el.classList.add("hidden"));
        }
    }
};

// Automatically run auth check
RC_AUTH.initPageAuth();

// Global Responsive & Mobile Drawer Helpers
window.toggleMobileDrawer = function() {
    const nav = document.getElementById("sideNav");
    const backdrop = document.getElementById("mobileNavBackdrop");
    const mobFab = document.getElementById("mobileFloatingActions");
    if (!nav) return;
    const isClosed = nav.classList.contains("-translate-x-full");
    if (isClosed) {
        nav.classList.remove("-translate-x-full");
        nav.classList.add("translate-x-0");
        if (backdrop) backdrop.classList.remove("hidden");
        if (mobFab) {
            mobFab.classList.add("opacity-0", "pointer-events-none", "scale-95");
        }
    } else {
        nav.classList.remove("translate-x-0");
        nav.classList.add("-translate-x-full");
        if (backdrop) backdrop.classList.add("hidden");
        if (mobFab) {
            mobFab.classList.remove("opacity-0", "pointer-events-none", "scale-95");
        }
    }
};

window.switchMobileWorkspace = function(view) {
    const formSec = document.getElementById("posFormSection");
    const prevSec = document.getElementById("invoicePreviewSection");
    const mobFab = document.getElementById("mobileFloatingActions");
    const formBtn = document.getElementById("mobTabFormBtn");
    const prevBtn = document.getElementById("mobTabPreviewBtn");

    if (!formSec || !prevSec) return;

    if (view === "form") {
        formSec.classList.remove("hidden");
        formSec.classList.add("flex");
        if (mobFab && window.innerWidth < 768) {
            mobFab.classList.remove("hidden");
            mobFab.classList.add("flex");
        }
        if (window.innerWidth < 768) {
            prevSec.classList.add("hidden");
            prevSec.classList.remove("flex");
        } else {
            prevSec.classList.remove("hidden");
            prevSec.classList.add("flex");
        }

        if (formBtn) {
            formBtn.className = "flex-1 py-2 rounded-lg text-xs font-black transition-all bg-white text-slate-900 shadow-sm flex items-center justify-center gap-1.5";
        }
        if (prevBtn) {
            prevBtn.className = "flex-1 py-2 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5";
        }
    } else {
        if (window.innerWidth < 768) {
            formSec.classList.add("hidden");
            formSec.classList.remove("flex");
            if (mobFab) {
                mobFab.classList.add("hidden");
                mobFab.classList.remove("flex");
            }
        } else {
            formSec.classList.remove("hidden");
            formSec.classList.add("flex");
        }
        prevSec.classList.remove("hidden");
        prevSec.classList.add("flex");

        if (prevBtn) {
            prevBtn.className = "flex-1 py-2 rounded-lg text-xs font-black transition-all bg-white text-slate-900 shadow-sm flex items-center justify-center gap-1.5";
        }
        if (formBtn) {
            formBtn.className = "flex-1 py-2 rounded-lg text-xs font-bold transition-all text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5";
        }
    }
};

window.addEventListener("resize", () => {
    const formSec = document.getElementById("posFormSection");
    const prevSec = document.getElementById("invoicePreviewSection");
    if (!formSec || !prevSec) return;
    if (window.innerWidth >= 768) {
        formSec.classList.remove("hidden");
        formSec.classList.add("flex");
        prevSec.classList.remove("hidden");
        prevSec.classList.add("flex");
    }
});

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
