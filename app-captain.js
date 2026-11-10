// Bus Yatra - Captain Portal Script with GPS ON/OFF Toggle, QR Authenticator & Remarks

let loggedInCaptain = null;
let captainGpsInterval = null;
let captainDataInterval = null;
let isGpsActive = (typeof localStorage !== 'undefined' && localStorage.getItem('captain_gps_active') === 'true');

window.addEventListener('DOMContentLoaded', () => {
    checkCaptainAuth();
    const dt = localDateStr();
    const d1 = document.getElementById('seatLayoutDate');
    const d2 = document.getElementById('captainManifestDate');
    if (d1) d1.value = dt;
    if (d2) d2.value = dt;
});

async function checkCaptainAuth() {
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('auth_token');
    const isAdmin = urlParams.get('admin') === '1';

    if (authToken) {
        // Instant visual transition: immediately hide login modal and reveal captain dashboard
        document.getElementById('captainAuthModal')?.classList.add('hidden');
        document.getElementById('captainProtectedApp')?.classList.remove('hidden');
        const preCap = JSON.parse(localStorage.getItem('captain_session') || sessionStorage.getItem('captain_session') || '{}');
        const banner = document.getElementById('adminImpersonationBanner');
        const text = document.getElementById('adminImpersonationText');
        if (banner) banner.classList.remove('hidden');
        if (text && preCap?.name) {
            text.innerText = `আপনি অ্যাডমিন হিসেবে "${preCap.busName || preCap.name}" বাসের ক্যাপ্টেন প্যানেলে রয়েছেন।`;
        }

        try {
            // Verify token via /api/captain/me
            const meRes = await apiRequest('/api/captain/me', {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            if (meRes && meRes.ok && meRes.captain) {
                loggedInCaptain = {
                    ...meRes.captain,
                    token: authToken,
                    impersonatedByAdmin: isAdmin
                };
                localStorage.setItem("captain_session", JSON.stringify(loggedInCaptain));
                sessionStorage.setItem("captain_session", JSON.stringify(loggedInCaptain));
                localStorage.setItem("portal_session_captain", JSON.stringify({ token: authToken }));
                sessionStorage.setItem("portal_session_captain", JSON.stringify({ token: authToken }));
                // Security: Immediately erase sensitive auth_token from URL address bar
                window.history.replaceState({}, document.title, window.location.pathname);

                if (text) text.innerText = `আপনি অ্যাডমিন হিসেবে "${loggedInCaptain.busName || loggedInCaptain.name}" বাসের ক্যাপ্টেন প্যানেলে রয়েছেন।`;

                if (isGpsActive) {
                    updateCaptainGpsUi();
                    startCaptainGpsTracking();
                }
                loadCaptainDashboard();
                if (!captainDataInterval) captainDataInterval = setInterval(loadCaptainDashboard, 15000);
                return;
            }
        } catch (authErr) {
            console.error('Admin impersonation auth failed:', authErr);
        }
    }

    const raw = localStorage.getItem("captain_session") || sessionStorage.getItem("captain_session");
    if (raw) {
        try {
            loggedInCaptain = JSON.parse(raw);
            if (loggedInCaptain && loggedInCaptain.token) {
                // Ensure synced across storages
                localStorage.setItem("captain_session", JSON.stringify(loggedInCaptain));
                sessionStorage.setItem("captain_session", JSON.stringify(loggedInCaptain));
                
                document.getElementById('captainAuthModal')?.classList.add('hidden');
                document.getElementById('captainProtectedApp')?.classList.remove('hidden');

                if (loggedInCaptain.impersonatedByAdmin) {
                    const banner = document.getElementById('adminImpersonationBanner');
                    const text = document.getElementById('adminImpersonationText');
                    if (banner) banner.classList.remove('hidden');
                    if (text) text.innerText = `আপনি অ্যাডমিন হিসেবে "${loggedInCaptain.busName || loggedInCaptain.name}" বাসের ক্যাপ্টেন প্যানেলে রয়েছেন।`;
                }

                if (isGpsActive) {
                    updateCaptainGpsUi();
                    startCaptainGpsTracking();
                }
                loadCaptainDashboard();
                if (!captainDataInterval) captainDataInterval = setInterval(loadCaptainDashboard, 15000);
                return;
            }
        } catch (e) {}
    }
    localStorage.removeItem('captain_session');
    sessionStorage.removeItem('captain_session');
    document.getElementById('captainProtectedApp')?.classList.add('hidden');
    document.getElementById('captainAuthModal')?.classList.remove('hidden');
}

function exitAdminImpersonation() {
    localStorage.removeItem('captain_session');
    sessionStorage.removeItem('captain_session');
    localStorage.removeItem('portal_session_captain');
    sessionStorage.removeItem('portal_session_captain');
    if (window.opener && !window.opener.closed) {
        window.close();
    } else {
        window.location.href = 'admin.html';
    }
}
window.exitAdminImpersonation = exitAdminImpersonation;

async function submitCaptainLogin() {
    const phone = document.getElementById('captainLoginPhone').value.trim();
    const pin = document.getElementById('captainLoginPin').value.trim();
    const phoneRegex = /^[6-9]\d{9}$/;

    if (!phoneRegex.test(phone) || !/^\d{4}$/.test(pin)) {
        alert("Please enter a valid 10-digit Indian mobile number and 4-digit PIN.");
        return;
    }

    try {
        const result = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'captain', identifier: phone, pin })
        });

        if (result && result.captain) {
            loggedInCaptain = { ...result.captain, token: result.token, expiresAt: result.expiresAt };
            localStorage.setItem("captain_session", JSON.stringify(loggedInCaptain));
            sessionStorage.setItem("captain_session", JSON.stringify(loggedInCaptain));
            document.getElementById('captainAuthModal')?.classList.add('hidden');
            document.getElementById('captainProtectedApp')?.classList.remove('hidden');
            loadCaptainDashboard();
            if (!captainDataInterval) captainDataInterval = setInterval(loadCaptainDashboard, 15000);
            alert("✅ Welcome Captain " + escapeHtml(loggedInCaptain.name));
        } else {
            alert("Invalid mobile number, PIN, or captain account is disabled by owner.");
        }
    } catch (error) {
        alert("Login failed: " + error.message);
    }
}

async function captainLogout() {
    const ok = await showBusYatraConfirm({
        title: "ক্যাপ্টেন পোর্টাল থেকে লগআউট?",
        subtitle: "আপনি কি নিশ্চিতভাবে ক্যাপ্টেন পোর্টাল থেকে লগআউট করতে চান?",
        icon: '👨‍✈️',
        confirmText: "হ্যাঁ, লগআউট",
        cancelText: "না, ফিরে যান",
        danger: true
    });
    if (!ok) return;

    if (captainGpsInterval) clearInterval(captainGpsInterval);
    if (captainDataInterval) clearInterval(captainDataInterval);
    localStorage.removeItem('captain_gps_active');
    if (loggedInCaptain?.token) {
        try {
            await apiRequest('/api/auth/logout', {
                method: 'POST',
                headers: { Authorization: `Bearer ${loggedInCaptain.token}` }
            });
        } catch (error) {
            console.warn('Captain logout failed:', error);
        }
    }
    localStorage.removeItem("captain_session");
    sessionStorage.removeItem("captain_session");
    location.reload();
}

async function refreshCaptainData() {
    loadCaptainNotifications();
    await loadCaptainDashboard();
    alert("🔄 Data refreshed successfully.");
}

function applyCaptainFeatures(features = {}) {
    window.captainFeatures = {
        qr_scanner: true,
        offline_validation: true,
        cash_collection: true,
        gps_broadcast: true,
        passenger_manifest: true,
        driver_safety_alerts: true,
        ...features
    };
    const f = window.captainFeatures;

    // QR scanner tab & button
    const verifierBtn = document.getElementById('tabVerifierBtn');
    const verifierContent = document.getElementById('tabVerifierContent');
    if (verifierBtn) verifierBtn.style.display = f.qr_scanner !== false ? '' : 'none';
    if (verifierContent && f.qr_scanner === false) verifierContent.classList.add('hidden');

    // Offline validation toggle
    const offlineModeSection = document.getElementById('captainOfflineModeSection');
    if (offlineModeSection) offlineModeSection.style.display = f.offline_validation !== false ? '' : 'none';

    // Cash collection / On-bus ticketing
    const cashSection = document.getElementById('captainCashSection');
    if (cashSection) cashSection.style.display = f.cash_collection !== false ? '' : 'none';

    // GPS Broadcast tab & button
    const gpsBtn = document.getElementById('tabGpsBtn');
    const gpsContent = document.getElementById('tabGpsContent');
    if (gpsBtn) gpsBtn.style.display = f.gps_broadcast !== false ? '' : 'none';
    if (gpsContent && f.gps_broadcast === false) gpsContent.classList.add('hidden');

    // Manifest tab & button
    const manifestBtn = document.getElementById('tabManifestBtn');
    const manifestContent = document.getElementById('tabManifestContent');
    if (manifestBtn) manifestBtn.style.display = f.passenger_manifest !== false ? '' : 'none';
    if (manifestContent && f.passenger_manifest === false) manifestContent.classList.add('hidden');

    // Driver safety alert banner
    const safetyBanner = document.getElementById('captainSafetyBanner');
    if (safetyBanner) safetyBanner.style.display = f.driver_safety_alerts !== false ? '' : 'none';
}
window.applyCaptainFeatures = applyCaptainFeatures;

