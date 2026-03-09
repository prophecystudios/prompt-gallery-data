// ===== App State =====
let currentScreen = 'splash';
let previousScreen = 'home'; // Track previous screen for back navigation
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let currentCategory = 'all';
let currentPrompt = null;

// ===== DOM Elements =====
const screens = {
    splash: document.getElementById('splash-screen'),
    home: document.getElementById('home-screen'),
    search: document.getElementById('search-screen'),
    detail: document.getElementById('detail-screen'),
    favorites: document.getElementById('favorites-screen'),
    settings: document.getElementById('settings-screen')
};

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButtons(savedTheme);

    // Setup event listeners first
    setupEventListeners();

    // Fetch prompts from GitHub during splash screen
    try {
        await fetchPrompts();
        console.log('Prompts loaded successfully');
    } catch (error) {
        console.error('Failed to load prompts:', error);
    }

    // Show home screen after splash (minimum 2.5s for animation)
    setTimeout(() => {
        showScreen('home');
        renderGallery();
    }, 2500);
}

// ===== Screen Navigation =====
function showScreen(screenName, addToHistory = true) {
    // Track previous screen (but not splash)
    if (currentScreen !== 'splash' && currentScreen !== screenName) {
        previousScreen = currentScreen;
    }
    
    Object.values(screens).forEach(screen => {
        if (screen) screen.classList.remove('active');
    });
    
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
        currentScreen = screenName;
    }

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.screen === screenName) {
            item.classList.add('active');
        }
    });

    // Add to browser history for back button support
    if (addToHistory && screenName !== 'splash') {
        history.pushState({ screen: screenName }, '', `#${screenName}`);
    }

    // Re-render content when switching screens to sync state
    if (screenName === 'home') {
        renderGallery();
    } else if (screenName === 'favorites') {
        renderFavorites();
    }
}

// ===== Back Button Handler =====
function handleBackButton() {
    // Close any open modals first
    const openModal = document.querySelector('.modal.show');
    if (openModal) {
        openModal.classList.remove('show');
        return;
    }
    
    // Handle back navigation based on current screen
    switch (currentScreen) {
        case 'detail':
        case 'search':
            // Go back to previous screen (home or favorites)
            showScreen(previousScreen, false);
            break;
        case 'favorites':
        case 'settings':
            // Go back to home
            showScreen('home', false);
            break;
        case 'home':
            // On home screen - let browser handle exit
            // For Android WebView, this will exit the app
            history.back();
            break;
        default:
            showScreen('home', false);
    }
}

// Listen for browser back button
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.screen) {
        showScreen(e.state.screen, false);
    } else {
        handleBackButton();
    }
});

// ===== Event Listeners =====
function setupEventListeners() {
    // Bottom navigation - attach to ALL nav items across all screens
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const screen = item.dataset.screen;
            if (screen) {
                showScreen(screen);
            }
        });
    });

    // Search button
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => showScreen('search'));
    }

    // Back buttons
    const searchBackBtn = document.getElementById('search-back-btn');
    if (searchBackBtn) {
        searchBackBtn.addEventListener('click', () => showScreen('home'));
    }

    const detailBackBtn = document.getElementById('detail-back-btn');
    if (detailBackBtn) {
        detailBackBtn.addEventListener('click', () => {
            // Go back to home or favorites depending on where we came from
            showScreen('home');
        });
    }

    // Category tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCategory = tab.dataset.category;
            renderGallery();
        });
    });

    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchPrompts(e.target.value);
        });
    }

    // Search tags
    document.querySelectorAll('.tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const searchInput = document.getElementById('search-input');
            searchInput.value = tag.dataset.tag;
            searchPrompts(tag.dataset.tag);
        });
    });

    // Detail screen actions
    const copyPromptBtn = document.getElementById('copy-prompt-btn');
    if (copyPromptBtn) {
        copyPromptBtn.addEventListener('click', () => {
            if (currentPrompt) {
                copyToClipboard(currentPrompt.prompt);
            }
        });
    }

    const detailFavoriteBtn = document.getElementById('detail-favorite-btn');
    if (detailFavoriteBtn) {
        detailFavoriteBtn.addEventListener('click', () => {
            if (currentPrompt) {
                toggleFavorite(currentPrompt.id);
                updateDetailFavoriteButton();
            }
        });
    }

    // Theme toggle
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            setTheme(theme);
        });
    });

    // Settings buttons
    setupSettingsListeners();
}

