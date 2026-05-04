/**
 * ZB Suites Baguio — single-file app logic (plain JavaScript, no React/Vue/build tools).
 *
 * What this file does (high level):
 *  - Reads/writes guest and room data in the browser via localStorage (survives refresh; not shared between devices).
 *  - Powers section navigation, check-in → payment → QR, services, gallery, check-out, and the admin demo dashboard.
 *  - Shows QR codes on a canvas using qr-creator.min.js (loaded from index.html before this file).
 *
 * For clients: change prices, room list, or demo admin password by searching this file and photos.js only.
 */
(function() {
        // ----- Data store: all demo database rows live in localStorage under this key -----
        const STORAGE_KEY = 'zb_suites_data';

        function getDefaultData() {
            return {
                rooms: [
                    { number: '401B', type: 'Deluxe', pricePerNight: 2500, occupied: false, guestId: null },
                    { number: '603', type: 'Standard', pricePerNight: 1500, occupied: false, guestId: null },
                    { number: '702', type: 'Suite', pricePerNight: 4000, occupied: false, guestId: null },
                    { number: '706', type: 'Suite', pricePerNight: 4000, occupied: false, guestId: null }
                ],
                guests: [],
                nextGuestId: 1,
                activityLog: [],
                parkingFeePerNight: 200,
                foodMenu: [
                    { id: 'f1', name: '🍳 Silog Breakfast', price: 180, category: 'Breakfast' },
                    { id: 'f2', name: '🥞 Pancakes & Coffee', price: 150, category: 'Breakfast' },
                    { id: 'f3', name: '🍗 Chicken Adobo Rice', price: 220, category: 'Lunch/Dinner' },
                    { id: 'f4', name: '🍝 Spaghetti Bolognese', price: 200, category: 'Lunch/Dinner' },
                    { id: 'f5', name: '🥤 Fresh Buko Juice', price: 80, category: 'Beverages' },
                    { id: 'f6', name: '☕ Hot Chocolate', price: 90, category: 'Beverages' },
                    { id: 'f7', name: '🍪 Cookies (3 pcs)', price: 60, category: 'Snacks' },
                    { id: 'f8', name: '🍌 Banana Chips', price: 50, category: 'Snacks' },
                ],
            };
        }

        function loadData() {
            let raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                try { 
                    const data = JSON.parse(raw);
                    // Force overwrite rooms to only the 4 rooms
                    data.rooms = [
                        { number: '401B', type: 'Deluxe', pricePerNight: 2500, occupied: data.rooms.find(r => r.number === '401B')?.occupied || false, guestId: data.rooms.find(r => r.number === '401B')?.guestId || null },
                        { number: '603', type: 'Standard', pricePerNight: 1500, occupied: data.rooms.find(r => r.number === '603')?.occupied || false, guestId: data.rooms.find(r => r.number === '603')?.guestId || null },
                        { number: '702', type: 'Suite', pricePerNight: 4000, occupied: data.rooms.find(r => r.number === '702')?.occupied || false, guestId: data.rooms.find(r => r.number === '702')?.guestId || null },
                        { number: '706', type: 'Suite', pricePerNight: 4000, occupied: data.rooms.find(r => r.number === '706')?.occupied || false, guestId: data.rooms.find(r => r.number === '706')?.guestId || null }
                    ];
                    return data;
                } catch (e) {}
            }
            return getDefaultData();
        }

        function saveData(data) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }

        /** If a gallery image path is wrong or missing, show a simple local SVG instead of loading an external placeholder site. */
        function getPlaceholderDataUrl(caption, width, height) {
            var w = width || 400;
            var h = height || 300;
            var safe = String(caption || 'Image')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><rect fill="#f0ebe3" width="100%" height="100%"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#5c3d2e" font-family="system-ui,sans-serif" font-size="14">' + safe + '</text></svg>';
            return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        }

        let appData = loadData();
        if (!appData.foodMenu) appData = getDefaultData();
        
        // Force ensure only the 4 rooms exist
        const requiredRooms = [
            { number: '401B', type: 'Deluxe', pricePerNight: 2500 },
            { number: '603', type: 'Standard', pricePerNight: 1500 },
            { number: '702', type: 'Suite', pricePerNight: 4000 },
            { number: '706', type: 'Suite', pricePerNight: 4000 },
        ];
        
        appData.rooms = requiredRooms.map(room => {
            const existing = appData.rooms.find(r => r.number === room.number);
            return {
                number: room.number,
                type: room.type,
                pricePerNight: room.pricePerNight,
                occupied: existing ? existing.occupied : false,
                guestId: existing ? existing.guestId : null,
            };
        });
        
        saveData(appData);

        // ----- Admin demo: password is hard-coded for prototypes only; replace before production -----
        const ADMIN_AUTH_KEY = 'zb_admin_auth';
        const ADMIN_PASSWORD = 'admin123';
        const AUTH_EXPIRY = 60 * 60 * 1000; // session length in ms (1 hour)

function isAdminAuthenticated() {
    const authData = localStorage.getItem(ADMIN_AUTH_KEY);
    if (!authData) return false;
    try {
        const { timestamp } = JSON.parse(authData);
        return Date.now() - timestamp < AUTH_EXPIRY;
    } catch {
        return false;
    }
}

function setAdminAuth() {
    localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify({ timestamp: Date.now() }));
    updateAdminUI();
    showAdminStatusMessage();
    showToast(' Admin authenticated successfully', 'success');
}

function clearAdminAuth() {
    localStorage.removeItem(ADMIN_AUTH_KEY);
    updateAdminUI();
    hideAdminSection();
    showToast(' Admin logged out successfully', 'info');
    showSection('home');
}

function updateAdminUI() {
    const adminBtn = document.getElementById('adminNavBtn');
    const logoutBtn = document.getElementById('adminLogoutBtn');
    const adminSection = document.getElementById('section-admin');
    
    if (isAdminAuthenticated()) {
        if (adminBtn) {
            adminBtn.textContent = ' Admin Mode';
            adminBtn.classList.add('admin-active');
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'inline-flex';
        }
        if (adminSection) {
            adminSection.style.display = 'block';
        }
        document.body.classList.add('admin-authenticated');
    } else {
        if (adminBtn) {
            adminBtn.textContent = 'Admin Login';
            adminBtn.classList.remove('admin-active');
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'none';
        }
        if (adminSection) {
            adminSection.style.display = 'none';
        }
        document.body.classList.remove('admin-authenticated');
    }
}

function showAdminStatusMessage() {
    const statusDiv = document.getElementById('adminStatusMessage');
    if (statusDiv) {
        statusDiv.innerHTML = '<span class="badge badge-success"> Admin Mode Active</span>';
        setTimeout(() => {
            if (statusDiv) statusDiv.innerHTML = '';
        }, 3000);
    }
}

function hideAdminSection() {
    const adminSection = document.getElementById('section-admin');
    if (adminSection) {
        adminSection.style.display = 'none';
    }
}

window.showAdminLogin = function() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminLoginError').style.display = 'none';
    }
};

window.closeAdminLogin = function(event) {
    const modal = document.getElementById('adminLoginModal');
    if (!modal) return;
    if (!event || event.target === modal || event.target === document.querySelector('.modal-close')) {
        modal.style.display = 'none';
    }
};

window.handleAdminLogin = function(event) {
    event.preventDefault();
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('adminLoginError');
    
    if (password === ADMIN_PASSWORD) {
        setAdminAuth();
        document.getElementById('adminLoginModal').style.display = 'none';
        showSection('admin');
        refreshAllDynamicContent();
    } else {
        errorDiv.style.display = 'block';
        errorDiv.textContent = ' Invalid password. Please try again.';
        document.getElementById('adminPassword').focus();
        showToast(' Invalid admin password', 'error');
    }
};

