// 書庫相關元素
const libraryList = document.getElementById('libraryList');
const librarySearchInput = document.getElementById('librarySearchInput');
const librarySortSelect = document.getElementById('librarySortSelect');
const toggleEditBtn = document.getElementById('toggleEditBtn');
const batchEditControls = document.getElementById('batchEditControls');
const selectAllBtn = document.getElementById('selectAllBtn');
const batchDeleteBtn = document.getElementById('batchDeleteBtn');
const batchSeriesInput = document.getElementById('batchSeriesInput');
const batchSeriesBtn = document.getElementById('batchSeriesBtn');

// 側邊欄元素
const navHome = document.getElementById('navHome');
const navSearch = document.getElementById('navSearch');
const navLibrary = document.getElementById('navLibrary');
const themeToggle = document.getElementById('themeToggle');

// 書庫數據
let localBooks = [];
let filteredLocalBooks = [];
let editMode = false;
let selectedBooks = new Set(); // 儲存選取的書籍 ISBN

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

// ===== 側邊欄導航 =====
navHome.addEventListener('click', () => { location.href = 'index.html#home'; });
navSearch.addEventListener('click', () => { location.href = 'index.html#search'; });
navLibrary.addEventListener('click', () => { location.href = 'library.html'; });

// ===== 書庫功能 =====
async function loadLocalBooks() {
    try {
        const res = await fetch('./books.json');
        localBooks = await res.json();
        filteredLocalBooks = [...localBooks];
        displayLocalBooks();
    } catch (e) {
        console.error("無法載入本地書庫:", e);
        libraryList.innerHTML = '<p>無法載入書庫，請確認 books.json 檔案是否存在。</p>';
    }
}

function displayLocalBooks() {
    libraryList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    filteredLocalBooks.forEach((book, index) => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.dataset.index = localBooks.findIndex(b => b['ISBN'] === book['ISBN']);
        card.dataset.isbn = book['ISBN'];

        // 檢查是否選取
        if (selectedBooks.has(book['ISBN'])) {
            card.classList.add('selected');
        }

        const authors = (book['作者'] || '');
        const illustrators = (book['繪者'] || '');
        const bookCategory = book['類別'] || '';
        
        let authorAndIllustratorHtml = `<p>${authors}</p>`;
        if (bookCategory !== '漫畫' && illustrators) {
            authorAndIllustratorHtml = `<p>${authors} / ${illustrators}</p>`;
        }
        
        card.innerHTML = `
            <img src="${(book['封面圖片']||'').replace(/\\/g,'/')}" alt="封面">
            <h3>${book['書名']}</h3>
            ${authorAndIllustratorHtml}
            ${editMode ? `<i class='bx bx-check-circle checkmark' style='display:${selectedBooks.has(book['ISBN']) ? 'block' : 'none'};'></i>` : ''}
        `;
        
        card.addEventListener('click', () => {
            if (editMode) {
                // 編輯模式：切換選取狀態
                if (selectedBooks.has(book['ISBN'])) {
                    selectedBooks.delete(book['ISBN']);
                    card.classList.remove('selected');
                    card.querySelector('.checkmark').style.display = 'none';
                } else {
                    selectedBooks.add(book['ISBN']);
                    card.classList.add('selected');
                    card.querySelector('.checkmark').style.display = 'block';
                }
                updateBatchButtonState();
            } else {
                // 💡 正常模式：顯示模態框
                showBookDetailsModal(book);
            }
        });

        fragment.appendChild(card);
    });
    libraryList.appendChild(fragment);
}


function sortLocalBooks() {
    const sortBy = librarySortSelect.value;
    if (sortBy === 'default') {
        filteredLocalBooks = [...localBooks];
    } else if (sortBy === 'title') {
        filteredLocalBooks.sort((a, b) => (a['書名'] || '').localeCompare(b['書名'] || '', 'zh-TW'));
    } else if (sortBy === 'author') {
        filteredLocalBooks.sort((a, b) => (a['作者'] || '').localeCompare(b['作者'] || '', 'zh-TW'));
    }
    displayLocalBooks();
}

function filterLocalBooks() {
    const searchTerm = librarySearchInput.value.toLowerCase().trim();
    if (!searchTerm) {
        filteredLocalBooks = [...localBooks];
    } else {
        filteredLocalBooks = localBooks.filter(book =>
            (book['書名'] && book['書名'].toLowerCase().includes(searchTerm)) ||
            (book['作者'] && book['作者'].toLowerCase().includes(searchTerm)) ||
            (book['日文書名'] && book['日文書名'].toLowerCase().includes(searchTerm))
        );
    }
    sortLocalBooks();
}

function toggleEditMode() {
    editMode = !editMode;
    selectedBooks.clear();
    displayLocalBooks();

    if (editMode) {
        toggleEditBtn.innerHTML = `<i class='bx bx-exit-fullscreen'></i> 完成`;
        batchEditControls.style.display = 'flex';
    } else {
        toggleEditBtn.innerHTML = `<i class='bx bx-edit-alt'></i> 編輯`;
        batchEditControls.style.display = 'none';
    }
    updateBatchButtonState();
}

function updateBatchButtonState() {
    const hasSelection = selectedBooks.size > 0;
    batchDeleteBtn.disabled = !hasSelection;
    batchSeriesBtn.disabled = !hasSelection;
    if (!hasSelection) {
      batchDeleteBtn.style.opacity = '0.7';
      batchSeriesBtn.style.opacity = '0.7';
    } else {
      batchDeleteBtn.style.opacity = '1';
      batchSeriesBtn.style.opacity = '1';
    }
}

function handleBatchDelete() {
    if (!confirm(`確定要刪除這 ${selectedBooks.size} 本書嗎？`)) {
        return;
    }

    // 移除選取的書籍
    localBooks = localBooks.filter(book => !selectedBooks.has(book['ISBN']));
    
    // 清空選取並重新顯示
    selectedBooks.clear();
    filterLocalBooks();
    updateBatchButtonState();
}

function handleBatchSeriesUpdate() {
    const newSeries = batchSeriesInput.value.trim();
    if (!newSeries) {
        alert("請輸入要更新的叢書系列名稱。");
        return;
    }
    
    // 更新選取的書籍
    localBooks.forEach(book => {
        if (selectedBooks.has(book['ISBN'])) {
            book['叢書系列'] = newSeries;
        }
    });

    // 清空選取並重新顯示
    selectedBooks.clear();
    batchSeriesInput.value = '';
    filterLocalBooks();
    updateBatchButtonState();
}

function handleSelectAll() {
    if (selectedBooks.size === filteredLocalBooks.length) {
        selectedBooks.clear(); // 全部取消選取
    } else {
        filteredLocalBooks.forEach(book => selectedBooks.add(book['ISBN']));
    }
    displayLocalBooks();
    updateBatchButtonState();
}

// 事件監聽
librarySearchInput.addEventListener('input', filterLocalBooks);
librarySortSelect.addEventListener('change', filterLocalBooks);
toggleEditBtn.addEventListener('click', toggleEditMode);
selectAllBtn.addEventListener('click', handleSelectAll);
batchDeleteBtn.addEventListener('click', handleBatchDelete);
batchSeriesBtn.addEventListener('click', handleBatchSeriesUpdate);

// 初始載入
loadLocalBooks();