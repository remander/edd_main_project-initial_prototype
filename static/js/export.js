// Project Name: PosturePro
// File Name: export.js
// Date: 24 May 2025
// Description: Export functionality for chart data. Allows users to export EMG chart data as a CSV file.
// Group: Sensor-4


// Function to export chart data as CSV
function exportChartDataAsCSV() {
  // Ask for confirmation before exporting
  if (!confirm('Are you sure you want to export the chart data as CSV?')) {
    return;
  }
  
  try {
    const lineChart = Chart.getChart('emgLineChart');
    const barChart = Chart.getChart('emgBarChart');
    
    if (!lineChart || !barChart) {
      showExportMessage('Charts not found. Please try again.', 'error');
      return;
    }
    
    // Get user info
    const keepLoggedIn = localStorage.getItem("keepLoggedIn");
    const currentUser = JSON.parse((keepLoggedIn === "yes" ? localStorage : sessionStorage).getItem("user")) || {};
    
    // Build CSV content
    let csv = `Export Date,${new Date().toISOString()}\n`;
    csv += `User,${currentUser.firstname || 'Unknown'} ${currentUser.lastname || ''}\n`;
    csv += `Selected Session,${document.getElementById('sessionSelect')?.selectedOptions[0]?.text || 'Unknown'}\n`;
    csv += `${document.getElementById('graphDetails')?.textContent.trim() || ''}\n\n`;
    
    // Export line chart data
    if (lineChart.data?.labels?.length) {
      csv += 'Line Chart Data\nSample Index,Sensor 1,Sensor 2\n';
      const labels = lineChart.data.labels;
      const s1 = lineChart.data.datasets[0]?.data || [];
      const s2 = lineChart.data.datasets[1]?.data || [];
      
      labels.forEach((label, i) => csv += `${label},${s1[i] || ''},${s2[i] || ''}\n`);
      csv += '\n';
    }
    
    // Export bar chart data
    if (barChart.data?.labels?.length) {
      csv += 'Session Averages\nSession,Average EMG\n';
      const labels = barChart.data.labels;
      const data = barChart.data.datasets[0]?.data || [];
      
      labels.forEach((label, i) => csv += `${label},${data[i] || ''}\n`);
    }
    
    // Download file
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `emg-data-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    a.click();
    
    showExportMessage('Chart data exported successfully!', 'success');
    
  } catch (error) {
    console.error('Error exporting chart data:', error);
    showExportMessage('Error exporting chart data. Please try again.', 'error');
  }
}

// Function to show export messages
function showExportMessage(message, type) {
  const div = document.createElement('div');
  div.className = `fixed top-4 right-4 p-4 rounded shadow-lg z-50 transition-opacity duration-300 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`;
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.style.opacity = '0', 3000);
  setTimeout(() => div.remove(), 3300);
}

// Initialize export functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => document.getElementById('exportCsvBtn')?.addEventListener('click', exportChartDataAsCSV), 1000);
});

