const path = require('path');
// Slideshow

const images = [
    "./public/blackmusicentranceslideshowimg1@2x.png",
    "./public/sam1.jpg",
    "./public/sam2.webp",
    "./public/sam3.jpg",
    "./public/sam4.jpg",
    "./public/sam5.webp",
    "./public/sam6.jpg",
    "./public/sam7.jpg"
    // Add more image paths here
  ];
  
  let currentImageIndex = 0;
  const imageElement = document.getElementById("slideshow-image");
  
  function changeImage() {
    currentImageIndex = (currentImageIndex + 1) % images.length;
    imageElement.src = images[currentImageIndex];
  }
  
  setInterval(changeImage, 3000);


  // Package loader

  document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");
  
    const packagePaths = {
      "for-app-data": "../../../../../../AppData/",
      "for-app-registry": "../../../../../../.app-registry/",
      "for-app-src": "../../../../../../src/",
      "for-app-docs": "../../../../../../Docs/",
      "for-app-test": "../../../../../../test/"
    };
  
    if (window.electron) {
      console.log("window.electron is available");
  
      Object.keys(packagePaths).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
          window.electron.readDirectory(packagePaths[id])
            .then(files => {
              element.textContent = `Package: ${packagePaths[id]} - ${files.join(', ')}`;
            })
            .catch(err => {
              console.error(`Unable to scan directory: ${err}`);
              element.textContent = `Error loading package: ${packagePaths[id]}`;
            });
        }
      });
    
      // Simulate loading process
      setTimeout(() => {
        // Close entrance UI and start main app
        window.location.href = 'main.html'; // Replace with the actual main app URL
      }, 3000); // Adjust the time as needed
    } else {
      console.error("window.electron is not defined");
    }
  });
  
  