// Registriere das Datalabels Plugin
Chart.register(ChartDataLabels);

// Globale Variable für das Chart-Objekt
let priceChart = null;

// Globale Variable für das Age-Chart-Objekt
let ageChart = null;

// Globale Variable für das Korrelations-Chart
let correlationChart = null;

// Gemeinsame Chart-Styles
const chartStyles = {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: 12,
    tooltipBackground: 'rgba(255, 255, 255, 0.95)',
    tooltipBorder: '#E5E7EB',
    gridColor: '#F3F4F6',
    textColor: '#374151',
    animationDuration: 750,
    barRadius: 4
};

// Farbpaletten für die Charts
const chartColors = {
    price: {
        gradient: ['rgba(79, 70, 229, 0.8)', 'rgba(79, 70, 229, 0.1)'],
        border: 'rgb(67, 56, 202)'
    },
    age: {
        gradient: ['rgba(59, 130, 246, 0.8)', 'rgba(59, 130, 246, 0.1)'],
        border: 'rgb(37, 99, 235)'
    },
    correlation: {
        point: 'rgba(99, 102, 241, 0.7)',
        border: 'rgb(79, 70, 229)',
        hover: 'rgba(99, 102, 241, 0.9)'
    }
};

// Gemeinsame Chart-Optionen
function getCommonChartOptions(type) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: {
                top: 25,
                right: 15,
                bottom: 5,
                left: 5
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: chartStyles.tooltipBackground,
                titleColor: chartStyles.textColor,
                bodyColor: chartStyles.textColor,
                borderColor: chartStyles.tooltipBorder,
                borderWidth: 1,
                padding: 10,
                cornerRadius: 8,
                displayColors: false,
                titleFont: {
                    family: chartStyles.fontFamily,
                    size: 13,
                    weight: '600'
                },
                bodyFont: {
                    family: chartStyles.fontFamily,
                    size: 12
                },
                shadowOffsetX: 1,
                shadowOffsetY: 1,
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.1)'
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    font: {
                        family: chartStyles.fontFamily,
                        size: chartStyles.fontSize
                    },
                    color: chartStyles.textColor
                }
            },
            y: {
                grid: {
                    color: chartStyles.gridColor,
                    drawBorder: false,
                    lineWidth: 1
                },
                ticks: {
                    font: {
                        family: chartStyles.fontFamily,
                        size: chartStyles.fontSize
                    },
                    color: chartStyles.textColor,
                    padding: 8
                }
            }
        },
        animation: {
            duration: chartStyles.animationDuration,
            easing: 'easeOutQuart'
        }
    };
}

// Statistische Hilfsfunktionen
function calculateStatistics(prices) {
    const n = prices.length;
    const mean = prices.reduce((a, b) => a + b, 0) / n;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
    const stdDev = Math.sqrt(variance);
    
    return { mean, stdDev };
}

function calculateNormalDistribution(x, mean, stdDev) {
    return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * 
           Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
}

// Optimale Bin-Breite nach Scott's Rule
function calculateOptimalBinWidth(prices) {
    const { stdDev } = calculateStatistics(prices);
    return 3.49 * stdDev * Math.pow(prices.length, -1/3);
}

