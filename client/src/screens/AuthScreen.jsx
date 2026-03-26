import React, { useMemo, useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import Button from "../components/Button";
import apiClient from "../modules/apiClient";
import { API_ENDPOINTS } from "../constants/apiConstants";
import { auth } from "../lib/firebase";

export default function AuthScreen({ navigation, onAuthed }) {
  const { width } = useWindowDimensions();
  const contentWidth = useMemo(() => Math.min(width, 480), [width]);
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("demo@tacu.app");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password || (mode === "register" && (!name || !passwordConfirm))) {
      Alert.alert("입력 필요", "이메일과 비밀번호를 입력해주세요.");
      return;
    }

    if (mode === "register" && password !== passwordConfirm) {
      Alert.alert("비밀번호 확인", "비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      const credential =
        mode === "login"
          ? await signInWithEmailAndPassword(auth, email, password)
          : await createUserWithEmailAndPassword(auth, email, password);

      if (mode === "register" && name) {
        await updateProfile(credential.user, { displayName: name });
      }

      const token = await credential.user.getIdToken();
      const finalName = credential.user.displayName || name || email.split("@")[0] || "user";

      let syncedUser = {};
      try {
        const syncResponse = await apiClient.patch(API_ENDPOINTS.authMe, {
          name: finalName,
          email: credential.user.email ?? email
        });
        syncedUser = syncResponse.data?.user || {};
      } catch (syncError) {
        throw new Error("user_sync_failed");
      }

      onAuthed({ token, user: syncedUser || null });
      navigation.replace(syncedUser.region ? "Map" : "Onboarding");
    } catch (error) {
      const code = error?.code || error?.message || "";
      let message = "로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요.";

      if (code === "auth/user-not-found") message = "해당 이메일의 계정이 없습니다.";
      if (code === "auth/wrong-password") message = "비밀번호가 올바르지 않습니다.";
      if (code === "auth/invalid-email") message = "이메일 형식이 올바르지 않습니다.";
      if (code === "auth/email-already-in-use") message = "이미 사용 중인 이메일입니다.";
      if (code === "user_sync_failed") message = "Firestore 계정 동기화에 실패했습니다. 다시 시도해주세요.";

      Alert.alert("로그인 실패", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.content, { maxWidth: contentWidth }]}>
        <Text style={styles.title}>타슈 탄소중립</Text>
        <Text style={styles.subtitle}>자전거 이용과 탄소 절감 기록</Text>

        {mode === "register" && (
          <TextInput style={styles.input} placeholder="이름" value={name} onChangeText={setName} />
        )}
        <TextInput
          style={styles.input}
          placeholder="이메일"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="비밀번호"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {mode === "register" && (
          <TextInput
            style={styles.input}
            placeholder="비밀번호 확인"
            secureTextEntry
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
          />
        )}

        <Button
          label={loading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
          onPress={submit}
          disabled={loading}
        />
        <Text style={styles.switch} onPress={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "회원가입 모드로 전환" : "로그인 모드로 전환"}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#F5FBF8"
  },
  content: {
    width: "100%",
    alignSelf: "center"
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0D6E4F",
    marginBottom: 6
  },
  subtitle: {
    color: "#60726B",
    marginBottom: 24
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#DDE7E2",
    marginBottom: 12
  },
  switch: {
    textAlign: "center",
    marginTop: 12,
    color: "#0D6E4F",
    fontWeight: "600"
  }
});
