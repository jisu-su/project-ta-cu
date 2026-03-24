import React, { useEffect, useRef } from "react";
import { Platform, View, StyleSheet } from "react-native";

/**
 * WebMap
 * 카카오맵 SDK를 사용하는 웹 전용 지도 컴포넌트
 *
 * props:
 *   stations       - 타슈 대여소 목록 [{ name, lat, lng, ... }]
 *   coordinates    - 주행 경로 좌표 배열 [{ lat, lng }, ...]
 *   defaultCenter  - 초기 중심 좌표 { latitude, longitude }
 *   onActionsReady - 지도 제어 함수(recenter)를 MapScreen에 역으로 전달하는 콜백
 */
export default function WebMap({ stations = [], coordinates = [], defaultCenter, onActionsReady }) {
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);

  // 지도 초기화 (최초 1회)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof window === "undefined" || !window.kakao) return;

    window.kakao.maps.load(() => {
      const container = document.getElementById("kakao-map");
      if (!container) return;

      const map = new window.kakao.maps.Map(container, {
        center: new window.kakao.maps.LatLng(
          defaultCenter?.latitude ?? 36.3504,
          defaultCenter?.longitude ?? 127.3845
        ),
        level: 5,
      });

      mapRef.current = map;

      // MapScreen의 recenter 버튼에서 호출할 함수 전달
      onActionsReady?.({
        recenter: ([lat, lng], level = 5) => {
          map.setCenter(new window.kakao.maps.LatLng(lat, lng));
          map.setLevel(level);
        },
      });
    });
  }, []);

  // 대여소 마커 표시 (stations 변경 시)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!mapRef.current || !window.kakao) return;

    // 기존 마커 제거
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    stations.forEach((station) => {
      const marker = new window.kakao.maps.Marker({
        map: mapRef.current,
        position: new window.kakao.maps.LatLng(station.lat, station.lng),
        title: station.name,
      });
      markersRef.current.push(marker);
    });
  }, [stations]);

  // 주행 경로 Polyline 표시 (coordinates 변경 시)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!mapRef.current || !window.kakao) return;

    // 기존 경로선 제거
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (coordinates.length < 2) return;

    const path = coordinates.map(
      (coord) => new window.kakao.maps.LatLng(coord.lat, coord.lng)
    );

    const polyline = new window.kakao.maps.Polyline({
      map: mapRef.current,
      path,
      strokeWeight: 4,
      strokeColor: "#066544",
      strokeOpacity: 0.9,
      strokeStyle: "solid",
    });

    polylineRef.current = polyline;
  }, [coordinates]);

  // 네이티브 환경은 빈 View 반환 (추후 WebView 방식으로 대응)
  if (Platform.OS !== "web") {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <div id="kakao-map" style={{ width: "100%", height: "100%" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});