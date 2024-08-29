// For TPrivacy and Policy the conatiner
function popupPrivacyPolicy() {
  document.getElementById(
      "popupPrivacyPolicy"
  ).style.display = "block";
}
function closePrivacyPolicy() {
  document.getElementById(
      "popupPrivacyPolicy"
  ).style.display = "none";
}

/* Dragging Privacy and Policy */

document.addEventListener('DOMContentLoaded', () => {
  const popups = document.querySelectorAll('.privacy-policy-pop-window7');

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