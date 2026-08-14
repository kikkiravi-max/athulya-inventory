// ===== CONFIGURATION =====
const API_URL = 'https://script.google.com/macros/s/AKfycbyxL6VRMzFJrGRX8t4pnXElMLw9MuvX_rnELS1waKyxiKX_3bDPLU5P156ReDfQcoM/exec';

// ===== CATEGORY CODE MAPPING =====
const CATEGORY_CODES = {
    'Saree': 'SA',
    'Salwar Material': 'SM',
    'Coord Sets': 'CS',
    'Readymade Kurti': 'RK',
    'Readymade Salwar': 'RS',
    'Shrug': 'SH',
    'Fabric': 'FA',
    'Other': 'OT'
};

// ===== STATE =====
let currentFilter = 'all';
let allProducts = [];
let productToDelete = null;

// ===== API LAYER =====
const API = {
    /**
     * Get all products from Google Sheets
     */
    async getAll() {
        try {
            const response = await fetch(`${API_URL}?action=getAll`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch products');
            }
            
            return data.products || [];
        } catch (error) {
            console.error('API Error (getAll):', error);
            showToast('Could not connect to inventory database. Please check your connection.', 'error');
            throw error;
        }
    },

    /**
     * Add a new product
     */
    async addProduct(code, description, price, sellingPrice) {
        try {
            const params = new URLSearchParams();
            params.append('action', 'add');
            params.append('code', code.trim());
            params.append('description', description);
            params.append('price', price);
            params.append('sellingPrice', sellingPrice || '');

            const response = await fetch(`${API_URL}?${params.toString()}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to add product');
            }

            return data;
        } catch (error) {
            console.error('API Error (addProduct):', error);
            // Handle network/connection errors
            if (error instanceof TypeError) {
                throw new Error('Could not connect to inventory database. Please check your connection.');
            }
            throw error;
        }
    },

    /**
     * Sell a product
     */
    async sellProduct(code, sellingPrice) {
        try {
            const params = new URLSearchParams();
            params.append('action', 'sell');
            params.append('code', code.trim());
            params.append('sellingPrice', sellingPrice);

            const response = await fetch(`${API_URL}?${params.toString()}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to sell product');
            }

            return data;
        } catch (error) {
            console.error('API Error (sellProduct):', error);
            throw error;
        }
    },

    /**
     * Delete a product
     */
    async deleteProduct(code) {
        try {
            const params = new URLSearchParams();
            params.append('action', 'delete');
            params.append('code', code.trim());

            const response = await fetch(`${API_URL}?${params.toString()}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to delete product');
            }

            return data;
        } catch (error) {
            console.error('API Error (deleteProduct):', error);
            throw error;
        }
    },

    /**
     * Delete all inventory (password protected)
     */
    async deleteAllInventory(password) {
        try {
            const formData = new FormData();
            formData.append('action', 'deleteAll');
            formData.append('password', password);

            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to delete inventory');
            }

            return data;
        } catch (error) {
            console.error('API Error (deleteAllInventory):', error);
            throw error;
        }
    }
};

// ===== NAVIGATION =====
function navigateTo(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Show target page
    document.getElementById(pageId).classList.add('active');

    // Reset scroll position
    window.scrollTo(0, 0);

    // Page-specific initialization
    if (pageId === 'viewPage') {
        loadViewStock();
    } else if (pageId === 'addPage') {
        const form = document.getElementById('add-stock-form');
        if (form) {
            form.reset();
        }
        // Reset prefix and description to defaults
        const codePrefix = document.getElementById('codePrefix');
        const descriptionSelect = document.getElementById('addDescription');
        if (codePrefix) {
            codePrefix.textContent = CATEGORY_CODES['Saree'];
        }
        if (descriptionSelect) {
            descriptionSelect.value = 'Saree';
        }
    } else if (pageId === 'sellPage') {
        document.getElementById('sellSearchCode').value = '';
        document.getElementById('sellProductInfo').classList.add('hidden');
        document.getElementById('sellNoProductMessage').classList.add('hidden');
    }
}

// ===== PAGE: ADD NEW STOCK =====
// Form submit handler will be attached in DOMContentLoaded

async function handleAddStock(event) {
    event.preventDefault();

    const addStockBtn = document.getElementById('addStockBtn');
    const originalBtnText = addStockBtn.textContent;
    
    try {
        // Show loading state
        addStockBtn.textContent = 'Saving...';
        addStockBtn.disabled = true;

        const suffix = document.getElementById('addCodeSuffix').value.trim();
        const prefix = document.getElementById('codePrefix').textContent;
        const code = prefix + suffix;
        const description = document.getElementById('addDescription').value;
        const price = parseFloat(document.getElementById('addPrice').value);
        const sellingPrice = document.getElementById('addSellingPrice').value;

        // Frontend validation
        if (!suffix) {
            showToast('Product code suffix is required.', 'error');
            addStockBtn.textContent = originalBtnText;
            addStockBtn.disabled = false;
            return;
        }

        if (!price || price <= 0) {
            showToast('Original price must be a valid positive number.', 'error');
            addStockBtn.textContent = originalBtnText;
            addStockBtn.disabled = false;
            return;
        }

        if (sellingPrice && parseFloat(sellingPrice) < 0) {
            showToast('Selling price must be a valid number.', 'error');
            addStockBtn.textContent = originalBtnText;
            addStockBtn.disabled = false;
            return;
        }

        // Call API to add product
        const result = await API.addProduct(code, description, price, sellingPrice);
        
        // Success
        showToast('Product added successfully.', 'success');
        
        // Reset form
        document.getElementById('add-stock-form').reset();
        
        // Reset prefix to default (SA)
        document.getElementById('codePrefix').textContent = CATEGORY_CODES['Saree'];
        document.getElementById('addDescription').value = 'Saree';
        
        // Refresh inventory
        await API.getAll();
        
    } catch (error) {
        // Check if it's a duplicate error
        if (error.message && error.message.includes('already exists')) {
            showToast('Product code already exists. Please enter a different code.', 'error');
        } else if (error.message && error.message.includes('Could not connect')) {
            showToast('Could not connect to inventory database. Please check your connection.', 'error');
        } else {
            showToast(error.message || 'Failed to add product.', 'error');
        }
    } finally {
        // Restore button state
        addStockBtn.textContent = originalBtnText;
        addStockBtn.disabled = false;
    }
}

// ===== PAGE: SELL PRODUCT =====
document.getElementById('sellSearchCode')?.addEventListener('input', async (e) => {
    const searchCode = e.target.value.trim().toLowerCase();

    if (!searchCode) {
        document.getElementById('sellProductInfo').classList.add('hidden');
        document.getElementById('sellNoProductMessage').classList.add('hidden');
        return;
    }

    try {
        const products = await API.getAll();
        // Support partial code searches (case-insensitive)
        const product = products.find(p => 
            p.code && p.code.trim().toLowerCase().includes(searchCode)
        );

        if (product) {
            // Show product info
            document.getElementById('sellInfoCode').textContent = product.code;
            document.getElementById('sellInfoDescription').textContent = product.description;
            document.getElementById('sellInfoPrice').textContent = `₹${parseFloat(product.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            
            const statusText = product.status === 'Sold' ? '✓ SOLD' : 'Available';
            document.getElementById('sellInfoStatus').textContent = statusText;
            document.getElementById('sellInfoStatus').style.color = product.status === 'Sold' ? '#c2185b' : '#2e7d32';

            document.getElementById('sellProductInfo').classList.remove('hidden');
            document.getElementById('sellNoProductMessage').classList.add('hidden');

            // Pre-fill selling price if already has one
            if (product.sellingPrice) {
                document.getElementById('sellSellingPrice').value = product.sellingPrice;
            } else {
                document.getElementById('sellSellingPrice').value = '';
            }
        } else {
            document.getElementById('sellProductInfo').classList.add('hidden');
            document.getElementById('sellNoProductMessage').classList.remove('hidden');
        }
    } catch (error) {
        document.getElementById('sellProductInfo').classList.add('hidden');
        document.getElementById('sellNoProductMessage').classList.remove('hidden');
    }
});

async function markAsSold() {
    const code = document.getElementById('sellSearchCode').value.trim();
    const sellingPrice = document.getElementById('sellSellingPrice').value;

    if (!code) {
        showToast('Please search for a product first.', 'error');
        return;
    }

    if (!sellingPrice || parseFloat(sellingPrice) < 0) {
        showToast('Selling price must be a valid number.', 'error');
        return;
    }

    // Check if product is already sold
    const product = document.getElementById('sellInfoStatus');
    if (product && product.textContent.includes('SOLD')) {
        showToast('This product is already sold. Please search for a different product.', 'error');
        return;
    }

    try {
        const result = await API.sellProduct(code, sellingPrice);
        showToast(`Product marked as sold.`, 'success');
        
        // Clear search and refresh
        document.getElementById('sellSearchCode').value = '';
        document.getElementById('sellProductInfo').classList.add('hidden');
        document.getElementById('sellNoProductMessage').classList.add('hidden');

        // Refresh inventory
        await API.getAll();
    } catch (error) {
        if (error.message.includes('already sold')) {
            showToast('This product is already sold. Please search for a different product.', 'error');
        } else {
            showToast(error.message || 'Failed to mark product as sold.', 'error');
        }
    }
}

// ===== PAGE: VIEW STOCK =====
async function loadViewStock() {
    try {
        document.getElementById('stockTableContainer').innerHTML = '<p class="loading">Loading inventory...</p>';
        allProducts = await API.getAll();
        displayStock();
    } catch (error) {
        document.getElementById('stockTableContainer').innerHTML = '<p class="loading">Could not load inventory.</p>';
    }
}

function applyFilter(filter) {
    currentFilter = filter;

    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    displayStock();
}

function displayStock() {
    const searchTerm = document.getElementById('viewSearchCode')?.value.trim().toLowerCase() || '';

    // Filter products
    let filtered = allProducts;

    // Apply status filter
    if (currentFilter === 'available') {
        filtered = filtered.filter(p => p.status !== 'Sold');
    } else if (currentFilter === 'sold') {
        filtered = filtered.filter(p => p.status === 'Sold');
    }

    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(p =>
            p.code && p.code.trim().toLowerCase().includes(searchTerm)
        );
    }

    // Display results
    if (filtered.length === 0) {
        document.getElementById('stockTableContainer').innerHTML = '';
        document.getElementById('stockNoResults').classList.remove('hidden');
        return;
    }

    document.getElementById('stockNoResults').classList.add('hidden');

    // Determine if desktop or mobile
    const isDesktop = window.innerWidth > 768;

    if (isDesktop) {
        displayStockTable(filtered);
    } else {
        displayStockCards(filtered);
    }
}

function displayStockTable(products) {
    const tableHTML = `
        <table class="stock-table">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Description</th>
                    <th>Original Price</th>
                    <th>Selling Price</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${products.map(p => `
                    <tr>
                        <td><strong>${escapeHtml(p.code)}</strong></td>
                        <td>${escapeHtml(p.description)}</td>
                        <td>₹${parseFloat(p.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>${p.sellingPrice ? '₹' + parseFloat(p.sellingPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
                        <td>
                            <span class="status-badge ${p.status === 'Sold' ? 'sold' : 'available'}">
                                ${p.status === 'Sold' ? '✓ SOLD' : 'Available'}
                            </span>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    document.getElementById('stockTableContainer').innerHTML = tableHTML;
}

function displayStockCards(products) {
    const cardsHTML = products.map(p => `
        <div class="stock-card">
            <div class="stock-card-code">${escapeHtml(p.code)}</div>
            <div class="stock-card-desc">${escapeHtml(p.description)}</div>
            <div class="stock-card-prices">
                <strong>Original Price:</strong> ₹${parseFloat(p.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br>
                <strong>Selling Price:</strong> ${p.sellingPrice ? '₹' + parseFloat(p.sellingPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
            </div>
            <span class="status-badge stock-card-status ${p.status === 'Sold' ? 'sold' : 'available'}">
                ${p.status === 'Sold' ? '✓ SOLD' : 'Available'}
            </span>
        </div>
    `).join('');

    document.getElementById('stockTableContainer').innerHTML = cardsHTML;
}

// ===== SEARCH IN VIEW STOCK =====
document.getElementById('viewSearchCode')?.addEventListener('input', () => {
    displayStock();
});



// ===== MODALS =====
function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// Close modal when clicking overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function() {
        const modal = this.closest('.modal');
        modal.classList.add('hidden');
    });
});

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ===== UTILITY FUNCTIONS =====
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ===== RESPONSIVE HANDLING =====
window.addEventListener('resize', () => {
    if (document.getElementById('viewPage').classList.contains('active')) {
        displayStock();
    }
});

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the product code prefix
    const descriptionSelect = document.getElementById('addDescription');
    const codePrefix = document.getElementById('codePrefix');
    const addStockForm = document.getElementById('add-stock-form');
    
    // Set initial prefix to SA (Saree default)
    if (codePrefix) {
        codePrefix.textContent = CATEGORY_CODES['Saree'] || 'SA';
    }
    
    // Update prefix when description changes
    if (descriptionSelect) {
        descriptionSelect.addEventListener('change', (e) => {
            const selectedCategory = e.target.value;
            const newPrefix = CATEGORY_CODES[selectedCategory];
            
            if (codePrefix && newPrefix) {
                codePrefix.textContent = newPrefix;
            }
        });
    }
    
    // Attach form submit handler to Add Stock form
    if (addStockForm) {
        addStockForm.addEventListener('submit', handleAddStock);
    }
    
    // Navigate to home page
    navigateTo('homePage');
});
