// git push --mirror https://github.com/suvitasnani/posture-pro.git

// Project Name: PosturePro
// File Name: status.js
// Date: 24 May 2025
// Description: Javascript for Managing Connection Status Display
// Group: Sensor-4

// ----------------- Firebase Setup & Initialization ------------------------//

// Import necessary functions for Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// Web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDPcAa2CsSwlMdm48GCjNvi0b_GVowx_aA",
  authDomain: "wearable-sensor-2425.firebaseapp.com",
  databaseURL: "https://wearable-sensor-2425-default-rtdb.firebaseio.com",
  projectId: "wearable-sensor-2425",
  storageBucket: "wearable-sensor-2425.firebasestorage.app",
  messagingSenderId: "930846894252",
  appId: "1:930846894252:web:7572563039ba8022ca9709"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Status tracking variables
let statusContainer = null;
let statusUpdateInterval = null;
let currentSelectedSession = null;

// Function to initialize status display
function initializeStatus() {
  const sessionSelect = document.getElementById("sessionSelect");
  sessionSelect.addEventListener("change", handleSessionChange);
  startStatusUpdates();
}

// Function to handle session selection changes
function handleSessionChange() {
  const sessionSelect = document.getElementById("sessionSelect");
  const selectedValue = sessionSelect.value;
  currentSelectedSession = selectedValue;

  if (selectedValue) {
    showConnectionStatus();
    hideBarChart();
    displayStatus(selectedValue);
  } else {
    hideConnectionStatus();
    showBarChart();
  }
}

// Function to create and show connection status container
function showConnectionStatus() {
  if (!statusContainer) {
    const barChartContainer = document.querySelector("#emgBarChart").parentElement;
    statusContainer = document.createElement("div");
    statusContainer.id = "connectionStatusContainer";
    statusContainer.className = "bg-white rounded-lg p-6 shadow-md h-48 flex flex-col justify-center";
    statusContainer.innerHTML = `
      <h3 class="text-lg font-semibold mb-4 text-center">Connection Status</h3>
      <div id="connectionStatusContent" class="flex-1 flex items-center justify-center">
        <div class="text-gray-500">Loading status...</div>
      </div>
    `;
    barChartContainer.parentElement.appendChild(statusContainer);
  }
  
  statusContainer.style.display = "flex";
  const barChartContainer = document.querySelector("#emgBarChart").parentElement;
  barChartContainer.style.display = "none";
}

// Function to hide connection status
function hideConnectionStatus() {
  statusContainer.style.display = "none";
}

// Function to show bar chart
function showBarChart() {
  const barChartContainer = document.querySelector("#emgBarChart").parentElement;
  barChartContainer.style.display = "block";
}

// Function to fetch connection status from Firebase
function displayStatus(sessionKey) {
  const auth = getAuth();
  const database = getDatabase();
  
  onAuthStateChanged(auth, (user) => {
    const uid = user.uid;
    const statusRef = ref(database, "users/" + uid + "/status");
    
    get(statusRef).then((snapshot) => {
      const statusData = snapshot.val();
      displayConnectionStatus(statusData);
    });
  });
}

// Function to display the connection status
function displayConnectionStatus(statusData) {
  const contentContainer = document.getElementById("connectionStatusContent");
  const connectionStatus = statusData.connectionStatus;
  
  let sensor1Status;
  let sensor2Status;
  const parts = connectionStatus.split(',');
  sensor1Status = parts[0].trim() == 'True';
  sensor2Status = parts[1].trim() == 'True';
  
  contentContainer.innerHTML = `
    <div class="grid grid-cols-2 gap-4 w-full max-w-sm mx-auto">
      <div class="p-3 rounded ${sensor1Status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
        <div class="font-medium text-center">Sensor 1</div>
        <div class="text-sm text-center">${sensor1Status ? 'Connected' : 'Disconnected'}</div>
        <div class="w-6 h-6 rounded-full mx-auto mt-2 ${sensor1Status ? 'bg-green-500' : 'bg-red-500'}"></div>
      </div>
      <div class="p-3 rounded ${sensor2Status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
        <div class="font-medium text-center">Sensor 2</div>
        <div class="text-sm text-center">${sensor2Status ? 'Connected' : 'Disconnected'}</div>
        <div class="w-6 h-6 rounded-full mx-auto mt-2 ${sensor2Status ? 'bg-green-500' : 'bg-red-500'}"></div>
      </div>
    </div>
  `;
}

// Function to start status updates
function startStatusUpdates() {
  const auth = getAuth();
  
  onAuthStateChanged(auth, (user) => {
    const fetchStatusUpdate = () => {
      if (currentSelectedSession) {
        displayStatus(currentSelectedSession);
      }
    };

    if (statusUpdateInterval) {
      clearInterval(statusUpdateInterval);
    }
    
    statusUpdateInterval = setInterval(fetchStatusUpdate, 1000);
  });
}

// Loop to make sure status is being updated after page load
document.addEventListener("DOMContentLoaded", function() {
  setTimeout(() => {
    initializeStatus();
  }, 1000);
});