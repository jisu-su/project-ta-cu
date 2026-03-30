import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import AppIcon from "../components/AppIcon";
import { signOut } from "firebase/auth";
import apiClient from "../modules/apiClient";
import { API_ENDPOINTS } from "../constants/apiConstants";
import WebMap from "../components/WebMap";
import Toast from "../components/Toast";
import { calculateCarbonReductionKg, calculateDistanceKm } from "../modules/carbonModule";
import { calculatePoints } from "../modules/pointModule";
import { endRideSession, getCurrentSession, startRideSession } from "../modules/rideModule";
import { logUsage } from "../modules/usageModule";
import { auth } from "../lib/firebase";

const DEFAULT_REGION = {
  latitude: 36.349231,
  longitude: 127.377484,
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

const GPS_TOAST_MESSAGE = "GPS가 불안정합니다.";

export default function MapScreen({ navigation, route, authUser, refreshAuthState }) {
  const { width } = useWindowDimensions();
  const shellWidth = useMemo(() => Math.min(width, 440), [width]);
  const [stations, setStations] = useState([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [riding, setRiding] = useState(false);
  const [session, setSession] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [rideId, setRideId] = useState(null);
  const [mapActions, setMapActions] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: "" });
  const toastTimerRef = useRef(null);
  const lastToastRef = useRef({ message: "", at: 0 });
  const drawerUserName = authUser?.name || auth.currentUser?.displayName || auth.currentUser?.email || auth.currentUser?.uid || "user";

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
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showGpsToast = (message = "GPS가 불안정합니다.") => {
    const now = Date.now();
    if (lastToastRef.current.message === message && now - lastToastRef.current.at < 3000) {
      return;
    }

    lastToastRef.current = { message, at: now };

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ visible: true, message });
    toastTimerRef.current = setTimeout(() => {
      setToast({ visible: false, message: "" });
      toastTimerRef.current = null;
    }, 2400);
  };

  const handleCurrentLocationToast = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      showGpsToast("현재 위치 기능을 사용할 수 없습니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCurrentLocation({ latitude: lat, longitude: lng });
        mapActions?.recenter?.([lat, lng], 3);
      },
      () => {
        showGpsToast("현재 위치를 가져올 수 없습니다.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
  };

  useEffect(() => {
    if (route?.params?.showGuide) {
      setShowGuide(true);
    }
  }, [route?.params?.showGuide]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (auth.currentUser && refreshAuthState) {
        void refreshAuthState(auth.currentUser).catch(() => null);
      }
    });

    return unsubscribe;
  }, [navigation, refreshAuthState]);

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

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleBeforeUnload = (event) => {
      if (!riding) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [riding]);

  const startRide = async () => {
    if (riding) return;

    try {
      const rideSession = await startRideSession({
        onLocationWarning: ({ type }) => {
          if (type === "low_accuracy" || type === "gps_unstable") {
            showGpsToast(GPS_TOAST_MESSAGE);
          }
        }
      });
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
        Alert.alert("위치 권한 필요", "주행 시작을 위해 위치 권한을 허용해 주세요.");
        return;
      }
      Alert.alert("주행 시작 실패", "주행 시작에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  const endRide = async ({ showReport = true } = {}) => {
    const activeSession = getCurrentSession() || session;
    const snapshot = activeSession ? { ...activeSession, coordinates: [...(activeSession.coordinates || [])] } : null;

    if (!snapshot) {
      if (showReport) {
        Alert.alert("주행 종료 실패", "주행 중인 세션이 없어 종료할 수 없습니다.");
      }
      return null;
    }

    if (!rideId) {
      if (showReport) {
        Alert.alert("주행 종료 실패", "주행 시작 정보가 없어 종료할 수 없습니다.");
      }
      return null;
    }

    try {
      const response = await apiClient.post(API_ENDPOINTS.rideEnd, {
        rideId,
        coordinates: snapshot.coordinates
      });

      const report = response.data?.report;
      if (!report) {
        throw new Error("missing_report");
      }

      await endRideSession().catch(() => null);
      setRiding(false);
      setSession(null);
      setShowReportSheet(false);
      setRideId(null);
      await logUsage("ride_end");

      if (showReport) {
        navigation.navigate("Report", { report });
      }

      return report;
    } catch (error) {
      if (showReport) {
        Alert.alert("주행 종료 실패", "서버에 이용 종료를 저장하지 못했습니다.");
      }
      throw error;
    }
  };

  const logout = () => {
    if (riding) {
      Alert.alert("이용 중단", "이용을 중단하고 앱을 종료하시겠습니까?", [
        { text: "아니요", style: "cancel" },
        {
          text: "종료",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await endRide({ showReport: false });
                await signOut(auth);
                setShowMenu(false);
                navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
              } catch (error) {
                Alert.alert("주행 종료 실패", "먼저 이용 종료를 완료해 주세요.");
              }
            })();
          }
        }
      ]);
      return;
    }

    void (async () => {
      await signOut(auth);
      setShowMenu(false);
      navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
    })();
  };

  const statusLabel = riding ? "이용 중" : "대기 중";
  const primaryButtonLabel = riding ? "이용 종료" : "이용 시작";
  const currentTimeLabel = formatElapsed(elapsedMs);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={[styles.shell, { maxWidth: shellWidth }]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>타슈 이용 지도</Text>
              <Text style={styles.subtitle}>{statusLabel}</Text>
            </View>

            <Pressable
              onPress={() => setShowMenu(true)}
              style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
            >
              <AppIcon name="bars" size={18} color="#374151" />
            </Pressable>
          </View>

          <View style={styles.mapWrap}>
            <WebMap
              stations={stations}
              coordinates={coordinates}
              defaultCenter={DEFAULT_REGION}
              currentLocation={currentLocation}
              onActionsReady={setMapActions}
            />

            {loadingStations && (
              <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
                <ActivityIndicator size="large" color="#066544" />
                <Text style={styles.loadingText}>대여소 정보를 불러오는 중...</Text>
              </View>
            )}

            <View pointerEvents="none" style={styles.centerBadgeWrap}>
              <View style={styles.centerBadge}>
                <AppIcon name="bicycle" size={13} color="#FFFFFF" />
              </View>
            </View>

            <Toast visible={toast.visible} message={toast.message} />


            <Pressable
              onPress={handleCurrentLocationToast}
              style={({ pressed }) => [styles.recenterButton, pressed && styles.pressed]}
              accessibilityRole="button"
                accessibilityLabel="현재 위치"
            >
              <AppIcon name="location-crosshairs" size={16} color="#066544" />
            </Pressable>

            <View style={styles.bottomOverlay}>
              <Pressable
                onPress={() => setShowReportSheet((prev) => !prev)}
                style={({ pressed }) => [styles.timeCard, pressed && styles.pressed]}
              >
                <View style={styles.timeCardLeft}>
                  <View style={styles.timeIcon}>
                    <AppIcon name="stopwatch" size={15} color="#066544" />
                  </View>
                  <View>
                    <Text style={styles.timeLabel}>이용 시간</Text>
                    <Text style={styles.timeValue}>{currentTimeLabel}</Text>
                  </View>
                </View>
                <AppIcon name="chevron-up" size={14} color="#9CA3AF" />
              </Pressable>

              <Pressable
                onPress={riding ? () => void endRide().catch(() => null) : startRide}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
              >
                <Text style={styles.primaryButtonText}>{primaryButtonLabel}</Text>
              </Pressable>
            </View>
          </View>

          <View pointerEvents="none" style={styles.homeIndicatorWrap}>
            <View style={styles.homeIndicator} />
          </View>
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
                  <AppIcon name="leaf" size={24} color="#FFFFFF" />
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
                      <AppIcon name="user" size={32} color="#FFFFFF" />
                    </View>
                    <View style={styles.drawerProfileTextWrap}>
                      <Text style={styles.drawerWelcome}>다시 만나서 반갑습니다.</Text>
                      <Text style={styles.drawerUserName} numberOfLines={1} ellipsizeMode="tail">
                        {drawerUserName}
                      </Text>
                    </View>
                  </View>
                </View>

                <Pressable onPress={() => setShowMenu(false)} style={({ pressed }) => [styles.drawerCloseButton, pressed && styles.pressed]}>
                  <AppIcon name="xmark" size={20} color="#FFFFFF" />
                </Pressable>
              </View>

              <View style={styles.drawerLogoutRow}>
                <Pressable onPress={logout} style={({ pressed }) => [styles.drawerLogoutButton, pressed && styles.pressed]}>
                   <Text style={styles.drawerLogoutText}>로그아웃</Text>
                  <AppIcon name="arrow-right" size={12} color="#FFFFFF" />
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
                    <AppIcon name="file-lines" size={18} color="#066544" />
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
                    <AppIcon name="user" size={18} color="#066544" />
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
                    <AppIcon name="circle-info" size={18} color="#066544" />
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
                    <AppIcon name="lightbulb" size={18} color="#066544" />
                  </View>
                  <View style={styles.drawerItemColumn}>
                     <Text style={styles.drawerItemText}>탄소 중립 퀴즈</Text>
                     <Text style={styles.drawerItemSubText}>자전거 이용 가능</Text>
                  </View>
                  <View style={styles.drawerDot} />
                </Pressable>
              </View>

              <View style={styles.drawerFooter}>
                <View style={styles.drawerFooterTop}>
                  <Pressable onPress={() => Alert.alert("준비 중", "도움말 센터는 아직 연결되지 않았습니다.")}>
                    <Text style={styles.drawerHelpLink}>도움말</Text>
                  </Pressable>
                </View>

                <View style={styles.drawerFooterBottom}>
                   <Text style={styles.drawerFooterMeta}>타슈 자전거 v2.4.0</Text>
                   <Text style={styles.drawerFooterMeta}>© 2024 Tashu</Text>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        <Modal transparent visible={showGuide} animationType="fade" onRequestClose={() => setShowGuide(false)}>
          <View style={styles.guideBackdrop}>
            <View style={styles.guideCard}>
               <Text style={styles.guideTitle}>자전거 이용 안내</Text>
               <Text style={styles.guideText}>1. 가까운 대여소 위치를 확인하고 이동 경로를 계획해 보세요.</Text>
               <Text style={styles.guideText}>2. 자전거 이용으로 자동차 이동을 줄이면 탄소 감축에 도움이 됩니다.</Text>
               <Text style={styles.guideText}>3. 이용 종료 후 리포트에서 거리, 탄소 감축, 포인트를 확인하세요.</Text>

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
  shell: {
    flex: 1,
    width: "100%",
    alignSelf: "center",
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
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingTop: 68,
    paddingBottom: 16
  },
  loadingOverlay: {
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#066544",
    fontWeight: "700"
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
  recenterButton: {
    position: "absolute",
    right: 28,
    bottom: 122,
    zIndex: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE7E2",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8
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






