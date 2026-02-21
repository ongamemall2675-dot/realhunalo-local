// ================================================================
// IMAGE CONSTANTS - 미술 작업실 상수 모음
// ================================================================

export const STYLE_CATEGORIES = {
    yeop_stickman: {
        name: '옆집부동산 졸라맨',
        prompt: 'the white spherical head now features simple, expressive black oval eyes and a curved mouth line, conveying a friendly yet professional smile. All other elements, including the reflective glasses, charcoal grey suit, blue tie, white gloves, the long black pointer stick with the red tip held in his right hand, and the brown leather briefcase marked \'DATA & FACT\' held in his left hand, against the solid light grey background. The clean line art and cel-shading style are consistent.',
        description: '흰 구형 머리, 반사 안경, 차콜 수트, 파란 넥타이, 흰 장갑, 빨간 팁 포인터, DATA&FACT 가방'
    },
    stickman: {
        name: '스틱맨 (졸라맨)',
        prompt: 'simple stickman style, minimalist stick figure, blue shirt, red tie, clean lines, 2D flat design',
        description: '심플한 스틱맨 캐릭터, 파란 셔츠와 빨간 넥타이'
    },
    animation: {
        name: '애니메이션',
        prompt: 'anime style, animation, cel shaded, vibrant colors',
        description: '일본 애니메이션 스타일, 밝고 선명한 색감'
    },
    european_graphic_novel: {
        name: '유럽풍 그래픽 노블',
        prompt: 'European graphic novel style, bande dessinée, ligne claire, ink and watercolor',
        description: '유럽 만화 스타일, 명확한 선과 수채화 기법'
    },
    hand_drawn: {
        name: '손그림 스타일',
        prompt: 'hand drawn sketch style, pencil drawing, rough sketch, artistic',
        description: '자연스러운 손그림 느낌, 스케치 터치'
    },
    cinematic_photorealistic: {
        name: '시네마틱 실사',
        prompt: 'cinematic photorealistic, film photography, dramatic lighting, depth of field',
        description: '영화 같은 실사 스타일, 극적인 조명과 구도'
    },
    kdrama_realistic: {
        name: 'K-드라마 실사',
        prompt: 'Korean drama style, soft romantic lighting, emotional atmosphere, modern Korean aesthetic',
        description: '한국 드라마 특유의 감성적이고 따뜻한 실사 스타일'
    },
    noir: {
        name: '느와르',
        prompt: 'film noir style, high contrast, dramatic shadows, black and white, vintage detective',
        description: '흑백 영화 스타일, 강렬한 명암 대비'
    },
    webtoon: {
        name: '웹툰',
        prompt: 'Korean webtoon style, digital comic, clean lines, vibrant colors, modern illustration',
        description: '한국 웹툰 스타일, 깔끔한 선과 밝은 색감'
    },
    '3d_animation': {
        name: '3D 애니메이션',
        prompt: '3D animation style, Pixar style, CGI, smooth rendering, cartoon 3D',
        description: '픽사 스타일의 3D 애니메이션, 부드러운 렌더링'
    },
    claymation: {
        name: '클레이 애니메이션',
        prompt: 'claymation style, stop motion, clay models, tactile texture, handcrafted',
        description: '점토 인형 스톱모션 스타일, 수작업 질감'
    },
    fairy_tale_illustration: {
        name: '동화 일러스트',
        prompt: 'fairy tale illustration, storybook art, whimsical, soft colors, children book style',
        description: '동화책 일러스트 스타일, 환상적이고 부드러운 색감'
    },
    wool_felt_doll: {
        name: '동화 양모인형',
        prompt: 'wool felt doll style, needle felting, soft fuzzy texture, handmade crafts',
        description: '양모 펠트 인형 스타일, 따뜻하고 포근한 질감'
    },
    diorama: {
        name: '디오라마',
        prompt: 'diorama style, miniature scene, tilt-shift photography, tiny detailed model',
        description: '미니어처 모형 디오라마, 틸트 시프트 효과'
    },
    emotional_historical_illustration: {
        name: '감성 사극 일러스트',
        prompt: 'emotional Korean historical drama illustration, traditional hanbok, soft brush strokes, nostalgic atmosphere',
        description: '한국 사극 감성 일러스트, 전통 한복과 서정적 분위기'
    },
    web_novel_signature: {
        name: '웹소설 시그니쳐',
        prompt: 'web novel cover illustration, fantasy romance style, detailed character art, dramatic composition',
        description: '웹소설 표지 스타일, 판타지 로맨스 감성'
    },
    oriental_folklore_illustration: {
        name: '동양 설화 일러스트',
        prompt: 'oriental folklore illustration, Asian mythology, traditional ink painting elements, mystical atmosphere',
        description: '동양 설화 일러스트, 수묵화 요소와 신비로운 분위기'
    },
    ghibli: {
        name: '지브리',
        prompt: 'Studio Ghibli style, Miyazaki inspired, hand painted animation, whimsical nature, nostalgic',
        description: '지브리 스튜디오 애니메이션 스타일, 따뜻하고 향수적'
    },
    vintage: {
        name: '빈티지',
        prompt: 'vintage style, retro aesthetic, aged paper texture, faded colors, nostalgic',
        description: '복고풍 스타일, 오래된 종이 질감과 바랜 색감'
    },
    watercolor: {
        name: '수채화',
        prompt: 'watercolor painting, soft blending, fluid strokes, gentle colors, artistic',
        description: '수채화 기법, 부드러운 번짐과 은은한 색감'
    },
    illustration: {
        name: '일러스트',
        prompt: 'digital illustration, modern art style, clean and polished, professional artwork',
        description: '현대적 디지털 일러스트, 깔끔하고 세련됨'
    },
    flat_vector: {
        name: '플랫 벡터',
        prompt: 'flat vector style, minimal design, geometric shapes, solid colors, modern graphic design',
        description: '플랫 디자인 벡터 스타일, 미니멀하고 기하학적'
    },
    oil_painting: {
        name: '유화',
        prompt: 'oil painting style, thick brush strokes, rich texture, classical art, impasto technique',
        description: '유화 기법, 두꺼운 붓터치와 풍부한 질감'
    },
    pencil_drawing: {
        name: '연필그림',
        prompt: 'pencil drawing, graphite sketch, detailed shading, realistic pencil art, black and white',
        description: '연필 스케치 스타일, 섬세한 음영 표현'
    },
    pixel_art: {
        name: '픽셀아트',
        prompt: 'pixel art style, 8-bit retro, blocky pixels, video game aesthetic, nostalgic gaming',
        description: '픽셀 아트 스타일, 8비트 레트로 게임 감성'
    },
    low_poly: {
        name: '로우폴리',
        prompt: 'low poly 3D style, geometric facets, minimal polygons, modern 3D art, angular shapes',
        description: '로우 폴리곤 3D 스타일, 각진 기하학적 면'
    },
    origami: {
        name: '오리가미',
        prompt: 'origami paper craft style, folded paper art, geometric paper sculpture, clean edges',
        description: '종이접기 스타일, 기하학적 종이 조각'
    },
    comic_book: {
        name: '만화책',
        prompt: 'comic book style, bold outlines, halftone dots, speech bubbles, superhero aesthetic',
        description: '미국 코믹북 스타일, 강렬한 외곽선과 망점'
    },
    neon_punk: {
        name: '네온펑크',
        prompt: 'neon punk style, cyberpunk aesthetic, glowing neon lights, futuristic urban, vibrant electric colors',
        description: '네온 사이버펑크 스타일, 미래적 도시와 형광색'
    },
    '3d_model': {
        name: '3D 모델',
        prompt: '3D render, photorealistic 3D model, clean rendering, studio lighting, product visualization',
        description: '사실적 3D 렌더링, 스튜디오 조명'
    },
    craft_clay: {
        name: '공예/점토',
        prompt: 'clay craft style, ceramic pottery, handmade clay sculpture, artisan crafts, tactile texture',
        description: '점토 공예 스타일, 도자기와 수공예 질감'
    }
};
