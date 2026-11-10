// Bus Yatra - Professional Transport Platform Customer Portal Script

let currentLang = 'en';
let lastSearchResults = null;

const translations = {
    en: {
        // Header
        lblHeaderTitle: "Bus Yatra",
        lblHeaderInstall: "Install & QR",
        lblHeaderFeedback: "Feedback QR",
        lblHeaderNotice: "Notice",
        lblHeaderMyBookings: "My Bookings",

        // Mobile Top Quick Banner
        lblMobileBannerTitle: "Bus Yatra Mobile App",
        lblMobileBannerSub: "Book bus tickets quickly & easily",
        btnMobileBannerInstall: "📲 Install",

        // Mobile Bottom Navigation Bar
        lblNavHome: "Home",
        lblNavBookings: "My Bookings",
        lblNavNotice: "Notice",
        lblNavInstall: "Install App",
        lblNavAiSupport: "AI Support",
        lblHeaderAiSupport: "AI Support",

        // Sidebar Menu
        lblMenuTitle: "Bus Yatra Menu",
        lblMenuHome: "🏠 Home / Bus Search",
        lblMenuNotice: "Notifications & Notice",
        lblMenuNoticeBadge: "Notice",
        lblMenuBookings: "🎟️ My Bookings & PDF Ticket",
        lblMenuFeedback: "Passenger Feedback QR",
        lblMenuInstall: "Install App & QR Code",
        lblMenuLogout: "🚪 Logout / Reset",

        // Search Section
        lblSearchTitle: "🔍 Search Bus Route",
        lblFrom: "From (Origin)",
        lblTo: "To (Destination)",
        lblDate: "Journey Date",
        lblQuickToday: "Today",
        lblQuickTomorrow: "Tomorrow",
        lblQuickCustom: "Custom Date 📅",
        searchBusesButton: "Search Buses",
        btnSearch: "Search Buses",

        // Bus List & Seat Selection
        lblAvailableBuses: "Available Buses",
        lblSelectSeatsSub: "Step 1 of 2: Select your seat(s) - 65 Seater Layout",
        lblBack: "← Back to Buses",
        lblAvail: "Available",
        lblSel: "Selected",
        lblBooked: "Sold",
        lblHeld: "Locked (15m)",
        lblSteeringWheel: "🛞 Driver",
        lblEmergencyExit: "Exit",
        lblBoardingPoint: "Boarding Point (Departure)",
        lblDroppingPoint: "Dropping Point (Destination)",
        lblSelSeatsText: "Selected Seats",
        lblTotalFareText: "Total Fare",
        btnProceedToPayment: "Next: Proceed to Payment ➔",

        // Temporary Seat Hold & Payment Section
        lblHoldBannerTitle: "Seats Temporarily Locked (15 Minutes)",
        lblHoldBannerSub: "Please complete your booking within 15 minutes, otherwise seats will be released.",
        lblPayDetailsTitle: "Passenger & Payment Details",
        lblPayDetailsSub: "Step 2 of 2: Review your trip details and complete payment",
        lblChangeSeats: "← Change Seats",
        lblPassengerName: "Passenger Full Name",
        lblPhone: "WhatsApp Mobile Number",
        lblPromo: "Promotional Discount Coupon",
        lblApply: "Apply",
        lblPaymentMethod: "Choose Payment Method",
        lblUpiOpt: "📱 Online UPI / QR",
        lblCashOpt: "💵 Pay on Bus (Cash)",
        lblScanQr: "Scan QR Code or Pay to UPI ID",
        btnConfirmBooking: "✓ Confirm Booking Request",

        // Booking Success
        lblBookingConfirmed: "Booking Request Submitted!",
        lblSuccessSub: "Awaiting approval from Bus Owner. Once approved, your ticket is confirmed and downloadable below.",
        btnDownloadBrandedTicket: "📄 View & Download Branded PDF Ticket",
        btnShareWhatsApp: "💬 Share Details on WhatsApp",
        btnBookAnother: "Book Another Ticket",

        // My Bookings Modal
        lblMyBookingsTitle: "🎟️ My Bookings & Digital Pass",
        lblCloseModal: "✕ Close",
        lblMyBookingsDesc: "Enter your Booking ID and registered 10-digit mobile number to view ticket status, download PDF ticket, and track live bus GPS.",
        btnLookupSearch: "🔍 Find My Ticket",
        lblLookupPlaceholder: "Enter your details above and click Find My Ticket.",

        // Feedback Modal
        lblFeedbackTitle: "⭐ Share Your Trip Feedback",
        lblFeedbackDesc: "Your feedback helps bus operators improve service quality.",
        lblRating: "Rating",
        lblComment: "Comments (Optional)",
        btnSkipFeedback: "Skip",
        btnSubmitFeedback: "Submit Feedback",

        // Live Bus Tracking
        lblTrackingHeader: "Live Bus Tracking",
        lblCloseTracking: "✕ Close",
        lblTrackingStatusLabel: "Status",
        lblTrackingUpdatedLabel: "Last Updated",
        lblMapFooter: "Map updates automatically in real-time with GPS coordinates.",

        // Notice Modal
        lblNoticeModalTitle: "Notice & Announcements",
        lblNoticeModalSub: "Messages from Admin & Bus Operators",
        btnNoticeModalClose: "Close",

        // Customer Auth Modal
        customerAuthModalTitle: "👤 Passenger Portal",
        tabCustomerLoginBtn: "Login",
        tabCustomerRegisterBtn: "Register",
        tabCustomerForgotBtn: "Forgot PIN?",
        lblAuthModalPwaTitle: "Bus Yatra Mobile App",
        lblAuthModalPwaSub: "Install the app before logging in",
        btnAuthModalPwaInstall: "Install Now",
        btnCustomerLoginSubmit: "✓ Secure Login",
        btnCustomerAuthClose: "✕ Close",
        custSendOtpBtn: "Send OTP",
        btnForgotEmailVerifyOtp: "✓ Verify OTP & Reset PIN"
    },
    bn: {
        // Header
        lblHeaderTitle: "বাস যাত্রা",
        lblHeaderInstall: "ইনস্টল ও QR",
        lblHeaderFeedback: "মতামত QR",
        lblHeaderNotice: "নোটিশ",
        lblHeaderMyBookings: "মাই বুকিং",

        // Mobile Top Quick Banner
        lblMobileBannerTitle: "Bus Yatra মোবাইল অ্যাপ",
        lblMobileBannerSub: "দ্রুত ও সহজে বাসের টিকিট কাটুন",
        btnMobileBannerInstall: "📲 ইনস্টল",

        // Mobile Bottom Navigation Bar
        lblNavHome: "হোম",
        lblNavBookings: "মাই বুকিং",
        lblNavNotice: "নোটিশ",
        lblNavInstall: "অ্যাপ ইনস্টল",
        lblNavAiSupport: "সাহায্য",
        lblHeaderAiSupport: "সাহায্য",

        // Sidebar Menu
        lblMenuTitle: "বাস যাত্রা মেনু",
        lblMenuHome: "🏠 হোম / বাস অনুসন্ধান",
        lblMenuNotice: "নোটিফিকেশন ও ঘোষণা",
        lblMenuNoticeBadge: "নোটিশ",
        lblMenuBookings: "🎟️ আমার বুকিং ও ডিজিটাল পাস",
        lblMenuFeedback: "যাত্রী মতামত ও ফিডব্যাক QR",
        lblMenuInstall: "অ্যাপ ইনস্টল ও QR কোড",
        lblMenuLogout: "🚪 লগআউট / রিসেট",

        // Search Section
        lblSearchTitle: "🔍 বাস রুট অনুসন্ধান করুন",
        lblFrom: "কোথা থেকে (শুরু)",
        lblTo: "কোথায় যাবেন (গন্তব্য)",
        lblDate: "যাত্রার তারিখ",
        lblQuickToday: "আজ",
        lblQuickTomorrow: "আগামীকাল",
        lblQuickCustom: "কাস্টম তারিখ 📅",
        searchBusesButton: "বাস খুঁজুন",
        btnSearch: "বাস খুঁজুন",

        // Bus List & Seat Selection
        lblAvailableBuses: "উপলব্ধ বাসসমূহ",
        lblSelectSeatsSub: "ধাপ ১: আপনার আসন নির্বাচন করুন - ৬৫ সিটার লেআউট",
        lblBack: "← বাস তালিকায় ফিরুন",
        lblAvail: "উপলব্ধ",
        lblSel: "নির্বাচিত",
        lblBooked: "বিক্রি হয়ে গেছে",
        lblHeld: "লক করা (১৫মি)",
        lblSteeringWheel: "🛞 চালক",
        lblEmergencyExit: "জরুরি বহির্গমন",
        lblBoardingPoint: "বোর্ডিং পয়েন্ট (যাত্রা শুরু)",
        lblDroppingPoint: "ড্রপিং পয়েন্ট (গন্তব্য)",
        lblSelSeatsText: "নির্বাচিত আসন",
        lblTotalFareText: "মোট ভাড়া",
        btnProceedToPayment: "পরের ধাপ: পেমেন্ট করুন ➔",

        // Temporary Seat Hold & Payment Section
        lblHoldBannerTitle: "আসন সাময়িকভাবে লক করা আছে (১৫ মিনিট)",
        lblHoldBannerSub: "১৫ মিনিটের মধ্যে বুকিং সম্পন্ন করুন, নতুবা আসন উন্মুক্ত হয়ে যাবে।",
        lblPayDetailsTitle: "যাত্রী ও পেমেন্ট বিবরণ",
        lblPayDetailsSub: "ধাপ ২: আপনার ভ্রমণের বিবরণ যাচাই করুন ও পেমেন্ট সম্পন্ন করুন",
        lblChangeSeats: "← আসন পরিবর্তন করুন",
        lblPassengerName: "যাত্রীর পুরো নাম",
        lblPhone: "মোবাইল নম্বর (হোয়াটসঅ্যাপ)",
        lblPromo: "প্রোমো কোড (যেমন BENGAL10)",
        lblApply: "প্রয়োগ করুন",
        lblPaymentMethod: "পেমেন্ট মাধ্যম বেছে নিন",
        lblUpiOpt: "📱 অনলাইন ইউপিআই / কিউআর",
        lblCashOpt: "💵 বাসে ক্যাশ দিন (নগদ)",
        lblScanQr: "কিউআর কোড স্ক্যান করে ইউপিআই অ্যাপে পেমেন্ট করুন",
        btnConfirmBooking: "✓ বুকিং অনুরোধ নিশ্চিত করুন",

        // Booking Success
        lblBookingConfirmed: "বুকিং অনুরোধ জমা হয়েছে!",
        lblSuccessSub: "বাস ওনারের অনুমোদনের অপেক্ষায়। ওনার অনুমোদন করলেই আপনার আসন নিশ্চিত হবে এবং নিচে অফিশিয়াল পিডিএফ টিকিট পাবেন।",
        btnDownloadBrandedTicket: "📄 অফিসিয়াল রঙিন পিডিএফ টিকিট ডাউনলোড করুন",
        btnShareWhatsApp: "💬 হোয়াটসঅ্যাপে শেয়ার করুন",
        btnBookAnother: "আরেকটি টিকিট বুক করুন",

        // My Bookings Modal
        lblMyBookingsTitle: "🎟️ আমার বুকিং ও ডিজিটাল পাস",
        lblCloseModal: "✕ বন্ধ করুন",
        lblMyBookingsDesc: "আপনার বুকিং আইডি এবং নিবন্ধিত ১০ ডিজিটের মোবাইল নম্বর লিখুন টিকিটের স্ট্যাটাস দেখতে, পিডিএফ টিকিট ডাউনলোড করতে এবং লাইভ জিপিএস ট্র্যাক করতে।",
        btnLookupSearch: "🔍 টিকিট খুঁজুন",
        lblLookupPlaceholder: "উপরে আপনার তথ্য লিখুন এবং 'টিকিট খুঁজুন' বাটনে ক্লিক করুন।",

        // Feedback Modal
        lblFeedbackTitle: "⭐ আপনার ভ্রমণের অভিজ্ঞতা জানান",
        lblFeedbackDesc: "আপনার মতামত বাস অপারেটরদের সেবার মান উন্নত করতে সাহায্য করে।",
        lblRating: "রেটিং",
        lblComment: "মন্তব্য (ঐচ্ছিক)",
        btnSkipFeedback: "বাদ দিন",
        btnSubmitFeedback: "মতামত জমা দিন",

        // Live Bus Tracking
        lblTrackingHeader: "লাইভ বাস ট্র্যাকিং",
        lblCloseTracking: "✕ বন্ধ করুন",
        lblTrackingStatusLabel: "স্ট্যাটাস",
        lblTrackingUpdatedLabel: "সর্বশেষ আপডেট",
        lblMapFooter: "জিপিএস স্থানাঙ্কের সাথে মানচিত্রটি স্বয়ংক্রিয়ভাবে রিয়েল-টাইমে আপডেট হয়।",

        // Notice Modal
        lblNoticeModalTitle: "নোটিফিকেশন ও ঘোষণা",
        lblNoticeModalSub: "অ্যাডমিন ও বাস কর্তৃপক্ষের বার্তা",
        btnNoticeModalClose: "বন্ধ করুন",

        // Customer Auth Modal
        customerAuthModalTitle: "👤 যাত্রী অ্যাকাউন্ট",
        tabCustomerLoginBtn: "লগইন",
        tabCustomerRegisterBtn: "নতুন রেজিস্ট্রেশন",
        tabCustomerForgotBtn: "পিন ভুলে গেছেন?",
        lblAuthModalPwaTitle: "Bus Yatra মোবাইল অ্যাপ",
        lblAuthModalPwaSub: "লগইনের আগে অ্যাপটি ইনস্টল করে নিন",
        btnAuthModalPwaInstall: "ইনস্টল করুন",
        btnCustomerLoginSubmit: "✓ লগইন করুন",
        btnCustomerAuthClose: "✕ বন্ধ করুন",
        custSendOtpBtn: "ওটিপি পাঠান",
        btnForgotEmailVerifyOtp: "✓ ওটিপি যাচাই করে পিন রিসেট করুন"
    }
};

function changeLang(lang) {
    if (typeof setPortalLanguage === 'function' && typeof getPortalLanguage === 'function' && getPortalLanguage() !== lang) {
        setPortalLanguage(lang);
        return;
    }
    changeLangInternal(lang);
}
window.changeLang = changeLang;

function changeLangInternal(lang) {
    currentLang = lang;
    try {
        localStorage.setItem('busyatra_preferred_lang', lang);
        localStorage.setItem('busyatra_lang', lang);
    } catch (_) {}

    const t = translations[lang] || translations.en;

    const bnBtn = document.getElementById('langBnBtn');
    const enBtn = document.getElementById('langEnBtn');
    if (lang === 'bn') {
        if (bnBtn) bnBtn.className = "px-2 py-0.5 rounded text-xs font-bold bg-white text-red-600 shadow-sm transition";
        if (enBtn) enBtn.className = "px-2 py-0.5 rounded text-xs font-bold text-white hover:bg-red-800 transition";
    } else {
        if (enBtn) enBtn.className = "px-2 py-0.5 rounded text-xs font-bold bg-white text-red-600 shadow-sm transition";
        if (bnBtn) bnBtn.className = "px-2 py-0.5 rounded text-xs font-bold text-white hover:bg-red-800 transition";
    }

    Object.keys(t).forEach(key => {
        const el = document.getElementById(key);
        if (el) el.innerText = t[key];
    });

    const fromInput = document.getElementById('fromCityInput');
    const toInput = document.getElementById('toCityInput');
    const nameInput = document.getElementById('passengerName');
    const phoneInput = document.getElementById('passengerPhone');
    const promoInput = document.getElementById('promoCodeInput');
    const lookupId = document.getElementById('lookupBookingId');
    const lookupPhone = document.getElementById('lookupPhone');
    const loginPhone = document.getElementById('customerLoginPhone');
    const forgotEmail = document.getElementById('custForgotOtpEmail');
    const resetOtp = document.getElementById('custResetOtp');

    if (fromInput) fromInput.placeholder = lang === 'bn' ? "কোথা থেকে যাত্রা শুরু..." : "Type or search origin...";
    if (toInput) toInput.placeholder = lang === 'bn' ? "কোথায় যাবেন..." : "Type or search destination...";
    if (nameInput) nameInput.placeholder = lang === 'bn' ? "পুরো নাম লিখুন" : "Enter full name";
    if (phoneInput) phoneInput.placeholder = lang === 'bn' ? "১০ ডিজিটের মোবাইল নম্বর" : "10-digit mobile number";
    if (promoInput) promoInput.placeholder = lang === 'bn' ? "কুপন কোড লিখুন" : "Enter coupon code";
    if (lookupId) lookupId.placeholder = lang === 'bn' ? "বুকিং আইডি (যেমন BK_XXXX)" : "Booking ID (e.g. BK_XXXX)";
    if (lookupPhone) lookupPhone.placeholder = lang === 'bn' ? "১০ ডিজিটের মোবাইল নম্বর" : "10-digit mobile number";
    if (loginPhone) loginPhone.placeholder = lang === 'bn' ? "১০ সংখ্যার মোবাইল নম্বর দিন" : "Enter 10-digit mobile number";
    if (forgotEmail) forgotEmail.placeholder = lang === 'bn' ? "আপনার রেজিস্টার্ড ইমেইল (যেমন name@gmail.com)" : "Your registered email (e.g. name@gmail.com)";
    if (resetOtp) resetOtp.placeholder = lang === 'bn' ? "৬ সংখ্যার ওটিপি দিন" : "Enter 6-digit OTP";

    const swapBtn = document.getElementById('btnSwapRoute');
    if (swapBtn) swapBtn.title = lang === 'bn' ? "রুট অদলবদল করুন (Swap Origin & Destination)" : "Swap Origin & Destination";

    // Explicit mobile bottom nav bar translation sync
    const navHome = document.getElementById('lblNavHome');
    if (navHome) navHome.innerText = lang === 'bn' ? 'হোম' : 'Home';
    const navBookings = document.getElementById('lblNavBookings');
    if (navBookings) navBookings.innerText = lang === 'bn' ? 'মাই বুকিং' : 'My Bookings';
    const navSos = document.getElementById('lblNavSos');
    if (navSos) navSos.innerText = lang === 'bn' ? 'এসওএস' : 'SOS';
    const navNotice = document.getElementById('lblNavNotice');
    if (navNotice) navNotice.innerText = lang === 'bn' ? 'নোটিশ' : 'Notice';
    const navInstall = document.getElementById('lblNavInstall');
    if (navInstall) navInstall.innerText = lang === 'bn' ? 'অ্যাপ ইনস্টল' : 'Install App';

    if (typeof initCustomerSession === 'function') {
        initCustomerSession();
    }

    // Live re-render bus cards if currently displayed
    const busListSection = document.getElementById('busListSection');
    if (busListSection && !busListSection.classList.contains('hidden') && lastSearchResults) {
        renderAvailableBuses(lastSearchResults.availableBuses, lastSearchResults.from, lastSearchResults.to);
    }
}

// App State
let selectedBusId = null;
let selectedJourneyDate = localDateStr();
let selectedSeatsSet = new Set();
let currentBusFare = 399;
let currentBusFarePerStop = 45;
let windowSeatExtra = 0;
let currentDiscount = 0;
let appliedPromoName = "";
let pendingPaymentMode = "UPI";
let activeBooking = null;
let successBookingPoll = null;
let lastTicketText = "";
let bookedSeatsForSelection = new Set();
let heldSeatsForSelection = new Set();
let myHeldSeatsForSelection = new Set();
let seatHoldTimerInterval = null;
let seatHoldRemainingSeconds = 0;
let dropdownToastTimer = null;

// Persistent Client Session ID for 15-Minute Seat Locks
function getClientSessionId() {
    let sid = localStorage.getItem('busyatra_client_session_id');
    if (!sid) {
        sid = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
        localStorage.setItem('busyatra_client_session_id', sid);
    }
    return sid;
}

// 5-Second Auto-Dismiss Drop-Down Toast Notification
function showDropDownToast(message, type = 'info', title = null) {
    const toast = document.getElementById('dropdownToast');
    const toastContent = document.getElementById('dropdownToastContent');
    const toastIcon = document.getElementById('dropdownToastIcon');
    const toastTitle = document.getElementById('dropdownToastTitle');
    const toastMsg = document.getElementById('dropdownToastMessage');
    if (!toast || !toastMsg) {
        console.log(`[Toast ${type}]: ${message}`);
        return;
    }

    if (dropdownToastTimer) {
        clearTimeout(dropdownToastTimer);
        dropdownToastTimer = null;
    }

    let defaultTitle = 'Notification';
    let icon = '🔔';
    let titleColor = 'text-yellow-400';
    let borderColor = 'border-white/20';

    if (type === 'success') {
        icon = '🎉';
        defaultTitle = currentLang === 'bn' ? 'সফল' : 'Success';
        titleColor = 'text-green-400';
        borderColor = 'border-green-500/40';
    } else if (type === 'error') {
        icon = '⚠️';
        defaultTitle = currentLang === 'bn' ? 'ত্রুটি' : 'Error';
        titleColor = 'text-red-400';
        borderColor = 'border-red-500/40';
    } else if (type === 'warning') {
        icon = '⏱️';
        defaultTitle = currentLang === 'bn' ? 'সতর্কতা' : 'Notice';
        titleColor = 'text-amber-400';
        borderColor = 'border-amber-500/40';
    } else {
        icon = '🔔';
        defaultTitle = currentLang === 'bn' ? 'বিজ্ঞপ্তি' : 'Notification';
        titleColor = 'text-blue-400';
        borderColor = 'border-blue-500/40';
    }

    if (toastIcon) toastIcon.innerText = icon;
    if (toastTitle) {
        toastTitle.innerText = title || defaultTitle;
        toastTitle.className = `text-[11px] font-black uppercase tracking-wider ${titleColor}`;
    }
    toastMsg.innerText = message;
    if (toastContent) {
        toastContent.className = `pointer-events-auto bg-gray-900/95 text-white backdrop-blur-md px-5 py-3.5 rounded-2xl shadow-2xl border ${borderColor} flex items-center gap-3.5 max-w-md w-full`;
    }

    // Slide down smoothly
    toast.classList.remove('-translate-y-full');
    toast.classList.add('translate-y-0');

    // Exactly 5 seconds auto-dismiss
    dropdownToastTimer = setTimeout(() => {
        toast.classList.remove('translate-y-0');
        toast.classList.add('-translate-y-full');
    }, 5000);
}
window.showDropDownToast = showDropDownToast;

let currentSeatHoldExpiresAt = null;

// 15-Minute Seat Hold Countdown Timer (Persistent across page reloads & background tabs)
function startSeatHoldTimer(seconds = 15 * 60, expiresAtIso = null) {
    if (seatHoldTimerInterval) {
        clearInterval(seatHoldTimerInterval);
        seatHoldTimerInterval = null;
    }

    if (expiresAtIso) {
        currentSeatHoldExpiresAt = expiresAtIso;
        try { sessionStorage.setItem('seat_hold_expires_at', expiresAtIso); } catch (_) {}
    } else {
        const stored = sessionStorage.getItem('seat_hold_expires_at');
        if (stored && new Date(stored).getTime() > Date.now()) {
            currentSeatHoldExpiresAt = stored;
        } else {
            currentSeatHoldExpiresAt = new Date(Date.now() + seconds * 1000).toISOString();
            try { sessionStorage.setItem('seat_hold_expires_at', currentSeatHoldExpiresAt); } catch (_) {}
        }
    }

    const banner = document.getElementById('seatHoldCountdownBanner');
    const display = document.getElementById('seatHoldTimerDisplay');
    if (banner) banner.classList.remove('hidden');

    function updateDisplay() {
        const targetMs = new Date(currentSeatHoldExpiresAt).getTime();
        const diffMs = targetMs - Date.now();
        const remaining = Math.max(0, Math.floor(diffMs / 1000));
        seatHoldRemainingSeconds = remaining;

        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        const str = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        if (display) display.innerText = str;
        return remaining;
    }

    const initialRemaining = updateDisplay();
    if (initialRemaining <= 0) {
        handleSeatHoldExpiry();
        return;
    }

    seatHoldTimerInterval = setInterval(async () => {
        const remaining = updateDisplay();
        if (remaining <= 0) {
            await handleSeatHoldExpiry();
        }
    }, 1000);
}

async function handleSeatHoldExpiry() {
    stopSeatHoldTimer();
    showDropDownToast(
        currentLang === 'bn'
            ? '⚠️ আপনার ১৫ মিনিটের সময়সীমা শেষ হয়েছে। আসনগুলি পুনরায় সবার জন্য উন্মুক্ত করা হয়েছে।'
            : '⚠️ Your 15-minute seat hold has expired. Seats have been released.',
        'warning'
    );
    await releaseSeatHold();
    selectedSeatsSet.clear();
    backToSeatSelection();
    const bus = (getAppData().buses || []).find(b => b.id === selectedBusId);
    if (bus) {
        await loadBookedSeats(bus);
    }
}

function stopSeatHoldTimer(clearStored = true) {
    if (seatHoldTimerInterval) {
        clearInterval(seatHoldTimerInterval);
        seatHoldTimerInterval = null;
    }
    currentSeatHoldExpiresAt = null;
    if (clearStored) {
        try { sessionStorage.removeItem('seat_hold_expires_at'); } catch (_) {}
    }
    const banner = document.getElementById('seatHoldCountdownBanner');
    if (banner) banner.classList.add('hidden');
}

async function releaseSeatHold(seatsToRelease = null) {
    if (!seatsToRelease) {
        stopSeatHoldTimer(true);
    }
    const sid = getClientSessionId();
    if (!sid) return;

    const payload = JSON.stringify({
        busId: selectedBusId || '',
        journeyDate: selectedJourneyDate || '',
        sessionId: sid,
        seats: Array.isArray(seatsToRelease) ? seatsToRelease : null
    });

    try {
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            navigator.sendBeacon('/api/seats/release', new Blob([payload], { type: 'application/json' }));
        }
    } catch {}

    try {
        await apiRequest('/api/seats/release', {
            method: 'POST',
            body: payload
        });
    } catch (e) {
        console.warn('Could not release seat hold:', e);
    }
}

// Seat hold cleanup is managed safely via explicit user cancellation or automatic 15-minute expiration in D1.
// We avoid aggressive pagehide beaconing so passengers can switch to UPI apps (PhonePe/GPay) or refresh without losing their seats.

const popularStoppages = [
    "Pingla",
    "Balaipanda",
    "Jalchak",
    "Debra",
    "Kharagpur",
    "Midnapore",
    "Mecheda",
    "Kolaghat",
    "Bagnan",
    "Uluberia",
    "Santragachi",
    "Howrah",
    "Kolkata",
    "Digha",
    "Mandarmani",
    "Haldia",
    "Burdwan",
    "Durgapur",
    "Asansol",
    "Siliguri",
    "Malda",
    "Berhampore",
    "Darjeeling",
    "Bhubaneswar",
    "Puri",
    "Ranchi",
    "Patna",
    "Delhi",
    "Mumbai",
    "Bengaluru"
];

function getAllAvailableStoppages() {
    const list = [...popularStoppages];
    const seen = new Set(popularStoppages.map(s => s.toLowerCase()));
    const db = getAppData();
    (db.buses || []).forEach(b => {
        (b.stoppages || []).forEach(stop => {
            if (stop && typeof stop === 'string' && stop.trim()) {
                const clean = stop.trim();
                if (!seen.has(clean.toLowerCase())) {
                    seen.add(clean.toLowerCase());
                    list.push(clean);
                }
            }
        });
    });
    return list;
}
window.getAllAvailableStoppages = getAllAvailableStoppages;

function exitAdminCustomerImpersonation() {
    localStorage.removeItem('customer_session');
    sessionStorage.removeItem('customer_session');
    localStorage.removeItem('busyatra_customer');
    sessionStorage.removeItem('busyatra_customer');
    localStorage.removeItem('portal_session_customer');
    sessionStorage.removeItem('portal_session_customer');
    if (window.opener && !window.opener.closed) {
        window.close();
    } else {
        window.location.href = 'admin.html#customers';
    }
}
window.exitAdminCustomerImpersonation = exitAdminCustomerImpersonation;

window.addEventListener('DOMContentLoaded', () => {
    // Check for Admin Impersonation URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('auth_token');
    const isAdmin = urlParams.get('admin') === '1';
    const customerPhone = urlParams.get('customer_phone') || '';

    if (authToken && isAdmin) {
        const banner = document.getElementById('adminImpersonationBanner');
        const text = document.getElementById('adminImpersonationText');
        if (banner) banner.classList.remove('hidden');

        const sessionData = JSON.stringify({
            token: authToken,
            expiresAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
            phone: customerPhone,
            impersonatedByAdmin: true
        });
        localStorage.setItem('customer_session', sessionData);
        sessionStorage.setItem('customer_session', sessionData);
        localStorage.setItem('portal_session_customer', JSON.stringify({ token: authToken }));
        sessionStorage.setItem('portal_session_customer', JSON.stringify({ token: authToken }));
        if (customerPhone) {
            localStorage.setItem('last_customer_phone', customerPhone);
        }

        window.history.replaceState({}, document.title, window.location.pathname);

        apiRequest('/api/customer/me', { headers: { Authorization: `Bearer ${authToken}` } })
            .then(res => {
                if (res && res.customer) {
                    localStorage.setItem('busyatra_customer', JSON.stringify(res.customer));
                    sessionStorage.setItem('busyatra_customer', JSON.stringify(res.customer));
                    if (text) {
                        text.innerText = `আপনি অ্যাডমিন হিসেবে "${res.customer.name || 'Customer'} (${res.customer.phone})"-এর কাস্টমার প্যানেলে রয়েছেন।`;
                    }
                    initCustomerSession();
                }
            })
            .catch(err => console.warn('Admin customer impersonation profile fetch failed:', err));
    } else {
        try {
            const raw = localStorage.getItem('customer_session') || sessionStorage.getItem('customer_session');
            const sess = raw ? JSON.parse(raw) : null;
            if (sess && sess.impersonatedByAdmin) {
                const banner = document.getElementById('adminImpersonationBanner');
                const text = document.getElementById('adminImpersonationText');
                if (banner) banner.classList.remove('hidden');
                const cust = getLoggedInCustomer();
                if (text && cust) {
                    text.innerText = `আপনি অ্যাডমিন হিসেবে "${cust.name || 'Customer'} (${cust.phone})"-এর কাস্টমার প্যানেলে রয়েছেন।`;
                }
            }
        } catch (_) {}
    }

    const dateInput = document.getElementById('journeyDate');
    if (dateInput) {
        const today = localDateStr();
        dateInput.value = today;
        dateInput.min = today;
    }
    initCityAutocomplete();
    initCustomerSession();
    validateCustomerSession();
    loadCustomerNotifications();
    const initialLang = localStorage.getItem('busyatra_preferred_lang') || 'en';
    changeLang(initialLang);
    loadPublicBuses();
    checkAndDisplayActivePromo('customer');
});

// --- Promotional Popup Banner Ads ---
let activePromoData = null;

