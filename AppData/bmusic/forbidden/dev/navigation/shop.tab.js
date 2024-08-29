// For Shop the conatiner
function popupShop() {
    document.getElementById(
        "popup-shop"
    ).style.display = "block";
}
function closeShop() {
    document.getElementById(
        "popup-shop"
    ).style.display = "none";
}

/* Dragging Shop */

document.addEventListener('DOMContentLoaded', () => {
    const popups = document.querySelectorAll('.pop-shop-window');

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

// Shop Tabs

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.store-categories-tabs7 li');
    
    function setActiveTab(selectedTab) {
        // Remove 'active-tab' class from all tabs
        tabs.forEach(tab => tab.classList.remove('active-tab'));
        
        // Add 'active-tab' class to the selected tab
        selectedTab.classList.add('active-tab');
    }

    // Set the default active tab
    setActiveTab(tabs[0]); // Set the first tab as default active

    // Add click event listeners to all tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            setActiveTab(tab);
        });
    });
});

// Shop Seaerch Address

// For Shop the conatiner
function popupShopSearch() {
    document.getElementById(
        "popup-search-container"
    ).style.display = "block";
}
function closeShopSearch() {
    document.getElementById(
        "popup-search-container"
    ).style.display = "none";
}

// Shop search bar manifest

// For manifest search result ""

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('shop-address1');
    const ul = document.querySelector('.search-suggest-result');
    const listItems = document.querySelectorAll('.search-suggest-items');

    // Function to filter and show list items based on search input
    function filterList() {
        const searchTerm = searchInput.value.toLowerCase(); // Get the search term in lowercase

        listItems.forEach(item => {
            const itemText = item.textContent.toLowerCase(); // Get the text of each item in lowercase
            if (itemText.includes(searchTerm)) {
                item.style.display = ''; // Show item if it matches the search term
            } else {
                item.style.display = 'none'; // Hide item if it doesn't match
            }
        });
    }

    // Add event listener to search input to filter list items on input
    searchInput.addEventListener('input', filterList);
});