function createHistogramData(prices, binSize, minPrice, maxPrice) {
    const { mean, stdDev } = calculateStatistics(prices);
    
    // Identifiziere Ausreißer (außerhalb von 2 Standardabweichungen)
    const upperBound = mean + 2 * stdDev;
    const lowerBound = mean - 2 * stdDev;
    
    // Teile die Preise in normale Werte und Ausreißer
    const normalPrices = prices.filter(p => p >= lowerBound && p <= upperBound);
    const outliers = prices.filter(p => p < lowerBound || p > upperBound);
    
    // Wenn keine normalen Preise vorhanden sind, verwende alle Preise
    if (normalPrices.length === 0) {
        return createHistogramDataForRange(prices, minPrice, maxPrice, mean, stdDev);
    }
    
    // Bestimme die Schrittgröße basierend auf dem normalen Bereich
    const normalRange = Math.max(...normalPrices) - Math.min(...normalPrices);
    let step;
    if (normalRange <= 10) step = 1;
    else if (normalRange <= 50) step = 5;
    else if (normalRange <= 100) step = 10;
    else if (normalRange <= 500) step = 25;
    else if (normalRange <= 1000) step = 50;
    else if (normalRange <= 5000) step = 100;
    else if (normalRange <= 10000) step = 500;
    else step = 1000;
    
    // Erstelle Histogram für den normalen Bereich mit der berechneten Schrittgröße
    const normalHistogram = createHistogramDataForRange(normalPrices, Math.min(...normalPrices), Math.max(...normalPrices), mean, stdDev, step);
    
    // Füge Ausreißer als separate Bins hinzu
    if (outliers.length > 0) {
        const lowOutliers = outliers.filter(p => p < lowerBound);
        const highOutliers = outliers.filter(p => p > upperBound);
        
        if (lowOutliers.length > 0) {
            const avgLowPrice = Math.round(lowOutliers.reduce((a, b) => a + b, 0) / lowOutliers.length);
            normalHistogram.labels.unshift(`< ${Math.ceil(lowerBound)}€ (⌀ ${avgLowPrice}€)`);
            normalHistogram.data.unshift(lowOutliers.length);
            normalHistogram.normalCurve.unshift(0);
        }
        
        if (highOutliers.length > 0) {
            const avgHighPrice = Math.round(highOutliers.reduce((a, b) => a + b, 0) / highOutliers.length);
            normalHistogram.labels.push(`> ${Math.floor(upperBound)}€ (⌀ ${avgHighPrice}€)`);
            normalHistogram.data.push(highOutliers.length);
            normalHistogram.normalCurve.push(0);
        }
    }
    
    return normalHistogram;
}

function createHistogramDataForRange(prices, minPrice, maxPrice, mean, stdDev, forcedStep = null) {
    // Verwende die übergebene Schrittgröße oder berechne eine neue
    let step = forcedStep;
    if (!step) {
        const range = maxPrice - minPrice;
        if (range <= 10) step = 1;
        else if (range <= 50) step = 5;
        else if (range <= 100) step = 10;
        else if (range <= 500) step = 25;
        else if (range <= 1000) step = 50;
        else if (range <= 5000) step = 100;
        else if (range <= 10000) step = 500;
        else step = 1000;
    }
    
    // Runde min/max auf step-Größe
    const roundedMin = Math.floor(minPrice / step) * step;
    const roundedMax = Math.ceil(maxPrice / step) * step;
    
    // Erstelle Bins basierend auf step
    const binCount = Math.ceil((roundedMax - roundedMin) / step);
    
    // Wenn zu viele Bins entstehen würden, vergrößere den Step
    if (binCount > 20 && !forcedStep) {
        const factor = Math.ceil(binCount / 20);
        step *= factor;
        return createHistogramDataForRange(prices, minPrice, maxPrice, mean, stdDev, step);
    }
    
    const bins = new Array(binCount).fill(0);
    const labels = [];
    const normalCurve = [];
    
    // Erstelle Labels und berechne Normalverteilung
    for (let i = 0; i < binCount; i++) {
        const value = roundedMin + (i * step);
        labels.push(`${value}€`);
        
        // Berechne Normalverteilungswert und skaliere ihn
        const normalValue = calculateNormalDistribution(value, mean, stdDev);
        normalCurve.push(normalValue);
    }
    
    // Fülle die Bins
    prices.forEach(price => {
        const binIndex = Math.min(
            Math.floor((price - roundedMin) / step),
            binCount - 1
        );
        bins[binIndex]++;
    });
    
    // Skaliere die Normalverteilungskurve auf die gleiche Höhe wie die Bins
    const maxBin = Math.max(...bins);
    const maxNormal = Math.max(...normalCurve);
    const scaledNormalCurve = normalCurve.map(v => (v / maxNormal) * maxBin);
    
    return {
        labels,
        data: bins,
        normalCurve: scaledNormalCurve,
        statistics: { mean, stdDev }
    };
}

