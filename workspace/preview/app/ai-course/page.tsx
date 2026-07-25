import Link from 'next/link'
import { BookOpen, Code, Cpu, Globe, Layers, Sparkles, Lock, CheckCircle } from 'lucide-react'

const lessons = [
  {
    id: 1,
    title: 'Введение в нейросети',
    description: 'Поймите, как работают искусственные нейронные сети и их историю.',
    duration: '45 мин',
    icon: Cpu,
    status: 'completed',
  },
  {
    id: 2,
    title: 'Основы машинного обучения',
    description: 'Обучение с учителем, без учителя и подкреплением — ключевые парадигмы.',
    duration: '60 мин',
    icon: Layers,
    status: 'completed',
  },
  {
    id: 3,
    title: 'Глубокое обучение и PyTorch',
    description: 'Создайте свою первую свёрточную сеть для распознавания изображений.',
    duration: '90 мин',
    icon: Code,
    status: 'in-progress',
  },
  {
    id: 4,
    title: 'Обработка естественного языка',
    description: 'Трансформеры, BERT и GPT — как модели понимают текст.',
    duration: '75 мин',
    icon: Globe,
    status: 'locked',
  },
  {
    id: 5,
    title: 'Развёртывание AI-решений',
    description: 'От Jupyter до продакшена: Docker, FastAPI, облачные сервисы.',
    duration: '60 мин',
    icon: BookOpen,
    status: 'locked',
  },
]

const statusConfig = {
  completed: { label: 'Завершён', color: 'text-emerald-500', icon: CheckCircle },
  'in-progress': { label: 'В процессе', color: 'text-amber-500', icon: Sparkles },
  locked: { label: 'Заблокирован', color: 'text-zinc-600', icon: Lock },
}

export default function AICoursePage() {
  const completedCount = lessons.filter(l => l.status === 'completed').length
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-800/40 px-6 pt-20 pb-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-1.5 text-sm text-zinc-400">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            Курс · {lessons.length} уроков
          </div>
          <h1 className="bg-gradient-to-r from-zinc-100 via-indigo-200 to-zinc-100 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
            AI Обучение
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-base text-zinc-400">
            Практический путь от понимания нейросетей до развёртывания моделей в продакшен.
          </p>
        </div>
      </section>

      {/* Прогресс */}
      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Программа курса</h2>
          <span className="text-sm text-zinc-500">{completedCount} из {lessons.length} пройдено</span>
        </div>

        <div className="space-y-3">
          {lessons.map((lesson) => {
            const Icon = lesson.icon
            const StatusIcon = statusConfig[lesson.status].icon
            const isLocked = lesson.status === 'locked'
            return (
              <div
                key={lesson.id}
                className={`group relative overflow-hidden rounded-xl border transition-all ${
                  isLocked
                    ? 'border-zinc-800/40 opacity-50'
                    : 'border-zinc-800 hover:border-indigo-500/30 hover:bg-zinc-800/30'
                } bg-zinc-900/50 backdrop-blur-sm`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex items-start gap-4 p-5">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      lesson.status === 'completed'
                        ? 'bg-emerald-900/40 text-emerald-400'
                        : lesson.status === 'in-progress'
                          ? 'bg-amber-900/40 text-amber-400'
                          : 'bg-zinc-800 text-zinc-600'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-medium text-zinc-100">{lesson.title}</h3>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          lesson.status === 'completed'
                            ? 'bg-emerald-900/30 text-emerald-400'
                            : lesson.status === 'in-progress'
                              ? 'bg-amber-900/30 text-amber-400'
                              : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig[lesson.status].label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-500 truncate">{lesson.description}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-zinc-500">{lesson.duration}</span>
                    {!isLocked && (
                      <Link
                        href={`/ai-course/${lesson.id}`}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
                      >
                        {lesson.status === 'completed' ? 'Повторить' : 'Продолжить'}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
