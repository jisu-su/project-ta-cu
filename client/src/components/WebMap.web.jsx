import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";

export default function WebMap({ stations = [], coordinates = [], defaultCenter, currentLocation, onActionsReady }) {
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const currentLocationMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const mapListenersRef = useRef([]);

  const closeAllInfoWindows = () => {
    markersRef.current.forEach((item) => {
      if (item.infowindow) item.infowindow.close();
    });
  };

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
            defaultCenter?.latitude ?? 36.340242,
            defaultCenter?.longitude ?? 127.377457
          ),
          level: 3
        });

        const zoomControl = new window.kakao.maps.ZoomControl();
        map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

        mapRef.current = map;

        const closeOnMapInteraction = () => {
          closeAllInfoWindows();
        };

        window.kakao.maps.event.addListener(map, "click", closeOnMapInteraction);
        window.kakao.maps.event.addListener(map, "dragstart", closeOnMapInteraction);
        window.kakao.maps.event.addListener(map, "zoom_start", closeOnMapInteraction);
        mapListenersRef.current = [
          { target: map, event: "click", handler: closeOnMapInteraction },
          { target: map, event: "dragstart", handler: closeOnMapInteraction },
          { target: map, event: "zoom_start", handler: closeOnMapInteraction }
        ];

        onActionsReady?.({
          recenter: ([lat, lng], level = 3) => {
            map.setCenter(new window.kakao.maps.LatLng(lat, lng));
            map.setLevel(level);
          }
        });
      });
    };

    tryInit();

    return () => {
      cancelled = true;
      if (window.kakao?.maps?.event) {
        mapListenersRef.current.forEach(({ target, event, handler }) => {
          window.kakao.maps.event.removeListener(target, event, handler);
        });
      }
      mapListenersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!mapRef.current || !window.kakao) return;

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

      const availableBikes =
        station.parkingCount === null || station.parkingCount === undefined
          ? "정보없음"
          : `${station.parkingCount}대`;

      const infoContent = `
        <div style="padding:8px 10px;font-size:13px;color:#111;text-align:left;font-weight:600;min-width:160px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.12);line-height:1.35;">
          <div style="margin-bottom:4px;">${station.name}</div>
          <div style="font-size:12px;font-weight:500;color:#2f2f2f;">대여 가능: ${availableBikes}</div>
        </div>
      `;

      const infowindow = new window.kakao.maps.InfoWindow({ content: infoContent });

      window.kakao.maps.event.addListener(marker, "click", () => {
        closeAllInfoWindows();
        infowindow.open(mapRef.current, marker);
      });

      markersRef.current.push({ marker, infowindow });
    });
  }, [stations]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!mapRef.current || !window.kakao) return;

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
  }, [currentLocation]);

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
