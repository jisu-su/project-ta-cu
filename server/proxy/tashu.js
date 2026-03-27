const stations = [
  { id: "tashu_1", name: "대전역 1번 출구", address: "대전 동구 중앙로 215", lat: 36.3321, lng: 127.4343 },
  { id: "tashu_2", name: "유성온천역", address: "대전 유성구 봉명동", lat: 36.3536, lng: 127.3435 },
  { id: "tashu_3", name: "시청역", address: "대전 서구 둔산동", lat: 36.3512, lng: 127.3843 },
  { id: "tashu_4", name: "대전시청", address: "대전 서구 둔산로 100", lat: 36.3505, lng: 127.3848 }
];

function fetchStations() {
  return stations;
}

module.exports = {
  fetchStations
};
