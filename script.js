
const API_KEY = '26b45fbf1e9ab80b49560d8d31c805bb';

// ---------- CONFIG ----------
const MAX_RECENTS = 6; // max number of recent cities to keep

// ---------- DOM ELEMENTS ----------
const searchInput = document.getElementById('city-input');
const searchBtn = document.getElementById('city-search-btn');
const currentLocBtn = document.getElementById('current-location-btn');
const recentDropdown = document.getElementById('recent-dropdown'); // container for dropdown
const messageBox = document.getElementById('message-box'); // for error/success messages
const currentWeatherContainer = document.getElementById('current-weather');
const forecastContainer = document.getElementById('forecast-container');
const tempToggleBtn = document.getElementById('temp-toggle'); // toggles °C/°F for today's temp

// ---------- UTILITIES ----------
function showMessage(text, type = 'info') {
    // type: info | error | success
    messageBox.textContent = text;
    messageBox.className = ''; // reset
    messageBox.classList.add('msg', type);
    // auto-hide after 5s
    clearTimeout(showMessage._t);
    showMessage._t = setTimeout(() => {
        messageBox.textContent = '';
        messageBox.className = '';
    }, 4000);
}

function safeJSON(res) {
    return res.json().catch(() => {
        throw new error('Invalid response from server.');
    })
}