async function loadCaptainDashboard() {
    // 0. Instant Optimistic Render from cached local data (< 5ms on slow 2G/3G)
    const cachedData = getAppData();
    if (cachedData && (cachedData.buses?.length || cachedData.bookings?.length)) {
        try {
            renderCaptainApprovals();
            loadCaptainSeatLayout();
            renderCaptainManifest();
        } catch (_) {}
    }

    try {
        const data = await apiRequest('/api/captain/state');
        setAppData(data);
        if (data.features) {
            applyCaptainFeatures(data.features);
        }

        // Update Captain Header & Sub-banner Info
        if (loggedInCaptain) {
            const nameEl = document.getElementById('captainHeaderName');
            const busEl = document.getElementById('captainHeaderBus');
            const routeEl = document.getElementById('captainHeaderRoute');
            if (nameEl) nameEl.innerText = `👨‍✈️ ${loggedInCaptain.name || 'Captain'}`;

            const bus = (data.buses || []).find(b => b.id === loggedInCaptain.busId);
            if (bus) {
                if (busEl) busEl.innerText = `${bus.name} (${bus.busNumber || 'Express'})`;
                if (routeEl) routeEl.innerText = bus.route || (bus.stoppages ? `${bus.stoppages[0]} ➔ ${bus.stoppages[bus.stoppages.length - 1]}` : 'Pingla ➔ Kolkata');
                const busTitleEl = document.getElementById('captainBusTitle');
                if (busTitleEl) busTitleEl.innerText = `${bus.name} (${bus.busNumber}) - ${bus.route || 'Pingla to Kolkata'}`;
            }
        }

        renderCaptainApprovals();
        loadCaptainSeatLayout();
        renderCaptainManifest();

        // Restore active tab on reload
        const savedTab = window.location.hash.replace('#', '') || sessionStorage.getItem('captain_active_tab');
        if (savedTab && ['approvals', 'verifier', 'seats', 'manifest', 'gps'].includes(savedTab)) {
            switchCaptainTab(savedTab);
        }

        // Auto-resume GPS broadcast on page refresh/reload if it was active
        if (localStorage.getItem('captain_gps_active') === 'true') {
            isGpsActive = true;
            updateCaptainGpsUi();
            startBackgroundAudioKeepAlive();
            if (!captainGpsWatchId) {
                startCaptainGpsTracking();
                console.log('Captain GPS broadcast automatically resumed after reload.');
            }
        } else {
            isGpsActive = false;
            updateCaptainGpsUi();
        }
    } catch (error) {
        console.error("Error loading captain state:", error);
        if (error.status === 401) {
            localStorage.removeItem('captain_session');
            sessionStorage.removeItem('captain_session');
            loggedInCaptain = null;
            if (captainDataInterval) clearInterval(captainDataInterval);
            if (captainGpsInterval) clearInterval(captainGpsInterval);
            captainDataInterval = null;
            captainGpsInterval = null;
            document.getElementById('captainProtectedApp')?.classList.add('hidden');
            document.getElementById('captainAuthModal')?.classList.remove('hidden');
        } else if (error.status === 403) {
            if (error.message && (error.message.includes('স্থগিত') || error.message.includes('নিষিদ্ধ') || error.message.includes('বন্ধ'))) {
                stopCaptainGpsTracking();
                localStorage.removeItem('captain_gps_active');
                isGpsActive = false;
                updateCaptainGpsUi();
                alert(`⚠️ সতর্কতা:\n\n${error.message}`);
            }
        }
    }
}

// --- Tabs Navigation with Refresh Persistence ---
function switchCaptainTab(tab) {
    sessionStorage.setItem('captain_active_tab', tab);
    if (history.replaceState) {
        history.replaceState(null, '', '#' + tab);
    }

    const tabs = ['approvals', 'verifier', 'seats', 'manifest', 'gps'];
    tabs.forEach(t => {
        const content = document.getElementById(`tab${capitalize(t)}Content`);
        const btn = document.getElementById(`tab${capitalize(t)}Btn`);
        if (content) content.classList.add('hidden');
        if (btn) btn.className = "flex-1 min-w-[96px] sm:min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 bg-transparent transition-all whitespace-nowrap text-center flex items-center justify-center gap-1.5 cursor-pointer";
    });

    const activeContent = document.getElementById(`tab${capitalize(tab)}Content`);
    const activeBtn = document.getElementById(`tab${capitalize(tab)}Btn`);
    if (activeContent) activeContent.classList.remove('hidden');
    if (activeBtn) activeBtn.className = "flex-1 min-w-[96px] sm:min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 transition-all whitespace-nowrap text-center flex items-center justify-center gap-1.5 cursor-pointer";

    if (tab === 'approvals') {
        renderCaptainApprovals();
    } else if (tab === 'seats') {
        loadCaptainSeatLayout();
    } else if (tab === 'manifest') {
        renderCaptainManifest();
    } else if (tab === 'gps') {
        setTimeout(() => {
            initCaptainLiveMap();
        }, 150);
    }
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Booking Approvals, Date-Wise Filters & Select-All Deletion ---
let selectedCaptainBookings = new Set();

function clearCaptainDateFilter() {
    const input = document.getElementById('captainBookingDateFilter');
    if (input) input.value = '';
    renderCaptainApprovals();
}

function toggleCaptainSelectAll(checked) {
    selectedCaptainBookings.clear();
    const checkboxes = document.querySelectorAll('.captain-booking-cb');
    checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked && cb.dataset.id) {
            selectedCaptainBookings.add(cb.dataset.id);
        }
    });
    updateCaptainSelectionToolbar();
}

function handleCaptainBookingCheckChange(checkbox) {
    if (!checkbox || !checkbox.dataset.id) return;
    if (checkbox.checked) {
        selectedCaptainBookings.add(checkbox.dataset.id);
    } else {
        selectedCaptainBookings.delete(checkbox.dataset.id);
    }
    const allCbs = document.querySelectorAll('.captain-booking-cb');
    const selectAll = document.getElementById('captainSelectAllCheckbox');
    if (selectAll) {
        selectAll.checked = allCbs.length > 0 && selectedCaptainBookings.size === allCbs.length;
    }
    updateCaptainSelectionToolbar();
}

function updateCaptainSelectionToolbar() {
    const btn = document.getElementById('btnCaptainBulkDelete');
    const badge = document.getElementById('captainSelectedCountBadge');
    const count = selectedCaptainBookings.size;

    if (btn) {
        btn.disabled = count === 0;
        btn.innerHTML = `<span>🗑️</span> <span>নির্বাচিত ডিলিট (${count}টি)</span>`;
    }
    if (badge) {
        if (count > 0) {
            badge.innerText = `${count}টি নির্বাচিত`;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

async function captainDeleteSingleBooking(bookingId) {
    const ok = await showBusYatraConfirm({
        title: 'বুকিং মুছে ফেলার নিশ্চিতকরণ',
        subtitle: `আপনি কি নিশ্চিত যে #${bookingId} বুকিং হিস্ট্রিটি মুছে ফেলতে চান?`,
        icon: '🗑️',
        confirmText: 'হ্যাঁ, ডিলিট করুন',
        cancelText: 'বাতিল',
        danger: true
    });
    if (!ok) return;
    try {
        await apiRequest(`/api/captain/bookings/${encodeURIComponent(bookingId)}`, {
            method: 'DELETE'
        });
        selectedCaptainBookings.delete(bookingId);
        await loadCaptainDashboard();
        showDropDownToast('✅ বুকিংটি সফলভাবে মুছে ফেলা হয়েছে!', 'success');
    } catch (err) {
        alert(err.message || 'বুকিং ডিলিট করা যায়নি।');
    }
}

async function deleteCaptainSelectedBookings() {
    const ids = Array.from(selectedCaptainBookings);
    if (!ids.length) {
        alert('দয়া করে অন্তত একটি বুকিং সিলেক্ট করুন।');
        return;
    }
    const ok = await showBusYatraConfirm({
        title: 'নির্বাচিত বুকিং ডিলিট',
        subtitle: `আপনি কি নিশ্চিত যে নির্বাচিত ${ids.length}টি বুকিং তালিকা থেকে চিরতরে ডিলিট করতে চান?`,
        icon: '🗑️',
        confirmText: 'হ্যাঁ, সব ডিলিট করুন',
        cancelText: 'বাতিল',
        danger: true
    });
    if (!ok) return;
    try {
        const res = await apiRequest('/api/captain/bookings/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ bookingIds: ids })
        });
        selectedCaptainBookings.clear();
        await loadCaptainDashboard();
        showDropDownToast(`✅ ${res.deleted || ids.length}টি বুকিং সফলভাবে ডিলিট করা হয়েছে!`, 'success');
    } catch (err) {
        alert(err.message || 'বুকিং ডিলিট করা সম্ভব হয়নি।');
    }
}

async function deleteCaptainAllOnDate() {
    const dateInput = document.getElementById('captainBookingDateFilter');
    const dateVal = dateInput?.value;
    if (!dateVal) {
        alert('দয়া করে প্রথমে একটি তারিখ সিলেক্ট করুন যার বুকিং হিস্ট্রি আপনি ডিলিট করতে চান।');
        dateInput?.focus();
        return;
    }
    const ok = await showBusYatraConfirm({
        title: 'তারিখ অনুযায়ী বুকিং ডিলিট',
        subtitle: `সতর্কতা: আপনি কি নিশ্চিত যে ${dateVal} তারিখের সকল বুকিং হিস্ট্রি চিরতরে মুছে ফেলতে চান?`,
        icon: '🗑️',
        confirmText: 'হ্যাঁ, স্থায়ীভাবে ডিলিট করুন',
        cancelText: 'বাতিল',
        danger: true
    });
    if (!ok) return;
    try {
        const res = await apiRequest('/api/captain/bookings/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ date: dateVal })
        });
        selectedCaptainBookings.clear();
        await loadCaptainDashboard();
        showDropDownToast(`✅ ${dateVal} তারিখের ${res.deleted || 0}টি বুকিং মুছে ফেলা হয়েছে!`, 'success');
    } catch (err) {
        alert(err.message || 'তারিখের বুকিং মুছতে সমস্যা হয়েছে।');
    }
}

async function deleteCaptainManifestDateBookings() {
    const dt = document.getElementById('captainManifestDate')?.value || localDateStr();
    const ok = await showBusYatraConfirm({
        title: 'ট্রিপ শিট ডিলিট নিশ্চিতকরণ',
        subtitle: `আপনি কি নিশ্চিত যে ${dt} তারিখের সম্পূর্ণ ট্রিপ শিট ও যাত্রী বুকিং মুছতে চান?`,
        icon: '🗑️',
        confirmText: 'হ্যাঁ, মুছে ফেলুন',
        cancelText: 'বাতিল',
        danger: true
    });
    if (!ok) return;
    try {
        const res = await apiRequest('/api/captain/bookings/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ date: dt })
        });
        await loadCaptainDashboard();
        renderCaptainManifest();
        showDropDownToast(`✅ ${dt} তারিখের ট্রিপ শিট সফলভাবে ক্লিয়ার করা হয়েছে!`, 'success');
    } catch (err) {
        alert(err.message || 'ট্রিপ শিট ডিলিট করা যায়নি।');
    }
}