// Funktion zum Erstellen oder Aktualisieren des Diagramms
function updateChart(prices) {
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    const { labels, data, normalCurve, statistics } = createHistogramData(prices, null, minPrice, maxPrice);

    // Berechne Prozentuale Verteilung
    const totalCount = prices.length;
    const percentageData = data.map(count => (count / totalCount * 100).toFixed(1));

    // Skaliere die Normalverteilungskurve auf Prozente
    const maxPercentage = Math.max(...percentageData);
    const maxNormal = Math.max(...normalCurve);
    const normalPercentage = normalCurve.map(v => (v / maxNormal * maxPercentage).toFixed(1));

    // Wenn das Chart bereits existiert, aktualisiere es
    if (priceChart) {
        priceChart.data.labels = labels;
        priceChart.data.datasets[0].data = percentageData;
        priceChart.data.datasets[1].data = normalPercentage;
        priceChart.update();
        return;
    }

    // Erstelle ein neues Chart
    const ctx = document.getElementById('priceChart').getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, chartColors.price.gradient[0]);
    gradient.addColorStop(1, chartColors.price.gradient[1]);

    const options = {
        ...getCommonChartOptions('price'),
        plugins: {
            ...getCommonChartOptions('price').plugins,
            tooltip: {
                ...getCommonChartOptions('price').plugins.tooltip,
                callbacks: {
                    title: (tooltipItems) => `Preisbereich: ${tooltipItems[0].label}`,
                    label: (context) => {
                        const percentage = context.dataset.data[context.dataIndex];
                        const count = Math.round(percentage * totalCount / 100);
                        if (context.dataset.type === 'line') {
                            return `Erwarteter Anteil: ${percentage}%`;
                        }
                        return `${count} Anzeigen (${percentage}%)`;
                    }
                }
            },
            datalabels: {
                color: chartStyles.textColor,
                anchor: 'end',
                align: 'top',
                offset: -4,
                display: (context) => {
                    return context.dataset.type === 'bar' && context.dataset.data[context.dataIndex] > 3;
                },
                formatter: (value) => value > 3 ? value + '%' : '',
                font: {
                    family: chartStyles.fontFamily,
                    size: 11,
                    weight: '600'
                }
            }
        }
    };

    if (priceChart) {
        priceChart.destroy();
    }

    priceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'bar',
                    data: percentageData,
                    backgroundColor: gradient,
                    borderColor: chartColors.price.border,
                    borderWidth: 1,
                    borderRadius: chartStyles.barRadius,
                    barPercentage: 0.95,
                    categoryPercentage: 0.95
                },
                {
                    type: 'line',
                    data: normalPercentage,
                    borderColor: 'rgba(234, 88, 12, 0.8)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: options
    });
}

