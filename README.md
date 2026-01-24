# 재홍샘 블로그

IT, AI, 교육에 관한 이야기를 나누는 개인 블로그입니다.

## 🚀 기능

- **블로그 포스팅**: IT, AI, 교육 관련 콘텐츠 작성
- **카테고리 필터링**: IT, AI, 교육 카테고리별 필터
- **✍️ 자동 블로그 포스팅**: 매일 주요 뉴스 1개를 선정하여 분석 포스트 자동 생성
  - IT → AI → 교육 순으로 카테고리 로테이션
  - Claude AI가 뉴스를 분석하여 인사이트 있는 글 작성
- **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원
- **관리자 페이지**: 포스트 작성 및 관리

## 📁 프로젝트 구조

```
blog/
├── .github/
│   └── workflows/
│       └── daily-news.yml    # 자동 뉴스 포스팅 워크플로우
├── scripts/
│   └── fetch-news.js         # 뉴스 수집 스크립트
├── posts/
│   ├── index.json            # 포스트 목록
│   └── post-*.json           # 개별 포스트
├── images/
│   └── banner.png            # 메인 배너 이미지
├── admin/
│   └── index.html            # 관리자 페이지
├── index.html                # 메인 페이지
├── blog.html                 # 블로그 목록 페이지
├── post.html                 # 포스트 상세 페이지
├── style.css                 # 스타일시트
├── script.js                 # 공통 스크립트
├── content.json              # 사이트 설정
└── package.json
```

## ⚙️ 자동 뉴스 포스팅 설정

### 1. GitHub Repository 설정

1. 이 프로젝트를 GitHub에 Push합니다.
2. Repository Settings > Actions > General에서 "Read and write permissions" 활성화

### 2. Anthropic API Key 설정 (선택사항)

Claude AI를 이용한 뉴스 요약을 원하면:

1. [Anthropic Console](https://console.anthropic.com/)에서 API Key 발급
2. GitHub Repository > Settings > Secrets and variables > Actions
3. "New repository secret" 클릭
4. Name: `ANTHROPIC_API_KEY`, Value: 발급받은 API Key

> API Key가 없어도 기본 형식으로 뉴스가 포스팅됩니다.

### 3. GitHub Pages 설정 (선택사항)

1. Repository Settings > Pages
2. Source: "Deploy from a branch"
3. Branch: `main` (또는 `master`), folder: `/ (root)`
4. Save

### 4. 실행 스케줄

- **자동 실행**: 매일 한국시간 오전 8시
- **수동 실행**: Actions 탭 > "Daily Tech News Auto Posting" > "Run workflow"

## 🛠️ 로컬 개발

```bash
# 의존성 설치
npm install

# 뉴스 수집 테스트 (API Key 없이)
npm run fetch-news

# 뉴스 수집 테스트 (API Key 있음)
ANTHROPIC_API_KEY=your-api-key npm run fetch-news
```

## 📝 수동 포스트 작성

### posts 폴더에 JSON 파일 추가

```json
{
  "id": "post-7",
  "title": "포스트 제목",
  "category": "IT",
  "date": "2025-01-25",
  "image": "images/banner.png",
  "excerpt": "포스트 요약",
  "content": "<h2>제목</h2><p>내용...</p>"
}
```

### posts/index.json 업데이트

```json
["post-7.json", "post-6.json", "post-5.json", ...]
```

## 🎨 카테고리

| 카테고리 | 설명 | 색상 |
|---------|------|------|
| IT | 웹개발, 프로그래밍, 기술 트렌드 | 🔵 파랑 |
| AI | 인공지능, 머신러닝, 생성형 AI | 🟣 보라 |
| 교육 | 에듀테크, 디지털 리터러시 | 🟢 초록 |

## 📄 라이선스

MIT License

## 🙋‍♂️ 문의

블로그 관련 문의사항이 있으시면 이슈를 등록해주세요.