function renderCaptainApprovals() {
    const db = getAppData();
    const container = document.getElementById('captainBookingsList');
    if (!container || !loggedInCaptain) return;

    const dateFilter = document.getElementById('captainBookingDateFilter')?.value || '';
    const statusFilter = document.getElementById('captainBookingStatusFilter')?.value || 'ALL';

    // Filter bookings for the bus assigned to this captain
    let bookings = Object.values(db.bookings || {}).filter(b => b.busId === loggedInCaptain.busId);

    if (dateFilter) {
        bookings = bookings.filter(b => b.date === dateFilter);
    }
    if (statusFilter !== 'ALL') {
        bookings = bookings.filter(b => b.status === statusFilter);
    }

    // Sort by journey date desc
    bookings.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));

    container.innerHTML = "";

    // Reset select-all checkbox
    const selectAll = document.getElementById('captainSelectAllCheckbox');
    if (selectAll) selectAll.checked = false;
    selectedCaptainBookings.clear();
    updateCaptainSelectionToolbar();

    if (bookings.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-400 py-10 text-xs bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <span class="text-2xl block mb-1">📭</span>
                এই ফিল্টারে বা তারিখে কোনো বুকিং পাওয়া যায়নি।
            </div>
        `;
        return;
    }

    bookings.forEach(b => {
        const isApproved = b.status === "Approved";
        const isRejected = b.status === "Rejected";
        const isCancelled = b.status === "Cancelled";
        const isCancelReq = b.status === "Cancellation Requested";

        container.innerHTML += `
            <div class="bg-gray-50 hover:bg-gray-100/90 p-3.5 sm:p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs transition">
                <div class="flex items-start gap-3 flex-1 min-w-0">
                    <input type="checkbox" data-id="${escapeHtml(b.id)}" onchange="handleCaptainBookingCheckChange(this)" class="captain-booking-cb w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0">
                    <div class="space-y-1 min-w-0">
                        <div class="font-bold text-gray-900 text-sm flex flex-wrap items-center gap-2">
                            <span>${escapeHtml(b.passengerName)}</span>
                            <a href="tel:${escapeHtml(b.passengerPhone)}" class="text-blue-600 hover:underline font-semibold text-xs">📞 ${escapeHtml(b.passengerPhone)}</a>
                            <a href="https://wa.me/91${escapeHtml(b.passengerPhone)}" target="_blank" class="text-green-600 hover:underline font-semibold text-xs">💬 WA</a>
                        </div>
                        <div><strong>Seats:</strong> <span class="bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">${escapeHtml((b.seats || []).join(', '))}</span> • <strong>Date:</strong> <span class="font-bold text-blue-900">${escapeHtml(b.date)}</span></div>
                        <div><strong>Route:</strong> ${escapeHtml(b.boarding)} ➔ ${escapeHtml(b.dropping)} • <strong>Fare:</strong> ₹${b.fare} (${escapeHtml(b.paymentMode)})</div>
                        <div class="text-[11px] text-gray-400 font-mono">ID: ${escapeHtml(b.id)}</div>
                        ${b.cancelReason ? `<div class="text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200 text-[11px]"><strong>⚠️ বাতিলের কারণ:</strong> ${escapeHtml(b.cancelReason)}</div>` : ''}
                        ${isCancelled ? `
                            <div class="text-[11px] font-bold ${b.refundStatus === 'processing' ? 'text-amber-800' : b.refundStatus === 'completed' ? 'text-emerald-800' : 'text-gray-600'}">
                                ${b.refundStatus === 'processing' ? `⏳ রিফান্ড প্রক্রিয়াধীন: ₹${b.refundAmount || 0}` : b.refundStatus === 'completed' ? `✅ রিফান্ড সম্পন্ন: ₹${b.refundAmount || 0}` : '🚫 বুকিং বাতিল'}
                            </div>
                        ` : ''}
                        ${b.rejectionRemarks ? `<div class="text-red-600 font-semibold text-[11px]">Remarks: ${escapeHtml(b.rejectionRemarks)}</div>` : ''}
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-1.5 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0">
                    <span class="px-2.5 py-1 rounded-full font-bold text-[11px] ${
                        isApproved ? 'bg-green-100 text-green-700' : 
                        isCancelled ? 'bg-red-100 text-red-700 border border-red-300' :
                        isRejected ? 'bg-red-100 text-red-700' : 
                        isCancelReq ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse' :
                        'bg-orange-100 text-orange-700'
                    }">
                        ${escapeHtml(isApproved ? 'Booking Done' : (isCancelReq ? 'Cancellation Requested' : (isCancelled ? 'Cancelled' : b.status)))}
                    </span>
                    ${b.status === 'Pending Approval' ? `
                        <button onclick="captainSetBookingStatus('${escapeHtml(b.id)}', 'Approved')" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-xs transition">
                            ✓ Approve
                        </button>
                        <button onclick="promptCaptainReject('${escapeHtml(b.id)}')" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-xs transition">
                            ✕ Reject
                        </button>
                    ` : ''}
                    ${isCancelReq ? `
                        <button onclick="promptCaptainCancel('${escapeHtml(b.id)}', ${b.fare})" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-xs transition">
                            ✕ Approve Cancel
                        </button>
                    ` : ''}
                    <button onclick="captainDeleteSingleBooking('${escapeHtml(b.id)}')" class="bg-red-50 hover:bg-red-600 hover:text-white text-red-600 border border-red-200 px-2.5 py-1.5 rounded-lg font-bold shadow-xs transition flex items-center gap-1" title="Delete Booking">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    });
}

// --- Camera QR Code Scanner & Ticket Authenticity Verifier ---
let html5QrScanner = null;
let isQrScanning = false;

function toggleCameraQrScanner() {
    if (isQrScanning) {
        stopCameraQrScanner();
    } else {
        startCameraQrScanner();
    }
}

function startCameraQrScanner() {
    const container = document.getElementById('qrReaderContainer');
    const btn = document.getElementById('btnToggleCamera');
    if (!window.Html5Qrcode) {
        alert("Camera scanner library is initializing. Please check your internet connection.");
        return;
    }

    container.classList.remove('hidden');
    if (btn) {
        btn.className = "w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2";
        btn.innerHTML = "<span>⏹️ Stop Camera Scanner (ক্যামেরা বন্ধ করুন)</span>";
    }

    html5QrScanner = new Html5Qrcode("qr-reader");
    html5QrScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
            handleQrCodeScanned(decodedText);
        },
        (errorMessage) => {
            // Frame search error, normal while looking
        }
    ).then(() => {
        isQrScanning = true;
    }).catch(err => {
        console.error("Camera start error:", err);
        alert("Unable to access camera. Please allow camera permissions in your browser or enter booking ID manually.");
        stopCameraQrScanner();
    });
}

function stopCameraQrScanner() {
    const container = document.getElementById('qrReaderContainer');
    const btn = document.getElementById('btnToggleCamera');
    if (html5QrScanner && isQrScanning) {
        html5QrScanner.stop().then(() => {
            html5QrScanner.clear();
            html5QrScanner = null;
        }).catch(() => {
            html5QrScanner = null;
        });
    }
    isQrScanning = false;
    if (container) container.classList.add('hidden');
    if (btn) {
        btn.className = "w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2";
        btn.innerHTML = "<span>📷 Start Camera Scanner (ক্যামেরা দিয়ে স্ক্যান করুন)</span>";
    }
}

function handleQrCodeScanned(decodedText) {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    // Extract booking ID
    const match = decodedText.match(/BK_[A-Z0-9]+/i);
    const bookingId = match ? match[0].toUpperCase() : decodedText.trim().toUpperCase();
    document.getElementById('verifyTicketInput').value = bookingId;
    stopCameraQrScanner();
    verifyTicketAuthenticity(bookingId);
}

