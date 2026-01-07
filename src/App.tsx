import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

interface Target {
  id: number
  x: number
  y: number
  size: number
}

type GameMode = 'dashboard' | 'normal' | 'intensive' | 'ak-spray'

function App() {
  const [gameMode, setGameMode] = useState<GameMode>('dashboard')
  const [gameStarted, setGameStarted] = useState(false)
  const [targets, setTargets] = useState<Target[]>([])
  const [score, setScore] = useState(0)
  const [hits, setHits] = useState(0)
  const [misses, setMisses] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [targetIdCounter, setTargetIdCounter] = useState(0)
  const [gameArea, setGameArea] = useState({ width: 0, height: 0 })
  const [areaSize, setAreaSize] = useState(100)
  const [targetSize, setTargetSize] = useState<'grande' | 'medio' | 'pequeno' | 'muito-pequeno'>('grande')
  
  // AK Spray mode
  const [akSprayPattern, setAkSprayPattern] = useState<{ x: number; y: number }[]>([])
  const [currentSprayIndex, setCurrentSprayIndex] = useState(0)
  const [isSpraying, setIsSpraying] = useState(false)
  const sprayStartPos = useRef({ x: 0, y: 0 })
  const mousePos = useRef({ x: 0, y: 0 })

  // Configurar área de jogo
  useEffect(() => {
    const updateGameArea = () => {
      setGameArea({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }
    updateGameArea()
    window.addEventListener('resize', updateGameArea)
    return () => window.removeEventListener('resize', updateGameArea)
  }, [])

  // Gerar padrão de spray da AK47 (30 balas)
  const generateAKSprayPattern = useCallback(() => {
    const centerX = gameArea.width / 2
    const centerY = gameArea.height / 2
    const pattern: { x: number; y: number }[] = []
    
    // Padrão de recoil da AK47 do CS2 (aproximado)
    // Primeiros tiros: puxa para baixo
    // Depois: movimento para direita
    // Depois: movimento para esquerda
    // Forma geral: "7" invertido
    
    for (let i = 0; i < 30; i++) {
      let x = 0
      let y = 0
      
      if (i < 5) {
        // Primeiros 5 tiros: puxa para baixo
        y = i * 8
      } else if (i < 12) {
        // Próximos 7 tiros: puxa para baixo e começa a ir para direita
        y = 40 + (i - 5) * 6
        x = (i - 5) * 4
      } else if (i < 20) {
        // Próximos 8 tiros: movimento para direita
        y = 82 + (i - 12) * 3
        x = 28 + (i - 12) * 5
      } else {
        // Últimos 10 tiros: movimento para esquerda
        y = 106 + (i - 20) * 2
        x = 68 - (i - 20) * 4
      }
      
      pattern.push({
        x: centerX + x,
        y: centerY + y
      })
    }
    
    return pattern
  }, [gameArea])

  // Cronômetro
  useEffect(() => {
    if (!gameStarted) return

    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [gameStarted])

  // Calcular área de spawn
  const getSpawnArea = useCallback(() => {
    if (gameArea.width === 0 || gameArea.height === 0) {
      return { width: 0, height: 0, offsetX: 0, offsetY: 0 }
    }

    const currentAreaSize = gameMode === 'intensive' ? 5 : areaSize
    const spawnWidth = (gameArea.width * currentAreaSize) / 100
    const spawnHeight = (gameArea.height * currentAreaSize) / 100
    const offsetX = (gameArea.width - spawnWidth) / 2
    const offsetY = (gameArea.height - spawnHeight) / 2

    return { width: spawnWidth, height: spawnHeight, offsetX, offsetY }
  }, [gameArea, areaSize, gameMode])

  // Obter tamanho do alvo
  const getTargetSize = useCallback(() => {
    if (gameMode === 'intensive') {
      return 3 + Math.random() * 2 // 3-5px
    }
    if (gameMode === 'ak-spray') {
      return 8 // Tamanho fixo para spray
    }

    switch (targetSize) {
      case 'grande':
        return 100 + Math.random() * 30
      case 'medio':
        return 60 + Math.random() * 30
      case 'pequeno':
        return 35 + Math.random() * 20
      case 'muito-pequeno':
        return 20 + Math.random() * 15
      default:
        return 80
    }
  }, [targetSize, gameMode])

  // Gerar novos alvos (modo normal/intensivo)
  const spawnTarget = useCallback(() => {
    if (!gameStarted || gameArea.width === 0 || gameArea.height === 0) return
    if (gameMode === 'ak-spray') return

    const spawnArea = getSpawnArea()
    const size = getTargetSize()
    const padding = gameMode === 'intensive' ? 5 : 20
    const maxX = spawnArea.width - size - padding * 2
    const maxY = spawnArea.height - size - padding * 2

    if (maxX <= 0 || maxY <= 0) return

    const x = spawnArea.offsetX + padding + Math.random() * maxX
    const y = spawnArea.offsetY + padding + Math.random() * maxY

    setTargets((prev) => [
      ...prev,
      {
        id: targetIdCounter,
        x,
        y,
        size
      }
    ])
    setTargetIdCounter((prev) => prev + 1)
  }, [gameStarted, gameArea, targetIdCounter, getSpawnArea, getTargetSize, gameMode])

  // Spawnar alvos periodicamente
  useEffect(() => {
    if (!gameStarted || gameMode === 'ak-spray') return

    const spawnInterval = setInterval(() => {
      if (targets.length < 5) {
        spawnTarget()
      }
    }, 1000)

    return () => clearInterval(spawnInterval)
  }, [gameStarted, targets.length, spawnTarget, gameMode])

  // Spawnar primeiro alvo
  useEffect(() => {
    if (gameStarted && targets.length === 0 && gameMode !== 'ak-spray') {
      spawnTarget()
    }
  }, [gameStarted, targets.length, spawnTarget, gameMode])

  // Remover alvo após tempo
  useEffect(() => {
    if (!gameStarted || gameMode === 'ak-spray') return

    const timeout = setTimeout(() => {
      setTargets((prev) => {
        if (prev.length > 0) {
          setMisses((m) => m + 1)
          return prev.slice(1)
        }
        return prev
      })
    }, 2000)

    return () => clearTimeout(timeout)
  }, [targets, gameStarted, gameMode])

  // Inicializar padrão AK quando entrar no modo
  useEffect(() => {
    if (gameMode === 'ak-spray' && gameArea.width > 0) {
      const pattern = generateAKSprayPattern()
      setAkSprayPattern(pattern)
      setCurrentSprayIndex(0)
      
      // Criar alvos no padrão
      const sprayTargets: Target[] = pattern.map((pos, index) => ({
        id: index,
        x: pos.x - 4,
        y: pos.y - 4,
        size: 8
      }))
      setTargets(sprayTargets)
    }
  }, [gameMode, gameArea, generateAKSprayPattern])

  // Rastrear posição do mouse no modo AK
  useEffect(() => {
    if (gameMode !== 'ak-spray' || !gameStarted) return

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [gameMode, gameStarted])

  const handleTargetClick = (targetId: number) => {
    if (gameMode === 'ak-spray') {
      // No modo AK, verificar se clicou no alvo correto do padrão
      if (targetId === currentSprayIndex) {
        setCurrentSprayIndex((prev) => {
          const next = prev + 1
          if (next >= akSprayPattern.length) {
            // Completou o spray, reiniciar
            setScore((s) => s + 100)
            setHits((h) => h + 1)
            return 0
          }
          setScore((s) => s + 10)
          setHits((h) => h + 1)
          return next
        })
      } else {
        setMisses((m) => m + 1)
      }
    } else {
      setTargets((prev) => prev.filter((t) => t.id !== targetId))
      setScore((prev) => prev + 10)
      setHits((prev) => prev + 1)
      spawnTarget()
    }
  }

  const handleMissClick = () => {
    if (targets.length > 0 && gameMode !== 'ak-spray') {
      setMisses((prev) => prev + 1)
    }
  }

  const startGame = (mode: GameMode) => {
    setGameMode(mode)
    setGameStarted(true)
    setScore(0)
    setHits(0)
    setMisses(0)
    setElapsedTime(0)
    setTargets([])
    setTargetIdCounter(0)
    setCurrentSprayIndex(0)
  }

  const resetGame = () => {
    setGameStarted(false)
    setGameMode('dashboard')
    setTargets([])
    setScore(0)
    setHits(0)
    setMisses(0)
    setElapsedTime(0)
    setTargetIdCounter(0)
    setCurrentSprayIndex(0)
    setIsSpraying(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const accuracy = hits + misses > 0 ? ((hits / (hits + misses)) * 100).toFixed(1) : '0.0'

  return (
    <div className="app">
      {gameMode === 'dashboard' ? (
        <div className="dashboard">
          <h1>🎯 Aim Trainer</h1>
          <p className="dashboard-subtitle">Escolha seu modo de treino</p>
          <div className="dashboard-buttons">
            <button
              className="dashboard-button normal"
              onClick={() => startGame('normal')}
            >
              <span className="button-icon">🎯</span>
              <span className="button-title">Treino Normal</span>
              <span className="button-desc">Alvos aleatórios com configurações personalizáveis</span>
            </button>
            <button
              className="dashboard-button intensive"
              onClick={() => startGame('intensive')}
            >
              <span className="button-icon">⭐</span>
              <span className="button-title">Treino Intensivo</span>
              <span className="button-desc">Área 5% com alvos minúsculos - Máximo desafio</span>
            </button>
            <button
              className="dashboard-button ak-spray"
              onClick={() => startGame('ak-spray')}
            >
              <span className="button-icon">🔫</span>
              <span className="button-title">Spray de AK</span>
              <span className="button-desc">Treine o controle de recoil da AK47 do CS2</span>
            </button>
          </div>
          {score > 0 && (
            <div className="final-stats">
              <h2>Última Partida</h2>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Pontuação</span>
                  <span className="stat-value">{score}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Acertos</span>
                  <span className="stat-value">{hits}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Precisão</span>
                  <span className="stat-value">{accuracy}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="game-ui">
            <div className="ui-left">
              {gameMode === 'normal' && (
                <>
                  <div className="area-size-selector">
                    <span className="area-label">Área:</span>
                    <div className="area-buttons">
                      {[100, 80, 60, 40, 20].map((size) => (
                        <button
                          key={size}
                          className={`area-button ${areaSize === size ? 'active' : ''}`}
                          onClick={() => setAreaSize(size)}
                        >
                          {size}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="target-size-selector">
                    <span className="area-label">Alvo:</span>
                    <div className="area-buttons">
                      {[
                        { key: 'grande', label: 'Grande' },
                        { key: 'medio', label: 'Médio' },
                        { key: 'pequeno', label: 'Pequeno' },
                        { key: 'muito-pequeno', label: 'M. Pequeno' }
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          className={`area-button ${targetSize === key ? 'active' : ''}`}
                          onClick={() => setTargetSize(key as typeof targetSize)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {gameMode === 'intensive' && (
                <div className="special-mode-info">
                  <span className="area-label">⭐ Área: 5% | Alvos: Minúsculos</span>
                </div>
              )}
              {gameMode === 'ak-spray' && (
                <div className="ak-spray-info">
                  <span className="area-label">🔫 AK47 Spray Pattern | Tiro {currentSprayIndex + 1}/30</span>
                </div>
              )}
            </div>
            <div className="ui-center">
              <div className="ui-item">
                <span className="ui-label">Tempo</span>
                <span className="ui-value">{formatTime(elapsedTime)}</span>
              </div>
              <div className="ui-item">
                <span className="ui-label">Pontos</span>
                <span className="ui-value">{score}</span>
              </div>
              <div className="ui-item">
                <span className="ui-label">Acertos</span>
                <span className="ui-value">{hits}</span>
              </div>
              <div className="ui-item">
                <span className="ui-label">Erros</span>
                <span className="ui-value">{misses}</span>
              </div>
              <div className="ui-item">
                <span className="ui-label">Precisão</span>
                <span className="ui-value">{accuracy}%</span>
              </div>
            </div>
            <div className="ui-right">
              <button className="pause-button" onClick={resetGame}>
                Voltar
              </button>
            </div>
          </div>
          <div className="game-area" onClick={handleMissClick}>
            {(gameMode === 'intensive' || (gameMode === 'normal' && areaSize < 100)) && (
              <div
                className="spawn-area-indicator"
                style={{
                  width: `${(gameArea.width * (gameMode === 'intensive' ? 5 : areaSize)) / 100}px`,
                  height: `${(gameArea.height * (gameMode === 'intensive' ? 5 : areaSize)) / 100}px`,
                  left: `${(gameArea.width - (gameArea.width * (gameMode === 'intensive' ? 5 : areaSize)) / 100) / 2}px`,
                  top: `${(gameArea.height - (gameArea.height * (gameMode === 'intensive' ? 5 : areaSize)) / 100) / 2}px`
                }}
              />
            )}
            {gameMode === 'ak-spray' && (
              <>
                {/* Linha guia do padrão de spray */}
                <svg className="spray-pattern-line" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                  {akSprayPattern.length > 0 && (
                    <polyline
                      points={akSprayPattern.map((p, i) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke="rgba(255, 215, 0, 0.3)"
                      strokeWidth="2"
                    />
                  )}
                </svg>
                {/* Alvo atual destacado */}
                {akSprayPattern[currentSprayIndex] && (
                  <div
                    className="ak-current-target"
                    style={{
                      left: `${akSprayPattern[currentSprayIndex].x - 12}px`,
                      top: `${akSprayPattern[currentSprayIndex].y - 12}px`,
                      width: '24px',
                      height: '24px'
                    }}
                  />
                )}
              </>
            )}
            {targets.map((target) => (
              <div
                key={target.id}
                className={`target ${gameMode === 'intensive' ? 'special-target' : ''} ${gameMode === 'ak-spray' ? (target.id === currentSprayIndex ? 'ak-target-active' : 'ak-target') : ''}`}
                style={{
                  left: `${target.x}px`,
                  top: `${target.y}px`,
                  width: `${target.size}px`,
                  height: `${target.size}px`,
                  pointerEvents: gameMode === 'ak-spray' && target.id !== currentSprayIndex ? 'none' : 'auto'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  handleTargetClick(target.id)
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default App
