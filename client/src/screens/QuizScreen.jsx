import React, { useEffect, useMemo, useState } from "react";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Button from "../components/Button";
import QuizItem from "../components/QuizItem";
import ScreenHeader from "../components/ScreenHeader";
import apiClient from "../modules/apiClient";
import { API_ENDPOINTS } from "../constants/apiConstants";
import { auth } from "../lib/firebase";

export default function QuizScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const contentWidth = useMemo(() => Math.min(width, 520), [width]);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get(API_ENDPOINTS.quizQuestions);
        setQuestions(res.data.questions || []);
      } catch (error) {
        setQuestions([]);
      }
    };
    load();
  }, []);

  const submit = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("로그인 필요", "다시 로그인해 주세요.");
      return;
    }

    try {
      const res = await apiClient.post(API_ENDPOINTS.quizSubmit, {
        answers
      });
      Alert.alert("퀴즈 제출 완료", `점수: ${res.data.score}`);
      navigation.navigate("Map");
    } catch (error) {
      Alert.alert("제출 실패", "서버 연결 상태를 확인해 주세요.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        <ScreenHeader
          title="탄소 절감 퀴즈"
          onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Map"))}
        />

        <ScrollView contentContainerStyle={[styles.content, { maxWidth: contentWidth }]}>
          <Text style={styles.title}>퀴즈로 포인트를 받아보세요</Text>
          {questions.length === 0 ? (
            <Text style={styles.empty}>질문을 불러오는 중...</Text>
          ) : (
            questions.map((q) => (
              <QuizItem
                key={q.id}
                item={q}
                selected={answers[q.id]}
                onSelect={(choice) => setAnswers((prev) => ({ ...prev, [q.id]: choice }))}
              />
            ))
          )}
          <Button label="제출" onPress={submit} />
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
    color: "#60726B"
  }
});