async function verifyTicketAuthenticity(directCode) {
    const inputVal = document.getElementById('verifyTicketInput')?.value || '';
    const rawCode = (directCode || inputVal).trim().toUpperCase();
    const match = rawCode.match(/BK_[A-Z0-9]+/i);
    const code = match ? match[0].toUpperCase() : rawCode;

    const box = document.getElementById('verificationResultBox');
    if (!code) {
        alert("Please enter a booking ID or ticket code.");
        return;
    }

    box.classList.remove('hidden');
    box.className = "p-4 rounded-xl border text-xs space-y-2 bg-blue-50 border-blue-200 text-blue-900";
    box.innerHTML = `<div class="flex items-center gap-2">🔄 Verifying ticket with live server...</div>`;

    const db = getAppData();
    let booking = Object.values(db.bookings || {}).find(b => b.id.toUpperCase() === code || b.passengerPhone === code);

    if (!booking) {
        try {
            const query = new URLSearchParams({ bookingId: code });
            const res = await apiRequest(`/api/bookings/lookup?${query}`);
            if (res && res.booking) {
                booking = res.booking;
                if (!db.bookings) db.bookings = {};
                db.bookings[booking.id] = booking;
            }
        } catch (e) {
            console.warn("Lookup error:", e);
        }
    }

    if (!booking) {
        box.className = "p-4 rounded-xl border text-xs space-y-2 bg-red-50 border-red-300 text-red-800";
        box.innerHTML = `
            <div class="flex items-center gap-2 text-base font-black text-red-700">
                ❌ INVALID / FAKE TICKET (নকল বা অবৈধ টিকিট)
            </div>
            <p>No valid booking record matches <strong>${escapeHtml(code)}</strong> in the database. This ticket is not authentic.</p>
        `;
        return;
    }

    const isApproved = booking.status === "Approved";
    const isBoarded = Boolean(booking.boarded);

    if (!isApproved) {
        box.className = "p-4 rounded-xl border text-xs space-y-3 bg-yellow-50 border-yellow-300 text-yellow-900";
        box.innerHTML = `
            <div class="flex items-center gap-2 text-sm font-black text-yellow-800">
                ⚠️ TICKET PENDING APPROVAL (অনুমোদনের অপেক্ষায়)
            </div>
            <p>Booking found in database, but status is <strong>${escapeHtml(booking.status)}</strong>. Passenger ticket has not been approved yet.</p>
            <div class="bg-white p-3 rounded-xl border border-yellow-200 grid grid-cols-2 gap-2">
                <div><strong>Passenger:</strong> ${escapeHtml(booking.passengerName)}</div>
                <div><strong>Phone:</strong> ${escapeHtml(booking.passengerPhone)}</div>
                <div><strong>Seats:</strong> <span class="font-bold text-red-600">${escapeHtml((booking.seats || []).join(', '))}</span></div>
                <div><strong>Fare:</strong> ₹${booking.fare} (${escapeHtml(booking.paymentMode)})</div>
            </div>
            <div class="flex gap-2 pt-1">
                <button type="button" onclick="captainSetBookingStatus('${escapeHtml(booking.id)}', 'Approved')" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl font-bold text-xs shadow-sm transition">
                    ✓ Approve Ticket Now (এখনই অনুমোদন করুন)
                </button>
                <button type="button" onclick="promptCaptainReject('${escapeHtml(booking.id)}')" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-sm transition">
                    ✕ Reject
                </button>
            </div>
        `;
        return;
    }

    box.className = "p-4 rounded-xl border text-xs space-y-3 bg-green-50 border-green-300 text-green-900";
    box.innerHTML = `
        <div class="flex justify-between items-center border-b border-green-200 pb-2">
            <div class="flex items-center gap-2 text-sm font-black text-green-800">
                ✅ AUTHENTIC ORIGINAL TICKET (সঠিক আসল টিকিট)
            </div>
            <span class="px-2.5 py-0.5 rounded-full font-bold text-[10px] ${isBoarded ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">
                ${isBoarded ? '🚌 Already Boarded' : 'Awaiting Boarding'}
            </span>
        </div>
        <div class="grid grid-cols-2 gap-2 pt-1">
            <div><strong>Booking ID:</strong> <span class="font-mono font-bold text-red-700">${escapeHtml(booking.id)}</span></div>
            <div><strong>Passenger:</strong> <span class="font-bold text-gray-900">${escapeHtml(booking.passengerName)}</span></div>
            <div><strong>Phone:</strong> <a href="tel:${escapeHtml(booking.passengerPhone)}" class="text-blue-600 hover:underline font-semibold">${escapeHtml(booking.passengerPhone)}</a></div>
            <div><strong>Seats:</strong> <span class="font-black text-red-600 bg-red-100 px-2 py-0.5 rounded">${escapeHtml((booking.seats || []).join(', '))}</span></div>
            <div><strong>Route:</strong> ${escapeHtml(booking.boarding)} ➔ ${escapeHtml(booking.dropping)}</div>
            <div><strong>Date:</strong> <span class="font-semibold">${escapeHtml(booking.date)}</span></div>
            <div><strong>Total Fare:</strong> ₹${booking.fare}</div>
            <div><strong>Payment:</strong> <span class="font-semibold">${escapeHtml(booking.paymentMode)}</span></div>
        </div>

        ${!isBoarded ? `
            <button type="button" onclick="confirmPassengerBoarding('${escapeHtml(booking.id)}')" class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2">
                <span>🚌 Confirm Boarding (যাত্রী বাসে উঠলেন - কনফার্ম করুন)</span>
            </button>
        ` : `
            <div class="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 font-semibold text-center text-xs">
                ✓ Passenger is verified and already boarded on this bus.
            </div>
        `}
    `;
}

async function captainSetBookingStatus(bookingId, status, remarks = '') {
    const actionDesc = status === 'Approved' ? 'এই বুকিংটি অনুমোদন' : 'এই বুকিংটি বাতিল/রিজেক্ট';
    const ok = await showBusYatraConfirm({
        title: 'বুকিং স্ট্যাটাস পরিবর্তন',
        subtitle: `আপনি কি নিশ্চিত যে ${actionDesc} করতে চান?`,
        icon: status === 'Approved' ? '✅' : '⚠️',
        confirmText: status === 'Approved' ? 'হ্যাঁ, অনুমোদন করুন' : 'হ্যাঁ, বাতিল করুন',
        cancelText: 'বাতিল',
        danger: status !== 'Approved'
    });
    if (!ok) return;
    try {
        await apiRequest(`/api/captain/bookings/${encodeURIComponent(bookingId)}/status`, {
            method: 'POST',
            body: JSON.stringify({ status, remarks })
        });
        const db = getAppData();
        if (db.bookings && db.bookings[bookingId]) {
            db.bookings[bookingId].status = status;
            if (remarks) db.bookings[bookingId].rejectionRemarks = remarks;
        }
        alert(status === 'Approved' ? `✅ Booking ${bookingId} approved! Passenger can now download the PDF ticket.` : `⚠️ Booking ${bookingId} rejected.`);
        await loadCaptainDashboard();
        const inputVal = document.getElementById('verifyTicketInput')?.value;
        if (inputVal && inputVal.toUpperCase().includes(bookingId.toUpperCase())) {
            verifyTicketAuthenticity(bookingId);
        }
    } catch (e) {
        alert("Failed to update status: " + e.message);
    }
}

function promptCaptainReject(bookingId) {
    const remarks = prompt("Please enter the rejection reason (e.g., Seat unavailable, Route change):", "");
    if (remarks === null) return;
    captainSetBookingStatus(bookingId, 'Rejected', remarks.trim());
}

function promptCaptainCancel(bookingId, totalFare) {
    const refundStr = prompt(`বুকিং #${bookingId} বাতিলের অনুরোধ অনুমোদন করুন। যাত্রীর রিফান্ড টাকা লিখুন (মোট ভাড়া ₹${totalFare}):`, String(totalFare));
    if (refundStr === null) return;
    const refundAmount = parseFloat(refundStr) || 0;
    captainSetBookingStatus(bookingId, 'Cancelled', `Cancelled with refund ₹${refundAmount}`);
}
window.promptCaptainCancel = promptCaptainCancel;

async function confirmPassengerBoarding(bookingId) {
    try {
        await apiRequest(`/api/captain/bookings/${encodeURIComponent(bookingId)}/board`, {
            method: 'POST'
        });
        const db = getAppData();
        if (db.bookings && db.bookings[bookingId]) {
            db.bookings[bookingId].boarded = true;
        }
        alert("✅ Passenger successfully marked as Boarded!");
        verifyTicketAuthenticity(bookingId);
    } catch (e) {
        alert("Failed to update boarding status: " + e.message);
    }
}

// --- Coach Seat Layout Viewer ---
function loadCaptainSeatLayout() {
    const db = getAppData();
    if (!loggedInCaptain) return;
    const bus = db.buses.find(b => b.id === loggedInCaptain.busId);
    if (!bus) return;

    const titleEl = document.getElementById('captainBusTitle');
    if (titleEl) titleEl.innerText = `${bus.name} (${bus.busNumber})`;

    const dt = document.getElementById('seatLayoutDate')?.value || localDateStr();
    const grid = document.getElementById('captainSeatsGrid');
    if (!grid) return;
    grid.innerHTML = "";

    const bookedSeats = new Set();
    Object.values(db.bookings || {}).forEach(b => {
        if (b.busId === bus.id && b.date === dt && b.status === 'Approved') {
            if (b.seats && Array.isArray(b.seats)) {
                b.seats.forEach(s => bookedSeats.add(s));
            }
        }
    });

    const layout = (typeof getBusEffectiveSeatLayout === 'function')
        ? getBusEffectiveSeatLayout(bus)
        : generateDefaultBusSeatLayout({ totalSeats: bus.totalSeats || 65 });

    const leftCols = layout.leftCols || 2;
    const rightCols = layout.rightCols || 3;
    const totalRows = layout.totalRows || Math.ceil((bus.totalSeats || 65) / 5);
    const hasBackRow = layout.hasBackRow;

    // Group seats by row
    const rowMap = new Map();
    for (let r = 1; r <= totalRows; r++) rowMap.set(r, []);
    (layout.seats || []).forEach(s => {
        if (!rowMap.has(s.row)) rowMap.set(s.row, []);
        rowMap.get(s.row).push(s);
    });

    for (let r = 1; r <= totalRows; r++) {
        const rowSeats = rowMap.get(r) || [];
        if (rowSeats.length === 0) continue;
        const isBack = (r === totalRows && hasBackRow);

        const rowDiv = document.createElement('div');
        rowDiv.className = "flex items-center justify-center gap-1 sm:gap-2.5 bg-white px-1.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border shadow-xs mb-2 w-full max-w-[340px] mx-auto";

        if (isBack) {
            const benchGroup = document.createElement('div');
            benchGroup.className = "flex justify-center items-center gap-1 sm:gap-1.5 w-full";
            rowSeats.sort((a, b) => a.col - b.col).forEach(s => {
                if (s.active && s.type !== 'empty') {
                    const seatNum = String(s.number || s.id);
                    const isBooked = bookedSeats.has(seatNum);
                    const div = document.createElement('div');
                    div.className = `w-10 h-11 sm:w-11 sm:h-12 rounded-lg sm:rounded-xl border-2 flex flex-col items-center justify-center font-bold shrink-0 ${
                        isBooked ? 'bg-red-100 border-red-500 text-red-700' : 'bg-green-50 border-green-500 text-green-700'
                    }`;
                    div.innerHTML = `<span class="leading-none text-[9px] sm:text-[10px]">${escapeHtml(seatNum)}</span><span class="text-[7px] sm:text-[8px] font-semibold mt-0.5 leading-none">${isBooked ? 'Sold' : 'Avail'}</span>`;
                    benchGroup.appendChild(div);
                }
            });
            rowDiv.appendChild(benchGroup);
        } else {
            // Left seats
            const leftGroup = document.createElement('div');
            leftGroup.className = "flex items-center gap-1 sm:gap-1.5";
            const leftSeats = rowSeats.filter(s => s.side === 'left').sort((a, b) => a.col - b.col);
            for (let c = 1; c <= leftCols; c++) {
                const s = leftSeats.find(item => item.col === c);
                if (s && s.active && s.type !== 'empty') {
                    const seatNum = String(s.number || s.id);
                    const isBooked = bookedSeats.has(seatNum);
                    const div = document.createElement('div');
                    div.className = `w-10 h-11 sm:w-11 sm:h-12 rounded-lg sm:rounded-xl border-2 flex flex-col items-center justify-center font-bold shrink-0 ${
                        isBooked ? 'bg-red-100 border-red-500 text-red-700' : 'bg-green-50 border-green-500 text-green-700'
                    }`;
                    div.innerHTML = `<span class="leading-none text-[9px] sm:text-[10px]">${escapeHtml(seatNum)}</span><span class="text-[7px] sm:text-[8px] font-semibold mt-0.5 leading-none">${isBooked ? 'Sold' : 'Avail'}</span>`;
                    leftGroup.appendChild(div);
                } else {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = "w-10 h-11 sm:w-11 sm:h-12 shrink-0";
                    leftGroup.appendChild(emptyDiv);
                }
            }

            // Aisle
            const aisle = document.createElement('div');
            aisle.className = "w-2.5 sm:w-4 text-center text-[9px] text-gray-300 font-bold select-none shrink-0";
            aisle.innerText = "|";

            // Right seats
            const rightGroup = document.createElement('div');
            rightGroup.className = "flex items-center gap-1 sm:gap-1.5";
            const rightSeats = rowSeats.filter(s => s.side === 'right').sort((a, b) => a.col - b.col);
            for (let c = 1; c <= rightCols; c++) {
                const targetCol = leftCols + c;
                const s = rightSeats.find(item => item.col === targetCol);
                if (s && s.active && s.type !== 'empty') {
                    const seatNum = String(s.number || s.id);
                    const isBooked = bookedSeats.has(seatNum);
                    const div = document.createElement('div');
                    div.className = `w-10 h-11 sm:w-11 sm:h-12 rounded-lg sm:rounded-xl border-2 flex flex-col items-center justify-center font-bold shrink-0 ${
                        isBooked ? 'bg-red-100 border-red-500 text-red-700' : 'bg-green-50 border-green-500 text-green-700'
                    }`;
                    div.innerHTML = `<span class="leading-none text-[9px] sm:text-[10px]">${escapeHtml(seatNum)}</span><span class="text-[7px] sm:text-[8px] font-semibold mt-0.5 leading-none">${isBooked ? 'Sold' : 'Avail'}</span>`;
                    rightGroup.appendChild(div);
                } else {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = "w-10 h-11 sm:w-11 sm:h-12 shrink-0";
                    rightGroup.appendChild(emptyDiv);
                }
            }

            rowDiv.appendChild(leftGroup);
            rowDiv.appendChild(aisle);
            rowDiv.appendChild(rightGroup);
        }

        grid.appendChild(rowDiv);
    }
}

