import { useState, useEffect, useRef } from 'react'
import { getRequestLogs } from '../api/api'
import { X, RefreshCw } from 'lucide-react'

export default function LogViewer({ requestId, onClose }) {
  const [logs, setLogs]       = useState('Loading logs...')
  const [loading, setLoading] = useState(true)
  const bottomRef             = useRef(null)

  async function fetchLogs() {
    try {
      setLoading(true)
      const res = await getRequestLogs(requestId)
      setLogs(res.data || 'No logs yet.')
    } catch {
      setLogs('Failed to fetch logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
    // Poll every 4s while provisioning
    const interval = setInterval(fetchLogs, 4000)
    return () => clearInterval(interval)
  }, [requestId])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-gray-950 text-green-400 rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-2 text-sm text-gray-400 font-mono">
              terraform --- request #{requestId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Log output */}
        <pre className="flex-1 overflow-y-auto p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all">
          {logs}
          <div ref={bottomRef} />
        </pre>
      </div>
    </div>
  )
}
