import { useEffect, useState } from 'react'
import { Card, Row } from '../../shared/ui/Card'
import { Toggle } from '../../shared/ui/Toggle'
import { Pill } from '../../shared/ui/Pill'

export default function GeneralTab() {
  const [launchAtLogin, setLaunchAtLogin] = useState<boolean | null>(null)
  const [resetting, setResetting] = useState(false)
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [inputDeviceId, setInputDeviceId] = useState<string | null>(null)

  useEffect(() => {
    window.openflow.getLaunchAtLogin().then(setLaunchAtLogin)
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      navigator.mediaDevices.enumerateDevices(),
      window.openflow.getSettings(),
    ]).then(([devices, settings]) => {
      if (cancelled) return
      setMics(devices.filter((d) => d.kind === 'audioinput'))
      setInputDeviceId(settings.inputDeviceId)
    })
    return () => { cancelled = true }
  }, [])

  function handleSelectMic(id: string | null) {
    setInputDeviceId(id)
    window.openflow.setSettings({ inputDeviceId: id })
  }

  async function toggleLaunchAtLogin(next: boolean) {
    setLaunchAtLogin(next)
    await window.openflow.setLaunchAtLogin(next)
  }

  async function resetIndicatorPosition() {
    setResetting(true)
    await window.openflow.setSettings({ indicatorPosition: null })
    // Brief visual confirmation, then reset.
    setTimeout(() => setResetting(false), 1200)
  }

  function reopenOnboarding() {
    window.openflow.openOnboarding()
  }

  return (
    <div className="max-w-[520px] space-y-4">
      <Card>
        <Row>
          <div className="flex-1">
            <div className="text-[12.5px] font-medium">Microphone</div>
            <div className="text-[10.5px] text-ink-45 mt-0.5">
              Which input device OpenFlow records from.
            </div>
          </div>
          <select
            value={inputDeviceId ?? ''}
            onChange={(e) => handleSelectMic(e.target.value || null)}
            className="bg-card border border-ink-08 rounded-input px-2 py-1 text-[12px] focus:outline-none focus:border-volt max-w-[200px]"
          >
            <option value="">System default</option>
            {mics.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || 'Unnamed microphone'}
              </option>
            ))}
          </select>
        </Row>

        <Row>
          <div className="flex-1">
            <div className="text-[12.5px] font-medium">Launch at login</div>
            <div className="text-[10.5px] text-ink-45 mt-0.5">
              OpenFlow starts in the background when you log in.
            </div>
          </div>
          {launchAtLogin === null ? (
            <span className="text-[11px] text-ink-45">Loading…</span>
          ) : (
            <Toggle on={launchAtLogin} onChange={toggleLaunchAtLogin} />
          )}
        </Row>

        <Row>
          <div className="flex-1">
            <div className="text-[12.5px] font-medium">Indicator position</div>
            <div className="text-[10.5px] text-ink-45 mt-0.5">
              Drag the recording pill anywhere on screen — it remembers. Reset to default if it gets lost.
            </div>
          </div>
          <Pill variant="secondary" onClick={resetIndicatorPosition}>
            {resetting ? 'Reset ✓' : 'Reset'}
          </Pill>
        </Row>

        <Row>
          <div className="flex-1">
            <div className="text-[12.5px] font-medium">Onboarding</div>
            <div className="text-[10.5px] text-ink-45 mt-0.5">
              Walk through the welcome flow again. Your settings are kept.
            </div>
          </div>
          <Pill variant="secondary" onClick={reopenOnboarding}>
            Reopen
          </Pill>
        </Row>
      </Card>
    </div>
  )
}
