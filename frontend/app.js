// ==========================================================================
// RC MOBILES - GST BILLING ERP FRONTEND ENGINE
// ==========================================================================

const API_BASE = "";

// Global State
let itemsList = [
    { id: 1, desc: "", price: 0.0, hsn: "8517", imei: "" }
];
let catalogProducts = [];
let storeSettings = {};
let currentInvoiceNo = "";
let currentScale = 0.85;
let currentPaymentCategory = "non-finance"; // "non-finance" or "finance"
let activePosTab = "items"; // "items" or "payment"
let editingInvoiceId = null;

// ============================================================
//  FORM VALIDATION STATE
// ============================================================
let customerVerified = false; // Must be true before generating invoice

// Toggle customer verified state (the green tick button)
function toggleCustomerVerification() {
    const nameVal  = (document.getElementById("input-customer-name")?.value || "").trim();
    const mobVal   = (document.getElementById("input-customer-mobile")?.value || "").trim();
    const addrVal  = (document.getElementById("input-customer-address")?.value || "").trim();

    // Must fill fields first before verifying
    if (!nameVal || !mobVal || !addrVal) {
        shakeFieldsOnError(["input-customer-name","input-customer-mobile","input-customer-address"]);
        showToast("Please fill Customer Name, Mobile & Address before verifying.", "error");
        return;
    }

    customerVerified = !customerVerified;
    const btn   = document.getElementById("btnCustomerVerify");
    const icon  = document.getElementById("verifyIcon");
    const label = document.getElementById("verifyLabel");
    const card  = document.getElementById("customerDetailsCard");

    if (customerVerified) {
        btn.className   = "w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-emerald-500 text-emerald-700 bg-emerald-50 text-xs font-bold transition-all";
        icon.textContent  = "verified";
        label.textContent = "✓ Customer Verified";
        if (card) card.style.boxShadow = "0 0 0 2px #10b981";
        document.getElementById("err-customer-verify")?.classList.add("hidden");
    } else {
        btn.className   = "w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 text-xs font-bold transition-all hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50";
        icon.textContent  = "check_circle";
        label.textContent = "Click to Verify Customer ✓";
        if (card) card.style.boxShadow = "";
    }
}

// Reset verification when any customer field changes
function clearFieldError(input) {
    input.classList.remove("field-invalid");
    const errId = "err-" + input.id.replace("input-", "");
    document.getElementById(errId)?.classList.add("hidden");
    // If customer fields are changed after verification, reset verification
    if (["input-customer-name","input-customer-mobile","input-customer-address"].includes(input.id)) {
        if (customerVerified) {
            customerVerified = false;
            const btn   = document.getElementById("btnCustomerVerify");
            const icon  = document.getElementById("verifyIcon");
            const label = document.getElementById("verifyLabel");
            const card  = document.getElementById("customerDetailsCard");
            if (btn) btn.className = "w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 text-xs font-bold transition-all hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50";
            if (icon) icon.textContent = "check_circle";
            if (label) label.textContent = "Click to Verify Customer ✓";
            if (card) card.style.boxShadow = "";
        }
    }
}

// Shake fields with errors
function shakeFieldsOnError(fieldIds) {
    fieldIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add("field-invalid", "field-shake");
        setTimeout(() => el.classList.remove("field-shake"), 400);
    });
}

function showFieldError(inputId, errId, show = true) {
    const inp = document.getElementById(inputId);
    const err = document.getElementById(errId);
    if (inp) { show ? inp.classList.add("field-invalid") : inp.classList.remove("field-invalid"); }
    if (err) { show ? err.classList.remove("hidden") : err.classList.add("hidden"); }
}

