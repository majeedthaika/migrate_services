import { useState, useMemo } from 'react';
import { Play, Pause, Download, CheckCircle, XCircle, AlertCircle, Loader2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui';
import { useMigrationStore } from '@/store/migration';
import { recordsToCSV } from '@/lib/transform';
import { computeUploadOrder } from '@/lib/uploadOrder';

interface EntityProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
}

export function UploadTargetStep() {
  const {
    targetService,
    targetSite,
    setTargetSite,
    targetApiKey,
    setTargetApiKey,
    batchSize,
    setBatchSize,
    transformedData,
    uploadProgress,
    setUploadProgress,
    uploadResults,
    addUploadResult,
    clearUploadResults,
    uploadStatus,
    setUploadStatus,
    entityMappings,
    selectedMappingKeys,
    schemaRelationships,
    overriddenPrerequisites,
  } = useMigrationStore();

  const [currentEntity, setCurrentEntity] = useState<string | null>(null);
  const [completedEntities, setCompletedEntities] = useState<Set<string>>(new Set());
  const [entityProgress, setEntityProgress] = useState<Record<string, EntityProgress>>({});
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);

  // Get selected mappings
  const selectedMappings = useMemo(() =>
    entityMappings.filter((_, index) =>
      selectedMappingKeys.includes(`mapping-${index}`)
    ),
    [entityMappings, selectedMappingKeys]
  );

  // Get target relationships
  const targetRelationships = schemaRelationships[targetService] || [];

  // Compute upload order based on dependencies
  const uploadOrder = useMemo(() =>
    computeUploadOrder(
      selectedMappings,
      entityMappings,
      targetRelationships,
      completedEntities,
      overriddenPrerequisites
    ),
    [selectedMappings, entityMappings, targetRelationships, completedEntities, overriddenPrerequisites]
  );

  const totalRecords = Object.values(transformedData).reduce((sum, arr) => sum + arr.length, 0);

  const handleStartUpload = async () => {
    if (uploadOrder.length === 0) {
      alert('No entities to upload');
      return;
    }

    setUploadStatus('running');
    clearUploadResults();
    setCompletedEntities(new Set());
    setEntityProgress({});
    setUploadProgress({ total: totalRecords, processed: 0, succeeded: 0, failed: 0 });

    try {
      // Process entities in dependency order
      for (const orderItem of uploadOrder) {
        const targetKey = `${orderItem.targetService}.${orderItem.targetEntity}`;
        const records = transformedData[targetKey];

        if (!records || records.length === 0) {
          // Mark as completed even if no records
          setCompletedEntities(prev => new Set([...prev, orderItem.targetEntity]));
          setEntityProgress(prev => ({
            ...prev,
            [targetKey]: { total: 0, processed: 0, succeeded: 0, failed: 0 }
          }));
          continue;
        }

        setCurrentEntity(targetKey);
        setEntityProgress(prev => ({
          ...prev,
          [targetKey]: { total: records.length, processed: 0, succeeded: 0, failed: 0 }
        }));

        // Process in batches
        for (let i = 0; i < records.length; i += batchSize) {
          // Check if paused or cancelled
          const currentStatus = useMigrationStore.getState().uploadStatus;
          if (currentStatus === 'paused') {
            // Wait until resumed
            await new Promise<void>((resolve) => {
              const unsubscribe = useMigrationStore.subscribe((state) => {
                if (state.uploadStatus !== 'paused') {
                  unsubscribe();
                  resolve();
                }
              });
            });
          }
          if (useMigrationStore.getState().uploadStatus === 'idle') {
            // Cancelled
            return;
          }

          const batch = records.slice(i, i + batchSize);

          try {
            // Call backend API to upload batch
            const response = await fetch('/api/migrations/upload-batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                target_service: orderItem.targetService,
                target_entity: orderItem.targetEntity,
                records: batch,
                api_key: targetApiKey,
                site: targetSite || undefined,
                dry_run: false,
              }),
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            // Process results
            for (const r of result.results || []) {
              addUploadResult({
                entity: targetKey,
                sourceIndex: i + r.source_index,
                targetId: r.target_id,
                error: r.error,
              });
            }

            // Update progress
            const currentProgress = useMigrationStore.getState().uploadProgress;
            const batchSucceeded = (result.results || []).filter((r: { error?: string }) => !r.error).length;
            const batchFailed = (result.results || []).filter((r: { error?: string }) => r.error).length;

            setUploadProgress({
              ...currentProgress,
              processed: currentProgress.processed + batch.length,
              succeeded: currentProgress.succeeded + batchSucceeded,
              failed: currentProgress.failed + batchFailed,
            });

            // Update entity progress
            setEntityProgress(prev => ({
              ...prev,
              [targetKey]: {
                ...prev[targetKey],
                processed: (prev[targetKey]?.processed || 0) + batch.length,
                succeeded: (prev[targetKey]?.succeeded || 0) + batchSucceeded,
                failed: (prev[targetKey]?.failed || 0) + batchFailed,
              }
            }));
          } catch (err) {
            // Mark all records in batch as failed
            for (let j = 0; j < batch.length; j++) {
              addUploadResult({
                entity: targetKey,
                sourceIndex: i + j,
                error: err instanceof Error ? err.message : String(err),
              });
            }

            const currentProgress = useMigrationStore.getState().uploadProgress;
            setUploadProgress({
              ...currentProgress,
              processed: currentProgress.processed + batch.length,
              failed: currentProgress.failed + batch.length,
            });

            // Update entity progress
            setEntityProgress(prev => ({
              ...prev,
              [targetKey]: {
                ...prev[targetKey],
                processed: (prev[targetKey]?.processed || 0) + batch.length,
                failed: (prev[targetKey]?.failed || 0) + batch.length,
              }
            }));
          }
        }

        // Mark entity as completed
        setCompletedEntities(prev => new Set([...prev, orderItem.targetEntity]));
      }

      setUploadStatus('completed');
      setCurrentEntity(null);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadStatus('failed');
    }
  };

  const handlePauseResume = () => {
    if (uploadStatus === 'running') {
      setUploadStatus('paused');
    } else if (uploadStatus === 'paused') {
      setUploadStatus('running');
    }
  };

  const handleCancel = () => {
    setUploadStatus('idle');
    setCurrentEntity(null);
  };

  const handleDownloadResults = () => {
    const csvData = uploadResults.map((r) => ({
      entity: r.entity,
      source_index: r.sourceIndex,
      target_id: r.targetId || '',
      status: r.error ? 'failed' : 'success',
      error: r.error || '',
    }));
    const csv = recordsToCSV(csvData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'migration_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const progressPercent = uploadProgress.total > 0
    ? Math.round((uploadProgress.processed / uploadProgress.total) * 100)
    : 0;

  const failedResults = uploadResults.filter(r => r.error);

  // Get entity-specific results
  const getEntityResults = (targetKey: string) => {
    return uploadResults.filter(r => r.entity === targetKey);
  };

  return (
    <div className="space-y-4">
      {/* Target Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chargebee Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Site"
              value={targetSite}
              onChange={(e) => setTargetSite(e.target.value)}
              placeholder="e.g., your-site"
              disabled={uploadStatus === 'running' || uploadStatus === 'paused'}
            />
            <Input
              label="API Key"
              type="password"
              value={targetApiKey}
              onChange={(e) => setTargetApiKey(e.target.value)}
              placeholder="API key for Chargebee"
              disabled={uploadStatus === 'running' || uploadStatus === 'paused'}
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Batch size:</label>
            <Input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value) || 100))}
              className="w-24"
              min={1}
              disabled={uploadStatus === 'running' || uploadStatus === 'paused'}
            />
          </div>

          <div className="flex items-center gap-2">
            {uploadStatus === 'idle' && (
              <Button onClick={handleStartUpload} disabled={!targetApiKey || totalRecords === 0 || uploadOrder.length === 0}>
                <Play className="h-4 w-4 mr-2" />
                Start Upload ({totalRecords.toLocaleString()} records)
              </Button>
            )}
            {(uploadStatus === 'running' || uploadStatus === 'paused') && (
              <>
                <Button variant="outline" onClick={handlePauseResume}>
                  {uploadStatus === 'running' ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </>
            )}
            {uploadResults.length > 0 && (
              <Button variant="outline" onClick={handleDownloadResults}>
                <Download className="h-4 w-4 mr-2" />
                Export Results
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Entity Upload Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Upload Progress</CardTitle>
            {uploadStatus !== 'idle' && (
              <div className="flex items-center gap-2 text-sm">
                {uploadStatus === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                {uploadStatus === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                {uploadStatus === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                {uploadStatus === 'paused' && <Pause className="h-4 w-4 text-amber-500" />}
                <span className="font-medium">{progressPercent}%</span>
                <span className="text-[hsl(var(--muted-foreground))]">
                  ({uploadProgress.processed.toLocaleString()} / {uploadProgress.total.toLocaleString()})
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Overall Progress Bar */}
          {uploadStatus !== 'idle' && (
            <div className="mb-4">
              <div className="h-2 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[hsl(var(--primary))] transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-green-500">{uploadProgress.succeeded.toLocaleString()} succeeded</span>
                <span className="text-red-500">{uploadProgress.failed.toLocaleString()} failed</span>
              </div>
            </div>
          )}

          {/* Entity List */}
          <div className="space-y-2">
            {uploadOrder.map((item, index) => {
              const targetKey = `${item.targetService}.${item.targetEntity}`;
              const isCompleted = completedEntities.has(item.targetEntity);
              const isCurrent = currentEntity === targetKey;
              const isPending = !isCompleted && !isCurrent;
              const recordCount = transformedData[targetKey]?.length || 0;
              const progress = entityProgress[targetKey];
              const entityResults = getEntityResults(targetKey);
              const isExpanded = expandedEntity === targetKey;

              const entityPercent = progress?.total > 0
                ? Math.round((progress.processed / progress.total) * 100)
                : 0;

              return (
                <div
                  key={targetKey}
                  className={`rounded-lg border transition-all ${
                    isCompleted
                      ? 'border-green-500/30 bg-green-500/10'
                      : isCurrent
                      ? 'border-blue-500/30 bg-blue-500/10'
                      : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30'
                  }`}
                >
                  <button
                    className="w-full p-3 flex items-center gap-3 text-left"
                    onClick={() => setExpandedEntity(isExpanded ? null : targetKey)}
                  >
                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {isCompleted && <CheckCircle className="h-5 w-5 text-green-500" />}
                      {isCurrent && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
                      {isPending && <Clock className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />}
                    </div>

                    {/* Entity Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {index + 1}. {item.targetEntity}
                        </span>
                        {item.dependencies.length > 0 && (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">
                            (after {item.dependencies.join(', ')})
                          </span>
                        )}
                      </div>

                      {/* Progress info */}
                      <div className="flex items-center gap-4 mt-1 text-xs">
                        <span className="text-[hsl(var(--muted-foreground))]">
                          {recordCount.toLocaleString()} records
                        </span>
                        {progress && (
                          <>
                            {progress.succeeded > 0 && (
                              <span className="text-green-500">
                                {progress.succeeded.toLocaleString()} created
                              </span>
                            )}
                            {progress.failed > 0 && (
                              <span className="text-red-500">
                                {progress.failed.toLocaleString()} failed
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar / Status */}
                    <div className="flex-shrink-0 w-32">
                      {isCurrent && progress && (
                        <div>
                          <div className="h-1.5 bg-blue-500/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all duration-300"
                              style={{ width: `${entityPercent}%` }}
                            />
                          </div>
                          <div className="text-xs text-center mt-1 text-blue-500">
                            {entityPercent}%
                          </div>
                        </div>
                      )}
                      {isCompleted && progress && (
                        <div className="text-xs text-right">
                          <span className="text-green-500 font-medium">
                            {progress.succeeded}/{progress.total}
                          </span>
                        </div>
                      )}
                      {isPending && (
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                          Pending
                        </span>
                      )}
                    </div>

                    {/* Expand Icon */}
                    {entityResults.length > 0 && (
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                        )}
                      </div>
                    )}
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && entityResults.length > 0 && (
                    <div className="px-3 pb-3 border-t border-[hsl(var(--border))]">
                      <div className="mt-2 max-h-32 overflow-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[hsl(var(--muted-foreground))]">
                              <th className="text-left py-1 pr-4">Row</th>
                              <th className="text-left py-1 pr-4">Status</th>
                              <th className="text-left py-1">Target ID / Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entityResults.slice(0, 20).map((result, idx) => (
                              <tr key={idx} className="border-t border-[hsl(var(--border))]/30">
                                <td className="py-1.5 pr-4 text-[hsl(var(--muted-foreground))]">#{result.sourceIndex}</td>
                                <td className="py-1.5 pr-4">
                                  {result.error ? (
                                    <span className="text-red-500">Failed</span>
                                  ) : (
                                    <span className="text-green-500">Created</span>
                                  )}
                                </td>
                                <td className="py-1.5 truncate max-w-[300px] text-[hsl(var(--foreground))]">
                                  {result.error || result.targetId || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {entityResults.length > 20 && (
                          <div className="text-xs text-[hsl(var(--muted-foreground))] mt-2 text-center">
                            +{entityResults.length - 20} more results
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {uploadOrder.length === 0 && (
            <p className="text-[hsl(var(--muted-foreground))] text-sm text-center py-8">
              No entities ready to upload. Run transformation first.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error Summary */}
      {failedResults.length > 0 && uploadStatus !== 'running' && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              {failedResults.length} Failed Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-2">
              Click on an entity above to see detailed error messages, or export results for full details.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Completion Message */}
      {uploadStatus === 'completed' && (
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="py-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-semibold text-lg mb-1">Upload Complete</h3>
            <p className="text-[hsl(var(--muted-foreground))]">
              {uploadProgress.succeeded.toLocaleString()} records created successfully
              {uploadProgress.failed > 0 && ` | ${uploadProgress.failed.toLocaleString()} failed`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
