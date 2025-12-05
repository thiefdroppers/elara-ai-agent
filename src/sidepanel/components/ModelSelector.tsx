/**
 * Elara AI Agent - Model Selector Component
 *
 * UI for selecting WebLLM model with device compatibility checks.
 * Shows model size, performance, and system requirements.
 */

import React, { useState, useEffect } from 'react';
import type { ModelConfig, DeviceCapabilities } from '@/lib/webllm/model-config';

interface ModelSelectorProps {
  models: ModelConfig[];
  currentModel: ModelConfig | null;
  deviceCapabilities: DeviceCapabilities | null;
  onSelectModel: (modelId: string) => void;
  onLoadModel: () => void;
  isLoading: boolean;
  loadingProgress?: number;
}

export function ModelSelector({
  models,
  currentModel,
  deviceCapabilities,
  onSelectModel,
  onLoadModel,
  isLoading,
  loadingProgress = 0,
}: ModelSelectorProps) {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(
    currentModel ? Object.keys(models).find(id => models[id as any] === currentModel) || null : null
  );

  useEffect(() => {
    if (currentModel) {
      const modelId = Object.keys(models).find(
        (id) => (models as any)[id] === currentModel
      );
      if (modelId) setSelectedModelId(modelId);
    }
  }, [currentModel, models]);

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = event.target.value;
    setSelectedModelId(modelId);
    onSelectModel(modelId);
  };

  const canRunModel = (model: ModelConfig): boolean => {
    if (!deviceCapabilities) return false;

    const hasRAM = deviceCapabilities.totalRAM >= model.minRAM;
    const hasDisk = deviceCapabilities.diskSpace >= model.size / 1024;
    const hasVRAM =
      model.minVRAM === 0 ||
      (deviceCapabilities.gpuVRAM && deviceCapabilities.gpuVRAM >= model.minVRAM);

    return hasRAM && hasDisk && hasVRAM;
  };

  const getModelSizeDisplay = (sizeInMB: number): string => {
    if (sizeInMB >= 1024) {
      return `${(sizeInMB / 1024).toFixed(1)}GB`;
    }
    return `${sizeInMB}MB`;
  };

  return (
    <div className="model-selector">
      <div className="selector-header">
        <h3>AI Model Selection</h3>
        {deviceCapabilities && (
          <div className="device-info">
            <span className="info-badge">
              RAM: {deviceCapabilities.totalRAM}GB
            </span>
            {deviceCapabilities.hasWebGPU && (
              <span className="info-badge gpu">
                WebGPU: {deviceCapabilities.gpuVRAM || '?'}GB
              </span>
            )}
          </div>
        )}
      </div>

      <div className="model-select-group">
        <select
          value={selectedModelId || ''}
          onChange={handleSelectChange}
          disabled={isLoading}
          className="model-select"
        >
          <option value="" disabled>
            Select a model...
          </option>
          {Object.entries(models).map(([id, model]) => {
            const compatible = canRunModel(model);
            return (
              <option key={id} value={id} disabled={!compatible}>
                {model.displayName} - {getModelSizeDisplay(model.size)}
                {model.recommended ? ' (Recommended)' : ''}
                {!compatible ? ' (Incompatible)' : ''}
              </option>
            );
          })}
        </select>

        <button
          onClick={onLoadModel}
          disabled={!selectedModelId || isLoading}
          className="load-button"
        >
          {isLoading ? `Loading... ${loadingProgress}%` : 'Load Model'}
        </button>
      </div>

      {selectedModelId && models[selectedModelId as keyof typeof models] && (
        <div className="model-details">
          <div className="detail-row">
            <span className="label">Family:</span>
            <span className="value">{models[selectedModelId as keyof typeof models].family}</span>
          </div>
          <div className="detail-row">
            <span className="label">Context Window:</span>
            <span className="value">
              {models[selectedModelId as keyof typeof models].contextWindow.toLocaleString()} tokens
            </span>
          </div>
          <div className="detail-row">
            <span className="label">Speed:</span>
            <span className="value">
              ~{models[selectedModelId as keyof typeof models].avgTokensPerSecond} tokens/sec
            </span>
          </div>
          <div className="detail-row">
            <span className="label">Requirements:</span>
            <span className="value">
              {models[selectedModelId as keyof typeof models].minRAM}GB RAM
              {models[selectedModelId as keyof typeof models].minVRAM > 0 &&
                `, ${models[selectedModelId as keyof typeof models].minVRAM}GB VRAM`}
            </span>
          </div>
          <div className="model-description">
            {models[selectedModelId as keyof typeof models].description}
          </div>

          {!canRunModel(models[selectedModelId as keyof typeof models]) && (
            <div className="compatibility-warning">
              <strong>Warning:</strong> This model may not run well on your device.
              Recommended model: {deviceCapabilities?.recommendedModel}
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="loading-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <span className="progress-text">Downloading model... {loadingProgress}%</span>
        </div>
      )}

      <style>{`
        .model-selector {
          padding: 16px;
          background: #f8f9fa;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .selector-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .selector-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #2d3748;
        }

        .device-info {
          display: flex;
          gap: 8px;
        }

        .info-badge {
          padding: 4px 8px;
          background: #e2e8f0;
          border-radius: 4px;
          font-size: 12px;
          color: #4a5568;
        }

        .info-badge.gpu {
          background: #c3dafe;
          color: #2c5282;
        }

        .model-select-group {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .model-select {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #cbd5e0;
          border-radius: 6px;
          font-size: 14px;
          background: white;
          cursor: pointer;
        }

        .model-select:disabled {
          background: #e2e8f0;
          cursor: not-allowed;
        }

        .load-button {
          padding: 8px 16px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .load-button:hover:not(:disabled) {
          background: #5a67d8;
        }

        .load-button:disabled {
          background: #a0aec0;
          cursor: not-allowed;
        }

        .model-details {
          padding: 12px;
          background: white;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px solid #f7fafc;
        }

        .detail-row:last-of-type {
          border-bottom: none;
        }

        .detail-row .label {
          font-weight: 600;
          color: #4a5568;
          font-size: 13px;
        }

        .detail-row .value {
          color: #2d3748;
          font-size: 13px;
        }

        .model-description {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          font-size: 13px;
          color: #718096;
          line-height: 1.5;
        }

        .compatibility-warning {
          margin-top: 12px;
          padding: 12px;
          background: #fff5f5;
          border: 1px solid #feb2b2;
          border-radius: 6px;
          font-size: 13px;
          color: #c53030;
        }

        .loading-progress {
          margin-top: 12px;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          transition: width 0.3s ease;
        }

        .progress-text {
          display: block;
          text-align: center;
          margin-top: 8px;
          font-size: 12px;
          color: #718096;
        }
      `}</style>
    </div>
  );
}
