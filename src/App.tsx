import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

interface Target {
  id: number
  x: number
  y: number
  size: number
}

type GameMode = 'dashboard' | 'normal' | 'intensive' | 'ak-spray' | 'reflexo' | 'quadrado' | 'l' | 'l-fugitivo'

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
  const [targetSize, setTargetSize] = useState<'grande' | 'medio' | 'pequeno' | 'muito-pequeno' | 'micro'>('grande')
  const [squareSize, setSquareSize] = useState<'medio' | 'pequeno' | 'muito-pequeno' | 'micro'>('medio')
  const [gridSize, setGridSize] = useState(5) // Tamanho da grade (5x5, 6x6, etc)
  const [lModeTargets, setLModeTargets] = useState<'single' | 'multiple'>('multiple') // Modo L: 1 alvo ou múltiplos
  const [spawnSpeed, setSpawnSpeed] = useState<'lento' | 'normal' | 'rapido' | 'muito-rapido'>('normal')
  const [maxTargets, setMaxTargets] = useState(1)
  const [cursorTrailEnabled, setCursorTrailEnabled] = useState(false)
  const [cursorTrail, setCursorTrail] = useState<Array<{ x: number; y: number; timestamp: number }>>([])
  const [hitTargets, setHitTargets] = useState<Set<number>>(new Set()) // Para animação de acerto no modo l-fugitivo
  
  // AK Spray mode
  const [akSprayPattern, setAkSprayPattern] = useState<{ x: number; y: number }[]>([])
  const [currentSprayIndex, setCurrentSprayIndex] = useState(0)
  const [_isSpraying, setIsSpraying] = useState(false)
  const mousePos = useRef({ x: 0, y: 0 })

  // Reflexo mode
  const [reactionTimes, setReactionTimes] = useState<number[]>([])
  const [averageReactionTime, setAverageReactionTime] = useState(0)
  const targetSpawnTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const targetDisappearTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const targetSpawnTimeRef = useRef<number>(0)

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

  // Handlers para redimensionar área

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

    const currentAreaSize = gameMode === 'intensive' ? 5 : gameMode === 'reflexo' ? 10 : gameMode === 'quadrado' ? 15 : areaSize
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
    if (gameMode === 'reflexo') {
      // No modo reflexo, usar o tamanho selecionado pelo usuário
      switch (targetSize) {
        case 'grande':
          return 80 + Math.random() * 20
        case 'medio':
          return 50 + Math.random() * 20
        case 'pequeno':
          return 30 + Math.random() * 15
        case 'muito-pequeno':
          return 18 + Math.random() * 10
        case 'micro':
          return 10 + Math.random() * 8
        default:
          return 50
      }
    }
    if (gameMode === 'quadrado') {
      // No modo quadrado, usar o tamanho de quadrado selecionado
      switch (squareSize) {
        case 'medio':
          return 50 + Math.random() * 20
        case 'pequeno':
          return 30 + Math.random() * 15
        case 'muito-pequeno':
          return 18 + Math.random() * 10
        case 'micro':
          return 10 + Math.random() * 8
        default:
          return 40
      }
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
      case 'micro':
        return 10 + Math.random() * 8
      default:
        return 80
    }
  }, [targetSize, gameMode])

  // Calcular grade de cubículos para modo quadrado
  const getGridCells = useCallback(() => {
    if (gameMode !== 'quadrado' || gameArea.width === 0 || gameArea.height === 0) return []
    
    const areaSize = 400 // Tamanho fixo da área quadrada (400x400px)
    const offsetX = (gameArea.width - areaSize) / 2
    const offsetY = (gameArea.height - areaSize) / 2
    
    const cellSize = areaSize / gridSize
    const cells: Array<{ x: number; y: number; width: number; height: number }> = []
    
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        cells.push({
          x: offsetX + col * cellSize,
          y: offsetY + row * cellSize,
          width: cellSize,
          height: cellSize
        })
      }
    }
    
    return cells
  }, [gameMode, gameArea, gridSize])

  // Gerar novos alvos (modo normal/intensivo/quadrado/l)
  const spawnTarget = useCallback(() => {
    if (!gameStarted || gameArea.width === 0 || gameArea.height === 0) return
    if (gameMode === 'ak-spray' || gameMode === 'reflexo') return

    if (gameMode === 'quadrado') {
      // Modo quadrado: spawnar dentro dos cubículos da grade
      const cells = getGridCells()
      if (cells.length === 0) return
      
      // Escolher um cubículo aleatório que não tenha alvo
      const availableCells = cells.filter(cell => {
        // Verificar se já existe um alvo neste cubículo
        return !targets.some(target => {
          const targetCenterX = target.x + target.size / 2
          const targetCenterY = target.y + target.size / 2
          return targetCenterX >= cell.x && targetCenterX <= cell.x + cell.width &&
                 targetCenterY >= cell.y && targetCenterY <= cell.y + cell.height
        })
      })
      
      if (availableCells.length === 0) return
      
      const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)]
      const size = getTargetSize()
      const padding = 5
      const maxSize = Math.min(randomCell.width, randomCell.height) - padding * 2
      const actualSize = Math.min(size, maxSize)
      
      const x = randomCell.x + (randomCell.width - actualSize) / 2
      const y = randomCell.y + (randomCell.height - actualSize) / 2
      
      setTargets((prev) => [
        ...prev,
        {
          id: targetIdCounter,
          x,
          y,
          size: actualSize
        }
      ])
      setTargetIdCounter((prev) => prev + 1)
    } else {
      // Modos normais
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
    }
  }, [gameStarted, gameArea, targetIdCounter, getSpawnArea, getTargetSize, gameMode, getGridCells, targets])

  // Obter intervalo de spawn baseado na velocidade (mais rápido)
  const getSpawnInterval = useCallback(() => {
    switch (spawnSpeed) {
      case 'lento':
        return 800 // 0.8 segundos
      case 'normal':
        return 500 // 0.5 segundos
      case 'rapido':
        return 300 // 0.3 segundos
      case 'muito-rapido':
        return 150 // 0.15 segundos
      default:
        return 500
    }
  }, [spawnSpeed])

  // Aumentar gradualmente o número máximo de alvos (mais rápido)
  useEffect(() => {
    if (!gameStarted || gameMode === 'ak-spray') return

    const increaseMaxTargets = setInterval(() => {
      setMaxTargets((prev) => {
        const newMax = prev + 1
        // Limitar a 15 alvos máximo (aumentado)
        return newMax > 15 ? 15 : newMax
      })
    }, 3000) // Aumenta a cada 3 segundos (mais rápido)

    return () => clearInterval(increaseMaxTargets)
  }, [gameStarted, gameMode])

  // Spawnar alvos periodicamente (modos normal e intensive)
  useEffect(() => {
    if (!gameStarted || gameMode === 'ak-spray' || gameMode === 'reflexo' || gameMode === 'quadrado') return

    const interval = getSpawnInterval()
    const spawnInterval = setInterval(() => {
      // No modo L, verificar se é single ou multiple
      if (gameMode === 'l' || gameMode === 'l-fugitivo') {
        if (lModeTargets === 'single' && targets.length >= 1) return
        if (lModeTargets === 'multiple' && targets.length >= maxTargets) return
      } else {
        if (targets.length >= maxTargets) return
      }
      spawnTarget()
    }, interval)

    return () => clearInterval(spawnInterval)
  }, [gameStarted, targets.length, spawnTarget, gameMode, maxTargets, getSpawnInterval, lModeTargets])

  // Limitar alvos quando mudar para modo single no modo L
  useEffect(() => {
    if ((gameMode === 'l' || gameMode === 'l-fugitivo') && lModeTargets === 'single' && targets.length > 1) {
      setTargets((prev) => prev.slice(0, 1))
    }
  }, [gameMode, lModeTargets, targets.length])

  // Modo Reflexo: Spawn aleatório de alvos
  const spawnReflexoTarget = useCallback(() => {
    if (!gameStarted || gameMode !== 'reflexo') return
    if (gameArea.width === 0 || gameArea.height === 0) return

    // Verificar se já existe um alvo antes de spawnar
    setTargets((currentTargets) => {
      if (currentTargets.length > 0) return currentTargets // Só um alvo por vez

      const spawnArea = getSpawnArea()
      const size = getTargetSize()
      const padding = 20
      const maxX = spawnArea.width - size - padding * 2
      const maxY = spawnArea.height - size - padding * 2

      if (maxX <= 0 || maxY <= 0) return currentTargets

      const x = spawnArea.offsetX + padding + Math.random() * maxX
      const y = spawnArea.offsetY + padding + Math.random() * maxY

      setTargetIdCounter((prev) => {
        const newId = prev + 1
        const newTarget: Target = {
          id: newId,
          x,
          y,
          size
        }

        // Spawnar o alvo
        setTimeout(() => {
          setTargets([newTarget])
          targetSpawnTimeRef.current = Date.now()

          // Fazer o alvo desaparecer após 0.5 segundos (500ms) se não for clicado
          if (targetDisappearTimeoutRef.current) {
            clearTimeout(targetDisappearTimeoutRef.current)
          }
          targetDisappearTimeoutRef.current = setTimeout(() => {
            setTargets((prev) => prev.filter((t) => t.id !== newTarget.id))
            setMisses((m) => m + 1)
            // Spawnar próximo alvo após um delay aleatório de 2-10 segundos
            const nextSpawnDelay = 2000 + Math.random() * 8000 // 2-10 segundos
            if (targetSpawnTimeoutRef.current) {
              clearTimeout(targetSpawnTimeoutRef.current)
            }
            targetSpawnTimeoutRef.current = setTimeout(() => {
              spawnReflexoTarget()
            }, nextSpawnDelay)
          }, 500) // 0.5 segundos (500ms) para clicar
        }, 0)

        return newId
      })

      return currentTargets
    })
  }, [gameStarted, gameMode, gameArea, getSpawnArea, getTargetSize])

  // Iniciar spawn no modo reflexo
  useEffect(() => {
    if (!gameStarted || gameMode !== 'reflexo') {
      // Limpar timeouts quando sair do modo
      if (targetSpawnTimeoutRef.current) {
        clearTimeout(targetSpawnTimeoutRef.current)
        targetSpawnTimeoutRef.current = null
      }
      if (targetDisappearTimeoutRef.current) {
        clearTimeout(targetDisappearTimeoutRef.current)
        targetDisappearTimeoutRef.current = null
      }
      return
    }

    // Spawnar primeiro alvo após um delay aleatório inicial de até 10 segundos
    const initialDelay = Math.random() * 10000 // 0-10 segundos
    if (targetSpawnTimeoutRef.current) {
      clearTimeout(targetSpawnTimeoutRef.current)
    }
    targetSpawnTimeoutRef.current = setTimeout(() => {
      spawnReflexoTarget()
    }, initialDelay)

    return () => {
      if (targetSpawnTimeoutRef.current) {
        clearTimeout(targetSpawnTimeoutRef.current)
      }
      if (targetDisappearTimeoutRef.current) {
        clearTimeout(targetDisappearTimeoutRef.current)
      }
    }
  }, [gameStarted, gameMode, spawnReflexoTarget])

  // Spawnar primeiro alvo
  useEffect(() => {
    if (gameStarted && targets.length === 0 && gameMode !== 'ak-spray' && gameMode !== 'reflexo') {
      spawnTarget()
    }
  }, [gameStarted, targets.length, spawnTarget, gameMode])

  // Alvos só desaparecem quando acertados (removido timeout automático)

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

  // Rastrear posição do mouse para o rastro do cursor
  useEffect(() => {
    if (!cursorTrailEnabled || gameMode === 'dashboard') return

    let lastTime = 0
    const throttleTime = 8 // ~120fps para rastro bem rápido

    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now()
      if (now - lastTime < throttleTime) return
      lastTime = now

      const timestamp = Date.now()
      setCursorTrail((prev) => {
        const newTrail = [...prev, { x: e.clientX, y: e.clientY, timestamp }]
        // Manter apenas os últimos 30 pontos e remover pontos antigos (> 80ms)
        return newTrail.filter((point) => timestamp - point.timestamp < 80).slice(-30)
      })
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [cursorTrailEnabled, gameMode])

  // Limpar rastro antigo
  useEffect(() => {
    if (!cursorTrailEnabled) {
      setCursorTrail([])
      return
    }

    const cleanupInterval = setInterval(() => {
      const now = Date.now()
      setCursorTrail((prev) => prev.filter((point) => now - point.timestamp < 80))
    }, 16) // ~60fps

    return () => clearInterval(cleanupInterval)
  }, [cursorTrailEnabled])

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
    } else if (gameMode === 'reflexo') {
      // Modo reflexo: calcular tempo de reação
      const reactionTime = Date.now() - targetSpawnTimeRef.current
      setReactionTimes((prev) => {
        const newTimes = [...prev, reactionTime]
        const avg = newTimes.reduce((a, b) => a + b, 0) / newTimes.length
        setAverageReactionTime(avg)
        return newTimes
      })
      
      // Limpar timeout de desaparecimento
      if (targetDisappearTimeoutRef.current) {
        clearTimeout(targetDisappearTimeoutRef.current)
        targetDisappearTimeoutRef.current = null
      }
      
      setTargets((prev) => prev.filter((t) => t.id !== targetId))
      setScore((prev) => prev + 10)
      setHits((prev) => prev + 1)
      
      // Spawnar próximo alvo após um delay aleatório de 2-10 segundos
      const nextSpawnDelay = 2000 + Math.random() * 8000 // 2-10 segundos
      if (targetSpawnTimeoutRef.current) {
        clearTimeout(targetSpawnTimeoutRef.current)
      }
      targetSpawnTimeoutRef.current = setTimeout(() => {
        spawnReflexoTarget()
      }, nextSpawnDelay)
    } else {
      // No modo l-fugitivo, adicionar animação de acerto antes de remover
      if (gameMode === 'l-fugitivo') {
        setHitTargets((prev) => new Set([...prev, targetId]))
        // Aguardar animação antes de remover o alvo
        setTimeout(() => {
          setTargets((prev) => prev.filter((t) => t.id !== targetId))
          setHitTargets((prev) => {
            const newSet = new Set(prev)
            newSet.delete(targetId)
            return newSet
          })
          setScore((prev) => prev + 10)
          setHits((prev) => prev + 1)
          spawnTarget()
        }, 300)
      } else {
        setTargets((prev) => prev.filter((t) => t.id !== targetId))
        setScore((prev) => prev + 10)
        setHits((prev) => prev + 1)
        spawnTarget()
      }
    }
  }

  const handleMissClick = useCallback((e?: React.MouseEvent) => {
    if (targets.length > 0 && gameMode !== 'ak-spray') {
      setMisses((prev) => prev + 1)
      
      // No modo l-fugitivo, fazer os alvos fugirem quando há miss click próximo
      if (gameMode === 'l-fugitivo' && e) {
        const clickX = e.clientX
        const clickY = e.clientY
        const escapeDistance = 25 // Distância que o alvo vai fugir (pequena para apenas uma "fugidinha")
        
        setTargets((prevTargets) => {
          return prevTargets.map((target) => {
            // Calcular distância do clique ao centro do alvo
            const targetCenterX = target.x + target.size / 2
            const targetCenterY = target.y + target.size / 2
            const distance = Math.sqrt(
              Math.pow(clickX - targetCenterX, 2) + Math.pow(clickY - targetCenterY, 2)
            )
            
            // Se o clique foi próximo (dentro de 150px), fazer o alvo fugir
            if (distance < 150) {
              // Calcular direção oposta ao cursor
              const dx = targetCenterX - clickX
              const dy = targetCenterY - clickY
              const angle = Math.atan2(dy, dx)
              
              // Nova posição: mover na direção oposta ao cursor
              let newX = target.x + Math.cos(angle) * escapeDistance
              let newY = target.y + Math.sin(angle) * escapeDistance
              
              // Garantir que não saia dos limites da área de spawn
              if (gameArea.width > 0 && gameArea.height > 0) {
                const currentAreaSize = areaSize
                const spawnWidth = (gameArea.width * currentAreaSize) / 100
                const spawnHeight = (gameArea.height * currentAreaSize) / 100
                const offsetX = (gameArea.width - spawnWidth) / 2
                const offsetY = (gameArea.height - spawnHeight) / 2
                
                newX = Math.max(offsetX, Math.min(newX, offsetX + spawnWidth - target.size))
                newY = Math.max(offsetY, Math.min(newY, offsetY + spawnHeight - target.size))
              }
              
              return { ...target, x: newX, y: newY }
            }
            
            return target
          })
        })
      }
    }
  }, [targets.length, gameMode, gameArea, areaSize])

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
    setMaxTargets(1) // Começar com 1 alvo
    // Resetar estatísticas do modo reflexo
    setReactionTimes([])
    setAverageReactionTime(0)
    // Limpar timeouts
    if (targetSpawnTimeoutRef.current) {
      clearTimeout(targetSpawnTimeoutRef.current)
      targetSpawnTimeoutRef.current = null
    }
    if (targetDisappearTimeoutRef.current) {
      clearTimeout(targetDisappearTimeoutRef.current)
      targetDisappearTimeoutRef.current = null
    }
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
    setMaxTargets(1) // Resetar para 1 alvo
    // Resetar estatísticas do modo reflexo
    setReactionTimes([])
    setAverageReactionTime(0)
    // Limpar timeouts
    if (targetSpawnTimeoutRef.current) {
      clearTimeout(targetSpawnTimeoutRef.current)
      targetSpawnTimeoutRef.current = null
    }
    if (targetDisappearTimeoutRef.current) {
      clearTimeout(targetDisappearTimeoutRef.current)
      targetDisappearTimeoutRef.current = null
    }
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
            <button
              className="dashboard-button reflexo"
              onClick={() => startGame('reflexo')}
            >
              <span className="button-icon">⚡</span>
              <span className="button-title">Reflexo</span>
              <span className="button-desc">Teste seus reflexos! Alvos aparecem aleatoriamente em área micro</span>
            </button>
            <button
              className="dashboard-button quadrado"
              onClick={() => startGame('quadrado')}
            >
              <span className="button-icon">⬜</span>
              <span className="button-title">Quadrado</span>
              <span className="button-desc">Alvos quadrados em área pequena - Escolha o tamanho do quadrado</span>
            </button>
            <button
              className="dashboard-button l-mode"
              onClick={() => startGame('l')}
            >
              <span className="button-icon">I</span>
              <span className="button-title">Modo L</span>
              <span className="button-desc">Igual ao modo normal, mas com alvos em formato de I em negrito</span>
            </button>
            <button
              className="dashboard-button l-fugitivo"
              onClick={() => startGame('l-fugitivo')}
            >
              <span className="button-icon">🏃</span>
              <span className="button-title">Modo L Fugitivo</span>
              <span className="button-desc">Alvos em formato de I que fogem quando você erra o clique</span>
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
              {(gameMode === 'normal' || gameMode === 'l' || gameMode === 'l-fugitivo') && (
                <>
                  <div className="area-size-selector">
                    <span className="area-label">Área:</span>
                    <div className="area-buttons">
                      {[100, 80, 60, 40, 20, 10].map((size) => (
                        <button
                          key={size}
                          className={`area-button ${areaSize === size ? 'active' : ''}`}
                          onClick={() => setAreaSize(size)}
                        >
                          {size === 10 ? 'Micro' : `${size}%`}
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
                        { key: 'muito-pequeno', label: 'M. Pequeno' },
                        { key: 'micro', label: 'Micro' }
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
                  <div className="spawn-speed-selector">
                    <span className="area-label">Velocidade:</span>
                    <div className="area-buttons">
                      {[
                        { key: 'lento', label: 'Lento' },
                        { key: 'normal', label: 'Normal' },
                        { key: 'rapido', label: 'Rápido' },
                        { key: 'muito-rapido', label: 'M. Rápido' }
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          className={`area-button ${spawnSpeed === key ? 'active' : ''}`}
                          onClick={() => setSpawnSpeed(key as typeof spawnSpeed)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(gameMode === 'l' || gameMode === 'l-fugitivo') && (
                    <div className="target-size-selector">
                      <span className="area-label">Alvos:</span>
                      <div className="area-buttons">
                        <button
                          className={`area-button ${lModeTargets === 'single' ? 'active' : ''}`}
                          onClick={() => setLModeTargets('single')}
                        >
                          1 Alvo
                        </button>
                        <button
                          className={`area-button ${lModeTargets === 'multiple' ? 'active' : ''}`}
                          onClick={() => setLModeTargets('multiple')}
                        >
                          Múltiplos
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {gameMode === 'intensive' && (
                <>
                  <div className="special-mode-info">
                    <span className="area-label">⭐ Área: 5% | Alvos: Minúsculos</span>
                  </div>
                  <div className="spawn-speed-selector">
                    <span className="area-label">Velocidade:</span>
                    <div className="area-buttons">
                      {[
                        { key: 'lento', label: 'Lento' },
                        { key: 'normal', label: 'Normal' },
                        { key: 'rapido', label: 'Rápido' },
                        { key: 'muito-rapido', label: 'M. Rápido' }
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          className={`area-button ${spawnSpeed === key ? 'active' : ''}`}
                          onClick={() => setSpawnSpeed(key as typeof spawnSpeed)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {gameMode === 'ak-spray' && (
                <div className="ak-spray-info">
                  <span className="area-label">🔫 AK47 Spray Pattern | Tiro {currentSprayIndex + 1}/30</span>
                </div>
              )}
              {gameMode === 'reflexo' && (
                <>
                  <div className="special-mode-info">
                    <span className="area-label">⚡ Área: Micro (10%) | Modo Reflexo</span>
                  </div>
                  <div className="target-size-selector">
                    <span className="area-label">Alvo:</span>
                    <div className="area-buttons">
                      {[
                        { key: 'grande', label: 'Grande' },
                        { key: 'medio', label: 'Médio' },
                        { key: 'pequeno', label: 'Pequeno' },
                        { key: 'muito-pequeno', label: 'M. Pequeno' },
                        { key: 'micro', label: 'Micro' }
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
              {gameMode === 'quadrado' && (
                <>
                  <div className="special-mode-info">
                    <span className="area-label">⬜ Modo Quadrado | Grade {gridSize}x{gridSize}</span>
                  </div>
                  <div className="target-size-selector">
                    <span className="area-label">Tamanho:</span>
                    <div className="area-buttons">
                      {[
                        { key: 'medio', label: 'Médio' },
                        { key: 'pequeno', label: 'Pequeno' },
                        { key: 'muito-pequeno', label: 'M. Pequeno' },
                        { key: 'micro', label: 'Micro' }
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          className={`area-button ${squareSize === key ? 'active' : ''}`}
                          onClick={() => setSquareSize(key as typeof squareSize)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="target-size-selector">
                    <span className="area-label">Grade:</span>
                    <div className="area-buttons">
                      {[4, 5, 6, 7, 8].map((size) => (
                        <button
                          key={size}
                          className={`area-button ${gridSize === size ? 'active' : ''}`}
                          onClick={() => setGridSize(size)}
                        >
                          {size}x{size}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
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
              {gameMode === 'reflexo' ? (
                <>
                  <div className="ui-item">
                    <span className="ui-label">Tempo Médio</span>
                    <span className="ui-value">{averageReactionTime > 0 ? `${averageReactionTime.toFixed(0)}ms` : '---'}</span>
                  </div>
                  {reactionTimes.length > 0 && (
                    <div className="ui-item">
                      <span className="ui-label">Último</span>
                      <span className="ui-value">{reactionTimes[reactionTimes.length - 1]}ms</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="ui-item">
                  <span className="ui-label">Precisão</span>
                  <span className="ui-value">{accuracy}%</span>
                </div>
              )}
            </div>
            <div className="ui-right">
              <button 
                className={`trail-button ${cursorTrailEnabled ? 'active' : ''}`}
                onClick={() => setCursorTrailEnabled(!cursorTrailEnabled)}
                title="Ativar/Desativar rastro do cursor"
              >
                {cursorTrailEnabled ? '✨ Rastro ON' : '✨ Rastro OFF'}
              </button>
              <button className="pause-button" onClick={resetGame}>
                Voltar
              </button>
            </div>
          </div>
          <div className={`game-area ${gameMode === 'quadrado' ? 'quadrado-mode' : ''}`} onClick={(e) => handleMissClick(e)}>
            {/* Rastro do cursor */}
            {cursorTrailEnabled && cursorTrail.length > 0 && (
              <svg 
                className="cursor-trail" 
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  pointerEvents: 'none', 
                  zIndex: 5 
                }}
              >
                {cursorTrail.map((point, index) => {
                  if (index === 0) return null
                  const prevPoint = cursorTrail[index - 1]
                  // Opacidade baseada na posição no array (mais antigo = menos opacidade)
                  const age = index / cursorTrail.length
                  const opacity = 0.8 * (1 - age)
                  return (
                    <line
                      key={`${point.timestamp}-${index}`}
                      x1={prevPoint.x}
                      y1={prevPoint.y}
                      x2={point.x}
                      y2={point.y}
                      stroke="rgba(255, 255, 255, 0.9)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      opacity={opacity}
                    />
                  )
                })}
                {cursorTrail.map((point, index) => {
                  const age = index / cursorTrail.length
                  const opacity = 1 * (1 - age * 0.7)
                  return (
                    <circle
                      key={`circle-${point.timestamp}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r="2.5"
                      fill="rgba(255, 255, 255, 1)"
                      opacity={opacity}
                    />
                  )
                })}
              </svg>
            )}
            {/* Grade de cubículos para modo quadrado */}
            {gameMode === 'quadrado' && (
              <div className="grid-container">
                {getGridCells().map((cell, index) => (
                  <div
                    key={index}
                    className="grid-cell"
                    style={{
                      left: `${cell.x}px`,
                      top: `${cell.y}px`,
                      width: `${cell.width}px`,
                      height: `${cell.height}px`
                    }}
                  />
                ))}
              </div>
            )}
            {(gameMode === 'intensive' || gameMode === 'reflexo' || ((gameMode === 'normal' || gameMode === 'l' || gameMode === 'l-fugitivo') && areaSize < 100)) && (
              <div
                className="spawn-area-indicator"
                style={{
                  width: `${(gameArea.width * (gameMode === 'intensive' ? 5 : gameMode === 'reflexo' ? 10 : areaSize)) / 100}px`,
                  height: `${(gameArea.height * (gameMode === 'intensive' ? 5 : gameMode === 'reflexo' ? 10 : areaSize)) / 100}px`,
                  left: `${(gameArea.width - (gameArea.width * (gameMode === 'intensive' ? 5 : gameMode === 'reflexo' ? 10 : areaSize)) / 100) / 2}px`,
                  top: `${(gameArea.height - (gameArea.height * (gameMode === 'intensive' ? 5 : gameMode === 'reflexo' ? 10 : areaSize)) / 100) / 2}px`
                }}
              />
            )}
            {gameMode === 'ak-spray' && (
              <>
                {/* Linha guia do padrão de spray */}
                <svg className="spray-pattern-line" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                  {akSprayPattern.length > 0 && (
                    <polyline
                      points={akSprayPattern.map((p) => `${p.x},${p.y}`).join(' ')}
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
                className={`target ${gameMode === 'intensive' ? 'special-target' : ''} ${gameMode === 'ak-spray' ? (target.id === currentSprayIndex ? 'ak-target-active' : 'ak-target') : ''} ${gameMode === 'quadrado' ? 'square-target' : ''} ${gameMode === 'l' || gameMode === 'l-fugitivo' ? 'l-target' : ''} ${gameMode === 'l-fugitivo' && hitTargets.has(target.id) ? 'target-hit-animation' : ''}`}
                style={{
                  left: `${target.x}px`,
                  top: `${target.y}px`,
                  width: `${target.size}px`,
                  height: `${target.size}px`,
                  pointerEvents: gameMode === 'ak-spray' && target.id !== currentSprayIndex ? 'none' : (gameMode === 'l' || gameMode === 'l-fugitivo') ? 'none' : 'auto'
                }}
                onClick={(gameMode === 'l' || gameMode === 'l-fugitivo') ? undefined : (e) => {
                  e.stopPropagation()
                  handleTargetClick(target.id)
                }}
              >
                {(gameMode === 'l' || gameMode === 'l-fugitivo') && (
                  <span 
                    className="l-target-text"
                    style={{
                      fontSize: `${target.size * 0.8}px`
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleTargetClick(target.id)
                    }}
                  >
                    I
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default App
