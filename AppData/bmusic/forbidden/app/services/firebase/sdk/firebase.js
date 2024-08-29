// Module
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "",
    authDomain: "blackmusic-dd4d3.firebaseapp.com",
    projectId: "blackmusic-dd4d3",
    storageBucket: "blackmusic-dd4d3.appspot.com",
    messagingSenderId: "83079786764",
    appId: "1:83079786764:web:cd29545587a613651b9929",
    measurementId: "G-S634QLWC07"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
