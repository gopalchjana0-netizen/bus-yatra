// Bus Yatra - Bus Owner & Operator Portal Script
let ownerBuses = [];
let ownerAppData = null;

function exitAdminOwnerImpersonation() {
    localStorage.removeItem('owner_session');
    sessionStorage.removeItem('owner_session');
    localStorage.removeItem('portal_session_owner');
    sessionStorage.removeItem('portal_session_owner');
    if (window.opener && !window.opener.closed) {
        window.close();
    } else {
        window.location.href = 'admin.html';
    }
}
window.exitAdminOwnerImpersonation = exitAdminOwnerImpersonation;

window.addEventListener('DOMContentLoaded', async () => {
    initManifestDate();
    const savedOwnerPhone = localStorage.getItem('busyatra_owner_phone');
    const loginPhone = document.getElementById('ownerLoginPhone');
    if (loginPhone && savedOwnerPhone) loginPhone.value = savedOwnerPhone;
    const serviceDate = document.getElementById('serviceDateInput');
    if (serviceDate) {
        serviceDate.value = localDateStr();
        serviceDate.min = localDateStr();
        serviceDate.addEventListener('change', loadBusServiceDate);
    }

    // Check for Admin Impersonation URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('auth_token');
    const isAdmin = urlParams.get('admin') === '1';

    if (authToken) {
        // Instant visual transition: immediately hide login modal and reveal dashboard
        document.getElementById('ownerAuthModal')?.classList.add('hidden');
        document.getElementById('ownerProtectedApp')?.classList.remove('hidden');
        const preSession = getOwnerSession();
        const banner = document.getElementById('adminImpersonationBanner');
        const text = document.getElementById('adminImpersonationText');
        if (banner) banner.classList.remove('hidden');
        if (text && preSession?.owner) {
            text.innerText = `আপনি অ্যাডমিন হিসেবে "${preSession.owner.companyName || preSession.owner.name}" ওনার প্যানেলে রয়েছেন।`;
        }

        try {
            const meRes = await apiRequest('/api/owner/me', {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            if (meRes && meRes.ok && meRes.owner) {
                const session = {
                    token: authToken,
                    expiresAt: meRes.expiresAt,
                    owner: meRes.owner,
                    securityConfigured: true,
                    impersonatedByAdmin: isAdmin
                };
                localStorage.setItem('owner_session', JSON.stringify(session));
                sessionStorage.setItem('owner_session', JSON.stringify(session));
                localStorage.setItem('portal_session_owner', JSON.stringify({ token: authToken }));
                sessionStorage.setItem('portal_session_owner', JSON.stringify({ token: authToken }));
                // Security: Immediately erase sensitive auth_token from URL address bar
                window.history.replaceState({}, document.title, window.location.pathname);

                if (text) text.innerText = `আপনি অ্যাডমিন হিসেবে "${session.owner.companyName || session.owner.name}" ওনার প্যানেলে রয়েছেন।`;

                loadOwnerDashboard();
                startOwnerBookingRefresh();
                checkAndDisplayActivePromo('owner');
                return;
            }
        } catch (authErr) {
            console.error('Admin impersonation auth failed:', authErr);
        }
    }

    const session = getOwnerSession();
    if (session) {
        if (session.impersonatedByAdmin) {
            const banner = document.getElementById('adminImpersonationBanner');
            const text = document.getElementById('adminImpersonationText');
            if (banner) banner.classList.remove('hidden');
            if (text) text.innerText = `আপনি অ্যাডমিন হিসেবে "${session.owner?.companyName || session.owner?.name || 'বাস ওনার'}" ওনার প্যানেলে রয়েছেন।`;
        }
        if (session.securityConfigured === false) {
            showOwnerSetup();
        } else {
            document.getElementById('ownerAuthModal')?.classList.add('hidden');
            document.getElementById('ownerProtectedApp')?.classList.remove('hidden');
            loadOwnerDashboard();
            startOwnerBookingRefresh();
            checkAndDisplayActivePromo('owner');
        }
    } else {
        document.getElementById('ownerAuthModal')?.classList.remove('hidden');
        document.getElementById('ownerProtectedApp')?.classList.add('hidden');
        showOwnerLogin();
    }
});

let ownerLocationWatch = null;
let ownerLocationBusId = null;
let ownerTrackingMap = null;
let ownerTrackingMarker = null;
let ownerTrackingAccuracyCircle = null;
let ownerBookingRefreshInterval = null;

function startOwnerBookingRefresh() {
    if (!ownerBookingRefreshInterval) {
        ownerBookingRefreshInterval = window.setInterval(refreshOwnerBookingQueue, 15000);
    }
}

function refreshOwnerData() {
    loadOwnerDashboard();
    loadOwnerNotifications();
}

function toggleOwnerSidebar() {
    const sb = document.getElementById('ownerSidebarMenu');
    if (sb) sb.classList.toggle('hidden');
}

async function ownerLogout() {
    const ok = await showBusYatraConfirm({
        title: "বাস মালিক পোর্টাল থেকে লগআউট?",
        subtitle: "আপনি কি নিশ্চিতভাবে ওনার ড্যাশবোর্ড থেকে লগআউট করতে চান?",
        icon: '👑',
        confirmText: "হ্যাঁ, লগআউট",
        cancelText: "না, ফিরে যান",
        danger: true
    });
    if (!ok) return;

    if (ownerBookingRefreshInterval) clearInterval(ownerBookingRefreshInterval);
    ownerBookingRefreshInterval = null;
    const session = getOwnerSession();
    if (session?.token) {
        apiRequest('/api/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.token}` }
        }).catch(error => console.warn('Owner logout failed:', error));
    }
    localStorage.removeItem('owner_session');
    sessionStorage.removeItem('owner_session');
    localStorage.removeItem('portal_session_owner');
    sessionStorage.removeItem('portal_session_owner');
    document.getElementById('adminImpersonationBanner')?.classList.add('hidden');
    document.getElementById('ownerProtectedApp')?.classList.add('hidden');
    document.getElementById('ownerAuthModal')?.classList.remove('hidden');
    showOwnerLogin();
}

function getOwnerSession() {
    try {
        const raw = localStorage.getItem('owner_session') || sessionStorage.getItem('owner_session');
        if (!raw) return null;
        const session = JSON.parse(raw);
        if (session && session.token) {
            localStorage.setItem('owner_session', JSON.stringify(session));
            sessionStorage.setItem('owner_session', JSON.stringify(session));
            return session;
        }
        return null;
    } catch {
        return null;
    }
}

async function submitOwnerLogin() {
    const phone = document.getElementById('ownerLoginPhone').value.trim();
    const pin = document.getElementById('ownerLoginPin').value.trim();
    const errorEl = document.getElementById('ownerAuthError');
    if (!/^[6-9]\d{9}$/.test(phone) || !/^\d{4}$/.test(pin)) {
        errorEl.innerText = 'Enter a valid 10-digit mobile number and 4-digit PIN.';
        errorEl.classList.remove('hidden');
        return;
    }
    try {
        const result = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ role: 'owner', identifier: phone, pin })
        });
        const session = {
            token: result.token,
            expiresAt: result.expiresAt,
            owner: result.owner,
            securityConfigured: result.securityConfigured
        };
        localStorage.setItem('busyatra_owner_phone', phone);
        localStorage.setItem('owner_session', JSON.stringify(session));
        sessionStorage.setItem('owner_session', JSON.stringify(session));
        errorEl.classList.add('hidden');
        if (!result.securityConfigured) {
            showOwnerSetup();
            return;
        }
        document.getElementById('ownerAuthModal')?.classList.add('hidden');
        document.getElementById('ownerProtectedApp')?.classList.remove('hidden');
        loadOwnerDashboard();
        startOwnerBookingRefresh();
    } catch (error) {
        errorEl.innerText = error.message;
        errorEl.classList.remove('hidden');
    }
}

function showOwnerLogin() {
    document.getElementById('ownerLoginForm').classList.remove('hidden');
    document.getElementById('ownerRegisterForm').classList.add('hidden');
    document.getElementById('ownerSetupForm').classList.add('hidden');
    document.getElementById('ownerRecoveryForm').classList.add('hidden');
    document.getElementById('ownerAuthModal').classList.remove('hidden');
}

function showOwnerRegistration() {
    ['ownerLoginForm', 'ownerSetupForm', 'ownerRecoveryForm'].forEach(id =>
        document.getElementById(id).classList.add('hidden')
    );
    document.getElementById('ownerRegisterForm').classList.remove('hidden');
    const savedPhone = localStorage.getItem('busyatra_owner_phone');
    if (savedPhone) document.getElementById('ownerRegPhone').value = savedPhone;
    document.getElementById('ownerAuthModal').classList.remove('hidden');
}

async function sendOwnerRegisterOtp() {
    const email = (document.getElementById('ownerRegEmail')?.value || '').trim().toLowerCase();
    const errorEl = document.getElementById('ownerRegistrationError');
    if (errorEl) errorEl.classList.add('hidden');
    if (!email || !email.includes('@')) {
        if (errorEl) {
            errorEl.innerText = (typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('বৈধ ইমেইল ঠিকানা দিন।', 'Enter valid email address.') : 'Enter valid email address.';
            errorEl.classList.remove('hidden');
        } else {
            alert('Enter valid email address.');
        }
        return;
    }
    const btn = document.getElementById('btnOwnerRegSendOtp');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Sending...';
    }
    try {
        const res = await apiRequest('/api/owner/send-register-otp', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
        const otpInput = document.getElementById('ownerRegEmailOtp');
        if (otpInput) {
            otpInput.classList.remove('hidden');
            otpInput.focus();
        }
        alert(res.message || 'ওটিপি আপনার ইমেইলে পাঠানো হয়েছে!');
        startCooldown(btn, 'Send OTP');
    } catch (err) {
        if (errorEl) {
            errorEl.innerText = err.message || 'OTP পাঠাতে ব্যর্থ হয়েছে।';
            errorEl.classList.remove('hidden');
        } else {
            alert(err.message || 'Failed to send OTP.');
        }
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Send OTP';
        }
    }
}
window.sendOwnerRegisterOtp = sendOwnerRegisterOtp;

async function submitOwnerRegistration() {
    const errorEl = document.getElementById('ownerRegistrationError');
    const email = (document.getElementById('ownerRegEmail')?.value || '').trim().toLowerCase();
    const otp = (document.getElementById('ownerRegEmailOtp')?.value || '').trim();

    if (!email || !email.includes('@')) {
        errorEl.innerText = (typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('বৈধ ইমেইল ঠিকানা দিন।', 'Enter valid email address.') : 'Enter valid email address.';
        errorEl.classList.remove('hidden');
        return;
    }
    if (!otp || otp.length !== 6) {
        errorEl.innerText = 'ইমেইলে পাঠানো ৬-সংখ্যার ওটিপি কোড দিন (Enter 6-digit Email OTP).';
        errorEl.classList.remove('hidden');
        return;
    }

    const file = document.getElementById('ownerRegLicense').files[0];
    if (!file) {
        errorEl.innerText = 'Upload the bus licence file.';
        errorEl.classList.remove('hidden');
        return;
    }
    if (file.size < 1 || file.size > 1024 * 1024) {
        errorEl.innerText = 'The licence file must be no larger than 1 MiB.';
        errorEl.classList.remove('hidden');
        return;
    }

    const licenseMimeType = file.type || (
        /\.pdf$/i.test(file.name) ? 'application/pdf' :
            /\.(jpe?g)$/i.test(file.name) ? 'image/jpeg' :
                /\.png$/i.test(file.name) ? 'image/png' : ''
    );
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(licenseMimeType)) {
        errorEl.innerText = 'Choose a PDF, JPEG, or PNG licence file.';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        const licenseData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Could not read the selected licence file.'));
            reader.readAsDataURL(file);
        });
        await apiRequest('/api/auth/owner/register', {
            method: 'POST',
            body: JSON.stringify({
                companyName: document.getElementById('ownerRegCompany').value.trim(),
                ownerName: document.getElementById('ownerRegName').value.trim(),
                phone: document.getElementById('ownerRegPhone').value.trim(),
                email,
                otp,
                busNumber: document.getElementById('ownerRegBusNumber').value.trim(),
                licenseFileName: file.name,
                licenseMimeType,
                licenseData,
                routeStops: document.getElementById('ownerRegRouteStops').value.trim(),
                departureTime: document.getElementById('ownerRegDepartureTime').value,
                fare: Number(document.getElementById('ownerRegFare').value),
                pin: document.getElementById('ownerRegPin').value.trim(),
                securityQuestion: document.getElementById('ownerRegQuestion').value.trim(),
                securityAnswer: document.getElementById('ownerRegAnswer').value.trim()
            })
        });
        const phone = document.getElementById('ownerRegPhone').value.trim();
        localStorage.setItem('busyatra_owner_phone', phone);
        showOwnerLogin();
        document.getElementById('ownerLoginPhone').value = phone;
        document.getElementById('ownerAuthError').innerText = 'Registration request submitted. Sign in after admin approval.';
        document.getElementById('ownerAuthError').classList.remove('hidden');
        alert('Your owner registration request has been sent to the administrator for approval.');
    } catch (error) {
        errorEl.innerText = error.message || 'Could not submit owner registration.';
        errorEl.classList.remove('hidden');
    }
}

function showOwnerSetup() {
    document.getElementById('ownerLoginForm').classList.add('hidden');
    document.getElementById('ownerRegisterForm').classList.add('hidden');
    document.getElementById('ownerRecoveryForm').classList.add('hidden');
    document.getElementById('ownerSetupForm').classList.remove('hidden');
    document.getElementById('ownerAuthModal').classList.remove('hidden');
}

function showOwnerRecovery() {
    document.getElementById('ownerRecoveryPhone').value =
        document.getElementById('ownerLoginPhone').value.trim();
    document.getElementById('ownerLoginForm').classList.add('hidden');
    document.getElementById('ownerRegisterForm').classList.add('hidden');
    document.getElementById('ownerSetupForm').classList.add('hidden');
    document.getElementById('ownerRecoveryForm').classList.remove('hidden');
    document.getElementById('ownerAuthModal').classList.remove('hidden');
}

async function submitOwnerSetup() {
    const pin = document.getElementById('ownerSetupPin').value.trim();
    const confirmation = document.getElementById('ownerSetupPinConfirm').value.trim();
    const securityQuestion = document.getElementById('ownerSetupQuestion').value.trim();
    const securityAnswer = document.getElementById('ownerSetupAnswer').value.trim();
    const errorEl = document.getElementById('ownerSetupError');
    if (!/^\d{4}$/.test(pin) || pin !== confirmation ||
        securityQuestion.length < 5 || securityAnswer.length < 3) {
        errorEl.innerText = 'Enter and confirm a 4-digit PIN, a recovery question, and an answer.';
        errorEl.classList.remove('hidden');
        return;
    }
    try {
        const result = await apiRequest('/api/auth/owner/setup', {
            method: 'POST',
            body: JSON.stringify({ pin, securityQuestion, securityAnswer })
        });
        const session = getOwnerSession();
        const updatedSession = {
            ...session,
            token: result.token,
            expiresAt: result.expiresAt,
            securityConfigured: true
        };
        localStorage.setItem('owner_session', JSON.stringify(updatedSession));
        sessionStorage.setItem('owner_session', JSON.stringify(updatedSession));
        errorEl.classList.add('hidden');
        document.getElementById('ownerAuthModal').classList.add('hidden');
        loadOwnerDashboard();
        startOwnerBookingRefresh();
    } catch (error) {
        errorEl.innerText = error.message;
        errorEl.classList.remove('hidden');
    }
}

async function loadOwnerSecurityQuestion() {
    const phone = document.getElementById('ownerRecoveryPhone').value.trim();
    const errorEl = document.getElementById('ownerRecoveryError');
    if (!/^[6-9]\d{9}$/.test(phone)) {
        errorEl.innerText = 'Enter a valid 10-digit mobile number.';
        errorEl.classList.remove('hidden');
        return;
    }
    try {
        const result = await apiRequest(`/api/auth/owner/security-question?phone=${encodeURIComponent(phone)}`);
        document.getElementById('ownerRecoveryQuestion').innerText = result.question;
        document.getElementById('ownerRecoveryQuestion').classList.remove('hidden');
        document.getElementById('ownerRecoveryAnswer').classList.remove('hidden');
        document.getElementById('ownerRecoveryPin').classList.remove('hidden');
        document.getElementById('ownerResetPinButton').classList.remove('hidden');
        errorEl.classList.add('hidden');
    } catch (error) {
        errorEl.innerText = error.message;
        errorEl.classList.remove('hidden');
    }
}

async function resetOwnerPin() {
    const phone = document.getElementById('ownerRecoveryPhone').value.trim();
    const answer = document.getElementById('ownerRecoveryAnswer').value.trim();
    const pin = document.getElementById('ownerRecoveryPin').value.trim();
    const errorEl = document.getElementById('ownerRecoveryError');
    if (!answer || !/^\d{4}$/.test(pin)) {
        errorEl.innerText = 'Enter the recovery answer and a new 4-digit PIN.';
        errorEl.classList.remove('hidden');
        return;
    }
    try {
        await apiRequest('/api/auth/owner/reset', {
            method: 'POST',
            body: JSON.stringify({ phone, answer, pin })
        });
        showOwnerLogin();
        document.getElementById('ownerLoginPhone').value = phone;
        document.getElementById('ownerLoginPin').value = pin;
        document.getElementById('ownerAuthError').innerText = 'PIN reset. Sign in with your new PIN.';
        document.getElementById('ownerAuthError').classList.remove('hidden');
    } catch (error) {
        errorEl.innerText = error.message;
        errorEl.classList.remove('hidden');
    }
}

