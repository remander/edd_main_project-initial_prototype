// Project Name: PosturePro
// File Name: demo.js
// Date: 24 May 2025
// Description: Javascript for Displaying the Demo Page with Dummy Data Graphs. Similar
// logic to the chart.js file, but with hardcoded data for demo purposes.
// Group: Sensor-4

// Chart references
let lineChart = null;
let barChart = null;
let sessionSelect = null;

// Track if initialization has already happened
let hasInitialized = false;

// Add a global error handler for Chart.js
window.addEventListener('error', function(event) {
  console.error('Global error caught:', event.error);
  if (event.error && event.error.message && event.error.message.includes('Chart')) {
    console.error('Chart.js error detected. Check that Chart.js is properly loaded.');
  }
});

// Add a function to check if Chart.js is available
function isChartJsAvailable() {
  if (typeof Chart === 'undefined') {
    console.error('Chart is not defined! Make sure Chart.js is loaded.');
    return false;
  }
  console.log('Chart.js is available:', Chart.version);
  return true;
}

// Main initialization function - run once when the DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
  if (hasInitialized) {
    console.log("Charts already initialized, skipping");
    return;
  }
  
  console.log("Chart.js script loaded");
  
  // Get session select dropdown
  sessionSelect = document.getElementById("sessionSelect");
  
  // Check for chart elements
  const lineCtx = document.getElementById("emgLineChart");
  const barCtx = document.getElementById("emgBarChart");
  
  if (!lineCtx || !barCtx) {
    console.error(`Canvas elements missing: ${!lineCtx ? "emgLineChart" : ""} ${!barCtx ? "emgBarChart" : ""}`);
    const statusInfo = document.getElementById("status-info");
    if (statusInfo) {
      statusInfo.innerHTML += '<p class="text-red-600">Error: Chart canvas elements not found.</p>';
    }
  } else {
    console.log("Canvas elements found");
  }
  
  // Wait a bit longer to make sure Chart is available
  setTimeout(() => {
    // Initialize charts
    initializeCharts();
    
    // Set up demo mode immediately
    setupDemoMode();
    
    hasInitialized = true;
  }, 500);
});

function initializeCharts() {
  console.log("Initializing charts");
  
  // Check if Chart.js is available
  if (!isChartJsAvailable()) {
    return;
  }
  
  // Check if charts already exist and destroy them first
  if (lineChart) {
    console.log("Destroying existing line chart");
    lineChart.destroy();
    lineChart = null;
  }
  
  if (barChart) {
    console.log("Destroying existing bar chart");
    barChart.destroy();
    barChart = null;
  }
  
  // Create empty charts
  createEmptyCharts();
}

// Function to create empty charts
function createEmptyCharts() {
  const lineCtx = document.getElementById("emgLineChart");
  const barCtx = document.getElementById("emgBarChart");
  
  if (!lineCtx) {
    console.error("Line chart canvas element not found");
    return;
  }
  
  if (!barCtx) {
    console.error("Bar chart canvas element not found");
    return;
  }
  
  console.log("Creating charts");
  
  try {
    // Create empty line chart
    lineChart = new Chart(lineCtx, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "EMG Signal",
          data: [],
          borderColor: "rgba(75, 192, 192, 1)",
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          borderWidth: 2,
          tension: 0.1,
          pointRadius: 1,
          pointHoverRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { 
            title: { display: true, text: "Sample Index" },
            grid: { display: true }
          },
          y: { 
            title: { display: true, text: "EMG Value" },
            grid: { display: true }
          }
        },
        plugins: {
          tooltip: { enabled: true },
          legend: { display: true },
          title: { display: true, text: "EMG Signal Readings" }
        }
      }
    });
    
    console.log("Line chart created successfully");
  } catch (error) {
    console.error("Error creating line chart:", error);
  }
  
  try {
    // Create empty bar chart
    barChart = new Chart(barCtx, {
      type: "bar",
      data: {
        labels: [],
        datasets: [{
          label: "Average EMG",
          data: [],
          backgroundColor: "rgba(255, 99, 132, 0.5)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: "Session" },
            ticks: { autoSkip: true, maxRotation: 45, minRotation: 30 }
          },
          y: { 
            title: { display: true, text: "Average Value" },
            beginAtZero: false
          }
        },
        plugins: {
          tooltip: { enabled: true },
          legend: { display: true },
          title: { display: true, text: "Average EMG by Session" }
        }
      }
    });
    
    console.log("Bar chart created successfully");
  } catch (error) {
    console.error("Error creating bar chart:", error);
  }
}

