function updateStatus(live) {
  const lat = live.lat;
  const lng = live.lon;
  const now = new Date(live.last_updated || Date.now());

  // 🔒 Progress forward only
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

  // ⏱ Delay (estimate using next station arrival)
  let delay = "N/A";
  const next = stations[currentStationIndex];
  if (next && next.schArrival) {
    const [h, m, s] = next.schArrival.split(":").map(Number);
    const sch = new Date();
    sch.setHours(h, m, s, 0);
    if (next.dayCount) sch.setDate(sch.getDate() + next.dayCount);

    const diffMin = Math.max(0, (now - sch) / 60000);
    delay = `${Math.floor(diffMin / 60)} hr ${Math.floor(diffMin % 60)} min`;
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