function generateTripReminderMessage(booking, bus, hoursAhead = 2) {
    const pName = booking.passengerName || 'যাত্রী';
    const bName = bus?.name || (loggedInCaptain?.name ? `${loggedInCaptain.name} Express` : 'Bus Yatra Express');
    const bNo = bus?.busNumber ? ` (${bus.busNumber})` : '';
    const origin = booking.boarding || bus?.origin || 'পিংলা';
    const dest = booking.dropping || bus?.destination || 'কলকাতা';
    const depTime = bus?.time || '07:00 AM';
    const seats = Array.isArray(booking.seats) ? booking.seats.join(', ') : (booking.seats || 'Allotted');
    const bkId = booking.id || '';
    const trackLink = `https://busyatra.pages.dev/?track=${encodeURIComponent(bkId)}`;
    const helpline = bus?.emergencyPhone || '8768447312';

    return `🚌 Bus Yatra - Trip Reminder / যাত্রার জরুরি রিমাইন্ডার

নমস্কার ${pName}! 
আপনার বাস ছাড়ার সময় আর মাত্র ${hoursAhead} ঘণ্টা বাকি।
বোর্ডিং পয়েন্টে সময়মতো উপস্থিত থাকার জন্য অনুরোধ করা হচ্ছে।

Dear ${pName},
Your bus departs in approximately ${hoursAhead} hours.
Please be present at your designated boarding point on time.

📋 Trip Details / যাত্রার বিবরণ:
• Bus / বাস: ${bName}${bNo}
• Route / রুট: ${origin} ➔ ${dest}
• Departure / ছাড়ার সময়: ${depTime}
• Boarding Stage / ওঠার জায়গা: ${origin}
• Seat(s) / আসন নং: ${seats}
• Booking ID: ${bkId}

📍 Live Bus GPS Tracking / বাসের লাইভ অবস্থান:
👉 ${trackLink}

📞 Helpline / সহায়তা: +91 ${helpline}
🌐 Bus Yatra Mobility Services • Pingla – Kolkata`;
}

// --- Passenger Manifest ---
function renderCaptainManifest() {
    const db = getAppData();
    if (!loggedInCaptain) return;
    const container = document.getElementById('captainManifestContainer');
    const dt = document.getElementById('captainManifestDate')?.value || localDateStr();
    if (!container) return;

    const isReminderEnabled = db.featureFlags?.tripReminders !== false;
    const adminNotice = document.getElementById('captainReminderAdminDisabledNotice');
    const btnWa = document.getElementById('btnCaptainSendWhatsApp');
    const btnSms = document.getElementById('btnCaptainSendNormalSms');
    const selectAllCb = document.getElementById('captainManifestSelectAll');
    if (adminNotice) adminNotice.classList.toggle('hidden', isReminderEnabled);
    if (btnWa) btnWa.disabled = !isReminderEnabled;
    if (btnSms) btnSms.disabled = !isReminderEnabled;
    if (selectAllCb) selectAllCb.disabled = !isReminderEnabled;

    const approvedBookings = Object.values(db.bookings || {}).filter(b => b.busId === loggedInCaptain.busId && b.date === dt && b.status === "Approved");
    container.innerHTML = "";
    if (selectAllCb) selectAllCb.checked = false;
    updateCaptainManifestSelection();

    if (approvedBookings.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-8 text-xs">No approved passengers found for ${dt}.</div>`;
        return;
    }

    approvedBookings.forEach(b => {
        container.innerHTML += `
            <div class="bg-gray-50 p-3 rounded-2xl border border-gray-200 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-emerald-50/30 transition">
                <div class="flex items-start gap-2.5">
                    <input type="checkbox" class="captain-manifest-cb w-4 h-4 text-emerald-600 rounded cursor-pointer mt-0.5" data-booking-id="${escapeHtml(b.id)}" onchange="updateCaptainManifestSelection()" ${!isReminderEnabled ? 'disabled' : ''}>
                    <div>
                        <div class="font-bold text-gray-900 text-sm flex items-center gap-2">
                            <span>${escapeHtml(b.passengerName)}</span>
                            <span class="text-blue-600 font-mono text-xs">(<a href="tel:${escapeHtml(b.passengerPhone)}" class="hover:underline">${escapeHtml(b.passengerPhone)}</a>)</span>
                        </div>
                        <div class="text-gray-600 mt-0.5">
                            Seats: <strong class="text-red-600 font-bold">${escapeHtml(b.seats.join(', '))}</strong> • Boarding: <strong>${escapeHtml(b.boarding)}</strong> ➔ Dropping: <strong>${escapeHtml(b.dropping)}</strong>
                        </div>
                        <div class="text-[11px] text-gray-400 font-mono mt-0.5">
                            ID: ${escapeHtml(b.id)} • ₹${b.fare} (${escapeHtml(b.paymentMode)})
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button type="button" onclick="sendCaptainSingleWhatsApp('${escapeHtml(b.id)}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs active:scale-95 ${!isReminderEnabled ? 'opacity-40 cursor-not-allowed' : ''}" ${!isReminderEnabled ? 'disabled' : ''} title="WhatsApp রিমাইন্ডার">
                        <span>🟢</span> <span>WhatsApp</span>
                    </button>
                    <button type="button" onclick="sendCaptainSingleSms('${escapeHtml(b.id)}')" class="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs active:scale-95 ${!isReminderEnabled ? 'opacity-40 cursor-not-allowed' : ''}" ${!isReminderEnabled ? 'disabled' : ''} title="নরমাল SMS পাঠান">
                        <span>💬</span> <span>SMS</span>
                    </button>
                </div>
            </div>
        `;
    });
}

function toggleCaptainManifestSelectAll(checked) {
    const cbs = document.querySelectorAll('.captain-manifest-cb');
    cbs.forEach(cb => { cb.checked = checked; });
    const topCb = document.getElementById('captainManifestSelectAll');
    if (topCb) topCb.checked = checked;
    updateCaptainManifestSelection();
}

function updateCaptainManifestSelection() {
    const checked = document.querySelectorAll('.captain-manifest-cb:checked');
    const countEl = document.getElementById('captainSelectedCount');
    if (countEl) countEl.textContent = checked.length;
}

