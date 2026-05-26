import { useState, useEffect, useMemo } from 'react'
import {
  Search, ChevronDown, ChevronUp, BookOpen, CheckCircle, XCircle,
  ImageIcon, Filter, RefreshCw, ChevronRight, ArrowLeft, Lock,
  Eye, EyeOff, RotateCcw, ExternalLink,
} from 'lucide-react'

// ─── Config de proveedores y exámenes ────────────────────────────────────────

interface ExamConfig {
  id: string
  code: string
  name: string
  dataFile?: string       // ruta en /public/data/ — undefined = próximamente
  questions?: number      // estimado para mostrar en la card
  level: 'Fundamental' | 'Associate' | 'Expert' | 'Professional' | 'Specialty'
}

interface ProviderConfig {
  id: string
  name: string
  color: string           // color del acento
  bgGradient: string      // gradiente de la card
  logo: string            // emoji o texto corto
  exams: ExamConfig[]
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'microsoft',
    name: 'Microsoft',
    color: '#0078d4',
    bgGradient: 'from-blue-950 to-slate-900',
    logo: '⊞',
    exams: [
      { id: 'az-900', code: 'AZ-900', name: 'Azure Fundamentals',         dataFile: '/data/exam_63.json', questions: 472, level: 'Fundamental'  },
      { id: 'az-104', code: 'AZ-104', name: 'Azure Administrator',        level: 'Associate'   },
      { id: 'az-204', code: 'AZ-204', name: 'Azure Developer',            level: 'Associate'   },
      { id: 'az-305', code: 'AZ-305', name: 'Azure Solutions Architect',  level: 'Expert'      },
    ],
  },
  {
    id: 'aws',
    name: 'AWS',
    color: '#FF9900',
    bgGradient: 'from-orange-950 to-slate-900',
    logo: '☁',
    exams: [
      { id: 'clf-c02', code: 'CLF-C02', name: 'Cloud Practitioner',    level: 'Fundamental' },
      { id: 'saa-c03', code: 'SAA-C03', name: 'Solutions Architect',   level: 'Associate'   },
      { id: 'dva-c02', code: 'DVA-C02', name: 'Developer Associate',   level: 'Associate'   },
    ],
  },
  {
    id: 'google',
    name: 'Google Cloud',
    color: '#4285F4',
    bgGradient: 'from-indigo-950 to-slate-900',
    logo: '◈',
    exams: [
      { id: 'ace',  code: 'ACE',  name: 'Associate Cloud Engineer', level: 'Associate'   },
      { id: 'pca',  code: 'PCA',  name: 'Professional Cloud Arch.', level: 'Professional'},
    ],
  },
  {
    id: 'isaca',
    name: 'ISACA',
    color: '#8B5CF6',
    bgGradient: 'from-purple-950 to-slate-900',
    logo: '⬡',
    exams: [
      { id: 'cisa', code: 'CISA', name: 'Certified Information Systems Auditor',  level: 'Professional' },
      { id: 'cism', code: 'CISM', name: 'Certified Information Security Manager', level: 'Professional' },
    ],
  },
]

// ─── Types de preguntas ───────────────────────────────────────────────────────

interface Question {
  number: string
  questionText?: string
  options?: string[]
  correctAnswer?: string
  images?: string[]
}

interface ExamData {
  examId: number
  examTitle: string
  totalQuestions: number
  scrapedAt: string
  questions: Question[]
}

type FilterType = 'all' | 'mc' | 'yn' | 'img' | 'noanswer' | 'withanswer'

// ─── Tag system ───────────────────────────────────────────────────────────────

interface TagDef { label: string; color: string }