async function checkAndDisplayActivePromo(target = 'customer') {
    try {
        const res = await apiRequest(`/api/promotions/active?target=${encodeURIComponent(target)}`);
        if (!res || !res.ok || !res.promotion) return;
        const promo = res.promotion;
        activePromoData = promo;

        // Dismissal check: don't show if dismissed in this session, or dismissed within last 12 hours
        const sessionDismissed = sessionStorage.getItem(`dismissed_promo_${promo.id}`);
        const lastDismissedTs = localStorage.getItem(`dismissed_promo_ts_${promo.id}`);
        if (sessionDismissed) return;
        if (lastDismissedTs && (Date.now() - parseInt(lastDismissedTs, 10)) < (12 * 3600 * 1000)) return;

        const modal = document.getElementById('promoAdModal');
        const img = document.getElementById('promoAdImage');
        if (!modal || !img) return;

        img.src = promo.image_url;
        img.alt = promo.title || 'Promotional Offer';

        // Show after smooth 1.2s delay for natural UX
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
    // Track click asynchronously
    if (promo.id) {
        apiRequest(`/api/promotions/${encodeURIComponent(promo.id)}/click`, { method: 'POST' }).catch(() => {});
    }
    // If a website link is configured, open in new tab
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

async function loadPublicBuses() {
    // 0. Immediate optimistic render from local cache (< 2ms!)
    const cachedData = getAppData();
    if (cachedData && cachedData.buses?.length) {
        try {
            restoreCustomerFlowState();
            initCityAutocomplete();
        } catch (_) {}
    }

    try {
        const [result, config] = await Promise.all([
            apiRequest('/api/buses'),
            apiRequest('/api/config')
        ]);
        setAppData({ buses: result.buses, featureFlags: config.featureFlags });
        await restoreCustomerFlowState();
        initCityAutocomplete();
    } catch (error) {
        console.error('Failed to load buses:', error);
    }
}

// --- Customer Booking Flow State Persistence (Across Page Reloads / Refreshes) ---
function saveCustomerFlowState(partial = {}) {
    try {
        const existing = JSON.parse(sessionStorage.getItem('customer_flow_state') || '{}');
        const updated = {
            ...existing,
            ...partial,
            from: (document.getElementById('fromCityInput')?.value || '').trim() || existing.from || '',
            to: (document.getElementById('toCityInput')?.value || '').trim() || existing.to || '',
            date: document.getElementById('journeyDate')?.value || existing.date || '',
            timestamp: Date.now()
        };
        sessionStorage.setItem('customer_flow_state', JSON.stringify(updated));
    } catch (e) {
        console.warn('Could not save customer flow state:', e);
    }
}

function clearCustomerFlowState() {
    sessionStorage.removeItem('customer_flow_state');
}

function getCustomerFlowState() {
    try {
        const raw = sessionStorage.getItem('customer_flow_state');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

async function restoreCustomerFlowState() {
    const customer = getLoggedInCustomer();
    if (!customer) return;

    const state = getCustomerFlowState();
    if (!state || !state.step) return;

    // Discard state older than 2 hours
    if (state.timestamp && (Date.now() - state.timestamp > 2 * 60 * 60 * 1000)) {
        clearCustomerFlowState();
        return;
    }

    if (state.from) {
        const fromInput = document.getElementById('fromCityInput');
        if (fromInput) fromInput.value = state.from;
    }
    if (state.to) {
        const toInput = document.getElementById('toCityInput');
        if (toInput) toInput.value = state.to;
    }
    if (state.date) {
        const dateInput = document.getElementById('journeyDate');
        if (dateInput) dateInput.value = state.date;
    }

    if (state.step === 'bus_list') {
        await searchBuses(true);
    } else if (state.step === 'seat_selection' && state.busId) {
        await searchBuses(true);
        const bus = (getAppData().buses || []).find(b => b.id === state.busId);
        if (bus) {
            await openSeatSelection(
                bus.id,
                bus.name,
                bus.fare,
                bus.fare_per_stop || bus.farePerStop,
                bus.total_seats || bus.totalSeats || 65,
                bus.window_seat_extra || bus.windowSeatExtra || 0,
                true
            );
            if (Array.isArray(state.selectedSeats) && state.selectedSeats.length > 0) {
                selectedSeatsSet.clear();
                state.selectedSeats.forEach(seat => selectedSeatsSet.add(seat));
                render65SeatsGrid(bus);
                updateFareDisplay();
            }
        }
    } else if (state.step === 'payment' && state.busId) {
        await searchBuses(true);
        const bus = (getAppData().buses || []).find(b => b.id === state.busId);
        if (bus) {
            await openSeatSelection(
                bus.id,
                bus.name,
                bus.fare,
                bus.fare_per_stop || bus.farePerStop,
                bus.total_seats || bus.totalSeats || 65,
                bus.window_seat_extra || bus.windowSeatExtra || 0,
                true
            );
            if (Array.isArray(state.selectedSeats) && state.selectedSeats.length > 0) {
                selectedSeatsSet.clear();
                state.selectedSeats.forEach(seat => selectedSeatsSet.add(seat));
                render65SeatsGrid(bus);
                updateFareDisplay();
            }
            if (state.boarding) {
                const bSelect = document.getElementById('boardingPointSelect');
                if (bSelect) bSelect.value = state.boarding;
            }
            if (state.dropping) {
                const dSelect = document.getElementById('droppingPointSelect');
                if (dSelect) dSelect.value = state.dropping;
            }
            await goToPaymentPage(true);
            if (state.passengerName) {
                const pName = document.getElementById('passengerName');
                if (pName) pName.value = state.passengerName;
            }
            if (state.passengerPhone) {
                const pPhone = document.getElementById('passengerPhone');
                if (pPhone) pPhone.value = state.passengerPhone;
            }
        }
    }
}

// --- Customer Authentication & 4-Digit PIN Management ---
let customerAuthPendingAction = null;
function getLoggedInCustomer() {
    try {
        const session = JSON.parse(localStorage.getItem('customer_session') || sessionStorage.getItem('customer_session') || 'null');
        if (!session || !session.token) return null;
        const raw = localStorage.getItem('busyatra_customer') || sessionStorage.getItem('busyatra_customer');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

async function validateCustomerSession() {
    try {
        const result = await apiRequest('/api/customer/me');
        if (result && result.customer) {
            localStorage.setItem('busyatra_customer', JSON.stringify(result.customer));
            sessionStorage.setItem('busyatra_customer', JSON.stringify(result.customer));
            try {
                let s = JSON.parse(localStorage.getItem('customer_session') || sessionStorage.getItem('customer_session') || '{}');
                if (s && s.token) {
                    s.phone = result.customer.phone;
                    s.name = result.customer.name;
                    s.email = result.customer.email;
                    localStorage.setItem('customer_session', JSON.stringify(s));
                    sessionStorage.setItem('customer_session', JSON.stringify(s));
                }
            } catch (_) {}
            localStorage.setItem('last_customer_phone', result.customer.phone);
            if (result.customer.features) {
                applyCustomerFeatures(result.customer.features);
            }
            initCustomerSession();
        }
    } catch (error) {
        if (error.status === 401 || error.status === 403) {
            localStorage.removeItem('customer_session');
            sessionStorage.removeItem('customer_session');
            localStorage.removeItem('busyatra_customer');
            sessionStorage.removeItem('busyatra_customer');
            initCustomerSession();
            if (error.status === 403) {
                alert(error.message || '⚠️ আপনার কাস্টমার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত রয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।');
            }
            return;
        }
        console.warn('Could not validate customer session:', error);
    }
}

function initCustomerSession() {
    const customer = getLoggedInCustomer();
    let globalFeatures = {};
    try {
        globalFeatures = JSON.parse(localStorage.getItem('busyatra_global_nextgen_features') || '{}');
    } catch (_) {}
    const features = {
        ...globalFeatures,
        ...(customer && customer.features ? customer.features : {})
    };
    applyCustomerFeatures(features);
    const headerName = document.getElementById('headerCustomerName');
    const sidebarText = document.getElementById('lblSidebarAuthText');
    const logoutBtn = document.getElementById('lblMenuLogout');
    const passengerName = document.getElementById('passengerName');
    const passengerPhone = document.getElementById('passengerPhone');
    const lookupPhone = document.getElementById('lookupPhone');

    const bottomCustomerName = document.getElementById('mobileBottomCustomerName');
    if (customer && customer.phone) {
        const shortName = (customer.name || '').split(' ')[0] || customer.name;
        if (headerName) headerName.innerText = shortName;
        if (bottomCustomerName) bottomCustomerName.innerText = shortName;
        if (sidebarText) sidebarText.innerText = currentLang === 'bn' ? `যাত্রী: ${customer.name}` : `Passenger: ${customer.name}`;
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        if (passengerName) passengerName.value = customer.name || '';
        if (passengerPhone) passengerPhone.value = customer.phone || '';
        if (lookupPhone && !lookupPhone.value) lookupPhone.value = customer.phone;
    } else {
        if (headerName) headerName.innerText = currentLang === 'bn' ? 'লগইন / রেজিস্টার' : 'Login / Register';
        if (bottomCustomerName) bottomCustomerName.innerText = currentLang === 'bn' ? 'লগইন' : 'Login';
        if (sidebarText) sidebarText.innerText = currentLang === 'bn' ? 'লগইন / নতুন অ্যাকাউন্ট' : 'Login / Register';
        if (logoutBtn) logoutBtn.classList.add('hidden');
    }
}

function openCustomerAuthModal(tab = 'login', pendingContext = null) {
    customerAuthPendingAction = pendingContext;
    const modal = document.getElementById('customerAuthModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    switchCustomerAuthTab(tab);
    const lastPhone = localStorage.getItem('last_customer_phone');
    if (lastPhone) {
        const phoneInput = document.getElementById('customerLoginPhone');
        if (phoneInput && !phoneInput.value) phoneInput.value = lastPhone;
    }
}

function closeCustomerAuthModal() {
    const modal = document.getElementById('customerAuthModal');
    if (modal) modal.classList.add('hidden');
}

function switchCustomerAuthTab(tab) {
    const loginForm = document.getElementById('customerLoginForm');
    const registerForm = document.getElementById('customerRegisterForm');
    const forgotForm = document.getElementById('customerForgotForm');
    const tabLoginBtn = document.getElementById('tabCustomerLoginBtn');
    const tabRegBtn = document.getElementById('tabCustomerRegisterBtn');
    const tabForgotBtn = document.getElementById('tabCustomerForgotBtn');

    if (!loginForm || !registerForm || !forgotForm) return;

    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    forgotForm.classList.add('hidden');

    tabLoginBtn.className = 'flex-1 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-800 transition';
    tabRegBtn.className = 'flex-1 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-800 transition';
    tabForgotBtn.className = 'flex-1 py-3 border-b-2 border-transparent text-gray-500 hover:text-gray-800 transition';

    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        tabLoginBtn.className = 'flex-1 py-3 border-b-2 border-red-600 text-red-600 bg-white font-bold transition';
    } else if (tab === 'register') {
        registerForm.classList.remove('hidden');
        tabRegBtn.className = 'flex-1 py-3 border-b-2 border-red-600 text-red-600 bg-white font-bold transition';
    } else if (tab === 'forgot') {
        forgotForm.classList.remove('hidden');
        tabForgotBtn.className = 'flex-1 py-3 border-b-2 border-red-600 text-red-600 bg-white font-bold transition';
        switchCustForgotSubTab('otp');
    }
}

async function submitCustomerLogin() {
    const phone = (document.getElementById('customerLoginPhone').value || '').trim();
    const pin = (document.getElementById('customerLoginPin').value || '').trim();

    if (!/^[6-9]\d{9}$/.test(phone)) {
        alert(currentLang === 'bn' ? 'অনুগ্রহ করে সঠিক ১০-সংখ্যার মোবাইল নম্বর দিন।' : 'Please enter a valid 10-digit mobile number.');
        return;
    }
    if (!/^\d{4}$/.test(pin)) {
        alert(currentLang === 'bn' ? 'অনুগ্রহ করে আপনার ৪-সংখ্যার গোপন পিন দিন।' : 'Please enter your 4-digit PIN.');
        return;
    }

    try {
        const res = await apiRequest('/api/customer/login', {
            method: 'POST',
            body: JSON.stringify({ phone, pin })
        });

        if (res.ok && res.customer && res.token) {
            completeCustomerLogin(res, phone);
            alert(currentLang === 'bn' ? `স্বাগতম ${res.customer.name}! আপনি সফলভাবে লগইন করেছেন।` : `Welcome ${res.customer.name}! Login successful.`);
        }
    } catch (err) {
        alert(err.message || 'Login failed. Please check your phone number and 4-digit PIN.');
    }
}

function completeCustomerLogin(res, phone) {
    const sessionData = JSON.stringify({
        token: res.token,
        expiresAt: res.expiresAt
    });
    localStorage.setItem('customer_session', sessionData);
    sessionStorage.setItem('customer_session', sessionData);
    localStorage.setItem('busyatra_customer', JSON.stringify(res.customer));
    sessionStorage.setItem('busyatra_customer', JSON.stringify(res.customer));
    localStorage.setItem('last_customer_phone', phone);
    initCustomerSession();
    closeCustomerAuthModal();

    if (customerAuthPendingAction === 'booking') {
        customerAuthPendingAction = null;
        const pName = document.getElementById('passengerName');
        const pPhone = document.getElementById('passengerPhone');
        if (pName && res.customer.name) pName.value = res.customer.name;
        if (pPhone && res.customer.phone) pPhone.value = res.customer.phone;
        showDropDownToast(
            currentLang === 'bn' ? 'স্বাগতম! আপনার অ্যাকাউন্ট প্রস্তুত, বুকিং নিশ্চিত করা হচ্ছে...' : 'Welcome! Account ready, finalizing booking...',
            'success'
        );
        setTimeout(() => {
            confirmBooking();
        }, 350);
        return;
    }

    // If customer already entered from & to on search bar, automatically trigger search!
    const from = (document.getElementById('fromCityInput')?.value || '').trim();
    const to = (document.getElementById('toCityInput')?.value || '').trim();
    const date = document.getElementById('journeyDate')?.value;
    if (from && to && date) {
        searchBuses();
    }
}

async function submitCustomerRegister() {
    const name = (document.getElementById('customerRegName').value || '').trim();
    const phone = (document.getElementById('customerRegPhone').value || '').trim();
    const email = (document.getElementById('customerRegEmail')?.value || '').trim();
    const pin = (document.getElementById('customerRegPin').value || '').trim();
    const question = document.getElementById('customerRegQuestion').value;
    const answer = (document.getElementById('customerRegAnswer').value || '').trim();

    if (!name || name.length < 2) {
        alert(currentLang === 'bn' ? 'অনুগ্রহ করে আপনার পূর্ণ নাম লিখুন।' : 'Please enter your full name.');
        return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
        alert(currentLang === 'bn' ? 'অনুগ্রহ করে একটি বৈধ ১০-সংখ্যার মোবাইল নম্বর দিন।' : 'Please enter a valid 10-digit mobile number.');
        return;
    }
    if (email && !email.includes('@')) {
        alert(currentLang === 'bn' ? 'অনুগ্রহ করে একটি বৈধ ইমেইল ঠিকানা দিন।' : 'Please enter a valid email address.');
        return;
    }
    if (!/^\d{4}$/.test(pin)) {
        alert(currentLang === 'bn' ? 'লগইনের জন্য একটি ৪-সংখ্যার পিন নির্ধারণ করুন।' : 'Please set a 4-digit PIN.');
        return;
    }
    if (!answer) {
        alert(currentLang === 'bn' ? 'অনুগ্রহ করে সিকিউরিটি প্রশ্নের একটি উত্তর দিন যাতে পিন ভুলে গেলে উদ্ধার করতে পারেন।' : 'Please answer the security question.');
        return;
    }

    try {
        const res = await apiRequest('/api/customer/register', {
            method: 'POST',
            body: JSON.stringify({ name, phone, email, pin, securityQuestion: question, securityAnswer: answer })
        });

        if (res.ok && res.status === 'active' && res.customer && res.token) {
            completeCustomerLogin(res, phone);
            alert(currentLang === 'bn'
                ? `স্বাগতম ${res.customer.name}! আপনার অ্যাকাউন্ট তৈরি হয়েছে এবং আপনি লগইন করেছেন।`
                : `Welcome ${res.customer.name}! Your account is ready and you are signed in.`);
        }
    } catch (err) {
        if (err.message && err.message.includes('already exists')) {
            alert(currentLang === 'bn' 
                ? 'এই মোবাইল নম্বরটি ইতিমধ্যে নিবন্ধিত রয়েছে। অনুগ্রহ করে আপনার ৪-সংখ্যার পিন দিয়ে লগইন করুন।' 
                : 'An account already exists with this mobile number. Please enter your 4-digit PIN to login.');
            switchCustomerAuthTab('login');
            const custPhoneInput = document.getElementById('customerLoginPhone');
            if (custPhoneInput) custPhoneInput.value = phone;
            return;
        }
        alert(err.message || 'Registration failed.');
    }
}

function switchCustForgotSubTab(subTab) {
    const isOtp = subTab === 'otp';
    const isQ = subTab === 'question';
    const isAdmin = subTab === 'admin';

    document.getElementById('custForgotOtpSection')?.classList.toggle('hidden', !isOtp);
    document.getElementById('custForgotQuestionSection')?.classList.toggle('hidden', !isQ);
    document.getElementById('custForgotAdminSection')?.classList.toggle('hidden', !isAdmin);

    const btnOtp = document.getElementById('tabCustForgotOtp');
    const btnQ = document.getElementById('tabCustForgotQuestion');
    const btnAdmin = document.getElementById('tabCustForgotAdmin');

    if (btnOtp && btnQ && btnAdmin) {
        btnOtp.className = isOtp ? 'flex-1 py-1.5 rounded-lg font-bold bg-white text-gray-900 shadow-sm transition' : 'flex-1 py-1.5 rounded-lg font-bold text-gray-500 hover:text-gray-900 transition';
        btnQ.className = isQ ? 'flex-1 py-1.5 rounded-lg font-bold bg-white text-gray-900 shadow-sm transition' : 'flex-1 py-1.5 rounded-lg font-bold text-gray-500 hover:text-gray-900 transition';
        btnAdmin.className = isAdmin ? 'flex-1 py-1.5 rounded-lg font-bold bg-white text-gray-900 shadow-sm transition' : 'flex-1 py-1.5 rounded-lg font-bold text-gray-500 hover:text-gray-900 transition';
    }
}

async function requestCustomerResetOtp() {
    const email = (document.getElementById('custForgotOtpEmail')?.value || '').trim().toLowerCase();
    if (!email || !email.includes('@') || !email.includes('.')) {
        alert(currentLang === 'bn' ? 'অনুগ্রহ করে আপনার সঠিক রেজিস্টার্ড ইমেইল আইডি দিন (e.g. name@gmail.com)।' : 'Please enter your valid registered email address.');
        return;
    }
    const btn = document.getElementById('custSendOtpBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerText = 'Sending...';
    }
    try {
        const res = await apiRequest('/api/customer/send-reset-otp', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
        const msgEl = document.getElementById('custOtpSentMsg');
        if (msgEl) {
            msgEl.innerText = res.message || (currentLang === 'bn' ? 'ওটিপি আপনার রেজিস্টার্ড ইমেইলে পাঠানো হয়েছে!' : 'OTP sent to your registered email!');
            msgEl.classList.remove('hidden');
        }
        startCooldown(btn, 'Send OTP');
    } catch (err) {
        alert(err.message || (currentLang === 'bn' ? 'ওটিপি পাঠাতে ব্যর্থ হয়েছে।' : 'Failed to send OTP.'));
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Send OTP';
        }
    }
}

async function submitCustomerResetByOtp() {
    const email = (document.getElementById('custForgotOtpEmail')?.value || '').trim().toLowerCase();
    const otp = (document.getElementById('custResetOtp')?.value || '').trim();
    const newPin = (document.getElementById('custResetOtpPin')?.value || '').trim();

    if (!email || !email.includes('@') || !email.includes('.')) {
        alert(currentLang === 'bn' ? 'অনুগ্রহ করে আপনার রেজিস্টার্ড ইমেইল আইডি দিন।' : 'Enter your registered email address.');
        return;
    }
    if (!otp || otp.length !== 6) {
        alert(currentLang === 'bn' ? '৬-সংখ্যার ইমেইল ওটিপি দিন।' : 'Enter 6-digit email OTP.');
        return;
    }
    if (!/^\d{4}$/.test(newPin)) {
        alert(currentLang === 'bn' ? 'নতুন ৪-সংখ্যার পিন দিন।' : 'Enter new 4-digit PIN.');
        return;
    }

    try {
        const res = await apiRequest('/api/customer/reset-by-otp', {
            method: 'POST',
            body: JSON.stringify({ email, otp, newPin })
        });
        alert(res.message || (currentLang === 'bn' ? 'পিন সফলভাবে আপডেট করা হয়েছে! নতুন পিন দিয়ে লগইন করুন।' : 'PIN reset successfully. Please log in with your new PIN.'));
        switchCustomerAuthTab('login');
        const loginPhone = document.getElementById('customerLoginPhone');
        const loginPin = document.getElementById('customerLoginPin');
        if (loginPhone && res.phone) loginPhone.value = res.phone;
        if (loginPin) {
            loginPin.value = '';
            loginPin.focus();
        }
    } catch (err) {
        alert(err.message || (currentLang === 'bn' ? 'পিন রিসেট ব্যর্থ হয়েছে।' : 'Failed to reset PIN.'));
    }
}

async function submitCustomerRequestAdminPin() {
    const phone = (document.getElementById('custAdminHelpPhone')?.value || '').trim();
    if (!/^[6-9]\d{9}$/.test(phone)) {
        alert(currentLang === 'bn' ? 'বৈধ ১০-সংখ্যার মোবাইল নম্বর দিন।' : 'Enter a valid 10-digit mobile number.');
        return;
    }
    try {
        const res = await apiRequest('/api/customer/request-admin-pin', {
            method: 'POST',
            body: JSON.stringify({ phone })
        });
        const msgEl = document.getElementById('custAdminRequestMsg');
        if (msgEl) {
            msgEl.innerText = res.message;
            msgEl.classList.remove('hidden');
        }
        alert(res.message);
    } catch (err) {
        alert(err.message || 'Failed to submit request.');
    }
}

async function checkCustomerSecurityQuestion() {
    const phone = (document.getElementById('customerForgotPhone').value || '').trim();
    if (!/^[6-9]\d{9}$/.test(phone)) {
        alert(currentLang === 'bn' ? 'অনুগ্রহ করে ১০-সংখ্যার মোবাইল নম্বর দিন।' : 'Enter a 10-digit mobile number.');
        return;
    }

    try {
        const res = await apiRequest(`/api/customer/security-question?phone=${encodeURIComponent(phone)}`);
        const promptEl = document.getElementById('customerForgotQuestionPrompt');
        if (promptEl) promptEl.innerText = res.question;
    } catch (err) {
        alert(err.message || 'Failed to check phone number.');
    }
}

async function submitCustomerForgotPin() {
    const phone = (document.getElementById('customerForgotPhone').value || '').trim();
    const answer = (document.getElementById('customerForgotAnswer').value || '').trim();
    const newPin = (document.getElementById('customerForgotNewPin').value || '').trim();

    if (!/^[6-9]\d{9}$/.test(phone)) {
        alert(currentLang === 'bn' ? '১০-সংখ্যার মোবাইল নম্বর দিন।' : 'Enter 10-digit mobile number.');
        return;
    }
    if (!answer) {
        alert(currentLang === 'bn' ? 'সিকিউরিটি প্রশ্নের উত্তর দিন।' : 'Enter your security answer.');
        return;
    }
    if (!/^\d{4}$/.test(newPin)) {
        alert(currentLang === 'bn' ? 'নতুন ৪-সংখ্যার পিন দিন।' : 'Enter new 4-digit PIN.');
        return;
    }

    try {
        const res = await apiRequest('/api/customer/forgot-pin', {
            method: 'POST',
            body: JSON.stringify({ phone, securityAnswer: answer, newPin })
        });
        if (res.ok) {
            alert(res.message || 'PIN reset successfully. Please log in with your new PIN.');
            switchCustomerAuthTab('login');
            const loginPhone = document.getElementById('customerLoginPhone');
            const loginPin = document.getElementById('customerLoginPin');
            if (loginPhone) loginPhone.value = phone;
            if (loginPin) {
                loginPin.value = '';
                loginPin.focus();
            }
        }
    } catch (err) {
        alert(err.message || 'Failed to reset PIN.');
    }
}

function contactAdminForPinWhatsApp() {
    const phone = (document.getElementById('custAdminHelpPhone')?.value || document.getElementById('customerForgotPhone')?.value || document.getElementById('customerLoginPhone')?.value || '').trim();
    const email = (document.getElementById('custForgotOtpEmail')?.value || '').trim();
    const identifier = phone ? `মোবাইল নম্বর: ${phone}` : (email ? `ইমেইল: ${email}` : '');
    const msg = `নমস্কার বাস যাত্রা অ্যাডমিন, আমি আমার ৪-ডিজিটের পিন ভুলে গেছি। আমার রেজিস্টার্ড ${identifier || 'মোবাইল নম্বর: __________'}। অনুগ্রহ করে আমার পিন জানিয়ে দিন বা রিসেট করে দিন।`;
    window.open(`https://wa.me/917585979791?text=${encodeURIComponent(msg)}`, '_blank');
}

async function customerLogout() {
    const isBn = (typeof currentLang !== 'undefined' ? currentLang : 'bn') === 'bn';
    const ok = await showBusYatraConfirm({
        title: isBn ? "আপনি কি লগআউট করতে চান?" : "Are you sure you want to log out?",
        subtitle: isBn 
            ? "লগআউট করলে পরবর্তীতে আপনার টিকিট দেখতে আবার মোবাইল নম্বর দিয়ে লগইন করতে হবে।"
            : "Logging out will require you to sign in with your phone number to access your bookings.",
        icon: '🚪',
        confirmText: isBn ? "হ্যাঁ, লগআউট করুন" : "Yes, Log Out",
        cancelText: isBn ? "না, ফিরে যান" : "Cancel",
        danger: true
    });
    if (!ok) return;

    apiRequest('/api/customer/logout', { method: 'POST' })
        .catch(error => console.warn('Customer logout failed:', error));
    localStorage.removeItem('customer_session');
    sessionStorage.removeItem('customer_session');
    localStorage.removeItem('busyatra_customer');
    sessionStorage.removeItem('busyatra_customer');
    initCustomerSession();
    resetApp();
        const fromInput = document.getElementById('fromCityInput');
        const toInput = document.getElementById('toCityInput');
        const lookupBookingId = document.getElementById('lookupBookingId');
        const lookupPhone = document.getElementById('lookupPhone');
        const lookupResults = document.getElementById('lookupResults');
        const pName = document.getElementById('passengerName');
        const pPhone = document.getElementById('passengerPhone');
        if (fromInput) fromInput.value = "";
        if (toInput) toInput.value = "";
        if (lookupBookingId) lookupBookingId.value = "";
        if (lookupPhone) lookupPhone.value = "";
        if (lookupResults) lookupResults.innerHTML = "";
        if (pName) pName.value = "";
        if (pPhone) pPhone.value = "";
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showDropDownToast(currentLang === 'bn' ? 'সফলভাবে লগআউট হয়েছে।' : 'Logged out successfully.', 'info');
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

// --- Autocomplete & Date Pills ---
function initCityAutocomplete() {
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#fromCityInput') && !e.target.closest('#fromCityDropdown')) {
            const el = document.getElementById('fromCityDropdown');
            if (el) el.classList.add('hidden');
        }
        if (!e.target.closest('#toCityInput') && !e.target.closest('#toCityDropdown')) {
            const el = document.getElementById('toCityDropdown');
            if (el) el.classList.add('hidden');
        }
    });
}

function showCityDropdown(type) {
    filterCityDropdown(type);
}

function filterCityDropdown(type) {
    const input = document.getElementById(`${type}CityInput`);
    const dropdown = document.getElementById(`${type}CityDropdown`);
    if (!input || !dropdown) return;

    const val = input.value.toLowerCase().trim();
    const allStops = getAllAvailableStoppages();
    const matches = val ? allStops.filter(c => c.toLowerCase().includes(val)) : allStops.slice(0, 15);

    dropdown.innerHTML = "";
    if (matches.length === 0) {
        dropdown.innerHTML = `<div class="p-2.5 text-xs text-gray-400">No matching stoppage</div>`;
    } else {
        matches.forEach(city => {
            const opt = document.createElement('div');
            opt.className = "p-2.5 text-xs font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 cursor-pointer transition flex items-center justify-between";
            opt.innerHTML = `<span>${escapeHtml(city)}</span><span class="text-[10px] text-gray-400 font-normal">Select</span>`;
            opt.onclick = () => {
                input.value = city;
                dropdown.classList.add('hidden');
                saveCustomerFlowState({ [type]: city });
            };
            dropdown.appendChild(opt);
        });
    }
    dropdown.classList.remove('hidden');
}

function swapSearchCities() {
    const fromInput = document.getElementById('fromCityInput');
    const toInput = document.getElementById('toCityInput');
    const swapIcon = document.getElementById('swapRouteIcon');
    if (!fromInput || !toInput) return;

    const fromVal = fromInput.value;
    const toVal = toInput.value;

    if (!fromVal && !toVal) return;

    if (swapIcon) {
        swapIcon.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
        swapIcon.style.transform = (swapIcon.style.transform === 'rotate(180deg)') ? 'rotate(0deg)' : 'rotate(180deg)';
    }

    fromInput.value = toVal;
    toInput.value = fromVal;

    saveCustomerFlowState({ from: toVal, to: fromVal });

    const busListSection = document.getElementById('busListSection');
    const journeyDate = document.getElementById('journeyDate')?.value;
    if (fromInput.value && toInput.value && journeyDate && busListSection && !busListSection.classList.contains('hidden')) {
        searchBuses();
    }
}
window.swapSearchCities = swapSearchCities;

function selectQuickDate(offsetDays, btn) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const dateStr = localDateStr(d);
    const input = document.getElementById('journeyDate');
    if (input) input.value = dateStr;

    document.querySelectorAll('.date-pill').forEach(b => {
        b.className = "px-3 py-1.5 bg-gray-50 text-gray-700 border rounded-lg font-semibold shrink-0 hover:bg-gray-100 transition date-pill";
    });
    if (btn) {
        btn.className = "px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-semibold shrink-0 hover:bg-red-100 transition date-pill";
    }
}

function openCustomDatePicker() {
    const input = document.getElementById('journeyDate');
    if (input) {
        input.focus();
        if (typeof input.showPicker === 'function') input.showPicker();
    }
}

// --- Bus Search & Rendering ---
async function searchBuses(isRestore = false) {
    const customer = getLoggedInCustomer();
    if (!customer) {
        if (isRestore) return;
        document.getElementById('busListSection')?.classList.add('hidden');
        showDropDownToast(
            currentLang === 'bn' ? 'অনুগ্রহ করে প্রথমে লগইন করুন' : 'Please login first to search buses',
            'warning'
        );
        alert(currentLang === 'bn'
            ? 'বাসের তালিকা ও বুকিং দেখতে অনুগ্রহ করে প্রথমে লগইন করুন। আপনার অ্যাকাউন্ট না থাকলে নতুন রেজিস্ট্রেশন করুন।\n\n(Please login first to view available buses and book seats. If you don’t have an account, please register.)'
            : 'Please login first to view available buses and book seats. If you don’t have an account, please register.');
        openCustomerAuthModal('login');
        return;
    }

    const from = document.getElementById('fromCityInput').value.trim();
    const to = document.getElementById('toCityInput').value.trim();
    const date = document.getElementById('journeyDate').value;

    if (!from || !to) {
        if (!isRestore) alert(currentLang === 'bn' ? "দয়া করে কোথা থেকে এবং কোথায় যাবেন লিখুন!" : "Please enter both origin and destination!");
        return;
    }
    if (from.toLowerCase() === to.toLowerCase()) {
        if (!isRestore) alert(currentLang === 'bn' ? "শুরুর স্থান এবং গন্তব্য একই হতে পারে না!" : "Origin and destination cannot be the same!");
        return;
    }
    if (!date) {
        if (!isRestore) alert(currentLang === 'bn' ? "দয়া করে যাত্রার তারিখ নির্বাচন করুন!" : "Please select a journey date!");
        return;
    }

    selectedJourneyDate = date;
    saveCustomerFlowState({ step: 'bus_list', from, to, date });
    const searchButton = document.getElementById('searchBusesButton');
    if (searchButton) searchButton.disabled = true;
    try {
        const query = new URLSearchParams({ date });
        const result = await apiRequest(`/api/buses?${query}`);
        setAppData({ buses: result.buses });
    } catch (error) {
        alert(error.message);
        return;
    } finally {
        if (searchButton) searchButton.disabled = false;
    }

    const db = getAppData();
    const availableBuses = (db.buses || []).filter(bus => {
        const stops = (bus.stoppages || []).map(s => s.toLowerCase());
        const fromIdx = stops.indexOf(from.toLowerCase());
        const toIdx = stops.indexOf(to.toLowerCase());
        return fromIdx !== -1 && toIdx !== -1 && fromIdx < toIdx;
    });

    lastSearchResults = { availableBuses, from, to };
    renderAvailableBuses(availableBuses, from, to);

    document.getElementById('busListSection').classList.remove('hidden');
    document.getElementById('seatSelectionSection').classList.add('hidden');
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('successSection').classList.add('hidden');
}

function renderAvailableBuses(availableBuses, from, to) {
    const container = document.getElementById('busContainer');
    if (!container) return;
    container.innerHTML = "";

    if (!availableBuses || availableBuses.length === 0) {
        container.innerHTML = `
            <div class="bg-white p-6 rounded-2xl border text-center text-gray-500 text-xs">
                ${currentLang === 'bn' ? 'দুঃখিত! এই রুটে কোনো বাস পাওয়া যায়নি। অনুগ্রহ করে অন্য রুটে অনুসন্ধান করুন।' : 'No direct buses found for this route on the selected date.'}
            </div>
        `;
        return;
    }

    availableBuses.forEach(bus => {
        const stopsStr = (bus.stoppages || []).join(' ➔ ');
        const selectSeatsText = currentLang === 'bn' ? 'আসন বাছুন' : 'Select Seats';
        const displayFare = bus.fare || 399;
        const busImages = (Array.isArray(bus.images) && bus.images.length > 0)
            ? bus.images
            : (typeof bus.image === 'string' && bus.image.startsWith('[')
                ? (() => { try { return JSON.parse(bus.image); } catch(e) { return [bus.image]; } })()
                : [bus.image || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500&auto=format&fit=crop&q=60']);

        const busRatingFormatted = Number(bus.rating !== undefined && bus.rating !== null ? bus.rating : 4.8).toFixed(1);
        const ratingBadgeMarkup = `
            <div class="absolute top-2.5 left-2.5 bg-emerald-600/95 backdrop-blur-xs text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1.5 z-20 border border-white/20">
                <span class="text-amber-300 text-sm leading-none">★</span>
                <span class="text-xs font-black tracking-wide">${busRatingFormatted}</span>
                <span class="text-[10px] text-white/80 font-medium border-l border-white/30 pl-1">/ 5.0</span>
            </div>
        `;

        let mediaMarkup = '';
        if (busImages.length > 1) {
            mediaMarkup = `
                <div class="relative w-full aspect-16/9 sm:h-56 bg-gray-950 overflow-hidden rounded-t-2xl group bus-carousel cursor-pointer" id="carousel-${bus.id}" data-bus-id="${bus.id}" data-current="0" data-total="${busImages.length}" onclick="openBusImageLightbox('${bus.id}', event)">
                    ${ratingBadgeMarkup}
                    <div class="carousel-track flex h-full transition-transform duration-700 ease-in-out" id="track-${bus.id}" style="width: 100%;">
                        ${busImages.map((imgUrl, i) => `
                            <div class="relative w-full h-full shrink-0 flex items-center justify-center overflow-hidden bg-gray-950" style="min-width: 100%;">
                                <img src="${escapeHtml(imgUrl)}" alt="" class="absolute inset-0 w-full h-full object-cover blur-md opacity-35 scale-110 pointer-events-none" aria-hidden="true">
                                <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(bus.name)} bus photo ${i + 1}" class="relative max-h-full max-w-full object-contain object-center z-10" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500&auto=format&fit=crop&q=60'">
                            </div>
                        `).join('')}
                    </div>
                    <!-- Left Navigation Chevron -->
                    <button type="button" onclick="slideBusCarousel('${bus.id}', -1, event)" class="absolute left-2.5 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-md transition z-20 opacity-80 group-hover:opacity-100 cursor-pointer" aria-label="Previous photo">
                        ❮
                    </button>
                    <!-- Right Navigation Chevron -->
                    <button type="button" onclick="slideBusCarousel('${bus.id}', 1, event)" class="absolute right-2.5 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/90 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-md transition z-20 opacity-80 group-hover:opacity-100 cursor-pointer" aria-label="Next photo">
                        ❯
                    </button>
                    <!-- Bottom Dots Indicator -->
                    <div class="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/50 backdrop-blur-xs px-2.5 py-1 rounded-full z-20">
                        ${busImages.map((_, idx) => `
                            <span class="carousel-dot-${bus.id} cursor-pointer h-2 rounded-full transition-all ${idx === 0 ? 'bg-white w-4' : 'bg-white/50 w-2'}" onclick="setBusCarouselSlide('${bus.id}', ${idx}, event)"></span>
                        `).join('')}
                    </div>
                    <!-- Multi-Photo Count Badge -->
                    <div class="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-20">
                        <span class="bg-black/65 backdrop-blur-xs text-white text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            📷 ${busImages.length} ${currentLang === 'bn' ? 'ছবি' : 'Photos'}
                        </span>
                    </div>
                </div>
            `;
        } else {
            const singleImg = busImages[0];
            mediaMarkup = `
                <div class="relative w-full aspect-16/9 sm:h-56 bg-gray-950 overflow-hidden rounded-t-2xl cursor-pointer group" onclick="openBusImageLightbox('${bus.id}', event)">
                    ${ratingBadgeMarkup}
                    <img src="${escapeHtml(singleImg)}" alt="" class="absolute inset-0 w-full h-full object-cover blur-md opacity-35 scale-110 pointer-events-none" aria-hidden="true">
                    <img src="${escapeHtml(singleImg)}" alt="${escapeHtml(bus.name)} bus" class="relative w-full h-full object-contain object-center z-10 transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500&auto=format&fit=crop&q=60'">
                </div>
            `;
        }

        const timings = bus.stoppageTimings || bus.stoppage_timings || {};
        let boardingTime = null;
        let droppingTime = null;
        if (timings && typeof timings === 'object') {
            for (const [k, v] of Object.entries(timings)) {
                if (k.toLowerCase() === from.toLowerCase()) boardingTime = v;
                if (k.toLowerCase() === to.toLowerCase()) droppingTime = v;
            }
        }
        if (!boardingTime) boardingTime = bus.time || '07:00 AM';
        if (!droppingTime) {
            droppingTime = (timings && bus.stoppages && timings[bus.stoppages[bus.stoppages.length - 1]]) || '—';
        }

        const journeyDuration = (boardingTime && droppingTime && droppingTime !== '—')
            ? formatDurationBetween(boardingTime, droppingTime)
            : '';

        const boardingLabel = currentLang === 'bn' ? 'ছাড়ার সময়' : 'Boarding Time';
        const arrivalLabel = currentLang === 'bn' ? 'পৌঁছানোর সময়' : 'Arrival Time';
        const durationText = journeyDuration ? escapeHtml(journeyDuration) : (currentLang === 'bn' ? 'সরাসরি' : 'Direct');
        const operatorLabel = currentLang === 'bn' ? 'অপারেটর:' : 'Operator:';
        const routeLabel = currentLang === 'bn' ? 'রুট:' : 'Route:';
        const seatsAvailableLabel = currentLang === 'bn' ? `${escapeHtml(bus.remainingSeats)} টি আসন খালি আছে` : `${escapeHtml(bus.remainingSeats)} seats available`;
        const farePerTicketLabel = currentLang === 'bn' ? 'প্রতি টিকিটের ভাড়া' : 'Fare per ticket';

        const isDeparted = isTripTimePassed(selectedJourneyDate, boardingTime);

        container.innerHTML += `
            <div class="bg-white rounded-2xl shadow-sm border ${isDeparted ? 'border-gray-200 opacity-80' : 'border-gray-200 hover:border-red-300'} transition overflow-hidden">
                ${mediaMarkup}
                <div class="p-4 sm:p-5">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div class="space-y-1.5 flex-1 w-full">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="bg-red-100 text-red-700 text-xs font-black px-2.5 py-0.5 rounded-full uppercase">Express Coach</span>
                            ${(window.customerFeatures && window.customerFeatures.flash_sale_pricing === true && !isDeparted && bus.remainingSeats > 0) ? `
                                <span class="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1 animate-pulse">
                                    🔥 Flash Deal
                                </span>
                            ` : ''}
                            ${isDeparted ? `
                                <span class="bg-gray-100 text-gray-700 text-xs font-black px-2.5 py-0.5 rounded-full border border-gray-300 flex items-center gap-1">
                                    <span>🚫</span> <span>${currentLang === 'bn' ? 'বাস ছেড়ে গেছে (সময় অতিক্রান্ত)' : 'Departed'}</span>
                                </span>
                            ` : ''}
                            <span class="bg-emerald-50 text-emerald-700 text-xs font-black px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1"><span class="text-amber-500">★</span> ${busRatingFormatted}</span>
                            <span class="text-xs font-mono text-gray-500 font-semibold">${escapeHtml(bus.busNumber)}</span>
                        </div>
                        <h4 class="text-base md:text-lg font-bold text-gray-900">${escapeHtml(bus.name)}</h4>
                        <div class="text-xs text-gray-600">
                            <strong>${operatorLabel}</strong> ${escapeHtml(bus.companyName || bus.ownerName + ' Travels')}
                        </div>

                        <!-- Scheduled Stoppage Journey Card -->
                        <div class="bg-gray-50 p-2.5 sm:p-3 rounded-xl border border-gray-200 flex items-center justify-between gap-2 my-2">
                            <div>
                                <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">${boardingLabel}</span>
                                <div class="text-sm md:text-base font-black text-gray-900">${escapeHtml(boardingTime)}</div>
                                <div class="text-[11px] font-semibold text-emerald-700 truncate max-w-[100px] sm:max-w-[130px]" title="${escapeHtml(from)}">${escapeHtml(from)}</div>
                            </div>
                            <div class="flex-1 flex flex-col items-center px-1">
                                <span class="text-[10px] font-bold text-gray-500">${durationText}</span>
                                <div class="w-full flex items-center gap-1 my-0.5">
                                    <span class="w-2 h-2 rounded-full border-2 border-emerald-500 bg-white"></span>
                                    <span class="flex-1 h-0.5 bg-gray-300"></span>
                                    <span class="text-[10px] text-red-500 font-bold">➔</span>
                                    <span class="flex-1 h-0.5 bg-gray-300"></span>
                                    <span class="w-2 h-2 rounded-full bg-red-600"></span>
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">${arrivalLabel}</span>
                                <div class="text-sm md:text-base font-black text-gray-900">${escapeHtml(droppingTime)}</div>
                                <div class="text-[11px] font-semibold text-red-700 truncate max-w-[100px] sm:max-w-[130px]" title="${escapeHtml(to)}">${escapeHtml(to)}</div>
                            </div>
                        </div>

                        <div class="text-xs text-gray-500">
                            <strong>${routeLabel}</strong> ${escapeHtml(stopsStr)}
                        </div>
                        <div class="text-xs text-green-700 font-semibold">
                            ${seatsAvailableLabel}
                        </div>
                    </div>

                    <div class="text-right flex flex-row md:flex-col justify-between items-center md:items-end w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0">
                        <div>
                            <span class="text-xs text-gray-400">${farePerTicketLabel}</span>
                            <div class="text-xl font-black text-red-600">₹${displayFare}</div>
                        </div>
                        ${isDeparted ? `
                            <button disabled class="bg-gray-200 text-gray-500 cursor-not-allowed px-4 py-2.5 rounded-xl font-bold text-xs shadow-none">
                                ${currentLang === 'bn' ? '🚫 সময় অতিক্রান্ত' : '🚫 Departed'}
                            </button>
                        ` : `
                            <button onclick="openSeatSelection('${escapeHtml(bus.id)}', '${escapeHtml(bus.name)} (${escapeHtml(bus.busNumber)})', ${displayFare}, ${bus.farePerStop || 45}, ${bus.totalSeats || 65}, ${getAppData()?.featureFlags?.windowSeatPricing ? (bus.windowSeatExtra || 0) : 0})" class="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition">
                                ${selectSeatsText}
                            </button>
                        `}
                    </div>
                </div>
                </div>
            </div>
        `;
    });
    initBusCarousels();
}

// --- Multi-Image Auto-Slide Carousel Logic ---
let busCarouselIntervals = {};

function initBusCarousels() {
    Object.values(busCarouselIntervals).forEach(clearInterval);
    busCarouselIntervals = {};

    document.querySelectorAll('.bus-carousel').forEach(carousel => {
        const busId = carousel.dataset.busId;
        const total = parseInt(carousel.dataset.total, 10) || 1;
        if (total > 1) {
            busCarouselIntervals[busId] = setInterval(() => {
                slideBusCarousel(busId, 1);
            }, 4500);

            carousel.addEventListener('mouseenter', () => {
                if (busCarouselIntervals[busId]) clearInterval(busCarouselIntervals[busId]);
            });
            carousel.addEventListener('mouseleave', () => {
                if (busCarouselIntervals[busId]) clearInterval(busCarouselIntervals[busId]);
                busCarouselIntervals[busId] = setInterval(() => {
                    slideBusCarousel(busId, 1);
                }, 4500);
            });
        }
    });
}
window.initBusCarousels = initBusCarousels;

function slideBusCarousel(busId, direction, event) {
    if (event) event.stopPropagation();
    const carousel = document.getElementById(`carousel-${busId}`);
    const track = document.getElementById(`track-${busId}`);
    if (!carousel || !track) return;

    let current = parseInt(carousel.dataset.current, 10) || 0;
    const total = parseInt(carousel.dataset.total, 10) || 1;
    current = (current + direction + total) % total;
    carousel.dataset.current = current;

    track.style.transform = `translateX(-${current * 100}%)`;

    document.querySelectorAll(`.carousel-dot-${busId}`).forEach((dot, idx) => {
        if (idx === current) {
            dot.className = `carousel-dot-${busId} cursor-pointer h-2 rounded-full transition-all bg-white w-4`;
        } else {
            dot.className = `carousel-dot-${busId} cursor-pointer h-2 rounded-full transition-all bg-white/50 w-2`;
        }
    });
}
window.slideBusCarousel = slideBusCarousel;

function setBusCarouselSlide(busId, targetIndex, event) {
    if (event) event.stopPropagation();
    const carousel = document.getElementById(`carousel-${busId}`);
    const track = document.getElementById(`track-${busId}`);
    if (!carousel || !track) return;

    carousel.dataset.current = targetIndex;
    track.style.transform = `translateX(-${targetIndex * 100}%)`;

    document.querySelectorAll(`.carousel-dot-${busId}`).forEach((dot, idx) => {
        if (idx === targetIndex) {
            dot.className = `carousel-dot-${busId} cursor-pointer h-2 rounded-full transition-all bg-white w-4`;
        } else {
            dot.className = `carousel-dot-${busId} cursor-pointer h-2 rounded-full transition-all bg-white/50 w-2`;
        }
    });
}
window.setBusCarouselSlide = setBusCarouselSlide;

// --- Bus Image Lightbox Modal Logic ---
let currentLightboxBusId = null;
let currentLightboxIndex = 0;
let currentLightboxImages = [];

function openBusImageLightbox(busId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const bus = (db.buses || []).find(b => String(b.id) === String(busId));
    if (!bus) return;

    let images = [];
    if (Array.isArray(bus.images) && bus.images.length > 0) {
        images = bus.images;
    } else if (bus.image) {
        if (typeof bus.image === 'string' && bus.image.startsWith('[')) {
            try { images = JSON.parse(bus.image); } catch(e) { images = [bus.image]; }
        } else if (Array.isArray(bus.image)) {
            images = bus.image;
        } else {
            images = [bus.image];
        }
    }
    if (!images || images.length === 0) {
        images = ['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=500&auto=format&fit=crop&q=60'];
    }

    currentLightboxBusId = busId;
    currentLightboxImages = images;

    const carousel = document.getElementById(`carousel-${busId}`);
    const activeIdx = carousel ? parseInt(carousel.dataset.current, 10) || 0 : 0;
    currentLightboxIndex = (activeIdx >= 0 && activeIdx < images.length) ? activeIdx : 0;

    const modal = document.getElementById('busImageLightboxModal');
    const titleEl = document.getElementById('lightboxBusTitle');
    if (titleEl) {
        titleEl.textContent = `${bus.name || 'Bus'} (${bus.busNumber || bus.number || ''})`;
    }

    renderLightbox();
    if (modal) modal.classList.remove('hidden');
}
window.openBusImageLightbox = openBusImageLightbox;

function closeBusImageLightbox() {
    const modal = document.getElementById('busImageLightboxModal');
    if (modal) modal.classList.add('hidden');
}
window.closeBusImageLightbox = closeBusImageLightbox;

function slideLightbox(direction) {
    if (!currentLightboxImages || currentLightboxImages.length <= 1) return;
    currentLightboxIndex = (currentLightboxIndex + direction + currentLightboxImages.length) % currentLightboxImages.length;
    renderLightbox();
}
window.slideLightbox = slideLightbox;

function setLightboxImage(index) {
    if (!currentLightboxImages || index < 0 || index >= currentLightboxImages.length) return;
    currentLightboxIndex = index;
    renderLightbox();
}
window.setLightboxImage = setLightboxImage;

function renderLightbox() {
    const imgEl = document.getElementById('lightboxMainImage');
    const counterEl = document.getElementById('lightboxPhotoCounter');
    const prevBtn = document.getElementById('lightboxPrevBtn');
    const nextBtn = document.getElementById('lightboxNextBtn');
    const thumbsCont = document.getElementById('lightboxThumbsContainer');

    if (!currentLightboxImages || currentLightboxImages.length === 0) return;

    if (imgEl) {
        imgEl.src = currentLightboxImages[currentLightboxIndex];
    }
    if (counterEl) {
        counterEl.textContent = `${currentLightboxIndex + 1} / ${currentLightboxImages.length}`;
    }

    if (currentLightboxImages.length <= 1) {
        if (prevBtn) prevBtn.classList.add('hidden');
        if (nextBtn) nextBtn.classList.add('hidden');
        if (thumbsCont) thumbsCont.innerHTML = '';
    } else {
        if (prevBtn) prevBtn.classList.remove('hidden');
        if (nextBtn) nextBtn.classList.remove('hidden');
        if (thumbsCont) {
            thumbsCont.innerHTML = currentLightboxImages.map((url, i) => `
                <button type="button" onclick="setLightboxImage(${i})" class="w-14 h-10 rounded-lg overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${i === currentLightboxIndex ? 'border-primary ring-2 ring-primary/50 scale-105' : 'border-white/30 opacity-60 hover:opacity-100'}">
                    <img src="${escapeHtml(url)}" alt="thumb ${i + 1}" class="w-full h-full object-cover">
                </button>
            `).join('');
        }
    }
}
window.renderLightbox = renderLightbox;

if (typeof document !== 'undefined') {
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('busImageLightboxModal');
        if (modal && !modal.classList.contains('hidden')) {
            if (e.key === 'Escape') closeBusImageLightbox();
            else if (e.key === 'ArrowLeft') slideLightbox(-1);
            else if (e.key === 'ArrowRight') slideLightbox(1);
        }
    });
}

// Customer Portal App Install & Feedback QR Modals
function openCustomerAppQrModal() {
    document.getElementById('customerAppQrModal')?.classList.remove('hidden');
}
function closeCustomerAppQrModal() {
    document.getElementById('customerAppQrModal')?.classList.add('hidden');
}
window.openCustomerAppQrModal = openCustomerAppQrModal;
window.closeCustomerAppQrModal = closeCustomerAppQrModal;

function openCustomerFeedbackQrModal() {
    document.getElementById('customerFeedbackQrModal')?.classList.remove('hidden');
}
function closeCustomerFeedbackQrModal() {
    document.getElementById('customerFeedbackQrModal')?.classList.add('hidden');
}
window.openCustomerFeedbackQrModal = openCustomerFeedbackQrModal;
window.closeCustomerFeedbackQrModal = closeCustomerFeedbackQrModal;

// --- Step 1: 65-Seat 2+3 Layout (No Women tag) ---
function openSeatSelection(busId, busTitle, fare, farePerStop, totalSeats, winExtra) {
    const customer = getLoggedInCustomer();
    if (!customer) {
        showDropDownToast(
            currentLang === 'bn' ? 'অনুগ্রহ করে প্রথমে লগইন করুন' : 'Please login first to select seats',
            'warning'
        );
        alert(currentLang === 'bn'
            ? 'বাসের আসন নির্বাচন ও বুকিং করতে অনুগ্রহ করে প্রথমে লগইন করুন।\n\n(Please login first to select seats and book your journey.)'
            : 'Please login first to select seats and book your journey.');
        openCustomerAuthModal('login');
        return;
    }

    const db = getAppData();
    const bus = (db.buses || []).find(b => b.id === busId);
    if (!bus) return;

    const fromVal = (document.getElementById('fromCityInput')?.value || '').trim();
    const toVal = (document.getElementById('toCityInput')?.value || '').trim();

    // Check if bus departure time has already passed
    let checkBoardingTime = bus.time || '07:00 AM';
    if (bus.stoppageTimings && fromVal && bus.stoppageTimings[fromVal]) {
        checkBoardingTime = bus.stoppageTimings[fromVal];
    }
    if (isTripTimePassed(selectedJourneyDate, checkBoardingTime)) {
        showDropDownToast(
            currentLang === 'bn' ? 'দুঃখিত! এই বাসের ছাড়ার সময় ইতিমধ্যে পার হয়ে গেছে।' : 'Sorry! This bus has already departed for today.',
            'warning'
        );
        alert(currentLang === 'bn'
            ? 'দুঃখিত! এই বাসের ছাড়ার সময় ইতিমধ্যে পার হয়ে গেছে। অনুগ্রহ করে অন্য বাস বা ভবিষ্যতের তারিখ নির্বাচন করুন।'
            : 'Sorry! This bus has already departed for today. Please select another bus or a future date.');
        return;
    }

    if (selectedBusId && selectedBusId !== busId) {
        releaseSeatHold();
    }
    selectedBusId = busId;
    currentBusFare = fare;
    currentBusFarePerStop = farePerStop || 45;
    windowSeatExtra = 0; // Uniform fare for all seats
    selectedSeatsSet.clear();
    myHeldSeatsForSelection.clear();
    currentDiscount = 0;
    appliedPromoName = "";
    document.getElementById('promoCodeInput').value = "";
    document.getElementById('promoFeedback').innerText = "";
    document.getElementById('upiTransactionInput').value = "";

    document.getElementById('selectedBusTitle').innerText = busTitle;
    document.getElementById('lblAvail').innerText = `${currentLang === 'bn' ? 'উপলব্ধ' : 'Available'} (₹${currentBusFare})`;
    document.getElementById('lblSelectSeatsSub').innerText = `${currentLang === 'bn' ? 'ধাপ ১: আপনার আসন নির্বাচন করুন -' : 'Step 1 of 2: Select your seat(s) -'} ${totalSeats} ${currentLang === 'bn' ? 'সিটার লেআউট' : 'Seater Layout'}`;

    document.getElementById('busListSection').classList.add('hidden');
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('seatSelectionSection').classList.remove('hidden');

    saveCustomerFlowState({
        step: 'seat_selection',
        busId,
        busTitle,
        fare,
        farePerStop,
        totalSeats,
        winExtra,
        selectedSeats: Array.from(selectedSeatsSet)
    });

    if (bus) {
        const flags = db.featureFlags || {};
        updateDynamicUpiQr(currentBusFare);

        const upiLabel = document.getElementById('upiLabel');
        const cashLabel = document.getElementById('cashLabel');

        let defaultMode = "UPI";
        if (bus.allowOnlinePayment === false || flags.onlinePayment === false) {
            if (upiLabel) upiLabel.style.display = "none";
            defaultMode = "Cash";
        } else {
            if (upiLabel) upiLabel.style.display = "flex";
        }

        if (bus.allowCashPayment === false || flags.cashPayment === false) {
            if (cashLabel) cashLabel.style.display = "none";
            defaultMode = "UPI";
        } else {
            if (cashLabel) cashLabel.style.display = "flex";
        }

        pendingPaymentMode = defaultMode;
        togglePaymentUI(defaultMode);

        const screenSec = document.getElementById('upiScreenshotSection');
        const utrSec = document.getElementById('upiTransactionSection');
        if (screenSec) {
            screenSec.classList.toggle('hidden', bus.requirePaymentScreenshot === false);
        }
        if (utrSec) {
            utrSec.classList.toggle('hidden', !bus.enableUtr);
        }

        const paymentUnavailable = (flags.onlinePayment === false || bus.allowOnlinePayment === false) &&
            (flags.cashPayment === false || bus.allowCashPayment === false);
        document.getElementById('btnConfirmBooking').disabled = paymentUnavailable;
        if (paymentUnavailable) {
            alert(currentLang === 'bn' ? 'এই বাসে বর্তমানে কোনো পেমেন্ট পদ্ধতি চালু নেই।' : 'No payment method is currently available for this bus.');
        }

        const boardingSelect = document.getElementById('boardingPointSelect');
        const droppingSelect = document.getElementById('droppingPointSelect');
        if (boardingSelect && droppingSelect) {
            boardingSelect.innerHTML = "";
            droppingSelect.innerHTML = "";
            const stops = (bus.stoppages && bus.stoppages.length > 0) ? bus.stoppages : ["Pingla", "Kolkata"];
            const timings = bus.stoppageTimings || bus.stoppage_timings || {};

            // Match boarding stop based on searched fromVal
            let matchedBoarding = stops.find(s => s.toLowerCase() === fromVal.toLowerCase());
            if (!matchedBoarding && fromVal) {
                matchedBoarding = stops.find(s => s.toLowerCase().includes(fromVal.toLowerCase()) || fromVal.toLowerCase().includes(s.toLowerCase()));
            }
            if (!matchedBoarding) matchedBoarding = stops[0];

            // Match dropping stop based on searched toVal (strictly avoids overriding with Asthatala / terminus stop)
            let matchedDropping = stops.find(s => s.toLowerCase() === toVal.toLowerCase());
            if (!matchedDropping && toVal) {
                matchedDropping = stops.find(s => s.toLowerCase().includes(toVal.toLowerCase()) || toVal.toLowerCase().includes(s.toLowerCase()));
            }
            if (!matchedDropping) matchedDropping = stops[stops.length - 1];

            stops.forEach((stop, idx) => {
                const stopTime = (timings && timings[stop]) ? ` (${timings[stop]})` : (idx === 0 && bus.time ? ` (${bus.time})` : '');
                boardingSelect.innerHTML += `<option value="${escapeHtml(stop)}">${escapeHtml(stop)}${escapeHtml(stopTime)}</option>`;
                droppingSelect.innerHTML += `<option value="${escapeHtml(stop)}">${escapeHtml(stop)}${escapeHtml(stopTime)}</option>`;
            });

            boardingSelect.value = matchedBoarding;
            droppingSelect.value = matchedDropping;
        }

        loadBookedSeats(bus);
    }
}

let seatAvailabilityPollTimer = null;
let seatPollBusRef = null;
let isProceedingToPayment = false;
let isConfirmingBooking = false;
let currentBookingIdempotencyKey = null;

function stopSeatAvailabilityPolling() {
    if (seatAvailabilityPollTimer) {
        clearInterval(seatAvailabilityPollTimer);
        seatAvailabilityPollTimer = null;
    }
    seatPollBusRef = null;
}

function startSeatAvailabilityPolling(bus) {
    stopSeatAvailabilityPolling();
    if (!bus) return;
    seatPollBusRef = bus;
    seatAvailabilityPollTimer = setInterval(() => {
        const seatSec = document.getElementById('seatSelectionSection');
        if (!seatSec || seatSec.classList.contains('hidden') || document.visibilityState !== 'visible') {
            return;
        }
        if (seatPollBusRef && seatPollBusRef.id === selectedBusId) {
            loadBookedSeats(seatPollBusRef, true);
        }
    }, 8000);
}

async function loadBookedSeats(bus, isSilentPoll = false) {
    try {
        const query = new URLSearchParams({
            busId: bus.id,
            date: selectedJourneyDate,
            sessionId: getClientSessionId()
        });
        const result = await apiRequest(`/api/seats?${query}`);
        bookedSeatsForSelection = new Set(result.seats || []);
        heldSeatsForSelection = new Set(result.heldSeats || []);
        myHeldSeatsForSelection = new Set(result.myHeldSeats || []);

        // Real-time conflict detection: deselect seats taken/locked by others while user was viewing
        if (selectedSeatsSet.size > 0) {
            const snatchedSeats = [];
            for (const s of Array.from(selectedSeatsSet)) {
                if (bookedSeatsForSelection.has(s) || heldSeatsForSelection.has(s)) {
                    selectedSeatsSet.delete(s);
                    snatchedSeats.push(s);
                }
            }
            if (snatchedSeats.length > 0) {
                updateFareDisplay();
                saveCustomerFlowState({ selectedSeats: Array.from(selectedSeatsSet) });
                showDropDownToast(
                    currentLang === 'bn'
                        ? `⚠️ সিট ${snatchedSeats.join(', ')} এইমাত্র অন্য যাত্রী লক/বুক করে নিয়েছেন! অন্য সিট বেছে নিন।`
                        : `⚠️ Seat(s) ${snatchedSeats.join(', ')} were just locked or booked by another passenger!`,
                    'warning'
                );
            }
        }

        render65SeatsGrid(bus);
        if (!isSilentPoll) {
            startSeatAvailabilityPolling(bus);
        }
    } catch (error) {
        if (isSilentPoll) {
            console.warn('Silent seat availability poll warning:', error.message);
            return;
        }
        console.error('Failed to load booked seats:', error);
        document.getElementById('seatsGrid').innerHTML = `<div class="col-span-full text-center text-red-600 text-xs p-4">${escapeHtml(error.message)}. Please retry.</div>`;
        showDropDownToast(currentLang === 'bn' ? 'আসনের তথ্য পাওয়া যায়নি। আবার চেষ্টা করুন।' : 'Could not load seat availability. Please retry.', 'error');
        backToBuses();
    }
}

function isWindowSeat(seatNum, bus = null) {
    const targetBus = bus || ((typeof getAppData === 'function') ? (getAppData().buses || []).find(b => b.id === selectedBusId) : null);
    if (targetBus && targetBus.seatLayout && Array.isArray(targetBus.seatLayout.seats)) {
        const found = targetBus.seatLayout.seats.find(s => String(s.number) === String(seatNum) || String(s.id) === String(seatNum));
        if (found) return Boolean(found.isWindow || found.type === 'window');
    }
    const num = parseInt(String(seatNum).replace(/\D/g, ''), 10) || 0;
    const mod = num % 5;
    return mod === 1 || mod === 2 || mod === 0;
}

function calculatePerSeatFare() {
    const db = getAppData();
    const bus = (db.buses || []).find(b => b.id === selectedBusId);
    if (bus && bus.fare) {
        return Number(bus.fare);
    }
    return currentBusFare || 150;
}

function createSeatButton(seatInput, bus) {
    const isObj = (typeof seatInput === 'object' && seatInput !== null);
    const seatNum = isObj ? String(seatInput.number || seatInput.id) : String(seatInput);
    const isBooked = bookedSeatsForSelection.has(seatNum);
    const isHeldByOther = heldSeatsForSelection.has(seatNum);
    const isHeldByMe = myHeldSeatsForSelection.has(seatNum);
    const isSelected = selectedSeatsSet.has(seatNum);
    const isWin = isObj ? Boolean(seatInput.isWindow || seatInput.type === 'window') : isWindowSeat(seatNum, bus);
    const isLadies = isObj && seatInput.gender === 'female_only';
    const isSleeper = isObj && seatInput.type === 'sleeper';
    // Uniform pricing fixed by owner: every seat has the same price
    const seatFare = calculatePerSeatFare();

    const btn = document.createElement('button');
    btn.type = "button";

    const baseClasses = "w-10 h-11 sm:w-11 sm:h-12 rounded-lg sm:rounded-xl border flex flex-col items-center justify-center font-bold transition shrink-0 select-none cursor-pointer";

    if (isBooked) {
        btn.className = `${baseClasses} text-[9px] sm:text-[10px] bg-gray-200 border-gray-400 text-gray-400 cursor-not-allowed`;
        btn.innerHTML = `<span class="leading-none">${escapeHtml(seatNum)}</span><span class="text-[7px] sm:text-[8px] font-normal mt-0.5 leading-none">Sold</span>`;
    } else if (isHeldByOther) {
        btn.className = `${baseClasses} text-[9px] sm:text-[10px] border-2 bg-amber-100 border-amber-400 text-amber-800 cursor-not-allowed shadow-xs`;
        btn.title = currentLang === 'bn' ? 'সাময়িকভাবে অন্য যাত্রীর জন্য লক রয়েছে (১৫ মিনিট)' : 'Temporarily locked by another passenger (15m)';
        btn.innerHTML = `<span class="leading-none">🔒${escapeHtml(seatNum)}</span><span class="text-[7px] sm:text-[8px] font-semibold text-amber-700 mt-0.5 leading-none">Locked</span>`;
        btn.onclick = () => {
            showDropDownToast(
                currentLang === 'bn'
                    ? `সিট ${seatNum} সাময়িকভাবে অন্য যাত্রীর জন্য লক রয়েছে (১৫ মিনিট)। অনুগ্রহ করে অন্য সিট বাছুন।`
                    : `Seat ${seatNum} is temporarily held by another passenger (15m). Please select another seat.`,
                'warning'
            );
        };
    } else {
        let tagIcon = isWin ? '🪟' : (isSleeper ? '🛏️' : '');
        if (isLadies) tagIcon = '👩' + tagIcon;
        btn.className = `${baseClasses} text-[9px] sm:text-[10px] border-2 ${
            isSelected ? 'bg-purple-100 border-purple-600 text-purple-700 shadow-sm ring-2 ring-purple-300' :
            isHeldByMe ? 'bg-green-100 border-green-600 text-green-800' :
            isLadies ? 'bg-pink-50 border-pink-500 text-pink-700 hover:bg-pink-100' :
            'bg-white border-green-600 text-green-700 hover:bg-green-50'
        }`;
        btn.innerHTML = `<span class="leading-none">${escapeHtml(seatNum)}${tagIcon}</span><span class="text-[7px] sm:text-[8px] font-normal mt-0.5 leading-none">₹${seatFare}</span>`;
        btn.onclick = () => toggleSeatSelection(seatNum, bus);
    }
    return btn;
}

function render65SeatsGrid(bus) {
    const grid = document.getElementById('seatsGrid');
    if (!grid) return;
    grid.innerHTML = "";

    const layout = (typeof getBusEffectiveSeatLayout === 'function')
        ? getBusEffectiveSeatLayout(bus)
        : generateDefaultBusSeatLayout({ totalSeats: bus.totalSeats || 65 });

    const leftCols = layout.leftCols || 2;
    const rightCols = layout.rightCols || 3;
    const totalRows = layout.totalRows || Math.ceil((bus.totalSeats || 65) / 5);
    const hasBackRow = layout.hasBackRow;

    // Front Cabin Indicator - centered
    const cabinDiv = document.createElement('div');
    cabinDiv.className = "flex justify-between items-center bg-gray-800 text-white px-3 py-2 rounded-xl text-[10px] font-bold mb-3 shadow-xs w-full max-w-[340px] mx-auto";
    cabinDiv.innerHTML = `<span class="text-amber-300 flex items-center gap-1">🛞 ${currentLang === 'bn' ? 'ড্রাইভার কেবিন' : 'Driver Cabin'}</span><span class="text-gray-400">|</span><span class="text-emerald-300 flex items-center gap-1">🚪 ${currentLang === 'bn' ? 'প্রবেশদ্বার' : 'Entry Gate'}</span>`;
    grid.appendChild(cabinDiv);

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

        // Centered row card with responsive padding and spacing
        const rowDiv = document.createElement('div');
        rowDiv.className = "flex items-center justify-center gap-1 sm:gap-2.5 bg-white px-1.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-gray-200 shadow-xs mb-2 w-full max-w-[340px] mx-auto";

        if (isBack) {
            const benchGroup = document.createElement('div');
            benchGroup.className = "flex justify-center items-center gap-1 sm:gap-1.5 w-full";
            rowSeats.sort((a, b) => a.col - b.col).forEach(s => {
                if (s.active && s.type !== 'empty') {
                    benchGroup.appendChild(createSeatButton(s, bus));
                }
            });
            rowDiv.appendChild(benchGroup);
        } else {
            // Left Group
            const leftGroup = document.createElement('div');
            leftGroup.className = "flex items-center gap-1 sm:gap-1.5";
            const leftSeats = rowSeats.filter(s => s.side === 'left').sort((a, b) => a.col - b.col);
            for (let c = 1; c <= leftCols; c++) {
                const s = leftSeats.find(item => item.col === c);
                if (s && s.active && s.type !== 'empty') {
                    leftGroup.appendChild(createSeatButton(s, bus));
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

            // Right Group
            const rightGroup = document.createElement('div');
            rightGroup.className = "flex items-center gap-1 sm:gap-1.5";
            const rightSeats = rowSeats.filter(s => s.side === 'right').sort((a, b) => a.col - b.col);
            for (let c = 1; c <= rightCols; c++) {
                const targetCol = leftCols + c;
                const s = rightSeats.find(item => item.col === targetCol);
                if (s && s.active && s.type !== 'empty') {
                    rightGroup.appendChild(createSeatButton(s, bus));
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

function toggleSeatSelection(seatNum, bus) {
    if (selectedSeatsSet.has(seatNum)) {
        selectedSeatsSet.delete(seatNum);
        releaseSeatHold([seatNum]);
    } else {
        selectedSeatsSet.add(seatNum);
    }
    render65SeatsGrid(bus);
    updateFareDisplay();
    saveCustomerFlowState({ selectedSeats: Array.from(selectedSeatsSet) });
}

function updateFareDisplay() {
    const count = selectedSeatsSet.size;
    const seatsArr = Array.from(selectedSeatsSet);
    document.getElementById('lblSelectedSeats').innerText = count > 0 ? seatsArr.join(', ') : (currentLang === 'bn' ? 'কোনোটি না' : 'None');

    const perSeat = calculatePerSeatFare();
    const totalBase = seatsArr.length * perSeat;

    const finalTotal = Math.max(0, totalBase - currentDiscount);
    document.getElementById('lblTotalFare').innerText = finalTotal;
    const payFare = document.getElementById('paySummaryFare');
    if (payFare) payFare.innerText = finalTotal;
    const paySeats = document.getElementById('paySummarySeats');
    if (paySeats) paySeats.innerText = count > 0 ? seatsArr.join(', ') : '--';
    updateDynamicUpiQr(finalTotal);
}

function recalculateDynamicFare() {
    const db = getAppData();
    const bus = (db.buses || []).find(b => b.id === selectedBusId);
    if (bus) {
        render65SeatsGrid(bus);
    }
    updateFareDisplay();
}

// --- Step 2: Transition from Seats to Payment Page (Enterprise Atomic Lock) ---
async function goToPaymentPage(isRestore = false) {
    if (isProceedingToPayment) return;
    isProceedingToPayment = true;
    try {
        const customer = getLoggedInCustomer();
        if (!customer) {
            if (isRestore) return;
            showDropDownToast(
                currentLang === 'bn'
                    ? 'পেমেন্ট ও বুকিং সম্পন্ন করতে অনুগ্রহ করে প্রথমে লগইন করুন।'
                    : 'Please login first to proceed with booking.',
                'warning'
            );
            alert(currentLang === 'bn'
                ? 'পেমেন্ট ও বুকিং সম্পন্ন করতে অনুগ্রহ করে প্রথমে লগইন করুন।\n\n(Please login first to proceed with booking.)'
                : 'Please login first to proceed with booking.');
            openCustomerAuthModal('login');
            return;
        }

        if (!selectedSeatsSet || selectedSeatsSet.size === 0) {
            if (!isRestore) {
                showDropDownToast(
                    currentLang === 'bn' ? "দয়া করে অন্তত একটি আসন নির্বাচন করুন!" : "Please select at least one seat first!",
                    'warning'
                );
            }
            return;
        }

        const boardingSelect = document.getElementById('boardingPointSelect');
        const droppingSelect = document.getElementById('droppingPointSelect');
        let boarding = boardingSelect ? boardingSelect.value.trim() : "";
        let dropping = droppingSelect ? droppingSelect.value.trim() : "";

        const db = getAppData();
        let bus = (db.buses || []).find(b => b.id === selectedBusId);
        if (!bus) {
            bus = (db.buses && db.buses.length > 0) ? db.buses[0] : {
                id: selectedBusId || "bus_001",
                name: "Bus Yatra Deluxe",
                busNumber: "WB-34-5678",
                fare: currentBusFare || 399,
                stoppages: ["Pingla", "Kolkata"],
                time: "07:00 AM"
            };
        }

        const stoppages = (bus.stoppages && bus.stoppages.length > 0) ? bus.stoppages : ["Pingla", "Kolkata"];
        if (!boarding) boarding = stoppages[0];
        if (!dropping) dropping = stoppages[stoppages.length - 1];

        if (boarding === dropping) {
            alert(currentLang === 'bn' ? "বোর্ডিং এবং ড্রপিং পয়েন্ট একই হতে পারে না!" : "Boarding and dropping points cannot be the same!");
            return;
        }

        const seatsArr = Array.from(selectedSeatsSet);
        let totalBase = 0;
        seatsArr.forEach(seatNum => {
            const base = calculatePerSeatFare();
            const extra = isWindowSeat(seatNum) ? windowSeatExtra : 0;
            totalBase += (base + extra);
        });
        const totalFare = Math.max(0, totalBase - currentDiscount);

        // Populate Trip Review Banner in Step 2 immediately so correct seats are always shown
        const payBus = document.getElementById('paySummaryBus');
        const payDate = document.getElementById('paySummaryDate');
        const payRoute = document.getElementById('paySummaryRoute');
        const payTime = document.getElementById('paySummaryTime');
        const paySeats = document.getElementById('paySummarySeats');
        const payFare = document.getElementById('paySummaryFare');

        if (payBus) payBus.innerText = `${bus.name || 'Bus Yatra'} (${bus.busNumber || bus.id || ''})`;
        if (payDate) payDate.innerText = `${selectedJourneyDate}`;
        if (payRoute) payRoute.innerText = `${boarding} ➔ ${dropping}`;
        if (payTime) payTime.innerText = `${bus.time || '07:00 AM'}`;
        if (paySeats) paySeats.innerText = `${seatsArr.join(', ')}`;
        if (payFare) payFare.innerText = `${totalFare}`;
        updateDynamicUpiQr(totalFare);

        // Dynamic show/hide for Screenshot and UTR according to bus payment rules
        const screenSec = document.getElementById('upiScreenshotSection');
        const utrSec = document.getElementById('upiTransactionSection');
        if (screenSec) screenSec.classList.toggle('hidden', bus.requirePaymentScreenshot === false);
        if (utrSec) utrSec.classList.toggle('hidden', !bus.enableUtr);

        // Populate and sync Boarding & Dropping Dropdowns on Payment Review Screen
        const payBoardingSelect = document.getElementById('payBoardingSelect');
        const payDroppingSelect = document.getElementById('payDroppingSelect');
        if (payBoardingSelect && payDroppingSelect) {
            payBoardingSelect.innerHTML = "";
            payDroppingSelect.innerHTML = "";
            const timings = bus.stoppageTimings || bus.stoppage_timings || {};
            stoppages.forEach((stop, idx) => {
                const stopTime = (timings && timings[stop]) ? ` (${timings[stop]})` : (idx === 0 && bus.time ? ` (${bus.time})` : '');
                payBoardingSelect.innerHTML += `<option value="${escapeHtml(stop)}">${escapeHtml(stop)}${escapeHtml(stopTime)}</option>`;
                payDroppingSelect.innerHTML += `<option value="${escapeHtml(stop)}">${escapeHtml(stop)}${escapeHtml(stopTime)}</option>`;
            });
            payBoardingSelect.value = boarding;
            payDroppingSelect.value = dropping;
        }

        // Lock seats atomically for 15 minutes in database BEFORE allowing payment
        let holdRes = null;
        try {
            holdRes = await apiRequest('/api/seats/hold', {
                method: 'POST',
                body: JSON.stringify({
                    busId: selectedBusId,
                    journeyDate: selectedJourneyDate,
                    seats: seatsArr,
                    sessionId: getClientSessionId(),
                    customerPhone: customer.phone || ''
                })
            });
            if (!holdRes || !holdRes.ok) {
                throw new Error(holdRes?.error || 'Could not hold seats.');
            }
        } catch (holdErr) {
            showDropDownToast(holdErr.message || 'সিট সাময়িকভাবে লক করা সম্ভব হয়নি। অনুগ্রহ করে অন্য সিট বাছুন।', 'error');
            alert(holdErr.message);
            selectedSeatsSet.clear();
            updateFareDisplay();
            if (bus) await loadBookedSeats(bus);
            return;
        }

        // Stop seat polling once exclusive seat hold is acquired, and assign fresh Idempotency Key for checkout
        stopSeatAvailabilityPolling();
        currentBookingIdempotencyKey = `IDEMP_${getClientSessionId()}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        // Start Seat Hold Countdown Timer (Persistent across page reloads & background tabs)
        if (holdRes && holdRes.holdDisabled) {
            stopSeatHoldTimer();
        } else {
            const holdSecs = (holdRes && holdRes.expiresInSeconds) !== undefined ? holdRes.expiresInSeconds : 15 * 60;
            const holdExpiresAt = holdRes && holdRes.expiresAt;
            const holdMins = Math.ceil(holdSecs / 60);
            startSeatHoldTimer(holdSecs, holdExpiresAt);
            if (!isRestore) {
                showDropDownToast(
                    currentLang === 'bn'
                        ? `⏱️ আপনার আসন ${holdMins} মিনিটের জন্য সংরক্ষিত রাখা হয়েছে! দ্রুত বুকিং সম্পন্ন করুন।`
                        : `⏱️ Seats held for ${holdMins} minutes! Complete your booking before time expires.`,
                    'info'
                );
            }
        }

        // Auto-fill logged in customer details
        const savedCustomer = getLoggedInCustomer();
        if (savedCustomer) {
            const nameEl = document.getElementById('passengerName');
            const phoneEl = document.getElementById('passengerPhone');
            if (nameEl && !nameEl.value) nameEl.value = savedCustomer.name || '';
            if (phoneEl && !phoneEl.value) phoneEl.value = savedCustomer.phone || '';
        }

        // Switch view cleanly
        const seatSec = document.getElementById('seatSelectionSection');
        const paySec = document.getElementById('paymentSection');
        if (seatSec) seatSec.classList.add('hidden');
        if (paySec) {
            paySec.classList.remove('hidden');
            paySec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        saveCustomerFlowState({
            step: 'payment',
            busId: selectedBusId,
            boarding,
            dropping,
            selectedSeats: Array.from(selectedSeatsSet),
            passengerName: document.getElementById('passengerName')?.value || '',
            passengerPhone: document.getElementById('passengerPhone')?.value || ''
        });
    } catch (err) {
        console.error("Error transitioning to payment page:", err);
        showDropDownToast(currentLang === 'bn' ? 'দয়া করে আবার চেষ্টা করুন।' : 'Something went wrong. Please retry.', 'error');
    } finally {
        isProceedingToPayment = false;
    }
}

async function backToSeatSelection(silentReleaseMsg = false) {
    currentBookingIdempotencyKey = null;
    await releaseSeatHold();
    selectedSeatsSet.clear();
    myHeldSeatsForSelection.clear();
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('seatSelectionSection').classList.remove('hidden');
    const bus = (getAppData().buses || []).find(b => b.id === selectedBusId);
    if (bus) await loadBookedSeats(bus);
    updateFareDisplay();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (!silentReleaseMsg) {
        showDropDownToast(
            currentLang === 'bn'
                ? '🔄 পূর্ববর্তী আসন উন্মুক্ত করা হয়েছে। নতুন আসন নির্বাচন করুন।'
                : '🔄 Previous seat hold released. Please select your new seats.',
            'info'
        );
    }

    saveCustomerFlowState({
        step: 'seat_selection',
        busId: selectedBusId,
        selectedSeats: []
    });
}

function syncPaymentStoppages(changedField) {
    const payBoarding = document.getElementById('payBoardingSelect');
    const payDropping = document.getElementById('payDroppingSelect');
    const bSelect = document.getElementById('boardingPointSelect');
    const dSelect = document.getElementById('droppingPointSelect');

    if (changedField === 'dropping' && payDropping && dSelect) {
        dSelect.value = payDropping.value;
    } else if (changedField === 'boarding' && payBoarding && bSelect) {
        bSelect.value = payBoarding.value;
    }

    const curBoarding = bSelect?.value || payBoarding?.value;
    const curDropping = dSelect?.value || payDropping?.value;

    if (curBoarding && curDropping && curBoarding === curDropping) {
        alert(currentLang === 'bn' ? "বোর্ডিং এবং ড্রপিং পয়েন্ট একই হতে পারে না!" : "Boarding and dropping points cannot be the same!");
        return;
    }

    const seatsArr = Array.from(selectedSeatsSet);
    const perSeat = calculatePerSeatFare();
    const totalBase = seatsArr.length * perSeat;
    const totalFare = Math.max(0, totalBase - currentDiscount);

    const payRoute = document.getElementById('paySummaryRoute');
    const payFare = document.getElementById('paySummaryFare');
    if (payRoute) payRoute.innerText = `${curBoarding} ➔ ${curDropping}`;
    if (payFare) payFare.innerText = `${totalFare}`;
    updateDynamicUpiQr(totalFare);
}
window.syncPaymentStoppages = syncPaymentStoppages;

function getShortBusName(bus) {
    if (!bus) return 'BusYatra';
    const raw = (bus.companyName || bus.ownerName || bus.name || 'Bus Yatra').trim();
    // Replace "Bus Yatra" with "BY" or create a concise representation
    let short = raw.replace(/Bus\s*Yatra/gi, 'BY').replace(/\s+/g, ' ').trim();
    if (!short || short.length <= 2) short = raw;
    return short.slice(0, 16).trim();
}
window.getShortBusName = getShortBusName;

function updateDynamicUpiQr(overrideFare = null) {
    const db = getAppData();
    const bus = (db.buses || []).find(b => b.id === selectedBusId);
    if (!bus) return;

    let fare = overrideFare;
    if (fare === null || fare === undefined) {
        const fareEl = document.getElementById('paySummaryFare') || document.getElementById('lblTotalFare');
        fare = fareEl ? (parseFloat(fareEl.innerText) || 0) : 0;
    }
    fare = Math.max(0, Math.round(fare));

    const upiId = (bus.upiId || 'busyatra@oksbi').trim();
    const shortBus = getShortBusName(bus);
    // Payee Name: shortened so it looks clean in user's UPI app
    const payeeName = (bus.companyName || bus.ownerName || shortBus || 'Bus Yatra').trim().slice(0, 25);

    // Get Passenger Name and Contact Phone for Remarks (so Owner & Admin know who paid)
    const loggedCustomer = getLoggedInCustomer();
    const inputName = document.getElementById('passengerName')?.value?.trim();
    const inputPhone = document.getElementById('passengerPhone')?.value?.trim();

    const passengerName = (inputName || loggedCustomer?.name || 'Passenger').slice(0, 25);
    const passengerPhone = (inputPhone || loggedCustomer?.phone || '').slice(0, 10);

    // Remarks Note: "PassengerName Phone ShortBusName"
    let rawNote = `${passengerName} ${passengerPhone} ${shortBus}`.trim();
    const cleanNote = rawNote.replace(/[^a-zA-Z0-9\s_-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50);

    const upiTextEl = document.getElementById('busUpiIdText');
    if (upiTextEl) upiTextEl.innerText = upiId;

    const amtDisp = document.getElementById('upiPayAmountDisplay');
    if (amtDisp) amtDisp.innerText = fare;

    const amtBtn = document.getElementById('lblUpiPayAmount');
    if (amtBtn) amtBtn.innerText = `₹${fare}`;

    const remarksDisp = document.getElementById('upiRemarksDisplay');
    if (remarksDisp) {
        remarksDisp.innerText = cleanNote || `${passengerName} ${passengerPhone}`;
    }

    // UPI Standard URI with auto-filled amount (am=...) and customer identification note (tn=...)
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${fare}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;

    const qrImgEl = document.getElementById('busQrCodeImg');
    if (qrImgEl) {
        // High quality dynamic QR Code pre-filling the exact fare and customer name+phone remarks
        qrImgEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(upiUri)}`;
    }

    const payNowBtn = document.getElementById('btnOpenUpiApp');
    if (payNowBtn) {
        payNowBtn.href = upiUri;
    }
}
window.updateDynamicUpiQr = updateDynamicUpiQr;

function copyBusUpiId() {
    const upiIdText = document.getElementById('busUpiIdText')?.innerText?.trim();
    if (!upiIdText) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(upiIdText).then(() => {
            showDropDownToast(
                currentLang === 'bn' ? '✅ UPI ID কপি করা হয়েছে!' : '✅ UPI ID copied to clipboard!',
                'success'
            );
        }).catch(() => fallbackCopyText(upiIdText));
    } else {
        fallbackCopyText(upiIdText);
    }
}
window.copyBusUpiId = copyBusUpiId;

function fallbackCopyText(text) {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
        document.execCommand('copy');
        showDropDownToast(
            currentLang === 'bn' ? '✅ UPI ID কপি করা হয়েছে!' : '✅ UPI ID copied to clipboard!',
            'success'
        );
    } catch {
        prompt('UPI ID:', text);
    }
    document.body.removeChild(tempInput);
}

function togglePaymentUI(mode) {
    pendingPaymentMode = mode;
    const upiBox = document.getElementById('upiPaymentBox');
    const upiRadio = document.querySelector('input[name="paymentMode"][value="UPI"]');
    const cashRadio = document.querySelector('input[name="paymentMode"][value="Cash"]');
    const upiLabel = document.getElementById('upiLabel');
    const cashLabel = document.getElementById('cashLabel');

    if (upiLabel) upiLabel.className = 'border p-2.5 rounded-xl flex items-center gap-2 cursor-pointer bg-gray-50 border-gray-200 text-xs select-none';
    if (cashLabel) cashLabel.className = 'border p-2.5 rounded-xl flex items-center gap-2 cursor-pointer bg-gray-50 border-gray-200 text-xs select-none';

    if (mode === 'UPI') {
        if (upiBox) upiBox.classList.remove('hidden');
        if (upiRadio) upiRadio.checked = true;
        if (upiLabel) upiLabel.className = 'border p-2.5 rounded-xl flex items-center gap-2 cursor-pointer bg-red-50 border-red-500 font-semibold text-xs select-none';
        paymentStatusVerified = false;
    } else {
        if (upiBox) upiBox.classList.add('hidden');
        if (cashRadio) cashRadio.checked = true;
        if (cashLabel) cashLabel.className = 'border p-2.5 rounded-xl flex items-center gap-2 cursor-pointer bg-red-50 border-red-500 font-semibold text-xs select-none';
        paymentStatusVerified = true;
    }
}

function applyPromoCode() {
    const code = document.getElementById('promoCodeInput').value.trim().toUpperCase();
    const feedback = document.getElementById('promoFeedback');
    const db = getAppData();
    const coupon = (db.coupons || []).find(c => c.code && c.code.toUpperCase() === code && c.active);

    if (coupon) {
        currentDiscount = coupon.discount || 50;
        appliedPromoName = coupon.code;
        feedback.className = "text-xs mt-1 font-semibold text-green-600";
        feedback.innerText = currentLang === 'bn' ? `🎉 কুপন "${coupon.code}" সফলভাবে প্রয়োগ হয়েছে! ₹${currentDiscount} ছাড়` : `🎉 Coupon "${coupon.code}" applied! ₹${currentDiscount} OFF`;
    } else {
        currentDiscount = 0;
        appliedPromoName = "";
        feedback.className = "text-xs mt-1 font-semibold text-red-600";
        feedback.innerText = currentLang === 'bn' ? "❌ ভুল বা মেয়াদোত্তীর্ণ প্রমো কোড" : "❌ Invalid or expired promo code";
    }
    updateFareDisplay();
}

let uploadedPaymentScreenshot = "";

async function handlePaymentScreenshotUpload(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
        alert(currentLang === 'bn' ? 'অনুগ্রহ করে শুধুমাত্র ছবি (JPG, PNG, WebP) ফাইল আপলোড করুন।' : 'Please upload an image file (JPG, PNG, WebP) only.');
        input.value = "";
        return;
    }

    try {
        const base64Data = await compressImageToDataUrl(file, 1000, 1000, 0.8);
        uploadedPaymentScreenshot = base64Data;
        const previewBox = document.getElementById('upiScreenshotPreviewBox');
        const thumb = document.getElementById('upiScreenshotThumb');
        const fileName = document.getElementById('upiScreenshotFileName');
        if (thumb) thumb.src = base64Data;
        if (fileName) fileName.innerText = file.name || 'screenshot.jpg';
        if (previewBox) previewBox.classList.remove('hidden');
        showDropDownToast(
            currentLang === 'bn' ? 'পেমেন্ট স্ক্রিনশট প্রস্তুত হয়েছে!' : 'Payment screenshot ready!',
            'success'
        );
    } catch (e) {
        console.error('Screenshot compression error:', e);
        const reader = new FileReader();
        reader.onload = (evt) => {
            uploadedPaymentScreenshot = evt.target.result;
            const previewBox = document.getElementById('upiScreenshotPreviewBox');
            const thumb = document.getElementById('upiScreenshotThumb');
            const fileName = document.getElementById('upiScreenshotFileName');
            if (thumb) thumb.src = evt.target.result;
            if (fileName) fileName.innerText = file.name || 'screenshot.jpg';
            if (previewBox) previewBox.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

function removePaymentScreenshot() {
    uploadedPaymentScreenshot = "";
    const input = document.getElementById('upiScreenshotInput');
    if (input) input.value = "";
    const previewBox = document.getElementById('upiScreenshotPreviewBox');
    if (previewBox) previewBox.classList.add('hidden');
    const thumb = document.getElementById('upiScreenshotThumb');
    if (thumb) thumb.src = "";
}

function compressImageToDataUrl(file, maxWidth = 1000, maxHeight = 1000, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth || height > maxHeight) {
                    if (width / height > maxWidth / maxHeight) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

// --- Step 3: Confirm Booking & Submit to Cloudflare D1 (Idempotent & Double-Tap Safe) ---
async function confirmBooking() {
    if (isConfirmingBooking) return;

    const boarding = document.getElementById('boardingPointSelect').value;
    const dropping = document.getElementById('droppingPointSelect').value;

    const db = getAppData();
    const bus = (db.buses || []).find(b => b.id === selectedBusId);
    if (!bus) return;

    const name = document.getElementById('passengerName').value.trim();
    const phone = document.getElementById('passengerPhone').value.trim();
    const phoneRegex = /^[6-9]\d{9}$/;

    if (!name || name.length > 50 || !phoneRegex.test(phone)) {
        alert(currentLang === 'bn' ? "দয়া করে সঠিক যাত্রীর নাম এবং বৈধ ১০ ডিজিটের মোবাইল নম্বর লিখুন!" : "Please enter a valid passenger name and 10-digit Indian mobile number!");
        return;
    }

    // If customer is already logged in, use their session
    const loggedCustomer = getLoggedInCustomer();

    let upiTransactionId = "";
    if (pendingPaymentMode === 'UPI') {
        const busRequiresScreenshot = bus.requirePaymentScreenshot !== false;
        const busRequiresUtr = Boolean(bus.enableUtr);

        if (busRequiresScreenshot && !uploadedPaymentScreenshot) {
            alert(currentLang === 'bn'
                ? "এই বাসের জন্য অনলাইন ইউপিআই পেমেন্টের স্ক্রিনশট আপলোড করা বাধ্যতামূলক! অনুগ্রহ করে পেমেন্টের স্ক্রিনশট সিলেক্ট করুন।"
                : "Payment screenshot is required for this bus! Please upload your payment screenshot.");
            const inputEl = document.getElementById('upiScreenshotInput');
            if (inputEl) {
                inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                inputEl.focus();
            }
            return;
        }
        const utrInput = document.getElementById('upiTransactionInput') ? document.getElementById('upiTransactionInput').value.trim() : "";
        if (busRequiresUtr && !utrInput) {
            alert(currentLang === 'bn'
                ? "দয়া করে ইউপিআই লেনদেন / ইউটিআর নম্বরটি লিখুন!"
                : "Please enter the UPI transaction / UTR number!");
            const inputEl = document.getElementById('upiTransactionInput');
            if (inputEl) {
                inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                inputEl.focus();
            }
            return;
        }
        upiTransactionId = utrInput;
    }

    const seatsArr = Array.from(selectedSeatsSet);
    const perSeat = calculatePerSeatFare();
    const totalBase = seatsArr.length * perSeat;
    const totalFare = Math.max(0, totalBase - currentDiscount);

    if (!currentBookingIdempotencyKey) {
        currentBookingIdempotencyKey = `IDEMP_${getClientSessionId()}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }

    isConfirmingBooking = true;
    const confirmBtn = document.getElementById('btnConfirmBooking');
    const origBtnHtml = confirmBtn ? confirmBtn.innerHTML : '';
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.classList.add('opacity-70', 'cursor-not-allowed');
        confirmBtn.innerHTML = `<span class="animate-spin">⏳</span> <span>${currentLang === 'bn' ? 'বুকিং নিশ্চিত হচ্ছে...' : 'Confirming Booking...'}</span>`;
    }

    let result;
    try {
        const customerSession = JSON.parse(localStorage.getItem('customer_session') || sessionStorage.getItem('customer_session') || 'null');
        const customHeaders = {
            ...(customerSession?.token ? { Authorization: `Bearer ${customerSession.token}` } : {}),
            ...(loggedCustomer?.phone ? { 'x-customer-phone': loggedCustomer.phone } : {})
        };
        result = await apiRequest('/api/bookings', {
            method: 'POST',
            headers: customHeaders,
            body: JSON.stringify({
                busId: bus.id,
                date: selectedJourneyDate,
                seats: seatsArr,
                boarding,
                dropping,
                passengerName: name,
                passengerPhone: phone,
                customerPhone: loggedCustomer?.phone || phone,
                paymentMode: pendingPaymentMode,
                utrNumber: (pendingPaymentMode === 'UPI') ? (upiTransactionId || 'N/A') : '',
                paymentScreenshot: (pendingPaymentMode === 'UPI') ? uploadedPaymentScreenshot : '',
                promoCode: appliedPromoName,
                fare: totalFare,
                sessionId: getClientSessionId(),
                idempotencyKey: currentBookingIdempotencyKey
            })
        });
    } catch (error) {
        if (error.status === 401 || (error.message && (error.message.includes('লগইন') || error.message.toLowerCase().includes('login')))) {
            const custPhoneInput = document.getElementById('customerLoginPhone');
            const custRegPhone = document.getElementById('customerRegPhone');
            const custRegName = document.getElementById('customerRegName');
            if (custPhoneInput && phone) custPhoneInput.value = phone;
            if (custRegPhone && phone) custRegPhone.value = phone;
            if (custRegName && name) custRegName.value = name;
            showDropDownToast(
                currentLang === 'bn' ? 'অনুগ্রহ করে একবার লগইন করে টিকিট নিশ্চিত করুন।' : 'Please login to confirm your booking.',
                'warning'
            );
            openCustomerAuthModal('login', 'booking');
            return;
        }
        alert(error.message);
        const msg = String(error.message || '');
        if (error.status === 409 && (msg.includes('just booked') || msg.includes('temporarily held') || msg.includes('লক রয়েছে') || msg.includes('বুক করে নিয়েছেন'))) {
            await backToSeatSelection(true);
        }
        return;
    } finally {
        isConfirmingBooking = false;
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('opacity-70', 'cursor-not-allowed');
            confirmBtn.innerHTML = origBtnHtml;
        }
    }

    currentBookingIdempotencyKey = null;
    stopSeatHoldTimer();
    stopSeatAvailabilityPolling();
    removePaymentScreenshot();
    activeBooking = result.booking;
    const bookingId = activeBooking.id;

    if (result.customerSession && result.customerSession.token) {
        const sessionData = JSON.stringify({
            token: result.customerSession.token,
            expiresAt: result.customerSession.expiresAt
        });
        localStorage.setItem('customer_session', sessionData);
        sessionStorage.setItem('customer_session', sessionData);
        if (result.customerSession.customer) {
            localStorage.setItem('busyatra_customer', JSON.stringify(result.customerSession.customer));
            sessionStorage.setItem('busyatra_customer', JSON.stringify(result.customerSession.customer));
            localStorage.setItem('last_customer_phone', result.customerSession.customer.phone);
        }
        initCustomerSession();
    }

    showDropDownToast(
        currentLang === 'bn'
            ? '🎉 আপনার বুকিং সফলভাবে জমা হয়েছে! অনুমোদনের অপেক্ষা...'
            : '🎉 Your booking has been submitted! Pending approval...',
        'success'
    );

    lastTicketText = `🚌 *Bus Yatra Ticket*\nBooking ID: ${bookingId}\nBus: ${bus.name} (${bus.busNumber})\nCompany: ${activeBooking.companyName || bus.companyName}\nPassenger: ${name} (${phone})\nSeats: ${seatsArr.join(', ')}\nRoute: ${boarding} ➔ ${dropping}\nDate: ${selectedJourneyDate}\nTotal Fare: ₹${totalFare}\nPayment: ${pendingPaymentMode}${upiTransactionId ? ' (UTR: ' + upiTransactionId + ')' : ''}\nStatus: Pending Owner Approval`;

    clearCustomerFlowState();
    document.getElementById('paymentSection').classList.add('hidden');
    const successSec = document.getElementById('successSection');
    successSec.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    document.getElementById('ticketDetails').innerHTML = `
        <div><strong>${currentLang === 'bn' ? 'বুকিং আইডি' : 'Booking ID'}:</strong> <span class="text-red-600 font-mono font-bold">${escapeHtml(bookingId)}</span></div>
        <div><strong>${currentLang === 'bn' ? 'বাস' : 'Bus'}:</strong> ${escapeHtml(bus.name)} (${escapeHtml(bus.busNumber)})</div>
        <div><strong>${currentLang === 'bn' ? 'কোম্পানি' : 'Agency'}:</strong> ${escapeHtml(activeBooking.companyName || bus.companyName || bus.ownerName + ' Travels')}</div>
        <div><strong>${currentLang === 'bn' ? 'যাত্রী' : 'Passenger'}:</strong> ${escapeHtml(name)} (${escapeHtml(phone)})</div>
        <div><strong>${currentLang === 'bn' ? 'আসন' : 'Seats'}:</strong> <span class="font-bold text-red-600">${escapeHtml(seatsArr.join(', '))}</span></div>
        <div><strong>${currentLang === 'bn' ? 'রুট' : 'Route'}:</strong> ${escapeHtml(boarding)} ➔ ${escapeHtml(dropping)} (${escapeHtml(selectedJourneyDate)})</div>
        <div><strong>${currentLang === 'bn' ? 'মোট ভাড়া' : 'Total Fare'}:</strong> ₹${totalFare} (${pendingPaymentMode}${upiTransactionId ? ' • UTR: ' + escapeHtml(upiTransactionId) : ''})</div>
        <div><strong>${currentLang === 'bn' ? 'স্ট্যাটাস' : 'Status'}:</strong> <span id="bookingStatusLabel" class="text-orange-600 font-bold">⏳ ${currentLang === 'bn' ? 'বাস ওনারের অনুমোদনের অপেক্ষায়' : 'Pending Owner Approval'}</span></div>
    `;

    startSuccessBookingPolling(bookingId, phone);
}

async function checkBookingApprovalStatus() {
    if (!activeBooking) return;
    try {
        const query = new URLSearchParams({ bookingId: activeBooking.id, phone: activeBooking.passengerPhone });
        const result = await apiRequest(`/api/bookings/lookup?${query}`);
        if (result && result.booking) {
            activeBooking = result.booking;
            applyBookingStatusToUI(activeBooking);
            if (activeBooking.status === 'Approved') {
                alert(currentLang === 'bn' ? "🎉 আপনার বুকিং অনুমোদিত হয়েছে! এখন আপনি পিডিএফ টিকিট ডাউনলোড করতে পারবেন।" : "🎉 Your booking is approved! You can now download your official PDF ticket pass.");
            } else if (activeBooking.status === 'Pending Approval') {
                alert(currentLang === 'bn' ? "⏳ টিকিটটি এখনো অনুমোদনের অপেক্ষায় রয়েছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।" : "⏳ Booking is still pending approval. Please check again in a few moments.");
            }
        }
    } catch (e) {
        console.warn('Manual status check error:', e);
    }
}

function applyBookingStatusToUI(booking) {
    if (!booking) return;
    saveOfflineTicketLocally(booking);
    const statusLabel = document.getElementById('bookingStatusLabel');
    const icon = document.getElementById('successIcon');
    const head = document.getElementById('lblBookingConfirmed');
    const sub = document.getElementById('lblSuccessSub');
    const banner = document.getElementById('bookingApprovalBanner');
    const bIcon = document.getElementById('bannerIcon');
    const bTitle = document.getElementById('bannerStatusTitle');
    const bSub = document.getElementById('bannerStatusSub');
    const btn = document.getElementById('btnDownloadBrandedTicket');

    if (booking.status === 'Approved') {
        showDropDownToast(
            currentLang === 'bn'
                ? '🎉 আপনার টিকিট অনুমোদিত হয়েছে! অফিশিয়াল টিকিট ডাউনলোড করুন।'
                : '🎉 Your booking has been approved! Official ticket unlocked.',
            'success'
        );
        if (statusLabel) {
            statusLabel.className = 'text-green-700 font-bold';
            statusLabel.innerText = '✅ Booking Done (Approved)';
        }
        if (icon) icon.innerText = '🎉';
        if (head) head.innerText = currentLang === 'bn' ? 'বুকিং সফলভাবে অনুমোদিত হয়েছে!' : 'Booking Confirmed & Approved!';
        if (sub) sub.innerText = currentLang === 'bn' ? 'আপনার আসন নিশ্চিত হয়েছে। নিচের বাটনে ক্লিক করে অফিশিয়াল টিকিট ডাউনলোড করুন।' : 'Your seat is confirmed! Click below to download your official branded PDF ticket pass.';
        
        if (banner) banner.className = 'p-3 bg-green-50 border border-green-300 rounded-xl text-xs text-green-900 mb-4 flex items-center justify-between gap-2 shadow-sm';
        if (bIcon) bIcon.innerText = '✅';
        if (bTitle) bTitle.innerText = currentLang === 'bn' ? 'বাস ওনার ও ক্যাপ্টেন দ্বারা অনুমোদিত' : 'Approved by Bus Owner & Captain';
        if (bSub) bSub.innerText = currentLang === 'bn' ? 'অফিশিয়াল ব্র্যান্ডেড পিডিএফ টিকিট এখন প্রস্তুত।' : 'Official branded PDF ticket is now unlocked and ready.';

        if (btn) {
            btn.className = 'w-full bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-xl font-bold text-sm mb-2 flex items-center justify-center gap-2 shadow-lg transition cursor-pointer border-0';
            btn.innerHTML = `<span>📄 ${currentLang === 'bn' ? 'ব্র্যান্ডেড পিডিএফ টিকিট ডাউনলোড করুন' : 'Download Official PDF Ticket Pass'}</span>`;
        }

        if (successBookingPoll) {
            clearInterval(successBookingPoll);
            successBookingPoll = null;
        }
    } else if (booking.status === 'Rejected') {
        if (statusLabel) {
            statusLabel.className = 'text-red-600 font-bold';
            statusLabel.innerText = '❌ Rejected by Owner';
        }
        if (icon) icon.innerText = '❌';
        if (head) head.innerText = currentLang === 'bn' ? 'বুকিং অনুরোধ বাতিল হয়েছে' : 'Booking Request Rejected';
        if (sub) sub.innerText = currentLang === 'bn' ? 'দুঃখিত, বাস কর্তৃপক্ষ এই বুকিংটি অনুমোদন করতে পারেনি।' : 'Sorry, the bus operator could not approve this booking request.';

        if (banner) banner.className = 'p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-900 mb-4 flex items-center justify-between gap-2';
        if (bIcon) bIcon.innerText = '❌';
        if (bTitle) bTitle.innerText = currentLang === 'bn' ? 'অনুরোধ বাতিল করা হয়েছে' : 'Booking Rejected';
        if (bSub) bSub.innerText = currentLang === 'bn' ? 'আসনগুলি মুক্ত করা হয়েছে।' : 'Your reserved seats have been released.';

        if (btn) {
            btn.className = 'w-full bg-gray-200 text-gray-400 py-3 rounded-xl font-bold text-xs mb-2 flex items-center justify-center gap-2 border border-gray-300 cursor-not-allowed';
            btn.innerHTML = `<span>❌ ${currentLang === 'bn' ? 'টিকিট বাতিল হয়েছে' : 'Ticket Rejected'}</span>`;
        }

        if (successBookingPoll) {
            clearInterval(successBookingPoll);
            successBookingPoll = null;
        }
    }
}

function startSuccessBookingPolling(bookingId, phone) {
    if (successBookingPoll) clearInterval(successBookingPoll);
    successBookingPoll = setInterval(async () => {
        try {
            const query = new URLSearchParams({ bookingId, phone });
            const result = await apiRequest(`/api/bookings/lookup?${query}`);
            if (result.booking) {
                activeBooking = result.booking;
                applyBookingStatusToUI(activeBooking);
            }
        } catch (error) {
            console.warn('Booking polling error:', error);
        }
    }, 3500);
}

// --- Branded PDF Ticket Modal Generator ---
function openActiveBookingTicketModal() {
    if (!activeBooking) {
        alert(currentLang === 'bn' ? "কোনো সক্রিয় বুকিং পাওয়া যায়নি।" : "No active booking found.");
        return;
    }
    if (activeBooking.status !== 'Approved') {
        alert(currentLang === 'bn' 
            ? "⏳ আপনার টিকিটটি এখনো বাস ওনার বা ক্যাপ্টেন দ্বারা অনুমোদিত হয়নি। ওনার বা ক্যাপ্টেন অনুমোদন করলেই টিকিট ডাউনলোড আনলক হবে।" 
            : "⏳ Your booking request is awaiting approval from the Bus Owner or Captain. The PDF Ticket will unlock immediately once approved.");
        return;
    }
    openTicketModalFromBooking(activeBooking);
}

function openTicketModalFromBooking(b) {
    if (!b || b.status !== 'Approved') {
        if (b && (b.status === 'Cancelled' || b.status === 'Rejected')) {
            alert(currentLang === 'bn' 
                ? "🚫 এই টিকিটটি বাতিল করা হয়েছে। বাতিল টিকিটের অফিশিয়াল PDF ডাউনলোড বন্ধ রয়েছে।" 
                : "🚫 This ticket has been cancelled or rejected. PDF ticket download is disabled.");
            return;
        }
        alert(currentLang === 'bn' 
            ? "⏳ টিকিটটি এখনো অনুমোদিত হয়নি। ওনার বা ক্যাপ্টেন অনুমোদন করলেই ডাউনলোড করা যাবে।" 
            : "⏳ The ticket is available only after the bus owner or captain approves the booking.");
        return;
    }
    document.getElementById('tktCompanyName').innerText = b.companyName || `${b.ownerName || 'Bus Yatra'} Travels`;
    document.getElementById('tktGstNumber').innerText = b.gstNumber ? `GSTIN: ${b.gstNumber}` : 'GST: Unregistered / Exempt';
    document.getElementById('tktHelpline').innerText = b.emergencyPhone || '8768447312';
    document.getElementById('tktBookingId').innerText = b.id;
    document.getElementById('tktPassengerName').innerText = b.passengerName;
    document.getElementById('tktPassengerPhone').innerText = b.passengerPhone;
    document.getElementById('tktBusInfo').innerText = `${b.busName} (${b.busNumber})`;
    document.getElementById('tktDateTime').innerText = `${b.date} • ${b.departureTime || '07:00 AM'}`;
    document.getElementById('tktBoarding').innerText = b.boarding;
    document.getElementById('tktDropping').innerText = b.dropping;
    document.getElementById('tktSeats').innerText = (b.seats || []).join(', ');
    document.getElementById('tktFare').innerText = `₹${b.fare}`;

    const utr = (b.utrNumber && b.utrNumber !== 'N/A') ? b.utrNumber : '';
    document.getElementById('tktPaymentInfo').innerText = `${b.paymentMode}${utr ? ' (UTR: ' + utr + ')' : ''}`;

    const isApproved = b.status === 'Approved';
    const badge = document.getElementById('tktStatusBadge');
    if (isApproved) {
        const bus = (getAppData().buses || []).find(x => x.id === b.busId || x.id == b.busId) || null;
        const trackingWin = typeof getJourneyTrackingWindow === 'function' ? getJourneyTrackingWindow(b, bus) : null;
        if (trackingWin && trackingWin.status === 'COMPLETED') {
            badge.className = "bg-gray-100 text-gray-700 text-[11px] font-black px-2.5 py-1 rounded-full border border-gray-300 uppercase";
            badge.innerText = currentLang === 'bn' ? "যাত্রা সম্পন্ন" : "JOURNEY COMPLETED";
        } else {
            badge.className = "bg-green-100 text-green-800 text-[11px] font-black px-2.5 py-1 rounded-full border border-green-300 uppercase";
            badge.innerText = "BOOKING DONE (APPROVED)";
        }
    }

    const qrData = encodeURIComponent(`BUSYATRA_PASS_${b.id}_SEATS_${(b.seats || []).join('-')}`);
    document.getElementById('tktQrImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}`;
    document.getElementById('tktTerms').innerText = b.ticketTerms || "Please arrive at the boarding stoppage 15 minutes before scheduled departure. Valid government ID proof mandatory. Ticket is non-transferable.";

    if (typeof updateTicketNextGenFeatures === 'function') {
        updateTicketNextGenFeatures(b);
    }

    document.getElementById('brandedTicketModal').classList.remove('hidden');
}

function closeBrandedTicketModal() {
    document.getElementById('brandedTicketModal').classList.add('hidden');
}

function shareTicketWhatsApp() {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(lastTicketText)}`, '_blank');
}

function backToBuses() {
    currentBookingIdempotencyKey = null;
    stopSeatAvailabilityPolling();
    releaseSeatHold();
    selectedSeatsSet.clear();
    myHeldSeatsForSelection.clear();
    document.getElementById('seatSelectionSection').classList.add('hidden');
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('busListSection').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    saveCustomerFlowState({ step: 'bus_list', busId: null, selectedSeats: [] });
}

function resetApp() {
    currentBookingIdempotencyKey = null;
    stopSeatAvailabilityPolling();
    clearCustomerFlowState();
    releaseSeatHold();
    stopSeatHoldTimer();
    document.getElementById('successSection').classList.add('hidden');
    document.getElementById('paymentSection').classList.add('hidden');
    document.getElementById('seatSelectionSection').classList.add('hidden');
    document.getElementById('busListSection').classList.add('hidden');
    selectedSeatsSet.clear();
    if (successBookingPoll) clearInterval(successBookingPoll);
    successBookingPoll = null;
}

function toggleSidebar() {
    const menu = document.getElementById('sidebarMenu');
    if (menu) menu.classList.toggle('hidden');
}

// --- Corporate & Legal Modals (Google & Payment Gateway Approval Compliant) ---
function openCorporateModal(section = 'about') {
    const modal = document.getElementById('corporateLegalModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    switchCorporateTab(section);
    const yr = new Date().getFullYear();
    const span1 = document.getElementById('corporateFooterYear');
    const span2 = document.getElementById('corpModalYear');
    if (span1) span1.textContent = yr;
    if (span2) span2.textContent = yr;
}

function closeCorporateModal() {
    const modal = document.getElementById('corporateLegalModal');
    if (modal) modal.classList.add('hidden');
}

function switchCorporateTab(tabName) {
    const tabs = ['about', 'terms', 'privacy', 'refund', 'contact'];
    tabs.forEach(t => {
        const pane = document.getElementById(`corpPane-${t}`);
        const btn = document.getElementById(`corpTabBtn-${t}`);
        if (pane) {
            if (t === tabName) {
                pane.classList.remove('hidden');
            } else {
                pane.classList.add('hidden');
            }
        }
        if (btn) {
            if (t === tabName) {
                btn.className = 'flex-1 min-w-[90px] py-2 px-2.5 rounded-xl font-bold bg-white text-red-600 shadow-sm transition whitespace-nowrap text-center';
            } else {
                btn.className = 'flex-1 min-w-[90px] py-2 px-2.5 rounded-xl font-semibold text-gray-600 hover:text-gray-900 hover:bg-white/60 transition whitespace-nowrap text-center';
            }
        }
    });
    const body = document.getElementById('corporateModalBody');
    if (body) body.scrollTop = 0;
}

window.openCorporateModal = openCorporateModal;
window.closeCorporateModal = closeCorporateModal;
window.switchCorporateTab = switchCorporateTab;

// --- Customer Bookings Lookup Modal ---
function openMyBookingsModal() {
    const customer = getLoggedInCustomer();
    if (!customer) {
        showDropDownToast(
            currentLang === 'bn' ? 'অনুগ্রহ করে প্রথমে লগইন করুন' : 'Please login first to view bookings',
            'warning'
        );
        alert(currentLang === 'bn'
            ? 'আপনার বুকিং ও ডিজিটাল টিকিট দেখতে অনুগ্রহ করে প্রথমে লগইন করুন।\n\n(Please login first to view your bookings and digital ticket.)'
            : 'Please login first to view your bookings and digital ticket.');
        openCustomerAuthModal('login');
        return;
    }
    const phoneInput = document.getElementById('lookupPhone');
    if (phoneInput && customer.phone) {
        phoneInput.value = customer.phone;
    }
    document.getElementById('myBookingsModal').classList.remove('hidden');
    if (customer.phone) {
        searchCustomerBookings();
    }
}

function closeMyBookingsModal() {
    document.getElementById('myBookingsModal').classList.add('hidden');
}

async function searchCustomerBookings() {
    const bookingId = document.getElementById('lookupBookingId').value.trim().toUpperCase();
    const phone = document.getElementById('lookupPhone').value.trim();
    const container = document.getElementById('lookupResults');

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
        alert(currentLang === 'bn' ? "দয়া করে সঠিক ১০ ডিজিটের মোবাইল নম্বর লিখুন!" : "Please enter a valid 10-digit mobile number!");
        return;
    }

    container.innerHTML = `<div class="text-center text-gray-400 py-4 text-xs">Searching for tickets...</div>`;

    let result;
    try {
        const query = new URLSearchParams({ phone });
        if (bookingId) query.append('bookingId', bookingId);
        result = await apiRequest(`/api/bookings/lookup?${query}`);
    } catch (err) {
        if (err.status === 403 || err.requireLogin || (err.message && err.message.includes('নিবন্ধিত'))) {
            container.innerHTML = `
                <div class="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-center space-y-3 shadow-xs">
                    <span class="text-3xl">🔒</span>
                    <div class="space-y-1">
                        <p class="font-black text-amber-950 text-sm">${currentLang === 'bn' ? 'এই অ্যাকাউন্টটি ইতিমধ্যে নিবন্ধিত' : 'Account Already Registered'}</p>
                        <p class="text-xs text-amber-900 leading-relaxed">
                            এই মোবাইল নম্বরটি (${escapeHtml(phone)}) একটি নিবন্ধিত অ্যাকাউন্ট। এর বুকিং হিস্ট্রি ও টিকিট দেখার জন্য অনুগ্রহ করে আপনার ৪-ডিজিটের পিন দিয়ে অ্যাকাউন্টে লগইন করুন।
                        </p>
                    </div>
                    <button type="button" onclick="closeMyBookingsModal(); openCustomerAuthModal('login'); const pInput = document.getElementById('customerLoginPhone'); if (pInput) pInput.value = '${escapeHtml(phone)}';" class="w-full bg-red-600 hover:bg-red-700 text-white font-black text-xs py-2.5 rounded-xl shadow-md transition">
                        ${currentLang === 'bn' ? '🔑 ৪-ডিজিট পিন দিয়ে লগইন করুন' : '🔑 Login with 4-Digit PIN'}
                    </button>
                </div>
            `;
            return;
        }
        container.innerHTML = `<div class="text-center text-red-500 py-4 text-xs font-semibold">${escapeHtml(err.message)}</div>`;
        return;
    }

    const bookings = result.bookings || (result.booking ? [result.booking] : []);
    bookings.forEach(b => saveOfflineTicketLocally(b));

    if (bookings.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 py-4 text-xs">No bookings found for this mobile number.</div>`;
        return;
    }

    container.innerHTML = "";
    if (bookings.length > 1) {
        const topBar = document.createElement('div');
        topBar.className = "flex justify-between items-center bg-gray-100 p-2.5 rounded-xl border text-xs mb-3";
        topBar.innerHTML = `
            <span class="font-bold text-gray-700">📋 মোট ${bookings.length}টি বুকিং</span>
            <button type="button" onclick="customerClearAllBookings()" class="text-red-600 hover:text-red-800 font-bold hover:underline flex items-center gap-1">
                <span>🧹</span> <span>${currentLang === 'bn' ? 'সব হিস্ট্রি মুছুন' : 'Clear All History'}</span>
            </button>
        `;
        container.appendChild(topBar);
    }

    bookings.forEach(b => {
        const isApproved = b.status === "Approved";
        const isRejected = b.status === "Rejected";
        const isCancelled = b.status === "Cancelled";
        const isCancelRequested = b.status === "Cancellation Requested";

        const bus = (getAppData().buses || []).find(x => x.id === b.busId || x.id == b.busId) || null;
        const trackingWin = typeof getJourneyTrackingWindow === 'function' ? getJourneyTrackingWindow(b, bus) : { status: 'LIVE_ACTIVE' };
        const isJourneyCompleted = isApproved && trackingWin.status === 'COMPLETED';
        const isTrackingLive = isApproved && trackingWin.status === 'LIVE_ACTIVE' && getAppData().featureFlags.liveTracking !== false;
        const isTrackingUpcoming = isApproved && trackingWin.status === 'UPCOMING' && getAppData().featureFlags.liveTracking !== false;

        let statusBadgeHtml = '';
        if (isCancelled) {
            statusBadgeHtml = `<span class="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-red-100 text-red-700 border border-red-300">🚫 ${currentLang === 'bn' ? 'বুকিং বাতিল' : 'Cancelled'}</span>`;
        } else if (isCancelRequested) {
            statusBadgeHtml = `<span class="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">⏳ ${currentLang === 'bn' ? 'বাতিলের অনুরোধ বিবেচনাধীন' : 'Cancel Requested'}</span>`;
        } else if (isJourneyCompleted) {
            statusBadgeHtml = `<span class="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-gray-100 text-gray-700 border border-gray-300 inline-flex items-center gap-1"><span>✅</span> <span>${currentLang === 'bn' ? 'যাত্রা সম্পন্ন' : 'Journey Completed'}</span></span>`;
        } else if (isApproved) {
            statusBadgeHtml = `<span class="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-green-100 text-green-700">Booking Done</span>`;
        } else if (isRejected) {
            statusBadgeHtml = `<span class="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-red-100 text-red-700">${escapeHtml(b.status)}</span>`;
        } else {
            statusBadgeHtml = `<span class="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-orange-100 text-orange-700">${escapeHtml(b.status)}</span>`;
        }

        const card = document.createElement('div');
        card.className = "bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2 text-xs";

        let refundInfoHtml = '';
        if (isCancelled) {
            if (b.refundStatus === 'processing') {
                refundInfoHtml = `
                    <div class="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs font-bold flex items-center justify-between">
                        <span class="flex items-center gap-1.5"><span>⏳</span> <span>${currentLang === 'bn' ? 'টাকা রিফান্ড প্রক্রিয়াধীন:' : 'Refund Under Process:'}</span></span>
                        <span class="text-sm font-black text-amber-800">₹${b.refundAmount || 0}</span>
                    </div>
                `;
            } else if (b.refundStatus === 'completed') {
                refundInfoHtml = `
                    <div class="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 text-xs font-bold flex items-center justify-between">
                        <span class="flex items-center gap-1.5"><span>✅</span> <span>${currentLang === 'bn' ? 'রিফান্ড সম্পন্ন:' : 'Refund Completed:'}</span></span>
                        <span class="text-sm font-black text-emerald-800">₹${b.refundAmount || 0} ${currentLang === 'bn' ? 'ফেরত দেওয়া হয়েছে' : 'Refunded'}</span>
                    </div>
                `;
            } else {
                refundInfoHtml = `
                    <div class="p-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 text-xs font-semibold">
                        🚫 ${currentLang === 'bn' ? 'এই টিকিটটি বাতিল করা হয়েছে (PDF ডাউনলোড বন্ধ)।' : 'This booking has been cancelled (PDF download disabled).'}
                    </div>
                `;
            }
        } else if (isCancelRequested) {
            refundInfoHtml = `
                <div class="p-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs font-semibold flex items-center gap-2">
                    <span>⏳</span>
                    <span>${currentLang === 'bn' ? 'আপনার টিকিট বাতিলের অনুরোধ জমা আছে। বাস ওনার বা কর্তৃপক্ষ যাচাই করে রিফান্ড চূড়ান্ত করবেন।' : 'Cancellation request is pending review by the bus operator.'}</span>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <span class="font-bold text-gray-900 text-sm">${escapeHtml(b.busName)} (${escapeHtml(b.busNumber)})</span>
                    <div class="text-[11px] text-gray-500 font-semibold">${escapeHtml(b.companyName || b.ownerName + ' Travels')}</div>
                </div>
                ${statusBadgeHtml}
            </div>
            <div><strong>Booking ID:</strong> <span class="font-mono text-red-600 font-bold">${escapeHtml(b.id)}</span></div>
            <div><strong>Seats:</strong> <span class="font-bold">${escapeHtml((b.seats || []).join(', '))}</span> • <strong>Date:</strong> ${escapeHtml(b.date)}</div>
            <div><strong>Route:</strong> ${escapeHtml(b.boarding)} ➔ ${escapeHtml(b.dropping)} • <strong>Fare:</strong> ₹${b.fare}</div>

            ${refundInfoHtml}

            <div class="flex flex-wrap gap-2 pt-2 border-t">
                ${isCancelled ? `
                    <span class="text-xs text-red-600 font-bold flex-1 flex items-center">
                        🚫 ${currentLang === 'bn' ? 'বুকিং বাতিল করা হয়েছে' : 'Booking Cancelled'}
                    </span>
                ` : `
                    <button type="button" class="view-tkt-btn flex-1 ${isApproved ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'} text-white py-1.5 px-3 rounded-lg font-bold text-xs shadow-sm transition" ${isApproved ? '' : 'disabled'}>
                        ${isApproved ? (isJourneyCompleted ? (currentLang === 'bn' ? '📄 টিকিট দেখুন (পুরোনো)' : '📄 View Past Ticket') : '📄 View / Download Ticket') : '⏳ Ticket after approval'}
                    </button>
                `}
                ${(isApproved && !isJourneyCompleted) ? `
                    <button type="button" class="cancel-request-btn bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-700 border border-amber-300 py-1.5 px-3 rounded-lg font-bold text-xs shadow-xs transition flex items-center gap-1" title="Request Cancellation">
                        <span>❌</span> <span>${currentLang === 'bn' ? 'টিকিট বাতিল অনুরোধ' : 'Cancel Ticket'}</span>
                    </button>
                ` : ''}
                ${isTrackingLive ? `
                    <button type="button" class="track-btn bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3 rounded-lg font-bold text-xs shadow-sm transition flex items-center gap-1.5 animate-pulse">
                        <span class="w-2 h-2 rounded-full bg-white animate-ping"></span>
                        <span>📍</span> <span>${currentLang === 'bn' ? 'লাইভ ট্র্যাক' : 'Track Live'}</span>
                    </button>
                ` : isTrackingUpcoming ? `
                    <button type="button" class="track-upcoming-btn bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 py-1.5 px-3 rounded-lg font-bold text-xs shadow-xs transition flex items-center gap-1" title="${currentLang === 'bn' ? 'যাত্রা শুরুর ' + (trackingWin.leadHours || 6) + ' ঘণ্টা আগে ট্র্যাকিং চালু হবে' : 'Tracking unlocks ' + (trackingWin.leadHours || 6) + ' hours before departure'}">
                        <span>🕒</span> <span>${currentLang === 'bn' ? 'ট্র্যাকিং ' + (trackingWin.leadHours || 6) + ' ঘণ্টা আগে চালু হবে' : 'Track in ' + trackingWin.hoursUntilTrack + 'h'}</span>
                    </button>
                ` : isJourneyCompleted ? `
                    <span class="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 border border-gray-200 py-1.5 px-3 rounded-lg font-bold text-xs select-none">
                        <span>✅</span> <span>${currentLang === 'bn' ? 'যাত্রা সম্পন্ন' : 'Journey Completed'}</span>
                    </span>
                ` : ''}
                <button type="button" class="del-booking-btn bg-red-50 hover:bg-red-600 hover:text-white text-red-600 border border-red-200 py-1.5 px-3 rounded-lg font-bold text-xs shadow-xs transition flex items-center gap-1" title="Delete from history">
                    🗑️ ডিলিট
                </button>
            </div>
        `;

        const viewBtn = card.querySelector('.view-tkt-btn');
        if (viewBtn) viewBtn.onclick = () => openTicketModalFromBooking(b);

        const cancelReqBtn = card.querySelector('.cancel-request-btn');
        if (cancelReqBtn) cancelReqBtn.onclick = () => customerRequestCancelBooking(b.id, b.busName, b.fare);

        if (isTrackingLive) {
            const trackBtn = card.querySelector('.track-btn');
            if (trackBtn) trackBtn.onclick = () => openLiveTracking(b.busId, `${b.busName} (${b.busNumber})`, b);
        } else if (isTrackingUpcoming) {
            const upcomingBtn = card.querySelector('.track-upcoming-btn');
            if (upcomingBtn) {
                upcomingBtn.onclick = () => {
                    const departureStr = trackingWin.departureDate ? trackingWin.departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (b.departureTime || '07:00 AM');
                    const leadHrs = trackingWin.leadHours || 6;
                    const msg = currentLang === 'bn'
                        ? `🕒 লাইভ জিপিএস ট্র্যাকিং যাত্রা শুরুর ${leadHrs} ঘণ্টা আগে স্বয়ংক্রিয়ভাবে সক্রিয় হবে। আপনার যাত্রা: ${b.date} • ${departureStr}।`
                        : `🕒 Live GPS tracking unlocks ${leadHrs} hours before departure. Scheduled trip: ${b.date} • ${departureStr}.`;
                    if (typeof showDropDownToast === 'function') {
                        showDropDownToast(msg, 'info');
                    } else {
                        alert(msg);
                    }
                };
            }
        }
        card.querySelector('.del-booking-btn').onclick = () => customerDeleteBooking(b.id);

        container.appendChild(card);
    });
}

async function customerRequestCancelBooking(bookingId, busName, fare) {
    const reasonPrompt = currentLang === 'bn' 
        ? `আপনি কি সত্যিই #${bookingId} বুকিং টিকিটটি বাতিল করতে চান?\n\nবাস: ${busName}\nভাড়া: ₹${fare}\n\nবাতিলের কারণ লিখুন (ঐচ্ছিক):` 
        : `Are you sure you want to cancel booking #${bookingId}?\n\nBus: ${busName}\nFare: ₹${fare}\n\nCancellation reason (optional):`;
    const reason = prompt(reasonPrompt, "");
    if (reason === null) return;

    try {
        await apiRequest('/api/bookings/cancellation', {
            method: 'POST',
            body: JSON.stringify({ bookingId, reason: reason.trim() })
        });
        showDropDownToast(
            currentLang === 'bn'
                ? '✅ টিকিট বাতিলের অনুরোধ সফলভাবে জমা হয়েছে।'
                : '✅ Cancellation request submitted successfully.',
            'info'
        );
        alert(currentLang === 'bn'
            ? 'আপনার টিকিট বাতিলের অনুরোধ সফলভাবে জমা হয়েছে। বাস ওনার বা কর্তৃপক্ষ এটি অনুমোদন করলে রিফান্ড প্রসেস শুরু হবে।'
            : 'Your cancellation request has been submitted. Operator will process your refund.');
        await searchCustomerBookings();
    } catch (err) {
        alert(err.message || 'Failed to submit cancellation request.');
    }
}
window.customerRequestCancelBooking = customerRequestCancelBooking;

async function customerDeleteBooking(bookingId) {
    const isBn = (typeof currentLang !== 'undefined' ? currentLang : 'bn') === 'bn';
    const ok = await showBusYatraConfirm({
        title: isBn ? "এই টিকিটটি মুছে ফেলবেন?" : `Delete Booking #${bookingId}?`,
        subtitle: isBn 
            ? `বুকিং #${bookingId} আপনার তালিকা থেকে স্থায়ীভাবে সরিয়ে ফেলা হবে।`
            : `Booking transaction #${bookingId} will be permanently removed from your view.`,
        icon: '🗑️',
        confirmText: isBn ? "হ্যাঁ, ডিলিট করুন" : "Yes, Delete",
        cancelText: isBn ? "না, রাখুন" : "Cancel",
        danger: true
    });
    if (!ok) return;

    try {
        const customer = getLoggedInCustomer();
        const headers = customer?.phone ? { 'x-customer-phone': customer.phone } : {};
        await apiRequest(`/api/customer/bookings/${encodeURIComponent(bookingId)}`, {
            method: 'DELETE',
            headers
        });
        showDropDownToast(isBn ? '✅ বুকিং হিস্ট্রি সফলভাবে ডিলিট করা হয়েছে।' : 'Booking deleted successfully.', 'success');
        await searchCustomerBookings();
    } catch (err) {
        showDropDownToast(err.message || 'বুকিং ডিলিট করা যায়নি।', 'error');
    }
}
window.customerDeleteBooking = customerDeleteBooking;

async function customerClearAllBookings() {
    const isBn = (typeof currentLang !== 'undefined' ? currentLang : 'bn') === 'bn';
    const ok = await showBusYatraConfirm({
        title: isBn ? "সমস্ত বুকিং হিস্ট্রি মুছে ফেলবেন?" : "Clear All Booking History?",
        subtitle: isBn 
            ? "আপনার অ্যাকাউন্টের সমস্ত পূর্ববর্তী বুকিং রেকর্ড তালিকা থেকে মুছে ফেলা হবে।"
            : "All past booking records will be cleared from your view.",
        icon: '🗑️',
        confirmText: isBn ? "হ্যাঁ, সমস্ত মুছুন" : "Yes, Clear All",
        cancelText: isBn ? "না, রাখুন" : "Keep History",
        danger: true
    });
    if (!ok) return;

    try {
        const customer = getLoggedInCustomer();
        const headers = customer?.phone ? { 'x-customer-phone': customer.phone } : {};
        await apiRequest('/api/customer/bookings/bulk-delete', {
            method: 'POST',
            headers,
            body: JSON.stringify({ clearAll: true })
        });
        showDropDownToast(isBn ? '✅ সমস্ত হিস্ট্রি ডিলিট করা হয়েছে।' : 'All history deleted.', 'success');
        await searchCustomerBookings();
    } catch (err) {
        showDropDownToast(err.message || 'হিস্ট্রি মুছতে সমস্যা হয়েছে।', 'error');
    }
}
window.customerClearAllBookings = customerClearAllBookings;

// --- Live Bus Tracking on Map ---
// --- Live Bus Tracking on Map (Ultra-Fast Firebase Firestore WebSocket + Cloudflare Fallback) ---
let trackingMap = null;
let trackingMarker = null;
let trackingAccuracyCircle = null;
let trackingInterval = null;
let trackingTickerInterval = null;
let firestoreTrackingUnsubscribe = null;
let lastTrackingLocation = null;

function recenterTrackingMap() {
    if (trackingMap && lastTrackingLocation) {
        trackingMap.setView([lastTrackingLocation.lat, lastTrackingLocation.lng], 16, { animate: true });
    }
}
window.recenterTrackingMap = recenterTrackingMap;

function updateTrackingTicker() {
    const timeEl = document.getElementById('trackingTime');
    if (!timeEl || !lastTrackingLocation) return;
    const diffMs = Date.now() - lastTrackingLocation.updatedAt.getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));

    let timeText = '';
    if (diffSec < 3) {
        timeText = currentLang === 'bn' ? 'এইমাত্র (Just now ⚡)' : 'Just now ⚡';
    } else if (diffSec < 60) {
        timeText = currentLang === 'bn' ? `${diffSec} সেকেন্ড আগে` : `${diffSec}s ago`;
    } else {
        const mins = Math.floor(diffSec / 60);
        timeText = currentLang === 'bn' ? `${mins} মিনিট আগে` : `${mins}m ago`;
    }
    timeEl.innerText = timeText;
}

async function openLiveTracking(busId, busTitle, booking = null) {
    if (booking && typeof getJourneyTrackingWindow === 'function') {
        const bus = (getAppData().buses || []).find(b => b.id === busId || b.id == busId);
        const win = getJourneyTrackingWindow(booking, bus);
        if (win.status === 'COMPLETED') {
            const msg = currentLang === 'bn' 
                ? 'এই ট্রিপটির যাত্রা ইতোমধ্যে সম্পন্ন হয়েছে। লাইভ ট্র্যাকিং আর উপলব্ধ নেই।' 
                : 'This journey has already been completed. Live tracking is no longer active.';
            alert(msg);
            return;
        }
        if (win.status === 'UPCOMING') {
            const departureStr = win.departureDate ? win.departureDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (booking.departureTime || '07:00 AM');
            const leadHrs = win.leadHours || 6;
            const msg = currentLang === 'bn' 
                ? `🕒 লাইভ ট্র্যাকিং যাত্রা শুরুর ${leadHrs} ঘণ্টা আগে সক্রিয় হবে। (যাত্রা সময়: ${booking.date} • ${departureStr})` 
                : `🕒 Live tracking unlocks ${leadHrs} hours before scheduled departure.`;
            alert(msg);
            return;
        }
    }

    const modal = document.getElementById('liveTrackingModal');
    if (!modal) return;
    document.getElementById('trackingBusTitle').innerText = busTitle;
    modal.classList.remove('hidden');

    // Clean up previous listeners if any
    if (firestoreTrackingUnsubscribe) {
        firestoreTrackingUnsubscribe();
        firestoreTrackingUnsubscribe = null;
    }
    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
    }
    if (trackingTickerInterval) {
        clearInterval(trackingTickerInterval);
        trackingTickerInterval = null;
    }

    trackingTickerInterval = setInterval(updateTrackingTicker, 1000);

    let hasReceivedFirestoreData = false;

    // 1. Ultra-Fast Firebase Firestore Real-Time Listener (<100ms updates, zero D1 polling cost)
    try {
        const db = getBusYatraFirestore();
        if (db) {
            firestoreTrackingUnsubscribe = db.collection('bus_locations').doc(String(busId)).onSnapshot(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
                        hasReceivedFirestoreData = true;
                        renderLiveBusLocationOnMap(data.lat, data.lng, data.updated_at, data.speed, data.stopName, data.accuracy, data.heading);
                    }
                } else if (!hasReceivedFirestoreData) {
                    // Fallback to Cloudflare if not in Firestore yet
                    updateLiveTrackingLocation(busId);
                }
            }, err => {
                console.warn('Firestore live tracking listener notice, falling back to polling:', err);
                if (!hasReceivedFirestoreData) {
                    updateLiveTrackingLocation(busId);
                }
            });
        }
    } catch (e) {
        console.warn('Firebase live tracking init error:', e);
    }

    // 2. Initial fetch or Fallback Polling (Every 10 seconds if Firestore has not received data)
    await updateLiveTrackingLocation(busId);
    trackingInterval = setInterval(() => {
        if (!hasReceivedFirestoreData) {
            updateLiveTrackingLocation(busId);
        }
    }, 10000);
}

function renderLiveBusLocationOnMap(lat, lng, updatedAtStr, speed = null, stopName = null, accuracy = null, heading = null) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const updatedAt = updatedAtStr ? new Date(updatedAtStr) : new Date();
    lastTrackingLocation = { lat, lng, updatedAt, speed, stopName, accuracy, heading };

    const stale = (Date.now() - updatedAt.getTime()) > 120000; // 2 minutes

    const statusEl = document.getElementById('trackingStatus');
    const speedVal = document.getElementById('trackingSpeedVal');
    const accuracyVal = document.getElementById('trackingAccuracyVal');
    const stopVal = document.getElementById('trackingStopVal');

    if (statusEl) {
        if (stale) {
            statusEl.className = 'font-bold text-amber-600 flex items-center gap-1';
            statusEl.innerHTML = currentLang === 'bn' 
                ? '<span>⚠️ জিপিএস সিগন্যাল বিলম্বিত</span>' 
                : '<span>⚠️ GPS Signal Delayed</span>';
        } else {
            statusEl.className = 'font-bold text-emerald-600 flex items-center gap-1.5';
            statusEl.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block"></span> <span>${currentLang === 'bn' ? '🟢 রিয়েল-টাইম লাইভ জিপিএস সক্রিয়' : '🟢 Real-time Live GPS Active'}</span>`;
        }
    }

    if (speedVal) {
        speedVal.innerText = (speed !== null && speed >= 0) ? `${speed} km/h` : '0 km/h';
    }

    if (accuracyVal) {
        const accNum = accuracy ? Math.round(accuracy) : 8;
        accuracyVal.innerText = currentLang === 'bn' ? `±${accNum}m (স্যাটেলাইট লক)` : `±${accNum}m (Lock)`;
    }

    if (stopVal) {
        stopVal.innerText = stopName ? stopName : (currentLang === 'bn' ? 'রুটে চলমান' : 'On Scheduled Route');
    }

    updateTrackingTicker();

    // High-resolution Leaflet icon with live pulse radar animation
    const busIcon = L.divIcon({
        className: 'bus-yatra-live-marker',
        html: `
            <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
                <div class="animate-ping" style="position: absolute; inset: -3px; border-radius: 9999px; background: rgba(37, 99, 235, 0.45); pointer-events: none;"></div>
                <div style="position: relative; z-index: 10; background: linear-gradient(135deg, #1d4ed8, #2563eb); color: white; width: 40px; height: 40px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 14px rgba(0,0,0,0.35); border: 2.5px solid white;">
                    🚌
                    <span style="position: absolute; top: -1px; right: -1px; width: 11px; height: 11px; background: #22c55e; border-radius: 9999px; border: 2px solid white; box-shadow: 0 0 6px #22c55e;"></span>
                </div>
            </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -22]
    });

    const popupContent = `
        <div style="text-align: center; font-family: system-ui, sans-serif; font-size: 12px; padding: 2px;">
            <strong style="color: #1e3a8a; font-size: 14px; font-weight: 800;">🚌 Bus Yatra Express</strong><br>
            ${stopName ? `<span style="font-size: 12px; color: #111827;">📍 অবস্থান: <b>${escapeHtml(stopName)}</b></span><br>` : ''}
            <span style="color: #4b5563;">সর্বশেষ জিপিএস: <b>${updatedAt.toLocaleTimeString()}</b></span>
            ${speed !== null ? `<br><span style="color: #059669; font-weight: 800;">গতি: ${speed} km/h</span>` : ''}
            ${accuracy ? `<br><span style="color: #2563eb; font-size: 11px; font-weight: 700;">নির্ভুলতা: ±${Math.round(accuracy)}m</span>` : ''}
        </div>
    `;

    if (!trackingMap) {
        trackingMap = L.map('mapContainer', {
            zoomControl: true,
            maxZoom: 19
        }).setView([lat, lng], 16);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(trackingMap);

        // Accuracy circle
        const rad = accuracy && accuracy > 0 ? Math.min(accuracy, 100) : 12;
        trackingAccuracyCircle = L.circle([lat, lng], {
            radius: rad,
            color: '#2563eb',
            fillColor: '#60a5fa',
            fillOpacity: 0.15,
            weight: 1.5
        }).addTo(trackingMap);

        trackingMarker = L.marker([lat, lng], { icon: busIcon }).addTo(trackingMap);
        trackingMarker.bindPopup(popupContent);
    } else {
        trackingMarker.setIcon(busIcon);
        trackingMarker.setLatLng([lat, lng]);
        trackingMarker.setPopupContent(popupContent);

        if (trackingAccuracyCircle) {
            const rad = accuracy && accuracy > 0 ? Math.min(accuracy, 100) : 12;
            trackingAccuracyCircle.setLatLng([lat, lng]);
            trackingAccuracyCircle.setRadius(rad);
        }

        // Smooth panTo bus location
        trackingMap.panTo([lat, lng], { animate: true, duration: 0.8 });
        setTimeout(() => trackingMap.invalidateSize(), 200);
    }
}

async function updateLiveTrackingLocation(busId) {
    try {
        const res = await apiRequest(`/api/tracking?busId=${encodeURIComponent(busId)}`);
        const loc = res.location;
        if (!loc || loc.lat === null || loc.lng === null) {
            const statusEl = document.getElementById('trackingStatus');
            const timeEl = document.getElementById('trackingTime');
            if (statusEl) {
                statusEl.className = 'font-bold text-red-600';
                statusEl.innerText = currentLang === 'bn' ? '🔴 GPS বন্ধ' : '🔴 GPS unavailable';
            }
            if (timeEl) {
                timeEl.innerText = currentLang === 'bn'
                    ? 'ক্যাপ্টেন GPS চালু করেননি; লাইভ অবস্থান পাওয়া যাচ্ছে না।'
                    : 'No live GPS location yet. The captain must turn GPS sharing on.';
            }
            return;
        }

        renderLiveBusLocationOnMap(loc.lat, loc.lng, loc.location_updated_at, null, null);
    } catch (err) {
        console.warn('Tracking location update failed:', err);
    }
}

function closeLiveTracking() {
    const modal = document.getElementById('liveTrackingModal');
    if (modal) modal.classList.add('hidden');
    if (firestoreTrackingUnsubscribe) {
        firestoreTrackingUnsubscribe();
        firestoreTrackingUnsubscribe = null;
    }
    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
    }
    if (trackingTickerInterval) {
        clearInterval(trackingTickerInterval);
        trackingTickerInterval = null;
    }
}


// --- Customer Notification Modal & Real-time Fetch ---
let cachedCustomerNotifs = [];

function openCustomerNotificationModal() {
    const modal = document.getElementById('customerNotificationModal');
    if (modal) modal.classList.remove('hidden');
    loadCustomerNotifications();
}
window.openCustomerNotificationModal = openCustomerNotificationModal;

function closeCustomerNotificationModal() {
    const modal = document.getElementById('customerNotificationModal');
    if (modal) modal.classList.add('hidden');
}
window.closeCustomerNotificationModal = closeCustomerNotificationModal;

async function loadCustomerNotifications() {
    const list = document.getElementById('customerNotificationList');
    const badge = document.getElementById('customerHeaderNotifBadge');
    const customer = getLoggedInCustomer();
    const phone = customer?.phone || localStorage.getItem('last_customer_phone') || '';
    
    try {
        const query = phone ? `?phone=${encodeURIComponent(phone)}` : '';
        const res = await apiRequest(`/api/customer/notifications${query}`);
        const notifs = res.notifications || [];
        cachedCustomerNotifs = notifs;

        const bottomBadge = document.getElementById('mobileBottomNotifBadge');
        if (notifs.length > 0) {
            if (badge) {
                badge.innerText = notifs.length;
                badge.classList.remove('hidden');
            }
            if (bottomBadge) {
                bottomBadge.innerText = notifs.length;
                bottomBadge.classList.remove('hidden');
            }
        } else {
            if (badge) badge.classList.add('hidden');
            if (bottomBadge) bottomBadge.classList.add('hidden');
        }

        if (!list) return;
        if (!notifs.length) {
            list.innerHTML = `<div class="text-center text-gray-400 py-8 text-xs">এই মুহূর্তে কোনো নতুন নোটিফিকেশন নেই।<br><span class="text-[11px] text-gray-300">(No active notifications right now)</span></div>`;
            return;
        }

        list.innerHTML = notifs.map(n => {
            const dateStr = new Date(n.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
            const typeIcon = n.type === 'alert' ? '⚠️' : n.type === 'offer' ? '🎁' : n.type === 'announcement' ? '📢' : 'ℹ️';
            const isOwner = n.sender_role === 'owner';
            const senderTag = isOwner 
                ? '<span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-bold">🚌 Bus Authority</span>' 
                : '<span class="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-[10px] font-bold">📢 Bus Yatra Admin</span>';

            return `
            <div class="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs space-y-2 hover:border-red-300 transition shadow-xs">
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
window.loadCustomerNotifications = loadCustomerNotifications;

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        const pName = document.getElementById('passengerName');
        const pPhone = document.getElementById('passengerPhone');
        const bSelect = document.getElementById('boardingPointSelect');
        const dSelect = document.getElementById('droppingPointSelect');

        if (pName) {
            pName.addEventListener('input', () => {
                saveCustomerFlowState({ passengerName: pName.value });
            });
        }
        if (pPhone) {
            pPhone.addEventListener('input', () => {
                saveCustomerFlowState({ passengerPhone: pPhone.value });
            });
        }
        if (bSelect) {
            bSelect.addEventListener('change', () => {
                saveCustomerFlowState({ boarding: bSelect.value });
            });
        }
        if (dSelect) {
            dSelect.addEventListener('change', () => {
                saveCustomerFlowState({ dropping: dSelect.value });
            });
        }
    });
}

// --- Next-Gen Feature Control Center (Customer Portal) ---
// --- Next-Gen Feature Control Center (Customer Portal) ---
// All next-gen options are DISABLED (false) by default.
// They are ONLY activated when the Super Admin explicitly enables them in Admin Panel.
window.customerFeatures = {
    offline_tickets: false,
    referral_rewards: false,
    voice_search: false,
    parcel_booking: false,
    meal_preorder: false,
    women_safety: false,
    whatsapp_booking: false,
    bluetooth_offline: false,
    ncmc_smart_card: false,
    agent_portal: false,
    // 4 Advanced Features (Disabled by default - Managed strictly from Admin Panel)
    bengali_stop_announcer: false,
    flash_sale_pricing: false,
    smart_boarding_countdown: false,
    dropoff_wakeup_alarm: false
};

function applyCustomerFeatures(features = {}) {
    window.customerFeatures = {
        ...window.customerFeatures,
        ...features
    };
    const f = window.customerFeatures;

    // 1. Voice search mic buttons (Only enabled if admin granted voice_search)
    const voiceFrom = document.getElementById('btnVoiceSearchOrigin');
    const voiceTo = document.getElementById('btnVoiceSearchDest');
    const showVoice = f.voice_search === true;
    if (voiceFrom) {
        if (showVoice) {
            voiceFrom.classList.remove('hidden');
            voiceFrom.style.display = 'flex';
        } else {
            voiceFrom.classList.add('hidden');
            voiceFrom.style.display = 'none';
        }
    }
    if (voiceTo) {
        if (showVoice) {
            voiceTo.classList.remove('hidden');
            voiceTo.style.display = 'flex';
        } else {
            voiceTo.classList.add('hidden');
            voiceTo.style.display = 'none';
        }
    }

    // 2. Offline tickets quick action button
    const offlineBtn = document.getElementById('btnCustomerOfflineTicket');
    const showOffline = f.offline_tickets === true;
    if (offlineBtn) {
        if (showOffline) {
            offlineBtn.classList.remove('hidden');
            offlineBtn.style.display = 'flex';
        } else {
            offlineBtn.classList.add('hidden');
            offlineBtn.style.display = 'none';
        }
    }

    // 3. Referral rewards banner
    const refBanner = document.getElementById('customerReferralBanner');
    const showRef = f.referral_rewards === true;
    if (refBanner) {
        if (showRef) {
            refBanner.classList.remove('hidden');
            refBanner.style.display = 'flex';
        } else {
            refBanner.classList.add('hidden');
            refBanner.style.display = 'none';
        }
    }

    // 4. Parcel & luggage courier button
    const parcelBtn = document.getElementById('customerParcelSection');
    const showParcel = f.parcel_booking === true;
    if (parcelBtn) {
        if (showParcel) {
            parcelBtn.classList.remove('hidden');
            parcelBtn.style.display = 'flex';
        } else {
            parcelBtn.classList.add('hidden');
            parcelBtn.style.display = 'none';
        }
    }

    // Parent quick actions row
    const quickRow = document.getElementById('customerQuickActionRow');
    if (quickRow) {
        if (showOffline || showParcel) {
            quickRow.classList.remove('hidden');
            quickRow.style.display = 'grid';
            quickRow.className = (showOffline && showParcel)
                ? 'grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100'
                : 'grid grid-cols-1 gap-2 mt-3 pt-3 border-t border-gray-100';
        } else {
            quickRow.classList.add('hidden');
            quickRow.style.display = 'none';
        }
    }

    // 5. Meal pre-order add-on at checkout
    const mealSection = document.getElementById('customerMealSection');
    if (mealSection) mealSection.style.display = f.meal_preorder === true ? 'block' : 'none';

    // 6. Women safety badge
    const womenBadge = document.getElementById('customerWomenSafetyBadge');
    if (womenBadge) womenBadge.style.display = f.women_safety === true ? 'flex' : 'none';

    // 7. WhatsApp AI bot quick trigger
    const waBookingBtn = document.getElementById('customerWhatsAppBookingBtn');
    if (waBookingBtn) waBookingBtn.style.display = f.whatsapp_booking === true ? 'flex' : 'none';

    // 8. Bluetooth BLE offline pass indicator
    const blePassIndicator = document.getElementById('customerBlePassIndicator');
    if (blePassIndicator) blePassIndicator.style.display = f.bluetooth_offline === true ? 'flex' : 'none';

    // 9. NCMC smart travel card banner
    const ncmcCardBanner = document.getElementById('customerNcmcCardBanner');
    if (ncmcCardBanner) ncmcCardBanner.style.display = f.ncmc_smart_card === true ? 'flex' : 'none';

    // 10. Local agent / dukaan booking counter badge
    const agentCounterBadge = document.getElementById('customerAgentCounterBadge');
    if (agentCounterBadge) agentCounterBadge.style.display = f.agent_portal === true ? 'flex' : 'none';

    // 11. GPS Bengali Stop Announcer
    const tktAnnouncerSection = document.getElementById('tktStopAnnouncerWrapper');
    if (tktAnnouncerSection) {
        tktAnnouncerSection.style.display = f.bengali_stop_announcer === true ? 'flex' : 'none';
    }

    // 12. Smart Boarding Countdown & Live Weather Widget
    const boardingWidget = document.getElementById('tktNextgenWidget');
    if (boardingWidget) {
        if (f.smart_boarding_countdown === true) {
            boardingWidget.classList.remove('hidden');
            boardingWidget.style.display = 'flex';
        } else {
            boardingWidget.classList.add('hidden');
            boardingWidget.style.display = 'none';
        }
    }

    // 13. Drop-off Wake-Up Alarm
    const wakeupAlarmSection = document.getElementById('tktWakeupAlarmWrapper');
    if (wakeupAlarmSection) {
        wakeupAlarmSection.style.display = f.dropoff_wakeup_alarm === true ? 'flex' : 'none';
    }

    // Travel assistance container row in ticket modal
    const travelAssistSection = document.getElementById('tktNextgenTravelAssist');
    if (travelAssistSection) {
        if (f.dropoff_wakeup_alarm === true || f.bengali_stop_announcer === true) {
            travelAssistSection.classList.remove('hidden');
            travelAssistSection.style.display = 'flex';
        } else {
            travelAssistSection.classList.add('hidden');
            travelAssistSection.style.display = 'none';
        }
    }
}
window.applyCustomerFeatures = applyCustomerFeatures;

let dropoffAlarmArmed = false;
function toggleDropoffAlarm(e) {
    if (e) e.stopPropagation();
    dropoffAlarmArmed = !dropoffAlarmArmed;
    const btn = document.getElementById('btnToggleWakeupAlarm');
    if (dropoffAlarmArmed) {
        if (btn) {
            btn.className = "ml-1 px-2 py-1 bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-1 animate-pulse";
            btn.innerHTML = "🔔 অ্যালার্ম চালু (সক্রিয়)";
        }
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        if (typeof showDropDownToast === 'function') {
            showDropDownToast('⏰ ড্রপ-অফ ওয়েক-আপ অ্যালার্ম সক্রিয় হয়েছে! গন্তব্যের ১ কিমি পূর্বে অ্যালার্ম বাজবে।', 'success');
        } else {
            alert('⏰ ড্রপ-অফ ওয়েক-আপ অ্যালার্ম সক্রিয় হয়েছে! গন্তব্যের ১ কিমি পূর্বে অ্যালার্ম বাজবে।');
        }
    } else {
        if (btn) {
            btn.className = "ml-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition";
            btn.innerHTML = "🔔 অন করুন";
        }
    }
}
window.toggleDropoffAlarm = toggleDropoffAlarm;

let stopAnnouncerActive = false;
function toggleStopAnnouncer(e) {
    if (e) e.stopPropagation();
    stopAnnouncerActive = !stopAnnouncerActive;
    const btn = document.getElementById('btnToggleStopAnnouncer');
    if (stopAnnouncerActive) {
        if (btn) {
            btn.className = "ml-1 px-2 py-1 bg-blue-700 text-white rounded-lg text-[10px] font-bold shadow-sm flex items-center gap-1";
            btn.innerHTML = "🔊 সক্রিয়";
        }
        if ('speechSynthesis' in window) {
            try {
                window.speechSynthesis.cancel();
                const utter = new SpeechSynthesisUtterance('বাস যাত্রা স্টপ অ্যানাউন্সার সক্রিয় হয়েছে। পরবর্তী স্টপেজ আসার পূর্বে আপনাকে জানিয়ে দেওয়া হবে।');
                utter.lang = 'bn-IN';
                window.speechSynthesis.speak(utter);
            } catch (_) {}
        }
    } else {
        if (btn) {
            btn.className = "ml-1 px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-[10px] font-bold transition";
            btn.innerHTML = "🔇 বন্ধ";
        }
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }
}
window.toggleStopAnnouncer = toggleStopAnnouncer;

function updateTicketNextGenFeatures(b) {
    if (!b) return;
    const f = window.customerFeatures || {};
    const cdEl = document.getElementById('tktBoardingCountdown');
    const weatherEl = document.getElementById('tktWeatherText');

    if (f.smart_boarding_countdown === true && cdEl) {
        try {
            const todayStr = localDateStr();
            if (b.date === todayStr) {
                const timeParts = (b.departureTime || '07:00 AM').match(/(\d+):(\d+)\s*(AM|PM)/i);
                if (timeParts) {
                    let h = parseInt(timeParts[1], 10);
                    const m = parseInt(timeParts[2], 10);
                    const ampm = timeParts[3].toUpperCase();
                    if (ampm === 'PM' && h < 12) h += 12;
                    if (ampm === 'AM' && h === 12) h = 0;
                    const dep = new Date();
                    dep.setHours(h, m, 0, 0);
                    const diffMin = Math.round((dep.getTime() - Date.now()) / (1000 * 60));
                    if (diffMin > 60) {
                        const hrs = Math.floor(diffMin / 60);
                        const remM = diffMin % 60;
                        cdEl.innerText = currentLang === 'bn' ? `বাস ছাড়তে বাকি: ${hrs} ঘণ্টা ${remM} মিনিট` : `Departure in: ${hrs}h ${remM}m`;
                    } else if (diffMin > 0) {
                        cdEl.innerText = currentLang === 'bn' ? `বাস ছাড়তে বাকি: ${diffMin} মিনিট` : `Departure in: ${diffMin} mins`;
                    } else if (diffMin > -60) {
                        cdEl.innerText = currentLang === 'bn' ? `বাস এখন ট্রিপে রওয়ানা হয়েছে` : `Bus is currently on trip`;
                    } else {
                        cdEl.innerText = currentLang === 'bn' ? `যাত্রার সময় অতিক্রান্ত` : `Trip time elapsed`;
                    }
                }
            } else {
                cdEl.innerText = currentLang === 'bn' ? `যাত্রা নির্ধারিত: ${b.date}` : `Scheduled on: ${b.date}`;
            }
        } catch (_) {
            cdEl.innerText = currentLang === 'bn' ? `বোর্ডিং স্ট্যাটাস: অন-টাইম` : `Boarding Status: On-Time`;
        }
        if (weatherEl) {
            const dest = (b.dropping || 'Kolkata').split(' ')[0];
            weatherEl.innerText = currentLang === 'bn' ? `🌤️ ${dest}: ২৮°C মনোরম` : `🌤️ ${dest}: 28°C Clear`;
        }
    }
}
window.updateTicketNextGenFeatures = updateTicketNextGenFeatures;

// --- Offline Tickets Cache & Viewer (100% Offline Capability) ---
function saveOfflineTicketLocally(booking) {
    if (!booking || !booking.id) return;
    try {
        let cached = JSON.parse(localStorage.getItem('busyatra_offline_tickets') || '[]');
        if (!Array.isArray(cached)) cached = [];
        cached = cached.filter(b => b.id !== booking.id);
        cached.unshift(booking);
        if (cached.length > 10) cached = cached.slice(0, 10);
        localStorage.setItem('busyatra_offline_tickets', JSON.stringify(cached));
    } catch (_) {}
}
window.saveOfflineTicketLocally = saveOfflineTicketLocally;

function openCustomerOfflineTicketModal() {
    const modal = document.getElementById('offlineTicketModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    renderOfflineTicketsList();
}
window.openCustomerOfflineTicketModal = openCustomerOfflineTicketModal;

function closeCustomerOfflineTicketModal() {
    const modal = document.getElementById('offlineTicketModal');
    if (modal) modal.classList.add('hidden');
}
window.closeCustomerOfflineTicketModal = closeCustomerOfflineTicketModal;

function renderOfflineTicketsList() {
    const container = document.getElementById('offlineTicketsList');
    if (!container) return;
    let cached = [];
    try {
        cached = JSON.parse(localStorage.getItem('busyatra_offline_tickets') || '[]');
    } catch (_) {}

    if (!Array.isArray(cached) || cached.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-400 py-8 text-xs">
                কোনো অফলাইন সংরক্ষিত টিকিট পাওয়া যায়নি।<br>
                টিকিট বুকিং বা অনুসন্ধান করলে স্বয়ংক্রিয়ভাবে এখানে সেভ থাকবে।
            </div>
        `;
        return;
    }

    container.innerHTML = cached.map(b => {
        const seats = Array.isArray(b.seats) ? b.seats.join(', ') : (b.seats || 'N/A');
        return `
            <div class="p-4 bg-white rounded-2xl border-2 border-purple-200 shadow-sm space-y-2.5">
                <div class="flex justify-between items-start border-b pb-2">
                    <div>
                        <div class="font-bold text-gray-900 text-sm">${escapeHtml(b.bus_name || 'Bus Yatra Express')}</div>
                        <div class="text-[11px] text-gray-500 font-mono font-bold">${escapeHtml(b.id)}</div>
                    </div>
                    <span class="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full">📱 OFFLINE PASS</span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                    <div><span class="text-gray-500">যাত্রী:</span> <strong>${escapeHtml(b.name || 'Passenger')}</strong></div>
                    <div><span class="text-gray-500">সিট:</span> <strong class="text-red-600">${escapeHtml(seats)}</strong></div>
                    <div><span class="text-gray-500">রুট:</span> <strong>${escapeHtml(b.from_city || '')} ➔ ${escapeHtml(b.to_city || '')}</strong></div>
                    <div><span class="text-gray-500">তারিখ:</span> <strong>${escapeHtml(b.journey_date || '')}</strong></div>
                </div>
                <div class="flex items-center justify-between pt-2 border-t text-xs">
                    <span class="text-green-700 font-bold">ভাড়া: ₹${escapeHtml(String(b.total_fare || '0'))}</span>
                    <button type="button" onclick="showOfflineTicketDetail('${escapeHtml(b.id)}')" class="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition">
                        📄 পূর্ণ টিকিট দেখুন
                    </button>
                </div>
            </div>
        `;
    }).join('');
}
window.renderOfflineTicketsList = renderOfflineTicketsList;

function showOfflineTicketDetail(bookingId) {
    let cached = [];
    try {
        cached = JSON.parse(localStorage.getItem('busyatra_offline_tickets') || '[]');
    } catch (_) {}
    const b = cached.find(item => item.id === bookingId);
    if (!b) return;
    closeCustomerOfflineTicketModal();
    activeBooking = b;

    const seatsArr = Array.isArray(b.seats) ? b.seats : (typeof b.seats === 'string' ? b.seats.split(',') : []);
    lastTicketText = `🚌 *Bus Yatra Offline Ticket*\nBooking ID: ${b.id}\nBus: ${b.bus_name || ''}\nPassenger: ${b.name} (${b.phone})\nSeats: ${seatsArr.join(', ')}\nRoute: ${b.from_city || ''} ➔ ${b.to_city || ''}\nDate: ${b.journey_date || ''}\nTotal Fare: ₹${b.total_fare || '0'}\nStatus: ${b.status || 'Confirmed'}`;

    const searchSec = document.getElementById('searchSection');
    const busListSec = document.getElementById('busListSection');
    const seatSec = document.getElementById('seatSelectionSection');
    const paySec = document.getElementById('paymentSection');
    const successSec = document.getElementById('successSection');

    if (searchSec) searchSec.classList.add('hidden');
    if (busListSec) busListSec.classList.add('hidden');
    if (seatSec) seatSec.classList.add('hidden');
    if (paySec) paySec.classList.add('hidden');
    if (successSec) successSec.classList.remove('hidden');

    const detailsEl = document.getElementById('ticketDetails');
    if (detailsEl) {
        detailsEl.innerHTML = `
            <div><strong>${currentLang === 'bn' ? 'বুকিং আইডি' : 'Booking ID'}:</strong> <span class="text-red-600 font-mono font-bold">${escapeHtml(b.id)}</span></div>
            <div><strong>${currentLang === 'bn' ? 'বাস' : 'Bus'}:</strong> ${escapeHtml(b.bus_name || 'Bus Yatra Express')} (${escapeHtml(b.bus_number || '')})</div>
            <div><strong>${currentLang === 'bn' ? 'যাত্রী' : 'Passenger'}:</strong> ${escapeHtml(b.name || '')} (${escapeHtml(b.phone || '')})</div>
            <div><strong>${currentLang === 'bn' ? 'আসন' : 'Seats'}:</strong> <span class="font-bold text-red-600">${escapeHtml(seatsArr.join(', '))}</span></div>
            <div><strong>${currentLang === 'bn' ? 'রুট' : 'Route'}:</strong> ${escapeHtml(b.from_city || '')} ➔ ${escapeHtml(b.to_city || '')} (${escapeHtml(b.journey_date || '')})</div>
            <div><strong>${currentLang === 'bn' ? 'মোট ভাড়া' : 'Total Fare'}:</strong> ₹${escapeHtml(String(b.total_fare || '0'))} (${escapeHtml(b.payment_mode || 'Cash/UPI')})</div>
            <div><strong>${currentLang === 'bn' ? 'স্ট্যাটাস' : 'Status'}:</strong> <span class="text-green-700 font-bold">✅ ${escapeHtml(b.status || 'Confirmed')} (Offline Pass)</span></div>
        `;
    }
    applyBookingStatusToUI(b);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.showOfflineTicketDetail = showOfflineTicketDetail;

// --- Bengali Voice Route Search ---
function triggerVoiceRouteInput(target = 'from') {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert(currentLang === 'bn' 
            ? 'আপনার ব্রাউজারে ভয়েস রিকগনিশন সমর্থন করে না। অনুগ্রহ করে Google Chrome বা Android Webview ব্যবহার করুন।' 
            : 'Speech recognition is not supported on this browser. Please use Chrome.');
        return;
    }
    try {
        const recognition = new SpeechRecognition();
        recognition.lang = currentLang === 'bn' ? 'bn-IN' : 'en-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        const btn = document.getElementById(target === 'from' ? 'btnVoiceSearchOrigin' : 'btnVoiceSearchDest');
        if (btn) btn.classList.add('animate-pulse', 'text-red-600');

        showToast(currentLang === 'bn' ? '🎙️ পরিষ্কারভাবে বলুন (যেমন: কলকাতা, দীঘা, শিলিগুড়ি)...' : '🎙️ Listening... Speak origin or destination');

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const input = document.getElementById(target === 'from' ? 'fromCityInput' : 'toCityInput');
            if (input && transcript) {
                input.value = transcript.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '').trim();
                filterCityDropdown(target);
                showToast(`✅ প্রাপ্ত: "${input.value}"`);
            }
        };
        recognition.onerror = (e) => {
            console.warn('Voice recognition error:', e);
            showToast(currentLang === 'bn' ? 'ভয়েস শোনা যায়নি, আবার ক্লিক করে বলুন।' : 'Could not hear voice. Please try again.');
        };
        recognition.onend = () => {
            if (btn) btn.classList.remove('animate-pulse', 'text-red-600');
        };
        recognition.start();
    } catch (err) {
        console.error('Speech recognition exception:', err);
    }
}
window.triggerVoiceRouteInput = triggerVoiceRouteInput;

// --- Referral & Earn Cashback Link ---
function copyReferralLink() {
    const customer = getLoggedInCustomer();
    const phone = customer ? customer.phone : '';
    const refCode = phone ? `CUST${phone.slice(-4)}` : 'YATRA50';
    const link = `https://busyatra.pages.dev/?ref=${refCode}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(() => {
            alert(currentLang === 'bn' 
                ? `✅ রেফারেল লিংক কপি হয়েছে!\n\n${link}\n\nবন্ধুরা এই লিংক দিয়ে বাসের টিকিট কাটলে আপনি পাবেন বিশেষ ছাড় ও বোনাস!` 
                : `✅ Referral link copied!\n\n${link}\n\nShare with friends to earn bonus rewards on their bookings!`);
        }).catch(() => {
            prompt(currentLang === 'bn' ? 'এই লিংকটি কপি করে বন্ধুদের পাঠান:' : 'Copy this referral link:', link);
        });
    } else {
        prompt(currentLang === 'bn' ? 'এই লিংকটি কপি করে বন্ধুদের পাঠান:' : 'Copy this referral link:', link);
    }
}
window.copyReferralLink = copyReferralLink;

// --- Bus Parcel & Luggage Booking Modal Handlers ---
function openCustomerParcelModal() {
    const modal = document.getElementById('customerParcelModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const customer = getLoggedInCustomer();
    const phoneInput = document.getElementById('parcelContactPhone');
    if (phoneInput && customer && customer.phone && !phoneInput.value) {
        phoneInput.value = customer.phone;
    }
}
window.openCustomerParcelModal = openCustomerParcelModal;

function closeCustomerParcelModal() {
    const modal = document.getElementById('customerParcelModal');
    if (modal) modal.classList.add('hidden');
}
window.closeCustomerParcelModal = closeCustomerParcelModal;

function submitCustomerParcelRequest() {
    const from = document.getElementById('parcelFromCity')?.value?.trim() || '';
    const to = document.getElementById('parcelToCity')?.value?.trim() || '';
    const desc = document.getElementById('parcelDesc')?.value?.trim() || '';
    const phone = document.getElementById('parcelContactPhone')?.value?.trim() || '';
    if (!from || !to || !desc || !phone) {
        alert(currentLang === 'bn' ? 'অনুগ্রহ করে সমস্ত প্রয়োজনীয় ঘর পূরণ করুন।' : 'Please fill all required fields.');
        return;
    }
    const msg = encodeURIComponent(`নমস্কার Bus Yatra,\nআমি বাসে পার্সেল পাঠাতে চাই:\n\n📍 কোথা থেকে: ${from}\n🏁 কোথায়: ${to}\n📦 পার্সেল বিবরণ: ${desc}\n📱 যোগাযোগ: ${phone}`);
    window.open(`https://wa.me/918768447312?text=${msg}`, '_blank');
    closeCustomerParcelModal();
}
window.submitCustomerParcelRequest = submitCustomerParcelRequest;


// Synchronize language changes on customer portal
if (typeof window !== 'undefined') {
    window.addEventListener('portal-language-change', (e) => {
        const lang = e.detail?.lang || 'bn';
        if (typeof currentLang !== 'undefined' && currentLang !== lang) {
            if (typeof changeLangInternal === 'function') changeLangInternal(lang);
        }
    });
}

// =========================================================================
// Enterprise Bus Yatra Virtual AI Support & Ticket System (Customer Client)
// =========================================================================
let customerSupportActiveTicket = null;
let aiVoiceRecognition = null;
let isAiVoiceListening = false;
let aiSelectedAttachmentBase64 = null;
let aiSupportPollTimer = null;

function initCustomerAiSupportTicket() {
    try {
        const saved = localStorage.getItem('busyatra_active_ticket');
        if (saved) {
            customerSupportActiveTicket = JSON.parse(saved);
        }
    } catch (_) {}

    if (!customerSupportActiveTicket || !customerSupportActiveTicket.ticket_number) {
        const randomCode = Math.floor(10000 + Math.random() * 90000);
        customerSupportActiveTicket = {
            ticket_number: `#BY-TKT-${randomCode}`,
            status: 'Open',
            messages: []
        };
        try {
            localStorage.setItem('busyatra_active_ticket', JSON.stringify(customerSupportActiveTicket));
        } catch (_) {}
    }
    updateAiTicketHeaderBadge();
}

function updateAiTicketHeaderBadge() {
    const badge = document.getElementById('aiActiveTicketBadge');
    if (!badge) return;
    const tktNum = customerSupportActiveTicket?.ticket_number || '#BY-TKT-LIVE';
    const status = customerSupportActiveTicket?.status || 'Open';
    const statusColor = status === 'Resolved' ? 'text-emerald-300' : 'text-yellow-200';
    badge.innerHTML = `টিকেট: <span class="font-bold underline">${tktNum}</span> • <span class="${statusColor} font-bold">${status}</span>`;
}

function openCustomerAiSupportModal() {
    const modal = document.getElementById('customerAiSupportModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    if (!customerSupportActiveTicket) {
        initCustomerAiSupportTicket();
    } else {
        updateAiTicketHeaderBadge();
    }

    // Immediately render chat history so the user sees the welcome bubble and existing conversation
    renderCustomerAiChatHistory(customerSupportActiveTicket ? customerSupportActiveTicket.messages || [] : []);

    // Sync latest from server in background
    syncCustomerTicketFromServer();

    // Setup auto-refresh every 8s while open
    clearInterval(aiSupportPollTimer);
    aiSupportPollTimer = setInterval(() => {
        if (!modal.classList.contains('hidden') && modal.style.display !== 'none') {
            syncCustomerTicketFromServer(true);
        }
    }, 8000);

    setTimeout(() => {
        scrollAiChatToBottom();
        const input = document.getElementById('aiSupportTextInput');
        if (input && window.innerWidth > 640) input.focus();
    }, 150);
}
window.openCustomerAiSupportModal = openCustomerAiSupportModal;

function closeCustomerAiSupportModal() {
    const modal = document.getElementById('customerAiSupportModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    clearInterval(aiSupportPollTimer);
    stopAiVoiceRecognition();
}
window.closeCustomerAiSupportModal = closeCustomerAiSupportModal;

function startNewAiSupportTicket(showToast = true) {
    const randomCode = Math.floor(10000 + Math.random() * 90000);
    customerSupportActiveTicket = {
        ticket_number: `#BY-TKT-${randomCode}`,
        status: 'Open',
        messages: []
    };
    try {
        localStorage.setItem('busyatra_active_ticket', JSON.stringify(customerSupportActiveTicket));
    } catch (_) {}

    updateAiTicketHeaderBadge();
    const chatBox = document.getElementById('aiSupportChatMessages');
    if (chatBox) {
        chatBox.innerHTML = `
            <div class="flex items-start gap-2 max-w-[88%]">
                <img src="icons/ai-support-avatar.jpg" class="w-7 h-7 rounded-full object-cover shrink-0 border border-indigo-400 mt-1" alt="AI Assistant">
                <div class="bg-white text-gray-800 p-3 rounded-2xl rounded-tl-xs shadow-xs border border-gray-200 text-xs sm:text-sm leading-relaxed">
                    <p class="font-bold text-indigo-900 mb-1 flex items-center gap-1.5">
                        <span>🤖 Bus Yatra AI Assistant</span>
                        <span class="text-[10px] text-gray-400 font-normal">Active</span>
                    </p>
                    <p>নমস্কার! নতুন সহায়তা সেশন <b>${customerSupportActiveTicket.ticket_number}</b> শুরু হয়েছে। আপনার প্রশ্ন বা সমস্যা নিচে লিখুন অথবা মুখে বলুন!</p>
                </div>
            </div>
        `;
    }
    if (showToast && typeof showToastBanner === 'function') {
        showToastBanner('নতুন সাপোর্ট সেশন শুরু হয়েছে', '🎫 ' + customerSupportActiveTicket.ticket_number);
    }
}
window.startNewAiSupportTicket = startNewAiSupportTicket;

async function syncCustomerTicketFromServer(isSilent = false) {
    if (!customerSupportActiveTicket || !customerSupportActiveTicket.ticket_number) return;
    try {
        const customer = typeof getLoggedInCustomer === 'function' ? getLoggedInCustomer() : null;
        let url = `/api/support/tickets?ticketNumber=${encodeURIComponent(customerSupportActiveTicket.ticket_number)}`;
        if (customer && customer.phone) {
            url += `&phone=${encodeURIComponent(customer.phone)}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.ok) {
            if (data.ticket) {
                customerSupportActiveTicket = data.ticket;
                try {
                    localStorage.setItem('busyatra_active_ticket', JSON.stringify(customerSupportActiveTicket));
                } catch (_) {}
                updateAiTicketHeaderBadge();
                renderCustomerAiChatHistory(customerSupportActiveTicket.messages || []);
            } else if (customerSupportActiveTicket.id && !data.ticket) {
                // Ticket was deleted by admin from Cloudflare database, reset to a fresh session
                startNewAiSupportTicket(false);
            }
        }
    } catch (e) {
        if (!isSilent) console.warn('Ticket sync error:', e);
    }
}

// --- Voice & Speech Audio Playback for Customer & Admin ---
function speakAiText(text) {
    if (!('speechSynthesis' in window)) return;
    try {
        window.speechSynthesis.cancel();
        const cleanText = String(text || '').replace(/[*#_•]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!cleanText) return;
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = (currentLang === 'bn' || /[\u0980-\u09FF]/.test(text)) ? 'bn-IN' : 'en-IN';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn('Speech synthesis notice:', e);
    }
}
window.speakAiText = speakAiText;

function toggleCustomerAiModalLang() {
    currentLang = (currentLang === 'bn') ? 'en' : 'bn';
    if (typeof setPortalLanguage === 'function') setPortalLanguage(currentLang);
    const lbl = document.getElementById('lblAiModalLang');
    if (lbl) lbl.innerText = currentLang === 'bn' ? 'English' : 'বাংলা';
    updateAiTicketHeaderBadge();
    renderCustomerAiChatHistory(customerSupportActiveTicket?.messages || []);
}
window.toggleCustomerAiModalLang = toggleCustomerAiModalLang;

function renderCustomerAiChatHistory(messages) {
    const chatBox = document.getElementById('aiSupportChatMessages');
    if (!chatBox) return;

    const isBn = currentLang === 'bn';

    let html = `
        <div class="flex items-start gap-2 max-w-[88%]">
            <img src="assets/ai-agent-avatar.jpg" class="w-7 h-7 rounded-full object-cover object-top shrink-0 border border-red-400 mt-1 shadow-xs" alt="AI Assistant">
            <div class="bg-white text-gray-800 p-3 rounded-2xl rounded-tl-xs shadow-xs border border-gray-200 text-xs sm:text-sm leading-relaxed">
                <div class="flex items-center justify-between mb-1">
                    <p class="font-bold text-red-700 flex items-center gap-1.5 text-[11px]">
                        <span>🤖 Bus Yatra AI Agent</span>
                        <span class="text-[9px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-full font-bold">24x7 Active</span>
                    </p>
                    <button type="button" onclick="speakAiText('${isBn ? 'নমস্কার! আমি বাস যাত্রা ভার্চুয়াল এআই অ্যাসিস্ট্যান্ট। বাস বুকিং, সময়সূচী বা যেকোনো সমস্যায় আপনাকে সাহায্য করতে প্রস্তুত।' : 'Welcome to Bus Yatra AI Support. How can I help you today?'}')" class="text-xs text-gray-400 hover:text-red-600 cursor-pointer p-0.5" title="Listen / শুনুন">🔊</button>
                </div>
                <p>${isBn ? 'নমস্কার! 🙏 আমি বাস যাত্রা ভার্চুয়াল এআই অ্যাসিস্ট্যান্ট। বাস বুকিং, সময়সূচী, পেমেন্ট, রিফান্ড বা যেকোনো সমস্যায় আপনাকে সাহায্য করতে প্রস্তুত। লিখে জানান বা মাইক 🎙️ চেপে মুখে বলুন!' : 'Hello! 🙏 I am your Bus Yatra Virtual AI Agent. Ask any question about booking, schedules, payment, cancellation, or speak into the mic!'}</p>
            </div>
        </div>
    `;

    (messages || []).forEach(msg => {
        const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        if (msg.sender === 'customer') {
            html += `
                <div class="flex flex-col items-end my-2">
                    <div class="bg-gradient-to-r from-red-600 to-rose-600 text-white p-3 rounded-2xl rounded-tr-xs shadow-xs max-w-[85%] text-xs sm:text-sm leading-relaxed">
                        ${msg.attachmentUrl ? `<img src="${msg.attachmentUrl}" class="rounded-xl mb-2 max-h-48 w-auto object-cover border border-white/20 cursor-pointer shadow-sm" onclick="openPhotoViewerModal('${msg.attachmentUrl}')" title="Click to enlarge">` : ''}
                        <p class="whitespace-pre-line">${escapeHtml(msg.text || '')}</p>
                    </div>
                    <span class="text-[9px] text-gray-400 mt-1 mr-1 flex items-center gap-1">
                        ${msg.isVoice ? '<span class="text-red-500 font-bold">🎙️ Voice</span> • ' : ''}${timeStr}
                    </span>
                </div>
            `;
        } else if (msg.sender === 'admin') {
            html += `
                <div class="flex items-start gap-2 my-2 max-w-[88%]">
                    <div class="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-xs shrink-0 border border-white shadow-xs mt-1">
                        👨‍💼
                    </div>
                    <div>
                        <div class="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 text-gray-900 p-3 rounded-2xl rounded-tl-xs shadow-xs text-xs sm:text-sm leading-relaxed">
                            <p class="font-bold text-amber-900 mb-1 flex items-center justify-between text-[11px]">
                                <span class="flex items-center gap-1.5">
                                    <span>👨‍💼 Bus Yatra Support Team</span>
                                    <span class="bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded-full text-[9px] font-black">Admin Reply</span>
                                </span>
                                <button type="button" onclick="speakAiText(\`${escapeHtml(msg.text || '').replace(/"/g, '&quot;')}\`)" class="text-xs text-amber-700 hover:text-amber-900 cursor-pointer" title="Listen">🔊</button>
                            </p>
                            ${msg.attachmentUrl ? `<img src="${msg.attachmentUrl}" class="rounded-xl mb-2 max-h-48 w-auto object-cover border border-amber-200 cursor-pointer shadow-sm" onclick="openPhotoViewerModal('${msg.attachmentUrl}')" title="Click to view image">` : ''}
                            <p class="whitespace-pre-line">${escapeHtml(msg.text || '')}</p>
                        </div>
                        <span class="text-[9px] text-gray-400 mt-0.5 ml-1 inline-block">${timeStr}</span>
                    </div>
                </div>
            `;
        } else {
            // AI Assistant response
            const safeText = escapeHtml(msg.text || '');
            html += `
                <div class="flex items-start gap-2 my-2 max-w-[88%]">
                    <img src="assets/ai-agent-avatar.jpg" class="w-7 h-7 rounded-full object-cover object-top shrink-0 border border-red-400 mt-1 shadow-xs" alt="AI">
                    <div>
                        <div class="bg-white text-gray-800 p-3 rounded-2xl rounded-tl-xs shadow-xs border border-gray-200 text-xs sm:text-sm leading-relaxed">
                            <p class="font-bold text-red-700 mb-1 flex items-center justify-between text-[11px]">
                                <span class="flex items-center gap-1.5">
                                    <span>🤖 Bus Yatra AI Agent</span>
                                    <span class="text-[9px] text-gray-400 font-normal">Automated</span>
                                </span>
                                <button type="button" onclick="speakAiText(\`${safeText.replace(/"/g, '&quot;')}\`)" class="text-xs text-gray-400 hover:text-red-600 cursor-pointer p-0.5" title="Listen / শুনুন">🔊</button>
                            </p>
                            <p class="whitespace-pre-line">${safeText}</p>
                        </div>
                        <span class="text-[9px] text-gray-400 mt-0.5 ml-1 inline-block">${timeStr}</span>
                    </div>
                </div>
            `;
        }
    });

    // If ticket is resolved, show resolution notice
    if (customerSupportActiveTicket?.status === 'Resolved') {
        html += `
            <div class="p-3 my-2 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs flex items-center justify-between shadow-xs">
                <div class="flex items-center gap-2.5">
                    <span class="text-lg">✅</span>
                    <div>
                        <p class="font-bold">${isBn ? 'এই টিকেটটি সমাধান সম্পন্ন হয়েছে (Issue Resolved)' : 'This Ticket Has Been Resolved'}</p>
                        <p class="text-[10px] text-emerald-700">${isBn ? 'অ্যাডমিন সমস্যাটি সমাধান করেছেন। নতুন কোনো প্রশ্নের জন্য নতুন সেশন শুরু করুন।' : 'Our support team has marked this issue as resolved. You can start a new inquiry anytime.'}</p>
                    </div>
                </div>
                <button type="button" onclick="startNewAiSupportTicket()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-xl shadow-xs whitespace-nowrap cursor-pointer">
                    ${isBn ? '+ নতুন প্রশ্ন' : '+ New Ticket'}
                </button>
            </div>
        `;
    }

    chatBox.innerHTML = html;
    scrollAiChatToBottom();
}