function sendCaptainSingleWhatsApp(bookingId) {
    const db = getAppData();
    if (db.featureFlags?.tripReminders === false) {
        alert('⚠️ এই ফিচারটি বর্তমানে সুপার অ্যাডমিন দ্বারা নিষ্ক্রিয় করা আছে।');
        return;
    }
    const booking = db.bookings?.[bookingId];
    if (!booking) return;
    const bus = (db.buses || []).find(b => b.id === booking.busId) || {};
    const hoursAhead = document.getElementById('captainReminderHoursSelect')?.value || '2';
    const msg = generateTripReminderMessage(booking, bus, hoursAhead);
    const url = `https://wa.me/91${encodeURIComponent(booking.passengerPhone)}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

function sendCaptainSingleSms(bookingId) {
    const db = getAppData();
    if (db.featureFlags?.tripReminders === false) {
        alert('⚠️ এই ফিচারটি বর্তমানে সুপার অ্যাডমিন দ্বারা নিষ্ক্রিয় করা আছে।');
        return;
    }
    const booking = db.bookings?.[bookingId];
    if (!booking) return;
    const bus = (db.buses || []).find(b => b.id === booking.busId) || {};
    const hoursAhead = document.getElementById('captainReminderHoursSelect')?.value || '2';
    const msg = generateTripReminderMessage(booking, bus, hoursAhead);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? '&' : '?';
    window.location.href = `sms:${encodeURIComponent(booking.passengerPhone)}${separator}body=${encodeURIComponent(msg)}`;
}

function sendCaptainSelectedWhatsAppReminders() {
    const db = getAppData();
    if (db.featureFlags?.tripReminders === false) {
        alert('⚠️ এই ফিচারটি বর্তমানে সুপার অ্যাডমিন দ্বারা নিষ্ক্রিয় করা আছে।');
        return;
    }
    const cbs = Array.from(document.querySelectorAll('.captain-manifest-cb:checked'));
    if (cbs.length === 0) {
        alert('অনুগ্রহ করে অন্তত একজন যাত্রী নির্বাচন করুন (Please select at least 1 passenger).');
        return;
    }
    const selectedIds = cbs.map(cb => cb.getAttribute('data-booking-id'));
    const bookings = selectedIds.map(id => db.bookings?.[id]).filter(Boolean);

    if (bookings.length === 1) {
        sendCaptainSingleWhatsApp(bookings[0].id);
        return;
    }

    const modal = document.getElementById('whatsappBatchModalCaptain');
    const listEl = document.getElementById('captainBatchWhatsAppList');
    const badgeEl = document.getElementById('captainBatchModalBadge');
    if (!modal || !listEl) return;

    if (badgeEl) badgeEl.textContent = `${bookings.length} জন`;
    listEl.innerHTML = '';
    const hoursAhead = document.getElementById('captainReminderHoursSelect')?.value || '2';

    bookings.forEach((b, idx) => {
        const bus = (db.buses || []).find(bus => bus.id === b.busId) || {};
        const msg = generateTripReminderMessage(b, bus, hoursAhead);
        const waUrl = `https://wa.me/91${encodeURIComponent(b.passengerPhone)}?text=${encodeURIComponent(msg)}`;

        const card = document.createElement('div');
        card.className = "p-3 bg-gray-50 rounded-2xl border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-emerald-50/40 transition";
        card.innerHTML = `
            <div>
                <div class="font-bold text-gray-900 text-xs flex items-center gap-2">
                    <span class="text-gray-400 font-mono">${idx + 1}.</span>
                    <span>${escapeHtml(b.passengerName)}</span>
                    <span class="text-red-600 font-extrabold bg-red-50 border border-red-200 px-1.5 py-0.5 rounded text-[10px]">Seat: ${escapeHtml((b.seats || []).join(', '))}</span>
                </div>
                <div class="text-[11px] text-gray-500 mt-0.5">
                    📞 ${escapeHtml(b.passengerPhone)} • 📍 ${escapeHtml(b.boarding)} ➔ ${escapeHtml(b.dropping)}
                </div>
            </div>
            <a href="${waUrl}" target="_blank" onclick="markCaptainBatchItemSent(this)" class="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap active:scale-95">
                <span>🟢</span> <span>WhatsApp-এ পাঠান</span>
            </a>
        `;
        listEl.appendChild(card);
    });

    modal.classList.remove('hidden');
}

function markCaptainBatchItemSent(btn) {
    btn.className = "w-full sm:w-auto bg-gray-200 text-gray-700 border border-gray-300 px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap";
    btn.innerHTML = "<span>✅</span> <span>পাঠানো হয়েছে</span>";
}

function closeCaptainBatchWhatsAppModal() {
    document.getElementById('whatsappBatchModalCaptain')?.classList.add('hidden');
}

function sendCaptainSelectedNormalSmsReminders() {
    const db = getAppData();
    if (db.featureFlags?.tripReminders === false) {
        alert('⚠️ এই ফিচারটি বর্তমানে সুপার অ্যাডমিন দ্বারা নিষ্ক্রিয় করা আছে।');
        return;
    }
    const cbs = Array.from(document.querySelectorAll('.captain-manifest-cb:checked'));
    if (cbs.length === 0) {
        alert('অনুগ্রহ করে অন্তত একজন যাত্রী নির্বাচন করুন (Please select at least 1 passenger).');
        return;
    }
    const selectedIds = cbs.map(cb => cb.getAttribute('data-booking-id'));
    const bookings = selectedIds.map(id => db.bookings?.[id]).filter(Boolean);
    const phones = bookings.map(b => b.passengerPhone?.trim()).filter(Boolean);
    if (phones.length === 0) {
        alert('নির্বাচিত যাত্রীদের কোনো ফোন নম্বর পাওয়া যায়নি।');
        return;
    }

    const hoursAhead = document.getElementById('captainReminderHoursSelect')?.value || '2';
    const firstBooking = bookings[0];
    const bus = (db.buses || []).find(b => b.id === firstBooking.busId) || {};

    if (bookings.length === 1) {
        sendCaptainSingleSms(firstBooking.id);
        return;
    }

    const msg = `🚌 Bus Yatra Trip Reminder:
নমস্কার! আপনাদের বাস (${bus.name || 'Bus Yatra'}) ছাড়ার সময় আর মাত্র ${hoursAhead} ঘণ্টা বাকি। বোর্ডিং পয়েন্টে সময়মতো উপস্থিত থাকুন।
Dear Passengers, your bus departs in approx ${hoursAhead} hours. Please report to boarding point on time.
Live GPS: https://busyatra.pages.dev
Helpline: +91 ${bus.emergencyPhone || '8768447312'}`;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? '&' : '?';
    const recipientStr = phones.join(',');
    window.location.href = `sms:${encodeURIComponent(recipientStr)}${separator}body=${encodeURIComponent(msg)}`;
}

window.toggleCaptainManifestSelectAll = toggleCaptainManifestSelectAll;
window.updateCaptainManifestSelection = updateCaptainManifestSelection;
window.sendCaptainSingleWhatsApp = sendCaptainSingleWhatsApp;
window.sendCaptainSingleSms = sendCaptainSingleSms;
window.sendCaptainSelectedWhatsAppReminders = sendCaptainSelectedWhatsAppReminders;
window.sendCaptainSelectedNormalSmsReminders = sendCaptainSelectedNormalSmsReminders;
window.closeCaptainBatchWhatsAppModal = closeCaptainBatchWhatsAppModal;
window.markCaptainBatchItemSent = markCaptainBatchItemSent;

