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

function connectSocket(trainId) {
  const socket = io("https://cotrolroomapi.pakraillive.com", {
    transports: ["websocket"]
  });

  socket.onAny((event, payload) => {
    if (payload?.lat && payload?.lon) {
      updateStatus(payload);
    }
  });
}

function updateStatus(live) {
  const lat = live.lat;
  const lng = live.lon;
  const now = new Date(live.last_updated || Date.now());

  // 🔹 Find last crossed station
  let lastIdx = -1;

  for (let i = 0; i < stations.length - 1; i++) {
    const dCurrent = haversine(lat, lng, stations[i].lat, stations[i].lng);
    const dNext = haversine(lat, lng, stations[i + 1].lat, stations[i + 1].lng);

    // Train has moved closer to next station → current is crossed
    if (dNext < dCurrent || dCurrent > 10) {
      lastIdx = i;
    } else {
      break;
    }
  }

  const lastStation =
    lastIdx >= 0 ? stations[lastIdx].name : "Start";

  const nextStation =
    lastIdx + 1 < stations.length
      ? stations[lastIdx + 1].name
      : "End";

  // 🔹 Speed
  let speed = "Calculating...";
  if (prevPoint) {
    const dist = haversine(prevPoint.lat, prevPoint.lng, lat, lng);
    const timeHr = (now - prevPoint.time) / 3600000;
    if (timeHr > 0) speed = (dist / timeHr).toFixed(0) + " km/hr";
  }
  prevPoint = { lat, lng, time: now };

  // 🔹 Delay (based on NEXT station)
  let delay = "N/A";
  const next = stations[lastIdx + 1];
  if (next?.schArrival) {
    const [h, m, s] = next.schArrival.split(":").map(Number);
    const sch = new Date();
    sch.setHours(h, m, s, 0);
    sch.setDate(sch.getDate() + next.dayCount);

    const diff = Math.max(0, (now - sch) / 60000);
    delay = `${Math.floor(diff / 60)} hr ${Math.floor(diff % 60)} min`;
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
