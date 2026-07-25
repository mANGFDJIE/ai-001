import Link from 'next/link'
import { BookOpen, Code, Cpu, Globe, Layers, Sparkles, Lock } from 'lucide-react'

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
  completed: { label: 'Завершён', color: 'text-emerald-400', icon: Sparkles },
  'in-progress': { label: 'В процессе', color: 'text-amber-400', icon: Layers },
  locked: { label: 'Заблокирован', color: 'text-zinc-500', icon: Lock },
}

export default function AILearnPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-800/50 px-6 pt-24 pb-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-1.5 text-sm text-zinc-400">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            Курс · 5 уроков
          </div>
          <h1 className="bg-gradient-to-r from-zinc-100 via-indigo-200 to-zinc-100 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl">
            AI Обучение
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-zinc-400">
            Практический путь от понимания нейросетей до развёртывания моделей в продакшен.
            Пошаговые уроки с реальными проектами.
          </p>
        </div>
      </section>

      {/* Lessons */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <div className="mb-12 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Программа курса</h2>
          <span className="text-sm text-zinc-500">2 из 5 уроков пройдено</span>
        </div>

        <div className="space-y-4">
          {lessons.map((lesson) => {
            const Icon = lesson.icon
            const StatusIcon = statusConfig[lesson.status].icon
            return (
              <div
                key={lesson.id}
                className={`group relative overflow-hidden rounded-xl border transition-all ${
                  lesson.status === 'locked'
                    ? 'border-zinc-800/50 opacity-60'
                    : 'border-zinc-800 hover:border-indigo-500/30 hover:bg-zinc-800/40'
                } bg-zinc-900/60 backdrop-blur-sm`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex items-start gap-5 p-6">
                  {/* Icon */}
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                      lesson.status === 'completed'
                        ? 'bg-emerald-900/40 text-emerald-400'
                        : lesson.status === 'in-progress'
                          ? 'bg-amber-900/40 text-amber-400'
                          : 'bg-zinc-800 text-zinc-600'
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-zinc-100">{lesson.title}</h3>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
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
                    <p className="mt-1 text-sm text-zinc-500">{lesson.description}</p>
                  </div>

                  {/* Duration + CTA */}
                  <div className="flex shrink-0 items-center gap-4">
                    <span className="text-sm text-zinc-500">{lesson.duration}</span>
                    {lesson.status !== 'locked' && (
                      <Link
                        href={`/ai/learn/${lesson.id}`}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
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