function scrollAiChatToBottom() {
    const chatBox = document.getElementById('aiSupportChatMessages');
    if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

function handleAiFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
        alert(currentLang === 'bn' ? 'ফাইলের সাইজ ৮MB-এর কম হতে হবে।' : 'File size must be under 8MB.');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        aiSelectedAttachmentBase64 = e.target.result;
        const previewBar = document.getElementById('aiAttachmentPreviewBar');
        const previewImg = document.getElementById('aiAttachmentPreviewImg');
        const fileName = document.getElementById('aiAttachmentFileName');

        if (previewImg) previewImg.src = aiSelectedAttachmentBase64;
        if (fileName) fileName.innerText = file.name;
        if (previewBar) previewBar.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}
window.handleAiFileSelected = handleAiFileSelected;

function clearAiAttachment() {
    aiSelectedAttachmentBase64 = null;
    const previewBar = document.getElementById('aiAttachmentPreviewBar');
    const input = document.getElementById('aiSupportFileInput');
    if (previewBar) previewBar.classList.add('hidden');
    if (input) input.value = '';
}
window.clearAiAttachment = clearAiAttachment;

function toggleAiVoiceRecognition() {
    if (isAiVoiceListening) {
        stopAiVoiceRecognition();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert(currentLang === 'bn' ? 'আপনার ব্রাউজার ভয়েস রেকগনিশন সাপোর্ট করে না। অনুগ্রহ করে ক্রোম ব্রাউজার ব্যবহার করুন।' : 'Speech recognition is not supported in this browser. Please use Chrome.');
        return;
    }

    try {
        aiVoiceRecognition = new SpeechRecognition();
        aiVoiceRecognition.lang = currentLang === 'bn' ? 'bn-IN' : 'en-IN';
        aiVoiceRecognition.continuous = false;
        aiVoiceRecognition.interimResults = true;

        aiVoiceRecognition.onstart = () => {
            isAiVoiceListening = true;
            const banner = document.getElementById('aiVoiceActiveBanner');
            const btn = document.getElementById('btnAiVoiceInput');
            if (banner) banner.classList.remove('hidden');
            if (btn) btn.classList.add('text-red-600', 'bg-red-100', 'animate-pulse');
        };

        aiVoiceRecognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            const input = document.getElementById('aiSupportTextInput');
            if (input && transcript) {
                input.value = transcript;
            }
        };

        aiVoiceRecognition.onerror = (event) => {
            console.warn('AI voice error:', event.error);
            stopAiVoiceRecognition();
        };

        aiVoiceRecognition.onend = () => {
            stopAiVoiceRecognition();
            const input = document.getElementById('aiSupportTextInput');
            if (input && input.value.trim()) {
                submitCustomerAiMessage(null, true);
            }
        };

        aiVoiceRecognition.start();
    } catch (e) {
        console.error('Voice start error:', e);
        stopAiVoiceRecognition();
    }
}
window.toggleAiVoiceRecognition = toggleAiVoiceRecognition;

