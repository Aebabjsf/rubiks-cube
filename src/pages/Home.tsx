import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useRef, useState, useEffect } from 'react';
import { CubeIcon, MirrorCubeIcon } from './Tutorial';

const colorMap: Record<string, string> = {
  W: '#FFFFFF',
  Y: '#FFD500',
  G: '#009E60',
  B: '#0051BA',
  R: '#C41E3A',
  O: '#FF5800',
  X: '#333333'
};

const materials = {
  base: new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.1, metalness: 0.2 }),
  U: new THREE.MeshStandardMaterial({ color: colorMap.W, roughness: 0.2 }),
  D: new THREE.MeshStandardMaterial({ color: colorMap.Y, roughness: 0.2 }),
  F: new THREE.MeshStandardMaterial({ color: colorMap.G, roughness: 0.2 }),
  B: new THREE.MeshStandardMaterial({ color: colorMap.B, roughness: 0.2 }),
  R: new THREE.MeshStandardMaterial({ color: colorMap.R, roughness: 0.2 }),
  L: new THREE.MeshStandardMaterial({ color: colorMap.O, roughness: 0.2 }),
};

const stickerGeometry = new THREE.PlaneGeometry(0.85, 0.85);

function HeroCubie({ position }: { position: [number, number, number] }) {
  const [x, y, z] = position;
  const offset = 0.51;
  const boxArgs: [number, number, number] = [1, 1, 1];

  return (
    <group position={position}>
      <RoundedBox args={boxArgs} radius={0.06} smoothness={4} material={materials.base} />
      {x === 1 && <group position={[offset, 0, 0]} rotation={[0, Math.PI / 2, 0]}><mesh geometry={stickerGeometry} material={materials.R} /></group>}
      {x === -1 && <group position={[-offset, 0, 0]} rotation={[0, -Math.PI / 2, 0]}><mesh geometry={stickerGeometry} material={materials.L} /></group>}
      {y === 1 && <group position={[0, offset, 0]} rotation={[-Math.PI / 2, 0, 0]}><mesh geometry={stickerGeometry} material={materials.U} /></group>}
      {y === -1 && <group position={[0, -offset, 0]} rotation={[Math.PI / 2, 0, 0]}><mesh geometry={stickerGeometry} material={materials.D} /></group>}
      {z === 1 && <group position={[0, 0, offset]} rotation={[0, 0, 0]}><mesh geometry={stickerGeometry} material={materials.F} /></group>}
      {z === -1 && <group position={[0, 0, -offset]} rotation={[0, Math.PI, 0]}><mesh geometry={stickerGeometry} material={materials.B} /></group>}
    </group>
  );
}

function HeroCube() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.4;
      groupRef.current.rotation.x += delta * 0.2;
    }
  });

  const cubies = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        cubies.push(<HeroCubie key={`${x}-${y}-${z}`} position={[x, y, z]} />);
      }
    }
  }

  return (
    <group ref={groupRef} rotation={[Math.PI / 6, -Math.PI / 4, 0]}>
      {cubies}
    </group>
  );
}

const facts = [
  {
    icon: "fa-solid fa-stopwatch",
    title: "Мировой рекорд",
    desc: "Американец Макс Парк собрал классический кубик Рубика всего за 3.13 секунды на официальных соревнованиях в 2023 году."
  },
  {
    icon: "fa-solid fa-calendar-days",
    title: "Первая сборка",
    desc: "Эрнё Рубику, создателю головоломки, потребовался целый месяц, чтобы впервые собрать своё изобретение без алгоритмов."
  },
  {
    icon: "fa-solid fa-calculator",
    title: "Число Бога",
    desc: "В 2010 году математики доказали, что любой, даже самый запутанный кубик Рубика, можно собрать не более чем за 20 ходов."
  }
];

const PUZZLES = [
  {
    id: '3x3',
    title: 'Кубик 3x3',
    desc: 'Классическая головоломка, золотой стандарт спидкубинга. С неё всё началось.',
    icon: <CubeIcon U="WWWWWWWWW" F="GGGGGGGGG" R="RRRRRRRRR" type="3x3" />,
    glowColor: 'bg-blue-500/15'
  },
  {
    id: '2x2',
    title: 'Кубик 2x2',
    desc: 'Карманная версия. Меньше деталей, но свои хитрости.',
    icon: <CubeIcon U="WWWWWWWWW" F="GGGGGGGGG" R="RRRRRRRRR" type="2x2" />,
    glowColor: 'bg-green-500/15'
  },
  {
    id: 'mirror',
    title: 'Mirror Blocks',
    desc: 'Зеркальный куб. Все детали одного цвета, но разной формы. Вызов вашему восприятию!',
    icon: <MirrorCubeIcon U="XXXXXXXXX" F="XXXXXXXXX" R="XXXXXXXXX" />,
    glowColor: 'bg-gray-400/15'
  },
  {
    id: 'pyraminx',
    title: 'Пирамидка',
    desc: 'Тетраэдр Мефферта. Уникальная механика вращения углов.',
    icon: <CubeIcon U="XXXX" F="GGGGGGGGG" R="XXXX" type="pyraminx" />,
    glowColor: 'bg-yellow-500/15'
  }
];