const TAG_RULES: (TagDef & { pattern: RegExp })[] = [
  // Identidad y acceso
  { label: 'Azure AD',              color: 'violet', pattern: /azure active directory|azure ad\b|entra id/i },
  { label: 'RBAC',                  color: 'violet', pattern: /\brbac\b|role.based access|role assignment/i },
  { label: 'MFA',                   color: 'violet', pattern: /multi.factor|mfa\b|conditional access/i },
  { label: 'SSO',                   color: 'violet', pattern: /single sign.on|\bsso\b/i },
  // Gobernanza
  { label: 'Azure Policy',          color: 'blue',   pattern: /azure policy/i },
  { label: 'Resource Lock',         color: 'blue',   pattern: /resource lock/i },
  { label: 'Management Groups',     color: 'blue',   pattern: /management group/i },
  { label: 'Blueprints',            color: 'blue',   pattern: /blueprint/i },
  { label: 'Cumplimiento',          color: 'blue',   pattern: /compliance|trust center|regulatory/i },
  // Redes
  { label: 'Virtual Network',       color: 'cyan',   pattern: /virtual network|\bvnet\b/i },
  { label: 'VPN',                   color: 'cyan',   pattern: /\bvpn\b|site.to.site|point.to.site/i },
  { label: 'ExpressRoute',          color: 'cyan',   pattern: /expressroute/i },
  { label: 'Load Balancer',         color: 'cyan',   pattern: /load balancer/i },
  { label: 'App Gateway',           color: 'cyan',   pattern: /application gateway/i },
  { label: 'Firewall / DDoS',       color: 'cyan',   pattern: /\bfirewall\b|\bddos\b/i },
  { label: 'DNS / CDN',             color: 'cyan',   pattern: /\bdns\b|\bcdn\b|traffic manager/i },
  // Cómputo
  { label: 'Máquinas Virtuales',    color: 'orange', pattern: /virtual machine|\bvm\b/i },
  { label: 'App Service',           color: 'orange', pattern: /app service|web app/i },
  { label: 'Azure Functions',       color: 'orange', pattern: /azure functions|serverless/i },
  { label: 'Contenedores / AKS',    color: 'orange', pattern: /container|kubernetes|\baks\b|docker/i },
  { label: 'Virtual Desktop',       color: 'orange', pattern: /virtual desktop/i },
  { label: 'Scale Sets',            color: 'orange', pattern: /scale set/i },
  // Almacenamiento
  { label: 'Blob Storage',          color: 'teal',   pattern: /blob storage|blob service/i },
  { label: 'Azure Files',           color: 'teal',   pattern: /azure files|file share|file service/i },
  { label: 'Data Lake',             color: 'teal',   pattern: /data lake/i },
  { label: 'Storage Account',       color: 'teal',   pattern: /storage account/i },
  { label: 'Redundancia',           color: 'teal',   pattern: /redundanc|\blrs\b|\bgrs\b|\bzrs\b|\bra-grs\b/i },
  // Bases de datos
  { label: 'Cosmos DB',             color: 'indigo', pattern: /cosmos db/i },
  { label: 'Azure SQL',             color: 'indigo', pattern: /sql database|sql server|azure sql/i },
  { label: 'PostgreSQL / MySQL',    color: 'indigo', pattern: /postgresql|mysql|mariadb/i },
  // Seguridad
  { label: 'Defender for Cloud',    color: 'red',    pattern: /security center|defender for cloud|microsoft defender/i },
  { label: 'Key Vault',             color: 'red',    pattern: /key vault/i },
  { label: 'Cifrado',               color: 'red',    pattern: /encrypt|certificate|tls|ssl/i },
  { label: 'Sentinel',              color: 'red',    pattern: /sentinel/i },
  { label: 'Zero Trust',            color: 'red',    pattern: /zero trust|defense.in.depth/i },
  // Monitoreo
  { label: 'Azure Monitor',         color: 'yellow', pattern: /azure monitor|log analytics|application insights/i },
  { label: 'Service Health',        color: 'yellow', pattern: /service health|planned maintenance/i },
  { label: 'Azure Advisor',         color: 'yellow', pattern: /azure advisor/i },
  // Alta disponibilidad
  { label: 'Availability Zones',    color: 'green',  pattern: /availability zone/i },
  { label: 'Availability Sets',     color: 'green',  pattern: /availability set/i },
  { label: 'SLA / Uptime',          color: 'green',  pattern: /\bsla\b|uptime|99\.\d+\s*%/i },
  { label: 'Disaster Recovery',     color: 'green',  pattern: /disaster recovery|site recovery/i },
  // Costos
  { label: 'Precios / Costos',      color: 'amber',  pattern: /pricing|cost management|\btco\b|budget/i },
  { label: 'CapEx / OpEx',          color: 'amber',  pattern: /capex|opex|pay.as.you.go|expenditure/i },
  { label: 'Reservas / Ahorro',     color: 'amber',  pattern: /reserved instance|hybrid benefit/i },
  // Modelos de servicio
  { label: 'IaaS',                  color: 'slate',  pattern: /\biaas\b|infrastructure as a service/i },
  { label: 'PaaS',                  color: 'slate',  pattern: /\bpaas\b|platform as a service/i },
  { label: 'SaaS',                  color: 'slate',  pattern: /\bsaas\b|software as a service/i },
  { label: 'Modelo de nube',        color: 'slate',  pattern: /public cloud|private cloud|hybrid cloud/i },
  { label: 'Resp. Compartida',      color: 'slate',  pattern: /shared responsibility/i },
  // Migración y DevOps
  { label: 'Migración',             color: 'purple', pattern: /azure migrate|\bmigrat/i },
  { label: 'IaC / ARM',             color: 'purple', pattern: /arm template|\bbicep\b|terraform|infrastructure as code/i },
  { label: 'DevOps',                color: 'purple', pattern: /devops|pipeline|\bci\/cd\b/i },
  // IA / ML
  { label: 'IA / ML',               color: 'pink',   pattern: /machine learning|cognitive service|\bai\b|artificial intelligence|bot service/i },
  // Geografía / Regiones
  { label: 'Regiones',              color: 'gray',   pattern: /\bregion\b|geography|geograph/i },
  { label: 'Gov Cloud',             color: 'gray',   pattern: /azure government|sovereign/i },
  { label: 'Marketplace',           color: 'gray',   pattern: /marketplace/i },
]