function stopAiVoiceRecognition() {
    isAiVoiceListening = false;
    if (aiVoiceRecognition) {
        try { aiVoiceRecognition.stop(); } catch (_) {}
        aiVoiceRecognition = null;
    }
    const banner = document.getElementById('aiVoiceActiveBanner');
    const btn = document.getElementById('btnAiVoiceInput');
    if (banner) banner.classList.add('hidden');
    if (btn) btn.classList.remove('text-red-600', 'bg-red-100', 'animate-pulse');
}
window.stopAiVoiceRecognition = stopAiVoiceRecognition;

function handleAiQuickQuery(topic) {
    const isBn = currentLang === 'bn';
    const queries = {
        timings: isBn ? 'বাসের সময়সূচী ও রুট কী কী আছে?' : 'What are the bus schedules and routes?',
        payment_issue: isBn ? 'আমার UPI পেমেন্ট কেটেছে কিন্তু টিকিট কনফার্ম হয়নি, এখন কী করব?' : 'Money was deducted from UPI but ticket is not confirmed, what to do?',
        cancellation: isBn ? 'বাসের টিকিট বাতিল ও রিফান্ডের নিয়ম কী?' : 'What is the ticket cancellation and refund policy?',
        tracking: isBn ? 'বাসের লাইভ লোকেশন ও ট্র্যাকিং কীভাবে দেখব?' : 'How can I view live GPS bus tracking?',
        seat_selection: isBn ? 'সিট পছন্দ করা বা পরিবর্তন করার নিয়ম কী?' : 'How to choose or change seats?',
        helpline: isBn ? 'কাস্টমার কেয়ার হেল্পলাইন ও অফিসিয়াল যোগাযোগ নম্বর দিন।' : 'Give me customer care helpline and contact numbers.',
        luggage: isBn ? 'বাসে লাগেজ বা মালামাল বহনের নিয়মাবলী কী?' : 'What is the luggage and baggage allowance policy?',
        offline_tickets: isBn ? 'ইন্টারনেট ছাড়া অফলাইন টিকিট কীভাবে দেখতে পাব?' : 'How can I view my booked ticket offline without internet?'
    };

    const text = queries[topic] || (isBn ? 'সহায়তা প্রয়োজন' : 'Need assistance');
    const input = document.getElementById('aiSupportTextInput');
    if (input) input.value = text;
    submitCustomerAiMessage();
}
window.handleAiQuickQuery = handleAiQuickQuery;

