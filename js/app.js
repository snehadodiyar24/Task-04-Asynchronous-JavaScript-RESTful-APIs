const form = document.querySelector("#search-form");
const cityInput = document.querySelector("#city-input");
const searchButton = document.querySelector("#search-button");
const statusEl = document.querySelector("#status");
const weatherContent = document.querySelector("#weather-content");

const weatherCodes = {
  0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Depositing rime fog", "🌫️"], 51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"],
  55: ["Dense drizzle", "🌧️"], 56: ["Freezing drizzle", "🌧️"], 57: ["Heavy freezing drizzle", "🌧️"],
  61: ["Slight rain", "🌧️"], 63: ["Moderate rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"], 67: ["Heavy freezing rain", "🌧️"], 71: ["Slight snow", "🌨️"],
  73: ["Moderate snow", "🌨️"], 75: ["Heavy snow", "❄️"], 77: ["Snow grains", "🌨️"],
  80: ["Rain showers", "🌦️"], 81: ["Moderate showers", "🌧️"], 82: ["Violent showers", "⛈️"],
  85: ["Snow showers", "🌨️"], 86: ["Heavy snow showers", "❄️"], 95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️"], 99: ["Thunderstorm with heavy hail", "⛈️"]
};

function describeWeather(code) {
  return weatherCodes[code] || ["Conditions unavailable", "🌡️"];
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function formatHour(dateString) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", hour12: true }).format(new Date(dateString));
}

async function getCoordinates(city) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ name: city, count: "1", language: "en", format: "json" });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`City search failed (HTTP ${response.status}). Please try again.`);
  const data = await response.json();
  if (!data.results || data.results.length === 0) throw new Error(`Couldn't find "${city}". Check the spelling and try another city.`);
  return data.results[0];
}

async function getForecast(latitude, longitude) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,cloud_cover",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    forecast_days: "2",
    timezone: "auto",
    wind_speed_unit: "kmh"
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Weather service returned HTTP ${response.status}. Please try again shortly.`);
  return response.json();
}

function renderWeather(place, data) {
  const current = data.current;
  const [description, icon] = describeWeather(current.weather_code);
  const unit = data.current_units?.temperature_2m || "°C";

  document.querySelector("#location-name").textContent = [place.name, place.admin1, place.country].filter((part, index, arr) => part && arr.indexOf(part) === index).join(", ");
  document.querySelector("#local-time").textContent = `Local time: ${current.time.replace("T", " ")}`;
  document.querySelector("#weather-icon").textContent = icon;
  document.querySelector("#temperature").textContent = `${Math.round(current.temperature_2m)}°`;
  document.querySelector("#condition").textContent = description;
  document.querySelector("#feels-like").textContent = `Feels like ${Math.round(current.apparent_temperature)}${unit}`;
  document.querySelector("#weather-summary").textContent = current.is_day ? "Daytime conditions in your selected city." : "Night-time conditions in your selected city.";
  document.querySelector("#humidity").textContent = `${current.relative_humidity_2m}%`;
  document.querySelector("#wind-speed").textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  document.querySelector("#metric-feels-like").textContent = `${Math.round(current.apparent_temperature)}°`;
  document.querySelector("#cloud-cover").textContent = `${current.cloud_cover}%`;

  const hourly = data.hourly;
  const currentTime = new Date(current.time).getTime();
  let startIndex = hourly.time.findIndex(time => new Date(time).getTime() >= currentTime);
  if (startIndex < 0) startIndex = 0;
  const forecastContainer = document.querySelector("#hourly-forecast");
  forecastContainer.replaceChildren();

  hourly.time.slice(startIndex, startIndex + 6).forEach((time, offset) => {
    const index = startIndex + offset;
    const [hourDescription, hourIcon] = describeWeather(hourly.weather_code[index]);
    const card = document.createElement("article");
    card.className = "hour-card";
    const hour = document.createElement("span");
    hour.className = "hour-time";
    hour.textContent = offset === 0 ? "Now" : formatHour(time);
    const iconEl = document.createElement("div");
    iconEl.className = "hour-icon";
    iconEl.textContent = hourIcon;
    iconEl.setAttribute("aria-label", hourDescription);
    const temp = document.createElement("strong");
    temp.textContent = `${Math.round(hourly.temperature_2m[index])}°`;
    const rain = document.createElement("small");
    rain.textContent = `${hourly.precipitation_probability?.[index] ?? 0}% rain`;
    card.append(hour, iconEl, temp, rain);
    forecastContainer.append(card);
  });

  weatherContent.hidden = false;
}

async function searchWeather(city) {
  searchButton.disabled = true;
  searchButton.textContent = "Loading…";
  weatherContent.hidden = true;
  setStatus(`Searching for weather in ${city}…`);
  try {
    const place = await getCoordinates(city);
    const data = await getForecast(place.latitude, place.longitude);
    if (!data.current || !data.hourly) throw new Error("Weather data was incomplete. Please try another search.");
    renderWeather(place, data);
    setStatus(`Weather loaded for ${place.name}.`);
  } catch (error) {
    setStatus(error instanceof TypeError ? "Network error. Check your internet connection and try again." : error.message, true);
    console.error("Weather request failed:", error);
  } finally {
    searchButton.disabled = false;
    searchButton.innerHTML = 'Search <span aria-hidden="true">→</span>';
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const city = cityInput.value.trim();
  if (!city) {
    setStatus("Enter a city name to search.", true);
    cityInput.focus();
    return;
  }
  searchWeather(city);
});

// Load the default city when the page opens.
searchWeather(cityInput.value.trim() || "Indore");