const TAG_COLOR: Record<string, string> = {
  violet: 'bg-violet-900/40 text-violet-300 border-violet-700/50',
  blue:   'bg-blue-900/40 text-blue-300 border-blue-700/50',
  cyan:   'bg-cyan-900/40 text-cyan-300 border-cyan-700/50',
  orange: 'bg-orange-900/40 text-orange-300 border-orange-700/50',
  teal:   'bg-teal-900/40 text-teal-300 border-teal-700/50',
  indigo: 'bg-indigo-900/40 text-indigo-300 border-indigo-700/50',
  red:    'bg-red-900/40 text-red-300 border-red-700/50',
  yellow: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
  green:  'bg-green-900/40 text-green-300 border-green-700/50',
  amber:  'bg-amber-900/40 text-amber-300 border-amber-700/50',
  slate:  'bg-slate-800 text-slate-400 border-slate-600',
  purple: 'bg-purple-900/40 text-purple-300 border-purple-700/50',
  pink:   'bg-pink-900/40 text-pink-300 border-pink-700/50',
  gray:   'bg-gray-800/60 text-gray-400 border-gray-600/50',
}

/** Dado "Question 42" o "Pregunta 42" devuelve el número entero */
function parseQuestionNumber(numStr: string): number | null {
  const m = numStr?.match(/\d+/)
  return m ? parseInt(m[0], 10) : null
}

/** Calcula la página en examprepper (5 preguntas por página) */
function examPage(questionNumber: number): number {
  return Math.ceil(questionNumber / 5)
}

function getQuestionTags(q: Question): TagDef[] {
  const corpus = [q.number, q.questionText, ...(q.options ?? []), q.correctAnswer]
    .filter(Boolean).join(' ')
  return TAG_RULES.filter(r => r.pattern.test(corpus))
}

function TagChip({
  tag, active, onClick,
}: { tag: TagDef; active?: boolean; onClick?: (label: string) => void }) {
  const base = TAG_COLOR[tag.color] ?? TAG_COLOR.slate
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick?.(tag.label) }}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all duration-100
        ${base}
        ${active ? 'ring-1 ring-offset-1 ring-offset-transparent ring-current opacity-100' : 'opacity-80 hover:opacity-100'}
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      {active && <span>✕</span>}
      {tag.label}
    </button>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getType(q: Question) {
  if (q.images?.length) return 'img'
  if (q.options?.length === 2 && q.options.some(o => /yes|no|sí/i.test(o))) return 'yn'
  if (q.options?.length) return 'mc'
  return 'other'
}

function isCorrectOpt(opt: string, correctAnswer?: string) {
  if (!correctAnswer) return false
  return correctAnswer.toLowerCase().includes(opt.substring(0, 12).toLowerCase().trim())
}

const LEVEL_COLOR: Record<string, string> = {
  Fundamental:  'text-emerald-400 bg-emerald-900/30 border-emerald-800',
  Associate:    'text-blue-400    bg-blue-900/30    border-blue-800',
  Expert:       'text-amber-400   bg-amber-900/30   border-amber-800',
  Professional: 'text-purple-400  bg-purple-900/30  border-purple-800',
  Specialty:    'text-rose-400    bg-rose-900/30    border-rose-800',
}

// ─── Level 1: Provider cards ─────────────────────────────────────────────────

