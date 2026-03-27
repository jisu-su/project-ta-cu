# client/ 구조 흐름 요약

> `client/src/` 하위 디렉토리 간 역할 분리와 의존 흐름을 요약합니다.

---
   
## 전체 흐름
```
assets/         → 앱 전역에서 참조하는 정적 리소스 (이미지, 폰트)
constants/      → 계산 기준값·경로 상수 정의 (modules/에서 참조)
modules/        → 비즈니스 로직 처리 (screens/에서 호출)
components/     → 재사용 UI 단위 (screens/에서 조합)
screens/        → 화면 단위 진입점 (modules/ + components/ 조합)
```

---

## 디렉토리별 한 줄 역할 정의

| 디렉토리 | 역할 |
| --- | --- |
| `assets/` | 이미지, 폰트 등 정적 파일 보관 |
| `constants/` | 배출계수, 포인트 기준, 지역구 목록, API 경로 등 상수 단일 관리 |
| `modules/` | GPS 추적, 탄소 계산, 포인트 적립 등 비즈니스 로직 모듈화 |
| `components/` | 버튼, 카드, 지도 요소 등 화면 간 재사용 UI 컴포넌트 |
| `screens/` | 각 화면의 진입점. modules/와 components/를 조합하여 UI 구성 |

---

## 의존 방향

- `screens/` → `modules/` 호출, `components/` 조합
- `modules/` → `constants/` 참조
- `components/` → `constants/` 참조 (지역구 목록 등)
- `assets/` → `screens/`, `components/` 에서 직접 import
- 단방향 의존 유지: 하위 레이어(constants, assets)가 상위(screens)를 참조하지 않음

---

## 화면 × 모듈 연결 요약

| Screen | 연결 Module |
| --- | --- |
| `MapScreen` | `rideModule`, `carbonModule` |
| `ReportScreen` | `carbonModule`, `pointModule` |
| `MyPageScreen` | `pointModule` *(2차)* |
| `QuizScreen` | `usageModule` *(2차)* |
| `MapScreen` (QR 스캔) | `qrModule` |
| `OnboardingScreen` | — (constants만 참조) |
| `AuthScreen`, `PermissionScreen`, `ReportListScreen` | — (모듈 직접 연결 없음) |