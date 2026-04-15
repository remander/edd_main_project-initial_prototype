// Project Name: PosturePro
// File Name: chart.js
// Date: 24 May 2025
// Description: Javascript for Generating Graphs from Firebase
// Group: Sensor-4

// ----------------- Firebase Setup & Initialization ------------------------//

// Import necessary functions for Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

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

// Chart references
let lineChart = null;
let barChart = null;
let sessionSelect = null;

// Track if initialization has already happened
let hasInitialized = false;

// Global variables for each session
let currentSessionKeys = [];
let currentSessionAverages = [];
let currentSessionData = {};
let isSessionSelectListenerAttached = false; 
let dataUpdateInterval = null;

// Function to check if chart.js loaded
function isChartJsAvailable() {
  if (typeof Chart === "undefined") {
    console.error("Chart.js not loaded.");
    return false;
  }
  console.log("Chart.js is available:", Chart.version);
  return true;
}

// Function to map values from one range to another
// Used for converting EMG values collected from the Myoware a more manageable range (0-3.3V)
function mapValue(value, fromLow, fromHigh, toLow, toHigh) {
  return ((value - fromLow) / (fromHigh - fromLow)) * (toHigh - toLow) + toLow;
}

// Main initialization function which runs once when the page is loaded
document.addEventListener("DOMContentLoaded", function () {
  if (hasInitialized) {
    console.log("Chart already initialized");
    return;
  }

  // Get session select dropdown
  sessionSelect = document.getElementById("sessionSelect");

  // Wait to make sure chart loads
  setTimeout(() => {
    // Initialize charts
    initializeCharts();

    // Populate sessions from Firebase and start live updates
    populateSessions();

    hasInitialized = true;
  }, 500);
});

// Function to initialize charts
// This function will create empty charts if they don't exist
function initializeCharts() {
  console.log("Initializing charts");

  // Check if Chart.js is available
  if (!isChartJsAvailable()) {
    return;
  }

  // Check if charts already exist and remove them first
  if (lineChart) {
    console.log("Removing existing line chart");
    lineChart.destroy();
    lineChart = null;
  }

  if (barChart) {
    console.log("Removing existing bar chart");
    barChart.destroy();
    barChart = null;
  }

  // Create empty charts
  createEmptyCharts();
}

// Function to create empty charts
function createEmptyCharts() {
  const lineChartElement = document.getElementById("emgLineChart");
  const barChartElement = document.getElementById("emgBarChart");

  // Check if line chart element exists in HTML
  if (!lineChartElement) {
    console.error("Line chart element not found");
    return;
  }

  // Check if bar chart element exists in HTML
  if (!barChartElement) {
    console.error("Bar chart element not found");
    return;
  }

  try {
    // Create empty line chart
    lineChart = new Chart(lineChartElement, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Sensor 1",
            data: [],
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 1,
            pointHoverRadius: 3,
          },
          {
            label: "Sensor 2", 
            data: [],
            borderColor: "rgba(255, 99, 132, 1)",
            backgroundColor: "rgba(255, 99, 132, 0.2)",
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 1,
            pointHoverRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: "Sample Index" },
            grid: { display: true },
          },
          y: {
            title: { display: true, text: "EMG Value" },
            grid: { display: true },
          },
        },
        plugins: {
          tooltip: { enabled: true },
          legend: { display: true },
          title: { display: true, text: "EMG Signal Readings" },
        },
      },
    });

    console.log("Line chart created successfully");
  } catch (error) { // If error creating chart, log it
    console.error("Error creating line chart:", error);
  }

  try {
    // Create empty bar chart
    barChart = new Chart(barChartElement, {
      type: "bar",
      data: {
        labels: [],
        datasets: [
          {
            label: "Average EMG",
            data: [],
            backgroundColor: "rgba(255, 99, 132, 0.5)",
            borderColor: "rgba(255, 99, 132, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: "Session" },
            ticks: { autoSkip: true, maxRotation: 45, minRotation: 30 },
          },
          y: {
            title: { display: true, text: "Average Value" },
            beginAtZero: false,
          },
        },
        plugins: {
          tooltip: { enabled: true },
          legend: { display: true },
          title: { display: true, text: "Average EMG by Session" },
        },
      },
    });

    console.log("Bar chart created successfully");
  } catch (error) { // If error creating chart, log it
    console.error("Error creating bar chart:", error);
  }
}