function ProviderCard({ p, onClick }: { p: ProviderConfig; onClick: () => void }) {
  const available = p.exams.filter(e => e.dataFile).length
  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left bg-gradient-to-br ${p.bgGradient} border border-white/10 rounded-2xl p-6 hover:border-white/25 hover:scale-[1.02] transition-all duration-200 group`}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-4xl" style={{ color: p.color }}>{p.logo}</span>
        <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors mt-1" />
      </div>
      <h3 className="text-lg font-bold text-white mb-1">{p.name}</h3>
      <p className="text-xs text-slate-500">{p.exams.length} exámenes</p>
      {available > 0 && (
        <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-900/40 border border-emerald-800/50 rounded-full px-2.5 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-emerald-400 font-medium">{available} disponible{available > 1 ? 's' : ''}</span>
        </div>
      )}
    </button>
  )
}

// ─── Level 2: Exam cards ──────────────────────────────────────────────────────

function ExamCard({ exam, provider, onClick }: { exam: ExamConfig; provider: ProviderConfig; onClick: () => void }) {
  const available = !!exam.dataFile
  return (
    <button
      onClick={available ? onClick : undefined}
      className={`relative w-full text-left bg-surface border rounded-xl p-5 transition-all duration-200 ${
        available
          ? 'border-border hover:border-white/25 hover:bg-white/5 cursor-pointer group'
          : 'border-border/50 opacity-50 cursor-not-allowed'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-mono font-bold" style={{ color: provider.color }}>{exam.code}</span>
          <span className={`ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${LEVEL_COLOR[exam.level]}`}>
            {exam.level}
          </span>
        </div>
        {available
          ? <ChevronRight size={15} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
          : <Lock size={13} className="text-slate-700" />
        }
      </div>
      <h4 className="text-sm font-semibold text-slate-200 mb-2">{exam.name}</h4>
      {available && exam.questions && (
        <p className="text-xs text-slate-500">{exam.questions} preguntas</p>
      )}
      {!available && (
        <p className="text-xs text-slate-600 italic">Próximamente</p>
      )}
    </button>
  )
}

// ─── Level 3: Question card ───────────────────────────────────────────────────

function TypeBadge({ type }: { type: ReturnType<typeof getType> }) {
  const cfg = {
    mc:    { label: 'Múltiple opción', cls: 'bg-blue-900/50 text-blue-300 border-blue-800' },
    yn:    { label: 'Sí / No',         cls: 'bg-green-900/50 text-green-300 border-green-800' },
    img:   { label: 'Con imagen',      cls: 'bg-purple-900/50 text-purple-300 border-purple-800' },
    other: { label: 'Abierta',         cls: 'bg-slate-800 text-slate-400 border-slate-700' },
  }[type]
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
}