function kelvinToC(k) { return +(k - 273.15).toFixed(1); }
function kelvinToF(k) { return +((k - 273.15) * 9 / 5 + 32).toFixed(1); }
function formatDate(dtTxt) {
    // dtTxt from OWM forecast (e.g., "2025-09-15 12:00:00")
    const d = new Date(dtTxt.replace(' ', 'T'));
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// ---------- RECENT SEARCHES (localStorage) ----------
function getRecents() {
    try {
        const raw = localStorage.getItem('recentCities');
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}
function addRecent(city) {
    if (!city) return;
    let arr = getRecents();
    city = city.trim();
    arr = arr.filter(c => c.toLowerCase() !== city.toLowerCase());
    arr.unshift(city);
    if (arr.length > MAX_RECENTS) arr = arr.slice(0, MAX_RECENTS);
    localStorage.setItem('recentCities', JSON.stringify(arr));
    renderRecents();
}
function renderRecents() {
    const arr = getRecents();
    recentDropdown.innerHTML = ''; // clear
    if (!arr || arr.length === 0) {
        recentDropdown.style.display = 'none';
        return;
    }
    recentDropdown.style.display = 'block';
    const list = document.createElement('ul');
    list.classList.add('recent-list');
    arr.forEach(city => {
        const li = document.createElement('li');
        li.classList.add('recent-item');
        li.textContent = city;
        li.addEventListener('click', () => {
            searchInput.value = city;
            fetchWeatherByCity(city);
        });
        list.appendChild(li);
    });
    recentDropdown.appendChild(list);
}

// ---------- FETCH FUNCTIONS ----------
async function fetchWeatherByCity(city) {
    if (!city || !city.trim()) {
        showMessage('Please enter a city name.', 'error');
        return;
    }
    try {
        showMessage('Searching...', 'info');
        // Current weather endpoint
        const cwResp = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}`);
        if (!cwResp.ok) {
            if (cwResp.status === 404) throw new Error('City not found.');
            if (cwResp.status === 401) throw new Error('Invalid API key.')
            throw new Error('Error fetching current weather.');
        }
        const cwData = await safeJSON(cwResp);
        // 5-day forecast endpoint (3-hourly)
        const { coord: { lat, lon } } = cwData;
        const fcResp = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
        if (!fcResp.ok) throw new Error('Error fetching forecast.');
        const fcData = await safeJSON(fcResp);

        addRecent(cwData.name);
        displayCurrentWeather(cwData);
        displayForecast(fcData);
        showMessage(`Weather for ${cwData.name} loaded.`, 'success');
    } catch (err) {
        console.error(err);
        showMessage(err.message || 'Failed to fetch weather.', 'error');
    }
}

async function fetchWeatherByCoords(lat, lon) {
    try {
        showMessage('Getting weather for current location...', 'info');
        const cwResp = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
        if (!cwResp.ok) throw new Error('Location weather error (${cwResp.status}).');
        const cwData = await cwResp.json();

        const fcResp = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
        if (!fcResp.ok) throw new Error('Error in forecast (${fcResp.status}).');
        const fcData = await safeJSON(fcResp);

        addRecent(cwData.name);
        displayCurrentWeather(cwData);
        displayForecast(fcData);
        showMessage(`Weather for ${cwData.name} loaded.`, 'success');
    } catch (err) {
        console.error(err);
        showMessage(err.message || 'Failed to fetch weather', 'error');
    }
}

// ---------- DISPLAY ----------
let todayUnit = 'C'; // toggled between 'C' and 'F' for today's temp only

function displayCurrentWeather(data) {
    // data: response from /weather
    currentWeatherContainer.innerHTML = ''; // clear
    const city = data.name;
    const country = data.sys && data.sys.country ? `, ${data.sys.country}` : '';
    const desc = data.weather && data.weather[0] ? data.weather[0].description : '';
    const main = data.weather && data.weather[0] ? data.weather[0].main : '';
    const icon = data.weather && data.weather[0] ? data.weather[0].icon : null;
    const tempK = data.main.temp;
    const tempC = kelvinToC(tempK);
    const tempF = kelvinToF(tempK);
    const humidity = data.main.humidity;
    const wind = data.wind.speed; // m/s
    const windKmph = +(wind * 3.6).toFixed(1);

    // build HTML
    const wrapper = document.createElement('div');
    wrapper.classList.add('current-card');

    const title = document.createElement('h3');
    title.innerHTML = `${city}${country}`;
    title.classList.add('current-title');

    const topRow = document.createElement('div');
    topRow.classList.add('cw-top-row');

    const iconImg = document.createElement('img');
    if (icon) iconImg.src = `https://openweathermap.org/img/wn/${icon}@2x.png`;
    iconImg.alt = desc || 'weather';

    const tempEl = document.createElement('div');
    tempEl.classList.add('cw-temp');
    tempEl.innerHTML = `<span id="today-temp-val">${todayUnit === 'C' ? tempC + '°C' : tempF + '°F'}</span>`;

    const descEl = document.createElement('p');
    descEl.classList.add('cw-desc');
    descEl.textContent = desc;

    topRow.appendChild(iconImg);
    topRow.appendChild(tempEl);
    topRow.appendChild(descEl);

    const details = document.createElement('div');
    details.classList.add('cw-details');
    details.innerHTML = `
    <p><strong>Humidity:</strong> ${humidity}%</p>
    <p><strong>Wind:</strong> ${windKmph} km/h</p>
  `;

    wrapper.appendChild(title);
    wrapper.appendChild(topRow);
    wrapper.appendChild(details);

    currentWeatherContainer.appendChild(wrapper);

    // Temperature toggle button: update label to show other unit available
    tempToggleBtn.style.display = 'inline-block';
    tempToggleBtn.textContent = `Show °${todayUnit === 'C' ? 'F' : 'C'}`;

    // Extreme temp alert (Celsius threshold)
    if (tempC > 40) {
        showMessage('Extreme temperature alert: above 40°C! Take precautions.', 'error');
    }

    // Dynamic background change for rain
    const bodyEl = document.body;
    if (/rain|drizzle/i.test(main)) {
        bodyEl.classList.add('rainy-bg');
    } else {
        bodyEl.classList.remove('rainy-bg');
    }
}

function displayForecast(fcData) {
    // fcData from /forecast (3-hourly). We'll produce next 5 daily summaries (including today if remainder)
    forecastContainer.innerHTML = '';

    // Map list to days: pick the entry at 12:00 if possible, otherwise nearest midday, for each unique date
    const map = {}; // dateStr => array of items
    (fcData.list || []).forEach(item => {
        const dateStr = item.dt_txt.split(' ')[0];
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(item);
    });

    const days = Object.keys(map).slice(0, 6); // may include today; we'll show up to 5 future days + maybe today (we'll take first 5 relevant)
    // Build an array of daily summary objects
    const daily = [];
    for (let i = 0; i < days.length && daily.length < 5; i++) {
        const date = days[i];
        const items = map[date];
        // pick item at 12:00 if present
        let pick = items.find(it => it.dt_txt.includes('12:00:00')) || items[Math.floor(items.length / 2)];
        if (!pick) continue;
        // compute average humidity and max wind and temp
        const tempsK = items.map(it => it.main.temp);
        const avgTempK = tempsK.reduce((a, b) => a + b, 0) / tempsK.length;
        const avgTempC = kelvinToC(avgTempK);
        const avgTempF = kelvinToF(avgTempK);
        const maxWindMs = Math.max(...items.map(it => it.wind.speed));
        const maxWindKmph = +(maxWindMs * 3.6).toFixed(1);
        const avgHumidity = Math.round(items.reduce((a, b) => a + b.main.humidity, 0) / items.length);
        const icon = pick.weather[0].icon;
        const main = pick.weather[0].main;

        daily.push({
            date: date,
            dateLabel: formatDate(pick.dt_txt),
            tempC: avgTempC,
            tempF: avgTempF,
            icon,
            main,
            humidity: avgHumidity,
            windKmph: maxWindKmph
        });
    }

    // Render daily cards
    const grid = document.createElement('div');
    grid.className = 'flex flex-wrap justify-center gap-4 w-full max-w-6xl mx-auto';

    daily.forEach(d => {
        const card = document.createElement('div');
        card.className =
            'shadow-md shadow-black w-full sm:w-1/2 lg:w-1/3 p-4 border-2 border-slate-200  rounded-xl bg-white/10 text-center text-white';

        card.innerHTML = `
        
        <div class=" shadow-sm shadow-black p-4 m-2 border-2 border-gray-800  border-solid">
            <p class="fc-date text-3xl text-center text-gray-950"><strong>${d.dateLabel}</strong></p>
            <p class='flex justify-center'><img src="https://openweathermap.org/img/wn/${d.icon}@2x.png" alt="${d.main}" class="fc-icon "mx-2 mb-2" "></p>
            <p class="text-blue-950 text-shadow-sm text-shadow-gray-700"><strong class="text-slate-200">Temperature:</strong> ${d.tempC}°C / ${d.tempF}°F</p>
            <div class="fc-meta">
                <p class="text-blue-950 text-shadow-sm text-shadow-gray-800"><strong class="text-slate-200">Humidity:</strong> ${d.humidity}%</p>
                <p class="text-blue-950 text-shadow-sm text-shadow-gray-800"><strong class="text-slate-200">Wind:</strong> ${d.windKmph} km/h</p>
            </div>
        </div>

    `;
        grid.appendChild(card);
    });

    forecastContainer.appendChild(grid);
}

// ---------- EVENTS ----------
searchBtn.addEventListener('click', () => {
    const city = searchInput.value;
    fetchWeatherByCity(city);
});

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        fetchWeatherByCity(searchInput.value);
    }
});

currentLocBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        showMessage('Geolocation is not supported by your browser.', 'error');
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
            const msg = err.code === 1
                ? 'Location permission denied.'
                : 'unable to fetch location.';
            showMessage(msg, 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
});

tempToggleBtn.addEventListener('click', () => {
    // Toggle today's temperature unit only (in currentWeatherContainer)
    todayUnit = todayUnit === 'C' ? 'F' : 'C';
    const tempValEl = document.getElementById('today-temp-val');
    if (!tempValEl) return;
    // read current temp string -> we can parse numeric from it or fetch from current weather content: easier approach: re-fetch the shown city
    // But we can convert from displayed value:
    const val = tempValEl.textContent;
    const num = parseFloat(val);
    if (isNaN(num)) return;
    if (todayUnit === 'C') {
        // convert F -> C
        const c = +(((num - 32) * 5 / 9).toFixed(1));
        tempValEl.textContent = `${c}°C`;
        tempToggleBtn.textContent = 'Show °F';
    } else {
        const f = +((num * 9 / 5 + 32).toFixed(1));
        tempValEl.textContent = `${f}°F`;
        tempToggleBtn.textContent = 'Show °C';
    }
});

// init recents on load
document.addEventListener('DOMContentLoaded', () => {
    renderRecents();
    // Hide temp toggle initially
    tempToggleBtn.style.display = 'none';
});
