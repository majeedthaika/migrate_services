import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, RotateCcw, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui';
import { useMigrationStore } from '@/store/migration';
import { migrationAPI } from '@/lib/api';
import type { ProgressEvent } from '@/types/migration';
import { cn } from '@/lib/utils';

interface PhaseProgressProps {
  phase: string;
  currentPhase: string;
  completedPhases: string[];
  progress?: ProgressEvent;
}

function PhaseProgress({ phase, currentPhase, completedPhases, progress }: PhaseProgressProps) {
  const isCompleted = completedPhases.includes(phase);
  const isCurrent = currentPhase === phase;
  const isActive = isCurrent && progress;

  const phaseLabels: Record<string, string> = {
    extracting: 'Extracting',
    transforming: 'Transforming',
    validating: 'Validating',
    loading: 'Loading',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-4',
        isCompleted && 'border-green-500/50 bg-green-500/10',
        isCurrent && !isCompleted && 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10',
        !isCompleted && !isCurrent && 'border-[hsl(var(--border))] opacity-50'
      )}
    >
      <div className="flex-shrink-0">
        {isCompleted ? (
          <CheckCircle className="h-6 w-6 text-green-500" />
        ) : isCurrent ? (
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--primary))]" />
        ) : (
          <div className="h-6 w-6 rounded-full border-2 border-[hsl(var(--muted-foreground))]" />
        )}
      </div>

      <div className="flex-1">
        <p className="font-medium">{phaseLabels[phase] || phase}</p>
        {isActive && progress && (
          <div className="mt-2">
            <div className="flex justify-between text-sm text-[hsl(var(--muted-foreground))]">
              <span>
                {progress.records_processed} / {progress.total_records || '?'} records
              </span>
              <span>{progress.records_failed > 0 && `${progress.records_failed} failed`}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
              <div
                className="h-full bg-[hsl(var(--primary))] transition-all"
                style={{
                  width: `${progress.total_records ? (progress.records_processed / progress.total_records) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ExecuteMonitor() {
  const {
    name,
    description,
    sources,
    targetService,
    targetSite,
    targetApiKey,
    entityMappings,
    dryRun,
    batchSize,
    migrationId,
    setMigrationId,
    progress,
    setProgress,
  } = useMigrationStore();

  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'completed' | 'failed'>('idle');
  const [completedPhases, setCompletedPhases] = useState<string[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [totalStats, setTotalStats] = useState({ processed: 0, succeeded: 0, failed: 0 });

  const eventSourceRef = useRef<EventSource | null>(null);

  // Clean up event source on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const startMigration = async () => {
    setError(null);
    setStatus('running');
    setCompletedPhases([]);
    setCurrentPhase('');
    setTotalStats({ processed: 0, succeeded: 0, failed: 0 });

    try {
      // Create migration if not exists
      let id = migrationId;

      if (!id) {
        const createRes = await migrationAPI.create({
          name,
          description,
          sources,
          target_service: targetService,
          target_api_key: targetApiKey,
          target_site: targetSite,
          entity_mappings: entityMappings,
          dry_run: dryRun,
          batch_size: batchSize,
        });

        if (createRes.error) {
          throw new Error(createRes.error);
        }

        id = createRes.data!.id;
        setMigrationId(id);
      }

      // Start the migration
      const startRes = await migrationAPI.start(id);
      if (startRes.error) {
        throw new Error(startRes.error);
      }

      // Connect to SSE for progress updates
      const eventSource = migrationAPI.createEventStream(id);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('progress', (event) => {
        const data = JSON.parse(event.data) as ProgressEvent;
        setProgress(data);
        setCurrentPhase(data.phase || '');
      });

      eventSource.addEventListener('step_complete', (event) => {
        const data = JSON.parse(event.data) as ProgressEvent;
        if (data.phase) {
          setCompletedPhases((prev) => [...prev, data.phase!]);
        }
      });

      eventSource.addEventListener('complete', (event) => {
        const data = JSON.parse(event.data);
        setStatus('completed');
        setTotalStats({
          processed: data.total_processed,
          succeeded: data.total_succeeded,
          failed: data.total_failed,
        });
        eventSource.close();
      });

      eventSource.addEventListener('error', (event) => {
        const data = JSON.parse((event as MessageEvent).data || '{}');
        setStatus('failed');
        setError(data.error || 'Migration failed');
        eventSource.close();
      });

      eventSource.onerror = () => {
        if (status === 'running') {
          setError('Connection to migration stream lost');
        }
        eventSource.close();
      };
    } catch (err) {
      setStatus('failed');
      setError(err instanceof Error ? err.message : 'Failed to start migration');
    }
  };

  const pauseMigration = async () => {
    if (!migrationId) return;

    const res = await migrationAPI.pause(migrationId);
    if (res.error) {
      setError(res.error);
    } else {
      setStatus('paused');
    }
  };

  const resumeMigration = async () => {
    if (!migrationId) return;

    const res = await migrationAPI.resume(migrationId);
    if (res.error) {
      setError(res.error);
    } else {
      setStatus('running');
    }
  };

  const cancelMigration = async () => {
    if (!migrationId) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const res = await migrationAPI.cancel(migrationId);
    if (res.error) {
      setError(res.error);
    } else {
      setStatus('idle');
      setMigrationId(null);
    }
  };

  const rollbackMigration = async () => {
    if (!migrationId) return;

    const res = await migrationAPI.rollback(migrationId);
    if (res.error) {
      setError(res.error);
    } else {
      // Reset state after rollback
      setStatus('idle');
      setMigrationId(null);
    }
  };

  const phases = ['extracting', 'transforming', 'validating', 'loading'];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Migration Summary</CardTitle>
            {dryRun && <Badge variant="warning">Dry Run</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[hsl(var(--muted-foreground))]">Name</p>
              <p className="font-medium">{name}</p>
            </div>
            <div>
              <p className="text-[hsl(var(--muted-foreground))]">Target</p>
              <p className="font-medium">{targetService}</p>
            </div>
            <div>
              <p className="text-[hsl(var(--muted-foreground))]">Sources</p>
              <p className="font-medium">{sources.length}</p>
            </div>
            <div>
              <p className="text-[hsl(var(--muted-foreground))]">Batch Size</p>
              <p className="font-medium">{batchSize}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {status === 'idle' && (
                <Button onClick={startMigration}>
                  <Play className="mr-2 h-4 w-4" />
                  Start Migration
                </Button>
              )}

              {status === 'running' && (
                <>
                  <Button variant="outline" onClick={pauseMigration}>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </Button>
                  <Button variant="destructive" onClick={cancelMigration}>
                    <Square className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </>
              )}

              {status === 'paused' && (
                <>
                  <Button onClick={resumeMigration}>
                    <Play className="mr-2 h-4 w-4" />
                    Resume
                  </Button>
                  <Button variant="destructive" onClick={cancelMigration}>
                    <Square className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </>
              )}

              {status === 'completed' && !dryRun && (
                <Button variant="outline" onClick={rollbackMigration}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Rollback
                </Button>
              )}

              {status === 'failed' && (
                <Button onClick={startMigration}>
                  <Play className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {status === 'running' && <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--primary))]" />}
              {status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {status === 'failed' && <XCircle className="h-5 w-5 text-[hsl(var(--destructive))]" />}
              <span className="text-sm font-medium capitalize">{status}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-[hsl(var(--destructive))]">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-[hsl(var(--destructive))]">
              <AlertTriangle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase Progress */}
      {(status === 'running' || status === 'paused' || status === 'completed') && (
        <div className="space-y-3">
          <h3 className="font-semibold">Progress</h3>
          {phases.map((phase) => (
            <PhaseProgress
              key={phase}
              phase={phase}
              currentPhase={currentPhase}
              completedPhases={completedPhases}
              progress={progress?.phase === phase ? progress : undefined}
            />
          ))}
        </div>
      )}

      {/* Final Stats */}
      {status === 'completed' && (
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Migration Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{totalStats.processed}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Processed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">{totalStats.succeeded}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Succeeded</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[hsl(var(--destructive))]">{totalStats.failed}</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
