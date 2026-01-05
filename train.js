/* =======================
   UTILITY
======================= */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* =======================
   GLOBAL STATE
======================= */
let stations = [];
let prevPoint = null;

let currentStationIndex = 0;
let crossedStations = new Set();

const STATION_RADIUS_KM = 5;

/* =======================
   LOAD TRAIN
======================= */
async function loadTrain() {
  const trainId = document.getElementById("trainSelect").value;

  // Reset state
  stations = [];
  prevPoint = null;
  currentStationIndex = 0;
  crossedStations.clear();

  const res = await fetch(
    "https://script.google.com/macros/s/AKfycbxKJDzHI3cPTLrpePiU5ZS3FWgGCcnfSKRzPEtXqjIEKhH-C91RmyOI9oyyTDz0BoW-YQ/exec?trainId=" + trainId
  );

  const data = await res.json();

  stations = data.Response
    .map(s => ({
      name: s.StationName,
      lat: Number(s.Latitude),
      lng: Number(s.Longitude),
      order: s.OrderNumber,
      schArrival: s.ArrivalTime,
      dayCount: s.DayCount || 0
    }))
    .sort((a, b) => a.order - b.order);

  connectSocket(trainId);
}

/* =======================
   SOCKET
======================= */
function connectSocket(trainId) {
  const socket = io("https://cotrolroomapi.pakraillive.com", {
    transports: ["websocket"]
  });

  socket.onAny((event, payload) => {
    if (payload && payload.lat && payload.lon) {
      updateStatus(payload);
    }
  });
}

/* =======================
   CORE LOGIC
======================= */
function updateStatus(live) {
  const lat = live.lat;
  const lng = live.lon;
  const now = new Date(live.last_updated || Date.now());

  // 🚉 Station progression (FORWARD ONLY)
  for (let i = currentStationIndex; i < stations.length; i++) {
    const s = stations[i];
    const d = haversine(lat, lng, s.lat, s.lng);

    if (d <= STATION_RADIUS_KM) {
      crossedStations.add(i);
      currentStationIndex = i + 1;
    } else {
      break;
    }
  }

  const lastIdx = currentStationIndex - 1;
  const lastStation = lastIdx >= 0 ? stations[lastIdx].name : "N/A";
  const nextStation =
    currentStationIndex < stations.length
      ? stations[currentStationIndex].name
      : "Destination";

  // 🚄 Speed
  let speed = "Calculating...";
  if (prevPoint) {
    const dist = haversine(prevPoint.lat, prevPoint.lng, lat, lng);
    const timeHr = (now - prevPoint.time) / 3600000;
    if (timeHr > 0) speed = (dist / timeHr).toFixed(0) + " km/hr";
  }
  prevPoint = { lat, lng, time: now };

  // ⏱ Delay (based on NEXT station)
  let delay = "N/A";
  const next = stations[currentStationIndex];
  if (next && next.schArrival) {
    const [h, m, s] = next.schArrival.split(":").map(Number);
    const sch = new Date();
    sch.setHours(h, m, s, 0);
    sch.setDate(sch.getDate() + (next.dayCount || 0));

    const diffMin = Math.max(0, (now - sch) / 60000);
    delay = `${Math.floor(diffMin / 60)} hr ${Math.floor(diffMin % 60)} min`;
  }

  // 📊 UI
  document.getElementById("status").innerHTML = `
    <b>Last Station:</b> ${lastStation}<br>
    <b>Next Station:</b> ${nextStation}<br>
    <b>Speed:</b> ${speed}<br>
    <b>Delay:</b> ${delay}<br>
    <b>Latitude:</b> ${lat.toFixed(6)}<br>
    <b>Longitude:</b> ${lng.toFixed(6)}<br>
    <b>Updated:</b> ${now.toLocaleTimeString()}
  `;
}
