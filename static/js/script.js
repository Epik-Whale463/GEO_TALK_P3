let map;

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupEventListeners();
});

function initMap() {
    map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

function setupEventListeners() {
    document.getElementById('submit-query').addEventListener('click', submitQuery);
    document.getElementById('query-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitQuery();
    });
}

async function submitQuery() {
    const query = document.getElementById('query-input').value.trim();
    if (!query) {
        alert('Please enter a query before submitting. You can ask about countries, cities, landmarks, or any geographical features!');
        return;
    }

    const loadingElem = document.getElementById('loading');
    loadingElem.hidden = false;

    try {
        const response = await fetch('/process_query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        processQueryResponse(data);
        
        // Smooth scroll to map after processing the response
        scrollToMap();

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('query-response').textContent = 'An error occurred while processing your query.';
    } finally {
        loadingElem.hidden = true;
    }
}

function scrollToMap() {
    const mapSection = document.getElementById('map-section');
    const start = window.pageYOffset;
    const target = mapSection.getBoundingClientRect().top + start;
    const distance = target - start;
    const duration = 1500; // Scroll duration in milliseconds
    let startTime = null;

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = ease(timeElapsed, start, distance, duration);
        window.scrollTo(0, run);
        if (timeElapsed < duration) requestAnimationFrame(animation);
    }

    function ease(t, b, c, d) {
        t /= d / 2;
        if (t < 1) return c / 2 * t * t + b;
        t--;
        return -c / 2 * (t * (t - 2) - 1) + b;
    }

    requestAnimationFrame(animation);
}
function processQueryResponse(data) {
    clearMap();
    updateTextContent(data);
    displayLocations('explicit-locations', data.explicit_locations);
    displayLocations('implicit-locations', data.implicit_locations);
    updateMap(data.map_data);
}

function clearMap() {
    map.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.GeoJSON) {
            map.removeLayer(layer);
        }
    });
}

function updateTextContent(data) {
    const elements = ['query-response', 'geospatial-context', 'additional-info'];
    elements.forEach(id => {
        const element = document.getElementById(id);
        element.textContent = data[id.replace('-', '_')] || '';
    });
}

function displayLocations(elementId, locations) {
    const ul = document.getElementById(elementId);
    ul.innerHTML = locations.map(loc => 
        `<li>${loc.name} (${loc.type}) - [${loc.coordinates.join(', ')}]</li>`
    ).join('');
}

function updateMap(mapData) {
    if (mapData.markers.length > 0) {
        let zoomLevel;
        const locationType = mapData.markers[0].type.toLowerCase();
        
        if (locationType.includes('country')) {
            zoomLevel = 3;
        } else if (locationType.includes('state') || locationType.includes('province')) {
            zoomLevel = 5;
        } else if (locationType.includes('city') || locationType.includes('town')) {
            zoomLevel = 7;
        } else {
            zoomLevel = mapData.zoom;
        }

        map.setView(mapData.center, zoomLevel);
        mapData.markers.forEach(addMarkerToMap);
    }
    
    if (mapData.boundaries) {
        renderBoundaries(mapData.boundaries);
    }
}



function addMarkerToMap(marker) {
    L.marker(marker.coordinates)
        .addTo(map)
        .bindPopup(`${marker.name} (${marker.type})`);
}

function renderBoundaries(boundaries) {
    boundaries.forEach(boundary => {
        L.geoJSON(boundary.geojson, {
            style: {
                color: "#0000FF",
                weight: 2,
                opacity: 0.6,
                fillColor: "#0000FF",
                fillOpacity: 0.2
            }
        }).addTo(map).bindPopup(boundary.name);
    });
}

function scrollToMap() {
    const mapSection = document.getElementById('map-section');
    const start = window.pageYOffset;
    const target = mapSection.getBoundingClientRect().top + start;
    const distance = target - start;
    const duration = 1500; // Adjust this value to control the scroll speed (in milliseconds)
    let startTime = null;

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = ease(timeElapsed, start, distance, duration);
        window.scrollTo(0, run);
        if (timeElapsed < duration) requestAnimationFrame(animation);
    }

    // Easing function for smooth scroll
    function ease(t, b, c, d) {
        t /= d / 2;
        if (t < 1) return c / 2 * t * t + b;
        t--;
        return -c / 2 * (t * (t - 2) - 1) + b;
    }

    requestAnimationFrame(animation);
}