function generateBusYatraAiResponse(userText) {
    const raw = (userText || '').trim();
    const lower = raw.toLowerCase();
    const hasBnLetters = /[\u0980-\u09FF]/.test(raw);
    const isBanglish = /\b(ki|koto|kothay|kokhon|korbo|hobey|hobe|achen|kemon|parbo|dhonnobad|thik|bhalo|bhai|dada|jana|kichu|bolo)\b/i.test(lower);
    const isBn = currentLang === 'bn' || hasBnLetters || isBanglish;

    // 1. What is Bus Yatra? (বাস যাত্রা কি / Bus yatra ki / About Bus Yatra)
    if (lower.includes('bus yatra ki') || lower.includes('busyatra ki') || lower.includes('বাস যাত্রা কি') || lower.includes('বাসযাত্রা কি') || lower.includes('what is bus yatra') || lower.includes('about bus yatra') || lower.includes('বাস যাত্রা সম্বন্ধে')) {
        return isBn
            ? `🚌 **বাস যাত্রা (Bus Yatra) পরিচিতি ও সুবিধাসমূহ:**\nবাস যাত্রা হলো পশ্চিমবঙ্গের একটি আধুনিক স্মার্ট বাস সার্ভিস ও অনলাইন টিকিট বুকিং প্ল্যাটফর্ম।\n\n✨ **প্রধান সুবিধাসমূহ:**\n• **সহজ বুকিং:** ফোন বা কম্পিউটার থেকে পছন্দের পুশ-ব্যাক সিট বেছে নিয়ে ১-মিনিটে অনলাইন টিকিট কাটা যায়।\n• **লাইভ জিপিএস ট্র্যাকিং:** বাস এখন ঠিক কোথায় রয়েছে এবং কখন স্টপেজে পৌঁছাবে তা সরাসরি লাইভ ম্যাপে দেখা যায়।\n• **অফলাইন টিকিট:** ইন্টারনেট ছাড়াও ফোনে সংরক্ষিত টিকিট ও সিকিউর QR কোড সরাসরি দেখানো যায়।\n• **সার্বক্ষণিক সহায়তা:** ২৪x৭ স্মার্ট এআই এবং সরাসরি অ্যাডমিন হেল্পডেস্ক সর্বদা যাত্রীদের সেবায় নিয়োজিত!\n\nআপনার যাত্রার রুট বা টিকিটের বিষয়ে কী জানতে চান বলুন!`
            : `🚌 **About Bus Yatra:**\nBus Yatra is West Bengal's premier smart bus transport & digital ticketing platform.\n\n✨ **Key Highlights:**\n• **Instant Seat Booking:** Select push-back seats in under 60 seconds with instant UPI/Card payments.\n• **Live GPS Tracking:** Follow the bus on real-time map with live ETA and stoppage updates.\n• **Offline Tickets:** Access your booked tickets and QR code even without mobile internet.\n• **24x7 Customer Care:** Instant AI assistant & official support team.\n\nWhich route or service would you like to explore?`;
    }

    // 2. Greetings & Courtesy (Hello / Hi / Kemon achen / How are you / নমস্কার)
    if (/^(hi|hello|hey|নমস্কার|হ্যালো|helo|hiii|হায়|নমস্কার!)\b/i.test(lower) || lower.includes('কেমন আছেন') || lower.includes('kemon achen') || lower.includes('how are you')) {
        return isBn
            ? `নমস্কার! 🙏 বাস যাত্রা ভার্চুয়াল এআই সাপোর্টে স্বাগতম। আমি খুব ভালো আছি, ধন্যবাদ!\nবাসের সময়সূচী, টিকিট বুকিং, লাইভ ট্র্যাকিং বা পেমেন্ট সংক্রান্ত কোনো তথ্য জানতে চাইলে নিচে লিখুন অথবা মুখে বলুন!`
            : `Hello! 🙏 Welcome to Bus Yatra Virtual AI Support. How can I assist you with your bus journey, routes, bookings, or live tracking today?`;
    }

    // 3. Thanks & Gratitude (ধন্যবাদ / Thanks / Thank you)
    if (lower.includes('ধন্যবাদ') || lower.includes('thank') || lower.includes('thx') || lower.includes('dhonnobad')) {
        return isBn
            ? `আপনাকেও অনেক অনেক ধন্যবাদ! 😊 আপনার বাস যাত্রা নিরাপদ, আনন্দময় ও সুখকর হোক। আর কোনো সাহায্য লাগলে যে কোনো সময় জানান!`
            : `You are most welcome! 😊 Wishing you a safe, smooth, and pleasant journey with Bus Yatra. Feel free to ask anytime!`;
    }

    // 4. Ticket Fare / Price (ভাড়া কত / Price / Fare / koto taka)
    if (lower.includes('ভাড়া') || lower.includes('ভাড়া') || lower.includes('fare') || lower.includes('price') || lower.includes('cost') || lower.includes('টাকা কত') || lower.includes('koto taka') || lower.includes('rate')) {
        return isBn
            ? `💰 **বাসের ভাড়া সংক্রান্ত তথ্য:**\n• **পিংলা ➔ কলকাতা (ভায়া ডেবরা):** জনপ্রতি মাত্র ₹১৫০ থেকে শুরু।\n• অন্যান্য রুটের ভাড়া দূরত্ব এবং সিট টাইপ অনুযায়ী নির্ধারিত হয়।\nহোমপেজে আপনার গন্তব্য ও যাত্রার তারিখ বেছে নিয়ে **'Search Buses'** বাটনে ট্যাপ করলেই প্রতিটি বাসের সঠিক ভাড়া দেখতে পাবেন!`
            : `💰 **Fare & Ticket Rates:**\n• Pingla ➔ Kolkata (via Debra): Starts from ₹150 per seat.\n• Fares vary based on route distance and seat category.\nPlease search your origin and destination on the home screen to see real-time fares!`;
    }

    // 5. How to Book (বুকিং কিভাবে / How to book / booking kivabe)
    if (lower.includes('বুকিং কিভাবে') || lower.includes('how to book') || lower.includes('booking kivabe') || lower.includes('বুক করব') || lower.includes('টিকিট কিভাবে কাটব')) {
        return isBn
            ? `🎫 **সহজে টিকিট বুকিং করার নিয়ম:**\n১. হোমপেজে From (যাত্রার শুরু) এবং To (গন্তব্য) সিলেক্ট করুন।\n২. যাত্রার তারিখ বেছে নিয়ে 'Search Buses' চাপুন।\n৩. সিট লেআউট থেকে সবুজ রঙের পছন্দের সিট নির্বাচন করুন।\n৪. যাত্রীর নাম ও মোবাইল নম্বর দিয়ে UPI (GPay/PhonePe/Paytm) দিয়ে পেমেন্ট করলেই টিকিট কনফার্ম হয়ে যাবে!`
            : `🎫 **How to Book Your Bus Ticket:**\n1. Select your departure and arrival stations on the home screen.\n2. Choose journey date and tap 'Search Buses'.\n3. Tap any available green seat on the seat map.\n4. Enter passenger details and pay securely via UPI/Card to instantly receive your ticket!`;
    }

    // 6. Schedule, Timings, Route
    if (lower.includes('সময়') || lower.includes('সময়') || lower.includes('time') || lower.includes('schedule') || lower.includes('কখন') || lower.includes('route') || lower.includes('রুট') || lower.includes('kokhon')) {
        return isBn
            ? `🚌 **বাস যাত্রা সময়সূচী ও রুট তথ্য:**\n• **পিংলা ➔ কলকাতা (ভায়া ডেবরা):** প্রতিদিন সকাল ০৬:০০ AM এবং সকাল ০৭:০০ AM ছাড়ে।\n• **কলকাতা (এসপ্ল্যানেড) ➔ পিংলা:** প্রতিদিন দুপুর ০৪:০০ PM ছাড়ে।\n• **অন্যান্য রুট:** দীঘা, আসানসোল, শিলিগুড়ি ও মেদিনীপুর রুটের বাস পরিষেবা শীঘ্রই যুক্ত হচ্ছে।\n• **যাত্রার সময়:** প্রায় ৩ ঘণ্টা ৩০ মিনিট।\n• **ভাড়া:** জনপ্রতি মাত্র ₹১৫০ থেকে শুরু।\nআপনার পছন্দের রুট সিলেক্ট করে সার্চ বাটনে ট্যাপ করুন!`
            : `🚌 **Bus Yatra Schedule & Route Info:**\n• **Pingla to Kolkata (via Debra):** Departs daily at 06:00 AM & 07:00 AM.\n• **Kolkata (Esplanade) to Pingla:** Departs daily at 04:00 PM.\n• **Upcoming Routes:** Digha, Asansol, Siliguri, and Midnapore corridors.\n• **Journey Time:** Approx 3 hrs 30 mins.\n• **Fare:** Starts from ₹150 per seat.\nSearch your origin & destination on the home screen to book now!`;
    }

    // 7. Payment, Refund, Failed transaction
    if (lower.includes('টাকা') || lower.includes('payment') || lower.includes('refund') || lower.includes('কাট') || lower.includes('upi') || lower.includes('পেমেন্ট') || lower.includes('কনফার্ম') || lower.includes('failed') || lower.includes('রিফান্ড')) {
        return isBn
            ? `💳 **পেমেন্ট ও রিফান্ড সমাধান:**\nযদি ব্যাঙ্ক বা UPI (GPay/PhonePe/Paytm) থেকে টাকা কেটে যায় কিন্তু টিকিট না পান:\n১. সাধারণত ব্যাঙ্ক গেটওয়ে ট্রাফিকের কারণে ১০-১৫ মিনিটের মধ্যে টিকিট স্বয়ংক্রিয়ভাবে কনফার্ম হয়ে যায়।\n২. ব্যর্থ পেমেন্টের টাকা ২ থেকে ৪ ঘণ্টার মধ্যে আপনার মূল ব্যাংক একাউন্টে ফেরত আসে।\n৩. আপনার পেমেন্টের **UTR নম্বর বা স্ক্রিনশট 📎** এখানে আপলোড করুন। আমাদের অ্যাডমিন টিম দ্রুত যাচাই করে টিকিট ইস্যু বা রিফান্ড সম্পন্ন করবে!`
            : `💳 **Payment & Refund Assistance:**\nIf money was deducted from your account but ticket was not generated:\n1. Gateway traffic delays usually auto-confirm within 15 minutes.\n2. Any failed transaction is automatically refunded back to your bank within 2-4 hours.\n3. Please attach your **UTR Number or Screenshot 📎** here. Our official admin desk will verify and issue your ticket instantly!`;
    }

    // 8. Cancellation
    if (lower.includes('বাতিল') || lower.includes('cancel') || lower.includes('রদ') || lower.includes('বাতিলকরণ')) {
        return isBn
            ? `❌ **টিকিট বাতিল ও রিফান্ড পলিসি:**\n• বাস ছাড়ার ৪ ঘণ্টা বা তার আগে বাতিল করলে **৯০% রিফান্ড** পাওয়া যায়।\n• বাস ছাড়ার ২ থেকে ৪ ঘণ্টার মধ্যে বাতিল করলে **৫০% রিফান্ড** প্রযোজ্য।\n• বাস ছাড়ার ২ ঘণ্টার মধ্যে বা বাস ছেড়ে যাওয়ার পর টিকিট নন-রিফান্ডেবল।\nটিকিট বাতিল করতে 'My Bookings' অপশনে গিয়ে আপনার টিকিটের নিচে 'Cancel Booking' বোতাম চাপুন।`
            : `❌ **Cancellation & Refund Policy:**\n• Cancel >4 hours before departure: **90% refund**.\n• Cancel between 2 to 4 hours before departure: **50% refund**.\n• Within 2 hours of departure: Non-refundable.\nTo cancel, open 'My Bookings', select your ticket, and tap 'Cancel Booking'.`;
    }

    // 9. Luggage
    if (lower.includes('লাগেজ') || lower.includes('মাল') || lower.includes('luggage') || lower.includes('bag') || lower.includes('ব্যাগ') || lower.includes('মালামাল')) {
        return isBn
            ? `🧳 **লাগেজ ও মালামাল বহনের নিয়মাবলী:**\n• প্রত্যেক যাত্রী সর্বোচ্চ ১৫ কেজি পর্যন্ত ব্যক্তিগত লাগেজ বা ব্যাকপ্যাক বিনামূল্যে বহন করতে পারেন।\n• সিটের নিচে বা বাসের নির্ধারিত লাগেজ বক্সে ব্যাগ নিরাপদে রাখা যায়।\n• অতিরিক্ত ওজনের বা বাণিজ্যিক মালপত্রের ক্ষেত্রে নামমাত্র চার্জ প্রযোজ্য হতে পারে।\n• কোনো দাহ্য, বিষাক্ত বা নিষিদ্ধ বস্তু বাসে তোলা সম্পূর্ণ নিষেধ।`
            : `🧳 **Luggage & Baggage Allowance:**\n• Each passenger can carry up to 15 kg of personal luggage free of charge.\n• Standard bags can be placed in luggage boots or beneath seats.\n• Excess or commercial cargo may incur standard nominal charges.\n• Hazardous, flammable, or illegal items are strictly prohibited.`;
    }

    // 10. Offline tickets
    if (lower.includes('অফলাইন') || lower.includes('offline') || lower.includes('নেট ছাড়া') || lower.includes('ইন্টারনেট ছাড়া') || lower.includes('network')) {
        return isBn
            ? `📱 **অফলাইন সংরক্ষিত টিকিট সুবিধা:**\nইন্টারনেট বা নেটওয়ার্ক না থাকলেও পূর্বে বুক করা টিকিট ফোনে দেখানো যায়!\n১. মেনু (☰) অপশন থেকে **'Offline Saved Tickets'** চাপুন।\n২. সেখানে আপনার সংরক্ষিত টিকিট ও সিকিউর QR কোড সরাসরি খুলবে।\n৩. বাসের কন্ডাক্টর বা ক্যাপ্টেন সরাসরি QR কোড স্ক্যান করে ভেরিফাই করতে পারবেন!`
            : `📱 **Offline Saved Tickets:**\nEven without mobile internet or network coverage, you can access your tickets!\n1. Open Menu (☰) and click **'Offline Saved Tickets'**.\n2. View your ticket and digital QR code fully offline.\n3. The bus conductor can scan and verify it instantly!`;
    }

    // 11. Tracking / GPS
    if (lower.includes('ট্র্যাকিং') || lower.includes('track') || lower.includes('কোথায়') || lower.includes('কখন আসবে') || lower.includes('লাইভ') || lower.includes('live') || lower.includes('delay') || lower.includes('দেরি') || lower.includes('kothay')) {
        return isBn
            ? `📍 **লাইভ বাস ট্র্যাকিং ও লোকেশন:**\nবাস যাত্রার প্রতিটি বাসে রিয়েল-টাইম জিপিএস ট্র্যাকিং সুবিধা চালু রয়েছে। বাস ছাড়ার সময় থেকে ক্যাপ্টেন লোকেশন অন করলে হোমপেজে 'Live GPS Tracking' বাটনে চাপলেই বাসের গতি, দূরত্ব ও পরবর্তী স্টপেজ দেখতে পাবেন!`
            : `📍 **Live GPS Bus Tracking:**\nAll Bus Yatra coaches are equipped with live GPS tracking. Once the trip starts and the captain is online, click 'Live Tracking' in the top header to view real-time location and upcoming stoppages!`;
    }

    // 12. Seat
    if (lower.includes('সিট') || lower.includes('seat') || lower.includes('আসন') || lower.includes('পরিবর্তন')) {
        return isBn
            ? `💺 **আসন নির্বাচন ও পরিবর্তন:**\nআমাদের বাসে ৬৫টি আরামদায়ক পুশ-ব্যাক সিট রয়েছে।\n• সবুজ রঙের সিট: খালি রয়েছে (উপলব্ধ)।\n• লাল রঙের সিট: ইতিমধ্যে বুক হয়ে গেছে।\n• কমলা/হলুদ: অস্থায়ীভাবে লক করা।\nবুকিং করার সময় আপনার পছন্দমতো সিটে ট্যাপ করে সহজেই নির্বাচন করতে পারেন!`
            : `💺 **Seat Selection & Change:**\nOur coaches feature 65 comfortable push-back seats.\n• Green seats: Available to book.\n• Red seats: Already booked.\n• Yellow: Temporarily held.\nYou can tap any green seat on the seat layout screen to select your seat!`;
    }

    // 13. Contacts
    if (lower.includes('ফোন') || lower.includes('হেল্প') || lower.includes('contact') || lower.includes('number') || lower.includes('নম্বর') || lower.includes('helpline') || lower.includes('যোগাযোগ') || lower.includes('মালিক') || lower.includes('ক্যাপ্টেন')) {
        return isBn
            ? `📞 **বাস যাত্রা অফিসিয়াল হেল্পলাইন ও যোগাযোগ:**\n• **জরুরি কাস্টমার কেয়ার:** +91 7585979791 / +91 9123456789\n• **অফিসিয়াল ইমেইল:** support.busyatra@gmail.com\n• **ক্যাপ্টেনের নম্বর:** টিকিট বুকিং সম্পন্ন হওয়ার পর সরাসরি টিকিটের ওপর ক্যাপ্টেনের নাম ও মোবাইল নম্বর দেখতে পাবেন।\nআমাদের সাপোর্ট টিম সকাল ০৬:০০ টা থেকে রাত ১০:০০ টা পর্যন্ত সক্রিয় থাকে!`
            : `📞 **Bus Yatra Official Contacts & Helpline:**\n• **Customer Helpline:** +91 7585979791 / +91 9123456789\n• **Email Support:** support.busyatra@gmail.com\n• **Captain Contact:** After booking, the onboard captain's phone number is printed directly on your ticket.\nOur support team is available daily from 06:00 AM to 10:00 PM!`;
    }

    // 14. Intelligent fallback for other custom inquiries (without repeating token number on every message)
    const isFirstMsg = !customerSupportActiveTicket?.messages || customerSupportActiveTicket.messages.filter(m => m.sender === 'customer').length <= 1;

    if (isFirstMsg) {
        return isBn
            ? `আপনার বার্তাটি সফলভাবে গৃহীত হয়েছে। আমাদের অ্যাডমিন সাপোর্ট টিম দ্রুত আপনার সাথে যোগাযোগ করবে। আর কোনো তথ্য জানাতে চাইলে নিচে লিখতে পারেন বা 📎 ডকুমেন্ট পাঠাতে পারেন!`
            : `Your message has been received by our support desk. An executive is reviewing it and will respond shortly. You may type more details or attach a document 📎 anytime!`;
    }

    return isBn
        ? `আপনার অতিরিক্ত বার্তাটি যুক্ত করা হয়েছে। আমাদের টিম খুব দ্রুত উত্তর প্রদান করবে। প্রয়োজনে ওপরের যেকোনো কুইক অপশন ব্যবহার করতে পারেন!`
        : `Your follow-up note has been added. Our support team is attending to it. You can also explore the quick topics above!`;
}