// Function to handle session change (selecting a different time period)
function sessionChange() {
  if (!sessionSelect) {
    console.log("sessionSelect is null.");
    return;
  }
  const selectedValue = sessionSelect.value;
  console.log("Selected value:", selectedValue);

  let avg = 0;

  // If no session is selected, show all sessions
  if (!selectedValue) {
    // Recreate bar chart if it was destroyed
    if (!barChart) {
      createEmptyCharts();
    }
    
    // Update bar chart with all sessions
    updateBarChart(currentSessionKeys, currentSessionAverages);
    const allReadings1 = currentSessionKeys.flatMap( //flatMap combines all timestamp arrays into one
      (sessionTimestamp) => currentSessionData[sessionTimestamp] && currentSessionData[sessionTimestamp].sensor1 || []
    );
    const allReadings2 = currentSessionKeys.flatMap( //flatMap combines all timestamp arrays into one
      (sessionTimestamp) => currentSessionData[sessionTimestamp] && currentSessionData[sessionTimestamp].sensor2 || []
    );
    
    // Update line chart with all readings

    // console.log(`Avg for ${selectedValue}:`, avg);

    updateLineChart(allReadings1, allReadings2);
    const allReadings = allReadings1.concat(allReadings2);
    if (allReadings.length) {
      avg = allReadings.reduce((a, b) => a + b, 0) / allReadings.length; // Reduce all values to one value and divide by length to get average
    }
  } else { // If a specific session is selected, show that session
    console.log(`Displaying session: ${selectedValue}`);
    
    // Destroy bar chart for single sessions
    if (barChart) {
      barChart.destroy();
      barChart = null;
    }
    
    // Get readings for the selected session, returns either readings or empty array if it can't return reading
    const sessionData = currentSessionData[selectedValue];  
    let readings1 = [];
    let readings2 = [];
    
    if (sessionData) {
      readings1 = sessionData.sensor1 || [];
      readings2 = sessionData.sensor2 || [];
    }
    
    const allReadings = readings1.concat(readings2);
    
    if (allReadings.length) {
      avg = allReadings.reduce((a, b) => a + b, 0) / allReadings.length; // Reduce all values to one value and divide by length to get average
    }
    
    updateLineChart(readings1, readings2); // Update line chart with readings for the selected session
  }

  // Update the average value display on the page
  const averageValue = document.getElementById("graphDetails");
  if (averageValue) {
    if (selectedValue) {
      averageValue.textContent = `Session "${selectedValue}" 
                              Average: ${avg.toFixed(2)}`;
    } else {
      averageValue.textContent = `All sessions average: ${avg.toFixed(2)}`;
    }
  }
}

// populateSessions fetches data, updates dropdown, and manages live data updates
function populateSessions() {
  const auth = getAuth();
  const database = getDatabase();

  // Code to handle when a user sings in or out
  onAuthStateChanged(auth, (user) => {
    if (user) {
      const uid = user.uid;
      // console.log("User signed in. UID:", uid);

      if (sessionSelect && !isSessionSelectListenerAttached) {
        sessionSelect.addEventListener("change", sessionChange);
        isSessionSelectListenerAttached = true;
      }

      // Function to fetch data and update UI
      const fetchDataAndUpdate = () => {
        // console.log("Fetching data and updating UI...");
        const sessionData = ref(database, `users/${uid}/data`); 
        get(sessionData)
          .then((snapshot) => {
            const oldSelectedValue = sessionSelect ? sessionSelect.value : "";

            // Clear existing global data
            currentSessionKeys = [];
            currentSessionAverages = [];
            currentSessionData = {};
            
            // "All Sessions" option in dropdown
            if (sessionSelect) {
              sessionSelect.innerHTML =
                '<option value="">All Sessions</option>';
            }
            
            snapshot.forEach((childSnap) => {
              const key = childSnap.key;
              const raw = childSnap.val();
              const readings1 = [];
              const readings2 = [];
              
              Object.values(raw).forEach((v) => {
                const returnedVal = String(v);
                if (returnedVal.includes('x')) {
                  const parts = returnedVal.split('x'); // Splits the string by 'x' so we have two arrays of values (one for each sensor)
                  if (parts.length === 2) {
                    const val1 = parseFloat(parts[0]); // Convert values to float
                    const val2 = parseFloat(parts[1]); // Convert values to float
                    
                     // Map values to a more appropriate range
                    let processedVal1;
                    let processedVal2;
                    
                    if (val1 >= 0 && val1 <= 4095) {        // Filter out invalid values
                      processedVal1 = mapValue(val1, 0, 4095, 0, 3.3);
                      processedVal1 = processedVal1 / 200;  // Scaling values down to account for MyoWare amplifier
                      processedVal1 = processedVal1 * 1000; // Convert to mV
                    }
                    
                    if (val2 >= 0 && val2 <= 4095) {        // Filter out invalid values
                      processedVal2 = mapValue(val2, 0, 4095, 0, 3.3);
                      processedVal2 = processedVal2 / 200;  // Scaling values down to account for MyoWare amplifier
                      processedVal2 = processedVal2 * 1000; // Convert to mV
                    }
                    
                    if (!isNaN(processedVal1) && processedVal1 <= 3300) { // Filter out invalid values (values that are NaN or greater than 3.3V)
                      readings1.push(processedVal1);
                    }
                    if (!isNaN(processedVal2) && processedVal2 <= 3300) { // Filter out invalid values (values that are NaN or greater than 3.3V)
                      readings2.push(processedVal2);
                    }
                  }
                }
              });

              // Calculate average for the session
              const allReadings = readings1.concat(readings2);
              let avg = 0;
              if (allReadings.length > 0) {
                avg = allReadings.reduce((a, b) => a + b, 0) / allReadings.length;
              }

              currentSessionKeys.push(key);
              currentSessionAverages.push(avg);
              currentSessionData[key] = { sensor1: readings1, sensor2: readings2 };

              // Adding sessions to dropdown based on the user logged in
              if (sessionSelect) {
                const option = document.createElement("option");
                option.value = key;
                option.textContent = key;
                sessionSelect.appendChild(option);
              }
            });

            // console.log("Session data updated:", {
            //   numKeys: currentSessionKeys.length,
            // });

            if (sessionSelect) {
              if (currentSessionKeys.includes(oldSelectedValue)) {
                sessionSelect.value = oldSelectedValue;
              } else {
                sessionSelect.value = "";
              }
            }

            // Update chart based on current selection
            sessionChange();
          })
          .catch((err) => console.error("Error fetching sessions:", err));
      };

      // Perform initial fetch
      fetchDataAndUpdate();

      // Clear any existing interval before setting a new one
      if (dataUpdateInterval) {
        clearInterval(dataUpdateInterval);
      }
      
      // Set up interval for updates, updates every second
      dataUpdateInterval = setInterval(fetchDataAndUpdate, 1000);
    } else {
      // console.log("User not signed in. Clearing data.");
      if (dataUpdateInterval) {
        clearInterval(dataUpdateInterval);
        dataUpdateInterval = null;
        // console.log("Stopped data update interval.");
      }
      // Clear charts and dropdown
      currentSessionKeys = [];
      currentSessionAverages = [];
      currentSessionData = {};
      if (sessionSelect) {
        sessionSelect.innerHTML = '<option value="">All Sessions</option>';
      }
      updateLineChart([]); // Clear line chart
      updateBarChart([], []); // Clear bar chart
    }
  });
}