function InfinitePuzzleSlider() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const isAnimating = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const paginate = (newDirection: number) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    setDirection(newDirection);
    setIndex((prev) => (prev + newDirection + PUZZLES.length) % PUZZLES.length);
    setTimeout(() => { isAnimating.current = false; }, 600);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > 10) {
        e.preventDefault();
        if (e.deltaX > 0) paginate(1);
        else paginate(-1);
        return;
      }
      if (Math.abs(e.deltaY) > 20) {
        e.preventDefault();
        if (e.deltaY > 0) paginate(1);
        else paginate(-1);
      }
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleNativeWheel);
  }, []);

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 500 : -500,
      opacity: 0,
      scale: 0.8
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? 500 : -500,
      opacity: 0,
      scale: 0.8
    })
  };

  const p = PUZZLES[index];
  const isReversed = index % 2 !== 0;

  return (
    <div ref={containerRef} className="relative w-full mt-12 mb-24 min-h-[500px] flex flex-col justify-center overflow-visible py-12">
      <div className="relative w-full flex justify-center items-center min-h-[450px]">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={index}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ x: { type: "spring", stiffness: 250, damping: 25 }, opacity: { duration: 0.3 } }}
            className={`w-full max-w-6xl mx-auto px-4 flex flex-col ${isReversed ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12 lg:gap-24 group`}
          >
            <div className="flex-1 relative flex justify-center w-full min-h-[300px]">
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 md:w-[450px] md:h-[450px] ${p.glowColor} blur-[80px] md:blur-[120px] rounded-full transition-colors duration-700`}></div>
              <div className="w-64 h-64 md:w-80 md:h-80 lg:w-[380px] lg:h-[380px] relative z-10 drop-shadow-2xl flex items-center justify-center">
                {p.icon}
              </div>
            </div>
            <div className={`flex-1 text-center ${isReversed ? 'md:text-right' : 'md:text-left'} relative z-10`}>
              <h3 className="text-5xl lg:text-7xl font-black mb-6 text-brand-900 dark:text-white tracking-tighter">{p.title}</h3>
              <p className="text-xl lg:text-2xl text-brand-800/80 dark:text-white/70 font-medium leading-relaxed max-w-lg mx-auto md:mx-0">{p.desc}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      
      <div className="flex justify-center gap-6 mt-16 z-20">
        <button 
          onClick={() => paginate(-1)}
          className="w-14 h-14 rounded-full bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center transition-colors border border-brand-500/20 hover:scale-110 active:scale-95 cursor-pointer"
        >
          <i className="fa-solid fa-chevron-left text-xl"></i>
        </button>
        <button 
          onClick={() => paginate(1)}
          className="w-14 h-14 rounded-full bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center transition-colors border border-brand-500/20 hover:scale-110 active:scale-95 cursor-pointer"
        >
          <i className="fa-solid fa-chevron-right text-xl"></i>
        </button>
      </div>
    </div>
  );
}

export function Home() {
  return (
    <div className="w-full flex flex-col items-center">
      
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-12 max-w-6xl w-full">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 mb-24 min-h-[60vh]">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            className="flex-1 text-center lg:text-left z-10"
          >
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-extrabold mb-6 tracking-tight leading-[1.1]">
              Магия <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-[#F0C0EB]">Кубика Рубика</span>
            </h1>
            <p className="text-xl md:text-2xl text-brand-800/80 dark:text-brand-50/80 max-w-2xl font-medium mb-10">
              Погрузитесь в мир самой популярной головоломки всех времён. Узнайте историю, научитесь собирать и станьте спидкубером.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link 
                to="/tutorial" 
                className="w-full sm:w-auto px-8 py-4 bg-brand-500 hover:bg-brand-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 flex items-center justify-center gap-3"
              >
                <i className="fa-solid fa-graduation-cap text-xl"></i>
                <span>Обучение сборке</span>
              </Link>
              <Link 
                to="/simulation" 
                className="w-full sm:w-auto px-8 py-4 bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-300 font-bold rounded-2xl transition-all flex items-center justify-center gap-3"
              >
                <i className="fa-solid fa-cube text-xl"></i>
                <span>3D Симулятор</span>
              </Link>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="flex-1 relative w-full aspect-square max-w-[500px] lg:max-w-none"
          >
            <div className="absolute inset-0 bg-brand-500/20 blur-[100px] rounded-full"></div>
            <div className="absolute inset-0 z-10">
              <Canvas camera={{ position: [0, 0, 7.5], fov: 45 }}>
                <ambientLight intensity={0.7} />
                <directionalLight position={[10, 10, 5]} intensity={1.5} />
                <directionalLight position={[-10, -10, -5]} intensity={0.5} />
                <HeroCube />
              </Canvas>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 43.2Q Full Width Section */}
      <div className="w-full relative py-24 mb-16 flex flex-col items-center justify-center overflow-visible">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="container mx-auto px-4 max-w-6xl text-center relative z-10"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-brand-900 dark:text-brand-50">43 квинтиллиона комбинаций</h2>
          <p className="text-lg md:text-xl text-brand-800/80 dark:text-brand-50/60 max-w-3xl mx-auto font-medium leading-relaxed">
            А точнее, <strong className="text-brand-600 dark:text-brand-400">43 252 003 274 489 856 000</strong>. 
            Если бы вы делали по одному ходу в секунду, вам бы не хватило возраста Вселенной, чтобы перебрать их все.
          </p>
        </motion.div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[18vw] font-black text-brand-500/5 dark:text-brand-400/5 pointer-events-none select-none whitespace-nowrap">
          43.2Q
        </div>
      </div>

      {/* Puzzles Slider Full Width Section */}
      <div className="w-full mb-12 flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="container mx-auto px-4 max-w-6xl text-center mb-4"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-brand-900 dark:text-brand-50">Больше, чем просто классика</h2>
          <p className="text-lg text-brand-800/80 dark:text-brand-50/60 max-w-2xl mx-auto">
            В мире спидкубинга существуют десятки модификаций. Вот пирамидка, зеркальный куб и другие популярные головоломки.
          </p>
        </motion.div>

        <InfinitePuzzleSlider />
      </div>

      {/* Facts Section */}
      <div className="container mx-auto px-4 py-12 max-w-6xl w-full mb-32">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-brand-900 dark:text-brand-50">Интересные факты</h2>
          <p className="text-lg text-brand-800/80 dark:text-brand-50/60 max-w-2xl mx-auto">
            Головоломка, покорившая весь мир, скрывает в себе много удивительного.
          </p>
        </motion.div>
        
        <div className="flex flex-col gap-16 md:gap-24 mt-20">
          {facts.map((fact, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: index * 0.1, duration: 0.7, ease: "easeOut" }}
              className={`flex flex-col md:flex-row items-center gap-8 md:gap-16 ${index % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
            >
              <div className="w-40 h-40 md:w-56 md:h-56 relative flex-shrink-0 group">
                <div className="absolute inset-0 bg-brand-500/10 dark:bg-brand-500/20 rounded-[2rem] md:rounded-[3rem] rotate-3 group-hover:rotate-6 group-hover:scale-105 transition-all duration-500 backdrop-blur-xl border border-brand-400/30 shadow-2xl"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-brand-400 to-brand-600 rounded-[2rem] md:rounded-[3rem] -rotate-3 group-hover:-rotate-6 group-hover:scale-105 transition-all duration-500 opacity-20 dark:opacity-30"></div>
                <div className="absolute inset-0 flex items-center justify-center text-6xl md:text-7xl text-brand-600 dark:text-brand-300 drop-shadow-[0_0_15px_rgba(var(--brand-400),0.3)] group-hover:scale-110 transition-transform duration-500"
                  style={{ filter: 'drop-shadow(0 0px 15px rgba(88, 28, 233, 0.3))' }}>
                  <i className={fact.icon}></i>
                </div>
              </div>
              
              <div className={`flex-1 text-center ${index % 2 === 0 ? 'md:text-left' : 'md:text-right'}`}>
                <div className="inline-block px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 font-bold text-sm mb-4 tracking-widest uppercase shadow-sm">
                  Факт {index + 1}
                </div>
                <h3 className="text-3xl md:text-5xl font-black mb-6 text-brand-900 dark:text-white tracking-tight">{fact.title}</h3>
                <p className="text-lg md:text-xl text-brand-800/80 dark:text-brand-50/70 leading-relaxed font-medium">
                  {fact.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
