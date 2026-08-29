const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// 설정
const CONFIG = {
  postsDir: path.join(__dirname, '..', 'posts'),
  indexFile: path.join(__dirname, '..', 'posts', 'index.json'),
  defaultImage: 'images/banner.png',
  categories: ['IT', 'AI', '교육', '경영']
};

// === KST(한국시간) 기준 날짜/시간 유틸 ===
function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

function kstDateStr() {
  return kstNow().toISOString().split('T')[0];
}

function kstTimeStr() {
  return kstNow().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
}

// 카테고리별 검색 키워드
const SEARCH_QUERIES = {
  'IT': ['IT 기술 트렌드', '소프트웨어 개발', '클라우드 컴퓨팅', '사이버보안', '스타트업 테크'],
  'AI': ['인공지능 AI', 'ChatGPT Claude', '생성형 AI', '머신러닝', 'AI 서비스'],
  '교육': ['에듀테크', '디지털 교육', 'AI 교육', '미래 교육', '온라인 학습'],
  '경영': ['경영 전략', '스타트업 창업', '리더십 경영', 'MZ세대 조직문화', '디지털 트랜스포메이션']
};

// 카테고리별 Pexels 검색어 (영문)
const PEXELS_KEYWORDS = {
  'IT': ['technology', 'computer', 'coding', 'software', 'programming'],
  'AI': ['artificial intelligence', 'robot', 'futuristic', 'data', 'network'],
  '교육': ['education', 'learning', 'classroom', 'study', 'books'],
  '경영': ['business', 'office', 'leadership', 'startup', 'meeting']
};

// Google News RSS를 이용한 뉴스 수집
async function fetchGoogleNews(query) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=ko&gl=KR&ceid=KR:ko`;

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const items = [];

    $('item').slice(0, 10).each((i, el) => {
      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim();
      const pubDate = $(el).find('pubDate').text().trim();
      const source = $(el).find('source').text().trim();
      const description = $(el).find('description').text().trim();

      if (title && link) {
        items.push({
          title,
          link,
          pubDate,
          source,
          description
        });
      }
    });

    return items;
  } catch (error) {
    console.error(`Google News 수집 실패 (${query}):`, error.message);
    return [];
  }
}

// Pexels API를 이용한 이미지 가져오기
async function fetchPexelsImage(category) {
  const apiKey = process.env.PEXELS_API_KEY;

  if (!apiKey) {
    console.log('PEXELS_API_KEY가 설정되지 않았습니다. 기본 이미지를 사용합니다.');
    return null;
  }

  try {
    const keywords = PEXELS_KEYWORDS[category] || ['technology'];
    const keyword = keywords[Math.floor(Math.random() * keywords.length)];

    const response = await axios.get('https://api.pexels.com/v1/search', {
      params: {
        query: keyword,
        per_page: 15,
        orientation: 'landscape'
      },
      headers: {
        'Authorization': apiKey
      },
      timeout: 10000
    });

    const photos = response.data.photos;

    if (photos && photos.length > 0) {
      const randomPhoto = photos[Math.floor(Math.random() * photos.length)];
      const imageUrl = randomPhoto.src.large2x || randomPhoto.src.large || randomPhoto.src.original;
      const photographer = randomPhoto.photographer;
      const photographerUrl = randomPhoto.photographer_url;

      console.log(`Pexels 이미지 가져오기 성공: ${keyword}`);
      console.log(`사진작가: ${photographer}`);

      return {
        url: imageUrl,
        photographer: photographer,
        photographerUrl: photographerUrl
      };
    }

    return null;
  } catch (error) {
    console.error('Pexels 이미지 가져오기 실패:', error.message);
    return null;
  }
}

// 오늘의 카테고리 선택 (날짜 기반 로테이션)
function getTodayCategory() {
  const today = kstNow();
  const startOfYear = Date.UTC(today.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((today.getTime() - startOfYear) / (1000 * 60 * 60 * 24));
  const categories = CONFIG.categories;
  return categories[dayOfYear % categories.length];
}

// 랜덤 검색어 선택
function getRandomQuery(category) {
  const queries = SEARCH_QUERIES[category];
  return queries[Math.floor(Math.random() * queries.length)];
}

// 가장 흥미로운 뉴스 선택
function selectBestNews(newsItems) {
  if (newsItems.length === 0) return null;

  const scored = newsItems.map(item => {
    let score = 0;
    if (item.title.length > 20 && item.title.length < 80) score += 10;
    if (/\d/.test(item.title)) score += 5;
    if (/["']/.test(item.title)) score += 3;
    return { ...item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

// Claude API 응답에서 텍스트만 안전하게 추출
// content 배열에는 thinking 등 text가 아닌 블록이 섞일 수 있으므로
// 인덱스([0])로 찍지 않고 type === 'text'인 블록만 골라낸다.
function extractTextFromClaudeResponse(responseData) {
  const blocks = (responseData && responseData.content) || [];

  if (!Array.isArray(blocks) || blocks.length === 0) {
    return '';
  }

  return blocks
    .filter(block => block && block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n')
    .trim();
}

// 대기 함수 (재시도 백오프용)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 태그 기반 응답에서 값 추출
function extractTag(text, tag) {
  const re = new RegExp('<' + tag + '>([\\s\\S]*?)<\\/' + tag + '>');
  const m = text.match(re);
  return m ? m[1].trim() : '';
}

// Claude API 1회 호출
async function callClaude(apiKey, prompt) {
  const response = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-5',
    max_tokens: 12000,
    messages: [{
      role: 'user',
      content: prompt
    }]
  }, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    timeout: 180000
  });

  return response.data;
}

// Claude API를 이용한 블로그 포스트 생성 (최대 3회 재시도)
async function generateBlogPostWithClaude(selectedNews, allNews, category, photoCredit) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY가 설정되지 않았습니다.');
    return null;
  }

  const relatedNews = allNews.slice(0, 5).map((item, i) =>
    `${i + 1}. ${item.title} (${item.source})\n   ${item.link}`
  ).join('\n');

  const currentDate = new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const prompt = `당신은 IT/AI/교육/경영 분야 전문 블로거입니다. 아래 뉴스를 바탕으로 독자들에게 유익한 블로그 포스트를 작성해주세요.

