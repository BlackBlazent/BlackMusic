// Function to show the pop-up | Select Country
function popupPlaygroundCategory() {
    const popup = document.getElementById("popupPlaygViewCateg");
    popup.style.display = "block";

    // Hide pop-up when clicking outside of it or clicking elements inside it
    document.addEventListener('click', (event) => {
        const isClickInside = popup.contains(event.target) || event.target.id === "popup-category-view";
        if (!isClickInside) {
            popup.style.display = "none";
        } else if (popup.contains(event.target)) {
            // Close pop-up if any element inside the pop-up is clicked
            popup.style.display = "none";
        }
    });

    // Hide pop-up when the mouse leaves the pop-up
    popup.addEventListener('mouseleave', () => {
        popup.style.display = "none";
    });
}

 /* Dragging Converter 
  
 document.addEventListener('DOMContentLoaded', () => {
    const popups = document.querySelectorAll('.playground-toggle-dialog-after4');
  
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
  */