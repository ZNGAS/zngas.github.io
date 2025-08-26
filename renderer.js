// 左側選單元素
const navHome = document.getElementById('navHome');
const navSearch = document.getElementById('navSearch');
const navLibrary = document.getElementById('navLibrary');

const homeSection = document.getElementById('homeSection');
const searchSection = document.getElementById('searchSection');

// 搜尋相關
const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
const results = document.getElementById('results');
const sortSelect = document.getElementById('sortSelect');

const themeToggle = document.getElementById('themeToggle');

let currentData = [];   // 暫存 API 搜尋結果
let localBooks = [];    // 本地 JSON 書庫

// ==== 模態框相關 ====
const bookModal = document.getElementById('bookModal');
const closeModalBtn = document.getElementById('closeModalBtn');

function showBookDetailsModal(book) {
    // 💡 填充模態框內容
    document.getElementById('bookCover').src = (book['封面圖片'] || '').replace(/\\/g, '/');
    document.getElementById('bookName').textContent = book['書名'] || '';
    document.getElementById('bookNameJP').textContent = book['日文書名'] || '';
    document.getElementById('bookAuthor').textContent = book['作者'] || '';
    
    // 繪者欄位處理
    const illustratorRow = document.getElementById('illustrator-row');
    if (book['類別'] === '漫畫') {
        illustratorRow.style.display = 'none';
    } else {
        illustratorRow.style.display = '';
        document.getElementById('bookIllustrator').textContent = book['繪者'] || '';
    }
    
    document.getElementById('bookPublisher').textContent = book['出版社'] || '';
    document.getElementById('bookDate').textContent = book['出版日期'] || '';
    document.getElementById('bookLang').textContent = book['語言'] || '';
    document.getElementById('bookPrice').textContent = book['定價'] || '';
    document.getElementById('bookISBN').textContent = book['ISBN'] || '';
    document.getElementById('bookSpec').textContent = book['規格'] || '';
    document.getElementById('bookSeries').textContent = book['叢書系列'] || '';
    document.getElementById('bookCategory').textContent = book['類別'] || '';
    document.getElementById('bookDesc').textContent = (book['簡介'] || '').replace(/\\n/g, '\n');

    bookModal.classList.add('show');
}

function closeBookDetailsModal() {
    bookModal.classList.remove('show');
}

// 事件監聽器
closeModalBtn.addEventListener('click', closeBookDetailsModal);
bookModal.addEventListener('click', (e) => {
    if (e.target.id === 'bookModal') {
        closeBookDetailsModal();
    }
});


// ===== 主題切換 =====
themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// ===== 左側選單切換 =====
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');

    document.querySelectorAll('.nav-list li').forEach(li => {
        li.classList.remove('active');
    });
    const navItem = document.getElementById('nav' + sectionId.replace('Section', ''));
    if (navItem) {
        navItem.classList.add('active');
    }
}

navHome.addEventListener('click', () => { showSection('homeSection'); });
navSearch.addEventListener('click', () => { showSection('searchSection'); });
navLibrary.addEventListener('click', () => { location.href = 'library.html'; });

// 根據 URL 錨點切換頁面
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.substring(1);
    if (hash === 'home' || hash === '') {
        showSection('homeSection');
    } else if (hash === 'search') {
        showSection('searchSection');
    } else {
        // 如果 hash 不明，則回到首頁
        showSection('homeSection');
    }
});

// 初始載入
window.addEventListener('load', () => {
    const hash = window.location.hash.substring(1);
    if (hash === 'search') {
        showSection('searchSection');
    } else {
        showSection('homeSection');
    }
    loadLocalBooksForDashboard();
});


// ===== 儀表板資料 =====
async function loadLocalBooksForDashboard() {
    try {
        const res = await fetch('./books.json');
        localBooks = await res.json();
        document.getElementById('totalBooks').textContent = localBooks.length;
        // 未來可在這裡計算我的最愛和最近瀏覽
    } catch (e) {
        console.error("無法載入儀表板數據:", e);
        document.getElementById('totalBooks').textContent = 'Error';
    }
}

// ===== 搜尋功能 =====
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        performSearch();
    }
});
sortSelect.addEventListener('change', sortResults);

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        results.innerHTML = '<p>請輸入搜尋關鍵字。</p>';
        return;
    }
    results.innerHTML = '<p>搜尋中...</p>';
    
    try {
        const res = await fetch('./books.json');
        const books = await res.json();
        currentData = books.filter(book => 
            (book['書名'] && book['書名'].includes(query)) || 
            (book['作者'] && book['作者'].includes(query)) ||
            (book['日文書名'] && book['日文書名'].includes(query))
        );
        sortResults();
    } catch (e) {
        results.innerHTML = '<p>搜尋失敗，請檢查 books.json 檔案。</p>';
        console.error(e);
    }
}

function sortResults() {
    const sortBy = sortSelect.value;
    if (sortBy === 'newest') {
        currentData.sort((a, b) => new Date(b['出版日期']) - new Date(a['出版日期']));
    } else if (sortBy === 'oldest') {
        currentData.sort((a, b) => new Date(a['出版日期']) - new Date(b['出版日期']));
    }
    displayResults(currentData);
}

function displayResults(books) {
    if (books.length === 0) {
        results.innerHTML = '<p>沒有找到符合的書籍。</p>';
        return;
    }

    results.innerHTML = '';
    books.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `
            <img src="${(book['封面圖片']||'').replace(/\\/g,'/')}" alt="封面">
            <h3>${book['書名']}</h3>
            <p>${book['作者']}</p>
        `;
        // 💡 點擊卡片顯示模態框
        card.addEventListener('click', () => {
             showBookDetailsModal(book);
        });
        results.appendChild(card);
    });
}