## 중요: 현재 날짜
오늘은 ${currentDate}입니다.
반드시 2026년 현재 시점을 기준으로 작성하세요. 2024년, 2025년 등 과거 시제로 작성하지 마세요.

## 오늘의 주요 뉴스
제목: ${selectedNews.title}
출처: ${selectedNews.source}
링크: ${selectedNews.link}

## 관련 뉴스
${relatedNews}

## 작성 요청사항
1. 위 뉴스를 바탕으로 "${category}" 카테고리에 맞는 블로그 포스트를 작성해주세요.
2. 단순 뉴스 전달이 아닌, 독자에게 인사이트를 주는 분석 글로 작성해주세요.
3. 반드시 2026년 현재 시점에서 작성하세요.
4. 다음 구조로 작성해주세요:
   - 도입부: 왜 이 주제가 중요한지
   - 본문: 핵심 내용 설명 및 분석
   - 시사점: 독자들이 알아야 할 점, 앞으로의 전망
5. 원문 뉴스 링크를 본문 중간이나 끝에 자연스럽게 포함해주세요.
6. 친근하지만 전문적인 문체로 작성해주세요.
7. HTML 형식으로 작성해주세요 (h2, h3, p, a, blockquote 태그 사용).
8. 전체 길이는 1500~2000자 정도로 작성해주세요.

## 글쓰기 주의사항
- "~에 대해 알아보겠습니다", "오늘은 ~를 소개합니다" 같은 상투적인 서두는 쓰지 마세요.
- 뉴스 내용을 그대로 요약만 하지 말고, 왜 중요한지 해석과 관점을 담아주세요.
- 가능하면 구체적인 숫자, 사례, 비교를 포함하세요.
- 뻔한 마무리 대신, 독자가 당장 생각해볼 만한 질문이나 실천 포인트로 끝내주세요.
- 제목에 이모지를 넣지 마세요.

## 출력 형식
반드시 아래 세 개의 태그로만 출력하세요. 태그 밖에는 어떤 설명도 쓰지 마세요.
마크다운 코드블록도 쓰지 마세요.

