// For Converter
function popupAddonsEqualizer() {
    document.getElementById(
        "popupExtenEqualizer"
    ).style.display = "block";
  }
  function closeAddonsEqualizer() {
    document.getElementById(
        "popupExtenEqualizer"
    ).style.display = "none";
  }
  
  /* Dragging Converter */
  
  document.addEventListener('DOMContentLoaded', () => {
    const popups = document.querySelectorAll('.music-equalizer-popup-after2');
  
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


  // From Equalizer Presets

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.equalizer-presets-items2 li');
    
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