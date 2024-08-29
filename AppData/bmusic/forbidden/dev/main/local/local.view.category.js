// Local View Category

document.addEventListener('DOMContentLoaded', () => {
    const authorSpan = document.getElementById('openLocalCateg');
    const popup = document.getElementById('popupLocalMusic');

    // Function to show the pop-up
    function showPopup() {
        popup.style.display = 'block';
    }

    // Function to hide the pop-up
    function hidePopup() {
        popup.style.display = 'none';
    }

    // Event listener for hovering over the author span
    authorSpan.addEventListener('mouseenter', showPopup);

    // Event listener for leaving the author span
    authorSpan.addEventListener('mouseleave', (event) => {
        // Set a timeout to allow for moving the mouse to the pop-up
        setTimeout(() => {
            if (!popup.contains(event.relatedTarget)) {
                hidePopup();
            }
        }, 100);
    });

    // Event listener for hovering over the pop-up
    popup.addEventListener('mouseenter', showPopup);

    // Event listener for leaving the pop-up
    popup.addEventListener('mouseleave', hidePopup);
});




// Styling of sorting views

document.addEventListener('DOMContentLoaded', () => {
    const sortOptions = document.querySelectorAll('.local-view-toggle-dialog-items4 .alphabet-a-z-view4');
    const musicDisplayer = document.getElementById('music-displayer');

    sortOptions.forEach(option => {
        option.addEventListener('click', () => {
            const sortCriterion = option.getAttribute('data-sort');
            const musicItems = Array.from(musicDisplayer.getElementsByTagName('li')); // Ensure fresh array
            sortMusicList(sortCriterion, musicItems);
        });
    });

    function sortMusicList(criterion, items) {
        let sortedItems;

        switch (criterion) {
            case 'az':
                sortedItems = items.sort((a, b) => {
                    const titleA = a.querySelector('.local-music-title').textContent.toUpperCase();
                    const titleB = b.querySelector('.local-music-title').textContent.toUpperCase();
                    return titleA.localeCompare(titleB);
                });
                break;
            case 'za':
                sortedItems = items.sort((a, b) => {
                    const titleA = a.querySelector('.local-music-title').textContent.toUpperCase();
                    const titleB = b.querySelector('.local-music-title').textContent.toUpperCase();
                    return titleB.localeCompare(titleA);
                });
                break;
            case 'year':
                sortedItems = items.sort((a, b) => {
                    const yearA = parseInt(a.querySelector('.local-music-year').textContent, 10);
                    const yearB = parseInt(b.querySelector('.local-music-year').textContent, 10);
                    return yearA - yearB;
                });
                break;
            case 'year-desc':
                sortedItems = items.sort((a, b) => {
                    const yearA = parseInt(a.querySelector('.local-music-year').textContent, 10);
                    const yearB = parseInt(b.querySelector('.local-music-year').textContent, 10);
                    return yearB - yearA;
                });
                break;
            case 'time':
                sortedItems = items.sort((a, b) => {
                    const timeA = a.querySelector('.local-music-time').textContent.split(':').map(Number);
                    const timeB = b.querySelector('.local-music-time').textContent.split(':').map(Number);
                    return (timeA[0] * 3600 + timeA[1] * 60 + timeA[2]) - (timeB[0] * 3600 + timeB[1] * 60 + timeB[2]);
                });
                break;
            case 'recent':
                // Add a placeholder if you don't have recent added date logic
                sortedItems = items.sort((a, b) => {
                    // Placeholder logic - adjust as needed
                    const dateA = new Date(a.querySelector('.local-music-added-date')?.textContent || 0);
                    const dateB = new Date(b.querySelector('.local-music-added-date')?.textContent || 0);
                    return dateB - dateA;
                });
                break;
            case 'yesterday':
                // Add placeholder logic if needed
                sortedItems = items.sort((a, b) => {
                    // Placeholder logic - adjust as needed
                    const dateA = new Date(a.querySelector('.local-music-added-date')?.textContent || 0);
                    const dateB = new Date(b.querySelector('.local-music-added-date')?.textContent || 0);
                    return dateB - dateA;
                });
                break;
            case 'cover':
                // Assuming cover sorting is not implemented
                sortedItems = items; // No sorting applied
                break;
            default:
                sortedItems = items; // Default case returns original order
        }

        // Remove existing items from the musicDisplayer
        musicDisplayer.innerHTML = '';

        // Append sorted items
        sortedItems.forEach(item => {
            musicDisplayer.appendChild(item);
        });
    }
});