<title>포스트 제목 (흥미롭고 클릭하고 싶은 제목)</title>
<excerpt>포스트 요약 (1~2문장)</excerpt>
<post><h2>...</h2><p>...</p>...</post>`;

  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`Claude 호출 시도 ${attempt}/${MAX_ATTEMPTS}...`);

      const data = await callClaude(apiKey, prompt);
      const responseText = extractTextFromClaudeResponse(data);

      if (data.stop_reason === 'max_tokens') {
        throw new Error('응답이 max_tokens에서 잘렸습니다.');
      }

      if (!responseText) {
        throw new Error(
          '텍스트 블록 없음. 블록 타입: ' +
          JSON.stringify(((data && data.content) || []).map(b => b && b.type))
        );
      }

      const title = extractTag(responseText, 'title');
      const excerpt = extractTag(responseText, 'excerpt');
      const content = extractTag(responseText, 'post');

      if (!title || !content) {
        throw new Error(`태그 추출 실패 (title=${title.length}자, post=${content.length}자)`);
      }

      if (content.length < 800) {
        throw new Error(`본문이 너무 짧습니다 (${content.length}자)`);
      }

      let creditHtml = '';
      if (photoCredit) {
        creditHtml = `\n\n<p class="photo-credit">📷 Photo by <a href="${photoCredit.photographerUrl}" target="_blank">${photoCredit.photographer}</a> on <a href="https://www.pexels.com" target="_blank">Pexels</a></p>`;
      }

      console.log(`Claude 포스트 생성 성공 (본문 ${content.length}자)`);

      return {
        title: title,
        excerpt: excerpt || `${category} 분야의 최신 소식을 분석합니다.`,
        content: content +
          creditHtml +
          '\n\n<p class="ai-disclaimer">🤖 <em>이 포스팅은 AI가 자동으로 작성한 포스팅입니다.</em></p>'
      };

    } catch (error) {
      console.error(`시도 ${attempt} 실패:`, error.message);

      if (error.response) {
        console.error('상태 코드:', error.response.status);
        console.error('응답 내용:', JSON.stringify(error.response.data).slice(0, 500));
      }

      if (attempt < MAX_ATTEMPTS) {
        const waitMs = attempt * 15000;
        console.log(`${waitMs / 1000}초 후 재시도합니다...`);
        await sleep(waitMs);
      }
    }
  }

  console.error('Claude 포스트 생성에 3회 모두 실패했습니다.');
  return null;
}

// Claude API 없을 때 기본 포스트 생성
function generateBasicPost(selectedNews, allNews, category, photoCredit) {
  const categoryEmoji = {
    'IT': '💻',
    'AI': '🤖',
    '교육': '📚',
    '경영': '💼'
  };

  const emoji = categoryEmoji[category] || '📰';

  let creditHtml = '';
  if (photoCredit) {
    creditHtml = `\n\n<p class="photo-credit">📷 Photo by <a href="${photoCredit.photographerUrl}" target="_blank">${photoCredit.photographer}</a> on <a href="https://www.pexels.com" target="_blank">Pexels</a></p>`;
  }

  const content = `<h2>${emoji} ${selectedNews.title}</h2>

<p>오늘 ${category} 분야에서 주목할 만한 소식이 있어 공유합니다.</p>

<blockquote>
<strong>${selectedNews.source}</strong>에서 보도한 내용에 따르면, 이 주제가 현재 업계에서 큰 관심을 받고 있습니다.
</blockquote>

<h3>핵심 내용</h3>
<p>자세한 내용은 아래 원문 기사를 통해 확인하실 수 있습니다.</p>
<p>👉 <a href="${selectedNews.link}" target="_blank">원문 기사 보기</a></p>

<h3>관련 소식</h3>
<p>이 주제와 관련된 다른 소식들도 함께 살펴보세요:</p>
<ul>
${allNews.slice(1, 4).map(news =>
    `<li><a href="${news.link}" target="_blank">${news.title}</a> <small>(${news.source})</small></li>`
  ).join('\n')}
</ul>

<h3>마무리</h3>
<p>${category} 분야의 변화는 우리 일상과 밀접하게 연결되어 있습니다. 앞으로도 관련 소식을 지속적으로 전해드리겠습니다.</p>