function switchOwnerRecoveryTab(tab) {
    const isQ = tab === 'question';
    document.getElementById('ownerRecoveryQuestionSection')?.classList.toggle('hidden', !isQ);
    document.getElementById('ownerRecoveryOtpSection')?.classList.toggle('hidden', isQ);
    const btnQ = document.getElementById('ownerTabQuestion');
    const btnO = document.getElementById('ownerTabOtp');
    if (btnQ && btnO) {
        if (isQ) {
            btnQ.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold bg-white text-gray-900 shadow-sm transition';
            btnO.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:text-gray-900 transition';
        } else {
            btnO.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold bg-white text-gray-900 shadow-sm transition';
            btnQ.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:text-gray-900 transition';
        }
    }
    document.getElementById('ownerRecoveryError')?.classList.add('hidden');
    document.getElementById('ownerRecoverySuccess')?.classList.add('hidden');
}
window.switchOwnerRecoveryTab = switchOwnerRecoveryTab;

async function requestOwnerResetOtp() {
    const email = (document.getElementById('ownerOtpEmail')?.value || '').trim().toLowerCase();
    const phone = (document.getElementById('ownerOtpPhone')?.value || '').trim();
    const errorEl = document.getElementById('ownerRecoveryError');
    const successEl = document.getElementById('ownerRecoverySuccess');
    if (errorEl) errorEl.classList.add('hidden');
    if (successEl) successEl.classList.add('hidden');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        if (errorEl) {
            errorEl.innerText = 'বাস রেজিস্ট্রেশনের সঠিক নিবন্ধিত ইমেইল আইডি লিখুন (Enter a valid registered email).';
            errorEl.classList.remove('hidden');
        }
        return;
    }

    const btn = document.getElementById('ownerSendOtpBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Sending...';
    }
    try {
        const res = await apiRequest('/api/owner/send-reset-otp', {
            method: 'POST',
            body: JSON.stringify({ email, phone })
        });
        if (successEl) {
            successEl.innerText = res.message || 'ব্রেভো (Brevo) থেকে ৬-সংখ্যার ওটিপি আপনার রেজিস্টার্ড ইমেইলে পাঠানো হয়েছে!';
            successEl.classList.remove('hidden');
        }
        document.getElementById('ownerResetOtp')?.focus();
        startCooldown(btn, 'Send OTP');
    } catch (err) {
        if (errorEl) {
            errorEl.innerText = err.message || 'ওটিপি পাঠাতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
            errorEl.classList.remove('hidden');
        }
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Send OTP';
        }
    }
}

async function submitOwnerResetByOtp() {
    const email = (document.getElementById('ownerOtpEmail')?.value || '').trim().toLowerCase();
    const phone = (document.getElementById('ownerOtpPhone')?.value || '').trim();
    const otp = (document.getElementById('ownerResetOtp')?.value || '').trim();
    const pin = (document.getElementById('ownerResetOtpPin')?.value || '').trim();
    const errorEl = document.getElementById('ownerRecoveryError');
    const successEl = document.getElementById('ownerRecoverySuccess');
    if (errorEl) errorEl.classList.add('hidden');
    if (successEl) successEl.classList.add('hidden');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        if (errorEl) {
            errorEl.innerText = 'বাস রেজিস্ট্রেশনের সঠিক নিবন্ধিত ইমেইল আইডি লিখুন (Enter valid registered email).';
            errorEl.classList.remove('hidden');
        }
        return;
    }

    if (!otp || otp.length !== 6) {
        if (errorEl) {
            errorEl.innerText = 'ইমেইলে পাঠানো ৬-সংখ্যার ওটিপি কোড দিন (Enter 6-digit OTP).';
            errorEl.classList.remove('hidden');
        }
        return;
    }

    if (!/^\d{4}$/.test(pin)) {
        if (errorEl) {
            errorEl.innerText = 'নতুন ৪-সংখ্যার পিন দিন (Enter new 4-digit PIN).';
            errorEl.classList.remove('hidden');
        }
        return;
    }

    const btn = document.getElementById('ownerResetByOtpBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'ভেরিফাই হচ্ছে...';
    }

    try {
        const res = await apiRequest('/api/owner/reset-by-otp', {
            method: 'POST',
            body: JSON.stringify({ email, phone, otp, pin })
        });

        // "tar por 6 digit otp dile 4 digit pin dilei open hobe atai hobe"
        // Instant login to dashboard if session token returned
        if (res && res.token) {
            const session = {
                token: res.token,
                expiresAt: res.expiresAt,
                owner: res.owner,
                securityConfigured: true
            };
            if (res.owner?.phone) {
                localStorage.setItem('busyatra_owner_phone', res.owner.phone);
            }
            localStorage.setItem('owner_session', JSON.stringify(session));
            sessionStorage.setItem('owner_session', JSON.stringify(session));
            localStorage.setItem('portal_session_owner', JSON.stringify({ token: res.token }));
            sessionStorage.setItem('portal_session_owner', JSON.stringify({ token: res.token }));

            document.getElementById('ownerAuthModal')?.classList.add('hidden');
            document.getElementById('ownerProtectedApp')?.classList.remove('hidden');
            loadOwnerDashboard();
            startOwnerBookingRefresh();
            if (typeof checkAndDisplayActivePromo === 'function') {
                checkAndDisplayActivePromo('owner');
            }
            return;
        }

        // Fallback: If no token returned, prefill login
        showOwnerLogin();
        if (res?.owner?.phone) {
            const phoneInput = document.getElementById('ownerLoginPhone');
            if (phoneInput) phoneInput.value = res.owner.phone;
        }
        const pinInput = document.getElementById('ownerLoginPin');
        if (pinInput) pinInput.value = pin;
        const authErr = document.getElementById('ownerAuthError');
        if (authErr) {
            authErr.innerText = '✅ পিন রিসেট সফল! নতুন পিন দিয়ে লগইন করুন।';
            authErr.classList.remove('hidden');
        }
    } catch (err) {
        if (errorEl) {
            errorEl.innerText = err.message || 'পিন রিসেট ব্যর্থ হয়েছে। আবার চেষ্টা করুন।';
            errorEl.classList.remove('hidden');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Verify OTP & Reset PIN';
        }
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

async function loadOwnerDashboard() {
    // 0. Instant Optimistic Render from cached local data (< 5ms on slow 2G/3G)
    const cachedData = getAppData();
    if (cachedData && (cachedData.buses?.length || cachedData.bookings?.length)) {
        try {
            loadOwnerBuses();
            renderOwnerApprovals();
            renderPassengerManifest();
            loadOwnerReviews();
        } catch (_) {}
    }

    try {
        const data = await apiRequest('/api/owner/state');
        ownerAppData = data;
        ownerBuses = data.buses || [];
        setAppData(data);
        applyOwnerFeatures(data.features);

        // 1. Check Suspension / Block Status
        if (data.isSuspended || (data.accessControl && data.accessControl.status !== 'active')) {
            showOwnerSuspendedScreen(data.accessControl?.reason);
        } else {
            hideOwnerSuspendedScreen();
        }

        // 2. Check Active Subscription Due & Start Live Countdown
        if (data.subscription && data.subscription.status === 'pending') {
            showOwnerSubscriptionDue(data.subscription);
        } else {
            hideOwnerSubscriptionDue();
        }

        // 3. Update Sub-Banner Info
        const ownerSession = getOwnerSession();
        const firstBus = (data.buses || [])[0];
        const ownerNameEl = document.getElementById('ownerSubBannerName');
        const ownerCompanyEl = document.getElementById('ownerSubBannerCompany');
        const ownerFleetEl = document.getElementById('ownerSubBannerFleetBadge');
        if (ownerNameEl) ownerNameEl.innerText = firstBus?.owner_name || ownerSession?.phone || 'বাস মালিক';
        if (ownerCompanyEl) ownerCompanyEl.innerText = firstBus?.name || 'Bus Yatra Fleet';
        if (ownerFleetEl) {
            const busCount = (data.buses || []).length;
            ownerFleetEl.innerText = `${busCount}টি সক্রিয় বাস`;
        }

        loadOwnerBuses();
        renderOwnerApprovals();
        renderPassengerManifest();
        loadOwnerReviews();

        // Restore active tab across page refresh / reload
        const savedOwnerTab = sessionStorage.getItem('owner_active_tab') || (window.location.hash ? window.location.hash.replace('#', '') : null);
        if (savedOwnerTab && ['approvals', 'settings', 'captains', 'manifest', 'ledger', 'reviews', 'notifications'].includes(savedOwnerTab)) {
            switchOwnerTab(savedOwnerTab);
        }
    } catch (error) {
        if (error.status === 401) {
            localStorage.removeItem('owner_session');
            sessionStorage.removeItem('owner_session');
            if (ownerBookingRefreshInterval) clearInterval(ownerBookingRefreshInterval);
            ownerBookingRefreshInterval = null;
            document.getElementById('ownerAuthModal').classList.remove('hidden');
            return;
        }
        if (error.status === 403) {
            if (error.message && (error.message.includes('স্থগিত') || error.message.includes('নিষিদ্ধ') || error.message.includes('Suspended') || error.message.includes('Banned'))) {
                showOwnerSuspendedScreen(error.message);
                return;
            }
            if (getOwnerSession()?.securityConfigured !== true) {
                if (ownerBookingRefreshInterval) clearInterval(ownerBookingRefreshInterval);
                ownerBookingRefreshInterval = null;
                const session = getOwnerSession();
                if (session) {
                    session.securityConfigured = false;
                    sessionStorage.setItem('owner_session', JSON.stringify(session));
                }
                showOwnerSetup();
                return;
            }
        }
        console.error('Failed to load owner dashboard:', error);
        const container = document.getElementById('ownerBookingsList');
        if (container) {
            container.innerHTML = `<div class="p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                Failed to sync with server: ${escapeHtml(error.message)}. Please check your internet connection or refresh.
            </div>`;
        }
    }
}

function applyOwnerFeatures(features = {}) {
    window.ownerFeatures = {
        auto_pilot: true,
        notifications: true,
        captains: true,
        finance: true,
        live_tracking: true,
        edit_bus: true,
        parcel_booking: true,
        monthly_pass: true,
        dynamic_ai_pricing: true,
        instant_payout: true,
        cargo_tracking: true,
        driver_safety_score: true,
        ...features
    };
    const f = window.ownerFeatures;

    // Auto-pilot
    const bookingModeSection = document.getElementById('ownerBookingModeSection');
    if (bookingModeSection) {
        bookingModeSection.style.display = f.auto_pilot !== false ? 'block' : 'none';
    }

    // Notifications
    const notifBtn = document.getElementById('tabNotificationsBtn');
    const notifContent = document.getElementById('tabNotificationsContent');
    const notifHeader = document.getElementById('ownerHeaderNotifBadge')?.closest('button');
    const notifSidebar = document.getElementById('ownerSidebarNotifBadge')?.closest('button');
    if (notifBtn) notifBtn.style.display = f.notifications !== false ? '' : 'none';
    if (notifContent && f.notifications === false) notifContent.classList.add('hidden');
    if (notifHeader) notifHeader.style.display = f.notifications !== false ? '' : 'none';
    if (notifSidebar) notifSidebar.style.display = f.notifications !== false ? '' : 'none';

    // Captains
    const captainsBtn = document.getElementById('tabCaptainsBtn');
    const captainsContent = document.getElementById('tabCaptainsContent');
    const captainsSidebar = document.querySelector('button[onclick*="captains"]');
    if (captainsBtn) captainsBtn.style.display = f.captains !== false ? '' : 'none';
    if (captainsContent && f.captains === false) captainsContent.classList.add('hidden');
    if (captainsSidebar) captainsSidebar.style.display = f.captains !== false ? '' : 'none';

    // Finance / Manifest & Daily Ledger
    const manifestBtn = document.getElementById('tabManifestBtn');
    const manifestContent = document.getElementById('tabManifestContent');
    const manifestSidebar = document.querySelector('button[onclick*="manifest"]');
    const ledgerBtn = document.getElementById('tabLedgerBtn');
    const ledgerContent = document.getElementById('tabLedgerContent');
    const ledgerSidebar = document.querySelector('button[onclick*="ledger"]');
    if (manifestBtn) manifestBtn.style.display = f.finance !== false ? '' : 'none';
    if (manifestContent && f.finance === false) manifestContent.classList.add('hidden');
    if (manifestSidebar) manifestSidebar.style.display = f.finance !== false ? '' : 'none';
    if (ledgerBtn) ledgerBtn.style.display = f.finance !== false ? '' : 'none';
    if (ledgerContent && f.finance === false) ledgerContent.classList.add('hidden');
    if (ledgerSidebar) ledgerSidebar.style.display = f.finance !== false ? '' : 'none';

    // Live Tracking
    const trackingSection = document.getElementById('shareLocationButton')?.closest('div.pt-5');
    if (trackingSection) {
        trackingSection.style.display = f.live_tracking !== false ? '' : 'none';
    }

    // Edit Bus Fleet / Add Bus / Fare Settings
    const addBusBtn = document.querySelector('button[onclick="openAddBusModal()"]');
    if (addBusBtn) {
        addBusBtn.style.display = f.edit_bus !== false ? '' : 'none';
    }
    const settingsBtn = document.getElementById('tabSettingsBtn');
    const settingsContent = document.getElementById('tabSettingsContent');
    if (settingsBtn) settingsBtn.style.display = f.edit_bus !== false ? '' : 'none';
    if (settingsContent && f.edit_bus === false) settingsContent.classList.add('hidden');

    // Parcel & Luggage Booking
    const parcelSection = document.getElementById('ownerParcelSection');
    if (parcelSection) {
        parcelSection.style.display = f.parcel_booking !== false ? '' : 'none';
    }

    // Monthly Commuter Pass
    const monthlySection = document.getElementById('ownerMonthlyPassSection');
    if (monthlySection) {
        monthlySection.style.display = f.monthly_pass !== false ? '' : 'none';
    }

    // Dynamic AI Pricing Section
    const aiPricingSection = document.getElementById('ownerAiPricingSection');
    if (aiPricingSection) {
        aiPricingSection.style.display = f.dynamic_ai_pricing !== false ? '' : 'none';
    }

    // Instant Daily Payout Section
    const instantPayoutSection = document.getElementById('ownerInstantPayoutSection');
    if (instantPayoutSection) {
        instantPayoutSection.style.display = f.instant_payout !== false ? '' : 'none';
    }

    // Cargo Logistics Section
    const cargoSection = document.getElementById('ownerCargoSection');
    if (cargoSection) {
        cargoSection.style.display = f.cargo_tracking !== false ? '' : 'none';
    }

    // Driver Safety Score Section
    const safetyScoreSection = document.getElementById('ownerSafetyScoreSection');
    if (safetyScoreSection) {
        safetyScoreSection.style.display = f.driver_safety_score !== false ? '' : 'none';
    }
}
window.applyOwnerFeatures = applyOwnerFeatures;

async function refreshOwnerBookingQueue() {
    try {
        const data = await apiRequest('/api/owner/state');
        setAppData(data);
        renderOwnerApprovals();
    } catch (error) {
        if (error.status === 401) {
            localStorage.removeItem('owner_session');
            sessionStorage.removeItem('owner_session');
            if (ownerBookingRefreshInterval) clearInterval(ownerBookingRefreshInterval);
            ownerBookingRefreshInterval = null;
            document.getElementById('ownerAuthModal').classList.remove('hidden');
            return;
        }
        if (error.status === 403 && getOwnerSession()?.securityConfigured !== true) {
            if (ownerBookingRefreshInterval) clearInterval(ownerBookingRefreshInterval);
            ownerBookingRefreshInterval = null;
            const session = getOwnerSession();
            if (session) {
                session.securityConfigured = false;
                sessionStorage.setItem('owner_session', JSON.stringify(session));
            }
            showOwnerSetup();
            return;
        }
        console.warn('Owner booking queue refresh failed:', error);
    }
}

// --- Tabs Navigation ---
function switchOwnerTab(tab) {
    sessionStorage.setItem('owner_active_tab', tab);
    const tabs = ['approvals', 'settings', 'captains', 'manifest', 'ledger', 'reviews', 'notifications'];
    tabs.forEach(t => {
        const content = document.getElementById(`tab${capitalize(t)}Content`);
        const btn = document.getElementById(`tab${capitalize(t)}Btn`);
        if (content) content.classList.add('hidden');
        if (btn) btn.className = "flex-1 min-w-[105px] sm:min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 bg-transparent transition-all whitespace-nowrap text-center flex items-center justify-center gap-1.5 cursor-pointer";
    });

    const activeContent = document.getElementById(`tab${capitalize(tab)}Content`);
    const activeBtn = document.getElementById(`tab${capitalize(tab)}Btn`);
    if (activeContent) activeContent.classList.remove('hidden');
    if (activeBtn) activeBtn.className = "flex-1 min-w-[105px] sm:min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-black bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-md shadow-gray-900/20 transition-all whitespace-nowrap text-center flex items-center justify-center gap-1.5 cursor-pointer";

    if (tab === 'approvals') renderOwnerApprovals();
    if (tab === 'settings') loadOwnerBuses();
    if (tab === 'captains') loadOwnerCaptains();
    if (tab === 'manifest') renderPassengerManifest();
    if (tab === 'ledger') initOwnerTripLedger();
    if (tab === 'reviews') loadOwnerReviews();
    if (tab === 'notifications') loadOwnerNotifications();
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Tab 1: Booking Approvals ---
// --- Owner Booking Approvals, Date Filters & Select-All Bulk Delete ---
let selectedOwnerBookings = new Set();

function clearOwnerDateFilter() {
    const input = document.getElementById('ownerBookingDateFilter');
    if (input) input.value = '';
    renderOwnerApprovals();
}

function toggleOwnerSelectAll(checked) {
    selectedOwnerBookings.clear();
    const checkboxes = document.querySelectorAll('.owner-booking-cb');
    checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked && cb.dataset.id) {
            selectedOwnerBookings.add(cb.dataset.id);
        }
    });
    updateOwnerSelectionToolbar();
}