function QuestionCard({
  q, qEs, index, activeTag, onTagClick, examId,
}: {
  q: Question
  qEs?: Question
  index: number
  activeTag: string | null
  onTagClick: (label: string) => void
  examId: number
}) {
  const [open,     setOpen]     = useState(false)
  const [es,       setEs]       = useState(false)
  const [selected, setSelected] = useState<number | null>(null)   // índice opción elegida
  const [verified, setVerified] = useState(false)                  // si ya verificó
  const [showAns,  setShowAns]  = useState(false)                  // para preguntas sin opciones

  const shown = es && qEs ? qEs : q
  const type  = getType(q)
  const tags  = useMemo(() => getQuestionTags(q), [q])

  const hasOptions  = (shown.options?.length ?? 0) > 0
  const hasAnswer   = !!shown.correctAnswer

  // Resultado de la verificación
  const selectedIsCorrect = verified && selected !== null
    && isCorrectOpt(shown.options![selected], shown.correctAnswer)

  const handleSelect = (i: number) => {
    if (verified) return
    setSelected(prev => prev === i ? null : i)
  }

  const reset = () => { setSelected(null); setVerified(false); setShowAns(false) }

  // Resetear quiz al cambiar idioma o al colapsar
  const handleToggleOpen = () => {
    setOpen(o => !o)
    reset()
  }

  return (
    <div className={`bg-surface border rounded-xl overflow-hidden transition-all duration-200 ${
      open ? 'border-primary/40' : 'border-border hover:border-slate-600'
    }`}>

      {/* ── Header ── */}
      <button
        onClick={handleToggleOpen}
        className="w-full text-left hover:bg-white/5 transition-colors px-4 pt-3 pb-2.5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xs font-mono text-slate-500 shrink-0">#{index + 1}</span>
            <span className="text-sm text-slate-300 truncate">
              {shown.questionText?.split('\n')[0]?.slice(0, 110) || shown.number}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Indicador de resultado (sólo cuando está verificado) */}
            {verified && (
              selectedIsCorrect
                ? <CheckCircle size={13} className="text-emerald-400" />
                : <XCircle     size={13} className="text-red-400" />
            )}
            {q.images?.length ? <ImageIcon size={13} className="text-purple-400" /> : null}
            {/* Enlace a examprepper */}
            {(() => {
              const n = parseQuestionNumber(q.number)
              if (!n) return null
              const url = `https://www.examprepper.co/exam/${examId}/${examPage(n)}`
              return (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Ver pregunta ${n} en examprepper.co`}
                  onClick={e => e.stopPropagation()}
                  className="flex items-center justify-center w-6 h-6 rounded border bg-slate-800 border-slate-600 text-slate-400 hover:text-sky-400 hover:border-sky-500/60 transition-colors"
                >
                  <ExternalLink size={11} />
                </a>
              )
            })()}
            {/* Toggle EN / ES */}
            {qEs && (
              <button
                type="button"
                title={es ? 'Ver en inglés' : 'Ver en español'}
                onClick={e => { e.stopPropagation(); setEs(v => !v); reset() }}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                  es
                    ? 'bg-amber-900/50 border-amber-600/60 text-amber-300'
                    : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200'
                }`}
              >
                {es ? '🇪🇸' : '🇺🇸'}
              </button>
            )}
            {open ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
          </div>
        </div>

        {/* Fila 2: TypeBadge + tags */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <TypeBadge type={type} />
          {tags.slice(0, 4).map(tag => (
            <TagChip key={tag.label} tag={tag} active={activeTag === tag.label} onClick={onTagClick} />
          ))}
          {tags.length > 4 && (
            <span className="text-[10px] text-slate-600">+{tags.length - 4} más</span>
          )}
        </div>
      </button>

      {/* ── Contenido expandido ── */}
      {open && (
        <div className="px-4 pb-4 border-t border-border/50 pt-4 space-y-4">

          {/* Tags completos */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <TagChip key={tag.label} tag={tag} active={activeTag === tag.label} onClick={onTagClick} />
              ))}
            </div>
          )}

          {/* Texto de la pregunta */}
          {shown.questionText && (
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{shown.questionText}</p>
          )}

          {/* Imágenes */}
          {shown.images?.map((src, i) => (
            <img key={i} src={src} alt="" className="max-w-full rounded-lg border border-border"
              onError={e => (e.currentTarget.style.display = 'none')} />
          ))}

          {/* ── Opciones clickeables (mc / yn) ── */}
          {hasOptions && (
            <div className="space-y-2">
              {shown.options!.map((opt, i) => {
                const isSelected  = selected === i
                const isCorrect   = isCorrectOpt(opt, shown.correctAnswer)

                let cls = 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-white/5 hover:border-slate-500 cursor-pointer'
                if (!verified) {
                  if (isSelected) cls = 'bg-primary/20 border-primary/70 text-white cursor-pointer'
                } else {
                  if (isCorrect)               cls = 'bg-emerald-900/30 border-emerald-600/60 text-emerald-300 cursor-default'
                  else if (isSelected)         cls = 'bg-red-900/30 border-red-600/60 text-red-300 cursor-default'
                  else                         cls = 'bg-slate-800/30 border-slate-700/30 text-slate-500 cursor-default opacity-60'
                }

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelect(i)}
                    className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-sm text-left transition-all duration-150 ${cls}`}
                  >
                    {verified && isCorrect   && <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" />}
                    {verified && isSelected && !isCorrect && <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />}
                    {!verified && isSelected && (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-primary bg-primary/40 shrink-0 mt-0.5" />
                    )}
                    {!verified && !isSelected && (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0 mt-0.5" />
                    )}
                    <span>{opt}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* ── Feedback de verificación ── */}
          {verified && hasOptions && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold ${
              selectedIsCorrect
                ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-400'
                : 'bg-red-900/20 border-red-700/40 text-red-400'
            }`}>
              {selectedIsCorrect
                ? <><CheckCircle size={15} /> ¡Correcto!</>
                : <><XCircle     size={15} /> Incorrecto — la respuesta correcta está resaltada en verde</>
              }
            </div>
          )}

          {/* ── Acciones ── */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Verificar (sólo si hay opción seleccionada y no ha verificado) */}
            {hasOptions && selected !== null && !verified && (
              <button
                onClick={() => setVerified(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/50 text-primary text-xs font-semibold hover:bg-primary/30 transition-colors"
              >
                <CheckCircle size={13} /> Verificar respuesta
              </button>
            )}

            {/* Reintentar */}
            {(verified || (!hasOptions && showAns)) && (
              <button
                onClick={reset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-xs font-semibold hover:bg-white/5 transition-colors"
              >
                <RotateCcw size={12} /> Reintentar
              </button>
            )}

            {/* Mostrar / ocultar respuesta (para cualquier tipo) */}
            {hasAnswer && (
              <button
                onClick={() => setShowAns(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-xs font-semibold hover:bg-white/5 transition-colors ml-auto"
              >
                {showAns ? <><EyeOff size={12} /> Ocultar respuesta</> : <><Eye size={12} /> Ver respuesta</>}
              </button>
            )}
          </div>

          {/* ── Respuesta visible (cuando showAns o verified) ── */}
          {(showAns || verified) && hasAnswer && (
            <div className="bg-emerald-900/15 border border-emerald-700/40 rounded-lg px-3 py-2.5">
              <p className="text-[11px] text-emerald-500 font-semibold uppercase tracking-wide mb-1">Respuesta correcta</p>
              <p className="text-sm text-emerald-300 leading-relaxed">{shown.correctAnswer}</p>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ─── Level 3: Exam viewer ────────────────────────────────────────────────────

const PER_PAGE = 25

function ExamViewer({ exam }: { exam: ExamConfig; provider?: ProviderConfig }) {
  const [data,   setData]   = useState<ExamData | null>(null)
  const [esData, setEsData] = useState<ExamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [page, setPage] = useState(1)
  const [activeTag,    setActiveTag]    = useState<string | null>(null)
  const [showTagPanel, setShowTagPanel] = useState(false)
  const [tagSearch,    setTagSearch]    = useState('')

  const handleTagClick = (label: string) => {
    setActiveTag(prev => prev === label ? null : label)
    setPage(1)
  }

  // Carga EN (principal)
  useEffect(() => {
    setLoading(true); setError(null); setPage(1); setSearch(''); setData(null); setEsData(null)
    fetch(exam.dataFile!)
      .then(r => { if (!r.ok) throw new Error('No se pudo cargar'); return r.json() })
      .then((d: ExamData) => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })

    // Carga ES en paralelo (silenciosa — no bloquea si falla)
    const esFile = exam.dataFile!.replace(/\.json$/, '_es.json')
    fetch(esFile)
      .then(r => r.ok ? r.json() : null)
      .then((d: ExamData | null) => setEsData(d))
      .catch(() => setEsData(null))
  }, [exam.dataFile])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase().trim()
    return data.questions.filter(item => {
      if (q) {
        const h = [item.number, item.questionText, ...(item.options || []), item.correctAnswer].join(' ').toLowerCase()
        if (!h.includes(q)) return false
      }
      if (filter === 'noanswer')   return !item.correctAnswer
      if (filter === 'withanswer') return !!item.correctAnswer
      if (filter !== 'all') { if (getType(item) !== filter) return false }
      if (activeTag) {
        if (!getQuestionTags(item).some(t => t.label === activeTag)) return false
      }
      return true
    })
  }, [data, search, filter, activeTag])

  // Conteo de tags sobre TODAS las preguntas (no solo las filtradas)
  const allTagCounts = useMemo(() => {
    if (!data) return []
    const map = new Map<string, { tag: TagDef; count: number }>()
    data.questions.forEach(q => {
      getQuestionTags(q).forEach(tag => {
        const e = map.get(tag.label)
        if (e) e.count++
        else map.set(tag.label, { tag, count: 1 })
      })
    })
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [data])

  const visibleTags = tagSearch.trim()
    ? allTagCounts.filter(({ tag }) => tag.label.toLowerCase().includes(tagSearch.toLowerCase()))
    : allTagCounts

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const go = (p: number) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-slate-500">
      <RefreshCw size={18} className="animate-spin" />
      <span className="text-sm">Cargando preguntas...</span>
    </div>
  )
  if (error) return <div className="text-center py-20 text-red-400 text-sm">{error}</div>
  if (!data) return null

  const withAnswer   = data.questions.filter(q => q.correctAnswer).length
  const withImg      = data.questions.filter(q => q.images?.length).length
  const withNoAnswer = data.questions.filter(q => !q.correctAnswer).length

  const STAT_CARDS: { label: string; value: number; color: string; active: string; filterKey: FilterType }[] = [
    { label: 'Total',          value: data.totalQuestions, color: 'text-blue-400',    active: 'border-blue-500/60 bg-blue-500/10',    filterKey: 'all'        },
    { label: 'Con respuesta',  value: withAnswer,           color: 'text-emerald-400', active: 'border-emerald-500/60 bg-emerald-500/10', filterKey: 'withanswer' },
    { label: 'Con imagen',     value: withImg,              color: 'text-purple-400',  active: 'border-purple-500/60 bg-purple-500/10',  filterKey: 'img'        },
    { label: 'Sin respuesta',  value: withNoAnswer,         color: 'text-amber-400',   active: 'border-amber-500/60 bg-amber-500/10',    filterKey: 'noanswer'   },
  ]

  return (
    <div className="space-y-5">

      {/* Stat cards — clickeable para filtrar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT_CARDS.map(({ label, value, color, active, filterKey }) => {
          const isActive = filter === filterKey
          return (
            <button
              key={label}
              onClick={() => { setFilter(isActive ? 'all' : filterKey); setPage(1) }}
              className={`text-left px-4 py-3 rounded-xl border transition-all duration-150 ${
                isActive
                  ? active
                  : 'bg-surface border-border hover:border-slate-500 hover:bg-white/5'
              }`}
            >
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              {isActive && <p className="text-[10px] text-slate-500 mt-1">activo · clic para quitar</p>}
            </button>
          )
        })}
      </div>

      {/* Search + filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar pregunta, opción, respuesta..."
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-primary/60 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-500" />
          <select value={filter} onChange={e => { setFilter(e.target.value as FilterType); setPage(1) }}
            className="bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-primary/60 cursor-pointer">
            <option value="all">Todos los tipos</option>
            <option value="mc">Opción múltiple</option>
            <option value="yn">Sí / No</option>
            <option value="img">Con imagen</option>
            <option value="noanswer">Sin respuesta</option>
          </select>
        </div>
      </div>

      {/* ── Panel filtro por concepto ── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">

        {/* Header del panel */}
        <button
          onClick={() => setShowTagPanel(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Filter size={14} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-300">Filtrar por concepto</span>
            {activeTag && (
              <span className="text-[10px] bg-primary/20 border border-primary/40 text-primary px-2 py-0.5 rounded-full font-semibold">
                {activeTag}
              </span>
            )}
            <span className="text-[11px] text-slate-600">
              {allTagCounts.length} conceptos
            </span>
          </div>
          <div className="flex items-center gap-2">
            {activeTag && (
              <button
                onClick={e => { e.stopPropagation(); setActiveTag(null); setPage(1) }}
                className="text-[11px] text-slate-500 hover:text-red-400 transition-colors px-2 py-0.5 rounded border border-slate-700 hover:border-red-500/50"
              >
                ✕ Quitar
              </button>
            )}
            {showTagPanel
              ? <ChevronUp size={14} className="text-slate-500" />
              : <ChevronDown size={14} className="text-slate-500" />
            }
          </div>
        </button>

        {/* Contenido expandido */}
        {showTagPanel && (
          <div className="border-t border-border px-4 py-3 space-y-3">

            {/* Buscador de concepto */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={tagSearch}
                onChange={e => setTagSearch(e.target.value)}
                placeholder="Buscar concepto..."
                className="w-full bg-slate-800/60 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-primary/60 transition-colors"
              />
              {tagSearch && (
                <button
                  onClick={() => setTagSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Grid de tags con conteo */}
            {visibleTags.length === 0
              ? <p className="text-xs text-slate-600 py-2">Sin resultados para "{tagSearch}"</p>
              : (
                <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {visibleTags.map(({ tag, count }) => {
                    const isActive = activeTag === tag.label
                    const base = TAG_COLOR[tag.color] ?? TAG_COLOR.slate
                    return (
                      <button
                        key={tag.label}
                        onClick={() => handleTagClick(tag.label)}
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all duration-100
                          ${base}
                          ${isActive
                            ? 'ring-1 ring-offset-1 ring-offset-surface ring-current scale-105'
                            : 'opacity-70 hover:opacity-100 hover:scale-105'
                          }`}
                      >
                        {isActive && <span className="text-[9px]">✕</span>}
                        {tag.label}
                        <span className="text-[10px] opacity-60 font-normal">{count}</span>
                      </button>
                    )
                  })}
                </div>
              )
            }
          </div>
        )}
      </div>

      {/* Count + page */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{filtered.length === data.totalQuestions ? `${data.totalQuestions} preguntas` : `${filtered.length} de ${data.totalQuestions}`}</span>
        <span>Página {page} de {totalPages || 1}</span>
      </div>

      {/* Questions */}
      {pageItems.length === 0
        ? <div className="text-center py-20 text-slate-600"><Search size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Sin resultados</p></div>
        : <div className="space-y-2">{pageItems.map((q, i) => {
            const enIdx = data.questions.indexOf(q)
            return (
              <QuestionCard
                key={`${q.number}-${i}`}
                q={q}
                qEs={esData?.questions[enIdx]}
                index={(page - 1) * PER_PAGE + i}
                activeTag={activeTag}
                onTagClick={handleTagClick}
                examId={data.examId}
              />
            )
          })}</div>
      }

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4 flex-wrap">
          <button onClick={() => go(Math.max(1, page - 1))} disabled={page === 1}
            className="px-3 py-2 text-sm rounded-lg border border-border text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            ← Anterior
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | '...')[]>((acc, p, idx, arr) => {
              if (idx > 0 && (arr[idx - 1] as number) !== p - 1) acc.push('...')
              acc.push(p); return acc
            }, [])
            .map((p, i) => p === '...'
              ? <span key={`d${i}`} className="text-slate-600 px-1">…</span>
              : <button key={p} onClick={() => go(p as number)}
                  className={`w-9 h-9 text-sm rounded-lg border transition-colors ${page === p ? 'bg-primary border-primary text-white font-bold' : 'border-border text-slate-400 hover:text-white hover:bg-white/5'}`}>
                  {p}
                </button>
            )}
          <button onClick={() => go(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="px-3 py-2 text-sm rounded-lg border border-border text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb({ provider, exam, onGoRoot, onGoProvider }: {
  provider?: ProviderConfig
  exam?: ExamConfig
  onGoRoot: () => void
  onGoProvider: () => void
}) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-500 flex-wrap">
      <button onClick={onGoRoot} className="hover:text-slate-300 transition-colors">Certificaciones</button>
      {provider && (
        <>
          <ChevronRight size={13} className="text-slate-700" />
          <button onClick={onGoProvider} className={`transition-colors ${exam ? 'hover:text-slate-300' : 'text-slate-300 font-medium'}`}>
            {provider.name}
          </button>
        </>
      )}
      {exam && (
        <>
          <ChevronRight size={13} className="text-slate-700" />
          <span className="text-slate-300 font-medium">{exam.code}</span>
        </>
      )}
    </nav>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type View = 'providers' | 'exams' | 'viewer'

export function Certifications() {
  const [view, setView] = useState<View>('providers')
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null)
  const [selectedExam, setSelectedExam] = useState<ExamConfig | null>(null)

  const goRoot = () => { setView('providers'); setSelectedProvider(null); setSelectedExam(null) }
  const goProvider = () => { setView('exams'); setSelectedExam(null) }
  const selectProvider = (p: ProviderConfig) => { setSelectedProvider(p); setView('exams') }
  const selectExam = (e: ExamConfig) => { setSelectedExam(e); setView('viewer') }

  return (
    <div className="px-20 py-6 w-full space-y-6">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={20} className="text-primary" />
            <h1 className="text-xl font-bold text-white">Certificaciones</h1>
          </div>
          <Breadcrumb
            provider={selectedProvider ?? undefined}
            exam={selectedExam ?? undefined}
            onGoRoot={goRoot}
            onGoProvider={goProvider}
          />
        </div>
        {view !== 'providers' && (
          <button
            onClick={view === 'viewer' ? goProvider : goRoot}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={15} />
            Volver
          </button>
        )}
      </div>

      {/* ── Nivel 1: Proveedores ── */}
      {view === 'providers' && (
        <>
          <p className="text-sm text-slate-500">Selecciona un proveedor para ver los exámenes disponibles.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PROVIDERS.map(p => <ProviderCard key={p.id} p={p} onClick={() => selectProvider(p)} />)}
          </div>
        </>
      )}

      {/* ── Nivel 2: Exámenes ── */}
      {view === 'exams' && selectedProvider && (
        <>
          <div className="flex items-center gap-3">
            <span className="text-3xl" style={{ color: selectedProvider.color }}>{selectedProvider.logo}</span>
            <div>
              <h2 className="text-lg font-bold text-white">{selectedProvider.name}</h2>
              <p className="text-xs text-slate-500">{selectedProvider.exams.length} exámenes · {selectedProvider.exams.filter(e => e.dataFile).length} disponibles</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {selectedProvider.exams.map(e => (
              <ExamCard key={e.id} exam={e} provider={selectedProvider} onClick={() => selectExam(e)} />
            ))}
          </div>
        </>
      )}

      {/* ── Nivel 3: Viewer ── */}
      {view === 'viewer' && selectedProvider && selectedExam && (
        <>
          <div className="flex items-center gap-3 pb-2 border-b border-border">
            <span className="text-2xl" style={{ color: selectedProvider.color }}>{selectedProvider.logo}</span>
            <div>
              <h2 className="text-base font-bold text-white">{selectedExam.code} — {selectedExam.name}</h2>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${LEVEL_COLOR[selectedExam.level]}`}>
                {selectedExam.level}
              </span>
            </div>
          </div>
          <ExamViewer exam={selectedExam} provider={selectedProvider} />
        </>
      )}

    </div>
  )
}
