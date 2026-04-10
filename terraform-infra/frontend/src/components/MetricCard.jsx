export default function MetricCard({ label, value, sub, icon: Icon, color = 'blue' }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',    icon: 'text-blue-600',   val: 'text-blue-700'   },
    green:  { bg: 'bg-emerald-50', icon: 'text-emerald-600', val: 'text-emerald-700' },
    amber:  { bg: 'bg-amber-50',   icon: 'text-amber-600',  val: 'text-amber-700'  },
    purple: { bg: 'bg-purple-50',  icon: 'text-purple-600', val: 'text-purple-700' },
    red:    { bg: 'bg-red-50',     icon: 'text-red-600',    val: 'text-red-700'    },
  }
  const c = colors[color] || colors.blue

  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`${c.bg} p-2.5 rounded-xl shrink-0`}>
        <Icon size={20} className={c.icon} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${c.val}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
