import { useState } from 'react';
import { Play, AlertTriangle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui';
import { useMigrationStore } from '@/store/migration';
import { previewAPI } from '@/lib/api';
import type { PreviewResponse } from '@/types/migration';

interface PreviewResultProps {
  result: PreviewResponse;
  index: number;
}

function PreviewResult({ result, index }: PreviewResultProps) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <Card className={result.is_valid ? '' : 'border-[hsl(var(--destructive))]/50'}>
      <CardHeader
        className="cursor-pointer py-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="font-medium">Record {index + 1}</span>
          </div>
          {result.is_valid ? (
            <Badge variant="success">
              <CheckCircle className="mr-1 h-3 w-3" />
              Valid
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {result.validation_errors.length} error(s)
            </Badge>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {/* Validation Errors */}
          {result.validation_errors.length > 0 && (
            <div className="mb-4 rounded-md bg-[hsl(var(--destructive))]/10 p-3">
              <p className="text-sm font-medium text-[hsl(var(--destructive))]">Validation Errors:</p>
              <ul className="mt-1 list-inside list-disc text-sm text-[hsl(var(--destructive))]">
                {result.validation_errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Side by side comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Source */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Source Data</h4>
              <pre className="overflow-auto rounded-md bg-[hsl(var(--secondary))] p-3 text-xs">
                {JSON.stringify(result.source_data, null, 2)}
              </pre>
            </div>

            {/* Transformed */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">Transformed Data</h4>
              <pre className="overflow-auto rounded-md bg-[hsl(var(--secondary))] p-3 text-xs">
                {JSON.stringify(result.transformed_data, null, 2)}
              </pre>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function PreviewValidate() {
  const { sources, targetService, entityMappings, sampleData, setSampleData } = useMigrationStore();

  const [previews, setPreviews] = useState<PreviewResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate sample data (mock for now)
  const generateSampleData = () => {
    // In a real app, this would fetch from the source
    const samples = [
      {
        id: 'cus_123',
        email: 'john@example.com',
        name: 'John Doe',
        phone: '+1-555-0100',
        created: 1699900000,
        metadata: { plan: 'pro' },
      },
      {
        id: 'cus_456',
        email: 'jane@example.com',
        name: 'Jane Smith',
        phone: '+1-555-0200',
        created: 1699800000,
        metadata: { plan: 'enterprise' },
      },
      {
        id: 'cus_789',
        email: 'bob@example.com',
        name: 'Bob Wilson',
        created: 1699700000,
      },
    ];
    setSampleData(samples);
    return samples;
  };

  const runPreview = async () => {
    setLoading(true);
    setError(null);
    setPreviews([]);

    try {
      const samples = sampleData.length > 0 ? sampleData : generateSampleData();

      if (entityMappings.length === 0) {
        setError('No field mappings configured. Go back to Step 3 to configure mappings.');
        setLoading(false);
        return;
      }

      const mapping = entityMappings[0];

      const requests = samples.map((record) => ({
        source_record: record,
        source_service: mapping.source_service,
        source_entity: mapping.source_entity,
        target_service: mapping.target_service,
        target_entity: mapping.target_entity,
        field_mappings: mapping.field_mappings,
      }));

      const response = await previewAPI.transformBatch(requests);

      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setPreviews(response.data);
      }
    } catch (err) {
      setError('Failed to preview transformation');
    } finally {
      setLoading(false);
    }
  };

  const validCount = previews.filter((p) => p.is_valid).length;
  const invalidCount = previews.filter((p) => !p.is_valid).length;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Preview Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[hsl(var(--muted-foreground))]">Sources</p>
                <p className="font-medium">{sources.length} configured</p>
              </div>
              <div>
                <p className="text-[hsl(var(--muted-foreground))]">Target</p>
                <p className="font-medium">{targetService || 'Not set'}</p>
              </div>
              <div>
                <p className="text-[hsl(var(--muted-foreground))]">Mappings</p>
                <p className="font-medium">
                  {entityMappings.reduce((acc, m) => acc + m.field_mappings.length, 0)} fields
                </p>
              </div>
            </div>

            <Button onClick={runPreview} loading={loading} className="w-full">
              <Play className="mr-2 h-4 w-4" />
              Run Preview
            </Button>
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

      {/* Results Summary */}
      {previews.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium">{validCount} valid</span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-[hsl(var(--destructive))]" />
                    <span className="font-medium">{invalidCount} invalid</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {previews.length} records previewed
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Results */}
      {previews.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold">Preview Results</h3>
          {previews.map((result, index) => (
            <PreviewResult key={index} result={result} index={index} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {previews.length === 0 && !loading && !error && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Play className="mb-4 h-12 w-12 text-[hsl(var(--muted-foreground))]" />
            <h3 className="text-lg font-medium">Ready to Preview</h3>
            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
              Click "Run Preview" to see how your data will be transformed
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