async function submitCustomerAiMessage(event, isVoice = false) {
    if (event) event.preventDefault();

    const input = document.getElementById('aiSupportTextInput');
    const userText = input ? input.value.trim() : '';
    const attachmentUrl = aiSelectedAttachmentBase64;

    if (!userText && !attachmentUrl) return;

    // Rule: If previous ticket is already Resolved by admin, start a fresh new ticket token for this new inquiry!
    if (customerSupportActiveTicket && customerSupportActiveTicket.status === 'Resolved') {
        startNewAiSupportTicket(false);
    } else if (!customerSupportActiveTicket) {
        initCustomerAiSupportTicket();
    }

    const customer = typeof getLoggedInCustomer === 'function' ? getLoggedInCustomer() : null;
    const customerPhone = customer?.phone || '';
    const customerName = customer?.name || 'Passenger';

    // Clear UI inputs
    if (input) input.value = '';
    clearAiAttachment();

    // Append Customer message to local UI
    const now = new Date().toISOString();
    const customerMsg = {
        id: 'msg_' + Date.now(),
        sender: 'customer',
        text: userText,
        isVoice: Boolean(isVoice),
        attachmentUrl: attachmentUrl || null,
        timestamp: now
    };

    if (!customerSupportActiveTicket.messages) customerSupportActiveTicket.messages = [];
    customerSupportActiveTicket.messages.push(customerMsg);
    renderCustomerAiChatHistory(customerSupportActiveTicket.messages);

    // AI automated answer
    const aiAnswerText = generateBusYatraAiResponse(userText);
    const aiMsg = {
        id: 'msg_ai_' + Date.now(),
        sender: 'ai',
        text: aiAnswerText,
        timestamp: new Date().toISOString()
    };

    setTimeout(() => {
        customerSupportActiveTicket.messages.push(aiMsg);
        renderCustomerAiChatHistory(customerSupportActiveTicket.messages);
        try {
            localStorage.setItem('busyatra_active_ticket', JSON.stringify(customerSupportActiveTicket));
        } catch (_) {}

        // If user submitted via voice, automatically speak the AI answer back!
        if (isVoice) {
            speakAiText(aiAnswerText);
        }
    }, 350);

    // Send customer message AND AI response to backend
    try {
        const res = await fetch('/api/support/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticketNumber: customerSupportActiveTicket.ticket_number,
                customerPhone,
                customerName,
                subject: userText.slice(0, 50) || 'Attachment Upload',
                message: userText,
                isVoice: Boolean(isVoice),
                attachmentUrl,
                category: 'general',
                aiResponse: aiAnswerText
            })
        });
        const data = await res.json();
        if (data && data.ok && data.ticket) {
            customerSupportActiveTicket = {
                ...customerSupportActiveTicket,
                ...data.ticket
            };
            try {
                localStorage.setItem('busyatra_active_ticket', JSON.stringify(customerSupportActiveTicket));
            } catch (_) {}
            updateAiTicketHeaderBadge();
        }
    } catch (e) {
        console.warn('Ticket send error:', e);
    }
}
window.submitCustomerAiMessage = submitCustomerAiMessage;

