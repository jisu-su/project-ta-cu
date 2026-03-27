import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

export default function WebMap({ stations = [], coordinates = [], defaultCenter, currentLocation, onActionsReady }) {
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const currentLocationMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

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

        const zoomControl = new window.kakao.maps.ZoomControl();
        map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

        mapRef.current = map;
        setMapReady(true);

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
    if (!mapRef.current || !window.kakao || !mapReady) return;

    markersRef.current.forEach((item) => {
      if (item.infowindow) item.infowindow.close();
      if (item.marker) item.marker.setMap(null);
    });
    markersRef.current = [];

    stations.forEach((station) => {
      const marker = new window.kakao.maps.Marker({
        map: mapRef.current,
        position: new window.kakao.maps.LatLng(station.lat, station.lng),
        title: station.name
      });

      const infowindow = new window.kakao.maps.InfoWindow({
        content: `<div style="padding:6px;font-size:13px;color:#111;text-align:center;font-weight:600;min-width:140px;border-radius:6px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">${station.name}</div>`
      });

      window.kakao.maps.event.addListener(marker, "click", () => {
        infowindow.open(mapRef.current, marker);
      });

      markersRef.current.push({ marker, infowindow });
    });
  }, [stations, mapReady]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!mapRef.current || !window.kakao || !mapReady) return;

    if (currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current.setMap(null);
      currentLocationMarkerRef.current = null;
    }

    if (currentLocation) {
      const content = `<div style="width: 18px; height: 18px; background-color: #3B82F6; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 8px rgba(0,0,0,0.4);"></div>`;
      
      currentLocationMarkerRef.current = new window.kakao.maps.CustomOverlay({
        position: new window.kakao.maps.LatLng(currentLocation.latitude, currentLocation.longitude),
        content,
        map: mapRef.current
      });
    }
  }, [currentLocation, mapReady]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!mapRef.current || !window.kakao || !mapReady) return;

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
  }, [coordinates, mapReady]);

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
