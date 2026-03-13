import React, { useState, useEffect } from 'react'
import { updateSoundEffects } from '../api/soundtrackApi'
import './AudioTrackEditor.css'

interface SoundEffect {
  timestamp: string
  prompt: string
  description: string
  category: string
  duration: number
  volume: number
  file_url: string
  file_path?: string
}

interface BackgroundMusic {
  prompt: string
  mood: string
  genre: string
  duration: number
  volume: number
  file_url: string
  file_path?: string
}

interface AssetMap {
  background_music: BackgroundMusic
  sound_effects: SoundEffect[]
  generatedAt: string
  batchFolder?: string
}

interface AudioTrackEditorProps {
  taskId: string
  assetMap: AssetMap
  onUpdate: () => void
}

export const AudioTrackEditor: React.FC<AudioTrackEditorProps> = ({
  taskId,
  assetMap,
  onUpdate
}) => {
  const [editedEffects, setEditedEffects] = useState<SoundEffect[]>([])
  const [editedBgm, setEditedBgm] = useState<BackgroundMusic | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (assetMap) {
      setEditedEffects([...assetMap.sound_effects])
      setEditedBgm(assetMap.background_music ? { ...assetMap.background_music } : null)
    }
  }, [assetMap])

  const timestampToSeconds = (timestamp: string): number => {
    const parts = timestamp.split(':')
    const hours = parseInt(parts[0])
    const minutes = parseInt(parts[1])
    const seconds = parseFloat(parts[2])
    return hours * 3600 + minutes * 60 + seconds
  }

  const secondsToTimestamp = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`
  }

  const handleVolumeChange = (index: number, newVolume: number) => {
    const updated = [...editedEffects]
    updated[index] = { ...updated[index], volume: newVolume }
    setEditedEffects(updated)
    setHasChanges(true)
  }

  const handleTimestampChange = (index: number, newSeconds: number) => {
    const updated = [...editedEffects]
    updated[index] = { ...updated[index], timestamp: secondsToTimestamp(newSeconds) }
    setEditedEffects(updated)
    setHasChanges(true)
  }

  const handleDeleteEffect = (index: number) => {
    const updated = editedEffects.filter((_, i) => i !== index)
    setEditedEffects(updated)
    setHasChanges(true)
  }

  const handleBgmVolumeChange = (newVolume: number) => {
    if (editedBgm) {
      setEditedBgm({ ...editedBgm, volume: newVolume })
      setHasChanges(true)
    }
  }

  const handleSaveChanges = async () => {
    setIsSaving(true)
    try {
      await updateSoundEffects(taskId, {
        sound_effects: editedEffects,
        background_music: editedBgm
      })
      setHasChanges(false)
      alert('配置已保存！')
      onUpdate()
    } catch (error: any) {
      console.error('保存失败:', error)
      alert(`保存失败: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setEditedEffects([...assetMap.sound_effects])
    setEditedBgm(assetMap.background_music ? { ...assetMap.background_music } : null)
    setHasChanges(false)
  }

  const playAudio = (url: string) => {
    const audio = new Audio(url)
    audio.play()
  }

  return (
    <div className="audio-track-editor">
      <div className="editor-header">
        <h3>🎚️ 音轨编辑器</h3>
        <div className="editor-actions">
          {hasChanges && (
            <>
              <button className="btn-secondary btn-small" onClick={handleReset}>
                ↶ 重置
              </button>
              <button 
                className="btn-primary btn-small" 
                onClick={handleSaveChanges}
                disabled={isSaving}
              >
                {isSaving ? '保存中...' : '💾 保存更改'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 背景音乐编辑 */}
      {editedBgm && (
        <div className="track-section bgm-section">
          <h4>🎵 背景音乐 (BGM)</h4>
          <div className="track-item">
            <div className="track-info">
              <div className="track-label">
                <span className="track-type-badge bgm">BGM</span>
                <span className="track-title">{editedBgm.mood} - {editedBgm.genre}</span>
              </div>
              <p className="track-prompt">{editedBgm.prompt}</p>
            </div>
            
            <div className="track-controls">
              <div className="control-group">
                <label>音量: {(editedBgm.volume * 100).toFixed(0)}%</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={editedBgm.volume}
                  onChange={(e) => handleBgmVolumeChange(parseFloat(e.target.value))}
                  className="volume-slider"
                />
              </div>
              
              <button 
                className="btn-icon" 
                onClick={() => playAudio(editedBgm.file_url)}
                title="播放"
              >
                ▶️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 音效列表编辑 */}
      <div className="track-section sfx-section">
        <h4>🔊 音效列表 (SFX)</h4>
        {editedEffects.length === 0 ? (
          <p className="empty-message">暂无音效</p>
        ) : (
          <div className="effects-list">
            {editedEffects.map((effect, index) => {
              const seconds = timestampToSeconds(effect.timestamp)
              return (
                <div key={index} className="track-item effect-item">
                  <div className="track-number">#{index + 1}</div>
                  
                  <div className="track-info">
                    <div className="track-label">
                      <span className="track-type-badge sfx">{effect.category}</span>
                      <span className="track-timestamp">{effect.timestamp}</span>
                    </div>
                    <p className="track-description">{effect.description}</p>
                    <p className="track-prompt">{effect.prompt}</p>
                  </div>

                  <div className="track-controls">
                    {/* 时间轴滑块 */}
                    <div className="control-group">
                      <label>时间: {effect.timestamp}</label>
                      <input
                        type="range"
                        min="0"
                        max={editedBgm?.duration || 120}
                        step="0.1"
                        value={seconds}
                        onChange={(e) => handleTimestampChange(index, parseFloat(e.target.value))}
                        className="time-slider"
                      />
                    </div>

                    {/* 音量滑块 */}
                    <div className="control-group">
                      <label>音量: {(effect.volume * 100).toFixed(0)}%</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={effect.volume}
                        onChange={(e) => handleVolumeChange(index, parseFloat(e.target.value))}
                        className="volume-slider"
                      />
                    </div>

                    {/* 操作按钮 */}
                    <div className="control-actions">
                      <button 
                        className="btn-icon" 
                        onClick={() => playAudio(effect.file_url)}
                        title="播放"
                      >
                        ▶️
                      </button>
                      <button 
                        className="btn-icon btn-danger" 
                        onClick={() => handleDeleteEffect(index)}
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {hasChanges && (
        <div className="changes-notice">
          ⚠️ 您有未保存的更改，请点击"保存更改"按钮
        </div>
      )}
    </div>
  )
}

export default AudioTrackEditor





















