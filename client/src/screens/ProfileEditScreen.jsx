import React, { useEffect, useMemo, useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { updateProfile } from "firebase/auth";
import Button from "../components/Button";
import ScreenHeader from "../components/ScreenHeader";
import apiClient from "../modules/apiClient";
import { API_ENDPOINTS } from "../constants/apiConstants";
import { auth } from "../lib/firebase";

export default function ProfileEditScreen({ navigation, authUser, onUpdated }) {
  const { width } = useWindowDimensions();
  const contentWidth = useMemo(() => Math.min(width, 520), [width]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const profileRes = await apiClient.get(API_ENDPOINTS.authMe).catch(() => null);
      const profile = profileRes?.data?.user || {};
      if (!mounted) return;
      setName(profile.name || authUser?.name || auth.currentUser?.displayName || "");
    };

    load();
    return () => {
      mounted = false;
    };
  }, [authUser?.name]);

  const save = async () => {
    const nextName = name.trim();
    if (!nextName) {
      Alert.alert("이름 필요", "이름을 입력해 주세요.");
      return;
    }

    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("로그인 필요", "다시 로그인해 주세요.");
        return;
      }

      if (currentUser.displayName !== nextName) {
        await updateProfile(currentUser, { displayName: nextName });
      }

      const response = await apiClient.patch(API_ENDPOINTS.authMe, { name: nextName });
      const syncedUser = response.data?.user || { ...(authUser || {}), name: nextName };
      onUpdated?.(syncedUser);
      navigation.goBack();
    } catch (error) {
      Alert.alert("이름 저장 실패", "이름을 저장하지 못했습니다. 네트워크와 로그인 상태를 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScreenHeader
          title="이름 변경"
          onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Map"))}
        />

        <View style={[styles.content, { maxWidth: contentWidth }]}>
          <Text style={styles.label}>현재 이름</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="새 이름을 입력해 주세요"
            autoCapitalize="none"
          />

          <Text style={styles.helper}>회원가입 시 입력한 이름을 여기서 수정할 수 있습니다.</Text>

          <Button label={loading ? "저장 중..." : "저장하기"} onPress={save} disabled={loading} />
        </View>
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
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 24
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 8
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#DDE7E2",
    fontSize: 16
  },
  helper: {
    marginTop: 10,
    marginBottom: 16,
    color: "#60726B"
  }
});