// Function to set up demo mode with realistic data
function setupDemoMode() {
  console.log("Setting up demo mode");
  
  // Generate sample data with more realistic patterns
  const sessionDates = [
    "12-05-2023 14:30:45",
    "13-05-2023 09:15:22", 
    "14-05-2023 16:45:10",
    "15-05-2023 11:20:33",
    "16-05-2023 08:45:17"
  ];
  
  // Generate more realistic EMG data
  const emgValues = generateRealisticEMGData(80); // 80 data points
  const sessionAverages = generateSessionAverages(sessionDates.length);
  
  // Update charts
  updateLineChart(emgValues);
  updateBarChart(sessionDates, sessionAverages);
  
  // Set up session selector
  sessionSelect.innerHTML = '<option value="">All Sessions</option>';
  sessionDates.forEach((date, idx) => {
    const option = document.createElement('option');
    option.value = `demo-${idx}`;
    option.textContent = date;
    sessionSelect.appendChild(option);
  });
  
  // Add event listener for session filtering
  sessionSelect.addEventListener('change', function() {
    const selectedIndex = this.selectedIndex - 1;
    
    if (selectedIndex < 0) {
      // All sessions selected
      updateLineChart(emgValues);
      updateBarChart(sessionDates, sessionAverages);
    } else {
      // Generate session-specific data with different patterns
      const patterns = ['normal', 'resting', 'active', 'fatigue', 'training'];
      const selectedPattern = patterns[selectedIndex % patterns.length];
      const sessionReadings = generateRealisticEMGData(50, selectedPattern);
      updateLineChart(sessionReadings);
      updateBarChart([sessionDates[selectedIndex]], [sessionAverages[selectedIndex]]);
    }
  });
  
  // Add pattern control buttons
  addPatternControls();
}

function updateLineChart(emgValues) {
  // Check if lineChart exists
  if (!lineChart) {
    console.error("Line chart not initialized");
    return;
  }
  
  if (!emgValues || !Array.isArray(emgValues) || emgValues.length === 0) {
    console.warn("No EMG values for line chart");
    emgValues = Array(20).fill().map(() => 60 + Math.random() * 20);
  }
  
  console.log(`Updating line chart with ${emgValues.length} values`);
  
  // Get the last 100 values for better visualization
  const displayValues = emgValues.length > 100 ? 
    emgValues.slice(-100) : emgValues;
  
  // Sequential labels
  const labels = Array.from({length: displayValues.length}, (_, i) => i);
  
  // Update chart
  lineChart.data.labels = labels;
  lineChart.data.datasets[0].data = displayValues;
  
  // Force complete redraw
  lineChart.update('none');
}

// Function to update the bar chart with session data
function updateBarChart(timestamps, averages) {
  if (!barChart) {
    console.error("Bar chart not initialized");
    return;
  }
  
  if (!timestamps || !averages || timestamps.length === 0 || averages.length === 0) {
    console.warn("Missing data for bar chart");
    return;
  }
  
  console.log(`Updating bar chart with ${averages.length} sessions`);
  
  // Make sure we have numerical values
  const numericAverages = averages.map(val => parseFloat(val));
  
  // Update chart
  barChart.data.labels = timestamps;
  barChart.data.datasets[0].data = numericAverages;
  
  // Force complete redraw
  barChart.update('none');
}

// Add realistic EMG data generation functions
// Add realistic EMG data generation functions
function generateRealisticEMGData(numPoints, pattern = 'normal') {
  const data = [];
  let baseValue = 65; // Base EMG value
  let trend = 0; // Trending direction
  
  for (let i = 0; i < numPoints; i++) {
    let value;
    
    // Different patterns based on type
    if (pattern === 'resting') {
      // Low, stable activity with minimal variation
      value = 45 + Math.sin(i * 0.1) * 3 + (Math.random() - 0.5) * 4;
    } else if (pattern === 'active') {
      // Higher activity with rhythmic patterns (like exercise)
      value = 75 + Math.sin(i * 0.3) * 15 + Math.cos(i * 0.15) * 8 + (Math.random() - 0.5) * 10;
      // Add occasional spikes for muscle contractions
      if (i % 8 === 0) {
        value += Math.random() * 20;
      }
    } else if (pattern === 'fatigue') {
      // Starts high, gradually decreases (muscle fatigue)
      const fatigueBase = 80 - (i / numPoints) * 25;
      value = fatigueBase + Math.sin(i * 0.2) * 8 + (Math.random() - 0.5) * 12;
    } else if (pattern === 'training') {
      // Intervals of high and low activity (interval training)
      const cycleLength = 15;
      const cyclePosition = i % cycleLength;
      if (cyclePosition < 8) {
        // Active phase
        value = 85 + Math.sin(cyclePosition * 0.8) * 10 + (Math.random() - 0.5) * 8;
      } else {
        // Rest phase
        value = 50 + (Math.random() - 0.5) * 6;
      }
    } else {
      // 'normal' pattern or any other value
      // Trending behavior
      if (Math.random() < 0.1) { // 10% chance to change trend
        trend = (Math.random() - 0.5) * 2;
      }
      
      // Generate value with trend, noise, and occasional spikes
      value = baseValue + trend * 0.5;
      value += (Math.random() - 0.5) * 10; // Random noise, will usually always happen in the environment
      
      // Occasional muscle activation spikes
      if (Math.random() < 0.05) { // 5% chance of spike
        value += Math.random() * 30 + 20; // Spike of 20-50
      }
      
      // Slowly drift baseline
      baseValue += (Math.random() - 0.5) * 0.5;
      baseValue = Math.max(50, Math.min(80, baseValue));
    }
    
    // Keep values in reasonable EMG range
    value = Math.max(20, Math.min(150, value));
    data.push(Math.round(value * 100) / 100); // Round to 2 decimal places
  }
  
  return data;
}