function handleOwnerBookingCheckChange(checkbox) {
    if (!checkbox || !checkbox.dataset.id) return;
    if (checkbox.checked) {
        selectedOwnerBookings.add(checkbox.dataset.id);
    } else {
        selectedOwnerBookings.delete(checkbox.dataset.id);
    }
    const allCbs = document.querySelectorAll('.owner-booking-cb');
    const selectAll = document.getElementById('ownerSelectAllCheckbox');
    if (selectAll) {
        selectAll.checked = allCbs.length > 0 && selectedOwnerBookings.size === allCbs.length;
    }
    updateOwnerSelectionToolbar();
}

function updateOwnerSelectionToolbar() {
    const btn = document.getElementById('btnOwnerBulkDelete');
    const badge = document.getElementById('ownerSelectedCountBadge');
    const count = selectedOwnerBookings.size;

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

async function ownerDeleteSingleBooking(bookingId) {
    const ok = await showBusYatraConfirm({ title: "বুকিং মুছে ফেলা", subtitle: `Are you sure you want to permanently delete booking #${bookingId}?`, icon: "🗑️", confirmText: "হ্যাঁ, ডিলিট করুন", cancelText: "বাতিল", danger: true }); if (!ok) return;
    try {
        await apiRequest(`/api/owner/bookings/${encodeURIComponent(bookingId)}`, {
            method: 'DELETE'
        });
        selectedOwnerBookings.delete(bookingId);
        await loadOwnerDashboard();
        alert(`✅ Booking #${bookingId} has been deleted successfully.`);
    } catch (err) {
        alert(err.message || 'Failed to delete booking.');
    }
}

async function deleteOwnerSelectedBookings() {
    const ids = Array.from(selectedOwnerBookings);
    if (!ids.length) {
        alert('Please select at least one booking to delete.');
        return;
    }
    const ok = await showBusYatraConfirm({ title: "নির্বাচিত বুকিং ডিলিট", subtitle: `Are you sure you want to delete ${ids.length} selected booking(s)?`, icon: "🗑️", confirmText: "হ্যাঁ, সব ডিলিট করুন", cancelText: "বাতিল", danger: true }); if (!ok) {
        return;
    }
    try {
        const res = await apiRequest('/api/owner/bookings/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ bookingIds: ids })
        });
        selectedOwnerBookings.clear();
        await loadOwnerDashboard();
        alert(`✅ ${res.deleted || ids.length} booking(s) deleted successfully.`);
    } catch (err) {
        alert(err.message || 'Failed to delete selected bookings.');
    }
}

async function deleteOwnerAllOnDate() {
    const dateInput = document.getElementById('ownerBookingDateFilter');
    const dateVal = dateInput?.value;
    if (!dateVal) {
        alert('Please select a date first to delete bookings for that date.');
        dateInput?.focus();
        return;
    }
    const ok = await showBusYatraConfirm({ title: "তারিখ অনুযায়ী বুকিং ডিলিট", subtitle: `WARNING: Are you sure you want to delete ALL booking records for ${dateVal}?`, icon: "🗑️", confirmText: "হ্যাঁ, ডিলিট করুন", cancelText: "বাতিল", danger: true }); if (!ok) return;
    try {
        const res = await apiRequest('/api/owner/bookings/bulk-delete', {
            method: 'POST',
            body: JSON.stringify({ date: dateVal })
        });
        selectedOwnerBookings.clear();
        await loadOwnerDashboard();
        alert(`✅ All bookings for ${dateVal} (${res.deleted || 0}) have been deleted.`);
    } catch (err) {
        alert(err.message || 'Failed to delete bookings for selected date.');
    }
}

function renderOwnerApprovals() {
    const db = getAppData();
    const container = document.getElementById('ownerBookingsList');
    if (!container) return;

    const filter = document.getElementById('bookingFilterStatus')?.value || 'Pending Approval';
    const dateFilter = document.getElementById('ownerBookingDateFilter')?.value || '';
    let bookings = Object.values(db.bookings || {});

    if (dateFilter) {
        bookings = bookings.filter(b => b.date === dateFilter);
    }
    if (filter !== 'ALL') {
        bookings = bookings.filter(b => b.status === filter);
    }

    // Sort by journey date desc
    bookings.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));

    container.innerHTML = "";

    // Reset select all
    const selectAll = document.getElementById('ownerSelectAllCheckbox');
    if (selectAll) selectAll.checked = false;
    selectedOwnerBookings.clear();
    updateOwnerSelectionToolbar();

    if (bookings.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-10 text-xs">
            No booking requests matching status "${escapeHtml(filter)}"${dateFilter ? ' on ' + escapeHtml(dateFilter) : ''}.
        </div>`;
        return;
    }

    bookings.forEach(b => {
        const isApproved = b.status === "Approved";
        const isRejected = b.status === "Rejected";
        const isCancelled = b.status === "Cancelled";
        const isCancelReq = b.status === "Cancellation Requested";
        const utr = (b.utrNumber && b.utrNumber !== 'N/A') ? b.utrNumber : ((b.upiTransactionId && b.upiTransactionId !== 'N/A') ? b.upiTransactionId : '');

        container.innerHTML += `
            <div class="bg-gray-50 hover:bg-gray-100/80 p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs transition">
                <div class="flex items-start gap-3 flex-1 min-w-0">
                    <input type="checkbox" data-id="${escapeHtml(b.id)}" onchange="handleOwnerBookingCheckChange(this)" class="owner-booking-cb w-4 h-4 mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0">
                    <div class="space-y-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-bold text-gray-900 text-sm">${escapeHtml(b.passengerName)}</span>
                            <a href="tel:${escapeHtml(b.passengerPhone)}" class="text-blue-600 font-semibold hover:underline">📞 ${escapeHtml(b.passengerPhone)}</a>
                            <a href="https://wa.me/91${escapeHtml(b.passengerPhone)}" target="_blank" class="text-green-600 font-semibold hover:underline">💬 WhatsApp</a>
                        </div>
                        <div>
                            <strong>Bus:</strong> ${escapeHtml(b.busName)} (${escapeHtml(b.busNumber)}) • 
                            <strong>Seats:</strong> <span class="bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">${escapeHtml((b.seats || []).join(', '))}</span>
                        </div>
                        <div>
                            <strong>Route:</strong> ${escapeHtml(b.boarding)} ➔ ${escapeHtml(b.dropping)} • 
                            <strong>Date:</strong> <span class="font-semibold text-gray-800">${escapeHtml(b.date)}</span>
                        </div>
                        <div class="text-gray-600">
                            <strong>Fare:</strong> ₹${b.fare} • 
                            <strong>Mode:</strong> <span class="font-semibold">${escapeHtml(b.paymentMode)}</span>
                            ${utr ? ` • UTR: <span class="font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">${escapeHtml(utr)}</span>` : ''}
                            • ID: <span class="font-mono text-gray-500">${escapeHtml(b.id)}</span>
                        </div>
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
                                <strong>⚠️ ${(typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('বাতিলের কারণ:', 'Cancellation Reason:') : 'Cancellation Reason:'}</strong> ${escapeHtml(b.cancelReason)}
                            </div>
                        ` : ''}
                        ${isCancelled ? `
                            <div class="mt-1 flex items-center gap-2 flex-wrap">
                                ${b.refundStatus === 'processing' ? `
                                    <span class="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[11px] border border-amber-300">
                                        ⏳ ${(typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('রিফান্ড প্রক্রিয়াধীন:', 'Refund Processing:') : 'Refund Processing:'} ₹${b.refundAmount || 0}
                                    </span>
                                ` : b.refundStatus === 'completed' ? `
                                    <span class="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded text-[11px] border border-emerald-300">
                                        ✅ ${(typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('রিফান্ড সম্পন্ন:', 'Refund Paid:') : 'Refund Paid:'} ₹${b.refundAmount || 0}
                                    </span>
                                ` : `
                                    <span class="bg-gray-100 text-gray-700 font-medium px-2 py-0.5 rounded text-[11px]">
                                        ${(typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('কোনো রিফান্ড নেই', 'No Refund') : 'No Refund'}
                                    </span>
                                `}
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0">
                    <span class="px-3 py-1 rounded-full font-bold text-xs ${
                        isApproved ? 'bg-green-100 text-green-700' : 
                        isCancelled ? 'bg-red-100 text-red-700 border border-red-300' :
                        isRejected ? 'bg-red-100 text-red-700' : 
                        isCancelReq ? 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse' :
                        'bg-orange-100 text-orange-700'
                    }">
                        ${escapeHtml(isApproved ? 'Booking Done' : (isCancelReq ? 'Cancellation Requested' : (isCancelled ? 'Cancelled' : b.status)))}
                    </span>

                    ${b.status === 'Pending Approval' ? `
                        <button onclick="updateBookingStatus('${escapeHtml(b.id)}', 'Approved')" class="bg-green-600 hover:bg-green-700 text-white px-3.5 py-1.5 rounded-lg font-bold shadow-sm transition">
                            ✓ Approve
                        </button>
                    ` : ''}

                    ${b.status === 'Pending Approval' ? `
                        <button onclick="updateBookingStatus('${escapeHtml(b.id)}', 'Rejected')" class="bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-lg font-bold shadow-sm transition">
                            ✕ Reject
                        </button>
                    ` : ''}

                    ${isCancelReq ? `
                        <button onclick="ownerOpenCancelModal('${escapeHtml(b.id)}', ${b.fare}, '${escapeHtml(b.passengerName)}')" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-sm transition flex items-center gap-1">
                            ✕ Approve Cancel & Refund
                        </button>
                    ` : ''}

                    ${isApproved ? `
                        <button onclick="ownerOpenCancelModal('${escapeHtml(b.id)}', ${b.fare}, '${escapeHtml(b.passengerName)}')" class="bg-amber-100 hover:bg-amber-600 hover:text-white text-amber-800 border border-amber-300 px-2.5 py-1.5 rounded-lg font-bold shadow-xs transition flex items-center gap-1">
                            ✕ Cancel & Refund
                        </button>
                    ` : ''}

                    ${(isCancelled && b.refundStatus === 'processing') ? `
                        <button onclick="ownerCompleteRefund('${escapeHtml(b.id)}', ${b.refundAmount || 0})" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg font-bold shadow-xs transition flex items-center gap-1">
                            ✓ Mark Refund Paid
                        </button>
                    ` : ''}

                    <button onclick="ownerDeleteSingleBooking('${escapeHtml(b.id)}')" class="bg-red-50 hover:bg-red-600 hover:text-white text-red-600 border border-red-200 px-2.5 py-1.5 rounded-lg font-bold shadow-xs transition flex items-center gap-1" title="Delete Booking">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    });
}

async function ownerOpenCancelModal(bookingId, totalFare, passengerName) {
    const refundStr = prompt(
        (typeof window !== 'undefined' && typeof window.t === 'function') ? window.t(`বুকিং #${bookingId} বাতিল ও রিফান্ড অনুমোদন:\n\nযাত্রী: ${passengerName}\nমোট ভাড়া: ₹${totalFare}\n\nযাত্রীকে কত টাকা রিফান্ড দিতে চান? লিখুন (যেমন: ${totalFare}):`, `Cancel Booking #${bookingId} & Approve Refund:\n\nPassenger: ${passengerName}\nTotal Fare: ₹${totalFare}\n\nEnter refund amount for passenger (e.g. ${totalFare}):`) : `Cancel Booking #${bookingId} & Refund Amount:`,
        String(totalFare)
    );
    if (refundStr === null) return;
    const refundAmount = parseFloat(refundStr);
    if (isNaN(refundAmount) || refundAmount < 0) {
        alert("দয়া করে সঠিক রিফান্ড পরিমাণ (টাকার অঙ্ক) লিখুন!");
        return;
    }

    const isAlreadyPaid = await showBusYatraConfirm({
        title: 'রিফান্ড স্ট্যাটাস যাচাই',
        subtitle: (typeof window !== 'undefined' && typeof window.t === 'function') ? window.t(`রিফান্ড কি ইতিমধ্যেই দেওয়া হয়েছে?\n\nহ্যাঁ = রিফান্ড দেওয়া সম্পন্ন হয়েছে\nনা = রিফান্ড প্রক্রিয়াধীন রাখা হোক`, `Has refund already been disbursed?\n\nYes = Refund Completed\nNo = Keep Refund Processing`) : 'Has refund already been disbursed?',
        icon: '💰',
        confirmText: 'হ্যাঁ, সম্পন্ন হয়েছে',
        cancelText: 'না, প্রক্রিয়াধীন',
        danger: false
    });
    const refundStatus = isAlreadyPaid ? 'completed' : 'processing';

    try {
        await apiRequest(`/api/owner/bookings/${encodeURIComponent(bookingId)}/status`, {
            method: 'POST',
            body: JSON.stringify({
                status: 'Cancelled',
                refundAmount,
                refundStatus,
                remarks: `Cancelled by Bus Owner with ₹${refundAmount} refund (${refundStatus})`
            })
        });
        await loadOwnerDashboard();
        const alertMsg = (typeof window !== 'undefined' && typeof window.t === 'function') 
            ? window.t(`✅ বুকিং #${bookingId} সফলভাবে বাতিল করা হয়েছে।\nরিফান্ড পরিমাণ: ₹${refundAmount}\nরিফান্ড স্ট্যাটাস: ${refundStatus === 'completed' ? 'সম্পন্ন' : 'প্রক্রিয়াধীন'}।\nসিট মুক্ত করা হয়েছে।`, `✅ Booking #${bookingId} cancelled successfully.\nRefund Amount: ₹${refundAmount}\nRefund Status: ${refundStatus === 'completed' ? 'Completed' : 'Processing'}.\nSeat has been released.`)
            : `✅ Booking #${bookingId} cancelled.`;
        alert(alertMsg);
    } catch (error) {
        alert("ত্রুটি: " + error.message);
    }
}
window.ownerOpenCancelModal = ownerOpenCancelModal;

async function ownerCompleteRefund(bookingId, refundAmount) {
    const ok = await showBusYatraConfirm({ title: "রিফান্ড নিশ্চিতকরণ", subtitle: `আপনি কি নিশ্চিত যে বুকিং #${bookingId}-এর রিফান্ড বাবদ ₹${refundAmount} যাত্রীকে প্রদান করা সম্পন্ন হয়েছে?`, icon: "💰", confirmText: "হ্যাঁ, সম্পন্ন হয়েছে", cancelText: "বাতিল", danger: false }); if (!ok) return;

    try {
        await apiRequest(`/api/owner/bookings/${encodeURIComponent(bookingId)}/refund`, {
            method: 'POST',
            body: JSON.stringify({ refundStatus: 'completed' })
        });
        await loadOwnerDashboard();
        alert(`✅ বুকিং #${bookingId}-এর রিফান্ড সফলভাবে সম্পন্ন হিসেবে চিহ্নিত করা হয়েছে।`);
    } catch (error) {
        alert("ত্রুটি: " + error.message);
    }
}
window.ownerCompleteRefund = ownerCompleteRefund;

async function updateBookingStatus(bookingId, status) {
    const actionDesc = status === 'Approved' ? 'approve this booking' : 'reject this booking';
    const ok = await showBusYatraConfirm({ title: "বুকিং স্ট্যাটাস পরিবর্তন", subtitle: `Are you sure you want to ${actionDesc}?`, icon: status === "Approved" ? "✅" : "⚠️", confirmText: status === "Approved" ? "হ্যাঁ, অনুমোদন করুন" : "হ্যাঁ, বাতিল করুন", cancelText: "বাতিল", danger: status !== "Approved" }); if (!ok) return;

    try {
        await apiRequest(`/api/owner/bookings/${encodeURIComponent(bookingId)}/status`, {
            method: 'POST',
            body: JSON.stringify({ status })
        });
        await loadOwnerDashboard();
        alert(status === 'Approved' ? `✅ Booking ${bookingId} approved! Passenger can now download the PDF ticket.` : `❌ Booking ${bookingId} rejected and seats released.`);
    } catch (error) {
        alert(error.message);
    }
}

