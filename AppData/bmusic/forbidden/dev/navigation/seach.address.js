// Drag the search Address container 

document.addEventListener('DOMContentLoaded', () => {
    const popups = document.querySelectorAll('.dragable-search-add');

    popups.forEach(popup => {
        let isDragging = false;
        let offsetX, offsetY;

        popup.addEventListener('mousedown', (e) => {
            // Start dragging
            isDragging = true;

            // Calculate the offset
            offsetX = e.clientX - popup.offsetLeft;
            offsetY = e.clientY - popup.offsetTop;
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                // Prevent text selection while dragging
                e.preventDefault();

                // Move the pop-up
                popup.style.left = `${e.clientX - offsetX}px`;
                popup.style.top = `${e.clientY - offsetY}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            // Stop dragging
            isDragging = false;
        });
    });
});

// Pop the search address container and implements close toggle
function popupSearch() {
    document.getElementById(
        "seach-address-main"
    ).style.display = "block";
}
function closeSearch() {
    document.getElementById(
        "seach-address-main"
    ).style.display = "none";
}


// Search history

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('bmusic-search');
    const searchHistoryList = document.getElementById('search-history-list');

    // Function to create and append a search history item
    function addSearchHistoryItem(keyword) {
        const li = document.createElement('li');
        li.className = 'searched-his-profile';

        const div = document.createElement('div');
        div.className = 'search-his-header';

        const span = document.createElement('span');
        span.className = 'search-his-tx';
        span.textContent = keyword;

        const button = document.createElement('button');
        button.className = 'remove-search-his';

        const img = document.createElement('img');
        img.className = 'remove-search-his-img-icon';
        img.alt = '';
        img.src = './public/removesearchhisimg.svg';

        button.appendChild(img);
        div.appendChild(span);
        li.appendChild(div);
        li.appendChild(button);
        searchHistoryList.appendChild(li);

        // Event listener for removing the search history item
        button.addEventListener('click', () => {
            searchHistoryList.removeChild(li);
        });
    }

    // Event listener for capturing the search input
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim() !== '') {
            addSearchHistoryItem(searchInput.value.trim());
            searchInput.value = ''; // Clear the search input
        }
    });
});

// Search music displayer
