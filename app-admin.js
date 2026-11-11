// Bus Yatra - Super Admin Portal Script with Feature Flags & Management

window.addEventListener('DOMContentLoaded', () => {
    initializeAdminAuth();
});

function getAdminSession() {
    try {
        const raw = localStorage.getItem('admin_session') || sessionStorage.getItem('admin_session') || localStorage.getItem('portal_session_admin') || sessionStorage.getItem('portal_session_admin');
        if (!raw) return null;
        const session = JSON.parse(raw);
        if (session && session.token) {
            const str = JSON.stringify(session);
            localStorage.setItem('admin_session', str);
            sessionStorage.setItem('admin_session', str);
            localStorage.setItem('portal_session_admin', str);
            sessionStorage.setItem('portal_session_admin', str);
            return session;
        }
        return null;
    } catch {
        return null;
    }
}

function showAdminAuthView(view) {
    ['pinLoginView', 'pinSetupView', 'pinForgotView'].forEach(id => {
        document.getElementById(id)?.classList.toggle('hidden', id !== view);
    });
    document.getElementById('authError')?.classList.add('hidden');
    document.getElementById('authSuccess')?.classList.add('hidden');
}

async function initializeAdminAuth() {
    const session = getAdminSession();
    if (!session) {
        document.getElementById('adminProtectedApp')?.classList.add('hidden');
        document.getElementById('adminAuthModal')?.classList.remove('hidden');
        showLoginView();
        return;
    }
    document.getElementById('adminAuthModal')?.classList.add('hidden');
    document.getElementById('adminProtectedApp')?.classList.remove('hidden');
    await loadAdminDashboard();
}

function showAdminAuthError(message) {
    const errorEl = document.getElementById('authError');
    const successEl = document.getElementById('authSuccess');
    if (successEl) successEl.classList.add('hidden');
    if (!errorEl) return;
    errorEl.innerText = message;
    errorEl.classList.remove('hidden');
}

function showAdminAuthSuccess(message) {
    const errorEl = document.getElementById('authError');
    const successEl = document.getElementById('authSuccess');
    if (errorEl) errorEl.classList.add('hidden');
    if (!successEl) return;
    successEl.innerText = message;
    successEl.classList.remove('hidden');
}

function showLoginView() {
    document.getElementById('authTitle').innerText = 'Admin Secure Login';
    document.getElementById('authDesc').innerText = 'Enter your 4-digit PIN or password to access dashboard.';
    showAdminAuthView('pinLoginView');
}

function showOtpSetupView() {
    document.getElementById('authTitle').innerText = 'First-time Super Admin Setup';
    document.getElementById('authDesc').innerText = 'Send OTP to support.busyatra@gmail.com to configure PIN & security question.';
    showAdminAuthView('pinSetupView');
}

async function showForgotPinView() {
    document.getElementById('authTitle').innerText = 'Reset Admin PIN / Password';
    document.getElementById('authDesc').innerText = 'Recover using your security question or Email OTP.';
    try {
        const result = await apiRequest('/api/auth/admin/status');
        if (result && result.securityQuestion) {
            document.getElementById('forgotQuestionPrompt').innerText = result.securityQuestion;
        }
    } catch {
        // fallback
    }
    switchForgotTab('question');
    showAdminAuthView('pinForgotView');
}

function switchForgotTab(tab) {
    const isQ = tab === 'question';
    document.getElementById('forgotQuestionSection')?.classList.toggle('hidden', !isQ);
    document.getElementById('forgotOtpSection')?.classList.toggle('hidden', isQ);
    
    const btnQ = document.getElementById('tabForgotQuestion');
    const btnO = document.getElementById('tabForgotOtp');
    if (btnQ && btnO) {
        if (isQ) {
            btnQ.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold bg-white text-gray-900 shadow-sm transition';
            btnO.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:text-gray-900 transition';
        } else {
            btnO.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold bg-white text-gray-900 shadow-sm transition';
            btnQ.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:text-gray-900 transition';
        }
    }
    document.getElementById('authError')?.classList.add('hidden');
    document.getElementById('authSuccess')?.classList.add('hidden');
}
window.switchForgotTab = switchForgotTab;

async function requestSetupOtp() {
    const btn = document.getElementById('sendSetupOtpBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Sending...';
    }
    try {
        const res = await apiRequest('/api/auth/send-otp', {
            method: 'POST',
            body: JSON.stringify({ role: 'admin', purpose: 'admin_setup' })
        });
        showAdminAuthSuccess(res.message || 'ওটিপি support.busyatra@gmail.com এ পাঠানো হয়েছে!');
        startCooldown(btn, 'Send OTP');
    } catch (err) {
        showAdminAuthError(err.message);
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Send OTP';
        }
    }
}

async function submitOtpSetup() {
    const otp = (document.getElementById('setupOtp')?.value || '').trim();
    const question = (document.getElementById('setupQuestionSelect')?.value || '').trim();
    const answer = (document.getElementById('setupAnswer')?.value || '').trim();
    const pin = (document.getElementById('setupPin')?.value || '').trim();

    if (!otp || otp.length !== 6) {
        showAdminAuthError('৬-সংখ্যার ইমেইল ওটিপি কোড লিখুন (Enter 6-digit OTP).');
        return;
    }
    if (!answer || answer.length < 2) {
        showAdminAuthError(window.t('সিকিউরিটি উত্তর লিখুন।', 'Enter security answer.'));
        return;
    }
    if (!pin || pin.length < 4) {
        showAdminAuthError('কমপক্ষে ৪-সংখ্যার পিন লিখুন (Enter at least 4-digit PIN).');
        return;
    }

    try {
        const result = await apiRequest('/api/auth/admin/otp-setup', {
            method: 'POST',
            body: JSON.stringify({ otp, pin, securityQuestion: question, securityAnswer: answer })
        });
        await completeAdminLogin(result);
        alert('🎉 অভিনন্দন! আপনার সুপার অ্যাডমিন পিন ও সিকিউরিটি সেটআপ সফলভাবে সম্পন্ন হয়েছে!');
    } catch (err) {
        showAdminAuthError(err.message);
    }
}

async function requestForgotOtp() {
    const btn = document.getElementById('sendForgotOtpBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Sending...';
    }
    try {
        const res = await apiRequest('/api/auth/send-otp', {
            method: 'POST',
            body: JSON.stringify({ role: 'admin', purpose: 'admin_reset' })
        });
        showAdminAuthSuccess(res.message || 'ওটিপি support.busyatra@gmail.com এ পাঠানো হয়েছে!');
        startCooldown(btn, 'Send OTP');
    } catch (err) {
        showAdminAuthError(err.message);
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Send OTP';
        }
    }
}

async function submitForgotOtpReset() {
    const otp = (document.getElementById('forgotOtp')?.value || '').trim();
    const pin = (document.getElementById('forgotOtpNewPin')?.value || '').trim();

    if (!otp || otp.length !== 6) {
        showAdminAuthError('৬-সংখ্যার ইমেইল ওটিপি কোড লিখুন (Enter 6-digit OTP).');
        return;
    }
    if (!pin || pin.length < 4) {
        showAdminAuthError('কমপক্ষে ৪-সংখ্যার নতুন পিন লিখুন (Enter at least 4-digit PIN).');
        return;
    }

    try {
        const result = await apiRequest('/api/auth/admin/reset-by-otp', {
            method: 'POST',
            body: JSON.stringify({ otp, pin })
        });
        await completeAdminLogin(result);
        alert('✅ আপনার অ্যাডমিন পিন সফলভাবে পরিবর্তন ও লগইন সম্পন্ন হয়েছে!');
    } catch (err) {
        showAdminAuthError(err.message);
    }
}

function startCooldown(buttonEl, originalText) {
    if (!buttonEl) return;
    let seconds = 60;
    buttonEl.disabled = true;
    const interval = setInterval(() => {
        seconds -= 1;
        if (seconds <= 0) {
            clearInterval(interval);
            buttonEl.disabled = false;
            buttonEl.innerText = originalText;
        } else {
            buttonEl.innerText = `${seconds}s`;
        }
    }, 1000);
}

function toggleAdminPinVisibility() {
    const input = document.getElementById('loginPin');
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
}

async function submitPinLogin() {
    const userInput = (document.getElementById('adminLoginUser')?.value || '').trim();
    const pin = (document.getElementById('loginPin')?.value || '').trim();
    if (!userInput) {
        showAdminAuthError(window.t('অ্যাডমিন ইউজারনেম বা ইমেইল দিন।', 'Enter admin email.'));
        return;
    }
    if (!pin || pin.length < 4) {
        showAdminAuthError('৪-সংখ্যার পিন বা পাসওয়ার্ড লিখুন (Enter 4-digit PIN).');
        return;
    }
    const identifier = userInput;
    try {
        const result = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'admin', identifier, pin })
        });
        await completeAdminLogin(result);
    } catch (error) {
        showAdminAuthError(error.message);
    }
}

async function submitPinReset() {
    const answer = document.getElementById('forgotAnswer').value.trim();
    const pin = document.getElementById('newResetPin').value.trim();
    if (!answer) {
        showAdminAuthError(window.t('সিকিউরিটি উত্তর দিন।', 'Enter recovery answer.'));
        return;
    }
    if (!pin || pin.length < 4) {
        showAdminAuthError('নতুন পিন কমপক্ষে ৪ অক্ষরের হতে হবে (PIN must be at least 4 characters).');
        return;
    }
    try {
        const result = await apiRequest('/api/auth/admin/reset', {
            method: 'POST',
            body: JSON.stringify({ answer, pin })
        });
        await completeAdminLogin(result);
        alert('✅ আপনার অ্যাডমিন পাসওয়ার্ড সফলভাবে রিসেট ও লগইন সম্পন্ন হয়েছে!');
    } catch (error) {
        showAdminAuthError(error.message);
    }
}

function openChangePasswordModal() {
    const currentPass = document.getElementById('currentAdminPass');
    const newPass = document.getElementById('newAdminPass');
    const confirmPass = document.getElementById('confirmAdminPass');
    const question = document.getElementById('adminSecQuestion');
    const answer = document.getElementById('adminSecAnswer');
    if (currentPass) currentPass.value = '';
    if (newPass) newPass.value = '';
    if (confirmPass) confirmPass.value = '';
    if (question) question.value = '';
    if (answer) answer.value = '';
    document.getElementById('changePasswordError')?.classList.add('hidden');
    document.getElementById('changePasswordSuccess')?.classList.add('hidden');
    document.getElementById('changePasswordModal')?.classList.remove('hidden');
}

function closeChangePasswordModal() {
    document.getElementById('changePasswordModal')?.classList.add('hidden');
}

function togglePassVisibility(id) {
    const el = document.getElementById(id);
    if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

async function submitChangeAdminPassword() {
    const currentPassword = document.getElementById('currentAdminPass')?.value.trim();
    const newPassword = document.getElementById('newAdminPass')?.value.trim();
    const confirmPassword = document.getElementById('confirmAdminPass')?.value.trim();
    const securityQuestion = document.getElementById('adminSecQuestion')?.value.trim();
    const securityAnswer = document.getElementById('adminSecAnswer')?.value.trim();
    const errEl = document.getElementById('changePasswordError');
    const succEl = document.getElementById('changePasswordSuccess');

    if (errEl) errEl.classList.add('hidden');
    if (succEl) succEl.classList.add('hidden');

    if (!currentPassword) {
        if (errEl) {
            errEl.innerText = window.t('বর্তমান পাসওয়ার্ড লিখুন।', 'Enter current password.');
            errEl.classList.remove('hidden');
        }
        return;
    }
    if (!newPassword || newPassword.length < 6) {
        if (errEl) {
            errEl.innerText = 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে (New password must be at least 6 characters).';
            errEl.classList.remove('hidden');
        }
        return;
    }
    if (newPassword !== confirmPassword) {
        if (errEl) {
            errEl.innerText = window.t('নতুন পাসওয়ার্ড দুটি মিলছে না।', 'Passwords do not match.');
            errEl.classList.remove('hidden');
        }
        return;
    }

    try {
        const res = await apiRequest('/api/admin/change-password', {
            method: 'POST',
            body: JSON.stringify({
                currentPassword,
                newPassword,
                securityQuestion: securityQuestion || undefined,
                securityAnswer: securityAnswer || undefined
            })
        });
        if (succEl) {
            succEl.innerText = res.message || '✅ পাসওয়ার্ড সফলভাবে আপডেট হয়েছে!';
            succEl.classList.remove('hidden');
        }
        setTimeout(() => {
            closeChangePasswordModal();
            alert('✅ আপনার অ্যাডমিন পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে! পরবর্তীতে এই নতুন পাসওয়ার্ড দিয়ে লগইন করবেন।');
        }, 1000);
    } catch (err) {
        if (errEl) {
            errEl.innerText = err.message || 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।';
            errEl.classList.remove('hidden');
        }
    }
}

async function completeAdminLogin(result) {
    const sessionData = JSON.stringify({
        token: result.token,
        expiresAt: result.expiresAt
    });
    localStorage.setItem('admin_session', sessionData);
    sessionStorage.setItem('admin_session', sessionData);
    localStorage.setItem('portal_session_admin', sessionData);
    sessionStorage.setItem('portal_session_admin', sessionData);
    document.getElementById('adminAuthModal')?.classList.add('hidden');
    document.getElementById('adminProtectedApp')?.classList.remove('hidden');
    await loadAdminDashboard();
}

async function adminLogout() {
    const ok = await showBusYatraConfirm({
        title: "অ্যাডমিন প্যানেল থেকে লগআউট?",
        subtitle: "আপনি কি নিশ্চিতভাবে সুপার অ্যাডমিন ড্যাশবোর্ড থেকে লগআউট করতে চান?",
        icon: 'logout',
        confirmText: "হ্যাঁ, লগআউট",
        cancelText: "না, ফিরে যান",
        danger: true
    });
    if (!ok) return;

    const session = getAdminSession();
    if (session?.token) {
        try {
            await apiRequest('/api/auth/logout', {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.token}` }
            });
        } catch (error) {
            console.warn('Admin logout failed:', error);
        }
    }
    localStorage.removeItem('admin_session');
    sessionStorage.removeItem('admin_session');
    localStorage.removeItem('portal_session_admin');
    sessionStorage.removeItem('portal_session_admin');
    document.getElementById('adminProtectedApp')?.classList.add('hidden');
    document.getElementById('adminAuthModal')?.classList.remove('hidden');
    showLoginView();
}

async function loadAdminDashboard() {
    // 0. Instant Optimistic & Offline Render from saved Admin snapshot (< 5ms)
    const snap = typeof loadPortalOfflineSnapshot === 'function'
        ? loadPortalOfflineSnapshot('busyatra_offline_admin_state_v1')
        : null;
    if (snap && (snap.buses?.length || Object.keys(snap.bookings || {}).length)) {
        setAppData(snap);
    }
    const cachedData = getAppData();
    const hasCachedOfflineData = Boolean(
        cachedData && (
            (cachedData.buses && cachedData.buses.length > 0) ||
            Object.keys(cachedData.bookings || {}).length > 0
        )
    );
    if (hasCachedOfflineData) {
        try {
            loadAdminStats();
            loadAdminBuses();
            renderAdminCustomersList();
            renderAdminOwnersList();
            updateFeedbackBadges();
        } catch (_) {}
    }

    try {
        const data = await apiRequest('/api/admin/state');
        setAppData(data);
        if (typeof savePortalOfflineSnapshot === 'function') {
            savePortalOfflineSnapshot('busyatra_offline_admin_state_v1', data);
        }
        loadAdminStats();
        loadAdminBuses();
        renderAdminCustomersList();
        loadAdminCustomersData();
        renderAdminOwnersList();
        loadAdminOwnersData();
        loadAdminCaptainsData();
        loadAdminOwnerRequests();
        loadAdminPendingBusApprovals();
        loadAdminPendingPhotoApprovals();
        renderAdminCouponsList();
        renderAdminFeatureFlags();
        renderAdminExpansionSettings();
        if (data.promotions) {
            adminPromotionsCache = data.promotions;
            renderAdminPromotionsList(data.promotions);
            updateAdminPromoStats(data.promotions);
        }
        updateFeedbackBadges();
        loadAdminSupportTickets(true);
        checkAdminSosBadge();
        if (!document.querySelector('#adminStoppagesContainer .stoppage-schedule-row')) {
            resetAdminForm();
        }

        // Restore active tab across page refresh / reload
        const savedTab = sessionStorage.getItem('admin_active_tab') || (window.location.hash ? window.location.hash.replace('#', '') : null);
        const isMobile = window.innerWidth < 768;
        if (isMobile && (!savedTab || savedTab === 'home')) {
            returnToAdminMobileHome();
        } else if (savedTab && ['buses', 'customers', 'owners', 'subscriptions', 'requests', 'feedback', 'finance', 'coupons', 'promotions', 'nextgen', 'flags', 'notifications', 'devices', 'support', 'sos'].includes(savedTab)) {
            switchAdminTab(savedTab);
        } else if (!isMobile) {
            switchAdminTab('buses');
        }
    } catch (error) {
        console.error('Failed to load admin dashboard:', error);
        if (error.status === 401) {
            localStorage.removeItem('admin_session');
            sessionStorage.removeItem('admin_session');
            document.getElementById('adminProtectedApp')?.classList.add('hidden');
            document.getElementById('adminAuthModal')?.classList.remove('hidden');
            showLoginView();
            return;
        }
        if (!hasCachedOfflineData && navigator.onLine !== false) {
            alert(`Failed to load admin data from the server: ${error.message}`);
        }
    }
}

// --- Mobile Navigation & App Hub Functions ---
function returnToAdminMobileHome() {
    sessionStorage.setItem('admin_active_tab', 'home');
    const tabs = ['buses', 'customers', 'owners', 'subscriptions', 'requests', 'feedback', 'finance', 'coupons', 'promotions', 'nextgen', 'flags', 'notifications', 'devices', 'support', 'sos'];
    tabs.forEach(t => {
        const content = document.getElementById(`tab${capitalize(t)}Content`);
        if (content) content.classList.add('hidden');
    });

    const hubGrid = document.getElementById('adminMobileHubGrid');
    if (hubGrid) hubGrid.classList.remove('hidden');

    const backBar = document.getElementById('adminMobileTopBackBar');
    if (backBar) backBar.classList.add('hidden');

    updateAdminNavHighlight('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.returnToAdminMobileHome = returnToAdminMobileHome;

function updateAdminNavHighlight(activeItem) {
    const navItems = {
        home: document.getElementById('adminNavBtnHome'),
        buses: document.getElementById('adminNavBtnFleet'),
        customers: document.getElementById('adminNavBtnBookings'),
        apps: document.getElementById('adminNavBtnApps')
    };
    Object.keys(navItems).forEach(key => {
        const el = navItems[key];
        if (!el) return;
        if (key === activeItem) {
            el.className = "flex flex-col items-center text-red-600 active:scale-90 transition-all cursor-pointer py-1 px-2 rounded-xl";
            const label = el.querySelector('span:last-child');
            if (label) label.className = "text-[10px] font-black mt-1";
        } else {
            el.className = "flex flex-col items-center text-gray-500 hover:text-gray-900 active:scale-90 transition-all cursor-pointer py-1 px-2 rounded-xl";
            const label = el.querySelector('span:last-child');
            if (label) label.className = "text-[10px] font-bold mt-1";
        }
    });
}
window.updateAdminNavHighlight = updateAdminNavHighlight;

// --- Tabs Navigation ---
function switchAdminTab(tab) {
    sessionStorage.setItem('admin_active_tab', tab);
    const tabs = ['buses', 'customers', 'owners', 'subscriptions', 'requests', 'feedback', 'finance', 'coupons', 'promotions', 'nextgen', 'flags', 'notifications', 'devices', 'support', 'sos'];
    tabs.forEach(t => {
        const content = document.getElementById(`tab${capitalize(t)}Content`);
        const btn = document.getElementById(`tab${capitalize(t)}Btn`);
        if (content) content.classList.add('hidden');
        if (btn) btn.className = "shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition whitespace-nowrap";
    });

    const activeContent = document.getElementById(`tab${capitalize(tab)}Content`);
    const activeBtn = document.getElementById(`tab${capitalize(tab)}Btn`);
    if (activeContent) activeContent.classList.remove('hidden');
    if (activeBtn) {
        activeBtn.className = "shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600 text-white shadow-md transition whitespace-nowrap";
        try {
            const scrollParent = activeBtn.parentElement;
            if (scrollParent) {
                const btnLeft = activeBtn.offsetLeft;
                const btnWidth = activeBtn.offsetWidth;
                const parentWidth = scrollParent.clientWidth;
                scrollParent.scrollLeft = btnLeft - (parentWidth / 2) + (btnWidth / 2);
            }
        } catch (_) {}
    }

    // Handle Mobile Hub & Back Bar
    const isMobile = window.innerWidth < 768;
    const hubGrid = document.getElementById('adminMobileHubGrid');
    const backBar = document.getElementById('adminMobileTopBackBar');
    const tabTitleEl = document.getElementById('adminMobileActiveTabTitle');

    if (isMobile) {
        if (hubGrid) hubGrid.classList.add('hidden');
        if (backBar) backBar.classList.remove('hidden');
        if (tabTitleEl) {
            const tabTitlesBn = {
                buses: '🚌 বাস ফ্লিট ও রুট',
                customers: '🎫 বুকিংস ও টিকিট',
                owners: '👥 বাস অপারেটর',
                subscriptions: '💳 সাবস্ক্রিপশন ও বিলিং',
                requests: '📝 মালিকদের রিকুয়েস্ট',
                feedback: '⭐ যাত্রী ফিডব্যাক',
                finance: '💰 আয় ও ফাইন্যান্স',
                coupons: '🏷️ প্রোমো কোড ও কুপন',
                promotions: '🎯 বিজ্ঞাপন ও প্রমোশন',
                nextgen: '⚡ নেক্সট-জেন ফিচার',
                flags: '⚙️ ফিচার টগলস',
                notifications: '📢 ব্রডকাস্ট নোটিশ',
                devices: '📱 ডিভাইস সিকিউরিটি',
                support: '🤖 এআই সাপোর্ট ডেস্ক',
                sos: '🚨 জরুরি SOS ডেস্ক'
            };
            const tabTitlesEn = {
                buses: '🚌 Fleet & Routes',
                customers: '🎫 Bookings & Tickets',
                owners: '👥 Bus Operators',
                subscriptions: '💳 Subscriptions & Billing',
                requests: '📝 Approvals & Requests',
                feedback: '⭐ Customer Feedback',
                finance: '💰 Finance & Reports',
                coupons: '🏷️ Coupons & Promos',
                promotions: '🎯 Ads & Promotions',
                nextgen: '⚡ Next-Gen Features',
                flags: '⚙️ Feature Toggles',
                notifications: '📢 Broadcast Notices',
                devices: '📱 Devices & Security',
                support: '🤖 AI Support Desk',
                sos: '🚨 Emergency SOS Desk'
            };
            const bnT = tabTitlesBn[tab] || capitalize(tab);
            const enT = tabTitlesEn[tab] || capitalize(tab);
            tabTitleEl.setAttribute('data-bn', bnT);
            tabTitleEl.setAttribute('data-en', enT);
            tabTitleEl.innerText = window.t(bnT, enT);
        }
        updateAdminNavHighlight(tab === 'buses' ? 'buses' : (tab === 'customers' ? 'customers' : ''));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        if (hubGrid) hubGrid.classList.add('hidden');
        if (backBar) backBar.classList.add('hidden');
    }

    if (tab === 'buses') {
        loadAdminBuses();
        loadAdminStats();
    } else if (tab === 'customers') {
        renderAdminCustomersList();
        loadAdminCustomersData();
    } else if (tab === 'owners') {
        renderAdminOwnersList();
        loadAdminOwnersData();
        loadAdminCaptainsData();
    } else if (tab === 'subscriptions') {
        loadAdminSubscriptions();
    } else if (tab === 'requests') {
        loadAdminOwnerRequests();
    } else if (tab === 'feedback') {
        loadAdminFeedback();
    } else if (tab === 'finance') {
        loadAdminFinanceData();
    } else if (tab === 'coupons') {
        renderAdminCouponsList();
    } else if (tab === 'promotions') {
        loadAdminPromotions();
    } else if (tab === 'nextgen') {
        loadAdminNextGenData();
    } else if (tab === 'flags') {
        renderAdminFeatureFlags();
        renderAdminExpansionSettings();
    } else if (tab === 'notifications') {
        loadAdminNotifications();
        loadAdminEmailRecipients();
    } else if (tab === 'devices') {
        loadAdminDevicesData();
    } else if (tab === 'support') {
        loadAdminSupportTickets();
        clearInterval(adminSupportPollTimer);
        adminSupportPollTimer = setInterval(() => {
            const content = document.getElementById('tabSupportContent');
            if (content && !content.classList.contains('hidden')) {
                loadAdminSupportTickets(true);
            } else {
                clearInterval(adminSupportPollTimer);
            }
        }, 15000);
    } else if (tab === 'sos') {
        loadAdminSosAlerts();
        clearInterval(adminSosPollTimer);
        adminSosPollTimer = setInterval(() => {
            const content = document.getElementById('tabSosContent');
            if (content && !content.classList.contains('hidden')) {
                loadAdminSosAlerts(true);
            } else {
                clearInterval(adminSosPollTimer);
            }
        }, 12000);
    }
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Stats & Buses Fleet ---
function loadAdminStats() {
    const db = getAppData();
    const bookings = Object.values(db.bookings || {});
    document.getElementById('statTotalBookings').innerText = bookings.length;
    document.getElementById('statActiveBuses').innerText = (db.buses || []).length;
    const totalRev = bookings.filter(b => b.status === "Approved").reduce((sum, b) => sum + (b.fare || 0), 0);
    document.getElementById('statRevenue').innerText = "₹" + totalRev;
}

let adminBusSearchQuery = '';

function filterAdminBusesList(query) {
    adminBusSearchQuery = (query || '').trim().toLowerCase();
    const clearBtn = document.getElementById('adminBusSearchClearBtn');
    if (clearBtn) {
        if (adminBusSearchQuery) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    }
    loadAdminBuses();
}
window.filterAdminBusesList = filterAdminBusesList;

function clearAdminBusSearch() {
    adminBusSearchQuery = '';
    const input = document.getElementById('adminBusSearchInput');
    if (input) input.value = '';
    const clearBtn = document.getElementById('adminBusSearchClearBtn');
    if (clearBtn) clearBtn.classList.add('hidden');
    loadAdminBuses();
}
window.clearAdminBusSearch = clearAdminBusSearch;

function loadAdminBuses() {
    const db = getAppData();
    const container = document.getElementById('adminBusesList');
    if (!container) return;

    container.innerHTML = "";
    const allBuses = db.buses || [];
    const totalCount = allBuses.length;

    let buses = allBuses;
    if (adminBusSearchQuery) {
        const q = adminBusSearchQuery;
        buses = allBuses.filter(b => {
            const name = (b.name || '').toLowerCase();
            const busNumber = (b.busNumber || '').toLowerCase();
            const cleanNumber = busNumber.replace(/[^a-z0-9]/g, '');
            const cleanQ = q.replace(/[^a-z0-9]/g, '');
            const company = (b.companyName || '').toLowerCase();
            const owner = (b.ownerName || '').toLowerCase();
            const phone = (b.ownerPhone || '').toLowerCase();
            const driver = (b.driverName || '').toLowerCase();
            const driverPhone = (b.driverPhone || '').toLowerCase();
            const route = (b.route || '').toLowerCase();
            const returnRoute = (b.returnRoute || '').toLowerCase();
            const gst = (b.gstNumber || '').toLowerCase();
            const upi = (b.upiId || '').toLowerCase();

            return name.includes(q) ||
                busNumber.includes(q) ||
                (cleanQ && cleanNumber.includes(cleanQ)) ||
                company.includes(q) ||
                owner.includes(q) ||
                phone.includes(q) ||
                driver.includes(q) ||
                driverPhone.includes(q) ||
                route.includes(q) ||
                returnRoute.includes(q) ||
                gst.includes(q) ||
                upi.includes(q);
        });
    }

    const badge = document.getElementById('adminFleetCountBadge');
    if (badge) {
        badge.innerText = adminBusSearchQuery ? `${buses.length}/${totalCount}` : `${totalCount}`;
    }

    if (buses.length === 0) {
        if (adminBusSearchQuery) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <p class="text-2xl mb-1">🔍</p>
                    <p class="font-bold text-sm text-gray-700">"${escapeHtml(adminBusSearchQuery)}" দিয়ে কোনো বাস পাওয়া যায়নি</p>
                    <p class="text-xs text-gray-400 mt-1">দয়া করে বাসের নাম, রেজিস্ট্রেশন নম্বর বা রুট পরীক্ষা করুন।</p>
                    <button type="button" onclick="clearAdminBusSearch()" class="mt-3 text-xs text-red-600 hover:text-red-700 font-bold underline">সব বাস পুনরায় দেখান</button>
                </div>`;
        } else {
            container.innerHTML = `<div class="text-center text-gray-400 py-6 text-xs">No buses registered yet.</div>`;
        }
        return;
    }

    buses.forEach(b => {
        const serviceDate = (db.serviceDates || []).find(item => item.busId === b.id && item.date === localDateStr());
        const serviceIsEnabled = serviceDate ? serviceDate.enabled : true;
        const currentRating = Number(b.rating !== undefined && b.rating !== null ? b.rating : 4.8).toFixed(1);
        const bookingMode = b.bookingMode || 'active';
        const modeBadgeClass = bookingMode === 'auto_pilot' ? 'bg-purple-100 text-purple-800' : (bookingMode === 'inactive' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800');
        const modeLabel = bookingMode === 'auto_pilot' ? '🚀 Auto-Pilot' : (bookingMode === 'inactive' ? '⛔ Inactive' : '🟢 Active');

        // Approval Status Badge & Quick Actions
        const approvalStatus = b.approvalStatus || 'approved';
        let approvalBadge = '';
        let approvalButtons = '';
        if (approvalStatus === 'pending') {
            approvalBadge = `<span class="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded text-xs flex items-center gap-1">🟡 পেন্ডিং অনুমোদন</span>`;
            approvalButtons = `
                <button type="button" onclick="approveBus('${escapeHtml(b.id)}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm transition flex items-center gap-1 text-xs">
                    ✅ Approve
                </button>
                <button type="button" onclick="rejectBus('${escapeHtml(b.id)}')" class="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm transition flex items-center gap-1 text-xs">
                    ❌ Reject
                </button>
            `;
        } else if (approvalStatus === 'rejected') {
            approvalBadge = `<span class="bg-rose-100 text-rose-900 border border-rose-300 font-bold px-2 py-0.5 rounded text-xs flex items-center gap-1" title="${escapeHtml(b.rejectionReason || '')}">🔴 ${window.t('বাতিল করা হয়েছে', 'Rejected')}</span>`;
            approvalButtons = `
                <button type="button" onclick="approveBus('${escapeHtml(b.id)}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm transition flex items-center gap-1 text-xs">
                    ✅ Re-Approve
                </button>
            `;
        } else {
            approvalBadge = `<span class="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded text-xs flex items-center gap-1">🟢 ${window.t('লাইভ', 'Live')}</span>`;
        }

        // Return Trip Information
        const returnInfo = b.returnRouteEnabled
            ? `<div class="text-blue-700 font-semibold bg-blue-50/80 border border-blue-200 px-2.5 py-1 rounded-lg inline-flex flex-wrap items-center gap-1.5 mt-1">🔄 ${window.t('ফিরতি ট্রিপ:', 'Return Trip:')} ${escapeHtml(b.returnRoute || 'Return')} • ${window.t('সময়:', 'Time:')} ${escapeHtml(b.returnTime || 'N/A')} • ${window.t('ভাড়া:', 'Fare:')} ₹${b.returnFare !== undefined ? b.returnFare : b.fare}</div>`
            : '';

        container.innerHTML += `
            <div class="bg-gray-50 hover:bg-gray-100/70 p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs transition">
                <div class="space-y-1">
                    <div class="font-bold text-gray-900 text-sm flex items-center flex-wrap gap-2">
                        <span>${escapeHtml(b.name)} (${escapeHtml(b.busNumber)})</span>
                        ${b.companyName ? `<span class="text-xs font-semibold text-gray-600">• ${escapeHtml(b.companyName)}</span>` : ''}
                        <span class="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-xs flex items-center gap-1">⭐ ${currentRating}</span>
                        <span class="${modeBadgeClass} font-bold px-2 py-0.5 rounded text-xs">${modeLabel}</span>
                        ${approvalBadge}
                    </div>
                    <div>
                        <strong>Operator:</strong> ${escapeHtml(b.ownerName)} (<a href="tel:${escapeHtml(b.ownerPhone)}" class="text-blue-600 font-medium">${escapeHtml(b.ownerPhone || 'N/A')}</a>) • 
                        <strong>Route:</strong> ${escapeHtml(b.route)} • 
                        <strong>Time:</strong> ${escapeHtml(b.time || 'N/A')} • 
                        <strong>Today:</strong> ${serviceIsEnabled ? '🟢 Service enabled' : '🔴 Service disabled'} • 
                        <strong>Fare:</strong> ₹${b.fare}
                    </div>
                    <div class="text-gray-500">
                        GSTIN: <span class="font-mono font-semibold">${escapeHtml(b.gstNumber || 'Not provided')}</span> • 
                        UPI: <span class="font-mono font-semibold text-purple-700">${escapeHtml(b.upiId || 'N/A')}</span> • 
                        Total Seats: ${b.totalSeats || 65} • Photos: ${b.images ? b.images.length : 1}
                    </div>
                    <div class="flex items-center gap-2 flex-wrap pt-1">
                        <button type="button" onclick="adminQuickToggleBusPaymentRule('${escapeHtml(b.id)}', 'screenshot', ${b.requirePaymentScreenshot !== false ? 'false' : 'true'})" class="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${b.requirePaymentScreenshot !== false ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100' : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'}" title="Toggle Screenshot Requirement">
                            📸 ${window.t('স্ক্রিনশট:', 'Screenshot:')} ${b.requirePaymentScreenshot !== false ? '🟢 ON' : '🔴 OFF'}
                        </button>
                        <button type="button" onclick="adminQuickToggleBusPaymentRule('${escapeHtml(b.id)}', 'utr', ${b.enableUtr ? 'false' : 'true'})" class="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${b.enableUtr ? 'bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100' : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'}" title="Toggle UTR Requirement">
                            🔢 UTR: ${b.enableUtr ? '🟢 ON' : '🔴 OFF'}
                        </button>
                    </div>
                    ${returnInfo}
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    ${approvalButtons}
                    <button type="button" onclick="adminAccessCaptainPortal('${escapeHtml(b.driverPhone || b.driver_phone || b.ownerPhone || '')}', '${escapeHtml(b.id)}', '${escapeHtml(b.name)}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm transition flex items-center gap-1" title="Direct Captain Portal Access">
                        👨‍✈️ <span data-bn="ক্যাপ্টেন প্যানেল" data-en="Captain Portal">${window.t('ক্যাপ্টেন প্যানেল', 'Captain Portal')}</span>
                    </button>
                    <button type="button" onclick="openAdminLiveTrackingModal('${escapeHtml(b.id)}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm transition flex items-center gap-1">
                        🗺️ <span data-bn="লাইভ অবস্থান" data-en="Live Track">${window.t('লাইভ অবস্থান', 'Live Track')}</span>
                    </button>
                    <button type="button" onclick="openAdminQuickRatingModal('${escapeHtml(b.id)}', '${escapeHtml(b.name)}', ${currentRating})" class="bg-amber-500 hover:bg-amber-600 text-gray-900 px-3 py-1.5 rounded-lg font-bold shadow-sm transition flex items-center gap-1">
                        ⭐ Rating
                    </button>
                    <button type="button" onclick="openSeatLayoutDesigner('${escapeHtml(b.id)}', 'admin')" class="bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-1.5 rounded-lg font-bold shadow-sm transition flex items-center gap-1">
                        💺 <span data-bn="সিট লেআউট" data-en="Seat Map">${window.t('সিট লেআউট', 'Seat Map')}</span>
                    </button>
                    <button onclick="editBus('${escapeHtml(b.id)}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg font-bold shadow-sm transition">
                        Edit
                    </button>
                    <button onclick="deleteBus('${escapeHtml(b.id)}')" class="bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-lg font-bold shadow-sm transition">
                        Delete
                    </button>
                </div>
            </div>
        `;
    });
}

function readImageFileAsDataUrl(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxWidth = 800;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

let adminCurrentBusPhotos = [];

function renderAdminBusPhotosGallery() {
    const gallery = document.getElementById('adminBusPhotosGallery');
    const badge = document.getElementById('adminBusPhotoCountBadge');
    if (!gallery) return;

    if (badge) {
        const bnC = `${adminCurrentBusPhotos.length} টি ছবি`;
        const enC = `${adminCurrentBusPhotos.length} Photo${adminCurrentBusPhotos.length === 1 ? '' : 's'}`;
        badge.setAttribute('data-bn', bnC);
        badge.setAttribute('data-en', enC);
        badge.textContent = window.t(bnC, enC);
    }

    if (adminCurrentBusPhotos.length === 0) {
        gallery.innerHTML = `<div class="text-xs text-gray-400 italic">${window.t('কোনো ছবি নেই। নিচে ছবি বাছুন।', 'No photos yet. Choose images below.')}</div>`;
        return;
    }

    gallery.innerHTML = adminCurrentBusPhotos.map((url, idx) => `
        <div class="relative w-24 h-16 rounded-xl overflow-hidden border border-gray-300 shadow-xs group bg-gray-950 shrink-0">
            <img src="${escapeHtml(url)}" alt="Bus Photo ${idx + 1}" class="w-full h-full object-cover">
            <button type="button" onclick="deleteAdminBusPhoto(${idx})" class="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md cursor-pointer transition opacity-90 group-hover:opacity-100" title="Delete Photo">
                ✕
            </button>
        </div>
    `).join('');
}
window.renderAdminBusPhotosGallery = renderAdminBusPhotosGallery;

async function deleteAdminBusPhoto(index) {
    if (index < 0 || index >= adminCurrentBusPhotos.length) return;
    const ok = await showBusYatraConfirm({ title: "ছবি মুছে ফেলা", subtitle: "আপনি কি নিশ্চিত এই ছবিটি মুছে ফেলতে চান? (Delete this bus photo?)", icon: "🗑️", confirmText: "হ্যাঁ, মুছে ফেলুন", cancelText: "বাতিল", danger: true }); if (!ok) return;

    const busId = document.getElementById('editingBusId')?.value;
    const photoUrlToDelete = adminCurrentBusPhotos[index];

    adminCurrentBusPhotos.splice(index, 1);
    renderAdminBusPhotosGallery();

    if (busId) {
        try {
            await apiRequest(`/api/admin/buses/${encodeURIComponent(busId)}/photos/delete`, {
                method: 'POST',
                body: JSON.stringify({
                    photoIndex: index,
                    photoUrl: photoUrlToDelete
                })
            });
            await loadAdminDashboard();
        } catch (err) {
            console.warn("Delete photo API error:", err.message);
        }
    }
}
window.deleteAdminBusPhoto = deleteAdminBusPhoto;

async function previewAdminBusImages(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const f of Array.from(files)) {
        try {
            const dataUrl = await readImageFileAsDataUrl(f);
            adminCurrentBusPhotos.push(dataUrl);
        } catch (e) {
            console.warn("Preview error:", e);
        }
    }
    event.target.value = '';
    renderAdminBusPhotosGallery();
}
window.previewAdminBusImages = previewAdminBusImages;

async function addNewBus() {
    const name = document.getElementById('newBusName').value.trim();
    const busNumber = document.getElementById('newBusNumber').value.trim().toUpperCase();
    const companyName = document.getElementById('newBusCompanyName').value.trim();
    const gstNumber = document.getElementById('newBusGstNumber').value.trim().toUpperCase();
    const ownerName = document.getElementById('newOwnerName').value.trim();
    const ownerPhone = document.getElementById('newOwnerPhone').value.trim();
    const ownerEmail = document.getElementById('newOwnerEmail').value.trim().toLowerCase();
    const upiId = document.getElementById('newBusUpiId').value.trim();
    const time = document.getElementById('newBusTime').value.trim();
    const fare = parseFloat(document.getElementById('newBusFare').value) || 399;
    const farePerStop = parseFloat(document.getElementById('newBusFarePerStop').value) || 45;
    const busRating = parseFloat(document.getElementById('newBusRating')?.value || 4.8);
    const route = (document.getElementById('newBusRoute')?.value || '').trim() || 'Pingla to Kolkata';
    const { stoppages, stoppageTimings } = collectStoppageSchedule('adminStoppagesContainer');
    const stoppageFares = (typeof collectStoppageFareMatrix === 'function')
        ? collectStoppageFareMatrix('adminFareMatrixContainer')
        : {};
    const ticketTerms = document.getElementById('newBusTicketTerms').value.trim();
    const editingId = document.getElementById('editingBusId').value;

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!name || !busNumber || !ownerName || !phoneRegex.test(ownerPhone)) {
        alert("Please provide valid Bus Name, Bus Number, Owner Name, and a valid 10-digit Indian Mobile Number.");
        return;
    }
    if (stoppages.length < 2) {
        alert("Please configure at least 2 stoppages for this bus route.");
        return;
    }

    let imagesArr = (adminCurrentBusPhotos && adminCurrentBusPhotos.length > 0)
        ? [...adminCurrentBusPhotos]
        : [];
    if (imagesArr.length === 0) {
        const existingBus = editingId ? getAppData().buses.find(b => b.id === editingId) : null;
        imagesArr = existingBus && existingBus.images ? existingBus.images : ["https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500&auto=format&fit=crop&q=60"];
    }

    // Return Route & Timetable Details
    const returnRouteEnabled = document.getElementById('adminReturnRouteEnabled')?.checked || false;
    const returnRoute = (document.getElementById('adminReturnRoute')?.value || '').trim();
    const returnTime = (document.getElementById('adminReturnTime')?.value || '').trim();
    const returnFare = parseFloat(document.getElementById('adminReturnFare')?.value) || fare;
    const returnSchedule = collectStoppageSchedule('adminReturnStoppagesContainer');
    const returnStoppages = returnSchedule.stoppages;
    const returnStoppageTimings = returnSchedule.stoppageTimings;
    const returnStoppageFares = (typeof collectStoppageFareMatrix === 'function')
        ? collectStoppageFareMatrix('adminReturnFareMatrixContainer')
        : {};

    const busPayload = {
        id: editingId || ('bus_' + Date.now()),
        name,
        busNumber,
        companyName: companyName || `${ownerName} Travels`,
        gstNumber,
        ownerName,
        ownerPhone,
        ownerEmail,
        time: time || (stoppageTimings[stoppages[0]] || "07:00 AM"),
        fare,
        farePerStop,
        farePerKm: 3.5,
        windowSeatExtra: 30,
        stoppages,
        stoppageTimings,
        stoppageFares,
        returnRouteEnabled,
        returnRoute: returnRoute || (returnStoppages.length >= 2 ? `${returnStoppages[0]} to ${returnStoppages[returnStoppages.length - 1]}` : (stoppages.slice().reverse().join(' to '))),
        returnTime,
        returnFare,
        returnStoppages,
        returnStoppageTimings,
        returnStoppageFares,
        approvalStatus: 'approved',
        activeRoutes: [route],
        route,
        totalSeats: 65,
        upiId: upiId || 'busyatra@oksbi',
        images: imagesArr,
        image: imagesArr[0],
        ticketTerms: ticketTerms || 'Please arrive 15 minutes before scheduled departure. Ticket is non-transferable.',
        allowOnlinePayment: (document.getElementById('newBusPaymentMethod')?.value === 'cash_only') ? false : true,
        allowCashPayment: (document.getElementById('newBusPaymentMethod')?.value === 'online_only') ? false : true,
        requirePaymentScreenshot: document.getElementById('newBusRequireScreenshot')?.value === '1',
        enableUtr: document.getElementById('newBusEnableUtr')?.value === '1',
        bookingMode: document.getElementById('newBusBookingMode')?.value || 'active',
        driverPhone: (document.getElementById('newBusDriverPhone')?.value || '').trim() || ownerPhone,
        emergencyPhone: (document.getElementById('newBusEmergencyPhone')?.value || '').trim() || ownerPhone,
        rating: Number.isFinite(busRating) ? Math.min(5.0, Math.max(1.0, busRating)) : 4.8
    };

    try {
        await apiRequest('/api/admin/buses', {
            method: 'POST',
            body: JSON.stringify(busPayload)
        });
        resetAdminForm();
        await loadAdminDashboard();
        alert("✅ Bus saved successfully into Cloudflare database!");
    } catch (error) {
        console.error('Failed to save bus:', error);
        alert(`Could not save bus: ${error.message}`);
    }
}

function toggleAdminReturnRouteFields() {
    const enabled = document.getElementById('adminReturnRouteEnabled')?.checked;
    const fields = document.getElementById('adminReturnRouteFields');
    if (fields) {
        fields.classList.toggle('hidden', !enabled);
    }
}
window.toggleAdminReturnRouteFields = toggleAdminReturnRouteFields;

function reverseAdminUpRouteForReturn() {
    const { stoppages } = collectStoppageSchedule('adminStoppagesContainer');
    if (!stoppages || stoppages.length < 2) {
        alert('আপ রুটে পর্যাপ্ত স্টপেজ নেই। প্রথমে আপ রুটের স্টপেজ নির্ধারণ করুন।');
        return;
    }
    const rev = stoppages.slice().reverse();
    const retRoute = `${rev[0]} to ${rev[rev.length - 1]}`;
    const routeInput = document.getElementById('adminReturnRoute');
    if (routeInput) routeInput.value = retRoute;
    const retToggle = document.getElementById('adminReturnRouteEnabled');
    if (retToggle && !retToggle.checked) {
        retToggle.checked = true;
        toggleAdminReturnRouteFields();
    }
    const existingRetFares = (typeof collectStoppageFareMatrix === 'function')
        ? collectStoppageFareMatrix('adminReturnFareMatrixContainer')
        : {};
    renderStoppageScheduleEditor('adminReturnStoppagesContainer', rev, {});
    if (typeof renderStoppageFareMatrixEditor === 'function') {
        renderStoppageFareMatrixEditor('adminReturnFareMatrixContainer', 'adminReturnStoppagesContainer', existingRetFares, {
            fareInputId: 'adminReturnFare',
            perStopInputId: 'newBusFarePerStop',
            defaultFare: Number(document.getElementById('adminReturnFare')?.value) || Number(document.getElementById('newBusFare')?.value) || 399
        });
    }
    alert(`✅ ফিরতি রুট প্রস্তুত: ${retRoute}। এখন ফিরতি সময়সূচি ও ভাড়া নির্ধারণ করুন।`);
}
window.reverseAdminUpRouteForReturn = reverseAdminUpRouteForReturn;

function editBus(id) {
    const db = getAppData();
    const bus = db.buses.find(b => b.id === id);
    if (!bus) return;

    document.getElementById('editingBusId').value = bus.id;
    document.getElementById('newBusName').value = bus.name || "";
    document.getElementById('newBusNumber').value = bus.busNumber || "";
    document.getElementById('newBusCompanyName').value = bus.companyName || "";
    document.getElementById('newBusGstNumber').value = bus.gstNumber || "";
    document.getElementById('newOwnerName').value = bus.ownerName || "";
    document.getElementById('newOwnerPhone').value = bus.ownerPhone || "";
    document.getElementById('newOwnerEmail').value = bus.ownerEmail || "";
    document.getElementById('newBusUpiId').value = bus.upiId || "";
    document.getElementById('newBusTime').value = bus.time || "";
    document.getElementById('newBusFare').value = bus.fare || 399;
    document.getElementById('newBusFarePerStop').value = bus.farePerStop || 45;
    if (document.getElementById('newBusRating')) {
        document.getElementById('newBusRating').value = bus.rating !== undefined && bus.rating !== null ? bus.rating : 4.8;
    }
    if (document.getElementById('newBusBookingMode')) {
        document.getElementById('newBusBookingMode').value = bus.bookingMode || 'active';
    }
    if (document.getElementById('newBusDriverPhone')) {
        document.getElementById('newBusDriverPhone').value = bus.driverPhone || '';
    }
    if (document.getElementById('newBusEmergencyPhone')) {
        document.getElementById('newBusEmergencyPhone').value = bus.emergencyPhone || '';
    }
    const routeInput = document.getElementById('newBusRoute');
    if (routeInput) routeInput.value = bus.route || (bus.activeRoutes && bus.activeRoutes[0]) || 'Pingla to Kolkata';
    renderStoppageScheduleEditor('adminStoppagesContainer', bus.stoppages || [], bus.stoppageTimings || bus.stoppage_timings || {});
    if (typeof renderStoppageFareMatrixEditor === 'function') {
        renderStoppageFareMatrixEditor(
            'adminFareMatrixContainer',
            'adminStoppagesContainer',
            bus.stoppageFares || bus.stoppage_fares || {},
            {
                fareInputId: 'newBusFare',
                perStopInputId: 'newBusFarePerStop',
                defaultFare: bus.fare || 399,
                defaultPerStop: bus.farePerStop || 45
            }
        );
    }

    // Return Route Details
    const returnToggle = document.getElementById('adminReturnRouteEnabled');
    if (returnToggle) returnToggle.checked = Boolean(bus.returnRouteEnabled);
    const returnRouteInput = document.getElementById('adminReturnRoute');
    if (returnRouteInput) returnRouteInput.value = bus.returnRoute || '';
    const returnTimeInput = document.getElementById('adminReturnTime');
    if (returnTimeInput) returnTimeInput.value = bus.returnTime || '';
    const returnFareInput = document.getElementById('adminReturnFare');
    if (returnFareInput) returnFareInput.value = bus.returnFare !== undefined ? bus.returnFare : (bus.fare || 399);
    renderStoppageScheduleEditor('adminReturnStoppagesContainer', bus.returnStoppages || [], bus.returnStoppageTimings || bus.return_stoppage_timings || {});
    if (typeof renderStoppageFareMatrixEditor === 'function') {
        renderStoppageFareMatrixEditor(
            'adminReturnFareMatrixContainer',
            'adminReturnStoppagesContainer',
            bus.returnStoppageFares || bus.return_stoppage_fares || {},
            {
                fareInputId: 'adminReturnFare',
                perStopInputId: 'newBusFarePerStop',
                defaultFare: bus.returnFare || bus.fare || 399,
                defaultPerStop: bus.farePerStop || 45
            }
        );
    }
    toggleAdminReturnRouteFields();

    document.getElementById('newBusTicketTerms').value = bus.ticketTerms || "";
    const payMethodSelect = document.getElementById('newBusPaymentMethod');
    if (payMethodSelect) {
        const hasOnline = bus.allowOnlinePayment !== false;
        const hasCash = bus.allowCashPayment !== false;
        if (hasOnline && hasCash) payMethodSelect.value = 'both';
        else if (hasOnline && !hasCash) payMethodSelect.value = 'online_only';
        else payMethodSelect.value = 'cash_only';
    }
    if (document.getElementById('newBusRequireScreenshot')) {
        document.getElementById('newBusRequireScreenshot').value = bus.requirePaymentScreenshot !== false ? '1' : '0';
    }
    if (document.getElementById('newBusEnableUtr')) {
        document.getElementById('newBusEnableUtr').value = bus.enableUtr ? '1' : '0';
    }
    
    // Admin Bus Photos Gallery
    adminCurrentBusPhotos = [];
    if (Array.isArray(bus.images) && bus.images.length > 0) {
        adminCurrentBusPhotos = [...bus.images];
    } else if (bus.image) {
        if (typeof bus.image === 'string' && bus.image.startsWith('[')) {
            try { adminCurrentBusPhotos = JSON.parse(bus.image); } catch(e) { adminCurrentBusPhotos = [bus.image]; }
        } else {
            adminCurrentBusPhotos = [bus.image];
        }
    }
    renderAdminBusPhotosGallery();

    document.getElementById('formTitle').innerText = "Edit Bus: " + bus.name;
    document.getElementById('formSubmitBtn').innerText = "Update Bus Details";
    document.getElementById('cancelEditBtn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetAdminForm() {
    document.getElementById('editingBusId').value = "";
    document.getElementById('newBusName').value = "";
    document.getElementById('newBusNumber').value = "";
    document.getElementById('newBusCompanyName').value = "";
    document.getElementById('newBusGstNumber').value = "";
    document.getElementById('newOwnerName').value = "";
    document.getElementById('newOwnerPhone').value = "";
    document.getElementById('newOwnerEmail').value = "";
    document.getElementById('newBusUpiId').value = "";
    if (document.getElementById('newBusPaymentMethod')) {
        document.getElementById('newBusPaymentMethod').value = 'both';
    }
    if (document.getElementById('newBusRequireScreenshot')) {
        document.getElementById('newBusRequireScreenshot').value = '1';
    }
    if (document.getElementById('newBusEnableUtr')) {
        document.getElementById('newBusEnableUtr').value = '0';
    }
    document.getElementById('newBusTime').value = "05:00 AM";
    document.getElementById('newBusFare').value = "399";
    document.getElementById('newBusFarePerStop').value = "45";
    if (document.getElementById('newBusRating')) document.getElementById('newBusRating').value = "4.8";
    if (document.getElementById('newBusBookingMode')) document.getElementById('newBusBookingMode').value = "active";
    if (document.getElementById('newBusDriverPhone')) document.getElementById('newBusDriverPhone').value = "";
    if (document.getElementById('newBusEmergencyPhone')) document.getElementById('newBusEmergencyPhone').value = "";
    const routeInput = document.getElementById('newBusRoute');
    if (routeInput) routeInput.value = "Pingla to Kolkata";
    renderStoppageScheduleEditor(
        'adminStoppagesContainer',
        ['Pingla', 'Balaipanda', 'Jalchak', 'Debra', 'Kharagpur', 'Kolaghat', 'Kolkata'],
        {
            'Pingla': '05:00 AM',
            'Balaipanda': '05:40 AM',
            'Jalchak': '06:00 AM',
            'Debra': '06:20 AM',
            'Kharagpur': '06:50 AM',
            'Kolaghat': '07:40 AM',
            'Kolkata': '08:45 AM'
        }
    );
    if (typeof renderStoppageFareMatrixEditor === 'function') {
        renderStoppageFareMatrixEditor('adminFareMatrixContainer', 'adminStoppagesContainer', {}, {
            fareInputId: 'newBusFare',
            perStopInputId: 'newBusFarePerStop',
            defaultFare: 399,
            defaultPerStop: 45
        });
    }

    // Reset Return Route fields
    const returnToggle = document.getElementById('adminReturnRouteEnabled');
    if (returnToggle) returnToggle.checked = false;
    const returnRouteInput = document.getElementById('adminReturnRoute');
    if (returnRouteInput) returnRouteInput.value = '';
    const returnTimeInput = document.getElementById('adminReturnTime');
    if (returnTimeInput) returnTimeInput.value = '';
    const returnFareInput = document.getElementById('adminReturnFare');
    if (returnFareInput) returnFareInput.value = '';
    renderStoppageScheduleEditor('adminReturnStoppagesContainer', [], {});
    if (typeof renderStoppageFareMatrixEditor === 'function') {
        renderStoppageFareMatrixEditor('adminReturnFareMatrixContainer', 'adminReturnStoppagesContainer', {}, {
            fareInputId: 'adminReturnFare',
            perStopInputId: 'newBusFarePerStop',
            defaultFare: 399,
            defaultPerStop: 45
        });
    }
    toggleAdminReturnRouteFields();

    document.getElementById('newBusTicketTerms').value = "";
    const imgInput = document.getElementById('newBusImagesFiles');
    if (imgInput) imgInput.value = "";
    adminCurrentBusPhotos = [];
    renderAdminBusPhotosGallery();
    const preview = document.getElementById('adminBusImagePreview');
    if (preview) preview.src = 'icons/logo-admin.png';
    document.getElementById('formTitle').innerText = "Register New Bus & Operator";
    document.getElementById('formSubmitBtn').innerText = "Register Bus & Settings";
    document.getElementById('cancelEditBtn').classList.add('hidden');
}

async function approveBus(busId) {
    const ok = await showBusYatraConfirm({ title: "বাস অনুমোদন", subtitle: "আপনি কি এই বাসটিকে অনুমোদন করে লাইভ করতে চান?", icon: "🚌", confirmText: "হ্যাঁ, লাইভ করুন", cancelText: "বাতিল", danger: false }); if (!ok) return;
    try {
        await apiRequest(`/api/admin/buses/${encodeURIComponent(busId)}/approve`, {
            method: 'POST'
        });
        alert('✅ বাসটি সফলভাবে অনুমোদন ও লাইভ করা হয়েছে!');
        await loadAdminDashboard();
    } catch (e) {
        alert(e.message || 'অনুমোদন ব্যর্থ হয়েছে।');
    }
}
window.approveBus = approveBus;

async function rejectBus(busId) {
    const reason = prompt(window.t('বাসটি বাতিল করার কারণ লিখুন:', 'Reason for rejection:'), window.t('তথ্য বা নথিপত্র অসম্পূর্ণ', 'Incomplete details'));
    if (reason === null) return;
    try {
        await apiRequest(`/api/admin/buses/${encodeURIComponent(busId)}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason: reason.trim() || 'তথ্য অসম্পূর্ণ' })
        });
        alert('❌ বাসটি বাতিল করা হয়েছে।');
        await loadAdminDashboard();
    } catch (e) {
        alert(e.message || 'বাতিলকরণ ব্যর্থ হয়েছে।');
    }
}
window.rejectBus = rejectBus;

function loadAdminPendingBusApprovals() {
    const db = getAppData();
    const container = document.getElementById('adminPendingBusApprovalsList');
    const badge = document.getElementById('badgePendingBusApprovals');
    const buses = db.buses || [];
    const pendingBuses = buses.filter(b => b.approvalStatus === 'pending');
    
    if (badge) {
        badge.innerText = pendingBuses.length;
        badge.classList.toggle('hidden', pendingBuses.length === 0);
    }

    if (!container) return;

    if (pendingBuses.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 py-6 text-xs">' + window.t('সব বাসের অনুমোদন সম্পন্ন।', 'No pending bus approvals.') + '</div>';
        return;
    }

    container.innerHTML = pendingBuses.map(b => {
        const stoppagesCount = (b.stoppages && b.stoppages.length) || 0;
        const returnInfo = b.returnRouteEnabled
            ? `<div class="text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg text-[11px] font-semibold mt-1">🔄 ফিরতি ট্রিপ: ${escapeHtml(b.returnRoute || 'Return')} (${escapeHtml(b.returnTime || 'N/A')}) • ভাড়া: ₹${b.returnFare !== undefined ? b.returnFare : b.fare}</div>`
            : '';
        return `
            <div class="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 text-xs space-y-2.5 shadow-xs">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 pb-2.5">
                    <div>
                        <div class="font-black text-sm text-gray-900 flex items-center flex-wrap gap-2">
                            <span>${escapeHtml(b.name)}</span>
                            <span class="bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded font-mono uppercase">${escapeHtml(b.busNumber)}</span>
                            <span class="bg-amber-200 text-amber-900 text-[10px] px-2.5 py-0.5 rounded-full font-bold">🟡 পেন্ডিং অনুমোদন</span>
                        </div>
                        <div class="text-[11px] text-gray-600 mt-1">
                            <strong>মালিক:</strong> ${escapeHtml(b.ownerName)} • <strong>মোবাইল:</strong> <a href="tel:${escapeHtml(b.ownerPhone)}" class="text-blue-600 font-bold">${escapeHtml(b.ownerPhone)}</a>
                            ${b.companyName ? ` • <strong>কোম্পানি:</strong> ${escapeHtml(b.companyName)}` : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="approveBus('${escapeHtml(b.id)}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl font-bold shadow-xs transition flex items-center gap-1 text-xs cursor-pointer">
                            ${window.t('✅ অনুমোদন করুন', '✅ Approve')}
                        </button>
                        <button type="button" onclick="rejectBus('${escapeHtml(b.id)}')" class="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-xl font-bold shadow-xs transition flex items-center gap-1 text-xs cursor-pointer">
                            ${window.t('❌ বাতিল করুন', '❌ Reject')}
                        </button>
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-gray-700">
                    <div><strong>আপ রুট:</strong> ${escapeHtml(b.route)}</div>
                    <div><strong>ছাড়ার সময়:</strong> ${escapeHtml(b.time || 'N/A')}</div>
                    <div><strong>ভাড়া:</strong> ₹${b.fare}</div>
                    <div><strong>মোট সিট:</strong> ${b.totalSeats || 65} (${stoppagesCount}টি স্টপেজ)</div>
                </div>
                ${returnInfo}
            </div>
        `;
    }).join('');
}
window.loadAdminPendingBusApprovals = loadAdminPendingBusApprovals;

function loadAdminPendingPhotoApprovals() {
    const db = getAppData();
    const container = document.getElementById('adminPendingPhotoApprovalsList');
    const badge = document.getElementById('badgePendingPhotoApprovals');
    const buses = db.buses || [];
    
    // Buses where photoApprovalStatus === 'pending'
    const pendingBuses = buses.filter(b => b.photoApprovalStatus === 'pending' || b.photo_approval_status === 'pending');
    
    if (badge) {
        badge.innerText = pendingBuses.length;
        badge.classList.toggle('hidden', pendingBuses.length === 0);
    }

    if (!container) return;

    if (pendingBuses.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-6 text-xs">${window.t('কোনো অতিরিক্ত ছবির অনুমোদন রিকোয়েস্ট পেন্ডিং নেই।', 'No pending photo approval requests.')}</div>`;
        return;
    }

    container.innerHTML = pendingBuses.map(bus => {
        let allPendingPhotos = [];
        if (Array.isArray(bus.pendingImages) && bus.pendingImages.length > 0) {
            allPendingPhotos = bus.pendingImages;
        } else if (Array.isArray(bus.images)) {
            allPendingPhotos = bus.images;
        }

        return `
            <article class="rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-4 sm:p-5 text-xs space-y-4 shadow-sm" id="photo-approval-${bus.id}">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200 pb-3">
                    <div>
                        <div class="font-black text-base text-gray-900">${escapeHtml(bus.name || 'Bus')} (${escapeHtml(bus.busNumber || bus.number || '')})</div>
                        <div class="text-gray-600 mt-0.5">
                            <strong>মালিক:</strong> ${escapeHtml(bus.ownerName || '—')} · <strong>ফোন:</strong> ${escapeHtml(bus.ownerPhone || '—')} · <strong>রুট:</strong> ${escapeHtml(bus.route || '—')}
                        </div>
                    </div>
                    <span class="bg-amber-500 text-black text-[11px] font-black px-3 py-1 rounded-full shrink-0 self-start sm:self-auto shadow-xs">
                        🟡 ${allPendingPhotos.length} টি ছবি অনুমোদনের অপেক্ষায়
                    </span>
                </div>

                <div class="space-y-2">
                    <div class="text-gray-700 font-bold flex items-center gap-1.5 flex-wrap">
                        <span>📸 মালিকের আপলোড করা সমস্ত ছবি (${allPendingPhotos.length}টি):</span>
                        <span class="text-[11px] font-normal text-gray-500">(প্রথম ৩টি বর্তমানে লাইভ, বাকি ${Math.max(0, allPendingPhotos.length - 3)}টি অনুমোদনের জন্য জমা)</span>
                    </div>
                    <div class="flex flex-wrap gap-2.5 p-2.5 bg-white border border-amber-200 rounded-xl">
                        ${allPendingPhotos.map((imgUrl, i) => `
                            <div class="relative w-24 h-16 rounded-lg overflow-hidden border border-gray-300 shadow-xs bg-gray-950 shrink-0 group">
                                <img src="${escapeHtml(imgUrl)}" alt="Photo ${i + 1}" class="w-full h-full object-cover">
                                <span class="absolute bottom-0.5 left-0.5 ${i < 3 ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-black'} text-[9px] font-black px-1 rounded">
                                    ${i < 3 ? 'লাইভ' : 'নতুন'}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="flex flex-wrap gap-2.5 pt-2">
                    <button type="button" onclick="approveBusPhotos('${escapeHtml(bus.id)}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer">
                        ${window.t('✅ সমস্ত ছবি অনুমোদন করুন', '✅ Approve All Photos')}
                    </button>
                    <button type="button" onclick="rejectBusPhotos('${escapeHtml(bus.id)}')" class="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer">
                        ${window.t('❌ অতিরিক্ত ছবি বাতিল করুন', '❌ Reject Extra Photos')}
                    </button>
                </div>
            </article>
        `;
    }).join('');
}
window.loadAdminPendingPhotoApprovals = loadAdminPendingPhotoApprovals;

async function approveBusPhotos(busId) {
    const ok = await showBusYatraConfirm({ title: "বাসের ছবি অনুমোদন", subtitle: "আপনি কি নিশ্চিত এই বাসের সমস্ত ছবি অনুমোদন করতে চান? অনুমোদিত হলে যাত্রীরা সব ছবি দেখতে পাবেন।", icon: "🖼️", confirmText: "হ্যাঁ, অনুমোদন করুন", cancelText: "বাতিল", danger: false }); if (!ok) return;

    try {
        await apiRequest(`/api/admin/buses/${encodeURIComponent(busId)}/photos/approve`, {
            method: 'POST'
        });
        await loadAdminDashboard();
        alert("✅ বাসের সমস্ত ছবি সফলভাবে অনুমোদিত হয়েছে এবং লাইভ হয়ে গেছে! (All bus photos approved and live!)");
    } catch (err) {
        alert(err.message || "ছবি অনুমোদন ব্যর্থ হয়েছে।");
    }
}
window.approveBusPhotos = approveBusPhotos;

async function rejectBusPhotos(busId) {
    const reason = prompt(window.t("অতিরিক্ত ছবি বাতিলের কারণ লিখুন:", "Reason for rejecting extra photos:"), window.t("ছবির গুণমান বা প্রাসঙ্গিকতার অভাব", "Lack of quality or relevance"));
    if (reason === null) return;

    try {
        await apiRequest(`/api/admin/buses/${encodeURIComponent(busId)}/photos/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason: reason || 'Rejected by admin' })
        });
        await loadAdminDashboard();
        alert("ℹ️ বাসের অতিরিক্ত ছবি বাতিল করা হয়েছে এবং মালিককে জানানো হয়েছে। প্রথম ৩টি ছবি লাইভ রাখা হয়েছে।");
    } catch (err) {
        alert(err.message || "ছবি বাতিল ব্যর্থ হয়েছে।");
    }
}
window.rejectBusPhotos = rejectBusPhotos;

async function deleteBus(id) {
    const ok = await showBusYatraConfirm({
        title: "বাস ও ক্যাপ্টেন ডিলিট নিশ্চিতকরণ",
        subtitle: "আপনি কি নিশ্চিত এই বাসটি সম্পূর্ণ মুছে ফেলতে চান?\n\n• বাসের সমস্ত রুট ও শিডিউল মুছে যাবে।\n• এই বাসের ক্যাপ্টেন অ্যাকাউন্টও স্থায়ীভাবে ডিলিট হয়ে যাবে।\n(All route, schedule, and assigned captain data will be removed.)",
        icon: "🗑️",
        confirmText: "হ্যাঁ, বাস ও ক্যাপ্টেন ডিলিট করুন",
        cancelText: "বাতিল",
        danger: true
    });
    if (!ok) return;
    try {
        await apiRequest(`/api/admin/buses/${encodeURIComponent(id)}`, { method: 'DELETE' });
        await loadAdminDashboard();
        await loadAdminCaptainsData();
        if (typeof loadAdminCustomersData === 'function') await loadAdminCustomersData();
        showDropDownToast("✅ বাস এবং সংশ্লিষ্ট ক্যাপ্টেন সফলভাবে মুছে ফেলা হয়েছে।", "success");
    } catch (error) {
        console.error('Failed to delete bus:', error);
        alert(`Could not delete bus: ${error.message}`);
    }
}

// --- Customer Bookings & Controls (with Select-All Bulk Delete) ---
let selectedAdminBookings = new Set();

function toggleAdminSelectAll(checked) {
    selectedAdminBookings.clear();
    const checkboxes = document.querySelectorAll('.admin-booking-cb');
    checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked && cb.dataset.id) {
            selectedAdminBookings.add(cb.dataset.id);
        }
    });
    updateAdminSelectionToolbar();
}

function handleAdminBookingCheckChange(checkbox) {
    if (!checkbox || !checkbox.dataset.id) return;
    if (checkbox.checked) {
        selectedAdminBookings.add(checkbox.dataset.id);
    } else {
        selectedAdminBookings.delete(checkbox.dataset.id);
    }
    const allCbs = document.querySelectorAll('.admin-booking-cb');
    const selectAll = document.getElementById('adminSelectAllCheckbox');
    if (selectAll) {
        selectAll.checked = allCbs.length > 0 && selectedAdminBookings.size === allCbs.length;
    }
    updateAdminSelectionToolbar();
}

function updateAdminSelectionToolbar() {
    const btn = document.getElementById('btnAdminBulkDelete');
    const badge = document.getElementById('adminSelectedCountBadge');
    const count = selectedAdminBookings.size;

    if (btn) {
        btn.disabled = count === 0;
        const bnLbl = `নির্বাচিত ডিলিট (${count}টি)`;
        const enLbl = `Delete Selected (${count})`;
        btn.innerHTML = `<span>🗑️</span> <span data-bn="${bnLbl}" data-en="${enLbl}">${window.t(bnLbl, enLbl)}</span>`;
    }
    if (badge) {
        if (count > 0) {
            const bnB = `${count}টি নির্বাচিত`;
            const enB = `${count} selected`;
            badge.setAttribute('data-bn', bnB);
            badge.setAttribute('data-en', enB);
            badge.innerText = window.t(bnB, enB);
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

async function deleteAdminSelectedBookings() {
    const ids = Array.from(selectedAdminBookings);
    if (!ids.length) {
        alert('Please select at least one booking to delete.');
        return;
    }
    const ok = await showBusYatraConfirm({ title: "নির্বাচিত বুকিং ডিলিট", subtitle: `Are you sure you want to permanently delete ${ids.length} selected booking transactions?

This will completely purge the bookings and their financial records.`, icon: "🗑️", confirmText: "হ্যাঁ, সব ডিলিট করুন", cancelText: "বাতিল", danger: true }); if (!ok) return;
    try {
        const res = await apiRequest('/api/admin/bookings/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ bookingIds: ids })
        });
        selectedAdminBookings.clear();
        alert(res.message || `✅ ${res.deleted || ids.length} bookings deleted successfully.`);
        await Promise.all([
            loadAdminCustomersData(),
            loadAdminFinanceData(),
            loadAdminDashboard()
        ]);
    } catch (err) {
        alert(err.message || 'Failed to delete selected bookings.');
    }
}

async function deleteAdminAllOnDate() {
    const dateInput = document.getElementById('customerDateFilter');
    const dateVal = dateInput?.value;
    if (!dateVal) {
        alert('Please select a date in the filter first to delete all bookings for that date.');
        dateInput?.focus();
        return;
    }
    const ok = await showBusYatraConfirm({ title: "তারিখ অনুযায়ী বুকিং ডিলিট", subtitle: `CRITICAL WARNING: Are you sure you want to permanently delete ALL bookings for ${dateVal}?`, icon: "⚠️", confirmText: "হ্যাঁ, ডিলিট করুন", cancelText: "বাতিল", danger: true }); if (!ok) return;
    try {
        const res = await apiRequest('/api/admin/bookings/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ date: dateVal })
        });
        selectedAdminBookings.clear();
        alert(`✅ All bookings for ${dateVal} (${res.deleted || 0}) deleted successfully.`);
        await Promise.all([
            loadAdminCustomersData(),
            loadAdminFinanceData(),
            loadAdminDashboard()
        ]);
    } catch (err) {
        alert(err.message || 'Failed to delete bookings for selected date.');
    }
}

function renderAdminCustomersList() {
    const db = getAppData();
    const container = document.getElementById('adminCustomersContainer');
    const query = (document.getElementById('customerSearchInput')?.value || "").toLowerCase();
    const dateFilter = document.getElementById('customerDateFilter')?.value;
    const busSelect = document.getElementById('customerBusFilter');
    const selectedBusId = busSelect ? busSelect.value : "";

    // Sync bus dropdown options
    if (busSelect) {
        const buses = db.buses || [];
        const currentSelected = busSelect.value;
        const currentOptsCount = busSelect.options.length;
        if (currentOptsCount !== buses.length + 1) {
            busSelect.innerHTML = `<option value="" data-bn="🚌 সকল বাস" data-en="🚌 All Fleet Buses">${window.t('🚌 সকল বাস', '🚌 All Fleet Buses')}</option>`;
            buses.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = `${b.name} (${b.busNumber || ''})`;
                busSelect.appendChild(opt);
            });
            if (currentSelected) busSelect.value = currentSelected;
        }
    }

    if (!container) return;

    let bookings = Object.values(db.bookings || {});
    if (query) {
        bookings = bookings.filter(b => 
            (b.passengerName && b.passengerName.toLowerCase().includes(query)) || 
            (b.passengerPhone && b.passengerPhone.includes(query)) ||
            (b.id && b.id.toLowerCase().includes(query)) ||
            (b.busName && b.busName.toLowerCase().includes(query))
        );
    }
    if (dateFilter) {
        bookings = bookings.filter(b => b.date === dateFilter);
    }
    if (selectedBusId) {
        bookings = bookings.filter(b => b.busId === selectedBusId || b.busId === (selectedBusId + '_RETURN'));
    }

    // Sort by journey date desc
    bookings.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));

    container.innerHTML = "";

    // Reset select all
    const selectAll = document.getElementById('adminSelectAllCheckbox');
    if (selectAll) selectAll.checked = false;
    selectedAdminBookings.clear();
    updateAdminSelectionToolbar();

    if (bookings.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-8 text-xs">No bookings found matching filters.</div>`;
        return;
    }

    const regMap = new Map((adminRegisteredCustomers || []).map(c => [String(c.phone || '').trim(), c]));
    bookings.forEach(b => {
        const utr = (b.utrNumber && b.utrNumber !== 'N/A') ? b.utrNumber : ((b.upiTransactionId && b.upiTransactionId !== 'N/A') ? b.upiTransactionId : '');
        const isApproved = b.status === "Approved";
        const isRejected = b.status === "Rejected";
        const isCancelled = b.status === "Cancelled";
        const isCancelReq = b.status === "Cancellation Requested";
        const regCust = regMap.get(String(b.passengerPhone || '').trim()) || null;
        const avatarInfo = (typeof resolveCustomerAvatarInfo === 'function')
            ? resolveCustomerAvatarInfo({ name: b.passengerName, phone: b.passengerPhone, profilePhoto: regCust?.profilePhoto, avatarPreference: regCust?.avatarPreference })
            : { src: 'assets/avatar-customer-male.jpg', isCustom: false };

        container.innerHTML += `
            <div class="bg-gray-50 hover:bg-gray-100/80 p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs transition">
                <div class="flex items-start gap-3 flex-1 min-w-0">
                    <input type="checkbox" data-id="${escapeHtml(b.id)}" onchange="handleAdminBookingCheckChange(this)" class="admin-booking-cb w-4 h-4 mt-0.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer shrink-0">
                    ${regCust ? `
                        <button type="button" onclick="openAdminCustomerPhotoModal('${escapeHtml(regCust.phone)}')" class="relative w-9 h-9 rounded-full p-[1.5px] ${avatarInfo.isCustom ? 'bg-gradient-to-tr from-purple-600 to-pink-500' : 'bg-gray-300'} shrink-0 cursor-pointer hover:scale-105 transition" title="View / Change Customer Photo">
                            <img src="${avatarInfo.src}" alt="${escapeHtml(b.passengerName)}" class="w-full h-full rounded-full object-cover object-top border border-white bg-white">
                        </button>
                    ` : `
                        <img src="${avatarInfo.src}" alt="${escapeHtml(b.passengerName)}" class="w-9 h-9 rounded-full object-cover object-top border border-gray-300 shrink-0 bg-white">
                    `}
                    <div class="space-y-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-bold text-gray-900 text-sm">${escapeHtml(b.passengerName)}</span>
                            <a href="tel:${escapeHtml(b.passengerPhone)}" class="text-blue-600 font-semibold hover:underline">📞 ${escapeHtml(b.passengerPhone)}</a>
                        </div>
                        <div>
                            <strong>Bus:</strong> ${escapeHtml(b.busName)} (${escapeHtml(b.busNumber)}) • 
                            <strong>Company:</strong> ${escapeHtml(b.companyName || b.ownerName + ' Travels')} • 
                            <strong>Seats:</strong> <span class="bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">${escapeHtml((b.seats || []).join(', '))}</span>
                        </div>
                        <div>
                            <strong>Route:</strong> ${escapeHtml(b.boarding)} ➔ ${escapeHtml(b.dropping)} • 
                            <strong>Date:</strong> <span class="font-bold text-purple-900">${escapeHtml(b.date)}</span> • 
                            <strong>Fare:</strong> ₹${b.fare} (${escapeHtml(b.paymentMode)}${utr ? ' • UTR: ' + escapeHtml(utr) : ''})
                        </div>
                        <div class="text-gray-400 font-mono text-[11px]">
                            Booking ID: ${escapeHtml(b.id)} • Booked on: ${b.createdAt ? new Date(b.createdAt).toLocaleString() : 'N/A'}
                        </div>
                        ${b.device_info ? `<div>${formatDeviceInlineBadge(b.device_info)}</div>` : ''}
                        ${b.paymentScreenshot ? `
                            <div class="mt-2 flex items-center gap-2 flex-wrap">
                                <button type="button" onclick="viewPaymentScreenshot('${escapeHtml(b.paymentScreenshot)}', '${escapeHtml(b.id)}', '${escapeHtml(b.passengerName)}')" class="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg font-bold text-xs shadow-xs transition cursor-pointer">
                                    📸 <span>পেমেন্ট স্ক্রিনশট দেখুন</span>
                                </button>
                                <span class="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 font-bold">✓ রসিদ আপলোড করা আছে</span>
                            </div>
                        ` : ''}
                        ${b.cancelReason ? `
                            <div class="text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1">
                                <strong>⚠️ ${window.t('বাতিলের কারণ:', 'Cancellation Reason:')}</strong> ${escapeHtml(b.cancelReason)}
                            </div>
                        ` : ''}
                        ${isCancelled ? `
                            <div class="mt-1 flex items-center gap-2 flex-wrap">
                                ${b.refundStatus === 'processing' ? `
                                    <span class="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[11px] border border-amber-300">
                                        ⏳ ${window.t('রিফান্ড প্রক্রিয়াধীন:', 'Refund Processing:')} ₹${b.refundAmount || 0}
                                    </span>
                                ` : b.refundStatus === 'completed' ? `
                                    <span class="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded text-[11px] border border-emerald-300">
                                        ✅ ${window.t('রিফান্ড সম্পন্ন:', 'Refund Paid:')} ₹${b.refundAmount || 0}
                                    </span>
                                ` : `
                                    <span class="bg-gray-100 text-gray-700 font-medium px-2 py-0.5 rounded text-[11px]">
                                        ${window.t('কোনো রিফান্ড নেই', 'No Refund')}
                                    </span>
                                `}
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0">
                    <span class="px-3 py-1 rounded-full font-bold ${
                        isApproved ? 'bg-green-100 text-green-700' : 
                        isCancelled ? 'bg-red-100 text-red-700 border border-red-300' :
                        isRejected ? 'bg-red-100 text-red-700' : 
                        isCancelReq ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse' :
                        'bg-orange-100 text-orange-700'
                    }">
                        ${escapeHtml(isApproved ? 'Booking Done' : (isCancelReq ? 'Cancellation Requested' : (isCancelled ? 'Cancelled' : b.status)))}
                    </span>
                    ${(!isApproved && !isCancelled && !isRejected) ? `
                        <button onclick="adminSetBookingStatus('${escapeHtml(b.id)}', 'Approved')" class="bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded-lg font-bold shadow-sm">
                            Approve
                        </button>
                    ` : ''}
                    ${(!isRejected && !isCancelled) ? `
                        <button onclick="adminSetBookingStatus('${escapeHtml(b.id)}', 'Rejected')" class="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-lg font-bold shadow-sm">
                            Reject
                        </button>
                    ` : ''}
                    ${(isCancelReq || isApproved) ? `
                        <button onclick="adminOpenCancelModal('${escapeHtml(b.id)}', ${b.fare}, '${escapeHtml(b.passengerName)}')" class="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg font-bold shadow-sm flex items-center gap-1">
                            ✕ Cancel & Refund
                        </button>
                    ` : ''}
                    ${(isCancelled && b.refundStatus === 'processing') ? `
                        <button onclick="adminCompleteRefund('${escapeHtml(b.id)}', ${b.refundAmount || 0})" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg font-bold shadow-sm flex items-center gap-1">
                            ✓ Mark Refund Paid
                        </button>
                    ` : ''}
                    <button onclick="adminDeleteBooking('${escapeHtml(b.id)}')" class="bg-red-50 hover:bg-red-600 hover:text-white text-red-600 border border-red-200 px-2.5 py-1 rounded-lg font-bold shadow-xs transition flex items-center gap-1" title="Delete Booking Transaction">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    });
}

async function adminOpenCancelModal(bookingId, totalFare, passengerName) {
    const refundStr = prompt(
        `বুকিং #${bookingId} বাতিল ও রিফান্ড অনুমোদন:\n\nযাত্রী: ${passengerName}\nমোট ভাড়া: ₹${totalFare}\n\nযাত্রীকে কত টাকা রিফান্ড দিতে চান? লিখুন (যেমন: ${totalFare}):`,
        String(totalFare)
    );
    if (refundStr === null) return;
    const refundAmount = parseFloat(refundStr);
    if (isNaN(refundAmount) || refundAmount < 0) {
        alert("দয়া করে সঠিক রিফান্ড পরিমাণ (টাকার অঙ্ক) লিখুন!");
        return;
    }

    const isAlreadyPaid = await showBusYatraConfirm({
        title: 'রিফান্ড প্রদান স্ট্যাটাস',
        subtitle: `রিফান্ড কি ইতিমধ্যেই প্রদান করা হয়েছে?\n\nহ্যাঁ = ${window.t('রিফান্ড সম্পন্ন', 'Refund Completed')}\nনা = ${window.t('রিফান্ড প্রক্রিয়াধীন', 'Refund Processing')}`,
        icon: '💰',
        confirmText: 'হ্যাঁ, সম্পন্ন হয়েছে',
        cancelText: 'না, প্রক্রিয়াধীন',
        danger: false
    });
    const refundStatus = isAlreadyPaid ? 'completed' : 'processing';

    try {
        await apiRequest(`/api/admin/bookings/${encodeURIComponent(bookingId)}/status`, {
            method: 'POST',
            body: JSON.stringify({
                status: 'Cancelled',
                refundAmount,
                refundStatus,
                remarks: `Cancelled by Admin with ₹${refundAmount} refund (${refundStatus})`
            })
        });
        await loadAdminDashboard();
        alert(`✅ বুকিং #${bookingId} সফলভাবে বাতিল করা হয়েছে।\nরিফান্ড পরিমাণ: ₹${refundAmount} (${refundStatus})।\nসিট মুক্ত হয়েছে।`);
    } catch (error) {
        alert("ত্রুটি: " + error.message);
    }
}
window.adminOpenCancelModal = adminOpenCancelModal;

async function adminCompleteRefund(bookingId, refundAmount) {
    const ok = await showBusYatraConfirm({ title: "রিফান্ড সম্পন্ন নিশ্চিতকরণ", subtitle: `আপনি কি নিশ্চিত যে বুকিং #${bookingId}-এর রিফান্ড বাবদ ₹${refundAmount} প্রদান সম্পন্ন হয়েছে?`, icon: "💰", confirmText: "হ্যাঁ, সম্পন্ন হয়েছে", cancelText: "বাতিল", danger: false }); if (!ok) return;

    try {
        await apiRequest(`/api/admin/bookings/${encodeURIComponent(bookingId)}/refund`, {
            method: 'POST',
            body: JSON.stringify({ refundStatus: 'completed' })
        });
        await loadAdminDashboard();
        alert(`✅ বুকিং #${bookingId}-এর রিফান্ড সম্পন্ন হয়েছে হিসেবে সফলভাবে চিহ্নিত করা হলো।`);
    } catch (error) {
        alert("ত্রুটি: " + error.message);
    }
}
window.adminCompleteRefund = adminCompleteRefund;

async function adminDeleteBooking(bookingId) {
    const ok = await showBusYatraConfirm({ title: "বুকিং রেকর্ড ডিলিট", subtitle: `Are you sure you want to permanently delete booking transaction #${bookingId}?

This will remove the booking and its financial record completely from all portals.`, icon: "🗑️", confirmText: "হ্যাঁ, ডিলিট করুন", cancelText: "বাতিল", danger: true }); if (!ok) return;
    try {
        const res = await apiRequest(`/api/admin/bookings/${encodeURIComponent(bookingId)}`, {
            method: 'DELETE'
        });
        alert(res.message || `Booking #${bookingId} deleted successfully.`);
        await Promise.all([
            loadAdminCustomersData(),
            loadAdminFinanceData(),
            loadAdminDashboard()
        ]);
    } catch (err) {
        alert(`Failed to delete booking: ${err.message}`);
    }
}
window.adminDeleteBooking = adminDeleteBooking;
window.toggleAdminSelectAll = toggleAdminSelectAll;

function printAdminTripManifest() {
    const db = getAppData();
    const busSelect = document.getElementById('customerBusFilter');
    const busId = busSelect ? busSelect.value : "";
    const date = document.getElementById('customerDateFilter')?.value;

    if (!busId) {
        alert(window.t("অনুগ্রহ করে ড্রপডাউন থেকে একটি নির্দিষ্ট বাস নির্বাচন করুন।", "Please select a specific bus from the dropdown."));
        if (busSelect) busSelect.focus();
        return;
    }
    if (!date) {
        alert(window.t("অনুগ্রহ করে ভ্রমণের তারিখ নির্বাচন করুন।", "Please select a journey date."));
        document.getElementById('customerDateFilter')?.focus();
        return;
    }

    const bus = (db.buses || []).find(b => b.id === busId);
    let bookings = Object.values(db.bookings || {}).filter(b => 
        (b.busId === busId || b.busId === (busId + '_RETURN')) && 
        b.date === date && 
        b.status === 'Approved'
    );

    let passengerRows = [];
    bookings.forEach(b => {
        const seats = Array.isArray(b.seats) ? b.seats : [b.seatNumber || '—'];
        seats.forEach(seat => {
            passengerRows.push({
                seat: seat,
                name: b.passengerName || '—',
                phone: b.passengerPhone || '—',
                boarding: b.boarding || '—',
                dropping: b.dropping || '—',
                fare: (b.fare / seats.length).toFixed(0),
                paymentMode: b.paymentMode || 'Cash',
                utr: b.utrNumber || b.upiTransactionId || '—',
                bookingId: b.id
            });
        });
    });

    passengerRows.sort((a, b) => (parseInt(a.seat) || 0) - (parseInt(b.seat) || 0));
    const totalCollected = passengerRows.reduce((acc, r) => acc + Number(r.fare), 0);

    const win = window.open('', '_blank');
    if (!win) {
        alert("Pop-up blocked. Please allow pop-ups to print the manifest.");
        return;
    }

    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Trip Passenger Manifest - ${escapeHtml(bus ? bus.name : 'Bus')}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 25px; color: #111; font-size: 13px; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
                .header h1 { margin: 0; font-size: 22px; color: #b91c1c; }
                .header p { margin: 4px 0; color: #555; }
                .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f9fafb; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px; }
                .info-grid div { font-size: 12px; }
                .info-grid strong { display: block; color: #374151; font-size: 11px; text-transform: uppercase; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; }
                th { background-color: #f3f4f6; font-size: 11px; text-transform: uppercase; color: #374151; }
                tr:nth-child(even) { background-color: #f9fafb; }
                .seat-col { font-weight: bold; font-size: 14px; text-align: center; color: #b91c1c; }
                .text-right { text-align: right; }
                .summary { margin-top: 20px; display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #fef2f2; border-radius: 8px; border: 1px solid #fecaca; font-weight: bold; }
                .print-btn { background: #b91c1c; color: white; border: none; padding: 10px 20px; font-size: 13px; font-weight: bold; border-radius: 6px; cursor: pointer; }
                @media print { .no-print { display: none; } body { padding: 0; } }
            </style>
        </head>
        <body>
            <div class="no-print" style="margin-bottom: 20px; text-align: right;">
                <button class="print-btn" onclick="window.print()">🖨️ Print Manifest</button>
            </div>
            <div class="header">
                <h1>🚌 Bus Yatra — Official Trip Passenger Manifest</h1>
                <p><strong>${escapeHtml(bus ? bus.name : 'Bus Yatra Fleet')} (${escapeHtml(bus ? bus.busNumber : '')})</strong></p>
                <p>Operator: ${escapeHtml(bus ? bus.ownerName : '—')} • Helpline: ${escapeHtml(bus ? bus.emergencyPhone || bus.ownerPhone : '—')}</p>
            </div>

            <div class="info-grid">
                <div><strong>Journey Date:</strong> ${escapeHtml(date)}</div>
                <div><strong>Scheduled Time:</strong> ${escapeHtml(bus ? bus.time : '07:00 AM')}</div>
                <div><strong>Operating Route:</strong> ${escapeHtml(bus ? bus.route : '—')}</div>
                <div><strong>Total Boarding:</strong> ${passengerRows.length} Passengers</div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 50px;">Seat</th>
                        <th>Passenger Name</th>
                        <th>Mobile</th>
                        <th>Boarding Stop</th>
                        <th>Dropping Stop</th>
                        <th>Fare (₹)</th>
                        <th>Payment</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${passengerRows.length === 0 ? '<tr><td colspan="8" style="text-align:center; padding: 20px; color:#6b7280;">' + window.t('এই বাস ও তারিখে কোনো অনুমোদিত যাত্রী বুকিং নেই।', 'No approved bookings found for this bus and date.') + '</td></tr>' : passengerRows.map(r => `
                        <tr>
                            <td class="seat-col">${escapeHtml(r.seat)}</td>
                            <td><strong>${escapeHtml(r.name)}</strong></td>
                            <td>${escapeHtml(r.phone)}</td>
                            <td>${escapeHtml(r.boarding)}</td>
                            <td>${escapeHtml(r.dropping)}</td>
                            <td class="text-right">₹${r.fare}</td>
                            <td>${escapeHtml(r.paymentMode)}</td>
                            <td><span style="color: #059669; font-weight: bold;">Confirmed</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="summary">
                <div>Total Seats Booked: ${passengerRows.length}</div>
                <div>Total Trip Fare Collection: ₹${totalCollected.toLocaleString()}</div>
            </div>

            <div style="margin-top: 30px; font-size: 11px; color: #6b7280; text-align: center;">
                Generated by Bus Yatra Master Admin Console • ${new Date().toLocaleString()}
            </div>
        </body>
        </html>
    `);
    win.document.close();
}
window.printAdminTripManifest = printAdminTripManifest;
window.handleAdminBookingCheckChange = handleAdminBookingCheckChange;
window.deleteAdminSelectedBookings = deleteAdminSelectedBookings;
window.deleteAdminAllOnDate = deleteAdminAllOnDate;

async function adminSetBookingStatus(bookingId, status) {
    try {
        await apiRequest(`/api/admin/bookings/${encodeURIComponent(bookingId)}/status`, {
            method: 'POST',
            body: JSON.stringify({ status })
        });
        await loadAdminDashboard();
        alert(`✅ Booking ${bookingId} marked as ${status}.`);
    } catch (error) {
        console.error(`Failed to update booking ${bookingId}:`, error);
        alert(`Could not update booking: ${error.message}`);
    }
}

function exportBookingsToCSV() {
    const db = getAppData();
    const bookings = Object.values(db.bookings || {});
    if (bookings.length === 0) {
        alert("No bookings to export.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Booking ID,Bus Name,Bus Number,Passenger Name,Phone,Seats,Boarding,Dropping,Date,Fare,Payment Mode,Status\n";
    bookings.forEach(b => {
        const row = [b.id, `"${b.busName}"`, b.busNumber, `"${b.passengerName}"`, b.passengerPhone, `"${(b.seats || []).join('-')}"`, `"${b.boarding}"`, `"${b.dropping}"`, b.date, b.fare, b.paymentMode, b.status];
        csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bus_yatra_bookings_${localDateStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Owners Directory & Reset PIN ---
async function loadAdminOwnerRequests() {
    const container = document.getElementById('adminOwnerRequests');
    if (!container) return;
    try {
        container.innerHTML = '<div class="text-center text-gray-400 py-6 text-xs">Loading owner requests...</div>';
        const result = await apiRequest('/api/admin/owner-requests');
        const requests = result.requests || [];
        const pendingBusesCount = (getAppData().buses || []).filter(b => b.approvalStatus === 'pending').length;
        const pendingPhotosCount = (getAppData().buses || []).filter(b => b.photoApprovalStatus === 'pending' || b.photo_approval_status === 'pending').length;
        const totalCount = requests.length + pendingBusesCount + pendingPhotosCount;
        ['badgePendingRequests', 'badgeSidebarRequests', 'badgeMobileRequests'].forEach(id => {
            const badge = document.getElementById(id);
            if (badge) {
                badge.innerText = totalCount;
                badge.classList.toggle('hidden', totalCount === 0);
            }
        });
        loadAdminPendingBusApprovals();
        loadAdminPendingPhotoApprovals();
        if (!requests.length) {
            container.innerHTML = '<div class="text-center text-gray-400 py-6 text-xs">No pending owner registration requests.</div>';
            return;
        }
        container.innerHTML = requests.map(request => `
            <article class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs space-y-2">
                <div class="font-bold text-sm text-gray-900">${escapeHtml(request.company_name)} — ${escapeHtml(request.name)}</div>
                <div><strong>Phone:</strong> ${escapeHtml(request.phone)} · <strong>Bus:</strong> ${escapeHtml(request.bus_number)}</div>
                <div><strong>Route:</strong> ${escapeHtml(request.route)}</div>
                <div><strong>Departure:</strong> ${escapeHtml(request.departure_time)} · <strong>Base fare:</strong> ₹${Number(request.fare)}</div>
                <a class="inline-block font-bold text-blue-700 underline" href="${escapeHtml(request.license_data)}" download="${escapeHtml(request.license_file_name)}">Download licence (${escapeHtml(request.license_mime_type)})</a>
                <div class="flex flex-wrap gap-2 pt-1">
                    <button type="button" onclick="reviewOwnerRequest('${escapeHtml(request.phone)}', 'approved')" class="rounded-lg bg-green-600 px-3 py-2 font-bold text-white">Approve owner &amp; create bus</button>
                    <button type="button" onclick="reviewOwnerRequest('${escapeHtml(request.phone)}', 'rejected')" class="rounded-lg bg-red-100 px-3 py-2 font-bold text-red-700">Reject</button>
                </div>
            </article>
        `).join('');
    } catch (error) {
        container.innerHTML = `<div class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">Could not load owner requests: ${escapeHtml(error.message)}</div>`;
    }
}

async function reviewOwnerRequest(phone, status) {
    const action = status === 'approved' ? 'approve' : 'reject';
    const ok = await showBusYatraConfirm({ title: "মালিকের অনুরোধ পর্যালোচনা", subtitle: `${action === "approve" ? "অনুমোদন (Approve)" : "বাতিল (Reject)"} the bus owner request for ${phone}?`, icon: action === "approve" ? "✅" : "⚠️", confirmText: action === "approve" ? "হ্যাঁ, অনুমোদন" : "হ্যাঁ, বাতিল", cancelText: "বাতিল", danger: action !== "approve" }); if (!ok) return;
    try {
        await apiRequest(`/api/admin/owner-requests/${encodeURIComponent(phone)}`, {
            method: 'POST',
            body: JSON.stringify({ status })
        });
        await Promise.all([loadAdminOwnerRequests(), loadAdminDashboard()]);
        alert(`Owner request ${status}.`);
    } catch (error) {
        alert(`Could not ${action} owner request: ${error.message}`);
    }
}

function renderAdminOwnersList() {
    const db = getAppData();
    const container = document.getElementById('adminOwnersContainer');
    const query = (document.getElementById('ownerSearchInput')?.value || "").toLowerCase();
    if (!container) return;

    container.innerHTML = "";
    const ownersMap = new Map();
    (adminOwnersData || []).forEach(o => {
        if (o.phone) ownersMap.set(o.phone, { ...o });
    });
    (db.buses || []).forEach(b => {
        if (b.ownerPhone) {
            const existing = ownersMap.get(b.ownerPhone) || { phone: b.ownerPhone, name: b.ownerName };
            existing.company_name = existing.company_name || b.companyName || b.name;
            existing.bus_number = existing.bus_number || b.busNumber;
            ownersMap.set(b.ownerPhone, existing);
        }
    });

    const owners = Array.from(ownersMap.values()).filter(o =>
        (o.name && o.name.toLowerCase().includes(query)) ||
        (o.phone && o.phone.includes(query)) ||
        (o.company_name && o.company_name.toLowerCase().includes(query)) ||
        (o.bus_number && o.bus_number.toLowerCase().includes(query))
    );

    if (owners.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-8 text-xs">No bus operators found.</div>`;
        return;
    }

    owners.forEach(o => {
        const msg = encodeURIComponent(`নমস্কার ${o.name || 'বাস ওনার'}, বাস যাত্রা ওনার পোর্টালে আপনার লগইন মোবাইল নম্বর: ${o.phone}${o.pin ? ' এবং পিন: ' + o.pin : ''}। পোর্টাল লিঙ্ক: https://busyatra.pages.dev/owner.html`);
        const statusBadge = o.status === 'suspended'
            ? ('<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">' + window.t('⚠️ স্থগিত', '⚠️ Suspended') + '</span>')
            : (o.status === 'banned' || o.status === 'permanently_banned')
                ? ('<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-800 border border-red-300">' + window.t('⛔ নিষিদ্ধ', '⛔ Banned') + '</span>')
                : ('<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-green-100 text-green-700 border border-green-300">' + window.t('🟢 সচল', '🟢 Active') + '</span>');

        container.innerHTML += `
            <div class="bg-gray-50 hover:bg-gray-100/70 p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs transition">
                <div class="space-y-1">
                    <div class="font-bold text-gray-900 text-sm flex flex-wrap items-center gap-2">
                        <span>${escapeHtml(o.company_name || o.name)} — ${escapeHtml(o.name)}</span>
                        ${statusBadge}
                    </div>
                    <div>📱 <strong>Mobile:</strong> <a href="tel:${escapeHtml(o.phone)}" class="text-blue-600 font-bold">${escapeHtml(o.phone)}</a> • 🚌 <strong>Bus:</strong> ${escapeHtml(o.bus_number || 'N/A')}</div>
                    <div>🔑 <strong>${window.t('লগইন পিন (PIN):', 'Login PIN:')}</strong> <span class="font-mono bg-yellow-100 text-yellow-900 border border-yellow-300 px-2.5 py-0.5 rounded font-black text-xs">${escapeHtml(o.pin || '••••')}</span></div>
                    <div>${formatDeviceInlineBadge(o)}</div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <button type="button" onclick="adminAccessOwnerPortal('${escapeHtml(o.phone)}', '${escapeHtml(o.name || o.company_name)}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1.5 active:scale-95" title="Access Owner Panel Directly">
                        👑 ${window.t('ওনার প্যানেল', 'Owner Portal')}
                    </button>
                    <button type="button" onclick="openAdminOwnerPaymentRulesModal('${escapeHtml(o.phone)}', '${escapeHtml(o.name || o.company_name)}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1" title="Configure Payment Rules for All Buses of this Owner">
                        💳 ${window.t('পেমেন্ট রুলস', 'Payment Rules')}
                    </button>
                    <button type="button" onclick="openAdminOwnerFeaturesNextGen('${escapeHtml(o.phone)}')" class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1" title="Customize Next-Gen Features">
                        ⚡ Next-Gen Features
                    </button>
                    ${(o.status === 'suspended' || o.status === 'banned' || o.status === 'permanently_banned') ? `
                        <button type="button" onclick="adminToggleUserAccess('${escapeHtml(o.phone)}', 'owner', 'activate')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition">
                            🟢 Re-activate
                        </button>
                    ` : `
                        <button type="button" onclick="adminToggleUserAccess('${escapeHtml(o.phone)}', 'owner', 'suspend')" class="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition" title="Suspend Owner">
                            ⚠️ Suspend
                        </button>
                        <button type="button" onclick="adminToggleUserAccess('${escapeHtml(o.phone)}', 'owner', 'ban')" class="bg-red-700 hover:bg-red-800 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition" title="Permanent Ban">
                            ⛔ Ban
                        </button>
                    `}
                    <a href="https://wa.me/91${escapeHtml(o.phone)}?text=${msg}" target="_blank" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1">
                        💬 WhatsApp
                    </a>
                    <button type="button" onclick="adminResetOwnerPin('${escapeHtml(o.phone)}')" class="bg-gray-900 hover:bg-black text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition">
                        🔑 PIN
                    </button>
                    <button type="button" onclick="adminDeleteOwner('${escapeHtml(o.phone)}', '${escapeHtml(o.name || o.company_name)}')" class="bg-red-50 hover:bg-red-600 hover:text-white text-red-600 border border-red-200 px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition flex items-center gap-1 active:scale-95" title="Delete Owner & All Buses">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    });
}

async function adminResetOwnerPin(identifier) {
    const newPin = prompt("Enter new 4-digit PIN for this owner:");
    if (!newPin || newPin.length !== 4) {
        alert("PIN must be exactly 4 digits.");
        return;
    }
    try {
        await apiRequest('/api/admin/reset-pin', {
            method: 'POST',
            body: JSON.stringify({ role: 'owner', identifier, newPin: newPin.trim() })
        });
        sharePortalPin('Owner', identifier, newPin.trim(), 'owner');
        await loadAdminOwnersData();
    } catch (error) {
        alert(`Could not reset owner PIN: ${error.message}`);
    }
}

// Admin Owner Feature Control Modal Handlers
let currentFeatureOwnerPhone = '';

function openAdminOwnerFeaturesModal(phone) {
    currentFeatureOwnerPhone = phone;
    const owner = (adminOwnersData || []).find(o => o.phone === phone) || { phone };
    const nameEl = document.getElementById('featureModalOwnerName');
    const phoneEl = document.getElementById('featureModalOwnerPhone');
    if (nameEl) nameEl.innerText = `${owner.company_name || owner.name || 'Bus Owner'} (${owner.name || ''})`;
    if (phoneEl) phoneEl.innerText = owner.phone || phone;

    const f = owner.features || {};
    document.getElementById('featureToggleAutoPilot').checked = f.auto_pilot !== false;
    document.getElementById('featureToggleNotifications').checked = f.notifications !== false;
    document.getElementById('featureToggleCaptains').checked = f.captains !== false;
    document.getElementById('featureToggleFinance').checked = f.finance !== false;
    document.getElementById('featureToggleLiveTracking').checked = f.live_tracking !== false;
    document.getElementById('featureToggleEditBus').checked = f.edit_bus !== false;

    document.getElementById('adminOwnerFeaturesModal')?.classList.remove('hidden');
}

function closeAdminOwnerFeaturesModal() {
    currentFeatureOwnerPhone = '';
    document.getElementById('adminOwnerFeaturesModal')?.classList.add('hidden');
}

async function saveAdminOwnerFeatures() {
    if (!currentFeatureOwnerPhone) return;
    const saveBtn = document.getElementById('saveOwnerFeaturesBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = 'Saving...';
    }
    const features = {
        auto_pilot: document.getElementById('featureToggleAutoPilot').checked,
        notifications: document.getElementById('featureToggleNotifications').checked,
        captains: document.getElementById('featureToggleCaptains').checked,
        finance: document.getElementById('featureToggleFinance').checked,
        live_tracking: document.getElementById('featureToggleLiveTracking').checked,
        edit_bus: document.getElementById('featureToggleEditBus').checked
    };

    try {
        await apiRequest(`/api/admin/owners/${encodeURIComponent(currentFeatureOwnerPhone)}/features`, {
            method: 'POST',
            body: JSON.stringify({ phone: currentFeatureOwnerPhone, features })
        });
        alert('✅ Owner permissions updated successfully! The owner portal will reflect these changes immediately.');
        closeAdminOwnerFeaturesModal();
        await loadAdminOwnersData();
    } catch (error) {
        alert('Failed to update features: ' + error.message);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerText = '💾 Save Permissions';
        }
    }
}

// Quick Bus Rating Modal Handlers
let currentQuickRatingBusId = '';

function openAdminQuickRatingModal(busId, busName, currentRating) {
    currentQuickRatingBusId = busId;
    const nameEl = document.getElementById('adminRatingBusName');
    const inputEl = document.getElementById('adminQuickRatingInput');
    if (nameEl) nameEl.innerText = busName || 'Bus Coach';
    if (inputEl) inputEl.value = Number(currentRating || 4.8).toFixed(1);
    document.getElementById('adminBusRatingModal')?.classList.remove('hidden');
}

function closeAdminBusRatingModal() {
    currentQuickRatingBusId = '';
    document.getElementById('adminBusRatingModal')?.classList.add('hidden');
}

function stepAdminRating(delta) {
    const input = document.getElementById('adminQuickRatingInput');
    if (!input) return;
    let val = parseFloat(input.value) || 4.8;
    val = Math.round((val + delta) * 10) / 10;
    val = Math.min(5.0, Math.max(1.0, val));
    input.value = val.toFixed(1);
}

function setQuickRatingValue(val) {
    const input = document.getElementById('adminQuickRatingInput');
    if (input) input.value = Number(val).toFixed(1);
}

async function saveAdminQuickRating() {
    if (!currentQuickRatingBusId) return;
    const input = document.getElementById('adminQuickRatingInput');
    const rating = Math.min(5.0, Math.max(1.0, parseFloat(input?.value || 4.8)));
    const btn = document.getElementById('saveQuickRatingBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Saving...';
    }
    try {
        await apiRequest(`/api/admin/buses/${encodeURIComponent(currentQuickRatingBusId)}/rating`, {
            method: 'POST',
            body: JSON.stringify({ busId: currentQuickRatingBusId, rating })
        });
        closeAdminBusRatingModal();
        await loadAdminDashboard();
        alert(`✅ Bus rating updated to ⭐ ${rating.toFixed(1)}! Customer search will now show this rating badge.`);
    } catch (error) {
        alert('Failed to update rating: ' + error.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = '⭐ Update Rating';
        }
    }
}

window.openAdminOwnerFeaturesModal = openAdminOwnerFeaturesModal;
window.closeAdminOwnerFeaturesModal = closeAdminOwnerFeaturesModal;
window.saveAdminOwnerFeatures = saveAdminOwnerFeatures;
window.openAdminQuickRatingModal = openAdminQuickRatingModal;
window.closeAdminBusRatingModal = closeAdminBusRatingModal;
window.stepAdminRating = stepAdminRating;
window.setQuickRatingValue = setQuickRatingValue;
window.saveAdminQuickRating = saveAdminQuickRating;

// --- Dynamic Promo Codes Manager ---
function renderAdminCouponsList() {
    const db = getAppData();
    const container = document.getElementById('adminCouponsContainer');
    if (!container) return;

    container.innerHTML = "";
    const coupons = db.coupons || [];
    if (coupons.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-6 text-xs">No active discount coupons created yet.</div>`;
        return;
    }

    coupons.forEach((c, idx) => {
        container.innerHTML += `
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 flex justify-between items-center text-xs">
                <div>
                    <span class="font-mono font-bold text-red-600 text-sm">${escapeHtml(c.code)}</span> —
                    <span class="font-semibold">₹${c.discount} OFF</span>
                    <span class="text-gray-400 ml-2">(${c.active ? '🟢 Active' : '🔴 Inactive'})</span>
                </div>
                <button onclick="deleteAdminCoupon(${idx})" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-bold">Delete</button>
            </div>
        `;
    });
}

async function addNewCoupon() {
    const code = document.getElementById('newCouponCode').value.trim().toUpperCase();
    const discount = parseFloat(document.getElementById('newCouponDiscount').value) || 50;
    if (!code) {
        alert("Please enter a coupon code.");
        return;
    }
    try {
        await apiRequest('/api/admin/coupons', {
            method: 'POST',
            body: JSON.stringify({ code, discount, active: true })
        });
        const state = await apiRequest('/api/admin/state');
        setAppData({ coupons: state.coupons });
        document.getElementById('newCouponCode').value = "";
        renderAdminCouponsList();
        alert("✅ Coupon created successfully!");
    } catch (error) {
        alert(`Could not create coupon: ${error.message}`);
    }
}

async function deleteAdminCoupon(idx) {
    const db = getAppData();
    const coupon = (db.coupons || [])[idx];
    if (coupon) {
        try {
            await apiRequest(`/api/admin/coupons/${encodeURIComponent(coupon.code)}`, { method: 'DELETE' });
            const state = await apiRequest('/api/admin/state');
            setAppData({ coupons: state.coupons });
        } catch (error) {
            alert(`Could not delete coupon: ${error.message}`);
        }
        renderAdminCouponsList();
    }
}

// --- Promotional Popup Banner Ads Manager ---
let adminPromotionsCache = [];

function resolveAdminPromoMediaInfo(rawUrl, declaredType = '') {
    if (typeof parsePromoMediaSource === 'function') {
        return parsePromoMediaSource(rawUrl, declaredType);
    }
    const clean = String(rawUrl || '').trim();
    const isVid = /^data:video\//i.test(clean) || /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(clean) || String(declaredType || '').toLowerCase() === 'video';
    return { kind: isVid ? 'video' : 'image', src: clean };
}

function renderPromoMediaPreviewSlot(slot, rawUrl, declaredType = '', title = 'Ad Preview') {
    if (!slot) return;
    slot.innerHTML = '';
    const clean = String(rawUrl || '').trim();
    if (!clean) return;
    const media = resolveAdminPromoMediaInfo(clean, declaredType);

    if (media.kind === 'youtube' && media.embedUrl) {
        const wrap = document.createElement('div');
        wrap.className = 'w-full aspect-video max-h-[260px] bg-black rounded-2xl overflow-hidden';
        wrap.style.width = '100%';
        wrap.style.aspectRatio = '16 / 9';
        wrap.style.maxHeight = '260px';
        const iframe = document.createElement('iframe');
        iframe.src = media.embedUrl;
        iframe.title = title;
        iframe.className = 'w-full h-full border-0 block';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = '0';
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
        iframe.allowFullscreen = true;
        wrap.appendChild(iframe);
        slot.appendChild(wrap);
        return;
    }

    if (media.kind === 'video') {
        const vid = document.createElement('video');
        vid.src = media.src;
        vid.controls = true;
        vid.autoplay = true;
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.className = 'w-full h-auto max-h-[260px] object-contain rounded-2xl bg-slate-950 block mx-auto';
        vid.style.width = '100%';
        vid.style.height = 'auto';
        vid.style.maxHeight = '260px';
        vid.style.objectFit = 'contain';
        vid.style.display = 'block';
        slot.appendChild(vid);
        return;
    }

    const img = document.createElement('img');
    img.src = media.src;
    img.alt = title;
    img.className = 'w-full h-auto max-h-[260px] object-contain rounded-2xl block mx-auto';
    img.style.width = '100%';
    img.style.height = 'auto';
    img.style.maxHeight = '260px';
    img.style.objectFit = 'contain';
    img.style.display = 'block';
    slot.appendChild(img);
}

async function loadAdminPromotions() {
    const container = document.getElementById('adminPromotionsContainer');
    if (container) {
        container.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10 text-xs">বিজ্ঞাপন লোড হচ্ছে...</div>';
    }
    try {
        const res = await apiRequest('/api/admin/promotions');
        const promos = (res && res.promotions) || [];
        adminPromotionsCache = promos;
        const globalToggle = document.getElementById('flagAdminSearchAdsToggle');
        if (globalToggle && res && res.searchBannerAdsEnabled !== undefined) {
            globalToggle.checked = res.searchBannerAdsEnabled !== false;
        }
        renderAdminPromotionsList(promos);
        updateAdminPromoStats(promos);
    } catch (err) {
        console.error('Failed to load promotions:', err);
        if (container) {
            container.innerHTML = `<div class="col-span-full text-center text-red-500 py-8 text-xs font-semibold">বিজ্ঞাপন লোড করতে ব্যর্থ হয়েছে: ${escapeHtml(err.message || 'Error')}</div>`;
        }
    }
}

async function adminToggleGlobalSearchAds(enabled) {
    const toggle = document.getElementById('flagAdminSearchAdsToggle');
    try {
        const res = await apiRequest('/api/admin/feature-flags', {
            method: 'POST',
            body: JSON.stringify({ searchBannerAds: Boolean(enabled) })
        });
        if (res && res.featureFlags && typeof setAppData === 'function') {
            setAppData({ featureFlags: res.featureFlags });
        }
        alert(enabled
            ? '✅ কাস্টমার প্যানেলের Search-এর নিচের বিজ্ঞাপন চালু (ON) করা হয়েছে।'
            : '⏸️ কাস্টমার প্যানেলের Search-এর নিচের সমস্ত বিজ্ঞাপন বন্ধ (OFF) করা হয়েছে।');
    } catch (err) {
        if (toggle) toggle.checked = !enabled;
        alert(err.message || 'সেটিংস আপডেট ব্যর্থ হয়েছে।');
    }
}

function updateAdminPromoStats(promos) {
    const total = promos.length;
    const active = promos.filter(p => Boolean(p.active)).length;
    const views = promos.reduce((sum, p) => sum + (parseInt(p.views_count, 10) || 0), 0);
    const clicks = promos.reduce((sum, p) => sum + (parseInt(p.clicks_count, 10) || 0), 0);

    const elTotal = document.getElementById('statTotalPromos');
    const elActive = document.getElementById('statActivePromos');
    const elViews = document.getElementById('statPromoViews');
    const elClicks = document.getElementById('statPromoClicks');
    const badgeTab = document.getElementById('badgeActivePromos');
    const badgeSide = document.getElementById('badgeSidebarPromos');

    if (elTotal) elTotal.innerText = total;
    if (elActive) elActive.innerText = active;
    if (elViews) elViews.innerText = views;
    if (elClicks) elClicks.innerText = clicks;

    if (badgeTab) {
        badgeTab.innerText = active;
        badgeTab.classList.toggle('hidden', active === 0);
    }
    if (badgeSide) {
        badgeSide.innerText = active;
        badgeSide.classList.toggle('hidden', active === 0);
    }
    const badgeMob = document.getElementById('badgeMobilePromos');
    if (badgeMob) {
        badgeMob.innerText = active;
        badgeMob.classList.toggle('hidden', active === 0);
    }
}

function renderAdminPromotionsList(promos) {
    const container = document.getElementById('adminPromotionsContainer');
    if (!container) return;

    if (!promos || promos.length === 0) {
        container.innerHTML = `
            <div class="col-span-full bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
                <span class="text-3xl block mb-2">🎯</span>
                <p class="font-bold text-gray-700 text-sm mb-1">${window.t('কোনো প্রমোশনাল বিজ্ঞাপন তৈরি করা হয়নি', 'No Promotional Banners Created')}</p>
                <p class="text-xs text-gray-400 mb-4">${window.t('Search-এর নিচে বা পপআপে ছবি ও ভিডিও বিজ্ঞাপন তৈরি করতে নিচের বাটনে ক্লিক করুন।', 'Click below to create a new promotional photo or video ad.')}</p>
                <button type="button" onclick="openAdminPromoModal()" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition inline-flex items-center gap-1.5">
                    <span>➕</span> <span>${window.t('বিজ্ঞাপন তৈরি করুন', 'Create Ad Banner')}</span>
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = promos.map(promo => {
        const isActive = Boolean(promo.active);
        const media = resolveAdminPromoMediaInfo(promo.image_url, promo.media_type);
        const targetLabel = promo.target === 'customer' 
            ? '👤 কাস্টমার' 
            : (promo.target === 'owner' ? '🚌 বাস মালিক' : '🌐 উভয় প্যানেল');
        const targetClass = promo.target === 'customer' 
            ? 'bg-blue-100 text-blue-800 border-blue-200' 
            : (promo.target === 'owner' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-purple-100 text-purple-800 border-purple-200');

        const placement = String(promo.placement || 'popup').toLowerCase();
        const placementBadge = placement === 'search_banner'
            ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">📍 Search নিচে</span>'
            : (placement === 'both'
                ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200">🌟 উভয় জায়গায়</span>'
                : '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 border border-gray-200">🪟 পপআপ</span>');

        const mediaTypeBadge = media.kind === 'youtube'
            ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white shadow-xs">▶ YouTube</span>'
            : (media.kind === 'video'
                ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900/90 text-white border border-white/25 shadow-xs">🎬 ভিডিও</span>'
                : '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/95 text-gray-800 border border-gray-200 shadow-xs">🖼️ ছবি</span>');

        let mediaHtml = '';
        if (media.kind === 'youtube' && media.youtubeId) {
            mediaHtml = `<img src="https://img.youtube.com/vi/${encodeURIComponent(media.youtubeId)}/hqdefault.jpg" alt="${escapeHtml(promo.title || 'Ad')}" class="w-full h-full object-contain bg-black">`;
        } else if (media.kind === 'video') {
            mediaHtml = `<video src="${escapeHtml(media.src)}" muted autoplay loop playsinline preload="metadata" class="w-full h-full object-contain bg-slate-950"></video>`;
        } else {
            mediaHtml = `<img src="${escapeHtml(media.src)}" alt="${escapeHtml(promo.title || 'Ad')}" class="w-full h-full object-contain bg-slate-950">`;
        }

        return `
            <div class="bg-white rounded-2xl border ${isActive ? 'border-emerald-200 shadow-sm' : 'border-gray-200 opacity-80'} overflow-hidden flex flex-col justify-between transition-all hover:shadow-md">
                <!-- Top Full Uncropped Photo/Video Thumbnail & Badges -->
                <div class="relative bg-slate-950 aspect-[16/10] overflow-hidden flex items-center justify-center border-b">
                    ${mediaHtml}
                    <div class="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-xs ${targetClass}">
                            ${targetLabel}
                        </span>
                        ${mediaTypeBadge}
                    </div>
                    <div class="absolute top-2.5 right-2.5">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs ${isActive ? 'bg-emerald-600 text-white' : 'bg-gray-600 text-white'}">
                            ${isActive ? window.t('🟢 চালু', '🟢 Active') : window.t('⏸️ সাময়িক বন্ধ', '⏸️ Paused')}
                        </span>
                    </div>
                </div>

                <!-- Info & Metrics -->
                <div class="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                        <div class="flex items-center justify-between gap-2 mb-1">
                            <h4 class="font-bold text-gray-900 text-sm line-clamp-1">${escapeHtml(promo.title || 'বিজ্ঞাপন')}</h4>
                            ${placementBadge}
                        </div>
                        ${promo.link_url ? `
                            <div class="flex items-center gap-1 text-[11px] text-blue-600 font-mono truncate" title="${escapeHtml(promo.link_url)}">
                                <span>🔗</span>
                                <span class="truncate">${escapeHtml(promo.link_url)}</span>
                            </div>
                        ` : `
                            <span class="text-[11px] text-gray-400 italic">কোনো লিঙ্ক নেই (শুধুমাত্র ${media.kind === 'image' ? 'ছবি' : 'ভিডিও'})</span>
                        `}
                    </div>

                    <!-- Metrics -->
                    <div class="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-[11px]">
                        <div>
                            <span class="text-gray-400 font-bold block text-[9px] uppercase">${window.t('দেখা হয়েছে', 'Views')}</span>
                            <span class="font-black text-gray-800 text-sm">${promo.views_count || 0}</span>
                        </div>
                        <div>
                            <span class="text-gray-400 font-bold block text-[9px] uppercase">${window.t('ক্লিক', 'Clicks')}</span>
                            <span class="font-black text-purple-700 text-sm">${promo.clicks_count || 0}</span>
                        </div>
                    </div>

                    <!-- Action Controls -->
                    <div class="flex items-center gap-2 pt-1 border-t border-gray-100">
                        <button type="button" onclick="toggleAdminPromoStatus('${escapeHtml(promo.id)}')" class="flex-1 py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 ${isActive ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'}">
                            <span>${isActive ? '⏸️ বন্ধ করুন' : '▶️ চালু করুন'}</span>
                        </button>
                        <button type="button" onclick="openAdminPromoModal('${escapeHtml(promo.id)}')" class="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition" title="সম্পাদনা">
                            ✏️
                        </button>
                        <button type="button" onclick="deleteAdminPromo('${escapeHtml(promo.id)}')" class="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs transition" title="মুছে ফেলুন">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openAdminPromoModal(promoId = null) {
    const modal = document.getElementById('adminPromoCreateModal');
    const titleEl = document.getElementById('adminPromoModalTitle');
    const editIdEl = document.getElementById('promoEditId');
    const mediaTypeEl = document.getElementById('promoMediaType');
    const pTitle = document.getElementById('promoTitle');
    const pUrlInput = document.getElementById('promoImageUrlInput');
    const pFile = document.getElementById('promoImageFile');
    const pLink = document.getElementById('promoLinkUrl');
    const pActive = document.getElementById('promoActiveStatus');
    const statusText = document.getElementById('promoUploadStatusText');
    const previewWrapper = document.getElementById('promoPreviewWrapper');
    const previewSlot = document.getElementById('promoPreviewMediaSlot');

    if (pFile) pFile.value = '';
    if (statusText) { statusText.innerText = ''; statusText.classList.add('hidden'); }
    if (previewWrapper) previewWrapper.classList.add('hidden');
    if (previewSlot) previewSlot.innerHTML = '';

    if (promoId) {
        const promo = adminPromotionsCache.find(p => p.id === promoId);
        if (promo) {
            const media = resolveAdminPromoMediaInfo(promo.image_url, promo.media_type);
            if (titleEl) titleEl.innerText = window.t('বিজ্ঞাপন সম্পাদনা করুন', 'Edit Ad');
            if (editIdEl) editIdEl.value = promo.id;
            if (mediaTypeEl) mediaTypeEl.value = media.kind === 'image' ? 'image' : 'video';
            if (pTitle) pTitle.value = promo.title || '';
            if (pUrlInput) pUrlInput.value = promo.image_url || '';
            if (pLink) pLink.value = promo.link_url || '';
            if (pActive) pActive.checked = Boolean(promo.active);

            const targetRadio = document.querySelector(`input[name="promoTarget"][value="${promo.target || 'customer'}"]`);
            if (targetRadio) targetRadio.checked = true;

            const placeRadio = document.querySelector(`input[name="promoPlacement"][value="${promo.placement || 'search_banner'}"]`);
            if (placeRadio) placeRadio.checked = true;

            if (promo.image_url && previewWrapper && previewSlot) {
                renderPromoMediaPreviewSlot(previewSlot, promo.image_url, promo.media_type, promo.title || 'Preview');
                previewWrapper.classList.remove('hidden');
            }
        }
    } else {
        if (titleEl) titleEl.innerText = window.t('নতুন বিজ্ঞাপন তৈরি করুন', 'Create Ad');
        if (editIdEl) editIdEl.value = '';
        if (mediaTypeEl) mediaTypeEl.value = 'image';
        if (pTitle) pTitle.value = '';
        if (pUrlInput) pUrlInput.value = '';
        if (pLink) pLink.value = '';
        if (pActive) pActive.checked = true;
        const defaultTarget = document.querySelector('input[name="promoTarget"][value="customer"]');
        if (defaultTarget) defaultTarget.checked = true;
        const defaultPlacement = document.querySelector('input[name="promoPlacement"][value="search_banner"]');
        if (defaultPlacement) defaultPlacement.checked = true;
    }

    if (modal) modal.classList.remove('hidden');
}

function closeAdminPromoModal() {
    const modal = document.getElementById('adminPromoCreateModal');
    const previewSlot = document.getElementById('promoPreviewMediaSlot');
    if (previewSlot) previewSlot.innerHTML = '';
    if (modal) modal.classList.add('hidden');
}

async function previewAdminPromoFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const urlInput = document.getElementById('promoImageUrlInput');
    const mediaTypeEl = document.getElementById('promoMediaType');
    const previewSlot = document.getElementById('promoPreviewMediaSlot');
    const previewWrapper = document.getElementById('promoPreviewWrapper');
    const statusText = document.getElementById('promoUploadStatusText');
    const isVideo = String(file.type || '').startsWith('video/');

    if (statusText) {
        statusText.innerText = isVideo
            ? '🎬 ভিডিও প্রক্রিয়াকরণ হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন'
            : '🖼️ ছবি প্রস্তুত করা হচ্ছে...';
        statusText.classList.remove('hidden');
    }

    try {
        let dataUrl = '';
        if (isVideo) {
            dataUrl = typeof readPromoVideoAsDataUrl === 'function'
                ? await readPromoVideoAsDataUrl(file)
                : await readImageFileAsDataUrl(file);
            if (mediaTypeEl) mediaTypeEl.value = 'video';
        } else {
            dataUrl = typeof compressPromoImagePreserveAspect === 'function'
                ? await compressPromoImagePreserveAspect(file, 1200, 0.84)
                : await readImageFileAsDataUrl(file);
            if (mediaTypeEl) mediaTypeEl.value = 'image';
        }

        if (urlInput) urlInput.value = dataUrl;
        if (previewSlot) {
            renderPromoMediaPreviewSlot(previewSlot, dataUrl, isVideo ? 'video' : 'image', file.name);
        }
        if (previewWrapper) previewWrapper.classList.remove('hidden');
        if (statusText) {
            statusText.innerText = isVideo ? '✅ ভিডিও লোড সম্পন্ন হয়েছে' : '✅ সম্পূর্ণ আনক্রপড ছবি লোড সম্পন্ন হয়েছে';
        }
    } catch (e) {
        console.warn('Promo media preview failed:', e);
        if (statusText) {
            statusText.innerText = '❌ ' + (e.message || 'ফাইল লোড করা যায়নি।');
        }
        alert(e.message || 'ফাইল লোড করা যায়নি।');
    }
}

function previewAdminPromoUrl(url) {
    const mediaTypeEl = document.getElementById('promoMediaType');
    const previewSlot = document.getElementById('promoPreviewMediaSlot');
    const previewWrapper = document.getElementById('promoPreviewWrapper');
    if (!previewSlot || !previewWrapper) return;

    const clean = String(url || '').trim();
    if (clean.length > 5) {
        const media = resolveAdminPromoMediaInfo(clean);
        const type = media.kind === 'image' ? 'image' : 'video';
        if (mediaTypeEl) mediaTypeEl.value = type;
        renderPromoMediaPreviewSlot(previewSlot, clean, type, 'URL Preview');
        previewWrapper.classList.remove('hidden');
    } else {
        previewSlot.innerHTML = '';
        previewWrapper.classList.add('hidden');
    }
}

async function saveAdminPromo() {
    const editId = (document.getElementById('promoEditId')?.value || '').trim();
    const title = (document.getElementById('promoTitle')?.value || '').trim() || 'Promotional Offer';
    const imageUrl = (document.getElementById('promoImageUrlInput')?.value || '').trim();
    const linkUrl = (document.getElementById('promoLinkUrl')?.value || '').trim();
    const active = document.getElementById('promoActiveStatus')?.checked !== false;
    const target = document.querySelector('input[name="promoTarget"]:checked')?.value || 'customer';
    const placement = document.querySelector('input[name="promoPlacement"]:checked')?.value || 'search_banner';
    const declaredType = (document.getElementById('promoMediaType')?.value || '').trim();
    const mediaInfo = resolveAdminPromoMediaInfo(imageUrl, declaredType);
    const mediaType = mediaInfo.kind === 'image' ? 'image' : 'video';

    if (!imageUrl) {
        alert('অনুগ্রহ করে বিজ্ঞাপনের একটি ছবি বা ভিডিও আপলোড করুন অথবা লিঙ্ক দিন।');
        return;
    }

    const btn = document.getElementById('savePromoBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'সেভ হচ্ছে...';
    }

    try {
        const payload = {
            id: editId || undefined,
            title,
            image_url: imageUrl,
            media_type: mediaType,
            placement,
            target,
            link_url: linkUrl,
            active
        };

        const res = await apiRequest('/api/admin/promotions', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        alert(res.message || 'বিজ্ঞাপন সফলভাবে তৈরি করা হয়েছে!');
        closeAdminPromoModal();
        await loadAdminPromotions();
    } catch (err) {
        alert(err.message || 'বিজ্ঞাপন সেভ করতে ব্যর্থ হয়েছে।');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span>✓ ' + window.t('প্রকাশ করুন', 'Publish Ad') + '</span>';
        }
    }
}

async function toggleAdminPromoStatus(promoId) {
    try {
        const res = await apiRequest(`/api/admin/promotions/${encodeURIComponent(promoId)}/toggle`, {
            method: 'POST'
        });
        alert(res.message || 'বিজ্ঞাপনের অবস্থা পরিবর্তিত হয়েছে।');
        await loadAdminPromotions();
    } catch (err) {
        alert(err.message || 'স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে।');
    }
}

async function deleteAdminPromo(promoId) {
    const ok = await showBusYatraConfirm({ title: "বিজ্ঞাপন মুছে ফেলা", subtitle: "আপনি কি নিশ্চিত এই বিজ্ঞাপনটি মুছে ফেলতে চান? এটি মুছে দিলে কাস্টমার ও মালিক প্যানেল থেকে তৎক্ষণাৎ বন্ধ হয়ে যাবে।", icon: "🗑️", confirmText: "হ্যাঁ, মুছে ফেলুন", cancelText: "বাতিল", danger: true }); if (!ok) return;

    try {
        const res = await apiRequest(`/api/admin/promotions/${encodeURIComponent(promoId)}`, {
            method: 'DELETE'
        });
        alert(res.message || 'বিজ্ঞাপন সম্পূর্ণ মুছে ফেলা হয়েছে।');
        await loadAdminPromotions();
    } catch (err) {
        alert(err.message || 'মুছে ফেলতে ব্যর্থ হয়েছে।');
    }
}

window.loadAdminPromotions = loadAdminPromotions;
window.adminToggleGlobalSearchAds = adminToggleGlobalSearchAds;
window.openAdminPromoModal = openAdminPromoModal;
window.closeAdminPromoModal = closeAdminPromoModal;
window.previewAdminPromoFile = previewAdminPromoFile;
window.previewAdminPromoUrl = previewAdminPromoUrl;
window.saveAdminPromo = saveAdminPromo;
window.toggleAdminPromoStatus = toggleAdminPromoStatus;
window.deleteAdminPromo = deleteAdminPromo;

// --- Global Feature Flags Management ---
function renderAdminFeatureFlags() {
    const db = getAppData();
    const flags = db.featureFlags || {};
    const expConfig = flags.expansionConfig || {};
    const liveTrackingCfg = expConfig.liveTracking || {};

    const setChecked = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = Boolean(val);
    };
    const setValue = (id, val, fallback = '') => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
        else if (el && fallback) el.value = fallback;
    };

    setChecked('flagOnlinePay', flags.onlinePayment);
    setChecked('flagCashPay', flags.cashPayment);
    setChecked('flagCaptain', flags.captainPortal);
    setChecked('flagWindowPricing', flags.windowSeatPricing);
    setChecked('flagPromo', flags.promoCodes);
    setChecked('flagLiveTracking', flags.liveTracking !== false);
    setChecked('flagFeedback', flags.customerFeedback);
    setChecked('flagTripReminders', flags.tripReminders !== false);

    // Live Tracking Window controls
    const isWindowEnabled = flags.trackingLeadWindowEnabled !== false && liveTrackingCfg.leadWindowEnabled !== false;
    setChecked('flagTrackingLeadWindowEnabled', isWindowEnabled);
    const leadHours = (flags.trackingLeadHours !== undefined) ? flags.trackingLeadHours : (liveTrackingCfg.leadHours !== undefined ? liveTrackingCfg.leadHours : 5);
    setValue('cfgTrackingLeadHours', leadHours, 5);
    const graceMins = (flags.trackingGraceMinutes !== undefined) ? flags.trackingGraceMinutes : (liveTrackingCfg.graceMinutes !== undefined ? liveTrackingCfg.graceMinutes : 30);
    setValue('cfgTrackingGraceMinutes', graceMins, 30);

    // Temporary Seat Hold Timer controls
    const seatHoldCfg = expConfig.seatHold || {};
    const isSeatHoldEnabled = flags.seatHoldTimer !== false && seatHoldCfg.enabled !== false;
    setChecked('flagSeatHoldTimer', isSeatHoldEnabled);
    const holdMins = (flags.seatHoldMinutes !== undefined) ? flags.seatHoldMinutes : (seatHoldCfg.holdMinutes !== undefined ? seatHoldCfg.holdMinutes : 15);
    setValue('cfgSeatHoldMinutes', holdMins, 15);

    // Ticket Cancellation & Cutoff Hours controls
    const cancelCfg = expConfig.ticketCancellation || {};
    const isCancelEnabled = flags.ticketCancellation !== false && cancelCfg.enabled !== false;
    setChecked('flagTicketCancellation', isCancelEnabled);
    const isCancelCutoffEnabled = flags.cancellationCutoffEnabled !== false && cancelCfg.cutoffEnabled !== false;
    setChecked('flagCancellationCutoffEnabled', isCancelCutoffEnabled);
    const cancelCutoffHours = (flags.cancellationCutoffHours !== undefined)
        ? flags.cancellationCutoffHours
        : (cancelCfg.cutoffHours !== undefined ? cancelCfg.cutoffHours : 8);
    setValue('cfgCancellationCutoffHours', cancelCutoffHours, 8);

    // En-Route Running Booking, Stoppage-Wise Fares & Segment Seat Reuse controls
    setChecked('flagEnrouteRunningBooking', flags.enrouteRunningBooking !== false);
    setChecked('flagStoppageWiseFares', flags.stoppageWiseFares !== false);
    setChecked('flagSegmentSeatReuse', flags.segmentSeatReuse !== false);

    // Festival & Seasonal Theme Controller
    loadAdminFestivalTheme();
}

// --- Festival & Seasonal Theme Control Center ---
let adminCurrentFestivalTheme = {
    enabled: false,
    festival: 'diwali',
    targets: { customer: true, owner: true, captain: true },
    greeting: ''
};

function loadAdminFestivalTheme() {
    const db = getAppData();
    const flags = db.featureFlags || {};
    const expConfig = flags.expansionConfig || {};
    const isGloballyEnabled = flags.festivalTheme === true;
    const rawTheme = expConfig.festivalTheme || {};
    const isThemeEnabled = isGloballyEnabled && rawTheme.enabled === true;

    const theme = {
        enabled: isThemeEnabled,
        festival: isThemeEnabled ? (rawTheme.festival || 'none') : 'none',
        targets: rawTheme.targets || { customer: true, owner: true, captain: true },
        greeting: rawTheme.greeting || ''
    };
    adminCurrentFestivalTheme = theme;

    const toggle = document.getElementById('adminFestivalEnabledToggle');
    const select = document.getElementById('adminFestivalSelect');
    const custCheck = document.getElementById('festTargetCustomer');
    const ownerCheck = document.getElementById('festTargetOwner');
    const capCheck = document.getElementById('festTargetCaptain');
    const greetingInput = document.getElementById('adminFestivalGreetingInput');
    const statusLbl = document.getElementById('lblAdminFestivalStatus');

    if (toggle) toggle.checked = theme.enabled === true;
    if (statusLbl) {
        statusLbl.innerText = theme.enabled ? window.t('থিম সক্রিয় (ON)', 'Theme ON') : window.t('থিম বন্ধ (OFF)', 'Theme OFF');
        statusLbl.className = theme.enabled ? 'ml-3 text-xs font-black text-green-700' : 'ml-3 text-xs font-black text-gray-800';
    }
    if (select) select.value = theme.festival || 'none';
    if (custCheck) custCheck.checked = theme.targets ? theme.targets.customer !== false : true;
    if (ownerCheck) ownerCheck.checked = theme.targets ? theme.targets.owner !== false : true;
    if (capCheck) capCheck.checked = theme.targets ? theme.targets.captain !== false : true;
    if (greetingInput) greetingInput.value = theme.greeting || '';

    updateAdminFestivalLivePreview();
}

function onAdminFestivalToggleChange() {
    const toggle = document.getElementById('adminFestivalEnabledToggle');
    const select = document.getElementById('adminFestivalSelect');
    const statusLbl = document.getElementById('lblAdminFestivalStatus');
    const isChecked = toggle ? Boolean(toggle.checked) : false;

    if (statusLbl) {
        statusLbl.innerText = isChecked ? 'থিম সক্রিয় (ON)' : 'থিম বন্ধ (OFF)';
        statusLbl.className = isChecked ? 'ml-3 text-xs font-black text-green-700' : 'ml-3 text-xs font-black text-gray-800';
    }
    if (!isChecked && select) {
        select.value = 'none';
    }
    updateAdminFestivalLivePreview();
}

function onAdminFestivalSelectChange() {
    const select = document.getElementById('adminFestivalSelect');
    const val = select ? select.value : 'none';
    const fest = (typeof BUS_YATRA_FESTIVALS !== 'undefined' ? BUS_YATRA_FESTIVALS : {})[val];
    const greetingInput = document.getElementById('adminFestivalGreetingInput');
    if (fest && greetingInput && !greetingInput.value.trim()) {
        greetingInput.placeholder = fest.defaultGreetingBn;
    }
    updateAdminFestivalLivePreview();
}

function setAdminFestivalAllTargets(checked) {
    const custCheck = document.getElementById('festTargetCustomer');
    const ownerCheck = document.getElementById('festTargetOwner');
    const capCheck = document.getElementById('festTargetCaptain');
    if (custCheck) custCheck.checked = checked;
    if (ownerCheck) ownerCheck.checked = checked;
    if (capCheck) capCheck.checked = checked;
    updateAdminFestivalLivePreview();
}

function updateAdminFestivalLivePreview() {
    const toggle = document.getElementById('adminFestivalEnabledToggle');
    const select = document.getElementById('adminFestivalSelect');
    const greetingInput = document.getElementById('adminFestivalGreetingInput');
    const previewBox = document.getElementById('adminFestivalLivePreviewBox');
    if (!previewBox) return;

    const isEnabled = toggle ? toggle.checked : false;
    const festKey = select ? select.value : 'none';
    const fest = (typeof BUS_YATRA_FESTIVALS !== 'undefined' ? BUS_YATRA_FESTIVALS : {})[festKey];

    if (!isEnabled || festKey === 'none' || !fest) {
        previewBox.className = "p-4 bg-gray-50 rounded-xl border border-gray-200 text-center text-xs text-gray-400";
        previewBox.innerHTML = `
            <div class="py-6">
                <span class="text-3xl">🔴</span>
                <p class="font-bold text-gray-700 mt-2 text-sm">${window.t('সাধারণ মোড (Normal Clean Theme)', 'Normal Clean Theme')}</p>
                <p class="text-xs text-gray-500 mt-1">${window.t('বর্তমানে কোনো উৎসব সক্রিয় নেই। সমস্ত প্যানেল সাধারণ লাল ডিজাইনে চলছে।', 'No festival active right now. All portals are using the standard clean red theme.')}</p>
            </div>`;
        return;
    }

    previewBox.className = "p-4 bg-white rounded-xl border-2 border-dashed border-orange-300 space-y-3";
    const customText = greetingInput ? greetingInput.value.trim() : '';
    const displayText = customText || fest.defaultGreetingBn;

    const festLogoSrc = festKey === 'diwali' ? 'icons/logo-customer-diwali.png' : `icons/logo-customer-${festKey}.png`;
    const festAppIconSrc = festKey === 'diwali' ? 'icons/icon-diwali-192.png' : `icons/icon-${festKey}-192.png`;

    previewBox.innerHTML = `
        <!-- Live App Icon Preview -->
        <div class="flex items-center gap-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-orange-200 text-left shadow-xs">
            <img src="${festAppIconSrc}" class="w-14 h-14 rounded-2xl shadow-md border-2 border-amber-400 object-cover shrink-0" alt="Festival App Icon" onerror="this.src='icons/icon-192.png'">
            <div class="min-w-0">
                <p class="text-xs font-black text-gray-900 flex items-center gap-1.5">
                    <span>📱 স্পেশাল ফেস্টিভ্যাল অ্যাপ আইকন</span>
                    <span class="text-[9px] bg-orange-600 text-white font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider">NEW</span>
                </p>
                <p class="text-[11px] text-gray-600 mt-0.5">উৎসব চলাকালীন অ্যাপ লোগো, স্প্ল্যাশ ও ফেভিকনে এই বিশেষ প্রদীপ ও লাইটিং রূপ দেখাবে।</p>
            </div>
        </div>

        <!-- Live Header Preview -->
        <div class="bg-black text-white p-2.5 rounded-xl shadow-xs flex items-center justify-between">
            <div class="flex items-center gap-2 relative">
                <img src="${festLogoSrc}" class="w-8 h-8 rounded-full border border-yellow-400 object-cover" alt="Logo" onerror="this.src='icons/logo-customer.png'">
                <span class="absolute -bottom-1 -right-1 text-xs filter drop-shadow animate-bounce">${fest.icon}</span>
                <span class="font-bold text-xs text-white">Bus Yatra</span>
            </div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${fest.tagBg}">${fest.icon} ${escapeHtml(fest.nameBn)}</span>
        </div>

        <!-- Live Banner Preview -->
        <div class="p-3 rounded-xl border ${fest.bannerGradient} text-left flex items-center gap-2.5 shadow-xs">
            <span class="text-2xl shrink-0 filter drop-shadow">${fest.icon}</span>
            <div class="min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <strong class="text-xs font-black text-gray-900">${escapeHtml(fest.nameBn)}</strong>
                    <span class="text-[9px] font-bold px-1.5 py-0.2 rounded border ${fest.tagBg}">উৎসব স্পেশাল</span>
                </div>
                <p class="text-[11px] text-gray-700 mt-0.5 leading-snug line-clamp-2">${escapeHtml(displayText)}</p>
            </div>
        </div>

        <p class="text-[10px] text-gray-400 text-center">সেভ করার সাথে সাথে সমস্ত কাস্টমার, ওনার ও ক্যাপ্টেন প্যানেলে রিয়েল-টাইমে এই রূপ চালু হবে।</p>
    `;
}

async function saveAdminFestivalTheme() {
    const btn = document.getElementById('btnSaveFestivalTheme');
    const toggle = document.getElementById('adminFestivalEnabledToggle');
    const select = document.getElementById('adminFestivalSelect');
    const custCheck = document.getElementById('festTargetCustomer');
    const ownerCheck = document.getElementById('festTargetOwner');
    const capCheck = document.getElementById('festTargetCaptain');
    const greetingInput = document.getElementById('adminFestivalGreetingInput');
    const statusLbl = document.getElementById('lblAdminFestivalStatus');

    let enabled = toggle ? Boolean(toggle.checked) : false;
    let festival = select ? select.value : 'none';

    // When the toggle is OFF or festival is 'none', strictly disable and revert to clean normal mode
    if (!enabled || festival === 'none') {
        enabled = false;
        festival = 'none';
        if (toggle) toggle.checked = false;
        if (select) select.value = 'none';
        if (statusLbl) {
            statusLbl.textContent = 'থিম বন্ধ (OFF)';
            statusLbl.className = 'ml-3 text-xs font-black text-gray-800';
        }
    }

    const targets = {
        customer: custCheck ? custCheck.checked : true,
        owner: ownerCheck ? ownerCheck.checked : true,
        captain: capCheck ? capCheck.checked : true
    };
    const greeting = greetingInput ? greetingInput.value.trim() : '';

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span>⏳</span> <span>লাইভ আপডেট হচ্ছে...</span>`;
    }

    try {
        console.log("Saving festival theme:", { enabled, festival, targets, greeting });

        // 1. Save to Cloudflare D1 + Securely sync to Firebase Firestore via Backend API
        const res = await apiRequest('/api/admin/festival-theme', {
            method: 'POST',
            body: JSON.stringify({ enabled, festival, targets, greeting })
        });
        console.log("API response festival theme:", res);

        // 3. Update admin app data cache
        if (res && res.featureFlags) {
            setAppData({ featureFlags: res.featureFlags });
        }

        // 4. Update preview and apply immediately to current admin screen
        updateAdminFestivalLivePreview();
        if (typeof applyFestivalTheme === 'function') {
            applyFestivalTheme({ enabled, festival, targets, greeting }, 'admin');
        }

        const festName = festival !== 'none' && (typeof BUS_YATRA_FESTIVALS !== 'undefined' && BUS_YATRA_FESTIVALS[festival]) 
            ? BUS_YATRA_FESTIVALS[festival].nameBn 
            : 'সাধারণ মোড';
        const msg = enabled 
            ? `🎉 ${festName} থিম সফলভাবে সমস্ত নির্ধারিত প্যানেলে লাইভ চালু করা হয়েছে!` 
            : `🔴 উৎসব থিম বন্ধ করে সাধারণ মোডে ফিরিয়ে নেওয়া হয়েছে।`;

        if (typeof showToast === 'function') {
            showToast(msg);
        } else {
            alert(msg);
        }
    } catch (err) {
        console.error("Failed to save festival theme:", err);
        alert('থিম আপডেট করতে সমস্যা হয়েছে: ' + (err.message || 'Error'));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<span>💾</span> <span>সেভ ও লাইভ চালু করুন (Save & Apply Live)</span>`;
        }
    }
}
window.loadAdminFestivalTheme = loadAdminFestivalTheme;
window.onAdminFestivalToggleChange = onAdminFestivalToggleChange;
window.onAdminFestivalSelectChange = onAdminFestivalSelectChange;
window.setAdminFestivalAllTargets = setAdminFestivalAllTargets;
window.updateAdminFestivalLivePreview = updateAdminFestivalLivePreview;
window.saveAdminFestivalTheme = saveAdminFestivalTheme;

async function saveAdminFeatureFlags() {
    const rawLeadHours = parseFloat(document.getElementById('cfgTrackingLeadHours')?.value);
    const leadHoursVal = (Number.isFinite(rawLeadHours) && rawLeadHours >= 0.5) ? rawLeadHours : 5;
    const rawGraceMins = parseInt(document.getElementById('cfgTrackingGraceMinutes')?.value, 10);
    const graceMinsVal = (Number.isFinite(rawGraceMins) && rawGraceMins >= 0) ? rawGraceMins : 30;
    const leadWindowEnabledVal = document.getElementById('flagTrackingLeadWindowEnabled')?.checked ?? true;
    const seatHoldTimerVal = document.getElementById('flagSeatHoldTimer')?.checked ?? true;
    const seatHoldMinsVal = parseInt(document.getElementById('cfgSeatHoldMinutes')?.value, 10) || 15;

    const ticketCancelVal = document.getElementById('flagTicketCancellation')?.checked ?? true;
    const cancelCutoffEnabledVal = document.getElementById('flagCancellationCutoffEnabled')?.checked ?? true;
    const rawCancelCutoffHours = parseFloat(document.getElementById('cfgCancellationCutoffHours')?.value);
    const cancelCutoffHoursVal = (Number.isFinite(rawCancelCutoffHours) && rawCancelCutoffHours >= 0) ? rawCancelCutoffHours : 8;

    const enrouteRunningVal = document.getElementById('flagEnrouteRunningBooking')?.checked ?? true;
    const stoppageWiseFaresVal = document.getElementById('flagStoppageWiseFares')?.checked ?? true;
    const segmentSeatReuseVal = document.getElementById('flagSegmentSeatReuse')?.checked ?? true;

    const featureFlags = {
        onlinePayment: document.getElementById('flagOnlinePay')?.checked ?? true,
        cashPayment: document.getElementById('flagCashPay')?.checked ?? true,
        captainPortal: document.getElementById('flagCaptain')?.checked ?? true,
        windowSeatPricing: Boolean(document.getElementById('flagWindowPricing')?.checked),
        promoCodes: document.getElementById('flagPromo')?.checked ?? true,
        liveTracking: document.getElementById('flagLiveTracking')?.checked ?? true,
        customerFeedback: document.getElementById('flagFeedback')?.checked ?? true,
        tripReminders: document.getElementById('flagTripReminders')?.checked ?? true,
        trackingLeadHours: leadHoursVal,
        trackingLeadWindowEnabled: leadWindowEnabledVal,
        trackingGraceMinutes: graceMinsVal,
        seatHoldTimer: seatHoldTimerVal,
        seatHoldMinutes: seatHoldMinsVal,
        ticketCancellation: ticketCancelVal,
        cancellationCutoffEnabled: cancelCutoffEnabledVal,
        cancellationCutoffHours: cancelCutoffHoursVal,
        enrouteRunningBooking: enrouteRunningVal,
        stoppageWiseFares: stoppageWiseFaresVal,
        segmentSeatReuse: segmentSeatReuseVal,
        expansionConfig: {
            liveTracking: {
                leadWindowEnabled: leadWindowEnabledVal,
                leadHours: leadHoursVal,
                graceMinutes: graceMinsVal
            },
            seatHold: {
                enabled: seatHoldTimerVal,
                holdMinutes: seatHoldMinsVal
            },
            ticketCancellation: {
                enabled: ticketCancelVal,
                cutoffEnabled: cancelCutoffEnabledVal,
                cutoffHours: cancelCutoffHoursVal
            }
        }
    };

    try {
        const result = await apiRequest('/api/admin/feature-flags', {
            method: 'POST',
            body: JSON.stringify(featureFlags)
        });
        setAppData({ featureFlags: result.featureFlags });
        renderAdminFeatureFlags();
        renderAdminExpansionSettings();
        alert("✅ প্ল্যাটফর্ম ফিচার ও লাইভ ট্র্যাকিং সেটিংস সফলভাবে সেভ হয়েছে!");
    } catch (error) {
        alert(`Could not save global feature flags: ${error.message}`);
    }
}

function formatFinanceAmount(value) {
    return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

async function loadAdminFinanceData() {
    const report = document.getElementById('adminFinanceReport');
    const reportOperators = document.getElementById('adminFinanceReportOperators');
    const replicaStatus = document.getElementById('firebaseReplicaStatus');
    const operators = document.getElementById('adminFinanceOperators');
    const entries = document.getElementById('adminFinanceEntries');
    if (!report || !reportOperators || !replicaStatus || !operators || !entries) return;

    report.innerHTML = '<div class="text-center text-gray-400 py-6 text-xs">Loading finance report...</div>';
    reportOperators.innerHTML = '';
    replicaStatus.textContent = 'Checking Firebase replica and pending backup writes...';
    operators.innerHTML = '<div class="text-center text-gray-400 py-6 text-xs">Loading operators...</div>';
    entries.innerHTML = '<div class="text-center text-gray-400 py-6 text-xs">Loading booking ledger...</div>';

    const [financeResult, operatorResult, reportResult, replicaResult] = await Promise.allSettled([
            apiRequest('/api/admin/finance'),
            apiRequest('/api/admin/operator-finance'),
        apiRequest('/api/admin/reports'),
        apiRequest('/api/admin/replica-status')
    ]);

    if (reportResult.status === 'fulfilled') {
        renderAdminFinanceReport(reportResult.value);
        renderAdminOperatorReport(reportResult.value.operators || []);
    } else {
        const message = escapeHtml(reportResult.reason.message || 'Access denied.');
        report.innerHTML = `<div class="sm:col-span-2 lg:col-span-5 text-center text-red-500 py-6 text-xs">Could not load reports: ${message}</div>`;
        reportOperators.innerHTML = '';
    }

    if (operatorResult.status === 'fulfilled') {
        renderAdminOperatorFinance(operatorResult.value.operators || []);
    } else {
        operators.innerHTML = `<div class="text-center text-red-500 py-6 text-xs">Could not load operator commission settings: ${escapeHtml(operatorResult.reason.message || 'Access denied.')}</div>`;
    }

    if (financeResult.status === 'fulfilled') {
        renderAdminFinanceEntries(financeResult.value.entries || []);
    } else {
        entries.innerHTML = `<div class="text-center text-red-500 py-6 text-xs">Could not load booking ledger: ${escapeHtml(financeResult.reason.message || 'Access denied.')}</div>`;
    }

    if (replicaResult.status === 'fulfilled') {
        renderFirebaseReplicaStatus(replicaResult.value);
    } else {
        replicaStatus.innerHTML = `<span class="font-bold text-red-700">Backup status unavailable.</span> ${escapeHtml(replicaResult.reason.message || 'Access denied.')}`;
    }
}

function renderFirebaseReplicaStatus(status) {
    const container = document.getElementById('firebaseReplicaStatus');
    if (!container) return;
    if (!status.configured) {
        container.innerHTML = '<strong class="text-amber-700">Firebase backup is not configured.</strong> Booking continues to use Cloudflare D1 only.';
        return;
    }
    const hasFailures = Number(status.failedCount || 0) > 0;
    const hasPending = Number(status.pendingCount || 0) > 0;
    const tone = hasFailures ? 'text-red-700' : hasPending ? 'text-amber-700' : 'text-green-700';
    const label = hasFailures ? 'Backup replication has errors' : hasPending ? 'Backup writes are pending' : 'No backup writes are pending';
    const lastSuccess = status.lastSuccessAt
        ? new Date(status.lastSuccessAt).toLocaleString()
        : 'No successful writes yet';
    container.innerHTML = `
        <p class="font-bold ${tone}">${label}</p>
        <p class="mt-1">Queued: ${Number(status.pendingCount || 0)} · Failed: ${Number(status.failedCount || 0)} · Last successful write: ${escapeHtml(lastSuccess)}</p>
        ${status.oldestPendingAt ? `<p>Oldest queued write: ${escapeHtml(new Date(status.oldestPendingAt).toLocaleString())}</p>` : ''}
        ${status.lastError ? `<p class="mt-1 text-red-700">Last error: ${escapeHtml(status.lastError)}</p>` : ''}
        <p class="mt-2 ${status.backfillComplete ? 'text-green-700' : 'text-amber-700'}">${status.backfillComplete ? 'Initial D1 snapshot has been queued.' : 'Initial D1 snapshot is not complete.'}</p>
        <p class="mt-2 text-gray-500">Firebase is an asynchronous backup replica, not an automatic booking failover. Booking writes remain on D1 to protect seat consistency.</p>
        ${status.backfillComplete ? '' : '<button type="button" id="firebaseBackfillButton" class="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700">Queue next initial backup batch</button>'}
    `;
    document.getElementById('firebaseBackfillButton')?.addEventListener('click', runAdminFirebaseBackfillBatch);
}

async function runAdminFirebaseBackfillBatch(event) {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Queueing backup batch...';
    try {
        const result = await apiRequest('/api/admin/replica-backfill', {
            method: 'POST',
            body: JSON.stringify({})
        });
        await loadAdminFinanceData();
        if (result.complete) {
            alert('Initial D1 snapshot queued. Wait for the Firebase backup queue to drain.');
        } else {
            alert(`${result.table}: queued ${result.queued} record(s). Use the button again to continue.`);
        }
    } catch (error) {
        button.disabled = false;
        button.textContent = 'Retry initial backup batch';
        alert(`Could not queue Firebase initial backup: ${error.message}`);
    }
}

function renderAdminFinanceReport(reportData) {
    const container = document.getElementById('adminFinanceReport');
    if (!container) return;
    const summary = reportData.summary || {};
    const cards = [
        ['Bookings in ledger', summary.booking_count || 0, 'text-gray-900'],
        ['Payments received', formatFinanceAmount(summary.received_amount), 'text-blue-700'],
        ['Refunded', formatFinanceAmount(summary.refunded_amount), 'text-red-700'],
        ['Commission earned', formatFinanceAmount(summary.commission_amount), 'text-green-700'],
        ['Operator settlements', formatFinanceAmount(summary.operator_settled_amount), 'text-purple-700']
    ];
    container.innerHTML = cards.map(([label, value, color]) => `
        <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p class="text-[11px] font-bold uppercase tracking-wide text-gray-500">${label}</p>
            <p class="mt-2 text-xl font-black ${color}">${escapeHtml(String(value))}</p>
        </div>
    `).join('');
}

function renderAdminOperatorReport(operators) {
    const container = document.getElementById('adminFinanceReportOperators');
    if (!container) return;
    if (!operators.length) {
        container.innerHTML = '<p class="rounded-xl bg-gray-50 p-4 text-center text-xs text-gray-500">No operator finance activity yet.</p>';
        return;
    }
    container.innerHTML = `
        <h3 class="font-bold text-sm text-gray-900">Operator totals</h3>
        <div class="overflow-x-auto rounded-xl border border-gray-200">
            <table class="w-full min-w-[700px] text-left text-xs">
                <thead class="bg-gray-50 text-gray-500">
                    <tr>
                        <th class="p-3">Operator</th>
                        <th class="p-3">Bookings</th>
                        <th class="p-3">Received</th>
                        <th class="p-3">Refunded</th>
                        <th class="p-3">Commission</th>
                        <th class="p-3">Settled to operator</th>
                    </tr>
                </thead>
                <tbody>${operators.map(operator => `
                    <tr class="border-t border-gray-100">
                        <td class="p-3 font-semibold">${escapeHtml(operator.company_name || operator.owner_phone || 'Operator')}<span class="block text-gray-500">${escapeHtml(operator.owner_phone || '')}</span></td>
                        <td class="p-3">${Number(operator.booking_count || 0)}</td>
                        <td class="p-3">${formatFinanceAmount(operator.received_amount)}</td>
                        <td class="p-3">${formatFinanceAmount(operator.refunded_amount)}</td>
                        <td class="p-3">${formatFinanceAmount(operator.commission_amount)}</td>
                        <td class="p-3">${formatFinanceAmount(operator.operator_settled_amount)}</td>
                    </tr>
                `).join('')}</tbody>
            </table>
        </div>
    `;
}

function renderAdminOperatorFinance(operators) {
    const container = document.getElementById('adminFinanceOperators');
    if (!container) return;
    if (!operators.length) {
        container.innerHTML = '<div class="text-center text-gray-500 py-6 text-xs">No operators are registered.</div>';
        return;
    }
    container.innerHTML = operators.map(operator => `
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div class="text-xs">
                <p class="font-bold text-sm text-gray-900">${escapeHtml(operator.company_name || operator.owner_name || 'Operator')}</p>
                <p class="mt-1 text-gray-600">${escapeHtml(operator.owner_name || '')} · ${escapeHtml(operator.owner_phone || '')} · ${Number(operator.bus_count || 0)} bus(es)</p>
            </div>
            <div class="flex flex-wrap items-end gap-2">
                <label class="text-[11px] font-semibold text-gray-600">Commission type
                    <select data-commission-mode="${escapeHtml(operator.owner_phone)}" class="mt-1 block rounded-lg border border-gray-300 bg-white p-2 text-xs">
                        <option value="percentage" ${operator.commission_mode === 'percentage' ? 'selected' : ''}>Percentage (%)</option>
                        <option value="fixed" ${operator.commission_mode === 'fixed' ? 'selected' : ''}>Fixed per booking (₹)</option>
                    </select>
                </label>
                <label class="text-[11px] font-semibold text-gray-600">Commission value
                    <input data-commission-value="${escapeHtml(operator.owner_phone)}" type="number" min="0" max="${operator.commission_mode === 'percentage' ? '100' : ''}" step="0.01" value="${Number(operator.commission_value || 0)}" class="mt-1 block w-28 rounded-lg border border-gray-300 bg-white p-2 text-xs">
                </label>
                <button type="button" data-save-commission="${escapeHtml(operator.owner_phone)}" class="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">Save</button>
            </div>
        </div>
    `).join('');
    container.querySelectorAll('[data-save-commission]').forEach(button => {
        button.addEventListener('click', () => saveOperatorCommission(button.dataset.saveCommission));
    });
}

async function saveOperatorCommission(ownerPhone) {
    const mode = document.querySelector(`[data-commission-mode="${ownerPhone}"]`)?.value;
    const value = Number(document.querySelector(`[data-commission-value="${ownerPhone}"]`)?.value);
    if (!Number.isFinite(value) || value < 0 || (mode === 'percentage' && value > 100)) {
        alert('Enter a valid commission value. Percentage must be between 0 and 100.');
        return;
    }
    try {
        await apiRequest('/api/admin/operator-finance', {
            method: 'POST',
            body: JSON.stringify({ ownerPhone, commissionMode: mode, commissionValue: value })
        });
        await loadAdminFinanceData();
        alert('Operator commission settings saved.');
    } catch (error) {
        alert(`Could not save operator commission: ${error.message}`);
    }
}

function renderAdminFinanceEntries(entries) {
    const container = document.getElementById('adminFinanceEntries');
    if (!container) return;
    if (!entries.length) {
        container.innerHTML = '<div class="text-center text-gray-500 py-6 text-xs">No booking finance records found.</div>';
        return;
    }
    const transitions = {
        pending: ['pending', 'received'],
        received: ['received', 'refund_requested', 'settled'],
        refund_requested: ['refund_requested', 'received', 'refunded'],
        settled: ['settled', 'refund_requested'],
        refunded: ['refunded']
    };
    const labels = {
        pending: 'Payment pending',
        received: 'Payment received',
        refund_requested: 'Refund requested',
        refunded: 'Refunded',
        settled: 'Settled'
    };
    container.innerHTML = entries.map(entry => {
        const status = transitions[entry.payment_status] ? entry.payment_status : 'pending';
        const availableStatuses = transitions[status];
        return `
            <article class="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div class="space-y-1 text-xs">
                        <p class="font-bold text-sm text-gray-900">${escapeHtml(entry.passenger_name || 'Passenger')} <span class="font-mono text-blue-700">${escapeHtml(entry.booking_id)}</span></p>
                        <p class="text-gray-600">${escapeHtml(entry.company_name || 'Operator')} · ${escapeHtml(entry.owner_phone || '')}</p>
                        <p class="text-gray-600">${escapeHtml(entry.bus_name || '')} (${escapeHtml(entry.bus_number || '')}) · ${escapeHtml(entry.journey_date || '')} · Seat(s): ${escapeHtml(entry.seats || '')}</p>
                        <p class="text-gray-600">${escapeHtml(entry.passenger_phone || '')} · Booking: ${escapeHtml(entry.booking_status || '')} · Fare: <strong>${formatFinanceAmount(entry.amount)}</strong></p>
                        ${entry.payment_status === 'settled' ? `<p class="font-semibold text-green-700">Commission: ${formatFinanceAmount(entry.commission_amount)} · Operator: ${formatFinanceAmount(entry.operator_amount)}</p>` : ''}
                    </div>
                    <div class="flex min-w-[240px] flex-col gap-2">
                        <label class="text-[11px] font-semibold text-gray-600">Ledger status
                            <select data-finance-status="${escapeHtml(entry.booking_id)}" class="mt-1 block w-full rounded-lg border border-gray-300 bg-white p-2 text-xs">
                                ${availableStatuses.map(value => `<option value="${value}" ${value === status ? 'selected' : ''}>${labels[value]}</option>`).join('')}
                            </select>
                        </label>
                        <input data-finance-note="${escapeHtml(entry.booking_id)}" maxlength="500" value="${escapeHtml(entry.note || '')}" placeholder="Optional accounting note" class="rounded-lg border border-gray-300 bg-white p-2 text-xs">
                        <div class="flex gap-2">
                            <button type="button" data-save-finance="${escapeHtml(entry.booking_id)}" class="flex-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700">Save</button>
                            <button type="button" onclick="adminDeleteBooking('${escapeHtml(entry.booking_id)}')" class="rounded-lg bg-red-50 hover:bg-red-600 hover:text-white px-3 py-2 text-xs font-bold text-red-600 border border-red-200 transition" title="Delete Transaction">🗑️ Delete</button>
                        </div>
                    </div>
                </div>
            </article>
        `;
    }).join('');
    container.querySelectorAll('[data-save-finance]').forEach(button => {
        button.addEventListener('click', () => saveBookingFinance(button.dataset.saveFinance));
    });
}

async function saveBookingFinance(bookingId) {
    const paymentStatus = document.querySelector(`[data-finance-status="${bookingId}"]`)?.value;
    const note = document.querySelector(`[data-finance-note="${bookingId}"]`)?.value || '';
    try {
        await apiRequest(`/api/admin/finance/${encodeURIComponent(bookingId)}`, {
            method: 'POST',
            body: JSON.stringify({ paymentStatus, note })
        });
        await loadAdminFinanceData();
        alert('Booking finance entry saved.');
    } catch (error) {
        alert(`Could not update booking finance: ${error.message}`);
    }
}

// --- Super Admin: Master Logins & 4-Digit PIN Directory ---
let adminRegisteredCustomers = [];
let adminPinFilterRole = 'all';

function setAdminPinFilter(role) {
    adminPinFilterRole = role;
    ['all', 'customer', 'owner', 'captain'].forEach(r => {
        const btn = document.getElementById(`pinFilterBtn_${r}`);
        if (!btn) return;
        if (r === role) {
            btn.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-900 text-white shadow-xs transition';
        } else {
            btn.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition';
        }
    });
    filterAdminCustomersList();
}
window.setAdminPinFilter = setAdminPinFilter;

async function loadAdminAllPinData() {
    const container = document.getElementById('adminCustomersPinList');
    if (container) {
        container.innerHTML = '<div class="text-center text-gray-400 py-6 text-xs">Loading all PIN directory data...</div>';
    }
    await Promise.allSettled([
        loadAdminCustomersData(),
        loadAdminOwnersData(),
        loadAdminCaptainsData()
    ]);
}
window.loadAdminAllPinData = loadAdminAllPinData;

async function loadAdminCustomersData() {
    const container = document.getElementById('adminCustomersPinList');
    try {
        const res = await apiRequest('/api/admin/customers');
        adminRegisteredCustomers = res.customers || [];
        filterAdminCustomersList();
    } catch (err) {
        if (container) {
            container.innerHTML = `<div class="text-center text-red-500 py-6 text-xs">Failed to load customer list: ${err.message}</div>`;
        }
    }
}

function filterAdminCustomersList() {
    const container = document.getElementById('adminCustomersPinList');
    if (!container) return;

    const q = (document.getElementById('adminCustomerPinSearch')?.value || '').trim().toLowerCase();

    // Map Customers
    const customerItems = (adminRegisteredCustomers || []).map(c => ({
        ...c,
        role: 'customer',
        displayName: c.name || 'Customer',
        displayPhone: c.phone,
        busInfo: '',
        rawPin: c.pin || ''
    }));

    // Map Owners
    const ownerItems = (adminOwnersData || []).map(o => ({
        ...o,
        role: 'owner',
        displayName: o.company_name ? `${o.company_name} — ${o.name || 'Owner'}` : (o.name || 'Owner'),
        displayPhone: o.phone,
        busInfo: o.bus_number ? `Bus: ${o.bus_number}` : '',
        rawPin: o.pin || ''
    }));

    // Map Captains
    const captainItems = (adminCaptainsList || []).map(cp => ({
        ...cp,
        role: 'captain',
        displayName: cp.name || 'Captain',
        displayPhone: cp.phone,
        busInfo: cp.bus_name ? `${cp.bus_name} (${cp.bus_number || ''})` : (cp.bus_id || ''),
        rawPin: cp.pin || ''
    }));

    // Update count badges
    const countAllEl = document.getElementById('pinCountAll');
    const countCustEl = document.getElementById('pinCountCustomer');
    const countOwnerEl = document.getElementById('pinCountOwner');
    const countCaptEl = document.getElementById('pinCountCaptain');
    if (countAllEl) countAllEl.innerText = customerItems.length + ownerItems.length + captainItems.length;
    if (countCustEl) countCustEl.innerText = customerItems.length;
    if (countOwnerEl) countOwnerEl.innerText = ownerItems.length;
    if (countCaptEl) countCaptEl.innerText = captainItems.length;

    let items = [];
    if (adminPinFilterRole === 'all') {
        items = [...customerItems, ...ownerItems, ...captainItems];
    } else if (adminPinFilterRole === 'customer') {
        items = customerItems;
    } else if (adminPinFilterRole === 'owner') {
        items = ownerItems;
    } else if (adminPinFilterRole === 'captain') {
        items = captainItems;
    }

    if (q) {
        items = items.filter(u =>
            (u.displayName && u.displayName.toLowerCase().includes(q)) ||
            (u.displayPhone && u.displayPhone.includes(q)) ||
            (u.busInfo && u.busInfo.toLowerCase().includes(q)) ||
            (u.rawPin && u.rawPin.includes(q))
        );
    }

    renderAdminCustomersPinList(items);
}

function renderAdminCustomersPinList(items) {
    const container = document.getElementById('adminCustomersPinList');
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-6 text-xs">${window.t('কোনো লগইন বা পিন রেকর্ড পাওয়া যায়নি।', 'No login or PIN records found.')}</div>`;
        return;
    }

    container.innerHTML = items.map(u => {
        const isSuspended = u.status === 'suspended' || u.active === 0 || u.active === false;
        const isBanned = u.status === 'banned' || u.status === 'permanently_banned';
        const statusBadge = isBanned
            ? ('<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-800 border border-red-300">' + window.t('⛔ নিষিদ্ধ', '⛔ Banned') + '</span>')
            : isSuspended
                ? ('<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">' + window.t('⚠️ স্থগিত', '⚠️ Suspended') + '</span>')
                : ('<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-green-100 text-green-700 border border-green-300">' + window.t('🟢 সচল', '🟢 Active') + '</span>');

        const roleBadge = u.role === 'owner'
            ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-900 border border-indigo-300">👑 ' + window.t('বাস ওনার', 'Owner') + '</span>'
            : u.role === 'captain'
                ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">👨‍✈️ ' + window.t('ক্যাপ্টেন', 'Captain') + '</span>'
                : '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-300">👤 ' + window.t('কাস্টমার', 'Customer') + '</span>';

        const pinBadge = `<span class="font-mono bg-yellow-100 text-yellow-900 px-2.5 py-0.5 rounded-lg border border-yellow-400 font-black text-xs shadow-xs">🔑 PIN: ${escapeHtml(u.rawPin || u.pin || '••••')}</span>`;

        const custAvatar = (u.role === 'customer' && typeof resolveCustomerAvatarInfo === 'function')
            ? resolveCustomerAvatarInfo(u)
            : null;
        const custPhoneClean = escapeHtml(u.phone || u.displayPhone || '');

        return `
        <div class="bg-gray-50 hover:bg-gray-100/70 p-4 rounded-xl border ${u.pin_requested_at ? 'border-red-400 bg-red-50/30 ring-2 ring-red-300' : isSuspended ? 'border-amber-300 bg-amber-50/20' : 'border-gray-200'} flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs transition">
            <div class="flex items-start gap-3 min-w-0">
                ${custAvatar ? `
                    <button type="button" onclick="openAdminCustomerPhotoModal('${custPhoneClean}')" class="relative w-11 h-11 rounded-full p-[1.5px] ${custAvatar.isCustom ? 'bg-gradient-to-tr from-red-600 via-amber-500 to-emerald-500 shadow-sm' : 'bg-slate-300'} shrink-0 cursor-pointer hover:scale-105 transition" title="View / Change Customer Photo">
                        <img src="${custAvatar.src}" alt="${escapeHtml(u.displayName || u.name)}" class="w-full h-full rounded-full object-cover object-top border-2 border-white bg-white">
                        ${custAvatar.isCustom ? '<span class="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-purple-600 text-white border border-white rounded-full flex items-center justify-center text-[9px]">📷</span>' : ''}
                    </button>
                ` : ''}
                <div class="space-y-1.5 min-w-0">
                    <div class="font-bold text-gray-900 text-sm flex flex-wrap items-center gap-2">
                        ${roleBadge}
                        <span>${escapeHtml(u.displayName || u.name)}</span>
                        <a href="tel:${escapeHtml(u.displayPhone || u.phone)}" class="font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">${u.displayPhone || u.phone}</a>
                        ${pinBadge}
                        ${statusBadge}
                        ${custAvatar && custAvatar.isCustom ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">📷 ${window.t('আপলোডেড ফটো', 'Custom Photo')}</span>` : ''}
                        ${u.pin_requested_at ? `
                            <span class="bg-red-600 text-white font-black px-2.5 py-0.5 rounded-full animate-pulse text-[11px] shadow-sm flex items-center gap-1">🚨 PIN RESET REQUESTED (${new Date(u.pin_requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                        ` : ''}
                    </div>
                    <div class="text-gray-600 flex flex-wrap items-center gap-3">
                        ${u.busInfo ? `<span class="font-semibold text-gray-800">🚌 ${escapeHtml(u.busInfo)}</span>` : ''}
                        ${u.email ? `<span class="text-gray-700 font-semibold">✉️ ${escapeHtml(u.email)}</span>` : ''}
                        ${u.created_at ? `<span><strong>Registered:</strong> ${new Date(u.created_at).toLocaleDateString()}</span>` : ''}
                        ${u.security_question ? `<span><strong>Security Q:</strong> <span class="text-gray-800">${escapeHtml(u.security_question)}</span></span>` : ''}
                    </div>
                    <div>
                        ${formatDeviceInlineBadge(u)}
                    </div>
                </div>
            </div>
            <div class="flex flex-wrap items-center gap-2 w-full md:w-auto">
                ${u.role === 'owner' ? `
                    <button type="button" onclick="adminAccessOwnerPortal('${escapeHtml(u.phone)}', '${escapeHtml(u.name || u.company_name)}')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1 active:scale-95" title="Access Owner Portal Directly">
                        👑 ${window.t('ওনার প্যানেল', 'Owner Portal')}
                    </button>
                    <button type="button" onclick="openAdminOwnerFeaturesNextGen('${escapeHtml(u.phone)}')" class="bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1" title="Customize Owner Features">
                        ⚡ Features
                    </button>
                ` : u.role === 'captain' ? `
                    <button type="button" onclick="adminAccessCaptainPortal('${u.phone}', '${u.bus_id || ''}', '${escapeHtml(u.name || 'Captain')}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1 active:scale-95" title="Access Captain Portal Directly">
                        👨‍✈️ ${window.t('এক্সেস প্যানেল', 'Access Portal')}
                    </button>
                    <button type="button" onclick="openAdminCaptainFeaturesNextGen('${u.phone}')" class="bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1" title="Customize Captain Features">
                        ⚡ Features
                    </button>
                ` : `
                    <button type="button" onclick="openAdminCustomerPhotoModal('${custPhoneClean}')" class="bg-pink-600 hover:bg-pink-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1 active:scale-95" title="View or Change Customer Photo">
                        📸 ${window.t('ফটো', 'Photo')}
                    </button>
                    <button type="button" onclick="adminAccessCustomerPortal('${escapeHtml(u.phone || u.displayPhone)}', '${escapeHtml(u.name || u.displayName)}')" class="bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1 active:scale-95" title="Access Customer Portal Directly">
                        👤 ${window.t('এক্সেস প্যানেল', 'Access Portal')}
                    </button>
                    <button type="button" onclick="openAdminEditCustomerModal('${escapeHtml(u.phone || u.displayPhone)}', '${escapeHtml(u.name || u.displayName)}', '${escapeHtml(u.email || '')}')" class="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1 active:scale-95" title="Edit Customer Details">
                        ✏️ ${window.t('এডিট', 'Edit')}
                    </button>
                    <button type="button" onclick="openAdminCustomerFeaturesModal('${u.phone || u.displayPhone}')" class="bg-gray-800 hover:bg-black text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1" title="Customize Customer Features">
                        ⚡ Features
                    </button>
                `}
                ${(isSuspended || isBanned) ? `
                    <button type="button" onclick="adminToggleUserAccess('${u.phone || u.displayPhone}', '${u.role}', 'activate')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition">
                        🟢 Re-activate
                    </button>
                ` : `
                    <button type="button" onclick="adminToggleUserAccess('${u.phone || u.displayPhone}', '${u.role}', 'suspend')" class="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition" title="Suspend User">
                        ⚠️ Suspend
                    </button>
                    <button type="button" onclick="adminToggleUserAccess('${u.phone || u.displayPhone}', '${u.role}', 'ban')" class="bg-red-700 hover:bg-red-800 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition" title="Ban User">
                        ⛔ Ban
                    </button>
                `}
                ${(u.rawPin || u.pin) ? `
                    <button type="button" onclick="sharePortalPin('${escapeHtml(u.displayName || u.name)}', '${u.phone || u.displayPhone}', '${escapeHtml(u.rawPin || u.pin)}', '${u.role}')" class="bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1" title="Send PIN via WhatsApp">
                        💬 WhatsApp
                    </button>
                ` : ''}
                <button type="button" onclick="${u.role === 'owner' ? `adminResetOwnerPin('${u.phone}')` : u.role === 'captain' ? `adminResetCaptainPin('${u.phone}', '${escapeHtml(u.name || 'Captain')}', '${escapeHtml(u.bus_name || '')}')` : `adminResetCustomerPin('${u.phone}', '${escapeHtml(u.name)}')`}" class="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition">
                    🔑 PIN
                </button>
                ${u.role === 'customer' ? `
                    <button type="button" onclick="adminDeleteCustomer('${u.phone}')" class="bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1.5 rounded-xl font-bold text-xs transition" title="Delete Customer">
                        🗑
                    </button>
                ` : u.role === 'captain' ? `
                    <button type="button" onclick="adminDeleteCaptain('${u.id}', '${u.phone}', '${u.bus_id || ''}')" class="bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1.5 rounded-xl font-bold text-xs transition" title="Delete Captain">
                        🗑
                    </button>
                ` : u.role === 'owner' ? `
                    <button type="button" onclick="adminDeleteOwner('${u.phone}', '${escapeHtml(u.name || u.displayName)}')" class="bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1.5 rounded-xl font-bold text-xs transition" title="Delete Owner & All Buses">
                        🗑
                    </button>
                ` : ''}
            </div>
        </div>
        `;
    }).join('');
}

async function adminResetCustomerPin(phone, name) {
    const newPin = prompt(`Enter new 4-digit PIN for customer ${phone}:`);
    if (!newPin) return;
    if (!/^\d{4}$/.test(newPin.trim())) {
        alert('PIN must be exactly 4 digits.');
        return;
    }
    try {
        await apiRequest('/api/admin/reset-pin', {
            method: 'POST',
            body: JSON.stringify({ role: 'customer', identifier: phone, newPin: newPin.trim() })
        });
        sharePortalPin(name || 'Customer', phone, newPin.trim(), 'customer');
        await loadAdminCustomersData();
    } catch (err) {
        alert(err.message || 'Failed to update customer PIN.');
    }
}

async function adminDeleteCustomer(phone) {
    const ok = await showBusYatraConfirm({ title: "গ্রাহক অ্যাকাউন্ট ডিলিট", subtitle: `Are you sure you want to delete customer account for ${phone}?`, icon: "🗑️", confirmText: "হ্যাঁ, ডিলিট করুন", cancelText: "বাতিল", danger: true }); if (!ok) return;
    try {
        await apiRequest(`/api/admin/customers/${encodeURIComponent(phone)}`, {
            method: 'DELETE'
        });
        alert('Customer removed.');
        loadAdminCustomersData();
    } catch (err) {
        alert(err.message || 'Failed to delete customer.');
    }
}

async function sharePortalPin(name, phone, pin, role, extra = '') {
    const portalUrl = role === 'owner'
        ? 'https://busyatra.pages.dev/owner.html'
        : role === 'captain'
            ? 'https://busyatra.pages.dev/captain.html'
            : 'https://busyatra.pages.dev/';
    const msg = `Hello ${name}, your Bus Yatra ${role} portal PIN is ${pin}.${extra ? ` Bus: ${extra}.` : ''} Sign in at ${portalUrl} using mobile ${phone}. Please keep your PIN private.`;
    const whatsappUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`;
    const smsUrl = `sms:+91${phone}?body=${encodeURIComponent(msg)}`;
    const shareViaWa = await showBusYatraConfirm({ title: "পিন শেয়ার মাধ্যম", subtitle: `Open WhatsApp to share the temporary ${role} PIN? Choose Cancel/No to open an SMS draft.`, icon: "💬", confirmText: "WhatsApp", cancelText: "SMS", danger: false }); if (shareViaWa) {
        window.open(whatsappUrl, '_blank', 'noopener');
    } else {
        window.location.href = smsUrl;
    }
}

// --- Super Admin: All Bus Captains (Conductors) Directory ---
let adminCaptainsList = [];
let adminCaptainsData = [];

function populateAdminCaptainBuses() {
    const select = document.getElementById('adminNewCaptainBusSelect');
    if (!select) return;
    const db = getAppData();
    const buses = db.buses || [];
    if (buses.length === 0) {
        select.innerHTML = '<option value="">-- ' + window.t('কোনো বাস পাওয়া যায়নি', 'No Buses Found') + ' --</option>';
        return;
    }
    select.innerHTML = `<option value="">${window.t('-- বাস ও মালিক নির্বাচন করুন --', '-- Select Bus & Owner --')}</option>` +
        buses.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)} (${escapeHtml(b.busNumber || b.id)}) - Owner: ${escapeHtml(b.ownerName || b.ownerPhone || 'N/A')}</option>`).join('');
}
window.populateAdminCaptainBuses = populateAdminCaptainBuses;

async function submitAdminRegisterCaptain() {
    const busSelect = document.getElementById('adminNewCaptainBusSelect');
    const nameInput = document.getElementById('adminNewCaptainName');
    const phoneInput = document.getElementById('adminNewCaptainPhone');
    const pinInput = document.getElementById('adminNewCaptainPin');

    const busId = (busSelect?.value || '').trim();
    const name = (nameInput?.value || '').trim();
    const phone = (phoneInput?.value || '').trim();
    const pin = (pinInput?.value || '').trim();

    if (!busId) {
        alert(window.t('অনুগ্রহ করে একটি বাস নির্বাচন করুন।', 'Please select a bus.'));
        return;
    }
    if (!name || name.length < 2) {
        alert(window.t('অনুগ্রহ করে কন্ডাক্টর/ক্যাপ্টেনের নাম লিখুন।', 'Please enter captain name.'));
        return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
        alert('অনুগ্রহ করে সঠিক ১০-সংখ্যার মোবাইল নম্বর দিন। (Enter valid 10-digit mobile number)');
        return;
    }
    if (!/^\d{4}$/.test(pin)) {
        alert(window.t('লগইনের জন্য একটি ৪-সংখ্যার পিন নির্ধারণ করুন।', 'Please set a 4-digit PIN for login.'));
        return;
    }

    try {
        const res = await apiRequest('/api/admin/captains', {
            method: 'POST',
            body: JSON.stringify({ busId, name, phone, pin })
        });

        alert(`🎉 ক্যাপ্টেন/কন্ডাক্টর '${name}' সফলভাবে নিবন্ধিত হয়েছে!\n\nক্যাপ্টেন এখন তার মোবাইল (${phone}) এবং ৪-ডিজিটের পিন (${pin}) দিয়ে ক্যাপ্টেন পোর্টালে (captain.html) লগইন করতে পারবেন।`);
        if (nameInput) nameInput.value = '';
        if (phoneInput) phoneInput.value = '';
        if (pinInput) pinInput.value = '';
        await loadAdminCaptainsData();
        await initAdminDashboard();
    } catch (err) {
        alert(err.message || 'Failed to register captain.');
    }
}
window.submitAdminRegisterCaptain = submitAdminRegisterCaptain;

async function loadAdminCaptainsData() {
    populateAdminCaptainBuses();
    const container = document.getElementById('adminCaptainsList');
    if (!container) return;
    try {
        container.innerHTML = '<div class="text-center text-gray-400 py-6 text-xs">Loading all bus captains...</div>';
        const res = await apiRequest('/api/admin/captains');
        adminCaptainsList = res.captains || [];
        adminCaptainsData = adminCaptainsList;
        renderAdminCaptainsList(adminCaptainsList);
        if (typeof filterAdminCustomersList === 'function') filterAdminCustomersList();
    } catch (err) {
        container.innerHTML = `<div class="text-center text-red-500 py-6 text-xs">Failed to load captains: ${err.message}</div>`;
    }
}

function filterAdminCaptainsList() {
    const q = (document.getElementById('adminCaptainSearch')?.value || '').trim().toLowerCase();
    if (!q) {
        renderAdminCaptainsList(adminCaptainsList);
        return;
    }
    const filtered = adminCaptainsList.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.bus_name && c.bus_name.toLowerCase().includes(q))
    );
    renderAdminCaptainsList(filtered);
}

function renderAdminCaptainsList(captains) {
    const container = document.getElementById('adminCaptainsList');
    if (!container) return;

    if (!captains || captains.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 py-6 text-xs">No captains found.</div>';
        return;
    }

    container.innerHTML = captains.map(c => {
        const isSuspended = c.status === 'suspended' || c.active === 0 || c.active === false;
        const isBanned = c.status === 'permanently_banned';
        const statusBadge = isBanned
            ? (`<span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-800 border border-red-300">${window.t('⛔ নিষিদ্ধ', '⛔ Banned')}</span>`)
            : isSuspended
                ? (`<span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300">${window.t('⚠️ স্থগিত', '⚠️ Suspended')}</span>`)
                : (`<span class="text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700 border border-green-300">${window.t('🟢 সচল', '🟢 Active')}</span>`);

        return `
        <div class="bg-gray-50 hover:bg-gray-100/70 p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs transition">
            <div class="space-y-1">
                <div class="font-bold text-gray-900 text-sm flex items-center gap-2">
                    <span>${escapeHtml(c.name)}</span>
                    ${statusBadge}
                </div>
                <div class="text-gray-600 flex flex-wrap items-center gap-2">
                    <span>📱 Mobile: <span class="font-mono font-bold">${c.phone}</span></span>
                    <span class="inline-flex items-center gap-1 font-mono font-black text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-[11px] shadow-xs">
                        🔑 PIN: ${escapeHtml(c.pin || '••••')}
                    </span>
                    <span>| 🚌 Bus: <span class="font-medium">${escapeHtml(c.bus_name || c.bus_id)} (${escapeHtml(c.bus_number || '')})</span></span>
                </div>
                <div>${formatDeviceInlineBadge(c)}</div>
            </div>
            <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button type="button" onclick="adminAccessCaptainPortal('${c.phone}', '${c.bus_id}', '${escapeHtml(c.name || 'Captain')}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1.5" title="Access Captain Panel Directly">
                    👨‍✈️ ${window.t('এক্সেস প্যানেল', 'Access Portal')}
                </button>
                <button type="button" onclick="adminResetCaptainPin('${c.phone}', '${escapeHtml(c.name || 'Captain')}', '${escapeHtml(c.bus_name || '')}')" class="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition">
                    🔑 PIN
                </button>
                <button type="button" onclick="openAdminCaptainFeaturesNextGen('${c.phone}')" class="bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1" title="Customize Captain Features">
                    ⚡ Features
                </button>
                ${(isSuspended || isBanned) ? `
                    <button type="button" onclick="adminToggleUserAccess('${c.phone}', 'captain', 'activate')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs transition">
                        🟢 Reactivate
                    </button>
                ` : `
                    <button type="button" onclick="adminToggleUserAccess('${c.phone}', 'captain', 'suspend')" class="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs transition">
                        ⚠️ Suspend
                    </button>
                    <button type="button" onclick="adminToggleUserAccess('${c.phone}', 'captain', 'ban')" class="bg-red-700 hover:bg-red-800 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs transition">
                        ⛔ Ban
                    </button>
                `}
                <button type="button" onclick="adminDeleteCaptain('${c.id}', '${c.phone}', '${c.bus_id}')" class="bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1.5 rounded-xl font-bold text-xs transition">
                    🗑 Delete
                </button>
            </div>
        </div>
        `;
    }).join('');
}

async function adminResetCaptainPin(phone, name, busName) {
    const newPin = prompt(`Enter new 4-digit PIN for captain ${phone}:`);
    if (!newPin) return;
    if (!/^\d{4}$/.test(newPin.trim())) {
        alert('PIN must be exactly 4 digits.');
        return;
    }
    try {
        await apiRequest('/api/admin/reset-pin', {
            method: 'POST',
            body: JSON.stringify({ role: 'captain', identifier: phone, newPin: newPin.trim() })
        });
        sharePortalPin(name, phone, newPin.trim(), 'captain', busName);
        loadAdminCaptainsData();
    } catch (err) {
        alert(err.message || 'Failed to update PIN.');
    }
}

async function adminToggleCaptain(id, newActive) {
    try {
        await apiRequest(`/api/admin/captains/${encodeURIComponent(id)}`, {
            method: 'POST',
            body: JSON.stringify({ toggleActive: Boolean(newActive) })
        });
        loadAdminCaptainsData();
    } catch (err) {
        alert(err.message || 'Failed to update status.');
    }
}

async function adminDeleteCaptain(id, phone, busId) {
    const target = phone || id || busId;
    if (!target) {
        alert('ক্যাপ্টেন সনাক্তকরণ পাওয়া যায়নি।');
        return;
    }
    const ok = await showBusYatraConfirm({
        title: "ক্যাপ্টেন অ্যাকাউন্ট ডিলিট",
        subtitle: "আপনি কি নিশ্চিত এই ক্যাপ্টেন অ্যাকাউন্টটি Cloudflare ডাটাবেস থেকে স্থায়ীভাবে ডিলিট করতে চান?\n\n• ডিলিট করলে সংশ্লিষ্ট বাসের ড্রাইভার পদ শূন্য হবে।\n• এই মোবাইল নম্বর দিয়ে ক্যাপ্টেন পোর্টালে আর কখনোই লগইন করা যাবে না।",
        icon: "🗑️",
        confirmText: "হ্যাঁ, স্থায়ীভাবে ডিলিট করুন",
        cancelText: "বাতিল",
        danger: true,
        badge: "Permanent Purge"
    });
    if (!ok) return;

    try {
        const res = await apiRequest(`/api/admin/captains/${encodeURIComponent(target)}`, {
            method: 'DELETE'
        });
        showDropDownToast(res?.message || '✅ ক্যাপ্টেন সফলভাবে মুছে ফেলা হয়েছে!', 'success');
        await loadAdminCaptainsData();
        if (typeof loadAdminCustomersData === 'function') await loadAdminCustomersData();
    } catch (err) {
        alert(err.message || 'ক্যাপ্টেন ডিলিট করতে সমস্যা হয়েছে।');
    }
}
window.adminDeleteCaptain = adminDeleteCaptain;

async function adminDeleteOwner(phone, name) {
    if (!phone) {
        alert('মালিকের মোবাইল নম্বর পাওয়া যায়নি।');
        return;
    }
    const ok = await showBusYatraConfirm({
        title: "বাস মালিক সম্পূর্ণ ডিলিট নিশ্চিতকরণ",
        subtitle: `⚠️ চরম সতর্কতা:\n\nআপনি কি নিশ্চিত যে বাস মালিক ${name || ''} (${phone})-এর অ্যাকাউন্ট চিরতরে ডিলিট করতে চান?\n\nএটি নিশ্চিত করলে:\n• মালিকের সমস্ত নিবন্ধিত বাস সম্পূর্ণ মুছে যাবে।\n• ওই বাসগুলির সমস্ত ক্যাপ্টেন অ্যাকাউন্ট সাথে সাথে ডিলিট হয়ে যাবে।\n• এই মোবাইল নম্বর দিয়ে মালিক বা ক্যাপ্টেন হিসেবে আর কখনোই লগইন করা যাবে না।`,
        icon: "🗑️",
        confirmText: "হ্যাঁ, সম্পূর্ণ ডিলিট ও ব্যান করুন",
        cancelText: "বাতিল",
        danger: true,
        badge: "Permanent Purge"
    });
    if (!ok) return;

    try {
        const res = await apiRequest(`/api/admin/owners/${encodeURIComponent(phone)}`, {
            method: 'DELETE'
        });
        showDropDownToast(res?.message || '✅ বাস মালিক সফলভাবে ডিলিট করা হয়েছে!', 'success');
        await loadAdminDashboard();
        await loadAdminOwnersData();
        await loadAdminCaptainsData();
        if (typeof loadAdminCustomersData === 'function') await loadAdminCustomersData();
    } catch (err) {
        alert(err.message || 'বাস মালিক ডিলিট করতে সমস্যা হয়েছে।');
    }
}
window.adminDeleteOwner = adminDeleteOwner;

// --- Super Admin: Owners Directory with PIN & WhatsApp ---
let adminOwnersData = [];

async function loadAdminOwnersData() {
    try {
        const res = await apiRequest('/api/admin/owners');
        adminOwnersData = res.owners || [];
        renderAdminOwnersList();
        if (typeof filterAdminCustomersList === 'function') filterAdminCustomersList();
    } catch (err) {
        console.warn('Could not fetch owners table:', err);
    }
}

// --- Customer Feedback Management & WhatsApp Sharing ---
let adminFeedbackCache = [];

function updateFeedbackBadges() {
    const db = getAppData();
    const reviews = db.reviews || [];
    const badgeTop = document.getElementById('badgeFeedbackCount');
    const badgeSide = document.getElementById('badgeSidebarFeedback');
    if (badgeTop) {
        badgeTop.innerText = reviews.length;
        badgeTop.classList.toggle('hidden', reviews.length === 0);
    }
    if (badgeSide) {
        badgeSide.innerText = reviews.length;
        badgeSide.classList.toggle('hidden', reviews.length === 0);
    }
    const badgeMob = document.getElementById('badgeMobileFeedback');
    if (badgeMob) {
        badgeMob.innerText = reviews.length;
        badgeMob.classList.toggle('hidden', reviews.length === 0);
    }
}
window.updateFeedbackBadges = updateFeedbackBadges;

async function loadAdminFeedback() {
    try {
        const data = await apiRequest('/api/admin/state');
        setAppData(data);
    } catch (e) {
        console.warn("Could not reload admin state for feedback:", e);
    }

    const db = getAppData();
    adminFeedbackCache = db.reviews || [];
    updateFeedbackBadges();

    const busFilter = document.getElementById('feedbackFilterBus');
    if (busFilter) {
        const currentVal = busFilter.value;
        busFilter.innerHTML = `<option value="">${window.t('-- সব বাস --', '-- All Buses --')}</option>`;
        (db.buses || []).forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.innerText = `${b.name} (${b.busNumber || 'Coach'})`;
            busFilter.appendChild(opt);
        });
        busFilter.value = currentVal;
    }

    const total = adminFeedbackCache.length;
    let avg = 5.0;
    let fiveStars = 0;
    let lowStars = 0;
    if (total > 0) {
        const sum = adminFeedbackCache.reduce((acc, r) => acc + (parseInt(r.rating, 10) || 5), 0);
        avg = (sum / total).toFixed(1);
        fiveStars = adminFeedbackCache.filter(r => (parseInt(r.rating, 10) || 5) === 5).length;
        lowStars = adminFeedbackCache.filter(r => (parseInt(r.rating, 10) || 5) <= 2).length;
    }

    const statAvg = document.getElementById('statAvgRating');
    const statTotal = document.getElementById('statTotalFeedbacks');
    const stat5Star = document.getElementById('stat5StarFeedbacks');
    const statLow = document.getElementById('statLowFeedbacks');
    if (statAvg) statAvg.innerText = total > 0 ? `⭐ ${avg} / 5.0` : '⭐ N/A';
    if (statTotal) statTotal.innerText = total;
    if (stat5Star) stat5Star.innerText = fiveStars;
    if (statLow) statLow.innerText = lowStars;

    filterAdminFeedbackList();
}
window.loadAdminFeedback = loadAdminFeedback;

function filterAdminFeedbackList() {
    const busVal = document.getElementById('feedbackFilterBus')?.value || '';
    const ratingVal = document.getElementById('feedbackFilterRating')?.value || '';
    const searchVal = (document.getElementById('feedbackSearchText')?.value || '').toLowerCase().trim();

    const filtered = adminFeedbackCache.filter(r => {
        if (busVal && r.busId !== busVal) {
            const bus = (getAppData().buses || []).find(b => b.id === busVal);
            if (!bus || r.busName !== bus.name) return false;
        }
        if (ratingVal) {
            const rNum = parseInt(r.rating, 10) || 5;
            if (ratingVal === 'low' && rNum > 2) return false;
            if (ratingVal !== 'low' && rNum !== parseInt(ratingVal, 10)) return false;
        }
        if (searchVal) {
            const name = (r.passengerName || '').toLowerCase();
            const phone = (r.passengerPhone || '').toLowerCase();
            const comment = (r.comment || '').toLowerCase();
            if (!name.includes(searchVal) && !phone.includes(searchVal) && !comment.includes(searchVal)) {
                return false;
            }
        }
        return true;
    });

    renderAdminFeedbackCards(filtered);
}
window.filterAdminFeedbackList = filterAdminFeedbackList;

function renderAdminFeedbackCards(reviews) {
    const container = document.getElementById('adminFeedbackList');
    if (!container) return;

    if (!reviews || reviews.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-400 py-10 text-xs bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                ${window.t('কোনো ফিডব্যাক পাওয়া যায়নি।', 'No feedback found matching filters.')}
            </div>
        `;
        return;
    }

    const db = getAppData();
    container.innerHTML = reviews.map(r => {
        const ratingNum = Math.min(5, Math.max(1, parseInt(r.rating, 10) || 5));
        const starsStr = '⭐'.repeat(ratingNum);
        const bus = (db.buses || []).find(b => b.id === r.busId) || { name: r.busName || 'Bus Yatra Express', busNumber: 'WB-Coach', ownerPhone: '' };
        const cleanDate = r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Recent';

        return `
            <div class="p-4 bg-white rounded-2xl border border-gray-200 shadow-xs hover:border-amber-300 transition space-y-3">
                <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b pb-2.5">
                    <div>
                        <div class="flex items-center gap-2">
                            <h4 class="font-bold text-gray-900 text-sm">${escapeHtml(r.passengerName || 'Anonymous Passenger')}</h4>
                            <span class="text-xs font-mono text-gray-500 font-semibold bg-gray-100 px-2 py-0.5 rounded-md">${escapeHtml(r.passengerPhone || '')}</span>
                        </div>
                        <p class="text-xs text-gray-500 mt-0.5">
                            🚌 <strong>${escapeHtml(bus.name || r.busName || 'Bus')}</strong> (${escapeHtml(bus.busNumber || '')}) • 🕒 ${escapeHtml(cleanDate)}
                        </p>
                    </div>
                    <div class="flex items-center gap-1.5 self-start sm:self-auto">
                        <span class="text-base">${starsStr}</span>
                        <span class="text-xs font-black px-2 py-0.5 rounded-full ${ratingNum >= 4 ? 'bg-green-100 text-green-800' : (ratingNum === 3 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800')}">
                            ${ratingNum} / 5
                        </span>
                    </div>
                </div>

                <div class="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 italic leading-relaxed">
                    "${escapeHtml(r.comment || 'No written comment provided.')}"
                </div>

                <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div class="flex items-center gap-2">
                        ${r.passengerPhone ? `
                            <a href="tel:${escapeHtml(r.passengerPhone)}" class="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                                📞 Call Passenger
                            </a>
                            <a href="https://wa.me/91${escapeHtml(r.passengerPhone)}" target="_blank" class="text-[11px] font-bold text-green-600 hover:underline flex items-center gap-1">
                                💬 WhatsApp
                            </a>
                        ` : ''}
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="downloadFeedbackPdf('${escapeHtml(r.id)}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs" title="Download official PDF report">
                            📄 Download PDF
                        </button>
                        <button onclick="sendFeedbackToOwner('${escapeHtml(r.id)}')" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs" title="Send this review directly to the bus owner via WhatsApp">
                            💬 Send to Owner
                        </button>
                        <button onclick="deleteAdminReview('${escapeHtml(r.id)}')" class="bg-red-50 hover:bg-red-100 text-red-700 px-2.5 py-1.5 rounded-lg text-xs font-bold transition" title="Delete Review">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}
window.renderAdminFeedbackCards = renderAdminFeedbackCards;

function downloadFeedbackPdf(reviewId) {
    const review = (adminFeedbackCache || []).find(r => r.id === reviewId);
    if (!review) return alert("Feedback review not found.");

    const db = getAppData();
    const bus = (db.buses || []).find(b => b.id === review.busId) || { name: review.busName || 'Bus Yatra Express', busNumber: 'WB-Coach' };
    const ratingNum = Math.min(5, Math.max(1, parseInt(review.rating, 10) || 5));

    document.getElementById('printFeedbackId').innerText = review.id;
    document.getElementById('printFeedbackDate').innerText = review.createdAt ? new Date(review.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');
    document.getElementById('printPassengerName').innerText = review.passengerName || 'Passenger';
    document.getElementById('printPassengerPhone').innerText = review.passengerPhone || 'N/A';
    document.getElementById('printBusName').innerText = bus.name || review.busName || 'Bus Yatra Coach';
    document.getElementById('printBusNumber').innerText = bus.busNumber || 'WB-Registered';
    document.getElementById('printFeedbackRating').innerText = '⭐'.repeat(ratingNum) + ` (${ratingNum} / 5 Stars)`;
    document.getElementById('printFeedbackComment').innerText = `"${review.comment || 'No additional comment provided.'}"`;

    window.print();
}
window.downloadFeedbackPdf = downloadFeedbackPdf;

function printAllFeedbackReport() {
    window.print();
}
window.printAllFeedbackReport = printAllFeedbackReport;

function sendFeedbackToOwner(reviewId) {
    const review = (adminFeedbackCache || []).find(r => r.id === reviewId);
    if (!review) return alert("Feedback review not found.");

    const db = getAppData();
    const bus = (db.buses || []).find(b => b.id === review.busId) || {
        name: review.busName || 'Bus Yatra Express',
        busNumber: 'WB-Coach',
        ownerPhone: ''
    };

    let targetPhone = bus.ownerPhone ? bus.ownerPhone.replace(/\D/g, '') : '';
    if (!targetPhone) {
        const input = prompt("Enter Bus Owner 10-digit WhatsApp phone number to send this review:", "");
        if (!input) return;
        targetPhone = input.replace(/\D/g, '');
    }

    const ratingNum = Math.min(5, Math.max(1, parseInt(review.rating, 10) || 5));
    const stars = '⭐'.repeat(ratingNum);
    const dateStr = review.createdAt ? new Date(review.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');

    const msg = `🚌 *Bus Yatra Passenger Feedback Report*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🚍 *Bus:* ${bus.name} (${bus.busNumber})\n` +
                `👤 *Passenger:* ${review.passengerName || 'Passenger'} (${review.passengerPhone || 'N/A'})\n` +
                `⭐ *Rating:* ${stars} (${ratingNum}/5 Stars)\n` +
                `📅 *Date:* ${dateStr}\n\n` +
                `📝 *Passenger Feedback Note:*\n` +
                `"${review.comment || 'No written note.'}"\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `_Forwarded from Bus Yatra Super Admin Portal_`;

    const waUrl = `https://wa.me/91${targetPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
}
window.sendFeedbackToOwner = sendFeedbackToOwner;

async function deleteAdminReview(reviewId) {
    const ok = await showBusYatraConfirm({ title: "ফিডব্যাক রিভিউ ডিলিট", subtitle: "Are you sure you want to delete this customer feedback review? This cannot be undone.", icon: "🗑️", confirmText: "হ্যাঁ, ডিলিট করুন", cancelText: "বাতিল", danger: true }); if (!ok) return;
    try {
        await apiRequest(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, { method: 'DELETE' });
        adminFeedbackCache = adminFeedbackCache.filter(r => r.id !== reviewId);
        filterAdminFeedbackList();
        updateFeedbackBadges();
        alert("✅ Customer feedback review deleted successfully.");
    } catch (err) {
        alert(err.message || "Failed to delete review.");
    }
}
window.deleteAdminReview = deleteAdminReview;

// --- All Portals Official Android APKs & QR Download Hub ---
let currentAdminQrPortal = 'customer';

const GITHUB_REPO_OWNER = 'gopalchjana0-netizen';
const GITHUB_REPO_NAME = 'bus-yatra';
const GITHUB_RELEASE_TAG = 'v1.0.0';
const GITHUB_APK_BASE_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/download/${GITHUB_RELEASE_TAG}`;

const ADMIN_PORTAL_QR_CONFIG = {
    customer: {
        id: 'customer',
        title: 'Customer Bus Booking App',
        titleBn: 'সাধারণ যাত্রী বাস বুকিং APK',
        desc: 'যাত্রীরা টিকিট কাটতে ও লাইভ বাস ট্র্যাক করতে এই আসল Android APK সরাসরি ডাউনলোড করতে পারবেন।',
        apkName: 'BusYatra-Customer.apk',
        apkUrl: `${GITHUB_APK_BASE_URL}/BusYatra-Customer.apk`,
        url: `${GITHUB_APK_BASE_URL}/BusYatra-Customer.apk`,
        webUrl: 'https://busyatra.pages.dev/?source=customer_apk',
        icon: 'icons/icon-192.png',
        qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(`${GITHUB_APK_BASE_URL}/BusYatra-Customer.apk`)}`,
        appName: 'Bus Yatra',
        badge: 'Passenger APK',
        colorClass: 'text-red-600',
        borderClass: 'border-red-500',
        bgClass: 'bg-red-50',
        shareText: '🚌 Bus Yatra অফিশিয়াল Android APK ডাউনলোড করুন!\n\nপ্লে-স্টোরের কোনো ঝামেলা ছাড়াই সরাসরি আসল অ্যাপ ইনস্টল করে টিকিট কাটুন ও বাসের লাইভ অবস্থান ট্র্যাক করুন:\n👉 সরাসরি APK ডাউনলোড লিংক: https://github.com/gopalchjana0-netizen/bus-yatra/releases/download/v1.0.0/BusYatra-Customer.apk\n\n(যেকোনো Android ফোনে ১-ক্লিকেই ইনস্টল হবে!)'
    },
    owner: {
        id: 'owner',
        title: 'Bus Owner Portal App',
        titleBn: 'বাস মালিক ফ্লিট ম্যানেজমেন্ট APK',
        desc: 'বাসের মালিকদের জন্য সম্পূর্ণ ফ্লিট ও আয়-ব্যয় নিয়ন্ত্রণের অফিশিয়াল অ্যান্ড্রয়েড APK।',
        apkName: 'BusYatra-Owner.apk',
        apkUrl: `${GITHUB_APK_BASE_URL}/BusYatra-Owner.apk`,
        url: `${GITHUB_APK_BASE_URL}/BusYatra-Owner.apk`,
        webUrl: 'https://busyatra.pages.dev/owner?source=owner_apk',
        icon: 'icons/owner-192.png',
        qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(`${GITHUB_APK_BASE_URL}/BusYatra-Owner.apk`)}`,
        appName: 'Bus Yatra - Bus Owner',
        badge: 'Fleet Owner APK',
        colorClass: 'text-yellow-600',
        borderClass: 'border-yellow-500',
        bgClass: 'bg-yellow-50',
        shareText: '👑 Bus Yatra Owner অফিশিয়াল Android APK ডাউনলোড করুন!\n\nবাসের সমস্ত রুট, বুকিং লাভ-খরচ খতিয়ান ও ফ্লিট নিয়ন্ত্রণ করুন আপনার ফোনে:\n👉 সরাসরি APK ডাউনলোড লিংক: https://github.com/gopalchjana0-netizen/bus-yatra/releases/download/v1.0.0/BusYatra-Owner.apk'
    },
    captain: {
        id: 'captain',
        title: 'Bus Captain & Conductor App',
        titleBn: 'ক্যাপ্টেন ও কন্ডাক্টর ভেরিফায়ার APK',
        desc: 'ক্যাপ্টেন বা কন্ডাক্টরদের জন্য লাইভ GPS ব্রডকাস্ট এবং ক্যামেরা দিয়ে টিকিট স্ক্যানার APK।',
        apkName: 'BusYatra-Captain.apk',
        apkUrl: `${GITHUB_APK_BASE_URL}/BusYatra-Captain.apk`,
        url: `${GITHUB_APK_BASE_URL}/BusYatra-Captain.apk`,
        webUrl: 'https://busyatra.pages.dev/captain?source=captain_apk',
        icon: 'icons/captain-192.png',
        qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(`${GITHUB_APK_BASE_URL}/BusYatra-Captain.apk`)}`,
        appName: 'Bus Yatra - Bus Captain',
        badge: 'Captain & GPS APK',
        colorClass: 'text-blue-600',
        borderClass: 'border-blue-500',
        bgClass: 'bg-blue-50',
        shareText: '👨‍✈️ Bus Yatra Captain অফিশিয়াল Android APK ডাউনলোড করুন!\n\nযাত্রীদের টিকিট ভেরিফিকেশন ও বাসের লাইভ জিপিএস লোকেশন ব্রডকাস্ট করুন:\n👉 সরাসরি APK ডাউনলোড লিংক: https://github.com/gopalchjana0-netizen/bus-yatra/releases/download/v1.0.0/BusYatra-Captain.apk'
    },
    admin: {
        id: 'admin',
        title: 'Super Admin Mobile App',
        titleBn: 'সুপার অ্যাডমিন কনসোল APK',
        desc: 'সুপার অ্যাডমিনের জন্য সুরক্ষিত সম্পূর্ণ কন্ট্রোল ও মনিটরিং কনসোল APK।',
        apkName: 'BusYatra-Admin.apk',
        apkUrl: `${GITHUB_APK_BASE_URL}/BusYatra-Admin.apk`,
        url: `${GITHUB_APK_BASE_URL}/BusYatra-Admin.apk`,
        webUrl: 'https://busyatra.pages.dev/admin?source=admin_apk',
        icon: 'icons/admin-192.png',
        qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(`${GITHUB_APK_BASE_URL}/BusYatra-Admin.apk`)}`,
        appName: 'Bus Yatra - Super Admin',
        badge: 'Super Admin APK',
        colorClass: 'text-purple-600',
        borderClass: 'border-purple-500',
        bgClass: 'bg-purple-50',
        shareText: '🛡️ Bus Yatra Super Admin সুরক্ষিত Android APK ডাউনলোড করুন:\n👉 সরাসরি APK ডাউনলোড লিংক: https://github.com/gopalchjana0-netizen/bus-yatra/releases/download/v1.0.0/BusYatra-Admin.apk'
    }
};

function switchAdminPortalQr(portalKey) {
    if (!ADMIN_PORTAL_QR_CONFIG[portalKey]) portalKey = 'customer';
    currentAdminQrPortal = portalKey;
    const cfg = ADMIN_PORTAL_QR_CONFIG[portalKey];

    // Update active tab styles
    ['customer', 'owner', 'captain', 'admin'].forEach(k => {
        const tabBtn = document.getElementById(`btnQrTab_${k}`);
        if (tabBtn) {
            if (k === portalKey) {
                tabBtn.className = "flex-1 min-w-[110px] py-2 px-2.5 rounded-xl text-xs font-black bg-white text-gray-900 shadow-sm border border-gray-200 transition text-center flex items-center justify-center gap-1";
            } else {
                tabBtn.className = "flex-1 min-w-[110px] py-2 px-2.5 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-900 hover:bg-white/50 transition text-center flex items-center justify-center gap-1";
            }
        }
    });

    // Populate active card
    const titleEl = document.getElementById('adminQrActiveTitle');
    const descEl = document.getElementById('adminQrActiveDesc');
    const imgEl = document.getElementById('adminQrActiveImg');
    const linkEl = document.getElementById('adminQrActiveApkLink');
    const badgeEl = document.getElementById('adminQrActiveBadge');
    const iconEl = document.getElementById('adminQrActiveIcon');
    const apkBtnText = document.getElementById('adminQrActiveApkBtnText');

    if (titleEl) titleEl.innerText = `${cfg.titleBn} (${cfg.apkName})`;
    if (descEl) descEl.innerText = cfg.desc;
    if (imgEl) {
        imgEl.src = cfg.qrUrl;
        imgEl.alt = `${cfg.title} QR Code`;
    }
    if (linkEl) {
        linkEl.href = cfg.apkUrl;
        linkEl.innerText = cfg.apkUrl;
    }
    if (badgeEl) badgeEl.innerText = cfg.badge;
    if (iconEl) iconEl.src = cfg.icon;
    if (apkBtnText) apkBtnText.innerText = `ডাউনলোড ${cfg.apkName}`;
}
window.switchAdminPortalQr = switchAdminPortalQr;

function openAdminAppQrModal() {
    const modal = document.getElementById('adminAppQrModal');
    if (modal) {
        modal.classList.remove('hidden');
        switchAdminPortalQr(currentAdminQrPortal || 'customer');
    }
}
function closeAdminAppQrModal() {
    document.getElementById('adminAppQrModal')?.classList.add('hidden');
}
window.openAdminAppQrModal = openAdminAppQrModal;
window.closeAdminAppQrModal = closeAdminAppQrModal;

function downloadActiveAdminPortalApk() {
    const cfg = ADMIN_PORTAL_QR_CONFIG[currentAdminQrPortal] || ADMIN_PORTAL_QR_CONFIG.customer;
    if (typeof showDropDownToast === 'function') {
        showDropDownToast(`⬇️ ${cfg.apkName} ডাউনলোড শুরু হয়েছে...`, 'info');
    }
    const a = document.createElement('a');
    a.href = cfg.apkUrl;
    a.download = cfg.apkName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
window.downloadActiveAdminPortalApk = downloadActiveAdminPortalApk;

function copyActiveAdminPortalApkLink() {
    const cfg = ADMIN_PORTAL_QR_CONFIG[currentAdminQrPortal] || ADMIN_PORTAL_QR_CONFIG.customer;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cfg.apkUrl);
        if (typeof showDropDownToast === 'function') {
            showDropDownToast(`📋 APK ডাউনলোড লিংক কপি করা হয়েছে: ${cfg.apkName}`, 'success');
        } else {
            alert(`✅ APK ডাউনলোড লিংক কপি করা হয়েছে:\n\n${cfg.apkUrl}`);
        }
    } else {
        prompt('Copy APK Link:', cfg.apkUrl);
    }
}
window.copyActiveAdminPortalApkLink = copyActiveAdminPortalApkLink;

function copySingleApkLink(portalKey) {
    const cfg = ADMIN_PORTAL_QR_CONFIG[portalKey] || ADMIN_PORTAL_QR_CONFIG.customer;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(cfg.apkUrl);
        if (typeof showDropDownToast === 'function') {
            showDropDownToast(`📋 লিংক কপি করা হয়েছে: ${cfg.apkName}`, 'success');
        } else {
            alert(`✅ লিংক কপি করা হয়েছে:\n\n${cfg.apkUrl}`);
        }
    } else {
        prompt('Copy APK Link:', cfg.apkUrl);
    }
}
window.copySingleApkLink = copySingleApkLink;

async function downloadActiveAdminPortalQr() {
    const cfg = ADMIN_PORTAL_QR_CONFIG[currentAdminQrPortal] || ADMIN_PORTAL_QR_CONFIG.customer;
    if (navigator.userAgent.includes('BusYatraAndroidApp')) {
        const dlUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&format=png&download=1&data=${encodeURIComponent(cfg.apkUrl)}`;
        window.location.href = dlUrl;
        return;
    }
    try {
        if (typeof showDropDownToast === 'function') {
            showDropDownToast(`⏳ ${cfg.appName} QR কোড ডাউনলোড হচ্ছে...`, 'info');
        }
        const res = await fetch(cfg.qrUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `BusYatra_${cfg.id.toUpperCase()}_APK_QR.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        if (typeof showDropDownToast === 'function') {
            showDropDownToast(`✅ ${cfg.appName} QR কোড সফলভাবে ডাউনলোড হয়েছে!`, 'success');
        }
    } catch (e) {
        console.warn('QR download fallback triggered:', e);
        window.open(cfg.qrUrl, '_blank');
    }
}
window.downloadActiveAdminPortalQr = downloadActiveAdminPortalQr;

function copyActiveAdminPortalLink() {
    copyActiveAdminPortalApkLink();
}
window.copyActiveAdminPortalLink = copyActiveAdminPortalLink;

function shareActiveAdminPortalWhatsApp() {
    const cfg = ADMIN_PORTAL_QR_CONFIG[currentAdminQrPortal] || ADMIN_PORTAL_QR_CONFIG.customer;
    const text = encodeURIComponent(cfg.shareText);
    const waUrl = `https://api.whatsapp.com/send?text=${text}`;
    window.open(waUrl, '_blank');
}
window.shareActiveAdminPortalWhatsApp = shareActiveAdminPortalWhatsApp;

function printActiveAdminPortalFlyer() {
    const cfg = ADMIN_PORTAL_QR_CONFIG[currentAdminQrPortal] || ADMIN_PORTAL_QR_CONFIG.customer;
    const flyer = document.getElementById('printablePortalQrFlyer');
    if (!flyer) return;

    // Fill printable template
    const fTitle = document.getElementById('flyerPortalTitle');
    const fSub = document.getElementById('flyerPortalSub');
    const fImg = document.getElementById('flyerPortalQrImg');
    const fUrl = document.getElementById('flyerPortalUrl');
    const fIcon = document.getElementById('flyerPortalIcon');

    if (fTitle) fTitle.innerText = cfg.appName;
    if (fSub) fSub.innerText = `${cfg.titleBn} (${cfg.apkName})`;
    if (fImg) fImg.src = cfg.qrUrl;
    if (fUrl) fUrl.innerText = cfg.apkUrl;
    if (fIcon) fIcon.src = cfg.icon;

    window.print();
}
window.printActiveAdminPortalFlyer = printActiveAdminPortalFlyer;


// --- Feedback QR Code Image Download & Poster Modal ---
function openAdminFeedbackPosterModal() {
    const modal = document.getElementById('adminFeedbackPosterModal');
    if (modal) modal.classList.remove('hidden');
}
window.openAdminFeedbackPosterModal = openAdminFeedbackPosterModal;

function closeAdminFeedbackPosterModal() {
    const modal = document.getElementById('adminFeedbackPosterModal');
    if (modal) modal.classList.add('hidden');
}
window.closeAdminFeedbackPosterModal = closeAdminFeedbackPosterModal;

// --- Broadcast Notifications Management ---
async function loadAdminNotifications() {
    const list = document.getElementById('adminNotificationsList');
    if (!list) return;
    list.innerHTML = `<div class="text-center text-gray-400 py-6 text-xs">Loading notifications...</div>`;
    try {
        const res = await apiRequest('/api/admin/notifications');
        const notifs = res.notifications || [];
        if (!notifs.length) {
            list.innerHTML = `<div class="text-center text-gray-400 py-8 text-xs">No notifications sent yet. Use the form above to send your first announcement.</div>`;
            return;
        }
        list.innerHTML = notifs.map(n => {
            const isPaused = n.status === 'paused';
            const targetBadge = n.target_group === 'all' 
                ? '<span class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[10px] font-bold">👥 All (Customer & Owner)</span>'
                : n.target_group === 'customers'
                ? '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">👤 Customers</span>'
                : '<span class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold">🚌 Bus Owners</span>';
            
            const typeIcon = n.type === 'alert' ? '⚠️' : n.type === 'offer' ? '🎁' : n.type === 'announcement' ? '📢' : 'ℹ️';
            const statusBadge = isPaused
                ? '<span class="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-[10px] font-bold">⏸️ Paused (স্থগিত)</span>'
                : '<span class="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-[10px] font-bold">🟢 Active (সক্রিয়)</span>';
            
            const dateStr = new Date(n.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

            return `
            <div class="p-4 rounded-2xl border ${isPaused ? 'bg-yellow-50/50 border-yellow-200 opacity-80' : 'bg-gray-50 border-gray-200'} space-y-2 text-xs transition">
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/70 pb-2">
                    <div class="flex items-center gap-2">
                        <span class="text-base">${typeIcon}</span>
                        <h4 class="font-bold text-gray-900 text-sm">${escapeHtml(n.title)}</h4>
                    </div>
                    <div class="flex items-center gap-2">
                        ${targetBadge}
                        ${statusBadge}
                    </div>
                </div>
                <p class="text-gray-700 text-xs whitespace-pre-wrap">${escapeHtml(n.message)}</p>
                <div class="flex flex-wrap items-center justify-between pt-2 border-t border-gray-200/70 text-[11px] text-gray-500">
                    <span>🕒 Sent: ${dateStr}</span>
                    <div class="flex items-center gap-2">
                        <button onclick="toggleAdminNotificationStatus('${n.id}', '${isPaused ? 'active' : 'paused'}')" class="px-3 py-1 rounded-lg font-bold border transition ${isPaused ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'}">
                            ${isPaused ? '▶️ Resume' : '⏸️ Pause'}
                        </button>
                        <button onclick="deleteAdminNotification('${n.id}')" class="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold transition">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        list.innerHTML = `<div class="text-center text-red-600 py-6 text-xs">Error loading notifications: ${escapeHtml(err.message)}</div>`;
    }
}
window.loadAdminNotifications = loadAdminNotifications;

async function submitAdminNotification() {
    const target = document.getElementById('adminNotifTarget')?.value || 'all';
    const type = document.getElementById('adminNotifType')?.value || 'info';
    const title = (document.getElementById('adminNotifTitle')?.value || '').trim();
    const message = (document.getElementById('adminNotifMessage')?.value || '').trim();

    if (!title || !message) {
        alert('Please enter both a title and a message for the notification.');
        return;
    }

    const btn = document.getElementById('btnSendAdminNotif');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full mr-1.5"></span> Sending...`;

    try {
        await apiRequest('/api/admin/notifications', {
            method: 'POST',
            body: JSON.stringify({ targetGroup: target, type, title, message })
        });
        alert('🎉 নোটিফিকেশন সফলভাবে পাঠানো হয়েছে! (Notification broadcasted successfully!)');
        document.getElementById('adminNotifTitle').value = '';
        document.getElementById('adminNotifMessage').value = '';
        await loadAdminNotifications();
    } catch (err) {
        alert('Failed to send notification: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
    }
}
window.submitAdminNotification = submitAdminNotification;

async function toggleAdminNotificationStatus(id, newStatus) {
    try {
        await apiRequest('/api/admin/notifications/toggle', {
            method: 'POST',
            body: JSON.stringify({ id, status: newStatus })
        });
        await loadAdminNotifications();
    } catch (err) {
        alert('Error updating status: ' + err.message);
    }
}
window.toggleAdminNotificationStatus = toggleAdminNotificationStatus;

async function deleteAdminNotification(id) {
    const ok = await showBusYatraConfirm({
        title: 'নোটিফিকেশন মুছে ফেলা',
        subtitle: 'আপনি কি এই নোটিফিকেশনটি মুছে ফেলতে চান? এটি মুছে দিলে কাস্টমার ও বাস মালিক প্যানেল থেকে সাথে সাথে মুছে যাবে।',
        icon: '🗑️',
        confirmText: 'হ্যাঁ, মুছে ফেলুন',
        cancelText: 'বাতিল',
        danger: true
    });
    if (!ok) return;
    try {
        await apiRequest('/api/admin/notifications/delete', {
            method: 'POST',
            body: JSON.stringify({ id })
        });
        await loadAdminNotifications();
    } catch (err) {
        alert('Error deleting notification: ' + err.message);
    }
}
window.deleteAdminNotification = deleteAdminNotification;

// =========================================================================
// Real-Time Fleet Live GPS Tracking for Super Admin (Leaflet + Firebase Firestore <100ms + Cloudflare D1 API)
// =========================================================================
let adminTrackingMap = null;
let adminTrackingMarker = null;
let adminTrackingAccuracyCircle = null;
let activeAdminTrackedBusId = null;
let adminFirestoreUnsubscribe = null;

async function openAdminLiveTrackingModal(targetBusId = null) {
    const modal = document.getElementById('adminTrackingModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const db = getAppData();
    const buses = (db && db.buses) ? db.buses : [];
    const select = document.getElementById('adminTrackingBusSelect');

    if (select) {
        select.innerHTML = '';
        if (buses.length === 0) {
            select.innerHTML = '<option value="">' + window.t('কোনও বাস নিবন্ধিত নেই', 'No buses found') + '</option>';
        } else {
            buses.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = `${b.name} (${b.busNumber || 'N/A'}) - ${b.route || ''}`;
                if (targetBusId && String(b.id) === String(targetBusId)) {
                    opt.selected = true;
                }
                select.appendChild(opt);
            });
        }
    }

    if (!targetBusId && buses.length > 0) {
        targetBusId = buses[0].id;
    }

    if (targetBusId) {
        await startTrackingAdminBus(targetBusId);
    }
}
window.openAdminLiveTrackingModal = openAdminLiveTrackingModal;

function closeAdminLiveTrackingModal() {
    const modal = document.getElementById('adminTrackingModal');
    if (modal) modal.classList.add('hidden');
    if (adminFirestoreUnsubscribe) {
        adminFirestoreUnsubscribe();
        adminFirestoreUnsubscribe = null;
    }
    if (adminTrackingAccuracyCircle && adminTrackingMap) {
        adminTrackingMap.removeLayer(adminTrackingAccuracyCircle);
        adminTrackingAccuracyCircle = null;
    }
    activeAdminTrackedBusId = null;
}
window.closeAdminLiveTrackingModal = closeAdminLiveTrackingModal;

function onAdminTrackingBusChanged() {
    const sel = document.getElementById('adminTrackingBusSelect');
    if (!sel || !sel.value) return;
    startTrackingAdminBus(sel.value);
}
window.onAdminTrackingBusChanged = onAdminTrackingBusChanged;

function refreshAdminTrackingLocation() {
    if (activeAdminTrackedBusId) {
        startTrackingAdminBus(activeAdminTrackedBusId);
    }
}
window.refreshAdminTrackingLocation = refreshAdminTrackingLocation;

async function startTrackingAdminBus(busId) {
    activeAdminTrackedBusId = busId;
    if (adminFirestoreUnsubscribe) {
        adminFirestoreUnsubscribe();
        adminFirestoreUnsubscribe = null;
    }

    const badge = document.getElementById('adminTrackingGpsBadge');
    const titleEl = document.getElementById('adminTrackingTitle');
    const timeEl = document.getElementById('adminTrackingTime');
    const speedEl = document.getElementById('adminTrackingSpeed');
    const stopEl = document.getElementById('adminTrackingStoppage');

    const db = getAppData();
    const matchedBus = (db.buses || []).find(b => b.id === busId);
    if (titleEl && matchedBus) {
        titleEl.innerText = `${matchedBus.name} (${matchedBus.busNumber})`;
    }

    let hasReceivedFirestoreData = false;

    // 1. Firebase Firestore Real-Time WebSocket (<100ms)
    try {
        const firestoreDb = getBusYatraFirestore();
        if (firestoreDb) {
            adminFirestoreUnsubscribe = firestoreDb.collection('bus_locations').doc(String(busId))
                .onSnapshot(doc => {
                    if (doc.exists) {
                        hasReceivedFirestoreData = true;
                        const data = doc.data();
                        const lat = Number(data.lat || data.latitude);
                        const lng = Number(data.lng || data.longitude);
                        const speed = Number(data.speed || 0);
                        const accuracy = Number(data.accuracy || 15);
                        const stoppage = data.stopName || data.currentStoppage || data.stoppage || window.t('যাত্রাপথে', 'In Transit');
                        const updatedAt = data.updated_at ? new Date(data.updated_at) : (data.updatedAt ? new Date(data.updatedAt) : new Date());

                        if (badge) {
                            badge.className = 'px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 flex items-center gap-1';
                            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> 🟢 ' + window.t('GPS সক্রিয়', 'Live GPS');
                        }
                        if (speedEl) speedEl.innerText = `${speed} km/h`;
                        if (stopEl) stopEl.innerText = stoppage;
                        if (timeEl) timeEl.innerText = `সর্বশেষ আপডেট: ${updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

                        if (!isNaN(lat) && !isNaN(lng) && lat !== 0) {
                            renderAdminBusMarker(lat, lng, speed, matchedBus?.name, matchedBus?.busNumber, timeEl ? timeEl.innerText : '', accuracy);
                        }
                    }
                }, err => {
                    console.warn('Admin Firestore tracking listener error, falling back to D1 API:', err);
                });
        }
    } catch (e) {
        console.warn('Firebase init error for admin tracking:', e);
    }

    // 2. Cloudflare D1 Backend API Fallback
    try {
        const res = await apiRequest(`/api/tracking?busId=${encodeURIComponent(busId)}`);
        const loc = res ? res.location : null;
        if (!hasReceivedFirestoreData && loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
            const lat = Number(loc.lat);
            const lng = Number(loc.lng);
            const speed = 0;
            const stoppage = matchedBus?.fromCity || window.t('যাত্রাপথে', 'In Transit');
            const updatedAt = loc.location_updated_at ? new Date(loc.location_updated_at) : new Date();

            if (badge) {
                badge.className = 'px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 flex items-center gap-1';
                badge.innerHTML = '🟢 GPS সক্রিয় (Cloudflare D1)';
            }
            if (timeEl) timeEl.innerText = `${window.t('সর্বশেষ আপডেট:', 'Last Updated:')} ${updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

            if (badge) {
                badge.className = 'px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 flex items-center gap-1';
                badge.innerHTML = `🟢 ${window.t('GPS সক্রিয়', 'GPS Active')}`;
            }
            if (speedEl) speedEl.innerText = `${speed} km/h`;
            if (stopEl) stopEl.innerText = stoppage;
            if (timeEl) timeEl.innerText = `${window.t('সর্বশেষ আপডেট:', 'Last Updated:')} ${updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

            renderAdminBusMarker(lat, lng, speed, matchedBus?.name || loc.name, matchedBus?.busNumber || loc.bus_number, timeEl ? timeEl.innerText : '', 15);
        } else if (!hasReceivedFirestoreData && (!loc || loc.lat === null || loc.lng === null)) {
            if (badge) {
                badge.className = 'px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 flex items-center gap-1';
                badge.innerHTML = `⚠️ ${window.t('GPS সিগন্যাল অপেক্ষারত', 'Awaiting GPS Signal')}`;
            }
            if (timeEl) timeEl.innerText = window.t('ক্যাপ্টেন এখনও জিপিএস অন করেননি।', 'Captain has not enabled GPS yet.');
            if (speedEl) speedEl.innerText = '0 km/h';
            if (stopEl) stopEl.innerText = window.t('অজানা', 'Unknown');
        }
    } catch (apiErr) {
        console.warn('Location API fallback error:', apiErr);
    }
}
window.startTrackingAdminBus = startTrackingAdminBus;

function renderAdminBusMarker(lat, lng, speed = 0, busName = 'Bus', busNumber = '', lastUpdate = '', accuracy = 15) {
    const coordsEl = document.getElementById('adminTrackingCoords');
    if (coordsEl) {
        coordsEl.innerText = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
    }

    const mapContainer = document.getElementById('adminTrackingMap');
    if (!mapContainer || typeof L === 'undefined') return;

    if (!adminTrackingMap) {
        adminTrackingMap = L.map('adminTrackingMap', { attributionControl: false }).setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(adminTrackingMap);
        L.control.attribution({ prefix: false, position: 'bottomright' }).addAttribution('🛰️ Bus Yatra Own Map GPS System').addTo(adminTrackingMap);
    } else {
        adminTrackingMap.setView([lat, lng], 15);
        setTimeout(() => adminTrackingMap.invalidateSize(), 150);
    }

    const busIcon = L.divIcon({
        className: 'custom-bus-marker',
        html: `
            <div style="background: linear-gradient(135deg, #1e1b4b, #312e81); border: 2.5px solid #fbbf24; color: white; width: 44px; height: 44px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.4); transform: translate(-50%, -50%); position: relative;">
                <span style="font-size: 18px; line-height: 1;">🚌</span>
                <span style="font-size: 8px; font-weight: 900; color: #fde047; margin-top: 1px;">${speed}k</span>
            </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -22]
    });

    if (!adminTrackingMarker) {
        adminTrackingMarker = L.marker([lat, lng], { icon: busIcon }).addTo(adminTrackingMap);
    } else {
        adminTrackingMarker.setLatLng([lat, lng]);
        adminTrackingMarker.setIcon(busIcon);
    }

    if (accuracy && accuracy > 0) {
        if (!adminTrackingAccuracyCircle) {
            adminTrackingAccuracyCircle = L.circle([lat, lng], {
                radius: accuracy,
                color: '#4f46e5',
                weight: 1.5,
                fillColor: '#6366f1',
                fillOpacity: 0.15
            }).addTo(adminTrackingMap);
        } else {
            adminTrackingAccuracyCircle.setLatLng([lat, lng]);
            adminTrackingAccuracyCircle.setRadius(accuracy);
        }
    } else if (adminTrackingAccuracyCircle && adminTrackingMap) {
        adminTrackingMap.removeLayer(adminTrackingAccuracyCircle);
        adminTrackingAccuracyCircle = null;
    }

    adminTrackingMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; min-width: 170px; line-height: 1.4;">
            <strong style="color: #1e1b4b; font-size: 13px;">🚌 ${escapeHtml(busName)}</strong><br>
            <span style="color: #555; font-weight: bold;">নম্বর:</span> ${escapeHtml(busNumber || 'N/A')}<br>
            <span style="color: #555; font-weight: bold;">গতিবেগ:</span> <span style="color: #2563eb; font-weight: bold;">${speed} km/h</span><br>
            <span style="color: #059669; font-weight: bold;">স্যাটেলাইট নির্ভুলতা:</span> ±${accuracy}m<br>
            <small style="color: #888;">${escapeHtml(lastUpdate)}</small>
        </div>
    `).openPopup();
}

// Re-render language elements on portal-language-change
if (typeof window !== 'undefined') {
    window.addEventListener('portal-language-change', (e) => {
        const lang = e.detail?.lang || 'bn';
        console.log('Admin portal language switched to:', lang);
        if (typeof updateAdminSelectionToolbar === 'function') updateAdminSelectionToolbar();
        if (typeof renderAdminSupportTicketsList === 'function') renderAdminSupportTicketsList();
        if (typeof loadAdminBuses === 'function') loadAdminBuses();
        if (typeof renderAdminCustomersList === 'function') renderAdminCustomersList();
        if (typeof renderAdminCustomersPinList === 'function') renderAdminCustomersPinList(adminRegisteredCustomers);
        if (typeof renderAdminOwnersList === 'function') renderAdminOwnersList();
        if (typeof renderAdminCaptainsList === 'function') renderAdminCaptainsList(adminCaptainsList || adminCaptainsData || []);
        if (typeof renderAdminDevicesList === 'function') renderAdminDevicesList(adminDevicesCache.devices);
        if (typeof renderAdminLoginLogsList === 'function') renderAdminLoginLogsList(adminDevicesCache.recentLogs);
        if (typeof updateAdminAnalyticsKpiUI === 'function') updateAdminAnalyticsKpiUI(adminClientAnalyticsCache.stats);
        if (typeof renderAdminClientAnalyticsList === 'function') renderAdminClientAnalyticsList(adminClientAnalyticsCache.list);
        if (typeof renderAdminSubscriptionsUI === 'function') renderAdminSubscriptionsUI();
        if (typeof renderAdminCouponsList === 'function') renderAdminCouponsList();
        if (typeof loadAdminPromotions === 'function') loadAdminPromotions();
        if (typeof renderAdminFeatureFlags === 'function') renderAdminFeatureFlags();
        if (typeof updateAdminEmailRecipientsUI === 'function') updateAdminEmailRecipientsUI();
        if (typeof renderAdminOwnerAccessModal === 'function' && typeof allAdminOwnerModalList !== 'undefined' && allAdminOwnerModalList.length > 0) {
            renderAdminOwnerAccessModal(allAdminOwnerModalList);
        }
        if (typeof renderAdminCaptainAccessModal === 'function' && typeof allAdminCaptainModalList !== 'undefined' && allAdminCaptainModalList.length > 0) {
            renderAdminCaptainAccessModal(allAdminCaptainModalList);
        }
    });
}

// =========================================================================
// Operator Subscriptions, Dues with Timer & Access Control (Suspend / Ban / Unblock)
// =========================================================================
let adminSubscriptionsData = [];
let adminAclData = [];
let currentSubFilter = 'all';
let subTimerInterval = null;

async function loadAdminSubscriptions() {
    try {
        const res = await apiRequest('/api/admin/subscriptions');
        adminSubscriptionsData = res.subscriptions || [];
        adminAclData = res.accessControlList || [];
        renderAdminSubscriptionsUI();
    } catch (err) {
        console.warn('Failed to load subscriptions:', err);
    }
}
window.loadAdminSubscriptions = loadAdminSubscriptions;

function filterAdminSubscriptions(filter) {
    currentSubFilter = filter;
    document.querySelectorAll('.admin-sub-filter-btn').forEach(btn => {
        if (btn.getAttribute('data-filter') === filter) {
            btn.className = 'admin-sub-filter-btn px-3 py-1.5 rounded-lg font-bold bg-indigo-600 text-white shadow-xs';
        } else {
            btn.className = 'admin-sub-filter-btn px-3 py-1.5 rounded-lg font-bold bg-gray-100 hover:bg-gray-200 text-gray-700';
        }
    });
    renderAdminSubscriptionsUI();
}
window.filterAdminSubscriptions = filterAdminSubscriptions;

function formatCountdown(targetIso) {
    if (!targetIso) return { text: 'N/A', isExpired: false, badgeClass: 'bg-gray-100 text-gray-700' };
    const diff = new Date(targetIso).getTime() - Date.now();
    if (diff <= 0) {
        const overDays = Math.floor(Math.abs(diff) / (1000 * 3600 * 24));
        return {
            text: `⚠️ মেয়াদোত্তীর্ণ (Overdue ${overDays > 0 ? by + ' ' + overDays + ' দিন' : ''})`,
            isExpired: true,
            badgeClass: 'bg-red-100 text-red-800 font-black animate-pulse'
        };
    }
    const days = Math.floor(diff / (1000 * 3600 * 24));
    const hours = Math.floor((diff % (1000 * 3600 * 24)) / (1000 * 3600));
    const minutes = Math.floor((diff % (1000 * 3600)) / (1000 * 60));
    return {
        text: `⏳ বাকি: ${days} দিন ${hours} ঘণ্টা ${minutes} মিনিট`,
        isExpired: false,
        badgeClass: days < 1 ? 'bg-amber-100 text-amber-900 font-bold' : 'bg-blue-100 text-blue-900 font-bold'
    };
}

function renderAdminSubscriptionsUI() {
    const db = getAppData();
    const buses = (db && db.buses) ? db.buses : [];
    const container = document.getElementById('adminSubscriptionsList');
    if (!container) return;

    // Collect all unique owners from buses & subscriptions
    const ownersMap = new Map();
    buses.forEach(b => {
        if (b.ownerPhone) {
            if (!ownersMap.has(b.ownerPhone)) {
                ownersMap.set(b.ownerPhone, {
                    phone: b.ownerPhone,
                    name: b.ownerName || 'Operator',
                    company: b.companyName || '',
                    buses: [b.name]
                });
            } else {
                ownersMap.get(b.ownerPhone).buses.push(b.name);
            }
        }
    });

    // Also include any owners from subscriptions that might not have a bus currently
    adminSubscriptionsData.forEach(s => {
        if (!ownersMap.has(s.owner_phone)) {
            ownersMap.set(s.owner_phone, {
                phone: s.owner_phone,
                name: s.owner_name || s.owner_name_db || 'Operator',
                company: s.company_name || '',
                buses: []
            });
        }
    });

    // Compute stats
    let totalDueAmount = 0;
    let pendingCount = 0;
    let suspendedCount = 0;
    let bannedCount = 0;

    adminAclData.forEach(a => {
        if (a.role === 'owner') {
            if (a.status === 'suspended' || a.status === 'blocked') suspendedCount++;
            if (a.status === 'permanently_banned') bannedCount++;
        }
    });

    adminSubscriptionsData.forEach(s => {
        if (s.status === 'pending') {
            totalDueAmount += Number(s.due_amount || 0);
            pendingCount++;
        }
    });

    const activeCount = Math.max(0, ownersMap.size - suspendedCount - bannedCount);

    const totalDueEl = document.getElementById('adminSubTotalDueAmount');
    const pendingCountEl = document.getElementById('adminSubPendingCount');
    const activeCountEl = document.getElementById('adminSubActiveCount');
    const suspCountEl = document.getElementById('adminSubSuspendedCount');
    const banCountEl = document.getElementById('adminSubBannedCount');

    if (totalDueEl) totalDueEl.innerText = `₹${totalDueAmount.toLocaleString('en-IN')}`;
    if (pendingCountEl) {
        const bnP = `${pendingCount} জন মালিকের বাকি`;
        const enP = `${pendingCount} ${pendingCount === 1 ? 'operator' : 'operators'} pending`;
        pendingCountEl.setAttribute('data-bn', bnP);
        pendingCountEl.setAttribute('data-en', enP);
        pendingCountEl.innerText = window.t(bnP, enP);
    }
    if (activeCountEl) activeCountEl.innerText = activeCount;
    if (suspCountEl) suspCountEl.innerText = suspendedCount;
    if (banCountEl) banCountEl.innerText = bannedCount;

    // Update badges
    const badgePending = document.getElementById('badgePendingSubscriptions');
    const badgeSidebar = document.getElementById('badgeSidebarSubscriptions');
    const badgeMob = document.getElementById('badgeMobileSubscriptions');
    if (badgePending) {
        badgePending.innerText = pendingCount;
        badgePending.classList.toggle('hidden', pendingCount === 0);
    }
    if (badgeSidebar) {
        badgeSidebar.innerText = pendingCount;
        badgeSidebar.classList.toggle('hidden', pendingCount === 0);
    }
    if (badgeMob) {
        badgeMob.innerText = pendingCount;
        badgeMob.classList.toggle('hidden', pendingCount === 0);
    }

    // Build unified cards list per owner
    const cards = [];
    ownersMap.forEach((info, phone) => {
        const acl = adminAclData.find(a => a.phone === phone);
        const activeSub = adminSubscriptionsData.find(s => s.owner_phone === phone && s.status === 'pending');
        const pastSubs = adminSubscriptionsData.filter(s => s.owner_phone === phone && s.status !== 'pending');

        const isBanned = Boolean(acl && acl.status === 'permanently_banned');
        const isSuspended = Boolean(acl && (acl.status === 'suspended' || acl.status === 'blocked'));
        const hasDue = Boolean(activeSub);

        // Apply filter
        if (currentSubFilter === 'pending' && !hasDue) return;
        if (currentSubFilter === 'suspended' && !isSuspended) return;
        if (currentSubFilter === 'banned' && !isBanned) return;
        if (currentSubFilter === 'paid' && hasDue) return;

        cards.push({
            phone,
            name: info.name,
            company: info.company,
            buses: info.buses,
            activeSub,
            pastSubs,
            isBanned,
            isSuspended,
            hasDue,
            aclReason: acl?.reason || ''
        });
    });

    if (cards.length === 0) {
        container.innerHTML = `<div class="text-center py-10 bg-white rounded-2xl border text-gray-400 text-xs">${window.t('কোনো অপারেটর সাবস্ক্রিপশন ডাটা পাওয়া যায়নি।', 'No operator subscription records found.')}</div>`;
        return;
    }

    container.innerHTML = cards.map(c => {
        let statusBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">🟢 ' + window.t('সচল ও পরিশোধিত', 'Active & Paid') + '</span>';
        if (c.isBanned) {
            statusBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-900 border border-red-300">⛔ ' + window.t('স্থায়ী নিষিদ্ধ', 'Permanently Banned') + '</span>';
        } else if (c.isSuspended) {
            statusBadge = '<span class="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">🔴 ' + window.t('সাময়িক স্থগিত', 'Suspended') + '</span>';
        } else if (c.hasDue) {
            statusBadge = `<span class="px-2.5 py-1 rounded-full text-xs font-black bg-yellow-100 text-yellow-900 border border-yellow-300">${window.t('🟡 বকেয়া পেন্ডিং', '🟡 Due Pending')}</span>`;
        }

        const countdown = c.activeSub ? formatCountdown(c.activeSub.due_date) : null;

        return `
            <div class="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-200 space-y-3.5 transition hover:shadow-md">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3">
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="font-black text-sm text-gray-900">${escapeHtml(c.name)}</h3>
                            <span class="text-xs font-mono font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">📞 ${escapeHtml(c.phone)}</span>
                            ${c.company ? `<span class="text-xs text-indigo-700 font-bold">• ${escapeHtml(c.company)}</span>` : ''}
                        </div>
                        <p class="text-[11px] text-gray-500 mt-0.5">বাস সংখ্যা: ${c.buses.length}টি ${c.buses.length > 0 ? `(${escapeHtml(c.buses.join(', '))})` : ''}</p>
                    </div>
                    <div>
                        ${statusBadge}
                    </div>
                </div>

                ${c.hasDue ? `
                    <div class="bg-gradient-to-r from-amber-50 to-orange-50/50 p-3.5 rounded-xl border border-amber-200 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div class="space-y-1">
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-amber-950">বকেয়া অ্যামাউন্ট:</span>
                                <span class="text-base font-black text-red-600">₹${Number(c.activeSub.due_amount).toLocaleString('en-IN')}</span>
                                <span class="bg-amber-200 text-amber-900 px-2 py-0.5 rounded text-[10px] font-bold uppercase">${escapeHtml(c.activeSub.plan_type)}</span>
                            </div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="px-2 py-0.5 rounded text-[11px] ${countdown.badgeClass}">${countdown.text}</span>
                                <span class="text-gray-500 font-mono text-[10px]">ডেডলাইন: ${new Date(c.activeSub.due_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            </div>
                            ${c.activeSub.note ? `<p class="text-gray-600 italic text-[11px]">নোট: "${escapeHtml(c.activeSub.note)}"</p>` : ''}
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                            <button type="button" onclick="clearOwnerSubscriptionDue('${escapeHtml(c.activeSub.id)}', '${escapeHtml(c.phone)}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl font-bold shadow-xs transition flex items-center gap-1">
                                <span>🧹</span> <span>Clear Due (বকেয়া পরিশোধ)</span>
                            </button>
                            <button type="button" onclick="deleteAdminSubscription('${escapeHtml(c.activeSub.id)}')" class="p-1.5 bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-lg transition" title="Delete Bill">🗑️</button>
                        </div>
                    </div>
                ` : `
                    <div class="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs flex justify-between items-center text-gray-500">
                        <span>বর্তমানে কোনো বকেয়া সাবস্ক্রিপশন চার্জ নেই।</span>
                        <button type="button" onclick="openDirectIssueBillModal('${escapeHtml(c.phone)}', '${escapeHtml(c.name)}')" class="text-indigo-600 hover:text-indigo-800 font-bold hover:underline">
                            + নতুন চার্জ নির্ধারণ করুন
                        </button>
                    </div>
                `}

                <!-- Administrative Control Actions Bar -->
                <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t text-xs">
                    <div class="text-[11px] text-gray-500">
                        ${c.aclReason ? `<span class="text-amber-800 font-medium">কারণ: ${escapeHtml(c.aclReason)}</span>` : ''}
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        ${c.isSuspended ? `
                            <button type="button" onclick="toggleOperatorAccess('${escapeHtml(c.phone)}', 'owner', 'unblock')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1">
                                <span>🟢</span> <span>Unblock / Activate (সচল করুন)</span>
                            </button>
                        ` : `
                            <button type="button" onclick="toggleOperatorAccess('${escapeHtml(c.phone)}', 'owner', 'suspend')" class="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1">
                                <span>🛑</span> <span>Suspend / Block (স্থগিত)</span>
                            </button>
                        `}

                        ${c.isBanned ? `
                            <button type="button" onclick="toggleOperatorAccess('${escapeHtml(c.phone)}', 'owner', 'reactivate')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1">
                                <span>🔄</span> <span>Reactivate (নিষিদ্ধ প্রত্যাহার)</span>
                            </button>
                        ` : `
                            <button type="button" onclick="toggleOperatorAccess('${escapeHtml(c.phone)}', 'owner', 'ban')" class="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1" title="Permanently ban this mobile number and linked captains">
                                <span>⛔</span> <span>Permanent Ban (স্থায়ী ব্যান)</span>
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Timer tick every 30s to update countdown in Admin UI
if (!subTimerInterval && typeof window !== 'undefined') {
    subTimerInterval = setInterval(() => {
        const subTab = document.getElementById('tabSubscriptionsContent');
        if (subTab && !subTab.classList.contains('hidden')) {
            renderAdminSubscriptionsUI();
        }
    }, 30000);
}

function openIssueSubscriptionBillModal() {
    const modal = document.getElementById('adminIssueBillModal');
    if (!modal) return;
    const db = getAppData();
    const buses = (db && db.buses) ? db.buses : [];
    const select = document.getElementById('billOwnerSelect');
    
    if (select) {
        select.innerHTML = '<option value="">-- বাস মালিক নির্বাচন করুন --</option>';
        const seen = new Set();
        buses.forEach(b => {
            if (b.ownerPhone && !seen.has(b.ownerPhone)) {
                seen.add(b.ownerPhone);
                const opt = document.createElement('option');
                opt.value = b.ownerPhone;
                opt.textContent = `${b.ownerName || 'Operator'} (${b.ownerPhone}) - ${b.companyName || b.name}`;
                opt.setAttribute('data-name', b.ownerName || '');
                select.appendChild(opt);
            }
        });
    }

    // Default due date to 3 days from now
    const d = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    const dateInput = document.getElementById('billDueDate');
    if (dateInput) {
        const pad = n => String(n).padStart(2, '0');
        dateInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    modal.classList.remove('hidden');
}
window.openIssueSubscriptionBillModal = openIssueSubscriptionBillModal;

function openDirectIssueBillModal(phone, name) {
    openIssueSubscriptionBillModal();
    const sel = document.getElementById('billOwnerSelect');
    if (sel) {
        sel.value = phone;
    }
}
window.openDirectIssueBillModal = openDirectIssueBillModal;

function closeIssueSubscriptionBillModal() {
    const modal = document.getElementById('adminIssueBillModal');
    if (modal) modal.classList.add('hidden');
}
window.closeIssueSubscriptionBillModal = closeIssueSubscriptionBillModal;

function setBillQuickAmount(amt) {
    const input = document.getElementById('billDueAmount');
    if (input) input.value = amt;
}
window.setBillQuickAmount = setBillQuickAmount;

function onBillOwnerSelected() {
    // Helper hook
}
window.onBillOwnerSelected = onBillOwnerSelected;

async function submitAdminSubscriptionBill(e) {
    e.preventDefault();
    const sel = document.getElementById('billOwnerSelect');
    const ownerPhone = sel ? sel.value : '';
    const ownerName = sel?.selectedOptions[0]?.getAttribute('data-name') || '';
    const planType = document.getElementById('billPlanType')?.value || 'monthly';
    const dueAmount = Number(document.getElementById('billDueAmount')?.value || 0);
    const dueDate = document.getElementById('billDueDate')?.value || '';
    const note = document.getElementById('billNote')?.value || '';
    const paymentUpi = document.getElementById('billPaymentUpi')?.value || 'support.busyatra@gmail.com';

    if (!ownerPhone) {
        alert('অনুগ্রহ করে একজন বাস মালিক নির্বাচন করুন।');
        return;
    }
    if (dueAmount <= 0) {
        alert('সঠিক টাকার পরিমাণ দিন।');
        return;
    }
    if (!dueDate) {
        alert('পরিশোধের শেষ সময় নির্বাচন করুন।');
        return;
    }

    const btn = document.getElementById('submitBillBtn');
    if (btn) btn.disabled = true;

    try {
        await apiRequest('/api/admin/subscriptions', {
            method: 'POST',
            body: JSON.stringify({
                owner_phone: ownerPhone,
                owner_name: ownerName,
                plan_type: planType,
                due_amount: dueAmount,
                due_date: new Date(dueDate).toISOString(),
                note,
                payment_upi: paymentUpi
            })
        });

        alert(`🎉 বাস মালিকের কাছে ₹${dueAmount} টাকার সাবস্ক্রিপশন চার্জ বিল সফলভাবে পাঠানো হয়েছে!`);
        closeIssueSubscriptionBillModal();
        await loadAdminSubscriptions();
    } catch (err) {
        alert('বিল পাঠাতে সমস্যা হয়েছে: ' + err.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}
window.submitAdminSubscriptionBill = submitAdminSubscriptionBill;

async function clearOwnerSubscriptionDue(subId, ownerPhone) {
    const ok = await showBusYatraConfirm({ title: "বকেয়া ক্লিয়ার নিশ্চিতকরণ", subtitle: "আপনি কি এই মালিকের বকেয়া ক্লিয়ার করতে চান? বকেয়া ক্লিয়ার করলে ওনার প্যানেল থেকে ডিউ নোটিশ সরে যাবে এবং অ্যাকাউন্ট স্বাভাবিক হবে।", icon: "💳", confirmText: "হ্যাঁ, ক্লিয়ার করুন", cancelText: "বাতিল", danger: false }); if (!ok) return;
    try {
        await apiRequest('/api/admin/subscriptions/clear', {
            method: 'POST',
            body: JSON.stringify({ id: subId, owner_phone: ownerPhone, clear_suspension: true })
        });
        alert('বকেয়া সফলভাবে ক্লিয়ার করা হয়েছে!');
        await loadAdminSubscriptions();
    } catch (err) {
        alert('ত্রুটি: ' + err.message);
    }
}
window.clearOwnerSubscriptionDue = clearOwnerSubscriptionDue;

async function toggleOperatorAccess(phone, role, action) {
    let confirmMsg = '';
    if (action === 'suspend') {
        confirmMsg = window.t(`আপনি কি নিশ্চিতভাবে এই বাস মালিক (${phone}) এবং তার সংশ্লিষ্ট সব ক্যাপ্টেনকে সাময়িকভাবে স্থগিত করতে চান?\n\nস্থগিত করলে তারা প্যানেল বা বাসের কার্যক্রম চালাতে পারবে না।`, `Are you sure you want to temporarily suspend Bus Owner (${phone}) and associated captains?\n\nThey will not be able to manage buses while suspended.`);
    } else if (action === 'unblock' || action === 'activate') {
        confirmMsg = window.t(`আপনি কি এই বাস মালিক (${phone}) এবং তার ক্যাপ্টেনদের পুনরায় সচল করতে চান?`, `Do you want to reactivate Bus Owner (${phone}) and associated captains?`);
    } else if (action === 'ban') {
        confirmMsg = window.t(`⚠️ সাবধান! আপনি কি নিশ্চিতভাবে এই মোবাইল নম্বর (${phone}) এবং সংশ্লিষ্ট ক্যাপ্টেনকে স্থায়ীভাবে নিষিদ্ধ করতে চান?\n\nব্যান করলে তারা ভবিষ্যতে আর কখনোই এই নম্বরে অ্যাপ বা প্যানেলে ঢুকতে বা রেজিস্টার করতে পারবে না।`, `⚠️ Warning! Are you sure you want to permanently ban mobile number (${phone}) and associated captains?\n\nThey will never be able to register or login again.`);
    } else if (action === 'reactivate') {
        confirmMsg = window.t(`আপনি কি এই নিষিদ্ধ নম্বর (${phone}) এর উপর থেকে ব্যান প্রত্যাহার করে পুনরায় সচল করতে চান?`, `Do you want to revoke the ban on (${phone}) and reactivate access?`);
    }

    const ok = await showBusYatraConfirm({ title: "অপারেটর অ্যাক্সেস পরিবর্তন", subtitle: confirmMsg, icon: "🛡️", confirmText: "হ্যাঁ, নিশ্চিত করুন", cancelText: "বাতিল", danger: true }); if (!ok) return;

    let reason = '';
    if (action === 'suspend') {
        reason = prompt('স্থগিত করার কারণ লিখুন:', 'বকেয়া সাবস্ক্রিপশন ফি পরিশোধ না করায় সাময়িক স্থগিত।') || 'বকেয়া সাবস্ক্রিপশন ফি অপরিশোধিত';
    } else if (action === 'ban') {
        reason = prompt('স্থায়ী ব্যান করার কারণ লিখুন:', 'নিয়ম লঙ্ঘন বা অ্যাডমিন কর্তৃক ব্লকলিস্টেড।') || 'অ্যাডমিন কর্তৃক স্থায়ী নিষিদ্ধ';
    }

    try {
        const res = await apiRequest('/api/admin/access/toggle', {
            method: 'POST',
            body: JSON.stringify({ phone, role, action, reason })
        });
        alert(res.message || 'অ্যাকশন সফলভাবে কার্যকর হয়েছে!');
        await loadAdminSubscriptions();
    } catch (err) {
        alert('সমস্যা হয়েছে: ' + err.message);
    }
}
window.toggleOperatorAccess = toggleOperatorAccess;

async function deleteAdminSubscription(subId) {
    const ok = await showBusYatraConfirm({ title: "সাবস্ক্রিপশন রেকর্ড ডিলিট", subtitle: "আপনি কি এই সাবস্ক্রিপশন রেকর্ডটি মুছে ফেলতে চান?", icon: "🗑️", confirmText: "হ্যাঁ, মুছে ফেলুন", cancelText: "বাতিল", danger: true }); if (!ok) return;
    try {
        await apiRequest(`/api/admin/subscriptions?id=${encodeURIComponent(subId)}`, {
            method: 'DELETE'
        });
        await loadAdminSubscriptions();
    } catch (err) {
        alert('ডিলিট করতে সমস্যা হয়েছে: ' + err.message);
    }
}
window.deleteAdminSubscription = deleteAdminSubscription;

// =========================================================================
// Universal Fraud, Suspension & Moderation Handler
// =========================================================================
async function adminToggleUserAccess(phone, role, action) {
    let reason = '';
    if (action === 'suspend') {
        reason = prompt(`সাসপেন্ড করার কারণ লিখুন (${role.toUpperCase()} ${phone}):`, 'নিয়ম লঙ্ঘন বা সন্দেহজনক কার্যকলাপের কারণে স্থগিত।');
        if (reason === null) return;
    } else if (action === 'ban') {
        const okBan = await showBusYatraConfirm({ title: "স্থায়ী ব্যান সতর্কতা", subtitle: `আপনি কি নিশ্চিত যে ${role.toUpperCase()} নম্বর ${phone} চিরতরে স্থায়ী ব্যান করতে চান?`, icon: "🚫", confirmText: "হ্যাঁ, স্থায়ী ব্যান করুন", cancelText: "বাতিল", danger: true }); if (!okBan) return;
        reason = prompt(window.t('স্থায়ী ব্যান করার কারণ:', 'Reason for permanent ban:'), window.t('অ্যাডমিন কর্তৃক স্থায়ীভাবে নিষিদ্ধ', 'Permanently banned by admin'));
        if (reason === null) return;
    } else if (action === 'activate') {
        const okRe = await showBusYatraConfirm({ title: "পুনরায় সক্রিয়করণ", subtitle: `মোবাইল নম্বর ${phone} (${role.toUpperCase()}) পুনরায় সক্রিয় (Re-activate) করতে চান?`, icon: "✅", confirmText: "হ্যাঁ, সক্রিয় করুন", cancelText: "বাতিল", danger: false }); if (!okRe) return;
    }

    try {
        const res = await apiRequest('/api/admin/access/toggle', {
            method: 'POST',
            body: JSON.stringify({ phone, role, action, reason })
        });
        alert(`✅ ${res.message || 'অ্যাকশন সফল হয়েছে।'}`);
        await Promise.allSettled([
            loadAdminCustomersData(),
            loadAdminOwnersData(),
            loadAdminCaptainsData(),
            loadAdminNextGenData()
        ]);
    } catch (err) {
        alert(`অ্যাকশন ব্যর্থ হয়েছে: ${err.message}`);
    }
}
window.adminToggleUserAccess = adminToggleUserAccess;

function openAdminCustomerFeaturesModal(phone) {
    switchAdminTab('nextgen');
    switchNextgenSubtab('customer');
    const select = document.getElementById('nextgenCustomerSelect');
    if (select) {
        select.value = phone;
        onNextgenCustomerSelected();
    }
}
window.openAdminCustomerFeaturesModal = openAdminCustomerFeaturesModal;

function openAdminOwnerFeaturesNextGen(phone) {
    switchAdminTab('nextgen');
    switchNextgenSubtab('owner');
    const select = document.getElementById('nextgenOwnerSelect');
    if (select) {
        select.value = phone;
        onNextgenOwnerSelected();
    }
}
window.openAdminOwnerFeaturesNextGen = openAdminOwnerFeaturesNextGen;

// =========================================================================
// Next-Gen Features & Permissions Control System
// =========================================================================
let adminSelectedNextgenOwner = null;
let adminSelectedNextgenCustomer = null;

function switchNextgenSubtab(tab) {
    const ownerBtn = document.getElementById('nextgenSubtabOwnerBtn');
    const custBtn = document.getElementById('nextgenSubtabCustomerBtn');
    const captBtn = document.getElementById('nextgenSubtabCaptainBtn');
    const expBtn = document.getElementById('nextgenSubtabExpansionBtn');
    const ownerPanel = document.getElementById('nextgenOwnerPanel');
    const custPanel = document.getElementById('nextgenCustomerPanel');
    const captPanel = document.getElementById('nextgenCaptainPanel');
    const expPanel = document.getElementById('nextgenExpansionPanel');

    const activeCls = "py-2.5 px-4 font-bold text-xs border-b-2 border-purple-600 text-purple-700 flex items-center gap-2 whitespace-nowrap";
    const inactiveCls = "py-2.5 px-4 font-bold text-xs border-b-2 border-transparent text-gray-500 hover:text-gray-900 flex items-center gap-2 whitespace-nowrap";

    if (ownerBtn) ownerBtn.className = tab === 'owner' ? activeCls : inactiveCls;
    if (custBtn) custBtn.className = tab === 'customer' ? activeCls : inactiveCls;
    if (captBtn) captBtn.className = tab === 'captain' ? activeCls : inactiveCls;
    if (expBtn) expBtn.className = tab === 'expansion' ? activeCls : inactiveCls;

    if (ownerPanel) ownerPanel.classList.toggle('hidden', tab !== 'owner');
    if (custPanel) custPanel.classList.toggle('hidden', tab !== 'customer');
    if (captPanel) captPanel.classList.toggle('hidden', tab !== 'captain');
    if (expPanel) expPanel.classList.toggle('hidden', tab !== 'expansion');

    if (tab === 'expansion') {
        renderAdminExpansionSettings();
    }
}
window.switchNextgenSubtab = switchNextgenSubtab;

async function loadAdminNextGenData() {
    const ownerSelect = document.getElementById('nextgenOwnerSelect');
    const custSelect = document.getElementById('nextgenCustomerSelect');
    const captSelect = document.getElementById('nextgenCaptainSelect');

    // Ensure owners, customers, and captains are loaded
    if (!adminOwnersData || adminOwnersData.length === 0) {
        try { await loadAdminOwnersData(); } catch (_) {}
    }
    if (!adminRegisteredCustomers || adminRegisteredCustomers.length === 0) {
        try { await loadAdminCustomersData(); } catch (_) {}
    }
    if (!adminCaptainsData || adminCaptainsData.length === 0) {
        try { await loadAdminCaptainsData(); } catch (_) {}
    }

    // Populate owners
    if (ownerSelect) {
        const curOwner = ownerSelect.value;
        const owners = adminOwnersData || [];
        if (owners.length > 0) {
            ownerSelect.innerHTML = owners.map(o => `
                <option value="${escapeHtml(o.phone)}">${escapeHtml(o.company_name || o.name || 'Owner')} (${escapeHtml(o.phone)}) - Status: ${o.status || 'active'}</option>
            `).join('');
            if (curOwner && owners.some(o => o.phone === curOwner)) {
                ownerSelect.value = curOwner;
            }
            onNextgenOwnerSelected();
        } else {
            ownerSelect.innerHTML = '<option value="">কোনও বাস মালিক পাওয়া যায়নি</option>';
        }
    }

    // Populate customers
    if (custSelect) {
        const curCust = custSelect.value;
        let custOpts = '<option value="GLOBAL">' + window.t('🌐 সমস্ত যাত্রীদের জন্য গ্লোবাল ডিফল্ট', '🌐 Global Default for All Passengers') + '</option>';
        if (adminRegisteredCustomers && adminRegisteredCustomers.length > 0) {
            custOpts += adminRegisteredCustomers.map(c => `
                <option value="${escapeHtml(c.phone)}">👤 ${escapeHtml(c.name || 'Customer')} (${escapeHtml(c.phone)}) - Status: ${c.status || 'active'}</option>
            `).join('');
        }
        custSelect.innerHTML = custOpts;
        if (curCust) custSelect.value = curCust;
        onNextgenCustomerSelected();
    }

    // Populate captains
    if (captSelect) {
        const curCapt = captSelect.value;
        let captOpts = '<option value="GLOBAL">' + window.t('🌐 সমস্ত ক্যাপ্টেনদের জন্য গ্লোবাল ডিফল্ট', '🌐 Global Default for All Captains') + '</option>';
        if (adminCaptainsData && adminCaptainsData.length > 0) {
            captOpts += adminCaptainsData.map(c => `
                <option value="${escapeHtml(c.phone)}">👨‍✈️ ${escapeHtml(c.name || 'Captain')} (${escapeHtml(c.phone)}) - বাস: ${escapeHtml(c.bus_name || '')} (${escapeHtml(c.bus_number || '')})</option>
            `).join('');
        }
        captSelect.innerHTML = captOpts;
        if (curCapt) captSelect.value = curCapt;
        onNextgenCaptainSelected();
    }

    renderAdminExpansionSettings();
}
window.loadAdminNextGenData = loadAdminNextGenData;

function onNextgenOwnerSelected() {
    const select = document.getElementById('nextgenOwnerSelect');
    const badge = document.getElementById('nextgenOwnerStatusBadge');
    if (!select || !select.value) return;

    const phone = select.value;
    const owner = (adminOwnersData || []).find(o => o.phone === phone);
    if (!owner) return;
    adminSelectedNextgenOwner = owner;

    if (badge) {
        if (owner.status === 'suspended') {
            badge.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-1 border border-amber-300";
            badge.innerHTML = window.t('⚠️ স্থগিত', '⚠️ Suspended');
        } else if (owner.status === 'banned' || owner.status === 'permanently_banned') {
            badge.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-red-100 text-red-800 inline-flex items-center gap-1 border border-red-300";
            badge.innerHTML = window.t('⛔ স্থায়ী ব্যান', '⛔ Banned');
        } else {
            badge.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-green-100 text-green-800 inline-flex items-center gap-1 border border-green-300";
            badge.innerHTML = window.t('🟢 সচল', '🟢 Active');
        }
    }

    const f = owner.features || {};
    const setCheck = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = val === true;
    };

    setCheck('nextgenOwner_finance', f.finance);
    setCheck('nextgenOwner_captains', f.captains);
    setCheck('nextgenOwner_live_tracking', f.live_tracking);
    setCheck('nextgenOwner_notifications', f.notifications);
    setCheck('nextgenOwner_edit_bus', f.edit_bus);
    setCheck('nextgenOwner_auto_pilot', f.auto_pilot);
    setCheck('nextgenOwner_parcel_booking', f.parcel_booking);
    setCheck('nextgenOwner_monthly_pass', f.monthly_pass);
    setCheck('nextgenOwner_dynamic_ai_pricing', f.dynamic_ai_pricing);
    setCheck('nextgenOwner_instant_payout', f.instant_payout);
    setCheck('nextgenOwner_cargo_tracking', f.cargo_tracking);
    setCheck('nextgenOwner_driver_safety_score', f.driver_safety_score);
}
window.onNextgenOwnerSelected = onNextgenOwnerSelected;

async function saveAdminSelectedOwnerFeatures() {
    const select = document.getElementById('nextgenOwnerSelect');
    if (!select || !select.value) return;
    const phone = select.value;

    const features = {
        finance: document.getElementById('nextgenOwner_finance')?.checked ?? true,
        captains: document.getElementById('nextgenOwner_captains')?.checked ?? true,
        live_tracking: document.getElementById('nextgenOwner_live_tracking')?.checked ?? true,
        notifications: document.getElementById('nextgenOwner_notifications')?.checked ?? true,
        edit_bus: document.getElementById('nextgenOwner_edit_bus')?.checked ?? true,
        auto_pilot: document.getElementById('nextgenOwner_auto_pilot')?.checked ?? true,
        parcel_booking: document.getElementById('nextgenOwner_parcel_booking')?.checked ?? true,
        monthly_pass: document.getElementById('nextgenOwner_monthly_pass')?.checked ?? true,
        dynamic_ai_pricing: document.getElementById('nextgenOwner_dynamic_ai_pricing')?.checked ?? true,
        instant_payout: document.getElementById('nextgenOwner_instant_payout')?.checked ?? true,
        cargo_tracking: document.getElementById('nextgenOwner_cargo_tracking')?.checked ?? true,
        driver_safety_score: document.getElementById('nextgenOwner_driver_safety_score')?.checked ?? true
    };

    try {
        await apiRequest('/api/admin/owners/features', {
            method: 'POST',
            body: JSON.stringify({ phone, features })
        });
        alert(`✅ বাস মালিক ${phone}-এর জন্য নেক্সট-জেন ফিচার পারমিশন সফলভাবে আপডেট হয়েছে!`);
        await loadAdminOwnersData();
        await loadAdminNextGenData();
    } catch (err) {
        alert(`ফিচার সেভ করতে সমস্যা হয়েছে: ${err.message}`);
    }
}
window.saveAdminSelectedOwnerFeatures = saveAdminSelectedOwnerFeatures;

async function applyFeaturesToAllOwners() {
    const ok = await showBusYatraConfirm({ title: "গ্লোবাল ফিচার আপডেট", subtitle: "আপনি কি নিশ্চিত যে এই ফিচার সেটিংস সমস্ত বাস মালিকদের ক্ষেত্রে একসাথে প্রযোজ্য করতে চান?", icon: "👑", confirmText: "হ্যাঁ, সবার জন্য প্রযোজ্য করুন", cancelText: "বাতিল", danger: false }); if (!ok) return;
    const features = {
        finance: document.getElementById('nextgenOwner_finance')?.checked ?? true,
        captains: document.getElementById('nextgenOwner_captains')?.checked ?? true,
        live_tracking: document.getElementById('nextgenOwner_live_tracking')?.checked ?? true,
        notifications: document.getElementById('nextgenOwner_notifications')?.checked ?? true,
        edit_bus: document.getElementById('nextgenOwner_edit_bus')?.checked ?? true,
        auto_pilot: document.getElementById('nextgenOwner_auto_pilot')?.checked ?? true,
        parcel_booking: document.getElementById('nextgenOwner_parcel_booking')?.checked ?? true,
        monthly_pass: document.getElementById('nextgenOwner_monthly_pass')?.checked ?? true,
        dynamic_ai_pricing: document.getElementById('nextgenOwner_dynamic_ai_pricing')?.checked ?? true,
        instant_payout: document.getElementById('nextgenOwner_instant_payout')?.checked ?? true,
        cargo_tracking: document.getElementById('nextgenOwner_cargo_tracking')?.checked ?? true,
        driver_safety_score: document.getElementById('nextgenOwner_driver_safety_score')?.checked ?? true
    };

    try {
        await apiRequest('/api/admin/features/bulk', {
            method: 'POST',
            body: JSON.stringify({ target: 'owners', features })
        });
        alert('✅ সমস্ত বাস মালিকদের জন্য নেক্সট-জেন ফিচার সেটিংস সফলভাবে আপডেট হয়েছে!');
        await loadAdminOwnersData();
        await loadAdminNextGenData();
    } catch (err) {
        alert(`আপডেট করতে সমস্যা হয়েছে: ${err.message}`);
    }
}
window.applyFeaturesToAllOwners = applyFeaturesToAllOwners;

function onNextgenCustomerSelected() {
    const select = document.getElementById('nextgenCustomerSelect');
    const badge = document.getElementById('nextgenCustomerStatusBadge');
    if (!select) return;

    const val = select.value;
    const setCheck = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = val === true;
    };

    if (val === 'GLOBAL') {
        if (badge) {
            badge.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-100 text-purple-800 inline-flex items-center gap-1 border border-purple-300";
            badge.innerHTML = window.t('🌐 গ্লোবাল সেটিংস', '🌐 Global Settings (All Customers)');
        }
        ['offline_tickets', 'referral_rewards', 'voice_search', 'parcel_booking', 'meal_preorder', 'women_safety', 'whatsapp_booking', 'bluetooth_offline', 'ncmc_smart_card', 'agent_portal', 'bengali_stop_announcer', 'flash_sale_pricing', 'smart_boarding_countdown', 'dropoff_wakeup_alarm'].forEach(f => {
            const el = document.getElementById(`nextgenCust_${f}`);
            if (el) el.checked = false;
        });
        return;
    }

    const customer = (adminRegisteredCustomers || []).find(c => c.phone === val);
    if (!customer) return;

    if (badge) {
        if (customer.status === 'suspended') {
            badge.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-1 border border-amber-300";
            badge.innerHTML = window.t('⚠️ স্থগিত', '⚠️ Suspended');
        } else if (customer.status === 'banned' || customer.status === 'permanently_banned') {
            badge.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-red-100 text-red-800 inline-flex items-center gap-1 border border-red-300";
            badge.innerHTML = window.t('⛔ স্থায়ী ব্যান', '⛔ Banned');
        } else {
            badge.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-green-100 text-green-800 inline-flex items-center gap-1 border border-green-300";
            badge.innerHTML = window.t('🟢 সচল', '🟢 Active');
        }
    }

    const f = customer.features || {};
    setCheck('nextgenCust_offline_tickets', f.offline_tickets);
    setCheck('nextgenCust_referral_rewards', f.referral_rewards);
    setCheck('nextgenCust_voice_search', f.voice_search);
    setCheck('nextgenCust_parcel_booking', f.parcel_booking);
    setCheck('nextgenCust_meal_preorder', f.meal_preorder);
    setCheck('nextgenCust_women_safety', f.women_safety);
    setCheck('nextgenCust_whatsapp_booking', f.whatsapp_booking);
    setCheck('nextgenCust_bluetooth_offline', f.bluetooth_offline);
    setCheck('nextgenCust_ncmc_smart_card', f.ncmc_smart_card);
    setCheck('nextgenCust_agent_portal', f.agent_portal);
    setCheck('nextgenCust_bengali_stop_announcer', f.bengali_stop_announcer);
    setCheck('nextgenCust_flash_sale_pricing', f.flash_sale_pricing);
    setCheck('nextgenCust_smart_boarding_countdown', f.smart_boarding_countdown);
    setCheck('nextgenCust_dropoff_wakeup_alarm', f.dropoff_wakeup_alarm);
}
window.onNextgenCustomerSelected = onNextgenCustomerSelected;

async function saveAdminSelectedCustomerFeatures() {
    const select = document.getElementById('nextgenCustomerSelect');
    if (!select || !select.value) return;
    const phone = select.value;

    const features = {
        offline_tickets: Boolean(document.getElementById('nextgenCust_offline_tickets')?.checked),
        referral_rewards: Boolean(document.getElementById('nextgenCust_referral_rewards')?.checked),
        voice_search: Boolean(document.getElementById('nextgenCust_voice_search')?.checked),
        parcel_booking: Boolean(document.getElementById('nextgenCust_parcel_booking')?.checked),
        meal_preorder: Boolean(document.getElementById('nextgenCust_meal_preorder')?.checked),
        women_safety: Boolean(document.getElementById('nextgenCust_women_safety')?.checked),
        whatsapp_booking: Boolean(document.getElementById('nextgenCust_whatsapp_booking')?.checked),
        bluetooth_offline: Boolean(document.getElementById('nextgenCust_bluetooth_offline')?.checked),
        ncmc_smart_card: Boolean(document.getElementById('nextgenCust_ncmc_smart_card')?.checked),
        agent_portal: Boolean(document.getElementById('nextgenCust_agent_portal')?.checked),
        bengali_stop_announcer: Boolean(document.getElementById('nextgenCust_bengali_stop_announcer')?.checked),
        flash_sale_pricing: Boolean(document.getElementById('nextgenCust_flash_sale_pricing')?.checked),
        smart_boarding_countdown: Boolean(document.getElementById('nextgenCust_smart_boarding_countdown')?.checked),
        dropoff_wakeup_alarm: Boolean(document.getElementById('nextgenCust_dropoff_wakeup_alarm')?.checked)
    };

    if (phone === 'GLOBAL') {
        return applyFeaturesToAllCustomers();
    }

    try {
        await apiRequest('/api/admin/customers/features', {
            method: 'POST',
            body: JSON.stringify({ phone, features })
        });
        alert(`✅ কাস্টমার ${phone}-এর জন্য নেক্সট-জেন ফিচার পারমিশন সফলভাবে আপডেট হয়েছে!`);
        await loadAdminCustomersData();
        await loadAdminNextGenData();
    } catch (err) {
        alert(`ফিচার সেভ করতে সমস্যা হয়েছে: ${err.message}`);
    }
}
window.saveAdminSelectedCustomerFeatures = saveAdminSelectedCustomerFeatures;

async function applyFeaturesToAllCustomers() {
    const ok = await showBusYatraConfirm({ title: "গ্লোবাল ফিচার আপডেট", subtitle: "আপনি কি নিশ্চিত যে এই ফিচার সেটিংস সমস্ত কাস্টমারদের ক্ষেত্রে গ্লোবালি আপডেট করতে চান?", icon: "👥", confirmText: "হ্যাঁ, গ্লোবালি আপডেট করুন", cancelText: "বাতিল", danger: false }); if (!ok) return;
    const features = {
        offline_tickets: Boolean(document.getElementById('nextgenCust_offline_tickets')?.checked),
        referral_rewards: Boolean(document.getElementById('nextgenCust_referral_rewards')?.checked),
        voice_search: Boolean(document.getElementById('nextgenCust_voice_search')?.checked),
        parcel_booking: Boolean(document.getElementById('nextgenCust_parcel_booking')?.checked),
        meal_preorder: Boolean(document.getElementById('nextgenCust_meal_preorder')?.checked),
        women_safety: Boolean(document.getElementById('nextgenCust_women_safety')?.checked),
        whatsapp_booking: Boolean(document.getElementById('nextgenCust_whatsapp_booking')?.checked),
        bluetooth_offline: Boolean(document.getElementById('nextgenCust_bluetooth_offline')?.checked),
        ncmc_smart_card: Boolean(document.getElementById('nextgenCust_ncmc_smart_card')?.checked),
        agent_portal: Boolean(document.getElementById('nextgenCust_agent_portal')?.checked),
        bengali_stop_announcer: Boolean(document.getElementById('nextgenCust_bengali_stop_announcer')?.checked),
        flash_sale_pricing: Boolean(document.getElementById('nextgenCust_flash_sale_pricing')?.checked),
        smart_boarding_countdown: Boolean(document.getElementById('nextgenCust_smart_boarding_countdown')?.checked),
        dropoff_wakeup_alarm: Boolean(document.getElementById('nextgenCust_dropoff_wakeup_alarm')?.checked)
    };

    try {
        localStorage.setItem('busyatra_global_nextgen_features', JSON.stringify(features));
        if (window.appData && window.appData.featureFlags) {
            window.appData.featureFlags = { ...window.appData.featureFlags, ...features };
        }
        await apiRequest('/api/admin/features/bulk', {
            method: 'POST',
            body: JSON.stringify({ target: 'customers', features })
        });
        alert('✅ সমস্ত কাস্টমারদের জন্য নেক্সট-জেন ফিচার সেটিংস সফলভাবে আপডেট হয়েছে!');
        await loadAdminCustomersData();
        await loadAdminNextGenData();
    } catch (err) {
        alert(`আপডেট করতে সমস্যা হয়েছে: ${err.message}`);
    }
}
window.applyFeaturesToAllCustomers = applyFeaturesToAllCustomers;

// --- Captain Next-Gen Feature Controls ---
function onNextgenCaptainSelected() {
    const select = document.getElementById('nextgenCaptainSelect');
    const badge = document.getElementById('nextgenCaptainStatusBadge');
    if (!select) return;

    const val = select.value;
    const setCheck = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = val === true;
    };

    if (val === 'GLOBAL') {
        if (badge) {
            badge.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-100 text-purple-800 inline-flex items-center gap-1 border border-purple-300";
            badge.innerHTML = window.t('🌐 গ্লোবাল সেটিংস', '🌐 Global Settings (All Captains)');
        }
        ['qr_scanner', 'offline_validation', 'cash_collection', 'gps_broadcast', 'passenger_manifest', 'driver_safety_alerts', 'bengali_stop_announcer'].forEach(f => {
            const el = document.getElementById(`nextgenCapt_${f}`);
            if (el) el.checked = true;
        });
        return;
    }

    const captain = (adminCaptainsData || []).find(c => c.phone === val);
    if (!captain) return;
    adminSelectedNextgenCaptain = captain;

    if (badge) {
        if (captain.status === 'suspended') {
            badge.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-1 border border-amber-300";
            badge.innerHTML = window.t('⚠️ স্থগিত', '⚠️ Suspended');
        } else if (captain.status === 'banned' || captain.status === 'permanently_banned') {
            badge.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-red-100 text-red-800 inline-flex items-center gap-1 border border-red-300";
            badge.innerHTML = window.t('⛔ স্থায়ী ব্যান', '⛔ Banned');
        } else {
            badge.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-green-100 text-green-800 inline-flex items-center gap-1 border border-green-300";
            badge.innerHTML = window.t('🟢 সচল', '🟢 Active');
        }
    }

    const f = captain.features || {};
    setCheck('nextgenCapt_qr_scanner', f.qr_scanner);
    setCheck('nextgenCapt_offline_validation', f.offline_validation);
    setCheck('nextgenCapt_cash_collection', f.cash_collection);
    setCheck('nextgenCapt_gps_broadcast', f.gps_broadcast);
    setCheck('nextgenCapt_passenger_manifest', f.passenger_manifest);
    setCheck('nextgenCapt_driver_safety_alerts', f.driver_safety_alerts);
    setCheck('nextgenCapt_bengali_stop_announcer', f.bengali_stop_announcer);
}
window.onNextgenCaptainSelected = onNextgenCaptainSelected;

async function saveAdminSelectedCaptainFeatures() {
    const select = document.getElementById('nextgenCaptainSelect');
    if (!select || !select.value) return;
    const phone = select.value;

    const features = {
        qr_scanner: document.getElementById('nextgenCapt_qr_scanner')?.checked ?? true,
        offline_validation: document.getElementById('nextgenCapt_offline_validation')?.checked ?? true,
        cash_collection: document.getElementById('nextgenCapt_cash_collection')?.checked ?? true,
        gps_broadcast: document.getElementById('nextgenCapt_gps_broadcast')?.checked ?? true,
        passenger_manifest: document.getElementById('nextgenCapt_passenger_manifest')?.checked ?? true,
        driver_safety_alerts: document.getElementById('nextgenCapt_driver_safety_alerts')?.checked ?? true,
        bengali_stop_announcer: Boolean(document.getElementById('nextgenCapt_bengali_stop_announcer')?.checked)
    };

    if (phone === 'GLOBAL') {
        return applyFeaturesToAllCaptains();
    }

    try {
        await apiRequest('/api/admin/captains/features', {
            method: 'POST',
            body: JSON.stringify({ phone, features })
        });
        alert(`✅ ক্যাপ্টেন ${phone}-এর জন্য নেক্সট-জেন ফিচার পারমিশন সফলভাবে আপডেট হয়েছে!`);
        await loadAdminCaptainsData();
        await loadAdminNextGenData();
    } catch (err) {
        alert(`ফিচার সেভ করতে সমস্যা হয়েছে: ${err.message}`);
    }
}
window.saveAdminSelectedCaptainFeatures = saveAdminSelectedCaptainFeatures;

async function applyFeaturesToAllCaptains() {
    const ok = await showBusYatraConfirm({ title: "গ্লোবাল ফিচার আপডেট", subtitle: "আপনি কি নিশ্চিত যে এই ফিচার সেটিংস সমস্ত ক্যাপ্টেন ও কন্ডাক্টরদের ক্ষেত্রে একসাথে প্রযোজ্য করতে চান?", icon: "👨‍✈️", confirmText: "হ্যাঁ, সবার জন্য প্রযোজ্য করুন", cancelText: "বাতিল", danger: false }); if (!ok) return;
    const features = {
        qr_scanner: document.getElementById('nextgenCapt_qr_scanner')?.checked ?? true,
        offline_validation: document.getElementById('nextgenCapt_offline_validation')?.checked ?? true,
        cash_collection: document.getElementById('nextgenCapt_cash_collection')?.checked ?? true,
        gps_broadcast: document.getElementById('nextgenCapt_gps_broadcast')?.checked ?? true,
        passenger_manifest: document.getElementById('nextgenCapt_passenger_manifest')?.checked ?? true,
        driver_safety_alerts: document.getElementById('nextgenCapt_driver_safety_alerts')?.checked ?? true,
        bengali_stop_announcer: Boolean(document.getElementById('nextgenCapt_bengali_stop_announcer')?.checked)
    };

    try {
        await apiRequest('/api/admin/features/bulk', {
            method: 'POST',
            body: JSON.stringify({ target: 'captains', features })
        });
        alert('✅ সমস্ত ক্যাপ্টেনদের জন্য নেক্সট-জেন ফিচার সেটিংস সফলভাবে আপডেট হয়েছে!');
        await loadAdminCaptainsData();
        await loadAdminNextGenData();
    } catch (err) {
        alert(`আপডেট করতে সমস্যা হয়েছে: ${err.message}`);
    }
}
window.applyFeaturesToAllCaptains = applyFeaturesToAllCaptains;

function openAdminCaptainFeaturesNextGen(phone) {
    switchAdminTab('nextgen');
    switchNextgenSubtab('captain');
    const select = document.getElementById('nextgenCaptainSelect');
    if (select && phone) {
        select.value = phone;
        onNextgenCaptainSelected();
    }
}
window.openAdminCaptainFeaturesNextGen = openAdminCaptainFeaturesNextGen;

// =========================================================================
// Strategic Growth & Business Expansion Hub (আগামী ১০ বছরের সুযোগ-সুবিধা)
// =========================================================================
function renderAdminExpansionSettings() {
    const db = getAppData();
    const flags = db.featureFlags || {};
    const expConfig = flags.expansionConfig || {};

    const setChecked = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = Boolean(val);
    };
    const setValue = (id, val, fallback = '') => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
        else if (el && fallback) el.value = fallback;
    };

    // Flags (active/inactive)
    setChecked('expFlag_whatsappBooking', flags.whatsappBooking);
    setChecked('expFlag_agentBookingPortal', flags.agentBookingPortal);
    setChecked('expFlag_monthlyPass', flags.monthlyPass);
    setChecked('expFlag_arrivalAlerts', flags.arrivalAlerts);
    setChecked('expFlag_parcelCourier', flags.parcelCourier);
    setChecked('expFlag_fuelTyrePartnership', flags.fuelTyrePartnership);
    setChecked('expFlag_surgePricing', flags.surgePricing);

    // 1. WhatsApp Bot
    const wa = expConfig.whatsappBooking || {};
    setValue('expCfg_wa_botNumber', wa.botNumber, '8768447312');
    setValue('expCfg_wa_welcomeMsg', wa.welcomeMsg, 'Hello Bus Yatra! I want to book a bus ticket.');

    // 2. Agent Network
    const agent = expConfig.agentBookingPortal || {};
    setValue('expCfg_agent_commissionPerTicket', agent.commissionPerTicket, 15);
    setValue('expCfg_agent_counterStand', agent.counterStand, 'Pingla Bus Stand');
    setChecked('expCfg_agent_allowInstantCashBook', agent.allowInstantCashBook !== false);

    // 3. Monthly Pass
    const pass = expConfig.monthlyPass || {};
    setValue('expCfg_pass_discountPercent', pass.discountPercent, 15);
    setValue('expCfg_pass_ridesCount', pass.ridesCount, 20);
    setValue('expCfg_pass_validityDays', pass.validityDays, 30);

    // 4. Arrival Alerts
    const alertCfg = expConfig.arrivalAlerts || {};
    setValue('expCfg_alert_leadMinutes', alertCfg.leadMinutes, 15);
    setValue('expCfg_alert_channel', alertCfg.channel, 'WhatsApp & SMS');

    // 5. Parcel Courier
    const parcel = expConfig.parcelCourier || {};
    setValue('expCfg_parcel_minParcelFare', parcel.minParcelFare, 50);
    setValue('expCfg_parcel_perKgRate', parcel.perKgRate, 10);
    setValue('expCfg_parcel_maxWeightKg', parcel.maxWeightKg, 40);

    // 6. Fuel & Tyre
    const fuel = expConfig.fuelTyrePartnership || {};
    setValue('expCfg_fuel_partnerNetwork', fuel.partnerNetwork, 'IndianOil / BPCL Highway Tie-Up');
    setValue('expCfg_fuel_tyreDiscountPercent', fuel.tyreDiscountPercent, 12);
    setValue('expCfg_fuel_fuelCashback', fuel.fuelCashbackPer100L || fuel.fuelCashback, 80);

    // 7. Surge Dynamic Pricing
    const surge = expConfig.surgePricing || {};
    setValue('expCfg_surge_maxMultiplier', surge.maxMultiplier, 1.25);
    setValue('expCfg_surge_reason', surge.reason, 'Festive Travel Surge');
}
window.renderAdminExpansionSettings = renderAdminExpansionSettings;

async function saveAdminExpansionSettings() {
    const flags = {
        whatsappBooking: document.getElementById('expFlag_whatsappBooking')?.checked || false,
        agentBookingPortal: document.getElementById('expFlag_agentBookingPortal')?.checked || false,
        monthlyPass: document.getElementById('expFlag_monthlyPass')?.checked || false,
        arrivalAlerts: document.getElementById('expFlag_arrivalAlerts')?.checked || false,
        parcelCourier: document.getElementById('expFlag_parcelCourier')?.checked || false,
        fuelTyrePartnership: document.getElementById('expFlag_fuelTyrePartnership')?.checked || false,
        surgePricing: document.getElementById('expFlag_surgePricing')?.checked || false
    };

    const expansionConfig = {
        whatsappBooking: {
            botNumber: document.getElementById('expCfg_wa_botNumber')?.value?.trim() || "8768447312",
            welcomeMsg: document.getElementById('expCfg_wa_welcomeMsg')?.value?.trim() || "Hello Bus Yatra! I want to book a bus ticket."
        },
        agentBookingPortal: {
            commissionPerTicket: parseFloat(document.getElementById('expCfg_agent_commissionPerTicket')?.value) || 15,
            counterStand: document.getElementById('expCfg_agent_counterStand')?.value?.trim() || "Pingla Bus Stand",
            allowInstantCashBook: document.getElementById('expCfg_agent_allowInstantCashBook')?.checked ?? true
        },
        monthlyPass: {
            discountPercent: parseFloat(document.getElementById('expCfg_pass_discountPercent')?.value) || 15,
            ridesCount: parseInt(document.getElementById('expCfg_pass_ridesCount')?.value, 10) || 20,
            validityDays: parseInt(document.getElementById('expCfg_pass_validityDays')?.value, 10) || 30
        },
        arrivalAlerts: {
            leadMinutes: parseInt(document.getElementById('expCfg_alert_leadMinutes')?.value, 10) || 15,
            channel: document.getElementById('expCfg_alert_channel')?.value || "WhatsApp & SMS"
        },
        parcelCourier: {
            minParcelFare: parseFloat(document.getElementById('expCfg_parcel_minParcelFare')?.value) || 50,
            perKgRate: parseFloat(document.getElementById('expCfg_parcel_perKgRate')?.value) || 10,
            maxWeightKg: parseFloat(document.getElementById('expCfg_parcel_maxWeightKg')?.value) || 40
        },
        fuelTyrePartnership: {
            partnerNetwork: document.getElementById('expCfg_fuel_partnerNetwork')?.value?.trim() || "IndianOil / BPCL Highway Tie-Up",
            tyreDiscountPercent: parseFloat(document.getElementById('expCfg_fuel_tyreDiscountPercent')?.value) || 12,
            fuelCashbackPer100L: parseFloat(document.getElementById('expCfg_fuel_fuelCashback')?.value) || 80
        },
        surgePricing: {
            maxMultiplier: parseFloat(document.getElementById('expCfg_surge_maxMultiplier')?.value) || 1.25,
            reason: document.getElementById('expCfg_surge_reason')?.value?.trim() || "Festive Travel Surge"
        }
    };

    try {
        const payload = {
            ...flags,
            expansionConfig
        };
        const result = await apiRequest('/api/admin/expansion-settings', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const currentFlags = getAppData().featureFlags || {};
        setAppData({
            featureFlags: {
                ...currentFlags,
                ...result.featureFlags
            }
        });
        renderAdminExpansionSettings();
        alert('🎉 ব্যবসায়িক সম্প্রসারণ হাবের সেটিংস সফলভাবে সেভ হয়েছে!');
    } catch (err) {
        alert('ব্যবসায়িক সম্প্রসারণ হাব সেটিংস সেভ করতে ব্যর্থ হয়েছে: ' + err.message);
    }
}
window.saveAdminExpansionSettings = saveAdminExpansionSettings;

// --- Admin Direct Access to Any Captain Portal ---
async function adminAccessCaptainPortal(phone, busId, name, btnEl) {
    const isBn = (typeof getPortalLanguage === 'function' ? getPortalLanguage() : 'bn') === 'bn';
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = `<span>⏳</span> <span>${isBn ? 'প্রবেশ হচ্ছে...' : 'Opening...'}</span>`;
    }
    if (typeof showToast === "function") showToast(isBn ? `👨‍✈️ "${name || 'ক্যাপ্টেন'}" প্যানেলে প্রবেশ করা হচ্ছে...` : `👨‍✈️ Accessing "${name || 'Captain'}" portal...`);

    try {
        const adminSession = getAdminSession() || JSON.parse(localStorage.getItem('admin_session') || sessionStorage.getItem('admin_session') || localStorage.getItem('portal_session_admin') || '{}');
        const token = adminSession?.token;
        if (!token) {
            alert(isBn ? 'অ্যাডমিন সেশন মেয়াদোত্তীর্ণ। দয়া করে পুনরায় লগইন করুন।' : 'Admin session expired. Please log in again.');
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = `<span>🚀</span> <span>${isBn ? 'প্যানেল খুলুন' : 'Open Portal'}</span>`;
            }
            return;
        }

        const res = await apiRequest('/api/admin/impersonate-captain', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ phone, busId })
        });

        if (!res || !res.ok || !res.token) {
            throw new Error(res?.error || (isBn ? 'ক্যাপ্টেন সেশন তৈরি করা সম্ভব হয়নি।' : 'Could not create captain impersonation session.'));
        }

        const captainSessionData = JSON.stringify({
            token: res.token,
            expiresAt: res.expiresAt
        });
        localStorage.setItem('portal_session_captain', captainSessionData);
        sessionStorage.setItem('portal_session_captain', captainSessionData);
        localStorage.setItem('captain_session', JSON.stringify({
            ...res.captain,
            token: res.token,
            impersonatedByAdmin: true
        }));

        const captainUrl = `captain.html?auth_token=${encodeURIComponent(res.token)}&admin=1&bus_id=${encodeURIComponent(res.captain?.busId || busId || '')}`;
        closeAdminCaptainAccessModal();

        // Direct instant navigation into captain portal (100% reliable across PWA & all desktop/mobile browsers)
        window.location.href = captainUrl;
    } catch (err) {
        console.error('Failed to access captain portal:', err);
        alert(isBn ? `ক্যাপ্টেন প্যানেলে প্রবেশ করা সম্ভব হয়নি: ${err.message}` : `Failed to access captain portal: ${err.message}`);
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = `<span>🚀</span> <span>${isBn ? 'প্যানেল খুলুন' : 'Open Portal'}</span>`;
        }
    }
}
window.adminAccessCaptainPortal = adminAccessCaptainPortal;

// --- Admin Direct Access to Any Owner Portal ---
async function adminAccessOwnerPortal(phone, name, btnEl) {
    const isBn = (typeof getPortalLanguage === 'function' ? getPortalLanguage() : 'bn') === 'bn';
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = `<span>⏳</span> <span>${isBn ? 'প্রবেশ হচ্ছে...' : 'Opening...'}</span>`;
    }
    if (typeof showToast === "function") showToast(isBn ? `👑 "${name || 'মালিক'}" প্যানেলে প্রবেশ করা হচ্ছে...` : `👑 Accessing "${name || 'Owner'}" portal...`);

    try {
        const adminSession = getAdminSession() || JSON.parse(localStorage.getItem('admin_session') || sessionStorage.getItem('admin_session') || localStorage.getItem('portal_session_admin') || '{}');
        const token = adminSession?.token;
        if (!token) {
            alert(isBn ? 'অ্যাডমিন সেশন মেয়াদোত্তীর্ণ। দয়া করে পুনরায় লগইন করুন।' : 'Admin session expired. Please log in again.');
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = `<span>🚀</span> <span>${isBn ? 'প্যানেল খুলুন' : 'Open Portal'}</span>`;
            }
            return;
        }

        const res = await apiRequest('/api/admin/impersonate-owner', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ phone })
        });

        if (!res || !res.ok || !res.token) {
            throw new Error(res?.error || (isBn ? 'মালিক সেশন তৈরি করা সম্ভব হয়নি।' : 'Could not create owner impersonation session.'));
        }

        const ownerSessionData = {
            token: res.token,
            expiresAt: res.expiresAt,
            owner: res.owner,
            securityConfigured: true,
            impersonatedByAdmin: true
        };
        localStorage.setItem('owner_session', JSON.stringify(ownerSessionData));
        sessionStorage.setItem('owner_session', JSON.stringify(ownerSessionData));
        localStorage.setItem('portal_session_owner', JSON.stringify({ token: res.token, expiresAt: res.expiresAt }));
        sessionStorage.setItem('portal_session_owner', JSON.stringify({ token: res.token, expiresAt: res.expiresAt }));

        const ownerUrl = `owner.html?auth_token=${encodeURIComponent(res.token)}&admin=1&owner_phone=${encodeURIComponent(phone)}`;
        closeAdminOwnerAccessModal();

        // Direct instant navigation into owner portal (100% reliable across PWA & all desktop/mobile browsers)
        window.location.href = ownerUrl;
    } catch (err) {
        console.error('Failed to access owner portal:', err);
        alert(isBn ? `মালিক প্যানেলে প্রবেশ করা সম্ভব হয়নি: ${err.message}` : `Failed to access owner portal: ${err.message}`);
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = `<span>🚀</span> <span>${isBn ? 'প্যানেল খুলুন' : 'Open Portal'}</span>`;
        }
    }
}
window.adminAccessOwnerPortal = adminAccessOwnerPortal;

let allAdminOwnerModalList = [];

async function openAdminOwnerAccessModal() {
    const modal = document.getElementById('adminOwnerAccessModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    if (typeof setPortalLanguage === 'function') setPortalLanguage(getPortalLanguage());

    const listEl = document.getElementById('adminOwnerModalList');
    const isBn = (typeof getPortalLanguage === 'function' ? getPortalLanguage() : 'bn') === 'bn';

    // Instant render from memory if available
    if (adminOwnersData && adminOwnersData.length > 0) {
        allAdminOwnerModalList = adminOwnersData;
        renderAdminOwnerAccessModal(allAdminOwnerModalList);
    } else if (listEl) {
        listEl.innerHTML = `<div class="text-center text-gray-400 py-6 flex items-center justify-center gap-2"><span class="animate-spin">⏳</span> ${isBn ? 'লোড হচ্ছে...' : 'Loading...'}</div>`;
    }

    try {
        if (!adminOwnersData || adminOwnersData.length === 0) {
            const res = await apiRequest('/api/admin/owners');
            adminOwnersData = res.owners || [];
            allAdminOwnerModalList = adminOwnersData || [];
            renderAdminOwnerAccessModal(allAdminOwnerModalList);
        }
    } catch (err) {
        if (listEl && (!adminOwnersData || adminOwnersData.length === 0)) {
            listEl.innerHTML = `<div class="text-center text-red-500 py-6">${isBn ? 'মালিকের তালিকা লোড করা যায়নি:' : 'Failed to load owners:'} ${escapeHtml(err.message)}</div>`;
        }
    }
}
window.openAdminOwnerAccessModal = openAdminOwnerAccessModal;

function closeAdminOwnerAccessModal() {
    const modal = document.getElementById('adminOwnerAccessModal');
    if (modal) modal.classList.add('hidden');
}
window.closeAdminOwnerAccessModal = closeAdminOwnerAccessModal;

function filterAdminOwnerAccessModal() {
    const q = (document.getElementById('adminOwnerModalSearch')?.value || '').trim().toLowerCase();
    if (!q) {
        renderAdminOwnerAccessModal(allAdminOwnerModalList);
        return;
    }
    const filtered = allAdminOwnerModalList.filter(o =>
        (o.name && o.name.toLowerCase().includes(q)) ||
        (o.phone && o.phone.includes(q)) ||
        (o.company_name && o.company_name.toLowerCase().includes(q)) ||
        (o.bus_number && o.bus_number.toLowerCase().includes(q))
    );
    renderAdminOwnerAccessModal(filtered);
}
window.filterAdminOwnerAccessModal = filterAdminOwnerAccessModal;

function renderAdminOwnerAccessModal(owners) {
    const listEl = document.getElementById('adminOwnerModalList');
    if (!listEl) return;
    const isBn = (typeof getPortalLanguage === 'function' ? getPortalLanguage() : 'bn') === 'bn';

    if (!owners || owners.length === 0) {
        listEl.innerHTML = `<div class="text-center text-gray-400 py-6">${isBn ? 'কোনো বাস মালিক পাওয়া যায়নি।' : 'No bus owners found.'}</div>`;
        return;
    }

    listEl.innerHTML = owners.map(o => `
        <div class="bg-gray-50 hover:bg-indigo-50/60 p-3.5 rounded-xl border border-gray-200 flex items-center justify-between gap-3 transition">
            <div class="space-y-0.5 overflow-hidden">
                <div class="font-bold text-gray-900 text-sm flex items-center gap-1.5 truncate">
                    <span>👑 ${escapeHtml(o.company_name || o.name || (isBn ? 'মালিক' : 'Owner'))}</span>
                    <span class="text-[10px] text-gray-500 font-mono">(${o.phone})</span>
                    <span class="text-[10px] bg-yellow-100 text-yellow-900 font-mono font-bold px-1.5 py-0.5 rounded border border-yellow-300">🔑 PIN: ${escapeHtml(o.pin || '••••')}</span>
                </div>
                <div class="text-gray-600 truncate text-xs">
                    👤 <strong>${escapeHtml(o.name || '')}</strong> • 🚌 Bus: <span class="font-medium">${escapeHtml(o.bus_number || 'N/A')}</span>
                </div>
            </div>
            <button type="button" onclick="adminAccessOwnerPortal('${o.phone}', '${escapeHtml(o.name || o.company_name || 'Owner')}', this)" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-sm transition flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer">
                <span>🚀</span> <span>${isBn ? 'প্যানেল খুলুন' : 'Open Portal'}</span>
            </button>
        </div>
    `).join('');
}

let allAdminCaptainModalList = [];

async function openAdminCaptainAccessModal() {
    const modal = document.getElementById('adminCaptainAccessModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    if (typeof setPortalLanguage === 'function') setPortalLanguage(getPortalLanguage());

    const listEl = document.getElementById('adminCaptainModalList');
    const isBn = (typeof getPortalLanguage === 'function' ? getPortalLanguage() : 'bn') === 'bn';

    // Instant render from memory if available
    if (allAdminCaptainModalList && allAdminCaptainModalList.length > 0) {
        renderAdminCaptainAccessModal(allAdminCaptainModalList);
    } else if (listEl) {
        listEl.innerHTML = `<div class="text-center text-gray-400 py-6 flex items-center justify-center gap-2"><span class="animate-spin">⏳</span> ${isBn ? 'লোড হচ্ছে...' : 'Loading...'}</div>`;
    }

    try {
        const res = await apiRequest('/api/admin/captains');
        allAdminCaptainModalList = res.captains || [];
        renderAdminCaptainAccessModal(allAdminCaptainModalList);
    } catch (err) {
        if (listEl && (!allAdminCaptainModalList || allAdminCaptainModalList.length === 0)) {
            listEl.innerHTML = `<div class="text-center text-red-500 py-6">${isBn ? 'ক্যাপ্টেন তালিকা লোড করা যায়নি:' : 'Failed to load captains:'} ${escapeHtml(err.message)}</div>`;
        }
    }
}
window.openAdminCaptainAccessModal = openAdminCaptainAccessModal;

function closeAdminCaptainAccessModal() {
    const modal = document.getElementById('adminCaptainAccessModal');
    if (modal) modal.classList.add('hidden');
}
window.closeAdminCaptainAccessModal = closeAdminCaptainAccessModal;

function filterAdminCaptainAccessModal() {
    const q = (document.getElementById('adminCaptainModalSearch')?.value || '').trim().toLowerCase();
    if (!q) {
        renderAdminCaptainAccessModal(allAdminCaptainModalList);
        return;
    }
    const filtered = allAdminCaptainModalList.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.bus_name && c.bus_name.toLowerCase().includes(q)) ||
        (c.bus_number && c.bus_number.toLowerCase().includes(q))
    );
    renderAdminCaptainAccessModal(filtered);
}
window.filterAdminCaptainAccessModal = filterAdminCaptainAccessModal;

function renderAdminCaptainAccessModal(captains) {
    const listEl = document.getElementById('adminCaptainModalList');
    if (!listEl) return;
    const isBn = (typeof getPortalLanguage === 'function' ? getPortalLanguage() : 'bn') === 'bn';

    if (!captains || captains.length === 0) {
        listEl.innerHTML = `<div class="text-center text-gray-400 py-6">${isBn ? 'কোনো বাস ক্যাপ্টেন পাওয়া যায়নি।' : 'No bus captains found.'}</div>`;
        return;
    }

    listEl.innerHTML = captains.map(c => `
        <div class="bg-gray-50 hover:bg-emerald-50/60 p-3.5 rounded-xl border border-gray-200 flex items-center justify-between gap-3 transition">
            <div class="space-y-0.5 overflow-hidden">
                <div class="font-bold text-gray-900 text-sm flex items-center gap-1.5 truncate">
                    <span>👨‍✈️ ${escapeHtml(c.name || (isBn ? 'ক্যাপ্টেন' : 'Captain'))}</span>
                    <span class="text-[10px] text-gray-500 font-mono">(${c.phone})</span>
                    <span class="text-[10px] bg-yellow-100 text-yellow-900 font-mono font-bold px-1.5 py-0.5 rounded border border-yellow-300">🔑 PIN: ${escapeHtml(c.pin || '••••')}</span>
                </div>
                <div class="text-gray-600 truncate text-xs">
                    🚌 <strong class="text-gray-900">${escapeHtml(c.bus_name || c.bus_id)}</strong> 
                    <span class="text-gray-500">(${escapeHtml(c.bus_number || '')})</span>
                </div>
            </div>
            <button type="button" onclick="adminAccessCaptainPortal('${c.phone}', '${c.bus_id}', '${escapeHtml(c.name || 'Captain')}', this)" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-sm transition flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer">
                <span>🚀</span> <span>${isBn ? 'প্যানেল খুলুন' : 'Open Portal'}</span>
            </button>
        </div>
    `).join('');
}

// --- Admin Direct Access to Any Customer Portal ---
async function adminAccessCustomerPortal(phone, name, btnEl) {
    const isBn = (typeof getPortalLanguage === 'function' ? getPortalLanguage() : 'bn') === 'bn';
    if (!phone) {
        alert(isBn ? 'গ্রাহকের মোবাইল নম্বর পাওয়া যায়নি।' : 'Customer phone number not found.');
        return;
    }
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = `<span>⏳</span> <span>${isBn ? 'প্রবেশ হচ্ছে...' : 'Opening...'}</span>`;
    }
    if (typeof showToast === "function") showToast(isBn ? `👤 "${name || 'যাত্রী'}" প্যানেলে প্রবেশ করা হচ্ছে...` : `👤 Accessing "${name || 'Customer'}" portal...`);

    try {
        const adminSession = getAdminSession() || JSON.parse(localStorage.getItem('admin_session') || sessionStorage.getItem('admin_session') || localStorage.getItem('portal_session_admin') || '{}');
        const token = adminSession?.token;
        if (!token) {
            alert(isBn ? 'অ্যাডমিন সেশন মেয়াদোত্তীর্ণ। দয়া করে পুনরায় লগইন করুন।' : 'Admin session expired. Please log in again.');
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.innerHTML = `<span>🚀</span> <span>${isBn ? 'প্যানেল খুলুন' : 'Open Portal'}</span>`;
            }
            return;
        }

        const res = await apiRequest('/api/admin/impersonate-customer', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ phone })
        });

        if (!res || !res.ok || !res.token) {
            throw new Error(res?.error || (isBn ? 'কাস্টমার সেশন তৈরি করা সম্ভব হয়নি।' : 'Could not create customer impersonation session.'));
        }

        const customerSessionData = {
            token: res.token,
            expiresAt: res.expiresAt,
            phone: res.customer.phone,
            name: res.customer.name,
            email: res.customer.email,
            impersonatedByAdmin: true
        };
        localStorage.setItem('customer_session', JSON.stringify(customerSessionData));
        sessionStorage.setItem('customer_session', JSON.stringify(customerSessionData));
        localStorage.setItem('portal_session_customer', JSON.stringify({ token: res.token, expiresAt: res.expiresAt }));
        sessionStorage.setItem('portal_session_customer', JSON.stringify({ token: res.token, expiresAt: res.expiresAt }));
        localStorage.setItem('busyatra_customer', JSON.stringify(res.customer));
        sessionStorage.setItem('busyatra_customer', JSON.stringify(res.customer));
        localStorage.setItem('last_customer_phone', res.customer.phone);

        const customerUrl = `index.html?auth_token=${encodeURIComponent(res.token)}&admin=1&customer_phone=${encodeURIComponent(phone)}`;
        closeAdminCustomerAccessModal();

        // Direct instant navigation into customer portal
        window.location.href = customerUrl;
    } catch (err) {
        console.error('Failed to access customer portal:', err);
        alert(isBn ? `কাস্টমার প্যানেলে প্রবেশ করা সম্ভব হয়নি: ${err.message}` : `Failed to access customer portal: ${err.message}`);
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = `<span>🚀</span> <span>${isBn ? 'প্যানেল খুলুন' : 'Open Portal'}</span>`;
        }
    }
}
window.adminAccessCustomerPortal = adminAccessCustomerPortal;

let allAdminCustomerModalList = [];

async function openAdminCustomerAccessModal() {
    const modal = document.getElementById('adminCustomerAccessModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    if (typeof setPortalLanguage === 'function') setPortalLanguage(getPortalLanguage());

    const listEl = document.getElementById('adminCustomerModalList');
    const isBn = (typeof getPortalLanguage === 'function' ? getPortalLanguage() : 'bn') === 'bn';

    // Instant render from memory if available
    if (adminRegisteredCustomers && adminRegisteredCustomers.length > 0) {
        allAdminCustomerModalList = adminRegisteredCustomers;
        renderAdminCustomerAccessModal(allAdminCustomerModalList);
    } else if (listEl) {
        listEl.innerHTML = `<div class="text-center text-gray-400 py-6 flex items-center justify-center gap-2"><span class="animate-spin">⏳</span> ${isBn ? 'লোড হচ্ছে...' : 'Loading...'}</div>`;
    }

    try {
        if (!adminRegisteredCustomers || adminRegisteredCustomers.length === 0) {
            const res = await apiRequest('/api/admin/customers');
            adminRegisteredCustomers = res.customers || [];
            allAdminCustomerModalList = adminRegisteredCustomers || [];
        }
        renderAdminCustomerAccessModal(allAdminCustomerModalList);
    } catch (err) {
        if (listEl && (!allAdminCustomerModalList || allAdminCustomerModalList.length === 0)) {
            listEl.innerHTML = `<div class="text-center text-red-500 py-6">${isBn ? 'যাত্রী তালিকা লোড করা যায়নি:' : 'Failed to load customers:'} ${escapeHtml(err.message)}</div>`;
        }
    }
}
window.openAdminCustomerAccessModal = openAdminCustomerAccessModal;

function closeAdminCustomerAccessModal() {
    document.getElementById('adminCustomerAccessModal')?.classList.add('hidden');
}
window.closeAdminCustomerAccessModal = closeAdminCustomerAccessModal;

function filterAdminCustomerAccessModal() {
    const q = (document.getElementById('adminCustomerModalSearch')?.value || '').trim().toLowerCase();
    if (!q) {
        renderAdminCustomerAccessModal(allAdminCustomerModalList);
        return;
    }
    const filtered = allAdminCustomerModalList.filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
    renderAdminCustomerAccessModal(filtered);
}
window.filterAdminCustomerAccessModal = filterAdminCustomerAccessModal;

function renderAdminCustomerAccessModal(customers) {
    const listEl = document.getElementById('adminCustomerModalList');
    if (!listEl) return;
    const isBn = (typeof getPortalLanguage === 'function' ? getPortalLanguage() : 'bn') === 'bn';

    if (!customers || customers.length === 0) {
        listEl.innerHTML = `<div class="text-center text-gray-400 py-6">${isBn ? 'কোনো যাত্রী পাওয়া যায়নি।' : 'No customers found.'}</div>`;
        return;
    }

    listEl.innerHTML = customers.map(c => `
        <div class="bg-gray-50 hover:bg-purple-50/60 p-3.5 rounded-xl border border-gray-200 flex items-center justify-between gap-3 transition">
            <div class="space-y-0.5 overflow-hidden">
                <div class="font-bold text-gray-900 text-sm flex items-center gap-1.5 truncate">
                    <span>👤 ${escapeHtml(c.name || (isBn ? 'যাত্রী' : 'Customer'))}</span>
                    <span class="text-[10px] text-gray-500 font-mono">(${c.phone})</span>
                    ${c.pin ? `<span class="text-[10px] bg-yellow-100 text-yellow-900 font-mono font-bold px-1.5 py-0.5 rounded border border-yellow-300">🔑 PIN: ${escapeHtml(c.pin)}</span>` : ''}
                </div>
                ${c.email ? `<div class="text-gray-600 truncate text-xs">✉️ ${escapeHtml(c.email)}</div>` : ''}
            </div>
            <button type="button" onclick="adminAccessCustomerPortal('${c.phone}', '${escapeHtml(c.name || 'Customer')}', this)" class="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-sm transition flex items-center gap-1.5 shrink-0 active:scale-95 cursor-pointer">
                <span>🚀</span> <span>${isBn ? 'প্যানেল খুলুন' : 'Open Portal'}</span>
            </button>
        </div>
    `).join('');
}

// --- Admin Edit Customer Details Modal & Handler ---
function openAdminEditCustomerModal(phone, name, email) {
    const modal = document.getElementById('adminEditCustomerModal');
    if (!modal) return;
    document.getElementById('adminEditCustOldPhone').value = phone || '';
    document.getElementById('adminEditCustPhone').value = phone || '';
    document.getElementById('adminEditCustName').value = name || '';
    document.getElementById('adminEditCustEmail').value = email || '';
    const errEl = document.getElementById('adminEditCustError');
    if (errEl) {
        errEl.innerText = '';
        errEl.classList.add('hidden');
    }
    modal.classList.remove('hidden');
}
window.openAdminEditCustomerModal = openAdminEditCustomerModal;

function closeAdminEditCustomerModal() {
    document.getElementById('adminEditCustomerModal')?.classList.add('hidden');
}
window.closeAdminEditCustomerModal = closeAdminEditCustomerModal;

// --- Admin Customer Profile Photo Viewer & Manager ---
function syncAdminCustomerPhotoModalUI(cust) {
    if (!cust) return;
    const info = (typeof resolveCustomerAvatarInfo === 'function')
        ? resolveCustomerAvatarInfo(cust)
        : { src: cust.profilePhoto || 'assets/avatar-customer-male.jpg', isCustom: Boolean(cust.profilePhoto), hasUploadedPhoto: Boolean(cust.profilePhoto), preference: 'auto', gender: 'male' };

    const preview = document.getElementById('adminCustPhotoModalPreviewImg');
    const nameEl = document.getElementById('adminCustPhotoModalName');
    const phoneEl = document.getElementById('adminCustPhotoModalPhone');
    const badgeEl = document.getElementById('adminCustPhotoModalBadge');
    const btnCustom = document.getElementById('btnAdminAvatarCustom');
    const btnClear = document.getElementById('btnAdminClearCustPhoto');

    if (preview) preview.src = info.src;
    if (nameEl) nameEl.innerText = cust.name || 'Customer';
    if (phoneEl) phoneEl.innerText = cust.phone ? `+91 ${cust.phone}` : '';
    if (badgeEl) {
        badgeEl.innerText = info.isCustom
            ? window.t('📷 কাস্টমারের আপলোড করা ছবি', '📷 Custom Uploaded Photo')
            : info.preference === 'male'
                ? window.t('👨 পুরুষ স্টুডিও অ্যাভাটার', '👨 Male Studio Avatar')
                : info.preference === 'female'
                    ? window.t('👩 মহিলা স্টুডিও অ্যাভাটার', '👩 Female Studio Avatar')
                    : (info.gender === 'female' ? window.t('✨ অটো মহিলা অ্যাভাটার', '✨ Auto Female Avatar') : window.t('✨ অটো পুরুষ অ্যাভাটার', '✨ Auto Male Avatar'));
    }
    const hasCustom = Boolean(info.hasUploadedPhoto);
    if (btnCustom) btnCustom.classList.toggle('hidden', !hasCustom);
    if (btnClear) btnClear.classList.toggle('hidden', !hasCustom);

    const activeCls = 'py-1.5 px-2 rounded-lg border border-purple-600 bg-purple-50 text-purple-900 font-black transition';
    const idleCls = 'py-1.5 px-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition';
    const curPref = info.preference || 'auto';
    const bAuto = document.getElementById('btnAdminAvatarAuto');
    const bMale = document.getElementById('btnAdminAvatarMale');
    const bFemale = document.getElementById('btnAdminAvatarFemale');
    if (bAuto) bAuto.className = curPref === 'auto' ? activeCls : idleCls;
    if (bMale) bMale.className = curPref === 'male' ? activeCls : idleCls;
    if (bFemale) bFemale.className = curPref === 'female' ? activeCls : idleCls;
    if (btnCustom && hasCustom) btnCustom.className = `flex-1 ${curPref === 'custom' ? activeCls : idleCls}`;
}

function openAdminCustomerPhotoModal(phone) {
    const cleanPhone = String(phone || '').trim();
    const cust = (adminRegisteredCustomers || []).find(c => String(c.phone || '').trim() === cleanPhone);
    const modal = document.getElementById('adminCustomerPhotoModal');
    if (!modal || !cust) return;
    document.getElementById('adminCustPhotoModalTargetPhone').value = cleanPhone;
    syncAdminCustomerPhotoModalUI(cust);
    modal.classList.remove('hidden');
}
window.openAdminCustomerPhotoModal = openAdminCustomerPhotoModal;

function closeAdminCustomerPhotoModal() {
    document.getElementById('adminCustomerPhotoModal')?.classList.add('hidden');
}
window.closeAdminCustomerPhotoModal = closeAdminCustomerPhotoModal;

async function persistAdminCustomerPhotoUpdate(payload) {
    const res = await apiRequest('/api/admin/customers/photo', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    const idx = (adminRegisteredCustomers || []).findIndex(c => String(c.phone || '').trim() === payload.phone);
    if (idx >= 0) {
        adminRegisteredCustomers[idx] = {
            ...adminRegisteredCustomers[idx],
            profilePhoto: res.profilePhoto !== undefined ? res.profilePhoto : (payload.clearPhoto ? '' : adminRegisteredCustomers[idx].profilePhoto),
            profile_photo: res.profilePhoto !== undefined ? res.profilePhoto : (payload.clearPhoto ? '' : adminRegisteredCustomers[idx].profile_photo),
            avatarPreference: res.avatarPreference || payload.avatarPreference || 'auto',
            avatar_preference: res.avatarPreference || payload.avatarPreference || 'auto'
        };
        syncAdminCustomerPhotoModalUI(adminRegisteredCustomers[idx]);
    }
    filterAdminCustomersList();
    renderAdminCustomersList();
    return res;
}

async function handleAdminCustomerPhotoUpload(inputEl) {
    const file = inputEl?.files?.[0];
    const phone = (document.getElementById('adminCustPhotoModalTargetPhone')?.value || '').trim();
    if (!file || !phone) return;
    const btnEl = document.getElementById('btnAdminUploadCustPhoto');
    const lblEl = document.getElementById('lblAdminUploadCustPhotoBtn');
    const orig = lblEl ? lblEl.innerText : '';
    try {
        if (btnEl) btnEl.disabled = true;
        if (lblEl) lblEl.innerText = window.t('আপলোড হচ্ছে...', 'Uploading...');
        const dataUrl = await compressSquareAvatarImage(file, 256, 0.86);
        await persistAdminCustomerPhotoUpdate({ phone, profilePhoto: dataUrl, avatarPreference: 'custom' });
        if (typeof showDropDownToast === 'function') {
            showDropDownToast(window.t('✅ কাস্টমারের ফটো আপডেট হয়েছে!', '✅ Customer photo updated!'), 'success');
        }
    } catch (err) {
        alert(err.message || 'Failed to update customer photo.');
    } finally {
        if (btnEl) btnEl.disabled = false;
        if (lblEl && orig) lblEl.innerText = orig;
        if (inputEl) inputEl.value = '';
    }
}
window.handleAdminCustomerPhotoUpload = handleAdminCustomerPhotoUpload;

async function adminSetCustomerAvatarMode(mode) {
    const phone = (document.getElementById('adminCustPhotoModalTargetPhone')?.value || '').trim();
    if (!phone) return;
    try {
        await persistAdminCustomerPhotoUpdate({ phone, avatarPreference: mode });
        if (typeof showDropDownToast === 'function') {
            showDropDownToast(window.t('✅ অ্যাভাটার মোড আপডেট হয়েছে!', '✅ Avatar mode updated!'), 'success');
        }
    } catch (err) {
        alert(err.message || 'Failed to update avatar mode.');
    }
}
window.adminSetCustomerAvatarMode = adminSetCustomerAvatarMode;

async function adminClearCustomerPhoto() {
    const phone = (document.getElementById('adminCustPhotoModalTargetPhone')?.value || '').trim();
    if (!phone) return;
    try {
        await persistAdminCustomerPhotoUpdate({ phone, clearPhoto: true, avatarPreference: 'auto' });
        if (typeof showDropDownToast === 'function') {
            showDropDownToast(window.t('✅ কাস্টম ফটো মুছে ফেলা হয়েছে।', '✅ Custom photo removed.'), 'info');
        }
    } catch (err) {
        alert(err.message || 'Failed to clear customer photo.');
    }
}
window.adminClearCustomerPhoto = adminClearCustomerPhoto;

async function adminSaveCustomerChanges() {
    const oldPhone = (document.getElementById('adminEditCustOldPhone')?.value || '').trim();
    const phone = (document.getElementById('adminEditCustPhone')?.value || '').trim();
    const name = (document.getElementById('adminEditCustName')?.value || '').trim();
    const email = (document.getElementById('adminEditCustEmail')?.value || '').trim().toLowerCase();
    const errEl = document.getElementById('adminEditCustError');
    const saveBtn = document.getElementById('adminSaveCustBtn');

    if (errEl) {
        errEl.innerText = '';
        errEl.classList.add('hidden');
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
        if (errEl) {
            errEl.innerText = 'সঠিক ১০-সংখ্যার মোবাইল নম্বর দিন (Enter valid 10-digit mobile).';
            errEl.classList.remove('hidden');
        }
        return;
    }

    if (!name || name.length < 2) {
        if (errEl) {
            errEl.innerText = 'যাত্রীর সঠিক নাম দিন (কমপক্ষে ২ অক্ষর)।';
            errEl.classList.remove('hidden');
        }
        return;
    }

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span>⏳</span> <span>সংরক্ষণ হচ্ছে...</span>';
    }

    try {
        const res = await apiRequest('/api/admin/customers/edit', {
            method: 'POST',
            body: JSON.stringify({ oldPhone, phone, name, email })
        });

        closeAdminEditCustomerModal();
        if (typeof showDropDownToast === 'function') {
            showDropDownToast(res?.message || '✅ যাত্রীর তথ্য সফলভাবে আপডেট করা হয়েছে!', 'success');
        } else {
            alert(res?.message || '✅ যাত্রীর তথ্য সফলভাবে আপডেট করা হয়েছে!');
        }
        await loadAdminCustomersData();
        await loadAdminDashboard();
    } catch (err) {
        if (errEl) {
            errEl.innerText = err.message || 'কাস্টমার আপডেট ব্যর্থ হয়েছে।';
            errEl.classList.remove('hidden');
        }
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span>💾</span> <span>সংরক্ষণ করুন</span>';
        }
    }
}
window.adminSaveCustomerChanges = adminSaveCustomerChanges;

function viewPaymentScreenshot(imgSrc, bookingId, passengerName) {
    const modal = document.getElementById('paymentScreenshotModal');
    const img = document.getElementById('paymentScreenshotModalImg');
    const sub = document.getElementById('screenshotModalSub');
    const dwn = document.getElementById('paymentScreenshotModalDownload');
    if (!modal || !img) return;
    img.src = imgSrc;
    if (sub) sub.innerText = `বুকিং #${bookingId} • যাত্রী: ${passengerName}`;
    if (dwn) {
        dwn.href = imgSrc;
        dwn.download = `receipt_${bookingId}.jpg`;
    }
    modal.classList.remove('hidden');
}
window.viewPaymentScreenshot = viewPaymentScreenshot;

function closePaymentScreenshotModal() {
    const modal = document.getElementById('paymentScreenshotModal');
    if (modal) modal.classList.add('hidden');
}
window.closePaymentScreenshotModal = closePaymentScreenshotModal;

// Quick Toggle Payment Rules per Bus
async function adminQuickToggleBusPaymentRule(busId, type, nextVal) {
    const db = getAppData();
    const bus = (db.buses || []).find(b => b.id === busId);
    if (!bus) return;

    let reqScreenshot = bus.requirePaymentScreenshot !== false;
    let reqUtr = Boolean(bus.enableUtr);

    if (type === 'screenshot') reqScreenshot = Boolean(nextVal);
    if (type === 'utr') reqUtr = Boolean(nextVal);

    try {
        await apiRequest(`/api/admin/buses/${encodeURIComponent(busId)}/payment-rules`, {
            method: 'POST',
            body: JSON.stringify({
                requirePaymentScreenshot: reqScreenshot,
                enableUtr: reqUtr
            })
        });
        bus.requirePaymentScreenshot = reqScreenshot;
        bus.enableUtr = reqUtr;
        loadAdminBuses();
        alert(`✅ বাস "${bus.name}"-এর জন্য ${type === 'screenshot' ? 'স্ক্রিনশট' : 'UTR'} অপশন ${nextVal ? '🟢 ON' : '🔴 OFF'} করা হয়েছে।`);
    } catch (e) {
        alert('পেমেন্ট রুল আপডেট করতে ব্যর্থ: ' + e.message);
    }
}
window.adminQuickToggleBusPaymentRule = adminQuickToggleBusPaymentRule;

// Owner-wise Bulk Payment Rules Modal
async function openAdminOwnerPaymentRulesModal(ownerPhone, ownerName) {
    const db = getAppData();
    const ownerBuses = (db.buses || []).filter(b => b.ownerPhone === ownerPhone);
    const busCount = ownerBuses.length;

    const choice = prompt(
        `বাস মালিক: ${ownerName} (${ownerPhone})\nমোট বাস: ${busCount}টি\n\nএই মালিকের সমস্ত বাসের জন্য পেমেন্ট অপশন সেট করুন:\n\n1 = স্ক্রিনশট ON, UTR OFF (ডিফল্ট/রেকমেন্ডেড)\n2 = স্ক্রিনশট ON, UTR ON (উভয়ই চালু)\n3 = স্ক্রিনশট OFF, UTR OFF (উভয়ই অফ - ১-ক্লিক বুকিং)\n4 = স্ক্রিনশট OFF, UTR ON (শুধু UTR চালু)\n\nপছন্দের নম্বর লিখুন (1, 2, 3 বা 4):`,
        "1"
    );

    if (!choice) return;

    let reqScreenshot = true;
    let reqUtr = false;

    if (choice === '1') {
        reqScreenshot = true;
        reqUtr = false;
    } else if (choice === '2') {
        reqScreenshot = true;
        reqUtr = true;
    } else if (choice === '3') {
        reqScreenshot = false;
        reqUtr = false;
    } else if (choice === '4') {
        reqScreenshot = false;
        reqUtr = true;
    } else {
        alert('অকার্যকর বিকল্প। কোনো পরিবর্তন করা হয়নি।');
        return;
    }

    try {
        const res = await apiRequest(`/api/admin/owners/${encodeURIComponent(ownerPhone)}/payment-rules`, {
            method: 'POST',
            body: JSON.stringify({
                requirePaymentScreenshot: reqScreenshot,
                enableUtr: reqUtr
            })
        });
        alert(`✅ সফল! মালিক ${ownerName}-এর সমস্ত (${res.updatedBuses || busCount}টি) বাসের জন্য:\n• পেমেন্ট স্ক্রিনশট: ${reqScreenshot ? '🟢 ON' : '🔴 OFF'}\n• UTR নম্বর: ${reqUtr ? '🟢 ON' : '🔴 OFF'}`);
        await loadAdminDashboard();
    } catch (err) {
        alert('মালিকের পেমেন্ট রুল আপডেট করতে ব্যর্থ: ' + err.message);
    }
}
window.openAdminOwnerPaymentRulesModal = openAdminOwnerPaymentRulesModal;

// --- Real-Time Device Tracking & Security Audit Module ---
let adminDevicesCache = { devices: [], recentLogs: [], stats: {} };
let currentAdminDeviceRoleFilter = 'all';

function formatDeviceInlineBadge(u) {
    if (!u) return '';
    const brand = u.device_brand || u.brand || '';
    const model = u.device_model || u.model || '';
    const os = u.os || '';
    const devType = u.device_type || 'Mobile';
    const city = u.city || '';
    const region = u.region || '';
    const locationStr = [city, region].filter(Boolean).join(', ');
    const lastActive = u.last_device_login_at || u.last_login_at || u.updated_at;

    if (!brand && !os && !model) {
        return `<span class="inline-flex items-center gap-1 text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
            <span>📱</span> <span>${window.t('ডিভাইস লগ এখনো মেলেনি', 'No device telemetry yet')}</span>
        </span>`;
    }

    const icon = devType === 'Desktop' ? '💻' : (devType === 'Tablet' ? '📟' : '📱');
    const deviceName = [brand, model].filter(Boolean).join(' ') || (devType === 'Desktop' ? 'PC / Computer' : 'Mobile Device');
    const timeAgo = lastActive ? formatTimeAgo(new Date(lastActive)) : '';

    return `
        <div class="inline-flex items-center gap-1.5 flex-wrap text-[11px] bg-indigo-50/80 border border-indigo-200/80 text-indigo-950 px-2 py-0.5 rounded-lg font-medium shadow-2xs mt-1">
            <span class="text-xs">${icon}</span>
            <strong class="font-bold text-indigo-900">${escapeHtml(deviceName)}</strong>
            ${os ? `<span class="text-indigo-700 font-semibold">• ${escapeHtml(os)}</span>` : ''}
            ${locationStr ? `<span class="text-indigo-600 font-medium">📍 ${escapeHtml(locationStr)}</span>` : ''}
            ${timeAgo ? `<span class="text-indigo-500 text-[10px]">(${escapeHtml(timeAgo)})</span>` : ''}
        </div>
    `;
}
window.formatDeviceInlineBadge = formatDeviceInlineBadge;

function formatTimeAgo(date) {
    if (!date || isNaN(date.getTime())) return '';
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return window.t('এইমাত্র', 'Just now');
    if (diff < 3600) {
        const m = Math.floor(diff / 60);
        return window.t(`${m} মিনিট আগে`, `${m}m ago`);
    }
    if (diff < 86400) {
        const h = Math.floor(diff / 3600);
        return window.t(`${h} ঘণ্টা আগে`, `${h}h ago`);
    }
    const d = Math.floor(diff / 86400);
    return window.t(`${d} দিন আগে`, `${d}d ago`);
}

let currentAnalyticsStatusFilter = 'all';
let currentAnalyticsPortalFilter = 'all';
let adminClientAnalyticsCache = { list: [], stats: {} };

async function loadAdminDevicesData() {
    const container = document.getElementById('adminDevicesContainer');
    const logsContainer = document.getElementById('adminLoginLogsContainer');
    const analyticsContainer = document.getElementById('adminClientAnalyticsContainer');
    const countBadge = document.getElementById('adminDevCount');
    const searchInput = document.getElementById('adminDeviceSearchInput');
    const query = searchInput ? searchInput.value.trim() : '';

    if (container) {
        container.innerHTML = `<div class="text-center text-gray-400 py-10 text-xs animate-pulse">${window.t('ডিভাইস অডিট ডেটা ফেচ করা হচ্ছে...', 'Fetching device audit telemetry...')}</div>`;
    }

    try {
        const queryParams = new URLSearchParams();
        if (currentAdminDeviceRoleFilter && currentAdminDeviceRoleFilter !== 'all') {
            queryParams.set('role', currentAdminDeviceRoleFilter);
        }
        if (currentAnalyticsStatusFilter && currentAnalyticsStatusFilter !== 'all') {
            queryParams.set('analyticsStatus', currentAnalyticsStatusFilter);
        }
        if (currentAnalyticsPortalFilter && currentAnalyticsPortalFilter !== 'all') {
            queryParams.set('analyticsPortal', currentAnalyticsPortalFilter);
        }
        if (query) {
            queryParams.set('query', query);
        }

        const res = await apiRequest(`/api/admin/devices?${queryParams.toString()}`);
        adminDevicesCache = res || { devices: [], recentLogs: [], stats: {} };
        adminClientAnalyticsCache = {
            list: res?.clientAnalytics || [],
            stats: res?.analyticsStats || {}
        };

        // Update Traffic, App Installs & Uninstall KPI Cards
        updateAdminAnalyticsKpiUI(adminClientAnalyticsCache.stats);
        renderAdminClientAnalyticsList(adminClientAnalyticsCache.list);

        // Update Overview Stats
        const stats = adminDevicesCache.stats || {};
        const devMobile = document.getElementById('statDevMobile');
        const devDesktop = document.getElementById('statDevDesktop');
        const devActiveToday = document.getElementById('statDevActiveToday');
        const devTopBrands = document.getElementById('statDevTopBrands');
        const badgeActiveDevices = document.getElementById('badgeActiveDevices');

        if (devMobile) devMobile.innerText = stats.mobileDevices ?? 0;
        if (devDesktop) devDesktop.innerText = stats.desktopDevices ?? 0;
        if (devActiveToday) devActiveToday.innerText = stats.activeToday ?? 0;
        if (badgeActiveDevices) {
            badgeActiveDevices.innerText = stats.activeToday ?? 0;
            badgeActiveDevices.classList.toggle('hidden', !stats.activeToday);
        }
        const badgeMobDevices = document.getElementById('badgeMobileDevices');
        if (badgeMobDevices) {
            badgeMobDevices.innerText = stats.activeToday ?? 0;
            badgeMobDevices.classList.toggle('hidden', !stats.activeToday);
        }

        if (devTopBrands) {
            const brands = stats.topBrands || [];
            if (brands.length === 0) {
                devTopBrands.innerHTML = `<span class="text-gray-400 text-[11px] font-normal">${window.t('কোনো ব্র্যান্ড লগ নেই', 'No brand logs')}</span>`;
            } else {
                devTopBrands.innerHTML = brands.map(b => 
                    `<div class="flex items-center justify-between text-[11px]">
                        <span class="text-gray-700">${escapeHtml(b.device_brand)}</span>
                        <span class="text-indigo-600 font-bold">${b.count}</span>
                    </div>`
                ).join('');
            }
        }

        if (countBadge) {
            countBadge.innerText = (adminDevicesCache.devices || []).length;
        }

        renderAdminDevicesList(adminDevicesCache.devices || []);
        renderAdminLoginLogsList(adminDevicesCache.recentLogs || []);
    } catch (err) {
        if (container) {
            container.innerHTML = `<div class="text-center text-red-500 py-10 text-xs">${window.t('ডিভাইস ডেটা লোড করতে ব্যর্থ', 'Failed to load device data')}: ${escapeHtml(err.message)}</div>`;
        }
        if (logsContainer) {
            logsContainer.innerHTML = `<div class="text-center text-red-500 py-6 text-xs">${window.t('লগইন হিস্টোরি লোড করতে ব্যর্থ', 'Failed to load login history')}: ${escapeHtml(err.message)}</div>`;
        }
        if (analyticsContainer) {
            analyticsContainer.innerHTML = `<div class="text-center text-red-500 py-6 text-xs">${window.t('ভিজিট ও ইনস্টল ডেটা লোড করতে ব্যর্থ', 'Failed to load traffic & install data')}: ${escapeHtml(err.message)}</div>`;
        }
    }
}
window.loadAdminDevicesData = loadAdminDevicesData;

function updateAdminAnalyticsKpiUI(st = {}) {
    const visitsEl = document.getElementById('statAnalyticsVisits');
    const uniqueSubEl = document.getElementById('statAnalyticsUniqueSub');
    const installedEl = document.getElementById('statAnalyticsInstalled');
    const installedSubEl = document.getElementById('statAnalyticsInstalledSub');
    const activeAppEl = document.getElementById('statAnalyticsActiveApp');
    const portalSubEl = document.getElementById('statAnalyticsPortalSub');
    const uninstalledEl = document.getElementById('statAnalyticsUninstalled');
    const inactiveSubEl = document.getElementById('statAnalyticsInactiveSub');
    const countEl = document.getElementById('adminAnalyticsCount');

    if (visitsEl) visitsEl.innerText = st.totalVisits ?? 0;
    if (uniqueSubEl) {
        uniqueSubEl.innerText = window.t(
            `${st.uniqueVisitors ?? 0}টি ডিভাইস • আজ ${st.todayVisitors ?? 0}`,
            `${st.uniqueVisitors ?? 0} unique • ${st.todayVisitors ?? 0} today`
        );
    }
    if (installedEl) installedEl.innerText = st.installedTotal ?? 0;
    if (installedSubEl) {
        installedSubEl.innerText = window.t(
            `📱 ${st.mobileInstalled ?? 0} মোবাইল • 💻 ${st.desktopInstalled ?? 0} পিসি`,
            `📱 ${st.mobileInstalled ?? 0} mobile • 💻 ${st.desktopInstalled ?? 0} PC`
        );
    }
    if (activeAppEl) activeAppEl.innerText = st.activeApp14d ?? 0;
    if (portalSubEl) {
        const bd = {};
        (st.portalBreakdown || []).forEach(p => { bd[p.portal] = p.installs || 0; });
        portalSubEl.innerText = `Cust:${bd.customer || 0} • Own:${bd.owner || 0} • Cap:${bd.captain || 0}`;
    }
    if (uninstalledEl) uninstalledEl.innerText = st.uninstalledTotal ?? 0;
    if (inactiveSubEl) {
        inactiveSubEl.innerText = window.t(
            `⏸️ ${st.inactiveApp14d ?? 0}টি ১৪ দিন+ নিষ্ক্রিয়`,
            `⏸️ ${st.inactiveApp14d ?? 0} inactive 14d+`
        );
    }
    if (countEl) {
        countEl.innerText = (adminClientAnalyticsCache.list || []).length;
    }
}

function setAdminAnalyticsStatusFilter(status) {
    currentAnalyticsStatusFilter = status || 'all';
    document.querySelectorAll('.admin-ana-status-btn').forEach(btn => {
        const s = btn.getAttribute('data-status');
        if (s === currentAnalyticsStatusFilter) {
            btn.className = 'admin-ana-status-btn px-2.5 py-1.5 rounded-xl font-bold bg-indigo-600 text-white shadow-xs cursor-pointer';
        } else {
            btn.className = 'admin-ana-status-btn px-2.5 py-1.5 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer';
        }
    });
    loadAdminDevicesData();
}
window.setAdminAnalyticsStatusFilter = setAdminAnalyticsStatusFilter;

function setAdminAnalyticsPortalFilter(portal) {
    currentAnalyticsPortalFilter = portal || 'all';
    loadAdminDevicesData();
}
window.setAdminAnalyticsPortalFilter = setAdminAnalyticsPortalFilter;

function renderAdminClientAnalyticsList(list) {
    const container = document.getElementById('adminClientAnalyticsContainer');
    if (!container) return;

    const countEl = document.getElementById('adminAnalyticsCount');
    if (countEl) countEl.innerText = (list || []).length;

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400 text-xs">
                <span class="text-2xl block mb-1.5">🌐</span>
                ${window.t('এই ফিল্টারে কোনো ভিজিট বা অ্যাপ ইনস্টল রেকর্ড পাওয়া যায়নি।', 'No traffic or app install records found for this filter.')}
            </div>
        `;
        return;
    }

    const fourteenDaysMs = 14 * 24 * 3600 * 1000;
    container.innerHTML = list.map(rec => {
        const portalMap = {
            customer: { label: window.t('কাস্টমার', 'Customer'), cls: 'bg-red-100 text-red-700' },
            owner: { label: window.t('ওনার', 'Owner'), cls: 'bg-amber-100 text-amber-800' },
            captain: { label: window.t('ক্যাপ্টেন', 'Captain'), cls: 'bg-blue-100 text-blue-700' },
            admin: { label: window.t('অ্যাডমিন', 'Admin'), cls: 'bg-slate-200 text-slate-800' }
        };
        const pInfo = portalMap[rec.portal] || portalMap.customer;
        const lastStandTs = rec.last_standalone_at || rec.installed_at || rec.last_seen_at;
        const isInactive = rec.install_status === 'installed' && lastStandTs && (Date.now() - new Date(lastStandTs).getTime() > fourteenDaysMs);

        let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">${window.t('🌐 ওয়েব ভিজিটর', '🌐 Web Visitor')}</span>`;
        let icon = '🌐';
        if (rec.install_status === 'uninstalled') {
            statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">${window.t('❌ আনইনস্টল', '❌ Uninstalled')}</span>`;
            icon = '❌';
        } else if (rec.install_status === 'installed' && isInactive) {
            statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">${window.t('⏸️ ইনস্টল (নিষ্ক্রিয়)', '⏸️ Installed (Inactive)')}</span>`;
            icon = '📲';
        } else if (rec.install_status === 'installed') {
            statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">${window.t('📲 অ্যাপ ইনস্টল', '📲 Installed')}</span>`;
            icon = '📲';
        }

        const brandModel = [rec.device_brand && rec.device_brand !== 'Unknown' ? rec.device_brand : '', rec.device_model || ''].filter(Boolean).join(' ')
            || (rec.device_type === 'Desktop' ? 'Desktop / PC' : 'Mobile Device');
        const loc = [rec.city, rec.region, rec.country].filter(Boolean).join(', ') || 'Online';
        const lastSeenAgo = rec.last_seen_at ? formatTimeAgo(new Date(rec.last_seen_at)) : '';
        const statusDateText = rec.uninstalled_at
            ? `${window.t('সরানো হয়েছে', 'Removed')}: ${formatTimeAgo(new Date(rec.uninstalled_at))}`
            : (rec.installed_at ? `${window.t('ইনস্টল', 'Installed')}: ${formatTimeAgo(new Date(rec.installed_at))}` : '');
        const label = `${brandModel} (${pInfo.label})`;

        return `
            <div class="p-3 rounded-xl bg-gray-50/80 hover:bg-gray-100/90 border border-gray-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition min-w-0">
                <div class="flex items-start gap-2.5 min-w-0">
                    <span class="text-lg shrink-0 mt-0.5">${icon}</span>
                    <div class="min-w-0 space-y-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="font-black text-gray-900">${escapeHtml(brandModel)}</span>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${pInfo.cls}">${escapeHtml(pInfo.label)}</span>
                            ${statusBadge}
                            ${rec.user_identifier ? `<span class="font-mono text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">👤 ${escapeHtml(rec.user_identifier)}</span>` : ''}
                        </div>
                        <div class="text-[11px] text-gray-600 flex items-center gap-2 flex-wrap">
                            <span>⚙️ ${escapeHtml(rec.os || 'Unknown')} (${escapeHtml(rec.browser || 'Browser')})</span>
                            <span>•</span>
                            <span>📍 ${escapeHtml(loc)}</span>
                            <span>•</span>
                            <span class="font-semibold text-slate-700">👁️ ${rec.visit_count || 0} ${window.t('ভিজিট', 'visits')}</span>
                            ${(rec.standalone_open_count || 0) > 0 ? `<span class="text-emerald-700 font-semibold">• 📱 ${rec.standalone_open_count} ${window.t('অ্যাপ ওপেন', 'app opens')}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pl-7 sm:pl-0">
                    <div class="text-left sm:text-right text-[10px] text-gray-500">
                        <div class="font-bold text-gray-700">${escapeHtml(lastSeenAgo)}</div>
                        ${statusDateText ? `<div class="text-gray-500">${escapeHtml(statusDateText)}</div>` : ''}
                    </div>
                    <button type="button" onclick="adminDeleteClientAnalyticsRecord('${escapeHtml(rec.client_id)}', '${escapeHtml(label)}')" class="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg transition active:scale-95 cursor-pointer shrink-0">
                        <span>🗑️</span> <span>${window.t('মুছুন', 'Delete')}</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function runAdminAnalyticsDelete(queryString, successFallback) {
    try {
        const res = await apiRequest(`/api/admin/devices/analytics?${queryString}`, { method: 'DELETE' });
        if (successFallback) alert(res?.message || successFallback);
        await loadAdminDevicesData();
    } catch (err) {
        try {
            const res = await apiRequest(`/api/admin/devices/analytics/delete?${queryString}`, { method: 'POST' });
            if (successFallback) alert(res?.message || successFallback);
            await loadAdminDevicesData();
        } catch (err2) {
            alert(window.t('মুছতে ব্যর্থ: ', 'Delete failed: ') + (err2.message || err.message));
        }
    }
}

async function adminDeleteClientAnalyticsRecord(clientId, label) {
    if (!clientId) return;
    const ok = await showBusYatraConfirm({
        title: window.t('ভিজিট / ইনস্টল রেকর্ড ডিলিট', 'Delete Traffic / Install Record'),
        subtitle: window.t(`আপনি কি ${label}-এর ভিজিট ও অ্যাপ ইনস্টল রেকর্ড মুছে ফেলতে চান?`, `Delete stored visit and app install telemetry for ${label}?`),
        icon: '🗑️',
        confirmText: window.t('হ্যাঁ, মুছে ফেলুন', 'Yes, Delete'),
        cancelText: window.t('বাতিল', 'Cancel'),
        danger: true
    });
    if (!ok) return;
    await runAdminAnalyticsDelete(`id=${encodeURIComponent(clientId)}`, window.t('✅ রেকর্ড মুছে ফেলা হয়েছে।', '✅ Record deleted.'));
}
window.adminDeleteClientAnalyticsRecord = adminDeleteClientAnalyticsRecord;

async function adminClearUninstalledAnalyticsPrompt() {
    const ok = await showBusYatraConfirm({
        title: window.t('আনইনস্টল রেকর্ড মুছুন', 'Clear Uninstalled Records'),
        subtitle: window.t('যারা অ্যাপ আনইনস্টল করেছেন সেই সব ডিভাইসের রেকর্ড মুছে ফেলতে চান?', 'Delete all device records marked as Uninstalled?'),
        icon: '🧹',
        confirmText: window.t('হ্যাঁ, মুছে ফেলুন', 'Clear Uninstalled'),
        cancelText: window.t('বাতিল', 'Cancel'),
        danger: true
    });
    if (!ok) return;
    await runAdminAnalyticsDelete('status=uninstalled', window.t('✅ আনইনস্টল রেকর্ডগুলো মুছে ফেলা হয়েছে।', '✅ Uninstalled records cleared.'));
}
window.adminClearUninstalledAnalyticsPrompt = adminClearUninstalledAnalyticsPrompt;

async function adminClearAllClientAnalyticsPrompt() {
    const ok = await showBusYatraConfirm({
        title: window.t('সব ভিজিট ও ইনস্টল ডেটা মুছুন', 'Clear All Traffic & App Data'),
        subtitle: window.t('⚠️ সমস্ত ওয়েবসাইট ভিজিটর, অ্যাপ ইনস্টল এবং আনইনস্টল পরিসংখ্যান চিরতরে মুছে ফেলতে চান?', '⚠️ Permanently delete all website visitor, app install, and uninstall telemetry records?'),
        icon: '⚠️',
        confirmText: window.t('হ্যাঁ, সব মুছে ফেলুন', 'Yes, Clear All'),
        cancelText: window.t('বাতিল', 'Cancel'),
        danger: true
    });
    if (!ok) return;
    await runAdminAnalyticsDelete('all=true', window.t('✅ সমস্ত ভিজিট ও অ্যাপ ইনস্টল ডেটা মুছে ফেলা হয়েছে।', '✅ All traffic & app install analytics cleared.'));
}
window.adminClearAllClientAnalyticsPrompt = adminClearAllClientAnalyticsPrompt;

function setAdminDeviceRoleFilter(role) {
    currentAdminDeviceRoleFilter = role;
    document.querySelectorAll('.admin-dev-role-btn').forEach(btn => {
        const r = btn.getAttribute('data-role');
        if (r === role) {
            btn.className = "admin-dev-role-btn px-3 py-1.5 rounded-xl font-bold bg-indigo-600 text-white shadow-xs";
        } else {
            btn.className = "admin-dev-role-btn px-3 py-1.5 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 text-gray-700";
        }
    });
    loadAdminDevicesData();
}
window.setAdminDeviceRoleFilter = setAdminDeviceRoleFilter;

function filterAdminDevicesList() {
    clearTimeout(window._devSearchDebounce);
    window._devSearchDebounce = setTimeout(() => {
        loadAdminDevicesData();
    }, 300);
}
window.filterAdminDevicesList = filterAdminDevicesList;

function renderAdminDevicesList(devices) {
    const container = document.getElementById('adminDevicesContainer');
    if (!container) return;

    if (!devices || devices.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-gray-400 text-xs">
                <span class="text-3xl block mb-2">🔍</span>
                ${window.t('এই ফিল্টারে কোনো ডিভাইস রেকর্ড পাওয়া যায়নি।', 'No device records found for this filter.')}
            </div>
        `;
        return;
    }

    container.innerHTML = devices.map(d => {
        const isDesktop = d.device_type === 'Desktop';
        const isTablet = d.device_type === 'Tablet';
        const devIcon = isDesktop ? '💻' : (isTablet ? '📟' : '📱');

        const roleBadge = d.role === 'customer'
            ? ('<span class="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold">' + window.t('👤 যাত্রী', '👤 Customer') + '</span>')
            : d.role === 'owner'
                ? ('<span class="bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold">' + window.t('👥 বাস মালিক', '👥 Owner') + '</span>')
                : d.role === 'captain'
                    ? ('<span class="bg-purple-100 text-purple-900 text-[10px] px-2 py-0.5 rounded-full font-bold">' + window.t('🧑‍✈️ ক্যাপ্টেন', '🧑‍✈️ Captain') + '</span>')
                    : ('<span class="bg-red-100 text-red-900 text-[10px] px-2 py-0.5 rounded-full font-bold">' + window.t('🛡️ অ্যাডমিন', '🛡️ Admin') + '</span>');

        const brand = d.device_brand || 'Unknown Brand';
        const model = d.device_model || '';
        const os = d.os || 'Unknown OS';
        const browser = d.browser || '';
        const ip = d.ip_address || 'N/A';
        const city = d.city || '';
        const region = d.region || '';
        const country = d.country || '';
        const locationText = [city, region, country].filter(Boolean).join(', ') || 'Online';
        const loginCount = d.login_count || 1;
        const lastLoginTime = d.last_login_at ? new Date(d.last_login_at).toLocaleString() : 'N/A';
        const timeAgo = d.last_login_at ? formatTimeAgo(new Date(d.last_login_at)) : '';

        const brandColors = {
            'Samsung': 'bg-blue-50 text-blue-700 border-blue-200',
            'Xiaomi': 'bg-orange-50 text-orange-700 border-orange-200',
            'POCO': 'bg-yellow-50 text-yellow-800 border-yellow-200',
            'Vivo': 'bg-cyan-50 text-cyan-700 border-cyan-200',
            'Realme': 'bg-amber-50 text-amber-800 border-amber-200',
            'OPPO': 'bg-emerald-50 text-emerald-700 border-emerald-200',
            'OnePlus': 'bg-red-50 text-red-700 border-red-200',
            'Apple': 'bg-gray-100 text-gray-900 border-gray-300',
            'Motorola': 'bg-indigo-50 text-indigo-700 border-indigo-200',
            'Google': 'bg-green-50 text-green-700 border-green-200',
            'Windows PC': 'bg-sky-50 text-sky-800 border-sky-200'
        };
        const brandStyle = brandColors[brand] || 'bg-gray-50 text-gray-700 border-gray-200';

        return `
            <div class="bg-gray-50/80 hover:bg-gray-100/90 p-4 rounded-2xl border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs transition shadow-2xs">
                <div class="space-y-1.5 flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-base">${devIcon}</span>
                        <span class="font-extrabold text-sm text-gray-900">${escapeHtml(d.user_name || d.identifier)}</span>
                        ${roleBadge}
                        <span class="font-mono text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200 text-[11px] font-semibold">${escapeHtml(d.identifier)}</span>
                    </div>

                    <div class="flex items-center gap-2 flex-wrap pt-0.5">
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-xs font-black ${brandStyle}">
                            🏢 ${escapeHtml(brand)} ${escapeHtml(model ? '• ' + model : '')}
                        </span>
                        <span class="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border text-gray-700 font-semibold text-[11px]">
                            ⚙️ ${escapeHtml(os)}
                        </span>
                        ${browser ? `
                            <span class="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border text-gray-600 text-[11px]">
                                🌐 ${escapeHtml(browser)}
                            </span>
                        ` : ''}
                    </div>

                    <div class="flex items-center gap-3 text-gray-500 text-[11px] flex-wrap pt-0.5">
                        <span class="font-medium text-gray-700">📍 ${escapeHtml(locationText)}</span>
                        <span>•</span>
                        <span class="font-mono text-gray-500">IP: ${escapeHtml(ip)}</span>
                        <span>•</span>
                        <span class="text-indigo-600 font-bold">লগইন সংখ্যা: ${loginCount} বার</span>
                    </div>
                </div>

                <div class="text-right shrink-0 flex flex-col items-start md:items-end justify-center gap-1.5 border-t md:border-t-0 pt-2 md:pt-0 w-full md:w-auto">
                    <span class="text-[10px] uppercase font-bold text-gray-400">${window.t('সর্বশেষ লগইন', 'Last Active')}</span>
                    <span class="font-bold text-gray-800 text-xs flex items-center gap-1">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping"></span>
                        ${escapeHtml(timeAgo || 'Active')}
                    </span>
                    <span class="text-[10px] text-gray-400 font-mono">${escapeHtml(lastLoginTime)}</span>
                    <button type="button" onclick="adminDeleteDeviceRecord('${escapeHtml(d.id)}', '${escapeHtml(d.user_name || d.identifier)}', '${escapeHtml(d.identifier)}')" class="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-lg transition active:scale-95 cursor-pointer mt-0.5" title="এই ডিভাইস রেকর্ড ও সমস্ত লগইন হিস্টোরি মুছে ফেলুন">
                        <span>🗑️</span> <span>${window.t('মুছুন', 'Delete')}</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderAdminLoginLogsList(logs) {
    const container = document.getElementById('adminLoginLogsContainer');
    if (!container) return;

    if (!logs || logs.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-6 text-xs">${window.t('কোনো লগইন লগ পাওয়া যায়নি।', 'No login activity logs found.')}</div>`;
        return;
    }

    container.innerHTML = logs.map(l => {
        const timeAgo = l.created_at ? formatTimeAgo(new Date(l.created_at)) : '';
        const exactTime = l.created_at ? new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
        const roleEmoji = l.role === 'customer' ? '👤' : (l.role === 'owner' ? '👥' : (l.role === 'captain' ? '🧑‍✈️' : '🛡️'));
        const location = [l.city, l.region].filter(Boolean).join(', ') || 'Online';
        const brand = l.device_brand || 'Unknown';
        const model = l.device_model || '';

        return `
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/70 hover:bg-gray-100 text-xs border border-gray-100 transition">
                <div class="flex items-center gap-2.5 min-w-0">
                    <span class="text-sm shrink-0">${roleEmoji}</span>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="font-bold text-gray-900">${escapeHtml(l.user_name || l.identifier)}</span>
                            <span class="font-mono text-gray-500 text-[10px]">(${escapeHtml(l.identifier)})</span>
                            <span class="text-gray-400 text-[10px] uppercase font-bold">• ${escapeHtml(l.role)}</span>
                        </div>
                        <div class="text-[11px] text-gray-600 flex items-center gap-1.5 flex-wrap">
                            <span class="font-semibold text-indigo-900">📱 ${escapeHtml(brand)} ${escapeHtml(model)}</span>
                            <span>•</span>
                            <span>${escapeHtml(l.os || '')}</span>
                            <span>•</span>
                            <span>📍 ${escapeHtml(location)}</span>
                        </div>
                    </div>
                </div>
                <div class="text-right shrink-0 pl-2 flex items-center gap-2">
                    <div>
                        <span class="text-gray-700 font-bold text-[11px] block">${escapeHtml(timeAgo)}</span>
                        <span class="text-gray-400 font-mono text-[10px] block">${escapeHtml(exactTime)}</span>
                    </div>
                    <button type="button" onclick="adminDeleteSingleLoginLog('${escapeHtml(l.id)}')" class="text-gray-400 hover:text-red-600 hover:bg-red-50 w-7 h-7 flex items-center justify-center rounded-lg font-bold text-sm transition cursor-pointer" title="এই লগ রেকর্ডটি ডিলিট করুন">
                        ✕
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// --- Device & Login Logs Delete Handlers ---
async function adminDeleteDeviceRecord(devId, userName, identifier) {
    if (!devId) return;
    const ok = await showBusYatraConfirm({ title: "ডিভাইস রেকর্ড ডিলিট", subtitle: `আপনি কি নিশ্চিত যে আপনি ${userName || identifier} (${identifier})-এর সংরক্ষিত ডিভাইস রেকর্ড এবং সমস্ত লগইন হিস্টোরি ক্লাউড থেকে মুছে ফেলতে চান?`, icon: "🗑️", confirmText: "হ্যাঁ, মুছে ফেলুন", cancelText: "বাতিল", danger: true });
    if (!ok) return;

    try {
        const res = await apiRequest(`/api/admin/devices?id=${encodeURIComponent(devId)}&deleteLogs=true`, {
            method: 'DELETE'
        });
        alert(res?.message || '✅ ডিভাইস রেকর্ড ও লগইন হিস্টোরি সফলভাবে মুছে ফেলা হয়েছে।');
        await loadAdminDevicesData();
        if (typeof loadAdminCustomersData === 'function') loadAdminCustomersData();
        if (typeof loadAdminOwnersData === 'function') loadAdminOwnersData();
        if (typeof loadAdminCaptainsData === 'function') loadAdminCaptainsData();
    } catch (err) {
        // Resilient POST fallback
        try {
            const res = await apiRequest(`/api/admin/devices/delete?id=${encodeURIComponent(devId)}&deleteLogs=true`, {
                method: 'POST'
            });
            alert(res?.message || '✅ ডিভাইস রেকর্ড সফলভাবে মুছে ফেলা হয়েছে।');
            await loadAdminDevicesData();
            if (typeof loadAdminCustomersData === 'function') loadAdminCustomersData();
            if (typeof loadAdminOwnersData === 'function') loadAdminOwnersData();
            if (typeof loadAdminCaptainsData === 'function') loadAdminCaptainsData();
        } catch (err2) {
            alert('ডিভাইস রেকর্ড মুছতে ব্যর্থ: ' + (err2.message || err.message));
        }
    }
}
window.adminDeleteDeviceRecord = adminDeleteDeviceRecord;

async function adminDeleteSingleLoginLog(logId) {
    if (!logId) return;
    try {
        await apiRequest(`/api/admin/devices/logs?id=${encodeURIComponent(logId)}`, {
            method: 'DELETE'
        });
        await loadAdminDevicesData();
    } catch (err) {
        alert('লগ মুছতে ব্যর্থ: ' + err.message);
    }
}
window.adminDeleteSingleLoginLog = adminDeleteSingleLoginLog;

async function adminClearAllLoginLogsPrompt() {
    const ok = await showBusYatraConfirm({ title: "লগইন হিস্টোরি ডিলিট", subtitle: "আপনি কি নিশ্চিত যে আপনি সমস্ত সাম্প্রতিক লগইন হিস্টোরি মুছে ফেলতে চান?", icon: "🗑️", confirmText: "হ্যাঁ, সব মুছে ফেলুন", cancelText: "বাতিল", danger: true });
    if (!ok) return;

    try {
        const res = await apiRequest('/api/admin/devices/logs?all=true', {
            method: 'DELETE'
        });
        alert(res?.message || '✅ সমস্ত লগইন হিস্টোরি সফলভাবে মুছে ফেলা হয়েছে।');
        await loadAdminDevicesData();
    } catch (err) {
        alert('লগ হিস্টোরি মুছতে ব্যর্থ: ' + err.message);
    }
}
window.adminClearAllLoginLogsPrompt = adminClearAllLoginLogsPrompt;

async function adminResetAllDevicesPrompt() {
    const ok = await showBusYatraConfirm({ title: "চূড়ান্ত সতর্কতা - ডেটা রিসেট", subtitle: "⚠️ আপনি কি ক্লাউড থেকে প্ল্যাটফর্মের সমস্ত সংরক্ষিত ডিভাইস ডেটা এবং সমস্ত লগইন হিস্টোরি চিরতরে রিসেট/মুছে ফেলতে চান?", icon: "⚠️", confirmText: "হ্যাঁ, চিরতরে রিসেট করুন", cancelText: "বাতিল", danger: true });
    if (!ok) return;

    try {
        const res = await apiRequest('/api/admin/devices?all=true', {
            method: 'DELETE'
        });
        alert(res?.message || '✅ সমস্ত ডিভাইস ও লগইন হিস্টোরি সফলভাবে রিসেট করা হয়েছে।');
        await loadAdminDevicesData();
        if (typeof loadAdminCustomersData === 'function') loadAdminCustomersData();
        if (typeof loadAdminOwnersData === 'function') loadAdminOwnersData();
        if (typeof loadAdminCaptainsData === 'function') loadAdminCaptainsData();
    } catch (err) {
        alert('ডিভাইস রিসেট করতে ব্যর্থ: ' + err.message);
    }
}
window.adminResetAllDevicesPrompt = adminResetAllDevicesPrompt;

// =========================================================================
// Broadcast Email Marketing & Notice Campaign (Brevo + Gmail Fallback)
// =========================================================================
let adminEmailRecipientsCache = { customers: [], owners: [], totalCustomers: 0, totalOwners: 0, totalDistinct: 0 };

async function loadAdminEmailRecipients() {
    try {
        const res = await apiRequest('/api/admin/email-recipients');
        adminEmailRecipientsCache = res || { customers: [], owners: [], totalCustomers: 0, totalOwners: 0, totalDistinct: 0 };
        updateAdminEmailRecipientsUI();
    } catch (e) {
        console.warn('Failed to load email recipients:', e);
    }
}
window.loadAdminEmailRecipients = loadAdminEmailRecipients;

function updateAdminEmailRecipientsUI() {
    const custBadge = document.getElementById('lblEmailCustCount');
    const ownerBadge = document.getElementById('lblEmailOwnerCount');
    const totalBadge = document.getElementById('lblEmailTotalCount');
    const checklist = document.getElementById('adminEmailCustomChecklistContainer');

    if (custBadge) custBadge.innerText = adminEmailRecipientsCache.totalCustomers || 0;
    if (ownerBadge) ownerBadge.innerText = adminEmailRecipientsCache.totalOwners || 0;
    if (totalBadge) totalBadge.innerText = adminEmailRecipientsCache.totalDistinct || 0;

    if (checklist) {
        const allList = [
            ...(adminEmailRecipientsCache.customers || []).map(c => ({ ...c, badge: '👤 যাত্রী' })),
            ...(adminEmailRecipientsCache.owners || []).map(o => ({ ...o, badge: '🚌 মালিক' }))
        ];
        if (allList.length === 0) {
            checklist.innerHTML = '<span class="text-gray-400 text-[11px] block py-1">কোনো ইমেইল পাওয়া যায়নি।</span>';
        } else {
            checklist.innerHTML = allList.map(u => `
                <label class="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer text-xs">
                    <input type="checkbox" value="${escapeHtml(u.email)}" onchange="syncCustomEmailSelection()" class="admin-custom-email-cb rounded text-indigo-600 focus:ring-indigo-500">
                    <span class="font-bold text-gray-800">${escapeHtml(u.name || u.phone)}</span>
                    <span class="font-mono text-gray-500 text-[11px]">&lt;${escapeHtml(u.email)}&gt;</span>
                    <span class="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-bold">${u.badge}</span>
                </label>
            `).join('');
        }
    }
}
window.updateAdminEmailRecipientsUI = updateAdminEmailRecipientsUI;

function handleAdminEmailTargetChange(val) {
    const customSec = document.getElementById('adminEmailCustomSection');
    if (customSec) {
        customSec.classList.toggle('hidden', val !== 'custom');
    }
}
window.handleAdminEmailTargetChange = handleAdminEmailTargetChange;

function syncCustomEmailSelection() {
    const selected = Array.from(document.querySelectorAll('.admin-custom-email-cb:checked')).map(cb => cb.value);
    const textarea = document.getElementById('adminEmailCustomList');
    if (textarea) {
        const currentManual = textarea.value.split(',').map(s => s.trim()).filter(s => s && !selected.includes(s));
        textarea.value = Array.from(new Set([...selected, ...currentManual])).join(', ');
    }
}
window.syncCustomEmailSelection = syncCustomEmailSelection;

function applyAdminEmailTemplate(type) {
    const subjectEl = document.getElementById('adminEmailSubject');
    const bodyEl = document.getElementById('adminEmailBody');
    if (!subjectEl || !bodyEl) return;

    if (type === 'festival') {
        subjectEl.value = '🎉 [Bus Yatra] শুভ উৎসবের শুভেচ্ছা ও বিশেষ ভ্রমণ ছাড়!';
        bodyEl.value = `নমস্কার,\n\nউৎসবের এই আনন্দময় মুহূর্তে Bus Yatra পরিবারের পক্ষ থেকে আপনাকে ও আপনার পরিবারকে জানাই আন্তরিক প্রীতি ও শুভেচ্ছা।\n\nউৎসবের মৌসুমে আপনার নিরাপদ ও আরামদায়ক যাত্রার জন্য আমাদের সমস্ত রুটে অতিরিক্ত বাস ও বিশেষ সিট বুকিং সুবিধা চালু করা হয়েছে।\n\nআজই আপনার টিকিট বুক করুন এবং ঝামেলামুক্ত যাত্রা উপভোগ করুন।\n\nধন্যবাদান্তে,\nBus Yatra টিম\nhttps://busyatra.pages.dev`;
    } else if (type === 'new_route') {
        subjectEl.value = '🚌 [Bus Yatra] নতুন বাস রুট ও বর্ধিত সময়সূচি ঘোষণা!';
        bodyEl.value = `প্রিয় যাত্রী ও পার্টনার,\n\nআপনাদের আনন্দের সাথে জানাচ্ছি যে, Bus Yatra নেটওয়ার্কে নতুন বাস সার্ভিস এবং নতুন রুট যুক্ত হয়েছে।\n\nযাত্রীদের সুবিধার্থে নিয়মিত সকাল ও সন্ধ্যার ট্রিপ বাড়ানো হয়েছে এবং লাইভ জিপিএস ট্র্যাকিং সুবিধা অন্তর্ভুক্ত করা হয়েছে।\n\nবিস্তারিত সময়সূচি ও টিকিট বুকিংয়ের জন্য আমাদের পোর্টালে ভিজিট করুন।\n\nবিনীত,\nBus Yatra ম্যানেজমেন্ট`;
    } else if (type === 'urgent') {
        subjectEl.value = '⚠️ [Bus Yatra] জরুরি সার্ভিস নোটিশ ও আপডেট';
        bodyEl.value = `জরুরি অবগতির জন্য জানানো যাচ্ছে যে,\n\nআমাদের সমস্ত যাত্রী ও বাস মালিকদের অনুরোধ করা হচ্ছে যে, আগামীকালের ট্রিপ সংক্রান্ত প্রয়োজনীয় তথ্য ও সিট রিজার্ভেশন স্ট্যাটাস আপনার প্যানেল থেকে পুনরায় যাচাই করে নিন।\n\nযেকোনো প্রয়োজনে আমাদের সাপোর্ট টিমকে ইমেইল করতে পারেন: support.busyatra@gmail.com।\n\nধন্যবাদ,\nBus Yatra সাপোর্ট কন্ট্রোল`;
    } else if (type === 'discount') {
        subjectEl.value = '🎁 [Bus Yatra] সীমিত সময়ের জন্য বিশেষ ভাউচার ও ডিসকাউন্ট অফার!';
        bodyEl.value = `নমস্কার,\n\nআপনার পরবর্তী বাসের টিকিটে দারুণ ছাড় পেতে ব্যবহার করুন আমাদের স্পেশাল ডিসকাউন্ট কুপন!\n\nবুকিং করার সময় প্রোমো কোড বক্সে কুপন কোড লিখুন এবং সাথে সাথে পেয়ে যান ক্যাশব্যাক ও ছাড়।\n\nঅফারটি সীমিত সময়ের জন্য প্রযোজ্য।\n\nশুভ যাত্রা!\nBus Yatra টিম`;
    }
}
window.applyAdminEmailTemplate = applyAdminEmailTemplate;

async function sendAdminBroadcastEmail() {
    const target = document.getElementById('adminEmailTarget')?.value || 'both';
    const subject = document.getElementById('adminEmailSubject')?.value?.trim();
    const message = document.getElementById('adminEmailBody')?.value?.trim();
    const customList = document.getElementById('adminEmailCustomList')?.value?.split(',').map(s => s.trim()).filter(Boolean) || [];
    const feedback = document.getElementById('adminEmailSendFeedback');
    const sendBtn = document.getElementById('btnSendAdminEmail');

    if (!subject) {
        alert(window.t('অনুগ্রহ করে ইমেইলের বিষয় লিখুন।', 'Please enter email subject.'));
        return;
    }
    if (!message) {
        alert(window.t('অনুগ্রহ করে ইমেইলের বার্তা লিখুন।', 'Please enter email message body.'));
        return;
    }

    const confirmMsg = target === 'both' ? 'সমস্ত নিবন্ধিত যাত্রী ও বাস মালিকদের' : (target === 'customers' ? 'সমস্ত নিবন্ধিত যাত্রীদের' : (target === 'owners' ? 'সমস্ত বাস মালিকদের' : 'নির্বাচিত গ্রাহকদের'));
    const ok = await showBusYatraConfirm({ title: "ইমেইল ব্রডকাস্ট নিশ্চিতকরণ", subtitle: `আপনি কি নিশ্চিত যে আপনি ${confirmMsg} Brevo API-র মাধ্যমে ইমেইল পাঠাতে চান?`, icon: "📧", confirmText: "হ্যাঁ, ইমেইল পাঠান", cancelText: "বাতিল", danger: false }); if (!ok) return;

    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<span>⏳</span> <span>পাঠানো হচ্ছে (Sending...)...</span>';
    }
    if (feedback) {
        feedback.className = 'p-3 rounded-2xl text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-900 block';
        feedback.innerText = 'ইমেইল পাঠানো শুরু হয়েছে, অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন...';
    }

    try {
        const res = await apiRequest('/api/admin/broadcast-email', {
            method: 'POST',
            body: JSON.stringify({
                target,
                customEmails: customList,
                subject,
                message
            })
        });

        if (res.dailyLimitReached) {
            if (feedback) {
                feedback.className = 'p-3 rounded-2xl text-xs font-bold bg-amber-50 border border-amber-300 text-amber-900 block';
                feedback.innerHTML = `
                    ⚠️ ${window.t('Brevo দৈনিক ফ্রি কোটা শেষ হয়েছে', 'Brevo daily quota reached')} (${res.sentCount} ' + window.t('টি সফল', 'sent') + ', ${res.failedCount} ${window.t('টি বাকি', 'remaining')})।<br>
                    <strong>বিকল্প উপায়:</strong> নিচের <button type="button" onclick="openGmailComposerForBroadcast()" class="underline font-black text-indigo-700 hover:text-indigo-950">"Open in Gmail (support.busyatra@gmail.com)"</button> বাটনে ক্লিক করে সরাসরি জিমেইল থেকে সবাইকে এক ক্লিকে পাঠিয়ে দিন!
                `;
            }
            alert(res.message);
        } else if (res.ok) {
            if (feedback) {
                feedback.className = 'p-3 rounded-2xl text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-900 block';
                feedback.innerText = `✅ সফল! মোট ${res.sentCount} জন ব্যবহারকারীকে সফলভাবে ইমেইল পাঠানো হয়েছে।`;
            }
            alert(`✅ সফল! মোট ${res.sentCount} জনকে ইমেইল পাঠানো সম্পন্ন হয়েছে।`);
        } else {
            throw new Error(res.error || res.message || 'ইমেইল পাঠাতে ব্যর্থ');
        }
    } catch (err) {
        if (feedback) {
            feedback.className = 'p-3 rounded-2xl text-xs font-bold bg-red-50 border border-red-300 text-red-900 block';
            feedback.innerHTML = `❌ ব্যর্থ: ${escapeHtml(err.message)}<br><button type="button" onclick="openGmailComposerForBroadcast()" class="mt-1 underline font-black text-indigo-700">${window.t('জিমেইলে সরাসরি ওপেন করুন', 'Open in Gmail')}</button>`;
        }
        alert('ইমেইল পাঠাতে সমস্যা হয়েছে: ' + err.message);
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<span>🚀</span> <span>Brevo API দিয়ে পাঠান</span>';
        }
    }
}
window.sendAdminBroadcastEmail = sendAdminBroadcastEmail;

async function openGmailComposerForBroadcast() {
    const target = document.getElementById('adminEmailTarget')?.value || 'both';
    const subject = document.getElementById('adminEmailSubject')?.value?.trim() || '[Bus Yatra] Notice';
    const message = document.getElementById('adminEmailBody')?.value?.trim() || '';
    const customList = document.getElementById('adminEmailCustomList')?.value?.split(',').map(s => s.trim()).filter(Boolean) || [];

    let bccEmails = [];

    try {
        const res = await apiRequest('/api/admin/broadcast-email', {
            method: 'POST',
            body: JSON.stringify({
                target,
                customEmails: customList,
                subject,
                message,
                mode: 'gmail_mailto'
            })
        });
        bccEmails = res.bccList ? res.bccList.split(',') : [];
    } catch (e) {
        if (target === 'customers' || target === 'both') {
            (adminEmailRecipientsCache.customers || []).forEach(c => bccEmails.push(c.email));
        }
        if (target === 'owners' || target === 'both') {
            (adminEmailRecipientsCache.owners || []).forEach(o => bccEmails.push(o.email));
        }
        if (target === 'custom') {
            bccEmails.push(...customList);
        }
    }

    const bccClean = Array.from(new Set(bccEmails.filter(Boolean))).join(',');
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(message + '\n\n---\nBus Yatra Platform\nsupport.busyatra@gmail.com\nhttps://busyatra.pages.dev');

    const gmailWebUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=support.busyatra@gmail.com&bcc=${encodeURIComponent(bccClean)}&su=${encodedSubject}&body=${encodedBody}`;
    const mailtoUrl = `mailto:support.busyatra@gmail.com?bcc=${encodeURIComponent(bccClean)}&subject=${encodedSubject}&body=${encodedBody}`;

    const win = window.open(gmailWebUrl, '_blank');
    if (!win) {
        window.location.href = mailtoUrl;
    }
}
window.openGmailComposerForBroadcast = openGmailComposerForBroadcast;

// =========================================================================
// Enterprise Bus Yatra Virtual AI Support & Ticket System (Admin Controller)
// =========================================================================
let adminTicketsData = [];
let adminActiveTicket = null;
let adminTicketFilter = 'all';
let adminTicketSearchQuery = '';
let adminReplyAttachmentBase64 = null;
let adminTicketSearchDebounceTimer = null;
let adminSupportPollTimer = null;
let adminLastTicketsHash = '';
let adminActiveTicketRenderedId = null;
let adminActiveTicketLastMsgCount = 0;

async function loadAdminSupportTickets(isSilent = false) {
    try {
        let url = `/api/admin/support/tickets?status=${encodeURIComponent(adminTicketFilter)}`;
        if (adminTicketSearchQuery) {
            url += `&search=${encodeURIComponent(adminTicketSearchQuery)}`;
        }
        const data = await apiRequest(url);
        if (data && data.ok) {
            adminTicketsData = data.tickets || [];
            
            // Generate signature hash to detect if anything changed
            const newHash = adminTicketsData.map(t => `${t.id}:${t.status}:${t.updated_at}:${(t.messages || []).length}`).join('|');
            const hasChanged = newHash !== adminLastTicketsHash;
            adminLastTicketsHash = newHash;

            // Update stats
            const total = adminTicketsData.length;
            const openCount = adminTicketsData.filter(t => t.status === 'Open').length;
            const inProgCount = adminTicketsData.filter(t => t.status === 'In Progress').length;
            const resolvedCount = adminTicketsData.filter(t => t.status === 'Resolved').length;

            const elTotal = document.getElementById('statTotalTickets');
            const elOpen = document.getElementById('statOpenTickets');
            const elInProg = document.getElementById('statInProgressTickets');
            const elResolved = document.getElementById('statResolvedTickets');

            if (elTotal) elTotal.innerText = data.totalPending !== undefined ? (openCount + inProgCount + resolvedCount) : total;
            if (elOpen) elOpen.innerText = openCount;
            if (elInProg) elInProg.innerText = inProgCount;
            if (elResolved) elResolved.innerText = resolvedCount;

            // Update pending badge in sticky navigation tab & sidebar
            const badgePending = document.getElementById('badgePendingTickets');
            const badgeSidebar = document.getElementById('badgeSidebarSupport');
            const badgeMobSupport = document.getElementById('badgeMobileSupport');
            const pendingTotal = openCount + inProgCount;
            if (badgePending) {
                if (pendingTotal > 0) {
                    badgePending.innerText = pendingTotal;
                    badgePending.classList.remove('hidden');
                } else {
                    badgePending.classList.add('hidden');
                }
            }
            if (badgeSidebar) {
                if (pendingTotal > 0) {
                    badgeSidebar.innerText = pendingTotal;
                    badgeSidebar.classList.remove('hidden');
                } else {
                    badgeSidebar.classList.add('hidden');
                }
            }
            if (badgeMobSupport) {
                if (pendingTotal > 0) {
                    badgeMobSupport.innerText = pendingTotal;
                    badgeMobSupport.classList.remove('hidden');
                } else {
                    badgeMobSupport.classList.add('hidden');
                }
            }

            // Only re-render tickets list if data actually changed OR if it's not a background poll
            if (!isSilent || hasChanged) {
                renderAdminSupportTicketsList();
            }

            // Refresh active ticket view if open
            if (adminActiveTicket) {
                const refreshed = adminTicketsData.find(t => t.id === adminActiveTicket.id);
                if (refreshed) {
                    adminActiveTicket = refreshed;
                    renderAdminActiveTicketPane(isSilent);
                }
            }
        }
    } catch (e) {
        if (!isSilent) {
            console.error('Failed to load support tickets:', e);
            const listEl = document.getElementById('adminSupportTicketList');
            if (listEl) {
                listEl.innerHTML = `<div class="p-6 text-center text-xs text-red-500 font-bold">টিকেট লোড করতে ব্যর্থ হয়েছে (${escapeHtml(e.message || 'Error')})</div>`;
            }
        }
    }
}
window.loadAdminSupportTickets = loadAdminSupportTickets;

function setAdminTicketFilter(filter) {
    adminTicketFilter = filter;
    ['all', 'Open', 'In Progress', 'Resolved'].forEach(f => {
        const key = f === 'all' ? 'All' : (f === 'In Progress' ? 'InProgress' : f);
        const btn = document.getElementById(`filterTicket${key}`);
        if (btn) {
            if (f === filter) {
                btn.className = "px-3 py-1.5 rounded-xl text-xs font-bold bg-red-600 text-white shadow-xs transition cursor-pointer";
            } else {
                btn.className = "px-3 py-1.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer";
            }
        }
    });
    loadAdminSupportTickets();
}
window.setAdminTicketFilter = setAdminTicketFilter;

function debounceAdminTicketSearch() {
    clearTimeout(adminTicketSearchDebounceTimer);
    adminTicketSearchDebounceTimer = setTimeout(() => {
        const input = document.getElementById('adminTicketSearchInput');
        adminTicketSearchQuery = (input?.value || '').trim();
        loadAdminSupportTickets();
    }, 300);
}
window.debounceAdminTicketSearch = debounceAdminTicketSearch;

function renderAdminSupportTicketsList() {
    const listEl = document.getElementById('adminSupportTicketList');
    const countEl = document.getElementById('adminTicketListCount');
    if (!listEl) return;

    if (countEl) countEl.innerText = window.t(`টিকেট তালিকা (${adminTicketsData.length})`, `Ticket Queue (${adminTicketsData.length})`);

    if (adminTicketsData.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-16 text-gray-400">
                <span class="text-3xl block mb-2">🎉</span>
                <p class="text-xs font-semibold">${window.t('কোনো টিকেট নেই', 'No Support Tickets')}</p>
                <p class="text-[11px] text-gray-400 mt-0.5">${window.t('সব সহায়তা অনুরোধ সমাধান করা হয়েছে অথবা ফিল্টারের সাথে মিলছে না।', 'All support requests are resolved or no matches for current filter.')}</p>
            </div>
        `;
        return;
    }

    let html = '';
    adminTicketsData.forEach(t => {
        const isActive = adminActiveTicket && adminActiveTicket.id === t.id;
        const timeStr = t.updated_at ? new Date(t.updated_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '';
        
        let statusBadge = '<span class="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-full">Open</span>';
        if (t.status === 'In Progress') {
            statusBadge = '<span class="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full">In Progress</span>';
        } else if (t.status === 'Resolved') {
            statusBadge = '<span class="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full">Resolved</span>';
        }

        const msgCount = (t.messages && Array.isArray(t.messages)) ? t.messages.length : 0;
        const lastMsg = t.last_message || (t.messages && t.messages[t.messages.length - 1]?.text) || 'No message';

        html += `
            <div data-ticket-id="${t.id}" onclick="openAdminSupportTicket('${t.id}')" class="p-3 sm:p-3.5 transition cursor-pointer hover:bg-gray-50 flex items-start justify-between gap-3 ${isActive ? 'bg-red-50/70 border-l-4 border-red-600' : ''}">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="font-black text-xs text-gray-900 tracking-tight">${escapeHtml(t.ticket_number || '#BY-TKT')}</span>
                        ${statusBadge}
                    </div>
                    <p class="text-xs font-bold text-gray-800 truncate">${escapeHtml(t.customer_name || 'Passenger')} • <span class="text-gray-500 font-medium">${escapeHtml(t.customer_phone || 'No phone')}</span></p>
                    <p class="text-[11px] text-gray-500 truncate mt-0.5">${escapeHtml(lastMsg)}</p>
                </div>
                <div class="text-right shrink-0 flex flex-col items-end justify-between self-stretch">
                    <span class="text-[10px] text-gray-400 block">${timeStr}</span>
                    <div class="flex items-center gap-1 mt-1">
                        <span class="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md font-bold">${msgCount} বার্তা</span>
                        <button type="button" onclick="event.stopPropagation(); deleteAdminSingleTicket('${t.id}')" class="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer" title="Delete Ticket from Database">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    });

    listEl.innerHTML = html;
}

function openAdminSupportTicket(ticketId) {
    adminActiveTicket = adminTicketsData.find(t => t.id === ticketId);
    if (!adminActiveTicket) return;

    // Highlight active item in list without destroying the list DOM
    const listEl = document.getElementById('adminSupportTicketList');
    if (listEl) {
        listEl.querySelectorAll('[data-ticket-id]').forEach(el => {
            if (el.getAttribute('data-ticket-id') === ticketId) {
                el.classList.add('bg-red-50/70', 'border-l-4', 'border-red-600');
            } else {
                el.classList.remove('bg-red-50/70', 'border-l-4', 'border-red-600');
            }
        });
    }

    adminActiveTicketRenderedId = null; // force full fresh render for new selection
    renderAdminActiveTicketPane(false);
}
window.openAdminSupportTicket = openAdminSupportTicket;

function renderAdminActiveTicketPane(isSilent = false) {
    const pane = document.getElementById('adminActiveTicketPane');
    if (!pane || !adminActiveTicket) return;

    const t = adminActiveTicket;
    const messages = t.messages || [];

    const generateChatMessagesHtml = () => {
        if (messages.length === 0) {
            return '<div class="text-center py-8 text-gray-400 text-xs">কোনো বার্তা পাওয়া যায়নি</div>';
        }
        let html = '';
        messages.forEach(m => {
            const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            if (m.sender === 'customer') {
                const safeCustomerText = escapeHtml(m.text || '');
                html += `
                    <div class="flex flex-col items-start my-2 max-w-[85%]">
                        <div class="flex items-center gap-1.5 mb-0.5 ml-1">
                            <span class="text-[10px] font-bold text-gray-700">${escapeHtml(t.customer_name || 'Passenger')}</span>
                            ${m.isVoice ? '<span class="text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">🎙️ ভয়েস বার্তা (Voice)</span>' : ''}
                        </div>
                        <div class="bg-gray-100 border border-gray-200 text-gray-900 p-3 rounded-2xl rounded-tl-xs shadow-xs text-xs sm:text-sm">
                            ${m.attachmentUrl ? `<img src="${m.attachmentUrl}" class="rounded-xl mb-2 max-h-52 w-auto object-cover border border-gray-300 cursor-pointer shadow-xs" onclick="openPhotoViewerModal('${m.attachmentUrl}')" title="Click to enlarge">` : ''}
                            <p class="whitespace-pre-line">${safeCustomerText}</p>
                            ${m.text ? `<button type="button" onclick="speakAiText(\`${safeCustomerText.replace(/"/g, '&quot;')}\`)" class="mt-2 bg-white hover:bg-red-50 text-red-700 text-[10px] px-2.5 py-1 rounded-lg font-bold border border-red-200 flex items-center gap-1 cursor-pointer transition shadow-2xs" title="Listen customer speech"><span>🔊 শুনুন (Listen)</span></button>` : ''}
                        </div>
                        <span class="text-[9px] text-gray-400 mt-0.5 ml-1">${timeStr}</span>
                    </div>
                `;
            } else if (m.sender === 'admin') {
                html += `
                    <div class="flex flex-col items-end my-2 ml-auto max-w-[85%]">
                        <span class="text-[10px] font-bold text-amber-700 mb-0.5 mr-1">👨‍💼 Admin Support Reply</span>
                        <div class="bg-gradient-to-r from-red-600 to-rose-600 text-white p-3 rounded-2xl rounded-tr-xs shadow-xs text-xs sm:text-sm">
                            ${m.attachmentUrl ? `<img src="${m.attachmentUrl}" class="rounded-xl mb-2 max-h-52 w-auto object-cover border border-white/20 cursor-pointer shadow-xs" onclick="openPhotoViewerModal('${m.attachmentUrl}')" title="Click to enlarge">` : ''}
                            <p class="whitespace-pre-line">${escapeHtml(m.text || '')}</p>
                        </div>
                        <span class="text-[9px] text-gray-400 mt-0.5 mr-1">${timeStr}</span>
                    </div>
                `;
            } else {
                // AI Assistant message
                const safeAiText = escapeHtml(m.text || '');
                html += `
                    <div class="flex flex-col items-start my-2 max-w-[85%]">
                        <div class="flex items-center gap-1.5 mb-0.5 ml-1">
                            <img src="assets/ai-agent-avatar.jpg" class="w-4 h-4 rounded-full object-cover object-top border border-red-400" alt="AI">
                            <span class="text-[10px] font-bold text-red-700">🤖 Bus Yatra AI Agent (Automated Answer)</span>
                        </div>
                        <div class="bg-red-50/50 border border-red-100 text-gray-900 p-3 rounded-2xl rounded-tl-xs shadow-xs text-xs sm:text-sm">
                            <p class="whitespace-pre-line">${safeAiText}</p>
                            <button type="button" onclick="speakAiText(\`${safeAiText.replace(/"/g, '&quot;')}\`)" class="mt-2 bg-white hover:bg-red-50 text-gray-600 hover:text-red-700 text-[10px] px-2.5 py-1 rounded-lg font-bold border border-gray-200 flex items-center gap-1 cursor-pointer transition shadow-2xs" title="Listen AI output"><span>🔊 শুনুন (Listen)</span></button>
                        </div>
                        <span class="text-[9px] text-gray-400 mt-0.5 ml-1">${timeStr}</span>
                    </div>
                `;
            }
        });
        return html;
    };

    // In-place update: If the pane already shows this ticket, do NOT destroy the DOM container!
    const stream = document.getElementById('adminTicketChatStream');
    if (adminActiveTicketRenderedId === t.id && stream) {
        if (messages.length !== adminActiveTicketLastMsgCount) {
            const isNearBottom = (stream.scrollHeight - stream.scrollTop - stream.clientHeight) < 100;
            stream.innerHTML = generateChatMessagesHtml();
            adminActiveTicketLastMsgCount = messages.length;
            if (isNearBottom || !isSilent) {
                stream.scrollTop = stream.scrollHeight;
            }
        }
        return;
    }

    // Initial render of this ticket
    adminActiveTicketRenderedId = t.id;
    adminActiveTicketLastMsgCount = messages.length;

    let statusSelectHtml = `
        <select onchange="handleAdminTicketStatusChange(this.value)" class="text-xs font-bold bg-white border border-gray-300 rounded-xl px-2.5 py-1 text-gray-800 focus:outline-none focus:border-red-500 cursor-pointer">
            <option value="Open" ${t.status === 'Open' ? 'selected' : ''}>🔴 Open</option>
            <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>🟡 In Progress</option>
            <option value="Resolved" ${t.status === 'Resolved' ? 'selected' : ''}>🟢 Resolved</option>
        </select>
    `;

    const messagesHtml = generateChatMessagesHtml();
    const isResolved = t.status === 'Resolved';

    pane.innerHTML = `
        <!-- Ticket Details Header -->
        <div class="p-3.5 sm:p-4 border-b bg-gray-50 flex items-center justify-between gap-3 shrink-0">
            <div>
                <div class="flex items-center gap-2">
                    <h3 class="font-black text-sm text-gray-900">${escapeHtml(t.ticket_number || '#BY-TKT')}</h3>
                    <span class="text-xs text-gray-500">• ${escapeHtml(t.subject || 'General Inquiry')}</span>
                </div>
                <div class="flex items-center gap-3 text-xs text-gray-600 mt-0.5">
                    <span>👤 <b>${escapeHtml(t.customer_name || 'Passenger')}</b></span>
                    ${t.customer_phone ? `<span>📱 <a href="tel:${t.customer_phone}" class="text-red-600 hover:underline font-bold">${t.customer_phone}</a></span>` : ''}
                    ${t.customer_phone ? `<span>💬 <a href="https://wa.me/91${t.customer_phone.replace(/\D/g, '')}" target="_blank" class="text-emerald-600 hover:underline font-bold">WhatsApp</a></span>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
                ${statusSelectHtml}
                ${isResolved ? `
                    <button type="button" onclick="reopenAdminTicket('${t.id}')" class="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer" title="Reopen Ticket">
                        🔄 পুনরায় খুলুন
                    </button>
                ` : `
                    <button type="button" onclick="resolveAdminTicket('${t.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-3.5 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer" title="Resolve & Close Ticket">
                        <span>✓</span> <span>সমস্যা সমাধান সম্পন্ন</span>
                    </button>
                `}
                <button type="button" onclick="deleteAdminSingleTicket('${t.id}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer" title="Delete ticket permanently from database">
                    <span>🗑️</span> <span>ডিলিট</span>
                </button>
            </div>
        </div>

        <!-- Chat Stream -->
        <div id="adminTicketChatStream" class="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/40">
            ${messagesHtml}
        </div>

        <!-- Attachment Preview Bar -->
        <div id="adminReplyAttachmentBar" class="hidden bg-gray-100 border-t border-gray-200 px-4 py-2 flex items-center justify-between">
            <div class="flex items-center gap-2">
                <img id="adminReplyAttachmentPreview" src="" class="w-10 h-10 rounded-lg object-cover border border-gray-300">
                <span class="text-xs font-bold text-gray-700">সংযুক্ত ছবি প্রস্তুত (Attachment Ready)</span>
            </div>
            <button type="button" onclick="clearAdminReplyAttachment()" class="text-gray-400 hover:text-red-600 font-bold">✕</button>
        </div>

        <!-- Quick Canned Replies Bar for Admin -->
        <div class="px-3 pt-2 bg-white flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 text-xs border-t border-gray-100">
            <span class="text-[10px] text-gray-400 font-bold uppercase shrink-0">Quick:</span>
            <button type="button" onclick="insertAdminQuickReply('আপনার পেমেন্ট ও টিকিট সফলভাবে যাচাই করে কনফার্ম করা হয়েছে।')" class="bg-gray-100 hover:bg-red-50 text-gray-700 text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition cursor-pointer">✔️ পেমেন্ট কনফার্ম</button>
            <button type="button" onclick="insertAdminQuickReply('টিকিট বাতিল ও রিফান্ড সফলভাবে প্রসেস করা হয়েছে। ২-৪ ঘণ্টার মধ্যে ব্যাংক একাউন্টে জমা হবে।')" class="bg-gray-100 hover:bg-red-50 text-gray-700 text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition cursor-pointer">🎫 রিফান্ড সম্পন্ন</button>
            <button type="button" onclick="insertAdminQuickReply('আপনার বাসের বর্তমান লাইভ অবস্থান জানতে হোমপেজের Live GPS Tracking মেনু চেক করুন।')" class="bg-gray-100 hover:bg-red-50 text-gray-700 text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition cursor-pointer">📍 লাইভ ট্র্যাকিং</button>
            <button type="button" onclick="insertAdminQuickReply('জরুরি যেকোনো তথ্যের জন্য সরাসরি বাসের ক্যাপ্টেনের নম্বরে কল করুন।')" class="bg-gray-100 hover:bg-red-50 text-gray-700 text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition cursor-pointer">📞 ক্যাপ্টেন যোগাযোগ</button>
        </div>

        <!-- Admin Reply Input Form -->
        <form onsubmit="submitAdminTicketReply(event)" class="p-3 bg-white border-t border-gray-200 flex items-center gap-2 shrink-0">
            <input type="file" id="adminReplyFileInput" accept="image/*" class="hidden" onchange="handleAdminReplyFileSelected(event)">
            <button type="button" onclick="document.getElementById('adminReplyFileInput').click()" class="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition cursor-pointer" title="Attach Photo / Document">
                📎
            </button>
            <input type="text" id="adminReplyTextInput" placeholder="যাত্রীকে অফিসিয়াল উত্তর পাঠান (Type official reply)..." autocomplete="off" class="flex-1 bg-gray-100 focus:bg-white border border-gray-200 focus:border-red-500 rounded-xl px-3.5 py-2 text-xs text-gray-900 focus:outline-none transition">
            <button type="submit" class="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer">
                <span>পাঠান</span> <span>➤</span>
            </button>
        </form>
    `;

    const streamEl = document.getElementById('adminTicketChatStream');
    if (streamEl) streamEl.scrollTop = streamEl.scrollHeight;
}

function insertAdminQuickReply(text) {
    const input = document.getElementById('adminReplyTextInput');
    if (input) {
        input.value = text;
        input.focus();
    }
}
window.insertAdminQuickReply = insertAdminQuickReply;

function showAdminToastBanner(title, msg) {
    if (typeof showToast === 'function') {
        showToast(`<b>${escapeHtml(title)}</b><br><span class="text-xs text-gray-300">${escapeHtml(msg || '')}</span>`);
    } else {
        alert(`${title}\n${msg || ''}`);
    }
}
window.showAdminToastBanner = showAdminToastBanner;

async function reopenAdminTicket(ticketId) {
    const t = adminTicketsData.find(x => x.id === ticketId) || adminActiveTicket;
    if (!t) return;
    try {
        const res = await apiRequest(`/api/admin/support/tickets/${encodeURIComponent(t.id)}/status`, {
            method: 'POST',
            body: JSON.stringify({ status: 'Open' })
        });
        if (res && res.ok) {
            t.status = 'Open';
            if (adminActiveTicket && adminActiveTicket.id === t.id) {
                adminActiveTicket.status = 'Open';
            }
            loadAdminSupportTickets();
            showAdminToastBanner('টিকেট পুনরায় চালু হয়েছে', `টিকেট ${t.ticket_number} সক্রিয় করা হলো।`);
        }
    } catch (e) {
        alert('Reopen failed: ' + (e.message || 'Error'));
    }
}
window.reopenAdminTicket = reopenAdminTicket;

function handleAdminReplyFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        adminReplyAttachmentBase64 = e.target.result;
        const bar = document.getElementById('adminReplyAttachmentBar');
        const img = document.getElementById('adminReplyAttachmentPreview');
        if (img) img.src = adminReplyAttachmentBase64;
        if (bar) bar.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}
window.handleAdminReplyFileSelected = handleAdminReplyFileSelected;

function clearAdminReplyAttachment() {
    adminReplyAttachmentBase64 = null;
    const bar = document.getElementById('adminReplyAttachmentBar');
    const input = document.getElementById('adminReplyFileInput');
    if (bar) bar.classList.add('hidden');
    if (input) input.value = '';
}
window.clearAdminReplyAttachment = clearAdminReplyAttachment;

async function submitAdminTicketReply(event) {
    if (event) event.preventDefault();
    if (!adminActiveTicket) return;

    const input = document.getElementById('adminReplyTextInput');
    const text = input ? input.value.trim() : '';
    const attachmentUrl = adminReplyAttachmentBase64;

    if (!text && !attachmentUrl) return;

    try {
        if (input) input.value = '';
        clearAdminReplyAttachment();

        const res = await apiRequest(`/api/admin/support/tickets/${encodeURIComponent(adminActiveTicket.id)}/reply`, {
            method: 'POST',
            body: JSON.stringify({
                text,
                attachmentUrl,
                status: 'In Progress'
            })
        });

        if (res && res.ok && res.ticket) {
            adminActiveTicket = res.ticket;
            // Update in array
            const idx = adminTicketsData.findIndex(t => t.id === adminActiveTicket.id);
            if (idx !== -1) adminTicketsData[idx] = adminActiveTicket;

            renderAdminSupportTicketsList();
            renderAdminActiveTicketPane();
            showAdminToastBanner('সফলভাবে উত্তর পাঠানো হয়েছে!', 'গ্রাহক তাৎক্ষণিকভাবে উত্তর দেখতে পাবেন।');
        }
    } catch (e) {
        alert('Reply failed: ' + (e.message || 'Error'));
    }
}
window.submitAdminTicketReply = submitAdminTicketReply;

async function handleAdminTicketStatusChange(newStatus) {
    if (!adminActiveTicket) return;
    try {
        const res = await apiRequest(`/api/admin/support/tickets/${encodeURIComponent(adminActiveTicket.id)}/status`, {
            method: 'POST',
            body: JSON.stringify({ status: newStatus })
        });
        if (res && res.ok) {
            adminActiveTicket.status = newStatus;
            const idx = adminTicketsData.findIndex(t => t.id === adminActiveTicket.id);
            if (idx !== -1) adminTicketsData[idx].status = newStatus;
            renderAdminSupportTicketsList();
            renderAdminActiveTicketPane();
            showAdminToastBanner('টিকেট স্ট্যাটাস আপডেট হয়েছে', `স্ট্যাটাস: ${newStatus}`);
        }
    } catch (e) {
        alert('Status update failed: ' + (e.message || 'Error'));
    }
}
window.handleAdminTicketStatusChange = handleAdminTicketStatusChange;

async function resolveAdminTicket(ticketId) {
    const t = adminTicketsData.find(x => x.id === ticketId) || adminActiveTicket;
    if (!t) return;

    const notes = prompt('টিকেট সমাধানের নোট বা বিবরণ লিখুন (ঐচ্ছিক):', 'Issue resolved by support executive.');
    if (notes === null) return; // user cancelled

    try {
        const res = await apiRequest(`/api/admin/support/tickets/${encodeURIComponent(t.id)}/status`, {
            method: 'POST',
            body: JSON.stringify({
                status: 'Resolved',
                resolutionNotes: notes
            })
        });

        if (res && res.ok) {
            t.status = 'Resolved';
            t.resolution_notes = notes;
            if (adminActiveTicket && adminActiveTicket.id === t.id) {
                adminActiveTicket.status = 'Resolved';
            }
            loadAdminSupportTickets();
            showAdminToastBanner('✅ টিকেট সমাধান সম্পন্ন হয়েছে!', `টিকেট ${t.ticket_number} সফলভাবে ক্লোজ করা হলো।`);
        }
    } catch (e) {
        alert('Failed to resolve ticket: ' + (e.message || 'Error'));
    }
}
window.resolveAdminTicket = resolveAdminTicket;

// --- Delete Single Support Ticket (Permanently removes from Cloudflare D1) ---
async function deleteAdminSingleTicket(ticketId) {
    const t = adminTicketsData.find(x => x.id === ticketId) || adminActiveTicket;
    const ticketNum = t?.ticket_number || 'এই টিকেটটি';

    const ok = await showBusYatraConfirm({ title: "টিকেট মুছে ফেলার নিশ্চিতকরণ", subtitle: `আপনি কি নিশ্চিত ${ticketNum} টিকেটটি Cloudflare ডাটাবেস থেকে স্থায়ীভাবে ডিলিট করতে চান?`, icon: "🗑️", confirmText: "হ্যাঁ, নিশ্চিত ডিলিট করুন", cancelText: "বাতিল", danger: true, badge: "Cloudflare D1 Database" }); if (!ok) return;

    try {
        const res = await apiRequest(`/api/admin/support/tickets/${encodeURIComponent(ticketId)}`, {
            method: 'DELETE'
        });

        if (res && res.ok) {
            adminTicketsData = adminTicketsData.filter(x => x.id !== ticketId);
            adminLastTicketsHash = '';
            if (adminActiveTicket && (adminActiveTicket.id === ticketId || adminActiveTicket.ticket_number === ticketId)) {
                adminActiveTicket = null;
                adminActiveTicketRenderedId = null;
                const pane = document.getElementById('adminActiveTicketPane');
                if (pane) {
                    pane.innerHTML = `
                        <div class="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-400">
                            <span class="text-4xl mb-3">💬</span>
                            <h4 class="font-bold text-gray-700 text-sm">কোনো টিকেট নির্বাচিত নেই</h4>
                            <p class="text-xs text-gray-400 mt-1 max-w-xs">বাম পাশের তালিকা থেকে যেকোনো টিকেটে ক্লিক করে গ্রাহকের সাথে সরাসরি কথা বলুন বা সমাধান করুন।</p>
                        </div>
                    `;
                }
            }
            await loadAdminSupportTickets();
            showAdminToastBanner('সফলভাবে মুছে ফেলা হয়েছে!', `${ticketNum} স্থায়ীভাবে Cloudflare ডাটাবেস থেকে ডিলিট করা হলো।`);
        }
    } catch (e) {
        alert('Delete failed: ' + (e.message || 'Error'));
    }
}
window.deleteAdminSingleTicket = deleteAdminSingleTicket;

// --- Bulk Delete All Resolved Tickets (Frees up DB and keeps system super-fast) ---
async function deleteAdminResolvedTickets() {
    const resolvedCount = adminTicketsData.filter(t => t.status === 'Resolved').length;
    if (resolvedCount === 0) {
        alert('বর্তমানে কোনো সমাধান হওয়া (Resolved) টিকেট নেই। শুধুমাত্র সমাধান হওয়া টিকেটগুলোই ডিলিট করা যাবে।');
        return;
    }

    const ok = await showBusYatraConfirm({ title: "সমাধান হওয়া টিকেট ডিলিট", subtitle: `⚠️ আপনি কি নিশ্চিত সমস্ত সমাধান হওয়া (${resolvedCount} টি) টিকেট Cloudflare ডাটাবেস থেকে স্থায়ীভাবে মুছে ফেলতে চান?

এতে ডাটাবেস সম্পূর্ণ হালকা ও ফ্রেশ থাকবে এবং কোনো জ্যাম থাকবে না।`, icon: "🗑️", confirmText: "হ্যাঁ, সব মুছে ফেলুন", cancelText: "বাতিল", danger: true, badge: "Cloudflare D1 Cleanup" }); if (!ok) {
        return;
    }

    try {
        const res = await apiRequest('/api/admin/support/tickets?status=Resolved', {
            method: 'DELETE'
        });

        if (res && res.ok) {
            adminLastTicketsHash = '';
            if (adminActiveTicket && adminActiveTicket.status === 'Resolved') {
                adminActiveTicket = null;
                adminActiveTicketRenderedId = null;
                const pane = document.getElementById('adminActiveTicketPane');
                if (pane) {
                    pane.innerHTML = `
                        <div class="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-400">
                            <span class="text-4xl mb-3">💬</span>
                            <h4 class="font-bold text-gray-700 text-sm">কোনো টিকেট নির্বাচিত নেই</h4>
                            <p class="text-xs text-gray-400 mt-1 max-w-xs">বাম পাশের তালিকা থেকে যেকোনো টিকেটে ক্লিক করে গ্রাহকের সাথে সরাসরি কথা বলুন বা সমাধান করুন।</p>
                        </div>
                    `;
                }
            }
            await loadAdminSupportTickets();
            showAdminToastBanner('ডাটাবেস সফলভাবে ক্লিন করা হয়েছে!', `সমস্ত (${resolvedCount} টি) সমাধান হওয়া টিকেট মুছে ফেলা হয়েছে।`);
        }
    } catch (e) {
        alert('Bulk delete failed: ' + (e.message || 'Error'));
    }
}
window.deleteAdminResolvedTickets = deleteAdminResolvedTickets;

// ==========================================
// EMERGENCY SOS SAFETY DESK & RADAR
// ==========================================
let adminSosAlertsData = [];
let adminSosFilter = 'all'; // 'all', 'Active', 'Resolved'
let adminSosSearchQuery = '';
let adminSosPollTimer = null;
let adminLastSosHash = '';
let adminSosSearchDebounce = null;

async function checkAdminSosBadge() {
    try {
        const data = await apiRequest('/api/admin/emergency/sos?status=Active');
        if (data && data.ok) {
            const activeCount = (data.stats && data.stats.active !== undefined) ? data.stats.active : (data.alerts || []).length;
            const badge = document.getElementById('badgeActiveSosCount');
            const badgeSidebar = document.getElementById('badgeSidebarSos');
            const badgeMobile = document.getElementById('badgeMobileSos');
            const badgeHeader = document.getElementById('badgeMobileHeaderSos');
            if (badge) {
                badge.innerText = activeCount;
                badge.classList.toggle('hidden', activeCount === 0);
            }
            if (badgeSidebar) {
                badgeSidebar.innerText = activeCount;
                badgeSidebar.classList.toggle('hidden', activeCount === 0);
            }
            if (badgeMobile) {
                badgeMobile.innerText = activeCount;
                badgeMobile.classList.toggle('hidden', activeCount === 0);
            }
            if (badgeHeader) {
                badgeHeader.innerText = activeCount;
                badgeHeader.classList.toggle('hidden', activeCount === 0);
            }
        }
    } catch (_) {}
}
window.checkAdminSosBadge = checkAdminSosBadge;

async function loadAdminSosAlerts(isSilent = false) {
    try {
        let url = `/api/admin/emergency/sos?status=${encodeURIComponent(adminSosFilter)}`;
        if (adminSosSearchQuery) {
            url += `&search=${encodeURIComponent(adminSosSearchQuery)}`;
        }
        const data = await apiRequest(url);
        if (data && data.ok) {
            adminSosAlertsData = data.alerts || [];

            // Update stats
            const total = data.stats?.total ?? adminSosAlertsData.length;
            const active = data.stats?.active ?? adminSosAlertsData.filter(a => a.status === 'Active').length;
            const resolved = data.stats?.resolved ?? adminSosAlertsData.filter(a => a.status === 'Resolved').length;

            const elTotal = document.getElementById('statSosTotal');
            const elActive = document.getElementById('statSosActive');
            const elResolved = document.getElementById('statSosResolved');
            if (elTotal) elTotal.innerText = total;
            if (elActive) elActive.innerText = active;
            if (elResolved) elResolved.innerText = resolved;

            // Badges
            const badgeActive = document.getElementById('badgeActiveSosCount');
            const badgeSidebar = document.getElementById('badgeSidebarSos');
            const badgeMobile = document.getElementById('badgeMobileSos');
            const badgeHeader = document.getElementById('badgeMobileHeaderSos');
            if (badgeActive) {
                badgeActive.innerText = active;
                badgeActive.classList.toggle('hidden', active === 0);
            }
            if (badgeSidebar) {
                badgeSidebar.innerText = active;
                badgeSidebar.classList.toggle('hidden', active === 0);
            }
            if (badgeMobile) {
                badgeMobile.innerText = active;
                badgeMobile.classList.toggle('hidden', active === 0);
            }
            if (badgeHeader) {
                badgeHeader.innerText = active;
                badgeHeader.classList.toggle('hidden', active === 0);
            }

            // Audio alert if new active alert arrives while admin is on the tab
            const newHash = adminSosAlertsData.map(a => `${a.id}:${a.status}:${a.camera_active ? 1 : 0}:${a.photos_count || 0}:${a.camera_updated_at || ''}`).join('|');
            const hasNew = newHash !== adminLastSosHash;
            if (hasNew && active > 0 && isSilent) {
                playSosNotificationSound();
            }
            adminLastSosHash = newHash;

            renderAdminSosAlertsList();
        }
    } catch (err) {
        if (!isSilent) {
            console.error('Failed to load SOS alerts:', err);
            const container = document.getElementById('adminSosAlertsContainer');
            if (container) {
                container.innerHTML = `<div class="p-8 text-center text-xs text-red-500 font-bold bg-white rounded-2xl border border-red-200">অ্যালার্ট লোড করতে সমস্যা হয়েছে (${escapeHtml(err.message || 'Error')})</div>`;
            }
        }
    }
}
window.loadAdminSosAlerts = loadAdminSosAlerts;

function playSosNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        osc.frequency.setValueAtTime(440, audioCtx.currentTime + 0.15); // A4
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
    } catch (_) {}
}

function setAdminSosFilter(filter) {
    adminSosFilter = filter;
    ['all', 'Active', 'Resolved'].forEach(f => {
        const btn = document.getElementById(`filterSos${f}`);
        if (btn) {
            if (f === filter) {
                btn.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-600 text-white shadow-xs transition cursor-pointer flex items-center gap-1";
            } else {
                btn.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer flex items-center gap-1";
            }
        }
    });
    loadAdminSosAlerts();
}
window.setAdminSosFilter = setAdminSosFilter;

function handleAdminSosSearch(val) {
    adminSosSearchQuery = (val || '').trim();
    if (adminSosSearchDebounce) clearTimeout(adminSosSearchDebounce);
    adminSosSearchDebounce = setTimeout(() => {
        loadAdminSosAlerts();
    }, 350);
}
window.handleAdminSosSearch = handleAdminSosSearch;

function renderAdminSosAlertsList() {
    const container = document.getElementById('adminSosAlertsContainer');
    if (!container) return;

    if (!adminSosAlertsData || adminSosAlertsData.length === 0) {
        container.innerHTML = `
            <div class="bg-white rounded-3xl p-10 text-center border border-gray-200 shadow-xs">
                <span class="text-4xl">🛡️</span>
                <h4 class="font-bold text-gray-800 text-sm mt-2">${window.t('কোনো জরুরি SOS অ্যালার্ট নেই', 'No Emergency SOS Alerts')}</h4>
                <p class="text-xs text-gray-400 mt-1">${window.t('যাত্রীদের সুরক্ষা সম্পর্কিত সমস্ত রিকোয়েস্ট নিরাপদ ও নিয়ন্ত্রণে রয়েছে।', 'All passenger safety incidents are safe and under control.')}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = adminSosAlertsData.map(alert => {
        const isResolved = alert.status === 'Resolved';
        const phone = alert.customer_phone || '';
        const name = alert.customer_name || 'Passenger';
        const type = alert.emergency_type || window.t('🚨 জরুরি সহায়তা', '🚨 Emergency SOS');
        const timeStr = alert.created_at ? formatSosTimeAgoOrDate(alert.created_at) : window.t('সম্প্রতি', 'Recently');
        const coords = (alert.latitude && alert.longitude) ? `${alert.latitude},${alert.longitude}` : '';
        const mapsLink = alert.maps_url || (coords ? `https://www.google.com/maps/search/?api=1&query=${coords}` : '');
        const locationText = alert.current_location_text || (coords ? `GPS (${alert.latitude}, ${alert.longitude})` : window.t('লোকেশন নির্দিষ্ট নেই', 'Location not specified'));
        
        // Pre-filled WhatsApp greeting
        const waMsg = encodeURIComponent(`নমস্কার ${name},\nবাস যাত্রা (Bus Yatra) কন্ট্রোল রুম থেকে বলছি। আপনার পাঠানো জরুরি SOS অ্যালার্ট (${alert.alert_number}) আমরা পেয়েছি। আমরা আপনাকে তাৎক্ষণিক সহায়তা করতে প্রস্তুত। আপনার বর্তমান অবস্থা জানান।`);
        const waUrl = `https://wa.me/91${phone.replace(/[^0-9]/g, '').slice(-10)}?text=${waMsg}`;

        return `
            <div class="bg-white rounded-2xl sm:rounded-3xl border ${isResolved ? 'border-gray-200 bg-gray-50/50' : 'border-red-300 shadow-md shadow-red-500/5 ring-1 ring-red-400/30'} p-4 sm:p-5 transition hover:shadow-lg">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b ${isResolved ? 'border-gray-100' : 'border-red-100'}">
                    <div class="flex items-center gap-2.5 flex-wrap">
                        <span class="text-xs font-black px-2.5 py-1 rounded-xl font-mono ${isResolved ? 'bg-gray-200 text-gray-700' : 'bg-red-600 text-white animate-pulse'}">
                            ${escapeHtml(alert.alert_number || '#SOS')}
                        </span>
                        <span class="text-xs font-bold px-2.5 py-1 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center gap-1.5">
                            ${escapeHtml(type)}
                        </span>
                        <span class="text-[11px] text-gray-400 font-medium">🕒 ${timeStr}</span>
                    </div>
                    <div>
                        ${isResolved 
                            ? `<span class="inline-flex items-center gap-1 text-[11px] font-black bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200">
                                 ✅ সমাধান সম্পন্ন (${escapeHtml(alert.resolved_by || 'Admin')})
                               </span>`
                            : `<span class="inline-flex items-center gap-1.5 text-[11px] font-black bg-red-100 text-red-700 px-3 py-1 rounded-full border border-red-200 animate-pulse">
                                 <span class="w-2 h-2 rounded-full bg-red-600 animate-ping"></span> জরুরি মনোযোগ প্রয়োজন (ACTIVE)
                               </span>`
                        }
                    </div>
                </div>

                <!-- Info Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 my-3.5 text-xs">
                    <!-- Passenger Info -->
                    <div class="space-y-1.5 bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                        <div class="flex items-center justify-between">
                            <span class="text-gray-500 font-semibold">যাত্রীর নাম:</span>
                            <span class="font-black text-gray-900">${escapeHtml(name)}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-gray-500 font-semibold">মোবাইল নম্বর:</span>
                            <a href="tel:${phone}" class="font-bold font-mono text-red-600 hover:underline flex items-center gap-1">
                                📞 ${escapeHtml(phone)}
                            </a>
                        </div>
                        ${alert.bus_name ? `
                        <div class="flex items-center justify-between">
                            <span class="text-gray-500 font-semibold">বাসের নাম:</span>
                            <span class="font-bold text-gray-700">${escapeHtml(alert.bus_name)}</span>
                        </div>` : ''}
                    </div>

                    <!-- Location & GPS Info -->
                    <div class="space-y-1.5 bg-red-50/50 p-3 rounded-xl border border-red-100">
                        <div class="flex items-start justify-between gap-2">
                            <span class="text-gray-500 font-semibold shrink-0">বর্তমান অবস্থান:</span>
                            <span class="font-bold text-gray-900 text-right leading-tight">${escapeHtml(locationText)}</span>
                        </div>
                        ${coords ? `
                        <div class="flex items-center justify-between">
                            <span class="text-gray-500 font-semibold">জিপিএস কোঅর্ডিনেট:</span>
                            <span class="font-mono text-[11px] text-gray-700">${coords}</span>
                        </div>` : ''}
                        ${alert.description ? `
                        <div class="mt-1 pt-1.5 border-t border-red-100 text-gray-700 italic">
                            <span class="font-semibold not-italic text-gray-600">যাত্রীর বার্তা:</span> "${escapeHtml(alert.description)}"
                        </div>` : ''}
                    </div>
                </div>

                ${isResolved && alert.resolution_notes ? `
                <div class="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 mb-3 flex items-start gap-2">
                    <span>📝</span>
                    <div>
                        <span class="font-bold">সমাধানের বিবরণ:</span> ${escapeHtml(alert.resolution_notes)}
                        ${alert.resolved_at ? `<span class="text-[10px] text-emerald-700 block mt-0.5">${new Date(alert.resolved_at).toLocaleString('bn-IN')}</span>` : ''}
                    </div>
                </div>` : ''}

                <!-- Action Buttons Toolbar -->
                <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                    <div class="flex items-center gap-2 flex-wrap">
                        <!-- Direct Phone Call -->
                        <a href="tel:${phone}" class="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm active:scale-95">
                            <span>📞</span> <span>সরাসরি কল করুন</span>
                        </a>

                        <!-- WhatsApp Direct -->
                        <a href="${waUrl}" target="_blank" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm active:scale-95">
                            <span>💬</span> <span>হোয়াটসঅ্যাপ মেসেজ</span>
                        </a>

                        <!-- Live Google Maps -->
                        ${mapsLink ? `
                        <a href="${mapsLink}" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm active:scale-95">
                            <span>🗺️</span> <span>ম্যাপে লাইভ ট্র্যাক</span>
                        </a>` : ''}
                    </div>

                    <div class="flex items-center gap-2 flex-wrap">
                        ${Boolean(alert.camera_consent && alert.camera_active && !isResolved) ? `
                        <button type="button" onclick="openAdminSosCameraModal('${escapeHtml(alert.id)}')" class="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm animate-pulse cursor-pointer">
                            <span>📺</span> <span>লাইভ ভিডিও দেখুন (LIVE)</span>
                        </button>` : (Boolean(alert.camera_consent) ? `
                        <span class="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                            📷 ক্যামেরা সেশন সমাপ্ত
                        </span>` : '')}
                        ${Number(alert.photos_count || 0) > 0 ? `
                        <button type="button" onclick="openAdminSosCameraModal('${escapeHtml(alert.id)}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1 shadow-sm cursor-pointer">
                            <span>🖼️</span> <span>তোলা ছবি (${Number(alert.photos_count)})</span>
                        </button>` : ''}

                        <!-- Mark Solved Button -->
                        ${!isResolved ? `
                        <button type="button" onclick="resolveAdminSosAlert('${alert.id}')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer">
                            <span>✅</span> <span>সমস্যা সমাধান সম্পন্ন (Solve)</span>
                        </button>` : ''}

                        <!-- Delete Button -->
                        <button type="button" onclick="deleteAdminSosAlert('${alert.id}', '${alert.alert_number}')" class="bg-gray-100 hover:bg-rose-100 text-gray-500 hover:text-red-700 font-bold text-xs px-2.5 py-2 rounded-xl border border-gray-200 hover:border-red-200 transition cursor-pointer" title="মুছে ফেলুন">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function resolveAdminSosAlert(id) {
    const note = prompt('এই জরুরি সমস্যার সমাধান কিভাবে করা হলো সংক্ষেপে লিখুন (ঐচ্ছিক):', 'সাহায্য পাঠানো হয়েছে ও যাত্রী নিরাপদ আছেন');
    if (note === null) return; // User cancelled

    try {
        const res = await apiRequest(`/api/admin/emergency/sos/${encodeURIComponent(id)}/resolve`, {
            method: 'POST',
            body: JSON.stringify({ resolution_notes: note })
        });
        if (res && res.ok) {
            alert('✅ SOS অ্যালার্ট সফলভাবে সমাধান (Resolved) হিসেবে চিহ্নিত করা হয়েছে।');
            loadAdminSosAlerts();
        } else {
            alert(res?.error || 'সমাধান করতে ব্যর্থ হয়েছে');
        }
    } catch (err) {
        alert('ত্রুটি: ' + (err.message || 'Error'));
    }
}
window.resolveAdminSosAlert = resolveAdminSosAlert;

async function deleteAdminSosAlert(id, alertNumber) {
    const ok = await showBusYatraConfirm({
        title: "SOS অ্যালার্ট মুছে ফেলবেন?",
        subtitle: `জরুরি অ্যালার্ট (${alertNumber}) ডাটাবেস থেকে স্থায়ীভাবে মুছে ফেলা হবে।`,
        icon: '🗑️',
        confirmText: "হ্যাঁ, মুছুন",
        cancelText: "বাতিল",
        danger: true
    });
    if (!ok) return;

    try {
        const res = await apiRequest(`/api/admin/emergency/sos/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
        if (res && res.ok) {
            loadAdminSosAlerts();
        } else {
            alert(res?.error || 'মুছে ফেলতে ব্যর্থ হয়েছে');
        }
    } catch (err) {
        alert('ত্রুটি: ' + (err.message || 'Error'));
    }
}
window.deleteAdminSosAlert = deleteAdminSosAlert;

async function deleteAdminResolvedSosAlerts() {
    const ok = await showBusYatraConfirm({
        title: "সমাধান হওয়া অ্যালার্ট ক্লিয়ার করবেন?",
        subtitle: "সমস্ত সমাধান হওয়া (Resolved) SOS রেকর্ড ডাটাবেস থেকে স্থায়ীভাবে মুছে ফেলা হবে।",
        icon: '🧹',
        confirmText: "হ্যাঁ, সমস্ত সমাধান মুছুন",
        cancelText: "বাতিল",
        danger: true
    });
    if (!ok) return;

    try {
        const res = await apiRequest('/api/admin/emergency/sos?status=Resolved', {
            method: 'DELETE'
        });
        if (res && res.ok) {
            alert(res.message || 'সমাধান হওয়া রেকর্ড মুছে ফেলা হয়েছে।');
            loadAdminSosAlerts();
        } else {
            alert(res?.error || 'ব্যর্থ হয়েছে');
        }
    } catch (err) {
        alert('ত্রুটি: ' + (err.message || 'Error'));
    }
}
window.deleteAdminResolvedSosAlerts = deleteAdminResolvedSosAlerts;

function formatSosTimeAgoOrDate(dtString) {
    try {
        const dt = new Date(dtString);
        const diffSec = Math.floor((Date.now() - dt.getTime()) / 1000);
        if (diffSec < 60) return 'এইমাত্র';
        if (diffSec < 3600) return `${Math.floor(diffSec / 60)} মিনিট আগে`;
        if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ঘণ্টা আগে`;
        return dt.toLocaleDateString('bn-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
        return dtString;
    }
}

// --- Admin Consent-Based SOS Live Video Call (WebRTC) + Frame Fallback + Photo Capture/Save ---
let adminActiveSosCameraId = null;
let adminSosCameraPollTimer = null;
let adminSosWebrtcPc = null;
let adminSosHandledNonce = '';
let adminSosVideoStreaming = false;
let adminSosLastPhotosCount = -1;
const ADMIN_SOS_RTC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

function teardownAdminSosWebrtc() {
    if (adminSosWebrtcPc) {
        try { adminSosWebrtcPc.close(); } catch (_) {}
        adminSosWebrtcPc = null;
    }
    adminSosHandledNonce = '';
    adminSosVideoStreaming = false;
    const vid = document.getElementById('adminSosCamVideo');
    if (vid) {
        vid.srcObject = null;
        vid.classList.add('hidden');
        vid.style.display = 'none';
    }
}

function downloadAdminSosPhotoDataUrl(dataUrl, filename) {
    if (!dataUrl) return;
    try {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename || `BusYatra_SOS_Admin_${Date.now()}.jpg`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 120);
    } catch (_) {}
}
window.downloadAdminSosPhotoDataUrl = downloadAdminSosPhotoDataUrl;

async function loadAdminSosPhotos(alertId) {
    if (!alertId) return;
    const wrap = document.getElementById('adminSosCamPhotosWrap');
    const grid = document.getElementById('adminSosCamPhotosGrid');
    const countEl = document.getElementById('adminSosCamPhotosCount');
    if (!wrap || !grid) return;

    try {
        const res = await apiRequest(`/api/admin/emergency/sos/${encodeURIComponent(alertId)}/photos`);
        const photos = (res && res.photos) || [];
        if (countEl) countEl.innerText = `${photos.length} টি`;
        if (!photos.length) {
            wrap.classList.add('hidden');
            grid.innerHTML = '';
            return;
        }
        wrap.classList.remove('hidden');
        grid.innerHTML = '';
        photos.forEach((p, idx) => {
            const card = document.createElement('div');
            card.className = 'relative rounded-xl overflow-hidden border border-slate-700 bg-black flex flex-col';

            const img = document.createElement('img');
            img.src = p.photo_data;
            img.alt = `SOS Photo ${idx + 1}`;
            img.className = 'w-full h-20 object-contain bg-black cursor-pointer';
            img.onclick = () => {
                const w = window.open('', '_blank');
                if (w) {
                    w.document.write(`<title>SOS Captured Photo</title><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${p.photo_data}" style="max-width:100%;max-height:100vh;object-fit:contain;"></body>`);
                }
            };

            const bar = document.createElement('div');
            bar.className = 'px-1.5 py-1 bg-slate-800 flex items-center justify-between gap-1 text-[10px]';
            const who = document.createElement('span');
            who.className = 'text-slate-200 font-bold truncate';
            who.textContent = p.captured_by === 'admin' ? '🛡️ Admin' : '👤 Customer';

            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shrink-0';
            saveBtn.textContent = '⬇️ Save';
            saveBtn.onclick = () => downloadAdminSosPhotoDataUrl(p.photo_data, `BusYatra_SOS_${p.captured_by}_${idx + 1}.jpg`);

            bar.appendChild(who);
            bar.appendChild(saveBtn);
            card.appendChild(img);
            card.appendChild(bar);
            grid.appendChild(card);
        });
    } catch (_) {}
}

async function adminCaptureAndSaveSosPhoto() {
    if (!adminActiveSosCameraId) return;
    const vid = document.getElementById('adminSosCamVideo');
    const img = document.getElementById('adminSosCamImg');
    const btn = document.getElementById('btnAdminCaptureSosPhoto');

    let srcEl = null;
    let natW = 0;
    let natH = 0;
    if (vid && !vid.classList.contains('hidden') && vid.videoWidth > 0) {
        srcEl = vid; natW = vid.videoWidth; natH = vid.videoHeight;
    } else if (img && !img.classList.contains('hidden') && img.naturalWidth > 0) {
        srcEl = img; natW = img.naturalWidth; natH = img.naturalHeight;
    }
    if (!srcEl || !natW || !natH) {
        alert('এখনো লাইভ ক্যামেরা ফ্রেম আসেনি। অনুগ্রহ করে ১ সেকেন্ড অপেক্ষা করে আবার চেষ্টা করুন।');
        return;
    }

    const scale = Math.min(1, 1280 / Math.max(natW, natH));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(160, Math.round(natW * scale));
    canvas.height = Math.max(120, Math.round(natH * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(srcEl, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.90);

    const fname = `BusYatra_SOS_Admin_${Date.now()}.jpg`;
    downloadAdminSosPhotoDataUrl(dataUrl, fname);

    if (btn) { btn.disabled = true; btn.innerText = '💾 সেভ হচ্ছে...'; }
    try {
        await apiRequest(`/api/admin/emergency/sos/${encodeURIComponent(adminActiveSosCameraId)}/photos`, {
            method: 'POST',
            body: JSON.stringify({ photo: dataUrl })
        });
        await loadAdminSosPhotos(adminActiveSosCameraId);
        loadAdminSosAlerts(true);
    } catch (e) {
        alert(e.message || 'ছবি সেভ করতে সমস্যা হয়েছে।');
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = '📸 ছবি তুলুন ও সেভ'; }
    }
}
window.adminCaptureAndSaveSosPhoto = adminCaptureAndSaveSosPhoto;

async function setupAdminWebrtcReceiver(alertId, offerStr, offerIce, nonce) {
    if (typeof RTCPeerConnection === 'undefined' || !offerStr || !nonce || adminSosHandledNonce === nonce) return;
    teardownAdminSosWebrtc();
    adminSosHandledNonce = nonce;

    try {
        const pc = new RTCPeerConnection(ADMIN_SOS_RTC_CONFIG);
        adminSosWebrtcPc = pc;
        const gatheredIce = [];

        pc.onicecandidate = (ev) => {
            if (ev.candidate) gatheredIce.push(ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate);
        };
        pc.ontrack = (ev) => {
            const vid = document.getElementById('adminSosCamVideo');
            const img = document.getElementById('adminSosCamImg');
            const emptyState = document.getElementById('adminSosCamEmptyState');
            const statusBadge = document.getElementById('adminSosCamStatusBadge');
            if (vid && ev.streams && ev.streams[0]) {
                vid.srcObject = ev.streams[0];
                const showVid = () => {
                    adminSosVideoStreaming = true;
                    vid.classList.remove('hidden');
                    vid.style.display = 'block';
                    if (img) { img.classList.add('hidden'); img.style.display = 'none'; }
                    if (emptyState) emptyState.classList.add('hidden');
                    if (statusBadge) {
                        statusBadge.innerText = '🔴 HD LIVE VIDEO (30 FPS)';
                        statusBadge.className = 'text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white animate-pulse';
                    }
                };
                vid.onloadeddata = showVid;
                vid.play().then(showVid).catch(() => {});
            }
        };
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
                adminSosVideoStreaming = false;
                const vid = document.getElementById('adminSosCamVideo');
                if (vid) { vid.classList.add('hidden'); vid.style.display = 'none'; }
            }
        };

        const offerObj = JSON.parse(offerStr);
        await pc.setRemoteDescription(new RTCSessionDescription(offerObj));
        if (Array.isArray(offerIce)) {
            for (const c of offerIce) {
                try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (_) {}
            }
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await new Promise(resolve => {
            if (pc.iceGatheringState === 'complete') return resolve();
            const timer = setTimeout(resolve, 550);
            pc.addEventListener('icegatheringstatechange', () => {
                if (pc.iceGatheringState === 'complete') {
                    clearTimeout(timer);
                    resolve();
                }
            });
        });

        await apiRequest(`/api/admin/emergency/sos/${encodeURIComponent(alertId)}/webrtc-answer`, {
            method: 'POST',
            body: JSON.stringify({
                nonce,
                answer: JSON.stringify(pc.localDescription),
                ice: gatheredIce
            })
        });
    } catch (e) {
        console.warn('Admin WebRTC receiver fallback active:', e);
    }
}

async function pollAdminSosCameraFrame() {
    if (!adminActiveSosCameraId) return;
    const currentId = adminActiveSosCameraId;
    try {
        const res = await apiRequest(`/api/admin/emergency/sos/${encodeURIComponent(currentId)}/camera`);
        if (!res || !res.ok || adminActiveSosCameraId !== currentId) return;

        const alertBadge = document.getElementById('adminSosCamAlertBadge');
        const statusBadge = document.getElementById('adminSosCamStatusBadge');
        const passName = document.getElementById('adminSosCamPassengerName');
        const vid = document.getElementById('adminSosCamVideo');
        const img = document.getElementById('adminSosCamImg');
        const emptyState = document.getElementById('adminSosCamEmptyState');
        const emptyText = document.getElementById('adminSosCamEmptyText');
        const updatedAtEl = document.getElementById('adminSosCamUpdatedAt');
        const mapLink = document.getElementById('adminSosCamMapLink');

        if (alertBadge) alertBadge.innerText = res.alertNumber || '#SOS';
        if (passName) passName.innerText = `${res.customerName || 'Passenger'} (${res.customerPhone || ''})`;
        if (mapLink) {
            if (res.mapsUrl) {
                mapLink.href = res.mapsUrl;
                mapLink.classList.remove('hidden');
            } else {
                mapLink.classList.add('hidden');
            }
        }

        if (Number(res.photosCount || 0) !== adminSosLastPhotosCount) {
            adminSosLastPhotosCount = Number(res.photosCount || 0);
            loadAdminSosPhotos(currentId);
        }

        if (res.cameraActive && res.webrtcOffer && res.webrtcNonce && res.webrtcNonce !== adminSosHandledNonce) {
            setupAdminWebrtcReceiver(currentId, res.webrtcOffer, res.webrtcOfferIce || [], res.webrtcNonce);
        }

        const isWebrtcVisible = Boolean(adminSosVideoStreaming && vid && vid.videoWidth > 0);
        if (res.cameraActive && isWebrtcVisible) {
            if (emptyState) emptyState.classList.add('hidden');
            if (img) { img.classList.add('hidden'); img.style.display = 'none'; }
            if (updatedAtEl) updatedAtEl.innerText = '🟢 সরাসরি 30 FPS ভিডিও কল চালু রয়েছে';
        } else if (res.cameraActive && res.frame) {
            if (statusBadge) {
                statusBadge.innerText = '🔴 LIVE STREAM';
                statusBadge.className = 'text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white animate-pulse';
            }
            if (img) {
                img.src = res.frame;
                img.classList.remove('hidden');
                img.style.display = 'block';
            }
            if (emptyState) emptyState.classList.add('hidden');
            if (updatedAtEl) {
                const ts = res.cameraUpdatedAt ? new Date(res.cameraUpdatedAt).toLocaleTimeString('bn-IN') : 'এইমাত্র';
                updatedAtEl.innerText = `লাইভ আপডেট: ${ts}`;
            }
        } else if (res.cameraActive) {
            if (statusBadge) {
                statusBadge.innerText = '⏳ সংযোগ হচ্ছে';
                statusBadge.className = 'text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white';
            }
            if (img) { img.classList.add('hidden'); img.style.display = 'none'; }
            if (emptyState) emptyState.classList.remove('hidden');
            if (emptyText) emptyText.innerText = 'কাস্টমারের ক্যামেরা থেকে লাইভ ভিডিও সংযোগ হচ্ছে...';
        } else {
            teardownAdminSosWebrtc();
            if (statusBadge) {
                statusBadge.innerText = '⏹️ সেশন বন্ধ';
                statusBadge.className = 'text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-600 text-white';
            }
            if (img) { img.classList.add('hidden'); img.style.display = 'none'; img.src = ''; }
            if (emptyState) emptyState.classList.remove('hidden');
            if (emptyText) emptyText.innerText = Number(res.photosCount || 0) > 0
                ? 'লাইভ ক্যামেরা বন্ধ আছে। নিচে তোলা ছবিগুলো দেখতে ও সেভ করতে পারবেন।'
                : 'কাস্টমার ক্যামেরা বন্ধ করেছেন অথবা SOS সেশনটি শেষ হয়েছে।';
            if (updatedAtEl) updatedAtEl.innerText = 'ক্যামেরা ফিড বন্ধ আছে';
            loadAdminSosAlerts(true);
            return; // Stop tight loop cleanly when stream ended
        }
    } catch (err) {
        console.warn('Admin SOS camera poll error:', err);
    }

    // Sequential pipelined schedule (fast 450ms on fallback, light 1800ms once 30fps WebRTC is flowing)
    if (adminActiveSosCameraId === currentId) {
        adminSosCameraPollTimer = setTimeout(pollAdminSosCameraFrame, adminSosVideoStreaming ? 1800 : 450);
    }
}

async function openAdminSosCameraModal(alertId) {
    const modal = document.getElementById('adminSosLiveCameraModal');
    if (!modal || !alertId) return;
    if (adminSosCameraPollTimer) {
        clearTimeout(adminSosCameraPollTimer);
        adminSosCameraPollTimer = null;
    }
    teardownAdminSosWebrtc();
    adminActiveSosCameraId = alertId;
    adminSosLastPhotosCount = -1;

    const img = document.getElementById('adminSosCamImg');
    const emptyState = document.getElementById('adminSosCamEmptyState');
    const emptyText = document.getElementById('adminSosCamEmptyText');
    const grid = document.getElementById('adminSosCamPhotosGrid');
    const wrap = document.getElementById('adminSosCamPhotosWrap');
    if (img) { img.src = ''; img.classList.add('hidden'); img.style.display = 'none'; }
    if (grid) grid.innerHTML = '';
    if (wrap) wrap.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    if (emptyText) emptyText.innerText = 'কাস্টমারের লাইভ ভিডিও সংযোগ হচ্ছে...';

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // Ask broadcaster for fresh WebRTC handshake if stream is active, while fetching initial state/photos
    apiRequest(`/api/admin/emergency/sos/${encodeURIComponent(alertId)}/webrtc-reset`, { method: 'POST' }).catch(() => {});
    loadAdminSosPhotos(alertId);
    pollAdminSosCameraFrame();
}
window.openAdminSosCameraModal = openAdminSosCameraModal;

function closeAdminSosCameraModal() {
    if (adminSosCameraPollTimer) {
        clearTimeout(adminSosCameraPollTimer);
        adminSosCameraPollTimer = null;
    }
    teardownAdminSosWebrtc();
    adminActiveSosCameraId = null;
    const modal = document.getElementById('adminSosLiveCameraModal');
    const img = document.getElementById('adminSosCamImg');
    if (img) { img.src = ''; img.classList.add('hidden'); img.style.display = 'none'; }
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}
window.closeAdminSosCameraModal = closeAdminSosCameraModal;

async function adminStopSosCamera(alertId) {
    if (!alertId) return;
    try {
        await apiRequest(`/api/admin/emergency/sos/${encodeURIComponent(alertId)}/stop-camera`, { method: 'POST' });
        alert('⏹️ কাস্টমারের লাইভ ক্যামেরা সেশন বন্ধ করা হয়েছে।');
        closeAdminSosCameraModal();
        loadAdminSosAlerts();
    } catch (err) {
        alert(err.message || 'ক্যামেরা বন্ধ করতে সমস্যা হয়েছে।');
    }
}
window.adminStopSosCamera = adminStopSosCamera;

async function adminResolveFromCameraModal() {
    const targetId = adminActiveSosCameraId;
    if (!targetId) return;
    await resolveAdminSosAlert(targetId);
    closeAdminSosCameraModal();
}
window.adminResolveFromCameraModal = adminResolveFromCameraModal;