// --- Comprehensive GPS Broadcast, Leaflet Map & Stoppage Checkpoints ---
let captainGpsWatchId = null;
let captainLiveMap = null;
let captainLiveMarker = null;
let captainLiveAccuracyCircle = null;
let lastKnownLocation = { lat: 22.2742, lng: 87.5925 };
let lastAccurateLocation = null;
let lastBroadcastCoords = null;
let lastBroadcastTs = 0;

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function initCaptainLiveMap(initialLat = null, initialLng = null) {
    const mapContainer = document.getElementById('captainLiveMap');
    if (!mapContainer || typeof L === 'undefined') return;

    const lat = initialLat || lastKnownLocation.lat;
    const lng = initialLng || lastKnownLocation.lng;

    if (!captainLiveMap) {
        captainLiveMap = L.map('captainLiveMap', {
            center: [lat, lng],
            zoom: 15,
            zoomControl: false
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(captainLiveMap);

        const customIcon = L.divIcon({
            className: 'captain-bus-pin',
            html: `<div style="background:#1e40af;color:#fff;border:3px solid #facc15;border-radius:9999px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.3);font-size:18px;">🚌</div>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19]
        });

        captainLiveAccuracyCircle = L.circle([lat, lng], {
            radius: 15,
            color: '#2563eb',
            fillColor: '#60a5fa',
            fillOpacity: 0.15,
            weight: 1.5
        }).addTo(captainLiveMap);

        captainLiveMarker = L.marker([lat, lng], { icon: customIcon }).addTo(captainLiveMap);
        captainLiveMarker.bindPopup(`<strong>${escapeHtml(loggedInCaptain?.name || 'Bus Yatra')}</strong><br>লাইভ বাস অবস্থান`).openPopup();
    } else {
        captainLiveMap.invalidateSize();
        if (initialLat && initialLng) {
            captainLiveMap.setView([lat, lng], 15);
            if (captainLiveMarker) captainLiveMarker.setLatLng([lat, lng]);
            if (captainLiveAccuracyCircle) captainLiveAccuracyCircle.setLatLng([lat, lng]);
        }
    }
}

let captainWakeLock = null;
let bgAudioKeepAlive = null;

function startBackgroundAudioKeepAlive() {
    try {
        if (!bgAudioKeepAlive) {
            // Short silent WAV audio (1 second silence loop) to prevent browser background throttling
            const silentWav = "data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==";
            bgAudioKeepAlive = new Audio(silentWav);
            bgAudioKeepAlive.loop = true;
            bgAudioKeepAlive.volume = 0.01;
        }
        const promise = bgAudioKeepAlive.play();
        if (promise !== undefined) {
            promise.catch(() => {
                // Autoplay guard: resume on first user click/touch
                const unlockAudio = () => {
                    if (isGpsActive && bgAudioKeepAlive) {
                        bgAudioKeepAlive.play().catch(() => {});
                    }
                    window.removeEventListener('click', unlockAudio);
                    window.removeEventListener('touchstart', unlockAudio);
                };
                window.addEventListener('click', unlockAudio, { once: true });
                window.addEventListener('touchstart', unlockAudio, { once: true });
            });
        }

        // Register MediaSession metadata for persistent Android notification & CPU keep-alive
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: '🚌 Bus Yatra Captain: Live GPS Broadcasting',
                artist: loggedInCaptain ? (loggedInCaptain.busName || loggedInCaptain.busNumber) : 'Bus Yatra Fleet',
                album: (typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('📱 ব্যাকগ্রাউন্ডে জিপিএস ট্র্যাকিং সচল রয়েছে', '📱 Background GPS Tracking Active') : '📱 Background GPS Tracking Active'
            });
            navigator.mediaSession.playbackState = 'playing';

            navigator.mediaSession.setActionHandler('play', () => {
                if (bgAudioKeepAlive) bgAudioKeepAlive.play().catch(() => {});
                navigator.mediaSession.playbackState = 'playing';
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                // Maintain active status
                navigator.mediaSession.playbackState = 'playing';
            });
        }
    } catch (err) {
        console.warn('Background audio keep-alive setup error:', err);
    }
}

function stopBackgroundAudioKeepAlive() {
    try {
        if (bgAudioKeepAlive) {
            bgAudioKeepAlive.pause();
            bgAudioKeepAlive.currentTime = 0;
        }
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'none';
        }
    } catch (err) {}
}

async function requestCaptainWakeLock() {
    try {
        if ('wakeLock' in navigator && !captainWakeLock) {
            captainWakeLock = await navigator.wakeLock.request('screen');
            captainWakeLock.addEventListener('release', () => {
                captainWakeLock = null;
            });
        }
    } catch (e) {
        console.warn('Wake Lock not available or denied:', e);
    }
}

function releaseCaptainWakeLock() {
    try {
        if (captainWakeLock) {
            captainWakeLock.release();
            captainWakeLock = null;
        }
    } catch (e) {}
}

async function sendCaptainLocation(lat, lng, speed = 0, accuracy = 10, heading = null, stopName = '') {
    if (!loggedInCaptain) return;
    lastKnownLocation = { lat, lng };

    const coordsText = document.getElementById('captainGpsCoords');
    const speedText = document.getElementById('captainGpsSpeed');
    const accText = document.getElementById('captainGpsAccuracy');
    const timeText = document.getElementById('captainGpsTime');
    const guideBox = document.getElementById('gpsPermissionGuide');

    if (coordsText) coordsText.innerText = `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
    if (speedText) speedText.innerText = `${speed} km/h`;
    if (accText) {
        if (accuracy <= 15) {
            accText.className = "text-xs font-bold text-emerald-700";
            accText.innerText = `±${accuracy}m (স্যাটেলাইট লক 🟢)`;
        } else if (accuracy <= 40) {
            accText.className = "text-xs font-bold text-blue-700";
            accText.innerText = `±${accuracy}m (উচ্চ নির্ভুলতা 🔵)`;
        } else {
            accText.className = "text-xs font-bold text-amber-700";
            accText.innerText = `±${accuracy}m (সিগন্যাল দুর্বল ⚠️)`;
        }
    }
    if (timeText) timeText.innerText = new Date().toLocaleTimeString();
    if (guideBox) guideBox.classList.add('hidden');

    // Update Captain's local map marker & accuracy circle
    if (captainLiveMap && captainLiveMarker) {
        captainLiveMarker.setLatLng([lat, lng]);
        if (captainLiveAccuracyCircle) {
            captainLiveAccuracyCircle.setLatLng([lat, lng]);
            captainLiveAccuracyCircle.setRadius(accuracy || 10);
        }
        captainLiveMap.panTo([lat, lng]);
        if (stopName) {
            captainLiveMarker.setPopupContent(`<strong>${escapeHtml(stopName)}</strong><br>আপডেট: ${new Date().toLocaleTimeString()}`).openPopup();
        }
    }

    // Sync live GPS coordinates & telemetry via authenticated Cloudflare API (which also updates Firestore securely)
    try {
        await apiRequest('/api/captain/location', {
            method: 'POST',
            body: JSON.stringify({
                busId: loggedInCaptain.busId,
                lat: Number(lat),
                lng: Number(lng),
                speed: Number(speed || 0),
                accuracy: Number(accuracy || 10),
                heading: heading !== null && heading !== undefined ? Number(heading) : null,
                stopName: stopName || null
            })
        });
        const badge = document.getElementById('gpsStatusBadge');
        if (badge && isGpsActive) {
            badge.innerText = "🟢 GPS LIVE";
        }
    } catch (err) {
        console.warn('Location sync failed:', err);
    }
}

function handleCaptainGpsError(err) {
    const coordsText = document.getElementById('captainGpsCoords');
    const guideBox = document.getElementById('gpsPermissionGuide');
    const errorMsg = document.getElementById('gpsErrorMessage');

    console.warn('Captain GPS Geolocation Error:', err);

    if (coordsText) {
        coordsText.innerText = `❌ Error: ${err.message || 'GPS Denied'}`;
    }

    if (guideBox && errorMsg) {
        guideBox.classList.remove('hidden');
        if (err.code === 1) { // PERMISSION_DENIED
            const title = (typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('লোকেশন পারমিশন ব্লক রয়েছে:', 'Location permission blocked:') : 'Location permission blocked:';
            const desc = (typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('আপনার ব্রাউজারে লোকেশন পারমিশন বন্ধ করা আছে। যাত্রী ও মালিকের কাছে বাসের সঠিক অবস্থান পাঠাতে অ্যাড্রেস বারের তালা (Lock 🔒) আইকনে চাপুন ও Location Allow করুন।', 'Location permission is denied in browser. Please tap the lock icon in the address bar and allow location access.') : 'Location permission denied.';
            errorMsg.innerHTML = '⚠️ <strong>' + title + '</strong><br>' + desc;
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
            const title = (typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('জিপিএস সিগন্যাল পাওয়া যাচ্ছে না:', 'GPS Signal Unavailable:') : 'GPS Signal Unavailable:';
            const desc = (typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('আপনার ফোনের GPS অন আছে কিনা চেক করুন, অথবা নিচের রুট স্টপেজ বাটন ব্যবহার করুন।', 'Please check if phone GPS is turned on, or select a route stoppage below.') : 'Please check if phone GPS is turned on.';
            errorMsg.innerHTML = '⚠️ <strong>' + title + '</strong><br>' + desc;
        } else if (err.code === 3) { // TIMEOUT
            errorMsg.innerHTML = `⚠️ <strong>জিপিএস রেসপন্স টাইমআউট হয়েছে:</strong><br>পুনরায় চেষ্টা করতে নিচের বাটনে চাপুন অথবা নিচের রুট স্টপেজ সিলেক্ট করুন।`;
        } else {
            errorMsg.innerHTML = `⚠️ <strong>জিপিএস সমস্যা:</strong> ${escapeHtml(err.message || 'Error obtaining coordinates')}`;
        }
    }
}

async function startCaptainGpsTracking(forcePrompt = false) {
    if (!navigator.geolocation) {
        alert("আপনার ব্রাউজারে Geolocation সমর্থিত নয়। অনুগ্রহ করে নিচের রুট স্টপেজ অপশন ব্যবহার করুন।");
        return;
    }

    requestCaptainWakeLock();
    startBackgroundAudioKeepAlive();

    // Check permission query if supported (unless user explicitly triggered retry/toggle)
    if (!forcePrompt && navigator.permissions && navigator.permissions.query) {
        try {
            const perm = await navigator.permissions.query({ name: 'geolocation' });
            if (perm.state === 'denied') {
                handleCaptainGpsError({ code: 1, message: 'User denied Geolocation' });
                return;
            }
        } catch (e) {}
    }

    const onPosSuccess = pos => {
        const coords = pos.coords;
        const lat = coords.latitude;
        const lng = coords.longitude;
        const speed = (coords.speed !== null && coords.speed >= 0) ? Math.round(coords.speed * 3.6) : 0;
        const accuracy = Number.isFinite(coords.accuracy) ? Math.round(coords.accuracy) : 10;
        const heading = (coords.heading !== null && coords.heading >= 0) ? Math.round(coords.heading) : null;

        // --- High-Precision Filtering ---
        // 1. Cell-tower outlier rejection:
        if (lastAccurateLocation && (Date.now() - lastAccurateLocation.time < 45000)) {
            if (lastAccurateLocation.accuracy <= 30 && accuracy > 85) {
                console.warn(`[GPS Filter] Ignored inaccurate cell-tower fix: ±${accuracy}m vs accurate ±${lastAccurateLocation.accuracy}m`);
                return;
            }
        }

        // 2. High-speed jump rejection (> 300m in < 3s):
        if (lastBroadcastCoords && (Date.now() - lastBroadcastTs < 3000)) {
            const jumpMeters = calculateDistanceMeters(lastBroadcastCoords.lat, lastBroadcastCoords.lng, lat, lng);
            if (jumpMeters > 300) {
                console.warn(`[GPS Filter] Ignored impossible GPS jump: ${jumpMeters.toFixed(1)}m in <3s`);
                return;
            }
        }

        lastAccurateLocation = { lat, lng, accuracy, time: Date.now() };

        // 3. Smooth Transmission: send immediately if moved >= 2m or if >= 3.5s elapsed
        const now = Date.now();
        let shouldSend = false;
        if (!lastBroadcastCoords) {
            shouldSend = true;
        } else {
            const dist = calculateDistanceMeters(lastBroadcastCoords.lat, lastBroadcastCoords.lng, lat, lng);
            if (dist >= 2.0 || (now - lastBroadcastTs >= 3500)) {
                shouldSend = true;
            }
        }

        if (shouldSend) {
            lastBroadcastTs = now;
            lastBroadcastCoords = { lat, lng };
            sendCaptainLocation(lat, lng, speed, accuracy, heading);
        }
    };

    // Immediate initial fix with high accuracy (maximumAge: 0 enforces true satellite reading)
    navigator.geolocation.getCurrentPosition(
        onPosSuccess,
        err => {
            console.warn('Initial high-accuracy GPS check warning:', err?.message);
            if (err.code === 1) {
                handleCaptainGpsError(err);
            }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Continuous real-time GPS stream with maximum hardware precision
    if (captainGpsWatchId) navigator.geolocation.clearWatch(captainGpsWatchId);
    captainGpsWatchId = navigator.geolocation.watchPosition(
        onPosSuccess,
        err => {
            console.warn('watchPosition warning:', err);
            if (err.code === 1) {
                handleCaptainGpsError(err);
            }
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );

    // Watchdog pulse every 8s to guarantee fresh coordinates even if bus stops at traffic light
    if (captainGpsInterval) clearInterval(captainGpsInterval);
    captainGpsInterval = setInterval(() => {
        if (!isGpsActive) return;
        navigator.geolocation.getCurrentPosition(
            onPosSuccess,
            err => console.debug('Periodic GPS watchdog:', err?.message),
            { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
        );
    }, 8000);
}

// Ensure WakeLock, Background Audio & GPS stream re-activate when visibility changes or screen turns back on
document.addEventListener('visibilitychange', () => {
    if (isGpsActive) {
        requestCaptainWakeLock();
        startBackgroundAudioKeepAlive();
        if (document.visibilityState === 'visible' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => {
                    const coords = pos.coords;
                    const lat = coords.latitude;
                    const lng = coords.longitude;
                    const speed = (coords.speed !== null && coords.speed >= 0) ? Math.round(coords.speed * 3.6) : 0;
                    const accuracy = Number.isFinite(coords.accuracy) ? Math.round(coords.accuracy) : 10;
                    const heading = (coords.heading !== null && coords.heading >= 0) ? Math.round(coords.heading) : null;
                    sendCaptainLocation(lat, lng, speed, accuracy, heading);
                },
                err => console.debug('Visibility re-trigger GPS note:', err?.message),
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
            );
        }
    }
});

function stopCaptainGpsTracking() {
    if (captainGpsWatchId) {
        navigator.geolocation.clearWatch(captainGpsWatchId);
        captainGpsWatchId = null;
    }
    if (captainGpsInterval) {
        clearInterval(captainGpsInterval);
        captainGpsInterval = null;
    }
    releaseCaptainWakeLock();
    stopBackgroundAudioKeepAlive();
}

function toggleCaptainGpsBroadcast() {
    isGpsActive = !isGpsActive;
    if (isGpsActive) {
        localStorage.setItem('captain_gps_active', 'true');
        startCaptainGpsTracking(true);
    } else {
        localStorage.removeItem('captain_gps_active');
        stopCaptainGpsTracking();
    }
    updateCaptainGpsUi();
}

function updateCaptainGpsUi() {
    const lang = (typeof getPortalLanguage === 'function') ? getPortalLanguage() : 'bn';
    const pill = document.getElementById('gpsHeaderPill');
    const badge = document.getElementById('gpsStatusBadge');
    const statusText = document.getElementById('gpsSwitchStatus');
    const btn = document.getElementById('gpsToggleBtn');
    const desc = document.getElementById('gpsSwitchDesc');
    const pocketBadge = document.getElementById('pocketModeBadge');

    if (isGpsActive) {
        if (pocketBadge) pocketBadge.classList.remove('hidden');
        if (pill) pill.className = "flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-black shadow-sm transition bg-emerald-600 text-white hover:bg-emerald-700 whitespace-nowrap";
        if (badge) badge.innerText = lang === 'bn' ? "🟢 GPS চালু" : "🟢 GPS LIVE";
        if (statusText) {
            statusText.className = "text-2xl sm:text-3xl font-black text-emerald-600 flex items-center justify-center gap-2";
            statusText.innerHTML = `<span class="inline-block w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span> <span>${lang === 'bn' ? '🟢 জিপিএস ব্রডকাস্ট চালু' : '🟢 GPS BROADCAST LIVE'}</span>`;
        }
        if (desc) {
            desc.innerText = lang === 'bn'
                ? "জিপিএস সক্রিয় রয়েছে। প্রতি কয়েক সেকেন্ডে বাসের অবস্থান যাত্রী ও বাসমালিকের কাছে সরাসরি লাইভ আপডেট হচ্ছে।"
                : "GPS is active. Coach location is continuously broadcasting to passengers and fleet owner in real-time.";
        }
        if (btn) {
            btn.className = "w-full bg-red-600 hover:bg-red-700 active:scale-[0.99] text-white py-3.5 rounded-2xl font-black text-sm sm:text-base shadow-lg transition flex items-center justify-center gap-2";
            btn.innerHTML = `<span>🛑</span> <span>${lang === 'bn' ? 'জিপিএস বন্ধ করুন (Turn GPS OFF 🔴)' : 'Turn GPS OFF 🔴'}</span>`;
        }
    } else {
        if (pocketBadge) pocketBadge.classList.add('hidden');
        if (pill) pill.className = "flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-black shadow-sm transition bg-red-600 text-white hover:bg-red-700 whitespace-nowrap";
        if (badge) badge.innerText = lang === 'bn' ? "🔴 GPS বন্ধ" : "🔴 GPS OFF";
        if (statusText) {
            statusText.className = "text-2xl sm:text-3xl font-black text-red-600 flex items-center justify-center gap-2";
            statusText.innerHTML = `<span>🔴</span> <span>${lang === 'bn' ? 'জিপিএস ব্রডকাস্ট বন্ধ' : 'GPS BROADCAST OFF'}</span>`;
        }
        if (desc) {
            desc.innerText = lang === 'bn'
                ? "জিপিএস চালু করলে আপনার মোবাইল থেকে বাসের অবস্থান প্রতি কয়েক সেকেন্ডে যাত্রী ও মালিকের কাছে সরাসরি লাইভ আপডেট হবে।"
                : "Turn GPS ON to broadcast your live coach location to passengers and fleet owner.";
        }
        if (btn) {
            btn.className = "w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white py-3.5 rounded-2xl font-black text-sm sm:text-base shadow-lg transition flex items-center justify-center gap-2";
            btn.innerHTML = `<span>📡</span> <span>${lang === 'bn' ? 'লাইভ জিপিএস চালু করুন (Turn GPS ON 🟢)' : 'Turn GPS ON 🟢'}</span>`;
        }
    }
}

function retryCaptainLocationPermission() {
    const guideBox = document.getElementById('gpsPermissionGuide');
    if (guideBox) guideBox.classList.add('hidden');
    isGpsActive = true;
    localStorage.setItem('captain_gps_active', 'true');
    updateCaptainGpsUi();
    startCaptainGpsTracking(true);
}

async function broadcastCheckpoint(stopName, lat, lng) {
    if (!loggedInCaptain) {
        alert("অনুগ্রহ করে প্রথমে লগইন করুন।");
        return;
    }
    isGpsActive = true;
    localStorage.setItem('captain_gps_active', 'true');
    updateCaptainGpsUi();
    await sendCaptainLocation(lat, lng, 35, 5, stopName);
    initCaptainLiveMap(lat, lng);
    const lang = (typeof getPortalLanguage === 'function') ? getPortalLanguage() : 'bn';
    const alertMsg = lang === 'bn'
        ? `✅ বর্তমান বাস স্টপেজ সফলভাবে আপডেট হয়েছে: ${stopName}\n(যাত্রী ও মালিক এখন ম্যাপে বাসটিকে ${stopName}-এ দেখতে পাবেন)`
        : `✅ Bus stoppage updated to: ${stopName}\n(Passengers & Owner can now view the bus at ${stopName})`;
    alert(alertMsg);
}
window.broadcastCheckpoint = broadcastCheckpoint;
window.retryCaptainLocationPermission = retryCaptainLocationPermission;
window.toggleCaptainGpsBroadcast = toggleCaptainGpsBroadcast;

window.addEventListener('portal-language-change', () => {
    updateCaptainGpsUi();
    renderCaptainApprovals();
    renderCaptainManifest();
});


// --- Feedback QR Code Image Download & Poster Modal ---
function openCaptainFeedbackPosterModal() {
    const modal = document.getElementById('captainFeedbackPosterModal');
    if (modal) modal.classList.remove('hidden');
}
window.openCaptainFeedbackPosterModal = openCaptainFeedbackPosterModal;

function closeCaptainFeedbackPosterModal() {
    const modal = document.getElementById('captainFeedbackPosterModal');
    if (modal) modal.classList.add('hidden');
}
window.closeCaptainFeedbackPosterModal = closeCaptainFeedbackPosterModal;


// --- Captain Notification Modal & Real-time Fetch ---
let cachedCaptainNotifs = [];

function openCaptainNotificationModal() {
    const modal = document.getElementById('captainNotificationModal');
    if (modal) modal.classList.remove('hidden');
    loadCaptainNotifications();
}
window.openCaptainNotificationModal = openCaptainNotificationModal;

function closeCaptainNotificationModal() {
    const modal = document.getElementById('captainNotificationModal');
    if (modal) modal.classList.add('hidden');
}
window.closeCaptainNotificationModal = closeCaptainNotificationModal;

async function loadCaptainNotifications() {
    const list = document.getElementById('captainNotificationList');
    const badge = document.getElementById('captainHeaderNotifBadge');
    const sBadge = document.getElementById('captainSidebarNotifBadge');
    
    try {
        const res = await apiRequest('/api/captain/notifications');
        const notifs = res.notifications || [];
        cachedCaptainNotifs = notifs;

        [badge, sBadge].forEach(b => {
            if (b) {
                if (notifs.length > 0) {
                    b.innerText = notifs.length;
                    b.classList.remove('hidden');
                } else {
                    b.classList.add('hidden');
                }
            }
        });

        if (!list) return;
        if (!notifs.length) {
            list.innerHTML = `<div class="text-center text-gray-400 py-8 text-xs">এই মুহূর্তে কোনো নতুন নোটিফিকেশন বা বার্তা নেই।<br><span class="text-[11px] text-gray-300">(No active instructions right now)</span></div>`;
            return;
        }

        list.innerHTML = notifs.map(n => {
            const dateStr = new Date(n.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
            const typeIcon = n.type === 'alert' ? '⚠️' : '📢';
            const isOwner = n.sender_role === 'owner';
            const senderTag = isOwner 
                ? '<span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-bold">🚌 Bus Owner</span>' 
                : '<span class="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-[10px] font-bold">📢 Super Admin</span>';

            return `
            <div class="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs space-y-2 hover:border-blue-300 transition shadow-xs">
                <div class="flex items-center justify-between gap-2 border-b border-gray-200/80 pb-1.5">
                    <div class="flex items-center gap-2">
                        <span class="text-base">${typeIcon}</span>
                        <h4 class="font-bold text-gray-900 text-sm">${escapeHtml(n.title)}</h4>
                    </div>
                    ${senderTag}
                </div>
                <p class="text-gray-700 text-xs whitespace-pre-wrap leading-relaxed">${escapeHtml(n.message)}</p>
                <div class="text-[10px] text-gray-400 pt-1 flex justify-between items-center">
                    <span>🕒 ${dateStr}</span>
                    <span class="text-green-600 font-bold">● Active</span>
                </div>
            </div>`;
        }).join('');

    } catch (err) {
        if (list) list.innerHTML = `<div class="text-center text-gray-400 py-6 text-xs">নোটিফিকেশন লোড করতে সমস্যা হয়েছে।</div>`;
    }
}
window.loadCaptainNotifications = loadCaptainNotifications;

window.clearCaptainDateFilter = clearCaptainDateFilter;
window.toggleCaptainSelectAll = toggleCaptainSelectAll;
window.handleCaptainBookingCheckChange = handleCaptainBookingCheckChange;
window.captainDeleteSingleBooking = captainDeleteSingleBooking;
window.deleteCaptainSelectedBookings = deleteCaptainSelectedBookings;
window.deleteCaptainAllOnDate = deleteCaptainAllOnDate;
window.deleteCaptainManifestDateBookings = deleteCaptainManifestDateBookings;