// ===== Gallery Rendering =====
function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;

    const filteredPrompts = currentCategory === 'all' 
        ? prompts 
        : prompts.filter(p => p.category === currentCategory);

    grid.innerHTML = filteredPrompts.map(prompt => createCardHTML(prompt)).join('');

    // Add event listeners to cards
    grid.querySelectorAll('.gallery-card').forEach(card => {
        const promptId = parseInt(card.dataset.id);
        
        // Card click (not on buttons)
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.card-icon-btn')) {
                openPromptDetail(promptId);
            }
        });
    });

    // Add event listeners to card buttons
    grid.querySelectorAll('.card-favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const promptId = parseInt(btn.dataset.id);
            toggleFavorite(promptId);
            updateCardFavoriteButton(btn, promptId);
        });
    });

    grid.querySelectorAll('.card-copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const promptId = parseInt(btn.dataset.id);
            const prompt = prompts.find(p => p.id === promptId);
            if (prompt) {
                copyToClipboard(prompt.prompt);
                // Visual feedback
                btn.classList.add('copied');
                setTimeout(() => btn.classList.remove('copied'), 1500);
            }
        });
    });
}

function createCardHTML(prompt) {
    const isFavorited = favorites.includes(prompt.id);
    
    return `
        <div class="gallery-card" data-id="${prompt.id}">
            <div class="card-image-container">
                <img src="${prompt.image}" alt="${prompt.title}" class="card-image" loading="lazy">
                <div class="card-actions">
                    <button class="card-icon-btn card-favorite-btn ${isFavorited ? 'favorited' : ''}" data-id="${prompt.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </button>
                    <button class="card-icon-btn card-copy-btn" data-id="${prompt.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function updateCardFavoriteButton(btn, promptId) {
    const isFavorited = favorites.includes(promptId);
    if (isFavorited) {
        btn.classList.add('favorited');
    } else {
        btn.classList.remove('favorited');
    }
}

// ===== Favorites =====
function toggleFavorite(promptId) {
    const index = favorites.indexOf(promptId);
    if (index === -1) {
        favorites.push(promptId);
        showToast('Added to favorites');
    } else {
        favorites.splice(index, 1);
        showToast('Removed from favorites');
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));
}

function renderFavorites() {
    const grid = document.getElementById('favorites-grid');
    const emptyState = document.getElementById('empty-favorites');
    
    if (!grid) return;

    const favoritePrompts = prompts.filter(p => favorites.includes(p.id));

    if (favoritePrompts.length === 0) {
        grid.innerHTML = '';
        if (emptyState) emptyState.classList.add('show');
    } else {
        if (emptyState) emptyState.classList.remove('show');
        grid.innerHTML = favoritePrompts.map(prompt => createCardHTML(prompt)).join('');

        // Add event listeners to favorite cards
        grid.querySelectorAll('.gallery-card').forEach(card => {
            const promptId = parseInt(card.dataset.id);
            
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.card-icon-btn')) {
                    openPromptDetail(promptId);
                }
            });
        });

        grid.querySelectorAll('.card-favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const promptId = parseInt(btn.dataset.id);
                toggleFavorite(promptId);
                renderFavorites(); // Re-render after removing
            });
        });

        grid.querySelectorAll('.card-copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const promptId = parseInt(btn.dataset.id);
                const prompt = prompts.find(p => p.id === promptId);
                if (prompt) {
                    copyToClipboard(prompt.prompt);
                    btn.classList.add('copied');
                    setTimeout(() => btn.classList.remove('copied'), 1500);
                }
            });
        });
    }
}

// ===== Prompt Detail =====
function openPromptDetail(promptId) {
    const prompt = prompts.find(p => p.id === promptId);
    if (!prompt) return;

    currentPrompt = prompt;

    const detailImage = document.getElementById('detail-image');
    const detailPrompt = document.getElementById('detail-prompt');

    if (detailImage) detailImage.src = prompt.image;
    if (detailPrompt) detailPrompt.textContent = prompt.prompt;

    updateDetailFavoriteButton();
    showScreen('detail');
}

function updateDetailFavoriteButton() {
    const btn = document.getElementById('detail-favorite-btn');
    if (!btn || !currentPrompt) return;

    const isFavorited = favorites.includes(currentPrompt.id);
    
    if (isFavorited) {
        btn.classList.add('active');
        btn.innerHTML = `
            <svg class="heart-icon" width="20" height="20" viewBox="0 0 24 24" fill="#ff4757" stroke="#ff4757" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            Unfavorite
        `;
    } else {
        btn.classList.remove('active');
        btn.innerHTML = `
            <svg class="heart-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            Favorite
        `;
    }
}

// ===== Search =====
function searchPrompts(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;

    if (!query.trim()) {
        resultsContainer.innerHTML = '';
        return;
    }

    const results = prompts.filter(p => 
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.prompt.toLowerCase().includes(query.toLowerCase()) ||
        p.category.toLowerCase().includes(query.toLowerCase())
    );

    if (results.length === 0) {
        resultsContainer.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No prompts found</p>';
        return;
    }

    resultsContainer.innerHTML = `
        <div class="gallery-grid">
            ${results.map(prompt => createCardHTML(prompt)).join('')}
        </div>
    `;

    // Add event listeners to search result cards
    resultsContainer.querySelectorAll('.gallery-card').forEach(card => {
        const promptId = parseInt(card.dataset.id);
        
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.card-icon-btn')) {
                openPromptDetail(promptId);
            }
        });
    });

    resultsContainer.querySelectorAll('.card-favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const promptId = parseInt(btn.dataset.id);
            toggleFavorite(promptId);
            updateCardFavoriteButton(btn, promptId);
        });
    });

    resultsContainer.querySelectorAll('.card-copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const promptId = parseInt(btn.dataset.id);
            const prompt = prompts.find(p => p.id === promptId);
            if (prompt) {
                copyToClipboard(prompt.prompt);
                btn.classList.add('copied');
                setTimeout(() => btn.classList.remove('copied'), 1500);
            }
        });
    });
}

// ===== Theme =====
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeButtons(theme);
}

function updateThemeButtons(theme) {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === theme) {
            btn.classList.add('active');
        }
    });
}

// ===== Settings Actions =====
function setupSettingsListeners() {
    // Support the Dev (Tip Jar)
    const supportDevBtn = document.getElementById('support-dev-btn');
    if (supportDevBtn) {
        supportDevBtn.addEventListener('click', () => {
            document.getElementById('tip-jar-modal').classList.add('show');
        });
    }

    // Close tip jar modal
    const closeTipJar = document.getElementById('close-tip-jar');
    if (closeTipJar) {
        closeTipJar.addEventListener('click', () => {
            document.getElementById('tip-jar-modal').classList.remove('show');
        });
    }

    // Maybe later button
    const maybeLaterBtn = document.getElementById('maybe-later-btn');
    if (maybeLaterBtn) {
        maybeLaterBtn.addEventListener('click', () => {
            document.getElementById('tip-jar-modal').classList.remove('show');
        });
    }

    // Tip options
    document.querySelectorAll('.tip-option').forEach(option => {
        option.addEventListener('click', () => {
            const amount = option.dataset.amount;
            // In real app, this would trigger Google Play Billing
            console.log(`Tip selected: ₹${amount}`);
            document.getElementById('tip-jar-modal').classList.remove('show');
            document.getElementById('thank-you-modal').classList.add('show');
        });
    });

    // Continue browsing button
    const continueBtn = document.getElementById('continue-btn');
    if (continueBtn) {
        continueBtn.addEventListener('click', () => {
            document.getElementById('thank-you-modal').classList.remove('show');
        });
    }

    // Rate Us
    const rateUsBtn = document.getElementById('rate-us-btn');
    if (rateUsBtn) {
        rateUsBtn.addEventListener('click', () => {
            // In real app: market://details?id=com.yourapp.package
            window.open('https://play.google.com/store', '_blank');
            showToast('Thanks for rating us!');
        });
    }

    // Send Feedback
    const feedbackBtn = document.getElementById('feedback-btn');
    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', () => {
            openEmailOrFallback(
                'Feedback for Prompt Gallery App',
                'Hi,\n\nI would like to share my feedback about the Prompt Gallery app:\n\n[Your feedback here]\n\nThank you!'
            );
        });
    }

    // Report a Bug
    const bugReportBtn = document.getElementById('bug-report-btn');
    if (bugReportBtn) {
        bugReportBtn.addEventListener('click', () => {
            openEmailOrFallback(
                'Bug Report - Prompt Gallery App',
                `Hi,

I found a bug in the Prompt Gallery app.

Device: [Your device model]
Android Version: [Your Android version]

Steps to reproduce:
1. 
2. 
3. 

Expected behavior:
[What should happen]

Actual behavior:
[What actually happened]

Thank you!`
            );
        });
    }

    // Share App
    const shareAppBtn = document.getElementById('share-app-btn');
    if (shareAppBtn) {
        shareAppBtn.addEventListener('click', () => {
            const shareData = {
                title: 'Prompt Gallery',
                text: 'Check out this amazing AI Prompt Gallery app! Get curated prompts for stunning AI images.',
                url: 'https://play.google.com/store/apps/details?id=com.promptgallery.app'
            };
            
            if (navigator.share) {
                navigator.share(shareData);
            } else {
                copyToClipboard(shareData.url);
                showToast('Link copied to clipboard!');
            }
        });
    }

    // Close modals on overlay click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });

    // How to Use Button (in Settings)
    const howToUseBtn = document.getElementById('how-to-use-btn');
    if (howToUseBtn) {
        howToUseBtn.addEventListener('click', () => {
            document.getElementById('info-modal').classList.add('show');
        });
    }

    // Close How to Use Modal
    const closeInfo = document.getElementById('close-info');
    if (closeInfo) {
        closeInfo.addEventListener('click', () => {
            document.getElementById('info-modal').classList.remove('show');
        });
    }

    // Got It Button (How to Use Modal)
    const gotItBtn = document.getElementById('got-it-btn');
    if (gotItBtn) {
        gotItBtn.addEventListener('click', () => {
            document.getElementById('info-modal').classList.remove('show');
        });
    }

    // Privacy Policy Button
    const privacyBtn = document.getElementById('privacy-btn');
    if (privacyBtn) {
        privacyBtn.addEventListener('click', () => {
            document.getElementById('privacy-modal').classList.add('show');
        });
    }

    // Close Privacy Modal
    const closePrivacy = document.getElementById('close-privacy');
    if (closePrivacy) {
        closePrivacy.addEventListener('click', () => {
            document.getElementById('privacy-modal').classList.remove('show');
        });
    }

    // Privacy OK Button
    const privacyOkBtn = document.getElementById('privacy-ok-btn');
    if (privacyOkBtn) {
        privacyOkBtn.addEventListener('click', () => {
            document.getElementById('privacy-modal').classList.remove('show');
        });
    }
}

// ===== Utility Functions =====
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Prompt copied!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Prompt copied!');
    });
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = toast.querySelector('.toast-message');
    
    if (toastMessage) toastMessage.textContent = message;
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// ===== Email Helper with Fallback =====
function openEmailOrFallback(subject, body) {
    const email = 'balajik100@gmail.com';
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Try to open mailto link
    const mailtoWindow = window.open(mailtoLink, '_self');
    
    // Set a timeout to show fallback if mailto doesn't work
    setTimeout(() => {
        // Show fallback modal with email info
        showEmailFallbackModal(email, subject);
    }, 500);
}

function showEmailFallbackModal(email, subject) {
    // Check if modal already exists
    let modal = document.getElementById('email-fallback-modal');
    
    if (!modal) {
        // Create the modal
        modal = document.createElement('div');
        modal.id = 'email-fallback-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content info-modal-content">
                <div class="modal-header">
                    <h2>📧 Contact Us</h2>
                    <button class="close-modal" id="close-email-fallback">×</button>
                </div>
                <div class="modal-body info-body">
                    <div class="info-section">
                        <span class="info-emoji">📬</span>
                        <p>Send your message to:</p>
                    </div>
                    <div style="background: var(--bg-primary); padding: 16px; border-radius: 12px; margin: 16px 0; text-align: center;">
                        <p style="font-size: 16px; font-weight: 600; color: var(--accent-color); word-break: break-all;" id="fallback-email">${email}</p>
                    </div>
                    <div class="info-section">
                        <span class="info-emoji">📋</span>
                        <p>Subject: <strong id="fallback-subject">${subject}</strong></p>
                    </div>
                    <button class="got-it-btn" id="copy-email-btn" style="margin-top: 16px;">
                        📋 Copy Email Address
                    </button>
                    <button class="maybe-later-btn" id="open-gmail-btn" style="margin-top: 8px; color: var(--accent-color);">
                        Open Gmail Web
                    </button>
                </div>
            </div>
        `;
        document.querySelector('.app-container').appendChild(modal);
        
        // Add event listeners
        document.getElementById('close-email-fallback').addEventListener('click', () => {
            modal.classList.remove('show');
        });
        
        document.getElementById('copy-email-btn').addEventListener('click', () => {
            copyToClipboard(email);
            showToast('Email copied!');
        });
        
        document.getElementById('open-gmail-btn').addEventListener('click', () => {
            window.open(`https://mail.google.com/mail/?view=cm&to=${email}&su=${encodeURIComponent(subject)}`, '_blank');
            modal.classList.remove('show');
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    } else {
        // Update existing modal content
        document.getElementById('fallback-email').textContent = email;
        document.getElementById('fallback-subject').textContent = subject;
    }
    
    modal.classList.add('show');
}