// --- Tab 2: Bus Layout, Ticket Template & Pricing Settings ---
function loadOwnerBuses() {
    const db = getAppData();
    const select = document.getElementById('configBusSelect');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = "";
    (db.buses || []).forEach(b => {
        const statusTag = b.approvalStatus === 'pending' ? ' 🟡 [অ্যাডমিন অনুমোদনের অপেক্ষায়]' : (b.approvalStatus === 'rejected' ? ' 🔴 [বাতিল]' : ' 🟢 [লাইভ]');
        const retTag = b.returnRouteEnabled ? ' 🔄' : '';
        select.innerHTML += `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)} (${escapeHtml(b.busNumber)})${retTag}${statusTag}</option>`;
    });

    if (currentVal && db.buses.some(b => b.id === currentVal)) {
        select.value = currentVal;
    }
    loadBusConfigDetails();
}

let pendingOwnerBusImages = [];
let currentOwnerBusPhotos = [];

function renderOwnerBusPhotosGallery(bus) {
    const gallery = document.getElementById('ownerBusPhotosGallery');
    const badge = document.getElementById('ownerPhotoCountBadge');
    const banner = document.getElementById('ownerPhotoStatusBanner');
    if (!gallery) return;

    if (badge) {
        badge.textContent = `${currentOwnerBusPhotos.length} টি ছবি`;
    }

    if (currentOwnerBusPhotos.length === 0) {
        gallery.innerHTML = `<div class="text-xs text-gray-400 italic py-2">কোনো ছবি আপলোড করা নেই। নিচে ছবি বাছুন।</div>`;
        if (banner) banner.classList.add('hidden');
        return;
    }

    const isPending = bus && (bus.photoApprovalStatus === 'pending' || bus.photo_approval_status === 'pending');

    gallery.innerHTML = currentOwnerBusPhotos.map((url, idx) => {
        const isOverLimit = idx >= 3;
        const badgeMarkup = isOverLimit && isPending
            ? `<span class="absolute bottom-1 left-1 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow">🟡 অ্যাডমিন পেন্ডিং</span>`
            : `<span class="absolute bottom-1 left-1 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">🟢 লাইভ</span>`;

        return `
            <div class="relative w-28 h-20 rounded-xl overflow-hidden border-2 ${isOverLimit && isPending ? 'border-amber-400' : 'border-gray-200'} shadow-sm group bg-gray-900 shrink-0">
                <img src="${escapeHtml(url)}" alt="Bus photo ${idx + 1}" class="w-full h-full object-cover">
                ${badgeMarkup}
                <button type="button" onclick="deleteOwnerBusPhoto(${idx})" class="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md cursor-pointer transition opacity-90 group-hover:opacity-100" title="Delete Photo">
                    ✕
                </button>
            </div>
        `;
    }).join('');

    if (banner) {
        if (isPending && currentOwnerBusPhotos.length > 3) {
            banner.className = 'p-3 rounded-xl text-xs bg-amber-50 border border-amber-200 text-amber-900 block';
            banner.innerHTML = `🟡 <strong>অ্যাডমিন অনুমোদনের অপেক্ষায়:</strong> আপনার আপলোড করা ${currentOwnerBusPhotos.length}টি ছবির মধ্যে প্রথম ৩টি সক্রিয় রয়েছে। বাকি ${currentOwnerBusPhotos.length - 3}টি ছবি অ্যাডমিন রিভিউ করছেন। অ্যাডমিন অনুমোদন দিলেই যাত্রীরা সব ছবি দেখতে পাবেন।`;
        } else if (currentOwnerBusPhotos.length > 3) {
            banner.className = 'p-3 rounded-xl text-xs bg-blue-50 border border-blue-200 text-blue-900 block';
            banner.innerHTML = `ℹ️ <strong>তথ্য:</strong> আপনি ${currentOwnerBusPhotos.length}টি ছবি বেছেছেন। ৩টির বেশি ছবি থাকায় 'Save Bus Configuration' করার পর অতিরিক্ত ছবিগুলো অ্যাডমিন অনুমোদনের জন্য যাবে।`;
        } else {
            banner.classList.add('hidden');
        }
    }
}
window.renderOwnerBusPhotosGallery = renderOwnerBusPhotosGallery;

async function deleteOwnerBusPhoto(index) {
    if (index < 0 || index >= currentOwnerBusPhotos.length) return;
    const ok = await showBusYatraConfirm({ title: "ছবি মুছে ফেলা", subtitle: "আপনি কি নিশ্চিত এই ছবিটি মুছে ফেলতে চান? (Are you sure you want to delete this photo?)", icon: "🗑️", confirmText: "হ্যাঁ, মুছে ফেলুন", cancelText: "বাতিল", danger: true });
    if (!ok) return;

    const busId = document.getElementById('configBusSelect')?.value;
    const photoUrlToDelete = currentOwnerBusPhotos[index];

    currentOwnerBusPhotos.splice(index, 1);
    pendingOwnerBusImages = [...currentOwnerBusPhotos];

    const db = getAppData();
    const bus = (db.buses || []).find(b => b.id === busId);
    renderOwnerBusPhotosGallery(bus);

    if (busId) {
        try {
            await apiRequest(`/api/owner/buses/${encodeURIComponent(busId)}/photos/delete`, {
                method: 'POST',
                body: JSON.stringify({
                    photoIndex: index,
                    photoUrl: photoUrlToDelete
                })
            });
            await loadOwnerDashboard();
        } catch (err) {
            console.warn("Delete photo API notice:", err.message);
        }
    }
}
window.deleteOwnerBusPhoto = deleteOwnerBusPhoto;

async function previewOwnerBusImage(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const f of Array.from(files)) {
        try {
            const dataUrl = await compressImageFile(f);
            currentOwnerBusPhotos.push(dataUrl);
        } catch (e) {
            console.error("Image compression error:", e);
        }
    }
    pendingOwnerBusImages = [...currentOwnerBusPhotos];
    event.target.value = '';

    const busId = document.getElementById('configBusSelect')?.value;
    const db = getAppData();
    const bus = (db.buses || []).find(b => b.id === busId);
    renderOwnerBusPhotosGallery(bus);
}
window.previewOwnerBusImage = previewOwnerBusImage;

function toggleReturnRouteFields() {
    const enabled = document.getElementById('configReturnRouteEnabled')?.checked;
    const fields = document.getElementById('configReturnRouteFields');
    if (fields) {
        fields.classList.toggle('hidden', !enabled);
    }
}
window.toggleReturnRouteFields = toggleReturnRouteFields;

function reverseUpRouteForReturn() {
    const { stoppages } = collectStoppageSchedule('ownerConfigStoppagesContainer');
    if (!stoppages || stoppages.length < 2) {
        alert('আপ রুটে পর্যাপ্ত স্টপেজ নেই। প্রথমে আপ রুটের স্টপেজ পূরণ করুন।');
        return;
    }
    const reversed = stoppages.slice().reverse();
    const returnRouteTitle = `${reversed[0]} - ${reversed[reversed.length - 1]}`;
    const retRouteInput = document.getElementById('configReturnRoute');
    if (retRouteInput) retRouteInput.value = returnRouteTitle;
    renderStoppageScheduleEditor('ownerConfigReturnStoppagesContainer', reversed, {});
    alert(`✅ ফিরতি রুট প্রস্তুত: ${returnRouteTitle}। এখন প্রতিটি স্টপেজের সময় লিখে সেভ করুন।`);
}
window.reverseUpRouteForReturn = reverseUpRouteForReturn;

async function resubmitBusForApproval(busId) {
    const ok = await showBusYatraConfirm({ title: "অনুমোদনের অনুরোধ", subtitle: "আপনি কি নিশ্চিত যে সংশোধিত তথ্য সহ বাসটি পুনরায় অ্যাডমিনের অনুমোদনের জন্য পাঠাতে চান?", icon: "🚀", confirmText: "হ্যাঁ, পাঠান", cancelText: "বাতিল", danger: false }); if (!ok) return;
    try {
        await apiRequest(`/api/owner/buses/${encodeURIComponent(busId)}/settings`, {
            method: 'POST',
            body: JSON.stringify({ resubmitApproval: true })
        });
        alert('✅ বাসটি পুনরায় অ্যাডমিনের পর্যালোচনার জন্য পাঠানো হয়েছে!');
        await loadOwnerDashboard();
    } catch (e) {
        alert(e.message || 'Failed to re-submit bus.');
    }
}
window.resubmitBusForApproval = resubmitBusForApproval;