// Funktion zum Erstellen oder Aktualisieren des Altersdiagramms
function updateAgeChart(daysOld) {
    // Gruppiere die Tage in sinnvolle Kategorien
    const ageGroups = {
        'Heute': 0,
        'Gestern': 0,
        '2-3 Tage': 0,
        '4-7 Tage': 0,
        '1-2 Wochen': 0,
        'Älter': 0
    };

    daysOld.forEach(days => {
        if (days === 0) ageGroups['Heute']++;
        else if (days === 1) ageGroups['Gestern']++;
        else if (days <= 3) ageGroups['2-3 Tage']++;
        else if (days <= 7) ageGroups['4-7 Tage']++;
        else if (days <= 14) ageGroups['1-2 Wochen']++;
        else ageGroups['Älter']++;
    });

    const labels = Object.keys(ageGroups);
    const data = Object.values(ageGroups);
    const percentageData = data.map(count => (count / daysOld.length * 100).toFixed(1));

    // Wenn das Chart bereits existiert, aktualisiere es
    if (ageChart) {
        ageChart.data.datasets[0].data = percentageData;
        ageChart.update();
        return;
    }

    // Erstelle ein neues Chart
    const ctx = document.getElementById('ageChart').getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, chartColors.age.gradient[0]);
    gradient.addColorStop(1, chartColors.age.gradient[1]);

    const options = {
        ...getCommonChartOptions('age'),
        plugins: {
            ...getCommonChartOptions('age').plugins,
            datalabels: {
                color: chartStyles.textColor,
                anchor: 'end',
                align: 'top',
                offset: -4,
                display: (context) => context.dataset.data[context.dataIndex] > 3,
                formatter: (value) => value > 3 ? value + '%' : '',
                font: {
                    family: chartStyles.fontFamily,
                    size: 11,
                    weight: '600'
                }
            }
        }
    };

    if (ageChart) {
        ageChart.destroy();
    }

    ageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: percentageData,
                backgroundColor: gradient,
                borderColor: chartColors.age.border,
                borderWidth: 1,
                borderRadius: chartStyles.barRadius,
                barPercentage: 0.95,
                categoryPercentage: 0.95
            }]
        },
        options: options
    });
}

// Funktion zum Aktualisieren des Korrelations-Charts
function updateCorrelationChart(listings) {
    // Gruppiere die Daten nach Tagen und berechne Durchschnitte
    const groupedData = listings.reduce((acc, listing) => {
        const days = Math.round(getDays(listing.creationDate));
        if (!acc[days]) {
            acc[days] = { sum: 0, count: 0 };
        }
        acc[days].sum += listing.price;
        acc[days].count++;
        return acc;
    }, {});

    // Konvertiere die gruppierten Daten in das richtige Format
    const data = Object.entries(groupedData).map(([days, values]) => ({
        x: parseInt(days),
        y: Math.round(values.sum / values.count)
    }));

    // Sortiere nach Tagen
    data.sort((a, b) => a.x - b.x);

    if (correlationChart) {
        correlationChart.destroy();
    }

    const ctx = document.getElementById('correlationChart').getContext('2d');
    
    const options = {
        ...getCommonChartOptions('correlation'),
        plugins: {
            ...getCommonChartOptions('correlation').plugins,
            tooltip: {
                ...getCommonChartOptions('correlation').plugins.tooltip,
                callbacks: {
                    title: () => null,
                    label: (context) => {
                        const point = context.raw;
                        const count = groupedData[point.x].count;
                        return [
                            `Durchschnittspreis: ${point.y.toFixed(2)}€`,
                            `Alter: ${point.x} ${point.x === 1 ? 'Tag' : 'Tage'}`,
                            `Anzahl Anzeigen: ${count}`
                        ];
                    }
                }
            }
        },
        scales: {
            ...getCommonChartOptions('correlation').scales,
            x: {
                ...getCommonChartOptions('correlation').scales.x,
                title: {
                    display: true,
                    text: 'Alter in Tagen',
                    color: chartStyles.textColor,
                    font: {
                        family: chartStyles.fontFamily,
                        size: 13,
                        weight: '600'
                    },
                    padding: { top: 10 }
                }
            },
            y: {
                ...getCommonChartOptions('correlation').scales.y,
                title: {
                    display: true,
                    text: 'Durchschnittspreis in €',
                    color: chartStyles.textColor,
                    font: {
                        family: chartStyles.fontFamily,
                        size: 13,
                        weight: '600'
                    },
                    padding: { bottom: 10 }
                }
            }
        }
    };

    correlationChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                data: data,
                backgroundColor: chartColors.correlation.point,
                borderColor: chartColors.correlation.border,
                borderWidth: 1.5,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointHoverBackgroundColor: chartColors.correlation.hover,
                pointStyle: 'circle',
                hoverBorderWidth: 2
            }]
        },
        options: options
    });
} 