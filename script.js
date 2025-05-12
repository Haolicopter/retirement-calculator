document.addEventListener('DOMContentLoaded', () => {
    // Helper function to format numbers as currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    };

    // Define a consistent color palette for the charts
    const chartColors = {
        green: '#4CAF50', // For Starting Amount / Balance
        blue: '#2196F3',  // For Contributions
        amber: '#FFC107'  // For Interest
    };

    // Chart.js instances (declared here so they can be accessed and destroyed by renderPieChart)
    let investmentChart;
    let nonContributionChart;

    // --- Helper Function for Chart.js (MOVED TO TOP) ---
    function renderPieChart(canvasElement, chartInstance, labels, data, colors, titleText) {
        // Destroy existing chart if it exists
        if (chartInstance) {
            chartInstance.destroy();
        }

        const ctx = canvasElement.getContext('2d');
        chartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: titleText,
                        font: {
                            size: 16
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    // Also show percentage in tooltip for clarity
                                    const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                                    const percentage = total > 0 ? (context.parsed / total * 100).toFixed(2) + '%' : '0.00%';
                                    label += formatCurrency(context.parsed) + ` (${percentage})`;
                                }
                                return label;
                            }
                        }
                    },
                    datalabels: { // Plugin configuration for labels on slices
                        color: '#fff', // Label text color
                        formatter: (value, context) => {
                            const total = context.chart.data.datasets[0].data.reduce((sum, dataPoint) => sum + dataPoint, 0);
                            // Handle case where total is zero to prevent division by zero
                            const percentage = total > 0 ? (value / total * 100).toFixed(1) : '0.0'; // One decimal place
                            return percentage + '%';
                        },
                        font: {
                            weight: 'bold', // Bold text
                            size: 14
                        },
                        align: 'center', // Position labels in the center of the slice
                        display: (context) => {
                            // Only display labels if the slice is large enough (e.g., > 5% of total)
                            // This prevents overlapping labels on very small slices.
                            const dataset = context.dataset;
                            const total = dataset.data.reduce((sum, dataPoint) => sum + dataPoint, 0);
                            const value = dataset.data[context.dataIndex];
                            return total > 0 && (value / total * 100) > 5; // Display if slice is > 5% and total > 0
                        }
                    }
                }
            }
        });

        // Store the chart instance back to the global variable for destruction next time
        if (canvasElement.id === 'investmentPieChart') {
            investmentChart = chartInstance;
        } else if (canvasElement.id === 'nonContributionPieChart') {
            nonContributionChart = chartInstance;
        }
    }

    // --- Component 1: Investment Calculator ---
    const initialInvestmentInput = document.getElementById('initialInvestment');
    const contributionYearsInput = document.getElementById('contributionYears');
    const annualReturnRateInput = document.getElementById('annualReturnRate');
    const yearlyContributionInput = document.getElementById('yearlyContribution');
    const investmentEndBalanceSpan = document.getElementById('investmentEndBalance');
    const investmentTotalStartingSpan = document.getElementById('investmentTotalStarting');
    const investmentTotalContributionsSpan = document.getElementById('investmentTotalContributions');
    const investmentTotalInterestSpan = document.getElementById('investmentTotalInterest');
    const investmentPieChartCanvas = document.getElementById('investmentPieChart');
    

    function calculateInvestmentGrowth() {
        const initialInvestment = parseFloat(initialInvestmentInput.value);
        const contributionYears = parseInt(contributionYearsInput.value);
        const annualReturnRate = parseFloat(annualReturnRateInput.value) / 100; // Convert to decimal
        const yearlyContribution = parseFloat(yearlyContributionInput.value);

        // Basic validation: ensures numbers are positive, not just if they exist
        if (isNaN(initialInvestment) || isNaN(contributionYears) || isNaN(annualReturnRate) || isNaN(yearlyContribution) ||
            initialInvestment < 0 || contributionYears < 0 || annualReturnRate < 0 || yearlyContribution < 0) {
            // Clearing results to indicate invalid input
            investmentEndBalanceSpan.textContent = formatCurrency(0);
            investmentTotalStartingSpan.textContent = formatCurrency(0);
            investmentTotalContributionsSpan.textContent = formatCurrency(0);
            investmentTotalInterestSpan.textContent = formatCurrency(0);
            renderPieChart(investmentPieChartCanvas, investmentChart, [], [], [], 'Investment Breakdown'); // Clear chart
            
            // If inputs are invalid, stop propagation and clear subsequent calculator inputs/outputs
            document.getElementById('nonContributionStartingBalance').value = 0;
            document.getElementById('retirementStartingBalance').value = 0;
            calculateNonContributionGrowth();
            calculateRetirementWithdrawal();
            return;
        }

        let endBalance = initialInvestment;
        let totalContributions = yearlyContribution * contributionYears;

        // Calculate future value of initial investment
        endBalance = initialInvestment * Math.pow(1 + annualReturnRate, contributionYears);

        // Calculate future value of contributions
        for (let i = 0; i < contributionYears; i++) {
            endBalance += yearlyContribution * Math.pow(1 + annualReturnRate, (contributionYears - 1 - i));
        }
        
        const totalInterest = endBalance - initialInvestment - totalContributions;

        // Update UI with formatted currency values
        investmentEndBalanceSpan.textContent = formatCurrency(endBalance);
        investmentTotalStartingSpan.textContent = formatCurrency(initialInvestment);
        investmentTotalContributionsSpan.textContent = formatCurrency(totalContributions);
        investmentTotalInterestSpan.textContent = formatCurrency(totalInterest);

        // Populate for Component 2 and 3 (using raw value for calculations)
        document.getElementById('nonContributionStartingBalance').value = endBalance.toFixed(2);
        document.getElementById('retirementStartingBalance').value = endBalance.toFixed(2);

        // Trigger calculation for the next components as their input is now updated
        calculateNonContributionGrowth();
        calculateRetirementWithdrawal();

        // Update Pie Chart
        renderPieChart(investmentPieChartCanvas, investmentChart, ['Starting Amount', 'Total Contributions', 'Total Interest'],
            [initialInvestment, totalContributions, totalInterest],
            [chartColors.green, chartColors.blue, chartColors.amber],
            'Investment Breakdown');
    }

    // Add event listeners for automatic updates
    [initialInvestmentInput, contributionYearsInput, annualReturnRateInput, yearlyContributionInput].forEach(input => {
        input.addEventListener('input', calculateInvestmentGrowth);
    });


    // --- Component 2: Non-Contribution Years Growth ---
    const nonContributionStartingBalanceInput = document.getElementById('nonContributionStartingBalance');
    const nonContributionYearsInput = document.getElementById('nonContributionYears');
    const nonContributionReturnRateInput = document.getElementById('nonContributionReturnRate');
    const nonContributionEndBalanceSpan = document.getElementById('nonContributionEndBalance');
    const nonContributionTotalStartingSpan = document.getElementById('nonContributionTotalStarting');
    const nonContributionTotalInterestSpan = document.getElementById('nonContributionTotalInterest');
    const nonContributionPieChartCanvas = document.getElementById('nonContributionPieChart');
    

    function calculateNonContributionGrowth() {
        const startingBalance = parseFloat(nonContributionStartingBalanceInput.value);
        const nonContributionYears = parseInt(nonContributionYearsInput.value);
        const annualReturnRate = parseFloat(nonContributionReturnRateInput.value) / 100;

        if (isNaN(startingBalance) || isNaN(nonContributionYears) || isNaN(annualReturnRate) ||
            startingBalance < 0 || nonContributionYears < 0 || annualReturnRate < 0) {
            nonContributionEndBalanceSpan.textContent = formatCurrency(0);
            nonContributionTotalStartingSpan.textContent = formatCurrency(0);
            nonContributionTotalInterestSpan.textContent = formatCurrency(0);
            renderPieChart(nonContributionPieChartCanvas, nonContributionChart, [], [], [], 'Growth Breakdown (No Contributions)'); // Clear chart

            // If inputs are invalid, clear subsequent calculator inputs/outputs
            document.getElementById('retirementStartingBalance').value = 0;
            calculateRetirementWithdrawal();
            return;
        }

        const endBalance = startingBalance * Math.pow(1 + annualReturnRate, nonContributionYears);
        const totalInterest = endBalance - startingBalance;

        // Update UI with formatted currency values
        nonContributionEndBalanceSpan.textContent = formatCurrency(endBalance);
        nonContributionTotalStartingSpan.textContent = formatCurrency(startingBalance);
        nonContributionTotalInterestSpan.textContent = formatCurrency(totalInterest);

        // Populate for Component 3 (using raw value for calculations)
        document.getElementById('retirementStartingBalance').value = endBalance.toFixed(2);

        // Trigger calculation for the next component as its input is now updated
        calculateRetirementWithdrawal();

        // Update Pie Chart - Using the first two colors from the main palette
        renderPieChart(nonContributionPieChartCanvas, nonContributionChart, ['Starting Balance', 'Total Interest'],
            [startingBalance, totalInterest],
            [chartColors.green, chartColors.amber],
            'Growth Breakdown (No Contributions)');
    }

    // Add event listeners for automatic updates
    [nonContributionStartingBalanceInput, nonContributionYearsInput, nonContributionReturnRateInput].forEach(input => {
        input.addEventListener('input', calculateNonContributionGrowth);
    });


    // --- Component 3: Retirement Withdrawal Calculator ---
    const retirementStartingBalanceInput = document.getElementById('retirementStartingBalance');
    const monthlySpendingInput = document.getElementById('annualSpending');
    const retirementReturnRateInput = document.getElementById('retirementReturnRate');
    const inflationRateInput = document.getElementById('inflationRate');
    const moneyLastsYearsSpan = document.getElementById('moneyLastsYears');
    const retirementBreakdownDiv = document.getElementById('retirementBreakdown');

    function calculateRetirementWithdrawal() {
        let currentBalance = parseFloat(retirementStartingBalanceInput.value);
        const monthlySpending = parseFloat(monthlySpendingInput.value);
        const retirementReturnRate = parseFloat(retirementReturnRateInput.value) / 100;
        const inflationRate = parseFloat(inflationRateInput.value) / 100;

        // Convert monthly spending to annual spending for calculations
        const annualSpending = monthlySpending * 12;

        if (isNaN(currentBalance) || isNaN(monthlySpending) || isNaN(retirementReturnRate) || isNaN(inflationRate) ||
            currentBalance < 0 || monthlySpending <= 0 || retirementReturnRate < 0 || inflationRate < 0) {
            moneyLastsYearsSpan.textContent = 'N/A'; // Indicate invalid input
            retirementBreakdownDiv.innerHTML = ''; // Clear table
            return;
        }

        let years = 0;
        let inflationAdjustedSpending = annualSpending;
        let breakdownTable = `<table>
                                <thead>
                                    <tr>
                                        <th>Year</th>
                                        <th>Starting Balance</th>
                                        <th>Return Earned</th>
                                        <th>Spending (Inflation Adj.)</th>
                                        <th>Ending Balance</th>
                                    </tr>
                                </thead>
                                <tbody>`;

        // Simulate year by year until money runs out
        while (currentBalance > 0 && years < 150) {
            years++;

            const returnEarned = currentBalance * retirementReturnRate;
            currentBalance += returnEarned;

            if (years > 1) {
                inflationAdjustedSpending = annualSpending * Math.pow(1 + inflationRate, years - 1);
            }
            
            const spendingThisYear = Math.min(currentBalance, inflationAdjustedSpending);

            currentBalance -= spendingThisYear;

            breakdownTable += `<tr>
                                    <td>${years}</td>
                                    <td>${formatCurrency(currentBalance + spendingThisYear)}</td>
                                    <td>${formatCurrency(returnEarned)}</td>
                                    <td>${formatCurrency(spendingThisYear)}</td>
                                    <td>${formatCurrency(Math.max(0, currentBalance))}</td>
                                </tr>`;

            if (currentBalance <= 0) {
                breakdownTable += `<tr><td colspan="5">Money ran out in year ${years}.</td></tr>`;
                break;
            }
        }

        breakdownTable += `</tbody></table>`;
        retirementBreakdownDiv.innerHTML = breakdownTable;
        moneyLastsYearsSpan.textContent = years;

        if (currentBalance > 0 && years >= 150) {
            moneyLastsYearsSpan.textContent += " (and likely beyond, capped at 150 years)";
        }
    }

    // Add event listeners for automatic updates
    [retirementStartingBalanceInput, monthlySpendingInput, retirementReturnRateInput, inflationRateInput].forEach(input => {
        input.addEventListener('input', calculateRetirementWithdrawal);
    });

    // Initial calculation on page load to populate default values
    calculateInvestmentGrowth(); // This will cascade and trigger the others
});