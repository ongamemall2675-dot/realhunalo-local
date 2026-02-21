// 화풍 카테고리 정의 - Nano Banana 템플릿 + 기존 스타일
export const STYLE_CATEGORIES = {
    // ⭐ Nano Banana 템플릿 (AI가 영문 프롬프트 자동 생성)
    stickman: {
        name: '졸라맨 (Stickman)',
        description: '유머, 풍자, 가성비 콘텐츠용 - 단순함 속의 확실한 표현력.',
        style: '2D flat vector style, minimal design, 4K',
        shot: 'Wide shot, full body',
        environment: 'clean white background',
        anchor: 'Stickman, blue shirt, red tie',
        negative: 'NO 3D, NO realistic photo'
    },
    animation: {
        name: '애니메이션',
        description: '대중적이고 생동감 넘치는 2D 연출',
        style: 'vibrant anime style, cel shaded, high-quality animation frames, expressive facial features, dynamic composition, bright saturated colors, sharp linework',
        shot: 'Medium shot, dynamic angle',
        environment: 'colorful anime background',
        anchor: 'anime character',
        negative: 'NO realistic photo, NO western cartoon'
    },
    european_graphic_novel: {
        name: '유럽풍 그래픽 노블',
        description: '지적이고 클래식한 예술 서적 느낌',
        style: 'European graphic novel style, bande dessinée, ligne claire, sophisticated ink and watercolor, detailed backgrounds, artistic storytelling, matte finish',
        shot: 'Medium shot',
        environment: 'European street scene',
        anchor: 'European comic character',
        negative: 'NO anime, NO American comics'
    },
    hand_drawn: {
        name: '손그림 스타일',
        description: '작가의 개성이 느껴지는 아날로그 감성',
        style: 'hand drawn sketch style, artistic pencil drawing, rough charcoal strokes, graphite texture, creative hatching, paper tooth visible, expressive lines',
        shot: 'Medium shot',
        environment: 'simple sketched background',
        anchor: 'hand drawn character',
        negative: 'NO digital, NO clean lines'
    },
    cinematic_photorealistic: {
        name: '시네마틱 실사',
        description: '압도적인 화질과 영화적 연출',
        style: 'cinematic photorealistic, 8k resolution, film photography, dramatic lighting, sharp focus, professional color grading, anamorphic lens flare, depth of field',
        shot: 'Cinematic wide shot',
        environment: 'professional studio setting with dramatic lighting',
        anchor: 'realistic human, detailed features',
        negative: 'NO cartoon, NO illustration, NO anime'
    },
    kdrama_realistic: {
        name: 'K-드라마 실사',
        description: '세련되고 따뜻한 한국적 영상미',
        style: 'Korean drama style, soft romantic lighting, emotional atmosphere, modern Korean aesthetic, clean skin tones, high-end production quality, serene urban background',
        shot: 'Close-up to medium shot',
        environment: 'modern Korean setting, soft natural light',
        anchor: 'Korean person, emotional expression',
        negative: 'NO harsh lighting, NO overly dramatic'
    },
    noir: {
        name: '느와르',
        description: '어둡고 묵직한 하이-콘트라스트 영상미',
        style: 'film noir style, high contrast, dramatic chiaroscuro shadows, black and white, vintage detective aesthetic, rainy urban streets, smoke and fog, mysterious mood',
        shot: 'Low angle dramatic shot',
        environment: 'dark urban noir setting',
        anchor: 'noir detective, fedora hat',
        negative: 'NO color, NO bright lighting'
    },
    webtoon: {
        name: '웹툰',
        description: '현재 유행하는 가장 트렌디한 디지털 작화',
        style: 'Korean webtoon style, digital comic illustration, clean vibrant lines, modern manhwa aesthetic, cell shading, trendy character design',
        shot: 'Medium shot',
        environment: 'modern Korean webtoon background',
        anchor: 'webtoon character',
        negative: 'NO realistic, NO western comic'
    },
    '3d_animation': {
        name: '3D 애니메이션',
        description: '입체적이고 대중적인 친근함',
        style: '3D animation style, Pixar/Disney inspired, high-quality CGI, smooth clay-like rendering, expressive characters, vibrant studio lighting, subsurface scattering',
        shot: 'Wide shot',
        environment: 'colorful 3D environment',
        anchor: '3D cartoon character',
        negative: 'NO realistic, NO 2D'
    },
    claymation: {
        name: '클레이 애니메이션',
        description: '정성이 담긴 수공예의 따뜻함',
        style: 'claymation style, stop motion aesthetic, handcrafted clay models, fingerprints texture, tactile material, studio mini-lighting, Aardman inspired',
        shot: 'Medium shot',
        environment: 'clay crafted background',
        anchor: 'clay character',
        negative: 'NO smooth, NO digital'
    },
    fairy_tale_illustration: {
        name: '동화 일러스트',
        description: '상상력을 자극하는 부드러운 화풍',
        style: 'fairy tale illustration, storybook art style, whimsical, soft pastel colors, children\'s book aesthetic, magical atmosphere, golden hour lighting',
        shot: 'Wide shot',
        environment: 'magical fairy tale forest',
        anchor: 'fairy tale character',
        negative: 'NO dark, NO realistic'
    },
    wool_felt_doll: {
        name: '동화 양모인형',
        description: '포근하고 아기자기한 촉각적 감성',
        style: 'wool felt doll style, needle felting, soft fuzzy texture, handmade crafts, macro photography, warm cozy lighting, tactile fiber details, cute plushy look',
        shot: 'Close-up shot',
        environment: 'soft fabric background',
        anchor: 'felt doll character',
        negative: 'NO hard edges, NO realistic'
    },
    diorama: {
        name: '디오라마',
        description: '장난감 세상 같은 정교한 축소판',
        style: 'diorama style, miniature scene, tilt-shift photography, tiny detailed models, scale model aesthetic, fake plastic texture, overhead perspective',
        shot: 'Overhead tilt-shift shot',
        environment: 'miniature landscape',
        anchor: 'tiny model figures',
        negative: 'NO full scale, NO normal perspective'
    },
    emotional_historical_illustration: {
        name: '감성 사극 일러스트',
        description: '한국의 전통미와 애틋한 정서',
        style: 'emotional Korean historical illustration, traditional hanbok, soft brush strokes, nostalgic watercolor wash, serene ancient architecture, poetic oriental atmosphere',
        shot: 'Medium shot',
        environment: 'traditional Korean palace or village',
        anchor: 'Korean historical figure in hanbok',
        negative: 'NO modern, NO western'
    },
    web_novel_signature: {
        name: '웹소설 시그니쳐',
        description: '화려하고 압도적인 캐릭터 중심 작화',
        style: 'web novel cover illustration, high-fantasy romance style, detailed character art, dramatic lighting, magical particle effects, epic composition, glowing eyes',
        shot: 'Portrait shot',
        environment: 'fantasy romantic setting',
        anchor: 'beautiful detailed character',
        negative: 'NO simple, NO minimal'
    },
    oriental_folklore_illustration: {
        name: '동양 설화 일러스트',
        description: '신비롭고 몽환적인 전설 속 분위기',
        style: 'oriental folklore illustration, Asian mythology, traditional ink and wash, mystical spirit energy, stylized clouds and waves, golden gold-leaf accents',
        shot: 'Wide mystical shot',
        environment: 'misty Asian mountains and temples',
        anchor: 'mythical Asian deity or creature',
        negative: 'NO western, NO modern'
    },
    ghibli: {
        name: '지브리',
        description: '전 세대에게 사랑받는 감성적 치유물',
        style: 'Studio Ghibli style, Miyazaki inspired, hand-painted background, whimsical nature, lush greenery, nostalgic childhood atmosphere, soft natural lighting',
        shot: 'Wide scenic shot',
        environment: 'beautiful natural landscape',
        anchor: 'Ghibli character',
        negative: 'NO dark, NO modern CGI'
    },
    vintage: {
        name: '빈티지',
        description: '세월의 흔적이 느껴지는 고전적 미학',
        style: 'vintage retro style, aged paper texture, faded nostalgic colors, 1960s aesthetic, halftone dots, distressed edges, old magazine print look',
        shot: 'Medium shot',
        environment: 'vintage retro setting',
        anchor: 'vintage styled subject',
        negative: 'NO modern, NO vibrant colors'
    },
    watercolor: {
        name: '수채화',
        description: '맑고 투명한 예술적 느낌',
        style: 'watercolor painting, soft wet-on-wet blending, fluid brush strokes, gentle bleeding colors, artistic paper texture, airy and light atmosphere',
        shot: 'Medium shot',
        environment: 'soft watercolor background',
        anchor: 'watercolor painted subject',
        negative: 'NO sharp edges, NO digital'
    },
    illustration: {
        name: '일러스트',
        description: '깔끔하고 세련된 상업용 작화',
        style: 'modern digital illustration, clean and polished art, professional vector-like rendering, trendy color palette, sharp edges, balanced composition',
        shot: 'Medium shot',
        environment: 'clean modern background',
        anchor: 'illustrated character',
        negative: 'NO realistic photo'
    },
    flat_vector: {
        name: '플랫 벡터',
        description: '가독성이 높은 모던한 그래픽',
        style: 'flat vector style, minimal graphic design, geometric shapes, solid bold colors, 2D corporate aesthetic, clean infographic look',
        shot: 'Centered composition',
        environment: 'minimal flat background',
        anchor: 'flat vector character',
        negative: 'NO 3D, NO shadows, NO gradients'
    },
    oil_painting: {
        name: '유화',
        description: '묵직하고 클래식한 회화의 정수',
        style: 'classical oil painting, thick impasto brush strokes, rich oil texture, heavy lighting, museum quality, canvas texture, Rembrandt inspired',
        shot: 'Medium shot',
        environment: 'classical painted background',
        anchor: 'oil painted subject',
        negative: 'NO digital, NO flat'
    },
    pencil_drawing: {
        name: '연필그림',
        description: '정밀하고 차분한 스케치 느낌',
        style: 'pencil drawing, graphite sketch, detailed cross-hatching, realistic shading, hand-drawn charcoal texture, monochromatic, paper grain',
        shot: 'Medium shot',
        environment: 'pencil sketched background',
        anchor: 'pencil drawn subject',
        negative: 'NO color, NO digital'
    },
    pixel_art: {
        name: '픽셀아트',
        description: '고전 게임의 향수를 부르는 레트로',
        style: 'pixel art style, 8-bit retro video game aesthetic, blocky pixels, vibrant limited palette, nostalgic gaming vibe, pixelated sprites',
        shot: 'Side view game perspective',
        environment: 'pixelated game background',
        anchor: 'pixel art character',
        negative: 'NO smooth, NO high resolution'
    },
    low_poly: {
        name: '로우폴리',
        description: '현대적이고 감각적인 3D 추상화',
        style: 'low poly 3D style, geometric facets, minimal polygons, modern 3D art, angular shapes, flat shaded faces, stylized abstract look',
        shot: 'Isometric view',
        environment: 'low poly 3D environment',
        anchor: 'low poly character',
        negative: 'NO high poly, NO realistic'
    },
    origami: {
        name: '오리가미',
        description: '종이접기의 정교함이 살아있는 독특함',
        style: 'origami paper craft style, folded paper art, geometric paper sculpture, sharp creases, clean paper texture, soft studio lighting',
        shot: 'Medium shot',
        environment: 'paper craft background',
        anchor: 'origami figure',
        negative: 'NO realistic, NO organic shapes'
    },
    comic_book: {
        name: '만화책',
        description: '강렬하고 에너제틱한 팝아트 느낌',
        style: 'classic comic book style, bold black outlines, halftone Ben-Day dots, high action contrast, pop art aesthetic, superhero comic vibe',
        shot: 'Dynamic action shot',
        environment: 'comic book city background',
        anchor: 'comic book hero',
        negative: 'NO realistic, NO soft lines'
    },
    neon_punk: {
        name: '네온펑크',
        description: '화려한 밤거리와 미래적인 감각',
        style: 'neon punk style, cyberpunk aesthetic, glowing neon lights, futuristic urban night, vibrant electric colors, rain-slicked streets, high tech vibe',
        shot: 'Wide urban shot',
        environment: 'neon lit cyberpunk city',
        anchor: 'cyberpunk character',
        negative: 'NO natural, NO pastel colors'
    },
    '3d_model': {
        name: '3D 모델',
        description: '실제 제품 사진 같은 고품질 모델링',
        style: 'photorealistic 3D render, studio lighting, clean product visualization, octane render, smooth surfaces, high detail materials, professional 3D output',
        shot: 'Product shot',
        environment: 'clean studio background',
        anchor: '3D rendered object',
        negative: 'NO 2D, NO hand drawn'
    },
    craft_clay: {
        name: '공예/점토',
        description: '투박하지만 따뜻한 흙의 질감',
        style: 'clay craft style, ceramic pottery texture, handmade clay sculpture, artisan pottery, tactile clay material, earthy tones, natural organic shapes',
        shot: 'Medium shot',
        environment: 'craft workshop background',
        anchor: 'clay crafted object',
        negative: 'NO smooth, NO digital'
    }
};
