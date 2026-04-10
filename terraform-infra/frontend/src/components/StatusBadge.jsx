const styles = {
  pending:      'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved:     'bg-blue-50   text-blue-700   border-blue-200',
  provisioning: 'bg-purple-50 text-purple-700 border-purple-200',
  completed:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed:       'bg-red-50    text-red-700    border-red-200',
  rejected:     'bg-red-50    text-red-700    border-red-200',
  running:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  stopped:      'bg-gray-100  text-gray-600   border-gray-200',
  stopping:     'bg-orange-50 text-orange-700 border-orange-200',
  terminated:   'bg-red-50    text-red-700    border-red-200',
}

const dots = {
  running:      'bg-emerald-500',
  provisioning: 'bg-purple-500',
  pending:      'bg-yellow-500',
  stopping:     'bg-orange-500',
}

export default function StatusBadge({ status }) {
  const s = (status || 'pending').toLowerCase()
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full border ${styles[s] ?? styles.pending}`}>
      {dots[s] && (
        <span className={`w-1.5 h-1.5 rounded-full ${dots[s]} animate-pulse`} />
      )}
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  )
}
