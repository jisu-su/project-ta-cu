import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";

export default function WebMap({ stations = [], coordinates = [], defaultCenter, onActionsReady }) {
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== "web") return undefined;
    if (typeof window === "undefined") return undefined;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40;

    const tryInit = () => {
      if (cancelled) return;
      if (!window.kakao || !window.kakao.maps || !window.kakao.maps.load) {
        attempts += 1;
        if (attempts <= maxAttempts) {
          setTimeout(tryInit, 250);
        }
        return;
      }

      window.kakao.maps.load(() => {
        const container = document.getElementById("kakao-map");
        if (!container || cancelled) return;

        const map = new window.kakao.maps.Map(container, {
          center: new window.kakao.maps.LatLng(
            defaultCenter?.latitude ?? 36.3504,
            defaultCenter?.longitude ?? 127.3845
          ),
          level: 5
        });

        mapRef.current = map;

        onActionsReady?.({
          recenter: ([lat, lng], level = 5) => {
            map.setCenter(new window.kakao.maps.LatLng(lat, lng));
            map.setLevel(level);
          }
        });
      });
    };

    tryInit();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!mapRef.current || !window.kakao) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    stations.forEach((station) => {
      const marker = new window.kakao.maps.Marker({
        map: mapRef.current,
        position: new window.kakao.maps.LatLng(station.lat, station.lng),
        title: station.name
      });
      markersRef.current.push(marker);
    });
  }, [stations]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!mapRef.current || !window.kakao) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (coordinates.length < 2) return;

    const path = coordinates.map(
      (coord) => new window.kakao.maps.LatLng(coord.lat, coord.lng)
    );

    polylineRef.current = new window.kakao.maps.Polyline({
      map: mapRef.current,
      path,
      strokeWeight: 4,
      strokeColor: "#066544",
      strokeOpacity: 0.9,
      strokeStyle: "solid"
    });
  }, [coordinates]);

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
    flex: 1
  }
});
