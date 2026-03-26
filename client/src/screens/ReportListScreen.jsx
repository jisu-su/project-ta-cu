import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import apiClient from "../modules/apiClient";
import { API_ENDPOINTS } from "../constants/apiConstants";
import ReportCard from "../components/ReportCard";
import ScreenHeader from "../components/ScreenHeader";

export default function ReportListScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const contentWidth = useMemo(() => Math.min(width, 520), [width]);
  const [reports, setReports] = useState([]);

  const loadReports = useCallback(async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.reportList);
      setReports(response.data.reports || []);
    } catch (error) {
      setReports([]);
    }
  }, []);

  useEffect(() => {
    loadReports();
    const unsubscribe = navigation.addListener("focus", loadReports);
    return unsubscribe;
  }, [navigation, loadReports]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        <ScreenHeader
          title="이용 리포트 목록"
          onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Map"))}
        />

        <ScrollView contentContainerStyle={[styles.content, { maxWidth: contentWidth }]}>
          <Text style={styles.title}>누적 리포트</Text>
          {reports.length === 0 ? (
            <Text style={styles.empty}>아직 이용 리포트가 없습니다.</Text>
          ) : (
            reports.map((report) => (
              <View key={report.id}>
                <ReportCard report={report} />
                <Pressable
                  onPress={() => navigation.navigate("Report", { report })}
                  style={({ pressed }) => [styles.detailButton, pressed && styles.pressed]}
                >
                  <Text style={styles.detailButtonText}>상세 보기</Text>
                </Pressable>
              </View>
            ))
          )}
          <Pressable
            onPress={() => navigation.navigate("Map")}
            style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}
          >
            <Text style={styles.mapButtonText}>지도 화면으로</Text>
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5FBF8"
  },
  screen: {
    flex: 1,
    backgroundColor: "#F5FBF8"
  },
  content: {
    flexGrow: 1,
    padding: 24,
    width: "100%",
    alignSelf: "center"
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
    color: "#111827"
  },
  empty: {
    color: "#60726B",
    marginTop: 20
  },
  detailButton: {
    marginBottom: 12,
    backgroundColor: "#066544",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  detailButtonText: {
    color: "#FFFFFF",
    fontWeight: "800"
  },
  mapButton: {
    marginTop: 8,
    backgroundColor: "#066544",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  mapButtonText: {
    color: "#FFFFFF",
    fontWeight: "800"
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }]
  }
});