// ==========================================
// PASSENGER EMERGENCY SOS SAFETY FEATURE
// ==========================================
let customerSosSelectedType = '🚑 চিকিৎসা জরুরি (Medical)';
let customerSosCoords = null; // { latitude, longitude, accuracy }

function openCustomerSosModal() {
    const modal = document.getElementById('customerSosModal');
    if (!modal) return;
    
    // Auto-fill customer profile details if available
    try {
        const session = JSON.parse(localStorage.getItem('customer_session') || sessionStorage.getItem('customer_session') || 'null');
        const rawCust = JSON.parse(localStorage.getItem('busyatra_customer') || sessionStorage.getItem('busyatra_customer') || 'null');
        const phone = session?.phone || rawCust?.phone || localStorage.getItem('last_customer_phone') || '';
        const name = session?.name || rawCust?.name || '';
        
        const nameInput = document.getElementById('sosCustomerNameInput');
        const phoneInput = document.getElementById('sosCustomerPhoneInput');
        if (nameInput && name && !nameInput.value) nameInput.value = name;
        if (phoneInput && phone && !phoneInput.value) phoneInput.value = phone;
    } catch (_) {}

    // Show modal
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // Start auto GPS detection
    detectCustomerSosLocation(false);
}
window.openCustomerSosModal = openCustomerSosModal;

