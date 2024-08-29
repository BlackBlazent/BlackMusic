// For Terms and Srvices the conatiner
function popupTermsServices() {
  document.getElementById(
      "terms-service-popup"
  ).style.display = "block";
}
function closeTermsServices() {
  document.getElementById(
      "terms-service-popup"
  ).style.display = "none";
}

/* Dragging Terms and Services */

document.addEventListener('DOMContentLoaded', () => {
  const popups = document.querySelectorAll('.terms-service-pop-window7');

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