// Function to generate session averages
function generateSessionAverages(numSessions) {
  const averages = [];
  
  for (let i = 0; i < numSessions; i++) {
    // Generate averages that show some progression over time
    const baseAverage = 65 + (i * 1.5); // Slight improvement over sessions
    const variation = (Math.random() - 0.5) * 8; // ±4 variation
    const average = Math.max(50, Math.min(90, baseAverage + variation));
    
    averages.push(Math.round(average * 100) / 100);
  }
  
  return averages;
}

// Add pattern control buttons
function addPatternControls() {
  const statusInfo = document.getElementById("status-info");
  
  if (!statusInfo) return; // Exit if status-info doesn't exist, only for error-handling
  
  const patternControls = document.createElement('div');
  patternControls.className = 'mt-4';
  patternControls.innerHTML = `
    <p class="mb-2 font-semibold">Try Different EMG Patterns:</p>
    <div class="flex flex-wrap gap-2 justify-center">
      <button id="normalPattern" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded transition-colors">Normal</button>
      <button id="restingPattern" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded transition-colors">Resting</button>
      <button id="activePattern" class="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded transition-colors">Active</button>
      <button id="fatiguePattern" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition-colors">Fatigue</button>
      <button id="trainingPattern" class="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded transition-colors">Training</button>
    </div>
  `;
  
  statusInfo.appendChild(patternControls);
  
  // Add event listeners for pattern buttons
  
  document.getElementById('normalPattern').addEventListener('click', () => {
    const data = generateRealisticEMGData(80, 'normal');
    const averages = generatePatternAverages('normal');
    updateLineChart(data);
    updateBarChart(getSessionDates(), averages);
  });
  
  document.getElementById('restingPattern').addEventListener('click', () => {
    const data = generateRealisticEMGData(80, 'resting');
    const averages = generatePatternAverages('resting');
    updateLineChart(data);
    updateBarChart(getSessionDates(), averages);
  });
  
  document.getElementById('activePattern').addEventListener('click', () => {
    const data = generateRealisticEMGData(80, 'active');
    const averages = generatePatternAverages('active');
    updateLineChart(data);
    updateBarChart(getSessionDates(), averages);
  });
  
  document.getElementById('fatiguePattern').addEventListener('click', () => {
    const data = generateRealisticEMGData(80, 'fatigue');
    const averages = generatePatternAverages('fatigue');
    updateLineChart(data);
    updateBarChart(getSessionDates(), averages);
  });
  
  document.getElementById('trainingPattern').addEventListener('click', () => {
    const data = generateRealisticEMGData(80, 'training');
    const averages = generatePatternAverages('training');
    updateLineChart(data);
    updateBarChart(getSessionDates(), averages);
  });
}

// Helper function to get session dates
function getSessionDates() {
  return [
    "12-05-2023 14:30:45",
    "13-05-2023 09:15:22", 
    "14-05-2023 16:45:10",
    "15-05-2023 11:20:33",
    "16-05-2023 08:45:17"
  ];
}

// Generate pattern-specific averages for the bar chart
function generatePatternAverages(pattern) {
  const averages = [];
  const numSessions = 5;
  
  for (let i = 0; i < numSessions; i++) {
    let baseValue;
    
    // Set base values based on pattern type
    if (pattern === 'resting') {
      baseValue = 45 + (i * 0.5); // Low values, slight progression
    } else if (pattern === 'active') {
      baseValue = 85 + (i * 1.0); // High values with progression
    } else if (pattern === 'fatigue') {
      baseValue = 80 - (i * 3.0); // Decreasing values over sessions
    } else if (pattern === 'training') {
      baseValue = 70 + (i * 2.0); // Moderate to high with good progression
    } else { // 'normal' or default
      baseValue = 65 + (i * 1.5); // Standard progression
    }
    
    // Add some variation
    const variation = (Math.random() - 0.5) * 6;
    const average = Math.max(30, Math.min(120, baseValue + variation));
    
    averages.push(Math.round(average * 100) / 100);
  }
  
  return averages;
}