function closeCustomerSosModal() {
    const modal = document.getElementById('customerSosModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.style.display = 'none';
}
window.closeCustomerSosModal = closeCustomerSosModal;

function selectSosEmergencyType(type, btnEl) {
    customerSosSelectedType = type;
    const container = document.getElementById('sosTypeOptions');
    if (container) {
        const buttons = container.querySelectorAll('.sos-type-btn');
        buttons.forEach(b => {
            b.className = 'sos-type-btn p-2.5 rounded-xl border border-gray-200 hover:border-red-300 bg-white text-gray-700 font-bold text-xs text-left flex items-center gap-2 transition active:scale-95';
        });
    }
    if (btnEl) {
        btnEl.className = 'sos-type-btn p-2.5 rounded-xl border-2 border-red-600 bg-red-50 text-red-700 font-bold text-xs text-left flex items-center gap-2 transition active:scale-95 shadow-2xs';
    }
}
window.selectSosEmergencyType = selectSosEmergencyType;

function detectCustomerSosLocation(isManual = false) {
    const titleEl = document.getElementById('sosGpsTitle');
    const badgeEl = document.getElementById('sosGpsBadge');
    const coordsEl = document.getElementById('sosGpsCoords');

    if (!navigator.geolocation) {
        if (titleEl) titleEl.innerText = '⚠️ জিপিএস সমর্থিত নয় (GPS Not Supported)';
        if (badgeEl) {
            badgeEl.innerText = 'অসমর্থিত';
            badgeEl.className = 'text-[9px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full';
        }
        if (coordsEl) coordsEl.innerText = 'অনুগ্রহ করে নিচের ঘরে আপনার বর্তমান জায়গা বা ল্যান্ডমার্ক লিখে দিন';
        return;
    }

    if (titleEl) titleEl.innerText = isManual ? 'পুনরায় জিপিএস লোকেশন রিফ্রেশ করা হচ্ছে...' : 'লাইভ জিপিএস লোকেশন নেওয়া হচ্ছে...';
    if (badgeEl) {
        badgeEl.innerText = 'সন্ধান চলছে';
        badgeEl.className = 'text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full animate-pulse';
    }
    if (coordsEl) coordsEl.innerText = 'স্যাটেলাইট জিপিএস সিগন্যাল যাচাই করা হচ্ছে...';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy || 10;
            customerSosCoords = { latitude: lat, longitude: lng, accuracy };

            if (titleEl) titleEl.innerText = '🟢 লাইভ জিপিএস লোকেশন সফলভাবে প্রস্তুত';
            if (badgeEl) {
                badgeEl.innerText = 'সঠিক লোকেশন প্রস্তুত';
                badgeEl.className = 'text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full';
            }
            if (coordsEl) {
                coordsEl.innerText = `জিপিএস কোঅর্ডিনেট: ${lat.toFixed(5)}, ${lng.toFixed(5)} (নির্ভুলতা: ±${Math.round(accuracy)}m)`;
            }

            // Fill landmark hint if empty
            const locationInput = document.getElementById('sosLocationTextInput');
            if (locationInput && !locationInput.value.trim()) {
                locationInput.placeholder = `জিপিএস সনাক্ত হয়েছে (${lat.toFixed(4)}, ${lng.toFixed(4)}) - বাসের নাম বা ল্যান্ডমার্ক লিখুন`;
            }
        },
        (error) => {
            console.warn('GPS location detection failed:', error);
            if (titleEl) titleEl.innerText = '⚠️ জিপিএস সিগন্যাল পাওয়া যায়নি (GPS Disabled)';
            if (badgeEl) {
                badgeEl.innerText = 'ম্যানুয়াল ইনপুট দিন';
                badgeEl.className = 'text-[9px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full';
            }
            if (coordsEl) coordsEl.innerText = 'ফোনের Location অন করুন অথবা নিচের ঘরে আপনার অবস্থান লিখুন';
            if (isManual && typeof showDropDownToast === 'function') {
                showDropDownToast('জিপিএস লোকেশন পাওয়া যায়নি। ফোনের Location/GPS চালু করে আবার চেষ্টা করুন।', 'warning');
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 15000
        }
    );
}
window.detectCustomerSosLocation = detectCustomerSosLocation;

async function submitCustomerSosAlert() {
    const btn = document.getElementById('btnSubmitSosAlert');
    const nameInput = document.getElementById('sosCustomerNameInput');
    const phoneInput = document.getElementById('sosCustomerPhoneInput');
    const locationInput = document.getElementById('sosLocationTextInput');
    const descInput = document.getElementById('sosDescriptionInput');

    const name = (nameInput ? nameInput.value : '').trim();
    const phone = (phoneInput ? phoneInput.value : '').trim();
    const locationText = (locationInput ? locationInput.value : '').trim();
    const desc = (descInput ? descInput.value : '').trim();

    if (!phone || phone.length < 10) {
        if (typeof showDropDownToast === 'function') {
            showDropDownToast('অনুগ্রহ করে আপনার সঠিক ১০ ডিজিট মোবাইল নম্বর দিন।', 'error', 'মোবাইল নম্বর আবশ্যক');
        } else {
            alert('অনুগ্রহ করে আপনার সঠিক ১০ ডিজিট মোবাইল নম্বর দিন।');
        }
        if (phoneInput) phoneInput.focus();
        return;
    }

    if (!customerSosCoords && !locationText) {
        if (typeof showDropDownToast === 'function') {
            showDropDownToast('আপনার বর্তমান জায়গা বা বাসটির নাম লিখুন যাতে দল পৌঁছাতে পারে।', 'warning', 'লোকেশন তথ্য দিন');
        } else {
            alert('আপনার বর্তমান জায়গা বা বাসটির নাম লিখুন যাতে সাহায্য পৌঁছাতে পারে।');
        }
        if (locationInput) locationInput.focus();
        return;
    }

    const originalBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="animate-spin text-lg">⏳</span> <span>কন্ট্রোল রুমে পাঠানো হচ্ছে...</span>`;
    }

    try {
        const payload = {
            customer_name: name || 'Passenger',
            customer_phone: phone,
            emergency_type: customerSosSelectedType || '🚑 চিকিৎসা জরুরি (Medical)',
            description: desc,
            latitude: customerSosCoords ? customerSosCoords.latitude : null,
            longitude: customerSosCoords ? customerSosCoords.longitude : null,
            current_location_text: locationText || (customerSosCoords ? `GPS (${customerSosCoords.latitude.toFixed(5)}, ${customerSosCoords.longitude.toFixed(5)})` : '')
        };

        const res = await fetch('/api/emergency/sos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data && data.ok) {
            const alertNum = data.alert?.alert_number || 'SOS Alert';
            closeCustomerSosModal();

            if (typeof showDropDownToast === 'function') {
                showDropDownToast(`🚨 আপনার জরুরি SOS অ্যালার্ট (${alertNum}) বাস কন্ট্রোল রুমে পৌঁছে গেছে! টিম যোগাযোগ করছে।`, 'success', 'SOS অ্যালার্ট পাঠানো হয়েছে');
            }

            // High-visibility confirmation prompt
            setTimeout(async () => {
                const callPrompt = await showBusYatraConfirm({
                    title: 'জরুরি হেল্পলাইন কল',
                    subtitle: `🚨 আপনার জরুরি SOS সংকেত (${alertNum}) অ্যাডমিন ও কন্ট্রোল রুমে সরাসরি পৌঁছে গেছে!\n\nআমাদের কন্ট্রোল টিম অবিলম্বে আপনার সাথে যোগাযোগ করছে।\n\nআপনি কি এখনই সরাসরি বাস যাত্রা হেল্পলাইনে (8768447312) কল করতে চান?`,
                    icon: '🚨',
                    confirmText: '📞 হ্যাঁ, কল করুন',
                    cancelText: 'না, পরে',
                    danger: false,
                    badge: 'Emergency SOS'
                });
                if (callPrompt) {
                    window.location.href = 'tel:8768447312';
                }
            }, 300);

            // Clean form inputs
            if (locationInput) locationInput.value = '';
            if (descInput) descInput.value = '';
        } else {
            throw new Error(data.error || 'Failed to submit SOS alert');
        }
    } catch (err) {
        console.error('Error submitting SOS alert:', err);
        if (typeof showDropDownToast === 'function') {
            showDropDownToast('সার্ভারে সমস্যা হচ্ছে, অনুগ্রহ করে হেল্পলাইনে সরাসরি কল করুন (112 অথবা কন্ট্রোল রুম)।', 'error', 'ব্যর্থ হয়েছে');
        } else {
            alert('জরুরি অ্যালার্ট পাঠাতে সমস্যা হয়েছে। অনুগ্রহ করে সরাসরি 112 অথবা কন্ট্রোল রুমে কল করুন।');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
        }
    }
}
window.submitCustomerSosAlert = submitCustomerSosAlert;



