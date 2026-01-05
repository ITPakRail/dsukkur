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
let stations = [];
let prevPoint = null;

async function loadTrain() {
  const trainId = document.getElementById("trainSelect").value;

  const res = await fetch(
    "https://script.google.com/macros/s/AKfycbxKJDzHI3cPTLrpePiU5ZS3FWgGCcnfSKRzPEtXqjIEKhH-C91RmyOI9oyyTDz0BoW-YQ/exec?trainId=" + trainId
  );

  const data = await res.json();

  // ✅ NORMALIZE station fields
  stations = data.Data.map(s => ({
    name: s.StationName,
    lat: Number(s.Latitude),
    lng: Number(s.Longitude),
    order: s.OrderNumber,
    schArrival: s.ArrivalTime
  }));

  connectSocket(trainId);
}


function connectSocket(trainId) {
  const socket = io("https://cotrolroomapi.pakraillive.com", {
    transports: ["websocket"]
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
  });

  socket.onAny((event, payload) => {
    console.log("Socket event:", event, payload);

    // payload must contain lat/lon
    if (payload && payload.lat && payload.lon) {
      updateStatus(payload);
    }
  });
}

function updateStatus(live) {
  const lat = live.lat;
  const lng = live.lon;
  const now = new Date(live.last_updated || Date.now());

  // Find nearest station
  let nearest = null;
  let minDist = Infinity;
  stations.forEach(s => {
    const d = haversine(lat, lng, s.lat, s.lng);
    if (d < minDist) {
      minDist = d;
      nearest = s;
    }
  });

  const idx = stations.findIndex(s => s.order === nearest.order);
  const lastStation = idx > 0 ? stations[idx - 1].name : "N/A";
  const nextStation = idx + 1 < stations.length ? stations[idx + 1].name : "End";

  // Speed
  let speed = "Calculating...";
  if (prevPoint) {
    const dist = haversine(prevPoint.lat, prevPoint.lng, lat, lng);
    const timeHr = (now - prevPoint.time) / 3600000;
    if (timeHr > 0) speed = (dist / timeHr).toFixed(0) + " km/hr";
  }
  prevPoint = { lat, lng, time: now };

  // Delay
  let delay = "N/A";
  if (stations[idx]?.schArrival) {
    const parts = stations[idx].schArrival.split(":");
    let schDate = new Date();
    schDate.setHours(Number(parts[0]));
    schDate.setMinutes(Number(parts[1]));
    schDate.setSeconds(Number(parts[2]));
    schDate.setMilliseconds(0);

    if (stations[idx].DayCount) {
      schDate.setDate(schDate.getDate() + stations[idx].DayCount);
    }

    const delayMin = Math.max(0, (now - schDate) / 60000);
    delay = `${Math.floor(delayMin / 60)} hr ${Math.floor(delayMin % 60)} min`;
  }

  document.getElementById("status").innerHTML = `
    <b>Last Station:</b> ${lastStation}<br>
    <b>Next Station:</b> ${nextStation}<br>
    <b>Speed:</b> ${speed}<br>
    <b>Delay:</b> ${delay}<br>
    <b>Lat/Lng:</b> ${lat.toFixed(6)}, ${lng.toFixed(6)}<br>
    <b>Updated:</b> ${now.toLocaleTimeString()}
  `;
}
