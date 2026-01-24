// ===================================================
// 성동글로벌경영고등학교 - CMS 연동 스크립트
// content.json과 posts/*.json 파일을 읽어서 렌더링
// ===================================================

document.addEventListener('DOMContentLoaded', async () => {
    // 콘텐츠 로드
    await loadContent();
    await loadPosts();
    
    // 이벤트 리스너
    initMobileMenu();
    initScrollAnimation();
    initHeaderScroll();
});

// === 메인 콘텐츠 로드 ===
async function loadContent() {
    try {
        const response = await fetch('content.json');
        const content = await response.json();
        
        // 히어로 섹션
        renderHero(content.hero);
        
        // 블로그 섹션 제목
        document.getElementById('blog-title').textContent = content.blog.sectionTitle;
        document.getElementById('blog-subtitle').textContent = content.blog.sectionSubtitle;
        
        // 학교소개 섹션
        renderAbout(content.about);
        
        // 푸터
        document.getElementById('footer-address').textContent = content.footer.address;
        document.getElementById('footer-copyright').textContent = content.footer.copyright;
        
    } catch (error) {
        console.error('콘텐츠 로드 실패:', error);
    }
}

// === 히어로 렌더링 ===
function renderHero(hero) {
    document.getElementById('hero-subtitle').textContent = hero.subtitle;
    document.getElementById('hero-title').textContent = hero.title;
    
    if (hero.backgroundImage) {
        document.getElementById('hero-bg-image').src = hero.backgroundImage;
    }
    
    const buttonsContainer = document.getElementById('hero-buttons');
    buttonsContainer.innerHTML = hero.buttons.map(btn => `
        <a href="${btn.url}" class="btn btn-${btn.style}" target="${btn.url.startsWith('http') ? '_blank' : '_self'}">
            ${btn.text}
        </a>
    `).join('');
}

// === 학교소개 렌더링 ===
function renderAbout(about) {
    document.getElementById('about-title').textContent = about.sectionTitle;
    document.getElementById('about-subtitle').textContent = about.sectionSubtitle;
    
    // 인트로
    const introContainer = document.getElementById('about-intro');
    introContainer.innerHTML = `
        <div class="about-intro-image">
            <img src="${about.intro.image}" alt="${about.intro.title}">
        </div>
        <div class="about-intro-content">
            <h3>${about.intro.title}</h3>
            <p>${about.intro.description}</p>
        </div>
    `;
    
    // 특징
    const featuresContainer = document.getElementById('features-grid');
    featuresContainer.innerHTML = about.features.map(feature => `
        <div class="feature-card fade-in">
            <div class="feature-icon">${feature.icon}</div>
            <h4>${feature.title}</h4>
            <p>${feature.description}</p>
        </div>
    `).join('');
    
    // 학과
    const deptsContainer = document.getElementById('departments-grid');
    deptsContainer.innerHTML = about.departments.map(dept => `
        <div class="dept-card fade-in">
            ${dept.badge ? `<span class="dept-badge">${dept.badge}</span>` : ''}
            <div class="dept-icon">${dept.icon}</div>
            <h4>${dept.name}</h4>
            <p>${dept.description}</p>
        </div>
    `).join('');
}

// === 블로그 포스트 로드 ===
async function loadPosts() {
    try {
        // 포스트 파일 목록 (6개)
        const postFiles = [
            'posts/post-1.json',
            'posts/post-2.json',
            'posts/post-3.json',
            'posts/post-4.json',
            'posts/post-5.json',
            'posts/post-6.json'
        ];
        
        const posts = await Promise.all(
            postFiles.map(file => 
                fetch(file)
                    .then(res => res.json())
                    .catch(() => null)
            )
        );
        
        // null 제거하고 날짜순 정렬
        const validPosts = posts
            .filter(post => post !== null)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        renderPosts(validPosts);
        
    } catch (error) {
        console.error('포스트 로드 실패:', error);
    }
}

// === 블로그 포스트 렌더링 ===
function renderPosts(posts) {
    const grid = document.getElementById('blog-grid');
    
    // 카드 클릭시 상세 페이지로 이동
    grid.innerHTML = posts.map(post => `
        <a href="post.html?id=${post.id}" class="blog-card fade-in">
            <div class="blog-card-image">
                <img src="${post.image}" alt="${post.title}">
                <span class="blog-card-category">${post.category}</span>
            </div>
            <div class="blog-card-content">
                <p class="blog-card-date">${formatDate(post.date)}</p>
                <h3 class="blog-card-title">${post.title}</h3>
                <p class="blog-card-excerpt">${post.excerpt}</p>
            </div>
        </a>
    `).join('');
    
    // 애니메이션 초기화
    initScrollAnimation();
}

// === 날짜 포맷 ===
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// === 모바일 메뉴 ===
function initMobileMenu() {
    const toggle = document.querySelector('.mobile-menu');
    const nav = document.querySelector('.nav');
    
    toggle?.addEventListener('click', () => {
        nav.classList.toggle('active');
    });
}

// === 스크롤 애니메이션 ===
function initScrollAnimation() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    document.querySelectorAll('.fade-in').forEach(el => {
        observer.observe(el);
    });
}

// === 헤더 스크롤 ===
function initHeaderScroll() {
    const header = document.querySelector('.header');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            header.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
        } else {
            header.style.boxShadow = 'none';
        }
    });
}
