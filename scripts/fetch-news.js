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

// 카테고리별 검색 키워드
const SEARCH_QUERIES = {
  'IT': ['IT 기술 트렌드', '소프트웨어 개발', '클라우드 컴퓨팅', '사이버보안', '스타트업 테크'],
  'AI': ['인공지능 AI', 'ChatGPT Claude', '생성형 AI', '머신러닝', 'AI 서비스'],
  '교육': ['에듀테크', '디지털 교육', 'AI 교육', '미래 교육', '온라인 학습'],
  '경영': ['경영 전략', '스타트업 창업', '리더십 경영', 'MZ세대 조직문화', '디지털 트랜스포메이션']
};

// 카테고리별 Unsplash 검색어 (영문)
const UNSPLASH_KEYWORDS = {
  'IT': ['technology', 'computer', 'coding', 'software', 'digital'],
  'AI': ['artificial intelligence', 'robot', 'machine learning', 'futuristic', 'neural network'],
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

// Unsplash에서 이미지 가져오기 (무료, API 키 불필요)
async function fetchUnsplashImage(category) {
  try {
    const keywords = UNSPLASH_KEYWORDS[category] || ['technology'];
    const keyword = keywords[Math.floor(Math.random() * keywords.length)];
    
    // Unsplash Source API (무료, API 키 불필요)
    // 1600x900 크기의 랜덤 이미지 URL 반환
    const imageUrl = `https://source.unsplash.com/1600x900/?${encodeURIComponent(keyword)}`;
    
    // 실제 이미지 URL을 얻기 위해 리다이렉트 따라가기
    const response = await axios.get(imageUrl, {
      maxRedirects: 5,
      timeout: 10000,
      validateStatus: (status) => status < 400
    });
    
    // 최종 리다이렉트된 URL 반환
    const finalUrl = response.request.res.responseUrl || imageUrl;
    console.log(`Unsplash 이미지 가져오기 성공: ${keyword}`);
    
    return finalUrl;
  } catch (error) {
    console.error('Unsplash 이미지 가져오기 실패:', error.message);
    return null;
  }
}

// 오늘의 카테고리 선택 (날짜 기반 로테이션)
function getTodayCategory() {
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const categories = CONFIG.categories;
  return categories[dayOfYear % categories.length];
}

// 랜덤 검색어 선택
function getRandomQuery(category) {
  const queries = SEARCH_QUERIES[category];
  return queries[Math.floor(Math.random() * queries.length)];
}

// 가장 흥미로운 뉴스 선택 (제목 길이, 최신성 등 고려)
function selectBestNews(newsItems) {
  if (newsItems.length === 0) return null;
  
  // 최신 뉴스 중 제목이 가장 구체적인 것 선택
  const scored = newsItems.map(item => {
    let score = 0;
    // 제목 길이 (너무 짧지도 길지도 않은 것)
    if (item.title.length > 20 && item.title.length < 80) score += 10;
    // 숫자가 포함된 제목 (구체적인 정보)
    if (/\d/.test(item.title)) score += 5;
    // 따옴표가 있는 제목 (인용, 발언)
    if (/["']/.test(item.title)) score += 3;
    return { ...item, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

// Claude API를 이용한 블로그 포스트 생성
async function generateBlogPostWithClaude(selectedNews, allNews, category) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.log('ANTHROPIC_API_KEY가 설정되지 않았습니다. 기본 포맷으로 생성합니다.');
    return generateBasicPost(selectedNews, allNews, category);
  }
  
  try {
    // 관련 뉴스 컨텍스트 구성
    const relatedNews = allNews.slice(0, 5).map((item, i) => 
      `${i + 1}. ${item.title} (${item.source})\n   ${item.link}`
    ).join('\n');
    
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `당신은 IT/AI/교육 분야 전문 블로거입니다. 아래 뉴스를 바탕으로 독자들에게 유익한 블로그 포스트를 작성해주세요.

## 중요: 현재 날짜
오늘은 ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}입니다. 
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
3. 반드시 2026년 현재 시점에서 작성하세요. "2025년에는~", "작년에~" 같은 과거 표현을 사용하지 마세요.
4. 다음 구조로 작성해주세요:
   - 도입부: 왜 이 주제가 중요한지
   - 본문: 핵심 내용 설명 및 분석
   - 시사점: 독자들이 알아야 할 점, 앞으로의 전망
4. 원문 뉴스 링크를 본문 중간이나 끝에 자연스럽게 포함해주세요.
5. 친근하지만 전문적인 문체로 작성해주세요.
6. HTML 형식으로 작성해주세요 (h2, h3, p, a, blockquote 태그 사용).
7. 전체 길이는 800~1200자 정도로 작성해주세요.

## 출력 형식
아래 JSON 형식으로만 출력하세요. 다른 설명은 하지 마세요.

{
  "title": "포스트 제목 (흥미롭고 클릭하고 싶은 제목)",
  "excerpt": "포스트 요약 (1~2문장)",
  "content": "<h2>...</h2><p>...</p>..."
}`
      }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      timeout: 60000
    });
    
    const responseText = response.data.content[0].text;
    
    // JSON 파싱 시도
    try {
      // JSON 블록 추출
      let jsonStr = responseText;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      const parsed = JSON.parse(jsonStr);
      return {
        title: parsed.title || selectedNews.title,
        excerpt: parsed.excerpt || `${category} 분야의 최신 소식을 분석합니다.`,
        content: (parsed.content || generateBasicPost(selectedNews, allNews, category).content) + 
          '\n\n<p class="ai-disclaimer">🤖 <em>이 포스팅은 AI가 자동으로 작성한 포스팅입니다.</em></p>'
      };
    } catch (parseError) {
      console.error('JSON 파싱 실패, 기본 포맷 사용:', parseError.message);
      return generateBasicPost(selectedNews, allNews, category);
    }
    
  } catch (error) {
    console.error('Claude API 호출 실패:', error.message);
    return generateBasicPost(selectedNews, allNews, category);
  }
}

// Claude API 없을 때 기본 포스트 생성
function generateBasicPost(selectedNews, allNews, category) {
  const categoryEmoji = {
    'IT': '💻',
    'AI': '🤖',
    '교육': '📚',
    '경영': '💼'
  };
  
  const emoji = categoryEmoji[category] || '📰';
  
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

<p class="ai-disclaimer">🤖 <em>이 포스팅은 AI가 자동으로 작성한 포스팅입니다.</em></p>`;

  return {
    title: `${emoji} ${selectedNews.title}`,
    excerpt: `${category} 분야 주요 소식: ${selectedNews.title.substring(0, 50)}...`,
    content: content
  };
}

// 오늘 날짜로 이미 포스트가 있는지 확인
function hasPostForToday() {
  const today = new Date().toISOString().split('T')[0];
  const files = fs.readdirSync(CONFIG.postsDir);
  
  for (const file of files) {
    if (file.endsWith('.json')) {
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
  
  // 새 포스트 추가 (맨 앞에)
  if (!index.includes(newPostFilename)) {
    index.unshift(newPostFilename);
  }
  
  fs.writeFileSync(CONFIG.indexFile, JSON.stringify(index, null, 2));
  console.log('index.json 업데이트 완료');
}

// 메인 함수
async function main() {
  console.log('=== 일일 블로그 포스트 자동 생성 시작 ===');
  console.log(`실행 시간: ${new Date().toISOString()}`);
  
  // 오늘 이미 포스팅했는지 확인
  if (hasPostForToday()) {
    console.log('오늘은 이미 자동 포스트가 있습니다. 스킵합니다.');
    return;
  }
  
  // 오늘의 카테고리 선택
  const category = getTodayCategory();
  const searchQuery = getRandomQuery(category);
  console.log(`\n오늘의 카테고리: ${category}`);
  console.log(`검색어: ${searchQuery}`);
  
  // 뉴스 수집
  console.log('\n뉴스 수집 중...');
  const news = await fetchGoogleNews(searchQuery);
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
  
  // 주요 뉴스 선택
  const selectedNews = selectBestNews(news);
  console.log(`\n선택된 주요 뉴스: ${selectedNews.title}`);
  
  // Unsplash 이미지 가져오기
  console.log('\n이미지 가져오는 중...');
  const imageUrl = await fetchUnsplashImage(category);
  const postImage = imageUrl || CONFIG.defaultImage;
  console.log(`이미지: ${postImage}`);
  
  // 블로그 포스트 생성
  console.log('\n블로그 포스트 생성 중...');
  const postData = await generateBlogPostWithClaude(selectedNews, news, category);
  
  // 포스트 파일 작성
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const postId = `daily-${dateStr}`;
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
  
  const filePath = path.join(CONFIG.postsDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(post, null, 2), 'utf8');
  console.log(`\n포스트 저장: ${filePath}`);
  console.log(`제목: ${post.title}`);
  
  // index.json 업데이트
  updatePostIndex(filename);
  
  console.log('\n=== 자동 포스팅 완료 ===');
}

main().catch(console.error);
