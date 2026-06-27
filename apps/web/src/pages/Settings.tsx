import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Settings as SettingsIcon, Save, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { healthApi, logGenApi } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

export function Settings() {
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [logGenUrl, setLogGenUrl] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [apiStatus, setApiStatus] = useState<'unknown' | 'ok' | 'error'>('unknown')
  const [genStatus, setGenStatus] = useState<'unknown' | 'ok' | 'error'>('unknown')

  useEffect(() => {
    setApiBaseUrl(localStorage.getItem('api_base_url') || 'http://localhost:3000')
    setApiKey(localStorage.getItem('api_key') || '')
    setLogGenUrl(localStorage.getItem('log_gen_url') || 'http://localhost:3100')
  }, [])

  const save = () => {
    localStorage.setItem('api_base_url', apiBaseUrl)
    localStorage.setItem('api_key', apiKey)
    localStorage.setItem('log_gen_url', logGenUrl)
    toast({ title: 'Settings saved. Refresh to apply.' })
  }

  const testApi = useMutation({
    mutationFn: healthApi.check,
    onSuccess: () => setApiStatus('ok'),
    onError: () => setApiStatus('error'),
  })
  const testGen = useMutation({
    mutationFn: logGenApi.status,
    onSuccess: () => setGenStatus('ok'),
    onError: () => setGenStatus('error'),
  })

  const StatusIcon = ({ status }: { status: 'unknown' | 'ok' | 'error' }) =>
    status === 'ok' ? <CheckCircle className="h-4 w-4 text-green-400" />
    : status === 'error' ? <XCircle className="h-4 w-4 text-red-400" />
    : null

  return (
    <div className="p-6 space-y-5 max-w-xl">
      <div>
        <h1 className="text-lg font-semibold text-gray-100">Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">Configure connection to the API and log generator</p>
      </div>

      {/* API config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <SettingsIcon className="h-4 w-4 text-gray-400" />
            API Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>API Base URL</Label>
            <div className="flex gap-2">
              <Input
                value={apiBaseUrl}
                onChange={e => setApiBaseUrl(e.target.value)}
                placeholder="http://localhost:3000"
              />
              <Button
                variant="outline" size="sm"
                onClick={() => testApi.mutate()}
                disabled={testApi.isPending}
              >
                Test
              </Button>
              <StatusIcon status={apiStatus} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>API Key (x-api-key)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="your-operator-api-key"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-600">
              Set in <code className="bg-white/5 px-1 rounded">apps/nest-app/.env</code> as <code className="bg-white/5 px-1 rounded">API_KEY</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Log generator config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Log Generator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Generator URL</Label>
            <div className="flex gap-2">
              <Input
                value={logGenUrl}
                onChange={e => setLogGenUrl(e.target.value)}
                placeholder="http://localhost:3100"
              />
              <Button
                variant="outline" size="sm"
                onClick={() => testGen.mutate()}
                disabled={testGen.isPending}
              >
                Test
              </Button>
              <StatusIcon status={genStatus} />
            </div>
          </div>
          <p className="text-xs text-gray-600">
            Run: <code className="bg-white/5 px-1 rounded">pnpm --filter dummy-log-generator dev</code>
          </p>
        </CardContent>
      </Card>

      <Button onClick={save}>
        <Save className="h-4 w-4" /> Save Settings
      </Button>

      <Card>
        <CardHeader><CardTitle className="text-sm">How to get started</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs text-gray-500">
          <p>1. Start the API: <code className="bg-white/5 px-1 rounded">pnpm --filter nest-app start:dev</code></p>
          <p>2. Set your <code className="bg-white/5 px-1 rounded">API_KEY</code> in <code className="bg-white/5 px-1 rounded">apps/nest-app/.env</code></p>
          <p>3. Enter that key above and save</p>
          <p>4. Optionally start the log generator and use the Log Monitor tab</p>
          <p>5. Create a Remote Server → an Analysis Job → ingest logs to see anomalies</p>
        </CardContent>
      </Card>
    </div>
  )
}