window.logoutAdmin = function() {
    showLogoutConfirmation();
};

function showLogoutConfirmation() {
    // Create modal overlay if not exists
    let confirmModal = document.getElementById('logoutConfirmModal');
    if (!confirmModal) {
        confirmModal = document.createElement('div');
        confirmModal.id = 'logoutConfirmModal';
        confirmModal.className = 'modal-overlay';
        confirmModal.style.display = 'none';
        confirmModal.innerHTML = `
            <div class="modal logout-confirm-modal" onclick="event.stopPropagation()">
                <div style="text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 16px;"></div>
                    <h3 style="color: var(--primary); margin-bottom: 12px;">Confirm Logout</h3>
                    <p style="color: var(--text-light); margin-bottom: 24px;">
                        Are you sure you want to logout from<br><strong>Admin Mode</strong>?
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button class="btn btn-danger" id="confirmLogoutBtn">
                             Yes, Logout
                        </button>
                        <button class="btn btn-outline" id="cancelLogoutBtn">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(confirmModal);
        
        // Add event listeners
        document.getElementById('confirmLogoutBtn').addEventListener('click', function() {
            document.getElementById('logoutConfirmModal').style.display = 'none';
            clearAdminAuth();
            showToast(' You have been logged out of Admin Mode', 'info');
        });
        
        document.getElementById('cancelLogoutBtn').addEventListener('click', function() {
            document.getElementById('logoutConfirmModal').style.display = 'none';
            showToast('Logout cancelled', 'info');
        });
        
        // Close when clicking outside
        confirmModal.addEventListener('click', function(e) {
            if (e.target === confirmModal) {
                confirmModal.style.display = 'none';
            }
        });
    }
    
    confirmModal.style.display = 'flex';
}

        window.appData = appData;
        window.saveAppData = function() { saveData(appData); };
        window.addLog = function(guestName, roomNumber, action, details) {
            appData.activityLog.unshift({
                time: new Date().toLocaleString(),
                guestName,
                roomNumber,
                action,
                details
            });
            if (appData.activityLog.length > 100) appData.activityLog.length = 100;
            saveData(appData);
        };

        // ==================== TOAST ====================
        function showToast(msg, type = 'info') {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = msg;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 3200);
        }
        window.showToast = showToast;

        // ==================== NAVIGATION ====================
        window.toggleNav = function() {
            const hamburger = document.getElementById('hamburgerBtn');
            const navMenu = document.querySelector('.nav-menu');
            const hamburgerIcon = hamburger.querySelectorAll('span');
            
            if (hamburger && navMenu) {
                const isOpen = navMenu.classList.toggle('open');
                hamburger.setAttribute('aria-expanded', isOpen);
                hamburger.classList.toggle('open');
                
                // Animate hamburger lines
                hamburgerIcon.forEach((span, index) => {
                    span.style.transform = isOpen 
                        ? `rotate(${index * 90 - 45}deg) translate(${index === 1 ? '6px' : '0'}, ${index === 1 ? '6px' : '0'})` 
                        : 'none';
                });
            }
        };

        function showSection(name) {
            if (name === 'admin' && !isAdminAuthenticated()) {
                showAdminLogin();
                return;
            }
            
            // Close mobile menu when navigating
            const hamburger = document.getElementById('hamburgerBtn');
            const navMenu = document.querySelector('.nav-menu');
            if (hamburger && navMenu && navMenu.classList.contains('open')) {
                toggleNav();
            }
            
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            const section = document.getElementById('section-' + name);
            if (section) section.classList.add('active');
            document.querySelectorAll('#mainNav button').forEach(b => b.classList.remove('active'));
            const navBtn = document.querySelector(`#mainNav button[data-section="${name}"]`);
            if (navBtn) navBtn.classList.add('active');
            refreshAllDynamicContent();
            setHeroPhoto();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        window.showSection = showSection;

        // Close nav on overlay/escape (will be enhanced with CSS)
        document.addEventListener('DOMContentLoaded', function() {
            document.addEventListener('click', function(e) {
                const hamburger = document.getElementById('hamburgerBtn');
                const navMenu = document.querySelector('.nav-menu');
                if (navMenu && navMenu.classList.contains('open') && 
                    !navMenu.contains(e.target) && e.target !== hamburger) {
                    toggleNav();
                }
            });
        });

        // ==================== REFRESH HELPERS ====================
        function refreshAllDynamicContent() {
            renderPhotoGallery();
            renderRoomTypesGrid();
            renderAdminRoomGrid();
            renderAdminStats();
            renderAdminLog();
            renderAdminPayments();
            populateGuestSelects();
            renderFoodMenu();
            updateAccessInfo();
            updateCheckoutInfo();
            updateServiceRoom();
            updateRoomTypeOptions();
        }

        function getAvailableRoomsByType(type) {
            return appData.rooms.filter(r => r.type === type && !r.occupied);
        }

        function getRoomPhotoGroups() {
            const groups = {
                '706': [],
                '702': [],
                '603': [],
                '401B': [],
            };
            if (typeof PHOTO_PATHS !== 'undefined') {
                PHOTO_PATHS.forEach(path => {
                    const normalized = normalizePhotoPath(path);
                    const lower = normalized.toLowerCase();
                    if (!lower.includes('/raw/')) return;
                    if (lower.includes('/raw/x-room 706/')) {
                        groups['706'].push(normalized);
                    } else if (lower.includes('/raw/x-room 702/')) {
                        groups['702'].push(normalized);
                    } else if (lower.includes('/raw/x-room 603/')) {
                        groups['603'].push(normalized);
                    } else if (lower.includes('/raw/x-room 401b/')) {
                        groups['401B'].push(normalized);
                    }
                });
            }
            return groups;
        }

        function renderRoomTypesGrid() {
            const container = document.getElementById('roomTypesContainer');
            if (!container) return;

            const roomPhotoGroups = getRoomPhotoGroups();
            const typeLabels = {
                'Standard': 'Standard Room',
                'Deluxe': 'Deluxe Room', 
                'Suite': 'Suite Room'
            };
            
            // Group rooms by type
            const standardRooms = appData.rooms.filter(r => r.type === 'Standard');
            const deluxeRooms = appData.rooms.filter(r => r.type === 'Deluxe');
            const suiteRooms = appData.rooms.filter(r => r.type === 'Suite');
            
            const roomGroups = [
                { type: 'Standard', rooms: standardRooms, price: 1500 },
                { type: 'Deluxe', rooms: deluxeRooms, price: 2500 },
                { type: 'Suite', rooms: suiteRooms, price: 4000 }
            ];

            container.innerHTML = roomGroups.map(group => {
                const rooms = group.rooms;
                const total = rooms.length;
                const availableCount = rooms.filter(r => !r.occupied).length;
                const price = group.price;

                const roomButtons = rooms.map(r => {
                    const cls = r.occupied ? 'occupied' : 'available';
                    const label = r.occupied ? `🔴 ${r.number}` : `🟢 ${r.number}`;
                    return `
                        <button
                            class="room-box room-box-clickable ${cls}"
                            type="button"
                            title="${r.type} - ${r.occupied ? 'Occupied' : 'Available'}"
                            onclick="openRoomPhotoModal('${r.number}')"
                        >
                            ${label}
                        </button>
                    `;
                }).join('');

                const expandIcon = `<span class="expand-icon">➕</span>`;

                return `
                    <div class="room-type-group" data-type="${group.type}">
                        <button class="room-type-header room-box-clickable" onclick="toggleRoomTypeExpansion('${group.type}')" type="button">
                            <strong>${typeLabels[group.type]}</strong> (${availableCount}/${total}) — ₱${price.toLocaleString()}/night ${expandIcon}
                        </button>
                        <div class="room-list">
                            <div class="room-grid">${roomButtons}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        window.toggleRoomTypeExpansion = function(type) {
            const group = document.querySelector(`.room-type-group[data-type="${type}"]`);
            if (group) {
                group.classList.toggle('expanded');
                const expandIcon = group.querySelector('.expand-icon');
                if (expandIcon) {
                    expandIcon.textContent = group.classList.contains('expanded') ? '✖' : '➕';
                }
            }
        };

        function renderAdminRoomGrid() {
            const grid = document.getElementById('adminRoomGrid');
            if (!grid) return;
            grid.innerHTML = appData.rooms.map(r => {
                const cls = r.occupied ? 'occupied' : 'available';
                const guestInfo = r.occupied && r.guestId ?
                    appData.guests.find(g => g.id === r.guestId) : null;
                const label = r.occupied ? `🔴 ${r.number}` : `🟢 ${r.number}`;
                const detail = guestInfo ? `<br><small>${guestInfo.name}</small>` :
                    `<br><small>${r.type}</small>`;
                return `<div class="room-box ${cls}" title="${r.type}">${label}${detail}</div>`;
            }).join('');
        }

        function renderAdminStats() {
            const container = document.getElementById('adminStats');
            if (!container) return;
            const totalRooms = appData.rooms.length;
            const occupied = appData.rooms.filter(r => r.occupied).length;
            const available = totalRooms - occupied;
            const totalGuests = appData.guests.filter(g => g.status === 'checked-in').length;
            const totalRevenue = appData.guests
                .filter(g => g.paymentStatus === 'paid')
                .reduce((sum, g) => sum + (g.totalPaid || 0), 0);
            container.innerHTML = `
            <div class="stat-card"><div class="stat-value">${available}</div><div class="stat-label">Available Rooms</div></div>
            <div class="stat-card"><div class="stat-value">${occupied}</div><div class="stat-label">Occupied</div></div>
            <div class="stat-card"><div class="stat-value">${totalGuests}</div><div class="stat-label">Active Guests</div></div>
            <div class="stat-card"><div class="stat-value">₱${totalRevenue.toLocaleString()}</div><div class="stat-label">Total Revenue</div></div>
          `;
        }

        function renderAdminLog() {
            const tbody = document.getElementById('adminLogBody');
            if (!tbody) return;
            tbody.innerHTML = appData.activityLog.slice(0, 30).map(log => `
            <tr>
              <td>${log.time}</td>
              <td>${log.guestName || '-'}</td>
              <td>${log.roomNumber || '-'}</td>
              <td>${log.action}</td>
              <td>${log.details}</td>
            </tr>
          `).join('') || '<tr><td colspan="5">No activity yet.</td></tr>';
        }

        function renderAdminPayments() {
            const tbody = document.getElementById('adminPaymentsBody');
            if (!tbody) return;
            const paidGuests = appData.guests.filter(g => g.paymentStatus === 'paid');
            tbody.innerHTML = paidGuests.map(g => `
            <tr>
              <td>${g.name}</td>
              <td>${g.roomNumber || 'N/A'}</td>
              <td>${g.paymentMethod || 'N/A'}</td>
              <td>₱${(g.totalPaid || 0).toLocaleString()}</td>
              <td><span class="badge badge-success">Paid</span></td>
            </tr>
          `).join('') || '<tr><td colspan="5">No payments recorded.</td></tr>';
        }

        function populateGuestSelects() {
            const activeGuests = appData.guests.filter(g => g.status === 'checked-in');
            const selects = ['accessGuestSelect', 'checkoutGuestSelect', 'serviceRoomSelect'];
            selects.forEach(selId => {
                const sel = document.getElementById(selId);
                if (!sel) return;
                const currentVal = sel.value;
                sel.innerHTML = '<option value="">-- Choose --</option>' +
                    activeGuests.map(g => `<option value="${g.id}">${g.name} — Room ${g.roomNumber}</option>`)
                    .join('');
                if (currentVal && activeGuests.find(g => String(g.id) === currentVal)) {
                    sel.value = currentVal;
                }
            });
        }

        function renderFoodMenu() {
            const container = document.getElementById('foodMenu');
            if (!container) return;
            container.innerHTML = appData.foodMenu.map(item => `
            <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
              <span>${item.name} <small style="color:var(--text-light);">(${item.category})</small></span>
              <span style="font-weight:700;">₱${item.price}</span>
              <button class="btn btn-sm btn-outline" onclick="addFoodToCart('${item.id}')">+ Add</button>
            </div>
          `).join('');
            window._foodCart = window._foodCart || {};
        }

        function updateRoomTypeOptions() {
            const roomTypeSelect = document.getElementById('regRoomType');
            if (!roomTypeSelect) return;
            
            const roomTypes = [
                { value: 'Standard', label: 'Standard Room', price: 1500 },
                { value: 'Deluxe', label: 'Deluxe Room', price: 2500 },
                { value: 'Suite', label: 'Suite Room', price: 4000 }
            ];
            
            roomTypeSelect.innerHTML = '<option value="">-- Select Room Type --</option>';
            
            roomTypes.forEach(type => {
                const availableCount = getAvailableRoomsByType(type.value).length;
                const option = document.createElement('option');
                option.value = type.value;
                option.textContent = `${type.label} - ₱${type.price}/night (${availableCount} available)`;
                if (availableCount === 0) {
                    option.disabled = true;
                }
                roomTypeSelect.appendChild(option);
            });
        }

        // ==================== REGISTRATION ====================
        function updatePriceDisplay() {
            const roomType = document.getElementById('regRoomType').value;
            const nights = parseInt(document.getElementById('regNights').value) || 1;
            const vehicle = document.getElementById('regVehicle').value.trim();
            let pricePerNight = 0;
            if (roomType === 'Standard') pricePerNight = 1500;
            if (roomType === 'Deluxe') pricePerNight = 2500;
            if (roomType === 'Suite') pricePerNight = 4000;
            let total = pricePerNight * nights;
            if (vehicle) total += appData.parkingFeePerNight * nights;
            document.getElementById('priceDisplay').textContent = '₱' + total.toLocaleString();
        }
        window.updatePriceDisplay = updatePriceDisplay;

        window.handleRegistration = function(event) {
            event.preventDefault();
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const phone = document.getElementById('regPhone').value.trim();
            const roomType = document.getElementById('regRoomType').value;
            const nights = parseInt(document.getElementById('regNights').value) || 1;
            const vehicle = document.getElementById('regVehicle').value.trim();

            if (!name || !email || !phone || !roomType) {
                showToast('Please fill all required fields.', 'error');
                return;
            }

            // Availability pre-check
            const available = getAvailableRoomsByType(roomType);
            if (available.length === 0) {
                showToast(`❌ No ${roomType} rooms available right now! Please select a different room type or contact admin (admin123).`, 'error');
                document.getElementById('regRoomType').focus();
                return;
            }

            window._pendingRegistration = { name, email, phone, roomType, nights, vehicle };
            document.getElementById('registrationCard').style.display = 'none';
            document.getElementById('paymentCard').style.display = 'block';
            document.getElementById('qrResultCard').style.display = 'none';
            const pricePerNight = roomType === 'Standard' ? 1500 : roomType === 'Deluxe' ? 2500 : 4000;
            let total = pricePerNight * nights;
            if (vehicle) total += appData.parkingFeePerNight * nights;
            document.getElementById('paymentDetails').innerHTML = `
                <div style="background: linear-gradient(135deg, var(--success-bg), #e8f7e8); padding: 18px; border-radius: var(--radius-md); border-left: 4px solid var(--success);">
                    <p><strong>👤 Guest:</strong> ${name}</p>
                    <p><strong>🏠 ${roomType} Room</strong> | <strong>${nights} night${nights>1?'s':''}</strong> | <strong>Vehicle:</strong> ${vehicle || 'None'}</p>
                    <p style="font-size:1.4rem; font-weight: 700; color: var(--success); margin-top: 12px;"><strong>💰 Total Due: ₱${total.toLocaleString()}</strong></p>
                </div>
            `;
            window._pendingTotal = total;
            showToast(`✅ Ready to pay ₱${total.toLocaleString()} via cashless. ${available.length} ${roomType} room(s) available.`, 'success');
        };

        window.resetPaymentState = function() {
            document.getElementById('registrationCard').style.display = 'block';
            document.getElementById('paymentCard').style.display = 'none';
            document.getElementById('qrResultCard').style.display = 'none';
            window._pendingRegistration = null;
            window._pendingTotal = null;
            // Clear form
            document.getElementById('registrationForm').reset();
            document.getElementById('priceDisplay').textContent = '₱0.00';
            showToast('Registration reset.', 'info');
        };

        window.processPayment = function(method) {
            console.log('Payment clicked:', method, 'Pending:', !!window._pendingRegistration);
            
            if (!window._pendingRegistration) {
                showToast('❌ No active booking. Please register first.', 'error');
                resetPaymentState();
                return;
            }

            const reg = window._pendingRegistration;
            const available = getAvailableRoomsByType(reg.roomType);
            console.log(`${reg.roomType} available rooms:`, available.length);

            if (available.length === 0) {
                showToast(`❌ Sorry, ${reg.roomType} room no longer available (booked by another guest). Please start over with different type.`, 'error');
                resetPaymentState();
                refreshAllDynamicContent();
                return;
            }

            // Assign room and create guest
            const assignedRoom = available[0];
            const guestId = appData.nextGuestId++;
            const now = new Date();
            const checkoutTime = new Date(now);
            checkoutTime.setDate(checkoutTime.getDate() + reg.nights);
            checkoutTime.setHours(13, 0, 0, 0);

            const pricePerNight = reg.roomType === 'Standard' ? 1500 : reg.roomType === 'Deluxe' ? 2500 : 4000;
            let total = pricePerNight * reg.nights;
            if (reg.vehicle) total += appData.parkingFeePerNight * reg.nights;

            const guest = {
                id: guestId,
                name: reg.name,
                email: reg.email,
                phone: reg.phone,
                roomType: reg.roomType,
                roomNumber: assignedRoom.number,
                nights: reg.nights,
                vehicle: reg.vehicle,
                paymentMethod: method,
                totalPaid: total,
                paymentStatus: 'paid',
                status: 'checked-in',
                checkInTime: now.toISOString(),
                checkOutTime: checkoutTime.toISOString(),
                qrData: `ZBSUITES|GUEST:${guestId}|ROOM:${assignedRoom.number}|VALID:${checkoutTime.toISOString()}`,
                billingItems: [
                    { item: `Room ${reg.roomType} (${reg.nights} night${reg.nights > 1 ? 's' : ''})`, amount: pricePerNight * reg.nights, paid: true }
                ],
                foodOrders: [],
                housekeepingRequests: [],
            };
            if (reg.vehicle) {
                guest.billingItems.push({ item: `Parking (${reg.nights} night${reg.nights > 1 ? 's' : ''})`, amount: appData.parkingFeePerNight * reg.nights, paid: true });
            }

            // Update room and data
            assignedRoom.occupied = true;
            assignedRoom.guestId = guestId;
            appData.guests.push(guest);
            saveData(appData);
            addLog(guest.name, guest.roomNumber, '✅ Check-In Complete', `${method} payment ₱${total.toLocaleString()}, QR issued`);

            // Show success QR card
            document.getElementById('registrationCard').style.display = 'none';
            document.getElementById('paymentCard').style.display = 'none';
            const qrCard = document.getElementById('qrResultCard');
            if (qrCard) {
                qrCard.style.display = 'block';
                document.getElementById('assignedRoom').textContent = guest.roomNumber;
                const qrDisplay = document.getElementById('qrCodeDisplay');
                if (qrDisplay) {
                    qrDisplay.innerHTML = '';
                    var canvas = document.createElement('canvas');
                    canvas.width = 220;
                    canvas.height = 220;
                    canvas.setAttribute('role', 'img');
                    canvas.setAttribute('aria-label', 'Guest QR access code');
                    canvas.style.cssText = 'max-width:220px;height:auto;border-radius:var(--radius-sm);box-shadow:var(--shadow-lg);border:3px solid var(--success);display:block;margin:0 auto 12px;';
                    qrDisplay.appendChild(canvas);
                    try {
                        if (typeof QrCreator !== 'undefined' && QrCreator.render) {
                            QrCreator.render({
                                text: guest.qrData,
                                size: 220,
                                fill: '#1a2e1f',
                                background: '#ffffff',
                                radius: 0.08,
                                ecLevel: 'M'
                            }, canvas);
                        } else {
                            throw new Error('QrCreator not loaded');
                        }
                    } catch (qrErr) {
                        var ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.fillStyle = '#f0f5f0';
                            ctx.fillRect(0, 0, 220, 220);
                            ctx.strokeStyle = '#2d5a3b';
                            ctx.lineWidth = 3;
                            ctx.strokeRect(6, 6, 208, 208);
                            ctx.fillStyle = '#1a2e1f';
                            ctx.font = '12px system-ui,sans-serif';
                            ctx.fillText('QR unavailable — check qr-creator.min.js', 10, 112);
                        }
                    }
                    var qrLabel = document.createElement('div');
                    qrLabel.className = 'qr-label';
                    qrLabel.style.cssText = 'font-weight:700;color:var(--success);margin-top:12px;font-size:0.95rem;text-align:center;';
                    qrLabel.textContent = 'Scan everywhere: Room • Elevator • Parking • Services';
                    qrDisplay.appendChild(qrLabel);
                }
            } else {
                showToast('QR display error - refresh page.', 'error');
            }

            showToast(`🎉 Check-in complete! Welcome ${guest.name} to Room ${guest.roomNumber} 💳 Paid ₱${total.toLocaleString()} via ${method}`, 'success');
            window._pendingRegistration = null;
            window._pendingTotal = null;
            refreshAllDynamicContent();
        };


        // ==================== ACCESS SIMULATION ====================
window.updateAccessInfo = function() {
    const sel = document.getElementById('accessGuestSelect');
    const panels = document.getElementById('accessPanels');
    const result = document.getElementById('accessResult');
    
    if (sel && sel.value) {
        panels.style.display = 'block';
        // Reset all indicators to ready state
        ['rooms', 'elevator', 'parking'].forEach(type => {
            const indicator = document.getElementById('indicator-' + type);
            if (indicator) {
                const circle = indicator.querySelector('.indicator-circle');
                if (circle) {
                    circle.textContent = '✅';
                    circle.className = 'indicator-circle ready';
                }
            }
        });
        if (result) result.innerHTML = '<span style="color: var(--warning);">👆 Select room above, then tap access point to scan QR</span>';
    } else {
        panels.style.display = 'none';
        if (result) result.innerHTML = '<span style="color: var(--text-muted);">Please select a checked-in guest first</span>';
    }
};

window.simulateAccess = function(type) {
    const sel = document.getElementById('accessGuestSelect');
    if (!sel || !sel.value) {
        showToast('Please select a room first!', 'warning');
        return;
    }
    
    const guestId = parseInt(sel.value);
    const guest = appData.guests.find(g => g.id === guestId && g.status === 'checked-in');
    if (!guest) {
        showToast('No valid guest selected!', 'error');
        return;
    }
    
    const indicator = document.getElementById('indicator-' + type);
    const circle = indicator ? indicator.querySelector('.indicator-circle') : null;
    const result = document.getElementById('accessResult');
    
    if (!indicator || !circle || !result) return;
    
    // Simulate QR validation (always grant if guest valid & checked-in)
    const now = new Date();
    const checkoutTime = new Date(guest.checkOutTime);
    const isExpired = now > checkoutTime;
    const hasVehicle = !!guest.vehicle;
    
    let granted = true;
    let reason = '';
    let message = '';
    
    if (type === 'parking' && !hasVehicle) {
        granted = false;
        reason = 'No vehicle registered';
    } else if (isExpired) {
        granted = false;
        reason = 'Stay expired';
    }
    
    if (granted) {
        circle.textContent = '✅';
        circle.className = 'indicator-circle granted';
        if (type === 'rooms') message = '🏠 Room access granted! Door unlocked';
        else if (type === 'elevator') message = '🛗 Elevator access granted! All floors unlocked';
        else if (type === 'parking') message = '🅿️ Parking gate opened! Welcome back';
        result.innerHTML = `<span style="color: var(--success);">✅ ${message}</span>`;
        addLog(guest.name, guest.roomNumber, `QR Access ✅ ${type}`, 'Valid QR scan');
        showToast(`${message} for ${guest.name}`, 'success');
    } else {
        circle.textContent = '❌';
        circle.className = 'indicator-circle denied';
        result.innerHTML = `<span style="color: var(--danger);">🚫 Access denied: ${reason}</span>`;
        addLog(guest.name, guest.roomNumber, `QR Access ❌ ${type}`, reason);
        showToast(`Access denied: ${reason}`, 'error');
    }
};

        // ==================== IN-ROOM SERVICES ====================
        window.updateServiceRoom = function() {
            const sel = document.getElementById('serviceRoomSelect');
            const panels = document.getElementById('servicePanels');
            if (!sel || !panels) return;
            const guestId = parseInt(sel.value);
            const guest = appData.guests.find(g => g.id === guestId && g.status === 'checked-in');
            if (guest) {
                panels.style.display = 'block';
                window._currentServiceGuestId = guestId;
                window._foodCart = {};
                document.getElementById('foodCart').innerHTML = '';
            } else {
                panels.style.display = 'none';
                window._currentServiceGuestId = null;
            }
        };

        window.addFoodToCart = function(foodId) {
            if (!window._currentServiceGuestId) {
                showToast('Please select your room first.', 'warning');
                return;
            }
            const item = appData.foodMenu.find(f => f.id === foodId);
            if (!item) return;
            window._foodCart[foodId] = (window._foodCart[foodId] || 0) + 1;
            renderFoodCart();
            showToast(`${item.name} added to cart.`, 'info');
        };

        function renderFoodCart() {
            const cartDiv = document.getElementById('foodCart');
            if (!cartDiv) return;
            const cart = window._foodCart || {};
            const entries = Object.entries(cart).filter(([_, qty]) => qty > 0);
            if (entries.length === 0) {
                cartDiv.innerHTML = '<p style="color:var(--text-light);">🛒 Cart is empty.</p>';
                return;
            }
            cartDiv.innerHTML = `
            <strong>🛒 Current Order:</strong>
            <table style="margin-top:8px;">
              <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr></thead>
              <tbody>
                ${entries.map(([fid, qty]) => {
                  const item = appData.foodMenu.find(f => f.id === fid);
                  if (!item) return '';
                  return `<tr>
                    <td>${item.name}</td>
                    <td>${qty}</td>
                    <td>₱${item.price}</td>
                    <td>₱${(item.price * qty).toLocaleString()}</td>
                   </tr>`;
                }).join('')}
              </tbody>
              <tfoot><tr><td colspan="3"><strong>Total</strong></td><td><strong>₱${getCartTotal().toLocaleString()}</strong></td></tr></tfoot>
            </table>
          `;
        }

        function getCartTotal() {
            const cart = window._foodCart || {};
            return Object.entries(cart).reduce((sum, [fid, qty]) => {
                const item = appData.foodMenu.find(f => f.id === fid);
                return sum + (item ? item.price * qty : 0);
            }, 0);
        }

        window.placeFoodOrder = function() {
            if (!window._currentServiceGuestId) return;
            const cart = window._foodCart || {};
            const entries = Object.entries(cart).filter(([_, qty]) => qty > 0);
            if (entries.length === 0) {
                showToast('Cart is empty!', 'warning');
                return;
            }
            const guest = appData.guests.find(g => g.id === window._currentServiceGuestId);
            if (!guest) return;
            const total = getCartTotal();
            const orderItems = entries.map(([fid, qty]) => {
                const item = appData.foodMenu.find(f => f.id === fid);
                return { name: item ? item.name : fid, qty, price: item ? item.price : 0 };
            });
            guest.foodOrders = guest.foodOrders || [];
            guest.foodOrders.push({ items: orderItems, total, time: new Date().toISOString(), paid: false });
            guest.billingItems.push({ item: `Food Order (${orderItems.map(o=>o.name).join(', ')})`, amount: total,
                paid: false });
            saveData(appData);
            addLog(guest.name, guest.roomNumber, 'Food Order Placed', `Total: ₱${total.toLocaleString()}`);
            window._foodCart = {};
            renderFoodCart();
            showToast(`🍽️ Order placed! ₱${total.toLocaleString()} added to bill.`, 'success');
            refreshAllDynamicContent();
        };

        window.submitHousekeeping = function() {
            if (!window._currentServiceGuestId) {
                showToast('Please select your room first.', 'warning');
                return;
            }
            const guest = appData.guests.find(g => g.id === window._currentServiceGuestId);
            if (!guest) return;
            const requestType = document.getElementById('hkRequestType').value;
            const time = document.getElementById('hkTime').value;
            guest.housekeepingRequests = guest.housekeepingRequests || [];
            guest.housekeepingRequests.push({ requestType, time, timeStamp: new Date().toISOString() });
            saveData(appData);
            addLog(guest.name, guest.roomNumber, 'Housekeeping Request', `${requestType} at ${time}`);
            showToast(`🧹 ${requestType} request submitted for ${time}.`, 'success');
        };

        // ==================== CHECKOUT ====================
        window.updateCheckoutInfo = function() {
            const sel = document.getElementById('checkoutGuestSelect');
            const infoDiv = document.getElementById('checkoutInfo');
            if (!sel || !infoDiv) return;
            const guestId = parseInt(sel.value);
            const guest = appData.guests.find(g => g.id === guestId && g.status === 'checked-in');
            if (!guest) {
                infoDiv.style.display = 'none';
                return;
            }
            infoDiv.style.display = 'block';
            const allItems = [...(guest.billingItems || [])];
            const tbody = document.getElementById('checkoutBillBody');
            let totalDue = 0;
            tbody.innerHTML = allItems.map(b => {
                const isPaid = b.paid !== false;
                totalDue += isPaid ? 0 : b.amount;
                return `<tr>
              <td>${b.item}</td>
              <td>${isPaid ? '<span class="badge badge-success">Paid</span>' : '<span class="badge badge-warning">Unpaid</span>'}</td>
              <td>₱${b.amount.toLocaleString()}</td>
             </tr>`;
            }).join('');
            document.getElementById('checkoutTotal').textContent = '₱' + totalDue.toLocaleString();
            const statusDiv = document.getElementById('checkoutStatus');
            const checkoutTime = new Date(guest.checkOutTime);
            const now = new Date();
            if (totalDue > 0) {
                statusDiv.innerHTML =
                    '<span class="badge badge-danger">⚠️ Unpaid Charges — QR access restricted until settled</span>';
                document.getElementById('checkoutBtn').disabled = false;
                document.getElementById('checkoutBtn').textContent = '💳 Pay & Check-Out';
            } else if (now > checkoutTime) {
                statusDiv.innerHTML =
                    '<span class="badge badge-warning">⏰ Past check-out time — please proceed to exit</span>';
                document.getElementById('checkoutBtn').disabled = false;
                document.getElementById('checkoutBtn').textContent = '🔓 Complete Check-Out';
            } else {
                statusDiv.innerHTML = '<span class="badge badge-success">✅ All clear — ready to check out</span>';
                document.getElementById('checkoutBtn').disabled = false;
                document.getElementById('checkoutBtn').textContent = '🔓 Check-Out Now';
            }
            window._checkoutTotalDue = totalDue;
        };

        window.processCheckout = function() {
            const sel = document.getElementById('checkoutGuestSelect');
            const guestId = parseInt(sel.value);
            const guest = appData.guests.find(g => g.id === guestId && g.status === 'checked-in');
            if (!guest) return;
            const totalDue = window._checkoutTotalDue || 0;
            if (totalDue > 0) {
                guest.billingItems.forEach(b => b.paid = true);
                if (guest.foodOrders) guest.foodOrders.forEach(f => f.paid = true);
                guest.totalPaid = (guest.totalPaid || 0) + totalDue;
                showToast(`💳 Payment of ₱${totalDue.toLocaleString()} processed.`, 'success');
                addLog(guest.name, guest.roomNumber, 'Payment Settled', `₱${totalDue.toLocaleString()} paid at check-out`);
            }
            const room = appData.rooms.find(r => r.number === guest.roomNumber);
            if (room) { room.occupied = false;
                room.guestId = null; }
            guest.status = 'checked-out';
            guest.checkOutCompleted = new Date().toISOString();
            saveData(appData);
            addLog(guest.name, guest.roomNumber, 'Check-Out Completed', 'Room released, QR deactivated');
            showToast(`🔓 Check-out complete! Room ${guest.roomNumber} is now available.`, 'success');
            document.getElementById('checkoutInfo').style.display = 'none';
            document.getElementById('checkoutGuestSelect').value = '';
            refreshAllDynamicContent();
            updateCheckoutInfo();
        };

        // ==================== MODAL ====================
        window.closeModal = function(event) {
            if (event.target === document.getElementById('modalOverlay')) {
                document.getElementById('modalOverlay').style.display = 'none';
            }
        };

        // ==================== RESET ====================
        window.resetAllData = function() {
            if (confirm('⚠️ Reset ALL data? This will clear all guests, bookings, and logs. This cannot be undone.')) {
                appData = getDefaultData();
                saveData(appData);
                window.appData = appData;
                window._pendingRegistration = null;
                window._foodCart = {};
                window._currentServiceGuestId = null;
                window._checkoutTotalDue = 0;
                document.getElementById('registrationCard').style.display = 'block';
                document.getElementById('paymentCard').style.display = 'none';
                document.getElementById('qrResultCard').style.display = 'none';
                document.getElementById('checkoutInfo').style.display = 'none';
                document.getElementById('servicePanels').style.display = 'none';
                document.getElementById('accessPanels').style.display = 'none';
                ['room', 'elevator', 'parking'].forEach(type => {
                    const ind = document.getElementById('indicator-' + type);
                    if (ind) { ind.className = 'indicator';
                        ind.textContent = type === 'room' ? '🚪' : type === 'elevator' ? '🛗' : '🅿️'; }
                });
                document.getElementById('accessResult').textContent = '';
                refreshAllDynamicContent();
                showToast('🔄 All data has been reset.', 'info');
            }
        };
        
        const PHOTO_PATHS = window.PHOTO_PATHS || [];

        function normalizePhotoPath(path) {
            return String(path).replace(/\\/g, '/');
        }

        function getPhotoLabel(path) {
            const fileName = normalizePhotoPath(path).split('/').pop() || 'photo';
            return fileName
                .replace(/\.[^.]+$/, '')
                .replace(/[_-]+/g, ' ');
        }

        function setHeroPhoto() {
            const hero = document.getElementById('photoshootHero');
            if (!hero || PHOTO_PATHS.length === 0) return;
            const firstPhoto = normalizePhotoPath(PHOTO_PATHS[0]);
            hero.style.backgroundImage = `url("${firstPhoto}")`;
        }

        function pickPhotoByKeyword(keyword) {
            const key = keyword.toLowerCase();
            const match = PHOTO_PATHS.find(path => normalizePhotoPath(path)
                .toLowerCase().includes(key));
            return match ? normalizePhotoPath(match) : '';
        }

        function applySectionPhoto(sectionId, keyword) {
            const section = document.getElementById(sectionId);
            if (!section) return;
            const photo = pickPhotoByKeyword(keyword) || normalizePhotoPath(PHOTO_PATHS[0] || '');
            if (!photo) return;
            section.classList.add('section-photo');
            section.style.setProperty('--section-photo-url', `url("${photo}")`);
        }

        function renderHomePhotoStrip() {
            const strip = document.getElementById('homePhotoStrip');
            if (!strip) return;
            if (PHOTO_PATHS.length === 0) {
                strip.innerHTML = '<p class="subtitle">No photos available.</p>';
                return;
            }
            const picks = [PHOTO_PATHS[0], PHOTO_PATHS[1], PHOTO_PATHS[2]]
                .filter(Boolean)
                .map(path => normalizePhotoPath(path));
            strip.innerHTML = picks.map(path => `
                <img class="strip-photo" src="${path}" alt="ZB Suites highlight" loading="lazy">
            `).join('');
        }

        window._roomPhotoZoom = 1;
        window._currentRoomPhotos = [];
        window._currentRoomPhotoIndex = 0;
        window._currentRoomNumber = '';

        window.openRoomPhotoModal = function(roomNumber) {
            const key = String(roomNumber).toUpperCase();
            const roomPhotoGroups = getRoomPhotoGroups();
            const photos = roomPhotoGroups[key] || [];
            if (photos.length === 0) {
                showToast('No photo available for this room.', 'warning');
                return;
            }
            const modal = document.getElementById('roomPhotoModal');
            const img = document.getElementById('roomPhotoImage');
            const title = document.getElementById('roomPhotoTitle');
            const thumbs = document.getElementById('roomPhotoThumbs');
            if (!modal || !img || !title || !thumbs) return;
            title.textContent = `Room ${roomNumber} Preview`;
            window._currentRoomPhotos = photos;
            window._currentRoomPhotoIndex = 0;
            window._currentRoomNumber = key;
            img.src = photos[0];
            img.alt = `Room ${roomNumber} photo`;
            window._roomPhotoZoom = 1;
            img.style.transform = 'scale(1)';
            thumbs.innerHTML = photos.map((photo, index) => `
                <button
                    type="button"
                    class="room-thumb-btn ${index === 0 ? 'active' : ''}"
                    onclick="setRoomPhoto(${index})"
                >
                    <img src="${photo}" alt="Room ${roomNumber} thumbnail ${index + 1}">
                </button>
            `).join('');
            modal.style.display = 'flex';
        };

        window.setRoomPhoto = function(index) {
            const img = document.getElementById('roomPhotoImage');
            const thumbs = document.querySelectorAll('.room-thumb-btn');
            if (!img || !window._currentRoomPhotos.length) return;
            if (index < 0 || index >= window._currentRoomPhotos.length) return;
            window._currentRoomPhotoIndex = index;
            img.src = window._currentRoomPhotos[index];
            img.alt = `Room ${window._currentRoomNumber} photo ${index + 1}`;
            window._roomPhotoZoom = 1;
            img.style.transform = 'scale(1)';
            thumbs.forEach((thumb, i) => {
                thumb.classList.toggle('active', i === index);
            });
        };

        window.closeRoomPhotoModal = function(event) {
            const modal = document.getElementById('roomPhotoModal');
            if (!modal) return;
            if (!event || event.target === modal) {
                modal.style.display = 'none';
            }
        };

        window.zoomRoomPhoto = function(step) {
            const img = document.getElementById('roomPhotoImage');
            if (!img) return;
            window._roomPhotoZoom = Math.max(0.6, Math.min(3, window._roomPhotoZoom + step));
            img.style.transform = `scale(${window._roomPhotoZoom})`;
        };

        window.resetRoomPhotoZoom = function() {
            const img = document.getElementById('roomPhotoImage');
            if (!img) return;
            window._roomPhotoZoom = 1;
            img.style.transform = 'scale(1)';
        };

// ==================== PHOTO GALLERY WITH CATEGORIES ====================

// ==================== PHOTO GALLERY WITH CATEGORY MODAL ====================

let currentCategoryName = '';
let currentCategoryPhotos = [];
let currentPhotoIndex = 0;

function renderPhotoGallery() {
    const gallery = document.getElementById('photoshootGrid');
    const count = document.getElementById('photoCount');
    if (!gallery || !count) return;

    let totalPhotos = 0;
    for (const cat in PHOTO_CATEGORIES) {
        totalPhotos += PHOTO_CATEGORIES[cat].photos.length;
    }
    count.textContent = `${Object.keys(PHOTO_CATEGORIES).length} categories · ${totalPhotos} color graded photos`;

    // Create category cards instead of expandable folders
    gallery.innerHTML = '';
    
    for (const [categoryName, categoryData] of Object.entries(PHOTO_CATEGORIES)) {
        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.onclick = () => openCategoryModal(categoryName);
        
        // Get first photo as preview
        const previewPhoto = categoryData.photos[0] || '';
        
        categoryCard.innerHTML = `
            <div class="category-card-preview">
                <img src="${previewPhoto}" alt="${categoryName}" class="category-preview-img" onerror="this.onerror=null;this.src='${getPlaceholderDataUrl(categoryName, 400, 300)}'">
                <div class="category-card-overlay">
                    <span class="category-card-icon">${categoryData.icon}</span>
                    <h3 class="category-card-title">${categoryName}</h3>
                    <span class="category-card-count">${categoryData.photos.length} photos</span>
                </div>
            </div>
        `;
        gallery.appendChild(categoryCard);
    }
}

// Open category modal with all photos
window.openCategoryModal = function(categoryName) {
    const categoryData = PHOTO_CATEGORIES[categoryName];
    if (!categoryData) return;
    
    currentCategoryName = categoryName;
    currentCategoryPhotos = categoryData.photos;
    currentPhotoIndex = 0;
    
    const modal = document.getElementById('modalOverlay');
    const modalContent = document.getElementById('modalContent');
    
    if (!modal || !modalContent) return;
    
    modalContent.innerHTML = `
        <div class="category-modal">
            <div class="category-modal-header">
                <div class="category-modal-title">
                    <span class="category-icon">${categoryData.icon}</span>
                    <h2>${categoryName}</h2>
                    <span class="photo-total-count">${categoryData.photos.length} photos</span>
                </div>
                <button class="category-modal-close" onclick="closeCategoryModal()">✕</button>
            </div>
            <div class="category-modal-body" id="categoryModalBody">
                <div class="category-photo-grid">
                    ${categoryData.photos.map((photo, idx) => `
                        <div class="category-photo-item" onclick="openFullscreenPhoto(${idx})">
                            <img src="${photo}" alt="${categoryName} - ${idx + 1}" class="category-photo-thumb" loading="lazy" onerror="this.onerror=null;this.src='${getPlaceholderDataUrl(categoryName + ' · ' + (idx + 1), 400, 300)}'">
                            <div class="category-photo-overlay">
                                <span class="zoom-icon">🔍</span>
                                <span class="photo-number">${idx + 1}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="category-modal-footer">
                <p class="category-description">${categoryData.description}</p>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
};

// Close category modal
window.closeCategoryModal = function() {
    const modal = document.getElementById('modalOverlay');
    if (modal) {
        modal.style.display = 'none';
    }
    currentCategoryName = '';
    currentCategoryPhotos = [];
    currentPhotoIndex = 0;
};

// Open fullscreen photo viewer within modal
window.openFullscreenPhoto = function(index) {
    if (!currentCategoryPhotos.length) return;
    
    currentPhotoIndex = index;
    const photo = currentCategoryPhotos[index];
    const categoryData = PHOTO_CATEGORIES[currentCategoryName];
    const totalPhotos = currentCategoryPhotos.length;
    const prevIndex = index - 1 >= 0 ? index - 1 : totalPhotos - 1;
    const nextIndex = index + 1 < totalPhotos ? index + 1 : 0;
    
    const modalContent = document.getElementById('modalContent');
    if (!modalContent) return;
    
    modalContent.innerHTML = `
        <div class="fullscreen-photo-modal">
            <div class="fullscreen-photo-header">
                <button class="back-btn" onclick="backToCategoryGallery()">
                    <span>←</span> Back to Gallery
                </button>
                <div class="fullscreen-photo-title">
                    <span class="category-icon">${categoryData.icon}</span>
                    <h3>${currentCategoryName}</h3>
                    <span class="photo-counter">${index + 1} of ${totalPhotos}</span>
                </div>
                <button class="fullscreen-close" onclick="closeCategoryModal()">✕</button>
            </div>
            <div class="fullscreen-photo-body">
                <button class="fullscreen-nav prev" onclick="navigateFullscreenPhoto(${prevIndex}, event)">‹</button>
                <div class="fullscreen-image-container" id="fullscreenImageContainer">
                    <img id="fullscreenImage" src="${photo}" alt="${currentCategoryName}" class="fullscreen-image" style="transform: scale(1);" onerror="this.onerror=null;this.src='${getPlaceholderDataUrl('Image loading', 1200, 800)}'">
                </div>
                <button class="fullscreen-nav next" onclick="navigateFullscreenPhoto(${nextIndex}, event)">›</button>
            </div>
            <div class="fullscreen-photo-footer">
                <div class="zoom-controls">
                    <button class="zoom-btn" onclick="zoomFullscreenPhoto(-0.2)">
                        <span>−</span> Zoom Out
                    </button>
                    <button class="zoom-btn" onclick="resetFullscreenZoom()">
                        <span>⟳</span> Reset
                    </button>
                    <button class="zoom-btn" onclick="zoomFullscreenPhoto(0.2)">
                        <span>+</span> Zoom In
                    </button>
                </div>
                <p class="photo-description">${categoryData.description}</p>
                <div class="zoom-instruction">💡 Tip: Click and drag to pan around zoomed image</div>
            </div>
        </div>
    `;
    
    // Reset zoom and add drag functionality
    currentFullscreenZoom = 1;
    setTimeout(() => {
        const img = document.getElementById('fullscreenImage');
        if (img) {
            makeFullscreenImageDraggable(img);
        }
    }, 100);
};

// Back to category gallery view
window.backToCategoryGallery = function() {
    if (currentCategoryName) {
        openCategoryModal(currentCategoryName);
    }
};

// Navigate through fullscreen photos
window.navigateFullscreenPhoto = function(newIndex, event) {
    event.stopPropagation();
    if (currentCategoryPhotos[newIndex]) {
        openFullscreenPhoto(newIndex);
    }
};

// Zoom variables for fullscreen
let currentFullscreenZoom = 1;
let currentFullscreenImage = null;
let fullscreenDragStartX = 0, fullscreenDragStartY = 0;
let fullscreenTranslateX = 0, fullscreenTranslateY = 0;
let fullscreenIsDragging = false;

// Zoom fullscreen photo
window.zoomFullscreenPhoto = function(step) {
    const img = document.getElementById('fullscreenImage');
    if (!img) return;
    
    let newZoom = currentFullscreenZoom + step;
    newZoom = Math.max(0.5, Math.min(3, newZoom));
    currentFullscreenZoom = newZoom;
    
    // Reset translation when zooming
    fullscreenTranslateX = 0;
    fullscreenTranslateY = 0;
    img.style.transform = `scale(${currentFullscreenZoom})`;
    img.style.transition = 'transform 0.2s ease';
    
    if (currentFullscreenZoom > 1) {
        img.style.cursor = 'grab';
    } else {
        img.style.cursor = 'default';
    }
};

// Reset fullscreen zoom
window.resetFullscreenZoom = function() {
    const img = document.getElementById('fullscreenImage');
    if (!img) return;
    
    currentFullscreenZoom = 1;
    fullscreenTranslateX = 0;
    fullscreenTranslateY = 0;
    img.style.transform = 'scale(1)';
    img.style.cursor = 'default';
};

// Make fullscreen image draggable
function makeFullscreenImageDraggable(img) {
    img.style.cursor = 'grab';
    
    const handleMouseDown = (e) => {
        if (currentFullscreenZoom > 1) {
            fullscreenIsDragging = true;
            fullscreenDragStartX = e.clientX - fullscreenTranslateX;
            fullscreenDragStartY = e.clientY - fullscreenTranslateY;
            img.style.cursor = 'grabbing';
            e.preventDefault();
        }
    };
    
    const handleMouseMove = (e) => {
        if (fullscreenIsDragging && currentFullscreenZoom > 1) {
            fullscreenTranslateX = e.clientX - fullscreenDragStartX;
            fullscreenTranslateY = e.clientY - fullscreenDragStartY;
            img.style.transform = `scale(${currentFullscreenZoom}) translate(${fullscreenTranslateX / currentFullscreenZoom}px, ${fullscreenTranslateY / currentFullscreenZoom}px)`;
        }
    };
    
    const handleMouseUp = () => {
        fullscreenIsDragging = false;
        if (img) img.style.cursor = 'grab';
    };
    
    img.removeEventListener('mousedown', handleMouseDown);
    img.removeEventListener('mousemove', handleMouseMove);
    img.removeEventListener('mouseup', handleMouseUp);
    
    img.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    // Touch support
    img.addEventListener('touchstart', (e) => {
        if (currentFullscreenZoom > 1) {
            fullscreenIsDragging = true;
            fullscreenDragStartX = e.touches[0].clientX - fullscreenTranslateX;
            fullscreenDragStartY = e.touches[0].clientY - fullscreenTranslateY;
            e.preventDefault();
        }
    });
    
    window.addEventListener('touchmove', (e) => {
        if (fullscreenIsDragging && currentFullscreenZoom > 1 && e.touches.length) {
            fullscreenTranslateX = e.touches[0].clientX - fullscreenDragStartX;
            fullscreenTranslateY = e.touches[0].clientY - fullscreenDragStartY;
            img.style.transform = `scale(${currentFullscreenZoom}) translate(${fullscreenTranslateX / currentFullscreenZoom}px, ${fullscreenTranslateY / currentFullscreenZoom}px)`;
        }
    });
    
    window.addEventListener('touchend', () => {
        fullscreenIsDragging = false;
    });
}

// Update setHeroPhoto function
function setHeroPhoto() {
    const hero = document.getElementById('photoshootHero');
    if (!hero) return;
    
    const lobbyPhotos = PHOTO_CATEGORIES['LOBBY']?.photos || [];
    const firstPhoto = lobbyPhotos[0] || PHOTO_PATHS[0] || '';
    if (firstPhoto) {
        hero.style.backgroundImage = `url("${firstPhoto}")`;
    }
}

// Update renderHomePhotoStrip
function renderHomePhotoStrip() {
    const strip = document.getElementById('homePhotoStrip');
    if (!strip) return;
    
    const featured = [
        PHOTO_CATEGORIES['LOBBY']?.photos[0],
        PHOTO_CATEGORIES['DINING AREA']?.photos[0],
        PHOTO_CATEGORIES['CONFERENCE ROOM 1']?.photos[0]
    ].filter(Boolean);
    
    if (featured.length === 0) {
        strip.innerHTML = '<p class="subtitle">No photos available.</p>';
        return;
    }
    
    strip.innerHTML = featured.map(path => `
        <img class="strip-photo" src="${path}" alt="ZB Suites highlight" loading="lazy" onerror="this.onerror=null;this.src='${getPlaceholderDataUrl('Photo', 800, 600)}'">
    `).join('');
}

        function applyThemePhotos() {
            applySectionPhoto('section-home', 'lobby');
            applySectionPhoto('section-checkin', 'room');
            applySectionPhoto('section-access', 'parking');
            applySectionPhoto('section-services', 'dining');
            applySectionPhoto('section-gallery', 'outdoor');
            applySectionPhoto('section-checkout', 'conference');
            applySectionPhoto('section-admin', 'social');
            renderHomePhotoStrip();
        }

        // ==================== INITIAL SETUP ====================
        function init() {
            refreshAllDynamicContent();
            updatePriceDisplay();
            applyThemePhotos();
            const activeGuests = appData.guests.filter(g => g.status === 'checked-in');
            if (activeGuests.length > 0) {
                const firstId = String(activeGuests[0].id);
                ['accessGuestSelect', 'checkoutGuestSelect', 'serviceRoomSelect'].forEach(selId => {
                    const sel = document.getElementById(selId);
                    if (sel && sel.querySelector(`option[value="${firstId}"]`)) {
                        sel.value = firstId;
                    }
                });
                updateAccessInfo();
                updateCheckoutInfo();
                updateServiceRoom();
            }
            console.log('🏨 ZB Suites Baguio — Smart QR Self Check-In Prototype Ready');
            console.log('📊 Active guests:', activeGuests.length);
            console.log('🏠 Available rooms:', appData.rooms.filter(r => !r.occupied).length);
        }

        window.refreshAllDynamicContent = refreshAllDynamicContent;
        init();
    })();