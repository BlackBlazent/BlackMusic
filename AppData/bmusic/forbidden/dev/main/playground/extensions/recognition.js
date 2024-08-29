// For Recognition
function popupRecognition() {
    document.getElementById(
        "popupExtenRecogniton"
    ).style.display = "block";
  }
  function closeAddonsRecognition() {
    document.getElementById(
        "popupExtenRecogniton"
    ).style.display = "none";
  }
  
  /* Dragging Recognition */
  
  document.addEventListener('DOMContentLoaded', () => {
    const popups = document.querySelectorAll('.music-recognition-popup-after2');
  
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