function loadBusConfigDetails() {
    const select = document.getElementById('configBusSelect');
    if (!select) return;
    const busId = select.value;
    const db = getAppData();
    const bus = (db.buses || []).find(b => b.id === busId);
    if (!bus) return;

    // Approval Status Banner
    const banner = document.getElementById('ownerBusApprovalBanner');
    if (banner) {
        const status = bus.approvalStatus || 'approved';
        if (status === 'pending') {
            banner.className = 'mt-2 p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold flex items-center justify-between gap-3 shadow-xs';
            banner.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="text-base">🟡</span>
                    <div>
                        <div class="font-bold text-amber-950">${(typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('অ্যাডমিন অনুমোদনের অপেক্ষায়', 'Pending Admin Approval') : 'Pending Admin Approval'}</div>
                        <div class="text-[11px] text-amber-800">এই বাসটি এখনো সেন্ট্রাল অ্যাডমিন অনুমোদন করেননি। অনুমোদন পেলে স্বয়ংক্রিয়ভাবে লাইভ হবে।</div>
                    </div>
                </div>
                <span class="bg-amber-200 text-amber-900 px-2 py-1 rounded text-[11px] font-bold shrink-0">পর্যালোচনাধীন</span>
            `;
            banner.classList.remove('hidden');
        } else if (status === 'rejected') {
            banner.className = 'mt-2 p-3 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-xs font-semibold flex items-center justify-between gap-3 shadow-xs';
            banner.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="text-base">🔴</span>
                    <div>
                        <div class="font-bold text-rose-950">${(typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('বাসটি বাতিল করা হয়েছে', 'Rejected by Admin') : 'Rejected by Admin'}</div>
                        <div class="text-[11px] text-rose-800">কারণ: ${escapeHtml(bus.rejectionReason || 'তথ্য অসম্পূর্ণ')}। তথ্য সংশোধন করে পুনরায় পাঠান।</div>
                    </div>
                </div>
                <button type="button" onclick="resubmitBusForApproval('${escapeHtml(bus.id)}')" class="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 shadow-xs cursor-pointer">
                    পুনরায় পাঠান (Re-Submit)
                </button>
            `;
            banner.classList.remove('hidden');
        } else {
            banner.className = 'mt-2 p-3 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-3 shadow-xs';
            banner.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="text-base">🟢</span>
                    <div>
                        <div class="font-bold text-emerald-950">বাসটি অনুমোদিত ও লাইভ (Approved & Live)</div>
                        <div class="text-[11px] text-emerald-800">যাত্রীরা Bus Yatra অ্যাপে এই বাসের সিট বুক করতে পারবেন।</div>
                    </div>
                </div>
                <span class="bg-emerald-200 text-emerald-900 px-2 py-1 rounded text-[11px] font-bold shrink-0">🟢 লাইভ</span>
            `;
            banner.classList.remove('hidden');
        }
    }

    // Bus Photos Gallery initialization
    currentOwnerBusPhotos = [];
    if (bus.photoApprovalStatus === 'pending' && Array.isArray(bus.pendingImages) && bus.pendingImages.length > 0) {
        currentOwnerBusPhotos = [...bus.pendingImages];
    } else if (Array.isArray(bus.images) && bus.images.length > 0) {
        currentOwnerBusPhotos = [...bus.images];
    } else if (bus.image) {
        if (typeof bus.image === 'string' && bus.image.startsWith('[')) {
            try { currentOwnerBusPhotos = JSON.parse(bus.image); } catch(e) { currentOwnerBusPhotos = [bus.image]; }
        } else {
            currentOwnerBusPhotos = [bus.image];
        }
    }
    pendingOwnerBusImages = [...currentOwnerBusPhotos];
    renderOwnerBusPhotosGallery(bus);

    // Route & Timetable Details
    const configRouteInput = document.getElementById('configRoute');
    if (configRouteInput) configRouteInput.value = bus.route || '';
    const configTimeInput = document.getElementById('configTime');
    if (configTimeInput) configTimeInput.value = bus.time || '';
    renderStoppageScheduleEditor('ownerConfigStoppagesContainer', bus.stoppages || [], bus.stoppageTimings || bus.stoppage_timings || {});

    // Return Route & Timetable Details
    const returnToggle = document.getElementById('configReturnRouteEnabled');
    if (returnToggle) {
        returnToggle.checked = Boolean(bus.returnRouteEnabled);
        toggleReturnRouteFields();
    }
    const returnRouteInput = document.getElementById('configReturnRoute');
    if (returnRouteInput) returnRouteInput.value = bus.returnRoute || '';
    const returnTimeInput = document.getElementById('configReturnTime');
    if (returnTimeInput) returnTimeInput.value = bus.returnTime || '';
    const returnFareInput = document.getElementById('configReturnFare');
    if (returnFareInput) returnFareInput.value = bus.returnFare !== undefined ? bus.returnFare : (bus.fare || 150);
    renderStoppageScheduleEditor('ownerConfigReturnStoppagesContainer', bus.returnStoppages || [], bus.returnStoppageTimings || bus.return_stoppage_timings || {});

    // Pricing
    document.getElementById('configFare').value = bus.fare !== undefined ? bus.fare : 399;
    document.getElementById('configFarePerStop').value = bus.farePerStop !== undefined ? bus.farePerStop : 45;
    document.getElementById('configFarePerKm').value = bus.farePerKm !== undefined ? bus.farePerKm : 3.5;

    // Template & Details
    document.getElementById('configCompanyName').value = bus.companyName || "";
    document.getElementById('configGstNumber').value = bus.gstNumber || "";
    document.getElementById('configEmergencyPhone').value = bus.emergencyPhone || bus.driverPhone || "";
    document.getElementById('configTotalSeats').value = bus.totalSeats || 65;
    document.getElementById('configUpiId').value = bus.upiId || "";
    document.getElementById('configTicketTerms').value = bus.ticketTerms || "";
    document.getElementById('configCaptainPhone').value = bus.driverPhone || '';
    document.getElementById('configCaptainPin').value = '';
    document.getElementById('toggleOnlinePay').checked = bus.allowOnlinePayment !== false;
    document.getElementById('toggleCashPay').checked = bus.allowCashPayment !== false;

    // Booking Mode
    const currentMode = bus.bookingMode || 'active';
    const modeRadio = document.querySelector(`input[name="busBookingMode"][value="${currentMode}"]`);
    if (modeRadio) modeRadio.checked = true;
    updateBookingModeBadge(currentMode);

    loadBusServiceDate();
}

function openOwnerSeatLayoutDesigner() {
    const busId = document.getElementById('configBusSelect')?.value;
    if (!busId) {
        alert("প্রথমে একটি বাস নির্বাচন করুন।");
        return;
    }
    if (typeof openSeatLayoutDesigner === 'function') {
        openSeatLayoutDesigner(busId, 'owner');
    } else {
        alert("সিট বিল্ডার লোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...");
    }
}
window.openOwnerSeatLayoutDesigner = openOwnerSeatLayoutDesigner;

function updateBookingModeBadge(mode) {
    const badge = document.getElementById('currentBookingModeBadge');
    if (!badge) return;
    if (mode === 'auto_pilot') {
        badge.className = 'bg-purple-600 text-white text-[11px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider';
        badge.innerText = '🚀 Auto-Pilot Mode';
    } else if (mode === 'inactive') {
        badge.className = 'bg-red-600 text-white text-[11px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider';
        badge.innerText = '⛔ Inactive / Disabled';
    } else {
        badge.className = 'bg-green-600 text-white text-[11px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider';
        badge.innerText = '🟢 Active Mode';
    }
}

async function changeBusBookingMode(mode) {
    const busId = document.getElementById('configBusSelect')?.value;
    if (!busId) return;
    updateBookingModeBadge(mode);
    const db = getAppData();
    const bus = (db.buses || []).find(b => b.id === busId);
    if (bus) bus.bookingMode = mode;
    try {
        await apiRequest(`/api/owner/buses/${encodeURIComponent(busId)}/booking-mode`, {
            method: 'POST',
            body: JSON.stringify({ busId, bookingMode: mode })
        });
        const modeLabels = {
            auto_pilot: '🚀 Auto-Pilot Mode চালু হয়েছে! সব সিট পূর্ণ হলে অ্যাপ থেকে বাসটি নিজে নিজেই লুকিয়ে যাবে।',
            active: '🟢 Active Booking চালু হয়েছে! কাস্টমার অ্যাপে সার্চে এই বাসটি দেখা যাবে।',
            inactive: '⛔ বাসের সার্ভিস সাময়িকভাবে Inactive করা হয়েছে। কাস্টমার অ্যাপে এই বাসটি দেখাবে না।'
        };
        alert(`✅ ${modeLabels[mode] || 'Booking mode updated!'}`);
    } catch (error) {
        alert('Could not update booking mode: ' + error.message);
    }
}
window.changeBusBookingMode = changeBusBookingMode;
window.updateBookingModeBadge = updateBookingModeBadge;

async function loadBusServiceDate() {
    const busId = document.getElementById('configBusSelect')?.value;
    const date = document.getElementById('serviceDateInput')?.value;
    if (!busId || !date) return;
    try {
        const query = new URLSearchParams({ date });
        const result = await apiRequest(`/api/owner/buses/${encodeURIComponent(busId)}/service-date?${query}`);
        document.getElementById('serviceDateEnabled').checked = result.enabled;
        document.getElementById('serviceDateStatus').innerText = result.enabled
            ? 'Service is open for bookings on this date.'
            : 'Service is closed; customers will not see this bus on this date.';
    } catch (error) {
        document.getElementById('serviceDateStatus').innerText = `Could not load service status: ${error.message}`;
    }
}

async function saveBusServiceDate() {
    const busId = document.getElementById('configBusSelect')?.value;
    const date = document.getElementById('serviceDateInput')?.value;
    const enabled = document.getElementById('serviceDateEnabled')?.checked;
    if (!busId || !date) {
        alert('Select a bus and journey date.');
        return;
    }
    try {
        await apiRequest(`/api/owner/buses/${encodeURIComponent(busId)}/service-date`, {
            method: 'POST',
            body: JSON.stringify({ date, enabled })
        });
        await loadBusServiceDate();
        alert('Bus service date updated.');
    } catch (error) {
        alert(error.message);
    }
}

async function saveBusConfiguration() {
    const busId = document.getElementById('configBusSelect').value;
    if (!busId) {
        alert("Please select a bus.");
        return;
    }

    const fare = parseFloat(document.getElementById('configFare').value) || 399;
    const farePerStop = parseFloat(document.getElementById('configFarePerStop').value) || 45;
    const farePerKm = parseFloat(document.getElementById('configFarePerKm').value) || 3.5;

    const companyName = document.getElementById('configCompanyName').value.trim();
    const gstNumber = document.getElementById('configGstNumber').value.trim().toUpperCase();
    const emergencyPhone = document.getElementById('configEmergencyPhone').value.trim();
    const totalSeats = parseInt(document.getElementById('configTotalSeats').value) || 65;
    const upiId = document.getElementById('configUpiId').value.trim();
    const ticketTerms = document.getElementById('configTicketTerms').value.trim();
    const captainPhone = document.getElementById('configCaptainPhone').value.trim();
    const captainPin = document.getElementById('configCaptainPin').value.trim();
    const allowOnlinePayment = document.getElementById('toggleOnlinePay').checked;
    const allowCashPayment = document.getElementById('toggleCashPay').checked;
    if (!allowOnlinePayment && !allowCashPayment) {
        alert(window.t('দয়া করে অন্তত একটি পেমেন্ট পদ্ধতি (অনলাইন বা ক্যাশ) চালু রাখুন।', 'Please enable at least one payment method (online or cash).'));
        return;
    }
    const bookingMode = document.querySelector('input[name="busBookingMode"]:checked')?.value || 'active';

    const db = getAppData();
    const bus = (db.buses || []).find(b => b.id === busId);
    const busImages = (currentOwnerBusPhotos && currentOwnerBusPhotos.length > 0)
        ? currentOwnerBusPhotos
        : (pendingOwnerBusImages.length > 0
            ? pendingOwnerBusImages
            : (bus && bus.images ? bus.images : (bus && bus.image ? [bus.image] : [])));
    const busImage = busImages[0] || (bus ? bus.image : null);

    const route = (document.getElementById('configRoute')?.value || '').trim();
    const time = (document.getElementById('configTime')?.value || '').trim();
    const { stoppages, stoppageTimings } = collectStoppageSchedule('ownerConfigStoppagesContainer');

    // Return Route & Stoppages
    const returnRouteEnabled = document.getElementById('configReturnRouteEnabled')?.checked || false;
    const returnRoute = (document.getElementById('configReturnRoute')?.value || '').trim();
    const returnTime = (document.getElementById('configReturnTime')?.value || '').trim();
    const returnFare = parseFloat(document.getElementById('configReturnFare')?.value) || fare;
    const returnSchedule = collectStoppageSchedule('ownerConfigReturnStoppagesContainer');
    const returnStoppages = returnSchedule.stoppages;
    const returnStoppageTimings = returnSchedule.stoppageTimings;

    if (stoppages.length < 2) {
        alert("বাসের কমপক্ষে ২টি স্টপেজ (শুরু ও শেষ গন্তব্য) থাকতে হবে। (A bus must have at least 2 stoppages).");
        return;
    }

    try {
        await apiRequest(`/api/owner/buses/${encodeURIComponent(busId)}/settings`, {
            method: 'POST',
            body: JSON.stringify({
                route: route || undefined,
                time: time || undefined,
                stoppages,
                stoppageTimings,
                returnRouteEnabled,
                returnRoute: returnRoute || undefined,
                returnTime: returnTime || undefined,
                returnFare,
                returnStoppages,
                returnStoppageTimings,
                fare,
                farePerStop,
                farePerKm,
                companyName,
                gstNumber,
                emergencyPhone,
                captainPhone,
                captainPin,
                totalSeats,
                upiId,
                ticketTerms,
                allowOnlinePayment,
                allowCashPayment,
                images: busImages,
                image: busImage,
                bookingMode
            })
        });
        await loadOwnerDashboard();
        document.getElementById('configCaptainPin').value = '';
        if (busImages.length > 3) {
            alert("✅ বাসের রুট, সময়সূচি ও সেটিংস সফলভাবে সেভ হয়েছে!\n\n📸 বাসের ৩টির বেশি ছবি আপলোড করায় অতিরিক্ত ছবিগুলো অ্যাডমিন অনুমোদনের জন্য পাঠানো হয়েছে। অ্যাডমিন অনুমোদন দিলেই যাত্রীরা সব ছবি দেখতে পাবেন।");
        } else {
            alert("✅ বাসের রুট, সময়সূচি ও সেটিংস সফলভাবে সেভ হয়েছে! (Bus route, stoppage timetable & settings saved successfully!)");
        }
    } catch (error) {
        alert(error.message);
    }
}

function openOwnerAppQrModal() {
    document.getElementById('ownerAppQrModal')?.classList.remove('hidden');
}
function closeOwnerAppQrModal() {
    document.getElementById('ownerAppQrModal')?.classList.add('hidden');
}
window.openOwnerAppQrModal = openOwnerAppQrModal;
window.closeOwnerAppQrModal = closeOwnerAppQrModal;

// --- Tab 3: Passenger Manifest ---
function initManifestDate() {
    const input = document.getElementById('manifestDateInput');
    if (input && !input.value) {
        input.value = localDateStr();
    }
}

function generateTripReminderMessage(booking, bus, hoursAhead = 2) {
    const pName = booking.passengerName || 'যাত্রী';
    const bName = bus?.name || 'Bus Yatra Express';
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

function renderPassengerManifest() {
    const container = document.getElementById('manifestListContainer');
    const dateInput = document.getElementById('manifestDateInput');
    if (!container || !dateInput) return;

    const selectedDate = dateInput.value;
    const db = getAppData();
    const isReminderEnabled = db.featureFlags?.tripReminders !== false;

    // Feature Flag state enforcement
    const adminNotice = document.getElementById('ownerReminderAdminDisabledNotice');
    const btnWa = document.getElementById('btnOwnerSendWhatsApp');
    const btnSms = document.getElementById('btnOwnerSendNormalSms');
    const selectAllCb = document.getElementById('ownerManifestSelectAll');
    if (adminNotice) adminNotice.classList.toggle('hidden', isReminderEnabled);
    if (btnWa) btnWa.disabled = !isReminderEnabled;
    if (btnSms) btnSms.disabled = !isReminderEnabled;
    if (selectAllCb) selectAllCb.disabled = !isReminderEnabled;

    const bookings = Object.values(db.bookings || {}).filter(b => b.date === selectedDate && b.status === 'Approved');

    container.innerHTML = "";
    if (selectAllCb) selectAllCb.checked = false;
    updateOwnerManifestSelection();

    if (bookings.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-8 text-xs">
            No approved passengers found for journey date: <strong>${escapeHtml(selectedDate)}</strong>.
        </div>`;
        return;
    }

    let tableHtml = `
        <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
                <thead>
                    <tr class="bg-gray-100 border-b text-gray-700">
                        <th class="p-2.5 font-bold w-10 text-center">
                            <input type="checkbox" id="thOwnerSelectAll" onchange="toggleOwnerManifestSelectAll(this.checked)" class="w-4 h-4 text-emerald-600 rounded cursor-pointer" ${!isReminderEnabled ? 'disabled' : ''}>
                        </th>
                        <th class="p-2.5 font-bold">Seats</th>
                        <th class="p-2.5 font-bold">Passenger</th>
                        <th class="p-2.5 font-bold">Phone</th>
                        <th class="p-2.5 font-bold">Boarding ➔ Dropping</th>
                        <th class="p-2.5 font-bold">Payment</th>
                        <th class="p-2.5 font-bold">Booking ID</th>
                        <th class="p-2.5 font-bold text-center">রিমাইন্ডার (1-Click)</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
    `;

    bookings.forEach(b => {
        tableHtml += `
            <tr class="hover:bg-gray-50 transition border-b border-gray-100">
                <td class="p-2.5 text-center">
                    <input type="checkbox" class="owner-manifest-cb w-4 h-4 text-emerald-600 rounded cursor-pointer" data-booking-id="${escapeHtml(b.id)}" onchange="updateOwnerManifestSelection()" ${!isReminderEnabled ? 'disabled' : ''}>
                </td>
                <td class="p-2.5 font-bold text-red-600">${escapeHtml((b.seats || []).join(', '))}</td>
                <td class="p-2.5 font-semibold text-gray-900">${escapeHtml(b.passengerName)}</td>
                <td class="p-2.5 font-mono"><a href="tel:${escapeHtml(b.passengerPhone)}" class="text-blue-600 hover:underline">${escapeHtml(b.passengerPhone)}</a></td>
                <td class="p-2.5">${escapeHtml(b.boarding)} ➔ ${escapeHtml(b.dropping)}</td>
                <td class="p-2.5"><span class="px-2 py-0.5 bg-green-50 text-green-700 rounded border border-green-200 font-semibold">${escapeHtml(b.paymentMode)} (₹${b.fare})</span></td>
                <td class="p-2.5 font-mono text-gray-500">${escapeHtml(b.id)}</td>
                <td class="p-2.5 text-center whitespace-nowrap">
                    <div class="flex items-center justify-center gap-1.5">
                        <button type="button" onclick="sendOwnerSingleWhatsApp('${escapeHtml(b.id)}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs active:scale-95 ${!isReminderEnabled ? 'opacity-40 cursor-not-allowed' : ''}" ${!isReminderEnabled ? 'disabled' : ''} title="WhatsApp রিমাইন্ডার পাঠান">
                            <span>🟢</span> <span>WhatsApp</span>
                        </button>
                        <button type="button" onclick="sendOwnerSingleSms('${escapeHtml(b.id)}')" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs active:scale-95 ${!isReminderEnabled ? 'opacity-40 cursor-not-allowed' : ''}" ${!isReminderEnabled ? 'disabled' : ''} title="নরমাল SMS পাঠান">
                            <span>💬</span> <span>SMS</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tableHtml += `</tbody></table></div>`;
    container.innerHTML = tableHtml;
}

function toggleOwnerManifestSelectAll(checked) {
    const cbs = document.querySelectorAll('.owner-manifest-cb');
    cbs.forEach(cb => { cb.checked = checked; });
    const topCb = document.getElementById('ownerManifestSelectAll');
    const thCb = document.getElementById('thOwnerSelectAll');
    if (topCb) topCb.checked = checked;
    if (thCb) thCb.checked = checked;
    updateOwnerManifestSelection();
}

function updateOwnerManifestSelection() {
    const checked = document.querySelectorAll('.owner-manifest-cb:checked');
    const countEl = document.getElementById('ownerSelectedCount');
    if (countEl) countEl.textContent = checked.length;
}

function sendOwnerSingleWhatsApp(bookingId) {
    const db = getAppData();
    if (db.featureFlags?.tripReminders === false) {
        alert('⚠️ এই ফিচারটি বর্তমানে সুপার অ্যাডমিন দ্বারা নিষ্ক্রিয় করা আছে।');
        return;
    }
    const booking = db.bookings?.[bookingId];
    if (!booking) return;
    const bus = db.buses?.find(b => b.id === booking.busId) || {};
    const hoursAhead = document.getElementById('ownerReminderHoursSelect')?.value || '2';
    const msg = generateTripReminderMessage(booking, bus, hoursAhead);
    const url = `https://wa.me/91${encodeURIComponent(booking.passengerPhone)}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

function sendOwnerSingleSms(bookingId) {
    const db = getAppData();
    if (db.featureFlags?.tripReminders === false) {
        alert('⚠️ এই ফিচারটি বর্তমানে সুপার অ্যাডমিন দ্বারা নিষ্ক্রিয় করা আছে।');
        return;
    }
    const booking = db.bookings?.[bookingId];
    if (!booking) return;
    const bus = db.buses?.find(b => b.id === booking.busId) || {};
    const hoursAhead = document.getElementById('ownerReminderHoursSelect')?.value || '2';
    const msg = generateTripReminderMessage(booking, bus, hoursAhead);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? '&' : '?';
    window.location.href = `sms:${encodeURIComponent(booking.passengerPhone)}${separator}body=${encodeURIComponent(msg)}`;
}

function sendOwnerSelectedWhatsAppReminders() {
    const db = getAppData();
    if (db.featureFlags?.tripReminders === false) {
        alert('⚠️ এই ফিচারটি বর্তমানে সুপার অ্যাডমিন দ্বারা নিষ্ক্রিয় করা আছে।');
        return;
    }
    const cbs = Array.from(document.querySelectorAll('.owner-manifest-cb:checked'));
    if (cbs.length === 0) {
        alert('অনুগ্রহ করে অন্তত একজন যাত্রী নির্বাচন করুন (Please select at least 1 passenger).');
        return;
    }
    const selectedIds = cbs.map(cb => cb.getAttribute('data-booking-id'));
    const bookings = selectedIds.map(id => db.bookings?.[id]).filter(Boolean);

    if (bookings.length === 1) {
        sendOwnerSingleWhatsApp(bookings[0].id);
        return;
    }

    const modal = document.getElementById('whatsappBatchModalOwner');
    const listEl = document.getElementById('ownerBatchWhatsAppList');
    const badgeEl = document.getElementById('ownerBatchModalBadge');
    if (!modal || !listEl) return;

    if (badgeEl) badgeEl.textContent = `${bookings.length} জন`;
    listEl.innerHTML = '';
    const hoursAhead = document.getElementById('ownerReminderHoursSelect')?.value || '2';

    bookings.forEach((b, idx) => {
        const bus = db.buses?.find(bus => bus.id === b.busId) || {};
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
            <a href="${waUrl}" target="_blank" onclick="markOwnerBatchItemSent(this)" class="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap active:scale-95">
                <span>🟢</span> <span>WhatsApp-এ পাঠান</span>
            </a>
        `;
        listEl.appendChild(card);
    });

    modal.classList.remove('hidden');
}

function markOwnerBatchItemSent(btn) {
    btn.className = "w-full sm:w-auto bg-gray-200 text-gray-700 border border-gray-300 px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap";
    btn.innerHTML = "<span>✅</span> <span>পাঠানো হয়েছে</span>";
}

function closeOwnerBatchWhatsAppModal() {
    document.getElementById('whatsappBatchModalOwner')?.classList.add('hidden');
}

function sendOwnerSelectedNormalSmsReminders() {
    const db = getAppData();
    if (db.featureFlags?.tripReminders === false) {
        alert('⚠️ এই ফিচারটি বর্তমানে সুপার অ্যাডমিন দ্বারা নিষ্ক্রিয় করা আছে।');
        return;
    }
    const cbs = Array.from(document.querySelectorAll('.owner-manifest-cb:checked'));
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

    const hoursAhead = document.getElementById('ownerReminderHoursSelect')?.value || '2';
    const firstBooking = bookings[0];
    const bus = db.buses?.find(b => b.id === firstBooking.busId) || {};

    if (bookings.length === 1) {
        sendOwnerSingleSms(firstBooking.id);
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

window.toggleOwnerManifestSelectAll = toggleOwnerManifestSelectAll;
window.updateOwnerManifestSelection = updateOwnerManifestSelection;
window.sendOwnerSingleWhatsApp = sendOwnerSingleWhatsApp;
window.sendOwnerSingleSms = sendOwnerSingleSms;
window.sendOwnerSelectedWhatsAppReminders = sendOwnerSelectedWhatsAppReminders;
window.sendOwnerSelectedNormalSmsReminders = sendOwnerSelectedNormalSmsReminders;
window.closeOwnerBatchWhatsAppModal = closeOwnerBatchWhatsAppModal;
window.markOwnerBatchItemSent = markOwnerBatchItemSent;

// --- Tab 4: Customer Reviews ---
function loadOwnerReviews() {
    const db = getAppData();
    const container = document.getElementById('ownerReviewsList');
    if (!container) return;

    const reviews = db.reviews || [];
    container.innerHTML = "";

    if (reviews.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-8 text-xs">No customer feedback yet.</div>`;
        return;
    }

    reviews.forEach(r => {
        const stars = "⭐".repeat(r.rating || 5);
        container.innerHTML += `
            <div class="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-xs space-y-1">
                <div class="flex justify-between items-center">
                    <span class="font-bold text-amber-500">${stars}</span>
                    <span class="text-gray-400">${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</span>
                </div>
                <p class="text-gray-700 italic">"${escapeHtml(r.comment || 'Smooth journey')}"</p>
                <div class="text-[10px] text-gray-400">Booking: ${escapeHtml(r.bookingId || '')}</div>
            </div>
        `;
    });
}

// --- Live GPS Sharing ---
function shareOwnerLiveLocation() {
    const select = document.getElementById('configBusSelect');
    if (!select) return;
    const busId = select.value;
    const statusText = document.getElementById('locationStatusText');
    const btn = document.getElementById('shareLocationButton');

    if (!navigator.geolocation) {
        if (statusText) statusText.innerText = "Geolocation is not supported by your browser.";
        return;
    }

    if (ownerLocationWatch !== null) {
        navigator.geolocation.clearWatch(ownerLocationWatch);
        ownerLocationWatch = null;
        ownerLocationBusId = null;
        if (btn) btn.innerHTML = '📍 Start Sharing Live GPS';
        if (statusText) statusText.innerText = 'Live GPS sharing stopped.';
        return;
    }

    ownerLocationBusId = busId;
    if (btn) btn.innerHTML = '⏹ Stop Sharing Live GPS';
    if (statusText) statusText.innerText = 'Acquiring GPS location... Keep this browser tab open while bus is running.';

    ownerLocationWatch = navigator.geolocation.watchPosition(
        async position => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            try {
                await apiRequest(`/api/owner/buses/${encodeURIComponent(busId)}/location`, {
                    method: 'POST',
                    body: JSON.stringify({ lat, lng })
                });
                if (statusText) {
                    statusText.innerHTML = `🟢 <strong>Live GPS Broadcasting</strong>: Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)} (${new Date().toLocaleTimeString()})`;
                }
            } catch (err) {
                if (statusText) statusText.innerText = `Update error: ${err.message}`;
            }
        },
        error => {
            if (statusText) statusText.innerText = `GPS error: ${error.message}`;
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
}

// --- Map View & Live GPS Tracking for Owner ---
let ownerFirestoreUnsubscribe = null;
let activeOwnerTrackedBusId = null;

function populateOwnerTrackingBusSelect(selectedBusId = null) {
    const sel = document.getElementById('ownerTrackingBusSelect');
    if (!sel) return;
    if (!ownerBuses || ownerBuses.length === 0) {
        sel.innerHTML = '<option value="">-- No buses registered --</option>';
        return;
    }
    sel.innerHTML = ownerBuses.map(b => `
        <option value="${b.id}" ${b.id === selectedBusId ? 'selected' : ''}>
            ${escapeHtml(b.name)} (${escapeHtml(b.busNumber)}) - ${escapeHtml(b.fromCity)} ➔ ${escapeHtml(b.toCity)}
        </option>
    `).join('');
    if (selectedBusId) sel.value = selectedBusId;
}

async function openOwnerTrackingModalFromNav(busId = null) {
    const modal = document.getElementById('ownerTrackingModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const targetBusId = busId || (ownerBuses && ownerBuses.length > 0 ? ownerBuses[0].id : null);
    populateOwnerTrackingBusSelect(targetBusId);

    if (targetBusId) {
        await startTrackingOwnerBus(targetBusId);
    }
}
window.openOwnerTrackingModalFromNav = openOwnerTrackingModalFromNav;

async function openOwnerTrackingFromSelection() {
    const select = document.getElementById('configBusSelect');
    const busId = select ? select.value : (ownerBuses[0]?.id || null);
    await openOwnerTrackingModalFromNav(busId);
}
window.openOwnerTrackingFromSelection = openOwnerTrackingFromSelection;

function onOwnerTrackingBusChanged() {
    const sel = document.getElementById('ownerTrackingBusSelect');
    if (!sel || !sel.value) return;
    startTrackingOwnerBus(sel.value);
}
window.onOwnerTrackingBusChanged = onOwnerTrackingBusChanged;

function refreshOwnerTrackingLocation() {
    if (activeOwnerTrackedBusId) {
        startTrackingOwnerBus(activeOwnerTrackedBusId);
    }
}
window.refreshOwnerTrackingLocation = refreshOwnerTrackingLocation;

async function startTrackingOwnerBus(busId) {
    activeOwnerTrackedBusId = busId;
    if (ownerFirestoreUnsubscribe) {
        ownerFirestoreUnsubscribe();
        ownerFirestoreUnsubscribe = null;
    }

    const badge = document.getElementById('ownerTrackingGpsBadge');
    const titleEl = document.getElementById('ownerTrackingTitle');
    const timeEl = document.getElementById('ownerTrackingTime');
    const speedEl = document.getElementById('ownerTrackingSpeed');
    const stopEl = document.getElementById('ownerTrackingStoppage');

    const matchedBus = ownerBuses.find(b => b.id === busId);
    if (titleEl && matchedBus) {
        titleEl.innerText = `${matchedBus.name} (${matchedBus.busNumber})`;
    }

    let hasReceivedFirestoreData = false;

    // 1. Firebase Firestore Real-Time WebSocket (<100ms)
    try {
        const db = getBusYatraFirestore();
        if (db) {
            ownerFirestoreUnsubscribe = db.collection('bus_locations').doc(String(busId)).onSnapshot(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
                        hasReceivedFirestoreData = true;
                        if (badge) {
                            badge.className = "px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 flex items-center gap-1";
                            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> 🟢 GPS LIVE';
                        }
                        if (speedEl) speedEl.innerText = `${data.speed || 0} km/h`;
                        if (stopEl) stopEl.innerText = data.stopName || (matchedBus?.fromCity || 'On Route');
                        renderOwnerBusMarker(data.lat, data.lng, data.updated_at, data.speed, data.stopName, data.accuracy);
                    }
                } else if (!hasReceivedFirestoreData) {
                    fetchOwnerBusLocationCloudflare(busId);
                }
            }, err => {
                console.warn('Owner tracking listener warning:', err);
                if (!hasReceivedFirestoreData) fetchOwnerBusLocationCloudflare(busId);
            });
        }
    } catch (e) {
        console.warn('Firebase init error in owner tracking:', e);
    }

    // 2. Fetch initial location from Cloudflare API
    await fetchOwnerBusLocationCloudflare(busId);
}

async function fetchOwnerBusLocationCloudflare(busId) {
    const badge = document.getElementById('ownerTrackingGpsBadge');
    const timeEl = document.getElementById('ownerTrackingTime');
    const speedEl = document.getElementById('ownerTrackingSpeed');
    const stopEl = document.getElementById('ownerTrackingStoppage');

    try {
        const res = await apiRequest(`/api/tracking?busId=${encodeURIComponent(busId)}`);
        const loc = res ? res.location : null;
        if (loc) {
            if (loc.lat === null || loc.lng === null) {
                if (timeEl) timeEl.innerText = (typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('ক্যাপ্টেন এখনও জিপিএস অন করেননি', 'No GPS shared by captain yet') : 'No GPS shared by captain yet';
                if (badge) {
                    badge.className = "px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-700 flex items-center gap-1";
                    badge.innerText = '🔴 GPS বন্ধ';
                }
                if (speedEl) speedEl.innerText = '0 km/h';
                if (stopEl) stopEl.innerText = 'অজানা';
                return;
            }
            if (badge) {
                badge.className = "px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 flex items-center gap-1";
                badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> 🟢 GPS ACTIVE';
            }
            renderOwnerBusMarker(loc.lat, loc.lng, loc.location_updated_at, 0, null, 15);
        }
    } catch (err) {
        console.warn("Failed to load bus location from Cloudflare:", err);
    }
}

function renderOwnerBusMarker(lat, lng, updatedAtStr, speed = null, stopName = null, accuracy = null) {
    const timeText = updatedAtStr ? new Date(updatedAtStr).toLocaleTimeString() : new Date().toLocaleTimeString();
    const timeEl = document.getElementById('ownerTrackingTime');
    if (timeEl) timeEl.innerText = `সর্বশেষ আপডেট: ${timeText}`;

    const busIcon = L.divIcon({
        className: 'bus-yatra-owner-marker',
        html: `<div style="background-color: #1e3a8a; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: 2.5px solid #facc15; position: relative;">
            🚌
            <span style="position: absolute; top: -3px; right: -3px; width: 12px; height: 12px; background-color: #22c55e; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px #22c55e;"></span>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
    });

    if (!ownerTrackingMap) {
        ownerTrackingMap = L.map('ownerTrackingMap').setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap | Bus Yatra'
        }).addTo(ownerTrackingMap);
        ownerTrackingMarker = L.marker([lat, lng], { icon: busIcon }).addTo(ownerTrackingMap);
    } else {
        ownerTrackingMarker.setIcon(busIcon);
        ownerTrackingMap.setView([lat, lng], 15);
        ownerTrackingMarker.setLatLng([lat, lng]);
        setTimeout(() => ownerTrackingMap.invalidateSize(), 200);
    }

    if (accuracy && accuracy > 0) {
        if (!ownerTrackingAccuracyCircle) {
            ownerTrackingAccuracyCircle = L.circle([lat, lng], {
                radius: accuracy,
                color: '#2563eb',
                weight: 1.5,
                fillColor: '#3b82f6',
                fillOpacity: 0.15
            }).addTo(ownerTrackingMap);
        } else {
            ownerTrackingAccuracyCircle.setLatLng([lat, lng]);
            ownerTrackingAccuracyCircle.setRadius(accuracy);
        }
    } else if (ownerTrackingAccuracyCircle && ownerTrackingMap) {
        ownerTrackingMap.removeLayer(ownerTrackingAccuracyCircle);
        ownerTrackingAccuracyCircle = null;
    }

    const stopStr = stopName ? `<br>📍 কাছাকাছি স্টপেজ: <strong>${escapeHtml(stopName)}</strong>` : '';
    const speedStr = speed && speed > 0 ? `<br>⚡ গতিবেগ: <strong>${speed} km/h</strong>` : '';
    const accStr = accuracy ? `<br>🎯 স্যাটেলাইট নির্ভুলতা: <strong>±${accuracy}m</strong>` : '';
    ownerTrackingMarker.bindPopup(`<strong>🚌 বাসের অবস্থান</strong>${stopStr}${speedStr}${accStr}<br>⏰ ${timeText}`).openPopup();
}

function closeOwnerTracking() {
    const modal = document.getElementById('ownerTrackingModal');
    if (modal) modal.classList.add('hidden');
    if (ownerFirestoreUnsubscribe) {
        ownerFirestoreUnsubscribe();
        ownerFirestoreUnsubscribe = null;
    }
    if (ownerTrackingAccuracyCircle && ownerTrackingMap) {
        ownerTrackingMap.removeLayer(ownerTrackingAccuracyCircle);
        ownerTrackingAccuracyCircle = null;
    }
}
window.closeOwnerTracking = closeOwnerTracking;

// --- Tab 7: Daily Trip Profit & Expense Ledger (লাভ ও খরচ খতিয়ান) ---
let ownerTripExpenses = [];

function initOwnerTripLedger() {
    const busSelect = document.getElementById('ledgerBusSelect');
    const dateInput = document.getElementById('ledgerDateInput');

    if (busSelect && ownerBuses && ownerBuses.length > 0) {
        busSelect.innerHTML = ownerBuses.map(b => `
            <option value="${b.id}">${escapeHtml(b.name)} (${escapeHtml(b.busNumber)}) - ${escapeHtml(b.fromCity)} ➔ ${escapeHtml(b.toCity)}</option>
        `).join('');
    }

    if (dateInput && !dateInput.value) {
        dateInput.value = localDateStr();
    }

    loadOwnerTripLedger();
}
window.initOwnerTripLedger = initOwnerTripLedger;

async function loadOwnerTripLedger() {
    const busSelect = document.getElementById('ledgerBusSelect');
    const dateInput = document.getElementById('ledgerDateInput');
    if (!busSelect || !dateInput) return;

    const busId = busSelect.value;
    const date = dateInput.value;
    if (!busId || !date) return;

    // 1. Calculate Gross Ticket Revenue from approved bookings for this bus & journey date
    let grossRevenue = 0;
    let bookedSeatsCount = 0;
    const bookingsList = Array.isArray(ownerBookingsData) ? ownerBookingsData : (appData.bookings ? Object.values(appData.bookings) : []);

    bookingsList.forEach(b => {
        const bBusId = b.busId || b.bus_id;
        const bDate = b.journeyDate || b.journey_date;
        const bStatus = (b.status || '').toLowerCase();
        if (String(bBusId) === String(busId) && String(bDate) === String(date) && bStatus === 'approved') {
            const seats = Array.isArray(b.seats) ? b.seats.length : (Array.isArray(b.seat_numbers) ? b.seat_numbers.length : 1);
            bookedSeatsCount += seats;
            grossRevenue += Number(b.totalPrice || b.total_price || b.amount || 0);
        }
    });

    // 2. Fetch Trip Expenses from API
    let totalExpenses = 0;
    ownerTripExpenses = [];
    try {
        const res = await apiRequest(`/api/owner/expenses?busId=${encodeURIComponent(busId)}&date=${encodeURIComponent(date)}`);
        ownerTripExpenses = res.expenses || [];
        ownerTripExpenses.forEach(exp => {
            totalExpenses += Number(exp.amount || 0);
        });
    } catch (err) {
        console.warn('Failed to fetch trip expenses:', err);
    }

    // 3. Calculate Net Profit / Loss
    const netProfit = grossRevenue - totalExpenses;
    const marginPercent = grossRevenue > 0 ? ((netProfit / grossRevenue) * 100).toFixed(1) : '0';

    // 4. Update KPI Cards
    const revEl = document.getElementById('ledgerStatRevenue');
    const expEl = document.getElementById('ledgerStatExpenses');
    const profEl = document.getElementById('ledgerStatProfit');
    const seatsEl = document.getElementById('ledgerStatSeats');
    const voucherEl = document.getElementById('ledgerStatVoucherCount');
    const marginEl = document.getElementById('ledgerStatMargin');
    const profCard = document.getElementById('ledgerProfitCard');
    const profTitle = document.getElementById('ledgerProfitTitle');
    const profBadge = document.getElementById('ledgerProfitBadge');
    const profIcon = document.getElementById('ledgerProfitIcon');

    if (revEl) revEl.innerText = `₹${grossRevenue.toLocaleString('en-IN')}`;
    if (expEl) expEl.innerText = `₹${totalExpenses.toLocaleString('en-IN')}`;
    if (seatsEl) seatsEl.innerText = `বুকিং আসন: ${bookedSeatsCount} টি`;
    if (voucherEl) voucherEl.innerText = `ভাউচার: ${ownerTripExpenses.length} টি`;
    if (marginEl) marginEl.innerText = `প্রফিট মার্জিন: ${marginPercent}%`;

    if (profEl && profCard) {
        if (netProfit >= 0) {
            profEl.innerText = `+ ₹${netProfit.toLocaleString('en-IN')}`;
            profEl.className = "text-2xl sm:text-3xl font-black text-emerald-800 mt-1";
            profCard.className = "bg-gradient-to-br from-emerald-50 to-teal-100/70 p-5 rounded-2xl border-2 border-emerald-400 shadow-xs relative overflow-hidden";
            if (profTitle) profTitle.innerText = (typeof window !== "undefined" && typeof window.t === "function") ? window.t("দৈনিক নিট লাভ", "Daily Net Profit") : "Daily Net Profit";
            if (profBadge) {
                profBadge.className = "text-[10px] font-black bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded-full";
                profBadge.innerText = (typeof window !== "undefined" && typeof window.t === "function") ? window.t("🎉 লাভ", "🎉 Profit") : "🎉 Profit";
            }
            if (profIcon) {
                profIcon.className = "p-2.5 bg-emerald-600 text-white rounded-xl text-xl shadow-xs";
                profIcon.innerText = "📈";
            }
        } else {
            profEl.innerText = `- ₹${Math.abs(netProfit).toLocaleString('en-IN')}`;
            profEl.className = "text-2xl sm:text-3xl font-black text-red-700 mt-1";
            profCard.className = "bg-gradient-to-br from-red-50 to-rose-100/70 p-5 rounded-2xl border-2 border-red-400 shadow-xs relative overflow-hidden";
            if (profTitle) profTitle.innerText = (typeof window !== "undefined" && typeof window.t === "function") ? window.t("দৈনিক লোকসান", "Daily Net Loss") : "Daily Net Loss";
            if (profBadge) {
                profBadge.className = "text-[10px] font-black bg-red-200 text-red-950 px-2 py-0.5 rounded-full";
                profBadge.innerText = (typeof window !== "undefined" && typeof window.t === "function") ? window.t("⚠️ লোকসান", "⚠️ Loss") : "⚠️ Loss";
            }
            if (profIcon) {
                profIcon.className = "p-2.5 bg-red-600 text-white rounded-xl text-xl shadow-xs";
                profIcon.innerText = "📉";
            }
        }
    }

    // 5. Render Expense Table
    renderOwnerExpensesTable();
}
window.loadOwnerTripLedger = loadOwnerTripLedger;

const EXPENSE_CATEGORY_MAP = {
    fuel: { label: 'ডিজেল / জ্বালানি', icon: '⛽', color: 'bg-amber-100 text-amber-800 border-amber-300' },
    toll: { label: 'টোল ট্যাক্স', icon: '🛣️', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    batta: { label: 'ড্রাইভার ও স্টাফ বাট্টা', icon: '👨‍✈️', color: 'bg-purple-100 text-purple-800 border-purple-300' },
    parking: { label: 'স্ট্যান্ড ও পার্কিং ফি', icon: '🅿️', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
    police: { label: 'পুলিশ ও রোড চালান', icon: '👮', color: 'bg-red-100 text-red-800 border-red-300' },
    maintenance: { label: 'মেরামত ও মেকানিক', icon: '🔧', color: 'bg-orange-100 text-orange-800 border-orange-300' },
    misc: { label: 'চা/জলখাবার ও বিবিধ', icon: '🍽️', color: 'bg-gray-100 text-gray-800 border-gray-300' }
};

function renderOwnerExpensesTable() {
    const tbody = document.getElementById('ledgerExpensesTableBody');
    const countEl = document.getElementById('ledgerEntriesCount');
    if (!tbody) return;

    if (countEl) countEl.innerText = `${ownerTripExpenses.length}টি এন্ট্রি`;

    if (ownerTripExpenses.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-8 text-gray-400">
                    <span class="text-2xl block mb-1">📝</span>
                    এই ট্রিপ ও তারিখের জন্য কোনো খরচ রেকর্ড করা হয়নি। উপরে ফরম থেকে খরচ যুক্ত করুন।
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = ownerTripExpenses.map(exp => {
        const cat = EXPENSE_CATEGORY_MAP[exp.category] || { label: exp.category, icon: '💸', color: 'bg-gray-100 text-gray-700 border-gray-200' };
        const timeStr = exp.created_at ? new Date(exp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';

        return `
            <tr class="border-b hover:bg-gray-50/80 transition">
                <td class="p-3">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${cat.color}">
                        <span>${cat.icon}</span> <span>${cat.label}</span>
                    </span>
                </td>
                <td class="p-3 font-medium text-gray-800">
                    ${escapeHtml(exp.note || 'বিবরণ নেই')}
                </td>
                <td class="p-3 text-gray-500 font-mono text-[11px]">
                    ${timeStr}
                </td>
                <td class="p-3 text-right font-black text-red-600 text-sm">
                    ₹${Number(exp.amount).toLocaleString('en-IN')}
                </td>
                <td class="p-3 text-center">
                    <button type="button" onclick="deleteOwnerTripExpense('${exp.id}')" class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete Expense">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function setExpenseQuickAmount(amt) {
    const input = document.getElementById('newExpenseAmount');
    if (input) {
        const current = Number(input.value) || 0;
        input.value = current + amt;
    }
}
window.setExpenseQuickAmount = setExpenseQuickAmount;

async function submitOwnerTripExpense() {
    const busSelect = document.getElementById('ledgerBusSelect');
    const dateInput = document.getElementById('ledgerDateInput');
    const catSelect = document.getElementById('newExpenseCategory');
    const amtInput = document.getElementById('newExpenseAmount');
    const noteInput = document.getElementById('newExpenseNote');

    if (!busSelect || !dateInput || !catSelect || !amtInput) return;

    const busId = busSelect.value;
    const journeyDate = dateInput.value;
    const category = catSelect.value;
    const amount = Number(amtInput.value);
    const note = (noteInput?.value || '').trim();

    if (!busId || !journeyDate) {
        alert('অনুগ্রহ করে বাস ও ভ্রমণের তারিখ নির্বাচন করুন।');
        return;
    }
    if (!amount || amount <= 0) {
        alert('অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন (যেমন: 2500)।');
        return;
    }

    try {
        await apiRequest('/api/owner/expenses', {
            method: 'POST',
            body: JSON.stringify({
                busId,
                journeyDate,
                category,
                amount,
                note
            })
        });

        amtInput.value = '';
        if (noteInput) noteInput.value = '';

        await loadOwnerTripLedger();
        alert('✅ ট্রিপ খরচ ভাউচার সফলভাবে খতিয়ানে যুক্ত হয়েছে!');
    } catch (err) {
        alert('খরচ সেভ করা যায়নি: ' + err.message);
    }
}
window.submitOwnerTripExpense = submitOwnerTripExpense;

async function deleteOwnerTripExpense(expenseId) {
    const ok = await showBusYatraConfirm({ title: "খরচ ভাউচার ডিলিট", subtitle: "আপনি কি নিশ্চিত যে এই খরচ ভাউচারটি খতিয়ান থেকে ডিলিট করতে চান?", icon: "🗑️", confirmText: "হ্যাঁ, ডিলিট করুন", cancelText: "বাতিল", danger: true }); if (!ok) return;
    try {
        await apiRequest(`/api/owner/expenses/${encodeURIComponent(expenseId)}`, {
            method: 'DELETE'
        });
        await loadOwnerTripLedger();
    } catch (err) {
        alert('ভাউচার ডিলিট করা যায়নি: ' + err.message);
    }
}
window.deleteOwnerTripExpense = deleteOwnerTripExpense;

function printOwnerTripLedger() {
    window.print();
}
window.printOwnerTripLedger = printOwnerTripLedger;

// --- Tab 5: Captain (Conductor) Management ---
let ownerCaptainsData = [];

async function loadOwnerCaptains() {
    const listEl = document.getElementById('ownerCaptainsList');
    const busSelect = document.getElementById('newCaptainBusSelect');
    if (!listEl) return;

    // Populate bus select
    const buses = (ownerBuses && ownerBuses.length > 0) ? ownerBuses : ((typeof getAppData === 'function' ? getAppData()?.buses : []) || []);
    if (busSelect && buses.length > 0) {
        busSelect.innerHTML = buses.map(b => `<option value="${b.id}">${b.name} (${b.busNumber || b.bus_number || ''})</option>`).join('');
    }

    try {
        listEl.innerHTML = '<div class="text-center text-gray-400 py-6 text-xs">Loading captains...</div>';
        const res = await apiRequest('/api/owner/captains');
        ownerCaptainsData = res.captains || [];

        if (ownerCaptainsData.length === 0) {
            listEl.innerHTML = '<div class="text-center text-gray-400 py-6 text-xs">No captains added yet. Add a conductor above.</div>';
            return;
        }

        listEl.innerHTML = ownerCaptainsData.map(c => {
            const waMsg = encodeURIComponent(`নমস্কার ${c.name || 'ক্যাপ্টেন'}, বাস যাত্রা ক্যাপ্টেন পোর্টালে আপনার লগইন মোবাইল নম্বর: ${c.phone}। পোর্টাল লিঙ্ক: https://busyatra.pages.dev/captain.html`);
            return `
            <div class="p-4 border rounded-2xl bg-white shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-sm text-gray-900">${escapeHtml(c.name || 'Captain')}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${c.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                            ${c.active ? '● Active' : '○ Deactivated'}
                        </span>
                    </div>
                    <div class="text-xs text-gray-600">
                        📱 Mobile: <span class="font-mono font-bold">${c.phone}</span> | 🚌 Bus: <span class="font-medium">${c.bus_name || c.bus_id} (${c.bus_number || ''})</span>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <a href="https://wa.me/91${c.phone}?text=${waMsg}" target="_blank" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1">
                        💬 WhatsApp
                    </a>
                    <button type="button" onclick="resetOwnerCaptainPin('${c.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition">
                        🔑 Set/Reset PIN
                    </button>
                    <button type="button" onclick="toggleOwnerCaptain('${c.id}', ${c.active ? 0 : 1})" class="${c.active ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-green-100 hover:bg-green-200 text-green-800'} px-3 py-1.5 rounded-xl font-bold text-xs transition">
                        ${c.active ? '⏸ Disable' : '▶ Enable'}
                    </button>
                    <button type="button" onclick="deleteOwnerCaptain('${c.id}')" class="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl font-bold text-xs transition">
                        🗑 Delete
                    </button>
                </div>
            </div>
        `;
        }).join('');
    } catch (err) {
        listEl.innerHTML = `<div class="text-center text-red-500 py-6 text-xs">Failed to load captains: ${err.message}</div>`;
    }
}

async function addOwnerCaptain() {
    const busSelect = document.getElementById('newCaptainBusSelect');
    const busId = busSelect ? busSelect.value : (ownerBuses[0] ? ownerBuses[0].id : '');
    const name = (document.getElementById('newCaptainName').value || '').trim();
    const phone = (document.getElementById('newCaptainPhone').value || '').trim();
    const pin = (document.getElementById('newCaptainPin').value || '').trim();

    if (!busId) { alert('Please select a bus.'); return; }
    if (!name || name.length < 2) { alert('Please enter captain name.'); return; }
    if (!/^[6-9]\d{9}$/.test(phone)) { alert('Please enter a valid 10-digit mobile number.'); return; }
    if (!/^\d{4}$/.test(pin)) { alert('Please enter a 4-digit PIN.'); return; }

    try {
        await apiRequest('/api/owner/captains', {
            method: 'POST',
            body: JSON.stringify({ busId, name, phone, pin })
        });
        document.getElementById('newCaptainName').value = '';
        document.getElementById('newCaptainPhone').value = '';
        document.getElementById('newCaptainPin').value = '';
        alert('Captain added successfully! You can send their login details via WhatsApp.');
        loadOwnerCaptains();
    } catch (err) {
        alert(err.message || 'Failed to add captain.');
    }
}

async function toggleOwnerCaptain(id, newActive) {
    try {
        await apiRequest(`/api/owner/captains/${encodeURIComponent(id)}`, {
            method: 'POST',
            body: JSON.stringify({ toggleActive: Boolean(newActive) })
        });
        loadOwnerCaptains();
    } catch (err) {
        alert(err.message || 'Failed to update captain status.');
    }
}

async function resetOwnerCaptainPin(id) {
    const newPin = prompt('Enter new 4-digit PIN for captain:');
    if (!newPin) return;
    if (!/^\d{4}$/.test(newPin.trim())) {
        alert('PIN must be exactly 4 digits.');
        return;
    }

    try {
        await apiRequest(`/api/owner/captains/${encodeURIComponent(id)}`, {
            method: 'POST',
            body: JSON.stringify({ pin: newPin.trim() })
        });
        const captain = ownerCaptainsData.find(item => item.id === id);
        const name = captain?.name || 'Captain';
        const phone = captain?.phone;
        const busName = captain?.bus_name || '';
        const msg = `Hello ${name}, your Bus Yatra Captain PIN is ${newPin.trim()} for ${busName}. Sign in at https://busyatra.pages.dev/captain.html using mobile ${phone}. Please keep your PIN private.`;
        const shareViaWa = await showBusYatraConfirm({ title: "পিন শেয়ার", subtitle: "Open WhatsApp to share this PIN? Choose Cancel/No to open an SMS draft.", icon: "💬", confirmText: "WhatsApp", cancelText: "SMS", danger: false });
        if (shareViaWa) {
            window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
        } else {
            window.location.href = `sms:+91${phone}?body=${encodeURIComponent(msg)}`;
        }
        loadOwnerCaptains();
    } catch (err) {
        alert(err.message || 'Failed to update PIN.');
    }
}

async function deleteOwnerCaptain(id) {
    const ok = await showBusYatraConfirm({ title: "ক্যাপ্টেন অপসারণ", subtitle: "Are you sure you want to remove this captain?", icon: "🗑️", confirmText: "হ্যাঁ, অপসারণ করুন", cancelText: "বাতিল", danger: true }); if (!ok) return;
    try {
        await apiRequest(`/api/owner/captains/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
        alert('Captain removed.');
        loadOwnerCaptains();
    } catch (err) {
        alert(err.message || 'Failed to delete captain.');
    }
}

function openAddBusModal() {
    document.getElementById('newBusName').value = '';
    document.getElementById('newBusNumber').value = '';
    document.getElementById('newBusRoute').value = 'Pingla - Kolkata';
    document.getElementById('newBusTime').value = '05:00 AM';
    document.getElementById('newBusFare').value = '150';
    document.getElementById('newBusSeats').value = '65';
    renderStoppageScheduleEditor(
        'ownerNewBusStoppagesContainer',
        ['Pingla', 'Balaipanda', 'Debra', 'Kharagpur', 'Kolaghat', 'Kolkata'],
        {
            'Pingla': '05:00 AM',
            'Balaipanda': '05:30 AM',
            'Debra': '06:00 AM',
            'Kharagpur': '06:30 AM',
            'Kolaghat': '07:30 AM',
            'Kolkata': '08:45 AM'
        }
    );
    const retCheck = document.getElementById('newBusReturnEnabled');
    if (retCheck) retCheck.checked = false;
    document.getElementById('newBusReturnFields')?.classList.add('hidden');
    const retTimeInput = document.getElementById('newBusReturnTime');
    if (retTimeInput) retTimeInput.value = '03:30 PM';
    const retFareInput = document.getElementById('newBusReturnFare');
    if (retFareInput) retFareInput.value = '150';
    renderStoppageScheduleEditor(
        'ownerNewBusReturnStoppagesContainer',
        ['Kolkata', 'Kolaghat', 'Kharagpur', 'Debra', 'Balaipanda', 'Pingla'],
        {
            'Kolkata': '03:30 PM',
            'Kolaghat': '04:45 PM',
            'Kharagpur': '05:45 PM',
            'Debra': '06:15 PM',
            'Balaipanda': '06:45 PM',
            'Pingla': '07:15 PM'
        }
    );
    document.getElementById('ownerAddBusModal')?.classList.remove('hidden');
}
window.openAddBusModal = openAddBusModal;

function reverseAddBusStoppages() {
    const { stoppages } = collectStoppageSchedule('ownerNewBusStoppagesContainer');
    if (!stoppages || stoppages.length < 2) {
        alert('আপ রুটে পর্যাপ্ত স্টপেজ নেই।');
        return;
    }
    const rev = stoppages.slice().reverse();
    renderStoppageScheduleEditor('ownerNewBusReturnStoppagesContainer', rev, {});
    alert('✅ আপ রুটের স্টপেজ উল্টে ফিরতি রুটে বসানো হয়েছে।');
}
window.reverseAddBusStoppages = reverseAddBusStoppages;

function closeAddBusModal() {
    document.getElementById('ownerAddBusModal')?.classList.add('hidden');
}
window.closeAddBusModal = closeAddBusModal;

async function submitOwnerNewBus() {
    const name = (document.getElementById('newBusName')?.value || '').trim();
    const busNumber = (document.getElementById('newBusNumber')?.value || '').trim().toUpperCase();
    const route = (document.getElementById('newBusRoute')?.value || '').trim();
    const time = (document.getElementById('newBusTime')?.value || '').trim();
    const fare = Number(document.getElementById('newBusFare')?.value) || 150;
    const totalSeats = Number(document.getElementById('newBusSeats')?.value) || 65;
    const { stoppages, stoppageTimings } = collectStoppageSchedule('ownerNewBusStoppagesContainer');

    // Return Route & Stoppages
    const returnRouteEnabled = document.getElementById('newBusReturnEnabled')?.checked || false;
    const returnTime = (document.getElementById('newBusReturnTime')?.value || '').trim();
    const returnFare = Number(document.getElementById('newBusReturnFare')?.value) || fare;
    const returnSchedule = collectStoppageSchedule('ownerNewBusReturnStoppagesContainer');
    const returnStoppages = returnSchedule.stoppages;
    const returnStoppageTimings = returnSchedule.stoppageTimings;
    const returnRoute = (returnStoppages && returnStoppages.length >= 2) ? `${returnStoppages[0]} - ${returnStoppages[returnStoppages.length - 1]}` : (stoppages.slice().reverse().join(' - '));

    if (!name || name.length < 2) {
        alert((typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('অনুগ্রহ করে বাসের নাম লিখুন।', 'Please enter bus name.') : 'Please enter bus name.');
        return;
    }
    if (!busNumber || busNumber.length < 3) {
        alert((typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('অনুগ্রহ করে বাসের রেজিস্ট্রেশন নম্বর লিখুন।', 'Please enter bus registration number.') : 'Please enter bus registration number.');
        return;
    }
    if (!route) {
        alert((typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('অনুগ্রহ করে বাসের রুট লিখুন।', 'Please enter route.') : 'Please enter route.');
        return;
    }
    if (stoppages.length < 2) {
        alert('কমপক্ষে ২টি স্টপেজ (শুরু ও শেষ গন্তব্য) দিন (At least 2 stoppages required).');
        return;
    }

    try {
        const res = await apiRequest('/api/owner/buses', {
            method: 'POST',
            body: JSON.stringify({
                name,
                busNumber,
                route,
                time: time || '07:00 AM',
                fare,
                totalSeats,
                stoppages,
                stoppageTimings,
                returnRouteEnabled,
                returnTime: returnTime || undefined,
                returnFare,
                returnRoute,
                returnStoppages,
                returnStoppageTimings
            })
        });
        alert(res.message || 'বাসটি সফলভাবে যোগ করা হয়েছে এবং অ্যাডমিন অনুমোদনের জন্য জমা হয়েছে!');
        closeAddBusModal();
        await loadOwnerDashboard();
    } catch (err) {
        alert(`Failed to add bus: ${err.message}`);
    }
}
window.submitOwnerNewBus = submitOwnerNewBus;


// --- Feedback QR Code Image Download & Poster Modal ---
function openOwnerFeedbackPosterModal() {
    const modal = document.getElementById('ownerFeedbackPosterModal');
    if (modal) modal.classList.remove('hidden');
}
window.openOwnerFeedbackPosterModal = openOwnerFeedbackPosterModal;

function closeOwnerFeedbackPosterModal() {
    const modal = document.getElementById('ownerFeedbackPosterModal');
    if (modal) modal.classList.add('hidden');
}
window.closeOwnerFeedbackPosterModal = closeOwnerFeedbackPosterModal;

// --- Owner Notifications Management & Received Notices ---
let cachedOwnerNotifications = { sent: [], received: [] };

async function loadOwnerNotifications() {
    const sentList = document.getElementById('ownerSentNotifsList');
    const receivedList = document.getElementById('ownerReceivedNotifsList');
    if (sentList) sentList.innerHTML = `<div class="text-center text-gray-400 py-6 text-xs">Loading sent notifications...</div>`;
    if (receivedList) receivedList.innerHTML = `<div class="text-center text-gray-400 py-6 text-xs">Loading announcements...</div>`;

    populateOwnerNotificationBuses();

    try {
        const res = await apiRequest('/api/owner/notifications');
        cachedOwnerNotifications = {
            sent: res.sent || [],
            received: res.received || []
        };

        // Render Received Admin Notices
        if (receivedList) {
            const received = cachedOwnerNotifications.received;
            if (!received.length) {
                receivedList.innerHTML = `<div class="text-center text-gray-400 py-6 text-xs">${(typeof window !== "undefined" && typeof window.t === "function") ? window.t("কোনো অ্যাডমিন ঘোষণা নেই।", "No announcements from Admin.") : "No announcements from Admin."}</div>`;
            } else {
                receivedList.innerHTML = received.map(n => {
                    const dateStr = new Date(n.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
                    const typeIcon = n.type === 'alert' ? '⚠️' : n.type === 'offer' ? '🎁' : '📢';
                    return `
                    <div class="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs space-y-1.5 shadow-xs">
                        <div class="flex items-center justify-between gap-2 border-b border-amber-200/80 pb-1.5">
                            <div class="flex items-center gap-2">
                                <span class="text-base">${typeIcon}</span>
                                <h4 class="font-bold text-gray-900 text-sm">${escapeHtml(n.title)}</h4>
                            </div>
                            <span class="bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full text-[10px] font-bold">From Admin</span>
                        </div>
                        <p class="text-gray-800 text-xs whitespace-pre-wrap">${escapeHtml(n.message)}</p>
                        <p class="text-[10px] text-gray-500 pt-1">🕒 Received: ${dateStr}</p>
                    </div>`;
                }).join('');
            }
        }

        // Render Sent Notifications List
        if (sentList) {
            const sent = cachedOwnerNotifications.sent;
            if (!sent.length) {
                sentList.innerHTML = `<div class="text-center text-gray-400 py-6 text-xs">আপনি এখনো কোনো নোটিফিকেশন পাঠাননি। ওপরের ফর্মটি পূরণ করে পাঠান।</div>`;
            } else {
                sentList.innerHTML = sent.map(n => {
                    const isPaused = n.status === 'paused';
                    const targetBadge = n.target_group === 'captains'
                        ? '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">👨‍✈️ Captains</span>'
                        : n.target_group === 'booked_customers'
                        ? '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">🎟️ Booked Passengers</span>'
                        : '<span class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[10px] font-bold">👥 Captains & Passengers</span>';
                    
                    const statusBadge = isPaused
                        ? '<span class="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-[10px] font-bold">⏸️ Paused (স্থগিত)</span>'
                        : '<span class="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-[10px] font-bold">🟢 Active (সক্রিয়)</span>';
                    
                    const dateStr = new Date(n.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

                    return `
                    <div class="p-4 rounded-2xl border ${isPaused ? 'bg-yellow-50/50 border-yellow-200 opacity-80' : 'bg-gray-50 border-gray-200'} space-y-2 text-xs transition">
                        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/70 pb-2">
                            <h4 class="font-bold text-gray-900 text-sm">📢 ${escapeHtml(n.title)}</h4>
                            <div class="flex items-center gap-2">
                                ${targetBadge}
                                ${statusBadge}
                            </div>
                        </div>
                        <p class="text-gray-700 text-xs whitespace-pre-wrap">${escapeHtml(n.message)}</p>
                        <div class="flex flex-wrap items-center justify-between pt-2 border-t border-gray-200/70 text-[11px] text-gray-500">
                            <span>🕒 Sent: ${dateStr}</span>
                            <div class="flex items-center gap-2">
                                <button onclick="toggleOwnerNotificationStatus('${n.id}', '${isPaused ? 'active' : 'paused'}')" class="px-3 py-1 rounded-lg font-bold border transition ${isPaused ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'}">
                                    ${isPaused ? '▶️ Resume' : '⏸️ Pause'}
                                </button>
                                <button onclick="deleteOwnerNotification('${n.id}')" class="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold transition">
                                    🗑️ Delete
                                </button>
                            </div>
                        </div>
                    </div>`;
                }).join('');
            }
        }

        // Update badge
        const unreadCount = (cachedOwnerNotifications.received || []).length;
        const badges = [document.getElementById('ownerHeaderNotifBadge'), document.getElementById('ownerUnreadNotifBadge'), document.getElementById('ownerSidebarNotifBadge')];
        badges.forEach(b => {
            if (b) {
                if (unreadCount > 0) {
                    b.innerText = unreadCount;
                    b.classList.remove('hidden');
                } else {
                    b.classList.add('hidden');
                }
            }
        });

    } catch (err) {
        if (sentList) sentList.innerHTML = `<div class="text-center text-red-600 py-6 text-xs">${escapeHtml(err.message)}</div>`;
    }
}
window.loadOwnerNotifications = loadOwnerNotifications;

function populateOwnerNotificationBuses() {
    const sel = document.getElementById('ownerNotifBusSelect');
    if (!sel) return;
    const buses = (ownerBuses && ownerBuses.length > 0) ? ownerBuses : (ownerAppData?.buses || (typeof getAppData === 'function' ? getAppData()?.buses : []) || []);
    sel.innerHTML = `<option value="">-- All My Buses (আমার সকল বাস) --</option>` + 
        buses.map(b => `<option value="${b.id}">${escapeHtml(b.name)} (${escapeHtml(b.busNumber || b.bus_number)})</option>`).join('');
}

async function submitOwnerNotification() {
    const target = document.getElementById('ownerNotifTarget')?.value || 'captains';
    const busId = document.getElementById('ownerNotifBusSelect')?.value || '';
    const type = document.getElementById('ownerNotifType')?.value || 'info';
    const title = (document.getElementById('ownerNotifTitle')?.value || '').trim();
    const message = (document.getElementById('ownerNotifMessage')?.value || '').trim();

    if (!title || !message) {
        alert(window.t('অনুগ্রহ করে নোটিফিকেশনের শিরোনাম এবং বিস্তারিত বার্তা লিখুন।', 'Please enter notification title and message.'));
        return;
    }

    const btn = document.getElementById('btnSendOwnerNotif');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full mr-1.5"></span> Sending...`;

    try {
        await apiRequest('/api/owner/notifications', {
            method: 'POST',
            body: JSON.stringify({ targetGroup: target, busId: busId || null, type, title, message })
        });
        alert('🎉 আপনার নোটিফিকেশন সফলভাবে পাঠানো হয়েছে! (Notification sent successfully!)');
        document.getElementById('ownerNotifTitle').value = '';
        document.getElementById('ownerNotifMessage').value = '';
        await loadOwnerNotifications();
    } catch (err) {
        alert('Failed to send notification: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
    }
}
window.submitOwnerNotification = submitOwnerNotification;

async function toggleOwnerNotificationStatus(id, newStatus) {
    try {
        await apiRequest('/api/owner/notifications/toggle', {
            method: 'POST',
            body: JSON.stringify({ id, status: newStatus })
        });
        await loadOwnerNotifications();
    } catch (err) {
        alert('Error updating status: ' + err.message);
    }
}
window.toggleOwnerNotificationStatus = toggleOwnerNotificationStatus;

async function deleteOwnerNotification(id) {
    const ok = await showBusYatraConfirm({ title: "নোটিফিকেশন ডিলিট", subtitle: "আপনি কি এই নোটিফিকেশনটি মুছে ফেলতে চান? এটি মুছে দিলে কন্ডাক্টর ও যাত্রীদের স্ক্রিন থেকে অবিলম্বে মুছে যাবে।", icon: "🗑️", confirmText: "হ্যাঁ, মুছে ফেলুন", cancelText: "বাতিল", danger: true });
    if (!ok) return;
    try {
        await apiRequest('/api/owner/notifications/delete', {
            method: 'POST',
            body: JSON.stringify({ id })
        });
        await loadOwnerNotifications();
    } catch (err) {
        alert('Error deleting notification: ' + err.message);
    }
}
window.deleteOwnerNotification = deleteOwnerNotification;

window.clearOwnerDateFilter = clearOwnerDateFilter;
window.toggleOwnerSelectAll = toggleOwnerSelectAll;
window.handleOwnerBookingCheckChange = handleOwnerBookingCheckChange;
window.ownerDeleteSingleBooking = ownerDeleteSingleBooking;
window.deleteOwnerSelectedBookings = deleteOwnerSelectedBookings;
window.deleteOwnerAllOnDate = deleteOwnerAllOnDate;

// =========================================================================
// Owner Subscription Due Banner with Live Countdown Timer & Suspension Screen
// =========================================================================
let ownerSubCountdownInterval = null;
let currentActiveSubscription = null;

function showOwnerSuspendedScreen(reasonText) {
    const screen = document.getElementById('ownerSuspendedScreen');
    const reasonEl = document.getElementById('ownerSuspendedReason');
    if (reasonEl && reasonText) {
        reasonEl.innerText = reasonText;
    }
    if (screen) screen.classList.remove('hidden');
}
window.showOwnerSuspendedScreen = showOwnerSuspendedScreen;

function hideOwnerSuspendedScreen() {
    const screen = document.getElementById('ownerSuspendedScreen');
    if (screen) screen.classList.add('hidden');
}
window.hideOwnerSuspendedScreen = hideOwnerSuspendedScreen;

function showOwnerSubscriptionDue(sub) {
    currentActiveSubscription = sub;
    const banner = document.getElementById('ownerSubscriptionDueBanner');
    if (!banner) return;

    const dueAmountEl = document.getElementById('ownerSubDueAmount');
    const planBadgeEl = document.getElementById('ownerSubPlanBadge');
    const noteEl = document.getElementById('ownerSubNote');
    const upiEl = document.getElementById('ownerSubUpiText');

    if (dueAmountEl) dueAmountEl.innerText = `₹${Number(sub.due_amount || 0).toLocaleString('en-IN')}`;
    if (planBadgeEl) planBadgeEl.innerText = sub.plan_type === 'yearly' ? ((typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('বাৎসরিক ফি', 'Yearly Fee') : 'Yearly Fee') : (sub.plan_type === 'monthly' ? ((typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('মাসিক ফি', 'Monthly Fee') : 'Monthly Fee') : ((typeof window !== 'undefined' && typeof window.t === 'function') ? window.t('সার্ভিস চার্জ', 'Service Charge') : 'Service Charge'));
    if (noteEl) noteEl.innerText = sub.note ? `অ্যাডমিন বার্তা: "${sub.note}"` : '';
    if (upiEl && sub.payment_upi) upiEl.innerText = sub.payment_upi;

    banner.classList.remove('hidden');

    // Start 1-second live countdown timer
    if (ownerSubCountdownInterval) clearInterval(ownerSubCountdownInterval);
    updateOwnerCountdownClock(sub.due_date);
    ownerSubCountdownInterval = setInterval(() => {
        updateOwnerCountdownClock(sub.due_date);
    }, 1000);
}
window.showOwnerSubscriptionDue = showOwnerSubscriptionDue;

function hideOwnerSubscriptionDue() {
    const banner = document.getElementById('ownerSubscriptionDueBanner');
    if (banner) banner.classList.add('hidden');
    if (ownerSubCountdownInterval) {
        clearInterval(ownerSubCountdownInterval);
        ownerSubCountdownInterval = null;
    }
    currentActiveSubscription = null;
}
window.hideOwnerSubscriptionDue = hideOwnerSubscriptionDue;

function updateOwnerCountdownClock(dueDateIso) {
    const clockEl = document.getElementById('ownerSubCountdownText');
    if (!clockEl || !dueDateIso) return;

    const diff = new Date(dueDateIso).getTime() - Date.now();
    const pad = n => String(Math.max(0, n)).padStart(2, '0');

    if (diff <= 0) {
        clockEl.innerHTML = `<span class="text-red-300 font-black animate-pulse">⚠️ ${(typeof window !== "undefined" && typeof window.t === "function") ? window.t("সময়সীমা শেষ - দ্রুত পরিশোধ করুন!", "Overdue - Please pay immediately!") : "Overdue - Please pay immediately!"}</span>`;
        return;
    }

    const days = Math.floor(diff / (1000 * 3600 * 24));
    const hours = Math.floor((diff % (1000 * 3600 * 24)) / (1000 * 3600));
    const mins = Math.floor((diff % (1000 * 3600)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    clockEl.innerText = `${pad(days)} দিন : ${pad(hours)} ঘণ্টা : ${pad(mins)} মিনিট : ${pad(secs)} সেকেন্ড`;
}

function copyOwnerSubUpi() {
    const upiText = document.getElementById('ownerSubUpiText')?.innerText || 'support.busyatra@gmail.com';
    navigator.clipboard.writeText(upiText).then(() => {
        alert(`UPI আইডি কপি করা হয়েছে: ${upiText}\n\nআপনার যেকোনো UPI অ্যাপে (Google Pay, PhonePe, Paytm) এই নম্বরে পেমেন্ট করুন।`);
    }).catch(() => {
        prompt('UPI আইডি কপি করুন:', upiText);
    });
}
window.copyOwnerSubUpi = copyOwnerSubUpi;

function notifyOwnerPaymentDone() {
    alert('🎉 ধন্যবাদ! আপনার পেমেন্টের অনুরোধ নথিভুক্ত করা হয়েছে। অ্যাডমিন পেমেন্ট চেক করে অবিলম্বে আপনার ডিউ ক্লিয়ার করে দেবেন। জরুরি প্রয়োজনে অ্যাডমিনকে একটি স্ক্রিনশট পাঠান।');
}
window.notifyOwnerPaymentDone = notifyOwnerPaymentDone;

// --- Promotional Popup Banner Ads for Owner ---
let activePromoData = null;

async function checkAndDisplayActivePromo(target = 'owner') {
    try {
        const res = await apiRequest(`/api/promotions/active?target=${encodeURIComponent(target)}`);
        if (!res || !res.ok || !res.promotion) return;
        const promo = res.promotion;
        activePromoData = promo;

        const sessionDismissed = sessionStorage.getItem(`dismissed_promo_${promo.id}`);
        const lastDismissedTs = localStorage.getItem(`dismissed_promo_ts_${promo.id}`);
        if (sessionDismissed) return;
        if (lastDismissedTs && (Date.now() - parseInt(lastDismissedTs, 10)) < (12 * 3600 * 1000)) return;

        const modal = document.getElementById('promoAdModal');
        const img = document.getElementById('promoAdImage');
        if (!modal || !img) return;

        img.src = promo.image_url;
        img.alt = promo.title || 'Promotional Offer';

        setTimeout(() => {
            modal.classList.remove('hidden');
        }, 1200);
    } catch (err) {
        console.warn('Active promotion check notice:', err);
    }
}

function closePromoAdModal() {
    const modal = document.getElementById('promoAdModal');
    if (modal) modal.classList.add('hidden');
    if (activePromoData) {
        sessionStorage.setItem(`dismissed_promo_${activePromoData.id}`, 'true');
        localStorage.setItem(`dismissed_promo_ts_${activePromoData.id}`, Date.now().toString());
    }
}

function handlePromoAdClick() {
    if (!activePromoData) return;
    const promo = activePromoData;
    if (promo.id) {
        apiRequest(`/api/promotions/${encodeURIComponent(promo.id)}/click`, { method: 'POST' }).catch(() => {});
    }
    if (promo.link_url && promo.link_url.trim()) {
        let link = promo.link_url.trim();
        if (!/^https?:\/\//i.test(link)) {
            link = 'https://' + link;
        }
        window.open(link, '_blank', 'noopener,noreferrer');
    }
    closePromoAdModal();
}

window.closePromoAdModal = closePromoAdModal;
window.handlePromoAdClick = handlePromoAdClick;

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



// Re-render views on language change in Owner Portal
if (typeof window !== 'undefined') {
    window.addEventListener('portal-language-change', () => {
        if (typeof renderOwnerApprovals === 'function') renderOwnerApprovals();
        if (typeof renderPassengerManifest === 'function') renderPassengerManifest();
        if (typeof renderOwnerExpensesTable === 'function') renderOwnerExpensesTable();
        if (typeof loadOwnerBuses === 'function') loadOwnerBuses();
        if (typeof loadOwnerReviews === 'function') loadOwnerReviews();
        if (typeof loadOwnerCaptains === 'function') loadOwnerCaptains();
        if (typeof loadOwnerNotifications === 'function') loadOwnerNotifications();
        if (typeof updateBookingModeBadge === 'function') updateBookingModeBadge();
    });
}
