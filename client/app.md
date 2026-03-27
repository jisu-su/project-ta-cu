## App.jsx 역할 명세

> 이 문서는 `client/App.jsx`의 역할과 책임을 정의합니다.
> 앱 실행 시 가장 먼저 실행되는 진입점(entry point)으로, 클라이언트 전체 구성을 조립하는 파일입니다.


## 역할 개요  

`client/src/` 하위의 모든 구성요소(화면, 모듈, 폰트 등)를 하나의 앱으로 조립합니다.
개별 파일들은 각자의 역할만 수행하고, `App.jsx`가 이를 연결하여 실제로 동작하는 앱을 만듭니다.
```
앱 실행
    ↓
App.jsx 로드
    ↓
폰트 로드 (NotoSansKR-Regular.ttf via expo-font)
    ↓
네비게이션 스택 구성 (screens/ 연결)
    ↓
인증 상태 확인 → AuthScreen 또는 MapScreen 진입
```

---

## 책임 범위

### 1. 폰트 로드
- `expo-font`를 통해 `NotoSansKR-Regular.ttf` 로드
- 로드 완료 전까지 스플래시 스크린 유지 (`expo-splash-screen` 연동)
- 로드 완료 후 앱 UI 렌더링 시작

### 2. 네비게이션 스택 구성
- `screens/` 하위 화면들을 네비게이션 스택에 등록
- 화면 간 이동 흐름 정의

| 화면 | 진입 조건 |
|------|----------|
| `AuthScreen` | 비인증 사용자 진입 시 |
| `OnboardingScreen` | 회원가입 직후 1회 |
| `MapScreen` | 인증 완료 사용자 기본 화면 |
| `ReportScreen` | 이용 종료 후 자동 이동 |
| `ReportListScreen` | 사용자 탭 이동 |
| `MyPageScreen` | 사용자 탭 이동 |
| `QuizScreen` | 사용자 탭 이동 |
| `PermissionScreen` | 사용자 탭 이동 |

### 3. 인증 상태 관리
- 앱 실행 시 로그인 여부 확인
- 인증 여부에 따라 `AuthScreen` 또는 `MapScreen`으로 초기 진입 화면 분기

### 4. 전역 설정
- 앱 전반에 적용되는 공통 스타일, 테마 설정

---

## 규칙

- 비즈니스 로직을 직접 작성하지 않음. 로직은 반드시 `modules/` 또는 `screens/`에 위치
- 화면별 세부 UI 및 로직은 `screens/` 각 파일에 위임
- 재사용 컴포넌트는 `components/`에 위임

---