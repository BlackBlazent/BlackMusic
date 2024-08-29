// For Langauge the conatiner
function popupApiEnv() {
  document.getElementById(
      "customEnvApi"
  ).style.display = "block";
}
function closeEvnApi() {
  document.getElementById(
      "customEnvApi"
  ).style.display = "none";
}

/* Dragging Shop */

document.addEventListener('DOMContentLoaded', () => {
  const popups = document.querySelectorAll('.custom-api-variable-pop-window21');

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