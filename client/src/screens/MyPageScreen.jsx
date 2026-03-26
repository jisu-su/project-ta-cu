import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { FontAwesome6 } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import apiClient from "../modules/apiClient";
import { API_ENDPOINTS } from "../constants/apiConstants";
import { auth } from "../lib/firebase";
import { formatRegion } from "../utils/userFormatters";

function formatTimestamp(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function readBrowserLocationPermission() {
  if (typeof navigator === "undefined") return "사용 불가";

  if (navigator.permissions?.query) {
    try {
      const permission = await navigator.permissions.query({ name: "geolocation" });
      if (permission.state === "granted") return "허용됨";
      if (permission.state === "denied") return "차단됨";
      return "확인 필요";
    } catch (error) {
      return "사용 불가";
    }
  }

  return "브라우저 설정 확인";
}

export default function MyPageScreen({ navigation, authUser, refreshAuthState }) {
  const { width } = useWindowDimensions();
  const contentWidth = useMemo(() => Math.min(width, 520), [width]);
  const [balance, setBalance] = useState(0);
  const [logs, setLogs] = useState([]);
  const [locationStatus, setLocationStatus] = useState("확인 중...");

  const userName = authUser?.name || auth.currentUser?.displayName || auth.currentUser?.email || auth.currentUser?.uid || "user";
  const regionLabel = formatRegion(authUser?.region, { includeCity: true });

  const loadPage = useCallback(async () => {
    const permissionStatus = await readBrowserLocationPermission();
    setLocationStatus(permissionStatus);

    if (auth.currentUser && refreshAuthState) {
      await refreshAuthState(auth.currentUser).catch(() => null);
    }

    try {
      const [balanceRes, logRes] = await Promise.all([
        apiClient.get(API_ENDPOINTS.pointBalance),
        apiClient.get(API_ENDPOINTS.pointLog)
      ]);

      setBalance(balanceRes.data.balance || 0);
      setLogs(logRes.data.logs || []);
    } catch (error) {
      setBalance(0);
      setLogs([]);
    }
  }, [refreshAuthState]);

  useEffect(() => {
    loadPage();
    const unsubscribe = navigation.addListener("focus", loadPage);
    return unsubscribe;
  }, [loadPage, navigation]);

  const openPermissionSettings = async () => {
    if (Platform.OS === "web") {
      Alert.alert("브라우저 권한", "브라우저 주소창 또는 사이트 설정에서 위치 권한을 변경할 수 있습니다.");
      return;
    }

    try {
      await Linking.openSettings();
    } catch (error) {
      Alert.alert("설정 열기 실패", "기기 설정 화면을 열 수 없습니다.");
    }
  };

  const exchangePoints = () => {
    Alert.alert("준비 중", "포인트 교환 기능은 아직 준비 중입니다.");
  };

  const openHelpCenter = () => {
    Alert.alert("준비 중", "도움말 센터는 아직 연결되지 않았습니다.");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScreenHeader
          title="마이페이지"
          onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Map"))}
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { maxWidth: contentWidth }]}>
          <View style={styles.profileCard}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <FontAwesome6 name="user" size={34} color="#066544" />
              </View>

              <View style={styles.profileContent}>
                <View style={styles.profileTopRow}>
                  <Text style={styles.profileName} numberOfLines={1} ellipsizeMode="tail">
                    {userName}
                  </Text>
                  <Pressable
                    onPress={() => navigation.navigate("ProfileEdit")}
                    style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.editButtonText}>수정</Text>
                  </Pressable>
                </View>
                <Text style={styles.memberLabel}>회원</Text>
              </View>
            </View>
          </View>

          <View style={styles.regionCard}>
            <View style={styles.regionLeft}>
              <View style={styles.regionIconWrap}>
                <FontAwesome6 name="location-dot" size={18} color="#066544" />
              </View>

              <View>
                <Text style={styles.regionCaption}>현재 지역</Text>
                <Text style={styles.regionValue}>{regionLabel}</Text>
              </View>
            </View>

            <Pressable
              onPress={() => navigation.navigate("Onboarding")}
              style={({ pressed }) => [styles.regionArrowButton, pressed && styles.pressed]}
            >
              <FontAwesome6 name="chevron-right" size={16} color="#9CA3AF" />
            </Pressable>
          </View>

          <View style={styles.pointCard}>
            <View style={styles.pointCardTopRow}>
              <View>
                <Text style={styles.pointSubtitle}>보유 포인트</Text>
                <View style={styles.pointValueRow}>
                  <Text style={styles.pointValue}>{balance.toLocaleString()}</Text>
                  <Text style={styles.pointUnit}>P</Text>
                </View>
              </View>

              <View style={styles.pointIconWrap}>
                <FontAwesome6 name="coins" size={22} color="#FFFFFF" />
              </View>
            </View>

            <Pressable
              onPress={exchangePoints}
              style={({ pressed }) => [styles.exchangeButton, pressed && styles.pressed]}
            >
              <Text style={styles.exchangeButtonText}>포인트 교환</Text>
            </Pressable>
          </View>

          <View style={styles.logCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>포인트 내역</Text>
              <Pressable
                onPress={() => navigation.navigate("ReportList")}
                style={({ pressed }) => [styles.sectionLinkButton, pressed && styles.pressed]}
              >
                <Text style={styles.sectionLinkText}>전체 보기</Text>
                <FontAwesome6 name="chevron-right" size={10} color="#9CA3AF" />
              </Pressable>
            </View>

            <View style={styles.logList}>
              {logs.length === 0 ? (
                <Text style={styles.emptyText}>아직 포인트 적립 내역이 없습니다.</Text>
              ) : (
                logs.map((item, index) => (
                  <View key={item.id} style={styles.logRow}>
                    <View style={styles.logLeft}>
                      <View style={styles.logIconWrap}>
                        <FontAwesome6 name={index % 2 === 0 ? "lightbulb" : "chart-line"} size={18} color="#9CA3AF" />
                      </View>
                      <View>
                        <Text style={styles.logTitle}>{index % 2 === 0 ? "탄소 절감 보상" : "이용 보상"}</Text>
                        <Text style={styles.logDate}>{formatTimestamp(item.earnedAt)}</Text>
                      </View>
                    </View>

                    <Text style={styles.logAmount}>+{item.amount.toLocaleString()} P</Text>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>권한</Text>

            <View style={styles.permissionList}>
              <View style={styles.permissionRow}>
                <Text style={styles.permissionLabel}>위치</Text>
                <Text style={styles.permissionStatusGranted}>{locationStatus}</Text>
              </View>

              <View style={styles.permissionRow}>
                <Text style={styles.permissionLabel}>알림</Text>
                <Text style={styles.permissionStatusMuted}>설정 예정</Text>
              </View>
            </View>

            <Pressable
              onPress={openPermissionSettings}
              style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}
            >
              <Text style={styles.permissionButtonText}>권한 관리</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={openHelpCenter}
              style={({ pressed }) => [styles.helpLink, pressed && styles.pressed]}
            >
              <Text style={styles.helpLinkText}>도움말</Text>
            </Pressable>

            <View style={styles.footerMetaRow}>
              <Text style={styles.footerMeta}>타슈 탄소중립 v2.4.0</Text>
              <Text style={styles.footerMeta}>© 2024 Tashu</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAF9"
  },
  screen: {
    flex: 1,
    backgroundColor: "#F8FAF9"
  },
  content: {
    flexGrow: 1,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 16
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(6,101,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(6,101,68,0.18)",
    alignItems: "center",
    justifyContent: "center"
  },
  profileContent: {
    flex: 1
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  profileName: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: "#111827"
  },
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(6,101,68,0.3)",
    backgroundColor: "#FFFFFF"
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#066544"
  },
  memberLabel: {
    marginTop: 6,
    fontSize: 14,
    color: "#6B7280"
  },
  regionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  regionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  regionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#EFF6F3",
    alignItems: "center",
    justifyContent: "center"
  },
  regionCaption: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  regionValue: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: "800",
    color: "#1F2937"
  },
  regionArrowButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  pointCard: {
    backgroundColor: "#066544",
    borderRadius: 22,
    padding: 22,
    shadowColor: "#066544",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  pointCardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12
  },
  pointSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.72)"
  },
  pointValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 6
  },
  pointValue: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  pointUnit: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  pointIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center"
  },
  exchangeButton: {
    marginTop: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center"
  },
  exchangeButtonText: {
    color: "#066544",
    fontWeight: "800",
    fontSize: 14
  },
  logCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937"
  },
  sectionLinkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  sectionLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF"
  },
  logList: {
    gap: 16
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280"
  },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  logLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  logIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center"
  },
  logTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937"
  },
  logDate: {
    marginTop: 2,
    fontSize: 11,
    color: "#9CA3AF"
  },
  logAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#066544"
  },
  permissionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2
  },
  permissionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#9CA3AF",
    marginBottom: 14
  },
  permissionList: {
    gap: 0
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6"
  },
  permissionLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937"
  },
  permissionStatusGranted: {
    fontSize: 16,
    fontWeight: "800",
    color: "#066544"
  },
  permissionStatusMuted: {
    fontSize: 16,
    fontWeight: "800",
    color: "#9CA3AF"
  },
  permissionButton: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 10
  },
  permissionButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
    textDecorationLine: "underline"
  },
  footer: {
    paddingVertical: 8,
    paddingBottom: 12
  },
  helpLink: {
    alignSelf: "flex-end",
    marginBottom: 16
  },
  helpLinkText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
    textDecorationLine: "underline"
  },
  footerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  footerMeta: {
    fontSize: 10,
    color: "#9CA3AF"
  },
  pressed: {
    opacity: 0.88
  }
});