<p><em>이 포스트는 자동으로 생성되었습니다. 더 자세한 내용은 원문 링크를 참고해주세요.</em></p>
${creditHtml}
<p class="ai-disclaimer">🤖 <em>이 포스팅은 AI가 자동으로 작성한 포스팅입니다.</em></p>`;

  return {
    title: `${emoji} ${selectedNews.title}`,
    excerpt: `${category} 분야 주요 소식: ${selectedNews.title.substring(0, 50)}...`,
    content: content
  };
}

// 오늘 날짜로 이미 포스트가 있는지 확인
function hasPostForToday() {
  const today = kstDateStr();
  const files = fs.readdirSync(CONFIG.postsDir);

  for (const file of files) {
    if (file.endsWith('.json') && file !== 'index.json') {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(CONFIG.postsDir, file), 'utf8'));
        if (content.date === today && content.autoGenerated) {
          return true;
        }
      } catch (e) {
        continue;
      }
    }
  }
  return false;
}

// index.json 업데이트
function updatePostIndex(newPostFilename) {
  let index = [];

  try {
    index = JSON.parse(fs.readFileSync(CONFIG.indexFile, 'utf8'));
  } catch (e) {
    console.log('index.json을 새로 생성합니다.');
  }

  if (!index.includes(newPostFilename)) {
    index.unshift(newPostFilename);
  }

  fs.writeFileSync(CONFIG.indexFile, JSON.stringify(index, null, 2));
  console.log('index.json 업데이트 완료');
}

// 메인 함수
async function main() {
  console.log('=== 일일 블로그 포스트 자동 생성 시작 ===');
  console.log(`실행 시간(KST): ${kstDateStr()} ${kstTimeStr().replace(/-/g, ':')}`);


  const category = getTodayCategory();
  const searchQuery = getRandomQuery(category);
  console.log(`\n오늘의 카테고리: ${category}`);
  console.log(`검색어: ${searchQuery}`);

  console.log('\n뉴스 수집 중...');
  let news = await fetchGoogleNews(searchQuery);
  console.log(`${news.length}개 뉴스 수집 완료`);

  if (news.length === 0) {
    console.log('수집된 뉴스가 없습니다. 다른 검색어로 재시도...');
    const fallbackQuery = SEARCH_QUERIES[category][0];
    const fallbackNews = await fetchGoogleNews(fallbackQuery);
    if (fallbackNews.length === 0) {
      console.log('뉴스 수집 실패. 종료합니다.');
      return;
    }
    news.push(...fallbackNews);
  }

  const selectedNews = selectBestNews(news);
  console.log(`\n선택된 주요 뉴스: ${selectedNews.title}`);

  console.log('\n이미지 가져오는 중...');
  const pexelsResult = await fetchPexelsImage(category);
  const postImage = pexelsResult ? pexelsResult.url : CONFIG.defaultImage;
  console.log(`이미지: ${postImage}`);

  console.log('\n블로그 포스트 생성 중...');
  const postData = await generateBlogPostWithClaude(selectedNews, news, category, pexelsResult);

  // 품질 미달(폴백) 글은 발행하지 않고 워크플로를 실패시킨다
  if (!postData) {
    throw new Error('Claude 포스트 생성 실패 - 오늘 포스트를 발행하지 않습니다.');
  }

  const dateStr = kstDateStr();
  const timeStr = kstTimeStr();
  const postId = `daily-${dateStr}-${timeStr}`;
  const filename = `${postId}.json`;

  const post = {
    id: postId,
    title: postData.title,
    category: category,
    date: dateStr,
    image: postImage,
    excerpt: postData.excerpt,
    content: postData.content,
    autoGenerated: true,
    sourceNews: {
      title: selectedNews.title,
      link: selectedNews.link,
      source: selectedNews.source
    }
  };

  if (pexelsResult) {
    post.photoCredit = {
      photographer: pexelsResult.photographer,
      photographerUrl: pexelsResult.photographerUrl,
      source: 'Pexels'
    };
  }

  const filePath = path.join(CONFIG.postsDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(post, null, 2), 'utf8');
  console.log(`\n포스트 저장: ${filePath}`);
  console.log(`제목: ${post.title}`);

  updatePostIndex(filename);

  console.log('\n=== 자동 포스팅 완료 ===');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