// Function to update line chart with new EMG values
function updateLineChart(sensor1Values, sensor2Values) {
  // Check if lineChart exists
  if (!lineChart) {
    console.error("Line chart not initialized");
    return;
  }

  // If no valid EMG values are being provided, clear the chart
  if ((!sensor1Values || sensor1Values.length === 0) &&
      (!sensor2Values || sensor2Values.length === 0)) {
    console.log("No sensor values for line chart, clearing chart.");
    lineChart.data.labels = [];
    lineChart.data.datasets[0].data = [];
    lineChart.data.datasets[1].data = [];
    lineChart.update("none");
    return;
  }

  // console.log(`Updating line chart with ${emgValues.length} values`);
  
  // Get the last 100 values for each sensor
  let graphSensor1;
  let graphSensor2;
  
  if (sensor1Values.length > 100) {
    graphSensor1 = sensor1Values.slice(-100);
  } else {
    graphSensor1 = sensor1Values;
  }
  
  if (sensor2Values.length > 100) {
    graphSensor2 = sensor2Values.slice(-100);
  } else {
    graphSensor2 = sensor2Values;
  }

  // Labels based on how many values we have
  const indexCount = Math.max(graphSensor1.length, graphSensor2.length); // Get the maximum length of the two sensor arrays
  const labels = Array.from({ length: indexCount }, (_, i) => i);

  // Update chart
  lineChart.data.labels = labels;
  lineChart.data.datasets[0].data = graphSensor1;
  lineChart.data.datasets[1].data = graphSensor2;

  lineChart.update("none");
}

// Function to update bar chart with session averages
function updateBarChart(timestamps, averages) {
  if (!barChart) {
    console.error("Bar chart not initialized");
    return;
  }

  if ( // Check if timestamps and averages are valid
    !timestamps ||
    !averages ||
    !Array.isArray(timestamps) ||
    !Array.isArray(averages)
  ) {
    // Allow empty arrays
    // console.log("Missing/invalid data for bar chart, clearing chart.");
    barChart.data.labels = [];
    barChart.data.datasets[0].data = [];
    barChart.update("none");
    return;
  }

  if (timestamps.length === 0 || averages.length === 0) {
    // console.log("Updating bar chart with empty data.");
    barChart.data.labels = [];
    barChart.data.datasets[0].data = [];
    barChart.update("none");
    return;
  }

  // console.log(`Updating bar chart with ${averages.length} sessions`);

  // Make sure we have numerical values
  const numericAverages = averages.map((val) => parseFloat(val));

  // Update chart
  barChart.data.labels = timestamps;
  barChart.data.datasets[0].data = numericAverages;

  // Force complete redraw
  barChart.update("none");
}
