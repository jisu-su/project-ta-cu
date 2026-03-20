import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signOut } from "firebase/auth";
import apiClient from "../modules/apiClient";
import { API_ENDPOINTS } from "../constants/apiConstants";
import { calculateCarbonReductionKg, calculateDistanceKm } from "../modules/carbonModule";
import { calculatePoints } from "../modules/pointModule";
import { endRideSession, getCurrentSession, startRideSession } from "../modules/rideModule";
import { logUsage } from "../modules/usageModule";
import { auth } from "../lib/firebase";

const DEFAULT_REGION = {
  latitude: 36.3504,
  longitude: 127.3845,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05
};

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatDistance(distanceKm) {
  return distanceKm.toFixed(1);
}

export default function MapScreen({ navigation, route }) {
  const isWeb = Platform.OS === "web";
  const MapView = isWeb ? null : require("react-native-maps").default;
  const MapMarker = isWeb ? null : require("../components/MapMarker").default;
  const RoutePolyline = isWeb ? null : require("../components/RoutePolyline").default;

  const [stations, setStations] = useState([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [riding, setRiding] = useState(false);
  const [session, setSession] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [drawerUserName, setDrawerUserName] = useState("");
  const [drawerRegion, setDrawerRegion] = useState("");
  const [rideId, setRideId] = useState(null);

  const coordinates = useMemo(() => session?.coordinates ?? [], [session]);
  const elapsedMs = useMemo(() => {
    if (!session) return 0;
    return (session.endTime ?? Date.now()) - session.startTime;
  }, [session]);

  const liveReport = useMemo(() => {
    if (!session) {
      return {
        distanceKm: 0,
        carbonReductionKg: 0,
        pointsEarned: 0,
        durationMin: 0
      };
    }

    const distanceKm = calculateDistanceKm(coordinates);
    const carbonReductionKg = calculateCarbonReductionKg(distanceKm);
    const pointsEarned = calculatePoints(distanceKm, carbonReductionKg);
    const durationMin = Math.max(0, Math.floor(elapsedMs / 60000));

    return {
      distanceKm,
      carbonReductionKg,
      pointsEarned,
      durationMin
    };
  }, [coordinates, elapsedMs, session]);

  useEffect(() => {
    if (route?.params?.showGuide) {
      setShowGuide(true);
    }
  }, [route?.params?.showGuide]);

  useEffect(() => {
    const loadDrawerProfile = async () => {
      const [storedName, storedId, storedRegion, profileRes] = await Promise.all([
        AsyncStorage.getItem("user_name"),
        AsyncStorage.getItem("user_id"),
        AsyncStorage.getItem("user_region"),
        apiClient.get(API_ENDPOINTS.authMe).catch(() => null)
      ]);
      const profile = profileRes?.data?.user || {};
      setDrawerUserName(profile.name || storedName || storedId || "user");
      setDrawerRegion(profile.region || storedRegion || "yuseong");
    };

    loadDrawerProfile();
  }, []);

  useEffect(() => {
    const loadStations = async () => {
      try {
        const response = await apiClient.get(API_ENDPOINTS.mapStations);
        setStations(response.data.stations || []);
      } catch (error) {
        setStations([]);
      } finally {
        setLoadingStations(false);
      }
    };

    loadStations();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const current = getCurrentSession();
      if (current) {
        setSession({ ...current, coordinates: [...current.coordinates] });
        setRiding(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const startRide = async () => {
    try {
      const rideSession = await startRideSession();
      const response = await apiClient.post(API_ENDPOINTS.rideStart);
      const startedRideId = response.data?.rideId;
      if (!startedRideId) {
        throw new Error("missing_ride_id");
      }

      await logUsage("ride_start");
      setRideId(startedRideId);
      setSession({ ...rideSession });
      setRiding(true);
    } catch (error) {
      await endRideSession().catch(() => null);
      setSession(null);
      setRiding(false);
      setRideId(null);
      if (error?.message === "location_permission_denied") {
        Alert.alert("위치 권한 필요", "주행 시작을 위해 위치 권한을 허용해주세요.");
        return;
      }
      Alert.alert("주행 시작 실패", "주행 시작에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const endRide = async () => {
    const finished = await endRideSession();
    if (!finished) return;

    if (!rideId) {
      Alert.alert("주행 종료 실패", "주행 시작 정보가 없어 종료할 수 없습니다.");
      return;
    }

    try {
      const response = await apiClient.post(API_ENDPOINTS.rideEnd, {
        rideId,
        coordinates: finished.coordinates
      });

      const report = response.data?.report;
      if (!report) {
        throw new Error("missing_report");
      }

      setRiding(false);
      setSession(null);
      setShowReportSheet(false);
      setRideId(null);
      await logUsage("ride_end");
      navigation.navigate("Report", { report });
    } catch (error) {
      Alert.alert("주행 종료 실패", "서버에 이용 종료를 저장하지 못했습니다.");
    }
  };

  const logout = async () => {
    await signOut(auth);
    await AsyncStorage.multiRemove(["auth_token", "user_id", "user_email", "user_name", "user_region"]);
    setShowMenu(false);
    navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
  };

  const statusLabel = riding ? "이용 중" : "대기 중";
  const primaryButtonLabel = riding ? "이용 종료" : "이용 시작";
  const currentTimeLabel = formatElapsed(elapsedMs);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>타슈 이용 지도</Text>
            <Text style={styles.subtitle}>{statusLabel}</Text>
          </View>

          <Pressable
            onPress={() => setShowMenu(true)}
            style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
          >
            <FontAwesome6 name="bars" size={18} color="#374151" />
          </Pressable>
        </View>

        <View style={styles.mapWrap}>
          {isWeb ? (
            <View style={[StyleSheet.absoluteFill, styles.webMapFallback]}>
              <FontAwesome6 name="globe" size={20} color="#0f172a" />
              <Text style={styles.webMapTitle}>웹에서는 지도가 비활성화됩니다</Text>
              <Text style={styles.webMapSubtitle}>모바일에서 지도를 확인할 수 있어요.</Text>
            </View>
          ) : (
            <MapView
              style={StyleSheet.absoluteFill}
              initialRegion={DEFAULT_REGION}
              showsUserLocation
              showsMyLocationButton={false}
            >
              {!loadingStations && stations.map((station) => (
                <MapMarker key={station.id} station={station} />
              ))}
              <RoutePolyline coordinates={coordinates} />
            </MapView>
          )}

          <View pointerEvents="none" style={styles.centerBadgeWrap}>
            <View style={styles.centerBadge}>
              <FontAwesome6 name="bicycle" size={13} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.bottomOverlay}>
            <Pressable
              onPress={() => setShowReportSheet((prev) => !prev)}
              style={({ pressed }) => [styles.timeCard, pressed && styles.pressed]}
            >
              <View style={styles.timeCardLeft}>
                <View style={styles.timeIcon}>
                  <FontAwesome6 name="stopwatch" size={15} color="#066544" />
                </View>
                <View>
                  <Text style={styles.timeLabel}>이용 시간</Text>
                  <Text style={styles.timeValue}>{currentTimeLabel}</Text>
                </View>
              </View>
              <FontAwesome6 name="chevron-up" size={14} color="#9CA3AF" />
            </Pressable>

            <Pressable
              onPress={riding ? endRide : startRide}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
            >
              <Text style={styles.primaryButtonText}>{primaryButtonLabel}</Text>
            </Pressable>
          </View>
        </View>

        <View pointerEvents="none" style={styles.homeIndicatorWrap}>
          <View style={styles.homeIndicator} />
        </View>

        <Modal transparent visible={showReportSheet} animationType="slide" onRequestClose={() => setShowReportSheet(false)}>
          <View style={styles.sheetBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowReportSheet(false)} />

            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>실시간 이용 리포트</Text>

              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>이동 거리</Text>
                  <Text style={styles.statValue}>
                    {formatDistance(liveReport.distanceKm)} <Text style={styles.statUnit}>km</Text>
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>이용 시간</Text>
                  <Text style={styles.statValue}>
                    {liveReport.durationMin} <Text style={styles.statUnit}>분</Text>
                  </Text>
                </View>
              </View>

              <View style={styles.greenSummary}>
                <View>
                  <Text style={styles.greenLabel}>실시간 탄소 감축량</Text>
                  <Text style={styles.greenValue}>
                    {liveReport.carbonReductionKg.toFixed(2)} <Text style={styles.greenUnit}>kg</Text>
                  </Text>
                </View>

                <View style={styles.leafIcon}>
                  <FontAwesome6 name="leaf" size={24} color="#FFFFFF" />
                </View>
              </View>

              <View style={styles.pointsRow}>
                <Text style={styles.pointsLabel}>적립 포인트</Text>
                <Text style={styles.pointsValue}>{liveReport.pointsEarned} P</Text>
              </View>

              <Pressable
                onPress={() => setShowReportSheet(false)}
                style={({ pressed }) => [styles.sheetCloseButton, pressed && styles.pressed]}
              >
                <Text style={styles.sheetCloseText}>닫기</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal transparent visible={showMenu} animationType="fade" onRequestClose={() => setShowMenu(false)}>
          <View style={styles.drawerRoot}>
            <Pressable style={styles.drawerOverlay} onPress={() => setShowMenu(false)} />

            <View style={styles.drawerPanel}>
              <View style={styles.drawerHeader}>
                <View>
                  <View style={styles.drawerProfileRow}>
                    <View style={styles.drawerAvatar}>
                      <FontAwesome6 name="user" size={32} color="#FFFFFF" />
                    </View>
                    <View style={styles.drawerProfileTextWrap}>
                      <Text style={styles.drawerWelcome}>Welcome back,</Text>
                      <Text style={styles.drawerUserName} numberOfLines={1} ellipsizeMode="tail">
                        {drawerUserName}
                      </Text>
                    </View>
                  </View>
                </View>

                <Pressable onPress={() => setShowMenu(false)} style={({ pressed }) => [styles.drawerCloseButton, pressed && styles.pressed]}>
                  <FontAwesome6 name="xmark" size={20} color="#FFFFFF" />
                </Pressable>
              </View>

              <View style={styles.drawerLogoutRow}>
                <Pressable onPress={logout} style={({ pressed }) => [styles.drawerLogoutButton, pressed && styles.pressed]}>
                  <Text style={styles.drawerLogoutText}>Logout</Text>
                  <FontAwesome6 name="arrow-right" size={12} color="#FFFFFF" />
                </Pressable>
              </View>

              <View style={styles.drawerBody}>
                <Pressable
                  style={styles.drawerItem}
                  onPress={() => {
                    setShowMenu(false);
                    navigation.navigate("ReportList");
                  }}
                >
                  <View style={styles.drawerItemIconWrap}>
                    <FontAwesome6 name="file-lines" size={18} color="#066544" />
                  </View>
                  <Text style={styles.drawerItemText}>이용 리포트 목록</Text>
                </Pressable>

                <Pressable
                  style={styles.drawerItem}
                  onPress={() => {
                    setShowMenu(false);
                    navigation.navigate("MyPage");
                  }}
                >
                  <View style={styles.drawerItemIconWrap}>
                    <FontAwesome6 name="user" size={18} color="#066544" />
                  </View>
                  <Text style={styles.drawerItemText}>마이페이지</Text>
                </Pressable>

                <Pressable
                  style={styles.drawerItem}
                  onPress={() => {
                    setShowMenu(false);
                    setShowGuide(true);
                  }}
                >
                  <View style={styles.drawerItemIconWrap}>
                    <FontAwesome6 name="circle-info" size={18} color="#066544" />
                  </View>
                  <Text style={styles.drawerItemText}>이용 안내</Text>
                </Pressable>

                <Pressable
                  style={styles.drawerItem}
                  onPress={() => {
                    setShowMenu(false);
                    navigation.navigate("Quiz");
                  }}
                >
                  <View style={styles.drawerItemIconWrap}>
                    <FontAwesome6 name="lightbulb" size={18} color="#066544" />
                  </View>
                  <View style={styles.drawerItemColumn}>
                    <Text style={styles.drawerItemText}>탄소 중립 퀴즈</Text>
                    <Text style={styles.drawerItemSubText}>포인트 적립 가능!</Text>
                  </View>
                  <View style={styles.drawerDot} />
                </Pressable>

                <View style={styles.drawerDividerRow}>
                  <View style={styles.drawerDivider} />
                </View>

                <Pressable
                  style={styles.drawerItem}
                  onPress={() => {
                    setShowMenu(false);
                    navigation.navigate("Onboarding");
                  }}
                >
                  <View style={styles.drawerItemIconWrap}>
                    <FontAwesome6 name="location-dot" size={18} color="#066544" />
                  </View>
                  <View style={styles.drawerItemColumn}>
                    <Text style={styles.drawerRegionCaption}>현재 지역 설정</Text>
                    <Text style={styles.drawerRegionValue}>{drawerRegion.toLowerCase()}</Text>
                  </View>
                  <FontAwesome6 name="chevron-down" size={14} color="#9CA3AF" style={styles.drawerArrow} />
                </Pressable>
              </View>

              <View style={styles.drawerFooter}>
                <View style={styles.drawerFooterTop}>
                  <Pressable onPress={() => Alert.alert("준비 중", "Help Center는 아직 준비 중입니다.")}>
                    <Text style={styles.drawerHelpLink}>Help Center</Text>
                  </Pressable>
                </View>

                <View style={styles.drawerFooterBottom}>
                  <Text style={styles.drawerFooterMeta}>Tashu Carbon Neutrality v2.4.0</Text>
                  <Text style={styles.drawerFooterMeta}>© 2024 Tashu</Text>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        <Modal transparent visible={showGuide} animationType="fade" onRequestClose={() => setShowGuide(false)}>
          <View style={styles.guideBackdrop}>
            <View style={styles.guideCard}>
              <Text style={styles.guideTitle}>이용 시작 안내</Text>
              <Text style={styles.guideText}>1. 지도에서 대여소 위치를 확인하세요.</Text>
              <Text style={styles.guideText}>2. 이용 시작 버튼을 눌러 주행을 시작하세요.</Text>
              <Text style={styles.guideText}>3. 이용 종료 후 리포트를 확인하세요.</Text>

              <Pressable
                onPress={() => setShowGuide(false)}
                style={({ pressed }) => [styles.guideCloseButton, pressed && styles.pressed]}
              >
                <Text style={styles.guideCloseText}>확인</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5FBF8"
  },
  screen: {
    flex: 1,
    backgroundColor: "#F5FBF8"
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827"
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "#6B7280"
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },
  mapWrap: {
    flex: 1,
    overflow: "hidden"
  },
  webMapFallback: {
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24
  },
  webMapTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A"
  },
  webMapSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "#475569",
    textAlign: "center"
  },
  centerBadgeWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -16 }, { translateY: -16 }],
    zIndex: 5
  },
  centerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#066544",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  bottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14
  },
  timeCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#EFF2F1",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },
  timeCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  timeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(6,101,68,0.10)",
    alignItems: "center",
    justifyContent: "center"
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  timeValue: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: "800",
    color: "#111827"
  },
  primaryButton: {
    backgroundColor: "#066544",
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#066544",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10
  },
  primaryButtonPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }]
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800"
  },
  homeIndicatorWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 6,
    zIndex: 12,
    alignItems: "center"
  },
  homeIndicator: {
    width: 120,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#D1D5DB"
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 24,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
    elevation: 20
  },
  sheetHandle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 18
  },
  sheetTitle: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 18
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16
  },
  statCard: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EEF2F7"
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 4
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827"
  },
  statUnit: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600"
  },
  greenSummary: {
    backgroundColor: "#066544",
    borderRadius: 24,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#066544",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12
  },
  greenLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4
  },
  greenValue: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800"
  },
  greenUnit: {
    fontSize: 16,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "600"
  },
  leafIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center"
  },
  pointsRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4
  },
  pointsLabel: {
    fontSize: 15,
    color: "#4B5563",
    fontWeight: "600"
  },
  pointsValue: {
    fontSize: 18,
    color: "#111827",
    fontWeight: "800"
  },
  sheetCloseButton: {
    width: "100%",
    marginTop: 18,
    paddingVertical: 12,
    alignItems: "center"
  },
  sheetCloseText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "700"
  },
  menuBackdrop: {
    flex: 1
  },
  drawerRoot: {
    flex: 1,
    flexDirection: "row"
  },
  drawerOverlay: {
    width: "20%",
    backgroundColor: "rgba(0,0,0,0.5)"
  },
  drawerPanel: {
    width: "80%",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: -8, height: 0 },
    elevation: 20,
    flexDirection: "column"
  },
  drawerHeader: {
    backgroundColor: "#066544",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 22,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  drawerProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16
  },
  drawerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)"
  },
  drawerProfileTextWrap: {
    maxWidth: 180
  },
  drawerWelcome: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 2
  },
  drawerUserName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  drawerCloseButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.12)"
  },
  drawerLogoutRow: {
    backgroundColor: "#066544",
    paddingHorizontal: 24,
    paddingBottom: 18,
    alignItems: "flex-end"
  },
  drawerLogoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  drawerLogoutText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    textDecorationLine: "underline"
  },
  drawerBody: {
    flex: 1,
    paddingVertical: 8
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 24
  },
  drawerItemIconWrap: {
    width: 34,
    height: 34,
    marginRight: 16,
    borderRadius: 10,
    backgroundColor: "rgba(6,101,68,0.06)",
    alignItems: "center",
    justifyContent: "center"
  },
  drawerItemText: {
    fontSize: 15,
    fontWeight: "700"
  },
  drawerItemColumn: {
    flex: 1
  },
  drawerItemSubText: {
    marginTop: 2,
    fontSize: 12,
    color: "#066544",
    fontWeight: "700"
  },
  drawerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    marginLeft: 10
  },
  drawerDividerRow: {
    paddingHorizontal: 24,
    paddingVertical: 8
  },
  drawerDivider: {
    height: 1,
    backgroundColor: "#EEF2F7",
    width: "100%"
  },
  drawerRegionCaption: {
    fontSize: 12,
    color: "#9CA3AF"
  },
  drawerRegionValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "800",
    color: "#066544",
    textTransform: "uppercase"
  },
  drawerArrow: {
    marginLeft: 12
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: "#F9FAFB"
  },
  drawerFooterTop: {
    alignItems: "flex-end",
    marginBottom: 16
  },
  drawerHelpLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
    textDecorationLine: "underline"
  },
  drawerFooterBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  drawerFooterMeta: {
    fontSize: 10,
    color: "#9CA3AF"
  },
  guideBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24
  },
  guideCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 18
  },
  guideTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12
  },
  guideText: {
    fontSize: 14,
    color: "#4B5563",
    marginBottom: 8,
    lineHeight: 20
  },
  guideCloseButton: {
    marginTop: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#F3F4F6"
  },
  guideCloseText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "700"
  },
  pressed: {
    opacity: 0.88
  }
});