// ============================================================
//  MASTER VALIDATION — runs before every save/generate
// ============================================================
function validateInvoiceForm(isGenerate = true) {
    let valid = true;
    const errors = [];

    // ── 1. Customer Name ──
    const custName = (document.getElementById("input-customer-name")?.value || "").trim();
    if (!custName) {
        showFieldError("input-customer-name", "err-customer-name", true);
        errors.push("input-customer-name");
        valid = false;
    } else { showFieldError("input-customer-name", "err-customer-name", false); }

    // ── 2. Mobile Number ──
    const custMob = (document.getElementById("input-customer-mobile")?.value || "").trim();
    if (!custMob || custMob.length < 10) {
        showFieldError("input-customer-mobile", "err-customer-mobile", true);
        errors.push("input-customer-mobile");
        valid = false;
    } else { showFieldError("input-customer-mobile", "err-customer-mobile", false); }

    // ── 3. Address ──
    const custAddr = (document.getElementById("input-customer-address")?.value || "").trim();
    if (!custAddr) {
        showFieldError("input-customer-address", "err-customer-address", true);
        errors.push("input-customer-address");
        valid = false;
    } else { showFieldError("input-customer-address", "err-customer-address", false); }

    // ── 4. Customer Verification Tick (only for Generate, not draft) ──
    if (isGenerate && !customerVerified) {
        document.getElementById("err-customer-verify")?.classList.remove("hidden");
        const btn = document.getElementById("btnCustomerVerify");
        if (btn) { btn.classList.add("field-shake"); setTimeout(() => btn.classList.remove("field-shake"), 400); }
        valid = false;
    } else {
        document.getElementById("err-customer-verify")?.classList.add("hidden");
    }

    // ── 5. Items: at least one with model name + price ──
    const validItems = itemsList.filter(it => (it.desc || "").trim().length > 0 && (it.price || 0) > 0);
    if (validItems.length === 0) {
        valid = false;
        errors.push("items");
        // Switch to items tab to show the problem
        if (activePosTab !== "items") switchPosTab("items");
        showToast("⚠️ Add at least one Item / Model with a name and price.", "error", 4000);
    }

    // ── 6. Finance fields (if Finance mode is selected) ──
    if (currentPaymentCategory === "finance") {
        const approvalNo = (document.getElementById("pay-finance-approval")?.value || "").trim();
        const dpAmt      = parseFloat(document.getElementById("pay-finance-dp")?.value) || 0;
        const scheme     = (document.getElementById("pay-finance-scheme")?.value || "").trim();

        if (!approvalNo) {
            shakeFieldsOnError(["pay-finance-approval"]);
            const el = document.getElementById("pay-finance-approval");
            if (el) el.classList.add("field-invalid");
            errors.push("pay-finance-approval");
            valid = false;
        }
        if (dpAmt <= 0) {
            shakeFieldsOnError(["pay-finance-dp"]);
            const el = document.getElementById("pay-finance-dp");
            if (el) el.classList.add("field-invalid");
            errors.push("pay-finance-dp");
            valid = false;
        }
        if (!scheme) {
            shakeFieldsOnError(["pay-finance-scheme"]);
            const el = document.getElementById("pay-finance-scheme");
            if (el) el.classList.add("field-invalid");
            errors.push("pay-finance-scheme");
            valid = false;
        }
        if (errors.some(e => ["pay-finance-approval","pay-finance-dp","pay-finance-scheme"].includes(e))) {
            if (activePosTab !== "payment") switchPosTab("payment");
            showToast("⚠️ All Finance fields (Approval No, Downpayment, Scheme) are mandatory.", "error", 4500);
        }
    } else {
        // ── 7. Cash Tally for direct payment (Generate only) ──
        if (isGenerate) {
            const cashAmt = parseFloat(document.getElementById("pay-cash-amount")?.value) || 0;
            const cardAmt = parseFloat(document.getElementById("pay-card-amount")?.value) || 0;
            const upiAmt  = parseFloat(document.getElementById("pay-upi-amount")?.value) || 0;
            const received = cashAmt + cardAmt + upiAmt;

            // Get grand total from the summary span
            const totalEl = document.getElementById("summary-total");
            let grandTotal = 0;
            if (totalEl) {
                const rawText = totalEl.textContent.replace(/[₹,\s]/g, "");
                grandTotal = parseFloat(rawText) || 0;
            }

            if (grandTotal > 0 && received <= 0) {
                if (activePosTab !== "payment") switchPosTab("payment");
                shakeFieldsOnError(["pay-cash-amount","pay-card-amount","pay-upi-amount"]);
                showToast(`⚠️ Cash Tally Required: Enter payment received (₹${grandTotal.toFixed(2)}) before generating.`, "error", 5000);
                valid = false;
            } else if (grandTotal > 0 && received < grandTotal) {
                // Allow but warn (partial payment)
                showToast(`ℹ️ Partial payment: ₹${received.toFixed(2)} received vs ₹${grandTotal.toFixed(2)} total.`, "info", 4000);
            }
        }
    }

    // If errors — scroll to first invalid field
    if (errors.length > 0) {
        shakeFieldsOnError(errors);
        const firstEl = document.getElementById(errors[0]);
        if (firstEl) firstEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return valid;
}

// ============================================================
//  SUCCESS MODAL CONTROLS
// ============================================================
let _successModalTimer = null;

function showInvoiceSuccessModal(invNo, custName, grandTotal) {
    const modal = document.getElementById("invoiceSuccessModal");
    if (!modal) return;
    document.getElementById("successInvNo").textContent    = invNo    || "—";
    document.getElementById("successCustName").textContent  = custName || "—";
    document.getElementById("successGrandTotal").textContent = "₹" + (parseFloat(grandTotal) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
    modal.classList.remove("hidden");
    modal.classList.add("flex");

    // Auto-dismiss in 8 seconds with progress bar
    const bar = document.getElementById("successProgressBar");
    if (bar) { bar.style.transition = "none"; bar.style.width = "100%"; }
    clearTimeout(_successModalTimer);
    requestAnimationFrame(() => {
        if (bar) { bar.style.transition = "width 8s linear"; bar.style.width = "0%"; }
        _successModalTimer = setTimeout(closeInvoiceSuccessModal, 8000);
    });
}

function closeInvoiceSuccessModal() {
    clearTimeout(_successModalTimer);
    const modal = document.getElementById("invoiceSuccessModal");
    if (modal) { modal.classList.add("hidden"); modal.classList.remove("flex"); }
}

// ---------------- CUSTOM APPLICATION TOAST SYSTEM ----------------
function showToast(message, type = "info", duration = 3500) {
    const container = document.getElementById("appToastContainer");
    if (!container) return;

    const toastId = "toast-" + Date.now() + Math.random().toString(36).substr(2, 4);
    
    // Type styling
    let icon = "info";
    let bgBorder = "bg-white border-blue-200 text-slate-800";
    let iconColor = "text-blue-600 bg-blue-50";
    let barColor = "bg-blue-600";

    if (type === "success") {
        icon = "check_circle";
        bgBorder = "bg-white border-emerald-200 text-slate-800";
        iconColor = "text-emerald-600 bg-emerald-50";
        barColor = "bg-emerald-500";
    } else if (type === "error") {
        icon = "error";
        bgBorder = "bg-white border-red-200 text-slate-800";
        iconColor = "text-red-600 bg-red-50";
        barColor = "bg-red-500";
    } else if (type === "warning") {
        icon = "warning";
        bgBorder = "bg-white border-amber-200 text-slate-800";
        iconColor = "text-amber-600 bg-amber-50";
        barColor = "bg-amber-500";
    }

    const toastEl = document.createElement("div");
    toastEl.id = toastId;
    toastEl.className = `pointer-events-auto flex flex-col shadow-xl rounded-xl border p-3 relative overflow-hidden transition-all transform duration-300 translate-y-3 opacity-0 ${bgBorder}`;
    toastEl.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}">
                <span class="material-symbols-outlined text-lg">${icon}</span>
            </div>
            <div class="flex-1 text-xs font-semibold leading-snug break-words">
                ${escapeHtml(message)}
            </div>
            <button type="button" class="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors" onclick="dismissToast('${toastId}')">
                <span class="material-symbols-outlined text-base">close</span>
            </button>
        </div>
        <div class="absolute bottom-0 left-0 h-0.5 ${barColor} w-full" id="${toastId}-bar"></div>
    `;

    container.appendChild(toastEl);

    // Trigger enter animation
    requestAnimationFrame(() => {
        toastEl.classList.remove("translate-y-3", "opacity-0");
        toastEl.classList.add("translate-y-0", "opacity-100");
    });

    // Auto dismiss
    const dismissTimer = setTimeout(() => {
        dismissToast(toastId);
    }, duration);

    toastEl._dismissTimer = dismissTimer;
}

window.dismissToast = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el._dismissTimer) clearTimeout(el._dismissTimer);
    el.classList.add("opacity-0", "translate-x-6");
    setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
};

// ---------------- CUSTOM IN-APP DIALOG MODAL ----------------
function showAppDialog({ title = "Notice", message = "", type = "info", confirmText = "OK", cancelText = null, showInput = false, inputPlaceholder = "", defaultValue = "", inputType = "text" } = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById("appDialogModal");
        if (!modal) {
            console.log("Dialog:", { title, message });
            resolve(true);
            return;
        }

        const titleEl = document.getElementById("appDialogTitle");
        const msgEl = document.getElementById("appDialogMessage");
        const iconEl = document.getElementById("appDialogIcon");
        const iconBg = document.getElementById("appDialogIconBg");
        const inputWrap = document.getElementById("appDialogInputWrap");
        const inputEl = document.getElementById("appDialogInput");
        const cancelBtn = document.getElementById("appDialogCancelBtn");
        const confirmBtn = document.getElementById("appDialogConfirmBtn");

        titleEl.textContent = title;
        msgEl.textContent = message;
        confirmBtn.textContent = confirmText || "OK";

        // Icon & Colors
        if (type === "error") {
            iconEl.textContent = "error";
            iconBg.className = "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-red-100 text-red-600";
            confirmBtn.className = "px-5 py-2 text-xs font-extrabold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all shadow-sm";
        } else if (type === "success") {
            iconEl.textContent = "check_circle";
            iconBg.className = "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100 text-emerald-600";
            confirmBtn.className = "px-5 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-sm";
        } else if (type === "warning") {
            iconEl.textContent = "warning";
            iconBg.className = "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-amber-100 text-amber-600";
            confirmBtn.className = "px-5 py-2 text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-all shadow-sm";
        } else {
            iconEl.textContent = "info";
            iconBg.className = "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 text-blue-600";
            confirmBtn.className = "px-5 py-2 text-xs font-extrabold text-white bg-primary-container hover:bg-slate-900 rounded-lg transition-all shadow-sm";
        }

        // Prompt Input
        if (showInput) {
            inputWrap.classList.remove("hidden");
            inputEl.type = inputType || "text";
            inputEl.value = defaultValue || "";
            inputEl.placeholder = inputPlaceholder || "";
            setTimeout(() => inputEl.focus(), 100);
        } else {
            inputWrap.classList.add("hidden");
        }

        // Cancel Button
        if (cancelText) {
            cancelBtn.textContent = cancelText;
            cancelBtn.classList.remove("hidden");
        } else {
            cancelBtn.classList.add("hidden");
        }

        modal.classList.remove("hidden");

        const cleanup = () => {
            modal.classList.add("hidden");
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            document.removeEventListener("keydown", handleKeydown);
        };

        const handleConfirm = () => {
            const val = showInput ? inputEl.value : true;
            cleanup();
            resolve(val);
        };

        const handleCancel = () => {
            cleanup();
            resolve(showInput ? null : false);
        };

        const handleKeydown = (e) => {
            if (e.key === "Enter" && (!e.target || e.target.tagName !== "TEXTAREA")) {
                e.preventDefault();
                handleConfirm();
            } else if (e.key === "Escape") {
                e.preventDefault();
                handleCancel();
            }
        };

        confirmBtn.onclick = handleConfirm;
        cancelBtn.onclick = handleCancel;
        document.addEventListener("keydown", handleKeydown);
    });
}

// Global Exception & Uncaught Error Interceptors
function initAppExceptionHandling() {
    window.alert = function(msg) {
        return showAppDialog({ title: "RC Mobiles Notice", message: String(msg), type: "info" });
    };

    window.confirm = function(msg) {
        return showAppDialog({ title: "Confirm Action", message: String(msg), type: "warning", confirmText: "Confirm", cancelText: "Cancel" });
    };

    window.prompt = function(msg, defaultVal = "") {
        return showAppDialog({ title: "Input Required", message: String(msg), type: "info", showInput: true, defaultValue: defaultVal, confirmText: "Submit", cancelText: "Cancel" });
    };

    window.onerror = function(message, source, lineno, colno, error) {
        console.error("Global UI Exception:", { message, source, lineno, colno, error });
        showToast(`UI Error: ${message}`, "error");
        return false;
    };

    window.onunhandledrejection = function(event) {
        console.error("Unhandled Promise Exception:", event.reason);
        const msg = event.reason?.message || event.reason || "Network or operation failed";
        showToast(`Error: ${msg}`, "error");
    };
}

document.addEventListener("DOMContentLoaded", () => {
    initAppExceptionHandling();
    initDefaultDateTime();
    loadStoreSettings();
    loadCatalogProducts();
    setupInputListeners();
    setupZoomControls();
    renderLineItemRows();
    updateInvoicePreview();
    setupAddProductModal();

    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    const autoPrint = urlParams.get('print');
    if (editId) {
        setTimeout(async () => {
            await loadInvoiceForEditing(parseInt(editId, 10));
            if (autoPrint) {
                setTimeout(() => triggerPrintInvoice(), 400);
            }
        }, 300);
    }
});

// ---------------- INTERACTIVE SECTION NAVIGATION TAB SWITCHER ----------------
window.switchPosTab = function(tabName) {
    activePosTab = tabName;
    const btnItems = document.getElementById("tabBtnItems");
    const btnPayment = document.getElementById("tabBtnPayment");

    const secItems = document.getElementById("sectionTabItems");
    const secPayment = document.getElementById("sectionTabPayment");

    const activeClass = "py-2.5 px-3 rounded-lg font-bold text-xs border border-primary-container bg-primary-container text-white transition-all flex items-center justify-center gap-2 shadow-sm";
    const inactiveClass = "py-2.5 px-3 rounded-lg font-bold text-xs border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all flex items-center justify-center gap-2";

    if (tabName === "payment") {
        if (btnItems) btnItems.className = inactiveClass;
        if (btnPayment) btnPayment.className = activeClass;

        if (secItems) secItems.classList.add("hidden");
        if (secPayment) secPayment.classList.remove("hidden");
    } else {
        // default "items"
        if (btnItems) btnItems.className = activeClass;
        if (btnPayment) btnPayment.className = inactiveClass;

        if (secItems) secItems.classList.remove("hidden");
        if (secPayment) secPayment.classList.add("hidden");
    }
    updateInvoicePreview();
};

// ---------------- DYNAMIC PAYMENT TYPE SELECTION (DIRECT VS FINANCE) ----------------
window.selectPaymentType = function(type) {
    currentPaymentCategory = type;
    const btnDirect = document.getElementById("payTypeBtnDirect");
    const btnFinance = document.getElementById("payTypeBtnFinance");
    const subDirect = document.getElementById("paySubDirect");
    const subFinance = document.getElementById("paySubFinance");

    const activeClass = "py-2.5 px-3 rounded-lg font-bold text-xs border border-primary-container bg-primary-container text-white transition-all flex items-center justify-center gap-1.5 shadow-sm";
    const inactiveClass = "py-2.5 px-3 rounded-lg font-bold text-xs border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-all flex items-center justify-center gap-1.5";

    if (type === "finance") {
        if (btnDirect) btnDirect.className = inactiveClass;
        if (btnFinance) btnFinance.className = activeClass;
        if (subDirect) subDirect.classList.add("hidden");
        if (subFinance) subFinance.classList.remove("hidden");
    } else {
        // "non-finance"
        if (btnDirect) btnDirect.className = activeClass;
        if (btnFinance) btnFinance.className = inactiveClass;
        if (subDirect) subDirect.classList.remove("hidden");
        if (subFinance) subFinance.classList.add("hidden");
    }
    updateInvoicePreview();
};

// ---------------- DEFAULT DATE & TIME (INTERACTIVE CALENDAR PICKERS) ----------------
function initDefaultDateTime() {
    const dateInput = document.getElementById("input-date-picker");
    const timeInput = document.getElementById("input-time-picker");
    const now = new Date();

    if (dateInput && !dateInput.value) {
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    }

    if (timeInput && !timeInput.value) {
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        timeInput.value = `${hours}:${minutes}`;
    }
}

function getFormatted12HourDateTime() {
    const dateInput = document.getElementById("input-date-picker");
    const timeInput = document.getElementById("input-time-picker");

    const dateVal = dateInput ? dateInput.value : "";
    const timeVal = timeInput ? timeInput.value : "";

    let dateFormatted = "";
    if (dateVal) {
        const parts = dateVal.split("-");
        if (parts.length === 3) {
            const yyyy = parts[0];
            const mm = parseInt(parts[1], 10) - 1;
            const dd = parts[2];
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            dateFormatted = `${dd}-${months[mm] || 'Jan'}-${yyyy}`;
        }
    }

    if (!dateFormatted) {
        const now = new Date();
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        dateFormatted = `${String(now.getDate()).padStart(2, '0')}-${months[now.getMonth()]}-${now.getFullYear()}`;
    }

    let timeFormatted = "";
    if (timeVal) {
        const tParts = timeVal.split(":");
        if (tParts.length >= 2) {
            let h = parseInt(tParts[0], 10);
            let m = tParts[1];
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12;
            h = h ? h : 12;
            const strH = String(h).padStart(2, '0');
            timeFormatted = `${strH}:${m} ${ampm}`;
        }
    }

    if (!timeFormatted) {
        const now = new Date();
        let h = now.getHours();
        const m = String(now.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12;
        const strH = String(h).padStart(2, '0');
        timeFormatted = `${strH}:${m} ${ampm}`;
    }

    return `${dateFormatted} ${timeFormatted}`;
}

// ---------------- STORE SETTINGS ----------------
async function loadStoreSettings() {
    try {
        const res = await fetch(`${API_BASE}/api/settings`);
        if (res.ok) {
            storeSettings = await res.json();
            applyStoreSettingsToUI(storeSettings);
        }
    } catch (err) {
        console.error("Error loading store settings:", err);
    }
}

function applyStoreSettingsToUI(s) {
    if (!s) return;
    document.getElementById("topStoreName").textContent = `${s.store_name || "RC Mobiles"} - Madakasira`;
    if (s.logo_path) {
        const pLogo = document.getElementById("previewLogoImg");
        if (pLogo) pLogo.src = s.logo_path;
        const wLogo = document.getElementById("previewWatermarkLogo");
        if (wLogo) wLogo.src = s.logo_path;
        document.getElementById("sidebarLogoImg").src = s.logo_path;
        document.getElementById("topAvatarImg").src = s.logo_path;
    }
    document.getElementById("preview-store-name").textContent = s.store_name || "RC MOBILES";
    document.getElementById("preview-store-address").textContent = s.address || "NTR Circle, Madakasira, Ananthapur (Sri Sathya Sai district region), Andhra Pradesh 515301";
    document.getElementById("preview-store-phone").textContent = s.phone || "+91 98490 12345";
    document.getElementById("preview-store-email").textContent = s.email || "rcmobiles.madakasira@gmail.com";
    document.getElementById("preview-store-gstin").textContent = s.gstin || "37APVPR6953F1Z1";

    const fName = document.getElementById("preview-footer-name");
    if (fName) fName.textContent = (s.store_name ? `${s.store_name} and Services` : "RC Mobiles and Services");
    const fAddr = document.getElementById("preview-footer-address");
    if (fAddr) fAddr.textContent = s.address || "NTR Circle, Madakasira, Ananthapur Dist, Andhra Pradesh 515301";
    const fPhone = document.getElementById("preview-footer-phone");
    if (fPhone) fPhone.textContent = s.phone || "+91 98490 12345";
    const fEmail = document.getElementById("preview-footer-email");
    if (fEmail) fEmail.textContent = s.email || "rcmobiles.madakasira@gmail.com";

    const invInput = document.getElementById("input-invoice-no");
    if (invInput && s.invoice_prefix && s.invoice_counter) {
        const prefix = s.invoice_prefix || "RCM";
        const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
        currentInvoiceNo = `${prefix}-${yyyymm}-${s.invoice_counter}`;
        invInput.value = currentInvoiceNo;
    }

    const setStoreName = document.getElementById("setStoreName");
    if (setStoreName) setStoreName.value = s.store_name || "RC Mobiles";
    const setAddress = document.getElementById("setAddress");
    if (setAddress) setAddress.value = s.address || "";
    const setGstin = document.getElementById("setGstin");
    if (setGstin) setGstin.value = s.gstin || "";
    const setPhone = document.getElementById("setPhone");
    if (setPhone) setPhone.value = s.phone || "";
    const setEmail = document.getElementById("setEmail");
    if (setEmail) setEmail.value = s.email || "";
}

// ---------------- CATALOG PRODUCTS ----------------
async function loadCatalogProducts(query = "") {
    try {
        const res = await fetch(`${API_BASE}/api/products?query=${encodeURIComponent(query)}`);
        if (res.ok) {
            catalogProducts = await res.json();
        }
    } catch (err) {
        console.error("Error loading catalog products:", err);
    }
}

// ---------------- DYNAMIC MULTI-ITEM BUILDER ----------------
function renderLineItemRows() {
    const container = document.getElementById("lineItemsContainer");
    if (!container) return;

    if (itemsList.length === 0) {
        itemsList.push({ id: Date.now(), desc: "", qty: 1, price: 0.0, hsn: "8517", imei: "" });
    }

    container.innerHTML = itemsList.map((item, index) => `
        <div class="p-3 border border-gray-200 rounded-lg bg-gray-50/50 space-y-3 relative group" id="item-row-${item.id}">
            <div class="flex justify-between items-center text-xs font-bold text-gray-700 border-b pb-1">
                <span>Item / Model #${index + 1}</span>
                <div class="flex items-center gap-2">
                    <span class="text-[11px] text-slate-500 font-semibold">Line Total: <strong class="text-slate-900 font-extrabold" id="item-row-total-${item.id}">₹${(((item.qty || 1) * (item.price || 0.0))).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></span>
                    ${itemsList.length > 1 ? `
                        <button type="button" onclick="removeItemRow(${item.id})" class="text-red-600 hover:text-red-800 text-[11px] font-semibold flex items-center gap-0.5 ml-2">
                            <span class="material-symbols-outlined text-sm">delete</span> Remove
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="grid grid-cols-12 gap-2.5 items-end">
                <div class="col-span-12 sm:col-span-6 relative">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Item / Model Name</label>
                    <input class="w-full border-gray-300 rounded p-2 text-sm focus:ring-0 focus:border-primary-container font-medium" 
                        id="input-item-desc-${item.id}" 
                        placeholder="Enter Item / Model Name" 
                        type="text" 
                        value="${escapeHtml(item.desc)}"
                        oninput="onItemFieldChange(${item.id}, 'desc', this.value)">
                    <div id="autocomplete-${item.id}" class="hidden absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b shadow-lg z-50 max-h-48 overflow-y-auto"></div>
                </div>
                <div class="col-span-4 sm:col-span-2">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Qty</label>
                    <input class="w-full border-gray-300 rounded p-2 text-sm text-center font-bold focus:ring-0 focus:border-primary-container" 
                        id="input-item-qty-${item.id}" 
                        placeholder="1" 
                        type="number" 
                        min="1"
                        step="1"
                        value="${item.qty || 1}"
                        oninput="onItemFieldChange(${item.id}, 'qty', this.value)">
                </div>
                <div class="col-span-8 sm:col-span-4">
                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Unit Rate (₹)</label>
                    <input class="w-full border-gray-300 rounded p-2 text-sm text-right font-bold focus:ring-0 focus:border-primary-container" 
                        id="input-item-price-${item.id}" 
                        placeholder="0.00" 
                        type="number" 
                        step="0.01"
                        value="${item.price ? item.price : ''}"
                        oninput="onItemFieldChange(${item.id}, 'price', this.value)">
                </div>
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">IMEI / Serial Number</label>
                <input class="w-full border-gray-300 rounded p-2 text-sm focus:ring-0 focus:border-primary-container" 
                    id="input-item-imei-${item.id}" 
                    placeholder="Enter 15-digit IMEI or Serial Number (Optional)" 
                    type="text" 
                    value="${escapeHtml(item.imei)}"
                    oninput="onItemFieldChange(${item.id}, 'imei', this.value)">
            </div>
        </div>
    `).join("");

    itemsList.forEach(item => {
        setupRowAutocomplete(item.id);
    });
}

function addNewItemRow(preset = null) {
    const newItem = preset || {
        id: Date.now() + Math.floor(Math.random() * 1000),
        desc: "",
        qty: 1,
        price: 0.0,
        hsn: "8517",
        imei: ""
    };
    itemsList.push(newItem);
    renderLineItemRows();
    updateInvoicePreview();

    setTimeout(() => {
        const descEl = document.getElementById(`input-item-desc-${newItem.id}`);
        if (descEl) descEl.focus();
    }, 50);
}

window.removeItemRow = function(id) {
    if (itemsList.length <= 1) return;
    itemsList = itemsList.filter(it => it.id !== id);
    renderLineItemRows();
    updateInvoicePreview();
};

window.onItemFieldChange = function(id, field, value) {
    const target = itemsList.find(it => it.id === id);
    if (!target) return;

    if (field === 'price') {
        target.price = parseFloat(value) || 0.0;
    } else if (field === 'qty') {
        const parsed = parseInt(value, 10);
        target.qty = isNaN(parsed) || parsed < 1 ? 1 : parsed;
    } else {
        target[field] = value;
    }

    const rowTotalEl = document.getElementById(`item-row-total-${id}`);
    if (rowTotalEl) {
        const lineTot = (target.qty || 1) * (target.price || 0.0);
        rowTotalEl.innerText = `₹${lineTot.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }

    updateInvoicePreview();
};

function setupRowAutocomplete(itemId) {
    const descInput = document.getElementById(`input-item-desc-${itemId}`);
    const autoBox = document.getElementById(`autocomplete-${itemId}`);
    if (!descInput || !autoBox) return;

    descInput.addEventListener("input", (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (query.length < 1) {
            autoBox.classList.add("hidden");
            return;
        }

        const matches = catalogProducts.filter(p => p.name.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query));
        if (matches.length === 0) {
            autoBox.classList.add("hidden");
            return;
        }

        autoBox.innerHTML = matches.map(p => `
            <div class="p-2 hover:bg-blue-50 cursor-pointer border-b text-xs flex justify-between" onclick="selectCatalogRowItem(${itemId}, '${escapeJs(p.name)}', ${p.selling_price}, '${p.hsn_code}')">
                <div>
                    <strong class="text-gray-800">${escapeHtml(p.name)}</strong>
                    <div class="text-gray-500">Brand: ${escapeHtml(p.brand)}</div>
                </div>
                <div class="font-bold text-blue-700">₹${p.selling_price.toLocaleString('en-IN')}</div>
            </div>
        `).join("");
        autoBox.classList.remove("hidden");
    });

    document.addEventListener("click", (e) => {
        if (!descInput.contains(e.target) && !autoBox.contains(e.target)) {
            autoBox.classList.add("hidden");
        }
    });
}

window.selectCatalogRowItem = function(itemId, name, price, hsn) {
    const target = itemsList.find(it => it.id === itemId);
    if (target) {
        target.desc = name;
        target.price = price;
        target.hsn = hsn || "8517";
    }
    renderLineItemRows();
    updateInvoicePreview();
};

window.autoFillFullCash = function() {
    let subtotal = 0;
    itemsList.forEach(item => { subtotal += ((item.qty || 1) * (item.price || 0.0)); });
    const discount = parseFloat(document.getElementById("input-discount").value) || 0.0;
    const netTotal = Math.max(0, subtotal - discount);

    document.getElementById("pay-cash-amount").value = netTotal.toFixed(2);
    document.getElementById("pay-card-amount").value = "0.00";
    document.getElementById("pay-upi-amount").value = "0.00";
    updateInvoicePreview();
};

// ---------------- SAFE DOM TEXT HELPER ----------------
function safeSetText(idOrEl, text) {
    if (!idOrEl) return;
    const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (el) {
        el.innerText = text;
    }
}

// ---------------- LIVE PREVIEW & REAL-TIME BALANCE CALCULATIONS ----------------
function updateInvoicePreview() {
    const custName = (document.getElementById("input-customer-name")?.value || "").trim() || "[Customer Name]";
    const custMobile = (document.getElementById("input-customer-mobile")?.value || "").trim() || "[Mobile Number]";
    const custAddress = (document.getElementById("input-customer-address")?.value || "").trim() || "[Address]";
    const invNo = (document.getElementById("input-invoice-no")?.value || "").trim() || currentInvoiceNo || "[Auto-generated]";
    const invDate = getFormatted12HourDateTime();
    const discount = parseFloat(document.getElementById("input-discount")?.value) || 0.0;

    // Customer & Billed To Details (Supports both naming conventions)
    safeSetText("preview-customer-name", custName);
    safeSetText("preview-cust-name", custName);
    safeSetText("preview-customer-mobile", custMobile);
    safeSetText("preview-cust-phone", `+91 ${custMobile.replace(/^(\+91|0)/, '')}`);
    safeSetText("preview-customer-address", custAddress);
    safeSetText("preview-cust-address", custAddress);
    safeSetText("preview-customer-gstin", "N/A");

    safeSetText("preview-billed-name", custName);
    safeSetText("preview-billed-address", custAddress);

    safeSetText("preview-invoice-no", invNo);
    safeSetText("preview-inv-no", invNo);
    safeSetText("preview-invoice-date", invDate);
    safeSetText("preview-inv-date", invDate);
    safeSetText("preview-state-supply", "Andhra Pradesh (37)");

    // Items Subtotal Calculation
    let subtotal = 0;
    itemsList.forEach(item => {
        const q = item.qty || 1;
        subtotal += (q * (item.price || 0.0));
    });

    // Render A4 Table (Clean Borders & Rounded Corners)
    const tbody = document.getElementById("previewItemsBody") || document.getElementById("previewItemsTbody");
    const hasAnyItemContent = itemsList.some(it => (it.desc && it.desc.trim().length > 0) || (it.price > 0) || (it.imei && it.imei.trim().length > 0));

    if (tbody) {
        if (!hasAnyItemContent) {
            tbody.innerHTML = `
                <tr class="border-b border-gray-200 hover:bg-slate-50/50">
                    <td class="py-2.5 px-2.5 text-center text-gray-500 border-r border-gray-200">1</td>
                    <td class="py-2.5 px-2.5 text-left border-r border-gray-200">
                        <div class="font-bold text-gray-900">[Item / Model Name]</div>
                        <div class="text-[10px] text-blue-600 font-semibold">IMEI/SN: [IMEI/S.NO]</div>
                    </td>
                    <td class="py-2.5 px-2.5 text-center text-gray-500 border-r border-gray-200">8517</td>
                    <td class="py-2.5 px-2.5 text-center text-gray-500 border-r border-gray-200">1</td>
                    <td class="py-2.5 px-2.5 text-right text-gray-500 border-r border-gray-200">₹0.00</td>
                    <td class="py-2.5 px-2.5 text-right font-bold text-gray-900">₹0.00</td>
                </tr>
            `;
        } else {
            tbody.innerHTML = itemsList.map((item, index) => {
                const itemPrice = item.price || 0.0;
                const q = item.qty || 1;
                const lineTotal = q * itemPrice;
                return `
                    <tr class="border-b border-gray-200 hover:bg-slate-50/50">
                        <td class="py-2.5 px-2.5 text-center text-gray-700 border-r border-gray-200">${index + 1}</td>
                        <td class="py-2.5 px-2.5 text-left border-r border-gray-200">
                            <div class="font-bold text-gray-900 break-words">${escapeHtml(item.desc || "[Item / Model Name]")}</div>
                            ${item.imei ? `<div class="text-[10px] text-blue-600 font-semibold break-words">IMEI/SN: ${escapeHtml(item.imei)}</div>` : ''}
                        </td>
                        <td class="py-2.5 px-2.5 text-center text-gray-700 border-r border-gray-200">${escapeHtml(item.hsn || '8517')}</td>
                        <td class="py-2.5 px-2.5 text-center font-bold text-gray-900 border-r border-gray-200">${q}</td>
                        <td class="py-2.5 px-2.5 text-right text-gray-800 border-r border-gray-200">₹${itemPrice.toFixed(2)}</td>
                        <td class="py-2.5 px-2.5 text-right font-bold text-gray-900">₹${lineTotal.toFixed(2)}</td>
                    </tr>
                `;
            }).join("");
        }
    }

    // Financial Totals
    const netTotal = Math.max(0, subtotal - discount);
    const taxableTotal = Math.round((netTotal / 1.18) * 100) / 100;
    const gstTotal = Math.round((netTotal - taxableTotal) * 100) / 100;
    const cgst = Math.round((gstTotal / 2) * 100) / 100;
    const sgst = Math.round((gstTotal - cgst) * 100) / 100;

    // Update Financial Summary in Left Panel
    safeSetText("summary-subtotal", `₹${subtotal.toFixed(2)}`);
    safeSetText("summary-taxable", `₹${taxableTotal.toFixed(2)}`);
    safeSetText("summary-gst", `₹${cgst.toFixed(2)} + ₹${sgst.toFixed(2)}`);
    safeSetText("summary-total", `₹${netTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);

    // Update Right A4 Summary Sheet (Supports both ID variations)
    safeSetText("preview-subtotal-val", `₹${subtotal.toFixed(2)}`);
    safeSetText("preview-subtotal", `₹${subtotal.toFixed(2)}`);
    safeSetText("preview-taxable-val", `₹${taxableTotal.toFixed(2)}`);
    safeSetText("preview-taxable", `₹${taxableTotal.toFixed(2)}`);
    safeSetText("preview-cgst-val", `₹${cgst.toFixed(2)}`);
    safeSetText("preview-cgst", `₹${cgst.toFixed(2)}`);
    safeSetText("preview-sgst-val", `₹${sgst.toFixed(2)}`);
    safeSetText("preview-sgst", `₹${sgst.toFixed(2)}`);
    safeSetText("preview-discount-val", `₹${discount.toFixed(2)}`);
    safeSetText("preview-discount", `-₹${discount.toFixed(2)}`);
    safeSetText("preview-grandtotal-val", `₹${netTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    safeSetText("preview-grand-total", `₹${netTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    safeSetText("preview-amount-words", numberToWordsIndian(netTotal) + " Only");
    safeSetText("preview-words", numberToWordsIndian(netTotal) + " Only");

    // REAL-TIME SETTLEMENT & DYNAMIC A4 VERTICAL FINANCE BLOCK
    const previewPm = document.getElementById("preview-payment-mode");
    const financeBox = document.getElementById("previewFinanceBox") || document.getElementById("preview-finance-details");
    const a4FinBlock = document.getElementById("previewA4VerticalFinance");

    if (currentPaymentCategory === "finance") {
        const financer = document.getElementById("pay-financer-name")?.value || "Finance";
        const appNo = (document.getElementById("pay-finance-approval")?.value || "").trim() || "N/A";
        const dpVal = parseFloat(document.getElementById("pay-finance-dp")?.value) || 0.0;
        const dpMode = document.getElementById("pay-finance-dp-mode")?.value || "Cash";
        const scheme = (document.getElementById("pay-finance-scheme")?.value || "").trim() || "N/A";
        const loanVal = Math.max(0, netTotal - dpVal);

        safeSetText("pay-fin-grand-total", `₹${netTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
        safeSetText("pay-fin-dp-val", `₹${dpVal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
        safeSetText("pay-fin-loan-val", `₹${loanVal.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);

        safeSetText(previewPm, `Finance (${financer})`);
        if (financeBox) financeBox.classList.remove("hidden");
        if (a4FinBlock) a4FinBlock.classList.remove("hidden");

        // Set A4 Meta & Vertical Finance Details
        safeSetText("preview-finance-app-no", appNo);
        safeSetText("prevFinApp", appNo);
        safeSetText("preview-finance-dp-val", `₹${dpVal.toFixed(2)} (${dpMode})`);
        safeSetText("prevFinDp", `₹${dpVal.toFixed(2)} (${dpMode})`);
        safeSetText("preview-finance-scheme-val", scheme);
        safeSetText("prevFinName", financer);

        safeSetText("a4-fin-company", financer);
        safeSetText("a4-fin-appno", appNo);
        safeSetText("a4-fin-dp", `₹${dpVal.toFixed(2)} (${dpMode})`);
        safeSetText("a4-fin-scheme", scheme);
        safeSetText("a4-fin-loan", `₹${loanVal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    } else {
        if (financeBox) financeBox.classList.add("hidden");
        if (a4FinBlock) a4FinBlock.classList.add("hidden");

        const cashAmt = parseFloat(document.getElementById("pay-cash-amount")?.value) || 0.0;
        const cardAmt = parseFloat(document.getElementById("pay-card-amount")?.value) || 0.0;
        const upiAmt = parseFloat(document.getElementById("pay-upi-amount")?.value) || 0.0;
        const totalReceived = cashAmt + cardAmt + upiAmt;
        const balance = netTotal - totalReceived;

        safeSetText("pay-calc-grand-total", `₹${netTotal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
        safeSetText("pay-received-total", `₹${totalReceived.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);

        const balanceLabel = document.getElementById("pay-balance-label");
        const balanceAmount = document.getElementById("pay-balance-amount");
        const statusBadge = document.getElementById("pay-status-badge");

        if (balanceLabel && balanceAmount && statusBadge) {
            if (netTotal === 0 && totalReceived === 0) {
                balanceLabel.innerText = "Balance Due / Pending:";
                balanceAmount.innerText = "₹0.00";
                balanceAmount.className = "text-sm font-extrabold text-gray-500";
                statusBadge.classList.add("hidden");
            } else if (Math.abs(balance) < 0.01) {
                balanceLabel.innerText = "Balance Due / Pending:";
                balanceAmount.innerText = "₹0.00";
                balanceAmount.className = "text-sm font-extrabold text-green-700";
                statusBadge.innerText = "✅ FULLY SETTLED / PAID";
                statusBadge.className = "text-xs font-extrabold p-2 rounded-lg text-center mt-1 bg-green-100 text-green-900 border border-green-300";
                statusBadge.classList.remove("hidden");
            } else if (totalReceived < netTotal) {
                balanceLabel.innerText = "Balance Due / Pending:";
                balanceAmount.innerText = `₹${balance.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                balanceAmount.className = "text-sm font-extrabold text-red-600";
                statusBadge.innerText = `⚠️ PARTIAL PAYMENT (Pending Balance: ₹${balance.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})})`;
                statusBadge.className = "text-xs font-extrabold p-2 rounded-lg text-center mt-1 bg-amber-100 text-amber-900 border border-amber-300";
                statusBadge.classList.remove("hidden");
            } else {
                const excess = totalReceived - netTotal;
                balanceLabel.innerText = "Change to Return:";
                balanceAmount.innerText = `₹${excess.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                balanceAmount.className = "text-sm font-extrabold text-blue-700";
                statusBadge.innerText = `💵 OVERPAID! Return Change to Customer: ₹${excess.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                statusBadge.className = "text-xs font-extrabold p-2 rounded-lg text-center mt-1 bg-blue-100 text-blue-900 border border-blue-300";
                statusBadge.classList.remove("hidden");
            }
        }

        const modes = [];
        if (cashAmt > 0) modes.push(`Cash: ₹${cashAmt.toFixed(2)}`);
        if (cardAmt > 0) modes.push(`Card: ₹${cardAmt.toFixed(2)}`);
        if (upiAmt > 0) modes.push(`UPI: ₹${upiAmt.toFixed(2)}`);

        if (previewPm) {
            if (modes.length === 0) {
                previewPm.innerText = "Cash";
            } else if (modes.length === 1 && cashAmt > 0 && Math.abs(cashAmt - netTotal) < 0.01) {
                previewPm.innerText = "Cash";
            } else {
                previewPm.innerText = modes.join(" | ");
            }
        }
    }
}

// ---------------- INPUT LISTENERS ----------------
function setupInputListeners() {
    const inputs = document.querySelectorAll("input, select");
    inputs.forEach(input => {
        input.addEventListener("input", updateInvoicePreview);
        input.addEventListener("change", updateInvoicePreview);
    });

    const btnAdd = document.getElementById("btnAddItemToList");
    if (btnAdd) {
        btnAdd.addEventListener("click", () => {
            addNewItemRow();
        });
    }

    const btnClearForm = document.getElementById("btnClearForm");
    if (btnClearForm) {
        btnClearForm.addEventListener("click", resetForm);
    }

    const btnSaveDraft = document.getElementById("btnSaveDraft");
    if (btnSaveDraft) {
        btnSaveDraft.addEventListener("click", () => saveInvoice(false));
    }

    const btnGenerate = document.getElementById("btnGenerateInvoice");
    if (btnGenerate) {
        btnGenerate.addEventListener("click", () => saveInvoice(true));
    }

    const btnPrint = document.getElementById("btnPrintInvoice");
    if (btnPrint) {
        btnPrint.addEventListener("click", triggerPrintInvoice);
    }

    const settingsForm = document.getElementById("storeSettingsForm");
    if (settingsForm) {
        settingsForm.addEventListener("submit", handleSettingsSubmit);
    }
}

// ---------------- ZOOM CONTROLS ----------------
function setupZoomControls() {
    const paper = document.getElementById("a4PaperElement");
    const btnIn = document.getElementById("btnZoomIn");
    const btnOut = document.getElementById("btnZoomOut");

    if (btnIn && paper) {
        btnIn.addEventListener("click", () => {
            currentScale = Math.min(1.2, currentScale + 0.1);
            paper.style.transform = `scale(${currentScale})`;
        });
    }
    if (btnOut && paper) {
        btnOut.addEventListener("click", () => {
            currentScale = Math.max(0.6, currentScale - 0.1);
            paper.style.transform = `scale(${currentScale})`;
        });
    }
}

// ---------------- INVOICE PRINT TRIGGER FIX ----------------
function triggerPrintInvoice() {
    updateInvoicePreview();
    closeAllModals();

    // Dismiss success modal & all toasts so they don't block print view
    closeInvoiceSuccessModal();
    const toastContainer = document.getElementById("appToastContainer");
    if (toastContainer) toastContainer.innerHTML = "";

    // Ensure the invoice preview panel is visible on mobile before printing
    if (typeof switchMobileWorkspace === "function") {
        switchMobileWorkspace('preview');
    }

    const paper = document.getElementById("a4PaperElement");
    const oldTransform = paper ? paper.style.transform : "";
    if (paper) paper.style.transform = "none";

    // Wait for UI to settle (toasts/modals to vanish) before triggering print
    setTimeout(() => {
        window.print();
        setTimeout(() => {
            if (paper) paper.style.transform = oldTransform || `scale(${currentScale})`;
        }, 600);
    }, 300);
}

// ---------------- INVOICE PERSISTENCE ----------------
async function saveInvoice(shouldPrint = true) {
    // ── Mandatory field validation before any DB operation ──
    if (!validateInvoiceForm(shouldPrint)) {
        return; // Stop — validation errors shown inline
    }

    const custName = document.getElementById("input-customer-name").value.trim() || "Cash Customer";
    const custMobile = document.getElementById("input-customer-mobile").value.trim();
    const custAddress = document.getElementById("input-customer-address").value.trim() || "Madakasira, AP";
    const discount = parseFloat(document.getElementById("input-discount").value) || 0.0;

    const dateInput = document.getElementById("input-date-picker");
    const timeInput = document.getElementById("input-time-picker");
    const dVal = dateInput ? dateInput.value : "";
    const tVal = timeInput ? timeInput.value : "00:00";
    let invDateIso = new Date().toISOString();
    if (dVal) {
        const dt = new Date(`${dVal}T${tVal}`);
        if (!isNaN(dt.getTime())) {
            invDateIso = dt.toISOString();
        }
    }

    let paymentModeStr = "Cash";
    let notesStr = "";

    if (currentPaymentCategory === "finance") {
        const financer = document.getElementById("pay-financer-name").value || "Finance";
        const appNo = document.getElementById("pay-finance-approval").value.trim() || "N/A";
        const dpVal = parseFloat(document.getElementById("pay-finance-dp").value) || 0.0;
        const dpMode = document.getElementById("pay-finance-dp-mode").value || "Cash";
        const scheme = document.getElementById("pay-finance-scheme").value.trim() || "N/A";

        paymentModeStr = `Finance (${financer})`;
        notesStr = `Financer: ${financer} | Approval No: ${appNo} | Downpayment: ₹${dpVal.toFixed(2)} (${dpMode}) | Scheme: ${scheme}`;
    } else {
        const cashAmt = parseFloat(document.getElementById("pay-cash-amount").value) || 0.0;
        const cardAmt = parseFloat(document.getElementById("pay-card-amount").value) || 0.0;
        const upiAmt = parseFloat(document.getElementById("pay-upi-amount").value) || 0.0;

        const modes = [];
        if (cashAmt > 0) modes.push(`Cash: ₹${cashAmt.toFixed(2)}`);
        if (cardAmt > 0) modes.push(`Card: ₹${cardAmt.toFixed(2)}`);
        if (upiAmt > 0) modes.push(`UPI: ₹${upiAmt.toFixed(2)}`);

        paymentModeStr = modes.length > 0 ? modes.join(" | ") : "Cash";
    }

    const itemsPayload = itemsList.filter(it => (it.desc && it.desc.trim().length > 0) || it.price > 0).map(item => ({
        item_name: item.desc ? item.desc.trim() : "Mobile Product",
        unit_price: item.price || 0.0,
        hsn_code: item.hsn || "8517",
        imei_serial: item.imei ? item.imei.trim() : "",
        quantity: Math.max(1, parseInt(item.qty || 1, 10)),
        tax_rate: 18.0
    }));

    if (itemsPayload.length === 0) {
        showAppDialog({
            title: "Line Item Required",
            message: "Please enter at least one Item / Model Name and a valid selling price before generating or printing an invoice.",
            type: "warning"
        });
        return;
    }

    const payload = {
        customer_name: custName,
        customer_phone: custMobile,
        customer_address: custAddress,
        invoice_date: invDateIso,
        state_type: "INTRA_STATE",
        payment_mode: paymentModeStr,
        payment_status: "Paid",
        discount_amount: discount,
        notes: notesStr,
        is_tax_inclusive: true,
        items: itemsPayload
    };

    try {
        const url = editingInvoiceId ? `${API_BASE}/api/invoices/${editingInvoiceId}` : `${API_BASE}/api/invoices`;
        const method = editingInvoiceId ? "PUT" : "POST";

        const res = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const resData = await res.json();
            const createdInv = resData.invoice || {};
            const nextInvNo = resData.next_invoice_number;
            
            document.getElementById("invoiceStatusBadge").textContent = "Saved";
            document.getElementById("invoiceStatusBadge").className = "bg-green-100 text-green-800 px-3 py-1 rounded text-xs font-bold uppercase tracking-widest";
            
            const savedNo = createdInv.invoice_number || currentInvoiceNo;
            const grandTotalVal = createdInv.grand_total || 0;
            const successMsg = editingInvoiceId ? `Invoice ${savedNo} updated successfully!` : `Invoice ${savedNo} generated successfully!`;
            showToast(successMsg, "success");

            // Show premium success confirmation modal
            if (!editingInvoiceId) {
                showInvoiceSuccessModal(savedNo, custName, grandTotalVal);
            }

            // Reset customer verification for next invoice
            customerVerified = false;
            const verifyBtn = document.getElementById("btnCustomerVerify");
            const verifyIcon = document.getElementById("verifyIcon");
            const verifyLabel = document.getElementById("verifyLabel");
            const custCard = document.getElementById("customerDetailsCard");
            if (verifyBtn) verifyBtn.className = "w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 text-xs font-bold transition-all hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50";
            if (verifyIcon) verifyIcon.textContent = "check_circle";
            if (verifyLabel) verifyLabel.textContent = "Click to Verify Customer ✓";
            if (custCard) custCard.style.boxShadow = "";

            if (shouldPrint) {
                triggerPrintInvoice();
            }

            if (editingInvoiceId) {
                editingInvoiceId = null;
                const genBtn = document.getElementById("btnGenerateInvoice");
                if (genBtn) genBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">receipt_long</span> Generate &amp; Print Invoice`;
                loadStoreSettings();
            } else {
                // For newly generated invoice, automatically prepare the POS form for the NEXT sequential invoice
                setTimeout(() => {
                    document.getElementById("input-customer-name").value = "";
                    document.getElementById("input-customer-mobile").value = "";
                    document.getElementById("input-customer-address").value = "";
                    document.getElementById("input-discount").value = "0.00";
                    document.getElementById("pay-cash-amount").value = "";
                    document.getElementById("pay-card-amount").value = "";
                    document.getElementById("pay-upi-amount").value = "";
                    document.getElementById("pay-finance-approval").value = "";
                    document.getElementById("pay-finance-dp").value = "";
                    document.getElementById("pay-finance-scheme").value = "";

                    switchPosTab("items");
                    selectPaymentType("non-finance");
                    itemsList = [{ id: Date.now(), desc: "", price: 0.0, hsn: "8517", imei: "" }];
                    renderLineItemRows();

                    document.getElementById("invoiceStatusBadge").textContent = "Draft";
                    document.getElementById("invoiceStatusBadge").className = "bg-orange-100 text-orange-800 px-3 py-1 rounded text-xs font-bold uppercase tracking-widest";
                    initDefaultDateTime();

                    // Apply the next sequential invoice number
                    if (nextInvNo) {
                        currentInvoiceNo = nextInvNo;
                        const invInput = document.getElementById("input-invoice-no");
                        if (invInput) invInput.value = nextInvNo;
                        if (storeSettings) storeSettings.invoice_counter = resData.next_counter;
                    } else {
                        loadStoreSettings();
                    }

                    updateInvoicePreview();
                    showToast(`Ready for next invoice: ${currentInvoiceNo}`, "info");
                }, shouldPrint ? 1200 : 300);
            }
        } else {
            const err = await res.json();
            showAppDialog({
                title: "Error Saving Invoice",
                message: err.error || err.message || "An error occurred while saving the invoice. Please verify your entries.",
                type: "error"
            });
        }
    } catch (err) {
        console.error("Save invoice error:", err);
        showAppDialog({
            title: "Connection Failed",
            message: "Unable to reach the backend server. Please verify that the Flask server is running and try again.",
            type: "error"
        });
    }
}

function resetForm() {
    editingInvoiceId = null;
    document.getElementById("input-customer-name").value = "";
    document.getElementById("input-customer-mobile").value = "";
    document.getElementById("input-customer-address").value = "";
    document.getElementById("input-discount").value = "0.00";
    document.getElementById("pay-cash-amount").value = "";
    document.getElementById("pay-card-amount").value = "";
    document.getElementById("pay-upi-amount").value = "";
    document.getElementById("pay-finance-approval").value = "";
    document.getElementById("pay-finance-dp").value = "";
    document.getElementById("pay-finance-scheme").value = "";
    
    const genBtn = document.getElementById("btnGenerateInvoice");
    if (genBtn) genBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">receipt_long</span> Generate &amp; Print Invoice`;

    switchPosTab("items");
    selectPaymentType("non-finance");
    itemsList = [{ id: Date.now(), desc: "", price: 0.0, hsn: "8517", imei: "" }];
    renderLineItemRows();
    document.getElementById("invoiceStatusBadge").textContent = "Draft";
    document.getElementById("invoiceStatusBadge").className = "bg-orange-100 text-orange-800 px-3 py-1 rounded text-xs font-bold uppercase tracking-widest";
    initDefaultDateTime();
    loadStoreSettings();
    updateInvoicePreview();
    showToast("Invoice form reset to blank draft.", "info");
}

// ---------------- MODAL MANAGEMENT ----------------
function openModal(id, filter = "") {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove("hidden");

    if (id === "invoicesModal") loadInvoicesHistory();
    if (id === "inventoryModal") loadInventoryTable(filter);
    if (id === "dashboardModal") loadDashboardStats();
    if (id === "settingsModal") loadStoreSettings();
    if (id === "usersModal") loadUsersTable();
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add("hidden");
}

function closeAllModals() {
    ['invoicesModal', 'inventoryModal', 'dashboardModal', 'settingsModal', 'addProductModal', 'usersModal', 'appDialogModal'].forEach(closeModal);
}

// ---------------- MODAL DATA LOADERS ----------------
async function loadInvoicesHistory() {
    const search = document.getElementById("histSearch") ? document.getElementById("histSearch").value.trim() : "";
    const df = document.getElementById("histDateFrom") ? document.getElementById("histDateFrom").value : "";
    const dt = document.getElementById("histDateTo") ? document.getElementById("histDateTo").value : "";

    try {
        const res = await fetch(`${API_BASE}/api/invoices?search=${encodeURIComponent(search)}&date_from=${df}&date_to=${dt}`);
        if (res.ok) {
            const invoices = await res.json();
            const tbody = document.getElementById("invoicesTbody");
            if (!invoices || invoices.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-500">No invoices found.</td></tr>`;
                return;
            }

            tbody.innerHTML = invoices.map(inv => `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="p-2 font-bold text-gray-800">${escapeHtml(inv.invoice_number)}</td>
                    <td class="p-2 text-xs">${inv.formatted_date || ''}</td>
                    <td class="p-2 font-medium">${escapeHtml(inv.customer_name)}</td>
                    <td class="p-2 text-gray-600">${escapeHtml(inv.customer_phone || 'N/A')}</td>
                    <td class="p-2"><span class="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-semibold">${escapeHtml(inv.payment_mode)}</span></td>
                    <td class="p-2 font-bold text-gray-900">₹${inv.grand_total.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                    <td class="p-2 text-center">
                        <div class="flex items-center justify-center gap-1">
                            <button onclick="viewReprintInvoice(${inv.id})" class="bg-primary-container hover:bg-slate-900 text-white px-2 py-1 rounded text-xs font-bold transition-all shadow-sm" title="View / Print">
                                Print
                            </button>
                            <button onclick="loadInvoiceForEditing(${inv.id})" class="bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded text-xs font-bold transition-all shadow-sm" title="Edit Invoice">
                                Edit
                            </button>
                            <button onclick="deleteInvoice(${inv.id}, '${escapeJs(inv.invoice_number)}')" class="bg-rose-500 hover:bg-rose-600 text-white px-2 py-1 rounded text-xs font-bold transition-all shadow-sm" title="Delete Invoice">
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `).join("");
        }
    } catch (err) {
        console.error("Error loading invoice history:", err);
        showToast("Failed to load invoice history from database", "error");
    }
}

window.loadInvoiceForEditing = async function(id) {
    try {
        const res = await fetch(`${API_BASE}/api/invoices/${id}`);
        if (res.ok) {
            const inv = await res.json();
            closeAllModals();
            editingInvoiceId = inv.id;

            document.getElementById("input-customer-name").value = inv.customer_name || "";
            document.getElementById("input-customer-mobile").value = inv.customer_phone || "";
            document.getElementById("input-customer-address").value = inv.customer_address || "";
            document.getElementById("input-invoice-no").value = inv.invoice_number || "";
            currentInvoiceNo = inv.invoice_number || "";
            document.getElementById("input-discount").value = inv.discount_amount || "0.00";

            if (inv.invoice_date) {
                const dt = new Date(inv.invoice_date);
                if (!isNaN(dt.getTime())) {
                    const yyyy = dt.getFullYear();
                    const mm = String(dt.getMonth() + 1).padStart(2, '0');
                    const dd = String(dt.getDate()).padStart(2, '0');
                    const hh = String(dt.getHours()).padStart(2, '0');
                    const min = String(dt.getMinutes()).padStart(2, '0');

                    const dPicker = document.getElementById("input-date-picker");
                    const tPicker = document.getElementById("input-time-picker");
                    if (dPicker) dPicker.value = `${yyyy}-${mm}-${dd}`;
                    if (tPicker) tPicker.value = `${hh}:${min}`;
                }
            }

            if (inv.items && inv.items.length > 0) {
                itemsList = inv.items.map((item, idx) => ({
                    id: Date.now() + idx,
                    desc: item.item_name,
                    qty: item.quantity || 1,
                    price: item.unit_price || (item.total_amount / (item.quantity || 1)) || 0.0,
                    hsn: item.hsn_code || "8517",
                    imei: item.imei_serial || ""
                }));
            } else {
                itemsList = [{ id: Date.now(), desc: "", qty: 1, price: 0.0, hsn: "8517", imei: "" }];
            }

            if (inv.payment_mode && inv.payment_mode.startsWith("Finance")) {
                selectPaymentType("finance");
            } else {
                selectPaymentType("non-finance");
                document.getElementById("pay-cash-amount").value = (inv.grand_total || 0).toFixed(2);
            }

            renderLineItemRows();
            updateInvoicePreview();

            const badge = document.getElementById("invoiceStatusBadge");
            if (badge) {
                badge.textContent = `Editing: ${inv.invoice_number}`;
                badge.className = "bg-purple-100 text-purple-900 px-3 py-1 rounded text-xs font-bold uppercase tracking-widest";
            }

            const genBtn = document.getElementById("btnGenerateInvoice");
            if (genBtn) {
                genBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">update</span> Update &amp; Print Invoice`;
            }

            showToast(`Loaded invoice ${inv.invoice_number} for editing`, "info");
        } else {
            showToast("Failed to load invoice details", "error");
        }
    } catch (err) {
        console.error("Load invoice for editing error:", err);
        showToast("Error connecting to server", "error");
    }
};

window.deleteInvoice = async function(id, invNo) {
    const confirmed = await showAppDialog({
        title: "Delete Invoice?",
        message: `Are you sure you want to permanently delete invoice "${invNo}"? This action cannot be undone.`,
        type: "warning",
        confirmText: "Delete",
        cancelText: "Cancel"
    });

    if (!confirmed) return;

    try {
        const res = await fetch(`${API_BASE}/api/invoices/${id}`, {
            method: "DELETE"
        });

        if (res.ok) {
            showToast(`Invoice ${invNo} deleted successfully`, "info");
            loadInvoicesHistory();
            if (editingInvoiceId === id) {
                resetForm();
            }
        } else {
            const err = await res.json();
            showAppDialog({
                title: "Delete Failed",
                message: err.error || "Failed to delete invoice",
                type: "error"
            });
        }
    } catch (err) {
        console.error("Delete invoice error:", err);
        showToast("Server connection error", "error");
    }
};

window.viewReprintInvoice = async function(id) {
    try {
        const res = await fetch(`${API_BASE}/api/invoices/${id}`);
        if (res.ok) {
            const inv = await res.json();
            closeModal("invoicesModal");
            document.getElementById("input-customer-name").value = inv.customer_name;
            document.getElementById("input-customer-mobile").value = inv.customer_phone || "";
            document.getElementById("input-customer-address").value = inv.customer_address || "";
            document.getElementById("input-invoice-no").value = inv.invoice_number;
            document.getElementById("input-discount").value = inv.discount_amount;
            
            if (inv.invoice_date) {
                const dt = new Date(inv.invoice_date);
                if (!isNaN(dt.getTime())) {
                    const yyyy = dt.getFullYear();
                    const mm = String(dt.getMonth() + 1).padStart(2, '0');
                    const dd = String(dt.getDate()).padStart(2, '0');
                    const hh = String(dt.getHours()).padStart(2, '0');
                    const min = String(dt.getMinutes()).padStart(2, '0');

                    const dPicker = document.getElementById("input-date-picker");
                    const tPicker = document.getElementById("input-time-picker");
                    if (dPicker) dPicker.value = `${yyyy}-${mm}-${dd}`;
                    if (tPicker) tPicker.value = `${hh}:${min}`;
                }
            }

            if (inv.items && inv.items.length > 0) {
                itemsList = inv.items.map((item, idx) => ({
                    id: Date.now() + idx,
                    desc: item.item_name,
                    price: item.total_amount,
                    hsn: item.hsn_code,
                    imei: item.imei_serial
                }));
                renderLineItemRows();
            }
            triggerPrintInvoice();
        }
    } catch (err) {
        console.error("Reprint error:", err);
        showToast("Error loading selected invoice for reprint", "error");
    }
};

async function loadInventoryTable(filterCat = "") {
    const search = document.getElementById("invSearch") ? document.getElementById("invSearch").value.trim() : "";
    const cat = filterCat || (document.getElementById("invCatFilter") ? document.getElementById("invCatFilter").value : "");

    try {
        const res = await fetch(`${API_BASE}/api/products?query=${encodeURIComponent(search)}&category=${cat}`);
        if (res.ok) {
            const products = await res.json();
            const tbody = document.getElementById("inventoryTbody");
            if (!products || products.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-500">No products found in catalog.</td></tr>`;
                return;
            }

            tbody.innerHTML = products.map(p => `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="p-2 font-bold text-gray-800">${escapeHtml(p.name)}</td>
                    <td class="p-2">${escapeHtml(p.brand)}</td>
                    <td class="p-2"><span class="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs">${p.category}</span></td>
                    <td class="p-2 text-gray-600">${p.hsn_code}</td>
                    <td class="p-2"><span class="font-bold ${p.stock_qty <= 2 ? 'text-red-600' : 'text-green-600'}">${p.stock_qty} pcs</span></td>
                    <td class="p-2 font-bold">₹${p.selling_price.toLocaleString('en-IN')}</td>
                    <td class="p-2 text-center">
                        <button onclick="useProductInPOS(${p.id})" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs transition-colors">Bill Item</button>
                    </td>
                </tr>
            `).join("");
        }
    } catch (err) {
        console.error("Error loading inventory table:", err);
        showToast("Failed to load inventory table", "error");
    }
}

window.useProductInPOS = function(id) {
    const p = catalogProducts.find(item => item.id === id);
    if (p) {
        closeModal("inventoryModal");
        addNewItemRow({
            id: Date.now(),
            desc: p.name,
            price: p.selling_price,
            hsn: p.hsn_code,
            imei: ""
        });
        showToast(`Added "${p.name}" to invoice`, "info");
    }
};

// Custom Add Product Modal
window.openAddProductDialog = function() {
    const form = document.getElementById("addProductForm");
    if (form) form.reset();
    openModal("addProductModal");
};

function setupAddProductModal() {
    const form = document.getElementById("addProductForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("newProdName").value.trim();
        const brand = document.getElementById("newProdBrand").value.trim() || "Generic";
        const category = document.getElementById("newProdCategory").value;
        const price = parseFloat(document.getElementById("newProdPrice").value);
        const hsn = document.getElementById("newProdHsn").value.trim() || "8517";
        const stock = parseInt(document.getElementById("newProdStock").value) || 1;

        if (!name || isNaN(price) || price < 0) {
            showAppDialog({
                title: "Invalid Input",
                message: "Please enter a valid product name and non-negative selling price.",
                type: "warning"
            });
            return;
        }

        const payload = {
            name,
            brand,
            category,
            hsn_code: hsn,
            selling_price: price,
            stock_qty: stock,
            tax_rate: 18.0
        };

        try {
            const res = await fetch(`${API_BASE}/api/products`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                closeModal("addProductModal");
                showToast(`Product "${name}" added to catalog!`, "success");
                loadCatalogProducts();
                loadInventoryTable();
            } else {
                const errData = await res.json();
                showAppDialog({
                    title: "Error Adding Product",
                    message: errData.error || "Failed to add product to catalog",
                    type: "error"
                });
            }
        } catch (err) {
            console.error("Add product error:", err);
            showAppDialog({
                title: "Network Error",
                message: "Unable to reach the server to save product.",
                type: "error"
            });
        }
    });
}

async function loadDashboardStats() {
    try {
        const res = await fetch(`${API_BASE}/api/dashboard/stats`);
        if (res.ok) {
            const data = await res.json();
            document.getElementById("statTodaySales").textContent = `₹ ${data.today_sales.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            document.getElementById("statTodayCount").textContent = `${data.today_invoice_count} invoices today`;

            document.getElementById("statMonthSales").textContent = `₹ ${data.month_sales.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            document.getElementById("statMonthCount").textContent = `${data.month_invoice_count} invoices this month`;

            document.getElementById("statTotalSales").textContent = `₹ ${data.total_sales.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
            document.getElementById("statTotalCount").textContent = `${data.total_invoice_count} total invoices`;

            document.getElementById("statTotalProducts").textContent = `${data.total_products} Models`;
            document.getElementById("statLowStock").textContent = `${data.low_stock_count} Low Stock`;
        }
    } catch (err) {
        console.error("Dashboard stats error:", err);
    }
}

async function handleSettingsSubmit(e) {
    e.preventDefault();
    const payload = {
        store_name: document.getElementById("setStoreName").value.trim(),
        address: document.getElementById("setAddress").value.trim(),
        gstin: document.getElementById("setGstin").value.trim(),
        phone: document.getElementById("setPhone").value.trim(),
        email: document.getElementById("setEmail").value.trim()
    };

    try {
        const res = await fetch(`${API_BASE}/api/settings`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            showToast("Store settings saved successfully!", "success");
            closeModal("settingsModal");
            loadStoreSettings();
        } else {
            const err = await res.json();
            showAppDialog({
                title: "Error Saving Settings",
                message: err.error || "Failed to update store settings.",
                type: "error"
            });
        }
    } catch (err) {
        console.error("Save settings error:", err);
        showAppDialog({
            title: "Connection Failed",
            message: "Unable to update settings. Please verify server connection.",
            type: "error"
        });
    }
}

// ---------------- UTILS ----------------
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeJs(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'");
}

function numberToWordsIndian(num) {
    num = Math.round(num);
    if (num === 0) return "Rupees Zero";

    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty ', 'Thirty ', 'Forty ', 'Fifty ', 'Sixty ', 'Seventy ', 'Eighty ', 'Ninety '];

    function inWords(n) {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + a[n % 10];
        if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + inWords(n % 100);
        if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + inWords(n % 1000);
        if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + inWords(n % 100000);
        return inWords(Math.floor(n / 10000000)) + 'Crore ' + inWords(n % 10000000);
    }

    return "Rupees " + inWords(num).trim();
}

// ---------------- USER & DESIGNATION RIGHTS MANAGEMENT ----------------
window.loadUsersTable = async function() {
    const tbody = document.getElementById("usersTableBody");
    if (!tbody) return;

    try {
        const res = await fetch(`${API_BASE}/api/users`);
        if (res.ok) {
            const users = await res.json();
            if (!users || users.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-400">No users found.</td></tr>`;
                return;
            }

            tbody.innerHTML = users.map(u => {
                let roleBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">Sales Staff</span>`;
                if (u.role === "admin") {
                    roleBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-200">Admin / Owner</span>`;
                } else if (u.role === "manager") {
                    roleBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200">Store Manager</span>`;
                }

                let deleteBtn = `<button onclick="deleteUserAccount(${u.id}, '${escapeJs(u.username)}')" class="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded" title="Delete User">
                    <span class="material-symbols-outlined text-base">delete</span>
                </button>`;
                if (u.id === 1 || u.username === "admin") {
                    deleteBtn = `<span class="text-[10px] text-slate-400 font-semibold italic">Primary Admin</span>`;
                }

                return `
                    <tr class="hover:bg-slate-50">
                        <td class="py-2.5 px-3 font-extrabold text-slate-900">${escapeHtml(u.username)}</td>
                        <td class="py-2.5 px-3 font-semibold text-slate-600">${escapeHtml(u.full_name || '—')}</td>
                        <td class="py-2.5 px-3 text-center">${roleBadge}</td>
                        <td class="py-2.5 px-3 text-center">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Active</span>
                        </td>
                        <td class="py-2.5 px-3 text-center">${deleteBtn}</td>
                    </tr>
                `;
            }).join("");
        }
    } catch (err) {
        console.error("Load users error:", err);
        showToast("Failed to load user accounts", "error");
    }
};

window.handleCreateUserSubmit = async function(e) {
    e.preventDefault();
    const username = document.getElementById("newUsrUsername").value.trim();
    const fullName = document.getElementById("newUsrFullName").value.trim() || username;
    const password = document.getElementById("newUsrPassword").value.trim();
    const role = document.getElementById("newUsrRole").value;

    if (!username || !password) {
        showToast("Username and password are required", "warning");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, full_name: fullName, password, role })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            showToast(`User account "${username}" created!`, "success");
            document.getElementById("createUserForm").reset();
            loadUsersTable();
        } else {
            showAppDialog({
                title: "Failed to Create User",
                message: data.error || "Could not create user account",
                type: "error"
            });
        }
    } catch (err) {
        console.error("Create user error:", err);
        showToast("Server connection failed", "error");
    }
};

window.deleteUserAccount = async function(id, username) {
    const confirmed = await showAppDialog({
        title: "Delete Staff Account?",
        message: `Are you sure you want to delete login account "${username}"? They will lose access to the portal immediately.`,
        type: "warning",
        confirmText: "Delete Account",
        cancelText: "Cancel"
    });

    if (!confirmed) return;

    try {
        const res = await fetch(`${API_BASE}/api/users/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(`User "${username}" deleted`, "info");
            loadUsersTable();
        } else {
            showAppDialog({ title: "Error", message: data.error || "Failed to delete user", type: "error" });
        }
    } catch (err) {
        console.error("Delete user error:", err);
        showToast("Server connection error", "error");
    }
};

